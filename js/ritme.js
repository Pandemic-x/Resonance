/* ================= Timing ================= */
const BASE = { h:2, q:1, '8':.5, '16':.25, '32':.125 };
function parseTok(tok){
  if (tok === '|') return { bar:true, beats:0 };
  const m = /^(h|q|8|16|32)(d*)(r?)(~?)$/.exec(tok);
  if (!m) throw new Error('bad token ' + tok);
  const dots = m[2].length;
  return { base:m[1], dots, rest:!!m[3], tie:!!m[4], beats: BASE[m[1]] * (dots===0?1: dots===1?1.5:1.75) };
}
function parseGroups(groups, layer, swing){
  const notes = []; let t = 0, prevTie = false;
  for (const g of groups){
    const mult = g.tup ? g.tup[1]/g.tup[0] : 1;
    for (const tok of g.t){
      const p = parseTok(tok);
      if (p.bar){ notes.push({ ...p, start:t, attack:false, layer }); continue; }
      const attack = !p.rest && !prevTie;
      let play = t;
      if (swing === '8'  && Math.abs((t % 1) - .5) < 1e-6) play = t - .5 + 2/3;
      if (swing === '16' && Math.abs((t % .5) - .25) < 1e-6) play = t - .25 + 1/3;
      notes.push({ ...p, start:t, play, attack, layer, dur: p.beats * mult });
      t += p.beats * mult;
      prevTie = p.tie;
    }
  }
  // sounding length of each attack: its duration plus tied continuations, capped at the next attack
  const real = notes.filter(n => !n.bar);
  real.forEach((n, i) => {
    if (!n.attack) return;
    let len = n.dur, j = i;
    while (real[j].tie && real[j+1]){ j++; len += real[j].dur; }
    const next = real.slice(i+1).find(x => x.attack);
    const end = next ? next.play : t;
    n.len = Math.max(.05, Math.min(len, end - n.play));
  });
  return { notes, total: t };
}
function analyse(c){
  const up = parseGroups(c.groups, 'up', c.swing);
  c.notes = up.notes;
  let total = up.total;
  if (c.lower){ const lo = parseGroups(c.lower, 'low', c.swing); c.lowNotes = lo.notes; total = Math.max(total, lo.total); }
  else c.lowNotes = [];
  c.beats = Math.round(total*1000)/1000;
  c.lead = c.lead || 0;
  c.tempoUnit = c.tempoUnit || 1;
  // length of segment, rounded up to whole pulses (or bars for pulse lists)
  const unit = c.pulses ? c.bar : (c.pulse || 1);
  c.seg = Math.ceil((c.lead + c.beats) / unit - 1e-6) * unit;
}
function clickList(c, len){
  const out = [];
  if (c.pulses){
    for (let b = 0; b < len - 1e-6; b += c.bar) c.pulses.forEach((p,i) => { if (b+p < len - 1e-6) out.push([b+p, i===0 ? 'down' : 'metro']); });
  } else {
    const pulse = c.pulse || 1;
    for (let k = 0; k*pulse < len - 1e-6; k++){
      const t = k*pulse;
      const down = c.bar ? Math.abs(((t % c.bar) + c.bar) % c.bar) < 1e-6 : k === 0;
      out.push([t, down ? 'down' : 'metro']);
    }
  }
  return out;
}
function countInLen(c){
  if (c.pulses) return c.pulses.length < 3 ? 2*c.bar : c.bar;
  const pulse = c.pulse || 1;
  let n = c.bar ? Math.round(c.bar / pulse) : 4;
  if (n < 3) n *= 2;
  return n * pulse;
}

/* ================= Rendering ================= */
function render(){
  const VF = Vex.Flow;
  const main = document.getElementById('main'), nav = document.getElementById('nav');
  for (const sec of SECTIONS){
    const s = document.createElement('section'); s.id = sec.id;
    s.innerHTML = `<div class="sechead"><h2>${sec.title}</h2><p>${sec.desc}</p><button class="all">▶ Speel alles</button></div><div class="grid"></div>`;
    main.appendChild(s);
    const grid = s.querySelector('.grid');
    s.querySelector('.all').onclick = () => play(sec.cells);

    for (const cell of sec.cells){
      analyse(cell);
      cell.sec = sec.id; cell.sig = sig(cell);
      makeCard(VF, cell, grid);
    }
  }
  buildNav(nav);
  setupRandom(VF);
  setupQuiz(VF);
}

/* --- Atlas-menu: groepen bovenaan, categorieën van de actieve groep eronder; volgt het scrollen --- */
const NAV_GROUPS = [
  { t:'Basis',            ids:['basis','gepunteerd','syncopen'] },
  { t:'16en en 32en',     ids:['zestienden','zestienden-kort','tweeendertigsten','ladder'] },
  { t:'Triolen en n-olen', ids:['triolen','triolen-tel','kwintolen','sextolen','septolen'] },
  { t:'Swing',            ids:['swing'] },
  { t:'Maatsoorten',      ids:['samengesteld','alla-breve','oneven','hemiool'] },
  { t:'Polyritmes',       ids:['polyritmes'] }
];
const NAV_SHORT = { 'gepunteerd':'Gepunteerd', 'zestienden':'16en', 'zestienden-kort':'16en kort', 'tweeendertigsten':'32en',
  'ladder':'Subdivisie-ladder', 'triolen-tel':'Over de tel', 'kwintolen':'Kwintolen', 'sextolen':'Sextolen', 'septolen':'Septolen',
  'samengesteld':'6/8 · 9/8 · 12/8', 'alla-breve':'Alla breve, opmaat', 'oneven':'Oneven maten' };
function buildNav(nav){
  const known = new Set(NAV_GROUPS.flatMap(g => g.ids));
  const groups = NAV_GROUPS.map(g => ({ t:g.t, ids:g.ids.filter(id => SECTIONS.some(s => s.id === id)) })).filter(g => g.ids.length);
  const rest = SECTIONS.filter(s => !known.has(s.id)).map(s => s.id);
  if (rest.length) groups.push({ t:'Overig', ids:rest });
  nav.innerHTML = '<div class="navg"></div><div class="navs"></div>';
  const gRow = nav.firstChild, sRow = nav.lastChild;
  let curG = -1, curS = null, lock = 0;
  const go = id => { lock = Date.now() + 900; setActive(id); document.getElementById(id).scrollIntoView({ behavior:'smooth' }); };
  groups.forEach((g, i) => {
    const b = document.createElement('button'); b.textContent = g.t;
    b.onclick = () => go(g.ids[0]);
    gRow.appendChild(b);
  });
  function setActive(id){
    const gi = groups.findIndex(g => g.ids.includes(id));
    if (gi !== curG){
      curG = gi;
      [...gRow.children].forEach((b, i) => b.classList.toggle('on', i === gi));
      const g = groups[gi];
      sRow.innerHTML = '';
      sRow.style.display = g.ids.length > 1 ? '' : 'none';
      g.ids.forEach(sid => {
        const sec = SECTIONS.find(s => s.id === sid), b = document.createElement('button');
        b.textContent = NAV_SHORT[sid] || sec.title; b.title = sec.title; b.dataset.id = sid;
        b.onclick = () => go(sid);
        sRow.appendChild(b);
      });
    }
    curS = id;
    sRow.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  }
  setActive(groups[0].ids[0]);
  // scroll-spy: de categorie waarvan de kop net onder de kopbalk staat
  let raf = 0;
  window.addEventListener('scroll', () => {
    if (raf || typeof view === 'undefined' || view !== 'atlas' || Date.now() < lock) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const top = (document.querySelector('header') || {}).offsetHeight || 120;
      let id = SECTIONS[0].id;
      for (const s of SECTIONS){ const el = document.getElementById(s.id); if (el && el.getBoundingClientRect().top <= top + 40) id = s.id; }
      if (id !== curS) setActive(id);
    });
  }, { passive:true });
}

function makeCard(VF, cell, grid){
      const card = document.createElement('div'); card.className = 'card';
      const bt = cell.beats;
      let beatsTxt = cell.time ? cell.time : (bt === 1 ? '1 tel' : bt < 1 ? '½ tel' : bt + ' tellen');
      if (cell.time === 'C|') beatsTxt = '2/2';
      const tag = cell.swing ? '<span class="tag">swing</span>' : '';
      card.innerHTML = `<div class="t"><span>${cell.title}${tag}</span><span class="b">${beatsTxt}</span></div><div class="score"></div><div class="tl"></div>`;
      grid.appendChild(card);
      cell.card = card;
      let W = 200;
      try { W = drawCell(VF, cell, card.querySelector('.score')); }
      catch(e){ card.querySelector('.score').textContent = '(notatie mislukt)'; console.error(cell.title, e); }
      if (W > 640) card.style.gridColumn = '1 / -1';
      else if (W > 360) card.style.gridColumn = 'span 2';

      // timeline
      const tl = card.querySelector('.tl');
      if (cell.lowNotes.length) tl.classList.add('two');
      const total = Math.max(cell.beats, .5);
      clickList(cell, cell.seg).forEach(([p]) => {
        const x = p - cell.lead;
        if (x > 1e-6 && x < total - 1e-6){ const l = document.createElement('div'); l.className = 'bl'; l.style.left = (x/total*100) + '%'; tl.appendChild(l); }
      });
      [...cell.notes, ...cell.lowNotes].forEach(n => {
        if (!n.attack) return;
        const m = document.createElement('div'); m.className = 'm' + (n.layer === 'low' ? ' low' : '');
        m.style.left = `calc(${n.play/total*100}% + 2px)`; tl.appendChild(m);
        n.marker = m;
      });
      if (cell.labels){
        const syl = document.createElement('div'); syl.className = 'syl';
        syl.innerHTML = cell.labels.map((l,i) => `<span class="${cell.bits[i]?'a':''}">${l}</span>`).join('');
        card.appendChild(syl);
      }
      card.onclick = () => play([cell]);
      return card;
}

