/**
 * build_presets_from_csv.js
 * Usage: node scripts/build_presets_from_csv.js data/presets.csv data/presets.json
 * - Validates CSV schema and values; exits with code 1 on error (so Vercel build fails).
 * - Backs up existing presets.json to presets.backup-YYYYMMDD-HHMMSS.json before overwriting.
 * - Generates presets.json with:
 *    * LED(0..10) -> clock = 0.5 + 0.3*LED (clamped)
 *    * "Generico/Generica" row as base genre; otherwise first subgenre as base
 *    * Genres order:
 *         If data/genres_order.json exists -> manual order (slugs or names), then the rest by popularity.
 *         Else -> popularity (row count per genere desc).
 * - Logs counts and important actions.
 */
const fs = require('fs');
const path = require('path');

function slugify(str){
  return (str||'').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'') || 'x';
}

function ledToClock(x){
  let v = Number(x);
  if (!isFinite(v)) v = 0;
  v = Math.max(0, Math.min(10, v));
  return Math.round((0.5 + 0.3*v) * 100) / 100;
}

function readCSV(file){
  const raw = fs.readFileSync(file, 'utf8');
  // Support Windows newlines
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) throw new Error("CSV vuoto.");
  const header = lines[0].split(';').map(h=>h.trim());
  const required = ['Genere','Sottogenere','Bass (0-10)','Treble (0-10)'];
  for (const r of required){
    if (!header.includes(r)) throw new Error(`Colonna mancante: ${r}`);
  }
  const idx = Object.fromEntries(header.map((h,i)=>[h,i]));
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const parts = lines[i].split(';');
    if (parts.length < header.length) {
      // allow trailing empty columns
      while (parts.length < header.length) parts.push('');
    }
    const get = (k)=> (parts[idx[k]]||'').trim();
    const genere = get('Genere');
    const sottogenere = get('Sottogenere');
    const bass = get('Bass (0-10)');
    const treble = get('Treble (0-10)');
    if (!genere && !sottogenere) continue; // skip empty row
    const bNum = Number(bass);
    const tNum = Number(treble);
    if (!isFinite(bNum) || !isFinite(tNum)) {
      throw new Error(`Valori non numerici a riga ${i+1}: "${bass}", "${treble}"`);
    }
    if (bNum<0 || bNum>10 || tNum<0 || tNum>10){
      throw new Error(`Valori fuori range 0-10 a riga ${i+1}: bass=${bNum}, treble=${tNum}`);
    }
    rows.push({genere, sottogenere, bass: bNum, treble: tNum});
  }
  if (rows.length === 0) throw new Error("Nessuna riga valida nel CSV.");
  return rows;
}

function loadManualOrder(dataDir){
  const file = path.join(dataDir, 'genres_order.json');
  if (fs.existsSync(file)){
    try{
      const arr = JSON.parse(fs.readFileSync(file,'utf8'));
      if (!Array.isArray(arr)) throw new Error('Il file genres_order.json deve contenere un array.');
      const norm = arr.map(x=>{
        const s = String(x||'').trim();
        return {orig:s, slug: slugify(s)};
      }).filter(x=>x.slug);
      console.log(`[build] Ordine manuale trovato: ${norm.map(x=>x.orig).join(', ')}`);
      return norm;
    }catch(e){
      throw new Error(`Errore in genres_order.json: ${e.message}`);
    }
  }
  return null;
}

function main(){
  const inFile = process.argv[2] || 'data/presets.csv';
  const outFile = process.argv[3] || 'data/presets.json';
  const dataDir = path.dirname(outFile);
  console.log(`[build] CSV sorgente: ${inFile}`);
  console.log(`[build] JSON destinazione: ${outFile}`);

  // 1) Read and validate CSV
  const rows = readCSV(inFile);

  // 2) Aggregate
  const top_order = [];
  const genres = {};
  const subgenres = {};
  const byGenereCount = {};
  for (const r of rows){
    const gid = slugify(r.genere);
    byGenereCount[gid] = (byGenereCount[gid]||0) + 1;
    if (!top_order.includes(gid)) top_order.push(gid);

    const bass_clock = ledToClock(r.bass);
    const treble_clock = ledToClock(r.treble);

    if (/^generico|generica$/i.test(r.sottogenere.trim())){
      genres[gid] = {
        name: r.genere.trim(),
        bass_clock,
        treble_clock,
        notes: ""
      };
    } else {
      if (!subgenres[gid]) subgenres[gid] = [];
      subgenres[gid].push({
        id: slugify(r.sottogenere),
        name: r.sottogenere.trim(),
        bass_clock,
        treble_clock
      });
    }
  }

  // Ensure every genre has a base
  for (const gid of top_order){
    if (!genres[gid]){
      const first = (subgenres[gid]||[])[0];
      if (first){
        genres[gid] = {
          name: rows.find(r=>slugify(r.genere)===gid)?.genere || first.name,
          bass_clock: first.bass_clock,
          treble_clock: first.treble_clock,
          notes: ""
        };
      } else {
        genres[gid] = { name: gid, bass_clock: 2.0, treble_clock: 2.0, notes:"" };
      }
    }
  }

  // 3) Ordering
  const manual = loadManualOrder(dataDir);
  let order;
  if (manual){
    const manualSlugs = manual.map(x=>x.slug);
    const rest = Object.keys(genres).filter(g=>!manualSlugs.includes(g));
    // sort rest by popularity desc
    rest.sort((a,b)=>(byGenereCount[b]||0)-(byGenereCount[a]||0));
    order = [...manualSlugs, ...rest];
  } else {
    order = Object.keys(genres).sort((a,b)=>(byGenereCount[b]||0)-(byGenereCount[a]||0));
  }

  // 4) Backup existing outFile
  if (fs.existsSync(outFile)){
    const stamp = new Date();
    const y = stamp.getFullYear();
    const m = String(stamp.getMonth()+1).padStart(2,'0');
    const d = String(stamp.getDate()).padStart(2,'0');
    const hh = String(stamp.getHours()).padStart(2,'0');
    const mm = String(stamp.getMinutes()).padStart(2,'0');
    const ss = String(stamp.getSeconds()).padStart(2,'0');
    const backup = path.join(dataDir, `presets.backup-${y}${m}${d}-${hh}${mm}${ss}.json`);
    fs.copyFileSync(outFile, backup);
    console.log(`[build] Backup creato: ${path.basename(backup)}`);
  }

  // 5) Write new presets.json
  const payload = {
    top_genres_order: order,
    genres,
    subgenres
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');

  // 6) Logging summary
  const nGenres = Object.keys(genres).length;
  const nSub = Object.values(subgenres).reduce((s,arr)=>s+(arr?arr.length:0),0);
  console.log(`[build] Generi: ${nGenres} | Sottogeneri: ${nSub}`);
  console.log(`[build] Ordinamento: ${manual ? 'manuale + popolarità' : 'popolarità'}`);
  console.log(`[build] Completato senza errori.`);
}

try{
  main();
} catch(e){
  console.error(`[build][ERRORE] ${e.message}`);
  process.exit(1);
}
