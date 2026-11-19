/* ================= Drone & toonladders (view #drone, prefix dr) =================
   Blijvende grondtoon (Engine.drone) met een kwintencirkel om de grondtoon te kiezen, plus een
   stapknop "volgende toon in de toonladder". In de cirkel zet een klik een toon in de drone aan/uit (do = drone aan/uit);
   de toonsoort kies je alleen in de keuzelijst #drRoot. De toon die je nu speelt pulseert om toonladders op viool tegen de drone te spelen.
   Kleuren: de kleur van een toon hangt af van zijn plek t.o.v. de grondtoon in de kwintencirkel
   (1 = blauw, 5 = paars, 2 = magenta, 3 = rood …), dus een trap heeft in elke toonsoort dezelfde kleur.
   Logt geen antwoorden (geen vraag/antwoord), telt wel oefentijd (view 'drone' in Score).
   Standen (drS.sub): 'vrij' = toonladders (dit bestand), 'trap' = Degrees (drone-trappen.js), 'melo' = Melodieën (drone-melodie.js);
   Degrees en Melodieën gebruiken dezelfde drone, maar dan alleen de grondtoon.
   Opslag: 'drone-settings'. Toetsen via Keys (toetsen.js): Spatie = toon nog eens, Enter/→ = volgende, ← = vorige,
   Home = begin, D = drone aan/uit, M = metronoom, P = pauze/verder (drone + metronoom, alles blijft staan), Esc = alles stil. */

const DR_KEY = 'drone-settings';
const DR_CIRCLE = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];            // kwintencirkel, C bovenaan
const DR_DEG_F = ['1','5','2','6','3','7','♯4','♭2','♭6','♭3','♭7','4']; // trap per kwintstap vanaf de grondtoon
const DR_SPELL_MAJ = {0:['C',0],7:['G',0],2:['D',0],9:['A',0],4:['E',0],11:['B',0],6:['F',1],1:['D',-1],8:['A',-1],3:['E',-1],10:['B',-1],5:['F',0]};
const DR_SPELL_MIN = Object.assign({}, DR_SPELL_MAJ, {1:['C',1], 8:['G',1]});
const DR_LETTERS = 'CDEFGAB', DR_NAT = [0,2,4,5,7,9,11];
const DR_ACC = {'-2':'𝄫','-1':'♭','0':'','1':'♯','2':'𝄪'};
// toonladders uit de gedeelde theoriebibliotheek (Theorie.SCALES, 19-11-2026): elke toonladder daar kan ook tegen de drone.
// offs = letterstap per toon (voor de spelling), up/down = halve tonen; melodisch mineur daalt als natuurlijk mineur.
const DR_SCALES = {};
Theorie.SCALES.forEach(sc => {
  const nat = Theorie.SCALES.find(x => x.id === 'nmin');
  DR_SCALES[sc.id] = { n: sc.nl.charAt(0).toUpperCase() + sc.nl.slice(1), grp: sc.grp, offs: sc.offs, up: sc.semis,
    down: sc.id === 'mmin' && nat ? nat.semis : sc.semis, downOffs: sc.id === 'mmin' && nat ? nat.offs : sc.offs };
});
const DR_OLD = { nat:'nmin', harm:'hmin', mel:'mmin' };   // oude namen in opgeslagen instellingen
const DR_IV = ['grondtoon','kleine secunde','grote secunde','kleine terts','grote terts','reine kwart','overmatige kwart','reine kwint','kleine sext','grote sext','kleine septiem','grote septiem'];
// zuivere stemming t.o.v. de piano (gelijkzwevend), alleen waar je het tegen een drone duidelijk hoort
const DR_JUST = {
  0:'Luister tot de zweving helemaal weg is.',
  7:'Reine kwint: zuiver vrijwel gelijk aan de piano. Geen zweving = goed.',
  5:'Reine kwart: zuiver vrijwel gelijk aan de piano. Geen zweving = goed.',
  4:'Zuivere grote terts ligt <b>lager</b> dan op de piano (−14 cent).',
  3:'Zuivere kleine terts ligt <b>hoger</b> dan op de piano (+16 cent).',
  9:'Zuivere grote sext ligt <b>lager</b> dan op de piano (−16 cent).',
  8:'Zuivere kleine sext ligt <b>hoger</b> dan op de piano (+14 cent).',
  11:'Leidtoon: speel hem in een toonladder gerust iets hoog, richting de grondtoon.'
};

