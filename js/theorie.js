/* ================= Gedeelde muziektheorie-catalogus (`Theorie`) =================
   Eén bron voor blad- én gehooroefeningen: een toonladder of akkoord die hier staat, bestaat meteen overal
   (Toonladders blad/gehoor, Akkoorden blad/gehoor; later ook Intervallen). Iets toevoegen = één regel.

   Theorie.SCALES        [{id, nl, en, grp, offs, semis, kenmerk}]   offs = letterstap t.o.v. de grondtoon, semis = halve tonen
   Theorie.SCALE_GROUPS  [[grp, naam]]
   Theorie.CHORDS        [{id, nl, en, sym, grp, offs, semis, inv, kenmerk}]  sym = akkoordsymbool achter de grondtoon ('m7', 'ø7' …);
                         inv = mag omgekeerd worden (niet bij sus2/sus4/overmatig/jazz: die worden dan een ánder akkoord, bv. Csus4 → Fsus2)
   Theorie.CHORD_GROUPS  [[grp, naam]]
   Theorie.INTERVALS     [{id ('k3','o4','r8','g10' …), q r|g|k|o|v, n 1–15, semis, nl, en, kort, kortEn, ear}] t/m 2 octaven;
                         ear = de gewone naam voor dat aantal halve tonen (o4 heet op gehoor 'tritonus'); Theorie.earOf(semis)
   Theorie.TONICS        {c, wit, alle} grondtonen [{l, a}]
   Theorie.spell(root, offs, semis, max)  → [{l, a, step}] (step = octaven boven de grondtoon) of null als een voorteken > max
   Theorie.formula(offs, semis)           → '1 3 5 ♭7' (trappen t.o.v. majeur)
   Theorie.find(list, id)
   Theorie.window(clef, up, down) → {clef, lo, hi} toonbereik (midi) van een balk met hulplijnen; fitOctave(lo, hi, w) → octaafverschuiving;
   Theorie.autoClef(midis) → 'g' | 'f' | 'grand'  (hoogte: geluid en notatie gekoppeld, voor blad én gehoor) */
