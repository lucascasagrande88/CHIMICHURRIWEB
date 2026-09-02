const EXPIRES_AT = Date.parse("2026-09-02T02:45:00Z");

const SIDS = [
  "SMcfb85fb99a842c0671823b28c744b91c",
  "SM00829edb5240df97505f087eaba72f7d",
  "SM538b91a6e512b78fbf2022a9e61369b1",
  "SMc1b8bf6a951e513ecfab1ed3c0365313",
  "SMf93ce6157ac5269c17d00068b6673309",
  "SMbc9f5eb99967f32d258c6f1c6c01f86d",
  "SM6e518fa5385e8f089184d3fcdd16e5db",
  "SM8e3256d0fd78c09c48612e2a3791d468",
  "SM721453f98f649ef08bc945bbd9ca11dd",
  "SMf93783f6fec9704254593a5358eb7590",
  "SM412dd1983ee1f2bda6ff5d2ab7fb1e59"
];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (Date.now() > EXPIRES_AT) {
    return res.status(410).json({ ok: false, error: "Status endpoint expired" });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ ok: false, error: "Missing Twilio environment variables" });
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const results = [];

  for (const sid of SIDS) {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${sid}.json`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const data = await r.json();
    results.push({
      sid,
      ok: r.ok,
      status: data.status || null,
      error_code: data.error_code || null,
      error_message: data.error_message || null
    });
  }

  return res.status(200).json({ ok: true, results });
};
