import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Keyboard } from "lucide-react";

const ROUTES: Record<string, string> = {
  d: "/",
  s: "/suggestions",
  w: "/wallets",
  m: "/markets",
  c: "/cross-market",
  h: "/history",
  ",": "/settings",
};

export default function KeyboardShortcuts() {
  const navigate = useNavigate();
  const gPressed = useRef<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "Escape") {
        setShow(false);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShow((v) => !v);
        return;
      }
      if (e.key === "g") {
        if (gPressed.current) clearTimeout(gPressed.current);
        gPressed.current = window.setTimeout(() => { gPressed.current = null; }, 1000);
        return;
      }
      if (gPressed.current && ROUTES[e.key]) {
        e.preventDefault();
        navigate(ROUTES[e.key]);
        clearTimeout(gPressed.current);
        gPressed.current = null;
      }
      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>('input[type="search"], input[data-search]');
        if (input) { e.preventDefault(); input.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 left-4 z-30 hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="h-4 w-4" />
      </button>
      {show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShow(false)}>
          <div className="max-w-md w-full rounded-lg border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Keyboard Shortcuts</h3>
              <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <ul className="space-y-2 text-sm">
              {[
                ["G then D", "Dashboard"], ["G then S", "Suggestions"], ["G then W", "Wallets"],
                ["G then M", "Markets"], ["G then C", "Cross-Market"], ["G then H", "History"],
                ["/", "Focus search"], ["?", "Toggle this help"], ["Esc", "Close modals"],
              ].map(([k, l]) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{l}</span>
                  <kbd className="rounded border border-border bg-background px-2 py-0.5 text-xs font-mono text-foreground">{k}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}