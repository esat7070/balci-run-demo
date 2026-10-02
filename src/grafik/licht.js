/* =====================================================================
   licht.js — HD-Licht fuer die Pixelwelt.

   Das Spiel denkt weiter in 512 x 288 Bildpunkten. Gezeichnet wird aber
   in zwei- bis dreifacher Aufloesung (RS, "Render-Skala"): Figuren und
   Kacheln bleiben scharfe Pixel, Licht, Nebel, Partikel, Drehungen und
   die 3D-Strasse werden weich und fein — wie bei modernen Pixel-Spielen.

     Licht.rs()                  wie viel feiner gezeichnet wird (1..3)
     Licht.stufe()               2 = volle Effekte, 1 = ohne Bloom, 0 = sparsam
     Licht.glow(ctx, ...)        Lichtschein (addiert sich), aus fertigen Verlaufsbildern
     Licht.kegel(ctx, ...)       Lichtkegel (Laterne, Scheinwerfer, Flutlicht)
     Licht.strahlen(ctx, ...)    Lichtstrahlen schraeg von oben (Fenster, Baumkronen)
     Licht.bloom(ctx, ...)       helles Licht strahlt ueber (Nachbearbeitung)
     Licht.vignette(ctx, ...)    dunkle Raender
     Licht.tonung(ctx, ...)      Farbstimmung
     Licht.zoomUnschaerfe(...)   Tempo: das Bild verwischt zur Mitte hin
     Licht.puffer(name, w, h)    wiederverwendbare Zeichenflaechen

   Die Einstellung GRAFIK (optionen.js): AUTOMATISCH faengt mit allem an
   und schaltet herunter, wenn der Rechner nicht hinterherkommt. HOCH
   bleibt immer voll, SPARSAM zeichnet in einfacher Aufloesung.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- Zeichenflaechen ---------- */

  var puffer = {};
  function buf(name, w, h) {
    var c = puffer[name];
    if (!c) { c = document.createElement('canvas'); puffer[name] = c; }
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  /* ---------- Farben ---------- */

  var rgbCache = {};
  /** '#rrggbb' oder '#rgb' -> [r, g, b] */
  function rgb(hex) {
    var v = rgbCache[hex];
    if (v) return v;
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    v = [parseInt(h.substr(0, 2), 16) || 0, parseInt(h.substr(2, 2), 16) || 0, parseInt(h.substr(4, 2), 16) || 0];
    rgbCache[hex] = v;
    return v;
  }
  function rgba(hex, a) { var v = rgb(hex); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }

  var mischCache = {};
  /** Zwei Farben mischen (t = 0 -> a, 1 -> b), in 32 Stufen zwischengespeichert. */
  function misch(a, b, t) {
    var q = Math.max(0, Math.min(32, Math.round(t * 32)));
    if (q === 0) return a;
    var k = a + b + q, m = mischCache[k];
    if (m) return m;
    var x = rgb(a), y = rgb(b), f = q / 32;
    m = 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * f) + ',' + Math.round(x[1] + (y[1] - x[1]) * f) + ',' +
        Math.round(x[2] + (y[2] - x[2]) * f) + ')';
    mischCache[k] = m;
    return m;
  }

  /* ---------- Qualitaet ---------- */

  // 2 = alles, 1 = ohne Bloom und Tiefenunschaerfe, 0 = sparsam (einfache Aufloesung)
  var autoStufe = 2;
  var RS = 1;

  function einstellung() {
    var O = global.Optionen;
    return (O && O.grafik) ? O.grafik() : 'auto';
  }
  function stufe() {
    var e = einstellung();
    if (e === 'sparsam') return 0;
    if (e === 'hoch') return 2;
    return autoStufe;
  }

  /** Welche Render-Skala zu diesem Bildschirm passt: so fein, wie das Bild
      wirklich angezeigt wird (CSS-Groesse mal Pixeldichte), hoechstens 3
      (am Handy 2), bei SPARSAM immer 1. */
  function rsFuer(cssSkala, dpr, W, H, touch) {
    // Nur fuer Bildschirmfotos (tests/screenshots.html): fest vorgegeben
    if (global.BALCI_RS_FEST) return global.BALCI_RS_FEST;
    var st = stufe();
    if (st === 0) return 1;
    var max = (st === 1 || touch) ? 2 : 3;
    var r = Math.round((cssSkala || 1) * (dpr || 1));
    // Nie mehr als etwa 2,3 Millionen Bildpunkte
    while (r > 1 && W * r * H * r > 2300000) r--;
    return Math.max(1, Math.min(max, r));
  }

  /* Wenn der Rechner nicht hinterherkommt: herunterschalten (nur bei
     AUTOMATISCH, nie wieder hoch in derselben Sitzung — sonst pendelt es).
     Gemessen werden nur echte, sichtbare Bilder: lange Haenger (Tab-Wechsel,
     Laden) zaehlen nicht. */
  var mess = { n: 0, langsam: 0, ruhe: 0 };
  function messen(dt) {
    if (einstellung() !== 'auto' || autoStufe === 0) return false;
    if (document.hidden || dt > 250 || dt <= 0) return false;
    if (mess.ruhe > 0) { mess.ruhe--; return false; }
    mess.n++;
    if (dt > 24) mess.langsam++;
    if (mess.n < 180) return false;
    var zuLangsam = mess.langsam > mess.n * 0.5;
    mess.n = 0; mess.langsam = 0;
    if (!zuLangsam) return false;
    autoStufe--;
    mess.ruhe = 240;                       // nach dem Umschalten erst einmal ankommen lassen
    return true;
  }

  /* ---------- Lichtschein ---------- */

  var glowCache = {};
  function glowBild(col, hart) {
    var key = col + (hart ? 'h' : '');
    var c = glowCache[key];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (hart) {
      g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.35, rgba(col, 0.8));
      g.addColorStop(0.6, rgba(col, 0.25)); g.addColorStop(1, rgba(col, 0));
    } else {
      g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.18, rgba(col, 0.55));
      g.addColorStop(0.42, rgba(col, 0.2)); g.addColorStop(0.7, rgba(col, 0.06)); g.addColorStop(1, rgba(col, 0));
    }
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glowCache[key] = c;
    return c;
  }

  /** Runder Lichtschein bei (x, y) mit Radius r. Addiert sich zum Bild
      (wie echtes Licht). a = Staerke 0..1, haengt am aktuellen globalAlpha. */
  function glow(ctx, x, y, r, col, a, hart) {
    if (!(r > 0.5) || !(a > 0.004)) return;
    var op = ctx.globalCompositeOperation, ga = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ga * Math.min(1, a);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(glowBild(col, hart), x - r, y - r, r * 2, r * 2);
    ctx.imageSmoothingEnabled = sm;
    ctx.globalAlpha = ga;
    ctx.globalCompositeOperation = op;
  }
  /** Wie glow, aber gestaucht (Lichtpfuetze auf dem Boden, Scheinwerfer). */
  function glowOval(ctx, x, y, rx, ry, col, a) {
    if (!(rx > 0.5) || !(ry > 0.3) || !(a > 0.004)) return;
    var op = ctx.globalCompositeOperation, ga = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ga * Math.min(1, a);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(glowBild(col), x - rx, y - ry, rx * 2, ry * 2);
    ctx.imageSmoothingEnabled = sm;
    ctx.globalAlpha = ga;
    ctx.globalCompositeOperation = op;
  }

  /** Lichtkegel von (x1, y1) (Breite w1) nach (x2, y2) (Breite w2):
      oben hell, unten verlaufend. Fuer Laternen, Scheinwerfer, Flutlicht. */
  function kegel(ctx, x1, y1, w1, x2, y2, w2, col, a) {
    if (!(a > 0.004)) return;
    var g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, rgba(col, Math.min(1, a)));
    g.addColorStop(0.55, rgba(col, Math.min(1, a) * 0.35));
    g.addColorStop(1, rgba(col, 0));
    var op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x1 - w1 / 2, y1); ctx.lineTo(x1 + w1 / 2, y1);
    ctx.lineTo(x2 + w2 / 2, y2); ctx.lineTo(x2 - w2 / 2, y2);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = op;
  }

  /** Lichtstrahlen schraeg von oben, die langsam atmen.
      o: { n, col, a, winkel (Neigung), breite, x0 (Versatz, fuer Parallaxe),
           abstand, t (Zeit), laenge (Anteil der Bildhoehe) } */
  function strahlen(ctx, W, H, o) {
    var n = o.n || 3, a = o.a || 0.08, wk = o.winkel || 0.3, br = o.breite || 40;
    var ab = o.abstand || (W / n), len = H * (o.laenge || 1);
    var op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    var span = ab * n;
    for (var i = 0; i < n + 1; i++) {
      var x = ((i * ab - (o.x0 || 0)) % span + span) % span - ab * 0.5;
      var puls = 0.65 + 0.35 * Math.sin((o.t || 0) * 0.013 + i * 1.7);
      var aa = a * puls * (0.7 + 0.3 * ((i * 7) % 3) / 2);
      var g = ctx.createLinearGradient(0, o.y0 || 0, 0, (o.y0 || 0) + len);
      g.addColorStop(0, rgba(o.col, aa));
      g.addColorStop(0.5, rgba(o.col, aa * 0.45));
      g.addColorStop(1, rgba(o.col, 0));
      ctx.fillStyle = g;
      var b = br * (0.6 + ((i * 13) % 5) / 6), dx = len * wk, y0 = o.y0 || 0;
      ctx.beginPath();
      ctx.moveTo(x, y0); ctx.lineTo(x + b, y0);
      ctx.lineTo(x + b * 1.7 + dx, y0 + len); ctx.lineTo(x - b * 0.4 + dx, y0 + len);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = op;
  }

  /* ---------- Nachbearbeitung ---------- */

  /** Bloom: die hellsten Stellen des Bildes leuchten weich ueber.
      quelle = die Leinwand selbst. staerke 0..1, schwelle = wie viele Male
      das Bild mit sich selbst multipliziert wird (mehr = nur das Hellste). */
  function bloom(ctx, quelle, W, H, staerke, schwelle) {
    if (!(staerke > 0) || stufe() < 2) return;
    if (!bloomFangen(quelle, W, H, schwelle)) return;
    bloomZeichnen(ctx, W, H, staerke);
  }

  /** Bloom in zwei Schritten: erst die hellen Stellen einfangen (zum
      Beispiel nachdem Hintergrund und Lampen gezeichnet sind, aber bevor
      Figuren dazukommen — sonst leuchtet Yusufs weisses Hemd wie eine
      Lampe), am Ende ueber das fertige Bild legen. */
  var gefangen = false;
  function bloomFangen(quelle, W, H, schwelle) {
    gefangen = false;
    if (stufe() < 2) return false;
    var w1 = Math.ceil(W / 4), h1 = Math.ceil(H / 4);
    var b1 = buf('bloom1', w1, h1), x1 = b1.getContext('2d');
    x1.globalCompositeOperation = 'copy';
    x1.globalAlpha = 1;
    x1.imageSmoothingEnabled = true;
    try { x1.imageSmoothingQuality = 'high'; } catch (e) {}
    x1.drawImage(quelle, 0, 0, w1, h1);
    // Schwelle: x*x*x*x — dunkles verschwindet, nur Helles bleibt
    x1.globalCompositeOperation = 'multiply';
    for (var i = 0; i < (schwelle || 2); i++) x1.drawImage(b1, 0, 0);
    x1.globalCompositeOperation = 'source-over';
    var w2 = Math.ceil(w1 / 3), h2 = Math.ceil(h1 / 3);
    var b2 = buf('bloom2', w2, h2), x2 = b2.getContext('2d');
    x2.globalCompositeOperation = 'copy';
    x2.imageSmoothingEnabled = true;
    x2.drawImage(b1, 0, 0, w2, h2);
    x2.globalCompositeOperation = 'source-over';
    gefangen = true;
    return true;
  }
  function bloomZeichnen(ctx, W, H, staerke) {
    if (!gefangen || !(staerke > 0)) return;
    gefangen = false;
    var b1 = puffer.bloom1, b2 = puffer.bloom2;
    if (!b1 || !b2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = Math.min(1, staerke * 0.55);
    ctx.drawImage(b1, 0, 0, W, H);
    ctx.globalAlpha = Math.min(1, staerke);
    ctx.drawImage(b2, -W * 0.02, -H * 0.02, W * 1.04, H * 1.04);
    ctx.restore();
  }

  var vigCache = { w: 0, h: 0, c: null, f: '' };
  /** Dunkle Raender: der Blick geht zur Mitte (rund, nicht nur oben/unten). */
  function vignette(ctx, W, H, a, col) {
    if (!(a > 0)) return;
    col = col || '#000000';
    if (vigCache.w !== W || vigCache.h !== H || vigCache.f !== col) {
      var c = vigCache.c || document.createElement('canvas');
      c.width = Math.ceil(W / 2); c.height = Math.ceil(H / 2);
      var x = c.getContext('2d'), cw = c.width, ch = c.height;
      x.clearRect(0, 0, cw, ch);
      x.save();
      x.translate(cw / 2, ch / 2);
      x.scale(1, ch / cw);
      var g = x.createRadialGradient(0, 0, cw * 0.28, 0, 0, cw * 0.72);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.55, rgba(col, 0.35));
      g.addColorStop(1, rgba(col, 1));
      x.fillStyle = g;
      x.fillRect(-cw, -cw, cw * 2, cw * 2);
      x.restore();
      vigCache = { w: W, h: H, c: c, f: col };
    }
    var ga = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
    ctx.globalAlpha = ga * Math.min(1, a);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(vigCache.c, 0, 0, W, H);
    ctx.imageSmoothingEnabled = sm;
    ctx.globalAlpha = ga;
  }

  /** Farbstimmung: legt eine Farbe weich ueber die Mitteltoene. */
  function tonung(ctx, W, H, col, a, art) {
    if (!(a > 0) || !col) return;
    var op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = art || 'soft-light';
    ctx.globalAlpha = ga * Math.min(1, a);
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = ga;
    ctx.globalCompositeOperation = op;
  }

  /** Tempo-Unschaerfe: das fertige Bild noch zweimal leicht vergroessert
      und durchsichtig darueber. k = wie stark (0.01..0.06), a = Deckkraft. */
  function zoomUnschaerfe(ctx, quelle, W, H, k, a, cx, cy) {
    if (!(k > 0) || !(a > 0) || stufe() < 1) return;
    cx = cx === undefined ? W / 2 : cx; cy = cy === undefined ? H / 2 : cy;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (var i = 1; i <= 2; i++) {
      var s = 1 + k * i;
      ctx.globalAlpha = a / i;
      ctx.drawImage(quelle, cx - cx * s, cy - cy * s, W * s, H * s);
    }
    ctx.restore();
  }

  /** Weiche Unschaerfe einer Leinwand (fuer Tiefenunschaerfe): einmal klein
      und wieder gross. Gibt die weiche Fassung zurueck. */
  function weich(name, quelle, w, h, faktor) {
    var bw = Math.max(1, Math.round(w / faktor)), bh = Math.max(1, Math.round(h / faktor));
    var b = buf(name, bw, bh), x = b.getContext('2d');
    x.globalCompositeOperation = 'copy';
    x.imageSmoothingEnabled = true;
    x.drawImage(quelle, 0, 0, bw, bh);
    x.globalCompositeOperation = 'source-over';
    return b;
  }

  global.Licht = {
    rs: function () { return RS; },
    setRs: function (r) { RS = r; },
    rsFuer: rsFuer,
    stufe: stufe,
    einstellung: einstellung,
    messen: messen,
    puffer: buf,
    rgb: rgb, rgba: rgba, misch: misch,
    glow: glow, glowOval: glowOval, glowBild: glowBild, kegel: kegel, strahlen: strahlen,
    bloom: bloom, bloomFangen: bloomFangen, bloomZeichnen: bloomZeichnen, bloomGefangen: function () { return gefangen; },
    vignette: vignette, tonung: tonung, zoomUnschaerfe: zoomUnschaerfe, weich: weich,
    _autoStufe: function (s) { if (s !== undefined) autoStufe = s; return autoStufe; }
  };

})(window);
