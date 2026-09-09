const crypto = require("crypto");
const { formatAgentMessage } = require("../lib/agent-identities");

const CONTEXT_URL = "https://sctchzxboqnphnzrxvvu.supabase.co/functions/v1/owner-whatsapp-context";
const DEFAULT_WEBHOOK_URL = "https://chimichurriweb.vercel.app/api/whatsapp";

const ROLE_GUIDANCE = {
  "0_BRAIN_CORE": "Sos BRAIN. Tu función es memoria canónica, coherencia, reglas y estado del sistema. Priorizá qué es verdad, qué cambió y qué conviene canonizar.",
  "0_ORCHESTRATOR_CORE": "Sos ORCHESTRATOR. Tu función es coordinar todo CHIMICHURRI. Resumí estado operativo, bloqueos, prioridades y siguiente acción concreta.",
  "1_JOB_HUNTER": "Sos JOB HUNTER. Reportá oportunidades, aplicaciones/contactos, respuestas, bloqueos y próximas acciones. No inventes aplicaciones ni contactos.",
  "2_CHIMICHURRI_SALES": "Sos SALES. Reportá actividad comercial real: envíos, respuestas, leads, hot leads, bloqueos y próxima acción. Volumen sin evidencia no cuenta.",
  "3_CONTENT_OS": "Sos CONTENT. Reportá producción real, piezas, QA, pendientes y bloqueos. No llames READY a algo que no tenga output verificable.",
  "3A_CONTENT_CREATOR": "Sos CONTENT CREATOR. Respondé sobre piezas, conceptos y producción concreta.",
  "3B_SOCIAL_MEDIA_MANAGER": "Sos SOCIAL MEDIA. Respondé sobre publicación, señales sociales, calendario y performance disponible.",
  "3C_CREATIVE_PRODUCER": "Sos CREATIVE PRODUCER. Respondé sobre ejecución, assets, QA y bloqueos creativos.",
  "4_CLAUDE_COWORK_STUDIO": "Sos CLAUDE COWORK. Respondé sobre trabajo del estudio, implementación y bloqueos concretos.",
  "5_DASHBOARD_PRODUCT": "Sos LA OFI. Respondé sobre estado del dashboard/producto y visibilidad operativa.",
  "6_ANALYTICS": "Sos ANALYTICS. Usá solamente métricas presentes en el contexto. Explicá qué pasó, por qué importa y qué acción tomar."
};

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

function normalizeWA(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.startsWith("whatsapp:") ? s : `whatsapp:${s}`;
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function bodyParams(body) {
  if (!body) return {};
  if (typeof body === "object") return body;
  if (typeof body === "string") return Object.fromEntries(new URLSearchParams(body));
  return {};
}

function validateTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const supplied = String(req.headers["x-twilio-signature"] || "");
  if (!authToken || !supplied) return false;

  const url = process.env.TWILIO_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
  const params = bodyParams(req.body);
  let signed = url;

  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (Array.isArray(value)) {
      for (const item of value) signed += `${key}${item ?? ""}`;
    } else {
      signed += `${key}${value ?? ""}`;
    }
  }

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(signed)
    .digest("base64");

  return safeEqual(expected, supplied);
}

function routeAgent(text) {
  const s = String(text || "").toLowerCase();

  if (/\b(content creator|creador de contenido)\b/.test(s)) return "3A_CONTENT_CREATOR";
  if (/\b(social media|community|redes)\b/.test(s)) return "3B_SOCIAL_MEDIA_MANAGER";
  if (/\b(creative producer|productor creativo|producer)\b/.test(s)) return "3C_CREATIVE_PRODUCER";
  if (/\b(job hunter|jobhunter|jobs?|laburo|trabajo|empleo)\b/.test(s)) return "1_JOB_HUNTER";
  if (/\b(sales|ventas?|comercial)\b/.test(s)) return "2_CHIMICHURRI_SALES";
  if (/\b(analytics|anal[ií]tica|m[eé]tricas|ga4)\b/.test(s)) return "6_ANALYTICS";
  if (/\b(brain|cerebro)\b/.test(s)) return "0_BRAIN_CORE";
  if (/\b(orchestrator|orquestador|orquesta)\b/.test(s)) return "0_ORCHESTRATOR_CORE";
  if (/\b(la ofi|dashboard|tablero)\b/.test(s)) return "5_DASHBOARD_PRODUCT";
  if (/\b(claude|cowork)\b/.test(s)) return "4_CLAUDE_COWORK_STUDIO";
  if (/\b(content|contenido|marketing)\b/.test(s)) return "3_CONTENT_OS";

  return "0_ORCHESTRATOR_CORE";
}

