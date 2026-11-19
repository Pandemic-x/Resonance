/* ================= Notenleer → Toonladders (prefix tl; blok .nlsub[data-sub="ladder"] in #ntView) =================
   Een toonladder stijgend op de balk (losse voortekens, geen voortekening) → welke soort?
   Standaard staat de grondtoon erbij ("D ____") en kies je alleen de soort; met tlS.naam kies je ook de grondtoon (zoals Tenuto).
   tlS.mode: 'zien' | 'beide' (zien + meteen horen) | 'horen' (pas na het antwoord zien = gehoortraining; grondtoon dan altijd gegeven).
   Soorten in TL_TYPES: [letterstap t.o.v. de grondtoon, halve tonen] per toon, zodat de spelling klopt (bv. blues = 1 ♭3 4 ♯4 5 ♭7).
   Twee ingangen met elk eigen instellingen, score en presetlijst (tlProfile): 'blad' = Notenleer-tegel (#notenleer),
   'gehoor' = Gehoor → 🪜 Toonladders (#toonladders, standaard 'alleen horen'). tlSwitch(prof) wisselt tlS in-place.
   Score: onderdeel 'toonladders' (blad) / 'toonladdersg' (gehoor) via tlSid(), k = soort-id (bv. 'dor'); a = gekozen soort.
   Opslag 'toonladders-settings' (blad) en 'toonladders-gehoor-settings' (gehoor). API: tlStart() tlClear() tlKey(e) tlNew() tlFix() tlMatchLevel() tlSave() tlSyncUI() tlStats(). */

// definities staan in de gedeelde catalogus (js/theorie.js): één bron voor blad én gehoor
var TL_TYPES = Theorie.SCALES;
var TL_GROUPS = Theorie.SCALE_GROUPS;
var TL_ALL = TL_TYPES.map(function(t){ return t.id; });
var TL_LETS = 'cdefgab', TL_NAT = [0,2,4,5,7,9,11];
var TL_TONICS = Theorie.TONICS;
function tlLv(id, name, types, tonics, clefs){ return { id:id, name:name, types:types, tonics:tonics, clefs:clefs }; }
var TL_LEVELS = [
  tlLv('l1', '1 · majeur, natuurlijk en harmonisch mineur', ['maj','nmin','hmin'], 'wit', ['g']),
  tlLv('l2', '2 · + melodisch mineur, viool + bas',        ['maj','nmin','hmin','mmin'], 'wit', ['g','f']),
  tlLv('l3', '3 · modi: dorisch, frygisch, lydisch, mixolydisch', ['maj','nmin','dor','fry','lyd','mix'], 'wit', ['g','f']),
  tlLv('l4', '4 · alle modi + locrisch',                    ['maj','nmin','dor','fry','lyd','mix','loc'], 'alle', ['g','f']),
  tlLv('l5', '5 · pentatonisch en blues',                   ['maj','nmin','pmaj','pmin','blues'], 'wit', ['g','f']),
  tlLv('l6', '6 · symmetrisch: heletoons, verminderd, chromatisch', ['maj','heel','vhh','vhe','chrom'], 'wit', ['g','f']),
  tlLv('l7', '7 · andere: harmonisch majeur, Hongaars, dominant, alterated', ['hmin','mmin','hmaj','hong','frydom','lyddom','alt'], 'wit', ['g','f']),
  tlLv('l8', '8 · alles door elkaar, alle grondtonen',      TL_ALL, 'alle', ['g','f','c3','c4'])
];
var TL_SKEYS = { blad:'toonladders-settings', gehoor:'toonladders-gehoor-settings' }, tlProfile = 'blad';
function tlSid(prof){ return (prof || tlProfile) === 'gehoor' ? 'toonladdersg' : 'toonladders'; }
var tlS = null, tlQ = null, tlH = null, tlTimers = [], tlPend = 0, tlLastK = null, tlBUI = null;
var tlScore = { right:0, total:0, streak:0 };

