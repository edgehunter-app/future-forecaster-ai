# EdgeHunter UI Redesign Plan

Scope: **frontend / presentation only**. No changes to edge functions, Supabase queries, Stripe, auth, or Horse Racing page. All existing data hooks (`useBestBet`, `useSportsOdds`, `useSuggestionsDB`, `useAIAnalysis`, `useGameAnalysis`, etc.) stay as-is — we re-skin what consumes them.

---

## 1. Global color + token pass

Update `src/index.css` design tokens so the new palette is enforced through semantic classes (no hardcoded hex in components):

- `--background` → `#0a0b0f`
- `--card` → `#12141a`
- `--surface-2` (new) → `#1a1d26`
- `--border` → `rgba(255,255,255,0.07)`
- Confirm existing semantic tokens map to: primary/info `#3b82f6`, purple `#8b5cf6`, success `#10b981`, warning/amber `#f59e0b`, destructive `#ef4444`.
- Add gradient tokens: `--gradient-hero` (slate-900 → slate-800), `--gradient-cta` (blue), `--gradient-action-bar` (green).
- Add `--glow-blue: 0 0 40px rgba(59,130,246,0.12)`.
- Extend `tailwind.config.ts` to expose `surface2`, `purple`, gradient utilities, and a `rounded-2xl` default for card variants.
- Global padding bump: introduce a `.card-pad` utility (`p-5 sm:p-6`) — 25% more than current `p-4`.

Add new shared primitives:
- `src/components/ui/AICard.tsx` — wrapper with `border-l-2 border-purple-500` for any AI-generated block.
- `src/components/ui/StickyActionBar.tsx` — fixed bottom bar, 80px above tab bar, green gradient variant.
- Reuse existing `BottomSheet` for all mobile "page" transitions triggered from Discover/Search.

---

## 2. Flow 1 — Discover (Home)

Rebuild `src/pages/Dashboard.tsx` (route `/`) as the Discover screen.

Structure (top → bottom):

```text
┌─────────────────────────────────────┐
│ [Logo]                    [🔔•]     │  TopBar (existing, restyled)
├─────────────────────────────────────┤
│ ┌─ HERO CARD (60% above fold) ────┐ │
│ │ ⚡ Today's Best Edge      [NBA] │ │
│ │ Lakers vs Celtics               │ │
│ │ ┌ Lakers +4.5 · DraftKings ──┐  │ │
│ │ └────────────────────────────┘  │ │
│ │ Edge 4.2%   +185   Conf 78%     │ │
│ │ ▓▓▓▓▓▓▓▓░░ (progress)           │ │
│ │ [ Hunt This Edge → ]            │ │
│ │ Scanned 47 lines across 9 books │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Today's Signals                     │
│  ✅ Game A · Spread · +3.1% · DK    │
│  ⚠️ Game B · Total · +2.4% · FD     │
│  ...                                │
│                                     │
│ │🤖 AI pattern insight (1 line)    │ │  purple left border
└─────────────────────────────────────┘
```

Components:
- `HeroBestEdgeCard.tsx` — consumes `useBestBet()`. Dark gradient `from-slate-900 to-slate-800`, blue glow shadow, amber "⚡ Today's Best Edge" pill top-left, sport tag top-right. 22px bold matchup. Nested recommendation box (`bg-black/40 rounded-xl`). 3-column stat row (Edge green, Best Odds white, Confidence amber). Confidence bar (green fill). Full-width blue-gradient CTA with subtext showing scanned counts (from `useSportsOdds` totals).
- Tap → opens `BottomSheet` with `BestEdgeAnalysisSheet.tsx` — reuses existing `useAIAnalysis` output rendered as 4 labeled sections: **Why it has value / What could go wrong / Verdict / Supporting data**. Devil's Advocate block uses `border-l-2 border-destructive`. Drag handle + close button already in `BottomSheet`.
- `TodaySignalsList.tsx` — consumes `useSuggestionsDB` (or existing signals source). Each row: colored rounded square with verdict emoji (✅ green / ⚠️ amber), game, bet type, edge% (color-graded), book pill. Sorted by edge desc.
- `AIInsightStrip.tsx` — purple left border, 🤖 icon, one-sentence pattern text from existing analysis feed (fallback to static copy if none).

Fallback/loading states: skeleton hero, "No qualifying edge right now" empty state matching current `useBestBet` availability messaging.

---

## 3. Flow 2 — Search ("Check a Bet")

