/* ================= Harmonie op gehoor: Cadensen (prefix cd) en Akkoordprogressies (prefix pr) — 16-11-2026 =================
   De inhoud (trap-akkoorden, cadensen, bekende progressies) staat in theorie.js: Theorie.RN, Theorie.CADENCES, Theorie.PROGRESSIONS.
   Gedeeld (prefix hr): akkoorden per toonsoort (HR_CH), spelling, stemvoering (hrVoice), afspelen (hrPlay), sleutels.
   Views: #cadensen → #cdView, #progressies → #prView (onder Gehoor). Score: 'cadensen' (k = mode:type), 'progressies' (k = mode:akkoord-id).
   Toetsen: luister (Spatie), volgende (Enter/→), cadens (C, alleen progressies), wis (Backspace, progressies), stop (Esc).
   Antwoorden: Cadensen 1–7 (volgorde in Theorie.CADENCES) · Progressies 1–7 = drieklank op die trap, Shift+1–7 = het septiemakkoord (geleende en secundaire akkoorden: klikken). */

/* --- trap-akkoorden, soorten en symbolen staan in de gedeelde theorie (theorie.js: Theorie.RN, RN_Q, RN_SYM): nieuw akkoord = één regel daar --- */
var HR_Q = Theorie.RN_Q, HR_SYM = Theorie.RN_SYM, HR_CH = Theorie.RN;
var HR_KEYS = { maj:[0,7,2,9,4,5,10,3,8], min:[9,4,11,2,7,0,5] };
var HR_TON = { maj:{0:'C',7:'G',2:'D',9:'A',4:'E',5:'F',10:'B♭',3:'E♭',8:'A♭'}, min:{9:'A',4:'E',11:'B',2:'D',7:'G',0:'C',5:'F'} };
var HR_LET = ['C','D','E','F','G','A','B'], HR_LPC = [0,2,4,5,7,9,11];
var HR_INSTS = [['piano','piano'],['orgel','orgel'],['strijker','strijkers'],['gitaar','gitaar'],['marimba','marimba']];

function hrCh(mode, id){ return HR_CH[mode].find(function(c){ return c.id === id; }) || null; }
function hrKeyName(pc, mode){ return typeof gKeyName === 'function' ? gKeyName(pc, mode) : HR_TON[mode][pc] + (mode === 'maj' ? '-groot' : '-klein'); }
function hrRootName(pc, mode, c){
  var t = HR_TON[mode][pc] || HR_LET[0], li = (HR_LET.indexOf(t.charAt(0)) + c.step) % 7;
  var acc = (((pc + c.semi - HR_LPC[li]) % 12) + 18) % 12 - 6;
  return HR_LET[li] + (acc === 1 ? '♯' : acc === 2 ? '𝄪' : acc === -1 ? '♭' : acc === -2 ? '𝄫' : '');
}
function hrSym(pc, mode, c){ return hrRootName(pc, mode, c) + HR_SYM[c.q] + (c.inv ? '/' + hrBassName(pc, mode, c) : ''); }
function hrBassName(pc, mode, c){   // iv⁶: de terts in de bas (in a-klein: Dm/F)
  var root = hrRootName(pc, mode, c), li = HR_LET.indexOf(root.charAt(0)), bl = (li + 2) % 7;
  var bpc = (pc + c.semi + HR_Q[c.q][1]) % 12, acc = (((bpc - HR_LPC[bl]) % 12) + 18) % 12 - 6;
  return HR_LET[bl] + (acc === 1 ? '♯' : acc === -1 ? '♭' : '');
}
function hrTonicBass(pc){ return 43 + ((pc - 7 + 12) % 12); }   // grondtoon in de bas tussen G2 en F♯3

