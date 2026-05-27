import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { useToast } from "@/components/ui/AppToast";
import { cn } from "@/lib/utils";
import { EdgeHunterLogo } from "@/components/brand/EdgeHunterLogo";

export default function Auth() {
  const navigate = useNavigate();
  const setDemoMode = useAppStore((s) => s.setDemoMode);
  const { showToast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        showToast("Account created — check your email if confirmation is required", "success");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
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

  const demo = () => {
    setDemoMode(true);
    navigate("/");
  };

  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <EdgeHunterLogo size={64} variant="icon" />
          <div className="text-center">
            <p className="font-sans text-2xl font-extrabold tracking-tight text-foreground">EdgeHunter</p>
            <p className="mt-1 text-sm text-muted-foreground">Stop guessing. Start hunting.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-card">
          <div className="flex gap-1 rounded-md border border-border bg-background p-1 mb-5">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === m ? "bg-info text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-info focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-info focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info/90 transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={google}
            className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Continue with Google
          </button>

          <button
            onClick={demo}
            className="w-full mt-3 rounded-md px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue with demo →
          </button>
        </div>
      </div>
    </div>
  );
}