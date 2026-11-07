// Server-side module. The HTTP host authenticates the agent before invoking this API.
const MODEL = "gpt-live-1";
const E164 = /^\+[1-9]\d{7,14}$/;
const AR_MOBILE = /^\+549[1-9]\d{9}$/;
const ACCOUNT = /^AC[0-9a-f]{32}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CALL_SID = /^CA[0-9a-f]{32}$/i;
const result = (status, body) => ({ status, body });
const present = value => typeof value === "string" && value.length > 0 && value.trim() === value;
const twilioBase = c => "https://api.twilio.com/2010-04-01/Accounts/" + c.accountSid;

function mediaUrl(base) {
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    url.protocol = "wss:";
    url.pathname = url.pathname.replace(/\/+$/, "") + "/media";
    return url.href;
  } catch { return null; }
}

function configChecks(c) {
  return {
    twilioCredentials: ACCOUNT.test(c.accountSid) && /^[\x21-\x7e]+$/.test(c.authToken || "") ? "ok" : "missing_or_invalid",
    openaiKey: present(c.apiKey) ? "ok" : "missing",
    ownerMobile: AR_MOBILE.test(c.to) && c.to !== c.from ? "ok" : "missing_or_invalid",
    voiceFrom: E164.test(c.from) ? "ok" : "missing_or_invalid",
    mediaAddress: mediaUrl(c.publicBase) ? "ok" : "missing_or_invalid",
  };
}

function validInput(i) {
  if (!i || typeof i !== "object" || Array.isArray(i) || Object.keys(i).length !== 3) return false;
  if (!["requestId", "agent", "topic"].every(k => Object.hasOwn(i, k))) return false;
  return typeof i.requestId === "string" && UUID.test(i.requestId) &&
    present(i.agent) && /^[\p{L}\p{N} _.-]{1,64}$/u.test(i.agent) &&
    present(i.topic) && i.topic.length <= 300 && !/[\x00-\x1f\x7f]/.test(i.topic);
}

async function inspect(fetcher, url, authorization) {
  try {
    const res = await fetcher(url, {
      method: "GET", headers: { authorization }, signal: AbortSignal.timeout(8000), redirect: "error",
    });
    if (!res.ok) {
      return { error: res.status === 401 || res.status === 403 ? "access_denied" :
        res.status === 404 ? "not_found" : "unknown" };
    }
    return { data: await res.json() };
  } catch { return { error: "unknown" }; }
}

function callerCheck(reply, from) {
  if (reply.error) return reply.error;
  const numbers = reply.data?.incoming_phone_numbers;
  if (!Array.isArray(numbers)) return "unknown";
  const matches = numbers.filter(n => n.capabilities?.voice === true && ["local", "mobile", "national"].includes(n.type) &&
    n.status === "in-use" && (!from || n.phone_number === from));
  if (from) return matches.length ? "ok" : "not_eligible";
  if (reply.data.next_page_uri && matches.length < 2) return "inventory_incomplete";
  if (matches.length === 1) return "one_available";
  return matches.length ? "multiple_available" : "none_available";
}

// Read-only checks. Model visibility verifies key access, not credit balance or a working call.
export async function preflight(config, fetcher = fetch) {
  const checks = configChecks(config);
  const twilioReady = checks.twilioCredentials === "ok";
  const auth = twilioReady ? "Basic " + btoa(config.accountSid + ":" + config.authToken) : "";
  const base = twilioBase(config);
  const skip = { error: "not_checked" };
  const hasFrom = checks.voiceFrom === "ok";
  const params = new URLSearchParams({ PageSize: "100" });
  if (hasFrom) params.set("PhoneNumber", config.from);
  const [account, numbers, geo, model] = await Promise.all([
    twilioReady ? inspect(fetcher, base + ".json", auth) : skip,
    twilioReady ? inspect(fetcher, base + "/IncomingPhoneNumbers.json?" + params, auth) : skip,
    twilioReady ? inspect(fetcher, "https://voice.twilio.com/v1/DialingPermissions/Countries/AR", auth) : skip,
    checks.openaiKey === "ok" ? inspect(fetcher, "https://api.openai.com/v1/models/" + MODEL, "Bearer " + config.apiKey) : skip,
  ]);
  checks.twilioAccount = account.error || (
    account.data?.sid !== config.accountSid ? "unknown" :
    account.data.type === "Trial" ? "trial" :
    account.data.status !== "active" ? "inactive_or_unknown" :
    account.data.type === "Full" ? "ok" : "unknown");
  checks.ownedVoiceNumber = callerCheck(numbers, hasFrom ? config.from : null);
  const arAllowed = geo.data?.iso_code === "AR" ? geo.data.low_risk_numbers_enabled : null;
  checks.argentinaLowRisk = geo.error || (arAllowed === true ? "ok" : arAllowed === false ? "disabled" : "unknown");
  checks.voiceModelVisible = model.error || (model.data?.id === MODEL ? "ok" : "unknown");
  const blockers = Object.keys(checks).filter(key => checks[key] !== "ok");
  return { ready: !blockers.length, enabled: config.enabled === true, checks, blockers };
}

// reserve() must atomically enforce replay protection, a global lock and a spending quota.
// Reserve before the POST and retain the lock if its outcome is ambiguous.
export function makeControl({ config, reserve, fetcher = fetch }) {
  return async input => {
    if (!validInput(input)) return result(400, { error: "invalid_request" });
    if (config.enabled !== true) return result(409, { error: "outbound_disabled" });
    const health = await preflight(config, fetcher);
    if (!health.ready) return result(503, { error: "preflight_blocked", checks: health.checks });
    try {
      if (await reserve(input) !== true) return result(409, { error: "duplicate_or_rate_limited" });
    } catch { return result(503, { error: "reservation_unavailable" }); }

    const xmlUrl = mediaUrl(config.publicBase).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
    const twiml = '<Response><Connect><Stream url="' + xmlUrl + '"><Parameter name="requestId" value="' +
      input.requestId + '"/></Stream></Connect><Hangup/></Response>';
    const body = new URLSearchParams({
      To: config.to, From: config.from, Twiml: twiml, TimeLimit: "240", Timeout: "25", Record: "false",
    });
    try {
      const res = await fetcher(twilioBase(config) + "/Calls.json", {
        method: "POST", headers: {
          authorization: "Basic " + btoa(config.accountSid + ":" + config.authToken),
          "content-type": "application/x-www-form-urlencoded",
        }, body, redirect: "error", signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const accepted = await res.json();
        if (CALL_SID.test(accepted.sid || "")) return result(202, {
          status: "submitted", callSid: accepted.sid, requestId: input.requestId,
        });
      } else if (res.status >= 400 && res.status < 500) {
        const data = await res.json().catch(() => ({}));
        return result(502, { error: "twilio_rejected", providerCode: Number.isInteger(data.code) ? data.code : null });
      }
    } catch { /* Connection can fail after Twilio has already received the request. */ }
    return result(502, { error: "outcome_unknown_do_not_retry", requestId: input.requestId });
  };
}
