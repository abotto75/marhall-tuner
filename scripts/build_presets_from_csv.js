#!/usr/bin/env node
/**
 * build_presets_from_csv.js
 * Usage: node scripts/build_presets_from_csv.js <input.csv> <output.json>
 * - CSV must be delimited by semicolons (;)
 * - Columns: Genere;Sottogenere;Bass (0-10);Treble (0-10)
 * - "Generico/Generica" row per Genere is used as the base preset, if present.
 * - Top genres order is computed by popularity = row count per Genere (desc).
 */
const fs = require('fs');
const path = require('path');

function slugify(s){
  return (s||'')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'') || 'x';
}
function ledToClock(x){
  const v = Math.max(0, Math.min(10, Number(x)||0));
  return Math.round((0.5 + 0.3*v) * 100)/100;
}
function parseCSV(content){
  // Simple semicolon CSV parser with quotes support
  const rows = [];
  let i=0, cur='', inQ=false;
  const push = () => { rows[rows.length-1].push(cur); cur=''; };
  rows.push([]);
  while (i < content.length){
    const ch = content[i];
    if (inQ){
      if (ch === '"'){
        if (content[i+1] === '"'){ cur += '"'; i++; } else { inQ=false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"'){ inQ = true; }
      else if (ch === ';'){ push(); }
      else if (ch === '\n'){ push(); rows.push([]); }
      else if (ch === '\r'){ /* ignore */ }
      else { cur += ch; }
    }
    i++;
  }
  // finalize last cell
  if (rows.length && rows[rows.length-1]){
    rows[rows.length-1].push(cur);
  }
  // trim empty trailing row if present
  if (rows.length && rows[rows.length-1].every(c => c==='' )) rows.pop();
  return rows;
}

function main(){
  const [,, inCsv, outJson] = process.argv;
  if (!inCsv || !outJson){
    console.error('Usage: node scripts/build_presets_from_csv.js <input.csv> <output.json>');
    process.exit(1);
  }
  const raw = fs.readFileSync(inCsv, 'utf8');
  const rows = parseCSV(raw);
  if (!rows.length) throw new Error('CSV vuoto');
  const header = rows[0].map(h=>h.trim().toLowerCase());
  const gi = header.indexOf('genere');
  const si = header.indexOf('sottogenere');
  const bi = header.findIndex(h => h.startsWith('bass'));
  const ti = header.findIndex(h => h.startsWith('treble'));
  if (gi<0 || si<0 || bi<0 || ti<0){
    throw new Error('Intestazioni CSV non valide. Attese: Genere;Sottogenere;Bass (0-10);Treble (0-10)');
  }

  const data = rows.slice(1).map(r => ({
    g: (r[gi]||'').trim(),
    s: (r[si]||'').trim(),
    b: ledToClock(r[bi]),
    t: ledToClock(r[ti])
  })).filter(r => r.g);

  // Popularità per conteggio righe
  const counts = new Map();
  for (const r of data){ counts.set(r.g, (counts.get(r.g)||0)+1); }
  const topOrder = Array.from(counts.entries())
    .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]))
    .map(([g]) => slugify(g));

  const genres = {};
  const subgenres = {};
  for (const r of data){
    const gid = slugify(r.g);
    if (/^generic[oa]$/i.test(r.s)){
      genres[gid] = { name: r.g, bass_clock: r.b, treble_clock: r.t, notes: "" };
    } else if (r.s){
      (subgenres[gid] ||= []).push({ id: slugify(r.s), name: r.s, bass_clock: r.b, treble_clock: r.t });
    }
  }
  // Ensure base preset for each genre
  for (const gid of topOrder){
    if (!genres[gid]){
      const sg = (subgenres[gid]||[])[0];
      if (sg){
        genres[gid] = { name: data.find(d=>slugify(d.g)===gid)?.g || gid, bass_clock: sg.bass_clock, treble_clock: sg.treble_clock, notes: "" };
      } else {
        genres[gid] = { name: data.find(d=>slugify(d.g)===gid)?.g || gid, bass_clock: 2.0, treble_clock: 2.0, notes: "" };
      }
    }
  }

  const out = { top_genres_order: topOrder, genres, subgenres };
  fs.writeFileSync(outJson, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Scritto ${outJson} — generi: ${topOrder.length}, sottogeneri: ${Object.values(subgenres).reduce((a,b)=>a+b.length,0)}`);
}

if (require.main === module) main();
