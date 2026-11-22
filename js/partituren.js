/* ================= Partituren (route #partituren, div #ptView, prefix pt) — stap 1 van de bladmuziekspeler =================
   Je eigen stukken als MusicXML (.musicxml / .xml / .mxl): tonen, afspelen met je eigen klank en meelezende noten,
   tempo, metronoom, en een oefenblok (maat x t/m y) in focus en in een lus (eventueel elke ronde iets sneller).

   Bouwt op OpenSheetMusicDisplay (OSMD 1.x, jsDelivr → unpkg), alleen geladen als je Partituren opent (eigen VexFlow
   in de bundel; window.Vex van de notatie-kern wordt na het laden teruggezet voor de zekerheid).
   - Bibliotheek: IndexedDB 'partituren' / store 'stukken' = {id, naam, titel, comp, data (tekst, of binaire string bij .mxl),
     made, last, s:{bpm, unit, from, to, focus, loop, inc, max, hands}} (per apparaat, zoals de rest van de app).
     Algemene keuzes in localStorage 'partituren-settings' = {tempi, metro, ci, inst, vol, cursor, zoom}.
   - Tijdlijn (ptBuild): OSMD-iterator (Sheet.MusicPartManager.getIterator(), anders de cursor) → stappen
     {w (hele noten vanaf het begin), dt, mi, mn (maatnummer), notes [{n, m (midi), d, st (balk)}], all [Note]}.
     dt = afstand tot de volgende stap, nooit langer dan de kortste noot die hier begint (zo kloppen herhalingen ook).
     Toonhoogte: note.halfTone + ptOff; ptOff wordt eenmalig geijkt met een testnoot (B4 = midi 71).
   - Afspelen (ptPlay/ptTick): eigen vooruitplanner op de audioklok (zoals audio.js), noten via Engine.note,
     tikken via Engine.click (notesBus = true, dus stopNotes() legt ze ook stil). Een blok volgt herhalingen als het verder
     loopt dan het herhaalteken (Hele stuk); eindigt het blok bij het herhaalteken, dan speelt de lus het blok één keer.
   - Meelezen: 'noten' = de klinkende noten lichten op in de themakleur (class pthi op de VexFlow-groep via
     rules.GNote(note).getSVGGElement()); 'lijn' = OSMD-cursor als dunne lijn (ook de terugval als oplichten niet lukt).
   - Klik op een noot = cursor daarheen; dubbelklik = die maat spelen; ⬚ Selecteer passage = eerste + laatste maat aanklikken. Noten buiten het blok zijn gedimd.
   - Donker: de SVG-kleuren worden in CSS op currentColor gezet (css/partituren.css), zoals bij de notatie-kern.
   Toetsen (Keys): luister/pauze = afspelen/pauze, begin = terug naar het begin van het blok, metronoom = tik aan/uit,
   sneller/langzamer = tempo ±1 (Shift ±5), stop = stop. */

const PT_SRCS = [
  // vaste versie (geen @2 of @latest), zodat een update van OSMD niets onverwachts verandert. 2.x tekent 5–8× sneller dan 1.x (gemeten 18-11-2026)
  'https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@2.3.1/build/opensheetmusicdisplay.min.js',
  'https://unpkg.com/opensheetmusicdisplay@2.3.1/build/opensheetmusicdisplay.min.js'
];
const PT_UNITS = { h:{ w:2, s:'𝅗𝅥', n:'halve noot' }, q:{ w:4, s:'♩', n:'kwartnoot' }, qd:{ w:8 / 3, s:'♩.', n:'gepunteerde kwart' }, e:{ w:8, s:'♪', n:'achtste' } };
const PT_GKEY = 'partituren-settings';
const PT_G_DEF = { cv:2, tempi:true, metro:true, ci:1, inst:'piano', vol:70, cursor:'lijn', zoom:100, follow:true, lineOfs:0, paper:'app', rot:0, fsZoom:1, fsMode:'blad', libF:'alle', hideBar:true, titles:false, fsPages:'' };
const PT_STATUS = { nieuw:{ i:'🆕', n:'Nieuw' }, bezig:{ i:'🔨', n:'Bezig' }, zit:{ i:'✅', n:'Zit erin' } };
const PT_INSTR = { viool:'🎻 Viool', piano:'🎹 Piano', overig:'🎼 Overig' };
const PT_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Voorbeeld in b-klein</work-title></work>
  <part-list><score-part id="P1"><part-name>Viool</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><key><fifths>2</fifths><mode>minor</mode></key>
        <time symbol="cut"><beats>2</beats><beat-type>2</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>C</step><alter>1</alter><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">begin</beam></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">continue</beam></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">continue</beam></note>
      <note><pitch><step>C</step><alter>1</alter><octave>5</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">end</beam></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>A</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><type>quarter</type><accidental>sharp</accidental></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>C</step><alter>1</alter><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><type>half</type></note>
      <note><rest/><duration>4</duration><type>half</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>
