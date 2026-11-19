/* ================= Slimme metronoom (view #metronoom, div #metroView, prefix mt) =================
   Gebruikt Engine.metronome met: pattern (accent/normaal/zacht/stil per tel), sub + swing,
   tempo(bar) voor het opbouwen en mute(bar, beat) voor de timing-tests.
   Opslag: 'metronoom-settings' (mtS), 'metronoom-setlist' ({items, cur}).
   Extra: aftellen (ci maten), maatteller met passagelengte (len, rondes), oefentimer (tmin minuten, 0 = stopwatch), setlist.
   Maatteller en timer kun je verbergen (showBar / showTime; algemene voorkeur, niet per setlist-item); een verborgen timer loopt niet. Logt niets in score-log, telt wel oefentijd (VIEWS bevat 'metronoom').
   Toetsen (Keys): metronoom = start/stop, pauze, stop, tik = tempo intikken, sneller/langzamer (Shift = ±5),
   volgende = "Gelukt" (+stap), vorige = "Te snel" (−stap) bij handmatig opbouwen; anders volgende = "Schoon gespeeld".
   Tempoverloop (ramp 'flow'): mtS.flow = [{n maten, m meter-index (-1 = zoals boven), a → b bpm}], flowLoop, flowPct (%).
   Stem (voice uit|af|aan): speechSynthesis, telt de tellen; de vertraging van de spraak wordt gemeten (onstart) en
   de stem start zoveel eerder (mediaan vAuto + handmatige bijstelling vLead); algemene voorkeur, niet per setlist-item.
   Setlist: items {id, stuk, deel, s, best, ok, secs, last, made, upd}; SL.smart = slim voorstel + starttempo-advies. */
