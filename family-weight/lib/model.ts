import { z } from "zod";

export const weight = z.number().min(1).max(700).multipleOf(0.1);
const memberId = z.uuid();
const date = z.iso.date();

export const change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), name: z.string().trim().min(1).max(20) }),
  z.object({ action: z.literal("rename"), id: memberId, name: z.string().trim().min(1).max(20) }),
  z.object({ action: z.literal("remove"), id: memberId }),
  z.object({
    action: z.literal("goal"), id: memberId, initial: weight.nullable(),
    target: weight.nullable(), deadline: date.nullable(),
  }).refine(v => (v.initial === null) === (v.target === null) && (v.target !== null || v.deadline === null)),
  z.object({
    action: z.literal("record"), id: memberId, day: date,
    morning: weight.nullable().optional(), evening: weight.nullable().optional(),
    note: z.string().trim().max(140).optional(),
  }).refine(v => v.morning !== undefined || v.evening !== undefined || v.note !== undefined),
  z.object({ action: z.literal("erase"), id: memberId, day: date }),
]);

export type Change = z.infer<typeof change>;
export type Member = { id: string; name: string; initial: number | null; target: number | null; deadline: string | null };
export type Entry = { member_id: string; day: string; morning: number | null; evening: number | null; note: string };
export type Family = { members: Member[]; records: Entry[] };
export type Range = 7 | 30 | 90 | 0;

export function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export function offset(day: string, days: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function within(day: string, end: string, range: Range) {
  return day <= end && (range === 0 || day >= offset(end, 1 - range));
}

export function steps(target: number, initial: number, current: number) {
  const difference = target - initial;
  if (difference === 0) return current === target ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((current - initial) / difference * 100)));
}

export function gap(target: number, initial: number, current: number) {
  if (target === initial) return Math.abs(target - current);
  return Math.max(0, (target - current) * Math.sign(target - initial));
}

export const fixed = (n: number | null | undefined) => n == null ? "—" : n.toFixed(1);
export function signed(value: number | null) {
  if (value === null) return "—";
  const rounded = Number(value.toFixed(1));
  return rounded === 0 ? "0.0" : (rounded > 0 ? "+" : "−") + Math.abs(rounded).toFixed(1);
}
