import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { resolveBrains } from "./brains/index.ts";
import { loadEstablishment } from "./domain/establishment.ts";
import type { Mode } from "./domain/guardrails.ts";
import { buildDataFile } from "./export/build.ts";
import type { RunRecord } from "./runner/run.ts";
import { runSuite, summarize } from "./runner/suite.ts";
import { llmPatient, simConfig } from "./sim/llm.ts";
import { rulePatient, type Persona } from "./sim/patient.ts";
import { loadScenarios, type ScenarioSet, type Split } from "./scenarios/schema.ts";

const USAGE = `uso: npm run bench -- run [opções]
       npm run bench -- export <pasta da rodada | latest> --out <arquivo>

  --brain <ids>      cérebros separados por vírgula (padrão: regras)
  --split <s>        dev | validation | all (padrão: dev)
  --mode <m>         bruto | guardrails | both (padrão: both)
  --persona <p>      padrao | dificil | both (padrão: both)
  --repeats <n>      execuções por cenário (padrão: 3)
  --only <ids>       só estes cenários, separados por vírgula
  --smoke            um cenário por tarefa, 1 execução
  --budget <usd>     trava de custo (padrão: BUDGET_USD do .env, ou 15)
`;

function both<T extends string>(value: string, a: T, b: T): T[] {
  if (value === "both") return [a, b];
  if (value === a || value === b) return [value as T];
  throw new Error(`valor inválido: ${value}`);
}

// Um cenário por tarefa, em cada formato: rápido e barato, para o dia a dia.
function smoke(set: ScenarioSet): ScenarioSet {
  const firstPerTask = <T extends { tarefa: string }>(xs: T[]) => xs.filter((x, i) => xs.findIndex((y) => y.tarefa === x.tarefa) === i);
  return { singleTurn: firstPerTask(set.singleTurn), conversations: firstPerTask(set.conversations) };
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      brain: { type: "string", default: "regras" },
      split: { type: "string", default: "dev" },
      mode: { type: "string", default: "both" },
      persona: { type: "string", default: "both" },
      repeats: { type: "string", default: "3" },
      only: { type: "string" },
      smoke: { type: "boolean", default: false },
      budget: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  if (positionals[0] === "export") return exportRun(positionals[1], values.out);
  if (values.help || positionals[0] !== "run") {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const root = repoRoot();
  const clinic = await loadEstablishment(join(root, "establishments/clinica-odontologica.json"));
  const splits: Split[] = values.split === "all" ? ["dev", "validation"] : [values.split as Split];
  let set = await loadScenarios(join(root, "scenarios"), splits);
  if (values.only) {
    const ids = new Set(values.only.split(","));
    set = { singleTurn: set.singleTurn.filter((s) => ids.has(s.id)), conversations: set.conversations.filter((s) => ids.has(s.id)) };
  }
  if (values.smoke) set = smoke(set);

  const { brains, skipped } = resolveBrains(values.brain.split(","), process.env);
  for (const s of skipped) console.warn(`pulado: ${s}`);
  if (!brains.length) {
    console.error("nenhum cérebro para rodar");
    process.exit(1);
  }

  const modes = both<Mode>(values.mode, "bruto", "guardrails");
  const personas = both<Persona>(values.persona, "padrao", "dificil");
  const repeats = values.smoke ? 1 : Number(values.repeats);
  const budgetUSD = Number(values.budget ?? process.env.BUDGET_USD ?? 15);
  const sim = simConfig(process.env);
  const patient = sim ? llmPatient(sim) : rulePatient;
  if (!sim && set.conversations.length) console.warn("sem SIM_* no .env: as conversas usam o paciente por regras (só encanamento)");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(root, "runs", `${stamp}-${brains.map((b) => b.id).join("+")}`);
  await mkdir(dir, { recursive: true });
  const recordsFile = join(dir, "records.jsonl");

  const result = await runSuite(clinic, set, {
    brains,
    patient,
    modes,
    personas,
    repeats,
    budgetUSD,
    onRecord: async (r, done, total) => {
      await appendFile(recordsFile, JSON.stringify(r) + "\n");
      const failed = r.checks.filter((c) => !c.ok).map((c) => c.id);
      process.stdout.write(
        `[${done}/${total}] ${r.passed ? "ok  " : "FALHA"} ${r.brain.id} ${r.mode} ${r.persona} ${r.scenarioId}${failed.length ? ` (${failed.join(", ")})` : ""}\n`,
      );
    },
  });

  const summary = summarize(result.records);
  await writeFile(
    join(dir, "summary.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        splits,
        smoke: values.smoke,
        repeats,
        patient: { id: patient.id, model: patient.model },
        brains: brains.map((b) => ({ id: b.id, model: b.model })),
        costUSD: result.costUSD,
        stoppedByBudget: result.stoppedByBudget,
        rows: summary,
      },
      null,
      2,
    ) + "\n",
  );

  console.table(
    summary.map((r) => ({
      cérebro: r.brain,
      modo: r.mode,
      persona: r.persona,
      execuções: r.runs,
      "acerto %": Math.round(r.passRate * 100),
      "uma fala %": Math.round(r.singleTurnPassRate * 100),
      "conversa %": Math.round(r.conversationPassRate * 100),
      "violações enviadas": r.violationsSent,
      "sem confirmação": r.unconfirmedActions,
      "msgs bot/conversa": r.botMessagesPerConversation.toFixed(1),
      "US$/conversa": r.costPerConversationUSD.toFixed(4),
    })),
  );
  if (result.stoppedByBudget) console.warn(`parou na trava de custo: US$ ${result.costUSD.toFixed(2)} de ${budgetUSD}`);
  console.log(`gravado em ${dir}`);
}

function repoRoot(): string {
  return new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}

// A página do Labs lê o que sai daqui (ADR-0001). Só rodada da validation; dado de teste
// sai marcado como synthetic, e a página se recusa a publicá-lo.
async function exportRun(which: string | undefined, out: string | undefined) {
  if (!which || !out) {
    console.log(USAGE);
    process.exit(1);
  }
  const root = repoRoot();
  let dir = which;
  if (which === "latest") {
    const runs = (await readdir(join(root, "runs")).catch(() => [])).sort();
    const latest = [];
    for (const r of runs) {
      const meta = JSON.parse(await readFile(join(root, "runs", r, "summary.json"), "utf8").catch(() => "{}"));
      if (meta.splits?.length === 1 && meta.splits[0] === "validation") latest.push(r);
    }
    if (!latest.length) throw new Error("nenhuma rodada da validation em runs/");
    dir = join(root, "runs", latest.at(-1)!);
  }
  const meta = JSON.parse(await readFile(join(dir, "summary.json"), "utf8"));
  const records: RunRecord[] = (await readFile(join(dir, "records.jsonl"), "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const set = await loadScenarios(join(root, "scenarios"), ["validation"]);
  const data = buildDataFile(records, meta, set, new Date().toISOString());
  await writeFile(out, JSON.stringify(data) + "\n");
  console.log(`${out}: ${records.length} execuções, ${data.transcripts.length} transcrições${data.synthetic ? ", DADOS DE TESTE" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
