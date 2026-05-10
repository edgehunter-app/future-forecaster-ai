const KEYS: Record<string, string> = {
  market: "eh_admin_market_analyses",
  kalshi: "eh_admin_kalshi_analyses",
  sports: "eh_admin_sports_analyses",
  prop: "eh_admin_prop_analyses",
  "cross-market": "eh_admin_xmarket_analyses",
  "daily-briefing": "eh_admin_briefing_analyses",
  sentiment: "eh_admin_sentiment_analyses",
  "wallet-strategy": "eh_admin_wallet_analyses",
};

function read(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? "0") || 0;
  } catch {
    return 0;
  }
}
function write(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* ignore */
  }
}

export function bumpAnalysis(type: string) {
  const k = KEYS[type] ?? KEYS.market;
  write(k, read(k) + 1);
}
export function bumpMarketAnalyses() { bumpAnalysis("market"); }
export function bumpSportsAnalyses() { bumpAnalysis("sports"); }

export function getAnalysisCounts() {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const [t, k] of Object.entries(KEYS)) {
    const n = read(k);
    counts[t] = n;
    total += n;
  }
  return { ...counts, market: counts.market, sports: counts.sports, total } as Record<string, number> & { market: number; sports: number; total: number };
}