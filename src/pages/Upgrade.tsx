import { useNavigate } from "react-router-dom";
import { Check, Crown, Sparkles, Trophy } from "lucide-react";
import { useSubscription, type Tier } from "@/hooks/useSubscription";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/components/ui/AppToast";
import { cn } from "@/lib/utils";
import { useState } from "react";

const PRO_PRICE_ID = "price_1Ts4bH4xj8SLZzGvvkd7bpVy";
const ELITE_PRICE_ID = "price_1Ts4dg4xj8SLZzGv7131R1yx";

const PRO_FEATURES = [
  "Unlimited AI analysis",
  "Best Bet Today scanner",
  "Full book comparison (8+ sportsbooks)",
  "Bet Tracker with ROI analytics",
  "Golf & MMA coverage",
  "Prediction market signals",
];

const ELITE_FEATURES = [
  "Everything in Pro",
  "Smart wallet signals",
  "Devil's Advocate AI",
  "Risk AI & volatility grading",
  "Priority AI analysis",
  "Early access to new features",
];

export default function Upgrade() {
  usePageTitle("Upgrade");
  const nav = useNavigate();
  const { tier, isBeta, upgrade, loading } = useSubscription();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<Tier | null>(null);

  const start = async (priceId: string, name: Tier) => {
    if (isBeta) {
      showToast("You already have complimentary Elite access.", "info");
      return;
    }
    setBusy(name);
    try {
      await upgrade(priceId, name);
    } catch (e) {
      console.error(e);
      showToast("Could not start checkout. Please try again.", "error");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Upgrade EdgeHunter
        </h1>
        <p className="mt-2 text-muted-foreground">
          Unlock unlimited AI analysis, deeper signals, and priority access.
        </p>
        {isBeta && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
            <Trophy className="h-3 w-3" /> You have complimentary Elite (Beta) access
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <PlanCard
          name="Pro"
          price="$19"
          icon={<Sparkles className="h-5 w-5" />}
          gradient="from-violet-500 to-fuchsia-500"
          features={PRO_FEATURES}
          current={tier === "pro"}
          disabled={loading || busy !== null || tier === "pro" || tier === "elite" || isBeta}
          busy={busy === "pro"}
          onClick={() => start(PRO_PRICE_ID, "pro")}
          ctaLabel={tier === "pro" ? "Current Plan" : tier === "elite" ? "Included in Elite" : "Upgrade to Pro"}
        />
        <PlanCard
          name="Elite"
          price="$49"
          icon={<Crown className="h-5 w-5" />}
          gradient="from-amber-400 to-yellow-500"
          features={ELITE_FEATURES}
          current={tier === "elite"}
          disabled={loading || busy !== null || tier === "elite" || isBeta}
          busy={busy === "elite"}
          onClick={() => start(ELITE_PRICE_ID, "elite")}
          ctaLabel={tier === "elite" ? "Current Plan" : "Upgrade to Elite"}
          highlight
        />
      </div>

      <div className="text-center">
        <button
          onClick={() => nav("/settings")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Settings
        </button>
      </div>
    </div>
  );
}

function PlanCard({
  name, price, icon, gradient, features, current, disabled, busy, onClick, ctaLabel, highlight,
}: {
  name: string;
  price: string;
  icon: React.ReactNode;
  gradient: string;
  features: string[];
  current: boolean;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
  ctaLabel: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl border bg-card p-6 flex flex-col",
      highlight ? "border-amber-500/40 shadow-[0_0_40px_-15px_rgba(245,158,11,0.5)]" : "border-border",
    )}>
      {current && (
        <span className="absolute -top-3 right-6 rounded-full bg-success px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Current Plan
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white", gradient)}>
          {icon}
        </span>
        <div>
          <div className="text-xl font-extrabold text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">EdgeHunter</div>
        </div>
      </div>
      <div className="mt-4">
        <span className="text-4xl font-extrabold text-foreground">{price}</span>
        <span className="text-sm text-muted-foreground">/month</span>
      </div>
      <ul className="mt-5 space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 mt-0.5 text-success shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "mt-6 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity bg-gradient-to-r",
          gradient,
          disabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-90",
        )}
      >
        {busy ? "Redirecting…" : ctaLabel}
      </button>
    </div>
  );
}