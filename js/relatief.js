/* ================= Relatief gehoor (trappen in een toonsoort) ================= */
var GDEG = [
  { n:'1',  sol:'do'  }, { n:'♭2', sol:'ra' }, { n:'2',  sol:'re' }, { n:'♭3', sol:'me' },
  { n:'3',  sol:'mi'  }, { n:'4',  sol:'fa' }, { n:'♯4', sol:'fi' }, { n:'5',  sol:'sol' },
  { n:'♭6', sol:'le'  }, { n:'6',  sol:'la' }, { n:'♭7', sol:'te' }, { n:'7',  sol:'ti' }
];
var GSCALE = { maj:[0,2,4,5,7,9,11], min:[0,2,3,5,7,8,10] };
var GALL = [0,1,2,3,4,5,6,7,8,9,10,11];
var GLEVELS = [
  { id:'l1', name:'1 · do, mi, sol',            mode:'maj', set:[0,4,7] },
  { id:'l2', name:'2 · do t/m sol',              mode:'maj', set:[0,2,4,5,7] },
  { id:'l3', name:'3 · hele majeurladder',       mode:'maj', set:[0,2,4,5,7,9,11] },
  { id:'l4', name:'4 · mineur: do, me, sol',     mode:'min', set:[0,3,7] },
  { id:'l5', name:'5 · hele mineurladder',       mode:'min', set:[0,2,3,5,7,8,10] },
  { id:'l6', name:'6 · mineur + leidtoon',       mode:'min', set:[0,2,3,5,7,8,10,11] },
  { id:'l7', name:'7 · chromatisch in majeur',   mode:'maj', set:GALL },
  { id:'l8', name:'8 · chromatisch in mineur',   mode:'min', set:GALL }
];
var GKEYS = [0,7,2,9,4,5,10,3,8];   // C G D A E F Bes Es As
var GN_SH = ['c','cis','d','dis','e','f','fis','g','gis','a','ais','b'];
var GN_FL = ['c','des','d','es','e','f','ges','g','as','a','bes','b'];
var GSET_KEY = 'gehoor-settings';
var gS = null, gQ = null, gTimers = [], gScore = { right:0, total:0, streak:0 };

function gDefaults(){ return { level:'l1', mode:'maj', set:[0,4,7], key:'rand', keyEvery:10, len:1, range:'oct', timbre:'piano', cadQ:true, resolve:true, auto:true, drone:false, hoogte:'midden', clefs:['g'], up:2, down:2, acc:false, dbl:false, keysig:false, keys:[] }; }
function gLoad(){
  var s = {};
  try { s = JSON.parse(localStorage.getItem(GSET_KEY)) || {}; } catch(e){}
  gS = Object.assign(gDefaults(), s);
  gS.drone = false;
  gS.timbre = Engine.instId(gS.timbre);
  if (!Array.isArray(gS.set) || !gS.set.length) gS.set = [0,4,7];
  if (gS.hoogte !== 'balk') gS.hoogte = 'midden';
  gS.bpm = gehBpmFix(gS.bpm, 100);
  if (!Array.isArray(gS.clefs) || !gS.clefs.length) gS.clefs = ['g'];
}
function gSave(){ try { localStorage.setItem(GSET_KEY, JSON.stringify(gS)); } catch(e){} }
function gStats(){   // uit het gedeelde logboek (score.js): {maj:{trap:{r,t}}, min:{...}}
  var t = Score.tally('gehoor'), s = { maj:{}, min:{} };
  Object.keys(t).forEach(function(k){ var p = k.split(':'); if (s[p[0]]) s[p[0]][p[1]] = t[k]; });
  return s;
}
Score.def('gehoor', {
  name:'Relatief gehoor', view:'gehoor',
  label:function(k){ var p = k.split(':'), g = GDEG[+p[1]]; return (p[0] === 'maj' ? 'majeur' : 'mineur') + ' · trap ' + g.n + ' (' + g.sol + ')'; },
  level:function(){ return gS.level + '|' + gS.len; },
  levelName:function(lv){ var p = lv.split('|'), L = GLEVELS.find(function(l){ return l.id === p[0]; }); return (L ? 'niveau ' + L.name : 'eigen instelling') + (+p[1] > 1 ? ', ' + p[1] + ' tonen' : ''); },
  next:function(lv){ var p = lv.split('|'), i = GLEVELS.findIndex(function(l){ return l.id === p[0]; });
    return i >= 0 && i < GLEVELS.length - 1 ? 'niveau ' + GLEVELS[i + 1].name : +p[1] < 5 ? 'melodieën van ' + (+p[1] + 1) + ' tonen' : 'houd dit vast en ga naar dictee'; }
});

