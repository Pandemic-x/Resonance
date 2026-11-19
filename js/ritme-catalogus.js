/* ================= Catalogue ================= */
const SECTIONS = [];
const L16 = ['1','e','&','a'], L3 = ['1','trip','let'];

SECTIONS.push({ id:'basis', title:'Basis', desc:'Kwarten, achtsten en de “en”-tel.', cells:[
  { title:'Kwart', groups:[G(['q'])] },
  { title:'2 achtsten', groups:[G(['8','8'])] },
  { title:'Op de en', groups:[G(['8r','8'])] },
  { title:'Op de tel', groups:[G(['8','8r'])] },
  { title:'Halve noot', groups:[G(['h'])] },
  { title:'Kwart + 2 achtsten', groups:[G(['q','8','8'])] },
  { title:'2 achtsten + kwart', groups:[G(['8','8','q'])] },
]});

SECTIONS.push({ id:'zestienden', title:'16e-variaties', desc:'Alle 16 combinaties van vier 16e-posities binnen één tel. Elke noot klinkt door tot de volgende aanslag.',
  cells: allMasks(4).map(bits => ({ title: sylTitle(bits, L16), labels:L16, bits, groups:[G(fromSpans(maskToSpans(bits),16))] })) });

SECTIONS.push({ id:'zestienden-kort', title:'16e-variaties, kort', desc:'Dezelfde 16 combinaties, maar elke aanslag is een kort 16e-nootje met rusten ertussen. Zo denk je bij staccato en spiccato.',
  cells: allMasks(4).map(bits => ({ title: sylTitle(bits, L16), labels:L16, bits, groups:[G(fromSpans(shortSpans(bits),16))] })) });

SECTIONS.push({ id:'gepunteerd', title:'Gepunteerde 8en en andere punten', desc:'Gepunteerde achtsten, gepunteerde kwarten en dubbel gepunteerd.', cells:[
  { title:'8. + 16', groups:[G(['8d','16'])] },
  { title:'16 + 8.', groups:[G(['16','8d'])] },
  { title:'8. 16 ×2', groups:[G(['8d','16','8d','16'])] },
  { title:'16 8. ×2', groups:[G(['16','8d','16','8d'])] },
  { title:'8. 16 + 2 achtsten', groups:[G(['8d','16','8','8'])] },
  { title:'2 achtsten + 8. 16', groups:[G(['8','8','8d','16'])] },
  { title:'Kwart + 8. 16', groups:[G(['q','8d','16'])] },
  { title:'Gepunteerde kwart + 8', groups:[G(['qd','8'])] },
  { title:'8 + gepunteerde kwart', groups:[G(['8','qd'])] },
  { title:'8.. + 32', groups:[G(['8dd','32'])] },
  { title:'Kwart.. + 16', groups:[G(['qdd','16'])] },
]});

SECTIONS.push({ id:'syncopen', title:'Syncopen', desc:'Accenten tussen de tellen in, vaak met overbindingen over de tel heen.', cells:[
  { title:'16 8 16', groups:[G(['16','8','16'])] },
  { title:'16 8 16 ×2', groups:[G(['16','8','16','16','8','16'])] },
  { title:'8 kwart 8', groups:[G(['8','q','8'])] },
  { title:'8 kwart 8 (overgebonden)', groups:[G(['8','8~','8','8'])] },
  { title:'Rust kwart 8', groups:[G(['8r','q','8'])] },
  { title:'8 kwart kwart kwart 8', groups:[G(['8','q','q','q','8'])] },
  { title:'Over de tel (16e)', groups:[G(['16','8','16~','16','8','16'])] },
  { title:'Doorgebonden en-tellen', groups:[G(['8r','8~','8','8~','8','8'])] },
  { title:'Tresillo (8en)', beam:[2,4], groups:[G(['8d','8d','8'])] },
  { title:'Tresillo (kwarten)', groups:[G(['qd','qd','q'])] },
  { title:'Charleston', groups:[G(['qd','8~','h'])] },
  { title:'Anticipatie', groups:[G(['q','q','q','8','8~','q'])] },
]});

