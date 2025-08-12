
// pages/api/match.js — v6.4.2 Strong Classifier (OpenAI + Anchors fallback)
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadJSON(relPath) {
  const p = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function normalize(s="") {
  const t = s.toLowerCase();
  const strip = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return strip.replace(/[^a-z0-9]+/g, '');
}

function tryAnchor(artist, track, genres, subIds) {
  try {
    const anchors = loadJSON("data/anchors.json");
    const hay = (normalize(artist) + " " + normalize(track)).trim();
    if (!hay) return null;
    for (const key of Object.keys(anchors)) {
      if (hay.includes(key)) {
        const cfg = anchors[key];
        if (!genres.includes(cfg.genreId)) continue;
        let sub = "";
        if (Array.isArray(cfg.subIdIfExists)) {
          for (const candidate of cfg.subIdIfExists) {
            if (candidate && subIds.includes(candidate)) { sub = candidate; break; }
          }
        }
        return { genreId: cfg.genreId, subId: sub, confidence: 0.95, reason: "anchor-match", alternatives: [] };
      }
    }
  } catch {}
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { artist="", track="" } = req.body || {};
    const artistTrim = String(artist||"").trim();
    const trackTrim = String(track||"").trim();
    if (artistTrim.length < 3 && trackTrim.length < 3) {
      return res.status(400).json({ error: "INPUT_TOO_SHORT", message: "Inserisci almeno 3 caratteri in Artista o Brano." });
    }

    const presets = loadJSON("data/presets.json");
    const genres = Object.keys(presets.genres || {});
    const subMap = presets.subgenres || {};
    const subIds = [];
    for (const gid of Object.keys(subMap)) for (const sg of subMap[gid]||[]) subIds.push(sg.id);

    // 1) Anchor fast-path (evita bias 'Pop')
    const anchored = tryAnchor(artistTrim, trackTrim, genres, subIds);
    if (anchored) return res.status(200).json(anchored);

    // 2) OpenAI strict schema
    const schema = {
      type: "object",
      properties: {
        genreId: { type: "string", enum: genres },
        subId: { type: "string", enum: subIds.concat([""]) },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        alternatives: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              genreId: { type: "string", enum: genres },
              subId: { type: "string", enum: subIds.concat([""]) },
              label: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["genreId", "subId", "label", "confidence"],
            additionalProperties: false
          }
        }
      },
      required: ["genreId", "subId", "confidence", "reason", "alternatives"],
      additionalProperties: false
    };

    const sys = `Sei un bibliotecario musicale esperto. Devi mappare (artista, brano) su un GENERE e, se possibile, un SOTTOGENERE tra quelli disponibili. 
- Usa SOLO i valori permessi (enum). 
- NON scegliere "Pop" a meno che il testo indichi chiaramente pop/dance-pop (es. Ariana Grande, Taylor Swift, Dua Lipa).
- Se riconosci compositori classici (es. Vivaldi, Mozart), scegli il genere Classica e un sottogenere coerente SOLO se presente negli enum.
- Se riconosci band metal note (Metallica, Slayer, Megadeth) preferisci il genere Metal con sottogenere coerente se disponibile.
- Se riconosci compositori di film (Hans Zimmer, John Williams, Ennio Morricone) preferisci Colonne Sonore.
- Se incerto, fornisci anche alternative (1-3) usando SEMPRE gli enum.`;

    const hint = `Generi: ${genres.join(", ")}. Sottogeneri per genere: ${Object.entries(subMap).map(([gid, list]) => {
      const names = (list||[]).map(sg => `${sg.id}=${sg.name}`).join("; ");
      return `${gid}: ${names}`;
    }).join(" | ")}`;

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const resp = await client.responses.create({
      model,
      input: [
        { role: "system", content: sys },
        { role: "user", content: `Artista: "${artistTrim}"\nBrano: "${trackTrim}"\n${hint}\nRispondi SOLO in JSON valido secondo lo schema.` }
      ],
      text: { format: { type: "json_schema", name: "match_result_v2", strict: true, schema } },
      temperature: 0.2
    });

    const raw = resp.output_text || "{}";
    let data = {};
    try { data = JSON.parse(raw); } catch { data = {}; }

    // Guard rail finale
    const okGenre = genres.includes(data.genreId);
    const okSub = !data.subId || subIds.includes(data.subId);
    if (!okGenre) data.genreId = genres[0] || "";
    if (!okSub) data.subId = "";

    if (!Array.isArray(data.alternatives)) data.alternatives = [];
    data.alternatives = data.alternatives.filter(a => a && genres.includes(a.genreId) && (a.subId==="" || subIds.includes(a.subId))).slice(0,3);

    return res.status(200).json({
      genreId: data.genreId,
      subId: data.subId || "",
      confidence: typeof data.confidence === "number" ? data.confidence : 0.6,
      reason: data.reason || "ai-classifier",
      alternatives: data.alternatives
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI match error", details: String(err?.message || err) });
  }
}
