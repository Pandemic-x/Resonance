/* ================= Gedeeld scoresysteem =================
   Eén logboek voor alle onderdelen + actieve oefentijd + het voortgangspaneel op het startscherm.

   Score.def(id, {name, view, label(k), level(), levelName(lv), next(lv)})   onderdeel aanmelden (in de module zelf).
       k  = itemsleutel, kort en vast (bv. 'maj:4', 'up:7'); label(k) maakt er leesbare tekst van.
       level() = huidige niveau-sleutel (string); next(lv) = tekst voor de volgende stap.
   Score.ask(id)              nieuwe vraag: reactieklok leeg.
   Score.heard(id)            vraag klinkt: reactieklok start (alleen de eerste keer per vraag).
   Score.log(id, items)       items = [{k, q, a, ok}] of één object. Alles krijgt dezelfde tijd, reactietijd en niveau.
   Score.tally(id, n)         {k: {r, t}} over de laatste n pogingen per item (standaard 40). Voor gewogen vragen + lijstjes.
   Score.recent(id, n)        {k: [{a, ok, t}]} laatste n pogingen per item, nieuwste eerst (bv. voor 'meestal verward met …').
   Score.today(id)            aantal antwoorden vandaag.
   Score.clear(id)            alle antwoorden van één onderdeel wissen.
   Score.render()             voortgangspaneel (#scorePanel) opnieuw tekenen.
   Presets (presets.js): is er voor dit onderdeel een preset actief (instellingen kloppen precies), dan krijgt de niveau-sleutel
   het voorvoegsel 'p:<presetId>.<rev>|' (Presets.tag). Niveau-advies: per onderdeel de huidige sleutel + één kaart per preset
   die je de laatste 30 dagen gebruikte (bestaande preset met dezelfde rev; Bijwerken = nieuwe rev = score opnieuw).

   Opslag: 'score-log' = [{t, m, k, q, a, ok:1|0, ms, lv}] (max 15000), 'score-tijd' = {'jjjj-mm-dd': {view: seconden}}.
   Oefentijd telt alleen in oefen-views, met het tabblad zichtbaar, niet gepauzeerd, en als je in de laatste 45 s
   iets deed (of er klinkt audio en je deed in de laatste 3 min iets). */