{
  const masks = allMasks(3).map(bits => {
    const k = bits.join('');
    const groups = k==='100' ? [G(['q'])] : k==='000' ? [G(['qr'])] : [G(fromSpans(maskToSpans(bits),8).map(x=> x==='qdr'?'8r':x), [3,2])];
    return { title: sylTitle(bits, L3), labels:L3, bits, groups };
  });
  const with16 = allMasks(3).filter(b => b.some(Boolean)).map(bits => ({
    title: 'Triool: ' + bits.map(b => b ? '16 16' : '8').join(' · '),
    groups:[G(bits.flatMap(b => b ? ['16','16'] : ['8']), [3,2])]
  }));
  SECTIONS.push({ id:'triolen', title:'Triolen', desc:'Alle 8 combinaties van de 8e-triool, alle 7 manieren om 16en in een triool te zetten, kwarttriolen en 16e-triolen.', cells:[
    ...masks,
    ...with16,
    { title:'Kwarttriool', groups:[G(['q','q','q'],[3,2])] },
    { title:'Kwarttriool, rust midden', groups:[G(['q','qr','q'],[3,2])] },
    { title:'Kwarttriool, rust eerst', groups:[G(['qr','q','q'],[3,2])] },
    { title:'Kwarttriool met 8en', groups:[G(['8','8','q','q'],[3,2])] },
    { title:'16e-triool + 8', groups:[G(['16','16','16'],[3,2]), G(['8'])] },
    { title:'8 + 16e-triool', groups:[G(['8']), G(['16','16','16'],[3,2])] },
    { title:'2 × 16e-triool', groups:[G(['16','16','16'],[3,2]), G(['16','16','16'],[3,2])] },
  ]});
}

SECTIONS.push({ id:'triolen-tel', title:'Triolen over de tel', desc:'Triolen die met een overbinding over de tel heen lopen, en gesyncopeerde kwarttriolen.', cells:[
  { title:'Overgebonden triool', groups:[G(['8','8','8~'],[3,2]), G(['8','8','8'],[3,2])] },
  { title:'8 kwart, over de tel', groups:[G(['8','q~'],[3,2]), G(['8','q'],[3,2])] },
  { title:'Rust + doorgebonden', groups:[G(['8r','8','8~'],[3,2]), G(['8','8r','8'],[3,2])] },
  { title:'Doorgebonden triolen ×3', groups:[G(['8','8','8~'],[3,2]), G(['8','8','8~'],[3,2]), G(['8','8','8'],[3,2])] },
  { title:'Kwarttriool: 8 q q 8', groups:[G(['8','q','q','8'],[3,2])] },
  { title:'Kwarttriool: rust q q 8', groups:[G(['8r','q','q','8'],[3,2])] },
  { title:'Kwarttriool: q 8 8 q', groups:[G(['q','8','8','q'],[3,2])] },
  { title:'Halve-triool', groups:[G(['h','h','h'],[3,2])] },
]});

{
  const cells = allMasks(5).filter(b => b[0]===1 && b.join('')!=='10000').map(bits => ({
    title: bits.map((b,i)=> b? i+1 : '–').join(' '), labels:['1','2','3','4','5'], bits,
    groups:[G(fromSpans(maskToSpans(bits),16),[5,4])]
  }));
  cells.push({ title:'5 achtsten over 2 tellen', groups:[G(rep('8',5),[5,4])] });
  SECTIONS.push({ id:'kwintolen', title:'Kwintolen (5)', desc:'Vijf 16en in de tijd van vier, alle variaties die op de tel beginnen.', cells });
}
{
  const S = [[1,1,1,1,1,1],[2,1,1,1,1],[1,1,1,1,2],[1,1,2,1,1],[2,1,2,1],[1,2,1,2],[3,1,1,1],[1,1,1,3],[2,2,1,1],[1,1,2,2],[3,3],[-1,1,1,-1,1,1],[1,-1,1,1,-1,1]];
  const cells = S.map(sp => ({ title: spanTitle(sp), groups:[G(fromSpans(sp,16),[6,4])] }));
  cells.push({ title:'6 achtsten over 2 tellen', groups:[G(rep('8',6),[6,4])] });
  SECTIONS.push({ id:'sextolen', title:'Sextolen (6)', desc:'Zes 16en in de tijd van vier. Getallen = lengte in sextooldelen, r = rust.', cells });
}
{
  const S = [[1,1,1,1,1,1,1],[2,1,1,1,1,1],[1,1,1,1,1,2],[1,1,2,1,1,1],[2,1,1,2,1],[3,1,1,1,1],[1,1,1,1,3],[2,2,1,1,1],[1,1,1,2,2],[-1,1,1,1,1,1,1]];
  const cells = S.map(sp => ({ title: spanTitle(sp), groups:[G(fromSpans(sp,16),[7,4])] }));
  cells.push({ title:'7 achtsten over 2 tellen', groups:[G(rep('8',7),[7,4])] });
  SECTIONS.push({ id:'septolen', title:'Septolen (7)', desc:'Zeven 16en in de tijd van vier. Getallen = lengte in septooldelen, r = rust.', cells });
}
{
  const half = allMasks(4).map(bits => ({ title: bits.map(b=> b?'●':'○').join(''), groups:[G(fromSpans(maskToSpans(bits),32))] }));
  const S = [[1,1,1,1,1,1,1,1],[2,1,1,2,1,1],[1,1,2,1,1,2],[3,1,3,1],[1,3,1,3],[4,1,1,1,1],[1,1,1,1,4],[2,1,1,4],[4,2,1,1],[1,1,2,4],[6,1,1],[1,1,6],[7,1],[2,2,1,1,1,1],[1,1,1,1,2,2],[2,1,1,2,2]];
  const full = S.map(sp => ({ title: sp.join('-'), groups:[G(fromSpans(sp,32))] }));
  SECTIONS.push({ id:'tweeendertigsten', title:'32e-variaties', desc:'Eerst alle 16 combinaties van vier 32en binnen een halve tel (● = aanslag), daarna figuren over een hele tel (lengtes in 32en).', cells:[...half, ...full] });
}

