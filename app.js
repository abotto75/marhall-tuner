async function loadPresets(){
  const res = await fetch('data/presets.json');
  return await res.json();
}

function clamp(val, min, max){ return Math.min(max, Math.max(min, val)); }

function formatClock(val){
  const rounded = Math.round(val*10)/10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace('.0','');
}

function lsGet(key, fallback){
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e){ return fallback; }
}
function lsSet(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
}
const CUSTOM_KEY = 'marshall_tuner_custom_presets_v1';

function mergePresets(base, custom){
  function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
  const out = JSON.parse(JSON.stringify(base));
  if(custom && custom.genres){
    for(const g of custom.genres){
      const idx = out.genres.findIndex(x => x.name.toLowerCase() === g.name.toLowerCase());
      const item = { ...g, id: g.id || slugify(g.name) };
      if(idx>=0){ out.genres[idx] = item; } else { out.genres.push(item); }
    }
  }
  if(custom && custom.artists){
    for(const a of custom.artists){
      const idx = out.artists.findIndex(x => x.name.toLowerCase() === a.name.toLowerCase());
      const item = { ...a, id: a.id || slugify(a.name) };
      if(idx>=0){ out.artists[idx] = item; } else { out.artists.push(item); }
    }
  }
  return out;
}

function adjustForRoom(base, room){
  let bass = base.bass_clock;
  let treble = base.treble_clock;
  if(room === 'nearwall'){ bass += 0.3; }
  if(room === 'corner'){ bass += 0.5; }
  if(room === 'farwall'){ bass -= 0.2; }
  return { ...base, bass_clock: clamp(bass, 0.5, 3.5), treble_clock: clamp(treble, 0.5, 3.5) };
}
function adjustForVolume(base, vol){
  let { bass_clock, treble_clock } = base;
  if(vol >= 85){ bass_clock -= 0.2; }
  if(vol <= 40){ treble_clock += 0.2; }
  return { ...base, bass_clock: clamp(bass_clock, 0.5, 3.5), treble_clock: clamp(treble_clock, 0.5, 3.5) };
}

