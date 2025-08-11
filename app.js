function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function clockToLedFloat(clock){return 10 * (clock - 0.5) / 3;}
function ledRound(val){ const base=Math.floor(val); const frac=val-base; return (frac<=0.5)?base:(base+1); }
function clockToDeg(clock){const pct=Math.min(1,Math.max(0,(clock-0.5)/3));return -135 + pct*270;}
const qs=s=>document.querySelector(s);

let PRESETS=null, SUB_GUIDES=null;
let LAST={query:'', baseBass:2.0, baseTreble:2.0, genreId:null, subId:null, guide:'', pristine:{bass:2.0, treble:2.0}, source:'Preset'};
let displayMode='percent';

async function loadData(){
  PRESETS = await (await fetch('data/presets.json')).json();
  SUB_GUIDES = await (await fetch('data/subgenre_guides.json')).json();
  renderGenreChips();
  qs('#modePercent').onclick=()=>{displayMode='percent'; qs('#modePercent').classList.add('active'); qs('#modeClock').classList.remove('active'); refreshValues();};
  qs('#modeClock').onclick=()=>{displayMode='clock'; qs('#modeClock').classList.add('active'); qs('#modePercent').classList.remove('active'); refreshValues();};
  qs('#aiBtn').onclick=askAIPro;
  qs('#resetBtn').onclick=resetToPristine;
  const aiVol=qs('#aiVolume'); const aiVal=qs('#aiVolVal'); aiVol.oninput=()=>aiVal.textContent=aiVol.value;
  updateSelBar();
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
  const sw=qs('#subWrap'); const sc=qs('#subchips'); sc.innerHTML='';
  const list = (PRESETS.subgenres||{})[gid]||[];
  sw.hidden = list.length===0;
  list.forEach(sg=>{
    const b=document.createElement('button');
    b.className='chip'; b.textContent=sg.name; b.dataset.sid=sg.id;
    b.onclick=()=>applySubgenre(gid, sg.id);
    sc.appendChild(b);
  });
}

function setKnob(el, clock){ el.style.transform=`rotate(${clockToDeg(clock)}deg)`; }
function toPercent(clock){ const pct=(clock-0.5)/3; return Math.round(pct*100); }

function applyPreset(b,t,guide){
  LAST.baseBass = clamp(b,0.5,3.5);
  LAST.baseTreble = clamp(t,0.5,3.5);
  LAST.pristine = {bass: LAST.baseBass, treble: LAST.baseTreble};
  LAST.guide = guide||'';
  LAST.source = 'Preset';
  LAST.lastRefinedAt = null;
  setKnob(document.getElementById('bassKnob'), LAST.baseBass);
  setKnob(document.getElementById('trebleKnob'), LAST.baseTreble);
  document.getElementById('guideText').textContent = guide || 'Preset applicato.';
  document.getElementById('subGuide').hidden = true;
  updateSelBar();
  refreshValues();
}

function refreshValues(){
  const bLed = ledRound(clockToLedFloat(LAST.baseBass));
  const tLed = ledRound(clockToLedFloat(LAST.baseTreble));
  document.getElementById('bassTick').textContent = bLed+'/10';
  document.getElementById('trebleTick').textContent = tLed+'/10';
  if(displayMode==='percent'){
    document.getElementById('bassValue').textContent = toPercent(LAST.baseBass)+'%';
    document.getElementById('trebleValue').textContent = toPercent(LAST.baseTreble)+'%';
  }else{
    const f=v=>String(Math.round(v*10)/10).replace(/\.0$/,'');
    document.getElementById('bassValue').textContent = f(LAST.baseBass)+' ore';
    document.getElementById('trebleValue').textContent = f(LAST.baseTreble)+' ore';
  }
}


