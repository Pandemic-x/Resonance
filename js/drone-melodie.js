/* ================= Drone → Melodieën (prefix dm, stand drS.sub = 'melo') =================
   Boven de drone (alleen de grondtoon) klinkt een korte melodie (3–20 noten); je speelt hem na door de trappen in
   volgorde in de gedeelde kwintencirkel (Cirkel) aan te tikken. Twee manieren van nakijken (dmS.check):
     'noot' = per noot meteen goed/fout (fout = stippelring, opnieuw; na dmS.tries fouten wordt de noot getoond),
     'eind' = eerst alles invullen (wis = laatste weg), dan controleer → per vakje goed/fout + het juiste antwoord.
   Sprongen: kleinste en grootste interval tussen twee noten (dmS.minI / dmS.maxI, DM_INTS); bestaat zo'n sprong niet in
   het niveau, dan de dichtstbijzijnde (melding in het paneel). Zoals Degrees: wisselende toonsoort (keyRand, keyEvery),
   wentijd (intro, alleen drone + grijze aftelring) bij de start en na elke wissel, tijdmodus (timed, limit = s per noot;
   de klok start als de melodie klaar is met spelen; te laat = rest fout).
   Na afloop klinkt de melodie terug terwijl de bollen meelichten (ook via '▶ Met kleuren').
   Gebruikt uit drone.js: drS, drColor, drDegLabel, drNameAt, drRootName, drDroneOn, drRefreshDrone, drNoteGain, drDraw,
   drFill, drBuild, drSave, DR_CIRCLE; uit drone-trappen.js: DT_LEVELS, DT_FEEL, DT_DIGIT, DT_LOW, dtMidi.
   Score: 'dronemelo' (per noot nakijken) en 'dronemeloe' (aan het eind), apart zodat de moeilijkere stand niets scheeftrekt;
   k = halve tonen 0–11 per noot, niveau `level|len|minI-maxI|<limit>s`. Opslag: 'dronemelo-settings'.
   Toetsen: luister = melodie (nog eens), volgende = nieuwe melodie, controleer (Enter, stand 'eind') = nakijken,
   wis (Backspace, stand 'eind') = laatste noot weg, 1–7 / Shift / T = trap. */

const DM_KEY = 'dronemelo-settings';
const DM_LEVELS = DT_LEVELS.filter(l => l.set);              // zelfde niveaus als Degrees (zonder eigen keuze)
const DM_TEMPI = [50, 60, 72, 90, 110, 130];
// intervalgroepen: [id, naam, kleinste halve tonen, grootste halve tonen] (tritonus hoort bij de kwart)
const DM_INTS = [['sec','secunde',1,2], ['terts','terts',3,4], ['kwart','kwart',5,6], ['kwint','kwint',7,7], ['sext','sext',8,9], ['sept','septiem',10,11], ['oct','octaaf',12,12]];
const dmInt = id => DM_INTS.findIndex(x => x[0] === id);
let dmS = { level:'l1', len:4, minI:'sec', maxI:'kwart', startDo:true, bpm:72, inst:'piano', hear:true, tries:2, auto:false,
            check:'noot', keyRand:false, keyEvery:10, intro:3, timed:false, limit:3 };
try { Object.assign(dmS, JSON.parse(localStorage.getItem(DM_KEY)) || {}); } catch(e){}
if (dmS.moves){ const m = { stap:['sec','terts'], klein:['sec','kwart'], vrij:['sec','sext'] }[dmS.moves] || ['sec','kwart']; dmS.minI = m[0]; dmS.maxI = m[1]; delete dmS.moves; }
if (!DM_LEVELS.some(l => l.id === dmS.level)) dmS.level = 'l1';
if (dmInt(dmS.minI) < 0) dmS.minI = 'sec';
if (dmInt(dmS.maxI) < dmInt(dmS.minI)) dmS.maxI = dmS.minI;
dmS.len = Math.min(20, Math.max(3, +dmS.len || 4));

