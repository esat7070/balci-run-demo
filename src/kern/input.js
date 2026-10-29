/* =====================================================================
   input.js — Tastatur, Gamepad und Touch auf ein gemeinsames
   Aktions-Set abgebildet.
   ===================================================================== */
(function (global) {
  'use strict';

  /* gas, hopp, nitro: nur in den Autos (Level 6 und 18, Esat 02.10.: "man
     faehrt nur mit W, auf Space springt man"). gas = W / Pfeil hoch / RT,
     hopp = die echte Sprungtaste (Leertaste, A) — damit W nicht nebenbei
     springt —, nitro = Shift / X / RB. */
  // n1-n3: die Zahlentasten (Nils' Quiz, Esat 26.10.: "mit Zahlen 1-3 antworten"),
  // laden: R = nachladen beim Airsoft
  var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'run', 'throw',
                 'pause', 'mute', 'confirm', 'back', 'puff', 'gas', 'hopp', 'nitro', 'stampf', 'dev',
                 'n1', 'n2', 'n3', 'laden'];

  var KEYMAP = {
    'ArrowLeft': ['left'], 'KeyA': ['left'],
    'ArrowRight': ['right'], 'KeyD': ['right'],
    // W springt nicht (Esat, 25.10.) — nur im Auto ist es Gas, im Menue hoch
    'ArrowUp': ['up', 'jump', 'gas'], 'KeyW': ['up', 'gas'],
    'ArrowDown': ['down'], 'KeyS': ['down'],
    'Space': ['jump', 'confirm', 'hopp'],
    'KeyK': ['jump', 'hopp'],
    'KeyJ': ['jump', 'hopp'],
    'ShiftLeft': ['run', 'throw', 'nitro'], 'ShiftRight': ['run', 'throw', 'nitro'],
    'KeyE': ['throw'], 'KeyF': ['throw'], 'KeyX': ['throw'],
    'Enter': ['confirm'],
    'NumpadEnter': ['confirm'],
    'Escape': ['pause', 'back'],
    'KeyP': ['pause'],
    'KeyM': ['mute'],
    'Digit1': ['n1'], 'Digit2': ['n2'], 'Digit3': ['n3'],
    'Numpad1': ['n1'], 'Numpad2': ['n2'], 'Numpad3': ['n3'],
    'KeyR': ['laden'],
    'KeyC': ['puff', 'stampf'],        // Arschbombe (und an der Shisha auspusten)
    'ControlLeft': ['stampf'], 'ControlRight': ['stampf'],
    'Backspace': ['back']
  };

  /* ---------------- Tastenbelegung (Einstellungen) ----------------
     Was man selbst belegen kann. Eine eigene Taste macht danach NUR
     noch diese Aktion — die Standardtasten der Aktion (z. B. die Pfeile)
     bleiben aber zusaetzlich aktiv. So kann man sich nie aussperren. */
  var STANDARD = KEYMAP;
  var BELEGBAR = {
    left: ['left'], right: ['right'], up: ['up', 'gas'], down: ['down'], jump: ['jump', 'hopp'],
    throw: ['run', 'throw', 'nitro'], pause: ['pause'], puff: ['puff'], stampf: ['stampf']
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
  var mausAn = false;     // linke Maustaste gedrueckt (zaehlt als 'throw')
  var keysDown = {};
  // Womit zuletzt gespielt wurde: 'tasten', 'pad' oder 'touch' (fuer die
  // Hinweise auf dem Bildschirm — mit Controller keine Tastatur-Namen)
  var quelle = 'tasten';

  ACTIONS.forEach(function (a) {
    held[a] = false; pressed[a] = false; released[a] = false;
    kbCount[a] = 0; touchCount[a] = 0; padOn[a] = false; tapOn[a] = 0;
  });

  function recompute(a) {
    var v = kbCount[a] > 0 || touchCount[a] > 0 || padOn[a] || tapOn[a] > 0 || (a === 'throw' && mausAn);
    if (v && !held[a]) { pressed[a] = true; anyPressed = true; }
    if (!v && held[a]) released[a] = true;
    held[a] = v;
    if (kbP) recomputeP(1, a);
  }

  /* ---------------- Zu zweit (koop.js) ----------------
     Im Koop-Modus hat jeder Spieler seine eigenen Tasten. Ohne Controller
     teilen sich beide die Tastatur: Spieler 1 links (A D, Leertaste, Shift,
     Strg), Spieler 2 rechts (Pfeile, dazu , . - unten rechts). Ist EIN
     Controller da, gehoert er Spieler 2 und Spieler 1 hat die ganze
     Tastatur. Bei zwei Controllern hat jeder einen.
     Input.hit/down sehen weiter ALLE Geraete — Menues und Dialoge kann
     jeder bedienen. Input.spieler(n) liest nur die Geraete von Spieler n. */
  var KOOP_TASTEN = {
    1: {
      KeyA: ['left'], KeyD: ['right'], KeyW: ['up', 'gas'], KeyS: ['down'],
      Space: ['jump', 'hopp'],
      ShiftLeft: ['run', 'throw', 'nitro'], KeyE: ['throw'], KeyF: ['throw'], KeyX: ['throw'], KeyQ: ['throw'],
      KeyC: ['puff', 'stampf'], ControlLeft: ['stampf'], KeyR: ['laden']
    },
    2: {
      ArrowLeft: ['left'], ArrowRight: ['right'], ArrowUp: ['up', 'jump', 'gas'], ArrowDown: ['down'],
      // Die drei Tasten links neben Shift rechts: , = Arschbombe, . = Schlag, - = Sprung
      Slash: ['jump', 'hopp'], Period: ['run', 'throw', 'nitro'], Comma: ['stampf', 'puff'],
      ShiftRight: ['run', 'throw', 'nitro'], ControlRight: ['stampf', 'puff'], KeyL: ['laden'],
      Numpad0: ['jump', 'hopp'], NumpadDecimal: ['run', 'throw', 'nitro']
    }
  };
  // Was in den Fahr-Leveln und Minispielen nur der Spieler steuert, der dran ist.
  // Auch BESTAETIGEN: sonst legt beim Doener gegeneinander die Leertaste von
  // Spieler 1 auch bei Spieler 2 etwas drauf (Dialoge und Menues sind nie im Fokus).
  var FOKUS = { left: 1, right: 1, up: 1, down: 1, jump: 1, run: 1, throw: 1, puff: 1,
                gas: 1, hopp: 1, nitro: 1, stampf: 1, laden: 1, confirm: 1 };
  var kbP = { 1: {}, 2: {} }, padP = { 1: {}, 2: {} };
  var heldP = { 1: {}, 2: {} }, pressedP = { 1: {}, 2: {} }, releasedP = { 1: {}, 2: {} };
  var keysDownP = {};     // Taste -> [[spieler, aktionen], ...] (so wie beim Druecken verteilt)
  var koopAn = false, padsDa = 0, fokusN = null;

  ACTIONS.forEach(function (a) {
    [1, 2].forEach(function (n) {
      kbP[n][a] = 0; padP[n][a] = false;
      heldP[n][a] = false; pressedP[n][a] = false; releasedP[n][a] = false;
    });
  });

  function recomputeP(n, a) {
    var v = kbP[n][a] > 0 || padP[n][a] ||
            (n === 1 && (touchCount[a] > 0 || tapOn[a] > 0 || (a === 'throw' && mausAn)));
    if (v && !heldP[n][a]) pressedP[n][a] = true;
    if (!v && heldP[n][a]) releasedP[n][a] = true;
    heldP[n][a] = v;
  }

  /** Wem eine Taste gehoert: [[spieler, aktionen], ...]. Allein (oder wenn
      Spieler 2 einen Controller hat) gehoert die ganze Tastatur Spieler 1. */
  function verteilung(code) {
    if (!koopAn || padsDa >= 1) return KEYMAP[code] ? [[1, KEYMAP[code]]] : [];
    var out = [];
    if (KOOP_TASTEN[1][code]) out.push([1, KOOP_TASTEN[1][code]]);
    if (KOOP_TASTEN[2][code]) out.push([2, KOOP_TASTEN[2][code]]);
    return out;
  }

  /** Steuerung eines Spielers — dieselben Abfragen wie Input selbst. */
  function steuerung(n) {
    return {
      n: n,
      hit: function (a) { return !!pressedP[n][a]; },
      down: function (a) { return !!heldP[n][a]; },
      up: function (a) { return !!releasedP[n][a]; },
      axis: function () { return (heldP[n].right ? 1 : 0) - (heldP[n].left ? 1 : 0); }
    };
  }
  var STEUER = { 1: steuerung(1), 2: steuerung(2) };

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
    // Zu zweit: auch Tasten, die nur Spieler 2 hat (, . - L ...)
    var vt = verteilung(e.code);
    if (!acts && !vt.length) return;
    // Scrollen und Seitensprünge unterdrücken. Mit STRG (Arschbombe) auch die
    // Browser-Kuerzel: STRG+D waere sonst ein Lesezeichen, STRG+S Speichern.
    // Im Koop auch / (Firefox: Schnellsuche).
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0 || e.ctrlKey || (koopAn && vt.length)) e.preventDefault();
    if (e.repeat || keysDown[e.code]) return;
    keysDown[e.code] = true;
    quelle = 'tasten';
    var i, j;
    if (acts) for (i = 0; i < acts.length; i++) { kbCount[acts[i]]++; recompute(acts[i]); }
    keysDownP[e.code] = vt;
    for (i = 0; i < vt.length; i++) {
      for (j = 0; j < vt[i][1].length; j++) { kbP[vt[i][0]][vt[i][1][j]]++; recomputeP(vt[i][0], vt[i][1][j]); }
    }
  }, { passive: false });

  global.addEventListener('keyup', function (e) {
    if (typingInField(e)) return;
    var acts = KEYMAP[e.code];
    if (!keysDown[e.code]) return;
    delete keysDown[e.code];
    var i, j;
    if (acts) {
      for (i = 0; i < acts.length; i++) {
        kbCount[acts[i]] = Math.max(0, kbCount[acts[i]] - 1);
        recompute(acts[i]);
      }
    }
    var vt = keysDownP[e.code] || [];
    delete keysDownP[e.code];
    for (i = 0; i < vt.length; i++) {
      for (j = 0; j < vt[i][1].length; j++) {
        var n = vt[i][0], a = vt[i][1][j];
        kbP[n][a] = Math.max(0, kbP[n][a] - 1);
        recomputeP(n, a);
      }
    }
  });

  function releaseKeyboard() {
    keysDown = {};
    keysDownP = {};
    ACTIONS.forEach(function (a) {
      kbCount[a] = 0; kbP[1][a] = 0; kbP[2][a] = 0;
      recompute(a); recomputeP(2, a);
    });
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
    return (key === 'jump') ? ['jump', 'confirm', 'hopp']
         : (key === 'pause') ? ['pause']
         : (key === 'throw') ? ['throw', 'run', 'nitro']
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
      // Linke Maustaste im Spiel = schlagen (wie E / Shift, am Controller X)
      if ((!e.pointerType || e.pointerType === 'mouse') && (e.button === 0 || e.button === undefined) && api.mausAngriff) {
        mausAn = true; recompute('throw');
      }
    }
    function up(e) {
      move(e);
      if (ptr.down) { ptr.down = false; ptr.justUp = true; }
      if (mausAn) { mausAn = false; recompute('throw'); }
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
  var sticks = {};   // je Controller (Index) ein Stick mit eigener Hysterese

  function achse(stick, v, neg, pos) {
    if (v === undefined) { stick[neg] = false; stick[pos] = false; return; }
    stick[neg] = stick[neg] ? v < -PAD_AUS : v < -PAD_AN;
    stick[pos] = stick[pos] ? v > PAD_AUS : v > PAD_AN;
  }

  /* Alle angeschlossenen Controller. Gemeinsam (Menues, allein spielen)
     zaehlt jeder; zu zweit gehoert einer Spieler 2, bei zweien jedem einer. */
  function pollPad() {
    var liste = [];
    if (navigator.getGamepads) {
      var pads = navigator.getGamepads();
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) liste.push(pads[i]);
    }
    padsDa = liste.length;
    var staende = liste.map(padStand), st = {};
    staende.forEach(function (s) { for (var a in s) if (s[a]) st[a] = true; });
    ACTIONS.forEach(function (a) {
      var v = !!st[a];
      if (v !== padOn[a]) { padOn[a] = v; recompute(a); if (v) quelle = 'pad'; }
    });
    var zu = { 1: null, 2: null };
    if (!koopAn) zu[1] = st;
    else if (staende.length >= 2) { zu[1] = staende[0]; zu[2] = staende[1]; }
    else if (staende.length === 1) zu[2] = staende[0];
    [1, 2].forEach(function (n) {
      var s = zu[n] || {};
      ACTIONS.forEach(function (a) {
        var v = !!s[a];
        if (v !== padP[n][a]) { padP[n][a] = v; recomputeP(n, a); }
      });
    });
  }

  /** Was ein Controller gerade drueckt, als Aktionen. */
  function padStand(p) {
    var stick = sticks[p.index] || (sticks[p.index] = { left: false, right: false, up: false, down: false });
    var st = {};
    if (p) {
      achse(stick, p.axes[0], 'left', 'right');
      achse(stick, p.axes[1], 'up', 'down');
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
        stampf: btn(p, 4),
        // Im Auto: RT oder hoch = Gas, A/B = springen, X/RB = Nitro
        gas: btn(p, 7) || stick.up || btn(p, 12),
        hopp: btn(p, 0) || btn(p, 1),
        nitro: btn(p, 2) || btn(p, 5),
        pause: btn(p, 9),
        laden: btn(p, 3),            // Y = nachladen (Airsoft)
        confirm: btn(p, 0) || btn(p, 9),
        back: btn(p, 1) || btn(p, 8)
      };
    }
    return st;
  }

  function btn(p, i) { return !!(p.buttons[i] && p.buttons[i].pressed); }

  /* ---------------- API ---------------- */

  function endFrame() {
    ACTIONS.forEach(function (a) {
      pressed[a] = false; released[a] = false;
      pressedP[1][a] = false; releasedP[1][a] = false;
      pressedP[2][a] = false; releasedP[2][a] = false;
    });
    anyPressed = false;
    tapPos = null;
    ptr.justDown = false; ptr.justUp = false;
  }

  /** Alles loslassen — z.B. wenn ein Eingabefeld den Fokus bekommt. */
  function releaseAll() {
    mausAn = false;
    releaseKeyboard();
    Object.keys(touchState).forEach(function (k) { setKey(k, false); });
    ACTIONS.forEach(function (a) {
      padOn[a] = false; tapOn[a] = 0; recompute(a);
      padP[1][a] = false; padP[2][a] = false;
      recomputeP(1, a); recomputeP(2, a);
    });
  }

  /* Zu zweit in einem Fahr-Level oder Minispiel: dann steuert nur, wer
     dran ist (fokusN). Menue-Tasten (Pause, Bestaetigen) bleiben fuer alle. */
  function gefiltert(a) { return fokusN && FOKUS[a]; }

  var api = global.Input = {
    init: function (canvas) { bindTouch(); bindScreenTap(canvas); bindPointer(canvas); },
    poll: pollPad,
    down: function (a) { return gefiltert(a) ? !!heldP[fokusN][a] : !!held[a]; },
    hit: function (a) { return gefiltert(a) ? !!pressedP[fokusN][a] : !!pressed[a]; },
    up: function (a) { return gefiltert(a) ? !!releasedP[fokusN][a] : !!released[a]; },
    anyHit: function () {
      for (var i = 0; i < ACTIONS.length; i++) if (pressed[ACTIONS[i]]) return true;
      return false;
    },
    axis: function () {
      if (fokusN) return STEUER[fokusN].axis();
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    /* ---- Zu zweit (koop.js) ---- */
    /** Koop an/aus: verteilt Tastatur und Controller auf zwei Spieler. */
    koop: function (an) {
      an = !!an;
      if (an === koopAn) return;
      koopAn = an; fokusN = null;
      releaseKeyboard();
    },
    koopAn: function () { return koopAn; },
    /** Steuerung von Spieler n (1 oder 2): nur seine Tasten und sein Controller. */
    spieler: function (n) { return STEUER[n === 2 ? 2 : 1]; },
    /** Teilen sich beide gerade die Tastatur (kein Controller da)? */
    geteilt: function () { return koopAn && padsDa === 0; },
    /** Wie viele Controller angeschlossen sind (beim letzten poll). */
    padZahl: function () { return padsDa; },
    /** Nur Spieler n steuert das Spiel (Fahr-Level, Minispiele); null = alle. */
    fokus: function (n) { fokusN = (koopAn && (n === 1 || n === 2)) ? n : null; },
    fokusAuf: function () { return fokusN; },
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
    /** Linke Maustaste = schlagen? game.js setzt das jeden Tick (nur im Spiel). */
    mausAngriff: false,
    /** Entwickler-Modus (entwickler.js): P ist dann nicht Pause, sondern die Entwickler-Taste. */
    devTaste: function (an) {
      STANDARD.KeyP = an ? ['dev'] : ['pause'];
      neuBauen();
    },
    /** Die naechste gedrueckte Taste abfangen (fuer das Belegen). */
    naechsteTaste: function (cb) { fangen = cb; releaseKeyboard(); },
    fangenAbbrechen: function () { fangen = null; }
  };

})(window);
