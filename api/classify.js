import { OpenAI } from "openai";
import fs from "fs";
import path from "path";

export const config = { runtime: "nodejs" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function loadGenreNames() {
  try {
    const p = path.join(process.cwd(), "data", "presets.json");
    const raw = fs.readFileSync(p, "utf-8");
    const json = JSON.parse(raw);
    return Object.keys(json.genres||{}).map(gid => json.genres[gid]?.name || gid);
  } catch { return []; }
}

export default async function handler(req,res){
  try {
    if (req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
    const { text, allowedGenres } = req.body || {};
    if (!text || text.trim().length<2) return res.status(400).json({error:"Input troppo corto"});
    const enumNames = Array.isArray(allowedGenres) && allowedGenres.length ? allowedGenres : loadGenreNames();
    if (!enumNames.length) {
      return res.status(200).json({ genreName: "Sconosciuto", note:"Nessun genere caricato", genreId:"" });
    }
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY mancante"});
    const schema = {
      type:"object",
      properties:{
        genreName:{type:"string", enum: enumNames.concat(["Sconosciuto"]) },
        note:{type:"string"}
      },
      required:["genreName"],
      additionalProperties:false
    };
    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input:[
        {role:"system", content: "Sei un classificatore musicale. Scegli il GENERE PIÙ PROBABILE dall'elenco. Se non è possibile, scegli 'Sconosciuto'. Restituisci SOLO JSON conforme allo schema."},
        {role:"user", content: `Input: ${text}
Generi disponibili: ${enumNames.join(", ")}`}
      ],
      text:{ format:{ type:"json_schema", name:"genre_pick", strict:true, schema } },
      temperature:0
    });
    const outText = resp.output_text || "{}";
    const data = JSON.parse(outText);
    const genreName = data.genreName || "Sconosciuto";
    return res.status(200).json({ genreName, note: data.note||"" });
  } catch(e){
    console.error("[classify]", e);
    return res.status(500).json({error:"classify error", details:String(e?.message||e)});
  }
}
