"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, CalendarDays, ChartNoAxesCombined, ChevronLeft, ChevronRight, House, LockKeyhole,
  LogOut, Pencil, Plus, Settings, ShieldCheck, Sun, Target, Trash2, UsersRound, Weight,
} from "lucide-react";
import { fixed, gap, offset, signed, steps, today, within, type Change, type Entry, type Family, type Member, type Range } from "../lib/model";
import { blue, Chart, orange, palette, point, Ranges, rangeName } from "./charts";
import { GoalForm, MemberForm, Modal, RecordForm } from "./forms";

const tabs = [
  ["home", "首页", House], ["trends", "趋势", ChartNoAxesCombined], ["calendar", "日历", CalendarDays],
  ["family", "家庭", UsersRound], ["settings", "设置", Settings],
] as const;
type Tab = typeof tabs[number][0];
type Editor = { type: "goal" } | { type: "member"; member?: Member } | { type: "record"; day: string };

async function call<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const result = await fetch("/api/" + path, { method, cache: "no-store", headers: data === undefined ? undefined : { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  if (result.status === 401 && path === "data") window.location.reload();
  const body = await result.json();
  if (!result.ok) throw new Error(body.error ?? "请稍后重试。");
  return body;
}

function Brand() {
  return <div className="brand"><div className="brand-icon"><Weight size={24} strokeWidth={1.8} /></div><div><strong>轻秤</strong><span>家庭体重记录</span></div></div>;
}

export function Login() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await call("session", "POST", { password });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法登录。");
      setBusy(false);
    }
  }
  return <main className="login-page"><div className="card login-card">
    <Brand /><div className="login-lock"><LockKeyhole size={26} /></div><h1>进入家庭空间</h1>
    <p>输入家庭密码，查看和记录体重。</p>
    <form onSubmit={unlock} className="stack">
      <label className="field">家庭密码<input type="password" name="password" autoComplete="current-password" autoFocus required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="primary wide" disabled={busy}>{busy ? "正在验证…" : "进入"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </div></main>;
}

const initials = (name: string) => Array.from(name)[0];
const dateLabel = (day: string) => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z"));
const latestMorning = (rows: Entry[]) => rows.findLast(row => row.morning !== null);
const periods = (rows: Entry[], date: string, range: Range) => rows.filter(row => within(row.day, date, range));

function delta(rows: Entry[], date: string, range: Range) {
  const mornings = periods(rows, date, range).flatMap(row => row.morning === null ? [] : [row.morning]);
  return mornings.length > 1 ? mornings[mornings.length - 1] - mornings[0] : null;
}

function Metric({ title, children }: { title: string; children: ReactNode }) {
  return <div className="metric"><span>{title}</span><strong>{children}</strong></div>;
}

function Progress({ member, current, edit }: { member: Member; current?: number | null; edit: () => void }) {
  const { target, initial, deadline } = member;
  const hasGoal = target !== null && initial !== null;
  const progress = hasGoal && current != null ? steps(target, initial, current) : null;
  const mode = !hasGoal ? "" : target < initial ? "减重" : target > initial ? "增重" : "维持";
  return <section className="card goal-card">
    <div className="card-heading"><h2><span className="section-icon mint"><Target size={19} /></span>体重目标</h2>
      <button className="subtle-button" onClick={edit}><Pencil size={14} />{hasGoal ? "编辑" : "设置"}</button>
    </div>
    {hasGoal ? <>
      <div className="goal-top"><div><div className="caption">目标体重</div><div className="goal-number">{fixed(target)} <small>kg</small></div></div><span className="mode">{mode}</span></div>
      <div className="progress-label"><span>完成进度</span><strong>{progress === null ? "—" : progress + "%"}</strong></div>
      <div className="progress-track" role="progressbar" aria-label="目标完成进度" aria-valuenow={progress ?? undefined}><div style={{ width: (progress ?? 0) + "%" }} /></div>
      <div className="goal-metrics"><Metric title="距目标">{fixed(current == null ? null : gap(target, initial, current))} <small>kg</small></Metric>
        <Metric title="较初始">{signed(current == null ? null : current - initial)} <small>kg</small></Metric></div>
      <p className="goal-date">{deadline ? <><CalendarDays size={14} />目标日期 {deadline}</> : "按最新早晨体重计算"}</p>
    </> : <div className="empty-inline"><p>为{member.name}设置初始体重和目标体重。</p><button className="secondary" onClick={edit}><Plus size={16} />设置目标</button></div>}
  </section>;
}

