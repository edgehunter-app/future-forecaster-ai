const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// deno-lint-ignore no-explicit-any
type Any = any;
interface AnalyzeBody {
  ping?: boolean;
  type?: string;
  [k: string]: Any;
}

function buildPrompt(b: AnalyzeBody): string {
  const m = b.market;
  const wallets = b.wallets ?? [];
  const bankroll = b.bankroll ?? 1000;
  const kelly = b.kellyMultiplier ?? 0.25;
  const maxPct = b.maxPositionPct ?? 5;
  const xm = b.crossMarketData;
  const walletGuidance = wallets.length === 0
    ? `\nNOTE: No smart wallet data available for this analysis. Base your assessment solely on:\n1. Market pricing vs fundamental probability\n2. Volume and momentum signals\n3. Time to resolution and liquidity\nAdjust confidence down by 10-15 points to reflect the absence of wallet signals.\n`
    : `\nSmart wallet signals are the primary driver. Weight them heavily in your confidence score.\n3+ S/A tier wallets on same side = +25 confidence\n1-2 S/A tier wallets = +15 confidence\n`;
  return `You are a quantitative prediction market analyst.

MARKET: "${m.question}"
Category: ${m.category ?? "Unknown"}
Platform: ${m.source ?? "Polymarket"}

CURRENT PRICING:
- YES: ${(m.yesPrice * 100).toFixed(1)}%
- NO: ${(m.noPrice * 100).toFixed(1)}%
- 24h Volume: $${(m.volume24h ?? 0).toLocaleString()}
- 24h Change: ${((m.change24h ?? 0) * 100).toFixed(1)}%

SMART WALLET SIGNALS:
${wallets.map((w: Any) => `- ${w.label}: ${(w.winRate * 100).toFixed(0)}% win, Sharpe ${w.sharpe}, Tier ${w.tier}`).join("\n") || "- (none)"}
${walletGuidance}
${xm ? `
CROSS-MARKET DATA:
- Kalshi YES: ${(xm.kalshiYes * 100).toFixed(1)}%
- Spread: ${(xm.spread * 100).toFixed(1)}%
- Favored platform: ${xm.favoredPlatform ?? "n/a"}
` : ""}
USER RISK PROFILE:
- Bankroll: $${bankroll}
- Kelly multiplier: ${kelly}x
- Max position: ${maxPct}% = $${((bankroll * maxPct) / 100).toFixed(0)}

Respond with ONLY valid JSON, no markdown:
{
  "direction": "YES" | "NO",
  "confidence": integer 0-100,
  "edge": decimal 0-0.5,
  "suggestedAmount": integer dollars,
  "reasoning": "2-3 sentences",
  "riskLevel": "low" | "medium" | "high",
  "keySignals": ["s1","s2","s3"],
  "crossMarketEdge": "one sentence or null"
}

IMPORTANT: ALWAYS return the best available tip given the data — do not
refuse just because the edge is small. Even a 2-3% mispricing is worth
surfacing. Pick the side (YES or NO) with better expected value relative
to current pricing. Use low confidence (30-50) and low edge (0.02-0.05)
for weak signals and set riskLevel to "high", but still return a
direction. Never return null, an empty object, or refuse to answer.
Users want to know WHERE the edge is, not just whether to bet.`;
}

