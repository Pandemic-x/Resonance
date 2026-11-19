/* ================= Bibliotheek, favorieten, Doorgaan en Home-knop (19-11-2026, wens gebruiker) =================
   - 🔎 rechtsboven op Home (en Ctrl/Cmd+K) opent de bibliotheek: alle oefeningen uit Nav.NAV, zoeken op naam,
     categorie en uitleg, snel springen met ↑ ↓ Enter, en ☆ = favoriet. Favorieten staan bovenaan, en ook als
     knoppen op het startscherm.
   - Doorgaan: blokje in de themakleur rechts in de tabbalk onderaan → de laatst geopende oefening.
   - Op Statistieken, Handleiding en Instellingen: ← Home linksboven.
   Opslag: 'bib-favorieten' = [route…], 'bib-recent' = [route…] (nieuwste eerst, max 6). */
const Bib = (function(){
  const FKEY = 'bib-favorieten', RKEY = 'bib-recent';
  const load = k => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch(e){ return []; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // alle oefeningen, met hun categorie
  function alle(){
    const out = [];
    Nav.NAV.forEach(c => c.items.forEach(i => out.push({ route:i.route, name:i.name, icon:i.icon, desc:i.desc, cat:c.name, catId:c.id, catIcon:c.icon,
      zoek:norm(i.name + ' ' + c.name + ' ' + i.desc + (i.subs ? ' ' + i.subs.list.map(s => s.name).join(' ') : '')) })));
    return out;
  }
  const isFav = r => load(FKEY).includes(r);
  function toggleFav(r){ const f = load(FKEY), i = f.indexOf(r); if (i >= 0) f.splice(i, 1); else f.push(r); save(FKEY, f); renderHomeFavs(); }

  /* ---------- recent + Doorgaan ---------- */
  function onRoute(){
    const v = typeof view !== 'undefined' ? view : 'home';
    if (Nav.itemOf(v)){ const r = load(RKEY).filter(x => x !== v); r.unshift(v); save(RKEY, r.slice(0, 6)); }
    renderGo(); renderBack();
  }
  function renderGo(){
    const a = document.getElementById('tbGo'); if (!a) return;
    const r = load(RKEY).find(x => Nav.itemOf(x)), it = r && Nav.itemOf(r);
    a.hidden = !it; if (!it) return;
    a.href = '#' + r; a.title = 'Doorgaan: ' + it.name;
    a.innerHTML = '<span class="tbi">' + it.icon + '</span><span>Doorgaan</span>';
  }
  function renderBack(){
    const b = document.getElementById('tabBack'); if (!b) return;
    const v = typeof view !== 'undefined' ? view : 'home';
    b.hidden = !['stats', 'handleiding', 'instellingen'].includes(v);
  }

  /* ---------- favorieten op het startscherm ---------- */
  function renderHomeFavs(){
    const box = document.getElementById('homeFavs'); if (!box) return;
    const all = alle(), favs = load(FKEY).map(r => all.find(x => x.route === r)).filter(Boolean);
    box.hidden = !favs.length;
    box.innerHTML = favs.length ? '<div class="hfhead">⭐ Favorieten</div><div class="hfchips">' + favs.map(x => '<a class="hfchip" href="#' + x.route + '"><span class="hfi">' + x.icon + '</span>' + esc(x.name) + '</a>').join('') + '</div>' : '';
  }

  /* ---------- bibliotheek ---------- */
  let el = null, filter = 'alles', sel = 0, hits = [];
  function bouw(){
    el = document.createElement('div'); el.id = 'libBox'; el.className = 'libbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Bibliotheek');
    el.innerHTML = '<div class="libpanel">'
      + '<div class="libtop"><span class="libmag">🔎</span><input id="libQ" type="search" placeholder="Zoek een oefening… (bv. drone, intervallen, metronoom)" autocomplete="off" spellcheck="false"><button class="libx" id="libX" title="Sluiten (Esc)" aria-label="Sluiten">✕</button></div>'
      + '<div class="libchips" id="libChips"></div>'
      + '<div class="liblist" id="libList"></div>'
      + '<p class="libfoot muted">↑ ↓ kiezen · Enter openen · ☆ favoriet · Esc sluiten</p></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) sluit(); });
    document.getElementById('libX').onclick = sluit;
    const q = document.getElementById('libQ');
    q.oninput = () => { sel = 0; lijst(); };
    q.onkeydown = e => {
      e.stopPropagation();
      if (e.key === 'Escape'){ e.preventDefault(); if (q.value) { q.value = ''; sel = 0; lijst(); } else sluit(); }
      else if (e.key === 'ArrowDown'){ e.preventDefault(); kies(sel + 1); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); kies(sel - 1); }
      else if (e.key === 'Enter'){ e.preventDefault(); if (hits[sel]) ga(hits[sel].route); }
    };
  }
  function chips(){
    const c = [['alles', 'Alles'], ['fav', '⭐ Favorieten']].concat(Nav.NAV.map(x => [x.id, x.icon + ' ' + x.name]));
    const box = document.getElementById('libChips');
    box.innerHTML = c.map(([id, n]) => '<button type="button" class="libchip' + (filter === id ? ' on' : '') + '" data-f="' + id + '">' + esc(n) + '</button>').join('');
    box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; sel = 0; chips(); lijst(); document.getElementById('libQ').focus(); });
  }
  function rij(x, i){
    const f = isFav(x.route);
    return '<div class="librow' + (i === sel ? ' sel' : '') + '" data-i="' + i + '"><a href="#' + x.route + '" data-r="' + x.route + '"><span class="lri">' + x.icon + '</span><span class="lrt"><strong>' + esc(x.name)
      + '</strong><small><b>' + esc(x.cat) + '</b> · ' + esc(x.desc) + '</small></span></a>'
      + '<button type="button" class="libstar' + (f ? ' on' : '') + '" data-s="' + x.route + '" title="' + (f ? 'Uit favorieten halen' : 'Favoriet maken') + '" aria-pressed="' + f + '">⭐</button></div>';
  }
  function lijst(){
    const q = norm(document.getElementById('libQ').value.trim()), woorden = q.split(/\s+/).filter(Boolean);
    let all = alle();
    if (filter === 'fav') all = all.filter(x => isFav(x.route));
    else if (filter !== 'alles') all = all.filter(x => x.catId === filter);
    const box = document.getElementById('libList');
    let html = '';
    if (woorden.length){
      hits = all.filter(x => woorden.every(w => x.zoek.includes(w)))
        .sort((a, b) => (norm(b.name).startsWith(woorden[0]) - norm(a.name).startsWith(woorden[0])) || (isFav(b.route) - isFav(a.route)));
      html = hits.length ? hits.map(rij).join('') : '<p class="libempty">Niets gevonden voor “' + esc(document.getElementById('libQ').value) + '”.</p>';
    } else {
      // zonder zoekwoord: favorieten en recent bovenaan, daarna per categorie
      const groepen = [];
      if (filter === 'alles'){
        const favs = load(FKEY).map(r => all.find(x => x.route === r)).filter(Boolean);
        if (favs.length) groepen.push(['⭐ Favorieten', favs]);
        const rec = load(RKEY).map(r => all.find(x => x.route === r)).filter(x => x && !isFav(x.route)).slice(0, 3);
        if (rec.length) groepen.push(['🔁 Recent', rec]);
      }
      if (filter === 'fav' && !all.length) html = '<p class="libempty">Nog geen favorieten. Tik op ☆ bij een oefening.</p>';
      Nav.NAV.forEach(c => { const g = all.filter(x => x.catId === c.id && (filter !== 'alles' || !groepen.some(([, l]) => l.includes(x)))); if (g.length && filter !== 'fav') groepen.push([c.icon + ' ' + c.name, g]); });
      if (filter === 'fav' && all.length) groepen.push(['⭐ Favorieten', all]);
      hits = []; groepen.forEach(([t, l]) => { html += '<div class="libgroup">' + esc(t) + '</div>'; l.forEach(x => { html += rij(x, hits.length); hits.push(x); }); });
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-s]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); toggleFav(b.dataset.s); lijst(); });
    box.querySelectorAll('a[data-r]').forEach(a => a.onclick = e => { e.preventDefault(); ga(a.dataset.r); });
  }
  function kies(i){
    if (!hits.length) return;
    sel = (i + hits.length) % hits.length;
    document.querySelectorAll('#libList .librow').forEach(r => r.classList.toggle('sel', +r.dataset.i === sel));
    const r = document.querySelector('#libList .librow.sel'); if (r) r.scrollIntoView({ block:'nearest' });
  }
  function ga(r){ sluit(); if (location.hash.replace('#', '') === r && typeof route === 'function') route(); else location.hash = r; }
  function open(){
    if (!el) bouw();
    filter = 'alles'; sel = 0;
    const q = document.getElementById('libQ'); q.value = '';
    chips(); lijst();
    el.classList.add('open'); document.documentElement.classList.add('libopen');
    setTimeout(() => q.focus(), 30);
  }
  function sluit(){ if (!el) return; el.classList.remove('open'); document.documentElement.classList.remove('libopen'); }
  const isOpen = () => !!el && el.classList.contains('open');

  /* ---------- knoppen plaatsen ---------- */
  function init(){
    const hw = document.querySelector('#homeView .homewrap');
    if (hw && !document.getElementById('libBtn')){
      const b = document.createElement('button'); b.id = 'libBtn'; b.type = 'button'; b.className = 'libbtn';
      b.title = 'Zoek een oefening (Ctrl+K)'; b.setAttribute('aria-label', 'Bibliotheek: zoek een oefening');
      b.innerHTML = '🔎'; b.onclick = open;
      document.getElementById('homeView').appendChild(b);
      const f = document.createElement('div'); f.id = 'homeFavs'; f.className = 'homefavs'; f.hidden = true;
      hw.appendChild(f);
    }
    const tb = document.getElementById('tabbar');
    if (tb && !document.getElementById('tbGo')){
      const a = document.createElement('a'); a.id = 'tbGo'; a.className = 'tbgo'; a.hidden = true; a.dataset.t = 'doorgaan';
      tb.appendChild(a);
    }
    if (!document.getElementById('tabBack')){
      const b = document.createElement('a'); b.id = 'tabBack'; b.className = 'tabback'; b.href = '#'; b.hidden = true;
      b.innerHTML = '<span aria-hidden="true">←</span> Home'; b.title = 'Terug naar Home';
      b.onclick = e => { e.preventDefault(); location.hash = ''; if (typeof route === 'function') route(); };
      document.body.appendChild(b);
    }
    renderHomeFavs(); onRoute();
  }
  window.addEventListener('hashchange', () => setTimeout(onRoute, 0));
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k'){ e.preventDefault(); e.stopImmediatePropagation(); isOpen() ? sluit() : open(); }
    else if (e.key === 'Escape' && isOpen()){ e.preventDefault(); e.stopImmediatePropagation(); sluit(); }
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { open, sluit, toggleFav, isFav };
})();