function Overview({ member, rows, day }: { member: Member; rows: Entry[]; day: string }) {
  const current = latestMorning(rows);
  const previous = current && latestMorning(rows.filter(row => row.day < current.day));
  const change = current?.morning != null && previous?.morning != null ? current.morning - previous.morning : null;
  return <section className="card overview">
    <div className="overview-date"><CalendarDays size={15} />{dateLabel(day)}</div>
    <div className="hero-art" aria-hidden="true"><Activity size={205} strokeWidth={0.65} /></div>
    <div className="caption hero-caption">最新早晨体重</div>
    <div className="hero-number">{fixed(current?.morning)} <small>kg</small></div>
    <div className="hero-detail">{change !== null && <span className="delta">{signed(change)} kg</span>}
      <span>{change !== null ? "较上次早晨" : current ? "记录于 " + current.day : "还没有早晨记录"}</span>
    </div>
    <div className="hero-foot"><Sun size={17} />{current ? current.day === day ? "今天已记录早晨体重" : "最近记录 · " + current.day : member.name + "的体重概览"}</div>
  </section>;
}

function Trend({ rows, day, target, range, setRange }: { rows: Entry[]; day: string; target?: number | null; range: Range; setRange: (v: Range) => void }) {
  const data = periods(rows, day, range).map(row => ({ ...point(row.day), morning: row.morning, evening: row.evening }));
  const low = rows.reduce<number | null>((min, row) => row.morning === null ? min : min === null ? row.morning : Math.min(min, row.morning), null);
  return <section className="card trend-card">
    <div className="card-heading trend-heading"><div><h2><span className="section-icon blue"><ChartNoAxesCombined size={19} /></span>体重趋势</h2><p>{range === 0 ? "全部记录" : "最近 " + rangeName(range)} · kg</p></div>
      <Ranges range={range} select={setRange} /></div>
    <Chart points={data} target={target} series={[{ key: "morning", label: "早晨体重", color: blue }, { key: "evening", label: "晚上体重", color: orange }]} />
    <div className="stats">
      <Metric title="近 7 天变化">{signed(delta(rows, day, 7))} <small>kg</small></Metric>
      <Metric title="近 30 天变化">{signed(delta(rows, day, 30))} <small>kg</small></Metric>
      <Metric title="历史最低（早晨）">{fixed(low)} <small>kg</small></Metric>
      <Metric title="累计记录">{rows.length} <small>天</small></Metric>
    </div>
  </section>;
}

function FamilyTrend({ data, day }: { data: Family; day: string }) {
  const [selection, setSelection] = useState(() => data.members.map(m => m.id));
  const [relative, setRelative] = useState(false);
  const [range, setRange] = useState<Range>(30);
  const series = data.members.flatMap((m, i) => selection.includes(m.id) ? [{ key: m.id, label: m.name, color: palette[i % palette.length] }] : []);
  const baseline = new Map<string, number>();
  const byDay = new Map<string, ReturnType<typeof point>>();
  for (const row of data.records) {
    if (!selection.includes(row.member_id) || row.morning === null || row.day > day) continue;
    if (!baseline.has(row.member_id)) baseline.set(row.member_id, row.morning);
    if (!within(row.day, day, range)) continue;
    const item = byDay.get(row.day) ?? point(row.day);
    item[row.member_id] = relative ? row.morning - baseline.get(row.member_id)! : row.morning;
    byDay.set(row.day, item);
  }
  return <section className="card trend-card">
    <div className="card-heading trend-heading"><div><h2><span className="section-icon mint"><UsersRound size={19} /></span>家庭趋势</h2><p>早晨体重 · {relative ? "较各自首条早晨记录的变化" : "绝对体重"}</p></div><Ranges range={range} select={setRange} /></div>
    <div className="family-controls"><div className="member-list" aria-label="对比成员">{data.members.map((m, i) =>
      <button key={m.id} className="compare-chip" aria-pressed={selection.includes(m.id)} onClick={() => setSelection(items => items.includes(m.id) ? items.filter(id => id !== m.id) : [...items, m.id])}><i style={{ background: palette[i % palette.length] }} />{m.name}</button>)}</div>
      <div className="segmented"><button aria-pressed={!relative} onClick={() => setRelative(false)}>绝对体重</button><button aria-pressed={relative} onClick={() => setRelative(true)}>相对变化</button></div>
    </div>
    <Chart points={[...byDay.values()]} series={series} relative={relative} />
  </section>;
}

