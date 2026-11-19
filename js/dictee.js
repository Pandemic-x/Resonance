/* ================= Melodisch dictee ================= */
/* Hergebruikt uit relatief.js: GDEG, GSCALE, GKEYS, GLET, GLET_PC, GSTEP, gFlats, gCap, gKeyName, gNote. Klank via Engine (engine.js). */
var MLEVELS = [
  { id:'m1', name:'1 · 3 noten, stappen (do–sol)',        mode:'maj', len:3, moves:'stap', range:'kwint', rhythm:'geen', bars:1 },
  { id:'m2', name:'2 · 4 noten, stappen (do–sol)',        mode:'maj', len:4, moves:'stap', range:'kwint', rhythm:'geen', bars:1 },
  { id:'m3', name:'3 · 5 noten, + drieklanksprongen',     mode:'maj', len:5, moves:'drie', range:'oct',   rhythm:'geen', bars:1 },
  { id:'m4', name:'4 · 6 noten, vrije sprongen',          mode:'maj', len:6, moves:'vrij', range:'oct',   rhythm:'geen', bars:1 },
  { id:'m5', name:'5 · 6 noten rond do (sol, – sol)',     mode:'maj', len:6, moves:'vrij', range:'rond',  rhythm:'geen', bars:1 },
  { id:'m6', name:'6 · mineur, 5 noten',                  mode:'min', len:5, moves:'drie', range:'oct',   rhythm:'geen', bars:1 },
  { id:'m7', name:'7 · met ritme: 1 maat',                mode:'maj', len:4, moves:'drie', range:'oct',   rhythm:'een',  bars:1 },
  { id:'m8', name:'8 · met ritme: 2 maten',               mode:'maj', len:6, moves:'vrij', range:'oct',   rhythm:'een',  bars:2 },
  { id:'m9', name:'9 · 2 maten, gepunteerd + mineur',     mode:'min', len:6, moves:'vrij', range:'rond',  rhythm:'gev',  bars:2 }
];
var MDUR = { 1:'8', 2:'q', 3:'qd', 4:'h', 6:'hd', 8:'w' };
var MDURNAME = { 1:'achtste', 2:'kwart', 3:'gepunteerde kwart', 4:'halve', 6:'gepunteerde halve', 8:'hele' };
var MSET_KEY = 'dictee-settings';
var mS = null, mQ = null, mScore = { right:0, total:0, perfect:0, streak:0 }, mTimers = [], mDur = 2, mVFwait = null;

function mDefaults(){ return { level:'m1', mode:'maj', key:'rand', len:3, moves:'stap', range:'kwint', rhythm:'geen', bars:1, tempo:72, timbre:'piano', cadQ:true, first:true, hear:true, auto:false, hoogte:'midden', clefs:['g'], up:2, down:2, acc:false, dbl:false, keysig:false, keys:[] }; }
function mLoad(){ var s = {}; try { s = JSON.parse(localStorage.getItem(MSET_KEY)) || {}; } catch(e){} mS = Object.assign(mDefaults(), s); mS.timbre = Engine.instId(mS.timbre); if (mS.hoogte !== 'balk') mS.hoogte = 'midden'; if (!Array.isArray(mS.clefs) || !mS.clefs.length) mS.clefs = ['g']; }
function mSave(){ try { localStorage.setItem(MSET_KEY, JSON.stringify(mS)); } catch(e){} }
function mStats(){   // uit het gedeelde logboek: {maj:{trap:{r,t}}, min:{...}, ritme:{r,t}, rd:{duur:{r,t}}}
  var t = Score.tally('dictee'), s = { maj:{}, min:{}, ritme:{ r:0, t:0 }, rd:{} };
  Object.keys(t).forEach(function(k){
    var p = k.split(':');
    if (p[0] === 'ritme'){ s.rd[p[1]] = t[k]; s.ritme.r += t[k].r; s.ritme.t += t[k].t; }
    else if (s[p[0]]) s[p[0]][p[1]] = t[k];
  });
  return s;
}
Score.def('dictee', {
  name:'Melodisch dictee', view:'dictee',
  label:function(k){ var p = k.split(':');
    if (p[0] === 'ritme') return 'ritme · ' + (MDURNAME[p[1]] || p[1]);
    return (p[0] === 'maj' ? 'majeur' : 'mineur') + ' · trap ' + GDEG[+p[1]].n + ' (' + (p[0] === 'min' && +p[1] === 11 ? 'ti' : GDEG[+p[1]].sol) + ')'; },
  level:function(){ return mS.level; },
  levelName:function(lv){ var L = MLEVELS.find(function(l){ return l.id === lv; }); return L ? 'niveau ' + L.name : 'eigen instelling'; },
  next:function(lv){ var i = MLEVELS.findIndex(function(l){ return l.id === lv; });
    return i >= 0 && i < MLEVELS.length - 1 ? 'niveau ' + MLEVELS[i + 1].name : 'langere melodieën of een sneller tempo'; }
});
function mRandItem(a){ return a[Math.floor(Math.random() * a.length)]; }

