/* ================= Intervallen (prefix iv; blok .nlsub[data-sub="interval"] in #ntView) =================
   Eén oefening, twee ingangen (zoals Toonladders en Akkoorden):
     'gehoor' = Gehoor → 📐 Intervallen (#intervallen, standaard alleen horen) — de oude gehoorversie, overgezet (13-11-2026):
               liedjes-geheugensteunen (eigen liedjes in 'iv-liedjes'), stijgend/dalend/samen, begintoon, vrij luisteren,
               ▶ Nog eens / Jouw keuze / Samen; instellingen in 'iv-settings', score 'intervallen' met de oude sleutels (k = 'up:7').
     'blad'   = Notenleer → Intervallen (blad): twee noten op de balk → het gespelde interval (ook overmatig/verminderd);
               instellingen 'intervallen-blad-settings', score 'intervallenb' (k = 'up:k3').
   Intervallen komen uit Theorie.INTERVALS (t/m 2 octaven). Op gehoor alleen de gewone naam per klank (x.ear; o4 = tritonus).
   API: ivStart(prof) ivClear() ivKey(e) ivNew() ivFix() ivMatchLevel() ivSave() ivSyncUI() ivStats() ivSwitch(prof) ivGet(prof). */

var IV_ALL = Theorie.INTERVALS, IV_LETS = Theorie.LETS;
var IV_DIR = { up:'stijgend', down:'dalend', harm:'samen' };
// geheugensteunen per aantal halve tonen (eigen liedjes gaan voor)
var IV_SONG = {
  1:['Jaws (filmmuziek)', 'Für Elise (begin)', 'schuurt, botst'], 2:['Vader Jacob', 'Mary Had a Little Lamb', 'wrijft zacht'],
  3:['Greensleeves', 'Hey Jude (begin)', 'donker, weemoedig'], 4:['When the Saints Go Marching In', 'Beethoven 5 (ta-ta-ta-taa)', 'helder, blij'],
  5:['Wilhelmus (begin)', 'Eine kleine Nachtmusik (begin)', 'open, een beetje hangend'], 6:['Maria (West Side Story)', 'zelfde klank als stijgend: onrustig, wil oplossen', 'gespannen, onrustig'],
  7:['Altijd is Kortjakje ziek', 'The Flintstones', 'hol, leeg: twee losse vioolsnaren'], 8:['The Entertainer', 'Love Story (filmmuziek)', 'zoet, een beetje droevig'],
  9:['My Bonnie Is Over the Ocean', 'Nobody Knows the Trouble I’ve Seen', 'warm, zangerig'], 10:['Star Trek (oude serie)', 'An American in Paris', 'zacht gespannen, wil oplossen'],
  11:['Take On Me (refrein)', 'denk: een octaaf, net een halve toon te kort', 'scherp, bijtend'], 12:['Somewhere Over the Rainbow', 'dezelfde toon, maar lager', 'versmelt tot één toon']
};
var IV_SONG_KEY = 'iv-liedjes';
function ivX(id){ return Theorie.find(IV_ALL, id); }
var IV_EAR12 = ['k2','g2','k3','g3','r4','o4','r5','k6','g6','k7','g7','r8'];
var IV_EAR24 = IV_ALL.filter(function(x){ return x.ear && x.n > 1; }).map(function(x){ return x.id; });
function ivLv(id, name, set, bladOnly){ return { id:id, name:name, set:set, bladOnly:!!bladOnly }; }
var IV_LEVELS = [
  ivLv('l1', '1 · g3, r5, octaaf',                        ['g3','r5','r8']),
  ivLv('l2', '2 · + k3 en r4',                            ['k3','g3','r4','r5','r8']),
  ivLv('l3', '3 · + secunden',                            ['k2','g2','k3','g3','r4','r5','r8']),
  ivLv('l4', '4 · + sexten',                              ['k2','g2','k3','g3','r4','r5','k6','g6','r8']),
  ivLv('l5', '5 · alles binnen het octaaf (+ septiemen, tritonus)', IV_EAR12),
  ivLv('l6', '6 · + none en decime',                      IV_EAR12.concat(['k9','g9','k10','g10'])),
  ivLv('l7', '7 · alles tot 2 octaven',                   IV_EAR24),
  ivLv('l8', '8 · ook overmatig en verminderd (blad)',    IV_ALL.filter(function(x){ return x.n >= 2 && x.n <= 8; }).map(function(x){ return x.id; }), true)
];
var IV_SKEYS = { blad:'intervallen-blad-settings', gehoor:'iv-settings' }, ivProfile = 'blad';
function ivSid(prof){ return (prof || ivProfile) === 'gehoor' ? 'intervallen' : 'intervallenb'; }
var ivS = null, ivQ = null, ivH = null, ivTimers = [], ivLastK = null, ivBUI = null;
var ivScore = { right:0, total:0, streak:0 };