/* --- Subdivisie-ladder --- */
{
  const sub = n => ({1:G(['q']),2:G(['8','8']),3:G(rep('8',3),[3,2]),4:G(rep('16',4)),5:G(rep('16',5),[5,4]),6:G(rep('16',6),[6,4]),7:G(rep('16',7),[7,4]),8:G(rep('32',8))})[n];
  const names = {1:'1 per tel',2:'2 per tel',3:'3 per tel (triool)',4:'4 per tel',5:'5 per tel (kwintool)',6:'6 per tel (sextool)',7:'7 per tel (septool)',8:'8 per tel (32en)'};
  const cells = [1,2,3,4,5,6,7,8].map(n => ({ title:names[n], groups:[sub(n)] }));
  const lad = (title, seq) => ({ title, groups: seq.map(sub) });
  cells.push(
    lad('Ladder 1 → 4', [1,2,3,4]),
    lad('Ladder 4 → 1', [4,3,2,1]),
    lad('Ladder 4 → 8', [4,5,6,7,8]),
    lad('Ladder 1 → 8', [1,2,3,4,5,6,7,8]),
    lad('Ladder 8 → 1', [8,7,6,5,4,3,2,1]),
    lad('Wissel 2 ↔ 3', [2,3,2,3]),
    lad('Wissel 3 ↔ 4', [3,4,3,4]),
    lad('Wissel 4 ↔ 5', [4,5,4,5]),
    lad('Wissel 4 ↔ 6', [4,6,4,6]),
    lad('Wissel 6 ↔ 8', [6,8,6,8]),
    lad('Wissel 3 ↔ 6', [3,6,3,6]),
  );
  SECTIONS.push({ id:'ladder', title:'Subdivisie-ladder', desc:'Steeds meer (of minder) noten per tel, bij een gelijkblijvende tel. De beste oefening om soepel tussen groepjes te wisselen.', cells });
}

/* --- Swing --- */
SECTIONS.push({ id:'swing', title:'Swing en shuffle', desc:'Geschreven als gewone achtsten, gespeeld als lang-kort (triool-gevoel). Vergelijk “recht” met “swing”.', cells:[
  { title:'Recht (ter vergelijking)', groups:[G(['8','8','8','8'])] },
  { title:'Swing-achtsten', swing:'8', groups:[G(['8','8','8','8'])] },
  { title:'Zo klinkt swing', groups:[G(['q','8'],[3,2]), G(['q','8'],[3,2])] },
  { title:'Swing op de en', swing:'8', groups:[G(['8r','8','8r','8'])] },
  { title:'Swing met kwarten', swing:'8', groups:[G(['8','8','q','8','8','q'])] },
  { title:'Swing-syncope', swing:'8', groups:[G(['8','q','8','q'])] },
  { title:'Swing: q 8 8 8 8 q', swing:'8', groups:[G(['q','8','8','8','8','q'])] },
  { title:'Recht 16en', groups:[G(rep('16',8))] },
  { title:'16e-shuffle', swing:'16', groups:[G(rep('16',8))] },
  { title:'Zo klinkt 16e-shuffle', groups:[G(['8','16'],[3,2]), G(['8','16'],[3,2]), G(['8','16'],[3,2]), G(['8','16'],[3,2])] },
]});