/* --- spelling in de toonsoort --- */
function mDeg(m){ return ((m - mQ.T) % 12 + 12) % 12; }
function mTonicLetter(){
  var fl = gFlats(mQ.pc, mQ.mode);
  var L = fl ? ['c','d','d','e','e','f','g','g','a','a','b','b'] : ['c','c','d','d','e','f','f','g','g','a','a','b'];
  return GLET.indexOf(L[mQ.pc]);
}
function mSpell(m){
  var d = mDeg(m), pc = ((m % 12) + 12) % 12;
  if (GSCALE[mQ.mode].indexOf(d) < 0 && !(mQ.mode === 'min' && d === 11)){
    // toon buiten de toonsoort (chromatische klaviertoets): gewone naam, geen Beses/Ces
    var w = GLET_PC.indexOf(pc), fl = gFlats(mQ.pc, mQ.mode);
    var li0 = w >= 0 ? w : GLET_PC.indexOf(fl ? pc + 1 : pc - 1), a0 = w >= 0 ? 0 : fl ? -1 : 1;
    return { li:li0, acc:a0, oct:Math.round((m - a0 - GLET_PC[li0]) / 12) - 1 };
  }
  var li = (mTonicLetter() + GSTEP[d]) % 7;
  var acc = (((m % 12) + 12) % 12 - GLET_PC[li] + 18) % 12 - 6;
  return { li:li, acc:acc, oct:Math.round((m - acc - GLET_PC[li]) / 12) - 1 };
}
function mDutch(m){
  var s = mSpell(m), L = GLET[s.li], a = s.acc;
  var n = a === 1 ? L + 'is' : a === 2 ? L + 'isis' : a === -2 ? L + 'eses' : a === -1 ? (L === 'e' || L === 'a' ? L + 's' : L + 'es') : L;
  return gCap(n);
}
function mSol(m){ var d = mDeg(m); if (mQ.mode === 'min' && d === 11) return 'ti'; return GDEG[d].sol; }
function mKeySig(){   // per letter de voortekening in deze toonsoort
  var sig = [0,0,0,0,0,0,0];
  GSCALE[mQ.mode].forEach(function(d){ var s = mSpell(mQ.T + d); sig[s.li] = s.acc; });
  return sig;
}
function mVFKey(){
  var tl = GLET[mTonicLetter()].toUpperCase(), acc = mSpell(mQ.T).acc;
  return tl + (acc === 1 ? '#' : acc === -1 ? 'b' : '') + (mQ.mode === 'min' ? 'm' : '');
}