function ivDefaults(prof){
  var inst = 'piano'; try { inst = localStorage.getItem('standaard-klank') || 'piano'; } catch(e){}
  return { level:'l1', set:['g3','r5','r8'], dirs:['up'], start:'rand', tonics:'wit', dbl:false, clefs:['g'], keys:['C'], up:0, down:0, acc:false, keysig:false,
           mode:prof === 'gehoor' ? 'horen' : 'zien', hoogte:'midden', style:'nl', timbre:inst, auto:true, explore:false, hear:true, timed:false, limit:8 };
}
function ivFix(s, prof){
  s = s || ivS; prof = prof || ivProfile;
  s.bpm = gehBpmFix(s.bpm, 75);
  if (s.names && !s.style) s.style = s.names; delete s.names;                     // oude instelling
  if (s.style !== 'en') s.style = 'nl';
  if (!Array.isArray(s.set)) s.set = ['g3','r5','r8'];
  s.set = s.set.map(function(v){ return typeof v === 'number' ? (Theorie.earOf(v) || {}).id : v; }).filter(function(id){ return id && ivX(id); });   // oud: halve tonen
  if (prof === 'gehoor') s.set = s.set.filter(function(id){ return ivX(id).ear; });
  s.set = IV_ALL.map(function(x){ return x.id; }).filter(function(id){ return s.set.indexOf(id) >= 0; });
  if (s.set.length < 2) s.set = ['g3','r5','r8'];
  if (!Array.isArray(s.dirs) || !s.dirs.length) s.dirs = ['up'];
  s.dirs = ['up','down','harm'].filter(function(d){ return s.dirs.indexOf(d) >= 0; }); if (!s.dirs.length) s.dirs = ['up'];
  if (s.start === 'c') s.start = 0;
  if (s.start !== 'rand' && !(s.start >= 0 && s.start < 12)) s.start = 'rand';
  if (!Theorie.TONICS[s.tonics]) s.tonics = 'wit';
  if (['zien','beide','horen'].indexOf(s.mode) < 0) s.mode = prof === 'gehoor' ? 'horen' : 'zien';
  if (s.hoogte !== 'balk') s.hoogte = 'midden';
  if (s.ledgerV !== 1){ s.up = 2; s.down = 2; s.ledgerV = 1; }   // hulplijnen (blad, sinds 13-11), standaard 2 boven en onder
  s.acc = false; s.dbl = !!s.dbl;
  var dbl = s.dbl; nlBereikFix(s); s.dbl = dbl;
  s.timbre = Engine.instId(s.timbre);
  s.limit = Math.min(30, Math.max(1, Math.round(+s.limit) || 8));
}
function ivSame(a, b){ return a.slice().sort().join() === b.slice().sort().join(); }
function ivMatchLevel(s, prof){
  s = s || ivS; prof = prof || ivProfile;
  var L = IV_LEVELS.find(function(l){ return (!l.bladOnly || prof === 'blad') && ivSame(l.set, s.set); });
  s.level = L ? L.id : 'eigen';
}
function ivLoadProf(prof){
  var s = {}; try { s = JSON.parse(localStorage.getItem(IV_SKEYS[prof])) || {}; } catch(e){}
  s = Object.assign(ivDefaults(prof), s); ivFix(s, prof); ivMatchLevel(s, prof); return s;
}
function ivGet(prof){ return prof === ivProfile ? ivS : ivLoadProf(prof); }
function ivSave(){ try { localStorage.setItem(IV_SKEYS[ivProfile], JSON.stringify(ivS)); } catch(e){} }
function ivTitle(){ return 'Intervallen (' + (ivProfile === 'gehoor' ? 'gehoor' : 'blad') + ')'; }

