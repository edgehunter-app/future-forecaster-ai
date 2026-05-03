import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function SafetyBanner({ className }: { className?: string }) {
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm",
      className,
    )}>
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="text-warning/90">
        <span className="font-semibold text-warning">Suggestion only.</span>{" "}
        PolySignal never auto-trades. All execution requires your manual confirmation on Polymarket.
      </div>
    </div>
  );
}

export default SafetyBanner;
