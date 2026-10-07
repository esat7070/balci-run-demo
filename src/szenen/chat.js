/* =====================================================================
   chat.js — der Gruppenchat zwischen zwei Leveln (Esat, 03.10.: "bringe
   qualitativen Content zwischen den Missionen").

   Nach einem geschafften Level, bevor das naechste anfaengt, schaut Yusuf
   aufs Handy: DIE JUNGS (Esat, Mirkan, Lennart, Erfan und wer sonst noch
   dazukommt) oder FAMILIE BALCI (Huseyin). Die Nachrichten kommen von
   allein nacheinander rein, mit "schreibt..." davor. Sprung zeigt die
   naechste sofort, gehalten ueberspringt er den Chat. Was drinsteht,
   steht in levels.js (CHATS), immer fuer das Level, das gleich anfaengt.

   Eintraege:
     ['esat', 'TEXT']                   Nachricht (yusuf steht rechts)
     ['bild', 'esat', 'BESCHREIBUNG']   ein Foto
     ['sprach', 'lennart', '12:04']     eine Sprachnachricht
     ['system', 'TEXT']                 graue Zeile in der Mitte
   ===================================================================== */
(function (global) {
  'use strict';

  var F = global.Font, P = global.Pixel;
  function S() { return global.Sound; }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  var LEUTE = {
    yusuf: ['YUSUF', '#ffc23c'], esat: ['ESAT', '#6fc8e8'], mirkan: ['MIRKAN', '#b8c0d4'],
    lennart: ['LENNART', '#e8b894'], erfan: ['ERFAN', '#e8c24a'], huseyin: ['HUSEYIN', '#cfd4e0'],
    alex: ['ALEX', '#c9a05a'], broke: ['BROKE', '#d8b07a'], hamza: ['HAMZA', '#ff6a6a'],
    georgios: ['GEORGIOS', '#6a9ae8'], alexg: ['DER ANDERE ALEX', '#cdb88c'], sonnet: ['SONNET', '#c8d86a'],
    emre: ['EMRE', '#f4f2ec'], nils: ['NILS', '#8ae0ff'], mama: ['MAMA', '#ff9ad0'],
    doenermann: ['DÖNERMANN', '#e89a5a'], mika: ['MIKA', '#9ad0ff']
  };
  var BREITE = 236, KOPF = 34;

  function init(chat, fertig) {
    return { type: 'chat', chat: chat, fertig: fertig, t: 0, n: 0, naechste: 40, tippt: null,
             halten: 0, ende: -1, scroll: 0, zeilen: [], hoehe: 0 };
  }

  /** Wie lange man eine Nachricht lesen will, bevor die naechste kommt. */
  function lesezeit(e) {
    var text = e[0] === 'bild' || e[0] === 'sprach' ? e[2] || '' : e[1] || '';
    return Math.max(56, Math.min(130, 30 + text.length * 2));
  }

  /** Eine Nachricht in Zeilen zerlegen und ihre Hoehe merken. */
  function vorbereiten(e) {
    var art = e[0], z = { e: e };
    if (art === 'system') { z.lines = F.wrap(e[1], BREITE - 30, 1, 1); z.h = z.lines.length * 9 + 8; return z; }
    if (art === 'bild') { z.wer = e[1]; z.lines = F.wrap(e[2], BREITE - 84, 1, 1); z.h = 58 + 6; return z; }
    if (art === 'sprach') { z.wer = e[1]; z.lines = []; z.h = 34; return z; }
    z.wer = art;
    z.lines = F.wrap(e[1], BREITE - 66, 1, 1);
    z.h = z.lines.length * 9 + (art === 'yusuf' ? 10 : 19);
    return z;
  }

  function update(G) {
    var k = G.scene, In = global.Input, liste = k.chat.nachrichten;
    k.t++;
    if (In.down('jump') || In.down('confirm')) k.halten++; else k.halten = 0;
    // Gehalten: alles ueberspringen
    if (k.halten > 45 && k.ende < 0) {
      while (k.n < liste.length) k.zeilen.push(vorbereiten(liste[k.n++]));
      k.tippt = null; k.ende = k.t + 20;
    }
    if (k.n < liste.length) {
      var e = liste[k.n];
      var andere = e[0] !== 'yusuf' && e[0] !== 'system';
      // Vor fremden Nachrichten: "schreibt..."
      if (andere && !k.tippt && k.t >= k.naechste - 26) k.tippt = e[0] === 'bild' || e[0] === 'sprach' ? e[1] : e[0];
      var weiter = k.t >= k.naechste || ((In.hit('jump') || In.hit('confirm')) && k.t > 20);
      if (weiter) {
        k.zeilen.push(vorbereiten(e));
        k.n++;
        k.tippt = null;
        k.naechste = k.t + lesezeit(e);
        S().play(e[0] === 'yusuf' ? 'pop' : (e[0] === 'system' ? 'select' : 'plopp'));
        if (k.n >= liste.length) k.ende = k.t + 110;
      }
    } else if (k.ende >= 0 && (k.t >= k.ende || ((In.hit('jump') || In.hit('confirm')) && k.t > k.ende - 90))) {
      k.ende = 1e9;
      if (k.fertig) k.fertig();
    }
    // Nach unten scrollen, wenn es voll wird
    var h = 0;
    for (var i = 0; i < k.zeilen.length; i++) h += k.zeilen[i].h + 4 + (k.zeilen[i].e[0] === 'yusuf' ? 9 : 0);
    k.hoehe = h;
  }

  function avatar(ctx, wer, x, y) {
    var c = (LEUTE[wer] || [wer, '#c8c0d8'])[1];
    rect(ctx, x, y, 14, 14, c);
    rect(ctx, x + 1, y + 1, 12, 12, '#1e1826');
    F.draw(ctx, ((LEUTE[wer] || [wer])[0]).charAt(0), x + 7, y + 3, { color: c, align: 'center' });
  }

  function draw(ctx, G, W, H) {
    var k = G.scene, chat = k.chat, i;
    // Hintergrund: Yusufs Zimmer im Dunkeln, nur das Handy leuchtet
    rect(ctx, 0, 0, W, H, '#0c0912');
    ctx.globalAlpha = 0.18;
    for (i = 0; i < 9; i++) rect(ctx, (i * 71 + 13) % W, (i * 43) % H, 2, 2, '#ffd257');
    ctx.globalAlpha = 1;
    var hx = Math.round(W / 2 - BREITE / 2), hy = 10, hh = H - 20;
    // Licht vom Handy
    if (global.Licht && global.Licht.glow) global.Licht.glow(ctx, W / 2, H / 2, 220, '#3a5aa8', 0.35);
    rect(ctx, hx - 6, hy - 6, BREITE + 12, hh + 12, '#05040a');
    rect(ctx, hx - 4, hy - 4, BREITE + 8, hh + 8, '#2a2632');
    rect(ctx, hx, hy, BREITE, hh, '#141820');
    // Kopfzeile: Gruppe, Uhrzeit
    rect(ctx, hx, hy, BREITE, KOPF, '#1f2a36');
    rect(ctx, hx + 6, hy + 6, 22, 22, chat.farbe || '#2fa86a');
    F.draw(ctx, chat.symbol || (chat.titel || 'CHAT').charAt(0), hx + 17, hy + 13, { color: '#ffffff', align: 'center' });
    F.draw(ctx, chat.titel || 'DIE JUNGS', hx + 34, hy + 7, { color: '#ffffff' });
    var unter = k.tippt ? ((LEUTE[k.tippt] || [k.tippt])[0] + ' SCHREIBT...') : (chat.leute || '');
    while (unter.length > 4 && F.measure(unter, 1, 1) > BREITE - 42) unter = unter.slice(0, -4) + '...';
    F.draw(ctx, unter, hx + 34, hy + 19, { color: k.tippt ? '#8cd85a' : '#8a94a8' });
    F.draw(ctx, chat.zeit || '', hx + BREITE - 6, hy + 7, { color: '#8a94a8', align: 'right' });

    // Nachrichten: unten angeschlagen, aeltere rutschen nach oben raus
    var oben = hy + KOPF + 4, unten = hy + hh - 20;
    ctx.save();
    ctx.beginPath(); ctx.rect(hx, oben, BREITE, unten - oben); ctx.clip();
    var y = Math.min(oben + 4, unten - k.hoehe);
    for (i = 0; i < k.zeilen.length; i++) {
      var z = k.zeilen[i], e = z.e, art = e[0];
      if (art === 'system') {
        var sw = 0; z.lines.forEach(function (l) { sw = Math.max(sw, F.measure(l, 1, 1)); });
        rect(ctx, hx + BREITE / 2 - sw / 2 - 5, y, sw + 10, z.h - 2, '#262c38');
        z.lines.forEach(function (l, n) { F.draw(ctx, l, hx + BREITE / 2, y + 4 + n * 9, { color: '#a8b0c0', align: 'center' }); });
      } else {
        var ich = z.wer === 'yusuf', col = (LEUTE[z.wer] || [z.wer, '#c8c0d8'])[1];
        var bw = 0;
        z.lines.forEach(function (l) { bw = Math.max(bw, F.measure(l, 1, 1)); });
        if (art === 'bild') bw = Math.max(bw, 60) + 0;
        if (art === 'sprach') bw = 112;
        bw = Math.max(bw, art === 'yusuf' ? 10 : F.measure((LEUTE[z.wer] || [z.wer])[0], 1, 1)) + 12;
        var bx = ich ? hx + BREITE - bw - 8 : hx + 26;
        if (!ich) avatar(ctx, z.wer, hx + 7, y + 1);
        rect(ctx, bx, y, bw, z.h, ich ? '#1f5a3c' : '#262c38');
        var ty = y + 4;
        if (!ich) { F.draw(ctx, (LEUTE[z.wer] || [z.wer])[0], bx + 6, ty, { color: col }); ty += 10; }
        if (art === 'bild') {
          rect(ctx, bx + 6, ty, bw - 12, 30, '#3a3448');
          rect(ctx, bx + 8, ty + 18, 10, 10, '#5a5468'); rect(ctx, bx + 16, ty + 12, 14, 16, '#6a6478');
          rect(ctx, bx + bw - 20, ty + 4, 6, 6, '#ffd257');
          F.draw(ctx, 'FOTO', bx + bw / 2, ty + 11, { color: '#c8c0d8', align: 'center' });
          z.lines.forEach(function (l, n) { F.draw(ctx, l, bx + 6, ty + 34 + n * 9, { color: '#e8e4f0' }); });
        } else if (art === 'sprach') {
          rect(ctx, bx + 6, ty + 2, 8, 8, col);
          for (var s = 0; s < 18; s++) {
            var hz = 2 + ((s * 7) % 5) * 1.4;
            rect(ctx, bx + 20 + s * 4, ty + 6 - hz / 2, 2, hz, '#a8b0c0');
          }
          F.draw(ctx, e[2], bx + bw - 6, ty + 2, { color: '#8a94a8', align: 'right' });
        } else {
          z.lines.forEach(function (l, n) { F.draw(ctx, l, bx + 6, ty + n * 9, { color: '#f4f0f8' }); });
        }
        if (ich) F.draw(ctx, 'GELESEN', bx + bw - 4, y + z.h + 1, { color: '#5a7ab8', align: 'right' });
      }
      y += z.h + 4 + (art === 'yusuf' ? 9 : 0);
    }
    // "schreibt..."-Blase
    if (k.tippt) {
      var dy = Math.min(unter - 18, y);
      avatar(ctx, k.tippt, hx + 7, dy + 1);
      rect(ctx, hx + 26, dy, 34, 14, '#262c38');
      for (i = 0; i < 3; i++) {
        var hop = ((G.tick >> 3) + i) % 3 === 0 ? 2 : 0;
        rect(ctx, hx + 33 + i * 8, dy + 6 - hop, 4, 4, '#a8b0c0');
      }
    }
    ctx.restore();
    // Unten: Eingabezeile und Hinweis
    rect(ctx, hx, unten, BREITE, hy + hh - unten, '#1f2a36');
    F.draw(ctx, k.ende >= 0 ? 'SPRUNG = WEITER' : 'SPRUNG WEITER / HALTEN ÜBERSPRINGEN', hx + BREITE / 2, unten + 6,
           { color: '#8a94a8', align: 'center' });
    void P;
  }

  global.Chat = { init: init, update: update, draw: draw, LEUTE: LEUTE };

})(window);
