/* ================= Intonatie boven een drone (view #intonatie, div #inView, prefix in) — 15-11-2026 =================
   Twee standen:
   - 'kies'  Hoog, laag of zuiver? Boven een drone klinkt een toon die net te hoog, te laag of zuiver is.
             Met 'Automatisch aanpassen' wordt het verschil kleiner als het goed gaat (2 goed op rij → ×0,8) en
             groter na een fout (×1,3): zo zoekt hij je grens (ongeveer 70% goed).
   - 'hoofd' Uit je hoofd: drone (hold s) → stilte (gap s) → toon zonder drone; verder als 'kies' (score 'intonatieh').
   - 'dubbel' Dubbelgreep: twee tonen samen zonder drone, de bovenste te laag/zuiver/te hoog (score 'intonatied').
   - 'vals'  Wie is er vals?: toonladder of melodie (boven de drone, of zonder), één noot vals; welke? (1–9, score 'intonatiev').
   - 'drie'  Drieklank zonder drone: terts of kwint vals, of alles zuiver? (1 2 3, score 'intonatiea').
   - 'rol'   Dezelfde noot, andere rol: drone + noot die zuiver is voor deze rol of voor een andere rol (score 'intonatier').
   Vibrato (inS.vib, vibD cent, vibR Hz) op de toon via osc.detune (inVib). Grafiek 'Je grens over tijd': inS.hist[key][dag] = {l, m, n} (inChart).
   - 'stem'  Zelf zuiver zetten: de toon begint ernaast, jij schuift (↑ ↓, − +, schuif) tot hij zuiver is.
   Klank: eigen oscillatoren met exacte frequenties (geen opnames: die zijn niet op de cent gestemd en de cello heeft
   vibrato). 'Rijk' = boventonen 1–8 (zwevingen hoorbaar bij elk interval), 'Sinus' = zuivere sinus (alleen bij
   unisono/octaaf goed bruikbaar: zonder boventonen zweeft een kwint of terts nauwelijks).
   Zuiver = reine stemming t.o.v. de drone (5:4, 6:5, 3:2 …); kan ook gelijkzwevend (piano).
   Score: onderdeel 'intonatie' (kies, k = interval-id) en 'intonaties' (zelf zetten, k = interval-id, a = afwijking).
   Opslag 'intonatie-settings'. Presets: lijst 'intonatie' (presets.js). */
var IN_KEY = 'intonatie-settings';
var IN_INTS = [
  { id:'p1', nl:'Unisono',        kort:'1',  semis:0,  r:[1, 1],   up:0 },
  { id:'p8', nl:'Octaaf',         kort:'8',  semis:12, r:[2, 1],   up:0 },
  { id:'p5', nl:'Kwint',          kort:'5',  semis:7,  r:[3, 2],   up:12 },
  { id:'p4', nl:'Kwart',          kort:'4',  semis:5,  r:[4, 3],   up:12 },
  { id:'g3', nl:'Grote terts',    kort:'3',  semis:4,  r:[5, 4],   up:12 },
  { id:'k3', nl:'Kleine terts',   kort:'♭3', semis:3,  r:[6, 5],   up:12 },
  { id:'g6', nl:'Grote sext',     kort:'6',  semis:9,  r:[5, 3],   up:12 },
  { id:'k6', nl:'Kleine sext',    kort:'♭6', semis:8,  r:[8, 5],   up:12 },
  { id:'g2', nl:'Grote secunde',  kort:'2',  semis:2,  r:[9, 8],   up:12 },
  { id:'k7', nl:'Kleine septiem', kort:'♭7', semis:10, r:[16, 9],  up:12 },
  { id:'g7', nl:'Grote septiem',  kort:'7',  semis:11, r:[15, 8],  up:12 },
  { id:'k2', nl:'Kleine secunde', kort:'♭2', semis:1,  r:[16, 15], up:12 },
  { id:'o4', nl:'Tritonus',       kort:'♯4', semis:6,  r:[45, 32], up:12 }
];
var IN_LEVELS = [
  { id:'i1', name:'1 · unisono en octaaf',           ints:['p1','p8'] },
  { id:'i2', name:'2 · + kwint en kwart',            ints:['p1','p8','p5','p4'] },
  { id:'i3', name:'3 · tertsen en sexten',           ints:['p5','g3','k3','g6','k6'] },
  { id:'i4', name:'4 · alle tonen van de toonladder', ints:['p1','p8','p5','p4','g3','k3','g6','k6','g2','k7','g7'] },
  { id:'i5', name:'5 · alles (ook ♭2 en tritonus)',   ints:IN_INTS.map(function(x){ return x.id; }) }
];
var IN_NOTES = ['C','Cis','D','Es','E','F','Fis','G','As','A','Bes','B'];
var inPaused = null, inRun = 0, inS = null, inQ = null, inDr = null, inTone = null, inTimers = [], inCount = 0, inScore = { right:0, total:0, streak:0 };

function inDefaults(){ return { level:'i1', mode:'kies', ints:['p1','p8'], ref:'zuiver', key:'rand', keyEvery:6, oct:3, dInst:'rijk', tInst:'rijk',
  dVol:55, tVol:60, dur:2.5, wait:1.5, hold:3, gap:1, vMat:'ladder-maj', vDiff:'middel', vDrone:true, vib:false, vibD:20, vibR:5.5, aMd:'beide', hist:{}, vNote:.6, adapt:true, cents:20, share:30, tol:5, auto:true, cur:{} }; }
function inLoad(){
  var s = {}; try { s = JSON.parse(localStorage.getItem(IN_KEY)) || {}; } catch(e){}
  inS = Object.assign(inDefaults(), s);
  if (!Array.isArray(inS.ints) || !inS.ints.length) inS.ints = ['p1','p8'];
  if (!inS.cur || typeof inS.cur !== 'object') inS.cur = {};
  if (!inS.hist || typeof inS.hist !== 'object') inS.hist = {};
}
function inSave(){ try { localStorage.setItem(IN_KEY, JSON.stringify(inS)); } catch(e){} }
function inInt(id){ return IN_INTS.find(function(x){ return x.id === id; }); }
function inLvKey(){ return inS.level + '|' + inS.ref + '|' + inS.tInst + (inS.mode === 'hoofd' || inS.mode === 'dubbel' || inS.mode === 'vals' || inS.mode === 'drie' ? '|' + inS.mode : '') + (inS.vib ? '|vib' : ''); }
function inCurCents(){ var c = +inS.cur[inLvKey()]; return c > 0 ? c : 25; }
function inSid(){ return { stem:'intonaties', hoofd:'intonatieh', dubbel:'intonatied', vals:'intonatiev', drie:'intonatiea', rol:'intonatier' }[inS.mode] || 'intonatie'; }
const inAsks = () => inS.mode === 'kies' || inS.mode === 'hoofd' || inS.mode === 'dubbel' || inS.mode === 'rol';   // standen met te laag / zuiver / te hoog
function inMatchLevel(){
  var L = IN_LEVELS.find(function(l){ return l.ints.length === inS.ints.length && l.ints.every(function(i){ return inS.ints.indexOf(i) >= 0; }); });
  inS.level = L ? L.id : 'eigen';
  if ($('inLevel')) $('inLevel').value = inS.level;
}

Score.def('intonatie', {
  name:'Intonatie (hoog/laag/zuiver)', view:'intonatie',
  label:function(k){ var x = inInt(k); return x ? x.nl : k; },
  level:function(){ return inS.level + '|' + inS.ref + (inS.adapt ? '' : '|' + inS.cents + 'c'); },
  levelName:function(lv){ var p = lv.split('|'), L = IN_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + (p[1] && p[1] !== 'zuiver' ? ', ' + (p[1] === 'mix' ? 'wisselende stemming' : inSysName(p[1])) : '') + (p[2] ? ', ' + p[2].replace('c', ' cent') : ''); },
  next:function(lv){ var p = lv.split('|'), i = IN_LEVELS.findIndex(function(l){ return l.id === p[0]; });
    return i >= 0 && i < IN_LEVELS.length - 1 ? 'niveau ' + IN_LEVELS[i + 1].name : 'een kleiner verschil (of zelf zuiver zetten)'; }
});
Score.def('intonatieh', {
  name:'Intonatie (uit je hoofd)', view:'intonatie',
  label:function(k){ var x = inInt(k); return x ? x.nl : k; },
  level:function(){ return inS.level + '|' + inS.ref + '|' + inS.gap + 's' + (inS.adapt ? '' : '|' + inS.cents + 'c'); },
  levelName:function(lv){ var p = lv.split('|'), L = IN_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + ', ' + (p[2] || '').replace('s', ' s') + ' stilte'; },
  next:function(lv){ return 'een langere stilte of een kleiner verschil'; }
});
Score.def('intonatied', {
  name:'Intonatie (dubbelgreep, zonder drone)', view:'intonatie',
  label:function(k){ var x = inInt(k); return x ? x.nl : k; },
  level:function(){ return inS.level + '|' + inS.ref + (inS.adapt ? '' : '|' + inS.cents + 'c'); },
  levelName:function(lv){ var p = lv.split('|'), L = IN_LEVELS.find(function(l){ return l.id === p[0]; }); return (L ? 'niveau ' + L.name : 'eigen keuze'); },
  next:function(lv){ return 'een kleiner verschil of meer intervallen'; }
});
Score.def('intonatiev', {
  name:'Intonatie (wie is er vals?)', view:'intonatie',
  label:function(k){ var x = inInt(k); return x ? 'valse ' + x.nl.toLowerCase() : k; },
  level:function(){ return inS.vMat + (inS.vMat.indexOf('ladder') === 0 ? '' : '-' + inS.vDiff) + '|' + inS.ref + (inS.vDrone ? '' : '|zonder') + (inS.adapt ? '' : '|' + inS.cents + 'c'); },
  levelName:function(lv){ var p = lv.split('|'), m = p[0].split('-'), d = /makkelijk|middel|lastig/.test(m[m.length - 1]) ? m.pop() : ''; m = m.join('-'); return (IN_VMAT[m] || m) + (d ? ' (' + d + ')' : '') + (p[2] === 'zonder' ? ', zonder drone' : ''); },
  next:function(lv){ return 'een kleiner verschil, een lastigere melodie of zonder drone'; }
});
Score.def('intonatiea', {
  name:'Intonatie (drieklank)', view:'intonatie',
  label:function(k){ return k === 'p1' ? 'alles zuiver' : k === 'p5' ? 'kwint vals' : k === 'g3' ? 'grote terts vals' : k === 'k3' ? 'kleine terts vals' : k; },
  level:function(){ return 'drie|' + inS.aMd + '|' + inS.ref + (inS.adapt ? '' : '|' + inS.cents + 'c'); },
  levelName:function(lv){ return 'drieklanken (' + (lv.split('|')[1] || '') + ')'; },
  next:function(){ return 'een kleiner verschil of een andere stemming'; }
});
Score.def('intonatier', {
  name:'Intonatie (dezelfde noot, andere rol)', view:'intonatie',
  label:function(k){ var x = inInt(k); return x ? 'als ' + x.nl.toLowerCase() : k; },
  level:function(){ return 'rol'; }, levelName:function(){ return 'dezelfde noot, andere rol'; },
  next:function(){ return 'zonder drone (Uit je hoofd) of met vibrato'; }
});
Score.def('intonaties', {
  name:'Intonatie (zelf zuiver zetten)', view:'intonatie',
  label:function(k){ var x = inInt(k); return x ? x.nl : k; },
  level:function(){ return inS.level + '|' + inS.ref + '|' + inS.tol + 'c'; },
  levelName:function(lv){ var p = lv.split('|'), L = IN_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + ', goed binnen ' + (p[2] || '').replace('c', ' cent'); },
  next:function(lv){ return 'een kleinere marge (Goed binnen … cent)'; }
});

