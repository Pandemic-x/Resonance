/* ================= Notenleer (view #notenleer, div #ntView, prefix nl) =================
   Groep "Bladmuziek" in het menu. Overzicht met tegels (class `board`), daarna een oefening. Bouwt op de gedeelde
   notatie-kern `Notatie` (js/notatie.js): notenbalk, spelling, oplichten, afspelen, pianoklavier, vraagstof (pool).

   Herbruikbaar voor alle Notenleer-oefeningen:
     NL_BEREIK_DEF                standaardvelden {clefs, up, down, acc, keysig, keys}
     nlBereikUI(box, s, onChange) bouwt in `box` de keuze van sleutels, hulplijnen boven/onder, losse voortekens en
                                  toonsoorten (aan/uit + welke); schrijft in s en roept onChange(); → {sync()}
     nlBereikKey(s)               korte sleutel van die keuze (voor Score-niveaus)
   Oefening 1: Noten benoemen. Eén noot op de balk; antwoord met het pianoklavier (standaard) of de letters.
   Klavier: elke toets met dezelfde naam is goed, behalve als 'Ook het octaaf' aan staat.
   Score: onderdeel 'notenleer', k = Notatie.pool-sleutel, bv. 'g:f#5', 'c3:c4', 'pf:g2'. Opslag 'notenleer-settings'. */

