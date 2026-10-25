/* =====================================================================
   wachsam.js — Bosse merken, wenn man sie mit immer demselben Trick
   fertigmacht (Esat, 25.10.: "ich habe die ganze Zeit Arschbombe gespammt
   und konnte ihn ohne Schaden schnell besiegen. Sowas sollte der Boss
   checken ... damit der Spieler weiss, okay, das geht nicht").

   Gezaehlt werden echte Treffer (der Balken wird kleiner). Eine Kette
   waechst, solange
     - es dieselbe Angriffsart ist (Arschbombe, Draufspringen, Waffe, Wurf),
     - Yusuf ungefaehr an derselben Stelle bleibt (nicht ausweicht),
     - er dazwischen nicht getroffen wird,
     - die Treffer schnell hintereinander kommen.
   Treffer, waehrend der Boss BETAEUBT liegt, zaehlen nicht: da sind
   mehrere Treffer gewollt (Mario-Trick).

   Ist die Kette lang genug (Esat: "Milder"):
     - der Boss blockt genau diese Angriffsart ein paar Sekunden
       (GEBLOCKT!, Yusuf prallt ab — alles andere geht weiter),
     - eine Druckwelle schleudert Yusuf weg und kostet ein Herz
       (nie das letzte),
     - der Boss sagt dazu was, und beim ersten Mal erklaert ein Tipp,
       was los ist: abwechseln.
   Eingeklinkt wird in boss.hit (jede Boss-Klasse hat ihre eigene), beim
   Start des Kampfes in game.js.
   ===================================================================== */
