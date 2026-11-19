/* ================= 📚 Mijn oefeningen (gedeelde preset-bibliotheek, `Presets`) =================
   Eén onderdeel voor de hele app (zoals Paneel): per oefening een eigen lijst met opgeslagen instellingen.
   De balk staat bovenaan het 🕹️-paneel: keuzelijst (kiezen = alles laden) · Opslaan als… · Bijwerken · ✕ (tweestaps).
   Alleen de instellingen van die oefening (geen thema, volume, sneltoetsen).

   Presets.attach({id, name, view, box, cls, scores:[score-id's], get() → object, set(object), open()})
       id     = lijst-id (bv. 'intervallen', 'dronetrap', 'ritmequiz')
       box    = het aside.pnl waar de balk bovenaan komt (na de paneelkop); cls = extra class (bv. 'drtrap', 'forsub-mc')
       get()  = huidige instellingen (alleen oefening-velden, JSON-baar); set(o) = laden (in S zetten, opslaan, UI, nieuwe vraag)
       open() = (optioneel) naar de oefening zelf gaan als de view een overzicht heeft (gebruikt door het startscherm)
   Presets.active(id)       preset waarvan de instellingen nu precies kloppen (arrays van losse waarden tellen als verzameling), of null
   Presets.tag(scoreId)     'p:<presetId>.<rev>|' als er een actieve preset is, anders '' → score.js zet dit voor de niveau-sleutel
   Presets.info(scoreId, lv) → {naam, base, group, pid} voor een niveau-sleutel van een bestaande preset (zelfde rev), anders null
   Presets.go(group, pid)   naar de oefening gaan en de preset laden (klik op een kaart op het startscherm)
   Presets.migrate(id, fn)  oude presets van een lijst omzetten: fn(s) → nieuwe s (alleen opgeslagen als er iets verandert)
   Presets.refresh(id?)     keuzelijst/knoppen bijwerken (gebeurt vanzelf bij elke wijziging in de view en bij het openen van het paneel)

   Opslag 'presets' = {id: {items:[{id, naam, s, rev, made, upd}], cur}}. cur = laatst gekozen preset (ook als hij intussen
   gewijzigd is: dan staat er '(gewijzigd)' en licht Bijwerken op). Bijwerken = rev+1, zodat de score van die preset opnieuw begint.
   Gaat mee in de back-up (die kopieert de hele opslag). */