/* --- melodie maken --- */
function mTonic(pc, range){
  var T = pc <= 7 ? 60 + pc : 48 + pc;           // C4 t/m G4, of Gis3 t/m B3
  if (range === 'rond' && T - 5 < 55) T += 12;   // niet onder de G-snaar
  mQ.clef = 'g';
  if (mS.hoogte === 'balk'){                       // volgens sleutel + hulplijnen: melodie past op die balk
    var c = mS.clefs[Math.floor(Math.random() * mS.clefs.length)], w = Theorie.window(c, mS.up, mS.down);
    var r = range === 'kwint' ? [0, 7] : range === 'rond' ? [-5, 7] : [0, 12];
    T += 12 * Theorie.fitOctave(T + r[0], T + r[1], w);
    mQ.clef = c === 'grand' ? (T + r[0] >= 55 ? 'g' : 'f') : c;
  }
  return T;
}
function mBounds(){ var T = mQ.T; return mS.range === 'kwint' ? [T, T + 7] : mS.range === 'rond' ? [T - 5, T + 7] : [T, T + 12]; }
function mPool(){
  var b = mBounds(), sc = GSCALE[mQ.mode], out = [];
  for (var m = b[0]; m <= b[1]; m++) if (sc.indexOf(mDeg(m)) >= 0) out.push(m);
  return out;
}
function mGenPitches(n){
  var pool = mPool(), T = mQ.T, P = pool.length;
  var dos = []; pool.forEach(function(m, i){ if (mDeg(m) === 0) dos.push(i); });
  var triad = []; pool.forEach(function(m, i){ var d = mDeg(m); if (d === 0 || d === 7 || d === (mQ.mode === 'min' ? 3 : 4)) triad.push(i); });
  var clamp = function(i){ return Math.max(0, Math.min(P - 1, i)); };
  var nearestDo = function(i){ return dos.reduce(function(a, b){ return Math.abs(b - i) < Math.abs(a - i) ? b : a; }); };
  var idx = [], cur, lastLeap = 0;
  // begin op do (laag) of, vanaf drieklankniveau, soms op mi of sol
  if (mS.moves === 'stap' || n <= 3 || Math.random() < .55) cur = pool.indexOf(T) >= 0 ? pool.indexOf(T) : dos[0];
  else cur = mRandItem(triad);
  idx.push(cur);
  for (var i = 1; i < n; i++){
    var nx;
    if (n >= 3 && i === n - 1){ nx = nearestDo(cur); if (nx === cur) nx = dos.find(function(x){ return x !== cur; }) ?? cur; }
    else if (n >= 4 && i === n - 2){
      // voorlaatste: re of ti, zodat de melodie met een stap op do eindigt
      var cands = []; dos.forEach(function(dI){ [dI - 1, dI + 1].forEach(function(k){ if (k >= 0 && k < P) cands.push(k); }); });
      nx = cands.reduce(function(a, b){ return Math.abs(b - cur) < Math.abs(a - cur) ? b : a; });
      if (nx === cur) nx = cands.find(function(x){ return x !== cur; }) ?? nx;
    } else {
      var r = Math.random(), stepP = mS.moves === 'stap' ? 1 : mS.moves === 'drie' ? .62 : .55;
      if (Math.abs(lastLeap) >= 3){ nx = clamp(cur - Math.sign(lastLeap)); }          // na een sprong: stap terug
      else if (r < stepP){
        var dir = Math.random() < .5 ? -1 : 1;
        if (cur + dir < 0 || cur + dir >= P) dir = -dir;
        nx = (mS.moves !== 'stap' && Math.random() < .08) ? cur : clamp(cur + dir);
      } else if (mS.moves === 'drie'){
        var t = triad.filter(function(k){ return k !== cur && Math.abs(k - cur) <= 5; });
        nx = t.length ? mRandItem(t) : clamp(cur + 1);
      } else {
        var opts = [];
        for (var k = 0; k < P; k++){ var dd = Math.abs(k - cur); if (dd >= 2 && (dd <= 5 || dd === 7) && Math.abs(pool[k] - pool[cur]) !== 6) opts.push(k); }   // geen tritonus
        nx = opts.length ? mRandItem(opts) : clamp(cur + 1);
      }
    }
    lastLeap = nx - cur; cur = nx; idx.push(cur);
  }
  var ms = idx.map(function(k){ return pool[k]; });
  if (mQ.mode === 'min') for (var j = 0; j < ms.length - 1; j++) if (mDeg(ms[j]) === 10 && ms[j + 1] === ms[j] + 2) ms[j]++;   // leidtoon naar do
  return ms;
}
function mGenRhythm(bars){
  var cells = [{ d:[2], w:4 }, { d:[1,1], w:3 }, { d:[4], w:1.4 }];
  if (mS.rhythm === 'gev') cells.push({ d:[3,1], w:2 }, { d:[1,2,1], w:1 }, { d:[6], w:.5 });
  var out = [];
  for (var b = 0; b < bars; b++){
    var rem = b === bars - 1 ? 4 : 8, start = out.length, guard = 0;
    while (rem > 0 && guard++ < 40){
      var ok = cells.filter(function(c){ var s = c.d.reduce(function(a, x){ return a + x; }, 0); return s <= rem && (s % 2 === 0); });
      var sum = ok.reduce(function(a, c){ return a + c.w; }, 0), r = Math.random() * sum, c = ok[ok.length - 1];
      for (var i = 0; i < ok.length; i++){ r -= ok[i].w; if (r <= 0){ c = ok[i]; break; } }
      c.d.forEach(function(x){ out.push(x); }); rem -= c.d.reduce(function(a, x){ return a + x; }, 0);
    }
    if (b === bars - 1) out.push(4);                       // slot: halve noot
    if (bars === 1 && out.length - start < 3){ out = []; b = -1; }   // te kaal: opnieuw
  }
  return out;
}

