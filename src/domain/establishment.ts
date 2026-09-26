import { readFile } from "node:fs/promises";
import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const weekday = z.enum(["seg", "ter", "qua", "qui", "sex", "sab", "dom"]);

export const Establishment = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.string().min(1),
    fictional: z.literal(true),
    address: z.string().min(1),
    phone: z.string().min(1),
    hours: z.array(z.object({ days: z.array(weekday).min(1), open: time, close: time })).min(1),
    slotMinutes: z.number().int().positive(),
    insurances: z.array(z.string().min(1)),
    professionals: z
      .array(z.object({ id: z.string().min(1), name: z.string().min(1), specialty: z.string().min(1) }))
      .min(1),
    services: z
      .array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          aliases: z.array(z.string()).default([]),
          priceBRL: z.number().nonnegative(),
          durationMinutes: z.number().int().positive(),
          professionalIds: z.array(z.string().min(1)).min(1),
          coveredByInsurance: z.boolean(),
        }),
      )
      .min(1),
    emergency: z.object({ keywords: z.array(z.string().min(1)).min(1), message: z.string().min(1) }),
  })
  .superRefine((e, ctx) => {
    const professionalIds = new Set(e.professionals.map((p) => p.id));
    e.services.forEach((s, i) =>
      s.professionalIds.forEach((pid) => {
        if (!professionalIds.has(pid))
          ctx.addIssue({ code: "custom", path: ["services", i, "professionalIds"], message: `profissional desconhecido: ${pid}` });
      }),
    );
    e.hours.forEach((h, i) => {
      if (h.open >= h.close) ctx.addIssue({ code: "custom", path: ["hours", i], message: "abre depois de fechar" });
    });
  });

export type Establishment = z.infer<typeof Establishment>;

export async function loadEstablishment(path: string): Promise<Establishment> {
  return Establishment.parse(JSON.parse(await readFile(path, "utf8")));
}
