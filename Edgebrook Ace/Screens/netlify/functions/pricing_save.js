const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

function verifyToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;

  const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
  const expectedSig = crypto
    .createHmac("sha256", process.env.ADMIN_TOKEN_SECRET)
    .update(payloadJson)
    .digest("hex");

  if (sig !== expectedSig) return false;

  const payload = JSON.parse(payloadJson);
  return Date.now() < payload.exp;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  if (!verifyToken(event.headers.authorization)) return { statusCode: 401, body: "Unauthorized" };

  const { taxRate, cornerPrice, glassPresets, screenPresets } = JSON.parse(event.body || "{}");

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // settings
  const s1 = await supabase.from("settings").upsert({ key: "taxRate", value: taxRate });
  const s2 = await supabase.from("settings").upsert({ key: "cornerPrice", value: cornerPrice });
  if (s1.error || s2.error) return { statusCode: 500, body: "Settings update failed" };

  // replace glass
  await supabase.from("glass_items").delete().neq("sku", "");
  const gIns = await supabase.from("glass_items").insert(glassPresets);
  if (gIns.error) return { statusCode: 500, body: "Glass update failed" };

  // replace screens
  await supabase.from("screen_presets").delete().neq("w", -1);
  const sIns = await supabase.from("screen_presets").insert(
    screenPresets.map(p => ({
      w: p.w,
      h: p.h,
      labor_default: p.laborDefault,
      prices: Object.fromEntries(Object.entries(p.materials).map(([k,v]) => [k, v.price]))
    }))
  );
  if (sIns.error) return { statusCode: 500, body: "Screen update failed" };

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
