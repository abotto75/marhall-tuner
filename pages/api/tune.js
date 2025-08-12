import { OpenAI } from "openai";
export const config = { runtime: "nodejs" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { query, room, volume, base_bass, base_treble, max_delta } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query" });
    const baseBass = Math.max(0.5, Math.min(3.5, Number(base_bass ?? 2.0)));
    const baseTreble = Math.max(0.5, Math.min(3.5, Number(base_treble ?? 2.0)));
    const delta = Math.max(0.1, Math.min(0.5, Number(max_delta ?? 0.3)));
    const schema = {
      type:"object",
      properties:{
        bass_clock:{type:"number", minimum:baseBass-delta, maximum:baseBass+delta},
        treble_clock:{type:"number", minimum:baseTreble-delta, maximum:baseTreble+delta},
        notes:{type:"string"}
      },
      required:["bass_clock","treble_clock","notes"],
      additionalProperties:false
    };
    const sys=`Sei un tecnico Marshall per Acton III. Parti tassativamente dal preset fornito e ritocca al massimo di ±${delta.toFixed(1)} ore (limiti 0.5–3.5). Restituisci SOLO JSON (schema).`;
    const prompt=`Contesto: ambiente="${room}", volume=${volume}%. Preset di base: bass_clock=${baseBass}, treble_clock=${baseTreble}. Richiesta: ${query}`;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const resp = await client.responses.create({
      model,
      input:[{role:"system",content:sys},{role:"user",content:prompt}],
      text:{ format:{ type:"json_schema", name:"tuning_refined", strict: true, schema } },
      temperature: 0.3
    });
    const text = resp.output_text || resp.output?.[0]?.content?.[0]?.text || "{}";
    const data = JSON.parse(text);
    data.bass_clock=Math.max(baseBass-delta, Math.min(baseBass+delta, data.bass_clock));
    data.treble_clock=Math.max(baseTreble-delta, Math.min(baseTreble+delta, data.treble_clock));
    return res.status(200).json(data);
  } catch (err) {
    console.error("[tune] error:", err);
    return res.status(500).json({ error:"AI error", details:String(err?.message||err) });
  }
}