function buildSportsPrompt(p: AnalyzeBody): string {
  const wallets = p.wallets ?? [];
  const bankroll = p.bankroll ?? 1000;
  const kelly = p.kellyMultiplier ?? 0.25;
  const maxPct = p.maxPositionPct ?? 5;
  const polyBlock = p.polymarketGap
    ? `
PREDICTION MARKET SIGNAL:
Polymarket is pricing this event differently:
  Polymarket implied: ${(p.polymarketGap.polyImplied * 100).toFixed(1)}%
  Gap vs Vegas: ${(p.polymarketGap.gap * 100).toFixed(1)}%
This suggests potential mispricing between markets.
`
    : "No Polymarket market found for this game.";
  const fmtCents = (book: Any) => {
    if (!book) return null;
    const homeGap = (typeof book.vegasHome === "number") ? book.home - book.vegasHome : null;
    const awayGap = (typeof book.vegasAway === "number") ? book.away - book.vegasAway : null;
    return { homeGap, awayGap };
  };
  const kalshiBlock = p.kalshi
    ? (() => {
        const g = fmtCents(p.kalshi);
        return `
KALSHI (CFTC regulated prediction market):
  Home: ${p.kalshi.home} American${g?.homeGap !== null ? ` (gap vs Vegas: ${g!.homeGap! > 0 ? "+" : ""}${g!.homeGap} cents)` : ""}
  Away: ${p.kalshi.away} American${g?.awayGap !== null ? ` (gap vs Vegas: ${g!.awayGap! > 0 ? "+" : ""}${g!.awayGap} cents)` : ""}
Kalshi is sharp regulated money — significant gaps are a strong signal.
`;
      })()
    : "No Kalshi market found for this game.";
  const polymarketBlock = p.polymarket
    ? (() => {
        const g = fmtCents(p.polymarket);
        return `
POLYMARKET (offshore prediction market):
  Home: ${p.polymarket.home} American${g?.homeGap !== null ? ` (gap vs Vegas: ${g!.homeGap! > 0 ? "+" : ""}${g!.homeGap} cents)` : ""}
  Away: ${p.polymarket.away} American${g?.awayGap !== null ? ` (gap vs Vegas: ${g!.awayGap! > 0 ? "+" : ""}${g!.awayGap} cents)` : ""}
Polymarket is offshore retail — gaps are relevant but less regulated.
`;
      })()
    : "No Polymarket market found for this game.";
  const allBooks: Any[] = Array.isArray(p.bookmakers) ? p.bookmakers : [];
  const vegasBooks = allBooks.filter(
    (b) => b?.category !== "prediction_market" && (b?.moneyline?.home || b?.moneyline?.away),
  );
  const vegasBookCount = vegasBooks.length;
  const singleBookNote = vegasBookCount < 2
    ? `\nNOTE: Only ${vegasBookCount} Vegas book(s) available for this game.
Do not make line shopping comparisons. Base your recommendation on implied
probability vs your model only. Do not reference line shopping in your
response and leave the "lineShopping" field with empty strings.\n`
    : "";
  const vegasBookTable = vegasBooks.length > 0
    ? vegasBooks
        .map((b: Any) => {
          const ml = b.moneyline ?? {};
          const sp = b.spread?.line ? ` | Spread ${b.spread.line}` : "";
          const tot = b.total?.line ? ` | Total ${b.total.line}` : "";
          return `  ${b.name}: Home ${ml.home ?? "N/A"} | Away ${ml.away ?? "N/A"}${sp}${tot}`;
        })
        .join("\n")
    : "  (no per-book data)";
  const totalsRows = vegasBooks
    .filter((b: Any) => b.total?.line)
    .map((b: Any) =>
      `  ${b.name}: o${b.total.line} Over ${b.total.over ?? b.total.overOdds ?? "N/A"} | Under ${b.total.under ?? b.total.underOdds ?? "N/A"}`,
    )
    .join("\n");
  const totalsBlock = `
TOTALS (Over/Under):
${totalsRows || "  (no totals data)"}
Best Over: ${p.bestOverOdds ?? "N/A"} at ${p.bestOverBook ?? "N/A"}
Best Under: ${p.bestUnderOdds ?? "N/A"} at ${p.bestUnderBook ?? "N/A"}
Total line consensus: ${p.total ?? "N/A"}
`;
  const homePrices = vegasBooks.map((b: Any) => Number(b?.moneyline?.home)).filter((n) => Number.isFinite(n) && n !== 0);
  const awayPrices = vegasBooks.map((b: Any) => Number(b?.moneyline?.away)).filter((n) => Number.isFinite(n) && n !== 0);
  const range = (arr: number[]) =>
    arr.length ? `${Math.min(...arr)} to ${Math.max(...arr)} (${arr.length} books)` : "n/a";
  const walletBlock = wallets.length > 0
    ? `
SMART WALLET SIGNALS:
${wallets.map((w: Any) => `- ${w.label} (Tier ${w.tier}): ${(w.winRate * 100).toFixed(0)}% win rate`).join("\n")}
`
    : "No smart wallet data available for this game.";
  const leagueStr = String(p.league ?? "");
  const isWorldCup = /world\s*cup/i.test(leagueStr) || /fifa/i.test(leagueStr);
  const isGolf = /golf|pga|masters|open championship|u\.?s\.? open/i.test(leagueStr);
  const worldCupBlock = isWorldCup
    ? `
FIFA WORLD CUP 2026 CONTEXT:
This is a FIFA World Cup 2026 match. Key factors for international soccer:
- Tournament stage (group stage vs knockout — group games can be cautious)
- Team form coming into the tournament
- Head-to-head history between the nations
- Key player availability (injuries, suspensions, cards)
- Motivation (must-win group stage games often see more cautious play)
- The DRAW is a valid result in group stage (unlike most US sports)
- Consider 3-way market: Home / Draw / Away — not just moneyline
- Soccer scoring is low-variance: small total lines (2.5 is typical) matter a lot
`
    : "";
  const golfBlock = isGolf
    ? `
GOLF TOURNAMENT CONTEXT:
This is a golf tournament betting market. Key factors for golf analysis:
- Course history and fit for each player (length, rough, greens type)
- Recent form (last 4-6 events)
- Strokes gained statistics (off-the-tee, approach, putting)
- World ranking and experience at majors
- Weather conditions affect scoring
- Field strength varies by tournament
- Each-way betting common in golf (top 5 or top 8 depending on book)
- Value found in mid-range players (+2000 to +5000) more than favorites
- Outright winner is very hard to predict — top 10 finish bets often better value
`
    : "";
  return `You are EdgeHunter's sports betting analyst.
Your job is to find the BEST BET available given the current lines —
not just flag large edges. Even a small edge is worth reporting.
ALWAYS return a specific recommendation. Never return NO_EDGE if there
are real games with real odds to analyze.

MATCHUP: ${p.awayTeam} (AWAY) @ ${p.homeTeam} (HOME)
  HOME team = ${p.homeTeam}
  AWAY team = ${p.awayTeam}
League: ${p.league}
Game time: ${p.gameTime}

CRITICAL: "recommendedTeam" must be the EXACT team name you are
recommending to bet ON.
  - If recommendation is "HOME", recommendedTeam MUST be "${p.homeTeam}".
  - If recommendation is "AWAY", recommendedTeam MUST be "${p.awayTeam}".
  - Never put the opposing team in recommendedTeam.
  - Your "reasoning" MUST discuss that same team.

VEGAS BOOK ODDS (${vegasBooks.length} books):
${vegasBookTable}

CONSENSUS (de-vigged average across all books):
  Home win probability: ${((p.homeImplied ?? 0) * 100).toFixed(1)}%
  Away win probability: ${((p.awayImplied ?? 0) * 100).toFixed(1)}%
  Spread: ${p.spread ?? "N/A"}
  Total: ${p.total ?? "N/A"}

BEST AVAILABLE ODDS:
  Home moneyline: ${p.bestHomeOdds} (${p.bestHomeBook})
  Away moneyline: ${p.bestAwayOdds} (${p.bestAwayBook})
${totalsBlock}
LINE SHOPPING RANGE:
  Home: ${range(homePrices)}
  Away: ${range(awayPrices)}
${singleBookNote}
${polyBlock}
${kalshiBlock}
${polymarketBlock}
${walletBlock}
${worldCupBlock}
${golfBlock}
USER RISK PROFILE:
  Bankroll: $${bankroll}
  Kelly multiplier: ${kelly}x
  Max position: ${maxPct}% = $${((bankroll * maxPct) / 100).toFixed(0)}

PRIORITY ORDER FOR FINDING VALUE:
1. Line shopping — if one book offers significantly better odds than
   consensus, THAT is the recommendation.
2. Consensus value — if implied probability differs meaningfully from
   your assessment of true probability.
3. Cross-market signal — if Polymarket/Kalshi pricing differs from Vegas.

LINE SHOPPING GUIDANCE:
- 8+ cents better than worst book  => STRONG recommendation
- 4-7 cents better                  => MODERATE recommendation
- 1-3 cents better                  => WEAK but real recommendation

Calculate true edge as:
  edge = bestImplied - consensusImplied
  bestImplied = 1 / bestDecimalOdds
  consensusImplied = average of all books for that side

Always name the specific book offering the best odds for your recommended
side.

Calculate suggested bet using Quarter Kelly:
  raw_kelly = (edge * bankroll) / odds_decimal
  suggested = min(raw_kelly * ${kelly} * 0.25, max_position)

Respond with ONLY valid JSON, no markdown:
{
  "recommendation": "HOME" | "AWAY" | "OVER" | "UNDER",
  "recommendedTeam": "team name or Over/Under",
  "betType": "moneyline" | "spread" | "total",
  "confidence": 0-100,
  "edge": decimal e.g. 0.07,
  "suggestedAmount": dollar amount,
  "odds": American odds e.g. -110,
  "bestBook": "book name with the best line",
  "impliedProbability": decimal,
  "consensusImplied": decimal,
  "lineShopping": {
    "bestBook": "e.g. ProphetX",
    "bestOdds": "American odds e.g. 121",
    "worstBook": "e.g. FanDuel",
    "worstOdds": "American odds e.g. 110",
    "edgeCents": "integer cents between best and worst",
    "recommendation": "one sentence e.g. Bet AWAY at ProphetX +121 vs consensus +113"
  },
  "reasoning": "2-3 sentences specific to this game",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "riskLevel": "low" | "medium" | "high",
  "warningFlags": ["any concerns about this bet"]
}

IMPORTANT: If the best available line is clearly better than consensus,
ALWAYS recommend it even if the overall edge is small. Users want to
know WHERE to bet, not just WHETHER to bet. Only return
"recommendation": "NO_EDGE" if confidence would be below 35 — otherwise
always pick a side.`;
}

