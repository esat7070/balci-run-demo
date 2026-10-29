/* =====================================================================
   koop.js — Zu zweit durch die Geschichte (Esat, 29.10.: "Baue einen
   Koop-Modus ein. Man soll die Story zu zweit durchspielen.")

   Spieler 1 ist Yusuf, Spieler 2 ein Kumpel (Esat, Mirkan ...).
   Beide huepfen gleichzeitig durch jedes Level:
   - Honig, Punkte und Leben gehoeren beiden: Spieler 2 zaehlt auf das
     Konto von Spieler 1 (so stimmen Bestenliste, Shop und Speicherstand).
     Herzen, Puste, Waffe und Kippen hat jeder fuer sich.
   - Die Kamera haelt beide im Bild. Weiter als einen Bildschirm kommen sie
     nicht auseinander — der Bildrand haelt fest. Wer dort laenger zieht,
     holt den anderen in der Honigblase nach (steht der nur rum).
   - Wer stirbt (oder abgehaengt wird), schwebt in einer Honigblase zum
     anderen. SPRINGEN (oder der andere beruehrt die Blase) = wieder raus.
     Sterben beide, geht es wie allein am Checkpoint weiter.
   - Gegner und Geschosse treffen, wer naeher dran ist. Bosse nehmen sich
     den naeheren vor; draufspringen und hauen koennen beide.
   - Ist die Figur von Spieler 2 im Level der Boss, springt ein anderer
     Kumpel ein. Ist sie der Kumpel, der sonst hinter Yusuf herlaeuft,
     laeuft der nicht noch einmal mit (seine Saetze sagt Spieler 2).
   - Fahr-Level, das Essen in Level 8 und die Minispiele steuert immer
     einer: ihr wechselt euch ab (eine Karte sagt, wer dran ist).

   Steuerung (input.js): ohne Controller teilen sich beide die Tastatur,
   Spieler 1 links (A D, Leertaste, Shift, Strg), Spieler 2 rechts (Pfeile,
   dazu , . -). Ein Controller gehoert Spieler 2, zwei: jeder einen.

   Wie es eingehaengt ist: game.js ruft die Funktionen hier an wenigen
   Stellen auf (Level laden, jeder Tick, Kamera, Zeichnen, Tod). Waehrend
   Spieler 2 sich bewegt oder ein Gegner nach dem naeheren Spieler schaut,
   steht G.player kurz auf diesem Spieler — der restliche Spielcode muss
   also nichts von zwei Spielern wissen.
   ===================================================================== */
