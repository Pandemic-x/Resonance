// iconen.js – lijn-iconen in plaats van emoji (14-11-2026, wens gebruiker: "professioneler").
// Werkt vanzelf: elke bekende emoji in tekst (HTML, handleiding, knoppen die JS later vult) wordt een
// SVG-icoon in currentColor (volgt dus de themakleur, licht/donker). In <option>, title, placeholder en
// aria-label kan geen SVG: daar wordt de emoji gewoon weggehaald.
// 💬 (Vraag aan Claude) wordt het AI-teken: ✦ in een rondje (class .aiico).
// Nieuwe knop met icoon? Schrijf gewoon de emoji uit de lijst hieronder, of Icon.svg('naam').
const Icon = (() => {
  const P = {
    sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    gear:'<path d="M19.03 10.43 21.42 10.77 21.42 13.23 19.03 13.57 18.08 15.86 19.53 17.79 17.79 19.53 15.86 18.08 13.57 19.03 13.23 21.42 10.77 21.42 10.43 19.03 8.14 18.08 6.21 19.53 4.47 17.79 5.92 15.86 4.97 13.57 2.58 13.23 2.58 10.77 4.97 10.43 5.92 8.14 4.47 6.21 6.21 4.47 8.14 5.92 10.43 4.97 10.77 2.58 13.23 2.58 13.57 4.97 15.86 5.92 17.79 4.47 19.53 6.21 18.08 8.14Z"/><circle cx="12" cy="12" r="3"/>',
    chart:'<path d="M3 20h18M6 20v-8M11 20V5M16 20v-11M21 20v-6"/>',
    music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    note:'<path d="M12 18V4l6 2"/><circle cx="9" cy="18" r="3"/>',
    score:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M11 17v-6l4 1"/><circle cx="9.5" cy="17" r="1.5"/>',
    piano:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 13v7M12 4v16M16.5 13v7"/><path d="M6.3 4h2.4v9H6.3zM15.3 4h2.4v9h-2.4z" fill="currentColor"/>',
    volume:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    mute:'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    library:'<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="m16 5 3.8-1 2.2 15.6-3.8 1z"/>',
    book:'<path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z"/><path d="M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z"/>',
    steps:'<path d="M3 20h5v-5h5v-5h5V5h3"/>',
    checkc:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    drum:'<ellipse cx="12" cy="10" rx="9" ry="3.5"/><path d="M3 10v6c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5v-6"/><path d="M7 13.2v6M12 13.5v6M17 13.2v6"/><path d="m5 2.5 6 6.5M19 2.5l-6 6.5"/>',
    contrast:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    save:'<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8M7 21v-7h10v7"/>',
    video:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
    folder:'<path d="M3 19V5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2"/><path d="M3 19l3-8h16l-3 8z"/>',
    interval:'<path d="M4 20V4l16 16z"/><path d="M8 16v-4l4 4z"/>',
    wave:'<path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4"/>',
    busy:'<circle cx="12" cy="12" r="9" opacity=".35"/><path d="M12 3a9 9 0 0 1 9 9"/>',
    newc:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    full:'<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    bulb:'<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>',
    home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    clip:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    ear:'<path d="M6 8.5a6 6 0 0 1 12 0c0 6-6 6-6 10a3.5 3.5 0 0 1-6.5 1.5"/><path d="M15 8.5a3 3 0 0 0-6 0"/>',
    flag:'<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    tap:'<path d="M9 11V5a1.5 1.5 0 0 1 3 0v5M12 10V9a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2.4-3.7a1.5 1.5 0 0 1 2.4-1.8L9 15.5"/>',
    dot:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    shuffle:'<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    back:'<path d="M19 20 9 12l10-8z"/><path d="M5 19V5"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    warn:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    award:'<circle cx="12" cy="9" r="6"/><path d="m8.5 13.9-1.5 8.1 5-3 5 3-1.5-8.1"/>',
    pause:'<path d="M8.5 5v14M15.5 5v14" stroke-width="2.6"/>',
    puzzle:'<path d="M4 7h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H4v-3a2 2 0 1 0 0-4z"/><path d="M14 7h6v10h-6"/>',
    sticks:'<path d="M4 20 18 6M8 20 20 8"/><circle cx="19" cy="5" r="1.6"/><circle cx="21" cy="7" r="1.4"/><ellipse cx="9" cy="19" rx="6" ry="2"/>',
    poly:'<circle cx="12" cy="12" r="9"/><path d="M12 3 19.8 16.5H4.2z"/><path d="M12 3v18" opacity=".55"/>',
    trend:'<path d="M3 20h18"/><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/>',
    swing:'<path d="M3 15c2.5 0 2.5-6 5-6s2.5 6 5 6 2.5-6 5-6 2.5 6 3 6"/><path d="M7 20h2M15 20h4"/>',
    bass:'<path d="M14 3l4 4-6 6"/><path d="M12 13a4 4 0 1 0-1 5.5c.6-.6 2-.2 2.8-1 .8-.8.4-2.2 1-2.8A4 4 0 0 0 12 13z"/><path d="m16.5 5.5 1-1M9 15l2 2"/>',
    letters:'<path d="M3 18 7.5 6 12 18M4.7 14h5.6"/><path d="M14 18v-7h3.5a2 2 0 0 1 0 4H14m3.5 0a2 2 0 0 1 0 3H14"/>',
    symbol:'<path d="M5 17V7l5 10V7"/><path d="M14 12h6M17 9v6"/><path d="M14 19h6"/>',
    fader:'<path d="M6 3v18M12 3v18M18 3v18"/><rect x="4" y="13" width="4" height="3" rx="1" fill="currentColor"/><rect x="10" y="6" width="4" height="3" rx="1" fill="currentColor"/><rect x="16" y="10" width="4" height="3" rx="1" fill="currentColor"/>',
    ruler:'<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
    up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
    down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
    playc:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor"/>',
    star:'<path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z"/>',
    sparkle:'<path d="M12 2.5c.5 5.2 4.3 9 9.5 9.5-5.2.5-9 4.3-9.5 9.5-.5-5.2-4.3-9-9.5-9.5 5.2-.5 9-4.3 9.5-9.5z" fill="currentColor" stroke="none"/>'
  };
  // emoji → icoon (variatieteken U+FE0F mag erachter staan)
  const MAP = {
    '🕹':'sliders', '⚙':'gear', '📊':'chart', '🎼':'score', '🎶':'music', '🎵':'note', '🗂':'folder',
    '🎹':'piano', '🔊':'volume', '🤫':'mute', '🎯':'target', '📚':'library', '📖':'book', '🪜':'steps',
    '✅':'checkc', '🥁':'drum', '🌓':'contrast', '💾':'save', '🎬':'video', '📂':'folder', '📐':'interval',
    '🎻':'wave', '🔨':'busy', '🆕':'newc', '⛶':'full', '📝':'pen', '✍':'pen', '✎':'pen', '💡':'bulb',
    '🗑':'trash', '⏱':'timer', '⏰':'timer', '🔑':'key', '🏠':'home', '📋':'clip', '🔁':'repeat',
    '👂':'ear', '🏁':'flag', '☀':'sun', '🌙':'moon', '👆':'tap', '🔘':'dot', '🎲':'shuffle', '⏮':'back',
    '🔎':'search', '⭐':'star', '⚠':'warn', '🎉':'award', '⏸':'pause', '💬':'ai', '🧩':'puzzle', '🥢':'sticks', '🌀':'poly', '📈':'trend', '🎷':'swing', '🎸':'bass', '🔤':'letters', '🔣':'symbol', '🎚':'fader', '📏':'ruler', '⬆':'up', '⬇':'down'
  };
  const RE = new RegExp('(' + Object.keys(MAP).join('|') + ')\\uFE0F?', 'gu');
  const TEST = new RegExp(RE.source, 'u');
  const svg = (name, cls) => name === 'ai'
    ? '<span class="aiico" aria-hidden="true"><svg viewBox="0 0 24 24">' + P.sparkle + '</svg></span>'
    : '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
  const strip = s => s.replace(RE, '').replace(/^\s+/, '');
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);
  const STRIP = new Set(['OPTION', 'OPTGROUP', 'TITLE']);
  const ATTRS = ['title', 'placeholder', 'aria-label'];

  function textNode(n){
    const t = n.nodeValue; if (!t || !TEST.test(t)) return;
    const p = n.parentNode; if (!p || SKIP.has(p.nodeName)) return;
    if (STRIP.has(p.nodeName) || p.closest && p.closest('select, svg')){ n.nodeValue = strip(t); return; }
    const tpl = document.createElement('template');
    tpl.innerHTML = t.replace(/[&<>]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'}[c]))
                     .replace(RE, (m, e) => svg(MAP[e.replace('️', '')]));
    p.replaceChild(tpl.content, n);
  }
  function attrs(el){
    for (const a of ATTRS){ const v = el.getAttribute && el.getAttribute(a); if (v && TEST.test(v)) el.setAttribute(a, strip(v)); }
  }
  function scan(root){
    if (!root) return;
    if (root.nodeType === 3){ textNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1){ if (SKIP.has(root.nodeName)) { attrs(root); return; } attrs(root); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    const texts = [];
    let n; while ((n = w.nextNode())){ if (n.nodeType === 3) texts.push(n); else attrs(n); }
    texts.forEach(textNode);
  }
  let obs = null;
  function start(){
    scan(document.body);
    obs = new MutationObserver(list => {
      for (const m of list){
        if (m.type === 'childList') m.addedNodes.forEach(scan);
        else if (m.type === 'characterData') textNode(m.target);
        else if (m.type === 'attributes') attrs(m.target);
      }
    });
    obs.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS});
    // document.title
    if (TEST.test(document.title)) document.title = strip(document.title);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  return { svg, scan, strip, P, MAP };
})();
