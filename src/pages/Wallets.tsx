import { useEffect, useState } from "react";
import { Plus, Zap, X, Wallet as WalletIcon, Loader2, RefreshCw } from "lucide-react";
import WalletCard from "@/components/wallets/WalletCard";
import EmptyState from "@/components/ui/EmptyState";
import type { Wallet } from "@/types";
import { scoreWallet, getTier } from "@/lib/walletScorer";
import { useWallets } from "@/hooks/useWallets";
import { fetchWalletPositions, fetchWalletHistory } from "@/lib/polymarket";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Wallets() {
  usePageTitle("Wallets");
  const {
    trackedWallets: tracked,
    autoDiscovered,
    scanning,
    lastScanned,
    scanError,
    addWallet,
    removeWallet,
    scanTopWallets,
  } = useWallets();

  const [open, setOpen] = useState(false);
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [addedAddrs, setAddedAddrs] = useState<Set<string>>(new Set());
  const [activeAddr, setActiveAddr] = useState<string | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!activeAddr) return;
    setDetailLoading(true);
    Promise.all([fetchWalletPositions(activeAddr), fetchWalletHistory(activeAddr)])
      .then(([p, h]) => {
        setPositions(p);
        setHistory(h);
      })
      .finally(() => setDetailLoading(false));
  }, [activeAddr]);

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

  const handleAddAuto = (w: Wallet) => {
    void addWallet(w);
    setAddedAddrs((prev) => new Set(prev).add(w.address));
  };

  const lastScannedLabel = lastScanned
    ? `Last scanned: ${Math.max(0, Math.round((Date.now() - lastScanned.getTime()) / 60000))} min ago`
    : "Not scanned yet";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Smart Wallets</h1>
          <p className="text-sm text-muted-foreground">Track high-performing prediction market traders</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-muted-foreground inline-flex items-center gap-1.5">
            {scanning ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Scanning Polymarket...
              </>
            ) : (
              lastScannedLabel
            )}
          </span>
          <button
            onClick={() => void scanTopWallets()}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
            Scan Now
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90 transition-colors shadow-glow-blue"
          >
            {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {open ? "Cancel" : "Add Wallet"}
          </button>
        </div>
      </div>

      {scanError && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          {scanError} You can still add wallets manually above.
        </div>
      )}

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

      {/* Auto-discovered */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Auto-discovered top wallets</h2>
          <span className="text-[11px] text-muted-foreground">{autoDiscovered.length} found</span>
        </div>
        {autoDiscovered.length === 0 && !scanning ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            No top wallets discovered yet. Click Scan Now to search Polymarket.
          </div>
        ) : autoDiscovered.length === 0 && scanning ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-lg border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {autoDiscovered.map((w) => {
              const isTracked =
                addedAddrs.has(w.address) || tracked.some((t) => t.address === w.address);
              return (
                <WalletCard
                  key={w.address}
                  wallet={w}
                  action={
                    <button
                      onClick={() => handleAddAuto(w)}
                      disabled={isTracked}
                      className="shrink-0 rounded-md border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] font-semibold text-info hover:bg-info/20 transition-colors disabled:opacity-60"
                    >
                      {isTracked ? "Added ✓" : "Add to Watchlist"}
                    </button>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Tracked grid */}
      {tracked.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="No wallets tracked yet"
          subtitle="Add a wallet address above to start tracking smart money signals"
          action={{ label: "Add Wallet", onClick: () => setOpen(true) }}
        />
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Tracked wallets</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tracked.map((w) => (
              <div key={w.address} className="space-y-2">
                <WalletCard
                  wallet={w}
                  action={
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() =>
                          setActiveAddr((cur) => (cur === w.address ? null : w.address))
                        }
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/30"
                      >
                        {activeAddr === w.address ? "Hide" : "Details"}
                      </button>
                      <button
                        onClick={() => removeWallet(w.address)}
                        className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  }
                />
                {activeAddr === w.address && (
                  <div className="rounded-md border border-border bg-card p-3 text-xs space-y-2">
                    {detailLoading ? (
                      <div className="text-muted-foreground inline-flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading wallet activity...
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-bold text-foreground mb-1">Open positions</div>
                          {positions.length === 0 ? (
                            <div className="text-muted-foreground">No open positions found</div>
                          ) : (
                            <ul className="space-y-1 max-h-40 overflow-y-auto">
                              {positions.slice(0, 8).map((p, i) => (
                                <li key={i} className="font-mono text-[11px] text-muted-foreground">
                                  {p.title ?? p.market ?? p.outcome ?? JSON.stringify(p).slice(0, 80)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-foreground mb-1">Recent activity</div>
                          {history.length === 0 ? (
                            <div className="text-muted-foreground">No recent activity</div>
                          ) : (
                            <ul className="space-y-1 max-h-40 overflow-y-auto">
                              {history.slice(0, 8).map((h, i) => (
                                <li key={i} className="font-mono text-[11px] text-muted-foreground">
                                  {h.title ?? h.type ?? h.side ?? JSON.stringify(h).slice(0, 80)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
