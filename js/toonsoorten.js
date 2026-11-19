/* ================= Notenleer → Toonsoorten (prefix ts; blok .nlsub[data-sub="toon"] in #ntView) =================
   Je ziet een voortekening op de balk en zegt welke toonsoort erbij hoort.
   Vraagsoorten (tsS.ask): 'maj' = majeur (alleen voortekening), 'min' = mineur (alleen voortekening),
   'modus' = kerktoonladder (tsS.modes, zie TS_MODES). Altijd: alleen de voortekening + de soort gegeven ("___ majeur",
   "___ dorisch") → jij noemt de grondtoon (wens gebruiker; het omgekeerde, "D ____", doet Toonladders).
   Antwoord: 15 knoppen (♯-kant / ♭-kant, labels = de grondtoon van die soort bij elke voortekening) of letters (Shift = ♯, eerst - = ♭, eerst + = ♯).
   Gebruikt het gedeelde keuzeblok van Notenleer (nlBereikUI met {keysOnly:true}: sleutels + toonsoorten) en Notatie.draw.
   Score: onderdeel 'toonsoorten', k = '<maj|min|modus-id>:<voortekening = majeur-id uit Notatie.KEYLIST>',
   bv. 'maj:D' (D-groot), 'min:D' (b-klein), 'dor:D' (E-dorisch). Opslag 'toonsoorten-settings'.
   API voor notenleer.js / presets.js: tsStart() tsClear() tsKey(e) tsNew() tsFix() tsMatchLevel() tsSave() tsSyncUI() tsStats(). */

// modi uit de gedeelde theoriebibliotheek (19-11-2026): elke toonladder in Theorie.SCALES die een draaiing van majeur is
// (dus met een gewone voortekening) is hier een modus; deg = op welke trap van de majeurladder hij begint.
// ids blijven ion … loc (zo blijven opgeslagen keuzes en statistieken kloppen); majeur = ionisch, natuurlijk mineur = aeolisch.
var TS_MODES = (function(){
  var MAJ = [0,2,4,5,7,9,11], NAMEN = { maj:['ion','ionisch','Ionian','= majeur'], nmin:['aeo','aeolisch','Aeolian','= natuurlijk mineur'] };
  var out = [];
  Theorie.SCALES.forEach(function(sc){
    if (sc.semis.length !== 7) return;
    for (var d = 0; d < 7; d++){
      var rot = MAJ.map(function(_, k){ return (MAJ[(d + k) % 7] - MAJ[d] + 12) % 12; });
      if (rot.join() !== sc.semis.join()) continue;
      var n = NAMEN[sc.id];
      out.push(n ? { id:n[0], deg:d, nl:n[1], en:n[2], hint:n[3] } : { id:sc.id, deg:d, nl:sc.nl, en:sc.en, hint:sc.kenmerk });
      break;
    }
  });
  return out.sort(function(a, b){ return a.deg - b.deg; });
})();
var TS_ALLMODES = TS_MODES.map(function(m){ return m.id; });
var TS_LET = 'cdefgab', TS_SHARPS = 'fcgdaeb', TS_FLATS = 'beadgcf';
function tsKeysUpTo(n){ return Notatie.KEYLIST.filter(function(k){ return Math.abs(k.n) <= n; }).map(function(k){ return k.id; }); }
function tsLv(id, name, ask, modes, clefs, max){ return { id:id, name:name, ask:ask, modes:modes || [], clefs:clefs, max:max }; }
var TS_LEVELS = [
  tsLv('t1',  '1 · majeur, tot 2 voortekens',               ['maj'], null, ['g'], 2),
  tsLv('t2',  '2 · majeur, tot 4, viool + bas',             ['maj'], null, ['g','f'], 4),
  tsLv('t3',  '3 · majeur, alle 15',                        ['maj'], null, ['g','f'], 7),
  tsLv('t4',  '4 · mineur, tot 3',                          ['min'], null, ['g','f'], 3),
  tsLv('t5',  '5 · mineur, alle 15',                        ['min'], null, ['g','f'], 7),
  tsLv('t6',  '6 · majeur en mineur door elkaar',           ['maj','min'], null, ['g','f'], 7),
  tsLv('t7',  '7 · majeur en mineur, alt- en tenorsleutel', ['maj','min'], null, ['c3','c4'], 7),
  tsLv('t8',  '8 · modi: ionisch, dorisch, mixolydisch, aeolisch', ['modus'], ['ion','dor','mix','aeo'], ['g','f'], 3),
  tsLv('t9',  '9 · alle zeven modi, tot 4 voortekens',      ['modus'], TS_ALLMODES, ['g','f'], 4),
  tsLv('t10', '10 · alles door elkaar, alle sleutels',      ['maj','min','modus'], TS_ALLMODES, ['grand','g','f','c1','c2','c3','c4','c5'], 7)
];
var TS_SKEY = 'toonsoorten-settings';
var tsS = null, tsQ = null, tsH = null, tsTimers = [], tsPend = 0, tsLastK = null, tsBUI = null;
var tsScore = { right:0, total:0, streak:0 };

