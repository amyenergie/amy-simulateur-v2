// netlify/functions/lead.js

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
    };
  }

  try {
    const url = process.env.GOOGLE_SHEETS_WEBAPP_URL;

    if (!url) {
      console.log("[lead] Missing GOOGLE_SHEETS_WEBAPP_URL env var");
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Missing GOOGLE_SHEETS_WEBAPP_URL",
        }),
      };
    }

    // Parse payload
    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (e) {
      console.log("[lead] Invalid JSON body");
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      };
    }

    // Add metadata (useful in your Sheet)
    const enrichedPayload = {
      ...payload,
      _meta: {
        receivedAt: new Date().toISOString(),
        ip:
          event.headers["x-nf-client-connection-ip"] ||
          event.headers["x-forwarded-for"] ||
          "",
        userAgent: event.headers["user-agent"] || "",
      },
    };

    console.log("[lead] Forwarding to Google Script:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Important: Apps Script sometimes expects plain text JSON
      body: JSON.stringify(enrichedPayload),
    });

    const text = await res.text();

    console.log("[lead] Google status:", res.status);
    console.log("[lead] Google response snippet:", text.slice(0, 200));

    // Return VERBOSE so you can see what happens
    // If googleSnippet is HTML => wrong URL or wrong deployment/access
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        googleStatus: res.status,
        googleSnippet: text.slice(0, 300),
      }),
    };
  } catch (e) {
    console.log("[lead] ERROR:", String(e));
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(e) }),
    };
  }
}