function buildKalshiPrompt(p: AnalyzeBody): string {
  const wallets = p.wallets ?? [];
  const bankroll = p.bankroll ?? 1000;
  const kelly = p.kellyMultiplier ?? 0.25;
  const maxPct = p.maxPositionPct ?? 5;
  const polyBlock = p.polymarketGap || p.polymarketYes != null
    ? `\nCROSS-MARKET SIGNAL:\nSame event on Polymarket: ${(((p.polymarketYes ?? p.polymarketGap?.polyImplied) ?? 0) * 100).toFixed(1)}% YES\nGap vs Kalshi: ${(((p.gap ?? p.polymarketGap?.gap) ?? 0) * 100).toFixed(1)}%\nOne platform is likely mispriced.\n`
    : "\nNo matching Polymarket market found.\n";
  const walletBlock = wallets.length > 0
    ? `\nSMART WALLET SIGNALS:\n${wallets.map((w: Any) => `- ${w.label} (Tier ${w.tier}): ${(w.winRate * 100).toFixed(0)}% win rate`).join("\n")}\n`
    : "\nNo smart wallet data available.\n";
  return `You are a quantitative prediction market analyst specializing in regulated US markets on Kalshi.

KALSHI MARKET: "${p.question}"
Category: ${p.category ?? "Unknown"}
Platform: Kalshi (CFTC regulated)

Current YES price: ${((p.yesPrice ?? 0) * 100).toFixed(1)}%
Current NO price: ${((p.noPrice ?? 0) * 100).toFixed(1)}%
24h Volume: $${p.volume24h ?? 0}
Closes: ${p.endDate ?? "TBD"}
${polyBlock}${walletBlock}
USER RISK PROFILE:
Bankroll: $${bankroll}
Kelly multiplier: ${kelly}x
Max position: ${maxPct}% = $${((bankroll * maxPct) / 100).toFixed(0)}

Kalshi markets are CFTC regulated and settle in USD. Factor in regulatory certainty as a positive vs offshore prediction markets.

Respond with ONLY valid JSON, no markdown:
{
  "direction": "YES" | "NO",
  "confidence": 0-100,
  "edge": decimal,
  "suggestedAmount": dollar amount,
  "reasoning": "2-3 sentences",
  "riskLevel": "low" | "medium" | "high",
  "keySignals": ["s1","s2","s3"],
  "crossMarketEdge": "one sentence if gap exists else null",
  "regulatoryNote": "any regulatory factors relevant"
}`;
}