/* --- namen --- */
function gFlats(pc, mode){ return mode === 'maj' ? [5,10,3,8,1,6].indexOf(pc) >= 0 : [9,4,11,6,1,8].indexOf(pc) < 0; }
function gCap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function gKeyName(pc, mode){ var n = (gFlats(pc, mode) ? GN_FL : GN_SH)[pc]; return mode === 'maj' ? gCap(n) + '-groot' : n + '-klein'; }
var GLET = ['c','d','e','f','g','a','b'], GLET_PC = [0,2,4,5,7,9,11], GSTEP = [0,1,1,2,2,3,3,4,5,5,6,6];
function gNoteName(midi){
  // spel de toon vanuit de toonsoort: trap 3 in Es-groot is G, ♯4 in C is Fis, ti in g-klein is Fis
  var tonic = (gFlats(gQ.pc, gS.mode) ? GN_FL : GN_SH)[gQ.pc];
  var li = (GLET.indexOf(tonic.charAt(0)) + GSTEP[gDeg(midi)]) % 7, L = GLET[li];
  var acc = ((((midi % 12) + 12) % 12) - GLET_PC[li] + 18) % 12 - 6;
  var n = acc === 1 ? L + 'is' : acc === 2 ? L + 'isis' : acc === -2 ? L + 'eses'
        : acc === -1 ? (L === 'e' || L === 'a' ? L + 's' : L + 'es') : L;
  return gCap(n);
}
function gLab(d){ return 'trap ' + GDEG[d].n + ' (' + GDEG[d].sol + ')'; }
function gDeg(m){ return ((m - gQ.T) % 12 + 12) % 12; }

/* --- klank --- */
function gOut(){ return Engine.out(); }
function gStopNotes(){ (gTimers || []).forEach(clearTimeout); gTimers = []; Engine.stopNotes(); }
function gNote(t, midi, dur, vol, timbre){ Engine.note(t, midi, dur, { inst:timbre, vol:vol }); }
function gChord(t, midis, dur){ Engine.chord(t, midis, dur, { inst:'piano' }); }
function gCadence(t){ return Engine.cadence(t, gQ.T, gS.mode); }
function gDroneOn(){
  if (!gQ || gQ.T == null){ Engine.drone.stop(); return; }
  Engine.drone.start(gQ.T - 12, { fifth:true });
}
function gDroneOff(){ Engine.drone.stop(); }
function gOnRoute(){
  if (typeof view !== 'undefined' && view !== 'gehoor'){
    gDroneOff();
    if (gS){ gS.drone = false; var c = $('gDroneChk'); if (c) c.checked = false; }
  }
}

