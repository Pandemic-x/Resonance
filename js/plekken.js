/* ================= Blokken-bibliotheek per stuk (js/plekken.js, prefix ptBlk) — v1.22, 22-11-2026 =================
   Wens Julian: emoji's zijn gewoon een snelle manier om blokken (passages) te maken; één bibliotheek voor alle blokken,
   en makkelijk tussen blokken wisselen. (Vervangt de "lastige plekken" van v1.20: die worden vanzelf blokken.)
   - Emoji in de partituur zetten (✏️ → 🏷️ → tab Blokken: ⚠️ 👓 ○ ↑ ↓ 🔁 en meer) = markering (ann-item k:'blk', e, pas)
     én een nieuw blok via ptBlkNew: maat−1 … maat+1, naam "<omschrijving> m. N", emo = die emoji, viaMark = 1.
   - Andersom: een blok een emoji geven (☺ in de blokbalk) → Ann.ensureMarker(p) zet de emoji in de partituur bij de
     eerste maat; "Geen emoji" → Ann.dropMarkers(id). Een blok verwijderen haalt ook zijn markeringen weg.
     De markering toont altijd p.emo (de passage is de bron); ✅ Zit erin = grijze markering.
   - Knop #ptPlekBtn "▦ Blokken n" (n = blokken die nog niet ✅ zijn) → #ptPlekBox: ‹ › vorige/volgende blok, ＋ nieuw blok
     van het huidige oefenblok, lijst op maatvolgorde (tik = laden in Focus), ✓/↺ = ✅ Zit erin / weer Bezig, 🗑 (twee keer).
   - ptPlekUI (oude naam, aangeroepen door Ann.render) = ptBlkUI; ptPasUI roept ptBlkUI ook aan. */

