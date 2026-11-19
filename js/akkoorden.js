/* ================= Akkoorden (prefix ak; blok .nlsub[data-sub="akkoord"] in #ntView) =================
   Zelfde opbouw als Toonladders (toonladders.js): een akkoord op de balk (of alleen te horen) → welke soort?
   "C ____": grondtoon gegeven; met akS.naam ook de grondtoon kiezen (Tenuto); met akS.inv omkeringen, met akS.invName ook de ligging benoemen.
   Akkoorden komen uit de gedeelde catalogus Theorie.CHORDS (js/theorie.js); omkeringen alleen als chord.inv (niet sus2/sus4/overmatig/jazz).
   Twee ingangen (akProfile): 'blad' = Notenleer-tegel, 'gehoor' = Gehoor → 🎹 Akkoorden (#akkoorden, standaard alleen horen).
   Score: 'akkoorden' (blad) / 'akkoordeng' (gehoor) via akSid(), k = akkoord-id. Opslag 'akkoorden-settings' / 'akkoorden-gehoor-settings'.
   API: akStart(prof) akClear() akKey(e) akNew() akFix() akMatchLevel() akSave() akSyncUI() akStats() akSwitch(prof) akGet(prof). */

var AK_TYPES = Theorie.CHORDS, AK_GROUPS = Theorie.CHORD_GROUPS, AK_TONICS = Theorie.TONICS, AK_LETS = Theorie.LETS;
var AK_ALL = AK_TYPES.map(function(t){ return t.id; });
var AK_INV = ['grondligging', '1e omkering', '2e omkering', '3e omkering'];
function akLv(id, name, types, inv, tonics, clefs){ return { id:id, name:name, types:types, inv:inv, tonics:tonics, clefs:clefs }; }
var AK_SEPT = ['dom7','maj7','min7','hdim7','dim7','mmaj7'];
var AK_LEVELS = [
  akLv('a1',  '1 · major en minor',                          ['maj','min'], false, 'wit', ['g']),
  akLv('a2',  '2 · + diminished en augmented',               ['maj','min','dim','aug'], false, 'wit', ['g','f']),
  akLv('a3',  '3 · major, minor, diminished in omkering',    ['maj','min','dim'], true, 'wit', ['g','f']),
  akLv('a4',  '4 · alle drieklanken (+ sus2, sus4)',         ['maj','min','dim','aug','sus2','sus4'], true, 'wit', ['g','f']),
  akLv('a5',  '5 · 7th-akkoorden: dominant, major, minor',         ['dom7','maj7','min7'], false, 'wit', ['g','f']),
  akLv('a6',  '6 · alle 7th-akkoorden',                   AK_SEPT, false, 'wit', ['g','f']),
  akLv('a7',  '7 · 7th-akkoorden in omkering',            AK_SEPT, true, 'alle', ['g','f']),
  akLv('a8',  '8 · jazz: 6, m6, 9, maj9, m9',                ['dom7','maj7','min7','six','min6','dom9','maj9','min9'], false, 'wit', ['g','f']),
  akLv('a9',  '9 · jazz: 7♭9, 7♯9, 11, 13',                  ['dom7','dom9','dom7b9','dom7s9','dom11','dom13'], false, 'wit', ['g','f']),
  akLv('a10', '10 · alles door elkaar, alle grondtonen',     AK_ALL, true, 'alle', ['g','f','c3','c4'])
];
var AK_SKEYS = { blad:'akkoorden-settings', gehoor:'akkoorden-gehoor-settings' }, akProfile = 'blad';
function akSid(prof){ return (prof || akProfile) === 'gehoor' ? 'akkoordeng' : 'akkoorden'; }
var akS = null, akQ = null, akH = null, akTimers = [], akPend = 0, akLastK = null, akBUI = null;
var akScore = { right:0, total:0, streak:0 };