function Calendar({ day, rows, edit }: { day: string; rows: Entry[]; edit: (day: string) => void }) {
  const [month, setMonth] = useState(day.slice(0, 7));
  const [year, number] = month.split("-").map(Number);
  const start = Date.UTC(year, number - 1, 1);
  const blank = (new Date(start).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const entries = new Map(rows.map(row => [row.day, row]));
  const move = (n: number) => setMonth(new Date(Date.UTC(year, number - 1 + n, 1)).toISOString().slice(0, 7));
  return <section className="card calendar-card">
    <div className="card-heading"><h2><span className="section-icon blue"><CalendarDays size={19} /></span>记录日历</h2><button className="subtle-button" onClick={() => edit(day)}><Plus size={16} />补录</button></div>
    <div className="calendar-toolbar"><button className="icon-button" aria-label="上个月" onClick={() => move(-1)}><ChevronLeft size={20} /></button>
      <strong>{year} 年 {number} 月</strong><button className="icon-button" aria-label="下个月" disabled={month >= day.slice(0, 7)} onClick={() => move(1)}><ChevronRight size={20} /></button></div>
    <div className="calendar-grid">
      {["一", "二", "三", "四", "五", "六", "日"].map(name => <div key={name} className="weekday">周{name}</div>)}
      {Array.from({ length: blank }, (_, i) => <div key={"blank" + i} />)}
      {Array.from({ length: count }, (_, i) => {
        const date = offset(month + "-01", i);
        const row = entries.get(date);
        const morning = row?.morning != null, evening = row?.evening != null;
        const status = morning && evening ? "早晚都有记录" : morning ? "仅早晨有记录" : evening ? "仅晚上有记录" : "无记录";
        return <button className="calendar-day" key={date} aria-current={date === day ? "date" : undefined} disabled={date > day} aria-label={date + " " + status} onClick={() => edit(date)}>
          <span>{i + 1}</span><span className="day-dots">{morning && <i className="am" />}{evening && <i className="pm" />}</span></button>;
      })}
    </div>
    <div className="legend"><span><i className="am" />早晨</span><span><i className="pm" />晚上</span><span><i className="am" /><i className="pm" />早晚都有</span></div>
  </section>;
}

export function Dashboard({ demo }: { demo: boolean }) {
  const [data, setData] = useState<Family>();
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [range, setRange] = useState<Range>(30);
  const [editor, setEditor] = useState<Editor>();
  const [settingsBusy, setSettingsBusy] = useState(false);
  const version = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++version.current;
    setDay(today());
    try {
      const result = await call<Family>("data");
      if (request !== version.current) return;
      setData(result); setLoadError("");
    } catch (e) {
      if (request === version.current) setLoadError(e instanceof Error ? e.message : "加载失败，请重试。");
    }
  }, []);

  useEffect(() => {
    void refresh();
    function visible() { if (document.visibilityState === "visible") void refresh(); }
    const timer = window.setInterval(visible, 30000);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function save(change: Change) {
    await call("data", "POST", change);
    await refresh();
  }

  async function remove(member: Member) {
    if (!window.confirm("删除「" + member.name + "」及其所有体重记录和目标？此操作无法撤销。")) return;
    setSettingsBusy(true);
    try { await save({ action: "remove", id: member.id }); setNotice("成员已删除"); }
    catch (e) { setNotice(e instanceof Error ? e.message : "删除失败"); }
    finally { setSettingsBusy(false); }
  }

  async function logout() {
    setSettingsBusy(true);
    try { await call("session", "DELETE"); window.location.reload(); }
    catch { setNotice("暂时无法退出，请重试。"); setSettingsBusy(false); }
  }

  function navigate(destination: Tab) {
    setTab(destination); setEditor(undefined); window.scrollTo({ top: 0, behavior: "instant" });
  }

  const member = data?.members.find(m => m.id === selected) ?? data?.members[0];
  const rows = data?.records.filter(row => row.member_id === member?.id && row.day <= day) ?? [];
  const entry = (date: string) => rows.find(row => row.day === date);
  const close = () => setEditor(undefined);
  const saved = () => { setNotice("已保存"); close(); };
  const add = () => setEditor({ type: "member" });
  const editGoal = () => setEditor({ type: "goal" });
  const editDay = (date: string) => setEditor({ type: "record", day: date });

  return <>
    <header className="topbar"><div className="frame topbar-inner"><Brand />
      <button className="private-badge" onClick={() => navigate("settings")}><ShieldCheck size={16} /><span>{demo ? "本地演示" : "家庭空间"}</span></button>
    </div></header>
    <main className="frame page">
      <div className="page-heading"><div><h1>{tab === "home" ? "体重概览" : tab === "trends" ? "趋势分析" : tab === "calendar" ? "日历" : tab === "family" ? "家庭对比" : "设置"}</h1>
        <p>{tab === "home" ? "记录每日体重，查看每一点变化。" : tab === "trends" ? "查看早晚体重和目标进度。" : tab === "calendar" ? "按日期查看、补录或修改体重。" : tab === "family" ? "同一张图查看家人的早晨体重。" : "管理成员和家庭访问。"}</p></div>
        {tab === "home" && <button className="secondary add-member" onClick={add}><Plus size={17} />添加成员</button>}
      </div>
      {data && member && tab !== "family" && tab !== "settings" && <div className="member-switch" aria-label="当前成员">
        {data.members.map((m, i) => <button key={m.id} className="member-chip" aria-pressed={m.id === member.id} onClick={() => setSelected(m.id)}>
          <i className={"avatar avatar-" + i % 4}>{initials(m.name)}</i><span>{m.name}</span></button>)}
      </div>}
      {loadError && <div className="load-error" role="alert">{loadError}<button className="secondary" onClick={() => void refresh()}>重试</button></div>}
      {!data && !loadError && <div className="card empty-state" role="status">正在加载家庭数据…</div>}
      {data && !member && tab !== "settings" && <div className="card empty-state"><UsersRound size={32} /><h2>添加第一位家庭成员</h2><p>每位成员都有自己的体重记录和目标。</p><button className="primary" onClick={add}><Plus size={16} />添加成员</button></div>}
      {data && member && tab === "home" && <>
        <div className="home-top">
          <Overview member={member} rows={rows} day={day} />
          <section className="card quick"><div className="card-heading"><h2><span className="section-icon blue"><Pencil size={17} /></span>今日记录</h2><span className="caption">{day}</span></div>
            <RecordForm key={member.id + day} id={member.id} initialDay={day} maxDay={day} entry={entry(day)} quick save={save} />
          </section>
        </div>
        <div className="home-bottom">
          <Trend rows={rows} day={day} target={member.target} range={range} setRange={setRange} />
          <Progress member={member} current={latestMorning(rows)?.morning} edit={editGoal} />
        </div>
      </>}
      {member && tab === "trends" && <div className="home-bottom">
        <Trend rows={rows} day={day} target={member.target} range={range} setRange={setRange} />
        <Progress member={member} current={latestMorning(rows)?.morning} edit={editGoal} />
      </div>}
      {member && tab === "calendar" && <Calendar day={day} rows={rows} edit={editDay} />}
      {data && member && tab === "family" && <FamilyTrend data={data} day={day} />}
      {data && tab === "settings" && <div className="settings-grid">
        <section className="card"><div className="card-heading"><h2><span className="section-icon blue"><UsersRound size={19} /></span>成员管理</h2><button className="secondary" onClick={add}><Plus size={17} />添加</button></div>
          <div className="settings-members">{data.members.length === 0 && <p className="caption">还没有成员。</p>}{data.members.map((m, i) =>
            <div key={m.id} className="settings-member"><i className={"avatar avatar-" + i % 4}>{initials(m.name)}</i><strong>{m.name}</strong>
              <button className="icon-button" aria-label={"编辑 " + m.name} onClick={() => setEditor({ type: "member", member: m })}><Pencil size={17} /></button>
              <button disabled={settingsBusy} className="icon-button danger" aria-label={"删除 " + m.name} onClick={() => void remove(m)}><Trash2 size={17} /></button></div>)}</div>
        </section>
        <section className="card"><div className="card-heading"><h2><span className="section-icon mint"><LockKeyhole size={18} /></span>家庭访问</h2></div>
          <p>知道家庭密码的人可以查看和编辑所有成员的记录。</p>
          {demo ? <p className="caption">当前是本地演示，重启服务后恢复示例数据。</p> : <button className="secondary" disabled={settingsBusy} onClick={() => void logout()}><LogOut size={17} />退出家庭空间</button>}
        </section>
      </div>}
    </main>
    <nav className="bottom-nav" aria-label="主导航">{tabs.map(([id, title, Icon]) =>
      <button key={id} onClick={() => navigate(id)} aria-current={tab === id ? "page" : undefined}><Icon size={21} strokeWidth={tab === id ? 2.25 : 1.75} /><span>{title}</span></button>)}</nav>
    {editor?.type === "member" && <Modal title={editor.member ? "修改昵称" : "添加成员"} close={close}><MemberForm member={editor.member} save={save} done={saved} /></Modal>}
    {editor?.type === "goal" && member && <Modal title="设置体重目标" close={close}><GoalForm member={member} save={save} done={saved} /></Modal>}
    {editor?.type === "record" && member && <Modal title="编辑体重记录" close={close}>
      <RecordForm id={member.id} initialDay={editor.day} maxDay={day} entry={entry(editor.day)} readEntry={entry} save={save} done={close} /></Modal>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </>;
}