let dmQ = null, dmTimers = [], dmStreak = 0, dmHi = null, dmFlash = null, dmLast = '';
let dmInKey = 0, dmWarm = false, dmIntro = false, dmIntroNew = false, dmIntroT = 0;
// dmQ = { notes:[{m, semi}], pos, tries, res:[{ok, a, shown}], inp:[semi] (stand 'eind'), done, wrongAt, check, start, dur, tmo, late }
const dmSave = () => { try { localStorage.setItem(DM_KEY, JSON.stringify(dmS)); } catch(e){} };
const dmLevel = () => DM_LEVELS.find(l => l.id === dmS.level) || DM_LEVELS[0];
const dmMod = c => (c || (dmQ && dmQ.check) || dmS.check) === 'eind' ? 'dronemeloe' : 'dronemelo';
const dmClear = () => { dmTimers.forEach(clearTimeout); dmTimers = []; dmHi = null; dmFlash = null; };
const dmBase = () => dtMidi(0);                              // do, een octaaf boven de drone (zoals bij Degrees)
const dmPc = m => ((m - dmBase()) % 12 + 12) % 12;
const dmNear = (ref, semi) => ref + (((semi - dmPc(ref)) % 12 + 18) % 12 - 6);   // dichtstbijzijnde toon met deze trap
const dmLabel = q => q.notes.map(n => drDegLabel(n.semi)).join(' ');
const dmActive = () => typeof view !== 'undefined' && view === 'drone' && drS.sub === 'melo';
const dmEnd = q => q && q.check === 'eind';
function dmNote(t, m, dur){ Engine.note(t, m, dur, { inst:dmS.inst, vol:drNoteGain(.34) }); }

[['dronemelo', 'Drone-melodieën', ''], ['dronemeloe', 'Drone-melodieën (eind)', ' (nakijken aan het eind)']].forEach(([id, name, extra]) => Score.def(id, {
  name, view:'drone',
  label:k => 'trap ' + drDegLabel(+k) + ' (' + DT_FEEL[+k][0] + ') in een melodie' + extra,
  level:() => dmS.level + '|' + dmS.len + '|' + dmS.minI + '-' + dmS.maxI + '|' + (dmS.timed ? dmS.limit + 's' : ''),
  levelName:lv => { const p = lv.split('|'), L = DM_LEVELS.find(l => l.id === p[0]), iv = (p[2] || '').split('-').map(x => (DM_INTS[dmInt(x)] || [0, x])[1]);
    return (L ? L.name : p[0]) + ', ' + p[1] + ' noten, ' + (iv[0] === iv[1] ? iv[0] : iv.join('–')) + (p[3] ? ', ' + p[3].replace('s', ' s per noot') : ''); },
  next:lv => { const p = lv.split('|'), i = DM_LEVELS.findIndex(l => l.id === p[0]);
    return +p[1] < 8 ? 'langere melodieën (' + (+p[1] + 1) + ' noten)' : i >= 0 && i < DM_LEVELS.length - 1 ? 'niveau ' + DM_LEVELS[i + 1].name : 'grotere sprongen of tijdmodus'; }
}));

/* --- melodie maken: tonen uit het niveau, van do−8 tot do+17; elke sprong tussen de kleinste en grootste gekozen interval --- */
function dmPool(){ const set = dmLevel().set, base = dmBase(), pool = []; for (let m = base - 8; m <= base + 17; m++) if (set.includes(dmPc(m))) pool.push(m); return pool; }
const dmRange = () => [DM_INTS[dmInt(dmS.minI)][2], DM_INTS[dmInt(dmS.maxI)][3]];
function dmNext(pool, cur){
  const [lo, hi] = dmRange();
  let c = pool.filter(m => { const d = Math.abs(m - cur); return d >= lo && d <= hi; });
  if (!c.length){                                                   // zo'n sprong bestaat hier niet: de dichtstbijzijnde
    const dist = m => { const d = Math.abs(m - cur); return d < lo ? lo - d : d - hi; };
    const best = Math.min(...pool.filter(m => m !== cur).map(dist));
    c = pool.filter(m => m !== cur && dist(m) === best);
  }
  return c[Math.floor(Math.random() * c.length)];
}
// kan elke toon in het midden van het bereik een sprong binnen de grenzen maken? (anders melding in het paneel)
function dmFits(){ const pool = dmPool(), base = dmBase(), [lo, hi] = dmRange();
  return pool.filter(m => m >= base - 5 && m <= base + 12).every(cur => pool.some(m => { const d = Math.abs(m - cur); return d >= lo && d <= hi; })); }
function dmMake(){
  const pool = dmPool(), base = dmBase();
  let cur = dmS.startDo ? base : (() => { const mid = pool.filter(m => m >= base - 5 && m <= base + 7); return mid[Math.floor(Math.random() * mid.length)]; })();
  const out = [cur];
  for (let n = 1; n < dmS.len; n++){ cur = dmNext(pool, cur); out.push(cur); }
  return out.map(m => ({ m, semi:dmPc(m) }));
}

