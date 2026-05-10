const MARKET_KEY = "eh_admin_market_analyses";
const SPORTS_KEY = "eh_admin_sports_analyses";

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

export function bumpMarketAnalyses() {
  write(MARKET_KEY, read(MARKET_KEY) + 1);
}
export function bumpSportsAnalyses() {
  write(SPORTS_KEY, read(SPORTS_KEY) + 1);
}
export function getAnalysisCounts() {
  const market = read(MARKET_KEY);
  const sports = read(SPORTS_KEY);
  return { market, sports, total: market + sports };
}