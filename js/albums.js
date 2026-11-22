/* ================= Albums in Repertoire (js/albums.js, prefix ptAlb / ptLib) — 22-11-2026 =================
   Wens gebruiker: niet alles in één lange bibliotheek. Je stukken en hun passages ("subblokken") in albums zetten en daar
   zelf de volgorde bepalen, bv. album "Carl Flesch" met per toonladder een passage van het grote Flesch-bestand.
   Een passage openen = Focus (alleen die maten tekenen, daarna uit de cache): zo hoeft een groot boek nooit helemaal getekend te worden.

   - Opslag: localStorage 'partituren-albums' = [{id, naam, made, items:[{id (stuk), p (passage-id of null = hele stuk)}]}].
     Gaat mee in de back-up en de synchronisatie (hele localStorage). Een stuk of passage kan in meerdere albums staan;
     uit een album halen verwijdert niets. Verwijzingen naar weggehaalde stukken/passages worden opgeruimd (ptAlbClean).
   - Bibliotheek (ptLibRender, aangeroepen door ptRenderList): bovenaan de albums, daaronder de stukken die (nog) niet in
     een album staan (knop: ook de rest tonen). ▸ bij een stuk = zijn passages eronder; 📁 = in een album zetten
     (bij een stuk: het hele stuk of al zijn passages als losse onderdelen). Album openen = lijst in jouw volgorde
     (een heel stuk heeft daar ook ▸ met zijn blokken; die openen met het album als context),
     ↑ ↓ of slepen (laptop) om te sorteren, ✕ = uit het album.
   - Speler: geopend vanuit een album → ‹ › (#ptAlbNav) naar het vorige/volgende onderdeel, en "📁 naam · 3/24" onder de titel.
     ptOpen roept ptAlbOnOpen() aan; ptAlbPending wordt alleen gezet door ptAlbOpen, dus elke andere manier van openen
     haalt het album uit de speler. Nieuw stuk toevoegen terwijl een album open staat → komt ook in dat album (ptAlbAutoAdd). */

const PT_ALB_KEY = 'partituren-albums';
let ptAlbs = [], ptLibAlb = null, ptLibOpenSet = new Set(), ptLibMenu = null, ptLibAll = false;
let ptAlbCtx = null, ptAlbPending = null, ptLibNewAlb = false, ptLibRen = false, ptLibMenuMode = 'stuk';
(function(){ try { const o = JSON.parse(localStorage.getItem(PT_ALB_KEY)); ptAlbs = Array.isArray(o) ? o.filter(a => a && a.id && Array.isArray(a.items)) : []; } catch(e){ ptAlbs = []; } })();
function ptAlbSave(){ try { localStorage.setItem(PT_ALB_KEY, JSON.stringify(ptAlbs)); } catch(e){} }
const ptAlbGet = id => ptAlbs.find(a => a.id === id) || null;
const ptAlbPiece = id => ptList.find(x => x.id === id) || null;
const ptAlbPas = (it, p) => p ? (it && it.pas || []).find(x => x.id === p) || null : null;
function ptAlbClean(){   // alleen als de stukken echt geladen zijn (anders zou een mislukte database alle albums leeghalen)
  if (!PtDB.ok() || !ptList.length) return;
  let ch = false;
  ptAlbs.forEach(a => {
    const n = a.items.filter(r => { const it = ptAlbPiece(r.id); return it && (!r.p || ptAlbPas(it, r.p)); });
    if (n.length !== a.items.length){ a.items = n; ch = true; }
  });
  if (ch) ptAlbSave();
}
function ptAlbNew(naam){
  const a = { id:'al' + Date.now().toString(36), naam:(naam || '').trim().slice(0, 60) || 'Nieuw album', made:ptToday(), items:[] };
  ptAlbs.push(a); ptAlbSave(); return a;
}
function ptAlbAdd(a, refs){   // refs = [{id, p}], dubbele overslaan
  refs.forEach(r => { if (!a.items.some(x => x.id === r.id && (x.p || null) === (r.p || null))) a.items.push({ id:r.id, p:r.p || null }); });
  ptAlbSave();
}
function ptAlbAutoAdd(id){ const a = ptLibAlb && ptAlbGet(ptLibAlb); if (a) ptAlbAdd(a, [{ id, p:null }]); }
const ptAlbIn = id => ptAlbs.some(a => a.items.some(r => r.id === id));