(function (global) {
  'use strict';

  var T = 16;
  function E() { return global.Ent; }
  function In() { return global.Input; }
  function S() { return global.Sound; }
  function F() { return global.Font; }
  function P() { return global.Pixel; }
  function LI() { return global.Licht; }

  var LEINE = 448;          // so weit duerfen sie auseinander (Bildbreite 512 minus Rand)
  var ABSEITS = 150;        // so lange (Ticks) ausserhalb des Bildes, dann kommt die Blase
  var ZERREN = 90;          // so lange am Bildrand ziehen, dann schwebt der andere hinterher
  var AUTO_RAUS = 270;      // nach so vielen Ticks platzt die Blase von allein
  var KARTE = 210;          // so lange steht "SPIELER 2 IST DRAN" im Bild

  var P1_FARBE = '#ffd257';

  /* Wen Spieler 2 spielen kann (Figuren aus pixel.js mit allen Posen).
     Die Farbe steht an seinen Herzen und ueber seinem Kopf. */
  // (Die Demo zeigt nur die Jungs aus Level 1 bis 5, baue_demo.py schneidet den Rest heraus.)
  var FIGUREN = [
    { id: 'esat', name: 'ESAT', col: '#6fc8e8' },
    { id: 'mirkan', name: 'MIRKAN', col: '#e8e4f4' },
    { id: 'huseyin', name: 'HUSEYIN', col: '#ff9a5a' },
    
  ];
  // Welcher Boss welche Figur ist (dann springt fuer dieses Level ein anderer ein)
  var BOSS_FIGUR = { mirkan: 'mirkan', huseyin: 'huseyin',
                     
                   };
  // In diesen Szenen spielt man (dann ist einer dran); Chat, Hotel und Abspann schaut man nur
  var SPIEL_SZENEN = { kasse: 1, shisha: 1, mahl: 1, kontrolle: 1, schlaf: 1 };

  var K = {
    an: false,
    wahl: 0,            // Index in FIGUREN: wen Spieler 2 spielen will
    p1: null, p2: null,
    figur: FIGUREN[0],  // wen Spieler 2 in diesem Level wirklich spielt
    ersatzGesagt: {},   // "ESAT IST HEUTE DER BOSS" nur einmal pro Level
    fuehrer: null,
    respawn: false,     // die Blende zum Checkpoint laeuft schon
    teil: null, dran: 1, zuletzt: 2, karteT: 0,
    menuIdx: 0
  };

  /* ---------------- Ein und aus ---------------- */

  /** Werte, die beide teilen: Spieler 2 liest und schreibt die von Spieler 1. */
  var GETEILT = ['lives', 'honey', 'score', 'eatCount', 'honigLeben', 'deaths', 'aura', 'flipCount'];
  function teilen(p2, p1) {
    GETEILT.forEach(function (k) {
      Object.defineProperty(p2, k, {
        configurable: true, enumerable: true,
        get: function () { return p1[k]; },
        set: function (v) { p1[k] = v; }
      });
    });
  }

  function neuerP2(G) {
    var p1 = G.player, p2 = new (E().Player)(p1.x, p1.y);
    p2.nr = 2;
    p2.stumm = true;           // knurrt nicht (das ist Yusufs Ding)
    p2.partner = p1;
    p2.eingabe = In().spieler(2);
    teilen(p2, p1);
    K.p1 = p1; K.p2 = p2;
    p1.nr = 1;
    p1.eingabe = In().spieler(1);
    return p2;
  }

  /** Koop einschalten (Menue ZU ZWEIT oder Pause). Mitten im Level steigt
      Spieler 2 neben Yusuf ein. */
  function ein(G) {
    if (!K.an) { K.teil = null; K.zuletzt = 2; K.karteT = 0; }
    K.an = true;
    In().koop(true);
    if (G.player && G.lvl && G.state !== 'title' && G.state !== 'select' && G.state !== 'koop') {
      neuerP2(G);
      K.figur = figurFuer(G, G.lvl);
      K.p2.wer = K.figur.id;
      K.p2.maxHp = G.player.maxHp; K.p2.hp = K.p2.maxHp;
      K.p2.w = G.player.w; K.p2.h = G.player.h;
      K.p2.normalH = G.player.h; G.player.normalH = G.player.h;
      neben(G, K.p2, G.player);
      platzenEffekt(G, K.p2);
    }
  }

  /** Koop aus: Spieler 2 geht, Yusuf hat wieder alle Tasten. */
  function aus(G) {
    var p1 = K.p1 || (G && G.player);
    if (p1 && p1.blase && K.p2 && !K.p2.dead) {
      // Steckt Yusuf gerade in der Blase, landet er dort, wo Spieler 2 war
      p1.blase = null; p1.x = K.p2.x; p1.y = K.p2.y + K.p2.h - p1.h; p1.vx = 0; p1.vy = 0;
    }
    if (p1) { p1.blase = null; p1.eingabe = null; }
    if (G && K.p1 && G.player !== K.p1) G.player = K.p1;
    K.an = false; K.p2 = null; K.respawn = false; K.teil = null; K.karteT = 0;
    In().koop(false);
  }

  /** Wer Spieler 2 in diesem Level ist: die Wunschfigur — es sei denn, sie
      ist hier der Boss. Dann springt der Naechste aus der Liste ein. */
  function figurFuer(G, lvl) {
    var f = FIGUREN[K.wahl] || FIGUREN[0];
    var boss = lvl && BOSS_FIGUR[lvl.bossType];
    if (boss !== f.id) return f;
    for (var i = 1; i < FIGUREN.length; i++) {
      var e = FIGUREN[(K.wahl + i) % FIGUREN.length];
      if (e.id !== boss) {
        var key = lvl.id;
        if (!K.ersatzGesagt[key] && G.toasts) {
          K.ersatzGesagt[key] = true;
          G.toasts.push({ art: 'text', zeile1: f.name + ' IST HEUTE DER BOSS.',
                          zeile2: 'SPIELER 2 SPIELT ' + e.name + '.', col: e.col, zeit: 200 });
        }
        return e;
      }
    }
    return f;
  }

  /* ---------------- Level laden ---------------- */

  /** Nach game.js loadLevel: Spieler 2 neben Yusuf an den Start (bzw. an
      den Checkpoint). Allein: nur aufraeumen. */
  function laden(G, lvl, respawn) {
    var p1 = G.player;
    if (!K.an) { if (p1) { p1.eingabe = null; p1.blase = null; } return; }
    // Kein Koop im Tageslauf und in den Minispielen aus dem Menue
    if (G.lvlIndex === 'tag' || G.mini) { aus(G); return; }
    if (!K.p2 || K.p2.partner !== p1) neuerP2(G);
    var p2 = K.p2;
    p1.eingabe = In().spieler(1);
    if (!respawn) K.ersatzGesagt = {};
    K.figur = figurFuer(G, lvl);
    p2.wer = K.figur.id;
    p2.maxHp = p1.maxHp;
    p2.reset(p1.x, p1.y);
    p2.blase = null; p1.blase = null;
    p2.wegT = 0; p1.wegT = 0;
    p2.w = p1.w; p2.h = p1.h; p2.normalH = p1.h; p1.normalH = p1.h;
    p2.y = p1.y; p2.x = p1.x; p2.facing = p1.facing;
    // Ein Stueck hinter Yusuf, wenn da Platz ist
    if (frei(G, p1.x - 18, p1.y, p2.w, p2.h)) p2.x = p1.x - 18;
    if (!respawn) p2.waffe = lvl.waffe || null;
    p2.invuln = p1.invuln;
    K.fuehrer = p1;
    K.respawn = false;
  }

  /* ---------------- Wer ist wo ---------------- */

  function aktiv(p) { return !!p && !p.dead && !p.blase; }
  function partnerVon(p) { return p === K.p2 ? K.p1 : K.p2; }

  /** Alle Spieler (zu zweit beide). */
  function alle(G) { return (K.an && K.p2 && K.p1) ? [K.p1, K.p2] : [G.player]; }

  /** Wer gerade mitspielt (nicht tot, nicht in der Blase). Nie leer. */
  function aktive(G) {
    if (!K.an || !K.p2) return [G.player];
    var l = [K.p1, K.p2].filter(aktiv);
    return l.length ? l : [K.p1];
  }

  /** Abstand zweier Kaesten (0 = sie beruehren sich), im Quadrat. */
  function abstand(p, o) {
    var dx = Math.max(0, o.x - (p.x + p.w), p.x - (o.x + (o.w || 0)));
    var dy = Math.max(0, o.y - (p.y + p.h), p.y - (o.y + (o.h || 0)));
    return dx * dx + dy * dy;
  }

  /** Der Spieler, der naeher an einem Ding dran ist (Gegner, Honig, Geschoss). */
  function naechster(G, o) {
    var p1 = K.p1, p2 = K.p2;
    if (!K.an || !p2) return G.player;
    var a = aktiv(p1), b = aktiv(p2);
    if (!b) return p1;
    if (!a) return p2;
    return abstand(p2, o) < abstand(p1, o) ? p2 : p1;
  }

  /** Wer vorne ist (fuer die Kamera, wenn beide nicht ins Bild passen). */
  function fuehrer() {
    var p1 = K.p1, p2 = K.p2;
    if (!aktiv(p2)) return p1;
    if (!aktiv(p1)) return p2;
    var f = K.fuehrer === p2 ? p2 : p1, o = f === p1 ? p2 : p1;
    if (o.cx() > f.cx() + 64) f = o;
    K.fuehrer = f;
    return f;
  }

  /** Ist an der Stelle Platz fuer eine Figur (keine feste Kachel)? */
  function frei(G, x, y, w, h) {
    var wl = G.world;
    if (!wl) return true;
    var x0 = Math.floor(x / T), x1 = Math.floor((x + w - 1) / T);
    var y0 = Math.floor(y / T), y1 = Math.floor((y + h - 1) / T);
    if (x < 0 || x + w > wl.w * T) return false;
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) if (wl.solid(tx, ty)) return false;
    }
    return true;
  }

  function imBild(G, p, rand) {
    var c = G.cam, r = rand || 0, vw = G.viewW ? G.viewW() : 512, vh = G.viewH ? G.viewH() : 288;
    return p.cx() > c.x - r && p.cx() < c.x + vw + r && p.y + p.h > c.y - r && p.y < c.y + vh + r;
  }

  /** Spieler p direkt neben o stellen (Arena, Hinterhalt, Einsteigen). */
  function neben(G, p, o) {
    p.blase = null;
    p.x = o.x; p.y = o.y + o.h - p.h;
    p.vx = 0; p.vy = 0; p.facing = o.facing;
    var dx = -o.facing * 16;
    if (frei(G, p.x + dx, p.y, p.w, p.h)) p.x += dx;
    p.invuln = Math.max(p.invuln || 0, 60);
    p.wegT = 0;
  }

  /** Wer ausserhalb von [lo, hi] steht, kommt zu dem, der drin ist
      (Gitter beim Hinterhalt, Wand hinter der Boss-Arena). */
  function zusammen(G, lo, hi) {
    if (!K.an || !K.p2) return;
    var drin = function (q) { return q.cx() > lo && q.cx() < hi; };
    [K.p1, K.p2].forEach(function (p) {
      var o = partnerVon(p);
      if ((aktiv(p) || p.blase) && !drin(p) && aktiv(o) && drin(o)) {
        neben(G, p, o);
        platzenEffekt(G, p);
        G.floats.add(p.cx(), p.y - 16, 'HIER BIN ICH!', K.figurFarbe(p), 60);
      }
    });
  }

  /* ---------------- Jeden Tick ---------------- */

  /** game.js vor Yusufs Bewegung. true = er steckt in der Blase (dann
      bewegt sie ihn, nicht die Tasten). */
  function vorher(G, p) {
    if (!K.an || !K.p2) return false;
    p.altX = p.x;
    if (p.blase) { blaseTick(G, p); return true; }
    return false;
  }

  /** game.js nach Yusufs Bewegung: Spieler 2 bewegt sich, dann Leine,
      Abseits und Blasen. */
  function zweiter(G) {
    if (!K.an || !K.p2) return;
    var p1 = G.player, p2 = K.p2;
    p2.altX = p2.x;
    G.player = p2;
    try {
      if (p2.blase) blaseTick(G, p2);
      else p2.update(G);
      if (global.Anim && !p2.blase) global.Anim.tick(G);
    } finally { G.player = p1; }
    if (G.frozen || G.cut || G.camFocus || (G.autoAx !== null && G.autoAx !== undefined)) { p1.wegT = 0; p2.wegT = 0; return; }
    leine(G);
    abseits(G);
  }

  /** Nicht weiter auseinander als ein Bildschirm: wer wegzieht, bleibt
      stehen. Zieht er laenger (ZERREN Ticks) — der andere steht nur rum oder
      ist weggegangen —, schwebt der andere in der Blase hinterher. Sonst
      saesse Yusuf neben einem Spieler 2 fest, den gerade niemand steuert. */
  function leine(G) {
    var p1 = K.p1, p2 = K.p2;
    if (!aktiv(p1) || !aktiv(p2)) { K.zerrT = 0; return; }
    if (Math.abs(p2.cx() - p1.cx()) <= LEINE) { K.zerrT = Math.max(0, (K.zerrT || 0) - 2); return; }
    var zieht = null;
    [p1, p2].forEach(function (p) {
      var o = partnerVon(p);
      if (p.altX === undefined) return;
      var weg = (p.cx() - o.cx()) * (p.x - p.altX);
      if (weg > 0) {
        p.x = p.altX;
        if (p.vx !== 0 && (p.vx > 0) === (p.cx() > o.cx())) p.vx = 0;
        p.leineT = 20;
        zieht = zieht ? fuehrer() : p;
      }
    });
    if (!zieht) return;
    K.zerrT = (K.zerrT || 0) + 1;
    if (K.zerrT > ZERREN) {
      K.zerrT = 0;
      var hinten = partnerVon(zieht);
      blaseStart(G, hinten, false);
      G.floats.add(hinten.cx(), hinten.y - 10, 'WARTE AUF MICH!', K.figurFarbe(hinten), 70);
    }
  }

  /** Wer eine Weile nicht im Bild ist (abgehaengt), schwebt in der Blase
      zum anderen. Kostet kein Leben. */
  function abseits(G) {
    var f = fuehrer();
    [K.p1, K.p2].forEach(function (p) {
      if (!aktiv(p) || p === f || !aktiv(partnerVon(p))) { p.wegT = 0; return; }
      p.wegT = imBild(G, p, 28) ? 0 : (p.wegT || 0) + 1;
      if (p.wegT > ABSEITS) {
        p.wegT = 0;
        blaseStart(G, p, false);
        G.floats.add(p.cx(), p.y - 10, 'WARTE AUF MICH!', K.figurFarbe(p), 70);
      }
    });
  }

  /* ---------------- Die Honigblase ---------------- */

  function blaseStart(G, p, warTot) {
    var x = p.x, y = p.y;
    if (warTot) p.reset(x, y);
    if (p.normalH) p.h = p.normalH;
    p.rutsch = 0; p.liegt = false; p.weit = false; p.pound = 0; p.schlag = null;
    p.flipping = false; p.flipA = 0; p.sleeping = false;
    // Im Bild anfangen (wer in den Abgrund gefallen ist, kommt von unten)
    var c = G.cam, vw = G.viewW ? G.viewW() : 512, vh = G.viewH ? G.viewH() : 288;
    p.x = Math.max(c.x + 8, Math.min(c.x + vw - p.w - 8, x));
    p.y = Math.max(c.y + 8, Math.min(c.y + vh - p.h - 30, y));
    p.vx = 0; p.vy = 0; p.grounded = false;
    p.blase = { t: 0 };
    p.wegT = 0;
    S().play('pop');
  }

  function blaseTick(G, p) {
    var b = p.blase, o = partnerVon(p);
    p.vx = 0; p.vy = 0; p.grounded = false;
    if (G.frozen) return;
    b.t++;
    var In2 = p.eingabe || In();
    // Raus will man mit SPRINGEN, nach ein paar Sekunden von allein, oder
    // wenn der andere die Blase anstupst
    if (In2.hit('jump') || b.t > AUTO_RAUS || (b.t > 30 && aktiv(o) && E().overlap(o, p))) b.raus = true;
    if (!aktiv(o)) return;
    var tx, ty;
    if (b.raus && b.t > 24) {
      if (frei(G, p.x, p.y, p.w, p.h) && imBild(G, p, -4)) { platzen(G, p); return; }
      // Hier ist kein Platz (Wand, Decke, Bildrand): dorthin, wo der andere
      // steht — da ist immer Platz
      tx = o.x + (o.w - p.w) / 2; ty = o.y + o.h - p.h;
    } else {
      // Ueber dem anderen schweben, ein Stueck dahinter
      tx = o.cx() - o.facing * 18 - p.w / 2; ty = o.y - 34;
    }
    var dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
    var v = Math.min(d, 1 + d * 0.07, 5);
    if (d > 0.5) { p.x += dx / d * v; p.y += dy / d * v; }
    p.facing = o.facing;
  }

  function platzen(G, p) {
    p.blase = null;
    p.invuln = 90;
    p.vy = -3.6; p.vx = 0;
    p.jumpsLeft = 1; p.coyote = 0; p.buffer = 0;
    p.idle = 0;
    platzenEffekt(G, p);
    G.floats.add(p.cx(), p.y - 14, 'WIEDER DA!', K.figurFarbe(p), 50);
  }

  function platzenEffekt(G, p) {
    S().play('pop');
    G.particles.burst(p.cx(), p.y + p.h / 2, 16, { col: '#ffd257', spread: 2.6, up: 0.6, life: 26 });
    G.particles.burst(p.cx(), p.y + p.h / 2, 8, { col: '#fff6d8', spread: 1.8, up: 0.4, life: 18 });
  }

  /* ---------------- Tod ---------------- */

  /** Aus game.js onPlayerDead. true = erledigt (er kommt in die Blase),
      false = wie allein: Blende, Checkpoint (dann fuer beide). */
  function tod(G, p) {
    if (!K.an || !K.p2) return false;
    if (K.respawn) return true;              // die Blende zum Checkpoint laeuft schon
    // Der andere ist schon im Ziel: kein Neustart mehr, gleich kommt das naechste Level
    if (K.p1.won || K.p2.won) return true;
    var o = partnerVon(p);
    if (!aktiv(o) || p.lives <= 1 || G.lvlIndex === 'tag') { K.respawn = true; return false; }
    p.deaths = (p.deaths || 0) + 1;
    p.lives--;
    blaseStart(G, p, true);
    G.floats.add(p.cx(), p.y - 10, 'HILF MIR!', K.figurFarbe(p), 70);
    return true;
  }

  /* ---------------- Gegner, Geschosse, Bosse ---------------- */

  /** Nach dem Zug eines Gegners: beruehrt ihn auch der andere Spieler? */
  function gegnerKontakt(G, e) {
    if (!K.an || !K.p2 || !e || e.dead || !e.kontakt) return;
    var p1 = K.p1, o = G.player === K.p2 ? p1 : K.p2;
    if (!aktiv(o)) return;
    G.player = o;
    try { e.kontakt(G, o); } finally { G.player = p1; }
  }

  /** Wen der Boss sich vornimmt: den, der naeher ist — aber nicht jeden
      Tick neu (sonst zappelt er zwischen beiden hin und her). */
  function bossZiel(G, b) {
    var p1 = K.p1, p2 = K.p2;
    if (!aktiv(p2)) return p1;
    if (!aktiv(p1)) return p2;
    var z = b.koopZiel === p2 ? p2 : p1, o = z === p1 ? p2 : p1;
    b.koopZielT = (b.koopZielT || 0) + 1;
    var bf = b.y + b.h;
    var dz = Math.abs(z.cx() - b.cx()) + Math.abs(z.feet() - bf) * 0.5;
    var dO = Math.abs(o.cx() - b.cx()) + Math.abs(o.feet() - bf) * 0.5;
    if (b.koopZielT > 45 && dO + 28 < dz) { z = o; b.koopZielT = 0; }
    b.koopZiel = z;
    return z;
  }

  /** Statt G.boss.update(G): der Boss bewegt sich gegen den naeheren
      Spieler, danach darf ihn auch der andere treffen (draufspringen). */
  function bossUpdate(G) {
    var b = G.boss;
    if (!K.an || !K.p2) { b.update(G); return; }
    var p1 = K.p1, ziel = bossZiel(G, b), anderer = ziel === p1 ? K.p2 : p1;
    b.kontaktGeprueft = false;
    G.player = ziel;
    try { b.update(G); } finally { G.player = p1; }
    if (G.boss === b && !b.dead && b.kontaktGeprueft && aktiv(anderer)) {
      G.player = anderer;
      try {
        if (typeof b.kontakt === 'function') b.kontakt(G, anderer);
        else E().bossKit.contact(b, G);
      } finally { G.player = p1; }
    }
  }

  /** Beim Bossstart (game.js): eigene Beruehrungs-Pruefungen der Bosse
      melden, dass sie liefen, und wer draussen steht, kommt in die Arena. */
  function bossStart(G, b) {
    if (!K.an || !K.p2 || !b) return;
    // Kein Gold-Doener im Bosskampf (wie bei Yusuf in game.js)
    if (K.p2.power > 0) K.p2.power = 0;
    if (typeof b.kontakt === 'function' && !Object.prototype.hasOwnProperty.call(b, 'kontakt')) {
      var orig = b.kontakt;
      b.kontakt = function (g, p) { this.kontaktGeprueft = true; return orig.call(this, g, p); };
    }
    if (G.arena) zusammen(G, G.arena.x + 4, G.arena.x + G.arena.w - 4);
  }

  /* ---------------- Kamera ---------------- */

  /** Wohin die Kamera schaut (Weltpunkt), oder null = wie allein. */
  function kamera(G) {
    if (!K.an || !K.p2) return null;
    var p1 = K.p1, p2 = K.p2, a = aktiv(p1), b = aktiv(p2);
    if (!a && !b) return null;
    if (!a || !b) {
      var q = a ? p1 : p2;
      return { x: q.cx() + q.facing * 26, y: q.y + q.h / 2 };
    }
    var mx = (p1.cx() + p2.cx()) / 2, my = (p1.y + p1.h / 2 + p2.y + p2.h / 2) / 2;
    if (Math.abs(p1.y - p2.y) > 200) { var f = fuehrer(); my = f.y + f.h / 2; }
    return { x: mx, y: my };
  }

  /* ---------------- Bosse, Sieg, Ziel ---------------- */

  /** Nach einer Boss-Verwandlung bekommen beide volle Herzen (game.js heilt Yusuf). */
  function heilen(G) {
    if (!K.an || !K.p2) return;
    alle(G).forEach(function (p) {
      if (p === G.player || p.dead || p.blase || p.hp >= p.maxHp) return;
      p.hp = p.maxHp;
      G.particles.burst(p.cx(), p.y + 8, 12, { col: '#ff6a8a', spread: 2.2, up: 1.1, life: 28 });
    });
  }

  /** Boss liegt / Ziel erreicht: der andere jubelt mit. */
  function jubeln(G, gewonnen) {
    if (!K.an || !K.p2) return;
    alle(G).forEach(function (p) {
      if (p.blase) { p.blase = null; p.vy = -2; }
      if (p.dead) return;
      p.cheer = Math.max(p.cheer || 0, 150); p.laughTimer = 80;
      if (gewonnen) { p.won = true; p.cheer = 200; }
    });
  }

  /* ---------------- Der Kumpel, der sonst mitlaeuft ---------------- */

  /** Spielt Spieler 2 den Kumpel, der sonst hinter Yusuf herlaeuft? Dann
      wird der nicht noch einmal gezeichnet, und seine Saetze sagt Spieler 2. */
  function istKumpel(G) {
    return !!(K.an && K.p2 && G.lvl && G.lvl.buddy && G.lvl.buddy === K.figur.id);
  }

  /* ---------------- Wer ist dran (Fahr-Level, Minispiele) ---------------- */

  function teilVon(G) {
    if (G.scene) return SPIEL_SZENEN[G.scene.type] ? 'sz:' + G.scene.type + ':' + G.lvlIndex : null;
    if (G.eat) return 'eat:' + G.lvlIndex;
    if (G.modus && G.modMod && G.modMod.full) return 'mod:' + G.lvlIndex;
    return null;
  }

  /** Jeden Tick (game.js update): in Spiel-Szenen steuert nur, wer dran ist. */
  function fokusTick(G) {
    var I = In();
    if (!K.an) { if (I.fokusAuf()) I.fokus(null); K.karteT = 0; return; }
    var t = G.state === 'play' ? teilVon(G) : null;
    if (t && t !== K.teil) {
      K.teil = t;
      K.dran = K.zuletzt === 1 ? 2 : 1;
      K.zuletzt = K.dran;
      K.karteT = KARTE;
      S().play('select');
    }
    // Zurueck im normalen Level: beim naechsten Mal ist der andere dran
    if (!t && G.state === 'play' && !G.scene && !G.eat && !(G.modus && G.modMod && G.modMod.full)) K.teil = null;
    I.fokus(t ? K.dran : null);
    if (K.karteT > 0 && G.state === 'play' && !G.fadeDir) K.karteT--;
  }

  /* ---------------- Zeichnen ---------------- */

  function wer(G, p) {
    if (p.nr === 2) return K.figur.id;
    return G.lvl && G.lvl.airsoft ? 'yusuf_as' : 'yusuf';
  }
  K.figurFarbe = function (p) { return p && p.nr === 2 ? K.figur.col : P1_FARBE; };

  /** Spieler 2 zeichnen (malen = drawPlayer aus game.js, fuer G.player). */
  function zeichnen(ctx, G, camX, camY, malen) {
    if (!K.an || !K.p2) return;
    var p1 = G.player;
    G.player = K.p2;
    try { malen(camX, camY); } finally { G.player = p1; }
  }

  /** Die Honigblase mit der Figur darin. */
  function blaseMalen(ctx, G, p, camX, camY) {
    var b = p.blase, t = b ? b.t : 0;
    var cx = Math.round(p.cx() - camX), cy = Math.round(p.y + p.h / 2 - camY + Math.sin(t * 0.09) * 2);
    var r = 17 + Math.sin(t * 0.2) * 0.8;
    if (LI() && LI().stufe() >= 1) LI().glow(ctx, cx, cy, 30, '#ffc23c', 0.22);
    P().drawChar(ctx, wer(G, p), cx, cy + 11, { pose: 'fall', face: 'laugh', flip: p.facing < 0, scale: 0.78 });
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffc23c';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#ffe38a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r - 4, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
    ctx.restore();
    // Wie man rauskommt (sobald es geht)
    if (t > 24 && (t >> 4) % 2 === 0) {
      F().draw(ctx, G.hinweis ? G.hinweis('SPRINGEN!') : 'SPRINGEN!', cx, cy - r - 11,
               { color: K.figurFarbe(p), align: 'center', shadow: true });
    }
  }

  /** Kleines Dreieck ueber jedem Kopf, damit man sich nicht verwechselt. */
  function zeichen(ctx, G, camX, camY) {
    if (!K.an || !K.p2) return;
    [K.p1, K.p2].forEach(function (p) {
      if (p.dead || p.blase) return;
      if (p.invuln > 0 && (G.tick >> 1) % 2 === 0) return;
      var x = Math.round(p.cx() - camX), y = Math.round(p.y - camY) - 13 - (p.nr === 1 ? 2 : 0);
      var col = K.figurFarbe(p);
      ctx.fillStyle = 'rgba(8,5,12,0.55)';
      ctx.fillRect(x - 4, y - 1, 9, 5);
      ctx.fillStyle = col;
      ctx.fillRect(x - 3, y, 7, 1);
      ctx.fillRect(x - 2, y + 1, 5, 1);
      ctx.fillRect(x - 1, y + 2, 3, 1);
      ctx.fillRect(x, y + 3, 1, 1);
      // Am Bildrand angehalten (Leine): kurz ein Pfeil zum anderen
      if (p.leineT > 0) {
        p.leineT--;
        var o = partnerVon(p), d = o.cx() > p.cx() ? 1 : -1;
        F().draw(ctx, d > 0 ? '>>' : '<<', x + d * 12, y - 2, { color: col, align: 'center', shadow: true });
      }
    });
  }

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  /** Herzen und Puste von Spieler 2: rechts oben unter Punkten und Zeit
      (Yusuf links, Spieler 2 rechts — in der Mitte stehen Fussball-Stand,
      Speedrun-Uhr und Trophaeen). rx = rechter Rand wie in game.js. */
  function hud(ctx, G, rx) {
    if (!K.an || !K.p2) return;
    var p = K.p2, y = 58, i;
    rx = rx || 504;
    var name = K.figur.name, col = K.figur.col;
    var hz = P().get('herz'), hw = p.maxHp * 13 - (13 - hz.w);
    if (p.blase) {
      if ((G.tick >> 4) % 2 === 0) F().draw(ctx, 'IN DER BLASE', rx, y + 1, { color: '#ffe38a', align: 'right', shadow: true });
      F().draw(ctx, name, rx - F().measure('IN DER BLASE', 1, 1) - 6, y + 1, { color: col, align: 'right', shadow: true });
    } else {
      for (i = 0; i < p.maxHp; i++) {
        ctx.globalAlpha = i < p.hp ? 1 : 0.28;
        P().draw(ctx, 'herz', rx - hw + i * 13, y);
      }
      ctx.globalAlpha = 1;
      F().draw(ctx, name, rx - hw - 5, y + 1, { color: col, align: 'right', shadow: true });
    }
    if (G.lvl && !G.lvl.bike) {
      var sw = 40, sf = Math.round(sw * Math.max(0, p.stamina) / p.stamMax);
      var voll = p.stamina >= 42;
      rect(ctx, rx - sw, y + 15, sw, 4, 'rgba(6,4,10,0.6)');
      rect(ctx, rx - sw, y + 15, sf, 4, (p.pustT > 0 && (G.tick >> 2) % 2 === 0) ? '#ff6a6a' : (voll ? '#8cd85a' : '#ffc23c'));
      var extra = p.power > 0 ? ['GOLD-DÖNER', '#ffd257'] : (p.smoke ? ['KIPPEN', '#ffb46a'] : null);
      if (extra) F().draw(ctx, extra[0], rx - sw - 5, y + 13, { color: extra[1], align: 'right', shadow: true });
    }
    // Seine Waffe (waffen.js zeichnet die von G.player)
    if (p.waffe && global.Waffen && !p.blase) {
      var p1 = G.player;
      G.player = p;
      try { global.Waffen.hud(ctx, G, rx - 130, y + 24); } finally { G.player = p1; }
    }
  }

  /** Ganz oben: wer in Fahr-Leveln und Minispielen dran ist. Die Karte
      liegt unten (in der Mitte stehen dort Countdown und Anleitung). */
  function oben(ctx, G, W, H) {
    if (!K.an) return;
    var f = In().fokusAuf();
    if (!f || (G.state !== 'play' && G.state !== 'dialog')) return;
    var col = f === 2 ? K.figur.col : P1_FARBE;
    if (K.karteT > 0) {
      // Teilen sich beide die Tastatur, sagt eine dritte Zeile, welche Tasten
      // Spieler 2 statt der in der Anleitung (Leertaste, Shift, Strg) nimmt
      var tasten = In().geteilt() ? (f === 2 ? '- = LEERTASTE   . = SHIFT   , = STRG   PFEILE = W A S D'
                                             : 'W A S D, LEERTASTE, SHIFT, STRG - DIE PFEILE HAT SPIELER 2') : null;
      var a = Math.min(1, K.karteT / 30, (KARTE - K.karteT) / 12), hk = tasten ? 62 : 50, y0 = H - 32 - hk;
      ctx.globalAlpha = a * 0.88;
      rect(ctx, 0, y0, W, hk, '#08050c');
      rect(ctx, 0, y0, W, 1, col);
      rect(ctx, 0, y0 + hk - 1, W, 1, col);
      ctx.globalAlpha = a;
      F().draw(ctx, 'SPIELER ' + f + ' IST DRAN', W / 2, y0 + 8, { color: col, align: 'center', scale: 2, shadow: true });
      F().draw(ctx, 'SPIELER ' + (f === 1 ? 2 : 1) + ' SCHAUT ZU. BEIM NÄCHSTEN MAL WIRD GETAUSCHT.', W / 2, y0 + 33,
               { color: '#d8cfe8', align: 'center', shadow: true });
      if (tasten) F().draw(ctx, tasten, W / 2, y0 + 45, { color: col, align: 'center', shadow: true });
      ctx.globalAlpha = 1;
    }
    var txt = 'AM ZUG: SPIELER ' + f;
    var tw = F().measure(txt, 1, 1);
    rect(ctx, 4, H - 15, tw + 8, 11, 'rgba(8,5,12,0.7)');
    F().draw(ctx, txt, 8, H - 13, { color: col });
  }

  /* ---------------- Menue ZU ZWEIT ---------------- */

  function menuePunkte(G) {
    var l = [];
    var weiter = G.koopWeiterZiel ? G.koopWeiterZiel() : -1;
    if (weiter >= 0) l.push({ k: 'continue', label: 'WEITER AB LEVEL ' + (weiter + 1) });
    l.push({ k: 'play', label: 'NEUES SPIEL' });
    l.push({ k: 'select', label: 'LEVEL WÄHLEN' });
    l.push({ k: 'zurueck', label: 'ZURÜCK' });
    return l;
  }

  function oeffnen(G) {
    G.state = 'koop';
    K.menuIdx = 0;
  }

  function menueRect(i, n) { return { x: 512 / 2 - 80, y: 214 + i * 13 - 3 - (n > 3 ? 6 : 0), w: 160, h: 13 }; }

  function waehlen(G, d) {
    K.wahl = (K.wahl + d + FIGUREN.length) % FIGUREN.length;
    S().play('move');
  }

  function aktivieren(G, it) {
    S().play('select');
    if (it.k === 'zurueck') { G.state = 'title'; return; }
    ein(G);
    if (G.koopLos) G.koopLos(it.k);
  }

  function menuUpdate(G) {
    var I = In(), l = menuePunkte(G), n = l.length;
    if (K.menuIdx >= n) K.menuIdx = 0;
    var mz = G.mausZeigt ? G.mausZeigt() : null;
    var i, r;
    if (mz) {
      for (i = 0; i < n; i++) {
        r = menueRect(i, n);
        if (mz.x >= r.x && mz.x < r.x + r.w && mz.y >= r.y && mz.y < r.y + r.h && K.menuIdx !== i) { K.menuIdx = i; S().play('move'); }
      }
    }
    var tp = I.tap();
    if (tp) {
      for (i = 0; i < n; i++) {
        r = menueRect(i, n);
        if (tp.x >= r.x && tp.x < r.x + r.w && tp.y >= r.y && tp.y < r.y + r.h) { K.menuIdx = i; aktivieren(G, l[i]); return; }
      }
      // Pfeile neben Spieler 2 antippen: andere Figur
      if (tp.y > 70 && tp.y < 150 && tp.x > 512 / 2 + 20) waehlen(G, tp.x > 512 / 2 + 90 ? 1 : -1);
      return;
    }
    if (I.hit('down')) { K.menuIdx = (K.menuIdx + 1) % n; S().play('move'); }
    if (I.hit('up')) { K.menuIdx = (K.menuIdx + n - 1) % n; S().play('move'); }
    if (I.hit('left')) waehlen(G, -1);
    if (I.hit('right')) waehlen(G, 1);
    if (I.hit('back') || I.hit('pause')) { G.state = 'title'; S().play('select'); return; }
    if (I.hit('jump') || I.hit('confirm')) aktivieren(G, l[K.menuIdx]);
  }

  /** Steuerung der beiden, so wie sie gerade verteilt ist. */
  function steuerZeilen(G) {
    var pads = In().padZahl ? In().padZahl() : 0;
    var tasten1 = ['A D = LAUFEN', 'LEERTASTE = SPRINGEN', 'SHIFT = SCHLAGEN', 'STRG = ARSCHBOMBE'];
    var tasten2 = ['PFEILE = LAUFEN', 'PFEIL HOCH = SPRINGEN', '. = SCHLAGEN', ', = ARSCHBOMBE'];
    var pad = ['STICK = LAUFEN', 'A = SPRINGEN', 'X = SCHLAGEN', 'LB = ARSCHBOMBE'];
    if (pads >= 2) return [['CONTROLLER 1'].concat(pad), ['CONTROLLER 2'].concat(pad)];
    if (pads === 1) return [['TASTATUR', 'PFEILE ODER A D = LAUFEN', 'LEERTASTE = SPRINGEN', 'SHIFT = SCHLAGEN', 'STRG = ARSCHBOMBE'],
                            ['CONTROLLER'].concat(pad)];
    if (G.touch) return [['TOUCH'], ['CONTROLLER ANSCHLIESSEN']];
    return [['TASTATUR LINKS'].concat(tasten1), ['TASTATUR RECHTS'].concat(tasten2)];
  }

  function menuDraw(ctx, G, W, H) {
    var f = FIGUREN[K.wahl] || FIGUREN[0], i;
    ctx.globalAlpha = 0.97;
    rect(ctx, 0, 0, W, H, '#0b0712');
    ctx.globalAlpha = 1;
    // Honig-Glanz hinter den beiden
    if (LI() && LI().stufe() >= 1) {
      LI().glow(ctx, W / 2 - 90, 100, 70, P1_FARBE, 0.16);
      LI().glow(ctx, W / 2 + 90, 100, 70, f.col, 0.16);
    }
    F().draw(ctx, 'ZU ZWEIT', W / 2, 12, { color: '#ffd257', align: 'center', scale: 2, shadow: true });
    F().draw(ctx, 'DIE GANZE GESCHICHTE. ZWEI SPIELER. EIN HONIGKONTO.', W / 2, 34, { color: '#c8b8e0', align: 'center' });

    // Die beiden Figuren
    var hop = Math.abs(Math.sin(G.tick * 0.08)) * 3;
    P().drawChar(ctx, 'yusuf', W / 2 - 90, 116, { pose: 'idle', frame: (G.tick >> 5) & 1, face: 'laugh', scale: 2 });
    P().drawChar(ctx, f.id, W / 2 + 90, 116 - hop, { pose: hop > 1.5 ? 'jump' : 'idle', frame: (G.tick >> 5) & 1, face: 'laugh', scale: 2, flip: true });
    F().draw(ctx, 'SPIELER 1', W / 2 - 90, 122, { color: P1_FARBE, align: 'center', shadow: true });
    F().draw(ctx, 'YUSUF', W / 2 - 90, 132, { color: '#ffffff', align: 'center', shadow: true });
    F().draw(ctx, 'SPIELER 2', W / 2 + 90, 122, { color: f.col, align: 'center', shadow: true });
    F().draw(ctx, f.name, W / 2 + 90, 132, { color: '#ffffff', align: 'center', shadow: true });
    if ((G.tick >> 4) % 2 === 0) {
      var nb = F().measure(f.name, 1, 1) / 2 + 10;
      F().draw(ctx, '<', W / 2 + 90 - nb, 132, { color: f.col, align: 'center', shadow: true });
      F().draw(ctx, '>', W / 2 + 90 + nb, 132, { color: f.col, align: 'center', shadow: true });
    }
    F().draw(ctx, '+', W / 2, 90, { color: '#ffd257', align: 'center', scale: 2, shadow: true });

    // Wer welche Tasten hat
    var sz = steuerZeilen(G);
    for (var s = 0; s < 2; s++) {
      var x = W / 2 + (s ? 90 : -90);
      for (i = 0; i < sz[s].length; i++) {
        F().draw(ctx, sz[s][i], x, 146 + i * 10, { color: i === 0 ? (s ? f.col : P1_FARBE) : '#a89cc0', align: 'center' });
      }
    }

    // Menue
    var l = menuePunkte(G), n = l.length;
    for (i = 0; i < n; i++) {
      var r = menueRect(i, n), sel = i === K.menuIdx;
      if (sel) {
        rect(ctx, r.x, r.y, r.w, r.h - 1, 'rgba(255,210,87,0.14)');
        // Wie im Hauptmenue: der Pfeil (Schrift: | ist ein Pfeil) steht vor dem Eintrag
        F().draw(ctx, '|', W / 2 - F().measure(l[i].label, 1, 1) / 2 - 14, r.y + 3, { color: '#ffd257' });
      }
      F().draw(ctx, l[i].label, W / 2, r.y + 3, { color: sel ? '#ffffff' : '#d8cfe8', align: 'center', shadow: true });
    }
    F().draw(ctx, G.hinweis ? G.hinweis('LINKS / RECHTS = FIGUR VON SPIELER 2') : 'LINKS / RECHTS = FIGUR VON SPIELER 2',
             W / 2, H - 11, { color: '#8f86a8', align: 'center' });
  }

  global.Koop = {
    FIGUREN: FIGUREN,
    an: function () { return K.an; },
    p2: function () { return K.an ? K.p2 : null; },
    figur: function () { return K.figur; },
    farbe: K.figurFarbe,
    ein: ein, aus: aus,
    // Menue ZU ZWEIT (game.js: Zustand 'koop')
    oeffnen: oeffnen, menuUpdate: menuUpdate, menuDraw: menuDraw,
    waehle: function (id) { for (var i = 0; i < FIGUREN.length; i++) if (FIGUREN[i].id === id) K.wahl = i; },
    // Level und Ablauf
    laden: laden, vorher: vorher, zweiter: zweiter, tod: tod,
    zurueck: function (G) { if (K.an && K.p1 && G.player !== K.p1) G.player = K.p1; },
    alle: alle, aktive: aktive, naechster: naechster, zusammen: zusammen,
    gegnerKontakt: gegnerKontakt, bossUpdate: bossUpdate, bossStart: bossStart,
    kamera: kamera, heilen: heilen, jubeln: jubeln, istKumpel: istKumpel,
    fokusTick: fokusTick,
    // Zeichnen
    zeichnen: zeichnen, blaseMalen: blaseMalen, zeichen: zeichen, hud: hud, oben: oben, wer: wer,
    // fuer Tests
    _K: K, _frei: frei, _blaseStart: blaseStart, _platzen: platzen, _leine: leine, LEINE: LEINE
  };

})(window);
