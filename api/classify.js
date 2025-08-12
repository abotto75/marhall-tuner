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

function heuristic(text, nameToId){
  const q = (text||"").toLowerCase();
  const is = (s)=>q.includes(s);
  if (/(vivaldi|mozart|bach|beethoven|handel|haydn|mahler|brahms|tchaikovsky)/.test(q)) return {genreName:"Classica"};
  if (/(metallica|slayer|megadeth|iron\s?maiden|thrash|heavy metal)/.test(q)) return {genreName:"Metal"};
  if (/(hans\s?zimmer|soundtrack|score|ost|cinematic|interstellar|gladiator|dune)/.test(q)) return {genreName:"Colonne Sonore"};
  if (/(chris\s?stapleton|country)/.test(q)) return {genreName:"Country"};
  if (/(gershwin|rhapsody in blue|american in paris)/.test(q)) return {genreName:"Classica"};
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { text } = req.body || {};
    if (!text || text.trim().length < 3) return res.status(400).json({ error: "Inserisci almeno 3 caratteri." });

    const { enumNames, nameToId } = loadGenresEnum();

    const systemPrompt = [
      "Sei un esperto classificatore musicale.",
      "Scegli il genere PIÙ PROBABILE tra quelli forniti.",
      "Usa 'Sconosciuto' SOLO se è impossibile dedurre anche una categoria approssimativa.",
      "Rispondi SEMPRE chiamando la funzione set_genre. Niente testo libero."
    ].join(" ");

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
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
    let genreName = "Sconosciuto", note = "";
    if (toolCall) {
      try {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        genreName = args.genere || "Sconosciuto";
        note = args.note || "";
      } catch {}
    }

    // Heuristic rescue if still Sconosciuto
    if (genreName === "Sconosciuto") {
      const h = heuristic(text, nameToId);
      if (h && nameToId[h.genreName.toLowerCase()] !== undefined) {
        genreName = h.genreName;
        note = note || "Heuristic fallback";
      }
    }

    // Optional default via env
    if (genreName === "Sconosciuto") {
      const defName = (process.env.DEFAULT_FALLBACK_GENRE_NAME || "").toLowerCase();
      if (defName && nameToId[defName] !== undefined) {
        genreName = Object.keys(nameToId).find(k => k === defName) || "Sconosciuto";
        note = note || "Fallback di default";
      }
    }

    const genreId = nameToId[genreName.toLowerCase()] ?? "";

    // Debug log (server-side)
    console.log("[classify] input=%s -> genre=%s id=%s note=%s", text, genreName, genreId, note);

    return res.status(200).json({ genreId, genreName, note });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "classify error", details: String(err?.message || err) });
  }
}