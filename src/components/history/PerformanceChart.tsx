import { useEffect, useRef, useState } from "react";
import type { HistoryPoint } from "@/types";

interface Props { data: HistoryPoint[]; height?: number; }

export function PerformanceChart({ data, height = 200 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    p.style.transition = "none";
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      p.style.transition = "stroke-dashoffset 1.2s ease-out";
      p.style.strokeDashoffset = "0";
    });
  }, [data, w]);

  const padL = 48, padR = 16, padT = 16, padB = 28;
  const innerW = Math.max(50, w - padL - padR);
  const innerH = height - padT - padB;
  const values = data.map((d) => d.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const x = (i: number) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const y = (v: number) => padT + (1 - (v - min) / range) * innerH;
  const zeroY = y(0);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.cumulative)}`).join(" ");
  const area = `${line} L ${x(data.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z`;

  // 4 gridlines
  const ticks = 4;
  const gridVals = Array.from({ length: ticks }, (_, i) => min + (range * i) / (ticks - 1));

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="perf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)}
              stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="10"
              fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
              ${Math.round(v)}
            </text>
          </g>
        ))}

        <line x1={padL} x2={w - padR} y1={zeroY} y2={zeroY}
          stroke="hsl(var(--muted-foreground))" strokeDasharray="2 3" opacity="0.6" />

        <path d={area} fill="url(#perf-grad)" />
        <path ref={pathRef} d={line} fill="none" stroke="#10b981" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.cumulative)} r="3.5" fill="#10b981"
              stroke="hsl(var(--card))" strokeWidth="2" />
            <rect x={x(i) - 12} y={padT} width="24" height={innerH} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="10"
              fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{d.date}</text>
          </g>
        ))}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH}
              stroke="hsl(var(--foreground))" strokeOpacity="0.3" />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-card"
          style={{ left: x(hover) + 10, top: y(data[hover].cumulative) - 8 }}
        >
          <div className="text-muted-foreground font-mono">{data[hover].date}</div>
          <div className="font-mono font-semibold text-success">${data[hover].cumulative}</div>
        </div>
      )}
    </div>
  );
}

export default PerformanceChart;
