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
    if (event.httpMethod !== "POST")
        return {
            statusCode: 405,
            body: "Method not allowed"
        };

    if (!verifyToken(event.headers.authorization))
        return {
            statusCode: 401,
            body: "Unauthorized"
        };

    const { employees } = JSON.parse(event.body || "{}");
    if (!Array.isArray(employees))
        return {
            statusCode: 400,
            body: "Bad payload"
        };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    await supabase.from("employees").delete().neq("employee_id", "");
    const { error } = await supabase.from("employees").insert(
        employees
            .filter(e => e.employee_id && e.name)
            .map (e => ({
                employee_id: String(e.employee_id).trim(),
                name: String(e.name).trim(),
            }))
    );

    if (error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error })
        };

    return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
    };
};