/* ================= Tikken: random generator ================= */
const RANDOM_SECTIONS = ['basis','zestienden','zestienden-kort','gepunteerd','syncopen','triolen','triolen-tel','kwintolen','sextolen','septolen','tweeendertigsten','ladder'];
const RANDOM_DEFAULT = ['basis','zestienden','gepunteerd','syncopen','triolen'];
let randomBars = [], nextBars = [], RVF = null;
function setupRandom(VF){
  RVF = VF;
  const panel = $('random');
  const chips = panel.querySelector('.chips');
  RANDOM_SECTIONS.forEach(id => {
    const sec = SECTIONS.find(s => s.id === id);
    const l = document.createElement('label'); l.className = 'chip';
    l.innerHTML = `<input type="checkbox" value="${id}" ${RANDOM_DEFAULT.includes(id) ? 'checked' : ''}> ${sec.title}`;
    chips.appendChild(l);
  });
  const refresh = () => { stop(); randomBars = genBars(); nextBars = genBars(); showBars(); };
  chips.onchange = refresh;
  $('rBars').onchange = refresh;
  $('rNew').onclick = () => { refresh(); playRandom(); };
  $('rPlay').onclick = playRandom;
  $('rShow').onclick = () => panel.classList.remove('hide');
  $('rListen').onchange = e => panel.classList.toggle('hide', e.target.checked);
  const tv = () => {
    const m = $('rTempo').value;
    $('random').classList.toggle('twissel', m === 'wissel');
    $('random').classList.toggle('top', m === 'op');
    if (!state) showBpm();
  };
  $('rTempo').onchange = tv;
  // instelbare plus-min voor wisselend tempo, onthouden in deze browser
  try { const sv = JSON.parse(localStorage.getItem('ritme-atlas-vary')) || {}; if (sv.r) $('rVaryAmt').value = sv.r; } catch(e){}
  $('rVaryAmt').onchange = () => {
    const a = Math.min(100, Math.max(1, Math.round(+$('rVaryAmt').value) || 20));
    $('rVaryAmt').value = a;
    let sv = {}; try { sv = JSON.parse(localStorage.getItem('ritme-atlas-vary')) || {}; } catch(e){}
    sv.r = a; try { localStorage.setItem('ritme-atlas-vary', JSON.stringify(sv)); } catch(e){}
    if (!state) showBpm();
  };
  $('bpm').addEventListener('input', () => { if (!state) showBpm(); });
  ['rMin','rMax'].forEach(id => $(id).addEventListener('input', () => { if (!state) showBpm(); }));
  tv();
  $('tapPad').addEventListener('pointerdown', e => { e.preventDefault(); doTap(); });
  $('tapCal').onclick = () => { $('tapCal').blur(); calibrate(); };
  showCalib(); tapSummary(false);
  $('rCont').onchange = () => panel.classList.toggle('cont', $('rCont').checked);
  panel.classList.toggle('cont', $('rCont').checked);
  refresh();
}
let rRound = 0;
function showBpm(b){
  const base = +$('bpm').value, mode = $('rTempo').value;
  if (b != null){ $('rBpm').textContent = `♩ = ${b}`; return; }
  if (mode === 'wissel'){ const a = Math.min(100, Math.max(1, Math.round(+$('rVaryAmt').value) || 20)); $('rBpm').textContent = `♩ = ${Math.max(30, base - a)}–${Math.min(240, base + a)}`; }
  else if (mode === 'op'){ $('rBpm').textContent = `♩ = ${$('rMin').value} → ${$('rMax').value}`; }
  else $('rBpm').textContent = `♩ = ${base}`;
}
function roundBpm(){
  const base = +$('bpm').value, mode = $('rTempo').value;
  const clamp = v => Math.min(240, Math.max(30, v || 30));
  let lo = clamp(+$('rMin').value), hi = clamp(+$('rMax').value);
  if (lo > hi) [lo, hi] = [hi, lo];
  let b = base;
  if (mode === 'wissel'){ const a = Math.min(100, Math.max(1, Math.round(+$('rVaryAmt').value) || 20)); const l = Math.max(30, base - a), h = Math.min(240, base + a); b = Math.round(l + Math.random() * (h - l)); }
  if (mode === 'op') b = Math.min(hi, lo + 4 * rRound);  // climbs from min, then stays at max
  showBpm(b);
  return b;
}
function roundLabel(){
  const N = +$('rRounds').value;
  $('rProg').textContent = N ? `ronde ${rRound + 1} / ${N}` : `ronde ${rRound + 1}`;
}
function playRandom(){
  rRound = 0;
  $('doneBox').classList.remove('on');
  const first = roundBpm();
  roundLabel();
  const N = +$('rRounds').value;
  const advance = () => {
    if (N && rRound + 1 >= N) return null;   // finite mode: stop after N rounds
    rRound++;
    roundLabel();
    if ($('rCont').checked){
      // what was "hierna" becomes "nu", and a fresh set is generated
      randomBars = nextBars; nextBars = genBars(); showBars();
    }
    return { cells: randomBars, bpm: roundBpm() };
  };
  const repeat = $('rCont').checked || $('loop').checked;
  const gv = $('rGap').value;
  const tracked = $('tapOn').checked;
  play(randomBars, { loop:false, bpm: first, next: (repeat || N !== 1) ? advance : null, track: tracked, gap: gv && gv[0] !== 'r' ? gv.split(',').map(Number) : null, rand: gv && gv[0] === 'r' ? +gv.slice(1) / 100 : 0,
    onDone: () => showDone(tracked) });
}
function genBars(){
  const chosen = [...$('random').querySelectorAll('.chips input:checked')].map(i => i.value);
  const ids = chosen.length ? chosen : ['basis'];
  const pool = [];
  ids.forEach(id => SECTIONS.find(s => s.id === id).cells.forEach(c => {
    if (c.time || c.lower || c.pulses || c.lead || c.swing || c.tempoUnit !== 1) return;
    if (![0.5,1,2,3,4].includes(c.beats)) return;
    pool.push(c);
  }));
  const halves = pool.filter(c => c.beats === .5);
  const nBars = +$('rBars').value;
  const bars = [];
  let last = null;
  // pick, avoiding the cell that was just used so the variations keep changing
  const pickNew = arr => { let c = pick(arr); for (let k = 0; k < 6 && c === last && arr.length > 1; k++) c = pick(arr); last = c; return c; };
  for (let b = 0; b < nBars; b++){
    let rem = 4; const groups = [];
    const addCell = c => c.groups.forEach(g => groups.push(G(g.t, g.tup, g.beam || c.beam || null)));
    let guard = 0;
    while (rem > 0 && guard++ < 50){
      const opts = pool.filter(c => c.beats <= rem && c.beats >= 1);
      if (halves.length && (!opts.length || Math.random() < halves.length / (pool.length || 1))){
        addCell(pickNew(halves)); addCell(pickNew(halves)); rem -= 1; continue;
      }
      if (!opts.length){ groups.push(G(['q'])); rem -= 1; continue; }
      const ones = opts.filter(x => x.beats === 1);
      const c = (ones.length && Math.random() < .65) ? pickNew(ones) : pickNew(opts);
      addCell(c); rem -= c.beats;
    }
    const bar = { title:'Maat ' + (b+1), time: b === 0 ? '4/4' : null, pulse:1, bar:4, groups };
    analyse(bar);
    bars.push(bar);
  }
  return bars;
}
function showBars(){
  const draw = (cells, grid) => {
    grid.innerHTML = '';
    cells.forEach(c => { const card = makeCard(RVF, c, grid); if (card.style.gridColumn !== '1 / -1') card.style.gridColumn = 'span 2'; });
  };
  draw(randomBars, $('rNow'));
  draw(nextBars, $('rNext'));
  $('random').classList.toggle('hide', $('rListen').checked);
}