function dmNew(){
  dmClear();
  if (dmS.keyRand && dmInKey >= dmS.keyEvery) dmNewKey();
  if (!dmWarm && dmS.intro > 0){ dmStartIntro(); return; }          // wentijd: alleen de drone, nog geen melodie
  dmWarm = true; dmInKey++;
  let notes, tries = 0;
  do { notes = dmMake(); tries++; } while (tries < 8 && notes.map(n => n.m).join() === dmLast);   // niet twee keer dezelfde
  dmLast = notes.map(n => n.m).join();
  dmQ = { notes, pos:0, tries:0, res:[], inp:[], done:false, wrongAt:-1, check:dmS.check };
  Score.ask(dmMod());
  dmPlay(); dmRender();
}
// wisselende toonsoort: nieuwe grondtoon (zonder dmOnRoot, dan blijft de sessie lopen); daarna volgt de wentijd
function dmNewKey(){
  const others = DR_CIRCLE.filter(pc => pc !== drS.pc);
  drS.pc = others[Math.floor(Math.random() * others.length)]; drSave(); drFill(); drBuild();
  dmQ = null; dmInKey = 0; dmWarm = false; dmIntroNew = true;
  if (Engine.drone.on()) drRefreshDrone();
}
function dmStartIntro(){
  dmQ = null; dmIntro = true; dmIntroT = performance.now();
  Engine.ensure(); if (!Engine.drone.on()) drDroneOn();
  drDraw(); dmRender();
  dmTimers.push(setTimeout(() => { dmIntro = false; dmIntroNew = false; dmWarm = true; if (dmActive()) dmNew(); }, dmS.intro * 1000));
}

// melodie afspelen; hi = de bollen lichten mee op (alleen ná het antwoord, anders verklap je de melodie)
function dmPlay(hi){
  if (dmIntro) return;
  if (!dmQ){ dmNew(); return; }
  Engine.ensure();
  const keep = dmQ.tmo; dmTimers = dmTimers.filter(t => { if (t === keep) return true; clearTimeout(t); return false; }); dmHi = null;   // lopende timers weg, de klok niet
  let t = Engine.now() + .08;
  if (!Engine.drone.on()){ drDroneOn(); t += 1.2; }                  // eerst de drone laten landen
  if (!dmQ.done) Score.heard(dmMod());
  Engine.stopNotes();
  const q = dmQ, beat = 60 / dmS.bpm, n = q.notes.length, at = s => Math.max(0, (s - Engine.now()) * 1000), end = t + n * beat;
  q.notes.forEach((x, i) => {
    dmNote(t + i * beat, x.m, beat * .92);
    if (hi) dmTimers.push(setTimeout(() => { if (!dmActive() || dmQ !== q) return; dmHi = x.semi; dmCircle(); }, at(t + i * beat)));
  });
  if (hi) dmTimers.push(setTimeout(() => { dmHi = null; if (dmActive()) dmCircle(); }, at(end)));
  // tijdmodus: de klok start als de melodie de eerste keer klaar is met spelen (limit seconden per noot)
  if (dmS.timed && !q.done && !q.start){
    const lead = at(end);
    q.start = performance.now() + lead; q.dur = dmS.limit * n;
    q.tmo = setTimeout(() => { if (dmQ === q && !q.done) dmTimeUp(); }, lead + q.dur * 1000);
    dmTimers.push(q.tmo);
    dmCircle();
  }
  return end;                                                       // eindtijd (audioklok)
}
function dmMidClick(){ if (dmIntro) return; if (!dmQ || dmQ.done) dmNew(); else dmPlay(); }
function dmListen(){ if (dmIntro) return; if (!dmQ) dmNew(); else { dmFlash = null; dmPlay(dmQ.done); } }   // luister: nog eens (na afloop met kleuren)

