import test from "node:test";
import assert from "node:assert/strict";
import { makeControl, preflight } from "./control.mjs";

const config = {
  accountSid: "AC" + "1".repeat(32), authToken: "fixture-token", apiKey: "fixture-openai",
  from: "+12025550123", to: "+5491100000000", publicBase: "https://voice.example.test/functions/v1/chimi-call/",
  enabled: true,
};
const input = { requestId: "acebd205-e298-4404-8433-23e7ffb1bae4", agent: "Orquestador", topic: "Prueba de audio" };
const callSid = "CA" + "2".repeat(32);
const fromRow = { phone_number: config.from, capabilities: { voice: true }, type: "local", status: "in-use" };
function provider(overrides = {}) {
  const seen = [];
  const fetcher = async (url, init) => {
    seen.push({ url, init });
    const key = url.endsWith("/Calls.json") ? "dial" :
      url.includes("/IncomingPhoneNumbers") ? "numbers" : url.includes("Countries/AR") ? "geo" :
      url.includes("api.openai.com") ? "model" : "account";
    const good = {
      account: { status: "active", type: "Full", sid: config.accountSid },
      numbers: { incoming_phone_numbers: [fromRow] }, geo: { iso_code: "AR", low_risk_numbers_enabled: true },
      model: { id: "gpt-live-1" }, dial: { sid: callSid, status: "queued" },
    };
    const reply = overrides[key] || good[key];
    if (reply instanceof Error) throw reply;
    return reply instanceof Response ? reply : Response.json(reply);
  };
  return { seen, fetcher };
}
const never = () => { throw Error("should not be called"); };

test("preflight uses fixed read-only destinations and redacts secrets and numbers", async () => {
  const { fetcher, seen } = provider();
  const report = await preflight({ ...config, enabled: false }, fetcher);
  assert.equal(report.ready, true);
  assert.equal(report.enabled, false);
  assert.equal(seen.length, 4);
  assert.ok(seen.every(r => r.init.method === "GET"));
  for (const text of [config.apiKey, config.authToken, config.to, config.from, config.accountSid])
    assert.ok(!JSON.stringify(report).includes(text));
});

test("preflight lists independent blockers and flags ambiguous access without implying a live call", async () => {
  const { fetcher } = provider({
    account: { type: "Trial", status: "active", sid: config.accountSid },
    numbers: { incoming_phone_numbers: [{ ...fromRow, type: "tollFree" }] },
    geo: { iso_code: "AR", low_risk_numbers_enabled: false },
    model: new Response("unavailable", { status: 503 }),
  });
  const r = await preflight(config, fetcher);
  assert.equal(r.ready, false);
  assert.equal(r.checks.twilioAccount, "trial");
  assert.equal(r.checks.ownedVoiceNumber, "not_eligible");
  assert.equal(r.checks.argentinaLowRisk, "disabled");
  assert.equal(r.checks.voiceModelVisible, "unknown");
});

test("preflight with missing sender reports owned inventory without exposing its contents", async () => {
  const r = await preflight({ ...config, from: "" }, provider().fetcher);
  assert.equal(r.ready, false);
  assert.equal(r.checks.ownedVoiceNumber, "one_available");
  assert.ok(!JSON.stringify(r).includes(config.from));
});

test("controls reject a destination override, invalid request id, empty topic, or oversized topic before work", async () => {
  const call = makeControl({ config, reserve: never, fetcher: never });
  for (const i of [{ ...input, to: "+12025550999" }, { ...input, requestId: '"/>' }, { ...input, topic: "" },
    { ...input, topic: "x".repeat(301) }]) assert.equal((await call(i)).status, 400);
});

test("disabled state is fail-closed, including truthy string values", async () => {
  for (const enabled of [false, "true", undefined]) {
    const call = makeControl({ config: { ...config, enabled }, reserve: never, fetcher: never });
    assert.equal((await call(input)).body.error, "outbound_disabled");
  }
});

test("incomplete provider checks block any POST and any reservation", async () => {
  const { fetcher, seen } = provider({ geo: new Response("", { status: 403 }) });
  const out = await makeControl({ config, reserve: never, fetcher })(input);
  assert.equal(out.status, 503);
  assert.equal(out.body.checks.argentinaLowRisk, "access_denied");
  assert.ok(seen.every(x => x.init.method === "GET"));
});

test("only a successful global reservation allows dialing", async () => {
  for (const reserve of [async () => false, async () => null, async () => { throw new Error("db unavailable"); }]) {
    const { fetcher, seen } = provider();
    const r = await makeControl({ config, reserve, fetcher })(input);
    assert.ok([409, 503].includes(r.status));
    assert.equal(seen.filter(x => x.init.method === "POST").length, 0);
  }
});

test("one bounded unrecorded POST to the fixed owner; submission never implies answered", async () => {
  const { fetcher, seen } = provider();
  const r = await makeControl({ config, reserve: async () => true, fetcher })(input);
  assert.equal(r.status, 202);
  assert.equal(r.body.status, "submitted");
  assert.equal(r.body.callSid, callSid);
  const posts = seen.filter(x => x.init.method === "POST");
  assert.equal(posts.length, 1);
  const { body } = posts[0].init;
  assert.equal(body.get("To"), config.to);
  assert.equal(body.get("From"), config.from);
  assert.equal(body.get("Timeout"), "25");
  assert.equal(body.get("TimeLimit"), "240");
  assert.equal(body.get("Record"), "false");
  assert.ok(body.get("Twiml").includes('wss://voice.example.test/functions/v1/chimi-call/media'));
  assert.ok(body.get("Twiml").includes(input.requestId));
  assert.ok(!body.get("Twiml").includes(input.topic));
  assert.ok(body.get("Twiml").includes("</Connect><Hangup/>"));
});

test("network, provider 5xx and malformed success each return ambiguous outcome with zero retries", async () => {
  for (const dial of [new Error(config.authToken), new Response("upstream", { status: 500 }), { sid: "invalid" }]) {
    const { fetcher, seen } = provider({ dial });
    const r = await makeControl({ config, reserve: async () => true, fetcher })(input);
    assert.equal(r.body.error, "outcome_unknown_do_not_retry");
    assert.equal(seen.filter(x => x.init.method === "POST").length, 1);
    assert.ok(!JSON.stringify(r).includes(config.authToken));
  }
});