function selectModel(text) {
  const s = String(text || "").toLowerCase();
  const deep = /\b(profundo|profundiz|detalle|detallado|analiz|estrategia|diagn[oó]stico|plan completo)\b/.test(s);
  return deep ? "gpt-5.6-terra" : "gpt-5.6-luna";
}

function extractOutputText(data) {
  if (!data || !Array.isArray(data.output)) return "";
  const parts = [];
  for (const item of data.output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (c?.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

async function getContext({ token, agent, message, from, messageSid }) {
  const r = await fetch(CONTEXT_URL, {
    method: "POST",
    signal: AbortSignal.timeout(7000),
    headers: {
      "Content-Type": "application/json",
      "X-CHIMI-TOKEN": token
    },
    body: JSON.stringify({
      action: "context",
      agent_key: agent,
      message,
      from,
      message_sid: messageSid
    })
  });

  if (!r.ok) {
    const error = new Error(`CONTEXT_${r.status}`);
    error.stage = "context";
    error.status = r.status;
    throw error;
  }
  return await r.json();
}

async function recordOutbound({ token, agent, message }) {
  try {
    await fetch(CONTEXT_URL, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-CHIMI-TOKEN": token
      },
      body: JSON.stringify({
        action: "record_outbound",
        agent_key: agent,
        message
      })
    });
  } catch (e) {
    console.error("Failed to record outbound AI reply", e);
  }
}

async function askOpenAI({ apiKey, agent, userText, context }) {
  const guidance = ROLE_GUIDANCE[agent] || ROLE_GUIDANCE["0_ORCHESTRATOR_CORE"];
  const model = selectModel(userText);

  const instructions = [
    guidance,
    "Estás respondiéndole a Lucas por WhatsApp dentro del sistema CHIMICHURRI.",
    "Escribí en español rioplatense natural, directo y operativo.",
    "El bloque CONTEXTO CANÓNICO contiene evidencia viva del sistema. Usalo como fuente de verdad para métricas, estados, entregas, envíos, respuestas y bloqueos.",
    "No inventes números, acciones, emails enviados, respuestas, entregables ni estados. Si el contexto no alcanza para afirmar algo, decilo en una frase.",
    "Si Lucas pide un reporte: empezá por el estado actual, después números/evidencia disponible, después bloqueos y cerrá con la próxima acción concreta.",
    "No menciones JSON, APIs, Supabase, prompts ni arquitectura interna salvo que Lucas lo pregunte.",
    "No pongas tu nombre ni emoji al principio: el bridge agrega automáticamente tu identidad.",
    "Mantené la respuesta normalmente debajo de 1200 caracteres, salvo que Lucas pida detalle."
  ].join("\n");

  const input = [
    "MENSAJE DE LUCAS:",
    userText,
    "",
    "CONTEXTO CANÓNICO:",
    JSON.stringify(context)
  ].join("\n");

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "none" },
      instructions,
      input,
      max_output_tokens: 500
    })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const error = new Error(`OPENAI_${r.status}`);
    error.stage = "openai";
    error.status = r.status;
    error.apiCode = data?.error?.code || null;
    error.apiType = data?.error?.type || null;
    throw error;
  }

  const text = extractOutputText(data);
  if (!text) {
    const error = new Error("OPENAI_EMPTY");
    error.stage = "openai";
    throw error;
  }
  return { text, model };
}

