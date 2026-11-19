/* ================= Dagroutine (route #dagroutine → #routineView) — v1.8, 19-11-2026 =================
   De gehoor- en theorieroutine (de instrumentroutine komt apart). Samen met Julian ontworpen:
   - Stand: 'kern' (vaste kern + roulerend accent, standaard), 'focus' (één categorie of eigen lijst), 'programma'
     (de app kiest op basis van je statistieken: zwaktes en lang niet geoefend, maximaal één zwakte per dag).
   - Duur 10 / 20 / 30 min. Opties: niveau extra (tijdens een blok één niveau hoger, daarna terug), makkelijk → moeilijk,
     uitleg en tips (kaartje per blok + focuspunten in het overzicht).
   - Rotatie = dag 1 t/m 7, schuift pas door als je een routine afmaakt (een gemiste dag = geen achterstand).
   - Tijdens het oefenen: routinebalk onderaan (blok x/n, timer, pauze, overslaan, wisselen, ⓘ, stoppen). Tijd om = 5 s
     aftellen, dan het volgende blok ("nog 1 min" kan). Na afloop: kort overzicht (tijd, vragen, % goed, focus, morgen).
   - Kalender (5 weken): routinedag = volle kleur, alleen los geoefend = lichter. Dagreeks = routines op rij.
   Oefeningen komen uit Nav.NAV (zelfde lijst als menu en bibliotheek): nieuwe oefeningen verschijnen vanzelf in
   'Mijn routine'; een oefening die niet meer bestaat wordt overgeslagen. Kern-items mogen een onderdeel hebben: 'drone:trap'.
   CLAUDE: bouw je een nieuwe oefening, zet er dan ook een regel in TIPS bij.
   Opslag: 'dagroutine-instellingen', 'dagroutine-log' {dagen:{datum:{min,n,ok,klaar}}, dag:0..6}, 'dagroutine-actief'. */