/* --- vraag --- */
function mNew(autoplay){
  stop(); mClearTimers(); Score.ask('dictee');
  var changed = false, pc;
  if (mS.key !== 'rand') pc = +mS.key;
  else { var k = 0; do { pc = mRandItem(GKEYS); } while (pc === mQ.pc && k++ < 20); }
  if (pc !== mQ.pc || mQ.mode !== mS.mode || mQ.range !== mS.range || mS.hoogte === 'balk') changed = true;
  mQ.pc = pc; mQ.mode = mS.mode; mQ.range = mS.range; mQ.T = mTonic(pc, mS.range);
  var durs = mS.rhythm === 'geen' ? null : mGenRhythm(mS.bars);
  var n = durs ? durs.length : mS.len;
  var ps = mGenPitches(n);
  var t = 0;
  mQ.target = ps.map(function(m, i){ var d = durs ? durs[i] : 2, o = { m:m, d:d, on:t }; t += d; return o; });
  mQ.total = t; mQ.ans = []; mQ.checked = false; mQ.cadPending = true;
  if (mS.first) mQ.ans.push({ m:mQ.target[0].m, d:mQ.target[0].d, given:true });
  mDur = 2; mSyncDur();
  $('mdKey').textContent = gKeyName(pc, mS.mode) + (durs ? ' · 4/4 · ' + mS.bars + (mS.bars > 1 ? ' maten' : ' maat') : ' · ' + n + ' noten');
  var msg = $('mdMsg'); msg.className = 'qmsg';
  msg.textContent = mS.first ? 'De eerste noot staat er al. Luister, zing mee en schrijf de rest op.' : 'Luister, zing mee en schrijf de melodie op.';
  $('mdAfter').style.display = 'none';
  $('mdSolWrap').style.display = 'none';
  mRenderPiano(); mRenderAll();
  if (autoplay) mPlayQ();
}
function mClearTimers(){ mTimers.forEach(clearTimeout); mTimers = []; }

/* --- klank --- */
function mEighth(){ return 60 / mS.tempo / 2; }
function mClick(t, accent){ Engine.click(t, accent ? 'accent' : 'beat', 0, true); }
function mCadence(t){ return Engine.cadence(t, mQ.T - (mQ.T >= 64 ? 12 : 0), mQ.mode); }
function mPlayNotes(list, t){
  var e = mEighth();
  if (mS.rhythm !== 'geen'){ for (var k = 0; k < 4; k++) mClick(t + k * 2 * e, k === 0); t += 8 * e; }
  list.forEach(function(n){ gNote(t, n.m, Math.max(.15, n.d * e * .92), .42, mS.timbre); t += n.d * e; });
  return t;
}
function mPlayQ(){
  if (!mQ || !mQ.target) return;
  if (!mQ.checked) Score.heard('dictee');
  stop(); ensureCtx();
  var t = actx.currentTime + .08;
  if (mQ.cadPending || mS.cadQ){ t += mCadence(t); mQ.cadPending = false; }
  mPlayNotes(mQ.target, t);
}
function mPlayMine(){ if (!mQ.ans.length) return; stop(); ensureCtx(); mPlayNotes(mQ.ans, actx.currentTime + .08); }
function mPlayCad(){ if (!mQ || mQ.T == null) return; stop(); ensureCtx(); mCadence(actx.currentTime + .08); }
function mPlayDo(){ if (!mQ || mQ.T == null) return; stop(); ensureCtx(); gNote(actx.currentTime + .05, mQ.T, 1.1, .42, mS.timbre); }
function mPing(m){ ensureCtx(); gNote(actx.currentTime + .02, m, .45, .32, mS.timbre); }

/* --- invoer --- */
function mUsed(){ return mQ.ans.reduce(function(a, n){ return a + n.d; }, 0); }
function mFull(){ return mS.rhythm === 'geen' ? mQ.ans.length >= mQ.target.length : mUsed() >= mQ.total; }
function mFlash(text){ var msg = $('mdMsg'); msg.className = 'qmsg bad'; msg.textContent = text; }
function mAdd(m){
  if (mQ.checked){ mPing(m); return; }
  if (mFull()){ mFlash('Je antwoord is al vol. ' + Keys.label('wis') + ' = laatste noot weg, ' + Keys.label('controleer') + ' = controleren.'); return; }
  var d = mS.rhythm === 'geen' ? 2 : mDur;
  if (mS.rhythm !== 'geen'){
    var used = mUsed(), inBar = 8 - (used % 8);
    if (d > inBar){ mFlash('Een ' + MDURNAME[d] + ' past niet meer in deze maat (nog ' + (inBar / 2) + ' tel over).'); return; }
  }
  mQ.ans.push({ m:Math.max(40, Math.min(92, m)), d:d });
  if (mS.hear) mPing(m);
  var msg = $('mdMsg'); msg.className = 'qmsg';
  msg.textContent = mFull() ? 'Klaar? ' + Keys.label('controleer') + ' of ✓ Controleer. ' + Keys.label('luister') + ' = nog eens luisteren.' : '';
  mRenderAll();
}
function mPrevRef(){ var a = mQ.ans; return a.length ? a[a.length - 1].m : mQ.T; }
function mAddDeg(d){
  if (!mQ) return;
  var ref = mPrevRef(), best = null;
  for (var m = ref - 7; m <= ref + 7; m++) if (mDeg(m) === d && (best == null || Math.abs(m - ref) < Math.abs(best - ref))) best = m;
  mAdd(best);
}
function mAddDigit(n){
  mAddDeg(GSCALE[mQ.mode][n - 1]);   // in mineur geeft 7 'te'; met + maak je er de leidtoon (ti) van
}
function mUndo(){
  if (mQ.checked) return;
  var a = mQ.ans; if (!a.length || a[a.length - 1].given) return;
  a.pop(); $('mdMsg').className = 'qmsg'; $('mdMsg').textContent = ''; mRenderAll();
}
function mClearAll(){
  if (mQ.checked) return;
  mQ.ans = mQ.ans.filter(function(n){ return n.given; }); $('mdMsg').className = 'qmsg'; $('mdMsg').textContent = ''; mRenderAll();
}
function mShiftLast(semi){
  if (mQ.checked) return;
  var a = mQ.ans, n = a[a.length - 1]; if (!n || n.given) return;
  n.m = Math.max(40, Math.min(92, n.m + semi));
  if (mS.hear) mPing(n.m);
  mRenderAll();
}
function mSetDur(d){ mDur = d; mSyncDur(); }
function mDotToggle(){ mDur = mDur === 2 ? 3 : mDur === 3 ? 2 : mDur === 4 ? 6 : mDur === 6 ? 4 : mDur; mSyncDur(); }
function mSyncDur(){
  document.querySelectorAll('#mdDurs [data-dur]').forEach(function(b){ b.classList.toggle('on', +b.dataset.dur === mDur); });
}

