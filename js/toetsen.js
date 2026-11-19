/* ================= Sneltoetsen (centrale lijst + sneltoets-maker) =================
   Eén plek voor alle sneltoetsen, zodat ze in elk onderdeel hetzelfde betekenen. De editor in
   Instellingen (instellingen.js) past ze aan; eigen toetsen staan in localStorage 'sneltoetsen'
   = {actie: ['toets', …]} (alleen acties die afwijken van de standaard).

   Standaard (gelden overal):
     Esc            stop        alles stil
     P              pauze       pauze / verder (Atlas, Tikken, Ritme luisteren, Drone)
     Spatie         luister     (opnieuw) luisteren / huidige toon nog eens
     Spatie         tik         meetikken (alleen Tikken)
     Enter of →     volgende    volgende vraag / volgende toon / volgend vakje
     ←              vorige      vorige toon / vorig vakje
     Enter          controleer  antwoord controleren (dictees; deelt Enter met volgende)
     Home           begin       terug naar het begin
     C              cadens      cadens spelen
     D              grondtoon   do / grondtoon (in Drone: drone aan/uit)
     M              metronoom   metronoom aan/uit
     Q              vraagapp    💬 algemene chat met Claude (overal; in Repertoire opent C de chat over het stuk)
     ↑ / ↓          sneller / langzamer   tempo ±1, met Shift ±5 (Metronoom)
     Backspace      wis         laatste invoer weg
     Antwoordtoetsen (1–9, 0, nootnamen, H/K/A/P in dictee) liggen per onderdeel vast: RESERVED.

   Keys.is(e, actie)      true als deze toetsdruk bij de actie hoort (geen Ctrl/Cmd/Alt).
   Keys.label(actie)      leesbare tekst, bv. 'Enter of →' (voor uitleg en title-teksten).
   Keys.blocked(e)        true als een module deze toets moet negeren omdat de focus in een invoerveld
                          staat (in keuzelijsten/vinkjes/schuiven werken luister, tik en stop nog wel).
   Keys.typing()          true als de focus in een invoerveld of keuzelijst staat.
   Keys.apply(root)       vult <kbd data-key="actie"> en title-teksten met data-ktitle="… {actie} …".
   Editor: Keys.ACTIONS, Keys.RESERVED, Keys.WHERE, Keys.add(actie, toets, {steal}), Keys.remove,
           Keys.reset(actie), Keys.resetAll(), Keys.isDefault(actie), Keys.name(toets), Keys.onChange(fn).
   Nieuwe toets nodig? Eerst kijken of een bestaande actie past; anders een actie toevoegen aan
   ACTIONS (met 'waar') en aan de tabel in het architectuurdocument. */
