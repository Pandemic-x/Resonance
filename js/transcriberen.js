/* ================= Bladmuziek → Transcriberen (eigen noteneditor, prefix tr, route #transcriberen → #trView) — 22-11-2026 =================
   Wens gebruiker: "een soort eigen MuseScore". Muziek op gehoor uitschrijven, meteen terughoren en met één klik naar Repertoire.
   Fase 1 (deze versie): één notenbalk, één stem (akkoorden mogen), nootwaarden 1/1 t/m 1/32 met punt, rusten, ♯ ♭ ♮, overbindingen,
   akkoordsymbolen (Ctrl+K), waardestrepen en maten vanzelf, ongedaan maken/opnieuw, afspelen met cursor, export MusicXML
   en ➜ Repertoire (kopie; daarna ↻ Bijwerken in Repertoire, passages en aantekeningen blijven staan).
   Later (fase 2/3): pianobalk, triolen, maat-/toonsoortwissel, herhalingen, kopiëren/plakken, transponeren, 2e stem,
   dynamiek/articulatie/bogen/tekst, MusicXML importeren.

   Datamodel (localStorage 'transcripties' = {items:[doc], cur:id}; gaat dus vanzelf mee in back-up en synchronisatie):
     doc = {id, titel, comp, clef, key ('C', 'Bb', 'F#m' …), time:[n, d], pickup (ticks, 0 = geen opmaat), bpm (per tel), n (maten),
            evs:[{t, len, ps:[{l, a, o}], tie}]  ← alleen NOTEN (rusten = gaten), gesorteerd, niet overlappend, nooit over een maatstreep,
            chords:{tick: tekst}, repId (stuk in Repertoire), repAt, made, upd}
     Tijd in ticks: kwartnoot = 48 (Notatie.Q). trNorm() splitst noten over de maatstreep (overgebonden) en rare lengtes in
     gewone nootwaarden; trLayout() maakt per maat de events mét rusten (gaten opgevuld, uitgelijnd op de tel), voor tekenen,
     afspelen en export.
   Invoer zoals MuseScore: N = invoerstand · 2–7 = nootwaarde (2 = 1/32, 3 = 1/16, 4 = 1/8, 5 = 1/4, 6 = 1/2, 7 = 1/1) · . = punt ·
     A–G = noot (voortekening telt mee, octaaf het dichtst bij de vorige noot) · Shift+A–G = noot erbij (akkoord) · 0 = rust ·
     ↑ ↓ = halve toon · Ctrl+↑ ↓ = octaaf · + − = = ♯ ♭ ♮ · T = overbinden · R = herhalen · Alt+2–8 = interval erboven ·
     ← → = vorige/volgende · Ctrl+← → = maat · Delete = rust · Backspace (invoer) = terug · Ctrl+Z / Ctrl+Y = ongedaan / opnieuw ·
     Ctrl+K = akkoordsymbool (Spatie = volgende tel, Tab = volgende maat, Enter = klaar) · Spatie = afspelen/stop · Esc = invoer uit / stop. */

const TR_KEY = 'transcripties', TR_GKEY = 'transcriberen-settings', TQ = 48;
const TR_VALS = [288, 192, 144, 96, 72, 48, 36, 24, 18, 12, 9, 6];
const TR_DOTTED = { 288:1, 144:1, 72:1, 36:1, 18:1, 9:1 };
const TR_DURS = [   // knoppen in het palet; k = MuseScore-toets
  { len:192, k:'7', n:'hele noot' }, { len:96, k:'6', n:'halve noot' }, { len:48, k:'5', n:'kwartnoot' },
  { len:24, k:'4', n:'achtste' }, { len:12, k:'3', n:'zestiende' }, { len:6, k:'2', n:'tweeëndertigste' }
];
const TR_CLEFS = [['g', 'Vioolsleutel'], ['f', 'Bassleutel'], ['c3', 'Altsleutel'], ['c4', 'Tenorsleutel'], ['c1', 'Sopraansleutel']];
const TR_TIMES = [[4,4],[3,4],[2,4],[5,4],[6,4],[2,2],[3,2],[6,8],[9,8],[12,8],[3,8],[5,8],[7,8]];
const TR_REF = { g:71, f:50, c1:67, c2:64, c3:60, c4:57, c5:53 };   // middenlijn: eerste noot komt hier in de buurt
const TR_KLAV = { g:[55, 84], f:[36, 64], c1:[57, 81], c2:[53, 79], c3:[48, 76], c4:[45, 72], c5:[41, 67] };
const TR_LET = ['c','d','e','f','g','a','b'];

let trDB = { items:[], cur:null }, trG = null, trDoc = null, trH = null, trInited = false, trSaveT = null;
let trIn = { on:false, t:0, len:48, dot:false, add:false };   // invoerstand: cursor (tick), gekozen nootwaarde, punt, klavier = akkoord erbij
let trSel = null;              // geselecteerd event: begin-tick (noot of rust)
let trUndo = [], trRedo = [], trPlay = null, trKlav = null, trChEd = null, trResizeT = null, trLastW = 0;

/* ---------- opslag ---------- */
function trDefaults(){ return { zoom:1, inst:'piano', hear:true, metro:false, ci:false, chords:true, klav:true, names:'c' }; }
function trLoad(){
  try { trDB = JSON.parse(localStorage.getItem(TR_KEY)) || { items:[], cur:null }; } catch(e){ trDB = { items:[], cur:null }; }
  if (!Array.isArray(trDB.items)) trDB.items = [];
  let g = {}; try { g = JSON.parse(localStorage.getItem(TR_GKEY)) || {}; } catch(e){}
  trG = Object.assign(trDefaults(), g);
}
function trSaveG(){ try { localStorage.setItem(TR_GKEY, JSON.stringify(trG)); } catch(e){} }
function trSaveNow(){ clearTimeout(trSaveT); try { localStorage.setItem(TR_KEY, JSON.stringify(trDB)); } catch(e){ trMsg('Opslaan lukte niet: de opslag van de browser is vol.', 'bad'); } }
function trSave(){ clearTimeout(trSaveT); trSaveT = setTimeout(trSaveNow, 350); }
const trToday = () => new Date().toLocaleDateString('sv');
const trDay = s => s ? (+s.slice(8)) + '-' + (+s.slice(5, 7)) : '';
const trEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const trCopy = o => JSON.parse(JSON.stringify(o));

function trNewDoc(o){
  return Object.assign({ id:'t' + Date.now().toString(36), titel:'Zonder titel', comp:'', clef:'g', key:'C', time:[4, 4], pickup:0, bpm:80, n:8,
                         evs:[], chords:{}, repId:null, repAt:null, made:trToday(), upd:trToday() }, o || {});
}

/* ---------- maten en tijd ---------- */
const trM = d => Notatie.meter((d || trDoc).time);
function trCap(m, d){ d = d || trDoc; return m === 0 && d.pickup ? d.pickup : trM(d).cap; }
function trStart(m, d){ d = d || trDoc; const c = trM(d).cap; return m <= 0 ? 0 : d.pickup ? d.pickup + (m - 1) * c : m * c; }
function trTotal(d){ d = d || trDoc; return trStart(d.n, d); }
function trMeasOf(t, d){ d = d || trDoc; const c = trM(d).cap; if (d.pickup) return t < d.pickup ? 0 : 1 + Math.floor((t - d.pickup) / c); return Math.floor(t / c); }

// een lengte op plek 'off' in de maat opdelen in gewone nootwaarden (uitgelijnd op de tel; rusten in een enkelvoudige maat zonder punt)
function trDecomp(off, len, M, rest){
  const out = [];
  const ok = (v, o) => {
    const dot = !!TR_DOTTED[v], u = dot ? v / 1.5 : v;
    if (v >= M.beat){
      if (o % M.beat) return false;
      if (rest){ if (u > M.beat && o % u) return false; if (dot && !M.comp) return false; return true; }
      // noot: mag op elke tel beginnen (halve noot op tel 2 in 3/4), maar niet over het midden van een 4/4-maat
      const half = M.cap / 2;
      if (!M.comp && M.n % 2 === 0 && M.n >= 4 && o % half && o < half && o + v > half) return false;
      return true;
    }
    if ((o % M.beat) + v > M.beat) return false;
    if (rest && dot) return false;
    return o % (dot ? u / 2 : u) === 0;
  };
  while (len > 0){
    let v = TR_VALS.find(x => x <= len && ok(x, off));
    if (!v) v = TR_VALS.find(x => x <= len) || len;
    out.push(v); off += v; len -= v;
  }
  return out;
}

// noten opschonen: sorteren, overlap weg, splitsen op de maatstreep en in gewone nootwaarden (met overbinding)
function trNorm(d){
  d = d || trDoc;
  const total = trTotal(d), M = trM(d);
  let evs = (d.evs || []).filter(e => e && e.len > 0 && e.t >= 0 && e.t < total && e.ps && e.ps.length).sort((a, b) => a.t - b.t);
  const clean = [];
  evs.forEach(e => {
    e = { t:e.t, len:Math.min(e.len, total - e.t), ps:e.ps.map(p => ({ l:p.l, a:p.a | 0, o:p.o | 0 })), tie:!!e.tie };
    const last = clean[clean.length - 1];
    if (last && last.t + last.len > e.t){ last.len = e.t - last.t; last.tie = false; if (last.len <= 0) clean.pop(); }
    clean.push(e);
  });
  const out = [];
  clean.forEach(e => {
    let t = e.t, rest = e.len;
    while (rest > 0){
      const m = trMeasOf(t, d), s = trStart(m, d), end = s + trCap(m, d), piece = Math.min(rest, end - t);
      const vals = (piece === e.len && Notatie.LEN_DUR[piece]) ? [piece] : trDecomp(t - s, piece, M, false);
      vals.forEach(v => { out.push({ t, len:v, ps:trCopy(e.ps), tie:true }); t += v; });
      rest -= piece;
    }
    out[out.length - 1].tie = e.tie;
  });
  // overbinding alleen naar een direct volgende noot met (minstens één) dezelfde toonhoogte
  out.forEach((e, i) => {
    if (!e.tie) return;
    const nx = out[i + 1];
    e.tie = !!(nx && nx.t === e.t + e.len && nx.ps.some(q => e.ps.some(p => Notatie.midi(p) === Notatie.midi(q))));
  });
  d.evs = out;
  // akkoordsymbolen buiten het stuk weg
  Object.keys(d.chords || {}).forEach(k => { if (+k >= total || !String(d.chords[k]).trim()) delete d.chords[k]; });
  return d;
}

