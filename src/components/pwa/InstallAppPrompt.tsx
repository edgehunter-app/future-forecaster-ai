import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Smartphone, X } from "lucide-react";

const VISITS_KEY = "eh_app_visits";
const PROMPTED_KEY = "eh_install_prompted";

export default function InstallAppPrompt() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(PROMPTED_KEY) === "true") return;
      const count = Number(localStorage.getItem(VISITS_KEY) || "0") + 1;
      localStorage.setItem(VISITS_KEY, String(count));
      if (count >= 3 && pathname !== "/install") {
        const t = setTimeout(() => setOpen(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, [pathname]);

  if (!open) return null;

  const dismiss = () => {
    try { localStorage.setItem(PROMPTED_KEY, "true"); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-4 bottom-24 z-[110] mx-auto max-w-md rounded-2xl border border-info/40 bg-card p-4 shadow-xl md:bottom-6 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-500">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">📱 Add EdgeHunter to your home screen</div>
          <div className="text-xs text-muted-foreground">Faster access and a better experience.</div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { dismiss(); nav("/install"); }}
              className="rounded-md bg-info px-3 py-1.5 text-xs font-bold text-white"
            >
              Add to Home Screen
            </button>
            <button onClick={dismiss} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}