import SafetyBanner from "@/components/ui/SafetyBanner";
const Wallets = () => (
  <div className="space-y-6">
    <SafetyBanner />
    <div className="flex min-h-[60vh] items-center justify-center rounded-lg border border-dashed border-border bg-card/40">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">Wallets coming soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">This area of PolySignal is in progress.</p>
      </div>
    </div>
  </div>
);
export default Wallets;