// per maat de events mét rusten (voor tekenen, afspelen, export)
function trLayout(d){
  d = d || trDoc;
  const M = trM(d), out = [];
  let k = 0;
  for (let m = 0; m < d.n; m++){
    const s = trStart(m, d), cap = trCap(m, d), evs = [];
    let t = s;
    const gap = (a, b) => {
      if (b <= a) return;
      if (a === s && b === s + cap && cap === M.cap && !d.evs.some(e => e.t >= s && e.t < s + cap)){ evs.push({ id:'r' + a, t:a, off:0, len:cap, rest:true, full:true }); return; }
      let o = a - s;
      trDecomp(o, b - a, M, true).forEach(v => { evs.push({ id:'r' + (s + o), t:s + o, off:o, len:v, rest:true }); o += v; });
    };
    while (k < d.evs.length && d.evs[k].t < s + cap){
      const e = d.evs[k];
      gap(t, e.t);
      evs.push({ id:'n' + e.t, t:e.t, off:e.t - s, len:e.len, ps:e.ps, tie:e.tie, ref:e });
      t = e.t + e.len; k++;
    }
    gap(t, s + cap);
    out.push({ m, s, cap, num:d.pickup ? m : m + 1, evs });
  }
  return out;
}
function trFlat(L){ const a = []; (L || trLayout()).forEach(ms => ms.evs.forEach(e => a.push(e))); return a; }
function trEvAt(t, L){ return trFlat(L).find(e => t >= e.t && t < e.t + e.len) || null; }
function trNoteAt(t){ return trDoc.evs.find(e => e.t === t) || null; }

/* ---------- akkoordsymbolen ---------- */
// tekst → {root:{l,a}, id (Theorie.CHORDS), bass, disp} of null (onbekend: dan tonen we de tekst zoals getypt, gestippeld)
const TR_CH_ALIAS = { '':'maj', 'M':'maj', 'maj':'maj', 'Maj':'maj', 'ma':'maj', 'm':'min', 'min':'min', '-':'min', 'mi':'min',
  'dim':'dim', 'o':'dim', '°':'dim', 'aug':'aug', '+':'aug', 'sus2':'sus2', 'sus4':'sus4', 'sus':'sus4',
  '7':'dom7', 'dom7':'dom7', 'maj7':'maj7', 'M7':'maj7', 'Maj7':'maj7', 'ma7':'maj7', 'j7':'maj7', 'Δ':'maj7', 'Δ7':'maj7',
  'm7':'min7', 'min7':'min7', '-7':'min7', 'mi7':'min7', 'ø':'hdim7', 'ø7':'hdim7', 'm7b5':'hdim7', '-7b5':'hdim7', 'm7(b5)':'hdim7',
  'dim7':'dim7', 'o7':'dim7', '°7':'dim7', 'mmaj7':'mmaj7', 'm(maj7)':'mmaj7', 'mM7':'mmaj7', 'm(M7)':'mmaj7', '-maj7':'mmaj7', 'minmaj7':'mmaj7',
  '6':'six', 'M6':'six', 'm6':'min6', '-6':'min6', '9':'dom9', 'maj9':'maj9', 'M9':'maj9', 'Δ9':'maj9', 'm9':'min9', '-9':'min9',
  '7b9':'dom7b9', '7(b9)':'dom7b9', '7#9':'dom7s9', '7(#9)':'dom7s9', '11':'dom11', '13':'dom13', 'add9':'add9', 'add2':'add9',
  'madd9':'madd9', 'm(add9)':'madd9', '-add9':'madd9', '6/9':'six9', '69':'six9', '7sus4':'sus7', '7sus':'sus7', '9sus4':'sus9', '9sus':'sus9',
  '7#5':'aug7', '+7':'aug7', 'aug7':'aug7', '7+5':'aug7', '7(#5)':'aug7', '7b5':'dom7b5', '7(b5)':'dom7b5', 'maj7#5':'augmaj7', '+maj7':'augmaj7', 'M7#5':'augmaj7',
  'maj7#11':'maj7s11', 'M7#11':'maj7s11', '7#11':'dom7s11', 'm11':'min11', '-11':'min11', 'maj13':'maj13', 'M13':'maj13', 'm13':'min13', '-13':'min13' };
