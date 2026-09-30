import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const FootballIcon = (p: P) => (
  <svg {...base} {...p}><ellipse cx="16" cy="16" rx="13" ry="8" transform="rotate(-35 16 16)" /><path d="M12.5 19.5l7-7M14 15l3 3M16 13l3 3M12 17l3 3" /></svg>
);
export const CollegeFootballIcon = (p: P) => (
  <svg {...base} {...p}><ellipse cx="16" cy="19" rx="11" ry="6.5" transform="rotate(-30 16 19)" /><path d="M13 21.5l6-5" /><path d="M9 4l7-2 7 2-7 2z" fill="currentColor" /><path d="M21 5v4" /></svg>
);
export const BasketballIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M4 16h24M16 4v24M7.5 7.5c4 4 4 13 0 17M24.5 7.5c-4 4-4 13 0 17" /></svg>
);
export const BaseballIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M9 6.5c3 3 3 16 0 19M23 6.5c-3 3-3 16 0 19" /><path d="M10.5 10h2M10.8 14h2M10.8 18h2M10.5 22h2M19.5 10h2M19.2 14h2M19.2 18h2M19.5 22h2" strokeWidth={1.5} /></svg>
);
export const HockeyIcon = (p: P) => (
  <svg {...base} {...p}><path d="M8 3l7 19c.4 1.2 1.5 2 2.8 2H27" /><ellipse cx="9" cy="25" rx="5" ry="2" fill="currentColor" /></svg>
);
export const SoccerIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M16 10l5 3.6-1.9 5.9h-6.2L11 13.6z" fill="currentColor" /><path d="M16 10V4.5M21 13.6l5.5-2M19.1 19.5l3.4 4.8M12.9 19.5l-3.4 4.8M11 13.6l-5.5-2" /></svg>
);
export const MmaIcon = (p: P) => (
  <svg {...base} {...p}><path d="M8 14V9a4 4 0 014-4h7a5 5 0 015 5v7a7 7 0 01-7 7h-3a6 6 0 01-6-6z" /><path d="M8 14h9a2 2 0 010 4h-4M10 24v4h10v-4" /></svg>
);
export const GolfIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 27V4l11 5-11 5" /><ellipse cx="14" cy="27" rx="9" ry="2" /></svg>
);
export const TennisIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="16" cy="16" r="12" /><path d="M6.5 8.5c5 3 5 12 0 15M25.5 8.5c-5 3-5 12 0 15" /></svg>
);
/** Galloping horse with jockey, side view (filled silhouette). */
export const RacingIcon = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
    <path d="M6 15.5c1.5-2.5 4.5-3.5 8-3.5h6.5l3-3.2 1.2-2.3.8 2.4 2.5 2.1-.8 1.8-2.4-.4-2.3 2.6.3 3-1.8 1.2-3.6-.8-3.6.6-2.8 1.2C8 21 6.3 19.3 6 15.5z" />
    <path d="M9.6 19.4L4 23.5l-.9-1.3 4.6-4zM12 20.2l-2.4 6.1-1.5-.5 2-6.2zM19.6 20.6l1.3 5.8-1.5.3-1.6-5.6zM22 19.2l5 2.8-.7 1.4-5.2-2.4z" />
    <circle cx="16.5" cy="6.2" r="1.9" />
    <path d="M15 8.4h3l1 3.8h-5z" />
  </svg>
);
/** Yes/No split — green YES half, red NO half. */
export const PredictionMarketsIcon = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <path d="M6 5h10v22H6a4 4 0 01-4-4V9a4 4 0 014-4z" className="fill-success" />
    <path d="M16 5h10a4 4 0 014 4v14a4 4 0 01-4 4H16z" className="fill-destructive" />
    <text x="9" y="18.6" textAnchor="middle" fontSize="7.5" fontWeight="900" className="fill-background">Y</text>
    <text x="23" y="18.6" textAnchor="middle" fontSize="7.5" fontWeight="900" className="fill-background">N</text>
  </svg>
);
