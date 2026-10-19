/* =====================================================================
   gelaende.js — Boeden, Waende und Plattformen.

   Frueher war jede Kachel dasselbe 16x16-Bild (oben eine Kante, darunter
   Ziegel), auch im Garten und im Wald. Jetzt wird das Gelaende als Ganzes
   gemalt, Pixel fuer Pixel:
     - Jede Welt hat ihre eigene Oberkante (Gras mit Halmen, Steinplatte,
       Bordstein, Holzdiele, Teppich, Sternenglas) und ihren eigenen
       Koerper (Erde mit Steinen, Ziegel, Quader, Fliesen, Dielen, Beton,
       Pflaster, Marmor, Sterne).
     - Die Muster laufen ueber die Kachelgrenzen weiter und wiederholen
       sich nicht: jeder Ziegel, jeder Stein ist etwas anders.
     - Kanten: oben ein Lichtsaum, die Kante steht seitlich ueber, Ecken
       sind rund, offene Seiten und Unterseiten liegen im Schatten, nach
       unten wird es dunkler. Unter Graskanten haengen Wurzeln und Moos.
     - Hinter dem Gelaende liegt ein weicher Schatten auf dem Hintergrund
       (vor allem unter Plattformen): das Spielfeld loest sich vom Bild.
   Die Pixel bleiben Spiel-Pixel (scharf), Licht und Schatten sind fein.

   Gemalt wird in Stuecken von 16 x 18 Kacheln in voller Render-Skala und
   zwischengespeichert — ein Bild kostet nur ein paar drawImage (weniger
   als die einzelnen Kacheln vorher). Aendert sich die Welt (Arena-Wand,
   Gitter, Bruecken, Riesenfaeuste), merkt sich World.fill die Stelle und
   die Stuecke dort werden neu gemalt.

     Gelaende.zeichnen(ctx, G, camX, camY, W, H)   das Gelaende des Levels
     Gelaende.vorne(ctx, G, camX, camY, W, H)      vor den Figuren: Grasbueschel, die
                                                   im Wind wehen und Figuren ausweichen,
                                                   und Regen, der auf dem Boden aufspritzt
     Gelaende.figurenSchatten(ctx, G, camX, camY)  Schatten unter den Figuren
     Gelaende.attrappe(ctx, G, v, x, y)            falsche Wand (strecke.js)
     Gelaende.streifen(ctx, theme, y, W, versatz)  Boden fuer Titel und Abspann
     Gelaende.tiefFarbe(theme)                     Farbe tief im Boden
   ===================================================================== */