function trChordParse(txt){
  const s = String(txt || '').trim().replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\s+/g, '');
  const m = /^([A-Ga-g])([#b]?)(.*?)(?:\/([A-Ga-g])([#b]?))?$/.exec(s);
  if (!m) return null;
  const q = m[3], id = TR_CH_ALIAS[q] || TR_CH_ALIAS[q.toLowerCase()];
  if (!id) return null;
  const c = Theorie.CHORDS.find(x => x.id === id); if (!c) return null;
  const root = { l:m[1].toLowerCase(), a:m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0 };
  const bass = m[4] ? { l:m[4].toLowerCase(), a:m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0 } : null;
  const nm = r => r.l.toUpperCase() + (r.a > 0 ? '♯' : r.a < 0 ? '♭' : '');
  return { root, id, c, bass, disp:nm(root) + c.sym + (bass ? '/' + nm(bass) : '') };
}
function trChordDisp(txt){ const p = trChordParse(txt); return p ? p.disp : String(txt).replace(/([A-G])b/g, '$1♭').replace(/([A-G])#/g, '$1♯'); }
// tonen van een akkoordsymbool (midi): bas laag, akkoord rond de middelste C
function trChordMidis(txt){
  const p = trChordParse(txt); if (!p) return null;
  const tones = Theorie.spell(p.root, p.c.offs, p.c.semis, 2); if (!tones) return null;
  const pc = n => ((Notatie.NAT[n.l] + n.a) % 12 + 12) % 12;
  let base = 48 + pc(p.root); if (base > 54) base -= 12;          // grondtoon tussen F♯3 en F♯4 (één octaaf lager), akkoord daarboven
  const up = p.c.semis.slice(0, 5).map(s => base + 12 + s);
  let bass = 36 + (p.bass ? pc(p.bass) : pc(p.root)); if (bass < 40) bass += 12;   // bas tussen E2 en D♯3
  return [bass].concat(up);
}

/* ---------- toonhoogte ---------- */
const trMidi = p => Notatie.midi(p);
function trRefMidi(){
  const t = trIn.on ? trIn.t : (trSel != null ? trSel + 1 : 0);
  let ref = null;
  trDoc.evs.forEach(e => { if (e.t < t) ref = e.ps[e.ps.length - 1]; });
  if (!trIn.on && trSel != null){ const e = trNoteAt(trSel); if (e) ref = e.ps[e.ps.length - 1]; }
  return ref ? trMidi(ref) : (TR_REF[trDoc.clef] || 71);
}
function trNearest(l, a, ref, above){
  let best = null;
  for (let o = 0; o <= 8; o++){
    const p = { l, a, o }, m = trMidi(p);
    if (m < 21 || m > 108) continue;
    if (above != null && m <= above) continue;
    const dd = above != null ? m - above : Math.abs(m - ref);
    if (!best || dd < best.d) best = { p, d:dd };
  }
  return best ? best.p : { l, a, o:4 };
}
// halve toon omhoog/omlaag, met een gewone spelling (omhoog liefst ♯, omlaag liefst ♭)
function trStep(p, dir){
  const m = trMidi(p) + dir, pc = ((m % 12) + 12) % 12;
  const c = TR_LET.map(l => { const a = ((pc - Notatie.NAT[l]) % 12 + 18) % 12 - 6; return { l, a }; })
    .filter(c => Math.abs(c.a) <= 1 && !(c.a === 1 && (c.l === 'e' || c.l === 'b')) && !(c.a === -1 && (c.l === 'c' || c.l === 'f')));
  const sig = Notatie.keySig(trDoc.key);
  const pick = c.find(x => x.a === sig[x.l] && x.a !== 0) || c.find(x => x.a === 0) || c.find(x => x.a === (dir > 0 ? 1 : -1)) || c[0];
  return { l:pick.l, a:pick.a, o:Math.round((m - pick.a - Notatie.NAT[pick.l]) / 12) - 1 };
}
const trPName = p => Notatie.name(p, 'nl', true);

/* ---------- bewerken (met ongedaan maken) ---------- */
function trSnap(){ return JSON.stringify({ evs:trDoc.evs, chords:trDoc.chords, n:trDoc.n, time:trDoc.time, pickup:trDoc.pickup, key:trDoc.key, clef:trDoc.clef }); }
function trDo(fn){
  const before = trSnap();
  fn();
  trNorm();
  if (trSnap() === before) return false;
  trUndo.push(before); if (trUndo.length > 300) trUndo.shift(); trRedo = [];
  trDoc.upd = trToday(); trSave(); trRender();
  return true;
}
function trRestore(s){ const o = JSON.parse(s); Object.assign(trDoc, o); trNorm(); trDoc.upd = trToday(); trSave(); trRender(); }
function trUndoDo(){ if (!trUndo.length){ trMsg('Niets meer om ongedaan te maken.', 'muted'); return; } trRedo.push(trSnap()); trRestore(trUndo.pop()); trMsg('↶ Ongedaan gemaakt.', 'muted'); }
function trRedoDo(){ if (!trRedo.length) return; trUndo.push(trSnap()); trRestore(trRedo.pop()); trMsg('↷ Opnieuw gedaan.', 'muted'); }

// gebied [t, t+len) overschrijven met een noot (ps) of rust (ps = null), zoals MuseScore; maten erbij als het niet past
function trPut(t, len, ps, tie){
  while (t + len > trTotal()) trDoc.n++;
  trDoc.evs = trDoc.evs.filter(e => !(e.t >= t && e.t < t + len)).map(e => (e.t < t && e.t + e.len > t) ? Object.assign({}, e, { len:t - e.t, tie:false }) : e);
  if (ps && ps.length) trDoc.evs.push({ t, len, ps:trCopy(ps), tie:!!tie });
}
const trCurLen = () => trIn.dot ? trIn.len * 1.5 : trIn.len;
function trHear(ps){
  if (!trG.hear || !ps || !ps.length || trPlay) return;
  try { ensureCtx(); const t = actx.currentTime + .02; ps.forEach(p => Engine.note(t, trMidi(p), .7, { inst:trG.inst, vol:.5 / Math.sqrt(ps.length) })); } catch(e){}
}

// noot (of rust) invoeren op de cursor; tie = aan de vorige noot overbinden (T in de invoerstand)
function trEnter(ps, tie){
  const t = trIn.t, len = trCurLen();
  trDo(() => {
    trPut(t, len, ps, false);
    if (tie){ const prev = trDoc.evs.find(e => e.t + e.len === t); if (prev) prev.tie = true; }
  });
  trSel = ps ? t : null;
  trIn.t = Math.min(t + len, trTotal());
  if (trIn.t >= trTotal()){ trDoc.n++; trNorm(); trSave(); }   // er is altijd een lege maat om verder te typen
  trHear(ps); trRender(); trScrollTo(trIn.t);
}
function trLetter(l, shift){
  if (!trDoc) return;
  const sig = Notatie.keySig(trDoc.key);
  if (shift){   // noot erbij in het akkoord (boven de bovenste noot)
    const e = trNoteAt(trSel); if (!e){ trMsg('Kies eerst een noot (of voer er een in) om een toon bij te zetten.', 'muted'); return; }
    const top = Math.max(...e.ps.map(trMidi)), p = trNearest(l, sig[l], top, top);
    if (e.ps.some(q => trMidi(q) === trMidi(p))) return;
    trDo(() => trChain(e.t).forEach(x => { const r = trDoc.evs.find(y => y.t === x.t); if (r) r.ps.push(trCopy(p)); }));
    trHear(e.ps.concat([p])); return;
  }
  const p = trNearest(l, sig[l], trRefMidi());
  if (trIn.on){ trEnter([p]); return; }
  if (trSel == null){ trStartInput(); trEnter([p]); return; }
  const e = trEvAt(trSel); if (!e) return;
  trDo(() => trPut(e.t, e.len, [p], false));
  trSel = e.t; trHear([p]);
}
// de hele overbonden reeks vanaf t (zelfde akkoord over de maatstreep)
function trChain(t){
  const out = []; let e = trNoteAt(t);
  while (e){ out.push(e); if (!e.tie) break; e = trNoteAt(e.t + e.len); }
  return out;
}
function trSelNote(){ return trSel != null ? trNoteAt(trSel) : null; }
function trPitch(fn, label){
  const e = trSelNote(); if (!e){ trMsg('Kies eerst een noot.', 'muted'); return; }
  let np = null;
  trDo(() => { const r = trDoc.evs.find(x => x.t === e.t); r.ps = r.ps.map(fn); np = r.ps; });
  trHear(np);
  if (label) trMsg(label, 'muted');
}
function trAcc(a){ trPitch(p => ({ l:p.l, a, o:p.o })); }
function trInterval(n){
  const e = trSelNote(); if (!e) return;
  const top = e.ps.slice().sort((x, y) => trMidi(x) - trMidi(y)).pop();
  const i = TR_LET.indexOf(top.l) + n - 1, l = TR_LET[i % 7], o = top.o + Math.floor(i / 7), p = { l, a:Notatie.keySig(trDoc.key)[l], o };
  if (trMidi(p) > 108 || e.ps.some(q => trMidi(q) === trMidi(p))) return;
  trDo(() => { const r = trDoc.evs.find(x => x.t === e.t); r.ps.push(p); });
  trHear(e.ps.concat([p]));
}
function trSetLen(len){
  if (trIn.on){ trIn.len = len; trIn.dot = false; trPalUI(); return; }
  const e = trSel != null ? trEvAt(trSel) : null;
  trIn.len = len; trIn.dot = false;
  if (!e){ trPalUI(); return; }
  trDo(() => trPut(e.t, len, e.rest ? null : e.ps, e.tie));
  trPalUI();
}
function trToggleDot(){
  if (trIn.on || trSel == null){ trIn.dot = !trIn.dot; if (trIn.dot && !Notatie.LEN_DUR[trIn.len * 1.5]) trIn.dot = false; trPalUI(); return; }
  const e = trEvAt(trSel); if (!e) return;
  const nl = TR_DOTTED[e.len] ? e.len / 1.5 : e.len * 1.5;
  if (!Notatie.LEN_DUR[nl]) return;
  trDo(() => trPut(e.t, nl, e.rest ? null : e.ps, e.tie));
}
function trRest(){
  if (trIn.on){ trEnter(null); return; }
  const e = trSel != null ? trEvAt(trSel) : null; if (!e || e.rest) return;
  trDo(() => { trDoc.evs = trDoc.evs.filter(x => x.t !== e.t); });
}
function trTie(){
  if (trIn.on){   // zoals MuseScore: dezelfde toon nog eens, overgebonden aan de vorige
    const prev = trDoc.evs.filter(x => x.t < trIn.t).pop();
    if (!prev || prev.t + prev.len !== trIn.t){ trMsg('Overbinden kan alleen direct na een noot.', 'muted'); return; }
    trEnter(prev.ps, true); return;
  }
  const e = trSelNote(); if (!e) return;
  const nx = trNoteAt(e.t + e.len);
  if (!e.tie && !(nx && nx.ps.some(q => e.ps.some(p => trMidi(p) === trMidi(q))))){ trMsg('De volgende noot moet dezelfde toon hebben om over te binden.', 'muted'); return; }
  trDo(() => { const r = trDoc.evs.find(x => x.t === e.t); r.tie = !r.tie; });
}
function trRepeat(){
  const src = trIn.on ? trDoc.evs.filter(x => x.t < trIn.t).pop() : trSelNote();
  if (!src){ return; }
  if (trIn.on){ const keep = trIn.len, kd = trIn.dot; trIn.len = src.len; trIn.dot = false; trEnter(src.ps); trIn.len = keep; trIn.dot = kd; return; }
  const t = src.t + src.len; trDo(() => trPut(t, src.len, src.ps, false)); trSel = t; trHear(src.ps);
}
function trDelete(){
  if (trIn.on){   // terug: vorige event wordt rust, cursor erheen
    const f = trFlat(), prev = f.filter(e => e.t < trIn.t).pop(); if (!prev) return;
    trDo(() => { trDoc.evs = trDoc.evs.filter(x => x.t !== prev.t); });
    trIn.t = prev.t; trSel = null; trRender(); return;
  }
  trRest();
}
function trMove(dir, measure){
  const f = trFlat();
  if (measure){
    const cur = trIn.on ? trIn.t : (trSel != null ? trSel : 0), m = Math.max(0, Math.min(trDoc.n - 1, trMeasOf(cur) + dir)), t = trStart(m);
    if (trIn.on) trIn.t = t; else trSel = t;
    trRender(); trScrollTo(t); return;
  }
  if (trIn.on){
    const i = f.findIndex(e => e.t >= trIn.t);
    const ni = dir > 0 ? (i < 0 ? f.length : i + 1) : (i < 0 ? f.length - 1 : i - 1);
    trIn.t = ni >= f.length ? trTotal() : f[Math.max(0, ni)].t;
    if (trIn.t >= trTotal()){ trIn.t = trTotal(); }
    trRender(); trScrollTo(trIn.t); return;
  }
  if (trSel == null){ trSel = f.length ? f[dir > 0 ? 0 : f.length - 1].t : null; }
  else { const i = f.findIndex(e => e.t === trSel); const ni = Math.max(0, Math.min(f.length - 1, i + dir)); trSel = f[ni].t; }
  const e = trSelNote(); if (e) trHear(e.ps);
  trRender(); trScrollTo(trSel);
}
function trStartInput(t){
  if (t == null){
    if (trSel != null) t = trSel;
    else { const last = trDoc.evs[trDoc.evs.length - 1]; t = last ? last.t + last.len : 0; }
  }
  trIn.on = true; trIn.t = Math.min(t, trTotal()); trSel = null;
  if (trIn.t >= trTotal()){ trDoc.n++; trNorm(); trSave(); }
  trRender();
}
function trStopInput(){ if (!trIn.on) return; trIn.on = false; const prev = trDoc.evs.filter(e => e.t < trIn.t).pop(); trSel = prev ? prev.t : null; trRender(); }
function trMeasures(delta){
  if (delta > 0){ trDo(() => { trDoc.n += delta; }); return; }
  if (trDoc.n <= 1) return;
  const s = trStart(trDoc.n - 1), has = trDoc.evs.some(e => e.t + e.len > s) || Object.keys(trDoc.chords).some(k => +k >= s);
  const b = $('trMeasMinus');
  if (has && !b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; setTimeout(() => { b.classList.remove('arm'); b.textContent = '−'; }, 3000); return; }
  b.classList.remove('arm'); b.textContent = '−';
  trDo(() => { trDoc.evs = trDoc.evs.filter(e => e.t < s).map(e => e.t + e.len > s ? Object.assign({}, e, { len:s - e.t, tie:false }) : e); trDoc.n--; });
  if (trIn.t > trTotal()) trIn.t = trTotal();
  if (trSel != null && trSel >= trTotal()) trSel = null;
}

/* ---------- akkoordsymbool invoeren (Ctrl+K) ---------- */
function trChordOpen(t){
  if (!trDoc) return;
  if (t == null) t = trIn.on ? Math.min(trIn.t, trTotal() - 1) : (trSel != null ? trSel : 0);
  if (t >= trTotal()) t = Math.max(0, trTotal() - 1);
  trChEd = { t };
  trRender();
}
function trChordPlace(){
  const inp = $('trChIn');
  if (!trChEd || !trH || !trH.svg){ inp.hidden = true; return; }
  const t = trChEd.t, m = trMeasOf(t), g = trH.meas[m]; if (!g){ inp.hidden = true; return; }
  const x = trH.xAt(m, t - trStart(m)), y = trH.sys[g.sys].chordY;
  const wrap = $('trSheetWrap'), sr = trH.svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  inp.style.left = (sr.left - wr.left + wrap.scrollLeft + x * trH.scale - 4) + 'px';
  inp.style.top = (sr.top - wr.top + wrap.scrollTop + (y - 15) * trH.scale) + 'px';
  inp.hidden = false;
  if (document.activeElement !== inp){ inp.value = trDoc.chords[t] || ''; inp.focus(); inp.select(); }
  trChordHint();
}
function trChordHint(){
  const v = $('trChIn').value.trim(), p = trChordParse(v);
  $('trChIn').classList.toggle('bad', !!v && !p);
  trStatus(v ? (p ? 'Akkoord: <b>' + trEsc(p.disp) + '</b> · ' + trEsc(p.c.nl) + (p.bass ? ', bas ' + trEsc(p.disp.split('/')[1]) : '') : 'Onbekend akkoord: wordt als tekst bewaard (afspelen kan dan niet)') + ' · Spatie = volgende tel, Tab = volgende maat, Enter = klaar, Esc = annuleren'
    : 'Typ een akkoord, bv. <b>Am7</b>, <b>Bbmaj7</b>, <b>F#m7b5</b>, <b>G7/B</b>, <b>Dsus4</b> · leeg = weghalen');
}
function trChordCommit(){
  if (!trChEd) return;
  const t = trChEd.t, v = $('trChIn').value.trim();
  trDo(() => { if (v) trDoc.chords[t] = v; else delete trDoc.chords[t]; });
  if (v && trG.chords && !trPlay){ const ms = trChordMidis(v); if (ms){ try { ensureCtx(); const at = actx.currentTime + .02; ms.forEach((m, i) => Engine.note(at, m, 1, { inst:trG.inst, vol:i ? .16 : .22 })); } catch(e){} } }
}
function trChordKey(e){
  if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); trChEd = null; $('trChIn').hidden = true; trRender(); return; }
  if (e.key === 'Enter'){ e.preventDefault(); trChordCommit(); trChEd = null; $('trChIn').hidden = true; trRender(); return; }
  if (e.key === ' ' || e.key === 'Tab'){
    e.preventDefault(); trChordCommit();
    const t = trChEd.t, M = trM(), m = trMeasOf(t), s = trStart(m);
    let nt;
    if (e.key === 'Tab') nt = e.shiftKey ? trStart(Math.max(0, m - 1)) : trStart(m + 1);
    else nt = e.shiftKey ? Math.max(0, s + Math.ceil((t - s) / M.beat - 1) * M.beat) : s + (Math.floor((t - s) / M.beat) + 1) * M.beat;
    if (nt >= trTotal()){ trDo(() => { trDoc.n++; }); }
    trChEd = { t:Math.max(0, nt) }; $('trChIn').value = trDoc.chords[trChEd.t] || '';
    trRender(); $('trChIn').select(); return;
  }
  e.stopPropagation();
}

/* ---------- tekenen ---------- */
function trRender(){
  if (!trDoc || !$('trSheet')) return;
  const L = trLayout(), el = $('trSheet');
  const chords = Object.keys(trDoc.chords).map(k => { const t = +k, m = trMeasOf(t); return { m, off:t - trStart(m), text:trChordDisp(trDoc.chords[k]), bad:!trChordParse(trDoc.chords[k]), id:t }; })
    .filter(c => !(trChEd && c.id === trChEd.t));
  const w = Math.max(300, $('trSheetWrap').clientWidth - 8);
  trLastW = $('trSheetWrap').clientWidth;
  trH = Notatie.score(el, { clef:trDoc.clef, key:trDoc.key, time:trDoc.time, measures:L.map(ms => ({ num:ms.num, cap:ms.cap, evs:ms.evs })), chords, width:w, zoom:trG.zoom });
  if (!trH.svg){ trPalUI(); return; }
  // selectie en invoercursor
  const sel = trSel != null ? trEvAt(trSel, L) : null;
  if (sel){ trH.mark(sel.id, 'sel'); if (!sel.rest) trChain(sel.t).slice(1).forEach(x => trH.mark('n' + x.t, 'sel2')); }
  const lay = trH.layer, NS = 'http://www.w3.org/2000/svg';
  if (trIn.on){
    const t = Math.min(trIn.t, trTotal()), atEnd = t >= trTotal();
    const m = atEnd ? trDoc.n - 1 : trMeasOf(t), g = trH.meas[m];
    if (g){
      const x = atEnd ? g.x + g.w - 12 : trH.xAt(m, t - trStart(m));
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x - 5); r.setAttribute('y', g.top - 14); r.setAttribute('width', 18); r.setAttribute('height', 68); r.setAttribute('rx', 4);
      r.setAttribute('class', 'trcurbox'); lay.appendChild(r);
    }
  }
  if (trChEd){
    const m = trMeasOf(trChEd.t), g = trH.meas[m];
    if (g){ const x = trH.xAt(m, trChEd.t - trStart(m)); const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x - 3); r.setAttribute('y', g.top - 4); r.setAttribute('width', 3); r.setAttribute('height', 48); r.setAttribute('class', 'trchmark'); lay.appendChild(r); }
  }
  trH.chordEls.forEach(c => { c.el.addEventListener('click', ev => { ev.stopPropagation(); trChordOpen(+c.id); }); });
  trPalUI();
  if (trChEd) trChordPlace(); else $('trChIn').hidden = true;
}
function trScrollTo(t){
  if (!trH || !trH.svg || t == null) return;
  const m = Math.min(trDoc.n - 1, trMeasOf(Math.min(t, trTotal() - 1))), g = trH.meas[m]; if (!g) return;
  const wrap = $('trSheetWrap'), sr = trH.svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  const y = sr.top - wr.top + wrap.scrollTop + trH.sys[g.sys].y0 * trH.scale, y2 = sr.top - wr.top + wrap.scrollTop + trH.sys[g.sys].y1 * trH.scale;
  if (y < wrap.scrollTop + 4) wrap.scrollTop = Math.max(0, y - 10);
  else if (y2 > wrap.scrollTop + wrap.clientHeight - 4) wrap.scrollTop = y2 - wrap.clientHeight + 14;
}

