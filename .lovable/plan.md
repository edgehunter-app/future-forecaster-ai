## Goal

Add Claude-powered analysis to every market type EdgeHunter supports (Polymarket, Kalshi, sports games, player props, cross-market gaps, wallet strategies), plus a Daily Briefing and a Markets Sentiment panel. All free, all with safety disclaimers.

This is a large change — ~20 new/edited files, one redeployed edge function, and a Zustand store addition. I'll build it in 8 parts following your spec.

## Part 8 first — Shared infrastructure (built first, used by all parts)

1. **`supabase/functions/analyze-market/index.ts`** — Add 7 new prompt builders (`buildKalshiPrompt`, `buildPropPrompt`, `buildCrossMarketPrompt`, `buildDailyBriefingPrompt`, `buildSentimentPrompt`, `buildWalletStrategyPrompt`) plus the existing market + sports. Switch routes on `body.type`. Same Anthropic call, same error handling, same safety caps. Redeploy.

2. **`src/hooks/useAIAnalysis.ts`** — Universal analysis hook keyed by string ID. Per-key `analyzing/results/errors`. Auto-injects wallets, bankroll, kelly, max position. Applies safety caps. Replaces `useGameAnalysis` everywhere.

3. **`src/components/ui/AnalysisResultPanel.tsx`** — Universal result panel. Type-switched layout (market / sports / kalshi / prop / cross-market / wallet-strategy / daily-briefing). Confidence bar, reasoning, key signals, type-specific safety disclaimer at bottom. Optional `compact` mode for prop list. Optional `onSave` button.

## Part 1 — Kalshi + Polymarket Markets page

4. **`src/components/markets/MarketRow.tsx`** — Add purple "Analyze" button (right side desktop, below prices mobile). Inline expandable result panel. Detects Kalshi vs Polymarket via `market.source` and sends `type: "kalshi"` or `"market"`. Looks up matching cross-platform price for the gap signal.

## Part 2 — Player Props

5. **`src/components/sports/PlayerPropsPanel.tsx`** (or PropRow) — Compact "Get AI Tip" button per prop, inline compact result. Best book highlight + line shopping tip.

6. **`src/components/sports/BestPropsToday.tsx`** — New section on Sports page. Reads from a shared in-memory prop-results store (or via the useAIAnalysis result map exposed via context). Top 5 by confidence.

## Part 3 — Cross-Market

7. **`src/pages/CrossMarket.tsx`** — Replace existing analyze button with new `type: "cross-market"` flow. Show favored platform, why gap exists, expected resolution.

## Part 4 — Daily Briefing

8. **`src/store/useAppStore.ts`** — Add `dailyBriefing`, `briefingDate`, `setBriefing`.

9. **`src/components/dashboard/DailyBriefing.tsx`** — New component on Dashboard. Auto-generates once per day (localStorage `eh_briefing_date`). Top 3 tips with rank/urgency badges, watch list, risk warning.

10. **`src/pages/Dashboard.tsx`** — Mount `DailyBriefing` near top.

## Part 5 — Markets sentiment

11. **`src/components/markets/SentimentPanel.tsx`** — Top of Markets page. Sentiment meter (-100 to +100), dominant theme pills, smart-money focus, unusual activity, top 2 watch markets. Once-per-session cache in Zustand.

12. **`src/store/useAppStore.ts`** — Add `marketSentiment`, `sentimentTimestamp`.

13. **`src/pages/Markets.tsx`** — Mount `SentimentPanel` at top.

## Part 6 — Wallet strategy

14. **`src/components/wallets/WalletCard.tsx`** — Add "Analyze Trading Strategy" ghost button under metrics. On click fetches positions+activity then calls `type: "wallet-strategy"`. Shows trader-type badge, follow recommendation (YES/PARTIAL/NO), positions take, key insights, watch signals.

## Part 7 — Aggregation

15. **`src/pages/Suggestions.tsx`** — Add source filter tabs (All / Prediction / Sports / Props / Cross-Market). Source badges on cards. Sort by source / urgency / expiry.

16. **DB note** — `suggestions` table already supports arbitrary `category` and `key_signals`. I'll store source in `category` prefix (e.g. `kalshi:Politics`) so no migration needed; UI parses it.

17. **`AnalysisResultPanel`** — `Save to My Suggestions` button on every panel. Green if confidence ≥ threshold, gray "Save anyway" otherwise. Saved → "Saved ✓" disabled.

## Safety disclaimers (Part 8 #20)

`SafetyBanner` extended (or wrapped) with type-specific text:
- prediction: existing copy
- sports/prop: + "Must be 18+ … 1-800-522-4700"
- cross-market: combined
- wallet-strategy: "Past performance does not guarantee future results."

Always rendered, never hidden.

## Migration / cleanup

- `useGameAnalysis` deleted; `OddsBoard` and any other caller switched to `useAIAnalysis` with key = `game.id`.
- `GameAnalysisPanel` deleted; replaced by `AnalysisResultPanel` with `type="sports"`.
- `analysisCounter`: extended to bump per-type counters; Admin page reads them.

## Out of scope

- No paywall, no auth changes.
- No new DB columns (uses existing `suggestions` table).
- No real-time streaming — all analyze calls are non-streaming `supabase.functions.invoke`.
- I won't refactor existing market/sports prompt text — only add new types alongside.

## Risks / notes

- The edge function currently returns parsed JSON directly (per `useGameAnalysis`). I'll keep that contract — `useAIAnalysis` reads `data` as the parsed object, not raw Anthropic content blocks. Your spec #18 shows `data.content[].text` parsing; I'll match the **existing** edge-function contract to avoid breaking what works, and document it inline.
- Daily Briefing & Sentiment are heavy single calls — gated behind explicit user button + once-per-day/session cache to protect Anthropic credits.
- Props "Best Today" needs a shared store of analyzed-prop results; I'll lift `useAIAnalysis`'s result map for props into Zustand so the section persists across game expansions.

After approval I'll implement all 8 parts in one pass and verify the build.