/* --- klank: exacte frequenties --- */
var inWaves = {};
function inWave(kind){
  if (kind === 'sinus') return null;
  if (inWaves[kind]) return inWaves[kind];
  var n = 9, re = new Float32Array(n), im = new Float32Array(n);
  for (var h = 1; h < n; h++) im[h] = (kind === 'rijk' ? 1 / h : 1 / (h * h)) * (h % 2 ? 1 : .8);
  inWaves[kind] = actx.createPeriodicWave(re, im);
  return inWaves[kind];
}
function inOsc(f, kind){
  var o = actx.createOscillator(), w = inWave(kind);
  if (w) o.setPeriodicWave(w); else o.type = 'sine';
  o.frequency.value = f; return o;
}
function inF(v){ return String(Math.round(v * 10) / 10).replace('.', ','); }
function inHz(m){ return 440 * Math.pow(2, (m - 69) / 12); }
function inRoot(){ if (inQ && inQ.rootMidi != null) return inQ.rootMidi; return (inS.oct + 1) * 12 + (inQ ? inQ.pc : 0); }
function inDroneOn(){ return !!(inDr && inDr.bus === Engine.out()); }
function inDroneStart(fAbs){
  Engine.ensure();
  inDroneStop(true);
  var bus = Engine.out(), t = actx.currentTime, g = actx.createGain(), f = fAbs || inHz(inRoot());
  var v = inS.dVol / 100 * (inS.dInst === 'sinus' ? .22 : .13);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .6);
  var o = inOsc(f, inS.dInst); o.connect(g).connect(bus); o.start(t);
  inDr = { o:o, g:g, bus:bus, f:f };
  inStatus();
}
function inDroneStop(quick){
  if (!inDr) return;
  var d = inDr; inDr = null;
  try { var t = actx.currentTime; d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0, t + (quick ? .05 : .4)); d.o.stop(t + (quick ? .08 : .45)); } catch(e){}
  inStatus();
}
function inToneStop(){
  if (inSeq.length && actx) inSeqStop();
  if (!inTone) return;
  var d = inTone; inTone = null;
  try { var t = actx.currentTime; d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0, t + .12); d.o.stop(t + .15); } catch(e){}
}
/* Stemmingssystemen (15-11-2026): 'zuiver' betekent in elk systeem iets anders. Cent boven de drone per aantal halve tonen.
   rein = zuivere verhoudingen (5:4, 6:5 …) · gelijk = piano · pyth = Pythagoreïsch (alles uit zuivere kwinten 3:2, grote
   terts 81:64 = 408 cent) · midden = 1/4-komma middentoon (zuivere grote tertsen, kwint 696,6) · werck = Werckmeister III
   (welgetemperd: hangt af van de toonsoort, berekend vanaf de echte noten) · mix = elke vraag een ander systeem. */