/* --- namen --- */
function ivEar(){ return ivProfile === 'gehoor'; }
function ivName(x){ return ivS.style === 'en' ? (ivEar() && x.id === 'o4' ? 'tritone' : x.en) : (ivEar() && x.earNl) || x.nl; }
function ivKort(x){ return ivS.style === 'en' ? (ivEar() && x.earKortEn) || x.kortEn : (ivEar() && x.earKort) || x.kort; }
function ivNote(p){ return Notatie.name(p, ivS.style, true); }
function ivLabel(k){                                // 'up:7' (gehoor, oud) of 'up:k3' (blad)
  var p = k.split(':'), x = /^\d+$/.test(p[1]) ? Theorie.earOf(+p[1]) : ivX(p[1]);
  return (x ? ivName(x) : p[1]) + ' · ' + (IV_DIR[p[0]] || p[0]);
}
function ivLevelKey(s, prof){
  s = s || ivS; prof = prof || ivProfile;
  var base = (s.level === 'eigen' ? 'eigen:' + s.set.join(',') : s.level) + '|' + s.dirs.slice().sort().join(',');
  if (prof === 'gehoor') return base + (s.mode !== 'horen' ? '|' + s.mode : '') + (s.hoogte === 'balk' ? '|h' + s.clefs.join('-') + 'u' + s.up + 'd' + s.down : '') + (s.timed ? '|' + s.limit + 's' : '');   // zelfde sleutels als vroeger ('l1|up')
  return base + '|' + s.mode + '|' + s.clefs.join('-') + '|u' + s.up + 'd' + s.down + (s.dbl ? '|dbl' : '') + (s.timed ? '|' + s.limit + 's' : '');
}
[['gehoor', 'intervallen', 'Intervallen (gehoor)', 'intervallen'], ['blad', 'intervallenb', 'Intervallen (blad)', 'intervallen-blad']].forEach(function(d){ Score.def(d[1], {
  name:d[2], view:d[3], label:ivLabel, level:function(){ return ivLevelKey(ivGet(d[0]), d[0]); },
  levelName:function(lv){
    var p = lv.split('|'), L = IV_LEVELS.find(function(l){ return l.id === p[0]; });
    return (L ? 'niveau ' + L.name : 'eigen keuze') + ' · ' + (p[1] || 'up').split(',').map(function(x){ return IV_DIR[x] || x; }).join(' + ');
  },
  next:function(lv){
    var p = lv.split('|'), i = IV_LEVELS.findIndex(function(l){ return l.id === p[0]; }), ds = (p[1] || '').split(',');
    var last = d[0] === 'gehoor' ? IV_LEVELS.length - 2 : IV_LEVELS.length - 1;
    if (i >= 0 && i < last) return 'niveau ' + IV_LEVELS[i + 1].name;
    var miss = ['up','down','harm'].filter(function(x){ return ds.indexOf(x) < 0; });
    return miss.length ? 'zet ook ' + IV_DIR[miss[0]] + ' aan' : 'alles beheerst: tijd voor akkoorden';
  }
}); });

/* --- liedjes --- */
function ivSongs(){ var s; try { s = JSON.parse(localStorage.getItem(IV_SONG_KEY)); } catch(e){} return s || {}; }
function ivSaveSongs(s){ try { localStorage.setItem(IV_SONG_KEY, JSON.stringify(s)); } catch(e){} }
function ivSong(semis, dir){
  if (semis > 12) return 'een octaaf + ' + ivName(Theorie.earOf(semis - 12)) + (dir === 'harm' ? '' : ': denk eerst het octaaf, dan het kleine interval');
  var own = ivSongs()[dir + ':' + semis]; if (own) return own;
  var x = IV_SONG[semis]; return x ? (dir === 'down' ? x[1] : dir === 'harm' ? x[2] : x[0]) : '';
}