/* --- controleren --- */
function mCheck(){
  if (!mQ || mQ.checked) return;
  var rh = mS.rhythm !== 'geen';
  var mine = [], t = 0;
  mQ.ans.forEach(function(n){ mine.push({ m:n.m, d:n.d, on:t, given:n.given }); t += n.d; });
  if (!rh) mine.forEach(function(n, i){ n.on = i * 2; });
  var byOn = {}; mine.forEach(function(n){ byOn[n.on] = n; });
  var scored = 0, pitchOk = 0, rhOk = 0, allOk = 0, items = [];
  var qtxt = gKeyName(mQ.pc, mQ.mode) + ': ' + mQ.target.map(function(n){ return mSol(n.m) + (rh ? '/' + n.d : ''); }).join(' ');
  mQ.target.forEach(function(tg, i){
    var u = byOn[tg.on];
    tg.pOk = !!u && u.m === tg.m;
    tg.rOk = !!u && u.d === tg.d;
    tg.ok = tg.pOk && (!rh || tg.rOk);
    if (u) u.ok = tg.ok;
    if (i === 0 && mS.first) return;
    scored++; if (tg.pOk) pitchOk++; if (tg.rOk) rhOk++; if (tg.ok) allOk++;
    var aTxt = u ? mSol(u.m) + (rh ? '/' + u.d : '') : '–';
    items.push({ k:mQ.mode + ':' + mDeg(tg.m), q:qtxt + ' (noot ' + (i + 1) + ')', a:aTxt, ok:tg.pOk });
    if (rh) items.push({ k:'ritme:' + tg.d, q:qtxt + ' (noot ' + (i + 1) + ')', a:aTxt, ok:tg.rOk });
  });
  mine.forEach(function(u){ if (u.ok == null) u.ok = false; });
  Score.log('dictee', items);
  mQ.mine = mine; mQ.checked = true;
  var perfect = allOk === scored && mine.length === mQ.target.length;
  mScore.right += allOk; mScore.total += scored;
  if (perfect){ mScore.perfect++; mScore.streak++; } else mScore.streak = 0;
  $('mdRight').textContent = mScore.right; $('mdTotal').textContent = mScore.total; $('mdPerfect').textContent = mScore.perfect; $('mdStreak').textContent = mScore.streak;
  $('mdToday').textContent = Score.today('dictee');

  var msg = $('mdMsg');
  msg.className = 'qmsg ' + (perfect ? 'good' : 'bad');
  var sol = mQ.target.map(function(n){ return mSol(n.m); }).join(' ');
  msg.textContent = perfect
    ? 'Foutloos! ' + sol + '.'
    : 'Toonhoogte ' + pitchOk + '/' + scored + (rh ? ' · ritme ' + rhOk + '/' + scored : '') + ' goed. Hieronder de juiste melodie: ' + sol + '.';
  $('mdAfter').style.display = '';
  $('mdSolWrap').style.display = '';
  mRenderAll(); mRenderStats();
  if (perfect && mS.auto){
    stop(); ensureCtx();
    var end = mPlayNotes(mQ.target, actx.currentTime + .25);
    mTimers.push(setTimeout(function(){ mNew(true); }, Math.max(400, (end - actx.currentTime) * 1000 + 600)));
  }
}

