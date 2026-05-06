import type { Wallet } from "@/types";
import { scoreWallet, getTier } from "@/lib/walletScorer";
import { supabase } from "@/integrations/supabase/client";

const GAMMA_API = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

async function apiFetch(url: string): Promise<any | null> {
  // Direct call kept for endpoints that allow CORS (positions/activity rarely do, but try).
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function mapProfileToWallet(profile: any): Wallet {
  const trades = Number(profile.tradesCount ?? profile.numTrades ?? profile.trades ?? 0);
  const wins = Number(profile.winsCount ?? profile.numWins ?? profile.wins ?? 0);
  const winRate = trades > 0 ? wins / trades : 0;
  const pnl = Number(profile.profitLoss ?? profile.pnl ?? profile.profit ?? 0);
  const volume = Number(profile.volume ?? profile.totalVolume ?? profile.tradedVolume ?? 0);
  const sharpe = winRate > 0 ? winRate * 2.5 + Math.min(volume, 1_000_000) / 1_000_000 : 0;
  const consistency = Math.min(trades / 100, 1) * winRate;
  const roi30d = pnl > 0 && volume > 0 ? Math.min(pnl / Math.max(volume, 1), 1) : 0;
  const address = String(profile.proxyWallet ?? profile.address ?? profile.walletAddress ?? profile.user ?? "");
  const label = String(profile.name ?? profile.username ?? profile.displayName ?? truncateAddress(address));

  const base: Wallet = {
    address,
    label,
    winRate,
    sharpe,
    roi30d,
    totalVolume: volume,
    recentTrades: trades,
    consistency,
    tier: "C",
  };
  base.tier = getTier(scoreWallet(base));
  return base;
}

export async function fetchTopWallets(limit = 20): Promise<Wallet[]> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-wallets", {
      body: { limit },
    });
    if (error) {
      console.error("fetch-wallets error:", error);
      return [];
    }
    const profiles: any[] = data?.profiles ?? [];
    console.log("Wallets from edge function:", profiles.length, "source:", data?.source, "endpoint:", data?.endpoint);
    return profiles
      .map(mapProfileToWallet)
      .filter((w) => w.address && w.winRate >= 0)
      .slice(0, limit);
  } catch (err) {
    console.error("fetchTopWallets failed:", err);
    return [];
  }
}

export async function fetchWalletPositions(address: string): Promise<any[]> {
  if (!address) return [];
  const endpoints = [
    `${DATA_API}/positions?user=${address}&sizeThreshold=1`,
    `${GAMMA_API}/positions?user=${address}`,
  ];
  for (const url of endpoints) {
    const res = await apiFetch(url);
    if (Array.isArray(res)) return res;
    if (res?.positions) return res.positions;
  }
  return [];
}

export async function fetchWalletHistory(address: string, limit = 50): Promise<any[]> {
  if (!address) return [];
  const endpoints = [
    `${DATA_API}/activity?user=${address}&limit=${limit}`,
    `${GAMMA_API}/activity?user=${address}&limit=${limit}`,
  ];
  for (const url of endpoints) {
    const res = await apiFetch(url);
    if (Array.isArray(res)) return res;
    if (res?.activity) return res.activity;
  }
  return [];
}

export async function fetchPolymarketMarkets(limit = 20): Promise<any[]> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-markets", {
      body: { limit, active: true },
    });
    if (error) {
      console.error("fetch-markets error:", error);
      return [];
    }
    const markets: any[] = data?.markets ?? [];
    console.log("Markets from edge function:", markets.length, "source:", data?.source);
    return markets;
  } catch (err) {
    console.error("fetchPolymarketMarkets failed:", err);
    return [];
  }
}