function tlType(id){ return TL_TYPES.find(function(t){ return t.id === id; }); }
function tlApplyLevel(s, L){ s.types = L.types.slice(); s.tonics = L.tonics; s.clefs = L.clefs.slice(); }
function tlDefaults(prof){
  var inst = 'piano'; try { inst = localStorage.getItem('standaard-klank') || 'piano'; } catch(e){}
  var s = { level:'l1', types:[], tonics:'wit', dbl:false, clefs:['g'], keys:['C'], up:0, down:0, acc:false, keysig:false,
            mode:prof === 'gehoor' ? 'horen' : 'zien', hoogte:'midden', naam:false, style:'nl', hear:true, auto:true, timbre:inst, timed:false, limit:10 };
  tlApplyLevel(s, TL_LEVELS[0]); return s;
}
function tlFix(s){
  s = s || tlS;
  s.bpm = gehBpmFix(s.bpm, 190);
  if (!Array.isArray(s.types)) s.types = TL_LEVELS[0].types.slice();
  s.types = TL_ALL.filter(function(id){ return s.types.indexOf(id) >= 0; });
  if (s.types.length < 2) s.types = ['maj','nmin'];
  if (!TL_TONICS[s.tonics]) s.tonics = 'wit';
  if (['zien','beide','horen'].indexOf(s.mode) < 0) s.mode = 'zien';
  if (s.hoogte !== 'balk') s.hoogte = 'midden';
  if (s.ledgerV !== 1){ s.up = 2; s.down = 2; s.ledgerV = 1; }   // hulplijnen (sinds 13-11), standaard 2 boven en onder
  s.acc = false; s.dbl = !!s.dbl;
  var dbl = s.dbl; nlBereikFix(s); s.dbl = dbl;
  s.timbre = Engine.instId(s.timbre);
  s.limit = Math.min(30, Math.max(1, Math.round(+s.limit) || 10));
}
function tlLoadProf(prof){
  var s = {}; try { s = JSON.parse(localStorage.getItem(TL_SKEYS[prof])) || {}; } catch(e){}
  s = Object.assign(tlDefaults(prof), s); tlFix(s); tlMatchLevel(s); return s;
}
function tlLoad(){ tlS = tlLoadProf('blad'); }
function tlGet(prof){ return prof === tlProfile ? tlS : tlLoadProf(prof); }     // instellingen van een ingang (ook als die niet open is)
function tlSave(){ try { localStorage.setItem(TL_SKEYS[tlProfile], JSON.stringify(tlS)); } catch(e){} }
function tlTitle(){ return 'Toonladders (' + (tlProfile === 'gehoor' ? 'gehoor' : 'blad') + ')'; }
function tlSwitch(prof){
  prof = prof === 'gehoor' ? 'gehoor' : 'blad';
  if (prof !== tlProfile){
    tlSave();
    var o = tlLoadProf(prof);
    Object.keys(tlS).forEach(function(k){ delete tlS[k]; }); Object.assign(tlS, o);   // zelfde object (tlBUI houdt het vast)
    tlProfile = prof; tlLastK = null;
    tlSyncUI();
  }
  $('tlTitle').textContent = '🪜 ' + tlTitle();
  var pt = document.querySelector('.nlsub[data-sub="ladder"] .pnltitle'); if (pt) pt.textContent = '· ' + tlTitle();
  $('tlToday').textContent = Score.today(tlSid());
  tlScore = { right:0, total:0, streak:0 }; $('tlRight').textContent = 0; $('tlTotal').textContent = 0; $('tlStreak').textContent = 0;
}
function tlSame(a, b){ return a.slice().sort().join() === b.slice().sort().join(); }
function tlMatchLevel(s){
  s = s || tlS;
  var L = TL_LEVELS.find(function(l){ return tlSame(l.types, s.types) && l.tonics === s.tonics && tlSame(l.clefs, s.clefs); });
  s.level = L ? L.id : 'eigen';
}

