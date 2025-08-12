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
    const { artist = "", track = "" } = req.body || {};
    const q = `${artist}`.trim() + (track ? ` — ${track}` : "");
    if (!q || q.length < 3) return res.status(400).json({ error: "Query too short" });

    const presets = loadPresets();
    const genres = Object.keys(presets.genres || {});
    const subMap = presets.subgenres || {};
    const subs = [];
    for (const gid of Object.keys(subMap)) {
      for (const sg of subMap[gid] || []) subs.push({ genreId: gid, subId: sg.id, subName: sg.name });
    }

    const schema = {
      type: "object",
      properties: {
        genreId: { type: "string", enum: genres },
        subId: { type: "string", enum: subs.map(s => s.subId).concat([""]) },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason: { type: "string" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              genreId: { type: "string", enum: genres },
              subId: { type: "string", enum: subs.map(s => s.subId).concat([""]) },
              label: { type: "string" }
            },
            required: ["genreId"],
            additionalProperties: false
          },
          maxItems: 3
        }
      },
      required: ["genreId", "confidence"],
      additionalProperties: false
    };

    const examples = [
      "Chris Stapleton — Tennessee Whiskey => Country, sub: Country Soul/Blues",
      "Hans Zimmer — Time => Colonne Sonore, sub: Cinematic Epico",
      "Gershwin — Rhapsody in Blue => Classica, sub: Jazz Sinfonico"
    ].join("\n");

    const sys = "Sei un classificatore musicale. Scegli un genere e (se esiste) un sottogenere SOLO tra quelli consentiti (enum). Restituisci JSON conforme allo schema.";
    const hint = `Generi: ${genres.map(g => presets.genres[g]?.name || g).join(", ")}. Sottogeneri: ${Object.entries(subMap).map(([gid, list]) => (presets.genres[gid]?.name || gid)+": "+(list||[]).map(s=>s.id+"="+s.name).join("; ")).join(" | ")}`;

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const resp = await client.responses.create({
      model,
      input: [
        { role: "system", content: sys },
        { role: "user", content: `Testo: "${q}".\n${hint}\nEsempi:\n${examples}\nRispondi SOLO in JSON valido (schema).` }
      ],
      temperature: 0.2,
      text: { format: { type: "json_schema", name: "match_result_v2", strict: true, schema } }
    });

    const text = resp.output_text || "{}";
    let data = {};
    try { data = JSON.parse(text); } catch { data = {}; }

    if (!data.genreId) return res.status(200).json({ genreId: genres[0], subId: "", confidence: 0.4, reason: "fallback-none" });

    // clamp fields
    if (!genres.includes(data.genreId)) data.genreId = genres[0];
    if (data.subId && !subs.find(s => s.subId === data.subId)) data.subId = "";
    if (!Array.isArray(data.alternatives)) data.alternatives = [];

    // If low confidence, ensure at least one alternative
    if (data.confidence < 0.6 && data.alternatives.length === 0) {
      const alts = [];
      for (const gid of genres) {
        if (gid === data.genreId) continue;
        const sList = subMap[gid] || [];
        const sid = sList[0]?.id || "";
        const label = (presets.genres[gid]?.name || gid) + (sid ? (" — " + sList[0].name) : "");
        alts.push({ genreId: gid, subId: sid, label });
        if (alts.length >= 3) break;
      }
      data.alternatives = alts;
    }

    return res.status(200).json({
      genreId: data.genreId,
      subId: data.subId || "",
      confidence: data.confidence ?? 0.6,
      reason: data.reason || "ai-classifier",
      alternatives: data.alternatives
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI match error", details: String(err?.message || err) });
  }
}