(function (global) {
  'use strict';

  function S() { return global.Sound; }
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }

  // Stellschrauben
  var KETTE = { bombe: 4, sprung: 4, waffe: 5, schuss: 5 };  // ab so vielen Treffern greift er ein
  var NAH = 96;          // so weit darf Yusuf sich vom ersten Treffer entfernen (Pixel)
  var LUECKE = 210;      // so lange darf es zwischen zwei Treffern dauern (Ticks)
  var BLOCK = 270;       // so lange blockt er danach diese Angriffsart (Ticks)

  /* Was die Bosse sagen, wenn sie es merken. */
  var MERKT = {
    mirkan: ['WARUM IMMER DASSELBE? IST DAS EINE FRAGE?', 'MOMENT. DAS HATTEN WIR SCHON. ODER?'],
    lennart: ['DAS IST KEIN TRAINING, BRO. DAS IST SPAM.', 'IMMER DIE GLEICHE ÜBUNG? NEUER PLAN!'],
    erfan: ['IN MASCHHAD NENNT MAN DAS FEIGE.', 'EIN TRICK. IMMER WIEDER. WIE BILLIGER SAFRAN.'],
    huseyin: ['IMMER DASSELBE. WIE DEIN ESSEN.', 'ICH HAB DEIN MUSTER GESEHEN. ICH LAUFE ZWÖLF KILOMETER.'],
    _: ['SCHON WIEDER? NICHT MIT MIR!', 'DENKST DU, ICH MERK DAS NICHT?', 'IMMER DASSELBE. LANGWEILIG.']
  };
  var ART_NAME = { bombe: 'ARSCHBOMBE', sprung: 'DRAUFSPRINGEN', waffe: 'WAFFE', schuss: 'WERFEN' };

  /* Bosse, bei denen man laut Bauplan immer von derselben Stelle trifft
     (feste Trefferstellen) — dort waere das kein Spam, sondern der Weg.
     Der Playtest-Bot starb sonst bei einem davon 16 statt 4 Mal.
     (Die Demo bekommt hier eine leere Liste, baue_demo.py.) */
  var OHNE = {};

  /** Beim Start eines Bosskampfs: in boss.hit einklinken. */
  function an(G, b, bt) {
    // G.keinWachsam: Testseiten, die Bosse absichtlich von einer Stelle aus erledigen
    if (!b || b.wachsam || G.keinWachsam || OHNE[bt]) return;
    b.wachsam = true;
    G.wach = { art: null, n: 0, anker: 0, letzt: -9999, hp: 0, block: null, prallT: 0, typ: bt, konter: 0 };
    var hit = b.hit;
    if (typeof hit !== 'function') return;
    b.hit = function (g, dmg, p) {
      var w = g.wach;
      if (!w || this.dead) return hit.apply(this, arguments);
      p = p || g.player;
      var art = g.wachArt || (p && p.schlag ? 'waffe' : (p && p.pound === -1 ? 'bombe' : (arguments[2] ? 'sprung' : 'schuss')));
      // Gerade geblockt: abprallen, kein Schaden
      if (w.block && w.block.art === art && w.block.t > 0) {
        abprallen(g, this, p);
        return;
      }
      var hp0 = this.hp, l0 = this.leben, d0 = this.dead, st0 = this.state;
      var r = hit.apply(this, arguments);
      var traf = this.hp !== hp0 || this.leben !== l0 || this.dead !== d0;
      if (traf) zaehlen(g, this, p, art, st0);
      return r;
    };
  }

  function zaehlen(g, b, p, art, st0) {
    var w = g.wach;
    if (!p || b.dead || st0 === 'betaeubt') { w.n = 0; return; }
    var gleich = art === w.art && Math.abs(p.cx() - w.anker) < NAH && g.tick - w.letzt < LUECKE && p.hp >= w.hp;
    if (gleich) w.n++;
    else { w.art = art; w.n = 1; w.anker = p.cx(); w.hp = p.hp; }
    w.letzt = g.tick;
    if (w.n >= (KETTE[art] || 4)) konter(g, b, p, art);
  }

  /** Er hat es gemerkt: blocken, Druckwelle, ein Herz (nie das letzte). */
  function konter(g, b, p, art) {
    var w = g.wach;
    w.n = 0; w.art = null; w.konter++;
    w.block = { art: art, t: BLOCK };
    var dir = p.cx() < b.cx() ? -1 : 1;
    var satz = rnd(MERKT[w.typ] || MERKT._);
    // Eigener Text, nicht b.satz: den wuerde der naechste Spruch des Bosses abschneiden
    g.floats.add(b.cx(), b.y - 30, satz, '#ff8a8a', 140);
    g.shake(9, 22);
    if (S()) { S().play('bossRoar'); S().play('pound'); }
    if (g.einschlag) g.einschlag(b.cx(), b.y + b.h, 'boss');
    if (g.particles) {
      for (var i = 0; i < 26; i++) {
        var a = (i / 26) * Math.PI * 2;
        g.particles.spawn({ x: b.cx(), y: b.y + b.h * 0.6, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 2.6,
                            life: 26, col: i % 2 ? '#ff6a6a' : '#ffd257', size: 3, grav: 0 });
      }
    }
    // Yusuf fliegt weg
    p.pound = 0; p.weit = false;
    if (p.hp > 1) {
      p.invuln = 0;
      var kippen = p.smoke;
      p.hurt(g, 1, b.cx());
      // Kippen schuetzen sonst vor dem Herz — hier nicht: er hat es verdient
      if (kippen && !p.smoke && p.hp > 1) p.hp--;
    }
    p.vx = dir * 5.6; p.vy = -6.8; p.grounded = false;
    g.floats.add(b.cx(), b.y - 8, 'DURCHSCHAUT!|' + (ART_NAME[art] || '') + ' GEBLOCKT', '#ff6a6a', 110);
    // Beim ersten Mal: was ist hier los?
    if (g.toasts && !g.wachTipp) {
      g.wachTipp = true;
      g.toasts.push({ art: 'text', tipp: true, zeile1: 'DER BOSS LERNT MIT', zeile2: 'IMMER DASSELBE WIRD GEBLOCKT. ABWECHSELN!',
                      col: '#ff8a8a', zeit: 200 });
    }
  }

  /** Geblockt: abprallen, ohne Schaden. */
  function abprallen(g, b, p) {
    var w = g.wach;
    if (w.prallT > 0 || !p) return;
    w.prallT = 24;
    var dir = p.cx() < b.cx() ? -1 : 1;
    p.pound = 0; p.weit = false;
    p.vx = dir * 3.6; p.vy = Math.min(p.vy, -5.5); p.grounded = false;
    b.flash = 8;
    g.floats.add(b.cx(), b.y - 6, 'GEBLOCKT!', '#c8c0d8', 40);
    if (S()) S().play('kling');
    g.particles && g.particles.burst(b.cx() - dir * b.w * 0.3, p.feet ? p.feet() : b.y, 8,
                                     { col: '#e8e4f0', spread: 2.2, up: 0.8, life: 16 });
  }

  /** Jeden Tick (game.js): Block und Abprall laufen ab. */
  function tick(G) {
    var w = G.wach;
    if (!w) return;
    if (w.prallT > 0) w.prallT--;
    if (w.block && --w.block.t <= 0) w.block = null;
    if (!G.boss || G.boss.dead) G.wach = null;
  }

  global.Wachsam = { an: an, tick: tick, KETTE: KETTE, BLOCK: BLOCK };

})(window);
