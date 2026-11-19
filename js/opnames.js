/* ================= 🎬 Opnames (Repertoire, prefix po) =================
   Per stuk een lijstje YouTube-opnames (bv. uitvoeringen om naar te luisteren) met bladwijzers op tijdstippen.
   Inbedden kan niet: de app draait in een beveiligd venster dat iframes van andere sites blokkeert. Daarom opent
   een opname of bladwijzer de video op YouTube zelf, precies op dat moment (&t=..s).
   Opslag: ptCur.opn = [{ id, vid, naam, marks:[{ t (s), label, mn }] }], samen met het stuk in IndexedDB
   (gaat dus mee in de back-up). */
let poInited = false;
const poEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const poList = () => (ptCur.opn = ptCur.opn || []);
const poId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- links en tijden ---------- */
function poTime(s){   // "1:23", "1:02:03", "83", "1m23s", "83s" → seconden (of null)
  s = String(s || '').trim().toLowerCase();
  if (!s) return null;
  if (/^\d+(\.\d+)?s?$/.test(s)) return Math.round(parseFloat(s));
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) return s.split(':').reduce((a, b) => a * 60 + (+b), 0);
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return null;
}
function poFmt(t){ t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
function poParse(u){   // YouTube-link → { vid, t } (of null)
  u = String(u || '').trim();
  if (/^[\w-]{11}$/.test(u)) return { vid:u, t:null };
  let x; try { x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); } catch(e){ return null; }
  const h = x.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let vid = null;
  if (h === 'youtu.be') vid = x.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com'){
    vid = x.searchParams.get('v') || (x.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/) || [])[1];
  }
  if (!vid || !/^[\w-]{11}$/.test(vid)) return null;
  const tt = x.searchParams.get('t') || x.searchParams.get('start') || (x.hash.match(/t=([\w.]+)/) || [])[1];
  return { vid, t:tt ? poTime(tt) : null };
}
const poYt = (vid, t) => 'https://www.youtube.com/watch?v=' + vid + (t ? '&t=' + Math.round(t) + 's' : '');
// De kale speler (youtube.com/embed/…) los openen werkt niet (YouTube "Error 153", geen referrer) en een iframe in de app
// blokkeert de sandbox. Oplossing (14-11-2026): een eigen spelerpagina op GitHub Pages (index.html van de gebruiker) die de
// video wél inbedt: adres in localStorage 'opnames-speler'; link = adres?v=ID&t=s&n=naam&b=t|label (per bladwijzer).
let poBase = '';
try { poBase = localStorage.getItem('opnames-speler') || ''; } catch(e){}
function poUrl(o, t){
  if (!poBase) return poYt(o.vid, t);
  const q = new URLSearchParams({ v:o.vid });
  if (t) q.set('t', Math.round(t));
  q.set('n', (ptCur && (ptCur.titel || ptCur.naam) ? (ptCur.titel || ptCur.naam) + ' · ' : '') + o.naam);
  (o.marks || []).slice().sort((a, b) => a.t - b.t).forEach(k => q.append('b', Math.round(k.t) + '|' + (k.label || '') + (k.mn ? ' (m. ' + k.mn + ')' : '')));
  return poBase + (poBase.includes('?') ? '&' : '?') + q.toString();
}
function poBaseNorm(u){
  u = String(u || '').trim(); if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); if (x.protocol !== 'https:') return null; return x.href; } catch(e){ return null; }
}

