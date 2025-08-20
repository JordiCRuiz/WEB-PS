// server.js (CommonJS) — Express + Chat Completions por defecto + fallback a Responses y logs
const express = require('express');

const app = express();
app.use(express.json());
app.use(express.static(__dirname, { extensions: ['html'] }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID; // opcional
const DEBUG = process.env.DEBUG_OPENAI === '1';

if (!OPENAI_API_KEY) {
  console.warn(
    '⚠️  OPENAI_API_KEY no está definida. Expórtala antes de arrancar.'
  );
}

function extractAnswer(data) {
  const cc = data?.choices?.[0]?.message?.content;
  if (cc) return cc;
  if (data?.output_text) return data.output_text;
  const contentText = data?.output?.[0]?.content?.[0]?.text;
  if (contentText) return contentText;
  const respText = data?.response?.output_text;
  if (respText) return respText;
  return null;
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
ALWAYS answer in English, ONE concise paragraph (no line breaks), <=120 words.
Tone: professional, clear, helpful.
Scope: industrial operations (SMEs, S&OP, Lean/TPM, KPIs), occupational safety (ISO 45001, hygiene, ergonomics, psychosocial), process safety (chemical risk, ATEX, Seveso III, explosions/fire).
If off-scope, briefly redirect to relevant services.
    `.trim();

    let answer = null;
    let lastError = null;

    // 1) Chat Completions (más universal)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // prueba también 'gpt-4.1-mini' si hiciera falta
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: String(question).trim() },
          ],
          temperature: 0.4,
          max_tokens: 220,
        }),
      });
      const data = await r.json();
      if (DEBUG)
        console.log('🔍 ChatCompletions JSON:', JSON.stringify(data, null, 2));
      if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(data)}`);
      answer = extractAnswer(data);
    } catch (e) {
      lastError = e;
      if (DEBUG) console.error('❌ ChatCompletions error:', e);
    }

    // 2) Fallback a Responses + File Search (si tienes VECTOR_STORE_ID)
    if (!answer && VECTOR_STORE_ID) {
      try {
        const r2 = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            input: [
              { role: 'system', content: system },
              { role: 'user', content: String(question).trim() },
            ],
            temperature: 0.4,
            max_output_tokens: 220,
            tools: [{ type: 'file_search' }],
            attachments: [
              { file_search: { vector_store_ids: [VECTOR_STORE_ID] } },
            ],
          }),
        });
        const data2 = await r2.json();
        if (DEBUG)
          console.log('🔍 Responses JSON:', JSON.stringify(data2, null, 2));
        if (!r2.ok) throw new Error(`${r2.status} ${JSON.stringify(data2)}`);
        answer = extractAnswer(data2);
      } catch (e2) {
        lastError = e2;
        if (DEBUG) console.error('❌ Responses error:', e2);
      }
    }

    if (!answer) {
      // devolvemos error al front para que muestre algo útil
      return res.status(502).json({
        error: 'Upstream returned no text',
        hint: 'Check API key / model / DEBUG logs in server console',
        lastError: String(lastError || ''),
      });
    }

    answer = String(answer).replace(/\s+/g, ' ').trim();
    if (answer.length > 900) answer = answer.slice(0, 900) + '…';

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ answer });
  } catch (e) {
    console.error('💥 Server error:', e);
    return res.status(500).json({ error: 'Server error', detail: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`✅ Local server on http://localhost:${port}`)
);
