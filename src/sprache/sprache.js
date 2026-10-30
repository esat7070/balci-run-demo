/* =====================================================================
   sprache.js — andere Sprachen als Deutsch.

   Das Spiel ist auf Deutsch geschrieben, und das bleibt so: Der Spielcode
   enthaelt weiter die deutschen Texte. Eine andere Sprache ist eine
   Tabelle "deutscher Text -> Uebersetzung" (sprache/en.js). Uebersetzt
   wird erst beim Zeichnen (font.js: draw, measure, wrap) und beim Start
   eines Dialogs (game.js: startDialog, wegen der Schreibmaschine). Was
   keine Uebersetzung hat, erscheint einfach auf Deutsch.

   Zusammengesetzte Texte ('WEITER AB LEVEL ' + n) findet die Tabelle so:
     1. genau                      'NEUES SPIEL'
     2. mit Zahlen als {n}         'WEITER AB LEVEL {n}'
     3. Bruchstuecke vorne/hinten  'WEITER AB LEVEL ' + Rest, Rest + ' HONIG)'
        (nur Schluessel, die mit einem Leerzeichen enden bzw. beginnen)
     4. Muster mit {s}             '{s} MUTIERT' (der Teil wird mit uebersetzt)
   Zahlen mit Tausenderpunkt (10.000) werden im Englischen zu 10,000.

   Sprache waehlen: Einstellungen -> SPRACHE (gespeichert mit den anderen
   Einstellungen), oder ?lang=en in der Adresse. Ohne Wahl: Deutsch, wenn
   der Browser/das System Deutsch spricht, sonst Englisch.

   Tests: Sprache.protokoll(true) sammelt alles, was ohne Uebersetzung
   gezeichnet wurde (Sprache.fehlend()).
   ===================================================================== */
