function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getField(body, key) {
  if (!body) return "";
  if (typeof body === "object") return body[key] || "";
  if (typeof body === "string") return new URLSearchParams(body).get(key) || "";
  return "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const body = getField(req.body, "Body");
  const from = getField(req.body, "From");
  const messageSid = getField(req.body, "MessageSid");

  console.log("Inbound WhatsApp", {
    from,
    messageSid,
    bodyPreview: String(body).slice(0, 120)
  });

  const reply = body
    ? `CHIMI conectado ✅\nRecibí tu mensaje: "${body}"`
    : "CHIMI conectado ✅";

  const twiml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response><Message>" +
    escapeXml(reply) +
    "</Message></Response>";

  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  return res.status(200).send(twiml);
};
