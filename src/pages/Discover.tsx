import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeroBestEdgeCard from "@/components/discover/HeroBestEdgeCard";
import BestEdgeAnalysisSheet from "@/components/discover/BestEdgeAnalysisSheet";
import TodaySignalsList from "@/components/discover/TodaySignalsList";
import AIInsightStrip from "@/components/discover/AIInsightStrip";
import GamblingDisclaimer from "@/components/sports/GamblingDisclaimer";
import { useBestBet } from "@/hooks/useBestBet";
import { useSportsOdds } from "@/hooks/useSportsOdds";
import { useSuggestionsDB } from "@/hooks/useSuggestionsDB";
import { useAppStore } from "@/store/useAppStore";
import { usePageTitle } from "@/hooks/usePageTitle";
import { RefreshCw } from "lucide-react";

export default function Discover() {
  usePageTitle("Discover");
  const navigate = useNavigate();
  const { suggestions } = useSuggestionsDB(["active"]);
  // Ensure games are loaded so the best-edge scan has data
  useSportsOdds([]);
  const { result, loading, findBestBet, availability, scannedSoFar } = useBestBet();
  const fullGames = useAppStore((s) => s.fullGames);
  const lastBestBet = useAppStore((s) => s.lastBestBet);
  const [sheetOpen, setSheetOpen] = useState(false);

  const displayed = result ?? lastBestBet ?? null;

  // Auto-run once games are loaded and we have no prior result.
  useEffect(() => {
    if (!displayed && !loading && (fullGames?.length ?? 0) > 0) {
      findBestBet();
    }
  }, [displayed, loading, fullGames, findBestBet]);

  const insight =
    displayed
      ? `Your best edge right now is on ${
          displayed.game?.awayTeam
            ? `${displayed.game.awayTeam} @ ${displayed.game.homeTeam}`
            : displayed.prediction?.market.question ?? "a prediction market"
        }. Confidence ${
          displayed.analysis?.confidence ??
          displayed.prediction?.confidence ??
          displayed.wallet?.confidence ??
          0
        }%.`
      : availability === "none"
        ? "No games in the next 24 hours. Signals and prediction markets are still worth a look."
        : "Scanning for edges across sportsbooks, prediction markets, and sharp wallets…";

  const emptyMessage =
    availability === "none"
      ? "No qualifying games in the next 24 hours."
      : availability === "within_24h"
        ? "No edge inside 12h — earliest opportunities are 12–24h out."
        : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Discover</h1>
          <p className="text-[12px] text-muted-foreground">Your best edge, ranked in real time.</p>
        </div>
        <button
          onClick={() => findBestBet()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-card px-3 py-2 text-[12px] font-semibold text-foreground/80 hover:bg-white/5 disabled:opacity-50"
          aria-label="Rescan for best edge"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Rescan
        </button>
      </div>

      {/* Hero */}
      <HeroBestEdgeCard
        result={displayed}
        loading={loading}
        scannedLines={scannedSoFar}
        onOpen={() => displayed && setSheetOpen(true)}
        onHunt={() => findBestBet()}
        emptyMessage={emptyMessage}
      />

      {/* AI insight strip */}
      <AIInsightStrip message={insight} />

      {/* Today's Signals */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-foreground/80">
            Today's Signals
          </h2>
          <button
            onClick={() => navigate("/suggestions")}
            className="text-[12px] font-semibold text-info hover:underline"
          >
            View all
          </button>
        </div>
        <TodaySignalsList suggestions={suggestions} />
      </div>

      <GamblingDisclaimer />

      <BestEdgeAnalysisSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        result={displayed}
      />
    </div>
  );
}