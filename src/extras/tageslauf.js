/* =====================================================================
   tageslauf.js — der TAGESLAUF: jeden Tag ein neues Level, fuer alle
   gleich (wie Wordle oder der Daily Run in Spelunky).

   - Die Nummer des Tages (#1 = 19.10.2026, nach Ortszeit) ist der
     Zufallsstartwert. Daraus: eine Welt (Zimmer bis Istanbul, in der Demo
     nur die fruehen), eine Besonderheit (Mondtag, Espresso, ein Herz,
     Kippen) und eine Folge von Abschnitten aus dem Baukasten
     (abschnitte.js) — mit Checkpoints und drei Goldhonig ganz oben.
   - Gemessen wird die Zeit (auf Hundertstel), dazu Tode, Honig, Goldhonig.
     Nochmal spielen geht immer; gemerkt wird die Bestzeit des Tages.
   - TEILEN: ein Text mit einem Kaestchen pro Abschnitt (gruen = ohne Tod,
     gelb = ein Tod, rot = mehr) fuer die Gruppe. Auf dem Handy ueber das
     Teilen-Menue, sonst in die Zwischenablage.
   - SERIE: wie viele Tage hintereinander geschafft. Der erste Lauf des
     Tages bringt Honig aufs Konto (Honig aus dem Lauf + 10 pro Serientag).
   - GEIST: der beste Lauf des Tages laeuft beim naechsten Versuch als
     durchsichtiger Yusuf mit (wie im Zeitrennen bei Mario Kart). Oben steht,
     wie weit man vor (gruen) oder hinter (rot) ihm liegt.

   Gespeichert unter 'balci_tageslauf' (speicher.js, Steam: Cloud).
   Freigeschaltet, sobald Level 1 geschafft ist.
   ===================================================================== */
