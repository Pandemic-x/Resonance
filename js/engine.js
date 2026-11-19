/* ================= Audio-engine =================
   Eén gedeelde engine voor alle modules. Nieuwe modules hoeven alleen deze API te kennen.

   Engine.ensure()                      AudioContext maken/hervatten (aanroepen vanuit een klik). Geeft ctx.
   Engine.now()                         huidige audiotijd in seconden.
   Engine.hz(midi)                      MIDI-nummer → frequentie (A4 = 69 = 440 Hz).
   Engine.INSTRUMENTS                   [{id, n}]: piano, strijker (= 'Viool': VSCO-soloviool-opname, synth als terugval), gitaar, orgel, fluit, koper, marimba, sinus.
   Engine.instOptions(selected)         <option>-HTML voor een klank-keuzelijst.
   Engine.note(t, midi, dur, opts)      één toon. opts: {inst:'piano', vol:.42}. t = audiotijd.
   Engine.chord(t, midis, dur, opts)    akkoord (volume wordt verdeeld over de tonen).
   Engine.melody(t, notes, opts)        notes: [{m, d}] met d in seconden. Geeft eindtijd terug.
   Engine.cadence(t, tonic, mode, opts) I–IV–V–I in 'maj' of 'min' rond tonic (MIDI). Geeft duur terug.
   Engine.click(t, kind, len, notesBus) metronoomtik: 'accent' | 'beat' | 'sub' | toon-tik 'up' | 'low' (len = duur).
                                       notesBus = true: tik stopt mee met stopNotes() (handig bij voorafgaande tellen).
   Engine.METRO_SOUNDS / VOICE_SOUNDS   kiesbare tik-klanken. Engine.sounds = {metro, up, low} (onthouden).
   Engine.setSound(role, id) / soundOptions(role) / preview(role)   role = 'metro' | 'up' | 'low'.
   Engine.noise(t, dur)                 ruis (wist het toongeheugen). Geeft duur terug.
   Engine.drone.start(root, opts)       blijvende grondtoon. opts: {fifth:true, octave:false, add:[3,4,…], inst:'orgel'|'cello'|'orgelsynth'|'fluit'|'strijker'|'sinus', vol}.
                                       add = extra tonen in halve tonen boven de grondtoon (meerdere tonen tegelijk).
   Engine.drone.stop() / .on()          drone uit / staat hij aan?
   Engine.drone.reverb(x)               galm op de drone 0–1 (zonder x: huidige waarde). Engine.drone.INSTS = [[id, naam]] voor de keuzelijst.
   Engine.metronome.start(opts)         opts: {bpm, beats:4, sub:1, accent:true, gap:[aan,stil] of null, onBeat(i, t, mute, info)}
                                       + slim: pattern ['a','b','z','x'] per tel, swing, tempo(bar, beat), layout(bar), mute(bar, beat), countIn, onSchedule, ahead. Zie bij de code.
   Engine.metronome.setBpm(bpm) / .set(opts) / .bpm() / .stop() / .running()
   Engine.stopNotes()                   lopende tonen snel uitfaden (drone en metronoom blijven).
   Engine.stopAll()                     alles stil, ook drone en metronoom.
   Engine.volume(v)                     hoofdvolume 0..1 (wordt onthouden).

   Alles loopt via: tonen → notenbus → master → compressor → luidspreker.
   De drone en de metronoom hebben een eigen bus, zodat stopNotes() ze niet raakt.
   Timing: altijd plannen op de audioklok (t = Engine.now() + iets), nooit met setTimeout. */

let actx = null;                       // gedeelde AudioContext (ook gebruikt door de ritme-modules)
function ensureCtx(){ return Engine.ensure(); }

