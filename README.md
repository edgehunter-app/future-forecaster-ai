# EdgeHunter

> Stop guessing. Start hunting.
> AI-powered prediction market intelligence — track smart wallets, detect cross-market mispricings, get trade suggestions across Polymarket and Kalshi.

## Links
- Website: EdgeHunter.net
- X: @EdgeHunterHQ

## Features
- Live market data from Polymarket + Kalshi
- Claude AI-powered trade analysis
- Smart wallet tracking and scoring
- Cross-market arbitrage detection
- Mobile-first responsive design (PWA)
- Telegram + Discord alert integration
- Kelly criterion position sizing
- Suggestions only — no auto-trading

## Setup
1. Clone the repo
2. `cp .env.example .env`
3. Add your API keys to `.env`
4. `npm install`
5. `npm run dev`

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `ANTHROPIC_API_KEY` | Yes | Claude AI (backend secret) |

## Safety
EdgeHunter never executes trades automatically. All suggestions require manual verification and execution. Not financial advice.
