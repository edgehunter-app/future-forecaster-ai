import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Beta testers with complimentary Elite access — never modify their tier.
const BETA_EMAILS = [
  "mattg@lakeviewfinancial.net",
  "cgall1501@gmail.com",
  "rickg@lakeviewfinancial.net",
];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

async function isBetaUser(
  userId?: string | null,
  fallbackCustomerId?: string | null,
): Promise<boolean> {
  let uid = userId ?? null;
  if (!uid && fallbackCustomerId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, is_beta_tester")
      .eq("stripe_customer_id", fallbackCustomerId)
      .maybeSingle();
    if (data?.is_beta_tester) return true;
    uid = data?.id ?? null;
  }
  if (!uid) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_beta_tester")
    .eq("id", uid)
    .maybeSingle();
  if (profile?.is_beta_tester) return true;
  const { data: authUser } = await supabase.auth.admin.getUserById(uid);
  const email = authUser?.user?.email?.toLowerCase();
  return !!email && BETA_EMAILS.includes(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const signature = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
    );
  } catch (err) {
    console.error("[stripe-webhook] invalid signature", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata?.user_id as string) ?? null;
        const tier = (session.metadata?.tier as string) ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : null;

        if (await isBetaUser(userId, customerId)) {
          console.log("[stripe-webhook] skipping beta user");
          break;
        }

        if (userId && tier) {
          await supabase
            .from("profiles")
            .update({
              subscription_tier: tier,
              stripe_subscription_id:
                typeof session.subscription === "string" ? session.subscription : null,
              stripe_customer_id: customerId,
              subscription_status: "active",
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        if (await isBetaUser(null, customerId)) break;
        if (customerId) {
          await supabase
            .from("profiles")
            .update({
              subscription_tier: "free",
              subscription_status: "inactive",
              stripe_subscription_id: null,
            })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        if (await isBetaUser(null, customerId)) break;
        if (customerId) {
          const status = sub.status;
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, subscription_tier")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (profile) {
            await supabase
              .from("profiles")
              .update({
                subscription_status: status,
                subscription_tier: status === "active" ? profile.subscription_tier : "free",
                subscription_ends_at: sub.cancel_at
                  ? new Date(sub.cancel_at * 1000).toISOString()
                  : null,
              })
              .eq("id", profile.id);
          }
        }
        break;
      }

      default:
        console.log("[stripe-webhook] unhandled event", event.type);
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error", err);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});