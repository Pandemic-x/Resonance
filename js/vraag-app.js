/* ================= 💬 Vraag aan Claude, algemeen (overal in de app, prefix va) =================
   Eén chatvenster dat je vanaf elk scherm opent: knop 💬 in de kop (naast ? en ⚙️), in de tabbalk onderaan
   (Home, Statistieken, Handleiding, Instellingen) en de sneltoets 'vraagapp' (standaard Q).
   Gebruikt dezelfde capability `sample` als de stuk-chat in Repertoire (vraag.js; pvEsc/pvMd komen daarvandaan).
   Elke vraag krijgt de context mee: waar je nu bent, je statistieken (Score.summary), je Repertoire-stukken met
   passages, en een overzicht van de app (uit Nav.NAV), zodat Claude naar het juiste onderdeel kan verwijzen.
   Claude mag links maken als [Naam](#route); die worden klikbare links (alleen bestaande routes).
   Gesprek in localStorage 'vraag-app-chat' (max VA_KEEP berichten) en gaat dus mee in de back-up.
   Stuk-chat (C in Repertoire) en deze chat zijn nooit tegelijk open. */
const VA_KEY = 'vraag-app-chat';
const VA_KEEP = 40;
const VA_QUICK = [
  ['Wat oefen ik vandaag?', 'Maak een oefenplan voor vandaag van ongeveer 20 minuten, op basis van mijn statistieken, zwakke punten en stukken. Verwijs naar de onderdelen van de app.'],
  ['Hoe gaat mijn voortgang?', 'Bekijk mijn statistieken: wat gaat goed, wat blijft achter, en wat raad je aan voor de komende week?'],
  ['Uitleg over dit scherm', 'Leg kort uit wat ik oefen in het onderdeel waar ik nu ben, waarom het nuttig is en hoe ik het het beste gebruik.'],
  ['Leg een begrip uit…', null, 'Leg uit: ']
];
let vaSample = null, vaBusy = null, vaChat = [];
try { vaChat = JSON.parse(localStorage.getItem(VA_KEY)) || []; } catch(e){ vaChat = []; }
const vaSave = () => { try { localStorage.setItem(VA_KEY, JSON.stringify(vaChat.slice(-VA_KEEP))); } catch(e){} };

/* ---------- waar ben je ---------- */
const VA_PAGES = { home:'Startscherm', stats:'Statistieken', handleiding:'Handleiding', instellingen:'Instellingen' };
function vaRoutes(){
  const r = Object.assign({}, VA_PAGES);
  try { Nav.NAV.forEach(c => { r[c.id] = c.name; c.items.forEach(i => { r[i.route] = i.name + ' (' + c.name + ')'; }); }); } catch(e){}
  return r;
}
function vaWhere(){
  const v = typeof view !== 'undefined' ? view : 'home';
  return vaRoutes()[v] || v;
}
function vaHere(){   // korte tekst voor in de kop van het venster en bij je bericht
  const v = typeof view !== 'undefined' ? view : 'home';
  let s = vaWhere().replace(/ \(.*\)$/, '');
  if (v === 'partituren' && typeof ptCur !== 'undefined' && ptCur) s += ' · ' + (ptCur.titel || ptCur.naam);
  return s;
}

