// Proxies ESPN's public college football rankings feed (browser-blocked by CORS).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINTS = [
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
  "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
  "https://api.allorigins.win/raw?url=https%3A%2F%2Fsite.api.espn.com%2Fapis%2Fsite%2Fv2%2Fsports%2Ffootball%2Fcollege-football%2Frankings",
  "https://api.allorigins.win/raw?url=https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
];

const norm = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

let cache: { at: number; body: unknown } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return new Response(JSON.stringify(cache.body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let json: any = null;
    const attempts: string[] = [];
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json,text/plain,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.espn.com/",
          },
        });
        if (!res.ok) {
          attempts.push(`${url} -> ${res.status}`);
          continue;
        }
        json = await res.json();
        if (Array.isArray(json?.rankings) && json.rankings.length) break;
        attempts.push(`${url} -> no rankings`);
        json = null;
      } catch (e) {
        attempts.push(`${url} -> ${String(e)}`);
      }
    }
    if (!json) throw new Error(`all endpoints failed: ${attempts.join(" | ")}`);
    const polls: any[] = Array.isArray(json?.rankings) ? json.rankings : [];

    const pick = (re: RegExp, exclude?: RegExp) =>
      polls.find((p) => {
        const label = `${p?.shortName ?? ""} ${p?.name ?? ""}`;
        return re.test(label) && !(exclude && exclude.test(label));
      });

    const poll =
      pick(/\bap\b/i) ?? pick(/coaches/i, /fcs|division/i) ?? polls[0];
    if (!poll) throw new Error("no poll in feed");

    const ranks: Record<string, number> = {};
    for (const entry of poll.ranks ?? []) {
      const rank = Number(entry?.current);
      const team = entry?.team ?? {};
      if (!Number.isFinite(rank)) continue;
      const names = [
        team.location,
        team.displayName,
        team.shortDisplayName,
        team.nickname,
        team.location && team.name ? `${team.location} ${team.name}` : null,
      ];
      for (const n of names) if (n) ranks[norm(String(n))] = rank;
    }

    const body = {
      poll: poll.shortName ?? poll.name ?? "AP Poll",
      ranks,
      fetchedAt: Date.now(),
    };
    cache = { at: Date.now(), body };

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), poll: null, ranks: {} }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
