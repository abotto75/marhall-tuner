import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
export const config = { runtime: "nodejs" };

function loadEnums(){
  // Try to read presets.json, else example file
  let json=null;
  const paths=[path.join(process.cwd(),"data","presets.json"), path.join(process.cwd(),"data","presets_example.json")];
  for(const p of paths){
    try{ const raw=fs.readFileSync(p,"utf-8"); json=JSON.parse(raw); break; }catch{}
  }
  const byId = json?.genres || {};
  const enumIds = Object.keys(byId);
  const idToName = {}; const nameToId={};
  for(const gid of enumIds){
    const name = byId[gid]?.name || gid;
    idToName[gid]=name;
    nameToId[name.toLowerCase()]=gid;
  }
  // Fallback safe list if empty
  if(enumIds.length===0){
    const fallback=[["rock","Rock"],["metal","Metal"],["classica","Classica"],["country","Country"],["ost","Colonne Sonore"],["pop","Pop"]];
    for(const [id,name] of fallback){ idToName[id]=name; nameToId[name.toLowerCase()]=id; enumIds.push(id); }
  }
  return { enumIds, idToName, nameToId };
}

export default async function handler(req, res){
  try{
    if(req.method!=="POST") return res.status(405).json({ error:"Method not allowed" });
    const { text } = req.body || {};
    if(!text || String(text).trim().length<2) return res.status(400).json({ error:"Inserisci almeno 2 caratteri." });
    if(!process.env.OPENAI_API_KEY) return res.status(500).json({ error:"OPENAI_API_KEY mancante" });
    const { enumIds, idToName } = loadEnums();

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const schema = {
      type:"object",
      properties:{
        genreId:{ type:"string", enum: enumIds.concat(["unknown"]) },
        note:{ type:"string" }
      },
      required:["genreId","note"],
      additionalProperties:false
    };

    const sys = `Classifica l'input (artista e/o brano) scegliendo il GENERE PIÙ PROBABILE tra questi ID: ${enumIds.join(", ")}.
Regole: 1) scegli solo tra questi ID; 2) se davvero impossibile, usa "unknown"; 3) aggiungi una nota breve (max 25 parole) per spiegare perché.`;

    const user = `Input: "${text}". Restituisci SOLO JSON valido.`;

    const out = await client.responses.create({
      model,
      input:[{role:"system",content:sys},{role:"user",content:user}],
      text:{ format:{ type:"json_schema", name:"genre_match", strict:true, schema } },
      temperature: 0.2
    });

    const txt = out.output_text || "{}";
    let data={}; try{ data=JSON.parse(txt); }catch{}
    let gid = data.genreId;
    if(gid==="unknown" || !enumIds.includes(gid)){ 
      return res.status(200).json({ genreId:"", genreName:"Sconosciuto", note: data.note || "Non determinabile con sicurezza." });
    }
    const genreName = idToName[gid] || gid;
    return res.status(200).json({ genreId: gid, genreName, note: data.note || "" });
  }catch(e){
    console.error("[classify] error:", e);
    return res.status(500).json({ error:"classify error", details:String(e?.message||e) });
  }
}