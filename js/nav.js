/* ================= Navigatie (`Nav`): hoofdmenu met 3 categorieën, categoriepagina's, startscherm en kruimelpad =================
   Eén lijst (NAV) bepaalt alles, zodat menu, categoriepagina, startscherm en kruimelpad altijd kloppen:
     categorie {id = route, name, icon, desc, items:[{route, name, icon, desc, subs?}]}
     subs (onderdelen binnen een oefening met een eigen overzicht): {id, name, get() → huidig id of null (overzicht), go(id), board()}
   Kruimelpad #crumbs:  ←  Home › Gehoor ▾ › Drone ▾ › Melodieën ▾
     ← = één niveau omhoog (onderdeel → overzicht van de oefening → categorie → home); elk stuk is klikbaar;
     ▾ opent een keuzelijst met de andere keuzes op dat niveau (de huidige gemarkeerd).
   Routes: categorieën #bladmuziek (Repertoire = #partituren) #ritme #gehoortraining #notenlezen (view #catView); Notenlezen-oefeningen #noten #toonsoorten
   #toonladders-blad #intervallen-blad #akkoorden-blad (alle in #ntView). #notenleer en #sheetmusic (oud) → #notenlezen.
   Nieuwe oefening: route in router.js + een regel in NAV hieronder. */

