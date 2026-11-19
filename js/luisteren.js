/* ================= Luisteren (quiz) ================= */
const QUIZ_DEFAULT = ['basis','zestienden','gepunteerd','syncopen','triolen'];
let quiz = null, QVF = null;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let sub = 'mc';
const statMod = () => sub === 'dict' ? 'ritmedictee' : 'ritmequiz';
function loadStats(){ return Score.tally(statMod()); }        // {sectie:{r,t}} uit het gedeelde logboek
const secName = id => (SECTIONS.find(x => x.id === id) || { title:id }).title;
const chipIds = box => [...document.querySelectorAll('#' + box + ' input:checked')].map(i => i.value).sort();
const chipNext = (lv, what) => { const n = SECTIONS.find(s => !lv.split('|')[0].split(',').includes(s.id)); return n ? 'zet ook “' + n.title + '” aan' : what; };
Score.def('ritmequiz', { name:'Ritme herkennen', view:'luisteren', label:secName,
  level:() => chipIds('qChips').join(',') + '|' + $('qN').value,
  levelName:lv => lv.split('|')[0].split(',').length + ' categorieën, ' + lv.split('|')[1] + ' keuzes',
  next:lv => chipNext(lv, 'meer keuzes of wisselend tempo') });
Score.def('ritmedictee', { name:'Ritmedictee', view:'luisteren', label:secName,
  level:() => chipIds('dChips').join(',') + '|' + $('dLen').value,
  levelName:lv => lv.split('|')[0].split(',').length + ' categorieën, ' + lv.split('|')[1] + ' tellen',
  next:lv => chipNext(lv, 'meer tellen of een hoger tempo') });
function sig(c){
  // what you actually hear: attack times, note lengths, layer, and the metronome grid
  return [...c.notes, ...c.lowNotes].filter(n => n.attack).map(n => n.layer[0] + (c.lead + n.play).toFixed(3) + ':' + n.len.toFixed(3)).join('|')
    + '#' + c.seg + '/' + c.tempoUnit + '/' + (c.pulses ? c.pulses.join(',') : (c.pulse || 1));
}
const shapeOf = c => [c.seg, c.tempoUnit, c.lower ? 1 : 0].join('/');
function cloneCell(c){ const x = { ...c }; delete x.card; analyse(x); x.sig = c.sig; return x; }

function setupQuiz(VF){
  QVF = VF;
  const chips = $('qChips');
  SECTIONS.forEach(sec => {
    const l = document.createElement('label'); l.className = 'chip';
    l.innerHTML = `<input type="checkbox" value="${sec.id}" ${QUIZ_DEFAULT.includes(sec.id) ? 'checked' : ''}> ${sec.title}`;
    chips.appendChild(l);
  });
  chips.onchange = () => newQuestion(false);
  $('qN').onchange = $('qSame').onchange = $('qVary').onchange = $('qVaryAmt').onchange = () => newQuestion(false);
  setupVary('q');
  $('qPlay').onclick = playQuestion;
  $('qNext').onclick = () => newQuestion(true);
  $('qReset').onclick = () => { Score.clear(statMod()); renderStats(); };
  quiz = { right:0, total:0, streak:0 };
  document.querySelectorAll('#quizView .subtabs button').forEach(b => b.onclick = () => setSub(b.dataset.sub));
  setupDict();
  setSub('mc', true);
  document.querySelector('[data-back="luisteren"]').onclick = lBoard;
  newQuestion(false);
}
// overzicht (alleen de tegels) ↔ oefening; bij elk bezoek aan #luisteren eerst het overzicht
function lBoard(){ stop(); $('quizView').classList.add('board'); document.querySelectorAll('#quizView .subtabs button').forEach(b => b.classList.remove('on')); }
function lOnRoute(){ if (typeof view !== 'undefined' && view === 'luisteren') lBoard(); }
function setSub(s, keepBoard){
  stop(); sub = s;
  if (!keepBoard){ $('quizView').classList.remove('board'); window.scrollTo(0, 0); }
  $('quizView').classList.toggle('sub-mc', s === 'mc');
  $('quizView').classList.toggle('sub-dict', s === 'dict');
  if (!keepBoard) document.querySelectorAll('#quizView .subtabs button').forEach(b => b.classList.toggle('on', b.dataset.sub === s));
  $('statTitle').textContent = s === 'mc' ? 'Per categorie (meerkeuze)' : 'Per categorie (dictee, per tel)';
  renderStats();
}

