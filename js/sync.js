/* ================= Synchroniseren tussen apparaten (alleen op de website) =================
   Inloggen met een e-mailcode (Supabase Auth). Na inloggen gaat hetzelfde pakket als de back-up
   (localStorage + Repertoire uit IndexedDB) naar de tabel sync_versies; per gebruiker blijven 10 versies.
   - Wijzigingen: localStorage-schrijfacties en PtDB.put/del/replaceAll zetten "vuil"; 30 s na de laatste
     wijziging (of als je de app wegklikt) wordt geüpload. Ongewijzigd (zelfde hash) = niets versturen.
   - Bij openen: staat er online een nieuwere versie (van een ander apparaat) en is hier sinds de vorige
     sync niets veranderd, dan wordt die opgehaald (en de pagina herladen). Allebei veranderd = vragen.
   - Vangnet: een pakket dat veel kleiner is dan het vorige wordt pas na bevestiging geüpload.
   Werkt niet in het Claude-artifact (daar is geen verbinding met externe servers); dan blijft alles verborgen.
   Sleutels die niet meegaan: 'sb-…' (inlogsessie) en 'sync-…' (deze module). */
const Sync = (function(){
  const URL_ = 'https://suzymhbriqfpawppvnal.supabase.co';
  const KEY_ = 'sb_publishable_tI7mw7qO71Zs5o-1XLMHaQ_9c2ozF4i';
  const T = 'sync_versies';
  const META = 'sync-meta', PTD = 'sync-ptdirty';
  const skip = k => !k || k.startsWith('sb-') || k.startsWith('sync-');
  const ls = window.localStorage;

  // eenvoudige, snelle hash (FNV-1a 32 bit) van een tekst
  function hash(s){ let h = 0x811c9dc5; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; }
  function lsData(){
    const d = {};
    try { const ks = []; for (let i = 0; i < ls.length; i++){ const k = ls.key(i); if (!skip(k)) ks.push(k); } ks.sort().forEach(k => d[k] = ls.getItem(k)); } catch(e){}
    return d;   // vaste volgorde, zodat dezelfde inhoud dezelfde hash geeft
  }
  const lsHash = () => { const d = lsData(); return hash(JSON.stringify(Object.keys(d).sort().map(k => [k, d[k]]))); };
  const getMeta = () => { try { return JSON.parse(ls.getItem(META)) || null; } catch(e){ return null; } };
  const setMeta = m => { try { ls.setItem(META, JSON.stringify(m)); } catch(e){} };

  // vóór de rest van de app: was er sinds de vorige sync iets veranderd? (opstart-schrijfacties tellen dan nog niet mee)
  const meta0 = getMeta();
  let dirtyAtStart = !!meta0 && (meta0.ls !== lsHash() || ls.getItem(PTD) === '1');

  // vanaf nu: elke wijziging in localStorage = vuil
  let dirty = false, upT = null, client = null, user = null, busy = false, ready = false;
  function markDirty(){ dirty = true; if (user && ready){ clearTimeout(upT); upT = setTimeout(() => upload(), 30000); } }
  const P = Storage.prototype, oSet = P.setItem, oRem = P.removeItem, oClr = P.clear;
  P.setItem = function(k, v){ const r = oSet.apply(this, arguments); if (this === ls && !skip(k)) markDirty(); return r; };
  P.removeItem = function(k){ const r = oRem.apply(this, arguments); if (this === ls && !skip(k)) markDirty(); return r; };
  P.clear = function(){ const keep = this === ls ? Object.entries(lsAll(k => skip(k))) : []; const r = oClr.apply(this, arguments); keep.forEach(([k, v]) => oSet.call(this, k, v)); if (this === ls) markDirty(); return r; };
  function lsAll(pred){ const d = {}; for (let i = 0; i < ls.length; i++){ const k = ls.key(i); if (pred(k)) d[k] = ls.getItem(k); } return d; }

  async function pakket(){
    let stukken = [];
    try { if (typeof PtDB !== 'undefined') stukken = (await PtDB.all()) || []; } catch(e){}
    return { app:'complete-ear-trainer', v:2, datum:new Date().toLocaleDateString('sv'), data:lsData(), stukken };
  }
  function apparaat(){
    const u = navigator.userAgent;
    const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Apparaat';
    const br = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
    return os + (br ? ' · ' + br : '') + (matchMedia('(display-mode: standalone)').matches ? ' (app)' : '');
  }
  const wanneer = t => { const d = new Date(t); return d.toLocaleDateString('nl', { day:'numeric', month:'short' }) + ' ' + d.toLocaleTimeString('nl', { hour:'2-digit', minute:'2-digit' }); };
  const kb = n => n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' kB' : (n / 1024 / 1024).toFixed(1) + ' MB';

  /* ---------- keuzevenster ---------- */
  function vraag(titel, tekst, knoppen){
    return new Promise(res => {
      const o = document.createElement('div'); o.className = 'syncover';
      o.innerHTML = '<div class="syncdlg" role="dialog" aria-modal="true"><h3></h3><p></p><div class="syncbtns"></div></div>';
      o.querySelector('h3').textContent = titel; o.querySelector('p').innerHTML = tekst;
      knoppen.forEach(([lbl, val, cls]) => { const b = document.createElement('button'); b.textContent = lbl; if (cls) b.className = cls; b.onclick = () => { o.remove(); res(val); }; o.querySelector('.syncbtns').appendChild(b); });
      document.body.appendChild(o);
    });
  }

  /* ---------- toepassen (zoals Terugzetten, maar de inlogsessie blijft) ---------- */
  async function toepassen(o, row){
    if (!o || o.app !== 'complete-ear-trainer' || typeof o.data !== 'object') throw new Error('ongeldig pakket');
    const keep = lsAll(k => skip(k));
    oClr.call(ls);
    Object.entries(keep).forEach(([k, v]) => oSet.call(ls, k, v));
    Object.entries(o.data).forEach(([k, v]) => { if (!skip(k)) oSet.call(ls, k, v); });
    if (Array.isArray(o.stukken) && typeof PtDB !== 'undefined') await PtDB.replaceAll(o.stukken.filter(s => s && s.id));
    oRem.call(ls, PTD);
    setMeta({ id:row.id, ls:lsHash(), h:hash(JSON.stringify(await pakket())), size:row.grootte });
    dirty = false; dirtyAtStart = false;
  }

  /* ---------- uploaden ---------- */
  async function upload(opts){
    opts = opts || {};
    if (!user || busy) return;
    clearTimeout(upT);
    busy = true; status('Bezig met opslaan…');
    try {
      const o = await pakket(), txt = JSON.stringify(o), h = hash(txt), m = getMeta() || {};
      if (h === m.h && !opts.force){ dirty = false; dirtyAtStart = false; oRem.call(ls, PTD); status(); return; }
      if (m.size > 20000 && txt.length < m.size * 0.5 && !opts.force){
        const ok = await vraag('Veel minder gegevens dan vorige keer',
          'Wat er nu op dit apparaat staat (' + kb(txt.length) + ') is veel kleiner dan de vorige online versie (' + kb(m.size) + '). Misschien is er hier iets gewist. Wil je dit toch online opslaan? De vorige versie blijft bij <b>Versies</b> bewaard.',
          [['Niet opslaan', false], ['Toch opslaan', true, 'primary']]);
        if (!ok){ status('Niet opgeslagen. Kijk bij Versies of zet een eerdere versie terug.', true); return; }
      }
      const { data, error } = await client.from(T).insert({ data:o, grootte:txt.length, apparaat:apparaat() }).select('id').single();
      if (error) throw error;
      setMeta({ id:data.id, ls:lsHash(), h, size:txt.length });
      oRem.call(ls, PTD); dirty = false; dirtyAtStart = false;
      status();
    } catch(e){ status('Opslaan lukte niet (' + (e.message || 'geen verbinding') + '). Ik probeer het later opnieuw.', true); dirty = true; }
    finally { busy = false; }
  }

  /* ---------- vergelijken met online ---------- */
  async function controleer(eersteKeer){
    if (!user || busy) return;
    busy = true;
    try {
      const { data:rows, error } = await client.from(T).select('id,grootte,apparaat,gemaakt_op').order('id', { ascending:false }).limit(1);
      if (error) throw error;
      const r = rows[0], m = getMeta();
      busy = false;
      if (!r){ await upload({ force:true }); return; }                       // nog niets online: dit apparaat is het begin
      if (m && m.id === r.id){ if (dirty || dirtyAtStart) await upload(); else status(); return; }  // niemand anders heeft iets geüpload
      const hierVeranderd = !m ? true : (eersteKeer ? dirtyAtStart : (dirty || dirtyAtStart));
      let keuze = 'online';
      if (hierVeranderd){
        keuze = await vraag(m ? 'Op twee apparaten geoefend' : 'Gegevens online gevonden',
          (m ? 'Sinds de vorige keer is er hier én op een ander apparaat iets veranderd. ' : 'Er staan al gegevens van je online. ')
          + 'Welke wil je gebruiken?<br><small>Online: ' + (r.apparaat || 'ander apparaat') + ', ' + wanneer(r.gemaakt_op) + ' (' + kb(r.grootte) + '). De andere blijft bij <b>Versies</b> bewaard.</small>',
          [['Die van dit apparaat', 'hier'], ['Die van online', 'online', 'primary']]);
      }
      if (keuze === 'hier'){ await upload({ force:true }); return; }
      await haalOp(r.id, true);
    } catch(e){ busy = false; status('Geen verbinding met de online opslag. Je kunt gewoon verder; ik synchroniseer later.', true); }
  }
  async function haalOp(id, herlaad){
    busy = true; status('Ophalen…');
    try {
      const { data:row, error } = await client.from(T).select('id,data,grootte').eq('id', id).single();
      if (error) throw error;
      await toepassen(row.data, row);
      if (herlaad){ status('Bijgewerkt. De app laadt opnieuw…'); setTimeout(() => location.reload(), 600); }
    } catch(e){ status('Ophalen lukte niet (' + (e.message || 'fout') + ').', true); }
    finally { busy = false; }
  }

  /* ---------- versies ---------- */
  async function versies(){
    const box = document.getElementById('syVersies'); if (!box) return;
    box.innerHTML = '<span class="muted">Laden…</span>';
    const { data:rows, error } = await client.from(T).select('id,grootte,apparaat,gemaakt_op').order('id', { ascending:false }).limit(10);
    if (error){ box.textContent = 'Laden lukte niet.'; return; }
    const m = getMeta() || {};
    box.innerHTML = rows.length ? '' : '<span class="muted">Nog geen versies.</span>';
    rows.forEach(r => {
      const d = document.createElement('div'); d.className = 'syver';
      d.innerHTML = '<span><b></b> <span class="muted"></span></span>';
      d.querySelector('b').textContent = wanneer(r.gemaakt_op);
      d.querySelector('.muted').textContent = (r.apparaat || '') + ' · ' + kb(r.grootte) + (r.id === m.id ? ' · nu in gebruik' : '');
      if (r.id !== m.id){
        const b = document.createElement('button'); b.textContent = 'Terugzetten';
        b.onclick = async () => {
          const ok = await vraag('Deze versie terugzetten?', 'Alles op dit apparaat wordt vervangen door de versie van <b>' + wanneer(r.gemaakt_op) + '</b>. Wat er nu staat blijft als versie bewaard.', [['Annuleren', false], ['Terugzetten', true, 'primary']]);
          if (!ok) return;
          await upload();                       // huidige stand eerst bewaren
          await haalOp(r.id, false);
          await upload({ force:true });         // de teruggezette versie wordt de nieuwste
          status('Teruggezet. De app laadt opnieuw…'); setTimeout(() => location.reload(), 600);
        };
        d.appendChild(b);
      }
      box.appendChild(d);
    });
  }

  /* ---------- scherm in Instellingen ---------- */
  const $ = id => document.getElementById(id);
  function status(t, bad){
    const el = $('syStatus'); if (!el) return;
    if (t == null){ const m = getMeta(); t = m ? '✓ Alles opgeslagen' + (dirty ? ' (wijzigingen worden zo opgeslagen)' : '') : ''; }
    el.textContent = t; el.style.color = bad ? 'var(--bad, #f87171)' : '';
  }
  function toon(){
    const uit = $('syUit'), aan = $('syAan'); if (!uit) return;
    uit.hidden = !!user; aan.hidden = !user;
    if (user){ $('syWie').textContent = user.email || ''; status(); }
  }
  function koppelScherm(){
    const sec = $('sySec'); if (!sec) return;
    sec.hidden = false;
    let email = '';
    $('sySend').onclick = async () => {
      email = $('syEmail').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Vul een geldig e-mailadres in.', true);
      $('sySend').disabled = true; msg('Code versturen…');
      const { error } = await client.auth.signInWithOtp({ email, options:{ shouldCreateUser:true, emailRedirectTo:location.origin + location.pathname } });
      $('sySend').disabled = false;
      if (error) return msg(error.status === 429 ? 'Te veel pogingen. Wacht een paar minuten.' : 'Versturen lukte niet: ' + error.message, true);
      $('syCodeRow').hidden = false; $('syCode').focus();
      msg('Kijk in je mail (ook bij spam). Vul de code in, of klik op de link in de mail.');
    };
    $('syEmail').onkeydown = e => { if (e.key === 'Enter') $('sySend').click(); e.stopPropagation(); };
    $('syCode').onkeydown = e => { if (e.key === 'Enter') $('syLogin').click(); e.stopPropagation(); };
    $('syLogin').onclick = async () => {
      const token = $('syCode').value.replace(/\s/g, '');
      if (!/^\d{6,10}$/.test(token)) return msg('Vul de cijfercode uit de mail in.', true);
      msg('Inloggen…');
      const { error } = await client.auth.verifyOtp({ email, token, type:'email' });
      if (error) return msg('Die code klopt niet of is verlopen. Vraag een nieuwe aan.', true);
      msg('');
    };
    $('syNow').onclick = async () => { await upload(); if (!dirty) await controleer(false); };
    $('syVerBtn').onclick = () => { const b = $('syVersies'); b.hidden = !b.hidden; if (!b.hidden) versies(); };
    $('syOut').onclick = async () => {
      const ok = await vraag('Uitloggen?', 'Je gegevens blijven op dit apparaat staan, maar synchroniseren stopt tot je weer inlogt.', [['Annuleren', false], ['Uitloggen', true, 'primary']]);
      if (!ok) return;
      if (dirty) await upload();
      await client.auth.signOut(); oRem.call(ls, META);
    };
    function msg(t, bad){ const el = $('syMsg'); el.textContent = t; el.style.color = bad ? 'var(--bad, #f87171)' : ''; }
  }

  /* ---------- start ---------- */
  function start(){
    if (window.claude || !window.supabase || location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    try {
      client = window.supabase.createClient(URL_, KEY_, { auth:{ flowType:'pkce', persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
    } catch(e){ return; }
    koppelScherm();
    // Repertoire-wijzigingen (IndexedDB) ook als wijziging tellen
    if (typeof PtDB !== 'undefined') ['put', 'del', 'replaceAll'].forEach(f => {
      const o = PtDB[f]; PtDB[f] = function(){ try { oSet.call(ls, PTD, '1'); } catch(e){} markDirty(); return o.apply(this, arguments); };
    });
    let gestart = false;
    client.auth.onAuthStateChange((ev, session) => {
      const was = user; user = session ? session.user : null; toon();
      if (user && !gestart){ gestart = true; ready = true; setTimeout(() => controleer(true), 300); }
      if (!user){ gestart = false; ready = false; }
      if (user && !was && ev === 'SIGNED_IN' && location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
    });
    // wegklikken = meteen opslaan; terugkomen na een tijdje = kijken of een ander apparaat iets nieuws heeft
    let weg = 0;
    document.addEventListener('visibilitychange', () => {
      if (!user) return;
      if (document.visibilityState === 'hidden'){ weg = Date.now(); if (dirty) upload(); }
      else if (weg && Date.now() - weg > 60000) controleer(false);
    });
  }
  document.addEventListener('DOMContentLoaded', start);
  return { upload, controleer };
})();
