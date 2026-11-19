/* ================= Notenlezen → Termen-quiz (prefix tm, route #termen → #tmView) — 16-11-2026 =================
   Termen komen uit de gedeelde theorie (Theorie.TERMS: 'Term | betekenis', één regel per term) plus de eigen termen van de gebruiker
   (localStorage 'termen-eigen' = [{id, t, b, c}], te beheren onderaan de pagina; gaat mee in de back-up).
   Vraag: term → betekenis, betekenis → term of door elkaar; 4 keuzes (toetsen 1–4), afleiders bij voorkeur uit dezelfde categorie.
   Score 'termen', k = 't:' + term in kleine letters. */
var TM_KEY = 'termen-settings', TM_OWN = 'termen-eigen';
var tmS = null, tmQ = null, tmScore = { right:0, total:0, streak:0 }, tmEdit = null, tmDel = null;
function tmDefaults(){ return { cats:Theorie.TERM_CATS.map(function(c){ return c[0]; }), dir:'tb', auto:true }; }
function tmLoad(){ var s = {}; try { s = JSON.parse(localStorage.getItem(TM_KEY)) || {}; } catch(e){} tmS = Object.assign(tmDefaults(), s); if (!Array.isArray(tmS.cats) || !tmS.cats.length) tmS.cats = tmDefaults().cats; }
function tmSave(){ try { localStorage.setItem(TM_KEY, JSON.stringify(tmS)); } catch(e){} }
function tmOwn(){ try { var a = JSON.parse(localStorage.getItem(TM_OWN)); return Array.isArray(a) ? a : []; } catch(e){ return []; } }
function tmOwnSave(a){ try { localStorage.setItem(TM_OWN, JSON.stringify(a)); } catch(e){} }
function tmAll(){ return Theorie.TERMS.map(function(x){ return { t:x.t, b:x.b, c:x.c }; }).concat(tmOwn().map(function(x){ return { t:x.t, b:x.b, c:x.c || 'eigen', own:x.id }; })); }
function tmK(x){ return 't:' + x.t.toLowerCase(); }
function tmCatName(c){ var f = Theorie.TERM_CATS.find(function(x){ return x[0] === c; }); return f ? f[1] : c; }
function tmEsc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
Score.def('termen', {
  name:'Termen', view:'termen',
  label:function(k){ return k.replace(/^t:/, ''); },
  level:function(){ return tmS.dir + '|' + tmS.cats.slice().sort().join(','); },
  levelName:function(lv){ var p = lv.split('|'); return (p[0] === 'tb' ? 'term → betekenis' : p[0] === 'bt' ? 'betekenis → term' : 'door elkaar') + ' · ' + (p[1] || '').split(',').length + ' onderwerpen'; },
  next:function(lv){ var p = lv.split('|'); return p[0] === 'tb' ? 'andersom: betekenis → term' : p[0] === 'bt' ? 'door elkaar' : 'meer onderwerpen, of zet je eigen termen erbij'; }
});
function tmPool(){ return tmAll().filter(function(x){ return tmS.cats.indexOf(x.c) >= 0 || (x.own && tmS.cats.indexOf('eigen') >= 0 && Theorie.TERM_CATS.every(function(c){ return c[0] !== x.c; })); }); }
var tmTimer = null;
function tmNew(){
  clearTimeout(tmTimer); Score.ask('termen'); Score.heard('termen');
  var pool = tmPool(), all = tmAll(), msg = $('tmMsg');
  if (pool.length < 2){ $('tmAsk').innerHTML = '<span class="muted">Te weinig termen gekozen. Zet meer onderwerpen aan onder 🕹️ Instellingen.</span>'; $('tmOpts').innerHTML = ''; tmQ = null; return; }
  var tally = Score.tally('termen', 10), prev = tmQ && tmQ.x ? tmQ.x.t : null;
  var cand = pool.filter(function(x){ return x.t !== prev; });
  var x = hrPickW(cand, function(y){ return hrErrW(tally, tmK(y)); });
  var dir = tmS.dir === 'mix' ? (Math.random() < .5 ? 'tb' : 'bt') : tmS.dir;
  var same = all.filter(function(y){ return y.t !== x.t && y.c === x.c && y.b !== x.b; }), other = all.filter(function(y){ return y.t !== x.t && y.c !== x.c && y.b !== x.b; });
  var shuffle = function(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var wrong = shuffle(same).slice(0, 3); if (wrong.length < 3) wrong = wrong.concat(shuffle(other).slice(0, 3 - wrong.length));
  tmQ = { x:x, dir:dir, opts:shuffle([x].concat(wrong)), answered:false };
  $('tmCat').textContent = tmCatName(x.c) + (x.own ? ' · eigen term' : '');
  $('tmAsk').innerHTML = dir === 'tb' ? '<span class="tmterm">' + tmEsc(x.t) + '</span><small>Wat betekent dit?</small>' : '<span class="tmmean">' + tmEsc(x.b) + '</span><small>Welke term hoort hierbij?</small>';
  $('tmOpts').innerHTML = tmQ.opts.map(function(o, i){ return '<button type="button" class="tmopt" data-i="' + i + '"><kbd>' + (i + 1) + '</kbd><span>' + tmEsc(dir === 'tb' ? o.b : o.t) + '</span></button>'; }).join('');
  $('tmOpts').querySelectorAll('.tmopt').forEach(function(b){ b.onclick = function(){ b.blur(); tmAnswer(+b.dataset.i); }; });
  msg.className = 'qmsg'; msg.textContent = '';
}
function tmAnswer(i){
  if (!tmQ || tmQ.answered){ if (tmQ && tmQ.answered) tmNew(); return; }
  var o = tmQ.opts[i]; if (!o) return;
  tmQ.answered = true;
  var ok = o.t === tmQ.x.t, x = tmQ.x;
  Score.log('termen', [{ k:tmK(x), q:tmQ.dir === 'tb' ? x.t : x.b, a:tmQ.dir === 'tb' ? o.b : o.t, ok:ok }]);
  tmScore.total++; if (ok){ tmScore.right++; tmScore.streak++; } else tmScore.streak = 0;
  $('tmRight').textContent = tmScore.right; $('tmTotal').textContent = tmScore.total; $('tmStreak').textContent = tmScore.streak; $('tmToday').textContent = Score.today('termen');
  document.querySelectorAll('#tmOpts .tmopt').forEach(function(b, j){ var y = tmQ.opts[j]; b.classList.toggle('right', y.t === x.t); b.classList.toggle('wrong', !ok && j === i); });
  var msg = $('tmMsg'); msg.className = 'qmsg ' + (ok ? 'good' : 'bad');
  msg.innerHTML = (ok ? 'Goed! ' : 'Niet goed. ') + '<b>' + tmEsc(x.t) + '</b> = ' + tmEsc(x.b) + '.' + (!ok ? ' (Jij koos: ' + tmEsc(o.t) + ' = ' + tmEsc(o.b) + '.)' : '');
  tmRenderStats();
  if (ok && tmS.auto){ var q0 = tmQ; tmTimer = setTimeout(function(){ if (view === 'termen' && tmQ === q0) tmNew(); }, 1100); }
}
function tmRenderStats(){ $('tmStats').innerHTML = hrStatsHTML('termen', function(k){ return k.replace(/^t:/, ''); }, 'Nog geen antwoorden. De termen die je het vaakst mist komen bovenaan en vaker terug.'); }
/* --- lijst + eigen termen --- */
function tmRenderList(){
  var q = ($('tmSearch').value || '').trim().toLowerCase(), cat = $('tmListCat').value, all = tmAll();
  var rows = all.filter(function(x){ return (cat === 'alle' || x.c === cat || (cat === 'eigen' && x.own)) && (!q || (x.t + ' ' + x.b).toLowerCase().indexOf(q) >= 0); });
  $('tmCount').textContent = rows.length + ' van ' + all.length + ' termen · ' + tmOwn().length + ' eigen';
  $('tmList').innerHTML = rows.length ? '<table class="tmtab"><thead><tr><th>Term</th><th>Betekenis</th><th>Onderwerp</th><th></th></tr></thead><tbody>' + rows.map(function(x){
    return '<tr' + (x.own ? ' class="own"' : '') + '><td><b>' + tmEsc(x.t) + '</b></td><td>' + tmEsc(x.b) + '</td><td class="muted">' + tmEsc(tmCatName(x.c)) + (x.own ? ' · eigen' : '') + '</td><td class="tmact">' +
      (x.own ? '<button type="button" data-ed="' + x.own + '" title="Aanpassen">✎</button><button type="button" data-del="' + x.own + '" title="Weghalen">' + (tmDel === x.own ? 'Zeker?' : '✕') + '</button>' : '') + '</td></tr>';
  }).join('') + '</tbody></table>' : '<p class="muted">Geen termen gevonden.</p>';
  $('tmList').querySelectorAll('[data-ed]').forEach(function(b){ b.onclick = function(){ var o = tmOwn().find(function(x){ return x.id === b.dataset.ed; }); if (!o) return; tmEdit = o.id; $('tmNewT').value = o.t; $('tmNewB').value = o.b; $('tmNewC').value = o.c || 'eigen'; $('tmAdd').textContent = 'Opslaan'; $('tmCancel').hidden = false; $('tmNewT').focus(); }; });
  $('tmList').querySelectorAll('[data-del]').forEach(function(b){ b.onclick = function(){
    var id = b.dataset.del;
    if (tmDel !== id){ tmDel = id; tmRenderList(); setTimeout(function(){ if (tmDel === id){ tmDel = null; tmRenderList(); } }, 4000); return; }
    tmOwnSave(tmOwn().filter(function(x){ return x.id !== id; })); tmDel = null; tmFormMsg('Weggehaald.'); tmRenderList();
  }; });
}
function tmFormMsg(t, bad){ var m = $('tmFormMsg'); m.textContent = t; m.className = 'tmformmsg ' + (bad ? 'bad' : 'good'); }
function tmSubmit(){
  var t = $('tmNewT').value.trim(), b = $('tmNewB').value.trim(), c = $('tmNewC').value;
  if (!t || !b){ tmFormMsg('Vul een term én een betekenis in.', true); return; }
  var own = tmOwn(), lower = t.toLowerCase();
  var dupBuilt = Theorie.TERMS.some(function(x){ return x.t.toLowerCase() === lower; });
  var dupOwn = own.find(function(x){ return x.t.toLowerCase() === lower && x.id !== tmEdit; });
  if (dupBuilt || dupOwn){ tmFormMsg('"' + t + '" staat al in de lijst.', true); return; }
  if (tmEdit){ own.forEach(function(x){ if (x.id === tmEdit){ x.t = t; x.b = b; x.c = c; } }); tmFormMsg('Aangepast: ' + t + '.'); }
  else { own.push({ id:'e' + Date.now().toString(36), t:t, b:b, c:c }); tmFormMsg('Toegevoegd: ' + t + '. Hij doet meteen mee in de quiz.'); }
  tmOwnSave(own); tmCancelEdit(); tmRenderList();
  if (c === 'eigen' && tmS.cats.indexOf('eigen') < 0){ tmS.cats.push('eigen'); tmSave(); tmSyncUI(); }
}
function tmCancelEdit(){ tmEdit = null; $('tmNewT').value = ''; $('tmNewB').value = ''; $('tmAdd').textContent = '＋ Toevoegen'; $('tmCancel').hidden = true; }
function tmSyncUI(){
  $('tmDir').value = tmS.dir; $('tmAuto').checked = tmS.auto;
  document.querySelectorAll('#tmChips input').forEach(function(i){ i.checked = tmS.cats.indexOf(i.value) >= 0; });
  var n = tmPool().length; $('tmPoolN').textContent = n + ' termen in de quiz';
}
function tmInit(){
  tmLoad();
  var cats = Theorie.TERM_CATS;
  $('tmChips').innerHTML = cats.map(function(c){ return '<label class="chip"><input type="checkbox" value="' + c[0] + '"> ' + c[1] + '</label>'; }).join('');
  $('tmNewC').innerHTML = cats.map(function(c){ return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join(''); $('tmNewC').value = 'eigen';
  $('tmListCat').innerHTML = '<option value="alle">alle onderwerpen</option>' + cats.map(function(c){ return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('');
  tmSyncUI();
  $('tmChips').onchange = function(){ var set = []; document.querySelectorAll('#tmChips input:checked').forEach(function(i){ set.push(i.value); }); if (!set.length){ tmSyncUI(); return; } tmS.cats = set; tmSave(); tmSyncUI(); tmNew(); };
  $('tmDir').onchange = function(e){ tmS.dir = e.target.value; tmSave(); tmNew(); };
  $('tmAuto').onchange = function(e){ tmS.auto = e.target.checked; tmSave(); };
  $('tmNext').onclick = function(){ this.blur(); tmNew(); };
  $('tmAdd').onclick = function(){ this.blur(); tmSubmit(); };
  $('tmCancel').onclick = function(){ this.blur(); tmCancelEdit(); };
  [$('tmNewT'), $('tmNewB')].forEach(function(el){ el.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Enter'){ e.preventDefault(); tmSubmit(); } else if (e.key === 'Escape'){ tmCancelEdit(); } }); });
  $('tmSearch').addEventListener('keydown', function(e){ e.stopPropagation(); });
  $('tmSearch').oninput = tmRenderList; $('tmListCat').onchange = tmRenderList;
  $('tmReset').onclick = function(){ Score.clear('termen'); tmRenderStats(); $('tmToday').textContent = 0; };
  $('tmToday').textContent = Score.today('termen');
  tmNew(); tmRenderStats(); tmRenderList();
}
function tmOnRoute(){ if (typeof view !== 'undefined' && view === 'termen'){ tmSyncUI(); tmRenderList(); } }
document.addEventListener('keydown', function(e){
  if (typeof view === 'undefined' || view !== 'termen') return;
  if (e.ctrlKey || e.metaKey || e.altKey || Keys.blocked(e)) return;
  if (Keys.is(e, 'volgende')){ e.preventDefault(); tmNew(); }
  else if (/^[1-4]$/.test(e.key) && tmQ){ e.preventDefault(); if (tmQ.answered) tmNew(); else tmAnswer(+e.key - 1); }
});
tmInit();
