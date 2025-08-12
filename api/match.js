import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadPresets() {
  const p = path.join(process.cwd(), "data", "presets.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function buildSchema(presets){
  const genres = Object.keys(presets.genres || {});
  const subMap = presets.subgenres || {};
  const subs = [];
  for (const gid of Object.keys(subMap)) {
    for (const sg of subMap[gid] || []) subs.push(sg.id);
  }
  return {
    type: "object",
    properties: {
      genreId: { type: "string", enum: genres },
      subId: { type: "string", enum: subs.concat([""]) },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string" }
    },
    required: ["genreId", "confidence"],
    additionalProperties: false
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { artist = "", track = "" } = req.body || {};
    const A = String(artist||"").trim();
    const T = String(track||"").trim();
    if (A.length < 3 && T.length < 3) {
      return res.status(400).json({ error: "Input troppo corto: inserisci almeno 3 caratteri in Artista o Brano." });
    }

    const presets = loadPresets();
    const schema = buildSchema(presets);

    const genres = Object.keys(presets.genres || {});
    const subMap = presets.subgenres || {};
    const subPairs = [];
    for (const gid of Object.keys(subMap)) {
      for (const sg of subMap[gid] || []) subPairs.push({ genreId: gid, subId: sg.id, subName: sg.name });
    }

    const sys = "Sei un classificatore musicale. Dato artista e/o brano, scegli il genere (e sottogenere se opportuno) tra quelli elencati. Se incerto, scegli il più plausibile.";
    const hint = `Generi disponibili: ${genres.map(g=>presets.genres[g].name || g).join(", ")}.
Sottogeneri: ${Object.entries(subMap).map(([gid, list]) => {
  const gname = presets.genres[gid]?.name || gid;
  const names = (list||[]).map(sg => `${sg.id}=${sg.name}`).join("; ");
  return `${gname}: ${names}`;
}).join(" | ")}`;

    const query = `Artista: "${A || '-'}"; Brano: "${T || '-'}" . ${hint}
Rispondi in JSON (schema).`;

    let data = null;
    try {
      const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
      const resp = await client.responses.create({
        model,
        input: [
          { role: "system", content: sys },
          { role: "user", content: query }
        ],
        text: { format: { type: "json_schema", name: "match_result", strict: true, schema } }
      });
      const text = resp.output_text || "{}";
      data = JSON.parse(text);
    } catch (e) {
      // continue to fallback
      data = null;
    }

    // Validation + thresholds
    const validGenre = data && genres.includes(data.genreId);
    const conf = data?.confidence ?? 0;
    if (!validGenre || conf < 0.55) {
      // Fallback: basic heuristics
      const q = (A + " " + T).toLowerCase();
      let guessGenre = null;
      // keyword families
      if (/(zimmer|williams|morricone|soundtrack|score|ost|cinematic|interstellar|gladiator|dune)/.test(q)) {
        guessGenre = genres.find(id => (presets.genres[id].name || id).toLowerCase().includes("colonne") || (presets.genres[id].name || id).toLowerCase().includes("sound"));
      }
      if (!guessGenre && /(gershwin|rhapsody in blue|american in paris)/.test(q)) {
        guessGenre = genres.find(id => (presets.genres[id].name || id).toLowerCase().includes("classica"));
      }
      if (!guessGenre && /(stapleton|country|tennessee whiskey)/.test(q)) {
        guessGenre = genres.find(id => (presets.genres[id].name || id).toLowerCase().includes("country"));
      }
      // default: do not force POP; pick first genre to avoid bias
      if (!guessGenre) guessGenre = genres[0] || "";
      let guessSub = "";
      if (guessGenre && subMap[guessGenre]) {
        const subs = subMap[guessGenre];
        const hit = subs.find(s => q.includes(s.name.toLowerCase()));
        guessSub = (hit && hit.id) || "";
      }
      return res.status(200).json({ genreId: guessGenre, subId: guessSub, confidence: 0.4, reason: "fallback-keywords" });
    }

    return res.status(200).json({
      genreId: data.genreId, subId: data.subId || "", confidence: conf, reason: data.reason || "ai-classifier"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI match error", details: String(err?.message || err) });
  }
}
