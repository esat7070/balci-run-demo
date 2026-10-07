/* =====================================================================
   game.js — Spielschleife, Kamera, Darstellung, Menüs, Dialoge.
   ===================================================================== */
(function (global) {
  'use strict';

  var W = 512, H = 288, T = 16;
  // Render-Skala (licht.js): das Spiel rechnet in 512x288, gezeichnet wird
  // RS-mal feiner. Pixel-Figuren bleiben scharf, Licht und Nebel werden weich.
  var RS = 1;
  var LI = global.Licht, EB = global.Ebenen;
  var P = global.Pixel, F = global.Font, S = global.Sound;
  var E = global.Ent, LV = global.Levels, SP = global.Sprites;
  var BAL = global.Balance;   // alle Stellschrauben (balance.js)

  var canvas = document.getElementById('screen');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  /* ================= Speicherstand ================= */

  /* Spielstand ebenfalls streng pruefen: kaputte oder von Hand
     veraenderte Daten duerfen das Spiel nicht aus dem Tritt bringen. */
  var save = { unlocked: 1, best: [], gold: [], completed: false, bestV: 2, stufe: 'normal' };
  (function () {
    var raw = global.Speicher.get('balci_save');
    if (!raw || typeof raw !== 'string' || raw.length > 8000) return;
    var s;
    try { s = JSON.parse(raw); } catch (e) { return; }
    if (!s || typeof s !== 'object') return;

    var num = function (v, max) {
      var x = Math.floor(Number(v));
      return isFinite(x) ? Math.max(0, Math.min(max, x)) : 0;
    };

    var n = Math.floor(Number(s.unlocked));
    save.unlocked = isFinite(n) ? Math.max(1, Math.min(LV.list.length, n)) : 1;
    save.completed = (s.completed === true);
    // Zuletzt gewaehlter Schwierigkeitsgrad
    if (typeof s.stufe === 'string' && BAL.STUFEN[s.stufe]) save.stufe = s.stufe;
    // Wer das Spiel mit zwanzig Leveln schon durchgespielt hatte, muss fuer
    // Airsoft nicht nochmal den Doener bauen: Level 21 ist dann direkt offen.
    if (save.completed && save.unlocked === 20 && LV.list.length > 20) save.unlocked = 21;
    // ... und wer es mit dreiundzwanzig durch hatte, bekommt Level 24 dazu
    if (save.completed && save.unlocked === 23 && LV.list.length > 23) save.unlocked = 24;

    // Bis Version 2 standen in den Bestwerten die Summen des ganzen
    // Durchgangs statt der Werte des einzelnen Levels (Level 5 zeigte dann
    // den Honig aus Level 1 bis 5). Solche alten Werte werden verworfen.
    if (Array.isArray(s.best) && s.bestV === 2) {
      // Frueher fest "8": die Bestzeiten ab Level 9 gingen beim Neuladen verloren
      for (var i = 0; i < s.best.length && i < LV.list.length; i++) {
        var b = s.best[i];
        if (!b || typeof b !== 'object') { save.best[i] = null; continue; }
        save.best[i] = {
          honey: num(b.honey, 99999),
          score: num(b.score, 9999999),
          time: num(b.time, 359999)
        };
      }
    }
    // Bester Rang pro Level (spass.js): 0 = noch keiner, 1..5 = C..P
    save.rang = [];
    if (Array.isArray(s.rang)) {
      for (var ri = 0; ri < s.rang.length && ri < LV.list.length; ri++) save.rang[ri] = num(s.rang[ri], 5);
    }
    // Goldhonig pro Level als Bitmaske (drei Glaeser = 0..7)
    if (Array.isArray(s.gold)) {
      for (var gi = 0; gi < s.gold.length && gi < LV.list.length; gi++) {
        save.gold[gi] = num(s.gold[gi], 7);
      }
    }

    // Laufender Durchgang (fuer "WEITER"). Die Pruefsumme wird erst
    // beim Benutzen kontrolliert — siehe validRun().
    var r = s.run;
    if (r && typeof r === 'object') {
      // Frueher auf Level 7 gedeckelt: ab Level 8 passte die Pruefsumme
      // nicht mehr und WEITER hat den Durchgang verworfen.
      var lastIdx = LV.list.length - 1;
      save.run = {
        from: num(r.from, lastIdx), next: num(r.next, lastIdx),
        s: num(r.s, 9999999), h: num(r.h, 99999), t: num(r.t, 359999),
        d: num(r.d, 9999), e: num(r.e, 9999), l: num(r.l, 99),
        g: typeof r.g === 'string' ? r.g.slice(0, 16) : '',
        st: (typeof r.st === 'string' && BAL.STUFEN[r.st]) ? r.st : 'normal',
        // Aura darf negativ sein. Sie steht nicht in der Pruefsumme —
        // sonst waeren alle alten Speicherstaende ungueltig geworden.
        a: isFinite(Number(r.a)) ? Math.max(-9999999, Math.min(9999999, Math.floor(Number(r.a)))) : 0
      };
    }
  })();

  BAL.setStufe(save.stufe);

  function persist() {
    global.Speicher.set('balci_save', JSON.stringify(save));
  }

  /* ================= Spielzustand ================= */

  var G = {
    state: 'title',
    tick: 0,
    world: new E.World(),
    player: null,
    enemies: [], items: [], projectiles: [],
    particles: new E.Particles(),
    floats: new E.Floats(),
    boss: null, arena: null, bossStarted: false,
    lvl: null, lvlIndex: 0,
    cam: { x: 0, y: 0, sx: 0, sy: 0, shake: 0, shakeAmp: 0 },
    frozen: false,
    combo: 0, comboTimer: 0,
    time: 0,
    checkpoint: null,
    banner: 0,
    fade: 0, fadeDir: 0, fadeCb: null,
    dialog: null, dialogIdx: 0, dialogChar: 0, dialogAfter: null,
    menuIdx: 0, selIdx: 0,
    resultTimer: 0,
    endScroll: 0,
    // Handy/Tablet: grobe Zeigergenauigkeit = Finger
    // Die Desktop-/Steam-Version ist nie "Handy" — auch nicht auf dem
    // Touchscreen des Steam Deck (dort spielt man mit den Tasten)
    touch: !global.balciDesktop && !!(global.matchMedia && global.matchMedia('(pointer:coarse)').matches)
  };

  /** Etwas in N Spiel-Ticks ausführen. Bewusst NICHT setTimeout:
      das läuft in Echtzeit weiter, auch wenn das Spiel pausiert ist.
      Mehrere duerfen gleichzeitig laufen — frueher hat der zweite Aufruf
      den ersten einfach ueberschrieben. */
  G.timers = [];
  G.after = function (ticks, fn) { G.timers.push({ t: ticks, fn: fn }); };

  function runTimers() {
    if (!G.timers.length || G.state === 'paused') return;
    var due = [];
    G.timers = G.timers.filter(function (tm) {
      if (--tm.t > 0) return true;
      due.push(tm.fn);
      return false;
    });
    for (var i = 0; i < due.length; i++) due[i]();
  }

  G.shake = function (amp, dur) {
    // Einstellungen: Bildschirmwackeln aus
    if (global.Optionen && !global.Optionen.wackeln()) return;
    G.cam.shake = Math.max(G.cam.shake, dur);
    G.cam.shakeAmp = Math.max(G.cam.shakeAmp, amp);
  };
  G.cameraTopY = function () { return G.cam.y - 20; };
  G.viewW = function () { return W; };
  G.showDialog = function (lines, after) { startDialog(lines, after); };
  /** Sprechblase ueber einer Figur, ohne das Spiel anzuhalten (Level 12). */
  G.talk = {};
  G.say = function (who, text, dur) { G.talk[who] = { text: text, t: dur || 80, max: dur || 80 }; };
  /** Kurzes farbiges Aufblitzen, z.B. bei einer Boss-Verwandlung. */
  /* Hinweise auf dem Bildschirm: Wer zuletzt mit dem Controller gespielt
     hat, liest Controller-Tasten statt Tastatur-Namen (Steam Deck:
     keine Tastatur-Hinweise, wenn keine Tastatur benutzt wird). */
  var PAD_WORTE = [
    [/SHIFT \/ E/g, 'X'], [/SHIFT/g, 'X'], [/C ODER SPRUNG/g, 'A'],
    [/ESC = /g, 'B = '], [/ESC /g, 'B '],
    [/ESSEN MIT DER MAUS ZU YUSUF ZIEHEN\. ODER /g, 'ESSEN: '],
    [/MIT PFEILEN/g, 'MIT DEM STEUERKREUZ'], [/PFEILE/g, 'STEUERKREUZ']
  ];
  function mitPad() { return !G.touch && global.Input.quelle && global.Input.quelle() === 'pad'; }
  G.mitPad = mitPad;
  G.hinweis = function (t) {
    if (!t || !mitPad()) return t;
    for (var i = 0; i < PAD_WORTE.length; i++) t = t.replace(PAD_WORTE[i][0], PAD_WORTE[i][1]);
    return t;
  };

  G.flashScreen = function (col, dur) {
    // Einstellungen: Blitze aus (lichtempfindliche Spieler)
    if (global.Optionen && !global.Optionen.blitze()) return;
    G.flashFx = { col: col, t: dur, max: dur };
  };

  /** Geschosse und Gegner entschaerfen, OHNE die Listen zu veraendern.
      Diese Rueckrufe koennen mitten im Geschoss-Durchlauf kommen
      (Kippe trifft Boss) — geleert wird erst beim Aufraeumen danach. */
  function clearShots() {
    for (var i = 0; i < G.projectiles.length; i++) {
      if (G.projectiles[i]) G.projectiles[i].dead = true;
    }
  }
  function clearEnemies() {
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e && !e.dead) { e.dead = true; e.deadTimer = 71; }
    }
  }
  G.addItem = function (t, x, y, popped) { G.items.push(new E.Item(t, x, y, popped)); };
  G.addProjectile = function (t, x, y, vx, vy, friendly) {
    var pr = new E.Projectile(t, x, y, vx, vy, friendly);
    // Alles, was waehrend eines Bosskampfes vom Gegner kommt, fliegt
    // durch die Arena-Plattformen hindurch (siehe Projectile.solidAt).
    pr.bossShot = !!(G.boss && !G.boss.dead && !friendly);
    G.projectiles.push(pr);
    return pr;
  };

  // Rang, Trophaeen, Aura, Grabsteine, Wrapped (spass.js)
  if (global.Spass) global.Spass.init(G, save, persist);

  /* ================= Level laden ================= */

  /* Level mit eigener Spielart. Die Module stehen in eigenen Dateien.
     full = das Modul uebernimmt Welt und Bild ganz (Rennen, Doenerbude),
     sonst laeuft es zusaetzlich zur normalen Huepfwelt (Fussball). */
  var MODI = { fussball: 'Fussball', rennen: 'Rennen', doener: 'DoenerBude', pizza: 'PizzaOfen', flug: 'Flug',
               fahrt: 'Fahrt', downhill: 'Downhill' };
  function modul(lvl) { return (lvl.mode && global[MODI[lvl.mode]]) || null; }

  /* Die Bosse ab Level 17 (bosse.js): welche Klasse, welche Musik,
     welcher Dialog, und wo man nach einem Tod wieder einsteigt. */
  var NEUE_BOSSE = {
    riese: { cls: 'BossRiese', musik: 'riese', dialog: 'riese', ganzesLevel: true },
    nils:  { cls: 'BossNils', musik: 'nils', dialog: 'nils' },
    // Level 21: Sonnet. Nach der Mutation (im Buggy) laeuft andere Musik.
    sonnet: { cls: 'BossSonnet', musik: 'sonnet', musik2: 'buggy', dialog: 'sonnet' },
    // Level 26: Felix im Cockpit (felix.js). Als Felix Dogg laeuft G-Funk.
    felix: { cls: 'BossFelix', musik: 'felix', musik2: 'felixdogg', dialog: 'felix' },
    // Level 29/30: Semih (semih.js). Das ganze Level ist die Arena; jede
    // Form hat ihre eigene Musik (boss.musikJetzt).
    semih: { cls: 'BossSemih', musik: 'semihboss', dialog: 'semih', ganzesLevel: true },
    semih2: { cls: 'BossSemih2', musik: 'wut', dialog: 'semih2', ganzesLevel: true }
  };

  /** Level laden. respawn = nach einem Tod: dann geht es am letzten
      Checkpoint weiter (oder am Start), und Honig, Punkte, Items und
      Kisten stehen wieder so wie dort. Frueher galt das nur, wenn schon ein
      Checkpoint erreicht war — wer davor starb, behielt seinen Honig UND
      alle Glaeser lagen wieder da. Man konnte die erste Honigspur also
      beliebig oft abernten. */
  function loadLevel(idx, respawn) {
    // Ein noch offener Dialog gehoert zum alten Level
    G.dialog = null; G.dialogAfter = null;
    G.lvlIndex = idx;
    var lvl = LV.list[idx];
    G.lvl = lvl;
    G.world.load(lvl);
    E.setDifficulty(BAL.gegnerTempo(lvl));

    G.enemies = []; G.items = []; G.projectiles = [];
    G.particles.list.length = 0; G.floats.list.length = 0;
    G.fress = null;
    G.boss = null; G.bossStarted = false;
    G.arena = lvl.arena ? { x: lvl.arena.x * T, w: lvl.arena.w * T }
            : (lvl.boss ? { x: (lvl.boss.x - 34) * T, w: 45 * T } : null);
    // Level 8 ist keine Huepfstrecke, sondern die Szene aus eat.js
    G.eat = (lvl.eat && global.Eat) ? global.Eat.init(G, lvl) : null;
    G.modMod = modul(lvl);
    G.kasse = null;
    G.scene = null;           // Schlafengehen nach Level 11
    G.cut = null;             // Mirkans Auftritt im Airsoft (Level 21)
    G.jagd = null;            // Level 25: die Security hinter Yusuf (reise.js)
    G.high = 0;               // Level 26: Felix' Rauch. Wer stirbt, ist wieder klar.
    // Level 29/30: Semihs Dimensionen (Schwerkraft, Wind, klein sein, Scherben)
    G.schwere = 1; G.wind = 0; G.klein = 0; G.dim = null; G.riss = null;
    G.wut = !!lvl.wut;        // Level 30: Yusuf rastet aus
    G.autoAx = null; G.autoMax = 0; G.camFocus = null;
    G.talk = {};
    G.wo = {};                // wo Figuren ohne feste Stelle gerade reden (Mirkan)
    // Der Rausch gehoert zum Kampf: wer stirbt, wacht nuechtern auf.
    G.drunk = 0;
    // Lennart (und beim Airsoft Mirkan) bleibt liegen, auch wenn Yusuf
    // danach mal stirbt
    if (!respawn) { G.lennartLie = null; G.kickHint = false; G.mirkanLie = null; }

    var i;
    for (i = 0; i < lvl.enemies.length; i++) {
      var en = lvl.enemies[i];
      G.enemies.push(new E.Enemy(en.t, en.x, en.y));
    }
    // Eingesammeltes bleibt eingesammelt: nach einem Tod liegt nur das
    // wieder da, was seit dem letzten Checkpoint dazukam — alles davor
    // zaehlt ja noch auf dem Konto.
    G.itemsTaken = respawn ? copyMap(G.checkpointItems || {}) : {};
    G.goldIdx = [];
    for (i = 0; i < lvl.items.length; i++) {
      var it = lvl.items[i];
      if (it.t === 'goldhonig') G.goldIdx.push(i);
      if (G.itemsTaken[i]) continue;
      var itObj = new E.Item(it.t, it.x * T + T / 2, it.y * T + T / 2, false);
      itObj.idx = i;
      G.items.push(itObj);
    }
    // Dasselbe fuer Bloecke und Kisten
    if (respawn && G.checkpointBlocks) restoreBlocks(G.checkpointBlocks);

    G.checkpointsHit = [];
    var sp = (respawn && G.checkpoint) ? G.checkpoint : lvl.spawn;
    if (!G.player) G.player = new E.Player(sp[0] * T, sp[1] * T - 26);
    else {
      var keep = {
        lives: G.player.lives, honey: G.player.honey, score: G.player.score,
        deaths: G.player.deaths || 0, eatCount: G.player.eatCount || 0
      };
      G.player.reset(sp[0] * T, sp[1] * T - 26);
      G.player.lives = keep.lives;
      G.player.deaths = keep.deaths;
      // Beim Tod zaehlt der Stand vom letzten Checkpoint (bzw. vom
      // Levelstart). Sonst sammelt man ein, stirbt und sammelt nochmal.
      var st = (respawn && G.checkpointStats) ? G.checkpointStats : keep;
      G.player.honey = st.honey;
      G.player.score = st.score;
      G.player.eatCount = st.eatCount;
    }
    // Auf dem Fahrrad (Level 22) ist die Trefferbox etwas breiter und hoeher
    G.player.w = lvl.bike ? 20 : 12;
    G.player.h = lvl.bike ? 28 : 26;
    G.player.y = sp[1] * T - G.player.h;
    // Ein Kumpel kommt mit (Level 14 und 15 Esat zu Fuss, Level 22 Sonnet) —
    // immer auf Yusufs Spur, siehe updateRider
    G.rider = (lvl.bike || lvl.buddy) ? { hist: [], talkT: 260 } : null;
    G.dizzy = 0;
    // Nach einem Tod kurz unverwundbar (blinkt), damit ein Gegner neben
    // dem Checkpoint nicht sofort das naechste Herz nimmt.
    if (respawn) G.player.invuln = BAL.SPIELER.UNVERWUNDBAR_RESPAWN;

    // Das Modul erst jetzt starten — es braucht den fertigen Spieler
    G.modus = G.modMod ? G.modMod.init(G, lvl, respawn) : null;
    if (!respawn) {
      G.player.flipCount = 0;
      G.checkpoint = null; G.bossIntroSeen = false; G.bossHalf = false; G.bossLeben = 0;
      G.bossErledigt = false;
      G.time = 0;
      saveCheckpointState();
      G.levelStart = snapshotStats();
    }
    // Wer in die Kolonne eingestiegen ist (Level 6, fahrt.js), bleibt es auch
    // nach einem Tod — sonst kommt Erfans Dialog nach jedem Sturz wieder.
    if (!respawn || !G.convoySeen) G.convoySeen = {};

    G.cam.x = Math.max(0, Math.min(lvl.w * T - W, G.player.cx() - W / 2));
    G.cam.y = Math.max(0, Math.min(lvl.h * T - H, G.player.y - H / 2));
    // Der grosse Levelname kommt nur beim Levelstart. Nach einem Tod stand
    // er sonst drei Sekunden mitten im Bild, waehrend der Boss schon angriff
    // (Esat, 02.10.: "der fette Banner war noch auf meinem Bildschirm").
    G.banner = respawn ? 0 : 190;
    G.combo = 0;
    G.rescued = false;
    G.bossCleared = false;
    // Ein schon besiegter Boss (Mirkan, Lennart, Erfan: danach geht das Level
    // weiter) kommt nach einem Tod nicht noch einmal
    if (respawn && G.bossErledigt) { G.bossStarted = true; G.bossCleared = true; }
    G.frozen = false;
    // Begegnungen, Hinterhalte, Verstecke (strecke.js)
    if (global.Strecke) global.Strecke.laden(G, lvl, respawn);
    if (global.Spass) global.Spass.laden(G, respawn);
  }

  /** Welche Goldhonig-Glaeser dieses Levels gerade eingesammelt sind
      (Bitmaske in der Reihenfolge, in der sie in levels.js stehen). */
  function goldMask() {
    var m = 0;
    for (var n = 0; n < G.goldIdx.length; n++) if (G.itemsTaken[G.goldIdx[n]]) m |= 1 << n;
    return m;
  }
  function bits(m) { var c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
  G.goldCount = function () { return G.goldIdx ? bits(goldMask()) : 0; };

  /** Level geschafft: Bestwerte merken — und zwar nur, was IN diesem
      Level geholt wurde. Vorher stand hier der Stand des ganzen
      Durchgangs, und Level 5 zeigte den Honig aus Level 1 bis 5. Und
      Level, die mit einem Boss enden, bekamen gar keinen Eintrag. */
  function recordBest(idx) {
    var p = G.player, st = G.levelStart || { honey: 0, score: 0 };
    var rec = save.best[idx] || { honey: 0, score: 0, time: 999999 };
    rec.honey = Math.max(rec.honey, p.honey - st.honey);
    rec.score = Math.max(rec.score, p.score - st.score);
    rec.time = Math.min(rec.time, Math.floor(G.time / 60));
    save.best[idx] = rec;
    // Danach kommt der Gruppenchat (vor dem naechsten Level, chat.js)
    G.chatVon = idx;
    save.gold[idx] = (save.gold[idx] || 0) | goldMask();
    persist();
    // Der Rang fuer dieses Level (und was er an Trophaeen bringt)
    if (global.Spass) global.Spass.levelFertig(G, idx);
  }

  /* Szenen ohne Huepfen (eat.js): Schlafen, Essen am Tisch, Shisha. */
  function sceneMod() {
    var t = G.scene && G.scene.type;
    if (t === 'mahl') return global.Mahl;
    if (t === 'shisha') return global.Shisha;
    if (t === 'chat') return global.Chat;
    // Sicherheitskontrolle und Hotel (reise.js)
    if (global.Reise && global.Reise.szenen[t]) return global.Reise.szenen[t];
    // Entfuehrung, Niederlage, Suche, Ende (finale.js)
    if (global.Finale && global.Finale.szenen[t]) return global.Finale.szenen[t];
    return global.Schlaf;
  }

  /** Eine Szene starten: Blende ist schon dunkel, danach laeuft sie allein. */
  function startScene(sc) {
    G.scene = sc;
    G.particles.list.length = 0; G.floats.list.length = 0;
    G.fress = null;
    G.frozen = true;
    G.state = 'play';
  }

  /* ================= Ein Kumpel faehrt mit ================= */

  // Der Kumpel (Esat, Sonnet) faehrt Yusufs Spur nach, ein Stueck dahinter. So springt er ueber
  // dieselben Rampen und Luecken, ohne eigene Physik zu brauchen.
  var RIDER_GAP = 46;

  function updateRider(p) {
    var r = G.rider, h = r.hist;
    var gap = G.lvl.buddyGap || RIDER_GAP;
    if (!h.length) h.push({ x: p.cx() - gap, y: p.feet(), a: 0, f: 1 });
    var last = h[h.length - 1];
    var here = { x: p.cx(), y: p.feet(), a: p.flipping ? p.flipA : 0, f: p.facing };
    r.moving = Math.abs(here.x - last.x) + Math.abs(here.y - last.y) >= 2;
    if (r.moving) {
      h.push(here);
      if (h.length > 160) h.shift();
    }
    // Von hinten die Wegstrecke abzaehlen, bis der Abstand erreicht ist
    var rest = gap, i = h.length - 1, pos = h[0];
    while (i > 0) {
      var a = h[i], b = h[i - 1];
      var d = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
      if (d >= rest) {
        var k = rest / Math.max(0.001, d);
        pos = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: b.a, f: b.f };
        break;
      }
      rest -= d; i--;
    }
    r.pos = pos;
    if (r.moving) r.anim = (r.anim || 0) + 1;

    // Ab und zu hat Esat etwas zu sagen
    if (!G.cut && !p.dead && --r.talkT <= 0) {
      r.talkT = 420 + ((Math.random() * 300) | 0);
      var l = LV[G.lvl.buddyLines] || LV.esatRideLines;
      G.say(G.lvl.buddy || 'esat', l[(Math.random() * l.length) | 0], 100);
    }
  }

  /** Oberkante des Bodens an einer Stelle (fuer den Kumpel auf der Rampe). */
  function groundAt(px) {
    var w = G.world, tx = Math.floor(px / T);
    if (tx < 0 || tx >= w.w) return null;
    for (var ty = 0; ty < w.h; ty++) if (w.solid(tx, ty)) return ty * T;
    return null;
  }

  /* ================= Dialoge ================= */

  function startDialog(lines, after) {
    if (!lines || !lines.length) { if (after) after(); return; }
    G.dialog = lines;
    G.dialogIdx = 0;
    G.dialogChar = 0;
    G.dialogT = 0;
    G.dialogAfter = after || null;
    G.frozen = true;
    G.state = 'dialog';
    G.dlgArm = false; G.dlgHold = 0;
  }

  /** Dialog ganz beenden und weitermachen (auch beim Ueberspringen). */
  function endDialog() {
    G.dialog = null;
    G.frozen = false;
    G.dlgArm = false; G.dlgHold = 0;
    var cb = G.dialogAfter; G.dialogAfter = null;
    if (cb) cb(); else G.state = 'play';
  }

  var DLG_SKIP = 45;   // so lange Sprung halten = ganzen Dialog ueberspringen

  function updateDialog() {
    // Der Dialog kann schon beendet sein, während die Blende noch läuft
    // (die Rückruffunktion setzt den Zustand erst danach). Ohne diese
    // Zeile stürzt das Spiel direkt nach dem Bosssieg ab.
    if (!G.dialog) return;
    var In = global.Input;
    // ESC/P im Dialog oeffnet die Pause (frueher blaetterte es weiter)
    if (In.hit('pause')) { openPause(); return; }
    // Antippen = naechste Zeile, gedrueckt halten = alles ueberspringen.
    // Gezaehlt wird erst ab einem Druck IM Dialog, damit ein Sprung, der
    // noch aus dem Spiel gehalten wird, nicht gleich alles wegdrueckt.
    if (In.hit('jump') || In.hit('confirm')) G.dlgArm = true;
    if (G.dlgArm && (In.down('jump') || In.down('confirm'))) G.dlgHold = (G.dlgHold || 0) + 1;
    else { G.dlgHold = 0; if (!In.down('jump') && !In.down('confirm')) G.dlgArm = false; }
    if (G.dlgHold >= DLG_SKIP) {
      S.play('select');
      endDialog();
      return;
    }
    var line = G.dialog[G.dialogIdx];
    var full = line[1];
    G.dialogT = (G.dialogT || 0) + 1;
    if (line[0] === 'karte' || line[0] === 'kapitel') {
      // Die Karte steht kurz, bevor man weiterdruecken kann
      if (G.dialogT === 1) S.play(line[0] === 'karte' ? 'power' : 'gong');
      G.dialogChar = full.length;
      if (G.dialogT < (line[0] === 'karte' ? 24 : 40)) return;
    }
    if (G.dialogChar < full.length) {
      G.dialogChar += 1.6;
      if (G.dialogChar > full.length) G.dialogChar = full.length;
      if (global.Input.hit('jump') || global.Input.hit('confirm')) {
        G.dialogChar = full.length;
      }
    } else if (global.Input.hit('jump') || global.Input.hit('confirm')) {
      G.dialogIdx++;
      G.dialogChar = 0;
      G.dialogT = 0;
      S.play('select');
      if (G.dialogIdx >= G.dialog.length) endDialog();
    }
  }

  /* ================= Übergänge ================= */

  function fadeTo(cb) {
    G.fadeDir = 1; G.fadeCb = cb;
  }

  function updateFade() {
    if (G.fadeDir === 1) {
      G.fade += 0.055;
      if (G.fade >= 1) {
        G.fade = 1; G.fadeDir = -1;
        if (G.fadeCb) { var c = G.fadeCb; G.fadeCb = null; c(); }
      }
    } else if (G.fadeDir === -1) {
      G.fade -= 0.045;
      if (G.fade <= 0) { G.fade = 0; G.fadeDir = 0; }
    }
  }

  /* ================= Callbacks aus entities.js ================= */

  // Aus entities.js: Gegner erledigt, Boss getroffen, Goldhonig, Yusuf liegt
  G.onEnemyKill = function (e) {
    if (global.Spass) global.Spass.gegnerWeg(G, e);
    if (EB && e) EB.einschlag(G, e.x + e.w / 2, e.y + e.h / 2, 'gegner');
  };
  G.onBossHit = function (b, dmg) {
    if (global.Spass) global.Spass.bossTreffer(G, b, dmg);
    if (EB && b) EB.einschlag(G, b.x + b.w / 2, b.y + b.h * 0.4, 'boss');
  };
  /** Sichtbarer Einschlag (ebenen.js): Stampfer, Treffer an Yusuf. */
  G.einschlag = function (x, y, art) { if (EB) EB.einschlag(G, x, y, art); };
  G.onGold = function () { if (global.Spass) global.Spass.gold(G); };
  G.onKill = function (fell) { if (global.Spass) global.Spass.tod(G, fell); };

  /** Yusuf ist tot. Jeder Tod kostet ein Leben, weiter geht es IMMER am
      letzten Checkpoint (bzw. am Levelstart, wenn noch keiner erreicht
      ist). Sind alle Leben weg, gibt es weder Game Over noch einen Neustart
      des Levels (Esat, 29.09.): frische Leben, weiter am Checkpoint.
      Sonst bleibt alles wie bei jedem Tod — Honig und Punkte vom letzten
      Checkpoint, Eingesammeltes bleibt weg, der Boss steht beim Herz, bei
      dem man war, und ein schon besiegter Boss kommt nicht wieder. */
  G.onPlayerDead = function () {
    var p = G.player;
    p.deaths = (p.deaths || 0) + 1;
    p.lives--;
    var alleWeg = p.lives <= 0;
    if (alleWeg) {
      p.lives = BAL.s('leben');
      G.lebenWeg = (G.lebenWeg || 0) + 1;
      if (global.Spass) global.Spass.gameOver(G);
    }
    fadeTo(function () {
      if (alleWeg && G.toasts) {
        G.toasts.push({ art: 'text', zeile1: 'ALLE LEBEN WEG. HUSEYIN HAT ES GESEHEN.',
                        zeile2: p.lives + ' NEUE LEBEN. WEITER AM LETZTEN CHECKPOINT.', col: '#ffd257', zeit: 220 });
      }
      loadLevel(G.lvlIndex, true);
      var l = (G.lvl.airsoft && LV.airsoft) ? LV.airsoft.respawn : LV.deathLines;
      G.floats.add(G.player.cx(), G.player.y - 12,
                   l[(Math.random() * l.length) | 0], '#ffd257', 100);
      S.music(G.lvl.music);
      G.state = 'play';
    });
  };

  /* ---------- Gemeinsame Bausteine fuer alle Bosse ---------- */

  /** Jede Verwandlung sieht gleich aus: erst die Karte mit der neuen Form
      und dem Herz, bei dem der Boss jetzt ist, dann das Gespraech. Wer
      schon eine eigene Karte im Gespraech hat (Mirkans Felgen, Sonnets
      Buggy, Felix Dogg), behaelt sie. Semihs Formen haben ihre eigenen. */
  function mutationsKarte(lines) {
    var b = G.boss;
    if (!b || !b.lebenMax || b.formen || !lines) return lines;
    for (var i = 0; i < lines.length; i++) if (lines[i][0] === 'karte') return lines;
    var kt = LV.bossKarten && LV.bossKarten[G.lvl.bossType];
    var name = (kt && kt[0]) || b.barName || 'DER BOSS';
    var herz = b.lebenMax - b.leben + 1;
    return [['karte', name + ' MUTIERT|' + b.rageName + ' - HERZ ' + herz + ' VON ' + b.lebenMax + '|' + b.rageCol]].concat(lines);
  }

  /** Verwandlung (ein Herz ist leer): Fliegendes weg (sonst haengt beim
      Weiterspielen noch ein Salatblatt in der Luft, das man nie kommen
      sah), kurz unverwundbar, dann redet der Boss. */
  function bossPhase(lines, invuln) {
    lines = mutationsKarte(lines);
    G.bossHalf = true;
    clearShots();
    var p = G.player;
    p.invuln = Math.max(p.invuln, invuln || 80);
    // Nach jeder Verwandlung / neuen Form: volle Herzen. Die neue Phase
    // soll man frisch angehen, nicht mit einem halben Herz.
    if (!p.dead && p.hp < p.maxHp) {
      p.hp = p.maxHp;
      S.play('heal');
      G.floats.add(p.cx(), p.y - 18, 'VOLLE HERZEN!', '#ff8a8a', 90);
      G.particles.burst(p.cx(), p.y + 8, 16, { col: '#ff6a8a', spread: 2.4, up: 1.2, life: 32 });
    }
    startDialog(lines, function () { G.state = 'play'; });
  }

  /** Boss liegt: Welt anhalten, aufraeumen, Level als geschafft merken,
      kurz durchatmen, dann das Abschlussgespraech. */
  function bossDown(lines, after) {
    G.frozen = true;
    clearShots();
    clearEnemies();
    G.dizzy = 0;
    recordBest(G.lvlIndex);
    siegMoment();
    G.after(85, function () { startDialog(lines, after); });
  }

  /** Boss liegt: weisser Blitz, Konfetti aus Honig, Jubel — der Moment
      soll sich nach Sieg anfuehlen, bevor geredet wird. */
  function siegMoment() {
    var b = G.boss, p = G.player;
    G.flashScreen('#ffffff', 30);
    G.shake(10, 30);
    S.play('win');
    if (b) {
      if (EB) EB.einschlag(G, b.cx(), b.y + b.h / 2, 'sieg');
      G.particles.burst(b.cx(), b.y + b.h / 2, 60, { col: '#ffd257', spread: 5, up: 2, life: 70, grav: 0.1 });
      G.particles.burst(b.cx(), b.y + b.h / 2, 30, { col: '#ffffff', spread: 4, up: 1.5, life: 50, grav: 0.1 });
    }
    if (p && !p.dead) {
      p.cheer = 150; p.laughTimer = 80;
      G.floats.add(p.cx(), p.y - 30, 'BESIEGT! HÖ HÖ HÖÖÖ!', '#ffd257', 120);
    }
  }

  /** Aeltere Bosse waehlen ihre Angriffe rein zufaellig — der gleiche kam
      oft mehrmals hintereinander. Jetzt wird einmal neu gewuerfelt, wenn
      derselbe Angriff wie eben dran waere. */
  function keineWiederholung(b) {
    ['pick', 'pickAttack'].forEach(function (m) {
      if (typeof b[m] !== 'function') return;
      var orig = b[m];
      b[m] = function () {
        orig.apply(this, arguments);
        var st = this.state;
        if (st === this.letzterAngriff && st !== 'walk' && st !== 'idle' && st !== 'lauf' && st !== 'gehen') {
          orig.apply(this, arguments);
        }
        this.letzterAngriff = this.state;
      };
    });
  }

  /** Level idx beginnt: Stand speichern, Blende, Intro. */
  function nextLevel(idx) {
    // Die Demo hat nur die ersten Level: danach ist Schluss
    if (idx >= LV.list.length) { demoEnde(); return; }
    save.unlocked = Math.max(save.unlocked, idx + 1);
    persist();
    saveRun(idx);
    fadeTo(function () {
      G.scene = null;
      G.kasse = null;
      G.checkpoint = null;
      loadLevel(idx, false);
      S.music(LV.list[idx].music);
      levelIntro(idx);
    });
  }

  /** Das Level ist geladen: erst die Vorszene (Level 29 und 30 haben eine,
      finale.js), dann das Intro. So laeuft die Szene auch, wenn man das
      Level ueber die Levelauswahl oder WEITER startet. */
  function levelIntro(idx) {
    var lvl = LV.list[idx];
    // Gerade das Level davor geschafft? Dann erst aufs Handy schauen:
    // der Gruppenchat (chat.js, Texte in levels.js)
    var chat = (LV.chats && G.chatVon === idx - 1) ? LV.chats[lvl.id] : null;
    G.chatVon = null;
    if (chat && global.Chat && !global.Chat.aus) {
      startScene(global.Chat.init(chat, function () {
        fadeTo(function () {
          G.scene = null;
          G.frozen = false;
          levelIntro(idx);
        });
      }));
      return;
    }
    // An einem neuen Tag steht vorne die Kapitelkarte mit dem Kalender
    var lines = (LV.kapitel && LV.kapitel[lvl.id]) ? [['kapitel', String(lvl.id)]].concat(lvl.intro) : lvl.intro;
    var intro = function () { startDialog(lines, function () { G.state = 'play'; }); };
    if (lvl.vorspann && global.Finale) {
      var sc = global.Finale.init(lvl.vorspann, function () {
        fadeTo(function () {
          G.scene = null;
          G.frozen = false;
          G.banner = 190;
          S.music(lvl.music);
          intro();
        });
      });
      if (sc) { startScene(sc); return; }
    }
    intro();
  }

  /** Ende der Demo (nach Huseyin): kurz sagen, was noch kommt, dann wie
      beim echten Ende in die Bestenliste. */
  function demoEnde() {
    startDialog(LV.demoEnde || [['karte', 'ENDE DER DEMO|DANKE FÜRS SPIELEN!|#FFD257']], finishRun);
  }

  /** Der Tag ist vorbei: alles freigeschaltet, ab in die Bestenliste. */
  function finishRun() {
    save.unlocked = LV.list.length;
    save.completed = true;
    save.run = null;
    persist();
    fadeTo(function () { G.scene = null; startNameEntry(); });
  }

  function phaseLines(d, phase) { return phase === 2 ? d.phase2 : d.phase3; }

  /* ---------- Huseyin, Level 5 ---------- */

  G.onBossPhase = function (phase) { bossPhase(phaseLines(LV.boss, phase), 70); };

  G.onBossDead = function () {
    // Weiter geht's: Mustang, Stilbruch, Siegerehrung. Von Semih hoert
    // man erst wieder in Yusufs Albtraeumen (albtraum.js).
    bossDown(LV.boss.end, function () { nextLevel(5); });
  };

  /* ---------- Mirkan, Lennart, Erfan (Level 2-4) ----------
     Die geben nur den Weg frei; ins Ziel muss man danach noch selbst. */

  G.onMiniPhase = function (type, phase) {
    var d = LV.mini[type];
    bossPhase((phase === 3 && d.phase3) || d.phase2, 70);
  };

  /** Mirkan bei halber Energie: erst die Ansage ("ich mach neue Felgen
      drauf"), dann der Felgenwechsel (Verwandlung), dann lacht Yusuf ihn
      aus (phase2 in levels.js). */
  G.onMirkanFelgen = function (b) {
    G.bossHalf = true;
    clearShots();
    b.vx = 0; b.state = 'idle'; b.timer = 30;
    startDialog(LV.mini.mirkan.felgen || [], function () {
      G.state = 'play';
      E.bossKit.startTransform(b, G);
    });
  };

  G.onMiniDead = function (type) {
    G.frozen = true;
    clearShots();
    siegMoment();
    if (type === 'erfan') G.rescued = true;
    G.after(70, function () {
      startDialog(LV.mini[type].end, function () {
        G.frozen = false;
        G.bossCleared = true;
        G.bossErledigt = true;
        S.music(G.lvl.music);
        G.floats.add(G.player.cx(), G.player.y - 16, 'WEG IST FREI!', '#ffd257', 120);
        G.state = 'play';
      });
    });
  };

  /* ---------- Esat, Level 7 ---------- */

  G.onEsatPhase = function (phase) { bossPhase(phaseLines(LV.esat, phase)); };

  G.onEsatDead = function () {
    // Nach Esat geht es zu Hause weiter: Level 8, der Morgen danach.
    bossDown(LV.esat.end, function () { nextLevel(7); });
  };

  /** Level 8 geschafft: 10.000 Kalorien sind drin — und der Kuehlschrank leer. */
  G.onEatDone = function () {
    recordBest(G.lvlIndex);
    nextLevel(8);
  };

  /* ---------- Alex, Level 9 ---------- */

  G.onAlexPhase = function (phase) { bossPhase(phaseLines(LV.alex, phase)); };

  G.onAlexDead = function () {
    G.drunk = 0;                 // Kampf vorbei, Yusuf wird wieder nuechtern
    bossDown(LV.alex.end, function () {
      // Alex hat hier Schicht: Uebergang an die Kasse
      fadeTo(function () {
        G.kasse = global.Kasse ? global.Kasse.init() : null;
        G.frozen = true;
        G.state = 'play';
        if (!G.kasse) { G.onKasseDone(); return; }
        G.after(40, function () {
          startDialog(LV.alex.kasse, function () { G.onKasseDone(); });
        });
      });
    });
  };

  /** Abkassiert. Danach der Heimweg (Level 10). */
  G.onKasseDone = function () { nextLevel(9); };

  /* ---------- Broke, Level 11 ---------- */

  G.onBrokePhase = function (phase) { bossPhase(phaseLines(LV.broke, phase)); };

  G.onBrokeDead = function () {
    // Test bestanden. Die Mikas gehen mit nach Hause. Jetzt wird geschlafen.
    bossDown(LV.broke.end, function () {
      fadeTo(function () {
        startScene(global.Schlaf.init('morgen'));
        S.stopMusic();
      });
    });
  };

  /** Ausgeschlafen, jemand hat angerufen: weiter mit dem naechsten Level. */
  G.onSchlafDone = function (mode) {
    if (mode === 'fussball') { nextLevel(15); return; }
    if (mode === 'airsoft') { nextLevel(19); return; }
    if (mode === 'traum') { nextLevel(20); return; }
    if (mode === 'swat') { nextLevel(23); return; }
    nextLevel(11);
  };

  /* ---------- Hamza, Level 13 ---------- */

  G.onHamzaPhase = function (phase) { bossPhase(phaseLines(LV.hamza, phase)); };

  G.onHamzaDead = function () {
    bossDown(LV.hamza.end, function () {
      // Hamza macht Shawarma, und dann kommt Esat
      fadeTo(function () {
        startScene(global.Mahl.init('imbiss'));
        G.after(40, function () {
          startDialog(LV.hamza.essen, function () { G.onMahlDone('imbiss'); });
        });
      });
    });
  };

  /* ---------- Georgios, Level 15 ---------- */

  G.onGeorgiosPhase = function (phase) { bossPhase(phaseLines(LV.georgios, phase)); };

  G.onGeorgiosDead = function () {
    bossDown(LV.georgios.end, function () {
      fadeTo(function () {
        startScene(global.Mahl.init('taverne'));
        G.after(40, function () {
          startDialog(LV.georgios.essen, function () { G.onMahlDone('taverne'); });
        });
      });
    });
  };

  /** Satt. Nach Hamza geht es in den Stilbruch, nach Georgios ins Bett —
      und am naechsten Morgen ruft Esat an: Fussball. */
  G.onMahlDone = function (kind) {
    if (kind === 'imbiss') { nextLevel(13); return; }
    if (kind === 'galata') { nextLevel(27); return; }
    schlafen('fussball');
  };

  function schlafen(mode) {
    fadeTo(function () {
      startScene(global.Schlaf.init(mode));
      S.stopMusic();
    });
  }

  /* ---------- Level 16-20 ---------- */

  /** Fussball gewonnen. Georgios und Alex streiten — und Alex waechst. */
  G.onFussballDone = function () {
    recordBest(G.lvlIndex);
    G.frozen = true;
    startDialog(G.lvl.outro, function () { nextLevel(16); });
  };

  G.onRiesePhase = function (phase) { bossPhase(phaseLines(LV.riese, phase)); };
  G.onRieseDead = function () {
    bossDown(LV.riese.end, function () { nextLevel(17); });
  };

  /** Level 6 und 12 aus Yusufs Sicht (fahrt.js, downhill.js): angekommen.
      Weiter wie bei jedem Levelende — Stilbruch bzw. unten am Berg. */
  G.onFahrtDone = function () { finishLevel(); };
  /** Checkpoint aus einem Modul heraus (Honig, Punkte, Gold merken). */
  G.checkpointSpeichern = function () { saveCheckpointState(); };

  /** Rennen gewonnen. Und dann kommt die Polizei. */
  G.onRennenDone = function () {
    recordBest(G.lvlIndex);
    startDialog(G.lvl.outro, function () { nextLevel(18); });
  };

  G.onNilsPhase = function (phase) { bossPhase(phaseLines(LV.nils, phase)); };
  G.onNilsDead = function () {
    // Die Tuer war nie abgeschlossen. Nach Hause, schlafen, Gruppenanruf.
    bossDown(LV.nils.end, function () { schlafen('airsoft'); });
  };

  /** Zehntausend Kalorien selbst gebaut. Yusuf legt sich nur kurz hin —
      und traeumt. Am naechsten Morgen: Airsoft (Level 21). */
  G.onDoenerDone = function () {
    recordBest(G.lvlIndex);
    schlafen('traum');
  };

  /* ---------- Sonnet, Level 21 ---------- */

  G.onSonnetPhase = function (phase) {
    bossPhase(phaseLines(LV.sonnet, phase));
    if (phase === 2) S.music('buggy');
  };
  G.onSonnetDead = function () {
    // Er callt seinen Hit. Yusuf auch, endlich. Dann: Pizza.
    bossDown(LV.sonnet.end, function () { nextLevel(21); });
  };

  /** Zehntausend Kalorien Pizza. Um zwei ins Bett — vierundzwanzig
      Stunden sind geplant. Um fuenf stehen die Freunde im Zimmer. */
  G.onPizzaDone = function () {
    recordBest(G.lvlIndex);
    schlafen('swat');
  };

  /* ---------- Level 24-28: die Reise in die Tuerkei ---------- */

  /** Nach der Kontrolle (und den Boellern): rennen. Level 25. */
  G.onKontrolleDone = function () { nextLevel(24); };

  G.onFelixPhase = function (phase) {
    bossPhase(phaseLines(LV.felix, phase));
    if (phase === 2) S.music('felixdogg');
  };
  G.onFelixDead = function () {
    // Felix schlaeft. Yusuf ist wieder klar. Und fliegt jetzt selbst.
    G.high = 0;
    bossDown(LV.felix.end, function () { nextLevel(26); });
  };

  /** Bruchlandung an der Galata-Bruecke. Erst mal essen. */
  G.onFlugDone = function () {
    recordBest(G.lvlIndex);
    fadeTo(function () {
      startScene(global.Mahl.init('galata'));
      S.music('istanbul');
      G.after(40, function () {
        startDialog(LV.galata.essen, function () { G.onMahlDone('galata'); });
      });
    });
  };

  /** Rezeption, Erinnerung, Nacht. Am Morgen: die Entfuehrung (Level 29). */
  G.onHotelDone = function () { nextLevel(28); };

  /* ---------- Level 29/30: Semih ---------- */

  /** Eine neue Form, eine neue Dimension: Karte und ein paar Worte. */
  G.onSemihForm = function (form) {
    var d = LV[G.lvl.bossType === 'semih2' ? 'semih2' : 'semih'];
    bossPhase((d && d.formen && d.formen[form]) || [], 90);
  };
  /** Level 30, ganz am Ende: HOE HOE HOEOEOE gegen den Schnipser. */
  G.onSemihKraftprobe = function () { bossPhase(LV.semih2.kraftprobe, 60); };

  /** Semih liegt. Aber nur kurz: Er steht auf und schnipst. */
  G.onSemihDead = function () {
    bossDown(LV.semih.end, function () {
      fadeTo(function () {
        startScene(global.Finale.init('besiegt', function () { G.onBesiegtDone(); }));
      });
    });
  };
  /** Yusuf wurde besiegt. Die Jungs suchen ihn (Vorszene von Level 30). */
  G.onBesiegtDone = function () { nextLevel(29); };

  /** Semih liegt wirklich. Yusuf weckt die Jungs auf, dann: Stilbruch. */
  G.onSemih2Dead = function () {
    bossDown(LV.semih2.end, function () {
      fadeTo(function () {
        G.wut = false;
        startScene(global.Finale.init('ende', function () { G.onEndeDone(); }));
      });
    });
  };
  /** Das Spiel ist aus: Bestenliste, Wrapped, Abspann. */
  G.onEndeDone = function () { finishRun(); };

  /** Drei Mal ausgepustet, und Yusuf hat Hunger: weiter zu Georgios. */
  G.onShishaDone = function () { nextLevel(14); };

  /** Ein Salto ist gelandet. Esat hat dazu eine Meinung. */
  G.onFlip = function (flips) {
    if (global.Spass) global.Spass.salto(G, flips);
    var r = G.rider;
    if (!r || G.cut) return;
    var l = LV[G.lvl.buddyFlipLines] || LV.esatFlipLines;
    G.say(G.lvl.buddy || 'esat', flips > 1 ? 'ZWEI?! OKAY, DU BIST VERRÜCKT.' : l[(Math.random() * l.length) | 0], 90);
    r.talkT = Math.max(r.talkT, 200);
  };

  /* ================= Update ================= */

  function update() {
    G.tick++;
    global.Input.poll();
    updateFade();

    runTimers();

    // Nachgeholte Pause (wurde waehrend einer Blende angefordert)
    if (G.wantPause && !G.fadeDir) {
      if (G.state === 'play' || G.state === 'dialog') openPause();
      else G.wantPause = false;
    }

    if (global.Spass) global.Spass.immer(G);

    switch (G.state) {
      case 'title': updateTitle(); break;
      case 'select': updateSelect(); break;
      case 'howto': updateHowto(); break;
      case 'dialog': updateDialog(); updateWorld(); break;
      // Hit-Stop: nach einem Treffer steht das Bild ein paar Ticks still.
      // Das macht Treffer spuerbar (wie bei Celeste und Super Meat Boy).
      case 'play': if (G.hitstop > 0) G.hitstop--; else updatePlay(); break;
      case 'wrapped': global.Spass.wrappedUpdate(G); break;
      case 'trophaeen': global.Spass.trophUpdate(G); break;
      case 'optionen': global.Optionen.update(G); break;
      case 'paused': updatePaused(); break;
      case 'clear': updateClear(); break;
      case 'ending': updateEnding(); break;
      case 'nameentry': updateNameEntry(); break;
      case 'scores': updateScores(); break;
    }

    if (global.Input.hit('mute')) {
      G.muteState = S.toggleMute();
      G.muteFlash = 60;
    }
    if (G.muteFlash > 0) G.muteFlash--;
    if (G.flashFx && G.flashFx.t > 0 && G.state !== 'paused') G.flashFx.t--;

    global.Input.endFrame();
  }

  /** Das Menue haengt vom Fortschritt ab, darum wird es gebaut statt
      fest verdrahtet. Levelauswahl gibt es erst nach dem Durchspielen. */
  /** Wohin "WEITER" fuehrt: zum gespeicherten Durchgang, sonst zum
      zuletzt freigeschalteten Level. Menue und Start nutzen dieselbe Zahl. */
  function continueTarget() {
    var r = save.run && validRun(save.run.next) ? save.run : null;
    return r ? r.next : Math.min(LV.list.length - 1, save.unlocked - 1);
  }

  function menuItems() {
    var items = [{ k: 'play', label: 'NEUES SPIEL' }];
    if (save.unlocked > 1) {
      items.push({ k: 'continue', label: 'WEITER AB LEVEL ' + (continueTarget() + 1) });
    }
    // Levelauswahl ist immer da. Freigeschaltet wird Level fuer Level,
    // damit man nach einem Absturz nicht wieder von vorne anfangen muss.
    items.push({ k: 'select', label: 'LEVEL WÄHLEN' });
    items.push({ k: 'scores', label: 'BESTENLISTE' });
    items.push({ k: 'howto', label: 'STEUERUNG' });
    if (global.Spass) items.push({ k: 'troph', label: 'TROPHÄEN ' + global.Spass.anzahl() + '/' + global.Spass.gesamt });
    items.push({ k: 'optionen', label: 'EINSTELLUNGEN' });
    // In der Steam-/Desktop-Version: sauber beenden
    if (global.balciDesktop && global.balciDesktop.beenden) items.push({ k: 'beenden', label: 'BEENDEN' });
    return items;
  }

  function inRect(tp, r) {
    return tp && tp.x >= r.x && tp.x < r.x + r.w && tp.y >= r.y && tp.y < r.y + r.h;
  }

  /* Wo die Dinge auf dem Titelbild liegen — Zeichnen und Antippen
     benutzen dieselben Masse. */
  function titleMenuTop(n) { return 160 - (n - 5) * 9; }   // 8 Eintraege (Desktop mit WEITER) enden ueber dem Boden
  function titleBoardRect() { return { x: W - 158, y: 110, w: 150, h: 96 }; }

  function activateMenu(it) {
    S.resume();
    S.play('select');
    if (it.k === 'play') startGame(0);
    else if (it.k === 'continue') startGame(continueTarget(), true);
    else if (it.k === 'select') { G.state = 'select'; G.selIdx = 0; }
    else if (it.k === 'scores') openScores();
    else if (it.k === 'howto') G.state = 'howto';
    else if (it.k === 'troph') G.state = 'trophaeen';
    else if (it.k === 'optionen') global.Optionen.oeffnen(G, 'title');
    else if (it.k === 'beenden') beenden();
  }

  /** Desktop-Version: Spielstand sichern, dann das Fenster schliessen. */
  function beenden() {
    persist();
    fadeTo(function () { global.balciDesktop.beenden(); });
  }

  function openScores() {
    G.scoreCat = 0;
    G.state = 'scores';
    if (global.Online) global.Online.refresh(true);
  }

  function updateTitle() {
    var items = menuItems();
    var n = items.length;
    if (G.menuIdx >= n) G.menuIdx = 0;
    if (global.Online && G.tick % 120 === 0) global.Online.refresh();

    // Am Handy: Menuepunkte direkt antippen
    var tp = global.Input.tap();
    if (tp) {
      var top0 = titleMenuTop(n);
      for (var i = 0; i < n; i++) {
        var half = F.measure(items[i].label, 1, 1) / 2 + 24;
        if (inRect(tp, { x: W / 2 - half, y: top0 + i * 15 - 5, w: half * 2, h: 15 })) {
          G.menuIdx = i;
          activateMenu(items[i]);
          return;
        }
      }
      if (inRect(tp, titleBoardRect())) { S.play('select'); openScores(); }
      return;   // daneben getippt: nichts tun, statt versehentlich zu starten
    }

    if (global.Input.hit('down')) { G.menuIdx = (G.menuIdx + 1) % n; S.play('move'); }
    if (global.Input.hit('up')) { G.menuIdx = (G.menuIdx + n - 1) % n; S.play('move'); }
    if (global.Input.hit('jump') || global.Input.hit('confirm')) activateMenu(items[G.menuIdx]);
    // Ton erst nach der ersten Beruehrung/Taste — vorher verweigert der
    // Browser ihn ohnehin und schreibt nur Warnungen in die Konsole.
    if (G.gestured && G.tick % 6 === 0) S.resume();
  }

  /** Karten-Masse der Levelauswahl — fuer Zeichnen und Antippen. */
  function selectCards() {
    // Ab elf Leveln passen die Karten nicht mehr in eine Reihe: dann zwei.
    // Ab einundzwanzig: drei (sonst werden die Karten zu schmal fuer den Honig).
    var nL = LV.list.length, gap = 6;
    var rows = nL > 20 ? 3 : (nL > 10 ? 2 : 1);
    var perRow = Math.ceil(nL / rows);
    var cw = Math.min(76, Math.floor((W - 24 - gap * (perRow - 1)) / perRow));
    var ch = rows > 2 ? 50 : (rows > 1 ? 72 : 130);
    var y0 = rows > 2 ? 52 : (rows > 1 ? 56 : 80);
    var rowGap = rows > 2 ? 6 : 8;
    var left0 = Math.round((W - (cw * perRow + gap * (perRow - 1))) / 2);
    return { n: nL, gap: gap, cw: cw, ch: ch, left0: left0, y: y0, rows: rows, perRow: perRow,
             rowGap: rowGap, bottom: y0 + rows * ch + (rows - 1) * rowGap };
  }

  function cardRect(sc, i) {
    var row = Math.floor(i / sc.perRow), col = i % sc.perRow;
    return { x: sc.left0 + col * (sc.cw + sc.gap), y: sc.y + row * (sc.ch + sc.rowGap), w: sc.cw, h: sc.ch };
  }

  function updateSelect() {
    var max = Math.min(LV.list.length, save.unlocked);
    var sc = selectCards();
    var tp = global.Input.tap();
    if (tp) {
      for (var i = 0; i < max; i++) {
        var cr = cardRect(sc, i);
        if (inRect(tp, { x: cr.x, y: cr.y - 8, w: cr.w, h: cr.h + 8 })) {
          if (G.selIdx === i) { S.play('select'); startGame(i); }
          else { G.selIdx = i; S.play('move'); }
          return;
        }
      }
      if (tp.y > H - 40) { G.state = 'title'; S.play('select'); }
      return;
    }
    if (global.Input.hit('right')) { G.selIdx = Math.min(max - 1, G.selIdx + 1); S.play('move'); }
    if (global.Input.hit('left')) { G.selIdx = Math.max(0, G.selIdx - 1); S.play('move'); }
    if (sc.rows > 1 && global.Input.hit('down') && G.selIdx + sc.perRow < max) {
      G.selIdx += sc.perRow; S.play('move');
    }
    if (sc.rows > 1 && global.Input.hit('up') && G.selIdx - sc.perRow >= 0) {
      G.selIdx -= sc.perRow; S.play('move');
    }
    if (global.Input.hit('jump') || global.Input.hit('confirm')) {
      S.play('select'); startGame(G.selIdx);
    }
    if (global.Input.hit('back') || global.Input.hit('pause')) {
      G.state = 'title'; S.play('select');
    }
  }

  function updateHowto() {
    if (global.Input.anyHit()) { G.state = 'title'; S.play('select'); }
  }

  function startGame(idx, cont) {
    G.timers = [];
    // WEITER spielt auf der Stufe weiter, auf der der Durchgang begann
    var rs = cont ? validRun(idx) : null;
    BAL.setStufe(rs && rs.st ? rs.st : (save.stufe || 'normal'));
    fadeTo(function () {
      G.checkpoint = null;
      var p = G.player, r = cont ? validRun(idx) : null;
      p.maxHp = BAL.s('herzen');
      loadLevel(idx, false);
      if (r) {
        // Gespeicherten Durchgang fortsetzen
        p.lives = Math.max(r.l, 2); p.honey = r.h; p.score = r.s;
        p.honigLeben = Math.floor(r.h / 100);
        p.deaths = r.d; p.eatCount = r.e; p.aura = r.a || 0;
        G.run = { from: r.from, st: BAL.stufe };
        G.runTime = r.t * 60;
      } else {
        p.lives = BAL.s('leben'); p.honey = 0; p.score = 0; p.deaths = 0; p.eatCount = 0; p.aura = 0;
        p.honigLeben = 0;
        G.run = { from: idx, st: BAL.stufe };
        G.runTime = 0;
      }
      // Erst JETZT den Stand merken — vorher stand hier noch der Honig
      // der letzten Runde drin, und ein Tod vor dem ersten Checkpoint
      // hat ihn zurueckgeholt.
      saveCheckpointState();
      G.levelStart = snapshotStats();
      G.lastName = null; G.lastScore = null;
      if (global.Spass) global.Spass.neuerDurchgang(G);
      S.music(LV.list[idx].music);
      G.chatVon = null;
      levelIntro(idx);
    });
  }

  /** Antippbare Knoepfe fuer die Pause (am Handy gibt es kein ESC). */
  function touchButtons(y, labels) {
    var bw = 100, gap = 8, total = labels.length * bw + (labels.length - 1) * gap;
    var x0 = Math.round((W - total) / 2), out = [];
    for (var i = 0; i < labels.length; i++) {
      out.push({ x: x0 + i * (bw + gap), y: y, w: bw, h: 24, label: labels[i] });
    }
    return out;
  }

  /** Knoepfe fuer die Pause. sel = der gerade ausgewaehlte
      (Pfeile/Steuerkreuz); am Handy tippt man direkt. */
  function drawTouchButtons(btns, sel) {
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], an = (sel === i);
      rect(b.x, b.y, b.w, b.h, an ? 'rgba(92,62,24,0.97)' : 'rgba(38,26,54,0.95)');
      ctx.strokeStyle = an ? '#ffe9a8' : '#ffc23c';
      ctx.lineWidth = an ? 2 : 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      F.draw(ctx, b.label, b.x + b.w / 2, b.y + 9, { color: an ? '#ffffff' : '#ffe9a8', align: 'center' });
      if (an && (G.tick >> 4) % 2 === 0) F.draw(ctx, '>', b.x - 8, b.y + 9, { color: '#ffd257' });
    }
  }

  function pauseButtons() {
    return touchButtons(170, ['WEITER', 'EINSTELLUNGEN', 'HAUPTMENÜ']);
  }

  function toTitle() {
    // Was noch geplant war (Boss-Abspann, Levelende), gehoert zum alten
    // Spiel. Sonst sprang mitten im Hauptmenue ein Dialog auf.
    G.timers = [];
    fadeTo(function () { G.timers = []; G.state = 'title'; G.menuIdx = 0; S.music('menu'); });
  }

  /** Pause oeffnen — aus dem Spiel oder mitten aus einem Dialog. Beim
      Fortsetzen geht es genau dorthin zurueck. */
  function openPause() {
    G.pauseFrom = (G.state === 'dialog') ? 'dialog' : 'play';
    G.state = 'paused';
    G.pauseSel = 0;
    G.wantPause = false;
    S.play('pause');
  }
  function resume() {
    G.state = G.pauseFrom || 'play';
    S.play('pause');
  }
  G.openPause = openPause;

  /* Auto-Pause: wer das Fenster wechselt, minimiert oder eine
     Benachrichtigung oeffnet, soll nicht zurueckkommen und tot sein.
     (Das Steam-Overlay loest das nur aus, wenn es dem Fenster den Fokus
     nimmt — in der Steam-Version pruefen.) Laeuft gerade eine Blende,
     wird die Pause danach nachgeholt. */
  function autoPause() {
    if (G.state !== 'play' && G.state !== 'dialog') return;
    if (G.fadeDir) { G.wantPause = true; return; }
    openPause();
  }
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', function () { if (document.hidden) autoPause(); });

  function activatePause(i) {
    if (i === 0) resume();
    else if (i === 1) global.Optionen.oeffnen(G, 'paused');
    else toTitle();
  }

  function updatePaused() {
    var In = global.Input, pb = pauseButtons();
    if (G.pauseSel === undefined) G.pauseSel = 0;
    var tp = In.tap();
    if (tp) {
      for (var i = 0; i < pb.length; i++) if (inRect(tp, pb[i])) { G.pauseSel = i; activatePause(i); return; }
      return;
    }
    if (In.hit('left') || In.hit('up')) { G.pauseSel = (G.pauseSel + pb.length - 1) % pb.length; S.play('move'); }
    if (In.hit('right') || In.hit('down')) { G.pauseSel = (G.pauseSel + 1) % pb.length; S.play('move'); }
    // Pause-Taste und "zurueck" (auch B am Controller, das zugleich
    // Springen ist) setzen immer nur fort. Ins Hauptmenue geht es nur,
    // wenn man HAUPTMENUE auswaehlt und bestaetigt — frueher hat ein
    // Druck auf B den ganzen Levelfortschritt weggeworfen.
    if (In.hit('pause') || In.hit('back')) { resume(); return; }
    if (In.hit('jump') || In.hit('confirm')) activatePause(G.pauseSel);
  }

  function updatePlay() {
    if (global.Input.hit('pause')) {
      // Waehrend einer Blende (Tod, Levelwechsel) erst danach pausieren —
      // sonst hebt das Ende der Blende die Pause gleich wieder auf.
      if (G.fadeDir) G.wantPause = true; else openPause();
      return;
    }
    G.time++;
    G.runTime = (G.runTime || 0) + 1;
    updateWorld();
  }

  /** Stand, auf den beim Tod zurueckgesetzt wird. */
  function snapshotStats() {
    var p = G.player;
    return { honey: p.honey, score: p.score, eatCount: p.eatCount || 0 };
  }

  function copyMap(src) {
    var out = {};
    for (var k in src) out[k] = src[k];
    return out;
  }

  /** Zustand aller Bloecke (leer, kaputt, wie viel noch drin). */
  function snapshotBlocks() {
    var out = {};
    for (var key in G.world.blocks) {
      var b = G.world.blocks[key];
      out[key] = { used: b.used, count: b.count, dead: b.dead };
    }
    return out;
  }

  function restoreBlocks(snap) {
    for (var key in snap) {
      var b = G.world.blocks[key], s = snap[key];
      if (!b) continue;
      b.used = s.used; b.count = s.count;
      if (s.dead && !b.dead) G.world.clearBlock(b);
    }
  }

  /** Alles merken, was beim Tod zurueckgesetzt wird: Stand, Items, Bloecke. */
  function saveCheckpointState() {
    G.checkpointStats = snapshotStats();
    G.checkpointItems = copyMap(G.itemsTaken);
    G.checkpointBlocks = snapshotBlocks();
  }

  /** Entfernt Einträge aus einer Liste — nur ausserhalb eines Durchlaufs. */
  function sweep(list, isGone) {
    for (var i = list.length - 1; i >= 0; i--) {
      if (!list[i] || isGone(list[i])) list.splice(i, 1);
    }
  }

  function updateWorld() {
    var p = G.player, i;
    if (global.Fress) global.Fress.update(G);
    // Level 8 hat seine eigene Welt (Couch, Schreibtisch, Essen)
    if (G.scene) { sceneMod().update(G, W, H); return; }
    if (G.kasse) { global.Kasse.update(G, W, H); return; }
    if (G.eat) { global.Eat.update(G, W, H); return; }
    if (G.modus && G.modMod.full) {
      // Der Levelname oben geht auch in den Modulen nach ein paar Sekunden weg
      // (vorher blieb er in Mustang, Downhill, Rennen, Doener und Pizza stehen)
      if (G.banner > 0) G.banner--;
      G.modMod.update(G, W, H);
      return;
    }
    // Während eines Dialogs steht die ganze Welt still. Vorher lief
    // Huseyin weiter und hat Yusuf verprügelt, während man nicht
    // steuern konnte — das war der unfairste Bug im Spiel.
    var frozen = G.frozen;

    if (!frozen) G.world.updateMovers();
    p.update(G);
    // Staub, Stauchen, Aura-Farming, Grabsteine (spass.js)
    if (global.Spass && !frozen) global.Spass.tick(G);

    if (G.comboTimer > 0) { G.comboTimer--; if (G.comboTimer === 0) G.combo = 0; }
    if (p.grounded) G.comboTimer = Math.min(G.comboTimer, 20);

    // Fussball (Level 16): Ball und Mitspieler
    if (G.modus && !frozen) G.modMod.update(G, W, H);

    // Der Kumpel faehrt/laeuft hinterher (Level 14, 15, 22)
    if (G.rider && !frozen) updateRider(p);
    // Level 21: Mirkans Auftritt auf der Lichtung (airsoft.js)
    if (G.lvl.mirkanCut && !frozen && global.Airsoft) global.Airsoft.mirkanCut(G, p);
    // Level 25: die Security ist hinter Yusuf her (reise.js)
    if (G.lvl.jagd && !frozen && !G.cut && global.Reise) global.Reise.jagd(G, p);

    // Waehrend Lennarts (oder Mirkans) Auftritt steht der Rest der Welt still
    if (!frozen && !G.cut) {
      // WICHTIG: erst alles bewegen, dann aufräumen.
      // Ein Treffer kann mitten im Durchlauf einen Boss töten oder eine
      // Phase starten — und dabei wurden diese Listen geleert. Der
      // nächste Schleifenschritt griff dann ins Leere und das Spiel
      // stürzte ab. Darum wird hier nie während des Durchlaufs entfernt.
      for (i = G.enemies.length - 1; i >= 0; i--) {
        var e = G.enemies[i];
        if (!e) continue;
        var near = (e.x > G.cam.x - 160 && e.x < G.cam.x + W + 160);
        // Ansturm-Mikas laufen auch ausserhalb des Bildes weiter — sonst
        // bleiben sie am Rand der Arena stehen und kommen nie an.
        if (near || e.dead || e.stampede) e.update(G);
      }
      for (i = G.items.length - 1; i >= 0; i--) {
        var it = G.items[i];
        if (!it) continue;
        if (it.x > G.cam.x - 120 && it.x < G.cam.x + W + 120) it.update(G);
      }
      for (i = G.projectiles.length - 1; i >= 0; i--) {
        var pr = G.projectiles[i];
        if (!pr) continue;
        pr.update(G);
      }
    }
    // Auch im Dialog aufraeumen: dort werden Geschosse nur als "weg"
    // markiert und sollen nicht eingefroren sichtbar bleiben.
    sweep(G.enemies, function (x) { return x.dead && x.deadTimer > 70; });
    sweep(G.items, function (x) { return x.dead; });
    sweep(G.projectiles, function (x) { return x.dead; });

    // Blöcke "wackeln"
    for (var key in G.world.blocks) {
      var b = G.world.blocks[key];
      if (b.bump > 0) b.bump--;
    }

    // Checkpoints
    var cps = G.lvl.checkpoints;
    for (i = 0; i < cps.length; i++) {
      var cx = cps[i][0] * T, cy = cps[i][1] * T;
      if (!G.checkpointsHit[i] &&
          Math.abs(p.cx() - (cx + 12)) < 26 && Math.abs(p.feet() - cy) < 40) {
        G.checkpointsHit[i] = true;
        G.checkpoint = cps[i];
        saveCheckpointState();
        S.play('checkpoint');
        G.floats.add(cx + 12, cy - 22, 'KURZES NICKERCHEN GESPEICHERT', '#ffd257', 100);
        G.particles.burst(cx + 12, cy - 6, 14, { col: '#ffd257', spread: 2.4, up: 1, life: 30 });
      }
    }

    // Leute am Weg, Hinterhalte, falsche Waende (strecke.js)
    if (global.Strecke && !frozen && !G.cut) global.Strecke.update(G);

    // Boss auslösen
    if (G.arena && !G.bossStarted && p.cx() > G.arena.x + 56) {
      G.bossStarted = true;
      // Kein Banner ueber einem laufenden Bosskampf
      G.banner = 0;
      var bt = G.lvl.bossType;
      // Kein Gold-Doener im Bosskampf: der laufende ist verdaut, und was
      // davon noch in der Arena liegt, verschwindet
      if (p.power > 0) {
        p.power = 0;
        G.floats.add(p.cx(), p.y - 20, 'GOLD-DÖNER VERDAUT.', '#ffe38a', 90);
      }
      for (var gi = 0; gi < G.items.length; gi++) {
        var gIt = G.items[gi];
        if (gIt && gIt.t === 'gold' && gIt.x > G.arena.x - 32) gIt.dead = true;
      }
      var aTile = Math.floor(G.arena.x / T);
      var groundY = G.lvl.boss.y;

      if (NEUE_BOSSE[bt]) {
        var nb = NEUE_BOSSE[bt];
        G.boss = new E[nb.cls](G.lvl.boss.x, G.lvl.boss.y);
        if (nb.ganzesLevel) {
          G.checkpoint = [G.lvl.spawn[0], G.lvl.spawn[1]];
        } else {
          G.world.fill(aTile - 1, 2, 1, groundY - 1, 1);
          G.checkpoint = [aTile + 3, groundY];
        }
        saveCheckpointState();
      } else if (bt === 'alex' || bt === 'hamza' || bt === 'georgios') {
        var BossCls = bt === 'alex' ? E.BossAlex : (bt === 'hamza' ? E.BossHamza : E.BossGeorgios);
        G.boss = new BossCls(G.lvl.boss.x, G.lvl.boss.y);
        G.world.fill(aTile - 1, 2, 1, groundY - 1, 1);
        G.checkpoint = [aTile + 3, groundY];
        saveCheckpointState();
      } else if (bt === 'broke') {
        // Die Arena ist das ganze Level: Wiedereinstieg vor der Haustuer
        G.boss = new E.BossBroke(G.lvl.boss.x, G.lvl.boss.y);
        G.checkpoint = [G.lvl.spawn[0], G.lvl.spawn[1]];
        saveCheckpointState();
      } else if (bt === 'esat') {
        G.boss = new E.BossEsat(G.lvl.boss.x, G.lvl.boss.y);
        G.checkpoint = [G.lvl.spawn[0], G.lvl.spawn[1]];
      } else if (E.MINIBOSS[bt]) {
        G.boss = new E.MiniBoss(bt, G.lvl.boss.x, G.lvl.boss.y);
        // Zurueck geht nicht mehr, und der Wiedereinstieg liegt drinnen.
        G.world.fill(aTile - 1, 2, 1, groundY - 1, 1);
        G.checkpoint = [aTile + 3, groundY];
        saveCheckpointState();
      } else {
        G.boss = new E.Boss(G.lvl.boss.x, G.lvl.boss.y);
        G.world.fill(aTile - 1, 2, 1, 13, 1);
        G.checkpoint = [aTile + 4, 15];
        saveCheckpointState();
      }
      G.boss.intro = false;
      // Energie und Verschnaufpausen je nach Schwierigkeitsgrad (balance.js)
      BAL.bossAnpassen(G.boss, bt);
      keineWiederholung(G.boss);
      // Halbzeit-Checkpoint: wer nach der Verwandlung stirbt, faengt
      // nicht wieder bei voller Energie an. Mehr Leben pro Boss ist nur
      // fair, wenn man die erste Haelfte nicht immer wiederholen muss.
      if (G.boss.lebenMax && G.bossLeben) {
        // Weiter mit dem Herz, bei dem man war (naechstesLeben schreibt
        // G.bossLeben neu — also vorher merken)
        var weg = G.bossLeben;
        for (var lv = 0; lv < weg; lv++) {
          if (G.boss.naechstesLeben) G.boss.naechstesLeben(G, true);
          else E.bossKit.naechstesLeben(G.boss, G, true);
        }
        G.boss.state = 'idle'; G.boss.timer = 70;
        // Alex: wer im zweiten oder dritten Herz stirbt, ist danach immer
        // noch besoffen, der zweite Alex steht wieder da (Esat, 02.10.).
        // Alle anderen Bosse lassen Yusuf nuechtern weitermachen.
        if (bt !== 'alex') G.drunk = 0;
        G.floats.add(G.boss.cx(), G.boss.y - 20, 'WEITER AB ' + (G.boss.lebenWort || 'HERZ') + ' ' + (G.bossLeben + 1), '#ffd257', 120);
      } else if (G.bossHalf) {
        var hb = G.boss;
        hb.hp = Math.floor(hb.maxHp / 2);
        hb.onTransform(G);
        hb.phase = 2;
        hb.state = 'idle'; hb.timer = 70;
        // Nach einem Tod faengt der Kampf ab der Haelfte an — aber
        // nuechtern. Alex kippt nicht nochmal nach.
        G.drunk = 0;
        G.floats.add(hb.cx(), hb.y - 20, 'WEITER AB HALBZEIT', '#ffd257', 120);
      }
      // Jeder Kampf klingt anders (Semih: jede Form)
      S.music(G.boss.musikJetzt ? G.boss.musikJetzt()
              : NEUE_BOSSE[bt] ? ((G.bossHalf && NEUE_BOSSE[bt].musik2) || NEUE_BOSSE[bt].musik) : bt === 'esat' ? 'bossfinal'
              : ((E.MINIBOSS[bt] || bt === 'alex' || bt === 'broke' || bt === 'hamza') ? 'boss2' : 'boss'));
      G.shake(5, 20);

      if (!G.bossIntroSeen) {
        G.bossIntroSeen = true;
        // Esat und Broke reden vorher schon im Level-Intro
        var d0 = (bt === 'esat' || bt === 'broke') ? null
               : NEUE_BOSSE[bt] ? LV[NEUE_BOSSE[bt].dialog].start
               : (bt === 'alex') ? LV.alex.start
               : (bt === 'hamza') ? LV.hamza.start
               : (bt === 'georgios') ? LV.georgios.start
               : (E.MINIBOSS[bt] ? LV.mini[bt].start : LV.boss.start);
        // Erst das Standbild mit Namen (wie im Kino), dann das Gespraech.
        // Nach einem Tod (auch mit allen Leben) kommt beides nicht wieder.
        var kt = LV.bossKarten && LV.bossKarten[bt];
        if (kt) d0 = [['karte', kt.join('|')]].concat(d0 || []);
        if (d0) startDialog(d0, function () { G.state = 'play'; });
      }
    }

    // Der Boss bewegt sich im Dialog nicht — nur seine Todesanimation läuft weiter.
    if (G.boss && (!frozen || G.boss.dead)) G.boss.update(G);

    // Ziel
    if (!p.won && !p.dead) {
      var gx = G.lvl.goal[0] * T, gy = G.lvl.goal[1] * T;
      // Mirkan, Lennart und Erfan geben nur den Weg frei. Alle anderen
      // Bosse beenden das Level selbst (Abspann, Szene, naechstes Level).
      var canFinish = !G.lvl.boss || (E.MINIBOSS[G.lvl.bossType] && G.bossCleared);
      if (canFinish && Math.abs(p.cx() - (gx + 12)) < 30 &&
          p.feet() > gy - 60 && p.feet() < gy + 40) {
        finishLevel();
      }
    }

    G.particles.update();
    G.floats.update();
    for (var tk in G.talk) if (G.talk[tk].t > 0) G.talk[tk].t--;
    if (G.dizzy > 0 && !frozen) G.dizzy--;
    updateCamera();
    if (G.banner > 0) G.banner--;
  }

  function finishLevel() {
    var p = G.player;
    p.won = true;
    p.cheer = 200;
    G.frozen = true;
    S.play('win');
    G.particles.burst(p.cx(), p.y, 40,
      { col: '#ffd257', spread: 4, up: 1.6, life: 60, grav: 0.12 });

    var idx = G.lvlIndex, last = (idx >= LV.list.length - 1);
    recordBest(idx);
    if (!last) {
      save.unlocked = Math.max(save.unlocked, idx + 2);
      persist();
      saveRun(idx + 1);
    }

    // Level 24 endet an der Sicherheitskontrolle, Level 28 im Hotel:
    // beides sind Szenen (reise.js), kein Zwischenbildschirm.
    if (G.lvl.szene && global.Reise) {
      var szene = G.lvl.szene;
      G.after(50, function () {
        startDialog(G.lvl.outro, function () {
          fadeTo(function () {
            startScene(szene === 'kontrolle' ? global.Reise.kontrolleInit() : global.Reise.hotelInit());
            S.music(szene === 'kontrolle' ? 'flughafen' : 'istanbul');
          });
        });
      });
      return;
    }

    // Manche Level gehen ohne Zwischenbildschirm weiter: Level 10 endet
    // vor der Haustuer (da steht Broke), Level 12 unten am Berg (Shawarma).
    if (G.lvl.direct && !last) {
      G.after(60, function () {
        startDialog(G.lvl.outro, function () {
          fadeTo(function () {
            G.checkpoint = null;
            loadLevel(idx + 1, false);
            S.music(LV.list[idx + 1].music);
            levelIntro(idx + 1);
          });
        });
      });
      return;
    }

    // Level 14: der reservierte Tisch im Stilbruch. Jetzt wird geraucht.
    if (G.lvl.id === 14) {
      G.after(50, function () {
        fadeTo(function () {
          startScene(global.Shisha.init());
          G.after(30, function () {
            startDialog(LV.shisha.vorher, function () {
              if (G.scene) G.scene.phase = 'rauchen';
              G.state = 'play';
            });
          });
        });
      });
      return;
    }

    // Level 6 endet mit der Siegerehrung — und die eskaliert.
    if (G.lvl.id === 6) {
      G.after(50, function () {
        startDialog(LV.stilbruch, function () {
          fadeTo(function () {
            G.checkpoint = null;
            loadLevel(6, false);
            S.music('bossfinal');
            startDialog(LV.list[6].intro, function () { G.state = 'play'; });
          });
        });
      });
      return;
    }

    G.after(66, function () {
      startDialog(G.lvl.outro, function () {
        G.state = 'clear';
        G.resultTimer = 0;
      });
    });
  }

  /* ================= Bestenliste ================= */

  // Nur Zeichen, die die Pixelschrift kennt. Dieselbe Liste prueft auch
  // der Server (docs/supabase-setup.sql), falls die weltweite Liste aktiv ist.
  var NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789-. ';
  var NAME_MAX = 10;
  var SCORE_KEY = 'balci_scores_v2';
  var SCORE_SALT = 'balci-run-honig-v2';
  var MAX_SCORES = 10;

  /* Die Bestenliste liegt im Browser des Spielers. Ohne Server kann
     niemand sie wirklich absichern — wer will, editiert seinen eigenen
     Speicher. Was hier passiert, ist trotzdem wichtig:
       1. jeder Eintrag wird beim Laden streng geprueft und begrenzt,
          damit kaputte Daten das Spiel nicht abstuerzen lassen,
       2. eine Pruefsumme wirft von Hand veraenderte Eintraege raus. */
  function hashStr(s) {
    var h = 0x811c9dc5;              // FNV-1a
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  function sigFor(e) {
    return hashStr([e.n, e.s, e.h, e.t, e.d].join('|') + SCORE_SALT);
  }

  function cleanName(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).toUpperCase();
    var out = '';
    for (var i = 0; i < s.length && i < 40 && out.length < NAME_MAX; i++) {
      var c = s.charAt(i);
      if (NAME_CHARS.indexOf(c) >= 0) out += c;
    }
    // Wie bisher nur hinten kuerzen — sonst passen die Pruefsummen
    // alter Eintraege nicht mehr und sie verschwinden aus der Liste.
    out = out.replace(/\s+$/, '');
    return out || 'ANONYM';
  }

  function clampInt(v, min, max) {
    var n = Math.floor(Number(v));
    if (!isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function loadScores() {
    var raw = global.Speicher.get(SCORE_KEY);
    if (!raw || typeof raw !== 'string' || raw.length > 20000) return [];
    var list;
    try { list = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(list)) return [];

    var out = [];
    for (var i = 0; i < list.length && out.length < MAX_SCORES; i++) {
      var e = list[i];
      if (!e || typeof e !== 'object') continue;
      var c = {
        n: cleanName(e.n),
        s: clampInt(e.s, 0, 9999999),
        h: clampInt(e.h, 0, 99999),
        t: clampInt(e.t, 0, 359999),
        d: clampInt(e.d, 0, 9999)
      };
      if (typeof e.g !== 'string' || e.g !== sigFor(c)) continue;  // verändert
      out.push(c);
    }
    return out;
  }

  function storeScore(name, score, honey, timeSec, deaths) {
    var c = {
      n: cleanName(name),
      s: clampInt(score, 0, 9999999),
      h: clampInt(honey, 0, 99999),
      t: clampInt(timeSec, 0, 359999),
      d: clampInt(deaths, 0, 9999)
    };
    c.g = sigFor(c);
    var l = loadScores();
    l.push(c);
    l.sort(function (a, b) { return b.s - a.s; });
    l = l.slice(0, MAX_SCORES);
    var withSig = l.map(function (e) {
      var o = { n: e.n, s: e.s, h: e.h, t: e.t, d: e.d };
      o.g = sigFor(o);
      return o;
    });
    global.Speicher.set(SCORE_KEY, JSON.stringify(withSig));
    return l;
  }

  /* ---------- Der laufende Durchgang ----------
     Punkte, Honig, Zeit und Tode zaehlen ueber ALLE Level. Nach jedem
     geschafften Level wird der Stand gespeichert — "WEITER" setzt ihn
     fort, ein Absturz kostet also nicht den Bestenlisten-Eintrag.
     In die Bestenliste kommt nur, wer bei Level 1 angefangen hat;
     sonst koennte man mit Level 7 allein die Zeitwertung gewinnen. */
  function runSig(r) {
    return hashStr(['run', r.from, r.next, r.s, r.h, r.t, r.d, r.e, r.l].join('|') + SCORE_SALT);
  }

  function saveRun(nextIdx) {
    // Nur echte Durchgaenge ab Level 1 merken. Sonst hat ein Nochmal-
    // Spielen ueber die Levelauswahl den gespeicherten Durchgang
    // ueberschrieben — und damit den Bestenlisten-Eintrag gekostet.
    if (!G.run || G.run.from !== 0) return;
    var p = G.player;
    var r = {
      from: G.run.from, next: nextIdx,
      s: clampInt(p.score, 0, 9999999), h: clampInt(p.honey, 0, 99999),
      t: clampInt(G.runTime / 60, 0, 359999), d: clampInt(p.deaths || 0, 0, 9999),
      e: clampInt(p.eatCount || 0, 0, 9999), l: clampInt(p.lives, 0, 99)
    };
    r.g = runSig(r);
    r.a = Math.max(-9999999, Math.min(9999999, Math.round(p.aura || 0)));
    // Schwierigkeitsgrad: nicht in der Pruefsumme (sonst waeren alte
    // Spielstaende ungueltig); "leicht" gilt ohnehin nicht fuer die Liste.
    r.st = G.run.st || 'normal';
    save.run = r;
    persist();
  }

  function validRun(idx) {
    var r = save.run;
    return (r && r.next === idx && r.g === runSig(r)) ? r : null;
  }

  /** In die Bestenliste: nur ganze Durchgaenge ab Level 1, nicht auf Leicht. */
  function fullRun() {
    return !!(G.run && G.run.from === 0 && (BAL.STUFEN[G.run.st || 'normal'] || {}).bestenliste !== false);
  }

  /** Die Liste, die angezeigt wird: weltweit, wenn eingerichtet und
      erreichbar — sonst die aus diesem Browser. Serverdaten werden genauso
      streng geprueft wie lokale: Namen nur aus der Pixelschrift, Zahlen
      begrenzt. Angezeigt wird ohnehin nur ueber die Pixelschrift, nie als
      HTML — eingeschleuster Code kann also nichts ausrichten. */
  function boardList() {
    var on = global.Online;
    var raw = on && on.enabled() ? on.list() : null;
    if (!raw) return { list: loadScores(), global: false };
    var out = [];
    for (var i = 0; i < raw.length && out.length < 100; i++) {
      var e = raw[i];
      if (!e || typeof e !== 'object') continue;
      out.push({
        n: cleanName(e.n), s: clampInt(e.s, 0, 9999999), h: clampInt(e.h, 0, 99999),
        t: clampInt(e.t, 0, 359999), d: clampInt(e.d, 0, 9999)
      });
    }
    return { list: out, global: true };
  }

  function fmtTime(sec) {
    sec = clampInt(sec, 0, 359999);
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }

  /* Die Liste laesst sich nach vier Werten sortieren. */
  var SCORE_CATS = [
    { k: 'PUNKTE', cmp: function (a, b) { return b.s - a.s; },
      val: function (e) { return '' + e.s; } },
    { k: 'HONIG', cmp: function (a, b) { return b.h - a.h; },
      val: function (e) { return 'x' + e.h; } },
    { k: 'ZEIT', cmp: function (a, b) { return a.t - b.t; },
      val: function (e) { return fmtTime(e.t); } },
    { k: 'TODE', cmp: function (a, b) { return a.d - b.d; },
      val: function (e) { return '' + e.d; } }
  ];

  /* ---------- Namenseingabe ----------
     Ein echtes Textfeld statt Buchstaben-Rad: am Handy kommt die normale
     Tastatur, am PC tippt man einfach. Es gibt keinen Zeitdruck — der
     Eintrag passiert erst beim Tippen auf EINTRAGEN (oder Enter).
     Vorher hat ein noch gedrueckter Sprung-Knopf aus dem Dialog den
     Namen sofort abgeschickt. */
  var nameForm = document.getElementById('nameform');
  var nameInput = document.getElementById('nfname');
  var nameOk = document.getElementById('nfok');

  function startNameEntry() {
    G.state = 'nameentry';
    G.nameSent = false;
    G.partialRun = !fullRun();
    G.nameTimer = 0;
    S.play('win');
    if (G.partialRun) return;            // nur ein Hinweis, kein Eintrag
    if (!nameForm) return;               // Testseiten ohne Formular
    global.Input.releaseAll();
    nameInput.value = '';
    nameOk.disabled = true;
    nameForm.hidden = false;
    // kurze Sperre gegen versehentliches Doppeltippen
    setTimeout(function () { nameOk.disabled = false; }, 800);
    if (!G.touch) setTimeout(function () { try { nameInput.focus(); } catch (e) {} }, 60);
    // Steam-Version mit Controller (Steam Deck): Steams Bildschirmtastatur
    var D = global.balciDesktop;
    if (D && D.steam && D.texteingabe && global.Input.padDa()) {
      D.texteingabe('NAME FÜR DIE BESTENLISTE', NAME_MAX).then(function (t) {
        if (t && G.state === 'nameentry' && !G.nameSent) { nameInput.value = t; submitName(t); }
      });
    }
  }

  function submitName(raw) {
    if (G.state !== 'nameentry' || G.nameSent) return;
    G.nameSent = true;
    if (nameForm) { nameForm.hidden = true; try { nameInput.blur(); } catch (e) {} }
    var sec = Math.floor((G.runTime || 0) / 60);
    var name = cleanName(String(raw || '').replace(/^\s+/, ''));
    G.lastName = name;
    G.lastScore = G.player.score;
    G.scoreList = storeScore(name, G.player.score, G.player.honey, sec, G.player.deaths || 0);
    if (global.Online) {
      global.Online.submit({
        n: name, s: clampInt(G.player.score, 0, 9999999), h: clampInt(G.player.honey, 0, 99999),
        t: clampInt(sec, 0, 359999), d: clampInt(G.player.deaths || 0, 0, 9999)
      });
    }
    G.scoreCat = 0;
    S.play('oneUp');
    fadeTo(zumRueckblick);
  }

  if (nameForm) {
    document.getElementById('nfform').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!nameOk.disabled) submitName(nameInput.value);
    });
    // Nur erlaubte Zeichen — was die Pixelschrift nicht kennt, fliegt raus.
    // Erst beim Verlassen des Felds: waehrend des Tippens umschreiben
    // bringt manche Android-Tastaturen durcheinander.
    // Am Handy schiebt sich die Tastatur von unten rein: waehrend des
    // Tippens rutscht das Feld deshalb nach oben (siehe style.css).
    nameInput.addEventListener('focus', function () { nameForm.classList.add('typing'); });
    nameInput.addEventListener('blur', function () { nameForm.classList.remove('typing'); });
    nameInput.addEventListener('blur', function () {
      var v = nameInput.value.toUpperCase(), out = '';
      for (var i = 0; i < v.length && out.length < NAME_MAX; i++) {
        if (NAME_CHARS.indexOf(v.charAt(i)) >= 0) out += v.charAt(i);
      }
      if (out !== nameInput.value) nameInput.value = out;
    });
  }

  /** Nach dem Durchgang: YUSUF WRAPPED (spass.js), danach der Abspann —
      alle im Stilbruch (finale.js). */
  function zumRueckblick() {
    var abspann = function () { G.state = 'ending'; G.endScroll = 0; S.music('abspann'); };
    if (global.Spass) global.Spass.wrappedStart(G, function () { fadeTo(abspann); });
    else abspann();
  }

  function updateNameEntry() {
    var go = global.Input.hit('jump') || global.Input.hit('confirm');
    G.nameTimer++;
    // Nicht ab Level 1 gespielt: nur Hinweis, dann weiter zum Rueckblick
    if (G.partialRun) {
      if (go && G.nameTimer > 45 && !G.nameSent) {
        G.nameSent = true;
        fadeTo(zumRueckblick);
      }
      return;
    }
    // Ohne Formular (Testseiten): Sprung traegt einen Standardnamen ein
    if (!nameForm && go) submitName('YUSUF');
    // Nur mit Controller (Steam Deck, Gamepad am PC): A traegt ein, was im
    // Feld steht — oder YUSUF. Vorher kam man ohne Tastatur hier nicht weiter.
    var In = global.Input;
    if (nameForm && go && G.nameTimer > 45 && In.padDown &&
        (In.padDown('confirm') || In.padDown('jump'))) {
      submitName(nameInput.value || 'YUSUF');
    }
  }

  function updateScores() {
    var In = global.Input;
    if (global.Online && G.tick % 300 === 0) global.Online.refresh();
    var tp = In.tap();
    if (tp) {
      // Kategorie antippen = sortieren, sonst zurueck
      if (tp.y >= 38 && tp.y < 60) {
        var cx0 = 60;
        for (var c = 0; c < SCORE_CATS.length; c++) {
          var lw = F.measure(SCORE_CATS[c].k, 1, 1);
          if (tp.x >= cx0 - 12 && tp.x < cx0 + lw + 12) { G.scoreCat = c; S.play('move'); return; }
          cx0 += lw + 26;
        }
      }
      G.state = 'title'; S.play('select');
      return;
    }
    if (In.hit('right')) { G.scoreCat = (G.scoreCat + 1) % SCORE_CATS.length; S.play('move'); }
    if (In.hit('left')) {
      G.scoreCat = (G.scoreCat + SCORE_CATS.length - 1) % SCORE_CATS.length;
      S.play('move');
    }
    if (In.hit('back') || In.hit('pause') || In.hit('jump') || In.hit('confirm')) {
      G.state = 'title'; S.play('select');
    }
  }

  function updateClear() {
    G.resultTimer++;
    G.particles.update();
    if (G.resultTimer > 40 && (global.Input.hit('jump') || global.Input.hit('confirm'))) {
      S.play('select');
      var next = G.lvlIndex + 1;
      if (next >= LV.list.length) {
        fadeTo(function () { G.state = 'title'; S.music('menu'); });
      } else {
        fadeTo(function () {
          G.checkpoint = null;
          loadLevel(next, false);
          S.music(LV.list[next].music);
          levelIntro(next);
        });
      }
    }
  }

  function updateEnding() {
    G.endScroll += 0.6;
    G.particles.update();
    if (G.tick % 12 === 0) {
      G.particles.spawn({
        x: Math.random() * W, y: H + 6,
        vx: (Math.random() - 0.5) * 0.4, vy: -0.7 - Math.random() * 0.5,
        life: 260, col: '#ffc23c', size: 2, grav: -0.002
      });
    }
    // Nach dem Abspann (oder wer nicht warten will): die Bestenliste
    var ende = abspannEnde();
    var weiter = (G.endScroll > 150 && (global.Input.hit('jump') || global.Input.hit('confirm'))) ||
                 G.endScroll > ende + 240;
    if (weiter && !G.fadeDir) {
      fadeTo(function () { G.state = 'scores'; S.music('menu'); });
    }
  }
  function abspannEnde() { return global.Finale ? global.Finale.abspannLaenge() + H : 620; }

  function updateCamera() {
    var p = G.player, cam = G.cam;
    var tx = p.cx() - W / 2 + p.facing * 26;
    var ty = p.y + p.h / 2 - H / 2 - 10;
    // Zwischensequenz: die Kamera schaut woanders hin (Lennart)
    if (G.camFocus) {
      tx = G.camFocus.x - W / 2;
      ty = G.camFocus.y - H / 2 - 10;
    }

    cam.x += (tx - cam.x) * 0.11;
    cam.y += (ty - cam.y) * 0.09;

    var maxX = Math.max(0, G.lvl.w * T - W);
    var maxY = Math.max(0, G.lvl.h * T - H + BOTTOM_PAD);

    if (G.arena && G.bossStarted) {
      cam.x = Math.max(G.arena.x, Math.min(G.arena.x + G.arena.w - W, cam.x));
    } else {
      cam.x = Math.max(0, Math.min(maxX, cam.x));
    }
    cam.y = Math.max(0, Math.min(maxY, cam.y));

    if (cam.shake > 0) {
      cam.shake--;
      var a = cam.shakeAmp * (cam.shake / 20);
      cam.sx = (Math.random() - 0.5) * a * 2;
      cam.sy = (Math.random() - 0.5) * a * 2;
      if (cam.shake === 0) { cam.shakeAmp = 0; cam.sx = 0; cam.sy = 0; }
    } else { cam.sx = 0; cam.sy = 0; }
  }

  /* ================= Rendering ================= */

  function render() {
    applyView();
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (G.state === 'title') { drawTitle(); }
    else if (G.state === 'select') { drawSelect(); }
    else if (G.state === 'howto') { drawHowto(); }
    else if (G.state === 'ending') { drawEnding(); }
    else if (G.state === 'nameentry') { drawNameEntry(); }
    else if (G.state === 'wrapped') { global.Spass.wrappedDraw(ctx, G, W, H); }
    else if (G.state === 'trophaeen') { global.Spass.trophDraw(ctx, G, W, H); }
    else if (G.state === 'optionen') {
      // Aus der Pause: das Spiel bleibt dahinter stehen
      if (G.optZurueck === 'paused') drawDrunkOrPlain(); else drawTitle();
      global.Optionen.draw(ctx, G, W, H);
    }
    else if (G.state === 'scores') { drawScores(); }
    else {
      drawDrunkOrPlain();
      if (G.flashFx && G.flashFx.t > 0) {
        ctx.globalAlpha = 0.5 * G.flashFx.t / G.flashFx.max;
        ctx.fillStyle = G.flashFx.col;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      // Semih: Sepia, zerspringendes Bild, Anzeige der Kraftprobe
      if (global.SemihKampf) global.SemihKampf.overlay(ctx, G, W, H);
      var eigen = G.modus && G.modMod.full;
      if (!G.eat && !G.kasse && !G.scene && !G.cut && !eigen) drawHUD();
      if (G.modus && !eigen && G.modMod.hud && !G.scene) G.modMod.hud(ctx, G, W, H);
      if (G.state === 'paused') drawPause();
      if (G.state === 'clear') drawResults();
      if (G.state === 'dialog') drawDialog();
    }

    // Trophaeen, Rang, "so knapp": immer ganz oben
    if (global.Spass) global.Spass.drawOben(ctx, G, W, H);

    if (G.muteFlash > 0) {
      F.draw(ctx, G.muteState ? 'TON AUS' : 'TON AN', W - 8, 8,
             { color: '#ffd257', align: 'right', shadow: true });
    }

    if (G.fade > 0) {
      ctx.fillStyle = 'rgba(8,5,12,' + G.fade + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /* ---------- Hintergrund ---------- */

  /** So weit kann die Kamera nach unten (der Boden des Levels). */
  function maxCamY() { return G.lvl ? Math.max(0, G.lvl.h * T - H + BOTTOM_PAD) : 0; }

  /** Himmel und Hintergrund zeichnen (malen = die eigentlichen Ebenen).
      Bei voller Grafik in Spiel-Aufloesung und weich vergroessert: der
      Hintergrund ist unscharf wie hinter einer Kamera-Linse, das Spielfeld
      davor gestochen scharf. Faehrt die Kamera hoch, wandert er langsamer
      mit als die Welt (Parallaxe auch nach oben). */
  function hintergrund(theme, camX, camY, maxY, malen) {
    var dy = Math.round(Math.min(40, Math.max(0, (maxY - camY) * 0.14)) * RS) / RS;
    var weich = LI && LI.stufe() >= 2 && RS > 1;
    if (weich) {
      var bg = LI.puffer('hintergrund', W, H), haupt = ctx;
      ctx = bg.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = false;
      try { malen(); } finally { ctx = haupt; }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bg, 0, dy, W, H);
      if (dy > 0) ctx.drawImage(bg, 0, 0, W, 1, 0, 0, W, dy + 0.5);
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.save();
      ctx.translate(0, dy);
      malen();
      ctx.restore();
      var t = SP.THEMES[theme];
      if (dy > 0 && t) rect(0, 0, W, dy + 1, t.sky[0]);
    }
  }

  /** Lichtschein im Hintergrund (Laternen, Mond, Neon, Flutlicht). */
  function bgLicht(x, y, r, col, a) { if (LI && LI.stufe() >= 1) LI.glow(ctx, x, y, r, col, a); }
  function bgKegel(x1, y1, w1, x2, y2, w2, col, a) { if (LI && LI.stufe() >= 1) LI.kegel(ctx, x1, y1, w1, x2, y2, w2, col, a); }

  function drawSky(theme) {
    var t = SP.THEMES[theme];
    var grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, t.sky[0]);
    grd.addColorStop(0.42, t.sky[1]);
    grd.addColorStop(0.75, t.sky[2]);
    grd.addColorStop(1, t.sky[3]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  function rect(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawParallax(theme, camX, camY) {
    // Semihs Dimensionen stehen in semih.js
    if (global.SemihKampf && global.SemihKampf.hintergrund(ctx, theme, camX, G, W, H)) return;
    // Flughafen, Gate, Kabine und Istanbul stehen in reise.js
    if (global.Reise && global.Reise.hintergrund(ctx, theme, camX, G, W, H)) return;
    var t = SP.THEMES[theme];
    var f = camX * 0.22, n = camX * 0.46;
    var i, x;

    if (theme === 'zimmer') {
      // Mond + Dächer bei Sonnenaufgang
      ctx.fillStyle = '#fff0c0';
      ctx.beginPath(); ctx.arc(446 - f * 0.06, 54, 17, 0, 6.3); ctx.fill();
      ctx.fillStyle = SP.THEMES.zimmer.sky[1];
      ctx.beginPath(); ctx.arc(440 - f * 0.06, 49, 15, 0, 6.3); ctx.fill();
      bgLicht(446 - f * 0.06, 54, 70, '#ffe0b0', 0.3);
      bgLicht(W * 0.62 - f * 0.03, 236, 230, '#f0a05c', 0.28);   // die Sonne kommt gleich
      for (i = -1; i < 14; i++) {
        x = i * 112 - (f % 112);
        rect(x, 150, 74, 140, t.far);
        rect(x + 12, 138, 16, 14, t.far);
        rect(x + 80, 168, 52, 122, t.far);
        rect(x + 20, 128, 2, 12, t.far);
      }
      for (i = -1; i < 12; i++) {
        x = i * 146 - (n % 146);
        rect(x, 196, 96, 94, t.near);
        rect(x + 30, 182, 14, 16, t.near);
        rect(x + 104, 210, 60, 80, t.near);
      }
    } else if (theme === 'markt') {
      // Neonroehren an der Decke
      for (i = -1; i < 14; i++) {
        x = i * 96 - (f % 96);
        rect(x + 16, 0, 60, 5, '#ffffff');
        rect(x + 22, 5, 48, 3, 'rgba(255,255,255,0.4)');
        bgLicht(x + 46, 4, 36, '#f4fbff', 0.22);
      }
      // Regalreihen hinter dem Spielfeld, voll mit bunten Packungen
      var PROD = ['#e0483c', '#ffd257', '#4aa832', '#5c7fd8', '#ff8a2a',
                  '#f08aa8', '#a8e0f0', '#b07a3a'];
      for (i = -1; i < 10; i++) {
        x = i * 150 - (n % 150);
        rect(x, 118, 128, 130, t.far);
        rect(x, 118, 128, 3, '#9aa0ac');
        for (var sr = 0; sr < 4; sr++) {
          var sy2 = 126 + sr * 28;
          rect(x + 4, sy2 + 20, 120, 3, '#8a8e98');
          for (var sc = 0; sc < 7; sc++) {
            rect(x + 8 + sc * 17, sy2, 13, 19, PROD[(i + sr * 3 + sc) % PROD.length]);
            rect(x + 8 + sc * 17, sy2, 13, 4, 'rgba(255,255,255,0.35)');
          }
        }
      }
    } else if (theme === 'garten') {
      ctx.fillStyle = '#fff6b0';
      ctx.beginPath(); ctx.arc(76, 46, 22, 0, 6.3); ctx.fill();
      bgLicht(76, 46, 110, '#fff6b0', 0.3);
      for (i = -1; i < 10; i++) {
        x = i * 150 - (f % 150);
        ctx.fillStyle = t.far;
        ctx.beginPath(); ctx.arc(x + 60, 244, 96, Math.PI, 0); ctx.fill();
      }
      for (i = -1; i < 14; i++) {
        x = i * 104 - (n % 104);
        rect(x + 28, 200, 8, 70, '#5a3a20');
        ctx.fillStyle = t.near;
        ctx.beginPath(); ctx.arc(x + 32, 194, 26, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 16, 206, 18, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 48, 206, 18, 0, 6.3); ctx.fill();
      }
      for (i = -1; i < 5; i++) {
        x = i * 320 - (camX * 0.6 % 320);
        P.draw(ctx, 'bienenstock', x + 60, 214);
      }
    } else if (theme === 'gym') {
      for (i = -1; i < 16; i++) {
        x = i * 96 - (f % 96);
        rect(x, 0, 90, H, t.far);
        rect(x + 6, 30, 78, 3, '#2a2140');
      }
      for (i = -1; i < 9; i++) {
        x = i * 180 - (n % 180);
        rect(x + 16, 96, 60, 84, t.near);
        rect(x + 20, 100, 52, 60, '#1b1626');
        F.draw(ctx, 'NO', x + 46, 108, { color: '#ff6fa8', align: 'center' });
        F.draw(ctx, 'PAIN', x + 46, 120, { color: '#ff6fa8', align: 'center' });
        F.draw(ctx, 'NO', x + 46, 132, { color: '#ff6fa8', align: 'center' });
        F.draw(ctx, 'GAIN', x + 46, 144, { color: '#ff6fa8', align: 'center' });
        bgLicht(x + 46, 128, 48, '#ff6fa8', 0.22);
        P.draw(ctx, 'hantel', x + 110, 150);
      }
    } else if (theme === 'kueche') {
      for (i = -1; i < 20; i++) {
        for (var j = 0; j < 6; j++) {
          x = i * 48 - (f % 48);
          rect(x + 1, j * 48 + 1, 46, 46, t.far);
        }
      }
      for (i = -1; i < 8; i++) {
        x = i * 200 - (n % 200);
        rect(x, 40, 120, 56, t.near);
        rect(x + 4, 44, 52, 48, '#2a2230');
        rect(x + 62, 44, 54, 48, '#2a2230');
        rect(x + 140, 74, 44, 26, t.near);
        rect(x + 146, 66, 32, 8, '#6a6270');
      }
      // Iranische Flagge — Yusufs Lieblingskueche haengt an der Wand
      for (i = -1; i < 5; i++) {
        x = i * 380 - (n % 380) + 190;
        var fw = 52, fh = 30, fy = 108;
        rect(x - 3, fy - 6, 3, fh + 16, '#6a6270');      // Stange
        var wave = Math.sin(G.tick * 0.05 + i) * 2;
        rect(x, fy + wave, fw, fh / 3, '#2a9c4a');       // gruen
        rect(x, fy + fh / 3 + wave, fw, fh / 3, '#f2f2ec'); // weiss
        rect(x, fy + 2 * fh / 3 + wave, fw, fh / 3, '#d8342e'); // rot
        rect(x + fw / 2 - 4, fy + fh / 3 + 3 + wave, 8, 4, '#d8342e');
      }
    } else if (theme === 'strasse') {
      // Naechtliche Stadt, Neon, Strassenlaternen
      ctx.fillStyle = '#f4e8a0';
      ctx.beginPath(); ctx.arc(92, 44, 14, 0, 6.3); ctx.fill();
      bgLicht(92, 44, 64, '#f4e8a0', 0.3);
      for (i = -1; i < 16; i++) {
        x = i * 88 - (f % 88);
        var bh2 = 60 + ((i * 37) % 5) * 26;
        rect(x, H - 88 - bh2, 70, bh2 + 88, t.far);
        for (var wy = 0; wy < bh2; wy += 16) {
          for (var wx = 0; wx < 60; wx += 14) {
            if (((i * 7 + wy + wx) % 5) < 2) {
              rect(x + 6 + wx, H - 84 - bh2 + wy, 7, 8, '#ffd88a');
            }
          }
        }
      }
      for (i = -1; i < 11; i++) {
        x = i * 128 - (n % 128);
        rect(x, 150, 4, 140, '#12141c');         // Laternenmast
        rect(x - 8, 146, 20, 5, '#12141c');
        rect(x - 6, 151, 16, 3, '#ffe9a8');      // Licht
        bgKegel(x + 2, 154, 14, x + 2, 290, 84, '#ffe9a8', 0.13);
        bgLicht(x + 2, 152, 26, '#ffe9a8', 0.55);
      }
    } else if (theme === 'siedlung' || theme === 'siedlung_nacht') {
      // Nachmittagssonne (bzw. Mond) ueber einer Reihe Einfamilienhaeuser
      var nachtS = theme === 'siedlung_nacht';
      ctx.fillStyle = nachtS ? '#f4e8a0' : '#fff2c0';
      ctx.beginPath(); ctx.arc(420 - f * 0.05, 58, nachtS ? 16 : 20, 0, 6.3); ctx.fill();
      bgLicht(420 - f * 0.05, 58, nachtS ? 64 : 100, nachtS ? '#f4e8a0' : '#fff2c0', nachtS ? 0.3 : 0.3);
      if (nachtS) {
        for (i = 0; i < 40; i++) rect((i * 97 + 13) % W, (i * 53) % 150, 1, 1, i % 4 ? '#c8b8e0' : '#ffe9a8');
      }
      for (i = -1; i < 12; i++) {
        x = i * 124 - (f % 124);
        var hh = 64 + ((i + 12) % 3) * 16;
        rect(x + 12, 250 - hh, 92, hh + 40, t.far);
        ctx.fillStyle = t.far;
        ctx.beginPath();
        ctx.moveTo(x + 2, 251 - hh); ctx.lineTo(x + 58, 216 - hh); ctx.lineTo(x + 114, 251 - hh);
        ctx.closePath(); ctx.fill();
        for (var wi = 0; wi < 3; wi++) {
          // Nachts: manche Fenster hell, manche dunkel
          var hell = !nachtS || ((i * 3 + wi * 5 + 12) % 4) < 2;
          rect(x + 24 + wi * 26, 262 - hh, 12, 12, nachtS ? (hell ? '#ffd88a' : '#161a2c') : '#b8c8e0');
        }
      }
      for (i = -1; i < 14; i++) {
        x = i * 104 - (n % 104);
        rect(x, 214, 70, 30, nachtS ? '#23402a' : '#4f7e3e');   // Hecke
        rect(x, 214, 70, 4, nachtS ? '#2e5436' : '#6aa04e');
        rect(x + 84, 186, 6, 60, nachtS ? '#2a1c12' : '#5a3a20');  // Baum
        if (nachtS) {                                            // Laterne
          rect(x + 40, 168, 3, 50, '#12141c');
          rect(x + 34, 164, 15, 4, '#12141c');
          rect(x + 36, 168, 11, 2, '#ffe9a8');
          bgKegel(x + 41, 170, 10, x + 41, 248, 62, '#ffe9a8', 0.12);
          bgLicht(x + 41, 169, 22, '#ffe9a8', 0.55);
        }
        ctx.fillStyle = nachtS ? '#1f3a24' : '#3f6e34';
        ctx.beginPath(); ctx.arc(x + 87, 180, 20, 0, 6.3); ctx.fill();
      }
    } else if (theme === 'imbiss') {
      // Hamzas Laden: Fliesen, Karten mit Preisen, drehende Spiesse
      for (i = -1; i < 26; i++) {
        x = i * 32 - (f % 32);
        rect(x, 0, 1, H, 'rgba(255,220,180,0.05)');
      }
      for (i = -1; i < 8; i++) {
        x = i * 220 - (n % 220);
        rect(x + 20, 60, 44, 150, '#2a1a12');           // Grill-Nische
        rect(x + 24, 64, 36, 142, '#ff6a1a');
        rect(x + 28, 68, 28, 134, '#ffb43c');
        for (var sy = 0; sy < 110; sy += 3) {            // der Spiess dreht sich
          var sw = 24 - Math.abs(sy - 40) * 0.14;
          var so = ((sy * 3 + G.tick) >> 2) % 4;
          rect(x + 42 - sw / 2, 76 + sy, sw, 3, so < 2 ? '#b8643a' : '#8a4424');
        }
        rect(x + 41, 66, 2, 130, '#c8ccd6');
        bgLicht(x + 42, 135, 64, '#ff8a2a', 0.3);
        rect(x + 90, 70, 96, 50, '#1a1210');            // Karte
        F.draw(ctx, 'SHAWARMA', x + 98, 78, { color: '#ffd257' });
        F.draw(ctx, 'FALAFEL', x + 98, 92, { color: '#ffe9a8' });
        F.draw(ctx, 'HUMMUS', x + 98, 106, { color: '#ffe9a8' });
      }
      for (i = -1; i < 5; i++) {
        x = i * 380 - (n % 380) + 200;
        rect(x, 140, 50, 8, '#d8282e'); rect(x, 148, 50, 14, '#f4f2ec'); rect(x, 162, 50, 8, '#d8282e');
        ctx.fillStyle = '#2a9a4a';
        ctx.beginPath(); ctx.moveTo(x + 25, 148); ctx.lineTo(x + 16, 160); ctx.lineTo(x + 34, 160);
        ctx.closePath(); ctx.fill();
      }
    } else if (theme === 'bar') {
      // Stilbruch von innen: Neon, Rauch, Shisha-Silhouetten
      for (i = -1; i < 10; i++) {
        x = i * 170 - (f % 170);
        var pulse2 = ((G.tick + i * 40) % 140) < 5 ? '#ffd8f0' : '#ff8ad8';
        F.draw(ctx, i % 2 ? 'SHISHA' : 'STILBRUCH', x + 60, 40, { color: pulse2, align: 'center', scale: 2 });
        bgLicht(x + 60, 46, 60, pulse2, 0.26);
        rect(x + 10, 36, 100, 1, 'rgba(255,138,216,0.3)');
      }
      for (i = -1; i < 14; i++) {
        x = i * 110 - (n % 110);
        rect(x + 14, 150, 8, 70, t.far);                // Shisha-Schlauch-Stange
        rect(x + 6, 214, 24, 26, t.far);                 // Glas
        rect(x + 40, 196, 60, 44, t.near);               // Sofa
        rect(x + 40, 190, 60, 8, t.far);
      }
      ctx.fillStyle = 'rgba(200,190,230,0.05)';
      for (i = 0; i < 6; i++) {
        var rx2 = ((i * 97 + G.tick * 0.3) % (W + 100)) - 50;
        ctx.beginPath(); ctx.arc(rx2, 110 + (i % 3) * 30, 40, 0, 6.3); ctx.fill();
      }
    } else if (theme === 'taverne') {
      // Weisse Waende, blaue Fenster mit Meerblick, Maeanderband
      for (i = -1; i < 40; i++) {
        x = i * 16 - (f % 16);
        rect(x, 26, 12, 3, t.near);
        rect(x + 9, 26, 3, 9, t.near);
        rect(x + 3, 32, 9, 3, t.near);
      }
      for (i = -1; i < 9; i++) {
        x = i * 180 - (n % 180);
        rect(x + 30, 70, 64, 80, t.near);                // Fensterrahmen
        rect(x + 34, 74, 56, 72, '#6ab0e8');             // Himmel
        rect(x + 34, 118, 56, 28, '#2a6ab8');            // Meer
        rect(x + 60, 74, 4, 72, t.near);
        bgLicht(x + 62, 104, 54, '#eaf6ff', 0.2);
        rect(x + 120, 170, 18, 40, '#c87a4a');           // Amphore
        rect(x + 116, 176, 26, 26, '#b8683a');
        rect(x + 124, 164, 10, 8, '#c87a4a');
      }
      for (i = -1; i < 5; i++) {
        x = i * 360 - (n % 360) + 150;
        for (var gs = 0; gs < 9; gs++) rect(x, 60 + gs * 4, 54, 4, gs % 2 ? '#f4f6fa' : '#2a5ab8');
        rect(x, 60, 20, 20, '#2a5ab8'); rect(x + 8, 60, 4, 20, '#f4f6fa'); rect(x, 68, 20, 4, '#f4f6fa');
      }
    } else if (theme === 'stadion') {
      // Tribuene mit Publikum, Flutlichtmasten, Werbebanden
      for (i = -1; i < 8; i++) {
        x = i * 220 - (f % 220);
        rect(x + 100, 30, 6, 140, '#8a8e98');
        rect(x + 86, 24, 34, 12, '#c8ccd4');
        for (var fl = 0; fl < 4; fl++) rect(x + 89 + fl * 8, 27, 5, 6, '#fff8d8');
        bgKegel(x + 103, 36, 30, x + 70, 290, 230, '#fff8d8', 0.05);
        bgLicht(x + 103, 30, 46, '#fff8d8', 0.4);
      }
      for (i = -1; i < 10; i++) {
        x = i * 160 - (n * 0.6 % 160);
        rect(x, 120, 160, 110, t.far);
        for (var rr = 0; rr < 6; rr++) {
          rect(x, 124 + rr * 17, 160, 2, t.near);
          for (var zu = 0; zu < 18; zu++) {
            var hopp = ((G.tick >> 4) + zu + rr + i) % 7 === 0 ? -2 : 0;
            rect(x + 4 + zu * 9, 128 + rr * 17 + hopp, 5, 6,
                 ['#e05a4a', '#ffd257', '#6fc8e8', '#f4f4ee', '#8cd85a', '#c8a0e8'][(zu * 7 + rr * 3 + i) % 6]);
          }
        }
      }
      var BANDE = ['DÖNER', 'HONIG', 'STILBRUCH', 'GYM? NEIN', 'KOOBIDEH'];
      for (i = -1; i < 9; i++) {
        x = i * 120 - (n % 120);
        rect(x, 214, 116, 20, '#1a2a4a');
        rect(x, 214, 116, 2, '#ffffff');
        F.draw(ctx, BANDE[((i % 5) + 5) % 5], x + 58, 220, { color: '#ffd257', align: 'center' });
      }
    } else if (theme === 'knast') {
      // Zellenreihen mit Gittern, dahinter Insassen; ein Suchscheinwerfer
      for (i = -1; i < 12; i++) {
        x = i * 96 - (f % 96);
        rect(x, 40, 90, 70, t.far);
        rect(x + 6, 48, 78, 56, '#141418');
        var wer = (i + 40) % 4;
        if (wer !== 3) {
          var wink = ((G.tick >> 5) + i) % 3 === 0 ? -3 : 0;
          rect(x + 30, 70, 14, 20, '#f07a28');
          rect(x + 32, 60 + (wer === 1 ? wink : 0), 10, 10, '#e8b48c');
          if (wer === 1) rect(x + 44, 64 + wink, 4, 10, '#e8b48c');
          if (wer === 2) rect(x + 50, 86, 16, 3, '#f4f4ee');
        }
        for (var gi = 0; gi < 8; gi++) rect(x + 10 + gi * 10, 48, 2, 56, '#8a8e98');
      }
      for (i = -1; i < 9; i++) {
        x = i * 150 - (n % 150);
        rect(x, 130, 140, 100, t.near);
        rect(x, 130, 140, 4, '#5a5e68');
        F.draw(ctx, 'BLOCK ' + String.fromCharCode(65 + ((i % 6) + 6) % 6), x + 70, 140, { color: '#f07a28', align: 'center' });
      }
      bgLicht(W / 2, 0, 44, '#fff8d8', 0.4);
      var sw = Math.sin(G.tick * 0.012) * 180 + W / 2;
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fff8d8';
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(sw - 60, 290); ctx.lineTo(sw + 60, 290); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (theme === 'berg') {
      // Morgens am Hausberg: ferne Gipfel mit Schnee, davor Tannen
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath(); ctx.arc(86, 48, 18, 0, 6.3); ctx.fill();
      bgLicht(86, 48, 100, '#fff6c8', 0.3);
      for (i = -1; i < 9; i++) {
        x = i * 190 - (f * 0.6 % 190);
        var peak = 70 + ((i + 10) % 2) * 34;
        ctx.fillStyle = t.far;
        ctx.beginPath();
        ctx.moveTo(x - 20, 290); ctx.lineTo(x + 95, peak); ctx.lineTo(x + 210, 290);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#eef4fa';
        ctx.beginPath();
        ctx.moveTo(x + 95, peak); ctx.lineTo(x + 77, peak + 18); ctx.lineTo(x + 86, peak + 14);
        ctx.lineTo(x + 95, peak + 20); ctx.lineTo(x + 104, peak + 14); ctx.lineTo(x + 113, peak + 18);
        ctx.closePath(); ctx.fill();
      }
      for (i = -1; i < 16; i++) {
        x = i * 64 - (n % 64);
        var th = 46 + ((i + 16) % 3) * 12;
        rect(x + 14, 250 - 12, 5, 16, '#4a3220');
        for (var tl = 0; tl < 3; tl++) {
          var ty = 240 - th + tl * (th / 3.2), tw = 12 + tl * 6;
          ctx.fillStyle = tl % 2 ? '#245a30' : t.near;
          ctx.beginPath();
          ctx.moveTo(x + 16 - tw, ty + th / 3); ctx.lineTo(x + 16, ty - 4); ctx.lineTo(x + 17 + tw, ty + th / 3);
          ctx.closePath(); ctx.fill();
        }
      }
    } else if (theme === 'wald') {
      // Der Airsoft-Platz im Wald: hinten Tannen, Licht faellt durch die
      // Kronen, vorne Staemme mit Tarnnetzen, Reifenstapeln und Fahnen.
      for (i = -1; i < 16; i++) {
        x = i * 44 - (f * 0.6 % 44);
        var th2 = 76 + ((i * 7 + 32) % 4) * 16;
        ctx.fillStyle = t.far;
        ctx.beginPath(); ctx.moveTo(x - 6, 262); ctx.lineTo(x + 22, 262 - th2); ctx.lineTo(x + 50, 262);
        ctx.closePath(); ctx.fill();
      }
      rect(0, 250, W, 40, t.far);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fff6c8';
      for (i = 0; i < 4; i++) {
        var lx = ((i * 170 - f * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 40, 0); ctx.lineTo(lx + 120, 290); ctx.lineTo(lx + 60, 290);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (i = -1; i < 10; i++) {
        x = i * 150 - (n % 150);
        var deko = ((i % 4) + 4 + Math.floor(camX / 600)) % 4;
        rect(x + 24, 40, 12, 250, '#4a3222');
        rect(x + 24, 40, 3, 250, '#5e4230');
        ctx.fillStyle = t.near;
        ctx.beginPath(); ctx.arc(x + 30, 36, 34, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, 50, 22, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 56, 52, 24, 0, 6.3); ctx.fill();
        if (deko === 0) {
          // Tarnnetz zwischen zwei Baeumen, an einem Seil
          rect(x + 36, 146, 110, 1, '#3a2a1a');
          for (var ny = 0; ny < 5; ny++) {
            for (var nx = 0; nx < 8; nx++) {
              rect(x + 38 + nx * 12 + (ny % 2) * 6, 150 + ny * 10 + Math.sin(G.tick * 0.03 + nx) * 1, 8, 6,
                   ['#4e5a36', '#6a6e44', '#3e4a2a'][(nx + ny) % 3]);
            }
          }
        } else if (deko === 1) {
          // Reifenstapel (Deckung auf jedem Airsoft-Platz)
          for (var ri = 0; ri < 4; ri++) {
            var ry = 232 - ri * 9;
            rect(x + 62, ry, 30, 9, '#1c1c20');
            rect(x + 60, ry + 2, 34, 5, '#1c1c20');
            rect(x + 66, ry + 3, 22, 3, '#34343c');
            rect(x + 62, ry, 30, 1, '#4a4a54');
          }
        } else if (deko === 2) {
          // Team-Fahne: Tuerkei (Team Sonnet)
          rect(x + 80, 130, 3, 110, '#6a6a74');
          var fwv = Math.sin(G.tick * 0.06 + i) * 2;
          rect(x + 83, 132 + fwv, 36, 22, '#d8282e');
          ctx.fillStyle = '#f4f2ec';
          ctx.beginPath(); ctx.arc(x + 96, 143 + fwv, 7, 0, 6.3); ctx.fill();
          ctx.fillStyle = '#d8282e';
          ctx.beginPath(); ctx.arc(x + 98.5, 143 + fwv, 5.5, 0, 6.3); ctx.fill();
          rect(x + 104, 141 + fwv, 3, 3, '#f4f2ec');
        } else {
          // Holzschild
          rect(x + 76, 196, 4, 44, '#5a3a20');
          rect(x + 60, 184, 38, 16, '#8a5a30');
          F.draw(ctx, 'AIRSOFT', x + 79, 189, { color: '#ffe9a8', align: 'center' });
        }
      }
    } else {
      // Festung: Türme, Blitze, Salatbanner
      for (i = -1; i < 10; i++) {
        x = i * 160 - (f % 160);
        rect(x + 20, 80, 46, 210, t.far);
        rect(x + 14, 68, 58, 14, t.far);
        rect(x + 100, 120, 34, 170, t.far);
      }
      for (i = -1; i < 8; i++) {
        x = i * 210 - (n % 210);
        rect(x + 40, 150, 54, 140, t.near);
        rect(x + 48, 162, 38, 60, '#4f7a33');
        rect(x + 52, 170, 30, 8, '#9dff6a');
        rect(x + 52, 186, 30, 8, '#9dff6a');
        bgLicht(x + 67, 182, 34, '#9dff6a', 0.24);
      }
      if ((G.tick % 190) < 5) {
        ctx.fillStyle = 'rgba(200,255,180,0.14)';
        ctx.fillRect(0, 0, W, H);
      }
    }

    // Wolken in hellen Welten
    if (theme === 'garten' || theme === 'zimmer' || theme === 'siedlung' || theme === 'berg' || theme === 'wald') {
      for (i = -1; i < 8; i++) {
        x = i * 220 - ((camX * 0.12 + G.tick * 0.12) % 220);
        P.draw(ctx, 'wolke', x, 26 + (i % 3) * 26);
      }
    }
  }

  /* ---------- Welt ---------- */

  function drawTiles(camX, camY) {
    var w = G.world, theme = w.theme;
    var topSpr = SP.tileTop(theme), fillSpr = SP.tileFill(theme), deepSpr = SP.tileDeep(theme);
    var tx0 = Math.max(0, Math.floor(camX / T) - 1);
    var tx1 = Math.min(w.w - 1, Math.floor((camX + W) / T) + 1);
    var ty0 = Math.max(0, Math.floor(camY / T) - 1);
    var ty1 = Math.min(w.h - 1, Math.floor((camY + H) / T) + 1);

    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        if (!w.solid(tx, ty)) continue;
        if (w.blockAt(tx, ty)) continue;            // Blöcke zeichnen sich selbst
        var px = tx * T - camX, py = ty * T - camY;
        if (!w.solid(tx, ty - 1)) P.draw(ctx, topSpr, px, py);
        else if (!w.solid(tx, ty - 3)) P.draw(ctx, fillSpr, px, py);
        else P.draw(ctx, deepSpr, px, py);
      }
    }

    // Handy: eine Reihe Erde unter dem Level, damit die Knoepfe auf dem
    // Boden liegen und nicht im Spielfeld. Unter Gruben bleibt es dunkel.
    if (BOTTOM_PAD > 0 && camY + H > w.h * T) {
      for (var ex = tx0; ex <= tx1; ex++) {
        var hole = (ex < 0 || ex >= w.w || !w.solid(ex, w.h - 1));
        for (var ey = w.h; ey * T < camY + H; ey++) {
          if (hole) rect(ex * T - camX, ey * T - camY, T, T, '#07050b');
          else P.draw(ctx, deepSpr, ex * T - camX, ey * T - camY);
        }
      }
    }
  }

  function drawHazards(camX, camY) {
    for (var i = 0; i < G.world.hazards.length; i++) {
      var h = G.world.hazards[i];
      if (h.x > camX + W || h.x + h.w < camX) continue;
      var px = h.x - camX, py = h.y - camY;
      if (h.type === 'gabel') {
        for (var x = 0; x < h.w; x += 8) P.draw(ctx, 'gabel', px + x, py);
      } else if (h.type === 'dornen') {
        for (var dx = 0; dx < h.w; dx += T) P.draw(ctx, 'dornbusch', px + dx, py);
      } else if (h.type === 'angel') {
        // Galata-Bruecke: Eimer mit Koeder, Angelhaken am Boden
        for (var ax = 0; ax < h.w; ax += T) {
          rect(px + ax + 2, py + 6, 10, 10, '#5a6270');
          rect(px + ax + 2, py + 6, 10, 2, '#8a8e98');
          rect(px + ax + 4, py + 4, 6, 3, '#c8ccd6');
          rect(px + ax + 12, py + 12, 1, 3, '#c8ccd6');
          rect(px + ax + 13, py + 14, 2, 1, '#c8ccd6');
          rect(px + ax, py + 13, 1, 3, '#c8ccd6');
        }
      } else if (h.type === 'draht') {
        // Stacheldraht: Pfosten, zwei Draehte, Stacheln
        for (var sx0 = 0; sx0 < h.w; sx0 += T) {
          rect(px + sx0 + 2, py + 3, 2, 13, '#5a4030');
          for (var wq = 0; wq < T; wq += 2) {
            rect(px + sx0 + wq, py + 6 + ((wq >> 1) % 2), 2, 1, '#9aa0ac');
            rect(px + sx0 + wq, py + 11 - ((wq >> 1) % 2), 2, 1, '#9aa0ac');
          }
          rect(px + sx0 + 7, py + 5, 1, 3, '#c8ccd6'); rect(px + sx0 + 12, py + 10, 1, 3, '#c8ccd6');
        }
      } else {
        // Oel, Salatdressing, Knoblauchsosse (toum) oder heisse Kohle
        var HZ = { oel: ['#3a2a12', '#8a6a2a'], toum: ['#d8d0c0', '#ffffff'],
                   strom: ['#1a2440', (G.tick >> 2) % 2 ? '#8ae0ff' : '#ffffff'],
                   kohle: ['#2a1008', (G.tick >> 3) % 2 ? '#ff6a1a' : '#ffb43c'],
                   kaffee: ['#3a2010', '#8a5a2a'],
                   maroni: ['#2a1008', (G.tick >> 3) % 2 ? '#ff6a1a' : '#c87a3a'] };
        var col = (HZ[h.type] || ['#6fa83c'])[0];
        var hi = (HZ[h.type] || [0, '#a8e05a'])[1];
        rect(px, py + 2, h.w, h.h - 2, col);
        for (var wv = 0; wv < h.w; wv += 4) {
          var yy = py + 1 + Math.sin((G.tick * 0.08) + wv * 0.4) * 1.4;
          rect(px + wv, yy, 3, 2, hi);
        }
        if (G.tick % 26 === 0) {
          G.particles.spawn({
            x: h.x + Math.random() * h.w, y: h.y,
            vx: 0, vy: -0.7, life: 26, col: hi, size: 2, grav: 0.04
          });
        }
      }
    }
  }

  function drawBlocks(camX, camY) {
    for (var key in G.world.blocks) {
      var b = G.world.blocks[key];
      if (b.dead) continue;
      var px = b.x * T - camX, py = b.y * T - camY - (b.bump > 0 ? (4 - Math.abs(b.bump - 4)) : 0);
      if (px < -20 || px > W + 20) continue;
      if (b.type === 'q') {
        if (b.used) P.draw(ctx, 'qblock_used', px, py);
        else {
          P.draw(ctx, 'qblock', px, py);
          if ((G.tick >> 3) % 8 === 0) {
            rect(px + 2, py + 2, 12, 1, 'rgba(255,255,255,0.55)');
          }
        }
      } else if (b.type === 'kiste') {
        P.draw(ctx, 'kiste', px, py);
      } else if (b.type === 'feder') {
        P.draw(ctx, 'feder', px, py);
      }
    }
  }

  function drawMovers(camX, camY) {
    for (var i = 0; i < G.world.movers.length; i++) {
      var m = G.world.movers[i];
      var px = m.x - camX, py = m.y - camY;
      if (px < -60 || px > W + 60) continue;
      // Am Flughafen Laufbaender, in Istanbul fliegende Teppiche
      var th = G.world.theme;
      P.draw(ctx, (th === 'flughafen' || th === 'gate') ? 'laufband' : (th === 'istanbul' ? 'teppich' : 'tablett'), px, py);
    }
  }

  function drawSigns(camX, camY) {
    var p = G.player;
    for (var i = 0; i < G.world.signs.length; i++) {
      var s = G.world.signs[i];
      var px = s.x * T - camX, py = s.y * T - camY;
      if (px < -60 || px > W + 60) continue;
      // Pfosten + Brett
      rect(px + 7, py - 12, 3, 12, '#5a3a20');
      rect(px - 2, py - 24, 22, 13, '#8a5a30');
      rect(px - 1, py - 23, 20, 11, '#b07a45');
      rect(px + 3, py - 19, 12, 2, '#5a3a20');
      rect(px + 3, py - 15, 8, 2, '#5a3a20');

      // Waehrend eines Dialogs kein Schild-Text, sonst liegen beide uebereinander
      var near = !G.dialog && G.state !== 'paused' && Math.abs(p.cx() - (s.x * T + 8)) < 56 &&
                 Math.abs(p.feet() - s.y * T) < 60;
      if (near) {
        var lines = F.wrap(s.text, 220, 1, 1);
        var bw = 0;
        for (var li = 0; li < lines.length; li++) bw = Math.max(bw, F.measure(lines[li], 1, 1));
        var bh = lines.length * 10 + 8;
        var bx = Math.round(px + 8 - bw / 2 - 5), by = Math.round(py - 30 - bh);
        bx = Math.max(4, Math.min(W - bw - 14, bx));
        ctx.fillStyle = 'rgba(14,9,20,0.86)';
        ctx.fillRect(bx, by, bw + 10, bh);
        ctx.strokeStyle = '#ffc23c';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw + 9, bh - 1);
        for (li = 0; li < lines.length; li++) {
          F.draw(ctx, lines[li], bx + 5, by + 5 + li * 10, { color: '#ffe9a8' });
        }
      }
    }
  }

  function drawGoal(camX, camY) {
    if (G.lvl.bossType === 'huseyin' || G.lvl.bossType === 'esat') return;
    if (G.lvl.boss && !G.bossCleared) return;
    var gx = G.lvl.goal[0] * T - camX, gy = G.lvl.goal[1] * T - camY;
    var bob = Math.sin(G.tick * 0.05) * 2;

    // Sicherheitskontrolle, Gate B12, Hotel (reise.js)
    if (global.Reise && global.Reise.ziel(ctx, G, gx, gy)) return;

    // Level 6 endet nicht am Honigtopf, sondern vor dem Stilbruch.
    if (G.lvl.id === 6) {
      rect(gx - 40, gy - 104, 132, 104, '#241d3a');
      rect(gx - 34, gy - 98, 120, 54, '#17122a');
      rect(gx - 34, gy - 98, 120, 2, '#ff8ad8');
      var pulse = (G.tick % 90) < 6 ? '#ffd8f0' : '#ff8ad8';
      F.draw(ctx, 'STILBRUCH', gx + 26, gy - 90,
             { color: pulse, align: 'center', scale: 2, shadow: true });
      F.draw(ctx, 'SHISHA BAR', gx + 26, gy - 70,
             { color: '#8ad8e8', align: 'center' });
      F.draw(ctx, 'OFFEN', gx + 26, gy - 58,
             { color: '#ffe9a8', align: 'center' });
      rect(gx + 6, gy - 40, 38, 40, '#3a2a1e');
      rect(gx + 10, gy - 36, 30, 36, '#1a1220');
      P.draw(ctx, 'esat', gx + 54, gy - 23);
      P.draw(ctx, 'shisha', gx - 24, gy - 19);
      P.draw(ctx, 'brisket', gx - 4, gy - 14);
      if (G.tick % 6 === 0) {
        G.particles.spawn({
          x: G.lvl.goal[0] * T - 18 + Math.random() * 6,
          y: G.lvl.goal[1] * T - 20,
          vx: 0.1, vy: -0.4, life: 60, col: '#9aa8b8', size: 2, grav: -0.006
        });
      }
      return;
    }
    // Level 22 endet vor der Pizzeria Vesuvio
    if (G.lvl.id === 22) {
      rect(gx - 60, gy - 112, 150, 112, '#e8d8b8');
      rect(gx - 66, gy - 118, 162, 8, '#b8342a');
      for (var mk = 0; mk < 10; mk++) rect(gx - 60 + mk * 15, gy - 110, 8, 10, mk % 2 ? '#f4f2ec' : '#2a9a4a');
      rect(gx - 52, gy - 96, 134, 18, '#1e1a2a');
      var neon2 = (G.tick % 80) < 5 ? '#ffffff' : '#ffd257';
      F.draw(ctx, 'PIZZERIA VESUVIO', gx + 15, gy - 91, { color: neon2, align: 'center', shadow: true });
      rect(gx - 48, gy - 66, 40, 34, '#3a2418');
      rect(gx - 45, gy - 63, 34, 28, (G.tick >> 3) % 2 ? '#ff8a2a' : '#ffb43c');
      rect(gx - 45, gy - 50, 34, 2, '#3a2418');
      rect(gx + 2, gy - 50, 26, 50, '#5a3a22');
      rect(gx + 5, gy - 47, 20, 47, '#6e4a2c');
      rect(gx + 21, gy - 26, 2, 3, '#ffd257');
      P.drawChar(ctx, 'emre', gx + 56, gy, { pose: (G.tick >> 5) % 2 ? 'cheer' : 'idle', face: 'laugh', frame: G.tick >> 4, flip: true });
      if (G.tick % 7 === 0) {
        G.particles.spawn({ x: G.lvl.goal[0] * T - 40 + Math.random() * 20, y: G.lvl.goal[1] * T - 118,
                            vx: 0.2, vy: -0.5, life: 60, col: '#b8b0c0', size: 3, grav: -0.006 });
      }
      return;
    }
    // Level 14 endet am reservierten Tisch im Stilbruch
    if (G.lvl.id === 14) {
      rect(gx - 34, gy - 30, 96, 30, '#5a1e3a');
      rect(gx - 34, gy - 30, 96, 4, '#7a2e52');
      rect(gx - 20, gy - 8, 70, 8, '#6b4522');
      P.draw(ctx, 'shisha', gx - 8, gy - 27);
      P.draw(ctx, 'shisha', gx + 20, gy - 27);
      rect(gx - 6, gy - 64, 56, 14, '#f4f2ec');
      F.draw(ctx, 'RESERVIERT', gx + 22, gy - 60, { color: '#3a2446', align: 'center' });
      if (G.tick % 9 === 0) {
        G.particles.spawn({ x: G.lvl.goal[0] * T - 2 + Math.random() * 30, y: G.lvl.goal[1] * T - 30,
                            vx: 0.1, vy: -0.4, life: 60, col: '#9aa8b8', size: 2, grav: -0.006 });
      }
      return;
    }
    P.draw(ctx, 'ziel', gx, gy - 26 + bob);
    F.draw(ctx, 'ZIEL', gx + 12, gy - 40 + bob, {
      color: '#ffe9a8', align: 'center', shadow: true,
      wave: G.tick * 0.09, waveAmp: 1
    });
    if (G.tick % 8 === 0) {
      G.particles.spawn({
        x: G.lvl.goal[0] * T + 4 + Math.random() * 16,
        y: G.lvl.goal[1] * T - 4,
        vx: (Math.random() - 0.5) * 0.5, vy: -0.6,
        life: 40, col: '#ffd257', size: 2, grav: -0.01
      });
    }
  }

  function drawCheckpoints(camX, camY) {
    var cps = G.lvl.checkpoints;
    for (var i = 0; i < cps.length; i++) {
      var px = cps[i][0] * T - camX, py = cps[i][1] * T - camY - 16;
      if (px < -60 || px > W + 60) continue;
      if (G.world.theme === 'wald') { haengematte(px, py, G.checkpointsHit[i]); continue; }
      P.draw(ctx, G.checkpointsHit[i] ? 'sofa_on' : 'sofa', px, py);
    }
  }

  /** Im Wald gibt es kein Sofa. Dafuer eine Haengematte. Gleiches Prinzip. */
  function haengematte(px, py, an) {
    rect(px - 3, py - 8, 3, 24, '#5a3a20');
    rect(px + 25, py - 8, 3, 24, '#5a3a20');
    for (var q = 0; q < 25; q++) {
      var sag = Math.round(Math.sin(q / 24 * Math.PI) * 7);
      rect(px + q, py - 6 + sag, 1, 4, an ? '#ffc23c' : '#c8a060');
      if (q % 4 === 0) rect(px + q, py - 6 + sag, 1, 4, an ? '#ff8a2a' : '#a07a40');
    }
    if (an && (G.tick >> 4) % 2 === 0) F.draw(ctx, 'Z', px + 10, py - 18, { color: '#cfc0ff' });
  }

  /* Nach Alex' Flasche sieht Yusuf alles doppelt und schief.
     Das Bild wackelt, ein zweites halbdurchsichtiges Bild liegt
     versetzt darueber. */
  function drawDrunkOrPlain() {
    // Wackeln: nach Alex' Wodka (bis der Kampf vorbei ist) oder kurz nach
    // einer HHC-Welle von Hamza
    if (G.high && !G.drunk && !(G.dizzy > 0)) { drawHigh(); return; }
    if (!G.drunk && !(G.dizzy > 0)) { drawScene(); return; }
    var dt = G.tick * 0.05;
    ctx.save();
    ctx.translate(W / 2 + Math.sin(dt) * 3, H / 2 + Math.cos(dt * 0.8) * 2);
    ctx.rotate(Math.sin(dt * 0.6) * 0.02);
    ctx.translate(-W / 2, -H / 2);
    drawScene();
    ctx.restore();
    // Doppeltes Sehen: das fertige Bild nochmal versetzt darueber legen.
    // (Die Szene ein zweites Mal zu zeichnen hat das Leuchten der Bosse
    // doppelt aufgetragen — Alex war dann nur noch ein oranger Fleck.)
    ctx.globalAlpha = 0.25;
    ctx.drawImage(canvas, Math.round(Math.sin(dt * 1.3) * 6), Math.round(Math.cos(dt) * 4), W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = G.drunk ? 'rgba(255,150,60,0.07)' : 'rgba(120,230,110,0.09)';
    ctx.fillRect(0, 0, W, H);
  }

  /* Level 26: Felix' Rauch. Das Bild wabert langsam, alles ist ein
     bisschen lila und gruen, und Schwaden ziehen durchs Bild. */
  function drawHigh() {
    var dt = G.tick * 0.03;
    ctx.save();
    ctx.translate(W / 2 + Math.sin(dt) * 2, H / 2);
    ctx.scale(1 + Math.sin(dt * 0.7) * 0.012, 1 + Math.cos(dt * 0.9) * 0.012);
    ctx.translate(-W / 2, -H / 2);
    drawScene();
    ctx.restore();
    ctx.fillStyle = 'rgba(' + (150 + Math.round(Math.sin(dt) * 40)) + ',90,200,0.12)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(200,190,230,0.10)';
    for (var i = 0; i < 5; i++) {
      var rx = ((i * 131 + G.tick * 0.35) % (W + 160)) - 80;
      ctx.beginPath(); ctx.arc(rx, 70 + (i % 3) * 60 + Math.sin(dt + i) * 10, 50, 0, 6.3); ctx.fill();
    }
  }

  function drawScene() {
    if (G.scene) {
      sceneMod().draw(ctx, G, W, H);
      return;
    }
    if (G.kasse) {
      global.Kasse.draw(ctx, G, W, H);
      return;
    }
    if (G.eat) {
      global.Eat.draw(ctx, G, W, H);
      if (G.banner > 0) drawBanner();
      return;
    }
    if (G.modus && G.modMod.full) {
      G.modMod.draw(ctx, G, W, H);
      if (G.banner > 0) drawBanner();
      return;
    }
    var camX = Math.round(G.cam.x + G.cam.sx), camY = Math.round(G.cam.y + G.cam.sy);
    var theme = G.world.theme, maxY = maxCamY();
    hintergrund(theme, camX, camY, maxY, function () {
      drawSky(theme);
      // Der Hintergrund ist fuer 288 Pixel Hoehe gezeichnet. In der
      // naeheren Handy-Ansicht wird er mit dem Boden nach oben geschoben.
      ctx.save();
      if (H < 288) ctx.translate(0, H - 288 - BOTTOM_PAD);
      // Level 22: am Ende des Waldwegs taucht die Stadt auf
      var stadt = G.lvl.stadtAb ? Math.max(0, Math.min(1, (camX + W / 2 - G.lvl.stadtAb * T) / 480)) : 0;
      if (stadt < 1) drawParallax(theme, camX, camY);
      if (stadt > 0) {
        ctx.globalAlpha = stadt;
        drawParallax('siedlung', camX, camY);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    });
    // Ebenen wie bei Hollow Knight: Dunst, Nebel am Boden, Teilchen hinten
    if (EB) EB.hinten(ctx, G, theme, camX, camY, W, H);

    if (G.lvl.deko === 'haus') drawHaus(camX, camY);
    if (G.lvl.deko === 'fort') drawFort(camX, camY);
    drawCheckpoints(camX, camY);
    drawSigns(camX, camY);
    drawGoal(camX, camY);
    drawTiles(camX, camY);
    drawHazards(camX, camY);
    drawBlocks(camX, camY);
    drawMovers(camX, camY);
    if (G.world.kickers.length) drawKickers(camX, camY);
    if (global.Strecke) global.Strecke.hinten(ctx, G, camX, camY);
    // Bloom jetzt einfangen: Hintergrund, Lampen, Kacheln — noch ohne Figuren
    if (EB) EB.bloomFangen(canvas, theme, W, H);

    var i;
    for (i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      var ix = it.x - camX, iy = it.y - camY;
      if (ix < -30 || ix > W + 30) continue;
      if (it.t === 'goldhonig') {
        // Leuchtet, damit man von unten sieht: da oben ist was
        ctx.globalAlpha = 0.22 + Math.sin(G.tick * 0.08) * 0.08;
        ctx.fillStyle = '#fff0a0';
        ctx.beginPath(); ctx.arc(ix + it.w / 2, iy + it.h / 2, 13, 0, 6.3); ctx.fill();
        ctx.globalAlpha = 1;
      }
      P.draw(ctx, it.spr, ix, iy);
      if ((it.t === 'gold' || it.t === 'goldhonig') && (G.tick >> 2) % 6 === 0) {
        G.particles.spawn({ x: it.x + it.w / 2, y: it.y + 6, vx: (Math.random() - 0.5), vy: -0.5,
                            life: 22, col: '#ffe38a', size: 2, grav: 0 });
      }
    }

    for (i = 0; i < G.enemies.length; i++) drawEnemy(G.enemies[i], camX, camY);
    if (G.modus && !G.modMod.full) G.modMod.draw(ctx, G, camX, camY);

    for (i = 0; i < G.projectiles.length; i++) {
      var pr = G.projectiles[i];
      var zeichne = E.Projectile.ZEICHNEN[pr.t];
      if (zeichne) { zeichne(ctx, pr, camX, camY, G); continue; }
      if (pr.t === 'rauch' || pr.t === 'safran') {
        // Shisha-Schwaden grau, Safranstaub golden
        var gold = (pr.t === 'safran');
        var a2 = Math.min(0.72, pr.life / 90) * 0.9;
        ctx.globalAlpha = a2;
        ctx.fillStyle = gold ? '#d8a42a' : '#c8c2d8';
        var wx = pr.x - camX + (gold ? 12 : 13), wy = pr.y - camY + 9;
        var pf = Math.sin(pr.t0 * 0.06) * 1.5;
        ctx.beginPath(); ctx.arc(wx - 6, wy + 1, 7 + pf, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(wx + 5, wy - 1, 8 - pf, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(wx, wy + 4, 7, 0, 6.3); ctx.fill();
        ctx.fillStyle = gold ? '#ffd869' : '#e8e4f0';
        ctx.beginPath(); ctx.arc(wx - 2, wy - 3, 5, 0, 6.3); ctx.fill();
        ctx.globalAlpha = 1;
        if (gold && G.tick % 4 === 0) {
          G.particles.spawn({
            x: pr.x + 12 + (Math.random() - 0.5) * 20, y: pr.y + 9,
            vx: 0, vy: -0.3, life: 30, col: '#ffcf4a', size: 2, grav: 0.01
          });
        }
        continue;
      }
      if (pr.dead) continue;
      if (pr.t === 'welle') {
        // Bodenwelle: flackernde Zacken, die ueber den Boden rollen
        var wx2 = Math.round(pr.x - camX), wy2 = Math.round(pr.y - camY);
        var ph = (pr.t0 >> 2) % 2;
        ctx.globalAlpha = 0.9;
        rect(wx2, wy2 + 6, 14, 4, pr.col);
        rect(wx2 + 2 + ph * 2, wy2 + 2, 4, 4, pr.col);
        rect(wx2 + 8 - ph * 2, wy2, 4, 6, pr.col);
        rect(wx2 + 1, wy2 + 8, 12, 1, '#ffffff');
        ctx.globalAlpha = 1;
        continue;
      }
      if (pr.patch) {
        // Flecken am Boden: Alex' Pfuetzen, Hummus, Glut, Scherben.
        // (Die Pfuetzen waren frueher unsichtbar — man rutschte, ohne
        // zu sehen warum.)
        var fx2 = Math.round(pr.x - camX), fy2 = Math.round(pr.y - camY);
        ctx.globalAlpha = Math.min(1, pr.life / 30) * 0.9;
        if (pr.t === 'scherben') {
          for (var si = 0; si < pr.w; si += 4) {
            rect(fx2 + si, fy2 + 1 + (si % 8 ? 1 : 0), 3, 2, '#f4f6fa');
            rect(fx2 + si + 1, fy2 + 3, 2, 1, '#2a5ab8');
          }
        } else {
          rect(fx2 + 2, fy2 + 1, pr.w - 4, pr.h - 1, pr.col);
          rect(fx2, fy2 + 2, pr.w, pr.h - 2, pr.col);
          rect(fx2 + 3, fy2 + 1, pr.w - 8, 1,
               pr.t === 'glut' ? ((G.tick >> 2) % 2 ? '#ffd257' : '#ff8a2a') : 'rgba(255,255,255,0.5)');
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (pr.t === 'hhc') {
        // HHC-Welle: gruen-lila Schwaden, die auf und ab wogen
        var hx = pr.x - camX, hy = pr.y - camY;
        ctx.globalAlpha = Math.min(0.85, pr.life / 40);
        for (var hk = 0; hk < 4; hk++) {
          ctx.fillStyle = hk % 2 ? '#8ae07a' : '#b89ae8';
          ctx.beginPath();
          ctx.arc(hx + 5 + hk * 7, hy + 10 + Math.sin(pr.t0 * 0.2 + hk) * 3, 7, 0, 6.3);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (pr.t === 'pferd') { drawPferd(pr, camX, camY); continue; }
      if (pr.t === 'wort') {
        // Rage-Bait und Formeln: fallen als Woerter vom Himmel
        F.draw(ctx, pr.text, Math.round(pr.x - camX), Math.round(pr.y - camY),
               { color: pr.col || ((pr.t0 >> 3) % 2 ? '#ff6a6a' : '#ffffff'), shadow: true });
        continue;
      }
      if (pr.t === 'blitz') {
        var bcol = pr.col || '#8ae0ff';
        var bxl = Math.round(pr.x - camX), byl = Math.round(pr.y - camY);
        if (pr.life > pr.aktiv) {
          // Warnung: Kreis am Boden, flackert immer schneller
          if ((pr.life >> (pr.life < 30 ? 1 : 2)) % 2 === 0) {
            rect(bxl - 4, byl + pr.h - 4, pr.w + 8, 4, bcol);
            F.draw(ctx, '!', bxl + pr.w / 2, byl + pr.h - 18, { color: bcol, align: 'center', scale: 2 });
          }
        } else {
          ctx.globalAlpha = 0.85;
          rect(bxl + 4, byl, pr.w - 8, pr.h, bcol);
          rect(bxl + 7, byl, pr.w - 14, pr.h, '#ffffff');
          ctx.globalAlpha = 1;
        }
        continue;
      }
      if (pr.t === 'faust' || pr.t === 'faustY') {
        // Kurzes Aufblitzen, wo die Faust trifft
        if (pr.life >= 4) {
          ctx.globalAlpha = 0.55;
          rect(pr.x - camX, pr.y - camY + pr.h / 2 - 2, pr.w, 4, '#ffffff');
          ctx.globalAlpha = 1;
        }
        continue;
      }
      if (pr.t === 'bb' || pr.t === 'bbE') {
        var bbx = Math.round(pr.x - camX), bby = Math.round(pr.y - camY);
        if (pr.t === 'bb') {
          // Yusufs BBs: Leuchtspur, gruen
          rect(bbx - (pr.vx > 0 ? 5 : -4), bby + 1, 5, 1, 'rgba(200,255,106,0.45)');
          rect(bbx, bby, 3, 3, '#c8ff6a');
        } else {
          rect(bbx - 1, bby - 1, 5, 5, 'rgba(255,70,50,0.55)');
          rect(bbx, bby, 3, 3, '#ffffff');
        }
        continue;
      }
      if (pr.t === 'granate' && pr.liegt > 0 && (pr.liegt >> 2) % 2 === 0) {
        rect(pr.x - camX + 1, pr.y - camY - 3, 4, 3, '#ff3a30');
        F.draw(ctx, '!', pr.x - camX + 3, pr.y - camY - 16, { color: '#ff6a6a', align: 'center' });
      }
      if (!pr.spr) continue;
      if (pr.rot) {
        // Zangen, Teller und der Ball drehen sich im Flug
        var rs = P.get(pr.spr);
        ctx.save();
        ctx.translate(Math.round(pr.x - camX + pr.w / 2), Math.round(pr.y - camY + pr.h / 2));
        ctx.rotate(pr.rot);
        P.draw(ctx, pr.spr, -rs.w / 2, -rs.h / 2);
        ctx.restore();
        continue;
      }
      P.draw(ctx, pr.spr, pr.x - camX, pr.y - camY, pr.vx < 0);
    }

    if (G.boss) drawBoss(camX, camY);
    // Level 21: Mirkan, sein Mercedes und was davon liegen bleibt
    if (G.lvl.mirkanCut && global.Airsoft) global.Airsoft.mirkanDraw(ctx, G, camX, camY);
    // Wo Yusuf schon gestorben ist: Grabsteine (spass.js)
    if (global.Spass) global.Spass.drawWelt(ctx, G, camX, camY);
    // Level 25: die Security (und der Hund)
    if (G.jagd && global.Reise) global.Reise.jagdDraw(ctx, G, camX, camY);
    // Der Kumpel hinter Yusuf (Level 14, 15, 22)
    if (G.rider && G.rider.pos) drawRider(camX, camY);
    drawPlayer(camX, camY);
    // Falsche Waende liegen VOR Yusuf (er verschwindet dahinter, bis sie verblassen)
    if (global.Strecke) global.Strecke.vorne(ctx, G, camX, camY);
    if (G.fress) global.Fress.draw(ctx, G, camX, camY);
    drawParticles(camX, camY);
    drawFloats(camX, camY);
    drawTalk(camX, camY);

    if (EB) {
      // Vorne: Licht, Strahlen, Teilchen, Silhouetten; dann Bloom, Farbe, Vignette
      EB.vorne(ctx, G, theme, camX, camY, W, H, { maxY: maxY });
      EB.nachher(ctx, theme, canvas, W, H);
    } else {
      // leichte Abdunklung an den Rändern
      var vg = ctx.createLinearGradient(0, 0, 0, H);
      vg.addColorStop(0, 'rgba(0,0,0,0.20)');
      vg.addColorStop(0.3, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    if (G.cut) drawCutFrame(G.cut);
    if (G.banner > 0) drawBanner();
  }

  /* ---------- Level 11: Yusufs Haus ---------- */

  function drawHaus(camX, camY) {
    var gy = 15 * T - camY, x0 = 6 - camX, w = 112;
    if (x0 > W || x0 + w < -20) return;
    // Hauswand, Dach, Fenster
    rect(x0, gy - 118, w, 118, '#d8c0a0');
    rect(x0, gy - 118, w, 4, '#b89c7c');
    for (var bx = 0; bx < w; bx += 16) rect(x0 + bx, gy - 110, 1, 110, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = '#8a3a2e';
    ctx.beginPath();
    ctx.moveTo(x0 - 10, gy - 118); ctx.lineTo(x0 + w / 2, gy - 164); ctx.lineTo(x0 + w + 10, gy - 118);
    ctx.closePath(); ctx.fill();
    rect(x0 - 10, gy - 120, w + 20, 4, '#5e241c');
    // Fenster oben mit Vorhang
    rect(x0 + 14, gy - 102, 30, 24, '#3a4a6a'); rect(x0 + 14, gy - 102, 30, 3, '#6a82aa');
    rect(x0 + 68, gy - 102, 30, 24, '#3a4a6a'); rect(x0 + 68, gy - 102, 30, 3, '#6a82aa');
    rect(x0 + 14, gy - 102, 8, 24, '#c85a4a'); rect(x0 + 90, gy - 102, 8, 24, '#c85a4a');
    // Tuer mit Nummer und Klingelschild
    rect(x0 + 40, gy - 52, 32, 52, '#5a3a22');
    rect(x0 + 43, gy - 49, 26, 49, '#6e4a2c');
    rect(x0 + 64, gy - 28, 3, 3, '#ffd257');
    F.draw(ctx, '7', x0 + 56, gy - 44, { color: '#ffd257', align: 'center' });
    rect(x0 + 76, gy - 36, 34, 11, '#e8e4dc');
    rect(x0 + 76, gy - 36, 34, 1, '#ffffff');
    F.draw(ctx, 'BALCI', x0 + 93, gy - 34, { color: '#3a3a44', align: 'center' });
    // Nachts (Level 11): alles dunkler, oben brennt Licht, ueber der Tuer
    // eine Lampe
    if (G.world.theme === 'siedlung_nacht') {
      ctx.fillStyle = 'rgba(14,12,34,0.55)';
      ctx.beginPath();
      ctx.moveTo(x0 - 10, gy - 118); ctx.lineTo(x0 + w / 2, gy - 164); ctx.lineTo(x0 + w + 10, gy - 118);
      ctx.closePath(); ctx.fill();
      rect(x0 - 10, gy - 120, w + 20, 120, 'rgba(14,12,34,0.55)');
      rect(x0 + 22, gy - 99, 22, 21, '#ffd88a');
      rect(x0 + 22, gy - 99, 22, 3, '#fff0c0');
      rect(x0 + 49, gy - 60, 14, 5, '#12141c');
      rect(x0 + 52, gy - 56, 8, 3, '#ffe9a8');
      ctx.fillStyle = 'rgba(255,220,140,0.10)';
      ctx.beginPath(); ctx.arc(x0 + 56, gy - 30, 34, 0, 6.3); ctx.fill();
    }
    // Die sechs Tueten stehen vor der Tuer
    for (var i = 0; i < 6; i++) {
      P.draw(ctx, 'tuete', x0 + 4 + (i % 3) * 11, gy - 9 - Math.floor(i / 3) * 8);
    }
  }

  /* ---------- Level 21: das Fort ----------
     Palisade aus Baumstaemmen, Sandsaecke, ein Tarnnetz ueber dem Bunker
     und Sonnets Team-Banner. Alles Kulisse — gekaempft wird davor. */

  function drawFort(camX, camY) {
    var a = G.arena || (G.lvl.arena ? { x: G.lvl.arena.x * T, w: G.lvl.arena.w * T } : null);
    if (!a) return;
    var gy = 15 * T - camY, x0 = a.x - camX, i;
    if (x0 > W || x0 + a.w < -40) return;
    // Palisade
    for (i = 0; i < a.w; i += 10) {
      var lx = x0 + i;
      if (lx < -12 || lx > W + 12) continue;
      var hoch = 150 + ((i * 7) % 3) * 6;
      rect(lx, gy - hoch, 9, hoch, (i / 10) % 2 ? '#6a4a2a' : '#7a5632');
      rect(lx + 1, gy - hoch, 2, hoch, '#8a6a3a');
      rect(lx + 2, gy - hoch - 3, 5, 3, '#6a4a2a');
      rect(lx + 3, gy - hoch - 5, 3, 2, '#6a4a2a');
    }
    rect(x0, gy - 120, a.w, 3, '#3a2a1a');                 // Querbalken
    rect(x0, gy - 60, a.w, 3, '#3a2a1a');
    // Banner: TEAM SONNET, mit Patch
    var bx = x0 + a.w / 2 - 70;
    rect(bx, gy - 150, 140, 24, '#2a3a1e');
    rect(bx, gy - 150, 140, 2, '#c8b87a');
    rect(bx + 6, gy - 145, 20, 14, '#d8282e');
    ctx.fillStyle = '#f4f2ec';
    ctx.beginPath(); ctx.arc(bx + 14, gy - 138, 4.5, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#d8282e';
    ctx.beginPath(); ctx.arc(bx + 15.5, gy - 138, 3.6, 0, 6.3); ctx.fill();
    rect(bx + 19, gy - 139, 2, 2, '#f4f2ec');
    F.draw(ctx, 'TEAM SONNET', bx + 82, gy - 142, { color: '#e8d8a0', align: 'center' });
    // Sandsaecke an den Seiten
    for (i = 0; i < 2; i++) {
      var sx = i ? x0 + a.w - 70 : x0 + 20;
      for (var sr = 0; sr < 3; sr++) {
        for (var sc = 0; sc < 4 - sr; sc++) {
          var sxx = sx + sc * 12 + sr * 6, syy = gy - 9 - sr * 8;
          rect(sxx, syy, 12, 8, '#b8a878');
          rect(sxx, syy, 12, 2, '#d8c898');
          rect(sxx, syy + 7, 12, 1, '#8a7a50');
        }
      }
    }
  }

  /* ---------- Level 12: Rampen, Esat, Lennart ---------- */

  function drawKickers(camX, camY) {
    var ks = G.world.kickers;
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      var px = Math.round(k.x - camX), py = Math.round(k.y - camY);
      if (px < -40 || px - 40 > W) continue;
      // Holzrampe: flach anlaufend, vorne 10 Pixel hoch
      ctx.fillStyle = '#6b4522';
      ctx.beginPath();
      ctx.moveTo(px - 32, py); ctx.lineTo(px, py - 11); ctx.lineTo(px, py); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b07a45';
      ctx.beginPath();
      ctx.moveTo(px - 32, py); ctx.lineTo(px, py - 11); ctx.lineTo(px, py - 8); ctx.lineTo(px - 26, py);
      ctx.closePath(); ctx.fill();
      rect(px - 2, py - 11, 2, 11, '#4a2c17');
      for (var s = 0; s < 3; s++) rect(px - 24 + s * 8, py - 3 - s * 3, 1, 3 + s * 3, '#8a5a30');
    }
  }

  /** Hebt das Fahrrad auf der Rampe an, damit es nicht durchs Holz faehrt. */
  function rampLift(x, feet) {
    var ks = G.world.kickers;
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (x > k.x - 32 && x <= k.x + 2 && Math.abs(feet - k.y) < 3) {
        return Math.round(Math.max(0, Math.min(1, (x - (k.x - 32)) / 32)) * 10);
      }
    }
    return 0;
  }

  /** Fahrrad mit Fahrer. (cx, feet) = Mitte unten, a = Drehung (Salto). */
  function drawBikeRider(who, bikeSpr, cx, feet, flip, a, travel, face) {
    // travel = gefahrene Strecke: alle 5 Pixel drehen sich die Speichen weiter
    var step = Math.floor(travel / 5);
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(feet - 9));
    if (a) ctx.rotate(flip ? a : -a);
    if (flip) ctx.scale(-1, 1);
    P.draw(ctx, bikeSpr + (step % 2 ? '2' : ''), -15, -8);
    if (who === 'lennart') P.draw(ctx, 'lennart', -12, -23);
    else P.drawChar(ctx, who, -2, 2, { pose: 'ride', frame: step >> 1, face: face || 'normal' });
    ctx.restore();
  }

  function drawRider(camX, camY) {
    var r = G.rider, pos = r.pos;
    var talking = G.talk.esat && G.talk.esat.t > 0;
    if (!G.lvl.bike) {
      // Zu Fuss: springt, wo Yusuf gesprungen ist
      var gy = groundAt(pos.x);
      var inAir = (gy !== null && pos.y < gy - 3);
      P.drawChar(ctx, 'esat', pos.x - camX, pos.y - camY, {
        pose: inAir ? 'jump' : (r.moving ? 'run' : 'idle'),
        frame: Math.floor(pos.x / 7), flip: pos.f < 0,
        face: talking ? 'laugh' : 'normal'
      });
      if (G.lvl.airsoft && global.Airsoft) {
        global.Airsoft.drawGun(ctx, pos.x - camX + (pos.f < 0 ? -5 : 5), pos.y - camY - 12, pos.f < 0, 1, false);
      }
      return;
    }
    if (G.lvl.buddy === 'sonnet' && global.Airsoft) {
      // Sonnet faehrt im Buggy hinterher — und macht die Saltos mit
      var bl = rampLift(pos.x, pos.y), bdir = pos.f < 0 ? -1 : 1;
      var bx = Math.round(pos.x - camX), byy = Math.round(pos.y - camY - bl);
      ctx.save();
      if (pos.a) {
        ctx.translate(bx, byy - 20);
        ctx.rotate(bdir > 0 ? -pos.a : pos.a);
        ctx.translate(-bx, -(byy - 20));
      }
      global.Airsoft.drawBuggy(ctx, bx, byy, bdir, 1, {
        weg: pos.x, fahrer: talking ? 'laugh' : 'normal', fahne: G.tick * 0.2,
        huepf: r.moving ? ((G.tick >> 2) % 2) : 0, hupe: talking ? 1 : 0
      });
      ctx.restore();
      return;
    }
    var lift = rampLift(pos.x, pos.y);
    drawBikeRider('esat', 'bike_e', pos.x - camX, pos.y - camY - lift, pos.f < 0, pos.a,
                  pos.x, talking ? 'laugh' : 'normal');
  }

  /** Sprechblasen ueber den Figuren (ohne das Spiel anzuhalten). */
  function drawTalk(camX, camY) {
    for (var who in G.talk) {
      var s = G.talk[who];
      if (!s || s.t <= 0) continue;
      var x, y, p = G.player;
      // Hoehen gestaffelt: der Kumpel faehrt direkt hinter Yusuf —
      // sonst ueberdecken sich die Blasen.
      if (who === 'yusuf') { x = p.cx(); y = p.y - 22; }
      else if (who === (G.lvl.buddy || 'esat') && G.rider && G.rider.pos) {
        x = G.rider.pos.x; y = G.rider.pos.y - (who === 'sonnet' ? 68 : 66);
      }
      else if (G.wo && G.wo[who]) { x = G.wo[who].x; y = G.wo[who].y; }
      else continue;
      var sx = Math.round(x - camX), sy = Math.round(y - camY);
      var tw = F.measure(s.text, 1, 1);
      var bx = Math.max(4, Math.min(W - tw - 12, sx - tw / 2 - 4));
      ctx.globalAlpha = Math.min(1, s.t / 12);
      ctx.fillStyle = 'rgba(14,9,20,0.82)';
      ctx.fillRect(bx, sy - 4, tw + 8, 14);
      F.draw(ctx, s.text, bx + 4, sy, { color: SPEAKER[who] ? SPEAKER[who].col : '#ffffff' });
      ctx.globalAlpha = 1;
    }
  }

  /** Kinobalken, Tempo-Streifen und das Standbild mit Namen.
      c.karte = [Name, Untertitel] (sonst Lennarts), c.tempo = Streifen. */
  function drawCutFrame(c) {
    var i;
    // Tempo-Streifen, solange Mirkans Mercedes rast
    if (c.tempo) {
      for (i = 0; i < 7; i++) {
        var sy = 40 + ((i * 53 + G.tick * 3) % (H - 80));
        var sx = W - ((G.tick * 22 + i * 97) % (W + 120));
        rect(sx, sy, 60 + (i % 3) * 20, 1, 'rgba(255,255,255,0.35)');
      }
    }
    if (c.phase === 'karte') {
      // Standbild: warme Toene, Name gross und schraeg im Bild
      ctx.fillStyle = 'rgba(255,140,40,0.16)';
      ctx.fillRect(0, 0, W, H);
      var k = Math.min(1, c.card / 10);
      ctx.save();
      ctx.translate(W / 2, H / 2 - 10);
      ctx.rotate(-0.08);
      ctx.fillStyle = 'rgba(10,6,16,0.82)';
      ctx.fillRect(-W, -30 * k, W * 2, 60 * k);
      rect(-W, -30 * k, W * 2, 2, '#ff6fa8');
      rect(-W, 30 * k - 2, W * 2, 2, '#6fc8e8');
      if (c.card > 6) {
        var kt = c.karte || ['', ''];
        F.draw(ctx, kt[0], 0, -20, {
          color: '#ffffff', align: 'center', scale: 4, shadow: true, shadowColor: '#ff6fa8'
        });
        F.draw(ctx, kt[1], 0, 14, { color: '#6fc8e8', align: 'center' });
      }
      ctx.restore();
    }
    var bh = Math.round(26 * c.bars);
    if (bh > 0) {
      rect(0, 0, W, bh, '#000000');
      rect(0, H - bh, W, bh, '#000000');
    }
    // Mirkans Szene ist lang: Sprung halten spult vor
    if (c.mirkan && c.bars > 0.9 && c.phase !== 'aus') {
      F.draw(ctx, G.touch ? 'A HALTEN = VORSPULEN' : LV.mirkanCut.skip, W - 8, H - 16,
             { color: '#8f86a8', align: 'right' });
    }
  }

  function drawEnemy(e, camX, camY) {
    var px = e.x - camX, py = e.y - camY;
    if (px < -50 || px > W + 50) return;
    var spr = e.def.spr[e.anim % e.def.spr.length];
    if (e.dead && e.raus) {
      // Airsoft: Hand hoch, HIT gerufen, geht vom Feld (und wird blasser)
      ctx.globalAlpha = Math.max(0, 1 - e.deadTimer / 70);
      P.draw(ctx, e.def.hitSpr || spr, px, py, e.facing < 0);
      ctx.globalAlpha = 1;
      return;
    }
    if (e.dead) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - e.deadTimer / 60);
      ctx.translate(Math.round(px + e.w / 2), Math.round(py + e.h / 2));
      ctx.scale(1, -1);
      P.draw(ctx, spr, -e.w / 2, -e.h / 2, e.facing < 0);
      ctx.restore();
      return;
    }
    if (e.stun > 0) py += Math.sin(G.tick * 0.5) * 1;
    if (e.flash > 0 && (G.tick >> 1) % 2 === 0) P.drawWhite(ctx, spr, px, py, e.facing < 0);
    else P.draw(ctx, spr, px, py, e.facing < 0);

    if (e.t === 'bro' && e.charge > 0 && G.tick % 8 < 4) {
      F.draw(ctx, '!', px + e.w / 2, py - 10, { color: '#ff6fa8', align: 'center' });
    }
    // Airsoft: wer gleich schiesst, zeigt es an
    if (e.aimT > 0 && e.t !== 'sniper' && G.tick % 8 < 4) {
      F.draw(ctx, '!', px + e.w / 2, py - 10, { color: '#ff8a2a', align: 'center' });
    }
    if (e.laser && global.Airsoft) global.Airsoft.drawLaser(ctx, e.laser, camX, camY, G.tick);
    if (e.stun > 0 && G.tick % 20 < 10) {
      F.draw(ctx, '*', px + e.w / 2, py - 8, { color: '#ffd257', align: 'center' });
    }
  }

  function drawPlayer(camX, camY) {
    var p = G.player;
    if (p.invuln > 0 && (G.tick >> 1) % 2 === 0 && !p.dead) return;

    // Auf dem Fahrrad (Level 22). Beim Salto dreht sich alles mit.
    if (G.lvl.bike && !p.dead) {
      var bps = p.pose();
      var bface = p.flipping ? 'laugh' : bps.face;
      var blift = p.grounded ? rampLift(p.cx(), p.feet()) : 0;
      drawBikeRider('yusuf', G.lvl.bikeSpr || 'bike', p.cx() - camX, p.feet() - camY - blift, p.facing < 0,
                    p.flipping ? p.flipA : 0, p.x, bface);
      if (p.sleeping) {
        for (var zi = 0; zi < 3; zi++) {
          var zt = (G.tick * 0.02 + zi * 0.33) % 1;
          F.draw(ctx, 'Z', p.cx() - camX + 8 + zt * 12, p.y - camY - 10 - zt * 18, {
            color: 'rgba(200,185,255,' + (1 - zt).toFixed(2) + ')', scale: 1 + Math.floor(zt * 2)
          });
        }
      }
      return;
    }

    var ps = p.pose();
    var opts = {
      pose: ps.pose, face: ps.face,
      frame: p.anim, flip: p.facing < 0
    };
    if (p.power > 0) {
      // Gold-Döner: goldener Schimmer + Funken
      opts.flash = '#ffd257';
      opts.flashAlpha = 0.28 + Math.sin(G.tick * 0.3) * 0.16;
      if (G.tick % 3 === 0) {
        G.particles.spawn({
          x: p.cx() + (Math.random() - 0.5) * 14, y: p.y + Math.random() * p.h,
          vx: 0, vy: -0.5, life: 20, col: '#ffe38a', size: 2, grav: 0
        });
      }
    }
    // Level 30: Yusuf rastet aus. Er gluehst, knurrt und dampft.
    if (G.wut && !p.dead && p.power <= 0) {
      opts.flash = '#ff9a2a';
      opts.flashAlpha = 0.16 + Math.sin(G.tick * 0.3) * 0.1;
      if (ps.face === 'normal') opts.face = 'growl';
      if (G.tick % 4 === 0) {
        G.particles.spawn({
          x: p.cx() + (Math.random() - 0.5) * 16, y: p.y + Math.random() * p.h,
          vx: 0, vy: -0.8, life: 22, col: Math.random() < 0.5 ? '#ffd257' : '#ff8a2a', size: 2, grav: -0.02
        });
      }
    }
    if (p.dead) opts.alpha = Math.max(0, 1 - p.deadTimer / 110);
    // Stauchen beim Landen, Strecken im Sprung (spass.js). In Semihs
    // Erinnerung ist Yusuf wieder klein.
    var fm = global.Spass ? global.Spass.form(G) : { sx: 1, sy: 1 };
    var klein = G.klein || 1;
    ctx.save();
    ctx.translate(Math.round(p.cx() - camX), Math.round(p.feet() - camY));
    ctx.scale(fm.sx * klein, fm.sy * klein);
    P.drawChar(ctx, G.lvl.airsoft ? 'yusuf_as' : 'yusuf', 0, 0, opts);
    ctx.restore();
    // Level 21: die Leihwaffe. Wer HIT ruft, hat beide Haende oben.
    if (G.lvl.airsoft && !p.hitCall && global.Airsoft) {
      var tief = (ps.pose === 'duck' || ps.pose === 'pound' || ps.pose === 'sleep') ? 3 : 0;
      global.Airsoft.drawGun(ctx, p.cx() - camX + p.facing * 8, p.feet() - camY - 12 + tief,
                             p.facing < 0, 1, p.muzzle > 0);
      if (p.reload > 0 && (G.tick >> 3) % 2 === 0) {
        F.draw(ctx, 'NACHLADEN', p.cx() - camX, p.y - camY - 12, { color: '#c8c0d8', align: 'center', shadow: true });
      }
    }

    // Level 10: sechs Tueten. Mindestens.
    if (G.lvl.bags && !p.dead) {
      var bgx = Math.round(p.cx() - camX), bgy = Math.round(p.feet() - camY);
      P.draw(ctx, 'tuete', bgx - 17, bgy - 15);
      P.draw(ctx, 'tuete', bgx + 7, bgy - 13);
    }

    if (p.sleeping) {
      var zx = p.cx() - camX + 10 * p.facing, zy = p.y - camY - 6;
      for (var i = 0; i < 3; i++) {
        var t = (G.tick * 0.02 + i * 0.33) % 1;
        F.draw(ctx, 'Z', zx + t * 12 * p.facing, zy - t * 18, {
          color: 'rgba(200,185,255,' + (1 - t).toFixed(2) + ')',
          scale: 1 + Math.floor(t * 2)
        });
      }
    }
  }

  /** Das Trojanische Pferd: Holz, Raeder, Luke. Selbst gezeichnet. */
  function drawPferd(pr, camX, camY) {
    var x = Math.round(pr.x - camX), y = Math.round(pr.y - camY), d = pr.vx >= 0 ? 1 : (pr.vx < 0 ? -1 : (pr.vxAlt > 0 ? 1 : -1));
    var bob = pr.stopT > 0 ? 0 : ((pr.t0 >> 2) % 2);
    // Brett mit Raedern
    rect(x, y + 32, 44, 5, '#6a4020');
    for (var r = 0; r < 3; r++) {
      rect(x + 4 + r * 16, y + 36, 7, 4, '#2a1a0a');
    }
    // Beine, Rumpf, Hals, Kopf
    rect(x + 8, y + 20 + bob, 4, 12, '#a87a44');
    rect(x + 32, y + 20 + bob, 4, 12, '#a87a44');
    rect(x + 4, y + 10 + bob, 36, 12, '#c8904e');
    rect(x + 4, y + 10 + bob, 36, 2, '#e0b070');
    var hx = d > 0 ? x + 30 : x + 2;
    rect(hx, y + bob, 10, 12, '#c8904e');
    rect(d > 0 ? hx + 6 : hx - 4, y + bob, 8, 6, '#c8904e');
    rect(d > 0 ? hx + 10 : hx - 2, y + 2 + bob, 2, 2, '#2a1a0a');
    rect(d > 0 ? x : x + 40, y + 12 + bob, 4, 8, '#8a5a2a');
    // Die Luke — offen, wenn es Speere regnet
    rect(x + 16, y + 13 + bob, 12, 6, pr.stopT > 0 && pr.stopT < 50 ? '#141018' : '#8a5a2a');
    if (pr.stopT > 44 && (pr.t0 >> 2) % 2 === 0) {
      F.draw(ctx, '!', x + 22, y - 14, { color: '#ff6a6a', align: 'center', scale: 2 });
    }
  }

  /* Angriffe, vor denen gewarnt wird — Beruehrung tut dann weh. */
  var BOSS_WARN = {
    chargeprep: 1, carjump: 1, slam: 1, doubleslam: 1, dashprep: 1,
    stampf: 1, drift: 1, wirbel: 1, tornado: 1, runter: 1,
    blitzprep: 1, sprung: 1,
    dribbelprep: 1, fallrueck: 1, sirtaki: 1,
    speerprep: 1, trittprep: 1, tritt: 1, felgenwurf: 1,
    // Seit 02.10.: jeder Anlauf ist lesbar (Hollow Knight)
    nitroprep: 1, rueckprep: 1, stossprep: 1, kreuzprep: 1, teppichprep: 1, curl: 1,
    flex: 1, burpees: 1, jabprep: 1, teepprep: 1, lowkickprep: 1, knieprep: 1,
    konter: 1, kohle: 1, kotzfontaene: 1, flaschenhagel: 1, torkelsturm: 1, turmbau: 1
  };

  /** Sternchen ueber dem Kopf, solange ein Boss betaeubt ist (Mario). */
  function drawBetaeubt(b, camX, camY) {
    var cx = b.cx() - camX, cy = b.y - camY - 10, r = Math.max(14, b.w * 0.6);
    for (var k = 0; k < 3; k++) {
      var a = G.tick * 0.12 + k * 2.094;
      var sx = Math.round(cx + Math.cos(a) * r), sy = Math.round(cy + Math.sin(a) * 4);
      var col = k === 1 ? '#ffffff' : '#ffd257';
      rect(sx - 1, sy - 3, 2, 6, col);
      rect(sx - 3, sy - 1, 6, 2, col);
    }
  }

  function drawBoss(camX, camY) {
    drawBossFigur(camX, camY);
    var b = G.boss;
    if (b && !b.dead && b.state === 'betaeubt') drawBetaeubt(b, camX, camY);
  }

  /** Erfans fliegender Teppich (Persischer Koenig): rot mit Goldmuster
      und Fransen, wellt sich im Flug. */
  function drawTeppich(b, camX, camY) {
    var tw = b.scale >= 3 ? 76 : 62, x0 = Math.round(b.cx() - camX - tw / 2), y0 = Math.round(b.y + b.h - camY - 2);
    for (var i = 0; i < tw; i += 2) {
      var wy = Math.round(Math.sin(G.tick * 0.2 + i * 0.18) * 2);
      rect(x0 + i, y0 + wy, 2, 6, '#9a1a2a');
      rect(x0 + i, y0 + wy + 1, 2, 1, '#ffd257');
      rect(x0 + i, y0 + wy + 4, 2, 1, '#ffd257');
      if (i % 8 === 4) rect(x0 + i, y0 + wy + 2, 2, 2, '#3ad0ff');
    }
    var wl = Math.round(Math.sin(G.tick * 0.2) * 2), wr = Math.round(Math.sin(G.tick * 0.2 + tw * 0.18) * 2);
    rect(x0 - 3, y0 + wl + 1, 3, 1, '#f4e4b0'); rect(x0 - 3, y0 + wl + 4, 3, 1, '#f4e4b0');
    rect(x0 + tw, y0 + wr + 1, 3, 1, '#f4e4b0'); rect(x0 + tw, y0 + wr + 4, 3, 1, '#f4e4b0');
  }

  /** Lennarts Langhantel beim Kreuzheben: liegt vor ihm, geht hoch, knallt runter. */
  function drawLanghantel(b, camX, camY) {
    var hoch = 0;
    if (b.state === 'kreuzheben') hoch = b.timer > 12 ? Math.min(1, (40 - b.timer) / 14) : 0;
    var by = Math.round(b.y + b.h - camY - 8 - hoch * b.h * 0.42);
    var bx = Math.round(b.cx() - camX + b.facing * b.w * 0.1);
    var hb = Math.round(b.w * 0.95);
    rect(bx - hb, by + 3, hb * 2, 2, '#c8ccd6');
    for (var s = -1; s <= 1; s += 2) {
      rect(bx + s * hb - (s > 0 ? 4 : 0), by - 4, 4, 16, '#1c1c24');
      rect(bx + s * (hb - 5) - (s > 0 ? 3 : 0), by - 2, 3, 12, '#2c2c38');
    }
  }

  /** Leuchtender Rand um einen verwandelten Boss (Sprite-Bosse). */
  function drawAura(sn, col) {
    ctx.globalAlpha = 0.45 + Math.sin(G.tick * 0.25) * 0.2;
    P.drawTint(ctx, sn, -1, 0, col);
    P.drawTint(ctx, sn, 1, 0, col);
    P.drawTint(ctx, sn, 0, -1, col);
    P.drawTint(ctx, sn, 0, 1, col);
    ctx.globalAlpha = 1;
  }

  /** Dasselbe fuer zusammengesetzte Figuren (Huseyin, Esat). */
  function drawCharAura(who, x, y, o, col) {
    // Nur ein Rand, keine Einfaerbung: sonst verschwindet die Figur
    // komplett hinter ihrem eigenen Leuchten.
    var d = (o.scale >= 3) ? 4 : 3;
    var a = { pose: o.pose, face: o.face, frame: o.frame, flip: o.flip, scale: o.scale,
              flash: col, flashAlpha: 1,
              alpha: 0.26 + Math.sin(G.tick * 0.25) * 0.1 };
    P.drawChar(ctx, who, x - d, y, a);
    P.drawChar(ctx, who, x + d, y, a);
    P.drawChar(ctx, who, x, y - d, a);
    P.drawChar(ctx, who, x, y + 1, a);
  }

  function drawBossFigur(camX, camY) {
    var b = G.boss;
    // Die neuen Bosse zeichnen sich selbst (bosse.js)
    if (b.draw) { b.draw(ctx, camX, camY, G); return; }
    // Waehrend der Verwandlung zittert er
    var jit = (b.state === 'transform') ? ((G.tick >> 1) % 2 ? 1 : -1) : 0;
    var px = b.cx() - camX + jit, py = b.y + b.h - camY;
    var glow = b.rage && !b.dead;

    // Level-Bosse sind gezeichnete Sprites, keine zusammengesetzten Figuren
    if (E.MINIBOSS[G.lvl.bossType]) {
      var d = b.def;
      var sn = d.spr[b.anim % d.spr.length];
      if (b.felgen) sn = 'mercedes_felgen';        // Mirkans schwarze Felgen
      if (b.look) sn = b.t + '_' + b.look + (b.anim % 2 ? '2' : '');   // Erfans Formen
      var sp = P.get(sn);
      var sc = b.scale || d.scale;   // Lennart waechst mitten im Kampf
      var dw = sp.w * sc, dh = sp.h * sc;
      var dx0 = Math.round(b.cx() - camX - dw / 2) + jit;
      var dy0 = Math.round(b.y + b.h - camY - dh);
      // Mirkans Wagen federt beim Rasen
      if (b.t === 'mirkan' && !b.dead && b.grounded &&
          (b.state === 'charge' || b.state === 'drift' || b.state === 'nitro' || b.state === 'rueckwaerts')) {
        dy0 += (G.tick >> 1) % 2;
      }

      ctx.save();
      if (b.dead) ctx.globalAlpha = Math.max(0.15, 1 - b.deadTimer / 140);
      else if (b.invuln > 0 && b.state !== 'transform' && (G.tick >> 1) % 2 === 0) {
        ctx.globalAlpha = 0.55;
      }
      // Betaeubt: Mirkans Wagen haengt schief, Lennart und Erfan kippen weg
      if (b.state === 'betaeubt' && !b.dead) {
        ctx.translate(dx0 + dw / 2, dy0 + dh);
        ctx.rotate((b.t === 'mirkan' ? 0.06 : 0.22) * (b.facing < 0 ? 1 : -1));
        ctx.translate(-dw / 2, -dh);
        dx0 = 0; dy0 = 0;
      }
      ctx.translate(dx0 + (b.facing < 0 ? dw : 0), dy0);
      ctx.scale(b.facing < 0 ? -sc : sc, sc);
      // Erfan im Samowar-Rausch: der Samowar auf dem Ruecken, hinter ihm
      if (b.look === 'samowar') P.draw(ctx, 'samowar_ruecken', -5, 12, false);
      // Mirkan sitzt sichtbar am Steuer (Verdeck unten): Kopf zuerst,
      // der Wagen darueber
      if (b.t === 'mirkan') {
        var bump = (b.state === 'charge' || b.state === 'drift' || b.state === 'nitro' || b.state === 'rueckwaerts') ? 1 : 0;
        var kopf = sp.kopf || [15, -5];
        if (glow) P.drawTint(ctx, 'mirkan_head', kopf[0], kopf[1] - 1 + bump, b.rageCol);
        P.draw(ctx, 'mirkan_head', kopf[0], kopf[1] + bump, false);
      }
      if (glow || b.state === 'transform') drawAura(sn, b.rageCol);
      if (b.flash > 0 && (G.tick >> 1) % 2 === 0) P.drawWhite(ctx, sn, 0, 0, false);
      else P.draw(ctx, sn, 0, 0, false);
      ctx.restore();

      // Erfan als Koenig: der fliegende Teppich unter den Fuessen
      if (b.t === 'erfan' && !b.dead && (b.schwebt || (b.teppichH || 0) > 0)) drawTeppich(b, camX, camY);
      // Lennart: Langhantel beim Kreuzheben, Shaker beim Trinken
      if (b.t === 'lennart' && !b.dead) {
        if (b.state === 'kreuzprep' || b.state === 'kreuzheben') drawLanghantel(b, camX, camY);
        if (b.state === 'shake') {
          P.draw(ctx, 'shaker', Math.round(px + b.facing * b.w * 0.42 - 5), Math.round(b.y - camY + b.h * 0.18 + ((G.tick >> 3) % 2)));
        }
      }
      // Mirkan: Rueckfahrlicht (es piept), und betaeubt qualmt die Haube
      if (b.t === 'mirkan' && !b.dead) {
        if ((b.state === 'rueckprep' || b.state === 'rueckwaerts') && (G.tick >> 2) % 2 === 0) {
          var hx2 = b.facing > 0 ? b.x - camX - 1 : b.x + b.w - camX - 3;
          rect(Math.round(hx2), Math.round(b.y + b.h - camY - 14), 4, 4, '#ffffff');
          if (LI) LI.glow(ctx, hx2 + 2, b.y + b.h - camY - 12, 14, '#ffffff', 0.5);
        }
        if (b.state === 'betaeubt' && G.tick % 4 === 0) {
          G.particles.spawn({ x: b.cx() + b.facing * b.w * 0.3 + (Math.random() - 0.5) * 10, y: b.y + 4,
                              vx: (Math.random() - 0.5) * 0.5, vy: -0.9, life: 34, col: '#8e8880', size: 4, grav: -0.02 });
        }
      }

      // Erfan: Goldstaub (Koenig) bzw. Safranfaeden (Safran-Koenig)
      if (b.t === 'erfan' && b.look && !b.dead && G.tick % 5 === 0) {
        var safr = b.look === 'safrankoenig';
        G.particles.spawn({
          x: b.cx() + (Math.random() - 0.5) * b.w,
          y: b.y + 2, vx: (Math.random() - 0.5) * 0.4, vy: -0.7 - Math.random() * 0.5,
          life: 24, col: safr ? ((G.tick % 10) ? '#ffb000' : '#ff3a1a') : ((G.tick % 10) ? '#ffd21a' : '#c86aff'),
          size: 2, grav: -0.01
        });
      }
      // Tuning: Flammen aus dem Auspuff — mit Nitro (letztes Herz) blau
      if (b.t === 'mirkan' && glow && G.tick % 2 === 0) {
        var nitro = b.phase >= 3;
        G.particles.spawn({
          x: b.cx() - b.facing * (b.w / 2 + 2), y: b.y + b.h - 8,
          vx: -b.facing * (1.5 + Math.random()) * (nitro ? 1.6 : 1), vy: -0.3, life: nitro ? 18 : 14,
          col: nitro ? ((G.tick % 4) ? '#4ad8ff' : '#ffffff') : ((G.tick % 4) ? '#ff8a2a' : '#ffd257'),
          size: nitro ? 4 : 3, grav: -0.02
        });
      }

      if (!b.dead && BOSS_WARN[b.state] && (G.tick >> 2) % 2 === 0) {
        F.draw(ctx, '!', px, dy0 - 16, { color: '#ff6a6a', align: 'center', scale: 2 });
      }
      if (!b.dead && b.state === 'pushups') {
        F.draw(ctx, 'LIEGESTÜTZE', px, dy0 - 14,
               { color: '#ffd257', align: 'center', shadow: true });
      }
      return;
    }

    // Hamza: immer mit dem Ball am Fuss
    if (G.lvl.bossType === 'hamza') {
      var hp2 = 'idle', hf = 'normal';
      if (b.dead || b.state === 'betaeubt') { hp2 = 'hurt'; hf = 'hurt'; }
      else if (b.state === 'transform' || b.state === 'spott') { hp2 = 'cheer'; hf = b.state === 'spott' ? 'laugh' : 'rage'; }
      else if (b.state === 'dribbel' || b.state === 'walk') { hp2 = 'run'; hf = b.state === 'dribbel' ? 'rage' : 'normal'; }
      else if (!b.grounded) hp2 = b.vy < 0 ? 'jump' : 'fall';
      else if (b.state === 'humus' || b.state === 'humusregen' || b.state === 'hhc') { hp2 = 'cheer'; hf = 'laugh'; }
      else if (b.state === 'kick') hp2 = 'run';
      if (b.flash > 0) hf = 'hurt';
      else if (b.rage && !b.dead && hf === 'normal') hf = 'rage';
      var ho = { pose: hp2, face: hf, frame: b.anim, flip: b.facing < 0, scale: 2 };
      if (glow || b.state === 'transform') drawCharAura('hamza', px, py, ho, b.rageCol);
      if (b.dead) ho.alpha = Math.max(0.2, 1 - b.deadTimer / 160);
      if (b.flash > 0 && (G.tick >> 1) % 2 === 0) { ho.flash = '#ffffff'; ho.flashAlpha = 0.8; }
      if (b.invuln > 0 && b.state !== 'transform' && (G.tick >> 1) % 2 === 0 && !b.dead) ho.alpha = 0.55;
      P.drawChar(ctx, 'hamza', px, py, ho);
      if (!b.dead && b.ballAtFeet) P.draw(ctx, 'ball', px + (b.facing < 0 ? -20 : 10), py - 10);
      if (!b.dead && b.state === 'hhc' && b.timer > 16) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#8ae07a';
        ctx.beginPath(); ctx.arc(px + b.facing * 18, py - 34, 5 + (G.tick % 6), 0, 6.3); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (!b.dead && BOSS_WARN[b.state] && (G.tick >> 2) % 2 === 0) {
        F.draw(ctx, '!', px, py - b.h - 12, { color: '#ff6a6a', align: 'center', scale: 2 });
      }
      return;
    }

    // Georgios: erst im Hemd, ab der Haelfte Spartaner mit Helm, Schild und Speer
    if (G.lvl.bossType === 'georgios') {
      var gp = 'idle', gf = 'normal';
      if (b.dead || b.state === 'betaeubt') { gp = 'hurt'; gf = 'hurt'; }
      else if (b.state === 'transform') { gp = 'cheer'; gf = 'rage'; }
      else if (b.state === 'spott') { gp = 'cheer'; gf = 'laugh'; }
      else if (b.state === 'schild') { gp = 'guard'; gf = 'rage'; }
      else if (b.sparta && b.punchT > 0) { gp = 'punch'; gf = 'rage'; }
      else if (b.state === 'dash' || b.state === 'sirtaki' || b.state === 'walk' || b.state === 'tritt') {
        gp = 'run'; gf = b.state === 'walk' ? 'normal' : 'laugh';
      }
      else if (!b.grounded) gp = b.vy < 0 ? 'jump' : 'fall';
      else if (b.state === 'speerprep' || b.state === 'phalanx' || b.state === 'pferd') { gp = 'cheer'; gf = 'rage'; }
      else if (b.sparta) gp = 'guard';
      else if (b.state === 'teller' || b.state === 'oliven') { gp = 'cheer'; gf = 'laugh'; }
      if (b.flash > 0) gf = 'hurt';
      else if (b.rage && !b.dead && gf === 'normal') gf = 'rage';
      var gwho = b.sparta ? 'georgios_sparta' : 'georgios';
      var gflip = b.state === 'sirtaki' ? ((G.tick >> 2) % 2 === 0) : b.facing < 0;
      var go = { pose: gp, face: gf, frame: b.anim, scale: 2, flip: gflip };
      var gdir = gflip ? -1 : 1;
      if (b.sparta && !b.dead) {
        // Roter Umhang hinter ihm, weht beim Laufen
        var weh = Math.sin(G.tick * 0.2) * 3 + (Math.abs(b.vx) > 1 ? 6 : 0);
        ctx.fillStyle = '#a81c1c';
        ctx.beginPath();
        ctx.moveTo(px - gdir * 6, py - 50);
        ctx.lineTo(px + gdir * 8, py - 50);
        ctx.lineTo(px - gdir * (14 + weh), py - 6);
        ctx.lineTo(px - gdir * (26 + weh), py - 10);
        ctx.closePath(); ctx.fill();
        // Der Speer, aufrecht in der hinteren Hand (nicht, wenn er gerade fliegt)
        if (b.state !== 'speerwurf') {
          rect(px - gdir * 12 - 1, py - 78, 2, 70, '#8a5a2a');
          rect(px - gdir * 12 - 2, py - 84, 4, 7, '#f0c860');
        }
      }
      if (glow || b.state === 'transform') drawCharAura(gwho, px, py, go, b.rageCol);
      if (b.dead) go.alpha = Math.max(0.2, 1 - b.deadTimer / 160);
      if (b.flash > 0 && (G.tick >> 1) % 2 === 0) { go.flash = '#ffffff'; go.flashAlpha = 0.8; }
      if (b.invuln > 0 && b.state !== 'transform' && (G.tick >> 1) % 2 === 0 && !b.dead) go.alpha = 0.55;
      P.drawChar(ctx, gwho, px, py, go);
      if (b.sparta && !b.dead) {
        // Rundschild mit Lambda vor dem Bauch
        var sx = px + gdir * (b.punchT > 0 ? 18 : 10), sy = py - (b.state === 'schild' ? 52 : 30);
        ctx.fillStyle = '#5a3a10';
        ctx.beginPath(); ctx.arc(sx, sy, 14, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#d8a040';
        ctx.beginPath(); ctx.arc(sx, sy, 12, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#f0c860';
        ctx.beginPath(); ctx.arc(sx - 3, sy - 3, 5, 0, 6.3); ctx.fill();
        ctx.strokeStyle = '#a81c1c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx - 6, sy + 7); ctx.lineTo(sx, sy - 7); ctx.lineTo(sx + 6, sy + 7); ctx.stroke();
      }
      if (!b.dead && BOSS_WARN[b.state] && (G.tick >> 2) % 2 === 0) {
        F.draw(ctx, '!', px, py - b.h - 20, { color: '#ff6a6a', align: 'center', scale: 2 });
      }
      return;
    }

    // Broke: so schnell, dass er Nachbilder hinterlaesst
    if (G.lvl.bossType === 'broke') {
      var bp = 'idle', bf = 'normal';
      if (b.dead || b.state === 'betaeubt') { bp = 'hurt'; bf = 'hurt'; }
      else if (b.state === 'transform') { bp = 'cheer'; bf = 'rage'; }
      else if (b.state === 'spott' || b.state === 'turm' || b.state === 'turmbau') { bp = 'cheer'; bf = 'laugh'; }
      else if (b.state === 'dash' || b.state === 'blitz' || b.state === 'walk') {
        bp = 'run'; bf = b.state === 'walk' ? 'normal' : 'rage';
      }
      else if (b.state === 'mikas' || b.state === 'ansturm') { bp = 'cheer'; bf = 'laugh'; }
      else if (!b.grounded) bp = b.vy < 0 ? 'jump' : 'fall';
      if (b.flash > 0) bf = 'hurt';
      else if (b.rage && !b.dead && bf === 'normal') bf = 'rage';

      // Der Mika-Turm: drei Mikas uebereinander, sie wackeln
      if (b.turmH > 0 && !b.dead) {
        for (var mk = 0; mk * 16 < b.turmH; mk++) {
          var wack = Math.round(Math.sin(G.tick * 0.2 + mk) * (mk + 1) * 0.6);
          P.draw(ctx, (G.tick >> 3) % 2 ? 'mika' : 'mika2', Math.round(b.cx() - camX - 5 + wack),
                 Math.round(b.floorRow * 16 - camY - 16 - mk * 16), mk % 2 === 1);
        }
        if ((G.tick >> 4) % 2 === 0 && b.state === 'turm') {
          F.draw(ctx, 'ANREMPELN!', px, b.floorRow * 16 - camY + 4, { color: '#9ad0ff', align: 'center', shadow: true });
        }
      }
      var trailCol = b.rage ? b.rageCol : '#9ad0ff';
      for (var ti = 0; ti < b.trail.length; ti++) {
        var tr = b.trail[ti];
        P.drawChar(ctx, 'broke', tr.x - camX, tr.y - camY, {
          pose: 'run', frame: tr.a, flip: tr.f < 0, scale: 2,
          flash: trailCol, flashAlpha: 1, alpha: 0.12 + 0.3 * (ti + 1) / b.trail.length
        });
      }
      var bo = { pose: bp, face: bf, frame: b.anim, flip: b.facing < 0, scale: 2 };
      if (glow || b.state === 'transform') drawCharAura('broke', px, py, bo, b.rageCol);
      if (b.dead) bo.alpha = Math.max(0.2, 1 - b.deadTimer / 160);
      if (b.flash > 0 && (G.tick >> 1) % 2 === 0) { bo.flash = '#ffffff'; bo.flashAlpha = 0.8; }
      if (b.invuln > 0 && b.state !== 'transform' && (G.tick >> 1) % 2 === 0 && !b.dead) {
        bo.alpha = 0.55;
      }
      P.drawChar(ctx, 'broke', px, py, bo);
      if (!b.dead && BOSS_WARN[b.state] && (G.tick >> 2) % 2 === 0) {
        F.draw(ctx, '!', px, py - b.h - 12, { color: '#ff6a6a', align: 'center', scale: 2 });
      }
      return;
    }

    // Alex: klettert auf die Regale und hat immer eine Flasche dabei
    if (G.lvl.bossType === 'alex') {
      var ap = 'idle', af = 'normal';
      if (b.dead || b.state === 'betaeubt') { ap = 'hurt'; af = 'hurt'; }
      else if (b.state === 'transform') { ap = 'cheer'; af = 'rage'; }
      else if (b.state === 'dash' || b.state === 'runter' || b.state === 'torkelsturm') { ap = 'run'; af = 'rage'; }
      else if (b.state === 'kotzfontaene' || b.state === 'flaschenhagel' || b.state === 'spott') { ap = 'cheer'; af = 'drunk'; }
      else if (b.state === 'stotter') { ap = 'cheer'; af = 'rage'; }
      else if (b.state === 'walk') ap = 'run';
      else if (!b.grounded) ap = b.vy < 0 ? 'jump' : 'fall';
      else if (b.state === 'trinken' || b.sip > 0) ap = 'cheer';
      if (b.flash > 0) af = 'hurt';
      else if (b.rage && !b.dead && af === 'normal') af = 'drunk';

      var ao = { pose: ap, face: af, frame: b.anim, flip: b.facing < 0,
                 scale: b.rage ? 3 : 2 };
      // Der zweite Alex. Sieht fast gleich aus, macht aber nichts.
      if (b.schatten) {
        P.drawChar(ctx, 'alex', b.schatten.x + b.w / 2 - camX, b.schatten.y + b.h - camY, {
          pose: ap, face: af, frame: b.anim, flip: b.schatten.f < 0,
          scale: b.rage ? 3 : 2, alpha: 0.82, flash: '#6a8ad8', flashAlpha: 0.16
        });
      }
      if (glow || b.state === 'transform') drawCharAura('alex', px, py, ao, b.rageCol);
      if (b.dead) ao.alpha = Math.max(0.2, 1 - b.deadTimer / 160);
      if (b.flash > 0 && (G.tick >> 1) % 2 === 0) { ao.flash = '#ffffff'; ao.flashAlpha = 0.8; }
      if (b.invuln > 0 && b.state !== 'transform' && (G.tick >> 1) % 2 === 0 && !b.dead) {
        ao.alpha = 0.55;
      }
      P.drawChar(ctx, 'alex', px, py, ao);

      // Die Flasche in der Hand
      if (!b.dead && (b.sip > 0 || b.state === 'trinken' || b.state === 'wodka' || b.state === 'flaschenhagel')) {
        P.draw(ctx, b.state === 'trinken' ? 'bier' : (b.state === 'flaschenhagel' ? 'bierflasche' : 'wodka'),
               px + (b.facing < 0 ? -20 : 10), py - b.h * 0.78);
      }
      if (!b.dead && BOSS_WARN[b.state] && (G.tick >> 2) % 2 === 0) {
        F.draw(ctx, '!', px, py - b.h - 12, { color: '#ff6a6a', align: 'center', scale: 2 });
      }
      return;
    }

    // Esat hat eigene Zustaende
    if (G.lvl.bossType === 'esat') {
      var ep = 'idle', ef = 'normal';
      if (b.dead || b.state === 'betaeubt') { ep = 'hurt'; ef = 'hurt'; }
      else if (b.state === 'transform') { ep = 'cheer'; ef = 'rage'; }
      else if (b.state === 'konter') { ep = 'guard'; ef = 'laugh'; }
      else if (b.state === 'kohle' || b.state === 'spott') { ep = 'cheer'; ef = 'laugh'; }
      else if (b.state === 'dash') { ep = 'run'; ef = 'rage'; }
      else if (b.state === 'walk') ep = 'run';
      else if (!b.grounded) ep = b.vy < 0 ? 'jump' : 'fall';
      else if (b.state === 'shisha' || b.state === 'agents' || b.state === 'jets') {
        ep = 'cheer'; ef = 'laugh';
      }
      if (b.flash > 0) ef = 'hurt';
      else if (b.rage && !b.dead && ef === 'normal') ef = 'rage';

      var who = b.buff ? 'esat_buff' : 'esat';
      var eo = { pose: ep, face: ef, frame: b.anim, flip: b.facing < 0, scale: b.buff ? 3 : 2 };
      if (glow || b.state === 'transform') drawCharAura(who, px, py, eo, b.rageCol);
      if (b.dead) eo.alpha = Math.max(0.2, 1 - b.deadTimer / 160);
      if (b.flash > 0 && (G.tick >> 1) % 2 === 0) {
        eo.flash = '#ffffff'; eo.flashAlpha = 0.8;
      }
      if (b.invuln > 0 && b.state !== 'transform' && (G.tick >> 1) % 2 === 0 && !b.dead) {
        eo.alpha = 0.55;
      }
      P.drawChar(ctx, who, px, py, eo);
      // Bluescreen: der Laptop ueber seinem Kopf ist blau
      if (b.state === 'betaeubt' && b.bluescreen) {
        var lx = px - 14, ly = py - b.h - 34;
        rect(lx - 2, ly - 2, 32, 22, '#141418');
        rect(lx, ly, 28, 18, '#2a5ad8');
        F.draw(ctx, ':(', lx + 4, ly + 4, { color: '#ffffff' });
      }

      // Die Snus-Dose in der Hand, solange er sich verwandelt
      if (b.state === 'transform' && b.timer > 60) {
        var sx = px + (b.facing < 0 ? -18 : 12), sy = py - 60;
        rect(sx, sy, 10, 5, '#1c6a8a');
        rect(sx, sy, 10, 1, '#6fc8e8');
        rect(sx + 3, sy + 2, 4, 1, '#ffffff');
      }
      if (!b.dead && BOSS_WARN[b.state] && (G.tick >> 2) % 2 === 0) {
        F.draw(ctx, '!', px, py - b.h - 12, { color: '#ff6a6a', align: 'center', scale: 2 });
      }
      return;
    }

    var pose = 'idle', face = 'normal', frame = b.anim;
    var MT = b.look === 'muaythai', st = b.state;

    if (b.dead) pose = 'hurt';
    else if (st === 'transform') { pose = 'cheer'; face = 'laugh'; }
    else if (st === 'betaeubt') { pose = 'hurt'; face = 'hurt'; }
    else if (st === 'pushups' || st === 'strafe' || st === 'liegewelle') { pose = 'duck'; face = 'laugh'; frame = (G.tick >> 3); }
    else if (st === 'waikru') { pose = (G.tick >> 4) % 2 ? 'cheer' : 'guard'; face = 'normal'; }
    else if (st === 'teep' || st === 'lowkick') { pose = 'kick'; face = 'rage'; }
    else if (st === 'knie' || st === 'knieprep') { pose = b.grounded && st === 'knieprep' ? 'guard' : 'knee'; face = 'rage'; }
    else if (st === 'jab' || st === 'cross') { pose = b.punchT > 0 ? 'punch' : 'guard'; face = 'rage'; }
    else if (MT && (st === 'idle' || st === 'stance' || /prep$/.test(st) || st === 'knieende')) pose = 'guard';
    else if (st === 'dash') { pose = 'run'; face = 'laugh'; }
    else if (st === 'walk') pose = 'run';
    else if (!b.grounded) pose = b.vy < 0 ? 'jump' : 'fall';
    else if (st === 'throw' || st === 'shake' || st === 'flex' || st === 'spott') { pose = 'cheer'; face = 'laugh'; }
    if (b.flash > 0) face = 'hurt';
    else if (b.rage && !b.dead && face === 'normal') face = 'laugh';

    var hwho = MT ? 'huseyin_muaythai' : (b.look === 'sixpack' ? 'huseyin_sixpack' : 'huseyin');
    var opts = {
      pose: pose, face: face, frame: frame,
      flip: b.facing < 0,
      scale: 2
    };
    if (glow || b.state === 'transform') drawCharAura(hwho, px, py, opts, b.rageCol);
    if (b.dead) opts.alpha = Math.max(0.2, 1 - b.deadTimer / 160);
    if (b.flash > 0 && (G.tick >> 1) % 2 === 0) {
      opts.flash = '#ffffff'; opts.flashAlpha = 0.8;
    }
    if (b.invuln > 0 && b.state !== 'transform' && (G.tick >> 1) % 2 === 0 && !b.dead) {
      opts.alpha = 0.55;
    }
    P.drawChar(ctx, hwho, px, py, opts);
    if (!b.dead && BOSS_WARN[b.state] && (G.tick >> 2) % 2 === 0) {
      F.draw(ctx, '!', px, py - b.h - 12, { color: '#ff6a6a', align: 'center', scale: 2 });
    }
  }

  // Funken in diesen Farben leuchten (Honig, Gold, Glut, Leuchtspur)
  var LEUCHTEN = { '#ffe38a': 1, '#ffd257': 1, '#ffc23c': 1, '#ff8a2a': 1, '#ffb43c': 1, '#fff0a0': 1,
                   '#ffcf4a': 1, '#c8ff6a': 1, '#8ae0ff': 1, '#ffe9a8': 1 };
  function drawParticles(camX, camY) {
    var l = G.particles.list, hell = LI && LI.stufe() >= 1;
    for (var i = 0; i < l.length; i++) {
      var p = l[i];
      var a = Math.min(1, p.life / (p.max * 0.6));
      ctx.globalAlpha = a;
      if (p.text) {
        F.draw(ctx, p.text, p.x - camX, p.y - camY, { color: p.col });
      } else {
        var s = p.shrink ? Math.max(1, Math.round(p.size * a)) : p.size;
        if (hell && LEUCHTEN[p.col]) LI.glow(ctx, p.x - camX, p.y - camY, s * 3.2, p.col, 0.4);
        rect(p.x - camX - s / 2, p.y - camY - s / 2, s, s, p.col);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFloats(camX, camY) {
    var l = G.floats.list;
    for (var i = 0; i < l.length; i++) {
      var f = l[i];
      if (!f.text) continue;
      ctx.globalAlpha = Math.min(1, f.life / 22);
      F.draw(ctx, f.text, f.x - camX, f.y - camY,
             { color: f.col, align: 'center', shadow: true });
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- HUD ---------- */

  function drawHUD() {
    var p = G.player;
    // Weicher Schatten hinter der Anzeige: lesbar auch vor hellem Himmel,
    // Sonne und Lichtschein (die Ebenen machen den Hintergrund heller)
    if (LI) {
      var smH = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.38;
      ctx.drawImage(LI.glowBild('#06040c', true), -80, -70, 300, 190);
      ctx.drawImage(LI.glowBild('#06040c', true), W - 190, -60, 270, 160);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = smH;
    }
    // Herzen
    for (var i = 0; i < p.maxHp; i++) {
      var hx = 8 + i * 13, hy = 8;
      if (i < p.hp) P.draw(ctx, 'herz', hx, hy);
      else {
        ctx.globalAlpha = 0.28;
        P.draw(ctx, 'herz', hx, hy);
        ctx.globalAlpha = 1;
      }
    }

    // Honig, daneben der Goldhonig dieses Levels
    P.draw(ctx, 'honig', 8, 24);
    var hTxt = 'x' + p.honey;
    F.draw(ctx, hTxt, 24, 29, { color: '#ffe9a8', shadow: true });
    if (G.goldIdx && G.goldIdx.length) {
      var gx = 24 + F.measure(hTxt, 1, 1) + 10;
      P.draw(ctx, 'goldhonig', gx, 24);
      F.draw(ctx, G.goldCount() + '/' + G.goldIdx.length, gx + 16, 29,
             { color: '#fff0a0', shadow: true });
    }

    // Leben
    F.draw(ctx, 'YUSUF x' + Math.max(0, p.lives), 8, 44, { color: '#f4bd91', shadow: true });

    if (G.lvl.bike) {
      // Level 12: wie viele Saltos er schon gestanden hat
      F.draw(ctx, 'SALTOS ' + (p.flipCount || 0), 8, 58, { color: '#ffd257', shadow: true });
    } else {
      // Puste fuer die Arschbombe. Leer = kein Stampfer.
      var sw = 60, sf = Math.round(sw * Math.max(0, p.stamina) / p.stamMax);
      var voll = (p.stamina >= 42);
      rect(8, 58, sw, 6, 'rgba(6,4,10,0.6)');
      rect(8, 58, sf, 6, (p.pustT > 0 && (G.tick >> 2) % 2 === 0) ? '#ff6a6a'
                        : (voll ? '#8cd85a' : '#ffc23c'));
      rect(8, 58, sf, 2, 'rgba(255,255,255,0.3)');
      F.draw(ctx, 'BAUCH', 72, 58, { color: voll ? '#c8b8e0' : '#8f86a8', shadow: true });
    }

    // Level 21: wie viele BBs noch im Magazin sind
    if (G.lvl.airsoft) {
      rect(8, 70, 60, 6, 'rgba(6,4,10,0.6)');
      if (p.reload > 0) {
        rect(8, 70, Math.round(60 * (1 - p.reload / 70)), 6, '#c8c0d8');
        if ((G.tick >> 3) % 2 === 0) F.draw(ctx, 'NACHLADEN', 72, 70, { color: '#c8c0d8', shadow: true });
      } else {
        for (var mb = 0; mb < p.mag; mb++) rect(8 + mb * 2, 70, 1, 6, p.mag <= 6 ? '#ff8a8a' : '#c8ff6a');
        F.draw(ctx, 'BBS ' + p.mag, 72, 70, { color: p.mag <= 6 ? '#ff8a8a' : '#c8ff6a', shadow: true });
      }
    }

    // Nach Hamzas HHC-Welle
    if (G.dizzy > 0) {
      F.draw(ctx, 'HHC: ALLES DREHT SICH', 8 + Math.sin(G.tick * 0.12) * 2, 70,
             { color: '#8ae07a', shadow: true });
    }

    // Nach Alex' Dusche: wie viel Yusuf intus hat
    if (G.drunk) {
      F.draw(ctx, 'PROMILLE 1,4', 8 + Math.sin(G.tick * 0.12) * 2, 70,
             { color: '#ff8a2a', shadow: true });
    }

    // Punkte + Zeit. Am Handy liegen oben rechts Pause und Vollbild.
    var rx = G.touch ? W - 58 : W - 8;
    F.draw(ctx, 'PUNKTE ' + p.score, rx, 8, { color: '#ffe9a8', align: 'right', shadow: true });
    var sec = Math.floor(G.time / 60);
    F.draw(ctx, 'ZEIT ' + Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2),
           rx, 20, { color: '#d8cfe8', align: 'right', shadow: true });
    if (global.Spass) global.Spass.hud(ctx, G, rx, 32);

    // Gold-Döner-Balken
    if (p.power > 0) {
      var bw = 70, pw = Math.round(bw * p.power / 560);
      rect(rx - bw, 46, bw, 6, 'rgba(0,0,0,0.5)');
      rect(rx - bw, 46, pw, 6, '#ffd257');
      F.draw(ctx, 'GOLD-DÖNER', rx - bw - 4, 46, { color: '#ffd257', align: 'right' });
    }

    // Bosslebensbalken
    if (G.boss && !G.boss.dead && G.bossStarted) {
      var bt2 = G.lvl.bossType;
      var isE = (bt2 === 'esat');
      var mini = E.MINIBOSS[bt2];
      // Zwei Zeilen, nichts uebereinander: oben Name, Form und Herzen,
      // darunter der Balken ohne Schrift. Am PC ganz unten, am Handy oben
      // (unten liegen dort die Knoepfe).
      var w2 = G.touch ? 190 : 250, x2 = Math.round((W - w2) / 2);
      var zeile = G.touch ? 5 : H - 28;          // Textzeile
      var by2 = zeile + 12, bh2 = G.touch ? 7 : 9; // Balken
      var isA = (bt2 === 'alex');
      var barCol = G.boss.rage ? G.boss.rageCol
        : (G.boss.barCol || (mini ? mini.col : (isE ? '#6fc8e8' : (isA ? '#c9a05a' : '#5ec24a'))));
      if (G.touch) rect(x2 - 6, 2, w2 + 12, by2 + bh2 + 3, 'rgba(8,5,12,0.78)');
      else {
        rect(0, zeile - 4, W, H - zeile + 4, 'rgba(8,5,12,0.8)');
        rect(0, zeile - 4, W, 1, barCol);
      }
      // Balken: Rahmen, Fuellung, Glanzkante. In der letzten Form pulsiert
      // nur die Glanzkante — kein weisses Blinken mehr.
      rect(x2 - 1, by2 - 1, w2 + 2, bh2 + 2, '#06040a');
      rect(x2, by2, w2, bh2, '#241830');
      var hw = Math.round(w2 * Math.max(0, G.boss.hp) / G.boss.maxHp);
      rect(x2, by2, hw, bh2, barCol);
      var glanz = (G.boss.rage && G.boss.phase >= 3 && (G.tick >> 3) % 2 === 0) ? 0.7 : 0.35;
      rect(x2, by2, hw, 2, 'rgba(255,255,255,' + glanz + ')');

      // Herzen rechts oben (bei jedem Boss gleich, Semih eins pro Form)
      var hz = P.get('herz'), herzW = 0;
      if (G.boss.lebenMax) {
        herzW = G.boss.lebenMax * (hz.w + 1) - 1;
        for (var lb = 0; lb < G.boss.lebenMax; lb++) {
          ctx.globalAlpha = lb < G.boss.leben ? 1 : 0.25;
          P.draw(ctx, 'herz', x2 + w2 - herzW + lb * (hz.w + 1), zeile - 2);
          ctx.globalAlpha = 1;
        }
      } else if (!G.boss.rage) rect(x2 + Math.floor(w2 / 2), by2, 1, bh2, 'rgba(255,255,255,0.6)');

      var bname = G.boss.barName ||
                  (mini ? mini.name : (isE ? 'ESAT' : (isA ? 'ALEX' : 'HUSEYIN BALCI')));
      F.draw(ctx, bname, x2, zeile, { color: '#ffffff', shadow: true });
      var lbl = G.boss.rage ? G.boss.rageName : (G.boss.lebenMax ? (bt2 === 'hamza' ? '1. HALBZEIT' : '1. HERZ') : 'PH 1');
      var lblCol = G.boss.rage ? G.boss.rageCol : '#c8b8e0';
      F.draw(ctx, lbl, x2 + w2 - herzW - (herzW ? 6 : 0), zeile, { color: lblCol, align: 'right', shadow: true });
      // Offenes Fenster sichtbar machen — der Kampf soll lesbar sein
      // Betaeubt (der Trick hat geklappt): jetzt draufspringen, mehrmals
      var betaeubt = G.boss.state === 'betaeubt';
      if ((G.boss.open || betaeubt) && !G.boss.dead && (G.tick >> (betaeubt ? 2 : 3)) % 2 === 0) {
        var oTxt = betaeubt ? 'BETÄUBT!' : 'OFFEN', oCol = betaeubt ? '#ffffff' : '#ffd257';
        if (G.touch) F.draw(ctx, oTxt, x2 + w2, by2 + bh2 + 3, { color: oCol, align: 'right', shadow: true });
        else F.draw(ctx, oTxt, x2 - 6, by2 + 1, { color: oCol, align: 'right' });
      }
    }
  }

  function drawBanner() {
    var a = Math.min(1, G.banner / 40);
    ctx.globalAlpha = a;
    // Fast deckend: sonst schimmern Hinweistexte des Levels durch und
    // stehen unleserlich uebereinander
    ctx.fillStyle = 'rgba(12,8,18,0.94)';
    ctx.fillRect(0, 96, W, 62);
    rect(0, 96, W, 2, '#ffc23c');
    rect(0, 156, W, 2, '#ffc23c');
    F.draw(ctx, 'LEVEL ' + G.lvl.id, W / 2, 106, { color: '#ffd257', align: 'center', scale: 1 });
    F.draw(ctx, G.lvl.name, W / 2, 118, { color: '#ffffff', align: 'center', scale: 2, shadow: true });
    F.draw(ctx, G.lvl.sub, W / 2, 142, { color: '#c8b8e0', align: 'center' });
    ctx.globalAlpha = 1;
  }

  /* ---------- Dialog ---------- */

  var SPEAKER = {
    yusuf:   { name: 'YUSUF',   col: '#ffc23c' },
    huseyin: { name: 'HUSEYIN', col: '#cfd4e0' },
    erfan:   { name: 'ERFAN',   col: '#e8c24a' },
    esat:    { name: 'ESAT',    col: '#6fc8e8' },
    lennart: { name: 'LENNART', col: '#e8b894' },
    mirkan:  { name: 'MIRKAN',  col: '#b8c0d4' },
    alex:    { name: 'ALEX',    col: '#c9a05a' },
    broke:   { name: 'BROKE',   col: '#d8b07a' },
    mika:    { name: 'MIKA',    col: '#9ad0ff' },
    hamza:   { name: 'HAMZA',   col: '#ff6a6a' },
    georgios: { name: 'GEORGIOS', col: '#6a9ae8' },
    typ:     { name: 'TYP VOM NEBENTISCH', col: '#c8c0d8' },
    alexg:   { name: 'DER ANDERE ALEX', col: '#cdb88c' },
    nils:    { name: 'NILS', col: '#8ae0ff' },
    polizist: { name: 'POLIZIST', col: '#8ab4ff' },
    waerter: { name: 'WÄRTER', col: '#a8b8a8' },
    sonnet:  { name: 'SONNET',  col: '#c8d86a' },
    emre:    { name: 'EMRE',    col: '#f4f2ec' },
    felix:   { name: 'FELIX',   col: '#8ae07a' },
    kontrolle: { name: 'SICHERHEIT', col: '#8ab4ff' },
    balikci: { name: 'FISCHBROT-MANN', col: '#6ab0e0' },
    rezeption: { name: 'REZEPTION', col: '#e87a8a' },
    semih:   { name: 'SEMIH',   col: '#ff4a4a' },
    unbekannt: { name: '???',   col: '#ff4a4a' },
    leibwaechter: { name: 'SEMIHS MANN', col: '#c8ccd6' },
    anzug:   { name: 'MANN IM ANZUG', col: '#c8ccd6' }
  };

  function drawPortrait(who, x, y, talking) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.round(x), Math.round(y), 30, 30);
    ctx.clip();
    ctx.translate(Math.round(x), Math.round(y));
    if (who === 'huseyin') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'h_head_angry' : 'h_head', 0, 0, true);
    } else if (who === 'erfan') {
      ctx.scale(2, 2); P.draw(ctx, 'erfan', -1, 0);
    } else if (who === 'esat') {
      ctx.scale(2, 2); P.draw(ctx, talking ? 'e_head_grin' : 'e_head', -1, 0);
    } else if (who === 'lennart') {
      ctx.scale(2, 2); P.draw(ctx, talking ? 'lennart2' : 'lennart', -3, 0);
    } else if (who === 'mirkan') {
      ctx.scale(2, 2);
      P.draw(ctx, 'mirkan_head', 0, 1 + (talking ? 1 : 0));
    } else if (who === 'alex') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'a_head_angry' : 'a_head', 1, 1);
    } else if (who === 'broke') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'b_head_grin' : 'b_head', 1, 1);
    } else if (who === 'mika') {
      // Jeder Mika sieht gleich aus. Welcher gerade redet, weiss keiner.
      ctx.scale(2, 2);
      P.draw(ctx, 'mika', 2, 1 + (talking ? 1 : 0));
    } else if (who === 'hamza') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'ha_head_grin' : 'ha_head', 1, 1);
    } else if (who === 'georgios') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'ge_head_grin' : 'ge_head', 1, 1);
    } else if (who === 'alexg') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'ag_head_angry' : 'ag_head', 0, 1);
    } else if (who === 'nils') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'ni_head_grin' : 'ni_head', 0, 0);
    } else if (who === 'polizist') {
      ctx.scale(2, 2);
      P.draw(ctx, 'polizei', 0, 1 + (talking ? 1 : 0));
    } else if (who === 'waerter') {
      ctx.scale(2, 2);
      P.draw(ctx, 'waerter', 0, 1 + (talking ? 1 : 0));
    } else if (who === 'typ') {
      ctx.scale(2, 2);
      P.draw(ctx, 'typ1', 2, 1 + (talking ? 1 : 0));
    } else if (who === 'sonnet') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'so_head_grin' : 'so_head', 0, 1);
    } else if (who === 'emre') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'em_head_grin' : 'em_head', 0, 0);
    } else if (who === 'felix') {
      ctx.scale(2, 2);
      var dogg = G.boss && G.boss.dogg;
      P.draw(ctx, dogg ? (talking ? 'fd_head_grin' : 'fd_head') : (talking ? 'fe_head_grin' : 'fe_head'), 0, 0);
    } else if (who === 'kontrolle') {
      ctx.scale(2, 2);
      P.draw(ctx, 'security', 0, 1 + (talking ? 1 : 0));
    } else if (who === 'balikci') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'ba_head_grin' : 'ba_head', 0, 1);
    } else if (who === 'rezeption') {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'rz_head_grin' : 'rz_head', 0, 1);
    } else if (who === 'semih' && G.lvlIndex >= 28 && !(G.scene && G.scene.type === 'hotel')) {
      // Ab Level 29 sieht man sein Gesicht
      ctx.scale(2, 2);
      P.draw(ctx, G.boss && G.boss.wutForm && G.boss.wutForm() ? 'se_head_wut' : (talking ? 'se_head_grin' : 'se_head'), -1, 0);
    } else if (who === 'leibwaechter' || who === 'anzug') {
      ctx.scale(2, 2);
      P.draw(ctx, 'leibwaechter', 0, 1 + (talking ? 1 : 0));
    } else if (who === 'semih' || who === 'unbekannt') {
      // Semih: nur ein Schatten. Und zwei Augen.
      rect(0, 0, 30, 30, '#2a0a0e');
      ctx.fillStyle = '#140c10';
      ctx.beginPath(); ctx.arc(15, 13, 9, 0, 6.3); ctx.fill();
      rect(4, 22, 22, 8, '#140c10');
      rect(10, 12, 3, 1, '#fff6c8'); rect(17, 12, 3, 1, '#fff6c8');
    } else {
      ctx.scale(2, 2);
      P.draw(ctx, talking ? 'y_head_laugh' : 'y_head', 0, 0);
    }
    ctx.restore();
  }

  /** Standbild mit Namen, schraeg im Bild — wie Lennarts Auftritt. */
  /** Titelkarte (Boss-Auftritt, Mutation, Ende der Demo): ein gerader
      Streifen quer durchs Bild, Kinobalken oben und unten. Frueher war der
      Streifen schraeg — gedrehte Pixelschrift zerfranst aber. */
  function drawKarte(text) {
    var teile = text.split('|'), t = G.dialogT || 0, k = Math.min(1, t / 10);
    var col = teile[2] || '#ff6fa8';
    ctx.fillStyle = 'rgba(8,5,12,' + (0.35 * k).toFixed(2) + ')';
    ctx.fillRect(0, 0, W, H);
    var kino = Math.round(26 * k);
    rect(0, 0, W, kino, '#000000');
    rect(0, H - kino, W, kino, '#000000');
    var mitte = Math.round(H / 2) - 6, hb = Math.round(32 * k);
    rect(0, mitte - hb, W, hb * 2, 'rgba(10,6,16,0.94)');
    if (k >= 1) {
      rect(0, mitte - hb, W, 2, col);
      rect(0, mitte + hb - 2, W, 2, col);
    }
    if (t > 6) {
      var sc = F.measure(teile[0], 4, 1) > W - 40 ? 3 : 4;
      // Der Name gleitet kurz von links herein
      var rein = Math.round(Math.max(0, 1 - (t - 6) / 8) * -30);
      F.draw(ctx, teile[0], W / 2 + rein, mitte - 5 - 7 * sc / 2 - 3,
             { color: '#ffffff', align: 'center', scale: sc, shadow: true, shadowColor: '#1a0f24' });
      F.draw(ctx, teile[1] || '', W / 2, mitte + 12, { color: '#e2dcef', align: 'center', shadow: true });
    }
    if (t >= 24 && (G.tick >> 3) % 2 === 0) {
      F.draw(ctx, '|', W - 24, H - 20, { color: '#ffd257' });
    }
  }

  /** Kapitelkarte: ein neuer Tag. Oben der Tag, darunter der Kalender —
      erledigte Tage abgehakt, verschlafene mit ZZZ. */
  function drawKapitel(id) {
    var kap = LV.kapitel[id], kal = LV.kalender || [];
    if (!kap) return;
    var t = G.dialogT || 0, i;
    ctx.fillStyle = 'rgba(6,4,10,' + (0.94 * Math.min(1, t / 14)).toFixed(2) + ')';
    ctx.fillRect(0, 0, W, H);
    if (t < 4) return;
    var cy = H / 2 - 56;
    ctx.globalAlpha = Math.min(1, (t - 4) / 10);
    F.draw(ctx, 'KAPITEL ' + id, W / 2, cy - 22, { color: '#8f86a8', align: 'center' });
    F.draw(ctx, kap.name, W / 2, cy - 8, { color: '#ffd257', align: 'center', scale: 3, shadow: true });
    F.draw(ctx, kap.zeit + ' - ' + (G.lvl ? G.lvl.name : ''), W / 2, cy + 22, { color: '#c8b8e0', align: 'center' });
    // Der Kalender: zwei Wochen, SA bis DI
    var bw = 30, gap = 4, luecke = 10, n = kal.length;
    var x0 = Math.round(W / 2 - (n * bw + (n - 1) * gap + luecke) / 2), y0 = cy + 44;
    for (i = 0; i < n; i++) {
      var d = kal[i], x = x0 + i * (bw + gap) + (i >= 7 ? luecke : 0);
      var heute = i === kap.tag, vorbei = i < kap.tag;
      ctx.globalAlpha = Math.max(0, Math.min(1, (t - 8 - i * 2) / 8));
      rect(x, y0, bw, 30, heute ? '#3a2a10' : '#14101c');
      ctx.strokeStyle = heute ? '#ffd257' : (vorbei ? '#4e4862' : '#2a2436');
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y0 + 0.5, bw - 1, 29);
      F.draw(ctx, d.k, x + bw / 2, y0 + 4, { color: heute ? '#ffd257' : (vorbei ? '#8f86a8' : '#4e4862'), align: 'center' });
      if (vorbei && d.zzz) {
        F.draw(ctx, 'ZZZ', x + bw / 2, y0 + 17, { color: '#6fc8e8', align: 'center' });
      } else if (vorbei) {
        // Abgehakt
        rect(x + 9, y0 + 19, 2, 2, '#8ae07a'); rect(x + 11, y0 + 21, 2, 2, '#8ae07a');
        rect(x + 13, y0 + 19, 2, 2, '#8ae07a'); rect(x + 15, y0 + 17, 2, 2, '#8ae07a');
        rect(x + 17, y0 + 15, 2, 2, '#8ae07a');
      } else if (heute && (G.tick >> 4) % 2 === 0) {
        rect(x + bw / 2 - 2, y0 + 18, 4, 4, '#ffd257');
      }
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, (t - 30) / 10));
    if (kap.zeile) F.draw(ctx, kap.zeile, W / 2, y0 + 44, { color: '#8f86a8', align: 'center' });
    ctx.globalAlpha = 1;
    if (t >= 40 && (G.tick >> 3) % 2 === 0) F.draw(ctx, '|', W - 24, H - 20, { color: '#ffd257' });
  }

  function drawDialog() {
    if (!G.dialog) return;
    var line = G.dialog[G.dialogIdx];
    var who = line[0], full = line[1];
    if (who === 'karte') { drawKarte(full); return; }
    if (who === 'kapitel') { drawKapitel(full); return; }
    var shown = full.substring(0, Math.floor(G.dialogChar));

    // Hintergrund abdunkeln: der Text soll lesbar sein und man soll
    // sofort sehen, dass das Spiel steht.
    ctx.fillStyle = 'rgba(6,4,10,0.55)';
    ctx.fillRect(0, 0, W, H);

    var bx = 16, by = H - 84, bw = W - 32, bh = 68;
    ctx.fillStyle = 'rgba(8,5,13,0.97)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = SPEAKER[who] ? SPEAKER[who].col : '#8f86a8';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    rect(bx + 3, by + 3, bw - 6, 1, 'rgba(255,255,255,0.10)');

    if ((G.tick >> 5) % 2 === 0) {
      F.draw(ctx, 'PAUSE', bx + bw - 8, by - 11,
             { color: '#6a6280', align: 'right' });
    }
    // Ueberspringen: Hinweis, und ein Balken, solange man haelt
    F.draw(ctx, G.touch ? 'A HALTEN = ÜBERSPRINGEN' : 'SPRUNG HALTEN = ÜBERSPRINGEN', bx + 2, by - 11,
           { color: '#4e4862' });
    if (G.dlgHold > 4) {
      rect(bx, by + bh + 2, bw, 3, 'rgba(255,255,255,0.12)');
      rect(bx, by + bh + 2, Math.round(bw * Math.min(1, G.dlgHold / DLG_SKIP)), 3, '#ffd257');
    }

    var tx = bx + 12;
    var sp = SPEAKER[who];
    if (sp) {
      drawPortrait(who, bx + 10, by + 8,
                   Math.floor(G.dialogChar) < full.length && (G.tick >> 2) % 2 === 0);
      tx = bx + 46;
      F.draw(ctx, sp.name, tx, by + 8, { color: sp.col, shadow: true });
    }

    var lines = F.wrap(shown, bw - (sp ? 64 : 28), 1, 1);
    for (var i = 0; i < lines.length && i < 4; i++) {
      F.draw(ctx, lines[i], tx, by + (sp ? 24 : 16) + i * 11, { color: '#ffffff' });
    }

    if (Math.floor(G.dialogChar) >= full.length && (G.tick >> 3) % 2 === 0) {
      F.draw(ctx, '|', bx + bw - 18, by + bh - 16, { color: '#ffd257' });
    }
  }

  /* ---------- Menüs / Overlays ---------- */

  function drawTitle() {
    // Hintergrund: Yusufs Zimmer bei Sonnenaufgang — mit allen Ebenen
    var tcx = G.tick * 0.28;
    hintergrund('zimmer', tcx, 0, 0, function () { drawSky('zimmer'); drawParallax('zimmer', tcx, 0); });
    if (EB) EB.hinten(ctx, G, 'zimmer', tcx, 0, W, H);

    // Boden
    for (var tx = 0; tx <= W / 16; tx++) {
      P.draw(ctx, SP.tileTop('zimmer'), tx * 16, 240);
      P.draw(ctx, SP.tileFill('zimmer'), tx * 16, 256);
      P.draw(ctx, SP.tileFill('zimmer'), tx * 16, 272);
    }

    // Yusuf & Hussein
    var f = (G.tick >> 3);
    P.drawChar(ctx, 'yusuf', 84, 240, { pose: 'idle', frame: f, face: (G.tick % 200 < 30) ? 'laugh' : 'normal' });
    P.drawChar(ctx, 'huseyin', 152, 240, { pose: 'idle', frame: f, flip: true, face: 'normal' });

    // schwebende Honiggläser
    for (var i = 0; i < 5; i++) {
      var hx = 40 + i * 108, hy = 126 + Math.sin(G.tick * 0.04 + i) * 8;
      if (LI) LI.glow(ctx, hx + 7, hy + 8, 22, '#ffb43c', 0.32);
      P.draw(ctx, 'honig', hx, hy);
    }

    // Logo
    F.draw(ctx, 'BALCI RUN', W / 2, 40, {
      color: '#ffd257', align: 'center', scale: 5, shadow: true,
      shadowColor: '#5e2a10', wave: G.tick * 0.055, waveAmp: 1
    });
    F.draw(ctx, 'YUSUFS HONIG-JAGD', W / 2, 92, {
      color: '#ffe9a8', align: 'center', scale: 2, shadow: true
    });
    if (global.BALCI_DEMO) {
      F.draw(ctx, 'DEMO', W / 2 + F.measure('BALCI RUN', 5, 1) / 2 + 32, 56,
             { color: '#ff6a6a', align: 'center', scale: 2, shadow: true });
    }
    // Vorne: Staub im Morgenlicht, Silhouetten, Bloom (das Logo glueht), Vignette.
    // Menue und Bestenliste kommen danach: die bleiben klar lesbar.
    if (EB) {
      EB.vorne(ctx, G, 'zimmer', tcx, 0, W, H, { ohneSpielfeld: true, ohneOben: true });
      EB.nachher(ctx, 'zimmer', canvas, W, H, { vignFaktor: 0.85 });
    }

    var items = menuItems();
    var top0 = titleMenuTop(items.length);
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var sel = (i === G.menuIdx);
      var y = top0 + i * 15;
      if (sel) {
        F.draw(ctx, '|', W / 2 - F.measure(it.label, 1, 1) / 2 - 14, y,
               { color: '#ffd257' });
      }
      F.draw(ctx, it.label, W / 2, y, {
        color: sel ? '#ffffff' : '#a094b8', align: 'center', shadow: true
      });
    }

    // Bestenliste ist beim Start immer sichtbar: die besten fuenf
    drawTitleBoard();

    ctx.fillStyle = 'rgba(10,6,16,0.72)';
    ctx.fillRect(0, H - 17, W, 17);
    F.draw(ctx, 'EIN SPIEL ÜBER HONIG, SCHLAF UND BRÜDERLICHE GEWALT',
           W / 2, H - 12, { color: '#c0b4d4', align: 'center' });
  }

  function drawTitleBoard() {
    var r = titleBoardRect();
    var b = boardList();
    var list = b.list.slice().sort(SCORE_CATS[0].cmp);
    ctx.fillStyle = 'rgba(10,6,16,0.96)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    rect(r.x, r.y, r.w, 1, '#ffc23c');
    F.draw(ctx, 'BESTENLISTE', r.x + 6, r.y + 5, { color: '#ffd257' });
    F.draw(ctx, b.global ? 'WELTWEIT' : 'LOKAL', r.x + r.w - 6, r.y + 5,
           { color: b.global ? '#6fc8e8' : '#6a6280', align: 'right' });
    if (!list.length) {
      F.draw(ctx, 'NOCH LEER.', r.x + 6, r.y + 30, { color: '#c8b8e0' });
      F.draw(ctx, 'SEI DER ERSTE!', r.x + 6, r.y + 42, { color: '#8f86a8' });
    }
    for (var i = 0; i < list.length && i < 5; i++) {
      var e = list[i], y = r.y + 20 + i * 14;
      var col = i === 0 ? '#ffe9a8' : '#ffffff';
      F.draw(ctx, (i + 1) + '.', r.x + 6, y, { color: '#8f86a8' });
      F.draw(ctx, e.n, r.x + 20, y, { color: col });
      F.draw(ctx, '' + e.s, r.x + r.w - 6, y, { color: col, align: 'right' });
    }
    if ((G.tick >> 5) % 2 === 0) {
      F.draw(ctx, G.touch ? 'ANTIPPEN = ALLE' : 'MENÜ: BESTENLISTE', r.x + r.w / 2, r.y + r.h - 9,
             { color: '#6a6280', align: 'center' });
    }
  }

  /** Schwierigkeitsgrad waehlen: drei Karten nebeneinander. */
  function drawSelect() {
    var scx = G.tick * 0.2;
    hintergrund('festung', scx, 0, 0, function () { drawSky('festung'); drawParallax('festung', scx, 0); });
    if (EB) EB.hinten(ctx, G, 'festung', scx, 0, W, H);
    ctx.fillStyle = 'rgba(8,5,12,0.66)';
    ctx.fillRect(0, 0, W, H);
    if (EB) {
      EB.vorne(ctx, G, 'festung', scx, 0, W, H, { ohneSpielfeld: true, ohneSilhouetten: true });
      if (LI) LI.vignette(ctx, W, H, 0.5);
    }

    F.draw(ctx, 'LEVEL WÄHLEN', W / 2, 24, {
      color: '#ffd257', align: 'center', scale: 3, shadow: true
    });

    // Karten passen sich der Breite an — bei 7 Leveln war die letzte
    // Karte vorher halb abgeschnitten. Ab elf Leveln: zwei Reihen.
    var sc = selectCards();
    var two = sc.rows > 1;
    // Wo was auf der Karte steht: bei zwei Reihen sind die Karten flacher
    var o = sc.rows > 2 ? { num: 4, ns: 2, zu: 24, frueh: 34, hon: 19, honT: 24, gold: 35, pts: 42, time: -1, neu: 28 }
          : two ? { num: 5, ns: 3, zu: 34, frueh: 46, hon: 27, honT: 32, gold: 43, pts: 52, time: 62, neu: 40 }
                : { num: 10, ns: 3, zu: 52, frueh: 64, hon: 44, honT: 49, gold: 62, pts: 76, time: 90, neu: 60 };
    for (var i = 0; i < sc.n; i++) {
      var unlocked = i < save.unlocked;
      var cr = cardRect(sc, i);
      var x = cr.x, y = cr.y, cw = cr.w, ch = cr.h;
      var sel = (i === G.selIdx);

      ctx.fillStyle = sel ? 'rgba(52,34,20,0.95)' : 'rgba(22,15,30,0.9)';
      ctx.fillRect(x, y + (sel ? -6 : 0), cw, ch);
      ctx.strokeStyle = !unlocked ? '#4a4258' : (sel ? '#ffd257' : '#6a5f80');
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1 + (sel ? -6 : 0), cw - 2, ch - 2);

      var yy = y + (sel ? -6 : 0);
      F.draw(ctx, '' + (i + 1), x + cw / 2, yy + o.num, {
        color: unlocked ? '#ffd257' : '#5d5470', align: 'center', scale: o.ns
      });

      if (!unlocked) {
        F.draw(ctx, 'ZU', x + cw / 2, yy + o.zu, { color: '#5d5470', align: 'center' });
        F.draw(ctx, 'FRÜH', x + cw / 2, yy + o.frueh, { color: '#5d5470', align: 'center' });
      } else {
        // Der Name steht gross unter der Reihe — bei zehn Karten ist
        // hier kein Platz mehr dafuer, da lief er frueher ueber den Rand.
        var b = save.best[i];
        if (global.Spass) global.Spass.karte(ctx, save, i, x, yy, cw);
        if (b) {
          P.draw(ctx, 'honig', x + cw / 2 - 16, yy + o.hon);
          F.draw(ctx, 'x' + b.honey, x + cw / 2 - 2, yy + o.honT, { color: '#ffe9a8' });
          // Goldhonig: drei Punkte, gefuellt = gefunden
          var nG = LV.list[i].gold || 0, gm = save.gold[i] || 0;
          for (var gi = 0; gi < nG; gi++) {
            var dx = x + cw / 2 - (nG * 8 - 3) / 2 + gi * 8;
            rect(dx, yy + o.gold, 5, 5, (gm >> gi) & 1 ? '#ffd84a' : 'rgba(255,255,255,0.14)');
          }
          F.draw(ctx, '' + b.score, x + cw / 2, yy + o.pts,
                 { color: '#a094b8', align: 'center' });
          if (o.time >= 0) {
            F.draw(ctx, fmtTime(b.time), x + cw / 2, yy + o.time,
                   { color: '#6a6280', align: 'center' });
          }
        } else {
          F.draw(ctx, 'NEU', x + cw / 2, yy + o.neu, { color: '#8f86a8', align: 'center' });
        }
      }
    }

    // Name und Untertitel des gewaehlten Levels
    var selLvl = LV.list[Math.min(G.selIdx, sc.n - 1)];
    var offen = G.selIdx < save.unlocked;
    F.draw(ctx, offen ? selLvl.name : 'NOCH NICHT FREIGESPIELT',
           W / 2, sc.bottom + (two ? 10 : 14),
           { color: offen ? '#ffffff' : '#6a6280', align: 'center', scale: 2, shadow: true });
    if (offen) {
      F.draw(ctx, selLvl.sub, W / 2, sc.bottom + (two ? 28 : 34),
             { color: '#a094b8', align: 'center' });
    }

    F.draw(ctx, G.touch ? 'KARTE ANTIPPEN   -   NOCHMAL TIPPEN STARTET   -   HIER TIPPEN = ZURÜCK'
                        : G.hinweis('PFEILE WÄHLEN   -   SPRUNG STARTET   -   ESC ZURÜCK'),
           W / 2, H - 22, { color: '#a094b8', align: 'center' });
  }

  function drawHowto() {
    drawSky('gym');
    ctx.fillStyle = 'rgba(8,5,12,0.76)';
    ctx.fillRect(0, 0, W, H);
    F.draw(ctx, 'STEUERUNG', W / 2, 18, { color: '#ffd257', align: 'center', scale: 3, shadow: true });

    var rows = mitPad() ? [
      ['STICK / STEUERKREUZ', 'LAUFEN'],
      ['A ODER B', 'SPRINGEN'],
      ['NOCHMAL IN DER LUFT', 'BAUCH-BOOST (DOPPELSPRUNG)'],
      ['RUNTER IN DER LUFT', 'BAUCH-STAMPFER'],
      ['X / RB / RT', 'RENNEN + KIPPE WERFEN'],
      ['X / RB / RT (AIRSOFT)', 'BBS SCHIESSEN. HIT RUFEN: NIE.'],
      ['START', 'PAUSE'],
      ['B', 'ZURÜCK (IN MENÜS)']
    ] : [
      ['PFEILE / A D', 'LAUFEN'],
      ['LEERTASTE / W', 'SPRINGEN'],
      ['NOCHMAL IN DER LUFT', 'BAUCH-BOOST (DOPPELSPRUNG)'],
      ['PFEIL RUNTER IN DER LUFT', 'BAUCH-STAMPFER'],
      ['SHIFT / E', 'RENNEN + KIPPE WERFEN'],
      ['SHIFT / E (AIRSOFT)', 'BBS SCHIESSEN. HIT RUFEN: NIE.'],
      ['ESC / P', 'PAUSE'],
      ['M', 'TON AN / AUS']
    ];
    for (var i = 0; i < rows.length; i++) {
      var y = 54 + i * 16;
      F.draw(ctx, rows[i][0], 30, y, { color: '#ffe9a8' });
      F.draw(ctx, rows[i][1], 210, y, { color: '#ffffff' });
    }

    F.draw(ctx, 'AUF GEGNER SPRINGEN MACHT SIE PLATT.', 30, 180, { color: '#a094b8' });
    F.draw(ctx, 'DER BAUCH-STAMPFER ZERBRICHT KISTEN.', 30, 192, { color: '#a094b8' });
    F.draw(ctx, 'MIT DEM KIPPEN-PÄCKCHEN WIRFST DU KIPPEN.', 30, 204, { color: '#a094b8' });
    F.draw(ctx, 'EIN TREFFER KOSTET DANN NUR DAS PÄCKCHEN.', 30, 216, { color: '#a094b8' });
    F.draw(ctx, '100 HONIG = EIN EXTRALEBEN. 3 GOLDHONIG PRO LEVEL, IMMER GANZ OBEN.', 30, 228, { color: '#a094b8' });
    F.draw(ctx, 'STEH ZU LANGE STILL UND YUSUF SCHLÄFT EIN.', 30, 240, { color: '#a094b8' });
    if (!mitPad()) F.draw(ctx, 'AM HANDY: QUER HALTEN. A = SPRUNG, B = KIPPE.', 30, 252, { color: '#8f86a8' });

    F.draw(ctx, G.touch ? 'TIPPEN = ZURÜCK' : 'BELIEBIGE TASTE = ZURÜCK', W / 2, H - 18,
           { color: '#ffd257', align: 'center' });
  }

  function drawNameEntry() {
    drawSky('strasse');
    drawParallax('strasse', G.tick * 0.2, 0);
    ctx.fillStyle = 'rgba(8,5,12,0.78)';
    ctx.fillRect(0, 0, W, H);

    F.draw(ctx, 'DURCHGESPIELT!', W / 2, 22, {
      color: '#ffd257', align: 'center', scale: 3, shadow: true,
      wave: G.tick * 0.06, waveAmp: 1
    });
    F.draw(ctx, G.partialRun ? 'DER TAG IST GESCHAFFT!' : 'TRAG DICH IN DIE BESTENLISTE EIN', W / 2, 56,
           { color: '#c8b8e0', align: 'center' });

    var sec = Math.floor((G.runTime || 0) / 60);
    F.draw(ctx, 'PUNKTE ' + G.player.score + '   HONIG ' + G.player.honey +
                '   ZEIT ' + fmtTime(sec) + '   TODE ' + (G.player.deaths || 0),
           W / 2, 72, { color: '#ffe9a8', align: 'center' });

    if (G.partialRun && G.run && G.run.from === 0) {
      F.draw(ctx, 'AUF LEICHT GIBT ES KEINEN EINTRAG IN DER BESTENLISTE.', W / 2, 118,
             { color: '#ffffff', align: 'center' });
      F.draw(ctx, 'GESCHAFFT IST GESCHAFFT. HÖ HÖ HÖÖÖ.', W / 2, 132, { color: '#ffffff', align: 'center' });
    } else if (G.partialRun) {
      F.draw(ctx, 'IN DIE BESTENLISTE KOMMEN NUR DURCHGÄNGE,', W / 2, 118,
             { color: '#ffffff', align: 'center' });
      F.draw(ctx, 'DIE BEI LEVEL 1 ANFANGEN.', W / 2, 132, { color: '#ffffff', align: 'center' });
      F.draw(ctx, 'WEITER NACH EINEM ABSTURZ ZÄHLT TROTZDEM.', W / 2, 150,
             { color: '#8f86a8', align: 'center' });
      if (G.nameTimer > 45 && (G.tick >> 4) % 2 === 0) {
        F.draw(ctx, G.touch ? 'TIPPEN = WEITER' : 'SPRUNG = WEITER', W / 2, 180,
               { color: '#ffd257', align: 'center' });
      }
    } else if (G.nameSent) {
      // Das Textfeld selbst ist ein HTML-Formular ueber dem Bild (index.html).
      F.draw(ctx, 'EINGETRAGEN!', W / 2, 140, { color: '#ffd257', align: 'center', scale: 2 });
    } else if (global.Input.padDa && global.Input.padDa()) {
      F.draw(ctx, 'CONTROLLER: A = EINTRAGEN (OHNE NAMEN ALS YUSUF)', W / 2, H - 40,
             { color: '#8cd85a', align: 'center' });
    }

    P.drawChar(ctx, 'yusuf', 60, H - 16, { pose: 'cheer', face: 'laugh', frame: (G.tick >> 3) });
    P.drawChar(ctx, 'huseyin', W - 60, H - 16,
               { pose: 'idle', face: 'normal', frame: (G.tick >> 3), flip: true });
  }

  function drawScores() {
    drawSky('zimmer');
    drawParallax('zimmer', G.tick * 0.14, 0);
    ctx.fillStyle = 'rgba(8,5,12,0.82)';
    ctx.fillRect(0, 0, W, H);

    F.draw(ctx, 'BESTENLISTE', W / 2, 7, {
      color: '#ffd257', align: 'center', scale: 3, shadow: true
    });

    var board = boardList();
    var list = board.list.slice();
    var cat = SCORE_CATS[G.scoreCat || 0];
    F.draw(ctx, board.global ? 'WELTWEIT' : 'NUR AUF DIESEM GERÄT', W / 2, 31,
           { color: board.global ? '#6fc8e8' : '#6a6280', align: 'center' });

    // Kategorie-Leiste
    var cx0 = 60;
    for (var c = 0; c < SCORE_CATS.length; c++) {
      var on = (c === (G.scoreCat || 0));
      var label = SCORE_CATS[c].k;
      var lw = F.measure(label, 1, 1);
      if (on) rect(cx0 - 5, 42, lw + 10, 13, 'rgba(255,210,87,0.22)');
      F.draw(ctx, label, cx0, 45, { color: on ? '#ffd257' : '#8f86a8' });
      cx0 += lw + 26;
    }
    F.draw(ctx, '~ SORTIEREN |', W - 40, 45, { color: '#6a6280', align: 'right' });

    if (!list.length) {
      F.draw(ctx, 'NOCH NIEMAND HAT DURCHGESPIELT.', W / 2, 124,
             { color: '#c8b8e0', align: 'center' });
      F.draw(ctx, 'YUSUF FINDET DAS PEINLICH.', W / 2, 140,
             { color: '#8f86a8', align: 'center' });
    } else {
      list.sort(cat.cmp);
      F.draw(ctx, 'PLATZ', 40, 66, { color: '#8f86a8' });
      F.draw(ctx, 'NAME', 92, 66, { color: '#8f86a8' });
      F.draw(ctx, 'HONIG', 196, 66, { color: '#8f86a8' });
      F.draw(ctx, 'ZEIT', 258, 66, { color: '#8f86a8' });
      F.draw(ctx, 'TODE', 316, 66, { color: '#8f86a8' });
      F.draw(ctx, cat.k, W - 40, 66, { color: '#ffd257', align: 'right' });
      rect(36, 76, W - 72, 1, '#4a4258');

      for (var i = 0; i < list.length && i < MAX_SCORES; i++) {
        var e = list[i], y = 84 + i * 17;
        var mine = (G.lastName && e.n === G.lastName && e.s === G.lastScore);
        var col = mine ? '#ffd257' : (i === 0 ? '#ffe9a8' : '#ffffff');
        if (mine) rect(34, y - 3, W - 68, 15, 'rgba(255,210,87,0.14)');
        F.draw(ctx, (i + 1) + '.', 40, y, { color: col });
        F.draw(ctx, e.n, 92, y, { color: col });
        F.draw(ctx, 'x' + e.h, 196, y, { color: col });
        F.draw(ctx, fmtTime(e.t), 258, y, { color: col });
        F.draw(ctx, '' + e.d, 316, y, { color: col });
        F.draw(ctx, cat.val(e), W - 40, y, { color: col, align: 'right' });
      }
    }

    F.draw(ctx, G.touch ? 'KATEGORIE ANTIPPEN = SORTIEREN     SONST TIPPEN = ZURÜCK'
                        : 'LINKS / RECHTS = SORTIEREN     SPRUNG = ZURÜCK', W / 2, H - 14,
           { color: '#ffd257', align: 'center' });
  }

  /** Was in diesem Level anders ist als sonst — steht im Pausenmenue. */
  function levelHilfe() {
    var l = G.lvl, sc = G.scene, h = null;
    if (!l) return null;
    if (sc && sc.type === 'schlaf') h = sc.phase === 'traum' ? 'SPRUNG = MIT DEM BAUCH FLATTERN. BROKKOLI AUSWEICHEN.' : 'SPRUNG = VORSPULEN.';
    else if (sc && sc.type === 'shisha') h = 'C ODER SPRUNG = AUSPUSTEN, WENN JETZT! BLINKT.';
    else if (l.eat) h = 'ESSEN MIT DER MAUS ZU YUSUF ZIEHEN. ODER PFEILE + SPRUNG.';
    else if (l.mode === 'fussball') h = 'SHIFT / E = SCHUSS. REINSPRINGEN = KOPFBALL. STAMPFER = BAUCHSCHUSS.';
    else if (l.mode === 'rennen') h = 'PFEILE = LENKEN. SPRUNG = NITRO. RUNTER = BREMSEN.';
    else if (l.mode === 'fahrt') h = 'PFEILE = LENKEN. SHIFT = VOLLGAS. RUNTER = BREMSE. SPRUNG = SPRINGEN (ZWEIMAL).';
    else if (l.mode === 'downhill') h = 'SHIFT = TRETEN. RUNTER = BREMSEN. SPRUNG = HOPSEN, IN DER LUFT SALTO.';
    else if (l.mode === 'doener') h = 'PFEILE + SPRUNG = BELEGEN. RUNTER = WICKELN UND ESSEN.';
    else if (l.mode === 'pizza') h = 'PFEILE + SPRUNG = BELEGEN. RUNTER = OFEN. SPRUNG = RAUSHOLEN.';
    else if (l.mode === 'flug') h = 'SPRUNG = STEIGEN. RUNTER = SINKEN. LINKS / RECHTS = TEMPO.';
    else if (l.jagd) h = 'LAUF! WER STEHEN BLEIBT, WIRD VON DER SECURITY EINGEHOLT.';
    else if (l.bossType === 'felix') h = 'BEKIFFT MACHT DER BAUCH-STAMPFER VOLLEN SCHADEN.';
    else if (l.bossType === 'semih') h = 'AUF DEN TERLIK SPRINGEN = KONTER. LIEGT ER, STECKT ER ODER TELEFONIERT ER: DRAUF!';
    else if (l.bossType === 'semih2') h = 'DEIN STAMPFER MACHT VOLLEN SCHADEN. KRAFTPROBE: SPRUNG SO SCHNELL DU KANNST.';
    else if (l.bike) h = 'RECHTS = TRETEN, LINKS = BREMSEN. IN DER LUFT SPRUNG = SALTO.';
    else if (l.airsoft) h = 'SHIFT / E = BBS. HALTEN = DAUERFEUER. NACHLADEN GEHT VON ALLEIN.';
    else if (l.punch) h = 'SHIFT / E = FAUST. HAUT AUCH KISTEN KAPUTT.';
    if (h && G.touch) {
      h = h.replace('SHIFT / E', 'B').replace('C ODER SPRUNG', 'B ODER TIPPEN').replace('MIT DER MAUS', 'MIT DEM FINGER')
           .replace('RUNTER', 'PFEIL RUNTER');
    }
    return G.hinweis(h);
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(8,5,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    F.draw(ctx, 'PAUSE', W / 2, 100, { color: '#ffd257', align: 'center', scale: 4, shadow: true });
    F.draw(ctx, 'YUSUF MACHT SOWIESO GERADE PAUSE.', W / 2, 146,
           { color: '#c8b8e0', align: 'center' });
    var hilfe = levelHilfe();
    if (hilfe) F.draw(ctx, hilfe, W / 2, 158, { color: '#8cd85a', align: 'center' });
    drawTouchButtons(pauseButtons(), G.touch ? -1 : G.pauseSel);
    if (G.touch) return;
    F.draw(ctx, G.hinweis('PFEILE = AUSWAHL    SPRUNG = OK    ESC = WEITER'), W / 2, 206,
           { color: '#a094b8', align: 'center' });
  }

  function drawResults() {
    ctx.fillStyle = 'rgba(8,5,12,0.84)';
    ctx.fillRect(0, 0, W, H);
    var p = G.player;
    F.draw(ctx, 'LEVEL GESCHAFFT!', W / 2, 40, {
      color: '#ffd257', align: 'center', scale: 3, shadow: true,
      wave: G.tick * 0.07, waveAmp: 1
    });

    var sec = Math.floor(G.time / 60);
    var st = G.levelStart || { honey: 0, score: 0 };
    var nGold = G.goldIdx ? G.goldIdx.length : 0, got = G.goldCount();
    var rows = [
      ['HONIG IN DIESEM LEVEL', 'x' + (p.honey - st.honey)],
      ['PUNKTE', '' + p.score],
      ['ZEIT', Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2)],
      ['LEBEN ÜBRIG', '' + Math.max(0, p.lives)]
    ];
    if (nGold) rows.splice(1, 0, ['GOLDHONIG', got + ' VON ' + nGold]);
    // Gefundene Verstecke (falsche Waende, strecke.js) — wie die Sterne bei Mario
    var stS = global.Strecke ? global.Strecke.stand(G) : null;
    if (stS && stS.verstecke) rows.splice(nGold ? 2 : 1, 0, ['GEHEIMNISSE', stS.gefunden + ' VON ' + stS.verstecke]);
    rows.push(['AURA', '' + (p.aura || 0)]);
    for (var i = 0; i < rows.length; i++) {
      var y = 76 + i * 16;
      F.draw(ctx, rows[i][0], 70, y, { color: '#c8b8e0' });
      F.draw(ctx, rows[i][1], W - 190, y, { color: '#ffffff', align: 'right' });
    }
    // Der Rang als Stempel (wie bei Pizza Tower), darunter, was noch fehlt
    if (global.Spass) global.Spass.drawRang(ctx, G, W - 90, 100);

    P.drawChar(ctx, 'yusuf', 90, 214, { pose: 'cheer', face: 'laugh', frame: (G.tick >> 3) });
    // Was Yusuf zum Goldhonig sagt, haengt davon ab, wie viel er hat
    var fazit = !nGold ? 'HÖ HÖ HÖÖÖ!'
              : got === nGold ? 'ALLE DREI. HÖ HÖ HÖÖÖ!'
              : got === 0 ? 'GOLDHONIG? NIE GEHÖRT. HÖ HÖ.'
              : 'DER REST LÄUFT JA NICHT WEG. HÖ HÖ.';
    F.draw(ctx, fazit, 130, 192, { color: '#ffd257' });

    if (G.resultTimer > 40 && (G.tick >> 4) % 2 === 0) {
      F.draw(ctx, G.touch ? 'TIPPEN FÜR WEITER' : 'SPRUNG DRÜCKEN FÜR WEITER', W / 2, H - 26,
             { color: '#ffd257', align: 'center' });
    }
  }

  function drawEnding() {
    // Der Abspann: alle im Stilbruch, mit Semih (finale.js)
    if (global.Finale) {
      global.Finale.abspannDraw(ctx, G, W, H, G.endScroll);
      drawParticles(0, 0);
      if (G.endScroll > 150 && (G.tick >> 4) % 2 === 0) {
        F.draw(ctx, G.touch ? 'TIPPEN = BESTENLISTE' : 'SPRUNG = BESTENLISTE', W / 2, H - 16,
               { color: '#ffd257', align: 'center', shadow: true });
      }
      return;
    }
    drawSky('garten');
    drawParallax('garten', G.tick * 0.16, 0);
    ctx.fillStyle = 'rgba(8,5,12,0.42)';
    ctx.fillRect(0, 0, W, H);

    for (var tx = 0; tx <= W / 16; tx++) {
      P.draw(ctx, SP.tileTop('garten'), tx * 16, 240);
      P.draw(ctx, SP.tileFill('garten'), tx * 16, 256);
      P.draw(ctx, SP.tileFill('garten'), tx * 16, 272);
    }
    var f = (G.tick >> 3);
    P.drawChar(ctx, 'yusuf', 210, 240, { pose: 'idle', face: 'eat', frame: f });
    P.drawChar(ctx, 'huseyin', 300, 240, { pose: 'idle', face: 'eat', frame: f, flip: true });
    P.draw(ctx, 'honig', 248, 214);
    drawParticles(0, 0);

    var credits = [
      '', '', '',
      'BALCI RUN',
      '',
      'HAUPTROLLE',
      'YUSUF BALCI',
      'LOCKEN, GRÜNE AUGEN, GROSSES HERZ',
      '',
      'ENDGEGNER',
      'HUSEYIN BALCI',
      'DERSELBE MENSCH, NUR DÜNN UND LAUT',
      '',
      'HONIG',
      'SEHR VIEL HONIG',
      '',
      'DÖNER-BERATUNG',
      'YUSUF BALCI',
      '',
      'SCHLAF-KOORDINATION',
      'YUSUF BALCI',
      '',
      'UNGEFRAGTE ERNÄHRUNGSTIPPS',
      'HUSEYIN BALCI',
      '',
      'KEIN SALAT WURDE BEI DEN',
      'DREHARBEITEN GEGESSEN',
      '',
      'DANKE FÜRS SPIELEN!',
      '',
      'HÖ HÖ HÖÖÖ',
      '', '', ''
    ];
    for (var i = 0; i < credits.length; i++) {
      var y = H + 20 + i * 16 - G.endScroll;
      if (y < -20 || y > H) continue;
      var big = (credits[i] === 'BALCI RUN' || credits[i] === 'HÖ HÖ HÖÖÖ');
      F.draw(ctx, credits[i], W / 2, y, {
        color: big ? '#ffd257' : '#ffffff',
        align: 'center', scale: big ? 3 : 1, shadow: true
      });
    }

    if (G.endScroll > 620 && (G.tick >> 4) % 2 === 0) {
      F.draw(ctx, G.touch ? 'TIPPEN = HAUPTMENÜ' : 'SPRUNG = HAUPTMENÜ', W / 2, H - 16,
             { color: '#ffd257', align: 'center' });
    }
  }

  /* ================= Skalierung ================= */

  /* Am PC: feste 512x288, moeglichst ganzzahlig vergroessert.
     Am Handy fuellt das Bild den ganzen Bildschirm:
       - die Breite folgt dem Seitenverhaeltnis, also keine schwarzen Balken,
       - im Spiel ist die Ansicht naeher dran (weniger Himmel, groessere
         Figuren), und das Bodenband liegt unten, wo die Knoepfe sind.
     Menues behalten ihre 288 Pixel Hoehe, damit nichts abgeschnitten wird. */
  var PLAY_STATES = { play: 1, dialog: 1, paused: 1 };
  var BOTTOM_PAD = 0;   // Extra-Erde unter dem Level (nur Handy-Spielansicht)

  function wantedView() {
    var ww = window.innerWidth, wh = window.innerHeight;
    var aspect = ww / Math.max(1, wh);
    if (!G.touch || aspect < 1.6) return { w: 512, h: 288 };
    var play = !!PLAY_STATES[G.state];
    var h = play ? 232 : 288;
    var w = Math.round(h * aspect);
    w = Math.max(play ? 400 : 512, Math.min(play ? 580 : 660, w));
    return { w: w, h: h };
  }

  var inMenu = null;

  function applyView() {
    // Steuerknoepfe nur im Spiel zeigen; Menues bedient man per Antippen
    var menuNow = !(G.state === 'play' || G.state === 'dialog');
    if (menuNow !== inMenu) {
      inMenu = menuNow;
      document.body.classList.toggle('inmenu', menuNow);
    }
    var v = wantedView();
    if (v.w === W && v.h === H) return;
    W = v.w; H = v.h;
    BOTTOM_PAD = (H < 288) ? 16 : 0;
    leinwand();
    resize();
  }

  /** Die Leinwand auf W x H mal Render-Skala bringen. logischW/H lesen
      input.js (Maus, Finger) und die Tests: dort zaehlen Spiel-Pixel. */
  function leinwand() {
    if (canvas.width !== W * RS || canvas.height !== H * RS) {
      canvas.width = W * RS; canvas.height = H * RS;
    }
    canvas.logischW = W; canvas.logischH = H;
    ctx.imageSmoothingEnabled = false;
    if (LI) LI.setRs(RS);
  }

  function resize() {
    var ww = window.innerWidth, wh = window.innerHeight, s;
    if (G.touch) {
      s = Math.min(ww / W, wh / H);
    } else {
      var art = global.Optionen ? global.Optionen.skalierung() : 'auto';
      if (art === 'fuellen') {
        // So gross wie moeglich, ohne Rand
        s = Math.min(ww / W, wh / H);
      } else {
        s = Math.min((ww - 24) / W, (wh - 24) / H);
        if (s < 1) {
          // Kleines Fenster: lieber verkleinert als abgeschnitten
          s = Math.max(0.25, Math.min(ww / W, wh / H));
        } else {
          // Ganzzahlige Skalierung: bei SCHARF immer, sonst solange sie
          // nicht zu viel Platz verschenkt
          var si = Math.floor(s);
          if (art === 'scharf') s = Math.max(1, Math.floor(Math.min(ww / W, wh / H)));
          else if (si >= 1 && (s - si) < 0.34) s = si;
        }
      }
    }
    canvas.style.width = Math.round(W * s) + 'px';
    canvas.style.height = Math.round(H * s) + 'px';
    // So fein zeichnen, wie das Bild wirklich angezeigt wird
    var rs = LI ? LI.rsFuer(s, global.devicePixelRatio || 1, W, H, G.touch) : 1;
    if (rs !== RS) { RS = rs; leinwand(); }
  }
  function onResize() { applyView(); resize(); }
  G.onSkalierung = resize;
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', function () { setTimeout(onResize, 150); });
  document.addEventListener('fullscreenchange', function () { setTimeout(onResize, 100); });
  document.addEventListener('webkitfullscreenchange', function () { setTimeout(onResize, 100); });

  /* ================= Start ================= */

  global.Input.init(canvas);
  leinwand();
  applyView();
  resize();
  // Weltweite Bestenliste sofort holen, damit sie beim Start schon dasteht
  if (global.Online) global.Online.refresh(true);

  /* ---------- Handy: Vollbild ----------
     Browser erlauben Vollbild nur nach einem Tippen. Darum gibt es am
     Handy einen Startknopf: ein Tippen = Vollbild + Querformat sperren
     (Android) + Ton an. Das iPhone kann im Browser kein echtes Vollbild;
     dort hilft "Zum Home-Bildschirm" — von da startet das Spiel ohne
     Adressleiste (siehe spiel/manifest.webmanifest). */
  (function mobileStart() {
    var ov = document.getElementById('tapstart');
    var go = document.getElementById('startbtn');
    var hint = document.getElementById('fshint');
    var fsb = document.getElementById('fsbtn');
    if (!ov || !go) return;
    var de = document.documentElement;
    var canFs = !!(de.requestFullscreen || de.webkitRequestFullscreen);
    var ios = /iP(hone|od|ad)/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone === true ||
      !!(global.matchMedia && global.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);

    function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
    function lockLandscape() {
      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(function () {});
        }
      } catch (e) {}
    }
    function enterFs() {
      try {
        var r = de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' })
                                     : de.webkitRequestFullscreen();
        if (r && r.then) r.then(lockLandscape, function () {});
        else lockLandscape();
      } catch (e) {}
    }
    function exitFs() {
      try {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } catch (e) {}
    }

    if (fsb) {
      if (!canFs || standalone) fsb.hidden = true;
      fsb.addEventListener('click', function () { if (isFs()) exitFs(); else enterFs(); });
    }

    if (!G.touch || standalone) return;   // PC oder schon als App gestartet
    if (!canFs) hint.textContent = ios ? 'Echtes Vollbild: Teilen → Zum Home-Bildschirm' : '';
    ov.hidden = false;
    go.addEventListener('click', function () {
      if (canFs && !isFs()) enterFs();
      S.resume();
      if (G.state === 'title') S.music('menu');
      ov.hidden = true;
      setTimeout(onResize, 250);
    });
  })();

  // Dummy-Welt, damit das Titelbild etwas zum Zeichnen hat
  G.player = new E.Player(0, 0);
  loadLevel(0, false);
  G.state = 'title';
  G.banner = 0;

  var STEP = 1000 / 60;
  var acc = 0, last = performance.now();

  function frame(now) {
    var dt = now - last;
    last = now;
    // Ruckelt es dauerhaft, schaltet GRAFIK: AUTOMATISCH herunter (licht.js)
    if (LI && LI.messen(dt)) resize();
    if (dt > 250) dt = STEP;     // nach Tab-Wechsel nicht aufholen
    acc += dt;
    var guard = 0;
    // Bis zu acht Schritte pro Bild: auch bei 8 Bildern pro Sekunde laeuft
    // das Spiel noch in Echtzeit (frueher fuenf: unter 12 Bildern Zeitlupe).
    while (acc >= STEP && guard++ < 8) { update(); acc -= STEP; }
    // Mehr holt das Spiel nicht nach. Den Rest verwerfen — sonst lief es
    // nach einem Ruckler sekundenlang im Zeitraffer.
    if (acc >= STEP) acc = 0;
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Musik erst nach der ersten Eingabe (Browser-Regel)
  function firstGesture() {
    G.gestured = true;
    S.resume();
    if (G.state === 'title') S.music('menu');
    window.removeEventListener('keydown', firstGesture);
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('touchstart', firstGesture);
  }
  window.addEventListener('keydown', firstGesture);
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('touchstart', firstGesture);

  // Debug-Haken: erlaubt schrittweises Durchlaufen ohne requestAnimationFrame.
  G._update = update;
  G._render = render;
  G._loadLevel = loadLevel;
  G._loadScores = loadScores;
  G._storeScore = storeScore;
  G._board = boardList;
  G._saveCopy = function () { return JSON.parse(JSON.stringify(save)); };
  G._menu = menuItems;
  G._titleMenuTop = titleMenuTop;
  G._canvas = canvas;          // semih.js haelt das letzte Bild fest, wenn es zerspringt
  G.rs = function () { return RS; };
  G.viewH = function () { return H; };

  global.G = G;

})(window);