function newQuestion(autoplay){
  stop(); Score.ask('ritmequiz');
  const ids = [...document.querySelectorAll('#qChips input:checked')].map(i => i.value);
  const chosen = ids.length ? ids : ['basis'];
  const n = +$('qN').value, same = $('qSame').checked;
  const all = SECTIONS.flatMap(s => s.cells);
  const pool = all.filter(c => chosen.includes(c.sec));
  let target = null, others = [];
  for (let tries = 0; tries < 60 && !target; tries++){
    const t = pick(pool), sh = shapeOf(t);
    const ok = c => shapeOf(c) === sh && c.sig !== t.sig;
    const tiers = [all.filter(c => c.sec === t.sec && ok(c)), pool.filter(c => c.sec !== t.sec && ok(c)), all.filter(ok)];
    if (!same) tiers.unshift(pool.filter(ok));
    const seen = new Set([t.sig]); const picked = [];
    for (const tier of tiers) for (const c of shuffle(tier)){
      if (picked.length >= n - 1) break;
      if (!seen.has(c.sig)){ seen.add(c.sig); picked.push(c); }
    }
    if (picked.length >= n - 1){ target = t; others = picked; }
  }
  if (!target){ $('qMsg').textContent = 'Te weinig ritmes om uit te kiezen — vink meer categorieën aan.'; return; }

  const base = +$('bpm').value;
  const bpm = $('qVary').checked ? varyBpm(base, 'q') : base;
  quiz.target = target; quiz.bpm = bpm; quiz.answered = false;
  quiz.qCell = cloneCell(target);
  quiz.options = shuffle([target, ...others]).map(cloneCell);

  const panel = document.querySelector('.quiz');
  panel.classList.remove('answered');
  $('qMsg').className = 'qmsg';
  $('qMsg').textContent = $('qVary').checked ? `Tempo: ${bpm}` : '';
  const grid = $('qGrid'); grid.innerHTML = '';
  quiz.options.forEach((opt, i) => {
    const card = makeCard(QVF, opt, grid);
    const num = document.createElement('span'); num.className = 'num'; num.textContent = i + 1;
    card.appendChild(num);
    card.onclick = () => quiz.answered ? play([opt], { loop:false, bpm: quiz.bpm }) : answer(i);
  });
  if (autoplay) playQuestion();
}

function playQuestion(){ if (!quiz || !quiz.qCell) return; if (!quiz.answered) Score.heard('ritmequiz'); play([quiz.qCell], { loop:false, bpm: quiz.bpm }); }

function answer(i){
  if (!quiz || quiz.answered) return;
  quiz.answered = true;
  const opts = quiz.options, ok = opts[i].sig === quiz.target.sig;
  const ri = opts.findIndex(o => o.sig === quiz.target.sig);
  quiz.total++; if (ok){ quiz.right++; quiz.streak++; } else quiz.streak = 0;
  $('qRight').textContent = quiz.right; $('qTotal').textContent = quiz.total; $('qStreak').textContent = quiz.streak;
  Score.log('ritmequiz', { k:quiz.target.sec, q:quiz.target.title + ' @' + quiz.bpm, a:opts[i].title, ok });
  renderStats();
  opts[ri].card.classList.add('right');
  if (!ok) opts[i].card.classList.add('wrong');
  document.querySelector('.quiz').classList.add('answered');
  const secTitle = SECTIONS.find(x => x.id === quiz.target.sec).title;
  const m = $('qMsg');
  m.className = 'qmsg ' + (ok ? 'good' : 'bad');
  m.textContent = ok
    ? `Goed! Het was “${quiz.target.title}” (${secTitle}).`
    : `Helaas. Het juiste antwoord was ${ri + 1}: “${quiz.target.title}” (${secTitle}). Klik op de opties om ze te vergelijken.`;
}

function renderStats(){
  const stats = loadStats(), box = $('qStats');
  const rows = SECTIONS.filter(s => stats[s.id] && stats[s.id].t).map(s => ({ s, ...stats[s.id], p: stats[s.id].r / stats[s.id].t }));
  rows.sort((a, b) => a.p - b.p);
  box.innerHTML = rows.length ? rows.map(r => `<div class="stat"><div class="row"><span>${r.s.title}</span><span>${r.r}/${r.t} · ${Math.round(r.p*100)}%</span></div><div class="barbg"><div class="barfg" style="width:${r.p*100}%"></div></div></div>`).join('')
    : '<p class="note">Nog geen antwoorden. De zwakste categorie komt hier straks bovenaan.</p>';
}

