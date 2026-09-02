const crypto = require("crypto");
const { formatAgentMessage } = require("../lib/agent-identities");

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function normalizeWhatsAppAddress(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.startsWith("whatsapp:") ? v : `whatsapp:${v}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expectedToken = process.env.CHIMI_BRIDGE_TOKEN;
  const suppliedToken = req.headers["x-chimi-token"];

  if (!expectedToken || !safeEqual(suppliedToken, expectedToken)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM,
    CHIMI_WHATSAPP_TO
  } = process.env;

  const missing = [
    ["TWILIO_ACCOUNT_SID", TWILIO_ACCOUNT_SID],
    ["TWILIO_AUTH_TOKEN", TWILIO_AUTH_TOKEN],
    ["TWILIO_WHATSAPP_FROM", TWILIO_WHATSAPP_FROM],
    ["CHIMI_WHATSAPP_TO", CHIMI_WHATSAPP_TO]
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missing.length) {
    return res.status(500).json({
      ok: false,
      error: "Missing environment variables",
      missing
    });
  }

  const agent = String(req.body?.agent || "CHIMI").trim().slice(0, 80);
  const message = String(req.body?.message || "").trim().slice(0, 4000);

  if (!message) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  const from = normalizeWhatsAppAddress(TWILIO_WHATSAPP_FROM);
  const to = normalizeWhatsAppAddress(CHIMI_WHATSAPP_TO);
  const formatted = formatAgentMessage(agent, message);

  const form = new URLSearchParams({
    From: from,
    To: to,
    Body: formatted.body
  });

  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  try {
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      }
    );

    const data = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio outbound error", {
        status: twilioResponse.status,
        code: data.code,
        message: data.message
      });

      return res.status(twilioResponse.status).json({
        ok: false,
        error: "Twilio rejected the message",
        code: data.code || null,
        message: data.message || null
      });
    }

    return res.status(200).json({
      ok: true,
      sid: data.sid,
      status: data.status,
      to: data.to,
      agent: formatted.identity.key,
      display: `${formatted.identity.color} ${formatted.identity.emoji} ${formatted.identity.name}`
    });
  } catch (error) {
    console.error("Outbound bridge failure", error);
    return res.status(500).json({
      ok: false,
      error: "Bridge failed before Twilio accepted the message"
    });
  }
};
