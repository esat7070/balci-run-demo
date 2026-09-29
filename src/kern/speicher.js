/* =====================================================================
   speicher.js — wohin Spielstand, Trophaeen, Bestenliste und
   Einstellungen geschrieben werden.

   Im Browser: localStorage, wie bisher.
   In der Desktop-/Steam-Version (Electron, Ordner steam/) stellt
   preload.js ein Objekt window.balciDesktop bereit. Dann kommt jeder
   Schluessel zusaetzlich als eigene Datei in den Benutzerordner des
   Spiels — diesen Ordner synchronisiert Steam Cloud (Auto-Cloud).
   Gelesen wird zuerst die Datei (sie kann von einem anderen PC kommen),
   sonst localStorage.
   ===================================================================== */
(function (global) {
  'use strict';

  function desktop() { return global.balciDesktop || null; }

  // Die Demo (eigenes Repo, siehe web-demo/) liegt unter derselben Adresse
  // wie das volle Spiel (esat7070.github.io) — eigener Spielstand, sonst
  // teilen sich beide Fortschritt, Trophaeen und Bestenliste.
  var VOR = global.BALCI_DEMO ? 'demo_' : '';

  function get(key) {
    var D = desktop();
    key = VOR + key;
    if (D && D.laden) {
      try {
        var v = D.laden(key);
        if (typeof v === 'string') return v;
      } catch (e) {}
    }
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }

  /** Gibt false zurueck, wenn nirgends gespeichert werden konnte
      (privater Modus, Speicher voll, Datei gesperrt). */
  function set(key, val) {
    var ok = false, D = desktop();
    key = VOR + key;
    val = String(val);
    if (D && D.speichern) {
      try { ok = D.speichern(key, val) !== false; } catch (e) {}
    }
    try { global.localStorage.setItem(key, val); ok = true; } catch (e) {}
    return ok;
  }

  global.Speicher = {
    get: get,
    set: set,
    istDesktop: function () { return !!desktop(); }
  };
})(window);