(function (global) {
  'use strict';

  var SPRACHEN = ['de', 'en'];
  var NAMEN = { de: 'DEUTSCH', en: 'ENGLISH' };   // jede Sprache in sich selbst

  var tabellen = {};          // sprache -> { exakt, zahl, vorne, hinten, muster, werte }
  var aktiv = 'de';
  var cache = new Map();      // Eingabe -> Ausgabe (auch Fehlschlaege)
  var durch = new Set();      // schon uebersetzte Zeilen (aus wrap)
  var proto = null;           // Set der fehlenden Texte, wenn eingeschaltet

  /* Gleiche Aufbereitung wie font.js: Grossbuchstaben, typografische
     Zeichen auf vorhandene Glyphen. Die Tabellen sind schon so aufbereitet. */
  var ALIAS = {
    '—': '-', '–': '-', '−': '-', '’': "'", '‘': "'",
    '“': '"', '”': '"', '„': '"', '…': '...', ' ': ' ',
    '·': '.', '×': '*', '•': '.', '→': '|', '←': '~',
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Á': 'A', 'À': 'A', 'Â': 'A', 'Í': 'I', 'Ì': 'I', 'Î': 'I',
    'Ï': 'I', 'İ': 'I', 'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ç': 'C', 'Ñ': 'N',
    'Ş': 'S', 'Ğ': 'G'
  };
  function norm(str) {
    var s = String(str).toUpperCase(), out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += ALIAS[c] !== undefined ? ALIAS[c] : c;
    }
    return out;
  }

  var ZAHL = /\d+(?:[.,:]\d+)*/g;

  /** Zahl fuer die Zielsprache: 10.000 -> 10,000 und 1,5 -> 1.5 */
  function zahlFuer(z) {
    if (aktiv === 'de') return z;
    if (/^\d{1,3}(?:\.\d{3})+$/.test(z)) return z.replace(/\./g, ',');
    if (/^\d+,\d{1,2}$/.test(z)) return z.replace(',', '.');
    return z;
  }

  /** Neue Tabelle (en.js ruft das auf). eintraege = { 'DEUTSCH': 'ENGLISH' }. */
  function dazu(sprache, eintraege) {
    var t = tabellen[sprache] || (tabellen[sprache] = {
      exakt: Object.create(null), zahl: Object.create(null), muster: [],
      vorne: [], hinten: [], werte: new Set()
    });
    for (var k in eintraege) {
      var v = eintraege[k];
      if (typeof v !== 'string') continue;
      t.werte.add(v);
      if (k.indexOf('{s}') >= 0) {
        // Muster: {s} steht fuer beliebigen Text, der selbst uebersetzt wird
        var teile = k.split('{s}').map(function (p) {
          return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{n\\\}/g, '(\\d+(?:[.,:]\\d+)*)');
        });
        t.muster.push({ re: new RegExp('^' + teile.join('(.+?)') + '$'), aus: v,
                        fest: k.replace(/\{[sn]\}/g, '').length });
      } else if (k.indexOf('{n}') >= 0) {
        t.zahl[k] = v;
      } else {
        t.exakt[k] = v;
        // Bruchstuecke fuer zusammengesetzte Texte (mindestens 5 Buchstaben,
        // sonst greift 'DIE ' auch mitten in englischen Saetzen)
        var buchst = k.replace(/[^A-ZÄÖÜ]/g, '').length;
        if (buchst >= 5 && / $/.test(k) && !/^ /.test(k)) t.vorne.push(k);
        else if (buchst >= 5 && /^ /.test(k) && !/ $/.test(k)) t.hinten.push(k);
      }
    }
    // Genauere Muster zuerst ('RANG {s}: {s}' vor '{s}: {s}')
    t.muster.sort(function (a, b) { return b.fest - a.fest; });
    t.vorne.sort(function (a, b) { return b.length - a.length; });
    t.hinten.sort(function (a, b) { return b.length - a.length; });
    cache.clear();
  }

  function suche(t, s, tiefe) {
    var r = t.exakt[s];
    if (r !== undefined) return r;
    if (t.werte.has(s) || durch.has(s)) return s;
    if (tiefe > 3) return undefined;
    // 2. Zahlen als {n}
    var zahlen = s.match(ZAHL);
    if (zahlen) {
      var schab = s.replace(ZAHL, '{n}');
      var z = t.zahl[schab];
      if (z !== undefined) {
        var i = 0;
        return z.replace(/\{n\}/g, function () { return zahlFuer(zahlen[i++] || ''); });
      }
    }
    // 3. Bruchstuecke
    var j, k, rest, ru;
    for (j = 0; j < t.vorne.length; j++) {
      k = t.vorne[j];
      if (s.length > k.length && s.lastIndexOf(k, 0) === 0) {
        rest = s.slice(k.length);
        ru = suche(t, rest, tiefe + 1);
        return t.exakt[k] + (ru !== undefined ? ru : zahlenNur(rest));
      }
    }
    for (j = 0; j < t.hinten.length; j++) {
      k = t.hinten[j];
      if (s.length > k.length && s.indexOf(k, s.length - k.length) >= 0) {
        rest = s.slice(0, s.length - k.length);
        ru = suche(t, rest, tiefe + 1);
        return (ru !== undefined ? ru : zahlenNur(rest)) + t.exakt[k];
      }
    }
    // 4. Muster mit {s}. Greift nur, wenn jeder Teil selbst eine Uebersetzung
    //    hat (oder ein Name ist) — sonst faellt der Text als fehlend auf.
    for (j = 0; j < t.muster.length; j++) {
      var m = t.muster[j], treffer = m.re.exec(s);
      if (!treffer) continue;
      var g = 1, alleDa = true;
      var aus = m.aus.replace(/\{s\}|\{n\}/g, function (was) {
        var teil = treffer[g++] || '';
        if (was === '{n}') return zahlFuer(teil);
        var u = suche(t, teil, tiefe + 1);
        if (u === undefined) { if (/[A-ZÄÖÜ]{3}/.test(teil)) alleDa = false; return zahlenNur(teil); }
        return u;
      });
      if (alleDa) return aus;
    }
    return undefined;
  }

  /** Text ohne Buchstaben (Zahlen, Zeichen) gilt als uebersetzt. */
  function zahlenNur(s) { return s.replace(ZAHL, zahlFuer); }

  /** Uebersetzung eines schon aufbereiteten Textes (font.js). */
  function tn(s) {
    if (aktiv === 'de' || !s) return s;
    var t = tabellen[aktiv];
    if (!t) return s;
    var c = cache.get(s);
    if (c !== undefined) return c;
    var r = suche(t, s, 0);
    if (r === undefined) {
      r = zahlenNur(s);
      if (proto && /[A-ZÄÖÜ]{3}/.test(s)) proto.add(s);
    }
    if (cache.size > 8000) cache.clear();
    cache.set(s, r);
    return r;
  }

  /** Uebersetzung fuer beliebigen Text (wird erst aufbereitet). */
  function t(str) {
    if (aktiv === 'de' || str === null || str === undefined) return str;
    return tn(norm(str));
  }

  /** Zeilen aus wrap: schon in der Zielsprache, nicht nochmal anfassen. */
  function schonUebersetzt(zeile) {
    if (aktiv === 'de') return;
    if (durch.size > 20000) durch.clear();
    durch.add(zeile);
  }

  /* ---------- Wahl der Sprache ---------- */

  function ausAdresse() {
    try {
      var m = /[?&](?:lang|sprache)=([a-z]{2})/i.exec(global.location.search || '');
      if (m && SPRACHEN.indexOf(m[1].toLowerCase()) >= 0) return m[1].toLowerCase();
    } catch (e) {}
    return null;
  }
  function ausSystem() {
    try {
      var l = (global.navigator.languages && global.navigator.languages[0]) || global.navigator.language || 'de';
      return /^de/i.test(l) ? 'de' : 'en';
    } catch (e) { return 'de'; }
  }
  function setzen(sprache) {
    if (SPRACHEN.indexOf(sprache) < 0) sprache = 'de';
    aktiv = sprache;
    cache.clear(); durch.clear();
    domTexte();
  }

  /* ---------- Texte im HTML (Namensfeld, Drehen-Hinweis, Startknopf) ---------- */

  var DOM = {
    de: {
      title: 'Balci Run – Yusufs Honig-Jagd',
      '#nameform label': 'DEIN NAME FÜR DIE BESTENLISTE',
      '#nameform small': 'Bis zu 10 Zeichen: A–Z, 0–9, Ä Ö Ü, Punkt, Bindestrich',
      '#nfok': 'EINTRAGEN',
      '#rotate p': 'DREH DEIN HANDY QUER',
      '#rotate small': 'Balci Run läuft im Querformat',
      '#startbtn': 'TIPPEN ZUM STARTEN',
      '#fshint': 'startet im Vollbild',
      '#codeform label': 'CODE VON DEINEM FREUND',
      '#codeform small': 'Er steht bei ihm unter ZU ZWEIT → ONLINE SPIELEN → FREUND EINLADEN',
      '#cfok': 'VERBINDEN',
      '#cfzurueck': 'ZURÜCK'
    },
    en: {
      title: 'Balci Run – Yusuf\'s Honey Hunt',
      '#nameform label': 'YOUR NAME FOR THE LEADERBOARD',
      '#nameform small': 'Up to 10 characters: A–Z, 0–9, Ä Ö Ü, dot, hyphen',
      '#nfok': 'ENTER',
      '#rotate p': 'TURN YOUR PHONE SIDEWAYS',
      '#rotate small': 'Balci Run plays in landscape',
      '#startbtn': 'TAP TO START',
      '#fshint': 'starts in fullscreen',
      '#codeform label': 'CODE FROM YOUR FRIEND',
      '#codeform small': 'They find it under TWO PLAYERS → PLAY ONLINE → INVITE A FRIEND',
      '#cfok': 'CONNECT',
      '#cfzurueck': 'BACK'
    }
  };

  function domTexte() {
    var d = global.document;
    if (!d || !d.querySelector) return;
    var tab = DOM[aktiv] || DOM.de;
    try {
      d.documentElement.lang = aktiv;
      for (var sel in tab) {
        if (sel === 'title') { d.title = tab[sel]; continue; }
        var el = d.querySelector(sel);
        if (el) el.textContent = tab[sel];
      }
    } catch (e) {}
  }

  /* Start (optionen.js, sobald die Einstellungen geladen sind):
     Adresse (?lang=en) > Vorgabe der Seite (BALCI_SPRACHE, Tests) >
     Wahl in den Einstellungen > Sprache des Systems */
  aktiv = ausAdresse() || 'de';
  function start(gewaehlt) {
    var vorgabe = SPRACHEN.indexOf(global.BALCI_SPRACHE) >= 0 ? global.BALCI_SPRACHE : null;
    var g = SPRACHEN.indexOf(gewaehlt) >= 0 ? gewaehlt : null;
    setzen(ausAdresse() || vorgabe || g || ausSystem());
  }
  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', function () { domTexte(); });
  }

  global.Sprache = {
    SPRACHEN: SPRACHEN,
    NAMEN: NAMEN,
    dazu: dazu,
    t: t,
    tn: tn,
    norm: norm,
    zahl: zahlFuer,
    schonUebersetzt: schonUebersetzt,
    start: start,
    setzen: setzen,
    aktiv: function () { return aktiv; },
    ist: function (s) { return aktiv === s; },
    /** fuer DOM-Texte, die im Spielcode stehen: { de: '...', en: '...' } */
    waehle: function (o) { return o && (o[aktiv] !== undefined ? o[aktiv] : o.de); },
    protokoll: function (an) { proto = an ? new Set() : null; cache.clear(); },
    fehlend: function () { return proto ? Array.from(proto) : []; },
    tabelle: function (s) { return tabellen[s] || null; }
  };

})(window);