/* ---------- palet, status en klavier ---------- */
function trDurIcon(len, dotted){
  // klein nootje als SVG (kop, steel, vlaggen), in currentColor
  const flags = { 24:1, 12:2, 6:3 }[len] || 0, open = len >= 96, stem = len < 192;
  let s = '<svg class="trdi" viewBox="0 0 20 26" aria-hidden="true"><ellipse cx="7" cy="20" rx="5" ry="3.6" transform="rotate(-20 7 20)" ' + (open ? 'fill="none" stroke="currentColor" stroke-width="1.6"' : 'fill="currentColor"') + '/>';
  if (stem) s += '<path d="M11.4 19V3" stroke="currentColor" stroke-width="1.5"/>';
  for (let i = 0; i < flags; i++) s += '<path d="M11.4 ' + (3 + i * 4.5) + 'c1 3 6 3.5 5 8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>';
  if (dotted) s += '<circle cx="17" cy="20" r="1.6" fill="currentColor"/>';
  return s + '</svg>';
}
function trPalUI(){
  if (!$('trDurs')) return;
  const sel = !trIn.on && trSel != null ? trEvAt(trSel) : null;
  const shownLen = sel ? (TR_DOTTED[sel.len] ? sel.len / 1.5 : sel.len) : trIn.len, shownDot = sel ? !!TR_DOTTED[sel.len] : trIn.dot;
  $('trDurs').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.len === shownLen && !(sel && sel.full)));
  $('trDot').classList.toggle('on', shownDot);
  $('trInBtn').classList.toggle('on', trIn.on);
  $('trInBtn').innerHTML = trIn.on ? '✎ Invoeren <small>aan</small>' : '✎ Invoeren';
  $('trAddBtn').classList.toggle('on', trIn.add);
  $('trUndoBtn').disabled = !trUndo.length; $('trRedoBtn').disabled = !trRedo.length;
  $('trMeasN').textContent = trDoc ? trDoc.n : '';
  $('trView').classList.toggle('trinput', trIn.on);
  if (!trChEd) trStatus(trStatusText(sel));
  trRepUI();
}
function trBeatLabel(t){
  const m = trMeasOf(t), M = trM(), off = t - trStart(m) + (m === 0 && trDoc.pickup ? M.cap - trDoc.pickup : 0);
  const b = off / M.beat, whole = Math.floor(b), frac = b - whole;
  const fr = frac === 0 ? '' : Math.abs(frac - .5) < 1e-9 ? '½' : Math.abs(frac - .25) < 1e-9 ? '¼' : Math.abs(frac - .75) < 1e-9 ? '¾' : '+';
  return 'maat ' + (trDoc.pickup ? m : m + 1) + ', tel ' + (whole + 1) + fr;
}
function trLenName(len){ const base = TR_DOTTED[len] ? len / 1.5 : len, d = TR_DURS.find(x => x.len === base); return (TR_DOTTED[len] ? 'gepunteerde ' : '') + (d ? d.n : len + ' ticks'); }
function trStatusText(sel){
  if (!trDoc) return '';
  if (trIn.on){
    const t = Math.min(trIn.t, trTotal());
    return '<b>Invoeren</b> · ' + trLenName(trCurLen()) + ' · ' + (t >= trTotal() ? 'einde' : trBeatLabel(t)) + ' · typ A–G (Shift = erbij), 0 = rust, 2–7 = nootwaarde, . = punt, T = overbinden, Esc = klaar';
  }
  if (sel){
    if (sel.rest) return '<b>Rust</b> (' + (sel.full ? 'hele maat' : trLenName(sel.len)) + ') · ' + trBeatLabel(sel.t) + ' · typ een letter om er een noot van te maken';
    return '<b>' + sel.ps.map(trPName).join(' · ') + '</b> · ' + trLenName(sel.len) + (sel.tie ? ' · overgebonden' : '') + ' · ' + trBeatLabel(sel.t) + ' · ↑↓ halve toon, Ctrl+↑↓ octaaf, Shift+letter = toon erbij';
  }
  return 'Klik op een noot om hem te kiezen, of druk op <b>N</b> (of ✎ Invoeren) om noten te typen. Ctrl+K = akkoordsymbool.';
}
function trStatus(html){ const el = $('trStatus'); if (el) el.innerHTML = html; }
function trMsg(html, cls){ const el = $('trMsg'); if (!el) return; el.innerHTML = html || ''; el.className = 'trmsg' + (cls ? ' ' + cls : ''); clearTimeout(trMsg.t); if (html) trMsg.t = setTimeout(() => { el.innerHTML = ''; }, 5000); }
function trKlavBuild(){
  const box = $('trKlav'); if (!box) return;
  box.hidden = !trG.klav; $('trKlavRow').hidden = !trG.klav;
  if (!trG.klav || !trDoc) return;
  const r = TR_KLAV[trDoc.clef] || TR_KLAV.g;
  if (!trKlav) trKlav = Notatie.klavier(box, { lo:r[0], hi:r[1], names:trG.names, onKey:trKlavKey });
  else trKlav.set({ lo:r[0], hi:r[1], names:trG.names });
}
function trKlavKey(m){
  if (!trDoc) return;
  const p = Notatie.spell(m, trDoc.key);
  if (trIn.add){   // bij de gekozen / laatst ingevoerde noot zetten
    const e = trSelNote(); if (!e){ trMsg('Kies eerst een noot om een toon bij te zetten.', 'muted'); return; }
    if (e.ps.some(q => trMidi(q) === m)) return;
    trDo(() => trChain(e.t).forEach(x => { const r = trDoc.evs.find(y => y.t === x.t); if (r) r.ps.push(trCopy(p)); }));
    trHear(trSelNote().ps); return;
  }
  if (trIn.on){ trEnter([p]); return; }
  if (trSel == null){ trStartInput(); trEnter([p]); return; }
  const e = trEvAt(trSel); if (!e) return;
  trDo(() => trPut(e.t, e.len, [p], false)); trHear([p]);
}

