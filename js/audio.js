/* ================= Ritme-afspeler (planning op de audioklok, klank via Engine) ================= */
let timer = null, timeouts = [], state = null;
const $ = id => document.getElementById(id);
$('bpm').oninput = e => $('bpmVal').textContent = e.target.value;

// klank komt uit de gedeelde engine (engine.js)
const CLICK_KIND = { down:'accent', metro:'beat', up:'up', low:'low' };
const RHY_KEY = 'ritme-meespelen';
try { $('rhyOn').checked = localStorage.getItem(RHY_KEY) !== '0'; } catch(e){}
$('rhyOn').onchange = e => { try { localStorage.setItem(RHY_KEY, e.target.checked ? '1' : '0'); } catch(err){} e.target.blur(); };
// ritme stil? Alleen bij Atlas en Tikken (niet bij 'Eerst luisteren' en niet in Luisteren, daar moet je het juist horen)
function rhythmMuted(){
  if ($('rhyOn').checked) return false;
  if (typeof view === 'undefined') return false;
  if (view === 'atlas') return true;
  if (view === 'tikken') return !$('rListen').checked;
  return false;
}
function sound(t, kind, len){ Engine.click(t, CLICK_KIND[kind] || 'beat', len); }

// returns events with absolute time in seconds (relative to start)
// gctx: { gap:[on,off] | null, i: bar counter } for the "metronoom valt weg" mode
function buildEvents(cells, t0, bpm, gctx){
  const ev = []; let t = t0;
  for (const c of cells){
    const spq = 60 / bpm / c.tempoUnit;  // seconds per quarter note
    let mute = false;
    if (gctx && gctx.gap){ const [on, off] = gctx.gap; mute = (gctx.i % (on + off)) >= on; gctx.i++; }
    else if (gctx && gctx.rand){   // willekeurige maten stil (16-11-2026): nooit de eerste maat en nooit meer dan 2 stille maten achter elkaar
      mute = gctx.i > 0 && gctx.run < 2 && Math.random() < gctx.rand;
      gctx.run = mute ? gctx.run + 1 : 0; gctx.i++;
    }
    ev.push({ time:t, kind:'enter', cell:c, mute });
    clickList(c, c.seg).forEach(([p, k]) => ev.push({ time: t + p*spq, kind:k, mute }));
    [...c.notes, ...c.lowNotes].forEach(n => { if (n.attack) ev.push({ time: t + (c.lead + n.play)*spq, kind: n.layer, note:n, len: n.len * spq, mute }); });
    t += c.seg * spq;
  }
  ev.sort((a,b) => a.time - b.time || (a.kind === 'enter' ? -1 : b.kind === 'enter' ? 1 : 0));
  return { ev, end:t };
}

function play(cells, opts = {}){
  stop(); ensureCtx();
  const bpm = opts.bpm || +$('bpm').value;
  const first = cells[0];
  let pre = [], t0 = 0;
  if (opts.countin ?? $('countin').checked){
    const spq = 60 / bpm / first.tempoUnit;
    const len = countInLen(first);
    pre = clickList(first, len).map(([p,k]) => ({ time:p*spq, kind:k, count:true }));
    t0 = len * spq;
  }
  const gctx = { gap: opts.gap || null, rand: opts.rand || 0, i: 0, run: 0 };
  const r = buildEvents(cells, t0, bpm, gctx);
  state = { start: actx.currentTime + .08, bpm, gctx, metro: opts.metro ?? $('metro').checked, loop: opts.loop ?? $('loop').checked,
            next: opts.next || null, onDone: opts.onDone || null, track: !!opts.track, cells, queue:[...pre, ...r.ev], end:r.end };
  if (state.track) tapReset();
  timer = setInterval(schedule, 25); schedule();
}