const Engine = (function(){
  const VOL_KEY = 'engine-volume';
  let master = null, comp = null, notesBus = null, droneBus = null, clickBus = null, noiseBuf = null, revSend = null, revAmt = .35;
  // galm voor losse noten (opnames uit een dode ruimte, zoals de Iowa-viool): eigen zaal-impulsrespons, niveau 0–1 in 'noot-galm'
  let noteRevIn = null, noteRevAmt = .45;
  try { const v = parseFloat(localStorage.getItem('noot-galm')); if (v >= 0 && v <= 1) noteRevAmt = v; } catch(e){}
  let vol = 0.9;
  try { const v = parseFloat(localStorage.getItem(VOL_KEY)); if (v >= 0 && v <= 1) vol = v; } catch(e){}

  const INSTRUMENTS = [
    { id:'piano', n:'Piano' }, { id:'strijker', n:'Viool VSCO' }, { id:'viooliowa', n:'Viool Iowa' }, { id:'gitaar', n:'Gitaar' }, { id:'orgel', n:'Orgel' },
    { id:'fluit', n:'Fluit' }, { id:'koper', n:'Koper' }, { id:'marimba', n:'Marimba' }, { id:'sinus', n:'Sinus (zuiver)' }
  ];
  const ALIAS = { viool:'strijker', violin:'strijker', guitar:'gitaar' };
  const instId = id => { id = ALIAS[id] || id; return INSTRUMENTS.some(x => x.id === id) ? id : 'piano'; };

  function ensure(){
    if (!actx){
      actx = new (window.AudioContext || window.webkitAudioContext)();
      comp = actx.createDynamicsCompressor();          // voorkomt vervorming bij akkoorden
      comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
      master = actx.createGain(); master.gain.value = vol;
      master.connect(comp).connect(actx.destination);
      droneBus = actx.createGain(); droneBus.connect(master);
      // galm voor de drone: zelfgemaakte impulsrespons (ruis die in ~2,8 s uitsterft, hoog sneller dan laag)
      const conv = actx.createConvolver(), sr = actx.sampleRate, len = Math.floor(sr * 2.8), ir = actx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++){
        const d = ir.getChannelData(c); let lp = 0;
        for (let i = 0; i < len; i++){ const x = Math.random() * 2 - 1; lp += (x - lp) * (.55 - .4 * i / len); d[i] = lp * Math.pow(1 - i / len, 2.2) * (i < sr * .012 ? i / (sr * .012) : 1); }
      }
      conv.buffer = ir;
      revSend = actx.createGain(); revSend.gain.value = revAmt * 1.5;
      droneBus.connect(revSend).connect(conv).connect(master);
      // zaalgalm voor noten: korter (2 s) en iets helderder, met een paar vroege reflecties
      const conv2 = actx.createConvolver(), len2 = Math.floor(sr * 2.0), ir2 = actx.createBuffer(2, len2, sr);
      for (let c = 0; c < 2; c++){
        const d = ir2.getChannelData(c); let lp = 0;
        for (let i = 0; i < len2; i++){ const x = Math.random() * 2 - 1; lp += (x - lp) * (.7 - .5 * i / len2); d[i] = lp * Math.pow(1 - i / len2, 2.6) * (i < sr * .008 ? i / (sr * .008) : 1) * .8; }
        [.011, .019, .027, .041].forEach((t, k) => { const j = Math.floor(sr * (t + c * .003)); if (j < len2) d[j] += (k % 2 ? -1 : 1) * .5 / (k + 1); });
      }
      conv2.buffer = ir2;
      noteRevIn = actx.createGain(); noteRevIn.gain.value = noteRevAmt * 1.3;
      noteRevIn.connect(conv2).connect(master);
      clickBus = actx.createGain(); clickBus.connect(master);
    }
    if (actx.state === 'suspended' && !(typeof paused !== 'undefined' && paused)) actx.resume();
    if (typeof Samples !== 'undefined') Samples.ctxReady();
    return actx;
  }
  const now = () => (actx ? actx.currentTime : 0);
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function noteRev(){ ensure(); return noteRevIn; }   // ingang van de notengalm (Samples.play stuurt hierheen)
  function noteReverb(x){   // 0–1, bewaard
    if (x != null){ noteRevAmt = Math.max(0, Math.min(1, x)); try { localStorage.setItem('noot-galm', String(noteRevAmt)); } catch(e){}
      if (noteRevIn) noteRevIn.gain.setTargetAtTime(noteRevAmt * 1.3, actx.currentTime, .05); }
    return noteRevAmt;
  }
  function out(){
    ensure();
    if (!notesBus){ notesBus = actx.createGain(); notesBus.connect(master); }
    return notesBus;
  }
  function fadeOut(node, t){
    try { node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(node.gain.value, t); node.gain.linearRampToValueAtTime(0, t + .03); } catch(e){}
    setTimeout(() => { try { node.disconnect(); } catch(e){} }, 150);
  }
  function stopNotes(){
    if (notesBus && actx){ const b = notesBus; notesBus = null; fadeOut(b, actx.currentTime); }
  }

  /* --- bouwstenen --- */
  function osc(type, f, t, end, dest, gain){
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); g.gain.value = gain;
    o.connect(g).connect(dest); o.start(t); o.stop(end);
    return o;
  }
  function vibrato(o, f, t, end, depth){
    const lfo = actx.createOscillator(), lg = actx.createGain();
    lfo.frequency.value = 5.4;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * depth, t + Math.min(.45, Math.max(.1, end - t)));
    lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(end);
  }
  function noiseBuffer(){
    if (!noiseBuf){
      const len = actx.sampleRate * 2; noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function noiseSrc(t, end){
    const s = actx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; s.start(t); s.stop(end); return s;
  }

  /* --- instrumenten: elk krijgt (t, f, dur, end, env-gain, vol) en zet zelf de omhullende --- */
  const SYN = {
    piano(t, f, dur, end, env, v){
      [[1,1],[2,.4],[3,.18],[4,.08]].forEach(p => osc('sine', f * p[0], t, end + .8, env, p[1] / 1.66));
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v, t + .006);
      g.exponentialRampToValueAtTime(v * .35, t + Math.min(.45, Math.max(.05, dur)));
      g.setTargetAtTime(.0001, end, .1);
      return end + .8;
    },
    strijker(t, f, dur, end, env, v){
      const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(5000, f * 5); lp.Q.value = .7; lp.connect(env);
      vibrato(osc('sawtooth', f, t, end + .3, lp, 1), f, t, end + .3, .005);
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v * .5, t + .08);
      g.setValueAtTime(v * .5, end); g.exponentialRampToValueAtTime(.0001, end + .18);
      return end + .3;
    },
    gitaar(t, f, dur, end, env, v){
      const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .6;
      lp.frequency.setValueAtTime(Math.min(12000, f * 10), t); lp.frequency.exponentialRampToValueAtTime(Math.max(80, f * 1.3), t + .5);
      lp.connect(env);
      const stop = t + Math.max(1.2, dur + .4);
      osc('sawtooth', f, t, stop + .1, lp, .8); osc('triangle', f, t, stop + .1, lp, .6);
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v * .7, t + .004); g.exponentialRampToValueAtTime(.0001, stop);
      return stop + .1;
    },
    orgel(t, f, dur, end, env, v){
      [[1,.8],[2,.55],[3,.2],[4,.3],[8,.08]].forEach(p => osc('sine', f * p[0], t, end + .2, env, p[1] / 1.9));
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v * .8, t + .03);
      g.setValueAtTime(v * .8, end); g.exponentialRampToValueAtTime(.0001, end + .08);
      return end + .2;
    },
    fluit(t, f, dur, end, env, v){
      const o = osc('sine', f, t, end + .3, env, .85); osc('sine', f * 2, t, end + .3, env, .12); osc('sine', f * 3, t, end + .3, env, .05);
      vibrato(o, f, t, end + .3, .004);
      const bp = actx.createBiquadFilter(), ng = actx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = Math.min(8000, f * 2); bp.Q.value = 2; ng.gain.value = .06;
      noiseSrc(t, end + .3).connect(bp).connect(ng).connect(env);
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v * .7, t + .09);
      g.setValueAtTime(v * .7, end); g.exponentialRampToValueAtTime(.0001, end + .15);
      return end + .3;
    },
    koper(t, f, dur, end, env, v){
      const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * 7), t + .09);
      lp.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 3.5), t + .35);
      lp.connect(env);
      osc('sawtooth', f, t, end + .3, lp, 1);
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v * .55, t + .05);
      g.setValueAtTime(v * .55, end); g.exponentialRampToValueAtTime(.0001, end + .12);
      return end + .3;
    },
    marimba(t, f, dur, end, env, v){
      [[1,1,.9],[4,.3,.12],[10,.08,.04]].forEach(p => {
        const pg = actx.createGain(); pg.connect(env);
        pg.gain.setValueAtTime(p[1], t); pg.gain.exponentialRampToValueAtTime(.0001, t + p[2] + Math.min(.6, 60 / f));
        osc('sine', f * p[0], t, t + 2, pg, 1);
      });
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v * .9, t + .003); g.setTargetAtTime(.0001, t + 1, .3);
      return t + 2;
    },
    sinus(t, f, dur, end, env, v){
      osc('sine', f, t, end + .3, env, 1);
      const g = env.gain;
      g.setValueAtTime(.0001, t); g.exponentialRampToValueAtTime(v * .7, t + .03);
      g.setValueAtTime(v * .7, end); g.exponentialRampToValueAtTime(.0001, end + .1);
      return end + .3;
    }
  };
  SYN.viooliowa = SYN.strijker;   // terugval als de opname (nog) niet klaar is


  function note(t, midi, dur, opts){
    opts = opts || {};
    const bus = out(), inst = instId(opts.inst);
    let v = opts.vol != null ? opts.vol : .42;
    if (midi < 48) v *= 1 + (48 - midi) / 30;           // lage tonen klinken op kleine speakers zachter
    if (typeof Samples !== 'undefined' && Samples.play(inst, t, midi, dur, v, bus)) return;   // echte opname als die klaar is
    const env = actx.createGain(); env.connect(bus);
    const stopAt = SYN[inst](t, hz(midi), dur, t + dur, env, v);
    setTimeout(() => { try { env.disconnect(); } catch(e){} }, Math.max(0, (stopAt - actx.currentTime) * 1000 + 300));
  }
  function chord(t, midis, dur, opts){
    opts = Object.assign({ inst:'piano' }, opts || {});
    const v = (opts.vol != null ? opts.vol : .75) / midis.length;
    midis.forEach(m => note(t, m, dur, { inst:opts.inst, vol:v }));
  }
  function melody(t, notes, opts){
    notes.forEach(n => { note(t, n.m, Math.max(.12, n.d * .92), opts); t += n.d; });
    return t;
  }
  function cadence(t, tonic, mode, opts){
    const d = (opts && opts.step) || .62;
    const ch = mode === 'min'
      ? [[-12,0,3,7],[-7,0,5,8],[-5,-1,2,7],[-12,0,3,7]]
      : [[-12,0,4,7],[-7,0,5,9],[-5,-1,2,7],[-12,0,4,7]];
    ch.forEach((c, i) => chord(t + i * d, c.map(x => tonic + x), i === 3 ? 1.0 : d * .95, opts));
    return d * 3 + 1.0 + .45;
  }

  /* --- tikken: kiesbare klanken voor metronoom en ritmestemmen --- */
  const SOUND_KEY = 'engine-sounds';
  const METRO_SOUNDS = [
    { id:'piep', n:'Piep' }, { id:'hout', n:'Houtblok' }, { id:'klik', n:'Klik (mechanisch)' },
    { id:'klave', n:'Claves' }, { id:'koebel', n:'Koebel' }, { id:'zacht', n:'Zacht' }
  ];
  const VOICE_SOUNDS = [
    { id:'toon', n:'Toon (lengte hoorbaar)' }, { id:'hout', n:'Houtblok' }, { id:'trom', n:'Trom' },
    { id:'snare', n:'Snare' }, { id:'klap', n:'Handklap' }, { id:'piano', n:'Piano' }, { id:'marimba', n:'Marimba' }
  ];
  const sounds = { metro:'piep', up:'toon', low:'toon' };
  try { Object.assign(sounds, JSON.parse(localStorage.getItem(SOUND_KEY)) || {}); } catch(e){}
  function setSound(role, id){
    sounds[role] = id;
    try { localStorage.setItem(SOUND_KEY, JSON.stringify(sounds)); } catch(e){}
  }
  function soundOptions(role){
    const list = role === 'metro' ? METRO_SOUNDS : VOICE_SOUNDS;
    return list.map(x => `<option value="${x.id}"${x.id === sounds[role] ? ' selected' : ''}>${x.n}</option>`).join('');
  }

  // korte klank-bouwstenen
  function blip(t, type, f, peak, dec, dest, fEnd){
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dec);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .002);
    g.gain.exponentialRampToValueAtTime(.0001, t + dec);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dec + .02);
  }
  function burst(t, ftype, f, q, peak, dec, dest){
    const fl = actx.createBiquadFilter(), g = actx.createGain();
    fl.type = ftype; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .001);
    g.gain.exponentialRampToValueAtTime(.0001, t + dec);
    noiseSrc(t, t + dec + .02).connect(fl).connect(g).connect(dest);
  }
  // lvl: 2 = accent, 1 = tel, 0 = onderverdeling
  const METRO = {
    piep(t, lvl, d){ blip(t, 'sine', [990, 1320, 1760][lvl], [.06, .12, .22][lvl], [.02, .03, .035][lvl], d); },
    hout(t, lvl, d){
      const f = [700, 800, 1100][lvl], p = [.12, .25, .4][lvl];
      blip(t, 'triangle', f, p, .05, d); blip(t, 'sine', f * 2.7, p * .3, .025, d);
      burst(t, 'bandpass', f * 2, 2, p * .4, .006, d);
    },
    klik(t, lvl, d){ burst(t, 'highpass', [2500, 1800, 1200][lvl], .7, [.15, .3, .5][lvl], [.006, .008, .012][lvl], d); blip(t, 'square', [2000, 1500, 1000][lvl], [.01, .02, .04][lvl], .01, d); },
    klave(t, lvl, d){ blip(t, 'sine', [2200, 2500, 3000][lvl], [.08, .16, .28][lvl], .045, d); },
    koebel(t, lvl, d){
      const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 2.5; bp.connect(d);
      const k = lvl === 2 ? 1.12 : 1, p = [.05, .12, .2][lvl];
      blip(t, 'square', 545 * k, p, .18, bp); blip(t, 'square', 815 * k, p, .18, bp);
    },
    zacht(t, lvl, d){ blip(t, 'sine', [660, 660, 880][lvl], [.03, .06, .1][lvl], .05, d); }
  };
  // low = onderste laag (polyritme): lager van toon
  const VOICE = {
    toon(t, low, len, d){
      const o = actx.createOscillator(), g = actx.createGain();
      const f = low ? 392 : 660, peak = low ? .5 : .45, L = Math.max(.06, (len || .12) * .9);
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + .004);
      g.gain.exponentialRampToValueAtTime(peak * .3, t + Math.min(.07, L * .6));
      g.gain.setValueAtTime(peak * .3, t + Math.max(Math.min(.07, L * .6), L - .03));
      g.gain.exponentialRampToValueAtTime(.0001, t + L);
      o.connect(g).connect(d); o.start(t); o.stop(t + L + .02);
    },
    hout(t, low, len, d){ const f = low ? 560 : 900; blip(t, 'triangle', f, .45, .06, d); blip(t, 'sine', f * 2.7, .12, .03, d); burst(t, 'bandpass', f * 2, 2, .15, .006, d); },
    trom(t, low, len, d){ blip(t, 'sine', low ? 130 : 230, .8, low ? .3 : .22, d, low ? 50 : 110); burst(t, 'lowpass', 1500, .7, .12, .03, d); },
    snare(t, low, len, d){ burst(t, 'bandpass', low ? 900 : 1900, .8, .5, .13, d); blip(t, 'triangle', low ? 150 : 200, .35, .08, d); },
    klap(t, low, len, d){ const f = low ? 750 : 1300; [0, .011, .022].forEach((o, i) => burst(t + o, 'bandpass', f, 1.5, i === 2 ? .6 : .4, i === 2 ? .12 : .01, d)); },
    piano(t, low, len, d){ note(t, low ? 67 : 76, Math.max(.12, (len || .2) * .9), { inst:'piano', vol:.5 }); },
    marimba(t, low, len, d){ note(t, low ? 67 : 76, Math.max(.12, (len || .2) * .9), { inst:'marimba', vol:.55 }); }
  };

  function click(t, kind, len, onNotesBus){
    ensure();
    const dest = onNotesBus ? out() : clickBus;
    if (kind === 'up' || kind === 'low'){ (VOICE[sounds[kind]] || VOICE.toon)(t, kind === 'low', len, dest); return; }
    const lvl = kind === 'accent' ? 2 : kind === 'sub' ? 0 : 1;
    (METRO[sounds.metro] || METRO.piep)(t, lvl, dest);
  }
  // korte voorbeeldtik na het kiezen van een klank
  function preview(role){
    ensure(); const t = actx.currentTime + .05;
    if (role === 'metro'){ click(t, 'accent'); click(t + .35, 'beat'); click(t + .7, 'beat'); }
    else { click(t, role, .25); click(t + .3, role, .12); click(t + .45, role, .12); }
  }

  function noise(t, dur){
    dur = dur || 1.2;
    const lp = actx.createBiquadFilter(), g = actx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 3000;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .1);
    g.gain.setValueAtTime(.12, t + dur - .2); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    noiseSrc(t, t + dur).connect(lp).connect(g).connect(out());
    return dur + .5;
  }

  /* --- drone (strijker / orgel / sinus); galm via revSend (Engine.drone.reverb(0–1)) --- */
  let dr = null;
  const FL = { orgel:2.6, fluit:2.7 };
  const REC_GAIN = { orgel:7.5, cello:6.5 };          // opname-drones: × v / piek (gemeten gelijk aan de synth-drones)                  // luidheid gelijkgetrokken met het orgel (gemeten)
  const drone = {
    start(root, opts){
      opts = opts || {}; ensure(); drone.stop();
      const t = actx.currentTime, g = actx.createGain(), lp = actx.createBiquadFilter();
      const synthOrgan = opts.inst === 'orgelsynth';                  // 'Orgel (nagebouwd)': altijd de synth, nooit de opname
      const inst = synthOrgan ? 'orgel' : (opts.inst || 'strijker');
      const ms = [root]; if (opts.fifth !== false) ms.push(root + 7); if (opts.octave) ms.push(root + 12);
      (opts.add || []).forEach(s => { if (!ms.includes(root + s)) ms.push(root + s); });
      const v = (opts.vol != null ? opts.vol : .05) * (ms.length > 2 ? Math.sqrt(2 / ms.length) : 1);   // veel tonen: niet harder
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .8);
      g.connect(droneBus);
      const os = [];
      // orgel: echte opname, naadloos herhaald; nog niet klaar → nu de nagebouwde klank, en wisselen zodra de opname er is
      const recInst = inst === 'cello' ? 'cello' : inst === 'orgel' && !synthOrgan ? 'orgel' : null;   // klanken met echte opnames
      if (recInst && typeof Samples !== 'undefined' && Samples.enabled()){
        Samples.load(recInst);
        const loops = ms.map(m => Samples.loop(recInst, m));
        if (loops.every(Boolean)){
          const srcs = loops.map((L, i) => {
            const src = actx.createBufferSource(), sg = actx.createGain();
            src.buffer = L.buf; src.loop = true; src.playbackRate.value = L.rate || 1;
            sg.gain.value = (REC_GAIN[recInst] || 7.5) / L.peak * (i ? .8 : 1);   // gelijk aan de nagebouwde orgeldrone; extra tonen iets zachter
            src.connect(sg).connect(g); src.start(t, Math.random() * L.buf.duration * .5);
            return src;
          });
          dr = { g, os:srcs, rec:true };
          return;
        }
        const token = {};
        setTimeout(() => Samples.whenReady(recInst, ms, () => { if (dr && dr.token === token && ms.every(m => Samples.loop(recInst, m))) drone.start(root, opts); }), 0);
        lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
        if (recInst === 'orgel') ms.forEach(m => [[.5,.45],[1,.6],[2,.4],[4,.15]].forEach(p => os.push(osc('sine', hz(m) * p[0], t, t + 36000, lp, p[1] * FL.orgel))));
        else ms.forEach(m => os.push(osc('sawtooth', hz(m), t, t + 36000, lp, 1)));   // cello nog niet klaar: tijdelijk de strijker
        dr = { g, os, token };
        return;
      }
      lp.type = 'lowpass'; lp.frequency.value = inst === 'sinus' ? 4000 : 700;
      lp.connect(g);
      if (inst === 'fluit'){ lp.frequency.value = 8000; }
      ms.forEach(m => {
        if (inst === 'orgel') [[.5,.45],[1,.6],[2,.4],[4,.15]].forEach(p => os.push(osc('sine', hz(m) * p[0], t, t + 36000, lp, p[1] * FL.orgel)));   // 16' + 8' + 4' + 2'
        else if (inst === 'fluit'){                     // zoals de fluit-klank, maar zonder vibrato: toonhoogte staat stil
          [[1,.85],[2,.12],[3,.05]].forEach(p => os.push(osc('sine', hz(m) * p[0], t, t + 36000, lp, p[1] * FL.fluit)));
          const bp = actx.createBiquadFilter(), ng = actx.createGain();
          bp.type = 'bandpass'; bp.frequency.value = Math.min(8000, hz(m) * 2); bp.Q.value = 2; ng.gain.value = .06 * FL.fluit;
          const nz = noiseSrc(t, t + 36000); nz.connect(bp).connect(ng).connect(lp); os.push(nz);
        }
        else os.push(osc(inst === 'sinus' ? 'sine' : 'sawtooth', hz(m), t, t + 36000, lp, inst === 'sinus' ? 3 : 1));
      });
      dr = { g, os };
    },
    stop(){
      if (!dr || !actx){ dr = null; return; }
      const d = dr, t = actx.currentTime; dr = null;
      try { d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0, t + .3); } catch(e){}
      d.os.forEach(o => { try { o.stop(t + .35); } catch(e){} });
      setTimeout(() => { try { d.g.disconnect(); } catch(e){} }, 500);
    },
    on: () => !!dr,
    reverb(x){ if (x != null){ revAmt = Math.max(0, Math.min(1, x)); if (revSend) revSend.gain.setTargetAtTime(revAmt * 1.5, actx.currentTime, .05); } return revAmt; },   // schuif 0–1 → zendniveau 0–1,5
    INSTS: [['orgel', 'Orgel (opname)'], ['cello', 'Cello (opname)'], ['orgelsynth', 'Orgel (nagebouwd)'], ['fluit', 'Fluit'], ['strijker', 'Strijker'], ['sinus', 'Sinus']]
  };

  /* --- metronoom: vooruitplannen op de audioklok ---
     opts: bpm, beats, sub (1 = alleen tellen), accent, gap [aan, stil] (maten),
           pattern ['a'|'b'|'z'|'x', …] per tel (accent / normaal / zacht / stil; zet beats = lengte),
           swing 0,5–0,75 (alleen bij sub 2: plek van de tweede achtste binnen de tel),
           tempo(bar, beat, beats) → bpm of null (bij elke tel, bij het plannen),
           layout(bar) → {pattern, sub} of null (begin van elke maat: andere maatsoort per maat),
           onSchedule(t, mute, info) (bij het plannen van elke tel, ahead s vooruit; ahead standaard 0,12),
           mute(bar, beat) → true = deze tel stil (naast gap),
           countIn n = eerst n maten aftellen (alle tellen, geen onderverdeling; bar is dan negatief, info.countIn = true),
           onBeat(i, t, mute, info{bar, beat, bpm, level, countIn, beats, pattern}) (i = teller van de tellen). bar telt vanaf 0 bij elke start() (na het aftellen). */
  let mt = null;
  const metronome = {
    start(opts){
      ensure(); metronome.stop();
      mt = Object.assign({ bpm:60, beats:4, sub:1, accent:true, gap:null, onBeat:null, pattern:null, swing:0, tempo:null, mute:null,
                           countIn:0, layout:null, onSchedule:null, ahead:.12 }, opts || {});
      if (mt.pattern && mt.pattern.length) mt.beats = mt.pattern.length;
      mt.sub = Math.max(1, Math.round(mt.sub) || 1);
      mt.next = actx.currentTime + .1; mt.raw = 0; mt.pos = 0; mt.n = 0; mt.beatT = mt.next; mt.beatMute = false;
      mt.timer = setInterval(tick, 25); tick();
    },
    setBpm(b){ if (mt) mt.bpm = b; },
    set(o){ if (mt) Object.assign(mt, o); },          // bv. pattern of swing tijdens het spelen wijzigen (zelfde aantal tellen)
    stop(){ if (mt){ clearInterval(mt.timer); mt = null; } },
    running: () => !!mt,
    bpm: () => (mt ? mt.bpm : null)
  };
  function tick(){
    if (!mt) return;
    const ahead = actx.currentTime + (mt.ahead || .12), ci = mt.countIn || 0;
    while (mt && mt.next < ahead){
      const bar = mt.raw - ci, inCi = bar < 0;               // aftellen: alle tellen hoorbaar, geen opbouw, geen stilte
      if (mt.pos === 0 && mt.layout && !inCi){               // per maat andere maatsoort / onderverdeling
        const L = mt.layout(bar);
        if (L){ if (L.pattern && L.pattern.length){ mt.pattern = L.pattern; mt.beats = L.pattern.length; } if (L.sub) mt.sub = L.sub; }
      }
      const per = mt.beats * mt.sub, pos = mt.pos, beat = Math.floor(pos / mt.sub), s = pos % mt.sub;
      if (s === 0 && mt.tempo && !inCi){ const b = mt.tempo(bar, beat, mt.beats); if (b > 0) mt.bpm = b; }
      let level = mt.pattern ? (mt.pattern[beat] || 'b') : (beat === 0 && mt.accent ? 'a' : 'b');
      if (inCi) level = beat === 0 ? 'a' : level === 'x' ? 'b' : level;
      if (s === 0){
        let mute = false;
        if (!inCi){
          if (mt.gap){ const [on, off] = mt.gap; mute = (bar % (on + off)) >= on; }
          if (!mute && mt.mute) mute = !!mt.mute(bar, beat);
        }
        mt.beatMute = mute; mt.beatT = mt.next;
      }
      const mute = mt.beatMute;
      let t = mt.next;
      if (mt.sub === 2 && s === 1 && mt.swing > .5) t = mt.beatT + Math.min(.8, mt.swing) * 60 / mt.bpm;
      const kind = s > 0 ? 'sub' : level === 'a' ? 'accent' : level === 'z' ? 'sub' : 'beat';
      if (!mute && level !== 'x' && !(inCi && s > 0)) click(t, kind);
      if (s === 0){
        const info = { bar, beat, bpm:mt.bpm, level, countIn:inCi, beats:mt.beats, pattern:mt.pattern };
        if (mt.onSchedule) mt.onSchedule(t, mute, info);
        if (mt.onBeat){ const cb = mt.onBeat, i = mt.n; setTimeout(() => cb(i, t, mute, info), Math.max(0, (t - actx.currentTime) * 1000)); }
        mt.n++;
      }
      mt.next += 60 / mt.bpm / mt.sub;
      if (++mt.pos >= per){ mt.pos = 0; mt.raw++; }
    }
  }

  function stopAll(){ stopNotes(); drone.stop(); metronome.stop(); }
  function volume(v){
    if (v == null) return vol;
    vol = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(VOL_KEY, String(vol)); } catch(e){}
    if (master) master.gain.setTargetAtTime(vol, actx.currentTime, .02);
    return vol;
  }
  function instOptions(sel){
    sel = instId(sel);
    return INSTRUMENTS.map(x => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${x.n}</option>`).join('');
  }

  return { ensure, now, hz, out, noteRev, noteReverb, INSTRUMENTS, instId, instOptions, note, chord, melody, cadence, click, noise,
           drone, metronome, stopNotes, stopAll, volume,
           METRO_SOUNDS, VOICE_SOUNDS, sounds, setSound, soundOptions, preview };
})();
