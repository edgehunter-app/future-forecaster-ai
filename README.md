# PolySignal

> Prediction market intelligence — track smart wallets, detect cross-market mispricings, get AI-powered trade suggestions across Polymarket and Kalshi.

## Features

- 📊 Live market data from Polymarket + Kalshi
- 🧠 Claude AI-powered trade analysis
- 👛 Smart wallet tracking and scoring
- 🔀 Cross-market arbitrage detection
- 📱 Mobile-first responsive design
- 🔔 Telegram + Discord alert integration
- ⚖️ Kelly criterion position sizing
- 🛡️ Suggestions only — no auto-trading

## Setup

1. Clone the repo
2. `cp .env.example .env`
3. Add your API keys to `.env`
4. `npm install`
5. `npm run dev`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | Yes | Claude AI analysis |
| `VITE_KALSHI_EMAIL` | Optional | Kalshi live data |
| `VITE_KALSHI_API_KEY` | Optional | Kalshi live data |
| `VITE_TELEGRAM_BOT_TOKEN` | Optional | Alert delivery |

## Architecture

```
src/
  components/    UI components
  pages/         Route pages
  hooks/         Data fetching hooks
  lib/           API clients + analysis engine
  store/         Zustand global state
  types/         TypeScript interfaces
  data/          Mock data fallbacks
```

## Safety

PolySignal never executes trades automatically. All suggestions require manual verification and execution. Not financial advice.

## Tech Stack

React 18 + TypeScript + Vite + Tailwind + Zustand
Lovable Cloud-ready (auth + persistence layer)