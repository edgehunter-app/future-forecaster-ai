import { useEffect, useState } from "react";
import {
  Bell, Calculator, Check, Info, Moon, Save, Sliders, Sun, TrendingUp,
} from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import Tooltip from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { useAppStore } from "@/store/useAppStore";
import { cn, fmtUSD } from "@/lib/utils";
import { MOCK_SUGGESTIONS } from "@/data/mockData";

const KELLY_PRESETS = [
  { label: "1/10 Kelly", value: 0.10, hint: "Safest" },
  { label: "1/4 Kelly", value: 0.25, hint: "Recommended", highlight: true },
  { label: "1/2 Kelly", value: 0.50, hint: "Moderate" },
  { label: "Full Kelly", value: 1.00, hint: "Aggressive" },
];

const ALL_CATEGORIES = ["Economics", "Crypto", "Science", "Finance", "Politics", "Sports", "Entertainment"];

const SCAN_OPTS = [
  { v: "15m", label: "15 minutes" },
  { v: "30m", label: "30 minutes" },
  { v: "1h", label: "1 hour" },
  { v: "manual", label: "Manual only" },
];

export default function Settings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const updateAlerts = useAppStore((s) => s.updateAlerts);
  const darkMode = useAppStore((s) => s.ui.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const { showToast } = useToast();

  const [saved, setSaved] = useState(false);
  useEffect(() => { if (saved) { const t = setTimeout(() => setSaved(false), 2000); return () => clearTimeout(t); } }, [saved]);

  const onSave = () => {
    setSaved(true);
    showToast("Settings saved", "success");
  };

  const maxPosUSD = settings.bankroll * settings.maxPosition;
  const maxPosPct = Math.round(settings.maxPosition * 100);
  const maxPosColor =
    maxPosPct <= 5 ? "text-success" : maxPosPct <= 10 ? "text-warning" : "text-destructive";

  const passing = MOCK_SUGGESTIONS.filter((s) => s.confidence >= settings.minConfidence).length;

  const scenarios = [
    { name: "Strong signal", edge: 0.15, odds: 0.40 },
    { name: "Medium signal", edge: 0.08, odds: 0.50 },
    { name: "Weak signal", edge: 0.04, odds: 0.50 },
  ].map((sc) => {
    const kelly = (sc.edge * settings.bankroll) / sc.odds;
    const sized = kelly * settings.kellyMultiplier;
    const final = Math.min(sized, maxPosUSD);
    return { ...sc, kelly, final };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your risk profile and alert preferences</p>
        </div>
        <button
          onClick={onSave}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors",
            saved ? "bg-success" : "bg-info hover:bg-info/90 shadow-glow-blue",
          )}
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* LEFT 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Risk Profile */}
          <Card>
            <CardHeader icon={TrendingUp} title="Risk Profile" />

            {/* Bankroll */}
            <Field label="Bankroll" tooltip="Your total prediction market capital across all positions">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                <input
                  type="number"
                  value={settings.bankroll}
                  onChange={(e) => updateSettings({ bankroll: Number(e.target.value) || 0 })}
                  className="w-full rounded-md border border-border bg-background pl-7 pr-3 py-2 font-mono text-lg font-semibold text-foreground focus:border-info focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Available capital: <span className="font-mono text-foreground">{fmtUSD(settings.bankroll * 0.85)}</span>
              </p>
            </Field>

            {/* Kelly */}
            <Field label="Kelly Multiplier" tooltip="Controls how aggressively to size positions. Lower = safer, higher = more aggressive.">
              <input
                type="number"
                step={0.05} min={0.1} max={1.0}
                value={settings.kellyMultiplier}
                onChange={(e) => updateSettings({ kellyMultiplier: Math.max(0.1, Math.min(1, Number(e.target.value) || 0.1)) })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-foreground focus:border-info focus:outline-none"
              />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {KELLY_PRESETS.map((p) => {
                  const active = Math.abs(settings.kellyMultiplier - p.value) < 0.001;
                  return (
                    <button
                      key={p.value}
                      onClick={() => updateSettings({ kellyMultiplier: p.value })}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                        active
                          ? "border-info bg-info/15 text-info"
                          : p.highlight
                            ? "border-info/40 bg-info/5 text-info hover:bg-info/10"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                      <span className="block text-[10px] font-normal opacity-70">{p.hint}</span>
                    </button>
                  );
                })}
              </div>
              {settings.kellyMultiplier >= 0.99 && (
                <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  ⚠️ Full Kelly is mathematically optimal but causes extreme variance. Most professionals use 1/4 to 1/2 Kelly.
                </div>
              )}
            </Field>

            {/* Max position */}
            <Field label="Max Position Size" tooltip="Maximum percentage of bankroll in any single trade">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={20} step={1}
                  value={maxPosPct}
                  onChange={(e) => updateSettings({ maxPosition: Number(e.target.value) / 100 })}
                  className="flex-1 accent-info"
                />
                <span className={cn("font-mono font-bold w-12 text-right", maxPosColor)}>{maxPosPct}%</span>
              </div>
              <p className={cn("mt-1 text-xs font-mono", maxPosColor)}>= {fmtUSD(maxPosUSD)} per trade max</p>
            </Field>

            {/* Min confidence */}
            <Field label="Minimum Confidence Score">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={40} max={95} step={5}
                  value={settings.minConfidence}
                  onChange={(e) => updateSettings({ minConfidence: Number(e.target.value) })}
                  className="flex-1 accent-info"
                />
                <span className="font-mono font-bold text-info w-12 text-right">{settings.minConfidence}%</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Only show suggestions scoring {settings.minConfidence}% or above ·{" "}
                <span className="font-mono text-foreground">{passing} of {MOCK_SUGGESTIONS.length}</span> would be shown
              </p>
            </Field>
          </Card>

          {/* Position Sizing Preview */}
          <Card>
            <CardHeader icon={Calculator} title="Position Sizing Preview" />
            <p className="text-xs text-muted-foreground -mt-2 mb-3">How your settings affect suggested positions</p>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-card/60">
                  <tr>
                    {["Scenario", "Edge", "Kelly Calc", "Your Size"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((sc) => (
                    <tr key={sc.name} className="border-t border-border/60">
                      <td className="px-3 py-2 text-foreground">{sc.name}</td>
                      <td className="px-3 py-2 font-mono text-success">{(sc.edge * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{fmtUSD(sc.kelly)}</td>
                      <td className="px-3 py-2 font-mono font-bold text-info">{fmtUSD(sc.final)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{`Suggested = min(
  (edge × bankroll) / odds × kellyMultiplier,
  bankroll × maxPosition%
)`}</pre>
          </Card>
        </div>

        {/* RIGHT 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* Alerts */}
          <Card>
            <CardHeader icon={Bell} title="Alert Channels" />

            <ChannelSection
              name="Telegram"
              enabled={settings.alerts.telegram.enabled}
              onToggle={(v) => updateAlerts("telegram", { enabled: v })}
              helper="Get your chat ID from @userinfobot on Telegram"
              onTest={() => showToast("✓ Telegram test sent", "success")}
            >
              <input
                value={settings.alerts.telegram.chatId}
                onChange={(e) => updateAlerts("telegram", { chatId: e.target.value })}
                placeholder="Chat ID"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-info focus:outline-none"
              />
            </ChannelSection>

            <ChannelSection
              name="Discord"
              enabled={settings.alerts.discord.enabled}
              onToggle={(v) => updateAlerts("discord", { enabled: v })}
              helper="Create a webhook in your Discord channel settings"
              onTest={() => showToast("✓ Discord test sent", "success")}
            >
              <input
                value={settings.alerts.discord.webhookUrl}
                onChange={(e) => updateAlerts("discord", { webhookUrl: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-info focus:outline-none"
              />
            </ChannelSection>

            <ChannelSection
              name="Email"
              enabled={settings.alerts.email.enabled}
              onToggle={(v) => updateAlerts("email", { enabled: v })}
              onTest={() => showToast("✓ Email test sent", "success")}
            >
              <input
                value={settings.alerts.email.address}
                onChange={(e) => updateAlerts("email", { address: e.target.value })}
                placeholder="you@example.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-info focus:outline-none"
              />
              <select
                value={settings.alerts.email.frequency}
                onChange={(e) => updateAlerts("email", { frequency: e.target.value })}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-info focus:outline-none"
              >
                <option>Every suggestion</option>
                <option>Hourly digest</option>
                <option>Daily digest</option>
              </select>
            </ChannelSection>

            <Field label="Alert Threshold">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={50} max={95} step={5}
                  value={settings.alertThreshold}
                  onChange={(e) => updateSettings({ alertThreshold: Number(e.target.value) })}
                  className="flex-1 accent-info"
                />
                <span className="font-mono font-bold text-info w-12 text-right">{settings.alertThreshold}%</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Only alert when confidence ≥ {settings.alertThreshold}%</p>
            </Field>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader icon={Sliders} title="Preferences" />

            <Field label="Interface Theme">
              <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background p-1">
                <ThemeBtn active={darkMode} onClick={() => setDarkMode(true)} icon={Moon} label="Dark" />
                <ThemeBtn active={!darkMode} onClick={() => setDarkMode(false)} icon={Sun} label="Light" />
              </div>
            </Field>

            <Field label="Favorite Categories">
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((c) => {
                  const sel = settings.favoriteCategories.includes(c);
                  return (
                    <button key={c}
                      onClick={() => {
                        const next = sel
                          ? settings.favoriteCategories.filter((x) => x !== c)
                          : [...settings.favoriteCategories, c];
                        updateSettings({ favoriteCategories: next });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                        sel ? "border-info bg-info text-white"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}>{c}</button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Suggestions from these categories are shown first</p>
            </Field>

            <Field label="Auto-scan interval">
              <select
                value={settings.scanInterval}
                onChange={(e) => updateSettings({ scanInterval: e.target.value as SettingsScanInterval })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-info focus:outline-none"
              >
                {SCAN_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">How often to check for new opportunities</p>
            </Field>

            <div className="space-y-3 pt-1">
              <ToggleRow
                label="Show position sizing details"
                enabled={settings.showPositionDetails}
                onChange={(v) => updateSettings({ showPositionDetails: v })}
              />
              <ToggleRow
                label="Show wallet addresses"
                enabled={settings.showWalletAddresses}
                onChange={(v) => updateSettings({ showWalletAddresses: v })}
              />
              <ToggleRow
                label="Compact suggestion cards"
                enabled={settings.compactCards}
                onChange={(v) => updateSettings({ compactCards: v })}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

type SettingsScanInterval = "15m" | "30m" | "1h" | "manual";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5 shadow-card space-y-4">{children}</div>;
}

function CardHeader({ icon: Icon, title }: { icon: typeof Bell; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-info" />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

function ChannelSection({ name, enabled, onToggle, helper, onTest, children }: {
  name: string; enabled: boolean; onToggle: (v: boolean) => void;
  helper?: string; onTest: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        <Toggle enabled={enabled} onChange={onToggle} size="sm" />
      </div>
      {enabled && (
        <div className="mt-3 space-y-2">
          {children}
          <div className="flex items-center justify-between gap-3">
            {helper && <p className="text-[11px] text-muted-foreground flex-1">{helper}</p>}
            <button onClick={onTest}
              className="rounded-md border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] font-semibold text-info hover:bg-info/20 transition-colors">
              Test Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Moon; label: string }) {
  return (
    <button onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-info text-white" : "text-muted-foreground hover:text-foreground",
      )}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <Toggle enabled={enabled} onChange={onChange} size="sm" />
    </div>
  );
}