let drS = { pc:7, oct:3, add:null, octave:false, inst:'orgel', vol:35, rev:35, noteVol:50, scale:'maj', octs:2, start:3,
            hear:true, noteInst:'piano', metro:false, bpm:60, per:2, auto:false };
try { Object.assign(drS, JSON.parse(localStorage.getItem(DR_KEY)) || {}); } catch(e){}
if (drS.inst === 'orgeldiep') drS.inst = 'orgel';
if (!['strijker','orgel','cello','orgelsynth','fluit','sinus'].includes(drS.inst)) drS.inst = 'strijker';   // weggehaalde klanken (strijk2, tanpura)
if (!Array.isArray(drS.add)) drS.add = drS.fifth === false ? [] : [7];   // oude instelling 'kwint aan/uit' omzetten
delete drS.fifth;
if (DR_OLD[drS.scale]) drS.scale = DR_OLD[drS.scale];
if (!DR_SCALES[drS.scale]) drS.scale = 'maj';
const DR_PRESETS = [['Alleen grondtoon', []], ['Kwint', [7]], ['Majeur drieklank', [4,7]], ['Mineur drieklank', [3,7]], ['Kwart + kwint', [5,7]]];
let drSeq = [], drIdx = -1, drPaused = null;   // drPaused = {drone, metro} wat er klonk vóór de pauze

// Klankvolume (schuif #drNoteVol, 0–100, standaard 50 = de oude vaste sterkte): voorbeeldtoon (drPlay) en vraagtoon (dtNote)
const drNoteGain = base => base * (drS.noteVol == null ? 50 : drS.noteVol) / 50;
const drSave = () => { try { localStorage.setItem(DR_KEY, JSON.stringify(drS)); } catch(e){} };
const drMinor = () => !DR_SCALES[drS.scale].up.includes(4);   // spelling van de grondtoon: mineur-achtig als er geen grote terts in zit
const drSpell = pc => (drMinor() ? DR_SPELL_MIN : DR_SPELL_MAJ)[pc];
const drRootName = pc => { const [l, a] = drSpell(pc); return l + DR_ACC[a]; };
const drDroneMidi = () => 12 * (drS.oct + 1) + drS.pc;
const drHue = semi => (240 + 30 * ((semi * 7) % 12)) % 360;           // kwintstappen vanaf de grondtoon
const drColor = semi => `hsl(${drHue(semi)} 75% 58%)`;
const drDegLabel = semi => DR_DEG_F[(semi * 7) % 12];
function drNameAt(semi){                                   // nootnaam van een trap boven de grondtoon
  const [rl] = drSpell(drS.pc), n = parseInt(drDegLabel(semi).replace(/[♭♯]/, ''), 10);
  const letter = (DR_LETTERS.indexOf(rl) + n - 1) % 7, pc = (drS.pc + semi) % 12;
  const acc = ((pc - DR_NAT[letter]) % 12 + 18) % 12 - 6;
  return DR_LETTERS[letter] + DR_ACC[acc];
}

/* --- toonladder opbouwen (met juiste spelling: elke letter één keer) --- */
function drBuild(){
  const sc = DR_SCALES[drS.scale], [rl, ra] = drSpell(drS.pc), li = DR_LETTERS.indexOf(rl);
  const root = 12 * (drS.start + 1) + drS.pc, seq = [];
  const mk = (o, i, s) => {
    const m = root + 12 * o + s, letter = (li + i) % 7;
    const acc = ((m - DR_NAT[letter]) % 12 + 18) % 12 - 6;
    const oct = Math.floor((m - acc) / 12) - 1;
    return { m, semi: s % 12, deg: i % 7, name: DR_LETTERS[letter] + DR_ACC[acc], oct };
  };
  for (let o = 0; o < drS.octs; o++) sc.up.forEach((s, i) => seq.push(mk(o, sc.offs[i], s)));
  seq.push(mk(drS.octs, 0, 0));
  for (let o = drS.octs - 1; o >= 0; o--) for (let i = sc.down.length - 1; i >= 0; i--) seq.push(mk(o, sc.downOffs[i], sc.down[i]));
  drSeq = seq; drIdx = -1;
}

