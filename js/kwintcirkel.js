/* ================= Kwintencirkel (gedeeld, `Cirkel`) =================
   Eén standaardcirkel voor Drone → Vrij spelen, Degrees en (later) Melodieën.
   Vaste plek per trap (do boven, ♯4 onder, kwintvolgorde), trap + solmisatie in de bol, nootnaam erbuiten,
   kleurverloop over de ring. Kleuren/labels/namen geeft de aanroeper mee (drone.js: drColor, drDegLabel, drNameAt).

   Cirkel.draw(el, {
     color(semi) → css-kleur, degree(semi) → '♭3', name(semi) → 'E♭',
     dot(semi) → { fill, faint, click (standaard true), pulse, mark:'right'|'wrong', title, aria },
     onDot(semi, event),
     center: { html, title, aria, onClick, clock:{dur, el (al verstreken s), warm} },
     label, id (prefix voor svg-id's)
   })
   Stijl (css/drone.css, sectie Kwintencirkel): fill = gevulde bol met gloed, anders een gekleurde ring;
   faint = gedimd (buiten toonladder/niveau); pulse = vaste halo + uitdijende ring (de toon die nu klinkt).
   Cirkel.icon('play'|'stop') en Cirkel.C (= middelpunt) helpen bij de inhoud van het midden. */

const Cirkel = (function(){
  const ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const SOLF = ['do','ra','re','me','mi','fa','fi','sol','le','la','te','ti'];
  const S = 480, C = 240, R = 180, NR = R + 56;          // R groot t.o.v. het midden: bollen ruim uit elkaar
  const pos = (j, r) => { const a = (-90 + 30 * j) * Math.PI / 180; return [+(C + r * Math.cos(a)).toFixed(1), +(C + r * Math.sin(a)).toFixed(1)]; };
  const esc = s => String(s == null ? '' : s).replace(/"/g, '&quot;');

  function icon(kind){
    return kind === 'stop'
      ? `<rect x="${C - 13}" y="${C - 13}" width="26" height="26" rx="4" class="kcico"/>`
      : `<path d="M${C - 10} ${C - 17} L${C + 17} ${C} L${C - 10} ${C + 17} Z" class="kcico" stroke-linejoin="round"/>`;
  }

  function draw(el, o){
    if (!el) return;
    const id = o.id || 'kc', col = o.color, deg = o.degree, name = o.name || (() => ''), dot = o.dot || (() => ({}));
    let h = `<svg viewBox="0 0 ${S} ${S}" class="kc" role="group" aria-label="${esc(o.label || 'Kwintencirkel')}"><defs>`;
    ORDER.forEach((s, j) => {                         // kleurverloop tussen twee buren op de ring
      const [x1, y1] = pos(j, R), [x2, y2] = pos(j + 1, R);
      h += `<linearGradient id="${id}g${j}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${col(s)}"/><stop offset="1" stop-color="${col(ORDER[(j + 1) % 12])}"/></linearGradient>`;
    });
    h += `</defs>`;
    ORDER.forEach((s, j) => {
      const [x1, y1] = pos(j, R), [x2, y2] = pos(j + 1, R);
      h += `<path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}" class="kcarc" stroke="url(#${id}g${j})"/>`;
    });
    ORDER.forEach((s, j) => {
      const d = dot(s) || {}, [x, y] = pos(j, R), [nx, ny] = pos(j, NR), r = s === 0 ? 36 : 33, click = d.click !== false;
      const cls = ['kcdot', d.fill ? 'fill' : 'ring', d.faint ? 'faint' : '', click ? 'click' : '', d.mark || '', s === 0 ? 'root' : ''].filter(Boolean).join(' ');
      h += `<g class="${cls}" data-s="${s}" style="--c:${col(s)}"${click ? ' tabindex="0" role="button"' : ''} aria-label="${esc(d.aria || 'trap ' + deg(s))}">`
        + (d.title ? `<title>${d.title}</title>` : '')
        + (d.pulse ? `<circle cx="${x}" cy="${y}" r="${r + 9}" class="kchalo"/><circle cx="${x}" cy="${y}" r="${r + 2}" class="kcpulse"/>` : '')
        + (d.mark === 'wrong' ? `<circle cx="${x}" cy="${y}" r="${r + 9}" class="kcmiss"/>` : '')
        + `<circle cx="${x}" cy="${y}" r="${r}" class="kcbody"/>`
        + `<text x="${x}" y="${(y - 6).toFixed(1)}" class="kcdg">${deg(s)}</text>`
        + `<text x="${x}" y="${(y + 17).toFixed(1)}" class="kcsl">${SOLF[s]}</text>`
        + `<text x="${nx}" y="${ny}" class="kcnm">${name(s)}</text></g>`;
    });
    const c = o.center || {};
    if (c.clock){                                    // aftelring rond het midden (wentijd / tijdlimiet)
      h += `<circle cx="${C}" cy="${C}" r="73" class="kcclock${c.clock.warm ? ' warm' : ''}" pathLength="100" transform="rotate(-90 ${C} ${C})" style="animation-duration:${c.clock.dur}s;animation-delay:${(-(c.clock.el || 0)).toFixed(2)}s"/>`;
    }
    h += `<g class="kcmid" tabindex="0" role="button" aria-label="${esc(c.aria || c.title || 'Midden')}">${c.title ? `<title>${c.title}</title>` : ''}<circle cx="${C}" cy="${C}" r="62"/>${c.html || ''}</g></svg>`;
    el.innerHTML = h;
    el.querySelectorAll('.kcdot.click').forEach(g => {
      const s = +g.dataset.s;
      g.onclick = e => o.onDot && o.onDot(s, e);
      g.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); o.onDot && o.onDot(s, e); } };
    });
    const m = el.querySelector('.kcmid');
    if (c.onClick){ m.onclick = c.onClick; m.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); c.onClick(); } }; }
  }

  return { draw, icon, C, ORDER, SOLF };
})();
