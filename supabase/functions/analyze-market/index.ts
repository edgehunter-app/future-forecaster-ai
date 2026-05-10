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

    const isSports = body.type === "sports";
    if (!isSports && (!body.market || typeof body.market.question !== 'string')) {
      return new Response(JSON.stringify({ error: 'market is required', code: 'BAD_REQUEST' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (isSports && (!body.homeTeam || !body.awayTeam)) {
      return new Response(JSON.stringify({ error: 'homeTeam/awayTeam required', code: 'BAD_REQUEST' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = isSports ? buildSportsPrompt(body) : buildPrompt(body);

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