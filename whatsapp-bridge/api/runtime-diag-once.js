module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false });

  const bridgeToken = process.env.CHIMI_BRIDGE_TOKEN || "";
  const apiKey = process.env.OPENAI_API_KEY || "";
  const result = { context: null, openai: null };

  try {
    const r = await fetch("https://sctchzxboqnphnzrxvvu.supabase.co/functions/v1/owner-whatsapp-context", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CHIMI-TOKEN": bridgeToken },
      body: JSON.stringify({
        action: "context",
        agent_key: "2_CHIMICHURRI_SALES",
        message: "Reporte de sales",
        from: "whatsapp:diagnostic",
        message_sid: "SMDIAG20260908"
      })
    });
    result.context = { status: r.status, ok: r.ok };
  } catch (e) {
    result.context = { ok: false, error: String(e).slice(0, 200) };
  }

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-5.6-terra", input: "Respond only OK", max_output_tokens: 20 })
    });
    const data = await r.json().catch(() => ({}));
    result.openai = {
      status: r.status,
      ok: r.ok,
      error_type: data?.error?.type || null,
      error_code: data?.error?.code || null,
      error_message: data?.error?.message ? String(data.error.message).slice(0, 220) : null,
      has_output: Array.isArray(data?.output)
    };
  } catch (e) {
    result.openai = { ok: false, error: String(e).slice(0, 200) };
  }

  return res.status(200).json(result);
};
