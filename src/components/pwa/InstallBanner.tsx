import { useEffect, useState } from "react";
import { Download, Share, Plus, X, Zap } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "polysignal-install-dismissed";
const DELAY_MS = 30_000;

export default function InstallBanner() {
  const { canInstall, isInstalled, isIOS, showIOSInstructions, setShowIOSInstructions, install } = usePWA();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;
    if (!canInstall) return;
    const t = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [canInstall, isInstalled]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  return (
    <>
      {visible && !showIOSInstructions && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-info/40 bg-card p-4 shadow-glow-blue animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-md bg-gradient-to-br from-info to-purple flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Install PolySignal</div>
              <div className="text-xs text-muted-foreground">Add to home screen for quick access</div>
            </div>
            <button
              onClick={() => void install()}
              className="rounded-md bg-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-info/90 transition-colors"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showIOSInstructions && (
        <IOSInstructions onClose={() => setShowIOSInstructions(false)} />
      )}
    </>
  );
}

function IOSInstructions({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn(
          "w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card p-6 shadow-card",
          "animate-in slide-in-from-bottom-4",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-foreground">Install on iPhone</h2>
        <div className="mt-5 space-y-4">
          <Step n={1} icon={<Share className="h-5 w-5 text-info" />}>
            Tap the <span className="font-semibold text-foreground">Share</span> button at the bottom of Safari
          </Step>
          <Step n={2} icon={<Plus className="h-5 w-5 text-info" />}>
            Scroll down and tap <span className="font-semibold text-foreground">Add to Home Screen</span>
          </Step>
          <Step n={3} icon={<Zap className="h-5 w-5 text-white" />} iconBg>
            Tap <span className="font-semibold text-foreground">Add</span> — PolySignal will appear on your home screen
          </Step>
        </div>
        <p className="mt-5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Must be opened in Safari, not Chrome
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Step({ n, icon, iconBg, children }: { n: number; icon: React.ReactNode; iconBg?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn(
        "h-9 w-9 shrink-0 rounded-md flex items-center justify-center border",
        iconBg ? "bg-gradient-to-br from-info to-purple border-transparent" : "bg-background border-border",
      )}>
        {icon}
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed pt-1.5">
        <span className="font-bold text-foreground mr-1">{n}.</span>
        {children}
      </div>
    </div>
  );
}