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
  env.OPENAI_API_KEY = Boolean(process.env.OPENAI_API_KEY);

  const transportOk = required.every((key) => env[key]);
  const aiOk = env.OPENAI_API_KEY === true;

  return res.status(transportOk ? 200 : 500).json({
    ok: transportOk,
    ai_ready: transportOk && aiOk,
    service: "CHIMI WhatsApp Bridge",
    version: "owner-agent-channel-v2",
    features: {
      canonical_agent_headers: true,
      agent_runtime_auth: true,
      delegated_agent_identities: true,
      inbound_agent_routing: true,
      openai_responses_runtime: aiOk,
      supabase_live_context: true
    },
    env
  });
};
