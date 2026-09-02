const IDENTITIES = {
  "0_BRAIN_CORE": { name: "BRAIN", color: "🟣", emoji: "🧠" },
  "0_ORCHESTRATOR_CORE": { name: "ORCHESTRATOR", color: "🔵", emoji: "🎛️" },
  "1_JOB_HUNTER": { name: "JOB HUNTER", color: "🟠", emoji: "🧭" },
  "2_CHIMICHURRI_SALES": { name: "SALES", color: "🟢", emoji: "💼" },
  "3_CONTENT_OS": { name: "CONTENT", color: "🟡", emoji: "🎨" },
  "3A_CONTENT_CREATOR": { name: "CONTENT CREATOR", color: "🩷", emoji: "✍️" },
  "3B_SOCIAL_MEDIA_MANAGER": { name: "SOCIAL MEDIA", color: "🟦", emoji: "📱" },
  "3C_CREATIVE_PRODUCER": { name: "CREATIVE PRODUCER", color: "🟥", emoji: "🎬" },
  "4_CLAUDE_COWORK_STUDIO": { name: "CLAUDE COWORK", color: "⚪", emoji: "🤝" },
  "5_DASHBOARD_PRODUCT": { name: "LA OFI", color: "🟤", emoji: "🏢" },
  "6_ANALYTICS": { name: "ANALYTICS", color: "🔷", emoji: "📊" }
};

const ALIASES = {
  "BRAIN": "0_BRAIN_CORE",
  "BRAIN CORE": "0_BRAIN_CORE",
  "ORCHESTRATOR": "0_ORCHESTRATOR_CORE",
  "ORCHESTRATOR CORE": "0_ORCHESTRATOR_CORE",
  "JOB HUNTER": "1_JOB_HUNTER",
  "JOBHUNTER": "1_JOB_HUNTER",
  "SALES": "2_CHIMICHURRI_SALES",
  "CHIMICHURRI SALES": "2_CHIMICHURRI_SALES",
  "CONTENT": "3_CONTENT_OS",
  "CONTENT OS": "3_CONTENT_OS",
  "CONTENT CREATOR": "3A_CONTENT_CREATOR",
  "SOCIAL MEDIA": "3B_SOCIAL_MEDIA_MANAGER",
  "SOCIAL MEDIA MANAGER": "3B_SOCIAL_MEDIA_MANAGER",
  "CREATIVE PRODUCER": "3C_CREATIVE_PRODUCER",
  "CLAUDE COWORK": "4_CLAUDE_COWORK_STUDIO",
  "LA OFI": "5_DASHBOARD_PRODUCT",
  "DASHBOARD": "5_DASHBOARD_PRODUCT",
  "ANALYTICS": "6_ANALYTICS"
};

function resolveAgentIdentity(input) {
  const raw = String(input || "").trim();
  const upper = raw.toUpperCase();
  const key = IDENTITIES[raw] ? raw : (ALIASES[upper] || raw);
  const identity = IDENTITIES[key] || { name: upper || "CHIMI", color: "⚫", emoji: "🤖" };
  return { key, ...identity };
}

function formatAgentMessage(agent, message) {
  const identity = resolveAgentIdentity(agent);
  return {
    identity,
    body: `${identity.color} ${identity.emoji} *${identity.name}*\n\n${String(message || "").trim()}`
  };
}

module.exports = { IDENTITIES, resolveAgentIdentity, formatAgentMessage };