/* --- vragen --- */
var IV_NAT = Theorie.NAT;
function ivUp(lo, x){                                // gespelde bovenste noot: letter = onderste + (n−1), voorteken uit de halve tonen
  var li = IV_LETS.indexOf(lo.l), j = li + x.n - 1, l = IV_LETS[j % 7], o = lo.o + Math.floor(j / 7);
  return { l:l, a:Notatie.midi(lo) + x.semis - ((o + 1) * 12 + IV_NAT[IV_LETS.indexOf(l)]), o:o };
}
function ivItems(){
  var out = [], st = Score.tally(ivSid(), 20);
  ivS.set.forEach(function(id){
    var x = ivX(id); if (ivEar() && !x.ear) return;
    ivS.dirs.forEach(function(dir){ out.push({ x:x, dir:dir, k:dir + ':' + (ivEar() ? x.semis : x.id) }); });
  });
  return out;
}
function ivPick(items){
  var st = Score.tally(ivSid(), 20);
  if (items.length > 1) items = items.filter(function(o){ return o.k !== ivLastK; });
  var ws = items.map(function(o){ var r = st[o.k]; return r && r.t ? 1 + 4 * (1 - r.r / r.t) : 2.5; });
  var sum = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * sum;
  for (var i = 0; i < items.length; i++){ r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function ivSpellPair(loM, x){                        // gehoor: willekeurige toonhoogte → spelling met kleine voortekens
  var keys = ['C', 'F', 'G', 'Bb', 'D', 'Eb', 'A'];
  for (var i = 0; i < keys.length; i++){
    var lo = Notatie.spell(loM, keys[i]), hi = ivUp(lo, x);
    if (Math.abs(lo.a) <= 1 && Math.abs(hi.a) <= 1) return [lo, hi];
  }
  var lo2 = Notatie.spell(loM, 'C'); return [lo2, ivUp(lo2, x)];
}
function ivNew(){
  ivClear();
  Score.ask(ivSid());
  var items = ivItems();
  if (!items.length){ ivS.set = ['g3','r5','r8']; items = ivItems(); }
  var it = ivPick(items), x = it.x, dir = it.dir, lo, hi, clef = ivS.clefs[Math.floor(Math.random() * ivS.clefs.length)];
  ivLastK = it.k;
  if (ivEar()){
    var loM;
    if (ivS.hoogte === 'balk'){                      // hoogte volgens sleutel + hulplijnen: beide tonen binnen dat bereik
      var c0 = ivS.clefs[Math.floor(Math.random() * ivS.clefs.length)], w = Theorie.window(c0, ivS.up, ivS.down), cands = [];
      for (var m0 = w.lo; m0 + x.semis <= w.hi; m0++){
        var firstM = dir === 'down' ? m0 + x.semis : m0;
        if (ivS.start === 'rand' || ((firstM % 12) + 12) % 12 === +ivS.start) cands.push(m0);
      }
      loM = cands.length ? cands[Math.floor(Math.random() * cands.length)] : Math.max(21, Math.round((w.lo + w.hi - x.semis) / 2));
      var prB = ivSpellPair(loM, x); lo = prB[0]; hi = prB[1]; clef = c0;
    } else {
    if (ivS.start !== 'rand'){
      var first = 55 + ((+ivS.start - 7 + 12) % 12);   // vaste eerste toon, tussen G3 en Fis4
      loM = dir === 'down' ? first - x.semis : first;
    } else {
      var a = x.semis > 12 ? 43 : 50, b = (x.semis > 12 ? 79 : 72) - x.semis;
      loM = a + Math.floor(Math.random() * (Math.max(a, b) - a + 1));
    }
    var pr = ivSpellPair(loM, x); lo = pr[0]; hi = pr[1];
    clef = Theorie.autoClef([loM, Notatie.midi(hi)]);
    }
  } else {
    var c = clef === 'grand' ? 'g' : clef, tons = Theorie.TONICS[ivS.tonics].slice(), max = ivS.dbl ? 2 : 1, tries = 0;
    var fit;
    do {   // hoogte: willekeurig binnen de gekozen hulplijnen (nlFit)
      var t = tons[Math.floor(Math.random() * tons.length)];
      fit = nlFit(function(o){ var l0 = { l:t.l, a:t.a, o:o }; return [l0, ivUp(l0, x)]; }, clef, ivS.up, ivS.down);
      lo = fit.ps[0]; hi = fit.ps[1];
    } while (Math.abs(hi.a) > max && ++tries < 30);
    var range = fit.range;
  }
  ivQ = { x:x, dir:dir, lo:lo, hi:hi, clef:clef, k:it.k, answered:false, choice:null, range:typeof range !== 'undefined' ? range : null };
  ivDraw(ivS.mode !== 'horen');
  $('ivAsk').textContent = IV_DIR[dir];
  $('ivInfo').innerHTML = ''; $('ivAfter').style.display = 'none';
  var msg = $('ivMsg'); msg.className = 'qmsg nlmsg'; msg.textContent = ivS.explore ? 'Vrij luisteren: klik op een interval om het te horen vanaf dezelfde begintoon. Er wordt niets geteld.' : '';
  ivRenderInput();
  $('ivHearBtn').disabled = ivS.mode === 'zien' && !ivS.explore;
  if (ivS.mode !== 'zien') ivPlayQ(); else Score.heard(ivSid());
  ivStartClock();
}
function ivDraw(show){
  var q = ivQ;
  if (!show){ $('ivStaff').innerHTML = '<div class="tlhide">🔊 Luister… (de noten zie je na je antwoord)</div>'; ivH = null; return; }
  var grand = q.clef === 'grand', st = function(p){ return grand && Notatie.midi(p) < 60 ? 'f' : 'g'; };
  var notes = q.dir === 'harm' ? (grand && st(q.lo) !== st(q.hi) ? [{ p:q.lo, dur:'w', staff:'f' }, { p:q.hi, dur:'w', staff:'g' }] : [{ ps:[q.lo, q.hi], dur:'w', staff:st(q.lo) }])
    : (q.dir === 'down' ? [q.hi, q.lo] : [q.lo, q.hi]).map(function(p){ return { p:p, dur:'w', staff:st(p) }; });
  if (q.dir === 'harm' && grand && st(q.lo) !== st(q.hi)){
    ivH = Notatie.draw($('ivStaff'), { clef:'grand', key:'C', notes:notes, width:200, zoom:1.5, maxHeight:380 });   // samenklank verdeeld over beide balken
  } else ivH = Notatie.draw($('ivStaff'), { clef:q.clef, key:'C', notes:notes, range:grand ? null : (q.range || [-4, 14]), width:q.dir === 'harm' ? 180 : 240, zoom:1.6, maxHeight:340 });
}
function ivClear(){ ivTimers.forEach(clearTimeout); ivTimers = []; if (typeof Engine !== 'undefined' && Engine.stopNotes) Engine.stopNotes(); }
function ivPlay(loM, semis, dir){
  stop(); ensureCtx();
  var t = actx.currentTime + .06, o = { inst:ivS.timbre, vol:.42 }, hiM = loM + semis;
  if (dir === 'harm'){ Engine.note(t, loM, 1.6, { inst:ivS.timbre, vol:.32 }); Engine.note(t, hiM, 1.6, { inst:ivS.timbre, vol:.32 }); }
  else { var a = dir === 'down' ? hiM : loM, b = dir === 'down' ? loM : hiM, d = 60 / (ivS.bpm || 75); Engine.note(t, a, d * .94, o); Engine.note(t + d, b, Math.max(1, d), o); }   // tempo instelbaar (standaard 75)
}
function ivPlayQ(){ if (!ivQ) return; if (!ivQ.answered) Score.heard(ivSid()); ivPlay(Notatie.midi(ivQ.lo), ivQ.x.semis, ivQ.dir); if (ivS.timed && !ivQ.answered) ivStartClock(); }
function ivStartClock(){
  var card = $('ivCard'), bar = $('ivClockBar');
  card.classList.toggle('timed', !!ivS.timed && !ivS.explore);
  if (!ivS.timed || ivS.explore || !ivQ) return;
  ivTimers = ivTimers.filter(function(t){ clearTimeout(t); return false; });
  bar.style.animation = 'none'; bar.style.transform = ''; void bar.offsetWidth;
  bar.style.animation = 'nlclock ' + ivS.limit + 's linear forwards';
  ivTimers.push(setTimeout(function(){ if (ivQ && !ivQ.answered) ivFinish(null); }, ivS.limit * 1000));
}
function ivStopClock(){ var bar = $('ivClockBar'); bar.style.animation = 'none'; bar.style.transform = 'scaleX(0)'; }

/* --- antwoorden --- */
function ivAnswer(id){
  if (!ivQ) return;
  var x = ivX(id);
  if (ivS.explore){                                 // vrij luisteren: dat interval vanaf dezelfde begintoon
    var loM = Notatie.midi(ivQ.dir === 'down' ? ivQ.hi : ivQ.lo) - (ivQ.dir === 'down' ? x.semis : 0);
    ivPlay(loM, x.semis, ivQ.dir); return;
  }
  if (ivQ.answered) return;
  ivFinish(x);
}
function ivCountTip(q){                              // blad: zo tel je het
  var li = IV_LETS.indexOf(q.lo.l), lets = [];
  for (var i = 0; i < q.x.n; i++) lets.push(IV_LETS[(li + i) % 7].toUpperCase());
  var nm = ['', 'prime', 'secunde', 'terts', 'kwart', 'kwint', 'sext', 'septiem', 'octaaf', 'none', 'decime', 'undecime', 'duodecime', 'tredecime', 'quartdecime', 'dubbel octaaf'][q.x.n];
  var cnt = q.x.n <= 8 ? lets.join(' ') + ' = ' + q.x.n + ' letters → ' + nm : q.lo.l.toUpperCase() + ' … ' + lets[lets.length - 1] + ' = ' + q.x.n + ' letters → ' + nm;
  return 'Tel de letters: ' + cnt + '. Halve tonen: ' + q.x.semis + ' → ' + ivName(q.x) + '.';
}
function ivFinish(choice){
  var q = ivQ; q.answered = true; q.choice = choice; ivStopClock();
  var ok = !!choice && choice.id === q.x.id;
  if (ivEar() && choice && !ok && choice.semis === q.x.semis) ok = true;   // op gehoor telt de klank
  var from = ivNote(q.dir === 'down' ? q.hi : q.lo);
  Score.log(ivSid(), { k:q.k, q:ivKort(q.x) + ' ' + IV_DIR[q.dir] + ' vanaf ' + from, a:choice ? ivKort(choice) : 'tijd op', ok:ok });
  ivScore.total++; if (ok){ ivScore.right++; ivScore.streak++; } else ivScore.streak = 0;
  $('ivRight').textContent = ivScore.right; $('ivTotal').textContent = ivScore.total; $('ivStreak').textContent = ivScore.streak;
  $('ivToday').textContent = Score.today(ivSid());
  if (ivS.mode === 'horen') ivDraw(true);
  if (ivH) ivH.mark(0, ok ? 'ok' : 'bad');
  var msg = $('ivMsg');
  msg.className = 'qmsg nlmsg ' + (ok ? 'good' : 'bad');
  msg.textContent = ok ? '✓ Goed: ' + ivName(q.x) + ' ' + IV_DIR[q.dir]
    : !choice ? '✗ De tijd is op. Het was een ' + ivName(q.x) + ' ' + IV_DIR[q.dir]
    : '✗ Het was een ' + ivName(q.x) + ' ' + IV_DIR[q.dir] + ', jij koos ' + ivName(choice);
  var lines = ['<b>' + ivName(q.x) + '</b> (' + ivKort(q.x) + ') = ' + q.x.semis + ' halve ' + (q.x.semis === 1 ? 'toon' : 'tonen') + ' · ' + ivNote(q.dir === 'down' ? q.hi : q.lo) + (q.dir === 'harm' ? ' + ' : ' → ') + ivNote(q.dir === 'down' ? q.lo : q.hi)];
  if (!ivEar()) lines.push(ivCountTip(q));
  var song = ivSong(q.x.semis, q.dir); if (song) lines.push((q.dir === 'harm' ? 'Klank: ' : 'Geheugensteun: ') + song);
  $('ivInfo').innerHTML = lines.map(function(l){ return '<div>' + l + '</div>'; }).join('');
  $('ivMine').style.display = ok || !choice ? 'none' : '';
  $('ivBoth').textContent = q.dir === 'harm' ? '▶ Los na elkaar' : '▶ Samen';
  $('ivAfter').style.display = '';
  $('ivHearBtn').disabled = false;
  ivRenderInput(); ivStats();
  if (ivS.hear && ivS.mode === 'zien') ivPlayQ();
  if (ok && ivS.auto) ivTimers.push(setTimeout(ivNew, ivS.mode === 'zien' && ivS.hear ? 2200 : 1300));
}

/* --- invoer --- */
function ivOrder(){ return ivS.set.filter(function(id){ return !ivEar() || ivX(id).ear; }); }
function ivRenderInput(){
  var q = ivQ, box = $('ivPad'); box.innerHTML = '';
  box.classList.toggle('explore', !!ivS.explore);
  var ord = ivOrder(), groups = [['Binnen het octaaf', function(x){ return x.n <= 8; }], ['Groter dan een octaaf', function(x){ return x.n > 8; }]];
  groups.forEach(function(g){
    var ids = ord.filter(function(id){ return g[1](ivX(id)); }); if (!ids.length) return;
    if (ord.some(function(id){ return ivX(id).n > 8; })){ var lab = document.createElement('div'); lab.className = 'tlglab'; lab.textContent = g[0]; box.appendChild(lab); }
    var grp = document.createElement('div'); grp.className = 'tlgrp ivgrp'; box.appendChild(grp);
    ids.forEach(function(id){
      var x = ivX(id), i = ord.indexOf(id), cls = '';
      if (q && q.answered && !ivS.explore){
        if (id === q.x.id || (ivEar() && x.semis === q.x.semis)) cls = 'right';
        else if (q.choice && id === q.choice.id) cls = 'wrong';
      }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gbtn' + (cls ? ' ' + cls : ''); b.dataset.id = id;
      b.innerHTML = ivKort(x) + '<small>' + ivName(x) + '</small>' + (i < 10 ? '<kbd class="ivkbd">' + ((i + 1) % 10) + '</kbd>' : '');
      b.onclick = function(){ b.blur(); ivAnswer(id); };
      grp.appendChild(b);
    });
  });
}

/* --- toetsen (via de keydown-handler van notenleer.js) --- */
function ivKey(e){
  if (!ivQ) return;
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat && (ivQ.answered || ivS.mode !== 'zien' || ivS.explore)) ivPlayQ(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); ivNew(); }
  else if (Keys.is(e, 'stop')){ ivClear(); }
  else if (/^[0-9]$/.test(e.key)){ var id = ivOrder()[(+e.key + 9) % 10]; if (id){ e.preventDefault(); ivAnswer(id); } }
}

