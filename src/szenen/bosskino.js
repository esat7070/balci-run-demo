/* =====================================================================
   bosskino.js — die grossen Momente im Bosskampf, gross wie in einem
   Soulslike (Esat, 28.10.: "die Boss-Intros muessen viel epischer sein,
   und jede Verwandlung episch wie in Elden Ring").

   Die Kamera kann jetzt auch mitten im Spiel naeher ran (game.js fragt
   BossKino.zoom), und es gibt Effekte in der Welt (Druckwellen, eine
   Lichtsaeule, gluehende Risse im Boden, schwebende Brocken, Glut in der
   Luft) und ueber dem Bild (Farbe weg, Dunkelheit, Sog, Farbversatz,
   Zoom-Unschaerfe, Kinobalken, der grosse Name, FEIND BEZWUNGEN).

   Eine Verwandlung (bossKit.startTransform, Semihs wechselStart):
     1. Treffer: Das Bild steht kurz, die Musik geht weg.
     2. Die Kamera faehrt langsam an den Boss. Die Welt verliert ihre
        Farbe und ihr Licht, ein Herz schlaegt. Brocken heben vom Boden
        ab, der Boden reisst gluehend auf, Licht wird eingesogen.
     3. Dann laeuft die Verwandlung des Bosses selbst (sein Zustand
        'transform'), der Rest der Welt bleibt stehen. Ein Ring zieht
        sich um ihn zusammen, alles wird still.
     4. AUSBRUCH (wenn er die Form wechselt): Blitz, Druckwellen, eine
        Lichtsaeule, die Brocken fliegen weg, die Farbe kommt mit einem
        Schlag zurueck, die Musik auch.
     5. Der neue Name erscheint gross, darunter die Herzen. Erst danach
        redet der Boss (game.js bossPhase wartet). Wenn es weitergeht,
        laeuft sein Balken neu voll.
   Danach glimmt in der Arena Glut in seiner Farbe, mehr mit jedem Herz.
   Sprung spult vor. G.keinAuftritt (Tests) laesst die Verwandlung wie
   frueher ablaufen.
   ===================================================================== */
