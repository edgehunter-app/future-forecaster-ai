import { useState } from "react";
import { Plus, Search, Zap, X } from "lucide-react";
import { MOCK_WALLETS } from "@/data/mockData";
import WalletCard from "@/components/wallets/WalletCard";
import type { Wallet } from "@/types";
import { scoreWallet, getTier } from "@/lib/walletScorer";
import { useTrackedWallets } from "@/hooks/useTrackedWallets";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Wallets() {
  usePageTitle("Wallets");
  const { wallets: tracked, addWallet, removeWallet } = useTrackedWallets();

  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");

  const submit = () => {
    if (!addr.trim()) return;
    const w: Wallet = {
      address: addr.trim(),
      label: label.trim() || `Wallet_${tracked.length + 1}`,
      winRate: 0.55, sharpe: 1.2, roi30d: 0.08, totalVolume: 0,
      recentTrades: 0, consistency: 0.5, tier: "C",
    };
    w.tier = getTier(scoreWallet(w));
    void addWallet(w);
    setAddr(""); setLabel(""); setOpen(false);
  };

  const discovered = [...MOCK_WALLETS].reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Smart Wallets</h1>
          <p className="text-sm text-muted-foreground">Track high-performing prediction market traders</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90 transition-colors shadow-glow-blue"
        >
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {open ? "Cancel" : "Add Wallet"}
        </button>
      </div>

      {/* Add panel */}
      {open && (
        <div className="rounded-lg border border-info/40 bg-info/5 p-5 shadow-glow-blue">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto]">
            <input
              value={addr} onChange={(e) => setAddr(e.target.value)}
              placeholder="0x... wallet address"
              className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-info focus:outline-none"
            />
            <input
              value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="Nickname"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-info focus:outline-none"
            />
            <button
              onClick={submit}
              className="rounded-md bg-info px-5 py-2 text-sm font-semibold text-white hover:bg-info/90 transition-colors"
            >Track</button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-warning" />
            We'll automatically score this wallet based on win rate, Sharpe ratio, and consistency
          </p>
        </div>
      )}

      {/* Tracked grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tracked.map((w) => (
          <WalletCard
            key={w.address}
            wallet={w}
            action={
              <button
                onClick={() => removeWallet(w.address)}
                className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20 transition-colors"
              >
                Remove
              </button>
            }
          />
        ))}
      </div>

      {/* Discovery */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Auto-Discovered Wallets</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">High performers detected by our scanner</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {discovered.map((w) => (
            <WalletCard
              key={`d-${w.address}`}
              wallet={w}
              className="opacity-75 hover:opacity-100"
              action={
                <button
                  onClick={() => void addWallet(w)}
                  className="shrink-0 rounded-md border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] font-semibold text-info hover:bg-info/20 transition-colors"
                >+ Watch</button>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