function buildVoice(VF, groups, notes, opt){
  const all = [], tuplets = [], beamSets = [];
  let i = 0;
  const perGroup = groups.some(g => g.beam || g.t[0] === '|');
  for (const g of groups){
    const gnotes = [];
    for (const tok of g.t){
      const nd = notes[i++];
      let sn;
      if (nd.bar) sn = new VF.BarNote();
      else {
        const key = nd.rest ? opt.restKey : opt.key;
        sn = new VF.StaveNote({ keys:[key], duration: nd.base + 'd'.repeat(nd.dots) + (nd.rest ? 'r' : ''), stem_direction: opt.dir, auto_stem:false });
        for (let d = 0; d < nd.dots; d++) VF.Dot.buildAndAttach([sn], { all:true });
        gnotes.push(sn);
      }
      nd.vf = sn; all.push(sn);
    }
    if (g.tup) tuplets.push(new VF.Tuplet(gnotes, { num_notes:g.tup[0], notes_occupied:g.tup[1], ratioed:false, location: opt.dir < 0 ? -1 : 1 }));
    if (perGroup && gnotes.length) beamSets.push([gnotes, g.beam || opt.beam]);
  }
  if (!perGroup) beamSets.push([all.filter(n => !(n instanceof VF.BarNote)), opt.beam]);
  return { all, tuplets, beamSets };
}

