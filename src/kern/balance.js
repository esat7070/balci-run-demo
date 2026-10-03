/* =====================================================================
   balance.js — alle Stellschrauben an einem Ort.

   Hier stehen die Zahlen, an denen man drehen kann, ohne den restlichen
   Code zu verstehen. Die Spieldateien lesen von hier. Nach einer
   Aenderung: Seite neu laden, fertig. Zum Pruefen, ob es besser oder
   schlechter geworden ist: tests/playtest.html (siehe docs/PLAYTEST_REPORT.md).

   Zeiten sind in Ticks angegeben: 60 Ticks = 1 Sekunde.
   ===================================================================== */
(function (global) {
  'use strict';

  var B = {
    /* Es gibt nur EINE Schwierigkeit (Esat, 29.09.: wegen der Bestenliste,
       und das Spiel wird von Level zu Level ohnehin schwerer). Die Tabelle
       bleibt, damit alle Werte an einer Stelle stehen. Alte Spielstaende
       mit "leicht" oder "schwer" laufen einfach auf "normal" weiter. */
    stufe: 'normal',

    /* ---------- Die Werte ----------
       herzen        Herzen pro Leben
       leben         Leben (sind alle weg: frische Leben, weiter am Checkpoint)
       bossHp        Faktor auf die Energie jedes Bosses (1 = wie in BOSS_HP)
       bossPause     Faktor auf die Verschnaufpausen der Bosse (mehr = mehr Zeit)
       gegnerTempo   Faktor auf das Tempo der normalen Gegner
       unverwundbar  so lange blinkt Yusuf nach einem Treffer (Ticks)
       halten        Kraftprobe: Gedrueckthalten reicht statt Haemmern
       bestenliste   kommt ein Durchgang auf dieser Stufe in die Bestenliste? */
    STUFEN: {
      normal: { name: 'NORMAL', herzen: 3, leben: 4, bossHp: 1, bossPause: 1, gegnerTempo: 1,
                unverwundbar: 96, halten: false, bestenliste: true }
    },
    STUFEN_REIHE: ['normal'],

    /* ---------- Yusuf ---------- */
    SPIELER: {
      GRAV: 0.55,              // Schwerkraft pro Tick
      MAX_FALL: 11,            // hoechste Fallgeschwindigkeit
      ACC: 0.55,               // Beschleunigung beim Laufen
      FRIC_GROUND: 0.74,       // Bremsen am Boden (kleiner = rutschiger)
      FRIC_AIR: 0.93,          // Bremsen in der Luft
      MAX_WALK: 2.15,          // Gehtempo
      MAX_RUN: 3.15,           // Renntempo (Shift)
      JUMP_V: -8.9,            // Sprungkraft
      JUMP2_V: -7.5,           // Bauch-Boost (Doppelsprung)
      COYOTE: 6,               // so lange nach der Kante darf man noch springen
      BUFFER: 8,               // so frueh vor der Landung zaehlt ein Sprungdruck
      POUND_CHARGE: 8,         // Ausholen vor dem Bauch-Stampfer
      POUND_SPEED: 13,         // Fallgeschwindigkeit beim Stampfer
      PUSTE_MAX: 100,          // Puste-Leiste
      STAMPFER_KOSTET: 42,     // so viel Puste kostet ein Stampfer
      PUSTE_PRO_TICK: 0.42,    // so schnell kommt Puste zurueck
      STAMPFER_BOSS: 0.5,      // Stampfer auf Bosse: halber Schaden
      EINSCHLAFEN_NACH: 300,   // Ticks Stillstehen, bis Yusuf einschlaeft
      TOD_DAUER: 70,           // Ticks vom Tod bis zur Blende (frueher 100)
      UNVERWUNDBAR_RESPAWN: 90 // blinken nach dem Wiedereinstieg
    },

    /* ---------- Airsoft (Level 21) ---------- */
    AIRSOFT: {
      MAGAZIN: 30,             // BBs pro Magazin
      NACHLADEN: 70,           // Dauer des Nachladens
      BB_TAKT: 7,              // Ticks zwischen zwei Schuessen (antippen)
      BB_DAUER: 11,            // ... und bei gehaltener Taste
      BB_TEMPO: 7.5,
      BB_BOSS: 1 / 4,          // so viel Schaden macht ein BB bei Sonnet
      FENSTER: 2               // hoechstens so viel BB-Schaden pro Gelegenheit
                               // (er zielt, wirft, laedt nach, Panne)
    },

    /* ---------- Doener und Pizza (Level 20 und 23) ----------
       Das Ziel bleibt 10.000 Kalorien. Vorher reichte eine einzige volle
       Pizza (bis 18.700 kcal) bzw. zwei Doener. Jetzt braucht man
       2-3 Stueck, wer alles richtig macht, kommt mit zwei hin. */
    MINISPIELE: {
      PIZZA_MAX_BELAG: 7,      // so viele Sachen passen auf eine Pizza (vorher 12)
      PIZZA_SPEZIAL: 1.4,      // Bonus fuer das YUSUF-SPEZIAL (vorher 1.6)
      DOENER_STABIL: 80,       // so viel haelt das Brot, bevor es reisst (vorher 100)
      DOENER_SPEZIAL: 1.4,     // Bonus fuer das YUSUF-SPEZIAL (vorher 1.6)
      // Fussball (Level 16): wer verliert, spielt von vorn. Pro verlorener
      // Partie wird Georgios so viel langsamer und Alex haelt so viel
      // seltener (Anteil). Vorher konnte ein schwacher Spieler endlos
      // verlieren (Testlauf: 16 Minuten).
      FUSSBALL_HILFE: 0.15,
      FUSSBALL_HILFE_MAX: 4,   // hoechstens so viele Stufen
      // Flug (Level 27): Vogelschwaerme kamen ohne Warnung und in einer
      // Sekunde (Testlauf Anfaenger: 16 Game Over). Jetzt blinkt vorher
      // ein ! am Rand, wie beim anderen Flugzeug.
      FLUG_VOGEL_WARNUNG: 45,  // Ticks Vorwarnung
      FLUG_VOGEL_TEMPO: 1.0    // so viel schneller als der Flieger (vorher 1.4)
    },

    /* ---------- Gegnertempo pro Level ----------
       1 = Grundtempo. Wirkt auf Tempo und Angriffslust der normalen Gegner.
       Level 11 (Broke) von 1.35 auf 1.15: die Mikas brachten dem
       Durchschnittsspieler in jedem Testlauf 4 Game Over. */
    GEGNERTEMPO: {
      1: 0.82, 2: 1.0, 3: 1.15, 4: 1.1, 5: 1.34, 6: 1.2, 7: 1.5, 8: 1, 9: 1.35, 10: 1.25,
      11: 1.15, 12: 1.2, 13: 1.35, 14: 1.3, 15: 1.45, 16: 1.4, 17: 1.5, 18: 1.4, 19: 1.45, 20: 1,
      21: 1.5, 22: 1.25, 23: 1, 24: 1.45, 25: 1.5, 26: 1.55, 27: 1, 28: 1.55, 29: 1.6, 30: 1.7
    },

    /* ---------- Energie der Bosse (auf Normal) ----------
       PRO HERZ. Jeder Boss hat drei Herzen, jedes ist ein voller Balken
       (Semih: ein Herz pro Form, im ersten Kampf fuenf).
       Seit den drei Herzen fuer alle ist die Gesamtenergie ungefaehr die
       von vorher, nur auf drei Balken verteilt (in Klammern: vorher gesamt). */
    // Vorher: Lennart und Erfan (Level 3/4) waren schwerer als Huseyin;
    // Esat, Broke, Hamza, Felix und Sonnet brachten dem Durchschnittsspieler
    // 3-4 Game Over; Sonnet schwankte zwischen 0:40 und 4 Minuten.
    BOSS_HP: {
      mirkan: 3,     // (10)
      lennart: 3,    // (9)
      erfan: 3,      // (10)
      huseyin: 5,    // (15)
      esat: 4,       // (13)
      alex: 5,       // (16)
      broke: 4,      // (12)
      hamza: 5,      // (2 x 8)
      georgios: 7,   // (3 x 7, hatte schon drei Herzen)
      riese: 3,      // (10)
      nils: 3,       // (10)
      sonnet: 3,     // (8)
      felix: 3,      // (10)
      semih: 5,      // pro Form, 5 Formen
      semih2: 7      // pro Form, 3 Formen
    },

    /* ---------- Schaden an Bossen (Esat, 02.10.) ----------
       Yusuf macht an jedem Boss 30 % weniger Schaden. Umgesetzt als mehr
       Energie pro Herz (Energie / 0.7): ein Sprung zaehlt weiter 1, der
       Stampfer 0.5, ein BB ein Viertel — es braucht nur mehr davon. So
       gilt es fuer alle Bosse gleich, auch fuer Sonnets BBs und den Riesen. */
    SCHADEN_AN_BOSSE: 0.7,

    /* ---------- Die Kraftprobe am Ende (Level 30) ----------
       Jeder Druck schiebt den Balken um DRUCK. Pro Tick verliert man
       VERLUST, nach 5 Sekunden kommt pro Tick ZUWACHS dazu.
       Mit diesen Werten gewinnt man ab 4 Druecken pro Sekunde (nach ~12 s),
       mit 6 pro Sekunde nach ~6 s, mit 10 nach ~3 s.
       HALTEN_LEICHT: auf "Leicht" reicht Gedrueckthalten (Schub pro Tick). */
    KRAFTPROBE: { DRUCK: 0.05, VERLUST: 0.0015, ZUWACHS: 0.0000015, HALTEN_LEICHT: 0.0045 }
  };

  /** Wert des aktuellen Schwierigkeitsgrads. */
  B.s = function (k) { return (B.STUFEN[B.stufe] || B.STUFEN.normal)[k]; };

  B.setStufe = function (st) { if (B.STUFEN[st]) B.stufe = st; };

  /** Tempo der normalen Gegner in diesem Level, mit Schwierigkeitsgrad. */
  B.gegnerTempo = function (lvl) {
    return (B.GEGNERTEMPO[lvl.id] || lvl.diff || 1) * B.s('gegnerTempo');
  };

  /** Energie eines frisch erzeugten Bosses setzen (Tabelle x Stufe)
      und seine Verschnaufpausen an den Schwierigkeitsgrad anpassen. */
  B.bossAnpassen = function (boss, typ) {
    if (!boss) return;
    var basis = B.BOSS_HP[typ];
    if (basis) {
      // Pro Herz mindestens 2 — sonst waere "Leicht" bei den kleinen
      // Bossen nicht leichter als "Normal". Dann 30 % weniger Schaden
      // (SCHADEN_AN_BOSSE), auf ein Zehntel gerundet.
      var hp = Math.max(2, Math.round(basis * B.s('bossHp')));
      hp = Math.round(hp / B.SCHADEN_AN_BOSSE * 10) / 10;
      boss.maxHp = hp; boss.hp = hp;
    }
    var f = B.s('bossPause');
    if (f !== 1 && typeof boss.go === 'function') {
      var go = boss.go;
      boss.go = function (st, t) {
        go.call(this, st, st === 'idle' && t > 0 ? Math.round(t * f) : t);
      };
    }
  };

  B.kraftprobe = function () {
    var k = B.KRAFTPROBE;
    return { druck: k.DRUCK, verlust: k.VERLUST, zuwachs: k.ZUWACHS,
             halten: B.s('halten') ? k.HALTEN_LEICHT : 0 };
  };

  global.Balance = B;
})(window);
