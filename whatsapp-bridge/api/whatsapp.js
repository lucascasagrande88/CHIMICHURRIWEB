const { formatAgentMessage } = require("../lib/agent-identities");

const CONTEXT_URL = "https://sctchzxboqnphnzrxvvu.supabase.co/functions/v1/owner-whatsapp-context";

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

  if (!r.ok) throw new Error(`CONTEXT_${r.status}`);
  return await r.json();
}

async function recordOutbound({ token, agent, message }) {
  try {
    await fetch(CONTEXT_URL, {
      method: "POST",
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
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.6-terra",
      instructions,
      input,
      max_output_tokens: 650
    })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    console.error("OpenAI response error", {
      status: r.status,
      type: data?.error?.type,
      code: data?.error?.code
    });
    throw new Error(`OPENAI_${r.status}`);
  }

  const text = extractOutputText(data);
  if (!text) throw new Error("OPENAI_EMPTY");
  return text;
}

function twimlMessage(text) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response><Message>" +
    escapeXml(text) +
    "</Message></Response>"
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
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
    from,
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
      "Recibí tu mensaje. El routing ya funciona, pero falta cargar OPENAI_API_KEY en Vercel para que pueda responderte con IA."
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

    const aiText = await askOpenAI({
      apiKey: openaiKey,
      agent,
      userText: body,
      context
    });

    await recordOutbound({
      token: bridgeToken,
      agent,
      message: aiText
    });

    const formatted = formatAgentMessage(agent, aiText);

    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(200).send(twimlMessage(formatted.body));
  } catch (error) {
    console.error("Inbound AI route failed", error);
    const formatted = formatAgentMessage(
      agent,
      "Recibí el mensaje, pero falló el runtime de respuesta. El comando quedó registrado para el agente. Probá de nuevo en unos segundos."
    );
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    return res.status(200).send(twimlMessage(formatted.body));
  }
};
