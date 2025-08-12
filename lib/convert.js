export function toApp5(ten) {
  const num = x => Number(x ?? 0);
  const v = f => {
    const k = String(f);
    return num(ten[k]);
  };
  const lerp = (a,b,t)=>a+(b-a)*t;
  const out = {
    "APP_160":  lerp(v(125), v(250), 0.5),
    "APP_400":  lerp(v(250), v(500), 0.5),
    "APP_1k":   (ten["1k"] ?? ten["1000"] ?? 0),
    "APP_2k5":  lerp(v(2000), v(4000), 0.5),
    "APP_6k25": lerp(v(4000), v(8000), 0.5)
  };
  return out;
}

export function toBassTreble(ten, coeff) {
  const num = x => Number(x ?? 0);
  const g = k => num(ten[k]);
  const wb = coeff.weights?.bass || {};
  const wt = coeff.weights?.treble || {};
  const dbBass   = (wb["31"]||0)*g("31") + (wb["62"]||0)*g("62") + (wb["125"]||0)*g("125") + (wb["250"]||0)*g("250");
  const dbTreble = (wt["2k"]||0)*g("2k") + (wt["4k"]||0)*g("4k") + (wt["8k"]||0)*g("8k") + (wt["16k"]||0)*g("16k");
  const baseTick = coeff.flat_tick ?? 5;
  const dbPerTickB = coeff.db_per_tick?.bass ?? 1.0;
  const dbPerTickT = coeff.db_per_tick?.treble ?? 1.0;
  const tickBass   = clamp(baseTick + dbBass   / dbPerTickB, 0, 10);
  const tickTreble = clamp(baseTick + dbTreble / dbPerTickT, 0, 10);
  const led = t => { const i=Math.floor(t), f=t-i; return f<=0.5 ? i : i+1; };
  const tickToHours = t => 0.5 + (t/10)*3.0;
  return {
    ticks: { bass: tickBass, treble: tickTreble },
    led:   { bass: led(tickBass), treble: led(tickTreble) },
    hours: { bass: tickToHours(tickBass), treble: tickToHours(tickTreble) },
    db_mix:{ bass: dbBass, treble: dbTreble }
  };
}

function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }
