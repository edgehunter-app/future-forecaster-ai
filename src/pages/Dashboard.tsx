export { default } from "./Discover";

function LineAlertsBanner() {
  const { alerts } = useLineMonitor();
  if (alerts.length === 0) return null;
  return (
    <Link
      to="/tracker"
      className="mb-3 flex items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning hover:bg-warning/15"
    >
      <span className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5" />
        {alerts.length} active bet{alerts.length === 1 ? "" : "s"} ha{alerts.length === 1 ? "s" : "ve"} line movement
      </span>
      <span className="inline-flex items-center gap-1 text-warning">
        View in Bet Tracker <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

const TIER_COLORS: Record<string, string> = {
  S: "#f59e0b",
  A: "#10b981",
  B: "#3b82f6",
  C: "#6b7280",
};

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { isAdmin } = useIsAdmin();
  const bankroll = useAppStore((s) => s.settings.bankroll);
  const settings = useAppStore((s) => s.settings);
  const { suggestions, dismissSuggestion, markOutcome, saveSuggestion, reload: reloadSuggestions } = useSuggestionsDB();
  const { wallets, addWallet } = useTrackedWallets();
  const { markets, isLive, error: marketsError, loading: marketsLoading, refresh: refreshMarkets } = useMarkets();
  const { scanning: walletsScanning, scanTopWallets } = useWallets();
  const { stats: histStats } = useHistory();

  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<ClaudeAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showTopMarkets, setShowTopMarkets] = useState(false);
  const [analyzingMarket, setAnalyzingMarket] = useState("");
  const [analyzeProgress, setAnalyzeProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [analyzedMarket, setAnalyzedMarket] = useState<Market | null>(null);
  const [seeding, setSeeding] = useState(false);

  const aiTier = useMemo(() => {
    if (!aiResult) return null;
    if (aiResult.confidence >= 65) return "strong" as const;
    if (aiResult.confidence >= 50) return "moderate" as const;
    return "weak" as const;
  }, [aiResult]);

  const handleAnalyze = async () => {
    const source = markets && markets.length > 0 ? markets : MOCK_MARKETS;
    const topMarkets = [...source].sort((a, b) => b.volume24h - a.volume24h).slice(0, 5);
    setAnalyzing(true);
    setAiError(null);
    setAiResult(null);
    setAnalyzedMarket(null);
    setAnalyzeProgress({ current: 0, total: topMarkets.length });
    let bestResult: ClaudeAnalysis | null = null;
    let bestMarket: Market | null = null;
    try {
      for (let i = 0; i < topMarkets.length; i++) {
        const market = topMarkets[i];
        setAnalyzingMarket(market.question);
        setAnalyzeProgress({ current: i + 1, total: topMarkets.length });
        try {
          const result = await analyzeMarketWithClaude({
            market,
            wallets,
            bankroll: settings.bankroll,
            kellyMultiplier: settings.kellyMultiplier,
            maxPositionPct: settings.maxPosition * 100,
          });
          if (result && (!bestResult || result.confidence > bestResult.confidence)) {
            bestResult = result;
            bestMarket = market;
          }
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          console.warn("Market analysis failed:", err);
          continue;
        }
      }
      if (bestResult) {
        setAiResult(bestResult);
        setAnalyzedMarket(bestMarket);
        if (bestMarket) {
          try {
            await saveSuggestion({
              id: `claude_${bestMarket.id}_${Date.now()}`,
              marketId: bestMarket.id,
              question: bestMarket.question,
              direction: bestResult.direction,
              currentOdds:
                bestResult.direction === "YES" ? bestMarket.yesPrice : bestMarket.noPrice,
              suggestedAmount: bestResult.suggestedAmount,
              confidence: bestResult.confidence,
              edge: bestResult.edge,
              category: bestMarket.category ?? "General",
              reasoning: bestResult.reasoning,
              walletSignals: wallets
                .filter((w) => w.tier === "S" || w.tier === "A")
                .map((w) => w.label)
                .slice(0, 3),
              keySignals: bestResult.keySignals ?? [],
              status: "active",
              createdAt: new Date().toLocaleString(),
              expiresAt: "48h",
            });
            await reloadSuggestions();
          } catch (err) {
            console.warn("Failed to save suggestion:", err);
          }
        }
      } else {
        setAiError("Could not analyze any markets. Try again.");
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
      setAnalyzingMarket("");
    }
  };

  const handleSeedWallets = async () => {
    setSeeding(true);
    try {
      for (const w of KNOWN_TOP_WALLETS) {
        await addWallet(w);
      }
    } finally {
      setSeeding(false);
    }
  };

  // Auto-run analysis once when the user lands with markets but no suggestions yet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (analyzing || aiResult) return;
    if (suggestions.length > 0) return;
    if (markets.length === 0) return;
    if (localStorage.getItem("eh_auto_analyzed") === "true") return;
    localStorage.setItem("eh_auto_analyzed", "true");
    void handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets.length, suggestions.length]);

  const totalPnl = histStats.totalPnL;
  const wins = histStats.wins;
  const losses = histStats.losses;
  const winRate = histStats.winRate * 100;
  const byMonth = histStats.byMonth;
  const maxAbs = byMonth.length ? Math.max(...byMonth.map((m) => Math.abs(m.pnl))) || 1 : 1;
  const hasResolved = histStats.totalTrades > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="order-1 md:order-none"><SafetyBanner /></div>

      {/* Status header */}
      <div className="order-9 md:order-none flex flex-wrap items-center gap-2 justify-end">
        <StatusPill
          label="Markets"
          state={marketsError ? "error" : isLive ? "ok" : markets.length > 0 ? "warn" : "loading"}
          text={marketsError ? "Failed" : isLive ? "Live" : markets.length > 0 ? "Sample" : "Loading"}
        />
        <StatusPill
          label="Wallets"
          state={walletsScanning ? "loading" : wallets.length > 0 ? "ok" : "neutral"}
          text={walletsScanning ? "Scanning..." : wallets.length > 0 ? `${wallets.length} found` : "None"}
        />
        <StatusPill label="Polymarket" state={isLive ? "ok" : "error"} text={isLive ? "Connected" : "Unavailable"} />
        <StatusPill label="Kalshi" state="ok" text="Connected" />
        <button
          onClick={() => { void refreshMarkets(); void scanTopWallets(); }}
          disabled={marketsLoading || walletsScanning}
          title="Refresh markets and wallets"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RotateCw className={cn("h-3.5 w-3.5", (marketsLoading || walletsScanning) && "animate-spin")} />
          Refresh All
        </button>
      </div>

      {/* Edge Analysis */}
      <div className="order-3 md:order-none rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">AI Market Analysis</h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="inline-flex items-center gap-2 rounded-md bg-info px-3.5 py-2 text-xs font-semibold text-white hover:bg-info/90 transition-colors disabled:opacity-50 shadow-glow-blue"
            >
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {analyzing ? "Analyzing..." : "Run Analysis"}
            </button>
            {isAdmin && (
              <span className="text-[10px] text-muted-foreground font-mono">
                ~$0.015 per analysis (5 markets)
              </span>
            )}
            {isAdmin && markets.length === 0 && !marketsLoading && (
              <span className="text-[10px] text-warning">Using sample market data — live data unavailable</span>
            )}
          </div>
        </div>

        {analyzing && (
          <div className="mt-4 space-y-3 animate-pulse">
            {analyzingMarket && (
              <div className="text-xs text-muted-foreground font-mono">
                Analyzing ({analyzeProgress.current} of {analyzeProgress.total}): <span className="text-foreground">{analyzingMarket.slice(0, 80)}{analyzingMarket.length > 80 ? "..." : ""}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-24 rounded-md bg-muted/40" />
              <div className="h-24 rounded-md bg-muted/40" />
            </div>
            <div className="h-12 rounded-md bg-muted/40" />
            <div className="h-2 rounded-full bg-muted/40" />
          </div>
        )}

        {aiError && !analyzing && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {aiError}
          </div>
        )}

        {aiResult && !analyzing && (
          <div className="mt-4 space-y-3">
            {analyzedMarket && (
              <div className="rounded-md border border-info/30 bg-info/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Best signal found in</div>
                <div className="mt-0.5 text-sm font-bold text-foreground">{cleanMarketTitle(analyzedMarket.question)}</div>
                <span className="mt-1 inline-block rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{analyzedMarket.category}</span>
              </div>
            )}
            {aiTier !== "strong" && (
              <div className={cn(
                "rounded-md border px-3 py-2 text-xs font-semibold flex items-center justify-between gap-2",
                aiTier === "weak"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-warning/40 bg-warning/10 text-warning",
              )}>
                <span className="uppercase tracking-wide">
                  {aiTier === "weak" ? "Weak Signal" : "Moderate Signal"}
                </span>
                <span className="font-normal normal-case opacity-90">
                  {aiTier === "weak"
                    ? "Below your confidence threshold — shown for reference only"
                    : "Position sized at 50% of calculated amount"}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-background/60 p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Recommendation</div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold",
                    aiResult.direction === "YES" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
                    {aiResult.direction}
                  </span>
                  <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase capitalize",
                    aiResult.riskLevel === "low" ? "border-success/40 text-success" :
                    aiResult.riskLevel === "medium" ? "border-warning/40 text-warning" :
                    "border-destructive/40 text-destructive")}>
                    {aiResult.riskLevel} risk
                  </span>
                </div>
                <div className="font-mono text-2xl font-bold text-foreground">
                  {aiTier === "weak"
                    ? "--"
                    : fmtUSD(aiTier === "moderate"
                        ? Math.max(1, Math.round(aiResult.suggestedAmount * 0.5))
                        : aiResult.suggestedAmount)}
                </div>
                <div className="font-mono text-xs text-success font-semibold">+{(aiResult.edge * 100).toFixed(1)}% edge</div>
              </div>
              <div className="rounded-md border border-border bg-background/60 p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Reasoning</div>
                <p className="text-sm text-foreground leading-relaxed">{aiResult.reasoning}</p>
              </div>
            </div>

            {aiResult.keySignals && aiResult.keySignals.length > 0 && (
              <div className="rounded-md border border-border bg-background/60 p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Key Signals</div>
                <div className="flex flex-wrap gap-1.5">
                  {aiResult.keySignals.map((s, i) => (
                    <span key={i} className="rounded-full border border-info/40 bg-info/10 px-2.5 py-1 text-xs font-medium text-info">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {aiResult.crossMarketEdge && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-4 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-warning font-semibold">Cross-Market Opportunity</div>
                <p className="text-sm text-warning/90">{aiResult.crossMarketEdge}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence</span>
              <div className="flex-1 max-w-xs"><ConfidenceBar value={aiResult.confidence} /></div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>AI suggestion only. No auto-execution. Verify independently before trading.</span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div className="order-4 md:order-none grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Suggestions" value={suggestions.length} icon={Lightbulb} color="#8b5cf6" sub="Ready to review" />
        <StatCard label="Tracked Wallets" value={wallets.length} icon={WalletIcon} color="#3b82f6" sub="Smart money" />
        <StatCard label="Monitored Markets" value={markets.length} icon={BarChart2} color="#06b6d4" sub="Live polling" />
        <StatCard
          label="Total P&L"
          value={hasResolved ? fmtUSD(totalPnl, { compact: true }) : "--"}
          icon={TrendingUp}
          color={totalPnl >= 0 ? "#10b981" : "#ef4444"}
          trend={totalPnl >= 0 ? "up" : "down"}
          sub={hasResolved ? `${(totalPnl / bankroll * 100).toFixed(1)}% of bankroll` : "No resolved trades yet"}
        />
      </div>

      {/* Top markets preview */}
      {markets.length > 0 && (
        <div className="order-8 md:order-none rounded-lg border border-border bg-card shadow-card">
          <button
            onClick={() => setShowTopMarkets((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-info" />
              <span className="text-sm font-semibold uppercase tracking-wide text-foreground">Top Markets</span>
              <span className="text-[11px] font-mono text-muted-foreground">({markets.length} loaded)</span>
            </div>
            {showTopMarkets ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showTopMarkets && (
            <ul className="divide-y divide-border border-t border-border">
              {markets.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{cleanMarketTitle(m.question)}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{m.category}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-success font-semibold">YES {(m.yesPrice * 100).toFixed(0)}%</span>
                    <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive font-semibold">NO {(m.noPrice * 100).toFixed(0)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Two-column row */}
      <div className="order-2 md:order-none grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column 60% */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Top Suggestions</h2>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold font-mono">
            <span style={{ color: "#10b981" }}>{suggestions.filter((s) => s.confidence >= 65).length} strong</span>
            <span className="text-muted-foreground">·</span>
            <span style={{ color: "#f59e0b" }}>{suggestions.filter((s) => s.confidence >= 50 && s.confidence < 65).length} moderate</span>
            <span className="text-muted-foreground">·</span>
            <span style={{ color: "#ef4444" }}>{suggestions.filter((s) => s.confidence < 50).length} weak</span>
          </div>
          <div className="space-y-4">
            {suggestions.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="No suggestions yet"
                subtitle="Click Run Analysis above to generate your first AI-powered suggestions"
              />
            ) : (
              suggestions.slice(0, 2).map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  bankroll={bankroll}
                  onDismiss={() => dismissSuggestion(s.id)}
                  onMarkOutcome={(o) => markOutcome(s.id, o)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right column 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance card */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <LineChart className="h-4 w-4 text-success" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Performance</h2>
            </div>
            {hasResolved ? (
              <>
                <div className={cn("font-mono text-3xl font-bold", totalPnl >= 0 ? "text-success" : "text-destructive")}>
                  {fmtUSD(totalPnl)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="text-success font-medium">{wins} wins</span> · <span className="text-destructive font-medium">{losses} losses</span>
                  {histStats.activeTrades > 0 && (
                    <> · <span className="inline-flex items-center gap-1 text-info font-medium"><span className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" />{histStats.activeTrades} active</span></>
                  )}
                </div>
                <div className="mt-5">
                  <svg viewBox="0 0 240 80" className="w-full h-20" preserveAspectRatio="none">
                    {byMonth.length > 0 ? byMonth.map((h, i) => {
                      const colW = 240 / Math.max(1, byMonth.length);
                      const barW = colW * 0.55;
                      const x = i * colW + (colW - barW) / 2;
                      const maxBarH = 36;
                      const barH = (Math.abs(h.pnl) / maxAbs) * maxBarH;
                      const midY = 40;
                      const y = h.pnl >= 0 ? midY - barH : midY;
                      return (
                        <g key={h.month}>
                          <rect x={x} y={y} width={barW} height={barH} rx={2}
                            fill={h.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                          <text x={x + barW / 2} y={76} textAnchor="middle" fontSize="8"
                            fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{h.month}</text>
                        </g>
                      );
                    }) : null}
                    <line x1="0" y1="40" x2="240" y2="40" stroke="hsl(var(--border))" strokeDasharray="2 2" />
                  </svg>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
                  <MiniStat label="Win Rate" value={`${winRate.toFixed(1)}%`} color="hsl(var(--success))" />
                  <MiniStat label="Avg Edge" value={`${(histStats.avgEdge * 100).toFixed(1)}%`} color="hsl(var(--success))" />
                  <MiniStat label="Sharpe" value={histStats.sharpe.toFixed(2)} color="hsl(var(--info))" />
                </div>
              </>
            ) : (
              <>
                <div className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center">
                  <div className="text-sm font-semibold text-foreground">No resolved trades yet</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mark suggestions as won or lost in History to track your performance.
                  </p>
                  <Link to="/history" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80">
                    Go to History <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="mt-4">
                  <svg viewBox="0 0 240 80" className="w-full h-20" preserveAspectRatio="none">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const colW = 240 / 6;
                      const barW = colW * 0.55;
                      const x = i * colW + (colW - barW) / 2;
                      const barH = 7.2; // 20% of 36
                      return <rect key={i} x={x} y={40 - barH} width={barW} height={barH} rx={2} fill="hsl(var(--border))" />;
                    })}
                  </svg>
                  <div className="mt-1 text-center text-[10px] font-mono text-muted-foreground">No data yet</div>
                </div>
                {histStats.activeTrades > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-info">
                    <span className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" />
                    {histStats.activeTrades} active position{histStats.activeTrades === 1 ? "" : "s"}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Top wallets */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4 text-warning" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Top Wallets</h2>
            </div>
            {wallets.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center">
                <WalletIcon className="mx-auto h-6 w-6 text-muted-foreground" />
                <div className="mt-2 text-sm font-semibold text-foreground">No wallets tracked yet</div>
                <p className="mt-1 text-xs text-muted-foreground">Seed with known top traders to get started</p>
                <div className="mt-3 flex flex-col items-center gap-2">
                  <button
                    onClick={handleSeedWallets}
                    disabled={seeding}
                    className="inline-flex items-center gap-1.5 rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 disabled:opacity-50"
                  >
                    {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                    Add Known Top Traders
                  </button>
                  <Link to="/wallets" className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80">
                    Go to Wallets <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
            <ul className="space-y-2">
              {wallets.slice(0, 3).map((w) => {
                const c = TIER_COLORS[w.tier];
                return (
                  <li key={w.address} className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 p-2.5">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold"
                      style={{ backgroundColor: `${c}26`, color: c, border: `1px solid ${c}40` }}
                    >
                      {w.tier}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{w.label}</div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">{w.address}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Win</div>
                      <div className="font-mono text-sm font-semibold text-success">{(w.winRate * 100).toFixed(0)}%</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
        </div>
      </div>

      {/* Cross-market opportunities */}
      <div className="order-5 md:order-none"><CrossMarketStrip /></div>
      <div className="order-6 md:order-none"><SportsEdgeStrip /></div>
    </div>
  );
}

function SportsEdgeStrip() {
  const mispricings = useAppStore((s) => s.sportsMispricings);
  const sportsLastScanned = useAppStore((s) => s.sportsLastScanned);
  const lastBestBet = useAppStore((s) => s.lastBestBet);
  const setPendingBestBetScan = useAppStore((s) => s.setPendingBestBetScan);
  const navigate = useNavigate();
  const lastScanned = sportsLastScanned ? new Date(sportsLastScanned) : null;

  const bestBetIsRecent = lastBestBet
    ? Date.now() - new Date(lastBestBet.generatedAt).getTime() < 4 * 60 * 60 * 1000
    : false;

  const handleRunAnalysis = () => {
    setPendingBestBetScan(true);
    navigate("/sports");
  };

  const isSportsBet = !!(lastBestBet && (!lastBestBet.source || lastBestBet.source === "sports") && lastBestBet.game && lastBestBet.analysis);
  const gameStartMs = isSportsBet ? new Date(lastBestBet!.game!.commenceTime).getTime() : 0;
  const msUntilGame = gameStartMs - Date.now();
  const gameStarted = isSportsBet ? msUntilGame <= 0 : false;
  const countdownText = (() => {
    if (!isSportsBet) return "";
    if (gameStarted) return "Game in progress";
    const mins = Math.floor(msUntilGame / 60000);
    if (mins < 60) return `Starts in ${mins}m`;
    return `Starts in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  })();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-warning" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Sports Edge</h2>
        <Link to="/sports" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <LineAlertsBanner />
      {mispricings.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
          {mispricings.slice(0, 6).map((m) => {
            const color = getConfidenceColor(m.confidence);
            const tier = getConfidenceTier(m.confidence);
            return (
              <Link to="/sports" key={m.id}
                className="min-w-[260px] max-w-[300px] flex-1 rounded-lg border bg-card p-3 hover:border-foreground/20 transition-colors"
                style={{ borderLeft: `3px solid ${color}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-info/40 bg-info/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-info">{m.league}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
                    {(m.spread * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 text-xs font-semibold text-foreground line-clamp-2">{m.game.homeTeam} vs {m.game.awayTeam}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] uppercase font-semibold" style={{ color }}>{tier}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : bestBetIsRecent && lastBestBet && isSportsBet ? (
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-warning" />
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Today's Best Bet</span>
          </div>
          <div className="text-sm font-semibold text-foreground">
            {lastBestBet.analysis!.recommendedTeam || lastBestBet.game!.awayTeam} at {lastBestBet.analysis!.bestBook || "best book"} {lastBestBet.analysis!.odds > 0 ? `+${lastBestBet.analysis!.odds}` : lastBestBet.analysis!.odds}
            {!gameStarted && (
              <span className="ml-1 text-xs font-mono text-muted-foreground">· {countdownText}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span className="text-success font-semibold">Edge: +{(lastBestBet.analysis!.edge * 100).toFixed(1)}%</span>
            <span>·</span>
            <span>Confidence: {Math.round(lastBestBet.analysis!.confidence)}%</span>
          </div>
          {gameStarted ? (
            <div className="mt-2 space-y-2">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
                Game in progress — do not bet
              </div>
              <button
                onClick={handleRunAnalysis}
                className="inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80"
              >
                Find New Best Bet <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <Link
              to="/sports"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80"
            >
              View Full Analysis <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      ) : bestBetIsRecent && lastBestBet && lastBestBet.source === "prediction_market" && lastBestBet.prediction ? (
        <Link to="/sports" className="block rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-info" />
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Today's Best Bet</span>
            <span className="rounded-full border border-info/40 bg-info/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-info">Cross-Market Gap</span>
          </div>
          <div className="text-sm font-semibold text-foreground line-clamp-2">{cleanMarketTitle(lastBestBet.prediction.market.question)}</div>
          <div className="mt-1 flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span>{lastBestBet.prediction.bestPlatform} {lastBestBet.prediction.bestPriceCents}¢</span>
            <span>·</span>
            <span className="text-success font-semibold">Gap: {lastBestBet.prediction.gapCents}¢</span>
          </div>
        </Link>
      ) : bestBetIsRecent && lastBestBet && lastBestBet.source === "wallet_signal" && lastBestBet.wallet ? (
        <Link to="/sports" className="block rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-purple" />
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Today's Best Bet</span>
            <span className="rounded-full border border-purple/40 bg-purple/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple">Smart Wallet Signal</span>
          </div>
          <div className="text-sm font-semibold text-foreground line-clamp-2">{cleanMarketTitle(lastBestBet.wallet.market.question)}</div>
          <div className="mt-1 flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span>{lastBestBet.wallet.walletCount} elite wallets · ${Math.round(lastBestBet.wallet.totalValue).toLocaleString()}</span>
          </div>
        </Link>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-5 text-center">
          <Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm font-semibold text-foreground">Find Today's Best Bet</div>
          <p className="mt-1 text-xs text-muted-foreground">AI scans all games for line shopping value</p>
          <button
            onClick={handleRunAnalysis}
            className={cn(
              "mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition-opacity hover:opacity-90",
              "bg-gradient-to-r from-purple to-purple/70",
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            Run Analysis
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {lastScanned && <div className="mt-2 text-[11px] font-mono text-muted-foreground">Last scanned: {lastScanned.toLocaleTimeString()}</div>}
        </div>
      )}
      <GamblingDisclaimer variant="compact" className="mt-3" />
    </div>
  );
}

function CrossMarketStrip() {
  const { opportunities, loading } = useCrossMarket();
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-warning" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Cross-Market Opportunities</h2>
        <Link to="/cross-market" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-info hover:text-info/80">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {loading && opportunities.length === 0 ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 min-w-[280px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          No opportunities detected
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
          {opportunities.map((o) => {
            const spreadPct = o.spread * 100;
            const hi = spreadPct >= 10;
            return (
              <Link to="/cross-market" key={o.question}
                className="min-w-[280px] max-w-[320px] flex-1 rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
                <div className="text-xs font-semibold text-foreground line-clamp-2 min-h-[32px]">{cleanMarketTitle(o.question)}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                    hi ? "border-success/40 bg-success/15 text-success" : "border-warning/40 bg-warning/15 text-warning",
                  )}>{spreadPct.toFixed(1)}%</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Poly {(o.polyYes * 100).toFixed(0)}% · Kalshi {(o.kalshiYes * 100).toFixed(0)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function StatusPill({
  label, state, text,
}: { label: string; state: "ok" | "warn" | "error" | "loading" | "neutral"; text: string }) {
  const styles: Record<string, string> = {
    ok: "border-success/40 bg-success/10 text-success",
    warn: "border-warning/40 bg-warning/10 text-warning",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    loading: "border-info/40 bg-info/10 text-info",
    neutral: "border-border bg-card text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", styles[state])}>
      <span className="opacity-70">{label}:</span>
      <span>{text}</span>
    </span>
  );
}