const Nav = (function(){
  const mk = (id, name) => ({ id, name });
  const NAV = [
    // Bladmuziek staat bewust bovenaan (wens gebruiker 14-11): je echte stukken. Later komen hier meer onderdelen bij.
    // (Een categorie kan ook direct = route krijgen: dan opent de rij op het startscherm meteen die route.)
    { id:'bladmuziek', name:'Bladmuziek', icon:'🎼', desc:'Je eigen stukken: afspelen met meelopende cursor, passages oefenen op tempo, volledig scherm.', items:[
      { route:'partituren', icon:'🗂️', name:'Repertoire', desc:'Je eigen stukken (MusicXML): afspelen met meelopende cursor, passages op tempo oefenen, volledig scherm.' }
    ]},
    { id:'ritme', name:'Ritme', icon:'🥁', desc:'Ritmes lezen, spelen en herkennen, van basis tot polyritmes.', items:[
      { route:'atlas', icon:'📖', name:'Atlas', desc:'Het naslagwerk: alle ritmes per categorie in notenschrift. Bekijk ze, luister ernaar en speel mee.' },
      { route:'tikken', icon:'🥁', name:'Tikken', desc:'Random ritmes van blad spelen of tikken, bijvoorbeeld op je practice pad. In de doorlopende modus komen er steeds nieuwe variaties bij.' },
      { route:'luisteren', icon:'👂', name:'Ritme luisteren', desc:'Je hoort een ritme en kiest of schrijft de juiste notatie. Met score en je zwakke plekken per categorie.',
        subs:{ list:[mk('mc', 'Meerkeuze'), mk('dict', 'Dictee')],
               get:() => $('quizView').classList.contains('board') ? null : (typeof sub !== 'undefined' ? sub : null),
               go:id => setSub(id), board:() => lBoard() } },
      { route:'metronoom', icon:'⏱️', name:'Slimme metronoom', desc:'Accenten per tel, onderverdeling en swing, ook 5/8 en 7/8. Bouw het tempo stap voor stap op en test je eigen timing met stille maten.' },
      { route:'rudiments', icon:'🥢', name:'Rudiments', desc:'De basisfiguren voor je practice pad: rolls, paradiddles, flams en drags, met sticking, accenten en een metronoom die mee opbouwt.' },
      { route:'polyritme', icon:'🌀', name:'Polyritme', desc:'3 tegen 2, 4 tegen 3, 5 tegen 4 …: zie en hoor waar elke slag valt, speel één hand zelf en tik mee met twee handen.' },
      { route:'tempoladder', icon:'📈', name:'Tempo-ladder', desc:'Automatisch een trede sneller zolang je strak blijft. Tik mee en de app meet het, of beoordeel zelf terwijl je speelt.' },
      { route:'swing', icon:'🎷', name:'Swing', desc:'Hoor het verschil tussen recht, licht, triool- en zware swing, en meet hoeveel swing jij zelf speelt.' }
    ]},
    { id:'gehoortraining', name:'Gehoor', icon:'🎶', desc:'Toonhoogte, melodie en harmonie herkennen.', items:[
      { route:'gehoor', icon:'🎶', name:'Relatief gehoor', desc:'Hoor elke toon als trap in de toonsoort: do, re, mi… Met cadens, oplossen naar do en korte melodieën. De basis om melodieën op gehoor na te spelen.' },
      { route:'absoluut', icon:'🎯', name:'Absoluut gehoor', desc:'Eén losse toon, geen referentie: welke noot is het? Met meerdere instrumenten en een instelbaar register, van heel laag tot heel hoog.' },
      { route:'intervallen', icon:'📐', name:'Intervallen', desc:'Twee tonen: hoe groot is de afstand? Stijgend, dalend en samen, tot het dubbel octaaf, met een geheugensteun-liedje per interval.' },
      { route:'dictee', icon:'✍️', name:'Melodisch dictee', desc:'Hoor een korte melodie en schrijf hem op in notenschrift, eerst alleen de tonen, later met ritme. De directe opstap naar stukken op gehoor naspelen.' },
      { route:'drone', icon:'🎻', name:'Drone', desc:'Een blijvende grondtoon om zuiver tegen te spelen: vrij spelen met toonladders, trappen herkennen (Degrees) en melodieën naspelen.',
        subs:{ list:[mk('vrij', 'Vrij spelen'), mk('trap', 'Degrees'), mk('melo', 'Melodieën')],
               get:() => $('droneView').classList.contains('board') ? null : drS.sub,
               go:id => dtSub(id), board:() => dtBoard() } },
      { route:'intonatie', icon:'🎚️', name:'Intonatie', desc:'Boven een drone: is de toon te hoog, te laag of zuiver? Of zet hem zelf zuiver. Leert je het zweven horen, tot op een paar cent.' },
      { route:'toonladders', icon:'🪜', name:'Toonladders', desc:'Hoor een toonladder: welke soort is het? Majeur, mineur, de kerktoonladders, pentatonisch, blues, heletoons en meer.' },
      { route:'akkoorden', icon:'🎹', name:'Akkoorden', desc:'Hoor een akkoord: major, minor, diminished, augmented, 7th- en jazz-akkoorden, ook in omkering.' },
      { route:'cadensen', icon:'🏁', name:'Cadensen', desc:'Hoe eindigt de frase? Authentiek, half, plagaal, bedrieglijk of Frygisch slot, in majeur en mineur.' },
      { route:'baslijn', icon:'🎸', name:'Baslijn', desc:'Hoor een reeks akkoorden en schrijf alleen de bastonen op als trappen, later ook met omkeringen. De opstap naar progressies op gehoor.' },
      { route:'progressies', icon:'🧩', name:'Akkoordprogressies', desc:'Hoor een reeks akkoorden en schrijf ze op als trappen: I–IV–V, ii–V–I, de pop-progressie, Pachelbel en meer.' }
    ]},
    { id:'notenlezen', name:'Notenlezen', icon:'📖', desc:'Noten, voortekens, intervallen, toonladders en akkoorden lezen.', items:[
      { route:'noten', icon:'🎯', name:'Noten benoemen', desc:'Eén noot op de balk: welke is het? Alle sleutels en de pianobalk, met hulplijnen, voortekens en toonsoorten.' },
      { route:'toonsoorten', icon:'🔑', name:'Toonsoorten', desc:'Een voortekening: welke toonsoort? Majeur, mineur en de kerktoonladders (3♭ + "___ dorisch" = F).' },
      { route:'toonladders-blad', icon:'🪜', name:'Toonladders', desc:'Een toonladder op de balk: welke soort is het? Van majeur en mineur tot blues, heletoons en alterated.' },
      { route:'intervallen-blad', icon:'📐', name:'Intervallen', desc:'Twee noten op de balk: welk interval? Van secunde tot dubbel octaaf, ook overmatig en verminderd.' },
      { route:'akkoorden-blad', icon:'🎹', name:'Akkoorden', desc:'Een akkoord op de balk: welke soort? Major, minor, diminished, 7th- en jazz-akkoorden, ook in omkering.' },
      { route:'akkoordsymbolen', icon:'🔣', name:'Akkoordsymbolen', desc:'Een symbool zoals Dm7, B♭maj7 of G7♭9: tik de tonen aan op het klavier. Voor leadsheets en jazzpiano.' },
      { route:'termen', icon:'🔤', name:'Termen', desc:'Italiaanse en andere muziektermen: tempo, dynamiek, karakter, strijktechniek en meer. Zet er ook zelf nieuwe bij.' }
    ]}
  ];
  const catOf = route => NAV.find(c => c.id === route || c.items.some(i => i.route === route)) || null;
  const itemOf = route => { for (const c of NAV) for (const i of c.items) if (i.route === route) return i; return null; };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const card = i => `<a class="mode" href="#${i.route}"><span class="mi">${i.icon}</span><strong>${esc(i.name)}</strong><span>${esc(i.desc)}</span></a>`;
  const block = c => `<div class="compart"><div class="comphead"><span class="ci">${c.icon}</span><div><h3><a href="#${c.id}">${esc(c.name)}</a></h3><p>${esc(c.desc)}</p></div></div><div class="modes">${c.items.map(card).join('')}</div></div>`;

  /* --- pagina's: lijsten met grote rijen (zoals Sonofield) --- */
  const row = (href, icon, name, desc) => `<a class="navrow" href="#${href}"><span class="nri">${icon}</span><span class="nrt"><strong>${esc(name)}</strong><small>${esc(desc)}</small></span><span class="nrc" aria-hidden="true">›</span></a>`;
  function renderHome(){ const el = document.getElementById('homeList'); if (el && !el.dataset.done){ el.innerHTML = NAV.map(c => row(c.direct || c.id, c.icon, c.name, c.desc)).join(''); el.dataset.done = '1'; } }
  function renderCat(c){
    const el = document.getElementById('catView'); if (!el) return;
    el.innerHTML = `<div class="catwrap"><div class="cathead"><span class="ci">${c.icon}</span><div><h2>${esc(c.name)}</h2><p>${esc(c.desc)}</p></div></div>` +
      `<div class="navlist">${c.items.map(i => row(i.route, i.icon, i.name, i.desc)).join('')}</div></div>`;
  }

  /* --- schuifanimatie tussen pagina's ---
     dieper (home → categorie → oefening → onderdeel) = nieuwe pagina schuift van rechts naar links in, de oude gaat links weg;
     terug (ondieper) = andersom. Tussen de tabbladen onderaan en tussen categorieën: richting volgens de volgorde. */
  const TABS = ['home', 'stats', 'handleiding', 'instellingen'];
  const depth = v => TABS.includes(v) ? 0 : NAV.some(c => c.id === v || c.direct === v) ? 1 : 2;
  const order = v => { const t = TABS.indexOf(v); if (t >= 0) return t; const c = NAV.findIndex(x => x.id === v); if (c >= 0) return c; const cat = catOf(v); return cat ? cat.items.findIndex(i => i.route === v) : 0; };
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ghost = null, lastSlide = 0;
  function anim(el, cls){ el.classList.remove('slin-r', 'slin-l'); void el.offsetWidth; el.classList.add(cls);
    const end = e => { if (e && e.target !== el) return; el.classList.remove(cls); el.removeEventListener('animationend', end); }; el.addEventListener('animationend', end); setTimeout(() => end(), 800); }
  function slide(from, to, oldEl, newEl, rect){
    if (!from || from === to || !newEl || still()) return;
    const dFrom = depth(from), dTo = depth(to);
    const fwd = dTo !== dFrom ? dTo > dFrom : order(to) >= order(from);
    if (ghost && ghost.kill) ghost.kill(); ghost = null;
    if (oldEl && oldEl !== newEl && rect){           // de oude pagina blijft even staan (vast op zijn plek) en schuift eruit
      const g = oldEl; ghost = g;
      g.classList.remove('slout-l', 'slout-r');
      Object.assign(g.style, { top:rect.top + 'px', left:rect.left + 'px', width:rect.width + 'px' });
      void g.offsetWidth; g.classList.add('slghost', fwd ? 'slout-l' : 'slout-r'); g.setAttribute('aria-hidden', 'true');
      const kill = e => { if (e && e.target !== g) return; g.classList.remove('slghost', 'slout-l', 'slout-r'); g.removeAttribute('aria-hidden'); g.style.top = g.style.left = g.style.width = ''; if (ghost === g) ghost = null; g.removeEventListener('animationend', kill); };
      g.addEventListener('animationend', kill); setTimeout(() => kill(), 800); ghost.kill = () => kill();
    }
    anim(newEl, fwd ? 'slin-r' : 'slin-l'); lastSlide = Date.now();
  }

  /* --- kruimelpad --- */
  let menuEl = null;
  function closeMenu(){ if (menuEl){ menuEl.remove(); menuEl = null; } }
  function openMenu(btn, entries){
    closeMenu();
    menuEl = document.createElement('div'); menuEl.className = 'crumbmenu'; menuEl.setAttribute('role', 'menu');
    entries.forEach(e => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'crumbopt' + (e.on ? ' on' : '');
      b.innerHTML = (e.icon ? `<span>${e.icon}</span> ` : '') + esc(e.name) + (e.on ? ' <small>(hier ben je)</small>' : '');
      b.onclick = () => { closeMenu(); if (!e.on) e.go(); };
      menuEl.appendChild(b);
    });
    document.body.appendChild(menuEl);
    const r = btn.getBoundingClientRect();
    menuEl.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - menuEl.offsetWidth - 8)) + 'px';
    menuEl.style.top = (r.bottom + window.scrollY + 4) + 'px';
    const first = menuEl.querySelector('.crumbopt'); if (first) first.focus();
  }
  document.addEventListener('click', e => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest('.crumbcaret, .crumbcur')) closeMenu(); }, true);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && menuEl){ closeMenu(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('resize', closeMenu);

  const goRoute = r => { if (location.hash.replace('#', '') === r && typeof route === 'function') route(); else location.hash = r; };
  // levels: [{name, go, siblings:[{name, icon, on, go}]}] van home naar huidig
  function levels(){
    const v = typeof view !== 'undefined' ? view : 'home';
    if (TABS.includes(v)) return [];               // tabbladen: de tabbalk onderaan is de navigatie
    const out = [{ name:'Home', icon:'🏠', go:() => goRoute('') }];
    const c = catOf(v);
    if (!c){                                         // instellingen, handleiding
      out.push({ name:v === 'instellingen' ? 'Instellingen' : v === 'handleiding' ? 'Handleiding' : v === 'dagroutine' ? 'Dagroutine' : v });
      return out;
    }
    const sibs = NAV.map(x => ({ name:x.name, icon:x.icon, on:x === c, go:() => goRoute(x.direct || x.id) }));
    if (c.direct){ out.push({ name:c.name, icon:c.icon, go:() => goRoute(c.direct), siblings:sibs }); return out; }
    out.push({ name:c.name, icon:c.icon, go:() => goRoute(c.id), siblings:sibs });
    if (v === c.id) return out;
    const it = itemOf(v);
    out.push({ name:it.name, icon:it.icon, go:() => { if (it.subs && v === it.route) it.subs.board(); else goRoute(it.route); },
               siblings:c.items.map(x => ({ name:x.name, icon:x.icon, on:x === it, go:() => goRoute(x.route) })) });
    if (it.subs){
      const cur = it.subs.get();
      if (cur){
        const s = it.subs.list.find(x => x.id === cur);
        if (s) out.push({ name:s.name, siblings:it.subs.list.map(x => ({ name:x.name, on:x.id === cur, go:() => it.subs.go(x.id) })) });
      }
    }
    return out;
  }
  function renderCrumbs(){
    const el = document.getElementById('crumbs'); if (!el) return;
    closeMenu();
    const L = levels();
    el.hidden = !L.length; if (!L.length){ el.innerHTML = ''; return; }
    el.innerHTML = '';
    const back = document.createElement('button'); back.type = 'button'; back.className = 'crumbback';
    back.textContent = '←'; back.title = 'Terug naar ' + L[L.length - 2].name; back.setAttribute('aria-label', back.title);
    back.onclick = () => { back.blur(); L[L.length - 2].go(); };
    el.appendChild(back);
    const toggle = (btn, sibs) => e => { e.stopPropagation(); btn.blur(); if (menuEl) closeMenu(); else openMenu(btn, sibs); };
    L.forEach((lv, i) => {
      if (i){ const sep = document.createElement('span'); sep.className = 'crumbsep'; sep.textContent = '›'; el.appendChild(sep); }
      const last = i === L.length - 1, many = lv.siblings && lv.siblings.length > 1, seg = document.createElement('span');
      seg.className = 'crumbseg' + (last ? ' cur' : '');
      if (last){                                     // waar je nu bent: de hele pil opent de keuzelijst (erheen gaan heeft geen zin)
        const b = document.createElement('button'); b.type = 'button'; b.className = 'crumbcur' + (many ? '' : ' solo');
        b.innerHTML = esc(lv.name) + (many ? ' <span class="cv">▾</span>' : '');
        if (many){ b.title = 'Wissel naar een ander onderdeel'; b.setAttribute('aria-haspopup', 'menu'); b.onclick = toggle(b, lv.siblings); }
        seg.appendChild(b);
      } else {
        const a = document.createElement('button'); a.type = 'button'; a.className = 'crumblink';
        a.textContent = (lv.icon && i === 0 ? lv.icon + ' ' : '') + lv.name; a.title = 'Naar ' + lv.name;
        a.onclick = () => { a.blur(); lv.go(); };
        if (many){                                   // naam = erheen, ▾ = keuzelijst, samen in één pil
          const pill = document.createElement('span'); pill.className = 'crumbpill';
          const c = document.createElement('button'); c.type = 'button'; c.className = 'crumbcaret'; c.textContent = '▾';
          c.title = 'Kies een ander onderdeel'; c.setAttribute('aria-haspopup', 'menu'); c.onclick = toggle(c, lv.siblings);
          pill.appendChild(a); pill.appendChild(c); seg.appendChild(pill);
        } else seg.appendChild(a);
      }
      el.appendChild(seg);
    });
    el.scrollLeft = el.scrollWidth;                  // smal scherm: het huidige onderdeel in beeld
  }

  /* --- menu bovenaan: categorie van de huidige view oplichten --- */
  function renderTabs(){
    const v = typeof view !== 'undefined' ? view : 'home', c = catOf(v);
    document.querySelectorAll('#catTabs button').forEach(b => b.classList.toggle('on', !!c && b.dataset.view === c.id));
  }

  function render(){
    const v = typeof view !== 'undefined' ? view : 'home';
    renderHome(); renderTabs();
    const c = NAV.find(x => x.id === v); if (c) renderCat(c);
    renderCrumbs();
  }
  // onderdelen (Drone, Ritme luisteren) wisselen zonder routewissel → kruimelpad bijwerken
  // en het overzicht ↔ onderdeel ook laten schuiven (dieper = van rechts, terug naar het overzicht = van links)
  const watch = () => ['droneView', 'quizView'].forEach(id => { const el = document.getElementById(id); if (!el) return;
    let board = el.classList.contains('board');
    new MutationObserver(() => {
      renderCrumbs();
      const b = el.classList.contains('board');
      if (b !== board){ board = b; if (el.classList.contains('on') && Date.now() - lastSlide > 200 && !still()) anim(el, b ? 'slin-l' : 'slin-r'); }
    }).observe(el, { attributes:true, attributeFilter:['class'] }); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();   // Home-rijen zo vroeg mogelijk (zachte start, v1.11)
  window.addEventListener('load', () => { watch(); render(); });
  return { NAV, render, catOf, itemOf, slide, depth, CAT_IDS:NAV.map(c => c.id) };
})();
function navOnRoute(){ Nav.render(); }
