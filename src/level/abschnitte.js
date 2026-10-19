/* =====================================================================
   abschnitte.js — Baukasten fuer lange Strecken.

   Ab Level 12 sind die Level vier- bis fuenfmal so lang wie frueher.
   Damit das nicht alles von Hand gesetzt werden muss (und trotzdem
   abwechslungsreich und schaffbar bleibt), werden sie aus Abschnitten
   zusammengesteckt. Jeder Abschnitt beginnt und endet auf Bodenhoehe,
   bringt Gegner, Gefahren und Essen aus dem Thema des Levels mit und
   ist einzeln so gebaut, dass man ihn schaffen kann. Die Erreichbarkeit
   prueft smoketest.html mit der echten Sprungphysik nach.

   Zu Fuss (Bodenhoehe 15, Levelhoehe 18):
     flach, luecken, treppe, ebenen, tabletts, turm, kisten, arena,
     mauer, rast
   Seit 03.10. (strecke.js): begegnung (jemand steht am Weg, th.npcs),
     hinterhalt (Gitter zu, Wellen), geheim (Mauer mit Kammer hinten)
   Mit dem Fahrrad (die Strecke geht bergab, Boden sinkt):
     stufen, rampe, dornen, bienen, abgrund, huckel
   ===================================================================== */
(function (global) {
  'use strict';

  var B = 15;                      // Bodenhoehe zu Fuss

  /** th = Thema: { boden: [Gegner], flug: [Gegner], zaeh: Gegner,
      gefahr: Typ, essen: Item, schilder: [Texte] } */
  function Zufuss(b, x, th) {
    this.b = b; this.x = x; this.th = th;
    this.n = 0;                    // Zaehler, damit sich nicht alles gleicht
    this.schild = 0;
  }

  Zufuss.prototype.feind = function (x, y, art) {
    var th = this.th, liste = th[art || 'boden'];
    if (!liste) { if (art === 'flug') return; liste = th.boden; }
    var t = typeof liste === 'string' ? liste : liste[(this.n + x) % liste.length];
    this.b.e(t, x, y);
  };
  Zufuss.prototype.essen = function () { return this.th.essen || 'doener'; };
  Zufuss.prototype.gefahr = function (x0, x1) {
    if (this.th.gefahr) this.b.hz(x0, x1, B - 1, this.th.gefahr);
  };

  /** Einen Abschnitt anhaengen. opts.gold = Goldhonig ganz oben. */
  Zufuss.prototype.add = function (name, opts) {
    var w = STUECKE[name].call(this, this.b, this.x, opts || {});
    this.x += w;
    this.n++;
    return this;
  };
  Zufuss.prototype.folge = function (namen) {
    for (var i = 0; i < namen.length; i++) {
      var n = namen[i];
      if (typeof n === 'string') this.add(n);
      else this.add(n[0], n[1]);
    }
    return this;
  };

  var STUECKE = {
    // Ebener Boden, zwei Gegner, ein Honigbogen
    flach: function (b, x) {
      b.g(x, x + 23, B);
      this.feind(x + 8, B); this.feind(x + 17, B);
      b.trail(x + 2, B - 2, 5, 2, 2);
      b.q(x + 12, B - 4, 'honig', 3);
      return 24;
    },

    // Zwei echte Gruben, eine mit Trittstein, Honig ueber den Luecken
    luecken: function (b, x) {
      b.g(x, x + 5, B).g(x + 11, x + 16, B).g(x + 21, x + 29, B);
      b.p(x + 8, B - 3, 2);
      this.feind(x + 8, B - 6, 'flug');
      this.feind(x + 13, B); this.feind(x + 25, B);
      b.trail(x + 5, B - 3, 4, 2, 3).trail(x + 17, B - 3, 3, 2, 3);
      return 30;
    },

    // Rauf aufs Podest, oben ein zaeher Gegner, wieder runter
    treppe: function (b, x) {
      b.g(x, x + 4, B).g(x + 5, x + 7, B - 1).g(x + 8, x + 10, B - 2)
       .g(x + 11, x + 19, B - 3).g(x + 20, x + 22, B - 2).g(x + 23, x + 27, B);
      this.feind(x + 15, B - 3, this.th.zaeh ? 'zaeh' : 'boden');
      b.q(x + 14, B - 7, this.essen());
      b.k(x + 18, B - 4, 'honig');
      b.trail(x + 11, B - 5, 4, 2);
      return 28;
    },

    // Drei Etagen: Boden mit Gefahren, Mitte, oben — und ganz oben was Gutes
    ebenen: function (b, x, o) {
      b.g(x, x + 43, B);
      this.gefahr(x + 15, x + 18);
      this.gefahr(x + 30, x + 32);
      b.p(x + 6, B - 4, 6).p(x + 20, B - 4, 7).p(x + 34, B - 4, 6);
      b.p(x + 12, B - 8, 8).p(x + 26, B - 8, 8);
      b.p(x + 21, B - 12, 4);
      b.sp(x + 3, B - 1);
      this.feind(x + 9, B); this.feind(x + 25, B); this.feind(x + 39, B);
      this.feind(x + 23, B - 4);
      this.feind(x + 16, B - 10, 'flug');
      b.trail(x + 12, B - 9, 5, 2).trail(x + 26, B - 9, 5, 2).trail(x + 6, B - 5, 3, 2);
      if (o.gold) b.gold(x + 22, B - 13);
      else b.it('honig', x + 21, B - 13).it('honig', x + 22, B - 13).it('honig', x + 23, B - 13);
      return 44;
    },

    // Grube mit Pfeilern — und Tabletts darueber, wer es bequemer mag
    tabletts: function (b, x) {
      b.g(x, x + 5, B).g(x + 27, x + 32, B);
      b.g(x + 11, x + 12, B - 2).g(x + 17, x + 18, B - 1).g(x + 23, x + 24, B - 2);
      b.mv(x + 9, B - 5, 3, 'x', 3, 0.55).mv(x + 20, B - 6, 3, 'x', 3, 0.6);
      b.trail(x + 7, B - 7, 5, 2).trail(x + 17, B - 8, 5, 2);
      this.feind(x + 16, B - 8, 'flug');
      // Wo man nach der Grube landet, steht (wenn das Thema es sagt) nur
      // jemand Gemuetliches — ein Rollkoffer dort schubst einen zurueck rein.
      this.feind(x + 30, B, this.th.ruhig ? 'ruhig' : 'boden');
      return 33;
    },

    // Zickzack nach oben, ueber die Spitze, auf der anderen Seite runter
    turm: function (b, x, o) {
      b.g(x, x + 29, B);
      b.p(x + 4, B - 3, 4).p(x + 10, B - 6, 4).p(x + 4, B - 9, 4).p(x + 10, B - 12, 5);
      b.p(x + 17, B - 10, 4).p(x + 22, B - 7, 4).p(x + 26, B - 4, 3);
      b.q(x + 16, B - 4, 'honig', 4);
      this.feind(x + 15, B - 8, 'flug');
      this.feind(x + 20, B);
      b.trail(x + 10, B - 13, 5, 1);
      if (o.gold) b.gold(x + 12, B - 14);
      return 30;
    },

    // Kistenwand: drueber springen oder durchbrechen (Stampfer, im Knast: Faust)
    kisten: function (b, x) {
      b.g(x, x + 21, B);
      b.k(x + 8, B - 1).k(x + 8, B - 2, 'honig').k(x + 8, B - 3);
      b.k(x + 14, B - 1, this.essen()).k(x + 14, B - 2);
      b.q(x + 11, B - 4, 'honig', 3);
      this.feind(x + 18, B);
      return 22;
    },

    // Ein offener Platz mit mehreren Gegnern — und einer Belohnung
    arena: function (b, x) {
      b.g(x, x + 33, B);
      b.p(x + 8, B - 4, 5).p(x + 21, B - 4, 5);
      this.feind(x + 6, B); this.feind(x + 14, B); this.feind(x + 27, B);
      if (this.th.zaeh) this.feind(x + 19, B, 'zaeh');
      this.feind(x + 17, B - 7, 'flug');
      b.it('herz', x + 10, B - 6);
      b.q(x + 23, B - 8, this.essen());
      b.trail(x + 2, B - 2, 4, 2).trail(x + 28, B - 2, 3, 2);
      return 34;
    },

    // Hohe Mauer: ueber Stufen rauf, oben laufen, auf der anderen Seite runter
    mauer: function (b, x) {
      b.g(x, x + 11, B).g(x + 12, x + 17, B - 7).g(x + 18, x + 25, B);
      b.p(x + 7, B - 3, 3);
      b.mv(x + 10, B - 5, 2, 'y', 2, 0.5);
      this.feind(x + 15, B - 7);
      b.trail(x + 12, B - 9, 3, 2);
      b.q(x + 21, B - 4, 'honig', 3);
      return 26;
    },

    /* ----- Seit 03.10.: was auf dem Weg passiert (strecke.js) ----- */

    // Jemand steht am Weg (th.npcs, der Reihe nach): kurz reden, manchmal
    // gibt es was. Davor und dahinter ein bisschen Honig.
    begegnung: function (b, x) {
      var liste = this.th.npcs || [], n = liste[(this.npcN = (this.npcN || 0) + 1) - 1];
      b.g(x, x + 23, B);
      b.trail(x + 2, B - 2, 3, 2, 1).trail(x + 17, B - 2, 3, 2, 1);
      if (n) b.npc(n.who, x + 12, B, n);
      return 24;
    },

    // Hinterhalt wie in den Arenen von Hollow Knight: Gitter zu, Wellen
    // von oben, danach Belohnung. Zwei Plattformen zum Ausweichen.
    hinterhalt: function (b, x) {
      var th = this.th, wellen = th.wellen;
      if (!wellen) {
        // Keine zaehen Gegner und hoechstens ein Flieger: in der geschlossenen
        // Arena wird es sonst schnell unfair (Playtest: Level 24 und 28)
        var bo = th.boden || ['wecker'], fl = th.flug;
        var w1 = [[bo[0], 6], [bo[1 % bo.length], 22], [bo[0], 14]];
        var w2 = [[bo[1 % bo.length], 8], [bo[(2 % bo.length)], 20]];
        if (fl) w2.push([typeof fl === 'string' ? fl : fl[0], 15, B - 7]);
        else w2.push([bo[0], 14]);
        wellen = [w1, w2];
      }
      b.g(x, x + 29, B);
      b.p(x + 6, B - 4, 4).p(x + 20, B - 4, 4).p(x + 12, B - 7, 6);
      b.trail(x + 13, B - 8, 4, 1);
      b.falle(x + 1, x + 28, B, wellen, { text: th.hinterhaltText || 'HINTERHALT!',
                                          belohnung: ['herz', this.essen(), 'honig', 'honig', 'honig'] });
      return 30;
    },

    // Eine dicke Mauer, ueber die der Weg fuehrt. Ihre Rueckseite ist eine
    // falsche Wand (Hollow Knight): wer nach dem Runterspringen umdreht und
    // reinlaeuft, findet eine Kammer mit Honig, Essen und einem Schild.
    geheim: function (b, x, o) {
      var texte = this.th.geheim || ['HIER WAR SCHON MAL JEMAND. ER HATTE HUNGER.'];
      b.g(x, x + 33, B);
      b.p(x + 4, B - 2, 3).p(x + 7, B - 4, 3);      // zwei Stufen rauf
      b.p(x + 10, B - 6, 12, 2);                    // Mauerkrone
      b.p(x + 10, B - 4, 2, 4);                     // vorne massiv
      // Kammer: x+12 .. x+21, vier Kacheln hoch, Eingang hinten (x+21)
      b.versteck(x + 12, B - 4, 10, 4, 'rechts');
      b.trail(x + 13, B - 2, 4, 2);
      b.it(this.essen(), x + 18, B - 1).it('herz', x + 20, B - 2);
      if (o.gold) b.gold(x + 16, B - 3);
      var gi = (this.geheimN = (this.geheimN || 0) + 1) - 1;
      b.sign(x + 14, B, texte[gi % texte.length]);
      // Oben auf der Mauer
      this.feind(x + 16, B - 6);
      b.trail(x + 12, B - 8, 4, 2, 1);
      // Der Weg geht hinten runter weiter
      b.trail(x + 24, B - 2, 4, 2);
      this.feind(x + 29, B);
      return 34;
    },

    // Verschnaufen: Checkpoint, Schild, was zu essen
    rast: function (b, x) {
      b.g(x, x + 15, B);
      b.cp(x + 6, B);
      var s = this.th.schilder || [];
      if (s.length) b.sign(x + 2, B, s[this.schild++ % s.length]);
      b.it(this.essen(), x + 10, B - 2).it('herz', x + 12, B - 2);
      return 16;
    },

    /* ----- Airsoft (Level 21) ----- */

    // Stellung: zwei Palettenwaende, dahinter die Gegner. Die Waende
    // halten BBs ab — von beiden Seiten. Drueber springen, dann schiessen.
    stellung: function (b, x) {
      b.g(x, x + 27, B);
      b.wall(x + 7, B - 2, B - 1).wall(x + 18, B - 2, B - 1);
      this.feind(x + 11, B); this.feind(x + 23, B);
      b.trail(x + 6, B - 4, 3, 1).trail(x + 17, B - 4, 3, 1);
      b.q(x + 13, B - 5, 'honig', 3);
      return 28;
    },

    // Hochsitz: oben liegt ein Sniper im Busch. Ueber die Kiste hoch.
    hochsitz: function (b, x, o) {
      b.g(x, x + 25, B);
      b.p(x + 3, B - 3, 3);
      b.p(x + 8, B - 6, 6);
      b.e('sniper', x + 11, B - 6);
      this.feind(x + 19, B);
      b.trail(x + 8, B - 7, 2, 1).trail(x + 15, B - 2, 4, 2);
      if (o.gold) {
        b.p(x + 16, B - 10, 3);
        b.gold(x + 17, B - 11);
      } else {
        b.it('honig', x + 17, B - 8).it('honig', x + 18, B - 8);
      }
      return 26;
    },

    // Lichtung: flach, offen, keine Deckung. Hier sieht man jeden —
    // besonders jemanden in Weiss (Mirkans Auftritt, siehe airsoft.js).
    // Keine Gegner: die Szene bringt ihre eigenen Leute mit.
    lichtung: function (b, x) {
      b.g(x, x + 39, B);
      b.trail(x + 3, B - 2, 4, 2).trail(x + 29, B - 3, 5, 2, 2);
      b.q(x + 21, B - 5, 'honig', 3);
      return 40;
    },

    /* ----- Flughafen (Level 24/25) ----- */

    // Schalter: zwei Tresen zum Drueberspringen, darueber die Anzeigetafel
    schalter: function (b, x) {
      b.g(x, x + 27, B);
      b.p(x + 5, B - 2, 5, 2).p(x + 17, B - 2, 5, 2);
      b.p(x + 10, B - 6, 7);
      this.feind(x + 13, B); this.feind(x + 25, B);
      b.trail(x + 5, B - 3, 3, 2).trail(x + 17, B - 3, 3, 2).trail(x + 11, B - 7, 3, 2);
      b.it(this.essen(), x + 16, B - 7);
      return 28;
    },

    // Laufbaender: eine flache Senke (zwei Kacheln tief, man kommt wieder
    // raus — ein Abgrund mitten in der Abflughalle waere seltsam), darueber
    // fahren die Baender hin und her, mit Honig drauf
    laufband: function (b, x) {
      b.g(x, x + 5, B).g(x + 6, x + 25, B + 2).g(x + 26, x + 31, B);
      b.mv(x + 8, B - 2, 3, 'x', 4, 0.6).mv(x + 17, B - 3, 3, 'x', 3, 0.55);
      b.trail(x + 8, B - 4, 4, 2).trail(x + 17, B - 5, 4, 2);
      this.feind(x + 14, B - 7, 'flug');
      this.feind(x + 20, B + 2, this.th.ruhig ? 'ruhig' : 'boden');
      b.it(this.essen(), x + 12, B + 1);
      return 32;
    },

    /* ----- Istanbul (Level 28) ----- */

    // Galata-Bruecke: oben wird geangelt (Haken am Boden), dazwischen
    // geht es ins Goldene Horn
    bruecke: function (b, x) {
      b.g(x, x + 9, B).g(x + 13, x + 24, B).g(x + 28, x + 33, B);
      b.hz(x + 5, x + 6, B - 1, 'angel');
      b.hz(x + 19, x + 20, B - 1, 'angel');
      this.feind(x + 16, B - 5, 'flug');
      this.feind(x + 31, B);
      b.trail(x + 9, B - 3, 3, 2, 2).trail(x + 24, B - 3, 3, 2, 2);
      return 34;
    },

    // Schuetzengraben: zwei Kacheln tiefer, drin wird gewartet
    graben: function (b, x) {
      b.g(x, x + 5, B).g(x + 6, x + 19, B + 2).g(x + 20, x + 25, B);
      this.feind(x + 10, B + 2); this.feind(x + 16, B + 2);
      b.trail(x + 7, B - 1, 6, 2, 2);
      b.it(this.essen(), x + 12, B + 1);
      return 26;
    }
  };

  /* ---------- Fahrrad: es geht bergab ---------- */

  /** th (optional) = { schilder: [Texte] } — die stehen dann an den Rastplaetzen. */
  function Bergab(b, x, y, th) { this.b = b; this.x = x; this.y = y; this.n = 0; this.th = th || {}; this.schild = 0; }

  Bergab.prototype.add = function (name, opts) {
    var r = RAD[name].call(this, this.b, this.x, this.y, opts || {});
    this.x += r[0]; this.y += r[1];
    this.n++;
    return this;
  };
  Bergab.prototype.folge = function (namen) {
    for (var i = 0; i < namen.length; i++) {
      var n = namen[i];
      if (typeof n === 'string') this.add(n);
      else this.add(n[0], n[1]);
    }
    return this;
  };

  var RAD = {
    // Drei Stufen runter
    stufen: function (b, x, y) {
      b.g(x, x + 9, y).g(x + 10, x + 19, y + 1).g(x + 20, x + 29, y + 2);
      b.trail(x + 2, y - 1, 5, 2).trail(x + 21, y + 1, 4, 2);
      return [30, 2];
    },
    // Rampe ueber eine Luecke, Honig genau auf der Flugbahn
    rampe: function (b, x, y, o) {
      b.g(x, x + 11, y).g(x + 20, x + 35, y + 3);
      b.kick(x + 11, y);
      b.trail(x + 12, y - 3, 5, 2, 5);
      if (o.gold) b.gold(x + 16, y - 9);
      b.trail(x + 23, y + 2, 5, 2);
      return [36, 3];
    },
    // Dornbuesche: hopsen
    dornen: function (b, x, y) {
      b.g(x, x + 27, y);
      b.hz(x + 9, x + 9, y - 1, 'dornen').hz(x + 19, x + 20, y - 1, 'dornen');
      b.trail(x + 7, y - 3, 3, 2, 2).trail(x + 17, y - 3, 3, 2, 2);
      return [28, 0];
    },
    // Bienen im Weg. Das Fahrrad faehrt einfach durch.
    bienen: function (b, x, y) {
      b.g(x, x + 23, y);
      b.e('biene', x + 9, y - 3).e('biene', x + 16, y - 5);
      b.q(x + 13, y - 4, 'honig', 3);
      return [24, 0];
    },
    // Ein Sprung ins Tal
    abgrund: function (b, x, y) {
      b.g(x, x + 9, y).g(x + 10, x + 23, y + 5);
      b.trail(x + 10, y + 1, 4, 2, 3);
      return [24, 5];
    },
    // Ein kleiner Huckel: kurz hopsen, dann weiter runter
    huckel: function (b, x, y) {
      b.g(x, x + 7, y).g(x + 8, x + 13, y - 1).g(x + 14, x + 25, y + 1);
      b.trail(x + 8, y - 3, 3, 2);
      return [26, 1];
    },
    // Flaches Stueck mit Checkpoint
    rast: function (b, x, y) {
      b.g(x, x + 15, y);
      b.cp(x + 4, y);
      b.it('doener', x + 10, y - 2);
      var s = this.th.schilder || [];
      if (s.length) b.sign(x + 8, y, s[this.schild++ % s.length]);
      return [16, 0];
    },

    /* ----- Waldweg (Level 22) ----- */

    // Ein umgestuerzter Baumstamm quer ueber dem Weg: hopsen
    stamm: function (b, x, y) {
      b.g(x, x + 25, y);
      b.p(x + 12, y - 1, 2);
      b.trail(x + 9, y - 3, 7, 1, 3);
      return [26, 0];
    },
    // Wurzeln: zwei kleine Buckel hintereinander, dann ein Stueck runter
    wurzeln: function (b, x, y) {
      b.g(x, x + 7, y).g(x + 8, x + 9, y - 1).g(x + 10, x + 16, y)
       .g(x + 17, x + 18, y - 1).g(x + 19, x + 27, y + 1);
      b.trail(x + 7, y - 3, 3, 1).trail(x + 16, y - 3, 3, 1);
      return [28, 1];
    },
    // Wildschweine kreuzen. Das Fahrrad faehrt einfach durch.
    schweine: function (b, x, y) {
      b.g(x, x + 29, y);
      b.e('schwein', x + 12, y).e('schwein', x + 20, y);
      b.trail(x + 3, y - 2, 4, 2).q(x + 16, y - 4, 'honig', 3);
      return [30, 0];
    }
  };

  global.Abschnitte = {
    zufuss: function (b, x, th) { return new Zufuss(b, x, th); },
    bergab: function (b, x, y, th) { return new Bergab(b, x, y, th); }
  };

})(window);