function tsApplyLevel(s, L){
  s.ask = L.ask.slice(); s.modes = L.modes.length ? L.modes.slice() : (s.modes && s.modes.length ? s.modes : TS_ALLMODES.slice());
  s.clefs = L.clefs.slice(); s.keys = tsKeysUpTo(L.max);
}
function tsDefaults(){
  var inst = 'piano'; try { inst = localStorage.getItem('standaard-klank') || 'piano'; } catch(e){}
  var s = { level:'t1', ask:['maj'], modes:TS_ALLMODES.slice(), clefs:['g'], keys:[], up:0, down:0, acc:false, dbl:false, keysig:true,
            style:'nl', hear:'drieklank', auto:true, timbre:inst, timed:false, limit:8 };
  tsApplyLevel(s, TS_LEVELS[0]);
  return s;
}
function tsFix(){
  var s = tsS;
  if (!Array.isArray(s.ask)) s.ask = ['maj'];
  s.ask = ['maj','min','modus'].filter(function(a){ return s.ask.indexOf(a) >= 0; });
  if (!s.ask.length) s.ask = ['maj'];
  if (!Array.isArray(s.modes)) s.modes = TS_ALLMODES.slice();
  s.modes = TS_ALLMODES.filter(function(m){ return s.modes.indexOf(m) >= 0; });
  if (!s.modes.length) s.modes = TS_ALLMODES.slice();
  s.up = 0; s.down = 0; s.acc = false; s.dbl = false; s.keysig = true;
  nlBereikFix(s); s.keysig = true;
  s.timbre = Engine.instId(s.timbre);
  s.limit = Math.min(30, Math.max(1, Math.round(+s.limit) || 8));
  if (['drieklank','ladder','uit'].indexOf(s.hear) < 0) s.hear = 'drieklank';
}
function tsLoad(){
  var s = {}; try { s = JSON.parse(localStorage.getItem(TS_SKEY)) || {}; } catch(e){}
  tsS = Object.assign(tsDefaults(), s);
  tsFix(); tsMatchLevel();
}
function tsSave(){ try { localStorage.setItem(TS_SKEY, JSON.stringify(tsS)); } catch(e){} }
function tsSame(a, b){ return a.slice().sort().join() === b.slice().sort().join(); }
function tsMatchLevel(){
  var L = TS_LEVELS.find(function(l){
    return tsSame(l.ask, tsS.ask) && (l.ask.indexOf('modus') < 0 || tsSame(l.modes, tsS.modes))
      && tsSame(l.clefs, tsS.clefs) && tsSame(tsKeysUpTo(l.max), tsS.keys);
  });
  tsS.level = L ? L.id : 'eigen';
}