/* ---------- klikken op de partituur ---------- */
function trSheetClick(ev){
  if (!trH || !trDoc) return;
  if (trChEd){ trChordCommit(); trChEd = null; }
  const a = trH.at(ev.clientX, ev.clientY);
  if (!a){ if (!trIn.on){ trSel = null; trRender(); } return; }
  const L = trLayout(), ms = L[a.m], e = ms && ms.evs[a.i];
  if (!e){ return; }
  if (trIn.on){   // zoals MuseScore: klik = noot op die plek en die hoogte
    const st = Notatie.atPos(a.pos, trDoc.clef), sig = Notatie.keySig(trDoc.key), p = { l:st.l, a:sig[st.l], o:st.o };
    if (trMidi(p) < 21 || trMidi(p) > 108) return;
    trIn.t = e.t; trEnter([p]); return;
  }
  trSel = e.t;
  if (!e.rest) trHear(e.ps);
  trRender();
}
function trSheetDbl(ev){
  if (!trH || trIn.on) return;
  const a = trH.at(ev.clientX, ev.clientY); if (!a) return;
  const e = trLayout()[a.m].evs[a.i]; if (e) trStartInput(e.t);
}

/* ---------- afspelen ---------- */
function trPlayStart(from){
  if (!trDoc) return;
  trPlayStop();
  ensureCtx();
  const M = trM(), spt = 60 / Math.max(20, trDoc.bpm) / M.beat, f = trFlat();
  if (from == null) from = trIn.on ? Math.min(trIn.t, trTotal() - 1) : (trSel != null ? trSel : 0);
  const fe = f.find(e => from >= e.t && from < e.t + e.len); if (fe) from = fe.t;
  const lead = trG.ci ? trCap(Math.max(1, Math.min(trDoc.n - 1, 1))) : 0;
  const t0 = actx.currentTime + .12 + lead * spt;
  const at = tick => t0 + (tick - from) * spt;
  // noten (overbindingen samen als één lange toon)
  const tiedIn = new Set();
  trDoc.evs.forEach(e => {
    if (e.t < from && !(e.t + e.len > from)) return;
    e.ps.forEach(p => {
      const m = trMidi(p), k = e.t + ':' + m; if (tiedIn.has(k)) return;
      let end = e.t + e.len, cur = e;
      while (cur.tie){ const nx = trNoteAt(cur.t + cur.len); if (!nx || !nx.ps.some(q => trMidi(q) === m)) break; tiedIn.add(nx.t + ':' + m); end = nx.t + nx.len; cur = nx; }
      const st = Math.max(e.t, from);
      Engine.note(at(st), m, Math.max(.12, (end - st) * spt * .96), { inst:trG.inst, vol:.5 / Math.sqrt(Math.max(1, e.ps.length)) });
    });
  });
  // akkoordsymbolen meespelen
  if (trG.chords){
    const ks = Object.keys(trDoc.chords).map(Number).sort((a, b) => a - b);
    ks.forEach((k, i) => {
      const nx = i + 1 < ks.length ? ks[i + 1] : trTotal(); if (nx <= from) return;
      const ms = trChordMidis(trDoc.chords[k]); if (!ms) return;
      const st = Math.max(k, from), d = Math.max(.2, (nx - st) * spt * .97);
      ms.forEach((m, j) => Engine.note(at(st), m, d, { inst:trG.inst, vol:j ? .1 : .16 }));
    });
  }
  // metronoom (en aftellen)
  if (trG.metro || lead){
    for (let tk = Math.ceil((from - lead) / M.beat) * M.beat - (trDoc.pickup ? (trDoc.pickup % M.beat) : 0); tk < trTotal(); tk += M.beat){
      if (tk < from - lead) continue;
      if (tk >= from && !trG.metro) break;
      const m = tk < from ? -1 : trMeasOf(tk), first = tk < from ? ((tk - (from - lead)) % trM().cap === 0) : tk === trStart(m);
      Engine.click(at(tk), first ? 'accent' : 'beat', .05, true);
    }
  }
  const end = trTotal();
  trPlay = { from, t0, spt, cur:null, raf:0, end };
  $('trPlayBtn').textContent = '■ Stop'; $('trPlayBtn').classList.add('on');
  const loop = () => {
    if (!trPlay) return;
    const lat = (actx.outputLatency || 0);
    const tick = trPlay.from + (actx.currentTime - lat - trPlay.t0) / trPlay.spt;
    if (tick >= trPlay.end){ trPlayStop(); return; }
    const e = tick >= trPlay.from ? f.find(x => tick >= x.t && tick < x.t + x.len) : null;
    const id = e ? e.id : null;
    if (id !== trPlay.cur && trH){
      if (trPlay.cur) trH.unmark(trPlay.cur, 'cur');
      if (id){ trH.mark(id, 'cur'); trScrollTo(e.t); }
      trPlay.cur = id;
    }
    trPlay.raf = requestAnimationFrame(loop);
  };
  trPlay.raf = requestAnimationFrame(loop);
}
function trPlayStop(){
  if (!trPlay) return;
  cancelAnimationFrame(trPlay.raf);
  if (trH && trPlay.cur) trH.unmark(trPlay.cur, 'cur');
  trPlay = null;
  try { Engine.stopNotes(); } catch(e){}
  if ($('trPlayBtn')){ $('trPlayBtn').textContent = '▶ Afspelen'; $('trPlayBtn').classList.remove('on'); }
}

/* ---------- MusicXML ---------- */
const TR_KIND = { maj:['major'], min:['minor'], dim:['diminished'], aug:['augmented'], sus2:['suspended-second'], sus4:['suspended-fourth'],
  dom7:['dominant'], maj7:['major-seventh'], min7:['minor-seventh'], hdim7:['half-diminished'], dim7:['diminished-seventh'], mmaj7:['major-minor'],
  six:['major-sixth'], min6:['minor-sixth'], dom9:['dominant-ninth'], maj9:['major-ninth'], min9:['minor-ninth'], dom11:['dominant-11th'], dom13:['dominant-13th'],
  min11:['minor-11th'], maj13:['major-13th'], min13:['minor-13th'],
  dom7b9:['dominant', [9, -1, 'add']], dom7s9:['dominant', [9, 1, 'add']], add9:['major', [9, 0, 'add']], madd9:['minor', [9, 0, 'add']],
  six9:['major-sixth', [9, 0, 'add']], sus7:['suspended-fourth', [7, -1, 'add']], sus9:['suspended-fourth', [7, -1, 'add'], [9, 0, 'add']],
  aug7:['augmented-seventh'], dom7b5:['dominant', [5, -1, 'alter']], augmaj7:['major-seventh', [5, 1, 'alter']],
  maj7s11:['major-seventh', [11, 1, 'add']], dom7s11:['dominant', [11, 1, 'add']] };
