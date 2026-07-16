import { ArrowRight } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import AICard from "@/components/ui/AICard";
import type { BestBetResult } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  result: BestBetResult | null;
}

export default function BestEdgeAnalysisSheet({ open, onClose, result }: Props) {
  const analysis = result?.analysis;
  const prediction = result?.prediction;
  const wallet = result?.wallet;

  const reasoning =
    analysis?.reasoning ?? prediction?.reasoning ?? wallet?.reasoning ?? "No analysis available.";
  const keyFactors =
    analysis?.keyFactors ?? prediction?.keyFactors ?? wallet?.keyFactors ?? [];
  const warnings = analysis?.warningFlags ?? [];
  const edge =
    (analysis?.edge ?? prediction?.edge ?? wallet?.edge ?? 0) * 100;
  const confidence =
    analysis?.confidence ?? prediction?.confidence ?? wallet?.confidence ?? 0;
  const risk = analysis?.riskLevel ?? prediction?.riskLevel ?? wallet?.riskLevel ?? "medium";

  const verdict =
    confidence >= 65 ? "STRONG EDGE" : confidence >= 50 ? "PROCEED WITH CAUTION" : "SKIP";
  const verdictReason =
    confidence >= 65
      ? `${edge.toFixed(1)}% edge with ${confidence}% confidence — worth a shot at recommended stake.`
      : confidence >= 50
        ? `Edge exists but confidence is only ${confidence}%. Consider a smaller stake.`
        : `Signal too weak (${confidence}% confidence). Wait for a better spot.`;

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Edge Analysis">
      <div className="space-y-4 pb-4">
        {/* Why it has value */}
        <AICard>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground">
              Why it has value
            </h4>
            <span className="rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-[10px] font-bold text-success">
              +{edge.toFixed(1)}% EDGE
            </span>
          </div>
          <p className="text-[13px] text-foreground/90 leading-relaxed">{reasoning}</p>
        </AICard>

        {/* What could go wrong */}
        <AICard tone="danger">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground">
              What could go wrong
            </h4>
            <span className="rounded-full bg-warning/15 border border-warning/30 px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
              {risk} risk
            </span>
          </div>
          {warnings.length > 0 ? (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/85">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-foreground/80 leading-relaxed">
              Line could move against you before kickoff. Market may already reflect the news
              that created this gap.
            </p>
          )}
        </AICard>

        {/* Verdict */}
        <AICard>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground">
              Verdict
            </h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                confidence >= 65
                  ? "bg-success/15 border border-success/30 text-success"
                  : confidence >= 50
                    ? "bg-warning/15 border border-warning/30 text-warning"
                    : "bg-destructive/15 border border-destructive/30 text-destructive"
              }`}
            >
              {verdict}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-foreground/95 leading-snug">
            {verdictReason}
          </p>
        </AICard>

        {/* Supporting data */}
        <AICard>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-foreground mb-3">
            Supporting data
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Metric label="Confidence" value={`${confidence}%`} />
            <Metric label="Edge" value={`${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`} />
          </div>
          {keyFactors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keyFactors.map((f, i) => (
                <span
                  key={i}
                  className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </AICard>

        <button
          onClick={onClose}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-cta px-5 py-3.5 text-sm font-bold text-white shadow-glow-blue"
        >
          Got it <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </BottomSheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/60 border border-white/5 px-3 py-2">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-extrabold font-mono text-foreground">{value}</div>
    </div>
  );
}