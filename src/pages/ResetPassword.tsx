import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EdgeHunterLogo } from "@/components/brand/EdgeHunterLogo";
import { clearRecovery } from "@/lib/recoveryGate";
import { useAuth } from "@/hooks/useAuth";

export default function ResetPassword() {
  const { user, loading: authLoading } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    clearRecovery();
    window.location.replace("/");
  };

  const cancel = async () => {
    clearRecovery();
    await supabase.auth.signOut();
    window.location.replace("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="flex justify-center"><EdgeHunterLogo /></div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
          <p className="text-sm text-muted-foreground">Choose a new password to finish resetting your account.</p>
        </div>
        {authLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : !user ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-destructive">This reset link is invalid or has expired. Request a new one.</p>
            <button onClick={cancel} className="text-sm text-primary underline">Back to sign in</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" autoComplete="new-password" />
            <input type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" autoComplete="new-password" />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <button type="submit" disabled={busy}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {busy ? "Saving…" : "Save new password"}
            </button>
            <button type="button" onClick={cancel} className="w-full text-sm text-muted-foreground underline">
              Cancel and sign out
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