const PT_BLK_NAME = { '⚠️':'Let op', '👓':'Kijk uit', '○':'Omcirkeld', '↑':'Te laag', '↓':'Te hoog', '🔁':'Herhalen' };
let ptBlkOpen = false, ptBlkShowDone = false;
function ptBlkNew(it){   // markering geplaatst → nieuw blok rond die maat
  const st = it && it.a && ptSteps[it.a.i]; if (!st || !ptCur) return null;
  const mn = st.mn, a = Math.max(ptMinM(), mn - 1), b = Math.min(ptMaxM(), mn + 1);
  const nm = PT_BLK_NAME[it.e] || (it.nm ? it.nm.replace(/^./, c => c.toUpperCase()) : 'Blok');
  const p = { id:'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), naam:nm + ' m. ' + mn, from:a, to:b, status:'nieuw', bpm:ptCur.s.bpm,
    ok:0, doel:0, secs:0, made:ptToday(), last:null, emo:it.e, viaMark:1 };
  ptCur.pas = (ptCur.pas || []).concat(p);
  it.pas = p.id;
  ptSaveCur(); ptPasUI();
  return p;
}
function ptBlkSorted(){ return (ptCur && ptCur.pas || []).slice().sort((a, b) => a.from - b.from || a.to - b.to || String(a.made || '').localeCompare(String(b.made || ''))); }
function ptBlkUI(){
  const btn = $('ptPlekBtn'), box = $('ptPlekBox'); if (!btn || !box) return;
  if (!ptCur){ btn.hidden = true; box.hidden = true; return; }
  const L = ptBlkSorted(), open = L.filter(p => p.status !== 'zit'), done = L.filter(p => p.status === 'zit');
  btn.hidden = false;
  btn.textContent = '▦ Blokken' + (L.length ? ' ' + open.length : '');
  btn.title = L.length ? L.length + ' blok' + (L.length === 1 ? '' : 'ken') + ' in dit stuk, ' + open.length + ' nog niet ✅' : 'Blokken van dit stuk (nog geen)';
  btn.classList.toggle('on', ptBlkOpen);
  box.hidden = !ptBlkOpen;
  if (box.hidden) return;
  const cur = ptPasCur(), s = ptCur.s;
  const row = p => `<div class="ptplek${p.status === 'zit' ? ' done' : ''}${cur && cur.id === p.id ? ' here' : ''}">
      <button class="ptplekgo" data-go="${p.id}" title="Laden: maat ${p.from}–${p.to} in Focus"><span class="ptplekic">${p.emo ? ptEsc(p.emo) : PT_STATUS[p.status] ? PT_STATUS[p.status].i : ''}</span><b>${ptEsc(p.naam)}</b><small>${ptEsc(ptPasMeta(p))}</small></button>
      <button class="ptplekok" data-ok="${p.id}" title="${p.status === 'zit' ? 'Weer op 🔨 Bezig' : '✅ Zit erin'}">${p.status === 'zit' ? '↺' : '✓'}</button>
      <button class="ptplekdel" data-del="${p.id}" title="Blok verwijderen (twee keer tikken)">✕</button></div>`;
  const k = cur ? L.findIndex(p => p.id === cur.id) : -1;
  box.innerHTML = `<div class="ptblkhead">
      <button class="ptblknav" data-nav="-1" ${L.length && k !== 0 ? '' : 'disabled'} title="Vorige blok">‹</button>
      <button class="ptblknav" data-nav="1" ${L.length && k < L.length - 1 ? '' : 'disabled'} title="Volgende blok">›</button>
      <span class="ptblkcur">${cur ? (k + 1) + ' / ' + L.length : L.length ? L.length + ' blok' + (L.length === 1 ? '' : 'ken') : 'Nog geen blokken'}</span>
      <button class="ptblknew" data-new="1" title="Het huidige oefenblok bewaren als blok">＋ Blok van maat ${s.from}–${s.to}</button></div>` +
    (open.length ? open.map(row).join('') : L.length ? '<p class="muted ptplekempty">Alle blokken zitten erin. 🎉</p>' : '') +
    (done.length ? `<button class="ptlink ptplekmore" data-more="1">${ptBlkShowDone ? '▾' : '▸'} ✅ Zit erin (${done.length})</button>` + (ptBlkShowDone ? done.map(row).join('') : '') : '') +
    '<p class="muted ptplektip">Snel een blok: ✏️ → 🏷️ → <b>Blokken</b> en zet een emoji in de partituur. Of geef een blok een emoji met ☺ in de blokbalk: dan staat hij ook in de partituur.</p>';
}
const ptPlekUI = ptBlkUI;   // oude naam (Ann.render)
function ptBlkInit(){
  const btn = $('ptPlekBtn'), box = $('ptPlekBox'); if (!btn || !box || btn._init) return; btn._init = true;
  btn.onclick = e => { e.currentTarget.blur(); ptBlkOpen = !ptBlkOpen; ptBlkUI(); };
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ptCur) return;
    b.blur();
    if (b.dataset.more){ ptBlkShowDone = !ptBlkShowDone; ptBlkUI(); return; }
    if (b.dataset.new){ $('ptPasNew').click(); return; }
    if (b.dataset.nav){
      const L = ptBlkSorted(), cur = ptPasCur(); if (!L.length) return;
      const k = cur ? L.findIndex(p => p.id === cur.id) : -1, j = k < 0 ? (+b.dataset.nav > 0 ? 0 : L.length - 1) : k + +b.dataset.nav;
      if (L[j]) ptPasLoad(L[j].id);
      return;
    }
    const id = b.dataset.go || b.dataset.ok || b.dataset.del, p = (ptCur.pas || []).find(x => x.id === id); if (!p) return;
    if (b.dataset.go) ptPasLoad(p.id);
    else if (b.dataset.ok){ p.status = p.status === 'zit' ? 'bezig' : 'zit'; ptSaveCur(); ptPasUI(); if (typeof Ann !== 'undefined') Ann.redraw(); }
    else if (b.dataset.del){
      if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; setTimeout(() => { if (b.isConnected){ b.classList.remove('arm'); b.textContent = '✕'; } }, 4000); return; }
      ptCur.pas = ptCur.pas.filter(x => x.id !== p.id); if (ptCur.pcur === p.id) ptCur.pcur = null;
      ptSaveCur(); ptPasUI(); if (typeof Ann !== 'undefined') Ann.dropMarkers(p.id);
    }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ptBlkInit); else ptBlkInit();
