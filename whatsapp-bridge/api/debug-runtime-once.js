module.exports = async function handler(req, res) {
  const token = process.env.CHIMI_BRIDGE_TOKEN || "";
  const apiKey = process.env.OPENAI_API_KEY || "";
  const out = { context: null, openai: null };

  try {
    const r = await fetch("https://sctchzxboqnphnzrxvvu.supabase.co/functions/v1/owner-whatsapp-context", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CHIMI-TOKEN": token },
      body: JSON.stringify({
        action: "context",
        agent_key: "2_CHIMICHURRI_SALES",
        message: "Reporte de sales",
        from: "whatsapp:test",
        message_sid: "SMDEBUG"
      })
    });
    out.context = { status: r.status, body: await r.text() };
  } catch (e) {
    out.context = { error: String(e) };
  }

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-terra",
        input: "Respondé solamente: OK",
        max_output_tokens: 20
      })
    });
    const body = await r.text();
    out.openai = { status: r.status, body };
  } catch (e) {
    out.openai = { error: String(e) };
  }

  res.status(200).json(out);
};