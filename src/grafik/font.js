/* =====================================================================
   font.js — ein von Hand gepixelter 5x7 Bitmap-Font.
   Jede Glyphe: 7 Zeilen à 5 Pixel, '/' trennt die Zeilen.
   Kein Webfont, kein Bild, keine externe Datei. Alles Handarbeit.
   ===================================================================== */
(function (global) {
  'use strict';

  var GW = 5, GH = 7;

  var GLYPHS = {
    ' ': '...../...../...../...../...../...../.....',
    'A': '.###./#...#/#...#/#####/#...#/#...#/#...#',
    'B': '####./#...#/#...#/####./#...#/#...#/####.',
    'C': '.####/#..../#..../#..../#..../#..../.####',
    'D': '####./#...#/#...#/#...#/#...#/#...#/####.',
    'E': '#####/#..../#..../####./#..../#..../#####',
    'F': '#####/#..../#..../####./#..../#..../#....',
    'G': '.###./#...#/#..../#..##/#...#/#...#/.###.',
    'H': '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    'I': '.###./..#../..#../..#../..#../..#../.###.',
    'J': '..###/...#./...#./...#./...#./#..#./.##..',
    'K': '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    'L': '#..../#..../#..../#..../#..../#..../#####',
    'M': '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
    'N': '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    'O': '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    'P': '####./#...#/#...#/####./#..../#..../#....',
    'Q': '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    'R': '####./#...#/#...#/####./#.#../#..#./#...#',
    'S': '.####/#..../#..../.###./....#/....#/####.',
    'T': '#####/..#../..#../..#../..#../..#../..#..',
    'U': '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    'V': '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    'W': '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
    'X': '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    'Y': '#...#/#...#/.#.#./..#../..#../..#../..#..',
    'Z': '#####/....#/...#./..#../.#.../#..../#####',
    'Ä': '.#.#./...../.###./#...#/#####/#...#/#...#',
    'Ö': '.#.#./...../.###./#...#/#...#/#...#/.###.',
    'Ü': '.#.#./...../#...#/#...#/#...#/#...#/.###.',
    'ß': '.###./#...#/#...#/####./#...#/#...#/#.##.',
    '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
    '1': '..#../.##../..#../..#../..#../..#../.###.',
    '2': '.###./#...#/....#/..##./.#.../#..../#####',
    '3': '####./....#/....#/.###./....#/....#/####.',
    '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
    '5': '#####/#..../####./....#/....#/#...#/.###.',
    '6': '.###./#...#/#..../####./#...#/#...#/.###.',
    '7': '#####/....#/...#./..#../.#.../.#.../.#...',
    '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
    '9': '.###./#...#/#...#/.####/....#/#...#/.###.',
    '!': '..#../..#../..#../..#../..#../...../..#..',
    '?': '.###./#...#/....#/..##./..#../...../..#..',
    '.': '...../...../...../...../...../.##../.##..',
    ',': '...../...../...../...../.##../.##../.#...',
    ':': '...../.##../.##../...../.##../.##../.....',
    ';': '...../.##../.##../...../.##../.#.../#....',
    '-': '...../...../...../#####/...../...../.....',
    '_': '...../...../...../...../...../...../#####',
    "'": '..#../..#../...../...../...../...../.....',
    '"': '.#.#./.#.#./...../...../...../...../.....',
    '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
    ')': '.#.../..#../...#./...#./...#./..#../.#...',
    '/': '....#/....#/...#./..#../.#.../#..../#....',
    '+': '...../..#../..#../#####/..#../..#../.....',
    '=': '...../...../#####/...../#####/...../.....',
    '%': '##..#/##.#./..#../.#.../#..##/...##/.....',
    '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
    '<': '...#./..#../.#.../#..../.#.../..#../...#.',
    '>': '.#.../..#../...#./....#/...#./..#../.#...',
    '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....',
    '^': '..#../.###./#...#/...../...../...../.....',
    // Sonderzeichen für HUD & Dialoge
    '@': '.###./#...#/#.###/#.#.#/#.###/#..../.###.', // Honigglas-Ersatz
    '$': '...../.#.#./#####/#####/.###./..#../.....', // Herz
    '&': '...../..#../.###./.###./.###./..#../.....', // Punkt/Kugel
    '|': '...../..#../...#./#####/...#./..#../.....', // Pfeil rechts
    '~': '...../..#../.#.../#####/.#.../..#../.....', // Pfeil links
    '`': '..#../.###./#.#.#/..#../..#../..#../.....', // Pfeil hoch
    '\\':'...../..#../..#../..#../#.#.#/.###./..#..'  // Pfeil runter
  };

  var atlas = null;   // Canvas mit allen Glyphen in Weiß
  var index = {};     // Zeichen -> Spaltenoffset im Atlas
  var tintCache = {}; // Farbe -> eingefärbter Atlas

  function build() {
    var keys = Object.keys(GLYPHS);
    atlas = document.createElement('canvas');
    atlas.width = keys.length * GW;
    atlas.height = GH;
    var ctx = atlas.getContext('2d');
    var img = ctx.createImageData(atlas.width, atlas.height);
    var data = img.data;

    for (var i = 0; i < keys.length; i++) {
      var ch = keys[i];
      var rows = GLYPHS[ch].split('/');
      index[ch] = i * GW;
      for (var y = 0; y < GH; y++) {
        var row = rows[y] || '';
        for (var x = 0; x < GW; x++) {
          if (row.charAt(x) === '#') {
            var p = ((y * atlas.width) + (i * GW + x)) * 4;
            data[p] = 255; data[p + 1] = 255; data[p + 2] = 255; data[p + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function tinted(color) {
    if (tintCache[color]) return tintCache[color];
    var c = document.createElement('canvas');
    c.width = atlas.width; c.height = atlas.height;
    var x = c.getContext('2d');
    x.drawImage(atlas, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    tintCache[color] = c;
    return c;
  }

  /* Typografische Zeichen, die beim Schreiben leicht hineinrutschen,
     auf vorhandene Glyphen abbilden — sonst erscheint ein "?" im Spiel. */
  var ALIAS = {
    '—': '-', '–': '-', '−': '-',   // — – −
    '’': "'", '‘': "'",                   // ’ ‘
    '“': '"', '”': '"', '„': '"',   // “ ” „
    '…': '...', ' ': ' ', '·': '.',  // … NBSP ·
    '×': '*', '•': '.', '→': '|', '←': '~'
  };

  function normalize(str) {
    var s = String(str).toUpperCase();
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += (ALIAS[c] !== undefined) ? ALIAS[c] : c;
    }
    return out;
  }

  /** Breite eines Strings in Pixeln (scale=1). */
  function measure(str, scale, tracking) {
    scale = scale || 1;
    tracking = (tracking === undefined) ? 1 : tracking;
    var s = normalize(str);
    if (!s.length) return 0;
    return (s.length * (GW + tracking) - tracking) * scale;
  }

  /**
   * Text zeichnen.
   * opts: {color, scale, tracking, shadow, shadowColor, align:'left'|'center'|'right', wave}
   */
  function draw(ctx, str, x, y, opts) {
    opts = opts || {};
    if (!atlas) build();
    var scale = opts.scale || 1;
    var tracking = (opts.tracking === undefined) ? 1 : opts.tracking;
    var color = opts.color || '#ffffff';
    var s = normalize(str);
    var w = measure(s, scale, tracking);

    if (opts.align === 'center') x = Math.round(x - w / 2);
    else if (opts.align === 'right') x = Math.round(x - w);
    x = Math.round(x); y = Math.round(y);

    var step = (GW + tracking) * scale;

    if (opts.shadow) {
      var sc = opts.shadowColor || 'rgba(0,0,0,0.65)';
      var off = (opts.shadow === true) ? scale : opts.shadow * scale;
      blit(ctx, s, x + off, y + off, scale, step, tinted(sc), opts);
    }
    blit(ctx, s, x, y, scale, step, tinted(color), opts);
    return w;
  }

  function blit(ctx, s, x, y, scale, step, sheet, opts) {
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var off = index[ch];
      if (off === undefined) { off = index['?']; }
      if (ch === ' ') continue;
      var dy = 0;
      if (opts.wave) {
        dy = Math.round(Math.sin(opts.wave + i * 0.55) * (opts.waveAmp || 1)) * scale;
      }
      ctx.drawImage(sheet, off, 0, GW, GH, x + i * step, y + dy, GW * scale, GH * scale);
    }
  }

  /**
   * Zeilenumbruch auf maxWidth Pixel. Gibt Array von Zeilen zurück.
   */
  function wrap(str, maxWidth, scale, tracking) {
    var words = String(str).split(' ');
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (measure(test, scale, tracking) > maxWidth && cur) {
        lines.push(cur); cur = words[i];
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  global.Font = {
    W: GW, H: GH,
    draw: draw,
    measure: measure,
    wrap: wrap,
    /** Gibt es für dieses Zeichen eine Glyphe? (ß wird zu SS) */
    has: function (ch) {
      var s = normalize(ch);
      for (var i = 0; i < s.length; i++) {
        if (GLYPHS[s.charAt(i)] === undefined) return false;
      }
      return true;
    },
    lineHeight: function (scale) { return (GH + 2) * (scale || 1); }
  };

})(window);
