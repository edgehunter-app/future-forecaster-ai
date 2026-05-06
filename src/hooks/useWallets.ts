import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAppStore } from "@/store/useAppStore";
import { useTrackedWallets } from "./useTrackedWallets";
import { fetchTopWallets } from "@/lib/polymarket";
import type { Wallet } from "@/types";

export function useWallets() {
  const { user } = useAuth();
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const { wallets: trackedWallets, addWallet, removeWallet, loading, reload } =
    useTrackedWallets();

  const [autoDiscovered, setAutoDiscovered] = useState<Wallet[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const scanTopWallets = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      console.log("Scanning Polymarket top wallets...");
      const wallets = await fetchTopWallets(20);
      console.log("Wallets found:", wallets.length);
      if (wallets.length > 0) {
        const topWallets = wallets.filter((w) => w.tier === "S" || w.tier === "A");
        setAutoDiscovered(topWallets.length > 0 ? topWallets : wallets.slice(0, 10));

        if (user && !isDemoMode) {
          for (const wallet of topWallets.slice(0, 10)) {
            const { data } = await supabase
              .from("tracked_wallets")
              .select("address")
              .eq("user_id", user.id)
              .eq("address", wallet.address)
              .maybeSingle();
            if (!data) {
              await supabase.from("tracked_wallets").insert({
                user_id: user.id,
                address: wallet.address,
                label: wallet.label,
                win_rate: wallet.winRate,
                sharpe: wallet.sharpe,
                roi_30d: wallet.roi30d,
                total_volume: wallet.totalVolume,
                recent_trades: wallet.recentTrades,
                consistency: wallet.consistency,
                tier: wallet.tier,
                is_auto_discovered: true,
              });
            }
          }
          await reload();
        }
      } else {
        setScanError(
          "Could not reach Polymarket leaderboard. Try again or add wallets manually.",
        );
      }
      setLastScanned(new Date());
    } catch (err) {
      console.error("Wallet scan failed:", err);
      setScanError("Wallet scan failed. Try again.");
    } finally {
      setScanning(false);
    }
  }, [user, isDemoMode, reload]);

  useEffect(() => {
    void scanTopWallets();
    const id = setInterval(() => void scanTopWallets(), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [scanTopWallets]);

  return {
    trackedWallets,
    autoDiscovered,
    scanning,
    lastScanned,
    scanError,
    loading,
    addWallet,
    removeWallet,
    scanTopWallets,
  };
}