/* --- invoer: één noot per tik --- */
function dmAnswer(semi){
  if (dmIntro) return;
  if (!dmQ){ dmNew(); return; }
  const q = dmQ;
  if (q.done){                                                      // na afloop: tik = toon horen om te vergelijken
    Engine.stopNotes(); dmNote(Engine.now() + .03, dmNear(dmBase(), semi), 1);
    dmFlash = { semi, ok:true }; dmCircle(); dmFlashOff(); return;
  }
  if (dmEnd(q)){                                                    // nakijken aan het eind: alleen invullen
    if (q.inp.length >= q.notes.length) return;
    const prev = q.inp.length ? q.inpM[q.inp.length - 1] : dmBase(), m = dmNear(prev, semi);
    q.inp.push(semi); (q.inpM = q.inpM || []).push(m);
    if (dmS.hear){ Engine.stopNotes(); dmNote(Engine.now() + .03, m, .8); }
    dmFlash = { semi, ok:true }; dmRender(); dmFlashOff(); return;
  }
  const want = q.notes[q.pos], ok = semi === want.semi;
  if (dmS.hear){ Engine.stopNotes(); dmNote(Engine.now() + .03, ok ? want.m : dmNear(want.m, semi), .8); }
  if (ok){
    if (!q.res[q.pos]) q.res[q.pos] = { ok:true };
    dmLog(q.pos);
    dmFlash = { semi, ok:true }; q.pos++; q.tries = 0; q.wrongAt = -1;
  } else {
    q.tries++; q.wrongAt = q.pos;
    if (!q.res[q.pos]) q.res[q.pos] = { ok:false, a:drDegLabel(semi) };   // eerste fout onthouden (voor de statistiek)
    dmFlash = { semi, ok:false };
    if (q.tries >= dmS.tries){                                      // hulp: de juiste noot laten zien en horen
      q.res[q.pos].shown = true; dmLog(q.pos);
      dmTimers.push(setTimeout(() => { if (!dmActive() || dmQ !== q) return; Engine.stopNotes(); dmNote(Engine.now() + .03, want.m, .9);
        dmFlash = { semi:want.semi, ok:true }; dmRender(); dmFlashOff(); }, 650));
      q.pos++; q.tries = 0;
    }
  }
  if (q.pos >= q.notes.length) dmFinish(q.res[q.notes.length - 1].shown ? 1500 : 700); else { dmRender(); dmFlashOff(); }
}
function dmWis(){
  const q = dmQ; if (dmIntro || !q || q.done || !dmEnd(q) || !q.inp.length) return;
  q.inp.pop(); q.inpM.pop(); dmFlash = null; dmRender();
}
// stand 'eind': alles nakijken (late = tijd op: wat ontbreekt is fout)
function dmCheck(late){
  const q = dmQ; if (dmIntro || !q || q.done || !dmEnd(q)) return;
  const n = q.notes.length;
  if (!late && q.inp.length < n){ $('dmMsg').innerHTML = `<b>Nog ${n - q.inp.length} ${n - q.inp.length === 1 ? 'noot' : 'noten'}</b> in te vullen voordat je kunt controleren.`; return; }
  q.late = !!late;
  q.notes.forEach((x, i) => { const a = q.inp[i]; q.res[i] = { ok:a === x.semi, a:a == null ? 'tijd op' : drDegLabel(a) }; });
  Score.log(dmMod(), q.notes.map((x, i) => ({ k:x.semi, q:drRootName(drS.pc) + ': ' + dmLabel(q) + ' (noot ' + (i + 1) + ')', a:q.res[i].a, ok:q.res[i].ok })));
  dmFinish(1100);
}
function dmTimeUp(){
  const q = dmQ; if (!q || q.done) return;
  if (dmEnd(q)) { dmCheck(true); return; }
  for (let i = q.pos; i < q.notes.length; i++){
    if (!q.res[i]) q.res[i] = { ok:false, a:'tijd op' };
    q.res[i].late = true; dmLog(i);
  }
  q.pos = q.notes.length; q.late = true; dmFinish(900);
}
function dmLog(i){
  const q = dmQ, n = q.notes[i], r = q.res[i];
  Score.log(dmMod(), [{ k:n.semi, q:drRootName(drS.pc) + ': ' + dmLabel(q) + ' (noot ' + (i + 1) + ')', a:r.ok ? drDegLabel(n.semi) : r.a, ok:!!r.ok }]);
}
function dmFlashOff(){ const f = dmFlash; dmTimers.push(setTimeout(() => { if (dmFlash === f){ dmFlash = null; if (dmActive()) dmCircle(); } }, 900)); }
function dmFinish(wait){
  const q = dmQ; q.done = true; if (q.tmo) clearTimeout(q.tmo);
  const good = q.res.filter(r => r && r.ok).length, perfect = good === q.notes.length;
  dmStreak = perfect ? dmStreak + 1 : 0;
  dmRender(); dmStats();
  // nog eens horen terwijl de bollen meelichten; daarna eventueel automatisch door
  dmTimers.push(setTimeout(() => {
    if (!dmActive() || dmQ !== q) return;
    dmFlash = null; const end = dmPlay(true);
    if (dmS.auto && perfect) dmTimers.push(setTimeout(() => { if (dmActive() && dmQ === q) dmNew(); }, Math.max(0, (end - Engine.now()) * 1000) + 1300));
  }, wait || 700));
}

