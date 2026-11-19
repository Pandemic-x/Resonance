/* ================= Notenlezen → Akkoordsymbolen spelen (prefix as, route #akkoordsymbolen → #asView) — 16-11-2026 =================
   Je ziet een akkoordsymbool (Dm7, B♭maj7, F♯ø7, G7♭9 …) en tikt de tonen aan op het klavier; Enter = nakijken.
   Akkoorden komen uit de gedeelde theorie (Theorie.CHORDS: sym + formule), grondtonen uit Theorie.TONICS. Nieuw akkoord = één regel in theorie.js.
   Goed = precies de juiste toonklassen (octaaf maakt niet uit); met 'Grondtoon onderaan' moet de laagste toon de grondtoon zijn.
   Omkeringen (19-11-2026): optie 'slash' → C/E, G7/B, Dm7/C; dan moet de toon na de / onderaan (alleen akkoorden met inv).
   Score 'akkoordsymbolen', k = akkoord-id. */
var AS_LEVELS = [
  { id:'s1', name:'1 · major en minor (witte grondtonen)',          types:['maj','min'],                                tonics:'wit' },
  { id:'s2', name:'2 · alle drieklanken (witte grondtonen)',        types:['maj','min','dim','aug','sus2','sus4'],      tonics:'wit' },
  { id:'s3', name:'3 · major, minor, °, + (alle grondtonen)',      types:['maj','min','dim','aug'],                    tonics:'alle' },
  { id:'s4', name:'4 · 7th-akkoorden (alle grondtonen)',           types:['dom7','maj7','min7','hdim7','dim7'],        tonics:'alle' },
  { id:'s5', name:'5 · jazz: 6, m6, 9, maj9, m9',                   types:['six','min6','dom9','maj9','min9'],          tonics:'alle' },
  { id:'sx', name:'6 · uitgebreid: add9, 6/9, sus, 7♯5, ♯11, 11, 13', types:['add9','madd9','six9','sus7','sus9','aug7','dom7b5','augmaj7','maj7s11','dom7s11','min11','maj13','min13'], tonics:'alle' },
  { id:'s6', name:'7 · alles (alle grondtonen)',                   types:null,                                         tonics:'alle' }
];
var AS_KEY = 'akkoordsymbolen-settings', AS_NAT = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };
var asS = null, asQ = null, asK = null, asScore = { right:0, total:0, streak:0 };
function asDefaults(){ return { level:'s1', types:['maj','min'], tonics:'wit', names:'c', hear:true, auto:true, bass:false, slash:false, inst:'piano' }; }
function asLoad(){ var s = {}; try { s = JSON.parse(localStorage.getItem(AS_KEY)) || {}; } catch(e){} asS = Object.assign(asDefaults(), s); if (!Array.isArray(asS.types) || !asS.types.length) asS.types = ['maj','min']; }
function asSave(){ try { localStorage.setItem(AS_KEY, JSON.stringify(asS)); } catch(e){} }
function asChord(id){ return Theorie.CHORDS.find(function(c){ return c.id === id; }); }
function asAcc(a){ return a === 1 ? '♯' : a === 2 ? '𝄪' : a === -1 ? '♭' : a === -2 ? '𝄫' : ''; }
function asNoteName(n){ return n.l.toUpperCase() + asAcc(n.a); }
function asPc(n){ return ((AS_NAT[n.l] + n.a) % 12 + 12) % 12; }
Score.def('akkoordsymbolen', {
  name:'Akkoordsymbolen', view:'akkoordsymbolen',
  label:function(k){ var c = asChord(k); return c ? (c.sym ? 'X' + c.sym : 'X') + ' · ' + c.nl : k; },
  level:function(){ return asS.level + (asS.slash ? '|slash' : asS.bass ? '|bas' : ''); },
  levelName:function(lv){ var p = lv.split('|'), L = AS_LEVELS.find(function(l){ return l.id === p[0]; }); return (L ? 'niveau ' + L.name : 'eigen selectie') + (p[1] === 'slash' ? ', met omkeringen (slash chords)' : p[1] ? ', grondtoon onderaan' : ''); },
  next:function(lv){ var i = AS_LEVELS.findIndex(function(l){ return l.id === lv.split('|')[0]; }); return i >= 0 && i < AS_LEVELS.length - 1 ? 'niveau ' + AS_LEVELS[i + 1].name : 'zet "Omkeringen (slash chords)" aan'; }
});
var asTimer = null;
function asNew(){
  clearTimeout(asTimer); Score.ask('akkoordsymbolen');
  var types = asS.types.filter(asChord), tally = Score.tally('akkoordsymbolen', 20), prev = asQ ? asQ.c.id + asQ.root.l + asQ.root.a : '';
  var c, root, notes, k = 0;
  do {
    c = asChord(hrPickW(types, function(id){ return hrErrW(tally, id); }));
    root = hrRnd(Theorie.TONICS[asS.tonics] || Theorie.TONICS.wit);
    notes = Theorie.spell(root, c.offs, c.semis, 1);
  } while ((!notes || c.id + root.l + root.a === prev) && k++ < 40);
  if (!notes) notes = Theorie.spell(root, c.offs, c.semis, 2);
  var sym = root.l.toUpperCase() + asAcc(root.a) + c.sym;
  // omkering als slash chord (C/E, G7/B): alleen bij akkoorden die omgekeerd hetzelfde akkoord blijven (c.inv);
  // grondligging komt ook voor, even vaak als elke omkering
  var inv = asS.slash && c.inv ? Math.floor(Math.random() * Math.min(notes.length, 4)) : 0;
  if (inv) sym += '/' + asNoteName(notes[inv]);
  asQ = { c:c, root:root, notes:notes, sym:sym, inv:inv, pcs:notes.map(asPc), picked:[], answered:false };
  $('asSym').textContent = sym; $('asName').textContent = '';
  $('asMsg').className = 'qmsg'; $('asMsg').textContent = '';
  asK.clear(); asRenderPicked();
  Score.heard('akkoordsymbolen');
}
function asKey(m){
  if (!asQ) return;
  if (asQ.answered){ asPlay([m]); return; }
  var i = asQ.picked.indexOf(m), el = document.querySelector('#asKlav [data-midi="' + m + '"]');
  if (i >= 0){ asQ.picked.splice(i, 1); if (el) el.classList.remove('picked'); }
  else { asQ.picked.push(m); if (el) el.classList.add('picked'); if (asS.hear) asPlay([m], .5); }
  asRenderPicked();
}
function asPlay(ms, dur){ ensureCtx(); var t = actx.currentTime + .03; ms.forEach(function(m){ Engine.note(t, m, dur || 1.3, { inst:asS.inst, vol:.75 / Math.max(2, ms.length) * 1.4 }); }); }
function asRenderPicked(){
  var p = asQ ? asQ.picked.slice().sort(function(a, b){ return a - b; }) : [];
  $('asPicked').textContent = p.length ? p.length + ' ' + (p.length === 1 ? 'toon' : 'tonen') + ' gekozen' : 'Tik de tonen aan op het klavier';
}
function asWis(){ if (!asQ || asQ.answered) return; asQ.picked = []; asK.clear(); asRenderPicked(); }
function asCheck(){
  if (!asQ) return;
  if (asQ.answered){ asNew(); return; }
  if (!asQ.picked.length){ $('asMsg').className = 'qmsg'; $('asMsg').textContent = 'Kies eerst de tonen op het klavier.'; return; }
  asQ.answered = true;
  var want = asQ.pcs, picked = asQ.picked.slice().sort(function(a, b){ return a - b; });
  var have = picked.map(function(m){ return m % 12; });
  var extra = picked.filter(function(m){ return want.indexOf(m % 12) < 0; });
  var missing = asQ.notes.filter(function(n){ return have.indexOf(asPc(n)) < 0; });
  var bassPc = want[asQ.inv || 0], needBass = asS.slash || asS.bass;   // slash chord: de toon na / moet onderaan; anders (optioneel) de grondtoon
  var bassOk = !needBass || (picked[0] % 12) === bassPc;
  var ok = !extra.length && !missing.length && bassOk;
  Score.log('akkoordsymbolen', [{ k:asQ.c.id, q:asQ.sym, a:picked.map(function(m){ return asNoteName(Notatie.spell(m, 'C')); }).join(' '), ok:ok }]);
  asScore.total++; if (ok){ asScore.right++; asScore.streak++; } else asScore.streak = 0;
  asRenderStats();
  $('asRight').textContent = asScore.right; $('asTotal').textContent = asScore.total; $('asStreak').textContent = asScore.streak; $('asToday').textContent = Score.today('akkoordsymbolen');
  // kleuren: goede gekozen tonen groen, foute rood; ontbrekende tonen groen op een plek in de buurt van je keuze
  asK.clear();
  picked.forEach(function(m){ asK.mark(m, want.indexOf(m % 12) >= 0 ? 'right' : 'wrong'); });
  var base = picked.length ? picked[0] - ((picked[0] - want[0] + 120) % 12) : 48 + want[0];
  if (base < 48) base += 12;
  var voicing = asQ.c.semis.map(function(s){ return base + s; });
  for (var vi = 0; vi < (asQ.inv || 0); vi++) voicing.push(voicing.shift() + 12);   // omkering: onderste tonen een octaaf omhoog
  while (voicing[voicing.length - 1] > 83 && voicing[0] - 12 >= 48) voicing = voicing.map(function(m){ return m - 12; });
  voicing = voicing.filter(function(m){ return m <= 83; });
  voicing.forEach(function(m){ if (have.indexOf(m % 12) < 0) asK.mark(m, 'right'); });
  var names = asQ.notes.map(asNoteName).join(' – ');
  $('asName').textContent = asQ.c.nl + ' · ' + Theorie.formula(asQ.c.offs, asQ.c.semis) + ' · ' + asQ.c.kenmerk;
  var msg = $('asMsg'); msg.className = 'qmsg ' + (ok ? 'good' : 'bad');
  msg.innerHTML = (ok ? 'Goed! ' : '') + '<b>' + asQ.sym + '</b> = ' + names + '.' +
    (missing.length ? ' Je mist: ' + missing.map(asNoteName).join(', ') + '.' : '') +
    (extra.length ? ' Hoort er niet bij: ' + extra.map(function(m){ return asNoteName(Notatie.spell(m, 'C')); }).join(', ') + '.' : '') +
    (!bassOk ? (asQ.inv ? ' De bas (' + asNoteName(asQ.notes[asQ.inv]) + ', na de /) moet onderaan.' : ' De grondtoon (' + asNoteName(asQ.notes[0]) + ') moet onderaan.') : '') +
    (asQ.inv ? ' ' + ['', 'Eerste', 'Tweede', 'Derde'][asQ.inv] + ' omkering: de ' + ['grondtoon', 'terts', 'kwint', 'septiem'][asQ.inv] + ' in de bas.' : '') + ' ' + Keys.label('volgende') + ' = volgende.';
  asPlay(voicing);
  if (ok && asS.auto){ var q0 = asQ; asTimer = setTimeout(function(){ if (view === 'akkoordsymbolen' && asQ === q0) asNew(); }, 1600); }
}
function asRenderStats(){ $('asStats').innerHTML = hrStatsHTML('akkoordsymbolen', function(k){ var c = asChord(k); return c ? 'X' + c.sym + ' · ' + c.nl : k; }, 'Nog geen antwoorden. De akkoordsoort die je het vaakst mist komt bovenaan en komt vaker terug.'); }
function asSyncUI(){
  $('asLevel').value = asS.level; $('asTonics').value = asS.tonics; $('asNames').value = asS.names; $('asInst').value = asS.inst;
  $('asHear').checked = asS.hear; $('asAuto').checked = asS.auto; $('asBassChk').checked = asS.bass;
  if ($('asSlash')){ $('asSlash').checked = asS.slash; $('asBassChk').disabled = asS.slash; }
  document.querySelectorAll('#asChips input').forEach(function(i){ i.checked = asS.types.indexOf(i.value) >= 0; });
  if (asK) asK.set({ names:asS.names });
}
function asMatchLevel(){
  var key = asS.tonics + ':' + asS.types.slice().sort().join();
  var L = AS_LEVELS.find(function(l){ return l.tonics + ':' + (l.types || Theorie.CHORDS.map(function(c){ return c.id; })).slice().sort().join() === key; });
  asS.level = L ? L.id : 'eigen'; $('asLevel').value = asS.level;
}
function asInit(){
  asLoad();
  $('asLevel').innerHTML = AS_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie</option>';
  $('asChips').innerHTML = Theorie.CHORD_GROUPS.map(function(g){ return '<div class="aschipgrp"><span class="muted">' + g[1] + '</span>' + Theorie.CHORDS.filter(function(c){ return c.grp === g[0]; }).map(function(c){ return '<label class="chip"><input type="checkbox" value="' + c.id + '"> X' + c.sym + ' <span class="muted">' + c.nl + '</span></label>'; }).join('') + '</div>'; }).join('');
  hrInstOpts($('asInst'));
  asK = Notatie.klavier($('asKlav'), { lo:48, hi:83, names:asS.names, onKey:asKey });
  asSyncUI();
  var ch = function(){ asSave(); asNew(); };
  $('asLevel').onchange = function(e){ var L = AS_LEVELS.find(function(l){ return l.id === e.target.value; }); asS.level = e.target.value; if (L){ asS.types = (L.types || Theorie.CHORDS.map(function(c){ return c.id; })).slice(); asS.tonics = L.tonics; } asSyncUI(); ch(); };
  $('asChips').onchange = function(){ var set = []; document.querySelectorAll('#asChips input:checked').forEach(function(i){ set.push(i.value); }); if (!set.length){ asSyncUI(); return; } asS.types = set; asMatchLevel(); ch(); };
  $('asTonics').onchange = function(e){ asS.tonics = e.target.value; asMatchLevel(); ch(); };
  $('asNames').onchange = function(e){ asS.names = e.target.value; asSave(); asK.set({ names:asS.names }); if (asQ && asQ.answered) asNew(); else if (asQ){ asQ.picked.forEach(function(m){ asK.mark(m, 'picked'); }); } };
  $('asInst').onchange = function(e){ asS.inst = e.target.value; asSave(); };
  $('asHear').onchange = function(e){ asS.hear = e.target.checked; asSave(); };
  $('asAuto').onchange = function(e){ asS.auto = e.target.checked; asSave(); };
  $('asBassChk').onchange = function(e){ asS.bass = e.target.checked; ch(); };
  if ($('asSlash')) $('asSlash').onchange = function(e){ asS.slash = e.target.checked; asSyncUI(); ch(); };
  document.querySelectorAll('#asView select, #asView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('asCheckBtn').onclick = function(){ this.blur(); asCheck(); };
  $('asWisBtn').onclick = function(){ this.blur(); asWis(); };
  $('asHearBtn').onclick = function(){ this.blur(); if (asQ && asQ.picked.length) asPlay(asQ.picked.slice()); };
  $('asNext').onclick = function(){ this.blur(); asNew(); };
  $('asReset').onclick = function(){ Score.clear('akkoordsymbolen'); asRenderStats(); $('asToday').textContent = 0; };
  $('asToday').textContent = Score.today('akkoordsymbolen');
  asNew(); asRenderStats();
}
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || view !== 'akkoordsymbolen' || !asQ) return;
  if (e.ctrlKey || e.metaKey || e.altKey || Keys.blocked(e)) return;
  if (Keys.is(e, 'controleer') || Keys.is(e, 'volgende')){ e.preventDefault(); asCheck(); }
  else if (Keys.is(e, 'wis')){ e.preventDefault(); asWis(); }
  else if (Keys.is(e, 'luister')){ e.preventDefault(); if (asQ.picked.length) asPlay(asQ.picked.slice()); }
});
asInit();
