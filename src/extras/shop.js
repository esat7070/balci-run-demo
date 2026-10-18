/* =====================================================================
   shop.js — Honigkonto, Shop und Auftraege.

     HONIGKONTO   Jedes Honigglas, das man in einem Level behaelt, landet
                  am Levelende auf dem Konto. Dazu 20 pro Goldhonig und ein
                  Bonus fuer den Rang (B 10, A 25, S 50, P 100).
     SHOP         Kostueme, Huete und Spuren fuer Yusuf — nur Aussehen,
                  nie Spielvorteile (die Bestenliste bleibt fair). Bezahlt
                  wird mit Honig. Zwei Pakete gibt es nur fuer echtes Geld,
                  und nur ueber den Store der Plattform (Steam, Google
                  Play, App Store).
     AUFTRAEGE    Drei Auftraege aus der Gruppe JUNGS, z. B. "Besiege 25
                  Gegner". Erledigt = Honig aufs Konto, dann kommt ein neuer.
                  Ablehnen geht immer.

   SICHERHEIT (siehe docs/SHOP.md):
   - Echtes Geld fasst dieses Spiel nie an. Es ruft nur window.balciStore
     auf, und das stellt die Huelle bereit: steam/preload.js (Steamworks,
     DLC) oder extras/store-mobil.js (RevenueCat: Google Play, App Store).
     Im Browser gibt es keinen Store.
   - Ob ein Paket gekauft ist, sagt allein der Store — bei jedem Start,
     nach jedem Kauf und wenn das Spiel wieder nach vorne kommt. Das wird
     NIE gespeichert: Wer den Spielstand von Hand aendert, bekommt kein
     Paket. Erstattet der Store einen Kauf, ist das Paket wieder weg.
   - Honig kann man nicht kaufen, und es gibt keine Zufallskisten.
   - Alles, was vom Store kommt, wird geprueft (nur bekannte Pakete, nur
     true, Preise nur in Zeichen der Pixelschrift), jeder Aufruf hat eine
     Zeitgrenze, und es laeuft immer nur ein Kauf gleichzeitig.
   ===================================================================== */
