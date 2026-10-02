/* =====================================================================
   ebenen.js — Tiefe wie bei Hollow Knight: Ebenen vor und hinter dem
   Spielfeld.

   Hinter dem Spielfeld (Ebenen.hinten):
     - Dunst legt sich ueber den Hintergrund: was weit weg ist, wird
       blasser (Luftperspektive). game.js zeichnet den Hintergrund dazu
       weich (Tiefenunschaerfe) und laesst ihn leicht mitwandern, wenn die
       Kamera hoch und runter faehrt.
     - Nebelbaender ziehen am Boden entlang.
     - Hinten schweben Teilchen: Staub, Pollen, Sporen, Gluehwuermchen ...
   Vor dem Spielfeld (Ebenen.vorne):
     - Lichtstrahlen fallen schraeg herein.
     - Teilchen auf Spielfeld-Hoehe und ganz nah an der Kamera (gross, unscharf).
     - Licht: Yusuf leuchtet in dunklen Welten, Honig und Goldhonig strahlen.
     - Dunkle, unscharfe Silhouetten ganz vorne (Graeser, Kisten, Ketten,
       Ranken, Lichterketten ...), die schneller vorbeiziehen als die Welt.
       Wo Yusuf dahinter steht, werden sie durchsichtig.
   Danach (Ebenen.nachher): Bloom, Farbstimmung, runde Vignette.

   Jede Welt (Theme) hat ihre eigene Mischung (WELTEN). Gezeichnet wird in
   Spiel-Pixeln; licht.js sorgt fuer die feine Aufloesung.
   ===================================================================== */