/* --- spelling en namen --- */
// symmetrische ladders + chromatisch: als de vaste spelling rare tonen geeft (E♯ B♯ C♭ F♭, of een te groot voorteken),
// dan per toon: stamtoon als dat kan, anders ♯ (♭ bij een mol-grondtoon of F), letters nooit terug
function tlFlex(t, ton){
  var li = TL_LETS.indexOf(ton.l), tm = TL_NAT[li] + ton.a, flat = ton.a < 0 || ton.l === 'f', out = [{ l:ton.l, a:ton.a, step:0 }], j = li;
  for (var i = 1; i < t.semis.length; i++){
    var pc = ((tm + t.semis[i]) % 12 + 12) % 12, nat = TL_NAT.indexOf(pc), L, a;
    if (nat >= 0){ L = nat; a = 0; } else if (flat){ L = TL_NAT.indexOf((pc + 1) % 12); a = -1; } else { L = TL_NAT.indexOf(pc - 1); a = 1; }
    j = j + ((L - j % 7) + 7) % 7;
    out.push({ l:TL_LETS[L], a:a, step:Math.floor(j / 7) });
  }
  return out;
}
var TL_ODD = { 'e1':1, 'b1':1, 'c-1':1, 'f-1':1 };
function tlNotes(t, ton){
  var n = tlNotes0(t, ton);
  if (t.grp === 'sym' && (t.id === 'chrom' || !n || n.some(function(x){ return TL_ODD[x.l + x.a]; }))) n = tlFlex(t, ton);
  return n;
}
function tlNotes0(t, ton){ return Theorie.spell(ton, t.offs, t.semis, tlS.dbl ? 2 : 1); }   // [{l, a, step}] of null
function tlNote(p){ return Notatie.name(p, tlS.style); }
function tlTName(t){ return tlS.style === 'en' ? t.en : t.nl; }
function tlFull(ton, t){ return tlNote(ton) + ' ' + tlTName(t); }
function tlFormula(t){ return Theorie.formula(t.offs, t.semis); }   // trappen t.o.v. majeur: 1 2 ♭3 …
function tlLabel(k){ var t = tlType(k); return t ? tlTName(t) : k; }
function tlLevelKey(s){
  s = s || tlS;
  var base = s.level === 'eigen' ? 'eigen:' + s.types.join(',') + '|' + s.tonics + '|' + s.clefs.join('-') : s.level;
  return base + '|' + s.mode + (s.mode !== 'horen' || s.hoogte === 'balk' ? '|u' + s.up + 'd' + s.down : '') + (s.naam && s.mode !== 'horen' ? '|naam' : '') + (s.dbl ? '|dbl' : '') + (s.timed ? '|' + s.limit + 's' : '');
}
[['blad', 'toonladders', 'Toonladders (blad)', 'toonladders-blad'], ['gehoor', 'toonladdersg', 'Toonladders (gehoor)', 'toonladders']].forEach(function(d){ Score.def(d[1], {
  name:d[2], view:d[3], label:tlLabel, level:function(){ return tlLevelKey(tlGet(d[0])); },
  levelName:function(lv){
    var p = lv.split('|'), L = TL_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + (p.indexOf('horen') >= 0 ? ', alleen horen' : p.indexOf('beide') >= 0 ? ', zien en horen' : '') + (p.indexOf('naam') >= 0 ? ', met grondtoon' : '');
  },
  next:function(lv){
    var p = lv.split('|'), i = TL_LEVELS.findIndex(function(l){ return l.id === p[0]; });
    if (i >= 0 && i < TL_LEVELS.length - 1) return 'niveau ' + TL_LEVELS[i + 1].name;
    if (p.indexOf('horen') < 0) return 'dezelfde ladders alleen op gehoor';
    return 'de tijdmodus';
  }
}); });

