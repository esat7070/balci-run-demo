/* =====================================================================
   optionen.js — das Einstellungsmenue (Hauptmenue und Pause).

     MUSIK / EFFEKTE     getrennt, in zehn Stufen
     VOLLBILD            Browser: Vollbild-API, Desktop: Fenster (preload.js)
     SKALIERUNG          AUTOMATISCH / SCHARF (nur ganze Pixel) / FUELLEN
     BILDSCHIRMWACKELN   aus = kein Wackeln bei Treffern und Explosionen
     BLITZE              aus = keine weissen Blitze ueber dem ganzen Bild
     TASTENBELEGUNG      eigene Tasten (input.js); Controller: Steam Input
     SPRACHE             bisher nur Deutsch

   Gespeichert wird ueber speicher.js ('balci_optionen'), in der
   Steam-Version also auch in der Cloud.
   ===================================================================== */
(function (global) {
  'use strict';

  var F = global.Font;
  function S() { return global.Sound; }
  function In() { return global.Input; }
  function D() { return global.balciDesktop || null; }

  var KEY = 'balci_optionen';
  var SKALEN = ['auto', 'scharf', 'fuellen'];
  var SKALEN_NAME = { auto: 'AUTOMATISCH', scharf: 'SCHARF (GANZE PIXEL)', fuellen: 'FÜLLEN' };

  var w = { musik: 8, effekte: 8, wackeln: true, blitze: true, skalierung: 'auto', tasten: {} };

  /* ---------- Laden, Speichern, Anwenden ---------- */

  function laden() {
    var raw = global.Speicher.get(KEY), o = null;
    try { o = raw && raw.length < 2000 ? JSON.parse(raw) : null; } catch (e) { o = null; }
    if (o && typeof o === 'object') {
      var stufe = function (v, d) { var n = Math.round(Number(v)); return isFinite(n) ? Math.max(0, Math.min(10, n)) : d; };
      w.musik = stufe(o.musik, 8);
      w.effekte = stufe(o.effekte, 8);
      w.wackeln = o.wackeln !== false;
      w.blitze = o.blitze !== false;
      w.skalierung = SKALEN.indexOf(o.skalierung) >= 0 ? o.skalierung : 'auto';
      w.tasten = (o.tasten && typeof o.tasten === 'object') ? o.tasten : {};
    }
    anwenden();
  }

  function speichern() { global.Speicher.set(KEY, JSON.stringify(w)); }

  function anwenden() {
    if (S() && S().setLautstaerke) S().setLautstaerke(w.musik / 10, w.effekte / 10);
    if (In() && In().setBelegung) { In().setBelegung(w.tasten); w.tasten = In().belegung(); }
  }

  /* ---------- Vollbild ---------- */

  function kannVollbild() {
    if (D() && D().vollbild) return true;
    var de = document.documentElement;
    return !!(de.requestFullscreen || de.webkitRequestFullscreen);
  }
  function istVollbild() {
    if (D() && D().istVollbild) { try { return !!D().istVollbild(); } catch (e) { return false; } }
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function setVollbild(an) {
    if (D() && D().vollbild) { try { D().vollbild(an); } catch (e) {} return; }
    try {
      if (an) {
        var de = document.documentElement;
        var r = de.requestFullscreen ? de.requestFullscreen() : de.webkitRequestFullscreen();
        if (r && r.catch) r.catch(function () {});
      } else if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
  }

  /* ---------- Die Zeilen ---------- */

  var TASTEN_ZEILEN = [
    ['left', 'LAUFEN LINKS'], ['right', 'LAUFEN RECHTS'], ['up', 'HOCH'], ['down', 'RUNTER / STAMPFER'],
    ['jump', 'SPRINGEN'], ['throw', 'RENNEN / WERFEN'], ['pause', 'PAUSE'], ['puff', 'AUSPUSTEN (SHISHA)']
  ];


  function zeilen(G) {
    if (G.optSeite === 'tasten') {
      var z = TASTEN_ZEILEN.map(function (t) {
        return { k: 'taste', a: t[0], label: t[1], wert: In().tastenName(In().tasteFuer(t[0])) };
      });
      z.push({ k: 'standard', label: 'STANDARD WIEDERHERSTELLEN', wert: '' });
      z.push({ k: 'zurueck', label: 'ZURÜCK', wert: '' });
      return z;
    }
    var l = [
      { k: 'musik', label: 'MUSIK', wert: w.musik * 10 + ' %', balken: w.musik },
      { k: 'effekte', label: 'EFFEKTE', wert: w.effekte * 10 + ' %', balken: w.effekte }
    ];
    if (kannVollbild()) l.push({ k: 'vollbild', label: 'VOLLBILD', wert: istVollbild() ? 'AN' : 'AUS' });
    if (!G.touch) l.push({ k: 'skalierung', label: 'SKALIERUNG', wert: SKALEN_NAME[w.skalierung] });
    l.push({ k: 'wackeln', label: 'BILDSCHIRMWACKELN', wert: w.wackeln ? 'AN' : 'AUS' });
    l.push({ k: 'blitze', label: 'BLITZE', wert: w.blitze ? 'AN' : 'AUS' });
    if (!G.touch) l.push({ k: 'tasten', label: 'TASTENBELEGUNG', wert: '>' });
    l.push({ k: 'sprache', label: 'SPRACHE', wert: 'DEUTSCH' });
    l.push({ k: 'zurueck', label: 'ZURÜCK', wert: '' });
    return l;
  }

  /* ---------- Bedienung ---------- */

  function oeffnen(G, zurueck) {
    G.optZurueck = zurueck;
    G.optSeite = 'haupt';
    G.optSel = 0;
    G.optFangen = false;
    G.optHinweis = null;
    G.state = 'optionen';
  }

  function schliessen(G) {
    In().fangenAbbrechen();
    speichern();
    G.state = G.optZurueck || 'title';
    S().play('select');
  }

  /** Wert aendern: dir = -1 / +1 (links/rechts), 0 = bestaetigen */
  function aendern(G, z, dir) {
    var k = z.k;
    if (k === 'musik' || k === 'effekte') {
      // Links/rechts in Zehnerschritten; Bestaetigen zaehlt hoch und faengt bei 0 wieder an
      if (dir === 0) w[k] = w[k] >= 10 ? 0 : Math.min(10, w[k] + 2);
      else w[k] = Math.max(0, Math.min(10, w[k] + dir));
      anwenden();
      S().play(k === 'effekte' ? 'honey' : 'move');
    } else if (k === 'vollbild') {
      setVollbild(!istVollbild());
      S().play('select');
    } else if (k === 'skalierung') {
      var i = SKALEN.indexOf(w.skalierung);
      i = (i + (dir < 0 ? SKALEN.length - 1 : 1)) % SKALEN.length;
      w.skalierung = SKALEN[i];
      if (G.onSkalierung) G.onSkalierung();
      S().play('move');
    } else if (k === 'wackeln' || k === 'blitze') {
      w[k] = !w[k];
      if (k === 'wackeln' && w.wackeln && G.shake) G.shake(4, 10);
      S().play('move');
    } else if (k === 'sprache') {
      G.optHinweis = 'WEITERE SPRACHEN GIBT ES NOCH NICHT.';
      S().play('move');
    } else if (dir === 0) {
      if (k === 'tasten') { G.optSeite = 'tasten'; G.optSel = 0; S().play('select'); }
      else if (k === 'zurueck') {
        if (G.optSeite === 'tasten') { G.optSeite = 'haupt'; G.optSel = 0; speichern(); S().play('select'); }
        else schliessen(G);
      } else if (k === 'standard') {
        w.tasten = {}; anwenden(); speichern();
        G.optHinweis = 'ALLE TASTEN WIE AM ANFANG.';
        S().play('select');
      } else if (k === 'taste') {
        G.optFangen = true;
        G.optHinweis = null;
        S().play('select');
        In().naechsteTaste(function (code) {
          G.optFangen = false;
          if (code === 'Escape') { G.optHinweis = 'ABGEBROCHEN.'; return; }
          var neu = {};
          Object.keys(w.tasten).forEach(function (a) { if (w.tasten[a] !== code) neu[a] = w.tasten[a]; });
          neu[z.a] = code;
          w.tasten = neu;
          anwenden();
          speichern();
          G.optHinweis = z.label + ' = ' + In().tastenName(code);
        });
      }
    }
  }

  function update(G) {
    var I = In(), l = zeilen(G), n = l.length;
    if (G.optFangen) return;               // wartet auf eine Taste
    if (G.optSel >= n) G.optSel = n - 1;
    var tp = I.tap();
    if (tp) {
      for (var i = 0; i < n; i++) {
        var y = zeileY(G, i, n);
        if (tp.y >= y - 4 && tp.y < y + 12) {
          G.optSel = i;
          // Bei Balken und Auswahl: links vom Wert = weniger, rechts = mehr
          var wx = tp.x > (G.optMitte || 0) ? 1 : -1;
          aendern(G, l[i], (l[i].k === 'musik' || l[i].k === 'effekte' || l[i].k === 'skalierung') ? wx : 0);
          return;
        }
      }
      return;
    }
    if (I.hit('up')) { G.optSel = (G.optSel + n - 1) % n; S().play('move'); G.optHinweis = null; }
    if (I.hit('down')) { G.optSel = (G.optSel + 1) % n; S().play('move'); G.optHinweis = null; }
    var z = l[G.optSel];
    if (I.hit('left')) aendern(G, z, -1);
    if (I.hit('right')) aendern(G, z, 1);
    if (I.hit('pause') || I.hit('back')) {
      if (G.optSeite === 'tasten') { G.optSeite = 'haupt'; G.optSel = 0; speichern(); S().play('select'); }
      else schliessen(G);
      return;
    }
    if (I.hit('jump') || I.hit('confirm')) aendern(G, z, 0);
  }

  /* ---------- Zeichnen ---------- */

  function zeileY(G, i, n) { return Math.round(62 + i * Math.min(18, 170 / Math.max(1, n - 1))); }

  function draw(ctx, G, W, H) {
    G.optMitte = W / 2 + 40;
    ctx.fillStyle = 'rgba(8,5,12,0.96)';
    ctx.fillRect(0, 0, W, H);
    var tasten = G.optSeite === 'tasten';
    F.draw(ctx, tasten ? 'TASTENBELEGUNG' : 'EINSTELLUNGEN', W / 2, 22,
           { color: '#ffd257', align: 'center', scale: 3, shadow: true });
    var l = zeilen(G), n = l.length, x0 = W / 2 - 170, x1 = W / 2 + 170;
    for (var i = 0; i < n; i++) {
      var y = zeileY(G, i, n), an = i === G.optSel;
      if (an) {
        ctx.fillStyle = 'rgba(255,210,87,0.12)';
        ctx.fillRect(x0 - 12, y - 4, x1 - x0 + 24, 15);
        if ((G.tick >> 4) % 2 === 0) F.draw(ctx, '>', x0 - 10, y, { color: '#ffd257' });
      }
      F.draw(ctx, l[i].label, x0, y, { color: an ? '#ffd257' : '#c8b8e0' });
      var wert = l[i].wert;
      if (an && G.optFangen && l[i].k === 'taste') wert = (G.tick >> 4) % 2 ? 'TASTE DRÜCKEN ...' : '';
      if (wert) F.draw(ctx, wert, x1, y, { color: an ? '#ffffff' : '#a094b8', align: 'right' });
      if (l[i].balken !== undefined) {
        // Zehn Kaestchen links neben der Prozentzahl
        for (var b = 0; b < 10; b++) {
          ctx.fillStyle = b < l[i].balken ? (an ? '#ffd257' : '#c8a040') : '#2a2436';
          ctx.fillRect(x1 - 150 + b * 10, y, 8, 7);
        }
      }
    }
    var fuss;
    if (G.optHinweis) fuss = G.optHinweis;
    else if (G.optFangen) fuss = 'NEUE TASTE DRÜCKEN.  ESC = ABBRECHEN';
    else if (G.touch) fuss = 'ANTIPPEN ZUM ÄNDERN';
    else if (tasten) fuss = 'SPRUNG = NEU BELEGEN    ESC = ZURÜCK    CONTROLLER: ÜBER STEAM INPUT';
    else if (G.mitPad && G.mitPad()) fuss = 'STEUERKREUZ = AUSWÄHLEN UND ÄNDERN    A = OK    B = ZURÜCK';
    else fuss = 'HOCH/RUNTER = AUSWAHL    LINKS/RECHTS = ÄNDERN    ESC = ZURÜCK';
    F.draw(ctx, fuss, W / 2, H - 22, { color: G.optHinweis ? '#8cd85a' : '#a094b8', align: 'center' });
  }

  global.Optionen = {
    laden: laden,
    oeffnen: oeffnen,
    update: update,
    draw: draw,
    wackeln: function () { return w.wackeln; },
    blitze: function () { return w.blitze; },
    skalierung: function () { return w.skalierung; },
    kannVollbild: kannVollbild,
    istVollbild: istVollbild,
    setVollbild: setVollbild,
    _werte: w
  };

  laden();
})(window);
