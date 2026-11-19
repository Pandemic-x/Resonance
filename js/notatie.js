/* ================= Notatie-kern (gedeeld, `Notatie`) =================
   Eén plek voor notenschrift in de hele app, zoals Cirkel en Paneel. Bouwt op VexFlow (geladen door main.js).
   Gebruikt door: Notenleer (noten benoemen). Later over te zetten: Melodisch dictee (mDrawStaff), Atlas/Tikken/
   Ritme luisteren (drawCell in ritme.js), sight-read factory, transcriberen.

   Toonhoogte  p = {l:'c'…'b', a:-2…2, o:octaaf}   (C4 = centrale C = midi 60)
     Notatie.ready(fn)            fn draait zodra VexFlow er is (meteen als hij er al is). main.js roept Notatie._loaded().
     Notatie.parse('fis5'|'F#5'|'Bb3')  → p          Notatie.code(p) → 'f#5' (korte vaste sleutel, bv. voor Score)
     Notatie.midi(p)              → midi-nummer      Notatie.spell(midi, key) → p, juist gespeld in toonsoort key ('C', 'D', 'Bb', 'F#m' …)
     Notatie.name(p, stijl, oct)  stijl 'nl' (Fis, Bes, Es) | 'en' (F♯, B♭); oct = true → met octaafnummer
     Notatie.keySig(key)          → {c:0, f:1, …} voortekening per letter;  Notatie.fifths(key) → aantal ♯ (+) of ♭ (−)
     Notatie.pos(p, clef)         plaats op de balk: 0 = onderste lijn, 8 = bovenste, even = lijn, oneven = tussenruimte
     Notatie.atPos(pos, clef)     → stamtoon (zonder voorteken) op die plaats
     Notatie.CLEFS                g viool, f bas, c1 sopraan, c2 mezzosopraan, c3 alt (ook 'c'), c4 tenor, c5 bariton (C-sleutel)
                                  elk {vf, naam, kort, bottom}
   Tekenen
     h = Notatie.draw(el, {clef:'g'|'f'|'c1'…'c5'|'grand', key:'D', time:'3/4',
                          notes:[{p} | {ps:[p, …]} (akkoord), dur:'w'|'h'|'q'|'8'|'16' (+'d' = gepunteerd), label, rest,
                                 staff:'g'|'f' (alleen bij grand = pianobalk met accolade)}],
                          range:[minPos, maxPos] of {g:[…], f:[…]} (vaste hoogte, zodat de balk niet verspringt),
                          width, zoom, maxHeight, acc:'auto'|'all'})
       De hoogte groeit mee met het bereik (hulplijnen); h.size = {W, H}.
       acc 'auto' = voortekens volgens toonsoort + onthouden binnen de maat (zoals gedrukte muziek).
       Kleur: alles in currentColor (= --ink), dus goed in licht én donker; geen invert-filter nodig.
       h.mark(i, 'ok'|'bad'|'hint'|'cur')  noot i laten oplichten (CSS-class nt-ok / nt-bad / nt-hint / nt-cur)
       h.unmark(i, cls) · h.clear() · h.noteEl(i) · h.notes (de invoer) · h.svg
       Zonder VexFlow (nog aan het laden) tekent draw een melding en tekent opnieuw zodra hij er is (zelfde h).
     Notatie.play(h, {bpm, inst, vol, from})  speelt de noten via Engine, de klinkende noot krijgt 'cur'; → stop-functie
   Vraagstof
     Notatie.pool({clefs, up, down, acc, dbl, key})  alle noten in die sleutels/hulplijnen (+ losse ♯/♭, 𝄪/𝄫), juist in de
                                  toonsoort, binnen A0–C8
     Notatie.KEYLIST              majeurtoonsoorten in kwintvolgorde [{id, n, p}]
   Invoer
     k = Notatie.klavier(el, {lo, hi, onKey(midi), names:'all'|'c'|'none', key})  pianoklavier
       k.mark(midi, 'right'|'wrong'|'picked') · k.clear() · k.set({lo, hi, names, key})
   Later (API is erop voorbereid): klikken op de balk (pos → p via atPos). */