/* --- vragen --- */
function tlItems(){
  var out = [];
  tlS.types.forEach(function(id){
    var t = tlType(id);
    TL_TONICS[tlS.tonics].forEach(function(ton){ var n = tlNotes(t, ton); if (n) out.push({ t:t, ton:ton, notes:n, k:id }); });
  });
  return out;
}
function tlPick(items){
  // eerst de soort (gewogen op fouten), dan een grondtoon die bij die soort kan
  var st = Score.tally(tlSid(), 20), ids = [];
  items.forEach(function(x){ if (ids.indexOf(x.k) < 0) ids.push(x.k); });
  if (ids.length > 1) ids = ids.filter(function(k){ return k !== tlLastK; });
  var ws = ids.map(function(k){ var s = st[k]; var err = s ? (s.t - s.r + 1) / (s.t + 2) : .5; return .3 + err * 2; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum, id = ids[ids.length - 1];
  for (var i = 0; i < ids.length; i++){ r -= ws[i]; if (r <= 0){ id = ids[i]; break; } }
  var c = items.filter(function(x){ return x.k === id; });
  return c[Math.floor(Math.random() * c.length)];
}
// hoogte: blad, en gehoor met 'volgens sleutel en hulplijnen' → willekeurig binnen de hulplijnen (nlFit);
// gehoor 'midden' → laagste noot rond G3 en sleutel automatisch (nlMid). Wat je hoort = wat er staat. → {ps, range, clef?}
function tlMake(x){ return function(o0){ return x.notes.map(function(n){ return { l:n.l, a:n.a, o:o0 + n.step }; }).concat([{ l:x.ton.l, a:x.ton.a, o:o0 + 1 }]); }; }
function tlPlace(x, clef){
  if (tlProfile === 'gehoor' && tlS.hoogte !== 'balk') return nlMid(tlMake(x), 55);
  return nlFit(tlMake(x), clef, tlS.up, tlS.down);
}
function tlClear(){ tlTimers.forEach(clearTimeout); tlTimers = []; if (typeof Engine !== 'undefined' && Engine.stopNotes) Engine.stopNotes(); }
function tlDraw(show){
  var q = tlQ;
  if (!show){ $('tlStaff').innerHTML = '<div class="tlhide">🔊 Luister… (de noten zie je na je antwoord)</div>'; tlH = null; return; }
  tlH = Notatie.draw($('tlStaff'), { clef:q.clef, key:'C', notes:q.ps.map(function(p){ return { p:p, dur:'w', staff:nlStaffOf(p, q.clef) }; }),
                                     range:q.clef === 'grand' ? null : q.range, zoom:1.25, maxHeight:340 });
}
function tlUseNaam(){ return tlS.naam && tlS.mode !== 'horen'; }
function tlNew(){
  tlClear();
  Score.ask(tlSid());
  var items = tlItems();
  if (!items.length){ tlS.types = ['maj','nmin']; tlS.tonics = 'wit'; items = tlItems(); }
  var x = tlPick(items); tlLastK = x.k;
  var clef = tlS.clefs[Math.floor(Math.random() * tlS.clefs.length)];
  tlQ = { t:x.t, ton:x.ton, clef:clef, ps:null, answered:false, pickT:null, pickTon:null, k:x.k };
  var fit = tlPlace(x, clef); tlQ.ps = fit.ps; tlQ.range = fit.range; if (fit.clef) tlQ.clef = fit.clef;
  tlPend = 0;
  tlDraw(tlS.mode !== 'horen');
  $('tlFormula').textContent = '';
  var msg = $('tlMsg'); msg.className = 'qmsg nlmsg'; msg.textContent = '';
  tlRenderAsk(); tlRenderInput();
  $('tlHearBtn').disabled = tlS.mode === 'zien';
  if (tlS.mode !== 'zien') tlPlay(); else Score.heard(tlSid());
  tlStartClock();
}
function tlStartClock(){
  var card = $('tlCard'), bar = $('tlClockBar');
  card.classList.toggle('timed', !!tlS.timed);
  if (!tlS.timed || !tlQ) return;
  bar.style.animation = 'none'; bar.style.transform = ''; void bar.offsetWidth;
  bar.style.animation = 'nlclock ' + tlS.limit + 's linear forwards';
  tlTimers.push(setTimeout(function(){ if (tlQ && !tlQ.answered) tlFinish(true); }, tlS.limit * 1000));
}
function tlStopClock(){ var bar = $('tlClockBar'); bar.style.animation = 'none'; bar.style.transform = 'scaleX(0)'; }
function tlPlay(){
  if (!tlQ) return;
  tlTimers.forEach(clearTimeout); tlTimers = []; if (Engine.stopNotes) Engine.stopNotes();
  ensureCtx(); Score.heard(tlSid());
  var ms = tlQ.ps.map(Notatie.midi);                // precies de noten die er staan (hoogte = notatie)
  var t0 = actx.currentTime + .05, d = 60 / tlS.bpm;   // tempo instelbaar (standaard 190)
  ms.forEach(function(m, i){ Engine.note(t0 + i * d, m, d * 1.1, { inst:tlS.timbre, vol:.4 }); });
  if (tlS.timed && !tlQ.answered) tlStartClock();
}

/* --- antwoorden --- */
function tlPickType(id){
  if (!tlQ || tlQ.answered) return;
  tlQ.pickT = id;
  if (tlUseNaam() && !tlQ.pickTon){ tlRenderInput(); var m = $('tlMsg'); m.className = 'qmsg nlmsg'; m.textContent = 'En de grondtoon?'; return; }
  tlFinish(false);
}
function tlPickTonic(p){
  if (!tlQ || tlQ.answered || !tlUseNaam()) return;
  tlQ.pickTon = p; tlPend = 0;
  tlRenderAsk(); tlRenderInput();
  if (tlQ.pickT) tlFinish(false);
}
function tlFinish(late){
  var q = tlQ; q.answered = true; tlStopClock();
  var tonOk = !tlUseNaam() || (q.pickTon && q.pickTon.l === q.ton.l && q.pickTon.a === q.ton.a);
  var typeOk = q.pickT === q.k, ok = !late && tonOk && typeOk;
  var mineT = q.pickT ? tlType(q.pickT) : null;
  var mine = late ? 'tijd op' : (tlUseNaam() && q.pickTon ? tlNote(q.pickTon) + ' ' : '') + (mineT ? tlTName(mineT) : '?');
  Score.log(tlSid(), { k:q.k, q:tlFull(q.ton, q.t) + ' (' + nlClefName(q.clef) + ')', a:mine, ok:ok });
  tlScore.total++; if (ok){ tlScore.right++; tlScore.streak++; } else tlScore.streak = 0;
  $('tlRight').textContent = tlScore.right; $('tlTotal').textContent = tlScore.total; $('tlStreak').textContent = tlScore.streak;
  $('tlToday').textContent = Score.today(tlSid());
  if (tlS.mode === 'horen') tlDraw(true);
  var full = tlFull(q.ton, q.t), msg = $('tlMsg');
  msg.className = 'qmsg nlmsg ' + (ok ? 'good' : 'bad');
  msg.textContent = ok ? 'Goed! ' + full + ' (' + q.t.kenmerk + ').'
    : late ? 'De tijd is op. Het is ' + full + ' (' + q.t.kenmerk + ').'
    : 'Het is ' + full + ', jij koos ' + mine + '.' + (!tonOk && typeOk ? ' De soort klopt, de grondtoon niet.' : '');
  $('tlFormula').innerHTML = '<b>' + tlTName(q.t) + '</b>: ' + tlFormula(q.t) + (mineT && !typeOk ? '<br>' + tlTName(mineT) + ': ' + tlFormula(mineT) + ' <span>(' + mineT.kenmerk + ')</span>' : '');
  $('tlHearBtn').disabled = false;
  tlRenderAsk(); tlRenderInput(); tlStats();
  if (tlS.hear && tlS.mode === 'zien') tlPlay();
  if (ok && tlS.auto) tlTimers.push(setTimeout(tlNew, tlS.hear && tlS.mode === 'zien' ? 3200 : 1100));
}

/* --- tekenen van vraag en invoer --- */
function tlRenderAsk(){
  var q = tlQ; if (!q) return;
  var ton = tlUseNaam() ? (q.answered ? tlNote(q.ton) : q.pickTon ? tlNote(q.pickTon) : '?') : tlNote(q.ton);
  $('tlAsk').innerHTML = ton + ' <u>' + (q.answered ? tlTName(q.t) : '&nbsp;') + '</u>';
}
function tlBtn(html, cls, fn){
  var b = document.createElement('button'); b.type = 'button'; b.className = 'gbtn' + (cls ? ' ' + cls : ''); b.innerHTML = html;
  b.onclick = function(){ b.blur(); fn(); }; return b;
}
function tlRenderInput(){
  var q = tlQ; if (!q) return;
  // grondtoon (alleen bij 'Ook de grondtoon kiezen')
  $('tlTonicBox').style.display = tlUseNaam() ? '' : 'none';
  if (tlUseNaam()){
    $('tlAccRow').querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', +b.dataset.acc === tlPend); });
    var row = $('tlLetRow'); row.innerHTML = '';
    TL_LETS.split('').forEach(function(l){
      var cls = '';
      if (q.answered){ if (l === q.ton.l) cls = 'right'; if (q.pickTon && q.pickTon.l === l && (q.pickTon.l !== q.ton.l || q.pickTon.a !== q.ton.a)) cls = 'wrong'; }
      else if (q.pickTon && q.pickTon.l === l) cls = 'picked';
      var b = tlBtn(tlNote({ l:l, a:0 }) + '<small>' + (tlPend ? tlNote({ l:l, a:tlPend }) : (q.answered && l === q.ton.l && q.ton.a ? tlNote(q.ton) : '&nbsp;')) + '</small>', cls, function(){ tlPickTonic({ l:l, a:tlPend }); });
      row.appendChild(b);
    });
  }
  // soorten, in groepen
  var box = $('tlTypeBox'); box.innerHTML = ''; var n = 0;
  TL_GROUPS.forEach(function(g){
    var ts = TL_TYPES.filter(function(t){ return t.grp === g[0] && tlS.types.indexOf(t.id) >= 0; });
    if (!ts.length) return;
    var lab = document.createElement('div'); lab.className = 'tlglab'; lab.textContent = g[1]; box.appendChild(lab);
    var grp = document.createElement('div'); grp.className = 'tlgrp'; box.appendChild(grp);
    ts.forEach(function(t){
      n++; var key = n <= 9 ? String(n) : n === 10 ? '0' : '', cls = '';
      if (q.answered){ if (t.id === q.k) cls = 'right'; else if (t.id === q.pickT) cls = 'wrong'; }
      else if (t.id === q.pickT) cls = 'picked';
      grp.appendChild(tlBtn(tlTName(t) + '<small>' + (key ? key + ' · ' : '') + t.offs.length + ' tonen</small>', cls, function(){ tlPickType(t.id); }));
    });
  });
}
function tlOrder(){ var o = []; TL_GROUPS.forEach(function(g){ TL_TYPES.forEach(function(t){ if (t.grp === g[0] && tlS.types.indexOf(t.id) >= 0) o.push(t.id); }); }); return o; }

/* --- toetsen (via de keydown-handler van notenleer.js) --- */
function tlKey(e){
  if (!tlQ) return;
  var k = e.key.toLowerCase();
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat && (tlQ.answered || tlS.mode !== 'zien')) tlPlay(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); tlNew(); }
  else if (Keys.is(e, 'stop')){ tlClear(); }
  else if (/^[0-9]$/.test(e.key)){
    var i = e.key === '0' ? 9 : +e.key - 1, id = tlOrder()[i];
    if (id){ e.preventDefault(); tlPickType(id); }
  }
  else if (tlUseNaam() && (e.key === '-' || e.key === '+' || e.key === '=')){
    e.preventDefault(); var a = e.key === '-' ? -1 : 1; tlPend = tlPend === a ? 0 : a; tlRenderInput();
  }
  else if (tlUseNaam() && k.length === 1 && TL_LETS.indexOf(k) >= 0){
    e.preventDefault(); tlPickTonic({ l:k, a:e.shiftKey ? 1 : tlPend });
  }
}