const Presets = (function(){
  const KEY = 'presets', A = {}, SM = {};   // A = adapters per lijst, SM = score-id → lijst-id
  let db = {};
  try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e){} };
  const rec = id => db[id] || (db[id] = { items:[], cur:null });
  const today = () => new Date().toLocaleDateString('sv');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const copy = o => JSON.parse(JSON.stringify(o));
  const dm = d => d ? +d.slice(8) + '-' + +d.slice(5, 7) : '';

  // vaste vorm om te vergelijken: sleutels gesorteerd, arrays van losse waarden als verzameling
  function canon(v){
    if (Array.isArray(v)){
      const a = v.map(canon);
      return '[' + (v.every(x => x === null || typeof x !== 'object') ? a.sort() : a).join(',') + ']';
    }
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  const now = id => { try { return canon(A[id].get()); } catch(e){ return null; } };

  function active(id){
    const a = A[id]; if (!a) return null;
    const r = rec(id), c = now(id); if (c == null) return null;
    const same = p => canon(p.s) === c;
    return r.items.find(p => p.id === r.cur && same(p)) || r.items.find(same) || null;
  }
  function tag(scoreId){ const id = SM[scoreId], p = id && active(id); return p ? 'p:' + p.id + '.' + (p.rev || 0) + '|' : ''; }
  function info(scoreId, lv){
    const m = /^p:([^.|]+)\.(\d+)\|(.*)$/.exec(lv || ''), id = SM[scoreId]; if (!m || !id) return null;
    const p = rec(id).items.find(x => x.id === m[1] && String(x.rev || 0) === m[2]);
    return p ? { naam:p.naam, base:m[3], group:id, pid:p.id } : null;
  }

  /* --- balk in het paneel --- */
  function build(a){
    const bar = document.createElement('div');
    bar.className = 'psbar' + (a.cls ? ' ' + a.cls : '');
    bar.innerHTML =
      `<div class="pslab">📚 Mijn oefeningen</div>
       <div class="psrow"><select class="pssel" aria-label="Opgeslagen oefening kiezen"></select>
         <button type="button" class="pssave" title="Huidige instellingen bewaren onder een naam">Opslaan als…</button>
         <button type="button" class="psupd" title="De gekozen oefening vervangen door de huidige instellingen">Bijwerken</button>
         <button type="button" class="psdel" title="Gekozen oefening verwijderen">✕</button></div>
       <div class="psname" hidden><input type="text" maxlength="40" placeholder="Naam, bv. Dalende sexten" aria-label="Naam">
         <button type="button" class="psok primary">Opslaan</button><button type="button" class="psno">Annuleer</button></div>
       <div class="psmsg"></div>`;
    const head = a.box.querySelector('.pnlhead');
    if (head) head.after(bar); else a.box.prepend(bar);
    a.bar = bar;
    const q = s => bar.querySelector(s), inp = q('.psname input');
    const msg = (t, cls) => { const m = q('.psmsg'); m.textContent = t || ''; m.className = 'psmsg' + (cls ? ' ' + cls : ''); };
    a.msg = msg;
    // tweestaps-knop (geen confirm() in de viewer)
    let armT = null;
    const disarm = () => { clearTimeout(armT); armT = null; ['.psdel', '.psok'].forEach(s => { const b = q(s); b.classList.remove('arm'); b.textContent = b.dataset.t || b.textContent; }); };
    const arm = (b, label) => { b.dataset.t = b.dataset.t || b.textContent; b.textContent = label; b.classList.add('arm'); clearTimeout(armT); armT = setTimeout(disarm, 4000); };
    const nameRow = show => { q('.psname').hidden = !show; disarm(); if (show){ inp.value = ''; setTimeout(() => inp.focus(), 0); } };

    q('.pssel').onchange = e => {
      e.stopPropagation(); e.target.blur();
      const r = rec(a.id), pid = e.target.value;
      if (!pid){ r.cur = null; save(); refresh(a.id); return; }
      load(a.id, pid);
    };
    q('.pssave').onclick = () => { q('.pssave').blur(); nameRow(q('.psname').hidden); msg(''); };
    q('.psno').onclick = () => nameRow(false);
    const ok = () => {
      const naam = inp.value.trim().replace(/\s+/g, ' ');
      if (!naam){ msg('Geef je oefening eerst een naam.', 'bad'); inp.focus(); return; }
      const r = rec(a.id), old = r.items.find(p => p.naam.toLowerCase() === naam.toLowerCase()), b = q('.psok');
      if (old && !b.classList.contains('arm')){ arm(b, 'Overschrijven?'); msg('“' + old.naam + '” bestaat al. Klik nog eens om hem te vervangen (de score begint dan opnieuw).'); return; }
      const s = copy(a.get());
      if (old){ old.s = s; old.rev = (old.rev || 0) + 1; old.upd = today(); r.cur = old.id; }
      else { const p = { id:Date.now().toString(36) + Math.random().toString(36).slice(2, 5), naam, s, rev:0, made:today(), upd:null }; r.items.push(p); r.cur = p.id; }
      save(); nameRow(false); refresh(a.id);
      msg('✓ Opgeslagen als “' + naam + '”.', 'ok');
    };
    q('.psok').onclick = ok;
    inp.addEventListener('keydown', e => {
      e.stopPropagation();                         // geen sneltoetsen van de oefening tijdens het typen
      if (e.key === 'Enter'){ e.preventDefault(); ok(); }
    });
    q('.psupd').onclick = () => {
      q('.psupd').blur();
      const r = rec(a.id), p = r.items.find(x => x.id === r.cur); if (!p) return;
      p.s = copy(a.get()); p.rev = (p.rev || 0) + 1; p.upd = today(); save(); refresh(a.id);
      msg('✓ “' + p.naam + '” bijgewerkt. De score van deze oefening begint opnieuw.', 'ok');
    };
    q('.psdel').onclick = () => {
      const b = q('.psdel'), r = rec(a.id), p = r.items.find(x => x.id === r.cur); if (!p) return;
      if (!b.classList.contains('arm')){ arm(b, 'Zeker?'); return; }
      disarm(); b.blur();
      r.items = r.items.filter(x => x !== p); r.cur = null; save(); refresh(a.id);
      msg('“' + p.naam + '” is verwijderd. Je instellingen zelf blijven zoals ze zijn.');
    };
  }

  function refresh(id){
    if (id == null){ Object.keys(A).forEach(refresh); return; }
    const a = A[id]; if (!a || !a.bar) return;
    const r = rec(id), act = active(id), sel = a.bar.querySelector('.pssel');
    const cur = r.items.find(p => p.id === r.cur) || null;
    const shown = act || cur;
    const changed = !act && !!cur;
    sel.innerHTML = (r.items.length
        ? `<option value="">${shown ? '— geen (eigen instellingen) —' : '— kies een opgeslagen oefening —'}</option>`
        : '<option value="">— nog niets opgeslagen —</option>')
      + r.items.map(p => `<option value="${p.id}">${esc(p.naam)}${p === cur && changed ? ' (gewijzigd)' : ''}</option>`).join('');
    sel.value = shown ? shown.id : '';
    sel.disabled = !r.items.length;
    sel.title = shown ? 'gemaakt ' + dm(shown.made) + (shown.upd ? ', bijgewerkt ' + dm(shown.upd) : '') : '';
    const upd = a.bar.querySelector('.psupd'), del = a.bar.querySelector('.psdel');
    upd.disabled = !changed; upd.classList.toggle('hot', changed);
    del.disabled = !shown;
    a.bar.classList.toggle('isact', !!act);
    a.bar.classList.toggle('ischg', changed);
  }

  function load(id, pid){
    const a = A[id], r = rec(id), p = r.items.find(x => x.id === pid); if (!a || !p) return;
    r.cur = p.id; save();
    try { a.set(copy(p.s)); } catch(e){ console.error(e); }
    refresh(id);
    if (a.msg) a.msg(active(id) === p ? '✓ “' + p.naam + '” geladen.' : '“' + p.naam + '” geladen, maar niet alles kon worden overgenomen. Kies Bijwerken om hem zo te bewaren.', active(id) === p ? 'ok' : 'bad');
  }

  function go(id, pid){
    const a = A[id]; if (!a) return;
    const after = () => { if (a.open) try { a.open(); } catch(e){ console.error(e); } load(id, pid); };
    if (typeof view !== 'undefined' && view === a.view){ after(); return; }
    location.hash = a.view;
    setTimeout(after, 80);                        // eerst de router (hashchange) laten lopen: die zet de view op het overzicht
  }

  function attach(o){
    if (!o || !o.id || !o.box) return;
    A[o.id] = o;
    (o.scores || []).forEach(s => { SM[s] = o.id; });
    build(o);
    const v = o.box.closest('.view');
    if (v && !v.dataset.psHook){                  // elke wijziging in de view (ook Niveau bovenaan) → keuzelijst bijwerken
      v.dataset.psHook = '1';
      const later = () => setTimeout(() => Object.values(A).forEach(x => { if (x.box.closest('.view') === v) refresh(x.id); }), 0);
      ['change', 'input', 'click'].forEach(ev => v.addEventListener(ev, e => { if (!e.target.closest('.psbar')) later(); }));
    }
    refresh(o.id);
  }

  // Esc in het naamveld = annuleren (vóór Paneel, dat met Esc het paneel sluit)
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !e.target.closest || !e.target.closest('.psname')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    e.target.closest('.psname').querySelector('.psno').click();
  }, true);
  if (typeof Paneel !== 'undefined') Paneel.onToggle((v, open) => { if (open) Object.values(A).forEach(x => { if (x.box.closest('.view') === v) refresh(x.id); }); });
  window.addEventListener('hashchange', () => setTimeout(refresh, 0));
  window.addEventListener('load', () => setTimeout(refresh, 0));

  // oude opgeslagen instellingen eenmalig omzetten naar een nieuw formaat (bv. Intervallen: halve tonen → interval-id's)
  function migrate(id, fn){
    const r = rec(id); let n = 0;
    r.items.forEach(p => { const o = fn(copy(p.s)); if (o && canon(o) !== canon(p.s)){ p.s = o; n++; } });
    if (n) save();
  }
  return { attach, active, tag, info, go, refresh, load, migrate, _db:() => db };
})();

