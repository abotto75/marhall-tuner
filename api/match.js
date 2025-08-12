// api/match.js
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadPresets() {
  const p = path.join(process.cwd(), "data", "presets.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { artist, track } = req.body || {};
    const qArtist = (artist||'').trim();
    const qTrack = (track||'').trim();
    if (!qArtist && !qTrack) return res.status(400).json({ error: "Missing artist/track" });

    const query = qArtist && qTrack ? `${qArtist} — ${qTrack}` : (qArtist || qTrack);

    const presets = loadPresets();
    const genres = Object.keys(presets.genres || {});
    const subMap = presets.subgenres || {};
    const subPairs = [];
    for (const gid of Object.keys(subMap)) {
      for (const sg of subMap[gid] || []) {
        subPairs.push({ genreId: gid, subId: sg.id, subName: sg.name });
      }
    }

    const schema = {
      type: "object",
      properties: {
        genreId: { type: "string", enum: genres },
        subId: { type: "string", enum: subPairs.map(s => s.subId).concat([""]) },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" }
      },
      required: ["genreId", "confidence"],
      additionalProperties: false
    };

    const sys = "Sei un classificatore musicale. Assegna il testo ad un genere e, se possibile, ad un sottogenere tra quelli ammessi.";
    const hint = `Generi disponibili: ${genres.map(g=>presets.genres[g].name || g).join(", ")}.
Sottogeneri: ${Object.entries(subMap).map(([gid, list]) => {
  const gname = presets.genres[gid]?.name || gid;
  const names = (list||[]).map(sg => `${sg.id}=${sg.name}`).join("; ");
  return `${gname}: ${names}`;
}).join(" | ")}`;

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    let data = null;
    try {
      const resp = await client.responses.create({
        model,
        input: [
          { role: "system", content: sys },
          { role: "user", content: `Testo: "${query}". ${hint}
Rispondi in JSON (schema).` }
        ],
        text: { format: { type: "json_schema", name: "match_result", strict: true, schema } }
      });
      const text = resp.output_text || "{}";
      data = JSON.parse(text);
    } catch (e) {
      data = null;
    }

    if (!data || !data.genreId || data.confidence < 0.5) {
      const q = query.toLowerCase();
      let guessGenre = null;
      // simple heuristics
      for (const gid of genres) {
        const gname = (presets.genres[gid].name || gid).toLowerCase();
        if (gname && q.includes(gname)) { guessGenre = gid; break; }
      }
      if (!guessGenre) {
        if (/(zimmer|soundtrack|score|ost|cinematic|interstellar|gladiator|dune)/.test(q)) guessGenre = genres.find(g => g.includes("colonne") || g.includes("soundtrack") || g.includes("score")) || guessGenre;
        if (/(gershwin|rhapsody in blue|american in paris)/.test(q)) guessGenre = genres.find(g => g.includes("classica") || g.includes("classical")) || guessGenre;
        if (/(stapleton|country|tennessee whiskey)/.test(q)) guessGenre = genres.find(g => g.includes("country")) || guessGenre;
      }
      let guessSub = "";
      if (guessGenre && subMap[guessGenre]) {
        const subs = subMap[guessGenre];
        const hit = subs.find(s => q.includes(s.name.toLowerCase())) || subs[0];
        guessSub = hit?.id || "";
      }
      data = { genreId: guessGenre || genres[0], subId: guessSub || "", confidence: 0.4, reason: "fallback-keywords" };
    }

    return res.status(200).json({
      genreId: data.genreId,
      subId: data.subId || "",
      confidence: data.confidence ?? 0.6,
      reason: data.reason || "ai-classifier"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI match error", details: String(err?.message || err) });
  }
}