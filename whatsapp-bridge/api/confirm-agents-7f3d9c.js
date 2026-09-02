const crypto = require("crypto");
const { IDENTITIES, formatAgentMessage } = require("../lib/agent-identities");

const KEY_HASH = "1d6a9e5ffa1c2a5a5b71c71fb2a049f42e6ee7e407654bd6b0ccb9e3b95ea327";
const EXPIRES_AT = Date.parse("2026-09-02T02:50:00Z");

function normalizeWhatsAppAddress(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.startsWith("whatsapp:") ? v : `whatsapp:${v}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTwilio({ sid, token, from, to, body }) {
  const form = new URLSearchParams({ From: from, To: to, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  const data = await response.json();
  return {
    ok: response.ok,
    statusCode: response.status,
    sid: data.sid || null,
    status: data.status || null,
    code: data.code || null,
    message: data.message || null
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (Date.now() > EXPIRES_AT) {
    return res.status(410).json({ ok: false, error: "Confirmation endpoint expired" });
  }

  if (sha256(req.query?.key) !== KEY_HASH) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM,
    CHIMI_WHATSAPP_TO
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM || !CHIMI_WHATSAPP_TO) {
    return res.status(500).json({ ok: false, error: "Missing bridge environment variables" });
  }

  const from = normalizeWhatsAppAddress(TWILIO_WHATSAPP_FROM);
  const to = normalizeWhatsAppAddress(CHIMI_WHATSAPP_TO);

  const confirmations = [
    ["0_BRAIN_CORE", "Canal WhatsApp confirmado. Quedó canonizado como vía privada para avisos importantes y coordinación contigo."],
    ["0_ORCHESTRATOR_CORE", "Conexión confirmada. Voy a usar este canal para alertas de operación, bloqueos y decisiones que requieran tu atención."],
    ["1_JOB_HUNTER", "WhatsApp confirmado. Te voy a avisar acá cuando haya una oportunidad fuerte, respuesta relevante o acción que necesite tu decisión."],
    ["2_CHIMICHURRI_SALES", "WhatsApp confirmado. Hot leads, respuestas comerciales importantes y bloqueos de ventas te llegan por acá."],
    ["3_CONTENT_OS", "Canal confirmado. Entregas importantes, QA y bloqueos reales de producción pueden avisarte por WhatsApp."],
    ["3A_CONTENT_CREATOR", "Conectado. Puedo avisarte por acá cuando una pieza esté lista o necesite una decisión creativa."],
    ["3B_SOCIAL_MEDIA_MANAGER", "Conexión lista. Te aviso acá sólo por cambios o señales sociales que realmente merezcan atención."],
    ["3C_CREATIVE_PRODUCER", "WhatsApp operativo. Producción, entregables y bloqueos creativos importantes pueden escalar por este canal."],
    ["4_CLAUDE_COWORK_STUDIO", "Canal confirmado. Quedo habilitado para escalarte por WhatsApp avances o bloqueos relevantes del estudio."],
    ["5_DASHBOARD_PRODUCT", "Conexión confirmada. La Ofi puede avisarte por WhatsApp ante cambios relevantes de estado o producto."],
    ["6_ANALYTICS", "WhatsApp confirmado. Te aviso por acá cuando haya una señal de datos importante, anomalía o insight accionable."]
  ];

  const results = [];

  for (const [agentKey, message] of confirmations) {
    const formatted = formatAgentMessage(agentKey, message);
    const result = await sendTwilio({
      sid: TWILIO_ACCOUNT_SID,
      token: TWILIO_AUTH_TOKEN,
      from,
      to,
      body: formatted.body
    });

    results.push({
      agent: agentKey,
      display: IDENTITIES[agentKey],
      ...result
    });

    await sleep(650);
  }

  const allOk = results.every(r => r.ok);
  return res.status(allOk ? 200 : 207).json({
    ok: allOk,
    sent: results.filter(r => r.ok).length,
    total: results.length,
    results
  });
};