function drawCell(VF, cell, el){
  const twoV = cell.lowNotes.length > 0;
  const n = Math.max(cell.notes.length, cell.lowNotes.length);
  const extra = cell.time ? 34 : 0;
  const W = Math.max(150, 70 + n * (twoV ? 34 : 30) + extra), H = twoV ? 140 : 120;
  const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
  renderer.resize(W, H);
  const ctx = renderer.getContext();
  const stave = new VF.Stave(0, 0, W - 1, { space_above_staff_ln: 4 });
  if (cell.time) stave.addTimeSignature(cell.time);
  stave.setContext(ctx).draw();

  const beamSpec = cell.beam ? (Array.isArray(cell.beam[0]) ? cell.beam : [cell.beam]) : [[1,4]];
  const layers = [];
  layers.push(buildVoice(VF, cell.groups, cell.notes, twoV ? { key:'c/5', restKey:'d/5', dir:1, beam:beamSpec } : { key:'b/4', restKey:'b/4', dir:1, beam:beamSpec }));
  if (twoV) layers.push(buildVoice(VF, cell.lower, cell.lowNotes, { key:'f/4', restKey:'e/4', dir:-1, beam:beamSpec }));

  const voices = layers.map(L => { const v = new VF.Voice({ num_beats:4, beat_value:4 }).setMode(VF.Voice.Mode.SOFT); v.addTickables(L.all); return v; });
  const beams = [];
  layers.forEach((L, li) => L.beamSets.forEach(([notes, spec]) => {
    const groups = (Array.isArray(spec[0]) ? spec : [spec]).map(([a,b]) => new VF.Fraction(a,b));
    VF.Beam.generateBeams(notes, { groups, stem_direction: li ? -1 : 1, beam_rests:true, beam_middle_only:true }).forEach(b => {
      // a beam with only one sounding note looks wrong: drop it so the note gets a flag
      const bn = b.getNotes ? b.getNotes() : b.notes;
      const sounding = bn.filter(n => !n.isRest());
      if (sounding.length < 2) bn.forEach(n => { if (n.setBeam) n.setBeam(undefined); else n.beam = undefined; });
      else beams.push(b);
    });
  }));
  // tuplet brackets only when the tuplet is not fully beamed
  layers.forEach(L => L.tuplets.forEach(t => {
    const ns = t.getNotes ? t.getNotes() : t.notes;
    t.bracketed = ns.some(n => !n.beam);
  }));
  new VF.Formatter().joinVoices(voices).format(voices, W - stave.getNoteStartX() - 18);
  voices.forEach(v => v.draw(ctx, stave));
  beams.forEach(b => b.setContext(ctx).draw());
  layers.forEach(L => L.tuplets.forEach(t => t.setContext(ctx).draw()));
  [cell.notes, cell.lowNotes].forEach(list => list.forEach((nd, k) => {
    if (!nd.tie) return;
    const nx = list.slice(k+1).find(x => !x.bar);
    if (nx) new VF.StaveTie({ first_note:nd.vf, last_note:nx.vf, first_indices:[0], last_indices:[0] }).setContext(ctx).draw();
  }));

  const svg = el.querySelector('svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.maxWidth = W + 'px';
  [...cell.notes, ...cell.lowNotes].forEach(nd => {
    if (nd.bar) return;
    try {
      nd.el = (nd.vf.getSVGElement && nd.vf.getSVGElement()) || document.getElementById('vf-' + nd.vf.getAttribute('id'));
      if (nd.el && nd.layer === 'low') nd.el.classList.add('lowv');
    } catch(e){}
  });
  return W;
}