/* --- tekenen --- */
function dmCircle(){
  if (!$('drCircle')) return;
  const set = new Set(dmLevel().set), q = dmQ, f = dmFlash, C = Cirkel.C;
  const good = q ? q.res.filter(r => r && r.ok).length : 0, n = q ? q.notes.length : 0;
  const big = (a, b) => `<text x="${C}" y="${C - 9}" class="kcans" style="fill:var(--bg)">${a}</text><text x="${C}" y="${C + 22}" class="kcansl">${b}</text>`;
  const mid = dmIntro ? big(drRootName(drS.pc), dmIntroNew ? 'nieuwe toonsoort' : 'wennen aan do')
    : !q ? Cirkel.icon('play')
    : q.done ? big(`${good}/${n}`, (q.late ? 'tijd op · ' : good === n ? 'foutloos! · ' : '') + 'volgende ▶')
    : dmEnd(q) ? big(`${q.inp.length}/${n}`, q.inp.length === n ? 'controleer ✓' : 'nog eens ▶')
    : big(`${q.pos + 1}/${n}`, 'nog eens ▶');
  const clock = dmIntro ? { dur:dmS.intro, el:(performance.now() - dmIntroT) / 1000, warm:true }
    : q && !q.done && q.start ? { dur:q.dur, el:(performance.now() - q.start) / 1000 } : null;
  Cirkel.draw($('drCircle'), {
    id:'dmc', label:'Kwintencirkel: speel de melodie na', color:drColor, degree:drDegLabel, name:drNameAt,
    dot:semi => { const on = set.has(semi), lit = dmHi === semi || (f && f.ok && f.semi === semi), bad = f && !f.ok && f.semi === semi;
      return { fill:on, click:on && !dmIntro, pulse:lit, mark:bad ? 'wrong' : null }; },
    onDot:semi => dmAnswer(semi),
    center:{ html:mid, clock, onClick:() => { if (q && !q.done && dmEnd(q) && q.inp.length === n) dmCheck(); else dmMidClick(); },
      title:dmIntro ? 'Even wennen aan de drone' : !q ? 'Start (' + Keys.label('luister') + ')' : q.done ? 'Nieuwe melodie (' + Keys.label('volgende') + ')'
        : dmEnd(q) && q.inp.length === n ? 'Controleren (' + Keys.label('controleer') + ')' : 'Melodie nog eens (' + Keys.label('luister') + ')' }
  });
}
function dmSlot(q, x, i){
  const r = q.res[i];
  if (q.done){
    const tip = r.ok ? 'goed' : r.a === 'tijd op' ? 'tijd op' : (dmEnd(q) ? 'jij: ' : 'eerst ') + r.a;
    return `<span class="dmslot ${r.ok ? 'ok' : 'miss'}" style="--c:${drColor(x.semi)}" title="${drNameAt(x.semi)} · ${tip}"><b>${drDegLabel(x.semi)}</b><small>${r.ok ? DT_FEEL[x.semi][0] : r.a === 'tijd op' ? 'tijd op' : (dmEnd(q) ? 'niet ' : '') + r.a}</small></span>`;
  }
  if (dmEnd(q)){                                                    // ingevuld = jouw keuze in haar eigen kleur (zegt nog niets over goed/fout)
    const a = q.inp[i];
    if (a != null) return `<span class="dmslot in" style="--c:${drColor(a)}"><b>${drDegLabel(a)}</b><small>${DT_FEEL[a][0]}</small></span>`;
    return `<span class="dmslot${i === q.inp.length ? ' cur' : ''}">${i === q.inp.length ? '?' : '·'}</span>`;
  }
  if (i < q.pos) return `<span class="dmslot ${r && r.ok ? 'ok' : 'miss'}" style="--c:${drColor(x.semi)}" title="${drNameAt(x.semi)} · ${r && r.ok ? 'in één keer goed' : 'eerst ' + (r && r.a) + ' gekozen'}"><b>${drDegLabel(x.semi)}</b><small>${DT_FEEL[x.semi][0]}</small></span>`;
  return `<span class="dmslot${i === q.pos ? ' cur' + (q.wrongAt === i ? ' shake' : '') : ''}">${i === q.pos ? '?' : '·'}</span>`;
}
function dmRender(){
  if (!$('dmMsg')) return;
  const q = dmQ, end = dmEnd(q) || (!q && dmS.check === 'eind');
  const lim = dmS.timed ? ` <span class="muted">(${dmS.limit} s per noot)</span>` : '';
  if (dmIntro){
    $('dmMsg').innerHTML = `<b>${dmIntroNew ? 'Nieuwe toonsoort' : 'Toonsoort'}: ${drRootName(drS.pc)}</b>. Luister even naar de drone en zing do zachtjes mee…`;
    $('dmSlots').innerHTML = '';
  } else if (!q){
    $('dmMsg').innerHTML = `Tik op het midden van de cirkel (of ${Keys.label('luister')}) voor de eerste melodie.` + (end ? ' <span class="muted">Je vult eerst alles in en kijkt het daarna na.</span>' : '');
    $('dmSlots').innerHTML = '';
  } else {
    const n = q.notes.length, good = q.res.filter(r => r && r.ok).length, last = q.res[q.pos - 1];
    $('dmMsg').innerHTML = q.done
      ? (q.late ? '<b class="dtno">Tijd op.</b> ' : '') + (good === n ? '<b class="dtok">Foutloos!</b> ' : `<b>Klaar:</b> ${good} van ${n} noten ${dmEnd(q) ? '' : 'in één keer '}goed. `) + `<span class="muted">${dmLabel(q)} in ${drRootName(drS.pc)}. Luister hoe hij terugkomt; tik een trap aan om hem te horen.</span>`
      : dmEnd(q) ? (q.inp.length === n ? `<b>Alles ingevuld.</b> Controleer met ${Keys.label('controleer')} of de knop, of verbeter eerst met ${Keys.label('wis')}.`
          : `Vul de melodie in: noot ${q.inp.length + 1} van ${n}. <span class="muted">${Keys.label('wis')} = laatste weg, ${Keys.label('luister')} = nog eens.</span>` + lim)
      : q.tries ? `<b class="dtno">Niet die.</b> Zing de ${q.pos + 1}e noot nog eens in je hoofd en probeer opnieuw` + (dmS.tries - q.tries > 1 ? '.' : ' (daarna laat ik hem zien).')
      : last && last.shown ? `<b class="dtno">De ${q.pos}e noot was ${drDegLabel(q.notes[q.pos - 1].semi)}</b> (${DT_FEEL[q.notes[q.pos - 1].semi][0]}). Ga door met noot ${q.pos + 1}.`
      : q.pos ? `<b class="dtok">Goed.</b> Noot ${q.pos + 1} van ${n}.`
      : `Speel de melodie na: tik de trappen in volgorde aan. <span class="muted">Zing mee; ${Keys.label('luister')} = nog eens.</span>` + lim;
    $('dmSlots').innerHTML = q.notes.map((x, i) => dmSlot(q, x, i)).join('');
  }
  $('dmToday').textContent = Score.today(dmMod());
  $('dmStreak').textContent = dmStreak;
  const busy = !!(q && end && !q.done);                              // knoppen alleen tonen als ze nu iets doen
  $('dmShowBtn').style.display = q && q.done ? '' : 'none';
  $('dmWis').style.display = $('dmCheck').style.display = busy ? '' : 'none';
  $('dmWis').disabled = !(busy && q.inp.length);
  $('dmCheck').disabled = !(busy && q.inp.length === q.notes.length);
  if (drS.sub === 'melo') dmCircle();
}
function dmStats(){
  if (!$('dmStats')) return;
  const mod = dmMod(dmS.check), t = Score.tally(mod), rows = Object.keys(t).map(k => ({ k:+k, r:t[k].r, n:t[k].t, p:t[k].r / t[k].t })).sort((a, b) => a.p - b.p || b.n - a.n);
  const tot = rows.reduce((a, x) => a + x.r, 0), all = rows.reduce((a, x) => a + x.n, 0);
  $('dmStatMode').textContent = dmS.check === 'eind' ? 'nakijken aan het eind' : 'per noot nakijken';
  $('dmStatSum').innerHTML = !rows.length ? '<span class="muted">nog geen melodieën</span>'
    : `<span class="muted">${Math.round(tot / all * 100)}% van de noten goed · zwakst:</span> ` + rows.slice(0, 3).map(x =>
      `<span class="dtchip" style="--c:${drColor(x.k)}"><b>${drDegLabel(x.k)}</b> ${Math.round(x.p * 100)}%</span>`).join('');
  $('dmStats').innerHTML = rows.length ? rows.map(x => `<div class="stat"><div class="row"><span><b style="color:${drColor(x.k)}">●</b> ${drDegLabel(x.k)} · ${DT_FEEL[x.k][0]}</span><span>${x.r}/${x.n} · ${Math.round(x.p * 100)}%</span></div><div class="barbg"><div class="barfg" style="width:${x.p * 100}%"></div></div></div>`).join('')
    : '<p class="note">Nog geen melodieën in deze stand. Per trap zie je hier hoe vaak je hem in een melodie goed hebt.</p>';
}

