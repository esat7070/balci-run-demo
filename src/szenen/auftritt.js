/* =====================================================================
   auftritt.js — Bosse treten auf wie in einem grossen Spiel (Esat, 25.10.:
   "so ins Spiel reinkommen lassen wie in echten Spielen"; 28.10.: "die
   Boss-Intros muessen viel epischer sein, wie in Elden Ring").

   Beim ersten Betreten der Arena:
     1. VORAHNUNG: Kinobalken, die Musik bricht ab. Der Boden grollt,
        Staub rieselt, die Welt wird dunkler und blasser, ein tiefes
        Horn. Die Kamera faehrt dahin, wo er gleich auftaucht.
        BOSSKAMPF steht kurz im Bild.
     2. AUFTRITT: Der Boss kommt auf seine Art (AUFTRITTE): faellt aus
        dem Himmel (sein Schatten waechst, kurz vor dem Aufprall wird es
        langsam), rollt mit Hupe rein, schwebt im Licht herab, springt in
        einem riesigen Bogen (oben fast stehend), kommt mit dem Blitz,
        oder steht schon im Dunkeln und das Licht findet ihn.
     3. EINSCHLAG: Druckwellen, Staub, Brocken, Funken, Farbe kommt
        zurueck, die Kamera springt nah ran, er bruellt.
     4. Sein NAME erscheint gross, mit dem Spruch der Karte darunter —
        und genau dann setzt die Musik ein.
     5. Die Kamera faehrt zurueck, dann das Gespraech (game.js). Wenn
        es losgeht, laeuft sein Balken voll.
   Nach einem Tod kommt der Auftritt nicht nochmal (G.bossIntroSeen).
   Sprung oder Klick spult vor. Effekte: bosskino.js.
   ===================================================================== */