/* --- statistieken en liedjes --- */
function ivStats(){
  var st = Score.tally(ivSid()), rec = Score.recent(ivSid(), 20), rows = [], R = 0, T = 0;
  Object.keys(st).forEach(function(k){
    var s = st[k]; if (!s.t) return; R += s.r; T += s.t;
    var wrong = {}; (rec[k] || []).forEach(function(x){ if (!x.ok && x.a) wrong[x.a] = (wrong[x.a] || 0) + 1; });
    var w = Object.keys(wrong).sort(function(a, b){ return wrong[b] - wrong[a]; });
    var why = w.length ? (w[0] === 'tijd op' ? 'vaak te laat' : 'meestal verward met ' + w[0] + ' (' + wrong[w[0]] + '×)') + (w.length > 1 ? ', ook ' + w.slice(1, 3).join(', ') : '') : '';
    rows.push({ label:ivLabel(k), r:s.r, t:s.t, p:s.r / s.t, why:why });
  });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  var weak = rows.filter(function(r){ return r.p < 1; }).slice(0, 3);
  $('ivStatSum').innerHTML = '📊 Statistieken' + (T ? ' · ' + Math.round(R / T * 100) + '% goed' + (weak.length ? ' · zwakst: ' + weak.map(function(r){ return '<span class="nlchip">' + r.label + '</span>'; }).join(' ') : '') : ' · nog leeg') + ' <span class="muted">alles ▸</span>';
  $('ivStats').innerHTML = rows.length
    ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div>' + (r.why ? '<div class="why">' + r.why + '</div>' : '') + '</div>'; }).join('')
    : '<p class="note">Nog geen antwoorden. Het interval dat je het vaakst mist komt hier bovenaan, en dat krijg je ook vaker als vraag.</p>';
}
function ivRenderSongs(){
  var own = ivSongs(), esc = function(t){ return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); };
  $('ivSongs').innerHTML = '<div class="ivsong head"><span>Interval</span><span>Stijgend</span><span>Dalend</span></div>' +
    IV_EAR12.map(function(id){
      var x = ivX(id), s = x.semis;
      return '<div class="ivsong"><span><b>' + ((ivS.style === 'en' ? x.earKortEn : x.earKort) || (ivS.style === 'en' ? x.kortEn : x.kort)) + '</b> ' + ((ivS.style === 'en' ? (id === 'o4' ? 'tritone' : x.en) : x.earNl || x.nl)) + '</span>' +
        ['up','down'].map(function(d){ return '<input type="text" data-k="' + d + ':' + s + '" value="' + esc(own[d + ':' + s] || '') + '" placeholder="' + esc(IV_SONG[s][d === 'up' ? 0 : 1]) + '">'; }).join('') + '</div>';
    }).join('');
  $('ivSongs').querySelectorAll('input').forEach(function(inp){
    inp.onchange = function(){ var o = ivSongs(), v = inp.value.trim(); if (v) o[inp.dataset.k] = v; else delete o[inp.dataset.k]; ivSaveSongs(o); };
    inp.addEventListener('keydown', function(e){ e.stopPropagation(); });
  });
}

