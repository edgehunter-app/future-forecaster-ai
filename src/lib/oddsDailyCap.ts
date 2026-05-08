// Hard daily cap on Odds API requests, tracked client-side in localStorage.
export const DAILY_CAP = 10;
const STORE_KEY = "eh_daily_odds";

interface DailyRecord { date: string; count: number }

function todayStr(): string {
  return new Date().toDateString();
}

export function getDailyCount(): number {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw) as DailyRecord;
    return date === todayStr() ? count : 0;
  } catch {
    return 0;
  }
}

export function incrementDaily(): number {
  const count = getDailyCount() + 1;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ date: todayStr(), count }));
  } catch { /* noop */ }
  return count;
}

export function isDailyCapReached(): boolean {
  return getDailyCount() >= DAILY_CAP;
}
