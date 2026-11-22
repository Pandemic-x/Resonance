/* ================= Versienummer op het startscherm (19-11-2026, wens gebruiker) =================
   Linksboven op Home staat klein "v1.7". Tik erop = wat er in de laatste versies veranderd is.
   Uit te zetten in Instellingen → Weergave → "Versienummer op het startscherm" (opslag 'versie-tonen' = '0').
   CLAUDE: bij elke aanpassing die je in de app zet: VERSIE ophogen en bovenaan NIEUW een regel toevoegen
   (wens gebruiker: gewoon doortellen 1.7 → 1.8 → 1.9 → 1.10 …; het eerste getal alleen omhoog bij een
   echt grote update, zoals het gedeelde notensysteem). Zelfde nummer in artifact én website. */
const Versie = (function(){
  const VERSIE = '1.27';
  const NIEUW = [
    ['1.27', '22-11', 'Transcriberen: pianobalk (viool- en bassleutel met accolade), wissel met Alt+↑ ↓ of ⇅; beide balken klinken en gaan mee naar Repertoire'],
    ['1.26', '22-11', 'Transcriberen: akkoordsymbool met K; Ctrl+K opent weer overal de bibliotheek'],
    ['1.25', '22-11', 'Nieuw onder Bladmuziek: ✍️ Transcriberen, je eigen noteneditor (zoals MuseScore) met akkoordsymbolen, afspelen en ➜ naar Repertoire'],
    ['1.24', '22-11', 'Nieuw blok: kies meteen een emoji (☺ naast het naamveld); die komt direct bij het begin van het blok in de partituur'],
    ['1.23', '22-11', 'Blokken: met ✎ de naam en de maten van een blok aanpassen, ook een maat erbij of eraf aan begin of eind'],
    ['1.22', '22-11', 'Repertoire: ▦ Blokken-lijst per stuk met ‹ ›; emoji in de partituur = nieuw blok, emoji bij een blok = ook in de partituur'],
    ['1.21', '22-11', 'Aantekeningen: ⚠️ en 🔁 stempels zijn weer zichtbaar; tekenen op een verborgen laag maakt die laag weer zichtbaar'],
    ['1.20', '22-11', 'Repertoire: ⚠️ lastige plekken (markeren → oefenen → afvinken), ➰ aantekeningen selecteren en verplaatsen, 🖨️ printen/PDF, eigen emoji bij blokken'],
    ['1.19', '22-11', 'Aantekeningen: 🔤 tekstvakjes en 🗂️ lagen (bv. vingerzetting, streken) die je per stuk aan en uit zet'],
    ['1.18', '22-11', 'Albums: bij een heel stuk in een album klap je met ▸ zijn blokken (passages) uit en open je ze direct'],
    ['1.17', '22-11', 'Repertoire: 📁 albums voor stukken en passages, zelf sorteren, passages per stuk uitklappen, ‹ › naar het volgende onderdeel'],
    ['1.16', '22-11', 'Aantekeningen: alle stempel-tabbladen en stempels zijn zichtbaar zonder opzij te scrollen (ook met een muis)'],
    ['1.15', '22-11', 'Repertoire: ✏️ aantekeningen op je partituur (pen, markeerstift, gum, stempels per instrument), ook in volledig scherm en met een stylus'],
    ['1.14', '22-11', 'Repertoire: in volledig scherm kun je nu maten, Focus en passage aanpassen zonder het volledig scherm te verlaten; een nieuw toegevoegd stuk opent weer meteen'],
    ['1.13', '21-11', 'Repertoire: trillers (tr) en mordenten klinken nu echt, met de juiste hulpnoot (ook met ♭/♮/♯ boven het teken); keuze beginnen op de noot erboven of de geschreven noot'],
    ['1.12', '19-11', 'Dagroutine: duurknop heet nu 30 min (in plaats van Half uur)'],
    ['1.11', '19-11', 'Sneller openen op je telefoon (bestanden uit de cache), zachte start ook bij traag internet, nieuwe versie laadt vanzelf'],
    ['1.10', '19-11', 'Dagroutine: het Atlas-menu staat niet meer bovenaan de routinepagina'],
    ['1.9', '19-11', 'Zachte start: de app fadet in bij het openen in plaats van alles abrupt te tonen'],
    ['1.8', '19-11', 'Dagroutine: kern + roulerend, focus of programma; 10/20/30 min; tips per blok, overzicht en kalender'],
    ['1.7', '19-11', 'Versienummer op het startscherm; Drone kan alle 21 toonladders uit de theoriebibliotheek; Toonsoorten uit de bibliotheek'],
    ['1.6', '19-11', 'Akkoordsymbolen: slash chords (omkeringen) en 13 uitgebreide akkoorden'],
    ['1.5', '19-11', 'Akkoordprogressies: geen geluid meer bij het invullen'],
    ['1.4', '19-11', 'Absoluut gehoor: − = mol, + = kruis vóór de letter'],
    ['1.3', '19-11', 'Bibliotheek met zoeken en favorieten, Doorgaan-knop, ← Home op Instellingen'],
    ['1.2', '19-11', 'Synchroniseren tussen apparaten (website)'],
    ['1.1', '19-11', 'Zwart thema met Resonance-paars, website met app-icoon']
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
