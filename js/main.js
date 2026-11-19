/* ================= Load VexFlow ================= */
const SRCS = [
  'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js',
  'https://unpkg.com/vexflow@4.2.2/build/cjs/vexflow.js'
];
(function load(i){
  if (i >= SRCS.length){
    document.getElementById('main').insertAdjacentHTML('beforeend', '<div class="err">De notatiebibliotheek (VexFlow) kon niet geladen worden. Herlaad de pagina.</div>');
    return;
  }
  const s = document.createElement('script'); s.src = SRCS[i];
  s.onload = () => { try { Notatie._loaded(); render(); } catch(e){ console.error(e); document.getElementById('main').insertAdjacentHTML('beforeend', '<div class="err">Fout bij tekenen: ' + e.message + '</div>'); } };
  s.onerror = () => load(i + 1);
  document.head.appendChild(s);
})(0);
