/* =====================================================================
   strecke.js — was auf dem Weg zum Boss passiert (Esat, 03.10.: "bringe
   weiterhin qualitativen Content hinzu ... verbessere die Laufwege bis zu
   den Bossen").

   Abgeschaut bei Hollow Knight und Mario:
     BEGEGNUNG   Jemand steht am Weg (wie Quirrel oder die Toads). Kommt
                 Yusuf vorbei, wird kurz geredet — manchmal gibt es was
                 dazu. Danach murmelt er noch ab und zu einen Satz.
     HINTERHALT  Die Arenen aus Hollow Knight: Gitter fallen links und
                 rechts zu, die Gegner kommen in Wellen von oben. Wer alle
                 schafft, bekommt eine Belohnung. Nach 30 Sekunden geben
                 die Gitter auch so nach — niemand bleibt stecken.
     VERSTECK    Eine falsche Wand (Hollow Knight). Wer hineinlaeuft, sieht
                 sie verblassen: dahinter Honig, was zu essen und ein
                 Schild mit einer Geschichte.

   Die Daten stehen in levels.js (b.npc, b.falle, b.versteck) und in den
   Abschnitten 'begegnung', 'hinterhalt' und 'geheim' (abschnitte.js).
   Was erledigt ist (geredet, Hinterhalt geschafft, Versteck gefunden),
   bleibt erledigt, auch wenn Yusuf danach stirbt.
   ===================================================================== */