/* --- Samengestelde maatsoorten --- */
{
  const C68 = { tempoUnit:1.5, pulse:1.5, bar:3, beam:[3,8] };
  const L68 = ['1','2','3'];
  const masks = allMasks(3).map(bits => ({ ...C68, bar:null, title: sylTitle(bits, L68), labels:L68, bits, groups:[G(fromSpans(maskToSpans(bits),8))] }));
  const bar68 = (title, groups, extra) => ({ ...C68, time:'6/8', title, groups, ...(extra||{}) });
  SECTIONS.push({ id:'samengesteld', title:'6/8, 9/8 en 12/8', desc:'Eerst alle 8 combinaties binnen één gepunteerde kwart (tel 1-2-3), daarna hele maten. Het tempo geldt hier voor de gepunteerde kwart.', cells:[
    ...masks,
    bar68('Zes achtsten', [G(rep('8',6))]),
    bar68('Twee gepunteerde kwarten', [G(['qd','qd'])]),
    bar68('Gigue: kwart-8', [G(['q','8','q','8'])]),
    bar68('8-kwart', [G(['8','q','8','q'])]),
    bar68('Siciliano', [G(['8d','16','8','8d','16','8'])]),
    bar68('Siciliano + gepunteerde kwart', [G(['8d','16','8','qd'])]),
    bar68('16en + gepunteerde kwart', [G([...rep('16',6),'qd'])]),
    bar68('8 16 16 8 + gepunteerde kwart', [G(['8','16','16','8','qd'])]),
    bar68('Gepunteerde halve', [G(['hd'])]),
    bar68('Duolen', [G(['8','8'],[2,3]), G(['8','8'],[2,3])]),
    bar68('Duool + 3 achtsten', [G(['8','8'],[2,3]), G(['8','8','8'])]),
    bar68('Kwartool + gepunteerde kwart', [G(rep('8',4),[4,3]), G(['qd'])]),
    { ...C68, time:'9/8', bar:4.5, title:'9/8: kwart-8 ×3', groups:[G(['q','8','q','8','q','8'])] },
    { ...C68, time:'9/8', bar:4.5, title:'9/8: negen achtsten', groups:[G(rep('8',9))] },
    { ...C68, time:'12/8', bar:6, title:'12/8: gemengd', groups:[G(['8d','16','8','q','8','qd','q','8'])] },
    { ...C68, time:'12/8', bar:6, title:'12/8: shuffle', groups:[G(['q','8','q','8','q','8','q','8'])] },
  ]});
}

/* --- Alla breve & opmaten --- */
{
  const AB = { time:'C|', pulse:2, bar:4 };
  SECTIONS.push({ id:'alla-breve', title:'Alla breve en opmaten', desc:'In alla breve (2/2) tel je in halve noten: de metronoom tikt twee keer per maat. Bij een opmaat tikt de metronoom eerst de lege tellen vóór de eerste noot.', cells:[
    { ...AB, title:'2/2: halve noten', groups:[G(['h','h'])] },
    { ...AB, title:'2/2: kwarten', groups:[G(['q','q','q','q'])] },
    { ...AB, title:'2/2: q 8 8 q 8 8', groups:[G(['q','8','8','q','8','8'])] },
    { ...AB, title:'2/2: 4 achtsten + halve', groups:[G(['8','8','8','8','h'])] },
    { ...AB, title:'2/2: gepunteerde halve + kwart', groups:[G(['hd','q'])] },
    { ...AB, title:'2/2: syncope q h q', groups:[G(['q','h','q'])] },
    { ...AB, lead:3, title:'Opmaat kwart (2/2)', groups:[G(['q']), BAR(), G(['h','h'])] },
    { ...AB, lead:3, title:'Opmaat 2 achtsten (2/2)', groups:[G(['8','8']), BAR(), G(['q','q','h'])] },
    { ...AB, lead:3.5, title:'Opmaat 1 achtste (2/2)', groups:[G(['8']), BAR(), G(['q','8','8','h'])] },
    { time:'3/4', pulse:1, bar:3, lead:2, title:'Opmaat kwart (3/4)', groups:[G(['q']), BAR(), G(['q','q','q'])] },
    { time:'3/4', pulse:1, bar:3, lead:1, title:'Opmaat 2 kwarten (3/4)', groups:[G(['q','q']), BAR(), G(['h','q'])] },
    { time:'4/4', pulse:1, bar:4, lead:3.5, title:'Opmaat 1 achtste (4/4)', groups:[G(['8']), BAR(), G(['q','q','8','8','q'])] },
    { time:'6/8', tempoUnit:1.5, pulse:1.5, bar:3, lead:2.5, title:'Opmaat 1 achtste (6/8)', groups:[G(['8']), BAR(), G(['q','8','q','8'])] },
    { time:'6/8', tempoUnit:1.5, pulse:1.5, bar:3, lead:1.5, title:'Opmaat 3 achtsten (6/8)', groups:[G(['8','8','8']), BAR(), G(['qd','qd'])] },
  ]});
}