const Theorie = (function(){
  const LETS = 'cdefgab', NAT = [0,2,4,5,7,9,11];
  function thScale(id, nl, en, grp, offs, semis, kenmerk){ return { id:id, nl:nl, en:en, grp:grp, offs:offs, semis:semis, kenmerk:kenmerk }; }
  var D7 = [0,1,2,3,4,5,6];
  var SCALES = [
    thScale('maj',   'majeur',               'major',               'mm',  D7, [0,2,4,5,7,9,11], 'ionisch'),
    thScale('nmin',  'natuurlijk mineur',    'natural minor',       'mm',  D7, [0,2,3,5,7,8,10], 'aeolisch'),
    thScale('hmin',  'harmonisch mineur',    'harmonic minor',      'mm',  D7, [0,2,3,5,7,8,11], 'grote septiem, anderhalve toon tussen 6 en 7'),
    thScale('mmin',  'melodisch mineur',     'melodic minor',       'mm',  D7, [0,2,3,5,7,9,11], 'stijgend: grote sext en septiem'),
    thScale('dor',   'dorisch',              'Dorian',              'mod', D7, [0,2,3,5,7,9,10], 'mineur met grote sext'),
    thScale('fry',   'frygisch',             'Phrygian',            'mod', D7, [0,1,3,5,7,8,10], 'mineur met kleine secunde'),
    thScale('lyd',   'lydisch',              'Lydian',              'mod', D7, [0,2,4,6,7,9,11], 'majeur met overmatige kwart'),
    thScale('mix',   'mixolydisch',          'Mixolydian',          'mod', D7, [0,2,4,5,7,9,10], 'majeur met kleine septiem'),
    thScale('loc',   'locrisch',             'Locrian',             'mod', D7, [0,1,3,5,6,8,10], 'kleine secunde en verminderde kwint'),
    thScale('pmaj',  'majeurpentatonisch',   'major pentatonic',    'pen', [0,1,2,4,5], [0,2,4,7,9], '5 tonen, geen 4 en 7'),
    thScale('pmin',  'mineurpentatonisch',   'minor pentatonic',    'pen', [0,2,3,4,6], [0,3,5,7,10], '5 tonen, geen 2 en 6'),
    thScale('blues', 'blues',                'blues',               'pen', [0,2,3,3,4,6], [0,3,5,6,7,10], 'mineurpentatonisch + ♯4 (blue note)'),
    thScale('heel',  'heletoons',            'whole tone',          'sym', [0,1,2,3,4,5], [0,2,4,6,8,10], '6 tonen, alleen hele toonafstanden'),
    thScale('vhh',   'verminderd (half-heel)', 'diminished (half-whole)', 'sym', [0,1,2,2,3,4,5,6], [0,1,3,4,6,7,9,10], '8 tonen: halve, hele, halve, hele …'),
    thScale('vhe',   'verminderd (heel-half)', 'diminished (whole-half)', 'sym', [0,1,2,3,4,5,5,6], [0,2,3,5,6,8,9,11], '8 tonen: hele, halve, hele, halve …'),
    thScale('chrom', 'chromatisch',          'chromatic',           'sym', [0,0,1,1,2,3,3,4,4,5,5,6], [0,1,2,3,4,5,6,7,8,9,10,11], 'alle 12 halve tonen'),
    thScale('hmaj',  'harmonisch majeur',    'harmonic major',      'exo', D7, [0,2,4,5,7,8,11], 'majeur met kleine sext'),
    thScale('hong',  'Hongaars mineur',      'Hungarian minor',     'exo', D7, [0,2,3,6,7,8,11], 'harmonisch mineur met ♯4'),
    thScale('frydom','frygisch dominant',    'Phrygian dominant',   'exo', D7, [0,1,4,5,7,8,10], 'frygisch met grote terts (trap 5 van harmonisch mineur)'),
    thScale('lyddom','lydisch dominant',     'Lydian dominant',     'exo', D7, [0,2,4,6,7,9,10], 'lydisch met kleine septiem'),
    thScale('alt',   'alterated',            'altered',             'exo', D7, [0,1,3,4,6,8,10], 'jazz: alle spanningen (trap 7 van melodisch mineur)')
  ];
  var SCALE_GROUPS = [['mm','Majeur en mineur'], ['mod','Kerktoonladders (modi)'], ['pen','Pentatonisch en blues'], ['sym','Symmetrisch'], ['exo','Andere toonladders']];

  // akkoorden: formule als tekst ('1 ♭3 ♭5 𝄫7'), omgezet naar letterstappen en halve tonen
  function chord(id, nl, en, sym, grp, f, inv, kenmerk){
    const offs = [], semis = [];
    f.split(' ').forEach(t => {
      const m = /^([♭♯𝄫𝄪]*)(\d+)$/.exec(t), n = +m[2] - 1, acc = [...m[1]].reduce((a, c) => a + ({ '♭':-1, '♯':1, '𝄫':-2, '𝄪':2 }[c] || 0), 0);
      offs.push(n); semis.push(NAT[n % 7] + 12 * Math.floor(n / 7) + acc);
    });
    return { id, nl, en, sym, grp, offs, semis, inv:!!inv, kenmerk };
  }
  // namen zoals muzikanten ze meestal zeggen (ook in het Nederlands): major, minor, diminished … (wens gebruiker)
  const CHORDS = [
    chord('maj',   'major',               'major',               '',       'drie', '1 3 5',        true,  'grote terts + kleine terts'),
    chord('min',   'minor',               'minor',               'm',      'drie', '1 ♭3 5',       true,  'kleine terts + grote terts'),
    chord('dim',   'diminished',          'diminished',          '°',      'drie', '1 ♭3 ♭5',      true,  'twee kleine tertsen'),
    chord('aug',   'augmented',           'augmented',           '+',      'drie', '1 3 ♯5',       false, 'twee grote tertsen'),
    chord('sus2',  'sus2',                'sus2',                'sus2',   'drie', '1 2 5',        false, 'secunde in plaats van terts'),
    chord('sus4',  'sus4',                'sus4',                'sus4',   'drie', '1 4 5',        false, 'kwart in plaats van terts'),
    chord('dom7',  'dominant 7th',        'dominant 7th',        '7',      'sept', '1 3 5 ♭7',     true,  'major + kleine septiem'),
    chord('maj7',  'major 7th',           'major 7th',           'maj7',   'sept', '1 3 5 7',      true,  'major + grote septiem'),
    chord('min7',  'minor 7th',           'minor 7th',           'm7',     'sept', '1 ♭3 5 ♭7',    true,  'minor + kleine septiem'),
    chord('hdim7', 'half-diminished 7th', 'half-diminished 7th', 'ø7',     'sept', '1 ♭3 ♭5 ♭7',   true,  'diminished + kleine septiem (m7♭5)'),
    chord('dim7',  'diminished 7th',      'diminished 7th',      '°7',     'sept', '1 ♭3 ♭5 𝄫7',   true,  'alleen kleine tertsen'),
    chord('mmaj7', 'minor-major 7th',     'minor-major 7th',     'm(maj7)','sept', '1 ♭3 5 7',     true,  'minor + grote septiem'),
    chord('six',   'major 6th',           'major 6th',           '6',      'jazz', '1 3 5 6',      false, 'major + grote sext'),
    chord('min6',  'minor 6th',           'minor 6th',           'm6',     'jazz', '1 ♭3 5 6',     false, 'minor + grote sext'),
    chord('dom9',  'dominant 9th',        'dominant 9th',        '9',      'jazz', '1 3 5 ♭7 9',   false, 'dominant 7th + grote none'),
    chord('maj9',  'major 9th',           'major 9th',           'maj9',   'jazz', '1 3 5 7 9',    false, 'major 7th + grote none'),
    chord('min9',  'minor 9th',           'minor 9th',           'm9',     'jazz', '1 ♭3 5 ♭7 9',  false, 'minor 7th + grote none'),
    chord('dom7b9','7♭9',                 '7♭9',                 '7♭9',    'jazz', '1 3 5 ♭7 ♭9',  false, 'dominant 7th + kleine none'),
    chord('dom7s9','7♯9',                 '7♯9',                 '7♯9',    'jazz', '1 3 5 ♭7 ♯9',  false, 'dominant 7th + overmatige none (Hendrix-akkoord)'),
    chord('dom11', '11th',                '11th',                '11',     'jazz', '1 5 ♭7 9 11',  false, 'dominant 9th met kwart, zonder terts'),
    chord('dom13', '13th',                '13th',                '13',     'jazz', '1 3 5 ♭7 9 13',false, 'dominant 9th + grote tredecime (zonder 11)')
  ];
  const CHORD_GROUPS = [['drie', 'Drieklanken'], ['sept', '7th-akkoorden'], ['jazz', 'Jazz-akkoorden']];
  const TONICS = {
    c:   [{ l:'c', a:0 }],
    wit: LETS.split('').map(l => ({ l, a:0 })),
    alle:[['c',0],['c',1],['d',-1],['d',0],['e',-1],['e',0],['f',0],['f',1],['g',-1],['g',0],['g',1],['a',-1],['a',0],['b',-1],['b',0]].map(x => ({ l:x[0], a:x[1] }))
  };
  function spell(root, offs, semis, max){
    const li = LETS.indexOf(root.l), tm = NAT[li] + root.a, out = [];
    for (let i = 0; i < offs.length; i++){
      const j = li + offs[i], l = LETS[j % 7], nat = NAT[j % 7] + 12 * Math.floor(j / 7), a = tm + semis[i] - nat;
      if (Math.abs(a) > (max == null ? 2 : max)) return null;
      out.push({ l, a, step:Math.floor(j / 7) });
    }
    return out;
  }
  function formula(offs, semis){
    return offs.map((o, i) => { const d = semis[i] - (NAT[o % 7] + 12 * Math.floor(o / 7)); return (d === -2 ? '𝄫' : d === 2 ? '𝄪' : d < 0 ? '♭'.repeat(-d) : '♯'.repeat(d)) + (o + 1); }).join(' ');
  }
  // intervallen t/m 2 octaven, met volledige naam. ear = de gewone naam voor dat aantal halve tonen (gehoor vraagt per klank)
  const IV_NUM_NL = ['prime','secunde','terts','kwart','kwint','sext','septiem','octaaf','none','decime','undecime','duodecime','tredecime','quartdecime','dubbel octaaf'];
  const IV_NUM_EN = ['unison','2nd','3rd','4th','5th','6th','7th','octave','9th','10th','11th','12th','13th','14th','double octave'];
  const IV_Q = { r:['rein','reine','perfect','P'], g:['groot','grote','major','M'], k:['klein','kleine','minor','m'], o:['overmatig','overmatige','augmented','A'], v:['verminderd','verminderde','diminished','d'] };
  const PERFECT = n => [1,4,5,8].indexOf((n - 1) % 7 + 1) >= 0;
  const INTERVALS = [];
  for (let n = 1; n <= 15; n++){
    const base = NAT[(n - 1) % 7] + 12 * Math.floor((n - 1) / 7);
    (PERFECT(n) ? [['v',-1],['r',0],['o',1]] : [['v',-2],['k',-1],['g',0],['o',1]]).forEach(([q, d]) => {
      const semis = base + d; if (semis <= 0 && !(n === 1 && q === 'r') || semis > 24) return;   // geen v2 (0) / v1 / o15
      const numNl = IV_NUM_NL[n - 1], oct = n === 8 || n === 15;
      INTERVALS.push({ id:q + n, q, n, semis,
        nl:oct && q === 'r' ? numNl : IV_Q[q][1] + ' ' + numNl,
        en:IV_Q[q][2] + ' ' + IV_NUM_EN[n - 1], kort:q + n, kortEn:IV_Q[q][3] + n, ear:false });
    });
  }
  // de gewone naam per aantal halve tonen (0–24); 6 en 18 = tritonus (overmatige kwart / undecime)
  const EAR = { 0:'r1',1:'k2',2:'g2',3:'k3',4:'g3',5:'r4',6:'o4',7:'r5',8:'k6',9:'g6',10:'k7',11:'g7',12:'r8',13:'k9',14:'g9',15:'k10',16:'g10',17:'r11',18:'o11',19:'r12',20:'k13',21:'g13',22:'k14',23:'g14',24:'r15' };
  INTERVALS.forEach(x => { if (EAR[x.semis] === x.id) x.ear = true; });
  const ivO4 = INTERVALS.find(x => x.id === 'o4'); ivO4.earNl = 'tritonus'; ivO4.earKort = 'tt'; ivO4.earKortEn = 'TT';
  const ivO11 = INTERVALS.find(x => x.id === 'o11'); ivO11.earNl = 'tritonus + octaaf'; ivO11.earKort = 'tt+8'; ivO11.earKortEn = 'TT+8';
  const earOf = semis => INTERVALS.find(x => x.id === EAR[semis]);
  // hoogte via sleutel + hulplijnen (gedeeld door blad én gehoor): het toonbereik dat op die balk past, binnen de piano.
  // clef 'grand' = onderkant bassleutel t/m bovenkant vioolsleutel. → {clef, lo, hi} (midi, stamtonen; voortekens mogen ±1 erbuiten vallen)
  function window_(clef, up, down){
    const Nt = Notatie, lo = -1 - 2 * (down || 0), hi = 9 + 2 * (up || 0);
    const m = (pos, c) => Nt.midi(Nt.atPos(pos, c));
    const a = clef === 'grand' ? m(lo, 'f') : m(lo, clef), b = clef === 'grand' ? m(hi, 'g') : m(hi, clef);
    return { clef, lo:Math.max(21, a), hi:Math.min(108, b) };
  }
  // kies een verschuiving in octaven zodat [lo, hi] (midi) binnen het venster valt; willekeurig als er meer passen, anders de dichtstbijzijnde
  function fitOctave(lo, hi, w){
    const ok = [], all = [];
    for (let k = -6; k <= 6; k++){ const a = lo + 12 * k, b = hi + 12 * k; const out = Math.max(0, w.lo - a) + Math.max(0, b - w.hi); all.push({ k, out }); if (!out) ok.push(k); }
    if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
    all.sort((x, y) => x.out - y.out || Math.abs(x.k) - Math.abs(y.k)); return all[0].k;
  }
  // automatische sleutel voor een groep tonen (midi): viool, bas of pianobalk
  const autoClef = ms => Math.min(...ms) >= 55 ? 'g' : Math.max(...ms) <= 64 ? 'f' : 'grand';
  /* ---------- Harmonie: trap-akkoorden, cadensen en bekende progressies (16-11-2026) ----------
     Gedeeld door Gehoor → Cadensen en Gehoor → Akkoordprogressies (harmonie.js). Alles is één regel per item:
     - trap-akkoord:  rn(id, getoond, letterstap, halve tonen, soort, functie T/S/D, extra)   extra: sev (septiem), bor (geleend), sec + to (secundaire dominant), inv (terts in de bas), hide (niet in de keuzelijst)
     - cadens:        cad(id, naam, kort, kenmerk, {maj:'I | IV ii | V* | I', min:'…'})   4 plekken gescheiden door |, per plek de mogelijke akkoorden;
                      V* = V, of V7 als 'V als septiemakkoord' aan staat. De toonaarden waarin hij bestaat = de sleutels van het object.
     - progressie:    prog(naam, 'maj'|'min', 'I V vi IV')
     Een nieuwe cadens of progressie verschijnt vanzelf in de oefening (toets = volgorde in de lijst). */
  const RN_Q = { maj:[0,4,7], min:[0,3,7], dim:[0,3,6], aug:[0,4,8], '7':[0,4,7,10], maj7:[0,4,7,11], m7:[0,3,7,10], hd7:[0,3,6,10], dim7:[0,3,6,9] };
  const RN_SYM = { maj:'', min:'m', dim:'°', aug:'+', '7':'7', maj7:'maj7', m7:'m7', hd7:'ø7', dim7:'°7' };
  const rn = (id, rnTxt, step, semi, q, fn, x) => Object.assign({ id, rn:rnTxt, step, semi, q, fn }, x || {});
  const RN = {
    maj:[
      rn('I','I',0,0,'maj','T'),          rn('ii','ii',1,2,'min','S'),        rn('iii','iii',2,4,'min','T'),
      rn('IV','IV',3,5,'maj','S'),        rn('V','V',4,7,'maj','D'),          rn('vi','vi',5,9,'min','T'),
      rn('viio','vii°',6,11,'dim','D'),
      rn('Imaj7','Imaj7',0,0,'maj7','T',{sev:1}), rn('ii7','ii7',1,2,'m7','S',{sev:1}), rn('IVmaj7','IVmaj7',3,5,'maj7','S',{sev:1}),
      rn('V7','V7',4,7,'7','D',{sev:1}),  rn('vi7','vi7',5,9,'m7','T',{sev:1}),
      rn('iv','iv',3,5,'min','S',{bor:1}), rn('bVI','♭VI',5,8,'maj','S',{bor:1}), rn('bVII','♭VII',6,10,'maj','S',{bor:1}),
      rn('V7/IV','V7/IV',0,0,'7','D',{sec:1,to:'IV'}), rn('V7/V','V7/V',1,2,'7','D',{sec:1,to:'V'}),
      rn('V7/vi','V7/vi',2,4,'7','D',{sec:1,to:'vi'}), rn('V7/ii','V7/ii',5,9,'7','D',{sec:1,to:'ii'})
    ],
    min:[
      rn('i','i',0,0,'min','T'),          rn('iio','ii°',1,2,'dim','S'),      rn('III','III',2,3,'maj','T'),
      rn('iv','iv',3,5,'min','S'),        rn('v','v',4,7,'min','D'),          rn('V','V',4,7,'maj','D'),
      rn('VI','VI',5,8,'maj','S'),        rn('VII','VII',6,10,'maj','S'),
      rn('viio7','vii°7',6,11,'dim7','D',{sev:1}), rn('iih7','iiø7',1,2,'hd7','S',{sev:1}), rn('V7','V7',4,7,'7','D',{sev:1}),
      rn('i7','i7',0,0,'m7','T',{sev:1}),
      rn('iv6','iv⁶',3,5,'min','S',{inv:1,hide:1}),   // Frygisch half slot
      rn('I','I',0,0,'maj','T',{hide:1})              // Picardische terts
    ]
  };
  const cad = (id, nl, kort, kenmerk, fr) => {
    const phrase = {};
    Object.keys(fr).forEach(m => { phrase[m] = fr[m].split('|').map(p => p.trim().split(/\s+/)); });
    return { id, nl, kort, kenmerk, phrase, modes:Object.keys(fr) };
  };
  const CADENCES = [
    cad('aut',  'Authentiek slot',    'V → I',   'Dominant naar tonica: het klinkt af, als een punt aan het eind van een zin.',
        { maj:'I | IV ii | V* | I',        min:'i | iv iio | V* | i' }),
    cad('half', 'Half slot',          '… → V',   'Eindigt op de dominant: het blijft hangen, als een komma of een vraag.',
        { maj:'I | vi IV iii | ii IV | V', min:'i | VI III iv | iv iio | V' }),
    cad('pla',  'Plagaal slot',       'IV → I',  'Subdominant naar tonica: zacht en rustig, het "Amen" uit de kerk.',
        { maj:'I | V vi iii | IV | I',     min:'i | V VI III | iv | i' }),
    cad('bedr', 'Bedrieglijk slot',   'V → vi',  'Je verwacht na V de tonica, maar je krijgt vi (in mineur VI): een verrassing, het gaat nog door.',
        { maj:'I | IV ii | V* | vi',       min:'i | iv iio | V* | VI' }),
    cad('fryg', 'Frygisch half slot', 'iv⁶ → V', 'Alleen in mineur: de bas zakt een halve toon (♭6 → 5) naar V. Typisch barok, vaak tussen twee delen.',
        { min:'i | VI III | iv6 | V' }),
    cad('pic',  'Picardische terts',  'V → I (in mineur)', 'Een stuk in mineur eindigt onverwacht op een majeurakkoord: de terts gaat omhoog. Heel veel bij Bach.',
        { min:'i | iv iio | V* | I' }),
    cad('mpla', 'Mineur-plagaal slot', 'iv → I', 'In majeur, maar de subdominant is mineur (geleend uit mineur): een warm, wat weemoedig "Amen".',
        { maj:'I | V vi | iv | I' })
  ];
  const prog = (n, m, c) => ({ n, m, c:c.split(/\s+/) });
  const PROGRESSIONS = [
    prog('Pop-progressie', 'maj', 'I V vi IV'),            prog('Jaren-50-progressie', 'maj', 'I vi IV V'),
    prog('I–IV–V–I', 'maj', 'I IV V I'),                   prog('I–IV–I–V', 'maj', 'I IV I V'),
    prog('Turnaround', 'maj', 'I vi ii V'),                prog('ii–V–I (jazz)', 'maj', 'ii7 V7 Imaj7'),
    prog('Jazz-turnaround', 'maj', 'Imaj7 vi7 ii7 V7'),   prog('Kwintenval', 'maj', 'iii vi ii V I'),
    prog('Pachelbel (Canon in D)', 'maj', 'I V vi iii IV I IV V'),
    prog('Mixolydisch (rock)', 'maj', 'I bVII IV I'),      prog('Mineur-plagaal', 'maj', 'I IV iv I'),
    prog('I–vi–IV–V–I', 'maj', 'I vi IV V I'),
    prog('i–iv–V–i', 'min', 'i iv V i'),                   prog('Epische mineur', 'min', 'i VI III VII'),
    prog('Andalusische cadens', 'min', 'i VII VI V'),     prog('Mineur ii–V–i (jazz)', 'min', 'iih7 V7 i'),
    prog('i–VI–iv–V', 'min', 'i VI iv V'),                 prog('i–iv–VII–III', 'min', 'i iv VII III')
  ];
  /* ---------- Muziektermen voor de Termen-quiz (16-11-2026) ----------
     Eén regel per term: 'Term | betekenis'. Een nieuwe term hier staat meteen in de quiz en in de lijst.
     Eigen termen die de gebruiker in de app toevoegt staan niet hier maar in localStorage 'termen-eigen' (gaan mee in de back-up). */
  const TERM_CATS = [['tempo','Tempo'], ['tempow','Tempo veranderen'], ['dyn','Dynamiek'], ['kar','Karakter en voordracht'], ['art','Articulatie'], ['strijk','Viool en strijkers'], ['piano','Piano'], ['vorm','Herhalingen en vorm'], ['eigen','Eigen termen']];
  const terms = (cat, list) => list.map(x => { const p = x.split('|'); return { t:p[0].trim(), b:p[1].trim(), c:cat }; });
  const TERMS = [].concat(
    terms('tempo', ['Grave | heel langzaam en plechtig, ernstig', 'Largo | breed en langzaam', 'Larghetto | langzaam, maar iets vlotter dan largo', 'Lento | langzaam',
      'Adagio | langzaam en rustig', 'Adagietto | iets vlotter dan adagio', 'Andante | gaand: een rustig wandeltempo', 'Andantino | iets vlotter dan andante',
      'Moderato | matig snel', 'Allegretto | vrij levendig, iets rustiger dan allegro', 'Allegro | snel en opgewekt', 'Vivace | levendig en vlug',
      'Presto | zeer snel', 'Prestissimo | zo snel mogelijk']),
    terms('tempow', ['accelerando (accel.) | geleidelijk sneller', 'ritardando (rit.) | geleidelijk langzamer', 'rallentando (rall.) | langzamer wordend',
      'ritenuto (riten.) | meteen inhouden: direct langzamer', 'allargando | breder en langzamer, vaak ook voller', 'stringendo | aandringend: sneller en gespannener',
      'a tempo | terug naar het tempo van daarvoor', 'tempo primo | weer het begintempo', 'rubato | vrij met het tempo: wat tijd nemen en weer teruggeven',
      "l'istesso tempo | hetzelfde tempo (ook bij een andere maatsoort)", 'meno mosso | minder beweeglijk: langzamer', 'più mosso | beweeglijker: sneller']),
    terms('dyn', ['pianissimo (pp) | zeer zacht', 'piano (p) | zacht', 'mezzo piano (mp) | half zacht', 'mezzo forte (mf) | half luid', 'forte (f) | luid', 'fortissimo (ff) | zeer luid',
      'crescendo (cresc.) | geleidelijk luider', 'decrescendo (decresc.) | geleidelijk zachter', 'diminuendo (dim.) | geleidelijk zachter (ook wat inhouden)',
      'sforzando (sfz) | plotseling sterk accent op één noot', 'fortepiano (fp) | luid inzetten en meteen zacht', 'subito | plotseling (bijvoorbeeld subito piano)',
      'morendo | wegstervend: zachter en langzamer', 'smorzando | uitdovend', 'calando | afnemend in sterkte en tempo', 'niente | tot niets: helemaal weg']),
    terms('kar', ['cantabile | zingend', 'dolce | zoet en zacht', 'espressivo (espr.) | met expressie', 'maestoso | statig, majestueus', 'grazioso | sierlijk',
      'con brio | met vuur en energie', 'con fuoco | vurig', 'animato | bezield, levendig', 'agitato | opgewonden, onrustig', 'scherzando | schertsend, speels',
      'sostenuto | gedragen, aangehouden', 'tranquillo | rustig', 'leggiero | licht', 'appassionato | hartstochtelijk', 'giocoso | vrolijk', 'misterioso | geheimzinnig',
      'pesante | zwaar', 'sotto voce | met gedempte stem, ingetogen', 'semplice | eenvoudig', 'con moto | met beweging', 'ma non troppo | maar niet te veel',
      'molto | veel, zeer', 'poco | een beetje', 'poco a poco | beetje bij beetje', 'sempre | steeds', 'assai | zeer', 'meno | minder', 'più | meer']),
    terms('art', ['legato | gebonden', 'staccato | kort en los', 'staccatissimo | zeer kort', 'tenuto | de volle waarde aanhouden', 'portato | half gebonden: licht gescheiden in één beweging',
      'marcato | gemarkeerd: elke noot nadrukkelijk', 'non legato | los, maar niet kort', 'accento | nadruk op één noot']),
    terms('strijk', ['arco | met de stok', 'pizzicato (pizz.) | getokkeld met de vinger', 'col legno | met het hout van de stok', 'sul ponticello | dicht bij de kam: glazige klank',
      'sul tasto | boven de toets: zachte, fluitachtige klank', 'spiccato | springende stok', 'détaché | losse streken: elke noot een eigen streek',
      'martelé | gehamerd: krachtig ingezette, gescheiden streken', 'sautillé | snel springend vanuit het midden van de stok', 'ricochet | de stok stuitert meerdere noten in één streek',
      'tremolo | snel herhaalde streken op één noot', 'con sordino | met demper', 'senza sordino | zonder demper', 'sul G | alles op de G-snaar spelen',
      "punta d'arco | met de punt van de stok", 'al tallone | aan de kikker', 'flautando | licht en fluitachtig, boven de toets', 'divisi | verdeeld over de spelers']),
    terms('piano', ['una corda | linkerpedaal: zachter en gedempt', 'tre corde | linkerpedaal weer los', 'con pedale (Ped.) | met rechterpedaal', 'senza pedale | zonder pedaal',
      'mano sinistra (m.s.) | linkerhand', 'mano destra (m.d.) | rechterhand', 'ottava (8va) | een octaaf hoger spelen', 'ottava bassa (8vb) | een octaaf lager spelen']),
    terms('vorm', ['da capo (D.C.) | vanaf het begin', 'dal segno (D.S.) | vanaf het teken', 'al fine | tot het woord Fine', 'fine | einde', 'coda | slotgedeelte',
      'prima volta | de eerste keer (eerste maat-haak)', 'attacca | meteen doorgaan zonder pauze', 'tacet | zwijgen, niet spelen', 'tutti | iedereen samen',
      'ad libitum (ad lib.) | naar believen', 'simile | op dezelfde manier verder', 'fermate (corona) | noot of rust aanhouden zolang je wilt'])
  );
  const find = (list, id) => list.find(x => x.id === id);
  return { SCALES, SCALE_GROUPS, CHORDS, CHORD_GROUPS, INTERVALS, earOf, TONICS, spell, formula, find, window:window_, fitOctave, autoClef, LETS, NAT, RN, RN_Q, RN_SYM, CADENCES, PROGRESSIONS, TERMS, TERM_CATS };
})();

/* gedeelde tempokeuze voor het afspelen van toonladders, gebroken akkoorden en melodische intervallen (♩ = één toon) */
var GEH_BPMS = [40, 50, 60, 75, 90, 100, 110, 130, 160, 190, 220, 260];
function gehBpmFill(sel){ sel.innerHTML = GEH_BPMS.map(function(b){ return '<option value="' + b + '">♩ = ' + b + (b <= 60 ? ' (rustig)' : b >= 220 ? ' (snel)' : '') + '</option>'; }).join(''); }
function gehBpmFix(v, def){ v = +v; return GEH_BPMS.indexOf(v) >= 0 ? v : def; }