/* ---------- gedeeld: sleutels, bereik en toonsoorten ---------- */
// volgorde (ook in het paneel): pianobalk, viool, bas, daarna de C-sleutels van hoog naar laag
var NL_CLEFS = [
  { id:'grand', naam:'Pianobalk (accolade)' }, { id:'g', naam:'Vioolsleutel' }, { id:'f', naam:'Bassleutel' },
  { id:'c1', naam:'Sopraansleutel' }, { id:'c2', naam:'Mezzosopraansleutel' }, { id:'c3', naam:'Altsleutel' },
  { id:'c4', naam:'Tenorsleutel' }, { id:'c5', naam:'Baritonsleutel' }
];
var NL_ALLKEYS = Notatie.KEYLIST.map(function(k){ return k.id; });
var NL_BEREIK_DEF = { clefs:['g'], up:0, down:0, acc:false, dbl:false, keysig:false, keys:NL_ALLKEYS.slice() };
function nlKeyName(id){ var k = Notatie.KEYLIST.find(function(x){ return x.id === id; }); return k ? Notatie.name(k.p, (typeof nlS !== 'undefined' && nlS && nlS.style) || 'nl') : id; }
function nlKeyLabel(k){ return nlKeyName(k.id) + ' · ' + (k.n === 0 ? '0' : Math.abs(k.n) + (k.n > 0 ? '♯' : '♭')); }
function nlBereikKey(s){
  return s.clefs.join('-') + '|u' + s.up + 'd' + s.down + (s.acc ? '|acc' : '') + (s.dbl ? '|dbl' : '') + (s.keysig ? '|k' + s.keys.length : '');
}
function nlBereikFix(s){
  if (s.ledger != null && s.up == null){ s.up = Math.min(7, +s.ledger || 0); s.down = Math.min(5, +s.ledger || 0); }
  delete s.ledger;
  s.up = Math.min(7, Math.max(0, +s.up || 0)); s.down = Math.min(7, Math.max(0, +s.down || 0));
  if (!Array.isArray(s.clefs)) s.clefs = ['g'];
  s.clefs = s.clefs.filter(function(c){ return NL_CLEFS.some(function(x){ return x.id === c; }); });
  if (!s.clefs.length) s.clefs = ['g'];
  if (!Array.isArray(s.keys)) s.keys = NL_ALLKEYS.slice();
  s.keys = s.keys.filter(function(k){ return NL_ALLKEYS.indexOf(k) >= 0; });
  if (!s.keys.length) s.keys = ['C'];
  s.acc = !!s.acc; s.dbl = !!s.dbl; s.keysig = !!s.keysig;
}
// opts.clefsLedger = sleutels + hulplijnen (blad-oefeningen Toonladders/Intervallen/Akkoorden); opts.clefsOnly = alleen de sleutels; opts.keysOnly = alleen sleutels + toonsoorten (zonder hulplijnen, losse voortekens en de aan/uit-knop van de voortekening)
function nlBereikUI(box, s, onChange, opts){
  opts = opts || {};
  var opt = function(n, from){ var h = ''; for (var i = 0; i <= n; i++) h += '<option value="' + i + '">' + (i === 0 ? 'geen' : 'tot ' + i) + '</option>'; return h; };
  box.innerHTML =
    '<div class="rlabel">Sleutels</div><div class="chips nbclefs">' + NL_CLEFS.map(function(c){ return '<label class="chip"><input type="checkbox" value="' + c.id + '"> ' + c.naam + '</label>'; }).join('') + '</div>' +
    '<div class="ropts nbledger"><label>Hulplijnen boven <select class="nbup">' + opt(7) + '</select></label><label>onder <select class="nbdown">' + opt(7) + '</select></label></div>' +
    '<p class="muted nbnote nbledger">Alleen noten binnen het pianobereik (A0–C8) komen voor; bij veel hulplijnen onder de bassleutel vallen de laagste dus weg.</p>' +
    '<div class="ropts nbaccrow"><label><input type="checkbox" class="nbacc"> Losse voortekens (♯ ♭ ♮)</label><label><input type="checkbox" class="nbdbl"> Dubbele voortekens (𝄪 𝄫)</label></div>' +
    '<div class="rlabel nbkeysec">Toonsoorten</div><div class="ropts nbkeysec"><label class="nbkeysigl"><input type="checkbox" class="nbkeysig"> Met voortekening (toonsoort)</label>' +
    '<span class="nbkq"><button type="button" data-q="all">Alle</button><button type="button" data-q="sharp">♯-kant</button><button type="button" data-q="flat">♭-kant</button><button type="button" data-q="none">Alleen C</button></span></div>' +
    '<div class="chips nbkeys nbkeysec">' + Notatie.KEYLIST.map(function(k){ return '<label class="chip"><input type="checkbox" value="' + k.id + '"> <span>' + nlKeyLabel(k) + '</span></label>'; }).join('') + '</div>';
  var q = function(sel){ return box.querySelector(sel); };
  if (opts.keysOnly){ box.classList.add('nbkeysonly'); s.keysig = true; }
  if (opts.clefsOnly) box.classList.add('nbkeysonly', 'nbclefsonly');
  if (opts.clefsLedger) box.classList.add('nbclefsledger');
  function sync(){
    box.querySelectorAll('.nbclefs input').forEach(function(i){ i.checked = s.clefs.indexOf(i.value) >= 0; });
    q('.nbup').value = String(s.up); q('.nbdown').value = String(s.down);
    q('.nbacc').checked = s.acc; q('.nbdbl').checked = s.dbl; q('.nbkeysig').checked = s.keysig;
    box.querySelectorAll('.nbkeys input').forEach(function(i){ i.checked = s.keys.indexOf(i.value) >= 0; });
    box.querySelectorAll('.nbkeys span').forEach(function(sp, j){ sp.textContent = nlKeyLabel(Notatie.KEYLIST[j]); });
    box.classList.toggle('nokeys', !s.keysig);
  }
  box.querySelector('.nbclefs').onchange = function(){
    var c = []; box.querySelectorAll('.nbclefs input:checked').forEach(function(i){ c.push(i.value); });
    if (!c.length){ c = ['g']; }
    s.clefs = NL_CLEFS.map(function(x){ return x.id; }).filter(function(id){ return c.indexOf(id) >= 0; });
    sync(); onChange();
  };
  q('.nbup').onchange = function(e){ s.up = +e.target.value; onChange(); };
  q('.nbdown').onchange = function(e){ s.down = +e.target.value; onChange(); };
  q('.nbacc').onchange = function(e){ s.acc = e.target.checked; onChange(); };
  q('.nbdbl').onchange = function(e){ s.dbl = e.target.checked; onChange(); };
  q('.nbkeysig').onchange = function(e){ s.keysig = e.target.checked; sync(); onChange(); };
  box.querySelector('.nbkeys').onchange = function(){
    var k = []; box.querySelectorAll('.nbkeys input:checked').forEach(function(i){ k.push(i.value); });
    s.keys = k.length ? k : ['C']; sync(); onChange();
  };
  box.querySelectorAll('.nbkq button').forEach(function(b){ b.onclick = function(){
    b.blur();
    var w = b.dataset.q;
    s.keys = Notatie.KEYLIST.filter(function(k){ return w === 'all' || (w === 'sharp' && k.n >= 0) || (w === 'flat' && k.n <= 0) || (w === 'none' && k.n === 0); }).map(function(k){ return k.id; });
    s.keysig = true; sync(); onChange();
  }; });
  sync();
  return { sync:sync };
}

// Gedeelde plaatsing voor blad-oefeningen met meerdere noten (Toonladders, Intervallen, Akkoorden):
// make(o) → [{l, a, o}] voor een octaaf o; kiest willekeurig een octaaf waarbij alles binnen de hulplijnen (up/down)
// én binnen het pianobereik (A0–C8) valt; past niets, dan het octaaf dat er het minst buiten valt. → {ps, range}
function nlFit(make, clef, up, down){
  var c = clef === 'grand' ? 'g' : clef, lo = -1 - 2 * (down || 0), hi = 9 + 2 * (up || 0), ok = [], best = null;
  for (var o = 0; o <= 8; o++){
    var ps = make(o), pos = ps.map(function(p){ return Notatie.pos(p, c); }), ms = ps.map(Notatie.midi);
    if (Math.min.apply(null, ms) < 21 || Math.max.apply(null, ms) > 108) continue;
    var mn = Math.min.apply(null, pos), mx = Math.max.apply(null, pos), out = Math.max(0, lo - mn) + Math.max(0, mx - hi);
    if (!out) ok.push({ ps:ps, mn:mn, mx:mx });
    if (!best || out < best.out) best = { ps:ps, mn:mn, mx:mx, out:out };
  }
  var r = ok.length ? ok[Math.floor(Math.random() * ok.length)] : best;
  return { ps:r.ps, range:[Math.min(lo, r.mn), Math.max(hi, r.mx)] };
}

