/* =====================================================================
   input.js — Tastatur, Gamepad und Touch auf ein gemeinsames
   Aktions-Set abgebildet.
   ===================================================================== */
(function (global) {
  'use strict';

  var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'run', 'throw',
                 'pause', 'mute', 'confirm', 'back', 'puff'];

  var KEYMAP = {
    'ArrowLeft': ['left'], 'KeyA': ['left'],
    'ArrowRight': ['right'], 'KeyD': ['right'],
    'ArrowUp': ['up', 'jump'], 'KeyW': ['up', 'jump'],
    'ArrowDown': ['down'], 'KeyS': ['down'],
    'Space': ['jump', 'confirm'],
    'KeyK': ['jump'],
    'KeyJ': ['jump'],
    'ShiftLeft': ['run', 'throw'], 'ShiftRight': ['run', 'throw'],
    'KeyE': ['throw'], 'KeyF': ['throw'], 'KeyX': ['throw'],
    'Enter': ['confirm'],
    'NumpadEnter': ['confirm'],
    'Escape': ['pause', 'back'],
    'KeyP': ['pause'],
    'KeyM': ['mute'],
    'KeyC': ['puff'],          // Level 14: an der Shisha auspusten
    'Backspace': ['back']
  };

  /* ---------------- Tastenbelegung (Einstellungen) ----------------
     Was man selbst belegen kann. Eine eigene Taste macht danach NUR
     noch diese Aktion — die Standardtasten der Aktion (z. B. die Pfeile)
     bleiben aber zusaetzlich aktiv. So kann man sich nie aussperren. */
  var STANDARD = KEYMAP;
  var BELEGBAR = {
    left: ['left'], right: ['right'], up: ['up'], down: ['down'], jump: ['jump'],
    throw: ['run', 'throw'], pause: ['pause'], puff: ['puff']
  };
  var eigene = {};
  var fangen = null;     // wartet auf die naechste Taste (Einstellungen)

  function neuBauen() {
    var m = {}, code;
    for (code in STANDARD) m[code] = STANDARD[code].slice();
    Object.keys(eigene).forEach(function (k) {
      if (BELEGBAR[k] && eigene[k]) m[eigene[k]] = BELEGBAR[k].slice();
    });
    KEYMAP = m;
    releaseKeyboard();
  }

  /** Erste Standardtaste einer belegbaren Aktion (fuer die Anzeige). */
  function standardTaste(k) {
    var a = BELEGBAR[k] && BELEGBAR[k][0];
    for (var code in STANDARD) if (STANDARD[code][0] === a) return code;
    return null;
  }

  var TASTEN_NAMEN = {
    Space: 'LEERTASTE', ArrowLeft: 'PFEIL LINKS', ArrowRight: 'PFEIL RECHTS', ArrowUp: 'PFEIL HOCH',
    ArrowDown: 'PFEIL RUNTER', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT RECHTS', ControlLeft: 'STRG',
    ControlRight: 'STRG RECHTS', AltLeft: 'ALT', Enter: 'ENTER', NumpadEnter: 'ENTER', Escape: 'ESC',
    Backspace: 'RÜCKTASTE', Tab: 'TAB', CapsLock: 'FESTSTELL'
  };
  function tastenName(code) {
    if (!code) return '-';
    if (TASTEN_NAMEN[code]) return TASTEN_NAMEN[code];
    return code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase();
  }

  var held = {};      // Aktion -> true, solange gedrückt
  var pressed = {};   // Aktion -> true, nur in diesem Frame
  var released = {};
  var anyPressed = false;

  /* Jede Quelle fuehrt ihren eigenen Zustand: Tastatur (wie viele Tasten
     halten die Aktion gerade), Touch-Knoepfe, Controller, kurzes Tippen.
     Gedrueckt ist eine Aktion, solange irgendeine Quelle sie haelt.
     Frueher gab es nur einen Wert pro Aktion: Wer Pfeil links und A hielt
     und A losliess, lief nicht mehr — und ein eingesteckter Controller hat
     die gehaltene Tastatur losgelassen. */
  var kbCount = {}, touchCount = {}, padOn = {}, tapOn = {};
  var keysDown = {};
  // Womit zuletzt gespielt wurde: 'tasten', 'pad' oder 'touch' (fuer die
  // Hinweise auf dem Bildschirm — mit Controller keine Tastatur-Namen)
  var quelle = 'tasten';

  ACTIONS.forEach(function (a) {
    held[a] = false; pressed[a] = false; released[a] = false;
    kbCount[a] = 0; touchCount[a] = 0; padOn[a] = false; tapOn[a] = 0;
  });

  function recompute(a) {
    var v = kbCount[a] > 0 || touchCount[a] > 0 || padOn[a] || tapOn[a] > 0;
    if (v && !held[a]) { pressed[a] = true; anyPressed = true; }
    if (!v && held[a]) released[a] = true;
    held[a] = v;
  }

  /* ---------------- Tastatur ---------------- */

  function typingInField(e) {
    var t = e.target;
    return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'));
  }

  global.addEventListener('keydown', function (e) {
    // Im Namensfeld tippt man Text, man steuert nicht Yusuf
    if (typingInField(e)) return;
    // Einstellungen: die naechste Taste wird belegt, nicht gespielt
    if (fangen && !e.repeat) {
      e.preventDefault();
      var cb = fangen; fangen = null;
      cb(e.code);
      return;
    }
    var acts = KEYMAP[e.code];
    if (!acts) return;
    // Scrollen und Seitensprünge unterdrücken
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (e.repeat || keysDown[e.code]) return;
    keysDown[e.code] = true;
    quelle = 'tasten';
    for (var i = 0; i < acts.length; i++) { kbCount[acts[i]]++; recompute(acts[i]); }
  }, { passive: false });

  global.addEventListener('keyup', function (e) {
    if (typingInField(e)) return;
    var acts = KEYMAP[e.code];
    if (!acts || !keysDown[e.code]) return;
    delete keysDown[e.code];
    for (var i = 0; i < acts.length; i++) {
      kbCount[acts[i]] = Math.max(0, kbCount[acts[i]] - 1);
      recompute(acts[i]);
    }
  });

  function releaseKeyboard() {
    keysDown = {};
    ACTIONS.forEach(function (a) { kbCount[a] = 0; recompute(a); });
  }

  // Beim Fokusverlust alles loslassen, sonst rennt Yusuf für immer weiter.
  global.addEventListener('blur', function () {
    releaseKeyboard();
    Object.keys(touchState).forEach(function (k) { setKey(k, false); });
  });

  /* ---------------- Touch ---------------- */

  var touchState = {};
  var tapPos = null;    // letztes Tippen aufs Bild, in Spielkoordinaten

  function actsFor(key) {
    return (key === 'jump') ? ['jump', 'confirm']
         : (key === 'pause') ? ['pause']
         : (key === 'throw') ? ['throw', 'run']
         : [key];
  }

  function setKey(key, v) {
    if (!!touchState[key] === v) return;
    touchState[key] = v;
    if (v) quelle = 'touch';
    actsFor(key).forEach(function (a) {
      touchCount[a] = Math.max(0, touchCount[a] + (v ? 1 : -1));
      recompute(a);
    });
    var el = document.querySelector('#touch .tbtn[data-key="' + key + '"]');
    if (el) el.classList.toggle('on', v);
  }

  /* Alle Finger auf einmal auswerten: welcher Finger liegt gerade auf
     welchem Knopf? So kann man vom Links- auf den Rechts-Knopf rutschen,
     ohne den Daumen anzuheben — wie bei einem echten Steuerkreuz. */
  function refreshTouches(e) {
    e.preventDefault();
    var want = {};
    for (var i = 0; i < e.touches.length; i++) {
      var t = e.touches[i];
      var el = document.elementFromPoint(t.clientX, t.clientY);
      var k = el && el.getAttribute ? el.getAttribute('data-key') : null;
      if (k) want[k] = true;
    }
    var btns = document.querySelectorAll('#touch .tbtn[data-key]');
    for (var j = 0; j < btns.length; j++) {
      var key = btns[j].getAttribute('data-key');
      setKey(key, !!want[key]);
    }
  }

  function bindTouch() {
    var btns = document.querySelectorAll('#touch .tbtn[data-key]');
    Array.prototype.forEach.call(btns, function (b) {
      var key = b.getAttribute('data-key');
      ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (ev) {
        b.addEventListener(ev, refreshTouches, { passive: false });
      });
      // Maus (z.B. Tablet mit Maus oder Test am PC). Nach einem Fingertipp
      // kommt kein Mausklick hinterher, weil touchstart preventDefault ruft.
      b.addEventListener('mousedown', function (e) { e.preventDefault(); setKey(key, true); });
      b.addEventListener('mouseup', function () { setKey(key, false); });
      b.addEventListener('mouseleave', function () { setKey(key, false); });
    });
  }

  /* Zeiger (Maus oder Finger) auf dem Bild — fuer Level 8, wo man das
     Essen mit der Hand zum Mund zieht. Koordinaten wie im Spielbild. */
  var ptr = { x: 0, y: 0, down: false, justDown: false, justUp: false, on: false };

  function bindPointer(canvas) {
    function toCanvas(cx, cy) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      // In Spiel-Pixeln: die Leinwand ist feiner (licht.js), das Spiel nicht
      return { x: (cx - r.left) / r.width * (canvas.logischW || canvas.width),
               y: (cy - r.top) / r.height * (canvas.logischH || canvas.height) };
    }
    function move(e) {
      var p = toCanvas(e.clientX, e.clientY);
      if (!p) return;
      ptr.x = p.x; ptr.y = p.y; ptr.on = true;
    }
    function down(e) {
      move(e);
      if (!ptr.down) { ptr.down = true; ptr.justDown = true; }
    }
    function up(e) {
      move(e);
      if (ptr.down) { ptr.down = false; ptr.justUp = true; }
    }
    if (global.PointerEvent) {
      canvas.addEventListener('pointerdown', down);
      global.addEventListener('pointermove', move);
      global.addEventListener('pointerup', up);
      global.addEventListener('pointercancel', up);
    } else {
      canvas.addEventListener('touchstart', function (e) {
        if (e.touches[0]) down(e.touches[0]);
      }, { passive: true });
      global.addEventListener('touchmove', function (e) {
        if (e.touches[0]) move(e.touches[0]);
      }, { passive: true });
      global.addEventListener('touchend', function (e) {
        if (e.changedTouches[0]) up(e.changedTouches[0]);
      }, { passive: true });
      canvas.addEventListener('mousedown', down);
      global.addEventListener('mousemove', move);
      global.addEventListener('mouseup', up);
    }
  }

  /* Tippen aufs Bild = Bestätigen. Zusätzlich merken wir uns WO getippt
     wurde, damit man Menüpunkte direkt antippen kann. */
  function bindScreenTap(canvas) {
    function tapAt(cx, cy) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tapPos = {
        x: (cx - r.left) / r.width * (canvas.logischW || canvas.width),
        y: (cy - r.top) / r.height * (canvas.logischH || canvas.height)
      };
      tapOn.confirm++; recompute('confirm');
      setTimeout(function () { tapOn.confirm = Math.max(0, tapOn.confirm - 1); recompute('confirm'); }, 60);
    }
    // Ein Tippen = eine Aktion. Frueher zaehlte ein Fingertipp doppelt:
    // einmal als "touchstart" und kurz danach nochmal als nachgeahmter
    // Mausklick des Browsers. Im Dialog wurden so Zeilen uebersprungen,
    // in der Levelauswahl startete ein Tipp direkt das Level.
    if (global.PointerEvent) {
      canvas.addEventListener('pointerdown', function (e) { tapAt(e.clientX, e.clientY); });
    } else {
      var lastTouch = 0;
      canvas.addEventListener('touchstart', function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        lastTouch = Date.now();
        if (t) tapAt(t.clientX, t.clientY);
      }, { passive: true });
      canvas.addEventListener('mousedown', function (e) {
        if (Date.now() - lastTouch < 800) return;
        tapAt(e.clientX, e.clientY);
      });
    }
  }

  /* ---------------- Gamepad ---------------- */

  /* Stick mit Hysterese: ab 0,5 gedrueckt, erst unter 0,3 wieder los.
     Mit einer einzigen Schwelle hat ein leicht driftender Stick jeden
     Frame zwischen gedrueckt und losgelassen gewechselt. */
  var PAD_AN = 0.5, PAD_AUS = 0.3;
  var stick = { left: false, right: false, up: false, down: false };

  function achse(v, neg, pos) {
    if (v === undefined) { stick[neg] = false; stick[pos] = false; return; }
    stick[neg] = stick[neg] ? v < -PAD_AUS : v < -PAD_AN;
    stick[pos] = stick[pos] ? v > PAD_AUS : v > PAD_AN;
  }

  function pollPad() {
    var p = null;
    if (navigator.getGamepads) {
      var pads = navigator.getGamepads();
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { p = pads[i]; break; }
    }
    var st = {};
    if (p) {
      achse(p.axes[0], 'left', 'right');
      achse(p.axes[1], 'up', 'down');
      st = {
        left: stick.left || btn(p, 14),
        right: stick.right || btn(p, 15),
        up: stick.up || btn(p, 12),
        down: stick.down || btn(p, 13),
        // A und B springen beide. B ist in Menues auch "zurueck" —
        // das Pausen- und Game-Over-Menue behandeln "zurueck" deshalb
        // nie als "ins Hauptmenue" (siehe game.js).
        jump: btn(p, 0) || btn(p, 1),
        run: btn(p, 2) || btn(p, 5) || btn(p, 7),
        throw: btn(p, 2) || btn(p, 5) || btn(p, 7),
        pause: btn(p, 9),
        confirm: btn(p, 0) || btn(p, 9),
        back: btn(p, 1) || btn(p, 8)
      };
    }
    ACTIONS.forEach(function (a) {
      var v = !!st[a];
      if (v !== padOn[a]) { padOn[a] = v; recompute(a); if (v) quelle = 'pad'; }
    });
  }

  function btn(p, i) { return !!(p.buttons[i] && p.buttons[i].pressed); }

  /* ---------------- API ---------------- */

  function endFrame() {
    ACTIONS.forEach(function (a) { pressed[a] = false; released[a] = false; });
    anyPressed = false;
    tapPos = null;
    ptr.justDown = false; ptr.justUp = false;
  }

  /** Alles loslassen — z.B. wenn ein Eingabefeld den Fokus bekommt. */
  function releaseAll() {
    releaseKeyboard();
    Object.keys(touchState).forEach(function (k) { setKey(k, false); });
    ACTIONS.forEach(function (a) { padOn[a] = false; tapOn[a] = 0; recompute(a); });
  }

  global.Input = {
    init: function (canvas) { bindTouch(); bindScreenTap(canvas); bindPointer(canvas); },
    poll: pollPad,
    down: function (a) { return !!held[a]; },
    hit: function (a) { return !!pressed[a]; },
    up: function (a) { return !!released[a]; },
    anyHit: function () {
      for (var i = 0; i < ACTIONS.length; i++) if (pressed[ACTIONS[i]]) return true;
      return false;
    },
    axis: function () {
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    /** Wo in diesem Frame aufs Bild getippt wurde (oder null). */
    tap: function () { return tapPos; },
    /** Maus-/Fingerzeiger auf dem Bild: {x, y, down, justDown, justUp}. */
    pointer: function () { return ptr; },
    releaseAll: releaseAll,
    endFrame: endFrame,
    /* Tastenbelegung (optionen.js) */
    BELEGBAR: Object.keys(BELEGBAR),
    /** Eigene Tasten setzen: { aktion: 'KeyZ', ... } (unbekanntes wird ignoriert). */
    setBelegung: function (map) {
      eigene = {};
      if (map && typeof map === 'object') {
        Object.keys(BELEGBAR).forEach(function (k) {
          var c = map[k];
          if (typeof c === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c) && c !== 'Escape') eigene[k] = c;
        });
      }
      neuBauen();
    },
    belegung: function () { var o = {}; Object.keys(eigene).forEach(function (k) { o[k] = eigene[k]; }); return o; },
    /** Welche Taste die Aktion gerade hat: die eigene, sonst die Standardtaste. */
    tasteFuer: function (k) { return eigene[k] || standardTaste(k); },
    tastenName: tastenName,
    quelle: function () { return quelle; },
    /** Haelt der Controller diese Aktion gerade? (Namenseingabe) */
    padDown: function (a) { return !!padOn[a]; },
    /** Ist ein Controller angeschlossen? */
    padDa: function () {
      if (!navigator.getGamepads) return false;
      var pads = navigator.getGamepads();
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return true;
      return false;
    },
    /** Die naechste gedrueckte Taste abfangen (fuer das Belegen). */
    naechsteTaste: function (cb) { fangen = cb; releaseKeyboard(); },
    fangenAbbrechen: function () { fangen = null; }
  };

})(window);
