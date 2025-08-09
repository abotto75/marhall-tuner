function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function fmt(v){const r=Math.round(v*10)/10;return (Number.isInteger(r)?String(r):r.toFixed(1)).replace('.0','');}
function clockToLed(clock){return Math.round(10 * (clock - 0.5) / 3);}
function ledToClock(led){return 0.5 + 3*(led/10);}

const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

function detectTypeFromText(txt){
  const t = (txt||"").trim();
  if(!t) return {type:"genre", query:"Rock"};
  const lowered=t.toLowerCase();
  if(lowered.includes("ost")||lowered.includes("soundtrack")||lowered.includes("score")) return {type:"score", query:t};
  if(lowered.includes("sinfonia")||lowered.includes("symphony")||lowered.includes("concerto")||lowered.includes("suite")||lowered.includes("op.")||lowered.includes("k.")||lowered.includes("bwv")) return {type:"work", query:t};
  if(t.includes(" - ")||t.includes(" — ")||t.includes("–")) return {type:"track", query:t};
  return {type:"artist", query:t};
}

function setArc(el, clock){
  const pct = clamp((clock - 0.5)/3, 0, 1);
  el.style.width = (pct*100).toFixed(0)+"%";
}

async function askAI(queryText){
  const room = qs('#room').value;
  const volume = parseInt(qs('#volume').value, 10);
  const res = await fetch('/api/tune',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ query: queryText, room, volume })
  });
  if(!res.ok){ throw new Error('AI '+res.status); }
  return await res.json();
}

function applyResult(data){
  const b = clamp(data.bass_clock ?? 2.0, 0.5, 3.5);
  const t = clamp(data.treble_clock ?? 1.5, 0.5, 3.5);
  qs('#bassClock').textContent = fmt(b);
  qs('#trebleClock').textContent = fmt(t);
  const bLed = clamp(clockToLed(b),0,10);
  const tLed = clamp(clockToLed(t),0,10);
  qs('#bassLed').textContent = bLed;
  qs('#trebleLed').textContent = tLed;
  setArc(qs('#bassArc'), b);
  setArc(qs('#trebleArc'), t);
  qs('#notes').textContent = data.notes || '—';
}

async function runAIFlow(){
  const tab = qsa('.seg-btn').find(x=>x.classList.contains('active'))?.dataset.tab || 'quick';
  let text = qs('#omnibox').value.trim();
  if(tab==='pro'){
    const type = qs('#type').value;
    const artist = qs('#fArtist').value.trim();
    const title = qs('#fTitle').value.trim();
    const extra = qs('#fExtra').value.trim();
    const parts = [];
    if(type==='genre' && title){ parts.push(`Genere: ${title}`); }
    else if(type==='genre' && artist){ parts.push(`Genere: ${artist}`); }
    else {
      if(artist) parts.push(artist);
      if(title) parts.push(title);
      if(extra) parts.push(extra);
    }
    text = parts.join(' — ') || text;
  }
  if(!text){
    alert('Scrivi un artista/brano/opera o scegli un genere.');
    return;
  }
  const btn = qs('#askBtn'); const ai = qs('#aiBtn');
  btn.disabled = ai.disabled = true;
  try{
    const {type} = detectTypeFromText(text);
    const query = `${type.charAt(0).toUpperCase()+type.slice(1)}: ${text}`;
    const data = await askAI(query);
    applyResult(data);
  }catch(e){
    qs('#notes').textContent = 'Errore richiesta AI. Controlla connessione o riprova.';
  }finally{
    btn.disabled = ai.disabled = false;
  }
}

(function init(){
  qsa('.chip').forEach(ch => ch.addEventListener('click', ()=>{
    qs('#omnibox').value = ch.dataset.query || '';
  }));
  qsa('.seg-btn').forEach(b => b.addEventListener('click', ()=>{
    qsa('.seg-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const pro = b.dataset.tab === 'pro';
    qs('#proTab').hidden = !pro;
  }));
  const vol = qs('#volume'); const volVal = qs('#volVal');
  vol.addEventListener('input', ()=>{ volVal.textContent = vol.value; });

  qs('#askBtn').addEventListener('click', runAIFlow);
  qs('#aiBtn').addEventListener('click', runAIFlow);
  qs('#resetBtn').addEventListener('click', ()=>{
    qs('#omnibox').value='';
    vol.value=70; volVal.textContent='70';
    qs('#room').value='neutral';
    qs('#bassClock').textContent='—'; qs('#trebleClock').textContent='—';
    qs('#bassLed').textContent='—'; qs('#trebleLed').textContent='—';
    qs('#bassArc').style.width='0%'; qs('#trebleArc').style.width='0%';
    qs('#notes').textContent='Inserisci un artista/genere o usa le chip sopra, poi premi AI.';
  });

  qs('#copyBtn').addEventListener('click', ()=>{
    const txt = `Bass: ${qs('#bassClock').textContent} ore (${qs('#bassLed').textContent}/10) | Treble: ${qs('#trebleClock').textContent} ore (${qs('#trebleLed').textContent}/10)\n${qs('#notes').textContent}`;
    navigator.clipboard.writeText(txt).then(()=>{ alert('Settaggi copiati.'); });
  });
})();