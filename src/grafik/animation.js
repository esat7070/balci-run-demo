/* =====================================================================
   animation.js — Yusuf und die Gegner bewegen sich lebendiger.
   (Esat, 28.10.: "verbessere die Animationen, realistischer, entertainender")

   NUR das Aussehen. Physik, Trefferflaechen, p.pose() und der Zufall des
   Spiels bleiben, wie sie sind (Staub nimmt eine eigene Zufallsfolge) —
   Bots und Tests erleben dasselbe Spiel wie vorher.

   Yusuf:
     - Laufen mit 8 Bildern (Aufsetzen, Abfedern, Durchschwingen, Abdruecken);
       beim Rennen weiter ausgreifend, nach vorn gelehnt, Staub bei jedem Schritt
     - Umdrehen in vollem Lauf: zurueckgelehnt, Fuesse voraus (Bremsen)
     - Sprung: oben kurz eingerollt; langer Fall = mit den Armen rudern
     - Doppelsprung = Salto, Arschbombe = Rolle vorm Aufprall
     - Landen und Kopfstoss federn nach (Gummibauch statt starrem Stauchen)
     - an der Kante wackeln, gegen die Wand druecken
     - Langeweile: umschauen, an Doener denken, Bauch klopfen, gaehnen —
       danach schlaeft er ja ohnehin ein
     - Treffer: nach hinten gekippt; Tod: ueberschlaegt sich; Jubel: huepft
   Gegner:
     - wippen beim Laufen, Flieger neigen sich in die Flugrichtung,
       Hopser strecken sich im Sprung
     - plattgestampft = Pfannkuchen mit Staubwolke, sonst wirbeln sie davon
   ===================================================================== */