const Dagroutine = (function(){
  const SKEY = 'dagroutine-instellingen', LKEY = 'dagroutine-log', AKEY = 'dagroutine-actief';
  const DAGNAMEN = ['Ritme', 'Intervallen en akkoorden', 'Notenlezen', 'Intonatie', 'Cadensen en progressies', 'Dictee en baslijn', 'Je favorieten'];
  const STANDAARD = () => ({
    stand:'kern', duur:10, extra:false, opbouw:false, tips:true,
    kern:['drone:trap', 'drone:melo', 'gehoor'],
    rotatie:[['tikken', 'luisteren'], ['intervallen', 'akkoorden'], ['noten', 'toonsoorten'], ['intonatie'], ['cadensen', 'progressies'], ['dictee', 'baslijn'], []],
    focus:{ cat:'ritme', lijst:[] }, gewicht:'normaal', uit:[]
  });
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch(e){ return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  let S = Object.assign(STANDAARD(), load(SKEY, {}));
  const saveS = () => save(SKEY, S);
  const L = () => Object.assign({ dagen:{}, dag:0 }, load(LKEY, {}));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const vandaag = () => new Date().toLocaleDateString('sv');
  const $ = id => document.getElementById(id);

  /* ---------- oefeningen ---------- */
  function items(){                      // alle routes uit het menu + onderdelen (Drone → Degrees …)
    const out = [];
    Nav.NAV.forEach(c => c.items.forEach(i => {
      if (i.route === 'partituren') return;                       // Repertoire hoort bij de instrumentroutine
      out.push({ id:i.route, route:i.route, name:i.name, icon:i.icon, cat:c.id, catName:c.name });
      if (i.subs) i.subs.list.forEach(s => out.push({ id:i.route + ':' + s.id, route:i.route, sub:s.id, name:i.name + ' → ' + s.name, icon:i.icon, cat:c.id, catName:c.name }));
    }));
    return out;
  }
  const item = id => items().find(x => x.id === id) || null;
  const naam = id => { const x = item(id); return x ? x.name : id; };
  // score-onderdelen die bij een routine-item horen
  function modules(id){
    const [r, sub] = id.split(':');
    const m = (typeof Score !== 'undefined' && Score.meta ? Score.meta() : []).filter(x => x.view === r);
    if (r === 'drone' && sub) return m.filter(x => sub === 'trap' ? /trap/.test(x.id) : sub === 'melo' ? /melo/.test(x.id) : false).map(x => x.id);
    return m.map(x => x.id);
  }
  // % goed over de laatste n antwoorden en dagen sinds laatst geoefend
  function stand(id, n){
    n = n || 40; const mods = modules(id); let r = 0, t = 0, last = 0;
    let log = []; try { log = JSON.parse(localStorage.getItem('score-log')) || []; } catch(e){}
    for (let i = log.length - 1; i >= 0 && t < n; i--){ const e = log[i]; if (!mods.includes(e.m)) continue; t++; r += e.ok; if (!last) last = e.t; }
    return { t, p:t ? r / t : null, dagen:last ? Math.floor((Date.now() - last) / 864e5) : 999 };
  }

  /* ---------- plan van vandaag ---------- */
  const SPLIT = { 10:[3, 7], 20:[4, 8, 8], 30:[5, 9, 8, 8] };
  function kernVan(dagNr){ const k = S.kern.filter(item); return k.length ? k[dagNr % k.length] : 'gehoor'; }
  function rotGroep(dagNr){
    let g = (S.rotatie[dagNr % 7] || []).filter(item);
    if (!g.length && dagNr % 7 === 6) g = load('bib-favorieten', []).filter(item);
    if (!g.length) g = ['intervallen', 'akkoorden'].filter(item);
    return g;
  }
  function zwakte(skip){                // laagste % (minstens 8 antwoorden), niet uitgesloten
    const w = { weinig:.6, normaal:.8, veel:.92 }[S.gewicht] || .8;
    return items().filter(x => !x.sub && !skip.includes(x.id) && !S.uit.includes(x.id) && modules(x.id).length)
      .map(x => ({ id:x.id, s:stand(x.id) })).filter(x => x.s.t >= 8 && x.s.p < w)
      .sort((a, b) => a.s.p - b.s.p)[0] || null;
  }
  function langNiet(skip){              // het langst niet geoefende onderdeel (met statistieken)
    return items().filter(x => !x.sub && !skip.includes(x.id) && !S.uit.includes(x.id) && modules(x.id).length)
      .map(x => ({ id:x.id, d:stand(x.id).dagen })).sort((a, b) => b.d - a.d)[0] || null;
  }
  function plan(dagNr){
    const min = SPLIT[S.duur] || SPLIT[10], blok = [], gebruikt = [];
    const add = (id, m, waarom) => { if (!id || !item(id)) return; blok.push({ id, min:m, waarom }); gebruikt.push(id); };
    add(kernVan(dagNr), min[0], 'kern');
    if (S.stand === 'focus'){
      const pool = (S.focus.lijst && S.focus.lijst.length ? S.focus.lijst : items().filter(x => x.cat === S.focus.cat && !x.sub).map(x => x.id)).filter(item);
      for (let i = 1; i < min.length; i++) add(pool[(dagNr + i - 1) % Math.max(1, pool.length)], min[i], 'focus');
    } else if (S.stand === 'programma'){
      const z = zwakte(gebruikt); if (z) add(z.id, min[1], 'zwakte');
      for (let i = blok.length; i < min.length; i++){ const l = langNiet(gebruikt); add(l ? l.id : rotGroep(dagNr)[0], min[i], 'lang niet geoefend'); }
    } else {
      const g = rotGroep(dagNr);
      add(g[0], min[1], 'accent');
      if (min.length > 2) add(g[1] || rotGroep(dagNr + 6)[0], min[2], g[1] ? 'accent' : 'herhaling van gisteren');
      if (min.length > 3){ const z = zwakte(gebruikt); add(z ? z.id : (langNiet(gebruikt) || {}).id, min[3], z ? 'zwakte' : 'lang niet geoefend'); }
    }
    while (blok.length < min.length){ const l = langNiet(gebruikt); if (!l) break; add(l.id, min[blok.length], 'lang niet geoefend'); }
    if (S.opbouw){                       // makkelijk → moeilijk: hoogste % eerst
      blok.sort((a, b) => { const pa = stand(a.id).p, pb = stand(b.id).p; return (pb == null ? .5 : pb) - (pa == null ? .5 : pa); });
    }
    return blok;
  }

  /* ---------- tips ---------- */
  const TIPS = {
    'drone:trap':'Luister niet naar de afstand, maar naar het gevoel tegen de drone: do = rust, ti trekt omhoog, fa wil zakken. Zing de toon zachtjes mee voor je tikt.',
    'drone:melo':'Luister eerst helemaal, zing de melodie na en tik dan pas. Begin bij de eerste toon: hoe staat die tegenover do?',
    'drone:vrij':'Speel langzaam en luister of elke toon stilstaat tegen de drone. Zweeft het? Schuif tot het rustig wordt.',
    gehoor:'Hoor elke toon als trap in de toonsoort. Laat hem in je hoofd oplossen naar do: via welke trappen loop je?',
    absoluut:'Vergelijk niet met de vorige toon. Denk aan de klankkleur van de noot zelf.',
    intervallen:'Zing de twee tonen zachtjes mee en denk aan je geheugensteun-liedje. Pas dan antwoorden.',
    dictee:'Luister eerst naar de vorm (omhoog, omlaag, sprongen), schrijf dan de tonen op. Begin bij de eerste en de laatste toon.',
    intonatie:'Luister naar het zweven: hoe langzamer het golft, hoe dichter bij zuiver.',
    toonladders:'Kijk eerst naar de terts (groot of klein), dan naar het ene kenmerkende verschil.',
    akkoorden:'Major klinkt helder, minor donker, diminished gespannen, augmented zwevend. Luister daarna naar de septiem.',
    cadensen:'Let vooral op het laatste akkoord: klinkt het af (authentiek), open (half) of verrassend (bedrieglijk)?',
    baslijn:'Zing de bas zachtjes mee. Vraag je bij elke toon af op welke trap hij staat.',
    progressies:'Luister vooral naar de bas en zing hem mee. I en vi delen twee tonen, net als IV en ii.',
    atlas:'Tel hardop mee en speel het ritme eerst langzaam.',
    tikken:'Tel de tellen hardop of in je hoofd. Strak blijven is belangrijker dan snel.',
    luisteren:'Tel de tellen mee terwijl je luistert. Waar valt de eerste noot na de tel?',
    metronoom:'Speel op het tempo waarop het schoon gaat, niet waarop het net lukt.',
    rudiments:'Ontspannen handen, accenten hoog, zachte slagen laag bij het vel.',
    polyritme:'Tik eerst alleen het samengestelde ritme met één hand en tel hardop.',
    tempoladder:'Blijf ontspannen; strak is belangrijker dan de volgende trede.',
    swing:'Luister naar de lengte van de eerste achtste: recht, licht of triool?',
    noten:'Lees de noot zonder te tellen vanaf een ankernoot. Snelheid komt vanzelf.',
    toonsoorten:'Kruizen: halve toon boven het laatste kruis. Mollen: de voorlaatste mol.',
    'toonladders-blad':'Kijk eerst naar de terts, dan naar het kenmerkende verschil (sext, kwart, septiem).',
    'intervallen-blad':'Tel eerst de letters (C E G = kwint), dan de halve tonen voor groot of klein.',
    'akkoorden-blad':'Zoek de grondtoon: stapel in tertsen. Omgekeerd? De noot boven de kwart-opening.',
    akkoordsymbolen:'Letter = grondtoon. 7 = kleine septiem, maj7 = grote. Bouw van onder op in tertsen.',
    termen:'Probeer de betekenis eerst zelf te zeggen voordat je naar de knoppen kijkt.'
  };
  function verward(id){                // "je mist vaak X (meestal verward met Y)"
    if (typeof Score === 'undefined' || !Score.recent) return null;
    let best = null;
    modules(id).forEach(m => {
      const rec = Score.recent(m, 15);
      Object.keys(rec).forEach(k => {
        const l = rec[k]; if (l.length < 4) return;
        const fout = l.filter(x => !x.ok); if (fout.length < 2) return;
        const p = 1 - fout.length / l.length, cnt = {};
        fout.forEach(x => { if (x.a) cnt[x.a] = (cnt[x.a] || 0) + 1; });
        const a = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
        if (!best || p < best.p) best = { p, k:Score.label(m, k), a, n:fout.length, t:l.length };
      });
    });
    return best;
  }
  function tipVoor(id){
    const v = verward(id), x = item(id);
    const base = TIPS[id] || TIPS[x ? x.route : ''] || 'Let op je fouten van de vorige keer en neem rustig de tijd per vraag.';
    return { base, extra:v ? 'Je mist vaak <b>' + esc(v.k) + '</b> (' + v.n + ' van de laatste ' + v.t + ')' + (v.a ? ', meestal verward met <b>' + esc(v.a) + '</b>' : '') + '.' : '' };
  }

  /* ---------- niveau extra: tijdens een blok één niveau hoger ---------- */
  function levelSelect(it){
    const view = document.querySelector('.view.on'); if (!view) return null;
    if (it && it.route === 'drone') return $(it.sub === 'melo' ? 'dmLevel' : it.sub === 'trap' ? 'dtLevel' : '') || null;
    const sels = [...view.querySelectorAll('select[id$="Level"]')].filter(s => { const sub = s.closest('.nlsub'); return !sub || getComputedStyle(sub).display !== 'none'; });
    return sels[0] || null;
  }
  function extraAan(b){
    const sel = levelSelect(item(b.id)); if (!sel) return;
    const opts = [...sel.options].filter(o => o.value !== 'eigen'), i = opts.findIndex(o => o.value === sel.value);
    if (i < 0 || i >= opts.length - 1) return;
    b.lvOud = { id:sel.id, v:sel.value };
    sel.value = opts[i + 1].value; sel.dispatchEvent(new Event('change', { bubbles:true }));
  }
  function extraUit(b){
    if (!b || !b.lvOud) return; const sel = $(b.lvOud.id);
    if (sel){ sel.value = b.lvOud.v; sel.dispatchEvent(new Event('change', { bubbles:true })); }
    b.lvOud = null;
  }

  /* ---------- actieve routine ---------- */
  let A = load(AKEY, null), tick = null, cnt = null;
  if (A && A.dag !== vandaag()) A = null;
  const saveA = () => save(AKEY, A);
  function start(){
    const lg = L();
    A = { dag:vandaag(), dagNr:lg.dag, blok:plan(lg.dag).map(b => Object.assign(b, { gedaan:0, n:0, ok:0 })), i:0, pauze:false, t0:Date.now() };
    if (!A.blok.length) return;
    saveA(); openBlok(true);
  }
  function openBlok(kaart){
    const b = A.blok[A.i], it = item(b.id); if (!it){ volgende(); return; }
    const go = () => {
      if (it.sub){ const ni = Nav.itemOf(it.route); if (ni && ni.subs) ni.subs.go(it.sub); }
      if (S.extra && !b.lvOud) setTimeout(() => { extraAan(b); saveA(); }, 120);
    };
    if (location.hash.replace('#', '') === it.route){ if (typeof route === 'function') route(); setTimeout(go, 60); }
    else { location.hash = it.route; setTimeout(go, 80); }
    balk(); startTick();
    if (kaart && S.tips) setTimeout(toonKaart, 350);
  }
  function startTick(){
    clearInterval(tick);
    tick = setInterval(() => {
      if (!A || A.pauze || document.hidden || cnt) return;
      const b = A.blok[A.i]; b.gedaan++; if (b.gedaan % 5 === 0) saveA();
      if (b.gedaan >= b.min * 60) tijdOm(); else balkTijd();
    }, 1000);
  }
  function tijdOm(){
    const nx = A.blok[A.i + 1];
    let s = 5; const el = $('drOm');
    el.innerHTML = '<b>Tijd!</b> ' + (nx ? 'Volgende: ' + esc(naam(nx.id)) + ' over <span id="drOmS">5</span> s' : 'Klaar over <span id="drOmS">5</span> s') +
      ' <button type="button" id="drMeer">+1 min</button> <button type="button" id="drNu" class="primary">' + (nx ? 'Nu door' : 'Afronden') + '</button>';
    el.hidden = false;
    cnt = setInterval(() => { s--; const x = $('drOmS'); if (x) x.textContent = s; if (s <= 0){ stopCnt(); volgende(); } }, 1000);
    $('drMeer').onclick = () => { stopCnt(); A.blok[A.i].min += 1; saveA(); balk(); };
    $('drNu').onclick = () => { stopCnt(); volgende(); };
  }
  function stopCnt(){ clearInterval(cnt); cnt = null; const el = $('drOm'); if (el) el.hidden = true; }
  function volgende(){
    stopCnt(); extraUit(A.blok[A.i]);
    if (A.i < A.blok.length - 1){ A.i++; saveA(); openBlok(true); } else klaar();
  }
  function overslaan(){ A.blok[A.i].overgeslagen = true; volgende(); }
  function wisselen(){
    const b = A.blok[A.i], it = item(b.id); extraUit(b);
    const pool = items().filter(x => x.cat === it.cat && x.id !== b.id && !S.uit.includes(x.id) && !A.blok.some(y => y.id === x.id) && x.route !== 'metronoom');
    if (!pool.length) return;
    b.id = pool[Math.floor(Math.random() * pool.length)].id; b.gedaan = 0; saveA(); openBlok(true);
  }
  function stoppen(){
    const nu = A.blok.filter(b => b.gedaan > 30).length;
    extraUit(A.blok[A.i]);
    if (nu) klaar(true); else { A = null; save(AKEY, null); weg(); }
  }
  function klaar(afgebroken){
    clearInterval(tick); stopCnt();
    const lg = L(), d = vandaag(), min = Math.round(A.blok.reduce((a, b) => a + b.gedaan, 0) / 60);
    const n = A.blok.reduce((a, b) => a + b.n, 0), ok = A.blok.reduce((a, b) => a + b.ok, 0);
    const oud = lg.dagen[d] || { min:0, n:0, ok:0 };
    lg.dagen[d] = { min:oud.min + min, n:oud.n + n, ok:oud.ok + ok, klaar:!afgebroken || oud.klaar };
    if (!afgebroken && !oud.klaar) lg.dag = (lg.dag + 1) % 7;          // rotatie schuift alleen door na een afgemaakte routine
    save(LKEY, lg);
    const res = A; A = null; save(AKEY, null); weg();
    location.hash = 'dagroutine';
    setTimeout(() => overzicht(res, afgebroken), 120);
  }

  // antwoorden tellen per blok
  function hookScore(){
    if (typeof Score === 'undefined' || Score._drHook) return;
    const o = Score.log; Score._drHook = true;
    Score.log = function(id, items){
      try {
        if (A && !A.pauze){ const b = A.blok[A.i]; if (b && modules(b.id).includes(id)){ [].concat(items).forEach(x => { b.n++; if (x.ok) b.ok++; }); saveA(); } }
      } catch(e){}
      return o.apply(this, arguments);
    };
  }

  /* ---------- routinebalk ---------- */
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function balk(){
    let el = $('drBalk');
    if (!el){
      el = document.createElement('div'); el.id = 'drBalk'; el.className = 'drbalk';
      el.innerHTML = '<div class="drbinfo"><span id="drBNr"></span><b id="drBNaam"></b><span id="drBTijd"></span></div>'
        + '<div class="drbknop"><button type="button" id="drBInfo" title="Opdracht en tip">ⓘ</button><button type="button" id="drBPauze" title="Pauze">⏸</button>'
        + '<button type="button" id="drBWissel" title="Wisselen: een andere oefening uit dezelfde categorie">⇄</button><button type="button" id="drBSkip" title="Overslaan">⏭</button>'
        + '<button type="button" id="drBStop" title="Stoppen">✕</button></div><div class="drbprog"><i id="drBProg"></i></div><div id="drOm" class="drom" hidden></div>';
      document.body.appendChild(el);
      $('drBInfo').onclick = () => toonKaart();
      $('drBPauze').onclick = () => { A.pauze = !A.pauze; saveA(); balk(); };
      $('drBWissel').onclick = wisselen;
      $('drBSkip').onclick = overslaan;
      $('drBStop').onclick = () => { if ($('drBStop').classList.contains('zeker')) stoppen(); else { $('drBStop').classList.add('zeker'); $('drBStop').textContent = 'Stoppen?'; setTimeout(() => { const b = $('drBStop'); if (b){ b.classList.remove('zeker'); b.textContent = '✕'; } }, 3000); } };
    }
    document.documentElement.classList.add('drloopt');
    el.hidden = false;
    const b = A.blok[A.i];
    $('drBNr').textContent = (A.i + 1) + '/' + A.blok.length;
    $('drBNaam').textContent = naam(b.id);
    $('drBPauze').textContent = A.pauze ? '▶' : '⏸'; $('drBPauze').title = A.pauze ? 'Verder' : 'Pauze';
    el.classList.toggle('pauze', !!A.pauze);
    balkTijd();
  }
  function balkTijd(){
    if (!A) return; const b = A.blok[A.i], rest = Math.max(0, b.min * 60 - b.gedaan);
    const t = $('drBTijd'); if (t) t.textContent = A.pauze ? 'pauze' : mmss(rest);
    const p = $('drBProg'); if (p) p.style.width = Math.min(100, b.gedaan / (b.min * 60) * 100) + '%';
  }
  function weg(){ const el = $('drBalk'); if (el) el.hidden = true; document.documentElement.classList.remove('drloopt'); clearInterval(tick); stopCnt(); sluitKaart(); }

  /* ---------- kaartje met opdracht en tip ---------- */
  function toonKaart(){
    if (!A) return; sluitKaart();
    const b = A.blok[A.i], it = item(b.id), tip = tipVoor(b.id);
    const k = document.createElement('div'); k.id = 'drKaart'; k.className = 'drkaart';
    k.innerHTML = '<div class="drkhead"><span class="drki">' + (it ? it.icon : '') + '</span><div><small>Blok ' + (A.i + 1) + ' van ' + A.blok.length + ' · ' + b.min + ' min · ' + esc(b.waarom) + '</small><b>' + esc(naam(b.id)) + '</b></div></div>'
      + '<p>' + esc(tip.base) + '</p>' + (tip.extra ? '<p class="drkextra">🎯 ' + tip.extra + '</p>' : '')
      + (b.lvOud ? '<p class="muted">Niveau extra: dit blok staat één niveau hoger; daarna gaat het terug.</p>' : '')
      + '<button type="button" class="primary" id="drKOk">Begin</button>';
    document.body.appendChild(k);
    $('drKOk').onclick = sluitKaart;
    setTimeout(() => { const ok = $('drKOk'); if (ok) ok.focus(); }, 30);
  }
  function sluitKaart(){ const k = $('drKaart'); if (k) k.remove(); }

  /* ---------- startscherm ---------- */
  function reeks(){
    const lg = L(), d = new Date(); d.setHours(12); let n = 0;
    if (!(lg.dagen[vandaag()] || {}).klaar) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 1000; i++){ const k = d.toLocaleDateString('sv'); if ((lg.dagen[k] || {}).klaar){ n++; d.setDate(d.getDate() - 1); } else break; }
    return n;
  }
  function kalender(){
    const lg = L(), d = new Date(); d.setHours(12);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 28);                     // maandag, 4 weken terug
    let h = '<div class="drkal"><span>ma</span><span>di</span><span>wo</span><span>do</span><span>vr</span><span>za</span><span>zo</span>';
    for (let i = 0; i < 35; i++){
      const k = d.toLocaleDateString('sv'), r = lg.dagen[k], los = typeof Score !== 'undefined' && Score.daySecs ? Score.daySecs(k) >= 60 : false;
      const toek = k > vandaag(), cls = toek ? 'toek' : r && r.klaar ? 'vol' : r || los ? 'los' : '';
      h += '<i class="' + cls + (k === vandaag() ? ' nu' : '') + '" title="' + d.toLocaleDateString('nl', { weekday:'long', day:'numeric', month:'long' }) + (r ? ': routine ' + r.min + ' min' : los ? ': los geoefend' : '') + '">' + d.getDate() + '</i>';
      d.setDate(d.getDate() + 1);
    }
    return h + '</div><p class="drlegend"><i class="vol"></i> routine <i class="los"></i> los geoefend</p>';
  }
  function zwaktes(){
    const rows = items().filter(x => !x.sub || x.route === 'drone').filter(x => !(x.route === 'drone' && !x.sub))
      .map(x => ({ x, s:stand(x.id) })).filter(r => r.s.t >= 8).sort((a, b) => a.s.p - b.s.p).slice(0, 5);
    if (!rows.length) return '<p class="muted">Nog te weinig antwoorden. Na een paar routines zie je hier je zwakste onderdelen.</p>';
    return rows.map(r => '<div class="drzw"><span>' + r.x.icon + ' ' + esc(r.x.name) + '</span><span class="drzwbar"><i style="width:' + Math.round(r.s.p * 100) + '%"></i></span><b>' + Math.round(r.s.p * 100) + '%</b></div>').join('');
  }
  function planHTML(p){
    return '<ol class="drplan">' + p.map(b => { const it = item(b.id); return '<li><span class="dri">' + (it ? it.icon : '') + '</span><span>' + esc(naam(b.id)) + '<small>' + esc(b.waarom) + '</small></span><b>' + b.min + ' min</b></li>'; }).join('') + '</ol>';
  }
  const seg = (id, opts, cur) => '<div class="drseg" id="' + id + '">' + opts.map(([v, n]) => '<button type="button" data-v="' + v + '" class="' + (String(cur) === String(v) ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
  function render(){
    const el = $('routineView'); if (!el) return;
    const lg = L(), p = plan(lg.dag), r = reeks(), vd = lg.dagen[vandaag()];
    el.innerHTML = '<div class="drwrap">'
      + '<div class="drtop"><div><h2>▶ Dagroutine</h2><p class="muted">Gehoor en theorie, elke dag een beetje.</p></div><div class="drstreak"><b>' + r + '</b><small>' + (r === 1 ? 'dag' : 'dagen') + ' op rij</small></div></div>'
      + (vd && vd.klaar ? '<p class="drgedaan">✓ Vandaag al gedaan (' + vd.min + ' min). Nog een keer mag altijd.</p>' : '')
      + '<section class="rpanel"><div class="rlabel">Stand</div>' + seg('drStand', [['kern', 'Kern + roulerend'], ['focus', 'Focus'], ['programma', 'Programma']], S.stand)
      + '<div id="drFocusBox"' + (S.stand === 'focus' ? '' : ' hidden') + '><label class="drlbl">Focus op <select id="drFocusCat">' + Nav.NAV.filter(c => c.id !== 'bladmuziek').map(c => '<option value="' + c.id + '"' + (S.focus.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>'
      + '<span class="muted drklein">' + (S.focus.lijst.length ? 'Eigen lijst: ' + S.focus.lijst.map(naam).join(', ') + ' (aanpassen bij Mijn routine)' : 'Of maak een eigen lijst bij Mijn routine.') + '</span></div>'
      + '<p class="muted drklein">' + { kern:'Elke dag de kern (relatief gehoor) + een wisselend accent; over 7 routines komt alles langs.', focus:'Elke dag de kern + oefeningen uit één onderdeel, voor een periode waarin je ergens extra op wilt letten.', programma:'De app kiest op basis van je statistieken: één zwakte per dag, aangevuld met wat je lang niet hebt geoefend.' }[S.stand] + '</p>'
      + '<div class="rlabel">Duur</div>' + seg('drDuur', [[10, '10 min'], [20, '20 min'], [30, '30 min']], S.duur)
      + '<div class="ropts drchk"><label><input type="checkbox" id="drExtra"' + (S.extra ? ' checked' : '') + '> Niveau extra</label>'
      + '<label><input type="checkbox" id="drOpbouw"' + (S.opbouw ? ' checked' : '') + '> Makkelijk → moeilijk</label>'
      + '<label><input type="checkbox" id="drTips"' + (S.tips ? ' checked' : '') + '> Uitleg en tips</label></div></section>'
      + '<section class="rpanel"><div class="rlabel">Vandaag' + (S.stand === 'kern' ? ' · dag ' + (lg.dag + 1) + ' van 7: ' + esc(DAGNAMEN[lg.dag]) : '') + '</div>' + planHTML(p)
      + '<button type="button" class="primary big drstart" id="drStart">▶ Start (' + S.duur + ' min)</button></section>'
      + '<section class="rpanel"><div class="rlabel">Je oefendagen</div>' + kalender() + '</section>'
      + '<section class="rpanel"><div class="rlabel">Zwakste onderdelen (laatste 40 antwoorden)</div>' + zwaktes() + '</section>'
      + '<details class="rpanel drmijn" id="drMijn"><summary>⚙ Mijn routine: kern, rotatie en programma</summary><div id="drMijnBody"></div></details>'
      + '</div>';
    el.querySelectorAll('#drStand button').forEach(b => b.onclick = () => { S.stand = b.dataset.v; saveS(); render(); });
    el.querySelectorAll('#drDuur button').forEach(b => b.onclick = () => { S.duur = +b.dataset.v; saveS(); render(); });
    $('drFocusCat').onchange = e => { S.focus.cat = e.target.value; saveS(); render(); };
    $('drExtra').onchange = e => { S.extra = e.target.checked; saveS(); };
    $('drOpbouw').onchange = e => { S.opbouw = e.target.checked; saveS(); render(); };
    $('drTips').onchange = e => { S.tips = e.target.checked; saveS(); };
    $('drStart').onclick = start;
    $('drMijn').ontoggle = () => { if ($('drMijn').open) mijn(); };
  }

  /* ---------- Mijn routine ---------- */
  function chipLijst(ids, wijzig){
    return '<div class="drchips">' + ids.map((id, i) => '<span class="drchip">' + esc(naam(id)) + '<button type="button" data-x="' + i + '" title="Weghalen">×</button></span>').join('')
      + '<select class="dradd"><option value="">+ toevoegen</option>' + Nav.NAV.filter(c => c.id !== 'bladmuziek').map(c => '<optgroup label="' + esc(c.name) + '">' + items().filter(x => x.cat === c.id && !ids.includes(x.id)).map(x => '<option value="' + x.id + '">' + esc(x.name) + '</option>').join('') + '</optgroup>').join('') + '</select></div>';
  }
  function koppel(box, get, set){
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { const l = get().slice(); l.splice(+b.dataset.x, 1); set(l); });
    box.querySelector('.dradd').onchange = e => { if (!e.target.value) return; const l = get().slice(); l.push(e.target.value); set(l); };
  }
  function mijn(){
    const body = $('drMijnBody'); if (!body) return;
    body.innerHTML = '<div class="rlabel">Kern (elke dag één, om de beurt)</div><div id="drMKern"></div>'
      + '<div class="rlabel">Rotatie (dag 1 t/m 7; schuift door na elke afgemaakte routine)</div>' + DAGNAMEN.map((n, i) => '<div class="drrot"><span class="drrotn">Dag ' + (i + 1) + '</span><div id="drMRot' + i + '"></div></div>').join('')
      + '<p class="muted drklein">Dag 7 leeg = je favorieten uit de bibliotheek.</p>'
      + '<div class="rlabel">Focus: eigen lijst (leeg = de gekozen categorie)</div><div id="drMFocus"></div>'
      + '<div class="rlabel">Programma</div><div class="ropts"><label>Aandacht voor zwaktes <select id="drMGew"><option value="weinig">weinig</option><option value="normaal">normaal</option><option value="veel">veel</option></select></label></div>'
      + '<div class="rlabel">Nooit in de routine</div><div id="drMUit"></div>'
      + '<p><button type="button" id="drMReset">↺ Terug naar standaard</button></p>';
    const zet = () => { saveS(); mijn(); };
    const kern = $('drMKern'); kern.innerHTML = chipLijst(S.kern); koppel(kern, () => S.kern, l => { S.kern = l; zet(); });
    DAGNAMEN.forEach((n, i) => { const b = $('drMRot' + i); b.innerHTML = chipLijst(S.rotatie[i] || []); koppel(b, () => S.rotatie[i] || [], l => { S.rotatie[i] = l; zet(); }); });
    const f = $('drMFocus'); f.innerHTML = chipLijst(S.focus.lijst); koppel(f, () => S.focus.lijst, l => { S.focus.lijst = l; zet(); });
    const u = $('drMUit'); u.innerHTML = chipLijst(S.uit); koppel(u, () => S.uit, l => { S.uit = l; zet(); });
    $('drMGew').value = S.gewicht; $('drMGew').onchange = e => { S.gewicht = e.target.value; saveS(); };
    $('drMReset').onclick = () => { if ($('drMReset').classList.contains('zeker')){ S = STANDAARD(); saveS(); render(); $('drMijn').open = true; mijn(); } else { $('drMReset').classList.add('zeker'); $('drMReset').textContent = 'Zeker? Klik nog eens'; } };
  }

  /* ---------- overzicht na afloop ---------- */
  function overzicht(res, afgebroken){
    const el = $('routineView'); if (!el) return;
    const min = Math.round(res.blok.reduce((a, b) => a + b.gedaan, 0) / 60), n = res.blok.reduce((a, b) => a + b.n, 0), ok = res.blok.reduce((a, b) => a + b.ok, 0);
    const focus = res.blok.map(b => ({ b, v:verward(b.id) })).filter(x => x.v).sort((a, b) => a.v.p - b.v.p).slice(0, 2);
    const goed = res.blok.filter(b => b.n >= 8 && b.ok / b.n >= .9);
    const morgen = plan(L().dag);
    el.innerHTML = '<div class="drwrap"><section class="rpanel drklaar"><h2>' + (afgebroken ? 'Routine gestopt' : '🎉 Routine klaar!') + '</h2>'
      + '<div class="drstats"><div><b>' + min + '</b><small>min</small></div><div><b>' + n + '</b><small>vragen</small></div><div><b>' + (n ? Math.round(ok / n * 100) + '%' : '–') + '</b><small>goed</small></div><div><b>' + reeks() + '</b><small>dagen op rij</small></div></div>'
      + '<div class="rlabel">Per blok</div><ul class="drres">' + res.blok.map(b => '<li><span>' + esc(naam(b.id)) + (b.overgeslagen ? ' <small>(overgeslagen)</small>' : '') + '</span><b>' + Math.round(b.gedaan / 60) + ' min · ' + (b.n ? b.ok + '/' + b.n : '–') + '</b></li>').join('') + '</ul>'
      + (S.tips && (focus.length || goed.length) ? '<div class="rlabel">Waar je op kunt letten</div><ul class="drfocus">'
        + focus.map(x => '<li>🎯 <b>' + esc(naam(x.b.id)) + '</b>: je mist vaak ' + esc(x.v.k) + (x.v.a ? ' (meestal verward met ' + esc(x.v.a) + ')' : '') + '. ' + esc(TIPS[x.b.id] || TIPS[(item(x.b.id) || {}).route] || '') + '</li>').join('')
        + goed.map(b => '<li>✓ <b>' + esc(naam(b.id)) + '</b> ging goed (' + Math.round(b.ok / b.n * 100) + '%): misschien klaar voor het volgende niveau.</li>').join('') + '</ul>' : '')
      + '<div class="rlabel">Morgen</div>' + planHTML(morgen)
      + '<p><button type="button" class="primary" id="drTerug">Naar Home</button> <button type="button" id="drOpnieuw">Routinescherm</button></p></section></div>';
    $('drTerug').onclick = () => { location.hash = ''; };
    $('drOpnieuw').onclick = render;
  }

  /* ---------- Home: rij bovenaan ---------- */
  function homeRij(){
    const hl = $('homeList'); if (!hl) return;
    let r = $('drHome');
    if (!r){ r = document.createElement('a'); r.id = 'drHome'; r.href = '#dagroutine'; r.className = 'navrow drhome'; hl.parentNode.insertBefore(r, hl); }
    const vd = L().dagen[vandaag()], n = reeks();
    r.innerHTML = '<span class="nri">▶</span><span class="nrt"><strong>Dagroutine</strong><small>' + (A ? 'Bezig: blok ' + (A.i + 1) + ' van ' + A.blok.length + ' · tik om verder te gaan' : vd && vd.klaar ? '✓ Vandaag gedaan · ' + n + ' ' + (n === 1 ? 'dag' : 'dagen') + ' op rij' : S.duur + ' min · ' + (n ? n + ' ' + (n === 1 ? 'dag' : 'dagen') + ' op rij' : 'begin je reeks')) + '</small></span><span class="nrc" aria-hidden="true">›</span>';
    r.onclick = e => { if (A){ e.preventDefault(); openBlok(false); } };
  }

  function onRoute(){
    const v = typeof view !== 'undefined' ? view : '';
    if (v === 'dagroutine' && !A) render();
    if (v === 'home') homeRij();
  }
  function init(){
    hookScore(); homeRij();
    if (A){ A.pauze = true; saveA(); balk(); startTick(); }      // na herladen: verder waar je was (gepauzeerd)
    window.addEventListener('hashchange', () => setTimeout(onRoute, 0));
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { plan, start, render, stand, items, TIPS, _actief:() => A };
})();
