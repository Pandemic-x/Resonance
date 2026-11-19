/* ================= Opgenomen klanken (samples) =================
   Echte instrumentopnames uit de vooraf gerenderde General MIDI-soundfonts van Benjamin Gleitzman
   (midi-js-soundfonts): eerst MusyngKite (CC BY-SA 3.0), anders FluidR3_GM (CC BY 3.0). Geladen als <script>
   (MIDI.js-formaat: MIDI.Soundfont[naam] = {'C4': 'data:audio/mp3;base64,…'}), via jsDelivr of GitHub Pages.
   Lukt laden niet (offline, geblokkeerd), dan gebruikt de engine gewoon de nagebouwde klanken.

   Samples.load(inst)                    soundfont van een app-klank laden (piano, strijker, gitaar, orgel, fluit, koper, marimba).
   Samples.play(inst, t, midi, dur, v, bus)  speelt de opname als die klaar is → true; anders false (engine valt terug op synth).
   Samples.loop(inst, midi)             naadloos herhalende buffer (voor de drone) of null (vraagt het decoderen aan).
   Samples.whenReady(inst, midis, fn)   fn() zodra al deze tonen gedecodeerd zijn.
   Samples.variant(inst, v)             variant van een klank (viool: 'normaal' | 'weinig' | 'uit' vibrato), opslag 'viool-vibrato'.
   Samples.ready(inst, midis)           true als ze klaar zijn (of als er geen opname komt: uit / mislukt / synth-klank).
   Samples.enabled(v) / status(inst) / onChange(fn) / ctxReady()   (ctxReady roept de engine aan zodra er een AudioContext is)
   Opslag: 'samples-aan' ('0' = uit). */