// Gehoor met hoogte 'midden' (zoals vroeger): octaaf waarbij de laagste noot het dichtst bij `target` (midi) ligt; sleutel automatisch
// (viool, bas of pianobalk), zodat je na het antwoord ziet wat je hoorde. → {ps, clef, range:null}
function nlMid(make, target){
  var best = null;
  for (var o = 0; o <= 8; o++){
    var ps = make(o), ms = ps.map(Notatie.midi), mn = Math.min.apply(null, ms), mx = Math.max.apply(null, ms);
    if (mn < 21 || mx > 108) continue;
    if (!best || Math.abs(mn - target) < Math.abs(best.mn - target)) best = { ps:ps, mn:mn, ms:ms };
  }
  return { ps:best.ps, clef:Theorie.autoClef(best.ms), range:null };
}
// staff per noot op de pianobalk (onder C4 = bassleutel)
function nlStaffOf(p, clef){ return clef === 'grand' && Notatie.midi(p) < 60 ? 'f' : 'g'; }

/* ---------- Noten benoemen ---------- */
function nlLv(id, name, clefs, up, down, acc, keysig, dbl){ return { id:id, name:name, clefs:clefs, up:up, down:down, acc:!!acc, keysig:!!keysig, dbl:!!dbl }; }
var NL_LEVELS = [
  nlLv('n1',  '1 · vioolsleutel, op de balk',              ['g'],      0, 0),
  nlLv('n2',  '2 · bassleutel, op de balk',                ['f'],      0, 0),
  nlLv('n3',  '3 · viool + bas, op de balk',               ['g','f'],  0, 0),
  nlLv('n4',  '4 · vioolsleutel, 2 hulplijnen',            ['g'],      2, 2),
  nlLv('n5',  '5 · bassleutel, 2 hulplijnen',              ['f'],      2, 2),
  nlLv('n6',  '6 · viool + bas, 2 hulplijnen',             ['g','f'],  2, 2),
  nlLv('n7',  '7 · pianobalk, 2 hulplijnen',               ['grand'],  2, 2),
  nlLv('n8',  '8 · viool + bas, met ♯ en ♭',               ['g','f'],  2, 2, true),
  nlLv('n9',  '9 · viool + bas, met toonsoorten',          ['g','f'],  2, 2, false, true),
  nlLv('n10', '10 · altsleutel, 2 hulplijnen',             ['c3'],     2, 2),
  nlLv('n11', '11 · tenorsleutel, 2 hulplijnen',           ['c4'],     2, 2),
  nlLv('n12', '12 · viool + bas, 4 hulplijnen, ♯ ♭',       ['g','f'],  4, 4, true),
  nlLv('n13', '13 · alle sleutels, toonsoorten en ♯ ♭',    ['g','f','c1','c2','c3','c4','c5'], 3, 3, true, true),
  nlLv('n14', '14 · alle sleutels, ook 𝄪 en 𝄫',            ['grand','g','f','c1','c2','c3','c4','c5'], 4, 4, true, true, true)
];
var NL_SKEY = 'notenleer-settings';
var nlS = null, nlQ = null, nlH = null, nlK = null, nlTimers = [], nlAccSel = 0, nlStopPlay = null, nlLastK = null, nlBUI = null;
var nlScore = { right:0, total:0, streak:0 };

function nlDefaults(){
  var inst = 'piano'; try { inst = localStorage.getItem('standaard-klank') || 'piano'; } catch(e){}
  return Object.assign(JSON.parse(JSON.stringify(NL_BEREIK_DEF)), { level:'n1', input:'klavier', names:true, style:'nl', octave:false,
           hear:true, auto:true, timbre:inst, timed:false, limit:5 });
}
function nlLoad(){
  var s = {}; try { s = JSON.parse(localStorage.getItem(NL_SKEY)) || {}; } catch(e){}
  if (s.ledger != null && s.up == null){ s.up = Math.min(7, +s.ledger || 0); s.down = Math.min(5, +s.ledger || 0); }   // oude instelling
  nlS = Object.assign(nlDefaults(), s);
  nlBereikFix(nlS);
  nlS.timbre = Engine.instId(nlS.timbre);
  nlS.limit = Math.min(30, Math.max(1, Math.round(+nlS.limit) || 5));
  nlMatchLevel();
}
function nlSave(){ try { localStorage.setItem(NL_SKEY, JSON.stringify(nlS)); } catch(e){} }

