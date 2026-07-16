import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";

export default function TrialExpiredModal() {
  const nav = useNavigate();
  const { trialJustExpired, dismissTrialExpired } = useSubscription();
  if (!trialJustExpired) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl">
            ⏰
          </div>
          <h2 className="text-xl font-extrabold text-foreground">Your free trial has ended</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Hope you found some edges! Upgrade to Pro to keep unlimited AI analysis,
            Best Bet Today, and full book comparison.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <button
            onClick={() => {
              dismissTrialExpired();
              nav("/upgrade");
            }}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white hover:opacity-95"
          >
            Upgrade to Pro — $19/mo
          </button>
          <button
            onClick={dismissTrialExpired}
            className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}