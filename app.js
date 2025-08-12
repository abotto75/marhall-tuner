const qs=s=>document.querySelector(s); const qsa=s=>document.querySelectorAll(s);
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function clockToDeg(clock){const pct=Math.min(1,Math.max(0,(clock-0.5)/3));return -135 + pct*270;}
function setKnob(el, clock){ el.style.transform=`rotate(${clockToDeg(clock)}deg)`; }
function ledRound(val){ const base=Math.floor(val); const frac=val-base; return (frac<=0.5)?base:(base+1); }
function ticksToHours(t){ return 0.5 + (t/10)*3.0; }
function hoursToTicks(h){ return clamp((h-0.5)/3.0*10,0,10); }

let PRESETS=null, CURVES10=null, COEFF=null;
let LAST={genreId:null, subId:null, baseBass:2.0, baseTreble:2.0, source:'Preset', ts:null};

async function loadAll(){
  PRESETS = await (await fetch('data/presets.json')).json();
  CURVES10 = await (await fetch('data/curves10.json')).json();
  COEFF = await (await fetch('data/coefficients.json')).json();
  renderGenres();
  attachUI();
  updateSelBar();
}
function renderGenres(){
  const wrap=qs('#chips'); wrap.innerHTML='';
  (PRESETS.top_genres_order||Object.keys(PRESETS.genres)).forEach(gid=>{
    const b=document.createElement('button'); b.className='chip'; b.textContent=PRESETS.genres[gid].name; b.onclick=()=>selectGenre(gid); wrap.appendChild(b);
  });
}
function renderSub(gid){
  const sw=qs('#subWrap'), sc=qs('#subchips'); sc.innerHTML='';
  const list=(PRESETS.subgenres||{})[gid]||[]; sw.hidden=list.length===0;
  list.forEach(sg=>{ const b=document.createElement('button'); b.className='chip'; b.textContent=sg.name; b.onclick=()=>applySub(gid, sg.id); sc.appendChild(b); });
}
function selectGenre(gid){
  const g=PRESETS.genres[gid]; LAST.genreId=gid; LAST.subId=null;
  LAST.baseBass=g.bass_clock; LAST.baseTreble=g.treble_clock;
  setKnob(qs('#bassKnob'), LAST.baseBass); setKnob(qs('#trebleKnob'), LAST.baseTreble);
  refreshBT();
  renderSub(gid); updateSelBar(); render10();
  computeOutput();
}
function applySub(gid,sid){
  const sg=((PRESETS.subgenres||{})[gid]||[]).find(x=>x.id===sid); if(!sg) return;
  LAST.genreId=gid; LAST.subId=sid; LAST.baseBass=sg.bass_clock; LAST.baseTreble=sg.treble_clock;
  setKnob(qs('#bassKnob'), LAST.baseBass); setKnob(qs('#trebleKnob'), LAST.baseTreble);
  refreshBT(); updateSelBar(); render10(); computeOutput();
}
function refreshBT(){
  const bTick = ledRound((LAST.baseBass-0.5)/3*10);
  const tTick = ledRound((LAST.baseTreble-0.5)/3*10);
  qs('#bassTick').textContent = bTick+'/10';
  qs('#trebleTick').textContent = tTick+'/10';
  qs('#bassValue').textContent = Math.round((LAST.baseBass-0.5)/3*100)+'%';
  qs('#trebleValue').textContent = Math.round((LAST.baseTreble-0.5)/3*100)+'%';
}
function updateSelBar(){
  const gName = LAST.genreId ? (PRESETS.genres[LAST.genreId]?.name||LAST.genreId) : 'Nessuna selezione';
  let text=gName;
  if(LAST.subId){
    const sub=((PRESETS.subgenres||{})[LAST.genreId]||[]).find(s=>s.id===LAST.subId);
    if(sub) text = `${gName} — ${sub.name}`;
  }
  qs('#selText').textContent=text;
  const badge=qs('#sourceBadge'); badge.textContent=LAST.source; badge.classList.toggle('aipro', LAST.source==='AI Tune Pro');
}
function render10(){
  const gId = LAST.subId ? null : LAST.genreId;
  const ten = (LAST.subId && (CURVES10.subgenres?.[LAST.genreId]?.[LAST.subId])) || (CURVES10.genres?.[LAST.genreId]) || null;
  const box=qs('#band10'); box.innerHTML='';
  const order=["31","62","125","250","500","1k","2k","4k","8k","16k"];
  if(!ten){ box.textContent="Nessun profilo universale definito per questo (sotto)genere."; return; }
  order.forEach(k=>{ const d=document.createElement('div'); d.className='b'; d.textContent=`${k}: ${ten[k]??0} dB`; box.appendChild(d); });
}
function computeOutput(){
  const ten = (LAST.subId && (CURVES10.subgenres?.[LAST.genreId]?.[LAST.subId])) || (CURVES10.genres?.[LAST.genreId]) || null;
  if(!ten) return;
  if(currentMode==='bt'){
    const r = toBassTreble(ten, COEFF);
    LAST.baseBass = ticksToHours(r.ticks.bass);
    LAST.baseTreble = ticksToHours(r.ticks.treble);
    setKnob(qs('#bassKnob'), LAST.baseBass); setKnob(qs('#trebleKnob'), LAST.baseTreble);
    qs('#bassTick').textContent = r.led.bass+'/10'; qs('#trebleTick').textContent = r.led.treble+'/10';
    qs('#bassValue').textContent = (Math.round((LAST.baseBass-0.5)/3*100))+'%';
    qs('#trebleValue').textContent = (Math.round((LAST.baseTreble-0.5)/3*100))+'%';
  }else{
    const a = toApp5(ten);
    qs('#a160').textContent=a.APP_160.toFixed(2);
    qs('#a400').textContent=a.APP_400.toFixed(2);
    qs('#a1k').textContent=(typeof a.APP_1k==="number"?a.APP_1k.toFixed(2):a.APP_1k);
    qs('#a2k5').textContent=a.APP_2k5.toFixed(2);
    qs('#a6k25').textContent=a.APP_6k25.toFixed(2);
  }
}
let currentMode='bt';
function attachUI(){
  qs('#modeBT').onclick=()=>{currentMode='bt'; qs('#modeBT').classList.add('active'); qs('#modeAPP').classList.remove('active'); qs('#btBox').hidden=false; qs('#appBox').hidden=true; computeOutput();};
  qs('#modeAPP').onclick=()=>{currentMode='app5'; qs('#modeAPP').classList.add('active'); qs('#modeBT').classList.remove('active'); qs('#btBox').hidden=true; qs('#appBox').hidden=false; computeOutput();};
  qs('#copyApp').onclick=()=>{
    const row=[qs('#a160').textContent,qs('#a400').textContent,qs('#a1k').textContent,qs('#a2k5').textContent,qs('#a6k25').textContent].join(',');
    navigator.clipboard.writeText(row);
  };
  // Consult
  const cInput=qs('#consultInput'), cBtn=qs('#consultBtn'), cRes=qs('#consultResult'), cGenre=qs('#consultGenre'), cNote=qs('#consultNote');
  const cApply=qs('#consultApply'), cReset=qs('#consultReset');
  let last={genreName:"", note:""};
  cBtn.onclick=async ()=>{
    const text=(cInput.value||"").trim(); if(text.length<2){alert("Scrivi qualcosa.");return;}
    cBtn.disabled=true; cBtn.textContent="Analizzo…";
    try{
      const allowed=Object.values(PRESETS.genres).map(g=>g.name);
      const r=await fetch('/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text, allowedGenres: allowed})});
      const j=await r.json();
      last=j; cGenre.textContent=j.genreName||"Sconosciuto"; cNote.textContent=j.note||""; cRes.hidden=false;
    }catch(e){ cGenre.textContent="Errore"; cNote.textContent=String(e); cRes.hidden=false; }
    finally{ cBtn.disabled=false; cBtn.textContent="Consigliami il genere"; }
  };
  cApply.onclick=()=>{
    // map name to id
    const name = (last.genreName||"").toLowerCase();
    const gid = Object.keys(PRESETS.genres).find(id => (PRESETS.genres[id].name||id).toLowerCase()===name);
    if(!gid){ alert("Genere non presente nei preset."); return; }
    selectGenre(gid);
    qs('#sourceBadge').textContent="AI Consiglio";
    cRes.hidden=true;
  };
  cReset.onclick=()=>{ cInput.value=""; cRes.hidden=true; last={}; };
  // AI Pro
  const aiVol=qs('#aiVolume'); const aiVal=qs('#aiVolVal'); aiVol.oninput=()=>aiVal.textContent=aiVol.value;
  qs('#aiBtn').onclick=askAIPro; qs('#resetBtn').onclick=resetPreset;
}
function fmtTs(d){const pad=n=>String(n).padStart(2,'0'); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}`;}
async function askAIPro(){
  if(!LAST.genreId){ alert("Seleziona un genere prima."); return; }
  const room=qs('#aiRoom').value, volume=parseInt(qs('#aiVolume').value,10); const extra=(qs('#freeText').value||'').trim();
  const gName = PRESETS.genres[LAST.genreId]?.name||LAST.genreId;
  const query = extra ? `${gName} — ${extra}` : gName;
  const body={query:`Approfondisci per "${query}" su Marshall Acton III.`, room, volume, base_bass: LAST.baseBass, base_treble: LAST.baseTreble, max_delta:0.3};
  try{
    const r=await fetch('/api/tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json(); LAST.baseBass=j.bass_clock; LAST.baseTreble=j.treble_clock;
    setKnob(qs('#bassKnob'), LAST.baseBass); setKnob(qs('#trebleKnob'), LAST.baseTreble);
    refreshBT(); LAST.source='AI Tune Pro'; LAST.ts=fmtTs(new Date()); updateSelBar(); qs('#notes').textContent=j.notes||'Affinamento applicato.';
  }catch(e){ qs('#notes').textContent='Errore AI Pro'; }
}
function resetPreset(){
  if(!LAST.genreId){return;}
  const base = PRESETS.genres[LAST.genreId];
  LAST.baseBass=base.bass_clock; LAST.baseTreble=base.treble_clock; LAST.source='Preset'; LAST.ts=null;
  setKnob(qs('#bassKnob'), LAST.baseBass); setKnob(qs('#trebleKnob'), LAST.baseTreble); refreshBT(); updateSelBar();
}

loadAll();