/* --- Hemiool --- */
SECTIONS.push({ id:'hemiool', title:'Hemiool', desc:'Twee maten van drie die klinken als drie maten van twee. Komt veel voor vlak voor een slot, bij Bach en in menuetten.', cells:[
  { time:'3/4', pulse:1, bar:3, title:'Hemiool (3/4)', groups:[G(['h','q~']), BAR(), G(['q','h'])] },
  { time:'3/4', pulse:1, bar:3, title:'Hemiool vóór het slot', groups:[G(['q','q','q']), BAR(), G(['h','q~']), BAR(), G(['q','h']), BAR(), G(['hd'])] },
  { time:'3/4', pulse:1, bar:3, title:'Hemiool met achtsten', groups:[G(['8','8','q','q~']), BAR(), G(['q','8','8','q'])] },
  { time:'6/8', tempoUnit:1, pulse:.5, bar:3, title:'6/8 ↔ 3/4 (achtsten)', groups:[G(rep('8',6),null,[3,8]), BAR(), G(rep('8',6),null,[1,4])] },
  { time:'6/8', tempoUnit:1, pulse:.5, bar:3, title:'6/8 ↔ 3/4 (kwarten)', groups:[G(['qd','qd']), BAR(), G(['q','q','q'])] },
]});

/* --- Polyritmes --- */
SECTIONS.push({ id:'polyritmes', title:'Polyritmes', desc:'Twee lagen tegelijk: boven (stokken omhoog, oranje) en onder (stokken omlaag, blauw). Zet de metronoom eventueel uit om alleen de twee lagen te horen.', cells:[
  { title:'3 tegen 2', groups:[G(rep('8',3),[3,2])], lower:[G(['8','8'])] },
  { title:'2 tegen 3', groups:[G(['8','8'])], lower:[G(rep('8',3),[3,2])] },
  { title:'3 tegen 2 (kwarten)', groups:[G(['q','q','q'],[3,2])], lower:[G(['q','q'])] },
  { title:'4 tegen 3', groups:[G(rep('16',4))], lower:[G(rep('8',3),[3,2])] },
  { title:'3 tegen 4', groups:[G(rep('8',3),[3,2])], lower:[G(rep('16',4))] },
  { title:'5 tegen 4', groups:[G(rep('16',5),[5,4])], lower:[G(rep('16',4))] },
  { title:'4 tegen 3 (over 3 tellen)', beam:[3,4], groups:[G(['8d','8d','8d','8d'])], lower:[G(['q','q','q'])] },
  { time:'6/8', tempoUnit:1.5, pulse:1.5, bar:3, title:'3 tegen 2 in 6/8', groups:[G(['q','q','q'])], lower:[G(['qd','qd'])] },
]});

/* --- Oneven maten --- */
{
  const odd = (time, bar, pulses, beam, tokens, title) => ({ time, bar, pulses, beam, title, groups:[G(tokens)] });
  const B = arr => arr.map(n => [n,8]);
  SECTIONS.push({ id:'oneven', title:'Oneven maatsoorten', desc:'De maat bestaat uit groepjes van 2 en 3 achtsten. De metronoom tikt op het begin van elk groepje; het tempo geldt voor de kwartnoot.', cells:[
    odd('5/8', 2.5, [0,1], B([2,3]), rep('8',5), '5/8 (2+3)'),
    odd('5/8', 2.5, [0,1.5], B([3,2]), rep('8',5), '5/8 (3+2)'),
    odd('5/8', 2.5, [0,1], B([2,3]), ['q','qd'], '5/8 (2+3) lang'),
    odd('5/8', 2.5, [0,1.5], B([3,2]), ['qd','q'], '5/8 (3+2) lang'),
    odd('7/8', 3.5, [0,1,2], B([2,2,3]), rep('8',7), '7/8 (2+2+3)'),
    odd('7/8', 3.5, [0,1.5,2.5], B([3,2,2]), rep('8',7), '7/8 (3+2+2)'),
    odd('7/8', 3.5, [0,1,2.5], B([2,3,2]), rep('8',7), '7/8 (2+3+2)'),
    odd('7/8', 3.5, [0,1,2], B([2,2,3]), ['q','8','8','8','8','8'], '7/8 (2+2+3) gemengd'),
    odd('7/8', 3.5, [0,1,2], B([2,2,3]), ['q','q','qd'], '7/8 (2+2+3) lang'),
    odd('9/8', 4.5, [0,1,2,3], B([2,2,2,3]), rep('8',9), '9/8 aksak (2+2+2+3)'),
  ]});
}

