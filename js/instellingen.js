/* ================= Instellingen ================= */
(function(){
  /* --- geluid --- */
  const volShow = () => { $('volVal').textContent = Math.round(Engine.volume() * 100) + '%'; };
  $('vol').value = Math.round(Engine.volume() * 100); volShow();
  $('vol').oninput = e => { Engine.volume(e.target.value / 100); volShow(); };
  $('volTest').onclick = () => { stop(); Engine.ensure(); Engine.chord(Engine.now() + .05, [60, 64, 67], 1.0); };

  // dezelfde keuzes staan hier én in de kopbalk bij Atlas; ze blijven gelijk
  const SND = [['metro', 'sMetro', 'hMetro', 'mtSound'], ['up', 'sUp', 'hUp'], ['low', 'sLow', 'hLow']];
  SND.forEach(([role, ...ids]) => ids.forEach(id => {
    $(id).innerHTML = Engine.soundOptions(role);
    $(id).onchange = e => {
      Engine.setSound(role, e.target.value);
      ids.forEach(o => { $(o).value = e.target.value; });
      e.target.blur();
      if (!state && !Engine.metronome.running()) Engine.preview(role);           // geen voorbeeld dwars door een lopend ritme heen
    };
  }));

  /* --- opgenomen klanken (samples.js) --- */
  const smpShow = () => {
    const ids = ['piano', inst, 'orgel', 'cello'].filter((x, i, a) => a.indexOf(x) === i && Samples.GM[x]);
    const st = ids.map(id => { const s = Samples.status(id), n = (Engine.INSTRUMENTS.find(x => x.id === id) || {}).n || id;
      return s.startsWith('ok') ? n + ' ✓' : s === 'loading' ? n + ' laden…' : s === 'fail' ? n + ' ✗' : null; }).filter(Boolean);
    const fail = ids.some(id => Samples.status(id) === 'fail');
    $('sSamplesMsg').innerHTML = !Samples.enabled() ? 'uit: je hoort de nagebouwde klanken' :
      (st.join(' · ') || '') + (fail ? ' (laden lukte niet; de nagebouwde klank wordt gebruikt)' : '') +
      '<br><small>Opnames: piano = Salamander Grand Piano (Alexander Holm, CC BY 3.0); Viool VSCO en cello = VSCO 2 Community Edition (Versilian Studios, CC0); Viool Iowa = University of Iowa Musical Instrument Samples (Lawrence Fritts, vrij te gebruiken); orgel en overige = MusyngKite / FluidR3 soundfonts (CC BY-SA 3.0 / CC BY 3.0), via midi-js-soundfonts van Benjamin Gleitzman.</small>';
  };
  $('sSamples').checked = Samples.enabled();
  $('sSamples').onchange = e => { Samples.enabled(e.target.checked); if (e.target.checked){ Samples.load('piano'); Samples.load(inst); } Engine.drone.on() && Engine.drone.stop(); smpShow(); };
  Samples.onChange(smpShow);

  /* --- één klank voor de gehoortraining --- */
  const INST_KEY = 'standaard-klank';
  let inst = 'piano';
  try { inst = Engine.instId(localStorage.getItem(INST_KEY) || 'piano'); } catch(e){}
  $('sInst').innerHTML = Engine.instOptions(inst);
  Samples.load('piano'); Samples.load(inst); smpShow();          // de klanken die het meest gebruikt worden alvast laden
  $('sInst').onchange = e => {
    inst = e.target.value; $('sInstMsg').textContent = ''; Samples.load(inst); smpShow();
    try { localStorage.setItem(INST_KEY, inst); } catch(err){}
    playInst();
  };
  function playInst(){ stop(); Engine.ensure(); Engine.melody(Engine.now() + .05, [{m:60,d:.35},{m:64,d:.35},{m:67,d:.35},{m:72,d:.8}], { inst }); }
  document.querySelectorAll('#setView [data-prev]').forEach(b => b.onclick = () => {
    const r = b.dataset.prev;
    if (r === 'inst') playInst(); else { stop(); Engine.preview(r); }
  });
  // schrijft de klank in de opgeslagen instellingen én in het geopende onderdeel
  const TARGETS = [
    { key:'gehoor-settings', obj:() => window.gS, sel:'gTimbre' },
    { key:'iv-settings',     obj:() => window.ivProfile === 'gehoor' ? window.ivS : null, sel:'ivInst' },
    { key:'intervallen-blad-settings', obj:() => window.ivProfile === 'blad' ? window.ivS : null, sel:'ivInst' },
    { key:'dictee-settings', obj:() => window.mS, sel:'mdTimbre' },
    { key:'notenleer-settings', obj:() => window.nlS, sel:'nlInst' },
    { key:'toonsoorten-settings', obj:() => window.tsS, sel:'tsInst' },
    { key:'toonladders-settings', obj:() => window.tlProfile === 'blad' ? window.tlS : null, sel:'tlInst' },
    { key:'toonladders-gehoor-settings', obj:() => window.tlProfile === 'gehoor' ? window.tlS : null, sel:'tlInst' },
    { key:'akkoorden-settings', obj:() => window.akProfile === 'blad' ? window.akS : null, sel:'akInst' },
    { key:'akkoorden-gehoor-settings', obj:() => window.akProfile === 'gehoor' ? window.akS : null, sel:'akInst' }
  ];
  $('sInstAll').onclick = () => {
    TARGETS.forEach(tg => {
      let s = {};
      try { s = JSON.parse(localStorage.getItem(tg.key)) || {}; } catch(e){}
      s.timbre = inst;
      try { localStorage.setItem(tg.key, JSON.stringify(s)); } catch(e){}
      const o = tg.obj(); if (o) o.timbre = inst;
      if ($(tg.sel)) $(tg.sel).value = inst;
    });
    const n = Engine.INSTRUMENTS.find(x => x.id === inst);
    $('sInstMsg').textContent = '✓ ' + (n ? n.n : inst) + ' staat nu overal ingesteld.';
  };

  /* --- tik-vertraging --- */
  const calShow = () => { $('calNow').textContent = (calib > 0 ? '+' : '') + calib + ' ms'; };
  $('calReset').onclick = () => {
    calib = 0;
    try { localStorage.setItem(CAL_KEY, 0); } catch(e){}
    calShow(); if (typeof showCalib === 'function') showCalib();
  };

  /* --- back-up --- */
  const msg = (t, bad) => { $('bkMsg').textContent = t; $('bkMsg').style.color = bad ? 'var(--bad, #c0392b)' : ''; };
  function allData(){
    const d = {};
    try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); d[k] = localStorage.getItem(k); } } catch(e){}
    return d;
  }
  // volledige back-up: localStorage + Repertoire (stukken met passages, aantekeningen, chats, opnames) uit IndexedDB
  async function backupText(){
    let stukken = [];
    try { if (typeof PtDB !== 'undefined') stukken = (await PtDB.all()) || []; } catch(e){}
    return JSON.stringify({ app:'complete-ear-trainer', v:2, datum:new Date().toLocaleDateString('sv'), data:allData(), stukken });
  }
  const bkCount = n => n ? ' (met ' + n + (n === 1 ? ' stuk' : ' stukken') + ' uit Repertoire)' : '';
  $('bkCopy').onclick = async () => {
    const txt = await backupText(), n = JSON.parse(txt).stukken.length;
    $('bkText').value = txt; $('bkText').select();
    try { await navigator.clipboard.writeText(txt); msg('✓ Gekopieerd' + bkCount(n) + '. Plak het ergens waar je het bewaart.'); }
    catch(e){ msg('Kopiëren lukte niet automatisch. Selecteer de tekst hieronder en kopieer hem zelf.'); }
  };
  // als bestand opslaan (capability downloads); knop alleen tonen als die er is
  // buiten Claude (eigen website): gewone browserdownload
  let bkDl = window.claude ? null : { save: async ({ filename, data }) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } };
  if (bkDl) $('bkSave').hidden = false;
  (function hook(tries){
    if (window.claude && typeof window.claude.use === 'function'){
      window.claude.use('downloads').then(d => { bkDl = d; $('bkSave').hidden = !d; }).catch(() => {});
    } else if (tries < 40) setTimeout(() => hook(tries + 1), 250);
  })(0);
  $('bkSave').onclick = async () => {
    if (!bkDl) return;
    const txt = await backupText(), n = JSON.parse(txt).stukken.length;
    try {
      await bkDl.save({ filename:'ear-trainer-backup-' + new Date().toLocaleDateString('sv') + '.json', data:new Blob([txt]) });
      msg('✓ Back-up opgeslagen' + bkCount(n) + '.');
    } catch(e){
      const c = e && e.code;
      if (c === 'declined') msg('Niet opgeslagen.');
      else if (c === 'rate_limited') msg('Even wachten en dan nog eens proberen.', true);
      else msg('Opslaan als bestand lukte hier niet. Gebruik 📋 Kopieer back-up.', true);
    }
  };
  // terugzetten (uit tekst of bestand)
  async function restore(raw){
    let o;
    try { o = JSON.parse(String(raw || '').trim()); } catch(e){ return msg('Dit is geen geldige back-up.', true); }
    if (!o || o.app !== 'complete-ear-trainer' || typeof o.data !== 'object') return msg('Dit is geen back-up van deze app.', true);
    msg('Bezig met terugzetten…');
    try { localStorage.clear(); Object.entries(o.data).forEach(([k, v]) => localStorage.setItem(k, v)); }
    catch(e){ return msg('Herstellen lukte niet in deze browser.', true); }
    if (Array.isArray(o.stukken) && typeof PtDB !== 'undefined'){
      try { await PtDB.replaceAll(o.stukken.filter(s => s && s.id)); }
      catch(e){ return msg('Je instellingen zijn hersteld, maar de stukken van Repertoire niet (opslag werkt niet in deze browser).', true); }
    }
    msg('✓ Hersteld' + bkCount(Array.isArray(o.stukken) ? o.stukken.length : 0) + '. De app laadt opnieuw…');
    setTimeout(() => location.reload(), 900);
  }
  $('bkFile').onchange = () => {
    const f = $('bkFile').files[0]; $('bkFile').value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { bkPending = r.result; $('bkLoad').textContent = '⚠ ' + f.name + ' terugzetten? Klik nog eens'; $('bkLoad').classList.add('on'); clearTimeout(bkPT); bkPT = setTimeout(bkReset, 6000); };
    r.onerror = () => msg('Dit bestand kon niet gelezen worden.', true);
    r.readAsText(f);
  };
  let bkPending = null, bkPT = null;
  const bkReset = () => { bkPending = null; $('bkLoad').textContent = '📂 Terugzetten uit bestand'; $('bkLoad').classList.remove('on'); };
  $('bkLoad').onclick = () => {
    if (!bkPending){ $('bkFile').click(); return; }
    const raw = bkPending; clearTimeout(bkPT); bkReset(); restore(raw);
  };
  // tweestaps-bevestiging in de pagina (geen confirm()-venster)
  function twoStep(btn, label, action){
    let armed = false, t = null;
    const orig = btn.textContent;
    btn.onclick = () => {
      if (!armed){ armed = true; btn.textContent = label; btn.classList.add('on'); t = setTimeout(() => { armed = false; btn.textContent = orig; btn.classList.remove('on'); }, 4000); return; }
      clearTimeout(t); armed = false; btn.textContent = orig; btn.classList.remove('on'); action();
    };
  }
  twoStep($('bkRestore'), 'Zeker? Klik nog eens', () => {
    if (!$('bkText').value.trim()) return msg('Plak eerst de hele back-up-tekst in het vak hieronder.', true);
    restore($('bkText').value);
  });
  twoStep($('bkWipe'), 'Alles weg? Klik nog eens', () => {
    try { localStorage.clear(); } catch(e){}
    msg('Alles gewist. De app laadt opnieuw…');
    setTimeout(() => location.reload(), 700);
  });

  /* --- sneltoets-maker (schrijft via Keys naar 'sneltoetsen') --- */
  let kCap = null;                         // { act, btn } zolang we op een toets wachten
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  function kMsg(html, bad){ $('kMsg').innerHTML = html; $('kMsg').className = 'kmsg' + (bad ? ' bad' : html ? ' good' : ''); }
  function kRender(){
    $('kList').innerHTML = Keys.ACTIONS.map(a => {
      const keys = Keys.map[a.id] || [];
      const chips = keys.length
        ? keys.map(k => `<span class="kkey"><kbd>${esc(Keys.name(k))}</kbd><button class="kx" data-act="${a.id}" data-rm="${esc(k)}" title="${esc(Keys.name(k))} weghalen">×</button></span>`).join('')
        : '<span class="muted kempty">geen toets</span>';
      const def = Keys.isDefault(a.id);
      return `<div class="krow${def ? '' : ' changed'}">
        <div class="kname"><b>${a.naam}</b><small>${a.uitleg} · ${Keys.where(a.waar)}</small></div>
        <div class="kkeys">${chips}
          <button class="kadd" data-act="${a.id}">+ toets</button>
          ${def ? '' : `<button class="kreset" data-act="${a.id}" title="Terug naar standaard (${esc(Keys.DEFAULT[a.id].map(Keys.name).join(' of '))})">↺</button>`}
        </div></div>`;
    }).join('');
    $('kList').querySelectorAll('.kx').forEach(b => b.onclick = () => { kStop(); Keys.remove(b.dataset.act, b.dataset.rm); kMsg(''); });
    $('kList').querySelectorAll('.kadd').forEach(b => b.onclick = () => kStart(b.dataset.act, b));
    $('kList').querySelectorAll('.kreset').forEach(b => b.onclick = () => { kStop(); Keys.reset(b.dataset.act); kMsg('✓ Standaard teruggezet.'); });
    $('kFixed').innerHTML = Object.entries(Keys.RESERVED).map(([w, list]) =>
      `<div class="kfix"><b>${Keys.WHERE[w]}</b> ${list.map(r => esc(r.wat)).join(' · ')}</div>`).join('');
  }
  function kStart(act, btn){
    kStop();
    kCap = { act, btn };
    btn.textContent = 'Druk op een toets…'; btn.classList.add('on'); btn.blur();
    kMsg('');
  }
  function kStop(){
    if (!kCap) return;
    kCap.btn.textContent = '+ toets'; kCap.btn.classList.remove('on');
    kCap = null;
  }
  let kSwallowUp = null;
  // capture-fase op window: komt vóór alle module-handlers op document, die zo niets merken
  window.addEventListener('keydown', e => {
    if (!kCap) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (['Shift','Control','Alt','AltGraph','Meta','OS','CapsLock'].includes(e.key)) return;   // wacht op de echte toets
    kSwallowUp = e.key;
    if (e.key === 'Escape'){ kStop(); kMsg('Geannuleerd.'); return; }
    if (e.ctrlKey || e.metaKey || e.altKey){ kMsg('Zonder Ctrl, Alt of Cmd graag: die combinaties zijn voor de browser.', true); return; }
    const act = kCap.act, r = Keys.add(act, e.key);
    kStop();
    if (r.ok) return kMsg('✓ ' + esc(r.msg));
    kMsg(esc(r.msg) + (r.steal ? ' <button id="kSteal" class="kinline">Toch gebruiken</button>' : ''), true);
    if (r.steal){
      const key = e.key;
      $('kSteal').onclick = () => { const s = Keys.add(act, key, { steal:true }); kMsg((s.ok ? '✓ ' : '') + esc(s.msg), !s.ok); };
    }
  }, true);
  window.addEventListener('keyup', e => {
    if (kSwallowUp !== null && e.key === kSwallowUp){ e.preventDefault(); e.stopImmediatePropagation(); kSwallowUp = null; }
  }, true);
  document.addEventListener('pointerdown', e => { if (kCap && e.target !== kCap.btn) kStop(); });
  twoStep($('kResetAll'), 'Zeker? Klik nog eens', () => { kStop(); Keys.resetAll(); kMsg('✓ Alle sneltoetsen staan weer op standaard.'); });
  Keys.onChange(kRender);
  kRender();

  window.sOnRoute = () => {
    kStop();
    SND.forEach(([role, ...ids]) => ids.forEach(id => { $(id).value = Engine.sounds[role]; }));
    if (typeof view === 'undefined' || view !== 'instellingen') return;
    $('vol').value = Math.round(Engine.volume() * 100); volShow();
    calShow();
  };
})();