(function (global) {
  'use strict';

  var P = global.Pixel, F = global.Font;
  function S() { return global.Sound; }
  function In() { return global.Input; }
  function LV() { return global.Levels; }
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function hat(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  var KEY = 'balci_shop';
  var MAX = 9999999;
  var GOLD = '#ffd257', HELL = '#ffe9a8', GRAU = '#a094b8', MATT = '#8f86a8', DUNKEL = '#6a6280',
      GRUEN = '#8cd85a', ROT = '#ff6a6a', LILA = '#c8b8e0', BLAU = '#6fc8e8';

  /* ================= Die Ware =================
     art:   kostuem | hut | spur
     preis: Honig. paket: gibt es nur im Paket fuer echtes Geld.
     Kostueme und Huete sind in grafik/pixel.js gezeichnet. */
  var WARE = [
    { id: 'standard', art: 'kostuem', name: 'JEANSJACKE', preis: 0, text: 'WIE IMMER. SITZT.' },
    { id: 'pyjama', art: 'kostuem', name: 'PYJAMA', preis: 150, text: 'FÜR DEN WEG ZUM KÜHLSCHRANK.' },
    { id: 'jogger', art: 'kostuem', name: 'TRAININGSANZUG', preis: 300, text: 'BEQUEM IST DAS NEUE SCHICK.' },
    { id: 'trikot', art: 'kostuem', name: 'TRIKOT', preis: 450, text: 'FÜR DAS SPIEL DES JAHRES.' },
    { id: 'imker', art: 'kostuem', name: 'IMKER-ANZUG', preis: 650, text: 'DIE BIENEN VERGESSEN NICHTS. ER AUCH NICHT.' },
    { id: 'bademantel', art: 'kostuem', name: 'BADEMANTEL', preis: 900, text: 'SONNTAG, 13:40 UHR. COUCH.' },
    { id: 'anzug', art: 'kostuem', name: 'HOCHZEITSANZUG', preis: 1400, text: 'FÜR DIE HOCHZEIT. ODER DEN DÖNERLADEN.' },
    { id: 'sultan', art: 'kostuem', name: 'SULTAN', paket: 'kostueme', text: 'DER HONIG GEHÖRT JETZT DEM REICH.' },
    { id: 'astronaut', art: 'kostuem', name: 'ASTRONAUT', paket: 'kostueme', text: 'EIN KLEINER SCHRITT. EIN GROSSER HUNGER.' },
    { id: 'baer', art: 'kostuem', name: 'HONIGBÄR', paket: 'kostueme', text: 'ENDLICH EHRLICH.' },
    { id: 'gold', art: 'kostuem', name: 'GOLD-JOGGER', paket: 'unterstuetzer', text: 'GLÄNZT WIE GOLDHONIG. DANKE!' },

    { id: 'keiner', art: 'hut', name: 'OHNE HUT', preis: 0, text: 'DIE LOCKEN REICHEN.' },
    { id: 'cap', art: 'hut', name: 'CAP', preis: 100, text: 'VERKEHRT HERUM. WIE SONST?' },
    { id: 'schlafmuetze', art: 'hut', name: 'SCHLAFMÜTZE', preis: 200, text: 'FÜR ZWISCHENDURCH. ALSO IMMER.' },
    { id: 'fes', art: 'hut', name: 'FES', preis: 350, text: 'MIT QUASTE. FÜR DIE GROSSE REISE.' },
    { id: 'antennen', art: 'hut', name: 'BIENEN-ANTENNEN', preis: 500, text: 'WENN DU SIE NICHT BESIEGEN KANNST ...' },
    { id: 'kochmuetze', art: 'hut', name: 'KOCHMÜTZE', preis: 750, text: '10.000 KALORIEN. SELBST GEKOCHT.' },
    { id: 'krone', art: 'hut', name: 'KRONE', preis: 1800, text: 'KÖNIG DER COUCH.' },
    { id: 'turban', art: 'hut', name: 'TURBAN', paket: 'kostueme', text: 'PASST ZUM SULTAN. UND ZUM HONIG.' },
    { id: 'helm', art: 'hut', name: 'RAUMHELM', paket: 'kostueme', text: 'IM ALL HÖRT KEINER DEN BAUCH KNURREN.' },
    { id: 'baerenohren', art: 'hut', name: 'BÄRENOHREN', paket: 'kostueme', text: 'HÖREN EIN HONIGGLAS AUF ZEHN METER.' },
    { id: 'heiligenschein', art: 'hut', name: 'HEILIGENSCHEIN', paket: 'unterstuetzer', text: 'FÜR DICH. WEIL DU HILFST.' },

    { id: 'keine', art: 'spur', name: 'OHNE SPUR', preis: 0, text: 'NUR STAUB. WIE IMMER.' },
    { id: 'honig', art: 'spur', name: 'HONIGTROPFEN', preis: 250, text: 'ER TROPFT. ER IST HALT SO.' },
    { id: 'blasen', art: 'spur', name: 'SEIFENBLASEN', preis: 400, text: 'FRISCH GEDUSCHT. ANGEBLICH.' },
    { id: 'herzen', art: 'spur', name: 'HERZCHEN', preis: 600, text: 'ALLE LIEBEN YUSUF. FAST ALLE.' },
    { id: 'konfetti', art: 'spur', name: 'KONFETTI', preis: 1000, text: 'JEDER SCHRITT EINE PARTY.' },
    { id: 'goldstaub', art: 'spur', name: 'GOLDSTAUB', paket: 'unterstuetzer', text: 'FUNKELT. WIE DU.' }
  ];
  var STANDARD = { kostuem: 'standard', hut: 'keiner', spur: 'keine' };
  var WARE_ID = {};
  WARE.forEach(function (w) { WARE_ID[w.id] = w; });
  function ware(id) { return (typeof id === 'string' && hat(WARE_ID, id)) ? WARE_ID[id] : null; }

  /* Pakete fuer echtes Geld. Der Schluessel (kostueme, unterstuetzer) ist
     derselbe wie in steam/package.json (DLC) und extras/store-mobil.js. */
  var PAKETE = {
    kostueme: { name: 'KOSTÜM-PAKET', zeilen: ['SULTAN MIT TURBAN, ASTRONAUT MIT RAUMHELM', 'UND HONIGBÄR MIT OHREN.'],
                vorschau: [['sultan', 'turban'], ['astronaut', 'helm'], ['baer', 'baerenohren']] },
    unterstuetzer: { name: 'UNTERSTÜTZER-PAKET', zeilen: ['GOLD-JOGGER, HEILIGENSCHEIN, GOLDSTAUB.', 'UND EIN GROSSES DANKE VON YUSUF.'],
                     vorschau: [['gold', 'heiligenschein']] }
  };
  var PAKET_REIHE = ['kostueme', 'unterstuetzer'];

  /* Ein kleines Honigglas (7 x 8) als Zeichen fuer Honig-Preise */
  P.def('honig_mini', `
    .kkkkk.
    .kmmmk.
    kyyyyyk
    kyYyyyk
    kyYyoyk
    kyyooyk
    kyooook
    .kkkkk.
  `, { k: '#3a2410', y: '#ffc23c', Y: '#ffe9a8', o: '#e08a1e', m: '#a8763c' });

  /** Zahl mit Honigglas dahinter. align: 'left' | 'right' (x = rechter Rand). */
  function honigZahl(ctx, text, x, y, o) {
    o = o || {};
    var sc = o.scale || 1, w = F.measure(text, sc, 1), gx;
    if (o.align === 'right') { gx = x - 7 * sc; x = gx - 3 - w; } else gx = x + w + 3;
    F.draw(ctx, text, x, y, { color: o.color || GOLD, scale: sc, shadow: o.shadow });
    ctx.save();
    ctx.translate(Math.round(gx), Math.round(y - (sc > 1 ? 1 : 0)));
    if (sc > 1) ctx.scale(sc, sc);
    P.draw(ctx, 'honig_mini', 0, 0);
    ctx.restore();
  }

  var RANG_BONUS = [0, 10, 25, 50, 100];   // C, B, A, S, P
  var GOLD_BONUS = 20;

  /* ================= Auftraege =================
     ziele/lohn je Stufe: frueh (bis Level 6), mitte (bis 18), spaet. */
  var AUFTRAG = {
    honig: { ziele: [80, 160, 260], lohn: [60, 110, 170], text: function (n) { return 'SAMMLE ' + n + ' HONIG.'; } },
    gegner: { ziele: [12, 25, 40], lohn: [60, 100, 150], text: function (n) { return 'BESIEGE ' + n + ' GEGNER.'; } },
    stampfer: { ziele: [3, 6, 10], lohn: [70, 110, 160], text: function (n) { return n + ' GEGNER PER BAUCH-STAMPFER.'; } },
    gold: { ziele: [2, 4, 6], lohn: [80, 140, 200], text: function (n) { return 'FINDE ' + n + ' GOLDHONIG.'; } },
    combo: { ziele: [2, 3, 4], lohn: [70, 110, 170], text: function (n) { return 'COMBO X' + n + ' (OHNE BODEN DAZWISCHEN).'; } },
    rang: { ziele: [1, 2, 3], lohn: [90, 160, 240], text: function (n) { return n === 1 ? 'HOL EINMAL RANG S ODER P.' : 'HOL ' + n + 'X RANG S ODER P.'; } },
    ohnetod: { ziele: [1, 2, 2], lohn: [80, 150, 200], text: function (n) { return n === 1 ? 'SCHAFF EIN LEVEL OHNE TOD.' : 'SCHAFF ' + n + ' LEVEL OHNE TOD.'; } },
    essen: { ziele: [5, 10, 16], lohn: [60, 100, 150], text: function (n) { return 'ISS ' + n + ' SACHEN IM VORBEILAUFEN.'; } },
    level: { ziele: [2, 3, 4], lohn: [60, 90, 130], text: function (n) { return 'SCHAFF ' + n + ' LEVEL.'; } },
    boss: { ziele: [1, 2, 2], lohn: [90, 160, 200], text: function (n) { return n === 1 ? 'BESIEGE EINEN BOSS.' : 'BESIEGE ' + n + ' BOSSE.'; } },
    versteck: { ziele: [1, 2, 3], lohn: [80, 140, 200], text: function (n) { return n === 1 ? 'FINDE EIN VERSTECK.' : 'FINDE ' + n + ' VERSTECKE.'; } }
  };
  var AUFTRAG_REIHE = Object.keys(AUFTRAG);

  // Wer den Auftrag schickt: nur Leute, die man schon kennt (ab = Levelindex)
  var JUNGS = [
    { wer: 'HUSEYIN', ab: 0, sagt: ['DISZIPLIN, BRUDER.', 'ICH ZÄHLE MIT.'] },
    { wer: 'MIRKAN', ab: 1, sagt: ['KEINE FRAGEN.', 'FRAG NICHT, WOFÜR.'] },
    { wer: 'LENNART', ab: 2, sagt: ['DAS IST DEIN WARM-UP.', 'GEHST DU AUCH INS GYM?'] },
    { wer: 'ERFAN', ab: 3, sagt: ['MIT SAFRAN.', 'WIE BEI MAMA.'] }
  ];
  var DANKE = ['STARK.', 'RESPEKT.', 'HÖ HÖ HÖÖÖ.', 'HAB ICH GEWUSST.', 'NICHT SCHLECHT, BRUDER.'];

  /* ================= Zustand ================= */

  var st = leer();
  var spielstand = null;      // save aus game.js (nur lesen: freigeschaltete Level)
  var premium = {};           // paket -> true: vom Store bestaetigt. NIE gespeichert.
  var angebote = {};          // paket -> Preis-Text aus dem Store
  var storeStand = 'aus';     // aus | laedt | ok | fehler
  var abfrage = null, letzteAbfrage = 0;

  function leer() {
    return { konto: 0, gesamt: 0, hat: {}, an: { kostuem: 'standard', hut: 'keiner', spur: 'keine' },
             auftraege: [], erledigt: 0, gemeldet: {} };
  }

  function zahl(v, min, max) {
    var x = Math.floor(Number(v));
    return isFinite(x) ? Math.max(min, Math.min(max, x)) : min;
  }

  /** Gespeicherten Stand streng pruefen: kaputte oder von Hand veraenderte
      Daten duerfen nichts kaputt machen. Was nicht passt, faellt weg. */
  function laden() {
    st = leer();
    var raw = global.Speicher.get(KEY), o = null;
    try { o = (typeof raw === 'string' && raw.length < 6000) ? JSON.parse(raw) : null; } catch (e) { o = null; }
    if (!o || typeof o !== 'object') return;
    st.konto = zahl(o.konto, 0, MAX);
    st.gesamt = Math.max(st.konto, zahl(o.gesamt, 0, MAX));
    st.erledigt = zahl(o.erledigt, 0, 99999);
    WARE.forEach(function (w) {
      // Gekauft werden kann nur Ware fuer Honig. Pakete stehen hier nie drin.
      if (w.preis > 0 && o.hat && typeof o.hat === 'object' && hat(o.hat, w.id) && o.hat[w.id] === 1) st.hat[w.id] = 1;
      if (o.gemeldet && typeof o.gemeldet === 'object' && hat(o.gemeldet, w.id) && o.gemeldet[w.id] === 1) st.gemeldet[w.id] = 1;
    });
    if (o.an && typeof o.an === 'object') {
      Object.keys(STANDARD).forEach(function (a) {
        var w = hat(o.an, a) ? ware(o.an[a]) : null;
        if (w && w.art === a) st.an[a] = w.id;
      });
    }
    if (Array.isArray(o.auftraege)) {
      o.auftraege.slice(0, 3).forEach(function (a) {
        var x = auftragPruefen(a);
        if (x && !st.auftraege.some(function (y) { return y.id === x.id; })) st.auftraege.push(x);
      });
    }
  }

  function speichern() {
    global.Speicher.set(KEY, JSON.stringify({
      v: 1, konto: st.konto, gesamt: st.gesamt, hat: st.hat, an: st.an,
      auftraege: st.auftraege, erledigt: st.erledigt, gemeldet: st.gemeldet
    }));
  }

  /* ================= Besitz und Anziehen ================= */

  function besitzt(w) {
    if (!w) return false;
    if (w.paket) return premium[w.paket] === true;
    return !w.preis || st.hat[w.id] === 1;
  }

  /** Was Yusuf wirklich traegt: Angezogenes nur, wenn es ihm gehoert.
      (Ein Paket, das der Store gerade nicht bestaetigt, faellt auf die
      Jeansjacke zurueck — offline, nach einer Erstattung, bei Bastelei.) */
  function getragen(art) {
    var w = ware(st.an[art]);
    return (w && w.art === art && besitzt(w)) ? w.id : STANDARD[art];
  }

  function anwenden() {
    var k = getragen('kostuem'), h = getragen('hut');
    if (P && P.tracht) P.tracht(k === 'standard' ? null : k, h === 'keiner' ? null : h);
  }

  /* ================= Der Store der Plattform =================
     window.balciStore kommt von der Huelle (nie vom Spiel selbst):
       plattform           'steam' | 'android' | 'ios'
       besitz()            Promise -> { paket: true } (vom Store geprueft)
       angebote()          Promise -> { paket: { preis, betrag, waehrung } }
       kaufen(paket, o)    Promise -> { status: gekauft | abgebrochen |
                           ausstehend | offen | fehler, grund }
                           (offen = Steam: die Shop-Seite ist auf, wir warten)
       wiederherstellen()  Promise -> { paket: true } */

  function store() {
    var s = global.balciStore;
    return (s && typeof s === 'object' && typeof s.besitz === 'function' && typeof s.kaufen === 'function') ? s : null;
  }

  function rufe(s, name, args) {
    try {
      if (typeof s[name] !== 'function') return Promise.reject(new Error('fehlt'));
      return Promise.resolve(s[name].apply(s, args || []));
    } catch (e) { return Promise.reject(e); }
  }

  function mitZeit(promise, ms) {
    return new Promise(function (ja, nein) {
      var fertig = false;
      var t = setTimeout(function () { if (!fertig) { fertig = true; nein(new Error('zeit')); } }, ms);
      promise.then(function (v) { if (!fertig) { fertig = true; clearTimeout(t); ja(v); } },
                   function (e) { if (!fertig) { fertig = true; clearTimeout(t); nein(e); } });
    });
  }

  /** Nur bekannte Pakete, nur ein echtes true. */
  function nurPakete(o) {
    var out = {};
    if (!o || typeof o !== 'object') return out;
    PAKET_REIHE.forEach(function (k) { if (hat(o, k) && o[k] === true) out[k] = true; });
    return out;
  }

  /** Besitz beim Store erfragen. Klappt das nicht (offline), bleibt es
      bei dem, was der Store in dieser Sitzung zuletzt gesagt hat. */
  function besitzAbfragen() {
    var s = store();
    if (!s) { storeStand = 'aus'; premium = {}; anwenden(); return Promise.resolve(); }
    if (abfrage) return abfrage;
    if (storeStand !== 'ok') storeStand = 'laedt';
    letzteAbfrage = Date.now();
    abfrage = mitZeit(rufe(s, 'besitz'), 15000).then(function (o) {
      premium = nurPakete(o);
      storeStand = 'ok';
    }, function () {
      if (storeStand !== 'ok') storeStand = 'fehler';
    }).then(function () { abfrage = null; anwenden(); });
    return abfrage;
  }

  /** Preis so, dass ihn die Pixelschrift zeigen kann. Sonst Betrag + Code. */
  function preisText(a) {
    if (!a || typeof a !== 'object') return null;
    if (typeof a.preis === 'string') {
      // Nur, was nach einem Preis aussieht: Ziffern, Buchstaben (Waehrungs-
      // codes), Trennzeichen und die Waehrungszeichen der Schrift
      var t = a.preis.replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/\$/g, '¤').replace(/^\s+|\s+$/g, '');
      if (/^[0-9A-Za-z .,'€£¥¤-]{1,16}$/.test(t) && /[0-9]/.test(t) && F.has(t)) return t;
    }
    if (typeof a.betrag === 'number' && isFinite(a.betrag) && a.betrag >= 0 && a.betrag < 100000 &&
        typeof a.waehrung === 'string' && /^[A-Z]{3}$/.test(a.waehrung)) {
      return a.betrag.toFixed(2) + ' ' + a.waehrung;
    }
    return null;
  }

  function angeboteAbfragen() {
    var s = store();
    if (!s || typeof s.angebote !== 'function') return;
    mitZeit(rufe(s, 'angebote'), 15000).then(function (o) {
      var neu = {};
      if (o && typeof o === 'object') {
        PAKET_REIHE.forEach(function (k) { var t = hat(o, k) ? preisText(o[k]) : null; if (t) neu[k] = t; });
      }
      angebote = neu;
    }, function () {});
  }

  var PLATTFORM = {
    steam: { ueber: 'ÜBER STEAM', zu: 'ZU STEAM', von: 'VON STEAM' },
    android: { ueber: 'ÜBER GOOGLE PLAY', zu: 'ZU GOOGLE PLAY', von: 'VON GOOGLE PLAY' },
    ios: { ueber: 'ÜBER DEN APP STORE', zu: 'ZUM APP STORE', von: 'VOM APP STORE' }
  };
  /** 'ueber' | 'zu' | 'von' + Name des Stores, grammatisch passend. */
  function pf(fall) {
    var s = store();
    var p = (s && typeof s.plattform === 'string' && hat(PLATTFORM, s.plattform)) ? PLATTFORM[s.plattform]
          : { ueber: 'ÜBER DEN STORE', zu: 'ZUM STORE', von: 'VOM STORE' };
    return p[fall];
  }

  /* Kommt das Spiel wieder nach vorne (anderes Fenster, App gewechselt,
     Steam-Overlay zu): Besitz neu fragen — dort wird gekauft, erstattet,
     wiederhergestellt. Hoechstens alle 5 Sekunden. */
  function wiederDa() {
    if (document.hidden) return;
    if (store() && Date.now() - letzteAbfrage > 5000) besitzAbfragen();
  }

  /* ================= Honigkonto ================= */

  function gutschreiben(n) {
    n = zahl(n, 0, MAX);
    st.konto = Math.min(MAX, st.konto + n);
    st.gesamt = Math.min(MAX, st.gesamt + n);
  }

  /** Am Levelende (aus game.js recordBest, nach Spass.levelFertig — der
      Rang steht dann schon fest). Nur einmal pro Durchlauf eines Levels. */
  function levelFertig(G, idx) {
    var kennung = idx + ':' + (G.levelZaehler || 0);
    if (G.shopFuer === kennung) return;
    G.shopFuer = kennung;
    var p = G.player, s0 = G.levelStart || { honey: 0, eatCount: 0 };
    if (!p) return;
    var honig = Math.max(0, (p.honey || 0) - (s0.honey || 0));
    var gold = G.goldCount ? G.goldCount() : 0;
    var rang = (G.letzterRang && G.letzterRang.k) ? G.letzterRang.k.n : 0;
    var bonusGold = gold * GOLD_BONUS, bonusRang = RANG_BONUS[rang] || 0;
    var summe = honig + bonusGold + bonusRang;
    var vorher = st.konto;
    gutschreiben(summe);
    G.honigKonto = { honig: honig, gold: bonusGold, rang: bonusRang, summe: summe, vorher: vorher };

    // Auftraege, die erst am Levelende zaehlen (so bringt Sterben und
    // Nochmal-Einsammeln nichts doppelt). Nur die, die schon vor dem
    // Levelende da waren — ein gerade nachgerueckter Auftrag faengt bei 0 an.
    var lvl = LV().list[idx], alte = st.auftraege.slice();
    function m(id, n) { melden(G, id, n, alte); }
    m('honig', honig);
    m('gold', gold);
    m('level', 1);
    if ((G.levelTode || 0) === 0) m('ohnetod', 1);
    if (rang >= 3) m('rang', 1);
    if (lvl && lvl.boss) m('boss', 1);
    m('essen', Math.max(0, (p.eatCount || 0) - (s0.eatCount || 0)));
    var stS = global.Strecke && global.Strecke.stand ? global.Strecke.stand(G) : null;
    if (stS && stS.gefunden) m('versteck', stS.gefunden);
    speichern();
    neuLeistbar(G);
  }

  /** Das Billigste, was man sich jetzt neu leisten kann, einmal melden. */
  function neuLeistbar(G) {
    var neu = WARE.filter(function (w) { return w.preis > 0 && !besitzt(w) && !st.gemeldet[w.id] && w.preis <= st.konto; });
    if (!neu.length) return;
    neu.sort(function (a, b) { return a.preis - b.preis; });
    neu.forEach(function (w) { st.gemeldet[w.id] = 1; });
    speichern();
    if (G.toasts) {
      G.toasts.push({ art: 'text', zeile1: 'GENUG HONIG FÜR: ' + neu[0].name + (neu.length > 1 ? ' UND MEHR' : '') + '!',
                      zeile2: 'AB IN DEN SHOP (HAUPTMENÜ).', col: GOLD, zeit: 180 });
    }
  }

  /** Was man sich als Naechstes leisten koennte (fuer den Ergebnis-Bildschirm). */
  function naechstesZiel() {
    var offen = WARE.filter(function (w) { return w.preis > 0 && !besitzt(w); });
    if (!offen.length) return null;
    offen.sort(function (a, b) { return a.preis - b.preis; });
    var leistbar = offen.filter(function (w) { return w.preis <= st.konto; });
    if (leistbar.length) return { ware: leistbar[leistbar.length - 1], fehlt: 0 };
    return { ware: offen[0], fehlt: offen[0].preis - st.konto };
  }

  /* ================= Auftraege ================= */

  function stufe() {
    var u = spielstand ? spielstand.unlocked : 1;
    return u <= 6 ? 0 : (u <= 18 ? 1 : 2);
  }

  function auftragPruefen(a) {
    if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !hat(AUFTRAG, a.id)) return null;
    var t = AUFTRAG[a.id], s = zahl(a.stufe, 0, 2);
    return { id: a.id, stufe: s, ziel: t.ziele[s], stand: zahl(a.stand, 0, t.ziele[s] - 1),
             wer: zahl(a.wer, 0, JUNGS.length - 1), satz: zahl(a.satz, 0, 1) };
  }

  /** Kann man diesen Auftrag mit den freien Leveln ueberhaupt schaffen? */
  function machbar(id) {
    var n = spielstand ? Math.min(LV().list.length, spielstand.unlocked) : 1;
    var i;
    if (id === 'versteck') {
      for (i = 0; i < n; i++) if ((LV().list[i].verstecke || []).length) return true;
      return false;
    }
    if (id === 'boss') {
      for (i = 0; i < n; i++) if (LV().list[i].boss) return true;
      return false;
    }
    return true;
  }

  function neuerAuftrag() {
    var vergeben = st.auftraege.map(function (a) { return a.id; });
    var frei = AUFTRAG_REIHE.filter(function (id) { return vergeben.indexOf(id) < 0 && machbar(id); });
    if (!frei.length) return null;
    var id = rnd(frei), s = stufe();
    var u = spielstand ? spielstand.unlocked : 1;
    var jungs = [];
    JUNGS.forEach(function (j, i) { if (u > j.ab) jungs.push(i); });
    return { id: id, stufe: s, ziel: AUFTRAG[id].ziele[s], stand: 0, wer: rnd(jungs.length ? jungs : [0]),
             satz: (Math.random() * 2) | 0 };
  }

  function auffuellen() {
    var geaendert = false;
    while (st.auftraege.length < 3) {
      var a = neuerAuftrag();
      if (!a) break;
      st.auftraege.push(a);
      geaendert = true;
    }
    return geaendert;
  }

  function lohn(a) { return AUFTRAG[a.id].lohn[a.stufe]; }

  function auftragText(a) { return AUFTRAG[a.id].text(a.ziel); }

  /** Ereignis aus dem Spiel. combo zaehlt den hoechsten Wert, alles andere
      wird aufaddiert. nur: zaehlt nur fuer diese Auftraege (Levelende). */
  function melden(G, id, n, nur) {
    n = zahl(n, 0, 100000);
    if (!n) return;
    var fertig = [];
    st.auftraege.forEach(function (a) {
      if (a.id !== id || (nur && nur.indexOf(a) < 0)) return;
      a.stand = (id === 'combo') ? Math.max(a.stand, n) : a.stand + n;
      if (a.stand >= a.ziel) fertig.push(a);
    });
    if (!fertig.length) return;
    fertig.forEach(function (a) {
      var l = lohn(a);
      gutschreiben(l);
      st.erledigt++;
      st.auftraege.splice(st.auftraege.indexOf(a), 1);
      if (G && G.toasts) {
        G.toasts.push({ art: 'text', zeile1: 'AUFTRAG ERLEDIGT! +' + l + ' HONIG',
                        zeile2: JUNGS[a.wer].wer + ': ' + rnd(DANKE), col: GRUEN, zeit: 170 });
      }
      if (S()) S().play('oneUp');
    });
    auffuellen();
    speichern();
  }

  function ablehnen(G, i) {
    var a = st.auftraege[i];
    if (!a) return;
    st.auftraege.splice(i, 1);
    // Der neue soll ein anderer sein als der abgelehnte
    var neu = null;
    for (var v = 0; v < 6 && (!neu || neu.id === a.id); v++) neu = neuerAuftrag();
    if (neu) st.auftraege.splice(i, 0, neu);
    auffuellen();
    speichern();
    meldung(G, 'ABGELEHNT. ' + (neu ? JUNGS[neu.wer].wer + ' HAT WAS NEUES.' : ''), GRAU);
    S().play('move');
  }

  /* ================= Ereignisse aus dem Spiel ================= */

  function gegnerWeg(G) {
    melden(G, 'gegner', 1);
    if (G.stampfer) melden(G, 'stampfer', 1);
    if (G.combo >= 2) melden(G, 'combo', G.combo);
  }

  /* Spuren: was hinter Yusuf herfliegt, wenn er laeuft oder springt */
  var KONFETTI = ['#ff4a8a', '#ffd257', '#6fc8e8', '#8cd85a', '#c88aff'];
  var SPUR = {
    honig: { takt: 5, teil: function (x, y, vx) {
      return { x: x, y: y - 4, vx: vx * 0.1, vy: 0.3, life: 32, col: '#ffc23c', size: 2, grav: 0.14 }; } },
    blasen: { takt: 7, teil: function (x, y) {
      return { x: x, y: y - 10, vx: (Math.random() - 0.5) * 0.4, vy: -0.45, life: 54, col: '#bfe8ff', size: 3, grav: -0.004 }; } },
    herzen: { takt: 10, teil: function (x, y) {
      return { x: x - 2, y: y - 16, vx: (Math.random() - 0.5) * 0.3, vy: -0.5, life: 46, col: '#ff7aa8', text: '$', grav: -0.004 }; } },
    konfetti: { takt: 3, teil: function (x, y) {
      return { x: x, y: y - 12, vx: (Math.random() - 0.5) * 1.6, vy: -0.6 - Math.random(), life: 40, col: rnd(KONFETTI), size: 2, grav: 0.06 }; } },
    goldstaub: { takt: 3, teil: function (x, y) {
      return { x: x + (Math.random() - 0.5) * 12, y: y - Math.random() * 26, vx: 0, vy: -0.2, life: 30, col: '#ffe38a', size: 2, grav: -0.004 }; } }
  };

  /** Jeden Tick im Spiel (game.js updateWorld): die Spur. */
  function tick(G) {
    var id = getragen('spur'), sp = SPUR[id];
    var p = G.player;
    if (!sp || !p || p.dead || !G.lvl) return;
    var zuFuss = !G.lvl.bike && !G.scene && !G.eat && !(G.modus && G.modMod && G.modMod.full);
    if (!zuFuss || (Math.abs(p.vx) < 0.6 && p.grounded)) return;
    if (G.tick % sp.takt) return;
    G.particles.spawn(sp.teil(p.cx() - p.facing * 7, p.feet(), -p.vx));
  }

  /* ================= Der Shop-Bildschirm ================= */

  var ALLE_TABS = [
    { k: 'kostuem', name: 'KOSTÜME' }, { k: 'hut', name: 'HÜTE' }, { k: 'spur', name: 'SPUREN' },
    { k: 'pakete', name: 'EXTRAS' }, { k: 'auftraege', name: 'AUFTRÄGE' }
  ];
  /* Die Web-Demo hat keine Pakete fuer echtes Geld: kein Reiter EXTRAS,
     keine Paket-Ware in den Listen (die Steam- und App-Versionen gibt es
     noch nicht, also verspricht die Demo auch nichts davon). */
  function ohnePakete() { return !!global.BALCI_DEMO; }
  var TABS = ALLE_TABS;
  function tabsSetzen() { TABS = ohnePakete() ? ALLE_TABS.filter(function (t) { return t.k !== 'pakete'; }) : ALLE_TABS; }
  function tabNr(k) { for (var i = 0; i < TABS.length; i++) if (TABS[i].k === k) return i; return 0; }

  function zeilen(G) {
    var t = TABS[Math.min(G.shop.tab, TABS.length - 1)].k;
    if (t === 'pakete') {
      var l = PAKET_REIHE.map(function (k) { return { k: 'paket', paket: k }; });
      l.push({ k: 'wieder' });
      return l;
    }
    if (t === 'auftraege') return st.auftraege.map(function (a, i) { return { k: 'auftrag', i: i }; });
    return WARE.filter(function (w) { return w.art === t && !(w.paket && ohnePakete()); })
               .map(function (w) { return { k: 'ware', ware: w }; });
  }

  function oeffnen(G, zurueck) {
    tabsSetzen();
    G.shop = { tab: 0, sel: [0, 0, 0, 0, 0], zurueck: zurueck || 'title', t: 0, dialog: null, kauf: null,
               meldung: null, jubel: 0, teile: [] };
    // Die Auswahl steht auf dem, was er gerade anhat
    TABS.forEach(function (tb, ti) {
      if (!STANDARD[tb.k]) return;
      var l = WARE.filter(function (w) { return w.art === tb.k; });
      for (var i = 0; i < l.length; i++) if (l[i].id === getragen(tb.k)) G.shop.sel[ti] = i;
    });
    if (auffuellen()) speichern();
    G.state = 'shop';
    if (store()) {
      if (Date.now() - letzteAbfrage > 30000 || storeStand !== 'ok') besitzAbfragen();
      angeboteAbfragen();
    }
  }

  function schliessen(G) {
    var z = G.shop && G.shop.zurueck;
    G.shop = null;
    G.state = z || 'title';
    S().play('select');
  }

  function meldung(G, text, col) {
    if (G.shop) G.shop.meldung = { text: text, col: col || HELL, t: 200 };
  }

  /* --- Kaufen mit Honig --- */

  function honigKauf(G, w) {
    if (besitzt(w)) return;
    if (st.konto < w.preis) {
      meldung(G, 'ZU WENIG HONIG. ES FEHLEN NOCH ' + (w.preis - st.konto) + '.', ROT);
      S().play('move');
      return;
    }
    st.konto -= w.preis;
    st.hat[w.id] = 1;
    st.gemeldet[w.id] = 1;
    st.an[w.art] = w.id;
    speichern();
    anwenden();
    meldung(G, w.name + ': GEKAUFT UND ANGEZOGEN!', GRUEN);
    G.shop.jubel = 50;
    S().play('oneUp');
  }

  function anziehen(G, w) {
    if (!besitzt(w)) return;
    if (st.an[w.art] === w.id) { meldung(G, 'HAT ER SCHON AN.', GRAU); return; }
    st.an[w.art] = w.id;
    speichern();
    anwenden();
    meldung(G, w.name + ' ANGEZOGEN.', GRUEN);
    S().play('select');
  }

  /* --- Kaufen mit echtem Geld (nur ueber den Store) --- */

  function paketKauf(G, paket) {
    var s = store();
    if (!s) { meldung(G, 'GIBT ES NUR IN DER STEAM-, ANDROID- UND IPHONE-VERSION.', GRAU); return; }
    if (G.shop.kauf) return;                 // es laeuft schon einer
    if (premium[paket]) { meldung(G, 'SCHON GEKAUFT. DANKE!', GRUEN); return; }
    G.shop.kauf = { paket: paket, stand: 'laeuft', t: 0 };
    mitZeit(rufe(s, 'kaufen', [paket]), 180000).then(function (r) {
      var k = G.shop && G.shop.kauf;
      if (!k) return;
      var status = (r && typeof r === 'object') ? r.status : null;
      if (status === 'offen') { k.stand = 'offen'; k.t = 0; return; }
      if (status === 'abgebrochen') { G.shop.kauf = null; meldung(G, 'ABGEBROCHEN. NICHTS PASSIERT.', GRAU); return; }
      if (status === 'ausstehend') {
        G.shop.kauf = null;
        meldung(G, 'ZAHLUNG STEHT NOCH AUS. IST SIE DA, IST DAS PAKET FREI.', HELL);
        return;
      }
      if (status === 'fehler') {
        G.shop.kauf = null;
        meldung(G, r.grund === 'netz' ? 'KEINE VERBINDUNG ' + pf('zu') + '.' :
                   r.grund === 'nicht_erlaubt' ? 'KÄUFE SIND AUF DIESEM GERÄT GESPERRT.' :
                   r.grund === 'kein_steam' ? 'STEAM LÄUFT NICHT. STARTE DAS SPIEL ÜBER STEAM.' :
                   r.grund === 'nicht_im_store' ? 'DIESES PAKET GIBT ES IM STORE NOCH NICHT.' :
                   'DAS HAT NICHT GEKLAPPT. SPÄTER NOCHMAL.', ROT);
        return;
      }
      // gekauft (oder unklar): Freigeschaltet wird erst, wenn der Store
      // den Besitz bestaetigt.
      k.stand = 'pruefen';
      return besitzAbfragen().then(function () { kaufPruefen(G, paket, true); });
    }, function () {
      if (!G.shop || !G.shop.kauf) return;
      G.shop.kauf = null;
      meldung(G, 'KEINE ANTWORT ' + pf('von') + '. SPÄTER NOCHMAL SCHAUEN.', ROT);
    });
  }

  function kaufPruefen(G, paket, endgueltig) {
    var k = G.shop && G.shop.kauf;
    if (premium[paket]) {
      if (G.shop) {
        G.shop.kauf = null;
        G.shop.jubel = 90;
        meldung(G, 'DANKE! ' + PAKETE[paket].name + ' IST FREI.', GRUEN);
      }
      if (S()) S().play('trophaee');
      return true;
    }
    if (endgueltig && k) {
      G.shop.kauf = null;
      meldung(G, 'NOCH NICHT BESTÄTIGT. KOMMT GLEICH (SONST: WIEDERHERSTELLEN).', HELL);
    }
    return false;
  }

  function wiederherstellen(G) {
    var s = store();
    if (!s) { meldung(G, 'GIBT ES NUR IN DER STEAM-, ANDROID- UND IPHONE-VERSION.', GRAU); return; }
    if (G.shop.kauf) return;
    G.shop.kauf = { stand: 'wieder', t: 0 };
    mitZeit(rufe(s, typeof s.wiederherstellen === 'function' ? 'wiederherstellen' : 'besitz'), 60000).then(function (o) {
      premium = nurPakete(o);
      storeStand = 'ok';
      letzteAbfrage = Date.now();
      anwenden();
      if (!G.shop) return;
      G.shop.kauf = null;
      var n = Object.keys(premium).length;
      meldung(G, n ? 'WIEDERHERGESTELLT: ' + n + (n > 1 ? ' PAKETE.' : ' PAKET.') : 'KEINE KÄUFE GEFUNDEN.', n ? GRUEN : GRAU);
      if (n) S().play('select');
    }, function () {
      if (!G.shop) return;
      G.shop.kauf = null;
      meldung(G, 'WIEDERHERSTELLEN HAT NICHT GEKLAPPT.', ROT);
    });
  }

  /* --- Bedienung --- */

  function aktion(G, z) {
    if (!z) return;
    if (z.k === 'ware') {
      var w = z.ware;
      if (besitzt(w)) { anziehen(G, w); return; }
      if (w.paket) {
        // Pakete werden im Tab EXTRAS gekauft
        G.shop.tab = tabNr('pakete');
        G.shop.sel[G.shop.tab] = PAKET_REIHE.indexOf(w.paket);
        S().play('move');
        return;
      }
      if (st.konto < w.preis) { honigKauf(G, w); return; }
      G.shop.dialog = { art: 'honig', ware: w, ja: true };
      S().play('select');
    } else if (z.k === 'paket') {
      if (premium[z.paket]) { meldung(G, 'SCHON GEKAUFT. DIE SACHEN STEHEN BEI KOSTÜMEN, HÜTEN, SPUREN.', GRUEN); return; }
      if (!store()) { meldung(G, 'GIBT ES NUR IN DER STEAM-, ANDROID- UND IPHONE-VERSION.', GRAU); return; }
      // Echtes Geld: immer erst fragen, NEIN ist vorausgewaehlt
      G.shop.dialog = { art: 'geld', paket: z.paket, ja: false };
      S().play('select');
    } else if (z.k === 'wieder') {
      wiederherstellen(G);
    } else if (z.k === 'auftrag') {
      G.shop.dialog = { art: 'ablehnen', i: z.i, ja: false };
      S().play('select');
    }
  }

  function dialogJa(G) {
    var d = G.shop.dialog;
    G.shop.dialog = null;
    if (d.art === 'honig') honigKauf(G, d.ware);
    else if (d.art === 'geld') paketKauf(G, d.paket);
    else if (d.art === 'ablehnen') ablehnen(G, d.i);
  }

  /* Wo was liegt — Zeichnen und Antippen benutzen dieselben Masse */
  var LISTE = { x: 192, y: 56, w: 308, zeile: 16 };
  function tabRect(i) { return { x: 12 + i * 98, y: 32, w: 94, h: 15 }; }
  function zeileRect(G, i) {
    var h = TABS[G.shop.tab].k === 'auftraege' ? 54 : LISTE.zeile;
    return { x: LISTE.x, y: LISTE.y + i * h, w: LISTE.w, h: h - 2 };
  }
  function zurueckRect() { return { x: 512 - 82, y: 6, w: 74, h: 17 }; }
  /** Auf breiten Handys ist das Menue breiter als 512: der Shop steht mittig. */
  function versatz(W) { return Math.max(0, Math.round(((W || 512) - 512) / 2)); }
  function dialogKnoepfe(W) { return [{ x: W / 2 - 92, y: 172, w: 84, h: 22 }, { x: W / 2 + 8, y: 172, w: 84, h: 22 }]; }
  function kaufKnoepfe(W) { return [{ x: W / 2 - 112, y: 176, w: 104, h: 22 }, { x: W / 2 + 8, y: 176, w: 104, h: 22 }]; }
  function inRect(tp, r) { return tp && tp.x >= r.x && tp.x < r.x + r.w && tp.y >= r.y && tp.y < r.y + r.h; }

  function update(G, W) {
    var sh = G.shop, I = In();
    if (!sh) { G.state = 'title'; return; }
    W = W || 512;
    sh.t++;
    if (sh.meldung && --sh.meldung.t <= 0) sh.meldung = null;
    if (sh.jubel > 0) sh.jubel--;
    vorschauTeile(G);
    var tp = I.tap();

    // Ein Kauf laeuft: nur Steam laesst hier etwas tun (Seite nochmal
    // oeffnen, warten beenden). Alles andere wartet auf den Store.
    if (sh.kauf) {
      var k = sh.kauf;
      k.t++;
      if (k.stand === 'offen') {
        // Steam: alle 2 Sekunden schauen, ob das DLC schon da ist
        if (k.t % 120 === 60) besitzAbfragen().then(function () { kaufPruefen(G, k.paket, false); });
        if (k.t > 60 * 600) { sh.kauf = null; meldung(G, 'NICHTS GEKAUFT. ODER ES DAUERT: SPÄTER WIEDERHERSTELLEN.', GRAU); return; }
        var kb = kaufKnoepfe(W), wahl = -1;
        if (tp) { if (inRect(tp, kb[0])) wahl = 0; else if (inRect(tp, kb[1])) wahl = 1; }
        if (I.hit('left') || I.hit('right')) { k.knopf = k.knopf ? 0 : 1; S().play('move'); }
        if (I.hit('back') || I.hit('pause')) wahl = 1;
        else if (!tp && (I.hit('jump') || I.hit('confirm'))) wahl = k.knopf || 0;
        if (wahl === 0) {
          // Nochmal oeffnen — beim zweiten Mal im Steam-Client statt im Overlay
          rufe(store() || {}, 'kaufen', [k.paket, { client: true }]).then(function () {}, function () {});
          S().play('select');
        } else if (wahl === 1) {
          sh.kauf = null;
          besitzAbfragen().then(function () { kaufPruefen(G, k.paket, false); });
          S().play('select');
        }
      }
      return;
    }

    // Nachfrage (kaufen? ablehnen?)
    if (sh.dialog) {
      var db = dialogKnoepfe(W);
      if (tp) {
        if (inRect(tp, db[0])) dialogJa(G);
        else if (inRect(tp, db[1])) { sh.dialog = null; S().play('move'); }
        return;
      }
      if (I.hit('left') || I.hit('right') || I.hit('up') || I.hit('down')) { sh.dialog.ja = !sh.dialog.ja; S().play('move'); }
      if (I.hit('back') || I.hit('pause')) { sh.dialog = null; S().play('move'); return; }
      if (I.hit('jump') || I.hit('confirm')) {
        if (sh.dialog.ja) dialogJa(G); else { sh.dialog = null; S().play('move'); }
      }
      return;
    }

    var l = zeilen(G), n = l.length, i;
    if (tp) {
      tp = { x: tp.x - versatz(W), y: tp.y };   // Reiter, Zeilen, ZURUECK liegen im mittigen 512er-Feld
      if (inRect(tp, zurueckRect())) { schliessen(G); return; }
      for (i = 0; i < TABS.length; i++) {
        if (inRect(tp, tabRect(i))) {
          if (sh.tab !== i) { sh.tab = i; S().play('move'); }
          return;
        }
      }
      for (i = 0; i < n; i++) {
        if (inRect(tp, zeileRect(G, i))) {
          if (sh.sel[sh.tab] === i) aktion(G, l[i]);
          else { sh.sel[sh.tab] = i; S().play('move'); }
          return;
        }
      }
      return;   // daneben getippt: nichts
    }

    // Zurueck zuerst: B am Controller ist auch "Sprung"
    if (I.hit('back') || I.hit('pause')) { schliessen(G); return; }
    if (I.hit('left')) { sh.tab = (sh.tab + TABS.length - 1) % TABS.length; S().play('move'); return; }
    if (I.hit('right')) { sh.tab = (sh.tab + 1) % TABS.length; S().play('move'); return; }
    if (n) {
      if (sh.sel[sh.tab] >= n) sh.sel[sh.tab] = n - 1;
      if (I.hit('down')) { sh.sel[sh.tab] = (sh.sel[sh.tab] + 1) % n; S().play('move'); }
      if (I.hit('up')) { sh.sel[sh.tab] = (sh.sel[sh.tab] + n - 1) % n; S().play('move'); }
      if (I.hit('jump') || I.hit('confirm')) aktion(G, l[sh.sel[sh.tab]]);
    }
  }

  /* --- Vorschau: was er anhaette, wenn ... --- */

  function vorschauTracht(G) {
    var sh = G.shop, z = zeilen(G)[sh.sel[sh.tab]];
    var k = getragen('kostuem'), h = getragen('hut'), sp = getragen('spur');
    if (z && z.k === 'ware') {
      if (z.ware.art === 'kostuem') k = z.ware.id;
      else if (z.ware.art === 'hut') h = z.ware.id;
      else sp = z.ware.id;
    } else if (z && z.k === 'paket') {
      var v = PAKETE[z.paket].vorschau, j = Math.floor(sh.t / 120) % v.length;
      k = v[j][0]; h = v[j][1];
      if (z.paket === 'unterstuetzer') sp = 'goldstaub';
    }
    return { kostuem: k === 'standard' ? null : k, hut: h === 'keiner' ? null : h, spur: sp };
  }

  // Die Buehne: Yusuf laeuft auf der Stelle, damit man Spur und Kostuem in Bewegung sieht
  var BUEHNE = { x: 96, y: 206 };
  function vorschauPose(t) {
    var phase = Math.floor(t / 90) % 4;
    if (phase === 1) return { pose: 'run', frame: t >> 3, laeuft: true };
    if (phase === 3) return { pose: (t % 90) < 45 ? 'jump' : 'fall', frame: 0, laeuft: true, luft: true };
    return { pose: 'idle', frame: t >> 4, laeuft: false };
  }

  function vorschauTeile(G) {
    var sh = G.shop;
    var vt = vorschauTracht(G), pz = vorschauPose(sh.t), sp = SPUR[vt.spur];
    if (sp && pz.laeuft && sh.t % sp.takt === 0) {
      var y0 = BUEHNE.y - (pz.luft ? Math.sin(((sh.t % 90) / 90) * Math.PI) * 28 : 0);
      var teil = sp.teil(BUEHNE.x - 14, y0, -2.2);
      teil.vx = (teil.vx || 0) - 1.1;   // er "laeuft" nach rechts: die Spur zieht nach links weg
      teil.max = teil.life;
      sh.teile.push(teil);
    }
    if (sh.jubel > 40 && sh.t % 2 === 0) {
      sh.teile.push({ x: BUEHNE.x + (Math.random() - 0.5) * 70, y: BUEHNE.y - 90, vx: (Math.random() - 0.5) * 1.2,
                      vy: Math.random(), life: 60, max: 60, col: rnd(KONFETTI), size: 2, grav: 0.05 });
    }
    for (var i = sh.teile.length - 1; i >= 0; i--) {
      var q = sh.teile[i];
      q.x += q.vx; q.y += q.vy; q.vy += q.grav === undefined ? 0.1 : q.grav;
      if (--q.life <= 0 || q.x < 6 || q.x > 186) sh.teile.splice(i, 1);
    }
    if (sh.teile.length > 120) sh.teile.splice(0, sh.teile.length - 120);
  }

  /* --- Zeichnen --- */

  function knopf(ctx, r, text, an) {
    rect(ctx, r.x, r.y, r.w, r.h, an ? 'rgba(92,62,24,0.97)' : 'rgba(38,26,54,0.95)');
    ctx.strokeStyle = an ? '#ffe9a8' : '#ffc23c';
    ctx.lineWidth = an ? 2 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    F.draw(ctx, text, r.x + r.w / 2, r.y + Math.round(r.h / 2) - 3, { color: an ? '#ffffff' : HELL, align: 'center' });
  }

  function icon(ctx, z, x, y) {
    if (z.k === 'ware') {
      var w = z.ware;
      if (w.art === 'kostuem') {
        P.draw(ctx, w.id === 'standard' ? 'y_torso' : 'y_torso_' + w.id, x, y + 1);
      } else if (w.art === 'hut') {
        if (w.id === 'keiner') { F.draw(ctx, '-', x + 8, y + 4, { color: DUNKEL }); return; }
        var h = P.HUETE[w.id], s = P.get(h.spr);
        ctx.save();
        var f = s.h > 12 ? 12 / s.h : 1;
        ctx.translate(x + 10 - Math.round(s.w * f / 2), y + 7 - Math.round(s.h * f / 2));
        ctx.scale(f, f);
        P.draw(ctx, h.spr, 0, 0);
        ctx.restore();
      } else {
        var farbe = { keine: DUNKEL, honig: '#ffc23c', blasen: '#bfe8ff', herzen: '#ff7aa8', konfetti: null, goldstaub: '#ffe38a' }[w.id];
        for (var i = 0; i < 4; i++) {
          rect(ctx, x + 2 + i * 5, y + 9 - (i % 2) * 4, 3, 3, farbe || KONFETTI[i]);
        }
      }
    } else if (z.k === 'paket') {
      P.draw(ctx, 'y_torso_' + PAKETE[z.paket].vorschau[0][0], x, y + 1);
    } else if (z.k === 'wieder') {
      F.draw(ctx, '`', x + 7, y + 4, { color: GRAU });
    }
  }

  function draw(ctx, G, W, H) {
    var sh = G.shop;
    if (!sh) return;
    var LI = global.Licht;
    var grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#160a24'); grd.addColorStop(1, '#2c1636');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

    // Alles bis zur Fusszeile im 512 breiten Feld, auf breiten Handys mittig
    ctx.save();
    ctx.translate(versatz(W), 0);

    // Kopf: SHOP, Konto, zurueck
    F.draw(ctx, 'SHOP', 12, 8, { color: GOLD, scale: 3, shadow: true, shadowColor: '#5e2a10' });
    honigZahl(ctx, '' + st.konto, 100, 12, { color: HELL, scale: 2, shadow: true });
    F.draw(ctx, 'HONIG', 120 + F.measure('' + st.konto, 2, 1), 17, { color: GRAU });
    knopf(ctx, zurueckRect(), G.touch ? '< ZURÜCK' : G.hinweis('ESC = ZURÜCK'), false);

    // Reiter
    for (var ti = 0; ti < TABS.length; ti++) {
      var r = tabRect(ti), an = ti === sh.tab;
      rect(ctx, r.x, r.y, r.w, r.h, an ? 'rgba(255,194,60,0.92)' : 'rgba(255,255,255,0.07)');
      F.draw(ctx, TABS[ti].name, r.x + r.w / 2, r.y + 4, { color: an ? '#2a1438' : LILA, align: 'center' });
    }

    // Buehne mit Yusuf
    var vt = vorschauTracht(G), pz = vorschauPose(sh.t);
    rect(ctx, 12, 54, 172, 182, 'rgba(10,6,16,0.55)');
    if (LI && LI.glow) LI.glow(ctx, BUEHNE.x, BUEHNE.y - 40, 70, '#ffb43c', 0.18);
    rect(ctx, 20, BUEHNE.y, 156, 3, '#5a3a22');
    rect(ctx, 20, BUEHNE.y + 3, 156, 2, '#3a2416');
    for (var qi = 0; qi < sh.teile.length; qi++) {
      var q = sh.teile[qi];
      ctx.globalAlpha = Math.min(1, q.life / ((q.max || 40) * 0.6));
      if (q.text) F.draw(ctx, q.text, q.x, q.y, { color: q.col });
      else rect(ctx, q.x - 1, q.y - 1, q.size || 2, q.size || 2, q.col);
      ctx.globalAlpha = 1;
    }
    var sprung = pz.luft ? Math.round(Math.sin(((sh.t % 90) / 90) * Math.PI) * 28) : 0;
    P.drawChar(ctx, 'yusuf', BUEHNE.x, BUEHNE.y - sprung, {
      pose: pz.pose, frame: pz.frame, face: sh.jubel > 0 ? 'laugh' : 'normal', scale: 3,
      kostuem: vt.kostuem, hut: vt.hut
    });

    // Rechte Seite: die Liste
    var tab = TABS[sh.tab].k, l = zeilen(G);
    if (tab === 'auftraege') drawAuftraege(ctx, G, l);
    else {
      for (var i = 0; i < l.length; i++) {
        var z = l[i], zr = zeileRect(G, i), sel = i === sh.sel[sh.tab];
        if (sel) {
          rect(ctx, zr.x - 4, zr.y - 1, zr.w + 8, zr.h + 2, 'rgba(255,210,87,0.14)');
          if ((G.tick >> 4) % 2 === 0) F.draw(ctx, '|', zr.x - 10, zr.y + 4, { color: GOLD });
        }
        icon(ctx, z, zr.x, zr.y);
        var name = '', rechts = null, rcol = GRAU, glas = false;
        if (z.k === 'ware') {
          var w = z.ware, gehoert = besitzt(w);
          name = w.name;
          if (gehoert && getragen(w.art) === w.id) { rechts = 'AN'; rcol = GRUEN; }
          else if (gehoert) { rechts = 'IM SCHRANK'; rcol = GRAU; }
          else if (w.paket) { rechts = PAKETE[w.paket].name; rcol = BLAU; }
          else { rechts = '' + w.preis; rcol = st.konto >= w.preis ? GOLD : '#8a6a5a'; glas = true; }
          F.draw(ctx, name, zr.x + 26, zr.y + 4, { color: sel ? '#ffffff' : (gehoert ? LILA : '#a898c0') });
        } else if (z.k === 'paket') {
          name = PAKETE[z.paket].name;
          if (premium[z.paket]) { rechts = 'GEKAUFT'; rcol = GRUEN; }
          else if (!store()) { rechts = '-'; rcol = DUNKEL; }
          else { rechts = angebote[z.paket] || (store().plattform === 'steam' ? 'IM STEAM-SHOP' : '...'); rcol = BLAU; }
          F.draw(ctx, name, zr.x + 26, zr.y + 4, { color: sel ? '#ffffff' : LILA });
        } else {
          F.draw(ctx, 'KÄUFE WIEDERHERSTELLEN', zr.x + 26, zr.y + 4, { color: sel ? '#ffffff' : GRAU });
        }
        if (rechts && glas) honigZahl(ctx, rechts, zr.x + zr.w, zr.y + 4, { color: rcol, align: 'right' });
        else if (rechts) F.draw(ctx, rechts, zr.x + zr.w, zr.y + 4, { color: rcol, align: 'right' });
      }
      if (tab === 'pakete') drawPaketInfo(ctx, G, l);
    }
    ctx.restore();

    // Unten: Beschreibung, was die Taste tut, Meldungen
    rect(ctx, 0, 242, W, H - 242, 'rgba(10,6,16,0.82)');
    rect(ctx, 0, 242, W, 1, 'rgba(255,194,60,0.5)');
    var fuss = fussText(G, l[sh.sel[sh.tab]]);
    if (fuss[0]) F.draw(ctx, fuss[0], W / 2, 250, { color: LILA, align: 'center' });
    var unten = sh.meldung ? sh.meldung.text : fuss[1];
    if (unten) F.draw(ctx, unten, W / 2, 266, { color: sh.meldung ? sh.meldung.col : GOLD, align: 'center' });

    if (sh.dialog) drawDialogBox(ctx, G, W, H);
    if (sh.kauf) drawKauf(ctx, G, W, H);
  }

  function drawPaketInfo(ctx, G, l) {
    var z = l[G.shop.sel[G.shop.tab]];
    var y = LISTE.y + 3 * LISTE.zeile + 10;
    rect(ctx, LISTE.x - 4, y - 6, LISTE.w + 8, 1, 'rgba(255,255,255,0.12)');
    if (z && z.k === 'paket') {
      var pk = PAKETE[z.paket];
      F.draw(ctx, 'DRIN:', LISTE.x, y, { color: GRAU });
      F.draw(ctx, pk.zeilen[0], LISTE.x, y + 12, { color: HELL });
      F.draw(ctx, pk.zeilen[1], LISTE.x, y + 24, { color: HELL });
    }
    var zeilenInfo;
    var s = store();
    if (!s) zeilenInfo = ['NUR AUSSEHEN, KEIN VORTEIL IM SPIEL.', 'KAUFEN GEHT IN DER STEAM-, ANDROID- UND', 'IPHONE-VERSION.'];
    else zeilenInfo = ['NUR AUSSEHEN, KEIN VORTEIL IM SPIEL.', 'BEZAHLT WIRD ' + pf('ueber') + '.', 'DAS SPIEL SIEHT KEINE ZAHLUNGSDATEN.'];
    for (var i = 0; i < zeilenInfo.length; i++) F.draw(ctx, zeilenInfo[i], LISTE.x, y + 48 + i * 12, { color: MATT });
    if (s && storeStand === 'fehler') F.draw(ctx, 'KEINE VERBINDUNG ' + pf('zu') + '.', LISTE.x, y + 96, { color: ROT });
  }

  function drawAuftraege(ctx, G, l) {
    var sh = G.shop;
    F.draw(ctx, 'AUS DER GRUPPE JUNGS. ERLEDIGT: ' + st.erledigt, LISTE.x, LISTE.y - 6, { color: DUNKEL });
    if (!l.length) {
      F.draw(ctx, 'GERADE KEINE AUFTRÄGE.', LISTE.x, LISTE.y + 20, { color: GRAU });
      return;
    }
    for (var i = 0; i < l.length; i++) {
      var a = st.auftraege[l[i].i], r = zeileRect(G, i), sel = i === sh.sel[sh.tab];
      var j = JUNGS[a.wer];
      rect(ctx, r.x - 4, r.y + 2, r.w + 8, r.h - 2, sel ? 'rgba(255,210,87,0.14)' : 'rgba(255,255,255,0.05)');
      if (sel && (G.tick >> 4) % 2 === 0) F.draw(ctx, '|', r.x - 10, r.y + 18, { color: GOLD });
      F.draw(ctx, j.wer + ':', r.x, r.y + 7, { color: GOLD });
      F.draw(ctx, j.sagt[a.satz] || '', r.x + F.measure(j.wer + ': ', 1, 1), r.y + 7, { color: MATT });
      F.draw(ctx, auftragText(a), r.x, r.y + 19, { color: '#ffffff' });
      // Fortschritt
      var bw = 200, anteil = Math.min(1, a.stand / a.ziel);
      rect(ctx, r.x, r.y + 33, bw, 6, '#2a2436');
      rect(ctx, r.x, r.y + 33, Math.round(bw * anteil), 6, GRUEN);
      F.draw(ctx, a.stand + '/' + a.ziel, r.x + bw + 8, r.y + 32, { color: LILA });
      honigZahl(ctx, '+' + lohn(a), r.x + r.w, r.y + 32, { color: GOLD, align: 'right' });
    }
  }

  function fussText(G, z) {
    var pad = G.mitPad && G.mitPad();
    var ok = G.touch ? 'NOCHMAL TIPPEN' : (pad ? 'A' : 'SPRUNG');
    if (!z) return ['', ''];
    if (z.k === 'ware') {
      var w = z.ware;
      if (besitzt(w)) return [w.text, getragen(w.art) === w.id ? 'HAT ER AN.' : ok + ' = ANZIEHEN'];
      if (w.paket) return [w.text, 'IM ' + PAKETE[w.paket].name + '. ' + ok + ' = ZUM PAKET'];
      if (st.konto < w.preis) return [w.text, 'KOSTET ' + w.preis + ' HONIG. ES FEHLEN NOCH ' + (w.preis - st.konto) + '.'];
      return [w.text, ok + ' = KAUFEN FÜR ' + w.preis + ' HONIG'];
    }
    if (z.k === 'paket') {
      if (premium[z.paket]) return ['GEKAUFT. DANKE, DASS DU YUSUF UNTERSTÜTZT!', 'DIE SACHEN STEHEN BEI KOSTÜMEN, HÜTEN, SPUREN.'];
      if (!store()) return ['ECHTES GELD GIBT ES HIER NICHT: IM BROWSER KANN MAN NICHTS KAUFEN.', ''];
      return ['EINMAL KAUFEN, FÜR IMMER BEHALTEN. ECHTES GELD.', ok + ' = KAUFEN ' + pf('ueber')];
    }
    if (z.k === 'wieder') return ['SCHON GEKAUFT, NEUES GERÄT? HIER HOLST DU ES ZURÜCK.', ok + ' = WIEDERHERSTELLEN'];
    if (z.k === 'auftrag') return ['ERLEDIGT = HONIG AUFS KONTO, DANN KOMMT EIN NEUER.', ok + ' = ABLEHNEN (NEUER AUFTRAG)'];
    return ['', ''];
  }

  function drawDialogBox(ctx, G, W, H) {
    var d = G.shop.dialog;
    rect(ctx, 0, 0, W, H, 'rgba(8,5,12,0.6)');
    var bx = W / 2 - 150, by = 92;
    rect(ctx, bx, by, 300, 112, 'rgba(22,12,34,0.98)');
    ctx.strokeStyle = d.art === 'geld' ? BLAU : '#ffc23c'; ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, 298, 110);
    var z1, z2, z3;
    if (d.art === 'honig') {
      z1 = d.ware.name + ' KAUFEN?'; z2 = 'FÜR ' + d.ware.preis + ' HONIG.'; z3 = 'DANACH BLEIBEN ' + (st.konto - d.ware.preis) + '.';
    } else if (d.art === 'geld') {
      z1 = PAKETE[d.paket].name + ' KAUFEN?';
      z2 = 'MIT ECHTEM GELD' + (angebote[d.paket] ? ': ' + angebote[d.paket] : '') + '.';
      z3 = 'BEZAHLT WIRD ' + pf('ueber') + '.';
    } else {
      var a = st.auftraege[d.i];
      z1 = 'AUFTRAG ABLEHNEN?'; z2 = a ? auftragText(a) : ''; z3 = 'DAFÜR KOMMT EIN NEUER.';
    }
    F.draw(ctx, z1, W / 2, by + 14, { color: d.art === 'geld' ? BLAU : GOLD, align: 'center' });
    F.draw(ctx, z2, W / 2, by + 32, { color: '#ffffff', align: 'center' });
    F.draw(ctx, z3, W / 2, by + 46, { color: GRAU, align: 'center' });
    var kb = dialogKnoepfe(W);
    knopf(ctx, kb[0], 'JA', !G.touch && d.ja);
    knopf(ctx, kb[1], 'NEIN', !G.touch && !d.ja);
  }

  function drawKauf(ctx, G, W, H) {
    var k = G.shop.kauf;
    rect(ctx, 0, 0, W, H, 'rgba(8,5,12,0.7)');
    var bx = W / 2 - 160, by = 96;
    rect(ctx, bx, by, 320, 112, 'rgba(22,12,34,0.98)');
    ctx.strokeStyle = BLAU; ctx.lineWidth = 2;
    ctx.strokeRect(bx + 1, by + 1, 318, 110);
    var punkte = '...'.slice(0, 1 + ((G.tick >> 4) % 3));
    var z1, z2;
    if (k.stand === 'offen') {
      z1 = 'DER STEAM-SHOP IST OFFEN.'; z2 = 'NACH DEM KAUF GEHT ES HIER VON SELBST WEITER' + punkte;
    } else if (k.stand === 'wieder') {
      z1 = 'KÄUFE WERDEN WIEDERHERGESTELLT' + punkte; z2 = 'DAS DAUERT EINEN MOMENT.';
    } else if (k.stand === 'pruefen') {
      z1 = 'KAUF WIRD BESTÄTIGT' + punkte; z2 = 'DIE ZAHLUNG WIRD GEPRÜFT.';
    } else {
      z1 = 'KAUF LÄUFT' + punkte; z2 = 'BITTE IM KAUF-FENSTER ' + pf('von') + ' WEITERMACHEN.';
    }
    F.draw(ctx, z1, W / 2, by + 22, { color: BLAU, align: 'center' });
    F.draw(ctx, z2, W / 2, by + 40, { color: '#ffffff', align: 'center' });
    if (k.stand === 'offen') {
      var kb = kaufKnoepfe(W);
      knopf(ctx, kb[0], 'NOCHMAL ÖFFNEN', !G.touch && !k.knopf);
      knopf(ctx, kb[1], 'FERTIG', !G.touch && k.knopf === 1);
    }
  }

  /* ================= Ergebnis-Bildschirm und Pause ================= */

  /** Wie viel vom Gutgeschriebenen schon hochgezaehlt ist. */
  function gezeigt(hk, timer) {
    return Math.round(hk.summe * Math.max(0, Math.min(1, ((timer || 0) - 24) / 70)));
  }

  /** Nach dem Level: die Zeile fuer die Tabelle (zaehlt hoch), oder null. */
  function ergebnisZeile(G, timer) {
    var hk = G.honigKonto;
    if (!hk) return null;
    return ['AUFS HONIGKONTO', '+' + gezeigt(hk, timer) + (hk.gold || hk.rang ? ' (MIT BONUS)' : '')];
  }

  /** Rechts unter dem Rang: Kontostand und wofuer es (bald) reicht. */
  function drawErgebnis(ctx, G, x, y, timer) {
    var hk = G.honigKonto;
    if (!hk) return;
    // Zaehlt bis zum echten Stand hoch (da sind erledigte Auftraege schon drin)
    F.draw(ctx, 'KONTO:', x, y, { color: GRAU });
    honigZahl(ctx, '' + Math.max(0, st.konto - hk.summe + gezeigt(hk, timer)), x + 42, y, { color: GOLD });
    var nz = naechstesZiel();
    if (!nz) return;
    F.draw(ctx, nz.fehlt ? 'ZIEL: ' + nz.ware.name : 'GENUG FÜR:', x, y + 12, { color: nz.fehlt ? MATT : GRUEN });
    F.draw(ctx, nz.fehlt ? 'NOCH ' + nz.fehlt + ' HONIG' : nz.ware.name + '!', x, y + 23, { color: nz.fehlt ? MATT : GRUEN });
  }

  /** Klingeln, waehrend das Konto hochzaehlt (aus game.js updateClear). */
  function ergebnisTick(G, timer) {
    var hk = G.honigKonto;
    if (!hk || !hk.summe) return;
    if (timer > 24 && timer < 94 && timer % 6 === 0 && S()) S().play('honey', (timer / 6) | 0);
  }

  /** In der Pause oben: die drei Auftraege. */
  function drawPause(ctx, G, W) {
    if (!st.auftraege.length) return;
    var x = W / 2 - 170, y = 10;
    rect(ctx, x - 6, y - 4, 352, 12 + st.auftraege.length * 12, 'rgba(10,6,16,0.9)');
    F.draw(ctx, 'AUFTRÄGE', x, y, { color: GOLD });
    for (var i = 0; i < st.auftraege.length; i++) {
      var a = st.auftraege[i], yy = y + 12 + i * 12;
      F.draw(ctx, JUNGS[a.wer].wer + ': ' + auftragText(a), x, yy, { color: LILA });
      F.draw(ctx, a.stand + '/' + a.ziel, x + 340, yy, { color: a.stand ? GRUEN : GRAU, align: 'right' });
    }
  }

  /* ================= Start ================= */

  /** Stand laden, fehlende Auftraege auffuellen, anziehen. */
  function neuLaden() {
    laden();
    if (auffuellen()) speichern();
    anwenden();
  }

  function init(G, sv) {
    spielstand = sv;
    neuLaden();
    besitzAbfragen();
    document.addEventListener('visibilitychange', wiederDa);
    global.addEventListener('focus', wiederDa);
  }

  global.Shop = {
    init: init,
    oeffnen: oeffnen, update: update, draw: draw,
    levelFertig: levelFertig, gegnerWeg: gegnerWeg, tick: tick,
    drawErgebnis: drawErgebnis, ergebnisZeile: ergebnisZeile, ergebnisTick: ergebnisTick, drawPause: drawPause,
    konto: function () { return st.konto; },
    getragen: getragen,
    besitzt: function (id) { return besitzt(ware(id)); },
    WARE: WARE, PAKETE: PAKETE, AUFTRAG: AUFTRAG,
    // Fuer die Tests (tests/shoptest.html)
    _st: function () { return st; },
    _premium: function () { return premium; },
    _storeStand: function () { return storeStand; },
    _angebote: function () { return angebote; },
    _laden: neuLaden,
    _besitzAbfragen: besitzAbfragen,
    _preisText: preisText,
    _melden: melden,
    _zeilen: zeilen,
    tabs: function () { return TABS.map(function (t) { return t.k; }); }
  };

})(window);
