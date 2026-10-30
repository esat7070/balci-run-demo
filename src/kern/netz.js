/* =====================================================================
   netz.js — Online zu zweit, direkt von Geraet zu Geraet (Peer-to-Peer).
   Esat, 29.10.: "Es soll Peer-to-Peer sein. Lokal wird das niemand spielen."

   So geht es:
   - Spieler 1 laedt ein (ZU ZWEIT -> ONLINE SPIELEN -> FREUND EINLADEN)
     und bekommt einen Code aus vier Zeichen. Sein Spiel ist der Gastgeber.
   - Spieler 2 gibt den Code ein (oder oeffnet den Link mit ?online=CODE).
   - Ein oeffentlicher Vermittler (der kostenlose PeerJS-Server) reicht nur
     die Verbindungsdaten weiter — ein paar Nachrichten. Danach reden die
     beiden Geraete direkt miteinander (WebRTC), ohne Server dazwischen.
   - Das Spiel laeuft beim Gastgeber. Der Freund schickt nur seine Tasten
     (sie steuern Spieler 2, wie ein Controller); zurueck kommen Bild und
     Ton als Video ueber dieselbe direkte Verbindung. So koennen die beiden
     Spiele nie auseinanderlaufen, und alles (Bosse, Rennen, Minispiele,
     Honig-Duell) funktioniert genau wie zu zweit an einem Geraet.
   - Rennen und Minispiele gegeneinander: online sieht jeder seine eigene
     Welt im ganzen Bild statt Splitscreen (koop.js halbeBilder -> gastBild).

   Bricht die Verbindung ab, wartet der Gastgeber mit demselben Code weiter:
   der Freund kann wieder einsteigen. Bis dahin steht Spieler 2 still (die
   Leine aus koop.js zieht ihn mit).

   Vermittler: PeerJS-Protokoll (JSON ueber WebSocket). Der Server prueft
   die Nachrichten: OFFER/ANSWER/CANDIDATE muessen so aussehen wie die der
   PeerJS-Bibliothek, sonst schliesst er die Verbindung. Eigene Angaben
   reisen in payload.metadata (nur beim OFFER erlaubt).
   ===================================================================== */
