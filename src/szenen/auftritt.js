/* =====================================================================
   auftritt.js — Bosse treten auf wie in echten Spielen (Esat, 25.10.:
   "wenn du zu Bosskaempfen kommst, das animieren, so ins Spiel reinkommen
   lassen wie in echten Spielen").

   Vorher: Yusuf lief in die Arena, das Gitter ging zu, und sofort stand
   die Namenskarte da. Jetzt, beim ersten Betreten der Arena:
     1. Kinobalken fahren rein, ein roter Warnstreifen rauscht durchs Bild:
        BOSSKAMPF!
     2. Die Kamera faehrt zum Boss.
     3. Der Boss kommt auf seine Art rein (AUFTRITTE): faellt von oben und
        schlaegt ein, rollt mit Hupe rein, schwebt auf dem Teppich herab,
        joggt rein, springt mit Schwung, erscheint mit einem Blitz ...
     4. Einschlag: Wackeln, Staub, Brüllen. Dann wie gewohnt die
        Namenskarte und das Gespraech (game.js).
   Nach einem Tod kommt der Auftritt nicht nochmal (G.bossIntroSeen).
   Sprung oder Klick spult vor.
   ===================================================================== */
(function (global) {
  'use strict';

  var F = global.Font;
  function S() { return global.Sound; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function weich(k) { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k) * (1 - k); }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  var DAUER = 150;       // so lange dauert ein Auftritt (Ticks)
  var AN = 62;           // ab hier bewegt sich der Boss
  var DA = 112;          // hier ist er da (Einschlag)

  /* Wie jeder Boss reinkommt.
       art   fall | rein | schweben | sprung | blitz | still
       von   bei 'rein'/'sprung': von welcher Seite (1 = rechts)
       ton   Geraeusch beim Reinkommen
       ruf   was er dabei ruft (klein, ueber ihm) */
  var AUFTRITTE = {
    mirkan:   { art: 'rein', von: 1, ton: 'hupe', ruf: 'WARUM IST DAS GITTER ZU?' },
    lennart:  { art: 'fall', ton: 'bumm', ruf: 'BRO!' },
    erfan:    { art: 'schweben', ton: 'gong', ruf: 'SAFRAN!' },
    huseyin:  { art: 'rein', von: 1, ton: 'whoosh', ruf: 'KILOMETER DREIZEHN!' },
    
    _:        { art: 'fall', ton: 'bumm', ruf: null }
  };

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
    G.auftritt = { t: 0, b: b, bt: bt, x0: b.x, y0: y0, a: a, fertig: fertig, blitz: 0, gelandet: false };
    G.frozen = true;
    G.camFocus = { x: b.cx ? b.cx() : b.x + b.w / 2, y: b.y + b.h / 2 };
    stellen(G.auftritt, 0);
    if (S()) S().play('alarm');
  }

  /** Wo der Boss zum Zeitpunkt t steht (relativ zu seinem Platz). */
  function stellen(au, t) {
    var b = au.b, a = au.a, k = clamp((t - AN) / (DA - AN), 0, 1);
    var dx = 0, dy = 0, sichtbar = true;
    if (a.art === 'fall') {
      dy = -260 * (1 - k * k);                 // faellt immer schneller
      sichtbar = t >= AN - 4;
    } else if (a.art === 'schweben') {
      dy = -170 * (1 - weich(k)) + Math.sin(t * 0.15) * 3 * (1 - k);
      sichtbar = t >= AN - 20;
    } else if (a.art === 'rein') {
      dx = (a.von || 1) * 300 * (1 - weich(k));
    } else if (a.art === 'sprung') {
      dx = (a.von || 1) * 220 * (1 - k);
      dy = -Math.sin(k * Math.PI) * 90;
      sichtbar = t >= AN - 2;
    } else if (a.art === 'blitz') {
      sichtbar = t >= DA - 4;
    }
    b.x = au.x0 + dx;
    b.y = au.y0 + dy;
    au.sichtbar = sichtbar;
    b.auftrittVersteckt = !sichtbar;
  }

  function tick(G) {
    var au = G.auftritt, In = global.Input;
    if (!au) return;
    if (G.boss !== au.b || !G.boss) { ende(G, au); return; }
    au.t++;
    // Vorspulen
    if (au.t > 16 && au.t < DA - 6 && (In.hit('jump') || In.hit('confirm'))) au.t = DA - 6;
    var t = au.t, a = au.a;
    if (t === 8 && S()) S().play('whoosh');
    if (t === AN && a.ton && S()) S().play(a.ton);
    stellen(au, t);
    if (t === DA) {
      // Einschlag
      au.gelandet = true;
      au.blitz = a.art === 'blitz' ? 12 : 6;
      G.shake(a.schwer ? 14 : 9, a.schwer ? 34 : 22);
      if (S()) { S().play('bossRoar'); if (a.art === 'fall' || a.art === 'sprung') S().play('stomp'); }
      var b = au.b;
      if (G.einschlag) G.einschlag(b.cx(), b.y + b.h, 'boss');
      G.particles.burst(b.cx(), b.y + b.h - 2, 26, { col: '#d8ccb8', spread: 4, up: 0.8, life: 34, grav: 0.1 });
      if (a.art === 'blitz') G.particles.burst(b.cx(), b.y + b.h / 2, 30, { col: '#8ae0ff', spread: 4, up: 1.4, life: 30 });
      if (a.ruf) G.floats.add(b.cx(), b.y - 24, a.ruf, '#ffd257', 80);
    }
    if (au.blitz > 0) au.blitz--;
    // Kamera: erst zum Boss, gegen Ende zurueck zur Mitte zwischen beiden
    if (t > DAUER - 26 && G.player) {
      var p = G.player, bb = au.b;
      G.camFocus = { x: (p.cx() + bb.cx()) / 2, y: (p.y + bb.y) / 2 + 10 };
    }
    if (t >= DAUER) ende(G, au);
  }

  function ende(G, au) {
    if (au.b) { au.b.x = au.x0; au.b.y = au.y0; au.b.auftrittVersteckt = false; }
    G.auftritt = null;
    G.camFocus = null;
    G.frozen = false;
    if (au.fertig) au.fertig();
  }

  /** Ueber dem Bild: Kinobalken, Warnstreifen, Blitz. */
  function draw(ctx, G, W, H) {
    var au = G.auftritt;
    if (!au) return;
    var t = au.t;
    var rein = weich(t / 16), raus = clamp((DAUER - t) / 14, 0, 1);
    var bh = Math.round(30 * Math.min(rein, raus));
    rect(ctx, 0, 0, W, bh, '#000000');
    rect(ctx, 0, H - bh, W, bh, '#000000');
    // Warnstreifen: rauscht von rechts rein, steht kurz, rauscht links raus
    if (t < 64) {
      var k = t < 14 ? weich(t / 14) : (t > 48 ? 1 + weich((t - 48) / 16) : 1);
      var x = Math.round(W * (1 - k));
      var y = Math.round(H * 0.3), h = 34;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, W, h); ctx.clip();
      rect(ctx, x, y, W, h, '#b81c24');
      ctx.fillStyle = '#1a0a0a';
      for (var i = -2; i < W / 18 + 2; i++) {
        var sx = x + i * 18 + (t * 2) % 18;
        ctx.beginPath();
        ctx.moveTo(sx, y); ctx.lineTo(sx + 9, y); ctx.lineTo(sx - 3, y + 6); ctx.lineTo(sx - 12, y + 6); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx, y + h - 6); ctx.lineTo(sx + 9, y + h - 6); ctx.lineTo(sx - 3, y + h); ctx.lineTo(sx - 12, y + h); ctx.closePath(); ctx.fill();
      }
      var puls = (t >> 2) % 2 === 0;
      F.draw(ctx, '! BOSSKAMPF !', x + W / 2, y + 10, { color: puls ? '#ffffff' : '#ffd2d2', align: 'center', scale: 2, shadow: true });
      ctx.restore();
    }
    // Name klein unten in den Balken, sobald er da ist
    if (au.gelandet && bh > 12) {
      var karte = global.Levels && global.Levels.bossKarten && global.Levels.bossKarten[au.bt];
      if (karte) F.draw(ctx, karte[0], W / 2, H - bh + 9, { color: karte[2] || '#ffd257', align: 'center', shadow: true });
    }
    if (au.blitz > 0) {
      ctx.globalAlpha = au.blitz / 12;
      rect(ctx, 0, 0, W, H, au.a.art === 'blitz' ? '#d8f8ff' : '#ffffff');
      ctx.globalAlpha = 1;
    }
  }

  global.Auftritt = { start: start, tick: tick, draw: draw, AUFTRITTE: AUFTRITTE, DAUER: DAUER };

})(window);
