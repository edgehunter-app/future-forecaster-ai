const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  ping?: boolean;
  sportKey?: string;
  regions?: string;
  markets?: string;
  oddsFormat?: string;
  eventId?: string;
  useSecondary?: boolean;
}

// In-memory cache (per edge worker instance) to avoid hitting upstream rate limits.
interface CacheEntry {
  expires: number;
  payload: unknown;
}
const cache = new Map<string, CacheEntry>();
// Game odds change slowly; props slightly faster. Use 60s for game lines, 120s for events.
const TTL_MS = 60_000;
const EVENT_TTL_MS = 120_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const primaryKey = Deno.env.get('ODDS_API_KEY');
    const secondaryKey = Deno.env.get('ODDS_API_KEY_2');
    const apiKey = primaryKey;
    const body: Body = await req.json().catch(() => ({}));

    console.log("ODDS_API_KEY present:", !!apiKey);
    console.log("ODDS_API_KEY_2 present:", !!secondaryKey);
    console.log("Fetching sport:", body.sportKey);

    if (body.ping) {
      return new Response(JSON.stringify({ ok: !!apiKey, configured: !!apiKey }), {
        status: apiKey ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!apiKey) {
      console.error("ODDS_API_KEY not found in secrets");
      return new Response(JSON.stringify({ error: 'ODDS_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.sportKey || typeof body.sportKey !== 'string') {
      return new Response(JSON.stringify({ error: 'sportKey is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const regions = body.regions ?? 'us';
    const markets = body.markets ?? 'h2h';
    const oddsFormat = body.oddsFormat ?? 'american';

    const base = body.eventId
      ? `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(body.sportKey)}/events/${encodeURIComponent(body.eventId)}/odds`
      : `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(body.sportKey)}/odds`;
    const baseQuery =
      `${base}?regions=${encodeURIComponent(regions)}` +
      `&markets=${encodeURIComponent(markets)}&oddsFormat=${encodeURIComponent(oddsFormat)}`;
    const buildUrl = (key: string) => `${baseQuery}&apiKey=${key}`;
    const safeUrl = `${baseQuery}&apiKey=***`;
    console.log("URL:", safeUrl);

    const cacheKey = `${body.sportKey}|${body.eventId ?? ''}|${regions}|${markets}|${oddsFormat}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      console.log("Cache hit:", cacheKey);
      return new Response(JSON.stringify(cached.payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    // Order keys: prefer secondary if requested, else primary first.
    const orderedPairs: Array<{ name: 'primary' | 'secondary'; key: string }> = body.useSecondary
      ? [
          ...(secondaryKey ? [{ name: 'secondary' as const, key: secondaryKey }] : []),
          ...(primaryKey ? [{ name: 'primary' as const, key: primaryKey }] : []),
        ]
      : [
          ...(primaryKey ? [{ name: 'primary' as const, key: primaryKey }] : []),
          ...(secondaryKey ? [{ name: 'secondary' as const, key: secondaryKey }] : []),
        ];
    let resp: Response | null = null;
    let keyUsed: 'primary' | 'secondary' | null = null;
    let lastStatus = 0;
    let lastErrText = '';
    let lastErrCode = '';
    let usedFallback = false;
    let attempts = 0;
    let exhaustedCount = 0;
    let remaining: string | null = null;
    let used: string | null = null;

    try {
      for (const { name, key } of orderedPairs) {
        attempts++;
        let r: Response;
        try {
          r = await fetch(buildUrl(key), { signal: controller.signal });
        } catch (e) {
          console.warn('Key attempt failed:', e);
          lastErrText = String(e);
          continue;
        }
        remaining = r.headers.get('x-requests-remaining');
        used = r.headers.get('x-requests-used');
        lastStatus = r.status;

        if (r.ok) {
          if (attempts > 1) usedFallback = true;
          resp = r;
          keyUsed = name;
          break;
        }

        // Non-OK — inspect for quota exhaustion to try next key.
        const text = await r.text();
        lastErrText = text;
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch { /* ignore */ }
        lastErrCode = parsed?.error_code ?? '';
        const exhausted =
          r.status === 401 &&
          (lastErrCode === 'OUT_OF_USAGE_CREDITS' || /credits/i.test(text));
        console.warn(`Key ${name} attempt ${attempts} status=${r.status} code=${lastErrCode}`);
        if (exhausted || r.status === 429) {
          if (exhausted) exhaustedCount++;
          // Try next key
          continue;
        }
        // Other error — stop trying.
        break;
      }
    } finally {
      clearTimeout(timer);
    }

    if (!resp) {
      // All keys failed — serve stale cache if any, else graceful empty payload.
      if (cached) {
        console.log('All keys failed; serving stale cache');
        return new Response(JSON.stringify(cached.payload), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const allExhausted = exhaustedCount > 0 && exhaustedCount === orderedPairs.length;
      return new Response(
        JSON.stringify({
          data: [],
          source: allExhausted ? 'exhausted' : 'error',
          error: allExhausted
            ? 'All API keys have reached their quota'
            : (lastErrText || 'Odds API unavailable'),
          code: allExhausted ? 'QUOTA_EXHAUSTED' : (lastErrCode || `HTTP_${lastStatus}`),
          resetUrl: 'https://the-odds-api.com',
          remainingRequests: remaining !== null ? Number(remaining) : null,
          usedRequests: used !== null ? Number(used) : null,
          remaining: remaining !== null ? Number(remaining) : null,
          used: used !== null ? Number(used) : null,
          keyUsed,
          debug: { hasApiKey: true, url: safeUrl, status: lastStatus, gamesFound: 0, attempts },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Response status:', resp.status, 'usedFallback:', usedFallback, 'keyUsed:', keyUsed);
    const data = await resp.json();
    console.log("Games found:", Array.isArray(data) ? data.length : 0);
    const payload = {
      data,
      source: 'live',
      remainingRequests: remaining !== null ? Number(remaining) : null,
      usedRequests: used !== null ? Number(used) : null,
      remaining: remaining !== null ? Number(remaining) : null,
      used: used !== null ? Number(used) : null,
      keyUsed,
      usedFallback,
      debug: {
        hasApiKey: true,
        usedFallback,
        keyUsed,
        url: safeUrl,
        status: resp.status,
        gamesFound: Array.isArray(data) ? data.length : 0,
      },
    };
    cache.set(cacheKey, {
      expires: now + (body.eventId ? EVENT_TTL_MS : TTL_MS),
      payload,
    });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});