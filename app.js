function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function fmt(v){const r=Math.round(v*10)/10;return (Number.isInteger(r)?String(r):r.toFixed(1)).replace('.0','');}
function clockToLed(clock){return Math.round(10 * (clock - 0.5) / 3);}
function clockToDeg(clock){const pct=Math.min(1,Math.max(0,(clock-0.5)/3));return -135 + pct*270;}
const qs=s=>document.querySelector(s); const qsa=s=>[...document.querySelectorAll(s)];

let PRESETS=null, KEYWORDS=null, LAST={ query:'', baseBass:2.0, baseTreble:2.0 };

async function loadData(){
  PRESETS = await (await fetch('data/presets.json')).json();
  KEYWORDS = await (await fetch('data/keywords.json')).json();
  // build chips
  const chips=qs('#chips'); chips.innerHTML='';
  for(const gid of PRESETS.top_genres_order){
    const g=PRESETS.genres[gid];
    const b=document.createElement('button');
    b.className='chip'; b.textContent=g.name; b.dataset.query=g.name;
    b.onclick=()=>{ qs('#omnibox').value=g.name; applyPreset(g.bass_clock,g.treble_clock,g.notes); remember(g.name,g.bass_clock,g.treble_clock); };
    chips.appendChild(b);
  }
}

function classifyToGenre(text){
  const t=(text||'').toLowerCase();
  // direct match by genre name
  for(const [id,g] of Object.entries(PRESETS.genres)){
    if(t.includes(g.name.toLowerCase())) return id;
  }
  // keyword map
  for(const [id,words] of Object.entries(KEYWORDS)){
    if(words.some(w=>t.includes(w))) return id;
  }
  return null; // unknown
}

function setKnob(el, clock){ el.style.transform=`rotate(${clockToDeg(clock)}deg)`; }

function applyPreset(bass,treble,notes){
  const b=clamp(bass,0.5,3.5), t=clamp(treble,0.5,3.5);
  qs('#bassClock').textContent=fmt(b); qs('#trebleClock').textContent=fmt(t);
  const bLed=clamp(clockToLed(b),0,10), tLed=clamp(clockToLed(t),0,10);
  qs('#bassLed').textContent=bLed; qs('#trebleLed').textContent=tLed;
  qs('#bassTick').textContent=bLed+'/10'; qs('#trebleTick').textContent=tLed+'/10';
  setKnob(qs('#bassKnob'), b); setKnob(qs('#trebleKnob'), t);
  qs('#notes').textContent=notes || 'Preset locale applicato.';
}

function remember(q,b,t){ LAST={ query:q, baseBass:b, baseTreble:t }; }

async function applyFromSearch(){
  // Build text from quick/pro
  let text=qs('#omnibox').value.trim();
  const active=qsa('.seg-btn').find(x=>x.classList.contains('active'))?.dataset.tab||'quick';
  if(active==='pro'){
    const type=qs('#type').value, artist=qs('#fArtist').value.trim(), title=qs('#fTitle').value.trim(), extra=qs('#fExtra').value.trim();
    const parts=[];
    if(type==='genre' && title) parts.push(`Genere: ${title}`);
    else if(type==='genre' && artist) parts.push(`Genere: ${artist}`);
    else { if(artist) parts.push(artist); if(title) parts.push(title); if(extra) parts.push(extra); }
    text = parts.join(' — ') || text;
  }
  if(!text){ alert('Scrivi un artista/brano/opera o scegli un genere.'); return; }

  const gid = classifyToGenre(text);
  let baseBass, baseTreble, notes;
  if(gid){
    const g = PRESETS.genres[gid];
    baseBass = g.bass_clock; baseTreble = g.treble_clock; notes = g.notes || 'Preset locale del genere.';
  }else{
    // default to Pop if unknown, and warn user
    const g = PRESETS.genres.pop;
    baseBass = g.bass_clock; baseTreble = g.treble_clock;
    notes = 'Genere non riconosciuto: uso preset Pop come base. Seleziona un genere o usa AI Pro per dettagli.';
  }
  applyPreset(baseBass, baseTreble, notes);
  remember(text, baseBass, baseTreble);
}

async function askAIPro(){
  // Uses the last applied preset as base; does not run if none
  if(!LAST || !LAST.query){ alert('Prima applica un preset con "Applica preset".'); return; }
  const room=qs('#room').value; const volume=parseInt(qs('#volume').value,10);
  const userQuery = LAST.query;
  const body = {
    query: `Approfondisci per "${userQuery}" su Marshall Acton III. Parti da preset base e adatta al contesto.`,
    room, volume,
    base_bass: LAST.baseBass, base_treble: LAST.baseTreble, max_delta: 0.3
  };
  const res = await fetch('/api/tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){ qs('#notes').textContent='Errore AI Pro. Mantengo il preset locale.'; return; }
  const data = await res.json();
  // Clamp defensive
  const b = Math.min(LAST.baseBass+0.3, Math.max(LAST.baseBass-0.3, data.bass_clock ?? LAST.baseBass));
  const t = Math.min(LAST.baseTreble+0.3, Math.max(LAST.baseTreble-0.3, data.treble_clock ?? LAST.baseTreble));
  applyPreset(b,t, data.notes || 'Refinement AI applicato.');
}

(function init(){
  loadData();
  qsa('.seg-btn').forEach(b=>b.addEventListener('click',()=>{
    qsa('.seg-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    qs('#proTab').hidden = b.dataset.tab!=='pro';
  }));
  const vol=qs('#volume'); const volVal=qs('#volVal'); vol.addEventListener('input',()=>volVal.textContent=vol.value);
  qs('#applyBtn').onclick=applyFromSearch;
  qs('#aiBtn').onclick=askAIPro;
  qs('#resetBtn').onclick=()=>{
    qs('#omnibox').value='';
    ['bassClock','trebleClock','bassLed','trebleLed','bassTick','trebleTick'].forEach(id=>qs('#'+id).textContent='—');
    qs('#bassKnob').style.transform='rotate(0deg)'; qs('#trebleKnob').style.transform='rotate(0deg)';
    qs('#notes').textContent='Premi "Applica preset" per usare solo preset locali.';
  };
})();