const crypto = require("crypto");
const { resolveAgentIdentity, formatAgentMessage } = require("../lib/agent-identities");

const AGENT_TOKEN_HASHES = {
  "0_ORCHESTRATOR_CORE": "5dfa9afe3f3b2d2fc977aa423c52fac4c2a1c9d4715bed694cc07b0320ceb4d6",
  "1_JOB_HUNTER": "b5b9d65bf64373d35b829666ff3d829800bc4c74c8af1871155eb38e59f5b73e",
  "2_CHIMICHURRI_SALES": "89f2e0dde0caf4fec02ce1be50b022ea9d141b6f6f32b40dab75c82f86646868",
  "3_CONTENT_OS": "3fc9d5b219737e53867f719804610464e0ed3e56efbdbf5341175374b8a7d2ef"
};

const DELEGATION = {
  "0_ORCHESTRATOR_CORE": new Set([
    "0_ORCHESTRATOR_CORE",
    "0_BRAIN_CORE",
    "4_CLAUDE_COWORK_STUDIO",
    "5_DASHBOARD_PRODUCT",
    "6_ANALYTICS"
  ]),
  "1_JOB_HUNTER": new Set(["1_JOB_HUNTER"]),
  "2_CHIMICHURRI_SALES": new Set(["2_CHIMICHURRI_SALES"]),
  "3_CONTENT_OS": new Set([
    "3_CONTENT_OS",
    "3A_CONTENT_CREATOR",
    "3B_SOCIAL_MEDIA_MANAGER",
    "3C_CREATIVE_PRODUCER"
  ])
};

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeWhatsAppAddress(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.startsWith("whatsapp:") ? v : `whatsapp:${v}`;
}

function authorize(req) {
  const expectedBridgeToken = process.env.CHIMI_BRIDGE_TOKEN;
  const suppliedBridgeToken = req.headers["x-chimi-token"];

  if (
    expectedBridgeToken &&
    suppliedBridgeToken &&
    safeEqual(suppliedBridgeToken, expectedBridgeToken)
  ) {
    return {
      ok: true,
      authMode: "BRIDGE_TOKEN",
      requestedAgent: String(req.body?.agent || "CHIMI").trim().slice(0, 80)
    };
  }

  const runtimeAgentRaw = String(req.headers["x-chimi-agent"] || "").trim();
  const runtimeAgent = resolveAgentIdentity(runtimeAgentRaw).key;
  const runtimeToken = String(req.headers["x-agent-token"] || "");
  const expectedHash = AGENT_TOKEN_HASHES[runtimeAgent];

  if (!expectedHash || !runtimeToken || !safeEqual(sha256(runtimeToken), expectedHash)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const requestedRaw = String(req.body?.agent || runtimeAgent).trim();
  const requestedAgent = resolveAgentIdentity(requestedRaw).key;
  const allowed = DELEGATION[runtimeAgent];

  if (!allowed || !allowed.has(requestedAgent)) {
    return { ok: false, status: 403, error: "Agent identity delegation not allowed" };
  }

  return {
    ok: true,
    authMode: "AGENT_RUNTIME_TOKEN",
    runtimeAgent,
    requestedAgent
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authorization = authorize(req);
  if (!authorization.ok) {
    return res.status(authorization.status).json({ ok: false, error: authorization.error });
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

  const message = String(req.body?.message || "").trim().slice(0, 4000);

  if (!message) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  const from = normalizeWhatsAppAddress(TWILIO_WHATSAPP_FROM);
  const to = normalizeWhatsAppAddress(CHIMI_WHATSAPP_TO);
  const formatted = formatAgentMessage(authorization.requestedAgent, message);

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
      display: `${formatted.identity.color} ${formatted.identity.emoji} ${formatted.identity.name}`,
      auth_mode: authorization.authMode,
      runtime_agent: authorization.runtimeAgent || null
    });
  } catch (error) {
    console.error("Outbound bridge failure", error);
    return res.status(500).json({
      ok: false,
      error: "Bridge failed before Twilio accepted the message"
    });
  }
};