/* --- toetsen (aangeroepen door de keydown-handler in drone.js; true = afgehandeld) --- */
function dmKey(e){
  const act = a => Keys.is(e, a), q = dmQ;
  const dig = /^Digit([1-7])$/.exec(e.code) || /^Numpad([1-7])$/.exec(e.code);
  if (dmIntro && (act('luister') || act('volgende') || act('controleer') || act('wis') || dig || e.code === 'KeyT')){ e.preventDefault(); return true; }
  if (dmEnd(q) && !q.done){
    if (act('controleer')){ e.preventDefault(); dmCheck(); return true; }      // Enter = controleren (pas daarna 'volgende')
    if (act('wis')){ e.preventDefault(); dmWis(); return true; }
  }
  if (act('luister')){ e.preventDefault(); if (!e.repeat) dmListen(); return true; }
  if (act('volgende')){ e.preventDefault(); dmNew(); return true; }
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const s = e.code === 'KeyT' ? 6 : dig ? (e.shiftKey ? DT_LOW[+dig[1]] : DT_DIGIT[+dig[1]]) : undefined;
  if (s !== undefined){
    e.preventDefault();
    if (s != null && dmLevel().set.includes(s)) dmAnswer(s);
    return true;
  }
  return act('vorige') || act('begin') || act('metronoom') || act('wis');   // in Melodieën verder niets doen
}

