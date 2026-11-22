/* ================= Aantekeningen in Repertoire (js/aantekeningen.js, prefix pa, object Ann) — 22-11-2026 =================
   forScore-achtig aantekenen op de partituur: pen, markeerstift, gum, stempels (Engelse namen), ongedaan maken.
   Géén noten bewerken (bewuste keuze, zie claude/aantekeningen-plan.md in het project).

   KERNIDEE: een aantekening hangt nooit aan pixels maar aan de muziek, zodat hij meeverhuist bij zoomen, volledig scherm,
   Bladzijden/Doorlopend, Focus en een andere schermbreedte (OSMD tekent dan alles opnieuw, met een andere indeling).
   - Anker a = {i, st, dx, dy}: i = stap uit de tijdlijn (ptSteps; altijd de EERSTE keer dat die noten klinken, dus bij
     herhalingen dezelfde), st = balknummer (zoals ptStaff / idInMusicSheet), dx/dy = afstand in balkruimtes (sp = afstand
     tussen twee balklijnen) vanaf het nootbolletje van stap i (x) en de bovenste lijn van balk st (y).
   - Balklijnen worden uit de getekende SVG gehaald (paden "M x y L x2 y", groepjes van 5 gelijk verdeelde lijnen), los van
     de VexFlow-versie. Lukt dat niet, dan valt het terug op de noten (bovenkant regel, sp uit de nootbolletjes).
   - Items in ptCur.ann (gaat mee met het stuk → back-up en synchronisatie):
       stempel {id, t:'s', k (stempel-id of 'c:<eigen tekst>'), a, c (kleur), z (grootte)}
       pen     {id, t:'p', a (= eerste punt), p:[[dx, dy, w]…] (t.o.v. a, in sp; w = dikte-factor uit de pendruk), c, hl (markeerstift)}
       boog    {id, t:'h', k:'cresc'|'dim'|'slur', a, b (b.st/b.dy = die van a, zodat hij recht blijft), c}
       tekst   {id, t:'x', v (tekst, \n = nieuwe regel), a (= linkerkant, midden van de eerste regel), c, z}   (stap 3, v1.19)
     Elk item heeft l = laag-id (zonder l of met een onbekende laag: de eerste laag). Lagen zijn algemeen (ptG.ann.layers),
     welke lagen verborgen zijn hoort bij het stuk (ptCur.annHide = [laag-id's]). Nieuwe items komen in ptG.ann.layer.
   - Eigen SVG-laag #paLayer in #ptSheet (boven de noten, onder de cursorlijn), niet in de cache van de tekening.
     Hertekenen via Ann.redraw() (aangeroepen door ptAfterDraw en ptFsLayout in partituren.js).
   - Tekenmodus (✏️ in de balk of in volledig scherm): invoerlaag #paInput over de partituur; werkbalk #paBar onderaan
     (in volledig scherm verhuist hij mee naar #ptFsRot). ✋ = bladeren/cursor gebruiken zonder de modus te verlaten.
     Een stylus (pointerType 'pen') tekent ook buiten de tekenmodus (instelling ptG.ann.stylus); vingers scrollen dan.
   - Algemene keuzes in ptG.ann (localStorage 'partituren-settings'): show, tool, color, stamp, tab, fav, custom, size, stylus, layers, layer. */

