/* ================= 💬 Vraag aan Claude (Repertoire, prefix pv) =================
   Chatvenster in de bladmuziekspeler. Gebruikt de artifact-capability `sample` (Claude via het eigen account
   van de gebruiker, geen API-sleutel). Elke vraag krijgt de context mee: stuk, componist, instrument, tempo,
   oefenblok, passage (status, doel, aantekeningen) en de ECHTE noten van het blok uit de tijdlijn (ptSteps),
   zodat Claude de partituur niet hoeft te "lezen" van een plaatje.
   Gesprek per stuk bewaard in ptCur.chat (max PV_KEEP berichten), samen met het stuk in IndexedDB. */
const PV_KEEP = 30;          // zoveel berichten per stuk bewaren
const PV_MAXM = 24;          // max. aantal maten met noten in de context
const PV_MAXCH = 9000;       // max. tekens notenlijst
const PV_QUICK = [
  ['Hoe oefen ik dit?', 'Hoe kan ik dit oefenblok het beste oefenen? Geef een concreet plan met oefenvarianten en metronoomtempo\'s.'],
  ['Waar op letten?', 'Waar moet ik in dit oefenblok op letten? Wat zijn de lastige plekken en waarom?'],
  ['Hoe gaat het stuk?', 'Vertel kort over dit stuk: vorm, karakter, stijl en hoe het meestal gespeeld wordt.'],
  ['Wat gebeurt er muzikaal?', 'Wat gebeurt er muzikaal in dit blok (harmonie, frasering, opbouw)? Leg het duidelijk uit.']
];
let pvSample = null, pvBusy = null, pvInited = false;

const pvEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
function pvMd(t){   // heel eenvoudige opmaak: kopjes, **vet**, lijstjes, regels
  const lines = pvEsc(t).split('\n'); let out = '', list = '';
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const close = () => { if (list){ out += '</' + list + '>'; list = ''; } };
  for (const raw of lines){
    const l = raw.trimEnd();
    let m;
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))){ if (list !== 'ul'){ close(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))){ if (list !== 'ol'){ close(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; }
    else if ((m = l.match(/^#{1,4}\s+(.*)/))){ close(); out += '<p class="pvh">' + inline(m[1]) + '</p>'; }
    else if (!l.trim()){ close(); }
    else { close(); out += '<p>' + inline(l) + '</p>'; }
  }
  close(); return out;
}

/* ---------- context uit het stuk ---------- */
const PV_SH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PV_FL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PV_MAJ = { '-7':'Ces', '-6':'Ges', '-5':'Des', '-4':'As', '-3':'Es', '-2':'Bes', '-1':'F', '0':'C', '1':'G', '2':'D', '3':'A', '4':'E', '5':'B', '6':'Fis', '7':'Cis' };
const PV_MIN = { '-7':'as', '-6':'es', '-5':'bes', '-4':'f', '-3':'c', '-2':'g', '-1':'d', '0':'a', '1':'e', '2':'b', '3':'fis', '4':'cis', '5':'gis', '6':'dis', '7':'ais' };
function pvKeys(it){   // voortekening per maatnummer uit de MusicXML (alleen niet-gezipte bestanden)
  if (it._pvKeys !== undefined) return it._pvKeys;
  let res = null;
  try {
    if (typeof it.data === 'string' && /<score-partwise|<score-timewise/.test(it.data.slice(0, 4000))){
      const doc = new DOMParser().parseFromString(it.data, 'application/xml');
      const part = doc.querySelector('part'); res = [];
      if (part) for (const m of part.querySelectorAll(':scope > measure')){
        const k = m.querySelector('attributes key fifths'); if (!k) continue;
        const mode = (m.querySelector('attributes key mode') || {}).textContent || '';
        res.push({ mn:parseInt(m.getAttribute('number'), 10) || 0, f:parseInt(k.textContent, 10) || 0, mode:mode.trim() });
      }
    }
  } catch(e){ res = null; }
  Object.defineProperty(it, '_pvKeys', { value:res, writable:true, enumerable:false, configurable:true });   // niet mee opslaan
  return res;
}
function pvKeyAt(it, mn){ const ks = pvKeys(it); if (!ks || !ks.length) return null; let k = ks[0]; for (const x of ks) if (x.mn <= mn) k = x; return k; }
function pvKeyName(k){ if (!k) return ''; const f = String(Math.max(-7, Math.min(7, k.f))); return k.mode === 'minor' ? PV_MIN[f] + '-klein' : (k.mode === 'major' ? PV_MAJ[f] + '-groot' : PV_MAJ[f] + '-groot of ' + PV_MIN[f] + '-klein'); }
function pvName(m, flats){ return (flats ? PV_FL : PV_SH)[m % 12] + (Math.floor(m / 12) - 1); }
function pvDur(d){
  const T = [[1, 'heel'], [.75, 'half.'], [.5, 'half'], [.375, 'kwart.'], [.25, 'kwart'], [.1875, '8e.'], [.125, '8e'], [.09375, '16e.'], [.0625, '16e'], [.03125, '32e']];
  for (const [v, n] of T) if (Math.abs(d - v) < 1e-3) return n;
  for (const [v, n] of T) if (Math.abs(d * 1.5 - v) < 1e-3) return n + '(triool)';
  return (Math.round(d * 64) / 64) + ' heel';
}
function pvNotes(from, to){   // de noten van maat from t/m to, per maat en per balk (eerste doorloop, zonder herhalingen)
  if (typeof ptSteps === 'undefined' || !ptSteps.length) return { txt:'', cut:false };
  const key = pvKeyAt(ptCur, from), flats = key ? key.f < 0 : false;
  const per = new Map();
  let prevMn = -1;
  for (const s of ptSteps){
    if (s.mn < from || s.mn > to) continue;
    if (s.mn < prevMn) break;   // herhaling: stoppen
    prevMn = s.mn;
    if (!per.has(s.mn)) per.set(s.mn, { mi:s.mi, st:{} });
    const g = per.get(s.mn);
    const byStaff = {};
    s.notes.forEach(n => { (byStaff[n.st] = byStaff[n.st] || []).push(n); });
    for (const st of Object.keys(byStaff)){
      const ns = byStaff[st].sort((a, b) => a.m - b.m);
      const d = ns[0].d;
      const nm = ns.map(n => pvName(n.m, flats)).join(' ');
      (g.st[st] = g.st[st] || []).push((ns.length > 1 ? '[' + nm + ']' : nm) + ':' + pvDur(d));
    }
  }
  const lab = st => ptStaves > 1 ? (st === '0' ? 'boven' : (ptStaves === 2 ? 'onder' : 'balk ' + (+st + 1))) : '';
  let txt = '', n = 0, cut = false;
  for (const [mn, g] of per){
    if (n >= PV_MAXM || txt.length > PV_MAXCH){ cut = true; break; }
    const b = (typeof ptBeats !== 'undefined' && ptBeats[g.mi]) || null;
    txt += 'm. ' + mn + (b ? ' (' + b[0] + '/' + b[1] + ')' : '') + '\n';
    const sts = Object.keys(g.st).sort();
    if (!sts.length) txt += '  (rust)\n';
    for (const st of sts) txt += '  ' + (lab(st) ? lab(st) + ': ' : '') + g.st[st].join(', ') + '\n';
    n++;
  }
  return { txt, cut };
}
function pvContext(){
  const it = ptCur, s = it.s, p = typeof ptPasCur === 'function' ? ptPasCur() : null;
  const unit = (typeof PT_UNITS !== 'undefined' && PT_UNITS[s.unit]) ? PT_UNITS[s.unit].n : 'tel';
  const key = pvKeyAt(it, s.from);
  const L = [];
  L.push('Stuk: ' + (it.titel || it.naam) + (it.comp ? ' — ' + it.comp : ''));
  if (it.instr) L.push('Instrument: ' + ({ viool:'viool', piano:'piano', overig:'overig' }[it.instr] || it.instr));
  L.push('Maten in het stuk: ' + ptMinM() + '–' + ptMaxM() + (ptStaves > 1 ? ', ' + ptStaves + ' balken' : ''));
  if (key) L.push('Toonsoort (voortekening bij maat ' + s.from + '): ' + pvKeyName(key) + ' (' + (key.f > 0 ? key.f + '♯' : key.f < 0 ? (-key.f) + '♭' : 'geen voortekens') + ')');
  L.push('Oefenblok nu: maat ' + s.from + ' t/m ' + s.to + ' · tempo ' + s.bpm + ' per ' + unit);
  if (p){
    L.push('Passage: "' + p.naam + '" · status ' + ({ nieuw:'nieuw', bezig:'bezig', zit:'zit erin' }[p.status] || p.status)
      + (p.ok ? ' · schoon tempo ' + p.ok : '') + (p.doel ? ' · doeltempo ' + p.doel : ''));
    if (p.notes && p.notes.trim()) L.push('Mijn aantekeningen bij deze passage: ' + p.notes.trim().slice(0, 800));
  }
  const nt = pvNotes(s.from, s.to);
  if (nt.txt){
    L.push('', 'Noten van het oefenblok (uit het MusicXML-bestand; klinkende toonhoogte, octaaf C4 = middelste C; [..] = samenklank; duur per aanslag' + (nt.cut ? '; ingekort tot de eerste ' + PV_MAXM + ' maten' : '') + '):');
    L.push(nt.txt.trimEnd());
  }
  return L.join('\n');
}
const PV_INSTR = `Je bent een ervaren, eerlijke muziekdocent (viool en piano, klassiek) die helpt met oefenen. Ik heb geen vaste docent; mijn oefentijd is beperkt (vaak 20 minuten), dus geef korte, concrete adviezen.
Regels:
- Antwoord in het Nederlands, kort en praktisch (liefst onder de 250 woorden, tenzij ik om meer vraag). Gebruik korte lijstjes.
- Oefenadvies concreet: oefenvarianten (ritmes lang-kort/kort-lang, langzaam met metronoom, in stukjes, van achteren opbouwen, losse handen, met bordun/drone voor intonatie, streek- of vingerzettingsideeën) met metronoomtempo's en een tussendoel.
- Verwijs naar maatnummers. Baseer uitspraken over noten ALLEEN op de notenlijst hieronder; staat iets er niet in (dynamiek, articulatie, vingerzetting, streken), zeg dan dat je dat niet kunt zien.
- Over het stuk in het algemeen mag je je kennis gebruiken, maar zeg het eerlijk als je twijfelt; verzin geen details.
- Uitleg van muziektheorie mag, maar duidelijk en zonder vakjargon zonder uitleg.`;

/* ---------- gesprek ---------- */
const pvChat = () => (ptCur.chat = ptCur.chat || []);
function pvRender(){
  const box = $('pvMsgs'); if (!box || !ptCur) return;
  const ch = pvChat();
  if (!ch.length){
    box.innerHTML = '<div class="pvempty"><p>Stel een vraag over dit stuk of over je oefenblok. Claude krijgt de noten van het blok (maat ' + ptCur.s.from + '–' + ptCur.s.to + ') mee, plus je tempo, passage en aantekeningen.</p><p class="muted">Tip: kies eerst het oefenblok of een passage, dan weet Claude precies over welke maten je het hebt.</p></div>';
  } else {
    box.innerHTML = ch.map((m, i) => '<div class="pvm ' + (m.role === 'user' ? 'pvu' : 'pva') + '">'
      + (m.role === 'user' ? (m.blk ? '<small>m. ' + pvEsc(m.blk) + '</small>' : '') + pvEsc(m.text).replace(/\n/g, '<br>') : pvMd(m.text))
      + '</div>').join('');
  }
  box.scrollTop = box.scrollHeight;
  pvScope();
}
function pvScope(){
  const el = $('pvScope'); if (!el || !ptCur) return;
  const p = typeof ptPasCur === 'function' ? ptPasCur() : null;
  el.textContent = 'Over: maat ' + ptCur.s.from + '–' + ptCur.s.to + (p && ptPasSame(p) ? ' · ' + p.naam : '');
}
async function pvSend(q){
  q = (q || '').trim();
  if (!q || pvBusy || !ptCur || !pvSample) return;
  const it = ptCur, ch = pvChat();
  ch.push({ role:'user', text:q, blk:it.s.from + '–' + it.s.to });
  const ans = { role:'assistant', text:'' }; ch.push(ans);
  $('pvIn').value = ''; pvRender(); pvUI();
  const last = $('pvMsgs').lastElementChild; last.classList.add('pvwait'); last.innerHTML = '<span class="pvdots">Claude denkt na…</span>';
  // geschiedenis: oudere berichten kaal, de nieuwste vraag met instructies + actuele context
  const hist = ch.slice(0, -2).filter(m => m.text).slice(-12).map(m => ({ role:m.role, content:m.text }));
  while (hist.length && hist[0].role !== 'user') hist.shift();
  const msg = PV_INSTR + '\n\n=== Context (actueel) ===\n' + pvContext() + '\n=== Einde context ===\n\nMijn vraag: ' + q;
  const input = hist.concat([{ role:'user', content:msg }]);
  pvBusy = new AbortController();
  try {
    const r = await pvSample(input, { signal:pvBusy.signal, cache:false,
      onText:({ text }) => { ans.text = text; if (ptCur === it){ last.classList.remove('pvwait'); last.innerHTML = pvMd(text); const b = $('pvMsgs'); b.scrollTop = b.scrollHeight; } } });
    ans.text = (r && r.text) || ans.text || '(geen antwoord)';
    if (r && r.truncated) ans.text += '\n\n(Het antwoord is afgekapt.)';
  } catch(e){
    const code = e && e.code;
    if (code === 'not_granted'){ ans.text = 'Je hebt geen toestemming gegeven om Claude te gebruiken in deze app. Klik nog eens op Verstuur om het opnieuw te vragen.'; }
    else if (code === 'rate_limited'){ ans.text = (e.text || '') + '\n\n(Even te veel vragen achter elkaar. Probeer het over een minuutje opnieuw.)'; }
    else if (e && e.name === 'AbortError' || code === 'aborted'){ ans.text = (e.text || ans.text || '') + '\n\n(Gestopt.)'; }
    else ans.text = (e && e.text ? e.text + '\n\n' : '') + '(Er ging iets mis: ' + ((e && e.message) || 'onbekende fout') + ')';
  }
  pvBusy = null;
  while (ch.length > PV_KEEP) ch.shift();
  if (ptCur === it) { ptSaveCur(); pvRender(); } else { try { PtDB.put(it); } catch(e){} }
  pvUI();
}
function pvUI(){
  const b = $('pvSend'); if (!b) return;
  b.textContent = pvBusy ? '■ Stop' : 'Verstuur';
  b.classList.toggle('primary', !pvBusy);
  $('pvClear').disabled = !!pvBusy || !(ptCur && (ptCur.chat || []).length);
}
function pvOpen(on){
  const v = $('ptView'); if (!v) return;
  if (on === undefined) on = !v.classList.contains('pvopen');
  if (on && v.classList.contains('pnlopen')) { try { Paneel.set('ptView', false); } catch(e){ v.classList.remove('pnlopen'); } }
  if (on && v.classList.contains('poopen') && typeof poOpen === 'function') poOpen(false);
  v.classList.toggle('pvopen', on);
  $('pvBtn').classList.toggle('on', on);
  if (on){ pvRender(); pvUI(); setTimeout(() => { const i = $('pvIn'); if (i && window.innerWidth > 700) i.focus(); }, 60); }
}

// sneltoets (standaard C, aan te passen in ⚙️ Sneltoetsen): chatvenster open/dicht, en meteen typen
document.addEventListener('keydown', e => {
  if (typeof view === 'undefined' || view !== 'partituren' || typeof ptCur === 'undefined' || !ptCur) return;
  if (typeof Keys === 'undefined' || Keys.blocked(e) || Keys.typing() || !Keys.is(e, 'claude')) return;
  const b = $('pvBtn'); if (!b || b.hidden) return;   // Claude niet beschikbaar in deze weergave
  e.preventDefault();
  if (typeof ptFsOn !== 'undefined' && ptFsOn && typeof ptFsExit === 'function') ptFsExit();
  const open = !$('ptView').classList.contains('pvopen');
  pvOpen(open);
  if (open) setTimeout(() => { const i = $('pvIn'); if (i) i.focus(); }, 80);
});

function pvInit(){
  if (pvInited) return; pvInited = true;
  const v = $('ptView'); if (!v) return;
  // knop in de bovenbalk
  const right = v.querySelector('.ptctrl .ptright');
  const btn = document.createElement('button');
  btn.id = 'pvBtn'; btn.className = 'ptsmall pvbtn ptic'; btn.hidden = true; btn.textContent = '💬';
  btn.dataset.ktitle = 'Stel Claude een vraag over dit stuk of je oefenblok ({claude})';
  try { btn.title = 'Stel Claude een vraag over dit stuk of je oefenblok (' + Keys.label('claude') + ')'; } catch(e){ btn.title = 'Stel Claude een vraag over dit stuk of je oefenblok'; }
  right.insertBefore(btn, right.firstChild);
  btn.onclick = () => pvOpen();
  // venster
  const box = document.createElement('aside');
  box.id = 'pvBox'; box.className = 'pvbox';
  box.innerHTML = '<div class="pvhead"><b>💬 Vraag aan Claude</b><span id="pvScope" class="pvscope"></span><button id="pvClear" class="ptsmall" title="Gesprek bij dit stuk wissen">Nieuw gesprek</button><button id="pvClose" class="pvx" title="Sluiten (Esc)">✕</button></div>'
    + '<div id="pvMsgs" class="pvmsgs"></div>'
    + '<div class="pvquick">' + PV_QUICK.map((q, i) => '<button class="ptsmall" data-q="' + i + '">' + pvEsc(q[0]) + '</button>').join('') + '</div>'
    + '<div class="pvform"><textarea id="pvIn" rows="2" placeholder="Bv. hoe oefen ik de snaarwissels in maat 12–14?"></textarea><button id="pvSend" class="ptsmall primary">Verstuur</button></div>'
    + '<p class="pvfoot muted">Claude ziet de noten uit je MusicXML, maar geen vingerzettingen, streken of dynamiek. Controleer adviezen over noten zelf in de partituur.</p>';
  v.appendChild(box);
  $('pvClose').onclick = () => pvOpen(false);
  $('pvSend').onclick = () => { if (pvBusy) pvBusy.abort(); else pvSend($('pvIn').value); };
  let armT = 0;
  $('pvClear').onclick = () => {
    const b = $('pvClear');
    if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Nieuw gesprek'; }, 4000); return; }
    clearTimeout(armT); b.classList.remove('arm'); b.textContent = 'Nieuw gesprek';
    if (ptCur){ ptCur.chat = []; ptSaveCur(); } pvRender(); pvUI();
  };
  box.querySelector('.pvquick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) pvSend(PV_QUICK[+b.dataset.q][1]); });
  const inp = $('pvIn');
  inp.addEventListener('keydown', e => {
    e.stopPropagation();   // geen sneltoetsen van de speler tijdens het typen
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); pvSend(inp.value); }
    else if (e.key === 'Escape'){ e.preventDefault(); pvOpen(false); }
  });
  box.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target !== inp){ e.stopPropagation(); pvOpen(false); } });
  // Esc buiten het tekstveld sluit ook het venster (vóór de speler, die Esc = stop doet)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && v.classList.contains('pvopen') && typeof view !== 'undefined' && view === 'partituren' && !(typeof ptFsOn !== 'undefined' && ptFsOn)){ pvOpen(false); }
  }, true);
  // context bijwerken als het blok verandert
  ['ptFrom', 'ptTo'].forEach(id => { const el = $(id); if (el) el.addEventListener('change', () => setTimeout(pvScope, 0)); });
  new MutationObserver(() => { if (v.classList.contains('pvopen')) pvScope(); }).observe($('ptFrom'), { attributes:true, attributeFilter:['value'] });
  // ander stuk / terug naar de lijst: venster dicht, gesprek opnieuw tekenen
  let lastCur = null;
  setInterval(() => {
    if (typeof ptCur === 'undefined') return;
    if (ptCur !== lastCur){ lastCur = ptCur; if (!ptCur) pvOpen(false); else if (v.classList.contains('pvopen')) { pvRender(); pvUI(); } }
    else if (ptCur && v.classList.contains('pvopen')) pvScope();
  }, 700);
  // 🕹️-paneel en dit venster niet tegelijk open
  try { Paneel.onToggle(() => { if (v.classList.contains('pnlopen') && v.classList.contains('pvopen')) pvOpen(false); }); } catch(e){}
  // de capability: alleen tonen als Claude bereikbaar is in deze viewer
  let tries = 0;
  (function hook(){
    if (window.claude && typeof window.claude.use === 'function'){
      window.claude.use('sample').then(s => { pvSample = s; btn.hidden = !s; }).catch(() => { btn.hidden = true; });
    } else if (tries++ < 40) setTimeout(hook, 250);
  })();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pvInit); else pvInit();
