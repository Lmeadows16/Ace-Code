const crypto = require("crypto");

function parseToken(headers = {}) {
  const raw = headers.authorization || headers.Authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
  return token;
}

exports.handler = async (event) => {
  const token = parseToken(event.headers || {});
  const secretPresent = !!process.env.ADMIN_TOKEN_SECRET;

  // Token shape inspection
  const parts = token ? token.split(".") : [];
  const partCount = parts.length;

  let sigMatches = null;
  let payload = null;
  let expectedSig = null;
  let gotSig = null;

  if (partCount === 2 && secretPresent) {
    const [payloadB64, sigHex] = parts;
    expectedSig = crypto.createHmac("sha256", process.env.ADMIN_TOKEN_SECRET).update(payloadB64).digest("hex");
    gotSig = sigHex;
    sigMatches = (expectedSig === gotSig);

    try {
      payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    } catch (e) {
      payload = { parseError: String(e) };
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      secretPresent,
      tokenPresent: !!token,
      partCount,
      sigMatches,
      payload,
      now: Date.now()
    })
  };
};