(function (global) {
  'use strict';

  var L = global.Licht;

  /* ---------- Die Welten ----------
     dunst/dunstA   Luftperspektive ueber dem Hintergrund
     boden/bodenA   Nebelband hinter dem Spielfeld, am Boden
     teilchen       was in der Luft schwebt (siehe TEILCHEN)
     strahlen       Lichtstrahlen { col, n, a, winkel, breite }
     unten / oben   Silhouetten ganz vorne (siehe UNTEN, OBEN), dicht = wie viele
     vcol           Farbe der Silhouetten
     ton/tonA       Farbstimmung, bloom/schwelle, vign = Vignette
     licht          Yusuf leuchtet (dunkle Welten): { col, r, a } */
  var WELTEN = {
    zimmer: { dunst: '#5c3a6e', dunstA: 0.2, boden: '#f0a05c', bodenA: 0.08, teilchen: ['staub'],
              strahlen: { col: '#ffc890', n: 3, a: 0.075, winkel: 0.55, breite: 30 },
              unten: ['kleider', 'pflanze', 'stuhl', 'lampe', 'kiste', 'buecher'], dicht: 0.55, oben: ['vorhang'], obenDicht: 0.18,
              vcol: '#140c1e', ton: '#ff9a6a', tonA: 0.14, bloom: 0.38, vign: 0.45 },
    garten: { dunst: '#bdeeff', dunstA: 0.1, boden: '#e8f8c0', bodenA: 0.08, teilchen: ['pollen', 'blaetter'],
              strahlen: { col: '#fff4b0', n: 4, a: 0.06, winkel: 0.35, breite: 36 },
              unten: ['gras', 'blumen', 'busch', 'gras', 'zaun', 'gras'], dicht: 0.95, oben: ['ast'], obenDicht: 0.35,
              vcol: '#0c2410', ton: '#ffe08a', tonA: 0.1, bloom: 0.14, schwelle: 3, vign: 0.32 },
    gym: { dunst: '#3e2d55', dunstA: 0.2, boden: '#7a4a6a', bodenA: 0.12, teilchen: ['kreide'],
           strahlen: { col: '#ff9ad8', n: 2, a: 0.06, winkel: 0.05, breite: 44 },
           unten: ['hantel', 'bank', 'hantel', 'flaschen', 'kugel'], dicht: 0.6, oben: ['kette', 'lampe_h', 'sack'], obenDicht: 0.4,
           vcol: '#0c0814', ton: '#ff6fa8', tonA: 0.1, bloom: 0.5, vign: 0.5 },
    kueche: { dunst: '#584060', dunstA: 0.18, boden: '#a8786a', bodenA: 0.1, teilchen: ['dampf', 'staub'],
              strahlen: { col: '#ffd8a0', n: 2, a: 0.055, winkel: 0.4, breite: 34 },
              unten: ['topf', 'flaschen', 'pflanze', 'kiste'], dicht: 0.55, oben: ['pfannen', 'lampe_h'], obenDicht: 0.4,
              vcol: '#120c16', ton: '#ff8a3c', tonA: 0.1, bloom: 0.4, vign: 0.45 },
    festung: { dunst: '#2a1a3a', dunstA: 0.26, boden: '#6a2a48', bodenA: 0.16, teilchen: ['sporen'],
               strahlen: { col: '#b4ff8a', n: 2, a: 0.05, winkel: -0.2, breite: 30 },
               unten: ['salat', 'dornen', 'stein', 'dornen'], dicht: 0.7, oben: ['kette', 'ranken'], obenDicht: 0.45,
               vcol: '#06040a', ton: '#9dff6a', tonA: 0.08, bloom: 0.6, vign: 0.58,
               licht: { col: '#d8ffb0', r: 70, a: 0.12 } },
    markt: { dunst: '#e2e8f0', dunstA: 0.08, teilchen: ['staub'],
             unten: ['wagen', 'kiste', 'flaschen'], dicht: 0.45, oben: ['schild_h', 'roehre'], obenDicht: 0.45,
             vcol: '#1a1c24', ton: '#f4f7fb', tonA: 0, bloom: 0.08, schwelle: 3, vign: 0.3 },
    strasse: { dunst: '#43215a', dunstA: 0.2, boden: '#a8425a', bodenA: 0.12, teilchen: ['regen', 'motten'],
               unten: ['pfosten', 'hydrant', 'muell', 'busch', 'pfosten'], dicht: 0.55, oben: ['kabel'], obenDicht: 0.3,
               vcol: '#05040a', ton: '#6a5aff', tonA: 0.1, bloom: 0.7, vign: 0.55,
               licht: { col: '#ffd8a0', r: 64, a: 0.13 } },
    siedlung: { dunst: '#c4dcf0', dunstA: 0.14, boden: '#f2d8a4', bodenA: 0.08, teilchen: ['pollen'],
                strahlen: { col: '#fff0c0', n: 3, a: 0.055, winkel: 0.45, breite: 34 },
                unten: ['hecke', 'zaun', 'zwerg', 'briefkasten', 'blumen', 'gras'], dicht: 0.7, oben: ['ast'], obenDicht: 0.3,
                vcol: '#101a14', ton: '#ffd890', tonA: 0.12, bloom: 0.15, schwelle: 3, vign: 0.35 },
    siedlung_nacht: { dunst: '#2a2650', dunstA: 0.2, boden: '#5a3a62', bodenA: 0.1, teilchen: ['gluehw'],
                      unten: ['hecke', 'zaun', 'briefkasten', 'muell', 'gras'], dicht: 0.65, oben: ['ast', 'kabel'], obenDicht: 0.3,
                      vcol: '#04050c', ton: '#5a6aff', tonA: 0.1, bloom: 0.7, vign: 0.55,
                      licht: { col: '#ffe0a8', r: 64, a: 0.13 } },
    berg: { dunst: '#c2e6f4', dunstA: 0.16, boden: '#eaf6e0', bodenA: 0.1, teilchen: ['pollen', 'blaetter'],
            strahlen: { col: '#fff6c8', n: 3, a: 0.065, winkel: 0.4, breite: 36 },
            unten: ['farn', 'stein', 'gras', 'pilz'], dicht: 0.8, oben: ['tanne'], obenDicht: 0.3,
            vcol: '#0a1c10', ton: '#fff0b0', tonA: 0.1, bloom: 0.15, schwelle: 3, vign: 0.35 },
    imbiss: { dunst: '#5a3220', dunstA: 0.2, boden: '#946038', bodenA: 0.12, teilchen: ['dampf', 'glut'],
              strahlen: { col: '#ffb45a', n: 2, a: 0.05, winkel: 0.3, breite: 30 },
              unten: ['hocker', 'flaschen', 'topf'], dicht: 0.5, oben: ['lampe_h', 'lichterkette'], obenDicht: 0.45,
              vcol: '#0e0806', ton: '#ff9a4a', tonA: 0.12, bloom: 0.5, vign: 0.5 },
    bar: { dunst: '#2e1840', dunstA: 0.25, boden: '#44204e', bodenA: 0.16, teilchen: ['rauch', 'staub'],
           strahlen: { col: '#ff8ad8', n: 3, a: 0.06, winkel: -0.25, breite: 28 },
           unten: ['shisha', 'hocker', 'kissen'], dicht: 0.55, oben: ['lampe_h', 'lichterkette'], obenDicht: 0.45,
           vcol: '#06030a', ton: '#ff6ad8', tonA: 0.12, bloom: 0.75, vign: 0.6,
           licht: { col: '#ffb8e8', r: 60, a: 0.1 } },
    taverne: { dunst: '#d0e0f0', dunstA: 0.06, boden: '#b8d0ea', bodenA: 0.06, teilchen: ['staub'],
               strahlen: { col: '#ffffff', n: 3, a: 0.065, winkel: 0.45, breite: 34 },
               unten: ['amphore', 'stuhl', 'pflanze'], dicht: 0.5, oben: ['reben', 'lichterkette'], obenDicht: 0.4,
               vcol: '#0c1220', ton: '#ffe8b0', tonA: 0.08, bloom: 0.1, schwelle: 3, vign: 0.35 },
    stadion: { dunst: '#a8c8ec', dunstA: 0.06, teilchen: ['konfetti'],
               strahlen: { col: '#ffffff', n: 2, a: 0.05, winkel: -0.35, breite: 40 },
               unten: ['koepfe'], dicht: 1, oben: ['fahnen'], obenDicht: 0.25,
               vcol: '#0a0c14', ton: '#ffffff', tonA: 0, bloom: 0.1, schwelle: 3, vign: 0.35 },
    knast: { dunst: '#343842', dunstA: 0.2, boden: '#444852', bodenA: 0.1, teilchen: ['staub'],
             unten: ['gitter', 'muell', 'gitter'], dicht: 0.5, oben: ['stacheldraht', 'rohr'], obenDicht: 0.4,
             vcol: '#05060a', ton: '#f07a28', tonA: 0.06, bloom: 0.5, vign: 0.6,
             licht: { col: '#fff0d0', r: 58, a: 0.09 } },
    wald: { dunst: '#8ac4dc', dunstA: 0.14, boden: '#e4ecc4', bodenA: 0.1, teilchen: ['pollen', 'blaetter'],
            strahlen: { col: '#fff6c8', n: 4, a: 0.085, winkel: 0.28, breite: 32 },
            unten: ['farn', 'pilz', 'stamm', 'gras', 'farn'], dicht: 0.9, oben: ['ast', 'ranken'], obenDicht: 0.4,
            vcol: '#06140a', ton: '#d8ff9a', tonA: 0.08, bloom: 0.2, schwelle: 3, vign: 0.45 },
    flughafen: { dunst: '#c8d0dc', dunstA: 0.12, teilchen: ['staub'],
                 strahlen: { col: '#ffd8a8', n: 3, a: 0.065, winkel: 0.5, breite: 40 },
                 unten: ['koffer', 'absperrung', 'pflanze'], dicht: 0.5, oben: ['schild_h', 'lampe_h'], obenDicht: 0.35,
                 vcol: '#10141c', ton: '#ffb88a', tonA: 0.1, bloom: 0.18, schwelle: 3, vign: 0.35 },
    gate: { dunst: '#b8d4ec', dunstA: 0.12, teilchen: ['staub'],
            strahlen: { col: '#fff0c8', n: 3, a: 0.065, winkel: 0.45, breite: 40 },
            unten: ['sitzreihe', 'koffer', 'absperrung'], dicht: 0.5, oben: ['schild_h'], obenDicht: 0.3,
            vcol: '#0e1220', ton: '#ffe0a0', tonA: 0.08, bloom: 0.12, schwelle: 3, vign: 0.35 },
    kabine: { dunst: '#d8dee8', dunstA: 0.04, teilchen: ['staub'],
              strahlen: { col: '#ffffff', n: 4, a: 0.03, winkel: 0.12, breite: 26 },
              unten: ['sitze'], dicht: 1, oben: ['gepaeckfach'], obenDicht: 1,
              vcol: '#141822', ton: '#e8f0ff', tonA: 0, bloom: 0.04, schwelle: 3, vign: 0.38 },
    istanbul: { dunst: '#c8dcec', dunstA: 0.06, boden: '#f4d8a8', bodenA: 0.1, teilchen: ['staub', 'blueten'],
                strahlen: { col: '#ffe0a0', n: 3, a: 0.065, winkel: 0.45, breite: 36 },
                unten: ['katze', 'stand', 'pflanze', 'teeglas'], dicht: 0.6, oben: ['lichterkette', 'markise'], obenDicht: 0.45,
                vcol: '#140c10', ton: '#ffc070', tonA: 0.12, bloom: 0.12, schwelle: 3, vign: 0.4 },
    semih: { dunst: '#4a1a22', dunstA: 0.15, teilchen: ['goldstaub'], vcol: '#0a0608',
             ton: '#f4a44a', tonA: 0.1, bloom: 0.5, vign: 0.5 },
    semih_erinnerung: { dunst: '#6a5038', dunstA: 0.12, teilchen: ['staub'], vcol: '#1a120a',
                        ton: '#c8a070', tonA: 0.2, bloom: 0.3, vign: 0.6 },
    semih_kosmos: { teilchen: ['sterne'], vcol: '#05030f', ton: '#8a6aff', tonA: 0.08, bloom: 0.8, vign: 0.5 },
    semih_riss: { teilchen: ['glut'], vcol: '#060204', ton: '#ff4a2a', tonA: 0.1, bloom: 0.7, vign: 0.6 },
    heimat: { dunst: '#1e2a58', dunstA: 0.2, boden: '#3a3a6a', bodenA: 0.1, teilchen: ['gluehw'],
              unten: ['hecke', 'zaun', 'briefkasten', 'gras'], dicht: 0.6, oben: ['ast', 'kabel'], obenDicht: 0.3,
              vcol: '#04050c', ton: '#5a6aff', tonA: 0.1, bloom: 0.6, vign: 0.55,
              licht: { col: '#ffe0a8', r: 64, a: 0.13 } }
  };
  var LEER = { teilchen: [], vign: 0.4, bloom: 0.3 };
  function welt(theme) { return WELTEN[theme] || LEER; }

  /* ---------- Teilchen ----------
     n = [hinten, mitte, vorne], gr = Groesse, a = Deckkraft, leuchtet = addiert
     sich (Gluehwuermchen, Glut), form = punkt | blatt | wolke | rechteck | stern */
  var TEILCHEN = {
    staub: { n: [18, 12, 3], col: ['#fff2d8', '#ffe8c0'], gr: [0.5, 1.1], a: 0.55, vx: [-0.06, 0.06], vy: [-0.05, 0.03],
             schwing: 0.25, blink: 0.05 },
    goldstaub: { n: [16, 12, 3], col: ['#ffd88a', '#fff0c0'], gr: [0.5, 1.2], a: 0.6, vx: [-0.05, 0.05], vy: [-0.12, -0.02],
                 schwing: 0.2, blink: 0.06, leuchtet: true },
    pollen: { n: [16, 10, 3], col: ['#fff8c8', '#ffffff', '#f4f0a0'], gr: [0.5, 1.2], a: 0.6, vx: [0.08, 0.3], vy: [-0.08, 0.06],
              schwing: 0.5, blink: 0.03 },
    motten: { n: [10, 6, 2], col: ['#ffe8b0', '#d8c8ff'], gr: [0.5, 1], a: 0.45, vx: [-0.15, 0.15], vy: [-0.1, 0.1],
              schwing: 1.2, blink: 0.2 },
    gluehw: { n: [14, 9, 3], col: ['#d8ff6a', '#f4ff9a'], gr: [0.7, 1.3], a: 0.85, vx: [-0.15, 0.15], vy: [-0.1, 0.08],
              schwing: 0.9, blink: 0.035, leuchtet: true, glow: 7 },
    sporen: { n: [16, 10, 3], col: ['#9dff8a', '#c8ffd8', '#8af0e0'], gr: [0.6, 1.3], a: 0.7, vx: [-0.06, 0.06], vy: [-0.3, -0.08],
              schwing: 0.4, blink: 0.04, leuchtet: true, glow: 5 },
    blaetter: { n: [5, 4, 1], col: ['#6a9a3a', '#c8a040', '#a8682a', '#8ab84a'], gr: [1.6, 2.6], a: 0.85, vx: [-0.5, -0.1], vy: [0.25, 0.55],
                schwing: 1.4, form: 'blatt' },
    blueten: { n: [5, 4, 1], col: ['#ffb8d0', '#ffd8e8', '#ffffff'], gr: [1.2, 2], a: 0.85, vx: [-0.4, -0.05], vy: [0.2, 0.45],
               schwing: 1.3, form: 'blatt' },
    kreide: { n: [16, 10, 3], col: ['#f4f4ff', '#e0e0f0'], gr: [0.5, 1.1], a: 0.5, vx: [-0.05, 0.05], vy: [-0.04, 0.05],
              schwing: 0.3, blink: 0.04 },
    dampf: { n: [5, 3, 0], col: ['#ffffff'], gr: [8, 16], a: 0.05, vx: [-0.05, 0.08], vy: [-0.35, -0.15], form: 'wolke',
             leben: [160, 260], von: 'unten' },
    rauch: { n: [7, 4, 0], col: ['#d8c8f0', '#c8b8e0'], gr: [14, 26], a: 0.045, vx: [0.08, 0.22], vy: [-0.08, 0.02], form: 'wolke',
             leben: [260, 420] },
    glut: { n: [12, 10, 3], col: ['#ffb43c', '#ff7a2a', '#ffd257'], gr: [0.6, 1.3], a: 0.9, vx: [-0.1, 0.1], vy: [-0.6, -0.2],
            schwing: 0.6, flacker: true, leuchtet: true, glow: 5, leben: [90, 200], von: 'unten' },
    konfetti: { n: [6, 6, 1], col: ['#e05a4a', '#ffd257', '#6fc8e8', '#8cd85a', '#c8a0e8', '#ffffff'], gr: [1.2, 1.8], a: 0.9,
                vx: [-0.2, 0.2], vy: [0.3, 0.6], schwing: 1, form: 'rechteck' },
    sterne: { n: [24, 10, 3], col: ['#ffffff', '#c8d8ff', '#ffe8a8'], gr: [0.5, 1.2], a: 0.9, vx: [-0.03, 0.03], vy: [-0.03, 0.03],
              blink: 0.08, leuchtet: true, glow: 4, form: 'stern' },
    // Regen wie in der Stadt der Traenen: feine Striche, schnell und schraeg
    regen: { n: [46, 30, 0], col: ['#a8b8e0', '#c8d4f0'], gr: [5, 9], a: 0.32, vx: [-1.3, -0.9], vy: [6.5, 8.5], form: 'strich' }
  };
  // Hinten (Parallaxe 0.45, klein, blass), Spielfeld (1), vorne an der Kamera (1.7, gross, unscharf)
  var LAGEN = [{ par: 0.45, gr: 0.7, a: 0.55 }, { par: 1, gr: 1, a: 1 }, { par: 1.7, gr: 3.2, a: 0.32 }];

  function zufall(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function zw(r, R) { return r[0] + (r[1] - r[0]) * R(); }

  var Z = { theme: null, lagen: [[], [], []], t: -1, camX: 0, camY: 0, R: zufall(1) };

  function teilchenNeu(art, lage, W, H, R, frisch) {
    var d = TEILCHEN[art];
    var p = { art: art, x: R() * (W + 60) - 30, y: R() * (H + 40) - 20, vx: zw(d.vx, R), vy: zw(d.vy, R),
              gr: zw(d.gr, R), ph: R() * 6.283, col: d.col[(R() * d.col.length) | 0], dreh: R() * 6.283,
              leben: d.leben ? zw(d.leben, R) : 0, alter: 0 };
    if (d.leben && !frisch) p.alter = R() * p.leben;          // nicht alle gleichzeitig
    if (frisch && d.von === 'unten') p.y = H + 10 + R() * 20;
    return p;
  }

  function teilchenAufbauen(cfg, W, H) {
    var R = Z.R;
    Z.lagen = [[], [], []];
    var st = L ? L.stufe() : 2;
    (cfg.teilchen || []).forEach(function (art) {
      var d = TEILCHEN[art];
      if (!d) return;
      for (var lage = 0; lage < 3; lage++) {
        var n = Math.round(d.n[lage] * (st === 0 ? 0.5 : 1));
        for (var i = 0; i < n; i++) Z.lagen[lage].push(teilchenNeu(art, lage, W, H, R, false));
      }
    });
  }

  function teilchenSchritt(W, H, dx, dy, t) {
    for (var lage = 0; lage < 3; lage++) {
      var f = LAGEN[lage].par, list = Z.lagen[lage];
      for (var i = 0; i < list.length; i++) {
        var p = list[i], d = TEILCHEN[p.art];
        p.x += p.vx - dx * f + Math.sin(t * 0.021 + p.ph) * (d.schwing || 0) * 0.12;
        p.y += p.vy - dy * f + Math.cos(t * 0.017 + p.ph * 1.3) * (d.schwing || 0) * 0.06;
        p.dreh += 0.04 + (d.schwing || 0) * 0.02;
        if (d.leben) {
          p.alter++;
          if (p.alter > p.leben) { list[i] = teilchenNeu(p.art, lage, W, H, Z.R, true); continue; }
        }
        // Am Rand wieder herein (die Luft ist ueberall voll)
        var rand = lage === 2 ? 60 : 30;
        if (p.x < -rand) p.x += W + rand * 2; else if (p.x > W + rand) p.x -= W + rand * 2;
        if (p.y < -rand) p.y += H + rand * 2; else if (p.y > H + rand) p.y -= H + rand * 2;
      }
    }
  }

  function teilchenZeichnen(ctx, lage, t) {
    var list = Z.lagen[lage], LG = LAGEN[lage];
    if (!list.length) return;
    var sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    for (var i = 0; i < list.length; i++) {
      var p = list[i], d = TEILCHEN[p.art];
      var a = d.a * LG.a;
      if (d.blink) a *= 0.55 + 0.45 * Math.sin(t * d.blink * 2 + p.ph * 3);
      if (d.flacker) a *= 0.6 + 0.4 * Math.sin(t * 0.4 + p.ph * 7);
      if (d.leben) {
        var k = p.alter / p.leben;
        a *= Math.min(1, k * 5) * Math.min(1, (1 - k) * 3);
      }
      if (a <= 0.01) continue;
      var gr = p.gr * LG.gr;
      var form = d.form || 'punkt';
      if (form === 'wolke') {
        ctx.globalAlpha = a;
        var wb = L.glowBild(p.col);
        ctx.drawImage(wb, p.x - gr * 1.6, p.y - gr, gr * 3.2, gr * 2);
        ctx.globalAlpha = 1;
        continue;
      }
      if (form === 'strich') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = lage === 0 ? 0.6 : 0.9;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * gr * 0.5, p.y - p.vy * gr * 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      if (lage === 2 || form === 'punkt' || form === 'stern') {
        // Rund und weich (vorne als grosse, unscharfe Scheibe)
        var r = lage === 2 ? gr * 2.2 : gr * 1.6;
        if (d.leuchtet) {
          L.glow(ctx, p.x, p.y, r * 1.3, p.col, a, true);
          if (d.glow && lage < 2) L.glow(ctx, p.x, p.y, d.glow * LG.gr, p.col, a * 0.35);
        } else {
          ctx.globalAlpha = a;
          ctx.drawImage(L.glowBild(p.col, true), p.x - r, p.y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
        }
        if (form === 'stern' && lage < 2 && a > 0.5) {
          ctx.globalAlpha = (a - 0.5) * 1.4;
          ctx.fillStyle = p.col;
          ctx.fillRect(p.x - gr * 2.5, p.y - 0.25, gr * 5, 0.5);
          ctx.fillRect(p.x - 0.25, p.y - gr * 2.5, 0.5, gr * 5);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.dreh);
      ctx.fillStyle = p.col;
      if (form === 'blatt') {
        ctx.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(p.dreh)));
        ctx.beginPath(); ctx.ellipse(0, 0, gr, gr * 0.55, 0, 0, 6.283); ctx.fill();
      } else {
        ctx.scale(Math.cos(p.dreh * 1.7), 1);
        ctx.fillRect(-gr / 2, -gr * 0.35, gr, gr * 0.7);
      }
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = sm;
  }

  /* ---------- Silhouetten ganz vorne ----------
     Jede Welt bekommt einen Streifen (SW breit, wiederholt sich) mit
     Dingen, die unten auf dem Boden stehen, und einen fuer oben (haengt).
     Gezeichnet in halber Aufloesung: so werden sie beim Vergroessern
     weich — wie unscharf, weil sie ganz nah an der Kamera sind. */
  var SW = 1100, FH = 110, FT = 70;

  function blob(c, pts) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }
  function kreis(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); }
  function oval(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, 6.283); c.fill(); }
  function rechteck(c, x, y, w, h) { c.fillRect(x, y, w, h); }
  function halm(c, x, y, h, w, lean) {
    c.beginPath(); c.moveTo(x - w, y);
    c.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h);
    c.quadraticCurveTo(x + lean * 0.3 + w * 0.4, y - h * 0.55, x + w, y);
    c.closePath(); c.fill();
  }

  /* Dinge auf dem Boden. c ist auf Spiel-Pixel skaliert, Boden bei y = FH.
     licht(x, y, col, r) meldet eine Lampe (leuchtet spaeter echt). */
  var UNTEN = {
    gras: function (c, x, R) {
      var n = 6 + (R() * 7 | 0);
      for (var i = 0; i < n; i++) halm(c, x + (R() - 0.5) * 34, FH, 14 + R() * 30, 1.6 + R() * 2.2, (R() - 0.5) * 22);
    },
    farn: function (c, x, R) {
      for (var k = 0; k < 4; k++) {
        var dir = k % 2 ? 1 : -1, len = 26 + R() * 22, ang = -Math.PI / 2 + dir * (0.4 + R() * 0.5);
        for (var s = 0; s < 9; s++) {
          var f = s / 9, px = x + Math.cos(ang) * len * f + dir * f * f * 10, py = FH - Math.sin(-ang) * len * f + f * f * 12;
          oval(c, px, py, 4.2 * (1 - f) + 1, 1.6 * (1 - f) + 0.6);
        }
      }
      halm(c, x, FH, 12, 2, 0);
    },
    busch: function (c, x, R) {
      var n = 5 + (R() * 4 | 0);
      for (var i = 0; i < n; i++) kreis(c, x + (R() - 0.5) * 40, FH - 8 - R() * 16, 9 + R() * 9);
      rechteck(c, x - 22, FH - 10, 44, 10);
    },
    hecke: function (c, x, R) {
      rechteck(c, x - 34, FH - 26, 68, 26);
      for (var i = 0; i < 9; i++) kreis(c, x - 32 + i * 8, FH - 26 + (R() - 0.5) * 4, 5 + R() * 3);
    },
    blumen: function (c, x, R) {
      for (var i = 0; i < 4; i++) {
        var bx = x + (R() - 0.5) * 26, h = 16 + R() * 18;
        halm(c, bx, FH, h, 0.9, (R() - 0.5) * 6);
        oval(c, bx, FH - h - 2, 3.2, 4);
        oval(c, bx - 3, FH - h * 0.45, 3, 1.2);
      }
    },
    pflanze: function (c, x, R) {
      blob(c, [x - 10, FH - 18, x + 10, FH - 18, x + 7, FH, x - 7, FH]);
      for (var i = 0; i < 6; i++) {
        var ang = -Math.PI / 2 + (i - 2.5) * 0.42;
        c.save(); c.translate(x, FH - 18); c.rotate(ang + Math.PI / 2);
        oval(c, 0, -14 - R() * 6, 3.5, 13 + R() * 6); c.restore();
      }
    },
    stein: function (c, x, R) {
      var w = 18 + R() * 16, h = 9 + R() * 9;
      blob(c, [x - w, FH, x - w * 0.8, FH - h * 0.7, x - w * 0.2, FH - h, x + w * 0.5, FH - h * 0.85, x + w, FH - h * 0.3, x + w, FH]);
    },
    zaun: function (c, x, R) {
      for (var i = 0; i < 4; i++) {
        var px = x - 24 + i * 16;
        blob(c, [px - 3, FH, px + 3, FH, px + 3, FH - 34, px, FH - 38, px - 3, FH - 34]);
      }
      rechteck(c, x - 28, FH - 28, 56, 3); rechteck(c, x - 28, FH - 14, 56, 3);
    },
    pfosten: function (c, x) { rechteck(c, x - 3, FH - 30, 6, 30); oval(c, x, FH - 30, 3.5, 2); rechteck(c, x - 4, FH - 22, 8, 3); },
    hydrant: function (c, x) {
      rechteck(c, x - 6, FH - 22, 12, 22); oval(c, x, FH - 22, 6, 4); rechteck(c, x - 10, FH - 16, 20, 4);
      rechteck(c, x - 2, FH - 28, 4, 4);
    },
    muell: function (c, x, R) {
      kreis(c, x - 8, FH - 9, 10); kreis(c, x + 8, FH - 7, 9); kreis(c, x, FH - 16, 7);
      blob(c, [x - 1, FH - 22, x + 3, FH - 26, x + 2, FH - 20]);
      if (R() < 0.5) { rechteck(c, x + 14, FH - 26, 14, 26); rechteck(c, x + 12, FH - 28, 18, 3); }
    },
    kiste: function (c, x, R) {
      var s = 20 + R() * 10;
      rechteck(c, x - s / 2, FH - s, s, s);
      if (R() < 0.5) rechteck(c, x - s / 2 + 4, FH - s * 1.7, s * 0.7, s * 0.7);
    },
    flaschen: function (c, x, R) {
      for (var i = 0; i < 4; i++) {
        var bx = x - 12 + i * 8 + R() * 2, h = 14 + R() * 8;
        rechteck(c, bx - 2.5, FH - h, 5, h); rechteck(c, bx - 1, FH - h - 6, 2, 6);
      }
    },
    topf: function (c, x) {
      blob(c, [x - 13, FH - 18, x + 13, FH - 18, x + 11, FH, x - 11, FH]);
      rechteck(c, x - 16, FH - 16, 4, 3); rechteck(c, x + 12, FH - 16, 4, 3);
      oval(c, x, FH - 19, 9, 2.5); rechteck(c, x - 2, FH - 23, 4, 3);
    },
    stuhl: function (c, x) {
      rechteck(c, x - 10, FH - 18, 20, 3); rechteck(c, x - 10, FH - 18, 3, 18); rechteck(c, x + 7, FH - 18, 3, 18);
      rechteck(c, x + 7, FH - 40, 3, 22); rechteck(c, x - 1, FH - 40, 10, 3); rechteck(c, x - 1, FH - 32, 10, 2);
    },
    lampe: function (c, x, R, licht) {
      rechteck(c, x - 1, FH - 52, 2, 52); oval(c, x, FH - 1, 8, 2);
      blob(c, [x - 9, FH - 52, x + 9, FH - 52, x + 6, FH - 64, x - 6, FH - 64]);
      licht(x, FH - 50, '#ffd8a0', 30);
    },
    kleider: function (c, x, R) {
      blob(c, [x - 22, FH, x - 18, FH - 9, x - 6, FH - 13, x + 4, FH - 10, x + 14, FH - 14, x + 22, FH - 6, x + 24, FH]);
      blob(c, [x + 6, FH - 12, x + 18, FH - 22, x + 22, FH - 20, x + 14, FH - 10]);
    },
    buecher: function (c, x, R) {
      for (var i = 0; i < 5; i++) rechteck(c, x - 12 + (R() - 0.5) * 3, FH - 5 - i * 5, 22 + R() * 6, 4.4);
    },
    hantel: function (c, x, R) {
      if (R() < 0.5) {
        rechteck(c, x - 16, FH - 8, 32, 3); rechteck(c, x - 16, FH - 15, 6, 15); rechteck(c, x + 10, FH - 15, 6, 15);
      } else {
        rechteck(c, x - 24, FH - 30, 4, 30); rechteck(c, x + 20, FH - 30, 4, 30); rechteck(c, x - 24, FH - 30, 48, 3);
        for (var i = 0; i < 4; i++) { kreis(c, x - 16 + i * 10, FH - 22, 4); kreis(c, x - 16 + i * 10, FH - 10, 4); }
      }
    },
    kugel: function (c, x) { kreis(c, x, FH - 9, 9); blob(c, [x - 6, FH - 16, x - 4, FH - 24, x + 4, FH - 24, x + 6, FH - 16, x + 3, FH - 16, x + 2, FH - 21, x - 2, FH - 21, x - 3, FH - 16]); },
    bank: function (c, x) {
      rechteck(c, x - 26, FH - 18, 52, 5); rechteck(c, x - 22, FH - 14, 4, 14); rechteck(c, x + 18, FH - 14, 4, 14);
      rechteck(c, x + 12, FH - 46, 3, 30); rechteck(c, x - 30, FH - 46, 3, 30); rechteck(c, x - 36, FH - 46, 58, 3);
      kreis(c, x - 38, FH - 44, 7); kreis(c, x + 24, FH - 44, 7);
    },
    wagen: function (c, x) {
      c.save(); c.globalAlpha *= 0.9;
      blob(c, [x - 24, FH - 40, x + 22, FH - 40, x + 16, FH - 16, x - 18, FH - 16]);
      c.restore();
      rechteck(c, x - 26, FH - 42, 4, 4); rechteck(c, x - 30, FH - 46, 8, 2);
      kreis(c, x - 14, FH - 4, 4); kreis(c, x + 12, FH - 4, 4); rechteck(c, x - 18, FH - 16, 34, 3);
    },
    salat: function (c, x, R) {
      for (var i = 0; i < 7; i++) {
        var ang = -Math.PI / 2 + (i - 3) * 0.38;
        c.save(); c.translate(x, FH); c.rotate(ang + Math.PI / 2);
        blob(c, [0, 0, -6, -12, -3, -24 - R() * 10, 0, -30 - R() * 8, 3, -24, 6, -12]); c.restore();
      }
    },
    dornen: function (c, x, R) {
      c.lineWidth = 2.2; c.strokeStyle = c.fillStyle;
      for (var k = 0; k < 3; k++) {
        c.beginPath();
        var px = x - 20 + k * 14, py = FH;
        c.moveTo(px, py);
        for (var s = 1; s <= 5; s++) {
          var nx = px + (R() - 0.5) * 22, ny = py - 9;
          c.quadraticCurveTo((px + nx) / 2 + 6, (py + ny) / 2, nx, ny);
          blob(c, [nx, ny, nx + 5, ny - 2, nx + 1, ny + 2]);
          c.moveTo(nx, ny); px = nx; py = ny;
        }
        c.stroke();
      }
    },
    pilz: function (c, x, R) {
      for (var i = 0; i < 3; i++) {
        var px = x + (i - 1) * 12 + R() * 4, h = 8 + R() * 12;
        rechteck(c, px - 2, FH - h, 4, h);
        c.beginPath(); c.ellipse(px, FH - h, 6 + R() * 3, 5, 0, Math.PI, 0); c.fill();
      }
    },
    stamm: function (c, x, R) {
      oval(c, x, FH - 9, 34, 10); rechteck(c, x - 34, FH - 9, 68, 9);
      blob(c, [x + 12, FH - 16, x + 18, FH - 28, x + 21, FH - 26, x + 16, FH - 15]);
      UNTEN.gras(c, x - 28, R);
    },
    hocker: function (c, x) {
      oval(c, x, FH - 30, 10, 3); rechteck(c, x - 2, FH - 30, 4, 28);
      rechteck(c, x - 8, FH - 12, 16, 2); oval(c, x, FH - 1, 9, 2);
    },
    shisha: function (c, x) {
      oval(c, x, FH - 9, 10, 9); rechteck(c, x - 2, FH - 42, 4, 34); oval(c, x, FH - 42, 7, 3);
      rechteck(c, x - 5, FH - 50, 10, 6);
      c.lineWidth = 2; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(x + 2, FH - 26); c.quadraticCurveTo(x + 26, FH - 30, x + 24, FH - 2); c.stroke();
    },
    kissen: function (c, x, R) { oval(c, x - 10, FH - 8, 16, 8); oval(c, x + 12, FH - 10, 13, 10); },
    amphore: function (c, x) {
      blob(c, [x - 5, FH - 42, x + 5, FH - 42, x + 6, FH - 36, x + 13, FH - 26, x + 11, FH - 8, x + 5, FH,
               x - 5, FH, x - 11, FH - 8, x - 13, FH - 26, x - 6, FH - 36]);
      rechteck(c, x - 8, FH - 44, 16, 3);
    },
    koepfe: function (c, x, R) {
      for (var i = 0; i < 4; i++) {
        var px = x - 30 + i * 18 + (R() - 0.5) * 6, h = 18 + R() * 8;
        kreis(c, px, FH - h - 8, 6 + R() * 1.5);
        oval(c, px, FH - 2, 11, h - 4);
        if (R() < 0.22) { rechteck(c, px + 5, FH - h - 30, 3, 20); rechteck(c, px + 2, FH - h - 34, 9, 6); }
      }
    },
    gitter: function (c, x) {
      for (var i = 0; i < 6; i++) rechteck(c, x - 25 + i * 10, FH - 80, 3, 80);
      rechteck(c, x - 28, FH - 80, 58, 4); rechteck(c, x - 28, FH - 44, 58, 3);
    },
    koffer: function (c, x, R) {
      rechteck(c, x - 12, FH - 30, 24, 28); rechteck(c, x - 5, FH - 36, 10, 3); rechteck(c, x - 6, FH - 36, 2, 6);
      rechteck(c, x + 4, FH - 36, 2, 6); kreis(c, x - 8, FH - 1, 2.5); kreis(c, x + 8, FH - 1, 2.5);
      if (R() < 0.5) rechteck(c, x + 14, FH - 20, 20, 18);
    },
    absperrung: function (c, x) {
      rechteck(c, x - 22, FH - 32, 4, 32); rechteck(c, x + 18, FH - 32, 4, 32);
      oval(c, x - 20, FH - 1, 6, 2); oval(c, x + 20, FH - 1, 6, 2);
      c.lineWidth = 2.5; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(x - 20, FH - 28); c.quadraticCurveTo(x, FH - 18, x + 20, FH - 28); c.stroke();
    },
    sitzreihe: function (c, x) {
      for (var i = 0; i < 3; i++) {
        rechteck(c, x - 30 + i * 21, FH - 30, 18, 4); rechteck(c, x - 30 + i * 21, FH - 46, 4, 18);
      }
      rechteck(c, x - 32, FH - 26, 64, 3); rechteck(c, x - 26, FH - 24, 3, 24); rechteck(c, x + 22, FH - 24, 3, 24);
    },
    sitze: function (c, x, R) {
      // Sitzlehnen im Flugzeug, mit Kopfstuetze
      blob(c, [x - 18, FH, x - 20, FH - 50, x - 14, FH - 62, x + 14, FH - 62, x + 20, FH - 50, x + 18, FH]);
      rechteck(c, x - 10, FH - 70, 20, 10);
    },
    katze: function (c, x, R) {
      oval(c, x, FH - 9, 9, 9); kreis(c, x + 2, FH - 22, 6);
      blob(c, [x - 3, FH - 26, x - 2, FH - 33, x + 1, FH - 27]); blob(c, [x + 3, FH - 27, x + 6, FH - 33, x + 7, FH - 25]);
      c.lineWidth = 2.4; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(x - 8, FH - 3); c.quadraticCurveTo(x - 20, FH - 2, x - 18, FH - 16); c.stroke();
    },
    stand: function (c, x) {
      rechteck(c, x - 26, FH - 24, 52, 24); rechteck(c, x - 26, FH - 52, 3, 28); rechteck(c, x + 23, FH - 52, 3, 28);
      blob(c, [x - 32, FH - 52, x + 32, FH - 52, x + 26, FH - 60, x - 26, FH - 60]);
      for (var i = 0; i < 5; i++) kreis(c, x - 18 + i * 9, FH - 27, 4);
    },
    teeglas: function (c, x) {
      for (var i = 0; i < 3; i++) {
        var px = x - 10 + i * 10;
        blob(c, [px - 3, FH - 4, px + 3, FH - 4, px + 4, FH - 14, px + 2.5, FH - 9, px - 2.5, FH - 9, px - 4, FH - 14]);
        oval(c, px, FH - 2, 5, 2);
      }
    },
    zwerg: function (c, x) {
      oval(c, x, FH - 7, 7, 7); kreis(c, x, FH - 17, 5);
      blob(c, [x - 6, FH - 19, x + 6, FH - 19, x + 1, FH - 36]); oval(c, x, FH - 12, 4, 4);
    },
    briefkasten: function (c, x) {
      rechteck(c, x - 2, FH - 30, 4, 30); rechteck(c, x - 9, FH - 42, 18, 13);
      c.beginPath(); c.ellipse(x, FH - 42, 9, 5, 0, Math.PI, 0); c.fill(); rechteck(c, x + 9, FH - 44, 2, 8);
    },
    kristall: function (c, x, R, licht) {
      for (var i = 0; i < 3; i++) {
        var px = x - 12 + i * 12, h = 14 + R() * 26, w = 4 + R() * 3;
        blob(c, [px - w, FH, px - w * 0.7, FH - h * 0.7, px, FH - h, px + w * 0.7, FH - h * 0.7, px + w, FH]);
      }
      licht(x, FH - 20, '#8a8aff', 26);
    }
  };

  /* Dinge, die von oben haengen. Decke bei y = 0. */
  var OBEN = {
    ast: function (c, x, R) {
      c.lineWidth = 4; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(x - 60, -4); c.quadraticCurveTo(x - 10, 26, x + 50, 14); c.stroke();
      for (var i = 0; i < 16; i++) {
        var f = i / 16, bx = x - 56 + f * 104, by = 4 + Math.sin(f * 3.1) * 16 + R() * 10;
        c.save(); c.translate(bx, by); c.rotate((R() - 0.5) * 1.6);
        oval(c, 0, 4, 3.4, 7 + R() * 4); c.restore();
      }
    },
    tanne: function (c, x, R) {
      for (var i = 0; i < 6; i++) {
        var by = i * 9 - 4, w = 52 - i * 7;
        blob(c, [x - w, by + 10, x, by - 6, x + w, by + 10, x + w * 0.4, by + 7, x, by + 12, x - w * 0.4, by + 7]);
      }
    },
    ranken: function (c, x, R) {
      c.lineWidth = 1.6; c.strokeStyle = c.fillStyle;
      for (var k = 0; k < 3; k++) {
        var px = x - 16 + k * 14, len = 26 + R() * 34;
        c.beginPath(); c.moveTo(px, 0);
        for (var s = 1; s <= 6; s++) c.lineTo(px + Math.sin(s * 1.3 + k) * 4, len * s / 6);
        c.stroke();
        for (var b = 0; b < 5; b++) oval(c, px + Math.sin(b * 1.7 + k) * 5, len * (b + 1) / 6, 3, 1.8);
      }
    },
    reben: function (c, x, R) {
      OBEN.ranken(c, x, R);
      for (var t = 0; t < 2; t++) {
        var tx = x - 8 + t * 18, ty = 18 + R() * 10;
        for (var b = 0; b < 7; b++) kreis(c, tx + (b % 3 - 1) * 3.2, ty + Math.floor(b / 3) * 3.4, 2);
      }
    },
    kette: function (c, x, R) {
      var len = 26 + R() * 34;
      c.lineWidth = 1.5; c.strokeStyle = c.fillStyle;
      for (var y = 0; y < len; y += 6) { c.beginPath(); c.ellipse(x, y + 3, 2, 3.4, 0, 0, 6.283); c.stroke(); }
      if (R() < 0.5) { c.beginPath(); c.arc(x, len + 6, 5, 0.3, Math.PI * 2 - 0.3); c.stroke(); }
    },
    lampe_h: function (c, x, R, licht) {
      var len = 18 + R() * 22;
      rechteck(c, x - 0.6, 0, 1.2, len);
      blob(c, [x - 4, len, x + 4, len, x + 12, len + 10, x - 12, len + 10]);
      licht(x, len + 10, '#ffd8a0', 38);
    },
    roehre: function (c, x, R, licht) {
      rechteck(c, x - 26, 0, 1, 14); rechteck(c, x + 25, 0, 1, 14);
      rechteck(c, x - 30, 14, 60, 5);
      licht(x - 12, 19, '#f4fbff', 26); licht(x + 12, 19, '#f4fbff', 26);
    },
    sack: function (c, x) {
      rechteck(c, x - 0.8, 0, 1.6, 22);
      blob(c, [x - 9, 22, x + 9, 22, x + 10, 60, x + 6, 66, x - 6, 66, x - 10, 60]);
    },
    pfannen: function (c, x, R) {
      rechteck(c, x - 40, 8, 80, 3);
      for (var i = 0; i < 4; i++) {
        var px = x - 30 + i * 20, len = 8 + R() * 10;
        rechteck(c, px - 0.6, 11, 1.2, 4); rechteck(c, px - 1.5, 15, 3, len);
        if (i % 2) kreis(c, px, 15 + len + 7, 8); else oval(c, px, 15 + len + 4, 4, 5);
      }
    },
    schild_h: function (c, x, R) {
      rechteck(c, x - 18, 0, 1, 20); rechteck(c, x + 17, 0, 1, 20);
      rechteck(c, x - 24, 20, 48, 16);
    },
    kabel: function (c, x, R) {
      c.lineWidth = 1.2; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(x - 140, 4); c.quadraticCurveTo(x, 34 + R() * 10, x + 140, 6); c.stroke();
      c.beginPath(); c.moveTo(x - 140, 10); c.quadraticCurveTo(x, 42 + R() * 8, x + 140, 12); c.stroke();
      if (R() < 0.6) {
        // Ein Vogel auf der Leitung
        var vx = x - 30 + R() * 60, vy = 30;
        oval(c, vx, vy, 3.5, 2.6); kreis(c, vx + 3, vy - 2.5, 1.8);
      }
    },
    lichterkette: function (c, x, R, licht) {
      c.lineWidth = 1; c.strokeStyle = c.fillStyle;
      var cols = ['#ffd257', '#ff8a6a', '#8ae0ff', '#ffe9a8', '#c8ff8a'];
      c.beginPath(); c.moveTo(x - 90, 2); c.quadraticCurveTo(x, 40, x + 90, 2); c.stroke();
      for (var i = 1; i < 9; i++) {
        var f = i / 9, bx = x - 90 + f * 180, by = 2 + 4 * f * (1 - f) * 38;
        kreis(c, bx, by + 2.5, 1.8);
        licht(bx, by + 3, cols[(i + (R() * 5 | 0)) % cols.length], 9);
      }
    },
    markise: function (c, x, R) {
      blob(c, [x - 40, 0, x + 40, 0, x + 44, 18, x - 44, 18]);
      for (var i = 0; i < 9; i++) c.fillRect(x - 44 + i * 10, 18, 6, 4);
    },
    vorhang: function (c, x, R) {
      for (var i = 0; i < 5; i++) {
        var px = x - 20 + i * 9;
        blob(c, [px - 5, 0, px + 5, 0, px + 4 + Math.sin(i) * 2, 46 + R() * 10, px - 4, 44 + R() * 10]);
      }
      rechteck(c, x - 30, 0, 60, 4);
    },
    fahnen: function (c, x, R) {
      c.lineWidth = 1; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(x - 80, 0); c.quadraticCurveTo(x, 24, x + 80, 0); c.stroke();
      for (var i = 1; i < 10; i++) {
        var f = i / 10, bx = x - 80 + f * 160, by = 4 * f * (1 - f) * 24;
        blob(c, [bx - 5, by, bx + 5, by, bx, by + 10]);
      }
    },
    stacheldraht: function (c, x, R) {
      c.lineWidth = 1.2; c.strokeStyle = c.fillStyle;
      c.beginPath(); c.moveTo(x - 70, 8); c.lineTo(x + 70, 10); c.stroke();
      for (var i = 0; i < 14; i++) {
        var bx = x - 66 + i * 10;
        c.beginPath(); c.arc(bx, 9, 4, 0, 6.283); c.stroke();
        c.beginPath(); c.moveTo(bx - 3, 5); c.lineTo(bx + 3, 13); c.moveTo(bx + 3, 5); c.lineTo(bx - 3, 13); c.stroke();
      }
    },
    rohr: function (c, x) {
      rechteck(c, x - 80, 6, 160, 8);
      rechteck(c, x - 60, 4, 6, 12); rechteck(c, x + 10, 4, 6, 12);
      rechteck(c, x + 40, 14, 8, 30); rechteck(c, x + 37, 40, 14, 5);
    },
    gepaeckfach: function (c, x) {
      blob(c, [x - 70, 0, x + 70, 0, x + 70, 26, x + 60, 34, x - 60, 34, x - 70, 26]);
    }
  };

  var streifenCache = {};
  function streifen(theme, cfg) {
    if (streifenCache[theme]) return streifenCache[theme];
    var R = zufall(hash(theme) + 99), lichter = [];
    function baue(liste, dicht, hoehe, maler) {
      if (!liste || !liste.length) return null;
      var c = document.createElement('canvas');
      c.width = SW / 2; c.height = hoehe / 2;
      var x = c.getContext('2d');
      x.scale(0.5, 0.5);
      x.fillStyle = cfg.vcol || '#000000';
      var pos = 40, n = 0;
      while (pos < SW - 40) {
        var art = liste[(R() * liste.length) | 0], f = maler[art];
        if (f && R() < (dicht || 0.6)) {
          x.save();
          f(x, pos, R, function (lx, ly, col, r) { lichter.push({ x: lx, y: ly, col: col, r: r, oben: maler === OBEN }); });
          x.restore();
          x.fillStyle = cfg.vcol || '#000000';
          n++;
        }
        pos += maler === OBEN ? 150 + R() * 170 : 70 + R() * 110;
      }
      return n ? c : null;
    }
    var s = {
      unten: baue(cfg.unten, cfg.dicht, FH, UNTEN),
      oben: baue(cfg.oben, cfg.obenDicht, FT, OBEN),
      lichter: lichter
    };
    streifenCache[theme] = s;
    return s;
  }

  /* ---------- Nebelbaender ---------- */

  var nebelCache = {};
  function nebelBild(col) {
    if (nebelCache[col]) return nebelCache[col];
    var c = document.createElement('canvas');
    c.width = 256; c.height = 24;
    var x = c.getContext('2d'), R = zufall(hash(col));
    for (var i = 0; i < 26; i++) {
      var bx = R() * 256, by = 10 + R() * 8, r = 10 + R() * 18;
      for (var k = -1; k <= 1; k++) {
        var g = x.createRadialGradient(bx + k * 256, by, 0, bx + k * 256, by, r);
        g.addColorStop(0, L.rgba(col, 0.55)); g.addColorStop(1, L.rgba(col, 0));
        x.fillStyle = g;
        x.fillRect(bx + k * 256 - r, by - r, r * 2, r * 2);
      }
    }
    nebelCache[col] = c;
    return c;
  }

  /* ---------- Ablauf ---------- */

  /** Teilchen zur aktuellen Welt passend halten und weiterbewegen. */
  function vorbereiten(G, theme, camX, camY, W, H) {
    var cfg = welt(theme);
    Z.G = G;
    if (Z.theme !== theme || Z.W !== W || Z.H !== H) {
      Z.theme = theme; Z.W = W; Z.H = H; Z.camX = camX; Z.camY = camY; Z.t = G.tick;
      Z.R = zufall(hash(theme));
      teilchenAufbauen(cfg, W, H);
    }
    var schritte = Math.max(0, Math.min(4, G.tick - Z.t));
    if (G.state === 'paused' || G.state === 'optionen') schritte = 0;
    var dx = camX - Z.camX, dy = camY - Z.camY;
    // Grosser Sprung der Kamera (neues Level, Wiedereinstieg): nicht mitschieben
    if (Math.abs(dx) > W || Math.abs(dy) > H) { dx = 0; dy = 0; }
    for (var i = 0; i < schritte; i++) teilchenSchritt(W, H, i ? 0 : dx, i ? 0 : dy, G.tick - schritte + i + 1);
    if (!schritte && (dx || dy)) teilchenSchritt(W, H, dx, dy, G.tick);
    Z.t = G.tick; Z.camX = camX; Z.camY = camY;
    return cfg;
  }

  /** Nach dem Hintergrund, vor dem Spielfeld: Dunst, Nebel, Teilchen hinten. */
  function hinten(ctx, G, theme, camX, camY, W, H) {
    if (!L) return;
    var cfg = vorbereiten(G, theme, camX, camY, W, H);
    // Luftperspektive: der ganze Hintergrund ruckt nach hinten
    if (cfg.dunst && cfg.dunstA) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, L.rgba(cfg.dunst, cfg.dunstA * 0.4));
      g.addColorStop(0.55, L.rgba(cfg.dunst, cfg.dunstA));
      g.addColorStop(1, L.rgba(cfg.dunst, cfg.dunstA * 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // Nebelbaender am Boden, zwei Tiefen, ziehen langsam
    if (cfg.boden && cfg.bodenA && L.stufe() >= 1) {
      var nb = nebelBild(cfg.boden), sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      for (var k = 0; k < 2; k++) {
        var bw = 640, bh = 70 + k * 30, by = H - bh - 6 + k * 18;
        var off = ((camX * (0.55 + k * 0.2) + G.tick * (0.12 + k * 0.1)) % bw + bw) % bw;
        ctx.globalAlpha = cfg.bodenA * (k ? 0.8 : 1.1);
        for (var x = -off; x < W; x += bw) ctx.drawImage(nb, x, by, bw, bh);
      }
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = sm;
    }
    teilchenZeichnen(ctx, 0, G.tick);
  }

  /** Lichter auf dem Spielfeld: Yusuf in dunklen Welten, Honig, Goldhonig,
      Sofas (Checkpoints), gluehende Geschosse. */
  var GLUEHT = { glut: '#ff8a2a', bb: '#c8ff6a', bbE: '#ff4a32', blitz: '#8ae0ff', safran: '#ffcf4a',
                 kippe: '#ff8a2a', feuer: '#ff8a2a', joint: '#ff8a2a', funke: '#ffd257' };
  function spielfeldLicht(ctx, G, cfg, camX, camY, W, H) {
    var i, p = G.player;
    if (cfg.licht && p && !p.dead) {
      L.glow(ctx, p.cx() - camX, p.y + p.h / 2 - camY, cfg.licht.r, cfg.licht.col, cfg.licht.a);
    }
    for (i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      var ix = it.x - camX + it.w / 2, iy = it.y - camY + it.h / 2;
      if (ix < -40 || ix > W + 40 || iy < -40 || iy > H + 40) continue;
      if (it.t === 'goldhonig') L.glow(ctx, ix, iy, 34 + Math.sin(G.tick * 0.08) * 4, '#ffe38a', 0.4);
      else if (it.t === 'honig' || it.t === 'gold') L.glow(ctx, ix, iy, 13, '#ffb43c', 0.22);
    }
    if (G.lvl && G.lvl.checkpoints && G.checkpointsHit) {
      for (i = 0; i < G.lvl.checkpoints.length; i++) {
        if (!G.checkpointsHit[i]) continue;
        var cx = G.lvl.checkpoints[i][0] * 16 - camX + 14, cy = G.lvl.checkpoints[i][1] * 16 - camY - 6;
        if (cx > -60 && cx < W + 60) L.glow(ctx, cx, cy, 40, '#ffc23c', 0.16);
      }
    }
    for (i = 0; i < G.projectiles.length; i++) {
      var pr = G.projectiles[i], col = GLUEHT[pr.t];
      if (!col || pr.dead) continue;
      if (pr.t === 'blitz' && pr.life > pr.aktiv) continue;      // erst die Warnung, dann das Licht
      var px = pr.x - camX + pr.w / 2, py = pr.y - camY + pr.h / 2;
      if (px < -30 || px > W + 30) continue;
      L.glow(ctx, px, py, pr.t === 'blitz' ? 40 : 14, col, pr.t === 'bb' || pr.t === 'bbE' ? 0.35 : 0.3);
    }
  }

  /** Vor dem Spielfeld: Licht, Strahlen, Teilchen, Silhouetten. */
  function vorne(ctx, G, theme, camX, camY, W, H, opt) {
    if (!L) return;
    opt = opt || {};
    var cfg = welt(theme), st = L.stufe();
    if (!opt.ohneSpielfeld) spielfeldLicht(ctx, G, cfg, camX, camY, W, H);
    if (!opt.ohneSpielfeld) einschlaegeZeichnen(ctx, G, camX, camY);
    // Lichtstrahlen (wandern ein wenig mit, als waeren sie zwischen Welt und Kamera)
    if (cfg.strahlen) {
      var s = cfg.strahlen;
      L.strahlen(ctx, W, H, { n: s.n, col: s.col, a: s.a * (st === 0 ? 0.8 : 1), winkel: s.winkel, breite: s.breite,
                              x0: camX * 0.3 + G.tick * 0.04, abstand: (W + 120) / s.n, t: G.tick, laenge: 0.95 });
    }
    teilchenZeichnen(ctx, 1, G.tick);
    if (!opt.ohneSilhouetten) silhouetten(ctx, G, theme, cfg, camX, camY, W, H, opt);
    teilchenZeichnen(ctx, 2, G.tick);
  }

  function silhouetten(ctx, G, theme, cfg, camX, camY, W, H, opt) {
    var s = streifen(theme, cfg);
    if (!s.unten && !s.oben) return;
    var p = G.player;
    // Im Bosskampf zuruecknehmen: Bodenwellen und Angriffe muessen lesbar bleiben
    var kampf = G.boss && !G.boss.dead && G.bossStarted;
    var aUnten = kampf ? 0.45 : 0.92, aOben = kampf ? 0.5 : 0.85;
    var par = 1.45, off = ((camX * par) % SW + SW) % SW;
    // Hoehe: unten am Bild (und weiter unten, wenn die Kamera hochfaehrt)
    var maxY = opt.maxY || 0, hoch = Math.max(0, maxY - camY);
    var yU = H - FH + 6 + Math.min(60, hoch * 0.45), yO = -10 - Math.min(40, hoch * 0.2);
    if (opt.untenY !== undefined) yU = opt.untenY;
    var tmp = L.stufe() >= 1 ? L.puffer('silhouetten', Math.ceil(W), Math.ceil(H)) : null;
    var tctx = tmp ? tmp.getContext('2d') : ctx;
    var smAlt = ctx.imageSmoothingEnabled;
    if (tmp) { tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, tmp.width, tmp.height); }
    tctx.imageSmoothingEnabled = true;
    var x;
    if (s.unten) {
      tctx.globalAlpha = aUnten;
      for (x = -off; x < W; x += SW) tctx.drawImage(s.unten, x, yU, SW, FH);
    }
    if (s.oben && !opt.ohneOben) {
      tctx.globalAlpha = aOben;
      for (x = -off; x < W; x += SW) tctx.drawImage(s.oben, x, yO, SW, FT);
    }
    tctx.globalAlpha = 1;
    // Wo Yusuf dahinter steht: durchsichtig
    if (tmp && p && !opt.ohneSpielfeld) {
      var px = p.cx() - camX, py = p.y + p.h / 2 - camY;
      tctx.globalCompositeOperation = 'destination-out';
      var g = tctx.createRadialGradient(px, py, 6, px, py, 46);
      g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      tctx.fillStyle = g;
      tctx.fillRect(px - 50, py - 50, 100, 100);
      tctx.globalCompositeOperation = 'source-over';
    }
    if (tmp) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, tmp.width, tmp.height);
    }
    ctx.imageSmoothingEnabled = smAlt;
    // Lampen in den Silhouetten leuchten (gross und weich: ganz nah an der Kamera)
    for (var i = 0; i < s.lichter.length; i++) {
      var li = s.lichter[i];
      var lx = ((li.x - off) % SW + SW) % SW, ly = (li.oben ? yO : yU) + li.y;
      for (var k = -1; k <= 1; k++) {
        var xx = lx + k * SW;
        if (xx < -li.r * 2 || xx > W + li.r * 2) continue;
        var fl = 0.85 + 0.15 * Math.sin(G.tick * 0.05 + i * 2.1);
        L.glow(ctx, xx, ly, li.r, li.col, (kampf ? 0.25 : 0.42) * fl);
        L.glow(ctx, xx, ly, li.r * 0.3, '#ffffff', 0.25 * fl, true);
      }
    }
  }

  /* ---------- Einschlaege ----------
     Treffer sollen sich anfuehlen wie bei Hollow Knight: ein Lichtblitz,
     ein Ring, der aufreisst, helle Streifen, die nach aussen schiessen.
       gegner    ein Gegner ist platt          (weiss-gold)
       boss      Treffer am Boss               (gross, orange)
       stampfer  der Bauch-Stampfer schlaegt auf (Druckwelle am Boden)
       aua       Yusuf wird getroffen          (rot, der Bildrand pulsiert) */
  var EINSCHLAG = {
    gegner: { max: 16, r: 26, n: 7, col: '#fff4c8', glow: '#ffd257' },
    boss: { max: 22, r: 46, n: 11, col: '#ffffff', glow: '#ff9a3a' },
    stampfer: { max: 20, r: 64, n: 0, col: '#fff0d0', glow: '#ffd8a0', flach: true },
    aua: { max: 18, r: 30, n: 6, col: '#ff5a5a', glow: '#ff2a2a' },
    sieg: { max: 84, r: 240, n: 16, col: '#fff4d0', glow: '#ffd257', kranz: true }
  };
  function einschlag(G, x, y, art) {
    if (!EINSCHLAG[art]) return;
    if (!Z.schlaege) Z.schlaege = [];
    if (Z.schlaege.length > 24) Z.schlaege.shift();
    Z.schlaege.push({ x: x, y: y, art: art, t: 0, tick: G.tick, dreh: Math.random() * 6.283 });
    if (art === 'aua') Z.schmerzBis = G.tick + 24;
  }
  function einschlaegeZeichnen(ctx, G, camX, camY) {
    var l = Z.schlaege;
    if (!l || !l.length) return;
    var paus = G.state === 'paused' || G.state === 'optionen';
    for (var i = l.length - 1; i >= 0; i--) {
      var e = l[i], d = EINSCHLAG[e.art];
      if (!paus) { e.t += Math.max(0, Math.min(4, G.tick - e.tick)); e.tick = G.tick; }
      if (e.t > d.max) { l.splice(i, 1); continue; }
      var k = e.t / d.max, x = e.x - camX, y = e.y - camY, rr = d.r * (0.25 + 0.75 * Math.sqrt(k)), a = 1 - k;
      if (d.kranz) {
        // Boss besiegt: ein Kranz aus Lichtstrahlen dreht sich auf, wie bei Hollow Knight
        var op = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        for (var kr = 0; kr < d.n; kr++) {
          var wk = e.dreh + kr / d.n * 6.283 + e.t * 0.012, len = d.r * (0.4 + 0.6 * Math.min(1, k * 3)) * (kr % 2 ? 0.75 : 1);
          var br = 0.07 + (kr % 3) * 0.02;
          var g = ctx.createRadialGradient(x, y, 4, x, y, len);
          g.addColorStop(0, L.rgba(d.glow, 0.5 * a)); g.addColorStop(1, L.rgba(d.glow, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(wk - br) * len, y + Math.sin(wk - br) * len);
          ctx.lineTo(x + Math.cos(wk + br) * len, y + Math.sin(wk + br) * len);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = op;
        L.glow(ctx, x, y, 90 * (1 - k * 0.5), '#ffffff', 0.5 * a);
      }
      if (L.stufe() >= 1 && k < 0.5) L.glow(ctx, x, y, d.r * 1.6, d.glow, 0.55 * (1 - k * 2));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = d.col;
      ctx.lineWidth = Math.max(0.6, 2.4 * (1 - k));
      ctx.beginPath();
      if (d.flach) ctx.ellipse(x, y, rr, rr * 0.18, 0, 0, 6.283);
      else ctx.arc(x, y, rr, 0, 6.283);
      ctx.stroke();
      // Streifen, die nach aussen schiessen
      ctx.lineWidth = Math.max(0.5, 1.6 * (1 - k));
      ctx.beginPath();
      for (var s = 0; s < d.n; s++) {
        var w = e.dreh + s / d.n * 6.283, r0 = rr * 0.55, r1 = rr * (1.15 + (s % 2) * 0.35);
        ctx.moveTo(x + Math.cos(w) * r0, y + Math.sin(w) * r0);
        ctx.lineTo(x + Math.cos(w) * r1, y + Math.sin(w) * r1);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Bloom vormerken: nach Hintergrund und Kacheln, bevor Figuren kommen.
      Dann strahlen Lampen, Neon und Fenster ueber — Yusufs Hemd nicht. */
  function bloomFangen(quelle, theme, W, H) {
    if (!L) return;
    var cfg = welt(theme);
    if (cfg.bloom) L.bloomFangen(quelle, W, H, cfg.schwelle || 2);
  }

  /** Zum Schluss: Bloom, Farbstimmung, Vignette. quelle = die Leinwand. */
  function nachher(ctx, theme, quelle, W, H, opt) {
    if (!L) return;
    opt = opt || {};
    var cfg = welt(theme);
    if (cfg.bloom) {
      var st = cfg.bloom * (opt.bloomFaktor || 1);
      if (L.bloomGefangen()) L.bloomZeichnen(ctx, W, H, st);
      else if (quelle) L.bloom(ctx, quelle, W, H, st, cfg.schwelle || 2);
    }
    if (cfg.ton) L.tonung(ctx, W, H, cfg.ton, cfg.tonA || 0.08);
    L.vignette(ctx, W, H, (cfg.vign || 0.4) * (opt.vignFaktor || 1));
    // Getroffen: der Rand pulsiert rot (in Spiel-Ticks, nicht in Bildern)
    var rest = Z.G ? (Z.schmerzBis || 0) - Z.G.tick : 0;
    if (rest > 0 && rest <= 24) L.vignette(ctx, W, H, rest / 24 * 0.85, '#ff1414');
  }

  global.Ebenen = {
    WELTEN: WELTEN, TEILCHEN: TEILCHEN,
    welt: welt, hinten: hinten, vorne: vorne, nachher: nachher, einschlag: einschlag, bloomFangen: bloomFangen,
    _streifen: streifen, _zustand: Z
  };

})(window);