function buildPropPrompt(p: AnalyzeBody): string {
  const bankroll = p.bankroll ?? 1000;
  const maxPos = p.maxPosition ?? ((bankroll * (p.maxPositionPct ?? 5)) / 100);
  const books = (p.bookmakers ?? []) as Any[];
  return `You are a sports betting analyst specializing in player proposition bets.

PLAYER PROP:
Player: ${p.playerName}
Prop type: ${p.propType}
Line: ${p.line}
Sport: ${p.sport ?? ""}
Game: ${p.homeTeam} vs ${p.awayTeam}

MARKET ODDS:
Best Over: ${p.bestOverOdds} at ${p.bestOverBook}
Best Under: ${p.bestUnderOdds} at ${p.bestUnderBook}

LINE SHOPPING:
${books.map((b: Any) => `${b.name}: Over ${b.overOdds} / Under ${b.underOdds}`).join("\n") || "(no comparison available)"}

USER RISK PROFILE:
Bankroll: $${bankroll}
Max position: $${maxPos.toFixed(0)}

Assess: line value vs true probability, line shopping value, best book per side, known factors.
Calculate Quarter Kelly for the better side.

Respond with ONLY valid JSON, no markdown:
{
  "recommendation": "OVER" | "UNDER" | "NO_EDGE",
  "confidence": 0-100,
  "edge": decimal,
  "suggestedAmount": dollar amount,
  "bestBook": "book name",
  "bestOdds": American odds,
  "reasoning": "2-3 sentences",
  "keyFactors": ["factor1","factor2"],
  "lineShopping": "best value tip across books",
  "warningFlags": ["any concerns"]
}`;
}