(async function init(){
  const db = await loadPresets();

  // --- Custom presets (CRUD) ---
  let customDb = lsGet(CUSTOM_KEY, {genres:[], artists:[]});
  let liveDb = mergePresets(db, customDb);

  const modeEl = document.getElementById('mode');
  const pickerEl = document.getElementById('picker');
  const roomEl = document.getElementById('room');
  const volumeEl = document.getElementById('volume');
  const volValEl = document.getElementById('volVal');
  const bassValEl = document.getElementById('bassVal');
  const trebleValEl = document.getElementById('trebleVal');
  const notesEl = document.getElementById('notes');
  const resetBtn = document.getElementById('resetBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copied = document.getElementById('copied');

  const eType = document.getElementById('eType');
  const eName = document.getElementById('eName');
  const eBass = document.getElementById('eBass');
  const eTreble = document.getElementById('eTreble');
  const eNotes = document.getElementById('eNotes');
  const addBtn = document.getElementById('addPresetBtn');
  const delBtn = document.getElementById('deletePresetBtn');
  const exportBtn = document.getElementById('exportAllBtn');
  const importFile = document.getElementById('importFile');

  function populatePicker(){
    pickerEl.innerHTML = '';
    const mode = modeEl.value;
    const list = mode === 'genre' ? liveDb.genres : liveDb.artists;
    for(const item of list){
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      pickerEl.appendChild(opt);
    }
  }

  function currentPreset(){
    const mode = modeEl.value;
    const id = pickerEl.value;
    const list = mode === 'genre' ? liveDb.genres : liveDb.artists;
    return list.find(x => x.id === id);
  }

  function render(){
    const base = currentPreset();
    if(!base){ return; }
    const vol = parseInt(volumeEl.value, 10);
    volValEl.textContent = vol;
    let adjusted = adjustForRoom(base, roomEl.value);
    adjusted = adjustForVolume(adjusted, vol);
    bassValEl.textContent = formatClock(adjusted.bass_clock);
    trebleValEl.textContent = formatClock(adjusted.treble_clock);
    notesEl.textContent = base.notes || '—';
  }

  function formFillFromCurrent(){
    const cur = currentPreset();
    if(!cur){ return; }
    eType.value = modeEl.value;
    eName.value = cur.name || '';
    eBass.value = (Math.round(cur.bass_clock*10)/10).toFixed(1);
    eTreble.value = (Math.round(cur.treble_clock*10)/10).toFixed(1);
    eNotes.value = cur.notes || '';
  }

  modeEl.addEventListener('change', ()=>{ populatePicker(); render(); formFillFromCurrent(); });
  pickerEl.addEventListener('change', ()=>{ render(); formFillFromCurrent(); });
  roomEl.addEventListener('change', render);
  volumeEl.addEventListener('input', render);

  resetBtn.addEventListener('click', ()=>{
    modeEl.value = 'genre';
    populatePicker();
    roomEl.value = 'neutral';
    volumeEl.value = 70;
    volValEl.textContent = '70';
    render();
  });

  copyBtn.addEventListener('click', ()=>{
    const txt = `Marshall Acton III — ${modeEl.value==='genre'?'Genere':'Artista'}: ${pickerEl.options[pickerEl.selectedIndex].text}
Bass: ${bassValEl.textContent} ore
Treble: ${trebleValEl.textContent} ore
Note: ${notesEl.textContent}`;
    navigator.clipboard.writeText(txt).then(()=>{
      copied.hidden = false;
      setTimeout(()=> copied.hidden = true, 1600);
    });
  });

  // --- Add/Update/Delete Custom Presets ---
  function reloadLive(){
    liveDb = mergePresets(db, customDb);
    populatePicker();
    render();
  }

  addBtn.addEventListener('click', ()=>{
    const type = eType.value;
    const name = (eName.value || '').trim();
    let bass = parseFloat(eBass.value);
    let treble = parseFloat(eTreble.value);
    const notes = (eNotes.value || '').trim();
    if(!name){ alert('Inserisci un nome.'); return; }
    if(isNaN(bass)||isNaN(treble)){ alert('Inserisci valori numerici per Bass/Treble.'); return; }
    bass = clamp(bass, 0.5, 3.5);
    treble = clamp(treble, 0.5, 3.5);
    const bucket = (type==='genre') ? (customDb.genres) : (customDb.artists);
    const idx = bucket.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    const rec = { name, bass_clock:bass, treble_clock:treble, notes };
    if(idx>=0){ bucket[idx] = { ...(bucket[idx]||{}), ...rec }; } else { bucket.push(rec); }
    lsSet(CUSTOM_KEY, customDb);
    reloadLive();
    alert('Preset salvato.');
  });

  delBtn.addEventListener('click', ()=>{
    const cur = currentPreset();
    if(!cur){ return; }
    const type = modeEl.value;
    const id = cur.id;
    const bucket = (type==='genre') ? customDb.genres : customDb.artists;
    const before = bucket.length;
    for(let i=bucket.length-1;i>=0;i--){
      if((bucket[i].id && bucket[i].id===id) || (bucket[i].name && bucket[i].name.toLowerCase()===cur.name.toLowerCase())){
        bucket.splice(i,1);
      }
    }
    if(bucket.length!==before){
      lsSet(CUSTOM_KEY, customDb);
      reloadLive();
      alert('Preset custom eliminato.');
    } else {
      alert('Il preset selezionato non è custom oppure non è stato trovato tra i custom.');
    }
  });

  exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(liveDb, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'marshall_tuner_presets_export.json';
    a.click();
  });

  importFile.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const obj = JSON.parse(text);
      customDb = { 
        genres: Array.isArray(obj.genres) ? obj.genres : [], 
        artists: Array.isArray(obj.artists) ? obj.artists : [] 
      };
      lsSet(CUSTOM_KEY, customDb);
      reloadLive();
      alert('Preset importati.');
    }catch(err){
      alert('File non valido: ' + err.message);
    } finally {
      importFile.value = '';
    }
  });

  // init
  populatePicker();
  render();

  // --- AI integration (optional if backend available) ---
  const aiBtn = document.getElementById('aiBtn');
  async function askAI(){
    try{
      const mode = modeEl.value;
      const label = pickerEl.options[pickerEl.selectedIndex]?.text || '';
      const query = `${mode==='genre'?'Genere':'Artista'}: ${label}`;
      const room = roomEl.value;
      const volume = parseInt(volumeEl.value, 10);
      const r = await fetch('/api/tune', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ query, room, volume })
      });
      if(!r.ok){ throw new Error(`Errore API (${r.status})`); }
      const { bass_clock, treble_clock, notes } = await r.json();
      bassValEl.textContent = formatClock(bass_clock);
      trebleValEl.textContent = formatClock(treble_clock);
      notesEl.textContent = notes || '—';
    }catch(err){
      alert('AI non disponibile o errore: ' + err.message + '\nVerifica la chiave API o riprova più tardi.');
    }
  }
  aiBtn?.addEventListener('click', askAI);
})();