/* --- statistieken --- */
function tlStats(){
  var st = Score.tally(tlSid()), rec = Score.recent(tlSid(), 20), rows = [], R = 0, T = 0;
  Object.keys(st).forEach(function(k){
    var s = st[k]; if (!s.t) return; R += s.r; T += s.t;
    var wrong = {}; (rec[k] || []).forEach(function(x){ if (!x.ok && x.a) wrong[x.a] = (wrong[x.a] || 0) + 1; });
    var w = Object.keys(wrong).sort(function(a, b){ return wrong[b] - wrong[a]; });
    var why = w.length ? (w[0] === 'tijd op' ? 'vaak te laat' : 'meestal verward met ' + w[0] + ' (' + wrong[w[0]] + '×)') + (w.length > 1 ? ', ook ' + w.slice(1, 3).join(', ') : '') : '';
    rows.push({ label:tlLabel(k), r:s.r, t:s.t, p:s.r / s.t, why:why });
  });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  var weak = rows.filter(function(r){ return r.p < 1; }).slice(0, 3);
  $('tlStatSum').innerHTML = '📊 Statistieken' + (T ? ' · ' + Math.round(R / T * 100) + '% goed' + (weak.length ? ' · zwakst: ' + weak.map(function(r){ return '<span class="nlchip">' + r.label + '</span>'; }).join(' ') : '') : ' · nog leeg') + ' <span class="muted">alles ▸</span>';
  $('tlStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div>' + (r.why ? '<div class="why">' + r.why + '</div>' : '') + '</div>'; }).join('')
    : '<p class="note">Nog geen antwoorden. De toonladders die je het vaakst mist komen hier bovenaan en krijg je ook vaker.</p>';
}