/* --- drone --- */
function drDroneOpts(){ return { fifth: false, add: drS.sub !== 'vrij' ? [] : drS.add.slice(),   // Degrees/Melodieën: alleen de grondtoon
  octave: drS.octave, inst: drS.inst, vol: Math.max(.004, drS.vol / 100 * .15) }; }
function drDroneOn(){ drPaused = null; Engine.ensure(); Engine.drone.start(drDroneMidi(), drDroneOpts()); drDraw(); }
function drSetRoot(pc){ drS.pc = pc; drSave(); drFill(); drBuild(); drRefreshDrone(); drDraw(); if (typeof dtOnRoot === 'function') dtOnRoot(); if (typeof dmOnRoot === 'function') dmOnRoot(); }
function drDroneOff(){ drPaused = null; Engine.drone.stop(); drDraw(); }
/* pauze: drone en metronoom stil, maar grondtoon, tonen, positie in de toonladder en metronoom-instelling blijven */
function drPause(){
  if (drPaused){
    const p = drPaused; drPaused = null;
    if (p.drone){ Engine.ensure(); Engine.drone.start(drDroneMidi(), drDroneOpts()); }
    if (p.metro) drMetro();
  } else {
    const on = Engine.drone.on(), mt = Engine.metronome.running();
    if (!on && !mt) return;
    drPaused = { drone: on, metro: mt };
    Engine.drone.stop(); Engine.metronome.stop();
  }
  drDraw();
}
function drStopAll(){ drPaused = null; Engine.stopAll(); drDraw(); }
function drToggle(){ if (drPaused){ drPause(); return; } Engine.drone.on() ? drDroneOff() : drDroneOn(); }
function drRefreshDrone(){ if (drPaused) return; if (Engine.drone.on()) Engine.drone.start(drDroneMidi(), drDroneOpts()); }

/* --- stappen door de toonladder --- */
function drPlay(n, t){
  if (!drS.hear || !n) return;
  Engine.ensure();
  Engine.note(t || Engine.now() + .02, n.m, drS.metro ? Math.min(2.5, 60 / drS.bpm * drS.per * .9) : 1.3, { inst: drS.noteInst, vol: drNoteGain(.32) });
}
function drStep(dir, t){
  if (!drSeq.length) drBuild();
  const last = drSeq.length - 1;
  if (dir > 0) drIdx = drIdx >= last ? 1 : drIdx + 1;        // na de laatste grondtoon: nieuwe ronde omhoog
  else drIdx = drIdx <= 0 ? 0 : drIdx - 1;
  drPlay(drSeq[drIdx], t); drShow();
}
function drReset(){ drIdx = -1; drShow(); }
function drListen(){ if (drIdx < 0) drStep(1); else drPlay(drSeq[drIdx]); }

/* --- metronoom (eenvoudige tik + automatisch door) --- */
function drMetro(){
  Engine.metronome.stop();
  if (!drS.metro || drPaused || drS.sub !== 'vrij' || $('droneView').classList.contains('board') || typeof view === 'undefined' || view !== 'drone') return;
  Engine.metronome.start({ bpm: drS.bpm, beats: drS.per, sub: 1, accent: true,
    onBeat: (i, t) => { if (drS.auto && i % drS.per === 0 && view === 'drone') drStep(1); } });
}

