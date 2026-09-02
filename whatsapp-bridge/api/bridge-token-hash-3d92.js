const crypto = require("crypto");

const EXPIRES_AT = Date.parse("2026-09-02T03:05:00Z");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false });
  }
  if (Date.now() > EXPIRES_AT) return res.status(410).json({ ok: false, error: "expired" });
  const token = process.env.CHIMI_BRIDGE_TOKEN || "";
  if (!token) return res.status(500).json({ ok: false, error: "missing" });
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return res.status(200).json({ ok: true, sha256: hash });
};
