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

const SPORTS = ["NFL", "NBA", "MLB", "NHL", "EPL", "MLS", "Polymarket", "Kalshi", "Other"];
const BET_TYPES = ["Moneyline", "Spread", "Over/Under", "Prop", "Parlay", "Futures", "Other"];
const BOOKS = [
  "DraftKings", "FanDuel", "BetMGM", "BetRivers", "ESPN Bet", "Caesars",
  "Polymarket", "Kalshi", "Prophet X", "Other",
];

export interface LogBetModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (bet: NewBetInput) => Promise<void> | void;
  initial?: Partial<NewBetInput>;
}

export default function LogBetModal({ open, onClose, onSubmit, initial }: LogBetModalProps) {
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
    setSport(initial?.sport ?? "NFL");
    setBetType(initial?.bet_type ?? "Moneyline");
    setPick(initial?.pick ?? "");
    setOddsStr(initial?.odds != null ? String(initial.odds) : "-110");
    setAmountStr(initial?.amount != null ? String(initial.amount) : "");
    setSportsbook(initial?.sportsbook ?? "DraftKings");
    setGameDate(initial?.game_date ? initial.game_date.slice(0, 10) : "");
    setNotes(initial?.notes ?? "");
    setSuggestionId(initial?.suggestion_id ?? null);
  }, [open, initial]);

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
        game_date: gameDate ? new Date(gameDate).toISOString() : null,
        notes: notes.trim() || null,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Log a bet</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          <Label htmlFor="bet-title">Title</Label>
          <Input id="bet-title" placeholder="e.g. Yankees ML, Chiefs -3.5"
                 value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Sport</Label>
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPORTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Bet type</Label>
            <Select value={betType} onValueChange={setBetType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BET_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="bet-pick">Your pick</Label>
          <Input id="bet-pick" placeholder="e.g. Yankees, Over 214.5"
                 value={pick} onChange={(e) => setPick(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="bet-odds">Odds (American)</Label>
            <Input id="bet-odds" inputMode="numeric" placeholder="-110"
                   value={oddsStr} onChange={(e) => setOddsStr(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              {odds ? `${odds > 0 ? "+" : ""}${odds} → ${(implied * 100).toFixed(1)}% implied` : "Enter American odds"}
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
          <div className="space-y-1">
            <Label>Sportsbook</Label>
            <Select value={sportsbook} onValueChange={setSportsbook}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOKS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bet-date">Game date</Label>
            <Input id="bet-date" type="date"
                   value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="bet-notes">Notes (optional)</Label>
          <Textarea id="bet-notes" rows={3} placeholder="Reasoning, injuries, etc."
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

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
      </div>
    </div>
  );
}