New route `/search` (added to `src/App.tsx`) backed by new `src/pages/CheckBet.tsx`.

Layout:
- Title "Check a Bet" + subtitle "Enter a team, game, or market".
- `SearchBox.tsx` — input with `focus:border-info` (blue) transition.
- On submit → inline result card renders **below the input** (no navigation, no modal).

`InlineBetResult.tsx` sections:
1. **Header** — matchup, sport · time · venue, "Your bet" row (bet + odds).
2. **Verdict banner** — full-width, `bg-success/15` / `bg-warning/15` / `bg-destructive/15`, verdict word + 1-sentence reason.
3. **Analysis trio** — 3 stacked `AICard`s:
   - Why it has value (green badge with edge %)
   - What could go wrong (amber badge with risk level)
   - Verdict (green badge: Investigate / Validate / Track / Ignore)
4. **Book comparison table** — ranked best→worst. Best row `bg-success/10` + "BEST" pill, worst row `bg-muted/40 text-muted-foreground`.

Data: reuse `useGameAnalysis` / `useAIAnalysis` for the analysis payload; search matching against `useAppStore().fullGames`. No backend changes.

`StickyActionBar` appears once a result is loaded: green gradient, "Bet at [Book] →" left, odds pill right, sits 80px above tab bar.

---

## 4. Tab bar

Update `src/components/layout/BottomTabBar.tsx`:

New 5 tabs (max):
1. Discover → `/`
2. Search → `/search`
3. Sports → `/sports`
4. Tracker → `/tracker`
5. Profile → `/settings` (or new `/profile` alias)

Rules:
- Inactive: icon only.
- Active: icon + label + accent underline.
- Racing stays reachable via **More** sheet (Racing must not be removed from the app per prior constraint — but per this redesign it moves out of the main bar; keep it in More).
- Line-alert count badge moves onto Tracker tab.

Desktop `Sidebar` mirrors the same 5 primary items with the rest under a collapsible "More" section — no functional loss.

---

## 5. Component-wide rules applied in this pass

- Every AI-generated card/section wrapped in `AICard` (purple left border).
- Analysis output always rendered as **4 structured sections** — refactor `GameAnalysisPanel`, `GolfAnalysisPanel`, `DevilsAdvocatePanel` consumers to fit the 4-section shape (keep existing data, restructure presentation).
- All cards: `rounded-2xl border border-white/5`, no hard 1px opaque borders.
- Padding: swap `p-3`/`p-4` → `p-4`/`p-5` (approx +25%) in touched components only.
- Bottom sheets replace push-navigation for: Best Edge details, Signal detail, Search result deep-dive.

---

## 6. Explicitly untouched

- `supabase/functions/**` — no edits.
- `src/hooks/**` data hooks — consumed as-is.
- Stripe (`create-checkout`, `billing-portal`, `stripe-webhook`, `useSubscription`).
- Auth (`useAuth`, `Auth.tsx`).
- Horse Racing (`src/pages/HorseRacing.tsx`, `fetch-horse-racing`) — untouched.
- `src/integrations/supabase/*` auto-generated files.

---

## Technical notes

- New files:
  - `src/pages/CheckBet.tsx`
  - `src/components/discover/HeroBestEdgeCard.tsx`
  - `src/components/discover/BestEdgeAnalysisSheet.tsx`
  - `src/components/discover/TodaySignalsList.tsx`
  - `src/components/discover/AIInsightStrip.tsx`
  - `src/components/search/SearchBox.tsx`
  - `src/components/search/InlineBetResult.tsx`
  - `src/components/ui/AICard.tsx`
  - `src/components/ui/StickyActionBar.tsx`
- Modified:
  - `src/index.css`, `tailwind.config.ts` (tokens + utilities)
  - `src/pages/Dashboard.tsx` (rebuilt as Discover)
  - `src/App.tsx` (add `/search` route)
  - `src/components/layout/BottomTabBar.tsx` + `Sidebar.tsx` (5-tab structure)
- Delivered in phases so each is independently verifiable:
  1. Tokens + shared primitives (`AICard`, `StickyActionBar`, updated tab bar).
  2. Discover page + hero + analysis sheet.
  3. Signals list + AI insight strip.
  4. Check-a-Bet page + inline result + sticky action bar.
  5. Typecheck + preview verification via Playwright screenshots at 402×717.

Confirm and I'll build phase-by-phase.
