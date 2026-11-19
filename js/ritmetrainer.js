/* ================= Ritme-trainers (16-11-2026): Rudiments (rd), Polyritme (py), Tempo-ladder (tp), Swing (sw) =================
   Gedeeld (prefix rt): eigen planner op de audioklok (rtLoop), stokklanken (rtHit), meetikken met kalibratie (rtTap*), rtStopAll().
   Routes: #rudiments → #rdView, #polyritme → #pyView, #tempoladder → #tpView, #swing → #swView (onder Ritme).
   Toetsen: metronoom (M) = start/stop, sneller/langzamer (↑ ↓, Shift ±5), tik (Spatie) = meetikken (Tempo-ladder, Swing → meten),
            luister (Spatie) bij Swing → luisteren, volgende/vorige (Enter/←) = strak / niet strak (Tempo-ladder, zelf beoordelen),
            Polyritme: F = links, J = rechts (meetikken). Swing → luisteren: 1–4 = antwoord. Esc = stop (via stop() in audio.js).
   Score: alleen Swing → luisteren logt ('swing', k = soort swing). Oefentijd telt voor alle vier (rtBusy in score.js). */

/* --- gedeelde klank en planner --- */
var rtRun = null, rtNoise = null, rtUiTimers = [];
function rtBusy(){ return !!rtRun; }
function rtStopAll(){
  if (rtRun){ var r = rtRun; rtRun = null; clearInterval(r.iv); if (r.raf) cancelAnimationFrame(r.raf); if (r.onStop) r.onStop(); }
  rtUiTimers.forEach(clearTimeout); rtUiTimers = [];
}
function rtNoiseBuf(){
  if (!rtNoise){ var n = Math.floor(actx.sampleRate * .6), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; rtNoise = b; }
  return rtNoise;
}
var RT_SND = {
  R:   { f:2400, q:.8,  dec:.075, body:190, bv:.35, nv:.55, hp:0 },     // rechterstok: iets helderder
  L:   { f:1750, q:.8,  dec:.075, body:165, bv:.35, nv:.55, hp:0 },     // linkerstok
  hi:  { f:3000, q:2,   dec:.04,  body:900, bv:.45, nv:.18, hp:0 },     // polyritme: bovenste stem (houtblok hoog)
  lo:  { f:1000, q:2,   dec:.06,  body:420, bv:.55, nv:.15, hp:0 },     // polyritme: onderste stem (houtblok laag)
  ride:{ f:7000, q:.6,  dec:.16,  body:0,   bv:0,   nv:.22, hp:5000 },  // swing: ride-bekken
  kick:{ f:200,  q:.7,  dec:.12,  body:70,  bv:.7,  nv:.05, hp:0 }      // swing: zachte bas op de tel
};
function rtHit(t, kind, vel){
  var P = RT_SND[kind] || RT_SND.R, out = Engine.out(); vel = vel == null ? 1 : vel;
  var src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = rtNoiseBuf(); f.type = P.hp ? 'highpass' : 'bandpass'; f.frequency.value = P.hp || P.f; f.Q.value = P.q;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.002, P.nv * vel), t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + P.dec);
  src.connect(f).connect(g).connect(out); src.start(t, Math.random() * .3); src.stop(t + P.dec + .03);
  if (P.body){
    var o = actx.createOscillator(), og = actx.createGain();
    o.type = kind === 'hi' || kind === 'lo' ? 'sine' : 'triangle'; o.frequency.setValueAtTime(P.body * (kind === 'kick' ? 1.6 : 1), t);
    if (kind === 'kick') o.frequency.exponentialRampToValueAtTime(P.body, t + .08);
    og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(Math.max(.002, P.bv * vel), t + .003); og.gain.exponentialRampToValueAtTime(.0001, t + P.dec * 1.2);
    o.connect(og).connect(out); o.start(t); o.stop(t + P.dec * 1.2 + .03);
  }
}
// planner: gen(i) geeft het i-de gebeurtenis-blok {t, play(t), ui()} of null (klaar); loopt 0,15 s vooruit
function rtLoop(o){
  rtStopAll(); ensureCtx();
  var r = { i:0, gen:o.gen, onStop:o.onStop, iv:null, raf:null, start:actx.currentTime + .12 };
  rtRun = r;
  var pump = function(){
    if (rtRun !== r) return;
    var ahead = actx.currentTime + .15;
    while (rtRun === r){
      var ev = r.peek || (r.peek = r.gen(r.i, r.start));
      if (!ev){ if (o.onEnd){ var e = o.onEnd; rtUiTimers.push(setTimeout(function(){ if (rtRun === r){ rtStopAll(); e(); } }, Math.max(0, ((r.lastT || 0) - actx.currentTime) * 1000) + 320)); } clearInterval(r.iv); r.iv = null; return; }
      if (ev.t > ahead) break;
      if (ev.play) ev.play(ev.t);
      r.lastT = ev.t;
      if (ev.ui){ var fn = ev.ui; rtUiTimers.push(setTimeout(fn, Math.max(0, (ev.t - actx.currentTime) * 1000))); }
      r.peek = null; r.i++;
    }
  };
  r.iv = setInterval(pump, 25); pump();
  return r;
}
/* --- meetikken: verwachte tijden + tikken met kalibratie (zelfde correctie als Tikken: ⚙️ → kalibreren) --- */
function rtTapNew(){ return { ex:[], extra:0 }; }
function rtExpect(T, t, tag, w){ T.ex.push({ t:t, tag:tag || '', w:Math.min(.15, w || .15), off:null }); if (T.ex.length > 4000) T.ex.splice(0, 1000); }
function rtNowHeard(){ var lat = actx.outputLatency || actx.baseLatency || 0; return actx.currentTime - lat - (typeof calib !== 'undefined' ? calib / 1000 : 0); }
function rtTap(T, tag){
  if (!actx) return null;
  var tt = rtNowHeard(), best = null, bd = Infinity;
  for (var i = T.ex.length - 1; i >= 0; i--){
    var e = T.ex[i]; if (e.t < tt - .5) break;
    if (e.off !== null || (tag && e.tag !== tag)) continue;
    var d = Math.abs(tt - e.t); if (d <= e.w && d < bd){ best = e; bd = d; }
  }
  if (!best){ T.extra++; return null; }
  best.off = (tt - best.t) * 1000; return best;
}
function rtSum(list){
  var hit = list.filter(function(e){ return e.off !== null; }), offs = hit.map(function(e){ return e.off; });
  var mean = offs.length ? offs.reduce(function(a, b){ return a + b; }, 0) / offs.length : 0;
  var spread = offs.length ? offs.reduce(function(a, b){ return a + Math.abs(b - mean); }, 0) / offs.length : 0;
  return { n:list.length, hit:hit.length, pct:list.length ? hit.length / list.length * 100 : 0, mean:mean, spread:spread };
}
function rtMs(x){ var m = Math.round(x); return (m > 0 ? '+' : '') + m + ' ms'; }
function rtLoad(key, def){ var s = {}; try { s = JSON.parse(localStorage.getItem(key)) || {}; } catch(e){} return Object.assign(def, s); }
function rtSave(key, S){ try { localStorage.setItem(key, JSON.stringify(S)); } catch(e){} }
function rtClampBpm(b){ return Math.max(20, Math.min(300, Math.round(+b) || 60)); }

