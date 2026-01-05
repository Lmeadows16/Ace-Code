const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { password } = JSON.parse(event.body || "{}");
  const expected = process.env.ADMIN_PASSWORD;

  if (!password || !expected || password !== expected) {
    return { statusCode: 401, body: JSON.stringify({ error: "Bad password" }) };
  }

  const exp = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const payload = JSON.stringify({ exp });
  const sig = crypto
    .createHmac("sha256", process.env.ADMIN_TOKEN_SECRET)
    .update(payload)
    .digest("hex");

  const token = Buffer.from(payload).toString("base64url") + "." + sig;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  };
};