</score-partwise>`;

let ptG = Object.assign({}, PT_G_DEF);
try { Object.assign(ptG, JSON.parse(localStorage.getItem(PT_GKEY)) || {}); } catch(e){}
if (!(ptG.cv >= 2)){ ptG.cv = 2; ptG.cursor = 'lijn'; }   // nieuwe standaard: de glijdende lijn
const PT_CV = 2;           // cacheversie: ophogen als de manier van tekenen/taggen verandert (2 = OSMD 2.3.1)
const PT_FS_W = 820;       // tekenbreedte van de bladzijden in volledig scherm
let ptLibLoad = null, ptOsmd = null, ptOsmdFor = null, ptOff = 12, ptCalibrated = false;
let ptList = [], ptCur = null, ptSteps = [], ptMeasures = [], ptMStarts = [], ptBeats = [], ptStaves = 1;
let ptEls = [], ptSrc = '', ptKeyNow = '', ptGeo = null, ptRaf = 0;
let ptPausedW = null, ptSel = null, ptDragJust = false, ptElStep = [], ptPausedBy = '', ptFsSc = 1, ptFlip = null, ptWNorm = 0, ptFsWasReal = false, ptFsOn = false, ptPages = [], ptFsP = 0, ptFsN = 1, ptFsCont = false;
let ptRun = null, ptPausedAt = null, ptHiOK = true, ptSaveT = null, ptW = 0, ptInited = false;
const ptMem = [];   // terugval als IndexedDB niet werkt (dan alleen deze sessie)

/* ---------- opslag ---------- */
const PtDB = (function(){
  let dbp = null, ok = true;
  function open(){
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('partituren', 2);
        r.onupgradeneeded = () => { const db = r.result;
          if (!db.objectStoreNames.contains('stukken')) db.createObjectStore('stukken', { keyPath:'id' });
          if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache'); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch(e){ rej(e); }
    });
    dbp.catch(() => { ok = false; });
    return dbp;
  }
  function tx(store, mode, fn){
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode), req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  return {
    all: () => tx('stukken', 'readonly', st => st.getAll()).catch(() => { ok = false; return ptMem.slice(); }),
    put: o => tx('stukken', 'readwrite', st => st.put(o)).catch(() => { ok = false; const i = ptMem.findIndex(x => x.id === o.id); if (i >= 0) ptMem[i] = o; else ptMem.push(o); }),
    del: id => tx('stukken', 'readwrite', st => st.delete(id)).catch(() => { ok = false; const i = ptMem.findIndex(x => x.id === id); if (i >= 0) ptMem.splice(i, 1); }),
    cget: k => tx('cache', 'readonly', st => st.get(k)).catch(() => undefined),
    cput: (k, v) => tx('cache', 'readwrite', st => st.put(v, k)).catch(() => {}),
    cdel: k => tx('cache', 'readwrite', st => st.delete(k)).catch(() => {}),
    // tekeningen/tijdlijnen van een oudere cacheversie weggooien ('<id>|<versie>|…'), anders blijven ze ongebruikt staan
    cclean: v => tx('cache', 'readwrite', st => { const r = st.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return; const k = String(c.key).split('|'); if (k.length > 2 && k[1] !== String(v)) c.delete(); c.continue(); }; return null; }).catch(() => {}),
    // back-up terugzetten: alle stukken vervangen (de cache wordt geleegd, die bouwt zich vanzelf weer op)
    replaceAll: list => tx('cache', 'readwrite', st => st.clear()).catch(() => {})
      .then(() => tx('stukken', 'readwrite', st => { st.clear(); list.forEach(o => st.put(o)); return null; })),
    ok: () => ok
  };
})();
function ptSaveG(){ try { localStorage.setItem(PT_GKEY, JSON.stringify(ptG)); } catch(e){} }
function ptSaveCur(){ clearTimeout(ptSaveT); if (ptCur) ptSaveT = setTimeout(() => PtDB.put(ptCur), 400); }
const ptToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ptDay = s => { if (!s) return ''; const p = s.split('-'); return (+p[2]) + '-' + (+p[1]); };
const ptEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const ptFrame = () => new Promise(r => { let done = false; const go = () => { if (!done){ done = true; setTimeout(r, 20); } }; requestAnimationFrame(go); setTimeout(go, 200); });
const ptWithin = (p, ms, what) => { let tm; return Promise.race([p, new Promise((_, rej) => { tm = setTimeout(() => rej(new Error(what + ' duurde langer dan ' + Math.round(ms / 1000) + ' s')), ms); })]).finally(() => clearTimeout(tm)); };
function ptMsg(html, cls){
  const el = $('ptMsg'); if (el){ el.innerHTML = html || ''; el.className = 'ptmsg' + (cls ? ' ' + cls : ''); }
  const L = $('ptFsLoad');   // in volledig scherm is #ptMsg niet te zien: laden daar in het midden tonen
  if (L){ if (ptFsOn && cls === 'busy'){ L.innerHTML = html + '<small>Alleen de eerste keer; daarna opent dit meteen.</small>'; L.hidden = false; } else L.hidden = true; }
}

/* ---------- bibliotheek laden (OSMD) ---------- */
function ptLoadLib(){
  if (window.opensheetmusicdisplay) return Promise.resolve();
  if (ptLibLoad) return ptLibLoad;
  const keepVex = window.Vex;
  ptLibLoad = new Promise((res, rej) => {
    (function next(i){
      if (i >= PT_SRCS.length){ ptLibLoad = null; rej(new Error('De notenbibliotheek (OpenSheetMusicDisplay) kon niet geladen worden.')); return; }
      const s = document.createElement('script'); s.src = PT_SRCS[i];
      s.onload = () => {
        if (keepVex && window.Vex !== keepVex) window.Vex = keepVex;
        if (window.opensheetmusicdisplay) res(); else next(i + 1);
      };
      s.onerror = () => next(i + 1);
      document.head.appendChild(s);
    })(0);
  });
  return ptLibLoad;
}
async function ptCalibrate(){   // halfTone → midi: eenmalig meten met een bekende noot (B4 = 71)
  if (ptCalibrated) return; ptCalibrated = true;
  const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:-9999px;top:0;width:500px';
  document.body.appendChild(d);
  try {
    const o = new opensheetmusicdisplay.OpenSheetMusicDisplay(d, { autoResize:false, backend:'svg' });
    await o.load(PT_SAMPLE);
    const n = o.Sheet.SourceMeasures[0].VerticalSourceStaffEntryContainers[0].StaffEntries[0].VoiceEntries[0].Notes[0];
    const ht = typeof n.halfTone === 'number' ? n.halfTone : n.Pitch.getHalfTone();
    if (Number.isFinite(ht)) ptOff = 71 - ht;
  } catch(e){ console.warn('Partituren: ijken mislukt, standaard +12', e); }
  d.remove();
}
function ptAccent(){ try { return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0712c'; } catch(e){ return '#e0712c'; } }
/* Bladzijden vol maken (18-11-2026, wens gebruiker: "geen leegte"): OSMD zet de regels bovenaan en laat de rest leeg.
   Hier wordt de overgebleven ruimte gelijk verdeeld over de ruimtes tussen de regels, zoals in een gedrukte uitgave.
   Niet op de laatste bladzijde. Elk element in de SVG gaat naar de regel waar het (verticaal) bij hoort. */
function ptJustify(){
  try {
    const P = ptOsmd.GraphicSheet && ptOsmd.GraphicSheet.MusicPages; if (!P || P.length < 2) return;
    const host = $('ptOsmdHost'), svgs = [...host.querySelectorAll('svg')].filter(x => !x.parentElement.closest('svg'));
    if (svgs.length !== P.length) return;
    const f = 10 * (ptOsmd.zoom || 1), r = ptOsmd.EngravingRules || ptOsmd.rules, bm = ((r && r.PageBottomMargin) || 5) * f;
    P.forEach((pg, pi) => {
      if (pi === P.length - 1) return;
      const sys = (pg.MusicSystems || []).map(m => { const ps = m.PositionAndShape, y = ps.AbsolutePosition.y; return { t:(y + ps.BorderMarginTop) * f, b:(y + ps.BorderMarginBottom) * f }; });
      if (sys.length < 2) return;
      const svg = svgs[pi], H = parseFloat(svg.getAttribute('height')) || 0;
      const free = H - bm - sys[sys.length - 1].b; if (!(free > 8)) return;
      const add = Math.min(free / (sys.length - 1), 160);
      const groups = sys.map((x, j) => { const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('transform', 'translate(0,' + (j * add).toFixed(1) + ')'); g.setAttribute('class', 'ptsys'); return g; });
      [...svg.children].forEach(el => {
        if (el.tagName.toLowerCase() === 'rect' && el.getAttribute('width') === svg.getAttribute('width')) return;   // achtergrond
        let bb; try { bb = el.getBBox(); } catch(e){ return; }
        if (!bb || (!bb.width && !bb.height)) return;
        const cy = bb.y + bb.height / 2;
        let j = sys.findIndex(x => cy >= x.t - 4 && cy <= x.b + 4);
        if (j < 0){ let d = Infinity; sys.forEach((x, k) => { const dd = Math.min(Math.abs(cy - x.t), Math.abs(cy - x.b)); if (dd < d){ d = dd; j = k; } }); }
        if (j > 0) groups[j].appendChild(el);
      });
      groups.slice(1).forEach(g => { if (g.childNodes.length) svg.appendChild(g); });
    });
  } catch(e){ console.warn('Repertoire: bladzijde vullen mislukt', e); }
}
let ptRulesDef = null;
function ptCompactRules(on, paged){   // marges en ruimte tussen de regels; standaardwaarden van OSMD terugzetten bij bladzijden
  const r = ptOsmd && (ptOsmd.EngravingRules || ptOsmd.rules); if (!r) return;
  const K = ['PageTopMargin', 'PageTopMarginNarrow', 'PageBottomMargin', 'PageLeftMargin', 'PageRightMargin', 'MinimumDistanceBetweenSystems', 'MinSkyBottomDistBetweenSystems'];
  if (!ptRulesDef){ ptRulesDef = {}; K.forEach(k => { if (typeof r[k] === 'number') ptRulesDef[k] = r[k]; }); }
  const C = { PageTopMargin:1.5, PageTopMarginNarrow:1.5, PageBottomMargin:1.5, PageLeftMargin:1.5, PageRightMargin:1.5 };
  K.forEach(k => {
    if (!(k in ptRulesDef)) return;
    let v = ptRulesDef[k];
    if (on){ if (k === 'PageBottomMargin' && paged) v = Math.max(v, 6); else if (k in C) v = Math.min(v, C[k]); else v = v * .75; }   // bladzijden: onderrand ruim, anders valt de onderste regel er net af
    r[k] = v;
  });
}
function ptNewOsmd(){
  ptRulesDef = null;
  ptOsmd = new opensheetmusicdisplay.OpenSheetMusicDisplay($('ptOsmdHost'), {
    autoResize:false, backend:'svg', drawTitle:true, drawSubtitle:true, drawComposer:true, drawCredits:false, followCursor:false
  });
}

/* ---------- tijdlijn uit de partituur ---------- */
const ptReal = f => (f && typeof f.RealValue === 'number') ? f.RealValue : 0;
function ptTs(it){
  for (const k of ['CurrentEnrolledTimestamp', 'currentTimeStamp', 'CurrentSourceTimestamp']){
    try { const f = it[k]; if (f && typeof f.RealValue === 'number') return f.RealValue; } catch(e){}
  }
  return NaN;
}
function ptIsRest(n){ try { return n.isRest ? n.isRest() : !n.Pitch; } catch(e){ return !n.Pitch; } }
function ptMidi(n){
  let ht = null;
  try { ht = typeof n.halfTone === 'number' ? n.halfTone : n.Pitch.getHalfTone(); } catch(e){}
  return Number.isFinite(ht) ? ht + ptOff : null;
}
function ptStaff(n){
  const tries = [() => n.ParentStaffEntry.ParentStaff, () => n.ParentVoiceEntry.ParentSourceStaffEntry.ParentStaff];
  for (const f of tries){ try { const s = f(); if (s && typeof s.idInMusicSheet === 'number') return s.idInMusicSheet; } catch(e){} }
  return 0;
}
/* ---------- klank per balk: Automatisch = vioolpartijen met de vioolopname, de rest piano ----------
   ptStaffNames = per balk (zelfde volgorde als idInMusicSheet) de naam van de partij uit de MusicXML (part-name, afkorting,
   instrument-name, instrument-sound). Per stuk kiesbaar in it.s.klank ('auto' of een Engine-klank). */
let ptStaffNames = [], ptPartOf = [], ptParts = [];   // ptPartOf[balk] = partij-index; ptParts = [{name, staves:[…]}]
const PT_VLN = /\b(viool|violen|viol|violin|violins|violini|violino|violon|viola|vla|vl|vln|vn|altviool|geige|bratsche|fiddle)\b|strings\.(violin|viola)\b/i;
async function ptPartsLoad(it){
  const names = [], partOf = [], parts = [];
  try {
    const xml = await ptWithin(ptXmlText(it.data), 15000, 'partijen lezen');
    const doc = xml && new DOMParser().parseFromString(xml, 'application/xml');
    if (doc && !doc.getElementsByTagName('parsererror').length){
      const pn = {}, show = {};
      Array.from(doc.getElementsByTagName('score-part')).forEach(sp => {
        const g = t => Array.from(sp.getElementsByTagName(t)).map(e => e.textContent.trim()).join(' ');
        pn[sp.getAttribute('id')] = [g('part-name'), g('part-abbreviation'), g('instrument-name'), g('instrument-sound')].join(' ');
        show[sp.getAttribute('id')] = (g('part-name') || g('part-abbreviation') || g('instrument-name')).replace(/\s+/g, ' ').trim();
      });
      Array.from(doc.getElementsByTagName('part')).forEach((p, pi) => {
        const s = p.getElementsByTagName('staves')[0], n = s ? Math.max(1, parseInt(s.textContent, 10) || 1) : 1;
        const part = { name:show[p.getAttribute('id')] || 'Partij ' + (pi + 1), staves:[] };
        for (let k = 0; k < n; k++){ part.staves.push(names.length); partOf.push(pi); names.push(pn[p.getAttribute('id')] || ''); }
        parts.push(part);
      });
    }
  } catch(e){ console.warn('Repertoire: partijnamen lezen mislukt', e); }
  if (ptCur !== it) return;
  ptStaffNames = names; ptPartOf = partOf; ptParts = parts;
  ptKlankPreload(); ptMixUI();
}
/* Mixer (🕹️ → Wat je hoort): per partij van dit stuk volume, aan/uit en klank (it.s.mix = {partij-index: {v 0–150, m stil, k klank|'auto'}}),
   plus een balans per klank voor alle stukken (ptG.bal = {strijker:100, piano:100, …}). */
const ptViool = () => ptG.viool === 'strijker' ? 'strijker' : 'viooliowa';   // welke viool bij Automatisch (🕹️ → Wat je hoort), standaard Iowa
const ptPartIdx = st => ptPartOf[st] != null ? ptPartOf[st] : 0;
function ptMixOf(p){ const m = (ptCur && ptCur.s && ptCur.s.mix || {})[p] || {}; return { v:m.v != null ? m.v : 100, m:!!m.m, k:m.k || 'auto' }; }
function ptGain(st){
  const m = ptMixOf(ptPartIdx(st)); if (m.m) return 0;
  const b = (ptG.bal || {})[Engine.instId(ptKlank(st))];
  return m.v / 100 * (b != null ? b : 100) / 100;
}
function ptKlank(st){
  const pk = ptMixOf(ptPartIdx(st)).k;
  if (pk !== 'auto') return pk;
  return ptKlankStuk(st);
}
function ptKlankStuk(st){   // klank zonder keuze per partij: de Klank van het stuk, of Automatisch
  const k = (ptCur && ptCur.s && ptCur.s.klank) || 'auto';
  if (k !== 'auto') return k;
  if (PT_VLN.test(ptStaffNames[st] || '')) return ptViool();
  if (ptCur && ptCur.instr === 'viool' && st === 0 && !ptStaffNames.some(n => PT_VLN.test(n))) return ptViool();   // vioolstuk zonder herkenbare partijnaam
  return 'piano';
}
const ptInstName = id => { const x = Engine.INSTRUMENTS.find(i => i.id === Engine.instId(id)); return x ? x.n : id; };
function ptMixUI(){
  const box = $('ptMix'); if (!box || !ptCur) return;
  ptGalmMigrate();
  const parts = ptParts.length ? ptParts : [{ name:'Alle noten', staves:[0] }];
  const used = new Set([ptViool(), 'piano']);
  for (let st = 0; st < Math.max(1, ptStaves, ptStaffNames.length); st++) used.add(Engine.instId(ptKlank(st)));
  const row = (attrs, name, on, val, extra) => `<div class="ptmixrow"${attrs}><label class="ptmixn"><input type="checkbox" class="ptmixon"${on ? ' checked' : ''}> <span>${ptEsc(name)}</span></label>${extra || '<span></span>'}<input type="range" class="ptmixv" min="0" max="150" step="5" value="${val}"><output>${val}%</output></div>`;
  box.innerHTML = '<div class="ptmixh">Partijen in dit stuk</div>' +
    parts.map((pt, i) => {
      const m = ptMixOf(i), auto = ptInstName(ptKlankStuk(pt.staves[0] || 0));
      const sel = `<select class="ptmixk" title="Klank van deze partij"><option value="auto">${ptEsc(auto)} (auto)</option>${Engine.INSTRUMENTS.map(x => `<option value="${x.id}"${m.k === x.id ? ' selected' : ''}>${x.n}</option>`).join('')}</select>`;
      return row(` data-p="${i}"`, pt.name, !m.m, m.v, sel);
    }).join('') +
    '<div class="ptmixh">Balans voor alle stukken</div>' +
    [...used].map(id => { const b = (ptG.bal || {})[id]; return row(` data-b="${id}"`, ptInstName(id), true, b != null ? b : 100).replace('<input type="checkbox" class="ptmixon" checked> ', ''); }).join('') +
    `<div class="ptmixh">Viool</div>` +
    `<label class="ptrow ptmixvib"><span>Viool bij auto</span><select id="ptViool"><option value="viooliowa">Viool Iowa</option><option value="strijker">Viool VSCO</option></select></label>` +
    `<label class="ptrow ptmixvib" title="Alleen voor Viool VSCO; de Iowa-viool speelt een rechte toon, bijna zonder vibrato"><span>Vibrato (VSCO)</span><select id="ptVib"><option value="normaal">normaal</option><option value="weinig">weinig</option><option value="uit">uit</option></select></label>` +
    ptGalmRow('viooliowa', 'Galm Iowa', 'Zaalklank voor Viool Iowa (droog opgenomen; geldt overal in de app)') +
    ptGalmRow('strijker', 'Galm VSCO', 'Zaalklank voor Viool VSCO (heeft al wat eigen galm; geldt overal in de app)') +
    '<small class="ptmixtip">Volume per partij × balans van de klank × het algemene Volume. Werkt meteen, ook tijdens het spelen. Vibrato en galm gelden overal in de app (nieuwe noten).</small>';
  if (typeof Samples !== 'undefined' && Samples.variant) $('ptVib').value = Samples.variant('strijker') || 'normaal';
  $('ptViool').value = ptViool();
  ptShowUI();
}
function ptGalmMigrate(){   // vroeger één schuif (Engine 'noot-galm' 0–1) → nu per viool; de algemene stand gaat naar beide schuiven
  try {
    if (localStorage.getItem('noot-galm-migr')) return;
    localStorage.setItem('noot-galm-migr', '1');
    const old = localStorage.getItem('noot-galm');
    if (old != null && Engine.noteReverb && typeof Samples !== 'undefined' && Samples.reverb){
      const pct = Math.round(Engine.noteReverb() * 100);
      Samples.reverb('viooliowa', pct); Samples.reverb('strijker', pct); Engine.noteReverb(.45);
    }
  } catch(e){}
}
function ptGalmRow(inst, label, tip){
  const v = typeof Samples !== 'undefined' && Samples.reverb ? Math.round(Samples.reverb(inst)) : 45;
  return `<div class="ptrow ptmixgalm" title="${tip}"><span>${label}</span><span class="ptrange2"><input type="range" class="ptmixg ptgalm" data-g="${inst}" min="0" max="100" step="5" value="${v}"><output>${v}%</output></span></div>`;
}
function ptShowUI(){   // 🕹️ → Weergave: welke partij(en) als bladmuziek
  const sel = $('ptShow'); if (!sel || !ptCur || !ptCur.s) return;
  const cur = ptCur.s.show != null ? String(ptCur.s.show) : 'alle';
  sel.innerHTML = '<option value="alle">alle partijen</option>' + ptParts.map((p, i) => `<option value="${i}">alleen ${ptEsc(p.name)}</option>`).join('');
  sel.value = ptParts[cur] || cur === 'alle' ? cur : 'alle';
  $('ptShowRow').hidden = ptParts.length < 2;
}
function ptMixInit(){
  const box = $('ptMix'); if (!box) return;
  const upd = (e, done) => {
    if (e.target.id === 'ptVib'){ if (done && typeof Samples !== 'undefined'){ Samples.variant('strijker', e.target.value); ptKlankPreload(); } return; }
    if (e.target.id === 'ptViool'){ if (done){ ptG.viool = e.target.value; ptSaveG(); ptKlankPreload(); ptMixUI(); } return; }
    if (e.target.classList.contains('ptgalm')){ Samples.reverb(e.target.dataset.g, +e.target.value); e.target.nextElementSibling.textContent = e.target.value + '%'; return; }
    const r = e.target.closest('.ptmixrow'); if (!r || !ptCur) return;
    if (r.dataset.b){   // balans per klank (alle stukken)
      if (!e.target.classList.contains('ptmixv')) return;
      ptG.bal = Object.assign({}, ptG.bal || {}, { [r.dataset.b]:+e.target.value });
      r.querySelector('output').textContent = e.target.value + '%';
      if (done) ptSaveG();
      return;
    }
    const s = ptCur.s, p = r.dataset.p, m = Object.assign({}, (s.mix || {})[p] || {});
    if (e.target.classList.contains('ptmixv')){ m.v = +e.target.value; r.querySelector('output').textContent = m.v + '%'; }
    else if (e.target.classList.contains('ptmixon')) m.m = !e.target.checked;
    else if (e.target.classList.contains('ptmixk')){ m.k = e.target.value; }
    else return;
    s.mix = Object.assign({}, s.mix || {}, { [p]:m });
    if (done){ ptSaveCur(); if (e.target.classList.contains('ptmixk')){ ptKlankPreload(); ptMixUI(); } }
  };
  box.addEventListener('input', e => upd(e, false));
  box.addEventListener('change', e => upd(e, true));
}
function ptKlankPreload(){   // opnames van de klanken die dit stuk gebruikt alvast laden (anders klinken de eerste noten nagebouwd)
  if (typeof Samples === 'undefined' || !ptCur) return;
  const set = new Set(); for (let st = 0; st < Math.max(1, ptStaves, ptStaffNames.length); st++) set.add(Engine.instId(ptKlank(st)));
  set.forEach(i => Samples.load(i));
}
function ptBuild(){
  const sheet = ptOsmd.Sheet; let it = null;
  try { it = sheet.MusicPartManager.getIterator(); } catch(e){}
  if (!it){ ptOsmd.cursor.reset(); it = ptOsmd.cursor.iterator.clone ? ptOsmd.cursor.iterator.clone() : ptOsmd.cursor.iterator; }
  const steps = []; let guard = 0;
  while (it && !it.EndReached && guard++ < 100000){
    const ves = it.CurrentVoiceEntries || [], notes = [], an = [];
    let minLen = Infinity;
    for (const ve of ves){
      if (ve.IsGrace || ve.isGrace) continue;
      for (const n of (ve.Notes || [])){
        const len = ptReal(n.Length);
        if (len > 0) minLen = Math.min(minLen, len);
        const rest = ptIsRest(n);
        an.push({ n, l:len, r:rest });
        if (rest) continue;
        const tie = n.NoteTie;
        if (tie && tie.StartNote && tie.StartNote !== n) continue;     // vervolg van een overgebonden noot: niet opnieuw aanslaan
        let d = len;
        if (tie && tie.Notes && tie.Notes.length > 1){ try { d = tie.Notes.reduce((a, x) => a + ptReal(x.Length), 0) || len; } catch(e){} }
        const m = ptMidi(n);
        if (m != null && m > 0 && m < 128) notes.push({ n, m, d, st:ptStaff(n) });
      }
    }
    const mi = it.CurrentMeasureIndex;
    steps.push({ ts:ptTs(it), mi, mn:ptMeasures[mi] != null ? ptMeasures[mi] : mi + 1, notes, an, els:[], minLen:isFinite(minLen) ? minLen : .25 });
    it.moveToNext();
  }
  let w = 0;
  steps.forEach((s, i) => {
    const nx = steps[i + 1];
    let dt = nx && Number.isFinite(nx.ts) && Number.isFinite(s.ts) ? nx.ts - s.ts : NaN;
    if (!(dt > 1e-9) || dt > s.minLen + 1e-9) dt = s.minLen;
    s.w = w; s.dt = dt; s.i = i; w += dt;
  });
  ptSteps = steps;
  ptMakeMStarts();
  ptTempo = null; ptTempoSteps();
}
function ptMakeMStarts(){   // maatbegin (voor de metronoom)
  ptMStarts = [];
  ptSteps.forEach((s, i) => { if (i === 0 || s.mi !== ptSteps[i - 1].mi || s.w < ptSteps[i - 1].w) ptMStarts.push({ w:s.w, mi:s.mi, i }); });
}
/* ---------- tempowisselingen (Largo, Moderato, metronoomgetallen, ook midden in een maat) ----------
   ptTempo = [[mi, off, q], …]: vanaf maat-index mi, off hele noten na het maatbegin, q kwartnoten per minuut
   (q = -1: Tempo I, q = -2: a tempo). Altijd uit de MusicXML-tekst (bij .mxl eerst zelf uitpakken):
   <sound tempo> is in MusicXML altijd in kwartnoten, OSMD rekent soms in de eenheid van het metronoomteken (gaf dubbel tempo). */
let ptTempo = null;
// midden van de bereiken die de Slimme metronoom gebruikt (TERMS in metronoom.js): Grave < 40 · Largo 40–60 · Larghetto 60–66 ·
// Adagio 66–76 · Andante 76–108 · Moderato 108–120 · Allegro 120–168 · Presto 168–200 · Prestissimo ≥ 200 (tellen per minuut)
const PT_TWORDS = [['prestissimo',208],['presto',184],['vivacissimo',176],['vivace',168],['allegro assai',160],['allegretto',116],['allegro',144],
  ['moderato',114],['andantino',100],['andante',92],['adagietto',74],['adagio',71],['larghetto',63],['larghissimo',30],['largo',50],['lento',52],['grave',36]];
const PT_TERMS = [[40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [168, 'Allegro'], [200, 'Presto'], [9999, 'Prestissimo']];
const ptTerm = b => PT_TERMS.find(x => b < x[0])[1];
const PT_BSYM = { whole:'𝅝', half:'𝅗𝅥', quarter:'♩', eighth:'♪', '16th':'𝅘𝅥𝅯' };
function ptTempoWord(txt, mi){   // tempowoord → kwartnoten/min (ruwe schatting, tel = maateenheid)
  const t = (txt || '').toLowerCase().trim();
  if (/tempo\s*(i\b|1\b|primo)/.test(t)) return -1;
  if (/^a\s*tempo\b/.test(t)) return -2;
  const w = PT_TWORDS.find(x => t.indexOf(x[0]) >= 0); if (!w) return null;
  const b = ptBeats[mi] || [4, 4];
  return Math.round(w[1] * (b[1] === 2 ? 2 : b[1] === 8 && b[0] % 3 === 0 && b[0] > 3 ? 1.5 : 1));
}
const PT_BUNIT = { whole:4, half:2, quarter:1, eighth:.5, '16th':.25, '32nd':.125 };
const ptIsXml = d => typeof d === 'string' && /^\s*(<\?xml|<!DOCTYPE|<score-)/.test(d);
async function ptXmlText(data){   // MusicXML-tekst; .mxl (zip, als binaire string) zelf uitpakken
  if (ptIsXml(data)) return data;
  if (typeof data !== 'string' || data.slice(0, 2) !== 'PK' || typeof DecompressionStream === 'undefined') return null;
  try {
    const B = new Uint8Array(data.length); for (let i = 0; i < data.length; i++) B[i] = data.charCodeAt(i) & 255;
    const u16 = i => B[i] | B[i + 1] << 8, u32 = i => (B[i] | B[i + 1] << 8 | B[i + 2] << 16 | B[i + 3] << 24) >>> 0;
    let e = B.length - 22; while (e >= 0 && u32(e) !== 0x06054b50) e--;
    if (e < 0) return null;
    const n = u16(e + 10), files = {}; let c = u32(e + 16);
    for (let k = 0; k < n && u32(c) === 0x02014b50; k++){
      const nl = u16(c + 28), name = new TextDecoder().decode(B.subarray(c + 46, c + 46 + nl));
      files[name] = { m:u16(c + 10), cs:u32(c + 20), lo:u32(c + 42) };
      c += 46 + nl + u16(c + 30) + u16(c + 32);
    }
    const get = async name => {
      const f = files[name]; if (!f) return null;
      const st = f.lo + 30 + u16(f.lo + 26) + u16(f.lo + 28), raw = B.subarray(st, st + f.cs);
      if (f.m === 0) return new TextDecoder().decode(raw);
      if (f.m !== 8) return null;
      const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(ds).text();
    };
    let root = null;
    const cont = await get('META-INF/container.xml');
    if (cont){ const m = /full-path\s*=\s*"([^"]+)"/.exec(cont); if (m) root = m[1]; }
    if (!root || !files[root]) root = Object.keys(files).find(k => !/^META-INF\//.test(k) && /\.(xml|musicxml)$/i.test(k));
    return root ? await get(root) : null;
  } catch(e){ console.warn('Repertoire: .mxl uitpakken mislukt', e); return null; }
}
function ptTempoParse(xml){   // [[mi, off, q]] in documentvolgorde; [] = geen tempo's; null = niet te lezen
  if (!xml) return null;
  let doc; try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch(e){ return null; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return null;
  const parts = Array.from(doc.getElementsByTagName('part')); if (!parts.length) return null;
  const found = {};   // 'mi|off' → q (eerste partij die er iets heeft wint)
  const kid = (el, t) => Array.from(el.children).find(x => x.tagName === t);
  parts.forEach((part, pi) => {
    let div = 1;
    Array.from(part.children).filter(m => m.tagName === 'measure').forEach((m, mi) => {
      let pos = 0, last = 0;
      const add = (off, q, lab) => { const k = mi + '|' + (Math.round(off * 1e4) / 1e4); if (!(k in found)) found[k] = { mi, off, q, pi, lab }; else if (found[k].pi === pi && lab && !found[k].lab) found[k].lab = lab; };
      for (const el of Array.from(m.children)){
        const t = el.tagName;
        if (t === 'attributes'){ const d = kid(el, 'divisions'); if (d && +d.textContent > 0) div = +d.textContent; }
        else if (t === 'note'){
          const dur = kid(el, 'duration'), isChord = !!kid(el, 'chord'), isGrace = !!kid(el, 'grace');
          if (isChord){ continue; }
          last = pos; if (!isGrace && dur) pos += +dur.textContent || 0;
        }
        else if (t === 'backup'){ const d = kid(el, 'duration'); if (d) pos -= +d.textContent || 0; }
        else if (t === 'forward'){ const d = kid(el, 'duration'); if (d) pos += +d.textContent || 0; }
        else if (t === 'direction' || t === 'sound'){
          const o = t === 'direction' ? kid(el, 'offset') : null, at = Math.max(0, pos + (o ? +o.textContent || 0 : 0)) / div / 4;
          const snd = t === 'sound' ? el : kid(el, 'sound');
          let q = snd && +snd.getAttribute('tempo') > 0 ? +snd.getAttribute('tempo') : null, lab = '', mlab = '';
          if (t === 'direction'){
            lab = Array.from(el.getElementsByTagName('words')).map(w => w.textContent.trim()).filter(Boolean).join(' ');
            const mt = el.getElementsByTagName('metronome')[0];
            if (mt){
              const u = mt.getElementsByTagName('beat-unit')[0], pm = mt.getElementsByTagName('per-minute')[0], dot = mt.getElementsByTagName('beat-unit-dot').length;
              const un = u ? u.textContent.trim() : '', bu = PT_BUNIT[un], n = pm ? parseFloat(pm.textContent) : NaN;
              if (bu && n > 0){ mlab = (PT_BSYM[un] || '♩') + (dot ? '.' : '') + ' = ' + n; if (q == null) q = n * bu * (dot ? 1.5 : 1); }
            }
            if (q == null && lab){ const x = ptTempoWord(lab, mi); if (x != null) q = x; }
          }
          if (q != null) add(at, q, [lab, mlab].filter(Boolean).join(' ').trim());
        }
      }
    });
  });
  return Object.values(found).filter(x => x.q != null).sort((x, y) => x.mi - y.mi || x.off - y.off).map(x => [x.mi, +x.off.toFixed(4), Math.round(x.q * 100) / 100, x.lab || '']);
}
/* ---------- versieringen: triller (tr), mordent, pralltriller (21-11-2026) ----------
   OSMD geeft alleen de hoofdnoot door, dus we lezen de versieringen zelf uit de MusicXML (zoals de tempo's).
   Hulpnoot = de volgende toon van de toonladder erboven (bij een mordent eronder), met de voortekening, de toevallige
   voortekens eerder in dezelfde maat op dezelfde balk en hoogte, en een voorteken bij het tr-teken (<accidental-mark>)
   gaat daar altijd boven. ptOrn = [[mi, off, balk, midi, soort 'tr'|'mor'|'imor', halve tonen naar de hulpnoot, begin 'u'|'m'|'']] */
let ptOrn = null;
const PT_STEP = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }, PT_LET = 'CDEFGAB';
const PT_AMARK = { sharp:1, natural:0, flat:-1, 'double-sharp':2, 'sharp-sharp':2, 'flat-flat':-2, 'double-flat':-2 };
function ptKeyAlter(fifths, step){   // voortekening: welke letters krijgen ♯ of ♭
  const sh = 'FCGDAEB', fl = 'BEADGCF';
  if (fifths > 0) return sh.indexOf(step) < fifths ? 1 : 0;
  if (fifths < 0) return fl.indexOf(step) < -fifths ? -1 : 0;
  return 0;
}
function ptOrnParse(xml){
  if (!xml) return null;
  let doc; try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch(e){ return null; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return null;
  const out = [], kid = (el, t) => el && Array.from(el.children).find(x => x.tagName === t);
  let staff0 = 0;
  Array.from(doc.getElementsByTagName('part')).forEach(part => {
    let div = 1, fifths = 0, nStaves = 1;
    Array.from(part.children).filter(m => m.tagName === 'measure').forEach((m, mi) => {
      let pos = 0, last = 0;
      const acc = {};   // 'balk|letter|octaaf' → [[pos, alter]] (toevallige voortekens in deze maat)
      for (const el of Array.from(m.children)){
        const t = el.tagName;
        if (t === 'attributes'){
          const d = kid(el, 'divisions'); if (d && +d.textContent > 0) div = +d.textContent;
          const k = kid(el, 'key'), f = k && kid(k, 'fifths'); if (f) fifths = parseInt(f.textContent, 10) || 0;
          const s = kid(el, 'staves'); if (s) nStaves = Math.max(1, parseInt(s.textContent, 10) || 1);
        }
        else if (t === 'backup'){ const d = kid(el, 'duration'); if (d) pos -= +d.textContent || 0; }
        else if (t === 'forward'){ const d = kid(el, 'duration'); if (d) pos += +d.textContent || 0; }
        else if (t === 'note'){
          const dur = kid(el, 'duration'), isChord = !!kid(el, 'chord'), isGrace = !!kid(el, 'grace');
          const at = isChord ? last : pos;
          if (!isChord){ last = pos; if (!isGrace && dur) pos += +dur.textContent || 0; }
          const p = kid(el, 'pitch'); if (!p) continue;
          const step = (kid(p, 'step') || {}).textContent, oct = parseInt((kid(p, 'octave') || {}).textContent, 10), alt = parseFloat((kid(p, 'alter') || {}).textContent) || 0;
          if (!(step in PT_STEP) || !Number.isFinite(oct)) continue;
          const sEl = kid(el, 'staff'), stf = sEl ? Math.max(1, parseInt(sEl.textContent, 10) || 1) : 1;
          const tieStop = Array.from(el.children).some(x => x.tagName === 'tie' && x.getAttribute('type') === 'stop');
          const key = stf + '|' + step + '|' + oct;
          // vóór het vastleggen van deze noot de hulpnoot bepalen (zijn eigen voorteken telt wel mee: dat staat ervoor)
          if (!tieStop || kid(el, 'accidental')) (acc[key] = acc[key] || []).push([at, alt]);
          if (isGrace) continue;
          const notations = kid(el, 'notations'), orn = notations && kid(notations, 'ornaments'); if (!orn) continue;
          const tm = kid(orn, 'trill-mark'), mo = kid(orn, 'mordent'), im = kid(orn, 'inverted-mordent');
          const kind = tm ? 'tr' : im ? 'imor' : mo ? 'mor' : null; if (!kind) continue;
          const up = kind !== 'mor';
          const li = PT_LET.indexOf(step), ni = up ? (li + 1) % 7 : (li + 6) % 7, nOct = oct + (up && li === 6 ? 1 : !up && li === 0 ? -1 : 0), nStep = PT_LET[ni];
          // voorteken bij het teken: boven hoort bij de bovenste hulpnoot, onder bij de onderste
          const marks = Array.from(orn.children).filter(x => x.tagName === 'accidental-mark');
          const mk = marks.find(x => { const pl = x.getAttribute('placement'); return up ? pl !== 'below' : pl !== 'above'; });
          let nAlt;
          if (mk && mk.textContent.trim() in PT_AMARK) nAlt = PT_AMARK[mk.textContent.trim()];
          else {
            const hist = (acc[stf + '|' + nStep + '|' + nOct] || []).filter(x => x[0] <= at + 1e-9);
            nAlt = hist.length ? hist[hist.length - 1][1] : ptKeyAlter(fifths, nStep);
          }
          const main = 12 * (oct + 1) + PT_STEP[step] + alt;
          let delta = 12 * (nOct + 1) + PT_STEP[nStep] + nAlt - main;
          if (tm && !mk && tm.hasAttribute('trill-step')){ const ts = tm.getAttribute('trill-step'); delta = ts === 'half' ? 1 : ts === 'unison' ? 0 : 2; }
          const sn = tm && tm.getAttribute('start-note'), start = sn === 'upper' ? 'u' : sn === 'main' ? 'm' : sn === 'below' ? 'l' : '';
          out.push([mi, +(at / div / 4).toFixed(4), staff0 + stf - 1, Math.round(main), kind, Math.round(delta), start]);
        }
      }
    });
    staff0 += nStaves;
  });
  return out;
}
function ptOrnSteps(){   // versieringen aan de noten van de tijdlijn hangen (x.o)
  ptSteps.forEach(st => st.notes.forEach(x => { delete x.o; }));
  if (!ptOrn || !ptOrn.length) return;
  const byM = {}; ptOrn.forEach(e => { (byM[e[0]] = byM[e[0]] || []).push(e); });
  let prevMi = -1, m0 = 0;
  ptSteps.forEach((st, i) => {
    const prev = ptSteps[i - 1];
    if (i === 0 || st.mi !== prevMi || (prev && st.w < prev.w)){ prevMi = st.mi; m0 = st.w; }
    const ev = byM[st.mi]; if (!ev) return;
    const off = st.w - m0;
    ev.forEach(e => {
      if (Math.abs(e[1] - off) > 1e-3) return;
      // dezelfde toonhoogte (en liefst dezelfde balk); anders de dichtstbijzijnde noot (transponerende partij)
      let best = null, bs = 1e9;
      st.notes.forEach(x => { const s = Math.abs(x.m - e[3]) * 10 + (x.st === e[2] ? 0 : 5); if (s < bs){ bs = s; best = x; } });
      if (best && bs <= 35) best.o = { t:e[4], d:e[5], s:e[6] };
    });
  });
}
/* Beginnen op de bovenste noot of op de hoofdnoot. Barok en klassiek (tot ± 1800): bovenste noot; later: hoofdnoot.
   it.s.tr = 'auto' | 'boven' | 'hoofd'. Automatisch kijkt naar de componist; staat het in de MusicXML (start-note), dan wint dat. */
const PT_OLD = /\b(bach|h(a|ä)ndel|vivaldi|telemann|corelli|scarlatti|tartini|couperin|rameau|purcell|leclair|locatelli|geminiani|pachelbel|biber|buxtehude|albinoni|veracini|pergolesi|quantz|mozart|haydn|boccherini|gluck|clementi|stamitz|viotti|seitz|sammartini|torelli|marcello|zelenka|muffat|lully|frescobaldi)\b/i;
function ptTrUp(){
  const v = ptCur && ptCur.s && ptCur.s.tr || 'auto';
  if (v === 'boven') return true; if (v === 'hoofd') return false;
  return PT_OLD.test((ptCur && ptCur.comp) || '');
}
function ptTrUI(){
  if (!$('ptTr') || !ptCur || !ptCur.s) return;   // nieuw stuk: s bestaat pas aan het eind van ptOpen
  $('ptTr').value = ptCur.s.tr || 'auto';
  const n = { tr:0, mor:0, imor:0 }; (ptOrn || []).forEach(e => { n[e[4]]++; });
  const tot = n.tr + n.mor + n.imor;
  $('ptTrInfo').textContent = !tot ? 'Geen trillers of mordenten in dit stuk gevonden.' :
    [n.tr ? n.tr + ' triller' + (n.tr > 1 ? 's' : '') : '', n.mor + n.imor ? (n.mor + n.imor) + ' mordent' + (n.mor + n.imor > 1 ? 'en' : '') : ''].filter(Boolean).join(' en ') + ' in dit stuk'
    + (n.tr && (ptCur.s.tr || 'auto') === 'auto' ? ' · nu: beginnen op ' + (ptTrUp() ? 'de noot erboven' : 'de geschreven noot') : '') + '.';
}
function ptOrnPlay(t, x, dur, opts){   // de noten van een versiering inplannen; dur = hoe lang de noot klinkt (s)
  const o = x.o, aux = x.m + o.d;
  if (o.d === 0 || aux < 1 || aux > 127){ Engine.note(t, x.m, dur, opts); return; }
  const seq = [];   // [toonhoogte, lengte]
  if (o.t === 'tr'){
    const up = o.s === 'u' || o.s === 'l' ? true : o.s === 'm' ? false : ptTrUp();
    const R = .095;   // ± 10,5 noten per seconde, het tempo van een normale triller
    if (dur < 4 * R){   // korte noot: snel 4 (of 3) noten en de hoofdnoot aanhouden
      const pat = up ? [aux, x.m, aux, x.m] : [x.m, aux, x.m];
      const l = Math.min(.075, dur / (pat.length + 1));
      pat.forEach((m, k) => seq.push([m, k === pat.length - 1 ? dur - l * (pat.length - 1) : l]));
    } else {
      let n = Math.max(4, Math.round(dur / R));
      if (up && n % 2) n++; if (!up && n % 2 === 0) n++;   // altijd eindigen op de hoofdnoot
      const l = dur / n;
      for (let k = 0; k < n; k++) seq.push([(k % 2 === 0) === up ? aux : x.m, l]);
    }
  } else {   // mordent (hoofd-onder-hoofd) en pralltriller / inverted mordent (hoofd-boven-hoofd)
    const l = Math.min(.07, dur / 4);
    seq.push([x.m, l], [aux, l], [x.m, dur - 2 * l]);
  }
  let tt = t;
  seq.forEach(([m, l]) => { Engine.note(tt, m, Math.max(.05, l * 1.02), opts); tt += l; });
}
/* Delen: een tempo-aanduiding met een woord (Largo, Moderato cantabile…) of de eerste is een 'deel' waarvan je het tempo
   zelf kunt bepalen (it.s.tempi[key] = kwartnoten/min). Kale getallen vlak na een ander tempo (zoals een riten. in stapjes
   144 → 80) horen bij het deel ervoor en gaan in verhouding mee. a tempo / Tempo I gaan terug naar dat deel. */
let ptTSecs = [];
function ptTempoSecs(){
  const T = ptTempo || []; ptTSecs = []; let prevMi = -99;
  T.forEach((e, k) => {
    const lab = (e[3] || '').toLowerCase();
    e.ret = e[2] === -2 || /^a\s*tempo\b/.test(lab) ? 'a' : e[2] === -1 || /tempo\s*(i\b|1\b|primo)/.test(lab) ? '1' : null;
    if (e.ret || !(e[2] > 0)){ e.sec = null; prevMi = e[0]; return; }
    const word = PT_TWORDS.some(x => lab.indexOf(x[0]) >= 0) || /tempo\s*(i\b|1\b|primo)/.test(lab);
    if (!ptTSecs.length || word || e[0] - prevMi >= 2){
      ptTSecs.push({ key:e[0] + '|' + e[1] + '|' + (e[3] || ''), mi:e[0], q:e[2], lab:e[3] || '' });
    }
    e.sec = ptTSecs.length - 1; prevMi = e[0];
  });
}
function ptTempoSteps(){   // per stap: tq = voorgeschreven tempo (kwart/min), sec = deel, sq = tempo van dat deel; null als het stuk geen tempo's heeft
  ptTempoSecs();
  const T = ptTempo || [], byM = {};
  T.forEach(e => { (byM[e[0]] = byM[e[0]] || []).push(e); });
  const S = ptTSecs, first = S.length ? S[0].q : null;
  let cur = first, sec = S.length ? 0 : null, base = first, baseSec = sec, prevMi = -1, m0 = 0, ev = [], k = 0, run = 0, runQ = null;
  ptSteps.forEach((st, i) => {
    const prev = ptSteps[i - 1];
    if (i === 0 || st.mi !== prevMi || (prev && st.w < prev.w)){   // nieuw maatbegin (ook na een herhaling)
      if (cur === runQ) run++; else { runQ = cur; run = 1; }
      if (run >= 2 && cur > 0){ base = cur; baseSec = sec; }      // tempo dat al twee maten geldt = het 'gewone' tempo (voor a tempo)
      prevMi = st.mi; m0 = st.w; ev = byM[st.mi] || []; k = 0;
    }
    const off = st.w - m0;
    while (k < ev.length && ev[k][1] <= off + 1e-6){
      const e = ev[k], q = e[2];
      if (e.ret === '1'){ cur = q > 0 ? q : (first || cur); sec = S.length ? 0 : sec; }
      else if (e.ret === 'a'){ cur = q > 0 ? q : (base || cur); sec = baseSec; }
      else if (q > 0){ cur = q; sec = e.sec; }
      k++;
    }
    st.tq = cur; st.sec = sec; st.sq = sec != null && S[sec] ? S[sec].q : cur;
  });
}
function ptReadMeta(it){   // maten, balken, maatsoorten, titel uit OSMD
  const sh = ptOsmd.Sheet;
  ptMeasures = (sh.SourceMeasures || []).map((m, i) => (typeof m.MeasureNumber === 'number' ? m.MeasureNumber : i + 1));
  ptBeats = (sh.SourceMeasures || []).map(m => { let num = 4, den = 4; try { const ts = m.ActiveTimeSignature; if (ts){ num = ts.Numerator || num; den = ts.Denominator || den; } } catch(e){} return [num, den]; });
  try { ptStaves = sh.Staves ? sh.Staves.length : 1; } catch(e){ ptStaves = 1; }
  try { if (!it.titel && sh.TitleString) it.titel = sh.TitleString; if (!it.comp && sh.ComposerString) it.comp = sh.ComposerString; } catch(e){}
}
const ptTlPack = () => ({ steps:ptSteps.map(s => ({ w:s.w, dt:s.dt, mi:s.mi, mn:s.mn, notes:s.notes.map(x => ({ m:x.m, d:x.d, st:x.st })) })), measures:ptMeasures, beats:ptBeats, staves:ptStaves, tempo3:ptTempo || [], orn:ptOrn || [] });
function ptTlApply(tl){
  ptSteps = tl.steps.map((s, i) => Object.assign({ i, els:[], an:null }, s));
  ptMeasures = tl.measures || []; ptBeats = tl.beats || []; ptStaves = tl.staves || 1;
  ptMakeMStarts();
  ptTempo = Array.isArray(tl.tempo3) ? tl.tempo3 : null;
  ptTempoSteps();
  ptOrn = Array.isArray(tl.orn) ? tl.orn : null; ptOrnSteps();
}
function ptBeatInfo(mi){
  const b = ptBeats[mi] || [4, 4], num = b[0], den = b[1];
  if (den === 8 && num % 3 === 0 && num > 3) return { len:3 / 8, n:num / 3, nominal:num / den };
  return { len:1 / den, n:num, nominal:num / den };
}

/* ---------- blok ---------- */
function ptMaxM(){ return ptMeasures.length ? ptMeasures[ptMeasures.length - 1] : 1; }
function ptMinM(){ return ptMeasures.length ? ptMeasures[0] : 1; }
function ptBlock(){   // aaneengesloten stuk met maten from..to. Herhalingen worden gevolgd als het blok verder loopt dan de
  // maat met het herhaalteken (bv. Hele stuk); eindigt het blok bij die maat of springt de herhaling vóór het blok, dan stopt het daar.
  const s = ptCur.s, a = s.from, b = s.to;
  let i0 = ptSteps.findIndex(x => x.mn >= a && x.mn <= b);
  if (i0 < 0) return null;
  let i1 = i0;
  while (i1 + 1 < ptSteps.length){
    const nx = ptSteps[i1 + 1], cur = ptSteps[i1];
    if (nx.mn < a || nx.mn > b || nx.w < cur.w) break;
    if (nx.mn < cur.mn && !(cur.mn < b)) break;   // sprong terug aan het eind van het blok: één keer spelen
    i1++;
  }
  const w0 = ptSteps[i0].w, w1 = ptSteps[i1].w + ptSteps[i1].dt;
  const ev = [];
  for (let i = i0; i <= i1; i++) ev.push({ w:ptSteps[i].w - w0, k:'n', st:ptSteps[i] });
  // tellen
  ptMStarts.forEach((m, j) => {
    if (m.i < i0 || m.i > i1) return;
    const nx = ptMStarts[j + 1], end = nx ? nx.w : (ptSteps[ptSteps.length - 1].w + ptSteps[ptSteps.length - 1].dt);
    const L = Math.min(end, w1) - m.w, bi = ptBeatInfo(m.mi);
    if (L >= bi.nominal - 1e-6 || m.mi !== 0){ for (let k = 0; k < bi.n && m.w + k * bi.len < Math.min(end, w1) - 1e-9; k++) ev.push({ w:m.w + k * bi.len - w0, k:'c', acc:k === 0 }); }
    else { for (let x = end - bi.len; x >= m.w - 1e-9; x -= bi.len) if (x < w1 - 1e-9) ev.push({ w:x - w0, k:'c', acc:false }); }   // opmaat: tellen vanaf het eind
  });
  ev.sort((x, y) => x.w - y.w || (x.k === 'c' ? -1 : 1));
  const first = ptSteps[i0], bi = ptBeatInfo(first.mi);
  const fm = ptMStarts.find(m => m.i === i0), nx = fm ? ptMStarts[ptMStarts.indexOf(fm) + 1] : null;
  const firstLen = fm && nx ? nx.w - fm.w : bi.nominal;
  const nst = []; for (let i = i0; i <= i1; i++) nst.push({ w:ptSteps[i].w - w0, i, u:0, f:1 });
  const B = { i0, i1, w0, nst, L:w1 - w0, ev, bi, pickup:fm && first.mi === 0 && firstLen < bi.nominal - 1e-6 ? firstLen : 0 };
  ptWarp(B, ptCur.s.bpm);
  return B;
}
/* Tempowisselingen in het blok: f = tempo van die stap / tempo van de knop; u = 'tijd' in hele noten op het knoptempo.
   Het deel waarin het blok begint volgt de tempoknop; latere delen in verhouding, tenzij je hun tempo zelf hebt bepaald. */
function ptWarp(B, bpm){
  const s0 = ptSteps[B.i0], q0 = s0.tq, warp = ptG.tempi !== false && q0 > 0;
  const over = (ptCur.s.tempi) || {}, kq = bpm * 4 / PT_UNITS[ptCur.s.unit].w, sec0 = s0.sec;
  let u = 0;
  B.nst.forEach(n => {
    const st = ptSteps[n.i];
    let f = 1;
    if (warp && st.tq > 0){
      const S = st.sec != null ? ptTSecs[st.sec] : null, o = S ? +over[S.key] : 0;
      f = o > 0 && st.sec !== sec0 ? o * (st.tq / (st.sq || st.tq)) / kq : st.tq / q0;
    }
    n.u = u; n.f = f; u += st.dt / f;
  });
  B.warp = warp; B.U = ptU(B, B.L);
  B.ev.forEach(e => { e.u = ptU(B, e.w); });
}
function ptNstAt(B, w){ const a = B.nst; let lo = 0, hi = a.length - 1; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (a[m].w <= w + 1e-9) lo = m; else hi = m - 1; } return a[lo]; }
function ptU(B, w){   // positie in het blok (hele noten) → tijd-eenheden (hele noten op het begintempo)
  if (!B.nst || !B.nst.length) return w;
  if (w <= 0) return w / B.nst[0].f;
  const n = ptNstAt(B, w); return n.u + (w - n.w) / n.f;
}
function ptWofU(B, u){   // omgekeerd
  const a = B.nst; if (!a || !a.length) return u;
  if (u <= 0) return u * a[0].f;
  let lo = 0, hi = a.length - 1; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (a[m].u <= u + 1e-9) lo = m; else hi = m - 1; }
  return a[lo].w + (u - a[lo].u) * a[lo].f;
}
function ptDim(a, b){
  if (a == null){ a = ptCur.s.from; b = ptCur.s.to; }
  ptEls.forEach(g => g && g.classList.toggle('ptout', +g.dataset.mn < a || +g.dataset.mn > b));
}
/* ⬚ Selecteer passage: klik op de eerste en daarna op de laatste maat (meebewegen laat zien wat erbij hoort) */
function ptSelUI(){
  const on = !!ptSel, h = $('ptSelHint');
  $('ptSelBtn').classList.toggle('on', on);
  $('ptSelBtn').textContent = on ? '✕' : '⬚'; $('ptSelBtn').title = on ? 'Stop met selecteren' : 'Selecteer passage: klik daarna op de eerste en de laatste maat';
  h.hidden = !on; h.textContent = !on ? '' : ptSel.phase === 'start' ? 'Klik op de eerste maat…' : 'Klik op de laatste maat… (nu vanaf maat ' + ptSel.a + ')';
  $('ptSheet').classList.toggle('ptselecting', on);
}
function ptSelCancel(){ ptSel = null; ptDim(); ptSelUI(); }
function ptSelClick(i){
  const mn = ptSteps[i].mn;
  if (ptSel.phase === 'start'){ ptSel = { phase:'end', a:mn }; ptDim(mn, mn); ptSelUI(); return; }
  const a = Math.min(ptSel.a, mn), b = Math.max(ptSel.a, mn);
  ptSel = null; ptSelUI();
  ptStop(); ptPausedAt = null;
  ptSetBlock(a, b).then(() => { ptDim(); $('ptPasNew').click(); $('ptPasNameIn').placeholder = 'Naam, bv. Maat ' + a + '–' + b; });
}

/* ---------- tekenen, met cache ----------
   Twee lagen in #ptSheet: #ptOsmdHost (waar OSMD tekent) en #ptCacheView (een eerder getekende versie uit de cache).
   Elke noot/rust krijgt data-e (nummer), data-mn (maat), data-l (lengte), data-r (rust); st.els = nummers per stap.
   Cache (IndexedDB 'cache'): '<id>|<PT_CV>|tl' = tijdlijn, '<id>|<PT_CV>|svg|<sleutel>' = {html, els} per opmaak
   (sleutel = modus|breedte (per 40 px)|zoom|maten). Max 6 opmakken per stuk (it.ck, oudste eruit). */
const ptCK = (id, k) => id + '|' + PT_CV + '|' + k;
const ptActive = () => ptSrc === 'cache' ? $('ptCacheView') : $('ptOsmdHost');
const ptPaged = () => ptFsOn && ptG.fsMode !== 'door';   // volledig scherm met bladzijden (anders doorlopend = de gewone tekening)
function ptKey(){
  const s = ptCur.s, range = s.focus ? s.from + '-' + s.to : 'all';
  const t = (ptG.titles ? 't' : 'n') + (s.show != null && s.show !== 'alle' ? 'p' + s.show : '');
  if (ptPaged()){ const d = ptFsDims(); return ['fs2', d.pw, d.ph, t, range].join('|'); }
  return ['e2' + t, Math.round(((ptFsOn ? ptWNorm : $('ptSheet').clientWidth) || 800) / 40) * 40, ptG.zoom, range].join('|');
}
function ptEl(n){
  try { const r = ptOsmd.EngravingRules || ptOsmd.rules; const g = r && r.GNote ? r.GNote(n) : null; return g && g.getSVGGElement ? g.getSVGGElement() : null; }
  catch(e){ return null; }
}
function ptTag(){
  const seen = new Map(); let k = 0;
  for (const st of ptSteps){
    st.els = [];
    for (const a of (st.an || [])){
      const g = ptEl(a.n); if (!g) continue;
      let e = seen.get(g);
      if (e === undefined){
        e = k++; seen.set(g, e);
        g.dataset.e = e; g.dataset.mn = st.mn; g.dataset.l = +(a.l || st.dt).toFixed(5); g.classList.add('ptn');
        if (a.r) g.dataset.r = '1';
      }
      if (!st.els.includes(e)) st.els.push(e);
    }
  }
}
function ptAfterDraw(){
  const cont = ptActive();
  ptEls = []; cont.querySelectorAll('[data-e]').forEach(g => { ptEls[+g.dataset.e] = g; g.classList.remove('pthi'); });
  ptHiOK = ptEls.length > 0;
  ptElStep = []; ptSteps.forEach((st, i) => st.els.forEach(e => { if (ptElStep[e] == null) ptElStep[e] = i; }));
  ptDim(); ptGeo = null; ptLineHide();
  if (ptPausedAt != null && !ptRun) requestAnimationFrame(() => requestAnimationFrame(() => { if (ptPausedAt != null && !ptRun) ptMarkAt(ptPausedAt); }));
  if (ptFsOn){ ptFsPagesFind(); ptFsLayout(); }
  ptW = $('ptSheet').clientWidth;
}
async function ptEnsureOsmd(){   // OSMD laden en dit stuk erin inlezen (alleen nodig om opnieuw te tekenen)
  if (ptOsmd && ptOsmdFor === ptCur.id && ptSteps.length && ptSteps[0].an) return true;
  const it = ptCur;
  ptMsg('Notenbibliotheek laden…', 'busy');
  try { await ptLoadLib(); } catch(e){ ptMsg('✗ ' + ptEsc(e.message) + ' Controleer je internet en open het stuk opnieuw.', 'bad'); return false; }
  await ptCalibrate();
  if (!ptOsmd) ptNewOsmd();
  const zip = typeof it.data === 'string' && it.data.slice(0, 2) === 'PK';
  // .mxl zelf uitpakken (DecompressionStream) en OSMD de kale MusicXML geven: zo wordt de zip-code van OSMD overgeslagen
  let src = it.data, why = '';
  if (zip){
    ptMsg('Uitpakken… (stap 1 van 2)', 'busy'); await ptFrame();
    try { const x = await ptWithin(ptXmlText(it.data), 15000, 'uitpakken'); if (x) src = x; else why = 'zelf uitpakken gaf niets'; }
    catch(e){ why = e.message || String(e); console.warn('Repertoire: zelf uitpakken mislukt, OSMD probeert het', e); }
    if (ptCur !== it) return false;
  }
  ptMsg('Partituur inlezen… (stap ' + (zip ? '2 van 2' : '1 van 1') + (src === it.data && zip ? ', via OSMD' : '') + ')', 'busy'); await ptFrame();
  try { await ptWithin(Promise.resolve().then(() => ptOsmd.load(src)), 60000, 'het inlezen' + (src === it.data && zip ? ' (zip via OSMD)' : '')); }
  catch(e){ ptOsmdFor = null; ptOsmd = null; console.error('Repertoire: inlezen mislukt', e); ptMsg('✗ Dit bestand kon niet gelezen worden: ' + ptEsc(e.message || e) + (why ? ' [uitpakken: ' + ptEsc(why) + ']' : '') + '. Open het stuk opnieuw om het nog eens te proberen.', 'bad'); return false; }
  if (ptCur !== it) return false;
  ptOsmdFor = it.id; ptVisFor = null;
  ptReadMeta(it); ptBuild();
  await ptTempoLoad(it);
  return true;
}
async function ptTempoLoad(it){   // tempo-aanduidingen uit de MusicXML (ook .mxl) en per stap invullen
  let T = null, O = null, xml = null;
  try { xml = await ptWithin(ptXmlText(it.data), 15000, 'tempo lezen'); T = ptTempoParse(xml); } catch(e){ console.warn('Repertoire: tempo lezen mislukt', e); }
  try { O = ptOrnParse(xml); } catch(e){ console.warn('Repertoire: versieringen lezen mislukt', e); }
  if (ptCur !== it) return;
  ptTempo = T || []; ptTempoSteps(); ptTempiList();
  ptOrn = O || []; ptOrnSteps(); ptTrUI();
}
async function ptShowSheet(){
  if (!ptCur) return;
  const it = ptCur, key = ptKey();
  ptKeyNow = key;
  const c = await PtDB.cget(ptCK(it.id, 'svg|' + key));
  if (ptCur !== it || ptKeyNow !== key) return;
  if (c && c.html && Array.isArray(c.els) && c.els.length === ptSteps.length){   // uit de cache: meteen klaar
    const cv = $('ptCacheView');
    cv.innerHTML = c.html; cv.hidden = false; $('ptOsmdHost').hidden = true;
    ptSteps.forEach((st, i) => { st.els = c.els[i] || []; });
    ptSrc = 'cache'; ptAfterDraw(); ptMsg('', '');
    it.ck = (it.ck || []).filter(x => x !== key).concat(key);
    return;
  }
  if (!(await ptEnsureOsmd()) || ptCur !== it) return;
  const s = it.s;
  ptMsg('Tekenen…', 'busy'); await ptFrame();
  if (ptCur !== it || ptKeyNow !== key) return;
  const t0 = performance.now(), host = $('ptOsmdHost'), cv = $('ptCacheView');
  cv.hidden = true; cv.innerHTML = ''; host.hidden = false; ptSrc = 'osmd';
  try {
    const o = s.focus ? { drawFromMeasureNumber:s.from, drawUpToMeasureNumber:s.to } : { drawFromMeasureNumber:ptMinM(), drawUpToMeasureNumber:Number.MAX_SAFE_INTEGER };
    const paged = ptPaged();
    o.pageFormat = paged ? 'A4_P' : 'Endless';
    // titel/componist/instrumentnaam alleen als de gebruiker dat wil (🕹️ → Weergave); smallere marges = meer noten in beeld
    const T = !!ptG.titles, d = paged ? ptFsDims() : null;
    Object.assign(o, { drawTitle:T, drawSubtitle:T, drawComposer:T, drawLyricist:T, drawPartNames:T, drawPartAbbreviations:T });
    ptOsmd.setOptions(o);
    // volledig scherm: bladzijden met precies de verhouding van het vak op het scherm (geen A4 met lege randen)
    if (paged && ptOsmd.setCustomPageFormat) ptOsmd.setCustomPageFormat(100, Math.round(100 * d.ph / d.pw));
    ptCompactRules(true, paged);
    ptApplyShow();
    const sh = $('ptSheet');
    sh.style.transform = ''; sh.style.width = paged ? d.pw + 'px' : ptFsOn ? (ptWNorm || 1000) + 'px' : '';
    ptOsmd.zoom = paged ? 1 : ptG.zoom / 100;
    ptOsmd.render();
    if (paged) ptJustify();
  } catch(e){ ptMsg('✗ Tekenen mislukt: ' + ptEsc(e.message || e), 'bad'); return; }
  ptTag(); ptAfterDraw();
  const secs = (performance.now() - t0) / 1000;
  if (ptFsOn) ptFsLayout();
  ptMsg(!ptHiOK && ptSteps.length ? 'Meelezen lukt niet bij dit stuk.' : secs > 2.5 && !s.focus && !ptFsOn ? 'Groot stuk: tekenen duurde ' + secs.toFixed(1) + ' s. De volgende keer staat het er meteen (de app onthoudt het).' : '', 'muted');
  // in de cache zetten (na het taggen, zodat de data-attributen meekomen)
  const html = host.innerHTML, els = ptSteps.map(st => st.els.slice());
  PtDB.cput(ptCK(it.id, 'svg|' + key), { html, els });
  it.ck = (it.ck || []).filter(x => x !== key).concat(key);
  while (it.ck.length > 6){ const old = it.ck.shift(); PtDB.cdel(ptCK(it.id, 'svg|' + old)); }
  PtDB.put(it);
}
/* Alleen één partij als bladmuziek (🕹️ → Weergave → Bladmuziek: it.s.show = 'alle' | partij-index). Afspelen blijft alle partijen
   (volume per partij via de mixer). OSMD: Instrument.Visible, daarna de grafische opbouw vernieuwen. */
let ptVisFor = null;
function ptApplyShow(){
  const sh = ptCur.s.show != null ? String(ptCur.s.show) : 'alle', key = ptOsmdFor + '|' + sh;
  if (ptVisFor === key) return;
  try {
    const ins = ptOsmd.Sheet.Instruments || [];
    const one = sh !== 'alle' && ins[+sh] ? +sh : -1;
    ins.forEach((x, i) => { x.Visible = one < 0 || i === one; });
    if (ptOsmd.updateGraphic) ptOsmd.updateGraphic();
  } catch(e){ console.warn('Repertoire: partij verbergen mislukt', e); }
  ptVisFor = key;
}
function ptVisStaves(){   // aantal balken per regel zoals getekend
  const sh = ptCur && ptCur.s.show;
  if (sh != null && sh !== 'alle' && ptParts[sh]) return ptParts[sh].staves.length;
  return Math.max(1, ptStaves);
}
function ptCacheDrop(it){ (it.ck || []).forEach(k => PtDB.cdel(ptCK(it.id, 'svg|' + k))); PtDB.cdel(ptCK(it.id, 'tl')); }

/* ---------- glijdende cursor ----------
   Een lijn over het hele systeem (beide balken bij piano) die op de audioklok vloeiend van noot naar noot schuift
   en aan het eind van een regel naar de rechterkant glijdt. Posities komen uit de getekende noten (ptGeoBuild):
   regels = reeksen noten waarvan x oploopt (in de volgorde van de muziek, herhalingen hergebruiken dezelfde noten). */
function ptGeoBuild(){
  const sh = $('ptSheet'), sr = sh.getBoundingClientRect(), sc = sh.offsetWidth ? sr.width / sh.offsetWidth : 1;
  const E = ptEls.map(g => {
    if (!g || !g.isConnected) return null;
    const r = g.getBoundingClientRect(); if (!r.width && !r.height) return null;
    const pg = ptFsOn && ptPages.length > 1 ? ptPages.findIndex(p => p.contains(g)) : 0;
    // ankerpunt = midden van het (meest linkse) nootbolletje, niet de linkerrand (die ligt bij een voorteken te ver naar links)
    let ax = null;
    const heads = g.querySelectorAll('.vf-notehead');
    if (heads.length){ let best = null; heads.forEach(hd => { const q = hd.getBoundingClientRect(); if ((q.width || q.height) && (!best || q.left < best.left)) best = q; }); if (best) ax = (best.left + best.right) / 2; }
    if (ax == null) ax = r.left + Math.min(r.width, 12) / 2;
    return { x:(ax - sr.left) / sc, rt:(r.right - sr.left) / sc, t:(r.top - sr.top) / sc, b:(r.bottom - sr.top) / sc, pg };
  });
  const lineOf = new Array(E.length).fill(-1), lines = [];
  let cur = -1, lastX = -1e9, lastPg = -1;
  for (const st of ptSteps){
    const fresh = st.els.filter(e => E[e] && lineOf[e] === -1);
    if (!fresh.length) continue;
    const x = Math.min(...fresh.map(e => E[e].x)), pg = E[fresh[0]].pg;
    if (cur < 0 || x < lastX - 24 || pg !== lastPg){ lines.push({ t:1e9, b:-1e9, r:-1e9, pg }); cur = lines.length - 1; lastX = x; lastPg = pg; }   // nieuwe regel: x springt terug of nieuwe bladzijde
    else lastX = Math.max(lastX, x);
    const L = lines[cur];
    fresh.forEach(e => { lineOf[e] = cur; L.t = Math.min(L.t, E[e].t); L.b = Math.max(L.b, E[e].b); L.r = Math.max(L.r, E[e].rt); });
  }
  const step = ptSteps.map(st => {
    const vis = st.els.filter(e => E[e] && lineOf[e] >= 0);
    if (!vis.length) return null;
    return { x:Math.min(...vis.map(e => E[e].x)), line:lineOf[vis[0]] };
  });
  return { step, lines };
}
const ptLat = () => { let l = 0; try { l = Math.min(.3, Math.max(0, actx.outputLatency || actx.baseLatency || 0)); } catch(e){} return l - (+ptG.lineOfs || 0) / 1000; };   // tijd tot je de toon echt hoort, min je eigen correctie (Cursor eerder/later)
function ptRunPos(r){   // positie (hele noten vanaf het begin van het blok) die je NU hoort
  const now = actx.currentTime - ptLat();
  let h = r.hist[0]; for (const x of r.hist) if (x.t0 <= now) h = x;
  return Math.max(r.startW || 0, ptWofU(r.B, (now - h.t0) / ptSpw(h.bpm)));
}
function ptLineSet(line, x, L){   // via transform (GPU): de partituur hoeft niet elk beeldje opnieuw getekend te worden
  const top = L.t - 12, h = L.b - L.t + 24;
  line.style.transform = 'translate3d(' + (x - 1).toFixed(1) + 'px,' + top.toFixed(1) + 'px,0)';
  if (line._h !== h){ line.style.height = h + 'px'; line._h = h; }
  line.dataset.x = x.toFixed(1);
}
function ptStepIdx(W){ let lo = 0, hi = ptSteps.length - 1; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (ptSteps[m].w <= W + 1e-9) lo = m; else hi = m - 1; } return lo; }
function ptLineCalc(W, endW){   // waar hoort de lijn op tijdpositie W? → {i, x, L, li}
  if (!ptGeo) ptGeo = ptGeoBuild();
  const i = ptStepIdx(W), a = ptSteps[i], ga = ptGeo.step[i];
  if (!ga) return null;
  const L = ptGeo.lines[ga.line], nb = ptSteps[i + 1];
  const b = nb && (endW == null || nb.w < endW - 1e-9) ? nb : null;
  const end = b ? b.w : (endW != null ? Math.min(endW, a.w + a.dt) : a.w + a.dt);
  const f = Math.min(1, Math.max(0, (W - a.w) / Math.max(1e-6, end - a.w)));
  const gb = b ? ptGeo.step[i + 1] : null;
  const x = gb && gb.line === ga.line && gb.x >= ga.x ? ga.x + (gb.x - ga.x) * f : ga.x + (L.r + 8 - ga.x) * f;
  return { i, x, L, li:ga.line };
}
function ptLinePlace(W, endW){   // de lijn precies op tijdpositie W (hele noten, vanaf het begin van het stuk)
  if (!ptGeo) ptGeo = ptGeoBuild();
  const line = $('ptLine'), i = ptStepIdx(W), a = ptSteps[i], ga = ptGeo.step[i];
  if (!ga){ line.hidden = true; return null; }
  const L = ptGeo.lines[ga.line], nb = ptSteps[i + 1];
  const b = nb && (endW == null || nb.w < endW - 1e-9) ? nb : null;
  const end = b ? b.w : (endW != null ? Math.min(endW, a.w + a.dt) : a.w + a.dt);
  const f = Math.min(1, Math.max(0, (W - a.w) / Math.max(1e-6, end - a.w)));
  const gb = b ? ptGeo.step[i + 1] : null;
  const x = gb && gb.line === ga.line && gb.x >= ga.x ? ga.x + (gb.x - ga.x) * f : ga.x + (L.r + 8 - ga.x) * f;
  ptLineSet(line, x, L);
  line.hidden = false;
  return i;
}
function ptPosAt(cx, cy, target){   // klik/sleep-punt → {i, W}: op een noot precies het begin, op de balk tussen de noten in
  const g = target && target.closest && target.closest('[data-e]');
  if (g && ptElStep[+g.dataset.e] != null){ const i = ptElStep[+g.dataset.e]; return { i, W:ptSteps[i].w }; }
  const i = ptStepAt(cx, cy, null); if (i == null) return null;
  const ga = ptGeo.step[i], L = ptGeo.lines[ga.line], p = ptToSheet(cx, cy), a = ptSteps[i];
  const gb = ptGeo.step[i + 1], b = ptSteps[i + 1];
  let f, span;
  if (gb && b && gb.line === ga.line && gb.x > ga.x){ f = (p.x - ga.x) / (gb.x - ga.x); span = b.w - a.w; }
  else { f = (p.x - ga.x) / Math.max(1, L.r + 8 - ga.x); span = a.dt; }
  return { i, W:a.w + Math.min(.999, Math.max(0, f)) * span };
}
function ptSetPause(i, W, by){ ptPausedAt = i; ptPausedW = W == null ? ptSteps[i].w : W; ptPausedBy = by; }
function ptLineHide(){ const l = $('ptLine'); if (l){ l.hidden = true; l.classList.remove('paused'); } }
function ptToSheet(cx, cy){   // schermcoördinaten → coördinaten binnen #ptSheet (rekening houdend met de schaal)
  const sh = $('ptSheet'), sr = sh.getBoundingClientRect(), sc = sh.offsetWidth ? sr.width / sh.offsetWidth : 1;
  return { x:(cx - sr.left) / sc, y:(cy - sr.top) / sc };
}
function ptStepAt(cx, cy, target){   // stap onder een punt: een noot (data-e) of de plek op de balk
  const g = target && target.closest && target.closest('[data-e]');
  if (g && ptElStep[+g.dataset.e] != null) return ptElStep[+g.dataset.e];
  if (!ptGeo) ptGeo = ptGeoBuild();
  const { x, y } = ptToSheet(cx, cy);
  // twee bladzijden naast elkaar: de regels links en rechts staan op dezelfde hoogte → eerst kijken op welke bladzijde je klikt
  let pg = null;
  if (ptFsOn && ptPages.length > 1){
    const vis = ptPages.map((p, k) => ({ k, r:p.getBoundingClientRect() })).filter(o => o.r.width || o.r.height);
    const hit = vis.find(o => cx >= o.r.left && cx <= o.r.right && cy >= o.r.top && cy <= o.r.bottom)
      || vis.sort((a, b) => Math.hypot(cx - (a.r.left + a.r.right) / 2, cy - (a.r.top + a.r.bottom) / 2) - Math.hypot(cx - (b.r.left + b.r.right) / 2, cy - (b.r.top + b.r.bottom) / 2))[0];
    if (hit) pg = hit.k;
  }
  const onPg = L => pg == null || L.pg === pg;
  let li = ptGeo.lines.findIndex(L => onPg(L) && y >= L.t - 34 && y <= L.b + 34);
  if (li < 0){   // tussen twee regels: de dichtstbijzijnde
    let d = 1e9; ptGeo.lines.forEach((L, k) => { if (!onPg(L)) return; const dd = Math.min(Math.abs(y - L.t), Math.abs(y - L.b)); if (dd < d){ d = dd; li = k; } });
    if (li < 0 || d > 160) return null;
  }
  let best = null;
  ptGeo.step.forEach((g, i) => { if (g && g.line === li && g.x <= x + 4 && (best == null || g.x > ptGeo.step[best].x)) best = i; });
  if (best == null) ptGeo.step.forEach((g, i) => { if (g && g.line === li && (best == null || g.x < ptGeo.step[best].x)) best = i; });
  return best;
}
function ptMarkAt(i, keepPos){   // vaste cursor (pauze of aangeklikte plek) met een labeltje "maat N"
  const line = $('ptLine'); if (!line || !ptSteps[i]) return;
  if (!keepPos || line.hidden){
    const W = ptPausedAt === i && ptPausedW != null ? ptPausedW : ptSteps[i].w;
    if (ptLinePlace(W, null) == null){ ptLineHide(); return; }
  }
  line.dataset.mn = 'maat ' + ptSteps[i].mn;
  line.classList.add('paused'); line.hidden = false;
}
function ptHlFrame(r, pos){   // oplichten op de geluidsklok: precies de noten die op positie pos klinken
  if (!r.hl){   // eenmalig per blok: intervallen [begin, eind) per noot, gesorteerd op begin
    r.hl = [];
    r.B.nst.forEach(n => ptSteps[n.i].els.forEach(e => { const g = ptEls[e]; if (!g || g.dataset.r) return; const len = +g.dataset.l || ptSteps[n.i].dt; r.hl.push({ s:n.w, e:n.w + len, g }); }));
    r.hl.sort((a, b) => a.s - b.s); r.hlK = 0; r.hlAct = new Set(); r.hlPos = -1;
  }
  if (pos < r.hlPos - 1e-6){ r.hlAct.forEach(it => it.g.classList.remove('pthi')); r.hlAct.clear(); r.hlK = 0; }   // nieuwe ronde
  r.hlPos = pos;
  const iv = r.hl;
  while (r.hlK < iv.length && iv[r.hlK].s <= pos + 1e-6){ const it = iv[r.hlK++]; if (it.e > pos){ it.g.classList.add('pthi'); r.hlAct.add(it); } }
  for (const it of r.hlAct) if (pos >= it.e - Math.min(.03, (it.e - it.s) * .08)){ it.g.classList.remove('pthi'); r.hlAct.delete(it); }
}
function ptHlClear(r){ if (r && r.hlAct){ r.hlAct.forEach(it => it.g.classList.remove('pthi')); r.hlAct.clear(); } }
function ptLineLoop(){   // elk beeldje: lijn en/of oplichtende noten op de geluidsklok
  ptRaf = 0;
  const r = ptRun;
  if (!r){ ptLineHide(); return; }
  if (!ptGeo) ptGeo = ptGeoBuild();
  const now = actx.currentTime - ptLat();
  let h = r.hist[0]; for (const x of r.hist) if (x.t0 <= now) h = x;
  const raw = ptWofU(r.B, (now - h.t0) / ptSpw(h.bpm)), pos = Math.min(Math.max(r.startW || 0, raw), r.B.L - 1e-6);
  if (ptG.cursor !== 'noten'){
    // vloeiend: doel = de plek over TAU s (vooruitkijken), dan exponentieel afvlakken met dezelfde TAU → netto op tijd, zonder schokken
    const line = $('ptLine'), TAU = .06, tf = performance.now();
    const lead = Math.min(r.B.L - 1e-6, ptWofU(r.B, ptU(r.B, pos) + TAU / ptSpw(h.bpm)));
    const c = ptLineCalc(r.B.w0 + lead, r.B.w0 + r.B.L);
    if (!c){ line.hidden = true; }
    else {
      const sm = r.sm, dt = sm ? Math.min(.1, (tf - sm.t) / 1000) : 0;
      let x = c.x;
      if (sm && sm.li === c.li && c.x >= sm.x - 2 && c.x - sm.x < 260) x = sm.x + (c.x - sm.x) * (1 - Math.exp(-dt / TAU));
      r.sm = { x, li:c.li, t:tf };
      line.classList.remove('paused'); ptLineSet(line, x, c.L); line.hidden = false;
    }
  }
  else ptLineHide();
  if (ptG.cursor !== 'lijn' && raw >= -1e-6) ptHlFrame(r, pos); else ptHlClear(r);
  const tNow = performance.now();
  if (ptG.follow !== false && tNow - (r.fT || 0) > 220){ r.fT = tNow; ptFollowStep(ptStepIdx(r.B.w0 + pos)); }
  ptRaf = requestAnimationFrame(ptLineLoop);
}
function ptLineStart(){ if (!ptRaf) ptRaf = requestAnimationFrame(ptLineLoop); }

/* ---------- afspelen ---------- */
const ptSpw = bpm => PT_UNITS[ptCur.s.unit].w * 60 / bpm;     // seconden per hele noot
const ptPlaying = () => !!ptRun;
let ptLastScroll = 0;
function ptFollowStep(i){   // meescrollen/omslaan op basis van de regel van de huidige noot: één meting, een paar keer per seconde
  const g = ptGeo && ptGeo.step[i];
  if (ptFsOn && !ptFsCont){ const el = ptSteps[i] && ptSteps[i].els.map(e => ptEls[e]).find(Boolean); if (el) ptFsFollow(el); return; }
  if (!g) return;
  const L = ptGeo.lines[g.line];
  const sh = $('ptSheet'), sr = sh.getBoundingClientRect(), sc = sh.offsetWidth ? sr.width / sh.offsetWidth : 1;
  const top = sr.top + (L.t - 12) * sc, bot = sr.top + (L.b + 12) * sc;
  if (ptFsOn){
    const c = $('ptFsPage').getBoundingClientRect();
    if ((top < c.top + 10 || bot > c.bottom - 10) && Date.now() - ptLastScroll > 500){ ptLastScroll = Date.now(); $('ptFsPage').scrollBy({ top:top - c.top - c.height * .25, behavior:'smooth' }); }
    return;
  }
  const H = window.innerHeight, hh = ptHeadH();
  if ((top < hh + 20 || bot > H - 50) && Date.now() - ptLastScroll > 500){ ptLastScroll = Date.now(); window.scrollBy({ top:top - Math.max(hh + 20, Math.min(200, H * .28)), behavior:'smooth' }); }
}
function ptFollow(g){
  if (!g || !g.getBoundingClientRect || ptG.follow === false) return;
  if (ptFsOn){ ptFsFollow(g); return; }
  const r = g.getBoundingClientRect(), H = window.innerHeight, hh = ptHeadH();
  if ((r.top < hh + 20 || r.bottom > H - 60) && Date.now() - ptLastScroll > 600){
    ptLastScroll = Date.now();
    window.scrollBy({ top:r.top - Math.max(hh + 20, Math.min(220, H * .3)), behavior:'smooth' });
  }
}
function ptLater(fn, at){ const r = ptRun; if (!r) return; const id = setTimeout(() => { r.timers.delete(id); fn(); }, Math.max(0, (at - actx.currentTime + ptLat()) * 1000)); r.timers.add(id); }
function ptSchedule(ev, t){
  const r = ptRun, spw = ptSpw(r.bpm);
  if (ev.k === 'c'){ if (ptG.metro) Engine.click(t, ev.acc ? 'accent' : 'beat', undefined, true); return; }
  const st = ev.st, hands = ptCur.s.hands, solo = +ptCur.s.solo || 0;
  const quiet = solo === 2 || (solo === 1 && r.round % 2 === 0);
  const play = quiet ? [] : st.notes.filter(x => (hands === 'beide' || (hands === 'boven' ? x.st === ptTopStaff() : x.st !== ptTopStaff())) && ptGain(x.st) > 0);
  const vol = .5 * ptG.vol / 100 / Math.sqrt(Math.max(1, play.length / 2));
  play.forEach(x => {
    const dur = Math.max(.08, (ptU(r.B, ev.w + x.d) - ev.u) * spw * .97), o = { inst:ptKlank(x.st), vol:vol * ptGain(x.st) };
    if (x.o && ptCur.s.tr !== 'uit') ptOrnPlay(t, x, dur, o); else Engine.note(t, x.m, dur, o);
  });
  ptLater(() => {
    r.lastStep = st.i;
    const txt = (ptCur.s.loop ? 'ronde ' + r.round + ' · ' : '') + 'maat ' + st.mn + ' · ' + ptTempoTxt(r, st) + (quiet ? ' · jij speelt' : '');
    if (r.txt !== txt){ r.txt = txt; $('ptRound').textContent = txt; $('ptFsInfo').textContent = txt; }
  }, t);
}
function ptTempoTxt(r, st){   // '♩ = 45 · 80%' (tempo nu, en hoeveel procent van wat er in de noten staat)
  const u = PT_UNITS[ptCur.s.unit], n = r.B.nst[st.i - r.B.i0], f = n ? n.f : 1, bpm = Math.round(r.bpm * f);
  const pct = st.tq > 0 ? Math.round(100 * bpm * 4 / u.w / st.tq) : 0;
  return u.s + ' = ' + bpm + (pct > 0 && ptG.tempi !== false ? ' · ' + pct + '%' : '');
}
function ptTick(){
  const r = ptRun; if (!r) return;
  const now = actx.currentTime, horizon = now + .25, B = r.B;
  for (let guard = 0; guard < 500; guard++){
    if (r.k >= B.ev.length){
      const end = r.t0 + B.U * ptSpw(r.bpm);
      if (ptCur.s.loop){
        const s = ptCur.s;
        if (s.inc > 0){ const cap = s.max > 0 ? s.max : 300; r.bpm = Math.min(cap, r.bpm + s.inc); ptWarp(B, r.bpm); }
        r.t0 = end; r.k = 0; r.round++;
        r.hist.push({ t0:end, bpm:r.bpm }); if (r.hist.length > 6) r.hist.splice(0, r.hist.length - 6);
        continue;
      }
      if (now >= end + .1) ptStop(true);
      return;
    }
    const ev = B.ev[r.k], t = r.t0 + ev.u * ptSpw(r.bpm);
    if (t > horizon) break;
    if (t >= now - .03) ptSchedule(ev, t);
    r.k++;
  }
}
/* Eerst de opnames klaarzetten: een toon die nog niet gedecodeerd is, valt terug op de (veel fellere) nagebouwde klank,
   wat bij de eerste ▶ wisselend hard/zacht gaf. Wacht hooguit 4 s. */
let ptWaitTok = 0;
function ptPlay(resume){
  if (!ptCur || !ptSteps.length) return;
  const B = ptBlock(); if (!B || typeof Samples === 'undefined'){ ptPlayNow(resume); return; }
  Engine.ensure();
  const need = {};
  B.ev.forEach(ev => { if (ev.k === 'n') ev.st.notes.forEach(x => { const i = Engine.instId(ptKlank(x.st)); (need[i] = need[i] || new Set()).add(x.m); }); });
  const wait = Object.keys(need).filter(i => !Samples.ready(i, [...need[i]]));
  if (!wait.length){ ptPlayNow(resume); return; }
  if (ptRun) ptStop();
  const tok = ++ptWaitTok, it = ptCur; let left = wait.length, done = false;
  const go = () => { if (done || tok !== ptWaitTok || ptCur !== it) return; done = true; ptMsg('', ''); ptPlayNow(resume); };
  ptMsg('Klank laden…', 'busy');
  wait.forEach(i => { Samples.load(i); Samples.whenReady(i, [...need[i]], () => { if (--left <= 0) go(); }); });
  setTimeout(go, 4000);
}
function ptPlayNow(resume){
  if (!ptCur || !ptSteps.length) return;
  if (ptRun) ptStop();
  const B = ptBlock();
  if (!B){ ptMsg('Er zijn geen noten in maat ' + ptCur.s.from + ' t/m ' + ptCur.s.to + '.', 'bad'); return; }
  Engine.ensure();
  const s = ptCur.s, now = actx.currentTime + .12;
  ptRun = { B, bpm:s.bpm, k:0, round:1, timers:new Set(), lastStep:B.i0, started:performance.now(), pid:null };
  const pp = ptPasCur(); if (pp && ptPasSame(pp)){ pp.last = ptToday(); ptRun.pid = pp.id; ptSaveCur(); }
  const spw = ptSpw(s.bpm);
  let startW = 0;
  let pw = ptPausedAt == null ? null : (ptPausedW != null ? ptPausedW : ptSteps[ptPausedAt].w);
  if (pw != null && ptPausedBy !== 'pauze'){   // na klikken/slepen: beginnen bij de noot die je aanwijst (niet het staartje van de vorige)
    const i = ptStepIdx(pw), a = ptSteps[i], b = ptSteps[i + 1];
    if (pw - a.w > 1e-6){
      const span = (b ? b.w : a.w + a.dt) - a.w;
      pw = (pw - a.w) / Math.max(1e-6, span) < .34 || !b || b.w >= B.w0 + B.L - 1e-9 ? a.w : b.w;
    }
  }
  if (resume && pw != null && pw >= B.w0 - 1e-9 && pw < B.w0 + B.L - 1e-9){
    startW = pw - B.w0;
    ptRun.k = B.ev.findIndex(e => e.w >= startW - 1e-9);
    if (ptRun.k < 0) ptRun.k = B.ev.length;
    ptRun.t0 = now - ptU(B, startW) * spw;
    ptRun.startW = startW; ptRun.lastStep = ptStepIdx(pw);
    // noten die op deze plek nog zouden klinken: met hun resterende lengte laten doorklinken
    const hands = s.hands, top = ptTopStaff(), solo = +s.solo || 0;
    if (solo !== 2) B.ev.forEach((ev, k) => {
      if (k >= ptRun.k || ev.k !== 'n') return;
      ev.st.notes.forEach(x => {
        const rest = ev.w + x.d - startW, ru = ptU(B, ev.w + x.d) - ptU(B, startW);
        if (rest > .02 && ptGain(x.st) > 0 && (hands === 'beide' || (hands === 'boven' ? x.st === top : x.st !== top)))
          Engine.note(now, x.m, Math.max(.08, ru * spw * .97), { inst:ptKlank(x.st), vol:.5 * ptG.vol / 100 / Math.SQRT2 * ptGain(x.st) });
      });
    });
  } else {
    let ciDur = 0;
    if (ptG.ci > 0){
      const bl = B.bi.len * spw, n = ptG.ci * B.bi.n;
      ciDur = n * bl - B.pickup * spw;                  // bij een opmaat valt hij in de laatste afteltellen
      for (let j = 0; j < n; j++){
        const t = now + j * bl;
        if (ptG.metro && t >= now + ciDur - 1e-3) break; // vanaf de opmaat tikt de metronoom zelf
        Engine.click(t, j % B.bi.n === 0 ? 'accent' : 'beat', undefined, true);
      }
    }
    ptRun.t0 = now + Math.max(0, ciDur);
  }
  ptPausedAt = null; ptPausedW = null;
  ptRun.hist = [{ t0:ptRun.t0, bpm:ptRun.bpm }];
  ptRun.iv = setInterval(ptTick, 25); ptTick();
  ptLineStart();
  ptPlayUI();
}
function ptStop(keep, keepLine){
  ptWaitTok++;   // een wachtende start (Klank laden…) afbreken
  const r = ptRun;
  if (r){
    clearInterval(r.iv); r.timers.forEach(id => clearTimeout(id));
    const pp = ptCur && r.pid ? (ptCur.pas || []).find(x => x.id === r.pid) : null;
    if (pp){ pp.secs = (pp.secs || 0) + Math.round((performance.now() - r.started) / 1000); ptSaveCur(); ptPasUI(); }
    if (keep !== true) Engine.stopNotes();
  }
  ptRun = null;
  if (ptRaf){ cancelAnimationFrame(ptRaf); ptRaf = 0; }
  if (!keepLine) ptLineHide();
  document.querySelectorAll('#ptSheet .pthi').forEach(g => g.classList.remove('pthi'));
  if ($('ptRound')) $('ptRound').textContent = '';
  if ($('ptFsInfo')) $('ptFsInfo').textContent = ptCur ? ptPasLabel() : '';
  ptPlayUI();
}
function ptPause(){
  const r = ptRun; if (!r) return;
  const W = r.B.w0 + Math.min(ptRunPos(r), r.B.L - 1e-6), at = ptStepIdx(W), lineOn = !$('ptLine').hidden;
  ptStop(false, lineOn); ptSetPause(at, W, 'pauze'); ptMarkAt(at, lineOn); ptPlayUI();
}
function ptToggle(){ if (ptRun) ptPause(); else ptPlay(ptPausedAt != null); }
function ptPlayUI(){
  const b = $('ptPlay'); if (!b) return;
  b.textContent = ptRun ? '⏸ Pauze' : (ptPausedAt != null ? (ptPausedBy === 'klik' ? '▶ Vanaf hier' : '▶ Verder') : '▶ Afspelen');
  $('ptFsPlay').textContent = ptRun ? '⏸' : '▶';
  ptBarAuto();
}
/* ---------- bovenbalk: verdwijnt tijdens het spelen (18-11-2026) ----------
   Eén plakkende balk (#ptHead). Tijdens het afspelen schuift hij na ~1 s weg (class pt-hidebar op #ptView),
   zodat de partituur de hele hoogte heeft. Terug bij: pauze/stop (ptPlayUI), muis naar de bovenrand (gluren),
   knop ⌄ rechtsonder, focus in een invoerveld, of als een venster (🕹️/💬/🎬) open is. Uit te zetten in 🕹️ → Weergave. */
let ptBarT = 0, ptPeek = false, ptPeekT = 0;
function ptBarWant(){
  const v = $('ptView');
  if (!ptRun || ptFsOn || ptG.hideBar === false || ptPeek || ptSel) return false;
  if (v.classList.contains('pnlopen') || v.classList.contains('pvopen') || v.classList.contains('poopen')) return false;
  const a = document.activeElement;
  if (a && $('ptHead').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  if (!$('ptPasName').hidden || !$('ptNotesBox').hidden) return false;
  return true;
}
function ptBarAuto(){
  const v = $('ptView'); if (!v) return;
  const fab = $('ptFab');
  if (fab){ fab.hidden = !ptRun || ptFsOn; $('ptFabPlay').textContent = ptRun ? '⏸' : '▶'; }
  clearTimeout(ptBarT);
  if (!ptBarWant()){ if (v.classList.contains('pt-hidebar')) v.classList.remove('pt-hidebar'); ptFabUI(); return; }
  if (v.classList.contains('pt-hidebar')) return;
  ptBarT = setTimeout(() => { if (ptBarWant()){ v.classList.add('pt-hidebar'); ptFabUI(); } }, 1100);
}
function ptFabUI(){ const b = $('ptFabBar'); if (b) b.hidden = !$('ptView').classList.contains('pt-hidebar'); }
function ptBarPeek(on){
  clearTimeout(ptPeekT);
  if (on){ ptPeek = true; ptBarAuto(); return; }
  ptPeekT = setTimeout(() => { ptPeek = false; ptBarAuto(); }, 1200);
}
function ptHeadH(){   // hoeveel van de bovenkant van het scherm de balk nu bedekt (0 als hij weg is)
  const h = $('ptHead'); if (!h || ptFsOn || $('ptView').classList.contains('pt-hidebar')) return 0;
  const r = h.getBoundingClientRect(); return Math.max(0, r.bottom);
}
function ptTopStaff(){ return 0; }
function ptSetBpm(v){
  const s = ptCur.s, old = s.bpm;
  s.bpm = Math.max(20, Math.min(300, Math.round(v)));
  if (ptRun && old !== s.bpm){   // positie in de muziek vasthouden
    const r = ptRun, w = ptWofU(r.B, (actx.currentTime - r.t0) / ptSpw(r.bpm));
    r.bpm = s.bpm; ptWarp(r.B, r.bpm); r.t0 = actx.currentTime - ptU(r.B, w) * ptSpw(r.bpm);
    r.hist.push({ t0:r.t0, bpm:r.bpm });
  }
  ptTempoUI(); ptSaveCur();
}

/* ---------- stuk openen / toevoegen ---------- */
function ptDefUnit(){
  const b = ptBeats[0] || [4, 4], n = b[0], d = b[1];
  if (d === 2) return 'h'; if (d === 8 && n % 3 === 0 && n > 3) return 'qd'; if (d === 8) return 'e';
  return 'q';
}
async function ptOpen(id, pasId){
  const it = ptList.find(x => x.id === id); if (!it) return;
  if (ptFsOn) ptFsExit(true);
  ptStop(); ptPausedAt = null;
  ptSel = null; ptSelUI();
  ptCur = it; ptShow('play');
  ptStaffNames = []; ptPartOf = []; ptParts = []; ptPartsLoad(it);
  $('ptTitle').textContent = it.titel || it.naam; $('ptSub').textContent = it.comp || '';
  $('ptCacheView').innerHTML = ''; $('ptCacheView').hidden = true; ptEls = []; ptSrc = '';
  if (ptOsmdFor !== it.id) $('ptOsmdHost').hidden = true;
  ptMsg('Openen…', 'busy');
  // tijdlijn: uit de cache, anders OSMD laten inlezen
  const tl = await PtDB.cget(ptCK(it.id, 'tl'));
  if (ptCur !== it) return;
  if (tl && Array.isArray(tl.steps) && tl.steps.length){
    ptTlApply(tl); if (ptOsmdFor !== it.id) ptOsmdFor = null;
    if (!Array.isArray(tl.tempo3) || !Array.isArray(tl.orn)){ await ptTempoLoad(it); if (ptCur !== it) return; PtDB.cput(ptCK(it.id, 'tl'), ptTlPack()); }
  }
  else {
    ptOsmdFor = null;
    if (!(await ptEnsureOsmd()) || ptCur !== it) return;
    PtDB.cput(ptCK(it.id, 'tl'), ptTlPack());
  }
  const s = it.s = Object.assign({ bpm:72, unit:ptDefUnit(), from:ptMinM(), to:Math.min(ptMaxM(), ptMinM() + 3), focus:false, loop:true, inc:0, max:0, hands:'beide', stap:4, solo:0, klank:'auto', mix:{} }, it.s || {});
  if (!Array.isArray(it.pas)) it.pas = [];
  if (it.pcur && !it.pas.some(x => x.id === it.pcur)) it.pcur = null;
  if (!PT_UNITS[s.unit]) s.unit = 'q';
  s.from = Math.max(ptMinM(), Math.min(ptMaxM(), s.from)); s.to = Math.max(s.from, Math.min(ptMaxM(), s.to));
  it.maten = ptMeasures.length; it.last = ptToday();
  let startWhy = '';
  const pp = pasId ? it.pas.find(x => x.id === pasId) : null;
  if (pp){   // passage openen = meteen in Focus (alleen die maten tekenen: snel)
    it.pcur = pp.id; s.from = pp.from; s.to = pp.to; s.focus = true;
    const st = ptPasStart(pp); s.bpm = Math.max(20, Math.min(300, st.bpm));
    if (st.why) startWhy = 'Starttempo ' + PT_UNITS[s.unit].s + ' = ' + s.bpm + ': ' + st.why + '.';
  }
  $('ptTitle').textContent = it.titel || it.naam; $('ptSub').textContent = [it.comp, it.maten + ' maten'].filter(Boolean).join(' · ');
  ptSyncUI(); ptPasUI(); ptPaperApply();
  PtDB.put(it);
  await ptShowSheet();
  if (ptCur !== it) return;
  if (startWhy) ptMsg(startWhy, 'muted');
  if (!ptSteps.length) ptMsg('Er staan geen noten in dit stuk die ik kan afspelen.', 'bad');
}
function ptAddFile(f){
  if (!f) return;
  const zipped = /\.mxl$/i.test(f.name);
  if (!/\.(mxl|musicxml|xml)$/i.test(f.name)){ ptLibMsg('Kies een MusicXML-bestand (.musicxml, .xml of .mxl). Een pdf kan niet: zet die eerst om met Audiveris of MuseScore.', 'bad'); return; }
  const r = new FileReader();
  r.onload = async () => {
    const it = { id:'p' + Date.now().toString(36), naam:f.name.replace(/\.(mxl|musicxml|xml)$/i, ''), data:r.result, made:ptToday(), last:null, s:null };
    ptList.unshift(it);
    await PtDB.put(it);
    ptOpen(it.id);
  };
  r.onerror = () => ptLibMsg('Het bestand kon niet gelezen worden.', 'bad');
  if (zipped) r.readAsBinaryString(f); else r.readAsText(f);
}
async function ptAddSample(){
  const it = { id:'p' + Date.now().toString(36), naam:'Voorbeeld in b-klein', data:PT_SAMPLE, made:ptToday(), last:null, s:null };
  ptList.unshift(it); await PtDB.put(it); ptOpen(it.id);
}


/* ---------- passages (per stuk): bibliotheek van stukjes met status, doeltempo en schoon tempo ----------
   it.pas = [{id, naam, from, to, status:'nieuw'|'bezig'|'zit', bpm (laatst geoefend tempo), ok (schoon tempo = hoogste Gelukt),
              doel, secs, made, last}]; it.pcur = geladen passage. Zoals de setlist van de slimme metronoom. */
const ptDaysSince = d => { if (!d) return 999; const a = new Date(d + 'T12:00'), b = new Date(ptToday() + 'T12:00'); return Math.round((b - a) / 864e5); };
function ptPasCur(){ return ptCur && ptCur.pcur ? (ptCur.pas || []).find(x => x.id === ptCur.pcur) || null : null; }
function ptPasSame(p){ return p && ptCur && p.from === ptCur.s.from && p.to === ptCur.s.to; }
function ptPasLabel(){ const p = ptPasCur(); return p ? p.naam + ' · m. ' + p.from + '–' + p.to : 'maat ' + ptCur.s.from + '–' + ptCur.s.to; }
function ptPasStart(p){   // voorgesteld starttempo: na rust iets lager dan je schone tempo (zoals de slimme metronoom)
  let b = p.bpm || ptCur.s.bpm; const days = ptDaysSince(p.last);
  if (p.ok && days >= 1 && days < 999){ const v = Math.round(p.ok * (days >= 7 ? .85 : .92)); if (v < b) return { bpm:v, why:(days >= 7 ? '85' : '92') + '% van je schone tempo, want je deed hem ' + days + ' dag' + (days === 1 ? '' : 'en') + ' niet' }; }
  return { bpm:b, why:'' };
}
function ptPasMeta(p){
  const bits = ['m. ' + p.from + '–' + p.to];
  if (p.ok || p.doel) bits.push('🎯 ' + (p.ok || '–') + (p.doel ? ' / ' + p.doel : ''));
  if (p.secs >= 60) bits.push(Math.round(p.secs / 60) + ' min');
  bits.push(p.last ? (ptDaysSince(p.last) === 0 ? 'vandaag' : ptDay(p.last)) : 'nog niet geoefend');
  return bits.join(' · ');
}
function ptPasUI(){
  if (!ptCur) return;
  const list = ptCur.pas || [], cur = ptPasCur();
  const el = $('ptPasList');
  el.innerHTML = list.length ? list.map(p => `<span class="ptpchip${cur && cur.id === p.id ? ' on' : ''} st-${p.status}"><button class="ptpload" data-id="${p.id}" title="${ptEsc(p.notes ? p.notes : 'Laden: maten en tempo')}"><span class="ptpst">${PT_STATUS[p.status].i}</span><b>${ptEsc(p.naam)}</b><small>${ptEsc(ptPasMeta(p))}</small></button><button class="ptpdel" data-id="${p.id}" title="Verwijderen (twee keer klikken)">✕</button></span>`).join('')
    : '<span class="muted ptpasempty">Nog geen passages. Kies een blok (maat … t/m …, of klik op een noot) en bewaar het hier met een naam.</span>';
  el.querySelectorAll('.ptpload').forEach(b => b.onclick = () => { b.blur(); ptPasLoad(b.dataset.id); });
  el.querySelectorAll('.ptpdel').forEach(b => b.onclick = () => {
    if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; setTimeout(() => { if (b.isConnected){ b.classList.remove('arm'); b.textContent = '✕'; } }, 4000); return; }
    ptCur.pas = ptCur.pas.filter(x => x.id !== b.dataset.id); if (ptCur.pcur === b.dataset.id) ptCur.pcur = null;
    ptSaveCur(); ptPasUI();
  });
  if (!ptRun && $('ptFsInfo')) $('ptFsInfo').textContent = ptPasLabel();
  ptFsBlkUI();
  // passage-balk bovenin: status, tempo's, doel, aantekeningen
  $('ptStrip').hidden = !cur;
  if (cur){
    const same = ptPasSame(cur), u = PT_UNITS[ptCur.s.unit].s;
    $('ptStripName').innerHTML = '<b>' + ptEsc(cur.naam) + '</b><small>m. ' + cur.from + '–' + cur.to + (same ? '' : ' · blok gewijzigd') + '</small>';
    $('ptStripStatus').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.st === cur.status));
    $('ptStripNow').textContent = u + ' ' + ptCur.s.bpm;
    $('ptStripOk').textContent = cur.ok ? u + ' ' + cur.ok : '–';
    if (document.activeElement !== $('ptStripDoel')) $('ptStripDoel').value = cur.doel || '';
    const pct = cur.doel ? Math.max(0, Math.min(100, (cur.ok || 0) / cur.doel * 100)) : 0;
    $('ptStripBar').style.width = pct + '%'; $('ptStripBar').parentElement.hidden = !cur.doel;
    $('ptStripBar').classList.toggle('full', pct >= 100);
    $('ptPasUpd').hidden = same && cur.bpm === ptCur.s.bpm;
    if (document.activeElement !== $('ptNotes')) $('ptNotes').value = cur.notes || '';
    const open = !$('ptNotesBox').hidden, first = (cur.notes || '').split('\n').find(l => l.trim()) || '';
    $('ptNotesPrev').hidden = open || !first; $('ptNotesPrev').textContent = '📝 ' + first + ((cur.notes || '').trim().split('\n').filter(l => l.trim()).length > 1 ? ' …' : '');
    $('ptNotesBtn').classList.toggle('on', open || !!first);
  }
}
function ptPasLoad(id){
  const p = (ptCur.pas || []).find(x => x.id === id); if (!p) return;
  const was = !!ptRun; ptStop(); ptPausedAt = null;
  ptCur.pcur = id;
  const st = ptPasStart(p);
  ptCur.s.bpm = Math.max(20, Math.min(300, st.bpm)); ptTempoUI();
  const s = ptCur.s, changed = s.from !== p.from || s.to !== p.to;
  const wasFocus = s.focus;
  s.from = p.from; s.to = p.to; s.focus = true; $('ptFrom').value = p.from; $('ptTo').value = p.to; $('ptFocus').checked = true;
  ptSaveCur(); ptPasUI();
  ptMsg(st.why ? 'Starttempo ' + PT_UNITS[s.unit].s + ' = ' + st.bpm + ': ' + st.why + '.' : '', 'muted');
  const go = () => { if (was) ptPlay(); };
  if (changed || !wasFocus) ptRedraw().then(() => { if (st.why) ptMsg('Starttempo ' + PT_UNITS[s.unit].s + ' = ' + st.bpm + ': ' + st.why + '.', 'muted'); go(); });
  else { ptDim(); go(); }
}
function ptPasSaveNew(){
  const naam = ($('ptPasNameIn').value || '').trim() || ('Maat ' + ptCur.s.from + '–' + ptCur.s.to);
  const p = { id:'q' + Date.now().toString(36), naam, from:ptCur.s.from, to:ptCur.s.to, status:'nieuw', bpm:ptCur.s.bpm, ok:0, doel:0, secs:0, made:ptToday(), last:null };
  ptCur.pas = (ptCur.pas || []).concat(p); ptCur.pcur = p.id;
  $('ptPasName').hidden = true; $('ptPasNew').hidden = false;
  ptSaveCur(); ptPasUI();
}
function ptPasOk(){   // ✓ Gelukt: schoon tempo vastleggen en een stap sneller
  const p = ptPasCur(), s = ptCur.s;
  if (p){
    p.ok = Math.max(p.ok || 0, s.bpm); p.last = ptToday();
    if (p.status === 'nieuw') p.status = 'bezig';
    if (p.doel && p.ok >= p.doel && p.status !== 'zit'){ p.status = 'zit'; ptMsg('🎉 Doeltempo gehaald: "' + ptEsc(p.naam) + '" staat nu op ✅ Zit erin.', 'ok'); }
  }
  ptSetBpm(s.bpm + (s.stap || 4));
  if (p){ p.bpm = s.bpm; ptSaveCur(); ptPasUI(); }
}
function ptPasTooFast(){
  const p = ptPasCur(), s = ptCur.s;
  ptSetBpm(s.bpm - (s.stap || 4));
  if (p){ p.bpm = s.bpm; if (p.status === 'nieuw') p.status = 'bezig'; ptSaveCur(); ptPasUI(); }
}

/* ---------- volledig scherm: bladzijden (OSMD pageFormat A4_P), 1 of 2 naast elkaar, 0/90/−90 graden, zoom ----------
   #ptSheet verhuist naar #ptFsBox (terug naar #ptSheetHome bij sluiten). OSMD tekent op een vaste breedte (PT_FS_W)
   en de app schaalt de zichtbare bladzijde(n) passend in het scherm (× ptG.fsZoom). Gedraaid = de hele laag (balk +
   bladzijde) 90° gedraaid, zodat je de laptop op zijn kant kunt zetten als een boek. Lukt de echte fullscreen-API niet
   (sandbox), dan vult de laag toch het hele venster. */
function ptFsPagesFind(){
  ptFlipDone();
  const cont = ptActive();
  const svgs = [...cont.querySelectorAll('svg')].filter(x => !x.parentElement.closest('svg'));
  ptPages = svgs.map(x => (x.parentElement && x.parentElement !== cont) ? x.parentElement : x);
  ptFsCont = false;
  if (ptPages.length === 1){ const w = ptNat(ptPages[0]); ptFsCont = !ptPaged() || w.h > w.w * 1.9; }   // geen bladzijden gekregen: doorlopend, passend in de breedte
  ptFsP = Math.min(ptFsP, Math.max(0, ptPages.length - 1));
}
function ptNat(pg){
  const svg = pg.tagName.toLowerCase() === 'svg' ? pg : pg.querySelector('svg');
  let w = parseFloat(svg && svg.getAttribute('width')), h = parseFloat(svg && svg.getAttribute('height'));
  if (!(w > 0 && h > 0)){ try { const b = svg.getBBox(); w = b.width + b.x; h = b.height + b.y; } catch(e){ w = PT_FS_W; h = PT_FS_W * 1.41; } }
  return { w, h };
}
function ptFsArea(){   // beschikbare ruimte voor de bladzijden (rekening houdend met draaien en de balk)
  const rot = +ptG.rot || 0, W = window.innerWidth, H = window.innerHeight, R = $('ptFsRot');
  const sw = rot ? H : W, sh = rot ? W : H, bar = R && R.querySelector('.ptfsbar');
  return { sw, sh, aw:sw - 16, ah:sh - ((bar && bar.offsetHeight) || 44) - 12 };
}
function ptFsDims(){   // aantal bladzijden naast elkaar en de tekenmaat per bladzijde (zoom = smaller tekenen = grotere noten)
  const a = ptFsArea(), pref = ptG.fsPages;
  const n = pref === '1' ? 1 : pref === '2' ? 2 : (a.aw / a.ah > 1.25 ? 2 : 1);
  const asp = Math.max(.35, Math.min(2.6, (a.aw / n) / a.ah));
  // tekenbreedte volgt de breedte van het vak, zodat de noten op elk scherm ongeveer even groot zijn (± zoom)
  // gedraaid (laptop op zijn kant, één hoge bladzijde): compact zoals de voorbeelden van de gebruiker (Rondo alla Turca: 5 regels
  // × 6–7 maten; Seitz: ±11 balken × 5–6 maten). Regels met 3+ balken (viool + piano) nog kleiner, anders passen er maar 3 op.
  const nv = ptCur ? ptVisStaves() : 1;
  const k = (+ptG.rot || 0) ? 1.4 * (nv >= 3 ? 1 + .15 * (nv - 2) : 1) : 1.1;
  const pw = Math.round(Math.max(380, (a.aw / n) * k) / (+ptG.fsZoom || 1) / 10) * 10;
  return { n, pw, ph:Math.round(pw / asp / 20) * 20 };
}
function ptFsLayout(){
  if (!ptFsOn) return;
  const rot = +ptG.rot || 0, W = window.innerWidth, H = window.innerHeight;
  const sw = rot ? H : W, sh = rot ? W : H, R = $('ptFsRot');
  Object.assign(R.style, { width:sw + 'px', height:sh + 'px', transform:rot === 90 ? 'rotate(90deg) translateY(-100%)' : rot === -90 ? 'rotate(-90deg) translateX(-100%)' : '' });
  const barH = R.querySelector('.ptfsbar').offsetHeight || 48;
  const aw = sw - 16, ah = sh - barH - 12, sheet = $('ptSheet'), box = $('ptFsBox');
  if (!ptPages.length){ box.style.width = box.style.height = ''; return; }
  const nat = ptNat(ptPages[0]);
  if (ptFsCont){
    const sc = aw / nat.w * ptG.fsZoom;
    ptPages.forEach(pg => { pg.style.display = ''; });
    ptActive().style.display = 'block';
    Object.assign(sheet.style, { transform:'scale(' + sc + ')', transformOrigin:'0 0', display:'block', width:nat.w + 'px' });
    Object.assign(box.style, { width:nat.w * sc + 'px', height:nat.h * sc + 'px' });
    $('ptFsPg').textContent = ''; $('ptFsPrev').disabled = $('ptFsNext').disabled = true;
    return;
  }
  ptFsN = ptPages.length > 1 ? ptFsDims().n : 1;
  if (ptFsN === 2) ptFsP -= ptFsP % 2;
  const sc = Math.min(aw / (ptFsN * nat.w), ah / nat.h);   // zoom zit al in de tekening (ptFsDims)
  ptFsPagesUI();
  ptFsSc = sc;
  ptPages.forEach((pg, i) => { pg.style.display = i >= ptFsP && i < ptFsP + ptFsN ? '' : 'none'; });
  ptActive().style.display = 'flex';
  Object.assign(sheet.style, { transform:'scale(' + sc + ')', transformOrigin:'0 0', display:'block', width:ptFsN * nat.w + 'px' });
  ptGeo = null;
  Object.assign(box.style, { width:ptFsN * nat.w * sc + 'px', height:nat.h * sc + 'px' });
  const last = Math.min(ptPages.length, ptFsP + ptFsN);
  $('ptFsPg').textContent = 'blz ' + (ptFsP + 1) + (last > ptFsP + 1 ? '–' + last : '') + ' / ' + ptPages.length;
  $('ptFsPrev').disabled = ptFsP <= 0; $('ptFsNext').disabled = ptFsP + ptFsN >= ptPages.length;
}
function ptFsTurn(d){
  if (!ptFsOn || ptFsCont){ if (ptFsOn) $('ptFsPage').scrollBy({ top:d * $('ptFsPage').clientHeight * .8, behavior:'smooth' }); return; }
  ptFsGo(ptFsP + d * ptFsN);
}
/* Omslaan: rustig en nonchalant. De oude bladzijde(n) schuiven een klein stukje weg en vervagen, de nieuwe schuiven
   een klein stukje in (vooruit: naar links, terug: naar rechts). Kopieën van de oude bladzijden in een laag op #ptFsPage. */
function ptFlipDone(){ if (ptFlip){ ptFlip.anims.forEach(a => { try { a.cancel(); } catch(e){} }); if (ptFlip.el) ptFlip.el.remove(); ptFlip = null; } }
function ptFsGo(target){
  if (!ptFsOn || ptFsCont || !ptPages.length) return;
  target = Math.max(0, Math.min(ptPages.length - 1, target));
  if (ptFsN === 2) target -= target % 2;
  if (target === ptFsP) return;
  ptFlipDone();
  const fwd = target > ptFsP, n = ptFsN, old = ptFsP, nat = ptNat(ptPages[0]), sc = ptFsSc, box = $('ptFsBox');
  let lay = null;
  if (!ptStill()){
    const paper = getComputedStyle($('ptSheet')).backgroundColor || '#fff';
    lay = document.createElement('div');
    lay.className = 'ptflip ptsheet ' + ($('ptSheet').classList.contains('ptpaperdark') ? 'ptpaperdark' : 'ptpaperlight');
    Object.assign(lay.style, { left:box.offsetLeft + 'px', top:box.offsetTop + 'px', width:n * nat.w * sc + 'px', height:nat.h * sc + 'px', background:paper });
    for (let k = 0; k < n; k++){
      const pg = ptPages[old + k]; if (!pg) continue;
      const c = pg.cloneNode(true);
      Object.assign(c.style, { display:'block', position:'absolute', left:k * nat.w * sc + 'px', top:'0', width:nat.w + 'px', transform:'scale(' + sc + ')', transformOrigin:'0 0' });
      c.querySelectorAll('.pthi').forEach(x => x.classList.remove('pthi'));
      lay.appendChild(c);
    }
    $('ptFsPage').appendChild(lay);
  }
  ptFsP = target; ptFsLayout(); ptGeo = null; $('ptFsPage').scrollTo(0, 0);
  if (lay){
    const dx = fwd ? 36 : -36, opt = { duration:260, easing:'cubic-bezier(.25,.6,.3,1)' };
    const out = lay.animate([{ opacity:1, transform:'translateX(0)' }, { opacity:0, transform:'translateX(' + (-dx) + 'px)' }], Object.assign({ fill:'forwards' }, opt));
    const inn = box.animate([{ opacity:0, transform:'translateX(' + dx + 'px)' }, { opacity:1, transform:'translateX(0)' }], opt);
    ptFlip = { el:lay, anims:[out, inn] };
    out.onfinish = () => { if (ptFlip && ptFlip.el === lay){ lay.remove(); ptFlip = null; } };
  }
}
function ptFsFollow(g){
  const pg = ptPages.findIndex(p => p.contains(g));
  if (pg < 0) return;
  if (ptFsCont){
    const r = g.getBoundingClientRect(), c = $('ptFsPage').getBoundingClientRect();
    if ((r.top < c.top + 20 || r.bottom > c.bottom - 20) && Date.now() - ptLastScroll > 600){ ptLastScroll = Date.now(); $('ptFsPage').scrollBy({ top:r.top - c.top - c.height * .3, behavior:'smooth' }); }
    return;
  }
  if (pg < ptFsP || pg >= ptFsP + ptFsN) ptFsGo(pg);
}
async function ptFsEnter(){
  if (!ptCur || !ptSteps.length || ptFsOn) return;
  ptWNorm = $('ptSheet').clientWidth || ptWNorm;
  const fs = $('ptFs'), box = $('ptFsBox');
  const was = !!ptRun; ptStop();
  ptFsOn = true; ptFsP = 0; ptBarAuto();
  if (+ptG.rot){ ptG.rot = 0; ptSaveG(); }   // volledig scherm opent altijd recht; draaien (⟳) geldt alleen tot je het weer verlaat (wens gebruiker)
  box.classList.add('prep');                      // inhoud onzichtbaar tot alles op zijn plek staat
  fs.hidden = false; fs.classList.remove('show');
  document.body.classList.add('ptfson');
  ptPaperApply(); ptTempoUI(); ptPlayUI(); ptPasUI(); ptFsBlkUI(); ptFsModeUI(); ptFollowUI();
  box.appendChild($('ptSheet'));
  // eerst echt volledig scherm (en wachten tot het scherm zijn nieuwe maat heeft), dan pas uitleggen
  try {
    if (fs.requestFullscreen){
      const changed = new Promise(r => { const f = () => { document.removeEventListener('fullscreenchange', f); r(); }; document.addEventListener('fullscreenchange', f); setTimeout(r, 450); });
      await fs.requestFullscreen(); await changed;
    }
  } catch(e){}   // geweigerd in de viewer: de laag vult dan het venster
  await ptFrame();
  fs.classList.add('show');                       // achtergrond + balk faden in
  await ptShowSheet();
  ptFsLayout(); await ptFrame();
  box.classList.remove('prep');                   // bladzijden faden zacht in
  if (was) ptPlay();
}
async function ptFsExit(quiet){
  if (!ptFsOn) return;
  ptFlipDone();
  clearTimeout(ptFsZt); ptFsZoomDone();
  const fs = $('ptFs'), was = !!ptRun && quiet !== true;
  if (quiet !== true){ fs.classList.remove('show'); if (!ptStill()) await ptWait(300); }
  ptFsOn = false; ptBarAuto();
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch(e){}
  fs.hidden = true; fs.classList.remove('show'); document.body.classList.remove('ptfson');
  const sh = $('ptSheet'); $('ptSheetHome').appendChild(sh);
  Object.assign(sh.style, { transform:'', transformOrigin:'', display:'', width:'' });
  ['ptOsmdHost', 'ptCacheView'].forEach(id => { $(id).style.display = ''; });
  ptPages.forEach(pg => { pg.style.display = ''; }); ptPages = []; ptGeo = null;
  if (quiet !== true){ ptStop(); ptShowSheet().then(() => { if (was) ptPlay(); }); }
}
function ptFsModeUI(){
  const m = ptG.fsMode === 'door' ? 'door' : 'blad';
  $('ptFsModeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('ptFsModeSel').value = m;
  $('ptFs').classList.toggle('door', m === 'door');
}
function ptFsSetMode(m){
  if ((ptG.fsMode === 'door' ? 'door' : 'blad') === m) return;
  ptG.fsMode = m; ptSaveG(); ptFsModeUI();
  if (!ptFsOn) return;
  ptFsP = 0; const was = !!ptRun; ptStop();
  ptFsFade(async () => { await ptShowSheet(); }).then(() => { if (was) ptPlay(); });
}
let ptFsZt = 0, ptFsZBase = null;
const ptZq = z => +Math.pow(1.1, Math.round(Math.log(z) / Math.log(1.1))).toFixed(3);   // zoomtrappen van 10%: zelfde stand = uit de cache
function ptFsZoom(f){
  const old = +ptG.fsZoom || 1;
  ptG.fsZoom = Math.max(.5, Math.min(3, +(old * f).toFixed(3))); ptSaveG();
  if (!ptFsOn) return;
  if (!ptPaged()){ ptFsLayout(); return; }
  // bladzijden: meteen een voorbeeld (de getekende bladzijde vergroot/verkleind), daarna pas echt opnieuw tekenen
  if (ptFsZBase == null) ptFsZBase = old;
  const box = $('ptFsBox');
  box.style.transformOrigin = 'top center'; box.style.transform = 'scale(' + (ptG.fsZoom / ptFsZBase).toFixed(4) + ')';
  clearTimeout(ptFsZt);
  ptFsZt = setTimeout(() => {
    if (!ptFsOn){ ptFsZoomDone(); return; }
    const z = ptZq(ptG.fsZoom);
    if (Math.abs(z - ptFsZBase) < 1e-3){ ptG.fsZoom = ptFsZBase; ptSaveG(); ptFsZoomDone(); return; }   // terug op de getekende stand
    ptG.fsZoom = z; ptSaveG();
    const was = !!ptRun; ptStop();
    ptFsFade(async () => { await ptShowSheet(); ptFsZoomDone(); }).then(() => { if (was) ptPlay(); });
  }, 280);
}
function ptFsZoomDone(){ ptFsZBase = null; const b = $('ptFsBox'); b.style.transform = ''; b.style.transformOrigin = ''; }
function ptFsRedraw(){
  if (!ptFsOn) return;
  const was = !!ptRun; ptStop();
  ptFsFade(ptShowSheet).then(() => { if (was) ptPlay(); });
}
function ptFsSetPages(n){
  ptG.fsPages = n === '1' || n === '2' ? n : ''; ptSaveG(); ptFsPagesUI();
  if (ptFsOn && ptPaged()) ptFsRedraw();
}
function ptFsPagesUI(){
  const n = String(ptFsDims().n);
  $('ptFsPagesSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.n === n));
  $('ptFsPagesSel').value = ptG.fsPages || '';
}
/* Telefoon/tablet: in volledig scherm (bladzijden) omslaan door op de rechter- of linkerrand te tikken of te vegen.
   Tikken in het midden werkt zoals altijd (cursor verplaatsen). */
function ptFsTouch(){
  const pg = $('ptFsPage'); let st = null, eat = false;
  pg.addEventListener('pointerdown', e => { st = (e.pointerType === 'mouse') ? null : { x:e.clientX, y:e.clientY, t:Date.now() }; eat = false; }, true);
  pg.addEventListener('pointerup', e => {
    if (!st || !ptFsOn || ptFsCont) { st = null; return; }
    const dx = e.clientX - st.x, dy = e.clientY - st.y, dt = Date.now() - st.t; st = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 700){ eat = true; ptFsTurn(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 450){
      const r = pg.getBoundingClientRect(), rot = +ptG.rot || 0;
      // positie langs de leesrichting (bij draaien is "rechts" op het scherm een andere kant)
      const f = rot === 90 ? (e.clientY - r.top) / r.height : rot === -90 ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      if (f > .8){ eat = true; ptFsTurn(1); } else if (f < .2){ eat = true; ptFsTurn(-1); }
    }
  }, true);
  pg.addEventListener('click', e => { if (eat){ eat = false; e.stopPropagation(); e.preventDefault(); } }, true);
}
const ptStill = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ptWait = ms => new Promise(r => setTimeout(r, ms));
async function ptFsFade(work){   // inhoud kort uitfaden, werk doen (tekenen/uitleggen), weer infaden: geen springende tussenstappen
  const box = $('ptFsBox');
  box.classList.add('prep'); if (!ptStill()) await ptWait(130);
  await work();
  ptFsLayout(); await ptFrame();
  box.classList.remove('prep');
}
function ptPaperApply(){
  const m = ptG.paper || 'app', dark = m === 'donker' || (m === 'app' && document.documentElement.classList.contains('dark'));
  ['ptSheet', 'ptFs'].forEach(id => { const e = $(id); if (!e) return; e.classList.toggle('ptpaperdark', dark); e.classList.toggle('ptpaperlight', !dark); });
  $('ptPaperSel').value = m;
  $('ptFsPaper').textContent = m === 'app' ? '🌓' : m === 'licht' ? '☀️' : '🌙';
  $('ptFsPaper').title = 'Partituur: ' + (m === 'app' ? 'zoals de app' : m) + ' (klik om te wisselen)';
}
function ptLineOfsUI(){ const v = +ptG.lineOfs || 0; $('ptLineOfsVal').textContent = v === 0 ? 'gelijk' : (v > 0 ? v + ' ms eerder' : (-v) + ' ms later'); }
function ptFollowUI(){
  const on = ptG.follow !== false;
  $('ptFollowBtn').classList.toggle('on', on); $('ptFollowBtn').title = 'Meescrollen en omslaan tijdens het afspelen: ' + (on ? 'aan' : 'uit') + ' (klik om te wisselen)';
  const b = $('ptFsFollow'); b.classList.toggle('on', on);
  b.title = 'Automatisch omslaan: ' + (on ? 'aan' : 'uit') + ' (klik om te wisselen)';
}
function ptPaperNext(){ ptG.paper = { app:'licht', licht:'donker', donker:'app' }[ptG.paper || 'app']; ptSaveG(); ptPaperApply(); }

/* ---------- bibliotheek: vandaag oefenen (top 3 passages over alle stukken) ---------- */
function ptPrio(p){   // zoals het slimme voorstel van de metronoom: lang geleden + ver van je doel = eerst
  if (!p.last) return 1.1;
  const days = Math.min(14, ptDaysSince(p.last));
  let x = .6 * days / 14 + .4 * (p.doel ? Math.min(1, Math.max(0, (p.doel - (p.ok || 0)) / p.doel) * 3) : .5);
  if (p.status === 'zit') x *= .35;
  if (ptDaysSince(p.last) === 0) x *= .2;
  return x;
}

/* ---------- schermen ---------- */
function ptShow(mode){ const v = $('ptView'); v.classList.toggle('pt-lib', mode === 'lib'); v.classList.toggle('pt-play', mode === 'play'); document.body.classList.toggle('ptplaymode', mode === 'play'); if (mode !== 'play') v.classList.remove('pt-uitleg', 'pt-hidebar'); }
function ptLibMsg(html, cls){ const el = $('ptLibMsg'); if (el){ el.innerHTML = html || ''; el.className = 'ptmsg' + (cls ? ' ' + cls : ''); } }
async function ptRenderList(){
  ptList = (await PtDB.all()) || [];
  ptList.sort((a, b) => (b.last || b.made || '').localeCompare(a.last || a.made || ''));
  // vandaag oefenen: top 3 passages
  const all = [];
  ptList.forEach(it => (it.pas || []).forEach(p => all.push({ it, p, x:ptPrio(p) })));
  all.sort((a, b) => b.x - a.x);
  const top = all.slice(0, 3);
  $('ptToday').innerHTML = top.length ? '<div class="rlabel">Vandaag oefenen</div><div class="pttodaylist">' + top.map(o => `<button class="pttodayb" data-id="${o.it.id}" data-p="${o.p.id}"><span>${PT_STATUS[o.p.status].i}</span><b>${ptEsc(o.p.naam)}</b><small>${ptEsc((o.it.titel || o.it.naam) + ' · ' + ptPasMeta(o.p))}</small></button>`).join('') + '</div>' : '';
  $('ptToday').querySelectorAll('.pttodayb').forEach(b => b.onclick = () => ptOpen(b.dataset.id, b.dataset.p));
  // filter op instrument
  const has = k => ptList.some(it => (it.instr || '') === k);
  const F = [['alle', 'Alles']].concat(Object.keys(PT_INSTR).filter(has).map(k => [k, PT_INSTR[k]]));
  if (!F.some(f => f[0] === ptG.libF)) ptG.libF = 'alle';
  $('ptFilter').innerHTML = F.length > 2 ? F.map(f => `<button class="ptfchip${ptG.libF === f[0] ? ' on' : ''}" data-f="${f[0]}">${f[1]}</button>`).join('') : '';
  $('ptFilter').querySelectorAll('.ptfchip').forEach(b => b.onclick = () => { ptG.libF = b.dataset.f; ptSaveG(); ptRenderList(); });
  const shown = ptList.filter(it => ptG.libF === 'alle' || (it.instr || '') === ptG.libF);
  const el = $('ptList');
  const sum = it => { const ps = it.pas || []; if (!ps.length) return ''; const c = k => ps.filter(p => p.status === k).length;
    return ps.length + ' passage' + (ps.length === 1 ? '' : 's') + ' (' + ['zit', 'bezig', 'nieuw'].filter(k => c(k)).map(k => PT_STATUS[k].i + c(k)).join(' ') + ')'; };
  if (!ptList.length){ el.innerHTML = '<p class="muted ptempty">Nog geen stukken. Voeg een MusicXML-bestand toe, of probeer eerst het voorbeeld.</p>'; }
  else el.innerHTML = shown.map(it => `<div class="ptrow"><button class="ptopen" data-id="${it.id}"><b>${it.instr ? PT_INSTR[it.instr].split(' ')[0] + ' ' : ''}${ptEsc(it.titel || it.naam)}</b><small>${ptEsc([it.comp, it.maten ? it.maten + ' maten' : '', sum(it), it.last ? 'geoefend ' + ptDay(it.last) : 'nieuw'].filter(Boolean).join(' · '))}</small></button><button class="ptdel" data-id="${it.id}" title="Verwijderen (twee keer klikken)">✕</button></div>`).join('');
  el.querySelectorAll('.ptopen').forEach(b => b.onclick = () => ptOpen(b.dataset.id));
  el.querySelectorAll('.ptdel').forEach(b => b.onclick = async () => {
    if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; setTimeout(() => { if (b.isConnected){ b.classList.remove('arm'); b.textContent = '✕'; } }, 4000); return; }
    const gone = ptList.find(x => x.id === b.dataset.id); if (gone) ptCacheDrop(gone);
    await PtDB.del(b.dataset.id); if (ptCur && ptCur.id === b.dataset.id) ptCur = null; ptRenderList();
  });
  if (!PtDB.ok()) ptLibMsg('Let op: opslaan lukt niet in deze browser; je stukken blijven alleen staan tot je de pagina sluit.', 'muted');
}
function ptBack(){ if (ptSel) ptSelCancel(); if (ptFsOn) ptFsExit(true); ptStop(); ptPausedAt = null; if (ptCur){ clearTimeout(ptSaveT); PtDB.put(ptCur); } ptCur = null; ptShow('lib'); ptRenderList(); }
/* 🕹️ → Tempo's in dit stuk: per deel het voorgeschreven tempo en (optioneel) je eigen tempo, in de eenheid van 'Tel in'. */
function ptTempiList(){
  const box = $('ptTempiList'); if (!box || !ptCur || !ptCur.s) return;   // nieuw stuk: instellingen bestaan pas na ptOpen (ptSyncUI roept dit later opnieuw aan)
  if (box.contains(document.activeElement)) return;   // niet herbouwen terwijl je typt
  const s = ptCur.s, U = PT_UNITS[s.unit], over = s.tempi || {}, S = ptTSecs;
  if (!S.length){ box.innerHTML = '<p class="muted ptnote">Er staan geen tempo-aanduidingen in dit stuk: alles gaat op de tempoknop.</p>'; return; }
  const b0 = ptSteps.find(x => x.mn >= s.from), sec0 = b0 ? b0.sec : null;
  const toU = q => Math.round(q * U.w / 4), mn = mi => ptMeasures[mi] != null ? ptMeasures[mi] : mi + 1;
  box.innerHTML = '<div class="pttempi">' + S.map((x, k) => {
    const pre = toU(x.q), o = +over[x.key] > 0 ? toU(+over[x.key]) : '', isStart = k === sec0;
    const name = x.lab && /[a-z]/i.test(x.lab.replace(/[𝅝𝅗𝅥♩♪𝅘𝅥𝅯]/g, '')) ? x.lab : U.s + ' = ' + pre + ' (' + ptTerm(pre) + ')';
    return '<div class="pttrow' + (isStart ? ' start' : '') + '"><span class="pttname"><b>' + ptEsc(name) + '</b> <span class="muted">maat ' + mn(x.mi) + ' · in de noten ' + U.s + ' = ' + pre + ' (' + ptTerm(pre) + ')</span></span>'
      + '<label class="pttin">Jouw tempo ' + U.s + ' = <input type="number" min="20" max="300" step="1" data-k="' + ptEsc(x.key) + '" value="' + o + '" placeholder="' + (isStart ? 'knop' : 'mee') + '"></label>'
      + (o !== '' ? '<button type="button" class="pttclr" data-k="' + ptEsc(x.key) + '" title="Weer in verhouding laten meegaan">✕</button>' : '')
      + (isStart ? '<span class="muted pttnote">begin van je oefenblok: volgt de tempoknop</span>' : o !== '' ? '<span class="muted pttnote">' + ptTerm(o) + '</span>' : '')
      + '</div>';
  }).join('') + '</div>';
  const set = (key, v) => {
    s.tempi = s.tempi || {};
    if (v > 0) s.tempi[key] = Math.round(v * 4 / U.w * 100) / 100; else delete s.tempi[key];
    ptSaveCur();
    if (ptRun){ const r = ptRun, w = ptWofU(r.B, (actx.currentTime - r.t0) / ptSpw(r.bpm)); ptWarp(r.B, r.bpm); r.t0 = actx.currentTime - ptU(r.B, w) * ptSpw(r.bpm); r.hist.push({ t0:r.t0, bpm:r.bpm }); }
  };
  box.querySelectorAll('input[data-k]').forEach(inp => {
    inp.onchange = () => { const v = Math.max(0, Math.min(300, Math.round(+inp.value || 0))); set(inp.dataset.k, v >= 20 ? v : 0); inp.blur(); ptTempiList(); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') inp.onchange(); if (e.key === 'Escape'){ inp.blur(); ptTempiList(); } };
  });
  box.querySelectorAll('.pttclr').forEach(bt => { bt.onclick = () => { set(bt.dataset.k, 0); ptTempiList(); }; });
}
function ptTempoUI(){
  const s = ptCur.s;
  document.querySelectorAll('#ptView .ptBpmVal').forEach(e => { e.textContent = s.bpm; });
  document.querySelectorAll('#ptView .ptUnitSym').forEach(e => { e.textContent = PT_UNITS[s.unit].s; });
  if (ptCur.pcur && $('ptStripNow')) ptPasUI();
  ptTempiList();
}
function ptSyncUI(){
  if (!ptCur) return;
  const s = ptCur.s;
  ptTempoUI();
  $('ptFrom').min = $('ptTo').min = ptMinM(); $('ptFrom').max = $('ptTo').max = ptMaxM();
  $('ptFrom').value = s.from; $('ptTo').value = s.to;
  $('ptFocus').checked = s.focus; $('ptLoop').checked = s.loop; ptFsBlkUI();
  $('ptMetro').checked = ptG.metro; if ($('ptTempi')) $('ptTempi').checked = ptG.tempi !== false;
  $('ptUnit').value = s.unit; $('ptInc').value = s.inc; $('ptMax').value = s.max || '';
  $('ptHands').value = s.hands; $('ptHandsRow').hidden = ptStaves < 2;
  $('ptCi').value = ptG.ci; $('ptInst').value = s.klank || 'auto'; ptMixUI(); ptTrUI(); $('ptVol').value = ptG.vol;
  $('ptCursor').value = ptG.cursor; $('ptZoom').value = ptG.zoom; $('ptZoomVal').textContent = ptG.zoom + '%';
  ptFollowUI();
  $('ptLineOfs').value = ptG.lineOfs || 0; ptLineOfsUI();
  $('ptStap').value = s.stap; $('ptSolo').value = String(s.solo || 0); $('ptInstr').value = ptCur.instr || '';
  ptPlayUI();
}
function ptRedraw(){   // in volledig scherm: zacht uit/infaden en terug naar de eerste bladzijde
  if (!ptFsOn) return ptShowSheet();
  ptFsP = 0; return ptFsFade(ptShowSheet);
}
/* Volledig scherm: blok (maat … – …), Focus en passage kiezen zonder het volledig scherm te verlaten (22-11-2026, wens gebruiker) */
function ptFsBlkUI(){
  if (!ptCur || !$('ptFsFrom')) return;
  const s = ptCur.s, f = $('ptFsFrom'), t = $('ptFsTo');
  f.min = t.min = ptMinM(); f.max = t.max = ptMaxM();
  if (document.activeElement !== f) f.value = s.from;
  if (document.activeElement !== t) t.value = s.to;
  $('ptFsFocus').classList.toggle('on', !!s.focus);
  const list = ptCur.pas || [], sel = $('ptFsPas'), cur = ptPasCur();
  sel.hidden = !list.length;
  sel.innerHTML = '<option value="">Passage…</option>' + list.map(p => `<option value="${p.id}">${ptEsc(p.naam)} (m. ${p.from}–${p.to})</option>`).join('');
  sel.value = cur ? cur.id : '';
}
function ptSetFocus(on){
  ptCur.s.focus = !!on; $('ptFocus').checked = !!on; ptSaveCur(); ptFsBlkUI();
  const was = !!ptRun; ptStop(); ptRedraw().then(() => { if (was) ptPlay(); });
}
function ptSetBlock(a, b, reRender){
  const s = ptCur.s;
  a = Math.max(ptMinM(), Math.min(ptMaxM(), Math.round(a))); b = Math.max(a, Math.min(ptMaxM(), Math.round(b)));
  const changed = a !== s.from || b !== s.to;
  s.from = a; s.to = b; $('ptFrom').value = a; $('ptTo').value = b; ptFsBlkUI();
  ptPausedAt = null; if (!ptRun) ptLineHide(); ptPasUI(); ptPlayUI(); ptTempiList();
  if (!changed) return Promise.resolve();
  ptSaveCur();
  const was = !!ptRun; if (was) ptStop();
  if (s.focus && reRender !== false) return ptRedraw().then(() => { if (was) ptPlay(); });
  ptDim(); if (was) ptPlay();
  return Promise.resolve();
}

function ptInit(){
  if (ptInited) return; ptInited = true;
  $('ptInst').innerHTML = '<option value="auto">Automatisch (viool + piano)</option>' + Engine.instOptions('');
  // 🕹️-paneel: inklapbare blokken, open/dicht onthouden
  const secs = document.querySelectorAll('#ptView .ptsec');
  try { const o = JSON.parse(localStorage.getItem('pt-pnl-open') || 'null'); if (o) secs.forEach(d => { if (d.dataset.sec in o) d.open = !!o[d.dataset.sec]; }); } catch(e){}
  secs.forEach(d => d.addEventListener('toggle', () => { const o = {}; secs.forEach(x => { o[x.dataset.sec] = x.open; }); try { localStorage.setItem('pt-pnl-open', JSON.stringify(o)); } catch(e){} }));
  $('ptFile').onchange = e => { ptAddFile(e.target.files[0]); e.target.value = ''; };
  $('ptSample').onclick = ptAddSample;
  const lib = $('ptLibBox');
  lib.addEventListener('dragover', e => { e.preventDefault(); lib.classList.add('drag'); });
  lib.addEventListener('dragleave', () => lib.classList.remove('drag'));
  lib.addEventListener('drop', e => { e.preventDefault(); lib.classList.remove('drag'); ptAddFile(e.dataTransfer.files[0]); });
  $('ptBack').onclick = ptBack;
  $('ptPlay').onclick = e => { ptToggle(); e.currentTarget.blur(); };
  $('ptBegin').onclick = e => { if (e && e.currentTarget) e.currentTarget.blur(); ptPausedAt = null; const was = !!ptRun; ptStop(); ptPlayUI(); if (was) ptPlay(); };
  $('ptView').querySelectorAll('.pttempo button[data-d]').forEach(b => b.onclick = () => ptSetBpm(ptCur.s.bpm + +b.dataset.d));
  $('ptMetro').onchange = () => { ptG.metro = $('ptMetro').checked; ptSaveG(); };
  if ($('ptTempi')) $('ptTempi').onchange = () => { ptG.tempi = $('ptTempi').checked; ptSaveG(); if (ptRun){ const pr = ptPausedAt; ptPause(); ptPlay(true); } };
  $('ptFrom').onchange = () => ptSetBlock(+$('ptFrom').value, Math.max(+$('ptFrom').value, +$('ptTo').value));
  $('ptTo').onchange = () => ptSetBlock(Math.min(+$('ptFrom').value, +$('ptTo').value), +$('ptTo').value);
  $('ptAll').onclick = () => ptSetBlock(ptMinM(), ptMaxM());
  $('ptFocus').onchange = () => ptSetFocus($('ptFocus').checked);
  $('ptFsFocus').onclick = e => { e.currentTarget.blur(); ptSetFocus(!ptCur.s.focus); };
  $('ptFsFrom').onchange = () => { const a = +$('ptFsFrom').value; ptSetBlock(a, Math.max(a, +$('ptFsTo').value)); };
  $('ptFsTo').onchange = () => { const b = +$('ptFsTo').value; ptSetBlock(Math.min(+$('ptFsFrom').value, b), b); };
  ['ptFsFrom', 'ptFsTo'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); e.target.blur(); } }));
  $('ptFsPas').onchange = e => { const id = e.target.value; e.target.blur(); if (id) ptPasLoad(id); };
  $('ptLoop').onchange = () => { ptCur.s.loop = $('ptLoop').checked; ptSaveCur(); };
  $('ptUnit').onchange = () => {   // tempo omrekenen zodat het even snel blijft klinken
    const s = ptCur.s, old = PT_UNITS[s.unit].w, nu = PT_UNITS[$('ptUnit').value].w;
    s.unit = $('ptUnit').value; s.bpm = Math.max(20, Math.min(300, Math.round(s.bpm * nu / old)));
    if (ptRun){ ptRun.bpm = s.bpm; ptWarp(ptRun.B, s.bpm); }
    ptTempoUI(); ptSaveCur();
  };
  $('ptInc').onchange = () => { ptCur.s.inc = Math.max(0, Math.min(20, Math.round(+$('ptInc').value || 0))); $('ptInc').value = ptCur.s.inc; ptSaveCur(); };
  $('ptMax').onchange = () => { const v = Math.round(+$('ptMax').value || 0); ptCur.s.max = v >= 20 ? Math.min(300, v) : 0; $('ptMax').value = ptCur.s.max || ''; ptSaveCur(); };
  $('ptHands').onchange = () => { ptCur.s.hands = $('ptHands').value; ptSaveCur(); };
  $('ptCi').onchange = () => { ptG.ci = +$('ptCi').value; ptSaveG(); };
  $('ptTr').onchange = () => { if (!ptCur) return; ptCur.s.tr = $('ptTr').value; ptSaveCur(); ptTrUI(); };
  $('ptInst').onchange = () => { if (!ptCur) return; ptCur.s.klank = $('ptInst').value; ptSaveCur(); ptKlankPreload(); ptMixUI(); };
  ptMixInit();
  $('ptVol').oninput = () => { ptG.vol = +$('ptVol').value; ptSaveG(); };
  $('ptCursor').onchange = () => { ptG.cursor = $('ptCursor').value; ptSaveG(); document.querySelectorAll('#ptSheet .pthi').forEach(g => g.classList.remove('pthi')); if (ptG.cursor === 'noten') ptLineHide(); if (ptG.cursor === 'lijn') ptHlClear(ptRun); if (ptRun) ptLineStart(); };
  $('ptZoom').oninput = () => { $('ptZoomVal').textContent = $('ptZoom').value + '%'; };
  $('ptStap').onchange = () => { ptCur.s.stap = Math.max(1, Math.min(20, Math.round(+$('ptStap').value || 4))); $('ptStap').value = ptCur.s.stap; ptSaveCur(); };
  $('ptSolo').onchange = () => { ptCur.s.solo = +$('ptSolo').value; ptSaveCur(); };
  $('ptInstr').onchange = () => { ptCur.instr = $('ptInstr').value; ptSaveCur(); ptKlankPreload(); ptMixUI(); };
  // passages
  $('ptPasNew').onclick = () => { $('ptPasNew').hidden = true; $('ptPasName').hidden = false; $('ptPasNameIn').value = ''; $('ptPasNameIn').placeholder = 'Naam, bv. Maat ' + ptCur.s.from + '–' + ptCur.s.to; $('ptPasNameIn').focus(); };
  $('ptPasCancel').onclick = () => { $('ptPasName').hidden = true; $('ptPasNew').hidden = false; };
  $('ptPasSave').onclick = ptPasSaveNew;
  $('ptPasNameIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ptPasSaveNew(); else if (e.key === 'Escape') $('ptPasCancel').click(); });
  $('ptStripStatus').querySelectorAll('button').forEach(b => b.onclick = () => { b.blur(); const p = ptPasCur(); if (p){ p.status = b.dataset.st; ptSaveCur(); ptPasUI(); } });
  $('ptStripDoel').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('ptStripDoel').blur(); });
  $('ptStripDoel').onchange = () => { const p = ptPasCur(); if (!p) return; const v = Math.round(+$('ptStripDoel').value || 0); p.doel = v >= 20 ? Math.min(300, v) : 0; ptSaveCur(); ptPasUI(); };
  $('ptNotesBtn').onclick = e => { e.currentTarget.blur(); const box = $('ptNotesBox'); box.hidden = !box.hidden; ptPasUI(); if (!box.hidden) $('ptNotes').focus(); };
  $('ptNotesPrev').onclick = () => $('ptNotesBtn').click();
  $('ptNotes').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') $('ptNotesBtn').click(); });
  $('ptNotes').addEventListener('input', () => { const p = ptPasCur(); if (!p) return; p.notes = $('ptNotes').value; ptSaveCur(); });
  $('ptNotes').addEventListener('blur', () => ptPasUI());
  $('ptOk').onclick = e => { e.currentTarget.blur(); ptPasOk(); };
  $('ptTooFast').onclick = e => { e.currentTarget.blur(); ptPasTooFast(); };
  $('ptPasUpd').onclick = () => { const p = ptPasCur(); if (!p) return; p.from = ptCur.s.from; p.to = ptCur.s.to; p.bpm = ptCur.s.bpm; ptSaveCur(); ptPasUI(); };
  // volledig scherm + papier
  $('ptFsBtn').onclick = ptFsEnter;
  $('ptFsClose').onclick = () => ptFsExit();
  $('ptFsModeSeg').querySelectorAll('button').forEach(b => b.onclick = () => { b.blur(); ptFsSetMode(b.dataset.m); });
  $('ptFsModeSel').onchange = () => ptFsSetMode($('ptFsModeSel').value);
  $('ptFsPlay').onclick = e => { ptToggle(); e.currentTarget.blur(); };
  $('ptFsPrev').onclick = () => ptFsTurn(-1);
  $('ptFsNext').onclick = () => ptFsTurn(1);
  $('ptFsIn').onclick = () => ptFsZoom(1.15);
  // knijpen op het touchpad / Ctrl+scrollwiel in volledig scherm = noten groter/kleiner (werkt ook 90° gedraaid)
  $('ptFs').addEventListener('wheel', e => {
    if (!ptFsOn || !e.ctrlKey) return;
    e.preventDefault();
    ptFsZoom(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * .006));
  }, { passive:false });
  $('ptFsOut').onclick = () => ptFsZoom(1 / 1.15);
  $('ptFsPagesSeg').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b){ b.blur(); ptFsSetPages(b.dataset.n); } });
  $('ptFsPagesSel').onchange = () => ptFsSetPages($('ptFsPagesSel').value);
  $('ptShow').onchange = () => { if (!ptCur) return; ptCur.s.show = $('ptShow').value; ptSaveCur(); if (!ptSteps.length) return; const was = !!ptRun; ptStop(); (ptFsOn ? ptFsFade(ptShowSheet) : ptShowSheet()).then(() => { if (was) ptPlay(); }); };
  $('ptTitles').checked = !!ptG.titles;
  $('ptTitles').onchange = () => { ptG.titles = $('ptTitles').checked; ptSaveG(); if (!ptCur || !ptSteps.length) return; const was = !!ptRun; ptStop(); (ptFsOn ? ptFsFade(ptShowSheet) : ptShowSheet()).then(() => { if (was) ptPlay(); }); };
  ptFsTouch();
  $('ptFsRotBtn').onclick = () => { ptG.rot = { 0:-90, '-90':90, 90:0 }[ptG.rot || 0]; ptSaveG(); ptFsLayout(); if (ptFsOn && ptPaged() && ptKey() !== ptKeyNow) ptFsRedraw(); };
  $('ptLineOfs').oninput = () => { ptG.lineOfs = +$('ptLineOfs').value; ptLineOfsUI(); };
  $('ptLineOfs').onchange = () => { ptG.lineOfs = +$('ptLineOfs').value; ptSaveG(); };
  $('ptFollowBtn').onclick = e => { e.currentTarget.blur(); ptG.follow = ptG.follow === false; ptSaveG(); ptFollowUI(); };
  $('ptFsFollow').onclick = e => { e.currentTarget.blur(); ptG.follow = ptG.follow === false; ptSaveG(); ptFollowUI(); };
  // bovenbalk die wegschuift tijdens het spelen
  $('ptHideBar').checked = ptG.hideBar !== false;
  $('ptHideBar').onchange = () => { ptG.hideBar = $('ptHideBar').checked; ptSaveG(); ptBarAuto(); };
  $('ptFabPlay').onclick = e => { e.currentTarget.blur(); ptToggle(); };
  $('ptFabBar').onclick = e => { e.currentTarget.blur(); ptBarPeek(true); ptBarPeek(false); clearTimeout(ptPeekT); ptPeekT = setTimeout(() => { ptPeek = false; ptBarAuto(); }, 4000); };
  $('ptInfoBtn').onclick = e => {
    e.currentTarget.blur();
    const v = $('ptView'), on = !v.classList.contains('pt-uitleg');
    v.classList.toggle('pt-uitleg', on);
    const d = v.querySelector('.sechead details'); if (d) d.open = on;
    if (on) window.scrollTo({ top:0, behavior:'smooth' });
  };
  document.addEventListener('mousemove', e => {
    if (typeof view === 'undefined' || view !== 'partituren' || !ptRun || ptFsOn) return;
    const head = $('ptHead'), hidden = $('ptView').classList.contains('pt-hidebar');
    if (hidden){ if (e.clientY < 56) ptBarPeek(true); return; }
    if (ptPeek){ const r = head.getBoundingClientRect(); if (e.clientY > r.bottom + 30) ptBarPeek(false); else clearTimeout(ptPeekT); }
  }, { passive:true });
  $('ptHead').addEventListener('focusin', () => ptBarAuto());
  $('ptHead').addEventListener('focusout', () => setTimeout(ptBarAuto, 50));
  let pnlKey = '';
  new MutationObserver(() => {   // 🕹️ / 💬 / 🎬 open of dicht → balk tonen of weer verbergen
    const c = $('ptView').classList, k = ['pnlopen', 'pvopen', 'poopen'].map(x => c.contains(x) ? 1 : 0).join('');
    if (k !== pnlKey){ pnlKey = k; ptBarAuto(); }
  }).observe($('ptView'), { attributes:true, attributeFilter:['class'] });
  $('ptPaperSel').onchange = () => { ptG.paper = $('ptPaperSel').value; ptSaveG(); ptPaperApply(); }; $('ptFsPaper').onclick = ptPaperNext;
  document.addEventListener('fullscreenchange', () => {
    if (ptFsOn && !document.fullscreenElement && ptFsWasReal) ptFsExit();   // Esc of de browser haalde ons uit fullscreen
    ptFsWasReal = !!document.fullscreenElement; setTimeout(ptFsLayout, 60);
  });
  try { new MutationObserver(() => ptPaperApply()).observe(document.documentElement, { attributes:true, attributeFilter:['class'] }); } catch(e){}
  let zT = null;
  const zoomTo = (v, wait) => {   // − / ＋ wachten even, zodat een paar klikken één keer opnieuw tekenen
    v = Math.max(40, Math.min(200, Math.round(v / 5) * 5));
    $('ptZoom').value = v; $('ptZoomVal').textContent = v + '%';
    clearTimeout(zT);
    zT = setTimeout(() => { if (v === ptG.zoom) return; ptG.zoom = v; ptSaveG(); const was = !!ptRun; ptStop(); ptShowSheet().then(() => { if (was) ptPlay(); }); }, wait);
  };
  $('ptZoom').onchange = () => zoomTo(+$('ptZoom').value, 0);
  $('ptZoomOut').onclick = e => { e.currentTarget.blur(); zoomTo(+$('ptZoom').value - 10, 450); };
  $('ptZoomIn').onclick = e => { e.currentTarget.blur(); zoomTo(+$('ptZoom').value + 10, 450); };
  // klikken op de partituur: klik = cursor daarheen (▶ speelt vanaf daar; tijdens het spelen meteen daarheen springen),
  // dubbelklik = precies die maat spelen (in selecteermodus: eerste/laatste maat). Klikken mag op een noot of ergens op de balk.
  $('ptSheet').addEventListener('click', e => {
    if (!ptCur || !ptSteps.length || ptDragJust) return;
    const P = ptPosAt(e.clientX, e.clientY, e.target); if (!P) return;
    const i = P.i;
    if (ptSel){ ptSelClick(i); return; }
    const mn = ptSteps[i].mn, s = ptCur.s;
    const was = !!ptRun; if (was) ptStop();
    const go = () => { ptSetPause(i, P.W, 'klik'); if (was) ptPlay(true); else { ptMarkAt(i); ptPlayUI(); } };
    if (mn < s.from || mn > s.to) ptSetBlock(mn, Math.max(mn, Math.min(ptMaxM(), mn + (s.to - s.from)))).then(go);
    else go();
  });
  // de cursor vastpakken en verslepen: hij volgt de muis/vinger, het labeltje toont de maat; loslaten = daar staan (of verder spelen)
  const line = $('ptLine');
  let drag = null;
  const dragEnd = (e, cancel) => {
    if (!drag) return;
    const d = drag; drag = null; line.classList.remove('drag'); document.body.classList.remove('ptdragging');
    try { line.releasePointerCapture(e.pointerId); } catch(x){}
    ptDragJust = true; setTimeout(() => { ptDragJust = false; }, 60);
    const i = !cancel && d.i != null ? d.i : d.start, W = !cancel && d.i != null ? d.W : d.startW;
    if (i == null) return;
    const mn = ptSteps[i].mn, s = ptCur.s;
    const go = () => { ptSetPause(i, W, 'klik'); if (d.was) ptPlay(true); else { ptMarkAt(i, true); $('ptLine').dataset.mn = 'maat ' + mn; ptPlayUI(); } };
    if (mn < s.from || mn > s.to) ptSetBlock(mn, Math.max(mn, Math.min(ptMaxM(), mn + (s.to - s.from)))).then(go);
    else go();
  };
  line.addEventListener('pointerdown', e => {
    if (!ptCur || !ptSteps.length || line.hidden || e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    try { line.setPointerCapture(e.pointerId); } catch(x){}
    const was = !!ptRun;
    let start = ptPausedAt, startW = ptPausedW;
    if (was){ const r = ptRun; startW = r.B.w0 + Math.min(ptRunPos(r), r.B.L - 1e-6); start = ptStepIdx(startW); ptStop(false, true); ptSetPause(start, startW, 'pauze'); }
    drag = { was, start, startW, i:null, W:null };
    if (!ptGeo) ptGeo = ptGeoBuild();
    line.classList.add('paused', 'drag'); document.body.classList.add('ptdragging');
    if (start != null) line.dataset.mn = 'maat ' + ptSteps[start].mn;
  });
  line.addEventListener('pointermove', e => {
    if (!drag) return;
    const P = ptPosAt(e.clientX, e.clientY, null); if (!P) return;
    const i = P.i;
    drag.i = i; drag.W = P.W;
    const g = ptGeo.step[i]; if (!g) return;
    const L = ptGeo.lines[g.line], p = ptToSheet(e.clientX, e.clientY);
    const x = Math.max(ptGeo.step[i].x, Math.min(L.r + 8, p.x));   // vrij met de muis mee, maar binnen de regel
    ptLineSet(line, x, L);
    line.dataset.mn = 'maat ' + ptSteps[i].mn;
  });
  line.addEventListener('pointerup', e => dragEnd(e, false));
  line.addEventListener('pointercancel', e => dragEnd(e, true));
  $('ptSelBtn').onclick = e => { e.currentTarget.blur(); if (ptSel) ptSelCancel(); else { ptSel = { phase:'start' }; ptSelUI(); } };
  $('ptSheet').addEventListener('mousemove', e => {
    if (!ptSel || ptSel.phase !== 'end') return;
    const i = ptStepAt(e.clientX, e.clientY, e.target); if (i == null) return;
    const mn = ptSteps[i].mn; ptDim(Math.min(ptSel.a, mn), Math.max(ptSel.a, mn));
  });
  $('ptSheet').addEventListener('dblclick', e => {
    if (!ptCur || !ptSteps.length || ptSel) return;
    const i = ptStepAt(e.clientX, e.clientY, e.target); if (i == null) return;
    e.preventDefault();
    const mn = ptSteps[i].mn;
    ptStop(); ptPausedAt = null;
    ptSetBlock(mn, mn).then(() => ptPlay());
  });
  let rz = null;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (typeof view === 'undefined' || view !== 'partituren' || !ptCur || !ptSteps.length) return;
      ptGeo = null;
      if (ptFsOn){ if (ptPaged() && ptKey() !== ptKeyNow) ptFsRedraw(); else ptFsLayout(); return; }
      if (Math.abs($('ptSheet').clientWidth - ptW) < 40) return;
      const was = !!ptRun; ptStop(); ptShowSheet().then(() => { if (was) ptPlay(); });
    }, 500);
  });
  document.addEventListener('keydown', e => {
    if (typeof view === 'undefined' || view !== 'partituren' || !ptCur || Keys.blocked(e)) return;
    if (Keys.is(e, 'volscherm')){ e.preventDefault(); if (ptFsOn) ptFsExit(); else ptFsEnter(); return; }
    if (ptSel && e.key === 'Escape'){ e.preventDefault(); ptSelCancel(); return; }
    if (ptFsOn && e.key === 'Escape'){ e.preventDefault(); ptFsExit(); return; }
    if (ptFsOn && (e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)){   // Ctrl + / − / 0: noten groter, kleiner, standaard
      e.preventDefault(); ptFsZoom(e.key === '0' ? 1 / (+ptG.fsZoom || 1) : e.key === '-' || e.key === '_' ? 1 / 1.15 : 1.15); return;
    }
    if (Keys.is(e, 'stop')){ ptStop(); ptPausedAt = null; ptPlayUI(); return; }
    if (Keys.typing()) return;
    if (ptFsOn && ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)){ e.preventDefault(); ptFsTurn(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1); return; }
    if (Keys.is(e, 'volgende')){ e.preventDefault(); ptPasOk(); return; }
    if (Keys.is(e, 'vorige')){ e.preventDefault(); ptPasTooFast(); return; }
    if (Keys.is(e, 'luister') || Keys.is(e, 'pauze')){ e.preventDefault(); ptToggle(); }
    else if (Keys.is(e, 'begin')){ e.preventDefault(); $('ptBegin').click(); }
    else if (Keys.is(e, 'metronoom')){ e.preventDefault(); $('ptMetro').checked = !$('ptMetro').checked; $('ptMetro').onchange(); }
    else if (Keys.is(e, 'sneller')){ e.preventDefault(); ptSetBpm(ptCur.s.bpm + (e.shiftKey ? 5 : 1)); }
    else if (Keys.is(e, 'langzamer')){ e.preventDefault(); ptSetBpm(ptCur.s.bpm - (e.shiftKey ? 5 : 1)); }
  });
}
function ptOnRoute(){
  if (typeof view === 'undefined') return;
  if (view !== 'partituren'){ if (ptFsOn) ptFsExit(true); if (ptRun) ptPause(); return; }
  ptInit();
  if (!ptCur){ ptShow('lib'); ptRenderList(); }
  ptLoadLib().catch(() => {});   // alvast laden
}
if (typeof view !== 'undefined' && view === 'partituren') ptOnRoute();   // direct geopend via #partituren (router liep al vóór dit script)

// D: de notenbibliotheek alvast laden, een paar seconden na het starten van de app (dan is hij er als je een stuk opent)
window.addEventListener('load', () => setTimeout(() => { if (!window.opensheetmusicdisplay) ptLoadLib().catch(() => {}); }, 4000));
// oude cacheversies (bv. tekeningen van OSMD 1) één keer opruimen, rustig na het starten
window.addEventListener('load', () => setTimeout(() => PtDB.cclean(PT_CV), 6000));
