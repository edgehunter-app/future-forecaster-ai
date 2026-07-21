import BottomSheet from "@/components/ui/BottomSheet";
import BestBetCard from "@/components/sports/BestBetCard";
import type { BestBetResult } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  result: BestBetResult | null;
  onRescan: () => void;
  onClear: () => void;
}

/**
 * Shared full-analysis view for the canonical Best Bet. Wraps the same
 * BestBetCard rendered on the Sports page so Discover and Sports show an
 * identical pick, identical stake sizing, identical reasoning, and
 * identical Elite gating (Risk AI + Devil's Advocate). Tier is checked
 * inside BestBetCard via useSubscription() at render time — Discover
 * cannot bypass the paywall.
 */
export default function BestEdgeDetailSheet({
  open,
  onClose,
  result,
  onRescan,
  onClear,
}: Props) {
  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Best Edge">
      <div className="pb-6">
        {result ? (
          <BestBetCard result={result} onClear={onClear} onRescan={onRescan} />
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No pick available. Run a scan to find today's best edge.
          </div>
        )}
      </div>
    </BottomSheet>
  );
}