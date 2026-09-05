import { useEffect, useState } from "react";
import { cfbTeamMeta } from "@/lib/cfbTeams";

/**
 * Odds providers do not include poll rankings, so the Top 25 list comes from
 * ESPN's public rankings feed (no key, CORS-open). Cached for 6 hours — polls
 * only move once a week.
 */

const CACHE_KEY = "eh.cfbRankings.v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const ENDPOINT =
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings";

export interface CfbRankings {
  poll: string;
  ranks: Record<string, number>;
  fetchedAt: number;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

let memo: CfbRankings | null = null;
let inflight: Promise<CfbRankings | null> | null = null;

function readCache(): CfbRankings | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CfbRankings;
    if (!parsed?.ranks || Date.now() - parsed.fetchedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchRankings(): Promise<CfbRankings | null> {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`rankings ${res.status}`);
  const json = await res.json();
  const polls: any[] = Array.isArray(json?.rankings) ? json.rankings : [];
  // Prefer AP, fall back to the Coaches poll.
  const poll =
    polls.find((p) => /ap/i.test(p?.shortName ?? "")) ??
    polls.find((p) => /coaches/i.test(p?.shortName ?? "") && !/fcs|div/i.test(p?.shortName ?? "")) ??
    polls[0];
  if (!poll) return null;
  const ranks: Record<string, number> = {};
  for (const entry of poll.ranks ?? []) {
    const rank = Number(entry?.current);
    const team = entry?.team ?? {};
    if (!Number.isFinite(rank)) continue;
    for (const name of [team.location, team.displayName, team.shortDisplayName, team.name && team.location ? `${team.location} ${team.name}` : null]) {
      if (name) ranks[norm(String(name))] = rank;
    }
  }
  const out: CfbRankings = {
    poll: poll.shortName ?? poll.name ?? "AP Poll",
    ranks,
    fetchedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(out));
  } catch {
    // ignore quota errors
  }
  return out;
}

function load(): Promise<CfbRankings | null> {
  if (memo) return Promise.resolve(memo);
  const cached = readCache();
  if (cached) {
    memo = cached;
    return Promise.resolve(cached);
  }
  if (!inflight) {
    inflight = fetchRankings()
      .then((r) => {
        if (r) memo = r;
        return r;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function rankOf(
  ranks: Record<string, number> | null,
  teamName: string | undefined | null,
): number | null {
  if (!ranks || !teamName) return null;
  const direct = ranks[norm(teamName)];
  if (direct) return direct;
  const meta = cfbTeamMeta(teamName);
  if (meta) {
    const byLocation = ranks[norm(meta.location)];
    if (byLocation) return byLocation;
  }
  return null;
}

export function useCfbRankings(enabled = true) {
  const [data, setData] = useState<CfbRankings | null>(memo);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || data) return;
    let alive = true;
    setLoading(true);
    void load().then((r) => {
      if (!alive) return;
      setData(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [enabled, data]);

  return {
    poll: data?.poll ?? null,
    ranks: data?.ranks ?? null,
    loading,
    rankOf: (name: string | undefined | null) => rankOf(data?.ranks ?? null, name),
  };
}
