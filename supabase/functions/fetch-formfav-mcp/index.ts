import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const FORMFAV_KEY = Deno.env.get("FORMFAV_API_KEY");
  if (!FORMFAV_KEY) {
    return new Response(
      JSON.stringify({ error: "FORMFAV_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Strip the function-name prefix so we forward whatever path Anthropic tacked on.
  const url = new URL(req.url);
  const subPath = url.pathname.replace(/^\/functions\/v1\/fetch-formfav-mcp/, "").replace(/^\/fetch-formfav-mcp/, "");
  const formfavUrl = `https://api.formfav.com/mcp${subPath}${url.search}`;

  console.log("[formfav-proxy] supabase url:", Deno.env.get("SUPABASE_URL"));
  console.log("[formfav-proxy] method:", req.method, "-> forwarding to:", formfavUrl);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  const accept = req.headers.get("accept") ?? "application/json, text/event-stream";

  let response: Response;
  try {
    response = await fetch(formfavUrl, {
      method: req.method,
      headers: {
        "X-API-Key": FORMFAV_KEY,
        "Content-Type": "application/json",
        "Accept": accept,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.error("[formfav-proxy] fetch error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: "Upstream FormFav fetch failed", detail: (err as Error).message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const contentType = response.headers.get("Content-Type") ?? "application/json";
  console.log("[formfav-proxy] response status:", response.status, "content-type:", contentType);

  // Stream SSE responses through unchanged so MCP streamable HTTP works.
  if (contentType.includes("text/event-stream")) {
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": contentType },
    });
  }

  const responseBody = await response.text();
  console.log("[formfav-proxy] response preview:", responseBody.slice(0, 300));

  return new Response(responseBody, {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": contentType },
  });
});