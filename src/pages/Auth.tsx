import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useToast } from "@/components/ui/AppToast";
import { cn } from "@/lib/utils";
import { EdgeHunterLogo } from "@/components/brand/EdgeHunterLogo";
import { signInAsDemo } from "@/lib/signInAsDemo";

type Mode = "signup" | "signin";

const DEFAULT_TRIAL_PRICE_ID = "price_1Ts6wq5MCjCsVPzSQYekGmmZ";
const DEFAULT_TRIAL_TIER = "pro";

function ensurePendingUpgrade() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrl = urlParams.get("priceId") && urlParams.get("tier");
    const hasSession =
      sessionStorage.getItem("pending_upgrade_price") &&
      sessionStorage.getItem("pending_upgrade_tier");
    const hasLocal =
      localStorage.getItem("pending_upgrade_price") &&
      localStorage.getItem("pending_upgrade_tier");
    if (!hasUrl && !hasSession && !hasLocal) {
      sessionStorage.setItem("pending_upgrade_price", DEFAULT_TRIAL_PRICE_ID);
      sessionStorage.setItem("pending_upgrade_tier", DEFAULT_TRIAL_TIER);
      console.log("[auth] defaulted pending upgrade to Pro trial");
    }
  } catch {
    // ignore
  }
}

export default function Auth() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<Mode>(() => {
    const q = new URLSearchParams(window.location.search).get("mode");
    if (q === "signup" || q === "signin") return q;
    try {
      return localStorage.getItem("returning_user") === "1" ? "signin" : "signup";
    } catch {
      return "signup";
    }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    const q = params.get("mode");
    if (q === "signup" || q === "signin") setMode(q);
  }, [params]);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      console.log(
        "[auth] on mount, pending:",
        localStorage.getItem("pending_upgrade_price"),
        localStorage.getItem("pending_upgrade_tier"),
        "session:",
        sessionStorage.getItem("pending_upgrade_price"),
        sessionStorage.getItem("pending_upgrade_tier"),
        "url:",
        urlParams.get("priceId"),
        urlParams.get("tier"),
        "redirect param:",
        urlParams.get("redirect"),
      );
      // Hydrate sessionStorage from URL so it survives email-confirm redirects
      const urlPrice = urlParams.get("priceId");
      const urlTier = urlParams.get("tier");
      if (urlPrice && urlTier) {
        sessionStorage.setItem("pending_upgrade_price", urlPrice);
        sessionStorage.setItem("pending_upgrade_tier", urlTier);
      }
    } catch {
      // ignore
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session) return;
      const urlParams = new URLSearchParams(window.location.search);
      let pendingPrice: string | null = null;
      let pendingTier: string | null = null;
      try {
        pendingPrice =
          urlParams.get("priceId") ||
          sessionStorage.getItem("pending_upgrade_price") ||
          localStorage.getItem("pending_upgrade_price");
        pendingTier =
          urlParams.get("tier") ||
          sessionStorage.getItem("pending_upgrade_tier") ||
          localStorage.getItem("pending_upgrade_tier");
      } catch {
        // ignore
      }
      console.log("[auth] SIGNED_IN pending:", pendingPrice, pendingTier);

      if (pendingPrice && pendingTier) {
        try {
          sessionStorage.removeItem("pending_upgrade_price");
          sessionStorage.removeItem("pending_upgrade_tier");
          localStorage.removeItem("pending_upgrade_price");
          localStorage.removeItem("pending_upgrade_tier");
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const { data, error } = await supabase.functions.invoke("create-checkout", {
            body: { priceId: pendingPrice, tier: pendingTier },
          });
          console.log("[auth] checkout result:", data?.url, "error:", error);
          if (data?.url) {
            window.location.href = data.url;
            return;
          }
          showToast("Could not start checkout. Redirecting…", "error");
        } catch (err) {
          console.error("[auth] checkout invoke failed", err);
          showToast("Could not start checkout.", "error");
        }
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const tryDemo = async () => {
    setDemoLoading(true);
    try {
      await signInAsDemo();
      navigate("/");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Demo login failed", "error");
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    try {
      if (localStorage.getItem("returning_user") !== "1") {
        localStorage.setItem("returning_user", "1");
      }
    } catch {
      // ignore
    }
  }, []);

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    // Ensure a pending upgrade is set so SIGNED_IN handler redirects to Stripe.
    ensurePendingUpgrade();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      console.log(
        "[auth] signup complete, pending:",
        "session:",
        sessionStorage.getItem("pending_upgrade_price"),
        sessionStorage.getItem("pending_upgrade_tier"),
        "url:",
        new URLSearchParams(window.location.search).get("priceId"),
        new URLSearchParams(window.location.search).get("tier"),
      );
      setSignupSuccess(true);
    } catch (err: any) {
      showToast(err?.message ?? "Auth error", "error");
    } finally {
      setLoading(false);
    }
  };

  const submitSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (err: any) {
      showToast(err?.message ?? "Auth error", "error");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) showToast(result.error.message, "error");
  };

  const forgotPassword = async () => {
    if (!email) {
      showToast("Enter your email above first", "error");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) showToast(error.message, "error");
    else showToast("Password reset email sent", "success");
  };

  const inputCls =
    "mt-1 w-full min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus:border-info focus:outline-none";
  const labelCls =
    "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <EdgeHunterLogo size={64} variant="icon" />
          <div className="text-center">
            <p className="font-sans text-2xl font-extrabold tracking-tight text-foreground">EdgeHunter</p>
            <p className="mt-1 text-sm text-muted-foreground">Stop guessing. Start hunting.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          {signupSuccess ? (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-3" />
              <h2 className="text-xl font-extrabold text-foreground">Account created!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Check your email for a confirmation link before signing in.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Didn't get the email? Check your spam folder or contact us.
              </p>
              <button
                onClick={() => {
                  setSignupSuccess(false);
                  setMode("signin");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="mt-6 w-full min-h-[44px] rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90 transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                <button
                  onClick={() => {
                    ensurePendingUpgrade();
                    setMode("signup");
                  }}
                  className={cn(
                    "min-h-[56px] rounded-md px-4 py-2 text-sm font-bold transition-all",
                    mode === "signup"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/40"
                      : "bg-gradient-to-r from-blue-600/70 to-purple-600/70 text-white opacity-80 hover:opacity-100",
                  )}
                >
                  <div className="leading-tight">Start Free Trial</div>
                  <div className="text-[10px] font-medium opacity-90">5 days free · card required</div>
                </button>
                <button
                  onClick={() => setMode("signin")}
                  className={cn(
                    "min-h-[56px] rounded-md border-2 px-4 py-2 text-sm font-bold transition-all",
                    mode === "signin"
                      ? "border-info bg-info/10 text-foreground"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground hover:border-info/60",
                  )}
                >
                  <div className="leading-tight">Sign In</div>
                  <div className="text-[10px] font-medium opacity-80">Already have an account</div>
                </button>
              </div>

              {mode === "signup" ? (
                <form onSubmit={submitSignup} className="space-y-3">
                  <div className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-blue-300">
                      ⚡ Start your 5-day free trial
                    </div>
                    <p className="mt-1 text-[12px] text-foreground">
                      Enter your card — you won't be charged for 5 days.
                    </p>
                    <ul className="mt-2 space-y-1 text-[12px] text-foreground">
                      <li>✓ 5 days of full Pro access</li>
                      <li>✓ Unlimited AI analysis</li>
                      <li>✓ Best Bet Today</li>
                      <li>✓ Full book comparison</li>
                    </ul>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Cancel anytime · No commitment
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Card is entered after account creation on the Upgrade page.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputCls}
                      placeholder="Re-enter your password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-base font-bold text-white hover:opacity-95 transition disabled:opacity-60 shadow-lg shadow-purple-500/20"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create My Account
                  </button>
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signin")}
                      className="font-semibold text-info hover:underline"
                    >
                      Sign In →
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={submitSignin} className="space-y-3">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-md bg-info px-4 py-3 text-base font-bold text-white hover:bg-info/90 transition disabled:opacity-60"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Sign In
                  </button>
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    New to EdgeHunter?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="font-semibold text-info hover:underline"
                    >
                      Create Account →
                    </button>
                  </p>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={forgotPassword}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              )}

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <button
                onClick={google}
                className="w-full min-h-[44px] rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Continue with Google
              </button>

            </>
          )}
        </div>

        {!signupSuccess && (
          <button
            onClick={tryDemo}
            disabled={demoLoading}
            className="mt-4 w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-md border-2 border-amber-500/60 bg-transparent px-4 py-3 text-sm font-bold text-amber-400 hover:bg-amber-500/10 transition disabled:opacity-60"
          >
            {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {demoLoading ? "Loading demo…" : "👀 Try Demo — no signup needed"}
          </button>
        )}
      </div>
    </div>
  );
}