/* ---------- tekenen ---------- */
function poRender(){
  const box = $('poItems'); if (!box || !ptCur) return;
  const L = poList();
  const q = [ptCur.titel || ptCur.naam, ptCur.comp].filter(Boolean).join(' ');
  $('poSearch').href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  $('poSearch').textContent = '🔎 Zoek "' + q + '" op YouTube';
  if (!L.length){
    box.innerHTML = '<div class="poempty"><p>Nog geen opnames bij dit stuk.</p><p class="muted">Zoek een uitvoering op YouTube, kopieer de link (Delen → Kopiëren) en plak hem hierboven. Daarna kun je bladwijzers zetten, bv. "begin Largo" of "lastige loopjes m. 13".</p></div>';
  } else {
    box.innerHTML = L.map(o => {
      const marks = (o.marks || []).slice().sort((a, b) => a.t - b.t);
      return '<div class="poitem" data-id="' + o.id + '">'
        + '<div class="pohead"><a class="poname" href="' + poUrl(o) + '" target="_blank" rel="noopener" referrerpolicy="strict-origin-when-cross-origin" title="' + (poBase ? 'Openen in je eigen speler' : 'Openen op YouTube') + '">▶ ' + poEsc(o.naam) + '</a>'
        + '<button class="pox poren" title="Naam wijzigen">✎</button><button class="pox podel" title="Opname weghalen">🗑</button></div>'
        + (marks.length ? '<ul class="pomarks">' + marks.map(k => '<li><a href="' + poUrl(o, k.t) + '" target="_blank" rel="noopener" referrerpolicy="strict-origin-when-cross-origin" class="pot">' + poFmt(k.t) + '</a>'
            + '<span class="pol">' + poEsc(k.label || '') + (k.mn ? ' <small>m. ' + poEsc(k.mn) + '</small>' : '') + '</span>'
            + '<button class="pox pomdel" data-k="' + k.id + '" title="Bladwijzer weghalen">×</button></li>').join('') + '</ul>'
          : '<p class="muted pono">Nog geen bladwijzers.</p>')
        + '<div class="poadd"><input class="pomt" placeholder="1:23" title="Tijd (m:ss), of plak een YouTube-link met tijd"><input class="pomlab" placeholder="Bladwijzer, bv. begin Largo"><input class="pommn" placeholder="maat" inputmode="numeric" title="Maatnummer (mag leeg)"><button class="ptsmall pomadd">＋</button></div>'
        + '</div>';
    }).join('');
  }
  poCount();
}
function poCount(){ const b = $('poBtn'); if (b && ptCur){ const n = (ptCur.opn || []).length; b.innerHTML = '🎬' + (n ? '<sup class="ptcnt">' + n + '</sup>' : ''); b.title = 'YouTube-opnames van dit stuk, met bladwijzers' + (n ? ' (' + n + ')' : ''); } }
function poMsg(t, bad){ const e = $('poMsg'); if (e){ e.textContent = t || ''; e.classList.toggle('bad', !!bad); } }

/* ---------- acties ---------- */
function poAdd(){
  const p = poParse($('poUrl').value);
  if (!p) return poMsg('Dit lijkt geen YouTube-link. Kopieer de link van de video (Delen → Kopiëren).', true);
  const L = poList();
  let o = L.find(x => x.vid === p.vid);
  if (!o){
    o = { id:poId(), vid:p.vid, naam:$('poName').value.trim() || 'Opname ' + (L.length + 1), marks:[] };
    L.push(o); poMsg('✓ Toegevoegd.' + (p.t ? ' De tijd uit de link staat als bladwijzer klaar.' : ''));
  } else poMsg('Deze video stond er al.' + (p.t ? ' De tijd uit de link staat als bladwijzer klaar.' : ''));
  $('poUrl').value = ''; $('poName').value = '';
  ptSaveCur(); poRender();
  if (p.t){ const it = $('poItems').querySelector('[data-id="' + o.id + '"]'); if (it){ it.querySelector('.pomt').value = poFmt(p.t); it.querySelector('.pomlab').focus(); } }
}
function poMarkAdd(item){
  const o = poList().find(x => x.id === item.dataset.id); if (!o) return;
  const tIn = item.querySelector('.pomt'), raw = tIn.value.trim();
  let t = poTime(raw);
  if (t == null){ const p = poParse(raw); if (p && p.t != null) t = p.t; }
  if (t == null){ tIn.classList.add('bad'); tIn.focus(); return poMsg('Vul een tijd in, bv. 1:23 (of plak een YouTube-link met tijd).', true); }
  const mn = item.querySelector('.pommn').value.trim().replace(/[^\d\-–]/g, '');
  (o.marks = o.marks || []).push({ id:poId(), t, label:item.querySelector('.pomlab').value.trim(), mn });
  poMsg(''); ptSaveCur(); poRender();
  const again = $('poItems').querySelector('[data-id="' + o.id + '"] .pomt'); if (again) again.focus();
}

function poOpen(on){
  const v = $('ptView'); if (!v) return;
  if (on === undefined) on = !v.classList.contains('poopen');
  if (on){
    if (v.classList.contains('pnlopen')) { try { Paneel.set('ptView', false); } catch(e){ v.classList.remove('pnlopen'); } }
    if (v.classList.contains('pvopen') && typeof pvOpen === 'function') pvOpen(false);
  }
  v.classList.toggle('poopen', on);
  $('poBtn').classList.toggle('on', on);
  if (on){ poMsg(''); poRender(); setTimeout(() => { const i = $('poUrl'); if (i && window.innerWidth > 700 && !poList().length) i.focus(); }, 60); }
}