function buildCrossMarketPrompt(p: AnalyzeBody): string {
  const wallets = p.wallets ?? [];
  const bankroll = p.bankroll ?? 1000;
  const maxPos = p.maxPosition ?? ((bankroll * (p.maxPositionPct ?? 5)) / 100);
  return `You are a prediction market arbitrage analyst.

EVENT: "${p.question}"

PLATFORM PRICING:
${p.platform1}: ${((p.platform1Yes ?? 0) * 100).toFixed(1)}% YES
${p.platform2}: ${((p.platform2Yes ?? 0) * 100).toFixed(1)}% YES
Spread: ${((p.spread ?? 0) * 100).toFixed(1)}%

${p.isVegasComparison
    ? "VEGAS COMPARISON: This spread is between a prediction market and professional sportsbook odds. Vegas books represent sharp professional money."
    : "PREDICTION MARKET COMPARISON: Both platforms are retail prediction markets. The larger platform (Polymarket) typically has better price discovery due to higher liquidity."}

${wallets.length > 0
    ? `SMART WALLET SIGNALS:\n${wallets.map((w: Any) => `- ${w.label} (Tier ${w.tier}): ${(w.winRate * 100).toFixed(0)}% win`).join("\n")}`
    : "No wallet signals for this event."}

USER RISK PROFILE:
Bankroll: $${bankroll}
Max position: $${maxPos.toFixed(0)}

Analyze: which platform has better discovery, which side has edge, why discrepancy exists, confidence gap closes, recommended action.

Respond with ONLY valid JSON, no markdown:
{
  "favoredPlatform": "platform name",
  "favoredSide": "YES" | "NO",
  "confidence": 0-100,
  "edge": decimal,
  "suggestedAmount": dollar amount,
  "reasoning": "2-3 sentences",
  "whyGapExists": "one sentence on cause",
  "expectedResolution": "how/when gap closes",
  "keySignals": ["s1","s2"],
  "riskLevel": "low" | "medium" | "high",
  "actionableAdvice": "specific action"
}`;
}

