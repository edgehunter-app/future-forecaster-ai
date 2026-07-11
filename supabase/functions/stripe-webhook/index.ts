import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Beta testers with complimentary Elite access. Stripe events for these
// users must NEVER downgrade or overwrite their subscription state.
const BETA_EMAILS = [
  "mattg@lakeviewfinancial.net",
  "cgall1501@gmail.com",
  "rickg@lakeviewfinancial.net",
];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  let event: any;
  try {
    event = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const customerId: string | undefined =
    event?.data?.object?.customer ?? event?.data?.object?.customer_id;

  if (customerId) {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("id, subscription_tier, is_beta_tester")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    let email: string | null = null;
    if (userProfile?.id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userProfile.id);
      email = authUser?.user?.email?.toLowerCase() ?? null;
    }

    if (
      userProfile?.is_beta_tester ||
      (email && BETA_EMAILS.includes(email))
    ) {
      console.log("[stripe-webhook] skipping beta user:", email);
      return new Response(JSON.stringify({ received: true, skipped: "beta" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  // TODO: handle real Stripe events (checkout.session.completed,
  // customer.subscription.updated, customer.subscription.deleted, etc.)
  console.log("[stripe-webhook] event received:", event?.type);

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});