function akType(id){ return Theorie.find(AK_TYPES, id); }
function akApplyLevel(s, L){ s.types = L.types.slice(); s.inv = L.inv; s.tonics = L.tonics; s.clefs = L.clefs.slice(); }
function akDefaults(prof){
  var inst = 'piano'; try { inst = localStorage.getItem('standaard-klank') || 'piano'; } catch(e){}
  var s = { level:'a1', types:[], inv:false, invName:false, tonics:'wit', dbl:false, clefs:['g'], keys:['C'], up:0, down:0, acc:false, keysig:false,
            mode:prof === 'gehoor' ? 'horen' : 'zien', hoogte:'midden', naam:false, style:'nl', dirs:prof === 'gehoor' ? ['up','harm'] : ['harm'], then:prof === 'gehoor', hear:true, auto:true,
            timbre:inst, timed:false, limit:10 };
  akApplyLevel(s, AK_LEVELS[0]); return s;
}
function akFix(s){
  s = s || akS;
  s.bpm = gehBpmFix(s.bpm, 190);
  if (!Array.isArray(s.types)) s.types = AK_LEVELS[0].types.slice();
  s.types = AK_ALL.filter(function(id){ return s.types.indexOf(id) >= 0; });
  if (s.types.length < 2) s.types = ['maj','min'];
  if (!AK_TONICS[s.tonics]) s.tonics = 'wit';
  if (['zien','beide','horen'].indexOf(s.mode) < 0) s.mode = 'zien';
  if (s.klank){                                    // oud: klank samen|gebroken|beide → richting (sinds 13-11)
    s.dirs = s.klank === 'samen' ? ['harm'] : ['up']; s.then = s.klank === 'beide'; delete s.klank;
  }
  if (!Array.isArray(s.dirs)) s.dirs = ['harm'];
  s.dirs = ['up','down','harm'].filter(function(d){ return s.dirs.indexOf(d) >= 0; }); if (!s.dirs.length) s.dirs = ['harm'];
  s.then = !!s.then;
  if (s.hoogte !== 'balk') s.hoogte = 'midden';
  s.inv = !!s.inv; s.invName = !!s.invName;
  if (s.ledgerV !== 1){ s.up = 2; s.down = 2; s.ledgerV = 1; }   // hulplijnen (sinds 13-11), standaard 2 boven en onder
  s.acc = false; s.dbl = !!s.dbl;
  var dbl = s.dbl; nlBereikFix(s); s.dbl = dbl;
  s.timbre = Engine.instId(s.timbre);
  s.limit = Math.min(30, Math.max(1, Math.round(+s.limit) || 10));
}
function akSame(a, b){ return a.slice().sort().join() === b.slice().sort().join(); }
function akMatchLevel(s){
  s = s || akS;
  var L = AK_LEVELS.find(function(l){ return akSame(l.types, s.types) && l.inv === s.inv && l.tonics === s.tonics && akSame(l.clefs, s.clefs); });
  s.level = L ? L.id : 'eigen';
}
function akLoadProf(prof){
  var s = {}; try { s = JSON.parse(localStorage.getItem(AK_SKEYS[prof])) || {}; } catch(e){}
  s = Object.assign(akDefaults(prof), s); akFix(s); akMatchLevel(s); return s;
}
function akGet(prof){ return prof === akProfile ? akS : akLoadProf(prof); }
function akSave(){ try { localStorage.setItem(AK_SKEYS[akProfile], JSON.stringify(akS)); } catch(e){} }
function akTitle(){ return 'Akkoorden (' + (akProfile === 'gehoor' ? 'gehoor' : 'blad') + ')'; }
function akSwitch(prof){
  prof = prof === 'gehoor' ? 'gehoor' : 'blad';
  if (prof !== akProfile){
    akSave();
    var o = akLoadProf(prof);
    Object.keys(akS).forEach(function(k){ delete akS[k]; }); Object.assign(akS, o);   // zelfde object (akBUI houdt het vast)
    akProfile = prof; akLastK = null;
    akSyncUI();
  }
  $('akTitle').textContent = '🎹 ' + akTitle();
  var pt = document.querySelector('.nlsub[data-sub="akkoord"] .pnltitle'); if (pt) pt.textContent = '· ' + akTitle();
  $('akToday').textContent = Score.today(akSid());
  akScore = { right:0, total:0, streak:0 }; $('akRight').textContent = 0; $('akTotal').textContent = 0; $('akStreak').textContent = 0;
}