/* --- stand / toonsoort --- */
function dmStop(){ dmClear(); dmQ = null; dmIntro = false; dmIntroNew = false; dmWarm = false; dmInKey = 0; }   // stand/view verlaten
function dmReset(){ dmClear(); dmQ = null; if (dmIntro){ dmIntro = false; dmWarm = false; } }                     // instelling gewijzigd
function dmOnRoot(){ dmStop(); if (drS.sub === 'melo') dmRender(); }

function dmIntMsg(){
  const [lo, hi] = dmRange(), name = id => DM_INTS[dmInt(id)][1];
  $('dmIntMsg').innerHTML = (dmS.minI === dmS.maxI ? `Elke sprong is een ${name(dmS.minI)}` : `Sprongen van ${name(dmS.minI)} tot ${name(dmS.maxI)}`) + ` (${lo}–${hi} halve tonen).`
    + (dmS.minI === 'oct' ? ' <b>Let op:</b> een octaaf is steeds dezelfde trap, dus de hele melodie wordt één trap.' : dmFits() ? '' : ' <b>Bij dit niveau bestaan niet al deze sprongen</b>: dan neemt de app de dichtstbijzijnde.');
}
// knoppen in het paneel gelijkzetten met dmS (ook na het laden van een preset uit 📚 Mijn oefeningen)
function dmSyncUI(){
  if (!DM_TEMPI.includes(+dmS.bpm)) dmS.bpm = 72;
  $('dmLevel').value = dmS.level; $('dmLen').value = dmS.len; $('dmMinI').value = dmS.minI; $('dmMaxI').value = dmS.maxI; $('dmBpm').value = dmS.bpm;
  $('dmInst').value = Engine.instId(dmS.inst); $('dmTries').value = dmS.tries; $('dmCheckMode').value = dmS.check;
  $('dmStartDo').checked = dmS.startDo; $('dmHear').checked = dmS.hear; $('dmAuto').checked = dmS.auto;
  $('dmKeyRand').checked = dmS.keyRand; $('dmTimed').checked = dmS.timed;
  $('dmKeyEvery').value = dmS.keyEvery; $('dmIntro').value = dmS.intro; $('dmLimit').value = dmS.limit;
  dmInKey = 0; dmIntMsg();
}
function dmInit(){
  if (!$('dmLevel')) return;
  $('dmLevel').innerHTML = DM_LEVELS.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
  $('dmLen').innerHTML = Array.from({ length:18 }, (_, i) => i + 3).map(n => `<option value="${n}">${n} noten</option>`).join('');
  const ints = DM_INTS.map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
  $('dmMinI').innerHTML = ints; $('dmMaxI').innerHTML = ints;
  $('dmBpm').innerHTML = DM_TEMPI.map(b => `<option value="${b}">♩ = ${b}</option>`).join('');
  $('dmInst').innerHTML = Engine.instOptions(Engine.instId(dmS.inst));
  if (!DM_TEMPI.includes(+dmS.bpm)) dmS.bpm = 72;
  $('dmLevel').value = dmS.level; $('dmLen').value = dmS.len; $('dmMinI').value = dmS.minI; $('dmMaxI').value = dmS.maxI; $('dmBpm').value = dmS.bpm;
  $('dmTries').value = dmS.tries; $('dmCheckMode').value = dmS.check;
  $('dmStartDo').checked = dmS.startDo; $('dmHear').checked = dmS.hear; $('dmAuto').checked = dmS.auto;
  $('dmKeyRand').checked = dmS.keyRand; $('dmTimed').checked = dmS.timed;
  const on = (id, fn, fresh) => $(id).addEventListener('change', e => { fn(e.target); dmSave(); if (e.target.tagName === 'SELECT') e.target.blur(); if (fresh){ dmReset(); dmRender(); } });
  const num = (id, key, lo, hi, def) => { $(id).value = dmS[key];
    on(id, el => { let v = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(v)) v = def; v = Math.min(hi, Math.max(lo, v)); dmS[key] = v; el.value = v; }); };
  on('dmLevel',   el => { dmS.level = el.value; dmIntMsg(); }, true);
  on('dmLen',     el => { dmS.len = +el.value; }, true);
  on('dmMinI',    el => { dmS.minI = el.value; if (dmInt(dmS.maxI) < dmInt(dmS.minI)){ dmS.maxI = dmS.minI; $('dmMaxI').value = dmS.maxI; } dmIntMsg(); }, true);
  on('dmMaxI',    el => { dmS.maxI = el.value; if (dmInt(dmS.minI) > dmInt(dmS.maxI)){ dmS.minI = dmS.maxI; $('dmMinI').value = dmS.minI; } dmIntMsg(); }, true);
  on('dmStartDo', el => { dmS.startDo = el.checked; }, true);
  on('dmCheckMode', el => { dmS.check = el.value; dmStats(); }, true);
  on('dmBpm',     el => { dmS.bpm = +el.value; });
  on('dmInst',    el => { dmS.inst = el.value; });
  on('dmTries',   el => { dmS.tries = +el.value; });
  on('dmHear',    el => { dmS.hear = el.checked; });
  on('dmAuto',    el => { dmS.auto = el.checked; });
  on('dmKeyRand', el => { dmS.keyRand = el.checked; dmInKey = 0; });
  on('dmTimed',   el => { dmS.timed = el.checked; }, true);
  num('dmKeyEvery', 'keyEvery', 1, 200, 10);
  num('dmIntro', 'intro', 0, 20, 3);
  num('dmLimit', 'limit', 1, 30, 3);
  $('dmNext').onclick = () => { $('dmNext').blur(); dmNew(); };
  $('dmAgain').onclick = () => { $('dmAgain').blur(); dmListen(); };
  $('dmWis').onclick = () => { $('dmWis').blur(); dmWis(); };
  $('dmCheck').onclick = () => { $('dmCheck').blur(); dmCheck(); };
  $('dmShowBtn').onclick = () => { $('dmShowBtn').blur(); if (dmQ && dmQ.done){ dmFlash = null; dmPlay(true); } };
  $('dmReset').onclick = () => { Score.clear(dmMod(dmS.check)); dmStats(); dmRender(); };
  Keys.onChange(dmRender);
  dmIntMsg(); dmRender(); dmStats();
}
dmInit();
