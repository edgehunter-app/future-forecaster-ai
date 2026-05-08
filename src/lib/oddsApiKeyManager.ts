const KEY_USAGE_STORE = "eh_odds_key_usage";
const MONTHLY_LIMIT = 500;

export interface KeyUsage {
  requestsUsed: number;
  requestsRemaining: number;
  lastUsed: number;
  exhausted: boolean;
  resetDate: string; // ISO date
}

export interface KeyManager {
  primary: KeyUsage;
  secondary: KeyUsage;
  activeKey: "primary" | "secondary";
}

function nextResetDate(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

function defaultUsage(): KeyManager {
  return {
    primary: {
      // Primary is known-exhausted at the time this manager was introduced.
      requestsUsed: 498,
      requestsRemaining: 2,
      lastUsed: Date.now(),
      exhausted: true,
      resetDate: nextResetDate(),
    },
    secondary: {
      requestsUsed: 0,
      requestsRemaining: MONTHLY_LIMIT,
      lastUsed: 0,
      exhausted: false,
      resetDate: nextResetDate(),
    },
    activeKey: "secondary",
  };
}

export function loadKeyUsage(): KeyManager {
  try {
    const raw = localStorage.getItem(KEY_USAGE_STORE);
    if (raw) {
      const parsed = JSON.parse(raw) as KeyManager;
      // Reset if past reset date
      const now = new Date();
      const resetD = new Date(parsed.primary?.resetDate ?? nextResetDate());
      if (now.getTime() >= resetD.getTime()) {
        const fresh: KeyManager = {
          primary: { requestsUsed: 0, requestsRemaining: MONTHLY_LIMIT, lastUsed: 0, exhausted: false, resetDate: nextResetDate() },
          secondary: { requestsUsed: 0, requestsRemaining: MONTHLY_LIMIT, lastUsed: 0, exhausted: false, resetDate: nextResetDate() },
          activeKey: "primary",
        };
        saveKeyUsage(fresh);
        return fresh;
      }
      return parsed;
    }
  } catch {}
  const init = defaultUsage();
  saveKeyUsage(init);
  return init;
}

export function saveKeyUsage(usage: KeyManager): void {
  try {
    localStorage.setItem(KEY_USAGE_STORE, JSON.stringify(usage));
  } catch {}
}

export function getActiveKey(usage: KeyManager): "primary" | "secondary" | null {
  if (!usage.primary.exhausted) return "primary";
  if (!usage.secondary.exhausted) return "secondary";
  return null;
}

export function markKeyExhausted(
  usage: KeyManager,
  key: "primary" | "secondary",
): KeyManager {
  return {
    ...usage,
    [key]: { ...usage[key], exhausted: true, requestsRemaining: 0, requestsUsed: MONTHLY_LIMIT },
    activeKey: key === "primary" ? "secondary" : "primary",
  };
}

export function updateKeyUsage(
  usage: KeyManager,
  key: "primary" | "secondary",
  remaining: number,
): KeyManager {
  return {
    ...usage,
    [key]: {
      ...usage[key],
      requestsRemaining: remaining,
      requestsUsed: Math.max(MONTHLY_LIMIT - remaining, usage[key].requestsUsed),
      lastUsed: Date.now(),
      exhausted: remaining <= 0,
    },
  };
}

export function getOptimalInterval(usage: KeyManager): number {
  const now = new Date();
  const resetDate = new Date(usage.primary.resetDate ?? nextResetDate());
  const daysLeft = Math.max(
    (resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    1,
  );
  const hoursLeft = daysLeft * 24;

  const totalRemaining =
    (usage.primary.exhausted ? 0 : usage.primary.requestsRemaining) +
    (usage.secondary.exhausted ? 0 : usage.secondary.requestsRemaining);

  if (totalRemaining <= 0) return Infinity;
  if (totalRemaining <= 20) return 24 * 60 * 60 * 1000;
  if (totalRemaining <= 50) return 8 * 60 * 60 * 1000;
  if (totalRemaining <= 100) return 4 * 60 * 60 * 1000;

  // Each scan uses ~2 requests (default 2 sports auto-loaded)
  const scansRemaining = Math.max(Math.floor(totalRemaining / 2), 1);
  const intervalHours = hoursLeft / scansRemaining;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  return Math.min(Math.max(intervalMs, 2 * 60 * 60 * 1000), 12 * 60 * 60 * 1000);
}

export interface UsageSummary {
  totalRemaining: number;
  totalUsed: number;
  totalLimit: number;
  daysLeft: number;
  projectedDailyUse: number;
  willLastUntilReset: boolean;
  recommendedInterval: string;
  intervalMs: number;
  resetDate: string;
}

export function getUsageSummary(usage: KeyManager): UsageSummary {
  const now = new Date();
  const resetDate = new Date(usage.primary.resetDate ?? nextResetDate());
  const daysLeft = Math.max(
    (resetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    0,
  );
  const totalRemaining =
    (usage.primary.exhausted ? 0 : usage.primary.requestsRemaining) +
    (usage.secondary.exhausted ? 0 : usage.secondary.requestsRemaining);
  const totalUsed = usage.primary.requestsUsed + usage.secondary.requestsUsed;
  const optimalMs = getOptimalInterval(usage);
  const scansPerDay = optimalMs < Infinity ? (24 * 60 * 60 * 1000) / optimalMs : 0;
  const projectedDailyUse = scansPerDay * 2;
  const willLastUntilReset = totalRemaining >= projectedDailyUse * daysLeft;
  const intervalHours = optimalMs / (60 * 60 * 1000);
  const recommendedInterval =
    optimalMs === Infinity
      ? "Paused — quota exhausted"
      : intervalHours < 1
        ? `Every ${Math.round(intervalHours * 60)} minutes`
        : `Every ${intervalHours.toFixed(1)} hours`;
  return {
    totalRemaining,
    totalUsed,
    totalLimit: MONTHLY_LIMIT * 2,
    daysLeft: Math.round(daysLeft),
    projectedDailyUse: Math.round(projectedDailyUse),
    willLastUntilReset,
    recommendedInterval,
    intervalMs: optimalMs,
    resetDate: usage.primary.resetDate,
  };
}