/* --- namen --- */
function akNote(p){ return Notatie.name(p, akS.style); }
function akTName(t){ return akS.style === 'en' ? t.en : t.nl; }
function akSym(ton, t){ return akNote(ton) + t.sym; }
function akFull(ton, t){ return akNote(ton) + ' ' + akTName(t) + ' (' + akSym(ton, t) + ')'; }
function akLabel(k){ var t = akType(k); return t ? akTName(t) : k; }
function akLevelKey(s){
  s = s || akS;
  var base = s.level === 'eigen' ? 'eigen:' + s.types.join(',') + '|' + s.tonics + '|' + s.clefs.join('-') + (s.inv ? '|inv' : '') : s.level;
  return base + '|' + s.mode + (s.mode !== 'horen' || s.hoogte === 'balk' ? '|u' + s.up + 'd' + s.down : '') + (s.inv && s.invName ? '|ligging' : '') + (s.naam && s.mode !== 'horen' ? '|naam' : '') + (s.dbl ? '|dbl' : '') + (s.dirs.join() !== 'harm' ? '|' + s.dirs.join(',') + (s.then ? '+' : '') : '') + (s.timed ? '|' + s.limit + 's' : '');
}
[['blad', 'akkoorden', 'Akkoorden (blad)', 'akkoorden-blad'], ['gehoor', 'akkoordeng', 'Akkoorden (gehoor)', 'akkoorden']].forEach(function(d){ Score.def(d[1], {
  name:d[2], view:d[3], label:akLabel, level:function(){ return akLevelKey(akGet(d[0])); },
  levelName:function(lv){
    var p = lv.split('|'), L = AK_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + (p.indexOf('horen') >= 0 ? ', alleen horen' : p.indexOf('beide') >= 0 ? ', zien en horen' : '')
      + (p.indexOf('ligging') >= 0 ? ', met ligging' : '') + (p.indexOf('naam') >= 0 ? ', met grondtoon' : '');
  },
  next:function(lv){
    var p = lv.split('|'), i = AK_LEVELS.findIndex(function(l){ return l.id === p[0]; });
    if (i >= 0 && i < AK_LEVELS.length - 1) return 'niveau ' + AK_LEVELS[i + 1].name;
    if (p.indexOf('horen') < 0) return 'dezelfde akkoorden alleen op gehoor';
    return 'de tijdmodus';
  }
}); });

