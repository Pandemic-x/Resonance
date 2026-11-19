/* ================= Drone → Degrees (prefix dt, bestand heet nog drone-trappen.js) =================
   Trappen herkennen boven een blijvende drone, op gevoel (zoals de Degrees-modus van Sonofield).
   Gebruikt de drone, grondtoon, kleuren en spelling van drone.js (drS, drColor, drDegLabel, drNameAt, drDroneOn …).
   Stand wisselen: subtabs #drSubs → drS.sub = 'vrij' | 'trap' (class 'trap' op #droneView).
   Score: eigen onderdeel 'dronetrap' (k = halve tonen boven de grondtoon 0–11), niveau = dtS.level + '|oct' bij wisselend octaaf.
   Opslag: 'dronetrap-settings'. Toetsen: luister = toon (nog eens / eerste), volgende = nieuwe toon, 1–7 = trap,
   Shift+cijfer = verlaagd (♭2 ♭3 ♯4 ♭6 ♭7); drone/pauze/stop doet drone.js. Antwoordtoetsen staan in Keys.RESERVED.drone. */

const DT_KEY = 'dronetrap-settings';
const DT_LEVELS = [
  { id:'l1', name:'1 · 3 · 5',                 set:[0,4,7] },
  { id:'l2', name:'1 t/m 5 (majeur)',          set:[0,2,4,5,7] },
  { id:'l3', name:'Majeur, alle 7',            set:[0,2,4,5,7,9,11] },
  { id:'l4', name:'Mineur, alle 7',            set:[0,2,3,5,7,8,10] },
  { id:'l5', name:'Majeur + mineur',           set:[0,2,3,4,5,7,8,9,10,11] },
  { id:'l6', name:'Chromatisch (alle 12)',     set:[0,1,2,3,4,5,6,7,8,9,10,11] },
  { id:'own', name:'Eigen keuze',              set:null }
];
// solmisatie (beweeglijke do, mineur als verlaagde trappen) + karakter tegen de grondtoon
const DT_FEEL = {
  0:  ['do', 'thuis: rust, stabiel, af'],
  1:  ['ra', 'duister en schurend, Spaans/Frygisch; wil zakken naar do'],
  2:  ['re', 'onaf, hangend; wil naar do (of naar mi)'],
  3:  ['me', 'donker, verdrietig: de mineurterts'],
  4:  ['mi', 'warm, licht, vrolijk: de majeurterts'],
  5:  ['fa', 'gespannen, wil zakken naar mi'],
  6:  ['fi', 'zwevend, magisch (Lydisch); trekt omhoog naar sol'],
  7:  ['sol', 'open, stevig, helder; een tweede thuis'],
  8:  ['le', 'zwaar en weemoedig; wil zakken naar sol'],
  9:  ['la', 'zacht, verlangend, een beetje melancholiek'],
  10: ['te', 'ontspannen-weemoedig, bluesy (mixolydisch)'],
  11: ['ti', 'scherp, onrustig; trekt omhoog naar do']
};
const DT_MAJ = [0,2,4,5,7,9,11];
const DT_DIGIT = { 1:0, 2:2, 3:4, 4:5, 5:7, 6:9, 7:11 };          // cijfer → trap (majeur/rein)
const DT_LOW   = { 2:1, 3:3, 6:8, 7:10 };                         // Shift+cijfer → verlaagd: ♭2 ♭3 ♭6 ♭7; T = tritonus (♯4)

let dtS = { level:'l1', own:[0,4,7], inst:'piano', oct:false, res:true, auto:false, keyRand:false, keyEvery:10, intro:3, timed:false, limit:4 };
try { Object.assign(dtS, JSON.parse(localStorage.getItem(DT_KEY)) || {}); } catch(e){}
if (!Array.isArray(dtS.own) || !dtS.own.length) dtS.own = [0,4,7];
let dtQ = null, dtTimers = [], dtStreak = 0, dtInKey = 0, dtIntro = false, dtIntroNew = false, dtWarm = false;
// dtInKey = vragen in deze toonsoort; dtWarm = wentijd voor deze toonsoort gehad; dtIntroNew = intro na een toonsoortwissel
const dtSave = () => { try { localStorage.setItem(DT_KEY, JSON.stringify(dtS)); } catch(e){} };
const dtLevel = () => DT_LEVELS.find(l => l.id === dtS.level) || DT_LEVELS[0];
function dtSet(){ const L = dtLevel(); return (L.set || dtS.own).slice().sort((a, b) => a - b); }
function dtCur(){ return dtQ && dtQ.answered ? { semi:dtQ.semi } : null; }      // voor de cirkel in drone.js
const dtClear = () => { dtTimers.forEach(clearTimeout); dtTimers = []; };

