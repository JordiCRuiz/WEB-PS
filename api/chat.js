// /api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { question } = req.body || {};
    const system = `
You are Jordi Cervero’s consulting assistant.
Always answer in English in ONE concise paragraph (<=120 words).
Topics: industrial operations (SMEs, Lean, S&OP), occupational safety (ISO 45001, hygiene, ergonomics), process safety (ATEX, Seveso III, explosions).
Be professional, clear and brief.
`.trim();

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: system },
          { role: 'user', content: question },
        ],
        max_output_tokens: 200,
      }),
    });
    const data = await r.json();
    const answer = data.output_text || 'No reply generated.';
    res.status(200).json({ answer });
  } catch (e) {
    res.status(500).json({ error: 'Server error', detail: String(e) });
  }
}
