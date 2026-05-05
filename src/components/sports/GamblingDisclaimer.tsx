import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "full" | "compact" | "inline";
  className?: string;
}

const PHONE = "1-800-522-4700";
const TEL = "tel:18005224700";

export function GamblingDisclaimer({ variant = "full", className }: Props) {
  if (variant === "compact") {
    return (
      <div className={cn("text-center text-[10px] text-muted-foreground", className)}>
        Odds data only. Not a gambling service. 18+ | Gamble responsibly |{" "}
        <a href={TEL} className="underline hover:text-foreground">{PHONE}</a>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn(
        "mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning/90",
        className,
      )}>
        <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
        <span>Odds comparison only. Must be 18+ to use sportsbooks.</span>
      </div>
    );
  }

  return (
    <div className={cn("border-t border-border bg-card px-6 py-4", className)}>
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground leading-relaxed text-center justify-center">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <div>
          <p>
            EdgeHunter displays publicly available odds data for informational purposes only.
            We do not accept bets, handle funds, or facilitate gambling of any kind. All
            suggestions require manual execution by the user. Must be 18+ to use sportsbooks
            in jurisdictions where sports betting is legal. Please bet responsibly.
          </p>
          <p className="mt-1 font-semibold text-muted-foreground">
            Problem Gambling Helpline:{" "}
            <a href={TEL} className="underline hover:text-foreground">{PHONE}</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default GamblingDisclaimer;
