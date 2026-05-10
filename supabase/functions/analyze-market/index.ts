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

IMPORTANT: Even if the signal is weak, always return a valid JSON object.
Use low confidence (30-50) and low edge (0.03-0.05) for weak signals,
and set riskLevel to "high". Never return null, an empty object, or refuse
to answer. The user wants to see something to evaluate.`;
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
  const walletBlock = wallets.length > 0
    ? `
SMART WALLET SIGNALS:
${wallets.map((w: Any) => `- ${w.label} (Tier ${w.tier}): ${(w.winRate * 100).toFixed(0)}% win rate`).join("\n")}
`
    : "No smart wallet data available for this game.";
  return `You are a quantitative sports betting analyst.
Analyze this game and identify if a real edge exists.

GAME: ${p.homeTeam} vs ${p.awayTeam}
League: ${p.league}
Game time: ${p.gameTime}

VEGAS CONSENSUS (across all books):
  Home win probability: ${((p.homeImplied ?? 0) * 100).toFixed(1)}%
  Away win probability: ${((p.awayImplied ?? 0) * 100).toFixed(1)}%
  Spread: ${p.spread ?? "N/A"}
  Total: ${p.total ?? "N/A"}

BEST AVAILABLE ODDS:
  Home moneyline: ${p.bestHomeOdds} (${p.bestHomeBook})
  Away moneyline: ${p.bestAwayOdds} (${p.bestAwayBook})
${polyBlock}
${walletBlock}
USER RISK PROFILE:
  Bankroll: $${bankroll}
  Kelly multiplier: ${kelly}x
  Max position: ${maxPct}% = $${((bankroll * maxPct) / 100).toFixed(0)}

INSTRUCTIONS:
Assess whether a real edge exists based on:
1. Line value — are the odds mispriced vs true probability?
2. Cross-market gap — does Polymarket confirm the edge?
3. Book consensus — is one side getting sharp money?
4. Game context — injuries, home/away, recent form if known

Calculate suggested bet using Quarter Kelly:
  raw_kelly = (edge * bankroll) / odds_decimal
  suggested = min(raw_kelly * ${kelly} * 0.25, max_position)

Respond with ONLY valid JSON, no markdown:
{
  "recommendation": "HOME" | "AWAY" | "OVER" | "UNDER" | "NO_EDGE",
  "recommendedTeam": "team name or Over/Under",
  "betType": "moneyline" | "spread" | "total",
  "confidence": 0-100,
  "edge": decimal e.g. 0.07,
  "suggestedAmount": dollar amount,
  "odds": American odds e.g. -110,
  "impliedProbability": decimal,
  "reasoning": "2-3 sentences specific to this game",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "riskLevel": "low" | "medium" | "high",
  "warningFlags": ["any concerns about this bet"]
}

If no edge exists return:
  "recommendation": "NO_EDGE",
  "confidence": below 45,
  "suggestedAmount": 0,
  "reasoning": explain why no edge`;
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