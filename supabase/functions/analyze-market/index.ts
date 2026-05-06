const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketIn { question: string; category?: string; yesPrice: number; noPrice: number; volume24h?: number; change24h?: number; source?: string }
interface WalletIn { label: string; winRate: number; sharpe: number; tier: string }
interface CrossIn { kalshiYes: number; spread: number; favoredPlatform?: string }
interface AnalyzeBody {
  ping?: boolean;
  market?: MarketIn;
  wallets?: WalletIn[];
  bankroll?: number;
  kellyMultiplier?: number;
  maxPositionPct?: number;
  crossMarketData?: CrossIn | null;
}

function buildPrompt(b: AnalyzeBody): string {
  const m = b.market!;
  const wallets = b.wallets ?? [];
  const bankroll = b.bankroll ?? 1000;
  const kelly = b.kellyMultiplier ?? 0.25;
  const maxPct = b.maxPositionPct ?? 5;
  const xm = b.crossMarketData;
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
${wallets.map((w) => `- ${w.label}: ${(w.winRate * 100).toFixed(0)}% win, Sharpe ${w.sharpe}, Tier ${w.tier}`).join("\n") || "- (none)"}
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

    if (!body.market || typeof body.market.question !== 'string') {
      return new Response(JSON.stringify({ error: 'market is required', code: 'BAD_REQUEST' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = buildPrompt(body);

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