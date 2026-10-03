/* =====================================================================
   entities.js — Welt, Physik, Yusuf, Gegner, Items und Hussein.
   ===================================================================== */
(function (global) {
  'use strict';

  var T = 16;
  var W_VIEW = 512;   // Bildbreite; nur fuer "ist das noch sichtbar"-Tests

  /* ================= Konstanten ================= */

  // Alle Zahlen dazu stehen in balance.js (Balance.SPIELER, Balance.AIRSOFT)
  var SP = global.Balance.SPIELER, AS = global.Balance.AIRSOFT;
  var GRAV = SP.GRAV;
  var MAX_FALL = SP.MAX_FALL;
  var ACC = SP.ACC;
  var FRIC_GROUND = SP.FRIC_GROUND;
  var FRIC_AIR = SP.FRIC_AIR;
  var MAX_WALK = SP.MAX_WALK;
  var MAX_RUN = SP.MAX_RUN;
  var JUMP_V = SP.JUMP_V;
  var JUMP2_V = SP.JUMP2_V;
  var COYOTE = SP.COYOTE;
  var BUFFER = SP.BUFFER;
  var POUND_CHARGE = SP.POUND_CHARGE;
  var POUND_SPEED = SP.POUND_SPEED;
  // Ausdauer: die Arschbombe kostet Puste, sonst kann man sie spammen
  var STAM_MAX = SP.PUSTE_MAX;
  var POUND_COST = SP.STAMPFER_KOSTET;
  var STAM_REGEN = SP.PUSTE_PRO_TICK;
  var POUND_BOSS_DMG = SP.STAMPFER_BOSS;   // Arschbombe auf Bosse: halber Schaden
  var SLEEP_AFTER = SP.EINSCHLAFEN_NACH;   // nichts tun -> Yusuf pennt

  // Level 21: die Leih-Airsoft
  var MAGAZIN = AS.MAGAZIN;       // BBs pro Magazin
  var NACHLADEN = AS.NACHLADEN;   // so lange dauert ein neues Magazin
  var BB_TAKT = AS.BB_TAKT;       // Ticks zwischen zwei Schuessen (antippen)
  var BB_DAUER = AS.BB_DAUER;     // ... und bei gehaltener Taste (Dauerfeuer)
  var BB_TEMPO = AS.BB_TEMPO;

  /** Zielhilfe: Der BB fliegt leicht schraeg auf den naechsten Gegner vor
      Yusuf, wenn der nicht zu steil ueber oder unter ihm steht (etwa 30
      Grad). So trifft man auch den Sniper auf dem Hochsitz und Sonnet auf
      dem Dach — und am Handy, wo man nicht zielen kann. */
  function zielhilfe(g, p, mx, my) {
    var best = null, bd = 1e9;
    function pruef(x, y) {
      var dx = (x - mx) * p.facing, dy = y - my;
      if (dx < 12 || dx > 300 || Math.abs(dy) > dx * 0.58) return;
      var d = dx + Math.abs(dy) * 1.5;
      if (d < bd) { bd = d; best = { dx: dx, dy: dy }; }
    }
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (e && !e.dead) pruef(e.cx(), e.y + e.h / 2);
    }
    var b = g.boss;
    if (b && !b.dead && b.state !== 'transform') pruef(b.cx(), b.y + Math.min(b.h / 2, 26));
    return best;
  }

  // Level 12: Fahrrad
  var BIKE_HOP = -8.4;        // Hopser vom Boden
  var KICK_BASE = 8.6;        // Absprung von der Rampe: KICK_BASE + Tempo
  var FLIP_SPD = Math.PI * 2 / 30;  // ein Rueckwaertssalto dauert eine halbe Sekunde
  var FLIP_OK = 0.9;          // so weit darf er beim Landen noch schief sein

  /* Schwierigkeitsgrad pro Level. Wirkt auf Tempo und Angriffslust
     der Gegner, damit es von Level zu Level anzieht. */
  var DIFF = 1;
  function setDifficulty(d) { DIFF = d || 1; }

  /* ================= Welt ================= */

  function World() {
    this.reset();
  }

  World.prototype.reset = function () {
    this.w = 0; this.h = 0;
    this.grid = null; this.special = null;
    this.blocks = {}; this.hazards = [];
    this.movers = []; this.signs = [];
    this.kickers = [];
    this.theme = 'zimmer';
  };

  World.prototype.load = function (lvl) {
    this.reset();
    this.w = lvl.w; this.h = lvl.h;
    this.theme = lvl.theme;
    this.grid = new Uint8Array(lvl.w * lvl.h);
    this.special = new Uint8Array(lvl.w * lvl.h);
    this.blocks = {};
    this.signs = lvl.signs.slice();

    var i, j, r;
    for (i = 0; i < lvl.solids.length; i++) {
      r = lvl.solids[i];
      this.fill(r[0], r[1], r[2], r[3], 1);
    }

    for (i = 0; i < lvl.blocks.length; i++) {
      var b = lvl.blocks[i];
      var idx = b.y * this.w + b.x;
      this.grid[idx] = 1;
      this.special[idx] = (b.type === 'feder') ? 2 : 1;
      this.blocks[idx] = {
        x: b.x, y: b.y, type: b.type, item: b.item,
        count: b.count || 1, used: false, bump: 0, dead: false
      };
    }

    this.hazards = [];
    for (i = 0; i < lvl.hazards.length; i++) {
      r = lvl.hazards[i];
      // Gabeln und Dornbuesche sind eine ganze Kachel hoch, Fluessiges nur halb
      var full = (r[4] === 'gabel' || r[4] === 'dornen' || r[4] === 'draht');
      this.hazards.push({
        x: r[0] * T, y: r[1] * T + (full ? 0 : 8),
        w: r[2] * T, h: full ? T : T - 8,
        type: r[4], tx: r[0], ty: r[1], tw: r[2]
      });
    }

    // Rampen (Level 12): [letzte Kachel, Bodenzeile]. Die Kante liegt
    // am rechten Rand der Kachel, dort hebt das Fahrrad ab.
    this.kickers = (lvl.kickers || []).map(function (k) {
      return { x: (k[0] + 1) * T, y: k[1] * T };
    });

    this.movers = [];
    for (i = 0; i < lvl.movers.length; i++) {
      var m = lvl.movers[i];
      this.movers.push({
        x: m.x * T, y: m.y * T, w: m.w * T, h: 6,
        ox: m.x * T, oy: m.y * T,
        axis: m.axis, range: m.range * T, speed: m.speed,
        dir: 1, dx: 0, dy: 0
      });
    }
  };

  World.prototype.fill = function (x, y, w, h, v) {
    for (var ty = y; ty < y + h; ty++) {
      if (ty < 0 || ty >= this.h) continue;
      for (var tx = x; tx < x + w; tx++) {
        if (tx < 0 || tx >= this.w) continue;
        this.grid[ty * this.w + tx] = v;
      }
    }
  };

  World.prototype.solid = function (tx, ty) {
    if (tx < 0 || tx >= this.w) return true;      // Levelrand ist Wand
    if (ty < 0) return false;                      // oben offen
    if (ty >= this.h) return false;                // unten offen -> Sturz
    return this.grid[ty * this.w + tx] === 1;
  };

  World.prototype.specialAt = function (tx, ty) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return 0;
    return this.special[ty * this.w + tx];
  };

  World.prototype.blockAt = function (tx, ty) {
    return this.blocks[ty * this.w + tx] || null;
  };

  World.prototype.clearBlock = function (b) {
    var idx = b.y * this.w + b.x;
    this.grid[idx] = 0;
    this.special[idx] = 0;
    b.dead = true;
  };

  World.prototype.updateMovers = function () {
    for (var i = 0; i < this.movers.length; i++) {
      var m = this.movers[i];
      var px = m.x, py = m.y;
      if (m.axis === 'x') {
        m.x += m.speed * m.dir;
        if (m.x > m.ox + m.range) { m.x = m.ox + m.range; m.dir = -1; }
        if (m.x < m.ox - m.range) { m.x = m.ox - m.range; m.dir = 1; }
      } else {
        m.y += m.speed * m.dir;
        if (m.y > m.oy + m.range) { m.y = m.oy + m.range; m.dir = -1; }
        if (m.y < m.oy - m.range) { m.y = m.oy - m.range; m.dir = 1; }
      }
      m.dx = m.x - px; m.dy = m.y - py;
    }
  };

  /* ================= Kollision ================= */

  function moveX(e, world, dx) {
    e.x += dx;
    var y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 1) / T);
    var tx, ty;
    if (dx > 0) {
      tx = Math.floor((e.x + e.w - 1) / T);
      for (ty = y0; ty <= y1; ty++) {
        if (world.solid(tx, ty)) {
          e.x = tx * T - e.w; e.vx = 0; e.wallTile = [tx, ty]; return 1;
        }
      }
    } else if (dx < 0) {
      tx = Math.floor(e.x / T);
      for (ty = y0; ty <= y1; ty++) {
        if (world.solid(tx, ty)) {
          e.x = (tx + 1) * T; e.vx = 0; e.wallTile = [tx, ty]; return -1;
        }
      }
    }
    return 0;
  }

  function moveY(e, world, dy) {
    e.y += dy;
    var x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 1) / T);
    var tx, ty;
    if (dy > 0) {
      // WICHTIG: hier KEIN "-1". Sonst greift die Kollision erst, wenn die
      // Figur schon einen Pixel im Boden steckt — sie sinkt ein, wird
      // zurueckgeschnappt und gilt jeden zweiten Frame als "in der Luft".
      // Genau das war das Zittern.
      ty = Math.floor((e.y + e.h) / T);
      for (tx = x0; tx <= x1; tx++) {
        if (world.solid(tx, ty)) {
          e.y = ty * T - e.h; e.vy = 0;
          e.landTile = [tx, ty];
          return 1;
        }
      }
    } else if (dy < 0) {
      ty = Math.floor(e.y / T);
      for (tx = x0; tx <= x1; tx++) {
        if (world.solid(tx, ty)) {
          e.y = (ty + 1) * T; e.vy = 0;
          e.headTile = [tx, ty];
          return -1;
        }
      }
    }
    return 0;
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /* ================= Partikel ================= */

  function Particles() { this.list = []; }

  Particles.prototype.spawn = function (o) {
    this.list.push({
      x: o.x, y: o.y,
      vx: o.vx || 0, vy: o.vy || 0,
      life: o.life || 30, max: o.life || 30,
      col: o.col || '#ffc23c',
      size: o.size || 2,
      grav: o.grav === undefined ? 0.18 : o.grav,
      text: o.text || null,
      shrink: o.shrink !== false
    });
  };

  Particles.prototype.burst = function (x, y, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = (o.spread || 2) * (0.35 + Math.random() * 0.65);
      this.spawn({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0.6),
        life: (o.life || 26) + Math.random() * 10 | 0,
        col: o.col || '#ffc23c',
        size: o.size || 2,
        grav: o.grav === undefined ? 0.2 : o.grav
      });
    }
  };

  Particles.prototype.update = function () {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += p.grav;
      p.vx *= 0.98;
      if (--p.life <= 0) this.list.splice(i, 1);
    }
  };

  /* ================= Fließtexte ================= */

  function Floats() { this.list = []; }
  Floats.prototype.add = function (x, y, text, col, life) {
    var f = { x: x, y: y, text: text, col: col || '#fff3c8', life: life || 60, max: life || 60 };
    this.list.push(f);
    return f;
  };
  Floats.prototype.update = function () {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var f = this.list[i];
      f.y -= 0.45;
      if (--f.life <= 0) this.list.splice(i, 1);
    }
  };

  /* ================= Spieler ================= */

  function Player(x, y) {
    this.w = 12; this.h = 26;
    this.reset(x, y);
    this.lives = global.Balance.s('leben');
    this.honey = 0;
    this.score = 0;
    this.maxHp = global.Balance.s('herzen');
    this.eatCount = 0;   // fuer den Laufgag: er hat NIE Hunger
    this.deaths = 0;     // fuer die Bestenliste
  }

  /** Ein Glas Honig mehr. Jede volle Hundert gibt EINMAL ein Extraleben.
      Frueher gab es das Leben bei jedem Erreichen von x00 — nach einem Tod
      geht der Honig aber auf den Checkpoint-Stand zurueck, das Glas liegt
      wieder da, und man bekam dasselbe Leben immer wieder (Level 7 im
      Test: 83 Tode, nie Game Over). Gibt true zurueck, wenn es ein Leben gab. */
  Player.prototype.honigDazu = function () {
    if (this.honigLeben === undefined) this.honigLeben = Math.floor(this.honey / 100);
    this.honey++;
    var h = Math.floor(this.honey / 100);
    if (h <= this.honigLeben) return false;
    this.honigLeben = h;
    this.lives++;
    return true;
  };

  Player.prototype.reset = function (x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.coyote = 0; this.buffer = 0;
    this.jumpsLeft = 2;
    this.jumpHeld = false;
    this.pound = 0;          // 0 aus, >0 Aufladen, -1 Sturz
    this.poundCharge = 0;
    this.stamina = STAM_MAX; // Puste fuer die Arschbombe
    this.stamMax = STAM_MAX;
    this.pustT = 0;          // kurz ausser Puste (Anzeige blinkt)
    this.hp = this.maxHp || 3;
    this.invuln = 0;
    this.hurtTimer = 0;
    this.dead = false;
    this.deadTimer = 0;
    this.deadHandled = false;
    this.power = 0;          // Gold-Döner
    this.idle = 0;
    this.sleeping = false;
    this.snore = 0;
    this.eatTimer = 0;
    this.laughTimer = 0;
    this.slip = 0;           // auf einer Pfuetze ausgerutscht
    this.stick = 0;          // in Hummus getreten: langsam
    this.smoke = false;      // Kippen-Power-Up aktiv
    this.smokeCool = 0;
    this.punchT = 0;         // Level 19: Faust gerade vorn
    this.punchCool = 0;
    this.mag = MAGAZIN;      // Level 21: BBs im Magazin
    this.reload = 0;         // > 0: es wird nachgeladen
    this.bbCool = 0;
    this.muzzle = 0;         // Muendungsblitz
    this.hitCall = false;    // Airsoft: erst beim Tod ruft er HIT
    this.growlTimer = 0;
    this.growlCool = 0;
    this.anim = 0;
    this.animT = 0;
    this.ridingY = null;
    this.landTile = null;
    this.headTile = null;
    this.won = false;
    this.cheer = 0;
    // Fahrrad (Level 12)
    this.flipping = false;   // dreht gerade einen Rueckwaertssalto
    this.flipA = 0;          // Winkel des laufenden Saltos
    this.flipsAir = 0;       // fertige Saltos in diesem Sprung
    this.kicked = false;     // von einer Rampe abgesprungen
  };

  Player.prototype.cx = function () { return this.x + this.w / 2; };
  Player.prototype.feet = function () { return this.y + this.h; };

  Player.prototype.update = function (g) {
    var world = g.world, In = global.Input;
    var frozen = g.frozen;

    if (this.dead) { this.deadUpdate(g); return; }

    if (this.invuln > 0) this.invuln--;
    if (this.hurtTimer > 0) this.hurtTimer--;
    if (this.power > 0) {
      this.power--;
      if (this.power === 0) g.floats.add(this.cx(), this.y - 6, 'VORBEI', '#ffd257');
    }
    if (this.eatTimer > 0) this.eatTimer--;
    if (this.laughTimer > 0) this.laughTimer--;
    if (this.cheer > 0 && !this.won) this.cheer--;   // kurzer Jubel nach einem Bosssieg
    if (this.growlTimer > 0) this.growlTimer--;
    if (this.growlCool > 0) this.growlCool--;
    if (this.smokeCool > 0) this.smokeCool--;

    // Knurrt einfach so vor sich hin. Tiefe Goblin-Stimme.
    if (!frozen && !this.sleeping && this.growlCool === 0 && Math.random() < 0.0034) {
      this.doGrowl(g);
    }

    // In Zwischensequenzen faehrt das Spiel selbst (g.autoAx), die Tasten
    // zaehlen dann nicht.
    var auto = (g.autoAx !== null && g.autoAx !== undefined);
    var bike = !!(g.lvl && g.lvl.bike);
    var ax = frozen ? 0 : (auto ? g.autoAx : In.axis());
    var wantJump = !frozen && !auto && In.hit('jump');
    var holdJump = !frozen && !auto && In.down('jump');
    var wantDown = !frozen && !auto && In.down('down');
    var running = !frozen && !auto && In.down('run');

    /* --- Kippe werfen (nur mit Päckchen) --- */
    if (!frozen && !auto && this.smoke && this.smokeCool === 0 && In.hit('throw')) {
      this.smokeCool = 20;
      g.addProjectile('kippe', this.cx() + this.facing * 9, this.y + 11,
                      this.facing * 4.3, -1.7, true);
      global.Sound.play('flick');
      g.particles.spawn({ x: this.cx() + this.facing * 10, y: this.y + 11,
                          vx: this.facing * 0.3, vy: -0.4, life: 26,
                          col: '#9a9088', size: 2, grav: -0.012 });
      if (Math.random() < 0.3) this.doGrowl(g);
    }

    /* --- Boxen (Level 19): im Knast gibt es keine Kippen, nur Faeuste --- */
    if (this.punchT > 0) this.punchT--;
    if (this.punchCool > 0) this.punchCool--;
    if (!frozen && !auto && g.lvl && g.lvl.punch && !this.smoke && this.punchCool === 0 &&
        In.hit('throw')) {
      this.punchCool = 16;
      this.punchT = 9;
      g.addProjectile('faustY', this.facing > 0 ? this.x + this.w - 2 : this.x - 16,
                      this.y + 5, 0, 0, true);
      global.Sound.play('flick');
    }

    /* --- Airsoft (Level 21): die Leihwaffe schiesst BBs ---
       Antippen = ein Schuss, Taste halten = Dauerfeuer (etwas langsamer).
       Ist das Magazin leer, wird von allein nachgeladen. */
    if (this.bbCool > 0) this.bbCool--;
    if (this.muzzle > 0) this.muzzle--;
    if (g.lvl && g.lvl.airsoft && !bike) {
      if (this.reload > 0 && --this.reload === 0) {
        this.mag = MAGAZIN;
        global.Sound.play('reload');
      }
      var tipp = In.hit('throw'), halten = In.down('throw');
      if (!frozen && !auto && this.reload === 0 && this.bbCool === 0 && (tipp || halten)) {
        this.bbCool = tipp ? BB_TAKT : BB_DAUER;
        this.mag--;
        this.muzzle = 4;
        var bmx = this.cx() + this.facing * 15, bmy = this.y + 12;
        var zh = zielhilfe(g, this, bmx, bmy);
        var bvy = zh ? Math.max(-4.2, Math.min(4.2, zh.dy / zh.dx * BB_TEMPO)) : -0.15;
        var bb = g.addProjectile('bb', bmx - 2, bmy - 2,
                                 this.facing * BB_TEMPO + this.vx * 0.3, bvy, true);
        if (bb && zh) bb.grav = 0;
        if (bb) bb.von = this;
        global.Sound.play('bb');
        if (this.mag <= 0) {
          this.reload = NACHLADEN;
          g.floats.add(this.cx(), this.y - 10, (global.Levels.airsoft || {}).nachladen || 'NACHLADEN!', '#c8c0d8', 50);
        }
      }
    }

    /* --- Schlaf-Gag --- */
    if (!frozen && (ax !== 0 || wantJump || wantDown || !this.grounded)) {
      if (this.sleeping) {
        this.sleeping = false;
        g.floats.add(this.cx(), this.y - 8, 'OH! SCHON DRAN?', '#ffe9a8');
      }
      this.idle = 0;
    } else if (this.grounded && Math.abs(this.vx) < 0.15) {
      this.idle++;
      if (this.idle === SLEEP_AFTER) {
        this.sleeping = true;
        var lines = global.Levels.sleepLines;
        g.floats.add(this.cx(), this.y - 8, lines[(Math.random() * lines.length) | 0],
                     '#bda8ff', 110);
      }
    }
    if (this.sleeping) {
      this.snore++;
      if (this.snore % 96 === 0) {
        global.Sound.play('snore');
        g.particles.spawn({ x: this.cx() + 6 * this.facing, y: this.y - 2,
                            vx: 0.25 * this.facing, vy: -0.5, life: 60,
                            col: '#cfc0ff', size: 3, grav: -0.01, text: 'Z' });
      }
    }

    /* --- Horizontal --- */
    var maxS = running ? MAX_RUN : MAX_WALK;
    if (this.power > 0) maxS += 0.5;
    if (bike) maxS = running ? 5.0 : 4.2;
    if (g.autoMax) maxS = Math.min(maxS, g.autoMax);
    // Level 26: Felix' Rauch — bekifft ist Yusuf etwas traeger (dafuer wuetend)
    if (g.high) maxS *= 0.88;
    // Level 30: Yusuf rastet aus — schneller, und er haelt nicht mehr an
    if (g.wut) maxS *= 1.12;
    // In Hamzas Hummus getreten: klebt an den Schuhen
    if (this.stick > 0) { this.stick--; maxS *= 0.45; }
    var wankt = !!(g.drunk || g.dizzy > 0);   // Alex' Wodka oder Hamzas HHC-Welle
    // Auf einer Pfuetze: kaum Grip, er rutscht weiter.
    if (this.slip > 0) {
      this.slip--;
      ax *= 0.35;
      if (this.grounded) this.vx *= 0.995;
    }
    if (bike) {
      // Fahrrad: Antreten dauert, Bremsen greift kraeftig, und ohne
      // Tasten rollt es einfach weiter — es geht ja bergab.
      if (ax !== 0) {
        var bremst = (this.vx !== 0 && (ax > 0) !== (this.vx > 0));
        this.vx += ACC * ax * (bremst ? 1.1 : 0.5);
      } else {
        this.vx *= (auto && g.autoAx === 0) ? 0.9 : (this.grounded ? 0.988 : 0.995);
        if (Math.abs(this.vx) < 0.05) this.vx = 0;
      }
      if (Math.abs(this.vx) > 0.4) this.facing = this.vx > 0 ? 1 : -1;
      else if (ax !== 0) this.facing = ax > 0 ? 1 : -1;
    } else if (ax !== 0) {
      this.vx += ACC * ax;
      this.facing = ax > 0 ? 1 : -1;
    } else {
      // Besoffen rutscht er nach: Alex hat ihm eine Flasche uebergekippt.
      this.vx *= this.grounded ? (wankt ? 0.9 : FRIC_GROUND) : FRIC_AIR;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
    if (wankt && !this.dead) this.vx += Math.sin(g.tick * 0.043) * 0.085;
    if (this.vx > maxS) this.vx = maxS;
    if (this.vx < -maxS) this.vx = -maxS;
    // Semih schreit RAUS: der Luftstoss schiebt (auch ueber das Tempo hinaus)
    if (g.wind && !frozen) this.vx += g.wind;

    /* --- Bauch-Stampfer (nicht auf dem Fahrrad) ---
       Er kostet Puste. Ohne Puste gibt es keinen Stampfer — sonst
       haemmert man sich mit Dauerfeuer durch jeden Bosskampf. */
    if (this.stamina < this.stamMax && this.pound === 0) {
      this.stamina = Math.min(this.stamMax, this.stamina + STAM_REGEN);
    }
    if (this.pustT > 0) this.pustT--;
    if (!bike && this.pound === 0 && !this.grounded && wantDown && this.vy > -3) {
      if (this.stamina >= POUND_COST) {
        this.stamina -= POUND_COST;
        this.pound = POUND_CHARGE;
        this.vy = 0; this.vx = 0;
        global.Sound.play('select');
      } else if (this.pustT <= 0) {
        this.pustT = 40;
        global.Sound.play('move');
        g.floats.add(this.cx(), this.y - 6, 'KEINE PUSTE MEHR!', '#c8c0d8', 45);
      }
    }
    if (this.pound > 0) {
      this.pound--;
      this.vx = 0; this.vy = 0;
      if (this.pound === 0) { this.pound = -1; global.Sound.play('pound'); }
    }

    /* --- Sprung --- */
    if (this.grounded) { this.coyote = COYOTE; this.jumpsLeft = 2; }
    else if (this.coyote > 0) this.coyote--;
    if (wantJump) this.buffer = BUFFER;
    else if (this.buffer > 0) this.buffer--;

    if (this.buffer > 0 && this.pound >= 0) {
      if (this.coyote > 0) {
        this.vy = bike ? BIKE_HOP : (this.stick > 0 ? JUMP_V * 0.72 : JUMP_V);
        this.grounded = false; this.coyote = 0;
        this.jumpsLeft = 1; this.buffer = 0;
        global.Sound.play('jump');
        g.particles.burst(this.cx(), this.feet(), 5,
          { col: '#e8dcc0', spread: 1.3, up: 0.2, life: 16, grav: 0.1 });
      } else if (bike) {
        // Auf dem Fahrrad gibt es keinen Bauch-Boost. Stattdessen:
        // Rueckwaertssalto. Sauber landen muss man selbst.
        if (!this.flipping) {
          this.flipping = true;
          this.flipA = 0;
          global.Sound.play('select');
        }
        this.buffer = 0;
      } else if (this.jumpsLeft > 0) {
        this.vy = JUMP2_V; this.jumpsLeft = 0; this.buffer = 0;
        this.pound = 0;
        global.Sound.play('doubleJump');
        // Bauch-Boost: Yusuf drückt sich an der Luft ab. Physik ist relativ.
        for (var i = 0; i < 8; i++) {
          var a = Math.PI + (i / 7) * Math.PI;
          g.particles.spawn({ x: this.cx(), y: this.feet() - 4,
            vx: Math.cos(a) * 1.7, vy: -Math.sin(a) * 1.1 + 0.4,
            life: 20, col: '#fff0c0', size: 2, grav: 0.06 });
        }
      }
    }
    // Sprung abschneiden, wenn losgelassen. Nicht nach einer Rampe:
    // dort hat niemand die Taste gedrueckt, und der Flug waere sofort weg.
    if (!holdJump && this.vy < -2.5 && this.pound >= 0 && !this.kicked) this.vy *= 0.52;
    this.jumpHeld = holdJump;

    /* --- Schwerkraft --- (im Kosmos bei Semih: fast schwerelos) */
    if (this.pound === 0) {
      var schwere = g.schwere || 1;
      this.vy += GRAV * schwere;
      if (this.vy > MAX_FALL * Math.min(1, schwere + 0.25)) this.vy = MAX_FALL * Math.min(1, schwere + 0.25);
    } else if (this.pound === -1) {
      this.vy = POUND_SPEED;
    }

    /* --- Rueckwaertssalto --- */
    if (this.flipping) {
      this.flipA += FLIP_SPD;
      if (this.flipA >= Math.PI * 2) {
        this.flipA = 0;
        this.flipping = false;
        this.flipsAir++;
        global.Sound.play('coinBlock');
        g.floats.add(this.cx(), this.y - 14,
                     this.flipsAir > 1 ? this.flipsAir + 'x SALTO!' : 'SALTO!', '#ffe38a', 40);
      }
    }

    /* --- Bewegung + Kollision --- */
    var wasGrounded = this.grounded;
    var prevCx = this.cx();
    this.landTile = null; this.headTile = null; this.wallTile = null;

    moveX(this, world, this.vx);

    this.grounded = false;
    var hitY = moveY(this, world, this.vy);
    if (hitY === 1) this.grounded = true;
    if (hitY === -1 && this.headTile) this.bumpBlock(g, this.headTile);

    /* --- Bewegliche Tabletts --- */
    this.rideMovers(world);

    /* --- Landung --- */
    if (this.grounded && !wasGrounded) {
      if (bike) this.bikeLand(g);
      if (this.pound === -1) {
        this.pound = 0;
        g.shake(7, 14);
        global.Sound.play('land');
        g.particles.burst(this.cx(), this.feet(), 16,
          { col: '#e8dcc0', spread: 3.4, up: 0.2, life: 24, grav: 0.22 });
        this.poundImpact(g);
      } else if (this.vy >= 0) {
        global.Sound.play('land');
        g.particles.burst(this.cx(), this.feet(), 4,
          { col: '#e8dcc0', spread: 1.2, up: 0.1, life: 12, grav: 0.14 });
      }
      // Sprungkissen?
      if (this.landTile) {
        var sp = world.specialAt(this.landTile[0], this.landTile[1]);
        if (sp === 2) {
          this.vy = -12.4; this.grounded = false; this.jumpsLeft = 1;
          global.Sound.play('doubleJump');
          g.floats.add(this.cx(), this.y - 4, 'HOPP!', '#ff9ec4', 40);
          g.particles.burst(this.cx(), this.feet(), 10,
            { col: '#ff9ec4', spread: 2.2, up: 1, life: 22 });
        }
      }
    }

    /* --- Rampen: an der Kante hebt das Fahrrad ab --- */
    if (bike && this.grounded && this.vx > 1.2 && !this.dead) {
      for (var ki = 0; ki < world.kickers.length; ki++) {
        var kk = world.kickers[ki];
        if (prevCx < kk.x && this.cx() >= kk.x && Math.abs(this.feet() - kk.y) < 4) {
          this.vy = -(KICK_BASE + this.vx * 0.9);
          this.grounded = false;
          this.coyote = 0;
          this.kicked = true;
          global.Sound.play('doubleJump');
          g.particles.burst(kk.x, kk.y - 4, 10,
            { col: '#c8a070', spread: 2.2, up: 0.8, life: 22 });
          if (!g.kickHint) {
            g.kickHint = true;
            g.floats.add(this.cx(), this.y - 18, 'JETZT SPRUNG = SALTO!', '#ffd257', 90);
          }
          break;
        }
      }
    }

    /* --- Gefahren ---
       Nicht, solange die Welt steht (Dialog, Boss liegt, Levelende):
       "Man kann nicht sterben, waehrend jemand redet." Frueher stach die
       Gabel trotzdem zu, wenn Yusuf beim Dialogstart darin stand. */
    if (!frozen) {
      for (var hi = 0; hi < world.hazards.length; hi++) {
        var hz = world.hazards[hi];
        if (overlap(this, hz)) { this.hurt(g, 1, hz.x + hz.w / 2); break; }
      }
    }

    /* --- Aus der Welt gefallen --- (im Stillstand haelt er sich knapp
       unter dem Rand fest und faellt erst danach weiter) */
    if (this.y > world.h * T + 40) {
      if (frozen) { this.y = world.h * T + 40; this.vy = 0; }
      else this.kill(g, true);
    }

    /* --- Rauchfahne --- */
    if (this.smoke && g.tick % 9 === 0) {
      g.particles.spawn({
        x: this.cx() + this.facing * 9, y: this.y + 10,
        vx: this.facing * 0.12 + (Math.random() - 0.5) * 0.25, vy: -0.42,
        life: 48, col: '#8e8880', size: 2, grav: -0.008
      });
    }

    /* --- Animation --- */
    // Ruhig halten: Laufzyklus ca. 5 Frames pro Bild, Atmen im Stand sehr langsam.
    this.animT += Math.max(0.022, Math.abs(this.vx) * 0.065);
    while (this.animT >= 1) { this.animT -= 1; this.anim++; }
  };

  Player.prototype.rideMovers = function (world) {
    for (var i = 0; i < world.movers.length; i++) {
      var m = world.movers[i];
      var feet = this.y + this.h;
      if (this.x + this.w > m.x + 1 && this.x < m.x + m.w - 1 &&
          feet >= m.y - 2 && feet <= m.y + m.h + Math.max(3, this.vy + 2) &&
          this.vy >= -0.5) {
        this.y = m.y - this.h;
        this.vy = 0;
        this.grounded = true;
        this.x += m.dx;
        if (m.dy < 0) this.y += m.dy;
      }
    }
  };

  /** Block von unten anstoßen. */
  Player.prototype.bumpBlock = function (g, tile) {
    var b = g.world.blockAt(tile[0], tile[1]);
    if (!b || b.dead) return;
    if (b.type === 'q') {
      if (b.used) { global.Sound.play('select'); return; }
      b.bump = 8;
      b.count--;
      this.spawnFromBlock(g, b);
      if (b.count <= 0) b.used = true;
    } else if (b.type === 'kiste') {
      b.bump = 8;
      this.breakCrate(g, b);
    }
  };

  /** Laeuft gerade ein Bosskampf? Dann gibt es keinen Gold-Doener (Esat,
      29.09.: sonst ist man einfach unverwundbar und haut den Boss um). */
  function imBosskampf(g) { return !!(g.boss && g.bossStarted && !g.boss.dead); }

  Player.prototype.spawnFromBlock = function (g, b) {
    var item = b.item || 'honig';
    if (item === 'gold' && imBosskampf(g)) item = 'herz';
    var px = b.x * T + T / 2, py = b.y * T - 4;
    if (item === 'honig') {
      g.addItem('honig', px, py, true);
      global.Sound.play('coinBlock');
    } else {
      g.addItem(item, px, py, true);
      global.Sound.play('power');
    }
    g.particles.burst(px, b.y * T, 6, { col: '#ffe38a', spread: 1.8, up: 1.2, life: 18 });
  };

  Player.prototype.breakCrate = function (g, b) {
    global.Sound.play('brk');
    g.particles.burst(b.x * T + 8, b.y * T + 8, 14,
      { col: '#c79a5a', spread: 2.6, up: 0.6, life: 28, size: 3 });
    g.particles.burst(b.x * T + 8, b.y * T + 8, 6,
      { col: '#7d5224', spread: 2, up: 0.4, life: 24, size: 2 });
    if (b.item) g.addItem(b.item === 'gold' && imBosskampf(g) ? 'herz' : b.item, b.x * T + 8, b.y * T - 2, true);
    g.world.clearBlock(b);
    this.score += 50;
    g.floats.add(b.x * T + 8, b.y * T, '+50', '#e8dcc0', 40);
  };

  /** Einschlag des Bauch-Stampfers: Blöcke drunter + Gegner in der Nähe. */
  Player.prototype.poundImpact = function (g) {
    var tx0 = Math.floor((this.x - 6) / T), tx1 = Math.floor((this.x + this.w + 6) / T);
    var ty = Math.floor((this.feet() + 2) / T);
    for (var tx = tx0; tx <= tx1; tx++) {
      var b = g.world.blockAt(tx, ty);
      if (!b || b.dead) continue;
      if (b.type === 'kiste') this.breakCrate(g, b);
      // Fragezeichen-Bloecke, die auf Boden oder einer Plattform stehen,
      // kann man von unten gar nicht erreichen. Der Stampfer von oben
      // loest sie deshalb genauso aus.
      else if (b.type === 'q' && !b.used) {
        b.bump = 8;
        b.count--;
        this.spawnFromBlock(g, b);
        if (b.count <= 0) b.used = true;
      }
    }
    // Schockwelle (und eine sichtbare Druckwelle am Boden, ebenen.js)
    if (g.einschlag) g.einschlag(this.cx(), this.feet(), 'stampfer');
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (e.dead) continue;
      var d = Math.abs(e.x + e.w / 2 - this.cx());
      var dy = Math.abs(e.y + e.h - this.feet());
      if (d < 52 && dy < 30) e.squash(g, this);
    }
    if (g.boss && !g.boss.dead) {
      var bd = Math.abs(g.boss.x + g.boss.w / 2 - this.cx());
      var bdy = Math.abs(g.boss.y + g.boss.h - this.feet());
      // WICHTIG: alle Boss-Klassen erwarten hier den Spieler als dritten
      // Wert. Frueher stand hier ein "true" — das hat beim Bauch-Stampfer
      // auf Mirkan, Lennart, Erfan und Esat das Spiel abstuerzen lassen.
      if (bd < 56 && bdy < 34) g.boss.hit(g, POUND_BOSS_DMG, this);
    }
    for (var s = 0; s < 14; s++) {
      g.particles.spawn({
        x: this.cx(), y: this.feet(),
        vx: (s / 13 - 0.5) * 8, vy: -Math.random() * 1.6,
        life: 22, col: '#fff0c0', size: 2, grav: 0.3
      });
    }
  };

  /** Landung mit dem Fahrrad: Saltos werten — oder auf die Nase fallen. */
  Player.prototype.bikeLand = function (g) {
    this.kicked = false;
    var a = this.flipA, flips = this.flipsAir;
    this.flipsAir = 0;
    if (this.flipping) {
      this.flipping = false;
      this.flipA = 0;
      // Fast ganz rum zaehlt noch. Halb rum heisst: aufs Gesicht.
      if (a > Math.PI * 2 - FLIP_OK) flips++;
      else if (a > FLIP_OK) { this.crash(g); return; }
    }
    if (flips <= 0) return;
    var pts = 300 * flips * flips;
    this.score += pts;
    this.flipCount = (this.flipCount || 0) + flips;
    this.laughTimer = 40;
    var name = flips === 1 ? 'RÜCKWÄRTSSALTO' : (flips === 2 ? 'DOPPELSALTO' : flips + 'FACH-SALTO');
    g.floats.add(this.cx(), this.y - 22, name + '! +' + pts, '#ffd257', 80);
    global.Sound.play(flips > 1 ? 'oneUp' : 'power');
    g.particles.burst(this.cx(), this.feet() - 6, 12 + flips * 6,
      { col: '#ffd257', spread: 2.8, up: 1.2, life: 30 });
    if (g.onFlip) g.onFlip(flips);
  };

  /** Ueberdreht gelandet. */
  Player.prototype.crash = function (g) {
    g.floats.add(this.cx(), this.y - 16, 'ÜBERDREHT!', '#ff8a8a', 60);
    g.particles.burst(this.cx(), this.feet(), 14,
      { col: '#8a6440', spread: 3, up: 1, life: 26 });
    this.hurt(g, 1, this.cx() + this.facing * 10);
  };

  /** Das tiefe Knurren. Kommt oft. Ohne Vorwarnung. */
  Player.prototype.doGrowl = function (g, line) {
    if (this.growlCool > 0 || this.dead) return;
    this.growlCool = 80;
    this.growlTimer = 24;
    global.Sound.play('growl');
    var l = global.Levels.growlLines;
    g.floats.add(this.cx(), this.y - 6,
                 line || l[(Math.random() * l.length) | 0], '#d8b478', 48);
  };

  Player.prototype.hurt = function (g, dmg, fromX) {
    if (this.invuln > 0 || this.dead) return;
    if (this.power > 0) return;
    // Boss liegt schon: Was jetzt noch trifft, zaehlt nicht mehr. Sonst
    // konnte man im selben Moment gewinnen und sterben — und musste nach
    // dem Wiederbeleben den ganzen Kampf nochmal machen. (Nach Mirkan,
    // Lennart und Erfan geht das Level danach normal weiter.)
    if (g.boss && g.boss.dead && !g.bossCleared) return;
    // Wer getroffen wird, dreht keinen Salto mehr zu Ende
    this.flipping = false; this.flipA = 0; this.flipsAir = 0;

    // Mit Kippen im Sack kostet ein Treffer nur das Päckchen, kein Herz.
    if (this.smoke) {
      this.smoke = false;
      this.invuln = 90;
      this.hurtTimer = 30;
      this.sleeping = false;
      var d0 = (fromX !== undefined && fromX > this.cx()) ? -1 : 1;
      this.vx = d0 * 2.6; this.vy = -3.6; this.grounded = false;
      g.shake(4, 8);
      global.Sound.play('hurt');
      g.floats.add(this.cx(), this.y - 8, 'MEINE KIPPEN!', '#ffb46a', 60);
      g.particles.burst(this.cx(), this.y + 10, 12,
        { col: '#9a9088', spread: 2.2, up: 0.8, life: 34, grav: -0.02 });
      this.doGrowl(g, 'KRRRRR!');
      return;
    }

    this.hp -= dmg;
    if (g.einschlag) g.einschlag(this.cx(), this.y + this.h / 2, 'aua');
    // Der Boss freut sich, wenn er trifft — und ist dabei kurz offen
    if (g.boss && !g.boss.dead && g.boss.yusufGetroffen && this.hp > 0) g.boss.yusufGetroffen(g);
    this.invuln = global.Balance.s('unverwundbar');
    this.hurtTimer = 40;
    this.sleeping = false;
    this.pound = 0;
    var dir = (fromX !== undefined && fromX > this.cx()) ? -1 : 1;
    this.vx = dir * 3.1;
    this.vy = -4.2;
    this.grounded = false;
    g.shake(5, 10);
    global.Sound.play('hurt');
    // Beim Airsoft callt Yusuf seinen Hit nicht. Er hat immer eine Ausrede.
    var airsoft = !!(g.lvl && g.lvl.airsoft && global.Levels.airsoft);
    var lines = airsoft ? global.Levels.airsoft.kein : global.Levels.hurtLines;
    if (this.hp > 0 || !airsoft) g.floats.add(this.cx(), this.y - 6, lines[(Math.random() * lines.length) | 0], '#ff8a8a', 55);
    if (this.hp <= 0) this.kill(g);
  };

  Player.prototype.kill = function (g, fell) {
    if (this.dead) return;
    this.dead = true;
    this.deadTimer = 0;
    this.hp = 0;
    this.vy = fell ? 4 : -9;
    this.vx = 0;
    global.Sound.play('die');
    g.shake(6, 16);
    // Nur jetzt, wo er wirklich liegt, ruft er ihn: HIT! HIT! HIT!
    this.hitCall = !fell && !!(g.lvl && g.lvl.airsoft);
    if (this.hitCall) {
      this.vy = 0;
      var as = global.Levels.airsoft || {};
      g.floats.add(this.cx(), this.y - 16, as.tod || 'HIT!', '#ff8a2a', 110);
      g.floats.add(this.cx(), this.y - 30, as.todUnter || '', '#c8c0d8', 110);
    }
    if (g.onKill) g.onKill(!!fell);   // Grabstein, Aura, Trophaeen (spass.js)
  };

  Player.prototype.deadUpdate = function (g) {
    this.deadTimer++;
    // Wer HIT ruft, bleibt mit erhobener Hand stehen
    if (!this.hitCall) {
      this.vy += GRAV * 0.75;
      this.y += this.vy;
    }
    // Nur EINMAL melden — sonst frisst die Blende alle Leben auf.
    if (this.deadTimer > SP.TOD_DAUER && !this.deadHandled) {
      this.deadHandled = true;
      g.onPlayerDead();
    }
  };

  Player.prototype.heal = function (g, n) {
    if (this.hp >= this.maxHp) { this.score += 200; g.floats.add(this.cx(), this.y - 6, '+200', '#ffd257'); return; }
    this.hp = Math.min(this.maxHp, this.hp + n);
    global.Sound.play('heal');
  };

  Player.prototype.pose = function () {
    if (this.dead) return this.hitCall ? { pose: 'cheer', face: 'hurt' } : { pose: 'hurt', face: 'hurt' };
    if (this.won || this.cheer > 0) return { pose: 'cheer', face: 'laugh' };
    if (this.sleeping) return { pose: 'sleep', face: 'sleep' };
    if (this.punchT > 0) return { pose: 'punch', face: 'growl' };
    var face = 'normal';
    if (this.growlTimer > 0) face = 'growl';
    else if (this.hurtTimer > 0) face = 'hurt';
    else if (this.eatTimer > 0) face = ((this.eatTimer >> 2) % 2) ? 'eat' : 'laugh';   // Schnelltakt
    else if (this.laughTimer > 0) face = 'laugh';
    else if (this.smoke) face = 'smoke';

    if (this.pound > 0) return { pose: 'duck', face: face };
    if (this.pound === -1) return { pose: 'pound', face: face };
    if (!this.grounded) return { pose: this.vy < 0 ? 'jump' : 'fall', face: face };
    if (global.Input.down('down')) return { pose: 'duck', face: face };
    if (Math.abs(this.vx) > 0.3) return { pose: 'run', face: face };
    return { pose: 'idle', face: face };
  };

  /* ================= Gegner ================= */

  var ENEMY = {
    wecker:  { w: 14, h: 14, spr: ['wecker', 'wecker2'], score: 100, hp: 1 },
    biene:   { w: 13, h: 11, spr: ['biene', 'biene2'], score: 150, hp: 1, fly: true },
    broki:   { w: 14, h: 14, spr: ['broki', 'broki2'], score: 120, hp: 1 },
    salat:   { w: 14, h: 12, spr: ['salat', 'salat2'], score: 140, hp: 1 },
    // Die Gym-Typen (Level 3-5): ein Sprung reicht. Mit zwei Treffern war
    // Level 3 das schwerste Level vor Level 13 — viel zu frueh.
    lennart: { w: 20, h: 22, spr: ['lennart', 'lennart2'], score: 320, hp: 1 },
    drohne:  { w: 16, h: 12, spr: ['drohne', 'drohne2'], score: 200, hp: 1, fly: true },
    agent:   { w: 14, h: 12, spr: ['agent', 'agent2'], score: 180, hp: 1, fly: true },
    polizei: { w: 14, h: 24, spr: ['polizei', 'polizei2'], score: 250, hp: 1 },
    // Level 9, Sparmarkt
    wagen:   { w: 21, h: 14, spr: ['wagen', 'wagen2'], score: 170, hp: 1 },
    tomate:  { w: 10, h: 10, spr: ['tomate', 'tomate2'], score: 130, hp: 1 },
    wurst:   { w: 14, h: 9, spr: ['wurst', 'wurst2'], score: 150, hp: 1 },
    // Level 11: Brokes kleine Kollegen. Alle heissen Mika.
    mika:    { w: 11, h: 16, spr: ['mika', 'mika2'], score: 120, hp: 1 },
    // Level 13, bei Hamza
    falafel:  { w: 12, h: 12, spr: ['falafel', 'falafel2'], score: 130, hp: 1 },
    peperoni: { w: 8, h: 14, spr: ['peperoni', 'peperoni2'], score: 120, hp: 1 },
    pita:     { w: 14, h: 9, spr: ['pita', 'pita2'], score: 150, hp: 1, fly: true },
    // Level 14, Stilbruch: die Typen vom Nebentisch
    typ1:     { w: 11, h: 17, spr: ['typ1', 'typ1b'], score: 160, hp: 1 },
    typ2:     { w: 11, h: 17, spr: ['typ2', 'typ2b'], score: 160, hp: 1 },
    typ3:     { w: 11, h: 17, spr: ['typ3', 'typ3b'], score: 160, hp: 1 },
    // Level 15, bei Georgios: Meeresfruechte
    krabbe:   { w: 16, h: 10, spr: ['krabbe', 'krabbe2'], score: 150, hp: 1 },
    krake:    { w: 14, h: 13, spr: ['krake', 'krake2'], score: 180, hp: 1 },
    fisch:    { w: 14, h: 8, spr: ['fisch', 'fisch2'], score: 160, hp: 1, fly: true },
    // Level 19, im Knast
    insasse:   { w: 12, h: 22, spr: ['insasse', 'insasse2'], score: 160, hp: 1 },
    schlaeger: { w: 16, h: 22, spr: ['schlaeger', 'schlaeger2'], score: 300, hp: 2 },
    waerter:   { w: 14, h: 24, spr: ['waerter', 'waerter2'], score: 220, hp: 1 },
    // Level 21, Airsoft: die Mitspieler. Wer getroffen ist, ruft HIT und
    // geht mit erhobener Hand vom Feld (airsoft.js).
    soldat:     { w: 12, h: 18, spr: ['soldat', 'soldat2'], score: 200, hp: 1, airsoft: true, hitSpr: 'soldat_hit' },
    grena:      { w: 12, h: 18, spr: ['grena', 'grena2'], score: 220, hp: 1, airsoft: true, hitSpr: 'grena_hit' },
    sniper:     { w: 16, h: 16, spr: ['sniper', 'sniper2'], score: 300, hp: 1, airsoft: true, hitSpr: 'sniper_hit' },
    highlander: { w: 12, h: 19, spr: ['highlander', 'highlander2'], score: 450, hp: 3, airsoft: true, hitSpr: 'highlander_hit' },
    // Level 22, Waldweg
    schwein:    { w: 20, h: 13, spr: ['schwein', 'schwein2'], score: 180, hp: 1 },
    // Level 24/25, Flughafen
    reisender:  { w: 11, h: 17, spr: ['reisender', 'reisender2'], score: 150, hp: 1 },
    koffer:     { w: 14, h: 14, spr: ['koffer', 'koffer2'], score: 160, hp: 1 },
    taube:      { w: 13, h: 10, spr: ['taube', 'taube2'], score: 140, hp: 1, fly: true },
    security:   { w: 14, h: 24, spr: ['security', 'security2'], score: 260, hp: 2 },
    parfuem:    { w: 11, h: 17, spr: ['parfuem', 'parfuem2'], score: 200, hp: 1 },
    // Level 26, im Flugzeug
    trolley:    { w: 16, h: 16, spr: ['trolley', 'trolley2'], score: 170, hp: 1 },
    stewardess: { w: 14, h: 22, spr: ['stewardess', 'stewardess2'], score: 220, hp: 1 },
    // Level 28, Istanbul
    moewe:       { w: 16, h: 10, spr: ['moewe', 'moewe2'], score: 160, hp: 1, fly: true },
    dieb:        { w: 11, h: 17, spr: ['dieb', 'dieb2'], score: 220, hp: 1 },
    haendler:    { w: 11, h: 17, spr: ['haendler', 'haendler2'], score: 260, hp: 2 },
    schuhputzer: { w: 11, h: 17, spr: ['schuhputzer', 'schuhputzer2'], score: 170, hp: 1 },
    // Level 29: Semihs Leute. Anzug, Sonnenbrille, Knopf im Ohr (semih.js)
    leibwaechter: { w: 14, h: 24, spr: ['leibwaechter', 'leibwaechter2'], score: 300, hp: 1 }
  };

  function Enemy(type, tx, ty) {
    var d = ENEMY[type];
    this.t = type;
    this.w = d.w; this.h = d.h;
    this.def = d;
    this.hp = d.hp;
    this.x = tx * T + (T - d.w) / 2;
    this.y = d.fly ? ty * T : ty * T - d.h;
    this.homeY = this.y;
    this.homeX = this.x;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * 0.7;
    this.vy = 0;
    this.facing = this.vx > 0 ? 1 : -1;
    this.anim = 0; this.animT = 0;
    this.t0 = (Math.random() * 120) | 0;
    this.dead = false;
    this.deadTimer = 0;
    this.stun = 0;
    this.charge = 0;
    this.roll = 0;
    this.flash = 0;
    this.grounded = false;
    this.active = false;
  }

  Enemy.prototype.cx = function () { return this.x + this.w / 2; };

  Enemy.prototype.update = function (g) {
    if (this.dead) {
      this.deadTimer++;
      if (this.raus) { this.x += this.vx; return; }   // Airsoft: Hand hoch, vom Feld
      this.y += this.vy; this.vy += GRAV * 0.6;
      this.x += this.vx;
      return;
    }
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.stun > 0) { this.stun--; this.vx = 0; }

    var p = g.player;
    var dx = p.cx() - this.cx();
    var dist = Math.abs(dx);

    switch (this.t) {
      case 'wecker': this.upWecker(g, dx, dist); break;
      case 'biene': this.upBiene(g, p, dx); break;
      case 'broki': this.upWalker(g, 0.72 * DIFF); break;
      case 'salat': this.upSalat(g); break;
      case 'lennart': this.upLennart(g, dx, dist); break;
      case 'drohne': this.upDrohne(g, p, dx); break;
      case 'agent': this.upAgent(g, p); break;
      case 'polizei': this.upPolizei(g, p, dx, dist); break;
      case 'wagen': this.upWagen(g, dx, dist); break;
      case 'tomate': this.upSalat(g); break;
      case 'wurst': this.upWalker(g, 0.9 * DIFF); break;
      case 'mika': this.upMika(g, p, dx); break;
      case 'falafel': this.upWagen(g, dx, dist); break;
      case 'peperoni': this.upSalat(g); break;
      case 'pita': this.upBiene(g, p, dx); break;
      case 'typ1': case 'typ2': case 'typ3': this.upTyp(g, p, dx, dist); break;
      case 'krabbe': this.upWalker(g, 1.3 * DIFF); break;
      case 'krake': this.upKrake(g, p, dx, dist); break;
      case 'fisch': this.upBiene(g, p, dx); break;
      case 'insasse': this.upInsasse(g, p, dx, dist); break;
      case 'schlaeger': this.upLennart(g, dx, dist, global.Levels.schlaegerLines); break;
      case 'waerter': this.upPolizei(g, p, dx, dist, 'handschelle', global.Levels.waerterLines); break;
      // Airsoft (Level 21) — das Verhalten steht in airsoft.js
      case 'soldat': case 'highlander': this.upSoldat(g, p, dx, dist); break;
      case 'grena': this.upGrena(g, p, dx, dist); break;
      case 'sniper': this.upSniper(g, p, dx, dist); break;
      case 'schwein': this.upWalker(g, 1.9 * DIFF); break;
      // Level 24-28 (Sonderfaelle in reise.js)
      case 'reisender': this.upWalker(g, 0.75 * DIFF); break;
      case 'koffer': case 'trolley': this.upWagen(g, dx, dist); break;
      case 'taube': if (this.upTaube) this.upTaube(g, p, dx); else this.upBiene(g, p, dx); break;
      case 'security': this.upLennart(g, dx, dist, global.Levels.securityLines); break;
      case 'parfuem': if (this.upParfuem) this.upParfuem(g, p, dx, dist); break;
      case 'stewardess': this.upPolizei(g, p, dx, dist, 'nuss', global.Levels.stewardessLines); break;
      case 'moewe': if (this.upMoewe) this.upMoewe(g, p, dx, dist); else this.upBiene(g, p, dx); break;
      case 'dieb': this.upLennart(g, dx, dist, global.Levels.diebLines); break;
      case 'haendler': this.upPolizei(g, p, dx, dist, 'simit', global.Levels.haendlerLines); break;
      case 'schuhputzer': this.upWalker(g, 0.8 * DIFF); break;
      case 'leibwaechter': this.upLennart(g, dx, dist, global.Levels.leibwaechterLines); break;
    }
    if (this.dead) return;   // Mika ist beim Ansturm vom Rand verschwunden

    this.animT += 1;
    if (this.animT > (this.def.fly ? 5 : (this.t === 'mika' ? 6 : 10))) { this.animT = 0; this.anim ^= 1; }

    // Kontakt mit Yusuf
    if (overlap(this, p) && !p.dead) {
      // Auf dem Fahrrad wird nicht diskutiert.
      if (p.power > 0 || p.pound === -1 || (g.lvl && g.lvl.bike)) {
        this.squash(g, p);
      } else if (p.vy > 0.8 && p.feet() - this.y < 14) {
        this.stomped(g, p);
      } else {
        p.hurt(g, 1, this.cx());
      }
    }
  };

  Enemy.prototype.upWecker = function (g, dx, dist) {
    this.vy += GRAV;
    if (this.grounded && this.stun <= 0 && this.t0 % Math.round(62 / DIFF) === 0) {
      this.vy = -5.4;
      this.vx = (dist < 150 ? (dx > 0 ? 0.95 : -0.95) * DIFF : this.vx);
      this.facing = this.vx > 0 ? 1 : -1;
    }
    this.grounded = false;
    if (moveX(this, g.world, this.vx) !== 0) { this.vx = -this.vx; this.facing = -this.facing; }
    if (moveY(this, g.world, this.vy) === 1) { this.grounded = true; this.vx *= 0.82; }
  };

  Enemy.prototype.upBiene = function (g, p, dx) {
    // Fliegt Sinus und driftet langsam auf Yusuf zu.
    var target = this.homeX + Math.sin(this.t0 * 0.028) * 40;
    if (Math.abs(dx) < 130) target = p.cx() - this.w / 2;
    this.x += Math.max(-1.05, Math.min(1.05, (target - this.x) * 0.045));
    this.y = this.homeY + Math.sin(this.t0 * 0.062) * 16;
    this.facing = (p.cx() > this.cx()) ? 1 : -1;
  };

  Enemy.prototype.upWalker = function (g, spd) {
    if (this.stun > 0) { this.vy += GRAV; moveY(this, g.world, this.vy); return; }
    this.vx = (this.facing > 0 ? spd : -spd);
    this.vy += GRAV;
    if (moveX(this, g.world, this.vx) !== 0) this.facing = -this.facing;
    // Kante erkennen, damit sie nicht runterfallen
    var aheadX = this.facing > 0 ? this.x + this.w + 2 : this.x - 2;
    var below = Math.floor((this.y + this.h + 4) / T);
    if (this.grounded && !g.world.solid(Math.floor(aheadX / T), below)) {
      this.facing = -this.facing;
    }
    this.grounded = (moveY(this, g.world, this.vy) === 1);
  };

  Enemy.prototype.upSalat = function (g) {
    this.vy += GRAV * 0.9;
    // Vor einer Wand umdrehen, statt hinaufzuhuepfen (Esat, 02.10.: die
    // Peperoni bei Hamza sprangen hinten auf die Wand). Eine Wand ist alles,
    // was vor ihm von den Fuessen bis zwei Kacheln darueber steht.
    var vorX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
    var fussTy = Math.floor((this.y + this.h - 1) / T), vorTx = Math.floor(vorX / T);
    for (var wy = fussTy - 2; wy <= fussTy; wy++) {
      if (g.world.solid(vorTx, wy)) { this.vx = -this.vx; break; }
    }
    if (moveX(this, g.world, this.vx) !== 0) this.vx = -this.vx;
    if (moveY(this, g.world, this.vy) === 1) this.vy = -6.2;  // hüpft ewig
    this.facing = this.vx > 0 ? 1 : -1;
    if (Math.abs(this.vx) < 1) this.vx = this.vx >= 0 ? 1.15 : -1.15;
  };

  Enemy.prototype.upLennart = function (g, dx, dist, sprueche) {
    this.vy += GRAV;
    if (this.stun > 0) { this.grounded = (moveY(this, g.world, this.vy) === 1); return; }

    if (this.charge > 0) {
      this.charge--;
      this.vx = this.facing * 2.75 * DIFF;
      if (this.charge === 0) this.vx = 0;
    } else if (dist < 80 * DIFF && Math.abs(dx) > 8 && this.t0 % 30 === 0) {
      this.facing = dx > 0 ? 1 : -1;
      this.charge = 42;
      global.Sound.play('shoot');
      var lines = sprueche || global.Levels.lennartLines;
      g.floats.add(this.cx(), this.y - 8,
                   lines[(Math.random() * lines.length) | 0], '#ffd257', 55);
    } else {
      this.vx = this.facing * 0.85;
    }

    if (moveX(this, g.world, this.vx) !== 0) { this.facing = -this.facing; this.charge = 0; }
    var aheadX = this.facing > 0 ? this.x + this.w + 2 : this.x - 2;
    var below = Math.floor((this.y + this.h + 4) / T);
    if (this.grounded && this.charge === 0 &&
        !g.world.solid(Math.floor(aheadX / T), below)) this.facing = -this.facing;
    this.grounded = (moveY(this, g.world, this.vy) === 1);
  };

  Enemy.prototype.upDrohne = function (g, p, dx) {
    this.y = this.homeY + Math.sin(this.t0 * 0.045) * 9;
    if (Math.abs(dx) < 190) {
      this.x += Math.max(-0.62, Math.min(0.62, dx * 0.02));
    } else {
      this.x = this.homeX + Math.sin(this.t0 * 0.02) * 30;
    }
    this.facing = dx > 0 ? 1 : -1;
    if (this.t0 % Math.round(120 / DIFF) === 0 && Math.abs(dx) < 170) {
      g.addProjectile('sellerie', this.cx() - 3, this.y + this.h, 0, 1.2);
      global.Sound.play('shoot');
    }
  };

  /** Einkaufswagen: rollt gemuetlich — bis Yusuf vor ihm steht. */
  Enemy.prototype.upWagen = function (g, dx, dist) {
    var rollt = (dist < 150 && (dx > 0) === (this.facing > 0));
    if (rollt && this.roll < 60) this.roll = 60;
    if (this.roll > 0) this.roll--;
    var spd = (this.roll > 0 ? 2.7 : 0.9) * DIFF;
    this.vx = this.facing * spd;
    this.vy += GRAV;
    if (moveX(this, g.world, this.vx) !== 0) { this.facing = -this.facing; this.roll = 0; }
    var aheadX = this.facing > 0 ? this.x + this.w + 2 : this.x - 2;
    var below = Math.floor((this.y + this.h + 4) / T);
    if (this.grounded && !g.world.solid(Math.floor(aheadX / T), below)) {
      this.facing = -this.facing; this.roll = 0;
    }
    this.grounded = (moveY(this, g.world, this.vy) === 1);
    if (this.roll > 0 && this.t0 % 6 === 0) {
      g.particles.spawn({ x: this.cx(), y: this.y + this.h, vx: -this.facing * 0.8,
                          vy: -0.3, life: 14, col: '#c8ccd6', size: 2, grav: 0.1 });
    }
  };

  /** Mika: rennt Yusuf hinterher und huepft dabei. Beim Ansturm (Brokes
      Mika-Armee) laeuft er stur geradeaus und ist am Rand einfach weg. */
  Enemy.prototype.upMika = function (g, p, dx) {
    this.vy += GRAV;
    if (this.stampede) {
      this.vx = this.facing * 2.7 * DIFF;
    } else if (this.stun <= 0) {
      // Etwas langsamer als Yusuf zu Fuss — sonst gibt es kein Entkommen
      var want = (dx > 0 ? 1 : -1) * 1.25 * DIFF;
      this.vx += (want - this.vx) * 0.12;
      if (Math.abs(dx) > 6) this.facing = dx > 0 ? 1 : -1;
      // Huepft regelmaessig — und etwas oefter, wenn Yusuf ueber ihm steht.
      // Frueher alle 26 Ticks und hoch (-7.6): Draufspringen wurde zur
      // Falle, die Mikas brachten im Test ~40 Treffer pro Broke-Kampf.
      var above = (p.feet() < this.y - 12);
      if (this.grounded && (this.t0 % 72 === 0 || (above && this.t0 % 54 === 0))) {
        this.vy = above ? -6.4 : -5.6;
      }
    }
    if (moveX(this, g.world, this.vx) !== 0) {
      if (this.stampede) { this.vanish(); return; }
      if (this.grounded) this.vy = -5.8;       // Hindernis: drueber
    }
    this.grounded = (moveY(this, g.world, this.vy) === 1);
  };

  /** Typ vom Nebentisch (Level 14): steht rum, dreht sich zu Yusuf und
      wirft abwechselnd Shisha-Zangen und heisse Kohle im Bogen. */
  Enemy.prototype.upTyp = function (g, p, dx, dist) {
    this.vy += GRAV;
    if (dist < 260) this.facing = dx > 0 ? 1 : -1;
    // Tritt ein bisschen auf der Stelle hin und her
    var want = Math.sin(this.t0 * 0.02) * 0.35;
    if (Math.abs(this.x - this.homeX) > 18) want = (this.homeX - this.x) > 0 ? 0.35 : -0.35;
    this.vx = want;
    if (this.stun <= 0) {
      var every = Math.round(118 / DIFF);
      if (dist < 230 && dist > 22 && this.t0 % every === 0) {
        this.throwN = (this.throwN || 0) + 1;
        var kohle = (this.throwN % 2 === 0);
        var tvx = Math.max(-3.4, Math.min(3.4, dx / (kohle ? 44 : 36)));
        g.addProjectile(kohle ? 'kohle' : 'zange', this.cx() - 5, this.y + 3,
                        tvx, kohle ? -5.2 : -4.4);
        global.Sound.play('shoot');
        if (Math.random() < 0.3) {
          var tl = global.Levels.typLines || ['WAS GUCKST DU?'];
          g.floats.add(this.cx(), this.y - 10, tl[(Math.random() * tl.length) | 0], '#c8c0d8', 60);
        }
      }
    }
    moveX(this, g.world, this.vx);
    this.grounded = (moveY(this, g.world, this.vy) === 1);
  };

  /** Krake (Level 15): huepft traege und spuckt Tinte. */
  Enemy.prototype.upKrake = function (g, p, dx, dist) {
    this.vy += GRAV * 0.7;
    if (this.grounded && this.t0 % 80 === 0) {
      this.vy = -5;
      this.vx = (dx > 0 ? 0.6 : -0.6) * DIFF;
    }
    if (this.grounded) this.vx *= 0.8;
    this.facing = dx > 0 ? 1 : -1;
    if (dist < 170 && dist > 20 && this.t0 % Math.round(160 / DIFF) === 40) {
      g.addProjectile('tinte', this.cx() - 3, this.y + 4, (dx > 0 ? 1 : -1) * 2.4, -2.2);
      global.Sound.play('shoot');
    }
    if (moveX(this, g.world, this.vx) !== 0) this.vx = -this.vx;
    this.grounded = (moveY(this, g.world, this.vy) === 1);
  };

  /** Insasse (Level 19): schlendert, kommt naeher, holt aus — und haut zu.
      Das Ausholen sieht man (er blinkt), also kann man vorher springen. */
  Enemy.prototype.upInsasse = function (g, p, dx, dist) {
    this.vy += GRAV;
    if (this.stun > 0) { this.grounded = (moveY(this, g.world, this.vy) === 1); return; }
    var nah = dist < 150 && Math.abs(p.feet() - (this.y + this.h)) < 24;
    if (this.wind > 0) {
      this.wind--;
      this.vx = 0;
      if (this.wind === 0) {
        var fx = this.facing > 0 ? this.x + this.w - 2 : this.x - 16;
        var f = g.addProjectile('faust', fx, this.y + 4, 0, 0);
        if (f) { f.w = 18; f.h = 12; f.life = 6; }
        global.Sound.play('stomp');
      }
    } else {
      if (nah) this.facing = dx > 0 ? 1 : -1;
      this.vx = this.facing * (nah ? 1.0 : 0.5) * DIFF;
      if (nah && dist < 34 && this.t0 % 40 === 0) {
        this.wind = Math.round(20 / DIFF) + 4;
        this.flash = this.wind;
        if (Math.random() < 0.5) {
          var kl = global.Levels.knastLines || ['WAS GUCKST DU?'];
          g.floats.add(this.cx(), this.y - 10, kl[(Math.random() * kl.length) | 0], '#f07a28', 55);
        }
      }
    }
    if (moveX(this, g.world, this.vx) !== 0) this.facing = -this.facing;
    var aheadX = this.facing > 0 ? this.x + this.w + 2 : this.x - 2;
    var below = Math.floor((this.y + this.h + 4) / T);
    if (this.grounded && !g.world.solid(Math.floor(aheadX / T), below)) this.facing = -this.facing;
    this.grounded = (moveY(this, g.world, this.vy) === 1);
  };

  /** Von Yusufs Faust getroffen (Level 19). */
  Enemy.prototype.punched = function (g, p) {
    this.hp--;
    this.flash = 10;
    this.wind = 0;
    global.Sound.play('stomp');
    g.shake(3, 6);
    g.particles.burst(this.cx(), this.y + this.h / 2, 8, { col: '#fff0c0', spread: 2.4, up: 0.6, life: 18 });
    if (this.hp <= 0) { this.die(g, p); return; }
    this.stun = 50;
    this.vx = 0;
    g.floats.add(this.cx(), this.y - 8, 'AUA! NOCHMAL?', '#ffd257', 45);
  };

  /** Still verschwinden, ohne Punkte und ohne Todesanimation. */
  Enemy.prototype.vanish = function () {
    this.dead = true;
    this.deadTimer = 71;
    this.vx = 0; this.vy = 0;
  };

  /** Polizist: steht am Strassenrand und wirft Strafzettel im Bogen.
      Kommt der Mustang, hechtet er zur Seite (siehe die()). */
  Enemy.prototype.upPolizei = function (g, p, dx, dist, wurf, sprueche) {
    this.vy += GRAV;
    this.facing = dx > 0 ? 1 : -1;
    this.vx = 0;
    var every = Math.round(96 / DIFF);
    if (dist < 230 && dist > 24 && this.t0 % every === 0) {
      // Vorhalten: dahin werfen, wo der Wagen gleich sein wird
      var lead = p.vx * 26;
      var tvx = Math.max(-3.6, Math.min(3.6, (dx + lead) / 38));
      g.addProjectile(wurf || 'zettel', this.cx() - 5, this.y + 4, tvx, -4.6);
      global.Sound.play('shoot');
      if (Math.random() < 0.5) {
        var pl = sprueche || global.Levels.polizeiLines || ['HALT! POLIZEI!'];
        g.floats.add(this.cx(), this.y - 10, pl[(Math.random() * pl.length) | 0], '#8ab4ff', 60);
      }
    }
    this.grounded = (moveY(this, g.world, this.vy) === 1);
  };

  /** KI-Agent: verfolgt hartnaeckig, aber traege. Stampfbar. */
  Enemy.prototype.upAgent = function (g, p) {
    var tx = p.cx() - this.w / 2;
    var ty = p.y + p.h / 2 - this.h / 2 - 14;
    var sp = 0.055;
    this.x += Math.max(-1.2, Math.min(1.2, (tx - this.x) * sp));
    this.y += Math.max(-1.0, Math.min(1.0, (ty - this.y) * sp));
    this.y += Math.sin(this.t0 * 0.09) * 0.4;
    this.facing = (p.cx() > this.cx()) ? 1 : -1;
    if (this.t0 > 380) this.dead = true;   // loesen sich nach gut 6 Sekunden auf
  };

  /** Von oben plattgemacht. */
  Enemy.prototype.stomped = function (g, p) {
    this.hp--;
    if (this.t === 'highlander') this.hp = 0;   // einen Stiefel auf dem Helm leugnet keiner
    this.flash = 8;
    global.Sound.play('stomp');
    p.vy = global.Input.down('jump') ? -9.4 : -6.6;
    p.jumpsLeft = 1;
    g.shake(3, 6);
    g.particles.burst(this.cx(), this.y + 4, 8,
      { col: '#fff0c0', spread: 2.2, up: 0.8, life: 20 });
    if (this.hp <= 0) this.die(g, p);
    else {
      this.stun = 70;
      g.floats.add(this.cx(), this.y - 8, 'AUTSCH, BRO!', '#ffd257', 45);
    }
  };

  /** Vom Bauch-Stampfer oder Gold-Döner erwischt. */
  Enemy.prototype.squash = function (g, p) {
    if (this.dead) return;
    this.hp = 0;
    this.die(g, p);
    g.shake(2, 5);
  };

  Enemy.prototype.die = function (g, p) {
    this.dead = true;
    this.vy = -3.4;
    this.vx = (this.cx() < p.cx() ? -1.4 : 1.4);
    if (this.def.airsoft) {
      // Airsoft: niemand fliegt weg. Hand hoch, HIT rufen, vom Feld gehen.
      this.raus = true;
      this.vy = 0;
      this.vx = (this.cx() < p.cx() ? -0.6 : 0.6);
      this.facing = this.vx > 0 ? 1 : -1;
      this.aimT = 0;
      var hl = (global.Levels.airsoft || {}).hit || ['HIT!'];
      g.floats.add(this.cx(), this.y - 18, this.t === 'highlander' ? global.Levels.airsoft.highlanderEnde
                   : hl[(Math.random() * hl.length) | 0], '#ff8a2a', 70);
    }
    if (this.t === 'polizei') {
      // Niemand wird ueberfahren: er hechtet in hohem Bogen zur Seite.
      this.vy = -7.5;
      this.vx *= 2.2;
      g.floats.add(this.cx(), this.y - 18, 'HEY! FÜHRERSCHEIN!', '#8ab4ff', 70);
    }
    p.score += this.def.score;
    p.laughTimer = 34;
    if (Math.random() < 0.35) global.Sound.play('laugh');
    g.floats.add(this.cx(), this.y - 6, '+' + this.def.score, '#fff3c8', 45);
    g.particles.burst(this.cx(), this.y + this.h / 2, 10,
      { col: '#ffe38a', spread: 2.6, up: 0.9, life: 26 });

    // Combo: mehrere Gegner ohne Bodenkontakt geben Bonus.
    g.combo++;
    g.comboTimer = 120;
    if (g.combo >= 2) {
      var bonus = this.def.score * (g.combo - 1);
      p.score += bonus;
      g.floats.add(this.cx(), this.y - 20, 'COMBO x' + g.combo + '  +' + bonus,
                   '#ff9ec4', 60);
    }
    if (g.onEnemyKill) g.onEnemyKill(this);   // Hit-Stop, Aura, Trophaeen (spass.js)
  };

  /* ================= Items ================= */

  var ITEM = {
    honig: { w: 12, h: 14, spr: 'honig' },
    goldhonig: { w: 12, h: 14, spr: 'goldhonig' },
    doener: { w: 14, h: 11, spr: 'doener' },
    baklava: { w: 13, h: 9, spr: 'baklava' },
    herz: { w: 11, h: 10, spr: 'herz' },
    gold: { w: 16, h: 13, spr: 'golddoener' },
    kippen: { w: 12, h: 14, spr: 'kippen' },
    kubide: { w: 16, h: 12, spr: 'kubide' },
    shawarma: { w: 14, h: 10, spr: 'shawarma' },
    souvlaki: { w: 16, h: 5, spr: 'souvlaki' },
    boerek: { w: 16, h: 9, spr: 'boerek' },
    // Level 24-28: Brezel vom Flughafenbaecker, Simit, Fischbrot
    brezel: { w: 12, h: 9, spr: 'brezel' },
    simit: { w: 12, h: 11, spr: 'simit' },
    balik: { w: 16, h: 9, spr: 'balik' }
  };

  var FRESSBAR = { shawarma: 1, souvlaki: 1, doener: 1, kubide: 1, baklava: 1, gold: 1, boerek: 1,
                   brezel: 1, simit: 1, balik: 1 };

  /* Was nur heilt, bleibt liegen, solange Yusuf volle Herzen hat (Esat,
     02.10.): Herzen und Essen. Verliert er eins, kann er zurueck und es
     holen. Gold-Doener und Baklava geben mehr als ein Herz — die nimmt
     er immer mit. */
  var HEILT_NUR = { herz: 1, shawarma: 1, souvlaki: 1, doener: 1, kubide: 1, boerek: 1,
                    brezel: 1, simit: 1, balik: 1 };

  function Item(type, x, y, popped) {
    var d = ITEM[type] || ITEM.honig;
    this.t = type;
    this.w = d.w; this.h = d.h;
    this.spr = d.spr;
    this.x = x - d.w / 2; this.y = y - d.h / 2;
    this.oy = this.y;
    this.t0 = (Math.random() * 100) | 0;
    this.dead = false;
    this.vy = popped ? -3.6 : 0;
    this.popped = !!popped;
    this.settle = popped ? 0 : 1;
  }

  Item.prototype.update = function (g) {
    this.t0++;
    if (this.settle === 0) {
      this.vy += GRAV * 0.55;
      this.y += this.vy;
      var ty = Math.floor((this.y + this.h) / T);
      var tx = Math.floor((this.x + this.w / 2) / T);
      if (this.vy > 0 && g.world.solid(tx, ty)) {
        this.y = ty * T - this.h;
        this.oy = this.y;
        this.settle = 1;
      }
      if (this.t0 > 160) { this.oy = this.y; this.settle = 1; }
    } else {
      this.y = this.oy + Math.sin(this.t0 * 0.075) * 2;
    }
    if (this.vollT > 0) this.vollT--;

    var p = g.player;
    if (p.dead || !overlap(this, p)) return;
    if (HEILT_NUR[this.t] && p.hp >= p.maxHp) {
      // Volle Herzen: liegen lassen. Einmal sagen, warum.
      if (!this.vollT) {
        g.floats.add(this.x + this.w / 2, this.y - 10,
                     this.t === 'herz' ? 'HERZEN SIND VOLL. BLEIBT LIEGEN.' : 'HEB ICH MIR AUF. FÜR SPÄTER.',
                     '#c8b8e0', 60);
      }
      this.vollT = 140;
      return;
    }
    this.collect(g);
  };
  Item.HEILT_NUR = HEILT_NUR;

  Item.prototype.collect = function (g) {
    var p = g.player;
    this.dead = true;
    // Gemerkt: was einmal eingesammelt ist, liegt nach einem Tod nicht
    // wieder da (siehe loadLevel). Sonst faehrt man dieselbe Honigspur
    // beliebig oft ab.
    if (g.itemsTaken && this.idx !== undefined) g.itemsTaken[this.idx] = true;
    // Essen wird nicht eingesammelt. Es wird inhaliert: in Stuecken, im
    // Bogen, in den Mund, der dabei weiterlaeuft.
    if (FRESSBAR[this.t] && global.Fress) {
      global.Fress.schlingen(g, {
        von: { x: this.x + this.w / 2, y: this.y + this.h / 2 },
        mund: function () { return { x: p.cx() + p.facing * 4, y: p.feet() - 21 }; },
        spr: [this.spr], n: 4, tempo: 2, gross: 0.75, haende: false
      });
    }
    switch (this.t) {
      case 'honig':
        var leben = p.honigDazu(); p.score += 50;
        global.Sound.play('honey', p.honey % 13);
        g.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 6,
          { col: '#ffc23c', spread: 1.8, up: 0.8, life: 20 });
        if (leben) {
          global.Sound.play('oneUp');
          g.floats.add(p.cx(), p.y - 14, '100 HONIG = EXTRALEBEN!', '#ffd257', 100);
        }
        break;
      case 'goldhonig':
        // Drei pro Level. Zaehlt fuer die Levelkarte, nicht fuers Leben.
        p.score += 1000; p.laughTimer = 50;
        global.Sound.play('oneUp');
        g.shake(2, 6);
        var got = g.goldCount ? g.goldCount() : 0, all = (g.lvl && g.lvl.gold) || 3;
        g.floats.add(p.cx(), p.y - 16, 'GOLDHONIG ' + got + '/' + all + '  +1000', '#fff0a0', 100);
        g.floats.add(p.cx(), p.y - 30, global.Levels.goldLine(got, all), '#ffd257', 110);
        if (g.onGold) g.onGold();
        g.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 22,
          { col: '#fff0a0', spread: 3, up: 1.2, life: 34 });
        break;
      case 'shawarma':
      case 'souvlaki':
      case 'boerek':
      case 'brezel':
      case 'simit':
      case 'balik':
      case 'doener':
        p.heal(g, 1); p.score += 150; p.eatTimer = 50; p.eatCount++;
        g.floats.add(p.cx(), p.y - 8, global.Levels.eatLine(p.eatCount), '#ffd257', 70);
        if (Math.random() < 0.4) p.doGrowl(g);
        break;
      case 'kubide':
        // Yusufs Lieblingsküche. Da wird nicht diskutiert.
        p.heal(g, 1); p.score += 220; p.eatTimer = 60; p.eatCount++;
        global.Sound.play('heal');
        g.floats.add(p.cx(), p.y - 8, global.Levels.kubideLine(p.eatCount), '#ffd257', 80);
        if (Math.random() < 0.6) p.doGrowl(g);
        break;
      case 'kippen':
        p.smoke = true; p.score += 250; p.laughTimer = 30;
        global.Sound.play('smokePower');
        g.shake(2, 6);
        g.floats.add(p.cx(), p.y - 12, 'KIPPEN! WERFEN MIT SHIFT / E', '#ffb46a', 130);
        g.particles.burst(p.cx(), p.y + 10, 18,
          { col: '#9a9088', spread: 2.4, up: 0.8, life: 44, grav: -0.02 });
        p.doGrowl(g, 'KRRRR... DANKE.');
        break;
      case 'herz':
        p.heal(g, 1); p.score += 100;
        g.floats.add(p.cx(), p.y - 8, '+1 HERZ', '#ff8aa0', 55);
        break;
      case 'baklava':
        p.lives++; p.score += 500; p.eatTimer = 60; p.eatCount++;
        global.Sound.play('oneUp');
        g.floats.add(p.cx(), p.y - 10, 'EXTRALEBEN! BAKLAVA!', '#ffd257', 95);
        break;
      case 'gold':
        if (imBosskampf(g)) {                 // im Bosskampf: nur ein Herz
          p.heal(g, 1); p.score += 300; p.eatTimer = 60;
          g.floats.add(p.cx(), p.y - 12, 'IM BOSSKAMPF: NUR EIN HERZ', '#ffe38a', 90);
          break;
        }
        p.power = 560; p.eatTimer = 60; p.laughTimer = 60; p.score += 300;
        global.Sound.play('power');
        g.shake(3, 8);
        g.floats.add(p.cx(), p.y - 12, 'GOLD-DÖNER! UNAUFHALTSAM!', '#ffe38a', 110);
        g.particles.burst(p.cx(), p.y + 8, 26,
          { col: '#ffd257', spread: 3.4, up: 1.2, life: 34 });
        break;
    }
  };

  /* ================= Projektile ================= */

  function Projectile(type, x, y, vx, vy, friendly) {
    this.t = type;
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.t0 = 0;
    this.dead = false;
    this.friendly = !!friendly;
    this.bounces = 3;
    // Geschosse aus anderen Dateien (Felix, Flughafen) bringen ihre Masse selbst mit
    var art = Projectile.ARTEN[type];
    if (art) { for (var ak in art) this[ak] = art[ak]; }
    else if (type === 'sellerie') { this.w = 6; this.h = 12; this.spr = 'sellerie'; this.grav = 0.1; }
    else if (type === 'blatt') { this.w = 10; this.h = 8; this.spr = 'blatt'; this.grav = 0.14; }
    else if (type === 'kippe') { this.w = 10; this.h = 5; this.spr = 'kippe'; this.grav = 0.26; }
    else if (type === 'rauch') {
      // Shisha-Wolke: langsam, gross, bleibt lange stehen.
      this.w = 26; this.h = 20; this.spr = null; this.grav = -0.004;
      this.life = 140; this.ghost = true;
    }
    else if (type === 'safran') {
      // Safranwolke: goldener Staub, treibt langsam durch die Kueche.
      this.w = 24; this.h = 18; this.spr = null; this.grav = -0.008;
      this.life = 85; this.ghost = true; this.gold = true;
    }
    else if (type === 'reis') { this.w = 6; this.h = 5; this.spr = 'reis'; this.grav = 0.16; }
    else if (type === 'bombe') { this.w = 8; this.h = 12; this.spr = 'bombe'; this.grav = 0.22; }
    else if (type === 'frage') { this.w = 10; this.h = 12; this.spr = 'frage'; this.grav = 0.12; }
    else if (type === 'hantel') { this.w = 22; this.h = 10; this.spr = 'hantel'; this.grav = 0.2; }
    else if (type === 'spiess') { this.w = 16; this.h = 12; this.spr = 'kubide'; this.grav = 0.04; }
    else if (type === 'jet') {
      this.w = 32; this.h = 9; this.spr = 'jet'; this.grav = 0;
      this.ghost = true; this.harmless = true; this.dropAt = 20; this.bombs = 3;
    }
    else if (type === 'zettel') { this.w = 10; this.h = 7; this.spr = 'zettel'; this.grav = 0.2; }
    else if (type === 'wodka') { this.w = 7; this.h = 13; this.spr = 'wodka'; this.grav = 0.24; }
    else if (type === 'bier') { this.w = 7; this.h = 8; this.spr = 'bier'; this.grav = 0.16; }
    else if (type === 'kotze') { this.w = 10; this.h = 5; this.spr = 'kotze'; this.grav = 0.3; }
    else if (type === 'bierflasche') { this.w = 6; this.h = 12; this.spr = 'bierflasche'; this.grav = 0.24; this.spin = true; }
    else if (type === 'pfuetze') {
      // Was liegen bleibt: Kotze oder zerdepperter Wodka. Nicht reintreten.
      this.w = 20; this.h = 5; this.spr = null; this.grav = 0;
      this.life = 200; this.col = '#7fc24a'; this.patch = true;
    }
    // Level 13-15: was sonst noch auf dem Boden liegen bleibt
    else if (type === 'humusfleck') {
      this.w = 22; this.h = 5; this.spr = null; this.grav = 0;
      this.life = 170; this.col = '#e8d4a0'; this.patch = true;
    }
    else if (type === 'glut') {
      this.w = 14; this.h = 4; this.spr = null; this.grav = 0;
      this.life = 150; this.col = '#ff6a1a'; this.patch = true;
    }
    else if (type === 'scherben') {
      this.w = 20; this.h = 4; this.spr = null; this.grav = 0;
      this.life = 170; this.col = '#f4f6fa'; this.patch = true;
    }
    else if (type === 'humus') { this.w = 8; this.h = 6; this.spr = 'humus'; this.grav = 0.24; }
    else if (type === 'ball') {
      this.w = 10; this.h = 10; this.spr = 'ball'; this.grav = 0.3;
      this.bounces = 4; this.bouncy = true; this.spin = true;
    }
    else if (type === 'hhc') {
      // HHC-Welle: eine schwankende gruene Wolke, die quer durchs Bild zieht
      this.w = 30; this.h = 20; this.spr = null; this.grav = 0;
      this.life = 240; this.ghost = true; this.baseY = y; this.amp = 6;
    }
    else if (type === 'zange') { this.w = 12; this.h = 5; this.spr = 'zange'; this.grav = 0.2; this.spin = true; }
    else if (type === 'kohle') { this.w = 6; this.h = 6; this.spr = 'kohle'; this.grav = 0.24; }
    else if (type === 'teller') { this.w = 12; this.h = 4; this.spr = 'teller'; this.grav = 0.03; this.spin = true; }
    else if (type === 'olive') { this.w = 5; this.h = 4; this.spr = 'olive'; this.grav = 0.2; }
    else if (type === 'tinte') { this.w = 6; this.h = 5; this.spr = 'tinte'; this.grav = 0.14; }
    else if (type === 'faust') {
      // Georgios' Boxhieb: unsichtbare Trefferflaeche fuer ein paar Ticks
      this.w = 22; this.h = 16; this.spr = null; this.grav = 0;
      this.life = 6; this.ghost = true;
    }
    // Level 15-19
    else if (type === 'speer') { this.w = 26; this.h = 5; this.spr = 'speer'; this.grav = 0; }
    else if (type === 'pferd') {
      // Das Trojanische Pferd: rollt, haelt in der Mitte, spuckt Speere
      this.w = 44; this.h = 40; this.spr = null; this.grav = 0; this.ghost = true;
      this.stopT = 0; this.wurf = false;
    }
    else if (type === 'kruecke') { this.w = 30; this.h = 6; this.spr = 'kruecke'; this.grav = 0; this.spin = true; }
    else if (type === 'wort') {
      // Rage-Bait: Woerter, die vom Himmel fallen
      this.text = 'L'; this.w = 8; this.h = 9; this.spr = null; this.grav = 0.04;
    }
    else if (type === 'buch') {
      this.w = 10; this.h = 8; this.spr = Math.random() < 0.5 ? 'buch' : 'buch2';
      this.grav = 0.22; this.spin = true;
    }
    else if (type === 'karte') { this.w = 8; this.h = 11; this.spr = 'karte'; this.grav = 0; this.spin = true; }
    else if (type === 'blitz') {
      // Gedankenblitz: erst eine Warnung am Boden, dann schlaegt er ein
      this.w = 18; this.h = 40; this.spr = null; this.grav = 0; this.ghost = true;
      this.life = 64; this.aktiv = 16;
    }
    else if (type === 'handschelle') { this.w = 11; this.h = 5; this.spr = 'handschelle'; this.grav = 0.2; this.spin = true; }
    else if (type === 'faustY') {
      // Yusufs Faust im Knast: steht ein paar Ticks vor ihm
      this.w = 18; this.h = 14; this.spr = null; this.grav = 0; this.life = 7; this.ghost = true;
    }
    // Level 21: BBs. Yusufs (friendly) sind Leuchtspur-gruen, die der
    // anderen weiss mit rotem Rand. Schnell, fast gerade, kurze Reichweite.
    else if (type === 'bb' || type === 'bbE') {
      this.w = 4; this.h = 4; this.spr = null; this.grav = type === 'bb' ? 0.02 : 0.01;
      this.life = type === 'bb' ? 64 : 110;
    }
    else if (type === 'granate') {
      this.w = 6; this.h = 9; this.spr = 'granate'; this.grav = 0.24; this.liegt = 0;
    }
    else if (type === 'welle') {
      // Bodenwelle nach einem Einschlag: flach, schnell, drueberspringen.
      this.w = 14; this.h = 10; this.spr = null; this.grav = 0;
      this.life = 110; this.col = '#e8b894';
    }
    // Level 26: Erdnuesse der Stewardess, Level 28: Simit vom Haendler
    else if (type === 'nuss') { this.w = 6; this.h = 6; this.spr = 'nuss'; this.grav = 0.2; this.spin = true; }
    else if (type === 'simit') { this.w = 12; this.h = 11; this.spr = 'simit'; this.grav = 0.18; this.spin = true; }
    else { this.w = 10; this.h = 14; this.spr = 'shaker'; this.grav = 0; }
  }

  /* Eigene Geschossarten aus anderen Dateien:
       ARTEN[typ] = { w, h, spr, grav, ... }       (Werte fuer den Konstruktor)
       EIGEN[typ] = function (g, cxT, cyT) { ... } (Verhalten statt des normalen)
     game.js zeichnet sie ueber ZEICHNEN[typ] (ctx, pr, camX, camY, G). */
  Projectile.ARTEN = {};
  Projectile.EIGEN = {};
  Projectile.ZEICHNEN = {};

  /* Mirkans alte Felgen (nach dem Felgenwechsel): Sie rollen ueber den
     Boden auf Yusuf zu und huepfen dabei ab und zu. Drueberspringen! */
  /* Brokes Mahnungen (vom Mika-Turm): flattern im Bogen */
  Projectile.ARTEN.mahnung = { w: 10, h: 7, spr: 'zettel', grav: 0.2, spin: true };

  Projectile.ARTEN.felge = { w: 12, h: 12, spr: 'felge', grav: 0.35, spin: true };
  Projectile.EIGEN.felge = function (g) {
    var fx = Math.floor((this.x + this.w / 2) / T), fy = Math.floor((this.y + this.h) / T);
    if (this.vy > 0 && this.solidAt(g, fx, fy)) {
      this.y = fy * T - this.h;
      // kleiner Huepfer alle paar Umdrehungen, sonst rollt sie flach
      this.vy = (this.t0 % 46 < 4) ? -3.4 : 0;
      if (this.vy < 0) global.Sound.play('stomp');
    }
    var vorn = Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / T);
    if (this.solidAt(g, vorn, Math.floor((this.y + this.h / 2) / T))) { this.pop(g, '#d6dbe6'); return; }
    this.rot = (this.rot || 0) + this.vx * 0.12;
    if (this.t0 % 4 === 0) {
      g.particles.spawn({ x: this.x + 6, y: this.y + this.h, vx: -this.vx * 0.2, vy: -0.4, life: 12,
                          col: '#8e8880', size: 2, grav: 0.05 });
    }
    var p = g.player;
    if (!p.dead && overlap(this, p) && p.power <= 0 && p.pound !== -1) {
      p.hurt(g, 1, this.x + this.w / 2);
      this.pop(g, '#d6dbe6');
    }
    if (this.t0 > 360) this.dead = true;
  };

  /* Erfans Koobideh, das nicht getroffen hat, steckt im Boden. Yusuf
     isst es auf (Erfan: "DAS WAR FUER DIE GAESTE!") — beim dritten heult
     Erfan und ist betaeubt. Hoechstens vier liegen gleichzeitig da. */
  Projectile.ARTEN.koobideh = { w: 16, h: 12, spr: 'kubide', grav: 0, harmless: true, life: 480 };
  Projectile.EIGEN.koobideh = function (g) {
    this.vy = 0; this.vx = 0;
    if (--this.life <= 0) { this.pop(g, '#a8542a'); return; }
    if (this.t0 % 20 === 0) {
      g.particles.spawn({ x: this.x + 4 + Math.random() * 8, y: this.y, vx: 0, vy: -0.5, life: 22,
                          col: '#f4f0ea', size: 2, grav: -0.01 });
    }
    var p = g.player;
    if (!p.dead && overlap(this, p)) {
      this.dead = true;
      p.score += 50;
      global.Sound.play('bite');
      g.floats.add(p.cx(), p.y - 10, 'MMMH, KOOBIDEH!', '#ffcf4a', 50);
      g.particles.burst(this.x + 8, this.y + 6, 8, { col: '#a8542a', spread: 1.8, up: 1, life: 20 });
      if (g.boss && g.boss.koobidehGegessen) g.boss.koobidehGegessen(g);
    }
  };
  function koobidehLandet(g, pr, groundY) {
    var n = 0, aeltest = null;
    for (var i = 0; i < g.projectiles.length; i++) {
      var q = g.projectiles[i];
      if (q && q.t === 'koobideh' && !q.dead) {
        n++;
        if (!aeltest || q.life < aeltest.life) aeltest = q;
      }
    }
    if (n >= 4 && aeltest) aeltest.dead = true;
    var k = g.addProjectile('koobideh', pr.x, groundY - 12, 0, 0);
    if (k) { k.y = groundY - k.h; k.bossShot = pr.bossShot; }
    g.particles.burst(pr.x + 8, groundY - 2, 6, { col: '#c8a878', spread: 1.6, up: 0.8, life: 18 });
  }

  /* Huseyins Sixpack-Blendung: ein waagerechter Lichtstrahl. Ducken
     oder drueberspringen. */
  Projectile.ARTEN.glanz = { w: 26, h: 8, spr: null, grav: 0, life: 110, ghost: true };
  Projectile.EIGEN.glanz = function (g) {
    if (--this.life <= 0) { this.pop(g, '#fff4c8'); return; }
    if (this.t0 % 3 === 0) {
      g.particles.spawn({ x: this.x + Math.random() * this.w, y: this.y + Math.random() * this.h, vx: -this.vx * 0.1,
                          vy: 0, life: 12, col: '#ffd257', size: 2, grav: 0 });
    }
    if (g.arena && (this.x < g.arena.x - 20 || this.x > g.arena.x + g.arena.w + 20)) { this.dead = true; return; }
    var p = g.player;
    if (!p.dead && overlap(this, p) && p.power <= 0 && p.pound !== -1) {
      p.hurt(g, 1, this.x + this.w / 2);
      g.floats.add(p.cx(), p.y - 20, 'GEBLENDET!', '#fff4c8', 50);
      this.pop(g, '#fff4c8');
    }
  };
  Projectile.ZEICHNEN.glanz = function (ctx, pr, camX, camY) {
    var x = Math.round(pr.x - camX), y = Math.round(pr.y - camY), a = Math.min(1, pr.life / 20);
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = '#ffd257';
    ctx.fillRect(x - 6, y - 3, pr.w + 12, pr.h + 6);
    ctx.globalAlpha = 0.9 * a;
    ctx.fillStyle = '#fff4c8';
    ctx.fillRect(x, y + 1, pr.w, pr.h - 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, y + 3, pr.w - 4, 2);
    ctx.globalAlpha = 1;
  };

  /** Fleck am Boden hinterlassen — hoechstens drei von jeder Sorte, sonst
      ist irgendwann der ganze Boden belegt. */
  function spawnPatch(g, type, cx, groundY, bossShot) {
    var n = 0, aeltest = null;
    for (var i = 0; i < g.projectiles.length; i++) {
      var q = g.projectiles[i];
      if (q && q.t === type && !q.dead) {
        n++;
        if (!aeltest || q.life < aeltest.life) aeltest = q;
      }
    }
    if (n >= 3 && aeltest) aeltest.dead = true;
    var pr = g.addProjectile(type, cx - 10, groundY - 5, 0, 0);
    if (pr) {
      pr.x = cx - pr.w / 2;
      pr.y = groundY - pr.h;
      pr.bossShot = bossShot;
    }
    return pr;
  }

  /** Welt aus Sicht eines Geschosses. Boss-Angriffe fliegen durch die
      schwebenden Arena-Plattformen — sonst stellt man sich einfach
      darunter und der Kampf laeuft von allein. */
  Projectile.prototype.solidAt = function (g, tx, ty) {
    if (this.bossShot && g.boss && ty < (g.boss.shotFloor || g.boss.floorRow)) return false;
    return g.world.solid(tx, ty);
  };

  Projectile.prototype.pop = function (g, col) {
    if (this.dead) return;
    this.dead = true;
    g.particles.burst(this.x + this.w / 2, this.y + this.h / 2, 7,
      { col: col || '#8cd85a', spread: 2, up: 0.5, life: 20 });
  };

  Projectile.prototype.update = function (g) {
    this.t0++;
    this.vy += this.grav;
    this.x += this.vx; this.y += this.vy;

    var cxT = Math.floor((this.x + this.w / 2) / T);
    var cyT = Math.floor((this.y + this.h / 2) / T);

    var eigen = Projectile.EIGEN[this.t];
    if (eigen) { eigen.call(this, g, cxT, cyT); return; }

    if (this.t === 'jet') {
      // Fliegt durch, wirft im Vorbeiflug Bomben ab.
      if (this.t0 > this.dropAt && this.t0 % 26 === 0 && this.bombs > 0) {
        this.bombs--;
        g.addProjectile('bombe', this.x + 14, this.y + 8, this.vx * 0.3, 0.6);
      }
      var vw = g.viewW ? g.viewW() : W_VIEW;
      if (this.x < g.cam.x - 200 || this.x > g.cam.x + vw + 200) this.dead = true;
      return;
    }

    if (this.t === 'welle') {
      if (--this.life <= 0) { this.pop(g, this.col); return; }
      if (this.t0 % 3 === 0) {
        g.particles.spawn({ x: this.x + 7, y: this.y + this.h, vx: -this.vx * 0.1,
                            vy: -1 - Math.random(), life: 14, col: this.col,
                            size: 2, grav: 0.1 });
      }
      var ahead2 = Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / T);
      if (this.solidAt(g, ahead2, cyT)) { this.pop(g, this.col); return; }
      if (!g.player.dead && overlap(this, g.player)) {
        this.pop(g, this.col);
        if (g.player.power <= 0 && g.player.pound !== -1) {
          g.player.hurt(g, 1, this.x + this.w / 2);
        }
      }
      return;
    }

    // Flecken am Boden. Alex' Pfuetze tut nicht weh — man rutscht darauf
    // aus. Schaden waere dort unfair, weil Alex sie sich direkt vor die
    // Fuesse wirft, also genau dahin, wo man angreifen muss. Hamzas Hummus
    // klebt (man wird langsam). Glut und Scherben brennen bzw. schneiden.
    if (this.patch) {
      if (--this.life <= 0) { this.dead = true; return; }
      var pl = g.player;
      if (!pl.dead && pl.grounded && overlap(this, pl)) {
        if (this.t === 'pfuetze') {
          if (pl.slip <= 0) {
            pl.slip = 36;
            global.Sound.play('move');
            g.floats.add(pl.cx(), pl.y - 14, 'AUSGERUTSCHT!', '#bfe6ff', 50);
          }
        } else if (this.t === 'humusfleck') {
          if (pl.stick <= 0) {
            global.Sound.play('move');
            g.floats.add(pl.cx(), pl.y - 14, 'KLEBT! HUMMUS!', '#e8d4a0', 50);
          }
          pl.stick = 40;
        } else if (pl.invuln <= 0 && pl.power <= 0) {
          pl.hurt(g, 1, this.x + this.w / 2);
        }
      }
      if (this.t === 'glut' && this.t0 % 6 === 0) {
        g.particles.spawn({ x: this.x + Math.random() * this.w, y: this.y, vx: 0, vy: -0.8,
                            life: 18, col: (this.t0 % 12) ? '#ff8a2a' : '#ffd257', size: 2, grav: -0.01 });
      }
      return;
    }

    // HHC-Welle: zieht waagerecht durch, schwankt dabei auf und ab.
    // Wer sie abbekommt, dem dreht sich eine Weile alles (g.dizzy).
    if (this.t === 'hhc') {
      if (--this.life <= 0) { this.pop(g, '#8ae07a'); return; }
      this.y = this.baseY + Math.sin(this.t0 * 0.12) * this.amp;
      if (this.t0 % 4 === 0) {
        g.particles.spawn({ x: this.x + Math.random() * this.w, y: this.y + Math.random() * this.h,
                            vx: -this.vx * 0.2, vy: -0.3, life: 30,
                            col: (this.t0 % 8) ? '#8ae07a' : '#b89ae8', size: 2, grav: -0.01 });
      }
      var ph = g.player;
      if (!ph.dead && overlap(this, ph) && ph.invuln <= 0 && ph.power <= 0 && ph.pound !== -1) {
        ph.hurt(g, 1, this.x + this.w / 2);
        g.dizzy = 240;
        g.floats.add(ph.cx(), ph.y - 24, 'ALLES DREHT SICH.', '#8ae07a', 80);
        this.pop(g, '#8ae07a');
      }
      var vw0 = g.viewW ? g.viewW() : W_VIEW;
      if (this.x < g.cam.x - 120 || this.x > g.cam.x + vw0 + 120) this.dead = true;
      return;
    }

    // Airsoft: BBs und Granaten (Level 21, Verhalten in airsoft.js)
    if ((this.t === 'bb' || this.t === 'bbE' || this.t === 'granate') && this.airsoftUpdate) {
      this.airsoftUpdate(g, cxT, cyT);
      return;
    }

    // Yusufs Faust (Level 19): trifft Gegner, Kisten und Bosse — einmal
    if (this.t === 'faustY') {
      if (--this.life <= 0) { this.dead = true; return; }
      var pY = g.player;
      var fx0 = Math.floor(this.x / T), fx1 = Math.floor((this.x + this.w - 1) / T);
      var fy0 = Math.floor(this.y / T), fy1 = Math.floor((this.y + this.h - 1) / T);
      for (var fty = fy0; fty <= fy1; fty++) {
        for (var ftx = fx0; ftx <= fx1; ftx++) {
          var fb = g.world.blockAt(ftx, fty);
          if (fb && !fb.dead && fb.type === 'kiste') pY.breakCrate(g, fb);
        }
      }
      if (this.done) return;
      for (var fe = 0; fe < g.enemies.length; fe++) {
        var en = g.enemies[fe];
        if (en.dead || !overlap(this, en)) continue;
        en.punched(g, pY);
        this.done = true;
        return;
      }
      if (g.boss && !g.boss.dead && overlap(this, g.boss)) {
        this.done = true;
        g.boss.hit(g, 1, null);
      }
      return;
    }

    // Trojanisches Pferd
    if (this.t === 'pferd') {
      var mitte = this.mitte || 0;
      if (!this.wurf && ((this.vx > 0 && this.x + this.w / 2 >= mitte) ||
                         (this.vx < 0 && this.x + this.w / 2 <= mitte))) {
        this.wurf = true; this.stopT = 76; this.vxAlt = this.vx;
      }
      if (this.stopT > 0) {
        this.x -= this.vx;                  // steht still
        this.stopT--;
        if (this.stopT === 44) {
          // Die Luke geht auf: ein Faecher aus Speeren
          for (var sk = 0; sk < 5; sk++) {
            var ang = Math.PI * (0.18 + sk * 0.16);
            var spk = g.addProjectile('speer', this.x + this.w / 2 - 13, this.y + 4,
                                      Math.cos(ang) * 4.2, -Math.sin(ang) * 6.2);
            if (spk) { spk.grav = 0.2; spk.lenkt = true; }
          }
          global.Sound.play('bossRoar');
          g.floats.add(this.x + this.w / 2, this.y - 10, 'TROJANER!', '#e8b030', 60);
        }
        if (this.stopT === 0) this.vx = this.vxAlt;
      } else if (this.t0 % 5 === 0) {
        g.particles.spawn({ x: this.x + (this.vx > 0 ? 4 : this.w - 4), y: this.y + this.h,
                            vx: -this.vx * 0.3, vy: -0.5, life: 16, col: '#c8a878', size: 2, grav: 0.02 });
      }
      if (this.arenaW && (this.x > this.arenaX + this.arenaW + 60 || this.x + this.w < this.arenaX - 60)) {
        this.dead = true; return;
      }
      var pp2 = g.player;
      if (!pp2.dead && overlap(this, pp2)) {
        if (pp2.vy > 0 && pp2.feet() - this.y < 14) {
          // Draufspringen: Holz federt
          pp2.vy = -9.8; pp2.jumpsLeft = 1; pp2.y = this.y - pp2.h;
          global.Sound.play('doubleJump');
          g.floats.add(pp2.cx(), pp2.y - 6, 'HOLZ!', '#c8a878', 40);
        } else if (pp2.power <= 0 && pp2.pound !== -1) {
          pp2.hurt(g, 1, this.x + this.w / 2);
        }
      }
      return;
    }

    // Gedankenblitz: erst Warnung, dann Einschlag
    if (this.t === 'blitz') {
      this.x -= this.vx; this.y -= this.vy;
      if (--this.life <= 0) { this.dead = true; return; }
      if (this.life === this.aktiv) {
        global.Sound.play('bossHit');
        g.shake(4, 10);
        g.particles.burst(this.x + this.w / 2, this.y + this.h, 14,
          { col: '#8ae0ff', spread: 3, up: 1.4, life: 22 });
      }
      var pb = g.player;
      if (this.life <= this.aktiv && !pb.dead && overlap(this, pb) &&
          pb.power <= 0 && pb.pound !== -1) {
        pb.hurt(g, 1, this.x + this.w / 2);
      }
      return;
    }

    // Kruecke: fliegt geradeaus. An der Arenawand steckt sie fest
    // (der Boss macht daraus eine Bruecke) — oder kommt als Bumerang zurueck.
    if (this.t === 'kruecke' && g.arena) {
      var links = this.x < g.arena.x + 20, rechts = this.x + this.w > g.arena.x + g.arena.w - 20;
      if (this.bumerang && this.t0 > 8 && (links || rechts) && !this.zurueck) {
        this.zurueck = true; this.vx = -this.vx;
      } else if (this.bumerang && this.zurueck && this.t0 > 200) {
        this.dead = true; return;
      } else if (!this.bumerang && (links || rechts)) {
        if (this.onWall) this.onWall(g, this);
        this.dead = true;
        return;
      }
    }

    // Boxhieb: steht nur ein paar Ticks
    if (this.t === 'faust') {
      if (--this.life <= 0) { this.dead = true; return; }
      if (this.folgt) this.x = this.folgt.facing > 0 ? this.folgt.x + this.folgt.w : this.folgt.x - this.w;
      var pf2 = g.player;
      if (!pf2.dead && overlap(this, pf2) && pf2.power <= 0 && pf2.pound !== -1) {
        var vorher = pf2.hurtTimer;
        pf2.hurt(g, 1, this.x + this.w / 2);
        // Ein Tritt mit Wucht (Huseyins Teep) schiebt weit weg
        var wucht = this.wucht || this.rueck;
        if (wucht && pf2.hurtTimer === 40 && vorher !== 40) {
          pf2.vx = (pf2.cx() > this.x + this.w / 2 ? 1 : -1) * wucht;
          pf2.vy = Math.min(pf2.vy, -5);
        }
        this.dead = true;
      }
      return;
    }

    // Fussball: springt vom Boden und von Waenden ab. Wer im Bosskampf
    // draufspringt, schiesst ihn zurueck — trifft er Hamza: EIGENTOR.
    if (this.t === 'ball') {
      var pb2 = g.player;
      if (!this.friendly && g.boss && g.boss.eigentor && !g.boss.dead && !pb2.dead && overlap(this, pb2) &&
          pb2.vy > 0.5 && pb2.feet() - this.y < 10) {
        var zb = g.boss, bdx = zb.cx() - (this.x + this.w / 2);
        var bdy = (zb.y + zb.h * 0.4) - (this.y + this.h / 2);
        var bt = Math.max(16, Math.min(50, Math.abs(bdx) / 6.5));
        this.friendly = true; this.zurueck = true;
        this.vx = bdx / bt; this.vy = Math.max(-11, Math.min(-1, bdy / bt - 0.5 * this.grav * bt));
        this.bounces = 3; this.t0 = 0;
        pb2.vy = -8.2; pb2.jumpsLeft = 1;
        global.Sound.play('shoot');
        g.floats.add(pb2.cx(), pb2.y - 14, 'ZURÜCK!', '#ffffff', 40);
      }
      var bby = Math.floor((this.y + this.h) / T);
      if (this.vy > 0 && this.solidAt(g, cxT, bby)) {
        this.y = bby * T - this.h;
        this.vy = -Math.max(2.8, this.vy * 0.7);
        this.vx *= 0.94;
        if (--this.bounces <= 0) { this.pop(g, '#f4f4f0'); return; }
      }
      var bah = Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / T);
      if (this.solidAt(g, bah, cyT)) this.vx = -this.vx * 0.8;
    }

    // Hummus, Kohle und Teller hinterlassen beim Aufschlag etwas am Boden
    if (this.t === 'humus' || this.t === 'kohle' || this.t === 'teller') {
      var hty = Math.floor((this.y + this.h) / T);
      var hit = (this.vy > 0 && this.solidAt(g, cxT, hty));
      if (this.t === 'teller' && !hit) {
        var tah = Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / T);
        if (this.solidAt(g, tah, cyT)) {
          // An der Wand zersprungen: nur Splitter, kein Fleck
          this.dead = true;
          global.Sound.play('brk');
          g.particles.burst(this.x + this.w / 2, this.y, 12, { col: '#f4f6fa', spread: 2.6, up: 0.8, life: 24 });
          return;
        }
      }
      if (hit) {
        this.dead = true;
        var ptype = this.t === 'humus' ? 'humusfleck' : (this.t === 'kohle' ? 'glut' : 'scherben');
        spawnPatch(g, ptype, this.x + this.w / 2, hty * T, this.bossShot);
        global.Sound.play(this.t === 'humus' ? 'move' : 'brk');
        g.particles.burst(this.x + this.w / 2, hty * T - 3, 8,
          { col: this.t === 'humus' ? '#e8d4a0' : (this.t === 'kohle' ? '#ff8a2a' : '#f4f6fa'),
            spread: 2.2, up: 0.8, life: 22 });
        return;
      }
    }

    // Flasche und Kotze hinterlassen eine Pfuetze, wenn sie aufschlagen.
    if (this.t === 'wodka' || this.t === 'kotze' || this.t === 'bierflasche') {
      var lty = Math.floor((this.y + this.h) / T);
      if (this.vy > 0 && this.solidAt(g, cxT, lty)) {
        this.dead = true;
        var glas = (this.t === 'wodka' || this.t === 'bierflasche');
        // Hoechstens drei Pfuetzen gleichzeitig — sonst ist der ganze
        // Boden belegt und der Kampf nicht mehr fair.
        var pfn = 0, aeltest = null;
        for (var pi = 0; pi < g.projectiles.length; pi++) {
          var q = g.projectiles[pi];
          if (q && q.t === 'pfuetze' && !q.dead) {
            pfn++;
            if (!aeltest || q.life < aeltest.life) aeltest = q;
          }
        }
        if (pfn >= 3 && aeltest) aeltest.dead = true;

        var pf = g.addProjectile('pfuetze', this.x - 6, lty * T - 5, 0, 0);
        if (pf) {
          pf.col = this.t === 'bierflasche' ? '#e8b830' : (glas ? '#bfe6ff' : '#7fc24a');
          pf.life = glas ? 90 : 130;
          pf.bossShot = this.bossShot;
        }
        global.Sound.play(glas ? 'brk' : 'hurt');
        g.particles.burst(this.x + this.w / 2, lty * T - 4, glas ? 12 : 8,
          { col: glas ? '#cfe8ff' : '#8fd85a', spread: 2.6, up: 0.9, life: 26 });
        return;
      }
    }

    if (this.t === 'rauch' || this.t === 'safran') {
      this.x += Math.sin(this.t0 * 0.03) * 0.25;
      if (--this.life <= 0) this.pop(g, this.gold ? '#ffcf4a' : '#b8b0c8');
      if (!g.player.dead && overlap(this, g.player) &&
          g.player.power <= 0 && g.player.pound !== -1) {
        g.player.hurt(g, 1, this.x + this.w / 2);
      }
      return;
    }

    if (this.t === 'bombe') {
      var bty = Math.floor((this.y + this.h) / T);
      if (this.vy > 0 && this.solidAt(g, cxT, bty)) {
        this.dead = true;
        g.shake(4, 10);
        global.Sound.play('pound');
        g.particles.burst(this.x + 4, bty * T, 20,
          { col: '#ffb43c', spread: 3.4, up: 1.2, life: 26 });
        // Druckwelle am Boden
        var px2 = this.x + 4;
        if (!g.player.dead && Math.abs(g.player.cx() - px2) < 40 &&
            Math.abs(g.player.feet() - bty * T) < 30) {
          g.player.hurt(g, 1, px2);
        }
        return;
      }
    }

    // Erfans Spiess steckt im Boden, wenn er nicht trifft (nur im Bosskampf)
    if (this.t === 'spiess' && this.bossShot && g.boss && g.boss.koobidehGegessen) {
      var sty = Math.floor((this.y + this.h) / T);
      if (this.vy > 0 && this.solidAt(g, cxT, sty)) {
        this.dead = true;
        koobidehLandet(g, this, sty * T);
        return;
      }
    }

    if (this.t === 'kippe') {
      // Kippen hüpfen über den Boden statt geradeaus zu fliegen.
      var below = Math.floor((this.y + this.h) / T);
      if (this.vy > 0 && this.solidAt(g, cxT, below)) {
        this.y = below * T - this.h;
        this.vy = -3.5;
        g.particles.spawn({ x: this.x + 5, y: this.y + 4, vx: 0, vy: -0.5,
                            life: 22, col: '#ffb43c', size: 2, grav: 0 });
        if (--this.bounces <= 0) this.pop(g, '#ffb43c');
      }
      var ahead = Math.floor((this.x + (this.vx > 0 ? this.w : 0)) / T);
      if (this.solidAt(g, ahead, cyT)) this.pop(g, '#ffb43c');
    } else if (!this.bouncy && this.t !== 'kruecke' && this.solidAt(g, cxT, cyT)) {
      this.pop(g, this.t === 'wort' ? '#ff6a6a' : undefined);
    }
    if (this.spin) this.rot = (this.rot || 0) + (this.vx >= 0 ? 0.35 : -0.35);
    // Speere aus dem Pferd zeigen immer in Flugrichtung
    if (this.lenkt) this.rot = Math.atan2(this.vy, this.vx);

    if (this.t0 > 420 || this.y > g.world.h * T + 60) this.dead = true;
    if (this.dead) return;

    if (this.friendly) {
      for (var i = 0; i < g.enemies.length; i++) {
        var e = g.enemies[i];
        if (e.dead || !overlap(this, e)) continue;
        e.squash(g, g.player);
        this.pop(g, '#ffb43c');
        return;
      }
      if (g.boss && !g.boss.dead && overlap(this, g.boss)) {
        if (this.zurueck && g.boss.eigentor) g.boss.eigentor(g);
        else g.boss.hit(g, 1, null);
        this.pop(g, '#ffb43c');
      }
    } else if (!g.player.dead && overlap(this, g.player)) {
      this.dead = true;
      if (g.player.power > 0 || g.player.pound === -1) {
        g.particles.burst(this.x, this.y, 8, { col: '#ffd257', spread: 2, life: 18 });
      } else {
        if (this.t === 'zettel' && g.player.invuln <= 0) {
          g.floats.add(g.player.cx(), g.player.y - 22, 'STRAFZETTEL! 35 EURO!', '#f4f4ee', 70);
        }
        if (this.t === 'mahnung' && g.player.invuln <= 0) {
          g.floats.add(g.player.cx(), g.player.y - 22, 'MAHNUNG ZUGESTELLT.', '#f4f4ee', 60);
        }
        g.player.hurt(g, 1, this.x + this.w / 2);
      }
    }
  };

  /* ================= BOSSE — gemeinsame Regeln =================
     Alle fuenf Bosse teilen sich diese Bausteine:
       - Draufspringen trifft. Beruehrung tut nur waehrend eines
         angekuendigten Angriffs weh (Sturmlauf, Einschlag, Wirbel).
       - Ab halber Energie verwandeln sie sich: kurze Show, dann
         schneller, wilder und mit neuen Angriffen.
       - Sie laufen durch schwebende Arena-Plattformen hindurch.
     ============================================================== */

  /** Welt aus Sicht eines Bosses: nur der Boden zaehlt.
      Vorher liefen grosse Bosse gegen die Kanten niedriger Plattformen
      und blieben dort einfach stehen. */
  function bossWorld(g, floorRow) {
    return {
      solid: function (tx, ty) { return ty >= floorRow && g.world.solid(tx, ty); }
    };
  }

  /* ---------- Kluges Laufen (Esat, 29.09.: "die Bosse sollen beim Laufen
     mitdenken") ----------
     klugLaufen ersetzt das sture Geradeauslaufen in den Lauf-Zustaenden:
     - immer zu Yusuf hin, auch wenn er inzwischen die Seite gewechselt hat
     - dorthin, wo er GLEICH ist (Vorhalten), nicht wohin er war
     - kurz vor ihm abbremsen, statt drueberzulaufen
     Und in bossMove fuer alle: faellt Yusuf von oben auf den Boss zu, macht
     der manchmal einen schnellen Schritt zur Seite (nicht immer, mit Pause
     dazwischen, nie waehrend eines Angriffs). */
  // Abgestimmt mit dem Playtest-Bot: mit 25 % / 35 % dauerte Georgios doppelt
  // so lange und kostete dreimal so viele Leben — so ist es fordernd, aber fair.
  var AUSWEICHEN = { chance: 0.15, chanceWut: 0.22, pause: 160, dauer: 14, tempo: 3.2 };

  function klugLaufen(b, g, tempo) {
    var p = g.player;
    var ziel = p.cx() + p.vx * 12;
    var dx = ziel - b.cx(), adx = Math.abs(dx);
    if (adx > 6) b.facing = dx > 0 ? 1 : -1;
    b.vx = b.facing * tempo * Math.min(1, 0.25 + adx / 48);
  }

  function ausweichen(b, g) {
    if (b.ausweichPause > 0) b.ausweichPause--;
    if (b.ausweichT > 0) {
      b.ausweichT--;
      b.vx = b.ausweichDir * AUSWEICHEN.tempo;
      return;
    }
    if (b.state !== 'idle' && b.state !== 'walk' && b.state !== 'gehen') return;
    if (b.ausweichPause > 0 || b.dead || b.intro || !b.grounded || b.keinAusweichen) return;
    var p = g.player;
    if (!p || p.dead || p.grounded || p.vy < 1) return;
    var nah = Math.abs(p.cx() - b.cx()) < b.w / 2 + 16;
    var drueber = p.feet() < b.y + 6 && p.feet() > b.y - 90;
    if (!nah || !drueber) return;
    b.ausweichPause = AUSWEICHEN.pause;
    if (Math.random() >= (b.rage ? AUSWEICHEN.chanceWut : AUSWEICHEN.chance)) return;
    // Weg von Yusuf — steht er an der Wand, dann unter ihm durch
    var dir = p.cx() > b.cx() ? -1 : 1;
    if (g.arena) {
      if (dir < 0 && b.x < g.arena.x + 40) dir = 1;
      if (dir > 0 && b.x + b.w > g.arena.x + g.arena.w - 40) dir = -1;
    }
    b.ausweichDir = dir;
    b.ausweichT = AUSWEICHEN.dauer;
    g.particles.burst(b.cx(), b.y + b.h - 2, 6, { col: '#c8c0b0', spread: 1.6, up: 0.6, life: 16 });
  }

  function bossMove(b, g) {
    ausweichen(b, g);
    if (!b.bw) b.bw = bossWorld(g, b.floorRow);
    b.vy += GRAV;
    if (b.vy > MAX_FALL) b.vy = MAX_FALL;
    moveX(b, b.bw, b.vx);
    b.grounded = (moveY(b, b.bw, b.vy) === 1);
    if (g.arena) {
      var lo = g.arena.x + 6, hi = g.arena.x + g.arena.w - 6;
      if (b.x < lo) { b.x = lo; b.facing = 1; }
      if (b.x + b.w > hi) { b.x = hi - b.w; b.facing = -1; }
    }
  }

  function bossContact(b, g) {
    var p = g.player;
    if (p.dead || b.invuln > 0 || b.state === 'transform' || !overlap(b, p)) return;
    var stomp = p.vy > 0.5 && (p.feet() - b.y) < b.stompY;
    // Die Arschbombe macht nur halben Schaden. Vorher konnte man jeden
    // Boss einfach mit Bauch-Stampfern zuspammen und ueberrennen.
    if (p.power > 0) b.hit(g, 1, p);
    else if (p.pound === -1) b.hit(g, POUND_BOSS_DMG, p);
    else if (stomp) b.hit(g, 1, p);
    else if (!b.open) p.hurt(g, 1, b.cx());
  }

  function bossDeath(b, g, col) {
    b.deadTimer++;
    b.vy += GRAV * 0.5;
    b.y += b.vy;
    if (b.deadTimer % 8 === 0) {
      g.particles.burst(b.cx() + (Math.random() - 0.5) * b.w,
                        b.y + Math.random() * b.h, 6,
        { col: col, spread: 2.4, up: 0.6, life: 28 });
    }
  }

  /** Geschosse entschaerfen, OHNE die Liste zu veraendern. Treffer koennen
      mitten im Geschoss-Durchlauf passieren — die Liste dort zu leeren,
      hat frueher das Spiel abstuerzen lassen. */
  function clearShots(g) {
    for (var i = 0; i < g.projectiles.length; i++) {
      if (g.projectiles[i]) g.projectiles[i].dead = true;
    }
  }

  function bossBounce(b, g, p, col, dmg) {
    // Liegt er betaeubt da (Mario), bleibt er liegen: kurze Schonzeit,
    // dann geht der naechste Sprung wieder rein — zwei, drei Treffer.
    var liegt = b.state === 'betaeubt' && b.timer > 0;
    b.invuln = liegt ? 22 : (b.rage ? 40 : 48);
    b.flash = 16;
    if (liegt) b.timer = Math.max(16, b.timer - 30);
    else { b.state = 'idle'; b.timer = b.rage ? 14 : 24; }
    b.kombo = null;
    b.landed = true;
    b.vx = liegt ? 0 : ((p && p.cx() > b.cx()) ? -2.6 : 2.6);
    if (p) { p.vy = -8.2; p.jumpsLeft = 1; p.laughTimer = 40; }
    if (g.onBossHit) g.onBossHit(b, dmg);
    global.Sound.play('bossHit');
    // Sichtbar machen, warum der Balken kaum kleiner wird
    if (dmg && dmg < 1) g.floats.add(b.cx(), b.y - 20, 'NUR HALB!', '#c8c0d8', 50);
    g.shake(6, 14);
    g.particles.burst(b.cx(), b.y + b.h / 2, 16, { col: col, spread: 3, up: 1, life: 30 });
  }

  /* ---------- Drei Herzen fuer jeden Boss ----------
     Ueber dem Balken stehen bei jedem Boss drei Herzen (Semih: eins pro
     Form). Jedes Herz ist ein voller Balken. Ist er leer, verwandelt sich
     der Boss: nach dem ersten Herz in seine Wut-Form (frueher bei halber
     Energie), nach dem zweiten in seine letzte Form (letzteForm: Name,
     Farbe, Ruf bei der Verwandlung, Satz davor). Die Energie pro Herz
     steht in balance.js. */
  var BOSS_HERZEN = 3;

  function dreiHerzen(b, letzte) {
    b.lebenMax = BOSS_HERZEN; b.leben = BOSS_HERZEN;
    if (letzte) b.letzteForm = letzte;
  }

  /** Die Form nach einer Verwandlung: 2 nach dem ersten Herz, 3 nach dem zweiten. */
  function herzPhase(b) { return b.lebenMax ? b.lebenMax - b.leben + 1 : 2; }

  /** Beim letzten Herz: Name und Farbe der letzten Form. */
  function letzteFormAn(b) {
    var f = b.letzteForm;
    if (!f || b.leben > 1) return null;
    b.rageName = f.name; b.rageCol = f.col;
    return f;
  }

  /** Nach einem Treffer: Balken leer, aber noch ein Herz uebrig? Dann
      verwandelt er sich (true). Sonst entscheidet der Boss selbst. */
  function herzWeg(b, g) {
    if (b.hp > 0 || !b.lebenMax || b.leben <= 1) return false;
    naechstesLeben(b, g, false);
    return true;
  }

  /** Ist die Energie leer, faengt das naechste Herz mit vollem Balken an —
      mit Verwandlung. still = nach einem Tod direkt dorthin, ohne Show.
      ansage = erst reden, dann verwandeln (Mirkans Felgen). */
  function naechstesLeben(b, g, still, ansage) {
    b.leben--;
    b.hp = b.maxHp;
    g.bossLeben = b.lebenMax - b.leben;
    if (still) {
      b.onTransform(g, true);
      letzteFormAn(b);
      b.phase = g.bossLeben + 1;
      return;
    }
    if (ansage) { ansage(); return; }
    startTransform(b, g);
  }

  /** Verwandlung starten. Der Dialog kommt erst, wenn sie vorbei ist. */
  function startTransform(b, g) {
    // Halbzeit ist erreicht, sobald die Verwandlung beginnt — auch wer
    // genau jetzt stirbt, macht danach ab der Haelfte weiter.
    g.bossHalf = true;
    b.state = 'transform';
    b.timer = 96;
    b.invuln = 140;
    b.vx = 0;
    clearShots(g);
    g.shake(4, 20);
    global.Sound.play('bossRoar');
  }

  /** Laeuft jeden Frame waehrend der Verwandlung. Gibt true zurueck, wenn fertig. */
  function tickTransform(b, g, label, col) {
    // Zweite Verwandlung: die letzte Form hat ihren eigenen Ruf
    var lf = b.letzteForm && b.leben <= 1 ? b.letzteForm : null;
    if (lf) { label = lf.ruf; col = lf.col; }
    if (lf && lf.vorher && b.timer === 88) g.floats.add(b.cx(), b.y - 14, lf.vorher, '#ffd257', 80);
    b.vx = 0;
    if (b.timer % 4 === 0) {
      g.particles.spawn({
        x: b.cx() + (Math.random() - 0.5) * b.w * 1.8, y: b.y + b.h,
        vx: (Math.random() - 0.5) * 0.6, vy: -1.4 - Math.random() * 1.8,
        life: 42, col: col, size: 3, grav: -0.02
      });
    }
    if (b.timer === 60) {
      b.onTransform(g);          // hier waechst er / nimmt Snus / tuned den Wagen
      letzteFormAn(b);
      g.shake(10, 34);
      global.Sound.play('power');
      if (g.flashScreen) g.flashScreen(col, 26);
      g.floats.add(b.cx(), b.y - 20, label, col, 130);
      g.particles.burst(b.cx(), b.y + b.h / 2, 48, { col: col, spread: 4.6, up: 1.4, life: 54 });
    }
    return b.timer <= 0;
  }

  /** Einschlag: Staub, Kamerawackeln und Bodenwellen nach beiden Seiten. */
  function groundWaves(b, g, col, speed, rows, life) {
    g.shake(8, 20);
    global.Sound.play('pound');
    for (var i = 0; i < 18; i++) {
      g.particles.spawn({
        x: b.cx(), y: b.y + b.h,
        vx: (i / 17 - 0.5) * 9, vy: -Math.random() * 2.2,
        life: 26, col: col, size: 2, grav: 0.3
      });
    }
    for (var k = 0; k < (rows || 1); k++) {
      var sp = (speed || 3.2) * (1 - k * 0.3);
      var wl = g.addProjectile('welle', b.cx() - 7, b.y + b.h - 10, -sp, 0);
      var wr = g.addProjectile('welle', b.cx() - 7, b.y + b.h - 10, sp, 0);
      if (wl) { wl.col = col; if (life) wl.life = life; }
      if (wr) { wr.col = col; if (life) wr.life = life; }
    }
  }

  /** Geschosse fallen von oben ueber die ganze Bildbreite. */
  function rainFromSky(g, type, vy) {
    var vw = g.viewW ? g.viewW() : 512;
    var rx = g.cam.x + 24 + Math.random() * (vw - 48);
    g.addProjectile(type, rx, g.cameraTopY(), (Math.random() - 0.5) * 0.4, vy || 1.4);
  }

  function rageSparks(b, g) {
    if (!b.rage || b.t0 % 4 !== 0) return;
    g.particles.spawn({
      x: b.cx() + (Math.random() - 0.5) * b.w,
      y: b.y + b.h * (0.3 + Math.random() * 0.6),
      vx: -b.vx * 0.2, vy: -0.8 - Math.random(), life: 26,
      col: b.rageCol, size: 2, grav: -0.02
    });
  }

  /* =====================================================================
     KAMPF-HIRN — was alle Bosse koennen (Esat, 02.10.: "mache alle
     Bosskaempfe individuell und klau Logiken von anderen Spielen wie bei
     Mario oder Hollow Knight, wie Bosskaempfe aufgebaut sind").

     Abgeschaut bei Hollow Knight:
       - Jeder Angriff hat einen Anlauf, den man lesen kann (Pose, ein !,
         ein Geraeusch) — und danach eine kurze Pause, in der er offen ist.
       - Welcher Angriff kommt, haengt davon ab, wo Yusuf gerade ist: nah,
         weit, in der Luft, ueber ihm, oben auf einer Plattform (waehle).
       - Im letzten Herz verkettet er Angriffe zu Kombos (kombo).
     Abgeschaut bei Mario:
       - Jeder Boss hat seinen eigenen Trick, wie man ihn erwischt (Mirkan
         rammt die Wand, Lennart ist nach dem Kreuzheben fertig, Erfan
         heult, wenn man sein Koobideh isst, Hamza schiesst ein Eigentor
         ...). Wer den Trick findet, haut ihn um: BETAEUBT — er liegt mit
         Sternchen da, und man kann zwei-, dreimal draufspringen.
       - Trifft er Yusuf, freut er sich kurz (Spott) — die Gelegenheit.
     ===================================================================== */

  /** Wo ist Yusuf, von diesem Boss aus gesehen? */
  function lage(b, g) {
    var p = g.player, dx = p.cx() - b.cx(), adx = Math.abs(dx);
    var lo = g.arena ? g.arena.x : -1e9, hi = g.arena ? g.arena.x + g.arena.w : 1e9;
    return {
      dx: dx, adx: adx, dir: dx > 0 ? 1 : -1,
      nah: adx < 80, mittel: adx >= 80 && adx < 180, weit: adx >= 180,
      luft: !p.grounded,
      ueber: !p.grounded && adx < b.w / 2 + 40 && p.feet() < b.y + 12,
      oben: p.feet() < b.y + b.h - 44,
      hinten: (dx > 0) !== (b.facing > 0),
      bossAnWand: Math.min(b.x - lo, hi - b.x - b.w) < 56,
      yusufAnWand: Math.min(p.x - lo, hi - p.x - p.w) < 64,
      rest: b.hp / b.maxHp
    };
  }

  /** Gewichtete Wahl wie bei Hollow Knight: liste = [{ s: Zustand, t: Dauer,
      w: Gewicht oder function (lage, boss), wenn: function (lage, boss),
      dann: function (boss, g, lage) }]. Was eben kam, kommt kaum nochmal. */
  function waehle(b, g, liste) {
    var l = lage(b, g), summe = 0, opt = [], i;
    for (i = 0; i < liste.length; i++) {
      var e = liste[i];
      if (!e || (e.wenn && !e.wenn(l, b))) continue;
      var w = typeof e.w === 'function' ? e.w(l, b) : (e.w === undefined ? 1 : e.w);
      if (e.s === b.letzter) w *= 0.12;
      if (w > 0) { opt.push([e, w]); summe += w; }
    }
    if (!opt.length) { b.go('idle', 20); return null; }
    var r = Math.random() * summe;
    for (i = 0; i < opt.length - 1; i++) { r -= opt[i][1]; if (r <= 0) break; }
    var wahl = opt[i][0];
    b.letzter = wahl.s;
    b.letzterAngriff = wahl.s;
    b.facing = l.dir;
    b.landed = true;
    b.go(wahl.s, typeof wahl.t === 'function' ? wahl.t(l, b) : wahl.t);
    if (wahl.dann) wahl.dann(b, g, l);
    return wahl;
  }

  /** Kombo: nach dem jetzigen Angriff kommen diese [Zustand, Dauer] sofort. */
  function kombo(b, folge) { b.kombo = folge.slice(); }
  /** Im Leerlauf: steht eine Kombo an? Dann gleich weiter, ohne Pause. */
  function komboWeiter(b, g) {
    if (!b.kombo || !b.kombo.length) return false;
    var n = b.kombo.shift();
    b.facing = g.player.cx() > b.cx() ? 1 : -1;
    b.landed = true;
    b.go(n[0], n[1]);
    return true;
  }

  /** Ein Boss sagt etwas. Sein voriger Satz verschwindet dafuer, sonst
      stehen drei Saetze uebereinander. */
  function sagt(b, g, text, col, life, dy) {
    if (b.satz && b.satz.life > 8) b.satz.life = 8;
    b.satz = g.floats.add(b.cx(), b.y - (dy || 20), text, col || '#ffd257', life || 70);
    return b.satz;
  }

  /** Mario: der Trick hat geklappt — er liegt betaeubt am Boden. */
  function betaeuben(b, g, dauer, text, col) {
    if (b.dead) return;
    b.go('betaeubt', dauer);
    b.vx = 0;
    b.kombo = null;
    b.schwebt = false;
    b.invuln = Math.min(b.invuln, 6);
    g.shake(6, 16);
    global.Sound.play('bossHit');
    if (text) sagt(b, g, text, col, 100, 30);
    g.particles.burst(b.cx(), b.y + 10, 18, { col: '#ffd257', spread: 2.6, up: 1, life: 30 });
  }
  /** Jeden Tick, solange er betaeubt ist: Sternchen kreisen, dann steht er auf. */
  function tickBetaeubt(b, g) {
    b.vx *= 0.8;
    if (b.t0 % 5 === 0) {
      var a = b.t0 * 0.21;
      for (var k = 0; k < 2; k++) {
        g.particles.spawn({ x: b.cx() + Math.cos(a + k * Math.PI) * (b.w * 0.5 + 6), y: b.y - 6 + Math.sin(a + k * Math.PI) * 3,
                            vx: 0, vy: -0.1, life: 12, col: k ? '#ffffff' : '#ffd257', size: 2, grav: 0 });
      }
    }
    if (b.timer <= 0) {
      b.go('idle', b.rage ? 12 : 20);
      if (b.aufstehText) sagt(b, g, b.aufstehText, '#c8c0d8', 60, 14);
      return true;
    }
    return false;
  }

  /** Er hat Yusuf erwischt: kurz feiern, posieren, lachen — offen. */
  function spott(b, g, text, col, dauer) {
    if (b.dead || b.state === 'transform' || b.state === 'betaeubt' || (b.spottPause || 0) > 0) return false;
    b.spottPause = 300;
    b.kombo = null;
    b.go('spott', dauer || 56);
    b.vx = 0;
    if (text) sagt(b, g, text, col, 70, 18);
    return true;
  }

  /** Ein Schlag oder Tritt: eine Trefferflaeche fuer ein paar Ticks direkt
      vor ihm (w breit, h hoch, yOff von oben). */
  function schlag(b, g, w, h, yOff, life, rueck) {
    var fx = b.facing > 0 ? b.x + b.w - 4 : b.x - w + 4;
    var f = g.addProjectile('faust', fx, b.y + yOff, 0, 0);
    if (f) { f.w = w; f.h = h; f.life = life || 6; f.rueck = rueck || 0; f.von = b; }
    b.punchT = 6;
    global.Sound.play('stomp');
    return f;
  }

  /** Steht er (im naechsten Schritt) an der Arenawand? */
  function anWand(b, g, vx) {
    if (!g.arena) return false;
    var lo = g.arena.x + 6, hi = g.arena.x + g.arena.w - 6, nx = b.x + (vx || 0);
    return nx <= lo + 1 || nx + b.w >= hi - 1;
  }

  /* ================= HUSEYIN =================
     Yusufs Bruder, drei Formen (Esat, 02.10.):
       1. HUSEYIN       Lederjacke. Huepft, wirft Salat, sprintet. Verfehlt
                        er mit dem Sprint, macht er zur Strafe Liegestuetze.
       2. SIXPACK       Jacke aus, oben ohne. Posiert (das Sixpack blendet
                        wie ein Lichtstrahl), Burpees mit Bodenwellen,
                        Liegestuetze, bei denen jede Wiederholung bebt.
       3. MUAY THAI     Handschuhe, Thai-Shorts, Stirnband. Erst der Wai
                        Kru (der Tanz vor dem Kampf), dann Vollgas: Jab-Jab-
                        Gerade, Teep (Stosstritt), Low Kick, fliegendes Knie.
     Sein Trick (Mario): wer ihm WAEHREND der Liegestuetze auf den Ruecken
     springt, macht ihn platt — betaeubt. Und im Muay Thai: wer ueber den
     Low Kick springt, laesst ihn ins Leere treten — er dreht sich um sich
     selbst und ist kurz schwindelig.
     ============================================================== */

  var HUS_LIEGE = { pushups: 1, strafe: 1, liegewelle: 1 };
  var HUS_ZU = { dash: 1, knie: 1, lowkick: 1 };

  function Boss(tx, ty) {
    this.w = 20; this.h = 58;             // 2x skaliert gezeichnet
    this.x = tx * T; this.y = ty * T - this.h;
    this.floorRow = ty;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = 13; this.maxHp = 13;
    this.phase = 1;
    this.rage = false;
    this.t0 = 0; this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.timer = 50;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deadTimer = 0;
    this.grounded = false;
    this.pushups = 0;
    this.intro = true;
    this.stompY = 32;
    this.open = true;
    this.landed = true;
    this.look = 'jacke';
    this.punchT = 0;
    this.spottPause = 0;
    this.rageName = 'SIXPACK';
    this.rageCol = '#ffb46a';
    dreiHerzen(this, { name: 'MUAY THAI', col: '#ff3a3a', ruf: 'MUAY THAI!',
                       vorher: 'HANDSCHUHE AN. JETZT WIRD ES ERNST.' });
  }

  Boss.prototype.cx = function () { return this.x + this.w / 2; };
  Boss.prototype.go = function (s, t) { this.state = s; this.timer = t; };
  Boss.prototype.onTransform = function (g, still) {
    this.rage = true;
    var alt = this.look;
    this.look = this.leben <= 1 ? 'muaythai' : 'sixpack';
    // Die Lederjacke fliegt (nur einmal, nicht nach einem Tod)
    if (!still && alt === 'jacke' && g) {
      g.particles.burst(this.cx(), this.y + 22, 26, { col: '#33323c', spread: 3.4, up: 1.6, life: 46 });
      g.floats.add(this.cx(), this.y - 30, 'JACKE AUS!', '#ffb46a', 90);
    }
    if (!still && this.look === 'muaythai') this.waiKru = true;
  };

  /** Er hat Yusuf erwischt. In Jacke und oben ohne freut er sich —
      im Muay Thai nicht mehr: da gibt es keine Pause. */
  Boss.prototype.yusufGetroffen = function (g) {
    if (this.state === 'lowkick') this.kickTraf = true;
    if (this.look === 'muaythai') return;
    if (this.look === 'sixpack') spott(this, g, 'SECHS STÜCK. UND DU? EINS. EIN GROSSES.', '#ffb46a', 64);
    else spott(this, g, 'NOCH EINS? ICH HAB ZEIT. ICH HAB IMMER ZEIT.', '#9dff6a', 52);
  };

  Boss.prototype.update = function (g) {
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.spottPause > 0) this.spottPause--;
    if (this.punchT > 0) this.punchT--;
    if (this.dead) { bossDeath(this, g, '#9dff6a'); return; }
    if (this.intro) { bossMove(this, g); return; }

    var p = g.player;
    var dx = p.cx() - this.cx();
    var MT = this.look === 'muaythai';
    var spd = !this.rage ? 1 : (MT ? 1.55 : 1.3);
    var i;
    this.timer--;
    rageSparks(this, g);

    switch (this.state) {
      case 'transform':
        if (tickTransform(this, g, 'OBEN OHNE!', this.rageCol)) {
          this.phase = herzPhase(this);
          if (this.waiKru) { this.waiKru = false; this.go('waikru', 96); }
          else this.go('idle', 12);
          g.onBossPhase(this.phase);
        }
        break;

      case 'idle':
        this.vx *= 0.8;
        this.facing = dx > 0 ? 1 : -1;
        if (komboWeiter(this, g)) break;
        if (this.timer <= 0) this.pickAttack(g);
        break;

      case 'betaeubt':
        tickBetaeubt(this, g);
        break;

      case 'spott':
        this.vx *= 0.8;
        if (this.look === 'sixpack' && this.t0 % 6 === 0) this.glitzer(g);
        if (this.timer <= 0) this.go('idle', 10);
        break;

      case 'walk':
        klugLaufen(this, g, 1.3 * spd);
        if (this.timer <= 0) this.go('idle', this.rage ? 10 : 18);
        break;

      case 'throw':
        this.vx *= 0.8;
        if (this.timer === 12) {
          var n = this.rage ? 4 : 2;
          for (i = 0; i < n; i++) {
            g.addProjectile('blatt', this.cx(), this.y + 20,
              this.facing * (2.2 + i * 0.4) * (this.rage ? 1.15 : 1), -2.6 - i * 0.5);
          }
          global.Sound.play('shoot');
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 32);
        break;

      case 'shake':   // Protein-Shaker, waagerecht
        this.vx *= 0.8;
        if (this.timer === 14 || (this.rage && this.timer === 4)) {
          g.addProjectile('shaker', this.cx(), this.y + 24, this.facing * 3.4 * spd, 0);
          global.Sound.play('shoot');
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 30);
        break;

      case 'jump':
        if (this.grounded && this.timer < 44) this.go('idle', this.rage ? 14 : 28);
        break;

      // Sein Markenzeichen: kurze schnelle Hopser. Er bleibt nie stehen.
      case 'hop':
        this.facing = dx > 0 ? 1 : -1;
        if (this.grounded) {
          this.vy = -6.4 - this.phase * 0.4;
          this.vx = this.facing * (1.8 + this.phase * 0.4) * (this.rage ? 1.15 : 1);
          global.Sound.play('jump');
          if (this.rage && Math.random() < 0.5) {
            g.addProjectile('blatt', this.cx(), this.y + 20, this.facing * 2.2, -1.8);
          }
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 14 : 24);
        break;

      case 'dashprep':
        this.vx *= 0.7;
        if (this.timer <= 0) {
          this.go('dash', 32);
          this.dashTraf = false;
          global.Sound.play('bossRoar');
          g.shake(3, 8);
        }
        break;

      case 'dash':
        this.vx = this.facing * 4.2 * spd;
        if (this.t0 % 2 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * 8, y: this.y + this.h - 2, vx: -this.facing, vy: -0.4,
                              life: 14, col: '#c8c0b0', size: 2, grav: -0.01 });
        }
        if (this.timer <= 0 || anWand(this, g, this.vx)) {
          this.vx = 0;
          // Daneben? Dann zur Strafe Liegestuetze — seine eigene Regel.
          if (!MT && p.hurtTimer <= 0 && Math.random() < (this.rage ? 0.5 : 0.7)) {
            this.pushups = 0;
            this.go('strafe', 84);
            sagt(this, g, 'DANEBEN? ZEHN LIEGESTÜTZE. MEINE REGEL.', '#9dff6a', 70);
          } else this.go('idle', this.rage ? 18 : 30);
        }
        break;

      // Liegestuetze: der Gag — und sein Trick (draufspringen = platt)
      case 'pushups':
      case 'strafe':
        this.vx = 0;
        this.pushups++;
        if (this.pushups % 16 === 0) {
          global.Sound.play('select');
          g.floats.add(this.cx(), this.y + 6, '' + Math.floor(this.pushups / 16), '#9dff6a', 30);
        }
        if (this.timer <= 0) {
          this.go('idle', 12);
          sagt(this, g, 'JETZT BIN ICH WARM!', '#9dff6a', 60);
        }
        break;

      /* ---------- SIXPACK ---------- */

      // Er posiert. Das Sixpack glaenzt — und dann blendet es.
      case 'flex':
        this.vx *= 0.7;
        if (this.timer === 40) sagt(this, g, 'SIEHST DU DAS? SECHS STÜCK!', '#ffb46a', 56);
        if (this.t0 % 4 === 0) this.glitzer(g);
        if (this.timer === 12) {
          var hoehe = this.phase >= 3 ? [24, 44] : [30];
          for (i = 0; i < hoehe.length; i++) {
            g.addProjectile('glanz', this.cx() + this.facing * 8 - 13, this.y + hoehe[i], this.facing * 5.2 * spd, 0);
          }
          global.Sound.play('strahl');
          g.floats.add(this.cx(), this.y - 14, 'SIXPACK-BLENDUNG!', '#fff4c8', 50);
        }
        if (this.timer <= 0) this.go('idle', 18);
        break;

      // Burpees: runter, hoch, Landung mit Bodenwelle. Dreimal.
      case 'burpees':
        this.vx *= 0.85;
        if (this.timer === 92 || this.timer === 60 || this.timer === 28) {
          this.vy = -8.4;
          this.vx = (dx > 0 ? 1 : -1) * 1.5 * spd;
          this.landed = false;
          global.Sound.play('jump');
          g.floats.add(this.cx(), this.y - 10, ['DREI!', 'ZWEI!', 'EINS!'][this.timer === 92 ? 0 : (this.timer === 60 ? 1 : 2)], '#ffb46a', 30);
        }
        if (this.grounded && !this.landed && this.vy >= 0) {
          this.landed = true;
          groundWaves(this, g, '#ffb46a', 2.8, 1, 50);
        }
        if (this.timer <= 0 && this.grounded) this.go('idle', 16);
        break;

      // Liegestuetze, bei denen jede Wiederholung den Boden beben laesst
      case 'liegewelle':
        this.vx = 0;
        this.pushups++;
        if (this.timer > 8 && this.timer % 22 === 0) {
          var wl = g.addProjectile('welle', this.cx() - 7, this.y + this.h - 10, -2.6, 0);
          var wr = g.addProjectile('welle', this.cx() - 7, this.y + this.h - 10, 2.6, 0);
          if (wl) { wl.col = '#ffb46a'; wl.life = 70; }
          if (wr) { wr.col = '#ffb46a'; wr.life = 70; }
          g.shake(2, 6);
          global.Sound.play('pound');
          g.floats.add(this.cx(), this.y + 6, '' + Math.round((92 - this.timer) / 22), '#ffb46a', 26);
        }
        if (this.timer <= 0) this.go('idle', 14);
        break;

      /* ---------- MUAY THAI ---------- */

      // Wai Kru: der Tanz vor dem Kampf. Langsam, feierlich — und offen.
      case 'waikru':
        this.vx = Math.sin(this.t0 * 0.05) * 0.5;
        if (this.timer === 90) sagt(this, g, 'WAI KRU.', '#ff3a3a', 60);
        if (this.timer === 40) sagt(this, g, 'FÜR MEINEN TRAINER. UND JETZT: VOLLGAS.', '#ff3a3a', 60);
        if (this.timer <= 0) { this.go('idle', 6); global.Sound.play('bossRoar'); }
        break;

      // Kampfhaltung: kleine Hopser, Abstand finden, dann rein
      case 'stance':
        var soll = 58, ad = Math.abs(dx);
        this.facing = dx > 0 ? 1 : -1;
        if (this.grounded) {
          this.vy = -2.6;
          this.vx = this.facing * (ad > soll + 14 ? 2.6 : (ad < soll - 14 ? -2.2 : 0)) * spd;
          if (this.vx * this.facing < 0 && anWand(this, g, this.vx * 4)) this.vx = 0;
        }
        if (this.timer <= 0 || (ad < soll + 10 && this.timer < 24)) this.go('idle', 2);
        break;

      case 'jabprep':
      case 'teepprep':
      case 'lowkickprep':
      case 'knieprep':
        this.vx *= 0.6;
        this.facing = dx > 0 ? 1 : -1;
        if (this.timer <= 0) {
          var wohin = { jabprep: 'idle', teepprep: 'teep', lowkickprep: 'lowkick', knieprep: 'knie' }[this.state];
          if (wohin === 'idle') this.go('idle', 0);
          else this.go(wohin, wohin === 'knie' ? 60 : (wohin === 'lowkick' ? 18 : 16));
          if (wohin === 'lowkick') this.kickTraf = false;
          if (wohin === 'knie') {
            var zx = p.cx() + p.vx * 14 - this.cx();
            this.vy = -8.2;
            this.vx = Math.max(-4.6, Math.min(4.6, zx / 30)) * spd;
            this.landed = false;
            global.Sound.play('bossRoar');
          }
        }
        break;

      case 'jab':
      case 'cross':
        if (this.timer === (this.state === 'cross' ? 14 : 9)) {
          var gross = this.state === 'cross';
          schlag(this, g, gross ? 30 : 24, 16, 14, gross ? 7 : 6);
          this.vx = this.facing * (gross ? 4.4 : 3.2);
          if (gross) g.floats.add(this.cx() + this.facing * 26, this.y + 2, 'GERADE!', '#ff3a3a', 26);
        }
        this.vx *= 0.82;
        if (this.timer <= 0) this.go('idle', this.state === 'cross' ? 20 : 2);
        break;

      // Teep: Stosstritt. Tut weh und schiebt weit weg.
      case 'teep':
        if (this.timer === 14) {
          var f = schlag(this, g, 32, 22, this.h - 36, 8);
          if (f) f.wucht = 7.5;
          this.vx = this.facing * 2;
          g.floats.add(this.cx() + this.facing * 26, this.y + 8, 'TEEP!', '#ff3a3a', 26);
        }
        this.vx *= 0.85;
        if (this.timer <= 0) this.go('idle', 16);
        break;

      // Low Kick: flach ueber den Boden. Drueberspringen! Wer das
      // schafft, laesst ihn ins Leere treten (er ist dann schwindelig).
      case 'lowkick':
        if (this.timer === 14) {
          schlag(this, g, 46, 20, this.h - 20, 9);
          this.vx = this.facing * 1.6;
          global.Sound.play('whoosh');
        }
        this.vx *= 0.85;
        if (this.timer <= 0) {
          if (!this.kickTraf) {
            this.aufstehText = 'DAS... WAR EINE FINTE.';
            betaeuben(this, g, this.phase >= 3 ? 80 : 95, 'INS LEERE! ALLES DREHT SICH!', '#ff3a3a');
          } else this.go('idle', 14);
        }
        break;

      // Fliegendes Knie: im Bogen auf Yusuf, Landung mit Bodenwelle
      case 'knie':
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 56) {
          this.landed = true;
          this.vx = 0;
          groundWaves(this, g, '#ff3a3a', 3.0, 1, 50);
          this.go('knieende', 30);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 20);
        break;

      case 'knieende':
        this.vx *= 0.7;
        if (this.timer <= 0) this.go('idle', 6);
        break;
    }

    bossMove(this, g);

    this.animT++;
    if (this.animT > (this.state === 'dash' || this.state === 'stance' ? 3 : 7)) {
      this.animT = 0; this.anim++;
    }

    this.open = !HUS_ZU[this.state];
    bossContact(this, g);
  };

  /** Goldene Funken am Sixpack */
  Boss.prototype.glitzer = function (g) {
    g.particles.spawn({ x: this.cx() + (Math.random() - 0.5) * 10, y: this.y + 24 + Math.random() * 16,
                        vx: (Math.random() - 0.5) * 0.6, vy: -0.6, life: 18,
                        col: (this.t0 % 8) ? '#fff4c8' : '#ffd257', size: 2, grav: 0 });
  };

  Boss.prototype.pickAttack = function (g) {
    var self = this, P3 = this.phase >= 3;
    if (this.look === 'muaythai') {
      waehle(this, g, [
        { s: 'stance', t: 46, w: function (l) { return l.weit ? 4 : (l.mittel ? 2 : 0.4); } },
        { s: 'jabprep', t: 12, w: function (l) { return l.nah ? 6 : 0; },
          dann: function (b) { kombo(b, [['jab', 10], ['jab', 10], ['cross', 16]]); } },
        { s: 'teepprep', t: 18, w: function (l) { return l.nah ? 3 : 0.3; } },
        { s: 'lowkickprep', t: 22, w: function (l) { return l.nah ? 3 : (l.mittel ? 2 : 0); } },
        { s: 'knieprep', t: 20, w: function (l) { return l.mittel ? 4 : (l.weit ? 2.5 : (l.oben ? 3 : 0.8)); } },
        { s: 'dashprep', t: 16, w: function (l) { return l.weit ? 2 : 0.3; } }
      ]);
      return;
    }
    if (this.look === 'sixpack') {
      waehle(this, g, [
        { s: 'flex', t: 48, w: function (l) { return l.nah ? 0.8 : 3; } },
        { s: 'burpees', t: 100, w: function (l) { return (l.nah || l.oben) ? 3 : 1.4; } },
        { s: 'liegewelle', t: 96, w: 1.2, dann: function (b) { b.pushups = 0; } },
        { s: 'dashprep', t: 22, w: function (l) { return l.weit ? 4 : 1.2; } },
        { s: 'hop', t: 60, w: function (l) { return l.mittel ? 2.5 : 1.2; } },
        { s: 'throw', t: 30, w: function (l) { return l.nah ? 0.4 : 1.8; } },
        { s: 'shake', t: 28, w: function (l) { return l.mittel ? 1.6 : 0.8; } }
      ]);
      return;
    }
    waehle(this, g, [
      { s: 'hop', t: 66, w: function (l) { return l.mittel ? 3 : 2; } },
      { s: 'throw', t: 38, w: function (l) { return l.nah ? 0.5 : 3; } },
      { s: 'dashprep', t: 28, w: function (l) { return l.weit ? 4 : (l.mittel ? 2 : 0.6); } },
      { s: 'jump', t: 60, w: function (l) { return (l.oben || l.ueber) ? 5 : 0.8; },
        dann: function (b) { b.vy = -9.2; b.vx = b.facing * 2.2; } },
      { s: 'shake', t: 30, w: function (l) { return l.mittel ? 1 : 0.4; } },
      { s: 'walk', t: 42, w: function (l) { return l.weit ? 1 : 0.3; } },
      { s: 'pushups', t: 70, w: 0.6, dann: function (b) { b.pushups = 0; } }
    ]);
  };

  /** Einheitliche Signatur fuer ALLE Bosse: (spiel, schaden, spieler). */
  Boss.prototype.hit = function (g, dmg, p) {
    if (this.invuln > 0 || this.dead || this.state === 'transform') return;
    var liege = HUS_LIEGE[this.state];
    this.hp -= dmg;
    bossBounce(this, g, p, '#9dff6a', dmg);
    if (Math.random() < 0.5) global.Sound.play('laugh');
    g.floats.add(this.cx(), this.y - 6, 'TREFFER!', '#9dff6a', 45);

    if (herzWeg(this, g)) return;
    if (this.hp <= 0) {
      this.dead = true; this.deadTimer = 0; this.vy = -7;
      g.shake(10, 40);
      global.Sound.play('bossRoar');
      g.onBossDead();
      return;
    }
    // Der Trick: mitten in der Liegestuetze draufgesprungen
    if (liege) {
      this.aufstehText = 'DIE ZÄHLT NICHT. NOCHMAL VON VORN.';
      betaeuben(this, g, this.rage ? 100 : 120, 'PLATT! MITTEN IN DER LIEGESTÜTZE!', '#9dff6a');
    }
  };

  /* ================= LEVEL-BOSSE: Mirkan, Lennart, Erfan =================
     Drei Bosse in einer Klasse — jeder mit eigenem Trick (Mario) und
     eigenen Angriffen, die er je nach Lage waehlt (Hollow Knight):
       MIRKAN   rast mit dem Mercedes los — und zwar bis zur Wand. Wer
                ausweicht (drueberspringen), laesst ihn gegen die Mauer
                krachen: MOTOR ABGEWUERGT, betaeubt. Mit den schwarzen
                Felgen faehrt er auch rueckwaerts (es piept!), mit Nitro
                prallt er zweimal von den Waenden ab, bevor er absaeuft.
       LENNART  KREUZHEBEN: 200 Kilo hoch, auf den Boden (Bodenwellen), und
                danach ist er fertig. Trinkt er seinen Shake, heilt er —
                unterbrechen! Haut er Yusuf, posiert er vor dem Spiegel.
       ERFAN    bewegt sich staendig, wie ein Hammerbruder: haelt Abstand,
                weicht aus, stoesst mit dem Spiess zu (Anlauf, dann offen).
                Was er wirft und daneben geht, steckt im Boden — dreimal sein
                Koobideh essen, und er heult (betaeubt). Als PERSISCHER
                KOENIG fliegt er auf einem Teppich (draufspringen holt ihn
                runter), als SAFRAN-KOENIG kommt alles schneller und gleich
                drei Stoesse hintereinander.
     ================================================================= */

  var MINIBOSS = {
    mirkan: {
      w: 72, h: 30, hp: 10, name: 'MIRKAN', col: '#dfe4f0',
      spr: ['mercedes', 'mercedes'], scale: 2, stompY: 22, score: 1500,
      rageName: 'TUNING-MODUS', rageCol: '#ff5a3c',
      letzte: { name: 'NITRO-MODUS', col: '#4ad8ff', ruf: 'NITRO!', vorher: 'WAS MACHT DIESER ROTE KNOPF?' }
    },
    lennart: {
      w: 30, h: 44, hp: 11, name: 'LENNART', col: '#e8b894',
      spr: ['lennart', 'lennart2'], scale: 2, stompY: 22, score: 1800,
      rageName: 'MASSEPHASE', rageCol: '#ff6a4a',
      letzte: { name: 'PRE-WORKOUT', col: '#ff3aa8', ruf: 'PRE-WORKOUT!', vorher: 'DREI LÖFFEL. OHNE WASSER.' }
    },
    erfan: {
      w: 26, h: 56, hp: 12, name: 'ERFAN', col: '#e8c24a',
      spr: ['erfan', 'erfan2'], scale: 2, stompY: 26, score: 2200,
      rageName: 'PERSISCHER KÖNIG', rageCol: '#c86aff',
      letzte: { name: 'SAFRAN-KÖNIG', col: '#ffb000', ruf: 'SAFRAN-KÖNIG!', vorher: 'ICH HAB NOCH EIN GRAMM SAFRAN. EIN GANZES.' }
    }
  };

  /* Zustaende, in denen er nicht offen ist: Beruehrung tut weh, draufspringen
     bringt nichts (bis auf den Teppich: von oben geht der). */
  var MINI_ZU = {
    mirkan: { charge: 1, nitro: 1, drift: 1, carjump: 1, rueckwaerts: 1 },
    lennart: { charge: 1, slam: 1, doubleslam: 1, kreuzheben: 1 },
    erfan: { stoss: 1, wirbel: 1, pfanne: 1 }
  };

  function MiniBoss(type, tx, ty) {
    var d = MINIBOSS[type];
    this.t = type;
    this.def = d;
    this.w = d.w; this.h = d.h;
    this.x = tx * T - (d.w - T) / 2; this.y = ty * T - this.h;
    this.floorRow = ty;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = d.hp; this.maxHp = d.hp;
    this.phase = 1;
    this.rage = false;
    this.t0 = 0; this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.timer = 60;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deadTimer = 0;
    this.grounded = false;
    this.open = true;
    this.pumped = false;
    this.spin = 0;
    this.scale = d.scale;
    this.stompY = d.stompY;
    this.rageName = d.rageName;
    this.rageCol = d.rageCol;
    this.landed = true;
    this.gegessen = 0;          // Erfan: wie viel Koobideh Yusuf ihm vom Boden geklaut hat
    this.shakeHerz = 0;         // Lennart: in welchem Herz der Shake schon dran war
    this.abpraller = 0;         // Mirkan: Wandtreffer beim Nitro-Sturmlauf
    this.spottPause = 0;
    this.schwebt = false;
    if (type === 'erfan') this.ausweichChance = 0.32;
    dreiHerzen(this, d.letzte);
  }

  MiniBoss.prototype.cx = function () { return this.x + this.w / 2; };
  MiniBoss.prototype.go = function (s, t) { this.state = s; this.timer = t; };

  /** Was bei der Verwandlung passiert (still = nach einem Tod, ohne Show). */
  MiniBoss.prototype.onTransform = function () {
    this.rage = true;
    // Mirkan: schwarze Felgen drauf. Damit ist er schneller (und hat die
    // alten zum Werfen). Die Ansage dazu kommt nur einmal.
    if (this.t === 'mirkan') { this.felgen = true; this.felgenAnsage = true; }
    // Erfan: erst Persischer Koenig (Krone, Purpur), dann Safran-Koenig —
    // der waechst dabei auch noch
    if (this.t === 'erfan') {
      this.look = this.leben <= 1 ? 'safrankoenig' : 'koenig';
      this.schwebt = false;
      if (this.look === 'safrankoenig' && this.scale < 3) {
        var fussE = this.y + this.h, mitteE = this.cx();
        this.scale = 3;
        this.w = 38; this.h = 84; this.stompY = 36;
        this.y = fussE - this.h;
        this.x = mitteE - this.w / 2;
      }
    }
    if (this.t === 'lennart' && this.scale < 3) {
      // Lennart wird sichtbar groesser
      var footY = this.y + this.h, mid = this.cx();
      this.scale = 3;
      this.w = 44; this.h = 66; this.stompY = 32;
      this.y = footY - this.h;
      this.x = mid - this.w / 2;
      this.pumped = true;
    }
  };

  /** Mirkans Hupe: schiebt Yusuf weg, tut aber nicht weh. */
  MiniBoss.prototype.honk = function (g, p, dx) {
    global.Sound.play('bossRoar');
    g.shake(5, 14);
    g.floats.add(this.cx(), this.y - 18, 'TUUUUT!', '#ffd257', 50);
    for (var h = 0; h < 18; h++) {
      g.particles.spawn({
        x: this.cx(), y: this.y + 6,
        vx: (h / 17 - 0.5) * 7, vy: -Math.random() * 1.4,
        life: 26, col: '#dfe4f0', size: 2, grav: 0.1
      });
    }
    if (Math.abs(dx) < 130) {
      p.vx += (dx > 0 ? 1 : -1) * 4.8;
      p.vy = Math.min(p.vy, -3.2);
    }
  };

  MiniBoss.prototype.update = function (g) {
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.spottPause > 0) this.spottPause--;
    if (this.punchT > 0) this.punchT--;
    if (this.dead) { this.schwebt = false; bossDeath(this, g, this.def.col); return; }

    var p = g.player;
    var dx = p.cx() - this.cx();
    // Mit jedem Herz schneller (Mirkan mit den neuen Felgen noch etwas mehr)
    var spd = this.rage ? (this.t === 'mirkan' ? (this.felgen ? 1.38 : 1.22) : 1.3) : 1;
    if (this.phase >= 3) spd *= 1.12;
    this.timer--;
    rageSparks(this, g);

    switch (this.state) {
      case 'transform':
        // Mirkans Felgenwechsel: der Wagen hebt sich, die alten Felgen
        // fliegen raus, es klackert
        if (this.t === 'mirkan') {
          if (this.timer > 60 && this.timer % 9 === 0) {
            global.Sound.play(this.timer % 18 ? 'brk' : 'select');
            g.particles.burst(this.cx() + (this.timer % 18 ? -23 : 25), this.y + this.h - 6, 8,
                              { col: '#d6dbe6', spread: 2.6, up: 1.4, life: 24 });
          }
          if (this.timer === 84) g.floats.add(this.cx(), this.y - 24, 'KLACK. KLACK. KLACK.', '#d6dbe6', 50);
        }
        if (tickTransform(this, g, this.t === 'mirkan' ? 'SCHWARZE FELGEN!' : this.rageName + '!', this.rageCol)) {
          this.go('idle', 12);
          this.phase = herzPhase(this);
          g.onMiniPhase(this.t, this.phase);
        }
        break;

      case 'idle':
        this.vx *= 0.82;
        this.facing = dx > 0 ? 1 : -1;
        if (komboWeiter(this, g)) break;
        if (this.timer <= 0) this.pick(g, dx);
        break;

      case 'betaeubt':
        tickBetaeubt(this, g);
        break;

      case 'spott':
        this.vx *= 0.8;
        if (this.t0 % 14 === 0) global.Sound.play('select');
        if (this.timer <= 0) this.go('idle', 10);
        break;

      case 'walk':
        if (this.t === 'erfan') this.tanzen(g, p, dx, spd);
        else klugLaufen(this, g, (this.t === 'mirkan' ? 2.4 : 1.5) * spd);
        if (this.timer <= 0) this.go('idle', this.rage ? 10 : 20);
        break;

      case 'jump':
        if (this.grounded && this.timer < 44) this.go('idle', this.rage ? 12 : 24);
        break;

      default:
        if (this.t === 'mirkan') this.mirkan(g, p, dx, spd);
        else if (this.t === 'lennart') this.lennart(g, p, dx, spd);
        else this.erfan(g, p, dx, spd);
    }

    if (this.schwebt) this.schweben(g);
    else bossMove(this, g);

    this.animT++;
    var fast = (this.state === 'charge' || this.state === 'nitro' || this.state === 'drift' || this.state === 'wirbel' ||
                this.state === 'stoss' || this.state === 'rueckwaerts');
    if (this.animT > (fast ? 3 : 8)) { this.animT = 0; this.anim++; }

    this.open = !MINI_ZU[this.t][this.state];
    bossContact(this, g);
  };

  /* ---------------- MIRKAN ---------------- */

  /** Gegen die Wand gekracht: beim Nitro erst abprallen, sonst Motor aus. */
  MiniBoss.prototype.wand = function (g) {
    g.shake(10, 24);
    global.Sound.play('crash');
    var wx = this.facing > 0 ? this.x + this.w : this.x;
    g.particles.burst(wx, this.y + this.h / 2, 22, { col: '#ffd257', spread: 3.4, up: 1.2, life: 26 });
    g.particles.burst(wx, this.y + 4, 10, { col: '#8e8880', spread: 1.6, up: 1.4, life: 40, grav: -0.02 });
    if (this.state === 'nitro' && this.abpraller < 2) {
      // Abprallen wie ein Flipperball — und gleich wieder los
      this.abpraller++;
      this.facing = -this.facing;
      this.vx = this.facing * 2;
      this.timer = 70;
      g.floats.add(this.cx(), this.y - 16, this.abpraller === 1 ? 'NOCHMAL!' : 'UND NOCHMAL!', '#4ad8ff', 45);
      return;
    }
    var rueck = this.state === 'rueckwaerts';
    this.vx = (rueck ? 1 : -1) * this.facing * 2.4;
    this.vy = -3;
    this.aufstehText = rueck ? 'DER KOFFERRAUM! MEIN KOFFERRAUM!' : 'WO IST DER ZÜNDSCHLÜSSEL?';
    betaeuben(this, g, this.phase >= 3 ? 95 : (this.rage ? 110 : 130),
              rueck ? 'RÜCKWÄRTS IN DIE WAND!' : 'MOTOR ABGEWÜRGT!', '#ff8a5a');
  };

  MiniBoss.prototype.mirkan = function (g, p, dx, spd) {
    var i, s;
    switch (this.state) {
      // Er laesst den Motor aufheulen: Qualm, Zittern — dann geht es los
      case 'chargeprep':
      case 'nitroprep':
        this.vx *= 0.7;
        if (this.t0 % 3 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * this.w / 2, y: this.y + this.h - 4,
                              vx: -this.facing * 1.4, vy: -0.6, life: 18,
                              col: this.state === 'nitroprep' ? '#4ad8ff' : '#8e8880', size: 3, grav: -0.02 });
        }
        if (this.timer === 18) g.floats.add(this.cx(), this.y - 18, this.state === 'nitroprep' ? 'NITRO! WAS PASSIERT JETZT?' : 'BRUMM BRUMM!', '#ffd257', 40);
        if (this.timer <= 0) {
          this.abpraller = 0;
          this.go(this.state === 'nitroprep' ? 'nitro' : 'charge', 170);
          global.Sound.play(this.state === 'nitro' ? 'nitro' : 'bossRoar');
          g.shake(3, 8);
        }
        break;

      // Volle Kraft geradeaus — bis zur Wand (dort kracht es)
      case 'charge':
      case 'nitro':
        var nitro = this.state === 'nitro';
        this.vx = this.facing * (nitro ? 7.2 : 6.0) * spd;
        if (this.timer % 20 === 0) g.addProjectile('frage', this.cx() - 5, this.y + 2, -this.facing * 0.6, -2.2);
        if (this.t0 % 2 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * this.w / 2, y: this.y + this.h - 2,
                              vx: -this.facing * 1.0, vy: -0.4, life: 18,
                              col: nitro ? '#4ad8ff' : (this.rage ? this.rageCol : '#c8c0b0'), size: 2, grav: -0.01 });
        }
        if (anWand(this, g, this.vx)) { this.wand(g); break; }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 30);
        break;

      // Rueckwaerts: es piept, die Rueckfahrlichter gehen an — und er rammt
      case 'rueckprep':
        this.vx *= 0.7;
        this.facing = dx > 0 ? -1 : 1;              // die Nase zeigt weg von Yusuf
        if (this.timer % 8 === 0) global.Sound.play('beep');
        if (this.timer === 28) g.floats.add(this.cx(), this.y - 18, 'PIEP. PIEP. PIEP.', '#ffffff', 50);
        if (this.timer <= 0) { this.go('rueckwaerts', 150); global.Sound.play('bossRoar'); }
        break;
      case 'rueckwaerts':
        this.vx = -this.facing * 5.4 * spd;
        if (anWand(this, g, this.vx)) { this.wand(g); break; }
        if (this.timer <= 0) this.go('idle', 24);
        break;

      case 'fragen':
        this.vx *= 0.8;
        if (this.timer === 16 || this.timer === 4) {
          var nq = this.rage ? 3 : 2;   // erster Boss: nicht zu viele Fragen auf einmal
          for (i = 0; i < nq; i++) {
            s = (i - (nq - 1) / 2) * 1.15;
            g.addProjectile('frage', this.cx() - 5, this.y - 4,
                            this.facing * 1.6 + s, -3.4 - Math.abs(s) * 0.2);
          }
          global.Sound.play('shoot');
          if (this.timer === 16) {
            var ql = global.Levels.mirkanLines;
            g.floats.add(this.cx(), this.y - 16,
                         ql[(Math.random() * ql.length) | 0], '#dfe4f0', 60);
          }
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 30);
        break;

      case 'hupe':
        this.vx *= 0.9;
        if (this.timer === 20) this.honk(g, p, dx);
        if (this.timer <= 0) this.go('idle', this.rage ? 14 : 28);
        break;

      // Er setzt mit dem Wagen ueber und knallt auf den Boden
      case 'carjump':
        // Vorher heult der Motor auf: kurzes Zittern und Qualm als Warnung
        if (this.timer > 34) {
          this.vx *= 0.8;
          if (this.timer % 3 === 0) {
            g.particles.spawn({ x: this.cx() - this.facing * this.w / 2, y: this.y + this.h - 4,
                                vx: -this.facing * 1.4, vy: -0.6, life: 18, col: '#8e8880',
                                size: 3, grav: -0.02 });
          }
        }
        if (this.timer === 34) {
          this.vy = -10.5;
          this.vx = (dx > 0 ? 1 : -1) * 3.4 * spd;
          this.landed = false;
          global.Sound.play('bossRoar');
        }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 30) {
          this.landed = true;
          // Erster Boss: Wellen erst in der zweiten Form, und sie laufen nicht weit
          if (this.rage) groundWaves(this, g, '#dfe4f0', 3.0, 1, 55);
          else { g.shake(8, 20); global.Sound.play('pound'); }
          this.go('idle', this.rage ? 16 : 30);
        }
        // Erst nach der Landung aufhoeren — vorher lief die Zeit in der Luft
        // ab, und die Bodenwelle beim Aufprall kam nie.
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 24);
        break;

      // TUNING-MODUS: Zickzack quer durch die Arena
      case 'drift':
        this.vx = this.facing * 5.6;
        if (this.timer > 0 && this.timer % 32 === 0) {
          this.facing = -this.facing;
          g.shake(3, 6);
          global.Sound.play('shoot');
        }
        if (this.t0 % 2 === 0) {
          g.particles.spawn({
            x: this.cx() - this.facing * this.w / 2, y: this.y + this.h - 2,
            vx: -this.facing * 1.2, vy: -0.4, life: 22,
            col: '#ff5a3c', size: 3, grav: -0.02
          });
        }
        if (this.timer <= 0) this.go('idle', 20);
        break;

      // Mit den neuen Felgen: er wirft die alten. Sie rollen auf Yusuf zu.
      case 'felgenwurf':
        this.vx *= 0.8;
        if (this.timer > 16 && this.timer % 6 === 0) {
          g.particles.spawn({ x: this.cx(), y: this.y + 4, vx: (Math.random() - 0.5) * 1.5, vy: -1.2, life: 16,
                              col: '#d6dbe6', size: 2, grav: 0.06 });
        }
        if (this.timer === 16 || this.timer === 2) {
          g.addProjectile('felge', this.cx() - 6, this.y + this.h - 14, this.facing * 3.1 * spd, -2.6);
          global.Sound.play('shoot');
          if (this.timer === 16) g.floats.add(this.cx(), this.y - 16, 'DIE ALTEN KANNST DU HABEN!', '#dfe4f0', 60);
        }
        if (this.timer <= 0) this.go('idle', 22);
        break;

      // TUNING-MODUS: drei Hupen hintereinander, jede mit Fragen
      case 'hupkonzert':
        this.vx *= 0.85;
        if (this.timer === 60 || this.timer === 40 || this.timer === 20) {
          this.honk(g, p, dx);
          g.addProjectile('frage', this.cx() - 5, this.y - 4, (Math.random() < 0.5 ? -1 : 1) * 1.6, -3.8);
        }
        if (this.timer <= 0) this.go('idle', 16);
        break;

      default:
        this.go('idle', 20);
    }
  };

  MiniBoss.prototype.pickMirkan = function (g) {
    var R = this.rage, P3 = this.phase >= 3, self = this;
    var w = waehle(this, g, [
      { s: 'chargeprep', t: R ? 18 : 26, w: function (l) { return l.weit ? 5 : (l.mittel ? 3 : 1); } },
      { s: 'fragen', t: R ? 34 : 38, w: function (l) { return l.mittel ? 3 : (l.weit ? 2 : 0.6); } },
      { s: 'hupe', t: 40, w: function (l) { return l.nah ? 5 : 0.3; } },
      { s: 'carjump', t: 50, w: function (l) { return (l.oben || l.ueber) ? 5 : (l.nah ? 2 : 0.8); } },
      { s: 'walk', t: 36, w: function (l) { return l.weit && !R ? 1 : 0.2; } },
      R && self.felgen ? { s: 'felgenwurf', t: 44, w: function (l) { return l.nah ? 1 : 3; } } : null,
      R ? { s: 'drift', t: 97, w: function (l) { return l.weit ? 0.8 : 2; } } : null,
      R ? { s: 'rueckprep', t: 34, w: function (l) { return l.hinten ? 5 : 1.2; } } : null,
      R ? { s: 'hupkonzert', t: 66, w: function (l) { return l.nah ? 2.5 : 0.5; } } : null,
      P3 ? { s: 'nitroprep', t: 26, w: function (l) { return l.weit ? 5 : 3; } } : null
    ]);
    // Im letzten Herz: erst wegschieben, dann sofort losrasen
    if (P3 && w && w.s === 'hupe' && Math.random() < 0.6) kombo(this, [['chargeprep', 14]]);
  };

  /* ---------------- LENNART ---------------- */

  MiniBoss.prototype.lennart = function (g, p, dx, spd) {
    var i;
    switch (this.state) {
      case 'chargeprep':
        this.vx *= 0.7;
        if (this.timer <= 0) {
          this.go('charge', 32);
          global.Sound.play('bossRoar');
          g.shake(3, 8);
        }
        break;

      case 'charge':
        this.vx = this.facing * 3.8 * spd;
        if (this.t0 % 2 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * this.w / 2, y: this.y + this.h - 2,
                              vx: -this.facing * 1.0, vy: -0.4, life: 18,
                              col: this.rage ? this.rageCol : '#c8c0b0', size: 2, grav: -0.01 });
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 34);
        break;

      case 'hantel':
        this.vx *= 0.8;
        if (this.timer === 18) {
          var hn = this.rage ? 4 : 2;
          for (i = 0; i < hn; i++) {
            g.addProjectile('hantel', this.cx() - 11, this.y + 8,
                            this.facing * (2.2 + i * 0.7) * spd, -3.6 - i * 0.35);
          }
          global.Sound.play('shoot');
          var ll = global.Levels.lennartLines;
          g.floats.add(this.cx(), this.y - 14,
                       ll[(Math.random() * ll.length) | 0], '#ffd257', 60);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 30);
        break;

      // Der Curl: Hantel hoch ... und vor die Brust geschwungen. Nur ganz nah.
      case 'curl':
        this.vx *= 0.7;
        if (this.timer === 6) {
          schlag(this, g, 26, this.h * 0.6, this.h * 0.15, 8, 3.2);
          g.floats.add(this.cx(), this.y - 12, 'CURL!', '#ffd257', 30);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 12 : 22);
        break;

      // Springt hoch und kommt mit vollem Gewicht runter
      case 'slam':
        if (this.timer === 44) {
          this.vy = -10;
          this.vx = (dx > 0 ? 1 : -1) * 1.8 * spd;
          this.landed = false;
        }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 40) {
          this.landed = true;
          groundWaves(this, g, this.rage ? '#ff6a4a' : '#e8b894', 3.2, this.rage ? 2 : 1);
          g.addProjectile('hantel', this.cx() - 11, this.y + this.h - 14, -3.2, -2.4);
          g.addProjectile('hantel', this.cx() - 11, this.y + this.h - 14, 3.2, -2.4);
          this.go('idle', this.rage ? 16 : 32);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 24);
        break;

      // MASSEPHASE: zwei Einschlaege direkt hintereinander
      case 'doubleslam':
        if (this.timer === 86 || this.timer === 46) {
          this.vy = -9.6;
          this.vx = (dx > 0 ? 1 : -1) * 2.4;
          this.landed = false;
        }
        if (this.grounded && !this.landed && this.vy >= 0) {
          this.landed = true;
          groundWaves(this, g, '#ff6a4a', 3.6, 2);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 20);
        break;

      // MASSEPHASE: Hanteln fallen von oben
      case 'hantelregen':
        this.vx *= 0.8;
        if (this.timer === 70) g.floats.add(this.cx(), this.y - 14, 'HANTELN VON OBEN!', '#ff6a4a', 60);
        if (this.timer % 12 === 0) rainFromSky(g, 'hantel', 1.2);
        if (this.timer <= 0) this.go('idle', 18);
        break;

      // MASSEPHASE: Shaker, gerade und schnell
      case 'shakewurf':
        this.vx *= 0.8;
        if (this.timer === 16 || this.timer === 6) {
          g.addProjectile('shaker', this.cx() - 5, this.y + this.h * 0.4, this.facing * 4.4, 0);
          global.Sound.play('shoot');
        }
        if (this.timer <= 0) this.go('idle', 16);
        break;

      case 'pushups':
        this.vx = 0;
        this.spin++;
        if (this.spin % 14 === 0) {
          global.Sound.play('select');
          g.floats.add(this.cx(), this.y - 10, '' + Math.floor(this.spin / 14), '#ffd257', 26);
        }
        if (this.timer <= 0) {
          this.go('idle', 20);
          this.pumped = true;
          g.floats.add(this.cx(), this.y - 16, 'JETZT BIN ICH WARM!', '#ffd257', 70);
        }
        break;

      // KREUZHEBEN: buecken ... 200 Kilo hoch ... und auf den Boden.
      // Danach ist er fertig — das ist die Gelegenheit.
      case 'kreuzprep':
        this.vx *= 0.6;
        if (this.timer === 50) {
          g.floats.add(this.cx(), this.y - 18, 'KREUZHEBEN! 200 KILO!', '#ffd257', 70);
          global.Sound.play('growl');
        }
        if (this.timer <= 0) { this.go('kreuzheben', 40); global.Sound.play('bossRoar'); }
        break;
      case 'kreuzheben':
        this.vx = 0;
        if (this.timer === 12) {
          // Und runter damit. Die ganze Halle bebt.
          groundWaves(this, g, this.rage ? '#ff6a4a' : '#e8b894', 3.8, this.rage ? 2 : 1);
          g.shake(12, 26);
          for (i = 0; i < 2; i++) rainFromSky(g, 'hantel', 1.4);
        }
        if (this.timer <= 0) {
          this.aufstehText = 'DAS WAR EIN PR, BRO.';
          betaeuben(this, g, this.phase >= 3 ? 95 : (this.rage ? 110 : 125), 'PUH... ZU SCHWER.', '#e8b894');
        }
        break;

      // Der Shake: er trinkt und wird wieder fit. Unterbrechen!
      case 'shake':
        this.vx *= 0.6;
        if (this.timer % 35 === 0 && this.timer > 0) {
          var vorher = this.hp;
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.12);
          if (this.hp > vorher) {
            g.floats.add(this.cx(), this.y - 10, '+PROTEIN', '#8cd85a', 40);
            g.particles.burst(this.cx(), this.y + 10, 8, { col: '#8cd85a', spread: 1.6, up: 1, life: 24 });
            global.Sound.play('heal');
          }
        }
        if (this.timer <= 0) this.go('idle', 14);
        break;

      default:
        this.go('idle', 20);
    }
  };

  MiniBoss.prototype.pickLennart = function (g) {
    var R = this.rage, P3 = this.phase >= 3, self = this;
    var shakeDarf = this.hp < this.maxHp * 0.55 && this.shakeHerz !== this.leben;
    var w = waehle(this, g, [
      { s: 'hantel', t: R ? 34 : 40, w: function (l) { return l.nah ? 1 : 3; } },
      { s: 'curl', t: 24, w: function (l) { return l.nah ? 5 : 0; } },
      { s: 'slam', t: 48, w: function (l) { return (l.ueber || l.oben) ? 5 : (l.nah ? 2 : 1.2); } },
      { s: 'chargeprep', t: R ? 18 : 24, w: function (l) { return l.weit ? 4 : (l.mittel ? 2 : 0.5); } },
      { s: 'kreuzprep', t: 56, w: function (l) { return l.nah ? 1 : 2; } },
      !this.pumped && !R ? { s: 'pushups', t: 76, w: function (l) { return l.weit ? 1 : 0.4; }, dann: function (b) { b.spin = 0; } } : null,
      shakeDarf ? { s: 'shake', t: 140, w: 6, dann: function (b, gg) {
        b.shakeHerz = b.leben;
        gg.floats.add(b.cx(), b.y - 18, 'SHAKE-PAUSE! (UNTERBRICH IHN!)', '#8cd85a', 90);
      } } : null,
      { s: 'walk', t: 40, w: function (l) { return l.weit ? 1 : 0.2; } },
      R ? { s: 'doubleslam', t: 90, w: function (l) { return l.nah || l.mittel ? 2 : 1; } } : null,
      R ? { s: 'hantelregen', t: 72, w: function (l) { return l.oben ? 4 : 1.4; } } : null,
      R ? { s: 'shakewurf', t: 26, w: function (l) { return l.nah ? 0.5 : 3; } } : null
    ]);
    // Pre-Workout: alles kommt im Doppelpack
    if (P3 && w) {
      if (w.s === 'chargeprep' && Math.random() < 0.6) kombo(this, [['slam', 48]]);
      else if (w.s === 'curl' && Math.random() < 0.6) kombo(this, [['curl', 18], ['slam', 48]]);
    }
  };

  /* ---------------- ERFAN ---------------- */

  /** Wie ein Hammerbruder: Abstand halten, mal ran, mal weg, kleine Hopser. */
  MiniBoss.prototype.tanzen = function (g, p, dx, spd) {
    var ad = Math.abs(dx), soll = this.phase >= 3 ? 110 : 140;
    var weg = ad < soll - 30 ? -1 : (ad > soll + 40 ? 1 : 0);
    this.facing = dx > 0 ? 1 : -1;
    this.vx = this.facing * weg * 2.1 * spd;
    if (weg < 0 && anWand(this, g, this.vx)) this.vx = 0;
    if (this.grounded && this.t0 % 34 === 0 && Math.random() < 0.5) { this.vy = -4.6; global.Sound.play('jump'); }
  };

  /** Der fliegende Teppich: schwebt ueber dem Boden, prallt an den Waenden ab.
      So hoch, dass Yusuf drunter durchlaufen kann — und so niedrig, dass er
      mit dem Doppelsprung oben auf Erfan landet. */
  MiniBoss.prototype.schweben = function (g) {
    var boden = this.floorRow * T - this.h;
    var ziel = this.state === 'teppich' ? (this.scale >= 3 ? 30 : 42) : 0;
    var th = this.teppichH || 0;
    th += Math.max(-2.2, Math.min(2.2, ziel - th));
    this.teppichH = th;
    this.y = boden - th + (th > 8 ? Math.sin(this.t0 * 0.08) * 3 : 0);
    this.vy = 0;
    this.x += this.vx;
    if (g.arena) {
      var lo = g.arena.x + 6, hi = g.arena.x + g.arena.w - 6;
      if (this.x < lo) { this.x = lo; this.facing = 1; this.vx = Math.abs(this.vx); }
      if (this.x + this.w > hi) { this.x = hi - this.w; this.facing = -1; this.vx = -Math.abs(this.vx); }
    }
    this.grounded = th <= 0;
  };

  MiniBoss.prototype.erfan = function (g, p, dx, spd) {
    var i;
    switch (this.state) {
      // Rueckwaerts weghuepfen, wenn Yusuf zu nah kommt — und gleich werfen
      case 'rueckzug':
        if (this.timer === 18) {
          this.vy = -7; this.vx = -(dx > 0 ? 1 : -1) * 3.4 * spd;
          if (anWand(this, g, this.vx * 10)) this.vx = -this.vx * 0.5;
          global.Sound.play('jump');
        }
        if (this.grounded && this.timer < 12) {
          this.go('idle', 4);
          if (Math.random() < 0.7) kombo(this, [['spiesse', 26]]);
        }
        break;

      case 'spiesse':
        this.vx *= 0.8;
        if (this.timer === 18) {
          var sn = this.phase >= 3 ? 4 : (this.rage ? 3 : 2);
          for (i = 0; i < sn; i++) {
            // Im Bogen — was nicht trifft, steckt danach im Boden
            var sp = g.addProjectile('spiess', this.cx() - 8, this.y + 12 + i * 6,
                                     this.facing * (2.4 + i * 0.6) * spd, -2.6 - i * 0.5);
            if (sp) sp.grav = 0.12;
          }
          global.Sound.play('shoot');
          g.floats.add(this.cx(), this.y - 14, 'KOOBIDEH FLIEGT!', '#e8c24a', 60);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 14 : 26);
        break;

      // Der Stoss: Anlauf (der Spiess blitzt), dann schnell nach vorn, danach offen
      case 'stossprep':
        this.vx *= 0.6;
        this.facing = dx > 0 ? 1 : -1;
        if (this.timer === 20) global.Sound.play('select');
        if (this.timer <= 0) {
          // Feste Reichweite wie bei Hornet: bis knapp hinter Yusuf, nicht weiter
          this.stossZiel = p.cx() + this.facing * 40;
          this.go('stoss', 22);
          global.Sound.play('shoot');
        }
        break;
      case 'stoss':
        this.vx = this.facing * 6.2 * spd;
        if ((this.cx() - this.stossZiel) * this.facing > 0) this.timer = Math.min(this.timer, 1);
        if (this.t0 % 2 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * 10, y: this.y + this.h * 0.45, vx: -this.facing, vy: 0,
                              life: 12, col: this.rage ? this.rageCol : '#ffcf4a', size: 2, grav: 0 });
        }
        if (this.timer <= 0 || anWand(this, g, this.vx)) { this.vx = 0; this.go('stossende', 30); }
        break;
      case 'stossende':
        this.vx *= 0.7;
        if (this.timer === 26) g.floats.add(this.cx(), this.y - 12, 'HUFF.', '#c8c0d8', 30);
        if (this.timer <= 0) this.go('idle', 8);
        break;

      case 'safran':
        this.vx *= 0.8;
        if (this.timer === 16) {
          var sc2 = this.rage ? 2 : 1;
          for (i = 0; i < sc2; i++) {
            g.addProjectile('safran', this.cx() - 12 + this.facing * (18 + i * 24),
                            this.y + 12 + i * 5, this.facing * (0.6 + i * 0.2), -0.15);
          }
          global.Sound.play('shoot');
          g.floats.add(this.cx(), this.y - 14, 'SAFRAN! ECHTER SAFRAN!', '#ffcf4a', 70);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 30);
        break;

      case 'reis':
        this.vx *= 0.85;
        if (this.timer === 20) {
          var nr = this.rage ? 8 : 5;
          for (i = 0; i < nr; i++) {
            g.addProjectile('reis', this.cx() - 3, this.y + 10,
                            this.facing * (1.3 + i * (this.rage ? 0.42 : 0.6)), -4.0 + i * 0.4);
          }
          global.Sound.play('shoot');
          g.floats.add(this.cx(), this.y - 14, 'UND REIS DAZU!', '#f8f6ee', 60);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 28);
        break;

      // Er springt mit der Pfanne und schickt Wellen ueber den Boden
      case 'pfanne':
        if (this.timer === 28) { this.vy = -7.8; this.vx = (dx > 0 ? 1 : -1) * 1.6; this.landed = false; }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 26) {
          this.landed = true;
          groundWaves(this, g, '#e8c24a', 3.6, this.rage ? 2 : 1);
          this.go('idle', this.rage ? 16 : 30);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 24);
        break;

      // Koobideh faellt vom Himmel (und bleibt im Boden stecken)
      case 'spiessregen':
        this.vx *= 0.8;
        if (this.timer === 70) {
          g.floats.add(this.cx(), this.y - 14, 'KOOBIDEH-REGEN!', '#ffcf4a', 60);
        }
        if (this.timer % 10 === 0) rainFromSky(g, 'spiess', 1.8);
        if (this.timer <= 0) this.go('idle', 16);
        break;

      // Er dreht sich und verteilt Spiesse im Kreis
      case 'wirbel':
        this.facing = ((this.t0 >> 2) & 1) ? 1 : -1;
        this.vx = (dx > 0 ? 1 : -1) * 1.9;
        if (this.timer % 8 === 0) {
          var an = this.t0 * 0.8;
          var ws = g.addProjectile('spiess', this.cx() - 8, this.y + this.h * 0.35,
                                   Math.cos(an) * 3.2, -Math.abs(Math.sin(an)) * 2.6 - 0.6);
          if (ws) ws.grav = 0.1;
        }
        if (this.timer <= 0) this.go('idle', 20);
        break;

      // Dampf aus dem Samowar
      case 'samowar':
        this.vx *= 0.8;
        if (this.timer === 20) {
          for (i = 0; i < 3; i++) {
            g.addProjectile('rauch', this.cx() - 13 + (i - 1) * 40, this.y + this.h - 22,
                            (i - 1) * 0.5, -0.2);
          }
          global.Sound.play('shoot');
          g.floats.add(this.cx(), this.y - 14, 'DER TEE IST FERTIG!', '#f8f6ee', 60);
        }
        if (this.timer <= 0) this.go('idle', 18);
        break;

      // PERSISCHER KOENIG: der fliegende Teppich. Erst pfeift er ihn herbei ...
      case 'teppichprep':
        this.vx *= 0.7;
        if (this.timer === 30) { g.floats.add(this.cx(), this.y - 18, 'TEPPICH! ZU MIR!', '#c86aff', 50); global.Sound.play('select'); }
        if (this.timer <= 0) {
          this.schwebt = true; this.teppichH = 0;
          this.vx = (dx > 0 ? 1 : -1) * 2.0 * spd;
          this.go('teppich', 240);
          global.Sound.play('doubleJump');
        }
        break;
      // ... dann fliegt er drueber und wirft Koobideh und Reis nach unten.
      // Von oben draufspringen holt ihn runter.
      case 'teppich':
        if (Math.abs(this.vx) < 1) this.vx = this.facing * 2.0 * spd;
        if (this.timer % (this.phase >= 3 ? 20 : 28) === 0) {
          var tz = p.cx() + p.vx * 18 - this.cx();
          var ts = g.addProjectile('spiess', this.cx() - 8, this.y + this.h, Math.max(-2.6, Math.min(2.6, tz / 30)), 1.6);
          if (ts) ts.grav = 0.12;
          global.Sound.play('shoot');
        }
        if (this.timer % 50 === 25) {
          for (i = 0; i < 3; i++) g.addProjectile('reis', this.cx() - 3, this.y + this.h, (i - 1) * 1.2, 0.5);
        }
        if (this.timer <= 0) this.go('landung', 60);
        break;
      case 'landung':
        this.vx *= 0.92;
        if ((this.teppichH || 0) <= 0.5 || this.timer <= 0) {
          this.schwebt = false; this.teppichH = 0;
          this.go('idle', 26);
          g.floats.add(this.cx(), this.y - 14, 'LANDUNG. KÖNIGLICH.', '#c86aff', 40);
        }
        break;

      default:
        this.go('idle', 20);
    }
  };

  MiniBoss.prototype.pickErfan = function (g) {
    var R = this.rage, P3 = this.phase >= 3;
    var w = waehle(this, g, [
      { s: 'spiesse', t: R ? 30 : 36, w: function (l) { return l.nah ? 1 : (l.mittel ? 4 : 3); } },
      { s: 'stossprep', t: R ? 24 : 30, w: function (l) { return l.mittel ? 4 : (l.nah ? 2 : 1); } },
      { s: 'rueckzug', t: 22, w: function (l) { return l.nah && !l.bossAnWand ? 5 : 0; } },
      { s: 'walk', t: 50, w: function (l) { return l.weit ? 2.5 : (l.nah ? 1.5 : 0.8); } },
      { s: 'reis', t: R ? 36 : 42, w: function (l) { return l.oben ? 3 : 1.5; } },
      { s: 'safran', t: R ? 36 : 40, w: function (l) { return l.nah ? 2 : 1; } },
      { s: 'pfanne', t: 56, w: function (l) { return l.ueber ? 5 : (l.nah ? 2 : 0.8); } },
      R ? { s: 'spiessregen', t: 70, w: function (l) { return l.oben ? 4 : 1.5; } } : null,
      R ? { s: 'wirbel', t: 80, w: function (l) { return l.nah ? 3 : 1; } } : null,
      R ? { s: 'teppichprep', t: 36, w: 1.8 } : null,
      P3 ? { s: 'samowar', t: 40, w: 1.2 } : null
    ]);
    // Safran-Koenig: drei Stoesse hintereinander
    if (P3 && w && w.s === 'stossprep' && Math.random() < 0.65) kombo(this, [['stossprep', 18], ['stossprep', 18]]);
  };

  /** Yusuf hat ein Koobideh vom Boden gegessen. Beim dritten heult Erfan. */
  MiniBoss.prototype.koobidehGegessen = function (g) {
    if (this.t !== 'erfan' || this.dead) return;
    this.gegessen++;
    var SAETZE = ['DAS WAR FÜR DIE GÄSTE!', 'NICHT NOCH EINS! DAS IST MEIN BESTES!'];
    if (this.gegessen < 3) {
      sagt(this, g, SAETZE[this.gegessen - 1], '#ffcf4a', 70);
      return;
    }
    this.gegessen = 0;
    if (this.state === 'transform') return;
    this.aufstehText = 'ICH MACH NEUES. NUR FÜR MICH.';
    betaeuben(this, g, this.phase >= 3 ? 110 : 140, 'MEIN KOOBIDEH! DU ISST ES EINFACH!', '#ffcf4a');
  };

  MiniBoss.prototype.pick = function (g) {
    if (this.t === 'mirkan') this.pickMirkan(g);
    else if (this.t === 'lennart') this.pickLennart(g);
    else this.pickErfan(g);
  };

  /** Er hat Yusuf erwischt: Lennart posiert, Mirkan fragt, Erfan tanzt. */
  MiniBoss.prototype.yusufGetroffen = function (g) {
    if (this.state === 'betaeubt' || this.schwebt) return;
    if (this.t === 'lennart') spott(this, g, 'SIEHST DU DAS? DAS IST DER PUMP.', '#ffd257', 70);
    else if (this.t === 'mirkan') spott(this, g, 'TUT DAS WEH? WIE SEHR? AUF EINER SKALA?', '#dfe4f0', 50);
    else spott(this, g, 'IN DER KÜCHE GEWINNT DER KOCH.', '#ffcf4a', 50);
  };

  MiniBoss.prototype.hit = function (g, dmg, p) {
    if (this.invuln > 0 || this.dead || this.state === 'transform') return;
    // Vom Teppich holt man ihn nur, wenn er schon oben ist (nicht beim Abheben)
    var warShake = this.state === 'shake', warTeppich = this.state === 'teppich' && (this.teppichH || 0) > 28;
    this.hp -= dmg;
    bossBounce(this, g, p, this.def.col, dmg);
    // Erstes Herz leer — Mirkan: erst die Ansage (neue Felgen), dann
    // der Felgenwechsel
    if (this.hp <= 0 && this.leben > 1 && this.t === 'mirkan' && g.onMirkanFelgen && !this.felgenAnsage) {
      var self = this;
      this.felgenAnsage = true;
      naechstesLeben(this, g, false, function () { g.onMirkanFelgen(self); });
      return;
    }
    if (herzWeg(this, g)) { this.schwebt = false; return; }
    if (this.hp <= 0) {
      this.schwebt = false;
      this.dead = true; this.deadTimer = 0; this.vy = -6;
      (p || g.player).score += this.def.score;
      g.shake(8, 30);
      global.Sound.play('bossRoar');
      g.onMiniDead(this.t);
      return;
    }
    // Lennarts Shake unterbrochen, Erfan vom Teppich geholt: kurz betaeubt
    if (warShake) {
      this.aufstehText = 'MEIN SHAKE...';
      betaeuben(this, g, 70, 'MEIN SHAKE! ÜBERALL!', '#8cd85a');
    } else if (warTeppich) {
      this.schwebt = false; this.teppichH = 0;
      this.aufstehText = 'DER TEPPICH WAR GELIEHEN.';
      betaeuben(this, g, 90, 'VOM TEPPICH GEFALLEN!', '#c86aff');
    }
  };

  /* ================= ESAT — der allerletzte Kampf =================
     Haerter als alle davor. Bei halber Energie nimmt er Snus: er wird
     groesser, muskuloeser und schneller und stampft den Boden weg.
     Seit 02.10. (Esat: "alle Bosskaempfe individuell"):
       KONTER      er verschraenkt die Arme und wartet. Wer jetzt drauf-
                   springt, wird abgefangen und weggeschleudert (Hollow
                   Knight: Konterhaltung). Abwarten, dann ist er offen.
       KOHLE       Shisha-Kohle bricht in einer Reihe aus dem Boden, von
                   ihm bis zu Yusuf. Am Boden warnt die Glut vorher.
       Sein Trick  die KI-Agenten: wer zwei davon erledigt, ueberlastet
       (Mario)     seinen Server — BLUESCREEN, er ist betaeubt.
     ============================================================== */

  function BossEsat(tx, ty) {
    this.w = 22; this.h = 58;
    this.x = tx * T; this.y = ty * T - this.h;
    this.floorRow = ty;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = 15; this.maxHp = 15;
    this.phase = 1;
    this.rage = false;      // nach dem Snus
    this.buff = false;      // groesser und muskuloeser
    this.t0 = 0; this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.timer = 70;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deadTimer = 0;
    this.grounded = false;
    this.open = true;
    this.stompY = 32;
    this.landed = true;
    this.spottPause = 0;
    this.agentenWeg = 0;       // erledigte Agenten (zwei = Bluescreen)
    this.agentenDa = 0;
    this.rageName = 'SNUS AKTIV';
    this.rageCol = '#2fd39e';
    dreiHerzen(this, { name: 'JETS IM ANFLUG', col: '#6ae0ff', ruf: 'ICH KENN DA JEMANDEN!' });
  }

  BossEsat.prototype.cx = function () { return this.x + this.w / 2; };
  BossEsat.prototype.go = function (s, t) { this.state = s; this.timer = t; };

  /** Der Snus wirkt: groesser, muskuloeser, schneller. */
  BossEsat.prototype.onTransform = function () {
    this.rage = true;
    if (this.buff) return;
    this.buff = true;
    var footY = this.y + this.h, mid = this.cx();
    this.w = 36; this.h = 86; this.stompY = 42;
    this.y = footY - this.h;
    this.x = mid - this.w / 2;
  };

  BossEsat.prototype.spawnJet = function (g, fromLeft) {
    var vw = g.viewW ? g.viewW() : 512;
    var jx = fromLeft ? g.cam.x - 60 : g.cam.x + vw + 28;
    var jv = (fromLeft ? 3.4 : -3.4) * (this.rage ? 1.2 : 1);
    g.addProjectile('jet', jx, g.cam.y + 30 + (fromLeft ? 0 : 16), jv, 0);
  };

  BossEsat.prototype.yusufGetroffen = function (g) {
    var l = ['ICH HAB SCHON BESTELLT. FÜR DICH NICHT.', 'DAS HAT DIE KI GEMACHT. NICHT ICH.', 'BRUDER. ENTSPANN DICH.'];
    spott(this, g, l[(Math.random() * l.length) | 0], '#2fd39e', 54);
  };

  /** Wie viele seiner Agenten sind weg? Zwei erledigt = Bluescreen. */
  BossEsat.prototype.agentenZaehlen = function (g) {
    var n = 0;
    for (var i = 0; i < g.enemies.length; i++) {
      var en = g.enemies[i];
      if (en && en.t === 'agent' && !en.dead) n++;
    }
    if (n < this.agentenDa && this.state !== 'transform') {
      this.agentenWeg += this.agentenDa - n;
      if (this.agentenWeg === 1) sagt(this, g, 'HEY! DER HAT GERADE GELERNT!', '#2fd39e', 60);
    }
    this.agentenDa = n;
    if (this.agentenWeg >= 2 && this.state !== 'transform' && this.state !== 'betaeubt' && !this.dead) {
      this.agentenWeg = 0;
      this.aufstehText = 'NEUSTART... 3 %... 100 %. SO.';
      betaeuben(this, g, this.phase >= 3 ? 100 : 120, 'SERVER ÜBERLASTET! BLUESCREEN!', '#4a8aff');
      this.bluescreen = true;
    }
  };

  BossEsat.prototype.update = function (g) {
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.spottPause > 0) this.spottPause--;
    if (this.dead) { bossDeath(this, g, '#2fd39e'); return; }

    var p = g.player;
    var dx = p.cx() - this.cx();
    var spd = !this.rage ? 1 : (this.phase >= 3 ? 1.55 : 1.4);
    var i;
    this.timer--;
    rageSparks(this, g);
    this.agentenZaehlen(g);
    if (this.state !== 'betaeubt') this.bluescreen = false;

    switch (this.state) {
      // Er nimmt Snus. Das ist die Verwandlung.
      case 'transform':
        if (this.timer === 88) {
          sagt(this, g, this.leben > 1 ? 'MOMENT. KURZ SNUS.' : 'NOCH EINER. UND EIN ANRUF.', '#ffd257', 80);
          global.Sound.play('select');
        }
        if (tickTransform(this, g, 'SNUS WIRKT!', this.rageCol)) {
          this.go('idle', 12);
          this.phase = herzPhase(this);
          g.onEsatPhase(this.phase);
        }
        break;

      case 'idle':
        this.vx *= 0.85;
        this.facing = dx > 0 ? 1 : -1;
        if (komboWeiter(this, g)) break;
        if (this.timer <= 0) this.pickAttack(g);
        break;

      case 'betaeubt':
        if (this.bluescreen && this.t0 % 6 === 0) {
          g.particles.spawn({ x: this.cx() + (Math.random() - 0.5) * 14, y: this.y + 10, vx: 0, vy: -0.6, life: 20,
                              col: (this.t0 % 12) ? '#4a8aff' : '#ffffff', size: 3, grav: 0 });
        }
        tickBetaeubt(this, g);
        break;

      case 'spott':
        this.vx *= 0.8;
        if (this.timer <= 0) this.go('idle', 10);
        break;

      case 'walk':
        klugLaufen(this, g, 1.5 * spd);
        if (this.timer <= 0) this.go('idle', this.rage ? 10 : 20);
        break;

      // Shisha-Wolke: bleibt stehen und versperrt den Weg
      case 'shisha':
        this.vx *= 0.8;
        if (this.timer === 18) {
          var n = this.phase >= 3 ? 3 : (this.rage ? 2 : 1);
          for (i = 0; i < n; i++) {
            g.addProjectile('rauch', this.cx() - 13 + this.facing * (20 + i * 26),
                            this.y + this.h * 0.25 + i * 4,
                            this.facing * (0.5 + i * 0.15), -0.12);
          }
          global.Sound.play('shoot');
          sagt(this, g, 'ZIEH MAL DURCH', '#b8b0c8', 50, 10);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 34);
        break;

      // KI-Agenten — hoechstens zwei (mit Snus drei) gleichzeitig
      case 'agents':
        this.vx *= 0.8;
        if (this.timer === 20) {
          var live = this.agentenDa;
          // Einer pro Ruf, hoechstens zwei gleichzeitig — zwei erledigt = Bluescreen
          var count = Math.min(1, 2 - live);
          for (var a = 0; a < count; a++) {
            var e = new Enemy('agent', 0, 0);
            e.x = this.cx() - 7 + (a - 1) * 22;
            e.y = this.y + 6;
            e.homeX = e.x; e.homeY = e.y;
            g.enemies.push(e);
          }
          this.agentenDa += count;
          global.Sound.play('power');
          sagt(this, g, count ? 'ICH LASS DAS KURZ MACHEN' : 'DIE KI ARBEITET SCHON.', '#2fd39e', 60, 10);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 20 : 40);
        break;

      // Tuerkische Jets im Anflug — in Phase 3 von beiden Seiten
      case 'jets':
        this.vx *= 0.8;
        if (this.timer === 30) {
          var vw = g.viewW ? g.viewW() : 512;
          var fromLeft = p.cx() > g.cam.x + vw / 2;
          this.spawnJet(g, fromLeft);
          if (this.phase >= 3) this.spawnJet(g, !fromLeft);
          global.Sound.play('bossRoar');
          sagt(this, g, 'DECKUNG.', '#e03a30', 60, 10);
          g.shake(3, 10);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 40);
        break;

      // KONTER: Arme verschraenkt. Wer draufspringt, fliegt.
      case 'konter':
        this.vx *= 0.7;
        this.facing = dx > 0 ? 1 : -1;
        if (this.timer === 50) sagt(this, g, 'NA? SPRING DOCH.', '#2fd39e', 50);
        if (this.timer === 54) global.Sound.play('select');
        if (this.t0 % 5 === 0) {
          g.particles.spawn({ x: this.cx() + (Math.random() - 0.5) * this.w * 1.4, y: this.y + Math.random() * this.h,
                              vx: 0, vy: -0.5, life: 16, col: '#ffffff', size: 2, grav: 0 });
        }
        if (this.timer <= 0) {
          // Keiner kam: er gaehnt — und ist offen
          sagt(this, g, 'LANGWEILIG.', '#c8c0d8', 40);
          this.go('idle', 34);
        }
        break;

      // Kohle aus dem Boden: eine Reihe, von ihm bis hinter Yusuf
      case 'kohle':
        this.vx *= 0.8;
        if (this.timer === 44) {
          sagt(this, g, 'DIE KOHLE IST HEISS GENUG.', '#ff8a2a', 50);
          this.kohleX = this.cx();
          this.kohleDir = dx > 0 ? 1 : -1;
          global.Sound.play('growl');
        }
        if (this.timer < 40 && this.timer > 0 && this.timer % 6 === 0) {
          this.kohleX += this.kohleDir * 34;
          var lo = g.arena ? g.arena.x + 10 : -1e9, hi = g.arena ? g.arena.x + g.arena.w - 10 : 1e9;
          if (this.kohleX > lo && this.kohleX < hi) {
            var hoch = this.phase >= 3 ? 70 : 54;
            var k = g.addProjectile('blitz', this.kohleX - 9, this.floorRow * T - hoch, 0, 0);
            if (k) { k.h = hoch; k.col = '#ff8a2a'; k.life = 46; k.aktiv = 14; }
          }
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 14 : 24);
        break;

      case 'dashprep':
        this.vx *= 0.7;
        if (this.timer <= 0) {
          this.go('dash', 28);
          global.Sound.play('bossRoar');
          g.shake(3, 8);
        }
        break;

      case 'dash':
        this.vx = this.facing * 4.2 * spd;
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 36);
        break;

      case 'jump':
        if (this.grounded && this.timer < 44) this.go('idle', this.rage ? 12 : 26);
        break;

      // Nach dem Snus: er springt hoch und stampft den Boden weg
      case 'stampf':
        if (this.timer === 46) {
          this.vy = -10.8;
          this.vx = (dx > 0 ? 1 : -1) * 2.4 * spd;
          this.landed = false;
        }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 42) {
          this.landed = true;
          groundWaves(this, g, '#2fd39e', 3.8, 2);
          this.go('idle', this.phase >= 3 ? 12 : 18);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 20);
        break;
    }

    bossMove(this, g);

    this.animT++;
    if (this.animT > (this.state === 'dash' ? 3 : 7)) { this.animT = 0; this.anim++; }

    this.open = !(this.state === 'dash' || this.state === 'stampf' || this.state === 'konter');
    bossContact(this, g);
  };

  BossEsat.prototype.pickAttack = function (g) {
    var R = this.rage, P3 = this.phase >= 3;
    var w = waehle(this, g, [
      { s: 'shisha', t: R ? 36 : 42, w: function (l) { return l.nah ? 1 : 2.4; } },
      { s: 'agents', t: R ? 42 : 48, w: function (l, b) { return b.agentenDa >= 2 ? 0.2 : 1.8; } },
      { s: 'konter', t: 56, w: function (l) { return l.ueber ? 1.8 : (l.nah ? 0.9 : 0.25); } },
      { s: 'kohle', t: 50, w: function (l) { return l.weit ? 3 : (l.mittel ? 2.4 : 1); } },
      { s: 'walk', t: 44, w: function (l) { return l.weit && !R ? 1.2 : 0.3; } },
      { s: 'jump', t: 60, w: function (l) { return l.oben ? 2 : 0.5; },
        dann: function (b) { b.vy = R ? -10 : -8.8; b.vx = b.facing * (R ? 2.4 : 1.9); } },
      { s: 'dashprep', t: R ? 18 : 24, w: function (l) { return l.mittel ? 2 : 1; } },
      R ? { s: 'jets', t: 58, w: 1.2 } : null,
      R ? { s: 'stampf', t: 50, w: function (l) { return l.nah || l.ueber ? 1.6 : 0.9; } } : null
    ]);
    // Im letzten Herz: Kombos
    if (P3 && w) {
      if (w.s === 'dashprep' && Math.random() < 0.6) kombo(this, [['stampf', 48]]);
      else if (w.s === 'kohle' && Math.random() < 0.5) kombo(this, [['jets', 40]]);
    }
  };

  BossEsat.prototype.hit = function (g, dmg, p) {
    if (this.invuln > 0 || this.dead || this.state === 'transform') return;
    // Konter: abgefangen und weggeschleudert
    if (this.state === 'konter' && p) {
      this.invuln = 20;
      p.vy = -9; p.jumpsLeft = 0;
      p.hurt(g, 1, this.cx());
      p.vx = (p.cx() > this.cx() ? 1 : -1) * 5;
      global.Sound.play('bossHit');
      g.shake(6, 14);
      sagt(this, g, 'KONTER!', '#ffffff', 50);
      this.go('dashprep', 16);
      return;
    }
    this.hp -= dmg;
    bossBounce(this, g, p, '#2fd39e', dmg);
    if (herzWeg(this, g)) return;
    if (this.hp <= 0) {
      this.dead = true; this.deadTimer = 0; this.vy = -7;
      g.shake(10, 44);
      global.Sound.play('bossRoar');
      g.onEsatDead();
    }
  };

  /* ================= ALEX — Endgegner in der Alkoholabteilung =========
     Yusufs Kollege. Wirft Wodkaflaschen, kotzt Pfuetzen auf den Boden und
     klettert als einziger Boss auf die Regale, um dort in Ruhe ein Bier
     zu trinken. Ab der ersten Verwandlung kippt er Yusuf Alkohol ueber —
     ab da wackelt das Bild und es stehen ZWEI Alex da (g.drunk, game.js).
     Das bleibt auch nach einem Tod so (Esat, 02.10.).
     Im letzten Herz (47 PLATIN) ist er schneller und hat mehr: eine
     Kotz-Fontaene, Bierflaschen-Hagel und den Torkelsturm.
     Seine Tricks (Mario):
       - Er rutscht in seiner eigenen Pfuetze aus, wenn er durchrennt.
         Also: die Pfuetze zwischen sich und ihn bringen.
       - Wer ihn oben auf dem Regal beim Trinken erwischt, holt ihn runter.
     ================================================================= */

  var ALEX_ZU = { dash: 1, runter: 1, torkelsturm: 1 };

  function BossAlex(tx, ty) {
    this.w = 20; this.h = 58;
    this.x = tx * T; this.y = ty * T - this.h;
    this.floorRow = ty;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = 16; this.maxHp = 16;
    this.phase = 1;
    this.rage = false;
    this.t0 = 0; this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.timer = 60;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deadTimer = 0;
    this.grounded = false;
    this.open = true;
    this.stompY = 32;
    this.landed = true;
    this.sip = 0;              // trinkt gerade einen Schluck
    this.stuckT = 0;
    this.ranted = false;
    this.spottPause = 0;
    this.rutschPause = 0;
    this.rageName = 'ULTRAPENNER';
    this.rageCol = '#ff8a2a';
    dreiHerzen(this, { name: '47 PLATIN', col: '#c8e8ff', ruf: '47 PLATIN!', vorher: 'NOCH EIN SCHLUCK. FÜR DIE TROPHÄE.' });
  }

  BossAlex.prototype.cx = function () { return this.x + this.w / 2; };
  BossAlex.prototype.go = function (s, t) { this.state = s; this.timer = t; };

  /** Alex benutzt die echte Welt: er soll auf die Regale klettern.
      Damit er nicht wie frueher an Kanten klebt, springt er, wenn er
      zweimal gegen dasselbe Hindernis laeuft. */
  function alexMove(b, g) {
    ausweichen(b, g);
    b.vy += GRAV;
    if (b.vy > MAX_FALL) b.vy = MAX_FALL;
    // Vom Regal gefallen: er faellt durch bis auf den Boden
    if (b.faellt > 0) b.faellt--;
    var welt = b.faellt > 0 ? (b.bw || (b.bw = bossWorld(g, b.floorRow))) : g.world;
    var hit = moveX(b, welt, b.vx);
    b.grounded = (moveY(b, welt, b.vy) === 1);
    if (b.grounded) {
      if (hit !== 0 && Math.abs(b.vx) > 0.3) {
        b.stuckT++;
        if (b.stuckT > 10) { b.vy = -9.6; b.stuckT = 0; }
      } else b.stuckT = 0;
    }
    if (g.arena) {
      var lo = g.arena.x + 6, hi = g.arena.x + g.arena.w - 6;
      if (b.x < lo) { b.x = lo; b.facing = 1; }
      if (b.x + b.w > hi) { b.x = hi - b.w; b.facing = -1; }
    }
  }

  /** Steht er oben auf einem Regal? */
  function alexOben(b) {
    return (b.y + b.h) < (b.floorRow * T - 8);
  }

  BossAlex.prototype.onTransform = function (g, still) {
    this.rage = true;
    // Ultrapenner: groesser und breiter (nur einmal)
    if (this.h < 80) {
      var footY = this.y + this.h, mid = this.cx();
      this.w = 30; this.h = 80; this.stompY = 40;
      this.y = footY - this.h;
      this.x = mid - this.w / 2;
    }
    // Der Kern ab der ersten Verwandlung: Yusuf bekommt den Rest der
    // Flasche ab — und sieht doppelt. Im letzten Herz noch mehr.
    g.drunk = this.leben <= 1 ? 2 : 1;
    if (still) return;
    g.drunkT = 0;
    var p = g.player;
    g.floats.add(p.cx(), p.y - 30, this.leben <= 1 ? 'NOCH EINE RUNDE. PROST.' : 'PROST.', '#ff8a2a', 90);
    g.particles.burst(p.cx(), p.y + 6, 40,
      { col: '#bfe6ff', spread: 3.4, up: 1.2, life: 50 });
    global.Sound.play('growl');
  };

  BossAlex.prototype.yusufGetroffen = function (g) {
    var l = ['PLATIN! DAS WAR EINE TROPHÄE!', 'PROST AUF DICH, YUSUF.', 'HAST DU DAS GESEHEN? ICH NICHT.'];
    spott(this, g, l[(Math.random() * l.length) | 0], '#ffd257', 56);
  };

  /** Rennt er gerade durch eine Pfuetze? Dann liegt er. */
  BossAlex.prototype.rutscht = function (g) {
    if (this.rutschPause > 0 || !this.grounded || Math.abs(this.vx) < 1.1) return false;
    var fuss = { x: this.x + 4, y: this.y + this.h - 6, w: this.w - 8, h: 8 };
    for (var i = 0; i < g.projectiles.length; i++) {
      var q = g.projectiles[i];
      if (!q || q.dead || q.t !== 'pfuetze' || (q.alter || 0) < 15) continue;
      if (!overlap(fuss, q)) continue;
      q.dead = true;
      this.rutschPause = 200;
      this.vx = this.facing * 3; this.vy = -4;
      global.Sound.play('move');
      this.aufstehText = 'WER HAT HIER... OH. ICH.';
      betaeuben(this, g, this.phase >= 3 ? 105 : 125, 'AUSGERUTSCHT! IN DER EIGENEN PFÜTZE!', '#bfe6ff');
      return true;
    }
    return false;
  };

  BossAlex.prototype.update = function (g) {
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.sip > 0) this.sip--;
    if (this.spottPause > 0) this.spottPause--;
    if (this.rutschPause > 0) this.rutschPause--;
    if (this.dead) { bossDeath(this, g, '#ff8a2a'); return; }
    // Pfuetzen altern (frisch gekotzt rutscht man noch nicht)
    for (var pi = 0; pi < g.projectiles.length; pi++) {
      var pq = g.projectiles[pi];
      if (pq && pq.t === 'pfuetze') pq.alter = (pq.alter || 0) + 1;
    }

    var p = g.player;
    var dx = p.cx() - this.cx();
    var spd = this.rage ? (this.phase >= 3 ? 1.6 : 1.3) : 1;
    var i;
    this.timer--;
    rageSparks(this, g);

    switch (this.state) {
      case 'transform':
        if (tickTransform(this, g, 'ULTRAPENNER!', this.rageCol)) {
          this.go('idle', 12);
          this.phase = herzPhase(this);
          g.onAlexPhase(this.phase);
        }
        break;

      case 'idle':
        this.vx *= 0.84;
        this.facing = dx > 0 ? 1 : -1;
        if (komboWeiter(this, g)) break;
        // Sein Ruhezustand: nochmal kurz ansetzen.
        if (this.timer === 14 && Math.random() < 0.5) { this.sip = 28; global.Sound.play('select'); }
        if (this.timer <= 0) this.pick(g);
        break;

      case 'betaeubt':
        tickBetaeubt(this, g);
        break;

      case 'spott':
        this.vx *= 0.8;
        this.sip = 10;
        if (this.timer <= 0) this.go('idle', 10);
        break;

      case 'walk':
        klugLaufen(this, g, 1.5 * spd);
        if (this.rutscht(g)) break;
        if (this.timer <= 0) this.go('idle', this.rage ? 12 : 22);
        break;

      // Wodkaflaschen im Bogen. Beim Aufschlag bleibt eine Pfuetze.
      case 'wodka':
        this.vx *= 0.8;
        if (this.timer === 18 || (this.rage && this.timer === 6)) {
          var n = this.rage ? 3 : 2;
          for (i = 0; i < n; i++) {
            g.addProjectile('wodka', this.cx() - 3, this.y + 14,
                            this.facing * (2.0 + i * 0.7) * spd, -4.2 - i * 0.4);
          }
          global.Sound.play('shoot');
          if (this.timer === 18) sagt(this, g, 'DIE WAR NOCH HALB VOLL!', '#bfe6ff', 60, 14);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 30);
        break;

      // Was rein geht, kommt auch wieder raus.
      case 'kotze':
        this.vx *= 0.85;
        if (this.timer === 20 || this.timer === 8) {
          g.addProjectile('kotze', this.cx() - 5, this.y + 20,
                          this.facing * 2.4, -2.6);
          global.Sound.play('hurt');
        }
        if (this.timer === 20) sagt(this, g, 'MIR IST SCHLECHT.', '#8fd85a', 60, 14);
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 32);
        break;

      // 47 PLATIN: die Fontaene. Kotze im hohen Bogen, nach beiden Seiten.
      case 'kotzfontaene':
        this.vx *= 0.8;
        if (this.timer === 56) sagt(this, g, 'OH NEIN. OH NEIN NEIN NEIN.', '#8fd85a', 50);
        if (this.timer < 46 && this.timer > 20 && this.timer % 6 === 0) {
          var k = (46 - this.timer) / 6, seite = k % 2 ? -1 : 1;
          g.addProjectile('kotze', this.cx() - 5, this.y + 18,
                          seite * (1.2 + (k >> 1) * 0.9) * spd, -6.4 + (k >> 1) * 0.3);
          global.Sound.play('hurt');
          g.particles.burst(this.cx(), this.y + 20, 4, { col: '#8fd85a', spread: 1.6, up: 1.2, life: 18 });
        }
        if (this.timer <= 0) this.go('idle', 14);
        break;

      // 47 PLATIN: Bierflaschen, gezielt auf Yusuf. Drei hintereinander.
      case 'flaschenhagel':
        this.vx *= 0.8;
        if (this.timer === 40) sagt(this, g, 'FANG! DIE IST FÜR DICH!', '#e8b830', 50);
        if (this.timer === 34 || this.timer === 24 || this.timer === 14) {
          var ziel = p.cx() + p.vx * 22 - this.cx();
          var flug = Math.max(24, Math.min(60, Math.abs(ziel) / 3.6));
          g.addProjectile('bierflasche', this.cx() - 3, this.y + 12,
                          ziel / flug, -0.5 * 0.24 * flug - (this.y + 12 - (p.y + p.h / 2)) / flug);
          global.Sound.play('shoot');
        }
        if (this.timer <= 0) this.go('idle', 14);
        break;

      // 47 PLATIN: der Torkelsturm. Zickzack durch den Laden, zweimal hin
      // und her. Pfuetzen auf dem Weg sind sein Ende.
      case 'torkelsturm':
        this.vx = this.facing * 4.6 * spd + Math.sin(this.t0 * 0.35) * 1.2;
        if (this.t0 % 3 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * 10, y: this.y + this.h - 2, vx: -this.facing, vy: -0.3,
                              life: 14, col: '#c8a878', size: 2, grav: 0 });
        }
        if (anWand(this, g, this.vx)) {
          this.facing = -this.facing;
          this.wendungen = (this.wendungen || 0) + 1;
          g.shake(4, 8);
          global.Sound.play('stomp');
          if (this.wendungen >= 2) { this.wendungen = 0; this.go('idle', 26); break; }
        }
        if (this.rutscht(g)) break;
        if (this.timer <= 0) { this.wendungen = 0; this.go('idle', 20); }
        break;

      // Er klettert aufs Regal und trinkt dort in Ruhe weiter.
      case 'bierjump':
        if (this.timer === 34) {
          this.vy = -11.2;
          this.vx = (dx > 0 ? 1 : -1) * 2.2 * spd;
          global.Sound.play('jump');
        }
        if (this.timer < 28 && this.grounded) {
          if (alexOben(this)) this.go('trinken', 80);
          else this.go('idle', 20);
        }
        if (this.timer <= 0 && this.grounded) this.go('idle', 20);
        break;

      case 'trinken':
        this.vx *= 0.7;
        this.sip = 30;
        if (this.timer === 60) sagt(this, g, 'EINS GEHT NOCH.', '#ffd257', 70, 16);
        if (this.timer === 44 || this.timer === 24 || (this.phase >= 3 && this.timer === 34)) {
          g.addProjectile(this.phase >= 3 ? 'bierflasche' : 'bier', this.cx() - 3, this.y + 18,
                          (dx > 0 ? 1 : -1) * 2.6, -1.2);
          global.Sound.play('shoot');
        }
        if (this.timer <= 0) this.go('runter', 40);
        break;

      // Und dann kommt er von oben runter.
      case 'runter':
        if (this.timer === 34) {
          this.vy = -5.5;
          this.vx = (dx > 0 ? 1 : -1) * 3.0 * spd;
          this.landed = false;
          global.Sound.play('bossRoar');
        }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 30) {
          this.landed = true;
          groundWaves(this, g, '#ff8a2a', 3.2, this.rage ? 2 : 1);
          this.go('idle', this.rage ? 16 : 28);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 22);
        break;

      case 'dashprep':
        this.vx *= 0.7;
        if (this.timer <= 0) {
          this.go('dash', 30);
          global.Sound.play('bossRoar');
          g.shake(3, 8);
        }
        break;

      case 'dash':
        // Torkeln: er laeuft nicht gerade. (Der Sprint bleibt so schnell wie
        // frueher — schneller ist er im letzten Herz bei allem anderen.)
        this.vx = this.facing * 3.8 * Math.min(spd, 1.4) + Math.sin(this.t0 * 0.3) * 0.8;
        if (this.rutscht(g)) break;
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 34);
        break;

      // Der Vortrag ueber Platin-Trophaeen. Sehr schnell, sehr laut.
      case 'stotter':
        this.vx *= 0.8;
        if (this.timer % 14 === 0) {
          var rl = global.Levels.alexLines;
          g.floats.add(this.cx() + (Math.random() - 0.5) * 40, this.y - 10 - (this.timer % 40),
                       rl[(Math.random() * rl.length) | 0], '#ffd257', 55);
          global.Sound.play('move');
        }
        if (this.timer % 20 === 10) {
          g.addProjectile('wodka', this.cx() - 3, this.y + 14,
                          this.facing * 2.6, -3.6);
        }
        if (this.timer <= 0) this.go('idle', 20);
        break;

      // ULTRAPENNER: Dosen vom Himmel.
      case 'bierregen':
        this.vx *= 0.8;
        if (this.timer === 70) sagt(this, g, 'RUNDE FÜR ALLE!', '#ff8a2a', 70, 16);
        if (this.timer % (this.phase >= 3 ? 10 : 12) === 0) rainFromSky(g, 'bier', 1.4);
        if (this.timer <= 0) this.go('idle', 18);
        break;
    }

    alexMove(this, g);

    this.animT++;
    if (this.animT > (this.state === 'dash' || this.state === 'torkelsturm' ? 3 : 7)) { this.animT = 0; this.anim++; }

    this.updateSchatten(g);

    this.open = !ALEX_ZU[this.state];
    bossContact(this, g);
  };

  /** Solange Yusuf besoffen ist, steht da ein zweiter Alex: sein Schatten,
      gespiegelt an der Mitte der Arena. Der tut nichts — und man kann ihn
      auch nicht treffen. Man muss erst rausfinden, welcher der echte ist. */
  BossAlex.prototype.updateSchatten = function (g) {
    if (!g.drunk || this.dead) { this.schatten = null; return; }
    // Er steht mal links, mal rechts von ihm — wie beim Doppeltsehen
    var seite = Math.sin(this.t0 * 0.011) > 0 ? 1 : -1;
    var tx = this.x + seite * 84;
    if (g.arena) {
      tx = Math.max(g.arena.x + 8, Math.min(g.arena.x + g.arena.w - this.w - 8, tx));
    }
    if (!this.schatten) this.schatten = { x: tx, y: this.y, hint: 0 };
    var s = this.schatten;
    s.x += (tx - s.x) * 0.08;
    s.y += (this.y - s.y) * 0.2;
    s.f = -this.facing;
    if (s.hint > 0) s.hint--;
    // Wer hindurchspringt, merkt es
    var p = g.player;
    if (!p.dead && s.hint <= 0 &&
        overlap({ x: s.x, y: s.y, w: this.w, h: this.h }, p)) {
      s.hint = 150;
      g.floats.add(s.x + this.w / 2, s.y - 16, 'NUR EIN SCHATTEN.', '#8ab4ff', 60);
    }
  };

  BossAlex.prototype.pick = function (g) {
    // Einmal pro Kampf haelt er seinen Vortrag.
    if (!this.ranted && this.hp <= this.maxHp - 3) {
      this.ranted = true;
      this.go('stotter', 84);
      return;
    }
    var R = this.rage, P3 = this.phase >= 3;
    var pfuetzen = 0;
    for (var i = 0; i < g.projectiles.length; i++) {
      var q = g.projectiles[i];
      if (q && !q.dead && q.t === 'pfuetze') pfuetzen++;
    }
    var w = waehle(this, g, [
      { s: 'wodka', t: R ? 32 : 38, w: function (l) { return l.nah ? 1 : 1.9; } },
      { s: 'kotze', t: R ? 34 : 40, w: function (l) { return l.nah ? 1.8 : 1; } },
      { s: 'bierjump', t: 44, w: function (l) { return l.weit ? 2 : 1.2; } },
      { s: 'dashprep', t: P3 ? 22 : (R ? 24 : 26), w: function (l) { return (l.mittel || l.weit ? 1.6 : 0.7) + pfuetzen * 0.5; } },
      { s: 'walk', t: 40, w: function (l) { return (l.weit ? 1 : 0.3) + pfuetzen * 0.4; } },
      R ? { s: 'bierregen', t: 70, w: function (l) { return l.oben ? 1.8 : 0.8; } } : null,
      P3 ? { s: 'kotzfontaene', t: 60, w: function (l) { return l.nah || l.mittel ? 2.6 : 1.4; } } : null,
      P3 ? { s: 'flaschenhagel', t: 44, w: function (l) { return l.weit ? 3 : 2; } } : null,
      P3 ? { s: 'torkelsturm', t: 150, w: function () { return 1 + pfuetzen * 0.5; } } : null
    ]);
    // 47 PLATIN: erst kotzen, dann losrennen — durch die eigene Pfuetze?
    if (P3 && w && w.s === 'kotze' && Math.random() < 0.35) kombo(this, [['dashprep', 18]]);
  };

  BossAlex.prototype.hit = function (g, dmg, p) {
    if (this.invuln > 0 || this.dead || this.state === 'transform') return;
    var warOben = this.state === 'trinken';
    this.hp -= dmg;
    bossBounce(this, g, p, '#ff8a2a', dmg);
    if (herzWeg(this, g)) return;
    if (this.hp <= 0) {
      this.dead = true; this.deadTimer = 0; this.vy = -7;
      g.shake(10, 42);
      global.Sound.play('bossRoar');
      g.onAlexDead();
      return;
    }
    // Beim Trinken auf dem Regal erwischt: er faellt runter
    if (warOben) {
      this.faellt = 50;
      this.aufstehText = 'ICH BIN NICHT GEFALLEN. ICH BIN GESPRUNGEN.';
      betaeuben(this, g, 100, 'VOM REGAL GEFALLEN! DAS BIER AUCH!', '#ffd257');
    }
  };

  /* ================= BROKE — Level 11, vor Yusufs Haus =================
     Ein Kollege, kein Feind: der Kampf ist nur ein Test. Broke ist sehr
     schnell (Sprint mit Nachbildern, Blitzwechsel hinter Yusuf) und laesst
     die ganze Zeit Mikas nachruecken — seine kleinen Kollegen, die alle
     gleich aussehen. Ab der Haelfte kommt die ganze Mika-Armee: ganze
     Reihen von Mikas rennen quer ueber den Gehweg.
     Seit 02.10. sein Trick (Mario): der MIKA-TURM. Drei Mikas stellen sich
     aufeinander, Broke steht oben und wirft Mahnungen (er ist pleite).
     Wer den Turm unten anrempelt, bringt ihn zum Einsturz — Broke faellt
     und bleibt benommen liegen.
     ================================================================= */

  var TURM_H = 48;            // drei Mikas uebereinander

  function liveMikas(g) {
    var n = 0;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (e && e.t === 'mika' && !e.dead && !e.stampede) n++;
    }
    return n;
  }

  function BossBroke(tx, ty) {
    this.w = 18; this.h = 58;
    this.x = tx * T; this.y = ty * T - this.h;
    this.floorRow = ty;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = 14; this.maxHp = 14;
    this.phase = 1;
    this.rage = false;
    this.t0 = 0; this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.timer = 50;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deadTimer = 0;
    this.grounded = false;
    this.open = true;
    this.stompY = 32;
    this.landed = true;
    this.trail = [];            // Nachbilder, wenn er rennt
    this.mikaT = 150;           // bis der naechste Mika von allein nachrueckt
    this.target = 0;
    this.turmH = 0;             // wie hoch der Mika-Turm gerade ist
    this.spottPause = 0;
    this.rageName = 'MIKA-ARMEE';
    this.rageCol = '#ffb43c';
    dreiHerzen(this, { name: 'MIKAS, VOLLGAS', col: '#ff6a3c', ruf: 'VOLLGAS!' });
    this.barName = 'BROKE';
    this.barCol = '#c49a64';
  }

  BossBroke.prototype.cx = function () { return this.x + this.w / 2; };
  BossBroke.prototype.go = function (s, t) { this.state = s; this.timer = t; };

  BossBroke.prototype.onTransform = function () {
    this.rage = true;
    this.mikaT = 40;
    this.turmH = 0;
  };

  BossBroke.prototype.yusufGetroffen = function (g) {
    if (this.state === 'turm' || this.state === 'turmbau') return;
    spott(this, g, 'ZU LANGSAM, YUSUF. ICH WARTE SEIT ZWEI STUNDEN.', '#c8c0d8', 52);
  };

  /** Ein Mika erscheint. Beim Ansturm rennt er stur geradeaus. */
  BossBroke.prototype.spawnMika = function (g, x, dir, stampede) {
    var e = new Enemy('mika', 0, 0);
    e.x = x - e.w / 2;
    e.y = this.floorRow * T - e.h - 1;
    e.facing = dir;
    e.vx = dir * (stampede ? 2.7 : 1.2);
    e.vy = stampede ? 0 : -4;
    e.stampede = !!stampede;
    g.enemies.push(e);
    return e;
  };

  /** Mikas rufen — hoechstens drei (in der Mika-Armee vier) gleichzeitig.
      Mit vier/fuenf kamen die Mikas fuer die meisten Treffer auf. */
  BossBroke.prototype.callMikas = function (g, n) {
    var room = (this.rage ? 4 : 3) - liveMikas(g);
    n = Math.min(n, room);
    for (var i = 0; i < n; i++) {
      this.spawnMika(g, this.cx() - this.facing * (8 + i * 12), this.facing, false);
    }
    if (n > 0) {
      global.Sound.play('power');
      var ml = global.Levels.mikaLines;
      if (ml) g.floats.add(this.cx() - this.facing * 14, this.y + 20,
                           ml[(Math.random() * ml.length) | 0], '#9ad0ff', 55);
    }
    return n;
  };

  /** Der Turm: wo stehen die Mikas gerade? */
  BossBroke.prototype.turm = function () {
    return { x: this.cx() - 8, y: this.floorRow * T - this.turmH, w: 16, h: this.turmH };
  };

  /** Yusuf hat den Turm angerempelt: alles faellt. */
  BossBroke.prototype.einsturz = function (g) {
    var t = this.turm();
    for (var k = 0; k < 3; k++) {
      g.particles.burst(t.x + 8, t.y + t.h - 8 - k * 16, 8, { col: '#9ad0ff', spread: 3, up: 1.6, life: 30 });
    }
    g.floats.add(t.x + 8, t.y + t.h - 30, 'MIKAS! ALLE WEG!', '#9ad0ff', 60);
    global.Sound.play('brk');
    this.turmH = 0;
    this.vy = -2; this.vx = 0;
    this.aufstehText = 'DAS WAR EIN TEST. FÜR DIE MIKAS.';
    betaeuben(this, g, this.phase >= 3 ? 110 : 130, 'DER MIKA-TURM FÄLLT!', '#ffb43c');
  };

  BossBroke.prototype.update = function (g) {
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.spottPause > 0) this.spottPause--;
    if (this.dead) { this.trail.length = 0; this.turmH = 0; bossDeath(this, g, '#c49a64'); return; }

    var p = g.player;
    var dx = p.cx() - this.cx();
    var spd = this.rage ? (this.phase >= 3 ? 1.35 : 1.2) : 1;
    var i;
    this.timer--;
    rageSparks(this, g);

    // Nachbilder: alles, was schnell ist, zieht einen Schweif hinter sich her
    var fast = (this.state === 'dash' || this.state === 'blitz' || Math.abs(this.vx) > 3.2);
    if (this.t0 % 2 === 0) {
      if (fast) this.trail.push({ x: this.cx(), y: this.y + this.h, f: this.facing, a: this.anim });
      if (this.trail.length > 6 || (!fast && this.trail.length)) this.trail.shift();
    }

    // Er ruft die ganze Zeit Mikas nach — auch ohne eigenen Angriff
    if (this.state === 'idle' || this.state === 'walk') {
      if (--this.mikaT <= 0) {
        this.mikaT = this.rage ? 140 : 180;
        this.callMikas(g, 1);
      }
    }

    switch (this.state) {
      case 'transform':
        if (this.timer === 88) {
          sagt(this, g, this.leben > 1 ? 'OKAY. JETZT ALLE.' : 'NOCH SCHNELLER. ALLE.', '#ffd257', 80, 14);
        }
        if (tickTransform(this, g, 'MIKA-ARMEE!', this.rageCol)) {
          this.go('idle', 12);
          this.phase = herzPhase(this);
          g.onBrokePhase(this.phase);
        }
        break;

      case 'idle':
        this.vx *= 0.8;
        this.facing = dx > 0 ? 1 : -1;
        if (komboWeiter(this, g)) break;
        if (this.timer <= 0) this.pick(g);
        break;

      case 'betaeubt':
        tickBetaeubt(this, g);
        break;

      case 'spott':
        this.vx *= 0.8;
        if (this.timer <= 0) this.go('idle', 10);
        break;

      // Er geht nicht. Er joggt. Schnell.
      case 'walk':
        klugLaufen(this, g, 2.4 * spd);
        if (this.timer <= 0) this.go('idle', this.rage ? 10 : 18);
        break;

      case 'mikas':
        this.vx *= 0.8;
        if (this.timer === 22) {
          if (!this.callMikas(g, this.rage ? 3 : 2)) sagt(this, g, 'ALLE MIKAS SIND SCHON DA.', '#c8c0d8', 50, 14);
          else sagt(this, g, 'MIKAS!', '#ffd257', 45, 14);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 28);
        break;

      // Der Mika-Turm: drei Mikas stellen sich unter ihn ...
      case 'turmbau':
        this.vx = 0;
        if (this.timer === 34) sagt(this, g, 'MIKAS! TURM!', '#9ad0ff', 50);
        if (this.timer % 11 === 0 && this.turmH < TURM_H) {
          this.turmH = Math.min(TURM_H, this.turmH + 16);
          global.Sound.play('jump');
          g.particles.burst(this.cx(), this.floorRow * T - this.turmH + 8, 6, { col: '#9ad0ff', spread: 1.6, up: 0.8, life: 18 });
        }
        if (this.timer <= 0) {
          this.turmH = TURM_H;
          this.go('turm', this.phase >= 3 ? 200 : 240);
          sagt(this, g, 'VON HIER OBEN SIEHT MAN DIE MAHNUNGEN BESSER.', '#c49a64', 80);
        }
        break;

      // ... und von oben wirft er Mahnungen. Er ist pleite.
      case 'turm':
        this.vx = 0;
        this.facing = dx > 0 ? 1 : -1;
        if (this.timer % (this.phase >= 3 ? 24 : 32) === 0 && this.timer > 10) {
          var ziel = p.cx() + p.vx * 18 - this.cx(), flug = 38;
          g.addProjectile('mahnung', this.cx() - 5, this.y + 14,
                          ziel / flug, -0.5 * 0.2 * flug + ((p.y + p.h / 2) - (this.y + 14)) / flug);
          global.Sound.play('shoot');
          if (Math.random() < 0.3) sagt(this, g, ['MAHNUNG!', 'LETZTE MAHNUNG!', 'INKASSO!'][(Math.random() * 3) | 0], '#f4f4ee', 36);
        }
        if (this.timer <= 0) {
          // Keiner hat ihn runtergeholt: er springt selbst
          this.turmH = 0;
          g.floats.add(this.cx(), this.floorRow * T - 30, 'MIKAS, PAUSE!', '#9ad0ff', 40);
          this.go('sprung', 46);
        }
        break;

      case 'dashprep':
        this.vx *= 0.7;
        if (this.timer <= 0) {
          this.go('dash', 26);
          global.Sound.play('bossRoar');
          g.shake(3, 8);
        }
        break;

      case 'dash':
        this.vx = this.facing * 6.4 * spd;
        if (this.t0 % 2 === 0) {
          g.particles.spawn({
            x: this.cx() - this.facing * 8, y: this.y + this.h - 2,
            vx: -this.facing * 1.2, vy: -0.4, life: 16, col: '#d8d4cc', size: 2, grav: -0.01
          });
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 30);
        break;

      // Blitzwechsel: er zischt an Yusuf vorbei und steht ploetzlich hinter ihm.
      // Danach muss er kurz verschnaufen — das ist die Gelegenheit.
      case 'blitzprep':
        this.vx *= 0.6;
        if (this.timer <= 0) {
          var lo = g.arena ? g.arena.x + 30 : 30;
          var hi = g.arena ? g.arena.x + g.arena.w - 30 : this.cx() + 200;
          this.facing = dx > 0 ? 1 : -1;
          this.target = Math.max(lo, Math.min(hi, p.cx() + this.facing * 110));
          this.go('blitz', 40);
          global.Sound.play('shoot');
        }
        break;

      case 'blitz':
        var d = this.target - this.cx();
        this.vx = Math.max(-9, Math.min(9, d * 0.5));
        if (Math.abs(d) < 6 || this.timer <= 0) {
          this.vx = 0;
          this.facing = dx > 0 ? 1 : -1;
          this.go('idle', this.rage ? 24 : 36);
          if (!this.kombo || !this.kombo.length) sagt(this, g, 'ZU LANGSAM, YUSUF.', '#c8c0d8', 50, 14);
        }
        break;

      // Hoch, rueber, und der Gehweg bebt
      case 'sprung':
        if (this.timer === 46) {
          this.vy = -10.4;
          this.vx = (dx > 0 ? 1 : -1) * 2.8 * spd;
          this.landed = false;
          global.Sound.play('jump');
        }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 42) {
          this.landed = true;
          groundWaves(this, g, '#c49a64', 3.6, this.rage ? 2 : 1);
          this.go('idle', this.phase >= 3 ? 12 : 20);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 20);
        break;

      // MIKA-ARMEE: eine ganze Reihe Mikas rennt quer ueber den Gehweg
      case 'ansturm':
        this.vx *= 0.8;
        if (this.timer === 62) {
          sagt(this, g, 'MIKAS! ANSTURM!', '#ffb43c', 70, 16);
          global.Sound.play('bossRoar');
          // Sie kommen von der Seite, auf der Yusuf gerade NICHT steht
          var mid = g.arena ? g.arena.x + g.arena.w / 2 : this.cx();
          this.stampDir = (p.cx() > mid) ? 1 : -1;
        }
        var nStamp = this.phase >= 3 ? 6 : 5;
        var since = 60 - this.timer;
        if (since >= 0 && since % 9 === 0 && since / 9 < nStamp) {
          var ax0 = g.arena ? (this.stampDir > 0 ? g.arena.x + 10 : g.arena.x + g.arena.w - 10)
                            : this.cx();
          this.spawnMika(g, ax0, this.stampDir, true);
        }
        if (this.timer <= 0) this.go('idle', 18);
        break;
    }

    if (this.state === 'turm' || this.state === 'turmbau') {
      // Oben auf dem Turm: er steht auf den Mikas, nicht auf dem Boden
      this.y = this.floorRow * T - this.turmH - this.h;
      this.vy = 0; this.vx = 0; this.grounded = true;
      // Wer den Turm anrempelt oder draufspringt, bringt ihn zum Einsturz
      if (this.turmH >= 16 && !p.dead && overlap(p, this.turm())) this.einsturz(g);
    } else {
      if (this.turmH > 0 && this.state !== 'betaeubt') this.turmH = 0;
      bossMove(this, g);
    }

    this.animT++;
    if (this.animT > (fast ? 2 : 6)) { this.animT = 0; this.anim++; }

    this.open = !(this.state === 'dash' || this.state === 'blitz');
    bossContact(this, g);
  };

  BossBroke.prototype.pick = function (g) {
    var R = this.rage, P3 = this.phase >= 3, self = this;
    var w = waehle(this, g, [
      { s: 'mikas', t: R ? 34 : 40, w: function () { return liveMikas(g) >= (R ? 4 : 3) ? 0.2 : 2; } },
      { s: 'dashprep', t: P3 ? 14 : (R ? 16 : 22), w: function (l) { return l.mittel || l.weit ? 3 : 1; } },
      { s: 'blitzprep', t: P3 ? 14 : (R ? 16 : 20), w: function (l) { return l.nah ? 2.6 : 1.6; } },
      { s: 'sprung', t: 50, w: function (l) { return l.oben || l.ueber ? 4 : 1.4; } },
      { s: 'walk', t: 36, w: function (l) { return l.weit && !R ? 1 : 0.2; } },
      { s: 'turmbau', t: 36, w: function (l) { return self.letzterTurm > 0 ? 0 : (l.weit || l.mittel ? 2.2 : 1.2); },
        dann: function (b) { b.letzterTurm = 3; } },
      R ? { s: 'ansturm', t: 70, w: 2 } : null
    ]);
    if (this.letzterTurm > 0 && w && w.s !== 'turmbau') this.letzterTurm--;
    // Im letzten Herz: Blitzwechsel und sofort zurueck gesprintet
    if (P3 && w && w.s === 'blitzprep' && Math.random() < 0.6) kombo(this, [['dashprep', 10]]);
  };

  BossBroke.prototype.hit = function (g, dmg, p) {
    if (this.invuln > 0 || this.dead || this.state === 'transform') return;
    var warOben = this.state === 'turm' || this.state === 'turmbau';
    this.hp -= dmg;
    bossBounce(this, g, p, '#c49a64', dmg);
    if (herzWeg(this, g)) { this.turmH = 0; return; }
    if (this.hp <= 0) {
      this.turmH = 0;
      this.dead = true; this.deadTimer = 0; this.vy = -7;
      g.shake(10, 42);
      global.Sound.play('bossRoar');
      g.onBrokeDead();
      return;
    }
    // Oben auf dem Turm getroffen: der Turm wackelt — und faellt
    if (warOben) this.einsturz(g);
  };

  /* ================= HAMZA — Level 13, im Shawarma-Laden =================
     Libanesischer Freund. Wirft Hummus (klebt am Boden fest), schickt
     HHC-Wellen durch den Laden (danach dreht sich alles) und schiesst
     mit dem Fussball. Ab der Haelfte: Yalla-Modus mit Fallrueckzieher
     und Hummus-Regen.
     ================================================================= */

  function BossHamza(tx, ty) {
    this.w = 20; this.h = 58;
    this.x = tx * T; this.y = ty * T - this.h;
    this.floorRow = ty;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = 15; this.maxHp = 15;
    this.phase = 1;
    this.rage = false;
    this.t0 = 0; this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.timer = 60;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deadTimer = 0;
    this.grounded = false;
    this.open = true;
    this.stompY = 32;
    this.landed = true;
    this.shot = false;
    this.ballAtFeet = true;       // den Ball hat er immer dabei
    this.rageName = '2. HALBZEIT';
    this.rageCol = '#4ad86a';
    this.barName = 'HAMZA';
    this.barCol = '#d8282e';
    this.hp = 10; this.maxHp = 10;
    // erste Halbzeit, zweite Halbzeit, Verlaengerung
    dreiHerzen(this, { name: 'VERLÄNGERUNG', col: '#ffd257', ruf: 'VERLÄNGERUNG!' });
    this.bodenRow = ty;
    this.shotFloor = ty;           // seine Wuerfe fliegen durch die Empore
    this.oben = false;             // steht er gerade auf der Empore?
    this.sprungT = 0;
    this.spottPause = 0;
  }

  BossHamza.prototype.cx = function () { return this.x + this.w / 2; };
  BossHamza.prototype.go = function (s, t) { this.state = s; this.timer = t; };
  BossHamza.prototype.onTransform = function () { this.rage = true; };

  /** Sein Ball kam zurueck und hat ihn getroffen (Mario-Trick). */
  BossHamza.prototype.eigentor = function (g) {
    if (this.dead || this.state === 'transform' || this.state === 'hoch' || this.state === 'betaeubt') return;
    if (this.oben) {
      // Von der Empore gefallen
      this.oben = false;
      this.floorRow = this.bodenRow; this.bw = null;
      this.bodenT = 360;
    }
    this.ballAtFeet = false;
    this.nach = 'idle';
    this.aufstehText = 'DAS WAR ABSEITS. GANZ KLAR ABSEITS.';
    betaeuben(this, g, this.phase >= 3 ? 110 : 130, 'EIGENTOR!!!', '#ffffff');
  };

  BossHamza.prototype.yusufGetroffen = function (g) {
    if (this.oben) return;
    spott(this, g, 'TOOOR! WIE IN BEIRUT!', '#4ad86a', 56);
  };
  BossHamza.prototype.naechstesLeben = function (g, still) {
    naechstesLeben(this, g, still);
    if (still && g.lvl.empore) this.aufEmpore(g, true);
  };

  /** Rauf auf die Empore (sofort oder mit Sprung) — und wieder runter. */
  BossHamza.prototype.aufEmpore = function (g, sofort) {
    var e = g.lvl.empore;
    if (sofort) {
      this.oben = true;
      this.floorRow = e.y; this.bw = null;
      this.x = (e.x0 + e.x1) / 2 * T; this.y = e.y * T - this.h; this.vy = 0;
      return;
    }
    this.go('hoch', 48);
    this.sprung = { x0: this.x, y0: this.y, x1: (e.x0 + 2 + Math.random() * (e.x1 - e.x0 - 4)) * T, y1: e.y * T - this.h };
  };
  BossHamza.prototype.runter = function (g) {
    this.oben = false;
    this.floorRow = this.bodenRow; this.bw = null;
    this.vy = -4;
    this.bodenT = 360;
    this.go('boden', 20);
    g.floats.add(this.cx(), this.y - 14, 'YALLA, RUNTER!', '#4ad86a', 50);
  };

  BossHamza.prototype.kickBall = function (g, vx, vy) {
    g.addProjectile('ball', this.cx() + this.facing * 10 - 5, this.y + this.h - 12, vx, vy);
    global.Sound.play('shoot');
    this.ballAtFeet = false;
  };

  BossHamza.prototype.update = function (g) {
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.dead) { bossDeath(this, g, '#d8282e'); return; }

    var p = g.player;
    var dx = p.cx() - this.cx();
    var spd = this.rage ? (this.phase >= 3 ? 1.35 : 1.2) : 1;
    var i;
    this.timer--;
    rageSparks(this, g);

    if (this.spottPause > 0) this.spottPause--;
    switch (this.state) {
      case 'betaeubt':
        tickBetaeubt(this, g);
        break;

      case 'spott':
        this.vx *= 0.8;
        if (this.timer <= 0) this.go('idle', 10);
        break;

      case 'transform':
        if (this.timer === 88) g.floats.add(this.cx(), this.y - 14, this.leben > 1 ? 'HALBZEIT! YALLA!' : 'ABPFIFF? NEIN. YALLA!', '#ffd257', 80);
        if (tickTransform(this, g, '2. HALBZEIT!', this.rageCol)) {
          this.go('idle', 12);
          this.phase = herzPhase(this);
          g.onHamzaPhase(this.phase);
          if (g.lvl.empore && !this.oben) this.aufEmpore(g, false);
        }
        break;

      // Mit einem Satz auf die Empore (die Plattformen stoeren dabei nicht)
      case 'hoch':
        var sp = this.sprung, k = 1 - this.timer / 48;
        this.x = sp.x0 + (sp.x1 - sp.x0) * k;
        this.y = sp.y0 + (sp.y1 - sp.y0) * k - Math.sin(k * Math.PI) * 60;
        this.vx = 0; this.vy = 0;
        if (this.timer <= 0) {
          this.oben = true;
          this.floorRow = g.lvl.empore.y; this.bw = null;
          this.x = sp.x1; this.y = sp.y1;
          this.go('idle', 20);
          g.shake(4, 10);
          g.floats.add(this.cx(), this.y - 14, 'ICH SPIEL OBEN. DA IST DIE LUFT BESSER.', '#4ad86a', 80);
        }
        this.anim++;
        this.open = true;
        bossContact(this, g);
        return;

      // Unten auf dem Boden, bis er wieder hochspringt
      case 'boden':
        this.vx *= 0.8;
        this.facing = dx > 0 ? 1 : -1;
        if ((this.bodenT || 0) <= 0 && g.lvl.empore) { this.aufEmpore(g, false); break; }
        if (this.timer <= 0) this.pick(g, dx, true);
        break;

      case 'idle':
        this.vx *= 0.8;
        this.facing = dx > 0 ? 1 : -1;
        this.ballAtFeet = true;
        if (komboWeiter(this, g)) break;
        if (this.timer <= 0) this.pick(g, dx);
        break;

      case 'walk':
        klugLaufen(this, g, 1.8 * spd);
        // Oben nicht von der Empore laufen
        if (this.oben && g.lvl.empore) {
          var em = g.lvl.empore;
          if ((this.facing < 0 && this.x < (em.x0 + 1) * T) || (this.facing > 0 && this.x + this.w > (em.x1) * T)) {
            this.facing = -this.facing;
          }
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 12 : 22);
        break;

      // Hummus im Bogen. Wo er landet, bleibt man kleben.
      case 'humus':
        this.vx *= 0.8;
        if (this.timer === 18 || (this.rage && this.timer === 6)) {
          var n = this.rage ? 3 : 2;
          for (i = 0; i < n; i++) {
            g.addProjectile('humus', this.cx() - 4, this.y + 14,
                            this.facing * (1.8 + i * 0.8) * spd, -4.6 - i * 0.3);
          }
          global.Sound.play('shoot');
          if (this.timer === 18) g.floats.add(this.cx(), this.y - 14, 'PROBIER MAL!', '#e8d4a0', 55);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 30);
        break;

      // HHC-Welle: zieht dicht ueber dem Boden durch. Drueberspringen.
      case 'hhc':
        this.vx *= 0.8;
        if (this.timer === 20) {
          var feet = this.y + this.h;
          var w1 = g.addProjectile('hhc', this.cx() - 15 + this.facing * 14, feet - 22,
                                   this.facing * 2.1 * spd, 0);
          if (w1) { w1.baseY = feet - 22; w1.amp = 4; }
          // Im Yalla-Modus kommt eine zweite, hoehere hinterher
          if (this.rage) {
            var w2 = g.addProjectile('hhc', this.cx() - 15 + this.facing * 14, feet - 70,
                                     this.facing * 2.5 * spd, 0);
            if (w2) { w2.baseY = feet - 70; w2.amp = 8; }
          }
          global.Sound.play('shoot');
          g.floats.add(this.cx(), this.y - 14, 'HHC-WELLE!', '#8ae07a', 60);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 18 : 30);
        break;

      // Schuss. Flach und hart, der Ball springt noch ein paar Mal.
      // Von oben schiesst er schraeg nach unten.
      case 'kick':
        this.vx *= 0.7;
        if (this.timer === 14) {
          if (this.oben) this.kickBall(g, Math.max(-5, Math.min(5, dx / 30)), 1.5);
          else this.kickBall(g, this.facing * 6.2 * spd, -2.2);
          var kl = ['SCHUSS!', 'LINKER FUSS!', 'WIE IN BEIRUT!', 'DIREKT INS ECK!'];
          g.floats.add(this.cx(), this.y - 14, kl[(Math.random() * kl.length) | 0], '#ffffff', 50);
        }
        if (this.rage && this.timer === 4) this.kickBall(g, this.facing * 4.6 * spd, -5.5);
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 28);
        break;

      case 'dribbelprep':
        this.vx *= 0.7;
        if (this.timer <= 0) {
          this.go('dribbel', 30);
          global.Sound.play('bossRoar');
          g.shake(3, 8);
        }
        break;

      // Er dribbelt einfach durch. Wer im Weg steht, wird umgelaufen.
      case 'dribbel':
        this.vx = this.facing * 4.6 * spd;
        if (this.t0 % 3 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * 8, y: this.y + this.h - 2,
                              vx: -this.facing, vy: -0.4, life: 14, col: '#c8a070', size: 2, grav: 0 });
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 30);
        break;

      // Fallrueckzieher: hoch, in der Luft schiessen, Landung mit Bodenwelle
      case 'fallrueck':
        if (this.timer === 46) {
          this.vy = -10.5;
          this.vx = (dx > 0 ? 1 : -1) * 2.2 * spd;
          this.landed = false;
          this.shot = false;
          global.Sound.play('jump');
        }
        if (!this.grounded && !this.shot && this.vy >= 0) {
          this.shot = true;
          this.facing = dx > 0 ? 1 : -1;
          this.kickBall(g, this.facing * 5.4, 4.8);
          g.floats.add(this.cx(), this.y - 14, 'FALLRÜCKZIEHER!', '#ffd257', 60);
        }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 42) {
          this.landed = true;
          groundWaves(this, g, '#4ad86a', 3.4, 1);
          this.go('idle', this.phase >= 3 ? 12 : 20);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 20);
        break;

      // Yalla-Modus: Hummus fuer alle, von oben
      case 'humusregen':
        this.vx *= 0.8;
        if (this.timer === 70) g.floats.add(this.cx(), this.y - 16, 'HUMMUS FÜR ALLE!', '#e8d4a0', 70);
        if (this.timer % 10 === 0) rainFromSky(g, 'humus', 1.5);
        if (this.timer <= 0) this.go('idle', 18);
        break;
    }

    bossMove(this, g);
    this.obenT = this.oben ? (this.obenT || 0) + 1 : 0;
    // Auf der Empore bleibt er auf der Empore
    if (this.oben && g.lvl.empore) {
      var ep = g.lvl.empore;
      this.x = Math.max(ep.x0 * T, Math.min((ep.x1 + 1) * T - this.w, this.x));
    }

    this.animT++;
    if (this.animT > (this.state === 'dribbel' ? 3 : 7)) { this.animT = 0; this.anim++; }

    // Unten auf dem Boden (zweite Halbzeit) geht es nach jedem Angriff
    // zurueck in "boden", damit er wieder hochspringt
    if (this.rage && !this.oben && this.bodenT > 0) this.bodenT--;
    if (this.state === 'idle' && this.nach === 'boden' && this.rage && !this.oben) {
      this.state = 'boden'; this.timer = 40;
    }
    this.open = !(this.state === 'dribbel');
    bossContact(this, g);
  };

  BossHamza.prototype.pick = function (g, dx, unten) {
    var R = this.rage, P3 = this.phase >= 3, w;
    var zurueck = unten ? 'boden' : 'idle';
    if (!R) {
      w = waehle(this, g, [
        { s: 'humus', t: 38, w: function (l) { return l.nah ? 1 : 2.4; } },
        { s: 'hhc', t: 40, w: function (l) { return l.mittel || l.weit ? 2.4 : 1.2; } },
        { s: 'kick', t: 30, w: function (l) { return l.mittel || l.weit ? 3 : 1.4; } },
        { s: 'dribbelprep', t: 22, w: function (l) { return l.nah ? 0.8 : 2; } },
        { s: 'walk', t: 40, w: function (l) { return l.weit ? 1.2 : 0.3; } }
      ]);
    } else if (this.oben) {
      // Zweite Halbzeit, oben: werfen, schiessen, regnen lassen — und
      // ab und zu runterspringen, damit man ihn auch unten erwischt.
      // Spaetestens nach 7 Sekunden oben kommt er runter (vorher blieb er
      // manchmal eine Minute unerreichbar).
      if ((this.obenT || 0) > 420 || Math.random() < 0.18) { this.runter(g); return; }
      w = waehle(this, g, [
        { s: 'humus', t: 32, w: 2.2 },
        { s: 'kick', t: 28, w: 2.6 },
        { s: 'hhc', t: 36, w: 1.6 },
        { s: 'humusregen', t: 74, w: function (l) { return l.oben ? 0.4 : 1.2; } },
        { s: 'walk', t: 50, w: 1 }
      ]);
    } else {
      w = waehle(this, g, [
        { s: 'kick', t: 26, w: function (l) { return l.mittel || l.weit ? 3 : 1.4; } },
        { s: 'fallrueck', t: 50, w: function (l) { return l.oben || l.ueber ? 4 : 2; } },
        { s: 'dribbelprep', t: 14, w: function (l) { return l.nah ? 1 : 2.2; } },
        { s: 'hhc', t: 32, w: 1.6 },
        { s: 'humus', t: 28, w: function (l) { return l.nah ? 0.6 : 1.6; } }
      ]);
    }
    // Verlaengerung: Doppelpass mit sich selbst, Dribbling in den Fallrueckzieher
    if (P3 && w) {
      if (w.s === 'kick' && Math.random() < 0.6) kombo(this, [['kick', 22]]);
      else if (w.s === 'dribbelprep' && !this.oben && Math.random() < 0.6) kombo(this, [['fallrueck', 48]]);
    }
    this.nach = zurueck;
  };

  BossHamza.prototype.hit = function (g, dmg, p) {
    if (this.invuln > 0 || this.dead || this.state === 'transform' || this.state === 'hoch') return;
    var warUnten = this.state === 'boden' || (this.rage && !this.oben);
    this.hp -= dmg;
    bossBounce(this, g, p, '#d8282e', dmg);
    if (warUnten && this.rage && this.state !== 'betaeubt') this.state = 'boden';
    if (this.hp > 0) return;
    if (this.leben > 1) { this.naechstesLeben(g, false); return; }
    this.dead = true; this.deadTimer = 0; this.vy = -7;
    g.shake(10, 42);
    global.Sound.play('bossRoar');
    g.onHamzaDead();
  };

  /* ================= GEORGIOS — Level 15, in der Taverne =================
     Griechischer Freund, sehr schnell. Wirft Teller (die Scherben bleiben
     liegen), tanzt Sirtaki quer durch den Raum und verteilt Oliven.
     Ab der Haelfte zieht er das Hemd aus, hat ein Sixpack, zieht Box-
     handschuhe an — und boxt. Schnelle Geraden, dazu ein Aufwaertshaken.
     ================================================================= */

  function BossGeorgios(tx, ty) {
    this.w = 20; this.h = 58;
    this.x = tx * T; this.y = ty * T - this.h;
    this.floorRow = ty;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = 8; this.maxHp = 8;
    this.lebenMax = 3; this.leben = 3; // Hemd, Spartaner, Omas Liebling
    this.phase = 1;
    this.rage = false;
    this.sparta = false;          // zweites Leben: Helm, Schild, Speer
    this.oma = false;             // drittes Leben: Oma hilft aus der Kueche
    this.t0 = 0; this.anim = 0; this.animT = 0;
    this.state = 'idle'; this.timer = 50;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deadTimer = 0;
    this.grounded = false;
    this.open = true;
    this.stompY = 32;
    this.landed = true;
    this.punchT = 0;              // Bein/Schild gerade vorn (fuers Zeichnen)
    this.rageName = 'SPARTANER';
    this.rageCol = '#e8b030';
    this.spartaSaid = false;      // "DAS IST SPARTA!" kommt nur einmal mit Antwort
    this.spottPause = 0;
    this.barName = 'GEORGIOS';
    this.barCol = '#2a5ab8';
  }

  BossGeorgios.prototype.cx = function () { return this.x + this.w / 2; };
  BossGeorgios.prototype.go = function (s, t) { this.state = s; this.timer = t; };
  BossGeorgios.prototype.onTransform = function () {
    this.rage = true; this.sparta = true;
    if (this.leben <= 1) {
      this.oma = true;
      this.rageName = 'OMAS LIEBLING';
      this.rageCol = '#f4f4ee';
    }
  };
  BossGeorgios.prototype.naechstesLeben = function (g, still) { naechstesLeben(this, g, still); };

  /* Seine Tricks (Esat, 02.10.: "jeder Boss individuell"):
       SIRTAKI   wer ihm beim Tanzen ausweicht, sieht ihn danach taumeln:
                 zu viel gedreht, ihm ist schwindelig (betaeubt).
       SCHILD    als Spartaner haelt er manchmal den Schild hoch. Drauf-
                 springen gibt nur KLONG — und er stoesst sofort zu.
       OMA       im letzten Herz wirft Oma Tzatziki — gezielt auf Yusuf.
                 Wer neben Georgios steht, laesst sie ihren Enkel treffen. */
  BossGeorgios.prototype.yusufGetroffen = function (g) {
    if (this.state === 'sirtaki') { this.sirtakiTraf = true; return; }
    spott(this, g, this.sparta ? 'SO KÄMPFT MAN IN SPARTA!' : 'OPA! SO MACHT MAN DAS IN THESSALONIKI!', '#6a9ae8', 52);
  };

  /** Ein Tritt oder Schildstoss: kurze Trefferflaeche direkt vor ihm. */
  BossGeorgios.prototype.punch = function (g, w, h, yOff, life) {
    var fx = this.facing > 0 ? this.x + this.w - 4 : this.x - w + 4;
    var f = g.addProjectile('faust', fx, this.y + yOff, 0, 0);
    if (f) { f.w = w; f.h = h; f.life = life || 6; }
    this.punchT = 5;
    global.Sound.play('stomp');
  };

  BossGeorgios.prototype.update = function (g) {
    this.t0++;
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    if (this.punchT > 0) this.punchT--;
    if (this.spottPause > 0) this.spottPause--;
    if (this.dead) { bossDeath(this, g, '#2a5ab8'); return; }

    var p = g.player;
    var dx = p.cx() - this.cx();
    var spd = this.rage ? (this.phase >= 3 ? 1.35 : 1.2) : 1;
    var i;
    this.timer--;
    rageSparks(this, g);

    switch (this.state) {
      case 'transform':
        if (this.timer === 88) g.floats.add(this.cx(), this.y - 14, this.leben <= 1 ? 'OMA? BIST DU DAS?' : 'HELM AUF.', '#ffd257', 80);
        if (tickTransform(this, g, this.leben <= 1 ? 'OMA HILFT!' : 'SPARTA!', this.rageCol)) {
          this.go('idle', 12);
          this.phase = this.lebenMax - this.leben + 1;
          g.onGeorgiosPhase(this.phase);
        }
        break;

      // Drittes Leben: Oma wirft Tzatziki aus der Kueche — auf Yusuf
      case 'tzatziki':
        this.vx *= 0.7;
        if (this.timer === 70) sagt(this, g, 'OMA! TZATZIKI!', '#f4f4ee', 70, 16);
        if (this.timer < 64 && this.timer % 9 === 0) {
          var tz = g.addProjectile('humus', p.cx() - 4 + (Math.random() - 0.5) * 36, g.cameraTopY(), 0, 1.6);
          if (tz) tz.oma = true;
        }
        // Oma trifft den Falschen
        for (i = 0; i < g.projectiles.length; i++) {
          var oq = g.projectiles[i];
          if (oq && oq.oma && !oq.dead && overlap(this, oq)) {
            oq.dead = true;
            g.particles.burst(this.cx(), this.y + 6, 12, { col: '#f4f4ee', spread: 2.4, up: 1, life: 26 });
            this.aufstehText = 'OMA... ICH BIN ES. DEIN LIEBLING.';
            betaeuben(this, g, 120, 'OMA! DAS WAR ICH!', '#f4f4ee');
            break;
          }
        }
        if (this.state === 'tzatziki' && this.timer <= 0) this.go('idle', 18);
        break;

      case 'betaeubt':
        tickBetaeubt(this, g);
        break;

      case 'spott':
        this.vx *= 0.8;
        if (this.timer <= 0) this.go('idle', 10);
        break;

      // Schild hoch. Draufspringen: KLONG.
      case 'schild':
        this.vx *= 0.7;
        this.facing = dx > 0 ? 1 : -1;
        if (this.timer === 56) sagt(this, g, 'MOLON LABE! KOMM UND HOL ES DIR!', '#e8b030', 60);
        if (this.timer <= 0) this.go('idle', 26);
        break;

      case 'idle':
        this.vx *= 0.78;
        this.facing = dx > 0 ? 1 : -1;
        if (komboWeiter(this, g)) break;
        if (this.timer <= 0) this.pick(g, dx);
        break;

      // Er geht nicht. Er flitzt.
      case 'walk':
        klugLaufen(this, g, 2.6 * spd);
        if (this.timer <= 0) this.go('idle', this.rage ? 10 : 18);
        break;

      // Teller! Flach und schnell. Wo sie landen, liegen Scherben.
      case 'teller':
        this.vx *= 0.7;
        if (this.timer === 16 || (this.rage && this.timer === 6)) {
          var nt = this.rage ? 2 : 3;
          for (i = 0; i < nt; i++) {
            g.addProjectile('teller', this.cx() - 6, this.y + 16 + i * 12,
                            this.facing * (5.2 - i * 0.6) * spd, -0.8 - i * 0.4);
          }
          global.Sound.play('shoot');
          if (this.timer === 16) g.floats.add(this.cx(), this.y - 14, 'OPA!', '#2a5ab8', 50);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 26);
        break;

      // Sirtaki: er dreht sich und tanzt quer durch den Raum
      case 'sirtaki':
        this.vx = this.facing * 3.4 * spd;
        if (anWand(this, g, this.vx)) this.facing = -this.facing;
        if (this.timer === 58) sagt(this, g, 'SIRTAKI!', '#ffffff', 60, 14);
        if (this.timer % 12 === 0) global.Sound.play('move');
        if (this.timer <= 0) {
          if (!this.sirtakiTraf) {
            this.aufstehText = 'ALLES DREHT SICH. AUCH DIE TAVERNE.';
            betaeuben(this, g, this.phase >= 3 ? 90 : 110, 'SCHWINDELIG! ZU VIEL GEDREHT!', '#ffffff');
          } else this.go('idle', this.rage ? 14 : 26);
        }
        break;

      // Oliven im Faecher
      case 'oliven':
        this.vx *= 0.8;
        if (this.timer === 14) {
          for (i = 0; i < 5; i++) {
            g.addProjectile('olive', this.cx() - 2, this.y + 12,
                            this.facing * (1.4 + i * 0.7) * spd, -5.2 + i * 0.5);
          }
          global.Sound.play('shoot');
          g.floats.add(this.cx(), this.y - 14, 'OLIVEN! VON DER OMA!', '#8a9a3a', 55);
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 16 : 28);
        break;

      case 'dashprep':
        this.vx *= 0.7;
        if (this.timer <= 0) {
          this.go('dash', 22);
          global.Sound.play('bossRoar');
          g.shake(3, 8);
        }
        break;

      case 'dash':
        this.vx = this.facing * 7 * spd;
        if (this.t0 % 2 === 0) {
          g.particles.spawn({ x: this.cx() - this.facing * 8, y: this.y + this.h - 2,
                              vx: -this.facing * 1.2, vy: -0.4, life: 14, col: '#d8c8a8', size: 2, grav: -0.01 });
        }
        if (this.timer <= 0) this.go('idle', this.rage ? 14 : 28);
        break;

      case 'sprung':
        if (this.timer === 46) {
          this.vy = -10.4;
          this.vx = (dx > 0 ? 1 : -1) * 3 * spd;
          this.landed = false;
          global.Sound.play('jump');
        }
        if (this.grounded && !this.landed && this.vy >= 0 && this.timer < 42) {
          this.landed = true;
          groundWaves(this, g, this.sparta ? '#e8b030' : '#2a5ab8', 3.8, this.rage ? 2 : 1);
          this.go('idle', this.phase >= 3 ? 12 : 20);
        }
        if (this.timer <= 0 && (this.grounded || this.timer < -90)) this.go('idle', 20);
        break;

      /* ---------- ab der Haelfte: Sparta ---------- */

      // Speer anlegen ...
      case 'speerprep':
        this.vx *= 0.6;
        this.facing = dx > 0 ? 1 : -1;
        if (this.timer <= 0) {
          this.go('speerwurf', 14);
          var hoch = [this.y + 14];
          if (this.phase >= 3) hoch.push(this.y + this.h - 12);
          for (i = 0; i < hoch.length; i++) {
            g.addProjectile('speer', this.cx() - 13, hoch[i], this.facing * 7.2 * spd, 0);
          }
          global.Sound.play('shoot');
          g.floats.add(this.cx(), this.y - 14, 'SPEER!', '#e8b030', 45);
        }
        break;

      // ... und hinterher
      case 'speerwurf':
        this.vx *= 0.7;
        if (this.timer <= 0) this.go('idle', this.phase >= 3 ? 12 : 20);
        break;

      // Phalanx: Speere fallen von oben ueber die ganze Taverne
      case 'phalanx':
        this.vx *= 0.7;
        if (this.timer === 58) g.floats.add(this.cx(), this.y - 14, 'PHALANX!', '#e8b030', 60);
        if (this.timer < 50 && this.timer % (this.phase >= 3 ? 6 : 8) === 0) {
          var vw = g.viewW ? g.viewW() : 512;
          var rx = g.cam.x + 24 + Math.random() * (vw - 48);
          var sp = g.addProjectile('speer', rx, g.cameraTopY(), 0, 3.4);
          if (sp) { sp.w = 5; sp.h = 26; sp.rot = Math.PI / 2; sp.fallend = true; }
        }
        if (this.timer <= 0) this.go('idle', 20);
        break;

      // Das Trojanische Pferd. Ein Geschenk. Sagt er.
      case 'pferd':
        this.vx *= 0.7;
        if (this.timer === 40) {
          var links = (dx < 0);
          var ax = g.arena ? g.arena.x : g.cam.x;
          var aw = g.arena ? g.arena.w : 512;
          var startX = links ? ax + aw - 20 : ax - 24;
          var pf = g.addProjectile('pferd', startX, this.y + this.h - 40, (links ? -1 : 1) * 2.3 * spd, 0);
          if (pf) { pf.mitte = ax + aw / 2; pf.arenaX = ax; pf.arenaW = aw; }
          g.floats.add(this.cx(), this.y - 14, 'EIN GESCHENK! AUS TROJA!', '#e8b030', 80);
          global.Sound.play('bossRoar');
        }
        if (this.timer <= 0) this.go('idle', 30);
        break;

      // Schildstoss nach vorn
      case 'trittprep':
        this.vx *= 0.6;
        this.facing = dx > 0 ? 1 : -1;
        if (this.timer <= 0) {
          this.go('tritt', 22);
          this.vx = this.facing * 5.5 * spd;
          this.punch(g, 30, 44, 8, 12);
          global.Sound.play('bossRoar');
          g.shake(5, 12);
          if (!this.spartaSaid) {
            this.spartaSaid = true;
            g.floats.add(this.cx(), this.y - 18, 'DAS IST SPARTA!', '#e8b030', 80);
            g.floats.add(g.player.cx(), g.player.y - 20, 'DAS IST EINE TAVERNE.', '#ffd257', 90);
          } else {
            g.floats.add(this.cx(), this.y - 18, 'SPARTA!', '#e8b030', 50);
          }
        }
        break;

      case 'tritt':
        this.vx *= 0.86;
        if (this.timer <= 0) this.go('idle', this.phase >= 3 ? 14 : 22);
        break;
    }

    bossMove(this, g);

    this.animT++;
    var fast = (this.state === 'dash' || this.state === 'sirtaki' || this.state === 'tritt');
    if (this.animT > (fast ? 2 : 6)) { this.animT = 0; this.anim++; }

    this.open = !(this.state === 'dash' || this.state === 'sirtaki' || this.state === 'tritt');
    bossContact(this, g);
  };

  BossGeorgios.prototype.pick = function (g) {
    var P3 = this.phase >= 3, w;
    var sirtaki = { s: 'sirtaki', t: 64, w: function (l) { return l.mittel ? 2 : 1.2; },
                    dann: function (b) { b.sirtakiTraf = false; } };
    if (!this.sparta) {
      waehle(this, g, [
        { s: 'teller', t: 30, w: function (l) { return l.nah ? 1 : 2.6; } },
        sirtaki,
        { s: 'dashprep', t: 18, w: function (l) { return l.mittel || l.weit ? 2.4 : 0.8; } },
        { s: 'oliven', t: 30, w: function (l) { return l.oben ? 2.6 : 1.4; } },
        { s: 'sprung', t: 50, w: function (l) { return l.ueber || l.oben ? 3 : 1; } },
        { s: 'walk', t: 36, w: function (l) { return l.weit ? 1.2 : 0.2; } }
      ]);
      return;
    }
    // Das Pferd kommt nie zweimal hintereinander — und nie, solange noch eins rollt
    var pferdDa = false;
    for (var i = 0; i < g.projectiles.length; i++) {
      if (g.projectiles[i] && g.projectiles[i].t === 'pferd' && !g.projectiles[i].dead) pferdDa = true;
    }
    w = waehle(this, g, [
      { s: 'speerprep', t: P3 ? 16 : 22, w: function (l) { return l.mittel || l.weit ? 3 : 1; } },
      { s: 'trittprep', t: P3 ? 18 : 24, w: function (l) { return l.nah ? 3 : 0.8; } },
      { s: 'schild', t: 64, w: function (l) { return l.luft || l.ueber ? 3 : 1; } },
      !pferdDa ? { s: 'pferd', t: P3 ? 46 : 50, w: 1.4 } : null,
      { s: 'phalanx', t: P3 ? 56 : 60, w: function (l) { return l.oben ? 2.6 : 1.4; } },
      { s: 'dashprep', t: P3 ? 12 : 16, w: function (l) { return l.weit ? 2 : 0.8; } },
      { s: 'sprung', t: 50, w: function (l) { return l.ueber || l.oben ? 2.4 : 0.8; } },
      sirtaki,
      this.oma ? { s: 'tzatziki', t: 74, w: 1.8 } : null
    ]);
    // Omas Liebling: Speer und gleich hinterher der Schildstoss
    if (P3 && w && w.s === 'speerprep' && Math.random() < 0.6) kombo(this, [['trittprep', 12]]);
  };

  BossGeorgios.prototype.hit = function (g, dmg, p) {
    if (this.invuln > 0 || this.dead || this.state === 'transform') return;
    // Schild oben: KLONG. Kein Schaden, und er stoesst sofort zu.
    if (this.state === 'schild' && p) {
      this.invuln = 18;
      p.vy = -8.6; p.jumpsLeft = 1;
      global.Sound.play('klirr');
      g.shake(4, 10);
      g.particles.burst(this.cx(), this.y + 10, 12, { col: '#f0c860', spread: 2.6, up: 1.2, life: 22 });
      g.floats.add(this.cx(), this.y - 10, 'KLONG!', '#f0c860', 40);
      this.go('trittprep', 14);
      return;
    }
    this.hp -= dmg;
    bossBounce(this, g, p, '#2a5ab8', dmg);
    if (this.hp > 0) return;
    if (this.leben > 1) { this.naechstesLeben(g, false); return; }
    this.dead = true; this.deadTimer = 0; this.vy = -7;
    g.shake(10, 42);
    global.Sound.play('bossRoar');
    g.onGeorgiosDead();
  };

  /* ================= Export ================= */

  global.Ent = {
    T: T,
    World: World,
    Player: Player,
    Enemy: Enemy,
    Item: Item,
    Projectile: Projectile,
    Boss: Boss,
    BossEsat: BossEsat,
    BossAlex: BossAlex,
    BossBroke: BossBroke,
    BossHamza: BossHamza,
    BossGeorgios: BossGeorgios,
    MiniBoss: MiniBoss,
    MINIBOSS: MINIBOSS,
    // Bausteine fuer die Bosse in bosse.js
    bossKit: {
      move: bossMove, contact: bossContact, death: bossDeath, bounce: bossBounce,
      startTransform: startTransform, tickTransform: tickTransform,
      dreiHerzen: dreiHerzen, herzWeg: herzWeg, herzPhase: herzPhase, naechstesLeben: naechstesLeben,
      klugLaufen: klugLaufen, AUSWEICHEN: AUSWEICHEN,
      groundWaves: groundWaves, rainFromSky: rainFromSky, rageSparks: rageSparks,
      clearShots: clearShots, POUND_BOSS_DMG: POUND_BOSS_DMG,
      // Kampf-Hirn (Hollow Knight / Mario)
      lage: lage, waehle: waehle, kombo: kombo, komboWeiter: komboWeiter,
      betaeuben: betaeuben, tickBetaeubt: tickBetaeubt, spott: spott, schlag: schlag, anWand: anWand, sagt: sagt
    },
    Particles: Particles,
    Floats: Floats,
    ENEMY: ENEMY,
    ITEM: ITEM,
    setDifficulty: setDifficulty,
    overlap: overlap,
    moveX: moveX,
    moveY: moveY,
    GRAV: GRAV
  };

})(window);