Score.def('dronetrap', {
  name:'Drone-degrees', view:'drone',
  label:k => 'trap ' + drDegLabel(+k) + ' (' + DT_FEEL[+k][0] + ')',
  level:() => dtS.level + '|' + (dtS.oct ? 'oct' : '') + '|' + (dtS.timed ? dtS.limit + 's' : ''),
  levelName:lv => { const p = lv.split('|'), L = DT_LEVELS.find(l => l.id === p[0]); return (L ? L.name : 'eigen keuze') + (p[1] ? ', wisselend octaaf' : '') + (p[2] ? ', binnen ' + p[2] : ''); },
  next:lv => { const p = lv.split('|'), i = DT_LEVELS.findIndex(l => l.id === p[0]);
    return !p[2] ? 'zet de tijdmodus aan' : i >= 0 && i < DT_LEVELS.length - 2 ? 'niveau ' + DT_LEVELS[i + 1].name : !p[1] ? 'zet wisselend octaaf aan' : 'een kortere tijdslimiet'; }
});

/* --- vraag kiezen: zwakke trappen vaker, niet twee keer hetzelfde --- */
function dtPick(){
  const set = dtSet(), t = Score.tally('dronetrap');
  const w = set.map(s => { const x = t[s]; const p = x && x.t >= 3 ? x.r / x.t : .5; return (s === (dtQ && dtQ.semi) && set.length > 1) ? 0 : 1 + 2 * (1 - p); });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < set.length; i++){ r -= w[i]; if (r <= 0) return set[i]; }
  return set[set.length - 1];
}
function dtMidi(semi, shift){ return 12 * (drS.oct + 2) + drS.pc + semi + (shift || 0); }   // een octaaf boven de drone
function dtNote(t, m, dur){ Engine.note(t, m, dur || 1.4, { inst:dtS.inst, vol:drNoteGain(.34) }); }

