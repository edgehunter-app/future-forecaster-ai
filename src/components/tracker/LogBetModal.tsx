import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { americanToImplied, americanPayout } from "@/lib/betMath";
import type { NewBetInput } from "@/hooks/useBetTracker";
import { cn } from "@/lib/utils";

const SPORTS = ["NFL", "CFB", "NBA", "MLB", "NHL", "EPL", "MLS", "Golf", "Tennis", "Horse Racing", "MMA", "UFC", "Polymarket", "Kalshi", "Other"];
const BET_TYPES = ["Moneyline", "Spread", "Over/Under", "Prop", "Parlay", "Futures", "Other"];
const RACING_BET_TYPES = ["Win", "Place", "Show", "Across the Board", "Exacta", "Trifecta", "Superfecta", "Daily Double", "Pick 3", "Pick 4", "Other"];
const BOOKS = [
  "DraftKings", "FanDuel", "BetMGM", "BetRivers", "ESPN Bet", "Caesars",
  "Polymarket", "Kalshi", "Prophet X", "Other",
];
const RACING_BOOKS = ["TwinSpires", "TVG / FanDuel Racing", "DK Horse", "NYRA Bets", "AmWager", "At the track", "Other"];

export interface RacingRunnerOption { number: number; name: string }

export interface LogBetModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (bet: NewBetInput) => Promise<unknown> | unknown;
  initial?: Partial<NewBetInput>;
  /** Horse-racing mode: racing bet types, runner picker, manual odds. */
  racing?: { runners: RacingRunnerOption[]; context: string; defaultRunner?: number };
}