/* --- tekenen --- */
function mVF(){ return (typeof Vex !== 'undefined' && Vex.Flow) ? Vex.Flow : null; }
function mDrawStaff(el, notes, opt){
  el.innerHTML = '';
  var VF = mVF();
  if (!VF){
    el.innerHTML = '<p class="note">Notenschrift laden…</p>';
    if (!mVFwait){ mVFwait = true; Notatie.ready(function(){ mVFwait = null; mRenderAll(); }); }
    return;
  }
  var rh = mS.rhythm !== 'geen';
  var slots = rh ? mS.bars * 4 : mQ.target.length;   // in kwarten
  var W = Math.max(340, 130 + (rh ? mS.bars * 230 : slots * 52)), H = 150 + 10 * Math.max(0, (mS.hoogte === 'balk' ? Math.max(mS.up, mS.down) : 0) - 2);
  var renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
  renderer.resize(W, H);
  var ctx = renderer.getContext();
  var stave = new VF.Stave(0, 10, W - 2);
  var vfc = Notatie.CLEFS[mQ.clef || 'g'].vf;
  stave.addClef(vfc);
  try { stave.addKeySignature(mVFKey()); } catch(e){}
  if (rh) stave.addTimeSignature('4/4');
  stave.setContext(ctx).draw();

  var sig = mKeySig(), barAcc = {}, pos = 0, tick = [], bars = [[]], colors = [];
  notes.forEach(function(n, i){
    if (rh && pos > 0 && pos % 8 === 0){ tick.push(new VF.BarNote()); bars.push([]); barAcc = {}; }
    var s = mSpell(n.m), key = GLET[s.li] + '/' + s.oct;
    var sn = new VF.StaveNote({ clef:vfc, keys:[key], duration:MDUR[n.d] || 'q', auto_stem:true });
    if (n.d === 3 || n.d === 6) VF.Dot.buildAndAttach([sn], { all:true });
    var cur = barAcc[key] != null ? barAcc[key] : sig[s.li];
    if (s.acc !== cur){
      var sym = s.acc === 0 ? 'n' : s.acc === 1 ? '#' : s.acc === -1 ? 'b' : s.acc === 2 ? '##' : 'bb';
      sn.addModifier(new VF.Accidental(sym), 0);
      barAcc[key] = s.acc;
    }
    if (opt.labels){
      var an = new VF.Annotation(mSol(n.m)); an.setFont('Inter', 12, 'normal');
      an.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
      sn.addModifier(an, 0);
    }
    var col = opt.color ? opt.color(n, i) : null;
    if (col) sn.setStyle({ fillStyle:col, strokeStyle:col });
    tick.push(sn); bars[bars.length - 1].push(sn);
    pos += n.d;
  });
  if (!tick.length) return;
  var voice = new VF.Voice({ num_beats:Math.max(1, slots), beat_value:4 }).setMode(VF.Voice.Mode.SOFT);
  voice.addTickables(tick);
  var avail = W - stave.getNoteStartX() - 20;
  var used = notes.reduce(function(a, n){ return a + n.d; }, 0), full = rh ? mS.bars * 8 : slots * 2;
  new VF.Formatter().joinVoices([voice]).format([voice], Math.max(60, avail * Math.min(1, (used + 1) / full)));
  var beams = [];
  bars.forEach(function(b){ if (b.length > 1) beams = beams.concat(VF.Beam.generateBeams(b, { groups:[new VF.Fraction(2, 8)] })); });
  voice.draw(ctx, stave);
  beams.forEach(function(b){ b.setContext(ctx).draw(); });
  var svg = el.querySelector('svg');
  if (svg){ svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.maxWidth = W + 'px'; svg.style.width = '100%'; svg.style.height = 'auto'; }
}
function mRenderAll(){
  if (!mQ || !mQ.target) return;
  var checked = mQ.checked;
  mDrawStaff($('mdStaff'), mQ.ans, {
    labels: checked,
    color: function(n, i){ if (checked) return mQ.mine[i].given ? '#2563eb' : (mQ.mine[i].ok ? '#16a34a' : '#dc2626'); return n.given ? '#2563eb' : null; }
  });
  if (checked) mDrawStaff($('mdSol'), mQ.target, { labels:true, color:function(n){ return n.ok ? null : '#c2410c'; } });
  var rh = mS.rhythm !== 'geen';
  var prog = rh ? (mUsed() / 2) + ' / ' + (mQ.total / 2) + ' tellen' : mQ.ans.length + ' / ' + mQ.target.length + ' noten';
  $('mdProg').textContent = checked ? '' : prog;
  $('mdDurs').style.display = rh ? '' : 'none';
}
function mRenderPiano(){
  var box = $('mdPiano'); box.innerHTML = '';
  var b = mBounds(), lo = b[0] - 2, hi = b[1] + 2;
  var isBlack = function(m){ return [1,3,6,8,10].indexOf(((m % 12) + 12) % 12) >= 0; };
  while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
  var whites = []; for (var m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  var wW = 100 / whites.length;
  whites.forEach(function(m, i){
    var k = document.createElement('button'); k.type = 'button';
    k.className = 'pk w' + (mDeg(m) === 0 ? ' do' : '') + (m < b[0] || m > b[1] ? ' out' : '');
    k.style.left = (i * wW) + '%'; k.style.width = wW + '%';
    k.innerHTML = '<span>' + mDutch(m) + (mDeg(m) === 0 ? '<b>do</b>' : '') + '</span>';
    k.onclick = function(){ k.blur(); mAdd(m); };
    box.appendChild(k);
    if (m + 1 <= hi && isBlack(m + 1)){
      var bk = document.createElement('button'); bk.type = 'button';
      bk.className = 'pk bl' + (mDeg(m + 1) === 0 ? ' do' : '');
      bk.style.left = ((i + 1) * wW - wW * .32) + '%'; bk.style.width = (wW * .64) + '%';
      bk.title = mDutch(m + 1);
      bk.onclick = (function(mm){ return function(){ this.blur(); mAdd(mm); }; })(m + 1);
      box.appendChild(bk);
    }
  });
  // trappen-knoppen (dichtstbijzijnde bij de vorige noot)
  var row = $('mdDegs'); row.innerHTML = '';
  GSCALE[mQ.mode].concat(mQ.mode === 'min' ? [11] : []).forEach(function(d, i){
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'mdeg';
    bt.innerHTML = (d === 11 ? '♮7' : (i + 1)) + ' <small>' + (d === 11 ? 'ti' : GDEG[d].sol) + '</small>';
    bt.onclick = function(){ bt.blur(); mAddDeg(d); };
    row.appendChild(bt);
  });
}
function mRenderStats(){
  var st = mStats(), rows = [];
  ['maj','min'].forEach(function(mode){
    Object.keys(st[mode]).forEach(function(d){
      var s = st[mode][d]; if (!s.t) return;
      rows.push({ label:(mode === 'maj' ? 'Majeur' : 'Mineur') + ' · ' + GDEG[d].n + ' ' + (mode === 'min' && +d === 11 ? 'ti' : GDEG[d].sol), r:s.r, t:s.t, p:s.r / s.t });
    });
  });
  Object.keys(st.rd).forEach(function(d){ var r = st.rd[d]; if (r.t) rows.push({ label:'Ritme · ' + (MDURNAME[d] || d), r:r.r, t:r.t, p:r.r / r.t }); });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  $('mdStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div></div>'; }).join('')
    : '<p class="note">Nog geen dictees. Per trap zie je hier hoe vaak je hem goed opschrijft; de zwakste staat bovenaan.</p>';
}

