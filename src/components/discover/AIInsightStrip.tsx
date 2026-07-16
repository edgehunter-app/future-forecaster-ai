interface Props {
  message: string;
}

export default function AIInsightStrip({ message }: Props) {
  return (
    <div className="rounded-2xl border border-white/5 border-l-2 border-l-purple bg-card px-4 py-3 flex items-start gap-3">
      <span className="text-[18px] leading-none shrink-0" aria-hidden>🤖</span>
      <p className="text-[13px] text-foreground/90 leading-snug">{message}</p>
    </div>
  );
}