/* ---------- regels in de lijst ---------- */
function ptLibItemHTML(it, p, extra){   // knop met titel + regel eronder; p = passage of null
  const ic = it.instr && PT_INSTR[it.instr] ? PT_INSTR[it.instr].split(' ')[0] + ' ' : '';
  if (p) return `<b>${PT_STATUS[p.status] ? PT_STATUS[p.status].i + ' ' : ''}${ptEsc(p.naam)}</b><small>${ptEsc([extra ? (it.titel || it.naam) : '', ptPasMeta(p)].filter(Boolean).join(' · '))}</small>`;
  const ps = it.pas || [], c = k => ps.filter(x => x.status === k).length;
  const sum = ps.length ? ps.length + ' passage' + (ps.length === 1 ? '' : 's') + ' (' + ['zit', 'bezig', 'nieuw'].filter(k => c(k)).map(k => PT_STATUS[k].i + c(k)).join(' ') + ')' : '';
  return `<b>${ic}${ptEsc(it.titel || it.naam)}</b><small>${ptEsc([extra ? 'hele stuk' : '', it.comp, it.maten ? it.maten + ' maten' : '', sum, it.last ? 'geoefend ' + ptDay(it.last) : 'nieuw'].filter(Boolean).join(' · '))}</small>`;
}
function ptLibMenuHTML(key){   // 📁 → in welk album?
  const [id, p] = key.split('|'), it = ptAlbPiece(id), np = !p && it ? (it.pas || []).length : 0;
  const mode = np ? ptLibMenuMode : 'stuk';
  const has = a => mode === 'pas' ? np && it.pas.every(x => a.items.some(r => r.id === id && r.p === x.id)) : a.items.some(r => r.id === id && (r.p || null) === (p || null));
  return `<div class="ptalbmenu" data-k="${ptEsc(key)}">
    ${np ? `<div class="ptseg ptalbwhat"><button data-mode="stuk" class="${mode === 'stuk' ? 'on' : ''}">Hele stuk</button><button data-mode="pas" class="${mode === 'pas' ? 'on' : ''}">Alle ${np} passages, los</button></div>` : ''}
    <div class="ptalbchoose">${ptAlbs.map(a => `<button class="ptfchip${has(a) ? ' on' : ''}" data-a="${a.id}">📁 ${ptEsc(a.naam)}${has(a) ? ' ✓' : ''}</button>`).join('')}
    <span class="ptalbnewin"><input type="text" maxlength="60" placeholder="${ptAlbs.length ? 'of een nieuw album…' : 'Naam van het album, bv. Carl Flesch'}"><button class="ptfchip" data-new="1">＋ Album</button></span></div>
    <small class="muted">${mode === 'pas' ? 'Elke passage wordt een eigen onderdeel van het album, in de volgorde van het stuk. Openen = alleen die maten (snel).' : p ? 'De passage opent in Focus: alleen die maten worden getekend.' : 'Tik nog eens op 📁 om te sluiten.'}</small>
  </div>`;
}
function ptLibPieceHTML(it){
  const ps = it.pas || [], open = ptLibOpenSet.has(it.id);
  let h = `<div class="ptitem" data-id="${it.id}"><div class="ptrow">
    ${ps.length ? `<button class="ptexp" data-x="${it.id}" title="${open ? 'Passages verbergen' : 'Passages tonen'}">${open ? '▾' : '▸'}</button>` : '<span class="ptexp0"></span>'}
    <button class="ptopen" data-id="${it.id}">${ptLibItemHTML(it, null)}</button>
    <button class="ptaddalb${ptLibMenu === it.id ? ' on' : ''}" data-k="${it.id}" title="In een album zetten">📁</button>
    <button class="ptdel" data-id="${it.id}" title="Verwijderen (twee keer klikken)">✕</button></div>`;
  if (ptLibMenu === it.id) h += ptLibMenuHTML(it.id);
  if (open && ps.length){
    h += '<div class="ptsubs">' + ps.map(p => {
      const k = it.id + '|' + p.id;
      return `<div class="ptrow ptsub"><button class="ptopen" data-id="${it.id}" data-p="${p.id}">${ptLibItemHTML(it, p)}</button><button class="ptaddalb${ptLibMenu === k ? ' on' : ''}" data-k="${k}" title="In een album zetten">📁</button></div>` + (ptLibMenu === k ? ptLibMenuHTML(k) : '');
    }).join('') + '</div>';
  }
  return h + '</div>';
}