function dtNew(){
  dtClear();
  if (dtS.keyRand && dtInKey >= dtS.keyEvery) dtNewKey();
  if (!dtWarm && dtS.intro > 0){ dtStartIntro(); return; }        // wentijd: alleen de drone, nog geen vraagtoon
  dtWarm = true;
  dtInKey++; Score.ask('dronetrap');
  const semi = dtPick(), shift = dtS.oct ? [-12, 0, 0, 12][Math.floor(Math.random() * 4)] : 0;
  dtQ = { semi, m:dtMidi(semi, shift), answered:false, ans:null };
  dtPlay(); dtRender();
}
// wisselende toonsoort: nieuwe grondtoon; daarna volgt de wentijd (dtStartIntro)
function dtNewKey(){
  const others = DR_CIRCLE.filter(pc => pc !== drS.pc);
  drS.pc = others[Math.floor(Math.random() * others.length)]; drSave(); drFill(); drBuild();
  dtQ = null; dtInKey = 0; dtWarm = false; dtIntroNew = true;
  if (Engine.drone.on()) drRefreshDrone();
}
// wentijd (dtS.intro seconden): drone aan, nog geen vraag; daarna start de eerste vraag (en pas dan de klok)
function dtStartIntro(){
  dtQ = null; dtIntro = true;
  Engine.ensure(); if (!Engine.drone.on()) drDroneOn();
  drDraw(); dtRender();
  dtTimers.push(setTimeout(() => { dtIntro = false; dtIntroNew = false; dtWarm = true; if (view === 'drone' && drS.sub === 'trap') dtNew(); }, dtS.intro * 1000));
}
function dtOnRoot(){ dtClear(); dtIntro = false; dtQ = null; dtInKey = 0; dtWarm = false; dtIntroNew = false; if (drS.sub === 'trap') dtRender(); }
function dtPlay(){
  if (!dtQ){ dtNew(); return; }
  Engine.ensure();
  let t = Engine.now() + .05;
  if (!Engine.drone.on()){ drDroneOn(); t += .9; }                 // eerst de drone laten landen
  if (!dtQ.answered) Score.heard('dronetrap');
  Engine.stopNotes(); dtNote(t, dtQ.m);
  // tijdmodus: de klok start bij de eerste keer dat de vraagtoon klinkt
  if (dtS.timed && !dtQ.answered && !dtQ.start){
    const lead = Math.max(0, (t - Engine.now()) * 1000);
    dtQ.start = performance.now() + lead;
    const q = dtQ;
    dtQ.tmo = setTimeout(() => { if (dtQ === q && !q.answered) dtAnswer(null); }, lead + dtS.limit * 1000);
    dtTimers.push(dtQ.tmo);
  }
}
// na het antwoord: via de toonladder naar de dichtstbijzijnde do (5 en hoger omhoog, lager omlaag)
function dtResolve(m0, semi){
  const base = m0 - semi, up = semi >= 7, path = [m0];
  let s = semi;
  if (!DT_MAJ.includes(s)){ s = up ? s + 1 : s - 1; path.push(base + s); }   // chromatisch: eerst naar een buurtoon
  if (up){ DT_MAJ.filter(x => x > s).concat(12).forEach(x => path.push(base + x)); }
  else { DT_MAJ.filter(x => x < s).reverse().forEach(x => path.push(base + x)); }
  if (path.length === 1) return;
  Engine.stopNotes();
  let t = Engine.now() + .05;
  path.forEach((m, i) => { dtNote(t, m, i === path.length - 1 ? 1.2 : .5); t += .42; });
}
function dtAnswer(semi){
  if (dtIntro) return;
  if (!dtQ){ dtNew(); return; }
  if (dtQ.answered){ if (semi == null) return; Engine.stopNotes(); dtNote(Engine.now() + .03, dtMidi(semi, dtQ.m - dtMidi(dtQ.semi)), 1.1); return; }   // vergelijken
  if (dtQ.tmo) clearTimeout(dtQ.tmo);
  dtQ.answered = true; dtQ.ans = semi; dtQ.late = semi == null;     // null = tijd op
  const ok = semi === dtQ.semi;
  Score.log('dronetrap', { k:dtQ.semi, q:drRootName(drS.pc) + ': ' + drNameAt(dtQ.semi), a:semi == null ? 'tijd op' : drDegLabel(semi), ok });
  dtStreak = ok ? dtStreak + 1 : 0;
  if (dtS.res) dtResolve(dtQ.m, dtQ.semi); else { Engine.stopNotes(); dtNote(Engine.now() + .05, dtQ.m, 1.1); }
  dtRender(); dtStats();
  if (dtS.auto && ok) dtTimers.push(setTimeout(() => { if (view === 'drone' && drS.sub === 'trap') dtNew(); }, dtS.res ? 3200 : 1600));
}