const Keys = (function(){
  const STORE = 'sneltoetsen';
  const ALL = ['atlas','tikken','luisteren','metronoom','gehoor','absoluut','intervallen','dictee','drone','intonatie','notenleer','partituren','cadensen','progressies','baslijn','termen','akkoordsymbolen','rudiments','polyritme','tempoladder','swing'];
  const WHERE = { atlas:'Atlas', tikken:'Tikken', luisteren:'Ritme luisteren', metronoom:'Metronoom', gehoor:'Relatief', absoluut:'Absoluut',
                  intervallen:'Intervallen', dictee:'Dictee', drone:'Drone', intonatie:'Intonatie', notenleer:'Notenleer', partituren:'Repertoire',
                  cadensen:'Cadensen', progressies:'Progressies', baslijn:'Baslijn', termen:'Termen', akkoordsymbolen:'Akkoordsymbolen', rudiments:'Rudiments', polyritme:'Polyritme', tempoladder:'Tempo-ladder', swing:'Swing' };
  // volgorde = volgorde in de editor
  const ACTIONS = [
    { id:'luister',    naam:'Luisteren',   uitleg:'(opnieuw) luisteren / huidige toon nog eens', keys:[' '],
      waar:['luisteren','gehoor','absoluut','intervallen','dictee','drone','intonatie','notenleer','partituren','cadensen','progressies','baslijn','akkoordsymbolen','rudiments','polyritme','swing'], deelt:['tik'] },
    { id:'volgende',   naam:'Volgende',    uitleg:'volgende vraag / volgende toon / volgend vakje', keys:['Enter','ArrowRight'],
      waar:['tikken','luisteren','metronoom','gehoor','absoluut','intervallen','dictee','drone','intonatie','notenleer','partituren','cadensen','progressies','baslijn','termen','akkoordsymbolen','rudiments','tempoladder','swing'], deelt:['controleer'] },
    { id:'vorige',     naam:'Vorige',      uitleg:'vorige toon / vorig vakje', keys:['ArrowLeft'], waar:['luisteren','metronoom','drone','partituren','rudiments','tempoladder'] },
    { id:'controleer', naam:'Controleren', uitleg:'antwoord nakijken (daarna doet dezelfde toets “volgende”)', keys:['Enter'],
      waar:['luisteren','dictee','drone','intonatie','akkoordsymbolen'], deelt:['volgende'] },
    { id:'wis',        naam:'Wissen',      uitleg:'laatste invoer weg', keys:['Backspace'], waar:['luisteren','dictee','drone','progressies','baslijn','akkoordsymbolen'] },
    { id:'cadens',     naam:'Cadens',      uitleg:'cadens spelen', keys:['c'], waar:['gehoor','dictee','progressies','baslijn'] },
    { id:'grondtoon',  naam:'Grondtoon',   uitleg:'do / grondtoon horen (in Drone: drone aan/uit)', keys:['d'], waar:['gehoor','dictee','drone','intonatie'] },
    { id:'tik',        naam:'Tikken',      uitleg:'meetikken met het ritme (Metronoom: tempo intikken)', keys:[' '], waar:['tikken','metronoom','tempoladder','swing'], deelt:['luister'] },
    { id:'pauze',      naam:'Pauze',       uitleg:'pauze / verder', keys:['p'], waar:['atlas','tikken','luisteren','metronoom','drone','intonatie','partituren','rudiments'] },
    { id:'metronoom',  naam:'Metronoom',   uitleg:'metronoom aan/uit', keys:['m'], waar:['metronoom','drone','partituren','rudiments','polyritme','tempoladder','swing'] },
    { id:'sneller',    naam:'Sneller',     uitleg:'tempo +1 (met Shift +5)', keys:['ArrowUp'], waar:['metronoom','partituren','rudiments','polyritme'] },
    { id:'langzamer',  naam:'Langzamer',   uitleg:'tempo −1 (met Shift −5)', keys:['ArrowDown'], waar:['metronoom','partituren','rudiments','polyritme'] },
    { id:'begin',      naam:'Begin',       uitleg:'terug naar het begin', keys:['Home'], waar:['drone','partituren'] },
    { id:'volscherm',  naam:'Volledig scherm', uitleg:'volledig scherm aan/uit (Repertoire)', keys:['f','F2'], waar:['partituren'] },
    { id:'claude',     naam:'Vraag aan Claude', uitleg:'💬 chatvenster met Claude open/dicht (Repertoire)', keys:['c'], waar:['partituren'] },
    { id:'vraagapp',   naam:'Vraag aan Claude (algemeen)', uitleg:'💬 algemene chat met Claude open/dicht, vanaf elk scherm', keys:['q'], waar:ALL },
    { id:'stop',       naam:'Stop',        uitleg:'alles stil', keys:['Escape'], waar:ALL }
  ];
  const BY = {}; ACTIONS.forEach(a => { BY[a.id] = a; });
  const DEFAULT = {}; ACTIONS.forEach(a => { DEFAULT[a.id] = a.keys.slice(); });
  // vaste antwoordtoetsen per onderdeel (niet aan te passen, mogen niet door een actie gebruikt worden)
  const dig = s => s.split('');
  const RESERVED = {
    gehoor:      [{ keys:dig('1234567'), wat:'1–7 = trap' }],
    absoluut:    [{ keys:dig('cdefgab'), wat:'C D E F G A B = noot (Shift = halve toon hoger)' }, { keys:['-','+','='], wat:'− + = ♭ / ♯ vóór de letter (Absoluut gehoor)' }, { keys:dig('1234567890'), wat:'1–8 = octaaf (Noten benoemen), 1–9 en 0 = soort (Toonladders)' }],
    intervallen: [{ keys:dig('1234567890'), wat:'1–9, 0 = interval' }],
    dictee:      [{ keys:dig('1234567'), wat:'1–7 = trap' }, { keys:['ArrowUp','ArrowDown'], wat:'↑ ↓ = octaaf' },
                  { keys:['+','=','-'], wat:'+ − = halve toon' }, { keys:['h','k','a','.','p'], wat:'H K A = halve/kwart/achtste, P of . = punt' }],
    luisteren:   [{ keys:dig('123456'), wat:'1–6 = antwoord (ritmequiz)' }],
    notenleer:   [{ keys:dig('cdefgab'), wat:'C D E F G A B = noot (Shift = ♯)' }, { keys:['-','+','='], wat:'− + = ♭ / ♯ kiezen (2× = 𝄫 / 𝄪)' }, { keys:dig('12345678'), wat:'1–8 = octaaf' }],
    intonatie:   [{ keys:dig('123456789'), wat:'1 2 3 = te laag / zuiver / te hoog; bij Wie is er vals? 1–9 = de valse noot' }, { keys:['ArrowUp','ArrowDown'], wat:'↑ ↓ = hoger / lager bij zelf zuiver zetten (Shift = 5 cent)' }],
    cadensen:    [{ keys:dig('1234567'), wat:'1–7 = slot (in de volgorde van de knoppen)' }],
    baslijn:     [{ keys:dig('1234567'), wat:'1–7 = trap van de bastoon' }, { keys:['b'], wat:'B = alleen de bas' }],
    termen:      [{ keys:dig('1234'), wat:'1–4 = antwoord' }],
    progressies: [{ keys:dig('1234567'), wat:'1–7 = drieklank op die trap (Shift = septiemakkoord)' }],
    polyritme:   [{ keys:['f','j'], wat:'F = links, J = rechts (meetikken)' }],
    swing:       [{ keys:dig('1234'), wat:'1–4 = soort swing (luisteren)' }],
    drone:       [{ keys:dig('1234567'), wat:'1–7 = trap bij Degrees en Melodieën (Shift+2/3/6/7 = ♭2/♭3/♭6/♭7)' }, { keys:['t'], wat:'T = tritonus (♯4)' }]
  };
  // toetsen die je niet kunt instellen
  const NOPE = ['Tab','Shift','Control','Alt','AltGraph','Meta','OS','CapsLock','NumLock','ScrollLock','ContextMenu','Dead','Unidentified','Process','Fn'];
  const NAMES = { ' ':'Spatie', Enter:'Enter', ArrowRight:'→', ArrowLeft:'←', ArrowUp:'↑', ArrowDown:'↓', Escape:'Esc', Home:'Home', End:'End',
                  PageUp:'PgUp', PageDown:'PgDn', Backspace:'Backspace', Delete:'Delete', Insert:'Insert', '-':'−' };

  const norm = k => k.length === 1 ? k.toLowerCase() : k;
  const name = k => NAMES[k] || (k.length === 1 ? k.toUpperCase() : k);
  const map = JSON.parse(JSON.stringify(DEFAULT));
  try {
    const saved = JSON.parse(localStorage.getItem(STORE)) || {};
    Object.keys(saved).forEach(a => {
      if (BY[a] && Array.isArray(saved[a])) map[a] = saved[a].filter(k => typeof k === 'string' && k).map(norm);
    });
  } catch(e){}

  const listeners = [];
  function save(){
    const diff = {};
    ACTIONS.forEach(a => { if (!isDefault(a.id)) diff[a.id] = map[a.id]; });
    try {
      if (Object.keys(diff).length) localStorage.setItem(STORE, JSON.stringify(diff));
      else localStorage.removeItem(STORE);
    } catch(e){}
    apply();
    listeners.forEach(fn => { try { fn(); } catch(e){} });
  }
  const isDefault = a => (map[a] || []).join('\u0001') === DEFAULT[a].join('\u0001');
  const where = list => list.length === ALL.length ? 'overal' : list.map(w => WHERE[w]).join(', ');
  const overlap = (x, y) => x.filter(w => y.includes(w));

  // controle: mag 'key' bij 'action'? → null (mag) of {msg, steal: actie-id (alleen bij botsing met een andere actie)}
  function check(action, key){
    const k = norm(key), A = BY[action];
    if (!A) return { msg:'Onbekende actie.' };
    if (NOPE.includes(key)) return { msg:name(key) + ' kun je niet als sneltoets gebruiken.' };
    if ((map[action] || []).includes(k)) return { msg:name(k) + ' staat al bij ' + A.naam + '.' };
    for (const w of A.waar){
      const r = (RESERVED[w] || []).find(g => g.keys.includes(k));
      if (r) return { msg:'In ' + WHERE[w] + ' is ' + name(k) + ' al een antwoordtoets (' + r.wat + '). Kies een andere toets.' };
    }
    for (const B of ACTIONS){
      if (B.id === action || !(map[B.id] || []).includes(k)) continue;
      if ((A.deelt || []).includes(B.id)) continue;
      const ov = overlap(A.waar, B.waar);
      if (ov.length) return { msg:name(k) + ' doet al “' + B.naam + '” in ' + where(ov) + '.', steal:B.id };
    }
    return null;
  }
  function add(action, key, opt){
    const c = check(action, key);
    if (c && !(c.steal && opt && opt.steal)) return Object.assign({ ok:false }, c);
    const k = norm(key);
    if (c && c.steal) map[c.steal] = map[c.steal].filter(x => x !== k);
    map[action] = (map[action] || []).concat(k);
    save();
    return { ok:true, msg:name(k) + ' = ' + BY[action].naam + (c && c.steal ? ' (weggehaald bij ' + BY[c.steal].naam + ')' : '') + '.' };
  }
  function remove(action, key){ map[action] = (map[action] || []).filter(x => x !== key); save(); }
  // standaard terugzetten; haalt die toetsen weg bij acties die ze intussen gebruiken (anders twee acties op één toets)
  function reset(action){
    const A = BY[action];
    DEFAULT[action].forEach(k => ACTIONS.forEach(B => {
      if (B.id !== action && !(A.deelt || []).includes(B.id) && overlap(A.waar, B.waar).length && map[B.id].includes(k))
        map[B.id] = map[B.id].filter(x => x !== k);
    }));
    map[action] = DEFAULT[action].slice(); save();
  }
  function resetAll(){ ACTIONS.forEach(a => { map[a.id] = DEFAULT[a.id].slice(); }); save(); }

  function is(e, action){
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    return (map[action] || []).includes(norm(e.key));
  }
  const label = action => (map[action] || []).length ? map[action].map(name).join(' of ') : '(geen toets)';
  function typing(){
    const t = document.activeElement && document.activeElement.tagName;
    return t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA';
  }
  const TEXTY = ['text','search','email','url','password','tel'];
  function blocked(e){
    const el = document.activeElement, t = el && el.tagName;
    if (t === 'TEXTAREA' || (el && el.isContentEditable)) return true;
    if (t === 'INPUT' && TEXTY.includes((el.type || 'text').toLowerCase())) return true;
    if (t === 'INPUT' || t === 'SELECT') return !(is(e, 'luister') || is(e, 'tik') || is(e, 'stop'));
    return false;
  }
  // <kbd data-key="volgende"></kbd> → 'Enter of →'; title-teksten met data-ktitle="Volgende toon ({volgende})"
  function apply(root){
    const r = root || document;
    r.querySelectorAll('[data-key]').forEach(el => { el.textContent = label(el.dataset.key); });
    r.querySelectorAll('[data-ktitle]').forEach(el => {
      el.title = el.dataset.ktitle.replace(/\{(\w+)\}/g, (m, a) => BY[a] ? label(a) : m);
    });
  }
  const onChange = fn => listeners.push(fn);

  apply();   // scripts staan onderaan de pagina, de DOM is er al
  return { is, label, typing, blocked, apply, map, DEFAULT, ACTIONS, RESERVED, WHERE, ALL,
           check, add, remove, reset, resetAll, isDefault, name, norm, where, onChange };
})();