/* --- vragen --- */
function akItems(){
  var out = [];
  akS.types.forEach(function(id){
    var t = akType(id);
    AK_TONICS[akS.tonics].forEach(function(ton){
      var n = Theorie.spell(ton, t.offs, t.semis, akS.dbl ? 2 : 1); if (!n) return;
      var invs = akS.inv && t.inv ? t.offs.length : 1;
      for (var r = 0; r < Math.min(invs, 4); r++) out.push({ t:t, ton:ton, notes:n, inv:r, k:id });
    });
  });
  return out;
}
function akPick(items){                             // eerst de soort (gewogen op fouten), dan grondtoon + ligging
  var st = Score.tally(akSid(), 20), ids = [];
  items.forEach(function(x){ if (ids.indexOf(x.k) < 0) ids.push(x.k); });
  if (ids.length > 1) ids = ids.filter(function(k){ return k !== akLastK; });
  var ws = ids.map(function(k){ var s = st[k]; var err = s ? (s.t - s.r + 1) / (s.t + 2) : .5; return .3 + err * 2; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum, id = ids[ids.length - 1];
  for (var i = 0; i < ids.length; i++){ r -= ws[i]; if (r <= 0){ id = ids[i]; break; } }
  var c = items.filter(function(x){ return x.k === id; });
  return c[Math.floor(Math.random() * c.length)];
}
function akVoice(x, clef){                          // omkering: de onderste r tonen een octaaf hoger; onderste noot rond de onderste lijn
  var c = clef === 'grand' ? 'g' : clef, li = AK_LETS.indexOf(x.ton.l);
  var tones = x.notes.map(function(n, i){ return { l:n.l, a:n.a, d:li + x.t.offs[i] + (i < x.inv ? 7 : 0) }; });
  tones.sort(function(a, b){ return a.d - b.d; });
  // hoogte: blad / gehoor 'volgens sleutel en hulplijnen' → binnen de hulplijnen (nlFit); gehoor 'midden' → laagste noot rond C3, sleutel automatisch
  var make = function(o0){ return tones.map(function(n){ return { l:n.l, a:n.a, o:o0 + Math.floor(n.d / 7) }; }); };
  if (akProfile === 'gehoor' && akS.hoogte !== 'balk') return nlMid(make, 50);
  return nlFit(make, clef, akS.up, akS.down);
}
function akClear(){ akTimers.forEach(clearTimeout); akTimers = []; if (typeof Engine !== 'undefined' && Engine.stopNotes) Engine.stopNotes(); }
function akDraw(show){
  var q = akQ;
  if (!show){ $('akStaff').innerHTML = '<div class="tlhide">🔊 Luister… (de noten zie je na je antwoord)</div>'; akH = null; return; }
  var st = function(p){ return q.clef === 'grand' ? nlStaffOf(p, 'grand') : 'g'; }, notes = [];
  var block = function(){                          // samen: één aanslag (op de pianobalk verdeeld over beide balken)
    if (q.clef !== 'grand') return [{ ps:q.ps, dur:'w', staff:'g' }];
    var lo = q.ps.filter(function(p){ return st(p) === 'f'; }), hi = q.ps.filter(function(p){ return st(p) === 'g'; }), o = [];
    if (lo.length) o.push({ ps:lo, dur:'w', staff:'f' }); if (hi.length) o.push({ ps:hi, dur:'w', staff:'g' }); return o;
  };
  if (q.dir === 'harm') notes = block();
  else {                                           // gebroken: stijgend of dalend na elkaar, eventueel daarna samen
    var seq = q.dir === 'down' ? q.ps.slice().reverse() : q.ps;
    notes = seq.map(function(p){ return { p:p, dur:'q', staff:st(p) }; });
    if (akS.then){ notes.push({ bar:true }); notes = notes.concat(block()); }
  }
  var w = q.dir === 'harm' ? 220 : 120 + 46 * q.ps.length + (akS.then ? 80 : 0);
  akH = Notatie.draw($('akStaff'), { clef:q.clef, key:'C', notes:notes, range:q.clef === 'grand' ? null : q.range, width:w, zoom:q.dir === 'harm' ? 1.6 : 1.3, maxHeight:380 });
}
function akUseNaam(){ return akS.naam && akS.mode !== 'horen'; }
function akUseInv(){ return akS.inv && akS.invName; }
function akNew(){
  akClear();
  Score.ask(akSid());
  var items = akItems();
  if (!items.length){ akS.types = ['maj','min']; akS.tonics = 'wit'; items = akItems(); }
  var x = akPick(items); akLastK = x.k;
  var clef = akS.clefs[Math.floor(Math.random() * akS.clefs.length)];
  var fit = akVoice(x, clef);
  if (fit.clef) clef = fit.clef;
  akQ = { dir:akS.dirs[Math.floor(Math.random() * akS.dirs.length)], t:x.t, ton:x.ton, inv:x.inv, clef:clef, ps:fit.ps, range:fit.range, answered:false, pickT:null, pickTon:null, pickInv:null, k:x.k };
  akPend = 0;
  akDraw(akS.mode !== 'horen');
  $('akFormula').textContent = '';
  var msg = $('akMsg'); msg.className = 'qmsg nlmsg'; msg.textContent = '';
  akRenderAsk(); akRenderInput();
  $('akHearBtn').disabled = akS.mode === 'zien';
  if (akS.mode !== 'zien') akPlay(); else Score.heard(akSid());
  akStartClock();
}
function akStartClock(){
  var card = $('akCard'), bar = $('akClockBar');
  card.classList.toggle('timed', !!akS.timed);
  if (!akS.timed || !akQ) return;
  bar.style.animation = 'none'; bar.style.transform = ''; void bar.offsetWidth;
  bar.style.animation = 'nlclock ' + akS.limit + 's linear forwards';
  akTimers.push(setTimeout(function(){ if (akQ && !akQ.answered) akFinish(true); }, akS.limit * 1000));
}
function akStopClock(){ var bar = $('akClockBar'); bar.style.animation = 'none'; bar.style.transform = 'scaleX(0)'; }
function akPlay(){
  if (!akQ) return;
  akTimers.forEach(clearTimeout); akTimers = []; if (Engine.stopNotes) Engine.stopNotes();
  ensureCtx(); Score.heard(akSid());
  var ms = akQ.ps.map(Notatie.midi);                // precies de noten die er staan (hoogte = notatie)
  var t0 = actx.currentTime + .05, v = .36 / Math.sqrt(Math.max(1, ms.length / 3)), o = { inst:akS.timbre, vol:v };
  if (akQ.dir === 'harm'){ ms.forEach(function(m){ Engine.note(t0, m, 1.8, o); }); }
  else {                                           // gebroken: stijgend of dalend, eventueel daarna samen
    var seq = akQ.dir === 'down' ? ms.slice().reverse() : ms;
    var d = 60 / akS.bpm;                          // tempo instelbaar (standaard 190)
    seq.forEach(function(m, i){ Engine.note(t0 + i * d, m, akS.then ? d : Math.max(d * 1.2, 1.6 - i * .1), akS.then ? { inst:akS.timbre, vol:.34 } : o); });
    if (akS.then){ var t1 = t0 + seq.length * d + .25; ms.forEach(function(m){ Engine.note(t1, m, 1.8, o); }); }
  }
  if (akS.timed && !akQ.answered) akStartClock();
}

/* --- antwoorden: soort (altijd), grondtoon (akUseNaam), ligging (akUseInv); nakijken als alles gekozen is --- */
function akReady(){ var q = akQ; return q.pickT && (!akUseNaam() || q.pickTon) && (!akUseInv() || q.pickInv != null); }
function akAsked(){ var m = $('akMsg'), q = akQ, need = [];
  if (!q.pickT) need.push('de soort'); if (akUseNaam() && !q.pickTon) need.push('de grondtoon'); if (akUseInv() && q.pickInv == null) need.push('de ligging');
  m.className = 'qmsg nlmsg'; m.textContent = need.length ? 'Nog: ' + need.join(' en ') + '.' : ''; }
function akPickType(id){ if (!akQ || akQ.answered) return; akQ.pickT = id; if (akReady()) akFinish(false); else { akRenderInput(); akAsked(); } }
function akPickTonic(p){ if (!akQ || akQ.answered || !akUseNaam()) return; akQ.pickTon = p; akPend = 0; akRenderAsk(); if (akReady()) akFinish(false); else { akRenderInput(); akAsked(); } }
function akPickInv(r){ if (!akQ || akQ.answered || !akUseInv()) return; akQ.pickInv = r; if (akReady()) akFinish(false); else { akRenderInput(); akAsked(); } }
function akFinish(late){
  var q = akQ; q.answered = true; akStopClock();
  var tonOk = !akUseNaam() || (q.pickTon && q.pickTon.l === q.ton.l && q.pickTon.a === q.ton.a);
  var invOk = !akUseInv() || q.pickInv === q.inv;
  var typeOk = q.pickT === q.k, ok = !late && tonOk && typeOk && invOk;
  var mineT = q.pickT ? akType(q.pickT) : null;
  var mine = late ? 'tijd op' : (akUseNaam() && q.pickTon ? akNote(q.pickTon) + ' ' : '') + (mineT ? akTName(mineT) : '?') + (akUseInv() && q.pickInv != null ? ', ' + AK_INV[q.pickInv] : '');
  var ligging = q.inv ? ', ' + AK_INV[q.inv] : '';
  Score.log(akSid(), { k:q.k, q:akFull(q.ton, q.t) + ligging + ' (' + nlClefName(q.clef) + ')', a:mine, ok:ok });
  akScore.total++; if (ok){ akScore.right++; akScore.streak++; } else akScore.streak = 0;
  $('akRight').textContent = akScore.right; $('akTotal').textContent = akScore.total; $('akStreak').textContent = akScore.streak;
  $('akToday').textContent = Score.today(akSid());
  if (akS.mode === 'horen') akDraw(true);
  if (akH) akH.mark(0, ok ? 'ok' : 'bad');
  var full = akFull(q.ton, q.t) + ligging, msg = $('akMsg');
  var bass = q.inv ? ' Onderin ligt de ' + ['grondtoon', 'terts', 'kwint', 'septiem'][q.inv] + ' (' + akNote(q.ps[0]) + ').' : '';
  var why = [];
  if (!typeOk) why.push('de soort'); if (!tonOk) why.push('de grondtoon'); if (!invOk) why.push('de ligging');
  msg.className = 'qmsg nlmsg ' + (ok ? 'good' : 'bad');
  msg.textContent = ok ? 'Goed! ' + full + '.' + bass
    : late ? 'De tijd is op. Het is ' + full + '.' + bass
    : 'Het is ' + full + ', jij koos ' + mine + '. Niet goed: ' + why.join(' en ') + '.' + bass;
  $('akFormula').innerHTML = '<b>' + akTName(q.t) + '</b>: ' + Theorie.formula(q.t.offs, q.t.semis) + ' <span>(' + q.t.kenmerk + ')</span>'
    + (mineT && !typeOk ? '<br>' + akTName(mineT) + ': ' + Theorie.formula(mineT.offs, mineT.semis) + ' <span>(' + mineT.kenmerk + ')</span>' : '');
  $('akHearBtn').disabled = false;
  akRenderAsk(); akRenderInput(); akStats();
  if (akS.hear && akS.mode === 'zien') akPlay();
  if (ok && akS.auto) akTimers.push(setTimeout(akNew, akS.hear && akS.mode === 'zien' ? 3000 : 1300));
}

/* --- tekenen van vraag en invoer --- */
function akRenderAsk(){
  var q = akQ; if (!q) return;
  var ton = akUseNaam() ? (q.answered ? akNote(q.ton) : q.pickTon ? akNote(q.pickTon) : '?') : akNote(q.ton);
  $('akAsk').innerHTML = ton + ' <u>' + (q.answered ? akTName(q.t) : '&nbsp;') + '</u>' + (q.answered && q.inv ? ' · ' + AK_INV[q.inv] : '');
}
function akBtn(html, cls, fn){
  var b = document.createElement('button'); b.type = 'button'; b.className = 'gbtn' + (cls ? ' ' + cls : ''); b.innerHTML = html;
  b.onclick = function(){ b.blur(); fn(); }; return b;
}
function akOrder(){ var o = []; AK_GROUPS.forEach(function(g){ AK_TYPES.forEach(function(t){ if (t.grp === g[0] && akS.types.indexOf(t.id) >= 0) o.push(t.id); }); }); return o; }
function akRenderInput(){
  var q = akQ; if (!q) return;
  // ligging
  var ib = $('akInvBox'); ib.innerHTML = ''; ib.style.display = akUseInv() ? '' : 'none';
  if (akUseInv()){
    var maxN = Math.max.apply(null, akS.types.map(function(id){ var t = akType(id); return t.inv ? t.offs.length : 1; }));
    var row = document.createElement('div'); row.className = 'tlgrp akinv'; ib.appendChild(row);
    for (var r = 0; r < Math.max(3, Math.min(4, maxN)); r++) (function(r){
      var cls = '';
      if (q.answered){ if (r === q.inv) cls = 'right'; else if (r === q.pickInv) cls = 'wrong'; }
      else if (r === q.pickInv) cls = 'picked';
      row.appendChild(akBtn(AK_INV[r] + '<small>' + ['grondtoon', 'terts', 'kwint', 'septiem'][r] + ' onderin</small>', cls, function(){ akPickInv(r); }));
    })(r);
  }
  // grondtoon (Tenuto-stijl)
  $('akTonicBox').style.display = akUseNaam() ? '' : 'none';
  if (akUseNaam()){
    $('akAccRow').querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', +b.dataset.acc === akPend); });
    var lr = $('akLetRow'); lr.innerHTML = '';
    AK_LETS.split('').forEach(function(l){
      var cls = '';
      if (q.answered){ if (l === q.ton.l) cls = 'right'; if (q.pickTon && q.pickTon.l === l && (q.pickTon.l !== q.ton.l || q.pickTon.a !== q.ton.a)) cls = 'wrong'; }
      else if (q.pickTon && q.pickTon.l === l) cls = 'picked';
      lr.appendChild(akBtn(akNote({ l:l, a:0 }) + '<small>' + (akPend ? akNote({ l:l, a:akPend }) : (q.answered && l === q.ton.l && q.ton.a ? akNote(q.ton) : '&nbsp;')) + '</small>', cls, function(){ akPickTonic({ l:l, a:akPend }); }));
    });
  }
  // soorten per groep
  var box = $('akTypeBox'); box.innerHTML = ''; var n = 0;
  AK_GROUPS.forEach(function(g){
    var ts = AK_TYPES.filter(function(t){ return t.grp === g[0] && akS.types.indexOf(t.id) >= 0; });
    if (!ts.length) return;
    var lab = document.createElement('div'); lab.className = 'tlglab'; lab.textContent = g[1]; box.appendChild(lab);
    var grp = document.createElement('div'); grp.className = 'tlgrp'; box.appendChild(grp);
    ts.forEach(function(t){
      n++; var key = n <= 9 ? String(n) : n === 10 ? '0' : '', cls = '';
      if (q.answered){ if (t.id === q.k) cls = 'right'; else if (t.id === q.pickT) cls = 'wrong'; }
      else if (t.id === q.pickT) cls = 'picked';
      grp.appendChild(akBtn(akTName(t) + '<small>' + (key ? key + ' · ' : '') + 'X' + t.sym + '</small>', cls, function(){ akPickType(t.id); }));
    });
  });
}

/* --- toetsen (via de keydown-handler van notenleer.js) --- */
function akKey(e){
  if (!akQ) return;
  var k = e.key.toLowerCase();
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat && (akQ.answered || akS.mode !== 'zien')) akPlay(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); akNew(); }
  else if (Keys.is(e, 'stop')){ akClear(); }
  else if (/^[0-9]$/.test(e.key)){ var i = e.key === '0' ? 9 : +e.key - 1, id = akOrder()[i]; if (id){ e.preventDefault(); akPickType(id); } }
  else if (akUseNaam() && (e.key === '-' || e.key === '+' || e.key === '=')){ e.preventDefault(); var a = e.key === '-' ? -1 : 1; akPend = akPend === a ? 0 : a; akRenderInput(); }
  else if (akUseNaam() && k.length === 1 && AK_LETS.indexOf(k) >= 0){ e.preventDefault(); akPickTonic({ l:k, a:e.shiftKey ? 1 : akPend }); }
}

