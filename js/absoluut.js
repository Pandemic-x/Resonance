/* ================= Absoluut gehoor ================= */
var AN = ['C','Cis','D','Dis','E','F','Fis','G','Gis','A','Ais','B'];
var AN_ALT = [null,'Des',null,'Es',null,null,'Ges',null,'As',null,'Bes',null];
var AINST = Engine.INSTRUMENTS;
var ALEVELS = [
  { id:'a1', name:'1 · C en Fis',           set:[0,6] },
  { id:'a2', name:'2 · C, E en G',          set:[0,4,7] },
  { id:'a3', name:'3 · C, D, E, G, A',      set:[0,2,4,7,9] },
  { id:'a4', name:'4 · alle witte toetsen', set:[0,2,4,5,7,9,11] },
  { id:'a5', name:'5 · alle zwarte toetsen', set:[1,3,6,8,10] },
  { id:'a6', name:'6 · alle 12 tonen',      set:[0,1,2,3,4,5,6,7,8,9,10,11] }
];
var ASET_KEY = 'absoluut-settings';
var aS = null, aQ = null, aTimers = [], aScore = { right:0, total:0, streak:0 };

function aDefaults(){ return { level:'a4', set:[0,2,4,5,7,9,11], insts:['piano'], lo:48, hi:84, octave:false, auto:true, noise:false, explore:false }; }
function aLoad(){
  var s = {};
  try { s = JSON.parse(localStorage.getItem(ASET_KEY)) || {}; } catch(e){}
  aS = Object.assign(aDefaults(), s);
  aS.explore = false;
  if (!Array.isArray(aS.set) || !aS.set.length) aS.set = [0,2,4,5,7,9,11];
  if (!Array.isArray(aS.insts) || !aS.insts.length) aS.insts = ['piano'];
}
function aSave(){ try { localStorage.setItem(ASET_KEY, JSON.stringify(aS)); } catch(e){} }
function aStats(){ return Score.tally('absoluut'); }   // {pc:{r,t}} uit het gedeelde logboek
Score.def('absoluut', {
  name:'Absoluut gehoor', view:'absoluut',
  label:function(k){ return 'noot ' + aName(+k); },
  level:function(){ return aS.level + (aS.octave ? '|oct' : ''); },
  levelName:function(lv){ var p = lv.split('|'), L = ALEVELS.find(function(l){ return l.id === p[0]; }); return (L ? 'niveau ' + L.name : 'eigen instelling') + (p[1] ? ', met octaaf' : ''); },
  next:function(lv){ var p = lv.split('|'), i = ALEVELS.findIndex(function(l){ return l.id === p[0]; });
    return i >= 0 && i < ALEVELS.length - 1 ? 'niveau ' + ALEVELS[i + 1].name : !p[1] ? 'ook het octaaf raden' : 'meer instrumenten of een groter register'; }
});
function aPc(m){ return ((m % 12) + 12) % 12; }
function aOct(m){ return Math.floor(m / 12) - 1; }          // C4 = centrale C (midi 60)
function aName(pc){ return AN_ALT[pc] ? AN[pc] + '/' + AN_ALT[pc] : AN[pc]; }
function aFull(m){ var pc = aPc(m), o = aOct(m); return AN[pc] + o + (AN_ALT[pc] ? ' / ' + AN_ALT[pc] + o : ''); }
function aInstName(id){ var i = AINST.find(function(x){ return x.id === id; }); return i ? i.n : id; }

/* --- klank --- */
function aOut(){ return Engine.out(); }
function aStopNotes(){ (aTimers || []).forEach(clearTimeout); aTimers = []; Engine.stopNotes(); }
function aSynth(t, midi, dur, inst, vol){ Engine.note(t, midi, dur, { inst:inst, vol:vol || .45 }); }
function aNoise(t){ return Engine.noise(t, 1.2); }

