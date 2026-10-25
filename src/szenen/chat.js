/* =====================================================================
   chat.js — der Gruppenchat zwischen zwei Leveln (Esat, 03.10.: "bringe
   qualitativen Content zwischen den Missionen").

   Esat, 25.10.: "die Handy-Chat-Verlaeufe deutlich animierter machen.
   Yusuf holt das Handy aus der Hosentasche raus, jedes Mal eine andere
   Animation, andere Situation, passend zur vorigen Mission ... First-
   Person ... witziger, jemand sendet ein Bild von sich, auf einer Giraffe".

   Ablauf jeder Szene:
     REIN   (aus Yusufs Sicht) Er steht/liegt/sitzt da, wo das letzte Level
            aufgehoert hat (SZENEN). Das Handy brummt in der Hosentasche, die
            Hand holt es raus, es kommt hoch vors Gesicht, der Bildschirm geht an.
     CHAT   Die Nachrichten kommen von allein nacheinander rein, mit
            "schreibt..." davor. Die Umgebung bleibt hinter dem Handy zu
            sehen, in der anderen Hand ist, was er gerade hat (Honig, Shake,
            Butter ...), und jede Szene hat ihren Gag (die Biene landet auf
            dem Display, der Schweiss tropft ...).
            Fotos sind echte kleine Bilder (MOTIVE).
     RAUS   Das Handy geht wieder runter.
   Sprung zeigt die naechste Nachricht sofort, gehalten ueberspringt er alles.
   Was drinsteht, steht in levels.js (CHATS), immer fuer das Level, das
   gleich anfaengt.

   Eintraege:
     ['esat', 'TEXT']                           Nachricht (yusuf steht rechts)
     ['bild', 'esat', 'BESCHREIBUNG', motiv]    ein Foto (motiv: MOTIVE)
     ['sprach', 'lennart', '12:04']             eine Sprachnachricht
     ['system', 'TEXT']                         graue Zeile in der Mitte
   ===================================================================== */
