/* =====================================================================
   CYRO BUS — backend (Node + Express)
   1) Proxy seguro para a Groq API (a chave fica só aqui, no .env).
   2) Também serve o site (index.html, css, js, assets da raiz do repositório): com
      `npm start` tudo fica em http://localhost:3001 (um comando só).
   ===================================================================== */
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { askGroq } = require("./groq");

const app = express();
app.use(cors());
app.use(express.json({ limit: "200kb" }));

const PORT = process.env.PORT || 3001;
const GROQ_API_KEY = (process.env.GROQ_API_KEY || "").trim();
const HAS_KEY = GROQ_API_KEY && !GROQ_API_KEY.startsWith("cole_");
const MODELS = [process.env.GROQ_MODEL || "openai/gpt-oss-120b"]
  .concat((process.env.GROQ_FALLBACK_MODELS || "openai/gpt-oss-20b,llama-3.1-8b-instant").split(","))
  .map(s => s.trim()).filter(Boolean);

// limite simples por IP (protege a chave contra uso abusivo): 20 perguntas/minuto
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 20;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "cyro-bus-backend", ai: !!HAS_KEY, model: MODELS[0] });
});

app.post("/api/assistant", async (req, res) => {
  if (!HAS_KEY) {
    return res.status(503).json({ error: "GROQ_API_KEY não configurada. Copie backend/.env.example para backend/.env e cole sua chave da Groq." });
  }
  if (rateLimited(req.ip)) return res.status(429).json({ error: "Muitas perguntas seguidas. Aguarde um instante." });

  const { system, messages } = req.body || {};
  const clean = (Array.isArray(messages) ? messages : [])
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!clean.length) return res.status(400).json({ error: "Envie 'messages' no corpo da requisição." });

  const full = typeof system === "string" && system
    ? [{ role: "system", content: system.slice(0, 20000) }, ...clean] : clean;

  try {
    const { text, model } = await askGroq({ apiKey: GROQ_API_KEY, models: MODELS, messages: full });
    // formato compatível com OpenAI/Groq (o front lê choices[0].message.content)
    res.json({ choices: [{ message: { role: "assistant", content: text } }], model });
  } catch (err) {
    console.error("Erro no assistente:", err.status, err.message);
    res.status(err.status && err.status >= 400 ? err.status : 502).json({ error: err.message });
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "Rota não encontrada." }));
// O site fica na RAIZ do repositório. Só estas pastas/arquivos são servidos (lista fechada),
// para nunca expor backend/, .env, firestore.rules etc.
const ROOT = path.join(__dirname, "..");
["css", "js", "assets"].forEach(d => app.use("/" + d, express.static(path.join(ROOT, d))));
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(ROOT, "index.html")));

app.listen(PORT, () => {
  console.log(`Cyro Bus rodando em http://localhost:${PORT}  (site + assistente)`);
  console.log(HAS_KEY ? `Assistente IA: modelo ${MODELS[0]}` : "Atenção: GROQ_API_KEY ausente. Crie backend/.env a partir de .env.example. O assistente local continua funcionando.");
});
