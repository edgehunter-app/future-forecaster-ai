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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ODDS_API_KEY');
    const body: Body = await req.json().catch(() => ({}));

    if (body.ping) {
      return new Response(JSON.stringify({ ok: !!apiKey, configured: !!apiKey }), {
        status: apiKey ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!apiKey) {
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

    const url =
      `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(body.sportKey)}/odds` +
      `?apiKey=${apiKey}&regions=${encodeURIComponent(regions)}` +
      `&markets=${encodeURIComponent(markets)}&oddsFormat=${encodeURIComponent(oddsFormat)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let resp: Response;
    try {
      resp = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    const remaining = resp.headers.get('x-requests-remaining');
    const used = resp.headers.get('x-requests-used');

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: 'Odds API error', status: resp.status, detail: errText }), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify({
      data,
      remainingRequests: remaining !== null ? Number(remaining) : null,
      usedRequests: used !== null ? Number(used) : null,
    }), {
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