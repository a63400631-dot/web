"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
import { fixed, type Range } from "../lib/model";

export const blue = "#3479ed";
export const orange = "#ec9450";
export const palette = [blue, "#22a489", "#9a63d9", "#e57289", "#d08832", "#328b9f"];

type Point = { day: string; time: number; [key: string]: string | number | null };
export type Series = { key: string; label: string; color: string };

export function rangeName(range: Range) {
  return range === 0 ? "全部" : range + " 天";
}

export function Ranges({ range, select }: { range: Range; select: (range: Range) => void }) {
  return <div className="segmented" aria-label="日期范围">
    {([7, 30, 90, 0] as const).map(value => <button type="button" key={value} aria-pressed={range === value} onClick={() => select(value)}>{rangeName(value)}</button>)}
  </div>;
}

export function point(day: string): Point {
  return { day, time: Date.parse(day + "T00:00:00Z") };
}

export function Chart({ points, series, target, relative }: {
  points: Point[]; series: Series[]; target?: number | null; relative?: boolean;
}) {
  const values = points.flatMap(row => series.flatMap(({ key }) => typeof row[key] === "number" ? [row[key]] : []));
  if (!values.length) return <div className="chart-empty"><ChartNoAxesCombined size={28} /><span>这个范围内还没有体重记录</span></div>;
  if (target != null) values.push(target);
  const low = values.reduce((min, value) => Math.min(min, value));
  const high = values.reduce((max, value) => Math.max(max, value));
  const pad = Math.max((high - low) * 0.12, 0.3);
  const first = points[0].time;
  const last = points[points.length - 1].time;
  const tick = (n: number) => new Date(n).toISOString().slice(5, 10).replace("-", "/").replace(/^0/, "").replace("/0", "/");
  return <>
    <div className="chart-canvas">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <LineChart data={points} margin={{ top: 10, right: 13, left: 0, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#e9eef5" vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="time" type="number" scale="time" domain={first === last ? [first - 86400000, last + 86400000] : [first, last]} tickFormatter={tick}
            tickCount={5} minTickGap={15} tickLine={false} axisLine={false} tickMargin={12} tick={{ fontSize: 11, fill: "#60738b" }} />
          <YAxis width={31} domain={[low - pad, high + pad]} tickCount={5} tickFormatter={n => Number(n.toFixed(1)).toString()}
            tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#60738b" }} />
          <Tooltip trigger="click" labelFormatter={t => new Date(Number(t)).toISOString().slice(0, 10)}
            formatter={value => [fixed(Number(value)) + " kg"]}
            contentStyle={{ borderRadius: 13, border: "1px solid #e3ebf5", fontSize: 13 }} />
          {target != null && <ReferenceLine y={target} stroke="#279d80" strokeDasharray="6 5" strokeWidth={1.5} />}
          {series.map(({ key, label, color }) => <Line key={key} name={label} dataKey={key} type="linear" connectNulls
            stroke={color} strokeWidth={2.5} dot={points.length <= 35 ? { r: 2.75, fill: color, stroke: "#fff", strokeWidth: 1 } : false}
            activeDot={{ r: 5 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      {target != null && <span><i className="dashed" />目标 {fixed(target)} kg</span>}
      {relative && <span>单位 kg</span>}
    </div>
  </>;
}
