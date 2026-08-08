const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export async function handler(event) {
  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const lat = Number(event.queryStringParameters?.lat);
    const lon = Number(event.queryStringParameters?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "lat/lon invalides" }),
      };
    }

    const peakpower = event.queryStringParameters?.peakpower || "6";
    const loss = event.queryStringParameters?.loss || "14";
    const angle = event.queryStringParameters?.angle || "35";
    const aspect = event.queryStringParameters?.aspect || "0";

    const url = new URL("https://re.jrc.ec.europa.eu/api/v5_2/PVcalc");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("peakpower", String(peakpower));
    url.searchParams.set("loss", String(loss));
    url.searchParams.set("angle", String(angle));
    url.searchParams.set("aspect", String(aspect));
    url.searchParams.set("outputformat", "json");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    const text = await res.text();

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "PVGIS error", details: text.slice(0, 800) }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
      body: text,
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
}