/* --- vragen maken --- */
function gTonicMidi(pc){
  var T = 55 + ((pc - 7 + 12) % 12);               // midden: grondtoon tussen G3 en Fis4
  gQ.w = null;
  if (gS.hoogte === 'balk'){                       // volgens sleutel + hulplijnen: het hele bereik binnen de balk
    var c = gS.clefs[Math.floor(Math.random() * gS.clefs.length)], w = Theorie.window(c, gS.up, gS.down);
    var r = gS.range === 'rond' ? [-5, 7] : gS.range === 'twee' ? [-12, 12] : [0, 12];
    T += 12 * Theorie.fitOctave(T + r[0], T + r[1], w);
    gQ.w = w;
  }
  return T;
}
function gRange(){ var T = gQ.T; return gS.range === 'rond' ? [T - 5, T + 7] : gS.range === 'twee' ? [T - 12, T + 12] : [T, T + 12]; }
function gCands(d){ var r = gRange(), w = gQ.w, out = [], all = []; for (var m = r[0]; m <= r[1]; m++) if (gDeg(m) === d){ all.push(m); if (!w || (m >= w.lo && m <= w.hi)) out.push(m); } return out.length ? out : all; }
function gClosest(arr, ref){ return arr.reduce(function(a, b){ return Math.abs(b - ref) < Math.abs(a - ref) ? b : a; }); }
function gWeighted(set, avoid){
  var st = gStats()[gS.mode];
  var items = set.length > 1 ? set.filter(function(d){ return d !== avoid; }) : set;
  var ws = items.map(function(d){ var s = st[d]; var err = s ? (s.t - s.r + 1) / (s.t + 2) : .5; return .25 + err * 2; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum;
  for (var i = 0; i < items.length; i++){ r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function gNew(autoplay){
  stop(); Score.ask('gehoor');
  if (!gS.set.length) gS.set = [0];
  var changed = false;
  if (gS.key !== 'rand'){
    var fixed = +gS.key;
    if (gQ.pc !== fixed){ gQ.pc = fixed; changed = true; }
  } else if (gQ.pc == null || gQ.sinceKey >= gS.keyEvery){
    var pc, k = 0;
    do { pc = pick(GKEYS); } while (pc === gQ.pc && k++ < 20);
    gQ.pc = pc; changed = true;
  }
  if (gQ.mode !== gS.mode){ gQ.mode = gS.mode; changed = true; }
  var hk = gS.hoogte === 'balk' ? gS.clefs.join() + gS.up + gS.down + gS.range : 'm';
  if (gQ.hk !== hk){ gQ.hk = hk; changed = true; }
  if (changed){ gQ.T = gTonicMidi(gQ.pc); gQ.sinceKey = 0; if (gS.drone) gDroneOn(); }
  gQ.sinceKey++;
  var notes = [], prev = null, prevD = null;
  for (var i = 0; i < gS.len; i++){
    var d = gWeighted(gS.set, prevD), c = gCands(d);
    var m = prev == null ? pick(c) : gClosest(c, prev);
    notes.push({ d:d, m:m }); prev = m; prevD = d;
  }
  gQ.target = notes; gQ.ans = []; gQ.answered = false;
  gQ.cadPending = gS.cadQ || changed;
  $('gKeyName').textContent = gKeyName(gQ.pc, gS.mode);
  var msg = $('gMsg');
  msg.className = 'qmsg';
  msg.textContent = changed ? 'Nieuwe toonsoort: ' + gKeyName(gQ.pc, gS.mode) + '. Luister eerst goed naar de cadens.' : '';
  gRenderPad(); gRenderSlots();
  if (autoplay) gPlayQ();
}

/* --- afspelen --- */
function gPlayQ(){
  if (!gQ || !gQ.target) return;
  Score.heard('gehoor');
  stop(); ensureCtx();
  var t = actx.currentTime + .08;
  if (gQ.cadPending){ t += gCadence(t); gQ.cadPending = false; }
  var nd = gS.len === 1 ? .9 : 60 / gS.bpm;   // melodietjes: tempo instelbaar (standaard 100 ≈ het oude vaste tempo)
  gQ.target.forEach(function(n, i){ gNote(t + i * nd, n.m, nd * .92, .42, gS.timbre); });
  return t + gQ.target.length * nd;
}
function gPlayCad(){ if (!gQ || gQ.T == null) return; stop(); ensureCtx(); gCadence(actx.currentTime + .08); }
function gPlayDo(){ if (!gQ || gQ.T == null) return; stop(); ensureCtx(); gNote(actx.currentTime + .05, gQ.T, 1.1, .42, gS.timbre); }
function gResPath(m){
  var d = gDeg(m), base = m - d, sc = GSCALE[gS.mode], path = [m];
  if (d === 0) return path;
  if (d >= 6){ sc.forEach(function(s){ if (s > d) path.push(base + s); }); path.push(base + 12); }
  else { sc.slice().reverse().forEach(function(s){ if (s < d) path.push(base + s); }); }
  return path;
}
function gPlayPath(path, t){
  path.forEach(function(m, i){
    var first = i === 0, last = i === path.length - 1;
    gNote(t, m, first ? .7 : last ? .9 : .34, .42, gS.timbre);
    t += first ? .8 : .38;
  });
  return t + .6;
}

/* --- antwoorden --- */
function gAnswer(d){
  if (!gQ || !gQ.target) return;
  if (gQ.answered){
    // na het antwoord: klik op een trap om hem te horen en te vergelijken
    var ref = gQ.target[gQ.target.length - 1].m, m = gClosest(gCands(d), ref);
    stop(); ensureCtx();
    var t = actx.currentTime + .05;
    if (gS.resolve) gPlayPath(gResPath(m), t); else gNote(t, m, .9, .42, gS.timbre);
    return;
  }
  var i = gQ.ans.length, ok = gQ.target[i].d === d;
  gQ.ans.push(d);
  if (gS.len > 1){
    var cands = gCands(d), prevM = i ? gQ.target[i - 1].m : gQ.target[0].m;
    ensureCtx(); gNote(actx.currentTime + .02, gClosest(cands, prevM), .35, .3, gS.timbre);
    gMark(d, ok ? 'right' : 'wrong', true);
  }
  gRenderSlots();
  if (gQ.ans.length === gQ.target.length) gFinish();
}
function gFinish(){
  gQ.answered = true;
  var tg = gQ.target, an = gQ.ans;
  var okAll = tg.every(function(n, i){ return n.d === an[i]; });
  var qtxt = gKeyName(gQ.pc, gS.mode) + ': ' + tg.map(function(x){ return GDEG[x.d].sol; }).join(' ');
  Score.log('gehoor', tg.map(function(n, i){ return { k:gS.mode + ':' + n.d, q:qtxt, a:GDEG[an[i]].sol, ok:an[i] === n.d }; }));
  gScore.total++; if (okAll){ gScore.right++; gScore.streak++; } else gScore.streak = 0;
  $('gRight').textContent = gScore.right; $('gTotal').textContent = gScore.total; $('gStreak').textContent = gScore.streak;
  $('gToday').textContent = Score.today('gehoor');

  var msg = $('gMsg');
  msg.className = 'qmsg ' + (okAll ? 'good' : 'bad');
  if (tg.length === 1){
    var n = tg[0];
    msg.textContent = okAll
      ? 'Goed! ' + gCap(gLab(n.d)) + ', de ' + gNoteName(n.m) + ' in ' + gKeyName(gQ.pc, gS.mode) + '.'
      : 'Het was ' + gLab(n.d) + ', de ' + gNoteName(n.m) + '. Jij koos ' + gLab(an[0]) + '. Klik op de knoppen om ze te vergelijken.';
    gMark(n.d, 'right');
    if (!okAll) gMark(an[0], 'wrong');
  } else {
    var seq = tg.map(function(x){ return GDEG[x.d].sol; }).join(' – ') + ' (' + tg.map(function(x){ return gNoteName(x.m); }).join(' ') + ')';
    msg.textContent = (okAll ? 'Goed! ' : 'Juist was: ') + seq + (okAll ? '' : '. ' + Keys.label('luister') + ' = melodie nog eens horen.');
  }
  gRenderSlots(); gRenderStats();

  stop(); ensureCtx();
  var t = actx.currentTime + .25, end;
  if (tg.length === 1) end = gS.resolve ? gPlayPath(gResPath(tg[0].m), t) : (gNote(t, tg[0].m, .9, .42, gS.timbre), t + 1);
  else { var d = 60 / gS.bpm; tg.forEach(function(x, i){ gNote(t + i * d, x.m, d * .92, .42, gS.timbre); }); end = t + tg.length * d + .4; }
  if (okAll && gS.auto) gTimers.push(setTimeout(function(){ gNew(true); }, Math.max(300, (end - actx.currentTime) * 1000 + 350)));
}

/* --- tekenen --- */
function gMark(d, cls, flash){
  var b = document.querySelector('#gehoorView .gbtn[data-d="' + d + '"]');
  if (!b) return;
  b.classList.add(cls);
  if (flash) setTimeout(function(){ b.classList.remove(cls); }, 350);
}
function gRenderPad(){
  var mk = function(d){
    var b = document.createElement('button'); b.type = 'button';
    if (d == null){ b.className = 'gbtn off'; return b; }
    var g = GDEG[d];
    b.className = 'gbtn' + ([1,3,6,8,10].indexOf(d) >= 0 ? ' chrom' : '') + (gS.set.indexOf(d) >= 0 ? '' : ' off');
    b.dataset.d = d;
    b.innerHTML = g.n + '<small>' + g.sol + '</small>';
    b.onclick = function(){ b.blur(); gAnswer(d); };
    return b;
  };
  var top = $('gTop'), bot = $('gBot');
  top.innerHTML = ''; bot.innerHTML = '';
  [1,3,null,6,8,10].forEach(function(d){ top.appendChild(mk(d)); });
  [0,2,4,5,7,9,11].forEach(function(d){ bot.appendChild(mk(d)); });
  var anyChrom = [1,3,6,8,10].some(function(d){ return gS.set.indexOf(d) >= 0; });
  top.style.display = anyChrom ? '' : 'none';
}
function gRenderSlots(){
  var box = $('gSlots'); box.innerHTML = '';
  if (!gQ.target || gQ.target.length < 2){ box.style.display = 'none'; return; }
  box.style.display = '';
  gQ.target.forEach(function(n, i){
    var s = document.createElement('div'), a = gQ.ans[i];
    s.className = 'gslot';
    if (a == null){ s.textContent = '?'; if (i === gQ.ans.length && !gQ.answered) s.classList.add('cur'); }
    else {
      s.classList.add(a === n.d ? 'right' : 'wrong');
      s.innerHTML = GDEG[a].sol + (gQ.answered && a !== n.d ? '<small>' + GDEG[n.d].sol + '</small>' : '');
    }
    box.appendChild(s);
  });
}
function gRenderStats(){
  var st = gStats(), rows = [];
  ['maj','min'].forEach(function(mode){
    Object.keys(st[mode]).forEach(function(d){
      var s = st[mode][d]; if (!s.t) return;
      rows.push({ label:(mode === 'maj' ? 'Majeur' : 'Mineur') + ' · ' + GDEG[d].n + ' ' + GDEG[d].sol, r:s.r, t:s.t, p:s.r / s.t });
    });
  });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  $('gStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div></div>'; }).join('')
    : '<p class="note">Nog geen antwoorden. De trap die je het vaakst mist komt hier bovenaan, en die krijg je ook vaker als vraag.</p>';
}
function gFillKeys(){
  var sel = $('gKey');
  sel.innerHTML = '<option value="rand">willekeurig</option>' + GKEYS.map(function(pc){ return '<option value="' + pc + '">' + gKeyName(pc, gS.mode) + '</option>'; }).join('');
  sel.value = String(gS.key);
}
function gSyncUI(){
  $('gLevel').value = gS.level;
  $('gMode').value = gS.mode;
  gFillKeys();
  $('gKeyEvery').value = String(gS.keyEvery);
  $('gLen').value = String(gS.len);
  $('gRange').value = gS.range; $('gHoogte').value = gS.hoogte; $('gBpm').value = String(gS.bpm); $('gBereik').classList.toggle('hoff', gS.hoogte !== 'balk'); if (window.gBUI) gBUI.sync();
  $('gTimbre').value = gS.timbre;
  $('gCadQ').checked = gS.cadQ; $('gResolve').checked = gS.resolve; $('gAuto').checked = gS.auto; $('gDroneChk').checked = gS.drone;
  document.querySelectorAll('#gChips input').forEach(function(inp){ inp.checked = gS.set.indexOf(+inp.value) >= 0; });
}
function gMatchLevel(){
  var key = gS.mode + ':' + gS.set.slice().sort(function(a, b){ return a - b; }).join(',');
  var L = GLEVELS.find(function(l){ return l.mode + ':' + l.set.join(',') === key; });
  gS.level = L ? L.id : 'eigen';
  $('gLevel').value = gS.level;
}
function gKeyToDeg(n){
  var d = GSCALE[gS.mode][n - 1];
  if (gS.set.indexOf(d) >= 0) return d;
  var alt = [d + 1, d - 1].filter(function(x){ return x >= 0 && x < 12 && gS.set.indexOf(x) >= 0 && GDEG[x].n.replace(/[♭♯]/, '') === String(n); });
  return alt.length ? alt[0] : null;
}

function gInit(){
  gLoad();
  gQ = { pc:null, T:null, mode:null, sinceKey:0 };
  $('gLevel').innerHTML = GLEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie</option>';
  $('gLen').innerHTML = [1,2,3,4,5].map(function(n){ return '<option value="' + n + '">' + (n === 1 ? '1 toon' : n + ' tonen (melodie)') + '</option>'; }).join('');
  $('gChips').innerHTML = GDEG.map(function(g, d){ return '<label class="chip"><input type="checkbox" value="' + d + '"> ' + g.n + ' <span class="muted">' + g.sol + '</span></label>'; }).join('');
  gSyncUI();

  var changed = function(renew){ gSave(); if (renew) gNew(false); };
  $('gLevel').onchange = function(e){
    var L = GLEVELS.find(function(l){ return l.id === e.target.value; });
    gS.level = e.target.value;
    if (L){ gS.mode = L.mode; gS.set = L.set.slice(); }
    gSyncUI(); changed(true);
  };
  $('gMode').onchange = function(e){ gS.mode = e.target.value; gFillKeys(); gMatchLevel(); changed(true); };
  $('gChips').onchange = function(){
    var set = [];
    document.querySelectorAll('#gChips input:checked').forEach(function(inp){ set.push(+inp.value); });
    if (!set.length){ set = [0]; document.querySelector('#gChips input[value="0"]').checked = true; }
    gS.set = set.sort(function(a, b){ return a - b; });
    gMatchLevel(); changed(true);
  };
  $('gKey').onchange = function(e){ gS.key = e.target.value === 'rand' ? 'rand' : +e.target.value; changed(true); };
  $('gKeyEvery').onchange = function(e){ gS.keyEvery = +e.target.value; changed(false); };
  $('gLen').onchange = function(e){ gS.len = +e.target.value; changed(true); };
  $('gRange').onchange = function(e){ gS.range = e.target.value; changed(true); };
  gehBpmFill($('gBpm')); $('gBpm').value = String(gS.bpm);
  $('gBpm').onchange = function(e){ gS.bpm = +e.target.value; changed(false); };
  $('gHoogte').onchange = function(e){ gS.hoogte = e.target.value; gSyncUI(); changed(true); };
  document.addEventListener('DOMContentLoaded', function(){ window.gBUI = nlBereikUI($('gBereik'), gS, function(){ changed(true); }, { clefsLedger:true }); gSyncUI(); });
  $('gTimbre').onchange = function(e){ gS.timbre = e.target.value; changed(false); };
  $('gCadQ').onchange = function(e){ gS.cadQ = e.target.checked; changed(false); };
  $('gResolve').onchange = function(e){ gS.resolve = e.target.checked; changed(false); };
  $('gAuto').onchange = function(e){ gS.auto = e.target.checked; changed(false); };
  $('gDroneChk').onchange = function(e){ gS.drone = e.target.checked; if (gS.drone) gDroneOn(); else gDroneOff(); };
  document.querySelectorAll('#gehoorView select, #gehoorView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });

  $('gPlay').onclick = function(){ this.blur(); gPlayQ(); };
  $('gCad').onclick = function(){ this.blur(); gPlayCad(); };
  $('gDo').onclick = function(){ this.blur(); gPlayDo(); };
  $('gNext').onclick = function(){ this.blur(); gNew(true); };
  $('gReset').onclick = function(){ Score.clear('gehoor'); gRenderStats(); $('gToday').textContent = 0; };

  $('gToday').textContent = Score.today('gehoor');
  gNew(false);
  gRenderStats();
}
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || view !== 'gehoor' || !gQ) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (Keys.blocked(e)) return;
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) gPlayQ(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); gNew(true); }
  else if (Keys.is(e, 'cadens')) gPlayCad();
  else if (Keys.is(e, 'grondtoon')) gPlayDo();
  else if (/^[1-7]$/.test(e.key)){ var d = gKeyToDeg(+e.key); if (d != null) gAnswer(d); }
});
document.addEventListener('keyup', function(e){
  if (typeof view !== 'undefined' && view === 'gehoor' && (e.key === ' ' || e.code === 'Space')) e.preventDefault();
});
gInit();