var IN_SYS = [
  { id:'zuiver', nl:'rein (zuivere verhoudingen)', kort:'reine stemming' },
  { id:'gelijk', nl:'gelijkzwevend (piano)', kort:'gelijkzwevende stemming' },
  { id:'pyth',   nl:'Pythagoreïsch (zuivere kwinten)', kort:'Pythagoreïsche stemming' },
  { id:'midden', nl:'middentoon ¼-komma (zuivere tertsen)', kort:'middentoonstemming' },
  { id:'werck',  nl:'Werckmeister III (welgetemperd, per toonsoort anders)', kort:'Werckmeister III' }
];
var IN_PYTH = [0, 90.22, 203.91, 294.13, 407.82, 498.04, 611.73, 701.96, 792.18, 905.87, 996.09, 1109.78];
var IN_MID = (function(){ var f = 1200 * Math.log2(5) / 4, a = []; for (var k = -5; k <= 6; k++){ var n = ((7 * k) % 12 + 12) % 12; a[n] = ((k * f) % 1200 + 1200) % 1200; } return a; })();   // kwintenreeks Des … Fis
var IN_WERCK = [0, 90.225, 192.18, 294.135, 390.225, 498.045, 588.27, 696.09, 792.18, 888.27, 996.09, 1092.18];   // vanaf C
function inSysOf(q){ return (q && q.sys) || (inS.ref === 'mix' ? 'zuiver' : inS.ref); }
function inSysName(id){ var x = IN_SYS.find(function(y){ return y.id === id; }); return x ? x.kort : id; }
function inCents(sys, x, pc){   // cent van het interval binnen het octaaf (0 … 1200)
  var n = x.semis % 12;
  if (x.semis === 12) return 1200;
  if (sys === 'gelijk') return 100 * n;
  if (sys === 'pyth') return IN_PYTH[n];
  if (sys === 'midden') return IN_MID[n];
  if (sys === 'werck'){ var a = IN_WERCK[pc], b = IN_WERCK[(pc + n) % 12]; return ((b - a) % 1200 + 1200) % 1200; }
  return 1200 * Math.log2(x.r[0] / x.r[1]);
}
function inTarget(q){   // frequentie van de 'zuivere' toon in het gekozen stemmingssysteem
  var x = inInt(q.id), base = inHz(inRoot());
  return base * Math.pow(2, (inCents(inSysOf(q), x, q.pc) + (x.up ? 1200 : 0)) / 1200);
}
function inVib(o, t, end){   // vibrato zoals op de viool: het midden blijft op de toonhoogte, ±vibD cent, vibR keer per seconde
  if (!inS.vib) return;
  var l = actx.createOscillator(), lg = actx.createGain();
  l.frequency.value = inS.vibR || 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(+inS.vibD || 20, t + .35);   // vibrato komt er na de aanzet in
  l.connect(lg).connect(o.detune); l.start(t);
  if (end) l.stop(end); else o.addEventListener('ended', function(){ try { l.stop(); } catch(e){} });
}
function inPlay(dev, hold, noDrone, fAbs){   // toon met afwijking dev (cent); hold = blijft klinken (zelf zetten); noDrone = zonder drone (uit je hoofd); fAbs = vaste frequentie
  Engine.ensure();
  if (!noDrone && !inDroneOn()) inDroneStart();
  inToneStop();
  var bus = Engine.out(), t = actx.currentTime + .02, g = actx.createGain();
  var v = inS.tVol / 100 * (inS.tInst === 'sinus' ? .2 : .12);
  var o = inOsc((fAbs || inTarget(inQ)) * Math.pow(2, dev / 1200), inS.tInst);
  inVib(o, t, hold ? 0 : t + inS.dur + .05);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .08);
  o.connect(g).connect(bus); o.start(t);
  if (!hold){ var end = t + inS.dur; g.gain.setValueAtTime(v, end - .2); g.gain.linearRampToValueAtTime(0, end); o.stop(end + .05); }
  var me = { o:o, g:g }; inTone = me;
  o.onended = function(){ if (inTone === me) inTone = null; };
  Score.heard(inSid());
}
var inSeq = [];   // lopende tonen van een dubbelgreep of reeks (Wie is er vals?)
function inSeqStop(){ var t = actx ? actx.currentTime : 0; inSeq.forEach(function(d){ try { d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0, t + .08); d.o.stop(t + .1); } catch(e){} }); inSeq = []; document.querySelectorAll('#inVals button.cur').forEach(function(b){ b.classList.remove('cur'); }); }
function inNote(f, t, dur, vol){   // één toon op tijdstip t (audioklok), in de klank van de toon
  var g = actx.createGain(), o = inOsc(f, inS.tInst), v = (vol || 1) * inS.tVol / 100 * (inS.tInst === 'sinus' ? .2 : .12);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .05);
  g.gain.setValueAtTime(v, Math.max(t + .06, t + dur - .12)); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(Engine.out()); o.start(t); o.stop(t + dur + .03);
  inVib(o, t, t + dur + .03);
  inSeq.push({ o:o, g:g });
}
function inDyad(dev){   // dubbelgreep: twee tonen samen, zonder drone; de bovenste kan ernaast zitten
  Engine.ensure(); inSeqStop(); inToneStop(); if (inDr) inDroneStop(true);
  var x = inInt(inQ.id), lo = inHz(inRoot()) * (x.up ? 2 : 1), t = actx.currentTime + .05;
  inNote(lo, t, inS.dur, .85); inNote(inTarget(inQ) * Math.pow(2, dev / 1200), t, inS.dur, .85);
  Score.heard(inSid());
}
function inTriad(devT, devK){   // drieklank zonder drone: grondtoon (referentie) + terts + kwint
  Engine.ensure(); inSeqStop(); inToneStop(); if (inDr) inDroneStop(true);
  var f0 = inHz(inRoot()) * 2, t = actx.currentTime + .05, sys = inSysOf(inQ), x3 = inInt(inQ.md === 'min' ? 'k3' : 'g3');
  inNote(f0, t, inS.dur, .75);
  inNote(f0 * Math.pow(2, (inCents(sys, x3, inQ.pc) + devT) / 1200), t, inS.dur, .75);
  inNote(f0 * Math.pow(2, (inCents(sys, inInt('p5'), inQ.pc) + devK) / 1200), t, inS.dur, .75);
  Score.heard(inSid());
}
function inTriadQ(c){ var t = inQ.bad === 'kwint' ? 0 : c, k = inQ.bad === 'kwint' ? c : 0; inTriad(t, k); }   // c = afwijking van de valse stem (bij 'geen': de terts)
// Dezelfde noot, andere rol: rollen met een duidelijk ander rein verschil t.o.v. de piano
var IN_ROLES = ['p5','p4','g3','k3','g6','k6','g7','k2','g2'];
function inEtDiff(id){ var x = inInt(id); return 1200 * Math.log2(x.r[0] / x.r[1]) - 100 * x.semis; }
function inMakeRol(){
  var tone = (inS.oct + 2) * 12 + Math.floor(Math.random() * 12), a, b, n = 0;
  do { a = IN_ROLES[Math.floor(Math.random() * IN_ROLES.length)]; b = IN_ROLES[Math.floor(Math.random() * IN_ROLES.length)]; n++; }
  while ((a === b || Math.abs(inEtDiff(a) - inEtDiff(b)) < 8) && n < 200);
  var ra = tone - 12 - inInt(a).semis, rb = tone - 12 - inInt(b).semis;
  return { tone:tone, a:a, b:b, ra:ra, rb:rb };
}
var IN_STEP = { p1:0, k2:1, g2:1, k3:2, g3:2, p4:3, o4:3, p5:4, k6:5, g6:5, k7:6, g7:6, p8:7 };
function inRootName(m){ return IN_TON.maj[((m % 12) + 12) % 12]; }
function inToneName(rootMidi, id){   // juiste spelling van de noot in deze rol (Ges als kleine terts boven Es, Fis als grote terts boven D)
  var L = 'CDEFGAB', NAT = [0,2,4,5,7,9,11], rn = inRootName(rootMidi), li = (L.indexOf(rn.charAt(0)) + IN_STEP[id]) % 7, pc = (((rootMidi + inInt(id).semis) % 12) + 12) % 12;
  var a = (pc - NAT[li] + 18) % 12 - 6, l = L.charAt(li);
  return a === 0 ? l : a === 1 ? l + 'is' : a === 2 ? l + 'isis' : a === -1 ? (l === 'E' || l === 'A' ? l + 's' : l + 'es') : (l === 'E' || l === 'A' ? l + 'ses' : l + 'eses');
}
function inRoleTxt(r, w){ var id = w === 'b' ? r.b : r.a, rt = w === 'b' ? r.rb : r.ra; return inToneName(rt, id) + ' als ' + inInt(id).nl.toLowerCase() + ' boven ' + inRootName(rt); }
function inRolePlay(which){   // na het antwoord: de noot zuiver in rol a of rol b, met de bijbehorende drone
  var r = inQ.role, id = which === 'b' ? r.b : r.a, root = which === 'b' ? r.rb : r.ra, x = inInt(id);
  inClear(); inToneStop(); inDroneStart(inHz(root));
  inLater(function(){ inPlay(0, false, true, inHz(root) * x.r[0] / x.r[1] * 2); }, 600);
}
function inSeqPlay(clean){   // Wie is er vals?: de reeks, met (of zonder) de valse noot; knoppen lichten mee op
  Engine.ensure(); inSeqStop(); inToneStop();
  if (inS.vDrone && !inDroneOn()) inDroneStart();
  if (!inS.vDrone && inDr) inDroneStop(true);
  var d = Math.max(.25, +inS.vNote), t0 = actx.currentTime + .1;
  inQ.notes.forEach(function(n, i){
    var dev = !clean && i === inQ.bad ? inQ.dev : 0;
    inNote(n.f * Math.pow(2, dev / 1200), t0 + i * d, d * .94, 1);
    inLater(function(){ document.querySelectorAll('#inVals button').forEach(function(b){ b.classList.toggle('cur', +b.dataset.i === i); }); }, (t0 - actx.currentTime + i * d) * 1000);
  });
  inLater(function(){ document.querySelectorAll('#inVals button.cur').forEach(function(b){ b.classList.remove('cur'); }); }, (t0 - actx.currentTime + inQ.notes.length * d) * 1000);
  Score.heard(inSid());
}
var IN_VMAT = { 'ladder-maj':'toonladder majeur', 'ladder-min':'toonladder mineur', 'melo-maj':'melodie majeur', 'melo-min':'melodie mineur', 'chrom':'chromatische melodie', 'mix':'wisselend' };
var IN_SCALE = { maj:[0,2,4,5,7,9,11,12], min:[0,2,3,5,7,8,10,12] };
var IN_TON = { maj:['C','Des','D','Es','E','F','Fis','G','As','A','Bes','B'], min:['C','Cis','D','Es','E','F','Fis','G','Gis','A','Bes','B'] };
function inSpell(pc, mode, j, semis){   // juiste nootnaam van trap j in de toonsoort (Dis in B-groot, niet Es)
  var L = 'CDEFGAB', NAT = [0,2,4,5,7,9,11], t = IN_TON[mode][pc], li = (L.indexOf(t.charAt(0)) + j) % 7;
  var a = (((pc + semis) % 12) - NAT[li] + 18) % 12 - 6, l = L.charAt(li);
  return a === 0 ? l : a === 1 ? l + 'is' : a === 2 ? l + 'isis' : a === -1 ? (l === 'E' || l === 'A' ? l + 's' : l + 'es') : (l === 'E' || l === 'A' ? l + 'ses' : l + 'eses');
}
function inSemisInt(n){ return IN_INTS.find(function(x){ return x.semis === n; }); }
function inMakeSeq(pc){   // noten (frequenties in het gekozen stemmingssysteem) + welke vals is
  var mat = inS.vMat === 'mix' ? ['ladder-maj','ladder-min','melo-maj','melo-min','chrom'][Math.floor(Math.random() * 5)] : inS.vMat;
  var md = mat.indexOf('min') >= 0 ? 'min' : 'maj', sc = IN_SCALE[md], chrom = mat === 'chrom', idx = [];
  // moeilijkheid van melodieën: makkelijk = kort + stapjes, middel = af en toe een sprong, lastig = lang + grote sprongen
  var D = { makkelijk:{ n:5, max:1, p:1 }, middel:{ n:7, max:2, p:.75 }, lastig:{ n:9, max:4, p:.45 } }[inS.vDiff] || { n:7, max:2, p:.75 };
  if (chrom) D = { makkelijk:{ n:5, max:2, p:.8 }, middel:{ n:7, max:3, p:.6 }, lastig:{ n:9, max:7, p:.4 } }[inS.vDiff] || { n:7, max:3, p:.6 };
  var top = chrom ? 12 : 7;
  if (mat.indexOf('ladder') === 0) idx = [0,1,2,3,4,5,6,7];
  else {
    var k = 0; idx = [0];
    for (var i = 1; i < D.n; i++){
      var sz = Math.random() < D.p ? 1 : 2 + Math.floor(Math.random() * Math.max(1, D.max - 1)), dir = Math.random() < .5 ? -1 : 1;
      if (k + dir * sz < 0 || k + dir * sz > top) dir = -dir;
      k = Math.max(0, Math.min(top, k + dir * sz));
      if (k === idx[idx.length - 1]) k = k === top ? top - 1 : k + 1;
      idx.push(k);
    }
  }
  var sys = inPickSys(), base = inHz(inRoot()) * 2;
  var SH = ['C','Cis','D','Dis','E','F','Fis','G','Gis','A','Ais','B'], FL = ['C','Des','D','Es','E','F','Ges','G','As','A','Bes','B'];
  var chromName = function(i){ var a = (pc + idx[i]) % 12; if (i === 0) return IN_TON.maj[pc]; return (idx[i] > idx[i - 1] ? SH : FL)[a]; };   // omhoog ♯, omlaag ♭
  var notes = idx.map(function(j, i){ var semis = chrom ? j : sc[j], x = inSemisInt(semis % 12) || inSemisInt(0), c = semis === 12 ? 1200 : inCents(sys, x, pc);
    return { j:j, semis:semis, x:x, f:base * Math.pow(2, c / 1200), name:chrom ? chromName(i) : inSpell(pc, md, j % 7, semis % 12) }; });
  var cand = notes.map(function(n, i){ return i; }).filter(function(i){ return inS.vDrone ? true : i > 0; });
  return { mat:mat, md:md, sys:sys, notes:notes, bad:cand[Math.floor(Math.random() * cand.length)] };
}
function inVAnswer(i){
  if (!inQ || inQ.done || inS.mode !== 'vals') return;
  inQ.done = true; inClear(); inSeqStop();
  var ok = i === inQ.bad, b = inQ.notes[inQ.bad], x = b.x;
  Score.log('intonatiev', [{ k:x.id, q:IN_VMAT[inQ.mat] + ' op ' + IN_NOTES[inQ.pc] + ', noot ' + (inQ.bad + 1) + ' (' + b.name + ') ' + (inQ.dev > 0 ? '+' : '') + Math.round(inQ.dev) + ' cent', a:'noot ' + (i + 1), ok:ok ? 1 : 0 }]);
  inScore.total++; if (ok){ inScore.right++; inScore.streak++; } else inScore.streak = 0;
  inAdaptStep(ok);
  $('inMsg').textContent = (ok ? '✓ Goed: ' : '✗ Niet goed: ') + 'noot ' + (inQ.bad + 1) + ' (' + b.name + ') was ' + inF(Math.abs(inQ.dev)) + ' cent te ' + (inQ.dev > 0 ? 'hoog' : 'laag') + '.';
  $('inMsg').className = 'qmsg ' + (ok ? 'ok' : 'bad');
  document.querySelectorAll('#inVals button').forEach(function(bt){ bt.classList.toggle('right', +bt.dataset.i === inQ.bad); bt.classList.toggle('wrong', +bt.dataset.i === i && !ok); });
  inAfter();
  if (ok && inS.auto) inLater(inNew, 1800);
}
function inAAnswer(a){   // drieklank: 'terts' | 'kwint' | 'geen'
  if (!inQ || inQ.done || inS.mode !== 'drie') return;
  inQ.done = true; inClear(); inSeqStop();
  var ok = a === inQ.bad, nm = inQ.md === 'min' ? 'mineur' : 'majeur';
  Score.log('intonatiea', [{ k:inQ.id, q:IN_TON[inQ.md][inQ.pc] + '-' + nm + ': ' + (inQ.bad === 'geen' ? 'alles zuiver' : inQ.bad + ' ' + (inQ.dev > 0 ? '+' : '') + Math.round(inQ.dev) + ' cent'), a:a, ok:ok ? 1 : 0 }]);
  inScore.total++; if (ok){ inScore.right++; inScore.streak++; } else inScore.streak = 0;
  inAdaptStep(ok);
  $('inMsg').textContent = (ok ? '✓ Goed: ' : '✗ Niet goed: ') + (inQ.bad === 'geen' ? 'alles was zuiver.' : 'de ' + inQ.bad + ' was ' + inF(Math.abs(inQ.dev)) + ' cent te ' + (inQ.dev > 0 ? 'hoog' : 'laag') + '.');
  $('inMsg').className = 'qmsg ' + (ok ? 'ok' : 'bad');
  document.querySelectorAll('#inDrie button').forEach(function(b){ b.classList.toggle('right', b.dataset.a === inQ.bad); b.classList.toggle('wrong', b.dataset.a === a && !ok); });
  if (inQ.bad !== 'geen') inMeter(inQ.dev, null);
  inAfter();
  if (ok && inS.auto) inLater(inNew, 1800);
}
function inAdaptStep(ok){   // 2 goed op rij → kleiner verschil, fout → groter
  if (!inS.adapt || inS.mode === 'rol') return;
  var k = inLvKey(), c = inCurCents();
  if (ok){ inRun++; if (inRun >= 2){ c = Math.max(1, c * .8); inRun = 0; } }
  else { inRun = 0; c = Math.min(50, c * 1.3); }
  inS.cur[k] = Math.round(c * 10) / 10;
  var d = new Date(), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  var h = inS.hist[k] = inS.hist[k] || {}, e = h[day] = h[day] || { l:c, m:c, n:0 };   // per dag: laatste, laagste, aantal
  e.l = inS.cur[k]; e.m = Math.min(e.m, inS.cur[k]); e.n++;
  var days = Object.keys(h).sort(); if (days.length > 400) days.slice(0, days.length - 400).forEach(function(x){ delete h[x]; });
  inSave();
}
function inSetDev(dev){   // zelf zetten: toonhoogte live bijstellen
  if (!inTone || !inQ) return;
  try { inTone.o.frequency.setTargetAtTime(inTarget(inQ) * Math.pow(2, dev / 1200), actx.currentTime, .015); } catch(e){}
}
function inClear(){ inTimers.forEach(clearTimeout); inTimers = []; }
function inLater(fn, ms){ var id = setTimeout(function(){ inTimers = inTimers.filter(function(x){ return x !== id; }); fn(); }, ms); inTimers.push(id); }

