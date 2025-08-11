function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function clockToLed(clock){return Math.round(10 * (clock - 0.5) / 3);}
function clockToDeg(clock){const pct=Math.min(1,Math.max(0,(clock-0.5)/3));return -135 + pct*270;}
const qs=s=>document.querySelector(s); const qsa=s=>[...document.querySelectorAll(s)];

let PRESETS=null, KEYWORDS=null;
let LAST={query:'', baseBass:2.0, baseTreble:2.0, genreId:null, subId:null, guide:'', pristine:{bass:2.0, treble:2.0}};
let displayMode='percent';

async function loadData(){
  PRESETS = await (await fetch('data/presets.json')).json();
  KEYWORDS = await (await fetch('data/keywords.json')).json();
  renderGenreChips();
  // toggles
  qs('#modePercent').onclick=()=>{displayMode='percent'; qs('#modePercent').classList.add('active'); qs('#modeClock').classList.remove('active'); refreshValues();};
  qs('#modeClock').onclick=()=>{displayMode='clock'; qs('#modeClock').classList.add('active'); qs('#modePercent').classList.remove('active'); refreshValues();};
  // quick env/vol
  const v=qs('#qVolume'); const vVal=qs('#qVolVal'); v.oninput=()=>{ vVal.textContent=v.value; refreshValues(); };
  qs('#qRoom').onchange=refreshValues;
  // AI Pro
  qs('#aiBtn').onclick=askAIPro;
  const aiVol=qs('#aiVolume'); const aiVal=qs('#aiVolVal'); aiVol.oninput=()=>{ aiVal.textContent=aiVol.value; };
  // Reset preset
  qs('#resetBtn').onclick=resetToPristine;
}

function renderGenreChips(){
  const wrap=qs('#chips'); wrap.innerHTML='';
  for(const gid of PRESETS.top_genres_order){
    const g=PRESETS.genres[gid];
    const b=document.createElement('button');
    b.className='chip'; b.textContent=g.name; b.onclick=()=>selectGenre(gid);
    wrap.appendChild(b);
  }
}
function renderSubgenreChips(gid){
  const sc=qs('#subchips'); sc.innerHTML='';
  const list=PRESETS.subgenres[gid]||[];
  sc.hidden = list.length===0;
  list.forEach(sg=>{
    const b=document.createElement('button'); b.className='chip'; b.textContent=sg.name; b.onclick=()=>applySubgenre(gid, sg.id);
    sc.appendChild(b);
  });
}

function toPercent(clock){ const pct=(clock-0.5)/3; return Math.round(pct*100); }
function perceivedClock(clock, room, vol){
  let c=clock;
  if(room==='corner') c+=0.2; else if(room==='nearwall') c+=0.1; else if(room==='farwall') c-=0.1;
  if(vol>80) c+=0.1; else if(vol<40) c-=0.1;
  return Math.min(3.5, Math.max(0.5, c));
}

function setKnob(el, clock){ el.style.transform=`rotate(${clockToDeg(clock)}deg)`; }

function applyPreset(b,t,guide){
  LAST.baseBass=Math.min(3.5, Math.max(0.5, b));
  LAST.baseTreble=Math.min(3.5, Math.max(0.5, t));
  LAST.pristine={bass:LAST.baseBass, treble:LAST.baseTreble}; // salva preset puro
  LAST.guide=guide||'';
  setKnob(qs('#bassKnob'), LAST.baseBass);
  setKnob(qs('#trebleKnob'), LAST.baseTreble);
  qs('#guideText').textContent = guide || 'Preset applicato.';
  refreshValues();
}

function refreshValues(){
  const room=qs('#qRoom').value; const vol=parseInt(qs('#qVolume').value,10);
  const pb = perceivedClock(LAST.baseBass, room, vol);
  const pt = perceivedClock(LAST.baseTreble, room, vol);
  qs('#bassTick').textContent = Math.max(0, Math.min(10, clockToLed(pb))) + '/10';
  qs('#trebleTick').textContent = Math.max(0, Math.min(10, clockToLed(pt))) + '/10';
  if(displayMode==='percent'){
    qs('#bassValue').textContent = `${toPercent(LAST.baseBass)}%`;
    qs('#trebleValue').textContent = `${toPercent(LAST.baseTreble)}%`;
  }else{
    const f=v=>String(Math.round(v*10)/10).replace(/\.0$/,'');
    qs('#bassValue').textContent = `${f(LAST.baseBass)} ore`;
    qs('#trebleValue').textContent = `${f(LAST.baseTreble)} ore`;
  }
}

function selectGenre(gid){
  const g=PRESETS.genres[gid];
  applyPreset(g.bass_clock, g.treble_clock, g.guide||g.notes||'');
  LAST.genreId=gid; LAST.subId=null; LAST.query=g.name;
  renderSubgenreChips(gid);
}
function applySubgenre(gid, sid){
  const list=PRESETS.subgenres[gid]||[];
  const sg=list.find(x=>x.id===sid); if(!sg) return;
  const gName=PRESETS.genres[gid]?.name || gid;
  applyPreset(sg.bass_clock, sg.treble_clock, sg.guide || PRESETS.genres[gid]?.guide || '');
  LAST.genreId=gid; LAST.subId=sid; LAST.query=`${gName} — ${sg.name}`;
}

async function askAIPro(){
  if(!LAST || !LAST.query){ alert('Prima seleziona Genere/Sottogenere in Quick.'); return; }
  const room=qs('#aiRoom').value; const volume=parseInt(qs('#aiVolume').value,10);
  const extra=(qs('#freeText').value||'').trim();
  const combined = extra ? `${LAST.query} — ${extra}` : LAST.query;
  const body = {
    query: `Approfondisci per "${combined}" su Marshall Acton III. Parti dal preset selezionato e adatta al contesto.`,
    room, volume,
    base_bass: LAST.baseBass, base_treble: LAST.baseTreble, max_delta: 0.3
  };
  try{
    const res=await fetch('/api/tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok) throw new Error('AI '+res.status);
    const data=await res.json();
    // non tocchiamo LAST.pristine: serve per reset
    LAST.baseBass = Math.min(LAST.pristine.bass+0.3, Math.max(LAST.pristine.bass-0.3, data.bass_clock ?? LAST.baseBass));
    LAST.baseTreble = Math.min(LAST.pristine.treble+0.3, Math.max(LAST.pristine.treble-0.3, data.treble_clock ?? LAST.baseTreble));
    setKnob(qs('#bassKnob'), LAST.baseBass); setKnob(qs('#trebleKnob'), LAST.baseTreble);
    qs('#notes').textContent = data.notes || 'Refinement AI applicato.';
    refreshValues();
  }catch(e){
    qs('#notes').textContent='Errore AI Pro. Mantengo il preset locale.';
  }
}

function resetToPristine(){
  LAST.baseBass = LAST.pristine.bass;
  LAST.baseTreble = LAST.pristine.treble;
  setKnob(qs('#bassKnob'), LAST.baseBass); setKnob(qs('#trebleKnob'), LAST.baseTreble);
  qs('#notes').textContent = 'Ripristinato il preset originale del (sotto)genere.';
  refreshValues();
}

(function init(){ loadData(); })();