/* --- tekenen --- */
function drCircle(){
  if (drS.sub === 'trap' && typeof dtCircle === 'function') return dtCircle();   // Degrees vult dezelfde cirkel anders in
  if (drS.sub === 'melo' && typeof dmCircle === 'function') return dmCircle();   // Melodieën ook
  // Vrij spelen (gedeelde Cirkel uit kwintcirkel.js): klik op een toon = die toon in de drone aan/uit, do = drone aan/uit.
  // Gevuld = klinkt in de drone, ring = niet, gedimd = buiten de toonladder; de toon die je nu speelt pulseert.
  const inScale = new Set(DR_SCALES[drS.scale].up.concat(DR_SCALES[drS.scale].down));
  const cur = drIdx >= 0 ? drSeq[drIdx] : null, on = Engine.drone.on();
  Cirkel.draw($('drCircle'), {
    id:'drc', label:'Kwintencirkel: klik een toon om hem in de drone aan of uit te zetten',
    color:drColor, degree:drDegLabel, name:drNameAt,
    dot:semi => { const inDr = semi === 0 ? on : drS.add.includes(semi);
      return { fill:inDr, faint:!inScale.has(semi), pulse:!!(cur && cur.semi === semi),
        title:semi === 0 ? 'Drone aan/uit' : inDr ? 'Klik: uit de drone' : 'Klik: in de drone',
        aria:semi === 0 ? 'Drone aan of uit' : drNameAt(semi) + (inDr ? ' uit de drone halen' : ' aan de drone toevoegen') }; },
    onDot:semi => semi ? drToggleTone(semi) : drToggle(),
    center:{ html:Cirkel.icon(on ? 'stop' : 'play'), title:'Drone aan/uit (' + Keys.label('grondtoon') + ')', onClick:drToggle }
  });
}
function drShow(){
  const n = drIdx >= 0 ? drSeq[drIdx] : null, last = drSeq.length - 1;
  if (!n){
    $('drNote').innerHTML = `<span class="drbig muted">–</span>`;
    $('drInfo').innerHTML = `Druk op <b>Volgende toon</b> (${Keys.label('volgende')}) om te beginnen op ${drSeq.length ? drSeq[0].name + drSeq[0].oct : ''}.`;
    $('drHint').innerHTML = '';
  } else {
    const dir = drIdx === 0 ? '' : drIdx < last / 2 || drIdx === last / 2 ? '↑' : '↓';
    $('drNote').innerHTML = `<span class="drbig" style="color:${drColor(n.semi)}">${n.name}<small>${n.oct}</small></span>`;
    $('drInfo').innerHTML = `<b>trap ${drDegLabel(n.semi)}</b> · ${n.semi ? DR_IV[n.semi] + ' boven de drone' : 'grondtoon (zelfde toon als de drone)'} · ${drIdx + 1} / ${drSeq.length} ${dir}`;
    $('drHint').innerHTML = DR_JUST[n.semi] || '';
  }
  $('drSlots').innerHTML = drSeq.map((x, i) =>
    `<span class="drslot${i === drIdx ? ' on' : ''}${i === last / 2 ? ' top' : ''}" style="--c:${drColor(x.semi)}" data-i="${i}" title="${x.name}${x.oct} · trap ${drDegLabel(x.semi)}">${x.name}</span>`).join('');
  $('drSlots').querySelectorAll('.drslot').forEach(s => s.onclick = () => { drIdx = +s.dataset.i; drPlay(drSeq[drIdx]); drShow(); });
  drCircle();
}
function drTones(){                                        // alleen nog de voorkeuzeknoppen bijwerken (tonen kies je in de cirkel)
  const cur = JSON.stringify(drS.add.slice().sort((a, b) => a - b));
  $('drPresets').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === cur));
}
function drToggleTone(semi){
  const adding = !drS.add.includes(semi);
  drS.add = adding ? drS.add.concat(semi).sort((a, b) => a - b) : drS.add.filter(x => x !== semi);
  drSave();
  if (adding && !Engine.drone.on() && !drPaused) drDroneOn(); else { drRefreshDrone(); drDraw(); }   // toon aanzetten = ook horen
}
function drDraw(){
  drShow(); drTones();
  const extra = drS.sub !== 'vrij' ? [] : drS.add.map(drNameAt).concat(drS.octave ? [drRootName(drS.pc) + ' (octaaf)'] : []);
  $('drState').textContent = drPaused ? '⏸ Gepauzeerd (P = verder)' : Engine.drone.on() ? `Drone: ${drRootName(drS.pc)}${drS.oct}${extra.length ? ' + ' + extra.join(' + ') : ''}` : 'Drone staat uit';
  const pb = $('drPause');
  pb.textContent = drPaused ? '▶ Verder' : '⏸ Pauze';
  pb.classList.toggle('on', !!drPaused);
  pb.disabled = !drPaused && !Engine.drone.on() && !Engine.metronome.running();
}

