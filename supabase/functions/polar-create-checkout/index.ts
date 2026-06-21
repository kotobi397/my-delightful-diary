// Creates a Polar checkout session with a custom amount.
// Returns { url, id }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const POLAR_API = "https://api.polar.sh";
const PRODUCT_ID = "1d322421-921e-4e55-ae61-23588dd1482a";
const MIN_AMOUNT_CENTS = 100; // $1.00
const MAX_AMOUNT_CENTS = 100000; // $1000

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("POLAR_ACCESS_TOKEN");
    if (!token) throw new Error("POLAR_ACCESS_TOKEN not configured");

    const body = await req.json().catch(() => ({}));
    const rawAmount = Number(body?.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountCents = Math.min(
      Math.max(Math.round(rawAmount * 100), MIN_AMOUNT_CENTS),
      MAX_AMOUNT_CENTS
    );

    const origin = req.headers.get("origin") || "https://kotobi.xyz";
    const successUrl = `${origin}/donation-success?checkout_id={CHECKOUT_ID}`;

    const res = await fetch(`${POLAR_API}/v1/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [PRODUCT_ID],
        amount: amountCents,
        success_url: successUrl,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Polar checkout error:", data);
      return new Response(JSON.stringify({ error: data?.detail || data?.error || "Polar API error" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: data.url, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("polar-create-checkout error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});