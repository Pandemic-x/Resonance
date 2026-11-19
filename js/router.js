/* ================= Router ================= */
let view = 'home', viewEl = null;
const TAB_VIEWS = ['home','stats','handleiding','instellingen'];   // pagina's met de tabbalk onderaan (zoals Sonofield)
function route(){
  const prevView = view;
  let h = location.hash.replace('#', '');
  if (h === 'notenleer' || h === 'sheetmusic'){ h = 'notenlezen'; try { history.replaceState(null, '', '#notenlezen'); } catch(e){} }   // oude route: Notenleer heet nu Bladmuziek
  view = ['atlas','tikken','luisteren','metronoom','gehoor','absoluut','intervallen','dictee','drone','intonatie','toonladders','akkoorden','cadensen','progressies','baslijn','termen','akkoordsymbolen','rudiments','polyritme','tempoladder','swing',
          'ritme','gehoortraining','bladmuziek','notenlezen','noten','toonsoorten','toonladders-blad','intervallen-blad','akkoorden-blad','partituren',
          'instellingen','handleiding','stats'].includes(h) ? h : 'home';
  const prevEl = viewEl, prevRect = prevEl ? prevEl.getBoundingClientRect() : null;
  document.body.className = view + (TAB_VIEWS.includes(view) ? ' tabpage' : '') + (!TAB_VIEWS.includes(view) && !['ritme','gehoortraining','bladmuziek','notenlezen'].includes(view) ? ' oefening' : '');   // oefening: geen ⚙️ in de kop (alleen 🕹️, wens gebruiker 15-11)
  ['homeView','catView','quizView','main','tikView','metroView','gehoorView','absView','inView','mdView','droneView','ntView','ptView','cdView','prView','blView','tmView','asView','rdView','pyView','tpView','swView','setView','helpView','statsView'].forEach(id => $(id).classList.remove('on'));
  viewEl = $({ home:'homeView', stats:'statsView', atlas:'main', tikken:'tikView', luisteren:'quizView', metronoom:'metroView', gehoor:'gehoorView', absoluut:'absView', intonatie:'inView', intervallen:'ntView', dictee:'mdView', drone:'droneView', toonladders:'ntView', akkoorden:'ntView', cadensen:'cdView', progressies:'prView', baslijn:'blView', termen:'tmView', akkoordsymbolen:'asView', rudiments:'rdView', polyritme:'pyView', tempoladder:'tpView', swing:'swView', ritme:'catView', gehoortraining:'catView', bladmuziek:'catView', notenlezen:'catView', noten:'ntView', toonsoorten:'ntView', 'toonladders-blad':'ntView', 'intervallen-blad':'ntView', 'akkoorden-blad':'ntView', partituren:'ptView', instellingen:'setView', handleiding:'helpView' }[view]);
  viewEl.classList.add('on');
  if (typeof Nav !== 'undefined') Nav.slide(prevView, view, prevEl, viewEl, prevRect);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  document.querySelectorAll('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.t === view));
  stop(); Engine.metronome.stop(); window.scrollTo(0, 0);
  if (typeof Paneel !== 'undefined'){   // instellingenpaneel dicht; afspeelopties uit de kopbalk naar het paneel van de ritme-view
    Paneel.closeAll();
    const pv = { atlas:'main', tikken:'tikView', luisteren:'quizView' }[view];
    if (pv) Paneel.moveHeader(pv);
  }
  if (typeof gOnRoute === 'function') gOnRoute();
  if (typeof ivOnRoute === 'function') ivOnRoute();
  if (typeof mOnRoute === 'function') mOnRoute();
  if (typeof sOnRoute === 'function') sOnRoute();
  if (typeof scOnRoute === 'function') scOnRoute();
  if (typeof drOnRoute === 'function') drOnRoute();
  if (typeof inOnRoute === 'function') inOnRoute();
  if (typeof hOnRoute === 'function') hOnRoute();
  if (typeof lOnRoute === 'function') lOnRoute();
  if (typeof mtOnRoute === 'function') mtOnRoute();
  if (typeof nlOnRoute === 'function') nlOnRoute();
  if (typeof ptOnRoute === 'function') ptOnRoute();
  if (typeof hrOnRoute === 'function') hrOnRoute();
  if (typeof rtOnRoute === 'function') rtOnRoute();
  if (typeof tmOnRoute === 'function') tmOnRoute();
  if (typeof navOnRoute === 'function') navOnRoute();
}
window.addEventListener('hashchange', route);
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { location.hash = b.dataset.view; });
$('homeLink').onclick = e => { e.preventDefault(); location.hash = ''; route(); };
route();

/* --- wisselend tempo: instelbare plus-min --- */
const VARY_KEY = 'ritme-atlas-vary';
function varyAmt(p){
  const v = Math.round(+$(p + 'VaryAmt').value);
  return Math.min(100, Math.max(1, v || 20));
}
function varyBpm(base, p){
  const a = varyAmt(p);
  const lo = Math.max(30, base - a), hi = Math.min(240, base + a);
  return Math.round(lo + Math.random() * (hi - lo));
}
function setupVary(p){
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(VARY_KEY)) || {}; } catch(e){}
  if (saved[p]) $(p + 'VaryAmt').value = saved[p];
  const show = () => { $(p + 'VaryBox').style.display = $(p + 'Vary').checked ? '' : 'none'; };
  $(p + 'Vary').addEventListener('change', show);
  $(p + 'VaryAmt').addEventListener('change', () => {
    $(p + 'VaryAmt').value = varyAmt(p);
    let s = {}; try { s = JSON.parse(localStorage.getItem(VARY_KEY)) || {}; } catch(e){}
    s[p] = varyAmt(p); try { localStorage.setItem(VARY_KEY, JSON.stringify(s)); } catch(e){}
  });
  show();
}