/* ================= Rudiments ================= */
// tokens per onderverdeling: R / L, ^ = accent, f = flam (voorslag andere hand), d = drag (twee voorslagen), - = rust
var RD_LIST = [
  { id:'single',  grp:'Rolls',       nl:'Single stroke roll',      sub:4, pat:'R L R L', tip:'Om en om, beide handen precies even hard en even hoog.' },
  { id:'double',  grp:'Rolls',       nl:'Double stroke roll',      sub:4, pat:'R R L L', tip:'Twee slagen per hand; de tweede slag even hard als de eerste (laat de stok terugveren, de vingers doen de tweede).' },
  { id:'five',    grp:'Rolls',       nl:'Five stroke roll',        sub:4, pat:'R R L L ^R - L L R R ^L -', tip:'Twee dubbelslagen en een accent. Het accent valt om en om rechts en links.' },
  { id:'six',     grp:'Rolls',       nl:'Six stroke roll',         sub:3, pat:'^R L L R R ^L', tip:'Accent, twee dubbelslagen, accent. Mooi in triolen.' },
  { id:'seven',   grp:'Rolls',       nl:'Seven stroke roll',       sub:4, pat:'L L R R L L ^R - R R L L R R ^L -', tip:'Drie dubbelslagen en een accent met de andere hand.' },
  { id:'para',    grp:'Paradiddles', nl:'Single paradiddle',       sub:4, pat:'^R L R R ^L R L L', tip:'Para-diddle: RL RR / LR LL. Accent op de eerste van elke groep; de leidende hand wisselt vanzelf.' },
  { id:'dpara',   grp:'Paradiddles', nl:'Double paradiddle',       sub:3, pat:'^R L R L R R ^L R L R L L', tip:'RLRL RR / LRLR LL, in triolen. Het accent wisselt van hand.' },
  { id:'tpara',   grp:'Paradiddles', nl:'Triple paradiddle',       sub:4, pat:'^R L R L R L R R ^L R L R L R L L', tip:'Drie keer om en om, dan de dubbelslag.' },
  { id:'pdd',     grp:'Paradiddles', nl:'Paradiddle-diddle',       sub:3, pat:'^R L R R L L', tip:'RLRRLL: veel gebruikt in fills. Dezelfde hand begint steeds.' },
  { id:'ipara',   grp:'Paradiddles', nl:'Inverted paradiddle',     sub:4, pat:'^R L L R ^L R R L', tip:'De dubbelslag zit in het midden: R LL R / L RR L.' },
  { id:'flam',    grp:'Flams',       nl:'Flam',                    sub:1, pat:'fR fL', tip:'Een zachte voorslag vlak voor de hoofdslag: laag-hoog. Niet tegelijk ("flat flam"), maar ook niet te ver uit elkaar.' },
  { id:'flamacc', grp:'Flams',       nl:'Flam accent',             sub:3, pat:'^fR L R ^fL R L', tip:'Flam op de eerste triool, dan twee zachte slagen.' },
  { id:'flamtap', grp:'Flams',       nl:'Flam tap',                sub:4, pat:'^fR R ^fL L', tip:'Flam en dan een tik met dezelfde hand; daarna wisselen.' },
  { id:'flamcue', grp:'Flams',       nl:'Flamacue',                sub:4, pat:'fL ^R L R fL - - -', tip:'Flam, accent op de tweede noot (!), twee zachte, en een flam op de tel.' },
  { id:'flampara',grp:'Flams',       nl:'Flam paradiddle',         sub:4, pat:'^fR L R R ^fL R L L', tip:'Een paradiddle met een flam op elke eerste noot.' },
  { id:'swiss',   grp:'Flams',       nl:'Swiss army triplet',      sub:3, pat:'fR R L fR R L', tip:'Flam, dan dezelfde hand en de andere: rechts leidt steeds.' },
  { id:'drag',    grp:'Drags',       nl:'Drag (ruff)',             sub:2, pat:'dR - dL -', tip:'Twee snelle zachte voorslagen met de andere hand (een dubbelslag) vlak voor de hoofdslag.' },
  { id:'sdt',     grp:'Drags',       nl:'Single drag tap',         sub:2, pat:'dR ^L dL ^R', tip:'Drag en dan een accent met de andere hand.' }
];
var RD_COUNT = { 1:['1'], 2:['1','&'], 3:['1','&','a'], 4:['1','e','&','a'] };
var RD_KEY = 'rudiments-settings';
var rdS = null, rdHi = -1;
function rdDefaults(){ return { id:'single', bpm:70, metro:true, sticks:true, lead:'R', ci:true, ramp:false, step:4, every:4, max:140 }; }
function rdCur(){ return RD_LIST.find(function(r){ return r.id === rdS.id; }) || RD_LIST[0]; }
function rdTokens(r){
  var sw = rdS.lead === 'L';
  return r.pat.split(' ').map(function(tok){
    var o = { acc:false, grace:0, h:null };
    if (tok === '-') return o;
    if (tok.charAt(0) === '^'){ o.acc = true; tok = tok.slice(1); }
    if (tok.charAt(0) === 'f'){ o.grace = 1; tok = tok.slice(1); }
    else if (tok.charAt(0) === 'd'){ o.grace = 2; tok = tok.slice(1); }
    o.h = sw ? (tok === 'R' ? 'L' : 'R') : tok;
    return o;
  });
}
function rdRender(){
  var r = rdCur(), toks = rdTokens(r), beats = toks.length / r.sub;
  var html = '';
  for (var b = 0; b < beats; b++){
    html += '<div class="rdbeat">';
    for (var s = 0; s < r.sub; s++){
      var i = b * r.sub + s, k = toks[i], other = k.h === 'R' ? 'L' : 'R';
      html += '<div class="rdcell' + (k.h ? ' ' + k.h : ' rest') + (k.acc ? ' acc' : '') + '" data-i="' + i + '"><span class="rdacc">' + (k.acc ? '>' : '') + '</span>' +
        '<span class="rdh">' + (k.grace ? '<sup>' + (k.grace === 2 ? other + other : other).toLowerCase() + '</sup>' : '') + (k.h || '·') + '</span>' +
        '<span class="rdcnt">' + (RD_COUNT[r.sub] ? RD_COUNT[r.sub][s] : '') + '</span></div>';
    }
    html += '</div>';
  }
  $('rdGrid').innerHTML = html;
  $('rdName').textContent = r.nl; $('rdTip').textContent = r.tip;
  $('rdMeta').textContent = beats + (beats === 1 ? ' tel' : ' tellen') + ' · ' + (r.sub === 1 ? 'kwarten' : r.sub === 2 ? 'achtsten' : r.sub === 3 ? 'triolen' : 'zestienden') + (rdS.lead === 'L' ? ' · begint links' : '');
}
function rdHiCell(i){ if (i === rdHi) return; rdHi = i; document.querySelectorAll('#rdGrid .rdcell').forEach(function(c){ c.classList.toggle('on', +c.dataset.i === i); }); }
function rdShowBpm(b){ $('rdBpmNow').textContent = '♩ = ' + Math.round(b); }
// from = {p, reps, bpm} om na een pauze verder te gaan (vanaf het begin van de tel waar je was), anders vanaf het begin
var rdPaused = null, rdLast = null;
function rdStart(from){
  var r = rdCur(), toks = rdTokens(r), ci = rdS.ci ? 4 : 0;
  var bpm = from ? from.bpm : rdS.bpm, reps = from ? from.reps : 0, off = from ? from.p : 0, t0 = null, n = toks.length;
  rdPaused = null; rdLast = null;
  $('rdStart').textContent = '■ Stop'; $('rdView').classList.add('playing'); $('rdView').classList.remove('paused'); $('rdPause').textContent = '⏸ Pauze';
  var st = { last:null, dt:0 };
  rtLoop({
    gen:function(i, start){
      // eerst aftellen (4 tellen), daarna de figuur steeds herhalen; tijd per stap = één onderverdeling
      if (t0 == null) t0 = start;
      if (i < ci){ var tc = t0 + i * 60 / bpm; return { t:tc, play:function(t){ Engine.click(t, i === 0 ? 'accent' : 'beat'); }, ui:function(){ $('rdCount').textContent = (from ? 'verder over ' : 'aftellen ') + (ci - i); } }; }
      var j = i - ci, p = (j + off) % n;
      if (p === 0 && j > 0){ reps++; if (rdS.ramp && reps % rdS.every === 0 && bpm < rdS.max) bpm = Math.min(rdS.max, bpm + rdS.step); }
      var prev = st.last, dt = 60 / bpm / r.sub, t = prev == null ? t0 + ci * 60 / bpm : prev + st.dt;
      st.last = t; st.dt = dt;
      var k = toks[p], beat = p % r.sub === 0, bIdx = Math.floor(p / r.sub), b2 = bpm, rr = reps;
      return { t:t, play:function(tt){
        if (rdS.metro && beat) Engine.click(tt, bIdx === 0 ? 'accent' : 'beat');
        if (rdS.sticks && k.h){
          var other = k.h === 'R' ? 'L' : 'R', gap = Math.min(.035, dt * .3);
          if (k.grace === 1) rtHit(tt - gap, other, .28);
          if (k.grace === 2){ rtHit(tt - gap * 2, other, .25); rtHit(tt - gap, other, .25); }
          rtHit(tt, k.h, k.acc ? 1 : .5);
        }
      }, ui:function(){ rdLast = { p:p, reps:rr, bpm:b2 }; rdHiCell(p); if (p === 0 || j === 0){ rdShowBpm(b2); $('rdCount').textContent = 'herhaling ' + (rr + 1); } } };
    },
    onStop:function(){ rdHiCell(-1); rdPaused = null; $('rdStart').textContent = '▶ Start'; $('rdCount').textContent = ''; $('rdView').classList.remove('playing', 'paused'); $('rdPause').textContent = '⏸ Pauze'; rdShowBpm(rdS.bpm); }
  });
}
function rdPlaying(){ return !!rtRun && $('rdView').classList.contains('playing'); }
function rdToggle(){ if (rdPlaying() || rdPaused){ rtStopAll(); rdPaused = null; $('rdView').classList.remove('paused'); $('rdPause').textContent = '⏸ Pauze'; } else rdStart(); }
// pauze: stil, maar onthoudt figuur, plek (begin van de tel), herhaling en tempo; nog eens = verder (met aftellen als dat aan staat)
function rdPause(){
  if (rdPaused){ rdStart(rdPaused); return; }
  if (!rdPlaying()) return;
  var r = rdCur(), last = rdLast;
  rtStopAll();
  rdPaused = last ? { p:last.p - last.p % r.sub, reps:last.reps, bpm:last.bpm } : { p:0, reps:0, bpm:rdS.bpm };
  if (last) rdHiCell(rdPaused.p);
  $('rdView').classList.add('paused'); $('rdPause').textContent = '▶ Verder';
  $('rdCount').textContent = 'gepauzeerd · herhaling ' + (rdPaused.reps + 1); rdShowBpm(rdPaused.bpm);
}
function rdSyncUI(){
  $('rdSel').value = rdS.id; $('rdBpm').value = rdS.bpm; $('rdMetro').checked = rdS.metro; $('rdSticks').checked = rdS.sticks; $('rdLead').value = rdS.lead;
  $('rdCi').checked = rdS.ci; $('rdRamp').checked = rdS.ramp; $('rdStep').value = rdS.step; $('rdEvery').value = rdS.every; $('rdMax').value = rdS.max;
  $('rdRampBox').classList.toggle('dim', !rdS.ramp); rdShowBpm(rdS.bpm); rdRender();
}
function rdInit(){
  rdS = rtLoad(RD_KEY, rdDefaults());
  var grps = []; RD_LIST.forEach(function(r){ if (grps.indexOf(r.grp) < 0) grps.push(r.grp); });
  $('rdSel').innerHTML = grps.map(function(g){ return '<optgroup label="' + g + '">' + RD_LIST.filter(function(r){ return r.grp === g; }).map(function(r){ return '<option value="' + r.id + '">' + r.nl + '</option>'; }).join('') + '</optgroup>'; }).join('');
  rdSyncUI();
  var restart = function(){ rtSave(RD_KEY, rdS); if (rdPaused){ rtStopAll(); rdPaused = null; $('rdView').classList.remove('paused'); $('rdPause').textContent = '⏸ Pauze'; $('rdCount').textContent = ''; } rdRender(); if (rdPlaying()) rdStart(); };
  $('rdSel').onchange = function(e){ rdS.id = e.target.value; restart(); };
  $('rdPrev').onclick = function(){ this.blur(); var i = RD_LIST.findIndex(function(r){ return r.id === rdS.id; }); rdS.id = RD_LIST[(i - 1 + RD_LIST.length) % RD_LIST.length].id; $('rdSel').value = rdS.id; restart(); };
  $('rdNextBtn').onclick = function(){ this.blur(); var i = RD_LIST.findIndex(function(r){ return r.id === rdS.id; }); rdS.id = RD_LIST[(i + 1) % RD_LIST.length].id; $('rdSel').value = rdS.id; restart(); };
  $('rdBpm').onchange = function(e){ rdS.bpm = rtClampBpm(e.target.value); e.target.value = rdS.bpm; rdShowBpm(rdS.bpm); restart(); };
  [['rdMetro','metro'],['rdSticks','sticks'],['rdCi','ci'],['rdRamp','ramp']].forEach(function(x){ $(x[0]).onchange = function(e){ rdS[x[1]] = e.target.checked; $('rdRampBox').classList.toggle('dim', !rdS.ramp); restart(); }; });
  $('rdLead').onchange = function(e){ rdS.lead = e.target.value; restart(); };
  [['rdStep','step',1,40],['rdEvery','every',1,32],['rdMax','max',30,300]].forEach(function(x){ $(x[0]).onchange = function(e){ rdS[x[1]] = Math.max(x[2], Math.min(x[3], Math.round(+e.target.value) || x[2])); e.target.value = rdS[x[1]]; restart(); }; });
  $('rdStart').onclick = function(){ this.blur(); rdToggle(); };
  $('rdPause').onclick = function(){ this.blur(); rdPause(); };
  document.querySelectorAll('#rdView select, #rdView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
}
function rdTempo(d){ rdS.bpm = rtClampBpm(rdS.bpm + d); $('rdBpm').value = rdS.bpm; rdShowBpm(rdS.bpm); rtSave(RD_KEY, rdS); if (rdPaused) rdPaused.bpm = rdS.bpm; else if (rdPlaying()) rdStart(); }

/* ================= Polyritme ================= */
var PY_KEY = 'polyritme-settings';
var pyS = null, pyTap = null, pyHiCol = -1;
function pyDefaults(){ return { r:3, l:2, bpm:60, muteR:false, muteL:false, pulse:true, grid:false, ci:true, tap:false }; }
function pyGcd(a, b){ return b ? pyGcd(b, a % b) : a; }
function pyLcm(){ return pyS.r * pyS.l / pyGcd(pyS.r, pyS.l); }
function pyRender(){
  var n = pyLcm(), sr = n / pyS.r, sl = n / pyS.l, cells = function(fn){ var h = ''; for (var i = 0; i < n; i++) h += fn(i); return h; };
  var rowR = cells(function(i){ return '<span class="pyc' + (i % sr === 0 ? ' hit R' : '') + '" data-c="' + i + '">' + (i % sr === 0 ? '●' : '') + '</span>'; });
  var rowL = cells(function(i){ return '<span class="pyc' + (i % sl === 0 ? ' hit L' : '') + '" data-c="' + i + '">' + (i % sl === 0 ? '●' : '') + '</span>'; });
  var rowB = cells(function(i){ var a = i % sr === 0, b = i % sl === 0; return '<span class="pyc' + (a || b ? ' hit' : '') + (a && b ? ' both' : a ? ' R' : b ? ' L' : '') + '" data-c="' + i + '">' + (a && b ? 'RL' : a ? 'R' : b ? 'L' : '') + '</span>'; });
  var rowN = cells(function(i){ var a = i % sr === 0, b = i % sl === 0; return '<span class="pyc num' + (a || b ? ' say' : '') + '" data-c="' + i + '">' + (i + 1) + '</span>'; });
  $('pyGrid').style.setProperty('--n', n);
  $('pyGrid').innerHTML = '<div class="pyrow"><span class="pylab">Rechts · ' + pyS.r + '</span><div class="pycells">' + rowR + '</div></div>' +
    '<div class="pyrow"><span class="pylab">Links · ' + pyS.l + '</span><div class="pycells">' + rowL + '</div></div>' +
    '<div class="pyrow samen"><span class="pylab">Samen</span><div class="pycells">' + rowB + '</div></div>' +
    '<div class="pyrow"><span class="pylab">Tel</span><div class="pycells">' + rowN + '</div></div>';
  var say = []; for (var i = 0; i < n; i++) if (i % sr === 0 || i % sl === 0) say.push(i + 1);
  var rs = [], ls = []; for (i = 0; i < n; i++){ if (i % sr === 0) rs.push(i + 1); if (i % sl === 0) ls.push(i + 1); }
  $('pyHow').innerHTML = 'Tel gelijkmatig tot <b>' + n + '</b> en zeg alleen de vette getallen hardop: <b>' + say.join(' ') + '</b>. Rechts slaat op ' + rs.join(', ') + '; links op ' + ls.join(', ') + '. ' +
    (pyGcd(pyS.r, pyS.l) > 1 ? '<br><span class="muted">Let op: ' + pyS.r + ' en ' + pyS.l + ' hebben een gemeenschappelijke deler, dus dit is eigenlijk ' + (pyS.r / pyGcd(pyS.r, pyS.l)) + ' tegen ' + (pyS.l / pyGcd(pyS.r, pyS.l)) + ', twee keer.</span>' : '');
  $('pyTitle').textContent = pyS.r + ' tegen ' + pyS.l;
}
function pyHi(c){ if (c === pyHiCol) return; pyHiCol = c; document.querySelectorAll('#pyGrid .pyc').forEach(function(x){ x.classList.toggle('on', +x.dataset.c === c); }); }
function pyStart(){
  var n = pyLcm(), sr = n / pyS.r, sl = n / pyS.l, ci = pyS.ci ? pyS.l : 0;
  pyTap = rtTapNew(); pyTapShow();
  var cyc = function(){ return pyS.l * 60 / pyS.bpm; };
  $('pyStart').textContent = '■ Stop'; $('pyView').classList.add('playing');
  var tNext = null;
  rtLoop({
    gen:function(i, start){
      if (tNext == null) tNext = start;
      if (i < ci){ var t = tNext; tNext += 60 / pyS.bpm; return { t:t, play:function(tt){ Engine.click(tt, i === 0 ? 'accent' : 'beat'); }, ui:function(){ $('pyCount').textContent = 'aftellen ' + (ci - i); } }; }
      var j = i - ci, c = j % n, cycle = Math.floor(j / n), dt = cyc() / n, tt0 = tNext; tNext += dt;
      var isR = c % sr === 0, isL = c % sl === 0;
      if (pyS.tap){ if (isR) rtExpect(pyTap, tt0, 'R', dt * sr / 2); if (isL) rtExpect(pyTap, tt0, 'L', dt * sl / 2); }
      return { t:tt0, play:function(tt){
        if (isR && !pyS.muteR) rtHit(tt, 'hi', c === 0 ? 1 : .75);
        if (isL && !pyS.muteL) rtHit(tt, 'lo', c === 0 ? 1 : .75);
        if (pyS.pulse && c === 0) Engine.click(tt, 'accent');
        if (pyS.grid && !isR && !isL) Engine.click(tt, 'sub');
      }, ui:function(){ pyHi(c); if (c === 0){ $('pyCount').textContent = 'ronde ' + (cycle + 1); if (pyS.tap && cycle > 0) pyTapShow(); } } };
    },
    onStop:function(){ pyHi(-1); $('pyStart').textContent = '▶ Start'; $('pyCount').textContent = ''; $('pyView').classList.remove('playing'); if (pyS.tap) pyTapShow(true); }
  });
}
function pyToggle(){ if (rtRun && $('pyView').classList.contains('playing')) rtStopAll(); else pyStart(); }
function pyTapKey(hand){
  var pad = $(hand === 'R' ? 'pyPadR' : 'pyPadL'); pad.classList.add('flash'); setTimeout(function(){ pad.classList.remove('flash'); }, 90);
  if (!pyS.tap || !rtRun || !pyTap) return;
  var e = rtTap(pyTap, hand), live = $('pyLive');
  live.textContent = e ? (hand === 'R' ? 'rechts ' : 'links ') + (Math.abs(e.off) <= 5 ? 'precies!' : rtMs(e.off)) : 'extra tik';
  live.className = 'taplive ' + (e ? (Math.abs(e.off) <= 30 ? 'tg' : Math.abs(e.off) <= 60 ? 'tk' : 'to') : 'tb');
  pyTapShow();
}
function pyTapShow(final){
  var box = $('pySum'); if (!pyS.tap){ box.innerHTML = ''; return; }
  if (!pyTap){ box.innerHTML = '<span class="muted">Druk op Start en tik mee: F = links, J = rechts (of de vakken hieronder).</span>'; return; }
  var now = actx ? rtNowHeard() - .2 : 0, h = ['R','L'].map(function(hand){
    var due = pyTap.ex.filter(function(e){ return e.tag === hand && (final || e.t < now); }), s = rtSum(due);
    return '<span><b>' + (hand === 'R' ? 'Rechts' : 'Links') + '</b>: ' + Math.round(s.pct) + '% raak · gemiddeld ' + rtMs(s.mean) + ' · spreiding ±' + Math.round(s.spread) + ' ms</span>';
  });
  box.innerHTML = h.join('') + '<span>extra tikken <b>' + pyTap.extra + '</b></span>';
}
function pySyncUI(){
  $('pyR').value = pyS.r; $('pyL').value = pyS.l; $('pyBpm').value = pyS.bpm; $('pyMuteR').checked = pyS.muteR; $('pyMuteL').checked = pyS.muteL;
  $('pyPulse').checked = pyS.pulse; $('pyGridChk').checked = pyS.grid; $('pyCi').checked = pyS.ci; $('pyTapChk').checked = pyS.tap;
  $('pyView').classList.toggle('tapon', pyS.tap);
  document.querySelectorAll('#pyQuick button').forEach(function(b){ b.classList.toggle('on', b.dataset.r == pyS.r && b.dataset.l == pyS.l); });
  pyRender(); pyTapShow();
}
function pyInit(){
  pyS = rtLoad(PY_KEY, pyDefaults());
  var opts = ''; for (var i = 2; i <= 9; i++) opts += '<option value="' + i + '">' + i + '</option>';
  $('pyR').innerHTML = opts; $('pyL').innerHTML = opts;
  $('pyQuick').innerHTML = [[3,2],[2,3],[4,3],[3,4],[5,4],[5,3],[5,2],[7,4],[4,5]].map(function(p){ return '<button type="button" data-r="' + p[0] + '" data-l="' + p[1] + '">' + p[0] + ' : ' + p[1] + '</button>'; }).join('');
  pySyncUI();
  var ch = function(){ rtSave(PY_KEY, pyS); pySyncUI(); if (rtRun && $('pyView').classList.contains('playing')) pyStart(); };
  $('pyQuick').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ b.blur(); pyS.r = +b.dataset.r; pyS.l = +b.dataset.l; ch(); }; });
  $('pyR').onchange = function(e){ pyS.r = +e.target.value; ch(); };
  $('pyL').onchange = function(e){ pyS.l = +e.target.value; ch(); };
  $('pySwap').onclick = function(){ this.blur(); var x = pyS.r; pyS.r = pyS.l; pyS.l = x; ch(); };
  $('pyBpm').onchange = function(e){ pyS.bpm = Math.max(20, Math.min(200, Math.round(+e.target.value) || 60)); ch(); };
  [['pyMuteR','muteR'],['pyMuteL','muteL'],['pyPulse','pulse'],['pyGridChk','grid'],['pyCi','ci'],['pyTapChk','tap']].forEach(function(x){ $(x[0]).onchange = function(e){ pyS[x[1]] = e.target.checked; ch(); }; });
  $('pyStart').onclick = function(){ this.blur(); pyToggle(); };
  $('pyPadL').onpointerdown = function(e){ e.preventDefault(); pyTapKey('L'); };
  $('pyPadR').onpointerdown = function(e){ e.preventDefault(); pyTapKey('R'); };
  document.querySelectorAll('#pyView select, #pyView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
}
function pyTempo(d){ pyS.bpm = Math.max(20, Math.min(200, pyS.bpm + d)); $('pyBpm').value = pyS.bpm; rtSave(PY_KEY, pyS); if (rtRun && $('pyView').classList.contains('playing')) pyStart(); }

