/* =====================================================================
   CYRO BUS — cliente da Groq com tolerância a falhas
   • Modelos "gpt-oss" gastam tokens pensando antes de responder: por isso
     usamos reasoning_effort "low" e um limite de saída generoso
     (com max_tokens baixo a resposta chegava VAZIA).
   • Se um modelo falhar (aposentado, limite de uso, erro 5xx, resposta
     vazia), tenta o próximo da lista. Chave inválida (401/403) para na hora.
   ===================================================================== */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function askGroq({ apiKey, models, messages, fetchImpl = fetch, timeoutMs = 25000 }) {
  let last = { status: 502, message: "Falha ao consultar a Groq." };
  for (const model of models) {
    const body = { model, messages, temperature: 0.4, max_completion_tokens: 1200 };
    if (/gpt-oss/.test(model)) body.reasoning_effort = "low";
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(GROQ_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: ctl.signal
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
        if (text) return { text, model };
        last = { status: 502, message: "O modelo devolveu uma resposta vazia." };
        continue;
      }
      last = { status: r.status, message: (data.error && data.error.message) || `Erro ${r.status} na Groq.` };
      if (r.status === 401 || r.status === 403) break; // chave inválida: outro modelo não resolve
    } catch (e) {
      last = e.name === "AbortError"
        ? { status: 504, message: "A Groq demorou demais para responder." }
        : { status: 502, message: "Sem conexão com a Groq." };
    } finally { clearTimeout(timer); }
  }
  const err = new Error(last.message);
  err.status = last.status;
  throw err;
}

module.exports = { askGroq };