/* --- tekenen: de kwintencirkel is het antwoordbord --- */
function dtCircle(){
  // gedeelde Cirkel (kwintcirkel.js) als antwoordbord: trappen van het niveau = gevuld (klikbaar), buiten het niveau = ring
  // (gekleurde rand, grijs midden, niet klikbaar); na het antwoord: goede trap puls, foute keuze gestippeld; midden = start / nog eens / volgende
  const set = new Set(dtSet()), q = dtQ, done = q && q.answered, C = Cirkel.C;
  const mid = dtIntro ? `<text x="${C}" y="${C - 9}" class="kcans" style="fill:var(--bg)">${drRootName(drS.pc)}</text><text x="${C}" y="${C + 19}" class="kcansl">${dtIntroNew ? 'nieuwe toonsoort' : 'wennen aan do'}</text>`
    : !q ? Cirkel.icon('play')
    : !done ? `<text x="${C}" y="${C + 2}" class="kcq">?</text>`
    : `<text x="${C}" y="${C - 8}" class="kcans" style="fill:${drColor(q.semi)}">${drDegLabel(q.semi)}</text><text x="${C}" y="${C + 22}" class="kcansl">${DT_FEEL[q.semi][0]} · volgende ▶</text>`;
  const clock = dtIntro ? { dur:dtS.intro, el:0, warm:true }
    : q && !done && q.start ? { dur:dtS.limit, el:(performance.now() - q.start) / 1000 } : null;
  Cirkel.draw($('drCircle'), {
    id:'dtc', label:'Kwintencirkel: tik de trap aan', color:drColor, degree:drDegLabel, name:drNameAt,
    dot:semi => { const on = set.has(semi), right = done && semi === q.semi, wrong = done && semi === q.ans && q.ans !== q.semi;
      // zoals Vrij spelen: trappen van het niveau gevuld, buiten het niveau alleen de gekleurde rand (niet klikbaar)
      return { fill:on, click:on, pulse:right, mark:right ? 'right' : wrong ? 'wrong' : null }; },
    onDot:semi => dtAnswer(semi),
    center:{ html:mid, clock, onClick:dtMidClick,
      title:!q ? 'Start (' + Keys.label('luister') + ')' : !done ? 'Nog eens luisteren (' + Keys.label('luister') + ')' : 'Volgende (' + Keys.label('volgende') + ')' }
  });
}
function dtMidClick(){ if (dtIntro) return; if (!dtQ || dtQ.answered) dtNew(); else dtPlay(); }
function dtRender(){
  if (dtIntro){
    $('dtMsg').innerHTML = `<b>${dtIntroNew ? 'Nieuwe toonsoort' : 'Toonsoort'}: ${drRootName(drS.pc)}</b>. Luister even naar de drone en zing do zachtjes mee…`;
    $('dtFeel').innerHTML = '';
  } else if (!dtQ){
    $('dtMsg').innerHTML = `Tik op het midden van de cirkel (of ${Keys.label('luister')}) voor de eerste toon.`;
    $('dtFeel').innerHTML = '';
  } else if (!dtQ.answered){
    $('dtMsg').innerHTML = 'Welke trap is dit? Zing mee, voel waar de toon heen wil en tik hem aan.' + (dtS.timed ? ` <span class="muted">(binnen ${dtS.limit} s)</span>` : '');
    $('dtFeel').innerHTML = '';
  } else {
    const ok = dtQ.ans === dtQ.semi, f = DT_FEEL[dtQ.semi];
    $('dtMsg').innerHTML = (ok ? '<b class="dtok">Goed!</b> ' : dtQ.late ? `<b class="dtno">Tijd op! Het was ${drDegLabel(dtQ.semi)}</b>. ` : `<b class="dtno">Het was ${drDegLabel(dtQ.semi)}</b>, niet ${drDegLabel(dtQ.ans)}. `) +
      `<span class="muted">${dtQ.semi ? drNameAt(dtQ.semi) + ' boven ' + drRootName(drS.pc) : 'de grondtoon zelf (' + drRootName(drS.pc) + ')'}. Tik een andere trap aan om te vergelijken.</span>`;
    $('dtFeel').innerHTML = `<b style="color:${drColor(dtQ.semi)}">${f[0]}</b> · ${f[1]}`;
  }
  $('dtToday').textContent = Score.today('dronetrap');
  $('dtStreak').textContent = dtStreak;
  $('dtOwn').style.display = dtS.level === 'own' ? '' : 'none';
  $('dtOwn').innerHTML = dtS.level !== 'own' ? '' : '<span class="drsub">Kies je trappen:</span> ' + [...Array(12).keys()].map(s =>
    `<button class="drtone${dtS.own.includes(s) ? ' on' : ''}" data-s="${s}" style="--c:${drColor(s)}"><b>${drDegLabel(s)}</b><small>${DT_FEEL[s][0]}</small></button>`).join('');
  $('dtOwn').querySelectorAll('button').forEach(b => b.onclick = () => {
    const s = +b.dataset.s;
    dtS.own = dtS.own.includes(s) ? dtS.own.filter(x => x !== s) : dtS.own.concat(s);
    if (dtS.own.length < 2) dtS.own = dtS.own.concat([0, 7].filter(x => !dtS.own.includes(x))).slice(0, 2);
    dtSave(); dtQ = null; dtRender();
  });
  if (drS.sub === 'trap' && $('drCircle')) dtCircle();
}
function dtStats(){
  const t = Score.tally('dronetrap'), rec = Score.recent('dronetrap'), rows = Object.keys(t).map(k => ({ k:+k, r:t[k].r, n:t[k].t, p:t[k].r / t[k].t }))
    .sort((a, b) => a.p - b.p || b.n - a.n);
  // per trap: waarmee verward (uit dezelfde laatste 40 pogingen), te laat apart
  const mix = k => {
    const wrong = (rec[k] || []).filter(e => !e.ok), late = wrong.filter(e => e.a === 'tijd op').length, cnt = {};
    wrong.forEach(e => { if (e.a !== 'tijd op' && e.a) cnt[e.a] = (cnt[e.a] || 0) + 1; });
    const top = Object.entries(cnt).sort((x, y) => y[1] - x[1]);
    const parts = [];
    if (top.length){
      const [lab, c] = top[0], semi = [...Array(12).keys()].find(s => drDegLabel(s) === lab);
      const col = semi != null ? `<b style="color:${drColor(semi)}">${lab}</b>` : `<b>${lab}</b>`;
      parts.push((top.length > 1 && c > 1 ? 'meestal verward met ' : 'verward met ') + col + ` (${c}×)` + (top.length > 1 ? `, ook ${top.slice(1, 3).map(([l, n]) => l + ' (' + n + '×)').join(', ')}` : ''));
    }
    if (late) parts.push(`${late}× te laat`);
    return parts.length ? `<div class="dtmix">${parts.join(' · ')}</div>` : '';
  };
  // compacte regel (altijd zichtbaar): totaal + de drie zwakste trappen; klik = alles uitklappen
  const tot = rows.reduce((a, x) => a + x.r, 0), all = rows.reduce((a, x) => a + x.n, 0);
  $('dtStatSum').innerHTML = !rows.length ? '<span class="muted">nog geen antwoorden</span>'
    : `<span class="muted">${Math.round(tot / all * 100)}% goed · zwakst:</span> ` + rows.slice(0, 3).map(x =>
      `<span class="dtchip" style="--c:${drColor(x.k)}"><b>${drDegLabel(x.k)}</b> ${Math.round(x.p * 100)}%</span>`).join('');
  $('dtStats').innerHTML = rows.length ? rows.map(x => `<div class="stat"><div class="row"><span><b style="color:${drColor(x.k)}">●</b> ${drDegLabel(x.k)} · ${DT_FEEL[x.k][0]}</span><span>${x.r}/${x.n} · ${Math.round(x.p * 100)}%</span></div><div class="barbg"><div class="barfg" style="width:${x.p * 100}%"></div></div>${mix(x.k)}</div>`).join('')
    : '<p class="note">Nog geen antwoorden. De zwakste trap komt hier bovenaan.</p>';
}