/* ---------- context ---------- */
function vaAppMap(){
  try {
    return Nav.NAV.map(c => '- ' + c.name + ' (#' + c.id + '): ' + c.desc + '\n' + c.items.map(i => '  - ' + i.name + ' (#' + i.route + '): ' + i.desc).join('\n')).join('\n')
      + '\n- Statistieken (#stats), Handleiding (#handleiding), Instellingen (#instellingen), Startscherm (#)';
  } catch(e){ return ''; }
}
async function vaRepertoire(){
  let list = [];
  try { if (typeof PtDB !== 'undefined') list = (await PtDB.all()) || []; } catch(e){}
  if (!list.length) return 'Nog geen stukken in Repertoire.';
  list.sort((a, b) => (b.last || b.made || '').localeCompare(a.last || a.made || ''));
  const ST = { nieuw:'nieuw', bezig:'bezig', zit:'zit erin' };
  return list.slice(0, 15).map(it => {
    const pas = (it.pas || []).slice(0, 8).map(p => p.naam + ' [' + (ST[p.status] || p.status || '?') + (p.ok ? ', schoon ' + p.ok : '') + (p.doel ? ', doel ' + p.doel : '') + ']');
    return '- ' + (it.titel || it.naam) + (it.comp ? ' — ' + it.comp : '') + (it.instr ? ' (' + it.instr + ')' : '') + (it.last ? ', laatst geopend ' + String(it.last).slice(0, 10) : '')
      + (pas.length ? '\n  passages: ' + pas.join('; ') : '');
  }).join('\n') + (list.length > 15 ? '\n(en nog ' + (list.length - 15) + ' stukken)' : '');
}
async function vaContext(){
  const L = [];
  const now = new Date();
  L.push('Datum en tijd: ' + now.toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + ', ' + now.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit' }));
  L.push('Ik ben nu in: ' + vaWhere());
  if (typeof view !== 'undefined' && view === 'partituren' && typeof ptCur !== 'undefined' && ptCur){
    L.push('Open stuk: ' + (ptCur.titel || ptCur.naam) + (ptCur.comp ? ' — ' + ptCur.comp : '') + ', oefenblok maat ' + ptCur.s.from + '–' + ptCur.s.to + ', tempo ' + ptCur.s.bpm
      + ' (voor vragen over de noten zelf is er de stuk-chat in de speler)');
  }
  try { if (typeof Score !== 'undefined' && Score.summary) L.push('', '--- Mijn statistieken ---', Score.summary()); } catch(e){}
  L.push('', '--- Mijn stukken in Repertoire ---', await vaRepertoire());
  L.push('', '--- Onderdelen van de app (met route) ---', vaAppMap());
  return L.join('\n');
}
const VA_INSTR = `Je bent een ervaren, eerlijke muziekdocent en de ingebouwde assistent van mijn oefen-app Resonance. Ik speel viool (hoofdinstrument) en piano, vooral klassiek, op de piano misschien ook wat jazz. Ik heb geen vaste docent en weinig, wisselende oefentijd (studie en basketbal): liever 20 minuten die ik echt doe dan een uur dat ik oversla. Mijn doel met gehoortraining: met relatief gehoor melodieën (en later hele stukken) op gehoor kunnen spelen. Ik wil ook beter worden in muziektheorie.
Regels:
- Antwoord in het Nederlands, kort en praktisch (liefst onder de 250 woorden, tenzij ik om meer vraag). Gebruik korte lijstjes.
- Verwijs naar onderdelen van de app als dat helpt, met een link in de vorm [Naam](#route), alleen met routes uit de lijst hieronder.
- Baseer uitspraken over mijn voortgang ALLEEN op de statistieken hieronder; staat iets er niet in, zeg dat dan. Verzin geen cijfers.
- Wees eerlijk als iets te hoog gegrepen is of een plan niet haalbaar lijkt.
- Leg muziektheorie duidelijk uit, met een voorbeeld, en zonder vakjargon zonder uitleg.`;

/* ---------- opmaak ---------- */
function vaMd(t){
  const routes = vaRoutes();
  return pvMd(t).replace(/\[([^\]\n]+)\]\(#([a-z-]*)\)/g, (m, txt, r) => (r === '' || routes[r]) ? '<a class="valink" href="#' + r + '">' + txt + '</a>' : txt);
}

/* ---------- venster ---------- */
function vaRender(){
  const box = $('vaMsgs'); if (!box) return;
  if (!vaChat.length){
    box.innerHTML = '<div class="pvempty"><p>Stel een vraag over oefenen, muziektheorie of de app. Claude ziet waar je nu bent, je statistieken (dagreeks, oefentijd, zwakste punten, niveaus) en je stukken in Repertoire.</p><p class="muted">Tip: “Wat oefen ik vandaag?” maakt een plan op basis van je eigen cijfers. Voor vragen over de noten van een stuk gebruik je de chat in de speler van Repertoire.</p></div>';
  } else {
    box.innerHTML = vaChat.map(m => '<div class="pvm ' + (m.role === 'user' ? 'pvu' : 'pva') + '">'
      + (m.role === 'user' ? (m.w ? '<small>' + pvEsc(m.w) + '</small>' : '') + pvEsc(m.text).replace(/\n/g, '<br>') : vaMd(m.text))
      + '</div>').join('');
  }
  box.scrollTop = box.scrollHeight;
  vaScope();
}
function vaScope(){ const el = $('vaScope'); if (el) el.textContent = 'Hier: ' + vaHere(); }
function vaUI(){
  const b = $('vaSend'); if (!b) return;
  b.textContent = vaBusy ? '■ Stop' : 'Verstuur';
  b.classList.toggle('primary', !vaBusy);
  $('vaClear').disabled = !!vaBusy || !vaChat.length;
}
const vaIsOpen = () => { const b = $('vaBox'); return !!(b && b.classList.contains('open')); };
function vaOpen(on){
  const box = $('vaBox'); if (!box || !vaSample) return;
  if (on === undefined) on = !vaIsOpen();
  if (on){
    const pt = $('ptView');
    if (pt && pt.classList.contains('pvopen') && typeof pvOpen === 'function') pvOpen(false);
    try { Paneel.closeAll(); } catch(e){}
  }
  box.classList.toggle('open', on);
  ['vaBtn', 'vaTab'].forEach(id => { const el = $(id); if (el) el.classList.toggle('on', on); });
  if (on){ vaRender(); vaUI(); setTimeout(() => { const i = $('vaIn'); if (i && window.innerWidth > 700) i.focus(); }, 60); }
}
async function vaSend(q){
  q = (q || '').trim();
  if (!q || vaBusy || !vaSample) return;
  vaChat.push({ role:'user', text:q, w:vaHere() });
  const ans = { role:'assistant', text:'' }; vaChat.push(ans);
  $('vaIn').value = ''; vaRender(); vaUI();
  const last = $('vaMsgs').lastElementChild; last.classList.add('pvwait'); last.innerHTML = '<span class="pvdots">Claude denkt na…</span>';
  vaBusy = new AbortController();
  try {
    const hist = vaChat.slice(0, -2).filter(m => m.text).slice(-12).map(m => ({ role:m.role, content:m.text }));
    while (hist.length && hist[0].role !== 'user') hist.shift();
    const msg = VA_INSTR + '\n\n=== Context (actueel) ===\n' + (await vaContext()) + '\n=== Einde context ===\n\nMijn vraag: ' + q;
    const r = await vaSample(hist.concat([{ role:'user', content:msg }]), { signal:vaBusy.signal, cache:false,
      onText:({ text }) => { ans.text = text; last.classList.remove('pvwait'); last.innerHTML = vaMd(text); const b = $('vaMsgs'); b.scrollTop = b.scrollHeight; } });
    ans.text = (r && r.text) || ans.text || '(geen antwoord)';
    if (r && r.truncated) ans.text += '\n\n(Het antwoord is afgekapt.)';
  } catch(e){
    const code = e && e.code;
    if (code === 'not_granted') ans.text = 'Je hebt geen toestemming gegeven om Claude te gebruiken in deze app. Klik nog eens op Verstuur om het opnieuw te vragen.';
    else if (code === 'rate_limited') ans.text = (e.text || '') + '\n\n(Even te veel vragen achter elkaar. Probeer het over een minuutje opnieuw.)';
    else if ((e && e.name === 'AbortError') || code === 'aborted') ans.text = (e.text || ans.text || '') + '\n\n(Gestopt.)';
    else ans.text = (e && e.text ? e.text + '\n\n' : '') + '(Er ging iets mis: ' + ((e && e.message) || 'onbekende fout') + ')';
  }
  vaBusy = null;
  while (vaChat.length > VA_KEEP) vaChat.shift();
  vaSave(); vaRender(); vaUI();
}

function vaInit(){
  // knop in de kop (naast ? en ⚙️)
  const bar = document.querySelector('header .bar');
  const btn = document.createElement('button');
  btn.id = 'vaBtn'; btn.className = 'vabtn'; btn.hidden = true; btn.textContent = '💬';
  btn.dataset.ktitle = 'Vraag aan Claude ({vraagapp})';
  btn.onclick = () => vaOpen();
  if (bar) bar.insertBefore(btn, bar.querySelector('.helpbtn'));
  // knop in de tabbalk onderaan
  const tb = $('tabbar');
  const tab = document.createElement('a');
  tab.id = 'vaTab'; tab.href = '#'; tab.hidden = true; tab.dataset.t = 'claude';
  tab.innerHTML = '<span class="tbi">💬</span><span>Claude</span>';
  tab.onclick = e => { e.preventDefault(); vaOpen(); };
  if (tb) tb.appendChild(tab);
  try { Keys.apply(bar || document); } catch(e){}
  // venster
  const box = document.createElement('aside');
  box.id = 'vaBox'; box.className = 'pvbox vabox';
  box.innerHTML = '<div class="pvhead"><b>💬 Vraag aan Claude</b><span id="vaScope" class="pvscope"></span><button id="vaClear" class="ptsmall" title="Gesprek wissen">Nieuw gesprek</button><button id="vaClose" class="pvx" title="Sluiten (Esc)">✕</button></div>'
    + '<div id="vaMsgs" class="pvmsgs"></div>'
    + '<div class="pvquick">' + VA_QUICK.map((q, i) => '<button class="ptsmall" data-q="' + i + '">' + pvEsc(q[0]) + '</button>').join('') + '</div>'
    + '<div class="pvform"><textarea id="vaIn" rows="2" placeholder="Bv. wat is het verschil tussen dorisch en mineur?"></textarea><button id="vaSend" class="ptsmall primary">Verstuur</button></div>'
    + '<p class="pvfoot muted">Claude ziet je statistieken en stukken in deze browser, maar hoort je niet spelen. Controleer adviezen zelf.</p>';
  document.body.appendChild(box);
  $('vaClose').onclick = () => vaOpen(false);
  $('vaSend').onclick = () => { if (vaBusy) vaBusy.abort(); else vaSend($('vaIn').value); };
  let armT = 0;
  $('vaClear').onclick = () => {
    const b = $('vaClear');
    if (!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent = 'Zeker?'; clearTimeout(armT); armT = setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Nieuw gesprek'; }, 4000); return; }
    clearTimeout(armT); b.classList.remove('arm'); b.textContent = 'Nieuw gesprek';
    vaChat = []; vaSave(); vaRender(); vaUI();
  };
  box.querySelector('.pvquick').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const q = VA_QUICK[+b.dataset.q];
    if (q[1]) vaSend(q[1]);
    else { const i = $('vaIn'); i.value = q[2]; i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  const inp = $('vaIn');
  inp.addEventListener('keydown', e => {
    e.stopPropagation();   // geen sneltoetsen van de oefeningen tijdens het typen
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); vaSend(inp.value); }
    else if (e.key === 'Escape'){ e.preventDefault(); vaOpen(false); }
  });
  box.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target !== inp){ e.stopPropagation(); vaOpen(false); } });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && vaIsOpen()) vaOpen(false); }, true);
  // sneltoets (standaard Q, aan te passen in ⚙️ Sneltoetsen)
  document.addEventListener('keydown', e => {
    if (typeof Keys === 'undefined' || Keys.blocked(e) || Keys.typing() || !Keys.is(e, 'vraagapp') || !vaSample) return;
    e.preventDefault();
    const open = !vaIsOpen();
    vaOpen(open);
    if (open) setTimeout(() => { const i = $('vaIn'); if (i) i.focus(); }, 80);
  });
  // naar een ander scherm: venster blijft open, “Hier:” bijwerken; tabbalk-knop houdt zijn markering
  window.addEventListener('hashchange', () => setTimeout(() => { vaScope(); const t = $('vaTab'); if (t) t.classList.toggle('on', vaIsOpen()); }, 0));
  // stuk-chat gaat open → deze dicht
  const pt = $('ptView');
  if (pt) new MutationObserver(() => { if (pt.classList.contains('pvopen') && vaIsOpen()) vaOpen(false); }).observe(pt, { attributes:true, attributeFilter:['class'] });
  // capability: knoppen alleen tonen als Claude bereikbaar is in deze viewer
  let tries = 0;
  (function hook(){
    if (window.claude && typeof window.claude.use === 'function'){
      window.claude.use('sample').then(s => { vaSample = s; btn.hidden = tab.hidden = !s; }).catch(() => {});
    } else if (tries++ < 40) setTimeout(hook, 250);
  })();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vaInit); else vaInit();
