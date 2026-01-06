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
    if (!verifyToken(event.headers.authorization))
        return {
            statusCode: 401,
            body: "Unauthorized"
        };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50", 10), 200);

    const { data, error } = await supabase
        .from("repairs")
        .select("id,created_at,repair_date,employee_id,employee_name,customer_name,phone,notes,total_screens,screen_total,labor_total,tax_total,grand_total")
        .order("created_at", { ascending: false})
        .limit(limit);

    if (error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error })
        };

    return {
        statusCode: 200,
        headers: { "Content-Type": "applications/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ repairs: data })
    };
};