/* --- vragen --- */
function aCands(pc){ var r = []; for (var m = aS.lo; m <= aS.hi; m++) if (aPc(m) === pc) r.push(m); return r; }
function aPickPc(avoid){
  var st = aStats();
  var items = aS.set.filter(function(pc){ return aCands(pc).length && (aS.set.length < 2 || pc !== avoid); });
  if (!items.length) items = aS.set.filter(function(pc){ return aCands(pc).length; });
  if (!items.length) return null;
  var ws = items.map(function(pc){ var s = st[pc]; var err = s ? (s.t - s.r + 1) / (s.t + 2) : .5; return .25 + err * 2; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum;
  for (var i = 0; i < items.length; i++){ r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function aNew(autoplay){
  stop(); Score.ask('absoluut');
  var pc = aPickPc(aQ && aQ.pc);
  var msg = $('aMsg');
  if (pc == null){ msg.className = 'qmsg bad'; msg.textContent = 'In dit bereik zit geen van de gekozen noten. Maak het bereik groter.'; aQ = null; aRenderPad(); return; }
  aQ = { pc:pc, m:pick(aCands(pc)), inst:pick(aS.insts), answered:false, ansPc:null, ansOct:null, fresh:true };
  msg.className = 'qmsg'; msg.textContent = '';
  $('aInst').textContent = aS.insts.length > 1 ? 'Instrument: ' + aInstName(aQ.inst) : '';
  aRenderPad();
  if (autoplay) aPlay();
}
function aPlay(){
  if (!aQ) return;
  if (!aQ.answered) Score.heard('absoluut');
  stop(); ensureCtx();
  var t = actx.currentTime + .08;
  if (aQ.fresh && aS.noise) t += aNoise(t);
  aQ.fresh = false;
  aSynth(t, aQ.m, 1.4, aQ.inst);
}
function aNearest(pc, ref){ var c = aCands(pc); if (!c.length){ c = []; for (var m = ref - 6; m <= ref + 6; m++) if (aPc(m) === pc) c.push(m); } return c.reduce(function(a, b){ return Math.abs(b - ref) < Math.abs(a - ref) ? b : a; }); }
function aAnswer(pc){
  if (aS.explore || !aQ || aQ.answered){
    // verkennen of vergelijken: speel de noot (vlak bij de vraagtoon) op hetzelfde instrument
    var ref = aQ ? aQ.m : Math.round((aS.lo + aS.hi) / 2);
    stop(); ensureCtx(); aSynth(actx.currentTime + .03, aNearest(pc, ref), 1.2, aQ ? aQ.inst : aS.insts[0]);
    return;
  }
  aQ.ansPc = pc;
  aRenderPad();
  if (aS.octave && aQ.ansOct == null){ $('aMsg').className = 'qmsg'; $('aMsg').textContent = 'En in welk octaaf?'; return; }
  aFinish();
}
function aAnswerOct(o){
  if (!aQ || aQ.answered || aS.explore) return;
  aQ.ansOct = o;
  aRenderPad();
  if (aQ.ansPc != null) aFinish();
}
function aFinish(){
  aQ.answered = true;
  var okPc = aQ.ansPc === aQ.pc, okOct = !aS.octave || aQ.ansOct === aOct(aQ.m), ok = okPc && okOct;
  Score.log('absoluut', { k:aQ.pc, q:aFull(aQ.m) + ' (' + aQ.inst + ')', a:aName(aQ.ansPc) + (aS.octave ? aQ.ansOct : ''), ok:ok });
  aScore.total++; if (ok){ aScore.right++; aScore.streak++; } else aScore.streak = 0;
  $('aRight').textContent = aScore.right; $('aTotal').textContent = aScore.total; $('aStreak').textContent = aScore.streak;
  $('aToday').textContent = Score.today('absoluut');
  var label = aS.octave ? aFull(aQ.m) : aName(aQ.pc), inst = aInstName(aQ.inst).toLowerCase();
  var mine = aName(aQ.ansPc) + (aS.octave ? aQ.ansOct : '');
  var msg = $('aMsg');
  msg.className = 'qmsg ' + (ok ? 'good' : 'bad');
  msg.textContent = ok ? 'Goed! Het was een ' + label + ' (' + inst + ').'
    : 'Het was een ' + label + ' (' + inst + '). Jij koos ' + mine + (okPc && !okOct ? ': goede noot, verkeerd octaaf.' : '.') + ' Klik op de knoppen om te vergelijken.';
  aRenderPad(); aRenderStats();
  stop(); ensureCtx();
  aSynth(actx.currentTime + .2, aQ.m, 1.1, aQ.inst);
  if (ok && aS.auto) aTimers.push(setTimeout(function(){ aNew(true); }, 1700));
}

/* --- tekenen --- */
function aRenderPad(){
  var mk = function(pc){
    var b = document.createElement('button'); b.type = 'button';
    if (pc == null){ b.className = 'gbtn off'; return b; }
    var cls = 'gbtn' + (AN_ALT[pc] ? ' chrom' : '') + (aS.set.indexOf(pc) >= 0 ? '' : ' dim');
    if (aQ && aQ.answered){
      if (pc === aQ.pc) cls += ' right';
      else if (pc === aQ.ansPc) cls += ' wrong';
    } else if (aQ && aQ.ansPc === pc) cls += ' picked';
    b.className = cls; b.dataset.pc = pc;
    b.innerHTML = AN[pc] + (AN_ALT[pc] ? '<small>' + AN_ALT[pc] + '</small>' : '<small>&nbsp;</small>');
    b.onclick = function(){ b.blur(); aAnswer(pc); };
    return b;
  };
  var top = $('aTop'), bot = $('aBot'), oct = $('aOctRow');
  top.innerHTML = ''; bot.innerHTML = '';
  [1,3,null,6,8,10].forEach(function(pc){ top.appendChild(mk(pc)); });
  [0,2,4,5,7,9,11].forEach(function(pc){ bot.appendChild(mk(pc)); });
  oct.innerHTML = '';
  oct.style.display = aS.octave ? '' : 'none';
  if (aS.octave){
    for (var o = aOct(aS.lo); o <= aOct(aS.hi); o++) (function(o){
      var b = document.createElement('button'); b.type = 'button'; b.textContent = o;
      b.className = 'obtn';
      if (aQ && aQ.answered){ if (o === aOct(aQ.m)) b.classList.add('right'); else if (o === aQ.ansOct) b.classList.add('wrong'); }
      else if (aQ && aQ.ansOct === o) b.classList.add('picked');
      b.onclick = function(){ b.blur(); aAnswerOct(o); };
      oct.appendChild(b);
    })(o);
  }
}
function aRenderStats(){
  var st = aStats(), rows = [];
  Object.keys(st).forEach(function(pc){ var s = st[pc]; if (s.t) rows.push({ label:aName(+pc), r:s.r, t:s.t, p:s.r / s.t }); });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  $('aStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div></div>'; }).join('')
    : '<p class="note">Nog geen antwoorden. De noot die je het vaakst mist komt hier bovenaan en krijg je ook vaker als vraag.</p>';
}
function aRangeOpts(){
  var lo = $('aLo'), hi = $('aHi'), opts = '';
  for (var m = 21; m <= 108; m++) opts += '<option value="' + m + '">' + aFull(m) + (m === 60 ? ' (centrale C)' : '') + '</option>';
  lo.innerHTML = opts; hi.innerHTML = opts;
  lo.value = String(aS.lo); hi.value = String(aS.hi);
  $('aRangeTxt').textContent = (aS.hi - aS.lo + 1) + ' halve tonen, ' + Math.round((aS.hi - aS.lo) / 12 * 10) / 10 + ' octaaf';
}
function aSyncUI(){
  $('aLevel').value = aS.level;
  aRangeOpts();
  $('aOctave').checked = aS.octave; $('aAuto').checked = aS.auto; $('aNoiseChk').checked = aS.noise; $('aExplore').checked = aS.explore;
  document.querySelectorAll('#aNotes input').forEach(function(inp){ inp.checked = aS.set.indexOf(+inp.value) >= 0; });
  document.querySelectorAll('#aInsts input').forEach(function(inp){ inp.checked = aS.insts.indexOf(inp.value) >= 0; });
  $('absPanel').classList.toggle('explore', aS.explore);
}
function aMatchLevel(){
  var key = aS.set.slice().sort(function(a, b){ return a - b; }).join(',');
  var L = ALEVELS.find(function(l){ return l.set.join(',') === key; });
  aS.level = L ? L.id : 'eigen';
  $('aLevel').value = aS.level;
}
function aInit(){
  aLoad();
  $('aLevel').innerHTML = ALEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie</option>';
  $('aNotes').innerHTML = AN.map(function(n, pc){ return '<label class="chip"><input type="checkbox" value="' + pc + '"> ' + aName(pc) + '</label>'; }).join('');
  $('aInsts').innerHTML = AINST.map(function(i){ return '<label class="chip"><input type="checkbox" value="' + i.id + '"> ' + i.n + '</label>'; }).join('');
  aSyncUI();
  var changed = function(renew){ aSave(); if (renew) aNew(false); };
  $('aLevel').onchange = function(e){
    var L = ALEVELS.find(function(l){ return l.id === e.target.value; });
    aS.level = e.target.value; if (L) aS.set = L.set.slice();
    aSyncUI(); changed(true);
  };
  $('aNotes').onchange = function(){
    var set = []; document.querySelectorAll('#aNotes input:checked').forEach(function(inp){ set.push(+inp.value); });
    if (!set.length){ set = [0]; document.querySelector('#aNotes input[value="0"]').checked = true; }
    aS.set = set; aMatchLevel(); changed(true);
  };
  $('aInsts').onchange = function(){
    var ins = []; document.querySelectorAll('#aInsts input:checked').forEach(function(inp){ ins.push(inp.value); });
    if (!ins.length){ ins = ['piano']; document.querySelector('#aInsts input[value="piano"]').checked = true; }
    aS.insts = ins; changed(true);
  };
  var range = function(which){
    return function(e){
      var v = +e.target.value;
      if (which === 'lo'){ aS.lo = v; if (aS.hi < v + 6) aS.hi = Math.min(108, v + 6); }
      else { aS.hi = v; if (aS.lo > v - 6) aS.lo = Math.max(21, v - 6); }
      aRangeOpts(); changed(true);
    };
  };
  $('aLo').onchange = range('lo'); $('aHi').onchange = range('hi');
  document.querySelectorAll('#absPanel .rpreset').forEach(function(b){
    b.onclick = function(){ b.blur(); aS.lo = +b.dataset.lo; aS.hi = +b.dataset.hi; aRangeOpts(); changed(true); };
  });
  $('aOctave').onchange = function(e){ aS.octave = e.target.checked; changed(true); };
  $('aAuto').onchange = function(e){ aS.auto = e.target.checked; changed(false); };
  $('aNoiseChk').onchange = function(e){ aS.noise = e.target.checked; changed(false); };
  $('aExplore').onchange = function(e){
    aS.explore = e.target.checked; $('absPanel').classList.toggle('explore', aS.explore);
    var msg = $('aMsg'); msg.className = 'qmsg';
    msg.textContent = aS.explore ? 'Verkennen: klik op een noot om hem te horen. Zet het vinkje uit om weer te oefenen.' : '';
    if (!aS.explore) aNew(false);
  };
  document.querySelectorAll('#absView select, #absView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('aPlay').onclick = function(){ this.blur(); aPlay(); };
  $('aNext').onclick = function(){ this.blur(); aNew(true); };
  $('aReset').onclick = function(){ Score.clear('absoluut'); aRenderStats(); $('aToday').textContent = 0; };
  $('aToday').textContent = Score.today('absoluut');
  aNew(false);
  aRenderStats();
}
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || view !== 'absoluut' || !aS) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (Keys.blocked(e)) return;
  var k = e.key.toLowerCase(), nat = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) aPlay(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); aNew(true); }
  else if (nat[k] != null){ var pc = nat[k] + (e.shiftKey ? 1 : 0); aAnswer(pc % 12); }
  else if (/^[1-8]$/.test(e.key) && aS.octave) aAnswerOct(+e.key);
});
document.addEventListener('keyup', function(e){
  if (typeof view !== 'undefined' && view === 'absoluut' && (e.key === ' ' || e.code === 'Space')) e.preventDefault();
});
aInit();


