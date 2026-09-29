/* =====================================================================
   spass.js — Was die grossen Jump'n'Runs spassig macht, auf Balci Run
   uebertragen. Uebernommen sind Ideen, keine Grafiken, Toene oder Code.

     SPIELGEFUEHL   Treffer frieren das Bild kurz ein (Hit-Stop), Yusuf
                    staucht sich beim Landen und streckt sich im Sprung,
                    Staub beim Aufkommen und Abbremsen
                    (wie Celeste und Super Meat Boy)
     AURA           Stil gibt Aura, Peinlichkeit kostet sie. Wer lange cool
                    rumsteht, betreibt Aura-Farming. (Jugendwort 2024)
     RANG           Jedes Level bekommt einen Rang von C bis P
                    (wie Pizza Tower und Sonic): Goldhonig, ohne Tod,
                    in der Zeit, genug Honig
     TROPHAEEN      Bronze, Silber, Gold — und am Ende Platin. Alex hat
                    siebenundvierzig. (wie bei der Playstation)
     SO KNAPP       Nach einem Tod im Bosskampf steht da, wie viel Energie
                    der Boss noch hatte (wie Cuphead)
     GRABSTEINE     Wo Yusuf gestorben ist, steht ein Grabstein
                    (wie Super Meat Boy und Dark Souls)
     WRAPPED        Am Ende der Durchgang in Zahlen, Folie fuer Folie
   ===================================================================== */