export default function LogBetModal({ open, onClose, onSubmit, initial, racing }: LogBetModalProps) {
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("NFL");
  const [betType, setBetType] = useState("Moneyline");
  const [pick, setPick] = useState("");
  const [oddsStr, setOddsStr] = useState("-110");
  const [amountStr, setAmountStr] = useState("");
  const [sportsbook, setSportsbook] = useState("DraftKings");
  const [gameDate, setGameDate] = useState("");
  const [notes, setNotes] = useState("");
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setSport(racing ? "Horse Racing" : initial?.sport ?? "NFL");
    setBetType(initial?.bet_type ?? (racing ? "Win" : "Moneyline"));
    if (racing && !initial?.pick && racing.defaultRunner != null) {
      const r = racing.runners.find((x) => x.number === racing.defaultRunner);
      setPick(r ? `#${r.number} ${r.name}` : "");
    } else setPick(initial?.pick ?? "");
    setOddsStr(racing ? "" : initial?.odds != null ? String(initial.odds) : "-110");
    setAmountStr(initial?.amount != null ? String(initial.amount) : "");
    setSportsbook(initial?.sportsbook ?? (racing ? "TwinSpires" : "DraftKings"));
    setGameDate(initial?.game_date ? initial.game_date.slice(0, 10) : "");
    setNotes(initial?.notes ?? "");
    setSuggestionId(initial?.suggestion_id ?? null);
  }, [open, initial, racing]);

  const odds = Number(oddsStr) || 0;
  const amount = Number(amountStr) || 0;
  const implied = useMemo(() => americanToImplied(odds), [odds]);
  const payout = useMemo(() => americanPayout(odds, amount), [odds, amount]);
  const profit = payout - amount;

  const canSubmit = title.trim() && pick.trim() && odds !== 0 && amount > 0 && !submitting;

  const handle = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        sport, bet_type: betType,
        pick: pick.trim(),
        odds, amount,
        sportsbook,
        suggestion_id: suggestionId,
        game_date: gameDate ? new Date(gameDate).toISOString() : (initial?.game_date ?? null),
        notes: notes.trim() || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  const types = racing ? RACING_BET_TYPES : BET_TYPES;
  const books = racing ? RACING_BOOKS : BOOKS;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">{racing ? "Log a race bet" : "Log a bet"}</h2>
          <button onClick={onClose} aria-label="Close" className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {racing && (
          <p className="text-xs text-muted-foreground">
            Record a bet you placed elsewhere. EdgeHunter doesn't take wagers.
            <span className="mt-1 block text-foreground/80">{racing.context}</span>
          </p>
        )}

        <div className="space-y-1">
          <Label htmlFor="bet-title">Title</Label>
          <Input id="bet-title" placeholder={racing ? "e.g. Belmont R1" : "e.g. Yankees ML, Chiefs -3.5"}
                 value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!racing && (
            <div className="space-y-1">
              <Label>Sport</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={cn("space-y-1", racing && "col-span-2")}>
            <Label>Bet type</Label>
            <Select value={betType} onValueChange={setBetType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {types.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="bet-pick">{racing ? "Horse(s)" : "Your pick"}</Label>
          {racing && (
            <Select
              value={(() => {
                const m = pick.match(/^#(\d+)\s/);
                return m && !pick.includes(" / ") && racing.runners.some((r) => String(r.number) === m[1]) ? m[1] : "";
              })()}
              onValueChange={(v) => {
                const r = racing.runners.find((x) => String(x.number) === v);
                if (!r) return;
                const tag = `#${r.number} ${r.name}`;
                const multi = !["Win", "Place", "Show", "Across the Board"].includes(betType);
                setPick((p) => (multi && p.trim() ? `${p} / ${tag}` : tag));
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choose a horse from this race" /></SelectTrigger>
              <SelectContent>
                {racing.runners.map((r) => (
                  <SelectItem key={r.number} value={String(r.number)}>#{r.number} {r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input id="bet-pick" placeholder={racing ? "e.g. #9 Pleasant Embrace / #1 Meg's Foxy Grey" : "e.g. Yankees, Over 214.5"}
                 value={pick} onChange={(e) => setPick(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="bet-odds">Odds (American)</Label>
            <Input id="bet-odds" inputMode="numeric" placeholder={racing ? "e.g. +450" : "-110"}
                   value={oddsStr} onChange={(e) => setOddsStr(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              {racing && !odds
                ? "Enter the odds you actually got — we don't have live tote odds."
                : odds ? `${odds > 0 ? "+" : ""}${odds} → ${(implied * 100).toFixed(1)}% implied` : "Enter American odds"}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bet-amount">Amount ($)</Label>
            <Input id="bet-amount" inputMode="decimal" placeholder="100"
                   value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              {amount > 0 && odds
                ? `$${amount.toFixed(2)} to win $${profit.toFixed(2)} (payout $${payout.toFixed(2)})`
                : "Stake to risk"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={cn("space-y-1", racing && "col-span-2")}>
            <Label>{racing ? "Where you bet" : "Sportsbook"}</Label>
            <Select value={sportsbook} onValueChange={setSportsbook}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {books.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!racing && (
            <div className="space-y-1">
              <Label htmlFor="bet-date">Game date</Label>
              <Input id="bet-date" type="date"
                     value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="bet-notes">Notes (optional)</Label>
          <Textarea id="bet-notes" rows={3} placeholder="Reasoning, injuries, etc."
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {racing && (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            You'll settle this bet yourself in the Bet Tracker (Won / Lost / Push). We don't have a live race results feed yet, so it won't grade automatically.
          </p>
        )}

        {suggestionId && (
          <div className="rounded-md border border-purple/30 bg-purple/10 px-3 py-2 text-[11px] text-purple">
            Linked to EdgeHunter suggestion
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={!canSubmit}
                  className={cn(!canSubmit && "opacity-60")}>
            {submitting ? "Saving…" : "Log Bet"}
          </Button>
        </div>
        {racing && (
          <p className="text-center text-[10px] text-muted-foreground">
            18+ | Gamble responsibly | <a href="tel:18005224700" className="underline">1-800-522-4700</a>
          </p>
        )}
      </div>
    </div>
  );
}
