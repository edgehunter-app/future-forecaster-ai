import { useNavigate } from "react-router-dom";
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const Football = (p: P) => (
  <svg {...base} {...p}><ellipse cx="16" cy="16" rx="13" ry="8" transform="rotate(-35 16 16)" /><path d="M12.5 19.5l7-7M14 15l3 3M16 13l3 3M12 17l3 3" /></svg>
);
const CollegeFootball = (p: P) => (
  <svg {...base} {...p}><ellipse cx="16" cy="19" rx="11" ry="6.5" transform="rotate(-30 16 19)" /><path d="M13 21.5l6-5" /><path d="M9 4l7-2 7 2-7 2z" fill="currentColor" /><path d="M21 5v4" /></svg>
);
const Basketball = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M4 16h24M16 4v24M7.5 7.5c4 4 4 13 0 17M24.5 7.5c-4 4-4 13 0 17" /></svg>
);
const Baseball = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M9 6.5c3 3 3 16 0 19M23 6.5c-3 3-3 16 0 19" /><path d="M10.5 10h2M10.8 14h2M10.8 18h2M10.5 22h2M19.5 10h2M19.2 14h2M19.2 18h2M19.5 22h2" strokeWidth={1.5} /></svg>
);
const Hockey = (p: P) => (
  <svg {...base} {...p}><path d="M8 3l7 19c.4 1.2 1.5 2 2.8 2H27" /><ellipse cx="9" cy="25" rx="5" ry="2" fill="currentColor" /></svg>
);
const Soccer = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M16 10l5 3.6-1.9 5.9h-6.2L11 13.6z" fill="currentColor" /><path d="M16 10V4.5M21 13.6l5.5-2M19.1 19.5l3.4 4.8M12.9 19.5l-3.4 4.8M11 13.6l-5.5-2" /></svg>
);
const MMA = (p: P) => (
  <svg {...base} {...p}><path d="M8 14V9a4 4 0 014-4h7a5 5 0 015 5v7a7 7 0 01-7 7h-3a6 6 0 01-6-6z" /><path d="M8 14h9a2 2 0 010 4h-4M10 24v4h10v-4" /></svg>
);
const Golf = (p: P) => (
  <svg {...base} {...p}><path d="M12 27V4l11 5-11 5" /><ellipse cx="14" cy="27" rx="9" ry="2" /></svg>
);
const Tennis = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M6.5 8.5c5 3 5 12 0 15M25.5 8.5c-5 3-5 12 0 15" /></svg>
);
/** Galloping horse with jockey, side view. */
const Racing = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 18c1-4 4-6 9-6h5l3-3 3 1-1 3 2 2-2 2-3-1-2 2" />
    <path d="M14 12c-1 4 0 6 3 7M9 16l-5 4M12 18l-2 6M19 19l1 5M22 18l4 3" />
    <circle cx="17" cy="6.5" r="1.6" fill="currentColor" />
    <path d="M16 8.5l-1.5 3.5h3" />
  </svg>
);
/** Yes/No split — green YES half, red NO half. */
const PredictionMarkets = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <rect x="3" y="6" width="13" height="20" rx="4" className="fill-success/25 stroke-success" strokeWidth="2" />
    <rect x="16" y="6" width="13" height="20" rx="4" className="fill-destructive/25 stroke-destructive" strokeWidth="2" />
    <text x="9.5" y="19" textAnchor="middle" fontSize="6.5" fontWeight="800" className="fill-success">YES</text>
    <text x="22.5" y="19" textAnchor="middle" fontSize="6.5" fontWeight="800" className="fill-destructive">NO</text>
  </svg>
);

const MARKETS = [
  { label: "NFL", Icon: Football, to: "/sports?sport=americanfootball_nfl" },
  { label: "College FB", Icon: CollegeFootball, to: "/sports?sport=americanfootball_ncaaf" },
  { label: "NBA", Icon: Basketball, to: "/sports?sport=basketball_nba" },
  { label: "MLB", Icon: Baseball, to: "/sports?sport=baseball_mlb" },
  { label: "NHL", Icon: Hockey, to: "/sports?sport=icehockey_nhl" },
  { label: "EPL", Icon: Soccer, to: "/sports?sport=soccer_epl" },
  { label: "MLS", Icon: Soccer, to: "/sports?sport=soccer_usa_mls" },
  { label: "MMA", Icon: MMA, to: "/sports?sport=mma_mixed_martial_arts" },
  { label: "Golf", Icon: Golf, to: "/sports?sport=golf" },
  { label: "Tennis", Icon: Tennis, to: "/sports?sport=tennis" },
  { label: "Horse Racing", Icon: Racing, to: "/horse-racing" },
  { label: "Prediction Markets", Icon: PredictionMarkets, to: "/markets" },
];

export default function MarketGrid() {
  const navigate = useNavigate();
  return (
    <div>
      <h2 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-foreground/80">Markets</h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {MARKETS.map(({ label, Icon, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            aria-label={`Open ${label}`}
            className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-1 py-3 text-foreground/80 transition-colors hover:border-info/50 hover:bg-info/10 hover:text-info"
          >
            <Icon className="h-8 w-8" />
            <span className="text-center text-[11px] font-semibold leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