document.addEventListener('keydown', e => {
  if (view !== 'luisteren' || sub !== 'mc' || !quiz || Keys.blocked(e) || $('quizView').classList.contains('board')) return;
  if (Keys.is(e, 'luister')){ e.preventDefault(); playQuestion(); }
  else if (Keys.is(e, 'volgende')){ e.preventDefault(); newQuestion(true); }
  else if (/^[1-6]$/.test(e.key) && quiz.options && +e.key <= quiz.options.length){
    if (!quiz.answered) answer(+e.key - 1); else play([quiz.options[+e.key - 1]], { loop:false, bpm: quiz.bpm });
  }
});


/* ================= Luisteren: dictee ================= */
const DICT_DEFAULT = ['basis','zestienden','gepunteerd','triolen'];
let dict = null;
function setupDict(){
  const chips = $('dChips');
  RANDOM_SECTIONS.forEach(id => {
    const sec = SECTIONS.find(s => s.id === id);
    const l = document.createElement('label'); l.className = 'chip';
    l.innerHTML = `<input type="checkbox" value="${id}" ${DICT_DEFAULT.includes(id) ? 'checked' : ''}> ${sec.title}`;
    chips.appendChild(l);
  });
  chips.onchange = () => { buildPalette(); newDict(false); };
  $('dLen').onchange = () => newDict(false);
  $('dVary').onchange = $('dVaryAmt').onchange = () => newDict(false);
  setupVary('d');
  $('dPlay').onclick = playDict;
  $('dCheck').onclick = checkDict;
  $('dMine').onclick = playMine;
  $('dNext').onclick = () => newDict(true);
  dict = { right:0, total:0, perfect:0 };
  buildPalette();
  newDict(false);
}
function dictPool(){
  const ids = [...document.querySelectorAll('#dChips input:checked')].map(i => i.value);
  const chosen = ids.length ? ids : ['basis'];
  const seen = new Set(), pool = [];
  chosen.forEach(id => SECTIONS.find(s => s.id === id).cells.forEach(c => {
    if (c.beats !== 1 || c.time || c.lower || c.pulses || c.lead || c.swing || c.tempoUnit !== 1) return;
    if (seen.has(c.sig)) return;
    seen.add(c.sig); pool.push(c);
  }));
  return pool;
}
function drawMini(cell, el){
  const c = cloneCell(cell);
  const box = document.createElement('div'); box.className = 'mini';
  el.appendChild(box);
  try { drawCell(QVF, c, box); } catch(e){ box.textContent = cell.title; }
  return c;
}
function buildPalette(){
  const pal = $('dPalette'); pal.innerHTML = '';
  const pool = dictPool();
  SECTIONS.forEach(sec => {
    const items = pool.filter(c => c.sec === sec.id);
    if (!items.length) return;
    const h3 = document.createElement('h3'); h3.textContent = sec.title; pal.appendChild(h3);
    const g = document.createElement('div'); g.className = 'pgrid'; pal.appendChild(g);
    items.forEach(c => {
      const it = document.createElement('div'); it.className = 'pitem'; it.title = c.title;
      drawMini(c, it);
      it.onclick = () => chooseDict(c);
      g.appendChild(it);
    });
  });
}
function newDict(autoplay){
  stop(); Score.ask('ritmedictee');
  const pool = dictPool(), len = +$('dLen').value;
  if (pool.length < 2){ $('dMsg').className = 'qmsg'; $('dMsg').textContent = 'Kies meer categorieën.'; return; }
  const target = []; let last = null;
  for (let i = 0; i < len; i++){
    let c = pick(pool);
    for (let k = 0; k < 6 && c === last; k++) c = pick(pool);
    target.push(c); last = c;
  }
  const base = +$('bpm').value;
  Object.assign(dict, {
    target, answer: Array(len).fill(null), sel: 0, checked: false, len,
    bpm: $('dVary').checked ? varyBpm(base, 'd') : base
  });
  $('dictPanel').classList.remove('checked');
  $('dMsg').className = 'qmsg';
  $('dMsg').textContent = $('dVary').checked ? `Tempo: ${dict.bpm}` : '';
  renderSlots();
  if (autoplay) playDict();
}
function makeBars(cells){
  const per = cells.length === 2 ? 2 : 4, bars = [];
  for (let b = 0; b * per < cells.length; b++){
    const groups = [];
    cells.slice(b * per, b * per + per).forEach(c => {
      if (!c) groups.push(G(['qr']));
      else c.groups.forEach(g => groups.push(G(g.t, g.tup, g.beam || c.beam || null)));
    });
    const bar = { title:'Maat ' + (b+1), time: b === 0 ? (per === 2 ? '2/4' : '4/4') : null, pulse:1, bar:per, groups };
    analyse(bar); bars.push(bar);
  }
  return bars;
}
function playDict(){ if (dict && dict.target && !dict.checked) Score.heard('ritmedictee'); if (dict && dict.target) play(makeBars(dict.target), { loop:false, bpm: dict.bpm }); }
function playMine(){ if (dict && dict.answer) play(makeBars(dict.answer), { loop:false, bpm: dict.bpm }); }
function slotLabel(i){ return dict.len === 8 ? `Maat ${Math.floor(i/4) + 1} · tel ${i % 4 + 1}` : `Tel ${i + 1}`; }
function renderSlots(){
  const box = $('dSlots'); box.innerHTML = '';
  box.classList.toggle('n2', dict.len === 2);
  dict.target.forEach((t, i) => {
    const s = document.createElement('div');
    s.className = 'slot' + (!dict.checked && i === dict.sel ? ' sel' : '');
    s.innerHTML = `<div class="sl">${slotLabel(i)}</div>`;
    const a = dict.answer[i];
    if (a) drawMini(a, s); else { const q = document.createElement('div'); q.className = 'q'; q.textContent = '?'; s.appendChild(q); }
    if (dict.checked){
      const ok = a && a.sig === t.sig;
      s.classList.add(ok ? 'right' : 'wrong');
      if (!ok){ const f = document.createElement('div'); f.className = 'fix'; f.innerHTML = '<div class="sl">Juist:</div>'; drawMini(t, f); s.appendChild(f); }
    }
    s.onclick = () => {
      if (dict.checked){ play([cloneCell(t)], { loop:false, bpm: dict.bpm, countin:false }); return; }
      dict.sel = i; renderSlots();
    };
    box.appendChild(s);
  });
}
function chooseDict(c){
  if (!dict || dict.checked) return;
  dict.answer[dict.sel] = c;
  if ($('dPreview').checked) play([cloneCell(c)], { loop:false, bpm: dict.bpm, countin:false, metro:false });
  // jump to the next empty beat
  const n = dict.len;
  for (let k = 1; k <= n; k++){ const j = (dict.sel + k) % n; if (!dict.answer[j]){ dict.sel = j; break; } }
  renderSlots();
}
function checkDict(){
  if (!dict) return;
  if (dict.checked){ newDict(true); return; }
  dict.checked = true;
  let ok = 0;
  const qtxt = dict.target.map(t => t.title).join(' | ');
  Score.log('ritmedictee', dict.target.map((t, i) => {
    const good = !!(dict.answer[i] && dict.answer[i].sig === t.sig);
    if (good) ok++;
    return { k:t.sec, q:qtxt + ' (tel ' + (i + 1) + ')', a:dict.answer[i] ? dict.answer[i].title : '–', ok:good };
  }));
  renderStats();
  dict.right += ok; dict.total += dict.len; if (ok === dict.len) dict.perfect++;
  $('dRight').textContent = dict.right; $('dTotal').textContent = dict.total; $('dPerfect').textContent = dict.perfect;
  $('dictPanel').classList.add('checked');
  const m = $('dMsg');
  m.className = 'qmsg ' + (ok === dict.len ? 'good' : 'bad');
  m.textContent = ok === dict.len ? `Foutloos! ${ok} van ${dict.len} tellen goed.` : `${ok} van ${dict.len} tellen goed. Klik op een tel om het juiste ritme te horen, of vergelijk met ▶ Mijn antwoord.`;
  renderSlots();
}
document.addEventListener('keydown', e => {
  if (view !== 'luisteren' || sub !== 'dict' || !dict || !dict.target || $('quizView').classList.contains('board')) return;
  if (Keys.blocked(e)) return;
  const act = a => Keys.is(e, a);
  if (act('luister')){ e.preventDefault(); playDict(); }
  else if (!dict.checked && act('controleer')){ e.preventDefault(); checkDict(); }
  else if (dict.checked && act('volgende')){ e.preventDefault(); newDict(true); }
  else if (!dict.checked && act('volgende')){ e.preventDefault(); dict.sel = (dict.sel + 1) % dict.len; renderSlots(); }
  else if (!dict.checked && act('vorige')){ e.preventDefault(); dict.sel = (dict.sel - 1 + dict.len) % dict.len; renderSlots(); }
  else if (!dict.checked && act('wis')){ e.preventDefault(); dict.answer[dict.sel] = null; renderSlots(); }
});