const Notatie = (function(){
  const LET = ['c','d','e','f','g','a','b'];
  const NAT = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };
  // bottom = toon op de onderste lijn. C-sleutels: c1 = C4 op lijn 1 (van onder) … c5 = C4 op lijn 5.
  const CLEFS = {
    g: { vf:'treble',        naam:'vioolsleutel',       kort:'viool',     bottom:{ l:'e', a:0, o:4 } },
    f: { vf:'bass',          naam:'bassleutel',         kort:'bas',       bottom:{ l:'g', a:0, o:2 } },
    c1:{ vf:'soprano',       naam:'sopraansleutel',     kort:'sopraan',   bottom:{ l:'c', a:0, o:4 } },
    c2:{ vf:'mezzo-soprano', naam:'mezzosopraansleutel', kort:'mezzo',    bottom:{ l:'a', a:0, o:3 } },
    c3:{ vf:'alto',          naam:'altsleutel',         kort:'alt',       bottom:{ l:'f', a:0, o:3 } },
    c4:{ vf:'tenor',         naam:'tenorsleutel',       kort:'tenor',     bottom:{ l:'d', a:0, o:3 } },
    c5:{ vf:'baritone-c',    naam:'baritonsleutel',     kort:'bariton',   bottom:{ l:'b', a:0, o:2 } }
  };
  CLEFS.c = CLEFS.c3;   // oude naam voor de altsleutel
  const MAJ = { C:0, G:1, D:2, A:3, E:4, B:5, 'F#':6, 'C#':7, F:-1, Bb:-2, Eb:-3, Ab:-4, Db:-5, Gb:-6, Cb:-7 };
  const MIN = { A:0, E:1, B:2, 'F#':3, 'C#':4, 'G#':5, 'D#':6, 'A#':7, D:-1, G:-2, C:-3, F:-4, Bb:-5, Eb:-6, Ab:-7 };
  const SHARPS = 'fcgdaeb', FLATS = 'beadgcf';

  /* --- laden --- */
  const waiting = [];
  const vf = () => (typeof Vex !== 'undefined' && Vex.Flow) ? Vex.Flow : null;
  function ready(fn){ if (vf()) { try { fn(); } catch(e){ console.error(e); } } else waiting.push(fn); }
  function _loaded(){ while (waiting.length){ const f = waiting.shift(); try { f(); } catch(e){ console.error(e); } } }

  /* --- toonhoogte --- */
  function parse(s){
    const m = /^([a-gA-G])(isis|eses|ses|is|es|s|##|bb|#|b|♯|♭|𝄪|𝄫|x)?(-?\d)$/.exec(String(s).trim());
    if (!m) return null;
    const l = m[1].toLowerCase(), acc = m[2] || '';
    const a = { isis:2, '##':2, x:2, '𝄪':2, eses:-2, ses:-2, bb:-2, '𝄫':-2, is:1, '#':1, '♯':1, es:-1, s:-1, b:-1, '♭':-1 }[acc] || 0;
    return { l, a, o:+m[3] };
  }
  const midi = p => (p.o + 1) * 12 + NAT[p.l] + p.a;
  const code = p => p.l + (p.a > 0 ? '#'.repeat(p.a) : 'b'.repeat(-p.a)) + p.o;
  function fifths(key){
    key = key || 'C';
    const minor = /m$/.test(key), k = minor ? key.slice(0, -1) : key;
    const n = (minor ? MIN : MAJ)[k];
    return n == null ? 0 : n;
  }
  function keySig(key){
    const n = fifths(key), sig = { c:0, d:0, e:0, f:0, g:0, a:0, b:0 };
    for (let i = 0; i < Math.abs(n); i++) sig[(n > 0 ? SHARPS : FLATS)[i]] = n > 0 ? 1 : -1;
    return sig;
  }
  // gewone chromatische spelling als de toon niet in de toonsoort zit: in C/kruis-toonsoorten C♯ E♭ F♯ A♭ B♭ (C), anders volgens de toonsoort
  const CHROM_C = { 1:['c',1], 3:['e',-1], 6:['f',1], 8:['a',-1], 10:['b',-1] };
  function spell(m, key){
    const pc = ((m % 12) + 12) % 12, sig = keySig(key), n = fifths(key);
    const cands = LET.map(l => { let a = ((pc - NAT[l]) % 12 + 18) % 12 - 6; return { l, a }; }).filter(c => Math.abs(c.a) <= 2);
    let c = cands.find(c => c.a === sig[c.l]);                       // toon uit de toonsoort
    if (!c) c = cands.find(c => c.a === 0);                           // stamtoon (bv. F in D-groot)
    if (!c && n === 0 && CHROM_C[pc]) c = { l:CHROM_C[pc][0], a:CHROM_C[pc][1] };
    if (!c) c = cands.filter(c => Math.abs(c.a) === 1).sort((x, y) => (n > 0 ? y.a - x.a : x.a - y.a))[0] || cands[0];
    return { l:c.l, a:c.a, o:Math.round((m - c.a - NAT[c.l]) / 12) - 1 };
  }
  function name(p, stijl, oct){
    const L = p.l, a = p.a;
    let s;
    if (stijl === 'en') s = L.toUpperCase() + (a === 1 ? '♯' : a === 2 ? '𝄪' : a === -1 ? '♭' : a === -2 ? '𝄫' : '');
    else {
      const flat = (L === 'e' || L === 'a') ? L + 's' : L + 'es';
      s = a === 1 ? L + 'is' : a === 2 ? L + 'isis' : a === -1 ? flat : a === -2 ? flat + 'es' : L;
      s = s[0].toUpperCase() + s.slice(1);
    }
    return s + (oct ? p.o : '');
  }
  const dia = p => p.o * 7 + LET.indexOf(p.l);
  const pos = (p, clef) => dia(p) - dia(CLEFS[clef || 'g'].bottom);
  function atPos(n, clef){ const d = dia(CLEFS[clef || 'g'].bottom) + n; return { l:LET[((d % 7) + 7) % 7], a:0, o:Math.floor(d / 7) }; }

  /* --- tekenen --- */
  const BEATS = { w:4, h:2, q:1, '8':.5, '16':.25, '32':.125 };
  const beats = d => { const dot = /d$/.test(d), b = BEATS[d.replace(/d$/, '')] || 1; return dot ? b * 1.5 : b; };
  const vfKey = p => p.l + (p.a > 0 ? '#'.repeat(p.a) : 'b'.repeat(-p.a)) + '/' + p.o;
  const accSym = a => a === 0 ? 'n' : a === 1 ? '#' : a === -1 ? 'b' : a === 2 ? '##' : 'bb';

  function draw(el, o){
    const h = { el, o, notes:o.notes || [], vf:[], svg:null, marks:{} };
    h.noteEl = i => {
      const sn = h.vf[i]; if (!sn) return null;
      try { return (sn.getSVGElement && sn.getSVGElement()) || document.getElementById('vf-' + sn.getAttribute('id')); } catch(e){ return null; }
    };
    h.mark = (i, cls) => { (h.marks[i] = h.marks[i] || new Set()).add(cls); const e = h.noteEl(i); if (e) e.classList.add('nt-' + cls); };
    h.unmark = (i, cls) => { if (h.marks[i]) h.marks[i].delete(cls); const e = h.noteEl(i); if (e) e.classList.remove('nt-' + cls); };
    h.clear = () => { Object.keys(h.marks).forEach(i => h.marks[i].forEach(c => { const e = h.noteEl(+i); if (e) e.classList.remove('nt-' + c); })); h.marks = {}; };
    h.redraw = () => render(h);
    render(h);
    return h;
  }
  // ruimte (px, bij lijnafstand 10) boven de bovenste en onder de onderste lijn voor posities minP…maxP
  const room = (minP, maxP) => ({ above:Math.max(24, (maxP - 8) * 5 + 18), below:Math.max(28, -minP * 5 + 22) });
  function render(h){
    const el = h.el, o = h.o, VF = vf();
    el.classList.add('ntstaff');
    el.innerHTML = '';
    if (!VF){ el.innerHTML = '<p class="note">Notenschrift laden…</p>'; ready(() => { if (h.el.isConnected) render(h); }); return; }
    const grand = o.clef === 'grand';
    const clefs = grand ? ['g', 'f'] : [CLEFS[o.clef] ? o.clef : 'g'];
    const key = o.key || 'C', nKey = Math.abs(fifths(key));
    const notes = h.notes, staffOf = n => grand ? (n.staff === 'f' ? 'f' : 'g') : clefs[0];
    const x0 = grand ? 24 : 0;
    const W = o.width || Math.max(150, 80 + nKey * 11 + (o.time ? 26 : 0) + notes.length * 46);
    // hoogte: vast bereik (o.range = [min, max] of per balk {g:[…], f:[…]}) of uit de noten zelf
    const geo = clefs.map(c => {
      let r = o.range ? (Array.isArray(o.range) ? o.range : o.range[c]) : null;
      if (!r){ r = [0, 8]; notes.forEach(n => { if (staffOf(n) !== c) return; (n.ps || (n.p ? [n.p] : [])).forEach(p => { const q = pos(p, c); r = [Math.min(r[0], q), Math.max(r[1], q)]; }); }); }
      return room(r[0], r[1]);
    });
    const ys = []; let y = 0;
    geo.forEach((g, i) => { y += g.above; ys.push(y); y += 40 + g.below; });
    const H = o.height || Math.round(y);
    const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();
    try { ctx.setFillStyle('currentColor'); ctx.setStrokeStyle('currentColor'); } catch(e){}
    const staves = clefs.map((c, i) => {
      const st = new VF.Stave(x0, ys[i], W - 2 - x0, { space_above_staff_ln:0 });
      st.addClef(CLEFS[c].vf);
      if (nKey) { try { st.addKeySignature(key); } catch(e){} }
      if (o.time) st.addTimeSignature(o.time);
      st.setContext(ctx).draw();
      return st;
    });
    if (grand){
      try {
        new VF.StaveConnector(staves[0], staves[1]).setType(VF.StaveConnector.type.BRACE).setContext(ctx).draw();
        new VF.StaveConnector(staves[0], staves[1]).setType(VF.StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
      } catch(e){ console.error(e); }
    }
    h.vf = []; h.size = { W, H };
    const sig = keySig(key);
    const voices = [];
    clefs.forEach((c, si) => {
      const mine = notes.map((n, i) => ({ n, i })).filter(x => x.n.bar || staffOf(x.n) === c);
      if (!mine.some(x => !x.n.bar)) return;
      let barAcc = {}, total = 0;
      const tick = mine.map(({ n, i }) => {
        if (n.bar){ barAcc = {}; return new VF.BarNote(); }
        const dur = n.dur || 'q', ps = n.ps || (n.p ? [n.p] : []);
        const keys = n.rest ? [vfKey(atPos(4, c))] : ps.map(vfKey);
        const sn = new VF.StaveNote({ clef:CLEFS[c].vf, keys, duration:dur + (n.rest ? 'r' : ''), auto_stem:true });
        if (/d$/.test(dur)) VF.Dot.buildAndAttach([sn], { all:true });
        if (!n.rest) ps.forEach((p, j) => {
          const bk = p.l + p.o, cur = barAcc[bk] != null ? barAcc[bk] : sig[p.l];
          if (o.acc === 'all' || p.a !== cur){ sn.addModifier(new VF.Accidental(accSym(p.a)), j); barAcc[bk] = p.a; }
        });
        if (n.label){
          const an = new VF.Annotation(n.label); an.setFont('Inter', 12, 'normal');
          an.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
          sn.addModifier(an, 0);
        }
        total += beats(dur);
        h.vf[notes.slice(0, i).filter(x => !x.bar).length] = sn;
        return sn;
      });
      const voice = new VF.Voice({ num_beats:Math.max(1, Math.ceil(total)), beat_value:4 }).setMode(VF.Voice.Mode.SOFT);
      voice.addTickables(tick);
      voices.push({ voice, stave:staves[si] });
    });
    if (voices.length){
      const fw = Math.max(30, W - Math.max(...staves.map(st => st.getNoteStartX())) - 24);
      try { const f = new VF.Formatter(); voices.forEach(v => f.joinVoices([v.voice])); f.format(voices.map(v => v.voice), fw); }
      catch(e){ voices.forEach(v => new VF.Formatter().joinVoices([v.voice]).format([v.voice], fw)); }
      voices.forEach(v => v.voice.draw(ctx, v.stave));
    }
    const svg = el.querySelector('svg');
    if (svg){
      let zoom = o.zoom || 1;
      if (o.maxHeight) zoom = Math.min(zoom, o.maxHeight / H);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.removeAttribute('width'); svg.removeAttribute('height');
      svg.style.width = '100%'; svg.style.height = 'auto';
      svg.style.maxWidth = Math.round(W * zoom) + 'px';
      h.svg = svg;
    }
    Object.keys(h.marks).forEach(i => h.marks[i].forEach(c => { const e = h.noteEl(+i); if (e) e.classList.add('nt-' + c); }));
  }

  /* --- afspelen met meelopende cursor --- */
  function play(h, opt){
    opt = opt || {};
    const bpm = opt.bpm || 80, sec = 60 / bpm, timers = [];
    if (typeof ensureCtx === 'function') ensureCtx();
    let t = actx.currentTime + .06;
    const t0 = t;
    h.notes.forEach((n, i) => {
      if (n.bar || i < (opt.from || 0)) return;
      const d = beats(n.dur || 'q') * sec;
      if (!n.rest) (n.ps || (n.p ? [n.p] : [])).forEach(p => Engine.note(t, midi(p), Math.max(.25, d * .95), { inst:opt.inst || 'piano', vol:opt.vol || .45 }));
      const vi = h.vf.length ? h.notes.filter((x, j) => j < i && !x.bar).length : -1;
      if (vi >= 0){
        timers.push(setTimeout(() => h.mark(vi, 'cur'), (t - t0) * 1000));
        timers.push(setTimeout(() => h.unmark(vi, 'cur'), (t - t0 + d) * 1000));
      }
      t += d;
    });
    return () => { timers.forEach(clearTimeout); h.vf.forEach((x, i) => h.unmark(i, 'cur')); };
  }

  /* --- pianoklavier --- */
  const isBlack = m => [1,3,6,8,10].includes(((m % 12) + 12) % 12);
  function klavier(el, opt){
    const k = { el, opt:Object.assign({ lo:60, hi:71, names:'all', key:'C' }, opt || {}) };
    k.set = o => { Object.assign(k.opt, o || {}); build(); };
    k.mark = (m, cls) => { const b = el.querySelector('[data-midi="' + m + '"]'); if (b) b.classList.add(cls); };
    k.clear = () => el.querySelectorAll('.ntk').forEach(b => b.classList.remove('right', 'wrong', 'picked'));
    function build(){
      el.classList.add('ntklav'); el.innerHTML = '';
      let lo = k.opt.lo, hi = k.opt.hi;
      while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
      const whites = []; for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
      const wW = 100 / whites.length;
      el.style.setProperty('--ntk-n', whites.length);
      const press = (b, m) => { b.blur(); if (k.opt.onKey) k.opt.onKey(m); };
      whites.forEach((m, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ntk w'; b.dataset.midi = m;
        b.style.left = (i * wW) + '%'; b.style.width = wW + '%';
        const p = spell(m, 'C'), lab = k.opt.names === 'all' ? name(p, 'nl', p.l === 'c' && whites.length > 8)
          : (k.opt.names === 'c' && p.l === 'c') ? name(p, 'nl', true) : '';
        b.innerHTML = '<span>' + lab + '</span>';
        b.setAttribute('aria-label', name(p, 'nl', true));
        b.onclick = () => press(b, m);
        el.appendChild(b);
        if (m + 1 <= hi && isBlack(m + 1)){
          const bk = document.createElement('button'); bk.type = 'button'; bk.className = 'ntk b'; bk.dataset.midi = m + 1;
          bk.style.left = ((i + 1) * wW - wW * .32) + '%'; bk.style.width = (wW * .64) + '%';
          const q = spell(m + 1, 'C'), q2 = spell(m + 1, 'F');
          bk.setAttribute('aria-label', name(q, 'nl') + ' / ' + name(q2, 'nl'));
          bk.title = name(q, 'nl') + ' / ' + name(q2, 'nl');
          bk.onclick = () => press(bk, m + 1);
          el.appendChild(bk);
        }
      });
    }
    build();
    return k;
  }

  /* --- vraagstof: alle noten binnen sleutels + bereik (gedeeld door de Notenleer-oefeningen) --- */
  // o = {clefs:['g','f','c1'…'c5','grand'], up:0–7, down:0–7 hulplijnen, acc:losse ♯/♭, dbl:ook 𝄪/𝄫, key}
  // Alleen tonen binnen het pianobereik A0–C8 (midi 21–108), zodat elke vraag op het klavier en in de klank bestaat.
  // → [{clef, staff, p, m, k}]; k = sleutel(+balk) + ':' + code, bv. 'g:f#5', 'c3:c4', 'pf:g2' (pianobalk, onderste balk)
  const ODD = { e:1, b:1, c:-1, f:-1 };      // E♯ B♯ C♭ F♭ niet als los voorteken
  const ODD2 = { e:2, b:2, c:-2, f:-2 };     // E𝄪 B𝄪 C𝄫 F𝄫 ook niet (komen in de praktijk bijna nooit voor)
  function pool(o){
    const out = [], sig = keySig(o.key || 'C'), up = +o.up || 0, down = +o.down || 0;
    (o.clefs || ['g']).forEach(c => {
      const bals = c === 'grand' ? ['g', 'f'] : [c];
      bals.forEach(b => {
        for (let ps = -1 - 2 * down; ps <= 9 + 2 * up; ps++){
          const n = atPos(ps, b), base = sig[n.l];
          const as = [base], max = o.dbl ? 2 : 1;
          const add = a => { if (Math.abs(a) <= max && !as.includes(a) && ODD[n.l] !== a && ODD2[n.l] !== a) as.push(a); };
          if (o.acc) [base + 1, base - 1].forEach(add);
          if (o.dbl) [2, -2].forEach(add);
          as.forEach(a => {
            const p = { l:n.l, a, o:n.o }, m = midi(p);
            if (m < 21 || m > 108) return;
            out.push({ clef:c, staff:b, p, m, k:(c === 'grand' ? 'p' + b : c) + ':' + code(p) });
          });
        }
      });
    });
    return out;
  }
  // toonsoorten (majeur, kwintenvolgorde) voor keuzelijstjes: [{id:'D', n:2, naam:'D'}] (n = ♯ positief, ♭ negatief)
  const KEYLIST = ['C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab','Db','Gb','Cb'].map(id => ({ id, n:MAJ[id], p:parse(id + '4') }));

  return { ready, _loaded, parse, pool, KEYLIST, midi, code, spell, name, keySig, fifths, pos, atPos, draw, play, klavier, beats,
           CLEFS, LETTERS:LET, NAT, KEYS:Object.keys(MAJ) };
})();