function twimlMessage(text) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response><Message>" +
    escapeXml(text) +
    "</Message></Response>"
  );
}

function friendlyRuntimeError(error) {
  if (error?.apiCode === "credit_balance_exhausted" || error?.apiType === "insufficient_quota") {
    return "El bridge y mi contexto están OK, pero la API de OpenAI se quedó sin saldo. Cargá crédito en Platform Billing y este mismo mensaje va a responder con IA sin tocar nada más.";
  }
  if (error?.status === 401 && error?.stage === "openai") {
    return "El bridge y mi contexto están OK, pero la API key de OpenAI fue rechazada. Hay que revisar OPENAI_API_KEY en Vercel.";
  }
  if (error?.stage === "context") {
    return "Recibí tu mensaje, pero no pude leer el contexto vivo del agente. No voy a inventarte un reporte sin evidencia.";
  }
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return "Recibí tu mensaje, pero el runtime tardó demasiado. Probá de nuevo en unos segundos.";
  }
  return "Recibí tu mensaje, pero falló el runtime de respuesta. El comando quedó registrado para el agente. Probá de nuevo en unos segundos.";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  if (!validateTwilioSignature(req)) {
    return res.status(403).send("Forbidden");
  }

  const body = String(getField(req.body, "Body") || "").trim();
  const from = normalizeWA(getField(req.body, "From"));
  const to = normalizeWA(getField(req.body, "To"));
  const messageSid = String(getField(req.body, "MessageSid") || "").trim();

  const expectedOwner = normalizeWA(process.env.CHIMI_WHATSAPP_TO);
  const expectedTwilio = normalizeWA(process.env.TWILIO_WHATSAPP_FROM);

  if (!body) {
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(200).send(twimlMessage("CHIMI conectado ✅"));
  }

  if (expectedOwner && from !== expectedOwner) {
    return res.status(403).send("Forbidden");
  }

  if (expectedTwilio && to && to !== expectedTwilio) {
    return res.status(403).send("Forbidden");
  }

  const agent = routeAgent(body);
  const bridgeToken = process.env.CHIMI_BRIDGE_TOKEN || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  console.log("Inbound owner WhatsApp", {
    agent,
    messageSid,
    bodyPreview: body.slice(0, 140),
    aiConfigured: Boolean(openaiKey)
  });

  if (!bridgeToken) {
    const formatted = formatAgentMessage(agent, "El bridge recibió tu mensaje, pero falta CHIMI_BRIDGE_TOKEN en runtime.");
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(200).send(twimlMessage(formatted.body));
  }

  if (!openaiKey) {
    const formatted = formatAgentMessage(
      agent,
      "Recibí tu mensaje. El routing funciona, pero falta cargar OPENAI_API_KEY en Vercel para que pueda responderte con IA."
    );
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(200).send(twimlMessage(formatted.body));
  }

  try {
    const context = await getContext({
      token: bridgeToken,
      agent,
      message: body,
      from,
      messageSid
    });

    const answer = await askOpenAI({
      apiKey: openaiKey,
      agent,
      userText: body,
      context
    });

    await recordOutbound({
      token: bridgeToken,
      agent,
      message: answer.text
    });

    const formatted = formatAgentMessage(agent, answer.text);

    console.log("Owner WhatsApp AI reply", {
      agent,
      model: answer.model,
      chars: answer.text.length
    });

    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(200).send(twimlMessage(formatted.body));
  } catch (error) {
    console.error("Inbound AI route failed", {
      message: error?.message,
      stage: error?.stage,
      status: error?.status,
      apiCode: error?.apiCode,
      apiType: error?.apiType
    });
    const formatted = formatAgentMessage(agent, friendlyRuntimeError(error));
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(200).send(twimlMessage(formatted.body));
  }
};
