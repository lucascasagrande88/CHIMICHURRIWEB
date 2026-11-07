import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { makeControl, preflight } from './control.mjs';

const base = 'https://chimichurriweb.vercel.app/api/chimi-call';
const rpc = 'https://sctchzxboqnphnzrxvvu.supabase.co/rest/v1/rpc/chimi_voice_ledger';
const e = process.env;
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && b.length > 0 &&
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
const uuid = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export function validUpgrade(signature, token) {
  if (!signature || !token) return false;
  const route = base + '/media';
  return [route, route + '/', route.replace('https:', 'wss:'), route.replace('https:', 'wss:') + '/']
    .some(url => equal(signature, createHmac('sha1', token).update(url).digest('base64')));
}

export async function ledger(op, args = {}) {
  const key = e.CHIMI_VOICE_BRAIN_KEY;
  const token = e.CHIMI_VOICE_TOKEN;
  if (!key || !token) throw new Error('ledger configuration');
  const res = await fetch(rpc, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_op: op, ...args })
  });
  if (!res.ok) throw new Error('ledger unavailable');
  return res.json();
}

export async function authorizeStart(start) {
  const id = start?.customParameters?.requestId;
  if (!uuid.test(id || '')) return null;
  for (const pause of [0, 250, 500, 1000]) {
    if (pause) await new Promise(r => setTimeout(r, pause));
    const context = await ledger('claim', { p_id: id, p_sid: start.callSid });
    if (context?.agent && context?.topic) return context;
  }
  return null;
}

async function config() {
  const c = {
    accountSid: e.TWILIO_ACCOUNT_SID, authToken: e.TWILIO_AUTH_TOKEN, apiKey: e.OPENAI_API_KEY,
    from: e.TWILIO_VOICE_FROM, to: (e.CHIMI_VOICE_TO || e.CHIMI_WHATSAPP_TO || '').replace(/^whatsapp:/i, ''),
    publicBase: base, enabled: false
  };
  // Select only a single unambiguous eligible number that this account already owns.
  if (!c.from && /^AC[\da-f]{32}$/i.test(c.accountSid || '') && c.authToken) {
    try {
      const url = 'https://api.twilio.com/2010-04-01/Accounts/' + c.accountSid + '/IncomingPhoneNumbers.json?PageSize=100';
      const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { authorization: 'Basic ' + Buffer.from(c.accountSid + ':' + c.authToken).toString('base64') } });
      if (r.ok) {
        const data = await r.json();
        const candidates = data.incoming_phone_numbers?.filter(n => n.capabilities?.voice === true &&
          n.status === 'in-use' && ['local','mobile','national'].includes(n.type) && n.phone_number !== c.to);
        if (!data.next_page_uri && candidates?.length === 1) c.from = candidates[0].phone_number;
      }
    } catch { /* preflight reports the account or number check */ }
  }
  return c;
}

export function route(op) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
    const token = e.CHIMI_VOICE_TOKEN;
    if (!token) return res.status(401).json({error:'authentication_required'});
    try {
      let input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!equal(req.headers.authorization, 'Bearer ' + token)) {
        const ticket = input?.ticket;
        if (!uuid.test(ticket || '') || !equal(input.signature,
          createHmac('sha256', token).update(op + ':' + ticket).digest('hex')))
          return res.status(401).json({error:'authentication_required'});
        input = await ledger('take_' + op, {p_id:ticket});
        if (input == null) return res.status(401).json({error:'ticket_invalid_or_used'});
      }
      const c = await config();
      let state;
      try { state = await ledger('state'); } catch { /* return useful preflight diagnostics */ }
      c.enabled = state?.enabled === true;
      if (op === 'check') {
        const health = await preflight(c);
        health.checks.ledger = typeof state?.enabled === 'boolean' ? 'ok' : 'unknown';
        if (health.checks.ledger !== 'ok') { health.ready = false; health.blockers.push('ledger'); }
        return res.status(200).json(health);
      }
      if (!state) return res.status(503).json({error:'ledger_unavailable'});
      const control = makeControl({config:c, reserve:async i => (await ledger('reserve', {
        p_id:i.requestId, p_agent:i.agent, p_topic:i.topic
      }))?.reserved === true});
      const {status,body} = await control(input);
      if (status === 202) {
        const saved = await ledger('bind', {p_id:body.requestId, p_sid:body.callSid}).catch(()=>null);
        if (!saved?.ok) return res.status(502).json({error:'call_submitted_link_unknown_do_not_retry',requestId:body.requestId});
      }
      return res.status(status).json(body);
    } catch { return res.status(503).json({error:'operation_unavailable_do_not_retry'}); }
  };
}
