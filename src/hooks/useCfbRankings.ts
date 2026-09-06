import { useEffect, useState } from "react";
import { cfbTeamMeta } from "@/lib/cfbTeams";
import { supabase } from "@/integrations/supabase/client";

/**
 * Odds providers do not include poll rankings, so the Top 25 list comes from
 * ESPN's public rankings feed (no key, CORS-open). Cached for 6 hours — polls
 * only move once a week.
 */

const CACHE_KEY = "eh.cfbRankings.v1";
const TTL_MS = 6 * 60 * 60 * 1000;

export interface CfbRankings {
  poll: string;
  ranks: Record<string, number>;
  fetchedAt: number;
}

// Keep in sync with the norm in src/lib/cfbTeams.ts and the cfb-rankings
// edge function, so "Hawaii"/"Hawai'i"/"San Jose State" all key identically.
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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
  // ESPN blocks browser requests (no CORS), so the feed is proxied by an edge function.
  const { data, error } = await supabase.functions.invoke("cfb-rankings");
  if (error) throw error;
  const ranks = (data?.ranks ?? {}) as Record<string, number>;
  if (!Object.keys(ranks).length) return null;
  const out: CfbRankings = {
    poll: (data?.poll as string) ?? "AP Poll",
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
