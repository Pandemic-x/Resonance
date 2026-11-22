/* ================= Lastige plekken in Repertoire (js/plekken.js, prefix ptPlek) — 22-11-2026 =================
   Idee (plan met Julian): zien → markeren → oefenen → afvinken. Een paar stempels uit de aantekeningen betekenen
   "lastige plek": ⚠️ (warn), 👓 (look), de cirkel (circ), ↑ (hi) en ↓ (lo). Zetten = markeren, er hoeft niets extra's.
   - Gegevens: gewoon de stempels in ptCur.ann (js/aantekeningen.js). Extra velden op zo'n stempel:
       ok (1 = opgelost, de stempel wordt grijs getekend), okd (datum), pas (id van de gekoppelde passage).
     Uitgummen = de plek is weg. Verborgen lagen tellen gewoon mee in de lijst.
   - Speler: knop #ptPlekBtn "⚠️ n" (n = open plekken; verborgen als het stuk geen plekken heeft) opent #ptPlekBox:
       regel = teken + maat + omschrijving; tik = oefenblok maat−1 … maat+1 in Focus + Lus (of de gekoppelde passage laden);
       ＋ passage = passage "<omschrijving> m. N" van die maten (status Bezig) en meteen laden; ✓ = opgelost (gekoppelde
       passage → ✅ Zit erin); ↺ = weer open. Opgeloste plekken staan ingeklapt onderaan.
   - Bibliotheek: ptPlekCount(it) → aantal open plekken, getoond in de regel van het stuk (albums.js).
   - ptPlekUI() wordt aangeroepen door Ann.render (na elke wijziging en elke nieuwe tekening). */