function schedule(){
  if (!state) return;
  const ahead = actx.currentTime + .15;
  if (state.track) tapSummaryThrottled();
  while (true){
    if (!state.queue.length){
      if (state.next){ const nx = state.next(); if (!nx){ state.next = null; continue; } state.cells = nx.cells; state.bpm = nx.bpm; const r = buildEvents(state.cells, state.end, state.bpm, state.gctx); state.queue = r.ev; state.end = r.end; continue; }
      if (state.loop){ const r = buildEvents(state.cells, state.end, state.bpm, state.gctx); state.queue = r.ev; state.end = r.end; continue; }
      if (actx.currentTime > state.start + state.end + .25){
        const done = state.onDone, tracked = state.track;
        if (tracked) tapSummary(true);
        stop();
        if (done) done();
      }
      return;
    }
    const e = state.queue[0], t = state.start + e.time;
    if (t > ahead) return;
    state.queue.shift();
    const delay = Math.max(0, (t - actx.currentTime) * 1000);
    if (e.kind === 'up' || e.kind === 'low'){
      if (state.track) tapExpect(t, e.note);
      if (!e.mute){ if (!rhythmMuted()) sound(t, e.kind, e.len); visual(delay, e.note); }
    }
    else if (e.kind === 'down' || e.kind === 'metro'){ if (!e.mute && (state.metro || e.count)) sound(t, e.kind); }
    else if (e.kind === 'enter'){
      const c = e.cell, multi = state.cells.length > 1, mute = e.mute;
      timeouts.push(setTimeout(() => {
        document.querySelectorAll('.card.active').forEach(x => x.classList.remove('active'));
        if (!c.card) return;
        c.card.classList.add('active');
        c.card.classList.toggle('silent', !!mute);
        if (state && state.track) [...c.notes, ...c.lowNotes].forEach(n => ['tg','tk','to','tb','miss'].forEach(k => { n.marker && n.marker.classList.remove(k); n.el && n.el.classList.remove(k); }));
        if (multi) c.card.scrollIntoView({ block:'nearest', behavior:'smooth' });
      }, delay));
    }
  }
}
function visual(delay, n){
  timeouts.push(setTimeout(() => {
    n.el && n.el.classList.add('hit'); n.marker && n.marker.classList.add('on');
    timeouts.push(setTimeout(() => { n.el && n.el.classList.remove('hit'); n.marker && n.marker.classList.remove('on'); }, 140));
  }, delay));
}
function stop(){
  clearInterval(timer); timer = null; state = null;
  if (typeof gStopNotes === 'function') gStopNotes();
  if (typeof aStopNotes === 'function') aStopNotes();
  if (typeof rtStopAll === 'function') rtStopAll();
  if (typeof hrStop === 'function' && typeof hrTimers !== 'undefined' && hrTimers.length) hrStop();
  if (tap.calibrating){ tap.calibrating = false; showCalib(); }
  if (paused){ paused = false; if (actx) actx.resume(); $('pause').classList.remove('on'); $('pause').textContent = '⏸ Pauze'; }
  timeouts.forEach(clearTimeout); timeouts = [];
  document.querySelectorAll('.card.active').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.card.silent').forEach(x => x.classList.remove('silent'));
  document.querySelectorAll('.hit').forEach(x => x.classList.remove('hit'));
  document.querySelectorAll('.m.on').forEach(x => x.classList.remove('on'));
}

function showDone(tracked){
  const box = $('doneBox');
  let txt = 'Alle rondes gespeeld.';
  if (tracked){
    const hit = tap.expected.filter(e => e.off !== null), all = tap.expected.length;
    if (all && hit.length){
      const offs = hit.map(e => e.off), mean = offs.reduce((a,b) => a+b, 0) / offs.length;
      const strak = offs.filter(o => Math.abs(o) <= 30).length;
      const m = Math.round(mean);
      txt = `${Math.round(hit.length / all * 100)}% raak · ${Math.round(strak / offs.length * 100)}% strak · gemiddeld ${m > 0 ? '+' : ''}${m} ms${Math.abs(m) > 5 ? (m > 0 ? ' (sleept)' : ' (jaagt)') : ''} · ${all - hit.length} gemist · ${tap.extra} extra`;
    } else if (all) txt = 'Geen tikken gemeten. Tik mee met de spatiebalk of op het vak.';
  }
  box.innerHTML = `<h3>🏁 Klaar!</h3><p>${txt}</p>`;
  box.classList.add('on');
}

/* ================= Pauze ================= */
let paused = false;
function setPaused(p){
  if (!actx) return;
  if (p && !state) return;
  paused = p;
  if (p) actx.suspend(); else actx.resume();
  $('pause').classList.toggle('on', p);
  $('pause').textContent = p ? '▶ Verder' : '⏸ Pauze';
}
$('pause').onclick = () => { $('pause').blur(); setPaused(!paused); };

