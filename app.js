function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function fmt(v){const r=Math.round(v*10)/10;return (Number.isInteger(r)?String(r):r.toFixed(1)).replace('.0','');}
function clockToLed(clock){return Math.round(10 * (clock - 0.5) / 3);}
function clockToDeg(clock){const pct=Math.min(1,Math.max(0,(clock-0.5)/3));return -135 + pct*270;}
const qs=s=>document.querySelector(s); const qsa=s=>[...document.querySelectorAll(s)];
let PRESETS=null, KEYWORDS=null, LAST={query:'', baseBass:2.0, baseTreble:2.0, genreId:null, subId:null};
let displayMode='clock'; // 'clock' | 'percent'

async function loadData(){
  PRESETS = await (await fetch('data/presets.json')).json();
  KEYWORDS = await (await fetch('data/keywords.json')).json();
  renderGenreChips();
  // toggle
  qs('#modeClock').onclick=()=>{displayMode='clock'; qs('#modeClock').classList.add('active'); qs('#modePercent').classList.remove('active'); refreshValues();};
  qs('#modePercent').onclick=()=>{displayMode='percent'; qs('#modePercent').classList.add('active'); qs('#modeClock').classList.remove('active'); refreshValues();};
  // quick env/vol
  const v=qs('#qVolume'); const vVal=qs('#qVolVal'); v.oninput=()=>{ vVal.textContent=v.value; refreshValues(); };
  qs('#qRoom').onchange=refreshValues;
  // AI Pro
  qs('#aiBtn').onclick=askAIPro;
}

function renderGenreChips(){
  const wrap=qs('#chips'); wrap.innerHTML='';
  for(const gid of PRESETS.top_genres_order){
    const g = PRESETS.genres[gid];
    const b=document.createElement('button');
    b.className='chip'; b.textContent=g.name; b.dataset.gid=gid;
    b.onclick=()=>selectGenre(gid);
    wrap.appendChild(b);
  }
}

function renderSubgenreChips(gid){
  const sc=qs('#subchips'); sc.innerHTML='';
  const list = PRESETS.subgenres[gid]||[];
  if(!list.length){ sc.hidden=true; return; }
  sc.hidden=false;
  list.forEach(sg=>{
    const b=document.createElement('button');
    b.className='chip'; b.textContent=sg.name; b.dataset.sid=sg.id;
    b.onclick=()=>applySubgenre(gid, sg.id);
    sc.appendChild(b);
  });
}

function setKnob(el, clock){ el.style.transform=`rotate(${clockToDeg(clock)}deg)`; }

function toPercent(clock){ const pct=(clock-0.5)/3; return Math.round(pct*100); }

function perceivedClock(clock, room, vol){
  let c = clock;
  if(room==='corner') c+=0.2; else if(room==='nearwall') c+=0.1; else if(room==='farwall') c-=0.1;
  if(vol>80) c+=0.1; else if(vol<40) c-=0.1;
  return clamp(c,0.5,3.5);
}

function applyPreset(b,t,notes,label){
  LAST.baseBass=clamp(b,0.5,3.5);
  LAST.baseTreble=clamp(t,0.5,3.5);
  setKnob(qs('#bassKnob'), LAST.baseBass);
  setKnob(qs('#trebleKnob'), LAST.baseTreble);
  qs('#notes').textContent=notes||'Preset locale applicato.';
  qs('#currentSel').textContent = label || '—';
  refreshValues();
}

function refreshValues(){
  const room=qs('#qRoom').value; const vol=parseInt(qs('#qVolume').value,10);
  const pb = perceivedClock(LAST.baseBass, room, vol);
  const pt = perceivedClock(LAST.baseTreble, room, vol);
  // LED percepito
  qs('#bassTick').textContent=clamp(clockToLed(pb),0,10)+'/10';
  qs('#trebleTick').textContent=clamp(clockToLed(pt),0,10)+'/10';
  // valore letto
  if(displayMode==='clock'){
    qs('#bassValue').textContent=`${fmt(LAST.baseBass)} ore`;
    qs('#trebleValue').textContent=`${fmt(LAST.baseTreble)} ore`;
  }else{
    qs('#bassValue').textContent=`${toPercent(LAST.baseBass)}%`;
    qs('#trebleValue').textContent=`${toPercent(LAST.baseTreble)}%`;
  }
}

function selectGenre(gid){
  const g=PRESETS.genres[gid];
  applyPreset(g.bass_clock,g.treble_clock,g.notes||'Preset genere applicato.', g.name);
  LAST.genreId=gid; LAST.subId=null; LAST.query=g.name;
  renderSubgenreChips(gid);
}

function applySubgenre(gid, sid){
  const list = PRESETS.subgenres[gid]||[];
  const sg = list.find(x=>x.id===sid); if(!sg) return;
  const gName = PRESETS.genres[gid]?.name || gid;
  applyPreset(sg.bass_clock, sg.treble_clock, `Preset sottogenere: ${sg.name}`, `${gName} — ${sg.name}`);
  LAST.genreId=gid; LAST.subId=sid; LAST.query=`${gName} — ${sg.name}`;
}

async function askAIPro(){
  if(!LAST || !LAST.query){ alert('Prima seleziona Genere/Sottogenere.'); return; }
  const room=qs('#qRoom').value; const volume=parseInt(qs('#qVolume').value,10);
  const extra = qs('#omnibox').value.trim(); // es. "Elton John", "live 1975", ecc.
  const combined = extra ? `${LAST.query} — ${extra}` : LAST.query; // es. "Pop — Elton John"
  const body = {
    query: `Approfondisci per "${combined}" su Marshall Acton III. Parti dal preset selezionato e adatta al contesto.`,
    room, volume,
    base_bass: LAST.baseBass, base_treble: LAST.baseTreble, max_delta: 0.3
  };
  try{
    const res=await fetch('/api/tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok) throw new Error('AI '+res.status);
    const data=await res.json();
    const b=Math.min(LAST.baseBass+0.3, Math.max(LAST.baseBass-0.3, data.bass_clock??LAST.baseBass));
    const t=Math.min(LAST.baseTreble+0.3, Math.max(LAST.baseTreble-0.3, data.treble_clock??LAST.baseTreble));
    applyPreset(b,t,data.notes||'Refinement AI applicato.', combined);
  }catch(e){
    qs('#notes').textContent='Errore AI Pro. Mantengo il preset locale.';
  }
}

(async function init(){ await loadData(); })();