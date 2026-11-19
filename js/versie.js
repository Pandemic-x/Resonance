/* ================= Versienummer op het startscherm (19-11-2026, wens gebruiker) =================
   Linksboven op Home staat klein "v2.6.0". Tik erop = wat er in de laatste versies veranderd is.
   Uit te zetten in Instellingen → Weergave → "Versienummer op het startscherm" (opslag 'versie-tonen' = '0').
   CLAUDE: bij elke aanpassing die je in de app zet: VERSIE ophogen en bovenaan NIEUW een regel toevoegen
   (patch = kleine fix, minor = nieuwe functie, major = grote verbouwing). Zelfde nummer in artifact én website. */
const Versie = (function(){
  const VERSIE = '2.6.0';
  const NIEUW = [
    ['2.6.0', '19-11', 'Versienummer op het startscherm; Drone kan alle 21 toonladders uit de theoriebibliotheek; Toonsoorten uit de bibliotheek'],
    ['2.5.0', '19-11', 'Akkoordsymbolen: slash chords (omkeringen) en 13 uitgebreide akkoorden'],
    ['2.4.1', '19-11', 'Akkoordprogressies: geen geluid meer bij het invullen'],
    ['2.4.0', '19-11', 'Absoluut gehoor: − = mol, + = kruis vóór de letter'],
    ['2.3.0', '19-11', 'Bibliotheek met zoeken en favorieten, Doorgaan-knop, ← Home op Instellingen'],
    ['2.2.0', '19-11', 'Synchroniseren tussen apparaten (website)'],
    ['2.1.0', '19-11', 'Zwart thema met Resonance-paars, website met app-icoon']
  ];
  const KEY = 'versie-tonen';
  const aan = () => { try { return localStorage.getItem(KEY) !== '0'; } catch(e){ return true; } };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let pop = null;
  function sluit(){ if (pop){ pop.remove(); pop = null; } }
  function toon(btn){
    if (pop){ sluit(); return; }
    pop = document.createElement('div'); pop.className = 'versiepop'; pop.setAttribute('role', 'dialog');
    pop.innerHTML = '<b>Nieuw in Resonance</b>' + NIEUW.slice(0, 6).map(([v, d, t]) => '<div class="vprow"><span class="vpv">' + v + '<small>' + d + '</small></span><span>' + esc(t) + '</span></div>').join('');
    document.getElementById('homeView').appendChild(pop);
  }
  function render(){
    let b = document.getElementById('versieBtn');
    if (!b){
      const hv = document.getElementById('homeView'); if (!hv) return;
      b = document.createElement('button'); b.type = 'button'; b.id = 'versieBtn'; b.className = 'versiebtn';
      b.title = 'Versie van de app: tik voor wat er nieuw is';
      b.onclick = e => { e.stopPropagation(); b.blur(); toon(b); };
      hv.appendChild(b);
    }
    b.textContent = 'v' + VERSIE + (window.claude ? '' : ' · web');
    b.hidden = !aan(); if (b.hidden) sluit();
    const c = document.getElementById('sVersie'); if (c) c.checked = aan();
  }
  function init(){
    render();
    const c = document.getElementById('sVersie');
    if (c) c.onchange = () => { try { localStorage.setItem(KEY, c.checked ? '1' : '0'); } catch(e){} render(); c.blur(); };
    document.addEventListener('click', e => { if (pop && !pop.contains(e.target)) sluit(); });
    window.addEventListener('hashchange', sluit);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { VERSIE, NIEUW, render };
})();