function poInit(){
  if (poInited) return; poInited = true;
  const v = $('ptView'); if (!v) return;
  const right = v.querySelector('.ptctrl .ptright');
  const btn = document.createElement('button');
  btn.id = 'poBtn'; btn.className = 'ptsmall pobtn ptic'; btn.textContent = '🎬';
  btn.title = 'YouTube-opnames van dit stuk, met bladwijzers';
  right.insertBefore(btn, right.firstChild);
  btn.onclick = () => poOpen();
  const box = document.createElement('aside');
  box.id = 'poBox'; box.className = 'pobox';
  box.innerHTML = '<div class="pvhead"><b>🎬 Opnames</b><span class="pvscope"></span><button id="poClose" class="pvx" title="Sluiten (Esc)">✕</button></div>'
    + '<div class="poform"><input id="poUrl" placeholder="Plak een YouTube-link"><input id="poName" placeholder="Naam (bv. Hilary Hahn)"><button id="poAddBtn" class="ptsmall primary">＋ Toevoegen</button></div>'
    + '<p id="poMsg" class="pomsg"></p>'
    + '<div id="poItems" class="poitems"></div>'
    + '<p class="pvfoot muted"><a id="poSearch" target="_blank" rel="noopener" referrerpolicy="strict-origin-when-cross-origin" href="https://www.youtube.com"></a></p>'
    + '<details class="poset"><summary>▣ Eigen spelerpagina <span id="poSetState"></span></summary>'
    + '<p class="muted">Met een eigen spelerpagina (gratis op GitHub Pages) opent een opname zonder de YouTube-site: alleen de video, je bladwijzers en tempo 0,5×–1×. Leeg = gewoon YouTube.</p>'
    + '<div class="poform"><input id="poBase" placeholder="https://jouwnaam.github.io/speler/"><button id="poBaseSave" class="ptsmall">Opslaan</button></div></details>';
  v.appendChild(box);
  $('poClose').onclick = () => poOpen(false);
  $('poAddBtn').onclick = poAdd;
  const baseUI = () => { $('poBase').value = poBase; $('poSetState').textContent = poBase ? '· aan' : '· uit (YouTube)'; };
  $('poBaseSave').onclick = () => {
    const n = poBaseNorm($('poBase').value);
    if (n === null) return poMsg('Dit adres klopt niet. Het moet beginnen met https://, bv. https://jouwnaam.github.io/speler/', true);
    poBase = n; try { localStorage.setItem('opnames-speler', poBase); } catch(e){}
    baseUI(); poRender(); poMsg(poBase ? '✓ Opnames openen nu in je eigen speler.' : '✓ Opnames openen weer op YouTube.');
  };
  $('poBase').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('poBaseSave').click(); } });
  baseUI();
  const items = $('poItems');
  items.addEventListener('click', e => {
    const item = e.target.closest('.poitem'); if (!item || !ptCur) return;
    const L = poList(), o = L.find(x => x.id === item.dataset.id); if (!o) return;
    if (e.target.closest('.pomadd')) return poMarkAdd(item);
    if (e.target.closest('.pomdel')){ o.marks = (o.marks || []).filter(k => k.id !== e.target.closest('.pomdel').dataset.k); ptSaveCur(); return poRender(); }
    const del = e.target.closest('.podel');
    if (del){
      if (!del.classList.contains('arm')){ del.classList.add('arm'); del.textContent = 'Zeker?'; setTimeout(() => { if (del.isConnected){ del.classList.remove('arm'); del.textContent = '🗑'; } }, 4000); return; }
      L.splice(L.indexOf(o), 1); ptSaveCur(); return poRender();
    }
    if (e.target.closest('.poren')){
      const head = item.querySelector('.pohead');
      head.innerHTML = '<input class="poedit" value="' + poEsc(o.naam) + '"><button class="ptsmall primary pook">OK</button>';
      const inp = head.querySelector('.poedit'); inp.focus(); inp.select();
      const done = () => { const n = inp.value.trim(); if (n) o.naam = n; ptSaveCur(); poRender(); };
      head.querySelector('.pook').onclick = done;
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter'){ ev.preventDefault(); done(); } else if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); poRender(); } });
    }
  });
  items.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest('.poadd')){ e.preventDefault(); poMarkAdd(e.target.closest('.poitem')); }
    if (e.target.classList) e.target.classList.remove('bad');
  });
  ['poUrl', 'poName'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); poAdd(); } }));
  // tijdens typen geen sneltoetsen van de speler; Esc sluit het venster
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); poOpen(false); return; }
    if (e.target.matches('input, textarea')) e.stopPropagation();
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && v.classList.contains('poopen') && typeof view !== 'undefined' && view === 'partituren' && !(typeof ptFsOn !== 'undefined' && ptFsOn)) poOpen(false);
  }, true);
  // ander stuk / terug naar de lijst
  let lastCur = null;
  setInterval(() => {
    if (typeof ptCur === 'undefined' || ptCur === lastCur) return;
    lastCur = ptCur;
    if (!ptCur) poOpen(false); else { poCount(); if (v.classList.contains('poopen')) poRender(); }
  }, 700);
  try { Paneel.onToggle(() => { if (v.classList.contains('pnlopen') && v.classList.contains('poopen')) poOpen(false); }); } catch(e){}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poInit); else poInit();