/* --- toetsen (aangeroepen door de keydown-handler in drone.js; true = afgehandeld) --- */
function dtKey(e){
  const act = a => Keys.is(e, a);
  if (dtIntro && (act('luister') || act('volgende') || /^(Digit|Numpad)[1-7]$/.test(e.code) || e.code === 'KeyT')){ e.preventDefault(); return true; }
  if (act('luister')){ e.preventDefault(); if (!e.repeat) dtPlay(); return true; }
  if (act('volgende')){ e.preventDefault(); dtNew(); return true; }
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  // 1–7 = natuurlijke trappen, Shift+2/3/6/7 = ♭2/♭3/♭6/♭7, T = tritonus (♯4)
  const m = /^Digit([1-7])$/.exec(e.code) || /^Numpad([1-7])$/.exec(e.code);
  const s = e.code === 'KeyT' ? 6 : m ? (e.shiftKey ? DT_LOW[+m[1]] : DT_DIGIT[+m[1]]) : undefined;
  if (s !== undefined){
    e.preventDefault();
    if (s != null && dtSet().includes(s)) dtAnswer(s);
    return true;
  }
  return act('vorige') || act('begin') || act('metronoom');      // in Trappen niets doen (niet de toonladder laten stappen)
}

/* --- stand wisselen --- */
// overzicht (alleen de tegels) ↔ oefening
function dtBoard(){
  dtClear(); dtIntro = false; dtQ = null; dtWarm = false; dtIntroNew = false;
  if (typeof dmStop === 'function') dmStop();
  if (typeof drPanel === 'function') drPanel(false);
  $('droneView').classList.add('board');
  $('drSubs').querySelectorAll('button').forEach(b => b.classList.remove('on'));
  Engine.metronome.stop(); drPaused = null; if (Engine.drone.on()) Engine.drone.stop();
}
function dtSub(sub){
  $('droneView').classList.remove('board');
  drS.sub = sub === 'trap' || sub === 'melo' ? sub : 'vrij'; drSave();
  $('droneView').classList.toggle('trap', drS.sub === 'trap');
  $('droneView').classList.toggle('melo', drS.sub === 'melo');
  $('drSubs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.sub === drS.sub));
  dtClear(); if (typeof dmStop === 'function') dmStop();
  // naar de cirkel scrollen: bovenbalk net onder de vaste kop, zodat de (schermhoge) cirkel er helemaal op past
  requestAnimationFrame(() => { const hd = document.querySelector('header'), top = $('droneView').querySelector('.drtop');
    if (top) window.scrollTo(0, Math.max(0, top.getBoundingClientRect().top + window.scrollY - (hd ? hd.offsetHeight : 0) - 8)); });
  if (drS.sub !== 'vrij'){ Engine.metronome.stop(); dtInKey = 0; dtWarm = false; } else drMetro();
  drRefreshDrone(); drDraw();
  if (drS.sub === 'trap'){ dtRender(); dtStats(); }
  if (drS.sub === 'melo' && typeof dmRender === 'function'){ dmRender(); dmStats(); }
}

// knoppen in het paneel gelijkzetten met dtS (ook na het laden van een preset uit 📚 Mijn oefeningen)
function dtSyncUI(){
  $('dtLevel').value = dtS.level; $('dtInst').value = Engine.instId(dtS.inst);
  $('dtOct').checked = dtS.oct; $('dtRes').checked = dtS.res; $('dtAuto').checked = dtS.auto;
  $('dtKeyRand').checked = dtS.keyRand; $('dtTimed').checked = dtS.timed;
  $('dtKeyEvery').value = dtS.keyEvery; $('dtIntro').value = dtS.intro; $('dtLimit').value = dtS.limit;
  dtInKey = 0;
}
function dtInit(){
  if (!$('dtOwn')) return;
  $('dtLevel').innerHTML = DT_LEVELS.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
  $('dtLevel').value = dtS.level;
  $('dtInst').innerHTML = Engine.instOptions(Engine.instId(dtS.inst));
  $('dtOct').checked = dtS.oct; $('dtRes').checked = dtS.res; $('dtAuto').checked = dtS.auto;
  const on = (id, fn) => $(id).addEventListener('change', e => { fn(e.target); dtSave(); if (e.target.tagName === 'SELECT') e.target.blur(); });
  on('dtLevel', el => { dtS.level = el.value; dtQ = null; dtClear(); if (dtIntro){ dtIntro = false; dtWarm = false; } dtRender(); });
  const num = (id, key, lo, hi, def) => { $(id).value = dtS[key];
    on(id, el => { let v = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(v)) v = def; v = Math.min(hi, Math.max(lo, v)); dtS[key] = v; el.value = v; }); };
  $('dtKeyRand').checked = dtS.keyRand; $('dtTimed').checked = dtS.timed;
  on('dtKeyRand', el => { dtS.keyRand = el.checked; dtInKey = 0; });
  on('dtTimed',   el => { dtS.timed = el.checked; });
  num('dtKeyEvery', 'keyEvery', 1, 200, 10);
  num('dtIntro', 'intro', 0, 20, 3);
  num('dtLimit', 'limit', 1, 30, 4);
  on('dtInst',  el => { dtS.inst = el.value; });
  on('dtOct',   el => { dtS.oct = el.checked; });
  on('dtRes',   el => { dtS.res = el.checked; });
  on('dtAuto',  el => { dtS.auto = el.checked; });
  $('dtNext').onclick = () => { $('dtNext').blur(); dtNew(); };
  $('dtReset').onclick = () => { Score.clear('dronetrap'); dtStats(); dtRender(); };
  $('drSubs').querySelectorAll('button').forEach(b => b.onclick = () => { b.blur(); dtSub(b.dataset.sub); });
  Keys.onChange(dtRender);
  document.querySelector('[data-back="drone"]').onclick = dtBoard;
  if (typeof view !== 'undefined' && view === 'drone') dtBoard();
}
dtInit();
