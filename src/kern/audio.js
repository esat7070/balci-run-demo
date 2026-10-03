/* =====================================================================
   audio.js — Chiptune-Engine.
   Keine MP3s, keine Samples. Alles wird live aus Pulswellen, Dreieck
   und Rauschen erzeugt. Inklusive Yusufs Lachen (HÖ HÖ HÖÖÖ).
   ===================================================================== */
(function (global) {
  'use strict';

  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var noiseBuf = null;
  var waves = {};
  var ready = false;

  var muted = false;
  muted = global.Speicher.get('balci_mute') === '1';
  // Lautstaerke aus den Einstellungen (optionen.js), 0..1 je Kanal
  var MUSIK_BASIS = 0.16, EFFEKT_BASIS = 0.38;
  var musikVol = 1, effektVol = 1;

  /* ------------------------- Noten ------------------------- */

  var NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function freq(note) {
    if (!note || note === '.' || note === '-') return 0;
    var m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(note.trim());
    if (!m) return 0;
    var semi = NOTE_IDX[m[1].toUpperCase()];
    if (m[2] === '#') semi += 1;
    else if (m[2] === 'b') semi -= 1;
    var oct = parseInt(m[3], 10);
    var midi = (oct + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ------------------------- Setup ------------------------- */

  function init() {
    if (ready) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIK_BASIS * musikVol;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = EFFEKT_BASIS * effektVol;
    sfxGain.connect(master);

    // Rauschpuffer für Drums & Effekte
    var len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    waves.p50 = pulse(0.5);
    waves.p25 = pulse(0.25);
    waves.p125 = pulse(0.125);

    ready = true;
    return true;
  }

  /** Pulswelle über Fourier-Koeffizienten — der klassische NES-Klang. */
  function pulse(duty) {
    var n = 48;
    var real = new Float32Array(n), imag = new Float32Array(n);
    for (var i = 1; i < n; i++) {
      imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  function resume() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  /* ------------------------- Bausteine ------------------------- */

  function tone(o) {
    if (!ready || muted) return;
    var t0 = o.at !== undefined ? o.at : ctx.currentTime;
    var dur = o.dur || 0.12;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();

    if (o.wave && waves[o.wave]) osc.setPeriodicWave(waves[o.wave]);
    else osc.type = o.wave || 'square';

    osc.frequency.setValueAtTime(Math.max(1, o.f0 || 440), t0);
    if (o.f1 && o.f1 !== o.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + dur);
    }
    if (o.vibrato) {
      var lfo = ctx.createOscillator();
      var lg = ctx.createGain();
      lfo.frequency.value = o.vibrato;
      lg.gain.value = o.vibratoDepth || 12;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.02);
    }

    var peak = o.gain === undefined ? 0.5 : o.gain;
    var atk = o.attack === undefined ? 0.005 : o.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(o.bus || sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(o) {
    if (!ready || muted) return;
    var t0 = o.at !== undefined ? o.at : ctx.currentTime;
    var dur = o.dur || 0.1;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    var filt = ctx.createBiquadFilter();
    filt.type = o.filter || 'bandpass';
    filt.frequency.setValueAtTime(o.f0 || 1200, t0);
    if (o.f1) filt.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + dur);
    filt.Q.value = o.q === undefined ? 1 : o.q;

    var g = ctx.createGain();
    var peak = o.gain === undefined ? 0.35 : o.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filt); filt.connect(g); g.connect(o.bus || sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ------------------------- Drums ------------------------- */

  function kick(at, bus) {
    tone({ at: at, wave: 'sine', f0: 160, f1: 42, dur: 0.16, gain: 0.85, bus: bus });
    noise({ at: at, filter: 'lowpass', f0: 900, f1: 120, dur: 0.05, gain: 0.25, bus: bus });
  }
  function snare(at, bus) {
    noise({ at: at, filter: 'highpass', f0: 1400, dur: 0.12, gain: 0.34, q: 0.6, bus: bus });
    tone({ at: at, wave: 'triangle', f0: 240, f1: 120, dur: 0.08, gain: 0.22, bus: bus });
  }
  function hat(at, bus) {
    noise({ at: at, filter: 'highpass', f0: 7200, dur: 0.035, gain: 0.16, q: 0.8, bus: bus });
  }

  /* ------------------------- Songs ------------------------- */

  function S(str) { return str.trim().split(/\s+/); }

  var SONGS = {
    menu: {
      bpm: 132, duty: 'p25',
      lead: S(`C5 . E5 . G5 . E5 . C5 . . . A4 . . .
               F4 . A4 . C5 . A4 . F4 . . . G4 . . .
               G4 . B4 . D5 . B4 . G4 . . . E5 . . .
               C5 . . . G4 . . . E4 . . . C4 . . .`),
      bass: S(`C3 . . . C3 . . . G2 . . . G2 . . .
               F2 . . . F2 . . . C3 . . . C3 . . .
               G2 . . . G2 . . . D3 . . . D3 . . .
               C3 . . . C3 . . . G2 . . . C3 . . .`),
      drums: 'K.h.S.h.K.h.S.h.'
    },

    // Level 1 — verschlafen, aber es geht schon irgendwie.
    l1: {
      bpm: 138, duty: 'p25',
      lead: S(`F4 . F4 . A4 . C5 . A4 . F4 . C5 . . .
               G4 . G4 . B4 . D5 . B4 . G4 . D5 . . .
               A4 . A4 . C5 . E5 . C5 . A4 . E5 . . .
               F5 . E5 . D5 . C5 . A4 . G4 . F4 . . .`),
      bass: S(`F2 . . F2 . . C3 . F2 . . F2 . . C3 .
               G2 . . G2 . . D3 . G2 . . G2 . . D3 .
               A2 . . A2 . . E3 . A2 . . A2 . . E3 .
               F2 . . F2 . . C3 . F2 . . C3 . . C3 .`),
      drums: 'K.h.S.h.K.hhS.h.'
    },

    // Level 2 — Sonne, Blumen, sehr wütende Bienen.
    l2: {
      bpm: 146, duty: 'p50',
      lead: S(`D5 . . A4 . . F#5 . . D5 . . A4 . . .
               E5 . . B4 . . G5 . . E5 . . B4 . . .
               F#5 . . D5 . . A5 . . F#5 . . D5 . . .
               E5 . D5 . C#5 . B4 . A4 . . . D5 . . .`),
      bass: S(`D2 . . . A2 . . . D2 . . . A2 . . .
               E2 . . . B2 . . . E2 . . . B2 . . .
               F#2 . . . C#3 . . . F#2 . . . C#3 . . .
               G2 . . . A2 . . . D2 . . . D2 . . .`),
      drums: 'K.h.S.hhK.h.S.hh'
    },

    // Level 3 — Muckibude. Bass wie ein Laufband.
    l3: {
      bpm: 158, duty: 'p125',
      lead: S(`A4 A4 . E5 . A4 . C5 . B4 . A4 . E4 . .
               G4 G4 . D5 . G4 . B4 . A4 . G4 . D4 . .
               F4 F4 . C5 . F4 . A4 . G4 . F4 . C4 . .
               E4 . G4 . B4 . E5 . D5 . C5 . B4 . A4 .`),
      bass: S(`A2 . A2 . A2 . A2 . E2 . E2 . E2 . E2 .
               G2 . G2 . G2 . G2 . D2 . D2 . D2 . D2 .
               F2 . F2 . F2 . F2 . C2 . C2 . C2 . C2 .
               E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 .`),
      drums: 'K.hKS.hKK.hKS.hh'
    },

    // Level 4 — Küche. Funky, fettig.
    l4: {
      bpm: 150, duty: 'p25',
      lead: S(`G4 . A#4 . D5 . . C5 . A#4 . G4 . . D4 .
               F4 . A4 . C5 . . A#4 . A4 . F4 . . C4 .
               D#4 . G4 . A#4 . . A4 . G4 . D#4 . . A#3 .
               D4 . F4 . A4 . . G4 . F4 . D4 . . G4 .`),
      bass: S(`G2 . . G2 . G2 . . D3 . . D3 . D3 . .
               F2 . . F2 . F2 . . C3 . . C3 . C3 . .
               D#2 . . D#2 . D#2 . . A#2 . . A#2 . A#2 . .
               D2 . . D2 . D2 . . G2 . . G2 . G2 . .`),
      drums: 'K.hhS.h.KKhhS.h.'
    },

    // Level 5 — Husseins Festung. Düster.
    l5: {
      bpm: 142, duty: 'p125',
      lead: S(`E4 . . G4 . . B4 . . E5 . . D5 . . .
               C5 . . B4 . . A4 . . G4 . . F#4 . . .
               E4 . . G4 . . B4 . . E5 . . G5 . . .
               F#5 . . E5 . . D5 . . B4 . . E4 . . .`),
      bass: S(`E2 . . . E2 . . . B2 . . . B2 . . .
               C3 . . . C3 . . . G2 . . . G2 . . .
               A2 . . . A2 . . . E2 . . . E2 . . .
               B2 . . . B2 . . . E2 . . . E2 . . .`),
      drums: 'K.h.S.h.K.h.S.hh'
    },

    // Level 6 — Mustang bei Nacht. Breit, triumphal, ein bisschen kitschig.
    l6: {
      bpm: 154, duty: 'p25',
      lead: S(`C5 . E5 . G5 . C6 . G5 . E5 . G5 . . .
               A#4 . D5 . F5 . A#5 . F5 . D5 . F5 . . .
               F4 . A4 . C5 . F5 . C5 . A4 . C5 . . .
               G4 . B4 . D5 . G5 . F5 . E5 . D5 . C5 .`),
      bass: S(`C3 . C3 . G2 . G2 . C3 . C3 . G2 . G2 .
               A#2 . A#2 . F2 . F2 . A#2 . A#2 . F2 . F2 .
               F2 . F2 . C3 . C3 . F2 . F2 . C3 . C3 .
               G2 . G2 . D3 . D3 . G2 . G2 . C3 . C3 .`),
      drums: 'K.hhS.h.K.hhS.hh'
    },

    // Level-Bosse: kuerzer, frecher, nicht so bedrohlich wie die Brueder.
    boss2: {
      bpm: 164, duty: 'p50',
      lead: S(`E5 . E5 . C5 . E5 . G5 . . . E5 . . .
               D5 . D5 . B4 . D5 . F5 . . . D5 . . .
               C5 . E5 . G5 . E5 . C5 . B4 . A4 . . .
               A4 . C5 . E5 . C5 . B4 . . . E5 . . .`),
      bass: S(`A2 . A2 . A2 . A2 . E2 . E2 . E2 . E2 .
               G2 . G2 . G2 . G2 . D2 . D2 . D2 . D2 .
               F2 . F2 . C3 . C3 . F2 . F2 . E2 . E2 .
               A2 . A2 . E2 . E2 . A2 . A2 . A2 . A2 .`),
      drums: 'K.hhS.h.K.hhS.hh'
    },

    // Der allerletzte Kampf. Schneller und haerter als alles davor.
    bossfinal: {
      bpm: 182, duty: 'p125',
      lead: S(`D5 D5 D5 . A#4 . D5 . F5 F5 . E5 . D5 . .
               C5 C5 C5 . G4 . C5 . E5 E5 . D5 . C5 . .
               A#4 A#4 A#4 . F4 . A#4 . D5 D5 . C5 . A#4 . .
               A5 . G5 . F5 . E5 . D5 . C5 . A#4 . A4 .`),
      bass: S(`D2 D2 . D2 . D2 D2 . D2 D2 . D2 . D2 D2 .
               C2 C2 . C2 . C2 C2 . C2 C2 . C2 . C2 C2 .
               A#1 A#1 . A#1 . A#1 A#1 . A#1 A#1 . A#1 . A#1 A#1 .
               A1 A1 . A1 . A1 A1 . A2 A2 . A2 . A2 A2 .`),
      drums: 'KKhKS.hKKKhKS.hh'
    },

    // Level 16 — Bolzplatz. Klingt nach Stadion und Fangesang.
    fussball: {
      bpm: 150, duty: 'p25',
      lead: S(`G4 . G4 . C5 . C5 . E5 . D5 . C5 . . .
               G4 . G4 . C5 . C5 . E5 . G5 . E5 . . .
               F5 . F5 . E5 . D5 . C5 . D5 . E5 . . .
               D5 . C5 . B4 . D5 . C5 . . . C5 . . .`),
      bass: S(`C3 . . . G2 . . . C3 . . . G2 . . .
               C3 . . . G2 . . . C3 . . . E3 . . .
               F2 . . . F2 . . . C3 . . . C3 . . .
               G2 . . . G2 . . . C3 . . . C3 . . .`),
      drums: 'K.h.S.h.K.hhS.h.'
    },

    // Level 17 — der Riese. Schwer, langsam, jeder Schritt ein Bass.
    riese: {
      bpm: 120, duty: 'p125',
      lead: S(`E4 . . . E4 . G4 . . . E4 . . . D4 .
               E4 . . . E4 . A4 . . . G4 . . . E4 .
               C5 . . . B4 . . . A4 . . . G4 . . .
               F#4 . . . G4 . . . A4 . . . B4 . . .`),
      bass: S(`E2 E2 . . E2 . . . E2 E2 . . D2 . . .
               E2 E2 . . E2 . . . A2 A2 . . G2 . . .
               C3 C3 . . B2 . . . A2 A2 . . G2 . . .
               F#2 F#2 . . G2 . . . A2 . . . B2 . . .`),
      drums: 'K...S..KK...S...'
    },

    // Level 18 — Rennen. Vollgas.
    rennen: {
      bpm: 180, duty: 'p25',
      lead: S(`A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .
               F4 . A4 . C5 . F5 . E5 . C5 . A4 . C5 .
               G4 . B4 . D5 . G5 . F5 . D5 . B4 . D5 .
               E5 . E5 . G#5 . G#5 . B5 . A5 . G#5 . E5 .`),
      bass: S(`A2 . A2 . A2 . A2 . A2 . A2 . A2 . A2 .
               F2 . F2 . F2 . F2 . F2 . F2 . F2 . F2 .
               G2 . G2 . G2 . G2 . G2 . G2 . G2 . G2 .
               E2 . E2 . E2 . E2 . E2 . E2 . E2 . E2 .`),
      drums: 'K.hKS.hKK.hKS.hh'
    },

    // Erfans Auftritt: spanisch. Ole.
    spanisch: {
      bpm: 164, duty: 'p50',
      lead: S(`E5 . F5 . G#5 . F5 . E5 . . . D5 . C5 .
               B4 . C5 . D5 . C5 . B4 . . . A4 . G#4 .
               A4 . B4 . C5 . D5 . E5 . F5 . E5 . D5 .
               C5 . B4 . A4 . G#4 . E4 . . . E4 . . .`),
      bass: S(`E2 . . E2 . . F2 . E2 . . E2 . . F2 .
               A2 . . A2 . . G2 . F2 . . F2 . . E2 .
               A2 . . A2 . . G2 . F2 . . F2 . . E2 .
               F2 . . F2 . . E2 . E2 . . E2 . . E2 .`),
      drums: 'K..hS.hKK..hS.h.'
    },

    // Level 19 — Knast. Duester, ein bisschen Blues.
    knast: {
      bpm: 126, duty: 'p125',
      lead: S(`D4 . . F4 . . G4 . G#4 . A4 . . . C5 .
               A4 . . G4 . . F4 . D4 . . . . . . .
               D4 . . F4 . . G4 . G#4 . A4 . . . D5 .
               C5 . A4 . G4 . F4 . D4 . . . . . . .`),
      bass: S(`D2 . D2 . F2 . D2 . G2 . G#2 . A2 . C3 .
               D2 . D2 . F2 . D2 . G2 . F2 . D2 . C2 .
               D2 . D2 . F2 . D2 . G2 . G#2 . A2 . C3 .
               D2 . C2 . A1 . C2 . D2 . D2 . D2 . D2 .`),
      drums: 'K.h.S.hhK.h.S.h.'
    },

    // Nils: schrullig, chromatisch, ein bisschen Zirkus. Wie ein Professor.
    nils: {
      bpm: 148, duty: 'p25',
      lead: S(`C5 . B4 . A#4 . A4 . C5 . . . E5 . . .
               D5 . C#5 . C5 . B4 . D5 . . . F5 . . .
               E5 . D#5 . E5 . G5 . C6 . . . G5 . . .
               F5 . E5 . D5 . C5 . B4 . D5 . C5 . . .`),
      bass: S(`C3 . G2 . C3 . G2 . C3 . G2 . C3 . G2 .
               D3 . A2 . D3 . A2 . G2 . D2 . G2 . D2 .
               C3 . G2 . C3 . G2 . A2 . E2 . A2 . E2 .
               F2 . C3 . G2 . D3 . C3 . G2 . C3 . . .`),
      drums: 'K.hhS.hhK.hhS.hh'
    },

    // Level 20 — Doenerbude. Hicaz, wie beim Doenermann im Radio.
    doener: {
      bpm: 138, duty: 'p50',
      lead: S(`D5 . D#5 . F#5 . G5 . A5 . . . G5 . F#5 .
               D#5 . D5 . . . C5 . D5 . D#5 . D5 . . .
               A4 . A#4 . C5 . D5 . D#5 . F#5 . G5 . A5 .
               G5 . F#5 . D#5 . D5 . C5 . A#4 . A4 . . .`),
      bass: S(`D2 . . . A2 . . . D2 . . . A2 . . .
               C2 . . . G2 . . . D2 . . . A2 . . .
               D2 . . . A2 . . . G2 . . . D2 . . .
               C2 . . . D2 . . . D2 . . . D2 . . .`),
      drums: 'K..KS...K..KS...'
    },

    // Der Traum nach dem Doener: langsam, schwebend, ein bisschen kitschig
    traum: {
      bpm: 104, duty: 'p50',
      lead: S(`F5 . A5 . C6 . A5 . F5 . . . E5 . . .
               D5 . F5 . A5 . F5 . D5 . . . C5 . . .
               A#4 . D5 . F5 . D5 . A#4 . . . C5 . . .
               C5 . E5 . G5 . A5 . G5 . E5 . C5 . . .`),
      bass: S(`F2 . . . . . . . C3 . . . . . . .
               D2 . . . . . . . A2 . . . . . . .
               A#1 . . . . . . . F2 . . . . . . .
               C2 . . . . . . . G2 . . . C2 . . .`),
      drums: 'K.......h...h...'
    },

    // Level 21 — Airsoft. Marschtrommeln im Wald.
    airsoft: {
      bpm: 150, duty: 'p25',
      lead: S(`A4 . A4 A4 C5 . A4 . E5 . D5 . C5 . B4 .
               A4 . A4 A4 C5 . E5 . G5 . F5 . E5 . . .
               F5 . E5 . D5 . C5 . D5 . C5 . B4 . A4 .
               G#4 . A4 . B4 . C5 . B4 . G#4 . E4 . . .`),
      bass: S(`A2 . A2 . E2 . A2 . A2 . A2 . E2 . A2 .
               A2 . A2 . E2 . A2 . C3 . C3 . G2 . C3 .
               D3 . D3 . A2 . D3 . F2 . F2 . C3 . F2 .
               E2 . E2 . B2 . E2 . E2 . E2 . G#2 . E2 .`),
      drums: 'K.SSK.S.K.SSK.SS'
    },

    // Sonnet: Hicaz wie beim Doenermann, nur mit Stiefeln
    sonnet: {
      bpm: 170, duty: 'p125',
      lead: S(`D5 . D#5 . F#5 . G5 . A5 . G5 . F#5 . D#5 .
               D5 . . . A4 . . . D5 . D#5 . F#5 . . .
               G5 . F#5 . D#5 . D5 . C5 . D#5 . D5 . C5 .
               A#4 . A4 . G4 . A4 . D5 . . . D5 . . .`),
      bass: S(`D2 . D2 . A2 . D2 . D2 . D2 . A2 . D2 .
               D2 . D2 . A2 . D2 . C2 . C2 . G2 . C2 .
               G2 . G2 . D3 . G2 . C2 . C2 . G2 . C2 .
               A#1 . A#1 . F2 . A#1 . A1 . A1 . A2 . D2 .`),
      drums: 'K.hKS.hKK.hKS.hh'
    },

    // ... und im Buggy: Vollgas
    buggy: {
      bpm: 186, duty: 'p25',
      lead: S(`D5 D5 . D#5 . F#5 . A5 . G5 . F#5 . D#5 . D5
               C5 C5 . D5 . D#5 . G5 . F#5 . D#5 . D5 . C5
               A#4 A#4 . C5 . D5 . F#5 . G5 . A5 . A#5 . A5
               G5 . F#5 . D#5 . D5 . C5 . A#4 . A4 . D5 .`),
      bass: S(`D2 D2 . D2 . D2 D2 . A1 A1 . A1 . A1 A1 .
               C2 C2 . C2 . C2 C2 . G1 G1 . G1 . G1 G1 .
               A#1 A#1 . A#1 . A#1 A#1 . F2 F2 . F2 . F2 F2 .
               G1 G1 . G1 . A1 A1 . A1 A1 . A1 . D2 D2 .`),
      drums: 'KKhKS.hKKKhKS.hh'
    },

    // Level 22 — den Waldweg runter, Sonntagnachmittag
    waldweg: {
      bpm: 150, duty: 'p50',
      lead: S(`G4 . B4 . D5 . G5 . F#5 . D5 . B4 . D5 .
               E5 . C5 . A4 . C5 . E5 . G5 . F#5 . E5 .
               D5 . B4 . G4 . B4 . D5 . E5 . F#5 . G5 .
               A5 . G5 . F#5 . E5 . D5 . . . G4 . . .`),
      bass: S(`G2 . . . D3 . . . G2 . . . D3 . . .
               C3 . . . G2 . . . C3 . . . A2 . . .
               G2 . . . D3 . . . E2 . . . B2 . . .
               D2 . . . A2 . . . D3 . . . G2 . . .`),
      drums: 'K.h.S.hhK.h.S.h.'
    },

    // Level 23 — Pizzeria. Tarantella, so gut ein Chip das kann.
    // Level 24: die Abflughalle, ruhig, ein bisschen Lounge
    flughafen: {
      bpm: 132, duty: 'p25',
      lead: S(`E5 . . G5 . . A5 . G5 . E5 . D5 . . .
               C5 . . E5 . . G5 . E5 . D5 . C5 . . .
               A4 . . C5 . . E5 . D5 . C5 . B4 . . .
               C5 . D5 . E5 . G5 . A5 . . . G5 . . .`),
      bass: S(`C3 . . . G2 . . . A2 . . . E2 . . .
               F2 . . . C3 . . . G2 . . . D3 . . .
               A2 . . . E2 . . . F2 . . . G2 . . .
               C3 . . . G2 . . . C3 . . . . . . .`),
      drums: 'K.h.S.h.K.hhS.h.'
    },
    // Level 25: die Security ist hinter ihm
    lauf: {
      bpm: 176, duty: 'p125',
      lead: S(`A4 . C5 . E5 . A5 . G5 . E5 . C5 . D5 .
               E5 . E5 . D5 . C5 . B4 . G4 . A4 . . .
               A4 . C5 . E5 . A5 . B5 . A5 . G5 . E5 .
               F5 . E5 . D5 . B4 . C5 . . . A4 . . .`),
      bass: S(`A2 . A3 . A2 . A3 . G2 . G3 . G2 . G3 .
               F2 . F3 . F2 . F3 . E2 . E3 . E2 . E3 .
               A2 . A3 . A2 . A3 . G2 . G3 . G2 . G3 .
               F2 . F3 . E2 . E3 . A2 . A3 . A2 . . .`),
      drums: 'K.hSK.hSK.hSKhSS'
    },
    // Level 26: Boarding-Musik, ahnungslos froehlich
    kabine: {
      bpm: 140, duty: 'p50',
      lead: S(`G4 . C5 . E5 . G5 . . . E5 . C5 . . .
               A4 . D5 . F5 . A5 . . . F5 . D5 . . .
               G4 . C5 . E5 . G5 . A5 . G5 . E5 . C5 .
               D5 . . . G4 . . . C5 . . . . . . .`),
      bass: S(`C3 . . . E3 . . . C3 . . . G2 . . .
               D3 . . . F3 . . . D3 . . . A2 . . .
               C3 . . . E3 . . . F3 . . . A2 . . .
               G2 . . . B2 . . . C3 . . . . . . .`),
      drums: 'K...S...K.K.S...'
    },
    // Felix: alles auf der Zwei und der Vier, ganz entspannt
    felix: {
      bpm: 120, duty: 'p25',
      lead: S(`. . E5 . . . E5 . . . G5 . . . E5 .
               . . D5 . . . D5 . . . F5 . . . D5 .
               . . C5 . . . C5 . . . E5 . . . G5 .
               . . B4 . . . D5 . . . G5 . F5 . D5 .`),
      bass: S(`A2 . . A2 . . C3 . E3 . . . C3 . . .
               G2 . . G2 . . B2 . D3 . . . B2 . . .
               F2 . . F2 . . A2 . C3 . . . A2 . . .
               E2 . . E2 . . G2 . B2 . . . G2 . E2 .`),
      drums: 'h.h.K.h.h.h.S.h.'
    },
    // Felix Dogg: langsam, wippend, eine jaulende hohe Stimme
    felixdogg: {
      bpm: 96, duty: 'p125',
      lead: S(`C6 . . . . . A#5 . C6 . . . G5 . . .
               . . . . F5 . G5 . A#5 . . . G5 . . .
               C6 . . . . . D6 . C6 . A#5 . G5 . . .
               F5 . . . G5 . . . . . . . . . . .`),
      bass: S(`C2 . . C2 . . . C3 . . A#1 . . . G1 .
               A#1 . . A#1 . . . A#2 . . F1 . . . G1 .
               C2 . . C2 . . . C3 . . A#1 . . . G1 .
               F1 . . F1 . . G1 . . . . . G1 . . .`),
      drums: 'K.h.S.hKK.h.S.h.'
    },
    // Level 27: Yusuf fliegt
    flug: {
      bpm: 150, duty: 'p25',
      lead: S(`C5 . . . G5 . . . F5 . E5 . D5 . . .
               E5 . . . C6 . . . B5 . A5 . G5 . . .
               A5 . . . G5 . F5 . E5 . D5 . C5 . . .
               D5 . E5 . F5 . G5 . . . . . . . . .`),
      bass: S(`C3 . G2 . C3 . G2 . F2 . C3 . F2 . C3 .
               A2 . E3 . A2 . E3 . G2 . D3 . G2 . D3 .
               F2 . C3 . F2 . C3 . C3 . G2 . C3 . G2 .
               G2 . D3 . G2 . D3 . G2 . . . G2 . . .`),
      drums: 'K.h.S.h.K.h.S.hh'
    },
    // Level 28: Istanbul. Hicaz — die uebermaessige Sekunde macht den Ton.
    istanbul: {
      bpm: 144, duty: 'p50',
      lead: S(`A4 . A#4 . C#5 . D5 . E5 . . . D5 . C#5 .
               D5 . . . A#4 . C#5 . A4 . . . . . . .
               E5 . F5 . E5 . D5 . C#5 . D5 . E5 . . .
               D5 . C#5 . A#4 . C#5 . A4 . . . . . . .`),
      bass: S(`A2 . . . E3 . . . A2 . . . E3 . . .
               D3 . . . A2 . . . A2 . . . E3 . . .
               A2 . . . E3 . . . D3 . . . A2 . . .
               G2 . . . A#2 . . . A2 . . . . . . .`),
      drums: 'K..hS.h.K.hhS.h.'
    },
    // Der grosse Bruder. Man hoert ihn, bevor man ihn sieht.
    semih: {
      bpm: 84, duty: 'p125',
      lead: S(`A4 . . . . . . . G#4 . . . . . . .
               F4 . . . . . . . E4 . . . . . . .
               A4 . . . C5 . . . B4 . . . G#4 . . .
               A4 . . . . . . . . . . . . . . .`),
      bass: S(`A1 . . . A1 . . . A1 . . . A1 . . .
               F1 . . . F1 . . . E1 . . . E1 . . .
               A1 . . . A1 . . . G#1 . . . G#1 . . .
               A1 . . . . . . . A1 . . . . . . .`),
      drums: 'K.......K...S...'
    },
    /* ---- Level 29/30: Semih. Jede Dimension hat ihren eigenen Ton. ---- */
    // Das Buero: Hicaz, schwer und langsam anrollend
    semihboss: {
      bpm: 150, duty: 'p125',
      lead: S(`D5 . D5 . Eb5 . F#5 . G5 . . . F#5 . Eb5 .
               D5 . . . A4 . . . D5 . Eb5 . D5 . . .
               G5 . G5 . A5 . Bb5 . A5 . G5 . F#5 . Eb5 .
               F#5 . Eb5 . D5 . C5 . D5 . . . . . . .`),
      bass: S(`D2 . D2 . D3 . D2 . D2 . D2 . D3 . D2 .
               D2 . D2 . D3 . D2 . C2 . C2 . C3 . C2 .
               G1 . G1 . G2 . G1 . G1 . G1 . G2 . G1 .
               A1 . A1 . A2 . A1 . D2 . D2 . D3 . D2 .`),
      drums: 'K.hSK.hSK.hSKKhS'
    },
    // Die Erinnerung: eine Spieluhr. Leicht schief.
    erinnerung: {
      bpm: 96, duty: 'p125',
      lead: S(`E6 . B5 . G5 . B5 . E6 . . . D#6 . . .
               E6 . B5 . G5 . E5 . F#5 . . . . . . .
               C6 . A5 . E5 . A5 . C6 . . . B5 . . .
               A5 . G5 . F#5 . D#5 . E5 . . . . . . .`),
      bass: S(`E3 . . . . . . . E3 . . . . . . .
               E3 . . . . . . . B2 . . . . . . .
               A2 . . . . . . . A2 . . . . . . .
               B2 . . . . . . . E3 . . . . . . .`),
      drums: 'h.......h.......'
    },
    // Kosmos: Arpeggios bis in die Unendlichkeit
    kosmos: {
      bpm: 132, duty: 'p25',
      lead: S(`C5 E5 G5 B5 C6 B5 G5 E5 A4 C5 E5 G5 A5 G5 E5 C5
               F4 A4 C5 E5 F5 E5 C5 A4 G4 B4 D5 F5 G5 F5 D5 B4
               C5 E5 G5 B5 C6 B5 G5 E5 E5 G5 B5 D6 E6 D6 B5 G5
               F5 A5 C6 E6 F6 E6 C6 A5 G5 B5 D6 F6 G6 . . .`),
      bass: S(`C2 . . . . . . . A1 . . . . . . .
               F1 . . . . . . . G1 . . . . . . .
               C2 . . . . . . . E2 . . . . . . .
               F1 . . . . . . . G1 . . . G1 . . .`),
      drums: 'K...h...S...h..h'
    },
    // Alle auf einmal: ein Medley, zu schnell gespielt
    echo: {
      bpm: 176, duty: 'p25',
      lead: S(`E5 . G5 . A5 . . . G5 . E5 . D5 . C5 .
               D5 . . . G4 . . . C5 . D5 . E5 . . .
               A5 . G5 . E5 . G5 . A5 . C6 . A5 . G5 .
               E5 . D5 . C5 . D5 . E5 . . . E5 . . .`),
      bass: S(`A2 . E3 . A2 . E3 . G2 . D3 . G2 . D3 .
               F2 . C3 . F2 . C3 . C3 . G2 . C3 . G2 .
               A2 . E3 . A2 . E3 . F2 . C3 . F2 . C3 .
               E2 . B2 . E2 . B2 . A2 . E3 . A2 . . .`),
      drums: 'KKhSK.hSKKhSK.hS'
    },
    // Der Riss: die letzte Form
    riss: {
      bpm: 184, duty: 'p125',
      lead: S(`A4 . A5 . G5 . F5 . E5 . F5 . E5 . D5 .
               C#5 . D5 . E5 . A4 . . . A4 . C#5 . E5 .
               F5 . F5 . E5 . D5 . C5 . D5 . C5 . A#4 .
               A4 . C#5 . E5 . G5 . A5 . . . A5 . . .`),
      bass: S(`A1 . A1 . A2 . A1 . A1 . A1 . A2 . A1 .
               A1 . A1 . A2 . A1 . E1 . E1 . E2 . E1 .
               D2 . D2 . D3 . D2 . A#1 . A#1 . A#2 . A#1 .
               A1 . A1 . A2 . A1 . E2 . E2 . E1 . E2 .`),
      drums: 'KKhSKKhSKKhSKShS'
    },
    // Level 30: Yusuf rastet aus. Dur, laut, nach vorn.
    wut: {
      bpm: 168, duty: 'p50',
      lead: S(`C5 . C5 . G5 . . . F5 . E5 . C5 . . .
               D5 . D5 . A5 . . . G5 . F5 . D5 . . .
               E5 . E5 . C6 . . . B5 . A5 . G5 . E5 .
               F5 . G5 . A5 . B5 . C6 . . . C6 . . .`),
      bass: S(`C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 .
               D2 . D3 . D2 . D3 . D2 . D3 . D2 . D3 .
               E2 . E3 . E2 . E3 . A1 . A2 . A1 . A2 .
               F2 . F3 . G2 . G3 . C2 . C3 . C2 . . .`),
      drums: 'K.hSK.hSK.hSKKSS'
    },
    // Die Kraftprobe: HOE HOE HOEOE gegen den Schnipser
    kraftprobe: {
      bpm: 200, duty: 'p25',
      lead: S(`C5 C5 D5 D5 E5 E5 F5 F5 G5 G5 A5 A5 B5 B5 C6 C6
               C6 . G5 . E5 . G5 . C6 . D6 . E6 . . .`),
      bass: S(`C2 . C2 . C2 . C2 . G1 . G1 . G1 . G1 .
               C2 . C2 . C2 . C2 . G1 . G1 . C2 . . .`),
      drums: 'KhKhSKhKKhKhSKhK'
    },
    // Krisensitzung im Stilbruch: ein Plan wird geschmiedet
    jungs: {
      bpm: 120, duty: 'p25',
      lead: S(`E4 . . G4 . . A4 . . . C5 . A4 . . .
               E4 . . G4 . . A#4 . A4 . . . G4 . . .
               E4 . . G4 . . A4 . . . C5 . D5 . . .
               C5 . . A4 . . G4 . E4 . . . . . . .`),
      bass: S(`A2 . . . E2 . . . A2 . . . E2 . . .
               A2 . . . E2 . . . D2 . . . E2 . . .
               A2 . . . E2 . . . A2 . . . E2 . . .
               D2 . . . E2 . . . A2 . . . . . . .`),
      drums: 'K..hS..hK.hhS..h'
    },
    // Abspann: alle zusammen im Stilbruch
    abspann: {
      bpm: 112, duty: 'p50',
      lead: S(`G4 . . . B4 . D5 . G5 . . . F#5 . E5 .
               D5 . . . B4 . G4 . A4 . . . . . . .
               E5 . . . G5 . E5 . D5 . . . B4 . G4 .
               A4 . . . B4 . A4 . G4 . . . . . . .`),
      bass: S(`G2 . . . D3 . . . G2 . . . D3 . . .
               E2 . . . B2 . . . D2 . . . A2 . . .
               C3 . . . G2 . . . G2 . . . D3 . . .
               D2 . . . A2 . . . G2 . . . . . . .`),
      drums: 'K...h...S...h...'
    },
    pizza: {
      bpm: 168, duty: 'p25',
      lead: S(`A4 . D5 . E5 . F5 . E5 . D5 . C#5 . D5 .
               E5 . . . A4 . . . E5 . F5 . G5 . . .
               F5 . E5 . D5 . C5 . A#4 . A4 . G4 . A4 .
               D5 . A4 . F4 . A4 . D5 . . . D5 . . .`),
      bass: S(`D2 . A2 . D2 . A2 . D2 . A2 . D2 . A2 .
               A1 . E2 . A1 . E2 . A1 . E2 . A2 . E2 .
               A#1 . F2 . A#1 . F2 . G1 . D2 . A1 . E2 .
               D2 . A2 . D2 . A2 . D2 . . . D2 . . .`),
      drums: 'K.hS.hK.hS.hK.hS'
    },

    // Endgegner.
    boss: {
      bpm: 172, duty: 'p125',
      lead: S(`D5 D5 . A4 . D5 . F5 . E5 . D5 . A4 . .
               C5 C5 . G4 . C5 . E5 . D5 . C5 . G4 . .
               A#4 A#4 . F4 . A#4 . D5 . C5 . A#4 . F4 . .
               A4 . C5 . E5 . A5 . G5 . F5 . E5 . D5 .`),
      bass: S(`D2 . D2 . D2 . D2 . A2 . A2 . A2 . A2 .
               C2 . C2 . C2 . C2 . G2 . G2 . G2 . G2 .
               A#1 . A#1 . A#1 . A#1 . F2 . F2 . F2 . F2 .
               A1 . A1 . A1 . A1 . A2 . A2 . A2 . A2 .`),
      drums: 'KKh.S.hKKKh.S.hh'
    }
  };

  /* ------------------------- Sequencer ------------------------- */

  var cur = null, curName = null, stepIdx = 0, nextTime = 0, timer = null;

  function schedule() {
    if (!cur || !ready || muted) return;
    var stepDur = 60 / cur.bpm / 4; // 16tel
    var horizon = ctx.currentTime + 0.14;
    var guard = 0;
    while (nextTime < horizon && guard++ < 64) {
      playStep(stepIdx, nextTime, stepDur);
      nextTime += stepDur;
      stepIdx++;
    }
  }

  function playStep(i, at, stepDur) {
    var L = cur.lead, B = cur.bass, D = cur.drums;
    var ln = L[i % L.length];
    if (ln && ln !== '.') {
      var f = freq(ln);
      if (f) tone({ at: at, wave: cur.duty, f0: f, dur: stepDur * 2.6,
                    gain: 0.30, bus: musicGain, attack: 0.008 });
    }
    var bn = B[i % B.length];
    if (bn && bn !== '.') {
      var bf = freq(bn);
      if (bf) tone({ at: at, wave: 'triangle', f0: bf, dur: stepDur * 3.2,
                     gain: 0.46, bus: musicGain, attack: 0.006 });
    }
    var dch = D.charAt(i % D.length);
    if (dch === 'K') kick(at, musicGain);
    else if (dch === 'S') snare(at, musicGain);
    else if (dch === 'h' || dch === 'H') hat(at, musicGain);
  }

  function playMusic(name) {
    if (!init()) return;
    if (curName === name) return;
    var song = SONGS[name];
    curName = name;
    cur = song || null;
    stepIdx = 0;
    nextTime = ctx.currentTime + 0.06;
    if (!timer) timer = setInterval(schedule, 25);
  }

  function stopMusic() {
    cur = null; curName = null;
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* ------------------------- Jingles ------------------------- */

  function jingle(notes, bpm, wave) {
    if (!init()) return;
    var t = ctx.currentTime + 0.02;
    var d = 60 / (bpm || 140) / 2;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (n !== '.') {
        var f = freq(n);
        if (f) tone({ at: t, wave: wave || 'p25', f0: f, dur: d * 1.8, gain: 0.5 });
      }
      t += d;
    }
  }

  /* ------------------------- Soundeffekte ------------------------- */

  var SFX = {
    jump: function () {
      tone({ wave: 'p50', f0: 300, f1: 680, dur: 0.11, gain: 0.42 });
    },
    doubleJump: function () {
      tone({ wave: 'p25', f0: 480, f1: 980, dur: 0.13, gain: 0.40 });
      noise({ filter: 'highpass', f0: 3000, dur: 0.08, gain: 0.12 });
    },
    land: function () {
      noise({ filter: 'lowpass', f0: 800, f1: 180, dur: 0.07, gain: 0.20 });
    },
    honey: function (n) {
      var f = 900 + Math.min(n || 0, 12) * 45;
      tone({ wave: 'p25', f0: f, dur: 0.05, gain: 0.30 });
      tone({ at: (ctx ? ctx.currentTime : 0) + 0.045, wave: 'p25',
             f0: f * 1.5, dur: 0.09, gain: 0.28 });
    },
    stomp: function () {
      tone({ wave: 'p125', f0: 620, f1: 160, dur: 0.12, gain: 0.45 });
      noise({ filter: 'bandpass', f0: 1600, f1: 400, dur: 0.1, gain: 0.25 });
    },
    pound: function () {
      noise({ filter: 'lowpass', f0: 2400, f1: 90, dur: 0.22, gain: 0.42 });
      tone({ wave: 'sine', f0: 200, f1: 40, dur: 0.25, gain: 0.6 });
    },
    brk: function () {
      noise({ filter: 'bandpass', f0: 2600, f1: 500, dur: 0.16, gain: 0.34, q: 0.7 });
      tone({ wave: 'p50', f0: 420, f1: 120, dur: 0.12, gain: 0.25 });
    },
    hurt: function () {
      tone({ wave: 'sawtooth', f0: 420, f1: 110, dur: 0.30, gain: 0.42 });
      noise({ filter: 'lowpass', f0: 1400, f1: 200, dur: 0.18, gain: 0.18 });
    },
    heal: function () {
      jingle(['C5', 'E5', 'G5'], 300, 'p50');
    },
    power: function () {
      jingle(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'], 420, 'p25');
    },
    oneUp: function () {
      jingle(['E5', 'G5', 'C6', 'E6', '.', 'C6', 'E6'], 300, 'p25');
    },
    checkpoint: function () {
      jingle(['G4', 'C5', 'E5'], 320, 'p50');
    },
    // Yusufs Lachen. Unverwechselbar.
    laugh: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      var pitches = [520, 470, 430, 395];
      for (var i = 0; i < pitches.length; i++) {
        tone({ at: t + i * 0.085, wave: 'p125', f0: pitches[i],
               f1: pitches[i] * 0.86, dur: 0.075, gain: 0.5,
               vibrato: 28, vibratoDepth: 22 });
      }
    },
    // Yusufs tiefes Goblin-Knurren. KRRRRR.
    growl: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      tone({ at: t, wave: 'sawtooth', f0: 98, f1: 58, dur: 0.44, gain: 0.52,
             vibrato: 19, vibratoDepth: 28, attack: 0.02 });
      tone({ at: t + 0.015, wave: 'square', f0: 49, f1: 31, dur: 0.42, gain: 0.30,
             vibrato: 24, vibratoDepth: 13, attack: 0.02 });
      noise({ at: t, filter: 'lowpass', f0: 560, f1: 170, dur: 0.40,
              gain: 0.20, q: 0.7 });
    },
    // Kippe werfen
    flick: function () {
      tone({ wave: 'p125', f0: 1250, f1: 430, dur: 0.07, gain: 0.24 });
      noise({ filter: 'highpass', f0: 2700, dur: 0.09, gain: 0.13 });
    },
    // Päckchen aufheben: Feuerzeug-Klick, dann Fanfare
    smokePower: function () {
      noise({ filter: 'highpass', f0: 3400, dur: 0.05, gain: 0.24, q: 1.4 });
      jingle(['G4', 'C5', 'E5', 'G5', 'C6'], 400, 'p125');
    },
    bossHit: function () {
      tone({ wave: 'sawtooth', f0: 300, f1: 80, dur: 0.22, gain: 0.5 });
      noise({ filter: 'bandpass', f0: 900, f1: 200, dur: 0.2, gain: 0.3 });
    },
    bossRoar: function () {
      tone({ wave: 'sawtooth', f0: 90, f1: 230, dur: 0.6, gain: 0.5 });
      noise({ filter: 'lowpass', f0: 300, f1: 1800, dur: 0.6, gain: 0.25 });
    },
    shoot: function () {
      tone({ wave: 'p125', f0: 900, f1: 260, dur: 0.09, gain: 0.26 });
    },
    die: function () {
      stopMusic();
      jingle(['C5', 'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4'],
             340, 'p50');
    },
    win: function () {
      stopMusic();
      jingle(['C5', 'C5', 'C5', 'C5', 'G#4', 'A#4', 'C5', '.', 'A#4', 'C5'],
             230, 'p25');
    },
    select: function () {
      tone({ wave: 'p50', f0: 660, dur: 0.05, gain: 0.26 });
    },
    move: function () {
      tone({ wave: 'p50', f0: 440, dur: 0.035, gain: 0.18 });
    },
    pause: function () {
      tone({ wave: 'p25', f0: 520, f1: 780, dur: 0.09, gain: 0.3 });
    },
    coinBlock: function () {
      tone({ wave: 'p25', f0: 990, dur: 0.04, gain: 0.32 });
      tone({ at: (ctx ? ctx.currentTime : 0) + 0.04, wave: 'p25',
             f0: 1480, dur: 0.12, gain: 0.3 });
    },
    snore: function () {
      tone({ wave: 'sawtooth', f0: 110, f1: 70, dur: 0.5, gain: 0.16,
             vibrato: 7, vibratoDepth: 14 });
    },
    // Level 8: Erfan ruft an. Zweiklang, zweimal — wie ein altes Handy.
    ring: function () {
      var t0 = ctx ? ctx.currentTime : 0;
      [0, 0.16].forEach(function (d) {
        tone({ at: t0 + d, wave: 'p50', f0: 1320, dur: 0.1, gain: 0.22 });
        tone({ at: t0 + d + 0.08, wave: 'p50', f0: 990, dur: 0.1, gain: 0.22 });
      });
    },
    // Ein Bissen.
    bite: function () {
      tone({ wave: 'sawtooth', f0: 260, f1: 90, dur: 0.11, gain: 0.26 });
      noise({ dur: 0.1, gain: 0.2, f0: 2600, f1: 600 });
    },
    // Level 21: ein BB. Pff-tack.
    bb: function () {
      tone({ wave: 'p125', f0: 1800, f1: 600, dur: 0.04, gain: 0.16 });
      noise({ filter: 'highpass', f0: 3000, dur: 0.03, gain: 0.1 });
    },
    // Neues Magazin: klick, klack
    reload: function () {
      var t0 = ctx ? ctx.currentTime : 0;
      noise({ at: t0, filter: 'bandpass', f0: 1800, dur: 0.04, gain: 0.3, q: 2 });
      tone({ at: t0 + 0.09, wave: 'p50', f0: 380, f1: 620, dur: 0.05, gain: 0.26 });
      noise({ at: t0 + 0.09, filter: 'bandpass', f0: 2400, dur: 0.04, gain: 0.3, q: 2 });
    },
    // Der Sniper: ein langer, scharfer Schuss
    sniper: function () {
      tone({ wave: 'sawtooth', f0: 1400, f1: 300, dur: 0.12, gain: 0.3 });
      noise({ filter: 'highpass', f0: 2200, dur: 0.1, gain: 0.2 });
    },
    // Die Granate piept
    beep: function () {
      tone({ wave: 'p50', f0: 1760, dur: 0.05, gain: 0.2 });
    },
    // ... und dann: Puff
    pop: function () {
      noise({ filter: 'lowpass', f0: 3000, f1: 300, dur: 0.2, gain: 0.4 });
      tone({ wave: 'sine', f0: 300, f1: 80, dur: 0.15, gain: 0.45 });
    },
    // Ein BB trifft Sonnet
    plopp: function () {
      tone({ wave: 'p50', f0: 700, f1: 300, dur: 0.05, gain: 0.24 });
    },
    // Im Traum: Bauch-Flattern
    flap: function () {
      tone({ wave: 'p25', f0: 300, f1: 520, dur: 0.08, gain: 0.22 });
      noise({ filter: 'highpass', f0: 2000, dur: 0.05, gain: 0.08 });
    },
    // Mirkans Mercedes: Zweiklang-Hupe, leicht schief
    hupe: function () {
      tone({ wave: 'p50', f0: 392, dur: 0.32, gain: 0.26 });
      tone({ wave: 'p50', f0: 494, dur: 0.32, gain: 0.22 });
    },
    // Vollbremsung im Waldboden
    quietschen: function () {
      tone({ wave: 'p125', f0: 1900, f1: 1500, dur: 0.34, gain: 0.14, vibrato: 30, vibratoDepth: 60 });
      noise({ filter: 'bandpass', f0: 1200, f1: 500, dur: 0.3, gain: 0.2 });
    },
    // Die Tuer fliegt auf: ein Tritt
    tuer: function () {
      noise({ filter: 'lowpass', f0: 1800, f1: 120, dur: 0.3, gain: 0.55 });
      tone({ wave: 'sine', f0: 140, f1: 50, dur: 0.3, gain: 0.6 });
    },
    // Glas. Viel Glas.
    klirr: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 5; i++) {
        noise({ at: t + i * 0.035, filter: 'highpass', f0: 4200 - i * 300, dur: 0.07, gain: 0.22 });
        tone({ at: t + i * 0.035, wave: 'p125', f0: 2600 + i * 180, f1: 1800, dur: 0.05, gain: 0.08 });
      }
    },
    // Alarm an der Sicherheitskontrolle: zwei Toene, auf und ab
    alarm: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      tone({ at: t, wave: 'p50', f0: 880, dur: 0.16, gain: 0.2 });
      tone({ at: t + 0.17, wave: 'p50', f0: 660, dur: 0.16, gain: 0.2 });
    },
    // Ein Flugzeug landet im Wasser
    platsch: function () {
      noise({ filter: 'lowpass', f0: 3000, f1: 200, dur: 0.7, gain: 0.5 });
      tone({ wave: 'sine', f0: 220, f1: 60, dur: 0.5, gain: 0.5 });
    },
    // Trophaee freigeschaltet: kurzes Glitzern
    trophaee: function () {
      jingle(['E5', 'B5', 'E6'], 520, 'p25');
      tone({ at: (ctx ? ctx.currentTime : 0) + 0.18, wave: 'p125', f0: 1760, dur: 0.25, gain: 0.18 });
    },
    // Semihs Schnipser: ein Klick — und dann der Knall
    schnips: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      tone({ at: t, wave: 'p125', f0: 2600, f1: 900, dur: 0.04, gain: 0.3 });
      noise({ at: t + 0.06, filter: 'lowpass', f0: 2600, f1: 80, dur: 0.5, gain: 0.55 });
      tone({ at: t + 0.06, wave: 'sine', f0: 160, f1: 30, dur: 0.5, gain: 0.7 });
    },
    // Die Tuerklingel bei Balcis: Ding. Dong.
    klingel: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      tone({ at: t, wave: 'sine', f0: 880, dur: 0.45, gain: 0.34 });
      tone({ at: t + 0.4, wave: 'sine', f0: 698, dur: 0.7, gain: 0.34 });
    },
    // Eine Dimension zerbricht
    riss: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 7; i++) {
        noise({ at: t + i * 0.03, filter: 'highpass', f0: 5000 - i * 400, dur: 0.09, gain: 0.24 });
      }
      tone({ at: t, wave: 'sawtooth', f0: 70, f1: 30, dur: 0.8, gain: 0.45 });
    },
    // Der Terlik trifft. Jedes Kind kennt dieses Geraeusch.
    terlik: function () {
      noise({ filter: 'bandpass', f0: 1600, f1: 700, dur: 0.07, gain: 0.55, q: 0.8 });
      tone({ wave: 'p50', f0: 240, f1: 90, dur: 0.08, gain: 0.3 });
    },
    // Ein Gong fuer die grossen Momente
    gong: function () {
      tone({ wave: 'sine', f0: 110, f1: 104, dur: 1.6, gain: 0.5 });
      tone({ wave: 'p125', f0: 220, f1: 208, dur: 0.9, gain: 0.14 });
    },
    // Zwei Strahlen druecken gegeneinander
    strahl: function () {
      tone({ wave: 'sawtooth', f0: 180, f1: 240, dur: 0.12, gain: 0.2, vibrato: 30, vibratoDepth: 20 });
    },
    // Die Pruegelwolke
    pruegel: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) {
        noise({ at: t + i * 0.07, filter: 'bandpass', f0: 600 + Math.random() * 1400, dur: 0.06, gain: 0.35 });
      }
    },
    // Mirkan weint. Laut.
    heulen: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      tone({ at: t, wave: 'p25', f0: 820, f1: 560, dur: 0.28, gain: 0.26, vibrato: 11, vibratoDepth: 40 });
      tone({ at: t + 0.3, wave: 'p25', f0: 700, f1: 430, dur: 0.4, gain: 0.24, vibrato: 9, vibratoDepth: 50 });
    },
    /* --- Ich-Perspektive (fahrt, downhill, rennen) --- */
    // Knapp vorbei: Luft reisst, Doppler nach unten
    whoosh: function () {
      noise({ filter: 'bandpass', f0: 3200, f1: 500, dur: 0.24, gain: 0.32, q: 1.2 });
      tone({ wave: 'p125', f0: 900, f1: 340, dur: 0.2, gain: 0.08 });
    },
    // Nitro: Zischen und ein Ton, der nach oben schiesst
    nitro: function () {
      noise({ filter: 'highpass', f0: 1800, f1: 5200, dur: 0.45, gain: 0.3, q: 0.7 });
      tone({ wave: 'sawtooth', f0: 110, f1: 330, dur: 0.4, gain: 0.22 });
    },
    // Donner: tiefes Grollen, das ausrollt
    donner: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      noise({ at: t, filter: 'lowpass', f0: 900, f1: 60, dur: 1.4, gain: 0.5, q: 0.5 });
      noise({ at: t + 0.15, filter: 'lowpass', f0: 400, f1: 50, dur: 1.2, gain: 0.35, q: 0.5 });
    },
    // Metall auf Asphalt
    schaben: function () {
      noise({ filter: 'highpass', f0: 2600, f1: 1400, dur: 0.18, gain: 0.22, q: 2 });
      tone({ wave: 'p125', f0: 2200, f1: 1600, dur: 0.12, gain: 0.06 });
    },
    // Der Scheibenwischer: wusch
    wischer: function () {
      noise({ filter: 'bandpass', f0: 900, f1: 1500, dur: 0.22, gain: 0.12, q: 0.8 });
    },
    // Grosse Explosion: tief, breit, mit Nachhall
    bumm: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      noise({ at: t, filter: 'lowpass', f0: 3200, f1: 70, dur: 0.7, gain: 0.6, q: 0.5 });
      tone({ at: t, wave: 'sine', f0: 120, f1: 32, dur: 0.6, gain: 0.75 });
      noise({ at: t + 0.08, filter: 'bandpass', f0: 1200, f1: 200, dur: 0.5, gain: 0.25 });
    },
    // Blech: es kracht
    crash: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      noise({ at: t, filter: 'bandpass', f0: 1800, f1: 300, dur: 0.35, gain: 0.5, q: 0.6 });
      tone({ at: t, wave: 'sawtooth', f0: 180, f1: 60, dur: 0.3, gain: 0.35 });
      for (var i = 0; i < 3; i++) noise({ at: t + 0.05 + i * 0.05, filter: 'highpass', f0: 3800 - i * 500, dur: 0.06, gain: 0.16 });
    },
    // Der Anlasser: wrr-wrr-wrr, dann springt der V8 an (BRRAP)
    anlasser: function () {
      if (!init()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 3; i++) {
        tone({ at: t + i * 0.19, wave: 'sawtooth', f0: 92, f1: 128, dur: 0.15, gain: 0.22, vibrato: 18, vibratoDepth: 14 });
        noise({ at: t + i * 0.19, filter: 'bandpass', f0: 900, f1: 600, dur: 0.14, gain: 0.08 });
      }
      noise({ at: t + 0.6, filter: 'lowpass', f0: 1800, f1: 200, dur: 0.35, gain: 0.45 });
      tone({ at: t + 0.6, wave: 'square', f0: 70, f1: 140, dur: 0.3, gain: 0.3 });
    },
    // Salat an der Scheibe
    klatsch: function () {
      noise({ filter: 'lowpass', f0: 1400, f1: 300, dur: 0.12, gain: 0.4 });
      tone({ wave: 'sine', f0: 240, f1: 120, dur: 0.1, gain: 0.3 });
    }
  };

  /* ------------------------- Motor und Fahrtwind -------------------------
     Ein Dauerton, solange gefahren wird: motor(art, k, extra) bei jedem
     Schritt aufrufen (k = Tempo 0..1.4, art 'auto' oder 'rad'). Kommt
     laenger kein Aufruf (Pause, Menue, Level vorbei), wird er von selbst
     leise. extra: gas (Fuss auf dem Gas), boost (Nitro), luft (in der Luft).

     Das Auto ist ein Mustang, also ein V8 (Esat, 02.10.: "Autosound
     brachialer, richtigen V8-Sound"). Gebaut wie ein echter:
       - Zuendfrequenz = Drehzahl / 60 * 4 (acht Zylinder, vier Takte)
       - darunter das Kurbelwellen-Brummen (halbe und viertel Frequenz)
       - das Blubbern des V8: die Lautstaerke pulsiert mit einem Viertel
         und einem Achtel der Zuendfrequenz — im Leerlauf deutlich
         ("potato-potato"), oben glatter
       - durch eine Verzerrung (Saettigung), dann ein Tiefpass, der bei Gas
         weit aufmacht
       - fuenf Gaenge: die Drehzahl steigt, beim Hochschalten faellt sie
         (mit einem kurzen Knick), in der Luft heult er auf
       - wer vom Gas geht, hoert den Auspuff patschen
       - Nitro: noch heller, noch lauter */
  var motorN = null, motorZuletzt = -1, motorGestellt = -1;
  var MZ = { rpm: 850, gang: 0, gas: false, knickT: 0 };
  var GAENGE = [0, 0.2, 0.4, 0.6, 0.8, 1.04, 9];

  function v8Welle() {
    // Schmaler Auspuff-Puls mit kraeftiger zweiter Harmonischer
    var n = 40, real = new Float32Array(n), imag = new Float32Array(n), d = 0.18;
    for (var i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * d) * (i === 2 ? 1.5 : 1);
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }
  function saettigung(drive) {
    var n = 1024, c = new Float32Array(n), d = Math.tanh(drive);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * drive) / d; }
    return c;
  }

  function motorBauen() {
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    var mix = ctx.createGain(), sub = ctx.createGain(), sub2 = ctx.createGain();
    var shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter();
    var am = ctx.createGain(), knick = ctx.createGain(), out = ctx.createGain();
    var lfo1 = ctx.createOscillator(), lfo2 = ctx.createOscillator(), d1 = ctx.createGain(), d2 = ctx.createGain();
    var rn = ctx.createBufferSource(), rbp = ctx.createBiquadFilter(), rg = ctx.createGain();
    o1.setPeriodicWave(v8Welle());
    o2.type = 'triangle'; o3.type = 'sine';
    sub.gain.value = 0.7; sub2.gain.value = 0.55; mix.gain.value = 0.9;
    shaper.curve = saettigung(3.2); shaper.oversample = '2x';
    lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 3.2;
    am.gain.value = 0.8; knick.gain.value = 1; out.gain.value = 0.0001;
    lfo1.type = 'sine'; lfo2.type = 'triangle';
    d1.gain.value = 0.25; d2.gain.value = 0.18;
    // Rauer Auspuff: Rauschen um die doppelte Zuendfrequenz, pulsiert mit
    rn.buffer = noiseBuf; rn.loop = true;
    rbp.type = 'bandpass'; rbp.frequency.value = 300; rbp.Q.value = 1.4;
    rg.gain.value = 0.35;
    o1.connect(mix); o2.connect(sub); sub.connect(mix); o3.connect(sub2); sub2.connect(mix);
    rn.connect(rbp); rbp.connect(rg); rg.connect(mix);
    mix.connect(shaper); shaper.connect(lp); lp.connect(am); am.connect(knick); knick.connect(out); out.connect(sfxGain);
    lfo1.connect(d1); d1.connect(am.gain); lfo2.connect(d2); d2.connect(am.gain);
    // Fahrtwind
    var wn = ctx.createBufferSource(), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
    wn.buffer = noiseBuf; wn.loop = true;
    wf.type = 'bandpass'; wf.frequency.value = 700; wf.Q.value = 0.55;
    wg.gain.value = 0.0001;
    wn.connect(wf); wf.connect(wg); wg.connect(sfxGain);
    [o1, o2, o3, lfo1, lfo2, rn, wn].forEach(function (o) { o.start(); });
    motorN = { o1: o1, o2: o2, o3: o3, lfo1: lfo1, lfo2: lfo2, d1: d1, d2: d2, am: am, lp: lp, rbp: rbp,
               knick: knick, out: out, wf: wf, wg: wg };
    setInterval(motorWache, 120);
  }

  /** Beim Hochschalten: ganz kurz weg vom Gas, dann wieder voll. */
  function schaltKnick(t) {
    var kg = motorN.knick.gain;
    kg.cancelScheduledValues(t);
    kg.setValueAtTime(1, t);
    kg.linearRampToValueAtTime(0.3, t + 0.035);
    kg.linearRampToValueAtTime(1, t + 0.17);
    noise({ at: t, filter: 'bandpass', f0: 2400, dur: 0.03, gain: 0.08, q: 2 });
  }
  /** Patschen im Auspuff, wenn man bei hoher Drehzahl vom Gas geht. */
  function patschen(t, n) {
    for (var i = 0; i < n; i++) {
      var at = t + 0.06 + i * 0.09 + Math.random() * 0.05;
      noise({ at: at, filter: 'lowpass', f0: 2600, f1: 260, dur: 0.045, gain: 0.32 });
      tone({ at: at, wave: 'square', f0: 110, f1: 46, dur: 0.04, gain: 0.16 });
    }
  }

  function motor(art, k, extra) {
    if (!ready || !ctx || ctx.state === 'closed') return;
    if (!motorN) motorBauen();
    motorZuletzt = ctx.currentTime;
    // Nicht oefter als alle 30 ms nachstellen (sonst stapeln sich die Rampen)
    if (motorGestellt >= 0 && ctx.currentTime - motorGestellt < 0.03) return;
    motorGestellt = ctx.currentTime;
    var t = ctx.currentTime, n = motorN, an = muted ? 0 : 1;
    k = Math.max(0, Math.min(1.4, k || 0));
    extra = extra || {};
    if (art === 'auto') {
      var gas = extra.gas === undefined ? true : !!extra.gas;
      // Gang und Drehzahl aus dem Tempo
      var gang = 0;
      while (gang < 5 && k > GAENGE[gang + 1]) gang++;
      var anteil = Math.max(0, Math.min(1.15, (k - GAENGE[gang]) / (GAENGE[gang + 1] - GAENGE[gang])));
      var unten = gang === 0 ? 850 : 3300;
      var rpm = unten + anteil * (6300 - unten);
      if (k < 0.03) rpm = gas ? 2600 + Math.random() * 300 : 850;     // im Stand: Leerlauf oder Gasstoss
      if (extra.luft) rpm = Math.min(7300, rpm * 1.18 + 700);
      if (extra.boost) rpm = Math.min(7300, rpm + 450);
      if (gang > MZ.gang && MZ.gas && gas && k > 0.05) schaltKnick(t);
      if (MZ.gas && !gas && MZ.rpm > 3600) patschen(t, 2 + ((Math.random() * 3) | 0));
      else if (!gas && MZ.rpm > 3000 && Math.random() < 0.05) patschen(t, 1);
      MZ.gang = gang; MZ.gas = gas; MZ.rpm = rpm;
      var f = rpm / 15;                                     // Zuendfrequenz
      n.o1.frequency.setTargetAtTime(f, t, 0.045);
      n.o2.frequency.setTargetAtTime(f / 2, t, 0.045);
      n.o3.frequency.setTargetAtTime(f / 4, t, 0.045);
      n.lfo1.frequency.setTargetAtTime(f / 4, t, 0.045);
      n.lfo2.frequency.setTargetAtTime(f / 8, t, 0.045);
      n.rbp.frequency.setTargetAtTime(f * 2, t, 0.06);
      var lope = Math.max(0.12, Math.min(1, 1 - (rpm - 850) / 4200));
      n.d1.gain.setTargetAtTime(0.3 * lope, t, 0.08);
      n.d2.gain.setTargetAtTime(0.22 * lope, t, 0.08);
      n.am.gain.setTargetAtTime(1 - 0.28 * lope, t, 0.08);
      n.lp.frequency.setTargetAtTime(240 + rpm * (gas ? 0.5 : 0.2) + (extra.boost ? 1100 : 0), t, 0.06);
      var laut = 0.034 + Math.min(1, k) * 0.03 + (gas ? 0.045 : 0.01) + (extra.boost ? 0.025 : 0);
      n.out.gain.setTargetAtTime(Math.max(0.0001, laut * an), t, 0.07);
    } else {
      n.out.gain.setTargetAtTime(0.0001, t, 0.08);
    }
    n.wf.frequency.setTargetAtTime(420 + k * 1500, t, 0.1);
    n.wg.gain.setTargetAtTime(Math.max(0.0001, (0.01 + k * k * (art === 'rad' ? 0.11 : 0.06)) * an), t, 0.1);
  }
  function motorWache() {
    if (!motorN || !ctx) return;
    if (ctx.currentTime - motorZuletzt > 0.25 || muted) {
      motorN.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
      motorN.wg.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
      motorGestellt = -1;
      MZ.gas = false; MZ.gang = 0;
    }
  }

  function play(name, arg) {
    if (!ready) { if (!init()) return; }
    if (muted) return;
    var fn = SFX[name];
    if (fn) fn(arg);
  }

  function setMuted(v) {
    muted = !!v;
    global.Speicher.set('balci_mute', muted ? '1' : '0');
    if (master) master.gain.value = muted ? 0 : 0.85;
    if (muted) { /* Musik läuft weiter, ist nur stumm */ }
  }

  global.Sound = {
    init: init,
    resume: resume,
    play: play,
    music: playMusic,
    stopMusic: stopMusic,
    motor: motor,
    isMuted: function () { return muted; },
    setMuted: setMuted,
    /** Musik und Effekte getrennt, je 0..1 (Einstellungen). */
    setLautstaerke: function (musik, effekte) {
      musikVol = Math.max(0, Math.min(1, musik));
      effektVol = Math.max(0, Math.min(1, effekte));
      if (musicGain) musicGain.gain.value = MUSIK_BASIS * musikVol;
      if (sfxGain) sfxGain.gain.value = EFFEKT_BASIS * effektVol;
    },
    toggleMute: function () { setMuted(!muted); return muted; }
  };

})(window);