/* --- stemvoering: bas + drie stemmen erboven, zo dicht mogelijk bij het vorige akkoord --- */
function hrVoice(T, c, prev, inv){   // inv = welke akkoordtoon in de bas (0 grondligging, 1 terts = sextakkoord); standaard volgens het akkoord
  var root = T + c.semi, iv = HR_Q[c.q];
  if (inv == null) inv = c.inv ? 1 : 0;
  var bass = root + iv[inv]; while (bass > 55) bass -= 12; while (bass < 38) bass += 12;
  var pcs = iv.map(function(x){ return (root + x) % 12; });
  var need = iv.length === 4 ? [[pcs[0], pcs[1], pcs[3]], [pcs[1], pcs[2], pcs[3]]] : [pcs];   // septiemakkoord: kwint (of grondtoon) mag weg
  var notes = []; for (var m = 55; m <= 77; m++) if (pcs.indexOf(m % 12) >= 0) notes.push(m);
  var best = null, bestCost = Infinity;
  for (var a = 0; a < notes.length; a++) for (var b = a + 1; b < notes.length; b++) for (var d = b + 1; d < notes.length; d++){
    var v = [notes[a], notes[b], notes[d]];
    if (v[2] - v[0] > 12) continue;
    var have = v.map(function(x){ return x % 12; });
    if (!need.some(function(set){ return set.every(function(p){ return have.indexOf(p) >= 0; }); })) continue;
    var cost = prev ? Math.abs(v[0] - prev[0]) + Math.abs(v[1] - prev[1]) + Math.abs(v[2] - prev[2]) : Math.abs(v[2] - 71) + Math.abs(v[0] - 62) * .5;
    if (v[0] <= bass + 2) cost += 6;
    cost += Math.random() * .4;
    if (cost < bestCost){ bestCost = cost; best = v; }
  }
  return { bass:bass, up:best || [root + 12, root + 12 + iv[1], root + 12 + iv[2]] };
}
function hrVoiceAll(T, list){ var prev = null; return list.map(function(c){ var v = hrVoice(T, c, prev); prev = v.up; return v; }); }
var hrTimers = [];
function hrStop(){ hrTimers.forEach(clearTimeout); hrTimers = []; if (typeof Engine !== 'undefined') Engine.stopNotes(); document.querySelectorAll('.hrslot.play').forEach(function(x){ x.classList.remove('play'); }); }
// speel een rij akkoorden; onChord(i) bij het klinken van akkoord i; geeft de eindtijd (audioklok) terug
function hrPlay(voices, o){
  hrStop(); ensureCtx();
  var t = actx.currentTime + .08, d = 60 / (o.bpm || 60), inst = o.inst || 'piano';
  voices.forEach(function(v, i){
    var L = (i === voices.length - 1 && o.longLast !== false) ? d * 1.7 : d * .96;
    Engine.note(t, v.bass, L, { inst:inst, vol:o.bassVol || .3 });
    v.up.forEach(function(m){ Engine.note(t, m, L, { inst:inst, vol:.2 }); });
    if (o.onChord){ var cb = o.onChord, tt = t; hrTimers.push(setTimeout(function(){ cb(i); }, Math.max(0, (tt - actx.currentTime) * 1000))); }
    t += d;
  });
  if (o.onEnd){ var e = o.onEnd; hrTimers.push(setTimeout(e, Math.max(0, (t - actx.currentTime + d * .7) * 1000))); }
  return t + d * .7;
}
function hrInstOpts(sel){ sel.innerHTML = HR_INSTS.map(function(x){ return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join(''); }
function hrPickW(items, wf){ var ws = items.map(wf), s = ws.reduce(function(a, b){ return a + b; }, 0), r = Math.random() * s; for (var i = 0; i < items.length; i++){ r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; }
function hrRnd(a){ return a[Math.floor(Math.random() * a.length)]; }
function hrErrW(tally, k){ var s = tally[k]; var err = s ? (s.t - s.r + 1) / (s.t + 2) : .5; return .25 + err * 2; }
function hrStatsHTML(id, labelFn, empty){
  var t = Score.tally(id), rows = Object.keys(t).map(function(k){ var s = t[k]; return { label:labelFn(k), r:s.r, t:s.t, p:s.t ? s.r / s.t : 0 }; }).filter(function(r){ return r.t; });
  rows.sort(function(a, b){ return a.p - b.p || b.t - a.t; });
  return rows.length ? rows.map(function(r){ return '<div class="stat"><div class="row"><span>' + r.label + '</span><span>' + r.r + '/' + r.t + ' · ' + Math.round(r.p * 100) + '%</span></div><div class="barbg"><div class="barfg" style="width:' + (r.p * 100) + '%"></div></div></div>'; }).join('')
    : '<p class="note">' + empty + '</p>';
}
function hrNewKey(Q, S, mode){
  var list = HR_KEYS[mode], changed = false;
  if (S.key !== 'rand'){
    var fixed = +S.key; if (list.indexOf(fixed) < 0) fixed = list[0];
    if (Q.pc !== fixed || Q.mode !== mode){ Q.pc = fixed; changed = true; }
  } else if (Q.pc == null || Q.mode !== mode || Q.sinceKey >= S.keyEvery || list.indexOf(Q.pc) < 0){
    var pc, k = 0; do { pc = hrRnd(list); } while (pc === Q.pc && k++ < 20);
    Q.pc = pc; changed = true;
  }
  if (changed){ Q.sinceKey = 0; Q.mode = mode; }
  Q.sinceKey++; Q.T = hrTonicBass(Q.pc);
  return changed;
}
function hrKeySel(sel, S, mode){
  var modes = mode === 'beide' ? ['maj','min'] : [mode];
  sel.innerHTML = '<option value="rand">willekeurig</option>' + modes.map(function(m){ return HR_KEYS[m].map(function(pc){ return '<option value="' + pc + '">' + hrKeyName(pc, m) + '</option>'; }).join(''); }).join('');
  sel.value = String(S.key); if (sel.value !== String(S.key)){ S.key = 'rand'; sel.value = 'rand'; }
}

/* ================= Cadensen ================= */
// de slotformules zelf staan in theorie.js (Theorie.CADENCES): nieuwe cadens = één regel daar; toets = plaats in die lijst
var CD_TYPES = Theorie.CADENCES;
CD_TYPES.forEach(function(t, i){ t.key = String(i + 1); });
var CD_LEVELS = [
  { id:'c1', name:'1 · authentiek of half (majeur)',        types:['aut','half'],              modes:'maj' },
  { id:'c2', name:'2 · + plagaal (majeur)',                  types:['aut','half','pla'],        modes:'maj' },
  { id:'c3', name:'3 · + bedrieglijk (majeur)',              types:['aut','half','pla','bedr'], modes:'maj' },
  { id:'c4', name:'4 · mineur: authentiek, half, bedrieglijk', types:['aut','half','bedr'],     modes:'min' },
  { id:'c5', name:'5 · majeur en mineur, alle vier',         types:['aut','half','pla','bedr'], modes:'beide' },
  { id:'c6', name:'6 · + Frygisch half slot',                types:['aut','half','pla','bedr','fryg'], modes:'beide' },
  { id:'c7', name:'7 · alles, ook Picardische terts en mineur-plagaal', types:['aut','half','pla','bedr','fryg','pic','mpla'], modes:'beide' }
];
var CD_KEY = 'cadensen-settings';
var cdS = null, cdQ = null, cdScore = { right:0, total:0, streak:0 };
function cdDefaults(){ return { level:'c1', types:['aut','half'], modes:'maj', key:'rand', keyEvery:5, bpm:75, inst:'piano', sev:false, auto:true }; }
function cdLoad(){ var s = {}; try { s = JSON.parse(localStorage.getItem(CD_KEY)) || {}; } catch(e){} cdS = Object.assign(cdDefaults(), s); if (!Array.isArray(cdS.types) || !cdS.types.length) cdS.types = ['aut','half']; }
function cdSave(){ try { localStorage.setItem(CD_KEY, JSON.stringify(cdS)); } catch(e){} }
function cdType(id){ return CD_TYPES.find(function(t){ return t.id === id; }); }
Score.def('cadensen', {
  name:'Cadensen', view:'cadensen',
  label:function(k){ var p = k.split(':'), t = cdType(p[1]); return (p[0] === 'maj' ? 'majeur' : 'mineur') + ' · ' + (t ? t.nl : p[1]); },
  level:function(){ return cdS.level + (cdS.sev ? '|7' : ''); },
  levelName:function(lv){ var p = lv.split('|'), L = CD_LEVELS.find(function(l){ return l.id === p[0]; }); return (L ? 'niveau ' + L.name : 'eigen instelling') + (p[1] ? ', met V7' : ''); },
  next:function(lv){ var i = CD_LEVELS.findIndex(function(l){ return l.id === lv.split('|')[0]; }); return i >= 0 && i < CD_LEVELS.length - 1 ? 'niveau ' + CD_LEVELS[i + 1].name : 'ga verder met Akkoordprogressies'; }
});
// een frase van 4 akkoorden volgens de regel in Theorie.CADENCES (alle soorten even lang, zodat de lengte niets verraadt); nooit twee keer hetzelfde akkoord achter elkaar
function cdPick(opts, prev){ var o = opts.map(function(x){ return x === 'V*' ? (cdS.sev ? 'V7' : 'V') : x; }), ok = o.filter(function(x){ return x !== prev; }); return hrRnd(ok.length ? ok : o); }
function cdPhrase(type, mode){
  var ph = cdType(type).phrase[mode], out = [];
  ph.forEach(function(opts, i){ out.push(cdPick(opts, i ? out[i - 1] : null)); });
  return out;
}
function cdModes(){ return cdS.modes === 'beide' ? ['maj','min'] : [cdS.modes]; }
function cdNew(autoplay){
  hrStop(); Score.ask('cadensen');
  var modes = cdModes(), mode = hrRnd(modes);
  var types = cdS.types.filter(function(t){ return cdType(t).modes.indexOf(mode) >= 0; });
  if (!types.length){ mode = 'min'; types = cdS.types.slice(); }
  var changed = hrNewKey(cdQ, cdS, mode);
  var tally = Score.tally('cadensen', 20), avoid = cdQ.type;
  var cand = types.length > 1 ? types.filter(function(t){ return t !== avoid || Math.random() < .25; }) : types;
  var type = hrPickW(cand, function(t){ return hrErrW(tally, mode + ':' + t); });
  var ids = cdPhrase(type, mode), chords = ids.map(function(id){ return hrCh(mode, id); });
  cdQ.type = type; cdQ.ids = ids; cdQ.voices = hrVoiceAll(cdQ.T, chords); cdQ.answered = false; cdQ.ans = null;
  $('cdKeyName').textContent = hrKeyName(cdQ.pc, mode);
  var msg = $('cdMsg'); msg.className = 'qmsg'; msg.textContent = changed ? 'Toonsoort: ' + hrKeyName(cdQ.pc, mode) + '.' : '';
  $('cdAfter').hidden = true;
  cdRenderPad(); cdRenderSlots(false);
  if (autoplay) cdPlayQ();
}
function cdPlayQ(){
  if (!cdQ || !cdQ.voices) return;
  Score.heard('cadensen');
  hrPlay(cdQ.voices, { bpm:cdS.bpm, inst:cdS.inst, onChord:function(i){ cdHi(i); }, onEnd:function(){ cdHi(-1); } });
}
function cdHi(i){ document.querySelectorAll('#cdSlots .hrslot').forEach(function(s, j){ s.classList.toggle('play', j === i); }); }
function cdAnswer(id){
  if (!cdQ || !cdQ.ids) return;
  if (cdQ.answered){ cdCompare(id); return; }
  if (cdS.types.indexOf(id) < 0) return;
  cdQ.answered = true; cdQ.ans = id;
  var ok = id === cdQ.type, mode = cdQ.mode, t = cdType(cdQ.type), a = cdType(id);
  Score.log('cadensen', [{ k:mode + ':' + cdQ.type, q:hrKeyName(cdQ.pc, mode) + ': ' + cdQ.ids.map(function(x){ return hrCh(mode, x).rn; }).join(' – '), a:a.nl, ok:ok }]);
  cdScore.total++; if (ok){ cdScore.right++; cdScore.streak++; } else cdScore.streak = 0;
  $('cdRight').textContent = cdScore.right; $('cdTotal').textContent = cdScore.total; $('cdStreak').textContent = cdScore.streak; $('cdToday').textContent = Score.today('cadensen');
  var msg = $('cdMsg'); msg.className = 'qmsg ' + (ok ? 'good' : 'bad');
  msg.innerHTML = (ok ? 'Goed! ' : 'Het was een <b>' + t.nl.toLowerCase() + '</b>; jij koos ' + a.nl.toLowerCase() + '. ') + (ok ? '<b>' + t.nl + '</b>. ' : '') + t.kenmerk;
  document.querySelectorAll('#cdPad .cdbtn').forEach(function(b){ b.classList.toggle('right', b.dataset.t === cdQ.type); b.classList.toggle('wrong', !ok && b.dataset.t === id); });
  cdRenderSlots(true); cdShowAfter(); cdRenderStats();
  var end = hrPlay(cdQ.voices, { bpm:cdS.bpm, inst:cdS.inst, onChord:cdHi, onEnd:function(){ cdHi(-1); } });
  if (ok && cdS.auto) hrTimers.push(setTimeout(function(){ cdNew(true); }, Math.max(400, (end - actx.currentTime) * 1000 + 700)));
}
// dezelfde aanloop (de eerste twee akkoorden), maar met een andere cadens: zo hoor je precies het verschil
function cdCompare(type){
  var mode = cdQ.mode, t = cdType(type); if (t.modes.indexOf(mode) < 0) return;
  var ph = t.phrase[mode], fix = function(x){ return x === 'V*' ? (cdS.sev ? 'V7' : 'V') : x; };
  var tail = [fix(ph[2][0]), fix(ph[3][0])], second = cdQ.ids[1];
  if (second === tail[0]){   // geen twee keer hetzelfde akkoord achter elkaar: een andere aanloop uit deze cadens
    var alt = ph[1].map(fix).filter(function(x){ return x !== tail[0]; });
    second = alt.length ? alt[0] : (mode === 'maj' ? 'vi' : 'VI');
  }
  var ids = [cdQ.ids[0], second].concat(tail);
  var v = hrVoiceAll(cdQ.T, ids.map(function(x){ return hrCh(mode, x); }));
  $('cdCmpTxt').textContent = t.nl + ': ' + ids.map(function(x){ return hrCh(mode, x).rn; }).join(' – ');
  hrPlay(v, { bpm:cdS.bpm, inst:cdS.inst });
}
function cdShowAfter(){
  var mode = cdQ.mode, box = $('cdAfter'); box.hidden = false;
  $('cdCmp').innerHTML = CD_TYPES.filter(function(t){ return t.modes.indexOf(mode) >= 0; }).map(function(t){ return '<button type="button" data-t="' + t.id + '">▶ ' + t.nl + '</button>'; }).join('');
  $('cdCmp').querySelectorAll('button').forEach(function(b){ b.onclick = function(){ b.blur(); cdCompare(b.dataset.t); }; });
  $('cdCmpTxt').textContent = '';
}
function cdRenderSlots(show){
  var mode = cdQ.mode;
  $('cdSlots').innerHTML = cdQ.ids.map(function(id, i){
    var c = hrCh(mode, id), last = i === cdQ.ids.length - 1;
    return '<div class="hrslot' + (show && i >= 2 ? ' cad' : '') + '"><b>' + (show || i === 0 ? c.rn : '?') + '</b><small>' + (show || i === 0 ? hrSym(cdQ.pc, mode, c) : (last ? 'slot' : '')) + '</small></div>';
  }).join('');
}
function cdRenderPad(){
  var mode = cdQ.mode;
  $('cdPad').innerHTML = CD_TYPES.filter(function(t){ return cdS.types.indexOf(t.id) >= 0; }).map(function(t){
    var off = t.modes.indexOf(mode) < 0;
    return '<button type="button" class="cdbtn' + (off ? ' off' : '') + '" data-t="' + t.id + '"' + (off ? ' disabled' : '') + '><strong>' + t.nl + '</strong><small>' + t.kort + (mode === 'min' ? ' (mineur)' : '') + '</small><kbd>' + t.key + '</kbd></button>';
  }).join('');
  $('cdPad').querySelectorAll('.cdbtn').forEach(function(b){ b.onclick = function(){ b.blur(); cdAnswer(b.dataset.t); }; });
}
function cdRenderStats(){ $('cdStats').innerHTML = hrStatsHTML('cadensen', function(k){ var p = k.split(':'), t = cdType(p[1]); return (p[0] === 'maj' ? 'Majeur' : 'Mineur') + ' · ' + (t ? t.nl : p[1]); }, 'Nog geen antwoorden. De cadens die je het vaakst mist komt bovenaan en krijg je ook vaker.'); }
function cdSyncUI(){
  $('cdLevel').value = cdS.level; $('cdModes').value = cdS.modes;
  hrKeySel($('cdKey'), cdS, cdS.modes);
  $('cdKeyEvery').value = String(cdS.keyEvery); $('cdBpm').value = String(cdS.bpm); $('cdInst').value = cdS.inst;
  $('cdSev').checked = cdS.sev; $('cdAuto').checked = cdS.auto;
  document.querySelectorAll('#cdChips input').forEach(function(inp){ inp.checked = cdS.types.indexOf(inp.value) >= 0; });
}
function cdMatchLevel(){
  var k = cdS.modes + ':' + cdS.types.slice().sort().join(',');
  var L = CD_LEVELS.find(function(l){ return l.modes + ':' + l.types.slice().sort().join(',') === k; });
  cdS.level = L ? L.id : 'eigen'; $('cdLevel').value = cdS.level;
}
function cdInit(){
  cdLoad(); cdQ = { pc:null, mode:null, sinceKey:0 };
  $('cdLevel').innerHTML = CD_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie</option>';
  $('cdChips').innerHTML = CD_TYPES.map(function(t){ return '<label class="chip"><input type="checkbox" value="' + t.id + '"> ' + t.nl + ' <span class="muted">' + t.kort + '</span></label>'; }).join('');
  gehBpmFill($('cdBpm')); hrInstOpts($('cdInst'));
  if (GEH_BPMS.indexOf(cdS.bpm) < 0) cdS.bpm = 75;
  cdSyncUI();
  var ch = function(renew){ cdSave(); if (renew) cdNew(false); };
  $('cdLevel').onchange = function(e){ var L = CD_LEVELS.find(function(l){ return l.id === e.target.value; }); cdS.level = e.target.value; if (L){ cdS.types = L.types.slice(); cdS.modes = L.modes; } cdSyncUI(); ch(true); };
  $('cdModes').onchange = function(e){ cdS.modes = e.target.value; hrKeySel($('cdKey'), cdS, cdS.modes); cdMatchLevel(); ch(true); };
  $('cdChips').onchange = function(){ var set = []; document.querySelectorAll('#cdChips input:checked').forEach(function(i){ set.push(i.value); }); if (set.length < 2){ set = cdS.types.slice(); cdSyncUI(); } cdS.types = set; cdMatchLevel(); ch(true); };
  $('cdKey').onchange = function(e){ cdS.key = e.target.value === 'rand' ? 'rand' : +e.target.value; cdQ.pc = null; ch(true); };
  $('cdKeyEvery').onchange = function(e){ cdS.keyEvery = +e.target.value; ch(false); };
  $('cdBpm').onchange = function(e){ cdS.bpm = +e.target.value; ch(false); };
  $('cdInst').onchange = function(e){ cdS.inst = e.target.value; ch(false); };
  $('cdSev').onchange = function(e){ cdS.sev = e.target.checked; ch(true); };
  $('cdAuto').onchange = function(e){ cdS.auto = e.target.checked; ch(false); };
  document.querySelectorAll('#cdView select, #cdView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('cdPlay').onclick = function(){ this.blur(); cdPlayQ(); };
  $('cdNext').onclick = function(){ this.blur(); cdNew(true); };
  $('cdReset').onclick = function(){ Score.clear('cadensen'); cdRenderStats(); $('cdToday').textContent = 0; };
  $('cdToday').textContent = Score.today('cadensen');
  cdNew(false); cdRenderStats();
}

/* ================= Akkoordprogressies ================= */
var PR_LEVELS = [
  { id:'p1', name:'1 · I, IV en V',                       mode:'maj', pool:['I','IV','V'] },
  { id:'p2', name:'2 · + vi',                              mode:'maj', pool:['I','IV','V','vi'] },
  { id:'p3', name:'3 · + ii',                              mode:'maj', pool:['I','ii','IV','V','vi'] },
  { id:'p4', name:'4 · alle drieklanken (+ iii, vii°)',    mode:'maj', pool:['I','ii','iii','IV','V','vi','viio'] },
  { id:'p5', name:'5 · septiemakkoorden (ii7–V7–Imaj7 …)', mode:'maj', pool:['Imaj7','ii7','IVmaj7','V7','vi7'] },
  { id:'p6', name:'6 · mineur: i, iv, V, VI, III, VII',    mode:'min', pool:['i','III','iv','V','VI','VII'] },
  { id:'p7', name:'7 · mineur + ii°, iiø7, V7',             mode:'min', pool:['i','iio','III','iv','V','VI','VII','iih7','V7'] },
  { id:'p8', name:'8 · geleend uit mineur: iv, ♭VI, ♭VII', mode:'maj', pool:['I','ii','IV','V','vi','iv','bVI','bVII'] },
  { id:'p9', name:'9 · secundaire dominanten',             mode:'maj', pool:['I','ii','IV','V','vi','V7/V','V7/vi','V7/ii','V7/IV'] },
  { id:'p10', name:'10 · bekende progressies (majeur en mineur)', mode:'beide', src:'bekend' }
];
// bekende progressies staan in theorie.js (Theorie.PROGRESSIONS): nieuwe = één regel daar
var PR_FAMOUS = Theorie.PROGRESSIONS;
var PR_KEY = 'progressies-settings';
var prS = null, prQ = null, prScore = { right:0, total:0, streak:0 };
function prDefaults(){ return { level:'p1', mode:'maj', src:'vrij', poolMaj:['I','IV','V'], poolMin:['i','iv','V','VI'], len:4, endI:true, first:true, cadQ:false, key:'rand', keyEvery:5, bpm:60, inst:'piano', auto:true }; }
function prLoad(){ var s = {}; try { s = JSON.parse(localStorage.getItem(PR_KEY)) || {}; } catch(e){} prS = Object.assign(prDefaults(), s);
  ['poolMaj','poolMin'].forEach(function(k){ if (!Array.isArray(prS[k]) || prS[k].length < 2) prS[k] = prDefaults()[k]; }); }
function prSave(){ try { localStorage.setItem(PR_KEY, JSON.stringify(prS)); } catch(e){} }
function prPool(mode){ return mode === 'maj' ? prS.poolMaj : prS.poolMin; }
Score.def('progressies', {
  name:'Akkoordprogressies', view:'progressies',
  label:function(k){ var p = k.split(':'), c = hrCh(p[0], p.slice(1).join(':')); return (p[0] === 'maj' ? 'majeur' : 'mineur') + ' · ' + (c ? c.rn : p[1]); },
  level:function(){ return prS.level + '|' + (prS.src === 'bekend' ? 'b' : prS.len); },
  levelName:function(lv){ var p = lv.split('|'), L = PR_LEVELS.find(function(l){ return l.id === p[0]; }); return (L ? 'niveau ' + L.name : 'eigen selectie') + (p[1] && p[1] !== 'b' ? ', ' + p[1] + ' akkoorden' : ''); },
  next:function(lv){ var p = lv.split('|'), i = PR_LEVELS.findIndex(function(l){ return l.id === p[0]; }); return +p[1] < 6 ? 'langere progressies (' + (+p[1] + 1) + ' akkoorden)' : i >= 0 && i < PR_LEVELS.length - 1 ? 'niveau ' + PR_LEVELS[i + 1].name : 'probeer liedjes op gehoor te begeleiden'; }
});
// willekeurige progressie volgens de functieharmonie: T → S → D → T (met wat vrijheid), secundaire dominant → zijn doel
var PR_FN = { T:{ T:1, S:3, D:2 }, S:{ T:1, S:1.3, D:3 }, D:{ T:4, S:.3, D:.4 } };
function prMake(mode){
  var pool = prPool(mode).map(function(id){ return hrCh(mode, id); }).filter(Boolean), tally = Score.tally('progressies', 20);
  var tonic = pool.find(function(c){ return c.step === 0 && c.fn === 'T'; }) || hrCh(mode, mode === 'maj' ? 'I' : 'i');
  var out = [tonic], n = Math.max(2, prS.len);
  for (var i = 1; i < n; i++){
    var prev = out[i - 1], lastSlot = i === n - 1;
    if (lastSlot && prS.endI){ out.push(tonic); break; }
    if (prev.to){ var tgt = pool.find(function(c){ return c.id === prev.to; }); if (tgt){ out.push(tgt); continue; } }
    var cands = pool.filter(function(c){
      if (c.id === prev.id) return false;
      if (c.sec && (i >= n - (prS.endI ? 2 : 1) || !pool.some(function(x){ return x.id === c.to; }))) return false;   // secundaire dominant: er moet nog plek zijn voor zijn doel
      if (prS.endI && i === n - 2 && c.id === tonic.id) return false;
      return true;
    });
    if (!cands.length) cands = pool.filter(function(c){ return c.id !== prev.id; });
    var row = PR_FN[prev.fn] || PR_FN.T;
    out.push(hrPickW(cands, function(c){ return (row[c.fn] || 1) * hrErrW(tally, mode + ':' + c.id) * (c.sec ? .8 : 1); }));
  }
  return { ids:out.map(function(c){ return c.id; }), name:null };
}
function prNew(autoplay){
  hrStop(); Score.ask('progressies');
  var mode = prS.mode === 'beide' ? hrRnd(['maj','min']) : prS.mode, q;
  if (prS.src === 'bekend'){
    var list = PR_FAMOUS.filter(function(f){ return f.m === mode; });
    var prevName = prQ.name, f = hrRnd(list.filter(function(x){ return x.n !== prevName; }));
    q = { ids:f.c.slice(), name:f.n };
  }
  var changed = hrNewKey(prQ, prS, mode);
  if (!q) q = prMake(mode);
  prQ.ids = q.ids; prQ.name = q.name; prQ.ans = []; prQ.answered = false; prQ.mode = mode;
  prQ.voices = hrVoiceAll(prQ.T, q.ids.map(function(id){ return hrCh(mode, id); }));
  prQ.cadPending = prS.cadQ || changed;
  if (prS.first) prQ.ans.push(q.ids[0]);
  $('prKeyName').textContent = hrKeyName(prQ.pc, mode);
  var msg = $('prMsg'); msg.className = 'qmsg'; msg.textContent = changed ? 'Toonsoort: ' + hrKeyName(prQ.pc, mode) + '.' : '';
  prRenderPad(); prRenderSlots();
  if (autoplay) prPlayQ();
}
function prPlayQ(){
  if (!prQ || !prQ.voices) return;
  Score.heard('progressies');
  var go = function(){ hrPlay(prQ.voices, { bpm:prS.bpm, inst:prS.inst, onChord:prHi, onEnd:function(){ prHi(-1); } }); };
  if (prQ.cadPending){
    prQ.cadPending = false; hrStop(); ensureCtx();
    var mode = prQ.mode, T = prQ.T + 12, d = Engine.cadence(actx.currentTime + .08, T, mode, { inst:prS.inst });
    hrTimers.push(setTimeout(go, d * 1000 + 150));
  } else go();
}
function prPlayCad(){ if (!prQ || prQ.T == null) return; hrStop(); ensureCtx(); Engine.cadence(actx.currentTime + .08, prQ.T + 12, prQ.mode, { inst:prS.inst }); }
function prHi(i){ document.querySelectorAll('#prSlots .hrslot').forEach(function(s, j){ s.classList.toggle('play', j === i); }); }
function prPadIds(){
  var mode = prQ.mode;
  if (prS.src !== 'bekend') return prPool(mode).slice();
  var ids = []; PR_FAMOUS.forEach(function(f){ if (f.m === mode) f.c.forEach(function(id){ if (ids.indexOf(id) < 0) ids.push(id); }); });
  var order = HR_CH[mode].map(function(c){ return c.id; });
  return ids.sort(function(a, b){ return order.indexOf(a) - order.indexOf(b); });
}
function prAnswer(id){
  if (!prQ || !prQ.ids) return;
  var mode = prQ.mode;
  if (prQ.answered){ prHear(id); return; }
  var i = prQ.ans.length; if (i >= prQ.ids.length) return;
  prQ.ans.push(id);
  // geen geluid bij het invullen (wens gebruiker 19-11): anders hoor je meteen of je keuze klopt. Na het nakijken kun je elk akkoord wel beluisteren.
  prRenderSlots();
  if (prQ.ans.length === prQ.ids.length) prFinish();
}
function prWis(){ if (!prQ || prQ.answered) return; if (prQ.ans.length > (prS.first ? 1 : 0)){ prQ.ans.pop(); prRenderSlots(); } }
function prHear(id){
  var mode = prQ.mode, c = hrCh(mode, id); if (!c) return;
  hrStop(); ensureCtx(); var v = hrVoice(prQ.T, c, null), t = actx.currentTime + .03;
  Engine.note(t, v.bass, 1, { inst:prS.inst, vol:.28 }); v.up.forEach(function(m){ Engine.note(t, m, 1, { inst:prS.inst, vol:.18 }); });
}
function prFinish(){
  prQ.answered = true;
  var mode = prQ.mode, start = prS.first ? 1 : 0, rows = [], okAll = true;
  var qtxt = hrKeyName(prQ.pc, mode) + ': ' + prQ.ids.map(function(x){ return hrCh(mode, x).rn; }).join(' – ');
  for (var i = start; i < prQ.ids.length; i++){ var ok = prQ.ans[i] === prQ.ids[i]; if (!ok) okAll = false; rows.push({ k:mode + ':' + prQ.ids[i], q:qtxt, a:hrCh(mode, prQ.ans[i]).rn, ok:ok }); }
  Score.log('progressies', rows);
  prScore.total++; if (okAll){ prScore.right++; prScore.streak++; } else prScore.streak = 0;
  $('prRight').textContent = prScore.right; $('prTotal').textContent = prScore.total; $('prStreak').textContent = prScore.streak; $('prToday').textContent = Score.today('progressies');
  var msg = $('prMsg'); msg.className = 'qmsg ' + (okAll ? 'good' : 'bad');
  var chain = prQ.ids.map(function(x){ var c = hrCh(mode, x); return c.rn + ' (' + hrSym(prQ.pc, mode, c) + ')'; }).join(' – ');
  msg.innerHTML = (okAll ? 'Goed! ' : 'Juist was: ') + chain + (prQ.name ? '. Dit is de <b>' + prQ.name + '</b>.' : '.') + (okAll ? '' : ' Klik op een vakje of een knop om een akkoord te horen.');
  prRenderSlots(); prRenderStats();
  var end = hrPlay(prQ.voices, { bpm:prS.bpm, inst:prS.inst, onChord:prHi, onEnd:function(){ prHi(-1); } });
  if (okAll && prS.auto) hrTimers.push(setTimeout(function(){ prNew(true); }, Math.max(400, (end - actx.currentTime) * 1000 + 700)));
}
function prRenderSlots(){
  var mode = prQ.mode, box = $('prSlots');
  box.innerHTML = prQ.ids.map(function(id, i){
    var a = prQ.ans[i], cls = 'hrslot', inner;
    if (a == null){ inner = '<b>?</b><small></small>'; if (i === prQ.ans.length && !prQ.answered) cls += ' cur'; }
    else {
      var c = hrCh(mode, a), given = prS.first && i === 0;
      if (prQ.answered && !given) cls += a === id ? ' right' : ' wrong';
      if (given) cls += ' given';
      inner = '<b>' + c.rn + '</b><small>' + (prQ.answered && a !== id ? hrCh(mode, id).rn + ' · ' + hrSym(prQ.pc, mode, hrCh(mode, id)) : (prQ.answered || given ? hrSym(prQ.pc, mode, c) : '')) + '</small>';
    }
    return '<button type="button" class="' + cls + '" data-i="' + i + '">' + inner + '</button>';
  }).join('');
  box.querySelectorAll('.hrslot').forEach(function(b){ b.onclick = function(){ b.blur(); var i = +b.dataset.i; if (prQ.answered) prHear(prQ.ids[i]); }; });
}
function prKeyFor(c){ return c.sec || c.bor || c.hide ? '' : (c.sev ? '⇧' : '') + (c.step + 1); }
function prRenderPad(){
  var mode = prQ.mode, ids = prPadIds(), groups = [['T','Tonica'], ['S','Subdominant'], ['D','Dominant']];
  $('prPad').innerHTML = groups.map(function(g){
    var cs = ids.map(function(id){ return hrCh(mode, id); }).filter(function(c){ return c && c.fn === g[0]; });
    if (!cs.length) return '';
    return '<div class="prgrp"><span class="prfn">' + g[1] + '</span><div class="prbtns">' + cs.map(function(c){
      var k = prKeyFor(c);
      return '<button type="button" class="prbtn fn' + c.fn + '" data-id="' + c.id + '"><strong>' + c.rn + '</strong><small>' + hrSym(prQ.pc, mode, c) + '</small>' + (k ? '<kbd>' + k + '</kbd>' : '') + '</button>';
    }).join('') + '</div></div>';
  }).join('');
  $('prPad').querySelectorAll('.prbtn').forEach(function(b){ b.onclick = function(){ b.blur(); prAnswer(b.dataset.id); }; });
}
function prRenderStats(){ $('prStats').innerHTML = hrStatsHTML('progressies', function(k){ var p = k.split(':'), c = hrCh(p[0], p.slice(1).join(':')); return (p[0] === 'maj' ? 'Majeur' : 'Mineur') + ' · ' + (c ? c.rn : k); }, 'Nog geen antwoorden. Het akkoord dat je het vaakst mist komt bovenaan en komt ook vaker terug.'); }
function prChipsHTML(mode){ return HR_CH[mode].filter(function(c){ return !c.hide; }).map(function(c){ return '<label class="chip"><input type="checkbox" data-m="' + mode + '" value="' + c.id + '"> ' + c.rn + '</label>'; }).join(''); }
function prSyncUI(){
  $('prLevel').value = prS.level; $('prMode').value = prS.mode; $('prSrc').value = prS.src;
  hrKeySel($('prKey'), prS, prS.mode);
  $('prKeyEvery').value = String(prS.keyEvery); $('prLen').value = String(prS.len); $('prBpm').value = String(prS.bpm); $('prInst').value = prS.inst;
  $('prEndI').checked = prS.endI; $('prFirst').checked = prS.first; $('prCadQ').checked = prS.cadQ; $('prAuto').checked = prS.auto;
  document.querySelectorAll('#prChipsMaj input, #prChipsMin input').forEach(function(inp){ inp.checked = prPool(inp.dataset.m).indexOf(inp.value) >= 0; });
  $('prView').classList.toggle('bekend', prS.src === 'bekend');
}
function prMatchLevel(){
  if (prS.src === 'bekend'){ prS.level = prS.mode === 'beide' ? 'p10' : 'eigen'; $('prLevel').value = prS.level; return; }
  var L = PR_LEVELS.find(function(l){ return !l.src && l.mode === prS.mode && l.pool.slice().sort().join() === prPool(prS.mode).slice().sort().join(); });
  prS.level = L ? L.id : 'eigen'; $('prLevel').value = prS.level;
}
function prInit(){
  prLoad(); prQ = { pc:null, mode:null, sinceKey:0 };
  $('prLevel').innerHTML = PR_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie</option>';
  $('prLen').innerHTML = [3,4,5,6,7,8].map(function(n){ return '<option value="' + n + '">' + n + ' akkoorden</option>'; }).join('');
  $('prChipsMaj').innerHTML = prChipsHTML('maj'); $('prChipsMin').innerHTML = prChipsHTML('min');
  gehBpmFill($('prBpm')); hrInstOpts($('prInst'));
  if (GEH_BPMS.indexOf(prS.bpm) < 0) prS.bpm = 60;
  prSyncUI();
  var ch = function(renew){ prSave(); if (renew) prNew(false); };
  $('prLevel').onchange = function(e){ var L = PR_LEVELS.find(function(l){ return l.id === e.target.value; }); prS.level = e.target.value;
    if (L){ prS.mode = L.mode; prS.src = L.src || 'vrij'; if (L.pool){ if (L.mode === 'maj') prS.poolMaj = L.pool.slice(); else prS.poolMin = L.pool.slice(); } }
    prQ.pc = null; prSyncUI(); ch(true); };
  $('prMode').onchange = function(e){ prS.mode = e.target.value; prQ.pc = null; hrKeySel($('prKey'), prS, prS.mode); prMatchLevel(); ch(true); };
  $('prSrc').onchange = function(e){ prS.src = e.target.value; prSyncUI(); prMatchLevel(); ch(true); };
  ['prChipsMaj','prChipsMin'].forEach(function(id){ $(id).onchange = function(e){
    var m = e.target.dataset.m, set = []; document.querySelectorAll('#' + id + ' input:checked').forEach(function(i){ set.push(i.value); });
    if (set.length < 2){ prSyncUI(); return; }
    if (m === 'maj') prS.poolMaj = set; else prS.poolMin = set; prMatchLevel(); ch(true); }; });
  $('prKey').onchange = function(e){ prS.key = e.target.value === 'rand' ? 'rand' : +e.target.value; prQ.pc = null; ch(true); };
  $('prKeyEvery').onchange = function(e){ prS.keyEvery = +e.target.value; ch(false); };
  $('prLen').onchange = function(e){ prS.len = +e.target.value; ch(true); };
  $('prBpm').onchange = function(e){ prS.bpm = +e.target.value; ch(false); };
  $('prInst').onchange = function(e){ prS.inst = e.target.value; ch(false); };
  $('prEndI').onchange = function(e){ prS.endI = e.target.checked; ch(true); };
  $('prFirst').onchange = function(e){ prS.first = e.target.checked; ch(true); };
  $('prCadQ').onchange = function(e){ prS.cadQ = e.target.checked; ch(false); };
  $('prAuto').onchange = function(e){ prS.auto = e.target.checked; ch(false); };
  document.querySelectorAll('#prView select, #prView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('prPlay').onclick = function(){ this.blur(); prPlayQ(); };
  $('prCad').onclick = function(){ this.blur(); prPlayCad(); };
  $('prWis').onclick = function(){ this.blur(); prWis(); };
  $('prNext').onclick = function(){ this.blur(); prNew(true); };
  $('prReset').onclick = function(){ Score.clear('progressies'); prRenderStats(); $('prToday').textContent = 0; };
  $('prToday').textContent = Score.today('progressies');
  prNew(false); prRenderStats();
}

/* ================= Baslijn (prefix bl): hoor een akkoordreeks, schrijf de bastonen op als trappen ================= */
var BL_SOL = { maj:['do','re','mi','fa','sol','la','ti'], min:['do','re','me','fa','sol','le','te'] };
var BL_LEVELS = [
  { id:'b1', name:'1 · I, IV en V (grondligging)',        mode:'maj', pool:['I','IV','V'],                       inv:false },
  { id:'b2', name:'2 · + ii en vi',                          mode:'maj', pool:['I','ii','IV','V','vi'],             inv:false },
  { id:'b3', name:'3 · alle drieklanken',                    mode:'maj', pool:['I','ii','iii','IV','V','vi','viio'], inv:false },
  { id:'b4', name:'4 · met omkeringen (I⁶, V⁶, ii⁶ …)',     mode:'maj', pool:['I','ii','IV','V','vi'],             inv:true },
  { id:'b5', name:'5 · mineur (grondligging)',               mode:'min', pool:['i','iv','V','VI','III','VII'],      inv:false },
  { id:'b6', name:'6 · mineur met omkeringen',               mode:'min', pool:['i','iio','iv','V','VI','III'],      inv:true }
];
var BL_KEY = 'baslijn-settings';
var blS = null, blQ = null, blScore = { right:0, total:0, streak:0 };
function blDefaults(){ return { level:'b1', mode:'maj', poolMaj:['I','IV','V'], poolMin:['i','iv','V','VI','III','VII'], inv:false, len:4, endI:true, first:true, cadQ:false, loud:true, key:'rand', keyEvery:5, bpm:60, inst:'piano', auto:true }; }
function blLoad(){ var s = {}; try { s = JSON.parse(localStorage.getItem(BL_KEY)) || {}; } catch(e){} blS = Object.assign(blDefaults(), s); ['poolMaj','poolMin'].forEach(function(k){ if (!Array.isArray(blS[k]) || blS[k].length < 2) blS[k] = blDefaults()[k]; }); }
function blSave(){ try { localStorage.setItem(BL_KEY, JSON.stringify(blS)); } catch(e){} }
function blPool(mode){ return mode === 'maj' ? blS.poolMaj : blS.poolMin; }
function blDeg(c, inv){ return (c.step + (inv ? 2 * inv : 0)) % 7; }   // trap van de bastoon (0 = do)
function blFig(c, inv){ return c.rn + (inv === 1 ? '⁶' : inv === 2 ? '⁶₄' : ''); }
Score.def('baslijn', {
  name:'Baslijn', view:'baslijn',
  label:function(k){ var p = k.split(':'); return (p[0] === 'maj' ? 'majeur' : 'mineur') + ' · bas op ' + (+p[1] + 1) + ' (' + BL_SOL[p[0]][+p[1]] + ')'; },
  level:function(){ return blS.level + '|' + blS.len + (blS.inv ? '|inv' : ''); },
  levelName:function(lv){ var p = lv.split('|'), L = BL_LEVELS.find(function(l){ return l.id === p[0]; }); return (L ? 'niveau ' + L.name : 'eigen selectie') + ', ' + p[1] + ' akkoorden'; },
  next:function(lv){ var p = lv.split('|'), i = BL_LEVELS.findIndex(function(l){ return l.id === p[0]; }); return +p[1] < 6 ? 'langere reeksen (' + (+p[1] + 1) + ' akkoorden)' : i >= 0 && i < BL_LEVELS.length - 1 ? 'niveau ' + BL_LEVELS[i + 1].name : 'ga door naar Akkoordprogressies'; }
});
function blMake(mode){
  var pool = blPool(mode).map(function(id){ return hrCh(mode, id); }).filter(Boolean), tally = Score.tally('baslijn', 20);
  var tonic = hrCh(mode, mode === 'maj' ? 'I' : 'i'), out = [{ c:tonic, inv:0 }], n = Math.max(2, blS.len);
  for (var i = 1; i < n; i++){
    var prev = out[i - 1];
    if (i === n - 1 && blS.endI){ out.push({ c:tonic, inv:0 }); break; }
    var cands = pool.filter(function(c){ return c.id !== prev.c.id && !(blS.endI && i === n - 2 && c.id === tonic.id); });
    if (!cands.length) cands = pool;
    var row = PR_FN[prev.c.fn] || PR_FN.T;
    var c = hrPickW(cands, function(x){ return (row[x.fn] || 1) * hrErrW(tally, mode + ':' + x.step); });
    var inv = 0;
    if (blS.inv && c.q !== 'dim'){   // omkering als de bas dan kleiner springt (een vloeiende baslijn), soms ook zomaar
      var pd = blDeg(prev.c, prev.inv), d0 = Math.abs(blDeg(c, 0) - pd), d1 = Math.abs(blDeg(c, 1) - pd);
      d0 = Math.min(d0, 7 - d0); d1 = Math.min(d1, 7 - d1);
      if (d1 < d0 ? Math.random() < .75 : Math.random() < .2) inv = 1;
    } else if (blS.inv && c.q === 'dim') inv = 1;   // vii° en ii° staan bijna altijd als sextakkoord
    if (inv && blDeg(c, inv) === blDeg(prev.c, prev.inv)) inv = 0;   // geen bas die blijft liggen: dan liever grondligging
    out.push({ c:c, inv:inv });
  }
  return out;
}
function blNew(autoplay){
  hrStop(); Score.ask('baslijn');
  var mode = blS.mode, changed = hrNewKey(blQ, blS, mode);
  var seq = blMake(mode), prev = null;
  blQ.seq = seq; blQ.mode = mode; blQ.ans = []; blQ.answered = false;
  blQ.voices = seq.map(function(x){ var v = hrVoice(blQ.T, x.c, prev, x.inv); prev = v.up; return v; });
  blQ.cadPending = blS.cadQ || changed;
  if (blS.first) blQ.ans.push(blDeg(seq[0].c, seq[0].inv));
  $('blKeyName').textContent = hrKeyName(blQ.pc, mode);
  var msg = $('blMsg'); msg.className = 'qmsg'; msg.textContent = changed ? 'Toonsoort: ' + hrKeyName(blQ.pc, mode) + '.' : '';
  blRenderPad(); blRenderSlots();
  if (autoplay) blPlayQ();
}
function blPlayQ(){
  if (!blQ || !blQ.voices) return;
  Score.heard('baslijn');
  var go = function(){ hrPlay(blQ.voices, { bpm:blS.bpm, inst:blS.inst, bassVol:blS.loud ? .5 : .3, onChord:blHi, onEnd:function(){ blHi(-1); } }); };
  if (blQ.cadPending){ blQ.cadPending = false; hrStop(); ensureCtx(); var d = Engine.cadence(actx.currentTime + .08, blQ.T + 12, blQ.mode, { inst:blS.inst }); hrTimers.push(setTimeout(go, d * 1000 + 150)); }
  else go();
}
function blPlayBass(){   // alleen de baslijn, zonder akkoorden
  if (!blQ || !blQ.voices) return;
  hrStop(); ensureCtx(); var t = actx.currentTime + .08, d = 60 / blS.bpm;
  blQ.voices.forEach(function(v, i){ Engine.note(t + i * d, v.bass, d * .95, { inst:blS.inst, vol:.5 }); var ii = i; hrTimers.push(setTimeout(function(){ blHi(ii); }, (t + i * d - actx.currentTime) * 1000)); });
  hrTimers.push(setTimeout(function(){ blHi(-1); }, (t + blQ.voices.length * d - actx.currentTime) * 1000 + 200));
}
function blHi(i){ document.querySelectorAll('#blSlots .hrslot').forEach(function(s, j){ s.classList.toggle('play', j === i); }); }
function blAnswer(d){
  if (!blQ || !blQ.seq) return;
  var mode = blQ.mode;
  if (blQ.answered){ hrStop(); ensureCtx(); Engine.note(actx.currentTime + .03, blQ.T + HR_CH[mode].find(function(c){ return c.step === d && !c.sev && !c.bor && !c.sec && !c.hide; }).semi, .9, { inst:blS.inst, vol:.5 }); return; }
  var i = blQ.ans.length; if (i >= blQ.seq.length) return;
  blQ.ans.push(d);
  hrStop(); ensureCtx();
  var ref = blQ.voices[i].bass, base = blQ.T + [0,2,4,5,7,9,11][d] - (mode === 'min' && [2,5,6].indexOf(d) >= 0 ? 1 : 0);
  while (base < ref - 6) base += 12; while (base > ref + 6) base -= 12;
  Engine.note(actx.currentTime + .03, base, .5, { inst:blS.inst, vol:.45 });
  blRenderSlots();
  if (blQ.ans.length === blQ.seq.length) blFinish();
}
function blWis(){ if (!blQ || blQ.answered) return; if (blQ.ans.length > (blS.first ? 1 : 0)){ blQ.ans.pop(); blRenderSlots(); } }
function blFinish(){
  blQ.answered = true;
  var mode = blQ.mode, start = blS.first ? 1 : 0, rows = [], okAll = true;
  var qtxt = hrKeyName(blQ.pc, mode) + ': ' + blQ.seq.map(function(x){ return blFig(x.c, x.inv); }).join(' – ');
  for (var i = start; i < blQ.seq.length; i++){ var want = blDeg(blQ.seq[i].c, blQ.seq[i].inv), ok = blQ.ans[i] === want; if (!ok) okAll = false; rows.push({ k:mode + ':' + want, q:qtxt, a:BL_SOL[mode][blQ.ans[i]], ok:ok }); }
  Score.log('baslijn', rows);
  blScore.total++; if (okAll){ blScore.right++; blScore.streak++; } else blScore.streak = 0;
  $('blRight').textContent = blScore.right; $('blTotal').textContent = blScore.total; $('blStreak').textContent = blScore.streak; $('blToday').textContent = Score.today('baslijn');
  var msg = $('blMsg'); msg.className = 'qmsg ' + (okAll ? 'good' : 'bad');
  msg.innerHTML = (okAll ? 'Goed! ' : 'Juist was: ') + blQ.seq.map(function(x){ var d = blDeg(x.c, x.inv); return (d + 1) + ' ' + blSolOf(x); }).join(' – ') +
    '. Akkoorden: ' + blQ.seq.map(function(x){ return blFig(x.c, x.inv); }).join(' – ') + '.' + (okAll ? '' : ' Met ▶ Alleen de bas hoor je de baslijn los.');
  blRenderSlots(); blRenderStats();
  var end = hrPlay(blQ.voices, { bpm:blS.bpm, inst:blS.inst, bassVol:blS.loud ? .5 : .3, onChord:blHi, onEnd:function(){ blHi(-1); } });
  if (okAll && blS.auto) hrTimers.push(setTimeout(function(){ blNew(true); }, Math.max(400, (end - actx.currentTime) * 1000 + 700)));
}
// solmisatie van de bastoon: V⁶ in mineur heeft de verhoogde leidtoon in de bas (ti, niet te)
function blSolOf(x){ var d = blDeg(x.c, x.inv); if (blQ.mode === 'min' && d === 6 && x.c.id === 'V') return 'ti'; return BL_SOL[blQ.mode][d]; }
function blRenderSlots(){
  var mode = blQ.mode, box = $('blSlots');
  box.innerHTML = blQ.seq.map(function(x, i){
    var want = blDeg(x.c, x.inv), a = blQ.ans[i], cls = 'hrslot', inner, given = blS.first && i === 0;
    if (a == null){ inner = '<b>?</b><small></small>'; if (i === blQ.ans.length && !blQ.answered) cls += ' cur'; }
    else {
      if (blQ.answered && !given) cls += a === want ? ' right' : ' wrong';
      if (given) cls += ' given';
      inner = '<b>' + (a + 1) + '</b><small>' + (blQ.answered ? (a !== want ? 'was ' + (want + 1) + ' · ' : '') + blFig(x.c, x.inv) : BL_SOL[mode][a]) + '</small>';
    }
    return '<button type="button" class="' + cls + '" data-i="' + i + '">' + inner + '</button>';
  }).join('');
  box.querySelectorAll('.hrslot').forEach(function(b){ b.onclick = function(){ b.blur(); var i = +b.dataset.i; if (!blQ.answered) return; hrStop(); ensureCtx(); var v = blQ.voices[i], t = actx.currentTime + .03; Engine.note(t, v.bass, 1, { inst:blS.inst, vol:.45 }); v.up.forEach(function(m){ Engine.note(t, m, 1, { inst:blS.inst, vol:.16 }); }); }; });
}
function blRenderPad(){
  var mode = blQ.mode;
  $('blPad').innerHTML = [0,1,2,3,4,5,6].map(function(d){ return '<button type="button" class="gbtn" data-d="' + d + '">' + (d + 1) + '<small>' + BL_SOL[mode][d] + '</small></button>'; }).join('');
  $('blPad').querySelectorAll('.gbtn').forEach(function(b){ b.onclick = function(){ b.blur(); blAnswer(+b.dataset.d); }; });
}
function blRenderStats(){ $('blStats').innerHTML = hrStatsHTML('baslijn', function(k){ var p = k.split(':'); return (p[0] === 'maj' ? 'Majeur' : 'Mineur') + ' · bas op ' + (+p[1] + 1) + ' (' + BL_SOL[p[0]][+p[1]] + ')'; }, 'Nog geen antwoorden. De bastoon die je het vaakst mist komt bovenaan en komt vaker terug.'); }
function blChipsHTML(mode){ return HR_CH[mode].filter(function(c){ return !c.hide && !c.sev && !c.sec; }).map(function(c){ return '<label class="chip"><input type="checkbox" data-m="' + mode + '" value="' + c.id + '"> ' + c.rn + '</label>'; }).join(''); }
function blSyncUI(){
  $('blLevel').value = blS.level; $('blMode').value = blS.mode; hrKeySel($('blKey'), blS, blS.mode);
  $('blKeyEvery').value = String(blS.keyEvery); $('blLen').value = String(blS.len); $('blBpm').value = String(blS.bpm); $('blInst').value = blS.inst;
  $('blInv').checked = blS.inv; $('blEndI').checked = blS.endI; $('blFirst').checked = blS.first; $('blCadQ').checked = blS.cadQ; $('blLoud').checked = blS.loud; $('blAuto').checked = blS.auto;
  document.querySelectorAll('#blChipsMaj input, #blChipsMin input').forEach(function(inp){ inp.checked = blPool(inp.dataset.m).indexOf(inp.value) >= 0; });
}
function blMatchLevel(){
  var L = BL_LEVELS.find(function(l){ return l.mode === blS.mode && l.inv === blS.inv && l.pool.slice().sort().join() === blPool(blS.mode).slice().sort().join(); });
  blS.level = L ? L.id : 'eigen'; $('blLevel').value = blS.level;
}
function blInit(){
  blLoad(); blQ = { pc:null, mode:null, sinceKey:0 };
  $('blLevel').innerHTML = BL_LEVELS.map(function(l){ return '<option value="' + l.id + '">' + l.name + '</option>'; }).join('') + '<option value="eigen">eigen selectie</option>';
  $('blLen').innerHTML = [3,4,5,6,7,8].map(function(n){ return '<option value="' + n + '">' + n + ' akkoorden</option>'; }).join('');
  $('blChipsMaj').innerHTML = blChipsHTML('maj'); $('blChipsMin').innerHTML = blChipsHTML('min');
  gehBpmFill($('blBpm')); hrInstOpts($('blInst')); if (GEH_BPMS.indexOf(blS.bpm) < 0) blS.bpm = 60;
  blSyncUI();
  var ch = function(renew){ blSave(); if (renew) blNew(false); };
  $('blLevel').onchange = function(e){ var L = BL_LEVELS.find(function(l){ return l.id === e.target.value; }); blS.level = e.target.value;
    if (L){ blS.mode = L.mode; blS.inv = L.inv; if (L.mode === 'maj') blS.poolMaj = L.pool.slice(); else blS.poolMin = L.pool.slice(); } blQ.pc = null; blSyncUI(); ch(true); };
  $('blMode').onchange = function(e){ blS.mode = e.target.value; blQ.pc = null; hrKeySel($('blKey'), blS, blS.mode); blMatchLevel(); ch(true); };
  ['blChipsMaj','blChipsMin'].forEach(function(id){ $(id).onchange = function(e){ var m = e.target.dataset.m, set = []; document.querySelectorAll('#' + id + ' input:checked').forEach(function(i){ set.push(i.value); }); if (set.length < 2){ blSyncUI(); return; } if (m === 'maj') blS.poolMaj = set; else blS.poolMin = set; blMatchLevel(); ch(true); }; });
  $('blKey').onchange = function(e){ blS.key = e.target.value === 'rand' ? 'rand' : +e.target.value; blQ.pc = null; ch(true); };
  $('blKeyEvery').onchange = function(e){ blS.keyEvery = +e.target.value; ch(false); };
  $('blLen').onchange = function(e){ blS.len = +e.target.value; ch(true); };
  $('blBpm').onchange = function(e){ blS.bpm = +e.target.value; ch(false); };
  $('blInst').onchange = function(e){ blS.inst = e.target.value; ch(false); };
  $('blInv').onchange = function(e){ blS.inv = e.target.checked; blMatchLevel(); ch(true); };
  [['blEndI','endI',true],['blFirst','first',true],['blCadQ','cadQ',false],['blLoud','loud',false],['blAuto','auto',false]].forEach(function(x){ $(x[0]).onchange = function(e){ blS[x[1]] = e.target.checked; ch(x[2]); }; });
  document.querySelectorAll('#blView select, #blView input').forEach(function(el){ el.addEventListener('change', function(){ el.blur(); }); });
  $('blPlay').onclick = function(){ this.blur(); blPlayQ(); };
  $('blBass').onclick = function(){ this.blur(); blPlayBass(); };
  $('blWis').onclick = function(){ this.blur(); blWis(); };
  $('blNext').onclick = function(){ this.blur(); blNew(true); };
  $('blReset').onclick = function(){ Score.clear('baslijn'); blRenderStats(); $('blToday').textContent = 0; };
  $('blToday').textContent = Score.today('baslijn');
  blNew(false); blRenderStats();
}

/* --- route en toetsen --- */
var HR_VIEWS = ['cadensen','progressies','baslijn'];
function hrOnRoute(){ if (typeof view !== 'undefined' && HR_VIEWS.indexOf(view) < 0) hrStop(); }
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || HR_VIEWS.indexOf(view) < 0) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (Keys.is(e, 'stop')){ hrStop(); return; }
  if (Keys.blocked(e)) return;
  if (view === 'cadensen'){
    if (!cdQ) return;
    if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) cdPlayQ(); }
    else if (Keys.is(e, 'volgende')){ e.preventDefault(); cdNew(true); }
    else if (/^[1-9]$/.test(e.key)){ var t = CD_TYPES.find(function(x){ return x.key === e.key; }); if (t && cdS.types.indexOf(t.id) >= 0) cdAnswer(t.id); }
    return;
  }
  if (view === 'baslijn'){
    if (!blQ) return;
    if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) blPlayQ(); }
    else if (Keys.is(e, 'volgende')){ e.preventDefault(); if (blQ.answered) blNew(true); }
    else if (Keys.is(e, 'wis')){ e.preventDefault(); blWis(); }
    else if (Keys.is(e, 'cadens')) blPlayCad();
    else if (e.key === 'b' || e.key === 'B') blPlayBass();
    else if (/^[1-7]$/.test(e.key)) blAnswer(+e.key - 1);
    return;
  }
  if (!prQ) return;
  if (Keys.is(e, 'luister')){ e.preventDefault(); if (!e.repeat) prPlayQ(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); if (prQ.answered) prNew(true); }
  else if (Keys.is(e, 'wis')){ e.preventDefault(); prWis(); }
  else if (Keys.is(e, 'cadens')) prPlayCad();
  else {
    var m = /^Digit([1-7])$/.exec(e.code); if (!m) return;
    var step = +m[1] - 1, sev = e.shiftKey, mode = prQ.mode;
    var c = prPadIds().map(function(id){ return hrCh(mode, id); }).find(function(x){ return x.step === step && !x.sec && !x.bor && !x.hide && !!x.sev === sev; });
    if (c){ e.preventDefault(); prAnswer(c.id); }
  }
});
document.addEventListener('keyup', function(e){ if (typeof view !== 'undefined' && HR_VIEWS.indexOf(view) >= 0 && (e.key === ' ' || e.code === 'Space')) e.preventDefault(); });
function blPlayCad(){ if (!blQ || blQ.T == null) return; hrStop(); ensureCtx(); Engine.cadence(actx.currentTime + .08, blQ.T + 12, blQ.mode, { inst:blS.inst }); }
cdInit(); prInit(); blInit();