(function (global) {
  'use strict';

  var T = 16;
  var CW = 16 * T, CH = 18 * T;        // ein Stueck: 16 x 18 Kacheln
  var RAND = 0;                         // gemalter Rand ums Stueck (jedes Pixel holt sich seine Nachbarn selbst)
  var SR = 32;                          // so weit reicht der Schatten ins Nachbarstueck
  var MAX_STUECKE = 10;                 // mehr bleibt nicht im Speicher (bei RS 3 je ~2,6 MB)

  /* ---------- Wie die Welten aussehen ----------
     kante    Oberkante: gras | platte | bordstein | holz | teppich | kristall
     koerper  darunter: erde | ziegel | quader | fliesen | dielen | beton | pflaster | marmor | sterne
     blumen   Farben fuer Blueten in den Halmen
     halm     wie hoch das Gras wird (1 = normal), kurz = Rasen
     moos     Moos in den Fugen, wurzeln = lange Wurzeln unter Plattformen
     glanz    polierter Boden (Glanzstreifen), nass = Pfuetzen auf der Kante (Regen)
     rand/tief eigene Schattenfarben (sonst aus der Fugenfarbe)
     licht    Staerke des Lichtsaums oben (sonst 0.14)
     schatten Staerke des Schattens auf dem Hintergrund (sonst 0.42) */
  var STIL = {
    zimmer: { kante: 'holz', koerper: 'ziegel' },
    garten: { kante: 'gras', koerper: 'erde', blumen: ['#ff6a8a', '#ffe14a', '#ffffff', '#b48aff'], schatten: 0.3 },
    gym: { kante: 'platte', koerper: 'quader', licht: 0.18 },
    kueche: { kante: 'platte', koerper: 'fliesen', glanz: true },
    festung: { kante: 'gras', koerper: 'quader', moos: true, halm: 0.6, licht: 0.2 },
    markt: { kante: 'platte', koerper: 'fliesen', glanz: true, schatten: 0.25, licht: 0.1 },
    strasse: { kante: 'bordstein', koerper: 'ziegel', licht: 0.22, nass: true },
    siedlung: { kante: 'bordstein', koerper: 'ziegel', schatten: 0.32 },
    siedlung_nacht: { kante: 'bordstein', koerper: 'ziegel', licht: 0.2 },
    berg: { kante: 'gras', koerper: 'erde', blumen: ['#ffe14a', '#ffffff', '#b48aff'], schatten: 0.3 },
    imbiss: { kante: 'platte', koerper: 'ziegel' },
    bar: { kante: 'teppich', koerper: 'quader', licht: 0.22 },
    taverne: { kante: 'holz', koerper: 'dielen', schatten: 0.3 },
    stadion: { kante: 'gras', koerper: 'beton', kurz: true, schatten: 0.3 },
    knast: { kante: 'platte', koerper: 'beton', licht: 0.16 },
    wald: { kante: 'gras', koerper: 'erde', blumen: ['#ff8a2a', '#ffffff', '#ffe14a'], wurzeln: true, schatten: 0.34 },
    flughafen: { kante: 'platte', koerper: 'quader', glanz: true, schatten: 0.3 },
    gate: { kante: 'teppich', koerper: 'beton', schatten: 0.3 },
    kabine: { kante: 'teppich', koerper: 'beton', schatten: 0.26 },
    istanbul: { kante: 'platte', koerper: 'pflaster', schatten: 0.3 },
    semih: { kante: 'platte', koerper: 'marmor', rand: '#0a080c', tief: '#06040a', licht: 0.2 },
    semih_erinnerung: { kante: 'holz', koerper: 'dielen' },
    semih_kosmos: { kante: 'kristall', koerper: 'sterne', rand: '#05030f', tief: '#05030f', licht: 0.3 },
    semih_riss: { kante: 'platte', koerper: 'marmor', rand: '#060204', tief: '#060204', licht: 0.2 },
    heimat: { kante: 'bordstein', koerper: 'ziegel', licht: 0.2 }
  };
  var STANDARD = { kante: 'platte', koerper: 'ziegel' };
  // Dicke der Oberkante in Pixeln und wie weit sie seitlich uebersteht
  var KANTEN = {
    gras: { h: 4, ueber: 1 }, platte: { h: 5, ueber: 1 }, bordstein: { h: 6, ueber: 1 },
    holz: { h: 4, ueber: 1 }, teppich: { h: 5, ueber: 0 }, kristall: { h: 3, ueber: 1 }
  };

  /* ---------- Zufall, der immer gleich ausfaellt ---------- */

  function h2(x, y) {
    var n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  /** Weiches Rauschen 0..1 */
  function rauschen(x, y) {
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h2(x0, y0), b = h2(x0 + 1, y0), c = h2(x0, y0 + 1), d = h2(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function mod(a, n) { return ((a % n) + n) % n; }

  /* ---------- Farben ---------- */

  function rgb(hex) {
    if (global.Licht) return global.Licht.rgb(hex);
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16) || 0, parseInt(h.substr(2, 2), 16) || 0, parseInt(h.substr(4, 2), 16) || 0];
  }
  function mischRGB(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mal(a, f) { return [a[0] * f, a[1] * f, a[2] * f]; }
  function css(c, a) {
    var s = Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
    return a === undefined ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + a + ')';
  }

  // Die Farbe, an der gerade gemalt wird (die Muster schreiben hier hinein)
  var cr = 0, cg = 0, cb = 0;
  function setz(c) { cr = c[0]; cg = c[1]; cb = c[2]; }
  function misch(c, t) { cr += (c[0] - cr) * t; cg += (c[1] - cg) * t; cb += (c[2] - cb) * t; }
  function licht(f) { cr *= f; cg *= f; cb *= f; }

  var palCache = {};
  function palette(theme) {
    var p = palCache[theme];
    if (p) return p;
    var SP = global.Sprites, t = (SP && (SP.THEMES[theme] || SP.THEMES.zimmer));
    var stil = STIL[theme] || STANDARD;
    var top = t ? t.top : ['#d8a06a', '#b07a45', '#8a5a33', '#4a2c17'];
    var fill = t ? t.fill : ['#a8763f', '#8a5a33', '#6b4526', '#3a2414'];
    p = {
      t0: rgb(top[0]), t1: rgb(top[1]), t2: rgb(top[2]), t3: rgb(top[3]),
      f0: rgb(fill[0]), f1: rgb(fill[1]), f2: rgb(fill[2]), f3: rgb(fill[3])
    };
    p.tief = stil.tief ? rgb(stil.tief) : mal(p.f3, 0.5);
    p.rand = stil.rand ? rgb(stil.rand) : mal(p.f3, 0.72);
    p.tiefA = 0.55;
    p.stein = mischRGB(p.f0, [176, 170, 160], 0.45);
    p.ader = p.t3;
    p.wurzel = mischRGB(p.f0, [214, 178, 128], 0.3);
    p.moos = p.t1;
    p.blumen = (stil.blumen || []).map(rgb);
    var EB = global.Ebenen, w = EB && EB.WELTEN ? EB.WELTEN[theme] : null;
    p.lichtCol = (w && w.licht && w.licht.col) || (w && w.strahlen && w.strahlen.col) || '#fff4e0';
    p.lichtA = stil.licht !== undefined ? stil.licht : 0.14;
    p.schattenCol = (w && w.vcol) || '#06040a';
    p.schattenA = stil.schatten !== undefined ? stil.schatten : 0.42;
    p.himmel = rgb(t ? t.sky[2] : '#43215a');
    p.lampe = rgb(p.lichtCol);
    p.regen = !!(w && w.teilchen && w.teilchen.indexOf('regen') >= 0);
    palCache[theme] = p;
    return p;
  }

  /* ---------- Muster fuer den Koerper ----------
     x, y = Weltpixel, sy = wie tief unter der Oberflaeche */
  var MUSTER = {
    ziegel: function (x, y, p) {
      var reihe = y >> 3, yy = y & 7, xs = x + ((reihe & 1) ? 8 : 0), sp = xs >> 4, xx = xs & 15;
      if (yy === 7 || xx === 15) { setz(p.f3); misch(p.f2, 0.35); return; }        // Fuge
      var v = h2(sp, reihe);
      setz(p.f1);
      if (v < 0.3) misch(p.f2, 0.45); else if (v > 0.75) misch(p.f0, 0.4);
      if (yy === 0) licht(1.12); else if (yy === 6) licht(0.86);
      if (xx === 0) licht(1.06);
      if (v > 0.9 && xx > 10 && yy < 3) misch(p.f2, 0.5);                         // abgeplatzte Ecke
      var k = h2(x, y);
      if (k < 0.05) licht(0.86); else if (k > 0.97) licht(1.1);
    },
    erde: function (x, y, p, sy, stil) {
      var n = rauschen(x / 7, y / 5);
      setz(p.f1);
      if (n > 0.62) misch(p.f2, (n - 0.62) * 1.6); else if (n < 0.3) misch(p.f0, (0.3 - n) * 1.2);
      // Wurzeln von oben
      if (stil.wurzeln && sy < 40) {
        var wb = Math.floor(x / 21), wl = 10 + h2(wb, 5) * 30;
        if (h2(wb, 77) < 0.45 && sy < wl) {
          // oben dicker, unten duenn; rechts davon ein Schattenpixel
          var wx = wb * 21 + 10 + Math.sin(sy * 0.32 + wb) * 2.4, ab = x + 0.5 - wx, hb = 0.5 + (1 - sy / wl) * 0.6;
          if (Math.abs(ab) < hb) { setz(p.wurzel); if (ab < -0.2) licht(1.12); return; }
          if (ab >= hb && ab < hb + 1) { setz(p.f2); licht(0.8); return; }
        }
      }
      // Steine: in manchen Zellen eines 10 x 8-Rasters liegt einer
      var gx = Math.floor(x / 10), gy = y >> 3;
      for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
          var zx = gx + i, zy = gy + j, v = h2(zx * 3 + 1, zy * 7 + 2);
          if (v > 0.3) continue;
          var mx = zx * 10 + 2 + h2(zx, zy + 9) * 6, my = zy * 8 + 1 + h2(zx + 5, zy) * 5;
          var rx = 1.5 + h2(zx + 2, zy + 3) * 2.2, ry = rx * (0.62 + v);
          var dx = (x + 0.5 - mx) / rx, dy = (y + 0.5 - my) / ry;
          if (dx * dx + dy * dy < 1) {
            setz(p.stein);
            misch(p.f1, 0.25 + v);
            if (dy < -0.3 && dx < 0.5) licht(1.2); else if (dy > 0.4) licht(0.78);
            return;
          }
          var dy2 = (y - 0.5 - my) / ry;
          if (dx * dx + dy2 * dy2 < 1) licht(0.82);                               // Schatten unter dem Stein
        }
      }
      var k = h2(x, y);
      if (k < 0.04) misch(p.f2, 0.6); else if (k > 0.975) misch(p.f0, 0.6);
    },
    quader: function (x, y, p, sy, stil) {
      var reihe = y >> 4, yy = y & 15, xs = x + ((reihe & 1) ? 16 : 0), sp = xs >> 5, xx = xs & 31;
      if (yy === 15 || xx === 31) {
        setz(p.f3);
        if (stil.moos && rauschen(x / 5, y / 4) > 0.58) misch(p.moos, 0.5);
        return;
      }
      var v = h2(sp, reihe);
      setz(p.f1);
      misch(v < 0.5 ? p.f2 : p.f0, Math.abs(v - 0.5) * 0.7);
      licht(0.94 + rauschen(x / 4, y / 4) * 0.12);
      if (yy === 0 || xx === 0) licht(1.16);
      else if (yy === 14 || xx === 30) licht(0.8);
      if (v < 0.22) {                                                             // Risse
        var t = yy - 2, rx = 6 + h2(sp, reihe + 3) * 18 + t * (v < 0.11 ? 0.6 : -0.6) + Math.sin(t * 1.3) * 0.8;
        if (t >= 0 && t < 10 && Math.abs(xx - rx) < 0.6) licht(0.7);
      }
      if (stil.moos && (yy < 2 || xx < 1) && rauschen(x / 6, y / 3) > 0.55) misch(p.moos, 0.55);
      if (stil.glanz && ((xx + yy) & 31) >= 10 && ((xx + yy) & 31) <= 11) licht(1.08);
      if (h2(x, y) < 0.035) licht(0.86);
    },
    fliesen: function (x, y, p, sy, stil) {
      var xx = x & 15, yy = y & 15;
      if (xx === 15 || yy === 15) { setz(p.f3); misch(p.f2, 0.45); return; }
      setz(p.f1);
      if (((x >> 4) + (y >> 4)) & 1) misch(p.f0, 0.3);
      licht(0.96 + h2(x >> 4, y >> 4) * 0.08);
      if (yy === 0 || xx === 0) licht(1.1); else if (yy === 14 || xx === 14) licht(0.86);
      if (stil.glanz && xx + yy >= 4 && xx + yy <= 5 && xx < 9) licht(1.14);
      if (h2(x, y) < 0.03) licht(0.92);
    },
    dielen: function (x, y, p) {
      var reihe = y >> 3, yy = y & 7, off = Math.floor(h2(reihe, 7) * 48), xs = x + off;
      var sp = Math.floor(xs / 48), xx = xs - sp * 48;
      if (yy === 7 || xx === 47) { setz(p.f3); return; }
      var v = h2(sp, reihe);
      setz(p.f1);
      misch(v < 0.5 ? p.f2 : p.f0, Math.abs(v - 0.5) * 0.8);
      if (Math.sin(xs * 0.21 + Math.sin(xs * 0.05 + reihe * 2.1) * 3 + yy * 1.3 + reihe) > 0.82) licht(0.84);
      if (yy === 0) licht(1.12); else if (yy === 6) licht(0.88);
      if ((xx === 2 || xx === 44) && yy === 3) { setz(p.f3); return; }            // Nagel
      if (v > 0.86) {                                                             // Astloch
        var ax = 12 + v * 20, d = (xx - ax) * (xx - ax) / 4 + (yy - 3.5) * (yy - 3.5);
        if (d < 1.3) licht(0.7);
      }
    },
    beton: function (x, y, p) {
      var xx = x & 31, yy = y & 31;
      if (xx === 31 || yy === 31) { setz(p.f2); misch(p.f3, 0.3); return; }
      setz(p.f1);
      var n = rauschen(x / 9, y / 13);
      misch(n > 0.5 ? p.f0 : p.f2, Math.abs(n - 0.5) * 0.5);
      var k = h2(x, y);
      if (k < 0.07) licht(0.9); else if (k > 0.95) licht(1.07);
      if ((xx === 7 || xx === 24) && (yy === 7 || yy === 24)) { setz(p.f3); return; } // Ankerloecher
      if ((xx === 7 || xx === 24) && (yy === 8 || yy === 25)) licht(1.12);
      if (yy === 0 || xx === 0) licht(1.06);
      if (rauschen(x / 5, y / 22) > 0.78) licht(0.92);                            // Wasserflecken
    },
    pflaster: function (x, y, p) {
      var reihe = Math.floor(y / 7), yy = y - reihe * 7, xs = x + ((reihe & 1) ? 5 : 0);
      var sp = Math.floor(xs / 10), xx = xs - sp * 10;
      if (xx === 9 || yy === 6 || ((xx === 0 || xx === 8) && (yy === 0 || yy === 5))) {
        setz(p.f3); misch(p.f2, 0.3); return;
      }
      var v = h2(sp, reihe);
      setz(p.f1);
      misch(v < 0.5 ? p.f2 : p.f0, Math.abs(v - 0.5) * 0.9);
      if (yy <= 1 && xx < 7) licht(1.15); else if (yy >= 4) licht(0.85);
      if (h2(x, y) < 0.05) licht(0.88);
    },
    marmor: function (x, y, p) {
      var reihe = y >> 4, yy = y & 15, xs = x + ((reihe & 1) ? 24 : 0), sp = Math.floor(xs / 48), xx = xs - sp * 48;
      if (yy === 15 || xx === 47) { setz(p.ader); misch(p.f3, 0.45); return; }    // goldene Fugen
      setz(p.f1);
      var n = rauschen(x / 12 + sp * 3, y / 12);
      misch(n > 0.5 ? p.f0 : p.f2, Math.abs(n - 0.5) * 0.8);
      var a = Math.abs(Math.sin(x * 0.06 + y * 0.1 + rauschen(x / 10, y / 10) * 5 + sp));
      if (a < 0.05) misch(p.ader, 0.7); else if (a < 0.12) misch(p.ader, 0.22);
      if (yy === 0) licht(1.14);
    },
    sterne: function (x, y, p) {
      setz(p.f1);
      var n = rauschen(x / 14, y / 10);
      misch(n > 0.5 ? p.f0 : p.f2, Math.abs(n - 0.5) * 1.1);
      var k = h2(x, y);
      if (k > 0.988) { setz(p.t3); return; }
      if (k > 0.97) misch(p.t0, 0.6);
      if ((x & 31) === 31 || (y & 15) === 15) misch(p.f3, 0.6);
    }
  };

  /* ---------- Oberkanten ---------- */

  /** Wie dick die Kante an dieser Stelle ist (Gras ist unregelmaessig). */
  function kantenHoehe(stil, x) {
    if (stil.kante !== 'gras') return (KANTEN[stil.kante] || KANTEN.platte).h;
    var hh = 3 + Math.round(rauschen(x / 6, 3.7) * 2);
    // Hier und da haengt ein Buendel herunter: zwei Pixel breit, unten schmaler
    var xp = x >> 1, v = h2(xp, 31);
    if (v > 0.9) hh += 2 + Math.round(h2(xp, 32) * 4) - (x & 1);
    return stil.kurz ? Math.max(3, hh - 1) : hh;
  }

  /** Farbe der Kante in Zeile r (0 = ganz oben) von hh. */
  function kantenFarbe(stil, x, r, hh, p) {
    var k = stil.kante;
    if (k === 'gras') {
      setz(r === 0 ? p.t0 : (r >= hh - 1 ? p.t2 : p.t1));
      if (r === 1 && h2(x, 3) < 0.4) misch(p.t0, 0.5);
      if (r > 0 && r < hh - 1 && h2(x, r + 40) < 0.14) misch(p.t2, 0.5);
      return;
    }
    if (k === 'platte' || k === 'bordstein') {
      var fl = k === 'platte' ? 32 : 24, xx = mod(x, fl);
      // Regen: Pfuetzen, in denen sich Himmel und Laternen spiegeln
      if (stil.nass && r <= 1 && rauschen(x / 13, 0.5) > 0.6) {
        setz(p.t2); misch(p.himmel, 0.5);
        if (r === 0 && h2(x, 9) > 0.72) misch(p.lampe, 0.55);
        return;
      }
      setz(r === 0 ? p.t0 : (r >= hh - 1 ? p.t3 : (r >= hh - 2 ? p.t2 : p.t1)));
      if (r > 0 && r < hh - 1) {
        if (xx === fl - 1) setz(p.t2);                                            // Fuge
        else if (xx === 0) licht(1.08);
        else if (h2(x, r * 13) < 0.06) licht(0.93);
      }
      return;
    }
    if (k === 'holz') {
      setz(r === 0 ? p.t0 : (r === hh - 1 ? p.t3 : p.t1));
      if (r > 0 && r < hh - 1 && Math.sin(x * 0.4 + r * 2 + Math.sin(x * 0.07) * 4) > 0.85) misch(p.t2, 0.6);
      if (mod(x, 32) === 3 && r === 1) setz(p.t3);                                // Nagel
      return;
    }
    if (k === 'teppich') {
      setz(p.t1);
      if (r === 0) setz(p.t0);
      else if (r === hh - 1) setz(mod(x, 2) ? p.t3 : p.t2);                        // Fransen
      else if (mod(x + r * 2, 8) === 0 || mod(x - r * 2, 8) === 0) misch(p.t0, 0.45);
      return;
    }
    // kristall
    setz(r === 0 ? p.t3 : (r === 1 ? p.t0 : p.t1));
  }

  /** Halme auf Graskanten (fest im Bild; die hohen Bueschel kommen aus halme()). */
  function halmHoehe(stil, x) {
    if (stil.kante !== 'gras') return 0;
    var v = h2(x, 11);
    if (stil.kurz) return v < 0.35 ? 0 : (v < 0.9 ? 1 : 2);
    if (rauschen(x / 9, 1.3) < 0.3) return v < 0.7 ? 0 : 1;                       // kahle Stellen
    var h = v < 0.42 ? 0 : (v < 0.74 ? 1 : (v < 0.9 ? 2 : 3 + Math.floor(h2(x, 12) * 3)));
    return Math.round(h * (stil.halm || 1));
  }

  /** Was unter Plattformen haengt: Wurzeln, Moos, Grasfransen. */
  function haengtHoehe(stil, x) {
    if (stil.kante !== 'gras') return 0;
    var v = h2(x, 21);
    if (v > 0.86) return 1 + Math.floor(h2(x, 22) * (stil.wurzeln ? 7 : 4));
    return v > 0.6 ? 1 : 0;
  }

  /* ---------- Ein Stueck Gelaende malen ----------
     welt: { w, h, solid(tx, ty), blockAt(tx, ty) }
     x0, y0, cw, ch: der Ausschnitt in Weltpixeln
     opt.geist(tx, ty)    zaehlt als Wand fuer die Kanten der Nachbarn, wird aber nicht gemalt
     opt.erzwingen(tx,ty) wird gemalt, auch wenn dort nichts ist (falsche Waende)
     opt.ohneSchatten     kein Schatten auf dem Hintergrund */
  function malen(welt, theme, x0, y0, cw, ch, rs, opt, ziel) {
    opt = opt || {};
    var stil = STIL[theme] || STANDARD, p = palette(theme), muster = MUSTER[stil.koerper] || MUSTER.ziegel;
    var kInfo = KANTEN[stil.kante] || KANTEN.platte, ueber = kInfo.ueber, kb = kInfo.h;
    var gras = stil.kante === 'gras';
    var bx = x0 - RAND, by = y0 - RAND, bw = cw + 2 * RAND, bh = ch + 2 * RAND;
    var WW = welt.w, HH = welt.h, geist = opt.geist, erzw = opt.erzwingen;

    function gelaende(tx, ty) {
      if (erzw && erzw(tx, ty)) return true;
      if (tx < 0 || tx >= WW || ty < 0 || ty >= HH) return false;
      return welt.solid(tx, ty) && !welt.blockAt(tx, ty);
    }
    function wand(tx, ty) {
      if (tx < 0 || tx >= WW) return true;             // Levelrand: keine Kante
      if (ty < 0) return false;
      if (ty >= HH) ty = HH - 1;                       // unten geht der Boden weiter
      if (geist && geist(tx, ty)) return true;
      return gelaende(tx, ty);
    }

    // Zellen im Ausschnitt und rundherum (SR): fuer die Nachbarn, den Schatten
    // und die Tiefe, damit beides ueber Stueckgrenzen gleich verlaeuft
    var EXT = 24;
    var zx0 = ((bx - SR) >> 4) - 1, zy0 = ((by - SR) >> 4) - 1;
    var zw = ((bx + bw + SR - 1) >> 4) + 2 - zx0, zh = ((by + bh + SR - 1) >> 4) + 2 - zy0;
    var terr = new Uint8Array(zw * zh), wd = new Uint8Array(zw * zh), tief = new Int8Array(zw * zh);
    var i, j, k, tx, ty;
    for (j = 0; j < zh; j++) {
      for (i = 0; i < zw; i++) {
        tx = zx0 + i; ty = zy0 + j; k = j * zw + i;
        terr[k] = gelaende(tx, ty) ? 1 : 0;
        wd[k] = wand(tx, ty) ? 1 : 0;
        if (terr[k]) {
          var d = 0;
          while (d < 6 && wand(tx, ty - d - 1)) d++;
          tief[k] = d;
        } else tief[k] = -1;
      }
    }
    // Kanten, Halme und Haengendes pro Spalte (2 Pixel Rand fuer den Ueberstand)
    var kh = new Uint8Array(bw + 4), hm = new Uint8Array(bw), hg = new Uint8Array(bw);
    for (i = 0; i < bw + 4; i++) kh[i] = kantenHoehe(stil, bx + i - 2);
    for (i = 0; i < bw; i++) { hm[i] = halmHoehe(stil, bx + i); hg[i] = haengtHoehe(stil, bx + i); }

    var lg = buf('gel_bild', bw, bh), lx = lg.getContext('2d');
    var img = lx.createImageData(bw, bh), data = img.data;
    var aus = opt.ausschnitt;
    var bwE = bw + 2 * EXT, tiefe = new Float32Array(bwE), GROSS = 1e4, xe, vor;
    for (var yy = 0; yy < bh; yy++) {
      var y = by + yy, py = y & 15;
      ty = y >> 4; j = ty - zy0;
      // Wie tief unter der Oberflaeche, seitlich geglaettet: neben einer
      // tiefer liegenden Oberflaeche ist es heller (aber nie ueber Luecken)
      vor = GROSS;
      for (xe = 0; xe < bwE; xe++) {
        k = j * zw + (((bx - EXT + xe) >> 4) - zx0);
        vor = terr[k] ? Math.min(tief[k] * 16 + py, vor + 1) : GROSS;
        tiefe[xe] = vor;
      }
      vor = GROSS;
      for (xe = bwE - 1; xe >= 0; xe--) {
        if (tiefe[xe] >= GROSS) { vor = GROSS; continue; }
        vor = Math.min(tiefe[xe], vor + 1);
        tiefe[xe] = vor;
      }
      for (var xx = 0; xx < bw; xx++) {
        var x = bx + xx, px = x & 15;
        if (aus && (x < aus.x || x >= aus.x + aus.w || y < aus.y || y >= aus.y + aus.h)) continue;
        tx = x >> 4; i = tx - zx0; k = j * zw + i;
        var ok = false;
        if (terr[k]) {
          var dd = tief[k], L = !wd[k - 1], R = !wd[k + 1], U = !wd[k + zw], O = dd === 0;
          ok = true;
          // runde Ecken
          if (U && py === 15 && ((L && px === 0) || (R && px === 15))) ok = false;
          else if (O && !ueber && py === 0 && ((L && px === 0) || (R && px === 15))) ok = false;
          else {
            var sy = dd * 16 + py, hh = O ? kh[xx + 2] : 0;
            if (sy < hh) {
              kantenFarbe(stil, x, sy, hh, p);
              if (!ueber) { if (L && px === 0) licht(0.8); else if (R && px === 15) licht(0.75); }
            } else {
              muster(x, y, p, sy, stil);
              var u = sy - hh;
              if (O && u < 3) licht(0.64 + u * 0.11);                             // Schatten unter der Kante
              var tt = (tiefe[xx + EXT] - kb) / 56;
              if (tt > 0) misch(p.tief, Math.min(1, tt) * p.tiefA);
              if (L) { if (px === 0) setz(p.rand); else if (px === 1) licht(1.1); }
              if (R) { if (px === 15) setz(p.rand); else if (px === 14) licht(0.78); else if (px === 13) licht(0.9); }
              if (U) { if (py === 15) setz(p.rand); else if (py === 14) licht(0.68); else if (py >= 12) licht(0.84); }
            }
          }
        } else if (!wd[k]) {
          // Halme stehen auf der Kante darunter
          if (gras && terr[k + zw] && tief[k + zw] === 0 && hm[xx] && py >= 16 - hm[xx]) {
            var hi = 15 - py, hoch = hm[xx];
            setz(hi === hoch - 1 ? p.t0 : p.t1);
            if (hi === 0) misch(p.t2, 0.4);
            if (hoch >= 3 && hi === hoch - 1 && p.blumen.length && h2(x, 77) < 0.3) setz(p.blumen[Math.floor(h2(x, 78) * p.blumen.length)]);
            ok = true;
          }
          // Die Kante steht seitlich ueber
          else if (ueber && px < ueber && terr[k - 1] && tief[k - 1] === 0) {
            var hl = Math.min(kb, kh[xx - px + 1]);
            if (py >= 1 && py < hl - 1) { kantenFarbe(stil, x, py, hl, p); licht(0.78); ok = true; }
          } else if (ueber && px > 15 - ueber && terr[k + 1] && tief[k + 1] === 0) {
            var hr = Math.min(kb, kh[xx + (16 - px) + 2]);
            if (py >= 1 && py < hr - 1) { kantenFarbe(stil, x, py, hr, p); licht(0.9); ok = true; }
          }
          // Unter Plattformen haengen Wurzeln und Moos
          else if (hg[xx] && terr[k - zw] && ty < HH && py < hg[xx]) {
            setz(stil.moos ? p.t2 : (py === 0 ? p.t2 : p.wurzel));
            if (py > 0 && !stil.moos) licht(1 - py * 0.05);
            ok = true;
          }
        }
        if (ok) {
          var o = (yy * bw + xx) * 4;
          data[o] = cr; data[o + 1] = cg; data[o + 2] = cb; data[o + 3] = 255;
        }
      }
    }
    lx.putImageData(img, 0, 0);

    // Zusammensetzen in Render-Skala
    var c = ziel || document.createElement('canvas');
    c.width = Math.max(1, cw * rs); c.height = Math.max(1, ch * rs);
    var x2 = c.getContext('2d');
    x2.setTransform(rs, 0, 0, rs, -RAND * rs, -RAND * rs);
    x2.clearRect(0, 0, bw, bh);
    if (!opt.ohneSchatten && p.schattenA > 0) {
      // Weicher Schatten hinter dem Gelaende: aus dem Kachelraster (mit Rand,
      // damit er an Stueckgrenzen nicht springt), klein gerechnet und wieder
      // gross gezogen — eng darunter und weit gestreut
      var mw = Math.ceil((bw + 2 * SR) / 4), mh = Math.ceil((bh + 2 * SR) / 4);
      var m = buf('gel_s1', mw, mh), mx = m.getContext('2d');
      mx.setTransform(1, 0, 0, 1, 0, 0);
      mx.globalCompositeOperation = 'source-over';
      mx.clearRect(0, 0, mw, mh);
      mx.fillStyle = p.schattenCol;
      for (j = 0; j < zh; j++) {
        for (i = 0; i < zw; i++) {
          if (!terr[j * zw + i]) continue;
          mx.fillRect(((zx0 + i) * T - bx + SR) / 4, ((zy0 + j) * T - by + SR) / 4, 4, 4);
        }
      }
      var w2 = Math.ceil(mw / 3), h2_ = Math.ceil(mh / 3), s2 = buf('gel_s2', w2, h2_), sx2 = s2.getContext('2d');
      sx2.globalCompositeOperation = 'copy';
      sx2.imageSmoothingEnabled = true;
      try { sx2.imageSmoothingQuality = 'high'; } catch (e) {}
      sx2.drawImage(m, 0, 0, w2, h2_);
      sx2.globalCompositeOperation = 'source-over';
      x2.imageSmoothingEnabled = true;
      x2.globalAlpha = p.schattenA * 0.7;
      x2.drawImage(s2, -SR, -SR + 5, mw * 4, mh * 4);
      x2.globalAlpha = p.schattenA;
      x2.drawImage(m, -SR, -SR + 2, mw * 4, mh * 4);
      x2.globalAlpha = 1;
    }
    x2.imageSmoothingEnabled = false;
    x2.drawImage(lg, 0, 0);

    // Lichtsaum: Oberflaechen fangen das Licht der Welt (fein, nicht in Pixeln)
    if (p.lichtA > 0) {
      x2.globalCompositeOperation = 'source-atop';
      for (j = 1; j < zh - 1; j++) {
        var start = -1;
        for (i = 1; i < zw; i++) {
          k = j * zw + i;
          var oben = i < zw - 1 && terr[k] && tief[k] === 0;
          if (oben && start < 0) start = i;
          if (!oben && start >= 0) {
            var ly = (zy0 + j) * T - by, lx0 = (zx0 + start) * T - bx - ueber, lx1 = (zx0 + i) * T - bx + ueber;
            var g = x2.createLinearGradient(0, ly, 0, ly + 9);
            g.addColorStop(0, css(rgb(p.lichtCol), p.lichtA));
            g.addColorStop(0.3, css(rgb(p.lichtCol), p.lichtA * 0.45));
            g.addColorStop(1, css(rgb(p.lichtCol), 0));
            x2.fillStyle = g;
            x2.fillRect(lx0, ly, lx1 - lx0, 9);
            start = -1;
          }
        }
      }
      x2.globalCompositeOperation = 'source-over';
    }
    x2.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  /* ---------- Zeichenflaechen ---------- */

  var puffer = {};
  function buf(name, w, h) {
    if (global.Licht) return global.Licht.puffer(name, w, h);
    var c = puffer[name] || (puffer[name] = document.createElement('canvas'));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }
  function rs() { return global.Licht ? global.Licht.rs() : 1; }

  /* ---------- Zwischenspeicher ---------- */

  function cacheVon(welt) {
    if (!welt.__gel) welt.__gel = { grid: null, theme: '', rs: 0, w: 0, h: 0, st: {}, n: 0, pool: [], uhr: 0 };
    return welt.__gel;
  }
  function weg(cache, key) {
    var s = cache.st[key];
    if (!s) return;
    delete cache.st[key];
    cache.n--;
    if (cache.pool.length < 2) cache.pool.push(s.c);
  }
  function allesWeg(cache) { for (var key in cache.st) weg(cache, key); }

  /** Passt der Speicher noch zur Welt? Sonst Stuecke wegwerfen. */
  function pruefen(cache, welt, theme, r) {
    if (cache.grid !== welt.grid || cache.theme !== theme || cache.rs !== r || cache.w !== welt.w || cache.h !== welt.h) {
      allesWeg(cache);
      cache.grid = welt.grid; cache.theme = theme; cache.rs = r; cache.w = welt.w; cache.h = welt.h;
      if (welt.geaendert) welt.geaendert.length = 0;
      return;
    }
    var g = welt.geaendert;
    if (!g || !g.length) return;
    // Eine Aenderung wirkt auf die Nachbarn (Kanten) und bis zu sechs Kacheln
    // tiefer (wie dunkel es unten wird)
    for (var n = 0; n < g.length; n += 4) {
      var ax = (g[n] - 1) * T - SR, ay = (g[n + 1] - 1) * T - SR;
      var ex = (g[n] + g[n + 2] + 1) * T + SR, ey = (g[n + 1] + g[n + 3] + 7) * T + SR;
      for (var key in cache.st) {
        var s = cache.st[key];
        if (s.x < ex && s.x + CW > ax && s.y < ey && s.y + CH > ay) weg(cache, key);
      }
    }
    g.length = 0;
  }

  /** Verstecke (falsche Waende) gelten fuer die Nachbarn als Wand. */
  function geisterVon(G) {
    var st = G && G.strecke;
    if (!st || !st.verstecke || !st.verstecke.length) return null;
    var vs = st.verstecke;
    return function (tx, ty) {
      var x = tx * T + 8, y = ty * T + 8;
      for (var i = 0; i < vs.length; i++) {
        var v = vs[i];
        if (x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h) return true;
      }
      return false;
    };
  }

  function stueck(cache, welt, theme, sx, sy, r, opt) {
    var key = sx + ',' + sy, s = cache.st[key];
    if (s) { s.uhr = ++cache.uhr; return s; }
    var x0 = sx * CW, y0 = sy * CH;
    var cw = Math.min(CW, welt.w * T - x0), ch = Math.min(CH, welt.h * T - y0);
    if (cw <= 0 || ch <= 0) return null;
    // Zu viele? Das am laengsten nicht gebrauchte geht.
    while (cache.n >= MAX_STUECKE) {
      var alt = null, au = Infinity;
      for (var k in cache.st) if (cache.st[k].uhr < au) { au = cache.st[k].uhr; alt = k; }
      if (!alt) break;
      weg(cache, alt);
    }
    var c = malen(welt, theme, x0, y0, cw, ch, r, opt, cache.pool.pop());
    s = { c: c, x: x0, y: y0, w: cw, h: ch, uhr: ++cache.uhr };
    cache.st[key] = s;
    cache.n++;
    cache.gebaut = (cache.gebaut || 0) + 1;
    return s;
  }

  function zeichnenWelt(ctx, welt, theme, camX, camY, W, H, opt) {
    var r = rs(), cache = cacheVon(welt);
    pruefen(cache, welt, theme, r);
    var sx0 = Math.max(0, Math.floor(camX / CW)), sx1 = Math.floor((camX + W - 1) / CW);
    var sy0 = Math.max(0, Math.floor(camY / CH)), sy1 = Math.floor((camY + H - 1) / CH);
    var sm = ctx.imageSmoothingEnabled, neu = cache.gebaut || 0;
    ctx.imageSmoothingEnabled = false;
    for (var sy = sy0; sy <= sy1; sy++) {
      for (var sx = sx0; sx <= sx1; sx++) {
        var s = stueck(cache, welt, theme, sx, sy, r, opt);
        if (s) ctx.drawImage(s.c, s.x - camX, s.y - camY, s.w, s.h);
      }
    }
    ctx.imageSmoothingEnabled = sm;
    // Vorausmalen: hoechstens ein Stueck pro Bild, und nur wenn gerade keins
    // gemalt werden musste — dann ruckelt es beim Laufen nicht
    if ((cache.gebaut || 0) === neu && opt && opt.voraus) {
      var vx = opt.voraus > 0 ? sx1 + 1 : sx0 - 1;
      if (vx >= 0 && vx * CW < welt.w * T) {
        for (var vy = sy0; vy <= sy1; vy++) if (!cache.st[vx + ',' + vy]) { stueck(cache, welt, theme, vx, vy, r, opt); break; }
      }
    }
  }

  /* ---------- Fuer game.js ---------- */

  var letzteCamX = 0;
  function zeichnen(ctx, G, camX, camY, W, H) {
    var welt = G.world, richtung = camX >= letzteCamX ? 1 : -1;
    letzteCamX = camX;
    zeichnenWelt(ctx, welt, welt.theme, camX, camY, W, H, { geist: geisterVon(G), voraus: richtung });
  }

  /** Falsche Wand: sieht genau aus wie das Gelaende drumherum. */
  function attrappe(ctx, G, v, x, y) {
    var welt = G.world, theme = welt.theme, r = rs();
    var b = v.__bild;
    if (!b || b.rs !== r || b.theme !== theme || b.grid !== welt.grid) {
      var drin = function (tx, ty) {
        var px = tx * T + 8, py = ty * T + 8;
        return px >= v.x && px < v.x + v.w && py >= v.y && py < v.y + v.h;
      };
      var geist = geisterVon(G);
      var c = malen(welt, theme, v.x - 2, v.y - 6, v.w + 4, v.h + 6, r,
                    { erzwingen: drin, geist: geist, ohneSchatten: true,
                      ausschnitt: { x: v.x - 2, y: v.y - 6, w: v.w + 4, h: v.h + 6 } });
      b = v.__bild = { c: c, rs: r, theme: theme, grid: welt.grid };
    }
    var sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(b.c, x - 2, y - 6, v.w + 4, v.h + 6);
    ctx.imageSmoothingEnabled = sm;
    return true;
  }

  /** Ein Stueck Boden (drei Kacheln hoch) fuer Titel und Abspann. */
  var deko = {};
  function streifen(ctx, theme, y, W, versatz) {
    var w = deko[theme];
    if (!w) {
      w = deko[theme] = { w: 96, h: 3, grid: {}, theme: theme,
                          solid: function (tx, ty) { return ty >= 0 && ty < 3; },
                          blockAt: function () { return null; } };
    }
    var vs = Math.max(0, Math.round(versatz || 0)) % (48 * T);
    zeichnenWelt(ctx, w, theme, vs, -y, W, 48 + y, { ohneSchatten: true });
  }

  var staubCache = {};
  /** Farbe fuer Staub beim Springen und Landen: auf Gras Halmstueckchen,
      sonst heller Staub von der Oberkante. */
  function staub(theme) {
    if (staubCache[theme]) return staubCache[theme];
    var stil = STIL[theme] || STANDARD, p = palette(theme);
    var c = stil.kante === 'gras' ? p.t0 : mischRGB(p.t0, [240, 232, 214], 0.45);
    return (staubCache[theme] = css(c));
  }

  var tiefCache = {};
  function tiefFarbe(theme) {
    if (tiefCache[theme]) return tiefCache[theme];
    var p = palette(theme);
    return (tiefCache[theme] = css(mischRGB(p.f1, p.tief, p.tiefA)));
  }

  /* ---------- Grasbueschel, die leben ----------
     Auf jeder Graskante stehen ein paar hohe Halme. Sie wiegen sich im
     Wind und biegen sich weg, wenn jemand hindurchlaeuft (wie bei Hollow
     Knight). Gezeichnet nach den Figuren: sie stehen vor den Fuessen. */
  var HALM_FARBE = {};
  function halme(ctx, G, camX, camY, W, H) {
    var welt = G.world, theme = welt.theme, stil = STIL[theme] || STANDARD;
    if (stil.kante !== 'gras' || stil.kurz) return;
    if (global.Licht && global.Licht.stufe() < 1) return;
    var p = palette(theme), r = rs(), t = G.tick;
    var hf = HALM_FARBE[theme] || (HALM_FARBE[theme] = [css(mal(p.t1, 0.82)), css(p.t1), css(p.t0)]);
    // Wer drueckt das Gras weg?
    var druck = [], i, e;
    function dazu(x, y, w) { druck.push(x, y, Math.max(8, w * 0.6)); }
    var pl = G.player;
    if (pl && !pl.dead) dazu(pl.x + pl.w / 2, pl.y + pl.h, pl.w);
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (!e.dead && e.x > camX - 40 && e.x < camX + W + 40) dazu(e.x + e.w / 2, e.y + e.h, e.w);
    }
    if (G.boss && !G.boss.dead && G.boss.w) dazu(G.boss.x + G.boss.w / 2, G.boss.y + G.boss.h, G.boss.w);

    var tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(welt.w - 1, Math.floor((camX + W) / T));
    var ty0 = Math.max(1, Math.floor(camY / T)), ty1 = Math.min(welt.h - 1, Math.floor((camY + H) / T) + 1);
    var pfade = [[], [], []];
    var hoch = stil.halm || 1;
    for (var tx = tx0; tx <= tx1; tx++) {
      for (var ty = ty0; ty <= ty1; ty++) {
        if (!welt.solid(tx, ty) || welt.blockAt(tx, ty) || welt.solid(tx, ty - 1)) continue;
        var v = h2(tx, ty * 7 + 3);
        if (v < 0.25) continue;                                  // nicht ueberall
        var n = 2 + Math.floor(v * 3), gy = ty * T;
        for (var b = 0; b < n; b++) {
          var bx = tx * T + 1 + Math.floor(h2(tx * 5 + b, ty) * 14);
          var bh = (4 + Math.floor(h2(bx, ty + 50) * 5)) * hoch;
          if (bh < 3) continue;
          // Wind: langsame Boeen, die ueber das Feld laufen
          var bieg = Math.sin(t * 0.035 + bx * 0.045) * 1.1 + Math.sin(t * 0.11 + bx * 0.6) * 0.35;
          for (var d = 0; d < druck.length; d += 3) {
            var dx = bx - druck[d], dy = gy - druck[d + 1];
            if (dy > -4 && dy < 10 && Math.abs(dx) < druck[d + 2]) {
              var f = 1 - Math.abs(dx) / druck[d + 2];
              bieg += (dx >= 0 ? 1 : -1) * f * 4.5;
              bh *= 1 - f * 0.35;                                // flachgedrueckt
            }
          }
          var sx = bx - camX, sy = gy - camY;
          if (sx < -8 || sx > W + 8) continue;
          var segs = Math.max(2, Math.round(bh));
          for (var s = 0; s < segs; s++) {
            var q = (s + 1) / segs, ox = bieg * q * q;
            var px = Math.round((sx + ox) * r) / r;
            pfade[s < segs * 0.4 ? 0 : (s < segs - 1 ? 1 : 2)].push(px, sy - s - 1);
          }
        }
      }
    }
    for (var c = 0; c < 3; c++) {
      var pf = pfade[c];
      if (!pf.length) continue;
      ctx.fillStyle = hf[c];
      ctx.beginPath();
      for (i = 0; i < pf.length; i += 2) ctx.rect(pf[i], pf[i + 1], 1, 1);
      ctx.fill();
    }
  }

  /* ---------- Regen spritzt auf ----------
     Wo es regnet, schlagen ueberall auf den Oberkanten Tropfen ein: erst eine
     kleine Krone, dann zwei Spritzer zur Seite. Die Stellen haengen an der
     Welt (Spalten von 32 Pixeln), nicht am Bildschirm. */
  function spritzer(ctx, G, camX, camY, W, H) {
    var welt = G.world, p = palette(welt.theme);
    if (!p.regen) return;
    if (global.Licht && global.Licht.stufe() < 1) return;
    var r = rs(), t = G.tick;
    var ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(welt.h - 1, Math.floor((camY + H) / T));
    var c0 = Math.floor(camX / 32), c1 = Math.floor((camX + W) / 32);
    ctx.fillStyle = 'rgba(206,216,255,0.6)';
    ctx.beginPath();
    for (var c = c0; c <= c1; c++) {
      for (var a = 0; a < 6; a++) {
        var tt = t - a;
        if (h2(c, tt) > 0.07) continue;
        var x = c * 32 + Math.floor(h2(c, tt + 7919) * 32), tx = Math.floor(x / T), gy = -1;
        for (var ty = ty0; ty <= ty1; ty++) {
          if (welt.solid(tx, ty) && !welt.blockAt(tx, ty) && !welt.solid(tx, ty - 1)) { gy = ty * T; break; }
        }
        if (gy < 0) continue;
        var sx = Math.round((x - camX) * r) / r, sy = gy - camY;
        if (a < 2) {
          ctx.rect(sx - 1, sy - 2 - a, 1, 1); ctx.rect(sx + 1, sy - 2 - a, 1, 1); ctx.rect(sx, sy - 1, 1, 1);
        } else {
          var d = a - 1, h = sy - 3 + (a - 2) * 0.8;
          ctx.rect(sx - 1 - d, h, 1, 1); ctx.rect(sx + 1 + d, h, 1, 1);
        }
      }
    }
    ctx.fill();
  }

  /** Alles, was vor den Figuren auf dem Boden passiert. */
  function vorne(ctx, G, camX, camY, W, H) {
    halme(ctx, G, camX, camY, W, H);
    spritzer(ctx, G, camX, camY, W, H);
  }

  /* ---------- Schatten unter Figuren ---------- */

  var schattenBild = null;
  function schattenBildHolen() {
    if (schattenBild) return schattenBild;
    var c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    var x = c.getContext('2d');
    x.translate(32, 16); x.scale(1, 0.5);
    var g = x.createRadialGradient(0, 0, 0, 0, 0, 32);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(-32, -32, 64, 64);
    return (schattenBild = c);
  }

  /** Wo unter (x, y) der Boden ist — oder null, wenn er weit weg ist. */
  function bodenUnter(welt, x, y) {
    var tx = Math.floor(x / T), ty = Math.floor(y / T), boden = null;
    for (var n = 0; n < 5 && ty < welt.h; n++, ty++) {
      if (ty >= 0 && welt.solid(tx, ty) && ty * T >= y - 3) { boden = ty * T; break; }
    }
    var ms = welt.movers || [];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (x >= m.x && x <= m.x + m.w && m.y >= y - 3 && (boden === null || m.y < boden)) boden = m.y;
    }
    return boden;
  }

  function schatten(ctx, welt, x, y, breite, camX, camY, staerke) {
    var b = bodenUnter(welt, x, y);
    if (b === null) return;
    var hoehe = Math.max(0, b - y), a = (staerke || 0.4) * (1 - hoehe / 64);
    if (a <= 0.02) return;
    var rx = breite * 0.62 + hoehe * 0.06, ry = 2.4 + hoehe * 0.025;
    var ga = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
    ctx.globalAlpha = ga * a;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(schattenBildHolen(), x - camX - rx, b - camY - ry * 0.55, rx * 2, ry * 2);
    ctx.globalAlpha = ga;
    ctx.imageSmoothingEnabled = sm;
  }

  function figurenSchatten(ctx, G, camX, camY, W) {
    var welt = G.world, i, e;
    W = W || 512;
    var pl = G.player;
    if (pl && !pl.dead && !G.lvl.bike) schatten(ctx, welt, pl.x + pl.w / 2, pl.y + pl.h, pl.w + 4, camX, camY, 0.45);
    for (i = 0; i < G.enemies.length; i++) {
      e = G.enemies[i];
      if (e.dead || e.x + e.w < camX - 20 || e.x > camX + W + 20) continue;
      schatten(ctx, welt, e.x + e.w / 2, e.y + e.h, e.w, camX, camY, 0.38);
    }
    var bo = G.boss;
    if (bo && !bo.dead && bo.w && bo.h) schatten(ctx, welt, bo.x + bo.w / 2, bo.y + bo.h, bo.w, camX, camY, 0.45);
  }

  global.Gelaende = {
    STIL: STIL, zeichnen: zeichnen, vorne: vorne, halme: halme, spritzer: spritzer,
    figurenSchatten: figurenSchatten, attrappe: attrappe,
    streifen: streifen, tiefFarbe: tiefFarbe, staub: staub,
    _malen: malen, _cache: cacheVon, STUECK: { w: CW, h: CH }
  };

})(window);
