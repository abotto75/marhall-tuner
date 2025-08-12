import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadGenresEnum() {
  const p = path.join(process.cwd(), "data", "presets.json");
  let enumNames = ["Pop","Rock","Hip Hop","Rap","R&B","Jazz","Blues","Country","Reggae","Metal","Punk","Folk","Classica","Elettronica","Dance","House","Techno","Trap"];
  let nameToId = {};
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const json = JSON.parse(raw);
    const byId = json.genres || {};
    const names = Object.keys(byId).map(gid => byId[gid]?.name || gid);
    if (names.length) enumNames = names;
    for (const gid of Object.keys(byId)) {
      const nm = (byId[gid]?.name || gid).toLowerCase();
      nameToId[nm] = gid;
    }
  } catch {}
  enumNames = Array.from(new Set(enumNames.concat(["Sconosciuto"])));
  nameToId["sconosciuto"] = "";
  return { enumNames, nameToId };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { text } = req.body || {};
    if (!text || text.trim().length < 3) return res.status(400).json({ error: "Inserisci almeno 3 caratteri." });

    const { enumNames, nameToId } = loadGenresEnum();

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18",
      temperature: 0,
      messages: [
        { role: "system", content: "Sei un classificatore musicale. Usa SEMPRE la funzione set_genre per restituire il risultato. Se il genere non è determinabile con sicurezza, usa 'Sconosciuto'." },
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
    if (!toolCall) return res.status(200).json({ genreId: "", genreName: "Sconosciuto", note: "Nessuna tool call" });

    const args = JSON.parse(toolCall.function.arguments || "{}");
    const genreName = args.genere || "Sconosciuto";
    const note = args.note || "";
    const genreId = nameToId[genreName.toLowerCase()] ?? "";

    return res.status(200).json({ genreId, genreName, note });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "classify error", details: String(err?.message || err) });
  }
}