/* --- paneel --- */
function tlSyncUI(){
  $('tlLevel').value = tlS.level; $('tlMode').value = tlS.mode; $('tlHoogte').value = tlS.hoogte; $('tlBpm').value = String(tlS.bpm);
  document.querySelector('.nlsub[data-sub="ladder"]').classList.toggle('hmid', tlS.hoogte !== 'balk'); $('tlNaam').checked = tlS.naam;
  $('tlNaam').disabled = tlS.mode === 'horen';
  document.querySelectorAll('#tlTypeChips input').forEach(function(i){ i.checked = tlS.types.indexOf(i.value) >= 0; });
  $('tlTonics').value = tlS.tonics; $('tlDbl').checked = tlS.dbl;
  if (tlBUI) tlBUI.sync();
  $('tlStyle').value = tlS.style; $('tlHear').checked = tlS.hear; $('tlInst').value = tlS.timbre;
  $('tlAuto').checked = tlS.auto; $('tlTimed').checked = tlS.timed; $('tlLimit').value = tlS.limit;
}
function tlStart(prof){ tlSwitch(prof || 'blad'); tlStats(); tlNew(); }
function tlInit(){
  if (!$('tlLevel')) return;
  tlLoad();
  $('tlLevel').innerHTML = TL_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen keuze (🕹️)</option>';
  $('tlInst').innerHTML = Engine.instOptions(tlS.timbre);
  $('tlTypeChips').innerHTML = TL_GROUPS.map(function(g){
    return '<div class="chips tlgrp">' + TL_TYPES.filter(function(t){ return t.grp === g[0]; }).map(function(t){
      return '<label class="chip" title="' + t.kenmerk + ' · ' + tlFormula(t) + '"><input type="checkbox" value="' + t.id + '"> ' + t.nl + '</label>'; }).join('') + '</div>';
  }).join('');
  var active = function(){ return typeof nlCur !== 'undefined' && nlCur === 'ladder'; };
  var changed = function(renew){ tlSave(); tlSyncUI(); if (active()){ if (renew) tlNew(); else { tlRenderAsk(); tlRenderInput(); } } };
  tlBUI = nlBereikUI($('tlBereik'), tlS, function(){ tlMatchLevel(); changed(true); }, { clefsLedger:true });
  tlSyncUI();
  $('tlLevel').onchange = function(e){
    var L = TL_LEVELS.find(function(l){ return l.id === e.target.value; });
    tlS.level = e.target.value;
    if (L) tlApplyLevel(tlS, L); else Paneel.set('ntView', true);
    changed(true);
  };
  $('tlTypeChips').onchange = function(){
    var t = []; document.querySelectorAll('#tlTypeChips input:checked').forEach(function(i){ t.push(i.value); });
    if (t.length < 2){ tlSyncUI(); var m = $('tlMsg'); m.className = 'qmsg nlmsg bad'; m.textContent = 'Kies minstens twee soorten toonladders.'; return; }
    tlS.types = t; tlFix(); tlMatchLevel(); changed(true);
  };
  $('tlTonics').onchange = function(e){ tlS.tonics = e.target.value; tlMatchLevel(); changed(true); };
  $('tlDbl').onchange = function(e){ tlS.dbl = e.target.checked; changed(true); };
  $('tlMode').onchange = function(e){ tlS.mode = e.target.value; changed(true); };
  gehBpmFill($('tlBpm')); $('tlBpm').value = String(tlS.bpm);
  $('tlBpm').onchange = function(e){ tlS.bpm = +e.target.value; tlSave(); if (tlQ && tlS.mode !== 'zien' && !tlQ.answered) tlPlay(); };
  $('tlHoogte').onchange = function(e){ tlS.hoogte = e.target.value; changed(true); };
  $('tlNaam').onchange = function(e){ tlS.naam = e.target.checked; changed(true); };
  $('tlStyle').onchange = function(e){ tlS.style = e.target.value; changed(false); tlStats(); };
  $('tlHear').onchange = function(e){ tlS.hear = e.target.checked; changed(false); };
  $('tlInst').onchange = function(e){ tlS.timbre = e.target.value; changed(false); };
  $('tlAuto').onchange = function(e){ tlS.auto = e.target.checked; changed(false); };
  $('tlTimed').onchange = function(e){ tlS.timed = e.target.checked; changed(true); };
  $('tlLimit').onchange = function(e){ tlS.limit = Math.min(30, Math.max(1, Math.round(+e.target.value) || 10)); changed(true); };
  $('tlAccRow').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ b.blur(); var a = +b.dataset.acc; tlPend = tlPend === a ? 0 : a; tlRenderInput(); }; });
  document.querySelectorAll('#ntView .nlsub[data-sub="ladder"] select, #ntView .nlsub[data-sub="ladder"] input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('tlNext').onclick = function(){ this.blur(); tlNew(); };
  $('tlHearBtn').onclick = function(){ this.blur(); if (tlQ && (tlQ.answered || tlS.mode !== 'zien')) tlPlay(); };
  $('tlReset').onclick = function(){ Score.clear(tlSid()); tlStats(); $('tlToday').textContent = 0; };
  $('tlToday').textContent = Score.today(tlSid());
  tlStats();
  if (typeof view !== 'undefined' && NL_ROUTES[view] && NL_ROUTES[view][0] === 'ladder') nlSub('ladder', NL_ROUTES[view][1]);   // direct geopend
}
tlInit();