(function (global) {
  'use strict';

  var F = global.Font, P = global.Pixel;
  function S() { return global.Sound; }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function weich(k) { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k) * (1 - k); }
  function spr(name) { return P && P._sprites && P._sprites[name] ? name : null; }

  var LEUTE = {
    yusuf: ['YUSUF', '#ffc23c'], esat: ['ESAT', '#6fc8e8'], mirkan: ['MIRKAN', '#b8c0d4'],
    lennart: ['LENNART', '#e8b894'], erfan: ['ERFAN', '#e8c24a'], huseyin: ['HUSEYIN', '#cfd4e0'],
    
  };
  var BREITE = 236, KOPF = 34;
  var HAUT = '#f0b487', HAUT_D = '#ce8f66', RAND = '#1b1220';
  var REIN = 150, RAUS = 44;          // Ticks fuers Rausholen und Wegstecken
  var FOTO_W = 116, FOTO_H = 64;

  /* Wo ist Yusuf, wenn das Handy brummt? (Schluessel = Chat = das Level,
     das gleich anfaengt; die Szene passt zum Level davor.)
       ort   Hintergrund (ORTE)
       hand  was er in der anderen Hand hat (HAND)
       gag   was waehrend des Chats passiert (GAGS)
       hose  Farbe der Hose, aus der das Handy kommt */
  var SZENEN = {
    2:  { ort: 'zimmer', hand: 'honig', gag: 'wecker', hose: '#3a4a8a' },
    3:  { ort: 'garten', hand: 'honig', gag: 'biene', hose: '#3a4a8a' },
    4:  { ort: 'gym', hand: 'shaker', gag: 'schweiss', hose: '#2a2a34' },
    5:  { ort: 'kueche', hand: 'butter', gag: 'fett', hose: '#3a4a8a' },
    
  };

  function init(chat, fertig) {
    var id = null;
    var LV = global.Levels;
    if (LV && LV.chats) for (var k in LV.chats) if (LV.chats[k] === chat) id = +k;
    var sz = chat.szene || SZENEN[id] || { ort: 'zimmer', hand: null, gag: null, hose: '#3a4a8a' };
    return { type: 'chat', chat: chat, fertig: fertig, t: 0, n: 0, naechste: REIN + 30, tippt: null,
             halten: 0, ende: -1, raus: -1, zeilen: [], hoehe: 0, sz: sz, id: id,
             gag: { t0: -1, n0: -1 }, wisch: 0, knurr: 0, shake: 0, flecken: [], ichTippt: 0 };
  }

  /** Wie lange man eine Nachricht lesen will, bevor die naechste kommt. */
  function lesezeit(e) {
    var text = e[0] === 'bild' || e[0] === 'sprach' ? e[2] || '' : e[1] || '';
    var t = Math.max(56, Math.min(130, 30 + text.length * 2));
    return e[0] === 'bild' ? t + 30 : t;
  }

  /** Eine Nachricht in Zeilen zerlegen und ihre Hoehe merken. */
  function vorbereiten(e, t) {
    var art = e[0], z = { e: e, t0: t || 0 };
    if (art === 'system') { z.lines = F.wrap(e[1], BREITE - 30, 1, 1); z.h = z.lines.length * 9 + 8; return z; }
    if (art === 'bild') {
      z.wer = e[1]; z.motiv = e[3] || null;
      z.lines = F.wrap(e[2], FOTO_W, 1, 1);
      z.h = (e[1] === 'yusuf' ? 4 : 14) + FOTO_H + 4 + z.lines.length * 9 + 4;
      return z;
    }
    if (art === 'sprach') { z.wer = e[1]; z.lines = []; z.h = 34; return z; }
    z.wer = art;
    z.lines = F.wrap(e[1], BREITE - 66, 1, 1);
    z.h = z.lines.length * 9 + (art === 'yusuf' ? 10 : 19);
    return z;
  }

  function update(G) {
    var k = G.scene, In = global.Input, liste = k.chat.nachrichten;
    k.t++;
    if (k.shake > 0) k.shake--;
    if (k.ichTippt > 0) k.ichTippt--;
    if (In.down('jump') || In.down('confirm')) k.halten++; else k.halten = 0;
    // Wegstecken laeuft: danach ist Schluss
    if (k.raus >= 0) {
      if (++k.raus >= RAUS) { k.raus = 1e9; if (k.fertig) k.fertig(); }
      return;
    }
    // Rausholen: Druecken spult vor
    if (k.t < REIN) {
      if (k.t === 8) S().play('beep');
      if (k.t === 26 || k.t === 44) S().play('beep');
      if (k.t === 92) S().play('whoosh');
      if (k.t === REIN - 12) S().play('klick');
      if (k.t > 12 && (In.hit('jump') || In.hit('confirm'))) { k.t = REIN; k.naechste = REIN + 20; }
      return;
    }
    // Gehalten: alles ueberspringen
    if (k.halten > 45 && k.ende < 0) {
      while (k.n < liste.length) k.zeilen.push(vorbereiten(liste[k.n++], k.t));
      k.tippt = null; k.ende = k.t + 20;
    }
    if (k.n < liste.length) {
      var e = liste[k.n];
      var andere = e[0] !== 'yusuf' && e[0] !== 'system' && !(e[0] === 'bild' && e[1] === 'yusuf');
      // Vor fremden Nachrichten: "schreibt...", vor eigenen tippt Yusuf mit dem Daumen
      if (andere && !k.tippt && k.t >= k.naechste - 26) k.tippt = e[0] === 'bild' || e[0] === 'sprach' ? e[1] : e[0];
      if (!andere && e[0] !== 'system' && k.t >= k.naechste - 24 && k.ichTippt <= 0) k.ichTippt = 24;
      var weiter = k.t >= k.naechste || ((In.hit('jump') || In.hit('confirm')) && k.t > REIN + 10);
      if (weiter) {
        k.zeilen.push(vorbereiten(e, k.t));
        k.n++;
        k.tippt = null;
        k.naechste = k.t + lesezeit(e);
        k.shake = andere ? 6 : 0;
        S().play(e[0] === 'yusuf' || (e[0] === 'bild' && e[1] === 'yusuf') ? 'pop' : (e[0] === 'system' ? 'select' : 'plopp'));
        gagNachricht(k, e);
        if (k.n >= liste.length) k.ende = k.t + 110;
      }
    } else if (k.ende >= 0 && (k.t >= k.ende || ((In.hit('jump') || In.hit('confirm')) && k.t > k.ende - 90))) {
      k.ende = 1e9;
      k.raus = 0;
      S().play('whoosh');
    }
    gagTick(k);
    // Nach unten scrollen, wenn es voll wird
    var h = 0;
    for (var i = 0; i < k.zeilen.length; i++) h += k.zeilen[i].h + 4 + (k.zeilen[i].e[0] === 'yusuf' ? 9 : 0);
    k.hoehe = h;
  }

  /* =====================================================================
     DIE ORTE — was man aus Yusufs Augen sieht (hinter dem Handy)
     ===================================================================== */
  function verlauf(ctx, W, y0, y1, a, b) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
  }
  function figur(ctx, who, x, y, o) {
    o = o || {};
    var sc = o.scale || 1;
    if (who === 'erfan' || who === 'lennart') {
      var name = who === 'erfan' ? 'erfan' : ((o.frame || 0) % 2 ? 'lennart2' : 'lennart');
      if (!spr(name)) return;
      var sp = P.get(name);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(o.flip ? -sc : sc, sc);
      P.draw(ctx, name, -sp.w / 2, -sp.h);
      ctx.restore();
      return;
    }
    if (P.drawChar) P.drawChar(ctx, who, x, y, o);
  }
  function bild(ctx, name, x, y, sc, flip) {
    if (!spr(name)) return;
    var sp = P.get(name);
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(flip ? -(sc || 1) : (sc || 1), sc || 1);
    P.draw(ctx, name, -sp.w / 2, -sp.h, false);
    ctx.restore();
  }
  function schild(ctx, x, y, text, bg, fg) {
    var w = F.measure(text, 1, 1) + 8;
    rect(ctx, x - w / 2, y, w, 11, bg || '#2a2232');
    F.draw(ctx, text, x, y + 2, { color: fg || '#ffd257', align: 'center' });
  }

  var ORTE = {
    zimmer: function (ctx, W, H, t) {
      verlauf(ctx, W, 0, H * 0.62, '#4a3a6a', '#2e2444');
      rect(ctx, 30, 30, 90, 70, '#8ab4e8'); rect(ctx, 30, 30, 90, 70, 'rgba(255,220,160,0.25)');
      rect(ctx, 28, 28, 94, 3, '#e8e0f0'); rect(ctx, 74, 30, 2, 70, '#e8e0f0'); rect(ctx, 28, 98, 94, 3, '#e8e0f0');
      rect(ctx, 400, 40, 60, 80, '#c84a5a'); F.draw(ctx, 'HONIG', 430, 70, { color: '#ffd257', align: 'center' });
      rect(ctx, 0, H * 0.62, W, H, '#5a3a2a');
      // Bettdecke vorne links (mit Honigtupfen)
      rect(ctx, -10, H - 70, 200, 80, '#4a6ad0'); rect(ctx, -10, H - 70, 200, 3, '#7a96f0');
      for (var i = 0; i < 6; i++) rect(ctx, 6 + i * 30, H - 50 + (i % 2) * 14, 4, 3, '#ffc23c');
      // Nachttisch mit Wecker rechts
      rect(ctx, 400, H * 0.62 - 6, 90, 70, '#7a5236'); rect(ctx, 400, H * 0.62 - 6, 90, 4, '#9a6a46');
      bild(ctx, 'wecker', 445, H * 0.62 - 6 + ((t >> 2) % 2 ? -1 : 0), 2);
    },
    garten: function (ctx, W, H, t) {
      verlauf(ctx, W, 0, H * 0.6, '#7ac8f0', '#c8ecff');
      rect(ctx, 0, H * 0.45, W, 40, '#3a8a3a');
      for (var i = 0; i < 12; i++) rect(ctx, i * 46, H * 0.42 - (i % 3) * 6, 40, 30, '#4a9a3a');
      bild(ctx, 'mercedes', 440, H * 0.6, 2) || 0;
      bild(ctx, 'bienenstock', 60, H * 0.62, 2);
      rect(ctx, 0, H * 0.6, W, H, '#5aa83a');
      for (i = 0; i < 20; i++) rect(ctx, (i * 53) % W, H * 0.66 + (i * 17) % 60, 3, 3, ['#ff6a8a', '#ffd257', '#ffffff'][i % 3]);
      for (i = 0; i < 4; i++) {
        var a = t * 0.05 + i * 1.7;
        bild(ctx, (t >> 2) % 2 ? 'biene' : 'biene2', 70 + Math.cos(a) * 40 + i * 6, H * 0.4 + Math.sin(a * 1.3) * 20, 1);
      }
    },
    gym: function (ctx, W, H, t) {
      verlauf(ctx, W, 0, H * 0.6, '#5a5e6a', '#3a3e48');
      for (var i = 0; i < 5; i++) rect(ctx, 10 + i * 104, 26, 90, 90, '#7a8a9a');
      for (i = 0; i < 5; i++) rect(ctx, 14 + i * 104, 30, 82, 82, '#9ab0c4');
      schild(ctx, 60, 8, 'NO PAIN NO GAIN', '#c84a3a', '#ffffff');
      rect(ctx, 0, H * 0.6, W, H, '#2a2a30');
      for (i = 0; i < 3; i++) bild(ctx, 'hantel', 420 + i * 6, H * 0.6 + 12 + i * 22, 2);
      bild(ctx, 'lennart', 70, H * 0.62 + ((t >> 4) % 2 ? -2 : 0), 2);
    },
    kueche: function (ctx, W, H, t) {
      rect(ctx, 0, 0, W, H * 0.6, '#e8e4d8');
      for (var x = 0; x < W; x += 16) for (var y = 0; y < H * 0.6; y += 16) rect(ctx, x, y, 15, 15, (x + y) % 32 ? '#f4f0e4' : '#dcd8cc');
      rect(ctx, 20, 30, 80, 140, '#f4f4f8'); rect(ctx, 22, 90, 76, 2, '#c8c8d0'); rect(ctx, 86, 50, 4, 30, '#9aa0ac');
      rect(ctx, 400, 70, 100, 60, '#3a3a44'); for (var i = 0; i < 4; i++) rect(ctx, 410 + i * 22, 80, 16, 6, (t >> 3) % 2 ? '#ff6a3a' : '#c84a2a');
      rect(ctx, 0, H * 0.6, W, H, '#b8a88a');
      bild(ctx, 'erfan', 460, H * 0.62, 2);
    },
    
  };

  /* Was er in der anderen Hand hat (unten links im Bild): Aermel, Faust,
     der Gegenstand, die Finger davor. */
  function linkeHand(ctx, ding, x, y, t) {
    rund(ctx, x - 31, y + 3, 62, 90, 8, RAND);
    rund(ctx, x - 30, y + 4, 60, 90, 7, '#f4f0ec');
    rund(ctx, x - 25, y - 15, 50, 32, 10, RAND);
    rund(ctx, x - 24, y - 14, 48, 30, 9, HAUT);
    ding(ctx, x, y - 4, t);
    for (var i = 0; i < 4; i++) {
      rund(ctx, x - 23 + i * 12, y - 13, 12, 13, 5, RAND);
      rund(ctx, x - 22 + i * 12, y - 12, 10, 11, 4, HAUT);
      rect(ctx, x - 20 + i * 12, y - 4, 6, 2, HAUT_D);
    }
  }
  var HAND = {
    honig: function (ctx, x, y) { bild(ctx, 'honig', x, y, 3); },
    shaker: function (ctx, x, y) { bild(ctx, 'shaker', x, y, 3); },
    butter: function (ctx, x, y) { rect(ctx, x - 18, y - 16, 36, 16, '#ffe48a'); rect(ctx, x - 18, y - 16, 36, 4, '#fff4c0'); rect(ctx, x - 18, y - 4, 36, 4, '#c8b0a0'); F.draw(ctx, 'BUTTER', x, y - 12, { color: '#8a6a2a', align: 'center' }); },
    
  };

  function rund(ctx, x, y, w, h, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fill();
  }
  /* Die Hand, von unten ins Bild: Aermel, Handflaeche, Finger, die um den
     Handyrand greifen (links = linke Hand, Finger zeigen nach rechts). */
  function hand(ctx, x, y, w, h, links, aermel) {
    var ah = Math.round(h * 0.45);
    // Aermel (weisses Shirt, oder was die Szene sagt)
    rund(ctx, x - 7, y + h - ah - 1, w + 14, ah + 40, 6, RAND);
    rund(ctx, x - 6, y + h - ah, w + 12, ah + 40, 5, aermel || '#f4f0ec');
    rect(ctx, x - 6, y + h - ah + 4, w + 12, 2, 'rgba(0,0,0,0.08)');
    // Handflaeche
    rund(ctx, x - 1, y - 1, w + 2, h - ah + 6, 9, RAND);
    rund(ctx, x, y, w, h - ah + 4, 8, HAUT);
    rect(ctx, links ? x + 3 : x + w - 9, y + 6, 6, h - ah - 6, HAUT_D);
    // Finger, die um den Rand greifen
    for (var i = 0; i < 3; i++) {
      var fx = links ? x + w - 4 : x - 6, fy = y + 6 + i * 13;
      rund(ctx, fx - 1, fy - 1, 12, 12, 5, RAND);
      rund(ctx, fx, fy, 10, 10, 4, HAUT);
      rect(ctx, links ? fx + 6 : fx + 1, fy + 3, 2, 4, HAUT_D);
    }
  }
  /** Daumen ueber dem Handyrand (k: tippt gerade?) */
  function daumen(ctx, x, y, links, tippt) {
    var dy = tippt ? -4 : 0;
    rund(ctx, x - 1, y - 1 + dy, 16, 12, 5, RAND);
    rund(ctx, x, y + dy, 14, 10, 4, HAUT);
    rund(ctx, links ? x + 8 : x + 1, y + 1 + dy, 5, 4, 2, '#f8d4b8');
  }

  /* =====================================================================
     DIE GAGS — pro Szene einer
     ===================================================================== */
  function gagNachricht(k, e) {
    var g = k.gag, gag = k.sz.gag;
    if (g.n0 < 0 && k.n >= 3) { g.n0 = k.n; g.t0 = k.t; }
    if (gag === 'beutel' && /WLAN/.test(e[1] || '')) g.wlan = k.t;
    if (gag === 'opa' && k.n % 3 === 0) { k.shake = 10; S().play('klirr'); g.opa = k.t; }
    if (gag === 'turbulenz' && k.n % 3 === 1) { k.shake = 18; S().play('beep'); }
    if (gag === 'bauch' && k.n % 3 === 2) { k.knurr = 50; k.shake = 14; S().play('growl'); }
  }
  function gagTick(k) {
    var g = k.gag, gag = k.sz.gag;
    if (g.t0 < 0) return;
    var t = k.t - g.t0;
    if (gag === 'biene' && t === 1) S().play('flap');
    if (gag === 'sosse' && t === 30) { S().play('klatsch'); k.flecken.push({ x: 0.62, y: 0.38, r: 9, col: '#f4f0e0' }); }
    if (gag === 'sosse' && t === 260) { S().play('wischer'); k.wisch = 30; }
    if (gag === 'matsch' && t === 1) { S().play('platsch'); k.flecken.push({ x: 0.3, y: 0.3, r: 8, col: '#6a4a2a' }, { x: 0.7, y: 0.6, r: 6, col: '#5a3a1a' }); }
    if (gag === 'moewe' && t === 200) S().play('moewe');
    if (gag === 'erfan' && k.ende >= 0 && !g.erfan) { g.erfan = k.t; S().play('tuer'); }
    if (k.wisch > 0 && --k.wisch === 0) k.flecken = k.flecken.map(function (f) { return { x: f.x, y: f.y, r: f.r, col: f.col, schmier: true }; });
  }

  /** Gags vor dem Handy (in Handy-Koordinaten: hx, hy, BREITE, hh) */
  function gagVorne(ctx, G, k, hx, hy, hh) {
    var g = k.gag, gag = k.sz.gag, t = g.t0 >= 0 ? k.t - g.t0 : -1, i;
    // Flecken auf dem Display (Sosse, Matsch)
    k.flecken.forEach(function (f) {
      var fx = hx + BREITE * f.x, fy = hy + hh * f.y;
      ctx.globalAlpha = f.schmier ? 0.35 : 0.9;
      if (f.schmier) {
        ctx.fillStyle = f.col;
        for (var sw = 0; sw < 4; sw++) { ctx.beginPath(); ctx.ellipse(fx - 14 + sw * 9, fy + sw * 3, 7, 4, 0.4, 0, 6.3); ctx.fill(); }
      }
      else {
        ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, 6.3); ctx.fill();
        rect(ctx, fx - 2, fy, 4, f.r + 8, f.col);
      }
      ctx.globalAlpha = 1;
    });
    if (gag === 'biene' && t >= 0 && t < 340) {
      // fliegt rein, landet oben rechts auf dem Display, krabbelt, fliegt weg
      var bx, by;
      if (t < 60) { bx = -20 + (hx + BREITE - 40 + 20) * weich(t / 60); by = 40 + Math.sin(t * 0.3) * 14 + (hy + 60 - 40) * (t / 60); }
      else if (t < 280) { bx = hx + BREITE - 40 - (t - 60) * 0.25; by = hy + 60 + Math.sin(t * 0.1) * 3; }
      else { bx = hx + BREITE - 95 + (t - 280) * 6; by = hy + 60 - (t - 280) * 3; }
      bild(ctx, (t >> 1) % 2 ? 'biene' : 'biene2', bx, by, 2);
      if (t > 70 && t < 160) blase(ctx, bx, by - 20, 'BZZ. KEIN EMPFANG HIER?', '#ffd257');
    }
    if (gag === 'blatt') {
      var rutscht = t > 0 ? Math.min(1, t / 60) : 0;
      if (rutscht < 1) {
        ctx.save(); ctx.translate(hx + 26, hy + 40 + rutscht * 260); ctx.rotate(-0.4 + rutscht * 1.2);
        bild(ctx, 'blatt', 0, 0, 3); ctx.restore();
      }
    }
    if (gag === 'schweiss') {
      for (i = 0; i < 3; i++) {
        var st = (k.t * 0.6 + i * 90) % 300;
        rect(ctx, hx + 50 + i * 60, hy + st, 3, 5, 'rgba(160,210,255,0.6)');
      }
    }
    if (gag === 'fett') {
      ctx.globalAlpha = 0.18;
      for (i = 0; i < Math.min(5, k.n); i++) {
        ctx.fillStyle = '#c8a040'; ctx.beginPath(); ctx.ellipse(hx + 40 + (i * 71) % 160, hy + 80 + (i * 53) % 150, 9, 12, 0.3, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (gag === 'rauch') {
      for (i = 0; i < 3; i++) {
        var rx = hx - 60 + ((k.t * 0.5 + i * 120) % (BREITE + 120));
        ctx.fillStyle = 'rgba(235,228,250,0.16)';
        ctx.beginPath(); ctx.arc(rx, hy + 80 + i * 60, 30, 0, 6.3); ctx.fill();
      }
    }
    if (gag === 'brille') {
      // Durch die Airsoft-Brille: Rahmen und zwei Farbkleckse auf dem Glas
      ctx.globalAlpha = 0.9;
      rect(ctx, 0, 0, hx - 70, 400, 'rgba(20,24,20,0.55)');
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#ff5ac8'; ctx.beginPath(); ctx.arc(hx - 40, 70, 10, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#8cd85a'; ctx.beginPath(); ctx.arc(hx + BREITE + 50, 200, 8, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    if (gag === 'sonne') {
      var sx = ((k.t * 2) % (BREITE * 3)) - BREITE;
      ctx.globalAlpha = 0.18;
      ctx.save(); ctx.beginPath(); ctx.rect(hx, hy, BREITE, hh); ctx.clip();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(hx + sx, hy); ctx.lineTo(hx + sx + 30, hy); ctx.lineTo(hx + sx - 50, hy + hh); ctx.lineTo(hx + sx - 80, hy + hh); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }

  /** Gags in der Welt (hinter/neben dem Handy, nicht auf dem Display) */
  function gagWelt(ctx, G, k, W, H) {
    var g = k.gag, gag = k.sz.gag, t = g.t0 >= 0 ? k.t - g.t0 : -1;
    if (gag === 'wecker' && (k.t >> 6) % 4 === 0) F.draw(ctx, 'RIIIING!', 445, H * 0.62 - 50, { color: '#ff6a6a', align: 'center', shadow: true });
    
  }

  /** Sprechblase in der Welt (wer nicht im Chat schreibt: Polizist, Erfan).
      Mit welt=true wird sie gemerkt und nach dem Handy gezeichnet. */
  var spaeter = null;
  function blase(ctx, x, y, text, col, welt) {
    if (welt && spaeter) { spaeter.push([x, y, text, col]); return; }
    var tw = F.measure(text, 1, 1) + 10, W = 512;
    var bx = Math.max(4, Math.min(W - tw - 4, Math.round(x - tw / 2))), by = Math.round(y - 14);
    rect(ctx, bx, by, tw, 13, 'rgba(10,6,16,0.9)');
    rect(ctx, bx, by + 12, tw, 1, col);
    F.draw(ctx, text, bx + 5, by + 3, { color: col });
    void welt;
  }

  /* =====================================================================
     DIE FOTOS — kleine Bilder im Chat (x, y, w, h; t = Ticks seit dem Foto)
     ===================================================================== */
  function himmel(ctx, x, y, w, h, a, b) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  var MOTIVE = {
    giraffe: function (ctx, x, y, w, h, t) {
      himmel(ctx, x, y, w, h, '#7ac8f0', '#e8f4d8');
      rect(ctx, x, y + h - 14, w, 14, '#c8b860');
      for (var i = 0; i < 8; i++) rect(ctx, x + i * 15, y + h - 26, 2, 12, '#8a6a3a');
      rect(ctx, x, y + h - 24, w, 2, '#8a6a3a');
      var gx = x + 52, gy = y + h - 30;
      for (i = 0; i < 4; i++) rect(ctx, gx - 12 + i * 8, gy, 3, 16, '#d8a040');
      rect(ctx, gx - 14, gy - 12, 34, 13, '#e8b848');
      rect(ctx, gx + 14, gy - 44, 7, 34, '#e8b848');
      rect(ctx, gx + 12, gy - 50, 14, 8, '#e8b848'); rect(ctx, gx + 22, gy - 47, 2, 2, RAND);
      rect(ctx, gx + 14, gy - 54, 2, 4, '#8a5a2a'); rect(ctx, gx + 19, gy - 54, 2, 4, '#8a5a2a');
      [[-10, -9], [0, -7], [8, -10], [16, -30], [15, -20]].forEach(function (f) { rect(ctx, gx + f[0], gy + f[1], 4, 3, '#a86a2a'); });
      figur(ctx, 'huseyin', gx - 2, gy - 9, { pose: 'ride', face: 'laugh', frame: 0, scale: 1 });
      schild(ctx, x + w - 22, y + 4, 'ZOO', '#3a6a2a', '#ffffff');
    },
    bienenauto: function (ctx, x, y, w, h, t) {
      himmel(ctx, x, y, w, h * 0.5, '#8ac8f0', '#d8f0ff');
      rect(ctx, x, y + h * 0.5, w, h * 0.5, '#4a4a54');
      rect(ctx, x, y + h - 12, w, 12, '#2a2a30');
      bild(ctx, 'mirkan_head', x + w / 2, y + h - 10, 3);
      bild(ctx, 'biene', x + w / 2 + 2, y + h - 30 + ((t >> 3) % 2), 1);
      for (var i = 0; i < 4; i++) bild(ctx, (t >> 2) % 2 ? 'biene' : 'biene2', x + 12 + i * 28 + Math.sin(t * 0.1 + i) * 4, y + 12 + (i % 2) * 14, 1);
    },
    gymspiegel: function (ctx, x, y, w, h, t) {
      rect(ctx, x, y, w, h, '#9ab0c4'); rect(ctx, x + 3, y + 3, w - 6, h - 6, '#b8cce0');
      rect(ctx, x + 70, y + 20, 36, h - 24, '#7a8a9a');
      for (var i = 0; i < 3; i++) bild(ctx, 'shaker', x + 78 + i * 10, y + 34 + (i % 2) * 14, 1);
      figur(ctx, 'yusuf', x + 88, y + h - 4, { pose: 'idle', face: 'eat', frame: 0, scale: 1 });
      bild(ctx, 'lennart', x + 36, y + h - 2, 2);
      F.draw(ctx, 'POST-WORKOUT', x + 34, y + 4, { color: '#2a3a4a', align: 'center' });
    },
    kuehlschrank: function (ctx, x, y, w, h) {
      rect(ctx, x, y, w, h, '#d8dce4');
      rect(ctx, x + 20, y + 4, w - 40, h - 8, '#f4f4f8');
      var farben = ['#3a8a3a', '#5aa83a', '#8cd85a', '#c84a3a', '#ffd257', '#8a3a8a'];
      for (var r = 0; r < 3; r++) {
        rect(ctx, x + 22, y + 22 + r * 16, w - 44, 2, '#c8ccd4');
        for (var i = 0; i < 6; i++) rect(ctx, x + 26 + i * 11, y + 12 + r * 16, 9, 9, farben[(r * 2 + Math.floor(i / 3)) % 6]);
      }
      schild(ctx, x + w / 2, y + h - 14, 'KEIN FLEISCH', '#c84a3a', '#ffffff');
    },
    uhr: function (ctx, x, y, w, h, t) {
      rect(ctx, x, y, w, h, '#3a3a44');
      rect(ctx, x + w / 2 - 14, y, 28, h, '#1a1a20');
      rect(ctx, x + w / 2 - 26, y + 8, 52, h - 16, '#0a0a10'); rect(ctx, x + w / 2 - 24, y + 10, 48, h - 20, '#141820');
      F.draw(ctx, 'PULS 58', x + w / 2, y + 16, { color: '#ff6a6a', align: 'center' });
      F.draw(ctx, '16.402', x + w / 2, y + 28, { color: '#8cd85a', align: 'center' });
      F.draw(ctx, 'STRESS:', x + w / 2, y + 40, { color: '#c8c0d8', align: 'center' });
      F.draw(ctx, (t >> 4) % 2 ? 'YUSUF' : '!!!', x + w / 2, y + 48, { color: '#ffd257', align: 'center' });
    },
    salatburg: function (ctx, x, y, w, h) {
      himmel(ctx, x, y, w, h, '#8ac8f0', '#e8f8ff');
      rect(ctx, x, y + h - 10, w, 10, '#3a8a3a');
      rect(ctx, x + 22, y + 26, 72, h - 36, '#5aa83a');
      for (var i = 0; i < 3; i++) { rect(ctx, x + 16 + i * 32, y + 12, 20, h - 22, '#3a8a3a'); rect(ctx, x + 16 + i * 32, y + 8, 4, 4, '#3a8a3a'); rect(ctx, x + 24 + i * 32, y + 8, 4, 4, '#3a8a3a'); rect(ctx, x + 32 + i * 32, y + 8, 4, 4, '#3a8a3a'); }
      rect(ctx, x + 50, y + h - 26, 16, 16, '#2a5a2a');
      rect(ctx, x + 58, y - 2, 2, 14, '#5a4a3a'); rect(ctx, x + 60, y - 2, 14, 5, '#8cd85a');
      for (i = 0; i < 6; i++) bild(ctx, 'salat', x + 18 + i * 16, y + h - 2, 1);
    },
    
  };

  /* =====================================================================
     ZEICHNEN
     ===================================================================== */
  function avatar(ctx, wer, x, y) {
    var c = (LEUTE[wer] || [wer, '#c8c0d8'])[1];
    rect(ctx, x, y, 14, 14, c);
    rect(ctx, x + 1, y + 1, 12, 12, '#1e1826');
    F.draw(ctx, ((LEUTE[wer] || [wer])[0]).charAt(0), x + 7, y + 3, { color: c, align: 'center' });
  }

  /** Das Foto in der Blase: erst laedt es kurz, dann ploppt das Bild auf. */
  function foto(ctx, G, k, z, x, y) {
    var alt = k.t - (z.t0 || 0);
    rect(ctx, x - 1, y - 1, FOTO_W + 2, FOTO_H + 2, '#0a0810');
    if (alt < 18) {
      rect(ctx, x, y, FOTO_W, FOTO_H, '#2a2434');
      rect(ctx, x + 20, y + FOTO_H / 2, FOTO_W - 40, 3, '#3a3448');
      rect(ctx, x + 20, y + FOTO_H / 2, (FOTO_W - 40) * alt / 18, 3, '#6fc8e8');
      return;
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, FOTO_W, FOTO_H); ctx.clip();
    var m = z.motiv && MOTIVE[z.motiv];
    if (m) m(ctx, x, y, FOTO_W, FOTO_H, G.tick);
    else {
      rect(ctx, x, y, FOTO_W, FOTO_H, '#3a3448');
      F.draw(ctx, 'FOTO', x + FOTO_W / 2, y + FOTO_H / 2 - 3, { color: '#c8c0d8', align: 'center' });
    }
    if (alt < 26) { ctx.globalAlpha = (26 - alt) / 8; rect(ctx, x, y, FOTO_W, FOTO_H, '#ffffff'); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  /** Das Handy mit dem Chat. Gezeichnet in Bildschirm-Koordinaten. */
  function telefon(ctx, G, k, W, H, an) {
    var chat = k.chat, i;
    var hx = Math.round(W / 2 - BREITE / 2), hy = 10, hh = H - 20;
    rect(ctx, hx - 6, hy - 6, BREITE + 12, hh + 12, '#05040a');
    rect(ctx, hx - 4, hy - 4, BREITE + 8, hh + 8, '#2a2632');
    rect(ctx, hx, hy, BREITE, hh, '#141820');
    if (an < 1) {
      // Bildschirm ist aus / geht gerade an
      if (an > 0) { ctx.globalAlpha = an; } else return { hx: hx, hy: hy, hh: hh };
    }
    // Kopfzeile: Gruppe, Uhrzeit
    rect(ctx, hx, hy, BREITE, KOPF, '#1f2a36');
    rect(ctx, hx + 6, hy + 6, 22, 22, chat.farbe || '#2fa86a');
    F.draw(ctx, chat.symbol || (chat.titel || 'CHAT').charAt(0), hx + 17, hy + 13, { color: '#ffffff', align: 'center' });
    F.draw(ctx, chat.titel || 'DIE JUNGS', hx + 34, hy + 7, { color: '#ffffff' });
    var unter = k.tippt ? ((LEUTE[k.tippt] || [k.tippt])[0] + ' SCHREIBT...') : (chat.leute || '');
    var Spr = global.Sprache;
    if (Spr && !Spr.ist('de')) unter = Spr.t(unter);
    while (unter.length > 4 && F.measure(unter, 1, 1) > BREITE - 42) unter = unter.slice(0, -4) + '...';
    if (Spr) Spr.schonUebersetzt(unter);
    F.draw(ctx, unter, hx + 34, hy + 19, { color: k.tippt ? '#8cd85a' : '#8a94a8' });
    F.draw(ctx, chat.zeit || '', hx + BREITE - 6, hy + 7, { color: '#8a94a8', align: 'right' });

    // Nachrichten: unten angeschlagen, aeltere rutschen nach oben raus
    var oben = hy + KOPF + 4, unten = hy + hh - 20;
    ctx.save();
    ctx.beginPath(); ctx.rect(hx, oben, BREITE, unten - oben); ctx.clip();
    // Unten Platz fuer die "schreibt..."-Blase lassen, wenn jemand tippt
    var y = Math.min(oben + 4, unten - k.hoehe - (k.tippt ? 20 : 0));
    for (i = 0; i < k.zeilen.length; i++) {
      var z = k.zeilen[i], e = z.e, art = e[0];
      // Neue Nachrichten rutschen kurz von unten rein
      var neu = clamp((k.t - z.t0) / 8, 0, 1), dy = Math.round((1 - neu) * 10);
      if (art === 'system') {
        var sw = 0; z.lines.forEach(function (l) { sw = Math.max(sw, F.measure(l, 1, 1)); });
        rect(ctx, hx + BREITE / 2 - sw / 2 - 5, y + dy, sw + 10, z.h - 2, '#262c38');
        z.lines.forEach(function (l, n) { F.draw(ctx, l, hx + BREITE / 2, y + dy + 4 + n * 9, { color: '#a8b0c0', align: 'center' }); });
      } else {
        var ich = z.wer === 'yusuf', col = (LEUTE[z.wer] || [z.wer, '#c8c0d8'])[1];
        var bw = 0;
        z.lines.forEach(function (l) { bw = Math.max(bw, F.measure(l, 1, 1)); });
        if (art === 'bild') bw = Math.max(bw, FOTO_W);
        if (art === 'sprach') bw = 112;
        bw = Math.max(bw, ich ? 10 : F.measure((LEUTE[z.wer] || [z.wer])[0], 1, 1)) + 12;
        var bx = ich ? hx + BREITE - bw - 8 : hx + 26, by = y + dy;
        if (!ich) avatar(ctx, z.wer, hx + 7, by + 1);
        rect(ctx, bx, by, bw, z.h, ich ? '#1f5a3c' : '#262c38');
        var ty = by + 4;
        if (!ich) { F.draw(ctx, (LEUTE[z.wer] || [z.wer])[0], bx + 6, ty, { color: col }); ty += 10; }
        if (art === 'bild') {
          foto(ctx, G, k, z, bx + 6, ty);
          z.lines.forEach(function (l, n) { F.draw(ctx, l, bx + 6, ty + FOTO_H + 4 + n * 9, { color: '#e8e4f0' }); });
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
        if (ich) F.draw(ctx, 'GELESEN', bx + bw - 4, by + z.h + 1, { color: '#5a7ab8', align: 'right' });
      }
      y += z.h + 4 + (art === 'yusuf' ? 9 : 0);
    }
    // "schreibt..."-Blase
    if (k.tippt) {
      var ddy = Math.min(unten - 18, y);
      avatar(ctx, k.tippt, hx + 7, ddy + 1);
      rect(ctx, hx + 26, ddy, 34, 14, '#262c38');
      for (i = 0; i < 3; i++) {
        var hop = ((G.tick >> 3) + i) % 3 === 0 ? 2 : 0;
        rect(ctx, hx + 33 + i * 8, ddy + 6 - hop, 4, 4, '#a8b0c0');
      }
    }
    ctx.restore();
    // Unten: Eingabezeile (Yusuf tippt mit) und Hinweis
    rect(ctx, hx, unten, BREITE, hy + hh - unten, '#1f2a36');
    if (k.ichTippt > 0) {
      rect(ctx, hx + 6, unten + 4, BREITE - 12, 11, '#2a3644');
      var n = Math.floor((24 - k.ichTippt) / 2);
      for (i = 0; i < n; i++) rect(ctx, hx + 10 + i * 6, unten + 8, 4, 4, '#c8d0e0');
    } else {
      F.draw(ctx, k.ende >= 0 ? 'SPRUNG = WEITER' : 'SPRUNG WEITER / HALTEN ÜBERSPRINGEN', hx + BREITE / 2, unten + 6,
             { color: '#8a94a8', align: 'center' });
    }
    ctx.globalAlpha = 1;
    return { hx: hx, hy: hy, hh: hh };
  }

  /** Yusufs Bauch und Hosentasche, von oben gesehen (beim Rausholen). */
  function bauch(ctx, W, H, k, brumm) {
    var hose = k.sz.hose || '#3a4a8a';
    // Bauch (weisses Shirt, rund)
    ctx.fillStyle = '#f4f0ec';
    ctx.beginPath(); ctx.ellipse(W / 2, H + 40, 210, 120, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#d8d0cc';
    ctx.beginPath(); ctx.ellipse(W / 2 + 40, H + 46, 150, 90, 0, Math.PI, 0); ctx.fill();
    // Hose und Tasche rechts
    rect(ctx, W / 2 + 120, H - 46, 160, 60, hose);
    rect(ctx, W / 2 + 150, H - 40, 70, 4, 'rgba(0,0,0,0.25)');
    // Das Handy steckt in der Tasche und brummt
    var wack = brumm ? ((k.t >> 1) % 2 ? 2 : -2) : 0;
    if (k.t < 76) {
      rect(ctx, W / 2 + 160 + wack, H - 52, 40, 14, '#05040a');
      rect(ctx, W / 2 + 162 + wack, H - 50, 36, 10, brumm ? '#3a6aa8' : '#1a1a24');
      if (brumm) {
        ctx.globalAlpha = 0.6;
        rect(ctx, W / 2 + 150, H - 62 + wack, 3, 8, '#ffffff'); rect(ctx, W / 2 + 208, H - 62 - wack, 3, 8, '#ffffff');
        ctx.globalAlpha = 1;
        F.draw(ctx, 'BRRRT', W / 2 + 180 + wack, H - 78, { color: '#ffffff', align: 'center', shadow: true });
      }
    }
  }

  function draw(ctx, G, W, H) {
    var k = G.scene, t = k.t, sz = k.sz;
    // 1. Wo er ist
    var ort = ORTE[sz.ort] || ORTE.zimmer;
    ctx.save();
    // leichtes Atmen der Kamera
    var atmen = Math.round(Math.sin(t * 0.04) * 2);
    ctx.translate(0, atmen);
    ort(ctx, W, H, t);
    ctx.restore();

    // 2. Rausholen, Chat oder Wegstecken
    var rein = t < REIN && k.raus < 0;
    var dunkel = rein ? clamp((t - 90) / 40, 0, 1) * 0.55 : (k.raus >= 0 ? 0.55 * (1 - clamp(k.raus / RAUS, 0, 1)) : 0.55);
    if (dunkel > 0) { ctx.globalAlpha = dunkel; rect(ctx, 0, 0, W, H, '#06040c'); ctx.globalAlpha = 1; }
    if (global.Licht && global.Licht.glow && !rein) global.Licht.glow(ctx, W / 2, H / 2, 200, '#3a5aa8', 0.22 * (dunkel / 0.55));

    var andereHand = sz.hand && HAND[sz.hand];
    if (rein) {
      // Bauch und Tasche (bis das Handy draussen ist)
      if (t < 110) bauch(ctx, W, H, k, t < 60);
      if (andereHand) linkeHand(ctx, andereHand, 76, H - 22 + Math.round(Math.sin(t * 0.06) * 2), t);
      // Die Hand kommt, holt das Handy, hebt es hoch
      var px, py, s, rot;
      if (t < 76) {
        var hk = weich((t - 36) / 40);
        hand(ctx, W + 20 - (W / 2 + 0) * hk + 40, H - 60 + (1 - hk) * 50, 40, 70, false);
      } else {
        var auf = weich((t - 76) / 56);
        px = W / 2 + 180 - 180 * auf; py = H - 46 - (H - 46 - H / 2) * auf;
        s = 0.17 + 0.83 * auf; rot = (1 - auf) * -0.7;
        ctx.save();
        ctx.translate(px, py); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
        telefon(ctx, G, k, W, H, clamp((t - (REIN - 18)) / 14, 0, 1));
        // Hand haelt es unten rechts
        hand(ctx, W / 2 + BREITE / 2 - 10, H - 70, 60, 120, false);
        daumen(ctx, W / 2 + BREITE / 2 - 18, H - 80, false, false);
        ctx.restore();
        // Bildschirm geht an: kurzer Blitz
        if (t > REIN - 18 && t < REIN - 6) { ctx.globalAlpha = (REIN - 6 - t) / 24; rect(ctx, W / 2 - BREITE / 2, 10, BREITE, H - 20, '#ffffff'); ctx.globalAlpha = 1; }
      }
      
      gagWelt(ctx, G, k, W, H);
      if (t < 14) { ctx.globalAlpha = 1 - t / 14; rect(ctx, 0, 0, W, H, '#000000'); ctx.globalAlpha = 1; }
      return;
    }

    // Chat (oder Wegstecken)
    var weg = k.raus >= 0 ? weich(k.raus / RAUS) : 0;
    var wack = k.shake > 0 ? Math.round(Math.sin(k.shake * 1.7) * Math.min(3, k.shake / 3)) : 0;
    var bob = Math.round(Math.sin(t * 0.05) * 1.5);
    spaeter = [];
    gagWelt(ctx, G, k, W, H);
    var blasen = spaeter;
    spaeter = null;
    if (andereHand) {
      // Die Moewe hat das Fischbrot geklaut: dann ist die Hand leer
      var leer = sz.gag === 'moewe' && k.gag.t0 >= 0 && k.t - k.gag.t0 > 220;
      linkeHand(ctx, leer ? function () {} : andereHand, 76, H - 20 + bob, t);
    }
    ctx.save();
    ctx.translate(W / 2 + wack, H / 2 + bob + weg * (H * 0.9));
    if (weg > 0) { ctx.rotate(weg * 0.5); }
    ctx.translate(-W / 2, -H / 2);
    var lage = telefon(ctx, G, k, W, H, 1);
    gagVorne(ctx, G, k, lage.hx, lage.hy, lage.hh);
    // Die Haende: rechts haelt, Daumen tippt bei eigenen Nachrichten
    var polizist = sz.gag === 'beutel';
    if (polizist) {
      // Ein Polizist haelt den Beutel (blaue Aermel)
      hand(ctx, lage.hx - 46, H - 74, 40, 110, true, '#24305a');
      hand(ctx, lage.hx + BREITE + 6, H - 74, 40, 110, false, '#24305a');
    } else {
      // Finger greifen um den Rahmen, nicht ueber den Text
      hand(ctx, lage.hx + BREITE + 6, H - 76, 54, 124, false);
      daumen(ctx, lage.hx + BREITE - 8, H - 64, false, k.ichTippt > 0 && (k.t >> 2) % 2 === 0);
      if (!andereHand) {
        hand(ctx, lage.hx - 60, H - 76, 54, 124, true);
        daumen(ctx, lage.hx - 6, H - 64, true, k.ichTippt > 0 && (k.t >> 2) % 2 === 1);
      }
    }
    ctx.restore();
    blasen.forEach(function (b) { blase(ctx, b[0], b[1], b[2], b[3], false); });
  }

  global.Chat = { init: init, update: update, draw: draw, LEUTE: LEUTE, SZENEN: SZENEN, MOTIVE: MOTIVE, ORTE: ORTE, REIN: REIN };

})(window);
