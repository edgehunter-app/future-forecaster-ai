import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Shield, ArrowRight, Check } from "lucide-react";

const KEY = "hasSeenWelcome";

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);

  const close = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="max-w-lg w-full rounded-xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        {step === 1 && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-info to-purple flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground">EdgeHunter</h2>
            <p className="mt-1 text-sm text-info font-medium">Stop guessing. Start hunting.</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Track smart wallets, detect mispricings, and get AI-powered trade suggestions across Polymarket and Kalshi.
            </p>
            <button onClick={() => setStep(2)} className="mt-6 inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90">
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-foreground">Before you start, configure:</h2>
            <ul className="mt-4 space-y-2">
              {["Set your bankroll in Settings", "Add your Kelly multiplier", "Add a wallet to track (optional)", "Connect alert channels (optional)"].map((label) => (
                <li key={label}>
                  <button
                    onClick={() => { close(); navigate("/settings"); }}
                    className="w-full text-left flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-sm hover:border-info/40"
                  >
                    <span className="h-4 w-4 rounded border border-border" />
                    <span className="text-foreground">{label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => setStep(3)} className="text-sm text-muted-foreground hover:text-foreground">Skip for now</button>
              <button onClick={() => { close(); navigate("/settings"); }} className="rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90">
                Go to Settings
              </button>
            </div>
            <div className="mt-4 text-center">
              <button onClick={() => setStep(3)} className="text-xs text-muted-foreground underline">Continue →</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-warning/15 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-warning" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Important: Suggestions Only</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              EdgeHunter provides analysis and position sizing suggestions. All trades must be executed manually
              by you. This is not financial advice. Prediction markets carry significant risk.
            </p>
            <label className="mt-5 inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="h-4 w-4 accent-info" />
              <span className="text-sm text-foreground">I understand this is not financial advice</span>
            </label>
            <div className="mt-6">
              <button
                disabled={!accepted}
                onClick={close}
                className="inline-flex items-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" /> Start Using EdgeHunter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}