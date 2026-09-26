import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Establishment, loadEstablishment } from "./establishment.ts";

const path = fileURLToPath(new URL("../../establishments/clinica-odontologica.json", import.meta.url));

describe("establishment", () => {
  it("carrega a clínica odontológica fictícia", async () => {
    const e = await loadEstablishment(path);
    expect(e.fictional).toBe(true);
    expect(e.services.map((s) => s.id)).toContain("limpeza");
  });

  it("recusa serviço com profissional desconhecido", async () => {
    const e = await loadEstablishment(path);
    const broken = { ...e, services: [{ ...e.services[0], professionalIds: ["ninguem"] }] };
    expect(Establishment.safeParse(broken).success).toBe(false);
  });

  it("recusa estabelecimento que não se declara fictício", async () => {
    const e = await loadEstablishment(path);
    expect(Establishment.safeParse({ ...e, fictional: false }).success).toBe(false);
  });
});