/* --- namen en sleutels --- */
function nlClefName(c){
  if (c === 'pg') return 'piano boven'; if (c === 'pf') return 'piano onder';
  var C = Notatie.CLEFS[c]; return C ? C.kort : c;
}
function nlName(p, oct){ return Notatie.name(p, nlS.style, oct); }
function nlLabel(k){ var i = k.indexOf(':'), p = Notatie.parse(k.slice(i + 1)); return p ? nlName(p, true) + ' · ' + nlClefName(k.slice(0, i)) : k; }
function nlLevelKey(){
  return (nlS.level === 'eigen' ? 'eigen:' + nlBereikKey(nlS) : nlS.level) + (nlS.octave ? '|oct' : '') + (nlS.timed ? '|' + nlS.limit + 's' : '');
}
Score.def('notenleer', {
  name:'Noten benoemen', view:'noten',
  label:function(k){ return 'noot ' + nlLabel(k); },
  level:nlLevelKey,
  levelName:function(lv){
    var p = lv.split('|'), L = NL_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + (p.indexOf('oct') >= 0 ? ', met octaaf' : '') + (/^\d+s$/.test(p[p.length - 1]) ? ', ' + p[p.length - 1] + ' per noot' : '');
  },
  next:function(lv){
    var p = lv.split('|'), i = NL_LEVELS.findIndex(function(l){ return l.id === p[0]; });
    if (i >= 0 && i < NL_LEVELS.length - 1) return 'niveau ' + NL_LEVELS[i + 1].name;
    if (p.indexOf('oct') < 0) return 'ook het octaaf benoemen';
    return 'de tijdmodus met minder seconden per noot';
  }
});