/* ================= Tempo-ladder ================= */
var TP_KEY = 'tempoladder-settings', TP_REC = 'tempoladder-records';
var TP_CRIT = { streng:{ spread:18, mean:25 }, normaal:{ spread:28, mean:40 }, ruim:{ spread:42, mean:60 } };
var TP_SUBN = { 1:'kwarten', 2:'achtsten', 3:'triolen', 4:'zestienden' };
var tpS = null, tpR = null;
function tpDefaults(){ return { mode:'meten', sub:2, beats:4, start:60, step:4, max:160, bars:4, crit:'normaal', hit:90, after:'terug', fails:2, subClick:false }; }
function tpRecs(){ try { return JSON.parse(localStorage.getItem(TP_REC)) || {}; } catch(e){ return {}; } }
function tpRecKey(){ return tpS.mode === 'zelf' ? 'zelf' : String(tpS.sub); }
function tpRenderRecs(){
  var R = tpRecs(), list = [['1','kwarten'],['2','achtsten'],['3','triolen'],['4','zestienden'],['zelf','zelf beoordeeld']].filter(function(x){ return R[x[0]]; });
  $('tpRecs').innerHTML = list.length ? 'Je records: ' + list.map(function(x){ var r = R[x[0]]; return '<span class="tprec"><b>' + x[1] + '</b> ♩ = ' + r.bpm + ' <small>' + new Date(r.d).toLocaleDateString('nl') + '</small></span>'; }).join('') : '<span class="muted">Nog geen records. Je hoogste strakke tempo per onderverdeling komt hier te staan.</span>';
}
function tpSetRec(bpm){
  var R = tpRecs(), k = tpRecKey();
  if (!R[k] || bpm > R[k].bpm){ R[k] = { bpm:bpm, d:Date.now() }; try { localStorage.setItem(TP_REC, JSON.stringify(R)); } catch(e){} tpRenderRecs(); return true; }
  return false;
}
function tpStart(){
  tpR = { bpm:tpS.start, rungs:[], failRow:0, best:0, done:false, tap:rtTapNew(), phase:null };
  tpRung();
}
// één trede: 1 maat aftellen, dan 'bars' maten meten (of zelf spelen), dan beslissen
function tpRung(){
  var R = tpR, bpm = R.bpm, beats = tpS.beats, sub = tpS.sub, ci = beats, meas = tpS.bars * beats * sub, dt = 60 / bpm / sub;
  var rung = { bpm:bpm, ok:null, s:null, from:R.tap.ex.length };
  R.rungs.push(rung); R.cur = rung; tpDraw();
  $('tpBpmNow').textContent = '♩ = ' + bpm; $('tpStart').textContent = '■ Stop'; $('tpView').classList.add('playing');
  $('tpJudge').hidden = true;
  var t = null, endT = 0;
  rtLoop({
    gen:function(i, start){
      if (t == null) t = start;
      if (i < ci){ var tc = t; t += 60 / bpm; return { t:tc, play:function(tt){ Engine.click(tt, i === 0 ? 'accent' : 'beat'); }, ui:function(){ $('tpPhase').textContent = 'aftellen ' + (ci - i) + ' · ' + (tpS.mode === 'meten' ? 'tik mee met de spatiebalk' : 'speel mee'); } }; }
      var j = i - ci; if (j >= meas){ endT = t; return null; }
      var te = t; t += dt;
      var isBeat = j % sub === 0, beat = Math.floor(j / sub) % beats, bar = Math.floor(j / sub / beats);
      if (tpS.mode === 'meten') rtExpect(R.tap, te, '', dt / 2);
      return { t:te, play:function(tt){ if (isBeat) Engine.click(tt, beat === 0 ? 'accent' : 'beat'); else if (tpS.subClick) Engine.click(tt, 'sub'); },
               ui:isBeat && beat === 0 ? function(){ $('tpPhase').textContent = 'maat ' + (bar + 1) + ' van ' + tpS.bars; } : null };
    },
    onEnd:function(){ tpEndRung(); },
    onStop:function(){ if (!tpR || tpR.phase !== 'end'){ $('tpView').classList.remove('playing'); $('tpStart').textContent = '▶ Start'; } }
  });
  R.phase = 'play';
}
function tpEndRung(){
  var R = tpR; if (!R) return; R.phase = 'end';
  if (tpS.mode === 'zelf'){
    $('tpPhase').textContent = 'Was het strak op ♩ = ' + R.bpm + '?'; $('tpJudge').hidden = false;
    $('tpView').classList.remove('playing'); $('tpStart').textContent = '▶ Start';
    return;
  }
  var list = R.tap.ex.slice(R.cur.from), s = rtSum(list), C = TP_CRIT[tpS.crit];
  R.cur.s = s;
  tpDecide(s.pct >= tpS.hit && s.spread <= C.spread && Math.abs(s.mean) <= C.mean);
}
function tpDecide(ok){
  var R = tpR; if (!R) return;
  R.cur.ok = ok; $('tpJudge').hidden = true;
  if (ok){ R.failRow = 0; R.best = Math.max(R.best, R.bpm); var rec = tpSetRec(R.bpm); if (rec) R.newRec = true; }
  else R.failRow++;
  tpDraw();
  var msg = '';
  if (ok && R.bpm >= tpS.max){ msg = '🎉 Doel gehaald: strak op ♩ = ' + R.bpm + '!'; return tpFinish(msg); }
  if (!ok && R.failRow >= tpS.fails){ msg = 'Klaar. ' + (R.best ? 'Je hoogste strakke tempo vandaag: ♩ = ' + R.best + '.' : 'Begin wat langzamer, dan lukt het wel.'); return tpFinish(msg); }
  if (ok) R.bpm = Math.min(tpS.max, R.bpm + tpS.step);
  else if (tpS.after === 'terug') R.bpm = Math.max(20, R.bpm - tpS.step);
  $('tpMsg').className = 'qmsg ' + (ok ? 'good' : 'bad');
  $('tpMsg').textContent = ok ? 'Strak! Volgende trede: ♩ = ' + R.bpm + '.' : 'Nog niet strak genoeg' + (R.cur.s ? ' (' + Math.round(R.cur.s.pct) + '% raak, spreiding ±' + Math.round(R.cur.s.spread) + ' ms)' : '') + '. ' + (tpS.after === 'terug' ? 'Een trede terug: ♩ = ' + R.bpm + '.' : 'Nog eens op ♩ = ' + R.bpm + '.');
  tpRung();
}
function tpFinish(msg){
  rtStopAll(); var R = tpR; R.done = true; R.phase = 'done';
  $('tpView').classList.remove('playing'); $('tpStart').textContent = '▶ Start'; $('tpJudge').hidden = true;
  $('tpPhase').textContent = '';
  $('tpMsg').className = 'qmsg good'; $('tpMsg').textContent = msg + (R.newRec ? ' Nieuw record!' : '');
}
function tpTapKey(){
  var pad = $('tpPad'); pad.classList.add('flash'); setTimeout(function(){ pad.classList.remove('flash'); }, 90);
  if (!tpR || tpS.mode !== 'meten' || !rtRun) return;
  var e = rtTap(tpR.tap), live = $('tpLive');
  live.textContent = e ? (Math.abs(e.off) <= 5 ? 'precies!' : rtMs(e.off)) : 'extra tik';
  live.className = 'taplive ' + (e ? (Math.abs(e.off) <= 30 ? 'tg' : Math.abs(e.off) <= 60 ? 'tk' : 'to') : 'tb');
}
function tpDraw(){
  var R = tpR, box = $('tpLadder'); if (!R || !R.rungs.length){ box.innerHTML = ''; return; }
  var W = 640, H = 160, P = 28, list = R.rungs, max = Math.max(tpS.max, list.reduce(function(a, r){ return Math.max(a, r.bpm); }, 0)), min = Math.min(tpS.start, list.reduce(function(a, r){ return Math.min(a, r.bpm); }, 999)) - tpS.step;
  var x = function(i){ return P + (W - P - 8) * (list.length < 2 ? .5 : i / Math.max(list.length - 1, 1)); }, y = function(b){ return H - P - (H - 2 * P) * (b - min) / Math.max(1, max - min); };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tpsvg" role="img" aria-label="Tempo per trede">' +
    '<line x1="' + P + '" x2="' + (W - 8) + '" y1="' + y(tpS.max) + '" y2="' + y(tpS.max) + '" class="tpgoal"/><text x="' + (P + 2) + '" y="' + (y(tpS.max) - 5) + '" text-anchor="start" class="tplbl">doel ' + tpS.max + '</text>';
  svg += '<polyline class="tpline" points="' + list.map(function(r, i){ return x(i) + ',' + y(r.bpm); }).join(' ') + '"/>';
  list.forEach(function(r, i){ svg += '<circle cx="' + x(i) + '" cy="' + y(r.bpm) + '" r="6" class="tpdot ' + (r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'cur') + '"><title>♩ = ' + r.bpm + (r.s ? ' · ' + Math.round(r.s.pct) + '% raak · ±' + Math.round(r.s.spread) + ' ms' : '') + '</title></circle>' +
    '<text x="' + x(i) + '" y="' + (y(r.bpm) - 10) + '" text-anchor="middle" class="tplbl">' + r.bpm + '</text>'; });
  box.innerHTML = svg + '</svg>' +
    '<table class="tptab"><thead><tr><th>Trede</th><th>Tempo</th>' + (tpS.mode === 'meten' ? '<th>Raak</th><th>Gemiddeld</th><th>Spreiding</th>' : '') + '<th></th></tr></thead><tbody>' +
    list.slice().reverse().map(function(r, k){ var s = r.s; return '<tr><td>' + (list.length - k) + '</td><td>♩ = ' + r.bpm + '</td>' + (tpS.mode === 'meten' ? '<td>' + (s ? Math.round(s.pct) + '%' : '…') + '</td><td>' + (s ? rtMs(s.mean) : '') + '</td><td>' + (s ? '±' + Math.round(s.spread) + ' ms' : '') + '</td>' : '') + '<td>' + (r.ok === true ? '✓' : r.ok === false ? '✗' : '…') + '</td></tr>'; }).join('') + '</tbody></table>';
}
function tpToggle(){
  if (rtRun && $('tpView').classList.contains('playing')){ rtStopAll(); if (tpR){ tpR.phase = 'done'; } $('tpPhase').textContent = 'Gestopt.'; $('tpJudge').hidden = true; return; }
  $('tpMsg').textContent = ''; $('tpMsg').className = 'qmsg'; tpStart();
}
function tpSyncUI(){
  $('tpMode').value = tpS.mode; $('tpSub').value = String(tpS.sub); $('tpBeats').value = String(tpS.beats); $('tpStartBpm').value = tpS.start; $('tpStep').value = tpS.step; $('tpMax').value = tpS.max;
  $('tpBars').value = String(tpS.bars); $('tpCrit').value = tpS.crit; $('tpHit').value = String(tpS.hit); $('tpAfter').value = tpS.after; $('tpFails').value = String(tpS.fails); $('tpSubClick').checked = tpS.subClick;
  $('tpView').classList.toggle('zelf', tpS.mode === 'zelf'); $('tpBpmNow').textContent = '♩ = ' + tpS.start;
  tpRenderRecs();
}
function tpInit(){
  tpS = rtLoad(TP_KEY, tpDefaults());
  tpSyncUI();
  var ch = function(){ rtSave(TP_KEY, tpS); tpSyncUI(); };
  $('tpMode').onchange = function(e){ tpS.mode = e.target.value; ch(); };
  [['tpSub','sub'],['tpBeats','beats'],['tpBars','bars'],['tpHit','hit'],['tpFails','fails']].forEach(function(x){ $(x[0]).onchange = function(e){ tpS[x[1]] = +e.target.value; ch(); }; });
  [['tpCrit','crit'],['tpAfter','after']].forEach(function(x){ $(x[0]).onchange = function(e){ tpS[x[1]] = e.target.value; ch(); }; });
  [['tpStartBpm','start',20,300],['tpStep','step',1,30],['tpMax','max',30,300]].forEach(function(x){ $(x[0]).onchange = function(e){ tpS[x[1]] = Math.max(x[2], Math.min(x[3], Math.round(+e.target.value) || x[2])); ch(); }; });
  $('tpSubClick').onchange = function(e){ tpS.subClick = e.target.checked; ch(); };
  $('tpStart').onclick = function(){ this.blur(); tpToggle(); };
  $('tpOk').onclick = function(){ this.blur(); if (tpR && tpR.phase === 'end') tpDecide(true); };
  $('tpBad').onclick = function(){ this.blur(); if (tpR && tpR.phase === 'end') tpDecide(false); };
  $('tpPad').onpointerdown = function(e){ e.preventDefault(); tpTapKey(); };
  document.querySelectorAll('#tpView select, #tpView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
}

/* ================= Swing ================= */
var SW_TYPES = [
  { id:'recht',  nl:'Recht',          r:.50, key:'1', uitleg:'Twee gelijke achtsten (50 : 50). Geen swing: zoals klassiek of pop.' },
  { id:'licht',  nl:'Lichte swing',   r:.58, key:'2', uitleg:'Net iets lang-kort (ongeveer 58 : 42). Hoor je in snelle jazz en veel latin/funk-achtige swing.' },
  { id:'triool', nl:'Triool-swing',   r:2 / 3, key:'3', uitleg:'Lang-kort als 2 : 1, alsof de tel een triool is met de middelste stil (67%). De "standaard" jazzswing.' },
  { id:'zwaar',  nl:'Zware swing',    r:.75, key:'4', uitleg:'Gepunteerd: 3 : 1, een gepunteerde achtste en een zestiende (75%). Shuffle, hard swingend.' }
];
var SW_LEVELS = [
  { id:'s1', name:'1 · recht of triool-swing',            set:['recht','triool'],              tempo:[90, 150] },
  { id:'s2', name:'2 · recht, licht of triool',           set:['recht','licht','triool'],      tempo:[90, 150] },
  { id:'s3', name:'3 · licht, triool of zwaar',           set:['licht','triool','zwaar'],      tempo:[90, 150] },
  { id:'s4', name:'4 · alle vier',                         set:['recht','licht','triool','zwaar'], tempo:[90, 150] },
  { id:'s5', name:'5 · alle vier, ook snel (tot 220)',    set:['recht','licht','triool','zwaar'], tempo:[80, 220] }
];
var SW_KEY = 'swing-settings';
var swS = null, swQ = null, swScore = { right:0, total:0, streak:0 }, swTap = null, swMeas = null;
function swDefaults(){ return { mode:'luister', level:'s1', set:['recht','triool'], tmin:90, tmax:150, bars:2, auto:true, bpm:120, target:'triool', metroOn:'24', guide:false }; }
function swType(id){ return SW_TYPES.find(function(t){ return t.id === id; }); }
Score.def('swing', {
  name:'Swing', view:'swing',
  label:function(k){ var t = swType(k); return t ? t.nl : k; },
  level:function(){ return swS.level; },
  levelName:function(lv){ var L = SW_LEVELS.find(function(l){ return l.id === lv; }); return L ? 'niveau ' + L.name : 'eigen selectie'; },
  next:function(lv){ var i = SW_LEVELS.findIndex(function(l){ return l.id === lv; }); return i >= 0 && i < SW_LEVELS.length - 1 ? 'niveau ' + SW_LEVELS[i + 1].name : 'meet je eigen swing (stand Meetikken)'; }
});
// speel 'bars' maten achtsten met swing-verhouding r: ride op alle achtsten (2 en 4 iets harder), zachte bas op de tel
function swPlay(r, bpm, bars, onEnd){
  rtStopAll(); ensureCtx();
  var bd = 60 / bpm, total = bars * 4, t0 = null;
  rtLoop({
    gen:function(i, start){
      if (t0 == null) t0 = start;
      var beat = Math.floor(i / 2), off = i % 2; if (beat >= total) return null;
      var t = t0 + beat * bd + (off ? r * bd : 0), b = beat % 4;
      return { t:t, play:function(tt){ rtHit(tt, 'ride', off ? .6 : (b === 1 || b === 3 ? 1 : .8)); if (!off) rtHit(tt, 'kick', b === 0 ? .8 : .5); if (!off && (b === 1 || b === 3)) Engine.click(tt, 'sub'); } };
    },
    onEnd:onEnd || null,
    onStop:function(){ $('swView').classList.remove('playing'); }
  });
  $('swView').classList.add('playing');
}
function swNew(autoplay){
  rtStopAll(); Score.ask('swing');
  var set = swS.set.length ? swS.set : ['recht','triool'], tally = Score.tally('swing', 20), prev = swQ.type;
  var cand = set.length > 1 ? set.filter(function(x){ return x !== prev || Math.random() < .3; }) : set;
  swQ.type = hrPickW(cand, function(k){ return hrErrW(tally, k); });
  swQ.bpm = Math.round((swS.tmin + Math.random() * (swS.tmax - swS.tmin)) / 2) * 2; swQ.answered = false;
  $('swAskBpm').textContent = '♩ = ' + swQ.bpm; $('swMsg').className = 'qmsg'; $('swMsg').textContent = ''; $('swAfter').hidden = true;
  swRenderPad();
  if (autoplay) swPlayQ();
}
function swPlayQ(){ if (!swQ || !swQ.type) return; Score.heard('swing'); swPlay(swType(swQ.type).r, swQ.bpm, swS.bars); }
function swAnswer(id){
  if (!swQ || !swQ.type) return;
  if (swQ.answered){ swPlay(swType(id).r, swQ.bpm, swS.bars); return; }
  if (swS.set.indexOf(id) < 0) return;
  swQ.answered = true;
  var ok = id === swQ.type, t = swType(swQ.type), a = swType(id);
  Score.log('swing', [{ k:swQ.type, q:'♩ = ' + swQ.bpm, a:a.nl, ok:ok }]);
  swScore.total++; if (ok){ swScore.right++; swScore.streak++; } else swScore.streak = 0;
  $('swRight').textContent = swScore.right; $('swTotal').textContent = swScore.total; $('swStreak').textContent = swScore.streak; $('swToday').textContent = Score.today('swing');
  $('swMsg').className = 'qmsg ' + (ok ? 'good' : 'bad');
  $('swMsg').innerHTML = (ok ? 'Goed! ' : 'Het was <b>' + t.nl.toLowerCase() + '</b>; jij koos ' + a.nl.toLowerCase() + '. ') + t.uitleg + ' Klik op de knoppen om ze te vergelijken.';
  document.querySelectorAll('#swPad .swbtn').forEach(function(b){ b.classList.toggle('right', b.dataset.t === swQ.type); b.classList.toggle('wrong', !ok && b.dataset.t === id); });
  $('swAfter').hidden = false; swRenderStats();
  if (ok && swS.auto) rtUiTimers.push(setTimeout(function(){ if (view === 'swing') swNew(true); }, 1400));
}
function swRenderPad(){
  $('swPad').innerHTML = SW_TYPES.filter(function(t){ return swS.set.indexOf(t.id) >= 0; }).map(function(t){
    return '<button type="button" class="swbtn" data-t="' + t.id + '"><strong>' + t.nl + '</strong><small>' + Math.round(t.r * 100) + ' : ' + Math.round(100 - t.r * 100) + '</small>' + swBar(t.r) + '<kbd>' + t.key + '</kbd></button>';
  }).join('');
  $('swPad').querySelectorAll('.swbtn').forEach(function(b){ b.onclick = function(){ b.blur(); swAnswer(b.dataset.t); }; });
}
function swBar(r){ return '<span class="swbar"><i style="width:' + (r * 100) + '%"></i><i style="width:' + ((1 - r) * 100) + '%"></i></span>'; }
function swRenderStats(){ $('swStats').innerHTML = hrStatsHTML('swing', function(k){ var t = swType(k); return t ? t.nl : k; }, 'Nog geen antwoorden. De soort die je het vaakst mist komt bovenaan en komt ook vaker terug.'); }
/* --- meetikken: jij tikt achtsten, de app meet waar je tweede achtste valt --- */
function swMeasStart(){
  var bpm = swS.bpm, bd = 60 / bpm, tgt = swType(swS.target).r, t0 = null;
  swTap = []; swMeas = { beats:[], bd:bd }; swMeasShow();
  $('swMStart').textContent = '■ Stop';
  rtLoop({
    gen:function(i, start){
      if (t0 == null) t0 = start + bd * 4;   // 4 tellen aftellen
      if (i < 4){ var tc = start + i * bd; return { t:tc, play:function(tt){ Engine.click(tt, i === 0 ? 'accent' : 'beat'); }, ui:function(){ $('swPhase').textContent = 'aftellen ' + (4 - i); } }; }
      var k = i - 4, beat = Math.floor(k / 2), off = k % 2, b = beat % 4, t = t0 + beat * bd + (off ? tgt * bd : 0);
      if (!off) swMeas.beats.push(t);
      return { t:t, play:function(tt){
        if (!off && (swS.metroOn === 'alle' || b === 1 || b === 3)) Engine.click(tt, b === 0 && swS.metroOn === 'alle' ? 'accent' : 'beat');
        if (swS.guide) rtHit(tt, 'ride', off ? .35 : .45);
      }, ui:!off && b === 0 ? function(){ $('swPhase').textContent = 'tik achtsten met de spatiebalk'; swMeasShow(); } : null };
    },
    onStop:function(){ $('swMStart').textContent = '▶ Start'; $('swPhase').textContent = ''; swMeasShow(true); $('swView').classList.remove('playing'); }
  });
  $('swView').classList.add('playing');
}
function swMeasTap(){
  var pad = $('swPadTap'); pad.classList.add('flash'); setTimeout(function(){ pad.classList.remove('flash'); }, 90);
  if (!swMeas || !rtRun || swS.mode !== 'meten') return;
  swTap.push(rtNowHeard());
}
// per tel: de tik dichtst bij de tel (binnen ±25%) en de tik in het tweede deel van de tel (30–90%) → verhouding
function swAnalyse(){
  if (!swMeas) return null;
  var bd = swMeas.bd, rs = [], on = [], now = actx ? rtNowHeard() : 0;
  swMeas.beats.forEach(function(tb){
    if (tb + bd > now) return;
    var a = null, b = null;
    swTap.forEach(function(x){ var d = x - tb; if (Math.abs(d) <= .25 * bd && (a === null || Math.abs(d) < Math.abs(a))) a = d; if (d > .3 * bd && d < .9 * bd && (b === null || Math.abs(d - .62 * bd) < Math.abs(b - .62 * bd))) b = d; });
    if (a !== null) on.push(a * 1000);
    if (b !== null) rs.push(b / bd);
  });
  if (!rs.length) return { n:0, on:on };
  var recent = rs.slice(-16), mean = recent.reduce(function(x, y){ return x + y; }, 0) / recent.length;
  var sd = Math.sqrt(recent.reduce(function(x, y){ return x + (y - mean) * (y - mean); }, 0) / recent.length);
  var onMean = on.length ? on.slice(-16).reduce(function(x, y){ return x + y; }, 0) / Math.min(16, on.length) : 0;
  return { n:rs.length, mean:mean, sd:sd, on:on, onMean:onMean };
}
function swMeasShow(final){
  var A = swAnalyse(), box = $('swMeasOut'), tgt = swType(swS.target).r;
  if (!A || !A.n){ box.innerHTML = '<p class="muted">' + (rtRun ? 'Tik achtsten: op de tel en ertussen, met swing.' : 'Druk op Start, wacht 4 tellen af en tik achtsten met de spatiebalk (of op het vak).') + '</p>' + swGauge(null, tgt); return; }
  var pct = Math.round(A.mean * 100), near = SW_TYPES.reduce(function(a, t){ return Math.abs(t.r - A.mean) < Math.abs(a.r - A.mean) ? t : a; });
  var diff = Math.round((A.mean - tgt) * 100);
  box.innerHTML = swGauge(A.mean, tgt) +
    '<div class="swnums"><span>Jouw swing: <b>' + pct + ' : ' + (100 - pct) + '</b> (het dichtst bij ' + near.nl.toLowerCase() + ')</span>' +
    '<span>Doel: ' + Math.round(tgt * 100) + ' : ' + Math.round(100 - tgt * 100) + ' · ' + (Math.abs(diff) <= 2 ? '<b>precies goed</b>' : diff > 0 ? '<b>' + diff + '%</b> te zwaar (tweede achtste te laat)' : '<b>' + (-diff) + '%</b> te recht (tweede achtste te vroeg)') + '</span>' +
    '<span>Gelijkmatig: ±' + Math.round(A.sd * 100) + '% ' + (A.sd < .03 ? '(heel constant)' : A.sd < .06 ? '(redelijk)' : '(wisselend)') + '</span>' +
    '<span>Op de tel: gemiddeld ' + rtMs(A.onMean) + '</span><span class="muted">' + A.n + ' tellen gemeten' + (final ? '' : ', laatste 16 tellen telt') + '</span></div>';
}
function swGauge(v, tgt){
  var x = function(r){ return Math.max(0, Math.min(100, (r - .45) / .35 * 100)); };
  return '<div class="swgauge"><div class="swscale">' + SW_TYPES.map(function(t){ return '<span class="swtick" style="left:' + x(t.r) + '%"><small>' + t.nl + '</small></span>'; }).join('') +
    '<span class="swtgt" style="left:' + x(tgt) + '%"></span>' + (v != null ? '<span class="swme" style="left:' + x(v) + '%"></span>' : '') + '</div></div>';
}
function swSyncUI(){
  $('swModeSel').value = swS.mode; $('swLevel').value = swS.level; $('swTmin').value = swS.tmin; $('swTmax').value = swS.tmax; $('swBars').value = String(swS.bars); $('swAuto').checked = swS.auto;
  $('swBpm').value = swS.bpm; $('swTarget').value = swS.target; $('swMetroOn').value = swS.metroOn; $('swGuide').checked = swS.guide;
  document.querySelectorAll('#swChips input').forEach(function(inp){ inp.checked = swS.set.indexOf(inp.value) >= 0; });
  $('swView').classList.toggle('meten', swS.mode === 'meten');
  document.querySelectorAll('#swSeg button').forEach(function(b){ b.classList.toggle('on', b.dataset.m === swS.mode); });
}
function swMatchLevel(){
  var L = SW_LEVELS.find(function(l){ return l.set.slice().sort().join() === swS.set.slice().sort().join() && l.tempo[0] === swS.tmin && l.tempo[1] === swS.tmax; });
  swS.level = L ? L.id : 'eigen'; $('swLevel').value = swS.level;
}
function swSetMode(m){ rtStopAll(); swS.mode = m; rtSave(SW_KEY, swS); swSyncUI(); if (m === 'meten') swMeasShow(); }
function swInit(){
  swS = rtLoad(SW_KEY, swDefaults()); swQ = { type:null };
  if (!Array.isArray(swS.set) || swS.set.length < 2) swS.set = ['recht','triool'];
  $('swLevel').innerHTML = SW_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie</option>';
  $('swChips').innerHTML = SW_TYPES.map(function(t){ return '<label class="chip"><input type="checkbox" value="' + t.id + '"> ' + t.nl + ' <span class="muted">' + Math.round(t.r * 100) + '%</span></label>'; }).join('');
  $('swTarget').innerHTML = SW_TYPES.map(function(t){ return '<option value="' + t.id + '">' + t.nl + ' (' + Math.round(t.r * 100) + ' : ' + Math.round(100 - t.r * 100) + ')</option>'; }).join('');
  swSyncUI();
  var ch = function(renew){ rtSave(SW_KEY, swS); if (renew) swNew(false); };
  $('swLevel').onchange = function(e){ var L = SW_LEVELS.find(function(l){ return l.id === e.target.value; }); swS.level = e.target.value; if (L){ swS.set = L.set.slice(); swS.tmin = L.tempo[0]; swS.tmax = L.tempo[1]; } swSyncUI(); ch(true); };
  $('swChips').onchange = function(){ var set = []; document.querySelectorAll('#swChips input:checked').forEach(function(i){ set.push(i.value); }); if (set.length < 2){ swSyncUI(); return; } swS.set = set; swMatchLevel(); ch(true); };
  [['swTmin','tmin'],['swTmax','tmax']].forEach(function(x){ $(x[0]).onchange = function(e){ swS[x[1]] = Math.max(40, Math.min(300, Math.round(+e.target.value) || 100)); if (swS.tmin > swS.tmax){ var t = swS.tmin; swS.tmin = swS.tmax; swS.tmax = t; } swSyncUI(); swMatchLevel(); ch(false); }; });
  $('swBars').onchange = function(e){ swS.bars = +e.target.value; ch(false); };
  $('swAuto').onchange = function(e){ swS.auto = e.target.checked; ch(false); };
  $('swModeSel').onchange = function(e){ swSetMode(e.target.value); };
  document.querySelectorAll('#swSeg button').forEach(function(b){ b.onclick = function(){ b.blur(); swSetMode(b.dataset.m); }; });
  $('swBpm').onchange = function(e){ swS.bpm = Math.max(40, Math.min(300, Math.round(+e.target.value) || 120)); e.target.value = swS.bpm; ch(false); };
  $('swTarget').onchange = function(e){ swS.target = e.target.value; ch(false); swMeasShow(); };
  $('swMetroOn').onchange = function(e){ swS.metroOn = e.target.value; ch(false); };
  $('swGuide').onchange = function(e){ swS.guide = e.target.checked; ch(false); };
  $('swPlayBtn').onclick = function(){ this.blur(); swPlayQ(); };
  $('swNext').onclick = function(){ this.blur(); swNew(true); };
  $('swMStart').onclick = function(){ this.blur(); if (rtRun) rtStopAll(); else swMeasStart(); };
  $('swPadTap').onpointerdown = function(e){ e.preventDefault(); swMeasTap(); };
  $('swReset').onclick = function(){ Score.clear('swing'); swRenderStats(); $('swToday').textContent = 0; };
  document.querySelectorAll('#swView select, #swView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('swToday').textContent = Score.today('swing');
  swNew(false); swRenderStats(); swMeasShow();
}

/* --- route en toetsen --- */
var RT_VIEWS = ['rudiments','polyritme','tempoladder','swing'];
function rtOnRoute(){ rtStopAll(); if (tpR && tpR.phase !== 'done'){ tpR.phase = 'done'; $('tpJudge').hidden = true; } }
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || RT_VIEWS.indexOf(view) < 0) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (Keys.blocked(e)) return;
  var shift = e.shiftKey ? 5 : 1;
  if (view === 'rudiments'){
    if (Keys.is(e, 'pauze')){ e.preventDefault(); if (!e.repeat) rdPause(); }
    else if (Keys.is(e, 'metronoom') || Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) rdToggle(); }
    else if (Keys.is(e, 'sneller')){ e.preventDefault(); rdTempo(shift); }
    else if (Keys.is(e, 'langzamer')){ e.preventDefault(); rdTempo(-shift); }
    else if (Keys.is(e, 'volgende')){ e.preventDefault(); $('rdNextBtn').click(); }
    else if (Keys.is(e, 'vorige')){ e.preventDefault(); $('rdPrev').click(); }
  } else if (view === 'polyritme'){
    if (e.key === 'f' || e.key === 'F'){ e.preventDefault(); if (!e.repeat) pyTapKey('L'); }
    else if (e.key === 'j' || e.key === 'J'){ e.preventDefault(); if (!e.repeat) pyTapKey('R'); }
    else if (Keys.is(e, 'metronoom') || Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) pyToggle(); }
    else if (Keys.is(e, 'sneller')){ e.preventDefault(); pyTempo(shift); }
    else if (Keys.is(e, 'langzamer')){ e.preventDefault(); pyTempo(-shift); }
  } else if (view === 'tempoladder'){
    if (Keys.is(e, 'tik')){ e.preventDefault(); if (!e.repeat) tpTapKey(); }
    else if (Keys.is(e, 'metronoom')){ e.preventDefault(); tpToggle(); }
    else if (tpR && tpR.phase === 'end' && tpS.mode === 'zelf' && Keys.is(e, 'volgende')){ e.preventDefault(); tpDecide(true); }
    else if (tpR && tpR.phase === 'end' && tpS.mode === 'zelf' && Keys.is(e, 'vorige')){ e.preventDefault(); tpDecide(false); }
    else if (Keys.is(e, 'volgende') && !(tpR && tpR.phase === 'play')){ e.preventDefault(); tpToggle(); }
  } else if (view === 'swing'){
    if (swS.mode === 'meten'){
      if (Keys.is(e, 'tik')){ e.preventDefault(); if (!e.repeat) swMeasTap(); }
      else if (Keys.is(e, 'metronoom') || Keys.is(e, 'volgende')){ e.preventDefault(); if (rtRun) rtStopAll(); else swMeasStart(); }
    } else {
      if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) swPlayQ(); }
      else if (Keys.is(e, 'volgende')){ e.preventDefault(); swNew(true); }
      else if (/^[1-4]$/.test(e.key)){ var t = SW_TYPES.find(function(x){ return x.key === e.key; }); if (t && swS.set.indexOf(t.id) >= 0) swAnswer(t.id); }
    }
  }
});
document.addEventListener('keyup', function(e){ if (typeof view !== 'undefined' && RT_VIEWS.indexOf(view) >= 0 && (e.key === ' ' || e.code === 'Space')) e.preventDefault(); });
rdInit(); pyInit(); tpInit(); swInit();