/* --- vragen --- */
function inPickInt(){
  var st = Score.tally(inSid(), 20), items = inS.ints.slice();
  if (items.length > 1 && inQ) items = items.filter(function(i){ return i !== inQ.id; });
  var ws = items.map(function(i){ var s = st[i]; return .3 + (s ? (s.t - s.r + 1) / (s.t + 2) : .5) * 2; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum;
  for (var k = 0; k < items.length; k++){ r -= ws[k]; if (r <= 0) return items[k]; }
  return items[items.length - 1];
}
function inPickSys(){ if (inS.ref !== 'mix') return inS.ref; var o = IN_SYS.filter(function(y){ return !inQ || y.id !== inQ.sys; }); return o[Math.floor(Math.random() * o.length)].id; }
function inNew(){
  inClear(); inToneStop(); if (inPaused){ inPaused = null; inPauseUI(); }
  var newKey = !inQ || inQ.dummy || (inS.key === 'rand' ? inCount % Math.max(1, inS.keyEvery) === 0 : +inS.key !== inQ.pc);
  var pc = inS.key === 'rand' ? (newKey || !inQ ? Math.floor(Math.random() * 12) : inQ.pc) : +inS.key;
  if (inS.key === 'rand' && inQ && newKey && pc === inQ.pc) pc = (pc + 5) % 12;
  var id = inPickInt(), dev = 0, ans = 'zuiver';
  if (inS.mode === 'stem'){
    dev = (Math.random() < .5 ? -1 : 1) * (12 + Math.random() * 28);
    inQ = { id:id, pc:pc, dev:dev, start:dev, done:false, off:Math.round((Math.random() - .5) * 60) };
    inQ.sys = inPickSys();
  } else if (inS.mode === 'drie'){
    var cd = inS.adapt ? inCurCents() : +inS.cents, md = inS.aMd === 'beide' ? (Math.random() < .5 ? 'maj' : 'min') : inS.aMd;
    var bad = Math.random() * 100 < inS.share ? 'geen' : Math.random() < .6 ? 'terts' : 'kwint';
    inQ = { id:bad === 'geen' ? 'p1' : bad === 'kwint' ? 'p5' : (md === 'min' ? 'k3' : 'g3'), pc:pc, md:md, bad:bad, dev:bad === 'geen' ? 0 : (Math.random() < .5 ? -1 : 1) * cd, c:cd, done:false, sys:inPickSys() };
  } else if (inS.mode === 'rol'){
    var r = inMakeRol(), useB = Math.random() < .5;
    inQ = { id:r.a, pc:((r.ra % 12) + 12) % 12, rootMidi:r.ra, role:r, dev:useB ? inEtDiff(r.b) - inEtDiff(r.a) : 0, done:false, sys:'zuiver' };
    inQ.ans = inQ.dev > .05 ? 'hoog' : inQ.dev < -.05 ? 'laag' : 'zuiver'; inQ.c = Math.abs(inQ.dev);
  } else if (inS.mode === 'vals'){
    var cv = inS.adapt ? inCurCents() : +inS.cents, sq = inMakeSeq(pc);
    inQ = { id:'vals', pc:pc, dev:(Math.random() < .5 ? -1 : 1) * cv, c:cv, done:false, sys:sq.sys, mat:sq.mat, md:sq.md, notes:sq.notes, bad:sq.bad };
    inQ.id = sq.notes[sq.bad].x.id;
  } else {
    var c = inS.adapt ? inCurCents() : +inS.cents;
    if (Math.random() * 100 >= inS.share){ var up = Math.random() < .5; dev = up ? c : -c; ans = up ? 'hoog' : 'laag'; }
    inQ = { id:id, pc:pc, dev:dev, c:c, ans:ans, done:false, sys:inPickSys() };
  }
  inCount++;
  Score.ask(inSid());
  if (inS.mode === 'hoofd'){ inRenderQ(); inHoofd(); return; }
  if (inS.mode === 'dubbel'){ inRenderQ(); inLater(function(){ inDyad(inQ.dev); }, 300); return; }
  if (inS.mode === 'drie'){ inRenderQ(); inLater(function(){ inTriadQ(inQ.dev); }, 300); return; }
  if (inS.mode === 'vals' && !inS.vDrone){ inRenderQ(); inLater(function(){ inSeqPlay(false); }, 300); return; }
  var changed = !inDroneOn() || Math.abs(inDr.f - inHz(inRoot())) > .01;
  if (changed) inDroneStart();
  inRenderQ();
  var wait = changed ? Math.max(.6, +inS.wait) * 1000 : 450;
  $('inMsg').textContent = changed ? 'Luister eerst naar de drone…' : ''; $('inMsg').className = 'qmsg muted';
  inLater(function(){ $('inMsg').textContent = ''; if (inS.mode === 'vals') inSeqPlay(false); else inPlay(inQ.dev, inS.mode === 'stem'); }, wait);
}
function inHoofd(){   // uit je hoofd: eerst de drone, dan stilte, dan de toon zonder drone
  inClear(); inToneStop();
  inDroneStart();
  $('inMsg').textContent = 'Onthoud de drone…'; $('inMsg').className = 'qmsg muted';
  inLater(function(){
    inDroneStop();
    $('inMsg').textContent = inS.gap > 0 ? 'Stilte… houd de toon in je hoofd' : ''; 
    inLater(function(){ $('inMsg').textContent = ''; inPlay(inQ.dev, false, true); }, Math.max(.35, +inS.gap) * 1000);
  }, Math.max(1, +inS.hold) * 1000);
}
function inWithDrone(dev){   // na het antwoord: toon mét drone, om te vergelijken
  if (!inDroneOn()) inDroneStart();
  inLater(function(){ inPlay(dev, false); }, 500);
}
function inAnswer(a){
  if (!inQ || inQ.done || !inAsks()) return;
  inQ.done = true; inClear();
  var ok = a === inQ.ans, x = inInt(inQ.id);
  Score.log(inSid(), [{ k:inQ.id, q:x.nl + ' boven ' + IN_NOTES[inQ.pc] + (inQ.dev ? ' (' + (inQ.dev > 0 ? '+' : '') + Math.round(inQ.dev) + ' cent)' : ' (zuiver)'), a:a, ok:ok ? 1 : 0 }]);
  inScore.total++; if (ok){ inScore.right++; inScore.streak++; } else inScore.streak = 0;
  inAdaptStep(ok);
  var was = inQ.dev === 0 ? 'zuiver' : inF(Math.abs(inQ.dev)) + ' cent te ' + (inQ.dev > 0 ? 'hoog' : 'laag');
  $('inMsg').textContent = (ok ? '✓ Goed: ' : '✗ Niet goed: ') + 'hij was ' + was + '.';
  $('inMsg').className = 'qmsg ' + (ok ? 'ok' : 'bad');
  document.querySelectorAll('#inKies button').forEach(function(b){ b.classList.toggle('right', b.dataset.a === inQ.ans); b.classList.toggle('wrong', b.dataset.a === a && !ok); });
  inMeter(inQ.dev, null);
  inAfter();
  if (ok && inS.auto) inLater(inNew, 1600);
}
function inCheck(){
  if (!inQ || inS.mode !== 'stem') return;
  if (inQ.done){ inNew(); return; }
  inQ.done = true; inClear();
  var err = Math.round(inQ.dev * 10) / 10, ok = Math.abs(err) <= inS.tol, x = inInt(inQ.id);
  Score.log('intonaties', [{ k:inQ.id, q:x.nl + ' boven ' + IN_NOTES[inQ.pc], a:(err > 0 ? '+' : '') + inF(err) + ' cent', ok:ok ? 1 : 0 }]);
  inScore.total++; if (ok){ inScore.right++; inScore.streak++; } else inScore.streak = 0;
  $('inMsg').textContent = (ok ? '✓ Zuiver genoeg: ' : '✗ Nog niet: ') + (Math.abs(err) < .5 ? 'precies goed!' : 'je zat ' + inF(Math.abs(err)) + ' cent te ' + (err > 0 ? 'hoog' : 'laag') + '.') + ' (goed = binnen ' + inS.tol + ' cent)';
  $('inMsg').className = 'qmsg ' + (ok ? 'ok' : 'bad');
  inMeter(err, inQ.start);
  inToneStop(); inAfter();
}
function inCmpQ(){   // na het antwoord: te laag / zuiver / te hoog met precies het verschil van deze vraag
  if (inS.mode === 'rol'){
    var r = inQ.role;
    $('inCmpQBox').hidden = false; $('inCmpQTxt').textContent = 'Dezelfde toon in beide rollen, elk zuiver met de eigen drone:';
    $('inCmpQ').innerHTML = '<button type="button" data-role="a"' + (!inQ.dev ? ' class="opd"' : '') + '>▶ ' + inRoleTxt(r, 'a') + (!inQ.dev ? '<small class="inopd">opdracht</small>' : '') + '</button>'
      + '<button type="button" data-role="b"' + (inQ.dev ? ' class="opd"' : '') + '>▶ ' + inRoleTxt(r, 'b') + (inQ.dev ? '<small class="inopd">opdracht</small>' : '') + '</button>'
      + '<button type="button" data-c="' + (Math.round(inQ.dev * 10) / 10) + '">▶ zoals hij klonk (drone ' + inRootName(r.ra) + ')</button>';
    return;
  }
  var c = Math.abs(inS.mode === 'stem' ? (inQ.start || 0) : (inQ.c || Math.abs(inQ.dev) || 0)), r = Math.round(c * 10) / 10;
  if (inS.mode === 'drie'){
    var v = inQ.bad === 'kwint' ? 'kwint' : 'terts', w = inQ.bad === 'geen' ? 'zuiver' : inQ.dev > 0 ? 'hoog' : 'laag', tg = function(k){ return w === k ? '<small class="inopd">opdracht</small>' : ''; };
    $('inCmpQBox').hidden = false; $('inCmpQTxt').textContent = 'De ' + v + ' met het verschil van deze vraag (' + inF(r) + ' cent):';
    $('inCmpQ').innerHTML = '<button type="button" data-c="' + (-r) + '"' + (w === 'laag' ? ' class="opd"' : '') + '>⬇ ' + v + ' −' + inF(r) + tg('laag') + '</button><button type="button" data-c="0" class="zero' + (w === 'zuiver' ? ' opd' : '') + '">✓ alles zuiver' + tg('zuiver') + '</button><button type="button" data-c="' + r + '"' + (w === 'hoog' ? ' class="opd"' : '') + '>⬆ ' + v + ' +' + inF(r) + tg('hoog') + '</button>';
    return;
  }
  $('inCmpQBox').hidden = !(c > 0);
  if (!(c > 0)) return;
  $('inCmpQTxt').textContent = inS.mode === 'stem' ? 'Zo ver zat hij er aan het begin naast (' + inF(r) + ' cent):' : 'Met het verschil van deze vraag (' + inF(r) + ' cent):';
  // welke klonk er in de opdracht? (bij zelf zetten: waar hij begon)
  var d = inS.mode === 'stem' ? inQ.start : inQ.dev, was = d > 0 ? 'hoog' : d < 0 ? 'laag' : 'zuiver';
  var tag = function(k){ return was === k ? '<small class="inopd">' + (inS.mode === 'stem' ? 'begin' : 'opdracht') + '</small>' : ''; };
  $('inCmpQ').innerHTML = '<button type="button" data-c="' + (-r) + '"' + (was === 'laag' ? ' class="opd"' : '') + '>⬇ te laag −' + inF(r) + tag('laag') + '</button>'
    + '<button type="button" data-c="0" class="zero' + (was === 'zuiver' ? ' opd' : '') + '">✓ zuiver' + tag('zuiver') + '</button>'
    + '<button type="button" data-c="' + r + '"' + (was === 'hoog' ? ' class="opd"' : '') + '>⬆ te hoog +' + inF(r) + tag('hoog') + '</button>'
    + (inS.mode === 'stem' ? '<button type="button" data-c="' + (Math.round(inQ.dev * 10) / 10) + '" class="opd">▶ jouw toon (' + (inQ.dev > 0 ? '+' : '') + inF(inQ.dev) + ')<small class="inopd">jij</small></button>' : '');
}
function inAfter(){   // na het antwoord: vergelijken + uitleg
  var x = inInt(inQ.id), etDiff = Math.round((1200 * Math.log2(x.r[0] / x.r[1]) - 100 * x.semis) * 10) / 10;
  $('inCmp').hidden = false; inCmpQ();

  if (inS.mode === 'rol'){
    var r = inQ.role, da = inEtDiff(r.a), db = inEtDiff(r.b), sg = function(v){ return (v > 0 ? '+' : v < 0 ? '−' : '') + inF(Math.abs(v)); };
    var na = inToneName(r.ra, r.a), nb = inToneName(r.rb, r.b);
    $('inInfo').textContent = 'Zuiver als ' + inInt(r.a).nl.toLowerCase() + ' boven ' + inRootName(r.ra) + ' ligt ' + na + ' op ' + sg(da) + ' cent t.o.v. de piano; ' + (nb !== na ? 'als ' + nb + ' (dezelfde toets)' : 'als') + ' ' + inInt(r.b).nl.toLowerCase() + ' boven ' + inRootName(r.rb) + ' op ' + sg(db) + ' cent. '
      + (inQ.dev ? 'Hij was gestemd voor die tweede rol: ' + inF(Math.abs(db - da)) + ' cent te ' + (db > da ? 'hoog' : 'laag') + ' voor deze.' : 'Hij was goed gestemd voor deze rol.') + ' Daarom verschuif je op de viool dezelfde vinger een tikje, afhankelijk van de akkoorden of de drone eronder.';
    inStats(); inScoreUI(); return;
  }
  if (inS.mode === 'drie'){
    var x3 = inInt(inQ.md === 'min' ? 'k3' : 'g3'), dd3 = inEtDiff(x3.id), sys3 = inSysOf(inQ);
    $('inInfo').textContent = (sys3 === 'zuiver' ? 'In een reine ' + (inQ.md === 'min' ? 'mineur' : 'majeur') + '-drieklank ligt de ' + x3.nl.toLowerCase() + ' ' + inF(Math.abs(dd3)) + ' cent ' + (dd3 < 0 ? 'lager' : 'hoger') + ' dan op de piano en de kwint 2 cent hoger. ' : 'Stemming: ' + inSysName(sys3) + '. ')
      + 'In een strijkkwartet past vooral de speler van de terts zich aan: die toon bepaalt of een akkoord rust of schuurt. Een valse terts hoor je als een snel "rollen"; een valse kwint als een langzamer golven.';
    inStats(); inScoreUI(); return;
  }
  if (inS.mode === 'vals'){
    var bn = inQ.notes[inQ.bad];
    $('inInfo').textContent = 'Tip: let vooral op de noten die het dichtst bij de grondtoon liggen of er een halve toon van af zitten (mi–fa en ti–do): een valse terts of leidtoon valt het eerst op. ' + (bn.semis % 12 === 0 ? 'Deze keer was het de grondtoon zelf.' : 'Deze keer was het de ' + bn.x.nl.toLowerCase() + ' boven de grondtoon (' + bn.name + ').');
    inStats(); inScoreUI(); return;
  }
  var sys = inSysOf(inQ), c = inCents(sys, x, inQ.pc), et = x.semis === 12 ? 1200 : 100 * (x.semis % 12), just = inCents('zuiver', x, inQ.pc);
  var nm = x.nl.toLowerCase(), info, dd = function(v, ref){ var d = Math.round((v - ref) * 10) / 10; return Math.abs(d) < .05 ? 'gelijk aan ' : inF(Math.abs(d)) + ' cent ' + (d < 0 ? 'lager dan ' : 'hoger dan '); };
  if (x.semis % 12 === 0) info = 'Unisono en octaaf zijn in elk stemmingssysteem zuiver: het zweven (het golven in de klank) houdt helemaal op.';
  else info = 'In ' + (sys === 'werck' ? '' : 'de ') + inSysName(sys) + ' is de ' + nm + ' ' + inF(c) + ' cent: ' + dd(c, et) + 'de piano' + (sys === 'zuiver' ? '' : ', ' + dd(c, just) + 'rein (' + x.r[0] + ':' + x.r[1] + ')') + '.'
    + (sys === 'zuiver' ? ' Tegen een drone speel je hem zo: het zweven houdt dan op.' : Math.abs(c - just) < .05 ? ' Hier valt hij samen met rein, dus het zweven houdt helemaal op.' : (sys === 'werck' ? ' In Werckmeister hangt dat af van de toonsoort (hier ' + IN_NOTES[inQ.pc] + ').' : '') + ' Je hoort dus een beetje zweven, ook als hij goed is in dit systeem.');
  $('inInfo').textContent = info;
  inStats(); inScoreUI();
}
function inMeterTry(c){   // grijs streepje op de balk: wat je nu beluistert
  var m = $('inMeter'), t = m.querySelector('.intry'); if (!t || m.hidden) return;
  t.hidden = false; t.style.left = (50 + Math.max(-50, Math.min(50, c))) + '%';
}
function inMeter(dev, start){   // balk −50 … +50 cent met het antwoord (en bij zelf zetten waar hij begon)
  var m = $('inMeter'), cl = function(v){ return Math.max(-50, Math.min(50, v)); };
  m.hidden = false;
  m.querySelector('.inmark').style.left = (50 + cl(dev)) + '%';
  m.querySelector('.inmark').title = (dev > 0 ? '+' : '') + inF(dev) + ' cent';
  var s = m.querySelector('.instart'); s.hidden = start == null; if (start != null) s.style.left = (50 + cl(start)) + '%';
}
function inNudge(d){
  if (!inQ || inQ.done || inS.mode !== 'stem') return;
  inQ.dev = Math.max(-60, Math.min(60, inQ.dev + d));
  $('inSlider').value = Math.round(inQ.dev - inQ.off); inSetDev(inQ.dev);
  if (!inTone) inPlay(inQ.dev, true);
}

/* --- UI --- */
function inRenderQ(){
  var x = inInt(inQ.id);
  var sys = inSysOf(inQ), sysTxt = ' <button type="button" class="insys" data-sys="' + sys + '" title="Wat is dit? (klik voor uitleg)">' + inSysName(sys) + ' ⓘ</button>';
  var cTxt = inS.adapt ? ' <span class="muted">· verschil nu ' + inF(inQ.c) + ' cent</span>' : ' <span class="muted">· ' + inS.cents + ' cent</span>';
  if (inS.mode === 'vals'){
    $('inAsk').innerHTML = '<b>' + IN_VMAT[inQ.mat].replace(/^./, function(c){ return c.toUpperCase(); }) + '</b> op ' + IN_TON[inQ.md][inQ.pc] + sysTxt + cTxt + '<br><span class="muted">Welke noot is vals?</span>';
    $('inVals').innerHTML = inQ.notes.map(function(n, i){ return '<button type="button" data-i="' + i + '"><b>' + (i + 1) + '</b><span>' + n.name + '</span></button>'; }).join('');
    $('inVals').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ b.blur(); inVAnswer(+b.dataset.i); }; });
  } else if (inS.mode === 'drie') $('inAsk').innerHTML = '<b>' + IN_TON[inQ.md][inQ.pc] + '-' + (inQ.md === 'min' ? 'mineur' : 'majeur') + '</b>-drieklank (zonder drone)' + sysTxt + cTxt + '<br><span class="muted">De grondtoon klopt altijd. Is de terts of de kwint vals, of is alles zuiver?</span>';
  else if (inS.mode === 'rol'){
    var r = inQ.role;
    $('inAsk').innerHTML = '<b>' + inToneName(r.ra, r.a) + '</b> als <b>' + inInt(r.a).nl.toLowerCase() + '</b> boven ' + inRootName(r.ra) + ' <span class="muted">(drone)</span><br><span class="muted">Hij is zuiver gestemd voor deze rol, of voor een andere rol van dezelfde noot. Klopt hij hier?</span>';
  } else if (inS.mode === 'dubbel') $('inAsk').innerHTML = '<b>' + x.nl + '</b> samen, vanaf ' + IN_NOTES[inQ.pc] + ' (zonder drone)' + sysTxt + cTxt + '<br><span class="muted">Is de bovenste toon te laag, zuiver of te hoog?</span>';
  else $('inAsk').innerHTML = '<b>' + x.nl + '</b> boven ' + IN_NOTES[inQ.pc] + sysTxt + (inAsks() ? (inS.adapt ? ' <span class="muted">· verschil nu ' + inF(inQ.c) + ' cent</span>' : ' <span class="muted">· ' + inS.cents + ' cent</span>') : ' <span class="muted">· schuif tot hij ' + (sys === 'zuiver' ? 'zuiver' : 'goed') + ' is</span>');
  $('inMeter').hidden = true; $('inCmp').hidden = true; $('inInfo').textContent = '';
  document.querySelectorAll('#inCmpC button.on').forEach(function(x){ x.classList.remove('on'); }); var ty = document.querySelector('#inMeter .intry'); if (ty) ty.hidden = true;
  var sb = $('inAsk').querySelector('.insys'); if (sb) sb.onclick = function(){ sb.blur(); inSysInfo(sb.dataset.sys); };
  if (!$('inSysBox').hidden) inSysInfo(sys, true);
  document.querySelectorAll('#inKies button, #inDrie button').forEach(function(b){ b.classList.remove('right', 'wrong'); });
  if (inS.mode === 'stem'){ $('inSlider').value = Math.round(inQ.dev - inQ.off); }
  $('inStart').textContent = '▶ Nog eens';
}
var IN_SYSINFO = {
  zuiver:'<b>Reine stemming</b>: elk interval is een eenvoudige verhouding tussen de frequenties: octaaf 2:1, kwint 3:2, kwart 4:3, grote terts 5:4, kleine terts 6:5. Dan vallen de boventonen van de twee tonen precies samen en houdt het zweven op. Zo stemmen strijkers, zangers en blazers tegen een drone of in een akkoord. Nadeel: met vaste toetsen (piano) gaat dat niet in alle toonsoorten tegelijk.',
  gelijk:'<b>Gelijkzwevende stemming</b>: het octaaf is verdeeld in 12 precies gelijke halve tonen van 100 cent. Alle toonsoorten klinken daardoor hetzelfde. Alleen het octaaf is zuiver: kwinten zijn 2 cent te klein, grote tertsen 14 cent te groot, kleine tertsen 16 cent te klein. Sinds ongeveer 1850 de standaard voor piano, gitaar en elektronische instrumenten.',
  pyth:'<b>Pythagoreïsche stemming</b>: alles wordt opgebouwd uit zuivere kwinten (3:2), zoals een violist zijn snaren stemt (G–D–A–E). Kwinten en kwarten zijn dus helemaal zuiver, maar de grote terts komt op 408 cent (22 cent hoger dan rein) en de kleine terts op 294 cent (22 lager). Gebruikt in de middeleeuwen. Melodieën klinken er helder en spannend in, akkoorden ruw. Veel violisten spelen melodisch een beetje in deze richting: hoge grote tertsen en leidtonen.',
  midden:'<b>Middentoonstemming (¼-komma)</b>: elke kwint wordt 5,4 cent kleiner gemaakt, zodat vier kwinten op elkaar (C–G–D–A–E) precies een reine grote terts opleveren. Grote tertsen zijn dus zuiver, kwinten zweven een beetje. De stemming van de renaissance en vroege barok (1500–1700), bijvoorbeeld op orgels en klavecimbels. Nadeel: verre toonsoorten zijn onbruikbaar door de "wolfskwint".',
  werck:'<b>Werckmeister III</b> (Andreas Werckmeister, 1691) is een <i>welgetemperde</i> stemming: vier kwinten (C–G, G–D, D–A en B–Fis) zijn een kwart Pythagoreïsche komma (5,9 cent) kleiner, de andere acht zijn zuiver. Alle toonsoorten zijn bruikbaar, maar elk heeft een eigen karakter: in C-groot zijn de tertsen bijna rein, in Fis- of Cis-groot zo hoog als in de Pythagoreïsche stemming. De tijd van Bach. Hier hangt het goede antwoord dus ook af van de toonsoort van de drone.',
  mix:'<b>Wisselend</b>: elke vraag een ander systeem. Bij de vraag staat welk systeem het is; klik erop voor de uitleg.'
};
function inSysInfo(sys, keep){
  var b = $('inSysBox');
  if (!keep && !b.hidden && b.dataset.sys === sys){ b.hidden = true; return; }
  b.innerHTML = (IN_SYSINFO[sys] || '') + ' <button type="button" class="pttclr" title="Sluiten">✕</button>';
  b.dataset.sys = sys; b.hidden = false;
  b.querySelector('button').onclick = function(){ b.hidden = true; };
}
function inStatus(){
  var b = $('inDroneBtn'); if (!b) return;
  var on = !!inDr; b.textContent = on ? '⏹ Drone uit' : '🎻 Drone aan'; b.classList.toggle('on', on);
}
function inScoreUI(){
  $('inRight').textContent = inScore.right; $('inTotal').textContent = inScore.total; $('inStreak').textContent = inScore.streak;
  $('inToday').textContent = Score.today(inSid());
  $('inGrens').textContent = (inAsks() || inS.mode === 'drie' || inS.mode === 'vals') && inS.mode !== 'rol' && inS.adapt ? ' · je grens nu ±' + inF(inCurCents()) + ' cent' : '';
}
function inMijn(){   // jouw grens naast de tabel 'Hoe klein hoor je het?'
  var el = $('inMijnGrens'); if (!el) return;
  var k = inS.mode === 'stem' || inS.mode === 'rol' ? null : inLvKey(), c = k ? +inS.cur[k] : 0;
  if (!(c > 0) || !inS.adapt){ el.textContent = 'Oefen een tijdje Hoog, laag of zuiver? met "Automatisch aanpassen": dan staat hier jouw grens.'; return; }
  var cat = c <= 4 ? 'het niveau van een professionele violist (2–4 cent)' : c <= 10 ? 'het niveau van een gemiddelde muzikant (4–10 cent)' : c <= 28 ? 'iemand zonder training (12–28 cent); met een paar uur oefenen zakt dat meestal snel' : 'nog boven de meeste mensen; dat zakt snel als je een paar keer oefent';
  el.textContent = 'Jouw grens nu: ±' + inF(c) + ' cent (deze stand en stemming). Dat is ongeveer ' + cat + '.';
}
/* 📈 Je grens over tijd: per dag de grens aan het eind (lijn) en de laagste van die dag (stip), per stand + stemming.
   Eén reeks = geen legenda; de titel noemt hem. Hulplijnen op 4 en 10 cent (professioneel / gemiddelde muzikant). */