/* --- namen --- */
function tsKeyOf(id){ return Notatie.KEYLIST.find(function(k){ return k.id === id; }); }
function tsDeg(sig, d){                             // trap d (0 = majeur-grondtoon) in de toonsoort met voortekening sig
  var K = tsKeyOf(sig), l = TS_LET[(TS_LET.indexOf(K.p.l) + d) % 7];
  return { l:l, a:Notatie.keySig(sig)[l], o:4 };
}
function tsMode(id){ return TS_MODES.find(function(m){ return m.id === id; }); }
function tsNote(p){ return Notatie.name(p, tsS.style); }
function tsLow(p){ var n = tsNote(p); return tsS.style === 'en' ? n : n.charAt(0).toLowerCase() + n.slice(1); }
function tsTonic(kind, sig, mode){ return kind === 'maj' ? tsDeg(sig, 0) : kind === 'min' ? tsDeg(sig, 5) : tsDeg(sig, tsMode(mode).deg); }
function tsFull(kind, sig, mode){
  var en = tsS.style === 'en', t = tsTonic(kind, sig, mode);
  if (kind === 'maj') return tsNote(t) + (en ? ' major' : '-groot');
  if (kind === 'min') return tsLow(t) + (en ? ' minor' : '-klein');
  var M = tsMode(mode); return tsNote(t) + (en ? ' ' + M.en : '-' + M.nl);
}
function tsSigText(sig){
  var n = tsKeyOf(sig).n; if (!n) return 'geen voortekens';
  var o = n > 0 ? TS_SHARPS : TS_FLATS;
  return Math.abs(n) + (n > 0 ? '♯' : '♭') + ' (' + o.slice(0, Math.abs(n)).split('').map(function(l){ return tsNote({ l:l, a:n > 0 ? 1 : -1, o:4 }); }).join(' ') + ')';
}
function tsParseK(k){ var i = k.indexOf(':'), a = k.slice(0, i), sig = k.slice(i + 1); return a === 'maj' || a === 'min' ? { kind:a, sig:sig } : { kind:'modus', mode:a, sig:sig }; }
function tsLabel(k){
  var q = tsParseK(k); if (!tsKeyOf(q.sig)) return k;
  var n = tsKeyOf(q.sig).n;
  return tsFull(q.kind, q.sig, q.mode) + ' · ' + (n ? Math.abs(n) + (n > 0 ? '♯' : '♭') : '0');
}
function tsLevelKey(){
  var base = tsS.level === 'eigen'
    ? 'eigen:' + tsS.ask.join(',') + (tsS.ask.indexOf('modus') >= 0 ? '/' + tsS.modes.join(',') : '') + '|' + tsS.clefs.join('-') + '|k' + tsS.keys.length
    : tsS.level;
  return base + (tsS.timed ? '|' + tsS.limit + 's' : '');
}
Score.def('toonsoorten', {
  name:'Toonsoorten', view:'toonsoorten',
  label:tsLabel,
  level:tsLevelKey,
  levelName:function(lv){
    var p = lv.split('|'), L = TS_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + (/^\d+s$/.test(p[p.length - 1]) ? ', ' + p[p.length - 1] + ' per vraag' : '');
  },
  next:function(lv){
    var p = lv.split('|'), i = TS_LEVELS.findIndex(function(l){ return l.id === p[0]; });
    if (i >= 0 && i < TS_LEVELS.length - 1) return 'niveau ' + TS_LEVELS[i + 1].name;
    if (!/^\d+s$/.test(p[p.length - 1])) return 'zet de tijdmodus aan';
    return 'minder seconden per vraag';
  }
});

