/* ================= Uitschuifpaneel (gedeeld, `Paneel`) =================
   Eén paneel voor de instellingen van een oefening, zodat de oefening zelf het scherm vult.
   Knop 🕹️ (bewust níet ⚙️: dat is voor de hele app en staat sinds 15-11 niet meer in de kop van oefeningen, alleen in de tabbalk).

   HTML per view (alles binnen de .view; het paneel mag diep in de view staan, het is position:fixed):
     <button class="pnlbtn">🕹️ Instellingen</button>                 (één of meer knoppen, overal in de view)
     <aside class="pnl" data-title="Intervallen"> …ropts/chips… </aside>
   Paneel.init() voegt per paneel zelf toe: kop met titel + ✕, voetregel (verwijzing naar ⚙️), en de schaduw .pnlshade.
   Open = class `pnlopen` op de view. Dicht via ✕, klik op de schaduw, Esc (capture, daarna doet Esc gewoon ook 'stop'),
   en bij elke routewissel (router.js roept Paneel.closeAll()).

   API: Paneel.init() · Paneel.set(view|id, open?) (zonder open = wisselen) · Paneel.isOpen(view|id) · Paneel.closeAll()
        · Paneel.onToggle(fn(viewEl, open)) · Paneel.moveHeader(viewId)
   moveHeader: de afspeelopties uit de kopbalk (#playOpts: metronoom, aftellen, ritme meespelen, klanken, herhalen)
   verhuizen naar de plek .pnlplay in het paneel van de actieve ritme-view (Atlas, Tikken, Ritme luisteren).
   Tempo, Pauze en Stop blijven in de kopbalk. */

const Paneel = (function(){
  const cbs = [];
  const el = v => typeof v === 'string' ? document.getElementById(v) : v;
  const isOpen = v => { v = el(v); return !!(v && v.classList.contains('pnlopen')); };

  function set(v, open){
    v = el(v); if (!v) return;
    if (open == null) open = !isOpen(v);
    if (open === isOpen(v)) return;
    v.classList.toggle('pnlopen', open);
    v.querySelectorAll('.pnlbtn').forEach(b => b.setAttribute('aria-expanded', open ? 'true' : 'false'));
    cbs.forEach(f => { try { f(v, open); } catch(e){ console.error(e); } });
  }
  function closeAll(){ document.querySelectorAll('.view.pnlopen').forEach(v => set(v, false)); }

  function init(){
    document.querySelectorAll('aside.pnl').forEach(a => {
      if (a.dataset.pnlInit) return;
      const v = a.closest('.view'); if (!v) return;
      a.dataset.pnlInit = '1';
      if (!a.id) a.id = v.id + 'Pnl';
      a.setAttribute('aria-label', 'Instellingen ' + (a.dataset.title || ''));
      a.insertAdjacentHTML('afterbegin', `<div class="pnlhead"><b>🕹️ Instellingen${a.dataset.title ? ' <span class="pnltitle">· ' + a.dataset.title + '</span>' : ''}</b><button class="pnlx" type="button" title="Sluiten (Esc)">✕</button></div>`);
      a.insertAdjacentHTML('beforeend', '<p class="pnlfoot">Dit zijn de instellingen van deze oefening. Thema, volume, klanken en sneltoetsen voor de hele app staan onder <a href="#instellingen">⚙️ Instellingen</a> (op het startscherm in de balk onderaan).</p>');
      const sh = document.createElement('div'); sh.className = 'pnlshade'; a.after(sh);
      sh.onclick = () => set(v, false);
      a.querySelector('.pnlx').onclick = () => set(v, false);
      v.querySelectorAll('.pnlbtn').forEach(b => {
        b.type = 'button'; b.setAttribute('aria-controls', a.id); b.setAttribute('aria-expanded', 'false');
        if (!b.title) b.title = 'Instellingen van deze oefening';
        b.onclick = () => { b.blur(); set(v); };
      });
    });
  }

  function moveHeader(viewId){
    const po = document.getElementById('playOpts'), v = el(viewId); if (!po || !v) return;
    const slot = v.querySelector('.pnlplay'); if (slot && po.parentNode !== slot) slot.appendChild(po);
  }

  // Esc sluit het open paneel van de huidige view (in capture-fase; de module-handlers krijgen Esc daarna gewoon ook)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const v = document.querySelector('.view.on.pnlopen'); if (v) set(v, false);
  }, true);

  return { init, set, isOpen, closeAll, onToggle: f => cbs.push(f), moveHeader };
})();
Paneel.init();
