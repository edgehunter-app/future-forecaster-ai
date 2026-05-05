import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "eh_icon_update_banner_dismissed";

export function IconUpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div className="border-b border-border/60 bg-primary/10 px-4 py-2 text-sm text-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <span className="flex-1">
          App icon updated. Remove and re-add EdgeHunter to your home screen to see the new crosshair icon.
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default IconUpdateBanner;