(function(){
  const KEY = 'metronoom-settings', MIN = 20, MAX = 300;
  const METERS = [
    ['2/4', '2', 1], ['3/4', '3', 1], ['4/4', '4', 1], ['5/4', '5', 1], ['6/4', '6', 1], ['2/2 (alla breve)', '2', 1],
    ['6/8 in 2', '2', 3], ['6/8 in 6', '3+3', 1], ['9/8 in 3', '3', 3], ['12/8 in 4', '4', 3],
    ['5/8 (2+3)', '2+3', 1], ['5/8 (3+2)', '3+2', 1], ['7/8 (2+2+3)', '2+2+3', 1], ['7/8 (3+2+2)', '3+2+2', 1],
    ['7/8 (2+3+2)', '2+3+2', 1], ['8/8 (3+3+2)', '3+3+2', 1], ['Eigen…', null, null]
  ];
  const SUBS = [[1, 'Geen'], [2, 'Achtsten (2)'], [3, 'Triolen (3)'], [4, 'Zestienden (4)'], [5, 'Kwintolen (5)'], [6, 'Sextolen (6)']];
  const LV = ['a', 'b', 'z', 'x'], LVNAME = { a:'accent', b:'normaal', z:'zacht', x:'stil' };
  const DUN = ['alle tellen', 'alleen tel 1', 'tel 1, om de maat', 'helemaal stil'];
  const TERMS = [[40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [168, 'Allegro'], [200, 'Presto'], [999, 'Prestissimo']];

  const D = { bpm:80, meter:2, groups:'4', sub:1, swing:62, pattern:null,
              ramp:'uit', to:120, step:4, every:4, back:false,
              test:'uit', on:3, off:1, dun:2, pct:25, ci:1, len:0, tmin:0, showBar:true, showTime:true,
              flow:[{ n:8, m:-1, a:80, b:80 }], flowLoop:true, flowPct:100, voice:'uit', vLead:0, vAuto:200, vVer:2, meet:false };
  const SNAP = ['bpm','meter','groups','sub','swing','pattern','ramp','to','step','every','back','test','on','off','dun','pct','ci','len','tmin','flow','flowLoop','flowPct'];
  const NUMS = { nl:['één','twee','drie','vier','vijf','zes','zeven','acht','negen','tien','elf','twaalf','dertien','veertien','vijftien','zestien'],
                 en:['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen'] };
  let mtS = Object.assign({}, D);
  try { Object.assign(mtS, JSON.parse(localStorage.getItem(KEY)) || {}); } catch(e){}
  if (mtS.vVer !== 2){ mtS.vLead = 0; mtS.vAuto = 200; mtS.vVer = 2; }
  if (!Array.isArray(mtS.flow) || !mtS.flow.length) mtS.flow = D.flow.map(x => Object.assign({}, x));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mtS)); } catch(e){} };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const $m = id => document.getElementById(id);

  /* --- maat: groepen → tellen en standaard-accentpatroon --- */
  function parseGroups(txt){
    const t = String(txt || '').replace(/\s/g, '');
    if (/^\d+$/.test(t)){ const n = clamp(+t, 1, 16); return { n, groups:null }; }
    const g = t.split('+').map(Number).filter(x => x >= 1 && x <= 9);
    if (!g.length) return { n:4, groups:null };
    const n = g.reduce((a, b) => a + b, 0);
    return n > 16 ? { n:4, groups:null } : { n, groups:g };
  }
  function defPattern(txt){
    const { n, groups } = parseGroups(txt == null ? mtS.groups : txt);
    if (!groups) return Array.from({ length:n }, (_, i) => i === 0 ? 'a' : 'b');
    const p = []; groups.forEach((g, gi) => { for (let i = 0; i < g; i++) p.push(i ? 'z' : gi ? 'b' : 'a'); });
    return p;
  }
  function pattern(){
    const n = parseGroups(mtS.groups).n;
    if (!Array.isArray(mtS.pattern) || mtS.pattern.length !== n) mtS.pattern = defPattern();
    return mtS.pattern;
  }
  // groepsgrenzen (tel-index waar een nieuwe groep begint) voor de ruimte tussen de bolletjes
  function starts(){
    const { n, groups } = parseGroups(mtS.groups);
    if (!groups) return new Set();
    const s = new Set(); let k = 0; groups.forEach(g => { s.add(k); k += g; }); return s;
  }

  /* --- lopende sessie --- */
  let run = null;          // {bar0, lastBar, start, shift, reached, paused}
  function curBase(){ return mtS.bpm; }
  function rampBpm(abs){
    if (!run || mtS.ramp !== 'auto') return null;
    const start = run.start + run.shift, goal = mtS.to, dir = goal >= start ? 1 : -1;
    const every = Math.max(1, mtS.every), step = Math.max(1, mtS.step);
    const k = Math.floor(abs / every);
    // twee vooruit, één terug: +s, +s, −s  → netto +s per 3 stappen
    const cum = mtS.back ? (Math.floor(k / 3) + (k % 3 === 0 ? 0 : k % 3 === 1 ? 1 : 2)) * step : k * step;
    const b = start + dir * cum;
    return clamp(Math.round(dir > 0 ? Math.min(b, goal) : Math.max(b, goal)), MIN, MAX);
  }
  function muteAt(abs, beat){
    if (mtS.test === 'gap'){ const on = Math.max(1, mtS.on), off = Math.max(1, mtS.off); return abs % (on + off) >= on; }
    if (mtS.test === 'dun'){
      const per = Math.max(1, mtS.dun), st = Math.floor(abs / per) % 4, inSt = abs % per;
      if (st === 0) return false;
      if (st === 1) return beat > 0;
      if (st === 2) return beat > 0 || inSt % 2 === 1;
      return true;
    }
    if (mtS.test === 'rand') return beat > 0 && Math.random() * 100 < mtS.pct;
    return false;
  }
  function dunStage(abs){ return Math.floor(abs / Math.max(1, mtS.dun)) % 4; }

  /* --- tempoverloop: delen met eigen maatsoort en tempo van a naar b (rit. / accel.) --- */
  const flowSegs = () => (mtS.flow || []).filter(x => x.n >= 1);
  const flowTotal = () => flowSegs().reduce((t, x) => t + x.n, 0);
  function segAt(abs){
    const segs = flowSegs(), tot = flowTotal(); if (!tot) return null;
    if (abs >= tot){ if (!mtS.flowLoop) return null; abs %= tot; }
    let k = abs;
    for (let i = 0; i < segs.length; i++){ if (k < segs[i].n) return { seg:segs[i], i, k, abs }; k -= segs[i].n; }
    return null;
  }
  function segLayout(seg){
    if (!seg || seg.m < 0 || !METERS[seg.m] || METERS[seg.m][1] === null) return { pattern:pattern().slice(), sub:+mtS.sub };
    const M = METERS[seg.m], mainSub = METERS[mtS.meter] && METERS[mtS.meter][2] > 1;
    return { pattern:defPattern(M[1]), sub: M[2] > 1 ? M[2] : mainSub ? 1 : +mtS.sub };
  }
  function flowBpm(abs, beat, beats){
    const x = segAt(abs); if (!x) return null;
    const n = x.seg.n * beats, j = x.k * beats + beat;
    const f = n > 1 ? j / (n - 1) : 0;
    return clamp(Math.round((x.seg.a + (x.seg.b - x.seg.a) * f) * mtS.flowPct / 100), MIN, MAX);
  }
  const segTag = x => x.b < x.a ? 'rit.' : x.b > x.a ? 'accel.' : 'a tempo';

  /* --- tellende stem (speechSynthesis; loopt een fractie achter, daarom vLead ms vooruit) --- */
  const hasVoice = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  let vVoice = null, vLang = 'nl';
  function pickVoice(){
    if (!hasVoice) return;
    const vs = speechSynthesis.getVoices() || [];
    vVoice = vs.find(v => /^nl/i.test(v.lang)) || null; vLang = 'nl';
    if (!vVoice){ vVoice = vs.find(v => /^en/i.test(v.lang)) || null; if (vVoice) vLang = 'en'; }
  }
  if (hasVoice){ pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch(e){} }
  // gemeten vertraging: tijd tussen speak() en het moment dat de spraak echt begint (onstart); mediaan van de laatste 12
  let vLat = [];
  const vLeadMs = () => clamp((mtS.vAuto || 200) + (mtS.vLead || 0), 0, 900);
  const vAhead = () => Math.min(1.1, vLeadMs() / 1000 + .12);
  function vMeasure(ms){
    if (!(ms > 15 && ms < 1500)) return;
    vLat.push(ms); if (vLat.length > 12) vLat.shift();
    const srt = vLat.slice().sort((a, b) => a - b), med = srt[Math.floor(srt.length / 2)];
    mtS.vAuto = Math.round(med); save(); vInfo();
    if (playing()) Engine.metronome.set({ ahead: vAhead() });
  }
  function vInfo(){ const el = $m('mtVInfo'); if (el) el.textContent = hasVoice ? `gemeten vertraging ±${mtS.vAuto} ms` + (vLat.length ? '' : ' (nog niet gemeten)') : ''; }
  function say(word, bpm, vol){
    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word), t0 = performance.now();
      if (vVoice) u.voice = vVoice;
      u.lang = vLang === 'nl' ? 'nl-NL' : 'en-US'; u.rate = clamp(bpm / 60, 1.2, 3); u.volume = vol == null ? 1 : vol;
      u.onstart = () => vMeasure(performance.now() - t0);
      speechSynthesis.speak(u);
    } catch(e){}
  }
  function voiceAt(t, mute, info){
    if (!hasVoice || mtS.voice === 'uit' || mute || info.level === 'x') return;
    if (mtS.voice === 'af' && !info.countIn) return;
    if (60 / info.bpm < .3 && info.beat > 0) return;          // te snel om elk woord uit te spreken: alleen tel 1
    const w = (NUMS[vLang] || NUMS.nl)[info.beat] || String(info.beat + 1), bpm = info.bpm;
    const ms = (t - Engine.now()) * 1000 - vLeadMs();
    setTimeout(() => { if (run && !run.paused) say(w, bpm); }, Math.max(0, ms));
  }

  function begin(fresh){
    Engine.ensure();
    if (fresh || !meet) meetReset();
    if (fresh || !run) run = { bar0:0, lastBar:-1, start:curBase(), shift:0, reached:false };
    run.paused = false;
    const bar0 = run.bar0;
    const flow = mtS.ramp === 'flow' && flowTotal() > 0;
    const L0 = flow ? segLayout((segAt(bar0) || {}).seg) : { pattern:pattern().slice(), sub:+mtS.sub };
    const startBpm = flow ? (flowBpm(bar0, 0, L0.pattern.length) || mtS.bpm) : mtS.ramp === 'auto' ? rampBpm(bar0) : (run.cur || mtS.bpm);
    const ahead = mtS.voice !== 'uit' && hasVoice ? vAhead() : .12;
    if (mtS.voice !== 'uit' && hasVoice) say('.', 120, 0);     // spraak opwarmen (stil) en meteen een meting
    Engine.metronome.start({
      bpm: startBpm, sub: L0.sub, pattern: L0.pattern, swing: +mtS.sub === 2 ? mtS.swing / 100 : 0,
      tempo: flow ? ((bar, beat, beats) => flowBpm(bar0 + bar, beat, beats)) : mtS.ramp === 'auto' ? (bar => rampBpm(bar0 + bar)) : null,
      layout: flow ? (bar => { const x = segAt(bar0 + bar); return x ? segLayout(x.seg) : null; }) : null,
      mute: (mtS.test === 'uit' && !flow) ? null : ((bar, beat) => (flow && !segAt(bar0 + bar)) || muteAt(bar0 + bar, beat)),
      countIn: +mtS.ci || 0, ahead,
      onSchedule: (t, mute, info) => { voiceAt(t, mute, info); meetExpect(t, mute, info); },
      onBeat: (i, t, mute, info) => beatUI(bar0 + info.bar, info, mute)
    });
    if (mtS.showTime && !tm.since && !tm.done) timerToggle(true);
    showRun();
  }
  function stopRun(keep){
    Engine.metronome.stop();
    if (hasVoice) try { speechSynthesis.cancel(); } catch(e){}
    if (keep && run){ run.paused = true; run.bar0 = run.lastBar + 1; }
    else run = null;
    clearLights(); slSave(); showRun(); if (mtS.meet) meetShow(true);
  }
  const playing = () => Engine.metronome.running() && run && !run.paused;
  function toggle(){ if (playing()) stopRun(false); else begin(true); }
  function pauseToggle(){ if (playing()) stopRun(true); else if (run && run.paused) begin(false); }
  function restartIfPlaying(){ if (playing()) begin(true); }

  /* --- tempo wijzigen (knoppen, pijltjes, intikken) --- */
  function setTempo(b){
    b = clamp(Math.round(b), MIN, MAX);
    if (mtS.ramp === 'flow'){                              // in het verloop: alles naar verhouding sneller/langzamer
      const cur = curTempo() || b;
      mtS.flowPct = clamp(Math.round(mtS.flowPct * b / cur), 25, 200); save();
      $m('mtFlowPct').value = mtS.flowPct;
      if (playing()){ const nb = flowBpm(run.lastBar + 1, 0, 4); if (nb) Engine.metronome.setBpm(nb); }
      showTempo(curTempo()); return;
    }
    if (mtS.ramp === 'auto' && run && playing()){
      const cur = Engine.metronome.bpm() || b; run.shift += b - cur;
      const nb = rampBpm(run.lastBar + 1); if (nb) Engine.metronome.setBpm(nb);
    } else {
      mtS.bpm = b; save();
      if (run){ run.cur = b; run.start = b; }
      if (playing()) Engine.metronome.setBpm(b);
    }
    showTempo(mtS.ramp === 'auto' && playing() ? Engine.metronome.bpm() : mtS.bpm);
  }
  const curTempo = () => (playing() ? Engine.metronome.bpm() : mtS.ramp === 'flow' ? (flowBpm(0, 0, 4) || mtS.bpm) : mtS.bpm);
  function nudge(d){
    if (mtS.ramp === 'flow'){ mtS.flowPct = clamp(mtS.flowPct + d, 25, 200); save(); $m('mtFlowPct').value = mtS.flowPct; showTempo(curTempo()); return; }
    setTempo(curTempo() + d);
  }

  /* --- meetikken (16-11-2026): tik mee met de spatiebalk; de app meet hoe strak je bent, met klik en vooral in de stilte ---
     Elke tel wordt verwacht (rtExpect uit ritmetrainer.js, met dezelfde kalibratie als Tikken), tag 'k' = klik hoorbaar, 's' = stil.
     Bij stille tellen onthouden we hoe lang het al stil is (since, s): zo zie je of je afdrijft naarmate de stilte langer duurt. */
  let meet = null, meetLastSum = 0;
  function meetReset(){ meet = { T:rtTapNew(), lastClick:null }; meetShow(); }
  function meetExpect(t, mute, info){
    if (!meet || info.countIn) return;
    const audible = !mute && info.level !== 'x';
    if (mtS.meet){
      rtExpect(meet.T, t, audible ? 'k' : 's', 60 / info.bpm / 2);
      if (!audible) meet.T.ex[meet.T.ex.length - 1].since = meet.lastClick == null ? 0 : t - meet.lastClick;
    }
    if (audible) meet.lastClick = t;
  }
  function meetTap(){
    const btn = $m('mtTap'); btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 90);
    if (!meet) return;
    const e = rtTap(meet.T), live = $m('mtMeetLive');
    live.textContent = e ? (e.tag === 's' ? 'stil: ' : '') + (Math.abs(e.off) <= 5 ? 'precies!' : rtMs(e.off)) : 'extra tik';
    live.className = 'taplive ' + (e ? (Math.abs(e.off) <= 30 ? 'tg' : Math.abs(e.off) <= 60 ? 'tk' : 'to') : 'tb');
    const now = performance.now(); if (now - meetLastSum > 400){ meetLastSum = now; meetShow(); }
  }
  function meetShow(final){
    const box = $m('mtMeetBox'); if (!box) return;
    box.hidden = !mtS.meet;
    if (!mtS.meet) return;
    if (!meet || !meet.T.ex.length){ $m('mtMeetSum').innerHTML = '<span class="muted">Start de metronoom en tik elke tel mee met de spatiebalk (ook in de stille maten).</span>'; return; }
    const now = Engine.now ? rtNowHeard() - .25 : 0, due = meet.T.ex.filter(e => final || e.t < now);
    const k = rtSum(due.filter(e => e.tag === 'k')), s = rtSum(due.filter(e => e.tag === 's'));
    const line = (lbl, x) => x.n ? `<span><b>${lbl}</b>: ${Math.round(x.pct)}% raak · gemiddeld ${rtMs(x.mean)} ${Math.abs(x.mean) <= 8 ? '' : x.mean > 0 ? '(sleept)' : '(jaagt)'} · spreiding ±${Math.round(x.spread)} ms</span>` : '';
    // drift: gemiddelde afwijking naarmate de stilte langer duurt
    const B = [[0, 2, '0–2 s'], [2, 4, '2–4 s'], [4, 8, '4–8 s'], [8, 999, '> 8 s']];
    const drift = B.map(([a, b, l]) => { const x = rtSum(due.filter(e => e.tag === 's' && e.since >= a && e.since < b)); return x.hit ? `${l}: ${rtMs(x.mean)}` : ''; }).filter(Boolean);
    $m('mtMeetSum').innerHTML = line('Met klik', k) + line('In de stilte', s) +
      (drift.length > 1 ? `<span><b>Afdrijven in de stilte</b> (na … stilte): ${drift.join(' · ')}</span>` : '') +
      `<span>extra tikken <b>${meet.T.extra}</b></span>` + (!s.n && mtS.test === 'uit' ? '<span class="muted">Zet Timing testen aan (bijv. stille maten) om je tempo zonder klik te meten.</span>' : '');
  }

  let taps = [];
  function tapTempo(){
    const now = performance.now();
    const btn = $m('mtTap'); btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 90);
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now); if (taps.length > 6) taps.shift();
    if (taps.length < 2){ $m('mtStatus').textContent = 'Tik nog een paar keer in het tempo…'; return; }
    const iv = []; for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
    const bpm = 60000 / (iv.reduce((a, b) => a + b, 0) / iv.length);
    if (mtS.ramp === 'auto' && playing()){ mtS.bpm = clamp(Math.round(bpm), MIN, MAX); save(); begin(true); }
    else if (mtS.ramp === 'flow'){ const seg = flowSegs()[0]; if (seg){ mtS.flowPct = clamp(Math.round(bpm / seg.a * 100), 25, 200); save(); $m('mtFlowPct').value = mtS.flowPct; showTempo(curTempo()); } }
    else setTempo(bpm);
    $m('mtStatus').textContent = `Ingetikt: ${clamp(Math.round(bpm), MIN, MAX)} bpm (${taps.length} tikken)`;
  }

  /* --- weergave --- */
  const term = b => TERMS.find(x => b < x[0])[1];
  function showTempo(b){
    $m('mtBpmVal').textContent = b; $m('mtTerm').textContent = term(b);
    $m('mtBpm').value = clamp(b, MIN, MAX);
    if (mtS.ramp === 'auto'){
      const start = run ? run.start + run.shift : mtS.bpm, goal = mtS.to;
      const pct = goal === start ? 100 : clamp((b - start) / (goal - start) * 100, 0, 100);
      $m('mtProgBar').style.width = pct + '%';
      $m('mtProgTxt').textContent = `${start} → ${goal} bpm`;
    }
    if (mtS.ramp === 'flow') $m('mtFlowInfo').textContent = `${flowSegs().length} ${flowSegs().length === 1 ? 'deel' : 'delen'} · ${flowTotal()} maten · op ${mtS.flowPct}%${mtS.flowLoop ? ' · herhalen' : ''}`;
  }
  let shownPat = '';
  function drawBeats(other){
    const own = !other, p = own ? pattern() : other, box = $m('mtBeats');
    let st = starts();
    if (!own){ st = new Set(); p.forEach((l, i) => { if (i && (l === 'a' || l === 'b') && p.some(x => x === 'z')) st.add(i); }); }
    shownPat = p.join('');
    box.classList.toggle('ro', !own);
    box.innerHTML = p.map((l, i) => `<button class="mtb lv-${l}${st.has(i) && i ? ' gstart' : ''}" data-i="${i}" title="Tel ${i + 1}: ${LVNAME[l]}${own ? ' (klik om te wisselen)' : ''}"><span>${i + 1}</span></button>`).join('');
    if (!own) return;
    box.querySelectorAll('.mtb').forEach(b => b.onclick = () => {
      const i = +b.dataset.i, p2 = pattern();
      p2[i] = LV[(LV.indexOf(p2[i]) + 1) % LV.length]; save(); drawBeats();
      if (playing()) Engine.metronome.set({ pattern:p2.slice() });
    });
  }
  function clearLights(){ document.querySelectorAll('#mtBeats .mtb').forEach(b => b.classList.remove('hit', 'mute')); }
  function beatUI(abs, info, mute){
    if (!run || run.paused || view !== 'metronoom') return;
    const flow = mtS.ramp === 'flow';
    if (flow && !info.countIn && !segAt(abs)){ stopRun(false); $m('mtStatus').textContent = '🏁 Einde van het tempoverloop.'; return; }
    if (info.pattern && info.pattern.join('') !== shownPat) drawBeats(info.pattern.join('') === pattern().join('') ? null : info.pattern);
    const bs = document.querySelectorAll('#mtBeats .mtb');
    bs.forEach(b => b.classList.remove('hit', 'mute'));
    const b = bs[info.beat];
    if (info.countIn){
      if (b) b.classList.add('hit');
      $m('mtBar').innerHTML = `<b>${info.beats - info.beat}</b><span>aftellen</span>`;
      $m('mtStatus').textContent = 'Aftellen… begin op de volgende tel 1.';
      showTempo(info.bpm); return;
    }
    run.lastBar = abs; run.cur = info.bpm;
    if (mtS.meet && info.beat === 0) meetShow();
    if (b){ b.classList.add(mute ? 'mute' : 'hit'); }
    showTempo(info.bpm);
    const it = slCur();
    if (it){ if (info.bpm > (it.best || 0)) it.best = info.bpm; it.last = today(); }
    if (flow && !mtS.len){
      const x = segAt(abs), tot = flowTotal();
      $m('mtBar').innerHTML = `<b>${x.k + 1 + flowSegs().slice(0, x.i).reduce((t, y) => t + y.n, 0)}</b><span>van ${tot}${abs >= tot ? ' · ronde ' + (Math.floor(abs / tot) + 1) : ''}</span>`;
    } else if (mtS.len > 0){
      $m('mtBar').innerHTML = `<b>${abs % mtS.len + 1}</b><span>van ${mtS.len} · ronde ${Math.floor(abs / mtS.len) + 1}</span>`;
    } else $m('mtBar').innerHTML = `<b>${abs + 1}</b><span>maat</span>`;
    let s = '';
    if (mute && mtS.test !== 'rand') s = '🤫 stil: tel zelf door';
    if (mtS.test === 'dun') s += (s ? ' · ' : '') + DUN[dunStage(abs)];
    if (flow){ const x = segAt(abs); if (x) s += (s ? ' · ' : '') + `deel ${x.i + 1} van ${flowSegs().length} · ${segTag(x.seg)}${x.seg.a !== x.seg.b ? ` (${x.seg.a} → ${x.seg.b})` : ''}`; }
    if (mtS.ramp === 'auto'){
      if (info.bpm === mtS.to){ run.reached = true; s += (s ? ' · ' : '') + '🎯 doeltempo bereikt'; }
      else { const ev = Math.max(1, mtS.every), left = ev - (abs % ev); s += (s ? ' · ' : '') + `volgende stap over ${left} ${left === 1 ? 'maat' : 'maten'}`; }
    }
    $m('mtStatus').textContent = s || '\u00a0';
  }
  function gelukt(){
    const it = slCur(), t = curTempo();
    if (it && t > (it.ok || 0)){ it.ok = t; slSave(); slDraw(); }
    nudge(mtS.step); keepHand();
  }
  // bij de andere standen: "dit tempo ging schoon" vastleggen (voor het slimme voorstel)
  function schoon(){
    const it = slCur(), t = curTempo();
    if (!it){ $m('mtStatus').textContent = 'Laad of bewaar eerst een stuk in de setlist, dan kan ik je schone tempo onthouden.'; return; }
    if (t > (it.ok || 0)){ it.ok = t; slSave(); slDraw(); $m('mtStatus').textContent = `✓ Schoon tempo ${t} bewaard voor ${it.stuk}.`; }
    else $m('mtStatus').textContent = `✓ Genoteerd. Je schone tempo voor ${it.stuk} stond al op ${it.ok}.`;
  }
  // handmatig per ronde: het nieuwe tempo meteen in het geladen stuk bewaren, dan ga je de volgende keer verder waar je was
  function keepHand(){ const it = slCur(); if (it && mtS.ramp === 'hand' && it.s.ramp === 'hand'){ it.s.bpm = curTempo(); slSave(); slDraw(); } }

  /* --- oefentimer: aftellen vanaf tmin minuten, of stopwatch bij 0; loopt los van de metronoom --- */
  const tm = { acc:0, since:null, done:false };
  const tSecs = () => tm.acc + (tm.since ? (performance.now() - tm.since) / 1000 : 0);
  const mmss = x => { x = Math.max(0, Math.round(x)); return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
  function timerToggle(on){
    if (on == null) on = !tm.since;
    if (on && !tm.since){ if (tm.done) timerReset(); tm.since = performance.now(); }
    else if (!on && tm.since){ const add = (performance.now() - tm.since) / 1000; tm.acc += add; tm.since = null; slAddTime(add); }
    timerShow();
  }
  function timerReset(){ if (tm.since) timerToggle(false); tm.acc = 0; tm.done = false; timerShow(); }
  function timerShow(){
    const lim = mtS.tmin * 60, el = $m('mtTime');
    el.textContent = lim ? mmss(lim - tSecs()) : mmss(tSecs());
    el.classList.toggle('done', tm.done);
    $m('mtTimerBtn').textContent = tm.since ? '⏸' : '▶';
    $m('mtTimerLbl').textContent = lim ? `oefentimer · ${mtS.tmin} min` : 'stopwatch';
  }
  let tmSaved = 0;
  setInterval(() => {
    if (!tm.since) return;
    const lim = mtS.tmin * 60;
    if (lim && tSecs() >= lim && !tm.done){
      timerToggle(false); tm.done = true;
      if (playing()) stopRun(true);
      try { const t = Engine.ensure().currentTime + .05; [0, .22, .44].forEach((d, i) => Engine.note(t + d, [79, 84, 88][i], .5, { inst:'marimba', vol:.5 })); } catch(e){}
      $m('mtStatus').textContent = `⏰ ${mtS.tmin} ${mtS.tmin === 1 ? 'minuut' : 'minuten'} om!` + (slNextIdx() >= 0 ? ' Klaar voor de volgende in de setlist?' : '');
    }
    if (performance.now() - tmSaved > 30000){ tmSaved = performance.now(); const add = (performance.now() - tm.since) / 1000; tm.acc += add; tm.since = performance.now(); slAddTime(add); }
    timerShow();
  }, 250);

  /* --- setlist: opgeslagen instellingen per stuk/passage --- */
  const SL_KEY = 'metronoom-setlist';
  let SL = { items:[], cur:null };
  try { const x = JSON.parse(localStorage.getItem(SL_KEY)); if (x && Array.isArray(x.items)) SL = x; } catch(e){}
  const today = () => new Date().toLocaleDateString('sv');
  if (SL.smart === undefined) SL.smart = true;
  SL.items.forEach(x => { if (!x.made) x.made = x.last || today(); });
  const days = d => d ? Math.round((new Date(today()) - new Date(d)) / 864e5) : null;
  const fmtD = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${+dd}-${+m}` + (y !== today().slice(0, 4) ? '-' + y.slice(2) : ''); };
  const ago = d => { const n = days(d); return n === 0 ? 'vandaag' : n === 1 ? 'gisteren' : n + ' dagen geleden'; };
  function slSave(){ try { localStorage.setItem(SL_KEY, JSON.stringify(SL)); } catch(e){} }
  const slCur = () => SL.items.find(x => x.id === SL.cur) || null;
  const slIdx = () => SL.items.findIndex(x => x.id === SL.cur);
  const slNextIdx = () => { const i = slIdx(); return i >= 0 && i + 1 < SL.items.length ? i + 1 : -1; };
  function slAddTime(sec){ const it = slCur(); if (it && sec > 0){ it.secs = (it.secs || 0) + sec; slSave(); slDraw(); } }
  const snap = () => { const o = {}; SNAP.forEach(k => { o[k] = mtS[k] && typeof mtS[k] === 'object' ? JSON.parse(JSON.stringify(mtS[k])) : mtS[k]; }); return o; };
  const esc = t => String(t || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  function describe(o){
    const m = METERS[o.meter] && METERS[o.meter][1] !== null ? METERS[o.meter][0].replace(/ \(.*\)$/, '') : o.groups;
    if (o.ramp === 'flow' && Array.isArray(o.flow)){
      const n = o.flow.reduce((t, x) => t + (x.n || 0), 0);
      return `tempoverloop · ${o.flow.length} ${o.flow.length === 1 ? 'deel' : 'delen'}, ${n} maten${o.flowPct && o.flowPct !== 100 ? ' · op ' + o.flowPct + '%' : ''}` + (o.tmin ? ` · ⏱ ${o.tmin} min` : '');
    }
    let t = `${m} · ${o.bpm}${o.ramp === 'auto' ? ' → ' + o.to : ''} bpm`;
    if (o.ramp === 'hand') t += ' · per ronde ±' + o.step;
    if (o.test !== 'uit') t += ' · ' + { gap:'stille maten', dun:'uitdunnen', rand:'tellen weg' }[o.test];
    if (o.len) t += ` · ${o.len} maten`;
    if (o.tmin) t += ` · ⏱ ${o.tmin} min`;
    return t;
  }
  const dur = sec => { const m = Math.round((sec || 0) / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'u ' + (m % 60) + 'm'; };
  function slDraw(){
    const box = $m('mtList');
    if (!SL.items.length){ box.innerHTML = '<p class="muted mtempty">Nog leeg. Stel de metronoom in voor een stuk of passage, vul hieronder de naam in en klik op <b>Opslaan als nieuw</b>.</p>'; }
    else box.innerHTML = SL.items.map((x, i) => {
      const st = [x.best ? 'hoogst ' + x.best : '', x.ok ? 'schoon ' + x.ok : '', x.secs >= 60 ? dur(x.secs) + ' geoefend' : '', x.last ? 'geoefend ' + fmtD(x.last) : ''].filter(Boolean).join(' · ');
      const dt = ['gemaakt ' + fmtD(x.made), x.upd ? 'bijgewerkt ' + fmtD(x.upd) : ''].filter(Boolean).join(' · ');
      return `<div class="mtrow${x.id === SL.cur ? ' on' : ''}" data-id="${x.id}">
        <span class="mtnum">${i + 1}</span>
        <button class="mtload" title="Laden"><span><b>${esc(x.stuk)}</b>${x.deel ? ' · ' + esc(x.deel) : ''}</span><small>${describe(x.s)}</small></button>
        <span class="mtstat">${st}<small>${dt}</small></span>
        <span class="mtrbtn"><button data-act="up" title="Omhoog">↑</button><button data-act="down" title="Omlaag">↓</button><button data-act="del" title="Verwijderen">✕</button></span>
      </div>`;
    }).join('');
    box.querySelectorAll('.mtrow').forEach(r => {
      const id = r.dataset.id;
      r.querySelector('.mtload').onclick = () => slLoad(id);
      r.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const i = SL.items.findIndex(x => x.id === id), a = b.dataset.act;
        if (a === 'up' && i > 0) SL.items.splice(i - 1, 0, SL.items.splice(i, 1)[0]);
        else if (a === 'down' && i < SL.items.length - 1) SL.items.splice(i + 1, 0, SL.items.splice(i, 1)[0]);
        else if (a === 'del'){
          if (!b.classList.contains('sure')){ b.classList.add('sure'); b.textContent = 'Zeker?'; setTimeout(() => { b.classList.remove('sure'); b.textContent = '✕'; }, 3000); return; }
          SL.items.splice(i, 1); if (SL.cur === id){ SL.cur = null; }
        }
        slSave(); slDraw();
      });
    });
    const cur = slCur();
    $m('mtNow').innerHTML = cur ? `🎼 <b>${esc(cur.stuk)}</b>${cur.deel ? ' · ' + esc(cur.deel) : ''}` : '';
    $m('mtSaveCur').disabled = !cur;
    $m('mtNextItem').disabled = slNextIdx() < 0;
    $m('mtSmart').checked = !!SL.smart;
    drawToday();
  }

  /* --- slim voorstel: wat vandaag, en op welk tempo beginnen --- */
  function prio(x){
    const d = days(x.last), goal = x.s && (x.s.ramp === 'auto' || x.s.ramp === 'hand') ? x.s.to : 0;
    const cur = x.ok || x.best || (x.s && x.s.bpm) || 0;
    const gap = goal && cur < goal ? (goal - cur) / goal : 0;
    let sc = (d == null ? 1 : Math.min(d, 14) / 14) * .6 + Math.min(1, gap * 3) * .4;
    const why = [];
    if (d == null) why.push('nog niet geoefend');
    else if (d === 0){ sc *= .2; why.push('vandaag al gedaan'); }
    else why.push(d === 1 ? 'gisteren geoefend' : d + ' dagen niet geoefend');
    if (goal) why.push(cur >= goal ? 'doel ' + goal + ' gehaald 🎯' : `nog ${goal - cur} bpm tot ${goal}`);
    return { x, sc, why:why.join(' · ') };
  }
  function drawToday(){
    const box = $m('mtToday');
    if (!SL.smart || SL.items.length < 2){ box.innerHTML = ''; box.style.display = 'none'; return; }
    const top = SL.items.map(prio).sort((a, b) => b.sc - a.sc).slice(0, 3);
    box.style.display = '';
    box.innerHTML = '<div class="mttodayh">💡 Voorstel voor vandaag</div>' + top.map((p, i) =>
      `<button class="mttip" data-id="${p.x.id}"><span><b>${i + 1}. ${esc(p.x.stuk)}</b>${p.x.deel ? ' · ' + esc(p.x.deel) : ''}</span><small>${p.why}</small></button>`).join('');
    box.querySelectorAll('.mttip').forEach(b => b.onclick = () => slLoad(b.dataset.id));
  }
  // starttempo-advies: na een dag rust zak je meestal iets terug; begin onder je schone tempo en bouw op
  function suggestStart(it){
    if (!SL.smart || !it.ok || !it.last) return '';
    const d = days(it.last); if (d < 1) return '';
    const f = d >= 7 ? .85 : .92, sug = clamp(Math.round(it.ok * f), MIN, MAX);
    if (it.s.ramp === 'auto'){
      const st = clamp(Math.max(it.s.bpm, Math.round(it.ok * .85)), MIN, it.s.to || MAX);
      if (st === mtS.bpm) return '';
      mtS.bpm = st; save();
      return ` 💡 Start op ${st} bpm: je speelde hem al schoon op ${it.ok}, dus het opbouwen begint hoger.`;
    }
    if (it.s.ramp === 'flow' || sug >= mtS.bpm) return '';
    mtS.bpm = sug; save();
    return ` 💡 Start op ${sug} bpm (${Math.round(f * 100)}% van je schone ${it.ok}, ${ago(it.last)}) en bouw op.`;
  }
  function slLoad(id){
    const it = SL.items.find(x => x.id === id); if (!it) return;
    if (tm.since) timerToggle(false);
    stopRun(false);
    SL.cur = id; Object.assign(mtS, it.s); if (Array.isArray(it.s.pattern)) mtS.pattern = it.s.pattern.slice();
    save(); slSave(); fill(); drawBeats(); showOpts(); timerReset();
    $m('mtPiece').value = it.stuk || ''; $m('mtPassage').value = it.deel || '';
    $m('mtBar').innerHTML = '<b>–</b><span>maat</span>';
    slDraw(); showRun();
    const tip = suggestStart(it);
    showRun();
    $m('mtStatus').textContent = `Geladen: ${it.stuk}${it.deel ? ' · ' + it.deel : ''}. ${Keys.label('metronoom')} = start.` + tip;
  }
  function slNew(){
    const stuk = $m('mtPiece').value.trim(), deel = $m('mtPassage').value.trim();
    if (!stuk){ $m('mtPiece').focus(); $m('mtStatus').textContent = 'Vul eerst de naam van het stuk in.'; return; }
    const it = { id:'s' + Date.now().toString(36), stuk, deel, s:snap(), best:0, ok:0, secs:0, last:'', made:today(), upd:'' };
    SL.items.push(it); SL.cur = it.id; slSave(); slDraw();
    $m('mtStatus').textContent = `Opgeslagen in de setlist: ${stuk}${deel ? ' · ' + deel : ''}.`;
  }
  function slUpdate(){
    const it = slCur(); if (!it) return;
    it.stuk = $m('mtPiece').value.trim() || it.stuk; it.deel = $m('mtPassage').value.trim(); it.s = snap(); it.upd = today();
    slSave(); slDraw();
    $m('mtStatus').textContent = `Bijgewerkt: ${it.stuk}${it.deel ? ' · ' + it.deel : ''}.`;
  }
  function slNext(){ const i = slNextIdx(); if (i >= 0) slLoad(SL.items[i].id); }

  function showRun(){
    const p = playing(), pz = run && run.paused;
    $m('mtPlay').textContent = p ? '■ Stop' : pz ? '▶ Opnieuw' : '▶ Start';
    $m('mtPlay').classList.toggle('primary', !p);
    $m('mtPause').disabled = !p && !pz;
    $m('mtPause').textContent = pz ? '▶ Verder' : '⏸ Pauze';
    if (!p && !pz) $m('mtBar').innerHTML = '<b>–</b><span>maat</span>';
    if (!p) $m('mtStatus').textContent = pz ? `Gepauzeerd na maat ${run.lastBar + 1}. ${Keys.label('pauze')} = verder.` : `Klaar. ${Keys.label('metronoom')} = start, ${Keys.label('tik')} = ${mtS.meet ? 'meetikken (tijdens het spelen)' : 'tempo intikken'}.`;
    showTempo(p ? curTempo() : (pz && run.cur) || mtS.bpm);
  }
  function showOpts(){
    const v = $m('metroView');
    v.dataset.ramp = mtS.ramp; v.dataset.test = mtS.test;
    v.classList.toggle('swing', +mtS.sub === 2);
    v.classList.toggle('eigen', METERS[mtS.meter] && METERS[mtS.meter][1] === null);
    v.classList.toggle('nobar', !mtS.showBar); v.classList.toggle('notime', !mtS.showTime);
    $m('mtSwingVal').textContent = mtS.swing <= 50 ? 'recht' : mtS.swing + '%';
    v.classList.toggle('novoice', !hasVoice);
    $m('mtUp').textContent = `✓ Gelukt  +${mtS.step}`;
    $m('mtDown').textContent = `✗ Te snel  −${mtS.step}`;
  }

  /* --- tempoverloop-editor --- */
  function flowDraw(){
    const opts = sel => `<option value="-1"${sel < 0 ? ' selected' : ''}>maat zoals boven</option>` +
      METERS.map((m, i) => m[1] === null ? '' : `<option value="${i}"${i === sel ? ' selected' : ''}>${m[0]}</option>`).join('');
    $m('mtFlow').innerHTML = mtS.flow.map((x, i) => `<div class="mtfrow" data-i="${i}">
        <span class="mtnum">${i + 1}</span>
        <div class="mtf1"><label><input type="number" data-k="n" min="1" max="999" value="${x.n}"> maten</label>
          <select data-k="m">${opts(x.m)}</select></div>
        <div class="mtf2"><input type="number" data-k="a" min="${MIN}" max="${MAX}" value="${x.a}"> → <input type="number" data-k="b" min="${MIN}" max="${MAX}" value="${x.b}"> bpm
          <span class="mttag">${segTag(x)}</span>
          <button data-del title="Deel weghalen"${mtS.flow.length < 2 ? ' disabled' : ''}>✕</button></div></div>`).join('');
    $m('mtFlow').querySelectorAll('.mtfrow').forEach(r => {
      const i = +r.dataset.i;
      r.querySelectorAll('[data-k]').forEach(el => el.onchange = () => {
        const k = el.dataset.k, lim = k === 'n' ? [1, 999] : k === 'm' ? [-1, METERS.length - 2] : [MIN, MAX];
        mtS.flow[i][k] = clamp(Math.round(+el.value) || (k === 'm' ? -1 : k === 'n' ? 1 : 80), lim[0], lim[1]);
        save(); flowDraw(); showTempo(curTempo()); restartIfPlaying();
      });
      r.querySelector('[data-del]').onclick = () => { if (mtS.flow.length > 1){ mtS.flow.splice(i, 1); save(); flowDraw(); restartIfPlaying(); } };
    });
  }
  function flowPreset(kind){
    const b = mtS.bpm;
    mtS.flow = kind === 'rit' ? [{ n:7, m:-1, a:b, b:b }, { n:1, m:-1, a:b, b:Math.max(MIN, Math.round(b * .7)) }]
             : kind === 'acc' ? [{ n:8, m:-1, a:Math.max(MIN, Math.round(b * .75)), b:b }]
             : [{ n:4, m:2, a:b, b:b }, { n:2, m:1, a:b, b:b }, { n:4, m:2, a:b, b:Math.max(MIN, Math.round(b * .8)) }];
    mtS.flowPct = 100; save(); fill(); showTempo(curTempo()); restartIfPlaying();
  }

  /* --- bedrading --- */
  function fill(){
    $m('mtMeter').innerHTML = METERS.map((m, i) => `<option value="${i}">${m[0]}</option>`).join('');
    $m('mtSub').innerHTML = SUBS.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('');
    $m('mtMeter').value = mtS.meter; $m('mtGroups').value = mtS.groups; $m('mtSub').value = mtS.sub;
    $m('mtSwing').value = mtS.swing; $m('mtRamp').value = mtS.ramp; $m('mtTo').value = mtS.to;
    $m('mtStep').value = mtS.step; $m('mtEvery').value = mtS.every; $m('mtBack').checked = !!mtS.back;
    $m('mtTest').value = mtS.test; $m('mtOn').value = mtS.on; $m('mtOff').value = mtS.off;
    $m('mtDun').value = mtS.dun; $m('mtPct').value = mtS.pct;
    $m('mtShowBar').checked = mtS.showBar !== false; $m('mtShowTime').checked = mtS.showTime !== false;
    $m('mtCi').value = mtS.ci; $m('mtLen').value = mtS.len; $m('mtTmin').value = mtS.tmin;
    $m('mtFlowLoop').checked = !!mtS.flowLoop; $m('mtFlowPct').value = mtS.flowPct;
    $m('mtVoice').value = mtS.voice; $m('mtVLead').value = mtS.vLead;
    flowDraw();
  }
  const num = (id, key, a, b, after) => $m(id).addEventListener('change', e => {
    const r = Math.round(+e.target.value), v = clamp(e.target.value === '' || isNaN(r) ? D[key] : r, a, b); e.target.value = v; mtS[key] = v; save(); showOpts(); if (after) after();
  });

  fill(); pattern(); drawBeats(); showOpts(); showRun(); timerShow(); slDraw();
  if (slCur()){ $m('mtPiece').value = slCur().stuk || ''; $m('mtPassage').value = slCur().deel || ''; }

  $m('mtPlay').onclick = e => { toggle(); e.target.blur(); };
  $m('mtPause').onclick = e => { pauseToggle(); e.target.blur(); };
  $m('mtTap').onclick = e => { if (mtS.meet && playing()) meetTap(); else tapTempo(); e.target.blur(); };
  $m('mtMeet').checked = mtS.meet;
  $m('mtMeet').onchange = e => { mtS.meet = e.target.checked; save(); meetShow(); e.target.blur(); };
  document.querySelectorAll('#metroView [data-d]').forEach(b => b.onclick = () => nudge(+b.dataset.d));
  $m('mtBpm').oninput = e => setTempo(+e.target.value);
  $m('mtUp').onclick = () => gelukt();
  $m('mtDown').onclick = () => { nudge(-mtS.step); keepHand(); };
  $m('mtMeter').onchange = e => {
    mtS.meter = +e.target.value; const m = METERS[mtS.meter];
    if (m[1] !== null){ mtS.groups = m[1]; mtS.sub = m[2]; $m('mtGroups').value = m[1]; $m('mtSub').value = m[2]; mtS.pattern = null; }
    save(); drawBeats(); showOpts(); restartIfPlaying(); e.target.blur();
  };
  $m('mtGroups').onchange = e => {
    const { n, groups } = parseGroups(e.target.value);
    mtS.groups = groups ? groups.join('+') : String(n); e.target.value = mtS.groups;
    mtS.meter = METERS.length - 1; $m('mtMeter').value = mtS.meter; mtS.pattern = null;
    save(); drawBeats(); showOpts(); restartIfPlaying();
  };
  $m('mtSub').onchange = e => { mtS.sub = +e.target.value; save(); showOpts(); restartIfPlaying(); e.target.blur(); };
  $m('mtSwing').oninput = e => { mtS.swing = +e.target.value; save(); showOpts(); if (playing()) Engine.metronome.set({ swing: mtS.swing / 100 }); };
  $m('mtResetPat').onclick = () => { mtS.pattern = null; save(); drawBeats(); if (playing()) Engine.metronome.set({ pattern:pattern().slice() }); };
  $m('mtRamp').onchange = e => { mtS.ramp = e.target.value; save(); showOpts(); restartIfPlaying(); showTempo(curTempo()); e.target.blur(); };
  num('mtTo', 'to', MIN, MAX, () => showTempo(curTempo()));
  num('mtStep', 'step', 1, 40);
  num('mtEvery', 'every', 1, 64);
  $m('mtBack').onchange = e => { mtS.back = e.target.checked; save(); };
  $m('mtTest').onchange = e => { mtS.test = e.target.value; save(); showOpts(); restartIfPlaying(); e.target.blur(); };
  $m('mtShowBar').onchange = e => { mtS.showBar = e.target.checked; save(); showOpts(); };
  $m('mtShowTime').onchange = e => { mtS.showTime = e.target.checked; save(); if (!mtS.showTime && tm.since) timerToggle(false); showOpts(); };
  $m('mtCi').onchange = e => { mtS.ci = +e.target.value; save(); e.target.blur(); };
  num('mtLen', 'len', 0, 999);
  num('mtTmin', 'tmin', 0, 120, () => { if (!tm.since) timerReset(); else timerShow(); });
  $m('mtTimerBtn').onclick = e => { timerToggle(); e.target.blur(); };
  $m('mtTimerReset').onclick = e => { timerReset(); e.target.blur(); };
  $m('mtSaveNew').onclick = slNew;
  $m('mtOk').onclick = e => { schoon(); e.target.blur(); };
  $m('mtSmart').onchange = e => { SL.smart = e.target.checked; slSave(); drawToday(); };
  $m('mtFlowAdd').onclick = () => { const l = mtS.flow[mtS.flow.length - 1] || { n:4, m:-1, a:mtS.bpm, b:mtS.bpm }; mtS.flow.push({ n:4, m:l.m, a:l.b, b:l.b }); save(); flowDraw(); showTempo(curTempo()); };
  $m('mtFlowRit').onclick = () => flowPreset('rit');
  $m('mtFlowAcc').onclick = () => flowPreset('acc');
  $m('mtFlowMix').onclick = () => flowPreset('mix');
  $m('mtFlowLoop').onchange = e => { mtS.flowLoop = e.target.checked; save(); showTempo(curTempo()); };
  num('mtFlowPct', 'flowPct', 25, 200, () => { showTempo(curTempo()); if (playing()){ const nb = flowBpm(run.lastBar + 1, 0, 4); if (nb) Engine.metronome.setBpm(nb); } });
  $m('mtVoice').onchange = e => {
    mtS.voice = e.target.value; save(); e.target.blur();
    if (mtS.voice !== 'uit' && hasVoice){ pickVoice(); say(vLang === 'nl' ? 'één, twee' : 'one, two', 90); }
    restartIfPlaying();
  };
  num('mtVLead', 'vLead', -300, 500, () => restartIfPlaying());
  vInfo();
  $m('mtSaveCur').onclick = slUpdate;
  $m('mtNextItem').onclick = e => { slNext(); e.target.blur(); };
  num('mtOn', 'on', 1, 32); num('mtOff', 'off', 1, 32); num('mtDun', 'dun', 1, 16); num('mtPct', 'pct', 5, 90);

  document.addEventListener('keyup', e => { if (view === 'metronoom' && Keys.is(e, 'tik') && !Keys.blocked(e)) e.preventDefault(); });
  document.addEventListener('keydown', e => {
    if (view !== 'metronoom') return;
    if (Keys.is(e, 'stop')){ stopRun(false); return; }
    if (Keys.blocked(e)) return;
    if (Keys.is(e, 'tik')){ e.preventDefault(); if (!e.repeat){ if (mtS.meet && playing()) meetTap(); else tapTempo(); } return; }
    if (Keys.is(e, 'metronoom')){ e.preventDefault(); toggle(); }
    else if (Keys.is(e, 'pauze')){ e.preventDefault(); pauseToggle(); }
    else if (Keys.is(e, 'sneller')){ e.preventDefault(); nudge(e.shiftKey ? 5 : 1); }
    else if (Keys.is(e, 'langzamer')){ e.preventDefault(); nudge(e.shiftKey ? -5 : -1); }
    else if (Keys.is(e, 'volgende') && mtS.ramp === 'hand'){ e.preventDefault(); gelukt(); }
    else if (Keys.is(e, 'volgende')){ e.preventDefault(); schoon(); }
    else if (Keys.is(e, 'vorige') && mtS.ramp === 'hand'){ e.preventDefault(); nudge(-mtS.step); keepHand(); }
  });

  // de router stopt de metronoom bij elke wissel; hier de sessie vergeten en de knoppen bijwerken
  window.mtOnRoute = () => { if (view !== 'metronoom' && tm.since) timerToggle(false); run = null; taps = []; clearLights(); slSave(); showRun(); };
})();