/* --- vragen --- */
function nlRangePos(){ return [-1 - 2 * nlS.down, 9 + 2 * nlS.up]; }
function nlPool(key){ return Notatie.pool({ clefs:nlS.clefs, up:nlS.up, down:nlS.down, acc:nlS.acc, dbl:nlS.dbl, key:key }); }
function nlRange(){                                // laagste en hoogste toon over alle toonsoorten (voor het klavier)
  var lo = 127, hi = 0, keys = nlS.keysig ? nlS.keys : ['C'];
  keys.forEach(function(k){ nlPool(k).forEach(function(x){ lo = Math.min(lo, x.m); hi = Math.max(hi, x.m); }); });
  return [lo, hi];
}
function nlPick(pool){
  var st = Score.tally('notenleer', 20);
  var items = pool.length > 1 ? pool.filter(function(x){ return x.k !== nlLastK; }) : pool;
  var ws = items.map(function(x){ var s = st[x.k]; var err = s ? (s.t - s.r + 1) / (s.t + 2) : .5; return .3 + err * 2; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum;
  for (var i = 0; i < items.length; i++){ r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function nlClear(){
  nlTimers.forEach(clearTimeout); nlTimers = [];
  if (nlStopPlay){ nlStopPlay(); nlStopPlay = null; }
}
function nlNew(){
  nlClear();
  Score.ask('notenleer');
  var key = nlS.keysig ? nlS.keys[Math.floor(Math.random() * nlS.keys.length)] : 'C';
  var x = nlPick(nlPool(key)); nlLastK = x.k;
  nlQ = { clef:x.clef, staff:x.staff, p:x.p, k:x.k, m:x.m, key:key, answered:false, ans:{ l:null, a:0, o:null }, kmidi:null };
  nlAccSel = 0;
  nlH = Notatie.draw($('nlStaff'), { clef:x.clef, key:key, notes:[{ p:x.p, dur:'w', staff:x.staff }], range:nlRangePos(),
                                     width:x.clef === 'grand' ? 250 : 230, zoom:1.7, maxHeight:400 });
  Score.heard('notenleer');                      // reactieklok loopt vanaf het moment dat de noot er staat
  var msg = $('nlMsg'); msg.className = 'qmsg nlmsg'; msg.textContent = '';
  nlRenderInput();
  nlStartClock();
}
function nlStartClock(){
  var card = $('nlCard'), bar = $('nlClockBar');
  card.classList.toggle('timed', !!nlS.timed);
  if (!nlS.timed || !nlQ) return;
  bar.style.animation = 'none'; bar.style.transform = ''; void bar.offsetWidth;
  bar.style.animation = 'nlclock ' + nlS.limit + 's linear forwards';
  nlTimers.push(setTimeout(function(){ if (nlQ && !nlQ.answered) nlFinish(null); }, nlS.limit * 1000));
}
function nlStopClock(){ var bar = $('nlClockBar'); bar.style.animation = 'none'; bar.style.transform = 'scaleX(0)'; }

/* --- antwoorden --- */
function nlHear(m){
  ensureCtx();
  if (m == null && nlH){ if (nlStopPlay) nlStopPlay(); nlStopPlay = Notatie.play(nlH, { bpm:180, inst:nlS.timbre }); return; }
  Engine.note(actx.currentTime + .03, m, 1.1, { inst:nlS.timbre, vol:.45 });
}
function nlKey(m){                                 // pianoklavier
  if (!nlQ) return;
  if (nlQ.answered){ nlHear(m); return; }          // na het antwoord: vergelijken
  nlQ.kmidi = m;
  nlFinish({ midi:m });
}
function nlLetter(l, acc){                         // letters (knoppen of toetsenbord)
  if (!nlQ) return;
  var a = acc != null ? acc : nlAccSel;
  if (nlQ.answered){                              // vergelijken: dichtstbijzijnde toon met die naam
    var m0 = Notatie.NAT[l] + a, best = null;
    for (var m = nlQ.m - 8; m <= nlQ.m + 8; m++) if ((((m - m0) % 12) + 12) % 12 === 0 && (best == null || Math.abs(m - nlQ.m) < Math.abs(best - nlQ.m))) best = m;
    nlHear(best); return;
  }
  nlQ.ans.l = l; nlQ.ans.a = a; nlAccSel = 0;
  nlRenderInput();
  if (nlS.octave && nlQ.ans.o == null){ var msg = $('nlMsg'); msg.className = 'qmsg nlmsg'; msg.textContent = 'En in welk octaaf? (1–8)'; return; }
  nlFinish({ p:{ l:l, a:a, o:nlQ.ans.o != null ? nlQ.ans.o : nlQ.p.o } });
}
function nlOct(o){
  if (!nlQ || nlQ.answered || !nlS.octave) return;
  nlQ.ans.o = o; nlRenderInput();
  if (nlQ.ans.l) nlFinish({ p:{ l:nlQ.ans.l, a:nlQ.ans.a, o:o } });
}
// a = -2 … 2 (knop) of +1/-1 vanaf het toetsenbord: + = ♯ → 𝄪 → uit, − = ♭ → 𝄫 → uit (dubbel alleen als die optie aan staat)
function nlAccToggle(a, cycle){
  if (cycle){ var s = a > 0 ? 1 : -1; nlAccSel = nlAccSel === s ? (nlS.dbl ? 2 * s : 0) : nlAccSel === 2 * s ? 0 : s; }
  else nlAccSel = nlAccSel === a ? 0 : a;
  nlRenderInput();
}

function nlFinish(ans){
  nlQ.answered = true; nlStopClock();
  var q = nlQ, ok, mine = 'tijd op', sameLetter = false;
  if (ans && ans.midi != null){
    ok = nlS.octave ? ans.midi === q.m : ((ans.midi - q.m) % 12 + 12) % 12 === 0;
    var sp = Notatie.spell(ans.midi, q.key !== 'C' ? q.key : (q.p.a < 0 ? 'F' : 'C'));
    if (ok) sp = { l:q.p.l, a:q.p.a, o:sp.o };   // zelfde toets = goed, ook enharmonisch (E♯ = F)
    sameLetter = sp.l === q.p.l;
    mine = nlName(sp, nlS.octave);
  } else if (ans && ans.p){
    ok = ans.p.l === q.p.l && ans.p.a === q.p.a && (!nlS.octave || ans.p.o === q.p.o);
    sameLetter = ans.p.l === q.p.l;
    mine = nlName(ans.p, nlS.octave);
  } else ok = false;
  var sig = Notatie.keySig(q.key), fromKey = q.key !== 'C' && sig[q.p.l] !== 0 && q.p.a === sig[q.p.l];
  Score.log('notenleer', { k:q.k, q:nlName(q.p, true) + ' (' + nlClefName(q.k.split(':')[0]) + (q.key !== 'C' ? ', ' + nlKeyName(q.key) + '-groot' : '') + ')', a:mine, ok:ok });
  nlScore.total++; if (ok){ nlScore.right++; nlScore.streak++; } else nlScore.streak = 0;
  $('nlRight').textContent = nlScore.right; $('nlTotal').textContent = nlScore.total; $('nlStreak').textContent = nlScore.streak;
  $('nlToday').textContent = Score.today('notenleer');
  if (nlH) nlH.mark(0, ok ? 'ok' : 'bad');
  var full = nlName(q.p, true), msg = $('nlMsg');
  var keyNote = fromKey ? ' De ' + (sig[q.p.l] > 0 ? '♯' : '♭') + ' staat in de voortekening (' + nlKeyName(q.key) + '-groot), dus elke ' + q.p.l.toUpperCase() + ' is hier een ' + nlName({ l:q.p.l, a:sig[q.p.l], o:0 }) + '.' : '';
  msg.className = 'qmsg nlmsg ' + (ok ? 'good' : 'bad');
  msg.textContent = ok ? 'Goed! Het is een ' + full + '.'
    : !ans ? 'De tijd is op. Het was een ' + full + '.' + keyNote
    : 'Het was een ' + full + ', jij koos ' + mine + '.' + (sameLetter && fromKey ? keyNote : ' Klik op het klavier of de letters om te vergelijken.');
  nlRenderInput(); nlStats();
  if (nlS.hear) nlHear();
  if (ok && nlS.auto) nlTimers.push(setTimeout(nlNew, nlS.hear ? 1200 : 750));
}

/* --- invoer tekenen --- */
function nlKlavRange(){ return nlS.octave ? nlRange() : [60, 71]; }
function nlBuildKlav(){
  var r = nlKlavRange();
  var names = nlS.names ? 'all' : (nlS.octave ? 'c' : 'none');
  if (!nlK) nlK = Notatie.klavier($('nlKlav'), { lo:r[0], hi:r[1], names:names, onKey:nlKey });
  else nlK.set({ lo:r[0], hi:r[1], names:names });
}
function nlRenderInput(){
  var useK = nlS.input === 'klavier';
  $('nlKlavWrap').style.display = useK ? '' : 'none';
  $('nlLetters').style.display = useK ? 'none' : '';
  if (nlK){
    nlK.clear();
    if (nlQ && nlQ.answered){
      var r = nlKlavRange(), right = nlS.octave ? nlQ.m : r[0] + ((nlQ.m - r[0]) % 12 + 12) % 12;
      nlK.mark(right, 'right');
      if (nlQ.kmidi != null && nlQ.kmidi !== right && (nlS.octave || ((nlQ.kmidi - nlQ.m) % 12 + 12) % 12)) nlK.mark(nlQ.kmidi, 'wrong');
      if (nlS.octave){ var kb = $('nlKlav').querySelector('[data-midi="' + right + '"]'); if (kb && kb.scrollIntoView) kb.scrollIntoView({ block:'nearest', inline:'center' }); }
    }
  }
  // letters
  $('nlAccRow').style.display = nlS.acc || nlS.keysig || nlS.dbl ? '' : 'none';
  $('nlAccRow').querySelectorAll('.dbl').forEach(function(b){ b.style.display = nlS.dbl ? '' : 'none'; });
  $('nlAccRow').querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', +b.dataset.acc === nlAccSel); });
  var row = $('nlLetRow'); row.innerHTML = '';
  Notatie.LETTERS.forEach(function(l){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'gbtn';
    b.innerHTML = nlName({ l:l, a:0, o:4 }) + '<small>' + (nlAccSel ? nlName({ l:l, a:nlAccSel, o:4 }) : '&nbsp;') + '</small>';
    if (nlQ && nlQ.answered){
      var mineL = l === nlQ.ans.l, good = mineL && nlQ.ans.a === nlQ.p.a && (!nlS.octave || nlQ.ans.o === nlQ.p.o);
      if (mineL && !good) b.classList.add('wrong');                // ook: goede letter, verkeerd voorteken
      else if (l === nlQ.p.l) b.classList.add('right');
      if (l === nlQ.p.l && nlQ.p.a) b.querySelector('small').textContent = nlName(nlQ.p);   // laat de juiste naam zien
    } else if (nlQ && nlQ.ans.l === l) b.classList.add('picked');
    b.onclick = function(){ b.blur(); nlLetter(l); };
    row.appendChild(b);
  });
  // octaaf (alleen bij letters; bij het klavier zit het octaaf in de toets)
  var oct = $('nlOctRow'); oct.innerHTML = '';
  oct.style.display = nlS.octave && !useK ? '' : 'none';
  if (nlS.octave && !useK){
    var rg = nlRange();
    for (var o = Math.floor(rg[0] / 12) - 1; o <= Math.floor(rg[1] / 12) - 1; o++) (function(o){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'obtn'; b.textContent = o;
      if (nlQ && nlQ.answered){ if (o === nlQ.p.o) b.classList.add('right'); else if (o === nlQ.ans.o) b.classList.add('wrong'); }
      else if (nlQ && nlQ.ans.o === o) b.classList.add('picked');
      b.onclick = function(){ b.blur(); nlOct(o); };
      oct.appendChild(b);
    })(o);
  }
}

/* --- statistieken (ingeklapt) --- */
function nlStats(){
  var st = Score.tally('notenleer'), rec = Score.recent('notenleer', 20), rows = [], R = 0, T = 0;
  Object.keys(st).forEach(function(k){
    var s = st[k]; if (!s.t) return; R += s.r; T += s.t;
    var wrong = {}; (rec[k] || []).forEach(function(x){ if (!x.ok && x.a) wrong[x.a] = (wrong[x.a] || 0) + 1; });
    var w = Object.keys(wrong).sort(function(a, b){ return wrong[b] - wrong[a]; });
    var why = w.length ? (w[0] === 'tijd op' ? 'vaak te laat' : 'meestal verward met ' + w[0] + ' (' + wrong[w[0]] + '×)') + (w.length > 1 ? ', ook ' + w.slice(1, 3).join(', ') : '') : '';
    rows.push({ k:k, label:nlLabel(k), r:s.r, t:s.t, p:s.r / s.t, why:why });
  });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  var weak = rows.filter(function(r){ return r.p < 1; }).slice(0, 3);
  $('nlStatSum').innerHTML = '📊 Statistieken' + (T ? ' · ' + Math.round(R / T * 100) + '% goed' + (weak.length ? ' · zwakst: ' + weak.map(function(r){ return '<span class="nlchip">' + r.label + '</span>'; }).join(' ') : '') : ' · nog leeg') + ' <span class="muted">alles ▸</span>';
  $('nlStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div>' + (r.why ? '<div class="why">' + r.why + '</div>' : '') + '</div>'; }).join('')
    : '<p class="note">Nog geen antwoorden. De noten die je het vaakst mist komen hier bovenaan en krijg je ook vaker.</p>';
}

/* --- overzicht ↔ oefening --- */
var nlCur = null;                                 // actieve oefening: 'noten' | 'toon' | 'ladder' | 'akkoord' | 'interval' | null (overzicht)
function nlBoard(){
  nlClear(); nlQ = null; nlCur = null;
  if (typeof tsClear === 'function') tsClear();
  if (typeof tlClear === 'function') tlClear();
  if (typeof akClear === 'function') akClear();
  if (typeof ivClear === 'function') ivClear();
  $('ntView').classList.remove('sub-noten', 'sub-toon', 'sub-ladder', 'sub-akkoord', 'sub-interval', 'nl-gehoor');
  if (typeof Paneel !== 'undefined') Paneel.set('ntView', false);
  $('ntView').classList.add('board');
  $('nlSubs').querySelectorAll('button').forEach(function(b){ b.classList.remove('on'); });
}
// prof (bij 'ladder' en 'akkoord'): 'blad' (via Notenleer) of 'gehoor' (via Gehoor → #toonladders / #akkoorden), elk met eigen instellingen
function nlSub(sub, prof){
  nlClear(); if (typeof tsClear === 'function') tsClear(); if (typeof tlClear === 'function') tlClear(); if (typeof akClear === 'function') akClear(); if (typeof ivClear === 'function') ivClear();
  nlCur = ['toon','ladder','akkoord','interval'].indexOf(sub) >= 0 ? sub : 'noten';
  $('ntView').classList.remove('board', 'sub-noten', 'sub-toon', 'sub-ladder', 'sub-akkoord', 'sub-interval', 'nl-gehoor');
  $('ntView').classList.add('sub-' + nlCur);
  $('nlSubs').querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.sub === nlCur); });
  window.scrollTo(0, 0);
  if (nlCur === 'toon'){ tsStart(); return; }
  if (nlCur === 'ladder'){ $('ntView').classList.toggle('nl-gehoor', prof === 'gehoor'); tlStart(prof === 'gehoor' ? 'gehoor' : 'blad'); return; }
  if (nlCur === 'akkoord'){ $('ntView').classList.toggle('nl-gehoor', prof === 'gehoor'); akStart(prof === 'gehoor' ? 'gehoor' : 'blad'); return; }
  if (nlCur === 'interval'){ $('ntView').classList.toggle('nl-gehoor', prof === 'gehoor'); ivStart(prof === 'gehoor' ? 'gehoor' : 'blad'); return; }
  nlBuildKlav(); nlStats(); nlNew();
}
// routes in #ntView: Bladmuziek (blad) en de gehoor-ingangen; elke route opent meteen de oefening (het oude Notenleer-overzicht wordt niet meer gebruikt)
var NL_ROUTES = { noten:['noten'], toonsoorten:['toon'], 'toonladders-blad':['ladder','blad'], 'intervallen-blad':['interval','blad'], 'akkoorden-blad':['akkoord','blad'],
                  toonladders:['ladder','gehoor'], akkoorden:['akkoord','gehoor'], intervallen:['interval','gehoor'] };
