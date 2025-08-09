import { OpenAI } from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { query, room, volume } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query" });

    const schema = {
      type: "object",
      properties: {
        bass_clock: { type: "number", minimum: 0.5, maximum: 3.5 },
        treble_clock: { type: "number", minimum: 0.5, maximum: 3.5 },
        notes: { type: "string" }
      },
      required: ["bass_clock","treble_clock","notes"],
      additionalProperties: false
    };

    const sys = `Sei un tecnico Marshall. Restituisci SOLO JSON valido secondo lo schema:
- bass_clock e treble_clock in ore (0.5–3.5), niente altro.
- notes: consigli concisi (posizionamento, volume, accorgimenti).
Tieni conto di ambiente="${room}" e volume=${volume}%. Non superare i limiti.`;

    const user = `Suggerisci settaggi per Marshall Acton III per: "${query}"`;

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const resp = await client.responses.create({
      model,
      input: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      response_format: { type: "json_schema", json_schema: { name: "tuning", schema } }
    });

    const text = resp?.output?.[0]?.content?.[0]?.text;
    const data = JSON.parse(text);
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI error", details: String(err?.message||err) });
  }
}
