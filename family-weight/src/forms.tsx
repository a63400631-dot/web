"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, Check, Moon, Sun, Trash2, X } from "lucide-react";
import { fixed, weight, type Change, type Entry, type Member } from "../lib/model";

export type Save = (change: Change) => Promise<void>;
const valueText = (n: number | null | undefined) => n == null ? "" : fixed(n);

function readWeight(raw: string) {
  if (!raw.trim()) return null;
  if (!/^(?:\d+(?:[.,]\d)?|[.,]\d)$/.test(raw.trim())) throw new Error("体重最多填写一位小数。");
  const result = weight.safeParse(Number(raw.replace(",", ".")));
  if (!result.success) throw new Error("请输入 1–700 kg 之间的体重。");
  return result.data;
}

export function WeightInput({ name, value, onChange, placeholder = "输入体重" }: {
  name: string; value: string; onChange: (value: string) => void; placeholder?: string;
}) {
  return <span className="weight-input"><input type="text" inputMode="decimal" autoComplete="off"
    maxLength={7} aria-label={name} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /><span>kg</span></span>;
}

export function RecordForm({ id, entry, initialDay, maxDay, quick, save, readEntry, done }: {
  id: string; entry?: Entry; initialDay: string; maxDay: string; quick?: boolean;
  save: Save; readEntry?: (day: string) => Entry | undefined; done?: () => void;
}) {
  const [day, setDay] = useState(initialDay);
  const original = quick ? entry : readEntry?.(day);
  const [morningDraft, setMorning] = useState<string>();
  const [eveningDraft, setEvening] = useState<string>();
  const [noteDraft, setNote] = useState<string>();
  const morning = morningDraft ?? valueText(original?.morning);
  const evening = eveningDraft ?? valueText(original?.evening);
  const note = noteDraft ?? original?.note ?? "";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function selectDay(day: string) {
    setDay(day); setMorning(undefined); setEvening(undefined); setNote(undefined); setMessage("");
  }

  async function commit(erase = false) {
    setMessage("");
    setBusy(true);
    try {
      if (erase) {
        await save({ action: "erase", id, day });
      } else {
        const m = readWeight(morning);
        const e = readWeight(evening);
        const payload: Change = { action: "record", id, day };
        if (morningDraft !== undefined && m !== (original?.morning ?? null)) payload.morning = m;
        if (eveningDraft !== undefined && e !== (original?.evening ?? null)) payload.evening = e;
        if (noteDraft !== undefined && note.trim() !== (original?.note ?? "")) payload.note = note.trim();
        if (!original && m === null && e === null) throw new Error("请填写早晨或晚上的体重。");
        if (original && m === null && e === null) throw new Error("如需清空当天记录，请在日历中删除。");
        if (Object.keys(payload).length > 3) await save(payload);
        setMorning(undefined);
        setEvening(undefined);
        setNote(undefined);
      }
      done?.();
      setMessage(erase ? "已删除" : "已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请重试。");
    } finally { setBusy(false); }
  }

  return <form className="record-form" onSubmit={e => { e.preventDefault(); void commit(); }}>
    <fieldset disabled={busy}>
      {!quick && <label className="field">日期<input type="date" required max={maxDay} value={day} onChange={e => selectDay(e.target.value)} /></label>}
      <div className="record-fields">
        <label className="weight-field morning"><span><Sun size={17} />早晨体重</span><WeightInput name="早晨体重" value={morning} onChange={setMorning} placeholder="0.0" /></label>
        <label className="weight-field evening"><span><Moon size={16} />晚上体重</span><WeightInput name="晚上体重" value={evening} onChange={setEvening} placeholder="0.0" /></label>
      </div>
      <input className="note" aria-label="备注" value={note} onChange={e => setNote(e.target.value)} maxLength={140} placeholder="添加备注（可选）" />
      <button className="primary wide" type="submit"><Check size={17} />{busy ? "保存中…" : "保存记录"}</button>
      {!quick && original && <button className="danger text-button" type="button" onClick={() => {
        if (window.confirm("删除这一天的早晚体重和备注？")) void commit(true);
      }}><Trash2 size={16} />删除当天记录</button>}
    </fieldset>
    {message && <div className={message.startsWith("已") ? "feedback success" : "feedback error"} role="status">{message}</div>}
  </form>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <dialog className="modal" ref={node => { if (node && !node.open) node.showModal(); }}
    onCancel={e => { e.preventDefault(); close(); }} aria-label={title}>
    <div className="card-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={close}><X size={21} /></button></div>
    {children}
  </dialog>;
}

export function MemberForm({ member, save, done }: { member?: Member; save: Save; done: () => void }) {
  const [name, setName] = useState(member?.name ?? "");
  return <SimpleForm submit={async () => {
    await save(member ? { action: "rename", id: member.id, name } : { action: "add", name });
    done();
  }}><label className="field">昵称<input autoFocus required maxLength={20} value={name} placeholder="例如：爸爸" onChange={e => setName(e.target.value)} /></label></SimpleForm>;
}

export function GoalForm({ member, save, done }: { member: Member; save: Save; done: () => void }) {
  const [initial, setInitial] = useState(valueText(member.initial));
  const [target, setTarget] = useState(valueText(member.target));
  const [deadline, setDeadline] = useState(member.deadline ?? "");
  return <SimpleForm submit={async () => {
    const a = readWeight(initial), b = readWeight(target);
    if (a === null || b === null) throw new Error("请填写初始体重和目标体重。");
    await save({ action: "goal", id: member.id, initial: a, target: b, deadline: deadline || null });
    done();
  }} extra={member.target !== null ? async () => {
    await save({ action: "goal", id: member.id, initial: null, target: null, deadline: null });
    done();
  } : undefined}>
    <label className="field">初始体重<WeightInput name="初始体重" value={initial} onChange={setInitial} /></label>
    <label className="field">目标体重<WeightInput name="目标体重" value={target} onChange={setTarget} /></label>
    <label className="field"><span className="inline"><CalendarDays size={16} />目标日期（可选）</span><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
  </SimpleForm>;
}

function SimpleForm({ children, submit, extra }: { children: ReactNode; submit: () => Promise<void>; extra?: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "操作失败，请重试。"); }
    finally { setBusy(false); }
  }
  function onSubmit(e: FormEvent) { e.preventDefault(); void run(submit); }
  return <form onSubmit={onSubmit}><fieldset disabled={busy} className="stack">
    {children}<button className="primary wide">{busy ? "保存中…" : "保存"}</button>
    {extra && <button type="button" className="text-button danger" onClick={() => void run(extra)}>清除目标</button>}
  </fieldset>{message && <p className="error" role="alert">{message}</p>}</form>;
}
