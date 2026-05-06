import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_WALLETS } from "@/data/mockData";
import type { Wallet, Tier } from "@/types";

function mapWalletRow(row: any): Wallet {
  return {
    address: row.address,
    label: row.label,
    winRate: Number(row.win_rate),
    sharpe: Number(row.sharpe),
    roi30d: Number(row.roi_30d),
    totalVolume: Number(row.total_volume),
    recentTrades: row.recent_trades,
    consistency: Number(row.consistency),
    tier: row.tier as Tier,
  };
}

export function useTrackedWallets() {
  const { user } = useAuth();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const [wallets, setWallets] = useState<Wallet[]>(isDemoMode ? MOCK_WALLETS : []);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    console.log("useTrackedWallets: loading...");
    console.log("User:", user?.id);
    console.log("isDemoMode:", isDemoMode);
    if (isDemoMode) {
      console.log("Demo mode — using MOCK_WALLETS");
      setWallets(MOCK_WALLETS);
      setLoading(false);
      return;
    }
    if (!user) {
      console.log("No user — cannot fetch wallets");
      setWallets([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("tracked_wallets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    console.log("DB result — rows:", data?.length, "error:", error);
    if (data && data.length > 0) {
      console.log("First row:", JSON.stringify(data[0]));
    }
    const mapped = data ? data.map(mapWalletRow) : [];
    console.log("Mapped wallets:", mapped.length);
    setWallets(mapped);
    setLoading(false);
  }, [isDemoMode, user]);

  const addWallet = async (w: Wallet) => {
    if (isDemoMode) {
      setWallets((prev) => prev.some((x) => x.address === w.address) ? prev : [w, ...prev]);
      return;
    }
    if (!user) {
      setWallets((prev) => prev.some((x) => x.address === w.address) ? prev : [w, ...prev]);
      return;
    }
    await supabase.from("tracked_wallets").insert({
      user_id: user.id,
      address: w.address,
      label: w.label,
      win_rate: w.winRate,
      sharpe: w.sharpe,
      roi_30d: w.roi30d,
      total_volume: w.totalVolume,
      recent_trades: w.recentTrades,
      consistency: w.consistency,
      tier: w.tier,
    });
    load();
  };

  const removeWallet = async (address: string) => {
    if (isDemoMode || !user) {
      setWallets((prev) => prev.filter((w) => w.address !== address));
      return;
    }
    await supabase
      .from("tracked_wallets")
      .delete()
      .eq("user_id", user.id)
      .eq("address", address);
    setWallets((prev) => prev.filter((w) => w.address !== address));
  };

  useEffect(() => { load(); }, [load]);

  return { wallets, loading, addWallet, removeWallet, reload: load };
}