(function (global) {
  'use strict';

  var F = global.Font, P = global.Pixel;
  function LI() { return global.Licht; }
  function S() { return global.Sound; }

  // Eigene Zufallsfolge: Math.random ist in den Tests geseedet, und reine
  // Optik soll die Bot-Vergleiche nicht verschieben.
  var saat = 20261028;
  function zufall() { saat = (saat * 16807) % 2147483647; return (saat - 1) / 2147483646; }
  function zw(a, b) { return a + (b - a) * zufall(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function glatt(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function raus(k) { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k) * (1 - k); }
  function rgba(col, a) {
    a = clamp(a, 0, 1);
    return LI() ? LI().rgba(col, +a.toFixed(3)) : col;
  }
  function blitzeAn() { var O = global.Optionen; return !O || typeof O.blitze !== 'function' || O.blitze(); }
  function ton(n, arg) { var s = S(); if (s) s.play(n, arg); }
  function daempfen(z, sek) { var s = S(); if (s && s.daempfen) s.daempfen(z, sek); }
  function gedrueckt() { var I = global.Input; return !!(I && (I.hit('jump') || I.hit('confirm'))); }
  function stufe() { return LI() ? LI().stufe() : 1; }

  /* ================= Was ueber dem Bild liegt =================
     Jeder Wert hat ein Ziel (…Z) und gleitet dorthin. */
  function bild(G) {
    return G.film || (G.film = {
      grau: 0, grauZ: 0, dunkel: 0, dunkelZ: 0, balken: 0, balkenZ: 0, sog: 0, sogZ: 0,
      punkt: null, col: '#ffffff', ring: 0, ringAn: false,
      ca: 0, blur: 0, linien: 0, blitz: 0, blitzMax: 1, blitzCol: '#ffffff'
    });
  }
  function nach(v, z, f) { return Math.abs(z - v) < 0.003 ? z : v + (z - v) * f; }

  /* ================= Kamera =================
     G.filmKamera: wohin (x, y in der Welt) und wie nah (z). */
  function kamera(G, x, y, z, tempo) {
    var k = G.filmKamera;
    if (!k) k = G.filmKamera = { x: x, y: y, z: 1, zx: x, zy: y, zz: 1, tempo: 0.08, frei: false, ruck: 0 };
    k.zx = x; k.zy = y; k.zz = Math.max(1, z || 1); k.tempo = tempo || 0.08; k.frei = false;
    return k;
  }
  function kameraFrei(G, tempo) {
    var k = G.filmKamera;
    if (k) { k.zz = 1; k.frei = true; k.tempo = tempo || 0.07; }
  }
  function kameraTick(G) {
    var k = G.filmKamera;
    if (!k) return;
    var f = k.tempo;
    k.z = Math.exp(Math.log(k.z) + (Math.log(k.zz) - Math.log(k.z)) * f);
    k.x += (k.zx - k.x) * Math.min(1, f * 1.6);
    k.y += (k.zy - k.y) * Math.min(1, f * 1.6);
    k.ruck *= 0.82;
    if (k.frei && k.z < 1.004 && k.ruck < 0.002) G.filmKamera = null;
  }
  /** Fuer game.js: um welchen Bildpunkt (sx, sy) wie stark (z) vergroessert wird. */
  function zoom(G, camX, camY, W, H) {
    var k = G.filmKamera;
    if (!k) return null;
    var z = k.z * (1 + (k.ruck || 0));
    if (z <= 1.002) return null;
    var hw = W / (2 * z), hh = H / (2 * z);
    return { z: z, sx: clamp(k.x - camX, hw, W - hw), sy: clamp(k.y - camY, hh, H - hh) };
  }
  /** Wo ein Punkt der Welt gerade im Bild ist (Kamera, Wackeln, Zoom). */
  function bildPunkt(G, wx, wy, W, H) {
    var camX = Math.round(G.cam.x + G.cam.sx), camY = Math.round(G.cam.y + G.cam.sy);
    var sx = wx - camX, sy = wy - camY, zm = zoom(G, camX, camY, W, H);
    if (zm) { sx = (sx - zm.sx) * zm.z + W / 2; sy = (sy - zm.sy) * zm.z + H / 2; }
    return { x: sx, y: sy, z: zm ? zm.z : 1 };
  }

  /* ================= Effekte in der Welt ================= */
  function fx(G, o) { o.t = 0; (G.filmFx || (G.filmFx = [])).push(o); return o; }

  /** Druckwelle: flach am Boden (flach ~0.2) oder rund um den Koerper (1). */
  function welle(G, x, y, col, o) {
    o = o || {};
    return fx(G, { art: 'welle', x: x, y: y, col: col, max: o.max || 40, r1: o.r || 240, dicke: o.dicke || 6,
                   flach: o.flach === undefined ? 0.2 : o.flach, verz: o.verz || 0 });
  }
  /** Lichtsaeule vom Boden in den Himmel. */
  function saeule(G, x, y, col, max, breit) {
    return fx(G, { art: 'saeule', x: x, y: y, col: col, max: max || 70, breit: breit || 1 });
  }
  /** Gluehende Risse im Boden, wachsen mit o.an (0..1), leuchten mit o.hell. */
  function risse(G, x, y, col) {
    var aeste = [];
    for (var s = -1; s <= 1; s += 2) {
      for (var n = 0; n < 3; n++) {
        var px = x + s * zw(1, 7), py = y + 1, pts = [[px, py]];
        var len = 5 + Math.floor(zw(0, 5)) - n;
        for (var i = 0; i < len; i++) {
          px += s * zw(4, 11);
          py = Math.max(y + 1, py + zw(-2, 5) * (n === 0 ? 0.35 : (n === 1 ? 1 : 2)));
          pts.push([px, py]);
        }
        aeste.push(pts);
      }
    }
    return fx(G, { art: 'risse', x: x, y: y, col: col, max: 1e9, aeste: aeste, an: 0, hell: 0, aus: false });
  }
  /** Brocken, die vom Boden abheben und schweben (bis explodiere). */
  function brocken(G, x, boden, col, n) {
    var liste = [];
    for (var i = 0; i < n; i++) {
      var s = i % 2 ? -1 : 1;
      liste.push({ x: x + s * zw(14, 86), y: boden - 1, h: zw(8, 58), vx: 0, vy: 0, rot: zw(0, 6), vr: zw(-0.05, 0.05),
                   w: Math.round(zw(3, 9)), hh: Math.round(zw(3, 7)), verz: Math.floor(zw(0, 46)), frei: false, a: 1 });
    }
    return fx(G, { art: 'brocken', col: col, max: 1e9, liste: liste, boden: boden });
  }
  function explodiere(o, mx) {
    for (var i = 0; i < o.liste.length; i++) {
      var s = o.liste[i];
      s.frei = true;
      s.vx = (s.x < mx ? -1 : 1) * zw(1.8, 5.2);
      s.vy = -zw(1.2, 4.4);
      s.vr *= 5;
    }
    o.max = o.t + 80;
  }
  /** Ein Blitz von oben (Nils). */
  function blitzstrahl(G, x, boden, col) {
    var pts = [], y = boden - 300, px = x;
    while (y < boden) { pts.push([px, y]); y += zw(14, 30); px = x + zw(-14, 14); }
    pts.push([x, boden]);
    return fx(G, { art: 'blitzstrahl', col: col, max: 22, pts: pts });
  }
  /** Staub, der irgendwo im Bild von der Decke rieselt (eigener Zufall). */
  function rieseln(G, n, W) {
    for (var i = 0; i < n; i++) {
      G.particles.spawn({ x: G.cam.x + zw(10, W - 10), y: G.cam.y - 2, vx: zw(-0.15, 0.15), vy: zw(0.2, 1),
                          life: Math.round(zw(60, 110)), col: zufall() < 0.5 ? '#bfae98' : '#8a7c6c', size: zufall() < 0.3 ? 2 : 1, grav: 0.03 });
    }
  }
  /** Staubwolke am Boden, nach beiden Seiten. */
  function staub(G, x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var s = i % 2 ? -1 : 1;
      G.particles.spawn({ x: x + s * zw(0, 10), y: y - zw(0, 4), vx: s * zw(0.6, 4.2), vy: -zw(0.1, 1.6),
                          life: Math.round(zw(30, 60)), col: col || '#d8ccb8', size: zufall() < 0.4 ? 3 : 2, grav: 0.04 });
    }
  }
  /** Funken, die auseinanderfliegen. */
  function funken(G, x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var w = zw(0, Math.PI * 2), v = zw(1.5, 5.5);
      G.particles.spawn({ x: x, y: y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 1, life: Math.round(zw(26, 58)),
                          col: zufall() < 0.3 ? '#ffffff' : col, size: zufall() < 0.3 ? 3 : 2, grav: 0.08 });
    }
  }

  function fxTick(G) {
    var l = G.filmFx;
    if (!l || !l.length) return;
    for (var i = l.length - 1; i >= 0; i--) {
      var o = l[i];
      o.t++;
      if (o.art === 'brocken') {
        for (var j = 0; j < o.liste.length; j++) {
          var s = o.liste[j];
          if (s.frei) {
            s.vy += 0.24; s.x += s.vx; s.y += s.vy; s.rot += s.vr;
            if (s.y > o.boden - 1 && s.vy > 0) { s.y = o.boden - 1; s.vy *= -0.3; s.vx *= 0.6; s.vr *= 0.5; }
            if (o.t > o.max - 30) s.a = Math.max(0, (o.max - o.t) / 30);
          } else if (o.t > s.verz) {
            s.y += ((o.boden - s.h) - s.y) * 0.025;
            s.rot += s.vr;
          }
        }
      }
      if (o.art === 'risse' && o.aus) { o.hell *= 0.95; if (o.hell < 0.02) o.max = 0; }
      if (o.t >= o.max) l.splice(i, 1);
    }
  }

  function welleZeichnen(ctx, o, camX, camY) {
    var t = o.t - o.verz;
    if (t < 0) return;
    var k = t / (o.max - o.verz), r = o.r1 * raus(k), a = 1 - k;
    if (a <= 0 || r < 1) return;
    var x = o.x - camX, y = o.y - camY;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, o.dicke * (1 - k * 0.8));
    ctx.strokeStyle = rgba(o.col, a * 0.85);
    ctx.beginPath(); ctx.ellipse(x, y, r, Math.max(1, r * o.flach), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, o.dicke * 0.35 * (1 - k));
    ctx.strokeStyle = rgba('#ffffff', a * 0.75);
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.985, Math.max(1, r * o.flach * 0.985), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function saeuleZeichnen(ctx, o, camX, camY) {
    var k = o.t / o.max, a = k < 0.06 ? k / 0.06 : 1 - glatt((k - 0.06) / 0.94);
    if (a <= 0.01) return;
    var x = o.x - camX, fuss = o.y - camY, top = -60;
    var w = (8 + 30 * (1 - raus(k * 1.4))) * o.breit;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, rgba(o.col, 0));
    g.addColorStop(0.3, rgba(o.col, 0.45 * a));
    g.addColorStop(0.5, rgba('#ffffff', 0.9 * a));
    g.addColorStop(0.7, rgba(o.col, 0.45 * a));
    g.addColorStop(1, rgba(o.col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - w), top, Math.round(w * 2), Math.round(fuss - top));
    // ein weicher Schein drumherum und ein heller Fuss
    var g2 = ctx.createLinearGradient(x - w * 3.5, 0, x + w * 3.5, 0);
    g2.addColorStop(0, rgba(o.col, 0)); g2.addColorStop(0.5, rgba(o.col, 0.18 * a)); g2.addColorStop(1, rgba(o.col, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(Math.round(x - w * 3.5), top, Math.round(w * 7), Math.round(fuss - top));
    ctx.restore();
    if (LI()) { LI().glowOval(ctx, x, fuss, 50 + w * 2, 14, o.col, 0.7 * a); LI().glow(ctx, x, fuss - 6, 26 + w, '#ffffff', 0.35 * a); }
  }

  function risseZeichnen(ctx, o, camX, camY) {
    var an = o.an, hell = Math.min(1.6, o.hell);
    if (an <= 0.01 || hell <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? rgba('#fff2d0', 0.85 * Math.min(1, hell)) : rgba(o.col, 0.4 * hell);
      ctx.lineWidth = pass ? 1 : 3;
      ctx.beginPath();
      for (var i = 0; i < o.aeste.length; i++) {
        var pts = o.aeste[i], n = (pts.length - 1) * an, ganz = Math.floor(n);
        ctx.moveTo(pts[0][0] - camX, pts[0][1] - camY);
        for (var j = 1; j <= ganz; j++) ctx.lineTo(pts[j][0] - camX, pts[j][1] - camY);
        if (ganz < pts.length - 1) {
          var r = n - ganz, a = pts[ganz], b = pts[ganz + 1];
          ctx.lineTo(a[0] + (b[0] - a[0]) * r - camX, a[1] + (b[1] - a[1]) * r - camY);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
    if (LI()) LI().glowOval(ctx, o.x - camX, o.y - camY + 2, 30 + 60 * an, 9, o.col, 0.4 * Math.min(1, hell));
  }

  function brockenZeichnen(ctx, o, camX, camY) {
    for (var i = 0; i < o.liste.length; i++) {
      var s = o.liste[i];
      if (!s.frei && o.t <= s.verz) continue;
      if (s.a <= 0.02) continue;
      var zit = s.frei ? 0 : Math.sin(o.t * 0.9 + i * 1.7) * 0.6;
      var x = s.x - camX + zit, y = s.y - camY;
      if (!s.frei && LI()) LI().glow(ctx, x, y + 2, 7 + s.w, o.col, 0.25);
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(s.rot);
      ctx.fillStyle = '#1e1816';
      ctx.fillRect(-s.w / 2 - 1, -s.hh / 2 - 1, s.w + 2, s.hh + 2);
      ctx.fillStyle = '#5e4e44';
      ctx.fillRect(-s.w / 2, -s.hh / 2, s.w, s.hh);
      ctx.fillStyle = '#8e7a6a';
      ctx.fillRect(-s.w / 2, -s.hh / 2, s.w - 1, 1);
      ctx.fillRect(-s.w / 2, -s.hh / 2, 1, s.hh - 1);
      ctx.fillStyle = '#3a302a';
      ctx.fillRect(-s.w / 2 + 1, s.hh / 2 - 1, s.w - 1, 1);
      // von unten angestrahlt: Glut in seiner Farbe
      if (!s.frei) { ctx.fillStyle = rgba(o.col, 0.9); ctx.fillRect(-s.w / 2, s.hh / 2 - 1, s.w, 1); }
      ctx.restore();
    }
  }

  function blitzstrahlZeichnen(ctx, o, camX, camY) {
    var a = 1 - o.t / o.max;
    if (a <= 0 || ((o.t >> 1) % 3 === 2 && o.t < 10)) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'miter';
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? rgba('#ffffff', a) : rgba(o.col, 0.6 * a);
      ctx.lineWidth = pass ? 2 : 6;
      ctx.beginPath();
      for (var i = 0; i < o.pts.length; i++) {
        var p = o.pts[i];
        if (i) ctx.lineTo(p[0] - camX, p[1] - camY); else ctx.moveTo(p[0] - camX, p[1] - camY);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Glut in der Luft: nach jeder Verwandlung mehr, in der Farbe des Bosses. */
  function glut(ctx, G, W, H) {
    var b = G.boss;
    if (!b || b.dead || !G.bossStarted || !b.lebenMax || !(b.leben < b.lebenMax) || stufe() < 1) return;
    var n = Math.min(24, (b.lebenMax - b.leben) * 9), col = b.rageCol || '#ff6a3c', t = G.tick;
    var camX = G.cam.x;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) {
      var sp = 0.22 + ((i * 53) % 10) / 24;
      var x = (((i * 137.7 + 40 - camX * 0.8 + Math.sin(t * 0.013 + i) * 16) % (W + 40)) + W + 40) % (W + 40) - 20;
      var y = H + 10 - ((t * sp + i * 71) % (H + 30));
      var a = 0.55 * Math.min(1, (H + 10 - y) / 50) * (0.55 + 0.45 * Math.sin(t * 0.09 + i * 2.3));
      if (a <= 0.02) continue;
      var gr = i % 4 ? 1 : 2;
      ctx.fillStyle = rgba(col, a);
      ctx.fillRect(Math.round(x), Math.round(y), gr, gr);
    }
    ctx.restore();
  }

  /** In der Welt, hinter dem Boss (game.js drawScene). */
  function hinten(ctx, G, camX, camY, W, H) {
    var l = G.filmFx, i, f = G.film;
    // Waehrend Auftritt und Verwandlung leuchtet es hinter ihm, im Takt
    if (f && f.punkt && (G.verwandlung || (G.auftritt && G.auftritt.gelandet) || G.filmName) && LI()) {
      var pul = 0.75 + 0.25 * Math.sin(G.tick * 0.12);
      LI().glow(ctx, f.punkt.x - camX, f.punkt.y - camY, f.punkt.r * 2.6, f.col, 0.32 * pul);
    }
    if (l) {
      for (i = 0; i < l.length; i++) {
        var o = l[i];
        if (o.art === 'saeule') saeuleZeichnen(ctx, o, camX, camY);
        else if (o.art === 'risse') risseZeichnen(ctx, o, camX, camY);
      }
    }
    if (G.auftritt && global.Auftritt && global.Auftritt.welt) global.Auftritt.welt(ctx, G, camX, camY, W, H);
  }
  /** In der Welt, vor allen Figuren. */
  function vorne(ctx, G, camX, camY, W, H) {
    var l = G.filmFx, i;
    if (l) {
      for (i = 0; i < l.length; i++) {
        var o = l[i];
        if (o.art === 'welle') welleZeichnen(ctx, o, camX, camY);
        else if (o.art === 'brocken') brockenZeichnen(ctx, o, camX, camY);
        else if (o.art === 'blitzstrahl') blitzstrahlZeichnen(ctx, o, camX, camY);
      }
    }
    glut(ctx, G, W, H);
  }

  /* ================= Ueber dem Bild ================= */

  function grau(ctx, W, H, a, pk, r) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    var g = ctx.createRadialGradient(pk.x, pk.y, r * 0.7, pk.x, pk.y, r * 2.2);
    g.addColorStop(0, 'rgba(128,128,128,0)');
    g.addColorStop(1, 'rgba(128,128,128,' + clamp(a, 0, 1).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function dunkel(ctx, W, H, a, pk, r) {
    var g = ctx.createRadialGradient(pk.x, pk.y, r * 0.9, pk.x, pk.y, r * 0.9 + W * 0.52);
    g.addColorStop(0, 'rgba(3,1,6,0)');
    g.addColorStop(0.35, 'rgba(3,1,6,' + (a * 0.72).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(3,1,6,' + clamp(a, 0, 1).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /** Licht wird zum Boss gesogen: Striche, die immer schneller nach innen fliegen. */
  function sog(ctx, G, W, H, f, pk, r) {
    var a = f.sog, t = G.tick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (var i = 0; i < 34; i++) {
      var w = i * 2.39996;
      var ph = (t * (0.011 + (i % 5) * 0.0035) + i * 0.137) % 1;
      var d = r * 1.1 + (1 - ph * ph) * W * 0.58, len = 6 + ph * 30;
      var cx = Math.cos(w), cy = Math.sin(w);
      ctx.strokeStyle = rgba(i % 3 ? f.col : '#ffffff', a * Math.sin(ph * Math.PI) * 0.75);
      ctx.lineWidth = i % 4 ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(pk.x + cx * d, pk.y + cy * d);
      ctx.lineTo(pk.x + cx * (d + len), pk.y + cy * (d + len));
      ctx.stroke();
    }
    ctx.restore();
    if (LI()) LI().glow(ctx, pk.x, pk.y, r * (1.6 + a * 1.4), f.col, 0.55 * a);
  }

  /** Der Ring, der sich zusammenzieht, kurz vor dem Ausbruch. */
  function ringZu(ctx, f, pk, r, W) {
    var k = f.ring, rad = r * 0.8 + (1 - raus(k)) * W * 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(f.col, 0.25 + 0.6 * k);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pk.x, pk.y, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.5 * k);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(pk.x, pk.y, rad - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /** Nach dem Ausbruch: Striche von ihm weg bis an den Bildrand. */
  function linien(ctx, f, pk, W) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var d1 = W * 1.2;
    for (var i = 0; i < 40; i++) {
      var w = i * 0.157 + (i % 3) * 0.05;
      var d0 = 26 + ((i * 37) % 50) + (1 - f.linien) * 60;
      var br = 0.006 + (i % 4) * 0.004;
      ctx.fillStyle = rgba(i % 2 ? '#ffffff' : f.col, f.linien * (i % 2 ? 0.35 : 0.5));
      ctx.beginPath();
      ctx.moveTo(pk.x + Math.cos(w) * d0, pk.y + Math.sin(w) * d0);
      ctx.lineTo(pk.x + Math.cos(w - br) * d1, pk.y + Math.sin(w - br) * d1);
      ctx.lineTo(pk.x + Math.cos(w + br) * d1, pk.y + Math.sin(w + br) * d1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Farbversatz wie bei einer Linse: Rot etwas groesser, Blau dazwischen. */
  function farbVersatz(ctx, G, W, H, px, pk) {
    var cv = G._canvas, L = LI();
    if (!cv || !L || stufe() < 1) return;
    var cw = cv.width, ch = cv.height;
    var teile = [[L.puffer('filmRot', cw, ch), '#ff0000', 1 + 2 * px / W], [L.puffer('filmBlau', cw, ch), '#0000ff', 1 + px / W]];
    for (var i = 0; i < 2; i++) {
      var x = teile[i][0].getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = 'copy';
      x.drawImage(cv, 0, 0);
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = teile[i][1];
      x.fillRect(0, 0, cw, ch);
      x.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    for (i = 0; i < 2; i++) {
      var s = teile[i][2];
      ctx.drawImage(teile[i][0], pk.x - pk.x * s, pk.y - pk.y * s, W * s, H * s);
    }
    ctx.restore();
  }

  function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  /** Ein Schriftzug, der leuchtet (Schatten in Farbe, weich). */
  function leuchtText(ctx, txt, x, y, o, glow, staerke) {
    var m = ctx.getTransform ? ctx.getTransform() : null, rs = m ? Math.abs(m.a) || 1 : 1;
    ctx.save();
    if (glow && staerke > 0 && stufe() >= 1) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 9 * rs * staerke;
    }
    F.draw(ctx, txt, x, y, o);
    ctx.restore();
  }

  /** Der grosse Name (Boss-Auftritt und jede Verwandlung).
      n: { oben, gross, unten, col, herzen: {max, da}, t, max } */
  function nameZeichnen(ctx, G, n, W, H) {
    var t = n.t, a = clamp(t / 12, 0, 1) * clamp((n.max - t) / 20, 0, 1);
    if (a <= 0.01) return;
    var sc = F.measure(n.gross, 3, 2) > W - 60 ? 2 : 3;
    // Unten im Bild, ausser er steht selbst da unten: dann oben
    var y = n.y;
    if (!y) {
      y = H * 0.66;
      var b = G.boss;
      if (b && !b.dead) {
        var fuss = bildPunkt(G, b.cx(), b.y + b.h, W, H).y, kopf = bildPunkt(G, b.cx(), b.y, W, H).y;
        if (fuss > y - 18 && kopf > H * 0.17 + 58) y = H * 0.17;
      }
      if (n.yFest === undefined || n.t < 3) n.yFest = y;
      y = n.yFest;
    }
    y = Math.round(y);
    var k = raus(t / 30);
    var tr = 2 + (1 - k) * 7;                       // die Buchstaben ruecken zusammen
    var gw = F.measure(n.gross, sc, tr);
    ctx.save();
    ctx.globalAlpha = a;
    // dunkles Band, oben und unten weich
    var g = ctx.createLinearGradient(0, y - 34, 0, y + 58);
    g.addColorStop(0, 'rgba(2,1,4,0)');
    g.addColorStop(0.35, 'rgba(2,1,4,0.62)');
    g.addColorStop(0.65, 'rgba(2,1,4,0.62)');
    g.addColorStop(1, 'rgba(2,1,4,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 34, W, 92);
    if (LI()) LI().glowOval(ctx, W / 2, y + 3.5 * sc, gw * 0.62, 18, n.col, 0.32 * a);
    // klein oben (wer), mit weitem Abstand
    if (n.oben) F.draw(ctx, n.oben, W / 2, y - 14, { color: '#cfc4ae', align: 'center', tracking: 3, shadow: true });
    // gross: der Name. Leuchtet beim Erscheinen kurz auf.
    var puls = 0.6 + 0.9 * Math.max(0, 1 - t / 26);
    leuchtText(ctx, n.gross, W / 2, y, { color: '#f7efdc', align: 'center', scale: sc, tracking: tr, shadow: true, shadowColor: 'rgba(0,0,0,0.7)' }, n.col, puls);
    // die Linie darunter waechst nach aussen, in der Mitte eine Raute
    var ly = y + 7 * sc + 6, half = (gw / 2 + 34) * raus((t - 6) / 34);
    if (half > 2) {
      for (var s = -1; s <= 1; s += 2) {
        var lg = ctx.createLinearGradient(W / 2, 0, W / 2 + s * half, 0);
        lg.addColorStop(0, rgba(n.col, 0.95)); lg.addColorStop(0.6, rgba(n.col, 0.5)); lg.addColorStop(1, rgba(n.col, 0));
        ctx.fillStyle = lg;
        ctx.fillRect(s < 0 ? Math.round(W / 2 - half) : Math.round(W / 2), ly, Math.round(half), 1);
      }
      ctx.fillStyle = n.col;
      ctx.fillRect(Math.round(W / 2) - 1, ly - 2, 3, 5);
      ctx.fillRect(Math.round(W / 2) - 2, ly - 1, 5, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(W / 2), ly, 1, 1);
    }
    // klein unten: was er ist
    var uy = ly + 7;
    if (n.unten) {
      ctx.globalAlpha = a * clamp((t - 14) / 14, 0, 1);
      F.draw(ctx, n.unten, W / 2, uy, { color: '#ddd3bf', align: 'center', shadow: true });
      uy += 12;
    }
    // die Herzen: wie viele noch, wie viele schon weg
    if (n.herzen && P && P.get) {
      var hz = P.get('herz'), hw = hz ? hz.w : 9, nn = n.herzen.max, bx = Math.round(W / 2 - (nn * (hw + 3) - 3) / 2);
      for (var i = 0; i < nn; i++) {
        var da = i < n.herzen.da;
        ctx.globalAlpha = a * clamp((t - 18 - i * 4) / 10, 0, 1) * (da ? 1 : 0.28);
        P.draw(ctx, 'herz', bx + i * (hw + 3), uy);
      }
    }
    ctx.restore();
  }

  /** Ein grosser Schriftzug auf dunklem Band, der ganz langsam waechst, mit
      einem Echo, das schneller waechst und verblasst (FEIND BEZWUNGEN,
      YUSUF WURDE BESIEGT).
      o: { text, t, max (oder 0 = bleibt), rein (Ticks), y, farbe, glow,
           echo, band (Farbe der Bandmitte), schatten, unten, untenFarbe } */
  function titel(ctx, o, W, H) {
    var t = o.t, a = clamp(t / (o.rein || 10), 0, 1) * (o.max ? clamp((o.max - t) / 16, 0, 1) : 1);
    if (a <= 0.01) return;
    var y = Math.round(o.y === undefined ? H * 0.38 : o.y);
    var sc = F.measure(o.text, 3, 2) > W - 40 ? 2 : 3, th = 7 * sc;
    ctx.save();
    ctx.globalAlpha = a;
    var g = ctx.createLinearGradient(0, y - 32, 0, y + th + 32);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.4, o.band || 'rgba(2,1,4,0.66)');
    g.addColorStop(0.6, o.band || 'rgba(2,1,4,0.66)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 32, W, th + 64);
    var wachs = 1 + t * (o.wachsen || 0.0012);
    // das Echo: groesser, schneller wachsend, blass
    var echo = 1.03 + t * 0.003;
    ctx.save();
    ctx.translate(W / 2, y + th / 2);
    ctx.scale(echo, echo);
    ctx.globalAlpha = a * 0.2 * clamp(1 - t / (o.max || 160), 0, 1);
    F.draw(ctx, o.text, 0, -th / 2, { color: o.echo || o.farbe, align: 'center', scale: sc, tracking: 2 });
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2, y + th / 2);
    ctx.scale(wachs, wachs);
    ctx.globalAlpha = a;
    ctx.imageSmoothingEnabled = true;
    leuchtText(ctx, o.text, 0, -th / 2, { color: o.farbe, align: 'center', scale: sc, tracking: 2, shadow: true, shadowColor: o.schatten || '#000000' },
               o.glow, 1.1);
    ctx.restore();
    if (o.unten) {
      ctx.globalAlpha = a * clamp((t - (o.untenAb || 14)) / 20, 0, 1);
      F.draw(ctx, o.unten, W / 2, y + th + 12, { color: o.untenFarbe || '#d8c8a0', align: 'center', tracking: 2, shadow: true });
    }
    ctx.restore();
  }

  /** FEIND BEZWUNGEN: golden auf dunklem Band. */
  function siegZeichnen(ctx, G, s, W, H) {
    titel(ctx, { text: s.text, t: s.t, max: s.max, y: H * 0.36, farbe: '#ffe6a6', glow: '#ffb43c', echo: '#ffd98a',
                 schatten: '#3a2208', unten: s.unten }, W, H);
  }

  /** Alles ueber dem Bild (game.js render, vor HUD und Dialog). */
  function oben(ctx, G, W, H) {
    var f = G.film;
    if (f) {
      var pk = f.punkt ? bildPunkt(G, f.punkt.x, f.punkt.y, W, H) : { x: W / 2, y: H / 2, z: 1 };
      var r = (f.punkt && f.punkt.r || 30) * pk.z;
      if (f.blur > 0.02 && LI() && G._canvas) LI().zoomUnschaerfe(ctx, G._canvas, W, H, 0.08 * f.blur, 0.6 * f.blur, pk.x, pk.y);
      if (f.ca > 0.15) farbVersatz(ctx, G, W, H, f.ca, pk);
      if (f.grau > 0.01) grau(ctx, W, H, f.grau, pk, r);
      if (f.dunkel > 0.01) dunkel(ctx, W, H, f.dunkel, pk, r);
      if (f.sog > 0.01) sog(ctx, G, W, H, f, pk, r);
      if (f.ringAn && f.ring > 0.01) ringZu(ctx, f, pk, r, W);
      if (f.linien > 0.01) linien(ctx, f, pk, W);
      if (f.blitz > 0 && blitzeAn()) {
        ctx.globalAlpha = (f.blitzA || 0.92) * clamp(f.blitz / f.blitzMax, 0, 1);
        rect(ctx, 0, 0, W, H, f.blitzCol);
        ctx.globalAlpha = 1;
      }
      // Filmkorn wie in den Kurzfilmen (kino.js), solange die Balken da sind
      if (f.balken > 0.05 && global.Kino && global.Kino.korn) global.Kino.korn(ctx, W, H, G.tick, 0.08 * f.balken);
      var bh = Math.round(30 * glatt(f.balken));
      if (bh > 0) { rect(ctx, 0, 0, W, bh, '#000000'); rect(ctx, 0, H - bh, W, bh, '#000000'); }
    }
    if (G.filmName) nameZeichnen(ctx, G, G.filmName, W, H);
    if (G.filmSieg) siegZeichnen(ctx, G, G.filmSieg, W, H);
  }

  /* ================= Name einblenden ================= */
  function name(G, o) {
    o.t = 0; o.max = o.max || 150;
    G.filmName = o;
    return o;
  }

  /* ================= Verwandlung ================= */
  var V = {
    RAN: 14,       // die Kamera faehrt an den Boss
    BROCKEN: 22,   // Brocken heben ab
    RISSE: 40,     // der Boden reisst auf
    SOG: 34,       // Licht wird eingesogen
    LOS: 92,       // ab hier verwandelt er sich (sein eigener Zustand 'transform')
    NAME: 32,      // nach dem Ausbruch: der Name
    ENDE: 146,     // ... Kamera zurueck
    RAUS: 22       // ... und weiter
  };

  /** Die Farbe der Form, die gleich kommt. */
  function naechsteFarbe(b) {
    if (b.formen && b.formen[b.form + 1]) return b.formen[b.form + 1].col;
    if (b.letzteForm && b.leben <= 1) return b.letzteForm.col;
    return b.rageCol || '#ff4a4a';
  }
  function bodenUnter(G, x, y) {
    var w = G.world;
    if (!w || !w.solid) return null;
    var tx = Math.floor(x / 16), ty = Math.floor(y / 16);
    for (var i = 0; i < 6; i++) if (w.solid(tx, ty + i)) return (ty + i) * 16;
    return null;
  }

  /** Eine Verwandlung beginnt (aus bossKit.startTransform / Semih). */
  function verwandlung(G, b) {
    if (!b || G.keinAuftritt || G.verwandlung || !G.player || G.player.dead || b.dead) return false;
    var mx = b.cx(), my = b.y + b.h / 2;
    var v = G.verwandlung = {
      b: b, t: 0, col: naechsteFarbe(b), los: false, aus: false, ausbruchT: 0, nachher: null, fertig: false,
      boden: bodenUnter(G, mx, b.y + b.h), eilig: 1, brocken: null, risse: null
    };
    G.frozen = true;
    // Das Bild steht kurz (Treffer), dann geht es langsam los
    if (!G.keinHitstop) G.hitstop = Math.max(G.hitstop || 0, 8);
    var f = bild(G);
    f.punkt = { x: mx, y: my, r: clamp(b.h * 0.55, 16, 40) };
    f.col = v.col;
    f.ringAn = false; f.ring = 0;
    G.camFocus = { x: mx, y: my };
    var k = kamera(G, mx, my, 1.12, 0.25);
    k.ruck = 0.04;
    daempfen(0, 0.4);
    return true;
  }

  function verwandlungTick(G) {
    var v = G.verwandlung;
    if (!v) return;
    var b = v.b, f = bild(G);
    if (!b || G.boss !== b) { verwandlungEnde(G); return; }
    v.t++;
    var t = v.t;
    // Vorspulen: erst zur Verwandlung, dann schneller, dann zum Ende
    if (t > 14 && gedrueckt()) {
      if (!v.los && t < V.LOS - 4) v.t = t = V.LOS - 4;
      else if (!v.aus) v.eilig = 4;
      else if (t - v.ausbruchT < V.ENDE - 24) {
        v.ausbruchT = t - (V.ENDE - 24);
        v.eilig = 4;
        if (G.filmName) G.filmName.t = Math.max(G.filmName.t, G.filmName.max - 24);
      }
    }
    var mx = b.cx(), my = b.y + b.h / 2;
    f.punkt.x = mx; f.punkt.y = my;
    G.camFocus = { x: mx, y: my };
    if (!v.aus) {
      // Die Welt verliert Farbe und Licht, das Herz schlaegt
      f.balkenZ = 1;
      f.grauZ = t > 6 ? 0.92 : 0;
      f.dunkelZ = t > 8 ? (v.los ? 0.84 : 0.62) : 0;
      // Etwas unter ihn zielen: er steht oben im Bild, unten ist Platz fuer den Namen
      if (t === V.RAN) kamera(G, mx, my + 10, 1.7, 0.032);
      if (t === 10 || t === 44 || t === 72) ton('herzschlag', t === 10 ? 0 : (t === 44 ? 1 : 2));
      if (t >= V.BROCKEN && !v.brocken && v.boden !== null) {
        v.brocken = brocken(G, mx, v.boden, v.col, 12);
        ton('grollen');
      }
      if (t >= V.RISSE && !v.risse && v.boden !== null) v.risse = risse(G, mx, v.boden, v.col);
      if (v.risse) {
        v.risse.an = clamp((t - V.RISSE) / 46, 0, 1);
        v.risse.hell = (0.35 + 0.65 * clamp((t - V.RISSE) / 70, 0, 1)) * (0.8 + 0.2 * Math.sin(t * 0.45));
      }
      f.sogZ = t > V.SOG ? clamp((t - V.SOG) / 70, 0, 1) : 0;
      // Der Sog ist zu hoeren, bis zum Ausbruch (LOS + 36 Ticks des Bosses)
      if (t === V.LOS - 40) ton('sog', 1.3);
      if (t % 9 === 0 && t > V.BROCKEN) G.shake(1 + t / 50, 9);
      if (t >= V.LOS && !v.los) {
        v.los = true;
        f.ringAn = true; f.ring = 0;
        kamera(G, mx, my + 10, 2.1, 0.028);
      }
      if (v.los) f.ring = clamp(f.ring + 1 / 34, 0, 1);
    } else {
      var a = t - v.ausbruchT;
      if (a === V.NAME) {
        var kt = G.formKarte ? G.formKarte(b) : [null, b.rageName, null, b.rageCol];
        name(G, { oben: kt[0], gross: kt[1] || '', unten: kt[2], col: kt[3] || v.col,
                  herzen: b.lebenMax ? { max: b.lebenMax, da: b.leben } : null, max: V.ENDE + V.RAUS - V.NAME + 6 });
        ton('enthuellung');
      }
      if (a === 3) f.dunkelZ = 0.12;
      if (a === V.ENDE) { kameraFrei(G, 0.08); f.balkenZ = 0; f.dunkelZ = 0; }
      if (a >= V.ENDE + V.RAUS && (v.nachher || b.state !== 'transform')) { verwandlungEnde(G); return; }
    }
    // Vorgespult: die Verwandlung des Bosses laeuft schneller durch
    if (v.los && v.eilig > 1) {
      for (var e = 1; e < v.eilig && b.state === 'transform' && G.verwandlung === v; e++) b.update(G);
    }
  }

  /** Der Ausbruch (bossKit.tickTransform bei timer 60, Semih bei 72). */
  function ausbruch(G, b) {
    var v = G.verwandlung;
    if (!v || v.b !== b || v.aus) return;
    v.aus = true;
    v.ausbruchT = v.t;
    var f = bild(G), col = b.rageCol || v.col, mx = b.cx(), my = b.y + b.h / 2;
    v.col = col; f.col = col;
    f.grau = 0; f.grauZ = 0; f.dunkel = 0.25; f.dunkelZ = 0.25;
    f.sog = 0; f.sogZ = 0; f.ringAn = false; f.ring = 0;
    f.blitz = f.blitzMax = 12; f.blitzCol = '#ffffff';
    f.ca = 5; f.blur = 1; f.linien = 1;
    var fuss = v.boden !== null ? v.boden : b.y + b.h;
    welle(G, mx, fuss, col, { r: 320, max: 46, dicke: 7, flach: 0.16 });
    welle(G, mx, my, '#ffffff', { r: 190, max: 26, dicke: 4, flach: 1 });
    welle(G, mx, my, col, { r: 380, max: 58, dicke: 9, flach: 1, verz: 6 });
    saeule(G, mx, fuss, col, 86, 1.2);
    if (v.brocken) explodiere(v.brocken, mx);
    if (v.risse) { v.risse.hell = 1.6; v.risse.aus = true; }
    funken(G, mx, my, 40, col);
    staub(G, mx, fuss, 22);
    var k = G.filmKamera;
    if (k) { k.z = 1.3; k.zz = 1.55; k.tempo = 0.018; k.ruck = 0.07; k.x = mx; k.y = my + 16; k.zx = mx; k.zy = my + 16; }
    // Semih reisst die Welt in eine neue Dimension: die soll man ganz sehen
    if (k && b.formen) kameraFrei(G, 0.05);
    G.shake(14, 46);
    ton('impakt');
    daempfen(1, 1.1);
    G.bossBarFill = 0;   // sein Balken laeuft neu voll, wenn es weitergeht
  }

  /** bossPhase (game.js) fragt: erst fertig zeigen, dann reden? */
  function haelt(G, weiter) {
    var v = G.verwandlung;
    if (!v || v.fertig) return false;
    v.nachher = weiter;
    return true;
  }

  function verwandlungEnde(G) {
    var v = G.verwandlung;
    if (!v) return;
    G.verwandlung = null;
    v.fertig = true;
    G.camFocus = null;
    kameraFrei(G, 0.08);
    var f = bild(G);
    f.grauZ = 0; f.dunkelZ = 0; f.sogZ = 0; f.ringAn = false; f.balkenZ = 0;
    if (v.risse) v.risse.aus = true;
    daempfen(1, 0.4);
    G.frozen = false;
    if (v.nachher) v.nachher();
  }

  /* ================= Sieg ================= */
  /** Boss liegt (game.js siegMoment): FEIND BEZWUNGEN, Kamera ein Stueck ran. */
  function sieg(G, b) {
    if (!b) return;
    G.filmSieg = { t: 0, max: 82, text: 'FEIND BEZWUNGEN' };
    var mx = b.cx(), my = b.y + b.h / 2;
    kamera(G, mx, my, 1.22, 0.05);
    welle(G, mx, my, '#ffd98a', { r: 260, max: 40, dicke: 5, flach: 1 });
    G.filmFx = (G.filmFx || []).filter(function (o) { return o.art !== 'risse'; });
    ton('bezwungen');
  }

  /* ================= Jeden Tick (game.js updateWorld) ================= */
  function tick(G) {
    var f = G.film;
    verwandlungTick(G);
    kameraTick(G);
    fxTick(G);
    if (f) {
      f.grau = nach(f.grau, f.grauZ, 0.05);
      f.dunkel = nach(f.dunkel, f.dunkelZ, f.dunkelZ > f.dunkel ? 0.04 : 0.08);
      f.balken = nach(f.balken, f.balkenZ, 0.09);
      f.sog = nach(f.sog, f.sogZ, 0.06);
      f.ca *= 0.84; f.blur *= 0.88; f.linien *= 0.87;
      if (f.blitz > 0 && --f.blitz <= 0) f.blitzA = 0;
    }
    if (G.filmName && ++G.filmName.t >= G.filmName.max) G.filmName = null;
    if (G.filmSieg) {
      G.filmSieg.t++;
      if (G.filmSieg.t === 58) kameraFrei(G, 0.09);
      if (G.filmSieg.t >= G.filmSieg.max) G.filmSieg = null;
    }
    // Der Bossbalken laeuft voll, sobald wieder gespielt wird
    if (G.bossBarFill !== undefined && G.bossBarFill < 1 && G.state === 'play' && !G.frozen && !G.verwandlung && !G.auftritt) {
      if (G.bossBarFill === 0) ton('power');
      G.bossBarFill = Math.min(1, G.bossBarFill + 1 / 42);
    }
  }

  /** Neues Level / Neustart: alles weg. */
  function reset(G) {
    G.film = null; G.filmFx = []; G.filmKamera = null; G.filmName = null; G.filmSieg = null;
    G.verwandlung = null; G.bossBarFill = 1;
    daempfen(1, 0.05);
  }

  global.BossKino = {
    tick: tick, reset: reset, zoom: zoom, hinten: hinten, vorne: vorne, oben: oben,
    // Bausteine (auch fuer auftritt.js)
    bild: bild, kamera: kamera, kameraFrei: kameraFrei, bildPunkt: bildPunkt, name: name, titel: titel,
    welle: welle, saeule: saeule, risse: risse, brocken: brocken, explodiere: explodiere, blitzstrahl: blitzstrahl,
    rieseln: rieseln, staub: staub, funken: funken, zufall: zufall, bodenUnter: bodenUnter,
    // Verwandlung und Sieg
    verwandlung: verwandlung, ausbruch: ausbruch, haelt: haelt, sieg: sieg,
    V: V
  };

})(window);
