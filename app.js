function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function clockToLedFloat(clock){return 10 * (clock - 0.5) / 3;}
function ledRound(val){ const base=Math.floor(val); const frac=val-base; return (frac<=0.5)?base:(base+1); }
function clockToDeg(clock){const pct=Math.min(1,Math.max(0,(clock-0.5)/3));return -135 + pct*270;}
const qs=s=>document.querySelector(s);

let MAP=null;
let LAST={ genre:null, sub:null, bassH:2.0, trebleH:2.0, bassT:5, trebleT:5, pristine:{bassH:2.0, trebleH:2.0}, source:'Preset', ts:null };

async function loadData(){
  const rows = await (await fetch('data/presets.json')).json();
  const map = {};
  rows.forEach(r=>{
    const g=(r.genre||'').trim(); if(!g) return;
    const s=(r.subgenre||'').trim();
    const b=Number(r.bass||0), t=Number(r.treble||0);
    const guide=(r.guida||r.guide||'').trim();
    const song=(r.song||'').trim();
    const emotion=(r.emotion||'').trim();
    map[g] = map[g] || [];
    map[g].push({sub:s,b,t,guide,song,emotion});
  });
  MAP = map;
  renderGenres(Object.keys(map).sort());
  setupAI();
  updateSelBar();
}

function renderGenres(list){
  const wrap=qs('#chips'); wrap.innerHTML='';
  list.forEach(g=>{
    const b=document.createElement('button');
    b.className='chip'; b.textContent=g; b.onclick=()=>selectGenre(g);
    wrap.appendChild(b);
  });
}

function renderSubs(g){
  const sw=qs('#subWrap'); const sc=qs('#subchips'); sc.innerHTML='';
  const list = (MAP[g]||[]).map(x=>x.sub).filter(v=>v).filter((v,i,a)=>a.indexOf(v)===i);
  sw.hidden = list.length===0;
  list.forEach(s=>{
    const b=document.createElement('button');
    b.className='chip'; b.textContent=s; b.onclick=()=>applySub(g,s);
    sc.appendChild(b);
  });
}

function setKnob(el, clock){ el.style.transform=`rotate(${clockToDeg(clock)}deg)`; }
function tickToHours(t){ return 0.5 + (t/10)*3.0; }
function hoursToTick(h){ return clamp(Math.round(((h-0.5)/3)*10*100)/100, 0, 10); }

function applyPresetTick(bTick,tTick, meta){
  const bH = tickToHours(bTick), tH = tickToHours(tTick);
  LAST.bassH=clamp(bH,0.5,3.5); LAST.trebleH=clamp(tH,0.5,3.5);
  LAST.bassT=bTick; LAST.trebleT=tTick;
  LAST.pristine={bassH:LAST.bassH, trebleH:LAST.trebleH};
  LAST.source='Preset'; LAST.ts=null;
  setKnob(document.getElementById('bassKnob'), LAST.bassH);
  setKnob(document.getElementById('trebleKnob'), LAST.trebleH);
  document.getElementById('guideText').textContent = (meta?.guide||'Preset applicato.');
  document.getElementById('songText').textContent = meta?.song ? ('Brano consigliato: '+meta.song) : '';
  document.getElementById('emotionText').textContent = meta?.emotion ? ('Guida emozionale: '+meta.emotion) : '';
  updateSelBar(); refreshValues();
}

function refreshValues(){
  const bLed = ledRound(clockToLedFloat(LAST.bassH));
  const tLed = ledRound(clockToLedFloat(LAST.trebleH));
  document.getElementById('bassTick').textContent = bLed+'/10';
  document.getElementById('trebleTick').textContent = tLed+'/10';
  const f=v=>String(Math.round(v*10)/10).replace(/\.0$/,'');
  document.getElementById('bassValue').textContent = `${f(LAST.bassH)} ore (${LAST.bassT}/10)`;
  document.getElementById('trebleValue').textContent = `${f(LAST.trebleH)} ore (${LAST.trebleT}/10)`;
}