function buildDailyBriefingPrompt(p: AnalyzeBody): string {
  const markets = (p.markets ?? []) as Any[];
  const games = (p.sportsGames ?? []) as Any[];
  const gaps = (p.crossMarketGaps ?? []) as Any[];
  const wallets = (p.wallets ?? []) as Any[];
  return `You are EdgeHunter's head analyst preparing the daily morning briefing for traders.

TODAY: ${p.date}

AVAILABLE MARKETS (${markets.length} total):
${markets.slice(0, 10).map((m: Any) => `- ${m.question} | YES: ${(m.yesPrice * 100).toFixed(0)}% | Vol: $${m.volume24h}`).join("\n") || "(none)"}

${games.length ? `TODAY'S GAMES (${games.length}):\n${games.slice(0, 5).map((g: Any) => `- ${g.homeTeam} vs ${g.awayTeam} (${g.league})`).join("\n")}` : "No sports games loaded today."}

${gaps.length ? `CROSS-MARKET GAPS:\n${gaps.slice(0, 3).map((g: Any) => `- ${g.question}: ${(g.spread * 100).toFixed(1)}% spread`).join("\n")}` : "No significant cross-market gaps today."}

SMART WALLET ACTIVITY:
${wallets.slice(0, 5).map((w: Any) => `- ${w.label} (Tier ${w.tier}): ${w.recentTrades ?? 0} recent trades`).join("\n") || "(none)"}

USER PROFILE:
Bankroll: $${p.bankroll ?? 1000}
Risk: ${p.kellyMultiplier ?? 0.25}x Kelly
Min confidence: ${p.minConfidence ?? 65}%

Prepare today's top 3 trading opportunities across ALL market types. Rank by confidence × edge × liquidity.

Respond with ONLY valid JSON, no markdown:
{
  "date": "${p.date}",
  "marketSummary": "1-2 sentence overview of today",
  "tips": [
    {
      "rank": 1,
      "type": "prediction" | "sports" | "cross-market" | "prop",
      "title": "short title",
      "question": "full market question or game",
      "platform": "Polymarket/Kalshi/Sports",
      "direction": "YES/NO/HOME/AWAY/OVER/UNDER",
      "confidence": 0-100,
      "edge": decimal,
      "suggestedAmount": dollar amount,
      "reasoning": "2-3 sentences",
      "urgency": "high" | "medium" | "low",
      "expiresIn": "e.g. Today | 3 days | 2 weeks"
    }
  ],
  "watchList": ["Market or game to watch but not bet yet"],
  "riskWarning": "any overall market risk today"
}`;
}

function buildSentimentPrompt(p: AnalyzeBody): string {
  const movers = (p.topMovers ?? []) as Any[];
  const high = (p.highestVolume ?? []) as Any[];
  const wallets = (p.wallets ?? []) as Any[];
  return `You are a prediction market sentiment analyst.

ACTIVE MARKETS SNAPSHOT:
Total markets: ${p.totalMarkets ?? 0}
High volume (>$1M 24h): ${p.highVolume ?? 0}
Rising markets: ${p.rising ?? 0}
Falling markets: ${p.falling ?? 0}

TOP MOVERS:
${movers.map((m: Any) => `- ${m.question}: ${m.change24h > 0 ? "+" : ""}${(m.change24h * 100).toFixed(1)}% | Vol: $${m.volume24h}`).join("\n") || "(none)"}

HIGHEST VOLUME:
${high.map((m: Any) => `- ${m.question}: $${m.volume24h} 24h`).join("\n") || "(none)"}

SMART WALLETS ACTIVE:
${wallets.slice(0, 5).map((w: Any) => `- ${w.label} (Tier ${w.tier})`).join("\n") || "(none)"}

Analyze themes, smart money focus, unusual volume, overall sentiment, top 2 markets to watch.

Respond with ONLY valid JSON, no markdown:
{
  "overallSentiment": "bullish" | "bearish" | "neutral" | "mixed",
  "sentimentScore": -100 to 100,
  "dominantThemes": ["theme1","theme2"],
  "smartMoneyFocus": "where wallets are active",
  "unusualActivity": "any volume spikes or anomalies",
  "topWatchMarkets": [
    { "question": "market question", "why": "one sentence", "signal": "what to look for" }
  ],
  "marketSummary": "2-3 sentence overall summary",
  "opportunities": "one sentence on best opportunity type today"
}`;
}

function buildWalletStrategyPrompt(p: AnalyzeBody): string {
  const positions = (p.positions ?? []) as Any[];
  const activity = (p.activity ?? []) as Any[];
  return `You are analyzing the trading strategy of a top Polymarket prediction market trader.

WALLET PROFILE:
Address: ${p.address}
Label: ${p.label}
Tier: ${p.tier}
Win Rate: ${((p.winRate ?? 0) * 100).toFixed(1)}%
Sharpe: ${p.sharpe}
30-Day ROI: ${((p.roi30d ?? 0) * 100).toFixed(1)}%
Total Volume: $${p.totalVolume}
Recent Trades: ${p.recentTrades}
Consistency: ${((p.consistency ?? 0) * 100).toFixed(1)}%

CURRENT OPEN POSITIONS:
${positions.length ? positions.map((x: Any) => `- ${x.direction} on "${x.question}" | $${x.amount} | Entry: ${(x.entryPrice * 100).toFixed(0)}%`).join("\n") : "No open positions available"}

RECENT ACTIVITY:
${activity.length ? activity.slice(0, 5).map((a: Any) => `- ${a.action} ${a.direction} "${a.question}" | $${a.amount} @ ${(a.price * 100).toFixed(0)}%`).join("\n") : "No recent activity available"}

Analyze trader type, specialization, position sizing, signals, follow recommendation.

Respond with ONLY valid JSON, no markdown:
{
  "traderType": "momentum" | "contrarian" | "value" | "event-driven" | "mixed",
  "specialization": "what markets they focus on",
  "strategyDescription": "2-3 sentences on their approach",
  "followRecommendation": "YES" | "PARTIAL" | "NO",
  "followReasoning": "why or why not",
  "currentPositionsTake": "analysis of their open positions",
  "riskProfile": "low" | "medium" | "high",
  "strengthScore": 0-100,
  "keyInsights": ["i1","i2","i3"],
  "watchSignals": ["what to watch for"]
}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const body: AnalyzeBody = await req.json().catch(() => ({}));

    // Ping/health check
    if (body.ping) {
      return new Response(JSON.stringify({ ok: !!apiKey, configured: !!apiKey }), {
        status: apiKey ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured', code: 'NO_API_KEY' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const type = body.type ?? "market";
    let prompt: string;
    switch (type) {
      case "sports": prompt = buildSportsPrompt(body); break;
      case "kalshi": prompt = buildKalshiPrompt(body); break;
      case "prop": prompt = buildPropPrompt(body); break;
      case "cross-market": prompt = buildCrossMarketPrompt(body); break;
      case "daily-briefing": prompt = buildDailyBriefingPrompt(body); break;
      case "sentiment": prompt = buildSentimentPrompt(body); break;
      case "wallet-strategy": prompt = buildWalletStrategyPrompt(body); break;
      case "market":
      default:
        if (!body.market || typeof body.market.question !== 'string') {
          return new Response(JSON.stringify({ error: 'market is required', code: 'BAD_REQUEST' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        prompt = buildPrompt(body);
    }

    const callAnthropic = async (): Promise<Response> => {
      const maxAttempts = 4;
      let lastResp: Response | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        let r: Response;
        try {
          r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
          }),
          });
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          if (attempt < maxAttempts - 1) {
            const delay = 800 * Math.pow(2, attempt) + Math.random() * 300;
            console.warn(`Anthropic fetch error (${(fetchErr as Error).message}) — retry in ${Math.round(delay)}ms`);
            await new Promise((res) => setTimeout(res, delay));
            continue;
          }
          return new Response(JSON.stringify({
            error: 'Network error reaching AI provider',
            code: 'NETWORK_ERROR',
            detail: (fetchErr as Error).message,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        clearTimeout(timeoutId);
        if (r.ok) return r;
        // Retry on overload/rate-limit/transient errors
        if ([429, 503, 504, 529].includes(r.status) && attempt < maxAttempts - 1) {
          const delay = 800 * Math.pow(2, attempt) + Math.random() * 300;
          console.warn(`Anthropic ${r.status} — retry in ${Math.round(delay)}ms`);
          await new Promise((res) => setTimeout(res, delay));
          lastResp = r;
          continue;
        }
        return r;
      }
      return lastResp!;
    };

    const resp = await callAnthropic();

    // If the helper already returned a JSON error response (network failure), pass it through.
    if (resp.headers.get('content-type')?.includes('application/json') && !('status' in resp && resp.status >= 200 && resp.status < 300 && resp.headers.get('x-anthropic'))) {
      // No-op — fall through to .ok check below.
    }

    if (!resp.ok) {
      const errText = await resp.text();
      const friendly =
        resp.status === 529 || resp.status === 503
          ? 'AI provider is temporarily overloaded. Please try again in a moment.'
          : resp.status === 429
          ? 'AI provider rate limit reached. Please try again shortly.'
          : resp.status === 401 || resp.status === 403
          ? 'AI provider authentication failed.'
          : 'Anthropic API error';
      return new Response(JSON.stringify({
        error: friendly,
        code: 'UPSTREAM_ERROR',
        upstreamStatus: resp.status,
        detail: errText,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data: { content?: { type: string; text?: string }[] };
    try {
      data = await resp.json();
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Invalid response from AI provider',
        code: 'PARSE_ERROR',
        detail: (err as Error).message,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const text = data.content?.find((b) => b.type === 'text')?.text ?? '';

    // Parse JSON from Claude response
    const cleaned = text.replace(/```json|```/g, '').trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({
        error: 'Failed to parse model response',
        code: 'MODEL_PARSE_ERROR',
        raw: text,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('analyze-market unexpected error:', err);
    return new Response(JSON.stringify({
      error: 'Unexpected server error',
      code: 'UNCAUGHT',
      detail: (err as Error).message,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});