const Samples = (function(){
  const KEY = 'samples-aan';
  let on = true;
  try { on = localStorage.getItem(KEY) !== '0'; } catch(e){}
  const GM = { piano:'acoustic_grand_piano', strijker:'violin', gitaar:'acoustic_guitar_nylon', orgel:'church_organ',
               fluit:'flute', koper:'french_horn', marimba:'marimba', cello:'cello', viooliowa:'violin_iowa' };
  const BASES = [
    ['MusyngKite', 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@master/MusyngKite/'],
    ['MusyngKite', 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/'],
    ['FluidR3_GM', 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@master/FluidR3_GM/'],
    ['FluidR3_GM', 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/']
  ];
  // eigen kopieën in de app zelf (zelfde herkomst → laden altijd, ook offline); gaan vóór de externe bronnen
  const LOCAL = { orgel:['MusyngKite (in de app)', 'sounds/church_organ-mp3.js'], piano:['Salamander-vleugel (in de app)', 'sounds/salamander-piano-mp3.js'],
                  cello:['VSCO 2 cello-sectie (in de app)', 'sounds/vsco-cello-mp3.js'],
                  strijker:['VSCO 2 soloviool (in de app)', 'sounds/vsco-violin-v4-mp3.js'],
                  viooliowa:['Iowa-viool (in de app)', 'sounds/iowa-violin-v3-mp3.js'] };   // elke halve toon G3–E7, per snaar   // soloviool, arco vibrato, G3–C7 (15 tonen)
  const ONLY_LOCAL = { cello:true, strijker:true, viooliowa:true };
  // NB: bij een nieuwe versie van een opname de bestandsnaam veranderen (v4 …), anders speelt de browser de oude uit zijn cache.
  // varianten van een klank (alleen in de app): viool met normaal / weinig / geen vibrato. Keuze in localStorage, geldt overal.
  const VARIANT = { strijker:{ key:'viool-vibrato', def:'normaal', opts:{
    normaal:['VSCO 2 soloviool (in de app)', 'sounds/vsco-violin-v4-mp3.js', 'violin'],
    weinig:['VSCO 2 soloviool, weinig vibrato (in de app)', 'sounds/vsco-violin-v50-v4-mp3.js', 'violin_v50'],
    uit:['VSCO 2 soloviool, zonder vibrato (in de app)', 'sounds/vsco-violin-v0-v4-mp3.js', 'violin_v0'] } }
    // Iowa-viool: geen varianten. Vibrato weghalen lukte daar niet betrouwbaar (toonhoogte bij deze opnames te onrustig te meten;
    // een onafhankelijke YIN-meting liet bij sommige noten zelfs méér golving zien na de correctie).
  };
  function varOf(inst){
    const V = VARIANT[inst]; if (!V) return null;
    let v = V.def; try { v = localStorage.getItem(V.key) || V.def; } catch(e){}
    return V.opts[v] ? v : V.def;
  }
  const LOOP = { cello:{ start:.6, fade:.35 } };            // lusinstellingen per klank (standaard start .35 s, overvloei .2 s)
  const VOL = { piano:.85, strijker:.8, viooliowa:.8 };
  const PEAK = { strijker:.4, viooliowa:.4 };                            // vaste piek: opnames zijn vooraf gelijk van sterkte gemaakt (per-noot-piek gaf ongelijk volume)                               // piek-genormaliseerd × v × deze factor
  const REL = { piano:.35, gitaar:.4, marimba:.35, strijker:.18, viooliowa:.22 };
  const REV = { viooliowa:1, strijker:.35 };   // aandeel naar de notengalm (Engine.noteRev): Iowa is droog opgenomen      // uitklinktijd na de nootduur (rest: .12 s)
  // Strijkers met een trage aanzet (Iowa: eerste geluid na 10–130 ms, half zo luid pas na 0,1–1 s). Korte noten zouden dan al
  // voorbij zijn vóór ze klinken (afgekapt en te laat). Daarom per opname het aanzetpunt meten en korte noten later in de opname
  // laten beginnen (met een korte fade-in); lange noten houden de natuurlijke aanzet, alleen zonder de stilte ervoor.
  const ATT = { viooliowa:true };
  function attack(buf){
    const d = buf.getChannelData(0), sr = buf.sampleRate, w = Math.max(1, Math.floor(sr * .01)), n = Math.min(d.length, Math.floor(sr * 2));
    const r = [];
    for (let i = 0; i + w <= n; i += w){ let a = 0; for (let k = i; k < i + w; k++) a += d[k] * d[k]; r.push(Math.sqrt(a / w)); }
    const pk = Math.max(...r, 1e-9), at = f => { const j = r.findIndex(x => x >= pk * f); return j < 0 ? 0 : j * w / sr; };
    return { a:Math.max(0, at(.05) - .005), b:at(.5) };
  }
  // Lang aangehouden noten: de opnames zijn maar 1,5–6 s lang (daarna stopt de streek). Het bestand geeft per toon een
  // lus-stuk [begin, eind] uit het rustige midden; het eind wordt hier in de buffer zelf overgevloeid in wat vlak vóór het
  // lusbegin klinkt, zodat de buffer-lus (loopStart/loopEnd) naadloos is. Normale noten merken daar niets van.
  function sustainLoop(buf, pts){
    const sr = buf.sampleRate, a = Math.floor(pts[0] * sr), b = Math.min(buf.length, Math.floor(pts[1] * sr)), F = Math.floor(sr * .25);
    if (b - a < sr * .5 || a < F) return null;
    for (let c = 0; c < buf.numberOfChannels; c++){
      const d = buf.getChannelData(c);
      for (let j = 0; j < F; j++){ const w = j / F; d[b - F + j] = d[b - F + j] * Math.cos(w * Math.PI / 2) + d[a - F + j] * Math.sin(w * Math.PI / 2); }
    }
    return [a / sr, b / sr];
  }
  // galm per klank: 0–100 %, 45 = standaard (REV hieronder). Opslag 'noot-galm-<klank>'.
  function reverb(inst, pct){
    const key = 'noot-galm-' + inst;
    if (pct != null){ pct = Math.max(0, Math.min(100, +pct)); try { localStorage.setItem(key, String(pct)); } catch(e){} return pct; }
    let v = NaN; try { v = parseFloat(localStorage.getItem(key)); } catch(e){}
    return v >= 0 && v <= 100 ? v : 45;
  }
  const NN = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  const name = m => NN[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const st = {}, listeners = [];
  let warmQ = [];
  const fire = () => listeners.forEach(fn => { try { fn(); } catch(e){} });

  function load(inst){
    const vv = varOf(inst), gm = vv ? VARIANT[inst].opts[vv][2] : GM[inst];
    if (!gm || !on || st[inst]) return;
    const s = st[inst] = { state:'loading', buf:{}, pend:{}, peak:{}, att:{}, lp:{}, loops:{}, waits:[], vv };
    fire();
    const srcs = vv ? [VARIANT[inst].opts[vv].slice(0, 2)]
      : (LOCAL[inst] ? [LOCAL[inst]] : []).concat(ONLY_LOCAL[inst] ? [] : BASES.map(b => [b[0], b[1] + gm + '-mp3.js']));
    (function attempt(i){
      if (i >= srcs.length){ s.state = 'fail'; fire(); return; }
      const el = document.createElement('script');
      el.src = srcs[i][1];
      el.onload = () => {
        const d = window.MIDI && MIDI.Soundfont && MIDI.Soundfont[gm];
        if (!d){ attempt(i + 1); return; }
        s.data = d; s.lpts = (MIDI.SoundfontLoops && MIDI.SoundfontLoops[gm]) || null; s.set = srcs[i][0]; s.state = 'ok'; fire();
        s.waits.forEach(w => w.ms.forEach(m => decode(inst, srcNote(inst, m))));   // eerst wat al gevraagd is (bv. de drone)
        warm(inst);
      };
      el.onerror = () => attempt(i + 1);
      document.head.appendChild(el);
    })(0);
  }
  // vooraf decoderen, één voor één (geen hapering): klanken met weinig opgenomen tonen (viool, piano, cello) helemaal,
  // vanuit het midden naar buiten; volle soundfonts alleen het middenregister 48–84
  const midiOf = n => { const r = /^([A-G])(b|#)?(-?\d)$/.exec(n); if (!r) return null;
    return 12 * (+r[3] + 1) + [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(r[1])] + (r[2] === 'b' ? -1 : r[2] === '#' ? 1 : 0); };
  function warm(inst){
    const s = st[inst], all = Object.keys(s.data || {}).map(midiOf).filter(m => m != null);
    const ms = (all.length > 40 ? all.filter(m => m >= 48 && m <= 84) : all).sort((a, b) => Math.abs(a - 66) - Math.abs(b - 66));
    ms.forEach(m => warmQ.push([inst, m]));
    pump();
  }
  // klaar = elke gevraagde toon heeft zijn (dichtstbijzijnde) opname gedecodeerd; tonen zonder opname in de buurt tellen niet
  function hasSrc(s, inst, m){ const sm = srcNote(inst, m); return !s.data[name(sm)] || !!s.buf[sm]; }
  function ready(inst, ms){
    if (!on || !GM[inst]) return true;
    const s = st[inst]; if (!s){ load(inst); return false; }
    if (s.state === 'fail') return true;
    if (s.state !== 'ok') return false;
    return ms.every(m => hasSrc(s, inst, m));
  }
  let pumping = false;
  function pump(){
    if (pumping || typeof actx === 'undefined' || !actx) return;
    const job = warmQ.shift(); if (!job) return;
    pumping = true;
    decode(job[0], job[1]).then(() => { pumping = false; setTimeout(pump, 15); });
  }
  function decode(inst, m){
    const s = st[inst];
    if (!s || s.state !== 'ok' || s.buf[m] || typeof actx === 'undefined' || !actx) return Promise.resolve();
    if (s.pend[m]) return s.pend[m];
    const uri = s.data[name(m)];
    if (!uri) return Promise.resolve();
    let bytes;
    try {
      const bin = atob(uri.slice(uri.indexOf(',') + 1)); bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch(e){ return Promise.resolve(); }
    const p = new Promise(res => {
      const ok = buf => {
        let pk = 0;
        for (let c = 0; c < buf.numberOfChannels; c++){ const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 2){ const a = Math.abs(d[i]); if (a > pk) pk = a; } }
        s.buf[m] = buf; s.peak[m] = pk || 1; delete s.pend[m];
        if (ATT[inst]) s.att[m] = attack(buf);
        if (s.lpts && s.lpts[name(m)]) s.lp[m] = sustainLoop(buf, s.lpts[name(m)]);
        s.waits = s.waits.filter(w => { if (w.ms.every(x => hasSrc(s, inst, x))){ try { w.fn(); } catch(e){} return false; } return true; });
        res();
      };
      const bad = () => { delete s.pend[m]; res(); };
      try { const r = actx.decodeAudioData(bytes.buffer, ok, bad); if (r && r.catch) r.catch(bad); } catch(e){ bad(); }
    });
    s.pend[m] = p;
    return p;
  }
  // beste buffer voor toon m: precies, of een buur tot 4 halve tonen ver (met afspeelsnelheid); vraagt de precieze toon aan
  function pick(inst, m){
    const s = st[inst];
    if (!s || s.state !== 'ok') return null;
    if (!s.buf[m]){
      if (s.data[name(m)]) decode(inst, m);
      else for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) if (s.data[name(m + d)]){ decode(inst, m + d); break; }   // alleen elke paar tonen opgenomen
    }
    for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4]){
      const b = s.buf[m + d];
      if (b) return { buf:b, rate:Math.pow(2, -d / 12), peak:s.peak[m + d], att:s.att[m + d], lp:s.lp[m + d] };
    }
    return null;
  }
  function play(inst, t, m, dur, v, bus){
    if (!on || !GM[inst]) return false;
    if (!st[inst]){ load(inst); return false; }
    const p = pick(inst, m);
    if (!p) return false;
    const src = actx.createBufferSource(), g = actx.createGain(), rel = REL[inst] || .12;
    src.buffer = p.buf; src.playbackRate.value = p.rate;
    const vol = v * (VOL[inst] || .7) / (PEAK[inst] || p.peak);
    let off = 0;
    if (p.att){   // korte noot (< 0,25 s) begint bij half-luid, lange (> 0,7 s) bij het eerste geluid, daartussen geleidelijk
      const k = Math.max(0, Math.min(1, (.7 - dur) / .45));
      off = Math.min(p.att.a + (p.att.b - p.att.a) * k, p.buf.duration - .3);
    }
    if (off > .002){ g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); }
    else g.gain.setValueAtTime(vol, t);
    let end = Math.max(t + .02, Math.min(t + dur, t + (p.buf.duration - off) / p.rate));
    if (p.lp && off < p.lp[1] - .05 && t + dur > t + (p.lp[1] - off) / p.rate - .05){   // langer dan de opname: lus
      src.loop = true; src.loopStart = p.lp[0]; src.loopEnd = p.lp[1]; end = t + dur;
    }
    g.gain.setValueAtTime(vol, end); g.gain.setTargetAtTime(.0001, end, rel / 3);
    src.connect(g).connect(bus);
    let rs = null;
    if (REV[inst] && typeof Engine !== 'undefined' && Engine.noteRev){ const ri = Engine.noteRev(), rv = REV[inst] * reverb(inst) / 45; if (ri && rv > 0){ rs = actx.createGain(); rs.gain.value = rv; g.connect(rs).connect(ri); } }
    src.start(t, off); src.stop(end + rel + .2);
    src.onended = () => { try { g.disconnect(); if (rs) rs.disconnect(); } catch(e){} };
    return true;
  }
  // dichtstbijzijnde toon die in de soundfont staat (sommige klanken hebben alleen elke 2–3 halve tonen; tot 7 ver)
  function srcNote(inst, m){
    const s = st[inst]; if (!s || !s.data) return m;
    for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7]) if (s.data[name(m + d)]) return m + d;
    return m;
  }
  // naadloze lus uit het stabiele middenstuk: het einde wordt overgevloeid in wat vlak vóór het lusbegin klinkt.
  // Geeft {buf, peak, rate}: rate ≠ 1 als de toon van een buurtoon is afgeleid.
  function loop(inst, m){
    const s = st[inst];
    if (!on || !s || s.state !== 'ok') return null;
    const sm = srcNote(inst, m), rate = Math.pow(2, (m - sm) / 12);
    if (s.loops[sm]) return { buf:s.loops[sm].buf, peak:s.loops[sm].peak, rate };
    const b = s.buf[sm];
    if (!b){ decode(inst, sm); return null; }
    const opt = LOOP[inst] || {}, sr = b.sampleRate, d0 = b.getChannelData(0), win = Math.floor(sr * .05);
    const rms = i => { let a = 0; for (let k = i; k < i + win && k < d0.length; k++) a += d0[k] * d0[k]; return Math.sqrt(a / win); };
    const start = Math.floor(sr * (opt.start || .35));
    const ref = rms(start);
    let end = start;
    for (let i = start; i + win < d0.length; i += win){ if (rms(i) < ref * .3) break; end = i + win; }
    end -= Math.floor(sr * .08);                                     // mp3-opvulling / uitfade aan het eind overslaan
    const F = Math.floor(sr * (opt.fade || .2)), L = end - start;
    if (L < sr * .8 || start < F) return null;                     // te kort om naadloos te herhalen
    const out = actx.createBuffer(b.numberOfChannels, L, sr);
    for (let c = 0; c < b.numberOfChannels; c++){
      const src = b.getChannelData(c), dst = out.getChannelData(c);
      for (let i = 0; i < L; i++) dst[i] = src[start + i];
      for (let j = 0; j < F; j++){
        const w = j / F, a = Math.cos(w * Math.PI / 2), z = Math.sin(w * Math.PI / 2);   // gelijke energie
        dst[L - F + j] = src[start + L - F + j] * a + src[start - F + j] * z;
      }
    }
    s.loops[sm] = { buf:out, peak:s.peak[sm] };
    return { buf:out, peak:s.peak[sm], rate };
  }
  function whenReady(inst, ms, fn){
    const s = st[inst]; if (!s) return;
    if (s.state === 'ok' && ms.every(m => hasSrc(s, inst, m))){ setTimeout(fn, 0); return; }
    s.waits.push({ ms, fn });
    ms.forEach(m => decode(inst, srcNote(inst, m)));
  }
  function enabled(v){
    if (v != null){ on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){} fire(); }
    return on;
  }
  // variant kiezen ('normaal' | 'weinig' | 'uit' bij strijker); zonder v: de huidige. Bij wisselen wordt de klank opnieuw geladen.
  function variant(inst, v){
    const V = VARIANT[inst]; if (!V) return null;
    if (v != null && V.opts[v] && (v !== varOf(inst) || (st[inst] && st[inst].vv !== v))){
      try { localStorage.setItem(V.key, v); } catch(e){}
      delete st[inst]; warmQ = warmQ.filter(j => j[0] !== inst);
      load(inst); fire();
    }
    return varOf(inst);
  }
  function status(inst){ const s = st[inst]; return !GM[inst] ? 'synth' : !s ? 'niet geladen' : s.state === 'ok' ? 'ok:' + s.set : s.state; }
  function ctxReady(){ pump(); }
  return { load, play, loop, whenReady, ready, variant, reverb, enabled, status, onChange:fn => listeners.push(fn), ctxReady, GM };
})();