(function (global) {
  'use strict';

  var F = global.Font;
  function S() { return global.Sound; }
  function K() { return global.BossKino; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function weich(k) { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k) * (1 - k); }
  function ton(n, arg) { var s = S(); if (s) s.play(n, arg); }

  var DAUER = 290;       // so lange dauert ein Auftritt (Ticks)
  var AN = 72;           // ab hier bewegt sich der Boss
  var DA = 140;          // hier ist er da (Einschlag)
  var NAME = 168;        // der Name erscheint, die Musik setzt ein
  var ZURUECK = 252;     // die Kamera faehrt zurueck

  /* Wie jeder Boss reinkommt.
       art   fall | rein | schweben | sprung | blitz | still
       von   bei 'rein'/'sprung': von welcher Seite (1 = rechts)
       ton   Geraeusch beim Reinkommen
       ruf   was er dabei ruft (klein, ueber ihm)
       schwer  der Einschlag ist groesser (Riese) */
  var AUFTRITTE = {
    mirkan:   { art: 'rein', von: 1, ton: 'hupe', ruf: 'WARUM IST DAS GITTER ZU?' },
    lennart:  { art: 'fall', ton: 'bumm', ruf: 'BRO!' },
    erfan:    { art: 'schweben', ton: 'gong', ruf: 'SAFRAN!' },
    huseyin:  { art: 'rein', von: 1, ton: 'whoosh', ruf: 'KILOMETER DREIZEHN!' },
    
    _:        { art: 'fall', ton: 'bumm', ruf: null }
  };

  function karte(bt) {
    var k = global.Levels && global.Levels.bossKarten && global.Levels.bossKarten[bt];
    return k || null;
  }

  function start(G, b, bt, fertig) {
    var a = AUFTRITTE[bt] || AUFTRITTE._;
    // Bosse erscheinen oft etwas ueber dem Boden und fallen erst los, wenn
    // sie sich bewegen duerfen — fuer den Auftritt stehen sie schon unten.
    var y0 = b.y, w = G.world;
    if (a.art !== 'still' && w && w.solid) {
      var tx = Math.floor((b.x + b.w / 2) / 16);
      for (var i = 0; i < 160; i++) {
        if (w.solid(tx, Math.floor((y0 + b.h) / 16))) break;
        y0 += 1;
      }
      if (!w.solid(tx, Math.floor((y0 + b.h) / 16))) y0 = b.y;
      else y0 = Math.floor((y0 + b.h) / 16) * 16 - b.h;
    }
    b.y = y0;
    var kt = karte(bt);
    var au = G.auftritt = {
      t: 0, b: b, bt: bt, x0: b.x, y0: y0, a: a, fertig: fertig, gelandet: false,
      col: (kt && kt[2]) || '#ffd257', song: (S() && S().song) ? S().song() : null, musik: false
    };
    G.frozen = true;
    G.bossBarFill = 0;
    var mx = b.x + b.w / 2, my = y0 + b.h / 2;
    G.camFocus = { x: mx, y: my };
    var kb = K();
    if (kb) {
      var f = kb.bild(G);
      f.balkenZ = 1; f.col = au.col;
      // Wer schon da ist (Felix, Semih), steht im Dunkeln, bis das Licht ihn findet
      f.punkt = { x: mx, y: my, r: a.art === 'still' ? 3 : clamp(b.h * 0.6, 18, 44) };
      f.grauZ = 0.4; f.dunkelZ = a.art === 'still' ? 0.96 : 0.5;
      kb.kamera(G, mx, my - 10, 1.18, 0.03);
    }
    stellen(au, 0);
    // Stille: die Musik bricht ab, der Boden grollt
    if (S()) S().stopMusic();
    ton('grollen');
    G.shake(3, 60);
  }

  /** Wo der Boss zum Zeitpunkt t steht (relativ zu seinem Platz). */
  function stellen(au, t) {
    var b = au.b, a = au.a, k = clamp((t - AN) / (DA - AN), 0, 1);
    var dx = 0, dy = 0, sichtbar = true;
    if (a.art === 'fall') {
      // Faellt immer schneller — die letzten Meter wie in Zeitlupe
      var tw = k < 0.72 ? k / 0.72 * 0.86 : 0.86 + (k - 0.72) / 0.28 * 0.14;
      dy = -300 * (1 - tw * tw);
      sichtbar = t >= AN - 2;
    } else if (a.art === 'schweben') {
      dy = -170 * (1 - weich(k)) + Math.sin(t * 0.15) * 3 * (1 - k);
      sichtbar = t >= AN - 20;
    } else if (a.art === 'rein') {
      dx = (a.von || 1) * 320 * (1 - weich(k));
    } else if (a.art === 'sprung') {
      // Oben im Bogen steht er fast still
      var s = clamp(k + 0.7 * Math.sin(2 * Math.PI * k) / (2 * Math.PI), 0, 1);
      dx = (a.von || 1) * 240 * (1 - s);
      dy = -Math.sin(s * Math.PI) * 110;
      sichtbar = t >= AN - 2;
    } else if (a.art === 'blitz') {
      sichtbar = t >= DA - 2;
    }
    b.x = au.x0 + dx;
    b.y = au.y0 + dy;
    au.sichtbar = sichtbar;
    b.auftrittVersteckt = !sichtbar;
  }

  function musikAn(au) {
    if (au.musik) return;
    au.musik = true;
    if (S()) {
      if (au.song) S().music(au.song);
      if (S().daempfen) S().daempfen(1, 0.6);
    }
  }

  function gedrueckt() { var I = global.Input; return !!(I && (I.hit('jump') || I.hit('confirm'))); }

  function tick(G) {
    var au = G.auftritt, kb = K();
    if (!au) return;
    if (G.boss !== au.b || !G.boss) { ende(G, au); return; }
    au.t++;
    // Vorspulen: erst zum Einschlag, dann ans Ende
    if (au.t > 16 && gedrueckt()) {
      if (au.t < DA - 4) au.t = DA - 4;
      else if (au.t < ZURUECK) {
        au.t = ZURUECK;
        if (G.filmName) G.filmName.t = Math.max(G.filmName.t, G.filmName.max - 22);
        musikAn(au);
      }
    }
    var t = au.t, a = au.a, b = au.b, W = G.viewW ? G.viewW() : 512;
    var f = kb ? kb.bild(G) : null;
    stellen(au, t);
    var mx = b.cx(), my = b.y + b.h / 2, zx = au.x0 + b.w / 2, zy = au.y0 + b.h / 2;

    // 1. Vorahnung
    if (t < AN) {
      if (kb && t % 4 === 0) kb.rieseln(G, a.schwer ? 3 : 2, W);
      if (t === 30) { ton('horn'); G.shake(5, 44); }
      if (a.art === 'schweben' && t === AN - 24 && kb) kb.saeule(G, zx, au.y0 + b.h, au.col, DA - AN + 70, 0.8);
      if (a.art === 'still' && t === AN - 10 && kb) kb.saeule(G, zx, au.y0 + b.h, au.col, DA - AN + 90, 1.4);
      if (a.art === 'blitz' && f && t > AN - 30 && t % 11 === 0) { f.blitz = f.blitzMax = 4; f.blitzA = 0.3; f.blitzCol = '#9ad8ff'; ton('donner'); }
    }
    if (t === AN && a.ton) ton(a.ton);
    // 2. Auftritt: die Kamera bleibt an ihm dran
    if (t >= AN && t < DA && kb) {
      if (a.art !== 'still') kb.kamera(G, zx + (mx - zx) * 0.6, zy + (my - zy) * 0.6 - 8, 1.32, 0.12);
      G.camFocus = { x: zx + (mx - zx) * 0.5, y: zy + (my - zy) * 0.5 };
      if (a.art === 'rein' && t % 3 === 0) kb.staub(G, mx - (a.von || 1) * b.w * 0.4, au.y0 + b.h, 2);
      if (a.art === 'blitz' && t === DA - 3) { kb.blitzstrahl(G, zx, au.y0 + b.h, '#8ae0ff'); }
    }
    // 3. Einschlag
    if (t === DA) {
      au.gelandet = true;
      var fuss = au.y0 + b.h, hart = a.art === 'fall' || a.art === 'sprung';
      G.shake(a.schwer ? 16 : (hart ? 12 : 9), a.schwer ? 44 : 30);
      ton('impakt');
      ton('bossRoar');
      if (hart) ton('stomp');
      if (G.einschlag) G.einschlag(b.cx(), fuss, 'boss');
      if (kb) {
        var col = a.art === 'blitz' ? '#8ae0ff' : au.col;
        kb.welle(G, zx, fuss, col, { r: a.schwer ? 380 : 300, max: 44, dicke: 7, flach: 0.16 });
        kb.welle(G, zx, zy, '#ffffff', { r: 180, max: 24, dicke: 3, flach: 1 });
        if (hart || a.schwer) kb.welle(G, zx, zy, col, { r: 340, max: 54, dicke: 8, flach: 1, verz: 5 });
        kb.staub(G, zx, fuss, a.art === 'schweben' ? 10 : 30);
        if (hart) {
          var br = kb.brocken(G, zx, fuss, col, a.schwer ? 14 : 9);
          for (var i = 0; i < br.liste.length; i++) { br.liste[i].y = fuss - 2; br.liste[i].x = zx + (br.liste[i].x - zx) * 0.3; }
          kb.explodiere(br, zx);
          var rs = kb.risse(G, zx, fuss, col);
          rs.an = 1; rs.hell = 1.4; rs.aus = true;
        }
        if (a.art !== 'rein') kb.funken(G, zx, zy, a.art === 'schweben' ? 26 : 18, col);
        f.grauZ = 0; f.grau = 0; f.dunkelZ = 0.18; f.dunkel = Math.min(f.dunkel, 0.3);
        f.blitz = f.blitzMax = a.art === 'blitz' ? 14 : 7;
        f.blitzCol = a.art === 'blitz' ? '#d8f8ff' : '#ffffff';
        f.ca = a.schwer ? 5 : 3.5; f.blur = 0.8; f.linien = 0.85; f.col = col;
        f.punkt = { x: zx, y: zy, r: clamp(b.h * 0.6, 18, 44) };
        // Crash-Zoom: mit einem Ruck nah ran, dann ganz langsam noch naeher.
        // Etwas unter ihn zielen: er steht oben, unten ist Platz fuer den Namen.
        var k = kb.kamera(G, zx, zy + 14, 2.0, 0.012);
        k.z = 1.75; k.x = zx; k.y = zy + 14; k.ruck = 0.08;
      }
      G.camFocus = { x: zx, y: zy };
      // Sein Ruf ist kurz: gleich danach kommt der Name
      if (a.ruf) G.floats.add(b.cx(), b.y - 24, a.ruf, '#ffd257', 42);
    }
    // 4. Der Name, die Musik
    if (t === NAME) {
      var kt = karte(au.bt);
      if (kb && kt) kb.name(G, { gross: kt[0], unten: kt[1], col: kt[2] || au.col, max: ZURUECK - NAME + 30 });
      ton('enthuellung');
      musikAn(au);
    }
    // 5. Zurueck zu Yusuf
    if (t === ZURUECK) {
      if (kb) { kb.kameraFrei(G, 0.07); f.dunkelZ = 0; }
      if (G.player) G.camFocus = { x: (G.player.cx() + b.cx()) / 2, y: (G.player.y + b.y) / 2 + 10 };
    }
    if (t >= DAUER) ende(G, au);
  }

  function ende(G, au) {
    if (au.b) { au.b.x = au.x0; au.b.y = au.y0; au.b.auftrittVersteckt = false; }
    G.auftritt = null;
    G.camFocus = null;
    G.frozen = false;
    musikAn(au);
    var kb = K();
    if (kb) {
      kb.kameraFrei(G, 0.1);
      var f = kb.bild(G);
      f.balkenZ = 0; f.dunkelZ = 0; f.grauZ = 0;
    }
    if (au.fertig) au.fertig();
  }

  /** In der Welt (bosskino.js hinten): Schatten, Tempo-Striche. */
  function welt(ctx, G, camX, camY) {
    var au = G.auftritt;
    if (!au || au.gelandet) return;
    var a = au.a, b = au.b, t = au.t;
    var zx = au.x0 + b.w / 2 - camX, fuss = au.y0 + b.h - camY;
    // Wer faellt oder springt: sein Schatten wartet schon am Boden
    if ((a.art === 'fall' || a.art === 'sprung') && t > AN - 24) {
      var k = clamp((t - (AN - 24)) / (DA - AN + 24), 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + 0.4 * k).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(zx, fuss, 4 + b.w * 0.75 * k, 1.5 + 3 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!au.sichtbar || t < AN) return;
    var bx = b.cx() - camX, by = b.y - camY;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    if (a.art === 'fall') {
      // Striche nach oben: er ist schnell
      for (var i = 0; i < 6; i++) {
        var sx = bx - b.w / 2 + ((i * 7 + 3) % Math.max(4, b.w)), l = 20 + ((i * 13 + t * 3) % 30);
        ctx.fillRect(Math.round(sx), Math.round(by - l - 4), 1, Math.round(l));
      }
    } else if (a.art === 'rein') {
      var s = a.von || 1;
      for (var j = 0; j < 5; j++) {
        var yy = by + 4 + j * (b.h / 5), ll = 16 + ((j * 11 + t * 2) % 26);
        ctx.fillRect(Math.round(bx + s * (b.w / 2 + 4)), Math.round(yy), Math.round(s * ll), 1);
      }
    }
    ctx.restore();
  }

  /** Ueber dem Bild: BOSSKAMPF, ganz am Anfang (Balken und Name: bosskino.js). */
  function draw(ctx, G, W, H) {
    var au = G.auftritt;
    if (!au) return;
    var t = au.t;
    if (t > 6 && t < 80) {
      var k = (t - 6) / 74, al = Math.min(1, (t - 6) / 12) * Math.min(1, (80 - t) / 16);
      var y = Math.round(H * 0.28), tr = 4 + k * 4;
      var w = F.measure('BOSSKAMPF', 2, tr), half = w / 2 + 14 + 70 * weich(k * 1.6);
      ctx.save();
      ctx.globalAlpha = al;
      for (var s = -1; s <= 1; s += 2) {
        var lg = ctx.createLinearGradient(W / 2 + s * (w / 2 + 10), 0, W / 2 + s * half, 0);
        lg.addColorStop(0, 'rgba(255,70,60,0.9)');
        lg.addColorStop(1, 'rgba(255,70,60,0)');
        ctx.fillStyle = lg;
        var x0 = s < 0 ? W / 2 - half : W / 2 + w / 2 + 10;
        ctx.fillRect(Math.round(x0), y + 6, Math.round(half - w / 2 - 10), 1);
      }
      F.draw(ctx, 'BOSSKAMPF', W / 2, y, { color: '#ff7a68', align: 'center', scale: 2, tracking: tr, shadow: true, shadowColor: '#2a0606' });
      ctx.restore();
    }
  }

  global.Auftritt = { start: start, tick: tick, draw: draw, welt: welt, AUFTRITTE: AUFTRITTE, DAUER: DAUER };

})(window);