/* --- keuzelijsten vullen --- */
function drFill(){
  const nm = drRootName(drS.pc);
  $('drRoot').innerHTML = DR_CIRCLE.map(pc => `<option value="${pc}"${pc === drS.pc ? ' selected' : ''}>${drRootName(pc)}</option>`).join('');
  $('drOct').innerHTML = [1,2,3,4,5].map(o => `<option value="${o}"${o === drS.oct ? ' selected' : ''}>${nm}${o}</option>`).join('');
  $('drStart').innerHTML = [3,4,5,6].map(o => `<option value="${o}"${o === drS.start ? ' selected' : ''}>${nm}${o}</option>`).join('');
  $('drScale').innerHTML = Theorie.SCALE_GROUPS.map(([g, gn]) => `<optgroup label="${gn}">` + Object.keys(DR_SCALES).filter(k => DR_SCALES[k].grp === g)
    .map(k => `<option value="${k}"${k === drS.scale ? ' selected' : ''}>${DR_SCALES[k].n}</option>`).join('') + '</optgroup>').join('');
}

/* --- instellingenpaneel: het gedeelde Paneel (js/paneel.js), zodat de cirkel het scherm kan vullen --- */
function drPanel(open){ Paneel.set('droneView', open); }

function drInit(){
  if (!$('droneView')) return;
  drFill();
  $('drInst').innerHTML = Engine.drone.INSTS.map(([id, n]) => `<option value="${id}"${id === drS.inst ? ' selected' : ''}>${n}</option>`).join('');
  if (drS.rev == null) drS.rev = 35;
  $('drRev').value = drS.rev; Engine.drone.reverb(drS.rev / 100);
  $('drRev').addEventListener('input', e => { drS.rev = +e.target.value; drSave(); Engine.drone.reverb(drS.rev / 100); });
  $('drNoteInst').innerHTML = Engine.instOptions(drS.noteInst);
  $('drOctave').checked = drS.octave; $('drVol').value = drS.vol;
  $('drOcts').value = drS.octs; $('drHear').checked = drS.hear;
  $('drMetroChk').checked = drS.metro; $('drBpm').value = drS.bpm; $('drPer').value = drS.per; $('drAuto').checked = drS.auto;
  const autoShow = () => { $('drAutoWrap').style.opacity = drS.metro ? 1 : .45; $('drAuto').disabled = !drS.metro; };
  autoShow();

  const on = (id, fn) => $(id).addEventListener('change', e => { fn(e.target); drSave(); if (e.target.tagName === 'SELECT') e.target.blur(); });
  on('drRoot',    el => { drSetRoot(+el.value); });
  on('drOct',     el => { drS.oct = +el.value; drRefreshDrone(); drDraw(); });
  on('drOctave',  el => { drS.octave = el.checked; drRefreshDrone(); drDraw(); });
  on('drInst',    el => { drS.inst = el.value; if (drS.inst === 'orgel' || drS.inst === 'cello') Samples.load(drS.inst); drRefreshDrone(); });
  if (drS.inst === 'orgel' || drS.inst === 'cello') Samples.load(drS.inst);
  $('drVol').addEventListener('input', e => { drS.vol = +e.target.value; drSave(); drRefreshDrone(); });
  if (drS.noteVol == null) drS.noteVol = 50;
  $('drNoteVol').value = drS.noteVol;
  $('drNoteVol').addEventListener('input', e => { drS.noteVol = +e.target.value; drSave(); });
  $('drNoteVol').addEventListener('change', e => {   // kort voorbeeld in de klank van de huidige stand
    e.target.blur(); ensureCtx(); Engine.stopNotes();
    const sub = drS.sub, inst = sub === 'trap' && typeof dtS !== 'undefined' ? dtS.inst : sub === 'melo' && typeof dmS !== 'undefined' ? dmS.inst : drS.noteInst;
    Engine.note(Engine.now() + .03, 60 + drS.pc, .7, { inst, vol: drNoteGain(sub === 'vrij' ? .32 : .34) });
  });
  on('drScale',   el => { drS.scale = el.value; drFill(); drBuild(); drDraw(); });
  on('drOcts',    el => { drS.octs = +el.value; drBuild(); drShow(); });
  on('drStart',   el => { drS.start = +el.value; drBuild(); drShow(); });
  on('drHear',    el => { drS.hear = el.checked; });
  on('drNoteInst',el => { drS.noteInst = el.value; });
  on('drMetroChk',el => { drS.metro = el.checked; autoShow(); drMetro(); drDraw(); });
  on('drBpm',     el => { drS.bpm = Math.min(240, Math.max(30, Math.round(+el.value) || 60)); el.value = drS.bpm; Engine.metronome.setBpm(drS.bpm); });
  on('drPer',     el => { drS.per = +el.value; drMetro(); });
  on('drAuto',    el => { drS.auto = el.checked; drMetro(); });

  $('drPresets').innerHTML = DR_PRESETS.map(([n, v]) => `<button data-v="${JSON.stringify(v)}">${n}</button>`).join('');
  $('drPresets').querySelectorAll('button').forEach(b => b.onclick = () => { b.blur(); drS.add = JSON.parse(b.dataset.v); drSave(); if (!Engine.drone.on() && !drPaused) drDroneOn(); else { drRefreshDrone(); drDraw(); } });
  const btn = (id, fn) => { $(id).onclick = () => { $(id).blur(); fn(); }; };
  btn('drNext', () => drStep(1));
  btn('drPrev', () => drStep(-1));
  btn('drAgain', drReset);
  btn('drReplay', drListen);
  btn('drPause', drPause);
  // sneltoetsen in de title-teksten uit de centrale lijst
  [['drNext','volgende','Volgende toon'],['drPrev','vorige','Vorige toon'],['drReplay','luister','Toon nog eens horen'],
   ['drAgain','begin','Terug naar het begin'],['drPause','pauze','Pauze / verder']].forEach(([id, a, t]) => { $(id).title = `${t} (${Keys.label(a)})`; });
  drBuild(); drDraw();
}