const PT_PLEK = { warn:'⚠️ let op', look:'👓 kijk uit', circ:'○ omcirkeld', hi:'↑ te laag, hoger spelen', lo:'↓ te hoog, lager spelen' };
const PT_PLEK_ICON = { warn:'⚠️', look:'👓', circ:'○', hi:'↑', lo:'↓' };
let ptPlekOpen = false, ptPlekShowDone = false;
const ptPlekIs = it => it && it.t === 's' && PT_PLEK[it.k];
function ptPlekCount(it){ return (it && it.ann || []).filter(x => ptPlekIs(x) && !x.ok).length; }
function ptPlekMn(it){ const st = ptSteps[it.a && it.a.i]; return st ? st.mn : null; }
function ptPlekList(){
  return (ptCur && ptCur.ann || []).filter(ptPlekIs).map(it => ({ it, mn:ptPlekMn(it) })).filter(x => x.mn != null)
    .sort((a, b) => a.mn - b.mn || (a.it.a.i - b.it.a.i));
}
function ptPlekUI(){
  const btn = $('ptPlekBtn'), box = $('ptPlekBox'); if (!btn || !box) return;
  const L = ptCur ? ptPlekList() : [], open = L.filter(x => !x.it.ok), done = L.filter(x => x.it.ok);
  btn.hidden = !L.length;
  btn.textContent = '⚠️ ' + open.length;
  btn.title = open.length ? open.length + ' lastige plek' + (open.length === 1 ? '' : 'ken') + ' (⚠️ 👓 ○ ↑ ↓ uit de aantekeningen)' : 'Alle lastige plekken opgelost 🎉';
  btn.classList.toggle('on', ptPlekOpen); btn.classList.toggle('zero', !open.length);
  box.hidden = !ptPlekOpen || !L.length;
  if (box.hidden) return;
  const pasOf = it => it.pas && (ptCur.pas || []).find(p => p.id === it.pas);
  const row = ({ it, mn }) => {
    const p = pasOf(it), hereB = ptCur.s.from <= mn && ptCur.s.to >= mn;
    return `<div class="ptplek${it.ok ? ' done' : ''}${hereB ? ' here' : ''}" data-id="${it.id}">
      <button class="ptplekgo" data-go="${it.id}" title="${p ? 'Passage laden: ' + ptEsc(p.naam) : 'Oefenen: maat ' + (mn - 1) + '–' + (mn + 1) + ' in Focus en Lus'}"><span class="ptplekic">${PT_PLEK_ICON[it.k]}</span><b>maat ${mn}</b><small>${ptEsc(p ? ptPasNm(p) + ' · m. ' + p.from + '–' + p.to : PT_PLEK[it.k].replace(/^\S+\s/, ''))}</small></button>
      ${it.ok ? '' : p ? '' : `<button class="ptplekpas" data-pas="${it.id}" title="Passage van maken (met tempo, status en in Vandaag oefenen)">＋ passage</button>`}
      <button class="ptplekok" data-ok="${it.id}" title="${it.ok ? 'Weer open zetten' : 'Opgelost: zit erin'}">${it.ok ? '↺' : '✓'}</button></div>`;
  };
  box.innerHTML = (open.length ? open.map(row).join('') : '<p class="muted ptplekempty">Alle plekken in dit stuk zijn opgelost. 🎉</p>') +
    (done.length ? `<button class="ptlink ptplekmore" data-more="1">${ptPlekShowDone ? '▾' : '▸'} Opgelost (${done.length})</button>` + (ptPlekShowDone ? done.map(row).join('') : '') : '') +
    '<p class="muted ptplektip">Zet in de tekenmodus (✏️) een ⚠️, 👓, ○, ↑ of ↓ (tab Practice) bij een lastige plek: die komt vanzelf in deze lijst.</p>';
}
function ptPlekGo(it){
  const mn = ptPlekMn(it); if (mn == null) return;
  const p = it.pas && (ptCur.pas || []).find(x => x.id === it.pas);
  if (p){ ptPasLoad(p.id); return; }
  const s = ptCur.s, a = Math.max(ptMinM(), mn - 1), b = Math.min(ptMaxM(), mn + 1);
  const ch = s.from !== a || s.to !== b, wasF = s.focus;
  ptStop(); ptCur.pcur = null;
  s.focus = true; s.loop = true; $('ptFocus').checked = true; $('ptLoop').checked = true;
  ptSetBlock(a, b, false);
  ptSaveCur(); ptPasUI();
  if (ch || !wasF) ptRedraw(); else ptDim();
  ptMsg(PT_PLEK_ICON[it.k] + ' Maat ' + a + '–' + b + ' rond de plek in maat ' + mn + '. Druk op ▶ (de lus staat aan).', 'muted');
}
function ptPlekPas(it){
  const mn = ptPlekMn(it); if (mn == null) return;
  const a = Math.max(ptMinM(), mn - 1), b = Math.min(ptMaxM(), mn + 1);
  const naam = PT_PLEK[it.k].replace(/^\S+\s/, '').replace(/^./, c => c.toUpperCase()).split(',')[0] + ' m. ' + mn;
  const p = { id:'q' + Date.now().toString(36), naam, from:a, to:b, status:'bezig', bpm:ptCur.s.bpm, ok:0, doel:0, secs:0, made:ptToday(), last:null };
  ptCur.pas = (ptCur.pas || []).concat(p);
  it.pas = p.id;
  ptSaveCur();
  ptPasLoad(p.id);
  ptMsg('Passage "' + ptEsc(naam) + '" gemaakt (maat ' + a + '–' + b + '). Je kunt de naam en het doeltempo aanpassen in 🕹️ → Passages.', 'muted');
}
function ptPlekOk(it){
  if (it.ok){ delete it.ok; delete it.okd; }
  else {
    it.ok = 1; it.okd = ptToday();
    const p = it.pas && (ptCur.pas || []).find(x => x.id === it.pas);
    if (p) p.status = 'zit';
  }
  ptSaveCur(); ptPasUI();
  if (typeof Ann !== 'undefined') Ann.redraw(); else ptPlekUI();
}
function ptPlekInit(){
  const btn = $('ptPlekBtn'), box = $('ptPlekBox'); if (!btn || !box || btn._init) return; btn._init = true;
  btn.onclick = e => { e.currentTarget.blur(); ptPlekOpen = !ptPlekOpen; ptPlekUI(); };
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ptCur) return;
    b.blur();
    if (b.dataset.more){ ptPlekShowDone = !ptPlekShowDone; ptPlekUI(); return; }
    const id = b.dataset.go || b.dataset.pas || b.dataset.ok, it = (ptCur.ann || []).find(x => x.id === id); if (!it) return;
    if (b.dataset.go) ptPlekGo(it);
    else if (b.dataset.pas) ptPlekPas(it);
    else if (b.dataset.ok) ptPlekOk(it);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ptPlekInit); else ptPlekInit();