const Ann = (function(){
  const NS = 'http://www.w3.org/2000/svg';
  const DEF = { show:true, tool:'pen', color:'ink', stamp:'down', tab:'', fav:[], custom:[], size:1, stylus:true, layer:'l1',
    layers:[{ id:'l1', n:'Algemeen' }, { id:'l2', n:'Vingerzetting' }, { id:'l3', n:'Streken' }, { id:'l4', n:'Oefen-notities' }] };
  function S(){
    if (!ptG.ann || typeof ptG.ann !== 'object') ptG.ann = {};
    const a = ptG.ann;
    for (const k in DEF) if (a[k] === undefined) a[k] = Array.isArray(DEF[k]) ? JSON.parse(JSON.stringify(DEF[k])) : DEF[k];
    if (!Array.isArray(a.layers) || !a.layers.length) a.layers = JSON.parse(JSON.stringify(DEF.layers));
    if (!a.layers.some(l => l.id === a.layer)) a.layer = a.layers[0].id;
    if (typeof BY !== 'undefined' && a.stamp && a.stamp.slice(0, 2) !== 'c:' && !BY[a.stamp]) a.stamp = OLDBLK && OLDBLK[a.stamp] ? 'B' + BLK.findIndex(b => b[0] === OLDBLK[a.stamp]) : 'down';
    return a;
  }
  /* ---------- lagen ---------- */
  const layerOf = it => { const L = S().layers; return L.some(l => l.id === it.l) ? it.l : L[0].id; };
  const hiddenSet = () => new Set((ptCur && ptCur.annHide) || []);
  const shown = it => !hiddenSet().has(layerOf(it));
  const save = () => ptSaveG();
  const r3 = v => Math.round(v * 1000) / 1000;
  const uid = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function el(tag, at, parent){
    const e = document.createElementNS(NS, tag);
    if (at) for (const k in at) e.setAttribute(k, at[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- stempels ---------- */
  const SERIF = '"Times New Roman",Times,Georgia,serif', SANS = 'Arial,Helvetica,sans-serif';
  const ST = {   // tekststijlen: lettertype, gewicht, schuin, grootte in balkruimtes
    dyn:{ f:SERIF, w:700, i:1, z:2.2 },
    ital:{ f:SERIF, w:400, i:1, z:1.6 },
    itb:{ f:SERIF, w:700, i:1, z:1.7 },
    fing:{ f:SANS, w:700, i:0, z:1.4 },
    small:{ f:SANS, w:600, i:0, z:1.15 },
    roman:{ f:SERIF, w:700, i:0, z:1.5 },
    big:{ f:SERIF, w:700, i:0, z:2.8 },
    sym:{ f:'"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols","DejaVu Sans",' + SERIF, w:400, i:0, z:2 },
    emo:{ f:'"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif', w:400, i:0, z:1.7 },
    cust:{ f:SANS, w:600, i:0, z:1.25 }
  };
  const T = (id, n, st, v) => ({ id, n, x:'t', st, v:v == null ? n : v });
  const P = (id, n, s) => ({ id, n, x:'p', s });   // s = [[pad, 'fill'|'stroke', lijndikte]], eenheid = balkruimte, midden = (0,0)
  const SPAN = (id, n, k) => ({ id, n, x:'span', k });
  const DOT = (cx, cy, r) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}Z`;
  const LIST = [
    // Bow (viool)
    P('down', 'down-bow', [['M-.6 .55V-.45H.6V.55', 'stroke', .13], ['M-.66 -.52H.66V-.18H-.66Z', 'fill']]),
    P('up', 'up-bow', [['M-.42 -.6L0 .6L.42 -.6', 'stroke', .12]]),
    T('frog', 'Fr.', 'small'), T('tip', 'Tip', 'small'), T('lowh', 'L.H.', 'small'), T('upph', 'U.H.', 'small'), T('wb', 'W.B.', 'small'),
    T('lift', 'bow lift', 'big', '’'),
    // Fingers (viool)
    T('f0', '0', 'fing'), T('f1', '1', 'fing'), T('f2', '2', 'fing'), T('f3', '3', 'fing'), T('f4', '4', 'fing'),
    T('pos1', '1st pos.', 'small'), T('pos2', '2nd pos.', 'small'), T('pos3', '3rd pos.', 'small'), T('pos4', '4th pos.', 'small'),
    T('pos5', '5th pos.', 'small'), T('pos6', '6th pos.', 'small'), T('pos7', '7th pos.', 'small'),
    T('sI', 'I', 'roman'), T('sII', 'II', 'roman'), T('sIII', 'III', 'roman'), T('sIV', 'IV', 'roman'),
    T('sulG', 'sul G', 'ital'), T('sulD', 'sul D', 'ital'), T('sulA', 'sul A', 'ital'), T('sulE', 'sul E', 'ital'),
    P('guide', 'guide finger', [['M-.65 0H.65', 'stroke', .15]]),
    T('sp22', '2+2', 'small'), T('sp13', '1+3', 'small'),
    // Technique (viool)
    T('pizz', 'pizz.', 'ital'), T('arco', 'arco', 'ital'),
    P('harm', 'harmonic', [[DOT(0, 0, .34), 'stroke', .11]]),
    T('tasto', 'sul tasto', 'ital'), T('pont', 'sul pont.', 'ital'), T('vib', 'vib.', 'ital'), T('nonvib', 'non vib.', 'ital'),
    // Fingers (piano)
    T('k1', '1', 'fing'), T('k2', '2', 'fing'), T('k3', '3', 'fing'), T('k4', '4', 'fing'), T('k5', '5', 'fing'),
    T('rh', 'RH', 'small'), T('lh', 'LH', 'small'),
    // Pedal (piano)
    T('ped', 'Ped.', 'itb'),
    P('rel', 'release (✱)', [['M0 -.6V.6M-.52 -.3L.52 .3M-.52 .3L.52 -.3', 'stroke', .14], [DOT(0, 0, .16), 'fill']]),
    T('una', 'una corda', 'ital'), T('tre', 'tre corde', 'ital'),
    // Dynamics
    ...['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sf', 'sfz', 'sffz', 'rfz'].map(v => T('d' + v, v, 'dyn')),
    SPAN('cresc', 'crescendo <', 'cresc'), SPAN('dim', 'diminuendo >', 'dim'),
    ...['cresc.', 'dim.', 'decresc.', 'subito', 'poco a poco', 'più', 'meno'].map(v => T('w' + v.replace(/\W/g, ''), v, 'ital')),
    // Tempo
    ...['accel.', 'rit.', 'rall.', 'a tempo', 'Tempo I', 'più mosso', 'meno mosso', 'rubato'].map(v => T('t' + v.replace(/\W/g, ''), v, 'ital')),
    { id:'mm', n:'♩ = …', x:'ask', v:'♩ = ' },
    // Character
    ...['dolce', 'espressivo', 'cantabile', 'legato', 'leggiero', 'marcato', 'agitato'].map(v => T('c' + v, v, 'ital')),
    // Articulation + versieringen
    P('acc', 'accent', [['M-.55 -.36L.55 0L-.55 .36', 'stroke', .12]]),
    P('stac', 'staccato', [[DOT(0, 0, .16), 'fill']]),
    P('ten', 'tenuto', [['M-.55 0H.55', 'stroke', .15]]),
    P('marc', 'marcato', [['M-.42 .45L0 -.45L.42 .45', 'stroke', .16]]),
    P('stcs', 'staccatissimo', [['M-.17 -.45L.17 -.45L0 .45Z', 'fill']]),
    P('port', 'portato', [['M-.55 -.28H.55', 'stroke', .14], [DOT(0, .28, .15), 'fill']]),
    P('ferm', 'fermata', [['M-.9 .35C-.9 -.75 .9 -.75 .9 .35', 'stroke', .13], [DOT(0, .18, .15), 'fill']]),
    SPAN('slur', 'slur', 'slur'),
    T('tr', 'tr', 'itb'),
    P('turn', 'turn', [['M-.9 .15C-.9 -.5 -.25 -.5 0 0C.25 .5 .9 .5 .9 -.15', 'stroke', .17]]),
    P('mord', 'mordent', [['M-.8 .18L-.45 -.18L-.1 .18L.25 -.18L.6 .18', 'stroke', .15], ['M-.1 -.55V.55', 'stroke', .1]]),
    P('umord', 'upper mordent', [['M-.8 .18L-.45 -.18L-.1 .18L.25 -.18L.6 .18', 'stroke', .15]]),
    // Practice
    T('sh', '♯', 'sym'), T('fl', '♭', 'sym'), T('na', '♮', 'sym'),
    T('count', 'count!', 'itb'), T('slow', 'slow', 'itb'), T('breathe', 'breathe', 'itb'),
    // More
    T('o8va', '8va', 'itb'), T('o8vb', '8vb', 'itb'),
    P('caes', 'caesura //', [['M-.48 .55L-.08 -.55M.08 .55L.48 -.55', 'stroke', .15]]),
    T('breath', 'breath mark', 'big', ','),
    P('brl', '[ begin', [['M.28 -2.2H-.05V2.2H.28', 'stroke', .15]]),
    P('brr', '] einde', [['M-.28 -2.2H.05V2.2H-.28', 'stroke', .15]])
  ];
  // Blokken (v1.22): elke emoji hier = een blok (passage) op die plek; de emoji staat dan in de partituur (item k:'blk')
  const BLK = [['⚠️', 'let op'], ['👓', 'kijk uit'], ['○', 'omcirkeld'], ['↑', 'te laag, hoger'], ['↓', 'te hoog, lager'], ['🔁', 'herhalen'],
    ['🎯', 'doel'], ['🔥', 'vuur'], ['⭐', 'ster'], ['💪', 'kracht'], ['🐢', 'langzaam'], ['🐇', 'snel'], ['🎻', 'viool'], ['🎹', 'piano'],
    ['🎵', 'melodie'], ['❤️', 'mooi'], ['🧠', 'onthouden'], ['👂', 'luisteren'], ['✋', 'hand'], ['🌊', 'golf'], ['🏔️', 'top'],
    ['🌙', 'rustig'], ['☀️', 'helder'], ['🎭', 'karakter'], ['✨', 'glans'], ['📌', 'vast'], ['🚀', 'vaart'], ['🍀', 'geluk']];
  BLK.forEach(([e, n], j) => LIST.push({ id:'B' + j, n:'blok ' + e + ' ' + n, x:'blk', e, nm:n }));
  const symE = e => /^[○↑↓]$/.test(e);
  const BY = {}; LIST.forEach(s => { BY[s.id] = s; });
  const OLDBLK = { warn:'⚠️', look:'👓', circ:'○', hi:'↑', lo:'↓', rep:'🔁' };   // v1.20/21-stempels → worden blokken
  const pasOf = it => it && it.pas && ptCur && (ptCur.pas || []).find(x => x.id === it.pas) || null;
  const blkEmo = it => { const p = pasOf(it); return (p && p.emo) || it.e || ''; };
  const blkDone = it => { const p = pasOf(it); return !!(p && p.status === 'zit'); };
  const TABS = {
    bow:{ n:'Bow', ids:['down', 'up', 'frog', 'tip', 'lowh', 'upph', 'wb', 'lift'] },
    vfing:{ n:'Fingers', ids:['f0', 'f1', 'f2', 'f3', 'f4', 'pos1', 'pos2', 'pos3', 'pos4', 'pos5', 'pos6', 'pos7', 'sI', 'sII', 'sIII', 'sIV', 'sulG', 'sulD', 'sulA', 'sulE', 'guide', 'sp22', 'sp13'] },
    tech:{ n:'Technique', ids:['pizz', 'arco', 'harm', 'tasto', 'pont', 'vib', 'nonvib'] },
    pfing:{ n:'Fingers', ids:['k1', 'k2', 'k3', 'k4', 'k5', 'rh', 'lh'] },
    ped:{ n:'Pedal', ids:['ped', 'rel', 'una', 'tre'] },
    dyn:{ n:'Dynamics', ids:['dppp', 'dpp', 'dp', 'dmp', 'dmf', 'df', 'dff', 'dfff', 'dfp', 'dsf', 'dsfz', 'dsffz', 'drfz', 'cresc', 'dim', 'wcresc', 'wdim', 'wdecresc', 'wsubito', 'wpocoapoco', 'wpi', 'wmeno'] },
    tempo:{ n:'Tempo', ids:['taccel', 'trit', 'trall', 'tatempo', 'tTempoI', 'tpimosso', 'tmenomosso', 'trubato', 'mm'] },
    char:{ n:'Character', ids:['cdolce', 'cespressivo', 'ccantabile', 'clegato', 'cleggiero', 'cmarcato', 'cagitato'] },
    art:{ n:'Articulation', ids:['acc', 'stac', 'ten', 'marc', 'stcs', 'port', 'ferm', 'slur', 'tr', 'turn', 'mord', 'umord'] },
    blk:{ n:'Blokken', ids:BLK.map((_, j) => 'B' + j) },
    prac:{ n:'Practice', ids:['sh', 'fl', 'na', 'count', 'slow', 'breathe'] },
    more:{ n:'More', ids:['o8va', 'o8vb', 'caes', 'breath', 'brl', 'brr'] },
    fav:{ n:'★', ids:[] }
  };
  // 'più' → id 'wpi' / 'tpimosso' (\W haalt de ù weg): zo blijven de id's ASCII
  const SETS = {
    viool:['blk', 'bow', 'vfing', 'tech', 'dyn', 'tempo', 'char', 'art', 'prac', 'more', 'fav'],
    piano:['blk', 'pfing', 'ped', 'dyn', 'tempo', 'char', 'art', 'prac', 'more', 'fav'],
    overig:['blk', 'bow', 'vfing', 'pfing', 'ped', 'tech', 'dyn', 'tempo', 'char', 'art', 'prac', 'more', 'fav']
  };
  function stamp(k){
    if (!k) return null;
    if (k.slice(0, 2) === 'c:') return { id:k, n:k.slice(2), x:'t', st:'cust', v:k.slice(2) };
    return BY[k] || null;
  }
  function drawStamp(g, d, x, y, sp, z){
    if (d.x === 't'){
      const s = ST[d.st] || ST.cust;
      const t = el('text', { x:r3(x), y:r3(y), 'font-size':r3(s.z * sp * z), 'font-family':s.f, 'font-weight':s.w, 'font-style':s.i ? 'italic' : 'normal',
        'text-anchor':'middle', 'dominant-baseline':'central', fill:'currentColor' }, g);
      t.textContent = d.v;
      return;
    }
    const gg = el('g', { transform:'translate(' + r3(x) + ' ' + r3(y) + ') scale(' + r3(sp * z) + ')' }, g);
    d.s.forEach(([path, how, w]) => el('path', how === 'fill' ? { d:path, fill:'currentColor' }
      : { d:path, fill:'none', stroke:'currentColor', 'stroke-width':w, 'stroke-linecap':'round', 'stroke-linejoin':'round' }, gg));
  }

  /* ---------- geometrie: regels, balken, balkruimte ---------- */
  let G = null;   // {geo (= ptGeo waarop dit gebouwd is), lines:[{l, r, t, b, pg, tops, sp}], sp, V}
  const LINE_RE = /^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*L\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*$/;
  function visStaves(){
    const sh = ptCur && ptCur.s ? ptCur.s.show : null;
    if (sh != null && sh !== 'alle' && ptParts[sh]) return ptParts[sh].staves.slice();
    return Array.from({ length:Math.max(1, ptStaves || 1) }, (_, k) => k);
  }
  function median(a){ if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; }
  function staves(sr, sc){   // alle balken (vijf lijnen) in de tekening, in coördinaten van #ptSheet
    const segs = [];
    ptActive().querySelectorAll('path').forEach(p => {
      const d = p.getAttribute('d'); if (!d || d.length > 80) return;
      const m = LINE_RE.exec(d); if (!m || Math.abs(+m[2] - +m[4]) > .05 || Math.abs(+m[3] - +m[1]) < 15) return;
      const r = p.getBoundingClientRect(); if (!r.width) return;
      segs.push({ l:(r.left - sr.left) / sc, r:(r.right - sr.left) / sc, y:(r.top - sr.top) / sc });
    });
    const buckets = new Map();
    segs.forEach(s => { const k = Math.round(s.l / 2) + '|' + Math.round(s.r / 2); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(s); });
    const out = [];
    buckets.forEach(arr => {
      arr.sort((a, b) => a.y - b.y);
      for (let j = 0; j + 4 < arr.length; j++){
        const d0 = arr[j + 1].y - arr[j].y; if (!(d0 > 2 && d0 < 60)) continue;
        let ok = true; for (let q = 1; q < 4; q++){ const dq = arr[j + q + 1].y - arr[j + q].y; if (Math.abs(dq - d0) > d0 * .2){ ok = false; break; } }
        if (!ok) continue;
        const w = arr[j].r - arr[j].l; if (w < d0 * 3) continue;   // hulplijnen zijn kort
        out.push({ l:arr[j].l, r:arr[j].r, top:arr[j].y, bot:arr[j + 4].y, sp:(arr[j + 4].y - arr[j].y) / 4 });
        j += 4;
      }
    });
    return out;
  }
  function geo(){
    if (!ptGeo) ptGeo = ptGeoBuild();
    if (G && G.geo === ptGeo) return G;
    const sh = $('ptSheet'), sr = sh.getBoundingClientRect(), sc = sh.offsetWidth ? sr.width / sh.offsetWidth : 1;
    // terugval-sp: hoogte van de nootbolletjes (≈ één balkruimte)
    const hs = []; ptActive().querySelectorAll('.vf-notehead').forEach((h, k) => { if (k > 80) return; const r = h.getBoundingClientRect(); if (r.height) hs.push(r.height / sc); });
    let sp0 = median(hs); if (!(sp0 > 2)) sp0 = 10 * (ptFsOn ? 1 : (ptG.zoom || 100) / 100);
    const lines = ptGeo.lines.map(L => ({ l:Infinity, r:L.r, t:L.t, b:L.b, pg:L.pg, tops:[], sps:[] }));
    ptGeo.step.forEach(g => { if (g && lines[g.line]) lines[g.line].l = Math.min(lines[g.line].l, g.x); });
    let st = [];
    try { st = staves(sr, sc); } catch(e){ console.warn('Aantekeningen: balken zoeken mislukt', e); }
    st.forEach(s => {   // balk → regel: horizontaal binnen de regel, verticaal het dichtst bij de noten van die regel
      const c = (s.top + s.bot) / 2; let best = -1, bd = Infinity;
      lines.forEach((L, k) => {
        if (!isFinite(L.l) || s.r < L.l - 4 || s.l > L.r + 4) return;
        const d = c < L.t ? L.t - c : c > L.b ? c - L.b : 0;
        if (d < bd){ bd = d; best = k; }
      });
      if (best >= 0 && bd < s.sp * 8){ const L = lines[best]; if (!L.tops.some(t => Math.abs(t - s.top) < s.sp * .6)) L.tops.push(s.top); L.sps.push(s.sp); }
    });
    lines.forEach(L => {
      L.tops.sort((a, b) => a - b);
      L.sp = median(L.sps); if (!(L.sp > 2)) L.sp = sp0;
      if (!L.tops.length) L.tops = [Math.max(L.t, (L.t + L.b) / 2 - 2 * L.sp)];
    });
    G = { geo:ptGeo, lines, sp:sp0, V:visStaves() };
    return G;
  }
  const canon = i => { const s = ptSteps[i]; return s && s.els && s.els.length && ptElStep[s.els[0]] === i; };
  function pos(a){   // anker → plek in #ptSheet (of null als dat deel nu niet getekend is)
    if (!a) return null;
    const g = ptGeo && ptGeo.step[a.i]; if (!g) return null;
    const L = G.lines[g.line]; if (!L) return null;
    let k = G.V.indexOf(a.st); if (k < 0) return null;
    k = Math.min(k, L.tops.length - 1);
    return { x:g.x + a.dx * L.sp, y:L.tops[k] + a.dy * L.sp, sp:L.sp, li:g.line };
  }
  function lineAt(p){
    let best = null;
    G.lines.forEach((L, li) => {
      if (!isFinite(L.l)) return;
      const sp = L.sp; if (p.x < L.l - 6 * sp || p.x > L.r + 6 * sp) return;
      const top = Math.min(L.t, L.tops[0]), bot = Math.max(L.b, L.tops[L.tops.length - 1] + 4 * sp);
      const d = p.y < top ? top - p.y : p.y > bot ? p.y - bot : 0;
      if (!best || d < best.d) best = { li, d };
    });
    return best && best.d < G.lines[best.li].sp * 16 ? best.li : null;
  }
  function anchorAt(p, snap){   // plek → anker {i, st, dx, dy}
    geo();
    const li = lineAt(p); if (li == null) return null;
    const L = G.lines[li], sp = L.sp;
    let k = 0, kd = Infinity; L.tops.forEach((t, j) => { const d = Math.abs(p.y - (t + 2 * sp)); if (d < kd){ kd = d; k = j; } });
    k = Math.min(k, G.V.length - 1);
    let bi = -1, bd = Infinity;
    ptGeo.step.forEach((g, i) => { if (!g || g.line !== li || !canon(i)) return; const d = Math.abs(g.x - p.x); if (d < bd){ bd = d; bi = i; } });
    if (bi < 0) return null;
    let dx = (p.x - ptGeo.step[bi].x) / sp;
    if (snap && Math.abs(dx) < .9) dx = 0;   // stempel vlak bij een noot: precies erboven/eronder
    return { i:bi, st:G.V[k], dx:r3(dx), dy:r3((p.y - L.tops[Math.min(k, L.tops.length - 1)]) / sp) };
  }

  /* ---------- tekenen ---------- */
  function chaikin(P){
    if (P.length < 3) return P;
    const o = [P[0]];
    for (let j = 0; j < P.length - 1; j++){
      const a = P[j], b = P[j + 1];
      o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25, a[2] * .75 + b[2] * .25]);
      o.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75, a[2] * .25 + b[2] * .75]);
    }
    o.push(P[P.length - 1]);
    return o;
  }
  function outline(P){   // P = [[x, y, halve dikte]] → gevulde vorm met ronde uiteinden (dikte volgt de pendruk)
    const f = v => r3(v);
    if (P.length === 1){ const [x, y, w] = P[0]; return DOT(f(x), f(y), f(Math.max(w, .5))); }
    P = chaikin(P);
    const Lf = [], Rt = [];
    for (let j = 0; j < P.length; j++){
      const a = P[Math.max(0, j - 1)], b = P[Math.min(P.length - 1, j + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const w = P[j][2];
      Lf.push([P[j][0] - dy * w, P[j][1] + dx * w]); Rt.push([P[j][0] + dy * w, P[j][1] - dx * w]);
    }
    const w0 = P[0][2], w1 = P[P.length - 1][2];
    let d = 'M' + f(Lf[0][0]) + ' ' + f(Lf[0][1]);
    for (let j = 1; j < Lf.length; j++) d += 'L' + f(Lf[j][0]) + ' ' + f(Lf[j][1]);
    d += 'A' + f(w1) + ' ' + f(w1) + ' 0 0 0 ' + f(Rt[Rt.length - 1][0]) + ' ' + f(Rt[Rt.length - 1][1]);
    for (let j = Rt.length - 2; j >= 0; j--) d += 'L' + f(Rt[j][0]) + ' ' + f(Rt[j][1]);
    d += 'A' + f(w0) + ' ' + f(w0) + ' 0 0 0 ' + f(Lf[0][0]) + ' ' + f(Lf[0][1]) + 'Z';
    return d;
  }
  const PEN_W = .085, HL_W = .75;   // halve dikte in balkruimtes
  function strokeShape(g, pts, sp, hl){   // pts = absolute punten [[x, y, w]]
    if (hl){
      let d = 'M' + r3(pts[0][0]) + ' ' + r3(pts[0][1]);
      if (pts.length === 1) d += 'l.01 0';
      chaikin(pts).slice(1).forEach(q => { d += 'L' + r3(q[0]) + ' ' + r3(q[1]); });
      el('path', { d, fill:'none', stroke:'currentColor', 'stroke-width':r3(HL_W * 2 * sp), 'stroke-linecap':'round', 'stroke-linejoin':'round' }, g);
    } else el('path', { d:outline(pts.map(q => [q[0], q[1], Math.max(.6, PEN_W * sp * q[2])])), fill:'currentColor' }, g);
  }
  function hairpin(g, x1, x2, y, o1, o2){
    el('path', { d:'M' + r3(x2) + ' ' + r3(y - o2) + 'L' + r3(x1) + ' ' + r3(y - o1) + (o1 > .01 ? 'M' + r3(x1) + ' ' + r3(y + o1) : '') + 'L' + r3(x2) + ' ' + r3(y + o2),
      fill:'none', stroke:'currentColor', 'stroke-width':r3(Math.max(.8, g._sp * .13)), 'stroke-linecap':'round', 'stroke-linejoin':'round' }, g);
  }
  function slurShape(g, x1, x2, y, dir, sp){
    const xm = (x1 + x2) / 2, h = Math.min(2.4 * sp, Math.max(.7 * sp, (x2 - x1) * .16)), t = .2 * sp;
    el('path', { d:'M' + r3(x1) + ' ' + r3(y) + 'Q' + r3(xm) + ' ' + r3(y + dir * 2 * h) + ' ' + r3(x2) + ' ' + r3(y) +
      'Q' + r3(xm) + ' ' + r3(y + dir * 2 * (h - t)) + ' ' + r3(x1) + ' ' + r3(y) + 'Z', fill:'currentColor', stroke:'currentColor', 'stroke-width':r3(sp * .04) }, g);
  }
  function spanShape(g, k, A, B, dyA){   // A, B = {x, y, sp, li}; over twee regels: tot het eind van de eerste en vanaf het begin van de tweede
    const sp = A.sp; g._sp = sp;
    const segs = [];
    if (A.li === B.li){ const x1 = Math.min(A.x, B.x), x2 = Math.max(A.x, B.x); segs.push([x1, x2, A.y, 0, 1]); }
    else {
      const [P, Q] = A.li < B.li ? [A, B] : [B, A];
      segs.push([P.x, G.lines[P.li].r + .5 * sp, P.y, 0, .5]);
      segs.push([Math.min(Q.x - 2 * sp, G.lines[Q.li].l - 1.5 * sp), Q.x, Q.y, .5, 1]);
    }
    segs.forEach(([x1, x2, y, f1, f2]) => {
      if (x2 - x1 < sp * .5) x2 = x1 + sp * .5;
      const o = .55 * sp;
      if (k === 'cresc') hairpin(g, x1, x2, y, o * f1, o * f2);
      else if (k === 'dim') hairpin(g, x1, x2, y, o * (1 - f1), o * (1 - f2));
      else slurShape(g, x1, x2, y, dyA > 2 ? 1 : -1, sp);
    });
  }
  function drawItem(it, root){
    const g = el('g', { class:'pa-it pa-' + (it.hl ? 'hl' : (it.c || 'ink')) + (it.ok || (it.k === 'blk' && blkDone(it)) ? ' pa-done' : '') + (it.k === 'blk' ? ' pa-blk' : '') + (sel.has(it.id) ? ' pa-sel' : '') }, root);
    g.dataset.aid = it.id;
    if (it.t === 's' && it.k === 'blk'){
      const p = pos(it.a), e = blkEmo(it); if (!p || !e){ g.remove(); return null; }
      drawStamp(g, { x:'t', st:symE(e) ? 'sym' : 'emo', v:e }, p.x, p.y, p.sp, it.z || 1);
    } else if (it.t === 's'){
      const p = pos(it.a), d = stamp(it.k); if (!p || !d){ g.remove(); return null; }
      drawStamp(g, d, p.x, p.y, p.sp, it.z || 1);
    } else if (it.t === 'p'){
      const p = pos(it.a); if (!p || !it.p || !it.p.length){ g.remove(); return null; }
      const pts = it.p.map(q => [p.x + q[0] * p.sp, p.y + q[1] * p.sp, q[2] == null ? 1 : q[2]]);
      g._pts = pts; g._sp = p.sp;
      strokeShape(g, pts, p.sp, it.hl);
    } else if (it.t === 'h'){
      const A = pos(it.a), B = pos(it.b); if (!A || !B){ g.remove(); return null; }
      spanShape(g, it.k, A, B, it.a.dy);
    } else if (it.t === 'x'){
      const p = pos(it.a); if (!p || !it.v){ g.remove(); return null; }
      g._sp = p.sp; drawText(g, it.v, p.x, p.y, p.sp, it.z || 1);
    } else { g.remove(); return null; }
    return g;
  }
  const TXT_Z = 1.5;   // tekstgrootte in balkruimtes
  function drawText(g, v, x, y, sp, z){
    const fs = TXT_Z * sp * z;
    const t = el('text', { x:r3(x), y:r3(y), 'font-size':r3(fs), 'font-family':SANS, 'font-weight':500, 'dominant-baseline':'central', fill:'currentColor' }, g);
    String(v).split('\n').forEach((line, j) => { const ts = el('tspan', { x:r3(x), dy:j ? '1.2em' : '0' }, t); ts.textContent = line || ' '; });
  }
  let raf = 0, root = null, draft = null;
  function redraw(){ if (raf) return; raf = requestAnimationFrame(() => { raf = requestAnimationFrame(render); }); }
  function layerRoot(){
    const lay = $('paLayer'), sh = $('ptSheet');
    lay.setAttribute('width', Math.max(1, sh.scrollWidth)); lay.setAttribute('height', Math.max(1, sh.scrollHeight));
    lay.textContent = '';
    root = el('g', { transform:'translate(' + (-sh.clientLeft) + ' ' + (-sh.clientTop) + ')' }, lay);
    return root;
  }
  function migrate(){   // oude plek-stempels (⚠️ 👓 ○ ↑ ↓ 🔁, v1.20/21) worden blok-markeringen met een eigen blok
    if (!ptCur || !ptSteps.length || !ptCur.ann || typeof ptBlkNew !== 'function') return;
    let ch = false;
    ptCur.ann.forEach(it => {
      if (it.t !== 's' || !OLDBLK[it.k] || !it.a || !ptSteps[it.a.i]) return;
      const e = OLDBLK[it.k], p = pasOf(it);
      it.k = 'blk'; it.e = e;
      if (p){ if (!p.emo) p.emo = e; if (it.ok) p.status = 'zit'; }
      else { const nb = ptBlkNew(it); if (nb && it.ok) nb.status = 'zit'; }
      delete it.ok; delete it.okd; ch = true;
    });
    if (ch){ ptSaveCur(); if (typeof ptPasUI === 'function') ptPasUI(); }
  }
  function blkMsg(p){ msg('Blok "' + (p.emo ? p.emo + ' ' : '') + p.naam + '" gemaakt (maat ' + p.from + '–' + p.to + '). Zie ▦ Blokken bovenin.'); clearTimeout(blkMsg.t); blkMsg.t = setTimeout(() => msg(''), 4500); }
  function ensureMarker(p){   // blok kreeg een emoji (☺): markering in de partituur bij de eerste maat van het blok
    if (!ptCur || !p || !p.emo) return;
    if (items().some(it => it.k === 'blk' && it.pas === p.id)) { render(); return; }
    const i = ptSteps.findIndex(st => st.mn === p.from); if (i < 0) return;
    const V = visStaves();
    items().push({ id:uid(), t:'s', k:'blk', e:p.emo, pas:p.id, c:'ink', z:1, l:S().layer, a:{ i, st:V[0], dx:0, dy:-3.2 } });
    ptSaveCur(); render();
  }
  function dropMarkers(pid){ if (!ptCur || !ptCur.ann) return; const n = ptCur.ann.length; ptCur.ann = ptCur.ann.filter(it => !(it.k === 'blk' && it.pas === pid)); if (ptCur.ann.length !== n) ptSaveCur(); render(); }
  function render(){
    raf = 0;
    migrate();
    const lay = $('paLayer'); if (!lay) return;
    if (typeof ptPlekUI === 'function') ptPlekUI();   // lijst met lastige plekken (js/plekken.js)
    const s = S();
    lay.classList.toggle('pa-off', !s.show && !active);
    if (!ptCur || !ptSteps.length || !ptEls.length || !$('ptView').classList.contains('pt-play')){ lay.textContent = ''; root = null; return; }
    G = null; geo();
    const r = layerRoot();
    const items = ptCur.ann || [];
    const vis = items.filter(shown);
    vis.filter(it => it.hl).concat(vis.filter(it => !it.hl)).forEach(it => { if (!(mv && mv.it.id === it.id) && !(ed && ed.id === it.id)) drawItem(it, r); });
    selFrame(r);
    draft = el('g', { class:'pa-draft' }, r);
    if (mv) drawMove();
  }
  /* ---------- printen: alle (zichtbare) aantekeningen als losse <g> in coördinaten van #ptSheet ---------- */
  function printLayer(o){
    const g = document.createElementNS(NS, 'g');
    if (!ptCur || !o || !o.ann) return g;
    geo();
    const list = (ptCur.ann || []).filter(it => (o.hidden || shown(it)) && !(o.noDone && (it.ok || (it.k === 'blk' && blkDone(it)))));
    list.filter(it => it.hl).concat(list.filter(it => !it.hl)).forEach(it => { const x = drawItem(it, g); if (x){ x.classList.remove('pa-sel'); delete x.dataset.aid; } });
    return g;
  }

  /* ---------- bewerken ---------- */
  let active = false, undo = [], redo = [], forId = null, cur = null, mv = null, sawPen = false, eatClick = 0, ed = null, lRen = null;
  const sel = new Set();   // geselecteerde aantekeningen (id's), gereedschap ➰
  function items(){ if (!ptCur.ann) ptCur.ann = []; return ptCur.ann; }
  function checkPiece(){ if (ptCur && ptCur.id !== forId){ forId = ptCur.id; undo = []; redo = []; sel.clear(); } }
  function stateStr(){ return JSON.stringify({ ann:items(), pas:(ptCur.pas || []) }); }
  function restoreState(str){
    const o = JSON.parse(str);
    if (Array.isArray(o)){ ptCur.ann = o; return; }
    ptCur.ann = o.ann || [];
    const curP = ptCur.pas || [], ids = new Set((o.pas || []).map(p => p.id));
    const list = (o.pas || []).map(sp => { const c = curP.find(x => x.id === sp.id); if (!c) return sp; if (sp.emo) c.emo = sp.emo; else delete c.emo; return c; });
    curP.forEach(c => { if (!ids.has(c.id) && !(c.viaMark && !c.ok && !c.secs && !c.last)) list.push(c); });   // nieuw blok van een emoji, nog niet geoefend: mag weg
    ptCur.pas = list;
    if (ptCur.pcur && !list.some(p => p.id === ptCur.pcur)) ptCur.pcur = null;
    if (typeof ptPasUI === 'function') ptPasUI();
  }
  function snap(){ checkPiece(); undo.push(stateStr()); if (undo.length > 60) undo.shift(); redo = []; undoUI(); }
  function unhideCur(){   // tekenen op een verborgen laag: die laag weer tonen, anders zie je niets
    const L = S().layer, h = hiddenSet(); if (!ptCur || !h.has(L)) return;
    h.delete(L); ptCur.annHide = [...h];
    const l = S().layers.find(x => x.id === L); msg('Laag "' + (l ? l.n : '') + '" stond verborgen en is weer zichtbaar.'); setTimeout(() => msg(''), 4000);
    layersUI();
  }
  function commit(){ ptSaveCur(); undoUI(); const ids = new Set(items().map(x => x.id)); [...sel].forEach(id => { if (!ids.has(id)) sel.delete(id); }); render(); selUI(); }
  function doUndo(){ checkPiece(); if (!undo.length) return; redo.push(stateStr()); restoreState(undo.pop()); commit(); }
  function doRedo(){ checkPiece(); if (!redo.length) return; undo.push(stateStr()); restoreState(redo.pop()); commit(); }
  function undoUI(){ const u = $('paUndo'), r = $('paRedo'); if (u) u.disabled = !undo.length; if (r) r.disabled = !redo.length; }
  const toP = e => ptToSheet(e.clientX, e.clientY);
  const spAt = p => { const li = lineAt(p); return li != null ? G.lines[li].sp : G.sp; };
  const pr = e => e.pointerType === 'pen' && e.pressure > 0 ? .45 + 1.1 * e.pressure : 1;

  function hitTest(p, kinds){   // bovenste aantekening onder punt p
    if (!root) return null;
    const list = [...root.querySelectorAll('.pa-it')].reverse();
    for (const g of list){
      const it = items().find(x => x.id === g.dataset.aid); if (!it || (kinds && !kinds.includes(it.t))) continue;
      const sp = g._sp || G.sp;
      if (it.t === 'p'){
        const tol = Math.max(.7 * sp, it.hl ? HL_W * sp : 0), P2 = g._pts;
        for (let j = 0; j < P2.length; j++){
          const a = P2[j], b = P2[Math.min(P2.length - 1, j + 1)];
          if (distSeg(p, a, b) < tol) return { it, g };
        }
        continue;
      }
      let bb; try { bb = g.getBBox(); } catch(e){ continue; }
      const m = .35 * sp;
      if (p.x >= bb.x - m && p.x <= bb.x + bb.width + m && p.y >= bb.y - m && p.y <= bb.y + bb.height + m) return { it, g };
    }
    return null;
  }
  function distSeg(p, a, b){
    const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
    let t = L2 ? ((p.x - a[0]) * vx + (p.y - a[1]) * vy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a[0] + t * vx), p.y - (a[1] + t * vy));
  }
  function center(g){ const bb = g.getBBox(); return { x:bb.x + bb.width / 2, y:bb.y + bb.height / 2 }; }
  function drawMove(){   // verplaatsen/plaatsen van een stempel: voorbeeld op de vinger
    if (!draft || !mv) return;
    draft.textContent = '';
    const g = el('g', { class:'pa-it pa-' + (mv.it.c || 'ink') }, draft);
    if (mv.it.t === 'x'){ drawText(g, mv.it.v, mv.x, mv.y, spAt(mv), mv.it.z || 1); return; }
    if (mv.it.k === 'blk'){ const e = blkEmo(mv.it); drawStamp(g, { x:'t', st:symE(e) ? 'sym' : 'emo', v:e }, mv.x, mv.y, spAt(mv), mv.it.z || 1); return; }
    const d = stamp(mv.it.k);
    if (d) drawStamp(g, d, mv.x, mv.y, spAt(mv), mv.it.z || 1);
  }

  function start(e, tool){
    const s = S(); geo(); checkPiece();
    const p = toP(e);
    if (tool === 'pen' || tool === 'hl'){
      const a = anchorAt(p, false); if (!a) return false;
      cur = { kind:'stroke', a, sp:spAt(p), hl:tool === 'hl', c:tool === 'hl' ? 'hl' : s.color, pts:[[p.x, p.y, tool === 'hl' ? 1 : pr(e)]], id:e.pointerId };
      liveStroke();
      return true;
    }
    if (tool === 'erase'){ snap(); cur = { kind:'erase', any:false, id:e.pointerId }; if (!eraseAt(p)) undo.pop(), cur.any = false; else cur.any = true; undoUI(); return true; }
    if (tool === 'stamp'){
      const d = stamp(s.stamp); if (!d) return false;
      if (d.x === 'span'){
        const a = anchorAt(p, true); if (!a) return false;
        cur = { kind:'span', k:d.k, a, p0:p, p1:p, sp:spAt(p), id:e.pointerId }; liveSpan(); return true;
      }
      if (d.x === 'ask'){ askText(d.v); return false; }
      const h = hitTest(p, ['s', 'x']);
      if (h){ grab(h, p, e); return true; }
      mv = { it:d.x === 'blk' ? { id:uid(), t:'s', k:'blk', e:d.e, nm:d.nm, c:s.color, z:s.size, l:s.layer } : { id:uid(), t:'s', k:s.stamp, c:s.color, z:s.size, l:s.layer }, x:p.x, y:p.y, ox:0, oy:0, isNew:true };
      drawMove(); cur = { kind:'move', id:e.pointerId, p0:p };
      return true;
    }
    if (tool === 'select'){
      const bb = selBox();
      if (bb && sel.size){
        const m = .5 * (G.sp || 10);
        if (p.x >= bb.x - m && p.x <= bb.x + bb.w + m && p.y >= bb.y - m && p.y <= bb.y + bb.h + m){
          cur = { kind:'selmove', p0:p, d:{ x:0, y:0 }, id:e.pointerId }; return true;
        }
      }
      cur = { kind:'lasso', pts:[p], id:e.pointerId }; liveLasso(); return true;
    }
    if (tool === 'text'){
      if (ed){ edDone(true); return false; }
      const h = hitTest(p, ['x']);
      if (h){ grab(h, p, e); cur.edit = true; return true; }   // tikken = bewerken, slepen = verplaatsen
      const a = anchorAt(p, false); if (!a) return false;
      edOpen(null, a);
      return false;
    }
    return false;
  }
  function grab(h, p, e){   // bestaande stempel of tekst vastpakken
    const base = h.it.t === 'x' ? pos(h.it.a) : center(h.g);
    mv = { it:h.it, x:base.x, y:base.y, ox:base.x - p.x, oy:base.y - p.y, isNew:false };
    h.g.remove(); drawMove(); cur = { kind:'move', id:e.pointerId, p0:p };
  }
  function move(e){
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null, list = evs && evs.length ? evs : [e];
    if (cur.kind === 'stroke'){
      list.forEach(ev => { const p = toP(ev), l = cur.pts[cur.pts.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) > .6) cur.pts.push([p.x, p.y, cur.hl ? 1 : pr(ev)]); });
      liveStroke();
    } else if (cur.kind === 'erase'){ if (eraseAt(toP(e))) cur.any = true; }
    else if (cur.kind === 'span'){ cur.p1 = toP(e); liveSpan(); }
    else if (cur.kind === 'move'){ const p = toP(e); mv.x = p.x + mv.ox; mv.y = p.y + mv.oy; drawMove(); }
    else if (cur.kind === 'lasso'){ list.forEach(ev => cur.pts.push(toP(ev))); liveLasso(); }
    else if (cur.kind === 'selmove'){
      const p = toP(e); cur.d = { x:p.x - cur.p0.x, y:p.y - cur.p0.y };
      const tr = 'translate(' + r3(cur.d.x) + ' ' + r3(cur.d.y) + ')';
      root.querySelectorAll('.pa-sel, .pa-selbox').forEach(g => g.setAttribute('transform', tr));
    }
  }
  function end(e, cancel){
    const c = cur; cur = null; if (!c) return;
    if (c.kind === 'stroke'){
      if (cancel || !draft){ render(); return; }
      const base = pos(c.a); if (!base){ render(); return; }
      const sp = base.sp;
      const rel = simplify(c.pts.map(q => [r3((q[0] - base.x) / sp), r3((q[1] - base.y) / sp), r3(q[2])]), .03);
      snap(); unhideCur(); items().push({ id:uid(), t:'p', a:c.a, p:rel, c:c.c, hl:c.hl ? 1 : 0, l:S().layer }); commit();
    } else if (c.kind === 'erase'){ if (!c.any) undo.pop(); else commit(); undoUI(); }
    else if (c.kind === 'span'){
      if (cancel){ render(); return; }
      let p1 = c.p1; if (Math.hypot(p1.x - c.p0.x, p1.y - c.p0.y) < c.sp * .8) p1 = { x:c.p0.x + 5 * c.sp, y:c.p0.y };
      let b = anchorAt({ x:p1.x, y:Math.abs(p1.y - c.p0.y) < 3 * c.sp ? c.p0.y : p1.y }, true);
      if (!b){ render(); return; }
      b = Object.assign(b, { st:c.a.st, dy:c.a.dy });
      if (b.i === c.a.i && Math.abs(b.dx - c.a.dx) < .5) b.dx = r3(c.a.dx + 4);
      snap(); unhideCur(); items().push({ id:uid(), t:'h', k:c.k, a:c.a, b, c:S().color, l:S().layer }); commit();
    } else if (c.kind === 'lasso'){
      if (cancel){ render(); return; }
      const P = c.pts, sp = G.sp || 10;
      let len = 0; for (let j = 1; j < P.length; j++) len += Math.hypot(P[j].x - P[j - 1].x, P[j].y - P[j - 1].y);
      if (len < sp){   // tikken: één aantekening erbij of eraf
        const h = hitTest(P[0]);
        if (h){ if (sel.has(h.it.id)) sel.delete(h.it.id); else sel.add(h.it.id); } else sel.clear();
      } else {
        sel.clear();
        root.querySelectorAll('.pa-it[data-aid]').forEach(g => {
          let bb; try { bb = g.getBBox(); } catch(x){ return; }
          if (inPoly({ x:bb.x + bb.width / 2, y:bb.y + bb.height / 2 }, P)) sel.add(g.dataset.aid);
        });
      }
      render(); selUI();
    } else if (c.kind === 'selmove'){
      if (cancel || Math.hypot(c.d.x, c.d.y) < 1){ render(); return; }
      snap();
      items().filter(it => sel.has(it.id)).forEach(it => shiftItem(it, c.d.x, c.d.y));
      commit();
    } else if (c.kind === 'move'){
      const m = mv; mv = null;
      if (cancel){ render(); return; }
      const moved = Math.hypot(m.x - (c.p0.x + m.ox), m.y - (c.p0.y + m.oy)) > 1;
      if (!m.isNew && !moved){ render(); if (c.edit) edOpen(m.it); return; }   // alleen aangetikt: blijft staan (tekst: bewerken)
      const a = anchorAt({ x:m.x, y:m.y }, m.it.t !== 'x');
      if (!a){ render(); return; }
      snap();
      unhideCur(); if (m.isNew){ m.it.a = a; items().push(m.it); if (m.it.k === 'blk' && typeof ptBlkNew === 'function'){ const nb = ptBlkNew(m.it); delete m.it.nm; if (nb) blkMsg(nb); } }
      else { const it = items().find(x => x.id === m.it.id); if (it) it.a = a; }
      commit();
    }
  }
  /* ---------- selecteren ---------- */
  function inPoly(pt, P){
    let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++){
      const a = P[i], b = P[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
    }
    return inside;
  }
  function selBox(){
    if (!root || !sel.size) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    root.querySelectorAll('.pa-sel').forEach(g => { let bb; try { bb = g.getBBox(); } catch(e){ return; } x1 = Math.min(x1, bb.x); y1 = Math.min(y1, bb.y); x2 = Math.max(x2, bb.x + bb.width); y2 = Math.max(y2, bb.y + bb.height); });
    return isFinite(x1) ? { x:x1, y:y1, w:x2 - x1, h:y2 - y1 } : null;
  }
  function selFrame(r){
    const bb = selBox(); if (!bb) return;
    const m = .4 * (G.sp || 10);
    el('rect', { class:'pa-selbox', x:r3(bb.x - m), y:r3(bb.y - m), width:r3(bb.w + 2 * m), height:r3(bb.h + 2 * m), rx:4 }, r);
  }
  function liveLasso(){
    if (!draft) return;
    draft.textContent = '';
    el('path', { class:'pa-lasso', d:'M' + cur.pts.map(q => r3(q.x) + ' ' + r3(q.y)).join('L') }, draft);
  }
  function shiftItem(it, dx, dy){   // verplaatsen = opnieuw verankeren op de nieuwe plek
    const mv1 = a => { const p = pos(a); return p ? anchorAt({ x:p.x + dx, y:p.y + dy }, false) : null; };
    const a = mv1(it.a); if (!a) return;
    if (it.t === 'h'){ const b = mv1(it.b); if (!b) return; it.b = Object.assign(b, { st:a.st, dy:a.dy }); }
    it.a = a;
  }
  function selUI(){
    const row = $('paBar') && $('paBar').querySelector('.pasel'); if (!row) return;
    const s = S(); row.hidden = !(active && s.tool === 'select');
    $('paBar').querySelector('.pacolors').classList.toggle('dim', s.tool === 'hl' || s.tool === 'erase' || s.tool === 'pan' || (s.tool === 'select' && !sel.size));
    if (row.hidden) return;
    const n = sel.size;
    row.innerHTML = n ? `<span class="pacount">${n} geselecteerd</span>
        <label class="pasellay">Laag <select id="paSelLay">${s.layers.map(l => `<option value="${l.id}">${ptEsc(l.n)}</option>`).join('')}<option value="" selected disabled>kiezen…</option></select></label>
        <button id="paSelDel" title="Verwijderen (Delete)">🗑 Weg</button><button id="paSelAll" title="Alles selecteren (Ctrl+A)">Alles</button><button id="paSelNone" title="Niets selecteren">✕</button>
        <span class="pahint">Sleep binnen het kader om te verplaatsen · kleurtje = kleur wijzigen</span>`
      : `<span class="pahint">Trek een lus om aantekeningen heen, of tik er een aan. Daarna slepen = verplaatsen.</span><button id="paSelAll">Alles</button>`;
    const ls = $('paSelLay');
    if (ls) ls.onchange = () => { snap(); items().forEach(it => { if (sel.has(it.id)) it.l = ls.value; }); commit(); };
  }
  function selDo(id){
    if (id === 'paSelDel'){ if (!sel.size) return; snap(); ptCur.ann = items().filter(it => !sel.has(it.id)); sel.clear(); commit(); }
    else if (id === 'paSelAll'){ items().filter(shown).forEach(it => sel.add(it.id)); render(); selUI(); }
    else if (id === 'paSelNone'){ sel.clear(); render(); selUI(); }
  }
  /* ---------- tekstvakje typen (Enter = klaar, Shift+Enter = nieuwe regel, Esc = annuleren) ---------- */
  function edOpen(it, a){
    if (ed) edDone(true);
    geo();
    const anc = it ? it.a : a, p = pos(anc); if (!p) return;
    const s = S(), z = it ? (it.z || 1) : s.size, sh = $('ptSheet');
    ed = { id:it ? it.id : null, a:anc, c:it ? it.c : s.color, z };
    const ta = document.createElement('textarea');
    ta.className = 'patxted pa-' + ed.c; ta.rows = 1; ta.value = it ? it.v : '';
    ta.placeholder = 'Typ je tekst…';
    const fs = TXT_Z * p.sp * z;
    Object.assign(ta.style, { left:(p.x - sh.clientLeft - 4) + 'px', top:(p.y - sh.clientTop - fs * .75) + 'px', fontSize:fs + 'px' });
    sh.appendChild(ta);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; ta.style.width = 'auto'; ta.style.width = Math.max(fs * 6, Math.min(fs * 30, ta.scrollWidth + 8)) + 'px'; };
    ta.addEventListener('input', fit);
    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); edDone(true); }
      else if (e.key === 'Escape'){ e.preventDefault(); edDone(false); }
    });
    ta.addEventListener('pointerdown', e => e.stopPropagation());
    ta.addEventListener('blur', () => setTimeout(() => { if (ed && ed.ta === ta) edDone(true); }, 0));
    ed.ta = ta;
    if (it) render();   // het oude vakje verbergen terwijl je typt
    fit(); setTimeout(() => ta.focus(), 0);
  }
  function edDone(keep){
    const e = ed; if (!e) return; ed = null;
    const v = keep ? e.ta.value.replace(/\s+$/, '').slice(0, 300) : null;
    e.ta.remove();
    if (keep){
      const old = e.id && items().find(x => x.id === e.id);
      if (old && v !== old.v){ snap(); if (v) old.v = v; else ptCur.ann = items().filter(x => x !== old); commit(); return; }
      if (!old && v){ snap(); unhideCur(); items().push({ id:uid(), t:'x', v, a:e.a, c:e.c, z:e.z, l:S().layer }); commit(); return; }
    }
    render();
  }
  function eraseAt(p){
    const h = hitTest(p); if (!h) return false;
    ptCur.ann = items().filter(x => x !== h.it); h.g.remove();
    return true;
  }
  function liveStroke(){
    if (!draft) return;
    draft.textContent = '';
    const g = el('g', { class:'pa-it pa-' + (cur.hl ? 'hl' : cur.c) }, draft);
    strokeShape(g, cur.pts, cur.sp, cur.hl);
  }
  function liveSpan(){
    if (!draft) return;
    draft.textContent = '';
    const g = el('g', { class:'pa-it pa-' + S().color }, draft), sp = cur.sp;
    const x1 = Math.min(cur.p0.x, cur.p1.x), x2 = Math.max(cur.p0.x, cur.p1.x, x1 + sp * .5);
    g._sp = sp;
    if (cur.k === 'cresc') hairpin(g, x1, x2, cur.p0.y, 0, .55 * sp);
    else if (cur.k === 'dim') hairpin(g, x1, x2, cur.p0.y, .55 * sp, 0);
    else slurShape(g, x1, x2, cur.p0.y, cur.a.dy > 2 ? 1 : -1, sp);
  }
  function simplify(P, eps){   // Ramer–Douglas–Peucker (kleinere opslag)
    if (P.length < 3) return P;
    const keep = new Array(P.length).fill(false); keep[0] = keep[P.length - 1] = true;
    (function rd(a, b){
      let md = 0, mi = -1;
      for (let j = a + 1; j < b; j++){
        const d = distSeg({ x:P[j][0], y:P[j][1] }, P[a], P[b]) + Math.abs(P[j][2] - (P[a][2] + P[b][2]) / 2) * .05;
        if (d > md){ md = d; mi = j; }
      }
      if (md > eps && mi > 0){ keep[mi] = true; rd(a, mi); rd(mi, b); }
    })(0, P.length - 1);
    return P.filter((_, j) => keep[j]);
  }

  /* ---------- invoer ---------- */
  function initInput(){
    const sh = $('ptSheet');
    const lay = el('svg', { id:'paLayer', class:'palayer', 'aria-hidden':'true', 'data-noicon':'1' });
    sh.appendChild(lay);
    const inp = document.createElement('div'); inp.id = 'paInput'; inp.className = 'painput'; inp.hidden = true;
    sh.appendChild(inp);
    const down = (e, tool) => {
      if (e.button > 0) return false;
      if (!ptCur || !ptSteps.length || !ptEls.length) return false;
      if (!start(e, tool)) return false;
      e.preventDefault(); e.stopPropagation();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch(x){}
      return true;
    };
    inp.addEventListener('pointerdown', e => {
      if (e.pointerType === 'pen' && !sawPen){ sawPen = true; inp.classList.add('pa-pen'); }
      if (e.pointerType === 'touch' && sawPen) return;   // met een stylus: vingers scrollen, de pen tekent
      down(e, S().tool);
    });
    inp.addEventListener('pointermove', e => { if (cur && e.pointerId === cur.id){ e.preventDefault(); move(e); } });
    inp.addEventListener('pointerup', e => { if (cur && e.pointerId === cur.id) end(e, false); });
    inp.addEventListener('pointercancel', e => { if (cur && e.pointerId === cur.id) end(e, true); });
    // iPad: de Apple Pencil scrolt anders de pagina (touchType 'stylus'); vingers mogen scrollen
    const noPencilScroll = e => { if (Array.from(e.touches || []).some(t => t.touchType === 'stylus') && (active || S().stylus)) e.preventDefault(); };
    inp.addEventListener('touchstart', noPencilScroll, { passive:false });
    inp.addEventListener('touchmove', noPencilScroll, { passive:false });
    sh.addEventListener('touchstart', noPencilScroll, { passive:false });
    sh.addEventListener('touchmove', noPencilScroll, { passive:false });
    // stylus zonder tekenmodus: tekent meteen met de pen (de cursor verplaatsen gaat dan met vinger of muis)
    sh.addEventListener('pointerdown', e => {
      if (active || e.pointerType !== 'pen' || !S().stylus) return;
      sawPen = true;
      if (down(e, S().tool === 'hl' ? 'hl' : 'pen')){ eatClick = Date.now(); sh._paCap = e.pointerId; }
    }, true);
    sh.addEventListener('pointermove', e => { if (!active && cur && e.pointerId === cur.id){ e.preventDefault(); e.stopPropagation(); move(e); } }, true);
    sh.addEventListener('pointerup', e => { if (!active && cur && e.pointerId === cur.id){ e.stopPropagation(); eatClick = Date.now(); end(e, false); } }, true);
    sh.addEventListener('pointercancel', e => { if (!active && cur && e.pointerId === cur.id) end(e, true); }, true);
    // in de tekenmodus (behalve ✋) en net na een penstreep: klikken verplaatst de cursor niet
    ['click', 'dblclick'].forEach(t => sh.addEventListener(t, e => {
      const t = e.target, inEd = t && t.closest && t.closest('.patxted');
      if (inEd){ e.stopPropagation(); return; }   // klikken in een tekstvakje: niet de cursor verplaatsen
      if ((active && S().tool !== 'pan') || Date.now() - eatClick < 400){ e.stopPropagation(); e.preventDefault(); }
    }, true));
  }

  /* ---------- werkbalk ---------- */
  const COLORS = { ink:'Zwart', red:'Rood', blue:'Blauw' };
  function barHTML(){
    return `<div class="parow patools">
      <button data-tool="pan" title="Bladeren: scrollen en de cursor gebruiken (aantekeningen blijven zichtbaar)">✋</button>
      <button data-tool="pen" title="Pen">✏️</button>
      <button data-tool="hl" title="Markeerstift">🖍️</button>
      <button data-tool="erase" title="Gum: tik of veeg over een aantekening">🧽</button>
      <button data-tool="select" title="Selecteren: lus trekken of aantikken, daarna slepen, laag of kleur wijzigen, verwijderen">➰</button>
      <button data-tool="text" title="Tekst: tik waar de tekst moet komen en typ (Enter = klaar). Tik op een tekst om hem te wijzigen, sleep om te verplaatsen.">🔤</button>
      <button data-tool="stamp" title="Stempels: kies er een en tik op de partituur. Een stempel verslepen = verplaatsen.">🏷️</button>
      <span class="pacolors">${Object.keys(COLORS).map(c => `<button data-c="${c}" class="pa-${c}" title="${COLORS[c]}"><i></i></button>`).join('')}</span>
      <span class="pasep"></span>
      <button id="paUndo" title="Ongedaan maken (Ctrl+Z)">↶</button><button id="paRedo" title="Opnieuw (Ctrl+Shift+Z)">↷</button>
      <button id="paLay" title="Lagen: kies waarop je tekent en welke lagen je ziet">🗂️</button>
      <button id="paEye" title="Aantekeningen tonen of verbergen (buiten de tekenmodus)">👁</button>
      <button id="paDone" class="primary" title="Klaar (Esc)">✓ Klaar</button>
    </div>
    <div class="parow pastamps" hidden>
      <div class="patabs"></div>
      <div class="pagrid"></div>
      <div class="paopts">
        <span class="pacur" id="paCur"></span>
        <button id="paFav" title="Bij je favorieten (★) zetten">☆</button>
        <span class="paseg" id="paSize" title="Grootte van nieuwe stempels"><button data-z=".8">A</button><button data-z="1">A</button><button data-z="1.3">A</button></span>
        <button id="paDel" hidden title="Deze eigen stempel weghalen">🗑</button>
      </div>
    </div>
    <div class="parow pasel" hidden></div>
    <div class="parow palayers" hidden></div>
    <div class="pamsg" id="paMsg" hidden></div>`;
  }
  function instr(){ const i = ptCur && ptCur.instr; return SETS[i] ? i : 'overig'; }
  function tabsFor(){ return SETS[instr()]; }
  function tabIds(t){
    const s = S();
    if (t === 'fav') return s.fav.filter(k => stamp(k));
    if (t === 'more') return TABS.more.ids.concat(s.custom.map(x => 'c:' + x));
    return TABS[t].ids;
  }
  function btnIcon(d){
    if (d.x === 'blk') return `<span style="font-size:${symE(d.e) ? 20 : 19}px;font-family:${(symE(d.e) ? ST.sym : ST.emo).f.replace(/"/g, '&quot;')}">${d.e}</span>`;
    if (d.x === 'span'){
      const svg = '<svg viewBox="-12 -8 24 16" width="26" height="18">' +
        (d.k === 'slur' ? '<path d="M-10 3Q0 -9 10 3Q0 -6 -10 3Z" fill="currentColor"/>' :
         d.k === 'cresc' ? '<path d="M10 -5L-10 0L10 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' :
         '<path d="M-10 -5L10 0L-10 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>') + '</svg>';
      return svg;
    }
    if (d.x === 'p'){
      const tall = d.id === 'brl' || d.id === 'brr';
      const s = tall ? 3.6 : 9;
      return '<svg viewBox="-14 -14 28 28" width="24" height="24"><g transform="scale(' + s + ')">' + d.s.map(([p, how, w]) =>
        how === 'fill' ? `<path d="${p}" fill="currentColor"/>` : `<path d="${p}" fill="none" stroke="currentColor" stroke-width="${tall ? w * 2.2 : w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') + '</g></svg>';
    }
    if (d.x === 'ask') return '<span class="pa-ital">' + ptEsc(d.n) + '</span>';
    const st = ST[d.st] || ST.cust;
    const fs = Math.min(22, Math.max(12, st.z * 9));
    return `<span style="font-family:${st.f.replace(/"/g, '&quot;')};font-weight:${st.w};font-style:${st.i ? 'italic' : 'normal'};font-size:${fs}px">${ptEsc(d.v)}</span>`;
  }
  function stampsUI(){
    const s = S(), bar = $('paBar'); if (!bar) return;
    const tabs = tabsFor();
    if (!tabs.includes(s.tab)) s.tab = tabs[0];
    const both = tabs.includes('vfing') && tabs.includes('pfing');   // Overig: twee keer Fingers → zeggen welke
    const tn = t => both && t === 'vfing' ? 'Fingers 🎻' : both && t === 'pfing' ? 'Fingers 🎹' : TABS[t].n;
    bar.querySelector('.patabs').innerHTML = tabs.map(t => `<button data-tab="${t}" class="${t === s.tab ? 'on' : ''}">${tn(t)}</button>`).join('');
    const ids = tabIds(s.tab);
    let html = ids.map(k => { const d = stamp(k); return d ? `<button data-st="${ptEsc(k)}" class="${k === s.stamp ? 'on' : ''}" title="${ptEsc(d.n)}">${btnIcon(d)}</button>` : ''; }).join('');
    if (s.tab === 'fav' && !ids.length) html = '<span class="pahint">Nog geen favorieten. Kies een stempel en tik op ☆.</span>';
    if (s.tab === 'more') html += '<span class="patxt"><input type="text" id="paTxt" maxlength="40" placeholder="Eigen tekst, bv. shift 3→1"><button id="paTxtAdd" title="Als stempel bewaren en kiezen">＋</button></span>';
    bar.querySelector('.pagrid').innerHTML = html;
    const d = stamp(s.stamp);
    $('paCur').innerHTML = d ? 'Stempel: <b>' + ptEsc(d.n) + '</b>' : '';
    $('paFav').textContent = s.fav.includes(s.stamp) ? '★' : '☆';
    $('paSize').querySelectorAll('button').forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.z - s.size) < .01));
    $('paDel').hidden = !(s.stamp && s.stamp.slice(0, 2) === 'c:');
    const txt = $('paTxt');
    if (txt){
      txt.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter'){ e.preventDefault(); addCustom(); } else if (e.key === 'Escape') txt.blur(); });
      $('paTxtAdd').onclick = addCustom;
    }
  }
  function addCustom(){
    const s = S(), v = ($('paTxt').value || '').trim().slice(0, 40); if (!v) return;
    if (!s.custom.includes(v)) s.custom.push(v);
    s.stamp = 'c:' + v; s.tool = 'stamp'; save(); toolsUI(); stampsUI();
  }
  function askText(pre){
    const s = S(); s.tab = 'more'; save(); stampsUI();
    const t = $('paTxt'); if (t){ t.value = pre; t.focus(); t.setSelectionRange(pre.length, pre.length); }
  }
  function toolsUI(){
    const s = S(), bar = $('paBar'); if (!bar) return;
    bar.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === s.tool));
    bar.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === s.color));
    bar.querySelector('.pacolors').classList.toggle('dim', s.tool === 'hl' || s.tool === 'erase' || s.tool === 'pan' || (s.tool === 'select' && !sel.size));
    bar.querySelector('.pastamps').hidden = s.tool !== 'stamp';
    $('paEye').classList.toggle('off', !s.show);
    $('paEye').textContent = s.show ? '👁' : '🚫';
    const inp = $('paInput'); if (inp){ inp.hidden = !active || s.tool === 'pan'; inp.dataset.tool = s.tool; }
    if (s.tool !== 'select' && sel.size){ sel.clear(); render(); }
    undoUI(); layersUI(); selUI();
    if (s.tool === 'stamp') stampsUI();
  }
  let layOpen = false;
  function layersUI(){
    const bar = $('paBar'); if (!bar) return;
    const row = bar.querySelector('.palayers'); row.hidden = !layOpen;
    const s = S(), L = s.layers, hid = hiddenSet(), cnt = {};
    (ptCur && ptCur.ann || []).forEach(it => { const l = layerOf(it); cnt[l] = (cnt[l] || 0) + 1; });
    $('paLay').classList.toggle('on', layOpen);
    const cl = L.find(l => l.id === s.layer);
    $('paLay').title = 'Lagen (je tekent nu op: ' + (cl ? cl.n : '') + ')';
    if (!layOpen) return;
    row.innerHTML = '<span class="palabel">Tekenen op</span>' + L.map(l => {
      const on = l.id === s.layer, h = hid.has(l.id);
      const name = lRen === l.id ? `<input type="text" class="palren" maxlength="30" value="${ptEsc(l.n)}">`
        : `<button class="palsel${on ? ' on' : ''}" data-lsel="${l.id}" title="Nieuwe aantekeningen op deze laag">${on ? '●' : '○'} ${ptEsc(l.n)} <small>${cnt[l.id] || 0}</small></button>`;
      return `<span class="palay${h ? ' hid' : ''}">${name}<button data-leye="${l.id}" title="${h ? 'Laag tonen' : 'Laag verbergen'} (bij dit stuk)">${h ? '🚫' : '👁'}</button><button data-lren="${l.id}" title="Naam wijzigen">✎</button>${L.length > 1 ? `<button data-ldel="${l.id}" title="Laag weghalen; de aantekeningen erop gaan naar ${ptEsc(L[0].id === l.id ? L[1].n : L[0].n)}">🗑</button>` : ''}</span>`;
    }).join('') + '<button data-lnew="1" title="Nieuwe laag">＋ Laag</button>';
    const inp = row.querySelector('.palren');
    if (inp){
      inp.focus(); inp.select();
      const done = ok => { if (lRen == null) return; const l = L.find(x => x.id === lRen); const v = inp.value.trim().slice(0, 30); lRen = null; if (ok && l && v){ l.n = v; save(); } layersUI(); };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter'){ e.preventDefault(); done(true); } else if (e.key === 'Escape'){ e.preventDefault(); done(false); } });
      inp.addEventListener('blur', () => done(true));
    }
  }
  function layerClick(b){
    const s = S(), L = s.layers;
    if (b.dataset.lsel){ s.layer = b.dataset.lsel; save(); layersUI(); return true; }
    if (b.dataset.leye){
      if (!ptCur) return true;
      const h = hiddenSet(), id = b.dataset.leye;
      if (h.has(id)) h.delete(id); else h.add(id);
      ptCur.annHide = [...h]; ptSaveCur(); layersUI(); render(); return true;
    }
    if (b.dataset.lren){ lRen = b.dataset.lren; layersUI(); return true; }
    if (b.dataset.ldel){
      if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; setTimeout(() => { if (b.isConnected){ b.classList.remove('arm'); b.textContent = '🗑'; } }, 4000); return true; }
      s.layers = L.filter(l => l.id !== b.dataset.ldel);
      if (s.layer === b.dataset.ldel) s.layer = s.layers[0].id;
      if (ptCur && ptCur.annHide){ ptCur.annHide = ptCur.annHide.filter(x => x !== b.dataset.ldel); ptSaveCur(); }
      save(); layersUI(); render(); return true;
    }
    if (b.dataset.lnew){
      const id = 'l' + Date.now().toString(36);
      L.push({ id, n:'Laag ' + (L.length + 1) }); s.layer = id; lRen = id; save(); layersUI(); return true;
    }
    return false;
  }
  function msg(t){ const m = $('paMsg'); if (!m) return; m.textContent = t || ''; m.hidden = !t; }
  function initBar(){
    const bar = document.createElement('div'); bar.id = 'paBar'; bar.className = 'pabar'; bar.hidden = true;
    bar.innerHTML = barHTML();
    $('ptView').appendChild(bar);
    bar.addEventListener('pointerdown', e => e.stopPropagation());
    // muiswiel/touchpad op een rij die opzij schuift (gereedschap op een smal scherm): omhoog/omlaag = opzij
    bar.addEventListener('wheel', e => {
      const r = e.target.closest('.patools'); if (!r || r.scrollWidth <= r.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault(); r.scrollLeft += e.deltaY;
    }, { passive:false });
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = S();
      if (layerClick(b)){ b.blur && b.blur(); return; }
      if (b.id && b.id.slice(0, 5) === 'paSel'){ selDo(b.id); b.blur(); return; }
      if (b.id === 'paLay'){ layOpen = !layOpen; layersUI(); b.blur(); return; }
      if (b.dataset.tool && ed) edDone(true);
      if (b.dataset.tool){ s.tool = b.dataset.tool; save(); toolsUI(); }
      else if (b.dataset.c && s.tool === 'select' && sel.size){ snap(); items().forEach(it => { if (sel.has(it.id) && !it.hl) it.c = b.dataset.c; }); commit(); }
      else if (b.dataset.c){ s.color = b.dataset.c; if (s.tool === 'hl' || s.tool === 'erase' || s.tool === 'pan') s.tool = 'pen'; save(); toolsUI(); if (ed){ ed.c = s.color; ed.ta.className = 'patxted pa-' + ed.c; } }
      else if (b.dataset.tab){ s.tab = b.dataset.tab; save(); stampsUI(); }
      else if (b.dataset.st){ const d = stamp(b.dataset.st); if (d && d.x === 'ask'){ askText(d.v); return; } s.stamp = b.dataset.st; save(); stampsUI(); }
      else if (b.dataset.z){ s.size = +b.dataset.z; save(); stampsUI(); }
      else if (b.id === 'paFav'){ const k = s.stamp; if (!stamp(k)) return; s.fav = s.fav.includes(k) ? s.fav.filter(x => x !== k) : s.fav.concat(k); save(); stampsUI(); }
      else if (b.id === 'paDel'){ const v = s.stamp.slice(2); s.custom = s.custom.filter(x => x !== v); s.fav = s.fav.filter(x => x !== s.stamp); s.stamp = 'down'; save(); stampsUI(); }
      else if (b.id === 'paUndo') doUndo();
      else if (b.id === 'paRedo') doRedo();
      else if (b.id === 'paEye'){ s.show = !s.show; save(); toolsUI(); render(); }
      else if (b.id === 'paDone') close();
      b.blur();
    });
    document.addEventListener('keydown', e => {
      if (!active) return;
      if (e.key === 'Escape'){ if (document.activeElement && (document.activeElement.id === 'paTxt' || document.activeElement.classList.contains('patxted') || document.activeElement.classList.contains('palren'))) return; e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (!typing && S().tool === 'select' && (e.key === 'Delete' || e.key === 'Backspace') && sel.size){ e.preventDefault(); e.stopImmediatePropagation(); selDo('paSelDel'); return; }
      if (!typing && S().tool === 'select' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'){ e.preventDefault(); e.stopImmediatePropagation(); selDo('paSelAll'); return; }
      if ((e.ctrlKey || e.metaKey) && !e.altKey){
        const k = e.key.toLowerCase();
        if (k === 'z'){ e.preventDefault(); e.stopImmediatePropagation(); if (e.shiftKey) doRedo(); else doUndo(); }
        else if (k === 'y'){ e.preventDefault(); e.stopImmediatePropagation(); doRedo(); }
      }
    }, true);
  }
  function open(){
    if (!ptCur || !ptSteps.length) return;
    checkPiece();
    active = true;
    $('paBar').hidden = false;
    $('ptView').classList.add('pa-on'); document.body.classList.add('pa-on');
    ['ptAnnBtn', 'ptFsAnn'].forEach(id => { const b = $(id); if (b) b.classList.add('on'); });
    msg(ptEls.length ? '' : 'Aantekenen lukt niet bij dit stuk: de noten konden niet gevonden worden in de tekening.');
    toolsUI(); render();
  }
  function close(){
    if (!active) return;
    if (cur) end({}, true);
    if (ed) edDone(true);
    active = false; mv = null; layOpen = false; sel.clear();
    $('paBar').hidden = true;
    $('ptView').classList.remove('pa-on'); document.body.classList.remove('pa-on');
    ['ptAnnBtn', 'ptFsAnn'].forEach(id => { const b = $(id); if (b) b.classList.remove('on'); });
    const inp = $('paInput'); if (inp) inp.hidden = true;
    if (ptCur){ clearTimeout(ptSaveT); PtDB.put(ptCur); }
    render();
  }
  function onFs(on){   // de werkbalk moet ín het volledig-scherm-element staan, anders is hij daar niet te zien
    const bar = $('paBar'); if (!bar) return;
    (on ? $('ptFsRot') : $('ptView')).appendChild(bar);
    redraw();
  }
  function init(){
    if (!$('ptSheet') || $('paLayer')) return;
    initInput(); initBar();
    const t = () => { if (active) close(); else open(); };
    ['ptAnnBtn', 'ptFsAnn'].forEach(id => { const b = $(id); if (b) b.addEventListener('click', e => { e.currentTarget.blur(); t(); }); });
    const sty = $('ptAnnStylus');   // 🕹️ → Weergave
    if (sty){ sty.checked = S().stylus !== false; sty.onchange = () => { S().stylus = sty.checked; save(); }; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return {
    redraw, open, close, onFs, isActive:() => active, printLayer, ensureMarker, dropMarkers,
    // grijpt deze aanwijzer in (dan geen omslaan/cursor in partituren.js)?
    grabs:e => (active && S().tool !== 'pan') || (e && e.pointerType === 'pen' && S().stylus) || !!cur,
    _dbg:{ geo:() => { G = null; return geo(); }, anchorAt, pos, stamp, LIST, TABS, items:() => items(), render }
  };
})();
