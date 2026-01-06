// netlify/functions/repairs_detail.js
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

function verifyTokenFromHeaders(headers = {}) {
  const raw = headers.authorization || headers.Authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
  if (!token) return false;

  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payloadB64, sigHex] = parts;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("hex");

  if (expectedSig !== sigHex) return false;

  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // ✅ Use the function that exists above
    if (!verifyTokenFromHeaders(event.headers || {})) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const id = (event.queryStringParameters?.id || "").trim();
    if (!id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing id" })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: repair, error: rErr } = await supabase
      .from("repairs")
      .select("*")
      .eq("id", id)
      .single();

    if (rErr || !repair) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Repair not found", details: rErr || null })
      };
    }

    const { data: items, error: iErr } = await supabase
      .from("repair_items")
      .select("*")
      .eq("repair_id", id)
      .order("id", { ascending: true });

    if (iErr) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Items query failed", details: iErr })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ repair, items: items || [] })
    };
  } catch (e) {
    console.error("repairs_detail error:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e?.message || e) })
    };
  }
};