/* ================= Aansluiten per oefening ================= */
(function(){
  const $$ = s => document.querySelector(s);
  const pick = (S, keys) => { const o = {}; keys.forEach(k => { if (S[k] !== undefined) o[k] = S[k]; }); return o; };
  const put = (S, o, keys) => { keys.forEach(k => { if (o[k] !== undefined) S[k] = o[k]; }); };
  const pnl = viewId => $$('#' + viewId + ' aside.pnl');

  // --- Relatief gehoor ---
  if (typeof gS !== 'undefined' && gS){
    const K = ['level','mode','set','key','keyEvery','len','range','hoogte','clefs','up','down','bpm','timbre','cadQ','resolve','auto'];
    Presets.attach({ id:'gehoor', name:'Relatief gehoor', view:'gehoor', box:pnl('gehoorView'), scores:['gehoor'],
      get:() => pick(gS, K),
      set:o => { put(gS, o, K); gSave(); gSyncUI(); gMatchLevel(); gSave(); gNew(false); } });
  }
  // --- Cadensen en Akkoordprogressies (16-11-2026) ---
  if (typeof cdS !== 'undefined' && cdS){
    const K = ['level','types','modes','key','keyEvery','bpm','inst','sev','auto'];
    Presets.attach({ id:'cadensen', name:'Cadensen', view:'cadensen', box:pnl('cdView'), scores:['cadensen'],
      get:() => pick(cdS, K),
      set:o => { put(cdS, o, K); cdQ.pc = null; cdSave(); cdSyncUI(); cdNew(false); } });
  }
  if (typeof prS !== 'undefined' && prS){
    const K = ['level','mode','src','poolMaj','poolMin','len','endI','first','cadQ','key','keyEvery','bpm','inst','auto'];
    Presets.attach({ id:'progressies', name:'Akkoordprogressies', view:'progressies', box:pnl('prView'), scores:['progressies'],
      get:() => pick(prS, K),
      set:o => { put(prS, o, K); prQ.pc = null; prSave(); prSyncUI(); prNew(false); } });
  }
  if (typeof blS !== 'undefined' && blS){
    const K = ['level','mode','poolMaj','poolMin','inv','len','endI','first','cadQ','loud','key','keyEvery','bpm','inst','auto'];
    Presets.attach({ id:'baslijn', name:'Baslijn', view:'baslijn', box:pnl('blView'), scores:['baslijn'],
      get:() => pick(blS, K),
      set:o => { put(blS, o, K); blQ.pc = null; blSave(); blSyncUI(); blNew(false); } });
  }
  if (typeof tmS !== 'undefined' && tmS){
    const K = ['cats','dir','auto'];
    Presets.attach({ id:'termen', name:'Termen', view:'termen', box:pnl('tmView'), scores:['termen'],
      get:() => pick(tmS, K),
      set:o => { put(tmS, o, K); tmSave(); tmSyncUI(); tmNew(); } });
  }
  if (typeof asS !== 'undefined' && asS){
    const K = ['level','types','tonics','names','hear','auto','bass','inst'];
    Presets.attach({ id:'akkoordsymbolen', name:'Akkoordsymbolen', view:'akkoordsymbolen', box:pnl('asView'), scores:['akkoordsymbolen'],
      get:() => pick(asS, K),
      set:o => { put(asS, o, K); asSave(); asSyncUI(); asNew(); } });
  }
  // --- Ritme-trainers (16-11-2026): Rudiments, Polyritme, Tempo-ladder, Swing ---
  if (typeof rdS !== 'undefined' && rdS){
    const K = ['id','bpm','metro','sticks','lead','ci','ramp','step','every','max'];
    Presets.attach({ id:'rudiments', name:'Rudiments', view:'rudiments', box:pnl('rdView'), scores:[],
      get:() => pick(rdS, K),
      set:o => { rtStopAll(); put(rdS, o, K); rtSave(RD_KEY, rdS); rdSyncUI(); } });
  }
  if (typeof pyS !== 'undefined' && pyS){
    const K = ['r','l','bpm','muteR','muteL','pulse','grid','ci','tap'];
    Presets.attach({ id:'polyritme', name:'Polyritme', view:'polyritme', box:pnl('pyView'), scores:[],
      get:() => pick(pyS, K),
      set:o => { rtStopAll(); put(pyS, o, K); rtSave(PY_KEY, pyS); pySyncUI(); } });
  }
  if (typeof tpS !== 'undefined' && tpS){
    const K = ['mode','sub','beats','start','step','max','bars','crit','hit','after','fails','subClick'];
    Presets.attach({ id:'tempoladder', name:'Tempo-ladder', view:'tempoladder', box:pnl('tpView'), scores:[],
      get:() => pick(tpS, K),
      set:o => { rtStopAll(); put(tpS, o, K); rtSave(TP_KEY, tpS); tpSyncUI(); } });
  }
  if (typeof swS !== 'undefined' && swS){
    const K = ['mode','level','set','tmin','tmax','bars','auto','bpm','target','metroOn','guide'];
    Presets.attach({ id:'swing', name:'Swing', view:'swing', box:pnl('swView'), scores:['swing'],
      get:() => pick(swS, K),
      set:o => { rtStopAll(); put(swS, o, K); rtSave(SW_KEY, swS); swSyncUI(); swNew(false); } });
  }
  // --- Intonatie (15-11-2026) ---
  if (typeof inS !== 'undefined' && inS){
    const K = ['level','mode','ints','ref','key','keyEvery','oct','dInst','tInst','dur','wait','hold','gap','vMat','vDiff','vDrone','vNote','vib','vibD','vibR','aMd','adapt','cents','share','tol','auto'];
    Presets.attach({ id:'intonatie', name:'Intonatie', view:'intonatie', box:pnl('inView'), scores:['intonatie','intonatieh','intonatied','intonatiev','intonatiea','intonatier','intonaties'],
      get:() => pick(inS, K),
      set:o => { put(inS, o, K); inMatchLevel(); inSave(); inSyncUI(); inReset(); } });
  }
  // --- Absoluut gehoor ---
  if (typeof aS !== 'undefined' && aS){
    const K = ['level','set','insts','lo','hi','octave','auto','noise'];
    Presets.attach({ id:'absoluut', name:'Absoluut gehoor', view:'absoluut', box:pnl('absView'), scores:['absoluut'],
      get:() => pick(aS, K),
      set:o => { put(aS, o, K); aSyncUI(); aMatchLevel(); aSave(); aNew(false); } });
  }
  // --- Intervallen: twee ingangen (gehoor via #intervallen = de oude lijst 'intervallen', blad via Notenleer) ---
  if (typeof ivS !== 'undefined' && ivS){
    const K = ['level','set','dirs','start','tonics','dbl','clefs','up','down','mode','hoogte','bpm','style','timbre','auto','explore','hear','timed','limit'];
    const box = $$('#ntView .nlsub[data-sub="interval"] aside.pnl');
    // presets van de oude gehoorversie (set in halve tonen, 'names') → nieuw formaat
    Presets.migrate('intervallen', o => { if (!Array.isArray(o.set) || !o.set.some(v => typeof v === 'number') && !o.names) return o;
      const s = Object.assign(ivDefaults('gehoor'), o); ivFix(s, 'gehoor'); ivMatchLevel(s, 'gehoor'); return pick(s, K); });
    [['gehoor', 'intervallen', 'intervallen', 'psgehoor'], ['blad', 'intervallenb', 'intervallen-blad', 'psblad']].forEach(([prof, id, v, cls]) => {
      Presets.attach({ id, name:'Intervallen (' + prof + ')', view:v, box, cls, scores:[id],
        get:() => pick(ivGet(prof), K),
        set:o => { if (ivProfile !== prof) nlSub('interval', prof); put(ivS, o, K); ivFix(); ivMatchLevel(); ivSave(); ivSyncUI(); if (nlCur === 'interval') ivNew(); ivStats(); },
        open:() => {} });
    });
  }
  // --- Melodisch dictee ---
  if (typeof mS !== 'undefined' && mS){
    const K = ['level','mode','key','len','moves','range','hoogte','clefs','up','down','rhythm','bars','tempo','timbre','cadQ','first','hear','auto'];
    Presets.attach({ id:'dictee', name:'Melodisch dictee', view:'dictee', box:pnl('mdView'), scores:['dictee'],
      get:() => pick(mS, K),
      set:o => { put(mS, o, K); mSyncUI(); mMatchLevel(); mSave(); mNew(false); } });
  }
  // --- Notenleer → Noten benoemen ---
  if (typeof nlS !== 'undefined' && nlS){
    const K = ['level','clefs','up','down','acc','dbl','keysig','keys','input','names','style','octave','hear','auto','timbre','timed','limit'];
    Presets.attach({ id:'notenleer', name:'Noten benoemen', view:'noten', box:$$('#ntView .nlsub[data-sub="noten"] aside.pnl'), scores:['notenleer'],
      get:() => pick(nlS, K),
      set:o => { put(nlS, o, K); nlBereikFix(nlS); nlMatchLevel(); nlSave(); nlSyncUI();
        if (nlK) nlBuildKlav();
        if (nlCur === 'noten') nlNew();
        nlStats(); },
      open:() => {} });
  }
  // --- Notenleer → Toonsoorten ---
  if (typeof tsS !== 'undefined' && tsS){
    const K = ['level','ask','modes','clefs','keys','style','hear','auto','timbre','timed','limit'];
    Presets.attach({ id:'toonsoorten', name:'Toonsoorten', view:'toonsoorten', box:$$('#ntView .nlsub[data-sub="toon"] aside.pnl'), scores:['toonsoorten'],
      get:() => pick(tsS, K),
      set:o => { put(tsS, o, K); tsFix(); tsMatchLevel(); tsSave(); tsSyncUI(); if (nlCur === 'toon') tsNew(); tsStats(); },
      open:() => {} });
  }
  // --- Notenleer → Toonladders: twee ingangen (blad via Notenleer, gehoor via #toonladders), elk een eigen lijst ---
  if (typeof tlS !== 'undefined' && tlS){
    const K = ['level','types','tonics','dbl','clefs','up','down','mode','hoogte','bpm','naam','style','hear','auto','timbre','timed','limit'];
    const box = $$('#ntView .nlsub[data-sub="ladder"] aside.pnl');
    [['blad', 'toonladders', 'toonladders-blad', 'psblad'], ['gehoor', 'toonladdersg', 'toonladders', 'psgehoor']].forEach(([prof, id, v, cls]) => {
      Presets.attach({ id, name:'Toonladders (' + prof + ')', view:v, box, cls, scores:[id],
        get:() => pick(tlGet(prof), K),
        set:o => { if (tlProfile !== prof) nlSub('ladder', prof); put(tlS, o, K); tlFix(); tlMatchLevel(); tlSave(); tlSyncUI(); if (nlCur === 'ladder') tlNew(); tlStats(); },
        open:() => {} });
    });
  }
  // --- Akkoorden: twee ingangen (blad via Notenleer, gehoor via #akkoorden), elk een eigen lijst ---
  if (typeof akS !== 'undefined' && akS){
    const K = ['level','types','inv','invName','tonics','dbl','clefs','up','down','mode','hoogte','bpm','naam','style','dirs','then','hear','auto','timbre','timed','limit'];
    const box = $$('#ntView .nlsub[data-sub="akkoord"] aside.pnl');
    // oud: klank samen|gebroken|beide → richting + 'daarna ook samen' (13-11)
    ['akkoorden','akkoordeng'].forEach(id => Presets.migrate(id, o => { if (!o.klank) return o; o = Object.assign({}, o); o.dirs = o.klank === 'samen' ? ['harm'] : ['up']; o.then = o.klank === 'beide'; delete o.klank; return o; }));
    [['blad', 'akkoorden', 'akkoorden-blad', 'psblad'], ['gehoor', 'akkoordeng', 'akkoorden', 'psgehoor']].forEach(([prof, id, v, cls]) => {
      Presets.attach({ id, name:'Akkoorden (' + prof + ')', view:v, box, cls, scores:[id],
        get:() => pick(akGet(prof), K),
        set:o => { if (akProfile !== prof) nlSub('akkoord', prof); put(akS, o, K); akFix(); akMatchLevel(); akSave(); akSyncUI(); if (nlCur === 'akkoord') akNew(); akStats(); },
        open:() => {} });
    });
  }
  // presets van vóór de tempo-keuze (13-11): het tempo dat toen vast was
  [['gehoor',100],['toonladders',190],['toonladdersg',190],['akkoorden',190],['akkoordeng',190],['intervallen',75],['intervallenb',75]].forEach(([id, b]) => Presets.migrate(id, o => o.bpm == null ? Object.assign({}, o, { bpm:b }) : o));
  // presets van vóór de hulplijnen-optie (13-11) kregen nog geen up/down: standaard 2 boven en onder
  ['toonladders','toonladdersg','akkoorden','akkoordeng','intervallen','intervallenb'].forEach(id => Presets.migrate(id, o => o.up == null ? Object.assign(o, { up:2, down:2 }) : o));
  // --- Drone → Degrees en Melodieën: oefening + toonsoort (niet bij wisselende toonsoort) + droneklank en -octaaf ---
  const droneGet = keyRand => Object.assign({ droneOct:drS.oct, droneInst:drS.inst }, keyRand ? {} : { pc:drS.pc });
  const droneSet = o => {
    if (o.droneOct != null) drS.oct = +o.droneOct;
    if (o.droneInst && Engine.drone.INSTS.some(([id]) => id === o.droneInst)){
      drS.inst = o.droneInst; $('drInst').value = drS.inst;
      if ((drS.inst === 'orgel' || drS.inst === 'cello') && typeof Samples !== 'undefined') Samples.load(drS.inst);
    }
    if (o.pc != null) drSetRoot(+o.pc);           // slaat op, vult de lijsten, herstart de drone, zet Degrees/Melodieën terug
    else { drSave(); drFill(); drRefreshDrone(); drDraw(); }
  };
  if (typeof dtS !== 'undefined' && $('dtLevel')){
    const K = ['level','own','inst','oct','res','auto','keyRand','keyEvery','intro','timed','limit'];
    Presets.attach({ id:'dronetrap', name:'Drone → Degrees', view:'drone', box:pnl('droneView'), cls:'drtrap', scores:['dronetrap'],
      get:() => Object.assign(pick(dtS, K), droneGet(dtS.keyRand)),
      set:o => { put(dtS, o, K); dtSave(); dtSyncUI(); droneSet(o); dtOnRoot(); dtRender(); dtStats(); },
      open:() => dtSub('trap') });
  }
  if (typeof dmS !== 'undefined' && $('dmLevel')){
    const K = ['level','len','minI','maxI','startDo','bpm','inst','hear','tries','auto','check','keyRand','keyEvery','intro','timed','limit'];
    Presets.attach({ id:'dronemelo', name:'Drone → Melodieën', view:'drone', box:pnl('droneView'), cls:'drmelo', scores:['dronemelo','dronemeloe'],
      get:() => Object.assign(pick(dmS, K), droneGet(dmS.keyRand)),
      set:o => { put(dmS, o, K); dmSave(); dmSyncUI(); droneSet(o); dmStop(); dmRender(); dmStats(); },
      open:() => dtSub('melo') });
  }

  // --- Ritme: Tikken en Ritme luisteren bewaren hun instellingen alleen in de knoppen → rechtstreeks lezen en schrijven ---
  // Tempo (#bpm) hoort erbij; de gedeelde afspeelopties (metronoom, aftellen, meespelen, herhalen) niet.
  function domAdapter(chipSel, ids){
    const el = id => document.getElementById(id);
    return {
      get(){
        const o = { chips:[...document.querySelectorAll(chipSel + ' input:checked')].map(i => i.value) };
        ids.forEach(id => { const e = el(id); if (e) o[id] = e.type === 'checkbox' ? e.checked : e.value; });
        return o;
      },
      set(o){
        const boxes = [...document.querySelectorAll(chipSel + ' input')];
        if (boxes.length && Array.isArray(o.chips)) boxes.forEach(i => { i.checked = o.chips.includes(i.value); });
        ids.forEach(id => { const e = el(id); if (!e || o[id] === undefined) return; if (e.type === 'checkbox') e.checked = !!o[id]; else e.value = o[id]; });
        // de oefening laten reageren zoals bij een gewone klik
        ids.forEach(id => { const e = el(id); if (e && o[id] !== undefined) e.dispatchEvent(new Event(id === 'bpm' ? 'input' : 'change', { bubbles:true })); });
        if (boxes.length) boxes[0].dispatchEvent(new Event('change', { bubbles:true }));
      }
    };
  }
  if ($('tikView')){
    const d = domAdapter('#random .chips', ['rBars','rCont','rRounds','rTempo','rVaryAmt','rMin','rMax','rGap','rListen','bpm']);
    Presets.attach(Object.assign({ id:'tikken', name:'Tikken', view:'tikken', box:pnl('tikView'), scores:[] }, d));
  }
  if ($('quizView')){
    const q = domAdapter('#qChips', ['qN','qSame','qVary','qVaryAmt','bpm']);
    Presets.attach(Object.assign({ id:'ritmequiz', name:'Ritme luisteren → Meerkeuze', view:'luisteren', box:pnl('quizView'), cls:'forsub-mc', scores:['ritmequiz'],
      open:() => setSub('mc') }, q));
    const dd = domAdapter('#dChips', ['dLen','dVary','dVaryAmt','dPreview','bpm']);
    Presets.attach(Object.assign({ id:'ritmedictee', name:'Ritme luisteren → Dictee', view:'luisteren', box:pnl('quizView'), cls:'forsub-dict', scores:['ritmedictee'],
      open:() => setSub('dict') }, dd));
  }
})();
