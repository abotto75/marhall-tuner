// CommonJS build script for Vercel/Node without ESM
// Usage: node scripts/build_presets_from_csv.cjs data/presets.csv data/presets.json
const fs = require('fs');
const path = require('path');

function exitWith(msg) {
  console.error('[build:presets] ' + msg);
  process.exit(1);
}

const [,, csvInArg, jsonOutArg] = process.argv;
if (!csvInArg || !jsonOutArg) {
  exitWith('Usage: node scripts/build_presets_from_csv.cjs <input.csv> <output.json>');
}

const csvPath = path.resolve(csvInArg);
const outPath = path.resolve(jsonOutArg);
const dataDir = path.dirname(csvPath);

if (!fs.existsSync(csvPath)) {
  exitWith(`CSV not found at ${csvPath}`);
}

const mustCols = ['Genere','Sottogenere','Bass (0-10)','Treble (0-10)'];
function parseCSV(content) {
  const lines = content.replace(/\r/g,'').split('\n').filter(Boolean);
  const header = lines[0].split(';').map(s=>s.trim());
  for (const c of mustCols) {
    if (!header.includes(c)) {
      exitWith(`Missing column "${c}". Header found: ${header.join(', ')}`);
    }
  }
  const idx = Object.fromEntries(header.map((h,i)=>[h,i]));
  const rows = [];
  for (let i=1;i<lines.length;i++) {
    const parts = lines[i].split(';').map(s=>s.trim());
    if (parts.length !== header.length) {
      exitWith(`Row ${i+1} has ${parts.length} columns, expected ${header.length}. Line="${lines[i]}"`);
    }
    const g = parts[idx['Genere']];
    const s = parts[idx['Sottogenere']];
    const b = parseFloat(parts[idx['Bass (0-10)']]);
    const t = parseFloat(parts[idx['Treble (0-10)']]);
    if (!g) exitWith(`Row ${i+1}: Genere is empty.`);
    if (!s) exitWith(`Row ${i+1}: Sottogenere is empty.`);
    if (!Number.isFinite(b) || b<0 || b>10) exitWith(`Row ${i+1}: Bass must be 0–10. Found "${parts[idx['Bass (0-10)']]}".`);
    if (!Number.isFinite(t) || t<0 || t>10) exitWith(`Row ${i+1}: Treble must be 0–10. Found "${parts[idx['Treble (0-10)']]}".`);
    rows.push({ Genere:g, Sottogenere:s, Bass:b, Treble:t });
  }
  return rows;
}

function slugify(s) {
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'');
}

function ledToClock(x) {
  x = Math.max(0, Math.min(10, Number(x)));
  return Math.round((0.5 + 0.3*x) * 100) / 100;
}

const csv = fs.readFileSync(csvPath, 'utf8');
const rows = parseCSV(csv);

// popularity count
const pop = new Map();
for (const r of rows) {
  const gid = slugify(r.Genere);
  pop.set(gid, (pop.get(gid)||0)+1);
}

// build structures
const genres = {};
const subgenres = {};

for (const r of rows) {
  const gid = slugify(r.Genere);
  const sub = r.Sottogenere;
  const bass = ledToClock(r.Bass);
  const treb = ledToClock(r.Treble);
  if (/^generico|generica$/i.test(sub)) {
    genres[gid] = { name: r.Genere, bass_clock:bass, treble_clock:treb, notes: "" };
  } else {
    if (!subgenres[gid]) subgenres[gid]=[];
    subgenres[gid].push({ id: slugify(sub), name: sub, bass_clock:bass, treble_clock:treb });
  }
}

// ensure base genre exists
for (const gid of Object.keys(Object.fromEntries(pop))) {
  if (!genres[gid]) {
    const lst = subgenres[gid] || [];
    if (lst.length) {
      genres[gid] = { name: rows.find(r=>slugify(r.Genere)===gid).Genere, bass_clock: lst[0].bass_clock, treble_clock: lst[0].treble_clock, notes: "" };
    } else {
      genres[gid] = { name: rows.find(r=>slugify(r.Genere)===gid)?.Genere || gid, bass_clock: 2.0, treble_clock: 2.0, notes: "" };
    }
  }
}

// ordering: manual (if file exists) then popularity
let manualOrder = [];
const orderFile = path.join(dataDir, 'genres_order.json');
let usedManual = false;
if (fs.existsSync(orderFile)) {
  try {
    const arr = JSON.parse(fs.readFileSync(orderFile,'utf8'));
    if (!Array.isArray(arr)) exitWith('data/genres_order.json must be an array of names or slugs.');
    manualOrder = arr.map(x=>String(x));
    usedManual = true;
  } catch(e) {
    exitWith('Invalid JSON in data/genres_order.json: '+e.message);
  }
}

const allGids = Object.keys(genres);
const byPopularity = [...allGids].sort((a,b)=> (pop.get(b)||0)-(pop.get(a)||0));

function nameOrSlugToGid(x){
  const s = slugify(x);
  if (genres[s]) return s;
  // try by name match
  const found = allGids.find(gid=> (genres[gid].name||'').toLowerCase()===String(x).toLowerCase());
  return found || s;
}

const top_genres_order = [];
if (usedManual) {
  for (const x of manualOrder) {
    const gid = nameOrSlugToGid(x);
    if (!top_genres_order.includes(gid) && genres[gid]) top_genres_order.push(gid);
  }
  for (const gid of byPopularity) {
    if (!top_genres_order.includes(gid)) top_genres_order.push(gid);
  }
} else {
  top_genres_order.push(...byPopularity);
}

// backup existing presets.json if present
if (fs.existsSync(outPath)) {
  const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,15);
  const backup = outPath.replace(/\.json$/i, `.backup-${ts}.json`);
  fs.copyFileSync(outPath, backup);
  console.log(`[build:presets] Backup created: ${path.relative(process.cwd(), backup)}`);
}

const out = { top_genres_order, genres, subgenres };
fs.mkdirSync(path.dirname(outPath), { recursive:true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

const totalSub = Object.values(subgenres).reduce((a,arr)=>a+arr.length,0);
console.log(`[build:presets] Done. Genres: ${Object.keys(genres).length}, Subgenres: ${totalSub}. Order: ${usedManual?'manual+popularity':'popularity'}.`);
