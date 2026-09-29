/* =====================================================================
   pixel.js — Sprite-Engine + die beiden Balci-Brüder.
   Jedes Pixel hier ist von Hand gesetzt. Keine Bilddateien, nichts
   heruntergeladen. Die Figuren bestehen aus Einzelteilen (Kopf, Rumpf,
   Arm, Bein), damit sie sich richtig bewegen statt nur zu ruckeln.

   Yusuf:   volle dunkle Locken, Schnurrbart, grüne Augen,
            helle Jeansjacke über weissem Pulli, kräftige Statur.
   Huseyin: gleiche Familie, aber Fade-Schnitt, Vollbart,
            schwarze Lederjacke mit Silberkette, schmal.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------
     Kern: Art-Strings -> gebackene Canvas-Sprites
     --------------------------------------------------------------- */

  var palettes = {};
  var sprites = {};

  /** Template-String zu sauberem Zeilen-Array (gleiche Länge). */
  function art(str) {
    var rows = String(str).split('\n');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].replace(/\s+$/, '').replace(/^[ \t]+/, '');
      if (r.length) out.push(r);
    }
    var w = 0, j;
    for (j = 0; j < out.length; j++) w = Math.max(w, out[j].length);
    for (j = 0; j < out.length; j++) {
      while (out[j].length < w) out[j] += '.';
    }
    return out;
  }

  function palette(name, map) { palettes[name] = map; return map; }

  function hexToRGBA(hex) {
    if (!hex || hex === '.') return null;
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var a = 255;
    if (h.length === 8) { a = parseInt(h.substr(6, 2), 16); h = h.substr(0, 6); }
    return [
      parseInt(h.substr(0, 2), 16),
      parseInt(h.substr(2, 2), 16),
      parseInt(h.substr(4, 2), 16),
      a
    ];
  }

  function bake(rows, pal) {
    var h = rows.length, w = rows[0].length;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(w, h);
    var data = img.data;
    var cache = {};

    for (var y = 0; y < h; y++) {
      var row = rows[y];
      for (var x = 0; x < w; x++) {
        var ch = row.charAt(x);
        if (ch === '.' || ch === ' ' || ch === undefined) continue;
        var col = cache[ch];
        if (col === undefined) { col = hexToRGBA(pal[ch]); cache[ch] = col; }
        if (!col) continue;
        var p = (y * w + x) * 4;
        data[p] = col[0]; data[p + 1] = col[1]; data[p + 2] = col[2]; data[p + 3] = col[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function mirror(src) {
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    var x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  }

  /** Verdunkelte Kopie — für hintere Arme/Beine (Tiefenwirkung). */
  function darken(src, amount) {
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    var x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(20,10,30,' + amount + ')';
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /** Vollflächig eingefärbte Silhouette — für Treffer-Blitze. */
  function silhouette(src, color) {
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    var x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function def(name, rowsOrStr, palName) {
    var rows = (typeof rowsOrStr === 'string') ? art(rowsOrStr) : rowsOrStr;
    var pal = palettes[palName] || palName || palettes.main;
    var c = bake(rows, pal);
    var s = { name: name, w: c.width, h: c.height, c: c, f: null, d: null, df: null, white: null };
    sprites[name] = s;
    return s;
  }

  function get(name) {
    var s = sprites[name];
    if (!s) throw new Error('Sprite fehlt: ' + name);
    return s;
  }

  function flipped(s) { if (!s.f) s.f = mirror(s.c); return s.f; }
  function dark(s) { if (!s.d) s.d = darken(s.c, 0.33); return s.d; }
  function darkFlipped(s) { if (!s.df) s.df = mirror(dark(s)); return s.df; }
  function white(s) { if (!s.white) s.white = silhouette(s.c, '#ffffff'); return s.white; }

  function draw(ctx, name, x, y, flip, back) {
    var s = get(name);
    var img = back ? (flip ? darkFlipped(s) : dark(s)) : (flip ? flipped(s) : s.c);
    ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  function drawWhite(ctx, name, x, y, flip) {
    var s = get(name);
    var img = white(s);
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(x) + s.w, Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else ctx.drawImage(img, Math.round(x), Math.round(y));
  }

  /** Einfarbige Silhouette, z.B. fuer das Leuchten verwandelter Bosse. */
  function drawTint(ctx, name, x, y, col) {
    var s = get(name);
    if (!s.tints) s.tints = {};
    if (!s.tints[col]) s.tints[col] = silhouette(s.c, col);
    ctx.drawImage(s.tints[col], Math.round(x), Math.round(y));
  }

  /* ---------------------------------------------------------------
     Paletten
     --------------------------------------------------------------- */

  palette('yusuf', {
    k: '#1b1220', // Outline
    h: '#2f1d12', // dunkle Locken
    H: '#4a301c', // Locken-Glanz
    s: '#f0b487', // Haut
    d: '#ce8f66', // Haut-Schatten
    w: '#ffffff', // Augenweiß
    g: '#3ad368', // GRÜNE Augen
    G: '#1d7d3c',
    m: '#8e2f2c', // Mund
    t: '#ff8e96', // Zunge
    r: '#a8c6e4', // Jeansjacke hell
    R: '#7699bd', // Jeansjacke dunkel
    y: '#f2f1ea', // weisser Pulli
    Y: '#d6d4cb',
    b: '#4a6fa8', // Jeans
    B: '#33507d',
    n: '#dedad2', // Sneaker
    N: '#9d998f',
    c: '#f4f2ec', // Zigarettenpapier
    o: '#ff8a2a'  // Glut
  });

  palette('huseyin', {
    k: '#140f1c',
    h: '#241610', // sehr dunkle Locken oben
    H: '#3d2718',
    j: '#5a4232', // Bart / rasierte Seiten
    s: '#eab488',
    d: '#c78c62',
    w: '#ffffff',
    g: '#3ad368', // gleiche grüne Augen — ist ja der Bruder
    G: '#1d7d3c',
    m: '#7d2724',
    t: '#ff8e96',
    r: '#33323c', // Lederjacke
    R: '#1d1d24',
    y: '#cfd4e0', // Silberkette
    Y: '#f2f4fa',
    b: '#22222b', // dunkle Hose
    B: '#141419',
    n: '#e4e4ea', // weisse Sneaker
    N: '#a6a6b0'
  });

  /* ---------------------------------------------------------------
     YUSUF — Kopf (14 x 13). Volle Locken, Schnurrbart, grüne Augen.
     --------------------------------------------------------------- */

  var Y_HEAD = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhHhhhhhHhhk
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khsgwsssswgsdk
    khssssdsssssdk
    khsssHHHHsssdk
    khsskmmmmksddk
    kdssssssssssdk
    .kddddddddddk.
    ..kddddddddk..
  `;

  // Sein Lachen ist... speziell. HÖ HÖ HÖÖÖ.
  var Y_HEAD_LAUGH = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhHhhhhhHhhk
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khskksssskksdk
    khssssdsssssdk
    khsssHHHHsssdk
    khskmmmmmmksdk
    kdkmtttttttmkd
    .kdkmmmmmmmkd.
    ..kddddddddk..
  `;

  var Y_HEAD_HURT = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhHhhhhhHhhk
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khskskssksksdk
    khssssdsssssdk
    khsssHHHHsssdk
    khssskmmksssdk
    kdssskmmksssdk
    .kddddddddddk.
    ..kddddddddk..
  `;

  // Yusufs Lieblingszustand.
  var Y_HEAD_SLEEP = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhHhhhhhHhhk
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khskksssskksdk
    khssssdsssssdk
    khsssHHHHsssdk
    khsssskmmkssdk
    kdsssskmmkssdk
    .kddddddddddk.
    ..kddddddddk..
  `;

  // Backen voll. Kauen ist ein Vollzeitjob.
  var Y_HEAD_EAT = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhHhhhhhHhhk
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khskkssssgwsdk
    khssssdsssssdk
    khsdsHHHHsdsdk
    khsdkmmmmkdsdk
    kdsddssssddsdk
    .kddddddddddk.
    ..kddddddddk..
  `;

  // Das tiefe Goblin-Knurren. KRRRRR.
  var Y_HEAD_GROWL = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhHhhhhhHhhk
    khhhhhhhhhhhhk
    khhssssssssHhk
    khkkssssskkhdk
    khsgwsssswgsdk
    khssssdsssssdk
    khsssHHHHsssdk
    khkmmmmmmmmkdk
    kdkmwwwwwwmkdk
    .kdkmmmmmmkdk.
    ..kddddddddk..
  `;

  // Mit Kippe im Mundwinkel.
  var Y_HEAD_SMOKE = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhHhhhhhHhhk
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khsgwsssswgsdk
    khssssdsssssdk
    khsssHHHHsssdk
    khsskmmkcccok.
    kdssssssssssdk
    .kddddddddddk.
    ..kddddddddk..
  `;

  /* ---------------------------------------------------------------
     HUSEYIN — Kopf (14 x 13). Fade an den Seiten, Vollbart.
     --------------------------------------------------------------- */

  var H_HEAD = `
    ....kkkkkk....
    ...khhhhhhk...
    ..khhhhhhhhk..
    .khhHhhhhHhhk.
    .kjhhhhhhhhjk.
    .kjssssssssjk.
    .kjsgwsswgsjk.
    .kjsssdssssjk.
    .kjssHHHHssjk.
    .kjjskmmksjjk.
    ..kjjssssjjk..
    ...kjjjjjjk...
    .....kddk.....
  `;

  var H_HEAD_ANGRY = `
    ....kkkkkk....
    ...khhhhhhk...
    ..khhhhhhhhk..
    .khhHhhhhHhhk.
    .kjhhhhhhhhjk.
    .kjskssssksjk.
    .kjsgwsswgsjk.
    .kjsssdssssjk.
    .kjssHHHHssjk.
    .kjjkmmmmkjjk.
    ..kjjmmmmjjk..
    ...kjjjjjjk...
    .....kddk.....
  `;

  var H_HEAD_HURT = `
    ....kkkkkk....
    ...khhhhhhk...
    ..khhhhhhhhk..
    .khhHhhhhHhhk.
    .kjhhhhhhhhjk.
    .kjssssssssjk.
    .kjskskskssjk.
    .kjsssdssssjk.
    .kjssHHHHssjk.
    .kjjskmmksjjk.
    ..kjjskmksjk..
    ...kjjjjjjk...
    .....kddk.....
  `;

  /* ---------------------------------------------------------------
     ESAT — bester Kollege, letzter Endgegner.
     --------------------------------------------------------------- */

  // Esat: dunkles Haar nach hinten, kurzer Vollbart, schwarzer Zip-Pulli.
  palette('esat', {
    k: '#120e18',
    h: '#1c1418', H: '#332427',
    j: '#241a16', J: '#3a2a22',      // Bart
    s: '#eab48c', d: '#c8906a',
    w: '#ffffff', g: '#3a2a1a', G: '#22180f',
    m: '#7d2724', t: '#ff8e96',
    r: '#2b2b33', R: '#17171d',      // Zip-Pulli
    y: '#4a4a56', Y: '#6a6a78',      // Reissverschluss
    b: '#242630', B: '#15161c',
    n: '#d8d4cc', N: '#9a968e',
    c: '#f4f2ec', o: '#ff8a2a'
  });

  var E_HEAD = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khsgwsssswgsdk
    khssssdsssssdk
    khsjjjjjjjjsdk
    khsjkmmmmkjsdk
    kdjjjjjjjjjjdk
    .kdjjjjjjjjdk.
    ..kddddddddk..
  `;

  // Grinst, wenn er jemanden aufzieht.
  var E_HEAD_GRIN = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khskksssskksdk
    khssssdsssssdk
    khsjjjjjjjjsdk
    khsjkmmmmkjsdk
    kdjjkwwwwkjjdk
    .kdjjkmmkjjdk.
    ..kddddddddk..
  `;

  var E_HEAD_HURT = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhhhhhhhhhhhk
    khhssssssssHhk
    khssssssssssdk
    khskskssksksdk
    khssssdsssssdk
    khsjjjjjjjjsdk
    khsjskmmksjsdk
    kdjjjkmmkjjjdk
    .kdjjjjjjjjdk.
    ..kddddddddk..
  `;

  // Wuetendes Gesicht — nach dem Snus traegt er nur noch dieses.
  var E_HEAD_RAGE = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhhhhhhhhhhhk
    khhssssssssHhk
    khkkssssssdkdk
    khgwsssssswgdk
    khssssdsssssdk
    khsjjjjjjjjsdk
    khjkmmmmmmkjdk
    kdjkwwwwwwkjdk
    .kdjkmmmmkjdk.
    ..kddddddddk..
  `;

  var E_TORSO = `
    ..kkkkkkkk..
    .krrrrrrrrk.
    krrrrrrrrrrk
    krrrYyYrrrrk
    krrrryYrrrrk
    krrrryYrrrrk
    krrrryYrrrrk
    kRrrryYrrrRk
    kRRRRyYRRRRk
    .kRRRRRRRRk.
    .kdssssssdk.
    ..kkkkkkkk..
  `;

  var E_ARM = `
    .kkk.
    krrrk
    krrrk
    kRRRk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;

  var E_LEG = `
    .kkk.
    kbbbk
    kbbbk
    kbBbk
    kbbbk
    .kbk.
    .kbk.
    knnnk
    kNNNk
  `;

  // Nach dem Snus: breiter Rumpf, der Pulli steht offen, Brust raus.
  var E_TORSO_BUFF = `
    ..kkkkkkkkkkkkkk..
    .krrrrrrYYrrrrrrk.
    krrrrrrkYYkrrrrrrk
    krRRRRksddskRRRRrk
    krrrrRksddskRrrrrk
    kRrrrRkdsdskRrrrRk
    .kRrrRksddskRrrRk.
    .kRRRRkdsdskRRRRk.
    ..kRRRkYyYYkRRRk..
    ..kRRRRRRRRRRRRk..
    ..kbbbbbbbbbbbbk..
    ...kkkkkkkkkkkk...
  `;

  var E_ARM_BUFF = `
    .kkkk..
    krrrrk.
    krrrrrk
    kRrrrRk
    .kRRRk.
    kssssdk
    kssssdk
    ksssddk
    .kssdk.
    ..kkk..
  `;

  var E_LEG_BUFF = `
    .kkkk.
    kbbbbk
    kbbbbk
    kbBBbk
    kbbbbk
    .kbbk.
    .kbbk.
    knnnnk
    kNNNNk
  `;

  /* ---------------------------------------------------------------
     ALEX — Kollege, Endgegner in Level 9. Helle Locken, weisses Hemd,
     Silberkette, Ohrstecker. Und immer eine Flasche in Reichweite.
     --------------------------------------------------------------- */

  palette('alex', {
    k: '#141018',
    h: '#c9a05a', H: '#e8c98a',
    s: '#f0c3a0', d: '#d19a72', r: '#e06a6a',
    g: '#3a7ab8', w: '#ffffff', W: '#d3d8e2', m: '#8a3a3a',
    c: '#c8ced8', b: '#2a3242', B: '#1a2030',
    n: '#e8e8ee', N: '#9a9aa4'
  });

  var A_HEAD = `
    ...hhhhhhhh...
    ..hHhhhHhhhh..
    .hhhhhhhhhhhh.
    khhHhhhhhhHhhk
    khssssssssssdk
    khssssssssssdk
    .ksgwssswgsdk.
    .kssssdssssbk.
    .ksssmmmmsssk.
    .kssssssssssk.
    ..kssssssssk..
    ...kddddddk...
    ...kssssssk...
  `;

  // Wenn er sich aufregt: Augenbrauen runter, Mund auf.
  var A_HEAD_ANGRY = `
    ...hhhhhhhh...
    ..hHhhhHhhhh..
    .hhhhhhhhhhhh.
    khhHhhhhhhHhhk
    khssssssssssdk
    khkkssssskksdk
    .ksgwssswgsdk.
    .kssssdssssbk.
    .ksskmmmmkssk.
    .kssmmmmmmssk.
    ..kssssssssk..
    ...kddddddk...
    ...kssssssk...
  `;

  // Nach der halben Energie: Ultrapenner. Augen halb zu, rote Backen.
  var A_HEAD_DRUNK = `
    ...hhhhhhhh...
    ..hHhhhhhhhh..
    .hhhhhhhhhhhh.
    khhhhhhhhhhhhk
    khssssssssssdk
    khssssssssssdk
    .kskkssskksdk.
    .krsssdsssrbk.
    .kssmmmmmmssk.
    .ksssmmmmsssk.
    ..kssssssssk..
    ...kddddddk...
    ...kssssssk...
  `;

  var A_HEAD_HURT = `
    ...hhhhhhhh...
    ..hHhhhHhhhh..
    .hhhhhhhhhhhh.
    khhHhhhhhhHhhk
    khssssssssssdk
    khssssssssssdk
    .kskkssskksdk.
    .kssssdssssbk.
    .ksmsmsmsmssk.
    .kssssssssssk.
    ..kssssssssk..
    ...kddddddk...
    ...kssssssk...
  `;

  var A_TORSO = `
    ..kkkkkkkkkk..
    .kwwwwccwwwwk.
    kwwwwwsswwwwwk
    kwwwwwsswwwwwk
    kwwwwwwwwwwwwk
    kwwwwwwwwwwwwk
    kWwwwwwwwwwWk.
    kWwwwwwwwwwWk.
    kWWwwwwwwWWWk.
    .kWWWWWWWWWWk.
    .kbbbbbbbbbbk.
    ..kkkkkkkkkk..
  `;

  var A_ARM = `
    .kkk.
    kwwwk
    kwwwk
    kWWWk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;

  var A_LEG = `
    .kkk.
    kbbbk
    kbbbk
    kbBbk
    kbbbk
    .kbk.
    .kbk.
    knnnk
    kNNNk
  `;

  /* ---------------------------------------------------------------
     BROKE — Kollege, Boss in Level 11. Hellbraune, wellige Haare nach
     oben gestylt, schwarze Lederjacke ueber schwarzem Shirt. Schnell.
     --------------------------------------------------------------- */

  palette('broke', {
    k: '#141018',
    h: '#8a6440', H: '#c49a64',          // Haare, blonde Straehnen
    s: '#f2c8a8', d: '#d6a482',
    w: '#ffffff', g: '#4a6a8a', m: '#9a4a44',
    r: '#26242c', R: '#121116', l: '#58555f', // Lederjacke mit Glanz
    y: '#0e0e12',                          // schwarzes Shirt
    b: '#2c2e3a', B: '#1c1d26',
    n: '#dcdce4', N: '#9a9aa6'
  });

  var B_HEAD = `
    ....hHhhHh....
    ..hhHhhhhHhh..
    .hhHhhhHhhhHh.
    khhhhhhhhhhhhk
    khhHsssssshhhk
    khssssssssshdk
    khsgwssssgwsdk
    .ksssssdsssdk.
    .kssssssssssk.
    .ksssmmmmsssk.
    ..kssssssssk..
    ...kddddddk...
    ....kssssk....
  `;

  // Grinst, wenn die Mikas kommen.
  var B_HEAD_GRIN = `
    ....hHhhHh....
    ..hhHhhhhHhh..
    .hhHhhhHhhhHh.
    khhhhhhhhhhhhk
    khhHsssssshhhk
    khssssssssshdk
    khskkssssskksk
    .ksssssdsssdk.
    .kssmwwwwmssk.
    .ksskmmmmkssk.
    ..kssssssssk..
    ...kddddddk...
    ....kssssk....
  `;

  var B_HEAD_HURT = `
    ....hHhhHh....
    ..hhHhhhhHhh..
    .hhHhhhHhhhHh.
    khhhhhhhhhhhhk
    khhHsssssshhhk
    khssssssssshdk
    khskskssksksdk
    .ksssssdsssdk.
    .kssssssssssk.
    .kssskmmksssk.
    ..kssssssssk..
    ...kddddddk...
    ....kssssk....
  `;

  // Voll konzentriert: Augenbrauen runter, Zaehne zusammen.
  var B_HEAD_RAGE = `
    ....hHhhHh....
    ..hhHhhhhHhh..
    .hhHhhhHhhhHh.
    khhhhhhhhhhhhk
    khhHsssssshhhk
    khkkssssskkhdk
    khsgwssssgwsdk
    .ksssssdsssdk.
    .kssssssssssk.
    .kskwwwwwwksk.
    ..kssssssssk..
    ...kddddddk...
    ....kssssk....
  `;

  var B_TORSO = `
    ..kkkkkkkk..
    .krrlrrlrrk.
    krrlryyrlrrk
    krrryyyyrrrk
    krlryyyyrlrk
    krrryyyyrrrk
    krrryyyyrrrk
    kRrryyyyrrRk
    kRRRyyyyRRRk
    .kRRRyyRRRk.
    .kbbbbbbbbk.
    ..kkkkkkkk..
  `;

  var B_ARM = `
    .kkk.
    krlrk
    krrrk
    kRRRk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;

  var B_LEG = `
    .kkk.
    kbbbk
    kbbbk
    kbBbk
    kbbbk
    .kbk.
    .kbk.
    knnnk
    kNNNk
  `;

  /* ---------------------------------------------------------------
     HAMZA — libanesischer Freund, Boss in Level 13. Kurze dunkle Haare,
     Bart, rotes Fussballtrikot mit gruener Zeder auf der Brust.
     --------------------------------------------------------------- */

  palette('hamza', {
    k: '#140f14',
    h: '#1a1210', H: '#3a2a20', j: '#24180f',
    s: '#dca77e', d: '#b8845c',
    w: '#ffffff', g: '#3a2616', m: '#7d2724',
    r: '#d8282e', R: '#9a1a1e', y: '#f4f2ec', c: '#2a9a4a',
    b: '#20202a', B: '#121218',
    n: '#e8e8ee', N: '#9a9aa4'
  });

  var HA_HEAD = `
    ....kkkkkk....
    ..kkhHhhHhkk..
    .khHhhHhhHhhk.
    khhhhhhhhhhhhk
    khssssssssssdk
    khssssssssssdk
    khsgwssssgwsdk
    kjssssdssssjdk
    kjjsssssssjjdk
    kjjjkmmmmkjjdk
    .kjjjjjjjjjjk.
    ..kjjjjjjjjk..
    ....kssssk....
  `;
  var HA_HEAD_GRIN = `
    ....kkkkkk....
    ..kkhHhhHhkk..
    .khHhhHhhHhhk.
    khhhhhhhhhhhhk
    khssssssssssdk
    khssssssssssdk
    khskksssskksdk
    kjssssdssssjdk
    kjjsssssssjjdk
    kjjkwwwwwwkjdk
    .kjjkmmmmkjjk.
    ..kjjjjjjjjk..
    ....kssssk....
  `;
  var HA_HEAD_HURT = `
    ....kkkkkk....
    ..kkhHhhHhkk..
    .khHhhHhhHhhk.
    khhhhhhhhhhhhk
    khssssssssssdk
    khssssssssssdk
    khskskssksksdk
    kjssssdssssjdk
    kjjsssssssjjdk
    kjjjkmmkjjjjdk
    .kjjjjjjjjjjk.
    ..kjjjjjjjjk..
    ....kssssk....
  `;
  var HA_HEAD_RAGE = `
    ....kkkkkk....
    ..kkhHhhHhkk..
    .khHhhHhhHhhk.
    khhhhhhhhhhhhk
    khssssssssssdk
    khkkssssskkhdk
    khsgwssssgwsdk
    kjssssdssssjdk
    kjjsssssssjjdk
    kjjkwwwwwwkjdk
    .kjjjjjjjjjjk.
    ..kjjjjjjjjk..
    ....kssssk....
  `;
  var HA_TORSO = `
    ..kkkkkkkk..
    .krrryyrrrk.
    krrrryyrrrrk
    krrrrrrrrrrk
    krrrcrrrrrrk
    krrcccrrrrrk
    krrrcrrrrrrk
    kRrrrrrrrrRk
    kRRRRRRRRRRk
    .kRRRRRRRRk.
    .kbbbbbbbbk.
    ..kkkkkkkk..
  `;
  var HA_ARM = `
    .kkk.
    krrrk
    kRRRk
    .ksk.
    kssdk
    kssdk
    kssdk
    .kkk.
  `;
  var HA_LEG = `
    .kkk.
    kbbbk
    kbBbk
    .ksk.
    .ksk.
    .knk.
    .knk.
    knnnk
    kNNNk
  `;

  /* ---------------------------------------------------------------
     GEORGIOS — griechischer Freund, Boss in Level 15. Dunkle Wellen,
     Stoppelbart, weisses Hemd mit blauen Streifen. Sehr schnell.
     Ab der Haelfte: Spartaner (siehe weiter unten).
     --------------------------------------------------------------- */

  palette('georgios', {
    k: '#120e14',
    h: '#2a1a10', H: '#4a3220', j: '#6a5040',
    s: '#e2b088', d: '#c08a60',
    w: '#ffffff', g: '#3a2616', m: '#7d2724',
    r: '#f4f6fa', R: '#c8d0e0', y: '#2a5ab8',
    b: '#24304a', B: '#161e30',
    n: '#1c1c24', N: '#3a3a44',
    G: '#d8282e', L: '#ff7a6a'
  });

  var GE_HEAD = `
    ...kkkkkkk....
    ..khhHhhHhhk..
    .khHhhhhHhhhk.
    khhhhhhhhhhhhk
    khhsssssssshhk
    khssssssssssdk
    khsgwssssgwsdk
    .kssssdssssjk.
    .kjssssssssjk.
    .kjjsmmmmsjjk.
    ..kjjjjjjjjk..
    ...kddddddk...
    ....kssssk....
  `;
  var GE_HEAD_GRIN = `
    ...kkkkkkk....
    ..khhHhhHhhk..
    .khHhhhhHhhhk.
    khhhhhhhhhhhhk
    khhsssssssshhk
    khssssssssssdk
    khskksssskksdk
    .kssssdssssjk.
    .kjssssssssjk.
    .kjjkwwwwkjjk.
    ..kjjmmmmjjk..
    ...kddddddk...
    ....kssssk....
  `;
  var GE_HEAD_HURT = `
    ...kkkkkkk....
    ..khhHhhHhhk..
    .khHhhhhHhhhk.
    khhhhhhhhhhhhk
    khhsssssssshhk
    khssssssssssdk
    khskskssksksdk
    .kssssdssssjk.
    .kjssssssssjk.
    .kjjskmmksjjk.
    ..kjjjjjjjjk..
    ...kddddddk...
    ....kssssk....
  `;
  var GE_HEAD_RAGE = `
    ...kkkkkkk....
    ..khhHhhHhhk..
    .khHhhhhHhhhk.
    khhhhhhhhhhhhk
    khhsssssssshhk
    khkksssssskkdk
    khsgwssssgwsdk
    .kssssdssssjk.
    .kjssssssssjk.
    .kjkwwwwwwkjk.
    ..kjjjjjjjjk..
    ...kddddddk...
    ....kssssk....
  `;
  var GE_TORSO = `
    ..kkkkkkkk..
    .krrrkkrrrk.
    krrrrrrrrrrk
    kyyyyyyyyyyk
    krrrrrrrrrrk
    kyyyyyyyyyyk
    krrrrrrrrrrk
    kyyyyyyyyyyk
    kRrrrrrrrrRk
    .kRRRRRRRRk.
    .kbbbbbbbbk.
    ..kkkkkkkk..
  `;
  var GE_ARM = `
    .kkk.
    krrrk
    kyyyk
    kRRRk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var GE_LEG = `
    .kkk.
    kbbbk
    kbbbk
    kbBbk
    kbbbk
    .kbk.
    .kbk.
    knnnk
    kNNNk
  `;
  /* ---------------------------------------------------------------
     GEORGIOS ALS SPARTANER — seine neue Verwandlung (Level 15).
     Korinthischer Helm mit rotem Kamm, Bronzepanzer, roter Rock.
     --------------------------------------------------------------- */

  palette('sparta', {
    k: '#120e14',
    s: '#e2b088', d: '#c08a60',
    w: '#ffffff', g: '#3a2616', m: '#7d2724',
    j: '#4a3220',                          // Bart unter dem Helm
    o: '#c8903a', a: '#f0c860', O: '#8a5a20', // Bronze
    r: '#c02828', R: '#e84848',            // Kamm, Rock
    n: '#6a4020', N: '#4a2c14'             // Sandalen
  });

  var SP_HEAD = `
    ....rrrrrr....
    ...rRRRRRRr...
    ..rRRRRRRRRr..
    ...kkkkkkkk...
    ..kooooooooak.
    .koooooooooook
    .kooksssskooak
    .kookgwsgwkook
    .kooosdssooook
    .kookjjjjkoook
    .kookjmmjkoook
    ..kokjjjjkook.
    ..kok....kok..
    ....kssssk....
  `;
  var SP_HEAD_RAGE = `
    ....rrrrrr....
    ...rRRRRRRr...
    ..rRRRRRRRRr..
    ...kkkkkkkk...
    ..kooooooooak.
    .koooooooooook
    .kookkssskkoak
    .kookgwsgwkook
    .kooosdssooook
    .kookmmmmkoook
    .kookmwwmkoook
    ..kokjjjjkook.
    ..kok....kok..
    ....kssssk....
  `;
  var SP_TORSO = `
    ..kkkkkkkk..
    .koooooooak.
    koooooooooak
    kooOoooOoook
    koooOOOOoook
    kooooOOooook
    koooOooOoook
    kooooOOooook
    kOoooooooOok
    .kOOOOOOOOk.
    .krRrRrRrRk.
    ..kkkkkkkk..
  `;
  var SP_ARM = `
    .kkk.
    kssdk
    kssdk
    kssdk
    kooak
    koook
    kssdk
    kssdk
    .kkk.
  `;
  var SP_LEG = `
    .kkk.
    ksssk
    ksssk
    kooak
    kooak
    .kok.
    .kok.
    knnnk
    kNNNk
  `;

  /* ---------------------------------------------------------------
     DER ANDERE ALEX — Georgios' Kumpel. Gross. Schiebermuetze, Brille,
     rotbrauner Bart, beige Jacke ueber schwarzem Shirt, Uhr am Handgelenk,
     rote Kruecken. Im Fussball Torwart, in Level 17 ein Riese.
     --------------------------------------------------------------- */

  palette('alexg', {
    k: '#141018',
    c: '#3a3a44', C: '#5a5a66',            // Schiebermuetze
    h: '#8a5a30',                          // Haare an der Seite
    j: '#a8683a', J: '#7a4a26',            // Bart
    s: '#f2caa8', d: '#d6a482',
    e: '#c8ccd6', w: '#ffffff', g: '#4a6a7a', m: '#8a3a3a',
    r: '#cdb88c', R: '#a8946a',            // beige Jacke
    y: '#16161c',                          // schwarzes Shirt
    t: '#dfe3ea',                          // Uhr
    b: '#1e1e26', B: '#101016',            // schwarze Hose
    n: '#f2f2ee', N: '#b8b8b0'             // weisse Sneaker
  });

  var AG_HEAD = `
    ...kkkkkkkk...
    ..kcCCcccccck.
    .kccccccccccck
    .khkkkkkkkkkkk
    .khsssssssssdk
    .khseeeeeeesdk
    .khsegesegesdk
    .khseeeseeesdk
    .kjssssdsssjdk
    .kjjjjmmmjjjjk
    ..kjjjjjjjjjk.
    ...kjjjjjjjk..
    ....kddddk....
  `;
  var AG_HEAD_ANGRY = `
    ...kkkkkkkk...
    ..kcCCcccccck.
    .kccccccccccck
    .khkkkkkkkkkkk
    .khskksssskkdk
    .khseeeeeeesdk
    .khsegesegesdk
    .khseeeseeesdk
    .kjssssdsssjdk
    .kjjjmmmmmjjjk
    ..kjjmwwwmjjk.
    ...kjjjjjjjk..
    ....kddddk....
  `;
  var AG_HEAD_HURT = `
    ...kkkkkkkk...
    ..kcCCcccccck.
    .kccccccccccck
    .khkkkkkkkkkkk
    .khsssssssssdk
    .khseeeeeeesdk
    .khsekesekesdk
    .khseeeseeesdk
    .kjssssdsssjdk
    .kjjjjkmkjjjjk
    ..kjjjjjjjjjk.
    ...kjjjjjjjk..
    ....kddddk....
  `;
  // Ohne Muetze (die fliegt im Kampf irgendwann weg)
  var AG_HEAD_BARE = `
    ...hhhhhhhh...
    ..hhhhhhhhhh..
    .hhhhhhhhhhhhk
    .khhhhhhhhhhhk
    .khsssssssssdk
    .khseeeeeeesdk
    .khsegesegesdk
    .khseeeseeesdk
    .kjssssdsssjdk
    .kjjjmmmmmjjjk
    ..kjjmwwwmjjk.
    ...kjjjjjjjk..
    ....kddddk....
  `;
  var AG_TORSO = `
    ..kkkkkkkkkk..
    .krrrkyykrrrk.
    krrrryyyyrrrrk
    krrrryyyyrrrrk
    krRrryyyyrrRrk
    krRrryyyyrrRrk
    krrrryyyyrrrrk
    kRrrryyyyrrrRk
    kRRrryyyyrrRRk
    .kRRRyyyyRRRk.
    .kbbbbbbbbbbk.
    ..kkkkkkkkkk..
  `;
  var AG_ARM = `
    .kkk.
    krrrk
    krrrk
    kRRRk
    kRRRk
    .ktk.
    kssdk
    kssdk
    .kkk.
  `;
  var AG_LEG = `
    .kkk.
    kbbbk
    kbbbk
    kbBbk
    kbbbk
    .kbk.
    .kbk.
    knnnk
    kNNNk
  `;

  /* ---------------------------------------------------------------
     NILS — Kollege, Endgegner im Knast. Glatze, sehr viel Stirn, weisses
     T-Shirt, Taschengurt. Sehr klug. Weiss alles. Schon vorher.
     --------------------------------------------------------------- */

  palette('nils', {
    k: '#141018',
    s: '#f4d2b8', d: '#dcae90', W: '#fff4ea', // Haut, Glanz auf der Stirn
    b: '#c8a07a',                          // helle Augenbrauen
    w: '#ffffff', g: '#5a7a9a', m: '#9a4a44',
    x: '#1a1a20',                          // Taschengurt
    y: '#f4f4f0', Y: '#c8ccd4',            // T-Shirt
    j: '#3a4a66', J: '#26324a',            // Jeans
    n: '#2a2a30', N: '#141418'             // Schuhe
  });

  var NI_HEAD = `
    ....kkkkkk....
    ..kksWWsssskk.
    .ksssWsssssssk
    .kssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksbbbssbbbssdk
    kssgwsssgwssdk
    ksssssdssssdk.
    .kssskmmmksdk.
    .ksssssssssdk.
    ..kddddddddk..
    ....kssssk....
  `;
  var NI_HEAD_GRIN = `
    ....kkkkkk....
    ..kksWWsssskk.
    .ksssWsssssssk
    .kssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksbbbssbbbssdk
    kssgwsssgwssdk
    ksssssdssssdk.
    .kskmmmmmmkdk.
    .ksskwwwwksdk.
    ..kddddddddk..
    ....kssssk....
  `;
  var NI_HEAD_HURT = `
    ....kkkkkk....
    ..kksWWsssskk.
    .ksssWsssssssk
    .kssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksbbbssbbbssdk
    ksskskssksksdk
    ksssssdssssdk.
    .kssskmmksssk.
    .ksssssssssdk.
    ..kddddddddk..
    ....kssssk....
  `;
  var NI_HEAD_SLEEP = `
    ....kkkkkk....
    ..kksWWsssskk.
    .ksssWsssssssk
    .kssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksssssssssssdk
    ksbbbssbbbssdk
    ksskksssskksdk
    ksssssdssssdk.
    .ksssskmksssk.
    .ksssssssssdk.
    ..kddddddddk..
    ....kssssk....
  `;
  // Genie-Modus: die Stirn waechst. Und waechst.
  var NI_HEAD_GENIE = `
    ......kkkkkk......
    ....kkWWWsssskk...
    ...kssWWWsssssskk.
    ..ksssWWssssssssk.
    .kssssssssssssssdk
    .kssssssssssssssdk
    kssssssssssssssssk
    kssssssssssssssssk
    kssssssssssssssdsk
    kssssssssssssssdsk
    .kssssssssssssdsk.
    ..kssbbbssbbbsdk..
    ..ksskkgssskkgdk..
    ..kssssssdssssdk..
    ..ksskmmmmmmksdk..
    ...kssskwwwksdk...
    ....kddddddddk....
    ......kssssk......
  `;
  var NI_TORSO = `
    ..kkkkkkkkkk..
    .kyyyyyyyyxyk.
    kyyyyyyyyxyyyk
    kyyyyyyyxyyyyk
    kyyyyyyxyyyyyk
    kyyyyyxyyyyyyk
    kYyyyxyyyyyyYk
    kYyyxyyyyyyyYk
    kYYxyyyyyyyYYk
    .kxYYYYYYYYYk.
    .kjjjjjjjjjjk.
    ..kkkkkkkkkk..
  `;
  var NI_ARM = `
    .kkk.
    kyyyk
    kyyyk
    kYYYk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var NI_LEG = `
    .kkk.
    kjjjk
    kjjjk
    kjJjk
    kjjjk
    .kjk.
    .kjk.
    knnnk
    kNNNk
  `;

  /* ---------------------------------------------------------------
     SONNET — Boss in Level 21. Airsoft seit acht Jahren. Dunkle Locken,
     oben viel, an den Seiten kurz, duenner Schnurrbart. Tarnhemd,
     sandfarbener Plattentraeger mit Magazintaschen (und einem orangen
     Funkgeraet), Tuerkei-Patch am Arm. Die M4 zeichnet bosse-Code dazu.
     --------------------------------------------------------------- */

  palette('sonnet', {
    k: '#141018',
    h: '#1a120c', H: '#3a2818',            // Locken
    s: '#f0c29c', d: '#d09a74',
    w: '#ffffff', g: '#3a2616', m: '#8a3a34', j: '#2a1a10',
    c: '#9a9068', C: '#6a6e44', v: '#c2b48a', n: '#7a5a3a',   // Tarnmuster
    p: '#b8a47a', P: '#8c7a54', x: '#5a4a32',                  // Plattentraeger
    t: '#ff8a2a',                                              // Funkgeraet
    r: '#d8282e', y: '#f4f4ee',                                // Tuerkei-Patch
    b: '#1c1c20', e: '#6a5236', E: '#4a3a26'
  });

  var SO_HEAD = `
    ..hHh.hhH.hh..
    .hhhhHhhhhhHh.
    hhHhhhhHhhhhhh
    hhhhhhhhhHhhhh
    khhHhhhhhhhhhk
    khhssssssshhhk
    khssssssssssdk
    khsgwssssgwsdk
    khssssdsssssdk
    khssjjjjjjssdk
    khsssmmmmsssdk
    .kssssssssssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var SO_HEAD_GRIN = `
    ..hHh.hhH.hh..
    .hhhhHhhhhhHh.
    hhHhhhhHhhhhhh
    hhhhhhhhhHhhhh
    khhHhhhhhhhhhk
    khhssssssshhhk
    khssssssssssdk
    khskksssskksdk
    khssssdsssssdk
    khssjjjjjjssdk
    khskwwwwwwksdk
    .kssmmmmmmssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var SO_HEAD_HURT = `
    ..hHh.hhH.hh..
    .hhhhHhhhhhHh.
    hhHhhhhHhhhhhh
    hhhhhhhhhHhhhh
    khhHhhhhhhhhhk
    khhssssssshhhk
    khssssssssssdk
    khskskssksksdk
    khssssdsssssdk
    khssjjjjjjssdk
    khssskmmksssdk
    .kssssssssssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var SO_HEAD_RAGE = `
    ..hHh.hhH.hh..
    .hhhhHhhhhhHh.
    hhHhhhhHhhhhhh
    hhhhhhhhhHhhhh
    khhHhhhhhhhhhk
    khkksssssskkhk
    khssssssssssdk
    khsgwssssgwsdk
    khssssdsssssdk
    khssjjjjjjssdk
    khsskwwwwkssdk
    .kssssssssssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var SO_TORSO = `
    ..kkkkkkkk..
    .kcCkkkkCck.
    kcCxppppxCck
    kcvpppppppck
    kCpPPpPPptCk
    kcpPPpPPptck
    kvppppppppvk
    kCPPPPPPPPCk
    kcCnccvCcnck
    .kCcnCcvcCk.
    .kbbbbbbbbk.
    ..kkkkkkkk..
  `;
  var SO_ARM = `
    .kkk.
    kcCvk
    kvcnk
    kCcvk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  // Vorne am Arm: der Tuerkei-Patch. Rot, mit weissem Halbmond.
  var SO_ARM_F = `
    .kkk.
    krrrk
    kryrk
    kCcvk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var SO_LEG = `
    .kkk.
    kcCck
    kvcCk
    kCnck
    kccvk
    .kCk.
    .kck.
    keeek
    kEEEk
  `;

  /* ---------------------------------------------------------------
     EMRE — Sonnets Cousin, Pizzeria Vesuvio. Kochmuetze, grosser
     Schnurrbart, rotes Halstuch, Schuerze.
     --------------------------------------------------------------- */

  palette('emre', {
    k: '#141018', h: '#2a1a12', s: '#e2ae84', d: '#c48c62',
    w: '#ffffff', W: '#d8dce4', g: '#3a2616', m: '#8a3a34', j: '#2a1a12',
    r: '#d8282e', a: '#f4f2ec', b: '#24242c', B: '#16161c', n: '#1c1c20', N: '#3a3a44'
  });
  var EM_HEAD = `
    ...kkkkkkkk...
    ..kwwwwwwwwk..
    ..kwwWwwWwwk..
    ..kwwwwwwwwk..
    ..kWWWWWWWWk..
    .khhhhhhhhhhk.
    khhssssssshhhk
    khsgwssssgwsdk
    khssssdsssssdk
    khsjjjjjjjjsdk
    khsssmmmmsssdk
    .kssssssssssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var EM_HEAD_GRIN = `
    ...kkkkkkkk...
    ..kwwwwwwwwk..
    ..kwwWwwWwwk..
    ..kwwwwwwwwk..
    ..kWWWWWWWWk..
    .khhhhhhhhhhk.
    khhssssssshhhk
    khskksssskksdk
    khssssdsssssdk
    khsjjjjjjjjsdk
    khskwwwwwwksdk
    .kssmmmmmmssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var EM_TORSO = `
    ..kkkkkkkk..
    .kwwrrrrwwk.
    kwwwwrrwwwwk
    kwwkwwwwkwwk
    kwwwwwwwwwwk
    kWwkwwwwkwWk
    kWwwwwwwwwWk
    kaaaaaaaaaak
    kaaaaaaaaaak
    .kaaaaaaaak.
    .kbbbbbbbbk.
    ..kkkkkkkk..
  `;
  var EM_ARM = `
    .kkk.
    kwwwk
    kwwwk
    kWWWk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var EM_LEG = `
    .kkk.
    kbbbk
    kbbbk
    kbBbk
    kbbbk
    .kbk.
    .kbk.
    knnnk
    kNNNk
  `;

  /* ---------------------------------------------------------------
     MIRKAN — zu Fuss (beim Airsoft). Sonst sitzt er immer im Mercedes.
     Haar nach oben, Fade, Vollbart. Komplett in Weiss: Trainingsanzug,
     weisse Schuhe. Im Wald. Der normale Kopf ist 'mirkan_head'
     (sprites.js), hier die anderen Gesichter.
     --------------------------------------------------------------- */

  palette('mirkan', {
    k: '#12101a', h: '#1e1712', H: '#382a20', j: '#241c15',
    s: '#e8ac7e', d: '#c2865c', w: '#ffffff', g: '#3a2a1a', m: '#7d2724',
    t: '#8ad0ff',                                              // Traenen
    a: '#f4f4f8', A: '#d0d4e0', n: '#8a90a0', G: '#5a5a66'      // der Anzug
  });
  // Stolz: Augen zu, breites Grinsen
  var MI_HEAD_GRIN = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhHhhhhhhHhhk
    kkhssssssssHhk
    .khssssssssshk
    .khskksskksdk.
    .khsssdssssdk.
    .khjjjjjjjjdk.
    .khjkwwwwkjdk.
    .kdjkmmmmkjdk.
    ..kdjjjjjjdk..
    ...kddddddk...
  `;
  // Getroffen: Augen zugekniffen, Mund offen
  var MI_HEAD_HURT = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhHhhhhhhHhhk
    kkhssssssssHhk
    .khskksskksshk
    .khssksskssdk.
    .khsssdssssdk.
    .khjjjjjjjjdk.
    .khjjkmmkjjdk.
    .kdjjkmmkjjdk.
    ..kdjjkkjjdk..
    ...kddddddk...
  `;
  // Weint: Augen zu, Traenen laufen, Mund weit auf
  var MI_HEAD_CRY = `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhHhhhhhhHhhk
    kkhssssssssHhk
    .khskssssksshk
    .khskksskksdk.
    .khstsdsstsdk.
    .khjtjjjjtjdk.
    .khtkmmmmktdk.
    .kdtkmmmmkjdk.
    ..kdjkkkkjdk..
    ...kddddddk...
  `;
  var MI_TORSO = `
    ..kkkkkkkk..
    .kaaannaaak.
    kaaaannaaaak
    kaaaanaaaaak
    kaAaanaaaAak
    kaAaanaaaAak
    kaaaanaaaaak
    kaAaanaaaAak
    kaAaanaaaAak
    .kAAAnAAAAk.
    .kAAAAAAAAk.
    ..kkkkkkkk..
  `;
  var MI_ARM = `
    .kkk.
    kaaAk
    kaaAk
    kanAk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var MI_LEG = `
    .kkk.
    kaaAk
    kanAk
    kanAk
    kanAk
    .kak.
    .kAk.
    kaaak
    kGGGk
  `;

  /* ---------------------------------------------------------------
     FELIX — Pilot (Level 26). Kapitaensmuetze, weisses Hemd mit
     goldenen Schulterklappen. Die Augen halb zu und rot. Er ist
     muede. Sagt er.
     --------------------------------------------------------------- */

  /* Nach dem Foto: hellblonde Haare, breites Grinsen, schwarzer Hoodie
     mit weissem Schriftzug, graue Jogginghose. Die Kapitaensmuetze
     behaelt er auf — sonst glaubt ihm keiner, dass er der Pilot ist. */
  palette('felix', {
    k: '#141018', c: '#1c2448', y: '#e8c24a', h: '#f0d890', H: '#c8a860',
    s: '#f6cca8', d: '#dca482', r: '#e86a6a', w: '#ffffff', W: '#d8dce4',
    j: '#b89070', m: '#8a3a34', n: '#1c1c22', N: '#0e0e12', t: '#f4f4f0', R: '#d8282e',
    g: '#b8bcc6', G: '#9a9ea8', b: '#f4f4f0', B: '#c8ccd6'
  });
  var FE_HEAD = `
    ...kkkkkkkk...
    ..kccccccccck.
    ..kcccyyyccck.
    .kkkkkkkkkkkkk
    khhhhHssssshhk
    khhsssssssshk.
    kkskksssskksdk
    khsrwssssrwsdk
    khssssdsssssdk
    khsjsssssssjdk
    .ksjkwwwwkjsk.
    .kssjjjjjjssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var FE_HEAD_GRIN = FE_HEAD.replace('khsrwssssrwsdk', 'khskkssssskkdk')
                            .replace('.ksjkwwwwkjsk.', '.ksjkwwwwwkjk.')
                            .replace('.kssjjjjjjssk.', '.kssjmmmmmjsk.');
  var FE_HEAD_HURT = FE_HEAD.replace('khsrwssssrwsdk', 'khskskssksksdk')
                            .replace('.ksjkwwwwkjsk.', '.ksjskmmksjsk.');
  var FE_TORSO = `
    ..kkkkkkkk..
    .knnnwwnnnk.
    knnnnwwnnnnk
    knnnnwnnwnnk
    kntttRttttnk
    knnnnnnnnnnk
    knNnnnnnnNnk
    knnnnnnnnnnk
    knNnnnnnnNnk
    .knnnnnnnnk.
    .kggggggggk.
    ..kkkkkkkk..
  `;
  var FE_ARM = `
    .kkk.
    knnNk
    knnNk
    knnNk
    knnnk
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var FE_LEG = `
    .kkk.
    kgggk
    kgggk
    kgGgk
    kgggk
    .kgk.
    .kgk.
    kbbbk
    kBBBk
  `;

  /* FELIX DOGG — nach dem Riesenjoint. Zoepfe, runde Sonnenbrille,
     Bandana, Trikot, Goldkette. Laid back. */
  palette('felixdogg', {
    k: '#141018', h: '#e8cc80', b: '#2a5ab8', w: '#ffffff', g: '#1c1c24',
    s: '#f0c29c', d: '#d09a74', j: '#6a4a30', m: '#8a3a34',
    J: '#2a4a9a', y: '#ffd257', Y: '#fff0a8', a: '#6a8ac8', A: '#4a6aa8', W: '#d8dce4'
  });
  var FD_HEAD = `
    ...kkkkkkkk...
    ..kbbbbbbbbk..
    .kbbwbbbbwbbk.
    .kkkkkkkkkkkk.
    khhssssssssshk
    khsssssssssshk
    khkkkkksskkkhk
    khkwggkkwggkhk
    khskkkskkkkshk
    khssssdssssshk
    khsjjssssjjshk
    khsjkmmmmkjshk
    khssjjjjjjsshk
    hk.kddddddk.kh
    hk..kssssk..kh
    hk..........kh
    .k..........k.
  `;
  var FD_HEAD_GRIN = FD_HEAD.replace('khsjkmmmmkjshk', 'khsjkwwwwkjshk');
  var FD_TORSO = `
    ..kkkkkkkk..
    .kJwyyyywJk.
    kJJwJyyJwJJk
    kJJJJyyJJJJk
    kJJJJYYJJJJk
    kJJwwwwwwJJk
    kJJJJwwJJJJk
    kJJJJwwJJJJk
    kJJJJJJJJJJk
    .kJJJJJJJJk.
    .kaaaaaaaak.
    ..kkkkkkkk..
  `;
  var FD_ARM = `
    .kkk.
    kJJJk
    ksssk
    ksssk
    .kk..
    .ksk.
    kwwwk
    kssdk
    .kkk.
  `;
  var FD_LEG = `
    .kkk.
    kaaak
    kaaak
    kaAak
    kaaak
    kaaak
    .kak.
    kwwwk
    kWWWk
  `;

  /* Die Rezeptionistin im Hotel in Beyoglu. Dutt, Blazer, Namensschild. */
  palette('rezeption', {
    k: '#141018', h: '#2a1a14', s: '#e8b48c', d: '#c8906a', g: '#3a2616', w: '#ffffff',
    m: '#c8283a', r: '#6a1e2e', R: '#4a1420', y: '#e8c24a', b: '#1c1c24'
  });
  var RZ_HEAD = `
    ....kkkkkk....
    ...khhhhhhk...
    ..khhhhhhhhk..
    .khhhhhhhhhhk.
    .khhssssssshk.
    .khsssssssssk.
    khsgwssssgwshk
    khssssdssssshk
    khsssmmmmsssk.
    .khssssssssk..
    .khkddddddk...
    ....kssssk....
  `;
  var RZ_HEAD_GRIN = RZ_HEAD.replace('khsgwssssgwshk', 'khskkssssskkhk')
                            .replace('khsssmmmmsssk.', 'khsskwwwwkssk.');
  var RZ_TORSO = `
    ..kkkkkkkk..
    .krrwwwwrrk.
    krrrwwwwrrrk
    krrrrwwrryrk
    krrrrwwrrrrk
    krRrrwwrrRrk
    krrrrrrrrrrk
    krRrrrrrrRrk
    krrrrrrrrrrk
    .krrrrrrrrk.
    .kbbbbbbbbk.
    ..kkkkkkkk..
  `;
  var RZ_ARM = `
    .kkk.
    krrRk
    krrRk
    krrRk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var RZ_LEG = `
    .kkk.
    kbbbk
    kbbbk
    kbbbk
    kbbbk
    .ksk.
    .ksk.
    kbbbk
    kbbbk
  `;

  /* Der Fischbrot-Mann unter der Galata-Bruecke: Schiebermuetze,
     Schnurrbart, weisse Schuerze ueber dem blauen Hemd. */
  palette('balikci', {
    k: '#141018', c: '#4a4034', h: '#2a1a12', s: '#d8a07a', d: '#b8805a', g: '#3a2616',
    w: '#ffffff', j: '#2a1a12', m: '#8a3a34', b: '#2a4a8a', a: '#f4f2ec', A: '#c8c4bc', n: '#2a2a34'
  });
  var BA_HEAD = `
    ...kkkkkkkk...
    ..kccccccccck.
    .kccccccccccck
    ..kkkkkkkkkkk.
    .khhssssssshk.
    khsgwssssgwsdk
    khssssdsssssdk
    khjjjjjjjjjjdk
    khsssmmmmsssdk
    .kssssssssssk.
    ..kddddddddk..
    ....kssssk....
  `;
  var BA_HEAD_GRIN = BA_HEAD.replace('khsgwssssgwsdk', 'khskkssssskkdk')
                            .replace('khsssmmmmsssdk', 'khsskwwwwkssdk');
  var BA_TORSO = `
    ..kkkkkkkk..
    .kbbbbbbbbk.
    kbbbbbbbbbbk
    kbaaaaaaaabk
    kbaaaaaaaabk
    kbaaaaaaaabk
    kbaaAaaAaabk
    kbaaaaaaaabk
    kbaaaaaaaabk
    .kaaaaaaaak.
    .kAAAAAAAAk.
    ..kkkkkkkk..
  `;
  var BA_ARM = `
    .kkk.
    kbbbk
    kbbbk
    kbbbk
    .kk..
    .ksk.
    kssdk
    kssdk
    .kkk.
  `;
  var BA_LEG = `
    .kkk.
    knnnk
    knnnk
    knnnk
    knnnk
    .knk.
    .knk.
    kkkkk
    kkkkk
  `;

  /* SEMIH BALCI — der grosse Bruder. Nach dem Foto: breit und kraeftig,
     kurze schwarze Haare, oben hochgestylt, kurzer Bart am Kinn. Offenes
     schwarzes Kurzarmhemd ueber weissem T-Shirt, schwarze Hose, eine
     goldene Uhr. Er ist groesser als alle anderen — auch im Pixel. */
  palette('semih', {
    k: '#141018', h: '#1a1410', H: '#3e3226', s: '#e0ac84', d: '#c08862',
    e: '#2a1a12', w: '#ffffff', B: '#6a5040', b: '#241a14', m: '#7a2e2a', r: '#ff3a2a',
    n: '#1c1c22', N: '#0c0c10', t: '#f4f4f0', T: '#d0d2d8', p: '#18181c', P: '#2c2c34',
    g: '#e8c24a', c: '#22222a', o: '#e8e8ec'
  });
  var SE_HEAD = `
    ....kkkkkkkk....
    ...khhhhHHhhk...
    ..khhhhhhhhhHk..
    ..khhhhhhhhhhk..
    .khhhhhhhhhhhhk.
    .khhsssssssshhk.
    .khskksssskkshk.
    kdsswesssswessdk
    kdssssssdsssssdk
    kdsssBBBBBBsssdk
    kdssBkmmmmkBssdk
    .kdsBbbbbbbBsdk.
    .kddbbbbbbbbddk.
    ..kkdbbbbbbdkk..
    ....kssssssk....
  `;
  var SE_HEAD_GRIN = SE_HEAD.replace('kdssBkmmmmkBssdk', 'kdssBkwwwwkBssdk');
  var SE_HEAD_WUT = SE_HEAD.replace('.khskksssskkshk.', '.khsskkssskkshk.')
                           .replace('kdsswesssswessdk', 'kdsswrsssswrssdk')
                           .replace('kdssBkmmmmkBssdk', 'kdssBkkmmkkBssdk');
  var SE_HEAD_HURT = SE_HEAD.replace('kdsswesssswessdk', 'kdsskksssskkssdk')
                            .replace('kdssBkmmmmkBssdk', 'kdssBkmkkmkBssdk');
  var SE_TORSO = `
    ....kkkkkkkkkk....
    ..kknnnnttnnnnkk..
    .knnnnnttttnnnnnk.
    knnnnnttttttnnnnnk
    knnnNnttttttnNnnnk
    knnnNttttttttNnnnk
    knnnNttttttttTNnnk
    knnNttttttttttNnnk
    knnNtttttttttTNnnk
    knnNTttttttttTNnnk
    .knNTTttttttTTNnk.
    .kppkTTTTTTTTkppk.
    .kppppppggppppppk.
    ..kkkkkkkkkkkkkk..
  `;
  var SE_ARM = `
    .kkkk.
    knnnNk
    knnnNk
    knnnNk
    kNNNNk
    ksssdk
    ksssdk
    ksssdk
    kgggdk
    ksssdk
    .kkkk.
  `;
  var SE_LEG = `
    .kkkkk.
    kpppppk
    kpppppk
    kpPpppk
    kpppppk
    kpppppk
    .kpppk.
    .kpppk.
    kccccck
    koooook
  `;

  /* ---------------------------------------------------------------
     RÜMPFE
     --------------------------------------------------------------- */

  // Yusuf: 20 breit. Schmale Schultern, runder Bauch.
  // Offene Jeansjacke, weisser Pulli spannt darunter.
  var TORSO_FAT = `
    ...kkkkkkkkkkkkkk...
    ..krrrrrrrrrrrrrrk..
    ..krrrryyyyyyrrrrk..
    .krrrryyyyyyyyrrrrk.
    .krrryyyyyyyyyyrrrk.
    krrryyyyyyyyyyyyrrrk
    krrryyyyyyyyyyyyrrrk
    krRryyyyyyyyyyyyrRrk
    kRrryyyyyyyyyyyyrrRk
    kRRryyyyyyyyyyyyrRRk
    .kYyyyyyyyyyyyyyYk..
    ..kYYYYYYYYYYYYYk...
  `;

  // Huseyin: 8 breit. Lederjacke, Silberkette, kein Gramm zu viel.
  var TORSO_THIN = `
    ..kkkk..
    .krrrrk.
    krrRRrrk
    krRyyRrk
    krRRRRrk
    krRRRRrk
    krRRRRrk
    kRRRRRRk
    kRRRRRRk
    .kRRRRk.
    .kdssdk.
    ..kkkk..
  `;

  /* ---------------------------------------------------------------
     ARME & BEINE
     --------------------------------------------------------------- */

  var ARM_FAT = `
    .kkkk.
    krrrrk
    krrrrk
    kRRRRk
    .kssk.
    kssddk
    kssddk
    .kkkk.
  `;

  var ARM_THIN = `
    .kk.
    krrk
    krrk
    kRRk
    .kk.
    .ksk
    ksdk
    ksdk
    .kk.
  `;

  var LEG_FAT = `
    .kkkkk.
    kbbbbbk
    kbbbbbk
    kbBBBbk
    kbbbbbk
    .kbbbk.
    knnnnnk
    kNNNNNk
  `;

  var LEG_THIN = `
    .kk.
    kbbk
    kbbk
    kBBk
    kbbk
    .kk.
    .kk.
    knnk
    kNNk
  `;

  def('y_head', Y_HEAD, 'yusuf');
  def('y_head_laugh', Y_HEAD_LAUGH, 'yusuf');
  def('y_head_hurt', Y_HEAD_HURT, 'yusuf');
  def('y_head_sleep', Y_HEAD_SLEEP, 'yusuf');
  def('y_head_eat', Y_HEAD_EAT, 'yusuf');
  def('y_head_growl', Y_HEAD_GROWL, 'yusuf');
  def('y_head_smoke', Y_HEAD_SMOKE, 'yusuf');
  def('y_torso', TORSO_FAT, 'yusuf');
  def('y_arm', ARM_FAT, 'yusuf');
  def('y_leg', LEG_FAT, 'yusuf');

  def('e_head', E_HEAD, 'esat');
  def('e_head_grin', E_HEAD_GRIN, 'esat');
  def('e_head_hurt', E_HEAD_HURT, 'esat');
  def('e_head_rage', E_HEAD_RAGE, 'esat');
  def('e_torso', E_TORSO, 'esat');
  def('e_arm', E_ARM, 'esat');
  def('e_leg', E_LEG, 'esat');
  def('e_torso_buff', E_TORSO_BUFF, 'esat');
  def('e_arm_buff', E_ARM_BUFF, 'esat');
  def('e_leg_buff', E_LEG_BUFF, 'esat');

  def('a_head', A_HEAD, 'alex');
  def('a_head_angry', A_HEAD_ANGRY, 'alex');
  def('a_head_drunk', A_HEAD_DRUNK, 'alex');
  def('a_head_hurt', A_HEAD_HURT, 'alex');
  def('a_torso', A_TORSO, 'alex');
  def('a_arm', A_ARM, 'alex');
  def('a_leg', A_LEG, 'alex');

  def('b_head', B_HEAD, 'broke');
  def('b_head_grin', B_HEAD_GRIN, 'broke');
  def('b_head_hurt', B_HEAD_HURT, 'broke');
  def('b_head_rage', B_HEAD_RAGE, 'broke');
  def('b_torso', B_TORSO, 'broke');
  def('b_arm', B_ARM, 'broke');
  def('b_leg', B_LEG, 'broke');

  def('ha_head', HA_HEAD, 'hamza');
  def('ha_head_grin', HA_HEAD_GRIN, 'hamza');
  def('ha_head_hurt', HA_HEAD_HURT, 'hamza');
  def('ha_head_rage', HA_HEAD_RAGE, 'hamza');
  def('ha_torso', HA_TORSO, 'hamza');
  def('ha_arm', HA_ARM, 'hamza');
  def('ha_leg', HA_LEG, 'hamza');

  def('ge_head', GE_HEAD, 'georgios');
  def('ge_head_grin', GE_HEAD_GRIN, 'georgios');
  def('ge_head_hurt', GE_HEAD_HURT, 'georgios');
  def('ge_head_rage', GE_HEAD_RAGE, 'georgios');
  def('ge_torso', GE_TORSO, 'georgios');
  def('ge_arm', GE_ARM, 'georgios');
  def('ge_leg', GE_LEG, 'georgios');

  def('sp_head', SP_HEAD, 'sparta');
  def('sp_head_rage', SP_HEAD_RAGE, 'sparta');
  def('sp_torso', SP_TORSO, 'sparta');
  def('sp_arm', SP_ARM, 'sparta');
  def('sp_leg', SP_LEG, 'sparta');

  def('ag_head', AG_HEAD, 'alexg');
  def('ag_head_angry', AG_HEAD_ANGRY, 'alexg');
  def('ag_head_hurt', AG_HEAD_HURT, 'alexg');
  def('ag_head_bare', AG_HEAD_BARE, 'alexg');
  def('ag_torso', AG_TORSO, 'alexg');
  def('ag_arm', AG_ARM, 'alexg');
  def('ag_leg', AG_LEG, 'alexg');

  def('ni_head', NI_HEAD, 'nils');
  def('ni_head_grin', NI_HEAD_GRIN, 'nils');
  def('ni_head_hurt', NI_HEAD_HURT, 'nils');
  def('ni_head_sleep', NI_HEAD_SLEEP, 'nils');
  def('ni_head_genie', NI_HEAD_GENIE, 'nils');
  def('ni_torso', NI_TORSO, 'nils');
  def('ni_arm', NI_ARM, 'nils');
  def('ni_leg', NI_LEG, 'nils');

  def('so_head', SO_HEAD, 'sonnet');
  def('so_head_grin', SO_HEAD_GRIN, 'sonnet');
  def('so_head_hurt', SO_HEAD_HURT, 'sonnet');
  def('so_head_rage', SO_HEAD_RAGE, 'sonnet');
  def('so_torso', SO_TORSO, 'sonnet');
  def('so_arm', SO_ARM, 'sonnet');
  def('so_arm_f', SO_ARM_F, 'sonnet');
  def('so_leg', SO_LEG, 'sonnet');

  def('em_head', EM_HEAD, 'emre');
  def('em_head_grin', EM_HEAD_GRIN, 'emre');
  def('em_torso', EM_TORSO, 'emre');
  def('em_arm', EM_ARM, 'emre');
  def('em_leg', EM_LEG, 'emre');

  def('mi_head_grin', MI_HEAD_GRIN, 'mirkan');
  def('mi_head_hurt', MI_HEAD_HURT, 'mirkan');
  def('mi_head_cry', MI_HEAD_CRY, 'mirkan');
  def('mi_torso', MI_TORSO, 'mirkan');
  def('mi_arm', MI_ARM, 'mirkan');
  def('mi_leg', MI_LEG, 'mirkan');

  def('fe_head', FE_HEAD, 'felix');
  def('fe_head_grin', FE_HEAD_GRIN, 'felix');
  def('fe_head_hurt', FE_HEAD_HURT, 'felix');
  def('fe_torso', FE_TORSO, 'felix');
  def('fe_arm', FE_ARM, 'felix');
  def('fe_leg', FE_LEG, 'felix');
  def('fd_head', FD_HEAD, 'felixdogg');
  def('fd_head_grin', FD_HEAD_GRIN, 'felixdogg');
  def('fd_torso', FD_TORSO, 'felixdogg');
  def('fd_arm', FD_ARM, 'felixdogg');
  def('fd_leg', FD_LEG, 'felixdogg');
  def('rz_head', RZ_HEAD, 'rezeption');
  def('rz_head_grin', RZ_HEAD_GRIN, 'rezeption');
  def('rz_torso', RZ_TORSO, 'rezeption');
  def('rz_arm', RZ_ARM, 'rezeption');
  def('rz_leg', RZ_LEG, 'rezeption');
  def('ba_head', BA_HEAD, 'balikci');
  def('ba_head_grin', BA_HEAD_GRIN, 'balikci');
  def('ba_torso', BA_TORSO, 'balikci');
  def('ba_arm', BA_ARM, 'balikci');
  def('ba_leg', BA_LEG, 'balikci');
  def('se_head', SE_HEAD, 'semih');
  def('se_head_grin', SE_HEAD_GRIN, 'semih');
  def('se_head_wut', SE_HEAD_WUT, 'semih');
  def('se_head_hurt', SE_HEAD_HURT, 'semih');
  def('se_torso', SE_TORSO, 'semih');
  def('se_arm', SE_ARM, 'semih');
  def('se_leg', SE_LEG, 'semih');

  /* Yusuf beim Airsoft: Schutzbrille (Pflicht!) und eine Weste, die
     vorne nicht zugeht. Gebaut aus den normalen Teilen: in den Koepfen
     ersetzt die Brille die Augenpartie, am Rumpf wird die Jeansjacke
     zur sandfarbenen Weste. */
  var BRILLE = ['khkkkkkkkkkkdk', 'khkqqqkkqqqkdk'];
  function mitBrille(src) {
    var rows = art(src);
    rows[5] = BRILLE[0];
    rows[6] = BRILLE[1];
    return rows;
  }
  palettes.yusuf.q = '#8ad0ff';
  palettes.yusuf.p = '#b8a47a';
  palettes.yusuf.P = '#8c7a54';
  [['y_head_as', Y_HEAD], ['y_head_as_laugh', Y_HEAD_LAUGH], ['y_head_as_hurt', Y_HEAD_HURT],
   ['y_head_as_sleep', Y_HEAD_SLEEP], ['y_head_as_eat', Y_HEAD_EAT],
   ['y_head_as_growl', Y_HEAD_GROWL], ['y_head_as_smoke', Y_HEAD_SMOKE]].forEach(function (h) {
    def(h[0], mitBrille(h[1]), 'yusuf');
  });
  def('y_torso_as', art(TORSO_FAT).map(function (row, i) {
    return (i >= 2 && i <= 9) ? row.replace(/r/g, 'p').replace(/R/g, 'P') : row;
  }), 'yusuf');

  def('h_head', H_HEAD, 'huseyin');
  def('h_head_angry', H_HEAD_ANGRY, 'huseyin');
  def('h_head_hurt', H_HEAD_HURT, 'huseyin');
  def('h_torso', TORSO_THIN, 'huseyin');
  def('h_arm', ARM_THIN, 'huseyin');
  def('h_leg', LEG_THIN, 'huseyin');

  /* ---------------------------------------------------------------
     Figuren-Konfiguration & Posen
     --------------------------------------------------------------- */

  var CHARS = {
    yusuf: {
      heads: { normal: 'y_head', laugh: 'y_head_laugh', hurt: 'y_head_hurt',
               sleep: 'y_head_sleep', eat: 'y_head_eat',
               growl: 'y_head_growl', smoke: 'y_head_smoke' },
      torso: 'y_torso', arm: 'y_arm', leg: 'y_leg',
      headOX: 3, headOY: -11,
      armBackOX: -4, armFrontOX: 18, armOY: 2,
      legLOX: 2, legROX: 11, legOY: 10,
      footY: 18,
      height: 29, width: 20
    },
    // Yusuf beim Airsoft: Schutzbrille und offene Weste
    yusuf_as: {
      heads: { normal: 'y_head_as', laugh: 'y_head_as_laugh', hurt: 'y_head_as_hurt',
               sleep: 'y_head_as_sleep', eat: 'y_head_as_eat',
               growl: 'y_head_as_growl', smoke: 'y_head_as_smoke' },
      torso: 'y_torso_as', arm: 'y_arm', leg: 'y_leg',
      headOX: 3, headOY: -11,
      armBackOX: -4, armFrontOX: 18, armOY: 2,
      legLOX: 2, legROX: 11, legOY: 10,
      footY: 18,
      height: 29, width: 20
    },
    // Sonnet: Locken, Tarnmuster, Plattentraeger. Vorne der Tuerkei-Patch.
    sonnet: {
      heads: { normal: 'so_head', laugh: 'so_head_grin', hurt: 'so_head_hurt',
               sleep: 'so_head', eat: 'so_head_grin', growl: 'so_head_rage',
               rage: 'so_head_rage' },
      torso: 'so_torso', arm: 'so_arm', armFront: 'so_arm_f', leg: 'so_leg',
      headOX: -1, headOY: -12,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 31, width: 12
    },
    // Emre, Pizzeria Vesuvio
    emre: {
      heads: { normal: 'em_head', laugh: 'em_head_grin', hurt: 'em_head',
               sleep: 'em_head', eat: 'em_head_grin', growl: 'em_head', rage: 'em_head' },
      torso: 'em_torso', arm: 'em_arm', leg: 'em_leg',
      headOX: -1, headOY: -12,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 31, width: 12
    },
    // Mirkan zu Fuss (Level 21): weisser Trainingsanzug. Der Kopf ist
    // eine Reihe kuerzer als bei den anderen, darum -11.
    mirkan: {
      heads: { normal: 'mirkan_head', laugh: 'mi_head_grin', hurt: 'mi_head_hurt',
               sleep: 'mi_head_hurt', eat: 'mi_head_grin', growl: 'mi_head_hurt',
               rage: 'mi_head_hurt', cry: 'mi_head_cry' },
      torso: 'mi_torso', arm: 'mi_arm', leg: 'mi_leg',
      headOX: -1, headOY: -11,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 30, width: 12
    },
    // Felix, der Pilot (Level 26) — und nach dem Riesenjoint Felix Dogg
    felix: {
      heads: { normal: 'fe_head', laugh: 'fe_head_grin', hurt: 'fe_head_hurt',
               sleep: 'fe_head_grin', eat: 'fe_head_grin', growl: 'fe_head_hurt', rage: 'fe_head_hurt' },
      torso: 'fe_torso', arm: 'fe_arm', leg: 'fe_leg',
      headOX: -1, headOY: -12,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 31, width: 12
    },
    felix_dogg: {
      heads: { normal: 'fd_head', laugh: 'fd_head_grin', hurt: 'fd_head',
               sleep: 'fd_head_grin', eat: 'fd_head_grin', growl: 'fd_head', rage: 'fd_head' },
      torso: 'fd_torso', arm: 'fd_arm', leg: 'fd_leg',
      headOX: -1, headOY: -12,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 31, width: 12
    },
    rezeption: {
      heads: { normal: 'rz_head', laugh: 'rz_head_grin', hurt: 'rz_head', sleep: 'rz_head',
               eat: 'rz_head_grin', growl: 'rz_head', rage: 'rz_head' },
      torso: 'rz_torso', arm: 'rz_arm', leg: 'rz_leg',
      headOX: -1, headOY: -11,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 30, width: 12
    },
    balikci: {
      heads: { normal: 'ba_head', laugh: 'ba_head_grin', hurt: 'ba_head', sleep: 'ba_head',
               eat: 'ba_head_grin', growl: 'ba_head', rage: 'ba_head' },
      torso: 'ba_torso', arm: 'ba_arm', leg: 'ba_leg',
      headOX: -1, headOY: -11,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 30, width: 12
    },
    // Semih: 18 breit, 34 hoch. Der breiteste Rumpf im ganzen Spiel.
    semih: {
      heads: { normal: 'se_head', laugh: 'se_head_grin', hurt: 'se_head_hurt', sleep: 'se_head_hurt',
               eat: 'se_head_grin', growl: 'se_head_wut', rage: 'se_head_wut' },
      torso: 'se_torso', arm: 'se_arm', leg: 'se_leg',
      headOX: 1, headOY: -13,
      armBackOX: -4, armFrontOX: 16, armOY: 2,
      legLOX: 2, legROX: 9, legOY: 11,
      footY: 21,
      height: 34, width: 18
    },
    // Semih in der letzten Form: rote Augen, immer wuetend
    semih_wut: {
      heads: { normal: 'se_head_wut', laugh: 'se_head_grin', hurt: 'se_head_hurt', sleep: 'se_head_hurt',
               eat: 'se_head_wut', growl: 'se_head_wut', rage: 'se_head_wut' },
      torso: 'se_torso', arm: 'se_arm', leg: 'se_leg',
      headOX: 1, headOY: -13,
      armBackOX: -4, armFrontOX: 16, armOY: 2,
      legLOX: 2, legROX: 9, legOY: 11,
      footY: 21,
      height: 34, width: 18
    },
    huseyin: {
      heads: { normal: 'h_head', laugh: 'h_head_angry', hurt: 'h_head_hurt',
               sleep: 'h_head', eat: 'h_head_angry' },
      torso: 'h_torso', arm: 'h_arm', leg: 'h_leg',
      headOX: -3, headOY: -11,
      armBackOX: -3, armFrontOX: 7, armOY: 2,
      legLOX: 0, legROX: 4, legOY: 10,
      footY: 19,
      height: 30, width: 8
    },
    esat: {
      heads: { normal: 'e_head', laugh: 'e_head_grin', hurt: 'e_head_hurt',
               sleep: 'e_head', eat: 'e_head_grin', growl: 'e_head_rage',
               rage: 'e_head_rage' },
      torso: 'e_torso', arm: 'e_arm', leg: 'e_leg',
      headOX: -1, headOY: -11,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 30, width: 12
    },
    alex: {
      heads: { normal: 'a_head', laugh: 'a_head_angry', hurt: 'a_head_hurt',
               sleep: 'a_head_drunk', eat: 'a_head_drunk', growl: 'a_head_angry',
               rage: 'a_head_angry', drunk: 'a_head_drunk' },
      torso: 'a_torso', arm: 'a_arm', leg: 'a_leg',
      headOX: 0, headOY: -12,
      armBackOX: -3, armFrontOX: 12, armOY: 2,
      legLOX: 2, legROX: 7, legOY: 10,
      footY: 19,
      height: 31, width: 14
    },
    broke: {
      heads: { normal: 'b_head', laugh: 'b_head_grin', hurt: 'b_head_hurt',
               sleep: 'b_head', eat: 'b_head_grin', growl: 'b_head_rage',
               rage: 'b_head_rage' },
      torso: 'b_torso', arm: 'b_arm', leg: 'b_leg',
      headOX: -1, headOY: -11,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 30, width: 12
    },
    hamza: {
      heads: { normal: 'ha_head', laugh: 'ha_head_grin', hurt: 'ha_head_hurt',
               sleep: 'ha_head', eat: 'ha_head_grin', growl: 'ha_head_rage',
               rage: 'ha_head_rage' },
      torso: 'ha_torso', arm: 'ha_arm', leg: 'ha_leg',
      headOX: -1, headOY: -11,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 30, width: 12
    },
    georgios: {
      heads: { normal: 'ge_head', laugh: 'ge_head_grin', hurt: 'ge_head_hurt',
               sleep: 'ge_head', eat: 'ge_head_grin', growl: 'ge_head_rage',
               rage: 'ge_head_rage' },
      torso: 'ge_torso', arm: 'ge_arm', leg: 'ge_leg',
      headOX: -1, headOY: -11,
      armBackOX: -3, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 30, width: 12
    },
    // Georgios ab der Haelfte: Spartaner. Helm, Panzer, Schild, Speer.
    georgios_sparta: {
      heads: { normal: 'sp_head', laugh: 'sp_head_rage', hurt: 'sp_head_rage',
               sleep: 'sp_head', eat: 'sp_head', growl: 'sp_head_rage',
               rage: 'sp_head_rage' },
      torso: 'sp_torso', arm: 'sp_arm', leg: 'sp_leg',
      headOX: -1, headOY: -13,
      armBackOX: -4, armFrontOX: 10, armOY: 2,
      legLOX: 1, legROX: 6, legOY: 10,
      footY: 19,
      height: 32, width: 12
    },
    // Der andere Alex: Georgios' Kumpel. Im Fussball Torwart, spaeter Riese.
    alexg: {
      heads: { normal: 'ag_head', laugh: 'ag_head_angry', hurt: 'ag_head_hurt',
               sleep: 'ag_head', eat: 'ag_head', growl: 'ag_head_angry',
               rage: 'ag_head_angry', bare: 'ag_head_bare' },
      torso: 'ag_torso', arm: 'ag_arm', leg: 'ag_leg',
      headOX: 0, headOY: -12,
      armBackOX: -3, armFrontOX: 12, armOY: 2,
      legLOX: 2, legROX: 7, legOY: 10,
      footY: 19,
      height: 31, width: 14
    },
    // Nils: sehr viel Stirn. Im Genie-Modus noch mehr.
    nils: {
      heads: { normal: 'ni_head', laugh: 'ni_head_grin', hurt: 'ni_head_hurt',
               sleep: 'ni_head_sleep', eat: 'ni_head_grin', growl: 'ni_head_grin',
               rage: 'ni_head_grin' },
      torso: 'ni_torso', arm: 'ni_arm', leg: 'ni_leg',
      headOX: 0, headOY: -13,
      armBackOX: -3, armFrontOX: 12, armOY: 2,
      legLOX: 2, legROX: 7, legOY: 10,
      footY: 19,
      height: 32, width: 14
    },
    nils_genie: {
      heads: { normal: 'ni_head_genie', laugh: 'ni_head_genie', hurt: 'ni_head_hurt',
               sleep: 'ni_head_sleep', eat: 'ni_head_genie', growl: 'ni_head_genie',
               rage: 'ni_head_genie' },
      torso: 'ni_torso', arm: 'ni_arm', leg: 'ni_leg',
      headOX: -2, headOY: -17,
      armBackOX: -3, armFrontOX: 12, armOY: 2,
      legLOX: 2, legROX: 7, legOY: 10,
      footY: 19,
      height: 36, width: 14
    },
    // Esat nach dem Snus: breiter, dickere Arme, immer wuetend
    esat_buff: {
      heads: { normal: 'e_head_rage', laugh: 'e_head_grin', hurt: 'e_head_hurt',
               sleep: 'e_head_rage', eat: 'e_head_grin', growl: 'e_head_rage',
               rage: 'e_head_rage' },
      torso: 'e_torso_buff', arm: 'e_arm_buff', leg: 'e_leg_buff',
      headOX: 2, headOY: -11,
      armBackOX: -5, armFrontOX: 16, armOY: 2,
      legLOX: 3, legROX: 9, legOY: 10,
      footY: 19,
      height: 30, width: 18
    }
  };

  /* Posen: h=Kopf-Versatz, t=Rumpf-Versatz, l*=Beine, a*=Arme [dx,dy] */
  var POSES = {
    // h ist der Versatz des Kopfes ZUSAETZLICH zum Rumpf (t). Beide auf
    // denselben Wert zu setzen verdoppelt die Bewegung — das sieht aus
    // wie Zittern. Darum bewegt sich hier nur der Rumpf.
    idle: [
      { h: 0, t: 0, lL: [0, 0], lR: [0, 0], aB: [0, 0], aF: [0, 0] },
      { h: 0, t: 1, lL: [0, 0], lR: [0, 0], aB: [0, 1], aF: [0, 1] }
    ],
    run: [
      { h: 0, t: 0, lL: [-2, -1], lR: [3, 0], aB: [2, 1], aF: [-3, 0] },
      { h: 0, t: -1, lL: [0, 0], lR: [1, 0], aB: [0, 0], aF: [0, 0] },
      { h: 0, t: 0, lL: [3, 0], lR: [-2, -1], aB: [-3, 0], aF: [2, 1] },
      { h: 0, t: -1, lL: [1, 0], lR: [0, 0], aB: [0, 0], aF: [0, 0] }
    ],
    jump: [{ h: -1, t: 0, lL: [-1, -2], lR: [2, 1], aB: [1, -3], aF: [-2, -3] }],
    fall: [{ h: 1, t: 0, lL: [-2, 1], lR: [3, -1], aB: [2, -4], aF: [-3, -4] }],
    pound: [{ h: 2, t: 1, lL: [1, -3], lR: [0, -3], aB: [3, 2], aF: [-4, 2] }],
    hurt: [{ h: 0, t: 0, lL: [-3, 0], lR: [4, 0], aB: [3, -3], aF: [-4, -3] }],
    duck: [{ h: 4, t: 4, lL: [0, -3], lR: [0, -3], aB: [2, 2], aF: [-2, 2] }],
    sleep: [
      { h: 3, t: 3, lL: [-1, -3], lR: [1, -3], aB: [3, 3], aF: [-3, 3] },
      { h: 4, t: 3, lL: [-1, -3], lR: [1, -3], aB: [3, 3], aF: [-3, 3] }
    ],
    cheer: [
      { h: -1, t: 0, lL: [0, 0], lR: [0, 0], aB: [2, -6], aF: [-2, -6] },
      { h: 0, t: 1, lL: [0, 0], lR: [0, 0], aB: [1, -4], aF: [-1, -4] }
    ],
    // Boxen: Deckung oben, und die Gerade nach vorn
    guard: [
      { h: 0, t: 0, lL: [-1, 0], lR: [2, 0], aB: [5, -6], aF: [2, -6] },
      { h: 0, t: 1, lL: [-1, 0], lR: [2, 0], aB: [5, -5], aF: [2, -5] }
    ],
    punch: [{ h: 0, t: 0, lL: [-2, 0], lR: [3, 0], aB: [5, -5], aF: [8, -5] }],
    // Auf dem Fahrrad: nach vorn gebeugt, Haende am Lenker, Beine treten
    ride: [
      { h: 0, t: 1, lL: [1, -4], lR: [4, -2], aB: [7, -2], aF: [-3, -2] },
      { h: 0, t: 1, lL: [4, -2], lR: [1, -4], aB: [7, -2], aF: [-3, -2] }
    ]
  };

  // Ein Scratch-Canvas, damit Spiegeln & Zeichenreihenfolge einfach bleiben.
  var scratch = document.createElement('canvas');
  scratch.width = 64; scratch.height = 64;
  var sctx = scratch.getContext('2d');
  var ORIGIN_X = 32, ORIGIN_Y = 56; // Fußmitte im Scratch-Canvas

  /**
   * Figur zeichnen. (x, y) = Fußmitte in Weltkoordinaten.
   * opts: {pose, frame, face, flip, flash, flashAlpha, alpha, scale}
   */
  function drawChar(ctx, who, x, y, opts) {
    opts = opts || {};
    var cfg = CHARS[who];
    var frames = POSES[opts.pose || 'idle'] || POSES.idle;
    var p = frames[(opts.frame || 0) % frames.length];

    sctx.clearRect(0, 0, 64, 64);

    var tw = get(cfg.torso).w;
    var tx = ORIGIN_X - Math.floor(tw / 2);
    var ty = ORIGIN_Y - cfg.footY + (p.t || 0);

    draw(sctx, cfg.arm, tx + cfg.armBackOX + p.aB[0], ty + cfg.armOY + p.aB[1], false, true);
    draw(sctx, cfg.leg, tx + cfg.legLOX + p.lL[0], ty + cfg.legOY + p.lL[1], false, true);
    draw(sctx, cfg.leg, tx + cfg.legROX + p.lR[0], ty + cfg.legOY + p.lR[1], false, false);
    draw(sctx, cfg.torso, tx, ty, false, false);
    var headName = cfg.heads[opts.face || 'normal'] || cfg.heads.normal;
    draw(sctx, headName, tx + cfg.headOX, ty + cfg.headOY + (p.h || 0), false, false);
    draw(sctx, cfg.armFront || cfg.arm, tx + cfg.armFrontOX + p.aF[0], ty + cfg.armOY + p.aF[1], false, false);

    if (opts.flash) {
      sctx.save();
      sctx.globalCompositeOperation = 'source-atop';
      sctx.fillStyle = (typeof opts.flash === 'string') ? opts.flash : '#ffffff';
      sctx.globalAlpha = opts.flashAlpha === undefined ? 1 : opts.flashAlpha;
      sctx.fillRect(0, 0, 64, 64);
      sctx.restore();
    }

    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    var sc = opts.scale || 1;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(opts.flip ? -sc : sc, sc);
    ctx.drawImage(scratch, -ORIGIN_X, -ORIGIN_Y);
    ctx.restore();
  }

  global.Pixel = {
    art: art, palette: palette, def: def, get: get,
    draw: draw, drawWhite: drawWhite, drawTint: drawTint, drawChar: drawChar,
    CHARS: CHARS, POSES: POSES, _sprites: sprites
  };

})(window);
