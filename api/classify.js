import { OpenAI } from "openai";
import fs from "fs"; import path from "path";
export const config = { runtime: "nodejs" };
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function allowedGenres(){
  try{
    const p = path.join(process.cwd(), "data", "presets.json");
    const rows = JSON.parse(fs.readFileSync(p, "utf-8"));
    return Array.from(new Set(rows.map(r=>String(r.genre).trim())));
  }catch{ return ["Pop","Rock","Metal","Jazz","Classica","Country","Colonne Sonore","Sconosciuto"]; }
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
    const { artist="", track="" } = req.body || {};
    const text = [artist, track].filter(Boolean).join(" — ");
    if(!text || text.length<2) return res.status(400).json({error:"Inserisci almeno 2 caratteri"});
    const genres = Array.from(new Set([...allowedGenres(), "Sconosciuto"]));

    const schema = {
      type:"object",
      properties:{ genreName:{type:"string",enum:genres}, note:{type:"string"} },
      required:["genreName"], additionalProperties:false
    };
    const sys = "Sei un classificatore musicale. Scegli il GENERE PIÙ PROBABILE tra quelli forniti. Usa 'Sconosciuto' solo se impossibile dedurre. Rispondi SOLO in JSON conforme allo schema.";
    const user = `Input: ${text}
Generi consentiti: ${genres.join(", ")}`;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const resp = await client.responses.create({
      model, temperature: 0.2,
      input:[{role:"system",content:sys},{role:"user",content:user}],
      text:{ format:{ type:"json_schema", name:"genre_pick", strict:true, schema } }
    });
    const out = resp.output_text || "{}";
    let data={}; try{ data=JSON.parse(out); }catch{ data={genreName:"Sconosciuto", note:"parse-failed"}; }
    return res.status(200).json({ genreName:data.genreName||"Sconosciuto", note:data.note||"" });
  }catch(e){
    console.error(e);
    return res.status(500).json({ error:"classify error", details:String(e?.message||e) });
  }
}