var IN_MNAME = { kies:'Hoog, laag of zuiver?', hoofd:'Uit je hoofd', dubbel:'Dubbelgreep', vals:'Wie is er vals?', drie:'Drieklank' };
function inKeyName(k){
  var p = k.split('|'), L = IN_LEVELS.find(function(l){ return l.id === p[0]; }), m = p.indexOf('hoofd') > 0 ? 'hoofd' : p.indexOf('dubbel') > 0 ? 'dubbel' : p.indexOf('vals') > 0 ? 'vals' : p.indexOf('drie') > 0 ? 'drie' : 'kies';
  return IN_MNAME[m] + ' · ' + (p[1] === 'mix' ? 'wisselend' : inSysName(p[1] || 'zuiver')) + (m === 'vals' || m === 'drie' ? '' : ' · ' + (L ? L.name.replace(/^\d+ · /, '') : 'eigen keuze')) + (p.indexOf('vib') > 0 ? ' · vibrato' : '') + (p[2] === 'sinus' ? ' · sinus' : '');
}
function inChart(key){
  var box = $('inChart'), sel = $('inChartKey'); if (!box) return;
  var keys = Object.keys(inS.hist || {}).filter(function(k){ return Object.keys(inS.hist[k]).length; });
  if (!keys.length){ sel.hidden = true; box.innerHTML = '<p class="muted">Nog geen gegevens. Oefen met <i>Automatisch aanpassen</i> aan; elke dag komt er een punt bij.</p>'; return; }
  var cur = inLvKey(); if (!key) key = inS.hist[cur] ? cur : (sel.value && inS.hist[sel.value] ? sel.value : keys[0]);
  sel.hidden = false;
  sel.innerHTML = keys.map(function(k){ return '<option value="' + k + '"' + (k === key ? ' selected' : '') + '>' + inKeyName(k) + '</option>'; }).join('');
  var h = inS.hist[key], days = Object.keys(h).sort(), pts = days.map(function(d){ return { d:d, l:h[d].l, m:h[d].m, n:h[d].n }; });
  var W = 640, H = 230, L = 40, R = 14, T = 14, B = 34, top = Math.max(12, Math.ceil(Math.max.apply(null, pts.map(function(p){ return p.l; })) / 5) * 5);
  var X = function(i){ return pts.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (pts.length - 1); }, Y = function(v){ return T + (1 - Math.min(v, top) / top) * (H - T - B); };
  var g = '', step = top <= 15 ? 5 : top <= 30 ? 10 : 20;
  for (var v = 0; v <= top; v += step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="incg"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" class="inct" text-anchor="end">' + v + '</text>';
  [[4, 'professioneel'], [10, 'muzikant']].forEach(function(r){ if (r[0] < top) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(r[0]) + '" y2="' + Y(r[0]) + '" class="incref"/><text x="' + (W - R) + '" y="' + (Y(r[0]) - 4) + '" class="inct" text-anchor="end">' + r[1] + ' (' + r[0] + ')</text>'; });
  var lab = function(d){ var p = d.split('-'); return +p[2] + '-' + +p[1]; }, every = Math.max(1, Math.ceil(pts.length / 7));
  pts.forEach(function(p, i){ if (i % every === 0 || i === pts.length - 1) g += '<text x="' + X(i) + '" y="' + (H - 12) + '" class="inct" text-anchor="middle">' + lab(p.d) + '</text>'; });
  var path = pts.map(function(p, i){ return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.l).toFixed(1); }).join(' ');
  var dots = pts.map(function(p, i){ return '<g class="inpt"><circle cx="' + X(i) + '" cy="' + Y(p.l) + '" r="4.5" class="incd"/><circle cx="' + X(i) + '" cy="' + Y(p.l) + '" r="12" class="inhit"><title>' + lab(p.d) + ': grens ' + inF(p.l) + ' cent (laagste die dag ' + inF(p.m) + ', ' + p.n + ' vragen)</title></circle></g>'; }).join('');
  var mins = pts.map(function(p, i){ return p.m < p.l - .05 ? '<circle cx="' + X(i) + '" cy="' + Y(p.m) + '" r="3" class="incmin"><title>laagste: ' + inF(p.m) + ' cent</title></circle>' : ''; }).join('');
  box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="inchart" role="img" aria-label="Je grens in cent per dag, lager is beter">' + g + (pts.length > 1 ? '<path d="' + path + '" class="incl"/>' : '') + mins + dots + '</svg>'
    + '<p class="muted inchartnote">Lager = beter. Lijn = je grens aan het eind van de dag, open stip = de laagste die dag. Beweeg over een punt voor de getallen.</p>'
    + '<table class="incents incttab"><thead><tr><th>Dag</th><th>Grens (cent)</th><th>Laagste</th><th>Vragen</th></tr></thead><tbody>' + pts.slice(-7).reverse().map(function(p){ return '<tr><td>' + lab(p.d) + '</td><td>' + inF(p.l) + '</td><td>' + inF(p.m) + '</td><td>' + p.n + '</td></tr>'; }).join('') + '</tbody></table>';
}
function inStats(){
  inMijn(); if ($('inChartBox') && $('inChartBox').open) inChart();
  var id = inSid(), t = Score.tally(id, 30), rows = [], tr = 0, tt = 0;
  IN_INTS.forEach(function(x){ var s = t[x.id]; if (!s) return; tr += s.r; tt += s.t; rows.push({ x:x, p:s.r / s.t, s:s }); });
  rows.sort(function(a, b){ return a.p - b.p; });
  $('inStatSum').textContent = '📊 Statistieken' + (tt ? ' · ' + Math.round(100 * tr / tt) + '% goed' : '') + (rows.length ? ' · zwakst: ' + rows.slice(0, 3).map(function(r){ return r.x.nl.toLowerCase(); }).join(', ') : '');
  $('inStats').innerHTML = rows.length ? rows.map(function(r){ return '<div class="instat"><span>' + r.x.nl + '</span><span class="muted">' + r.s.r + ' / ' + r.s.t + ' goed (' + Math.round(r.p * 100) + '%)</span></div>'; }).join('') : '<p class="muted">Nog niets geoefend in deze stand.</p>';
}
function inSyncUI(){
  $('inLevel').value = inS.level; $('inMode').value = inS.mode; $('inRef').value = inS.ref; $('inKeySel').value = String(inS.key);
  $('inKeyEvery').value = inS.keyEvery; $('inOct').value = String(inS.oct); $('inDInst').value = inS.dInst; $('inTInst').value = inS.tInst;
  $('inDVol').value = inS.dVol; $('inTVol').value = inS.tVol; $('inDur').value = inS.dur; $('inWait').value = inS.wait; $('inHold').value = inS.hold; $('inGap').value = inS.gap; $('inVMat').value = inS.vMat; $('inVDiff').value = inS.vDiff; $('inVib').checked = inS.vib; $('inVibD').value = inS.vibD; $('inVibR').value = inS.vibR; $('inAMd').value = inS.aMd; $('inVDrone').checked = inS.vDrone; $('inVNote').value = inS.vNote;
  $('inAdapt').checked = inS.adapt; $('inCents').value = inS.cents; $('inShare').value = inS.share; $('inTol').value = inS.tol; $('inAuto').checked = inS.auto;
  document.querySelectorAll('#inInts input').forEach(function(b){ b.checked = inS.ints.indexOf(b.dataset.i) >= 0; });
  document.querySelectorAll('#inModeSeg button').forEach(function(b){ b.classList.toggle('on', b.dataset.m === inS.mode); });
  var v = $('inView'); v.classList.toggle('stem', inS.mode === 'stem'); v.classList.toggle('kies', inAsks()); v.classList.toggle('vals', inS.mode === 'vals'); v.classList.toggle('drie', inS.mode === 'drie'); v.classList.toggle('hoofd', inS.mode === 'hoofd');
  $('inCentsRow').classList.toggle('dim', inS.adapt);
  $('inSinusTip').hidden = !(inS.tInst === 'sinus' || inS.dInst === 'sinus');
  inScoreUI(); inStats();
}
function inReset(){ inClear(); inToneStop(); inQ = null; inCount = 0; $('inAsk').innerHTML = 'Druk op <b>▶ Start</b>: eerst klinkt de drone, dan de toon.'; $('inMsg').textContent = ''; $('inMeter').hidden = true; $('inCmp').hidden = true; $('inInfo').textContent = ''; $('inStart').textContent = '▶ Start'; }
function inStopAll(){ inClear(); inToneStop(); inDroneStop(); inPaused = null; inPauseUI(); }
function inPause(){   // P: drone en toon even stil; nog eens P = verder waar je was
  if (inPaused){
    var p = inPaused; inPaused = null;
    if (p.drone) inDroneStart();
    if (p.hold && inQ && !inQ.done) inLater(function(){ inPlay(inQ.dev, true); }, 350);
    else if (p.ask && inQ && !inQ.done && inS.mode === 'hoofd') inHoofd();
    else if (inQ && !inQ.done && inS.mode === 'dubbel') inLater(function(){ inDyad(inQ.dev); }, 300);
    else if (inQ && !inQ.done && inS.mode === 'drie') inLater(function(){ inTriadQ(inQ.dev); }, 300);
    else if (inQ && !inQ.done && inS.mode === 'vals') inLater(function(){ inSeqPlay(false); }, inS.vDrone ? 900 : 300);
    else if (p.ask && inQ && !inQ.done) inLater(function(){ inPlay(inQ.dev, inS.mode === 'stem'); }, Math.max(.6, +inS.wait) * 1000);
    $('inMsg').textContent = ''; inPauseUI(); return;
  }
  if (!inDr && !inTone && !inTimers.length && !inSeq.length) return;
  var pending = inTimers.length > 0;
  inPaused = { drone:!!inDr, hold:inS.mode === 'stem' && !!inTone, ask:pending };
  inClear(); inToneStop(); inDroneStop();
  $('inMsg').textContent = '⏸ Pauze · ' + Keys.label('pauze') + ' = verder'; $('inMsg').className = 'qmsg muted';
  inPauseUI();
}
function inPauseUI(){ var b = $('inPauseBtn'); if (!b) return; b.textContent = inPaused ? '▶ Verder' : '⏸ Pauze'; b.classList.toggle('on', !!inPaused); }
function inOnRoute(){ if (typeof view !== 'undefined' && view !== 'intonatie'){ if (inDr || inTone) inStopAll(); } else { inSyncUI(); } }

