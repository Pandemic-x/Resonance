/* ================= Thema (licht / donker) =================
   Staat in <head> zodat de pagina meteen in het goede thema verschijnt (geen witte flits).
   Zet class 'dark' op <html> (niet op body: de router overschrijft body.className).
   Opslag 'thema' = 'auto' | 'licht' | 'donker'. Knop #themeBtn in de kop, keuzelijst #sTheme in Instellingen.
   Themakleur: opslag 'thema-kleur' = id uit ACCENTS of '#rrggbb' (eigen kleur). Zet --accent, --accent-soft,
   --accent-dark en --accent-shadow inline op <html>, opnieuw berekend bij licht/donker.
   Achtergrondtint: opslag 'thema-tint' 0..100 (#sTint). Zet ook --bg --paper --line --soft --soft2 --tabs --edge --header-bg
   inline (neutraal bij 0, richting de themakleur bij hogere waarden). Keuze in Instellingen (#sAccents).
   Kleuren: css/donker.css overschrijft de CSS-variabelen + de paar vaste kleuren; notenbalken (VexFlow-svg)
   worden in donker omgekeerd met een filter. Nieuwe CSS: gebruik var(--bg/--paper/--ink/--muted/--line). */
const Thema = (function(){
  const KEY = 'thema', AKEY = 'thema-kleur', TKEY = 'thema-tint';
  // neutrale basiskleuren; met 'tint' > 0 schuiven ze richting de themakleur
  const BASE = {
    licht:  { bg:'#f6f2ea', paper:'#fffdf8', line:'#e4dccf', soft:'#efe8dc', soft2:'#efe7da', tabs:'#ece5d8', edge:'#cdbfa9' },
    donker: { bg:'#0c0b10', paper:'#16141c', line:'#2c2836', soft:'#1e1b26', soft2:'#25212f', tabs:'#25212f', edge:'#4a4458' }   // zwart (19-11-2026)
  };
  // hoeveel themakleur er bij tint 100 in elke laag komt
  const TMAX = { licht: { bg:.13, paper:.06, line:.25, soft:.18, soft2:.2, tabs:.22, edge:.3 }, donker: { bg:.12, paper:.13, line:.28, soft:.16, soft2:.2, tabs:.22, edge:.3 } };
  const getTint = () => { try { const v = parseInt(localStorage.getItem(TKEY), 10); return v >= 0 && v <= 100 ? v : 60; } catch(e){ return 60; } };
  // standaard (19-11-2026, wens gebruiker): donker, Resonance-paars, achtergrondtint 60. Eenmalig ook voor bestaande opslag.
  try { if (!localStorage.getItem('thema-v2')){ localStorage.setItem(KEY, 'donker'); localStorage.setItem(AKEY, 'resonance'); localStorage.setItem(TKEY, '60'); localStorage.setItem('thema-v2', '1'); } } catch(e){}
  // [id, naam, licht, donker]
  const ACCENTS = [
    ['resonance','Resonance','#8b3fd9','#b57bf7'], ['oranje','Oranje','#c2410c','#f0712c'], ['rood','Rood','#be123c','#fb7185'], ['roze','Roze','#db2777','#f472b6'],
    ['paars','Paars','#7c3aed','#a78bfa'], ['indigo','Indigo','#4f46e5','#818cf8'], ['blauw','Blauw','#2563eb','#60a5fa'],
    ['petrol','Petrol','#0f766e','#2dd4bf'], ['groen','Groen','#15803d','#4ade80'], ['goud','Goud','#a16207','#facc15']
  ];
  const hex2 = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const rgb2 = a => '#' + a.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, f) => rgb2(hex2(a).map((x, i) => x * (1 - f) + hex2(b)[i] * f));   // f = aandeel b
  const getAccent = () => { try { return localStorage.getItem(AKEY) || 'resonance'; } catch(e){ return 'resonance'; } };
  function accentHex(dark){
    const a = getAccent(), p = ACCENTS.find(x => x[0] === a);
    if (p) return p[dark ? 3 : 2];
    if (/^#[0-9a-f]{6}$/i.test(a)) return dark ? mix(a, '#ffffff', .25) : a;
    return ACCENTS[0][dark ? 3 : 2];
  }
  function applyAccent(dark){
    const c = accentHex(dark), st = document.documentElement.style;
    st.setProperty('--accent', c);
    st.setProperty('--accent-soft', dark ? mix(c, '#1f1c17', .72) : mix(c, '#fffdf8', .86));
    st.setProperty('--accent-dark', mix(c, '#000000', dark ? .2 : .22));
    st.setProperty('--accent-shadow', c + '1f');
    const mode = dark ? 'donker' : 'licht', f = getTint() / 100, b = BASE[mode];
    Object.keys(b).forEach(k => st.setProperty('--' + k, mix(b[k], c, TMAX[mode][k] * f)));
    st.setProperty('--header-bg', mix(b.bg, c, TMAX[mode].bg * f) + 'ee');
  }
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const get = () => { try { return localStorage.getItem(KEY) || 'donker'; } catch(e){ return 'donker'; } };
  const isDark = () => document.documentElement.classList.contains('dark');
  function apply(){
    const t = get(), dark = t === 'donker' || (t === 'auto' && !!(mq && mq.matches));
    document.documentElement.classList.toggle('dark', dark);
    applyAccent(dark);
    const b = document.getElementById('themeBtn');
    if (b){ b.textContent = dark ? '☀️' : '🌙'; b.title = dark ? 'Lichte modus' : 'Donkere modus'; }
    const s = document.getElementById('sTheme'); if (s) s.value = t;
    const tr = document.getElementById('sTint');
    if (tr){ tr.value = getTint(); document.getElementById('sTintVal').textContent = tintName(getTint()); }
    const box = document.getElementById('sAccents');
    if (box){
      const a = getAccent();
      box.querySelectorAll('[data-a]').forEach(x => x.classList.toggle('on', x.dataset.a === a));
      const own = document.getElementById('sAccentOwn');
      if (own){ own.classList.toggle('on', a.startsWith('#')); if (a.startsWith('#')){ own.querySelector('input').value = a; own.querySelector('span').style.background = a; } }
    }
  }
  function setAccent(a){ try { localStorage.setItem(AKEY, a); } catch(e){} apply(); }
  function setTint(v){ try { localStorage.setItem(TKEY, String(v)); } catch(e){} apply(); }
  const tintName = v => v === 0 ? 'uit' : v < 35 ? 'subtiel' : v < 70 ? 'duidelijk' : 'sterk';
  function set(t){ try { localStorage.setItem(KEY, t); } catch(e){} apply(); }
  apply();
  if (mq){ if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    const b = document.getElementById('themeBtn');
    if (b) b.onclick = () => { set(isDark() ? 'licht' : 'donker'); b.blur(); };
    const s = document.getElementById('sTheme');
    if (s) s.onchange = e => { set(e.target.value); e.target.blur(); };
    const box = document.getElementById('sAccents');
    if (box){
      box.innerHTML = ACCENTS.map(([id, n, l, d]) => `<button class="swatch" data-a="${id}" title="${n}" style="--sw:${l};--swd:${d}"><span></span>${n}</button>`).join('')
        + `<label class="swatch own" id="sAccentOwn" title="Kies zelf een kleur"><input type="color" value="#7c3aed"><span></span>Eigen kleur</label>`;
      box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { setAccent(b.dataset.a); b.blur(); });
      const inp = box.querySelector('#sAccentOwn input');
      inp.oninput = e => setAccent(e.target.value.toLowerCase());
      apply();
    }
    const tr = document.getElementById('sTint');
    if (tr) tr.oninput = e => setTint(+e.target.value);
  });
  return { get, set, apply, isDark, setAccent, setTint, ACCENTS };
})();