const Score = (function(){
  const LOG_KEY = 'score-log', TIME_KEY = 'score-tijd', MAX = 15000, GOAL = 600, TICK = 5;
  const VIEWS = ['atlas','tikken','luisteren','metronoom','gehoor','absoluut','intervallen','dictee','drone','intonatie','notenleer','toonladders','akkoorden','noten','toonsoorten','toonladders-blad','intervallen-blad','akkoorden-blad','partituren','cadensen','progressies','baslijn','termen','akkoordsymbolen','rudiments','polyritme','tempoladder','swing','transcriberen'];
  const OLD = ['gehoor-stats','gehoor-dag','absoluut-stats','absoluut-dag','iv-stats','iv-dag','dictee-stats','dictee-dag','ritme-atlas-stats','ritme-atlas-dictee'];
  const defs = {}, clock = {};
  let log = [], time = {}, lastAct = 0;

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch(e){ return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const dayKey = d => (d ? new Date(d) : new Date()).toLocaleDateString('sv');
  try { OLD.forEach(k => localStorage.removeItem(k)); } catch(e){}
  log = read(LOG_KEY, []); time = read(TIME_KEY, {});

  /* --- logboek --- */
  function def(id, o){ defs[id] = o; }
  const ptag = id => typeof Presets !== 'undefined' ? Presets.tag(id) : '';
  const pinfo = (id, lv) => typeof Presets !== 'undefined' ? Presets.info(id, lv) : null;
  const curLv = id => { const d = defs[id]; return ptag(id) + (d && d.level ? String(d.level()) : ''); };
  function ask(id){ clock[id] = null; }
  function heard(id){ if (!clock[id]) clock[id] = performance.now(); }
  function add(id, items){
    const t = Date.now(), lv = curLv(id);
    const ms = clock[id] ? Math.round(performance.now() - clock[id]) : null;
    [].concat(items).forEach(x => log.push({ t, m:id, k:String(x.k), q:x.q == null ? '' : String(x.q), a:x.a == null ? '' : String(x.a), ok:x.ok ? 1 : 0, ms, lv }));
    if (log.length > MAX) log.splice(0, log.length - MAX);
    write(LOG_KEY, log); act();
  }
  function tally(id, n){
    n = n || 40; const out = {};
    for (let i = log.length - 1; i >= 0; i--){
      const e = log[i]; if (e.m !== id) continue;
      const s = out[e.k] || (out[e.k] = { r:0, t:0 });
      if (s.t < n){ s.t++; s.r += e.ok; }
    }
    return out;
  }
  // laatste n pogingen per item, met antwoord: {k: [{a, ok, t}, …]} (nieuwste eerst). Voor 'verward met …'.
  function recent(id, n){
    n = n || 40; const out = {};
    for (let i = log.length - 1; i >= 0; i--){
      const e = log[i]; if (e.m !== id) continue;
      const l = out[e.k] || (out[e.k] = []);
      if (l.length < n) l.push({ a:e.a, ok:e.ok, t:e.t });
    }
    return out;
  }
  function today(id){ const d = dayKey(); return log.filter(e => e.m === id && dayKey(e.t) === d).length; }
  function clear(id){ log = log.filter(e => e.m !== id); write(LOG_KEY, log); render(); }

  /* --- actieve oefentijd --- */
  function act(){ lastAct = Date.now(); }
  ['pointerdown','keydown'].forEach(ev => document.addEventListener(ev, act, true));
  setInterval(() => {
    const v = typeof view !== 'undefined' ? view : '';
    if (!VIEWS.includes(v) || document.visibilityState !== 'visible') return;
    if (typeof paused !== 'undefined' && paused) return;
    const idle = Date.now() - lastAct;
    const busy = (typeof timer !== 'undefined' && timer) || Engine.metronome.running() || Engine.drone.on() || (typeof ptPlaying === 'function' && ptPlaying()) || (typeof rtBusy === 'function' && rtBusy());
    if (!(idle < 45000 || (busy && idle < 180000))) return;
    const d = dayKey(), o = time[d] || (time[d] = {});
    o[v] = (o[v] || 0) + TICK;
    const keys = Object.keys(time).sort();
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => delete time[k]);
    write(TIME_KEY, time);
  }, TICK * 1000);
  const secs = d => Object.values(time[d] || {}).reduce((a, b) => a + b, 0);

  /* --- dagreeks: daggoal 10 min, 1 vrije dag per week (ma–zo); vandaag nog bezig breekt niets --- */
  const weekKey = d => { const x = new Date(d); x.setHours(12); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dayKey(x); };
  function streak(){
    const days = Object.keys(time).filter(k => secs(k) > 0).sort();
    if (!days.length) return { n:0, freeUsed:false };
    const first = days[0], free = {}, d = new Date(); d.setHours(12);
    let n = secs(dayKey(d)) >= GOAL ? 1 : 0;
    for (let i = 0; i < 2000; i++){
      d.setDate(d.getDate() - 1);
      const k = dayKey(d); if (k < first) break;
      if (secs(k) >= GOAL) n++;
      else { const w = weekKey(d); if (free[w]) break; free[w] = 1; }
    }
    // vrije dag deze week al gebruikt? (een gemiste dag eerder deze week)
    const w0 = weekKey(new Date()), x = new Date(w0 + 'T12:00'); let used = false;
    while (dayKey(x) < dayKey()){ const k = dayKey(x); if (k >= first && secs(k) < GOAL) used = true; x.setDate(x.getDate() + 1); }
    return { n, freeUsed:used, week:w0, first };
  }

  /* --- zwakste punten en niveau-advies --- */
  function weakest(){
    const since = Date.now() - 60 * 864e5, per = {};
    for (let i = log.length - 1; i >= 0; i--){
      const e = log[i]; if (e.t < since) break;
      if (!defs[e.m]) continue;
      const key = e.m + '\u0001' + e.k, s = per[key] || (per[key] = { m:e.m, k:e.k, r:0, t:0, ms:[] });
      if (s.t < 20){ s.t++; s.r += e.ok; if (e.ms != null) s.ms.push(e.ms); }
    }
    return Object.values(per).filter(s => s.t >= 5 && s.r < s.t).map(s => {
      s.ms.sort((a, b) => a - b); s.med = s.ms.length ? s.ms[s.ms.length >> 1] : null; s.p = s.r / s.t; return s;
    }).sort((a, b) => a.p - b.p || (b.med || 0) - (a.med || 0)).slice(0, 5);
  }
  function advice(id, lv){
    const d = defs[id], rec = [];
    if (lv == null) lv = curLv(id);
    for (let i = log.length - 1; i >= 0 && rec.length < 30; i--) if (log[i].m === id && log[i].lv === lv) rec.push(log[i]);
    if (!rec.length) return null;
    const p = rec.reduce((a, e) => a + e.ok, 0) / rec.length;
    const pr = /^p:/.test(lv) ? pinfo(id, lv) : null;
    if (/^p:/.test(lv) && !pr) return null;                 // verwijderde preset of oude versie (na Bijwerken)
    const base = pr ? pr.base : lv;
    const nx = d.next ? d.next(base) : '';
    return { id, name:d.name, view:d.view, preset:pr, lvName:pr ? '📚 ' + pr.naam : d.levelName ? d.levelName(lv) : lv, n:rec.length, p,
             ready: rec.length >= 30 && p >= .9, next:pr ? 'maak hem moeilijker en kies Bijwerken' + (nx ? ' (bv. ' + nx + ')' : '') : nx };
  }
  // alle niveau-adviezen: per onderdeel de huidige sleutel, plus elke preset die je de laatste 30 dagen gebruikte
  function advices(){
    const out = [], seen = {}, since = Date.now() - 30 * 864e5;
    Object.keys(defs).forEach(id => {
      const lv = curLv(id); seen[id + '\u0001' + lv] = 1;
      const a = advice(id, lv); if (a) out.push(a);
      for (let i = log.length - 1; i >= 0 && log[i].t >= since; i--){
        const e = log[i]; if (e.m !== id || !/^p:/.test(e.lv) || seen[id + '\u0001' + e.lv]) continue;
        seen[id + '\u0001' + e.lv] = 1;
        const b = advice(id, e.lv); if (b) out.push(b);
      }
    });
    return out;
  }

  /* --- paneel --- */
  const mmss = s => s >= 3600 ? Math.floor(s / 3600) + ' u ' + Math.round(s % 3600 / 60) + ' min' : Math.round(s / 60) + ' min';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const VNAME = { atlas:'Atlas', tikken:'Tikken', luisteren:'Ritme luisteren', metronoom:'Metronoom', gehoor:'Relatief', absoluut:'Absoluut', intervallen:'Intervallen', dictee:'Dictee', drone:'Drone', intonatie:'Intonatie', notenleer:'Notenleer', toonladders:'Toonladders', akkoorden:'Akkoorden', noten:'Noten benoemen', toonsoorten:'Toonsoorten', 'toonladders-blad':'Toonladders (blad)', 'intervallen-blad':'Intervallen (blad)', 'akkoorden-blad':'Akkoorden (blad)', partituren:'Repertoire', cadensen:'Cadensen', progressies:'Progressies', baslijn:'Baslijn', termen:'Termen', akkoordsymbolen:'Akkoordsymbolen', rudiments:'Rudiments', polyritme:'Polyritme', tempoladder:'Tempo-ladder', swing:'Swing', transcriberen:'Transcriberen' };
  function render(){
    const box = document.getElementById('scorePanel'); if (!box) return;
    const st = streak(), now = secs(dayKey()), pct = Math.min(1, now / GOAL);
    const per = Object.entries(time[dayKey()] || {}).filter(([, s]) => s >= 30).map(([v, s]) => (VNAME[v] || v) + ' ' + mmss(s)).join(' · ');
    // weekstrook ma–zo
    const x = new Date((st.week || weekKey(new Date())) + 'T12:00'), td = dayKey(), DN = ['ma','di','wo','do','vr','za','zo'];
    let week = '';
    for (let i = 0; i < 7; i++){
      const k = dayKey(x), s = secs(k);
      const cls = s >= GOAL ? 'ok' : k === td ? 'now' : k > td || !st.first || k < st.first ? 'fut' : 'miss';
      week += `<span class="scday ${cls}" title="${k}: ${mmss(s)}">${DN[i]}</span>`;
      x.setDate(x.getDate() + 1);
    }
    const weak = weakest(), adv = advices();
    box.innerHTML =
      `<div class="sccol"><h3>Vandaag</h3>
        <div class="scbig"><b>${st.n}</b> ${st.n === 1 ? 'dag' : 'dagen'} op rij</div>
        <div class="scweek">${week}</div>
        <div class="scgoal"><div class="barbg"><div class="barfg" style="width:${pct * 100}%"></div></div>
          <span>${mmss(now)} van 10 min${now >= GOAL ? ' ✓' : ''}</span></div>
        <p class="note">${per ? per + '. ' : ''}Vrije dag deze week: ${st.freeUsed ? 'al gebruikt' : 'nog over'}. Alleen actieve tijd telt.</p>
      </div>
      <div class="sccol"><h3>Zwakste punten</h3>${weak.length ? weak.map(w =>
        `<a class="scweak" href="#${defs[w.m].view}"><span><small>${esc(defs[w.m].name)}</small> ${esc(defs[w.m].label(w.k))}</span>
          <span>${Math.round(w.p * 100)}% (${w.r}/${w.t})${w.med != null ? ' · ' + (w.med / 1000).toFixed(1).replace('.', ',') + ' s' : ''}</span></a>`).join('')
        : '<p class="note">Nog niets: na minstens 5 pogingen per item zie je hier wat je het vaakst mist.</p>'}</div>
      <div class="sccol"><h3>Niveau-advies</h3>${adv.length ? adv.map(a =>
        `<a class="scadv${a.ready ? ' ready' : ''}${a.preset ? ' scpreset' : ''}" href="#${a.view}"${a.preset ? ` data-psg="${esc(a.preset.group)}" data-psp="${esc(a.preset.pid)}" title="Naar deze oefening (laadt de opgeslagen instellingen)"` : ''}><span><b>${esc(a.name)}</b> · ${esc(a.lvName)}</span>
          <span>${Math.round(a.p * 100)}% goed · ${a.n < 30 ? a.n + ' van 30 pogingen' : 'laatste 30'}</span>
          ${a.ready ? `<em>✓ Klaar voor de volgende stap: ${esc(a.next)}</em>` : `<div class="barbg"><div class="barfg" style="width:${a.p * 100}%"></div></div>`}</a>`).join('')
        : '<p class="note">Bij 90% goed over je laatste 30 pogingen op een niveau krijg je hier het advies om door te gaan.</p>'}</div>`;
    box.querySelectorAll('.scadv[data-psp]').forEach(el => el.onclick = e => { e.preventDefault(); Presets.go(el.dataset.psg, el.dataset.psp); });
  }
  setInterval(() => { if (typeof view !== 'undefined' && view === 'stats') render(); }, 30000);

  /* --- korte samenvatting als tekst (voor 💬 Vraag aan Claude, vraag-app.js) --- */
  function summary(){
    const st = streak(), now = secs(dayKey()), L = [];
    L.push('Dagreeks: ' + st.n + (st.n === 1 ? ' dag' : ' dagen') + ' op rij (daggoal 10 min actieve oefentijd in deze app, 1 vrije dag per week; vrije dag deze week ' + (st.freeUsed ? 'al gebruikt' : 'nog over') + ')');
    const per = Object.entries(time[dayKey()] || {}).filter(([, s]) => s >= 30).map(([v, s]) => (VNAME[v] || v) + ' ' + mmss(s)).join(', ');
    L.push('Vandaag geoefend: ' + mmss(now) + (per ? ' (' + per + ')' : ''));
    const d = new Date(); d.setHours(12); const days = [], tot = {};
    for (let i = 0; i < 7; i++){
      const k = dayKey(d); days.push(k.slice(5) + ': ' + Math.round(secs(k) / 60) + ' min');
      Object.entries(time[k] || {}).forEach(([v, s]) => { tot[v] = (tot[v] || 0) + s; });
      d.setDate(d.getDate() - 1);
    }
    L.push('Laatste 7 dagen (nieuwste eerst): ' + days.join(', '));
    const tv = Object.entries(tot).filter(([, s]) => s >= 60).sort((a, b) => b[1] - a[1]).map(([v, s]) => (VNAME[v] || v) + ' ' + mmss(s));
    if (tv.length) L.push('Per onderdeel, laatste 7 dagen: ' + tv.join(', '));
    const lab = w => { try { return defs[w.m].label(w.k); } catch(e){ return w.k; } };
    const weak = weakest();
    L.push('Zwakste punten (laatste 60 dagen, min. 5 pogingen): ' + (weak.length ? weak.map(w => defs[w.m].name + ' – ' + lab(w) + ': ' + Math.round(w.p * 100) + '% (' + w.r + '/' + w.t + ')').join('; ') : 'nog geen'));
    const adv = advices();
    L.push('Niveaus (laatste max. 30 pogingen per niveau): ' + (adv.length ? adv.map(a => a.name + ' · ' + a.lvName + ': ' + Math.round(a.p * 100) + '% goed over ' + a.n + ' pogingen' + (a.ready ? ' → klaar voor de volgende stap (' + a.next + ')' : '')).join('; ') : 'nog geen'));
    return L.join('\n');
  }

  // voor de Dagroutine (19-11-2026): welke onderdelen er zijn, leesbare labels, antwoorden sinds een tijdstip, oefentijd per dag
  const meta = () => Object.keys(defs).map(id => ({ id, name:defs[id].name, view:defs[id].view }));
  const label = (id, k) => { const d = defs[id]; try { return d && d.label ? d.label(k) : k; } catch(e){ return k; } };
  const since = t => log.filter(e => e.t >= t);
  const daySecs = d => secs(d || dayKey());
  return { def, ask, heard, log:add, tally, recent, today, clear, render, summary, meta, label, since, daySecs, streak };
})();
function scOnRoute(){ if (typeof view !== 'undefined' && view === 'stats') Score.render(); }
window.addEventListener('load', scOnRoute);