(function (global) {
  'use strict';

  var P = global.Pixel;
  var T = 16;
  var SPRINT = 2.55;        // ab diesem Tempo sprintet er (Gehen 2.15, Rennen 3.15)
  var SALTO = 20;           // Ticks fuer den Salto beim Doppelsprung
  var ZWEI_PI = Math.PI * 2;

  /* ---------------- Posen ----------------
     Felder wie in pixel.js (h, t, lL, lR, aB, aF), dazu:
       x  = Oberkoerper (Rumpf, Kopf, Arme) seitlich, + = nach vorn
       hx = Kopf zusaetzlich seitlich */
  function f(t, lL, lR, aB, aF, h, x, hx) {
    return { h: h || 0, t: t, lL: lL, lR: lR, aB: aB, aF: aF, x: x || 0, hx: hx || 0 };
  }
  // Arme rudern im Kreis um die Schulter (oben, aussen, unten, innen) —
  // vorderer und hinterer Arm gespiegelt, damit die Haende am Koerper bleiben
  var KREIS = [[-1, -7], [2, -3], [2, 0], [-2, -2]];
  var KREIS_H = [[1, -7], [-2, -3], [-2, 0], [2, -2]];

  var POSEN = {
    // Laufen: R = vorderes Bein. Gegenueberliegender Arm schwingt mit.
    lauf: [
      f(0, [-3, -1], [3, 0], [3, -1], [-3, 0]),     // Aufsetzen rechts
      f(1, [-2, -3], [2, 0], [2, 0], [-2, 1]),      // Abfedern
      f(0, [0, -4], [0, 0], [0, 1], [0, 1]),        // Durchschwingen
      f(-1, [2, -3], [-2, -1], [-2, 0], [2, -1]),   // Abdruecken (kurz in der Luft)
      f(0, [3, 0], [-3, -1], [-2, 0], [2, -1]),     // Aufsetzen links
      f(1, [2, 0], [-2, -3], [-2, 1], [2, 0]),
      f(0, [0, 0], [0, -4], [0, 1], [0, 1]),
      f(-1, [-2, -1], [2, -3], [2, -1], [-2, 0])
    ],
    // Sprint: laengere Schritte, Knie hoch, Arme pumpen, Kopf voraus
    sprint: [
      f(0, [-4, -1], [4, 0], [4, -3], [-4, 1], 0, 1, 1),
      f(1, [-3, -3], [3, 0], [3, -1], [-3, 1], 0, 1, 1),
      f(1, [0, -5], [1, 0], [0, 0], [0, 0], 0, 1, 1),
      f(-1, [3, -4], [-3, -2], [-2, 0], [2, -1], 0, 1, 1),
      f(0, [4, 0], [-4, -1], [-2, 1], [2, 0], 0, 1, 1),
      f(1, [3, 0], [-3, -3], [-2, 1], [2, 0], 0, 1, 1),
      f(1, [1, 0], [0, -5], [0, 0], [0, 0], 0, 1, 1),
      f(-1, [-3, -2], [3, -4], [3, -2], [-3, 0], 0, 1, 1)
    ],
    // Bremsen: zurueckgelehnt, vorderes Bein gestemmt, Arme hoch
    bremse: [
      f(1, [0, 0], [5, 0], [0, -6], [0, -6], 0, -2, -1),
      f(1, [0, 0], [5, 0], [1, -5], [-1, -5], 0, -2, -1)
    ],
    // Hoechster Punkt: kurz eingerollt, Arme raus
    scheitel: [f(-1, [-1, -4], [2, -4], [1, -5], [-1, -6], -1)],
    // Langer Fall: rudert mit den Armen, strampelt
    fuchteln: [
      f(0, [-2, -1], [2, -3], KREIS_H[2], KREIS[0]),
      f(0, [-1, -3], [3, -1], KREIS_H[3], KREIS[1]),
      f(0, [-2, -1], [2, -3], KREIS_H[0], KREIS[2]),
      f(0, [-1, -3], [3, -1], KREIS_H[1], KREIS[3])
    ],
    // An der Kante (der Abgrund ist vorn): ein Bein hoch, Arme kreisen
    wackeln: [
      f(0, [-3, -3], [1, 0], KREIS_H[2], KREIS[0], 0, 1),
      f(0, [-4, -3], [1, 0], KREIS_H[3], KREIS[1], 0, 2, 1),
      f(0, [-3, -3], [1, 0], KREIS_H[0], KREIS[2], 0, 1),
      f(0, [-2, -2], [1, 0], KREIS_H[1], KREIS[3], 0, 0)
    ],
    // Gegen die Wand druecken: tief, vorgelehnt, Beine treten auf der Stelle
    schieben: [
      f(1, [-4, 0], [0, 0], [6, -1], [2, 0], 0, 2, 1),
      f(1, [-3, -2], [0, 0], [6, -2], [2, -1], 0, 2, 1),
      f(1, [-1, 0], [-3, 0], [6, -1], [2, 0], 0, 2, 1),
      f(1, [-1, 0], [-2, -2], [6, -2], [2, -1], 0, 2, 1)
    ],
    // Harte Landung: in die Knie, Faeuste unten
    landung: [f(3, [-2, -2], [2, -2], [-1, 3], [1, 3], 1)],
    // Langeweile
    schauen: [
      f(0, [0, 0], [0, 0], [0, 0], [0, 0], 0, 0, 1),
      f(1, [0, 0], [0, 0], [0, 1], [0, 1], 0, 0, 1)
    ],
    bauch: [
      f(0, [0, 0], [0, 0], [1, 1], [-6, 2]),
      f(1, [0, 0], [0, 0], [1, 2], [-6, 4])
    ],
    gaehnen: [
      f(0, [0, 0], [0, 0], [1, -4], [-1, -4]),
      f(-1, [0, 0], [0, 0], [2, -9], [-2, -9], -1),
      f(-1, [0, 0], [0, 0], [3, -8], [-3, -9], -1)
    ],
    // Reden in den Kurzfilmen (kino.js): die Hand erklaert, der Kopf nickt mit
    reden: [
      f(0, [0, 0], [0, 0], [0, 0], [1, -3]),
      f(0, [0, 0], [0, 0], [0, 1], [1, -6], -1),
      f(0, [0, 0], [0, 0], [0, 0], [1, -4]),
      f(1, [0, 0], [0, 0], [-1, -4], [0, 1], 0, 1, 1),
      f(0, [0, 0], [0, 0], [0, -6], [1, -2], -1),
      f(0, [0, 0], [0, 0], [0, 0], [0, 0], 1)
    ]
  };
  for (var k in POSEN) P.POSES[k] = POSEN[k];

  /* ---------------- Zustand (nur fuer G.player) ---------------- */

  var st = null;
  function zustand(G) {
    var p = G.player;
    if (!st || st.p !== p) {
      st = { p: p, phase: 0, luft: 0, warBoden: true, vyAlt: 0, poundAlt: 0, sprAlt: 2,
             s: 0, v: 0, saltoT: 0, saltoDir: 1, landT: 0, schiebT: 0, warTot: false, todDreh: false,
             bremst: false, schiebt: false, wandT: 0, wandDir: 0, kante: 0, zufall: 20261028 };
    }
    return st;
  }

  // Eigene Zufallsfolge: Staub darf den Spiel-Zufall (Math.random) nicht verschieben
  function zufall(s) {
    s.zufall = (s.zufall * 1664525 + 1013904223) >>> 0;
    return s.zufall / 4294967296;
  }

  function achse(G) {
    if (G.autoAx !== null && G.autoAx !== undefined) return G.autoAx;
    if (G.frozen || !global.Input || !global.Input.axis) return 0;
    return global.Input.axis();
  }

  function zuFuss(G) {
    return !!(G.lvl && !G.lvl.bike && !G.scene && !G.eat && !(G.modus && G.modMod && G.modMod.full));
  }

  /** Steht er mit der Fussmitte ueber dem Abgrund? 1 = rechts, -1 = links, 0 = nein */
  function kante(G, p) {
    var w = G.world;
    if (!w) return 0;
    var ty = Math.floor((p.feet() + 1) / T);
    if (w.solid(Math.floor(p.cx() / T), ty)) return 0;
    for (var i = 0; i < w.movers.length; i++) {
      var m = w.movers[i];
      if (p.x + p.w > m.x && p.x < m.x + m.w && Math.abs(p.feet() - m.y) <= 3) return 0;
    }
    var l = w.solid(Math.floor((p.x + 1) / T), ty), r = w.solid(Math.floor((p.x + p.w - 2) / T), ty);
    if (l && !r) return 1;
    if (r && !l) return -1;
    return 0;
  }

  function staubFarbe(G) {
    return global.Gelaende && G.world ? global.Gelaende.staub(G.world.theme) : '#e8dcc0';
  }

  /** Feder fuer Stauchen/Strecken: s > 0 gestaucht, s < 0 gestreckt */
  function federn(s, ziel) {
    s.v += (ziel - s.s) * 0.3 - s.v * 0.3;
    s.s += s.v;
    if (s.s > 0.32) { s.s = 0.32; s.v = 0; }
    if (s.s < -0.18) { s.s = -0.18; s.v = 0; }
  }

  function federZiel(p) {
    if (p.pound === -1) return -0.13;
    if (p.pound > 0) return 0.08;
    if (!p.grounded && p.vy < -3) return -0.09;
    if (!p.grounded && p.vy > 7) return -0.05;
    return 0;
  }

  /* ---------------- Jeden Tick (game.js updateWorld) ---------------- */

  function tick(G) {
    var p = G.player;
    if (!p || !G.lvl) return;
    var s = zustand(G);
    if (p.dead) {
      if (!s.warTot) { s.warTot = true; s.todDreh = p.vy < 0 && !p.hitCall; s.s = 0; s.v = 0; s.saltoT = 0; }
      return;
    }
    if (s.warTot) { s.warTot = false; s.luft = 0; s.landT = 0; s.warBoden = true; }
    if (!zuFuss(G)) { s.warBoden = p.grounded; s.vyAlt = p.vy; s.s = 0; s.v = 0; return; }

    var ax = achse(G), tempo = Math.abs(p.vx);

    // Landen: harte Landung = in die Knie, und der Bauch federt nach
    if (p.grounded && !s.warBoden) {
      var vy = s.vyAlt;
      if (s.poundAlt === -1) { s.s = 0.3; s.v = 0; s.landT = 12; }
      else if (vy > 2.5) {
        s.s = Math.max(s.s, Math.min(0.26, (vy - 2) * 0.032)); s.v = 0;
        if (vy > 8) s.landT = 8;
      }
    }
    if (p.grounded) s.luft = 0; else s.luft++;
    if (s.landT > 0 && (!p.grounded || tempo > 1 || ax !== 0)) s.landT = 0;
    if (s.landT > 0) s.landT--;

    // Kopf angestossen: kurz zusammengestaucht
    if (p.headTile && s.vyAlt < -1) { s.s = Math.max(s.s, 0.16); s.v = 0; }

    // Doppelsprung (Bauch-Boost) = Salto
    if (!p.grounded && s.sprAlt > 0 && p.jumpsLeft === 0 && p.vy < -3 && p.hurtTimer <= 0 && p.pound === 0) {
      s.saltoT = 1; s.saltoDir = p.facing;
    } else if (s.saltoT > 0) {
      s.saltoT++;
      if (s.saltoT > SALTO || p.grounded || p.pound !== 0 || p.hurtTimer > 0 || p.schlag) s.saltoT = 0;
    }
    s.sprAlt = p.jumpsLeft;

    // Laufphase nach Tempo; im Sprint Staub bei jedem Aufsetzen
    if (p.grounded && tempo > 0.3 && !p.rutsch && !p.liegt) {
      var alt = Math.floor(s.phase);
      s.phase += 0.15 + tempo * 0.11;
      var neu = Math.floor(s.phase);
      if (neu !== alt && neu % 4 === 0 && tempo > SPRINT) {
        var n = 1 + (zufall(s) < 0.5 ? 1 : 0);
        for (var i = 0; i < n; i++) {
          G.particles.spawn({ x: p.cx() - p.facing * (3 + zufall(s) * 4), y: p.feet() - 1,
                              vx: -p.vx * (0.12 + zufall(s) * 0.12), vy: -(0.25 + zufall(s) * 0.45),
                              life: 12 + (zufall(s) * 8 | 0), col: staubFarbe(G), size: 2, grav: 0.015 });
        }
      }
    }
    if (tempo <= 0.3) s.phase = 0;

    // Bremsen, Schieben, Kante
    var frei = !p.rutsch && !p.liegt && p.pound === 0 && !p.schlag;
    s.bremst = frei && p.grounded && ax !== 0 && p.vx !== 0 && (ax > 0) !== (p.vx > 0) && tempo > 1.2;
    // Die Physik meldet die Wand beim Druecken nur jeden zweiten Tick
    // (er rueckt 0.55 px vor, dann stoesst er an) — darum kurz merken
    if (p.wallTile && ax !== 0 && ((ax > 0) === (p.wallTile[0] * T > p.cx()))) { s.wandT = 4; s.wandDir = ax > 0 ? 1 : -1; }
    else if (s.wandT > 0) s.wandT--;
    var wand = s.wandT > 0 && ax !== 0 && (ax > 0) === (s.wandDir > 0);
    s.schiebt = frei && p.grounded && wand && tempo < 1.2;
    if (s.schiebt) s.schiebT += 0.09; else s.schiebT = 0;
    s.kante = (frei && p.grounded && tempo < 0.3 && ax === 0) ? kante(G, p) : 0;

    federn(s, federZiel(p));
    s.warBoden = p.grounded; s.vyAlt = p.vy; s.poundAlt = p.pound;
  }

  /* ---------------- Pose fuers Zeichnen (game.js drawPlayer) ----------------
     Nimmt die Pose aus p.pose() und macht daraus die lebendige Fassung:
     { pose, face, frame, flip, rot, pivot, dy, extra } */

  function langweile(G, p) {
    if (p.waffe || p.sleeping || (G.lvl && (G.lvl.airsoft || G.lvl.bags))) return null;
    var i = p.idle || 0;
    if (i >= 70 && i < 110) return { art: 'schauen', t: i - 70 };
    if (i >= 112 && i < 150) return { art: 'doener', t: i - 112 };
    if (i >= 165 && i < 215) return { art: 'bauch', t: i - 165 };
    if (i >= 235 && i < 290) return { art: 'gaehnen', t: i - 235 };
    return null;
  }

  function spieler(G, p, ps) {
    var s = zustand(G);
    var o = { pose: ps.pose, face: ps.face, frame: p.anim, flip: p.facing < 0, rot: 0, pivot: 13, dy: 0, extra: null,
              k: G.klein || 1 };   // In Semihs Erinnerung ist Yusuf klein: Drehpunkt mit
    if (!zuFuss(G)) return o;
    var bild = (G.tick >> 3) & 3, ruhig = !p.waffe && !(G.lvl && G.lvl.airsoft);
    var gesicht = function (f) { if (ps.face === 'normal') o.face = f; };

    if (p.dead) {
      // Ueberschlaegt sich beim Abgang (nicht, wer in den Abgrund faellt)
      if (s.todDreh && p.deadTimer > 6) { o.rot = -p.facing * (p.deadTimer - 6) * 0.13; o.pivot = 14; }
      return o;
    }
    if (ps.pose === 'cheer') {
      o.frame = (G.tick >> 3) & 1;
      if (p.grounded && Math.abs(p.vx) < 0.3) o.dy = -Math.round(Math.abs(Math.sin(G.tick * 0.19)) * 3);
      return o;
    }
    // Arschbombe: erst eine Rolle in der Luft
    if (ps.pose === 'duck' && p.pound > 0) {
      var pc = (global.Balance && global.Balance.SPIELER.POUND_CHARGE) || 8;
      o.rot = p.facing * ZWEI_PI * Math.min(1, (pc - p.pound) / pc);
      o.pivot = 10;
      return o;
    }
    var basis = ps.pose === 'idle' || ps.pose === 'run' || ps.pose === 'jump' || ps.pose === 'fall';
    if (!basis) return o;

    // Gerade getroffen: nach hinten gekippt
    if (p.hurtTimer > 24) {
      o.pose = 'hurt';
      o.rot = -p.facing * 0.32 * Math.min(1, (p.hurtTimer - 24) / 16);
      o.pivot = 12;
      return o;
    }
    if (!p.grounded) {
      if (s.saltoT > 0) {
        var k = s.saltoT / SALTO;
        o.pose = 'scheitel'; o.frame = 0;
        o.rot = s.saltoDir * ZWEI_PI * (1 - (1 - k) * (1 - k));
        return o;
      }
      // Fast so schnell wie es geht nach unten: Panik, er rudert
      if (p.vy >= 10) {
        o.pose = 'fuchteln'; o.frame = (G.tick >> 2) & 3; gesicht('hurt');
        return o;
      }
      if (Math.abs(p.vy) < 1.6 && s.luft > 4 && !p.weit) { o.pose = 'scheitel'; o.frame = 0; }
      return o;
    }
    // Am Boden
    if (s.bremst && ruhig) {
      o.pose = 'bremse'; o.frame = (G.tick >> 2) & 1; o.flip = p.vx < 0; gesicht('hurt');
      return o;
    }
    if (s.schiebt) {
      o.pose = 'schieben'; o.frame = Math.floor(s.schiebT) & 3; gesicht('growl');
      return o;
    }
    if (ps.pose === 'run') {
      o.pose = Math.abs(p.vx) > SPRINT ? 'sprint' : 'lauf';
      o.frame = Math.floor(s.phase) & 7;
      return o;
    }
    if (ps.pose === 'idle') {
      if (s.landT > 0) { o.pose = 'landung'; o.frame = 0; return o; }
      if (s.kante && ruhig) {
        o.pose = 'wackeln'; o.frame = bild; o.flip = s.kante < 0; gesicht('hurt');
        o.extra = { art: 'schweiss' };
        return o;
      }
      var lw = langweile(G, p);
      if (lw) {
        o.extra = lw;
        if (lw.art === 'schauen') {
          o.pose = 'schauen'; o.frame = lw.t > 30 ? 1 : 0;
          if (lw.t >= 12 && lw.t < 28) o.flip = !o.flip;
        } else if (lw.art === 'doener') {
          gesicht('eat');
        } else if (lw.art === 'bauch') {
          o.pose = 'bauch'; o.frame = (G.tick >> 3) & 1; gesicht('laugh');
        } else if (lw.art === 'gaehnen') {
          o.pose = 'gaehnen';
          o.frame = lw.t < 6 || lw.t >= 46 ? 0 : 1 + ((lw.t >> 3) & 1);
          if (lw.t >= 6 && lw.t < 46) gesicht('sleep');
        }
      }
    }
    return o;
  }

  /** Drehen und Versetzen um den Koerper (vor Figur, Waffe, Tueten) */
  function anwenden(ctx, o, p, camX, camY) {
    if (!o || (!o.rot && !o.dy)) return;
    var k = o.k || 1;
    var px = Math.round(p.cx() - camX), py = Math.round(p.feet() - camY) - o.pivot * k;
    ctx.translate(px, py + Math.round(o.dy * k));
    if (o.rot) ctx.rotate(o.rot);
    ctx.translate(-px, -py);
  }

  /** Stauchen/Strecken (spass.js form fragt hier) */
  function form(G) {
    var p = G.player;
    if (!st || !p || st.p !== p || p.dead || !zuFuss(G)) return { sx: 1, sy: 1 };
    return { sx: 1 + st.s * 0.8, sy: 1 - st.s };
  }

  /* ---------------- Kleinigkeiten ueber dem Kopf ---------------- */

  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  /** Pixel-Blase: Ellipse aus Rechtecken mit dunklem Rand */
  function blase(ctx, cx, cy, rx, ry) {
    for (var dy = -ry; dy <= ry; dy++) {
      var w = Math.round(rx * Math.sqrt(1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))));
      rect(ctx, cx - w - 1, cy + dy, w * 2 + 2, 1, '#2a1e30');
    }
    rect(ctx, cx - Math.round(rx * 0.7), cy - ry - 1, Math.round(rx * 1.4), 1, '#2a1e30');
    rect(ctx, cx - Math.round(rx * 0.7), cy + ry + 1, Math.round(rx * 1.4), 1, '#2a1e30');
    for (dy = -ry; dy <= ry; dy++) {
      var w2 = Math.round(rx * Math.sqrt(1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))));
      rect(ctx, cx - w2, cy + dy, w2 * 2, 1, '#fffaf0');
    }
  }

  function extras(ctx, G, p, o, camX, camY) {
    if (!o || !o.extra || p.dead) return;
    var e = o.extra, d = p.facing, cx = Math.round(p.cx() - camX), top = Math.round(p.y - camY);
    if (e.art === 'doener') {
      // Er denkt an Doener. Natuerlich.
      var auf = Math.min(1, e.t / 6), zu = Math.min(1, (38 - e.t) / 5);
      var a = Math.max(0, Math.min(auf, zu));
      if (a <= 0) return;
      var bx = cx + d * 15, by = top - 16 - Math.round(Math.sin(G.tick * 0.08) * 1.5);
      ctx.save();
      ctx.globalAlpha *= a;
      blase(ctx, cx + d * 7, top - 3, 1, 1);
      blase(ctx, cx + d * 10, top - 8, 2, 1);
      blase(ctx, bx, by, 11, 8);
      P.draw(ctx, 'doener', bx - 7, by - 5, d < 0);
      // ... und sabbert ein bisschen
      if (e.t > 18 && (G.tick >> 4) % 2 === 0) rect(ctx, cx + d * 3, top + 9, 1, 2 + ((G.tick >> 2) & 1), '#9ad8ff');
      ctx.restore();
    } else if (e.art === 'schweiss') {
      // Angstschweiss an der Kante: ein Tropfen fliegt vom Kopf
      var t = G.tick % 36;
      if (t < 18) {
        var sx = cx - d * (6 + t * 0.4), sy = top - 2 + t * t * 0.03 - t * 0.35;
        rect(ctx, sx, sy, 1, 1, '#d8f0ff');
        rect(ctx, sx - 1, sy + 1, 3, 2, '#7cc8ff');
      }
    }
  }

  /* ---------------- Gegner (game.js drawEnemy) ---------------- */

  var ROLLT = { wagen: 1, koffer: 1, trolley: 1, falafel: 1 };

  /** Plattgestampft: Pfannkuchen, dann Staubwolke. true = fertig gezeichnet. */
  function pfannkuchen(ctx, e, spr, camX, camY) {
    var k = e.deadTimer, pl = e.platt;
    if (k > 40) return true;
    var x = Math.round(pl.x - camX), y = Math.round(pl.y - camY);
    if (k < 28) {
      var ein = Math.min(1, k / 3);
      var sy = 1 - ein * 0.7 + (k >= 3 ? Math.sin(k * 1.1) * 0.06 * Math.max(0, 1 - (k - 3) / 10) : 0);
      var sx = 1 + ein * 0.45;
      ctx.save();
      ctx.globalAlpha *= k > 18 ? Math.max(0, 1 - (k - 18) / 10) : 1;
      ctx.translate(x, y);
      ctx.scale(sx, sy);
      if (k < 3) P.drawWhite(ctx, spr, -e.w / 2, -e.h, e.facing < 0);
      else P.draw(ctx, spr, -e.w / 2, -e.h, e.facing < 0);
      ctx.restore();
    }
    if (k >= 16) {
      // Staubwoelkchen, die aufgehen und verblassen
      var q = (k - 16) / 24, r = 2 + q * 5;
      ctx.save();
      ctx.globalAlpha *= Math.max(0, 0.85 * (1 - q));
      for (var i = 0; i < 4; i++) {
        var wx = x + (i - 1.5) * (4 + q * 6), wy = y - 3 - q * 4 - (i % 2) * 2;
        rect(ctx, wx - r, wy - r * 0.6, r * 2, r * 1.2, '#f4ecdc');
        rect(ctx, wx - r * 0.6, wy - r, r * 1.2, r * 2, '#f4ecdc');
      }
      ctx.restore();
    }
    return true;
  }

  function gegner(ctx, G, e, spr, camX, camY) {
    var px = e.x - camX, py = e.y - camY;
    if (e.dead) {
      if (e.raus) return false;   // Airsoft: geht vom Feld (game.js)
      if (e.platt) return pfannkuchen(ctx, e, spr, camX, camY);
      // Weggehauen: wirbelt davon, am Anfang ein heller Stern
      var dir = e.vx >= 0 ? 1 : -1, k = e.deadTimer;
      ctx.save();
      ctx.globalAlpha *= Math.max(0, 1 - k / 60);
      ctx.translate(Math.round(px + e.w / 2), Math.round(py + e.h / 2));
      ctx.rotate(dir * k * 0.3);
      P.draw(ctx, spr, -e.w / 2, -e.h / 2, e.facing < 0);
      ctx.restore();
      if (k < 7) {
        var r = 4 + k * 2, cx = Math.round(px + e.w / 2), cy = Math.round(py + e.h / 2);
        ctx.save();
        ctx.globalAlpha *= 1 - k / 7;
        rect(ctx, cx - r, cy, r * 2, 1, '#ffffff');
        rect(ctx, cx, cy - r, 1, r * 2, '#ffffff');
        rect(ctx, cx - r / 2, cy - 1, r, 3, '#fff3c8');
        rect(ctx, cx - 1, cy - r / 2, 3, r, '#fff3c8');
        ctx.restore();
      }
      return true;
    }
    if (e.stun > 0) return false;   // betaeubt: wackelt wie bisher (game.js)
    var sx = 1, sy = 1, rot = 0, dy = 0;
    if (e.def.fly) {
      // Flieger neigen sich in die Flugrichtung und schaukeln
      rot = e.facing * 0.1 + Math.sin(e.t0 * 0.11) * 0.05;
    } else if (e.t === 'wecker') {
      // Der Wecker: im Sprung gestreckt, am Boden klingelt er (zittert)
      if (!e.grounded) { var st2 = Math.max(-0.1, Math.min(0.12, -e.vy * 0.025)); sx = 1 - st2 * 0.7; sy = 1 + st2; }
      else rot = Math.sin(e.t0 * 1.3) * 0.07;
    } else if (!ROLLT[e.t] && Math.abs(e.vx) > 0.05) {
      // Laeufer wippen bei jedem Schritt
      var ph = Math.abs(Math.sin(e.t0 * 0.24));
      dy = -Math.round(ph * 1.2);
      sy = 1 + (ph - 0.5) * 0.07; sx = 1 - (ph - 0.5) * 0.05;
    }
    if (sx === 1 && sy === 1 && !rot && !dy) return false;   // wie immer zeichnen
    ctx.save();
    ctx.translate(Math.round(px + e.w / 2), Math.round(py + e.h + dy));
    if (rot) ctx.rotate(rot);
    ctx.scale(sx, sy);
    if (e.flash > 0 && (G.tick >> 1) % 2 === 0) P.drawWhite(ctx, spr, -e.w / 2, -e.h, e.facing < 0);
    else P.draw(ctx, spr, -e.w / 2, -e.h, e.facing < 0);
    ctx.restore();
    return true;
  }

  global.Anim = {
    POSEN: POSEN, tick: tick, spieler: spieler, anwenden: anwenden, form: form, extras: extras,
    gegner: gegner, kante: kante,
    _zustand: function () { return st; }
  };

})(window);