function updateSelBar(){
  const gName = LAST.genreId ? (PRESETS.genres[LAST.genreId]?.name || LAST.genreId) : null;
  let text = gName || 'Nessuna selezione';
  if (LAST.subId){
    const sub = ((PRESETS.subgenres||{})[LAST.genreId]||[]).find(s=>s.id===LAST.subId);
    if(sub) text = `${gName} — ${sub.name}`;
  }
  qs('#selText').textContent = text;
  const badge = qs('#sourceBadge');
  badge.textContent = LAST.source;
  badge.classList.toggle('aipro', LAST.source==='AI Tune Pro');
  badge.classList.toggle('preset', LAST.source!=='AI Tune Pro');
  const lt = qs('#lastTime');
  if(LAST.source==='AI Tune Pro' && LAST.lastRefinedAt){
    const d = new Date(LAST.lastRefinedAt);
    const time = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const date = d.toLocaleDateString();
    lt.textContent = `${date} • ${time}`;
    lt.hidden = false;
  } else {
    lt.hidden = true;
  }
}

  qs('#selText').textContent = text;
  const badge = qs('#sourceBadge');
  badge.textContent = LAST.source;
  badge.classList.toggle('aipro', LAST.source==='AI Tune Pro');
  badge.classList.toggle('preset', LAST.source!=='AI Tune Pro');
  const lt = qs('#lastTime');
  if(LAST.source==='AI Tune Pro' && LAST.lastRefinedAt){
    const d = new Date(LAST.lastRefinedAt);
    const opts = { hour:'2-digit', minute:'2-digit' };
    const time = d.toLocaleTimeString(undefined, opts);
    const date = d.toLocaleDateString();
    lt.textContent = `${date} ${time}`;
    lt.hidden = false;
  } else {
    lt.hidden = true;
  }
}



function selectGenre(gid){
  const g=PRESETS.genres[gid];
  LAST.genreId=gid;              // set first so selbar reads it
  LAST.subId=null;
  LAST.query=g.name;
  applyPreset(g.bass_clock, g.treble_clock, g.notes||'');
  renderSubgenreChips(gid);
  updateSelBar();                // ensure immediate update
}



function applySubgenre(gid, sid){
  const list=(PRESETS.subgenres||{})[gid]||[];
  const sg=list.find(x=>x.id===sid); if(!sg) return;
  const gName=PRESETS.genres[gid]?.name || gid;
  applyPreset(sg.bass_clock, sg.treble_clock, PRESETS.genres[gid]?.notes || '');
  LAST.genreId=gid; LAST.subId=sid; LAST.query=`${gName} — ${sg.name}`;
  const mg = (SUB_GUIDES[gid]||{})[sid];
  if(mg){ const el=document.getElementById('subGuide'); el.textContent = mg; el.hidden=false; }
  updateSelBar();
}

async function askAIPro(){
  if(!LAST || !LAST.query){ alert('Prima seleziona Genere/Sottogenere in Quick.'); return; }
  const room=document.getElementById('aiRoom').value;
  const volume=parseInt(document.getElementById('aiVolume').value,10);
  const extra=(document.getElementById('freeText').value||'').trim();
  const combined = extra ? `${LAST.query} — ${extra}` : LAST.query;
  const body = { query: `Approfondisci per "${combined}" su Marshall Acton III. Parti dal preset selezionato e adatta al contesto.`, room, volume, base_bass: LAST.baseBass, base_treble: LAST.baseTreble, max_delta: 0.3 };
  try{
    const res=await fetch('/api/tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok) throw new Error('AI '+res.status);
    const data=await res.json();
    LAST.baseBass = clamp(data.bass_clock ?? LAST.baseBass, LAST.pristine.bass-0.3, LAST.pristine.bass+0.3);
    LAST.baseTreble = clamp(data.treble_clock ?? LAST.baseTreble, LAST.pristine.treble-0.3, LAST.pristine.treble+0.3);
    LAST.source = 'AI Tune Pro';
    LAST.lastRefinedAt = Date.now();
    setKnob(document.getElementById('bassKnob'), LAST.baseBass);
    setKnob(document.getElementById('trebleKnob'), LAST.baseTreble);
    document.getElementById('notes').textContent = data.notes || 'Refinement AI applicato.';
    updateSelBar();
    refreshValues();
  }catch(e){
    document.getElementById('notes').textContent='Errore AI Pro. Mantengo il preset locale.';
  }
}

function resetToPristine(){
  LAST.baseBass = LAST.pristine.bass;
  LAST.baseTreble = LAST.pristine.treble;
  LAST.source = 'Preset';
  LAST.lastRefinedAt = null;
  setKnob(document.getElementById('bassKnob'), LAST.baseBass);
  setKnob(document.getElementById('trebleKnob'), LAST.baseTreble);
  document.getElementById('notes').textContent='Ripristinato il preset originale.';
  updateSelBar();
  refreshValues();
}

(function init(){ loadData(); })();