/* --- profiel en paneel --- */
function ivFillLevels(){
  $('ivLevel').innerHTML = IV_LEVELS.filter(function(l){ return !l.bladOnly || ivProfile === 'blad'; }).map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie (🕹️)</option>';
}
function ivSwitch(prof){
  prof = prof === 'gehoor' ? 'gehoor' : 'blad';
  if (prof !== ivProfile){
    ivSave();
    var o = ivLoadProf(prof);
    Object.keys(ivS).forEach(function(k){ delete ivS[k]; }); Object.assign(ivS, o);
    ivProfile = prof; ivLastK = null;
  }
  ivFillLevels(); ivSyncUI(); ivRenderSongs();
  $('ivTitle').textContent = '📐 ' + ivTitle();
  var pt = document.querySelector('.nlsub[data-sub="interval"] .pnltitle'); if (pt) pt.textContent = '· ' + ivTitle();
  $('ivToday').textContent = Score.today(ivSid());
  ivScore = { right:0, total:0, streak:0 }; $('ivRight').textContent = 0; $('ivTotal').textContent = 0; $('ivStreak').textContent = 0;
}
function ivSyncUI(){
  $('ivLevel').value = ivS.level; $('ivMode').value = ivS.mode; $('ivHoogte').value = ivS.hoogte; $('ivBpm').value = String(ivS.bpm);
  document.querySelector('.nlsub[data-sub="interval"]').classList.toggle('hmid', ivS.hoogte !== 'balk'); $('ivStyle').value = ivS.style; $('ivInst').value = ivS.timbre;
  $('ivStart').value = String(ivS.start); $('ivTonics').value = ivS.tonics; $('ivDbl').checked = ivS.dbl;
  $('ivAuto').checked = ivS.auto; $('ivExplore').checked = ivS.explore; $('ivHear').checked = ivS.hear;
  $('ivTimed').checked = ivS.timed; $('ivLimit').value = ivS.limit;
  document.querySelectorAll('#ivDirs input.ivd').forEach(function(i){ i.checked = ivS.dirs.indexOf(i.value) >= 0; });
  document.querySelectorAll('#ivChips input').forEach(function(i){ i.checked = ivS.set.indexOf(i.value) >= 0; });
  if (ivBUI) ivBUI.sync();
}
function ivStart(prof){ ivSwitch(prof || 'blad'); ivStats(); ivNew(); }
function ivRenderChips(){
  var lab = function(x){ return (ivS.style === 'en' ? x.kortEn : x.kort) + ' <span class="muted">' + (ivS.style === 'en' ? x.en : x.nl) + '</span>'; };
  $('ivChips').innerHTML = [['Binnen het octaaf', 2, 8], ['Groter dan een octaaf', 9, 15]].map(function(g){
    return '<div class="tlglab">' + g[0] + '</div><div class="chips">' + IV_ALL.filter(function(x){ return x.n >= g[1] && x.n <= g[2]; }).map(function(x){
      return '<label class="chip' + (x.ear ? '' : ' ivnoear') + '"><input type="checkbox" value="' + x.id + '"> ' + lab(x) + '</label>'; }).join('') + '</div>';
  }).join('');
}
function ivInit(){
  if (!$('ivLevel')) return;
  ivS = ivLoadProf('blad');
  ivFillLevels();
  $('ivInst').innerHTML = Engine.instOptions(ivS.timbre);
  $('ivStart').innerHTML = '<option value="rand">willekeurig</option>' + ['C','Cis','D','Es','E','F','Fis','G','As','A','Bes','B'].map(function(n, pc){ return '<option value="' + pc + '">' + n + '</option>'; }).join('');
  ivRenderChips();
  var active = function(){ return typeof nlCur !== 'undefined' && nlCur === 'interval'; };
  var changed = function(renew){ ivSave(); ivSyncUI(); if (active()){ if (renew) ivNew(); else ivRenderInput(); } };
  ivBUI = nlBereikUI($('ivBereik'), ivS, function(){ changed(true); }, { clefsLedger:true });
  ivSyncUI();
  $('ivLevel').onchange = function(e){
    var L = IV_LEVELS.find(function(l){ return l.id === e.target.value; });
    ivS.level = e.target.value; if (L) ivS.set = L.set.slice(); else Paneel.set('ntView', true);
    ivFix(); changed(true);
  };
  $('ivChips').onchange = function(){
    var set = []; document.querySelectorAll('#ivChips input:checked').forEach(function(i){ set.push(i.value); });
    if (ivEar()) set = set.filter(function(id){ return ivX(id).ear; });
    if (set.length < 2){ ivSyncUI(); var m = $('ivMsg'); m.className = 'qmsg nlmsg bad'; m.textContent = 'Kies minstens twee intervallen.'; return; }
    ivS.set = set; ivFix(); ivMatchLevel(); changed(true);
  };
  $('ivDirs').onchange = function(e){
    if (!e.target.classList.contains('ivd')) return;
    var d = []; document.querySelectorAll('#ivDirs input.ivd:checked').forEach(function(i){ d.push(i.value); });
    if (!d.length){ ivSyncUI(); return; }
    ivS.dirs = d; changed(true);
  };
  $('ivMode').onchange = function(e){ ivS.mode = e.target.value; changed(true); };
  gehBpmFill($('ivBpm')); $('ivBpm').value = String(ivS.bpm);
  $('ivBpm').onchange = function(e){ ivS.bpm = +e.target.value; ivSave(); };
  $('ivHoogte').onchange = function(e){ ivS.hoogte = e.target.value; changed(true); };
  $('ivStart').onchange = function(e){ ivS.start = e.target.value === 'rand' ? 'rand' : +e.target.value; changed(true); };
  $('ivTonics').onchange = function(e){ ivS.tonics = e.target.value; changed(true); };
  $('ivDbl').onchange = function(e){ ivS.dbl = e.target.checked; changed(true); };
  $('ivStyle').onchange = function(e){ ivS.style = e.target.value; changed(false); ivRenderChips(); ivSyncUI(); ivRenderSongs(); ivStats(); };
  $('ivInst').onchange = function(e){ ivS.timbre = e.target.value; changed(false); };
  $('ivHear').onchange = function(e){ ivS.hear = e.target.checked; changed(false); };
  $('ivAuto').onchange = function(e){ ivS.auto = e.target.checked; changed(false); };
  $('ivExplore').onchange = function(e){ ivS.explore = e.target.checked; changed(true); };
  $('ivTimed').onchange = function(e){ ivS.timed = e.target.checked; changed(true); };
  $('ivLimit').onchange = function(e){ ivS.limit = Math.min(30, Math.max(1, Math.round(+e.target.value) || 8)); changed(true); };
  document.querySelectorAll('#ntView .nlsub[data-sub="interval"] aside select, #ntView .nlsub[data-sub="interval"] aside input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('ivNext').onclick = function(){ this.blur(); ivNew(); };
  $('ivHearBtn').onclick = function(){ this.blur(); if (ivQ && (ivQ.answered || ivS.mode !== 'zien' || ivS.explore)) ivPlayQ(); };
  $('ivAgain').onclick = function(){ this.blur(); ivPlayQ(); };
  $('ivMine').onclick = function(){ this.blur(); if (ivQ && ivQ.choice){ var top = ivQ.dir === 'down'; ivPlay(top ? Notatie.midi(ivQ.hi) - ivQ.choice.semis : Notatie.midi(ivQ.lo), ivQ.choice.semis, ivQ.dir); } };
  $('ivBoth').onclick = function(){ this.blur(); if (ivQ) ivPlay(Notatie.midi(ivQ.lo), ivQ.x.semis, ivQ.dir === 'harm' ? 'up' : 'harm'); };
  $('ivReset').onclick = function(){ Score.clear(ivSid()); ivStats(); $('ivToday').textContent = 0; };
  $('ivToday').textContent = Score.today(ivSid());
  ivRenderSongs(); ivStats();
  if (typeof view !== 'undefined' && NL_ROUTES[view] && NL_ROUTES[view][0] === 'interval') nlSub('interval', NL_ROUTES[view][1]);   // direct geopend
}
ivInit();