(function (global) {
  'use strict';

  function In() { return global.Input; }
  function S() { return global.Sound; }
  function F() { return global.Font; }
  function P() { return global.Pixel; }
  function KO() { return global.Koop; }

  var SERVER = 'wss://0.peerjs.com:443/peerjs?key=peerjs';
  var VORSILBE = 'balcirun-';
  var PROTO = 1;                 // aendert sich, wenn Gast und Gastgeber nicht mehr zusammenpassen
  // Wie die beiden Geraete einander finden (STUN: "wie sieht mich das Internet?")
  var ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
             { urls: 'stun:global.stun.twilio.com:3478' }];
  // Ohne I, O, 0 und 1 — die verwechselt man beim Vorlesen
  var ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var CODE_LAENGE = 4;
  // Was der Freund schickt (Pause, Ton, Zurueck bleiben bei ihm)
  var AKT = ['left', 'right', 'up', 'down', 'jump', 'run', 'throw', 'confirm', 'puff', 'gas', 'hopp',
             'nitro', 'stampf', 'n1', 'n2', 'n3', 'laden'];
  var BITRATE = 5000000;         // Bild: bis 5 Mbit/s
  var SUCHEN_MS = 20000;         // so lange sucht der Gast, dann gibt er auf
  var STILL_MS = 9000;           // so lange keine Nachricht = Verbindung weg
  var HAKT_MS = 2500;            // ab da zeigt der Gast "VERBINDUNG HAKT"

  var N = {
    rolle: null,                 // 'host' (laedt ein) oder 'gast' (kommt dazu)
    status: 'aus',               // verbinden, warten, suchen, koppeln, da, fehler
    code: '', token: '', sig: null, sigVersuche: 0,
    pc: null, dc: null, gegenueber: null, connId: '',
    kandidaten: [], remoteDa: false,
    ping: 0, zuletzt: 0, pingT: null, suchT: null, seit: 0,
    // Gastgeber: was gesendet wird
    sende: null, sendeCtx: null, strom: null, gastBild: null, gastUeber: null,
    // Gast: das Bild vom Gastgeber
    video: null, tonGesperrt: false, h: 0, raus: false,
    // Menue
    modus: 'start', idx: 0, tipp: '', fehler: '', G: null
  };

  /* ---------------- Kleinkram ---------------- */

  function zufall(n, zeichen) {
    var z = zeichen || 'abcdefghijklmnopqrstuvwxyz0123456789', s = '', i, r = null;
    try { r = new Uint32Array(n); global.crypto.getRandomValues(r); } catch (e) { r = null; }
    for (i = 0; i < n; i++) s += z.charAt((r ? r[i] : Math.floor(Math.random() * 4294967296)) % z.length);
    return s;
  }
  function jetzt() { return global.performance ? global.performance.now() : Date.now(); }
  function kannWebRTC() { return !!global.RTCPeerConnection; }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  /** Codes und Namen nicht uebersetzen (sonst fallen sie als "fehlt" auf). */
  function roh(s) { if (global.Sprache && global.Sprache.schonUebersetzt) global.Sprache.schonUebersetzt(s); return s; }
  function toast(z1, z2, col) {
    var G = N.G;
    if (G && G.toasts) G.toasts.push({ art: 'text', zeile1: z1, zeile2: z2 || '', col: col || '#6fc8e8', zeit: 240 });
  }

  /* ---------------- Vermittler (PeerJS-Server) ---------------- */

  /** Verbindung zum Vermittler unter der eigenen Kennung. h: offen(),
      fehler(grund), zu(), nachricht(m). Die Tests setzen _signalFabrik. */
  function signal(id, token, h) {
    if (api._signalFabrik) return api._signalFabrik(id, token, h);
    var ws, hb = null, zu = false;
    try {
      ws = new global.WebSocket(SERVER + '&id=' + encodeURIComponent(id) + '&token=' + token + '&version=1.5.4');
    } catch (e) {
      setTimeout(function () { h.fehler('netz'); }, 0);
      return { send: function () {}, close: function () {} };
    }
    ws.onmessage = function (e) {
      var m;
      try { m = JSON.parse(e.data); } catch (x) { return; }
      if (!m || typeof m.type !== 'string') return;
      if (m.type === 'OPEN') h.offen();
      else if (m.type === 'ID-TAKEN') h.fehler('vergeben');
      else if (m.type === 'ERROR' || m.type === 'INVALID-KEY') h.fehler('netz');
      else h.nachricht(m);
    };
    ws.onerror = function () {};
    ws.onclose = function () { if (hb) clearInterval(hb); if (!zu) { zu = true; h.zu(); } };
    // Der Server vergisst Kennungen, von denen er eine Minute nichts hoert
    hb = setInterval(function () { if (ws.readyState === 1) ws.send('{"type":"HEARTBEAT"}'); }, 5000);
    return {
      send: function (type, dst, payload) {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: type, dst: dst, payload: payload }));
      },
      close: function () { zu = true; if (hb) clearInterval(hb); try { ws.close(); } catch (e) {} }
    };
  }

  // Nachrichten so, wie der PeerJS-Server sie sehen will
  function offerNachricht(sdp, meta) {
    return { sdp: { type: 'offer', sdp: sdp }, type: 'data', connectionId: N.connId, label: 'balci',
             reliable: true, serialization: 'json', browser: 'chrome', metadata: meta };
  }
  function answerNachricht(sdp) {
    return { sdp: { type: 'answer', sdp: sdp }, type: 'data', connectionId: N.connId, browser: 'chrome' };
  }
  function kandidatNachricht(c) {
    return { candidate: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex,
                          usernameFragment: c.usernameFragment },
             type: 'data', connectionId: N.connId };
  }

  /* ---------------- Direkte Verbindung (WebRTC) ---------------- */

  function neuePc(dst) {
    var pc = new global.RTCPeerConnection({ iceServers: api.ICE || ICE });
    pc.onicecandidate = function (e) {
      if (pc === N.pc && e.candidate && e.candidate.candidate && N.sig) N.sig.send('CANDIDATE', dst, kandidatNachricht(e.candidate));
    };
    pc.onconnectionstatechange = function () {
      if (pc !== N.pc) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') verloren(false);
    };
    return pc;
  }

  function kandidat(c) {
    if (!c || !N.pc || typeof c.candidate !== 'string') return;
    if (!N.remoteDa) { N.kandidaten.push(c); return; }
    N.pc.addIceCandidate(c).catch(function () {});
  }
  function kandidatenRaus() {
    var l = N.kandidaten;
    N.kandidaten = [];
    l.forEach(kandidat);
  }

  function kanal(dc) {
    N.dc = dc;
    dc.onopen = function () { if (dc === N.dc) verbunden(); };
    dc.onmessage = function (e) { if (dc === N.dc) empfangen(e.data); };
    dc.onclose = function () { if (dc === N.dc) verloren(false); };
    if (dc.readyState === 'open') verbunden();
  }

  function senden(a) {
    if (N.dc && N.dc.readyState === 'open') { try { N.dc.send(JSON.stringify(a)); } catch (e) {} }
  }

  function pcZu() {
    var pc = N.pc, dc = N.dc;
    N.pc = null; N.dc = null; N.remoteDa = false; N.kandidaten = [];
    try { if (dc) dc.close(); } catch (e) {}
    try { if (pc) pc.close(); } catch (e) {}
  }

  /* Nachrichten ueber die direkte Verbindung (kleine Listen):
       [1, gehalten, kurz]  Tasten des Freundes (Bitmasken nach AKT)
       [2, t] / [3, t]      Ping / Pong (Millisekunden)
       [4]                  "ich gehe" (absichtlich beendet) */
  function empfangen(d) {
    if (typeof d !== 'string' || d.length > 200) return;
    var m;
    try { m = JSON.parse(d); } catch (e) { return; }
    if (!Array.isArray(m)) return;
    N.zuletzt = jetzt();
    if (m[0] === 1 && N.rolle === 'host') tasten(m[1], m[2]);
    else if (m[0] === 2) senden([3, m[1]]);
    else if (m[0] === 3 && typeof m[1] === 'number') N.ping = Math.max(0, Math.round(jetzt() - m[1]));
    else if (m[0] === 4) verloren(true);
  }

  /** Die Tasten des Freundes: Spieler 2 (input.js). */
  function tasten(h, k) {
    if (typeof h !== 'number' || typeof k !== 'number') return;
    var gehalten = {}, kurz = [];
    for (var i = 0; i < AKT.length; i++) {
      if (h & (1 << i)) gehalten[AKT[i]] = true;
      if (k & (1 << i)) kurz.push(AKT[i]);
    }
    In().netzStand(gehalten, kurz);
  }

  function verbunden() {
    if (N.status === 'da') return;
    N.status = 'da';
    N.zuletzt = jetzt(); N.seit = jetzt(); N.ping = 0;
    if (N.suchT) { clearTimeout(N.suchT); N.suchT = null; }
    if (N.pingT) clearInterval(N.pingT);
    N.pingT = setInterval(function () {
      if (N.status !== 'da') return;
      senden([2, jetzt()]);
      if (jetzt() - N.zuletzt > STILL_MS) verloren(false);
    }, 1000);
    senden([2, jetzt()]);
    if (N.rolle === 'host') {
      In().netz(true);
      toast('SPIELER 2 IST ONLINE DA', 'DIREKT VERBUNDEN', '#8cd85a');
      if (S()) S().play('select');
    } else {
      var G = N.G;
      // Der Vermittler wird nicht mehr gebraucht
      if (N.sig) { N.sig.close(); N.sig = null; }
      N.raus = false; N.h = 0;
      if (G) {
        G.state = 'netz';
        if (S() && S().stopMusic) S().stopMusic();
      }
    }
  }

  /** Verbindung weg. absicht = der andere hat beendet. */
  function verloren(absicht) {
    var warDa = N.status === 'da';
    pcZu();
    if (N.pingT) { clearInterval(N.pingT); N.pingT = null; }
    if (N.rolle === 'host') {
      In().netz(false);
      N.status = N.sig ? 'warten' : 'verbinden';
      if (!N.sig) hostSignal();
      if (warDa) toast(absicht ? 'SPIELER 2 IST GEGANGEN' : 'SPIELER 2 IST WEG', 'MIT DEM CODE ' + roh(N.code) + ' KANN ER WIEDER REIN', '#ff9a5a');
    } else if (N.rolle === 'gast') {
      var G = N.G, code = N.code;
      beenden(true);
      if (warDa) {
        if (G && G.state === 'netz') zumTitel(G);
        toast(absicht ? 'DEIN FREUND HAT BEENDET' : 'VERBINDUNG WEG', absicht ? '' : 'MIT ' + roh(code) + ' KOMMST DU WIEDER REIN', '#ff9a5a');
      } else {
        gastFehler('blockiert');
      }
    }
  }

  function zumTitel(G) {
    G.state = 'title';
    G.menuIdx = 0;
    if (S() && G.gestured) S().music('menu');
  }

  /** Online aus. leise = ohne dem anderen Bescheid zu sagen. */
  function beenden(leise) {
    if (!leise) senden([4]);
    if (N.rolle === 'host') In().netz(false);
    pcZu();
    if (N.sig) { N.sig.close(); N.sig = null; }
    if (N.pingT) { clearInterval(N.pingT); N.pingT = null; }
    if (N.suchT) { clearTimeout(N.suchT); N.suchT = null; }
    if (N.video) {
      try { N.video.pause(); N.video.srcObject = null; if (N.video.parentNode) N.video.parentNode.removeChild(N.video); } catch (e) {}
      N.video = null;
    }
    N.rolle = null; N.status = 'aus'; N.code = ''; N.gegenueber = null; N.raus = false; N.tonGesperrt = false;
    N.gastBild = null; N.gastUeber = null;
  }

  /* ---------------- Gastgeber ---------------- */

  function hosten(G) {
    beenden(true);
    if (!kannWebRTC()) { menueFehler('geraet'); return; }
    N.rolle = 'host';
    N.code = zufall(CODE_LAENGE, ZEICHEN);
    N.token = zufall(12);
    N.sigVersuche = 0;
    sendeStrom();
    hostSignal();
  }

  function hostSignal() {
    // Ein laufendes Spiel bleibt "da": der Vermittler wird nur fuers Wieder-Reinkommen gebraucht
    if (N.status !== 'da' && N.status !== 'fehler') N.status = 'verbinden';
    var s = N.sig = signal(VORSILBE + N.code, N.token, {
      offen: function () {
        if (s !== N.sig) return;
        N.sigVersuche = 0;
        if (N.status !== 'da') N.status = 'warten';
      },
      fehler: function (grund) {
        if (s !== N.sig) return;
        s.close(); N.sig = null;
        // Code schon vergeben (sehr selten): ein neuer
        if (grund === 'vergeben' && N.status !== 'da') { N.code = zufall(CODE_LAENGE, ZEICHEN); hostSignal(); return; }
        if (N.status !== 'da') { N.status = 'fehler'; N.fehler = grund; }
      },
      zu: function () {
        if (s !== N.sig) return;
        N.sig = null;
        // Vermittler weg (WLAN kurz weg ...): neu anmelden. Ein laufendes Spiel geht direkt weiter.
        if (N.rolle !== 'host') return;
        // Klappt es zweimal nicht, sagt das Menue es (versucht wird weiter)
        if (N.status !== 'da') {
          N.status = N.sigVersuche >= 1 ? 'fehler' : 'verbinden';
          N.fehler = 'netz';
        }
        var warte = Math.min(15000, 1500 * Math.pow(2, N.sigVersuche++));
        setTimeout(function () { if (N.rolle === 'host' && !N.sig) hostSignal(); }, warte);
      },
      nachricht: hostNachricht
    });
  }

  function hostNachricht(m) {
    var p = m.payload || {};
    if (m.type === 'OFFER') {
      var meta = p.metadata || {};
      if (meta.spiel !== 'balcirun' || !p.sdp || typeof p.sdp.sdp !== 'string') return;
      if (meta.proto !== PROTO) { nein(m.src, p.connectionId, 'version'); return; }
      // Voll ist es nur, wenn der jetzige Freund noch lebt (er pingt jede Sekunde).
      // Hing er (Absturz, neu geladen) und klopft neu an, darf er sofort wieder rein.
      if (N.status === 'da' && N.gegenueber !== m.src && jetzt() - N.zuletzt < 3000) { nein(m.src, p.connectionId, 'voll'); return; }
      hostKoppeln(m.src, p);
    } else if (m.type === 'CANDIDATE' && m.src === N.gegenueber) {
      kandidat(p.candidate);
    }
  }

  /** Absage an einen Gast (als OFFER mit Absage, eine ANSWER darf nichts mitnehmen). */
  function nein(dst, connId, grund) {
    if (!N.sig) return;
    N.sig.send('OFFER', dst, { sdp: { type: 'offer', sdp: 'v=0\r\n' }, type: 'data', connectionId: connId || 'dc_x',
                               label: 'balci', reliable: true, serialization: 'json', browser: 'chrome',
                               metadata: { spiel: 'balcirun', nein: grund } });
  }

  function hostKoppeln(src, p) {
    if (N.status === 'da') verloren(false);      // derselbe Freund klopft neu an
    pcZu();
    N.gegenueber = src; N.connId = String(p.connectionId || 'dc_' + zufall(8)).slice(0, 40);
    N.status = 'koppeln';
    var pc = N.pc = neuePc(src);
    pc.ondatachannel = function (e) { if (pc === N.pc) kanal(e.channel); };
    pc.setRemoteDescription({ type: 'offer', sdp: schnellerStart(p.sdp.sdp) }).then(function () {
      if (pc !== N.pc) return null;
      N.remoteDa = true;
      kandidatenRaus();
      var st = sendeStrom();
      if (st) st.getTracks().forEach(function (t) { pc.addTrack(t, st); });
      return pc.createAnswer().then(function (a) { return pc.setLocalDescription(a); }).then(function () {
        if (pc !== N.pc || !N.sig) return;
        N.sig.send('ANSWER', src, answerNachricht(pc.localDescription.sdp));
        qualitaet(pc);
      });
    }).catch(function () {
      if (pc !== N.pc) return;
      pcZu();
      N.status = N.sig ? 'warten' : 'verbinden';
    });
  }

  /** Das Bild, das der Freund sieht: eine eigene Leinwand in doppelter
      Spielgroesse (scharfe Pixel, gleich gross auf jedem Rechner) und der Ton. */
  function sendeStrom() {
    if (N.strom) return N.strom;
    if (!global.document || !global.MediaStream) return null;
    var c = N.sende = global.document.createElement('canvas');
    c.width = 1024; c.height = 576;
    N.sendeCtx = c.getContext('2d');
    rect(N.sendeCtx, 0, 0, c.width, c.height, '#08050c');
    var spuren = [];
    try {
      var bild = c.captureStream ? c.captureStream(60) : null;
      if (bild) spuren = bild.getVideoTracks();
    } catch (e) {}
    spuren.forEach(function (t) { try { t.contentHint = 'motion'; } catch (e) {} });
    try {
      var ton = S() && S().netzTon ? S().netzTon() : null;
      if (ton) spuren = spuren.concat(ton.getAudioTracks());
    } catch (e) {}
    N.strom = new global.MediaStream(spuren);
    return N.strom;
  }

  /** WebRTC faengt ab Werk mit 0,3 Mbit/s an und tastet sich langsam hoch —
      die ersten Sekunden waere das Bild klein und ruckelig. Chrome (und damit
      Electron/Steam) liest aus dem SDP, womit es anfangen soll; die anderen
      Browser ignorieren die Angabe. Gilt fuer alle Video-Formate im Angebot. */
  var START_KBIT = 2500, MIN_KBIT = 600, MAX_KBIT = BITRATE / 1000;
  function schnellerStart(sdp) {
    try {
      var z = sdp.split('\r\n'), video = false, pts = [], fmtp = {}, i, m;
      for (i = 0; i < z.length; i++) {
        if (z[i].indexOf('m=') === 0) video = z[i].indexOf('m=video') === 0;
        else if (video && (m = /^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i.exec(z[i]))) pts.push(m[1]);
        else if (video && (m = /^a=fmtp:(\d+) /.exec(z[i]))) fmtp[m[1]] = i;
      }
      var dazu = 'x-google-start-bitrate=' + START_KBIT + ';x-google-min-bitrate=' + MIN_KBIT + ';x-google-max-bitrate=' + MAX_KBIT;
      var neu = [];
      for (i = 0; i < z.length; i++) {
        var zeile = z[i];
        if ((m = /^a=fmtp:(\d+) /.exec(zeile)) && pts.indexOf(m[1]) >= 0 && zeile.indexOf('x-google-') < 0) zeile += ';' + dazu;
        neu.push(zeile);
        if ((m = /^a=rtpmap:(\d+) /.exec(zeile)) && pts.indexOf(m[1]) >= 0 && fmtp[m[1]] === undefined) neu.push('a=fmtp:' + m[1] + ' ' + dazu);
      }
      return neu.join('\r\n');
    } catch (e) { return sdp; }
  }

  /** Mehr Bitrate als ab Werk. Wird es eng, darf WebRTC Schaerfe und
      Bildrate gleichmaessig senken (balanced) — nur eins von beiden waere
      entweder matschige Pixel oder ein Diashow-Bild. */
  function qualitaet(pc) {
    try {
      pc.getSenders().forEach(function (s) {
        if (!s.track || s.track.kind !== 'video' || !s.getParameters) return;
        var pa = s.getParameters();
        if (!pa.encodings || !pa.encodings.length) pa.encodings = [{}];
        pa.encodings[0].maxBitrate = BITRATE;
        pa.encodings[0].maxFramerate = 60;
        pa.degradationPreference = 'balanced';
        s.setParameters(pa).catch(function () {});
      });
    } catch (e) {}
  }

  /** game.js nach jedem Bild: das Bild fuer den Freund. In Rennen und
      Minispielen gegeneinander hat koop.js vorher seine eigene Welt
      hinterlegt (gastBild); sonst sieht er dasselbe wie der Gastgeber. */
  function nachRender(G, canvas) {
    var bild = N.gastBild, ueber = N.gastUeber;
    N.gastBild = null; N.gastUeber = null;
    if (N.rolle !== 'host' || N.status !== 'da' || !N.sende) return;
    var W = canvas.logischW || 512, H = canvas.logischH || 288;
    var c = N.sende, o = N.sendeCtx, zw = W * 2, zh = H * 2;
    if (c.width !== zw || c.height !== zh) { c.width = zw; c.height = zh; }
    var q = bild || canvas;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'source-over';
    o.imageSmoothingEnabled = q.width > zw;
    o.drawImage(q, 0, 0, q.width, q.height, 0, 0, zw, zh);
    if (bild && ueber) {
      o.setTransform(zw / W, 0, 0, zh / H, 0, 0);
      o.imageSmoothingEnabled = false;
      try { ueber(o); } catch (e) {}
      o.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  /* ---------------- Gast ---------------- */

  function beitreten(G, code) {
    beenden(true);
    N.modus = 'gast';
    if (!kannWebRTC()) { menueFehler('geraet'); return; }
    N.rolle = 'gast';
    N.code = code;
    N.token = zufall(12);
    N.connId = 'dc_' + zufall(10);
    N.gegenueber = VORSILBE + code;
    N.status = 'verbinden';
    var s = N.sig = signal(VORSILBE + 'g' + zufall(10), N.token, {
      offen: function () { if (s === N.sig) gastAnbieten(); },
      fehler: function (grund) { if (s === N.sig) gastFehler(grund === 'vergeben' ? 'netz' : grund); },
      zu: function () { if (s === N.sig && N.status !== 'da') gastFehler('netz'); },
      nachricht: gastNachricht
    });
    N.suchT = setTimeout(function () {
      N.suchT = null;
      if (N.rolle === 'gast' && N.status !== 'da') gastFehler(N.status === 'koppeln' ? 'blockiert' : 'keine');
    }, SUCHEN_MS);
  }

  function gastAnbieten() {
    N.status = 'suchen';
    var pc = N.pc = neuePc(N.gegenueber);
    kanal(pc.createDataChannel('balci', { ordered: true }));
    try {
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    } catch (e) {}
    pc.ontrack = function (e) { if (pc === N.pc) gastSpur(e); };
    pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () {
      if (pc !== N.pc || !N.sig) return;
      N.sig.send('OFFER', N.gegenueber, offerNachricht(pc.localDescription.sdp, { spiel: 'balcirun', proto: PROTO }));
    }).catch(function () { if (pc === N.pc) gastFehler('netz'); });
  }

  function gastNachricht(m) {
    var p = m.payload || {};
    if (m.src !== N.gegenueber) return;
    if (m.type === 'EXPIRE') {
      // Unter dem Code ist niemand angemeldet
      if (N.status !== 'da' && N.status !== 'koppeln') gastFehler('keine');
    } else if (m.type === 'OFFER') {
      var meta = p.metadata || {};
      if (meta.spiel === 'balcirun' && meta.nein) gastFehler(meta.nein === 'voll' ? 'voll' : 'version');
    } else if (m.type === 'ANSWER' && N.pc && p.sdp && typeof p.sdp.sdp === 'string' && !N.remoteDa) {
      N.status = 'koppeln';
      var pc = N.pc;
      pc.setRemoteDescription({ type: 'answer', sdp: p.sdp.sdp }).then(function () {
        if (pc !== N.pc) return;
        N.remoteDa = true;
        kandidatenRaus();
      }).catch(function () { if (pc === N.pc) gastFehler('netz'); });
    } else if (m.type === 'CANDIDATE') {
      kandidat(p.candidate);
    }
  }

  function gastFehler(grund) {
    beenden(true);
    menueFehler(grund);
    var G = N.G;
    if (G && G.state === 'netz') G.state = 'online';
  }

  /** Bild und Ton vom Gastgeber: ein unsichtbares Video, das gastDraw
      Bild fuer Bild ins Spiel zeichnet (so liegen Hinweise darueber). */
  function gastSpur(e) {
    var v = N.video;
    if (!v) {
      v = N.video = global.document.createElement('video');
      v.setAttribute('playsinline', '');
      v.playsInline = true;
      v.autoplay = true;
      var st = v.style;
      st.position = 'fixed'; st.left = '0'; st.top = '0'; st.width = '2px'; st.height = '2px';
      st.opacity = '0'; st.pointerEvents = 'none';
      global.document.body.appendChild(v);
    }
    var strom = (e.streams && e.streams[0]) || null;
    if (strom) { if (v.srcObject !== strom) v.srcObject = strom; }
    else {
      if (!v.srcObject) v.srcObject = new global.MediaStream();
      v.srcObject.addTrack(e.track);
    }
    // So wenig Puffer wie moeglich: lieber ein Ruckler als Verzoegerung
    try { if (e.receiver) { e.receiver.playoutDelayHint = 0; e.receiver.jitterBufferTarget = 0; } } catch (x) {}
    abspielen();
  }

  function abspielen() {
    var v = N.video;
    if (!v) return;
    v.muted = !!(S() && S().isMuted && S().isMuted());
    var r = v.play();
    if (r && r.catch) {
      r.catch(function () {
        // Ton erst nach einer Taste (Browser-Regel): erst stumm, dann laut
        if (v !== N.video) return;
        N.tonGesperrt = true;
        v.muted = true;
        var r2 = v.play();
        if (r2 && r2.catch) r2.catch(function () {});
      });
    }
  }

  // Erste Taste / erster Tipp nach dem Stummstart: Ton an
  function geste() {
    if (N.tonGesperrt && N.video) { N.tonGesperrt = false; abspielen(); }
  }
  if (global.addEventListener) {
    global.addEventListener('keydown', geste);
    global.addEventListener('pointerdown', geste);
    // Fenster zu oder Seite neu geladen: dem anderen Bescheid sagen
    global.addEventListener('pagehide', function () { if (N.rolle) beenden(false); });
  }

  /** game.js, Zustand 'netz': die Tasten zum Gastgeber schicken. */
  function gastUpdate(G) {
    var I = In(), i;
    if (N.video && !N.tonGesperrt) N.video.muted = !!(S() && S().isMuted && S().isMuted());
    if (N.raus) {
      if (I.hit('confirm') || I.hit('jump')) { verlassen(G); return; }
      if (I.hit('pause') || I.hit('back')) N.raus = false;
      return;
    }
    if (I.hit('pause') || I.hit('back')) {
      // Pause beim Freund = fragen, ob er gehen will (das Spiel laeuft beim Gastgeber weiter)
      N.raus = true;
      if (N.h) { N.h = 0; senden([1, 0, 0]); }
      return;
    }
    var h = 0, k = 0;
    for (i = 0; i < AKT.length; i++) {
      if (I.down(AKT[i])) h |= (1 << i);
      if (I.hit(AKT[i])) k |= (1 << i);
    }
    if (h !== N.h || k) { senden([1, h, k]); N.h = h; }
  }

  function verlassen(G) {
    beenden(false);
    zumTitel(G);
    toast('ONLINE BEENDET', '', '#6fc8e8');
  }

  /** game.js, Zustand 'netz': das Bild vom Gastgeber, darueber ein paar Hinweise. */
  function gastDraw(ctx, G, W, H, canvas) {
    rect(ctx, 0, 0, W, H, '#000000');
    var v = N.video, da = v && v.readyState >= 2 && v.videoWidth > 0;
    if (da) {
      var cw = canvas.width, ch = canvas.height, s = Math.min(cw / v.videoWidth, ch / v.videoHeight);
      var dw = v.videoWidth * s, dh = v.videoHeight * s;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(v, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), Math.round(dw), Math.round(dh));
      ctx.restore();
    } else {
      F().draw(ctx, 'VERBUNDEN. WARTE AUF DAS BILD ...', W / 2, H / 2 - 4, { color: '#d8cfe8', align: 'center', shadow: true });
    }
    var seit = jetzt() - N.seit, still = jetzt() - N.zuletzt, hakt = still > HAKT_MS;
    // Die ersten Sekunden: wie man rauskommt (zwei Zeilen). Spaeter nur eine
    // kleine Zeile, wenn es hakt — sie liegt sonst ueber Yusufs Anzeigen.
    if (seit < 6000) {
      var t1 = hakt ? 'VERBINDUNG HAKT ...' : (N.ping ? 'ONLINE   ' + N.ping + ' MS' : 'ONLINE');
      var t2 = 'ESC = VERLASSEN';
      var bw = Math.max(F().measure(t1, 1, 1), F().measure(t2, 1, 1)) + 12;
      rect(ctx, 4, 4, bw, 24, 'rgba(8,5,12,0.75)');
      F().draw(ctx, t1, 10, 8, { color: hakt ? '#ff9a5a' : '#8cd85a' });
      F().draw(ctx, t2, 10, 18, { color: '#a89cc0' });
    } else if (hakt || N.ping > 250) {
      var t3 = hakt ? 'VERBINDUNG HAKT ...' : 'ONLINE   ' + N.ping + ' MS';
      rect(ctx, W / 2 - F().measure(t3, 1, 1) / 2 - 5, H - 13, F().measure(t3, 1, 1) + 10, 11, 'rgba(8,5,12,0.7)');
      F().draw(ctx, t3, W / 2, H - 11, { color: '#ff9a5a', align: 'center' });
    }
    if (N.tonGesperrt && da && (G.tick >> 5) % 2 === 0) {
      F().draw(ctx, 'TASTE DRÜCKEN FÜR TON', W / 2, H - 14, { color: '#ffe38a', align: 'center', shadow: true });
    }
    if (N.raus) {
      rect(ctx, 0, H / 2 - 34, W, 68, 'rgba(8,5,12,0.92)');
      rect(ctx, 0, H / 2 - 34, W, 1, '#6fc8e8');
      rect(ctx, 0, H / 2 + 33, W, 1, '#6fc8e8');
      F().draw(ctx, 'ONLINE VERLASSEN?', W / 2, H / 2 - 24, { color: '#ffffff', align: 'center', scale: 2, shadow: true });
      F().draw(ctx, 'DAS SPIEL LÄUFT BEI DEINEM FREUND WEITER.', W / 2, H / 2 - 2, { color: '#d8cfe8', align: 'center' });
      F().draw(ctx, G.hinweis ? G.hinweis('ENTER = VERLASSEN   ESC = WEITERSPIELEN') : 'ENTER = VERLASSEN   ESC = WEITERSPIELEN',
               W / 2, H / 2 + 14, { color: '#ffd257', align: 'center' });
    }
  }

  /* ---------------- Jeder Tick (Gastgeber) ---------------- */

  /** game.js update, direkt nach Input.poll: duerfen die Tasten des Freundes
      gerade auch fuer alle zaehlen (Dialoge weiterdruecken, Ergebnis
      bestaetigen, Minispiele)? Zu zweit im Spiel ja, wie ein zweiter
      Controller. Im Menue ZU ZWEIT sucht er sich seine Figur aus. Pause,
      Hauptmenue, Shop und Einstellungen gehoeren dem Gastgeber allein —
      und spielt der allein, steuert der Freund gar nichts. */
  var FREUND_DARF = { play: 1, dialog: 1, clear: 1 };
  function tick(G) {
    N.G = G;
    if (N.rolle !== 'host') return;
    var K = KO(), koop = K && K.an();
    In().netzMenue(N.status === 'da' && (G.state === 'koop' || (koop && !!FREUND_DARF[G.state])));
  }

  /** Online jeder sein eigenes Bild (Rennen, Minispiele gegeneinander)? */
  function eigeneBilder() { return N.rolle === 'host' && N.status === 'da'; }

  /** koop.js: das Bild von Spieler 2 fuer dieses Bild (statt Splitscreen). */
  function gastBild(c, ueber) { N.gastBild = c; N.gastUeber = ueber || null; }

  /* ---------------- Menue ONLINE (Zustand 'online') ---------------- */

  var FEHLER = {
    keine: ['DIESEN CODE GIBT ES NICHT.', 'STIMMT ER? IST DEIN FREUND NOCH BEI FREUND EINLADEN?'],
    voll: ['DA SPIELT SCHON JEMAND MIT.', 'ZU ZWEIT HEISST ZU ZWEIT.'],
    version: ['IHR HABT VERSCHIEDENE SPIELVERSIONEN.', 'BITTE BEIDE DAS SPIEL AKTUALISIEREN.'],
    blockiert: ['KEINE DIREKTE VERBINDUNG MÖGLICH.', 'EIN NETZWERK BLOCKIERT SIE (SCHUL- ODER FIRMEN-WLAN).',
                'PROBIER EIN ANDERES NETZ ODER DEN HOTSPOT VOM HANDY.'],
    netz: ['DER VERMITTLER IST NICHT ERREICHBAR.', 'BIST DU IM INTERNET? PROBIER ES GLEICH NOCHMAL.'],
    geraet: ['DIESES GERÄT KANN KEINE DIREKTEN VERBINDUNGEN.', 'PROBIER EINEN ANDEREN BROWSER.']
  };

  function menueFehler(grund) {
    N.modus = 'fehler';
    N.fehler = FEHLER[grund] ? grund : 'netz';
    N.idx = 0;
    if (S()) S().play('hurt');
  }

  function oeffnen(G) {
    N.G = G;
    G.state = 'online';
    N.modus = N.rolle === 'host' ? 'host' : (N.rolle === 'gast' ? 'gast' : 'start');
    N.idx = 0;
  }

  function punkte() {
    if (N.modus === 'start') return [{ k: 'einladen', label: 'FREUND EINLADEN' }, { k: 'eingeben', label: 'CODE EINGEBEN' },
                                      { k: 'zurueck', label: 'ZURÜCK' }];
    if (N.modus === 'host') return [{ k: 'zurueck', label: N.status === 'da' ? 'WEITER ZUM SPIEL' : 'ZURÜCK (CODE BLEIBT)' },
                                     { k: 'beenden', label: 'ONLINE BEENDEN' }];
    if (N.modus === 'gast') return [{ k: 'abbrechen', label: 'ABBRECHEN' }];
    if (N.modus === 'fehler') return [{ k: 'ok', label: 'OK' }];
    return [];
  }

  function menueRect(i, n, H) { return { x: 512 / 2 - 90, y: (H || 288) - 24 - (n - i) * 13, w: 180, h: 13 }; }

  function aktivieren(G, it) {
    if (S()) S().play('select');
    if (it.k === 'einladen') { hosten(G); if (N.modus !== 'fehler') { N.modus = 'host'; N.idx = 0; } }
    else if (it.k === 'eingeben') codeEingabe(G);
    else if (it.k === 'zurueck') { if (KO()) KO().oeffnen(G); else G.state = 'title'; }
    else if (it.k === 'beenden') { beenden(false); N.modus = 'start'; N.idx = 0; }
    else if (it.k === 'abbrechen') { beenden(true); N.modus = 'start'; N.idx = 0; }
    else if (it.k === 'ok') { N.modus = 'start'; N.idx = 0; }
  }

  function menuUpdate(G) {
    N.G = G;
    var I = In();
    if (N.modus === 'eingabe') { eingabeUpdate(G); return; }
    var l = punkte(), n = l.length, i, r;
    if (N.idx >= n) N.idx = 0;
    // Link kopieren (Gastgeber im Browser)
    if (N.modus === 'host' && link() && kopierenGedrueckt) { kopierenGedrueckt = false; kopieren(); }
    var mz = G.mausZeigt ? G.mausZeigt() : null;
    if (mz) {
      for (i = 0; i < n; i++) {
        r = menueRect(i, n, G.viewH ? G.viewH() : 288);
        if (mz.x >= r.x && mz.x < r.x + r.w && mz.y >= r.y && mz.y < r.y + r.h && N.idx !== i) { N.idx = i; S().play('move'); }
      }
    }
    var tp = I.tap();
    if (tp) {
      for (i = 0; i < n; i++) {
        r = menueRect(i, n, G.viewH ? G.viewH() : 288);
        if (tp.x >= r.x && tp.x < r.x + r.w && tp.y >= r.y && tp.y < r.y + r.h) { N.idx = i; aktivieren(G, l[i]); return; }
      }
      if (N.modus === 'host' && link() && tp.y > 106 && tp.y < 130) kopieren();
      return;
    }
    if (I.hit('down')) { N.idx = (N.idx + 1) % n; S().play('move'); }
    if (I.hit('up')) { N.idx = (N.idx + n - 1) % n; S().play('move'); }
    if (I.hit('back') || I.hit('pause')) {
      if (N.modus === 'gast') aktivieren(G, { k: 'abbrechen' });
      else if (N.modus === 'fehler') aktivieren(G, { k: 'ok' });
      else aktivieren(G, { k: 'zurueck' });
      return;
    }
    if (I.hit('jump') || I.hit('confirm')) aktivieren(G, l[N.idx]);
  }

  /* ---- Code eingeben ----
     Tastatur: einfach tippen (Enter = verbinden, Rueck = loeschen, Esc = zurueck).
     Controller: hoch/runter = Zeichen, A = weiter, B = loeschen.
     Handy: ein echtes Textfeld (#codeform). Steam Deck: Steams Tastatur. */
  var cursorZeichen = 0;

  function codeEingabe(G) {
    N.modus = 'eingabe';
    N.tipp = '';
    cursorZeichen = 0;
    var D = global.balciDesktop;
    if (G.touch && formular()) { formularAuf(); return; }
    if (D && D.steam && D.texteingabe && In().padDa()) {
      D.texteingabe('CODE VON DEINEM FREUND', CODE_LAENGE).then(function (t) {
        if (N.modus !== 'eingabe' || !t) return;
        var c = saeubern(t);
        if (c.length === CODE_LAENGE) beitreten(G, c); else N.tipp = c;
      });
    }
  }

  function saeubern(t) {
    var v = String(t || '').toUpperCase(), out = '';
    for (var i = 0; i < v.length && out.length < CODE_LAENGE; i++) if (ZEICHEN.indexOf(v.charAt(i)) >= 0) out += v.charAt(i);
    return out;
  }

  function eingabeUpdate(G) {
    var I = In(), n = N.tipp.length;
    // Controller und Pfeile: das Zeichen unter dem Strich durchblaettern
    if (I.hit('up') || I.hit('down')) {
      var d = I.hit('up') ? -1 : 1;
      if (n === 0 || cursorZeichen >= n) { N.tipp += 'A'; cursorZeichen = N.tipp.length - 1; }
      var c = N.tipp.charAt(cursorZeichen), j = (ZEICHEN.indexOf(c) + d + ZEICHEN.length) % ZEICHEN.length;
      N.tipp = N.tipp.slice(0, cursorZeichen) + ZEICHEN.charAt(j) + N.tipp.slice(cursorZeichen + 1);
      S().play('move');
    }
    if (I.hit('right') && N.tipp.length && cursorZeichen < CODE_LAENGE - 1) {
      cursorZeichen++;
      if (cursorZeichen >= N.tipp.length) N.tipp += 'A';
      S().play('move');
    }
    if (I.hit('left') && cursorZeichen > 0) { cursorZeichen--; S().play('move'); }
    if (I.hit('jump') || I.hit('confirm')) {
      if (N.tipp.length === CODE_LAENGE) { beitreten(G, N.tipp); return; }
      if (N.tipp.length) { cursorZeichen = Math.min(CODE_LAENGE - 1, cursorZeichen + 1); if (cursorZeichen >= N.tipp.length) N.tipp += 'A'; }
    }
    if (I.hit('back') || I.hit('pause')) {
      if (N.tipp.length) { N.tipp = N.tipp.slice(0, -1); cursorZeichen = Math.max(0, N.tipp.length - 1); }
      else { formularZu(); N.modus = 'start'; N.idx = 1; }
    }
  }

  // Tastatur beim Code-Eingeben: Buchstaben und Zahlen landen im Code, nicht im Spiel
  if (global.addEventListener) {
    global.addEventListener('keydown', function (e) {
      var G = N.G;
      if (!G || G.state !== 'online' || e.repeat) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (N.modus === 'host' && e.code === 'KeyC') { kopierenGedrueckt = true; e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (N.modus !== 'eingabe') return;
      var c = null;
      if (/^Key[A-Z]$/.test(e.code)) c = e.code.charAt(3);
      else if (/^(Digit|Numpad)[0-9]$/.test(e.code)) c = e.code.charAt(e.code.length - 1);
      if (c !== null) {
        if (ZEICHEN.indexOf(c) >= 0 && N.tipp.length < CODE_LAENGE) { N.tipp += c; cursorZeichen = Math.min(CODE_LAENGE - 1, N.tipp.length); S().play('move'); }
      } else if (e.code === 'Backspace') {
        N.tipp = N.tipp.slice(0, -1); cursorZeichen = N.tipp.length;
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (N.tipp.length === CODE_LAENGE) beitreten(G, N.tipp);
      } else if (e.code === 'Escape') {
        N.modus = 'start'; N.idx = 1;
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  // Das Textfeld fuers Handy (spiel/index.html #codeform)
  function formular() { return global.document && global.document.getElementById('codeform'); }
  function formularAuf() {
    var f = formular(), inp = global.document.getElementById('cfcode');
    if (!f || !inp) return;
    In().releaseAll();
    inp.value = '';
    f.hidden = false;
  }
  function formularZu() {
    var f = formular();
    if (f) f.hidden = true;
    var inp = global.document && global.document.getElementById('cfcode');
    try { if (inp) inp.blur(); } catch (e) {}
  }
  (function formularVerdrahten() {
    var d = global.document;
    if (!d || !d.getElementById) return;
    function los() {
      var form = d.getElementById('cfform'), inp = d.getElementById('cfcode'), zur = d.getElementById('cfzurueck');
      if (!form || !inp) return;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var c = saeubern(inp.value);
        if (c.length !== CODE_LAENGE || !N.G) { inp.value = c; return; }
        formularZu();
        beitreten(N.G, c);
      });
      if (zur) zur.addEventListener('click', function () { formularZu(); N.modus = 'start'; N.idx = 1; });
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', los); else los();
  })();

  /* ---- Link zum Teilen (nur im Browser: die Steam-Version hat keine Adresse) ---- */
  var kopierenGedrueckt = false, kopiertT = 0;
  function link() {
    try {
      var l = global.location;
      // Nur echte Adressen: die Handy-Apps laufen unter localhost, die Steam-Version als Datei
      if (!/^https?:$/.test(l.protocol) || !N.code || /^(localhost|127\.|\[::1\])/.test(l.hostname)) return null;
      return l.origin + l.pathname + '?online=' + N.code;
    } catch (e) { return null; }
  }
  function kopieren() {
    var l = link();
    if (!l) return;
    try {
      if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(l).then(function () { kopiertT = jetzt(); }, function () {});
      }
    } catch (e) {}
  }

  /* ---- Zeichnen ---- */

  function menuDraw(ctx, G, W, H) {
    ctx.globalAlpha = 0.97;
    rect(ctx, 0, 0, W, H, '#0b0712');
    ctx.globalAlpha = 1;
    F().draw(ctx, 'ONLINE ZU ZWEIT', W / 2, 12, { color: '#6fc8e8', align: 'center', scale: 2, shadow: true });
    F().draw(ctx, 'JEDER AN SEINEM GERÄT. DIE BEIDEN GERÄTE VERBINDEN SICH DIREKT.', W / 2, 32, { color: '#c8b8e0', align: 'center' });
    F().draw(ctx, 'DAS SPIEL LÄUFT BEIM GASTGEBER, DER FREUND BEKOMMT BILD UND TON.', W / 2, 43, { color: '#8f86a8', align: 'center' });

    if (N.modus === 'start') zeichneStart(ctx, G, W);
    else if (N.modus === 'host') zeichneHost(ctx, G, W);
    else if (N.modus === 'eingabe') zeichneEingabe(ctx, G, W, H);
    else if (N.modus === 'gast') zeichneGast(ctx, G, W);
    else if (N.modus === 'fehler') zeichneFehler(ctx, G, W);

    var l = punkte(), n = l.length;
    for (var i = 0; i < n; i++) {
      var r = menueRect(i, n, H), sel = i === N.idx;
      if (sel) {
        rect(ctx, r.x, r.y, r.w, r.h - 1, 'rgba(111,200,232,0.16)');
        F().draw(ctx, '|', W / 2 - F().measure(l[i].label, 1, 1) / 2 - 14, r.y + 3, { color: '#6fc8e8' });
      }
      F().draw(ctx, l[i].label, W / 2, r.y + 3, { color: sel ? '#ffffff' : '#d8cfe8', align: 'center', shadow: true });
    }
  }

  /** Zwei Geraete, dazwischen fliegt Honig hin und her. */
  function zweiGeraete(ctx, G, W, y, verbunden, links, rechts) {
    var x1 = W / 2 - 120, x2 = W / 2 + 120, bw = 92, bh = 56;
    [x1, x2].forEach(function (x, i) {
      rect(ctx, x - bw / 2 - 2, y - 2, bw + 4, bh + 4, i ? '#6fc8e8' : '#ffd257');
      rect(ctx, x - bw / 2, y, bw, bh, '#140d1f');
      rect(ctx, x - 10, y + bh + 2, 20, 4, '#3a2f4c');
    });
    var K = KO(), f2 = (K && K.FIGUREN && K._K && K.FIGUREN[K._K.wahl]) || { id: 'esat' };
    var hop = Math.abs(Math.sin(G.tick * 0.08)) * 2;
    P().drawChar(ctx, 'yusuf', x1, y + bh - 6, { pose: 'idle', frame: (G.tick >> 5) & 1, face: 'laugh', scale: 1.5 });
    P().drawChar(ctx, f2.id, x2, y + bh - 6 - hop, { pose: 'idle', frame: (G.tick >> 5) & 1, face: 'laugh', scale: 1.5, flip: true });
    F().draw(ctx, links, x1, y + bh + 10, { color: '#ffd257', align: 'center', shadow: true });
    F().draw(ctx, rechts, x2, y + bh + 10, { color: '#6fc8e8', align: 'center', shadow: true });
    // Die Verbindung: Punkte, die wandern (verbunden: durchgehend und gruen)
    var a = x1 + bw / 2 + 8, b = x2 - bw / 2 - 8, my = y + bh / 2;
    for (var x = a; x <= b; x += 8) {
      var on = verbunden || (((x - a) / 8 + (G.tick >> 3)) % 4 === 0);
      rect(ctx, x, my - 1, 3, 3, on ? (verbunden ? '#8cd85a' : '#ffd257') : '#3a2f4c');
    }
  }

  function zeichneStart(ctx, G, W) {
    zweiGeraete(ctx, G, W, 62, false, 'DU', 'DEIN FREUND');
    F().draw(ctx, 'FREUND EINLADEN = DU BEKOMMST EINEN CODE UND SAGST IHN DEINEM FREUND.', W / 2, 152, { color: '#d8cfe8', align: 'center' });
    F().draw(ctx, 'CODE EINGEBEN = DEIN FREUND HAT DICH EINGELADEN.', W / 2, 163, { color: '#d8cfe8', align: 'center' });
    if (!kannWebRTC()) F().draw(ctx, FEHLER.geraet[0], W / 2, 180, { color: '#ff6a6a', align: 'center' });
  }

  function zeichneHost(ctx, G, W) {
    var da = N.status === 'da';
    F().draw(ctx, 'DEIN CODE', W / 2, 56, { color: '#a89cc0', align: 'center' });
    if (N.code) {
      F().draw(ctx, roh(N.code.split('').join(' ')), W / 2, 68, { color: '#ffffff', align: 'center', scale: 5, shadow: true });
    }
    // Im Browser gibt es dazu einen Link (die Adresse selbst zeigt die Pixelschrift
    // nur in Grossbuchstaben — abtippen ginge schief, darum nur kopieren)
    var l = link(), y = 116;
    if (l) {
      var k = kopiertT && jetzt() - kopiertT < 2500;
      F().draw(ctx, k ? 'LINK KOPIERT! SCHICK IHN DEINEM FREUND.' : (G.touch ? 'HIER TIPPEN = EINLADUNGS-LINK KOPIEREN' : 'C = EINLADUNGS-LINK KOPIEREN'),
               W / 2, y, { color: k ? '#8cd85a' : '#6fc8e8', align: 'center' });
      y += 18;
    } else y += 4;
    var t, col = '#d8cfe8';
    if (N.status === 'verbinden') t = 'MELDE DEN CODE BEIM VERMITTLER AN ...';
    else if (N.status === 'warten') t = 'WARTE AUF DEINEN FREUND ...';
    else if (N.status === 'koppeln') { t = 'DEIN FREUND KLOPFT AN ...'; col = '#ffd257'; }
    else if (da) { t = 'VERBUNDEN!' + (N.ping ? '   ' + N.ping + ' MS' : ''); col = '#8cd85a'; }
    else { t = (FEHLER[N.fehler] || FEHLER.netz)[0]; col = '#ff6a6a'; }
    F().draw(ctx, t, W / 2, y + 4, { color: col, align: 'center', scale: da ? 2 : 1, shadow: true });
    if (!da) {
      F().draw(ctx, 'DEIN FREUND WÄHLT: ZU ZWEIT > ONLINE SPIELEN > CODE EINGEBEN', W / 2, y + 20, { color: '#a89cc0', align: 'center' });
      F().draw(ctx, 'DU KANNST SCHON LOSSPIELEN. ER KANN JEDERZEIT DAZUKOMMEN.', W / 2, y + 31, { color: '#8f86a8', align: 'center' });
    } else {
      F().draw(ctx, 'ER STEUERT SPIELER 2. IM MENÜ ZU ZWEIT SUCHT ER SICH SEINE FIGUR AUS.', W / 2, y + 24, { color: '#a89cc0', align: 'center' });
    }
  }

  function zeichneEingabe(ctx, G, W, H) {
    F().draw(ctx, 'CODE VON DEINEM FREUND', W / 2, 62, { color: '#a89cc0', align: 'center' });
    var bw = 40, gap = 10, x0 = W / 2 - (CODE_LAENGE * bw + (CODE_LAENGE - 1) * gap) / 2, y = 78;
    for (var i = 0; i < CODE_LAENGE; i++) {
      var x = x0 + i * (bw + gap), c = N.tipp.charAt(i), aktiv = i === Math.min(cursorZeichen, CODE_LAENGE - 1);
      rect(ctx, x, y, bw, 48, '#1c1428');
      rect(ctx, x, y + 46, bw, 2, aktiv && (G.tick >> 4) % 2 === 0 ? '#ffd257' : '#6a5f80');
      if (c) F().draw(ctx, roh(c), x + bw / 2, y + 10, { color: '#ffffff', align: 'center', scale: 4, shadow: true });
    }
    var pad = In().quelle && In().quelle() === 'pad';
    F().draw(ctx, pad ? 'HOCH / RUNTER = ZEICHEN   A = WEITER   B = LÖSCHEN' : 'EINFACH TIPPEN.   ENTER = VERBINDEN   ESC = ZURÜCK',
             W / 2, 142, { color: '#8f86a8', align: 'center' });
    F().draw(ctx, 'DEIN FREUND SIEHT DEN CODE UNTER ZU ZWEIT > ONLINE SPIELEN > FREUND EINLADEN.', W / 2, 160, { color: '#6a5f80', align: 'center' });
  }

  function zeichneGast(ctx, G, W) {
    zweiGeraete(ctx, G, W, 62, false, 'DEIN FREUND', 'DU');
    var t = N.status === 'koppeln' ? 'BAUE DIE DIREKTE VERBINDUNG AUF ...'
          : (N.status === 'suchen' ? 'SUCHE DAS SPIEL VON DEINEM FREUND ...' : 'VERBINDE ...');
    F().draw(ctx, 'CODE ' + roh(N.code || ''), W / 2, 150, { color: '#ffffff', align: 'center', scale: 2, shadow: true });
    F().draw(ctx, t, W / 2, 172, { color: '#ffd257', align: 'center' });
  }

  function zeichneFehler(ctx, G, W) {
    var z = FEHLER[N.fehler] || FEHLER.netz;
    for (var i = 0; i < z.length; i++) {
      F().draw(ctx, z[i], W / 2, 90 + i * 14, { color: i ? '#d8cfe8' : '#ff6a6a', align: 'center', shadow: true });
    }
  }

  /* ---------------- Start ---------------- */

  /** game.js beim Start: ?online=CODE in der Adresse = direkt beitreten. */
  function start(G) {
    N.G = G;
    var m = null;
    try { m = /[?&]online=([A-Za-z0-9]{4})\b/.exec(global.location.search || ''); } catch (e) {}
    if (!m) return;
    var c = saeubern(m[1]);
    if (c.length !== CODE_LAENGE) return;
    G.state = 'online';
    beitreten(G, c);
  }

  var api = global.Netz = {
    start: start,
    tick: tick,
    oeffnen: oeffnen, menuUpdate: menuUpdate, menuDraw: menuDraw,
    gastUpdate: gastUpdate, gastDraw: gastDraw,
    nachRender: nachRender,
    eigeneBilder: eigeneBilder, gastBild: gastBild,
    hosten: hosten, beitreten: beitreten, beenden: beenden,
    /** Was gerade los ist (fuer die Menues): rolle, status, code, ping. */
    stand: function () { return { rolle: N.rolle, status: N.status, code: N.code, ping: N.ping }; },
    /** Ist ein Freund online als Spieler 2 da? */
    gastDa: function () { return N.rolle === 'host' && N.status === 'da'; },
    AKT: AKT, ZEICHEN: ZEICHEN,
    ICE: null,                 // Tests/Server: eigene STUN/TURN-Server
    _signalFabrik: null,       // Tests: Vermittler im Speicher statt WebSocket
    _N: N
  };

})(window);