/* --- statistieken --- */
function akStats(){
  var st = Score.tally(akSid()), rec = Score.recent(akSid(), 20), rows = [], R = 0, T = 0;
  Object.keys(st).forEach(function(k){
    var s = st[k]; if (!s.t) return; R += s.r; T += s.t;
    var wrong = {}; (rec[k] || []).forEach(function(x){ if (!x.ok && x.a) wrong[x.a] = (wrong[x.a] || 0) + 1; });
    var w = Object.keys(wrong).sort(function(a, b){ return wrong[b] - wrong[a]; });
    var why = w.length ? (w[0] === 'tijd op' ? 'vaak te laat' : 'meestal verward met ' + w[0] + ' (' + wrong[w[0]] + '×)') + (w.length > 1 ? ', ook ' + w.slice(1, 3).join(', ') : '') : '';
    rows.push({ label:akLabel(k), r:s.r, t:s.t, p:s.r / s.t, why:why });
  });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  var weak = rows.filter(function(r){ return r.p < 1; }).slice(0, 3);
  $('akStatSum').innerHTML = '📊 Statistieken' + (T ? ' · ' + Math.round(R / T * 100) + '% goed' + (weak.length ? ' · zwakst: ' + weak.map(function(r){ return '<span class="nlchip">' + r.label + '</span>'; }).join(' ') : '') : ' · nog leeg') + ' <span class="muted">alles ▸</span>';
  $('akStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div>' + (r.why ? '<div class="why">' + r.why + '</div>' : '') + '</div>'; }).join('')
    : '<p class="note">Nog geen antwoorden. De akkoorden die je het vaakst mist komen hier bovenaan en krijg je ook vaker.</p>';
}

