// server.js — Express local con fallback y logs útiles
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json());
app.use(express.static(__dirname, { extensions: ['html'] }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn(
    '⚠️  OPENAI_API_KEY no está definida. Expórtala antes de arrancar.'
  );
}

app.post('/api/chat', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (
      !question ||
      typeof question !== 'string' ||
      question.trim().length < 3
    ) {
      return res.status(400).json({ error: 'Invalid question' });
    }

    const system = `
You are Jordi Cervero’s consulting assistant.
ALWAYS answer in English, in ONE concise paragraph (no line breaks), <=120 words.
Tone: professional, clear, helpful.
Scope: industrial operations (SMEs, S&OP, Lean/TPM, KPIs), occupational safety (ISO 45001, hygiene, ergonomics, psychosocial), process safety (chemical risk, ATEX, Seveso III, explosions/fire).
If off-scope, briefly redirect to relevant services.
`.trim();

    // --------- 1) Intento con Responses API ----------
    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID; // opcional
    const responsesPayload = {
      model: 'gpt-4o-mini',
      input: [
        { role: 'system', content: system },
        { role: 'user', content: String(question).trim() },
      ],
      temperature: 0.4,
      max_output_tokens: 220,
    };
    if (vectorStoreId) {
      responsesPayload.tools = [{ type: 'file_search' }];
      responsesPayload.attachments = [
        { file_search: { vector_store_ids: [vectorStoreId] } },
      ];
    }

    let answer;

    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(responsesPayload),
      });

      if (!r.ok) {
        const detail = await r.text();
        console.error('❌ Responses API error:', r.status, detail);
        throw new Error(`Responses API failed ${r.status}`);
      }

      const data = await r.json();
      // Formatos posibles en Responses API
      answer =
        data?.output_text ||
        data?.output?.[0]?.content?.[0]?.text ||
        data?.response?.output_text || // por compatibilidad
        null;
    } catch (err) {
      // --------- 2) Fallback a Chat Completions ----------
      const chatPayload = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: String(question).trim() },
        ],
        temperature: 0.4,
        max_tokens: 220,
      };

      const r2 = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(chatPayload),
      });

      if (!r2.ok) {
        const detail2 = await r2.text();
        console.error('❌ Chat Completions error:', r2.status, detail2);
        return res
          .status(r2.status)
          .json({ error: 'Upstream error', detail: detail2 });
      }

      const data2 = await r2.json();
      answer = data2?.choices?.[0]?.message?.content || null;
    }

    // Normaliza a un único párrafo
    if (!answer) answer = 'Sorry, I could not generate a reply at this time.';
    answer = String(answer).replace(/\s+/g, ' ').trim();
    if (answer.length > 900) answer = answer.slice(0, 900) + '…';

    res.setHeader('Cache-Control', 'no-store');
    res.json({ answer });
  } catch (e) {
    console.error('💥 Server error:', e);
    res.status(500).json({ error: 'Server error', detail: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`✅ Local server on http://localhost:${port}`)
);