(function (global) {
  'use strict';

  var P = global.Pixel, F = global.Font;
  function S() { return global.Sound; }
  function LV() { return global.Levels; }
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  var AURA_COL = '#c88aff';
  var T_KEY = 'balci_trophaeen';

  /* ---------- Raenge ---------- */

  var RANG = [
    { b: 'C', titel: 'NUR SALAT.', col: '#ff6a6a' },
    { b: 'B', titel: 'HALB SATT.', col: '#6fc8e8' },
    { b: 'A', titel: 'FAST SATT.', col: '#8cd85a' },
    { b: 'S', titel: 'SATT!', col: '#ffd257' },
    { b: 'P', titel: 'PLATIN! ALEX WEINT.', col: '#b8f0ff' }
  ];

  /* ---------- Trophaeen: [id, Name, Wofuer, Stufe, geheim] ----------
     Stufe: b = Bronze, s = Silber, g = Gold, p = Platin. Geheime zeigen
     ihren Namen erst, wenn man sie hat (sonst verraten sie die Story). */
  var TROPH = [
    ['aufgestanden', 'AUFGESTANDEN', 'LEVEL 1 GESCHAFFT. UM 6:45.', 'b'],
    ['hoppla', 'HOPPLA', 'ZUM ERSTEN MAL GESTORBEN. PASSIERT.', 'b'],
    ['huseyin_lacht', 'HUSEYIN HAT ES GESEHEN', 'EINMAL ALLE LEBEN WEG. ER LACHT NOCH HEUTE.', 'b'],
    ['nicht_aufgeben', 'NICHT AUFGEBEN', 'ZEHN TODE IN EINEM LEVEL. UND WEITER.', 'b'],
    ['aura_farming', 'AURA FARMING', 'EINFACH MAL COOL RUMSTEHEN.', 'b'],
    ['nur_kurz', 'NUR KURZ HINGELEGT', 'IM STEHEN EINGESCHLAFEN.', 'b'],
    ['fressrausch', 'FRESSRAUSCH', 'ZEHN SACHEN IM VORBEILAUFEN GEGESSEN.', 'b'],
    ['combo', 'COMBO X5', 'FÜNF GEGNER, KEIN BODEN DAZWISCHEN.', 's'],
    ['goldjaeger', 'GOLDHONIG-JÄGER', 'ALLE DREI GOLDHONIG IN EINEM LEVEL.', 's'],
    ['platin_rang', 'PLATIN-RANG', 'RANG P IN EINEM LEVEL.', 'g'],
    ['mirkan', 'KEINE FRAGEN MEHR', 'MIRKAN BESIEGT.', 'b'],
    ['gym', 'GEHST DU AUCH INS GYM?', 'LENNART BESIEGT. IM GYM.', 'b'],
    ['emotional_knapp', 'EMOTIONAL KNAPP', 'EINEN BOSS MIT EINEM HERZ BESIEGT.', 's'],
    ['platin', 'PLATIN', 'ALLE TROPHÄEN. ALEX: OKAY. RESPEKT.', 'p']
  ];
  var STUFE = {
    b: { name: 'BRONZE', col: '#d8905a', dunkel: '#8a5a32' },
    s: { name: 'SILBER', col: '#d8dce4', dunkel: '#8a8e98' },
    g: { name: 'GOLD', col: '#ffd257', dunkel: '#b88a1e' },
    p: { name: 'PLATIN', col: '#b8f0ff', dunkel: '#5a9ab8' }
  };
  // Welches Level welche Trophaee gibt (Level-Nummer, nicht Index)
  var LEVEL_TROPH = { 1: 'aufgestanden', 2: 'mirkan', 3: 'gym', 7: 'bester_kollege', 17: 'ragebait',
                      21: 'hand_hoch', 24: 'boeller', 26: 'kevin', 27: 'bauchlandung', 28: 'heimatland',
                      29: 'grosser_bruder', 30: 'hoe_hoe' };

  var GRAB = ['HIER LAG YUSUF. KURZ.', 'ER WOLLTE NUR HONIG.', 'R.I.P. AURA', 'MEIN FEHLER. — YUSUF',
              'WAR EIN ZWEIG.', 'NICHT NOCHMAL.', 'LAG. EINDEUTIG LAG.', 'HIER SCHLIEF YUSUF. UNFREIWILLIG.'];

  var save = null, persist = null, trophaeen = {};

  function init(G, sv, persistFn) {
    save = sv; persist = persistFn;
    try {
      var raw = global.Speicher.get(T_KEY);
      var o = raw && raw.length < 4000 ? JSON.parse(raw) : null;
      if (o && typeof o === 'object') {
        TROPH.forEach(function (t) { if (o[t[0]] === 1) trophaeen[t[0]] = 1; });
      }
    } catch (e) {}
    G.toasts = []; G.graeber = {}; G.stats = neueStats();
    G.trophaee = function (id) { trophaee(G, id); };
    // Steam-Version: was schon freigeschaltet ist, auch bei Steam melden
    // (neuer PC, Spielstand aus der Cloud). Doppelt melden schadet nicht.
    Object.keys(trophaeen).forEach(steamErfolg);
  }

  /** Steam-Erfolg setzen (nur in der Desktop-Version, siehe preload.js).
      Die API-Namen auf Steamworks sind die IDs aus TROPH, z. B. "platin". */
  function steamErfolg(id) {
    var D = global.balciDesktop;
    if (D && D.erfolg) { try { D.erfolg(id); } catch (e) {} }
  }

  function neueStats() { return { tode: {}, schlaf: 0, raenge: [0, 0, 0, 0, 0], schlafSzene: null }; }

  function speichern() {
    global.Speicher.set(T_KEY, JSON.stringify(trophaeen));
  }

  function anzahl() {
    var n = 0;
    TROPH.forEach(function (t) { if (trophaeen[t[0]]) n++; });
    return n;
  }

  function trophaee(G, id) {
    if (trophaeen[id]) return;
    var t = null;
    for (var i = 0; i < TROPH.length; i++) if (TROPH[i][0] === id) t = TROPH[i];
    if (!t) return;
    trophaeen[id] = 1;
    speichern();
    steamErfolg(id);
    G.toasts.push({ art: 'troph', t: t, zeit: 190 });
    S().play('trophaee');
    // Alle anderen: Platin
    if (id !== 'platin') {
      var fehlt = TROPH.some(function (x) { return x[0] !== 'platin' && !trophaeen[x[0]]; });
      if (!fehlt) trophaee(G, 'platin');
    }
  }

  function aura(G, n, x, y, text) {
    var p = G.player;
    if (!p) return;
    p.aura = (p.aura || 0) + n;
    if (x !== undefined) {
      G.floats.add(x, y, (n > 0 ? '+' : '') + n + ' AURA' + (text ? ' ' + text : ''), n > 0 ? AURA_COL : '#ff6a6a', 70);
    }
  }

  /* ---------- Beim Laden eines Levels ---------- */

  function laden(G, respawn) {
    G.hitstop = 0; G.squash = 0; G.warBoden = true; G.letzteVy = 0;
    G.letzterBoden = null;
    if (!respawn) { G.levelTode = 0; G.levelZaehler = (G.levelZaehler || 0) + 1; }
    var gr = G.graeber[G.lvlIndex];
    if (gr) gr.forEach(function (x) { x.gesagt = false; });
    // Nach einem Tod im Bosskampf: wie knapp war es? (wie bei Cuphead)
    if (respawn && G.bossRest) {
      G.toasts.push({ art: 'text', zeile1: G.bossRest.name + ' HATTE NOCH ' + G.bossRest.pct + '%',
                      zeile2: G.bossRest.pct <= 25 ? 'SO KNAPP. NOCHMAL.' : 'NOCHMAL. DIESMAL RICHTIG.',
                      col: '#ff8a8a', zeit: 170 });
      G.bossRest = null;
    }
    if (!respawn) G.bossRest = null;
  }

  /* ---------- Jeden Tick im Spiel ---------- */

  function tick(G) {
    var p = G.player;
    if (!p || p.dead || !G.lvl) return;
    var zuFuss = !G.lvl.bike && !G.scene && !G.eat && !(G.modus && G.modMod && G.modMod.full);
    if (G.squash > 0) G.squash--;
    if (zuFuss) {
      // Landen: Staub, und Yusuf staucht sich
      if (p.grounded && !G.warBoden && G.letzteVy > 3) {
        G.squash = 8;
        var n = Math.min(12, Math.round(G.letzteVy * 1.4));
        for (var i = 0; i < n; i++) {
          G.particles.spawn({ x: p.cx() + (Math.random() - 0.5) * 16, y: p.feet() - 1,
                              vx: (Math.random() - 0.5) * 2.4, vy: -Math.random() * 1.2, life: 18,
                              col: '#d8ccb8', size: 2, grav: 0.06 });
        }
      }
      // Abbremsen beim Umdrehen: Staub von den Schuhen
      var ax = global.Input.axis ? global.Input.axis() : 0;
      if (p.grounded && Math.abs(p.vx) > 1.6 && ax !== 0 && (ax > 0) !== (p.vx > 0) && G.tick % 3 === 0) {
        G.particles.spawn({ x: p.cx() - (p.vx > 0 ? -4 : 4), y: p.feet() - 1, vx: -p.vx * 0.3, vy: -0.6,
                            life: 14, col: '#d8ccb8', size: 2, grav: 0.05 });
      }
      if (p.grounded) G.letzterBoden = { x: p.cx(), y: p.feet() };
    }
    G.warBoden = p.grounded;
    G.letzteVy = p.vy;

    // Aura-Farming: eine Weile cool rumstehen. Danach schlaeft er ja doch ein.
    if (p.idle === 150 && !p.sleeping && zuFuss) {
      G.floats.add(p.cx(), p.y - 22, 'AURA FARMING...', AURA_COL, 90);
      aura(G, 50, p.cx(), p.y - 34);
      trophaee(G, 'aura_farming');
    }
    if (p.sleeping && !G.warSchlafend) trophaee(G, 'nur_kurz');
    G.warSchlafend = p.sleeping;
    if (p.eatCount >= 10) trophaee(G, 'fressrausch');

    // Grabsteine: wer vorbeikommt, liest die Inschrift
    var gr = G.graeber[G.lvlIndex];
    if (gr) {
      for (var gi = 0; gi < gr.length; gi++) {
        var g0 = gr[gi];
        if (!g0.gesagt && Math.abs(p.cx() - g0.x) < 14 && Math.abs(p.feet() - g0.y) < 30) {
          g0.gesagt = true;
          G.floats.add(g0.x, g0.y - 30, g0.text, '#c8c0d8', 90);
        }
      }
    }
  }

  /** Jeden Tick, egal in welchem Zustand: Hinweise laufen ab, Schlaf zaehlt */
  function immer(G) {
    if (G.toasts && G.toasts.length && G.state !== 'paused') {
      if (--G.toasts[0].zeit <= 0) G.toasts.shift();
    }
    var sc = G.scene;
    if (sc && sc.type === 'schlaf' && G.stats.schlafSzene !== sc) {
      G.stats.schlafSzene = sc;
      G.stats.schlaf++;
    }
  }

  /* ---------- Ereignisse aus dem Spiel ---------- */

  /** Hit-Stop: das Bild steht ein paar Ticks. Die Testseiten schalten ihn
      ab (G.keinHitstop), weil sie Ticks genau mitzaehlen. */
  function stop(G, n) { if (!G.keinHitstop) G.hitstop = Math.max(G.hitstop || 0, n); }

  function gegnerWeg(G, e) {
    stop(G, 3);
    if (G.combo >= 2) aura(G, 25 * G.combo, e.cx(), e.y - 32);
    if (G.combo >= 5) trophaee(G, 'combo');
  }

  function bossTreffer(G, b) {
    stop(G, 6);
    aura(G, 100);
  }

  function gold(G) {
    var p = G.player;
    aura(G, 300, p.cx(), p.y - 44);
  }

  function salto(G, flips) {
    var p = G.player;
    aura(G, flips > 1 ? 500 : 150, p.cx(), p.y - 36);
    if (flips > 1) trophaee(G, 'doppelsalto');
  }

  function tod(G, fell) {
    var p = G.player;
    G.levelTode = (G.levelTode || 0) + 1;
    G.stats.tode[G.lvlIndex] = (G.stats.tode[G.lvlIndex] || 0) + 1;
    trophaee(G, 'hoppla');
    if (G.levelTode >= 10) trophaee(G, 'nicht_aufgeben');
    if (fell) aura(G, -1000, p.cx(), Math.min(p.y, G.world.h * 16) - 40, 'VOR ALLEN.');
    else aura(G, -500, p.cx(), p.y - 40);
    // Wie viel hatte der Boss noch?
    var b = G.boss;
    if (b && !b.dead && G.bossStarted) {
      var rest = b.lebenMax ? ((b.leben - 1) * b.maxHp + Math.max(0, b.hp)) / (b.lebenMax * b.maxHp)
                            : Math.max(0, b.hp) / b.maxHp;
      var karte = (LV().bossKarten || {})[G.lvl.bossType];
      G.bossRest = { name: b.barName || (karte ? karte[0] : 'DER BOSS'), pct: Math.max(1, Math.round(rest * 100)) };
    }
    // Ein Grabstein, wo er zuletzt stand
    var zuFuss = !G.scene && !G.eat && !(G.modus && G.modMod && G.modMod.full);
    if (zuFuss) {
      var ort = (fell || !p.grounded) ? G.letzterBoden : { x: p.cx(), y: p.feet() };
      if (ort) {
        var gr = G.graeber[G.lvlIndex] || (G.graeber[G.lvlIndex] = []);
        gr.push({ x: ort.x, y: ort.y, text: rnd(GRAB), gesagt: true });
        if (gr.length > 15) gr.shift();
      }
    }
  }

  function gameOver(G) { trophaee(G, 'huseyin_lacht'); }

  /* ---------- Levelende: der Rang ---------- */

  function bewerten(G, idx) {
    var lvl = LV().list[idx], p = G.player, st = G.levelStart || { honey: 0 };
    var nGold = G.goldIdx ? G.goldIdx.length : 0, got = G.goldCount ? G.goldCount() : 0;
    var honig = 0;
    lvl.items.forEach(function (it) { if (it.t === 'honig') honig++; });
    // Level aus Yusufs Sicht (fahrt.js, downhill.js) legen ihren Honig selbst aus
    if (G.modus && G.modus.honigZahl) honig = G.modus.honigZahl;
    var k = {
      gold: !nGold || got === nGold,
      tod: (G.levelTode || 0) === 0,
      zeit: G.time / 60 <= (lvl.par || 120),
      honig: !honig || (p.honey - st.honey) >= Math.ceil(honig * 0.6)
    };
    k.n = (k.gold ? 1 : 0) + (k.tod ? 1 : 0) + (k.zeit ? 1 : 0) + (k.honig ? 1 : 0);
    return k;
  }

  function levelFertig(G, idx) {
    if (G.rangFuer === G.lvlIndex + ':' + G.levelZaehler) return;   // nur einmal pro Durchlauf
    G.rangFuer = G.lvlIndex + ':' + G.levelZaehler;
    var lvl = LV().list[idx], p = G.player;
    var k = bewerten(G, idx), r = RANG[k.n];
    G.letzterRang = { r: r, k: k };
    G.stats.raenge[k.n]++;
    if (save) {
      if (!Array.isArray(save.rang)) save.rang = [];
      save.rang[idx] = Math.max(save.rang[idx] || 0, k.n + 1);
      if (persist) persist();
    }
    var fehlt = [];
    if (!k.gold) fehlt.push('GOLDHONIG');
    if (!k.tod) fehlt.push('OHNE TOD');
    if (!k.zeit) fehlt.push('ZEIT');
    if (!k.honig) fehlt.push('HONIG');
    G.toasts.push({ art: 'rang', r: r, fehlt: fehlt, zeit: 200 });
    if (k.n >= 3) aura(G, k.n === 4 ? 1000 : 500);
    // Trophaeen fuers Level
    if (k.n === 4) trophaee(G, 'platin_rang');
    var nGold = G.goldIdx ? G.goldIdx.length : 0;
    if (nGold && G.goldCount() === nGold) trophaee(G, 'goldjaeger');
    if (LEVEL_TROPH[lvl.id]) trophaee(G, LEVEL_TROPH[lvl.id]);
    if (lvl.boss && p && p.hp === 1) trophaee(G, 'emotional_knapp');
    if (save && save.rang && save.rang[7] && save.rang[19] && save.rang[22]) trophaee(G, 'zehntausend');
  }

  /* ---------- Zeichnen ---------- */

  /** Stauchen und Strecken fuer drawPlayer */
  function form(G) {
    var p = G.player;
    if (G.squash > 0) { var s = G.squash / 8; return { sx: 1 + 0.22 * s, sy: 1 - 0.18 * s }; }
    if (!p.grounded && !p.dead && p.vy < -3) return { sx: 0.9, sy: 1.1 };
    if (!p.grounded && !p.dead && p.vy > 5) return { sx: 0.94, sy: 1.06 };
    return { sx: 1, sy: 1 };
  }

  function drawWelt(ctx, G, camX, camY) {
    var gr = G.graeber && G.graeber[G.lvlIndex];
    if (!gr) return;
    for (var i = 0; i < gr.length; i++) {
      var g0 = gr[i], x = Math.round(g0.x - camX), y = Math.round(g0.y - camY);
      if (x < -20 || x > 540) continue;
      rect(ctx, x - 5, y - 11, 10, 11, '#7a7a86');
      rect(ctx, x - 4, y - 13, 8, 2, '#7a7a86');
      rect(ctx, x - 4, y - 11, 8, 1, '#9a9aa6');
      rect(ctx, x - 1, y - 10, 2, 7, '#4a4a54');
      rect(ctx, x - 3, y - 8, 6, 2, '#4a4a54');
      rect(ctx, x - 6, y - 1, 12, 1, '#5a8a3a');
    }
  }

  function pokal(ctx, x, y, st) {
    var c = STUFE[st] || STUFE.b;
    rect(ctx, x, y, 12, 8, c.col);
    rect(ctx, x - 3, y + 1, 3, 4, c.dunkel);
    rect(ctx, x + 12, y + 1, 3, 4, c.dunkel);
    rect(ctx, x + 4, y + 8, 4, 3, c.dunkel);
    rect(ctx, x + 2, y + 11, 8, 2, c.col);
    rect(ctx, x + 2, y + 1, 2, 5, 'rgba(255,255,255,0.5)');
  }

  function drawOben(ctx, G, W, H) {
    var t = G.toasts && G.toasts[0];
    if (!t) return;
    var y = Math.min(8, -40 + (200 - t.zeit) * 4);
    if (t.zeit < 12) y = 8 - (12 - t.zeit) * 4;
    // Ausserhalb des Spiels (Ergebnis, Wrapped, Game Over, Teaser) kommt
    // der Hinweis von unten — oben stehen dort die Ueberschriften
    var imSpiel = G.state === 'play' || G.state === 'dialog' || G.state === 'paused';
    if (!imSpiel) y = H - 72 - (y - 8);
    var bw = 250, bx = Math.round(W / 2 - bw / 2);
    ctx.globalAlpha = 0.94;
    rect(ctx, bx, y, bw, 34, 'rgba(10,6,16,0.92)');
    ctx.globalAlpha = 1;
    if (t.art === 'troph') {
      var st = STUFE[t.t[3]];
      ctx.strokeStyle = st.col; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, y + 0.5, bw - 1, 33);
      pokal(ctx, bx + 12, y + 10, t.t[3]);
      F.draw(ctx, 'TROPHÄE: ' + st.name, bx + 36, y + 6, { color: st.col });
      F.draw(ctx, t.t[1], bx + 36, y + 18, { color: '#ffffff', shadow: true });
    } else if (t.art === 'rang') {
      ctx.strokeStyle = t.r.col; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, y + 0.5, bw - 1, 33);
      F.draw(ctx, t.r.b, bx + 20, y + 6, { color: t.r.col, align: 'center', scale: 3, shadow: true });
      F.draw(ctx, 'RANG ' + t.r.b + ': ' + t.r.titel, bx + 40, y + 6, { color: t.r.col });
      F.draw(ctx, t.fehlt.length ? 'FEHLT: ' + t.fehlt.join(', ') : 'ALLES DRIN. HÖ HÖ HÖÖÖ.', bx + 40, y + 19,
             { color: '#c8c0d8' });
    } else {
      ctx.strokeStyle = t.col; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, y + 0.5, bw - 1, 33);
      F.draw(ctx, t.zeile1, W / 2, y + 6, { color: t.col, align: 'center' });
      F.draw(ctx, t.zeile2, W / 2, y + 19, { color: '#c8c0d8', align: 'center' });
    }
  }

  /** Aura oben rechts unter der Zeit */
  function hud(ctx, G, rx, y) {
    var a = (G.player && G.player.aura) || 0;
    F.draw(ctx, 'AURA ' + a, rx, y, { color: a < 0 ? '#ff8a8a' : AURA_COL, align: 'right', shadow: true });
  }

  /** Auf dem Ergebnis-Bildschirm: der Rang als Stempel */
  function drawRang(ctx, G, x, y) {
    var lr = G.letzterRang;
    if (!lr) return;
    var r = lr.r, k = lr.k;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.12);
    ctx.strokeStyle = r.col; ctx.lineWidth = 3;
    ctx.strokeRect(-26, -26, 52, 52);
    F.draw(ctx, r.b, 0, -18, { color: r.col, align: 'center', scale: 5, shadow: true });
    ctx.restore();
    F.draw(ctx, r.titel, x, y + 34, { color: r.col, align: 'center' });
    var zeilen = [['GOLDHONIG', k.gold], ['OHNE TOD', k.tod], ['IN DER ZEIT', k.zeit], ['GENUG HONIG', k.honig]];
    for (var i = 0; i < zeilen.length; i++) {
      rect(ctx, x - 40, y + 50 + i * 11, 5, 5, zeilen[i][1] ? '#8cd85a' : 'rgba(255,255,255,0.2)');
      F.draw(ctx, zeilen[i][0], x - 30, y + 49 + i * 11, { color: zeilen[i][1] ? '#c8f0a8' : '#6a6280' });
    }
  }

  /** Auf der Levelkarte: der beste Rang oben rechts */
  function karte(ctx, sv, i, x, y, cw) {
    var r = sv.rang && sv.rang[i];
    if (!r) return;
    var rg = RANG[r - 1];
    F.draw(ctx, rg.b, x + cw - 4, y + 3, { color: rg.col, align: 'right', shadow: true });
  }

  /* =====================================================================
     TROPHAEEN-LISTE (aus dem Hauptmenue)
     ===================================================================== */

  function trophUpdate(G) {
    var In = global.Input;
    if (In.tap() || In.hit('jump') || In.hit('confirm') || In.hit('back') || In.hit('pause')) {
      G.state = 'title'; S().play('select');
    }
  }

  function trophDraw(ctx, G, W, H) {
    var grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#12081e'); grd.addColorStop(1, '#2a1438');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    F.draw(ctx, 'TROPHÄEN ' + anzahl() + '/' + TROPH.length, W / 2, 8, { color: '#ffd257', align: 'center', scale: 2, shadow: true });
    F.draw(ctx, anzahl() >= TROPH.length ? 'ALEX: OKAY. RESPEKT. DU HAST JETZT AUCH PLATIN.'
                : 'ALEX HAT SIEBENUNDVIERZIG PLATIN. DU HAST ' + (trophaeen.platin ? 1 : 0) + '.',
           W / 2, 26, { color: '#c9a05a', align: 'center' });
    var halb = Math.ceil(TROPH.length / 2);
    var zeile = Math.min(18, Math.floor((H - 64) / halb));
    for (var i = 0; i < TROPH.length; i++) {
      var t = TROPH[i], hat = !!trophaeen[t[0]], col = i < halb ? 0 : 1, row = i % halb;
      var x = 10 + col * (W / 2), y = 42 + row * zeile;
      ctx.globalAlpha = hat ? 1 : 0.35;
      pokal(ctx, x + 3, y + 1, t[3]);
      ctx.globalAlpha = 1;
      var geheim = t[4] && !hat;
      F.draw(ctx, geheim ? '???' : t[1], x + 22, y, { color: hat ? STUFE[t[3]].col : '#6a6280' });
      F.draw(ctx, geheim ? 'GEHEIM. SPIEL WEITER.' : t[2], x + 22, y + 8, { color: hat ? '#c8c0d8' : '#4a4458' });
    }
    if ((G.tick >> 4) % 2 === 0) {
      F.draw(ctx, G.touch ? 'TIPPEN = ZURÜCK' : 'SPRUNG = ZURÜCK', W / 2, H - 12, { color: '#ffd257', align: 'center' });
    }
  }

  /* =====================================================================
     YUSUF WRAPPED — der Durchgang in Zahlen, Folie fuer Folie
     ===================================================================== */

  function zeitText(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + s).slice(-2);
  }

  function folien(G) {
    var p = G.player, st = G.stats, sec = Math.floor((G.runTime || 0) / 60);
    var maxI = -1, maxN = 0;
    for (var k in st.tode) if (st.tode[k] > maxN) { maxN = st.tode[k]; maxI = +k; }
    var a = p.aura || 0;
    var rg = st.raenge;
    return [
      { gross: 'YUSUF WRAPPED', klein: ['DEIN DURCHGANG. IN ZAHLEN.', 'VIEL ZU VIELEN ZAHLEN.'], farbe: ['#ff4a8a', '#ffd257'] },
      { oben: 'GESPIELT', gross: zeitText(sec), klein: [st.schlaf ? 'DAVON VERSCHLAFEN: ' + st.schlaf + (st.schlaf > 1 ? ' MAL' : ' MAL') + ' EIN GANZER TAG.' : 'UND KEIN EINZIGES MAL GESCHLAFEN. WER BIST DU?'],
        farbe: ['#2a5ab8', '#6fc8e8'] },
      { oben: 'GESTORBEN', gross: '' + (p.deaths || 0), klein: maxI >= 0 ? ['AM LIEBSTEN IN: ' + LV().list[maxI].name + ' (' + maxN + ')', 'HUSEYIN HAT MITGEZÄHLT.']
                                                                          : ['KEIN EINZIGES MAL.', 'DAS IST NICHT NORMAL.'],
        farbe: ['#b8282e', '#ff8a2a'] },
      { oben: 'GEGESSEN', gross: '' + (p.eatCount || 0), klein: ['SACHEN IM VORBEILAUFEN.', 'DAZU HONIG: ' + (p.honey || 0) + ' GLÄSER.'],
        farbe: ['#2a9a4a', '#c8e060'] },
      { oben: 'AURA', gross: '' + a, klein: [a >= 5000 ? 'SEHR VIEL AURA. HUSEYIN IST NEIDISCH.' : (a >= 0 ? 'SOLIDE. AUSBAUFÄHIG.' : 'IM MINUS. PEINLICH.'), 'STAND JETZT.'],
        farbe: ['#6a2ab8', AURA_COL] },
      { oben: 'RÄNGE', gross: 'P' + rg[4] + ' S' + rg[3] + ' A' + rg[2], klein: ['B' + rg[1] + '  C' + rg[0], 'TROPHÄEN: ' + anzahl() + ' VON ' + TROPH.length],
        farbe: ['#c89a2a', '#fff0a0'] },
      { oben: 'DAMIT GEHÖRST DU ZU DEN', gross: 'TOP 1 %', klein: ['ALLER YUSUFS.', 'ES GIBT NUR EINEN YUSUF. HÖ HÖ HÖÖÖ.'],
        farbe: ['#ff4a8a', '#6fc8e8'] }
    ];
  }

  function wrappedStart(G, dann) {
    G.wrapped = { i: 0, t: 0, folien: folien(G), dann: dann };
    G.state = 'wrapped';
    S().music('menu');
  }

  function wrappedUpdate(G) {
    var w = G.wrapped, In = global.Input;
    if (!w) return;
    w.t++;
    G.particles.update();
    if (G.tick % 4 === 0) {
      G.particles.spawn({ x: Math.random() * 512, y: -4, vx: (Math.random() - 0.5) * 0.8, vy: 1 + Math.random(),
                          life: 200, col: rnd(['#ffd257', '#ff4a8a', '#6fc8e8', '#8cd85a', AURA_COL]), size: 2, grav: 0.01 });
    }
    var weiter = (w.t > 30 && (In.hit('jump') || In.hit('confirm') || In.tap())) || w.t > 260;
    if (weiter) {
      w.i++; w.t = 0;
      S().play('select');
      if (w.i >= w.folien.length) {
        G.wrapped = null;
        if (w.dann) w.dann();
      }
    }
  }

  function wrappedDraw(ctx, G, W, H) {
    var w = G.wrapped;
    if (!w) return;
    var f = w.folien[Math.min(w.i, w.folien.length - 1)];
    var grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, f.farbe[0]); grd.addColorStop(1, '#0c0612');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    // Grosse schraege Streifen wie auf den Rueckblick-Folien
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = f.farbe[1];
    ctx.translate(W / 2, H / 2); ctx.rotate(-0.4);
    for (var s = -4; s < 5; s++) ctx.fillRect(-400, s * 60 + ((w.t * 0.6) % 60), 800, 22);
    ctx.restore();
    var a = Math.min(1, w.t / 15);
    ctx.globalAlpha = a;
    if (f.oben) F.draw(ctx, f.oben, W / 2, 40, { color: '#ffffff', align: 'center', scale: 2, shadow: true });
    var sc = F.measure(f.gross, 5, 1) > W - 40 ? 3 : 5;
    F.draw(ctx, f.gross, W / 2, 76, { color: f.farbe[1], align: 'center', scale: sc, shadow: true, shadowColor: '#000000' });
    for (var i = 0; i < f.klein.length; i++) {
      F.draw(ctx, f.klein[i], W / 2, 130 + i * 14, { color: '#ffffff', align: 'center', shadow: true });
    }
    ctx.globalAlpha = 1;
    // Yusuf tanzt unten
    P.drawChar(ctx, 'yusuf', W / 2, H - 22, { pose: (w.t >> 4) % 2 ? 'cheer' : 'idle', face: 'laugh',
               frame: (G.tick >> 3), scale: 2, flip: (w.t >> 5) % 2 === 1 });
    var pl = G.particles.list;
    for (var j = 0; j < pl.length; j++) rect(ctx, pl[j].x, pl[j].y, 2, 2, pl[j].col);
    // Fortschritt oben wie Folien
    var n = w.folien.length, bw = (W - 20 - (n - 1) * 4) / n;
    for (var k = 0; k < n; k++) {
      rect(ctx, 10 + k * (bw + 4), 8, bw, 3, 'rgba(255,255,255,0.3)');
      var fill = k < w.i ? 1 : (k === w.i ? Math.min(1, w.t / 260) : 0);
      rect(ctx, 10 + k * (bw + 4), 8, bw * fill, 3, '#ffffff');
    }
    if (w.t > 30 && (G.tick >> 4) % 2 === 0) {
      F.draw(ctx, G.touch ? 'TIPPEN = WEITER' : 'SPRUNG = WEITER', W - 10, H - 12, { color: '#ffffff', align: 'right' });
    }
  }

  global.Spass = {
    init: init, laden: laden, tick: tick, immer: immer,
    neuerDurchgang: function (G) { G.stats = neueStats(); },
    gegnerWeg: gegnerWeg, bossTreffer: bossTreffer, gold: gold, salto: salto,
    tod: tod, gameOver: gameOver, levelFertig: levelFertig, bewerten: bewerten,
    trophaee: trophaee, anzahl: anzahl, gesamt: TROPH.length, hat: function (id) { return !!trophaeen[id]; },
    form: form, drawWelt: drawWelt, drawOben: drawOben, hud: hud, drawRang: drawRang, karte: karte,
    trophUpdate: trophUpdate, trophDraw: trophDraw,
    wrappedStart: wrappedStart, wrappedUpdate: wrappedUpdate, wrappedDraw: wrappedDraw,
    RANG: RANG, TROPH: TROPH
  };

})(window);
