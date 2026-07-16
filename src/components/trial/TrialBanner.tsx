import { useNavigate } from "react-router-dom";
import { Sparkles, AlertTriangle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export default function TrialBanner() {
  const nav = useNavigate();
  const { isTrialActive, trialDaysRemaining, trialEndsAt, stripeSubscriptionId, openBillingPortal } =
    useSubscription();
  if (!isTrialActive) return null;

  const urgent = trialDaysRemaining <= 1;
  const label = urgent
    ? "Trial ends tomorrow"
    : `Free Trial — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} remaining`;
  const chargeDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  const sub = stripeSubscriptionId && chargeDate
    ? `Your card will be charged ${chargeDate} unless you cancel`
    : urgent
      ? "Upgrade now to keep your access"
      : "Upgrade to keep full access";

  return (
    <div
      className={
        urgent
          ? "flex items-center justify-between gap-3 border-b border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 px-4 py-2"
          : "flex items-center justify-between gap-3 border-b border-blue-500/30 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 px-4 py-2"
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        {urgent ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0 text-blue-300" />
        )}
        <div className="min-w-0">
          <div className={urgent ? "text-xs font-bold text-amber-100" : "text-xs font-bold text-blue-100"}>
            {urgent ? "⚠️ " : "⚡ "}
            {label}
          </div>
          <div className="text-[10px] text-white/70 truncate">{sub}</div>
        </div>
      </div>
      <button
        onClick={() => {
          if (stripeSubscriptionId) void openBillingPortal();
          else nav("/upgrade");
        }}
        className={
          urgent
            ? "shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-black hover:bg-amber-400 transition-colors"
            : "shrink-0 rounded-md bg-white/95 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-white transition-colors"
        }
      >
        {stripeSubscriptionId ? "Manage" : "Upgrade — $19/mo"}
      </button>
    </div>
  );
}