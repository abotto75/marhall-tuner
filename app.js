function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function fmt(v){const r=Math.round(v*10)/10;return (Number.isInteger(r)?String(r):r.toFixed(1)).replace('.0','');}
function clockToLed(clock){return Math.round(10 * (clock - 0.5) / 3);}
function clockToDeg(clock){const pct=Math.min(1,Math.max(0,(clock-0.5)/3));return -135 + pct*270;}
const qs=s=>document.querySelector(s); const qsa=s=>[...document.querySelectorAll(s)];
let PRESETS=null, KEYWORDS=null, LAST={query:'', baseBass:2.0, baseTreble:2.0, genreId:null, subId:null};

async function loadData(){
  PRESETS = await (await fetch('data/presets.json')).json();
  KEYWORDS = await (await fetch('data/keywords.json')).json();
  renderGenreChips();
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
function applyPreset(b,t,notes){
  const bass=clamp(b,0.5,3.5), treble=clamp(t,0.5,3.5);
  qs('#bassClock').textContent=fmt(bass); qs('#trebleClock').textContent=fmt(treble);
  const bLed=clamp(clockToLed(bass),0,10), tLed=clamp(clockToLed(treble),0,10);
  qs('#bassLed').textContent=bLed; qs('#trebleLed').textContent=tLed;
  qs('#bassTick').textContent=bLed+'/10'; qs('#trebleTick').textContent=tLed+'/10';
  setKnob(qs('#bassKnob'), bass); setKnob(qs('#trebleKnob'), treble);
  qs('#notes').textContent=notes || 'Preset locale applicato.';
}

function selectGenre(gid){
  const g = PRESETS.genres[gid];
  applyPreset(g.bass_clock, g.treble_clock, g.notes||'Preset genere applicato.');
  LAST={...LAST, query:g.name, baseBass:g.bass_clock, baseTreble:g.treble_clock, genreId:gid, subId:null};
  renderSubgenreChips(gid);
}

function applySubgenre(gid, sid){
  const list = PRESETS.subgenres[gid]||[];
  const sg = list.find(x=>x.id===sid); if(!sg) return;
  const gName = PRESETS.genres[gid]?.name || gid;
  applyPreset(sg.bass_clock, sg.treble_clock, `Preset sottogenere: ${sg.name}`);
  LAST={...LAST, query:`${gName} — ${sg.name}`, baseBass:sg.bass_clock, baseTreble:sg.treble_clock, genreId:gid, subId:sid};
}

function applyFromSearch(){
  const t = qs('#omnibox').value.trim().toLowerCase();
  if(!t){ alert('Scegli un genere o scrivi qualcosa.'); return; }
  // quick classify by genre keywords only (subgeneri via chips)
  for(const [gid, words] of Object.entries(KEYWORDS)){
    if(words.some(w=>t.includes(w))){
      selectGenre(gid);
      return;
    }
  }
  // default Pop
  selectGenre('pop');
  qs('#notes').textContent='Testo non riconosciuto: applico Pop. Seleziona un genere o scegli un sottogenere sotto.';
}

async function askAIPro(){
  if(!LAST || !LAST.query){ alert('Prima scegli un genere/sottogenere.'); return; }
  const room='neutral'; const volume=70; // opzionale: potresti aggiungere controlli extra
  const body={ query:`Approfondisci per "${LAST.query}" su Marshall Acton III. Parti dal preset e adatta al contesto.`,
               room, volume, base_bass:LAST.baseBass, base_treble:LAST.baseTreble, max_delta:0.3 };
  try{
    const res=await fetch('/api/tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok) throw new Error('AI '+res.status);
    const data=await res.json();
    const b=Math.min(LAST.baseBass+0.3, Math.max(LAST.baseBass-0.3, data.bass_clock??LAST.baseBass));
    const t=Math.min(LAST.baseTreble+0.3, Math.max(LAST.baseTreble-0.3, data.treble_clock??LAST.baseTreble));
    applyPreset(b,t,data.notes||'Refinement AI applicato.');
  }catch(e){
    qs('#notes').textContent='Errore AI Pro. Mantengo il preset locale.';
  }
}

(function init(){
  loadData();
  qs('#applyBtn').onclick=applyFromSearch;
  qs('#aiBtn').onclick=askAIPro;
  qs('#resetBtn').onclick=()=>{ location.reload(); };
})();