/* ---------- bibliotheek ---------- */
function ptLibRender(shown){
  ptAlbClean();
  const el = $('ptList'), a = ptLibAlb && ptAlbGet(ptLibAlb);
  if (ptLibAlb && !a) ptLibAlb = null;
  $('ptView').classList.toggle('pt-inalb', !!a);
  if (a){ ptLibAlbum(a, el); return; }
  if (!ptList.length){ el.innerHTML = '<p class="muted ptempty">Nog geen stukken. Voeg een MusicXML-bestand toe, of probeer eerst het voorbeeld.</p>'; return; }
  const cnt = a2 => a2.items.length;
  let h = `<div class="ptalbs"><div class="rlabel">Albums</div><div class="ptalbgrid">` +
    ptAlbs.map(x => `<button class="ptalb" data-a="${x.id}"><span>📁</span><b>${ptEsc(x.naam)}</b><small>${cnt(x)} onderde${cnt(x) === 1 ? 'el' : 'len'}</small></button>`).join('') +
    (ptLibNewAlb ? `<span class="ptalb ptalbnewbox"><input type="text" id="ptAlbNewIn" maxlength="60" placeholder="Naam, bv. Carl Flesch"><span><button class="ptfchip on" id="ptAlbNewOk">Maken</button><button class="ptfchip" id="ptAlbNewNo">Annuleren</button></span></span>`
      : `<button class="ptalb ptalbnew" id="ptAlbNewBtn"><span>＋</span><b>Nieuw album</b><small>${ptAlbs.length ? 'stukken en passages bundelen' : 'bv. Carl Flesch, Bach, etudes'}</small></button>`) +
    '</div></div>';
  const loose = shown.filter(it => !ptAlbIn(it.id)), inAlb = shown.length - loose.length;
  const list = ptLibAll || !ptAlbs.length ? shown : loose;
  h += `<div class="rlabel">${ptAlbs.length && !ptLibAll ? 'Stukken zonder album' : 'Alle stukken'}</div>`;
  h += list.length ? '<div class="ptlist2">' + list.map(ptLibPieceHTML).join('') + '</div>' : '<p class="muted ptempty">Alle stukken staan in een album.</p>';
  if (ptAlbs.length && inAlb) h += `<button class="ptlink" id="ptLibAllBtn">${ptLibAll ? 'Alleen stukken zonder album tonen' : 'Ook de ' + inAlb + ' stuk' + (inAlb === 1 ? '' : 'ken') + ' uit albums tonen'}</button>`;
  el.innerHTML = h;
  if (ptLibNewAlb){ const i = $('ptAlbNewIn'); i.focus(); }
}
function ptLibAlbum(a, el){
  const rows = a.items.map((r, k) => {
    const it = ptAlbPiece(r.id), p = ptAlbPas(it, r.p); if (!it) return '';
    const ps = !p ? (it.pas || []) : [], open = ps.length && ptLibOpenSet.has('a:' + it.id);
    const subs = open ? '<div class="ptsubs ptalbsubs">' + ps.map(x => `<div class="ptrow ptsub"><button class="ptopen" data-k="${k}" data-p="${x.id}">${ptLibItemHTML(it, x)}</button></div>`).join('') + '</div>' : '';
    return `<div class="ptrow ptalbit" draggable="true" data-k="${k}"><span class="ptnum">${k + 1}</span>
      ${ps.length ? `<button class="ptexp" data-x="a:${it.id}" title="${open ? 'Blokken verbergen' : 'Blokken (passages) tonen'}">${open ? '▾' : '▸'}</button>` : ''}
      <button class="ptopen" data-k="${k}">${ptLibItemHTML(it, p, true)}</button>
      <span class="ptsort"><button class="ptup" data-k="${k}" title="Omhoog"${k ? '' : ' disabled'}>↑</button><button class="ptdn" data-k="${k}" title="Omlaag"${k < a.items.length - 1 ? '' : ' disabled'}>↓</button></span>
      <button class="ptout" data-k="${k}" title="Uit dit album halen (het stuk en de passage blijven bestaan)">✕</button></div>` + subs;
  }).join('');
  el.innerHTML = `<div class="ptalbhead">
      <button class="ptsmall" id="ptAlbBack">← Alle stukken</button>
      ${ptLibRen ? `<input type="text" id="ptAlbRenIn" maxlength="60" value="${ptEsc(a.naam)}"><button class="ptfchip on" id="ptAlbRenOk">Opslaan</button>`
        : `<b class="ptalbname">📁 ${ptEsc(a.naam)}</b><button class="ptsmall ptic" id="ptAlbRen" title="Naam wijzigen">✎</button>`}
      <span class="ptgap"></span><button class="ptdel" id="ptAlbDel" title="Album weghalen; de stukken blijven bestaan (twee keer klikken)">Album weghalen</button></div>` +
    (rows ? '<div class="ptlist2">' + rows + '</div><p class="muted ptwhere">Sorteren: ↑ ↓, of op de laptop een regel slepen. ✕ haalt iets alleen uit dit album. Een nieuw stuk dat je nu toevoegt, komt ook in dit album.</p>'
      : '<p class="muted ptempty">Dit album is nog leeg. Ga naar <b>← Alle stukken</b> en tik op 📁 bij een stuk of een passage (▸ toont de passages van een stuk). Of voeg nu een stuk toe: dat komt meteen in dit album.</p>');
  if (ptLibRen){ const i = $('ptAlbRenIn'); i.focus(); i.select(); }
}
function ptAlbOpen(aid, k, pas){   // pas = een blok van een heel stuk in het album (▸): album blijft de context voor ‹ ›
  const a = ptAlbGet(aid), r = a && a.items[k]; if (!r) return;
  ptAlbPending = { aid, k };
  ptOpen(r.id, r.p || pas || undefined);
}
function ptAlbOnOpen(){   // door ptOpen aangeroepen nadat de titel gezet is
  ptAlbCtx = ptAlbPending; ptAlbPending = null;
  ptAlbNavUI();
}
function ptAlbNavUI(){
  const nav = $('ptAlbNav'), c = ptAlbCtx, a = c && ptAlbGet(c.aid);
  if (!nav) return;
  if (!a || !ptCur){ nav.hidden = true; ptAlbCtx = null; return; }
  nav.hidden = false;
  $('ptAlbPrev').disabled = c.k <= 0; $('ptAlbNext').disabled = c.k >= a.items.length - 1;
  $('ptAlbPrev').title = c.k > 0 ? 'Vorige in ' + a.naam : '';
  $('ptAlbNext').title = c.k < a.items.length - 1 ? 'Volgende in ' + a.naam : '';
  const sub = $('ptSub'); sub.textContent = '📁 ' + a.naam + ' · ' + (c.k + 1) + '/' + a.items.length + (sub.textContent ? ' · ' + sub.textContent : '');
}
function ptAlbGo(d){
  const c = ptAlbCtx, a = c && ptAlbGet(c.aid); if (!a) return;
  const k = c.k + d; if (k < 0 || k >= a.items.length) return;
  if (ptCur){ clearTimeout(ptSaveT); PtDB.put(ptCur); }
  ptAlbOpen(c.aid, k);
}
let ptLibInited = false;
function ptLibInit(){
  if (ptLibInited || !$('ptList')) return; ptLibInited = true;
  const el = $('ptList');
  const keyIn = (inp, ok, no) => inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter'){ e.preventDefault(); ok(); } else if (e.key === 'Escape' && no) no(); });
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = ptLibAlb && ptAlbGet(ptLibAlb);
    if (b.dataset.x){ const id = b.dataset.x; if (ptLibOpenSet.has(id)) ptLibOpenSet.delete(id); else ptLibOpenSet.add(id); ptRenderList(); return; }
    // albumweergave
    if (b.id === 'ptAlbBack'){ ptLibAlb = null; ptLibRen = false; ptRenderList(); return; }
    if (b.id === 'ptAlbRen'){ ptLibRen = true; ptRenderList(); return; }
    if (b.id === 'ptAlbRenOk'){ const v = $('ptAlbRenIn').value.trim(); if (a && v){ a.naam = v.slice(0, 60); ptAlbSave(); } ptLibRen = false; ptRenderList(); return; }
    if (b.id === 'ptAlbDel'){
      if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker? (stukken blijven)'; setTimeout(() => { if (b.isConnected){ b.classList.remove('arm'); b.textContent = 'Album weghalen'; } }, 4000); return; }
      ptAlbs = ptAlbs.filter(x => x !== a); ptAlbSave(); ptLibAlb = null; ptRenderList(); return;
    }
    if (a && b.classList.contains('ptopen') && b.dataset.k != null){ ptAlbOpen(a.id, +b.dataset.k, b.dataset.p); return; }
    if (a && (b.classList.contains('ptup') || b.classList.contains('ptdn'))){
      const k = +b.dataset.k, j = k + (b.classList.contains('ptup') ? -1 : 1);
      if (j < 0 || j >= a.items.length) return;
      [a.items[k], a.items[j]] = [a.items[j], a.items[k]]; ptAlbSave(); ptRenderList(); return;
    }
    if (a && b.classList.contains('ptout')){ a.items.splice(+b.dataset.k, 1); ptAlbSave(); ptRenderList(); return; }
    // overzicht
    if (b.dataset.a && b.classList.contains('ptalb')){ ptLibAlb = b.dataset.a; ptLibMenu = null; ptRenderList(); window.scrollTo({ top:0 }); return; }
    if (b.id === 'ptAlbNewBtn'){ ptLibNewAlb = true; ptRenderList(); return; }
    if (b.id === 'ptAlbNewNo'){ ptLibNewAlb = false; ptRenderList(); return; }
    if (b.id === 'ptAlbNewOk'){ const v = $('ptAlbNewIn').value.trim(); ptLibNewAlb = false; if (v){ const n = ptAlbNew(v); ptLibAlb = n.id; } ptRenderList(); return; }
    if (b.id === 'ptLibAllBtn'){ ptLibAll = !ptLibAll; ptRenderList(); return; }
    if (b.classList.contains('ptaddalb')){ ptLibMenu = ptLibMenu === b.dataset.k ? null : b.dataset.k; ptLibMenuMode = 'stuk'; ptRenderList(); return; }
    if (b.dataset.mode){ ptLibMenuMode = b.dataset.mode; ptRenderList(); return; }
    const menu = b.closest('.ptalbmenu');
    if (menu && (b.dataset.a || b.dataset.new)){
      const [id, p] = menu.dataset.k.split('|'), it = ptAlbPiece(id); if (!it) return;
      let al;
      if (b.dataset.new){ const v = menu.querySelector('input').value.trim(); if (!v){ menu.querySelector('input').focus(); return; } al = ptAlbNew(v); }
      else al = ptAlbGet(b.dataset.a);
      if (!al) return;
      const refs = !p && ptLibMenuMode === 'pas' && (it.pas || []).length ? it.pas.map(x => ({ id, p:x.id })) : [{ id, p:p || null }];
      const all = refs.every(r => al.items.some(x => x.id === r.id && (x.p || null) === r.p));
      if (all && !b.dataset.new){ al.items = al.items.filter(x => !refs.some(r => r.id === x.id && (x.p || null) === r.p)); ptAlbSave(); ptLibMsg('Uit 📁 ' + ptEsc(al.naam) + ' gehaald.', 'muted'); }
      else { ptAlbAdd(al, refs); ptLibMsg((refs.length > 1 ? refs.length + ' passages' : p ? 'Passage' : 'Stuk') + ' in 📁 ' + ptEsc(al.naam) + ' gezet. <button class="ptlink" data-goalb="' + al.id + '">Album openen</button>', 'muted'); }
      ptLibMenu = null; ptRenderList(); return;
    }
    if (b.classList.contains('ptopen') && b.dataset.id){ ptOpen(b.dataset.id, b.dataset.p || undefined); return; }
    if (b.classList.contains('ptdel') && b.dataset.id){
      if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; setTimeout(() => { if (b.isConnected){ b.classList.remove('arm'); b.textContent = '✕'; } }, 4000); return; }
      const gone = ptAlbPiece(b.dataset.id); if (gone) ptCacheDrop(gone);
      await PtDB.del(b.dataset.id); if (ptCur && ptCur.id === b.dataset.id) ptCur = null; ptRenderList();
    }
  });
  $('ptLibMsg').addEventListener('click', e => { const b = e.target.closest('[data-goalb]'); if (b){ ptLibAlb = b.dataset.goalb; ptLibMsg(''); ptRenderList(); window.scrollTo({ top:0 }); } });
  el.addEventListener('keydown', e => {
    if (e.target.tagName !== 'INPUT') return;
    e.stopPropagation();
    if (e.key === 'Enter'){ e.preventDefault(); const ok = e.target.id === 'ptAlbNewIn' ? $('ptAlbNewOk') : e.target.id === 'ptAlbRenIn' ? $('ptAlbRenOk') : e.target.closest('.ptalbmenu') && e.target.closest('.ptalbmenu').querySelector('[data-new]'); if (ok) ok.click(); }
    else if (e.key === 'Escape'){ ptLibNewAlb = false; ptLibRen = false; ptLibMenu = null; ptRenderList(); }
  });
  // slepen om te sorteren (laptop)
  let dragK = null;
  el.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.ptalbit'); if (!r) return; dragK = +r.dataset.k; r.classList.add('drag'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'alb'); } catch(x){} });
  el.addEventListener('dragover', e => { if (dragK == null) return; const r = e.target.closest('.ptalbit'); if (!r) return; e.preventDefault(); e.stopPropagation(); el.querySelectorAll('.ptalbit').forEach(x => x.classList.toggle('dropto', x === r)); });
  el.addEventListener('drop', e => {
    if (dragK == null) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.target.closest('.ptalbit'), a = ptAlbGet(ptLibAlb);
    if (r && a){ const to = +r.dataset.k, [x] = a.items.splice(dragK, 1); a.items.splice(to, 0, x); ptAlbSave(); }
    dragK = null; ptRenderList();
  });
  el.addEventListener('dragend', () => { if (dragK != null){ dragK = null; ptRenderList(); } });
  $('ptAlbPrev').onclick = e => { e.currentTarget.blur(); ptAlbGo(-1); };
  $('ptAlbNext').onclick = e => { e.currentTarget.blur(); ptAlbGo(1); };
}
if (typeof ptInited !== 'undefined' && ptInited){ ptLibInit(); if (!ptCur) ptRenderList(); }   // Repertoire stond al open (direct via #partituren)