(function (global) {
  'use strict';

  var F = global.Font, P = global.Pixel;
  function S() { return global.Sound; }
  function In() { return global.Input; }
  function L() { return global.Sprache; }
  function LV() { return global.Levels; }

  var KEY = 'balci_tageslauf';
  var GEIST_KEY = 'balci_tageslauf_geist';     // nur der beste Lauf von heute
  var GEIST_MAX = 3 * 14400;                     // 8 Minuten, alle 2 Ticks x, y, Pose
  var POSEN = ['idle', 'run', 'jump', 'fall', 'pound', 'hurt', 'duck', 'sleep', 'cheer', 'punch'];
  var START = Date.UTC(2026, 9, 19);      // Tag #1 = 19.10.2026
  var B = 15;                             // Bodenhoehe (wie abschnitte.js)
  // Wohin der geteilte Text zeigt. Steht die Steam-Seite, kommt sie hier rein.
  var LINK = { web: 'https://esat7070.github.io/balci-run-demo/', steam: '' };

  /* ---------- Zufall: derselbe Tag = dasselbe Level ---------- */

  function zufall(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function heute(d) {
    d = d || new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - START) / 86400000) + 1;
  }

  /* ---------- Welten ----------
     ab = Levelindex, ab dem es die Welt gibt (Demo: nur bis Level 5).
     th wie in abschnitte.js: Gegner am Boden, Flieger, Zaeher, Gefahr, Essen. */
  var WELTEN = [
    { ab: 0, theme: 'zimmer', music: 'l1', name: 'YUSUFS ZIMMER', diff: 0.9,
      th: { boden: ['wecker'], flug: ['biene'], essen: 'doener',
            schilder: ['TAGESLAUF. HUSEYIN HAT DIE ZEIT GESTOPPT. ER STOPPT IMMER.', 'DAS BETT IST HINTER DIR. BLEIB STARK.'] } },
    { ab: 1, theme: 'garten', music: 'l2', name: 'DER GARTEN', diff: 0.95,
      th: { boden: ['broki', 'wecker'], flug: ['biene'], essen: 'baklava',
            schilder: ['DIE BIENEN HABEN HEUTE FREI. SAGEN SIE.', 'BROKKOLI: HEUTE IM ANGEBOT. NIEMAND KAUFT.'] } },
    { ab: 2, theme: 'gym', music: 'l3', name: 'DIE MUCKIBUDE', diff: 1,
      th: { boden: ['lennart', 'broki'], flug: ['drohne'], zaeh: 'lennart', essen: 'kubide',
            schilder: ['HEUTE IST TAGESLAUF-TAG. MORGEN AUCH. SAGT LENNART.', 'ZEIT STOPPEN. NICHT DIE PAUSE.'] } },
    { ab: 3, theme: 'kueche', music: 'l4', name: 'DIE KÜCHE', diff: 1.05,
      th: { boden: ['broki', 'salat'], flug: ['biene'], gefahr: 'gabel', essen: 'kubide',
            schilder: ['ERFAN KOCHT. LEISE. HEUTE MAL.', 'GABELN IM BODEN. WIE JEDEN TAG.'] } },
    { ab: 4, theme: 'festung', music: 'l5', name: 'DIE SALAT-FESTUNG', diff: 1.1,
      th: { boden: ['salat', 'broki'], flug: ['drohne'], gefahr: 'dressing', essen: 'doener',
            schilder: ['HUSEYIN HAT NACHGEBAUT. MIT MEHR SALAT.', 'DAS DRESSING IST IMMER NOCH WÜTEND.'] } }
  ];

  /* Besonderheit des Tages. w = Gewicht. */
  var MODS = [
    { k: 'normal', w: 8, text: 'EIN GANZ NORMALER TAG. SAGT HUSEYIN.' },
    { k: 'mond', w: 4, schwere: 0.72, text: 'MONDTAG: YUSUF WIEGT HEUTE WENIGER. SAGT ER.' },
    { k: 'espresso', w: 4, tempo: 0.35, text: 'ALLE GEGNER HABEN ESPRESSO GETRUNKEN.' },
    { k: 'glas', w: 2, herzen: 1, text: 'NUR EIN HERZ. HEUTE ZÄHLT JEDER SPRUNG.' },
    { k: 'kippen', w: 2, kippen: true, text: 'YUSUF HAT HEUTE KIPPEN DABEI. SHIFT / E = WERFEN.' }
  ];

  /* Wer den Tag ansagt (eine Zeile vor dem Start) */
  var ANSAGE = [
    ['esat', 'ICH HAB SCHON BESTELLT. DU MUSST NUR NOCH HINLAUFEN.'],
    ['huseyin', 'ICH STOPP DIE ZEIT. ICH STOPP SOWIESO IMMER ALLES.'],
    ['mirkan', 'WIE LANGE BRAUCHST DU? WIE LANGE BRAUCH ICH? DARF ICH MITLAUFEN?'],
    ['lennart', 'BRO. DAS IST KARDIO. ICH SCHICK DIR DANACH EINE SPRACHNACHRICHT.'],
    ['erfan', 'WER ZUERST IM ZIEL IST, KRIEGT KOOBIDEH. DU BIST DER EINZIGE, ALSO LOS.'],
    ['alex', 'ICH HAB DIE STRECKE SCHON AUF PLATIN. SIEBENUNDVIERZIGMAL.'],
    ['georgios', 'ICH BIN DAS IN DREI SEKUNDEN GELAUFEN. SAGT OMA.'],
    ['sonnet', 'WER HINFÄLLT, RUFT HIT. AUCH DU, ABI.'],
    ['nils', 'ICH KENNE DEINE ZEIT SCHON. SIE WAR IN MEINEM KOPF.']
  ];

  /* ---------- Speicher ---------- */

  var st = { tage: {}, serie: 0, letzter: 0, bestSerie: 0 };

  function laden() {
    var raw = global.Speicher ? global.Speicher.get(KEY) : null, o = null;
    try { o = raw && raw.length < 20000 ? JSON.parse(raw) : null; } catch (e) { o = null; }
    if (!o || typeof o !== 'object') return;
    var zahl = function (v, max) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(0, Math.min(max, v)) : 0; };
    st.serie = zahl(o.serie, 9999); st.letzter = zahl(o.letzter, 99999); st.bestSerie = zahl(o.bestSerie, 9999);
    st.tage = {};
    if (o.tage && typeof o.tage === 'object') {
      for (var k in o.tage) {
        var t = o.tage[k], nr = zahl(k, 99999);
        if (!t || typeof t !== 'object' || !nr) continue;
        st.tage[nr] = { best: zahl(t.best, 3600000), tode: zahl(t.tode, 9999), honig: zahl(t.honig, 100),
                        gold: zahl(t.gold, 3), versuche: zahl(t.versuche, 9999),
                        raster: typeof t.raster === 'string' ? t.raster.replace(/[^GYR]/g, '').slice(0, 30) : '' };
      }
    }
  }
  /* Geist: { nr, d: [x, y, pose*2+flip, ...] } */
  var geist = null;
  function geistLaden() {
    var raw = global.Speicher ? global.Speicher.get(GEIST_KEY) : null, o = null;
    try { o = raw && raw.length < 400000 ? JSON.parse(raw) : null; } catch (e) { o = null; }
    if (!o || !Array.isArray(o.d) || o.d.length % 3 || o.d.length > GEIST_MAX) { geist = null; return; }
    for (var i = 0; i < o.d.length; i++) if (typeof o.d[i] !== 'number' || !isFinite(o.d[i])) { geist = null; return; }
    geist = { nr: Math.floor(Number(o.nr)) || 0, d: o.d };
  }
  function geistSpeichern(nr, d) {
    geist = { nr: nr, d: d };
    try { if (global.Speicher) global.Speicher.set(GEIST_KEY, JSON.stringify(geist)); } catch (e) {}
  }

  function speichern() {
    // Nur die letzten 60 Tage
    var nrs = Object.keys(st.tage).map(Number).sort(function (a, b) { return b - a; });
    for (var i = 60; i < nrs.length; i++) delete st.tage[nrs[i]];
    if (global.Speicher) global.Speicher.set(KEY, JSON.stringify(st));
  }

  /* ---------- Das Level bauen ---------- */

  function gewaehlt(R, liste) {
    var summe = 0, i;
    for (i = 0; i < liste.length; i++) summe += liste[i].w || 1;
    var r = R() * summe;
    for (i = 0; i < liste.length; i++) { r -= liste[i].w || 1; if (r < 0) return liste[i]; }
    return liste[liste.length - 1];
  }

  /** Das Level zu Tag nr. Gibt { lvl, abschnitte: [{x0, x1}], welt, mod } zurueck. */
  function bauen(nr) {
    var R = zufall(nr * 7919 + 1013);
    var anzahl = LV().list.length;
    var welten = WELTEN.filter(function (w) { return w.ab < anzahl; });
    var welt = welten[Math.floor(R() * welten.length)];
    var mod = gewaehlt(R, MODS);

    // Drei Teile mit je einem Goldhonig-Abschnitt, dazwischen Checkpoints.
    // Vorne leichter, hinten schwerer.
    var LEICHT = ['flach', 'treppe', 'kisten', 'luecken'];
    var MITTEL = ['luecken', 'kisten', 'mauer', 'treppe', 'arena'];
    // Die Auswahl haengt nicht von der Welt ab: so haben Demo und Vollversion
    // am selben Tag dieselbe Strecke (die Demo kennt weniger Welten)
    var SCHWER = ['mauer', 'luecken', 'arena', 'hinterhalt', 'tabletts'];
    var GOLD = ['ebenen', 'turm', 'geheim'];
    // Goldhonig-Abschnitte in zufaelliger Reihenfolge
    for (var g = GOLD.length - 1; g > 0; g--) { var j = Math.floor(R() * (g + 1)), tt = GOLD[g]; GOLD[g] = GOLD[j]; GOLD[j] = tt; }
    function zieh(pool, n) {
      var out = [];
      for (var i = 0; i < n; i++) {
        var s = pool[Math.floor(R() * pool.length)];
        if (out.length && out[out.length - 1] === s) s = pool[(pool.indexOf(s) + 1) % pool.length];
        out.push(s);
      }
      return out;
    }
    var folge = [].concat(['flach'], zieh(LEICHT, 2), [[GOLD[0], { gold: true }]], ['rast'],
                          zieh(MITTEL, 3), [[GOLD[1], { gold: true }]], ['rast'],
                          zieh(SCHWER, 3), [[GOLD[2], { gold: true }]], ['flach']);

    var tage = ['SONNTAG', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG'];
    var datum = new Date(START + (nr - 1) * 86400000);
    var ansage = ANSAGE[Math.floor(R() * ANSAGE.length)];
    var vorne = 13;
    var b = LV().baue({
      id: 'T', name: welt.name, sub: tage[datum.getUTCDay()] + ' - ' + 'TAGESLAUF #' + nr,
      theme: welt.theme, music: welt.music, w: 2000, h: 18, spawn: [3, B], par: 150,
      goal: [100, B], diff: welt.diff + (mod.tempo || 0),
      intro: [['karte', 'TAGESLAUF #' + nr + '|' + welt.name + '|#FFD257'], ansage, ['', mod.text]],
      outro: []
    });
    b.d.kopf = 'TAGESLAUF #' + nr;
    b.g(0, vorne - 1, B);
    b.trail(5, B - 2, 4, 1, 1);
    var z = global.Abschnitte.zufuss(b, vorne, welt.th), abschnitte = [];
    for (var i = 0; i < folge.length; i++) {
      var x0 = z.x;
      var f = folge[i];
      if (typeof f === 'string') z.add(f); else z.add(f[0], f[1]);
      abschnitte.push({ x0: x0, x1: z.x, name: typeof f === 'string' ? f : f[0] });
    }
    var ende = z.x;
    b.g(ende, ende + 15, B);
    b.trail(ende + 2, B - 2, 4, 2);
    b.d.w = ende + 16;
    b.d.goal = [ende + 9, B];
    b.d.par = Math.round((ende + 16) / 3.2);     // grob: drei Kacheln pro Sekunde
    return { nr: nr, lvl: b.out(), abschnitte: abschnitte, welt: welt, mod: mod };
  }

  /* ---------- Spielen ---------- */

  function freigeschaltet(G) {
    var sv = G._saveCopy ? G._saveCopy() : null;
    return !!(sv && sv.unlocked > 1);
  }

  function starten(G) {
    var nr = heute();
    var tl = bauen(nr);
    tl.tode = []; tl.letzteTode = 0; tl.mod = tl.mod || MODS[0];
    tl.aufnahme = [];
    tl.geist = (geist && geist.nr === nr && geist.d.length >= 3) ? geist.d : null;
    tl.ankunft = tl.geist ? ankunftsZeiten(tl.geist, tl.lvl.w) : null;
    for (var i = 0; i < tl.abschnitte.length; i++) tl.tode.push(0);
    G.tageslauf = tl;
    var p = G.player;
    if (tl.mod.herzen) p.maxHp = tl.mod.herzen;
    else p.maxHp = global.Balance.s('herzen');
    G._sonderStart('tag', tl.lvl);
  }

  /** Jeden Tick im Spiel (game.js, updatePlay) */
  function update(G) {
    var tl = G.tageslauf, p = G.player;
    if (!tl || !p) return;
    if (tl.mod.schwere) G.schwere = tl.mod.schwere;
    var tode = p.deaths || 0;
    if (tode > tl.letzteTode) {
      // Wo ist er gestorben? Der Abschnitt, in dem er zuletzt stand
      var tx = (tl.letzteX || p.x) / 16;
      for (var i = 0; i < tl.abschnitte.length; i++) {
        if (tx < tl.abschnitte[i].x1 || i === tl.abschnitte.length - 1) { tl.tode[i] += tode - tl.letzteTode; break; }
      }
      tl.letzteTode = tode;
      tl.kippenNachTod = !!tl.mod.kippen;
    }
    // Aufnahme fuer den Geist: alle 2 Ticks Fussmitte und Pose
    if ((G.time & 1) === 0 && tl.aufnahme.length < GEIST_MAX) {
      var ps = p.pose(), k = (G.time >> 1) * 3, code = Math.max(0, POSEN.indexOf(ps.pose)) * 2 + (p.facing < 0 ? 1 : 0);
      tl.aufnahme[k] = Math.round(p.cx()); tl.aufnahme[k + 1] = Math.round(p.feet()); tl.aufnahme[k + 2] = code;
    }
    if (!p.dead) {
      tl.letzteX = p.x;
      if (tl.kippenNachTod || (tl.mod.kippen && !tl.kippenAnfang)) { p.smoke = true; tl.kippenNachTod = false; tl.kippenAnfang = true; }
    }
  }

  function raster(tl) {
    return tl.tode.map(function (n) { return n === 0 ? 'G' : (n === 1 ? 'Y' : 'R'); }).join('');
  }

  /** Im Ziel (game.js, finishLevel) */
  function fertig(G) {
    var tl = G.tageslauf, p = G.player;
    var s0 = G.levelStart || { honey: 0 };
    var honigDa = 0;
    for (var i = 0; i < tl.lvl.items.length; i++) if (tl.lvl.items[i].t === 'honig') honigDa++;
    var gesammelt = Math.max(0, (p.honey || 0) - (s0.honey || 0));
    var erg = {
      ticks: G.time, tode: p.deaths || 0,
      honig: honigDa ? Math.min(100, Math.round(gesammelt / honigDa * 100)) : 0,
      gold: G.goldCount ? G.goldCount() : 0, raster: raster(tl)
    };
    var t = st.tage[tl.nr], erstes = !t;
    if (!t) t = st.tage[tl.nr] = { best: erg.ticks, tode: erg.tode, honig: erg.honig, gold: erg.gold, versuche: 0, raster: erg.raster };
    t.versuche++;
    erg.neueBestzeit = erstes || erg.ticks < t.best;
    if (erg.ticks < t.best || erstes) { t.best = erg.ticks; t.tode = erg.tode; t.honig = erg.honig; t.gold = erg.gold; t.raster = erg.raster; }
    erg.versuche = t.versuche;
    erg.best = t.best;
    // Serie: gestern geschafft = weiter, sonst neu
    if (erstes) {
      st.serie = (st.letzter === tl.nr - 1 && st.serie > 0) ? st.serie + 1 : 1;
      st.letzter = tl.nr;
      st.bestSerie = Math.max(st.bestSerie, st.serie);
      erg.lohn = gesammelt + 10 * Math.min(10, st.serie);
      if (global.Shop && global.Shop.gutschrift) global.Shop.gutschrift(erg.lohn);
    }
    erg.serie = st.serie;
    speichern();
    // Bester Lauf des Tages = der Geist fuer den naechsten Versuch
    if (erg.neueBestzeit && tl.aufnahme.length) {
      for (var a = 0; a < tl.aufnahme.length; a++) if (tl.aufnahme[a] === undefined) tl.aufnahme[a] = a >= 3 ? tl.aufnahme[a - 3] : 0;
      geistSpeichern(tl.nr, tl.aufnahme.slice(0, GEIST_MAX));
    }
    tl.erg = erg;
    tl.ergT = 0;
    tl.wahl = 0;
    tl.meldung = null;
  }

  /* ---------- Teilen ---------- */

  function zeitText(ticks, kurz) {
    var cs = Math.floor(ticks / 60 * 100), s = Math.floor(cs / 100);
    var m = Math.floor(s / 60);
    return m + ':' + ('0' + (s % 60)).slice(-2) + (kurz ? '' : '.' + ('0' + (cs % 100)).slice(-2));
  }

  function teilText(tl, G) {
    var e = tl.erg, en = L() && L().ist('en');
    var kaest = e.raster.split('').map(function (c) { return c === 'G' ? '🟩' : (c === 'Y' ? '🟨' : '🟥'); }).join('');
    var sterne = '';
    for (var i = 0; i < 3; i++) sterne += i < e.gold ? '⭐' : '☆';
    var welt = tr(tl.welt.name);
    var zeilen = [
      'BALCI RUN · ' + (en ? 'DAILY RUN #' : 'TAGESLAUF #') + tl.nr,
      welt + (tl.mod.k !== 'normal' ? ' · ' + tr(MOD_KURZ[tl.mod.k]) : ''),
      '⏱ ' + zeitText(e.best) + '  💀 ' + e.tode + '  🍯 ' + e.honig + '%  ' + sterne,
      kaest,
      e.serie > 1 ? '🔥 ' + e.serie + (en ? ' DAYS IN A ROW' : ' TAGE IN FOLGE') : '',
      (global.balciDesktop && LINK.steam) ? LINK.steam : LINK.web
    ];
    return zeilen.filter(function (z) { return z; }).join('\n');
  }

  var MOD_KURZ = { mond: 'MONDTAG', espresso: 'ESPRESSO', glas: 'EIN HERZ', kippen: 'KIPPEN' };

  /* Zusammengesetzte Zeilen: Teile uebersetzen, das Ganze als fertig markieren */
  function tr(s) { return L() ? L().t(s) : s; }
  function fertigText(s) { if (L()) L().schonUebersetzt(s); return s; }

  function teilen(G) {
    var tl = G.tageslauf, text = teilText(tl, G);
    tl.teilText = text;
    var fertigMeldung = function (m) { tl.meldung = m; tl.meldungT = 150; };
    var nav = global.navigator || {};
    try {
      if (G.touch && nav.share) {
        nav.share({ text: text }).then(function () { fertigMeldung('GETEILT!'); }, function () {});
        return;
      }
    } catch (e) {}
    try {
      if (nav.clipboard && nav.clipboard.writeText) {
        nav.clipboard.writeText(text).then(function () { fertigMeldung('KOPIERT! JETZT IN DIE GRUPPE EINFÜGEN.'); },
                                           function () { alsText(); });
        return;
      }
    } catch (e) {}
    alsText();
    function alsText() {
      // Letzter Weg: unsichtbares Textfeld + Kopieren
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        fertigMeldung(ok ? 'KOPIERT! JETZT IN DIE GRUPPE EINFÜGEN.' : 'KOPIEREN GEHT HIER NICHT. MACH EIN BILDSCHIRMFOTO.');
      } catch (e) { fertigMeldung('KOPIEREN GEHT HIER NICHT. MACH EIN BILDSCHIRMFOTO.'); }
    }
  }

  /* ---------- Ergebnis-Bildschirm (G.state = 'tagesziel') ---------- */

  var KNOEPFE = ['TEILEN', 'NOCHMAL', 'HAUPTMENÜ'];

  function knopfRects(W, H) {
    var bw = 110, gap = 10, total = KNOEPFE.length * bw + (KNOEPFE.length - 1) * gap, x0 = Math.round((W - total) / 2);
    return KNOEPFE.map(function (l, i) { return { x: x0 + i * (bw + gap), y: H - 44, w: bw, h: 24, label: l }; });
  }

  function aktion(G, i) {
    var tl = G.tageslauf;
    if (i === 0) { S().play('select'); teilen(G); }
    else if (i === 1) { S().play('select'); starten(G); }
    else { S().play('select'); G.tageslauf = null; G._zumTitel(); }
    if (i !== 0 && tl) tl.erg = null;
  }

  function updateErgebnis(G, W, H) {
    var tl = G.tageslauf;
    if (!tl || !tl.erg) return;
    tl.ergT++;
    if (tl.meldungT > 0) tl.meldungT--;
    if (tl.ergT < 40) return;
    var I = In(), tp = I.tap();
    if (tp) {
      var r = knopfRects(W, H);
      for (var i = 0; i < r.length; i++) {
        if (tp.x >= r[i].x && tp.x < r[i].x + r[i].w && tp.y >= r[i].y - 4 && tp.y < r[i].y + r[i].h + 4) { aktion(G, i); return; }
      }
      return;
    }
    if (I.hit('left')) { tl.wahl = (tl.wahl + KNOEPFE.length - 1) % KNOEPFE.length; S().play('move'); }
    if (I.hit('right')) { tl.wahl = (tl.wahl + 1) % KNOEPFE.length; S().play('move'); }
    if (I.hit('back') || I.hit('pause')) { aktion(G, 2); return; }
    if (I.hit('jump') || I.hit('confirm')) aktion(G, tl.wahl);
  }

  var FARBE = { G: '#6fd06a', Y: '#ffd257', R: '#ff6a5a' };

  function drawErgebnis(ctx, G, W, H) {
    var tl = G.tageslauf;
    if (!tl || !tl.erg) return;
    var e = tl.erg, t = tl.ergT;
    ctx.fillStyle = 'rgba(8,5,12,' + Math.min(0.86, t / 20).toFixed(2) + ')';
    ctx.fillRect(0, 0, W, H);
    if (t < 6) return;
    F.draw(ctx, 'TAGESLAUF #' + tl.nr, W / 2, 18, { color: '#8f86a8', align: 'center' });
    F.draw(ctx, 'GESCHAFFT!', W / 2, 30, { color: '#ffd257', align: 'center', scale: 3, shadow: true, wave: G.tick * 0.07, waveAmp: 1 });
    F.draw(ctx, fertigText(tr(tl.welt.name) + (tl.mod.k !== 'normal' ? ' - ' + tr(MOD_KURZ[tl.mod.k]) : '')), W / 2, 58,
           { color: '#c8b8e0', align: 'center' });

    // Die Zeit gross, darunter die Bestzeit des Tages
    var jetzt = zeitText(e.ticks);
    F.draw(ctx, jetzt, W / 2, 74, { color: '#ffffff', align: 'center', scale: 2, shadow: true });
    F.draw(ctx, e.neueBestzeit ? (e.versuche > 1 ? 'NEUE BESTZEIT!' : 'ERSTER LAUF HEUTE') : 'BESTZEIT HEUTE ' + zeitText(e.best),
           W / 2, 94, { color: e.neueBestzeit ? '#8ae07a' : '#a094b8', align: 'center' });

    var x0 = 150, x1 = W - 150, y = 112;
    var zeilen = [
      ['TODE', '' + e.tode],
      ['HONIG', e.honig + ' %'],
      ['GOLDHONIG', e.gold + ' VON 3'],
      ['VERSUCHE HEUTE', '' + e.versuche],
      ['SERIE', e.serie === 1 ? '1 TAG' : e.serie + ' TAGE']
    ];
    for (var i = 0; i < zeilen.length; i++) {
      F.draw(ctx, zeilen[i][0], x0, y + i * 12, { color: '#c8b8e0' });
      F.draw(ctx, zeilen[i][1], x1, y + i * 12, { color: '#ffffff', align: 'right' });
    }
    if (e.lohn) F.draw(ctx, 'AUFS HONIGKONTO: +' + e.lohn, W / 2, y + 62, { color: '#ffd257', align: 'center' });

    // Ein Kaestchen pro Abschnitt: wo er gestorben ist
    var n = e.raster.length, kw = 12, kg = 3, kx = Math.round(W / 2 - (n * kw + (n - 1) * kg) / 2), ky = y + 76;
    for (var k = 0; k < n; k++) {
      var c = e.raster.charAt(k);
      var auf = Math.min(1, Math.max(0, (t - 20 - k * 3) / 6));
      if (auf <= 0) continue;
      ctx.globalAlpha = auf;
      ctx.fillStyle = FARBE[c] || '#888';
      ctx.fillRect(kx + k * (kw + kg), ky, kw, kw);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(kx + k * (kw + kg), ky, kw, 2);
    }
    ctx.globalAlpha = 1;

    // Yusuf freut sich
    P.drawChar(ctx, 'yusuf', 70, 230, { pose: 'cheer', face: 'laugh', frame: (G.tick >> 3) });

    var r = knopfRects(W, H);
    for (var b = 0; b < r.length; b++) {
      var an = b === tl.wahl;
      ctx.fillStyle = an ? 'rgba(92,62,24,0.97)' : 'rgba(38,26,54,0.95)';
      ctx.fillRect(r[b].x, r[b].y, r[b].w, r[b].h);
      ctx.strokeStyle = an ? '#ffe9a8' : '#ffc23c';
      ctx.lineWidth = an ? 2 : 1;
      ctx.strokeRect(r[b].x + 0.5, r[b].y + 0.5, r[b].w - 1, r[b].h - 1);
      F.draw(ctx, r[b].label, r[b].x + r[b].w / 2, r[b].y + 9, { color: an ? '#ffffff' : '#ffe9a8', align: 'center' });
    }
    if (tl.meldungT > 0 && tl.meldung) {
      F.draw(ctx, tl.meldung, W / 2, H - 14, { color: '#8ae07a', align: 'center', shadow: true });
    } else if (t > 40) {
      F.draw(ctx, G.touch ? 'ANTIPPEN' : 'LINKS / RECHTS = AUSWAHL    SPRUNG = OK', W / 2, H - 14, { color: '#6a6280', align: 'center' });
    }
  }

  /* ---------- Geist ---------- */

  /** Wann (in Ticks) der Geist zum ersten Mal an Kachel-Spalte x war */
  function ankunftsZeiten(d, breite) {
    var an = [], weit = -1;
    for (var k = 0; k < d.length; k += 3) {
      var tx = Math.floor(d[k] / 16);
      while (weit < tx && weit < breite) { weit++; an[weit] = (k / 3) * 2; }
    }
    return an;
  }

  /** Den Geist zeichnen (game.js, vor Yusuf) */
  function drawGeist(ctx, G, camX, camY) {
    var tl = G.tageslauf;
    if (!tl || !tl.geist || G.state === 'tagesziel') return;
    var n = tl.geist.length / 3, k = Math.min(n - 1, G.time >> 1), d = tl.geist;
    var x = d[k * 3], y = d[k * 3 + 1], code = d[k * 3 + 2];
    var fertigDa = (G.time >> 1) >= n;
    P.drawChar(ctx, 'yusuf', Math.round(x - camX), Math.round(y - camY), {
      pose: fertigDa ? 'cheer' : (POSEN[code >> 1] || 'idle'), face: fertigDa ? 'laugh' : 'normal',
      frame: k >> 2, flip: !!(code & 1), alpha: 0.42, flash: '#9fdcff', flashAlpha: 0.6
    });
  }

  /** Vor oder hinter dem Geist? Ticks (negativ = schneller), oder null */
  function abstand(G) {
    var tl = G.tageslauf, p = G.player;
    if (!tl || !tl.ankunft || !p) return null;
    var tx = Math.floor(p.cx() / 16), an = tl.ankunft[Math.min(tx, tl.ankunft.length - 1)];
    if (an === undefined || tx < 14) return null;
    return G.time - an;
  }

  /** Oben in der Mitte: Abstand zum Geist */
  function drawHud(ctx, G, W) {
    var a = abstand(G);
    if (a === null || G.state === 'tagesziel') return;
    var txt = (a <= 0 ? '-' : '+') + zeitText(Math.abs(a));
    ctx.fillStyle = 'rgba(8,5,12,0.62)';
    ctx.fillRect(W / 2 - 46, 3, 92, 14);
    F.draw(ctx, fertigText(tr('GEIST') + ' ' + txt), W / 2, 6, { color: a <= 0 ? '#8ae07a' : '#ff8a7a', align: 'center', shadow: true });
  }

  /** Oben im Bild, waehrend des Laufs: Zeit auf Hundertstel (im Ziel steht sie) */
  function hudZeit(G) { var tl = G.tageslauf; return zeitText(tl && tl.erg ? tl.erg.ticks : G.time); }

  /** Zeile im Hauptmenue */
  function menuLabel() {
    var nr = heute(), t = st.tage[nr];
    return 'TAGESLAUF #' + nr + (t ? '  ' + zeitText(t.best, false) : '');
  }

  laden();
  geistLaden();

  global.Tageslauf = {
    drawGeist: drawGeist,
    drawHud: drawHud,
    abstand: abstand,
    heute: heute,
    bauen: bauen,
    starten: starten,
    update: update,
    fertig: fertig,
    updateErgebnis: updateErgebnis,
    drawErgebnis: drawErgebnis,
    hudZeit: hudZeit,
    menuLabel: menuLabel,
    heuteGeschafft: function () { return !!st.tage[heute()]; },
    /** Gibt es alles, was der Tageslauf braucht (Baukasten und Abschnitte)? */
    verfuegbar: function () { return !!(LV() && LV().baue && global.Abschnitte); },
    freigeschaltet: freigeschaltet,
    zeitText: zeitText,
    teilText: teilText,
    LINK: LINK,
    WELTEN: WELTEN,
    MODS: MODS,
    _st: function () { return st; },
    _laden: laden,
    _geist: function () { return geist; }
  };

})(window);