const TR_TYPE = { 192:'whole', 96:'half', 48:'quarter', 24:'eighth', 12:'16th', 6:'32nd' };
const TR_XCLEF = { g:['G', 2], f:['F', 4], c1:['C', 1], c2:['C', 2], c3:['C', 3], c4:['C', 4], c5:['C', 5] };
function trXML(d){
  d = d || trDoc;
  const x = s => trEsc(s).replace(/'/g, '&apos;');
  const L = trLayout(d), M = trM(d), sig = Notatie.keySig(d.key), fifths = Notatie.fifths(d.key), minor = /m$/.test(d.key);
  const cl = TR_XCLEF[d.clef] || TR_XCLEF.g;
  const instr = d.clef === 'g' ? 'Viool' : d.clef === 'c3' ? 'Altviool' : d.clef === 'f' ? 'Cello' : 'Partij';
  const harmony = (txt, off) => {
    const p = trChordParse(txt), offX = off ? '<offset>' + off + '</offset>' : '';
    if (!p) return '<direction placement="above"><direction-type><words>' + x(txt) + '</words></direction-type>' + offX + '</direction>';
    const k = TR_KIND[p.id] || ['major'], st = r => '<root-step>' + r.l.toUpperCase() + '</root-step>' + (r.a ? '<root-alter>' + r.a + '</root-alter>' : '');
    let s = '<harmony print-frame="no"><root>' + st(p.root) + '</root><kind text="' + x(p.c.sym) + '">' + k[0] + '</kind>';
    if (p.bass) s += '<bass><bass-step>' + p.bass.l.toUpperCase() + '</bass-step>' + (p.bass.a ? '<bass-alter>' + p.bass.a + '</bass-alter>' : '') + '</bass>';
    k.slice(1).forEach(dg => { s += '<degree><degree-value>' + dg[0] + '</degree-value><degree-alter>' + dg[1] + '</degree-alter><degree-type>' + dg[2] + '</degree-type></degree>'; });
    return s + offX + '</harmony>';
  };
  let out = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n';
  out += '<score-partwise version="3.1"><work><work-title>' + x(d.titel || 'Zonder titel') + '</work-title></work>';
  out += '<identification>' + (d.comp ? '<creator type="composer">' + x(d.comp) + '</creator>' : '') + '<encoding><software>Resonance (Transcriberen)</software><encoding-date>' + trToday() + '</encoding-date></encoding></identification>';
  out += '<part-list><score-part id="P1"><part-name>' + instr + '</part-name></score-part></part-list><part id="P1">';
  let prevTie = null;   // midi's die vanuit het vorige event overgebonden binnenkomen
  L.forEach((ms, mi) => {
    out += '<measure number="' + ms.num + '"' + (mi === 0 && d.pickup ? ' implicit="yes"' : '') + '>';
    if (mi === 0){
      out += '<attributes><divisions>' + TQ + '</divisions><key><fifths>' + fifths + '</fifths><mode>' + (minor ? 'minor' : 'major') + '</mode></key>';
      out += '<time><beats>' + d.time[0] + '</beats><beat-type>' + d.time[1] + '</beat-type></time><clef><sign>' + cl[0] + '</sign><line>' + cl[1] + '</line></clef></attributes>';
      out += '<direction placement="above"><direction-type><metronome><beat-unit>' + (M.comp ? 'quarter' : (TR_TYPE[M.unit] || 'quarter')) + '</beat-unit>' + (M.comp ? '<beat-unit-dot/>' : '') + '<per-minute>' + d.bpm + '</per-minute></metronome></direction-type><sound tempo="' + Math.round(d.bpm * M.beat / TQ) + '"/></direction>';
    }
    const beams = {};
    Notatie.beamGroups(ms.evs, d.time).forEach(g => g.forEach((i, j) => {
      const e = ms.evs[i], lv = e.len <= 9 || e.len === 12 || e.len === 18 ? (e.len <= 9 ? 3 : 2) : 1;
      const b = beams[i] = [j === 0 ? 'begin' : j === g.length - 1 ? 'end' : 'continue'];
      if (lv >= 2){   // tweede waardestreep: met de buren mee of een haakje
        const L2 = k => k >= 0 && k < g.length && (ms.evs[g[k]].len <= 18 && ms.evs[g[k]].len !== 24);
        const pv = L2(j - 1), nx = L2(j + 1);
        b.push(pv && nx ? 'continue' : pv ? 'end' : nx ? 'begin' : (j === 0 ? 'forward hook' : 'backward hook'));
      }
    }));
    const chs = Object.keys(d.chords).map(Number).filter(t => t >= ms.s && t < ms.s + ms.cap).sort((a, b) => a - b);
    const barAcc = {};
    ms.evs.forEach((e, i) => {
      chs.filter(t => t >= e.t && t < e.t + e.len).forEach(t => { out += harmony(d.chords[t], t - e.t); });
      const dot = TR_DOTTED[e.len], base = dot ? e.len / 1.5 : e.len;
      if (e.rest){
        out += '<note><rest' + (e.full ? ' measure="yes"' : '') + '/><duration>' + e.len + '</duration><voice>1</voice>' + (e.full ? '' : '<type>' + (TR_TYPE[base] || 'quarter') + '</type>' + (dot ? '<dot/>' : '')) + '</note>';
        prevTie = null; return;
      }
      const ps = e.ps.slice().sort((a, b) => trMidi(a) - trMidi(b)), nextTie = e.tie ? ps.map(trMidi) : null;
      ps.forEach((p, j) => {
        const mm = trMidi(p), tin = prevTie && prevTie.includes(mm), tout = nextTie && (() => { const nx = trNoteAt(e.t + e.len); return nx && nx.ps.some(q => trMidi(q) === mm); })();
        const bk = p.l + p.o, curA = barAcc[bk] != null ? barAcc[bk] : sig[p.l];
        let acc = '';
        if (!tin && p.a !== curA){ acc = '<accidental>' + ({ 0:'natural', 1:'sharp', '-1':'flat', 2:'double-sharp', '-2':'flat-flat' })[p.a] + '</accidental>'; }
        barAcc[bk] = p.a;
        out += '<note>' + (j ? '<chord/>' : '') + '<pitch><step>' + p.l.toUpperCase() + '</step>' + (p.a ? '<alter>' + p.a + '</alter>' : '') + '<octave>' + p.o + '</octave></pitch>';
        out += '<duration>' + e.len + '</duration>' + (tin ? '<tie type="stop"/>' : '') + (tout ? '<tie type="start"/>' : '') + '<voice>1</voice><type>' + (TR_TYPE[base] || 'quarter') + '</type>' + (dot ? '<dot/>' : '') + acc;
        if (!j && beams[i]) beams[i].forEach((b, k) => { out += '<beam number="' + (k + 1) + '">' + b + '</beam>'; });
        if (tin || tout) out += '<notations>' + (tin ? '<tied type="stop"/>' : '') + (tout ? '<tied type="start"/>' : '') + '</notations>';
        out += '</note>';
      });
      prevTie = nextTie;
    });
    if (mi === L.length - 1) out += '<barline location="right"><bar-style>light-heavy</bar-style></barline>';
    out += '</measure>';
  });
  return out + '</part></score-partwise>\n';
}
let trDl = window.claude ? null : { save: async ({ filename, data }) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
} };
(function hook(n){ if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then(d => { trDl = d; }).catch(() => {}); else if (n < 40) setTimeout(() => hook(n + 1), 250); })(0);
async function trDownload(){
  if (!trDoc) return;
  if (!trDl){ trMsg('Downloaden kan hier niet. Gebruik ➜ Repertoire, of open de app als website.', 'bad'); return; }
  const name = (trDoc.titel || 'transcriptie').replace(/[\\/:*?"<>|]+/g, '').trim() || 'transcriptie';
  try { await trDl.save({ filename:name + '.musicxml', data:new Blob([trXML()], { type:'application/vnd.recordare.musicxml+xml' }) }); trMsg('✓ ' + trEsc(name) + '.musicxml opgeslagen. Dat bestand opent ook in MuseScore.', 'ok'); }
  catch(e){ trMsg(e && e.code === 'declined' ? 'Niet opgeslagen.' : 'Opslaan lukte niet.', 'bad'); }
}

/* ---------- naar Repertoire (kopie) en bijwerken ---------- */
async function trRepItem(){ if (!trDoc || !trDoc.repId || typeof PtDB === 'undefined') return null; const all = await PtDB.all(); return (all || []).find(x => x.id === trDoc.repId) || null; }
function trRepUI(){
  const b = $('trRepBtn'); if (!b || !trDoc) return;
  if (!trDoc.repId){ b.innerHTML = '➜ Naar Repertoire'; b.title = 'Zet een kopie in Repertoire: daar oefen je het met de cursor, passages en metronoom'; b.classList.remove('hot'); $('trRepOpen').hidden = true; return; }
  const dirty = trDoc.repAt !== trSnapKey();
  b.innerHTML = dirty ? '↻ Bijwerken in Repertoire' : '✓ In Repertoire';
  b.title = dirty ? 'Je hebt iets veranderd: de kopie in Repertoire bijwerken (passages en aantekeningen blijven staan)' : 'De kopie in Repertoire is bijgewerkt';
  b.classList.toggle('hot', dirty); $('trRepOpen').hidden = false;
}
const trSnapKey = () => { let h = 0; const s = trSnap() + trDoc.titel + '|' + trDoc.comp + '|' + trDoc.bpm; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };
// tel-eenheid in Repertoire die past bij ons tempo (per tel): zelfde regel als ptDefUnit
function trRepUnit(){ const M = trM(); return M.comp ? 'qd' : M.d === 2 ? 'h' : M.d === 8 ? 'e' : 'q'; }
async function trToRep(){
  if (!trDoc || typeof PtDB === 'undefined') return;
  if (!trDoc.evs.length){ trMsg('Er staan nog geen noten in.', 'muted'); return; }
  const xml = trXML();
  let it = await trRepItem(), nieuw = false;
  if (it){
    it.data = xml; it.naam = trDoc.titel; it.titel = trDoc.titel; it.comp = trDoc.comp;
    if (typeof ptCacheDrop === 'function') ptCacheDrop(it);
    if (typeof ptCur !== 'undefined' && ptCur && ptCur.id === it.id){ ptCur.data = xml; if (typeof ptOsmdFor !== 'undefined' && ptOsmdFor === it.id) ptOsmdFor = null; ptCur = null; }
  } else {
    nieuw = true;
    it = { id:'p' + Date.now().toString(36), naam:trDoc.titel, titel:trDoc.titel, comp:trDoc.comp, data:xml, made:trToday(), last:null, s:{ bpm:trDoc.bpm, unit:trRepUnit() },
           instr:trDoc.clef === 'g' || trDoc.clef === 'c3' ? 'viool' : 'overig', bron:'transcriberen', trId:trDoc.id };
    trDoc.repId = it.id;
  }
  await PtDB.put(it);
  if (typeof ptList !== 'undefined'){ const i = ptList.findIndex(x => x.id === it.id); if (i >= 0) ptList[i] = it; else ptList.unshift(it); }
  trDoc.repAt = trSnapKey(); trSaveNow(); trRepUI();
  trMsg(nieuw ? '✓ Staat in Repertoire. <a href="#partituren" id="trGoRep">Openen in Repertoire →</a>' : '✓ Bijgewerkt in Repertoire (passages en aantekeningen blijven staan; ze hangen aan maatnummers, dus kijk ze na als je maten hebt ingevoegd).', 'ok');
  const a = $('trGoRep'); if (a) a.onclick = e => { e.preventDefault(); trOpenRep(); };
}
function trOpenRep(){
  if (!trDoc || !trDoc.repId) return;
  const id = trDoc.repId;
  location.hash = 'partituren';
  setTimeout(async () => { if (typeof ptRenderList === 'function'){ await ptRenderList(); if (typeof ptOpen === 'function') ptOpen(id); } }, 60);
}

/* ---------- bibliotheek (lijst met transcripties) ---------- */
function trShow(mode){ const v = $('trView'); v.classList.toggle('tr-lib', mode === 'lib'); v.classList.toggle('tr-ed', mode === 'ed'); }
function trKeyOptions(sel){
  const maj = Notatie.KEYLIST.map(k => k.id), minI = ['A','E','B','F#','C#','G#','D#','A#','D','G','C','F','Bb','Eb','Ab'];
  const nm = id => Notatie.name(Notatie.parse(id + '4'), 'nl');
  const sg = n => n === 0 ? 'geen voortekens' : Math.abs(n) + (n > 0 ? '♯' : '♭');
  return '<optgroup label="Majeur">' + maj.map(id => '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + nm(id) + '-groot · ' + sg(Notatie.fifths(id)) + '</option>').join('') + '</optgroup>' +
         '<optgroup label="Mineur">' + minI.map(r => { const id = r + 'm'; return '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + nm(r).toLowerCase() + '-klein · ' + sg(Notatie.fifths(id)) + '</option>'; }).join('') + '</optgroup>';
}
function trPickupOptions(time, sel){
  const M = Notatie.meter(time), step = M.comp ? M.unit : M.unit / 2, out = ['<option value="0">geen opmaat</option>'];
  for (let t = step; t < M.cap; t += step){
    const b = t / M.unit, lab = M.comp ? t / M.unit + ' ' + (t / M.unit === 1 ? 'achtste' : 'achtsten') : (b % 1 ? (Math.floor(b) ? Math.floor(b) + '½' : '½') : b) + ' tel';
    out.push('<option value="' + t + '"' + (+sel === t ? ' selected' : '') + '>' + lab + '</option>');
  }
  return out.join('');
}
function trRenderLib(){
  const box = $('trList'); if (!box) return;
  const items = trDB.items.slice().sort((a, b) => (b.upd || '').localeCompare(a.upd || '') || (b.id > a.id ? 1 : -1));
  box.innerHTML = items.length ? items.map(d => {
    const n = d.evs.length, ch = Object.keys(d.chords || {}).length;
    return '<div class="tritem" data-id="' + d.id + '"><button class="tropen"><b>' + trEsc(d.titel) + '</b><small>' + trEsc([d.comp, d.n + ' maten', n + ' noten' + (ch ? ', ' + ch + ' akkoorden' : ''), trDay(d.upd) ? 'bewerkt ' + trDay(d.upd) : '', d.repId ? 'in Repertoire' : ''].filter(Boolean).join(' · ')) + '</small></button>' +
      '<button class="trdel ptsmall" title="Weggooien (de kopie in Repertoire blijft staan)">🗑</button></div>';
  }).join('') : '<p class="muted">Nog niets uitgeschreven. Begin hierboven met een nieuw stuk.</p>';
  box.querySelectorAll('.tritem').forEach(r => {
    r.querySelector('.tropen').onclick = () => trOpen(r.dataset.id);
    const del = r.querySelector('.trdel');
    del.onclick = () => {
      if (!del.classList.contains('arm')){ del.classList.add('arm'); del.textContent = 'Zeker?'; setTimeout(() => { if (del.isConnected){ del.classList.remove('arm'); del.innerHTML = (typeof Icon !== 'undefined' && Icon.svg) ? Icon.svg('trash') : '🗑'; } }, 3500); return; }
      trDB.items = trDB.items.filter(x => x.id !== r.dataset.id); if (trDB.cur === r.dataset.id) trDB.cur = null; trSaveNow(); trRenderLib();
    };
  });
}
function trCreate(){
  const time = ($('trNewTime').value || '4/4').split('/').map(Number);
  const d = trNewDoc({ titel:$('trNewTitle').value.trim() || 'Zonder titel', comp:$('trNewComp').value.trim(), clef:$('trNewClef').value, key:$('trNewKey').value,
                       time, pickup:+$('trNewPick').value || 0, bpm:Math.max(20, Math.min(300, +$('trNewBpm').value || 80)), n:Math.max(1, Math.min(400, +$('trNewN').value || 8)) });
  trDB.items.push(d); trSaveNow();
  $('trNewTitle').value = ''; $('trNewComp').value = '';
  trOpen(d.id, true);
}
function trOpen(id, fresh){
  const d = trDB.items.find(x => x.id === id); if (!d) return;
  trPlayStop();
  trDoc = d; trDB.cur = id; trSaveNow();
  trNorm(); trUndo = []; trRedo = []; trChEd = null;
  trIn = { on:!!fresh, t:0, len:trIn.len || 48, dot:false, add:false }; trSel = null;
  $('trTitle').value = d.titel; $('trComp').value = d.comp || '';
  trShow('ed'); trSyncUI(); trKlavBuild();
  requestAnimationFrame(() => { trRender(); if (fresh) trMsg('Typ noten met A–G (of tik op het klavier). Nootwaarde met 2–7 of de knoppen, Esc = klaar met invoeren.', 'muted'); });
}
function trBack(){ trPlayStop(); trStopInput(); trChEd = null; if (trDoc) trSaveNow(); trDoc = null; trDB.cur = null; trSaveNow(); trShow('lib'); trRenderLib(); }

/* ---------- instellingen (🕹️) ---------- */
function trSyncUI(){
  $('trInst').innerHTML = Engine.instOptions(trG.inst);
  $('trHearChk').checked = trG.hear; $('trMetro').checked = trG.metro; $('trCi').checked = trG.ci; $('trChPlay').checked = trG.chords;
  $('trKlavChk').checked = trG.klav; $('trNames').value = trG.names; $('trZoom').value = Math.round(trG.zoom * 100); $('trZoomVal').textContent = Math.round(trG.zoom * 100) + '%';
  const has = !!trDoc;
  $('trDocSet').hidden = !has; $('trDocNone').hidden = has;
  if (has){
    $('trClef').value = trDoc.clef; $('trKey').innerHTML = trKeyOptions(trDoc.key);
    $('trTime').value = trDoc.time.join('/'); $('trPick').innerHTML = trPickupOptions(trDoc.time, trDoc.pickup);
    $('trBpm').value = trDoc.bpm; trBpmLabel();
  }
}
function trBpmLabel(){ if (!trDoc) return; const M = trM(); const s = M.comp ? '♩.' : M.d === 2 ? '𝅗𝅥' : M.d === 8 ? '♪' : '♩'; document.querySelectorAll('.trUnit').forEach(e => e.textContent = s); $('trBpmVal').textContent = trDoc.bpm; }
function trSetBpm(v){ if (!trDoc) return; trDoc.bpm = Math.max(20, Math.min(300, Math.round(v) || 80)); $('trBpm').value = trDoc.bpm; trBpmLabel(); trDoc.upd = trToday(); trSave(); trRepUI(); }
function trChangeTime(time){
  if (!trDoc) return;
  const oldCap = trM().cap, total = trTotal();
  trDo(() => {
    trDoc.time = time;
    const M = trM(); if (trDoc.pickup >= M.cap) trDoc.pickup = 0;
    trDoc.n = Math.max(1, Math.ceil((total - trDoc.pickup) / M.cap) + (trDoc.pickup ? 1 : 0));
  });
  void oldCap; trSyncUI();
}

/* ---------- toetsen ---------- */
function trKeydown(e){
  if (typeof view === 'undefined' || view !== 'transcriberen' || !trDoc || !$('trView').classList.contains('tr-ed')) return;
  if (e.target && e.target.id === 'trChIn') return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
  if (ctrl && !e.altKey && low === 'k'){ e.preventDefault(); e.stopImmediatePropagation(); trChordOpen(); return; }
  if (Keys.blocked(e)) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'SELECT' || ae.tagName === 'INPUT') && !Keys.is(e, 'luister')) return;
  if (ctrl && !e.altKey && low === 'z'){ e.preventDefault(); e.shiftKey ? trRedoDo() : trUndoDo(); return; }
  if (ctrl && !e.altKey && low === 'y'){ e.preventDefault(); trRedoDo(); return; }
  if (e.key === 'Escape'){
    if (trPlay){ trPlayStop(); return; }
    if (trIn.on){ e.stopImmediatePropagation(); trStopInput(); return; }
    if (trSel != null){ trSel = null; trRender(); }
    return;
  }
  if (Keys.is(e, 'luister') && !ctrl){ e.preventDefault(); trPlay ? trPlayStop() : trPlayStart(); return; }
  if (ctrl && (k === 'ArrowLeft' || k === 'ArrowRight')){ e.preventDefault(); trMove(k === 'ArrowRight' ? 1 : -1, true); return; }
  if (ctrl && (k === 'ArrowUp' || k === 'ArrowDown')){ e.preventDefault(); trPitch(p => ({ l:p.l, a:p.a, o:Math.max(0, Math.min(8, p.o + (k === 'ArrowUp' ? 1 : -1))) })); return; }
  if (ctrl) return;
  if (e.altKey && /^Digit[2-8]$/.test(e.code)){ e.preventDefault(); trInterval(+e.code.slice(5)); return; }
  if (e.altKey) return;
  if (k === 'ArrowLeft' || k === 'ArrowRight'){ e.preventDefault(); trMove(k === 'ArrowRight' ? 1 : -1); return; }
  if (k === 'ArrowUp' || k === 'ArrowDown'){ e.preventDefault(); trPitch(p => trStep(p, k === 'ArrowUp' ? 1 : -1)); return; }
  if (k === 'Home'){ e.preventDefault(); if (trIn.on) trIn.t = 0; else trSel = 0; trRender(); trScrollTo(0); return; }
  if (/^[a-g]$/i.test(k)){ e.preventDefault(); trLetter(low, e.shiftKey); return; }
  if (low === 'n'){ e.preventDefault(); trIn.on ? trStopInput() : trStartInput(); return; }
  if (/^Digit[2-7]$/.test(e.code) || /^[2-7]$/.test(k)){ e.preventDefault(); const dd = TR_DURS.find(x => x.k === (e.code ? e.code.slice(5) : k)); if (dd) trSetLen(dd.len); return; }
  if (k === '0' || e.code === 'Digit0'){ e.preventDefault(); trRest(); return; }
  if (k === '.'){ e.preventDefault(); trToggleDot(); return; }
  if (k === '+'){ e.preventDefault(); trAcc(1); return; }
  if (k === '-'){ e.preventDefault(); trAcc(-1); return; }
  if (k === '='){ e.preventDefault(); trAcc(0); return; }
  if (low === 't'){ e.preventDefault(); trTie(); return; }
  if (low === 'r'){ e.preventDefault(); trRepeat(); return; }
  if (Keys.is(e, 'metronoom')){ e.preventDefault(); trG.metro = !trG.metro; trSaveG(); $('trMetro').checked = trG.metro; trMsg('Metronoom ' + (trG.metro ? 'aan' : 'uit') + '.', 'muted'); return; }
  if (k === 'Delete' || k === 'Backspace'){ e.preventDefault(); trDelete(); return; }
}

/* ---------- opbouw ---------- */
function trInit(){
  if (trInited) return; trInited = true;
  trLoad();
  // nieuw-formulier
  $('trNewClef').innerHTML = TR_CLEFS.map(c => '<option value="' + c[0] + '">' + c[1] + '</option>').join('');
  $('trClef').innerHTML = $('trNewClef').innerHTML;
  $('trNewKey').innerHTML = trKeyOptions('C');
  const tOpts = TR_TIMES.map(t => '<option>' + t.join('/') + '</option>').join('');
  $('trNewTime').innerHTML = tOpts; $('trTime').innerHTML = tOpts;
  $('trNewPick').innerHTML = trPickupOptions([4, 4], 0);
  $('trNewTime').onchange = () => { $('trNewPick').innerHTML = trPickupOptions($('trNewTime').value.split('/').map(Number), 0); };
  $('trNewBtn').onclick = trCreate;
  $('trNewTitle').onkeydown = e => { if (e.key === 'Enter') trCreate(); };
  // editor-balk
  $('trBack').onclick = trBack;
  $('trTitle').oninput = () => { if (!trDoc) return; trDoc.titel = $('trTitle').value.trim() || 'Zonder titel'; trDoc.upd = trToday(); trSave(); trRepUI(); };
  $('trComp').oninput = () => { if (!trDoc) return; trDoc.comp = $('trComp').value.trim(); trSave(); trRepUI(); };
  [$('trTitle'), $('trComp')].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape'){ e.preventDefault(); i.blur(); } }));
  $('trPlayBtn').onclick = () => { $('trPlayBtn').blur(); trPlay ? trPlayStop() : trPlayStart(); };
  document.querySelectorAll('#trView .trtempo button').forEach(b => b.onclick = () => { b.blur(); trSetBpm(trDoc.bpm + +b.dataset.d); });
  $('trUndoBtn').onclick = () => { $('trUndoBtn').blur(); trUndoDo(); };
  $('trRedoBtn').onclick = () => { $('trRedoBtn').blur(); trRedoDo(); };
  $('trRepBtn').onclick = () => { $('trRepBtn').blur(); trToRep(); };
  $('trRepOpen').onclick = () => trOpenRep();
  $('trXmlBtn').onclick = () => { $('trXmlBtn').blur(); trDownload(); };
  // palet
  $('trDurs').innerHTML = TR_DURS.map(d => '<button data-len="' + d.len + '" title="' + d.n + ' (' + d.k + ')">' + trDurIcon(d.len) + '<small>' + d.k + '</small></button>').join('');
  $('trDurs').querySelectorAll('button').forEach(b => b.onclick = () => { b.blur(); trSetLen(+b.dataset.len); });
  $('trDot').onclick = () => { $('trDot').blur(); trToggleDot(); };
  $('trRestBtn').onclick = () => { $('trRestBtn').blur(); trRest(); };
  $('trInBtn').onclick = () => { $('trInBtn').blur(); trIn.on ? trStopInput() : trStartInput(); };
  document.querySelectorAll('#trView [data-acc]').forEach(b => b.onclick = () => { b.blur(); trAcc(+b.dataset.acc); });
  $('trTieBtn').onclick = () => { $('trTieBtn').blur(); trTie(); };
  $('trChBtn').onclick = () => { $('trChBtn').blur(); trChordOpen(); };
  $('trDelBtn').onclick = () => { $('trDelBtn').blur(); trDelete(); };
  $('trAddBtn').onclick = () => { $('trAddBtn').blur(); trIn.add = !trIn.add; trPalUI(); };
  $('trUpBtn').onclick = () => { $('trUpBtn').blur(); trPitch(p => trStep(p, 1)); };
  $('trDownBtn').onclick = () => { $('trDownBtn').blur(); trPitch(p => trStep(p, -1)); };
  $('trMeasPlus').onclick = () => { $('trMeasPlus').blur(); trMeasures(1); };
  $('trMeasMinus').onclick = () => { $('trMeasMinus').blur(); trMeasures(-1); };
  // partituur
  $('trSheet').addEventListener('click', trSheetClick);
  $('trSheet').addEventListener('dblclick', trSheetDbl);
  $('trChIn').addEventListener('keydown', trChordKey);
  $('trChIn').addEventListener('input', trChordHint);
  $('trChIn').addEventListener('blur', () => setTimeout(() => { if (trChEd && document.activeElement !== $('trChIn')){ trChordCommit(); trChEd = null; trRender(); } }, 120));
  // paneel
  $('trClef').onchange = () => { trDo(() => { trDoc.clef = $('trClef').value; }); trKlavBuild(); };
  $('trKey').onchange = () => { trDo(() => { trDoc.key = $('trKey').value; }); };
  $('trTime').onchange = () => trChangeTime($('trTime').value.split('/').map(Number));
  $('trPick').onchange = () => {
    // noten houden hun plek in de maat: alles schuift op met het verschil in opmaat (opmaat erbij = één maat meer)
    const np = +$('trPick').value, op = trDoc.pickup, dl = np - op;
    trDo(() => {
      trDoc.evs.forEach(e => { e.t += dl; }); trDoc.evs = trDoc.evs.filter(e => e.t >= 0);
      const ch = {}; Object.keys(trDoc.chords).forEach(k => { const t = +k + dl; if (t >= 0) ch[t] = trDoc.chords[k]; }); trDoc.chords = ch;
      trDoc.n += (np && !op) ? 1 : (!np && op) ? -1 : 0; trDoc.n = Math.max(1, trDoc.n); trDoc.pickup = np;
    });
  };
  $('trBpm').onchange = () => trSetBpm(+$('trBpm').value);
  $('trInst').onchange = () => { trG.inst = $('trInst').value; trSaveG(); };
  $('trHearChk').onchange = () => { trG.hear = $('trHearChk').checked; trSaveG(); };
  $('trMetro').onchange = () => { trG.metro = $('trMetro').checked; trSaveG(); };
  $('trCi').onchange = () => { trG.ci = $('trCi').checked; trSaveG(); };
  $('trChPlay').onchange = () => { trG.chords = $('trChPlay').checked; trSaveG(); };
  $('trKlavChk').onchange = () => { trG.klav = $('trKlavChk').checked; trSaveG(); trKlavBuild(); };
  $('trNames').onchange = () => { trG.names = $('trNames').value; trSaveG(); trKlavBuild(); };
  $('trZoom').oninput = () => { trG.zoom = Math.max(.6, Math.min(1.8, +$('trZoom').value / 100)); $('trZoomVal').textContent = Math.round(trG.zoom * 100) + '%'; trSaveG(); trRender(); };
  $('trZoomOut').onclick = () => { $('trZoom').value = Math.round(trG.zoom * 100) - 10; $('trZoom').oninput(); };
  $('trZoomIn').onclick = () => { $('trZoom').value = Math.round(trG.zoom * 100) + 10; $('trZoom').oninput(); };
  $('trView').addEventListener('change', e => { const t = e.target; if (t && (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'number' || t.type === 'range')) setTimeout(() => t.blur(), 0); });
  window.addEventListener('keydown', trKeydown, true);
  window.addEventListener('resize', () => { clearTimeout(trResizeT); trResizeT = setTimeout(() => { if (trDoc && view === 'transcriberen' && $('trSheetWrap').clientWidth !== trLastW) trRender(); }, 150); });
  trSyncUI();
  if (typeof Keys !== 'undefined' && Keys.apply) Keys.apply($('trView'));
}
function trOnRoute(){
  if (typeof view === 'undefined') return;
  if (view !== 'transcriberen'){ trPlayStop(); if (trChEd){ trChEd = null; } return; }
  trInit();
  if (trDoc){ trShow('ed'); requestAnimationFrame(trRender); }
  else if (trDB.cur && trDB.items.some(x => x.id === trDB.cur)) trOpen(trDB.cur);
  else { trShow('lib'); trRenderLib(); }
}
if (typeof view !== 'undefined' && view === 'transcriberen') trOnRoute();   // direct geopend via #transcriberen