/* --- paneel --- */
function akSyncUI(){
  $('akLevel').value = akS.level; $('akMode').value = akS.mode; $('akHoogte').value = akS.hoogte; $('akBpm').value = String(akS.bpm);
  document.querySelector('.nlsub[data-sub="akkoord"]').classList.toggle('hmid', akS.hoogte !== 'balk'); $('akNaam').checked = akS.naam; $('akNaam').disabled = akS.mode === 'horen';
  $('akInv').checked = akS.inv; $('akInvName').checked = akS.invName; $('akInvName').disabled = !akS.inv;
  document.querySelectorAll('#akTypeChips input').forEach(function(i){ i.checked = akS.types.indexOf(i.value) >= 0; });
  $('akTonics').value = akS.tonics; $('akDbl').checked = akS.dbl;
  if (akBUI) akBUI.sync();
  $('akStyle').value = akS.style; document.querySelectorAll('.akd').forEach(function(i){ i.checked = akS.dirs.indexOf(i.value) >= 0; }); $('akThen').checked = akS.then; $('akHear').checked = akS.hear; $('akInst').value = akS.timbre;
  $('akAuto').checked = akS.auto; $('akTimed').checked = akS.timed; $('akLimit').value = akS.limit;
}
function akStart(prof){ akSwitch(prof || 'blad'); akStats(); akNew(); }
function akInit(){
  if (!$('akLevel')) return;
  akS = akLoadProf('blad');
  $('akLevel').innerHTML = AK_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen keuze (🕹️)</option>';
  $('akInst').innerHTML = Engine.instOptions(akS.timbre);
  $('akTypeChips').innerHTML = AK_GROUPS.map(function(g){
    return '<div class="chips tlgrp">' + AK_TYPES.filter(function(t){ return t.grp === g[0]; }).map(function(t){
      return '<label class="chip" title="' + t.kenmerk + ' · ' + Theorie.formula(t.offs, t.semis) + '"><input type="checkbox" value="' + t.id + '"> ' + t.nl + ' <span class="muted">X' + t.sym + '</span></label>'; }).join('') + '</div>';
  }).join('');
  var active = function(){ return typeof nlCur !== 'undefined' && nlCur === 'akkoord'; };
  var changed = function(renew){ akSave(); akSyncUI(); if (active()){ if (renew) akNew(); else { akRenderAsk(); akRenderInput(); } } };
  akBUI = nlBereikUI($('akBereik'), akS, function(){ akMatchLevel(); changed(true); }, { clefsLedger:true });
  akSyncUI();
  $('akLevel').onchange = function(e){
    var L = AK_LEVELS.find(function(l){ return l.id === e.target.value; });
    akS.level = e.target.value;
    if (L) akApplyLevel(akS, L); else Paneel.set('ntView', true);
    changed(true);
  };
  $('akTypeChips').onchange = function(){
    var t = []; document.querySelectorAll('#akTypeChips input:checked').forEach(function(i){ t.push(i.value); });
    if (t.length < 2){ akSyncUI(); var m = $('akMsg'); m.className = 'qmsg nlmsg bad'; m.textContent = 'Kies minstens twee soorten akkoorden.'; return; }
    akS.types = t; akFix(); akMatchLevel(); changed(true);
  };
  $('akInv').onchange = function(e){ akS.inv = e.target.checked; akMatchLevel(); changed(true); };
  $('akInvName').onchange = function(e){ akS.invName = e.target.checked; changed(true); };
  $('akTonics').onchange = function(e){ akS.tonics = e.target.value; akMatchLevel(); changed(true); };
  $('akDbl').onchange = function(e){ akS.dbl = e.target.checked; changed(true); };
  $('akMode').onchange = function(e){ akS.mode = e.target.value; changed(true); };
  gehBpmFill($('akBpm')); $('akBpm').value = String(akS.bpm);
  $('akBpm').onchange = function(e){ akS.bpm = +e.target.value; akSave(); if (akQ && akS.mode !== 'zien' && !akQ.answered) akPlay(); };
  $('akHoogte').onchange = function(e){ akS.hoogte = e.target.value; changed(true); };
  $('akNaam').onchange = function(e){ akS.naam = e.target.checked; changed(true); };
  $('akStyle').onchange = function(e){ akS.style = e.target.value; changed(false); akStats(); };
  document.querySelectorAll('.akd').forEach(function(inp){ inp.onchange = function(){
    var d = []; document.querySelectorAll('.akd:checked').forEach(function(i){ d.push(i.value); });
    if (!d.length){ inp.checked = true; return; }
    akS.dirs = d; akMatchLevel(); changed(true);
  }; });
  $('akThen').onchange = function(e){ akS.then = e.target.checked; changed(true); };
  $('akHear').onchange = function(e){ akS.hear = e.target.checked; changed(false); };
  $('akInst').onchange = function(e){ akS.timbre = e.target.value; changed(false); };
  $('akAuto').onchange = function(e){ akS.auto = e.target.checked; changed(false); };
  $('akTimed').onchange = function(e){ akS.timed = e.target.checked; changed(true); };
  $('akLimit').onchange = function(e){ akS.limit = Math.min(30, Math.max(1, Math.round(+e.target.value) || 10)); changed(true); };
  $('akAccRow').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ b.blur(); var a = +b.dataset.acc; akPend = akPend === a ? 0 : a; akRenderInput(); }; });
  document.querySelectorAll('#ntView .nlsub[data-sub="akkoord"] select, #ntView .nlsub[data-sub="akkoord"] input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('akNext').onclick = function(){ this.blur(); akNew(); };
  $('akHearBtn').onclick = function(){ this.blur(); if (akQ && (akQ.answered || akS.mode !== 'zien')) akPlay(); };
  $('akReset').onclick = function(){ Score.clear(akSid()); akStats(); $('akToday').textContent = 0; };
  $('akToday').textContent = Score.today(akSid());
  akStats();
  if (typeof view !== 'undefined' && NL_ROUTES[view] && NL_ROUTES[view][0] === 'akkoord') nlSub('akkoord', NL_ROUTES[view][1]);   // direct geopend
}
akInit();
