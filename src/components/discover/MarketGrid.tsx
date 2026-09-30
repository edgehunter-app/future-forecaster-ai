import { useNavigate } from "react-router-dom";
import {
  FootballIcon,
  CollegeFootballIcon,
  BasketballIcon,
  BaseballIcon,
  HockeyIcon,
  SoccerIcon,
  MmaIcon,
  GolfIcon,
  TennisIcon,
  RacingIcon,
  PredictionMarketsIcon,
} from "@/components/icons/marketIcons";

const MARKETS = [
  { label: "NFL", Icon: FootballIcon, to: "/sports?sport=americanfootball_nfl" },
  { label: "College FB", Icon: CollegeFootballIcon, to: "/sports?sport=americanfootball_ncaaf" },
  { label: "NBA", Icon: BasketballIcon, to: "/sports?sport=basketball_nba" },
  { label: "MLB", Icon: BaseballIcon, to: "/sports?sport=baseball_mlb" },
  { label: "NHL", Icon: HockeyIcon, to: "/sports?sport=icehockey_nhl" },
  { label: "EPL", Icon: SoccerIcon, to: "/sports?sport=soccer_epl" },
  { label: "MLS", Icon: SoccerIcon, to: "/sports?sport=soccer_usa_mls" },
  { label: "MMA", Icon: MmaIcon, to: "/sports?sport=mma_mixed_martial_arts" },
  { label: "Golf", Icon: GolfIcon, to: "/sports?sport=golf" },
  { label: "Tennis", Icon: TennisIcon, to: "/sports?sport=tennis" },
  { label: "Horse Racing", Icon: RacingIcon, to: "/horse-racing" },
  { label: "Prediction Markets", Icon: PredictionMarketsIcon, to: "/markets" },
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
