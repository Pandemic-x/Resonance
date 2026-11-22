/* ================= Printen / PDF in Repertoire (js/printen.js, prefix ptPr) — 22-11-2026 =================
   🖨️ in de spelerbalk → venstertje met keuzes (ptG.print = {range, ann, hid, done, title}):
   hele stuk of alleen het oefenblok, aantekeningen mee, ook verborgen lagen, opgeloste plekken weglaten, titel bovenaan.
   Werkwijze:
   1. ptPrintDims = A4-staand (760 × 1075 px) → ptPaged() is waar en ptFsDims() geeft die maat: OSMD tekent echte
      bladzijden (zoals volledig scherm "Bladzijden"), ptJustify verdeelt de regels over de bladzijde. Uit de cache als het al eens gebeurde.
   2. Per bladzijde-SVG een kopie in #ptPrint (direct in <body>), met daarbovenop de aantekeningen (Ann.printLayer) verschoven
      naar die bladzijde; de viewBox knipt af wat op een andere bladzijde hoort.
   3. Meteen daarna alles terugzetten (Focus, titels, gewone tekening), dan window.print(). In het printvenster kies je
      "Opslaan als PDF" voor een PDF. Na afloop (afterprint) wordt #ptPrint weer weggehaald.
   In de Claude-viewer (artifact) kan het printvenster geblokkeerd zijn; op de website werkt het. */

const PT_PR_DEF = { range:'alles', ann:true, hid:false, done:true, title:true };
function ptPrOpts(){ ptG.print = Object.assign({}, PT_PR_DEF, ptG.print || {}); return ptG.print; }
function ptPrDlg(show){
  const d = $('ptPrintDlg'); if (!d || !ptCur) return;
  if (!show){ d.hidden = true; return; }
  const o = ptPrOpts(), s = ptCur.s;
  $('ptPrRange').innerHTML = '<option value="alles">het hele stuk</option><option value="blok">alleen het oefenblok (maat ' + s.from + '–' + s.to + ')</option>';
  $('ptPrRange').value = o.range;
  $('ptPrAnn').checked = o.ann; $('ptPrHid').checked = o.hid; $('ptPrDone').checked = o.done; $('ptPrTitle').checked = o.title;
  const hasAnn = (ptCur.ann || []).length > 0;
  $('ptPrAnnBox').hidden = !hasAnn;
  $('ptPrMsg').textContent = '';
  d.hidden = false;
}
async function ptPrGo(){
  if (!ptCur || !ptSteps.length) return;
  const o = ptPrOpts();
  o.range = $('ptPrRange').value; o.ann = $('ptPrAnn').checked; o.hid = $('ptPrHid').checked; o.done = $('ptPrDone').checked; o.title = $('ptPrTitle').checked;
  ptSaveG();
  $('ptPrGo').disabled = true; $('ptPrMsg').textContent = 'Bladzijden klaarmaken…';
  if (typeof Ann !== 'undefined') Ann.close();
  if (ptFsOn) await ptFsExit(true);
  ptStop();
  const s = ptCur.s, keep = { focus:s.focus, titles:ptG.titles };
  let box = null;
  try {
    ptPrintDims = { pw:760, ph:1075 };
    s.focus = o.range === 'blok'; ptG.titles = !!o.title;
    await ptShowSheet();
    await ptFrame(); await ptFrame();
    ptGeo = null;
    box = ptPrBuild(o);
  } catch(e){ console.error('Printen mislukt', e); }
  finally {
    ptPrintDims = null; s.focus = keep.focus; ptG.titles = keep.titles;
    $('ptFocus').checked = !!s.focus; ptSaveCur();
    await ptShowSheet();
    $('ptPrGo').disabled = false;
  }
  if (!box){ $('ptPrMsg').textContent = '✗ Het klaarmaken lukte niet.'; return; }
  ptPrDlg(false);
  document.querySelectorAll('body > #ptPrint').forEach(x => { if (x !== box) x.remove(); });
  document.body.appendChild(box); document.body.classList.add('ptprinting');
  let done = false;
  const clean = () => { if (done) return; done = true; box.remove(); document.body.classList.remove('ptprinting'); };
  window.addEventListener('afterprint', clean, { once:true });
  setTimeout(clean, 120000);
  try { window.print(); } catch(e){ clean(); ptMsg('Printen kon hier niet worden geopend. Probeer het op de website (pandemic-x.github.io/Resonance).', 'bad'); }
}
function ptPrBuild(o){
  const NS = 'http://www.w3.org/2000/svg', sh = $('ptSheet'), sr = sh.getBoundingClientRect(), sc = sh.offsetWidth ? sr.width / sh.offsetWidth : 1;
  const svgs = [...ptActive().querySelectorAll('svg')].filter(x => !x.parentElement.closest('svg'));
  if (!svgs.length) return null;
  const ann = typeof Ann !== 'undefined' && o.ann ? Ann.printLayer({ ann:true, hidden:o.hid, noDone:o.done }) : null;
  const box = document.createElement('div'); box.id = 'ptPrint';
  svgs.forEach(svg => {
    const r = svg.getBoundingClientRect(); if (!r.width) return;
    const ox = (r.left - sr.left) / sc, oy = (r.top - sr.top) / sc;
    const W = parseFloat(svg.getAttribute('width')) || r.width / sc, H = parseFloat(svg.getAttribute('height')) || r.height / sc;
    const k = (r.width / sc) / W;   // CSS-schaal van de SVG (meestal 1)
    const out = document.createElementNS(NS, 'svg');
    out.setAttribute('viewBox', '0 0 ' + W + ' ' + H); out.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    const inner = svg.cloneNode(true);
    inner.removeAttribute('style'); inner.setAttribute('x', 0); inner.setAttribute('y', 0); inner.setAttribute('width', W); inner.setAttribute('height', H);
    inner.querySelectorAll('.pthi').forEach(x => x.classList.remove('pthi'));
    out.appendChild(inner);
    if (ann){ const g = ann.cloneNode(true); g.setAttribute('transform', 'scale(' + (1 / k) + ') translate(' + (-ox) + ' ' + (-oy) + ')'); out.appendChild(g); }
    const pg = document.createElement('div'); pg.className = 'ptpp'; pg.appendChild(out);
    box.appendChild(pg);
  });
  return box.children.length ? box : null;
}
function ptPrInit(){
  const b = $('ptPrintBtn'); if (!b || b._init) return; b._init = true;
  b.onclick = e => { e.currentTarget.blur(); ptPrDlg($('ptPrintDlg').hidden); };
  $('ptPrGo').onclick = ptPrGo;
  $('ptPrNo').onclick = () => ptPrDlg(false);
  $('ptPrintDlg').addEventListener('click', e => { if (e.target.id === 'ptPrintDlg') ptPrDlg(false); });
  $('ptPrintDlg').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') ptPrDlg(false); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ptPrInit); else ptPrInit();
