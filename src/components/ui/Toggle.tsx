import { cn } from "@/lib/utils";

interface Props {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Toggle({ enabled, onChange, label, size = "md", className }: Props) {
  const sm = size === "sm";
  const trackW = sm ? "w-8" : "w-10";
  const trackH = sm ? "h-4" : "h-5";
  const thumb = sm ? "h-3 w-3" : "h-4 w-4";
  const translate = sm ? "translate-x-4" : "translate-x-5";

  return (
    <label className={cn("inline-flex items-center gap-2.5 cursor-pointer select-none", className)}>
      {label && <span className="text-sm text-foreground">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full transition-colors",
          trackW, trackH,
          enabled ? "bg-info" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-block transform rounded-full bg-white shadow transition-transform",
            thumb,
            "ml-0.5",
            enabled ? translate : "translate-x-0",
          )}
        />
      </button>
    </label>
  );
}

export default Toggle;