function nlOnRoute(){
  if (typeof view === 'undefined') return;
  var r = NL_ROUTES[view];
  if (r) nlSub(r[0], r[1]);
  else { nlClear(); if (typeof tsClear === 'function') tsClear(); if (typeof tlClear === 'function') tlClear(); if (typeof akClear === 'function') akClear(); if (typeof ivClear === 'function') ivClear(); }
}

/* --- instellingen --- */
function nlMatchLevel(){
  var L = NL_LEVELS.find(function(l){
    return l.clefs.join() === nlS.clefs.join() && l.up === nlS.up && l.down === nlS.down && l.acc === nlS.acc && l.dbl === nlS.dbl && l.keysig === nlS.keysig
      && (!l.keysig || nlS.keys.length === NL_ALLKEYS.length);
  });
  nlS.level = L ? L.id : 'eigen';
}
function nlSyncUI(){
  $('nlLevel').value = nlS.level;
  $('nlInput').value = nlS.input; $('nlNames').checked = nlS.names; $('nlStyle').value = nlS.style; $('nlOctave').checked = nlS.octave;
  if (nlBUI) nlBUI.sync();
  $('nlHear').checked = nlS.hear; $('nlAuto').checked = nlS.auto; $('nlInst').value = nlS.timbre;
  $('nlTimed').checked = nlS.timed; $('nlLimit').value = nlS.limit;
}
function nlInit(){
  nlLoad();
  $('nlLevel').innerHTML = NL_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen keuze (🕹️)</option>';
  $('nlInst').innerHTML = Engine.instOptions(nlS.timbre);
  var active = function(){ return nlCur === 'noten'; };
  var changed = function(renew, klav){
    nlSave(); nlSyncUI();
    if (klav && nlK) nlBuildKlav();
    if (renew && active()) nlNew(); else if (active()) nlRenderInput();
  };
  nlBUI = nlBereikUI($('nlBereik'), nlS, function(){ nlMatchLevel(); changed(true, true); });
  nlSyncUI();
  $('nlLevel').onchange = function(e){
    var L = NL_LEVELS.find(function(l){ return l.id === e.target.value; });
    nlS.level = e.target.value;
    if (L){ nlS.clefs = L.clefs.slice(); nlS.up = L.up; nlS.down = L.down; nlS.acc = L.acc; nlS.dbl = L.dbl; nlS.keysig = L.keysig; if (L.keysig) nlS.keys = NL_ALLKEYS.slice(); }
    else Paneel.set('ntView', true);
    changed(true, true);
  };
  $('nlInput').onchange = function(e){ nlS.input = e.target.value; changed(false); };
  $('nlNames').onchange = function(e){ nlS.names = e.target.checked; changed(false, true); };
  $('nlStyle').onchange = function(e){ nlS.style = e.target.value; changed(false); nlStats(); };
  $('nlOctave').onchange = function(e){ nlS.octave = e.target.checked; changed(true, true); };
  $('nlHear').onchange = function(e){ nlS.hear = e.target.checked; changed(false); };
  $('nlAuto').onchange = function(e){ nlS.auto = e.target.checked; changed(false); };
  $('nlInst').onchange = function(e){ nlS.timbre = e.target.value; changed(false); if (nlQ) nlHear(nlQ.m); };
  $('nlTimed').onchange = function(e){ nlS.timed = e.target.checked; changed(true); };
  $('nlLimit').onchange = function(e){ nlS.limit = Math.min(30, Math.max(1, Math.round(+e.target.value) || 5)); changed(true); };
  document.querySelectorAll('#ntView select, #ntView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('nlSubs').querySelectorAll('button[data-sub]').forEach(function(b){ b.onclick = function(){ b.blur(); nlSub(b.dataset.sub); }; });
  document.querySelector('[data-back="notenleer"]').onclick = nlBoard;
  $('nlAccRow').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ b.blur(); nlAccToggle(+b.dataset.acc); }; });
  $('nlNext').onclick = function(){ this.blur(); nlNew(); };
  $('nlHearBtn').onclick = function(){ this.blur(); if (nlQ) nlHear(); };
  $('nlReset').onclick = function(){ Score.clear('notenleer'); nlStats(); $('nlToday').textContent = 0; };
  $('nlToday').textContent = Score.today('notenleer');
  nlStats();
  if (typeof view !== 'undefined' && NL_ROUTES[view] && NL_ROUTES[view][0] === 'noten') nlSub('noten');
}
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || !NL_ROUTES[view] || !nlS || $('ntView').classList.contains('board')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (Keys.blocked(e)) return;
  if (nlCur === 'toon'){ if (typeof tsKey === 'function') tsKey(e); return; }
  if (nlCur === 'ladder'){ if (typeof tlKey === 'function') tlKey(e); return; }
  if (nlCur === 'akkoord'){ if (typeof akKey === 'function') akKey(e); return; }
  if (nlCur === 'interval'){ if (typeof ivKey === 'function') ivKey(e); return; }
  var k = e.key.toLowerCase();
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat && nlQ) nlHear(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); nlNew(); }
  else if (Keys.is(e, 'stop')){ nlClear(); }
  else if ('cdefgab'.indexOf(k) >= 0 && k.length === 1){ e.preventDefault(); nlLetter(k, e.shiftKey ? 1 : null); }
  else if (e.key === '-'){ e.preventDefault(); nlAccToggle(-1, true); }
  else if (e.key === '+' || e.key === '='){ e.preventDefault(); nlAccToggle(1, true); }
  else if (/^[1-8]$/.test(e.key)) nlOct(+e.key);
});
nlInit();
