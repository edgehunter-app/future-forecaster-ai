import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBox from "@/components/search/SearchBox";
import InlineBetResult from "@/components/search/InlineBetResult";
import StickyActionBar from "@/components/ui/StickyActionBar";
import { useAppStore } from "@/store/useAppStore";
import { useGameAnalysis } from "@/hooks/useGameAnalysis";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { FullGame } from "@/lib/oddsApi";
import { ChevronRight, Bookmark } from "lucide-react";

function verdictFor(a: { edge: number; confidence: number } | null): "good" | "caution" | "pass" | null {
  if (!a) return null;
  const edgePct = a.edge * 100;
  if (a.confidence >= 65 && edgePct >= 3) return "good";
  if (a.confidence >= 50) return "caution";
  return "pass";
}

export default function CheckBet() {
  usePageTitle("Check a Bet");
  const navigate = useNavigate();
  const fullGames = useAppStore((s) => s.fullGames) ?? [];
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FullGame | null>(null);
  const { analyzeGame, isAnalyzing, getResult, getError } = useGameAnalysis();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return fullGames
      .filter(
        (g) =>
          g.homeTeam.toLowerCase().includes(q) ||
          g.awayTeam.toLowerCase().includes(q) ||
          g.league?.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, fullGames]);

  const analysis = selected ? getResult(selected.id) : null;
  const analyzing = selected ? isAnalyzing(selected.id) : false;
  const err = selected ? getError(selected.id) : "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-24">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Check a Bet</h1>
        <p className="text-[12px] text-muted-foreground">
          Search any matchup and get an instant Claude read.
        </p>
      </div>

      <SearchBox value={query} onChange={(v) => { setQuery(v); setSelected(null); }} autoFocus />

      {/* If a bet is selected, show inline result */}
      {selected ? (
        <InlineBetResult
          game={selected}
          analysis={analysis}
          analyzing={analyzing}
          error={err}
          onAnalyze={() => analyzeGame(selected)}
        />
      ) : query.trim() ? (
        results.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center space-y-3">
            <div className="text-[40px] opacity-30 leading-none">🔍</div>
            <div className="text-[15px] font-bold text-foreground">No match found</div>
            <div className="text-[12px] text-muted-foreground">Try the team name, sport, or market type</div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {["Lakers", "MLB", "moneyline"].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setQuery(chip)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-foreground/80 hover:border-info/40 hover:text-info transition active:scale-[0.97] duration-100"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {results.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => setSelected(g)}
                  className="w-full flex items-center gap-3 rounded-2xl border border-white/5 bg-card px-4 py-3 text-left hover:border-info/30 transition active:scale-[0.97] duration-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">
                      {g.awayTeam} @ {g.homeTeam}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {g.league} · {new Date(g.commenceTime).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="rounded-2xl border border-white/5 bg-card p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            Type a team, matchup, or league to check its edge.
          </p>
        </div>
      )}

      {/* Sticky action bar reflects verdict */}
      {analysis && (() => {
        const v = verdictFor(analysis);
        if (v === "pass") {
          return (
            <StickyActionBar tone="muted">
              <div className="text-[12px] font-semibold w-full text-center">
                Better line not found · Try another book
              </div>
            </StickyActionBar>
          );
        }
        return (
          <StickyActionBar tone={v === "good" ? "green" : "blue"}>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {v === "good" ? "Good line" : "Caution"}
              </div>
              <div className="text-[14px] font-extrabold truncate">
                {analysis.recommendedTeam} · {(analysis.edge * 100).toFixed(1)}% edge
              </div>
            </div>
            <button
              onClick={() => navigate("/tracker")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur px-3 py-2 text-[12px] font-bold hover:bg-white/25 shrink-0 active:scale-[0.97] transition-transform duration-100"
            >
              <Bookmark className="h-3.5 w-3.5" /> Track
            </button>
          </StickyActionBar>
        );
      })()}
    </div>
  );
}