/* --- instellingen --- */
function mFillKeys(){
  var sel = $('mdKeySel');
  sel.innerHTML = '<option value="rand">willekeurig</option>' + GKEYS.map(function(pc){ return '<option value="' + pc + '">' + gKeyName(pc, mS.mode) + '</option>'; }).join('');
  sel.value = String(mS.key);
}
function mSyncUI(){
  $('mdLevel').value = mS.level; $('mdMode').value = mS.mode; mFillKeys();
  $('mdLen').value = String(mS.len); $('mdMoves').value = mS.moves; $('mdRange').value = mS.range; $('mdHoogte').value = mS.hoogte; $('mdBereik').classList.toggle('hoff', mS.hoogte !== 'balk'); if (window.mBUI) mBUI.sync();
  $('mdRhythm').value = mS.rhythm; $('mdBars').value = String(mS.bars); $('mdTempo').value = String(mS.tempo); $('mdTimbre').value = mS.timbre;
  $('mdCadQ').checked = mS.cadQ; $('mdFirst').checked = mS.first; $('mdHear').checked = mS.hear; $('mdAuto').checked = mS.auto;
  var rh = mS.rhythm !== 'geen';
  $('mdLenBox').style.display = rh ? 'none' : ''; $('mdBarsBox').style.display = rh ? '' : 'none';
}
function mMatchLevel(){
  var L = MLEVELS.find(function(l){ return ['mode','moves','range','rhythm'].every(function(k){ return l[k] === mS[k]; }) && (l.rhythm === 'geen' ? l.len === mS.len : l.bars === mS.bars); });
  mS.level = L ? L.id : 'eigen'; $('mdLevel').value = mS.level;
}
function mOnRoute(){ if (typeof view !== 'undefined' && view === 'dictee' && mQ && mQ.target) mRenderAll(); }