function inInit(){
  inLoad();
  $('inLevel').innerHTML = IN_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen keuze…</option>';
  $('inKeySel').innerHTML = '<option value="rand">Wisselend</option>' + IN_NOTES.map(function(n, i){ return '<option value="' + i + '">' + n + '</option>'; }).join('');
  $('inInts').innerHTML = IN_INTS.map(function(x){ return '<label class="chip"><input type="checkbox" data-i="' + x.id + '"> ' + x.nl + '</label>'; }).join('');
  var save = function(){ inSave(); inSyncUI(); };
  $('inLevel').onchange = function(){
    var L = IN_LEVELS.find(function(l){ return l.id === $('inLevel').value; });
    if (L){ inS.level = L.id; inS.ints = L.ints.slice(); save(); inReset(); } else { inS.level = 'eigen'; save(); Paneel.set('inView', true); }
  };
  $('inInts').onchange = function(e){
    var b = e.target.closest('input[data-i]'); if (!b) return;
    var i = inS.ints.indexOf(b.dataset.i);
    if (!b.checked && i >= 0){ if (inS.ints.length > 1) inS.ints.splice(i, 1); }
    else if (b.checked && i < 0) inS.ints.push(b.dataset.i);
    inMatchLevel(); save();
  };
  var setMode = function(m){ if (inS.mode === m) return; inS.mode = m; save(); inReset(); };
  $('inMode').onchange = function(){ setMode($('inMode').value); };
  document.querySelectorAll('#inModeSeg button').forEach(function(b){ b.onclick = function(){ b.blur(); setMode(b.dataset.m); }; });
  $('inRef').onchange = function(){ inS.ref = $('inRef').value; save(); };
  $('inKeySel').onchange = function(){ var v = $('inKeySel').value; inS.key = v === 'rand' ? 'rand' : +v; save(); };
  $('inKeyEvery').onchange = function(){ inS.keyEvery = Math.max(1, Math.min(50, Math.round(+$('inKeyEvery').value || 6))); save(); };
  $('inOct').onchange = function(){ inS.oct = +$('inOct').value; save(); if (inDr) inDroneStart(); };
  $('inDInst').onchange = function(){ inS.dInst = $('inDInst').value; save(); if (inDr) inDroneStart(); };
  $('inTInst').onchange = function(){ inS.tInst = $('inTInst').value; save(); };
  $('inDVol').oninput = function(){ inS.dVol = +$('inDVol').value; if (inDr){ try { inDr.g.gain.setTargetAtTime(inS.dVol / 100 * (inS.dInst === 'sinus' ? .22 : .13), actx.currentTime, .05); } catch(e){} } };
  $('inDVol').onchange = function(){ inSave(); };
  $('inTVol').onchange = function(){ inS.tVol = +$('inTVol').value; inSave(); };
  $('inDur').onchange = function(){ inS.dur = Math.max(.8, Math.min(8, +$('inDur').value || 2.5)); save(); };
  $('inVMat').onchange = function(){ inS.vMat = $('inVMat').value; save(); };
  $('inVDiff').onchange = function(){ inS.vDiff = $('inVDiff').value; save(); };
  $('inVib').onchange = function(){ inS.vib = $('inVib').checked; save(); };
  $('inVibD').onchange = function(){ inS.vibD = Math.max(3, Math.min(60, +$('inVibD').value || 20)); save(); };
  $('inVibR').onchange = function(){ inS.vibR = Math.max(3, Math.min(8, +$('inVibR').value || 5.5)); save(); };
  $('inAMd').onchange = function(){ inS.aMd = $('inAMd').value; save(); };
  document.querySelectorAll('#inDrie button').forEach(function(b){ b.onclick = function(){ b.blur(); inAAnswer(b.dataset.a); }; });
  $('inChartKey').onchange = function(){ inChart($('inChartKey').value); };
  $('inChartBox').addEventListener('toggle', function(){ if ($('inChartBox').open) inChart(); });
  $('inVDrone').onchange = function(){ inS.vDrone = $('inVDrone').checked; save(); };
  $('inVNote').onchange = function(){ inS.vNote = Math.max(.25, Math.min(2, +$('inVNote').value || .6)); save(); };
  $('inHold').onchange = function(){ inS.hold = Math.max(1, Math.min(10, +$('inHold').value || 3)); save(); };
  $('inGap').onchange = function(){ inS.gap = Math.max(0, Math.min(15, +$('inGap').value || 0)); save(); };
  $('inWait').onchange = function(){ inS.wait = Math.max(0, Math.min(6, +$('inWait').value || 0)); save(); };
  $('inAdapt').onchange = function(){ inS.adapt = $('inAdapt').checked; save(); };
  $('inCents').onchange = function(){ inS.cents = Math.max(1, Math.min(50, Math.round(+$('inCents').value || 20))); save(); };
  $('inShare').onchange = function(){ inS.share = Math.max(0, Math.min(80, Math.round(+$('inShare').value || 0))); save(); };
  $('inTol').onchange = function(){ inS.tol = Math.max(1, Math.min(25, Math.round(+$('inTol').value || 5))); save(); };
  $('inAuto').onchange = function(){ inS.auto = $('inAuto').checked; save(); };
  $('inStart').onclick = function(){ this.blur(); if (!inQ || inQ.dummy || (inQ.done && inS.mode === 'stem')) inNew(); else if (inS.mode === 'dubbel') inDyad(inQ.dev); else if (inS.mode === 'drie') inTriadQ(inQ.dev); else if (inS.mode === 'vals') inSeqPlay(false); else if (inS.mode === 'hoofd' && !inQ.done) inHoofd(); else if (inS.mode === 'hoofd') inWithDrone(inQ.dev); else inPlay(inQ.dev, inS.mode === 'stem' && !inQ.done); };
  $('inNext').onclick = function(){ this.blur(); inPaused = null; inPauseUI(); inNew(); };
  $('inPauseBtn').onclick = function(){ this.blur(); inPause(); };
  $('inDroneBtn').onclick = function(){ this.blur(); if (inDr) inStopAll(); else { if (!inQ) inQ = { id:inS.ints[0], pc:inS.key === 'rand' ? 0 : +inS.key, dev:0, done:true, dummy:true }; inDroneStart(); } };
  document.querySelectorAll('#inKies button').forEach(function(b){ b.onclick = function(){ b.blur(); inAnswer(b.dataset.a); }; });
  $('inSlider').oninput = function(){ if (!inQ || inQ.done) return; inQ.dev = +$('inSlider').value + inQ.off; inSetDev(inQ.dev); if (!inTone) inPlay(inQ.dev, true); };
  document.querySelectorAll('#inSteps button[data-d]').forEach(function(b){ b.onclick = function(){ b.blur(); inNudge(+b.dataset.d); }; });   // vaste stapjes in cent
  $('inCheck').onclick = function(){ this.blur(); inCheck(); };
  // na het antwoord: elke afwijking zelf beluisteren (zelfde manier als de vraag: met drone, als dubbelgreep of in de reeks)
  $('inCmpQ').onclick = function(e){
    var rb = e.target.closest('button[data-role]');
    if (rb && inQ){ rb.blur(); document.querySelectorAll('#inCmpC button, #inCmpQ button').forEach(function(x){ x.classList.toggle('on', x === rb); }); inRolePlay(rb.dataset.role); return; }
    $('inCmpC').onclick(e);
  };
  $('inCmpC').onclick = function(e){
    var b = e.target.closest('button[data-c]'); if (!b || !inQ) return; b.blur();
    var c = +b.dataset.c;
    document.querySelectorAll('#inCmpC button, #inCmpQ button').forEach(function(x){ x.classList.toggle('on', x === b); });
    if (inS.mode === 'dubbel') inDyad(c);
    else if (inS.mode === 'drie') inTriadQ(c);
    else if (inS.mode === 'rol'){ inClear(); inToneStop(); inDroneStart(inHz(inQ.role.ra)); inLater(function(){ inPlay(c, false); }, 600); }
    else if (inS.mode === 'vals'){ var keep = inQ.dev; inQ.dev = c; inSeqPlay(c === 0); inQ.dev = keep; }
    else inWithDrone(c);
    if (inS.mode !== 'vals') inMeterTry(c);
  };
  $('inStatReset').onclick = function(){ Score.clear(inSid()); inStats(); };
  document.addEventListener('keydown', function(e){
    if (typeof view === 'undefined' || view !== 'intonatie' || Keys.blocked(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (Keys.is(e, 'stop')){ inStopAll(); return; }
    if (Keys.is(e, 'grondtoon')){ e.preventDefault(); $('inDroneBtn').click(); return; }
    if (Keys.is(e, 'pauze')){ e.preventDefault(); inPause(); return; }
    if (Keys.is(e, 'luister')){ e.preventDefault(); $('inStart').click(); return; }
    if (inS.mode === 'drie'){
      if (e.key === '1'){ inAAnswer('terts'); return; }
      if (e.key === '2'){ inAAnswer('kwint'); return; }
      if (e.key === '3'){ inAAnswer('geen'); return; }
      if (Keys.is(e, 'volgende')){ e.preventDefault(); if (!inQ || inQ.done) inNew(); return; }
    } else if (inS.mode === 'vals'){
      if (/^[1-9]$/.test(e.key)){ var n = +e.key - 1; if (inQ && n < (inQ.notes || []).length) inVAnswer(n); return; }
      if (Keys.is(e, 'volgende')){ e.preventDefault(); if (!inQ || inQ.done) inNew(); return; }
    } else if (inAsks()){
      if (e.key === '1'){ inAnswer('laag'); return; }
      if (e.key === '2'){ inAnswer('zuiver'); return; }
      if (e.key === '3'){ inAnswer('hoog'); return; }
      if (Keys.is(e, 'volgende')){ e.preventDefault(); if (!inQ || inQ.done) inNew(); return; }
    } else {
      if (e.key === 'ArrowUp'){ e.preventDefault(); inNudge(e.shiftKey ? 5 : 1); return; }
      if (e.key === 'ArrowDown'){ e.preventDefault(); inNudge(e.shiftKey ? -5 : -1); return; }
      if (Keys.is(e, 'controleer') || Keys.is(e, 'volgende')){ e.preventDefault(); if (!inQ) inNew(); else inCheck(); return; }
    }
  });
  inSyncUI(); inReset();
  if (typeof Keys !== 'undefined' && Keys.apply) Keys.apply($('inView'));
}
inInit();
