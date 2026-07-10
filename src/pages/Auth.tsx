import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/components/ui/AppToast";
import { cn } from "@/lib/utils";
import { EdgeHunterLogo } from "@/components/brand/EdgeHunterLogo";

type Mode = "signup" | "signin";

export default function Auth() {
  const navigate = useNavigate();
  const setDemoMode = useAppStore((s) => s.setDemoMode);
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>(() => {
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
  const [signupSuccess, setSignupSuccess] = useState(false);

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
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) showToast(error.message, "error");
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

  const demo = () => {
    setDemoMode(true);
    navigate("/");
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
                  onClick={() => setMode("signup")}
                  className={cn(
                    "min-h-[56px] rounded-md px-4 py-2 text-sm font-bold transition-all",
                    mode === "signup"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/40"
                      : "bg-gradient-to-r from-blue-600/70 to-purple-600/70 text-white opacity-80 hover:opacity-100",
                  )}
                >
                  <div className="leading-tight">Create Account</div>
                  <div className="text-[10px] font-medium opacity-90">Free to join</div>
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

              <button
                onClick={demo}
                className="w-full mt-3 min-h-[44px] rounded-md px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Continue with demo →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}