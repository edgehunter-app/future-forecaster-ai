import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const PINNACLE_KEY = Deno.env.get("PINNACLE_API_KEY");
  const PINNACLE_BASE = "https://pinnacle-odds.p.rapidapi.com";
  const pinnacleHeaders = {
    "x-rapidapi-host": "pinnacle-odds.p.rapidapi.com",
    "x-rapidapi-key": PINNACLE_KEY ?? "",
  };

  const out: Record<string, unknown> = { keyExists: !!PINNACLE_KEY };
  console.log("[pinnacle] key exists:", !!PINNACLE_KEY);

  try {
    const sportsRes = await fetch(`${PINNACLE_BASE}/kit/v1/sports`, { headers: pinnacleHeaders });
    console.log("[pinnacle] sports status:", sportsRes.status);
    out.sportsStatus = sportsRes.status;

    if (sportsRes.ok) {
      const sportsJson = await sportsRes.json();
      const preview = JSON.stringify(sportsJson).slice(0, 500);
      console.log("[pinnacle] sports preview:", preview);
      out.sportsPreview = preview;

      const sports = (sportsJson as any).sports ?? sportsJson ?? [];
      const golf = Array.isArray(sports)
        ? sports.find((s: any) => s.name?.toLowerCase().includes("golf"))
        : null;
      const horseRacing = Array.isArray(sports)
        ? sports.find((s: any) => s.name?.toLowerCase().includes("horse"))
        : null;

      console.log("[pinnacle] golf sport:", JSON.stringify(golf));
      console.log("[pinnacle] horse racing sport:", JSON.stringify(horseRacing));
      out.golf = golf;
      out.horseRacing = horseRacing;

      if (golf?.id) {
        const leaguesRes = await fetch(
          `${PINNACLE_BASE}/kit/v1/leagues?sport_id=${golf.id}`,
          { headers: pinnacleHeaders },
        );
        console.log("[pinnacle] golf leagues status:", leaguesRes.status);
        out.golfLeaguesStatus = leaguesRes.status;
        if (leaguesRes.ok) {
          const leaguesJson = await leaguesRes.json();
          const p = JSON.stringify(leaguesJson).slice(0, 2000);
          console.log("[pinnacle] golf leagues:", p);
          out.golfLeagues = leaguesJson;
        }
      }

      if (horseRacing?.id) {
        const hrLeaguesRes = await fetch(
          `${PINNACLE_BASE}/kit/v1/leagues?sport_id=${horseRacing.id}`,
          { headers: pinnacleHeaders },
        );
        console.log("[pinnacle] HR leagues status:", hrLeaguesRes.status);
        out.hrLeaguesStatus = hrLeaguesRes.status;
        if (hrLeaguesRes.ok) {
          const hrLeaguesJson = await hrLeaguesRes.json();
          const p = JSON.stringify(hrLeaguesJson).slice(0, 2000);
          console.log("[pinnacle] HR leagues:", p);
          out.hrLeagues = hrLeaguesJson;
        }
      }
    } else {
      out.sportsBody = await sportsRes.text();
    }
  } catch (err) {
    console.error("[pinnacle] error:", err);
    out.error = String(err);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});