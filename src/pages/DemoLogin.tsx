import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { signInAsDemo } from "@/lib/signInAsDemo";
import { EdgeHunterLogo } from "@/components/brand/EdgeHunterLogo";

export default function DemoLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await signInAsDemo();
        if (!cancelled) navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Demo login failed");
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <EdgeHunterLogo size={64} variant="icon" />
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => navigate("/auth")}
              className="rounded-md bg-info px-4 py-2 text-sm font-bold text-white"
            >
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-info" />
            <p className="text-sm text-muted-foreground">Loading demo experience…</p>
          </>
        )}
      </div>
    </div>
  );
}