/* --- vragen --- */
function tsItems(){
  var out = [];
  tsS.ask.forEach(function(kind){
    tsS.keys.forEach(function(sig){
      if (kind === 'modus') tsS.modes.forEach(function(m){ out.push({ kind:'modus', mode:m, sig:sig, k:m + ':' + sig }); });
      else out.push({ kind:kind, sig:sig, k:kind + ':' + sig });
    });
  });
  return out;
}
function tsPick(items){
  var st = Score.tally('toonsoorten', 20);
  if (items.length > 1) items = items.filter(function(x){ return x.k !== tsLastK; });
  var ws = items.map(function(x){ var s = st[x.k]; var err = s ? (s.t - s.r + 1) / (s.t + 2) : .5; return .3 + err * 2; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum;
  for (var i = 0; i < items.length; i++){ r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function tsPlace(t, clef){                          // grondtoon op of vlak bij de balk
  var c = clef === 'grand' ? 'g' : clef, best = null;
  for (var o = 1; o <= 7; o++){
    var p = { l:t.l, a:t.a, o:o }, pos = Notatie.pos(p, c);
    if (pos < 0 || pos > 8) continue;
    if (!best || Math.abs(pos - 4) < Math.abs(best.pos - 4)) best = { p:p, pos:pos };
  }
  return best ? best.p : { l:t.l, a:t.a, o:4 };
}
function tsClear(){
  tsTimers.forEach(clearTimeout); tsTimers = [];
  if (typeof Engine !== 'undefined' && Engine.stopNotes) Engine.stopNotes();
}
function tsNew(){
  tsClear();
  Score.ask('toonsoorten');
  var x = tsPick(tsItems()); tsLastK = x.k;
  var clef = tsS.clefs[Math.floor(Math.random() * tsS.clefs.length)];
  var tonic = tsTonic(x.kind, x.sig, x.mode);
  var notes = [];
  tsQ = { kind:x.kind, sig:x.sig, mode:x.mode, k:x.k, clef:clef, tonic:tonic, answered:false, ans:null };
  tsPend = 0;
  tsH = Notatie.draw($('tsStaff'), { clef:clef, key:x.sig, notes:notes, range:[-1, 9], width:clef === 'grand' ? 260 : 240, zoom:1.7, maxHeight:340 });
  Score.heard('toonsoorten');
  tsRenderAsk();
  var msg = $('tsMsg'); msg.className = 'qmsg nlmsg'; msg.textContent = '';
  $('tsHearBtn').disabled = true;
  tsRenderInput();
  tsStartClock();
}
function tsStartClock(){
  var card = $('tsCard'), bar = $('tsClockBar');
  card.classList.toggle('timed', !!tsS.timed);
  if (!tsS.timed || !tsQ) return;
  bar.style.animation = 'none'; bar.style.transform = ''; void bar.offsetWidth;
  bar.style.animation = 'nlclock ' + tsS.limit + 's linear forwards';
  tsTimers.push(setTimeout(function(){ if (tsQ && !tsQ.answered) tsFinish(null); }, tsS.limit * 1000));
}
function tsStopClock(){ var bar = $('tsClockBar'); bar.style.animation = 'none'; bar.style.transform = 'scaleX(0)'; }

/* --- klank: drieklank of toonladder van de gevraagde toonsoort --- */
function tsScale(q){
  var li = TS_LET.indexOf(q.tonic.l), sig = Notatie.keySig(q.sig), m0 = Notatie.midi({ l:q.tonic.l, a:q.tonic.a, o:4 });
  var o = m0 > 67 ? 3 : 4, out = [];
  for (var i = 0; i < 8; i++){
    var j = li + i, l = TS_LET[j % 7];
    out.push(Notatie.midi({ l:l, a:sig[l], o:o + Math.floor(j / 7) }));
  }
  return out;
}
function tsHearIt(){
  if (!tsQ || !tsQ.answered) return;
  tsClear(); ensureCtx();
  var sc = tsScale(tsQ), t = actx.currentTime + .05, v = { inst:tsS.timbre, vol:.4 };
  if (tsS.hear === 'ladder'){ sc.forEach(function(m, i){ Engine.note(t + i * .3, m, .32, v); }); return; }
  [0, 2, 4].forEach(function(i, n){ Engine.note(t + n * .32, sc[i], .34, v); });
  [0, 2, 4, 7].forEach(function(i){ Engine.note(t + 1.05, sc[i], 1.3, { inst:tsS.timbre, vol:.3 }); });
}

/* --- antwoorden --- */
function tsAnswerKey(p){                            // grondtoon {l, a} (majeur/mineur)
  if (!tsQ || tsQ.answered) return;
  tsFinish({ p:p });
}
function tsTip(q){
  var K = tsKeyOf(q.sig), n = K.n, maj = tsFull('maj', q.sig), tip;
  if (n === 0) tip = 'Geen voortekens: C-groot (of a-klein).';
  else if (n === 1) tip = 'Eén kruis (' + tsNote({ l:'f', a:1 }) + ') = G-groot.';
  else if (n === -1) tip = 'Eén mol (' + tsNote({ l:'b', a:-1 }) + ') = F-groot.';
  else if (n > 0){ var last = { l:TS_SHARPS[n - 1], a:1 }; tip = 'Laatste kruis: ' + tsNote(last) + '; een halve toon hoger = ' + maj + '.'; }
  else { var pen = { l:TS_FLATS[-n - 2], a:-1 }; tip = 'Voorlaatste mol: ' + tsNote(pen) + ' = ' + maj + '.'; }
  if (q.kind === 'min') tip += ' Mineur ligt een kleine terts lager: ' + maj + ' → ' + tsFull('min', q.sig) + '.';
  if (q.kind === 'modus'){
    var M = tsMode(q.mode);
    tip += ' ' + (M.nl.charAt(0).toUpperCase() + M.nl.slice(1)) + ' begint op trap ' + (M.deg + 1) + ' daarvan: ' + tsNote(q.tonic) + ' (' + M.hint + ').';
  }
  return tip;
}
function tsFinish(ans){
  var q = tsQ; q.answered = true; q.ans = ans; tsStopClock();
  var ok = false, mine = 'tijd op';
  if (ans && ans.p){
    ok = ans.p.l === q.tonic.l && ans.p.a === q.tonic.a;
    mine = tsTypeName(q, ans.p);
  }
  var full = tsFull(q.kind, q.sig, q.mode);
  Score.log('toonsoorten', { k:q.k, q:full + ' (' + tsSigText(q.sig) + ', ' + nlClefName(q.clef) + ')', a:mine, ok:ok });
  tsScore.total++; if (ok){ tsScore.right++; tsScore.streak++; } else tsScore.streak = 0;
  $('tsRight').textContent = tsScore.right; $('tsTotal').textContent = tsScore.total; $('tsStreak').textContent = tsScore.streak;
  $('tsToday').textContent = Score.today('toonsoorten');
  var msg = $('tsMsg');
  msg.className = 'qmsg nlmsg ' + (ok ? 'good' : 'bad');
  msg.textContent = ok ? 'Goed! ' + full + ' · ' + tsSigText(q.sig) + '.'
    : (!ans ? 'De tijd is op. Het is ' : 'Het is ') + full + (ans ? ', jij koos ' + mine : '') + '. ' + tsTip(q);
  $('tsHearBtn').disabled = tsS.hear === 'uit';
  tsRenderAsk(); tsRenderInput(); tsStats();
  if (tsS.hear !== 'uit') tsHearIt();
  if (ok && tsS.auto) tsTimers.push(setTimeout(tsNew, tsS.hear !== 'uit' ? 2300 : 900));
}

/* --- invoer tekenen --- */
function tsBtn(html, cls, fn){
  var b = document.createElement('button'); b.type = 'button'; b.className = 'gbtn' + (cls ? ' ' + cls : ''); b.innerHTML = html;
  b.onclick = function(){ b.blur(); fn(); }; return b;
}
// naam van de soort achter een grondtoon: 'Es-groot', 'f-klein', 'F-dorisch' (of Engels)
function tsKindWord(q){
  var en = tsS.style === 'en';
  if (q.kind === 'maj') return en ? 'major' : 'groot';
  if (q.kind === 'min') return en ? 'minor' : 'klein';
  var M = tsMode(q.mode); return en ? M.en : M.nl;
}
function tsTypeName(q, p){
  var en = tsS.style === 'en', w = tsKindWord(q), n = q.kind === 'min' ? tsLow(p) : tsNote(p);
  return n + (en ? ' ' : '-') + w;
}
function tsRenderAsk(){                             // "___ majeur" / "___ dorisch": soort gegeven, grondtoon invullen
  var q = tsQ; if (!q) return;
  var en = tsS.style === 'en', w = q.kind === 'maj' ? (en ? 'major' : 'majeur') : q.kind === 'min' ? (en ? 'minor' : 'mineur') : tsKindWord(q);
  $('tsAsk').innerHTML = '<u>' + (q.answered ? (q.kind === 'min' ? tsLow(q.tonic) : tsNote(q.tonic)) : '&nbsp;') + '</u> ' + w;
}
function tsRenderInput(){
  var q = tsQ;
  $('tsKeysBox').style.display = '';
  $('tsModeBox').style.display = 'none';
  if (!q) return;
  var rows = { s:$('tsSharpRow'), f:$('tsFlatRow') }, deg = q.kind === 'maj' ? 0 : q.kind === 'min' ? 5 : tsMode(q.mode).deg;
  rows.s.innerHTML = ''; rows.f.innerHTML = '';
  Notatie.KEYLIST.forEach(function(K){
    var t = tsDeg(K.id, deg), cls = '';
    if (q.answered){
      if (t.l === q.tonic.l && t.a === q.tonic.a) cls = 'right';
      else if (q.ans && q.ans.p && q.ans.p.l === t.l && q.ans.p.a === t.a) cls = 'wrong';
    }
    var lab = q.kind === 'min' ? tsLow(t) : tsNote(t);
    rows[K.n >= 0 ? 's' : 'f'].appendChild(tsBtn(lab + '<small>' + tsKindWord(q) + '</small>', cls, function(){ tsAnswerKey({ l:t.l, a:t.a }); }));
  });
}

/* --- toetsen (aangeroepen door de keydown-handler van notenleer.js als Toonsoorten open is) --- */
function tsKey(e){
  if (!tsQ) return;
  var k = e.key.toLowerCase();
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) tsHearIt(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); tsNew(); }
  else if (Keys.is(e, 'stop')){ tsClear(); }
  else if ((e.key === '-' || e.key === '+' || e.key === '=')){
    e.preventDefault(); var a = e.key === '-' ? -1 : 1; tsPend = tsPend === a ? 0 : a;
    var msg = $('tsMsg'); if (!tsQ.answered){ msg.className = 'qmsg nlmsg'; msg.textContent = tsPend ? (tsPend > 0 ? '♯' : '♭') + ' gekozen, nu de letter' : ''; }
  }
  else if (k.length === 1 && TS_LET.indexOf(k) >= 0){
    e.preventDefault(); var acc = e.shiftKey ? 1 : tsPend; tsPend = 0; tsAnswerKey({ l:k, a:acc });
  }
}

/* --- statistieken (ingeklapt, zoals Noten benoemen) --- */
function tsStats(){
  var st = Score.tally('toonsoorten'), rec = Score.recent('toonsoorten', 20), rows = [], R = 0, T = 0;
  Object.keys(st).forEach(function(k){
    var s = st[k]; if (!s.t) return; R += s.r; T += s.t;
    var wrong = {}; (rec[k] || []).forEach(function(x){ if (!x.ok && x.a) wrong[x.a] = (wrong[x.a] || 0) + 1; });
    var w = Object.keys(wrong).sort(function(a, b){ return wrong[b] - wrong[a]; });
    var why = w.length ? (w[0] === 'tijd op' ? 'vaak te laat' : 'meestal verward met ' + w[0] + ' (' + wrong[w[0]] + '×)') + (w.length > 1 ? ', ook ' + w.slice(1, 3).join(', ') : '') : '';
    rows.push({ label:tsLabel(k), r:s.r, t:s.t, p:s.r / s.t, why:why });
  });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  var weak = rows.filter(function(r){ return r.p < 1; }).slice(0, 3);
  $('tsStatSum').innerHTML = '📊 Statistieken' + (T ? ' · ' + Math.round(R / T * 100) + '% goed' + (weak.length ? ' · zwakst: ' + weak.map(function(r){ return '<span class="nlchip">' + r.label + '</span>'; }).join(' ') : '') : ' · nog leeg') + ' <span class="muted">alles ▸</span>';
  $('tsStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div>' + (r.why ? '<div class="why">' + r.why + '</div>' : '') + '</div>'; }).join('')
    : '<p class="note">Nog geen antwoorden. De toonsoorten die je het vaakst mist komen hier bovenaan en krijg je ook vaker.</p>';
}

/* --- paneel --- */
function tsSyncUI(){
  $('tsLevel').value = tsS.level;
  document.querySelectorAll('#tsAskChips input').forEach(function(i){ i.checked = tsS.ask.indexOf(i.value) >= 0; });
  document.querySelectorAll('#tsModeChips input').forEach(function(i){ i.checked = tsS.modes.indexOf(i.value) >= 0; });
  $('tsModesBox').style.display = tsS.ask.indexOf('modus') >= 0 ? '' : 'none';
  if (tsBUI) tsBUI.sync();
  $('tsStyle').value = tsS.style; $('tsHear').value = tsS.hear; $('tsInst').value = tsS.timbre;
  $('tsAuto').checked = tsS.auto; $('tsTimed').checked = tsS.timed; $('tsLimit').value = tsS.limit;
}
function tsStart(){ tsStats(); tsNew(); }
function tsInit(){
  if (!$('tsLevel')) return;
  tsLoad();
  $('tsLevel').innerHTML = TS_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen keuze (🕹️)</option>';
  $('tsInst').innerHTML = Engine.instOptions(tsS.timbre);
  $('tsModeChips').innerHTML = TS_MODES.map(function(m){ return '<label class="chip"><input type="checkbox" value="' + m.id + '"> ' + m.nl + ' <span class="muted">' + m.hint + '</span></label>'; }).join('');
  var active = function(){ return typeof nlCur !== 'undefined' && nlCur === 'toon'; };
  var changed = function(renew){ tsSave(); tsSyncUI(); if (active()){ if (renew) tsNew(); else tsRenderInput(); } };
  tsBUI = nlBereikUI($('tsBereik'), tsS, function(){ tsS.keysig = true; tsMatchLevel(); changed(true); }, { keysOnly:true });
  tsSyncUI();
  $('tsLevel').onchange = function(e){
    var L = TS_LEVELS.find(function(l){ return l.id === e.target.value; });
    tsS.level = e.target.value;
    if (L) tsApplyLevel(tsS, L); else Paneel.set('ntView', true);
    changed(true);
  };
  $('tsAskChips').onchange = function(){
    var a = []; document.querySelectorAll('#tsAskChips input:checked').forEach(function(i){ a.push(i.value); });
    tsS.ask = a.length ? a : ['maj']; tsFix(); tsMatchLevel(); changed(true);
  };
  $('tsModeChips').onchange = function(){
    var m = []; document.querySelectorAll('#tsModeChips input:checked').forEach(function(i){ m.push(i.value); });
    tsS.modes = m.length ? m : ['ion']; tsFix(); tsMatchLevel(); changed(true);
  };
  $('tsStyle').onchange = function(e){ tsS.style = e.target.value; changed(false); tsStats(); if (active() && tsQ && tsQ.answered) $('tsMsg').textContent = ''; };
  $('tsHear').onchange = function(e){ tsS.hear = e.target.value; changed(false); };
  $('tsInst').onchange = function(e){ tsS.timbre = e.target.value; changed(false); };
  $('tsAuto').onchange = function(e){ tsS.auto = e.target.checked; changed(false); };
  $('tsTimed').onchange = function(e){ tsS.timed = e.target.checked; changed(true); };
  $('tsLimit').onchange = function(e){ tsS.limit = Math.min(30, Math.max(1, Math.round(+e.target.value) || 8)); changed(true); };
  document.querySelectorAll('#ntView .nlsub[data-sub="toon"] select, #ntView .nlsub[data-sub="toon"] input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('tsNext').onclick = function(){ this.blur(); tsNew(); };
  $('tsHearBtn').onclick = function(){ this.blur(); tsHearIt(); };
  $('tsReset').onclick = function(){ Score.clear('toonsoorten'); tsStats(); $('tsToday').textContent = 0; };
  $('tsToday').textContent = Score.today('toonsoorten');
  tsStats();
}
tsInit();