function drOnRoute(){
  if (typeof view === 'undefined') return;
  if (view === 'drone'){ if (typeof dtBoard === 'function') dtBoard(); drDraw(); drMetro(); }
  else { drPaused = null; drPanel(false); if (typeof dmStop === 'function') dmStop(); if (Engine.drone.on()) Engine.drone.stop(); }   // drone niet laten doorklinken in andere onderdelen
}

document.addEventListener('keydown', e => {
  if (typeof view === 'undefined' || view !== 'drone') return;
  if ($('droneView').classList.contains('board')) return;
  if (Keys.blocked(e)) return;
  if (drS.sub === 'trap' && typeof dtKey === 'function' && dtKey(e)) return;   // Degrees eerst
  if (drS.sub === 'melo' && typeof dmKey === 'function' && dmKey(e)) return;   // Melodieën
  const act = a => Keys.is(e, a);
  if (act('luister')){ e.preventDefault(); if (!e.repeat) drListen(); }
  else if (act('volgende')){ e.preventDefault(); drStep(1); }
  else if (act('vorige')){ e.preventDefault(); drStep(-1); }
  else if (act('begin')){ e.preventDefault(); drReset(); }
  else if (act('grondtoon')) drToggle();
  else if (act('pauze')){ e.preventDefault(); drPause(); }
  else if (act('metronoom')){ drS.metro = !drS.metro; $('drMetroChk').checked = drS.metro; $('drMetroChk').dispatchEvent(new Event('change')); }
  else if (act('stop')) drStopAll();
});
document.addEventListener('keyup', e => { if (typeof view !== 'undefined' && view === 'drone' && e.key === ' ') e.preventDefault(); });

drInit();
if (typeof view !== "undefined" && view === "drone") drOnRoute();
