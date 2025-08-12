
const fs = require('fs');
const path = require('path');

function exitErr(msg) {
  console.error(`[build:presets][ERROR] ${msg}`);
  process.exit(1);
}

function readCSV(file) {
  if (!fs.existsSync(file)) exitErr(`CSV non trovato: ${file}`);
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) exitErr('CSV vuoto.');
  const header = lines[0].split(';').map(s => s.trim());
  const required = ['Genere','Sottogenere','Bass (0-10)','Treble (0-10)'];
  for (const col of required) {
    if (!header.includes(col)) exitErr(`Colonna mancante: "${col}". Header trovato: ${header.join(', ')}`);
  }
  const idx = Object.fromEntries(required.map(k => [k, header.indexOf(k)]));
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const parts = lines[i].split(';');
    if (parts.length < header.length) continue;
    const g = (parts[idx['Genere']]||'').trim();
    const s = (parts[idx['Sottogenere']]||'').trim();
    const b = (parts[idx['Bass (0-10)']]||'').trim();
    const t = (parts[idx['Treble (0-10)']]||'').trim();
    if (!g || !s) continue;
    const bass = Number(b.replace(',', '.'));
    const treble = Number(t.replace(',', '.'));
    if (!Number.isFinite(bass) || !Number.isFinite(treble)) exitErr(`Valore non numerico in riga ${i+1}: Bass="${b}", Treble="${t}"`);
    if (bass < 0 || bass > 10 || treble < 0 || treble > 10) exitErr(`Valori fuori range 0-10 in riga ${i+1}: Bass=${bass}, Treble=${treble}`);
    rows.push({ Genere:g, Sottogenere:s, Bass:bass, Treble:treble });
  }
  return rows;
}

function slugify(s){
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

function ledToClock(x){ x = Math.max(0, Math.min(10, x)); return Math.round((0.5 + 0.3*x)*100)/100; }

function orderGenres({rows, manualOrder}){
  const pop = rows.reduce((acc, r)=>{ acc[r.Genere]=(acc[r.Genere]||0)+1; return acc; }, {});
  const unique = Array.from(new Set(rows.map(r=>r.Genere)));
  if (Array.isArray(manualOrder) && manualOrder.length){
    const setManual = new Set(manualOrder.map(s=>s.toLowerCase()));
    const manual = unique.filter(g=>setManual.has(g.toLowerCase()));
    const rest = unique.filter(g=>!setManual.has(g.toLowerCase()));
    manual.sort((a,b)=> manualOrder.findIndex(x=>x.toLowerCase()===a.toLowerCase()) - manualOrder.findIndex(x=>x.toLowerCase()===b.toLowerCase()));
    rest.sort((a,b)=> (pop[b]||0)-(pop[a]||0) || a.localeCompare(b));
    return {order:[...manual, ...rest], mode:'manual+popularity'};
  }
  const ord = unique.sort((a,b)=> (pop[b]||0)-(pop[a]||0) || a.localeCompare(b));
  return {order:ord, mode:'popularity'};
}

function main(){
  const inCSV = process.argv[2];
  const outJSON = process.argv[3];
  if (!inCSV || !outJSON) exitErr('Uso: node scripts/build_presets_from_csv.cjs public/data/presets.csv public/data/presets.json');

  const rows = readCSV(inCSV);
  // Read manual order if present
  let manualOrder = null;
  const orderPath = path.join(path.dirname(inCSV), 'genres_order.json');
  if (fs.existsSync(orderPath)){
    try {
      const data = JSON.parse(fs.readFileSync(orderPath,'utf8'));
      if (!Array.isArray(data)) exitErr('genres_order.json deve essere un array di nomi/slugs.');
      manualOrder = data;
    } catch(e){
      exitErr(`genres_order.json non valido: ${e.message}`);
    }
  }

  // Build structures
  const genres = {};
  const subgenres = {};
  const rowsByGenre = rows.reduce((acc,r)=>{ (acc[r.Genere]=acc[r.Genere]||[]).push(r); return acc; }, {});

  for (const [g, arr] of Object.entries(rowsByGenre)){
    const gid = slugify(g);
    const base = arr.find(r=>/^generico(a)?$/i.test(r.Sottogenere));
    let bassClock, trebleClock, baseName;
    if (base){
      bassClock = ledToClock(base.Bass);
      trebleClock = ledToClock(base.Treble);
      baseName = g;
    } else {
      const first = arr[0];
      bassClock = ledToClock(first.Bass);
      trebleClock = ledToClock(first.Treble);
      baseName = g;
    }
    genres[gid] = { name: g, bass_clock: bassClock, treble_clock: trebleClock, notes: "" };
    subgenres[gid] = [];
    for (const r of arr){
      if (/^generico(a)?$/i.test(r.Sottogenere)) continue;
      subgenres[gid].push({
        id: slugify(r.Sottogenere),
        name: r.Sottogenere,
        bass_clock: ledToClock(r.Bass),
        treble_clock: ledToClock(r.Treble)
      });
    }
  }

  const {order, mode} = orderGenres({rows, manualOrder});
  const top_genres_order = order.map(g => slugify(g));

  const outDir = path.dirname(outJSON);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive:true});

  // Backup existing outJSON if exists
  if (fs.existsSync(outJSON)){
    const stamp = new Date().toISOString().replace(/[-:T]/g,'').slice(0,15);
    const bkp = path.join(outDir, `presets.backup-${stamp}.json`);
    fs.copyFileSync(outJSON, bkp);
    console.log(`[build:presets] Backup created: ${path.relative(process.cwd(), bkp)}`);
  }

  const payload = { top_genres_order, genres, subgenres };
  fs.writeFileSync(outJSON, JSON.stringify(payload, null, 2), 'utf8');

  const subCount = Object.values(subgenres).reduce((a,v)=>a+v.length,0);
  console.log(`[build:presets] Done. Genres: ${Object.keys(genres).length}, Subgenres: ${subCount}. Order: ${mode}.`);
}

main();