function mInit(){
  mLoad();
  mQ = { pc:null, T:null, mode:null };
  $('mdLevel').innerHTML = MLEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen instelling</option>';
  $('mdLen').innerHTML = [3,4,5,6,7,8].map(function(n){ return '<option value="' + n + '">' + n + ' noten</option>'; }).join('');
  $('mdTempo').innerHTML = [40,50,60,72,84,96,110,130,160].map(function(n){ return '<option value="' + n + '">♩ = ' + n + (n <= 50 ? ' (rustig)' : '') + '</option>'; }).join('');
  mSyncUI();
  var ch = function(renew){ mSyncUI(); mMatchLevel(); mSave(); if (renew) mNew(false); };
  $('mdLevel').onchange = function(e){
    var L = MLEVELS.find(function(l){ return l.id === e.target.value; });
    if (L) ['mode','len','moves','range','rhythm','bars'].forEach(function(k){ mS[k] = L[k]; });
    mS.level = e.target.value; mSyncUI(); mSave(); mNew(false);
  };
  $('mdMode').onchange = function(e){ mS.mode = e.target.value; ch(true); };
  $('mdKeySel').onchange = function(e){ mS.key = e.target.value === 'rand' ? 'rand' : +e.target.value; mSave(); mNew(false); };
  $('mdLen').onchange = function(e){ mS.len = +e.target.value; ch(true); };
  $('mdMoves').onchange = function(e){ mS.moves = e.target.value; ch(true); };
  $('mdRange').onchange = function(e){ mS.range = e.target.value; ch(true); };
  $('mdHoogte').onchange = function(e){ mS.hoogte = e.target.value; ch(true); };
  document.addEventListener('DOMContentLoaded', function(){ window.mBUI = nlBereikUI($('mdBereik'), mS, function(){ ch(true); }, { clefsLedger:true }); mSyncUI(); });
  $('mdRhythm').onchange = function(e){ mS.rhythm = e.target.value; ch(true); };
  $('mdBars').onchange = function(e){ mS.bars = +e.target.value; ch(true); };
  $('mdTempo').onchange = function(e){ mS.tempo = +e.target.value; mSave(); };
  $('mdTimbre').onchange = function(e){ mS.timbre = e.target.value; mSave(); };
  $('mdCadQ').onchange = function(e){ mS.cadQ = e.target.checked; mSave(); };
  $('mdFirst').onchange = function(e){ mS.first = e.target.checked; mSave(); mNew(false); };
  $('mdHear').onchange = function(e){ mS.hear = e.target.checked; mSave(); };
  $('mdAuto').onchange = function(e){ mS.auto = e.target.checked; mSave(); };
  document.querySelectorAll('#mdView select, #mdView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });

  $('mdPlay').onclick = function(){ this.blur(); mPlayQ(); };
  $('mdCad').onclick = function(){ this.blur(); mPlayCad(); };
  $('mdDo').onclick = function(){ this.blur(); mPlayDo(); };
  $('mdCheck').onclick = function(){ this.blur(); mCheck(); };
  $('mdNext').onclick = function(){ this.blur(); mNew(true); };
  $('mdUndo').onclick = function(){ this.blur(); mUndo(); };
  $('mdClear').onclick = function(){ this.blur(); mClearAll(); };
  $('mdAgain').onclick = function(){ this.blur(); stop(); ensureCtx(); mPlayNotes(mQ.target, actx.currentTime + .08); };
  $('mdMine').onclick = function(){ this.blur(); mPlayMine(); };
  $('mdReset').onclick = function(){ Score.clear('dictee'); mRenderStats(); $('mdToday').textContent = 0; };
  document.querySelectorAll('#mdDurs [data-dur]').forEach(function(b){ b.onclick = function(){ b.blur(); mSetDur(+b.dataset.dur); }; });

  $('mdToday').textContent = Score.today('dictee');
  mNew(false);
  mRenderStats();
}
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || view !== 'dictee' || !mQ) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (Keys.blocked(e)) return;
  var k = e.key;
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) mPlayQ(); }
  else if (Keys.is(e, 'controleer') && !mQ.checked){ e.preventDefault(); mCheck(); }
  else if (Keys.is(e, 'volgende') && mQ.checked){ e.preventDefault(); mNew(true); }
  else if (Keys.is(e, 'controleer')){ e.preventDefault(); }
  else if (Keys.is(e, 'wis')){ e.preventDefault(); mUndo(); }
  else if (Keys.is(e, 'cadens')) mPlayCad();
  else if (Keys.is(e, 'grondtoon')) mPlayDo();
  else if (/^[1-7]$/.test(k)) mAddDigit(+k);
  else if (k === 'ArrowUp'){ e.preventDefault(); mShiftLast(12); }
  else if (k === 'ArrowDown'){ e.preventDefault(); mShiftLast(-12); }
  else if (k === '+' || k === '='){ mShiftLast(1); }
  else if (k === '-'){ mShiftLast(-1); }
  else if (mS.rhythm !== 'geen'){
    if (k === 'h' || k === 'H') mSetDur(4);
    else if (k === 'k' || k === 'K') mSetDur(2);
    else if (k === 'a' || k === 'A') mSetDur(1);
    else if (k === '.' || k === 'p' || k === 'P') mDotToggle();
  }
});
mInit();