(function (global) {
  'use strict';

  var T = 16;
  var P = global.Pixel, F = global.Font;
  function S() { return global.Sound; }
  function E() { return global.Ent; }
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Figuren, die es nur als Sprite gibt (keine zusammengesetzte Figur)
  var SPRITE = { lennart: 'lennart', erfan: 'erfan', typ: 'typ1', polizist: 'polizei', waerter: 'waerter',
                 kontrolle: 'security', mika: 'mika', stewardess: 'stewardess', haendler: 'haendler' };
  var FALLE_ZEIT = 30 * 60;          // so lange halten die Gitter hoechstens

  /** Oberkante des Bodens unter einer Spalte (von unten gesucht). */
  function bodenUnter(w, tx) {
    var y = w.h - 1;
    while (y > 0 && !w.solid(tx, y)) y--;
    while (y > 0 && w.solid(tx, y - 1)) y--;
    return y;
  }

  function laden(G, lvl, respawn) {
    if (!respawn || !G.streckeFest) G.streckeFest = { npc: {}, falle: {}, versteck: {}, gefunden: 0 };
    var fest = G.streckeFest, w = G.world, i;
    var st = { npcs: [], fallen: [], verstecke: [], sagT: 120 };
    (lvl.npcs || []).forEach(function (n, k) {
      var y = n.y !== undefined ? n.y : bodenUnter(w, n.x);
      st.npcs.push({ d: n, key: lvl.id + ':' + k, x: n.x * T + T / 2, feet: y * T,
                     fertig: !!fest.npc[lvl.id + ':' + k], blick: n.blick || -1, anim: k * 7 });
    });
    (lvl.fallen || []).forEach(function (f, k) {
      st.fallen.push({ d: f, key: lvl.id + ':' + k, phase: fest.falle[lvl.id + ':' + k] ? 'frei' : 'warten',
                       t: 0, welle: 0, feinde: [], zellen: [] });
    });
    (lvl.verstecke || []).forEach(function (v, k) {
      st.verstecke.push({ d: v, key: lvl.id + ':' + k, x: v.x * T, y: v.y * T, w: v.w * T, h: v.h * T,
                          a: 1, gefunden: !!fest.versteck[lvl.id + ':' + k] });
    });
    G.strecke = (st.npcs.length || st.fallen.length || st.verstecke.length) ? st : null;
    for (i = 0; i < st.npcs.length; i++) if (G.wo) G.wo[st.npcs[i].d.who] = null;
  }

  /* ---------------- Begegnungen ---------------- */

  function npcUpdate(G, n) {
    var p = G.player;
    n.anim++;
    var dx = p.cx() - n.x, ady = Math.abs(p.feet() - n.feet);
    n.blick = dx > 0 ? 1 : -1;
    n.nah = Math.abs(dx) < 120 && ady < 90;
    if (!n.fertig && n.d.lines && Math.abs(dx) < 34 && ady < 40 && p.grounded && !p.dead && !G.boss) {
      n.fertig = true;
      G.streckeFest.npc[n.key] = true;
      p.vx = 0;
      G.showDialog(n.d.lines, function () {
        G.state = 'play';
        geben(G, n);
      });
      return;
    }
    // Ohne eigenes Gespraech (nur Saetze) gilt er als begruesst, sobald man da ist
    if (!n.fertig && !n.d.lines && Math.abs(dx) < 60) {
      n.fertig = true; G.streckeFest.npc[n.key] = true;
      geben(G, n);
    }
  }

  function geben(G, n) {
    var g = n.d.gibt;
    if (!g) return;
    var liste = typeof g === 'string' ? [g] : g;
    for (var i = 0; i < liste.length; i++) {
      G.addItem(liste[i], n.x + (i - (liste.length - 1) / 2) * 14, n.feet - 30, true);
    }
    S().play('oneUp');
  }

  /** Ab und zu sagt einer, an dem Yusuf gerade vorbeilaeuft, einen Satz. */
  function murmeln(G, st) {
    if (--st.sagT > 0) return;
    st.sagT = 200 + ((Math.random() * 160) | 0);
    for (var i = 0; i < st.npcs.length; i++) {
      var n = st.npcs[i];
      if (!n.nah || !n.d.sagt || !n.d.sagt.length) continue;
      G.wo = G.wo || {};
      G.wo[n.d.who] = { x: n.x, y: n.feet - (SPRITE[n.d.who] ? 44 : 44) };
      G.say(n.d.who, rnd(n.d.sagt), 120);
      return;
    }
  }

  /* ---------------- Hinterhalte ---------------- */

  function falleUpdate(G, f) {
    var d = f.d, p = G.player, w = G.world;
    if (f.phase === 'frei') return;
    if (f.phase === 'warten') {
      var x0 = (d.x0 + 2) * T, x1 = (d.x1 - 1) * T;
      if (p.cx() > x0 && p.cx() < x1 && p.grounded && !p.dead && !G.boss) zu(G, f);
      return;
    }
    // Die Gitter sind zu
    f.t++;
    if (f.phase === 'pause') {
      if (f.t >= f.weiterBei) { f.phase = 'kampf'; welle(G, f); }
    } else if (f.phase === 'kampf') {
      var leben = 0;
      for (var i = 0; i < f.feinde.length; i++) if (!f.feinde[i].dead) leben++;
      if (leben === 0) {
        f.welle++;
        if (f.welle >= d.wellen.length) { auf(G, f, true); return; }
        f.phase = 'pause'; f.weiterBei = f.t + 50;
        G.floats.add(p.cx(), p.y - 34, 'WELLE ' + (f.welle + 1) + '!', '#ff8a5a', 60);
      }
    }
    if (f.t > FALLE_ZEIT) auf(G, f, false);
    // Wer stirbt, faengt nach dem Checkpoint von vorn an (die Welt wird neu geladen)
    void w;
  }

  function zu(G, f) {
    // Die Gitter gehen bis ganz nach oben — sonst springt man einfach drueber
    var d = f.d, w = G.world, oben = d.hoch ? Math.max(0, d.y - d.hoch) : 0;
    f.zellen = [];
    [d.x0, d.x1].forEach(function (tx) {
      for (var ty = oben; ty < d.y; ty++) {
        if (w.solid(tx, ty)) continue;
        w.fill(tx, ty, 1, 1, 1);
        f.zellen.push([tx, ty]);
      }
    });
    f.phase = 'pause'; f.t = 0; f.weiterBei = 40; f.welle = 0;
    G.shake(6, 16);
    S().play('alarm');
    G.floats.add(G.player.cx(), G.player.y - 40, d.text || 'HINTERHALT!', '#ff6a5a', 90);
    G.floats.add(G.player.cx(), G.player.y - 26, 'DIE GITTER SIND ZU.', '#ffd257', 80);
  }

  function welle(G, f) {
    var d = f.d, liste = d.wellen[f.welle] || [];
    f.feinde = [];
    for (var i = 0; i < liste.length; i++) {
      var e = liste[i], typ = e[0], ex = d.x0 + (e[1] || 0), ey = e[2] !== undefined ? e[2] : d.y;
      var en = new (E().Enemy)(typ, ex, ey);
      if (!en.def.fly) en.y -= 90 + i * 14;      // faellt von oben herein
      en.vy = 0;
      G.enemies.push(en);
      f.feinde.push(en);
      G.particles.burst(en.x + en.w / 2, en.y + en.h / 2, 8, { col: '#ffffff', spread: 2, up: 1, life: 20 });
    }
    S().play('pop');
  }

  function auf(G, f, geschafft) {
    var d = f.d, w = G.world, p = G.player;
    for (var i = 0; i < f.zellen.length; i++) w.fill(f.zellen[i][0], f.zellen[i][1], 1, 1, 0);
    f.zellen = [];
    f.phase = 'frei';
    G.streckeFest.falle[f.key] = true;
    S().play(geschafft ? 'win' : 'select');
    if (!geschafft) {
      G.floats.add(p.cx(), p.y - 30, 'DIE GITTER GEBEN NACH.', '#c8c0d8', 80);
      return;
    }
    p.score += 500;
    G.floats.add(p.cx(), p.y - 40, d.geschafft || 'GESCHAFFT! +500', '#8cd85a', 100);
    var mitte = ((d.x0 + d.x1) / 2) * T + T / 2;
    (d.belohnung || ['herz', 'honig', 'honig', 'honig']).forEach(function (t, k, a) {
      G.addItem(t, mitte + (k - (a.length - 1) / 2) * 16, d.y * T - 40, true);
    });
    G.particles.burst(mitte, d.y * T - 30, 30, { col: '#ffd257', spread: 3.4, up: 1.6, life: 40 });
  }

  /* ---------------- Verstecke ---------------- */

  function versteckUpdate(G, v) {
    var p = G.player, drin = overlap(p, { x: v.x - 2, y: v.y - 2, w: v.w + 4, h: v.h + 4 });
    v.a += ((drin ? 0.1 : 1) - v.a) * 0.15;
    if (drin && !v.gefunden) {
      v.gefunden = true;
      G.streckeFest.versteck[v.key] = true;
      G.streckeFest.gefunden++;
      p.score += 300;
      S().play('oneUp');
      G.floats.add(p.cx(), p.y - 30, 'GEHEIMNIS GEFUNDEN! +300', '#ffd257', 100);
      G.particles.burst(p.cx(), p.y + 6, 20, { col: '#ffd257', spread: 2.6, up: 1.2, life: 34 });
    }
  }

  function update(G) {
    var st = G.strecke;
    if (!st || G.frozen || G.state !== 'play') return;
    var i;
    for (i = 0; i < st.npcs.length; i++) npcUpdate(G, st.npcs[i]);
    if (G.state !== 'play') return;          // ein Gespraech hat angefangen
    murmeln(G, st);
    for (i = 0; i < st.fallen.length; i++) falleUpdate(G, st.fallen[i]);
    for (i = 0; i < st.verstecke.length; i++) versteckUpdate(G, st.verstecke[i]);
  }

  /* ---------------- Zeichnen ---------------- */

  function zeichneNpc(ctx, G, n, camX, camY) {
    var x = n.x - camX, y = n.feet - camY, who = n.d.who;
    if (x < -40 || x > (G.viewW ? G.viewW() : 512) + 40) return;
    var spricht = G.talk && G.talk[who] && G.talk[who].t > 0;
    // Schatten
    ctx.globalAlpha = 0.25; rect(ctx, x - 8, y - 2, 16, 3, '#000000'); ctx.globalAlpha = 1;
    if (SPRITE[who]) {
      var sp = P.get(SPRITE[who] + (who === 'lennart' && spricht && (G.tick >> 3) % 2 ? '2' : ''));
      P.draw(ctx, sp.name, Math.round(x - sp.w / 2), Math.round(y - sp.h + ((n.anim >> 5) % 2)), n.blick < 0);
    } else if (P.CHARS[who]) {
      P.drawChar(ctx, who, x, y, { pose: n.d.pose || 'idle', frame: n.anim >> 4, flip: n.blick < 0,
                                    face: spricht ? 'laugh' : 'normal' });
    }
    // Noch nicht geredet: ein kleines Sprechblasen-Zeichen, das wippt
    if (!n.fertig && n.d.lines) {
      var by = y - 46 + Math.sin(G.tick * 0.12) * 2;
      rect(ctx, x - 7, by - 6, 14, 10, '#f4f0e4');
      rect(ctx, x - 2, by + 4, 3, 3, '#f4f0e4');
      F.draw(ctx, '...', x, by - 5, { color: '#141018', align: 'center' });
    }
  }

  function zeichneGitter(ctx, G, f, camX, camY) {
    if (!f.zellen.length) return;
    for (var i = 0; i < f.zellen.length; i++) {
      var z = f.zellen[i], x = z[0] * T - camX, y = z[1] * T - camY;
      rect(ctx, x, y, T, T, '#1a1420');
      for (var s = 2; s < T; s += 5) rect(ctx, x + s, y, 2, T, '#8a8e98');
      rect(ctx, x, y + 6, T, 2, '#5a5e68');
    }
    // Spitzen unten und ein Leuchten, solange gekaempft wird
    var puls = 0.25 + Math.sin(G.tick * 0.2) * 0.12;
    ctx.globalAlpha = puls;
    for (i = 0; i < f.zellen.length; i++) {
      var z2 = f.zellen[i];
      rect(ctx, z2[0] * T - camX - 2, z2[1] * T - camY, T + 4, T, '#ff6a5a');
    }
    ctx.globalAlpha = 1;
  }

  /** Hinter den Figuren: Leute am Weg, Gitter. */
  function hinten(ctx, G, camX, camY) {
    var st = G.strecke;
    if (!st) return;
    var i;
    for (i = 0; i < st.fallen.length; i++) zeichneGitter(ctx, G, st.fallen[i], camX, camY);
    for (i = 0; i < st.npcs.length; i++) zeichneNpc(ctx, G, st.npcs[i], camX, camY);
  }

  /** Vor allem: die falschen Waende. */
  function vorne(ctx, G, camX, camY) {
    var st = G.strecke;
    if (!st || !st.verstecke.length) return;
    var th = G.world.theme, SP = global.Sprites;
    var top = SP.tileTop(th), fill = SP.tileFill(th), deep = SP.tileDeep(th), w = G.world;
    for (var i = 0; i < st.verstecke.length; i++) {
      var v = st.verstecke[i];
      var vx = v.x - camX, vy = v.y - camY;
      if (vx > (G.viewW ? G.viewW() : 512) + 20 || vx + v.w < -20) continue;
      if (v.a < 0.03) continue;
      ctx.globalAlpha = v.a;
      // Sieht aus wie der Boden drumherum: oben die Kante (wenn darueber frei ist)
      for (var ty = 0; ty < v.h; ty += T) {
        for (var tx = 0; tx < v.w; tx += T) {
          var oben = ty === 0 && !w.solid(Math.floor((v.x + tx) / T), Math.floor(v.y / T) - 1);
          P.draw(ctx, oben ? top : (ty >= 2 * T ? deep : fill), vx + tx, vy + ty);
        }
      }
      // Ein feiner Riss an der Seite, an der man reinkommt — wer genau hinschaut, sieht es
      var rx = v.d.von === 'links' ? vx + 2 : vx + v.w - 5;
      ctx.globalAlpha = v.a * 0.55;
      rect(ctx, rx, vy + 4, 1, 6, '#000000'); rect(ctx, rx + 1, vy + 9, 1, 7, '#000000');
      rect(ctx, rx, vy + 15, 1, 5, '#000000');
      ctx.globalAlpha = 1;
    }
  }

  /** Fuer den Ergebnisbildschirm: gefundene Verstecke, geschaffte Hinterhalte. */
  function stand(G) {
    var lvl = G.lvl, fest = G.streckeFest || { versteck: {}, falle: {} };
    var v = (lvl.verstecke || []).length, f = (lvl.fallen || []).length, vg = 0, fg = 0, k;
    for (k = 0; k < v; k++) if (fest.versteck[lvl.id + ':' + k]) vg++;
    for (k = 0; k < f; k++) if (fest.falle[lvl.id + ':' + k]) fg++;
    return { verstecke: v, gefunden: vg, fallen: f, geschafft: fg };
  }

  /** Fuer Tests und die Doku: was es in einem Level alles gibt. */
  function zaehlen(lvl) {
    return { npcs: (lvl.npcs || []).length, fallen: (lvl.fallen || []).length, verstecke: (lvl.verstecke || []).length };
  }

  global.Strecke = { laden: laden, update: update, hinten: hinten, vorne: vorne, zaehlen: zaehlen, stand: stand,
                     FALLE_ZEIT: FALLE_ZEIT, SPRITE: SPRITE };

})(window);
