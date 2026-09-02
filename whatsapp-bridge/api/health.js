module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "CHIMI_WHATSAPP_TO",
    "CHIMI_BRIDGE_TOKEN"
  ];

  const env = Object.fromEntries(required.map((key) => [key, Boolean(process.env[key])]));
  const ok = required.every((key) => env[key]);

  return res.status(ok ? 200 : 500).json({
    ok,
    service: "CHIMI WhatsApp Bridge",
    version: "owner-agent-channel-v1",
    features: {
      canonical_agent_headers: true,
      agent_runtime_auth: true,
      delegated_agent_identities: true
    },
    env
  });
};
