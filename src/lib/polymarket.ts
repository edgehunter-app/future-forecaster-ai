import type { Wallet, WalletPosition, WalletActivity } from "@/types";
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
  const address = String(profile.proxyWallet ?? profile.address ?? profile.walletAddress ?? profile.user ?? "");
  const label = String(
    profile.userName ?? profile.name ?? profile.username ?? profile.displayName ?? profile.xUsername ?? truncateAddress(address),
  );
  const volume = Number(profile.vol ?? profile.volume ?? profile.totalVolume ?? profile.tradedVolume ?? 0);
  const pnl = Number(profile.pnl ?? profile.profitLoss ?? profile.profit ?? 0);
  // Estimate win rate from pnl/volume ratio when explicit win counts are absent.
  const explicitTrades = Number(profile.tradesCount ?? profile.numTrades ?? profile.trades ?? 0);
  const explicitWins = Number(profile.winsCount ?? profile.numWins ?? profile.wins ?? 0);
  const rawWinRate = explicitTrades > 0
    ? explicitWins / explicitTrades
    : volume > 0 ? Math.min(0.5 + (pnl / volume) * 2, 0.95) : 0.5;
  const winRate = Math.max(0.3, rawWinRate);
  const trades = explicitTrades > 0 ? explicitTrades : Math.max(20, Math.floor(volume / 5000));
  const sharpe = winRate > 0.5 ? (winRate - 0.5) * 10 : 0.5;
  const consistency = Math.min((trades / 50) * winRate, 0.95);
  const roi30d = volume > 0 ? Math.min(pnl / Math.max(volume, 1), 1) : 0;

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

export async function fetchWalletPositions(address: string): Promise<WalletPosition[]> {
  if (!address) return [];
  try {
    const { data, error } = await supabase.functions.invoke("fetch-wallet-positions", {
      body: { address, limit: 50 },
    });
    if (error) {
      console.error("fetch-wallet-positions error:", error);
      return [];
    }
    return (data?.positions ?? []) as WalletPosition[];
  } catch (err) {
    console.error("fetchWalletPositions failed:", err);
    return [];
  }
}

export async function fetchWalletActivity(address: string, limit = 20): Promise<WalletActivity[]> {
  if (!address) return [];
  try {
    const { data, error } = await supabase.functions.invoke("fetch-wallet-activity", {
      body: { address, limit },
    });
    if (error) {
      console.error("fetch-wallet-activity error:", error);
      return [];
    }
    return (data?.activity ?? []) as WalletActivity[];
  } catch (err) {
    console.error("fetchWalletActivity failed:", err);
    return [];
  }
}

// Backwards-compat alias
export const fetchWalletHistory = fetchWalletActivity;

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