/* ================= Tik-score ================= */
const CAL_KEY = 'ritme-atlas-calib';
let calib = 0;
try { calib = +localStorage.getItem(CAL_KEY) || 0; } catch(e){}
let tap = { expected:[], extra:0, lastSum:0, calibrating:false };
function tapReset(){
  tap.expected = []; tap.extra = 0; tap.lastSum = 0;
  if ($('tapLive')){ $('tapLive').textContent = '–'; $('tapLive').className = 'taplive'; }
  tapSummary(false);
}
function tapExpect(t, note){
  const ex = tap.expected;
  ex.push({ t, note, off:null });
  // keep the list short: old, finished notes are only needed for the totals
  if (ex.length > 4000) ex.splice(0, 1000);
}
function grade(ms){ const a = Math.abs(ms); return a <= 30 ? 'tg' : a <= 60 ? 'tk' : a <= 100 ? 'to' : 'tb'; }
function doTap(){
  const pad = $('tapPad');
  if (pad){ pad.classList.add('flash'); setTimeout(() => pad.classList.remove('flash'), 90); }
  if (!state || !state.track || !actx || paused) return;
  const lat = actx.outputLatency || actx.baseLatency || 0;
  const raw = actx.currentTime - lat;              // the moment you heard, in audio-clock time
  const tt = raw - (tap.calibrating ? 0 : calib / 1000);
  const ex = tap.expected;
  let best = null, bestD = Infinity;
  for (let i = ex.length - 1; i >= 0; i--){
    const e = ex[i];
    if (e.t < tt - .3) break;
    if (e.off !== null) continue;
    const prev = ex[i-1], next = ex[i+1];
    let w = tap.calibrating ? .25 : .15;
    if (prev) w = Math.min(w, (e.t - prev.t) / 2);
    if (next) w = Math.min(w, (next.t - e.t) / 2);
    const d = Math.abs(tt - e.t);
    if (d <= w + 1e-4 && d < bestD){ best = e; bestD = d; }
  }
  const live = $('tapLive');
  if (!best){ tap.extra++; if (live){ live.textContent = 'extra tik'; live.className = 'taplive tb'; } return; }
  best.off = (tt - best.t) * 1000;
  best.raw = (raw - best.t) * 1000;
  const g = grade(best.off);
  if (best.note.marker) best.note.marker.classList.add(g);
  if (best.note.el) best.note.el.classList.add(g);
  if (live){
    const ms = Math.round(best.off);
    live.textContent = Math.abs(ms) <= 5 ? 'precies!' : `${ms > 0 ? '+' : ''}${ms} ms ${ms > 0 ? 'te laat' : 'te vroeg'}`;
    live.className = 'taplive ' + g;
  }
  tapSummaryThrottled();
}
function tapSummaryThrottled(){ const now = performance.now(); if (now - tap.lastSum > 250){ tap.lastSum = now; tapSummary(false); } }
function tapSummary(final){
  const box = $('tapSum'); if (!box) return;
  if (tap.calibrating) { box.textContent = 'Kalibreren… tik precies mee op de tonen.'; return; }
  const now = actx ? actx.currentTime - (actx.outputLatency || 0) : 0;
  const due = tap.expected.filter(e => final || e.t < now - .2);
  due.forEach(e => { if (e.off === null && !e.missed){ e.missed = true; e.note.marker && e.note.marker.classList.add('miss'); } });
  const hit = due.filter(e => e.off !== null);
  if (!due.length){ box.innerHTML = '<span class="muted">Druk op ▶ Speel en tik mee.</span>'; return; }
  const offs = hit.map(e => e.off);
  const mean = offs.length ? offs.reduce((a,b) => a+b, 0) / offs.length : 0;
  const spread = offs.length ? offs.reduce((a,b) => a + Math.abs(b - mean), 0) / offs.length : 0;
  const strak = hit.filter(e => Math.abs(e.off) <= 30).length;
  const pct = Math.round(hit.length / due.length * 100);
  const m = Math.round(mean);
  box.innerHTML =
    `<span><b>${pct}%</b> raak (${hit.length}/${due.length})</span>` +
    `<span><b>${offs.length ? Math.round(strak / offs.length * 100) : 0}%</b> strak (±30 ms)</span>` +
    `<span>gemiddeld <b>${m > 0 ? '+' : ''}${m} ms</b> ${Math.abs(m) <= 5 ? '' : m > 0 ? '(sleept)' : '(jaagt)'}</span>` +
    `<span>spreiding <b>±${Math.round(spread)} ms</b></span>` +
    `<span>gemist <b>${due.length - hit.length}</b></span>` +
    `<span>extra <b>${tap.extra}</b></span>`;
}
function calibrate(){
  const cell = { title:'Kalibratie', groups:[G(rep('q', 12))] };
  analyse(cell);
  tap.calibrating = true;
  $('calVal').textContent = 'tik mee op de 12 tonen…';
  play([cell], { loop:false, bpm:80, track:true, metro:false, onDone: () => {
    tap.calibrating = false;
    const raws = tap.expected.filter(e => e.off !== null).map(e => e.raw).sort((a,b) => a-b);
    if (raws.length < 6){ $('calVal').textContent = 'te weinig tikken, probeer opnieuw'; tapSummary(false); return; }
    const trimmed = raws.slice(2);                       // first taps are often unsettled
    calib = Math.round(trimmed[Math.floor(trimmed.length / 2)]);
    try { localStorage.setItem(CAL_KEY, calib); } catch(e){}
    showCalib(); tapReset();
  }});
}
function showCalib(){ if ($('calVal')) $('calVal').textContent = `correctie ${calib > 0 ? '+' : ''}${calib} ms`; }

$('stop').onclick = stop;
document.addEventListener('keyup', e => { if ((view === 'tikken' || view === 'luisteren') && (e.code === 'Space' || e.key === ' ') && !['INPUT','SELECT'].includes(document.activeElement.tagName)) e.preventDefault(); });
document.addEventListener('keydown', e => {
  if (Keys.is(e, 'stop')) stop();
  if (Keys.blocked(e)) return;
  if (Keys.is(e, 'pauze') && ['atlas','tikken','luisteren'].includes(view)){ e.preventDefault(); setPaused(!paused); }
  if (view === 'tikken' && Keys.is(e, 'volgende') && !Keys.is(e, 'tik')){ e.preventDefault(); $('rNew').click(); }
  if (view === 'tikken' && Keys.is(e, 'tik')){
    e.preventDefault();
    if (!e.repeat) doTap();
  }
});

