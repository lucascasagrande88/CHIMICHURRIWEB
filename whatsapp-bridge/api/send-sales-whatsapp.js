const crypto = require("crypto");

// Separate customer-sales lane. This file intentionally does NOT modify the
// existing owner <-> CHIMI agent bridge.

const SALES_AGENT = "2_CHIMICHURRI_SALES";
const SALES_AGENT_TOKEN_HASH = "89f2e0dde0caf4fec02ce1be50b022ea9d141b6f6f32b40dab75c82f86646868";

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

function normalizeE164(value) {
  let v = String(value || "").trim().replace(/^whatsapp:/, "");
  v = v.replace(/[\s().-]/g, "");
  if (!v.startsWith("+")) return "";
  if (!/^\+[1-9]\d{7,14}$/.test(v)) return "";
  return v;
}

function authorize(req) {
  const bridgeToken = process.env.CHIMI_BRIDGE_TOKEN || "";
  const suppliedBridgeToken = String(req.headers["x-chimi-token"] || "");

  if (bridgeToken && suppliedBridgeToken && safeEqual(suppliedBridgeToken, bridgeToken)) {
    return { ok: true, mode: "BRIDGE_TOKEN" };
  }

  const runtimeAgent = String(req.headers["x-chimi-agent"] || "").trim();
  const runtimeToken = String(req.headers["x-agent-token"] || "");

  if (runtimeAgent !== SALES_AGENT || !runtimeToken) {
    return { ok: false };
  }

  if (!safeEqual(sha256(runtimeToken), SALES_AGENT_TOKEN_HASH)) {
    return { ok: false };
  }

  return { ok: true, mode: "SALES_RUNTIME_TOKEN" };
}

function verifiedConsent(input) {
  const c = input && typeof input === "object" ? input : {};
  const status = String(c.status || "").toUpperCase();
  const source = String(c.source || "").trim().slice(0, 200);
  const verifiedAt = String(c.verified_at || "").trim().slice(0, 80);

  return {
    ok: status === "VERIFIED" && Boolean(source) && Boolean(verifiedAt),
    status,
    source,
    verifiedAt
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authz = authorize(req);
  if (!authz.ok) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_SALES_FROM
  } = process.env;

  const missing = [
    ["TWILIO_ACCOUNT_SID", TWILIO_ACCOUNT_SID],
    ["TWILIO_AUTH_TOKEN", TWILIO_AUTH_TOKEN],
    ["TWILIO_WHATSAPP_SALES_FROM", TWILIO_WHATSAPP_SALES_FROM]
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missing.length) {
    return res.status(503).json({
      ok: false,
      error: "Sales WhatsApp lane is not configured",
      missing
    });
  }

  const toE164 = normalizeE164(req.body?.to);
  if (!toE164) {
    return res.status(400).json({ ok: false, error: "to must be a valid E.164 phone number" });
  }

  const consent = verifiedConsent(req.body?.consent);
  if (!consent.ok) {
    return res.status(409).json({
      ok: false,
      error: "VERIFIED WhatsApp opt-in with source and verified_at is required"
    });
  }

  const customerWindowOpen = req.body?.customer_window_open === true;
  const body = String(req.body?.message || "").trim().slice(0, 4000);
  const contentSid = String(req.body?.content_sid || "").trim();
  const contentVariables = req.body?.content_variables;
  const dryRun = req.body?.dry_run === true;

  if (customerWindowOpen && !body) {
    return res.status(400).json({ ok: false, error: "message is required while customer window is open" });
  }

  if (!customerWindowOpen && !contentSid) {
    return res.status(409).json({
      ok: false,
      error: "Approved content_sid is required outside the 24-hour customer-service window"
    });
  }

  const from = normalizeWhatsAppAddress(TWILIO_WHATSAPP_SALES_FROM);
  const to = normalizeWhatsAppAddress(toE164);

  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dry_run: true,
      sendable: true,
      from,
      to,
      mode: customerWindowOpen ? "FREE_FORM_24H" : "APPROVED_TEMPLATE",
      consent: {
        status: consent.status,
        source: consent.source,
        verified_at: consent.verifiedAt
      },
      auth_mode: authz.mode
    });
  }

  const form = new URLSearchParams({ From: from, To: to });

  if (customerWindowOpen) {
    form.set("Body", body);
  } else {
    form.set("ContentSid", contentSid);
    if (contentVariables && typeof contentVariables === "object") {
      form.set("ContentVariables", JSON.stringify(contentVariables));
    }
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

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

    const data = await twilioResponse.json().catch(() => ({}));

    if (!twilioResponse.ok) {
      console.error("Twilio sales outbound error", {
        status: twilioResponse.status,
        code: data.code,
        message: data.message,
        to
      });
      return res.status(twilioResponse.status).json({
        ok: false,
        error: "Twilio rejected the sales message",
        code: data.code || null,
        message: data.message || null
      });
    }

    return res.status(200).json({
      ok: true,
      sid: data.sid,
      status: data.status,
      to: data.to,
      mode: customerWindowOpen ? "FREE_FORM_24H" : "APPROVED_TEMPLATE",
      auth_mode: authz.mode,
      agent: SALES_AGENT
    });
  } catch (error) {
    console.error("Sales WhatsApp bridge failure", error);
    return res.status(500).json({
      ok: false,
      error: "Sales bridge failed before Twilio accepted the message"
    });
  }
};