function updateSelBar(){
  let text = LAST.genre || 'Nessuna selezione';
  if (LAST.sub){ text = `${text} — ${LAST.sub}`; }
  qs('#selText').textContent = text;
  const badge = qs('#sourceBadge');
  badge.textContent = LAST.source;
  badge.classList.toggle('aipro', LAST.source==='AI Tune Pro');
  badge.classList.toggle('preset', LAST.source!=='AI Tune Pro');
  qs('#aiTs').hidden = !LAST.ts;
  if(LAST.ts) qs('#aiTs').textContent = LAST.ts;
}

function selectGenre(g){
  LAST.genre=g; LAST.sub=null;
  renderSubs(g);
  const rec=(MAP[g]||[])[0];
  if(rec){ applyPresetTick(rec.b, rec.t, rec); }
}

function applySub(g,s){
  const rec=(MAP[g]||[]).find(x=>x.sub===s) || (MAP[g]||[])[0];
  if(rec){ LAST.genre=g; LAST.sub=rec.sub||null; applyPresetTick(rec.b, rec.t, rec); }
}

function fmtTs(d){ const pad=n=>String(n).padStart(2,'0'); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

async function askAIPro(){
  if(!LAST.genre){ alert('Seleziona prima un genere/sottogenere.'); return; }
  const room=document.getElementById('aiRoom').value;
  const volume=parseInt(document.getElementById('aiVolume').value,10);
  const extra=(document.getElementById('freeText').value||'').trim();
  const query = extra ? `${LAST.genre}${LAST.sub?(' — '+LAST.sub):''} — ${extra}` : `${LAST.genre}${LAST.sub?(' — '+LAST.sub):''}`;
  const body = { query: `Affina per "${query}" su Marshall Acton III. Parti dal preset selezionato e adatta al contesto.`, room, volume, base_bass: LAST.bassH, base_treble: LAST.trebleH, max_delta: 0.3 };
  try{
    const res=await fetch('/api/tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok) throw new Error('AI '+res.status);
    const data=await res.json();
    LAST.bassH = clamp(data.bass_clock ?? LAST.bassH, LAST.pristine.bassH-0.3, LAST.pristine.bassH+0.3);
    LAST.trebleH = clamp(data.treble_clock ?? LAST.trebleH, LAST.pristine.trebleH-0.3, LAST.pristine.trebleH+0.3);
    setKnob(document.getElementById('bassKnob'), LAST.bassH);
    setKnob(document.getElementById('trebleKnob'), LAST.trebleH);
    LAST.source='AI Tune Pro'; LAST.ts=fmtTs(new Date());
    document.getElementById('notes').textContent = data.notes || 'Refinement AI applicato.';
    updateSelBar(); refreshValues();
  }catch(e){
    document.getElementById('notes').textContent='Errore AI Pro. Mantengo il preset locale.';
  }
}

// ---- Ricerca Genere (consulente) ----
function setupAI(){
  const artist = document.getElementById('artistInput');
  const track = document.getElementById('trackInput');
  const btn = document.getElementById('consultBtn');
  const resBox = document.getElementById('consultResult');
  const txt = document.getElementById('consultGenre');
  const note = document.getElementById('consultNote');
  const apply = document.getElementById('consultApply');
  const reset = document.getElementById('consultReset');

  let last = { genreName:'', note:'' };

  btn.onclick = async () => {
    const a=(artist.value||'').trim(), t=(track.value||'').trim();
    if(!a && !t){ alert('Inserisci almeno Artista o Brano.'); return; }
    btn.disabled=true; btn.textContent='Analizzo…';
    try{
      const r = await fetch('/api/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ artist:a, track:t })});
      const j = await r.json();
      last = j;
      txt.textContent = j.genreName || 'Sconosciuto';
      note.textContent = j.note || '';
      resBox.hidden=false;
    }catch(e){
      txt.textContent='Errore'; note.textContent='Classificazione non riuscita.'; resBox.hidden=false;
    }finally{
      btn.disabled=false; btn.textContent='Consigliami il genere';
    }
  };

  apply.onclick = () => {
    if(!last.genreName || last.genreName==='Sconosciuto'){ alert('Nessun genere applicabile.'); return; }
    selectGenre(last.genreName);
    resBox.hidden=true;
  };

  reset.onclick = () => { artist.value=''; track.value=''; resBox.hidden=true; };
}

(function init(){ loadData(); })();