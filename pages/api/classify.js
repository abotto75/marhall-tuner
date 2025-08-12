export const config = { runtime: "nodejs" };
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

function loadEnumFromPresets() {
  const tryFiles = ["presets.json","presets_example.json"];
  for (const name of tryFiles) {
    try {
      const p = path.join(process.cwd(), "data", name);
      const raw = fs.readFileSync(p, "utf-8");
      const j = JSON.parse(raw);
      const byId = j.genres || {};
      const enumNames = Object.keys(byId).map(gid => byId[gid]?.name || gid);
      const nameToId = {};
      for (const gid of Object.keys(byId)) nameToId[(byId[gid]?.name || gid).toLowerCase()] = gid;
      if (!enumNames.includes("Sconosciuto")) enumNames.push("Sconosciuto");
      nameToId["sconosciuto"] = "";
      return { enumNames, nameToId };
    } catch {}
  }
  const enumNames = ["Pop","Rock","Hip Hop","Rap","R&B","Jazz","Blues","Country","Reggae","Metal","Punk","Folk","Classica","Elettronica","Dance","House","Techno","Trap","Colonne Sonore","Sconosciuto"];
  const nameToId = Object.fromEntries(enumNames.map(n => [n.toLowerCase(), n.toLowerCase().replace(/\s+/g,'_')]));
  nameToId["sconosciuto"] = "";
  return { enumNames, nameToId };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { text } = req.body || {};
    if (!text || text.trim().length < 3) return res.status(400).json({ error: "Inserisci almeno 3 caratteri." });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY mancante" });

    const { enumNames, nameToId } = loadEnumFromPresets();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Sei un esperto classificatore musicale. Determina il genere PIÙ PROBABILE dato artista e/o brano tra quelli nell'elenco. " +
            "Usa SEMPRE la funzione set_genre. Usa 'Sconosciuto' solo se impossibile dedurre una categoria sensata."
        },
        { role: "user", content: text }
      ],
      tools: [{
        type: "function",
        function: {
          name: "set_genre",
          description: "Imposta il genere classificato.",
          parameters: {
            type: "object",
            properties: {
              genere: { type: "string", enum: enumNames },
              note: { type: "string", description: "Motivo sintetico (max 25 parole)." }
            },
            required: ["genere"],
            additionalProperties: false
          },
          strict: true
        }
      }],
      tool_choice: { type: "function", function: { name: "set_genre" } }
    });

    const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments || "{}") : {};
    const genreName = args.genere || "Sconosciuto";
    const note = args.note || "";
    const genreId = nameToId[genreName.toLowerCase()] ?? "";

    return res.status(200).json({ genreId, genreName, note });
  } catch (e) {
    console.error("[classify] error:", e);
    return res.status(500).json({ error: "classify error", details: String(e?.message || e) });
  }
}