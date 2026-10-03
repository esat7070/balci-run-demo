/* =====================================================================
   sprites.js — Gegner, Items, Blöcke, Deko und Tiles.
   Alles handgepixelt. Die Tiles entstehen aus zwei selbstgezeichneten
   Masken plus einer Farbpalette pro Welt.
   ===================================================================== */
(function (global) {
  'use strict';

  var P = global.Pixel;

  /* ---------------------------------------------------------------
     Paletten für Objekte
     --------------------------------------------------------------- */

  P.palette('obj', {
    k: '#1b1220',
    // Metall
    m: '#b9c1d6', M: '#6f7791', f: '#f2f2ee', b: '#2a2030',
    // Rot / Gelb
    r: '#e0483c', R: '#a72e26',
    y: '#ffc23c', Y: '#ffe38a', o: '#e08a1e',
    w: '#ffffff', W: '#b9c2d0',
    // Grün
    g: '#4aa832', G: '#2d6b1f', l: '#8cd85a', L: '#c4f08a',
    // Braun / Essen
    n: '#b07a3a', N: '#7d5224', c: '#d8a05a', C: '#8a5a2a',
    p: '#f0cc7a', z: '#5e3a1e',
    s: '#f4bd91', d: '#d1946b', t: '#d94040',
    e: '#6fbf4a', u: '#a85a2e', v: '#7d3f1e',
    x: '#fff3c8', q: '#8a5a1e'
  });

  P.palette('heart', {
    k: '#2a0a14', r: '#ff4d6a', R: '#c02040', w: '#ffb3c0'
  });

  P.palette('shake', {
    k: '#1b1220', w: '#eef2f7', W: '#b9c2d0', p: '#ff6fa8', c: '#3a3f4d'
  });

  /* ---------------------------------------------------------------
     GEGNER
     --------------------------------------------------------------- */

  /* Der Wecker. Yusufs natürlicher Feind. */
  P.def('wecker', `
    .kk........kk.
    kmmk......kmmk
    kmMk......kmMk
    .kkkkkkkkkkkk.
    .kmmmmmmmmmmk.
    kmffffffffffmk
    kmfbffffffbfmk
    kmffffffffffmk
    kmffkkkkkkffmk
    kmfffrrrrfffmk
    kmffffrfffffmk
    .kmmmmmmmmmmk.
    .kMMMMMMMMMMk.
    ..kkk....kkk..
  `, 'obj');

  P.def('wecker2', `
    ..kk......kk..
    .kmmk....kmmk.
    .kmMk....kmMk.
    .kkkkkkkkkkkk.
    .kmmmmmmmmmmk.
    kmffffffffffmk
    kmfbffffffbfmk
    kmffffffffffmk
    kmfkkkkkkkkfmk
    kmfffrrrrfffmk
    kmfffffrfffbmk
    .kmmmmmmmmmmk.
    .kMMMMMMMMMMk.
    .kkk......kkk.
  `, 'obj');

  /* Bienen. Sie wissen, wer ihren Honig klaut. */
  P.def('biene', `
    ..ww.....ww..
    .wwww...wwww.
    ..www...www..
    ...kkkkkkk...
    ..kyybbyyyk..
    .kyybbyyybbk.
    kyyybbyyybbyk
    kwybbyyybbyyk
    .kyybbyyybbk.
    ..kyybbyyk...
    ...kkkkkkk...
  `, {
    k: '#1b1220', y: '#ffc23c', b: '#2a2030', w: '#e8f4ff'
  });

  P.def('biene2', `
    .............
    .............
    ...kkkkkkk...
    ..kyybbyyyk..
    .kyybbyyybbk.
    kyyybbyyybbyk
    kwybbyyybbyyk
    .kyybbyyybbk.
    ..kyybbyyk...
    ...kkkkkkk...
    ..ww.....ww..
  `, {
    k: '#1b1220', y: '#ffc23c', b: '#2a2030', w: '#e8f4ff'
  });

  /* Wütender Brokkoli. Gesund und deswegen böse. */
  P.def('broki', `
    ....kkkkkk....
    ..kkggggggkk..
    .kgglggggglgk.
    kgggggllgggggk
    kglggggggggglk
    kgggwbggwbgggk
    kGggkkkkkkggGk
    ..kGgggggggk..
    ...kGgggggk...
    ....kssssk....
    ....kssssk....
    ....kssssk....
    ...kssssssk...
    ...kkk..kkk...
  `, {
    k: '#14200f', g: '#4aa832', G: '#2d6b1f', l: '#7fd44a',
    s: '#bde08a', w: '#ffffff', b: '#1b1220'
  });

  P.def('broki2', `
    ....kkkkkk....
    ..kkggggggkk..
    .kgglggggglgk.
    kgggggllgggggk
    kglggggggggglk
    kgggwbggwbgggk
    kGggkkkkkkggGk
    ..kGgggggggk..
    ...kGgggggk...
    ....kssssk....
    ....kssssk....
    ...kssssssk...
    ...kssssssk...
    ..kkk....kkk..
  `, {
    k: '#14200f', g: '#4aa832', G: '#2d6b1f', l: '#7fd44a',
    s: '#bde08a', w: '#ffffff', b: '#1b1220'
  });

  /* Hüpfender Salatkopf. */
  P.def('salat', `
    ....kkkkkk....
    ..kkllllllkk..
    .kllggllggllk.
    kllllllllllllk
    klgllllllllglk
    kllwbllllwbllk
    kllllllllllllk
    kllllkmmkllllk
    kglllllllllglk
    .kgllllllllgk.
    ..kGgllllgGk..
    ...kkkkkkkk...
  `, {
    k: '#16260f', l: '#8cd85a', g: '#4aa832', G: '#2d6b1f',
    w: '#ffffff', b: '#1b1220', m: '#7d2724'
  });

  P.def('salat2', `
    ..............
    ....kkkkkk....
    ..kkllllllkk..
    .kllggllggllk.
    kllllllllllllk
    klgllllllllglk
    kllwbllllwbllk
    kllkkmmmmkkllk
    kglllllllllglk
    .kgllllllllgk.
    ..kGgllllgGk..
    ...kkkkkkkk...
  `, {
    k: '#16260f', l: '#8cd85a', g: '#4aa832', G: '#2d6b1f',
    w: '#ffffff', b: '#1b1220', m: '#7d2724'
  });

  /* LENNART. Bulky. Dunkelblond, kurze Seiten, braunes Polo mit
     weissem Kragenstreifen. Fragt dich trotzdem, ob du ins Gym gehst. */
  var LENNART_PAL = {
    k: '#1b1220', h: '#8a6a3a', H: '#a8874a',
    s: '#e8b894', d: '#c99a72',
    w: '#6b4a34', W: '#f2eee6',     // Polo + Kragenstreifen
    b: '#2f3344', g: '#4a3524', e: '#ffffff',
    m: '#8e2f2c', n: '#d8d4cc'
  };

  P.def('lennart', `
    .......kkkkkk.......
    .....kkhhhhhhkk.....
    ....khhhhhhhhhhk....
    ....khHhhhhhhHhk....
    ....khsssssssshk....
    ....ksegssssgesk....
    ....kssssdssssk.....
    ....ksskmmmmkssk....
    .....kssssssssk.....
    .kksssssssssssssskk.
    kssssWWWWWWWWWWssssk
    kssssswwwwwwwwsssssk
    kdssssWwwwwwwWssssdk
    kdsssswwwwwwwwssssdk
    .kdsswwwwwwwwwwssdk.
    .kwwwwwwwwwwwwwwwwk.
    ..kwwwwwwwwwwwwwwk..
    ..kbbbbbbbbbbbbbbk..
    ..kbbbbbbkkbbbbbbk..
    ..kbbbk......kbbbk..
    ..ksssk......ksssk..
    .knnnnk......knnnnk.
  `, LENNART_PAL);

  P.def('lennart2', `
    .......kkkkkk.......
    .....kkhhhhhhkk.....
    ....khhhhhhhhhhk....
    ....khHhhhhhhHhk....
    ....khsssssssshk....
    ....ksegssssgesk....
    ....kssssdssssk.....
    ....kskkmmmmkksk....
    .....kssssssssk.....
    .kksssssssssssssskk.
    kssssWWWWWWWWWWssssk
    kssssswwwwwwwwsssssk
    kdssssWwwwwwwWssssdk
    kdsssswwwwwwwwssssdk
    .kdsswwwwwwwwwwssdk.
    .kwwwwwwwwwwwwwwwwk.
    ..kwwwwwwwwwwwwwwk..
    ..kbbbbbbbbbbbbbbk..
    ..kbbbbbbkkbbbbbbk..
    ..kbbkk......kkbbk..
    .ksssk........ksssk.
    knnnnk........knnnnk
  `, LENNART_PAL);

  /* Kubide vom Spiess. Yusufs Lieblingskueche ist iranisch. */
  P.def('kubide', `
    .....kkkkkk.....
    ...kkmmmmmmkk...
    ..kmmmmmmmmmmk..
    .kmmMmmmmmmMmmk.
    skmmmmmmmmmmmmks
    skmMmmmmmmmmMmks
    .kmmmmmmmmmmmmk.
    ..kmmmmmmmmmmk..
    ...kkmmmmmmkk...
    .....kkkkkk.....
    ..krrrrrrrrrrk..
    ..kkkkkkkkkkkk..
  `, {
    k: '#3a2410', m: '#a8542a', M: '#7a3818', s: '#c8cede', r: '#f4f0e4'
  });

  /* ERFAN — der Koch. Glatze, Vollbart mit freier Kinnmitte,
     schwarzes Hemd, Goldkette. Und eine Schuerze, weil er arbeitet. */
  var ERFAN_PAL = {
    k: '#140f18', s: '#e0a478', d: '#bc8256', S: '#f0b890',
    j: '#2a1c14', J: '#42301f',       // Bart
    w: '#ffffff', g: '#3a2a1a',       // Augen
    m: '#7d2724', H: '#2a1c14',
    r: '#26262c', R: '#16161a',       // schwarzes Hemd
    y: '#e8c24a', Y: '#fff0a8',       // Goldkette
    a: '#eceae2', A: '#c2c0b8',       // Schuerze
    b: '#2a2a34', n: '#d8d4cc'
  };

  var ERFAN_KUNST = `
    ....kkkkkkkk....
    ..kkSSSSSSSSkk..
    .kSSSSSSSSSSSSk.
    .kSssssssssssSk.
    ..ksssssssssssk.
    ..kjssssssssjk..
    ..kjsgwsswgsjk..
    ..kjsssdssssjk..
    ..kjssHHHHssjk..
    ..kjjskmmksjjk..
    ...kjjssssjjk...
    ....kJssssJk....
    .....kssssk.....
    ..kkrrrrrrrrkk..
    .krryyyyyyyyrrk.
    krrrryyYYyyrrrrk
    krrrrryyyyrrrrrk
    krrrrrrrrrrrrrrk
    krrrrrrrrrrrrrrk
    kaaaaaaaaaaaaaak
    kaaaaaaaaaaaaaak
    kaaaaaaaaaaaaaak
    .kaaaaaaaaaaaak.
    .kAAAAAAAAAAAAk.
    .kbbbbkkkkbbbbk.
    .kbbbk....kbbbk.
    .knnnk....knnnk.
    .kkkkk....kkkkk.
  `;
  P.def('erfan', ERFAN_KUNST, ERFAN_PAL);

  /* Erfan als Boss bekommt ein Laufbild und zwei Formen (Esat, 29.09.:
     "zu langweilig, bei der Mutation soll er anders aussehen"). Seit 02.10.
     sind es der Persische Koenig und der Safran-Koenig (weiter unten);
     die beiden alten Formen bleiben fuer Zwischenszenen definiert:
     SAFRAN-EKSTASE: safranoranges Hemd, Safran-Schuerze, goldene Augen und
       eine Krone aus Krokusblueten — daraus wird Safran gemacht.
     SAMOWAR-RAUSCH: knallrotes Gesicht, rote Augen, dunkelrotes Hemd,
       Tee-Flecken auf der Schuerze, ein Samowar auf dem Ruecken. */
  var ERFAN_ZEILEN = P.art(ERFAN_KUNST);
  function erfanLaufen(z) {
    var n = z.slice(0, z.length - 3);
    return n.concat(['..kbbbk..kbbbk..', '..knnnk..knnnk..', '..kkkkk..kkkkk..']);
  }
  var KROKUS = ['.....o..o..o....', '....coccoccoc...', '....cCccCccCc...'];
  function mit(pal, dazu) {
    var o = {}, k;
    for (k in pal) o[k] = pal[k];
    for (k in dazu) o[k] = dazu[k];
    return o;
  }
  var SAFRAN_PAL = mit(ERFAN_PAL, {
    r: '#e8801a', R: '#b85a10', a: '#ffd257', A: '#e8a830',
    g: '#ffd21a', w: '#fff6c8',
    c: '#9a5ad8', C: '#6a3aa8', o: '#ff3a1a'
  });
  var SAMOWAR_PAL = mit(ERFAN_PAL, {
    s: '#f08a64', d: '#c85e44', S: '#ffb494',
    g: '#e01a1a', w: '#fff0e0',
    r: '#7a1812', R: '#4a0c08', a: '#d8b48a', A: '#a8804e'
  });
  P.def('erfan2', erfanLaufen(ERFAN_ZEILEN), ERFAN_PAL);
  P.def('erfan_safran', KROKUS.concat(ERFAN_ZEILEN), SAFRAN_PAL);
  P.def('erfan_safran2', KROKUS.concat(erfanLaufen(ERFAN_ZEILEN)), SAFRAN_PAL);
  P.def('erfan_samowar', ERFAN_ZEILEN, SAMOWAR_PAL);
  P.def('erfan_samowar2', erfanLaufen(ERFAN_ZEILEN), SAMOWAR_PAL);
  /* Seit 02.10. (Esat): die zweite Form heisst PERSISCHER KOENIG — goldene
     Krone mit Rubin und Saphir, Purpurgewand mit Goldsaum —, die letzte
     SAFRAN-KOENIG: Safrangewand, goldene Augen, Krone mit Krokusblueten. */
  var KRONE = ['....e..ee..e....', '....ee.ee.ee....', '....efeqqefe....'];
  var KOENIG_PAL = mit(ERFAN_PAL, {
    r: '#6a2a9a', R: '#40155e', a: '#8a3ac8', A: '#ffd257',
    e: '#ffd21a', f: '#e01a3a', q: '#3ad0ff'
  });
  var SAFRANKOENIG_PAL = mit(SAFRAN_PAL, {
    s: '#eaa070', S: '#ffc898', a: '#ffb000', A: '#ff3a1a',
    e: '#ffd21a', f: '#9a5ad8', q: '#ff3a1a'
  });
  P.def('erfan_koenig', KRONE.concat(ERFAN_ZEILEN), KOENIG_PAL);
  P.def('erfan_koenig2', KRONE.concat(erfanLaufen(ERFAN_ZEILEN)), KOENIG_PAL);
  P.def('erfan_safrankoenig', KRONE.concat(ERFAN_ZEILEN), SAFRANKOENIG_PAL);
  P.def('erfan_safrankoenig2', KRONE.concat(erfanLaufen(ERFAN_ZEILEN)), SAFRANKOENIG_PAL);
  /* ... und der Samowar auf seinem Ruecken (wird hinter ihm gezeichnet) */
  P.def('samowar_ruecken', `
    ...kk...
    ..kYYk..
    ..kbbk..
    .kbbbbk.
    kbYbbbbk
    kbYbbbbk
    kbYbBbbk
    kbYbbbbk
    .kbbbbk.
    ..kbbk..
    .kbbbbk.
    kbbbbbbk
    kkkkkkkk
  `, { k: '#2a1a0c', b: '#d8a040', B: '#8a5a1a', Y: '#fff0a8' });

  /* Erfan frei und gluecklich — Arme hoch. */
  P.def('erfan_frei', `
    ....kkkkkkkk....
    ..kkSSSSSSSSkk..
    .kSSSSSSSSSSSSk.
    .kSssssssssssSk.
    ..ksssssssssssk.
    ..kjssssssssjk..
    ..kjskwsswksjk..
    ..kjsssdssssjk..
    ..kjssHHHHssjk..
    ..kjjkmmmmkjjk..
    ...kjjmmmmjjk...
    ....kJssssJk....
    .....kssssk.....
    kk.kkrrrrrrrrkk.
    krkrryyyyyyyyrrk
    krkrryyYYyyrrrrk
    krrrrryyyyrrrrrk
    .krrrrrrrrrrrrk.
    .krrrrrrrrrrrrk.
    kaaaaaaaaaaaaaak
    kaaaaaaaaaaaaaak
    kaaaaaaaaaaaaaak
    .kaaaaaaaaaaaak.
    .kAAAAAAAAAAAAk.
    .kbbbbkkkkbbbbk.
    .kbbbk....kbbbk.
    .knnnk....knnnk.
    .kkkkk....kkkkk.
  `, ERFAN_PAL);

  /* Der Kaefig, in dem Huseyin ihn eingesperrt hat. */
  P.def('kaefig', `
    kkkkkkkkkkkkkkkkkkkkkkkk
    kkkkkkkkkkkkkkkkkkkkkkkk
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    kkkkkkkkkkkkkkkkkkkkkkkk
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    kkkkkkkkkkkkkkkkkkkkkkkk
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    kkkkkkkkkkkkkkkkkkkkkkkk
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    k...k...k...k...k...k..k
    kkkkkkkkkkkkkkkkkkkkkkkk
    kkkkkkkkkkkkkkkkkkkkkkkk
  `, { k: '#7c8399' });

  /* Das Kippen-Päckchen. Macht Yusuf rauchig. */
  P.def('kippen', `
    ..kkkkkkkk..
    .kwwwwwwwwk.
    .kwyywyywwk.
    .kkkkkkkkkk.
    krrrrrrrrrrk
    krrrrrrrrrrk
    krrwwwwwwrrk
    krwwwwwwwwrk
    krwwRRRRwwrk
    krwwwwwwwwrk
    krrwwwwwwrrk
    krrrrrrrrrrk
    kRRRRRRRRRRk
    .kkkkkkkkkk.
  `, {
    k: '#2a1018', r: '#d8342e', R: '#8f1f1c', w: '#f4f2ec', y: '#e8c86a'
  });

  /* Die geworfene Kippe. Glut vorne, Filter hinten. */
  P.def('kippe', `
    .kkkkkkkk.
    koRwwwwyyk
    korwwwwyyk
    koRwwwwyyk
    .kkkkkkkk.
  `, {
    k: '#2a1018', o: '#ffb43c', R: '#ff5a24', r: '#e03a12',
    w: '#f4f2ec', y: '#e8c86a'
  });

  /* Alter Fitness-Bro bleibt als Sprite erhalten (unbenutzt, aber harmlos). */
  P.def('bro', `
    .....kkkkkk.....
    ...kkhhhhhhkk...
    ..khhhhhhhhhhk..
    ..khsssssssshk..
    ..kssssssssssk..
    ..kbbbbbbbbbbk..
    ..kssssssssssk..
    ..ksskmmmmkssk..
    ...kssssssssk...
    ....kssssssk....
    .kssssssssssssk.
    ksswwwwwwwwwwssk
    ksswwWWWWWWwwssk
    ksswwwwwwwwwwssk
    kdswwwwwwwwwwsdk
    .kdwwwwwwwwwwdk.
    .kssssssssssssk.
    ..kbbbbbbbbbbk..
    ..kbbbbkkbbbbk..
    ..kbbk....kbbk..
    ..kssk....kssk..
    .kWWWk...kWWWk..
  `, {
    k: '#1b1220', h: '#e8c86a', s: '#e0a068', d: '#b87c4a',
    b: '#2a2030', w: '#f2f4f8', W: '#c0c6d2', m: '#8e2f2c'
  });

  P.def('bro2', `
    .....kkkkkk.....
    ...kkhhhhhhkk...
    ..khhhhhhhhhhk..
    ..khsssssssshk..
    ..kssssssssssk..
    ..kbbbbbbbbbbk..
    ..kssssssssssk..
    ..kskkmmmmkksk..
    ...kssssssssk...
    ....kssssssk....
    .kssssssssssssk.
    ksswwwwwwwwwwssk
    ksswwWWWWWWwwssk
    ksswwwwwwwwwwssk
    kdswwwwwwwwwwsdk
    .kdwwwwwwwwwwdk.
    .kssssssssssssk.
    ..kbbbbbbbbbbk..
    ..kbbbbkkbbbbk..
    ..kbbkk..kkbbk..
    .kssk......kssk.
    kWWWk......kWWWk
  `, {
    k: '#1b1220', h: '#e8c86a', s: '#e0a068', d: '#b87c4a',
    b: '#2a2030', w: '#f2f4f8', W: '#c0c6d2', m: '#8e2f2c'
  });

  /* Diät-Drohne. Überwacht deine Kalorien aus der Luft. */
  P.def('drohne', `
    .bbbb......bbbb.
    ..kk........kk..
    ..kMk......kMk..
    ..kMkkkkkkkkMk..
    ...kmmmmmmmmk...
    ..kmmwwwwwwmmk..
    ..kmwrwwwwrwmk..
    ..kmmwwwwwwmmk..
    ...kMMMMMMMMk...
    ....kMMMMMMk....
    .....krrrrk.....
    ......krrk......
  `, {
    k: '#1b1220', m: '#b9c1d6', M: '#6f7791',
    w: '#dce6f5', r: '#e0483c', b: '#8a93ab'
  });

  P.def('drohne2', `
    ...bb........bb.
    ..kk........kk..
    ..kMk......kMk..
    ..kMkkkkkkkkMk..
    ...kmmmmmmmmk...
    ..kmmwwwwwwmmk..
    ..kmwrwwwwrwmk..
    ..kmmwwwwwwmmk..
    ...kMMMMMMMMk...
    ....kMMMMMMk....
    .....kyyyyk.....
    ......kyyk......
  `, {
    k: '#1b1220', m: '#b9c1d6', M: '#6f7791', w: '#dce6f5',
    r: '#e0483c', y: '#ffc23c', b: '#8a93ab'
  });

  /* ---------------------------------------------------------------
     PROJEKTILE
     --------------------------------------------------------------- */

  P.def('sellerie', `
    ..kk..
    .kggk.
    .kggk.
    .klgk.
    .kggk.
    .klgk.
    .kggk.
    .klgk.
    .kggk.
    .kggk.
    ..kk..
    ..kk..
  `, { k: '#16260f', g: '#4aa832', l: '#8cd85a' });

  P.def('blatt', `
    ...kkkk...
    .kklllgkk.
    kllllllggk
    klllllgggk
    kllglllggk
    kgllllgggk
    .kgllggggk
    ..kkkkkk..
  `, { k: '#16260f', l: '#8cd85a', g: '#4aa832' });

  P.def('shaker', `
    ..kkkkkk..
    .kcccccck.
    .kcccccck.
    .kkkkkkkk.
    kwwwwwwwwk
    kwWwwwwwWk
    kwppppppwk
    kwppppppwk
    kwppppppwk
    kwppppppwk
    kwWppppWwk
    kwwwwwwwwk
    .kWWWWWWk.
    ..kkkkkk..
  `, 'shake');

  /* ---------------------------------------------------------------
     ITEMS
     --------------------------------------------------------------- */

  /* Das Honigglas. Der Grund für alles. */
  P.def('honig', `
    ..kkkkkkkk..
    .kmmmmmmmmk.
    .kMMMMMMMMk.
    ..kkkkkkkk..
    .kyyyyyyyyk.
    kyYyyyyyyyyk
    kyYyyyyyyyyk
    kyYyyyyoyyyk
    kyyyyyoooyyk
    kyyyyoooooyk
    kyyyooooooyk
    kyooooooooyk
    .kooooooook.
    ..kkkkkkkk..
  `, {
    k: '#3a2410', y: '#ffc23c', Y: '#ffe9a8', o: '#e08a1e',
    m: '#a8763c', M: '#6b4522'
  });

  /* Goldhonig. Drei pro Level, von Huseyin immer ganz oben versteckt —
     da, wo Yusuf angeblich nie hinkommt. */
  P.def('goldhonig', `
    ..kkkkkkkk..
    .kmmmmmmmmk.
    .kMMMMMMMMk.
    ..kkkkkkkk..
    .kyyyyyyyyk.
    kyYyyywyyyyk
    kyYywwwwwyyk
    kyYyywwwyyyk
    kyYyywywyyyk
    kyyyyoooyyyk
    kyyyooooooyk
    kyooooooooyk
    .kooooooook.
    ..kkkkkkkk..
  `, {
    k: '#5a3a08', y: '#ffd84a', Y: '#fffbe0', o: '#f0b020',
    m: '#fff0a0', M: '#d8a830', w: '#ffffff'
  });

  /* Döner. Heilt Wunden, Kummer und Montage. */
  P.def('doener', `
    ..kkkkkkkkkk..
    .kBBBBBBBBBBk.
    kBBBBBBBBBBBBk
    kBssmmsstmmsBk
    kBmmssmmttssmk
    kBwwwwwwwwwwBk
    kBsstmmsstmmBk
    kBMmsstmmsstBk
    kbBBBBBBBBBBbk
    .kbBBBBBBBBbk.
    ..kkkkkkkkkk..
  `, {
    k: '#3a2410', B: '#e8c48a', b: '#c49a5c', m: '#a85a2e',
    M: '#7d3f1e', s: '#6fbf4a', t: '#d94040', w: '#f4f0e0'
  });

  /* Baklava. Ein Extraleben. Natürlich. */
  P.def('baklava', `
    ..kkkkkkkkk..
    .kpppppppppk.
    kpPpPpPpPpPpk
    kphhhhhhhhhpk
    kphnnnnnnnhpk
    kphhnnnnnhhpk
    kpPpPpPpPpPpk
    .kPPPPPPPPPk.
    ..kkkkkkkkk..
  `, {
    k: '#3a2410', p: '#f0cc7a', P: '#d9a441',
    h: '#ffb52e', n: '#7fb04a'
  });

  P.def('herz', `
    ..kk...kk..
    .krrk.krrk.
    krwrrkrrrrk
    krwrrrrrrrk
    krwrrrrrrrk
    .krrrrrrrk.
    ..krrrrrk..
    ...krrrk...
    ....krk....
    .....k.....
  `, 'heart');

  /* Der GOLD-DÖNER. Kurzzeitig unbesiegbar. Wissenschaftlich fundiert. */
  P.def('golddoener', `
    ....kkkkkkkk....
    ..kkyYYYYYYykk..
    .kyYYYYYYYYYYyk.
    kyYYYYYYYYYYYYyk
    kyYmmYYmmYYmmYyk
    kyYYmmYYmmYYmmyk
    kywwwwwwwwwwwwyk
    kyYmmYYmmYYmmYyk
    kyYYmmYYmmYYmmyk
    kyYYYYYYYYYYYYyk
    .kyYYYYYYYYYYyk.
    ..kkyYYYYYYykk..
    ....kkkkkkkk....
  `, {
    k: '#6b4a10', y: '#e8a81e', Y: '#ffd868', m: '#c0762a', w: '#fff6d8'
  });

  /* ---------------------------------------------------------------
     BLÖCKE
     --------------------------------------------------------------- */

  P.def('qblock', `
    kkkkkkkkkkkkkkkk
    kwwyyyyyyyyyyook
    kwyyyyyyyyyyyyok
    kyyyyyddddyyyyok
    kyyyydyyyydyyyok
    kyyyyyyyyddyyyok
    kyyyyyyyddyyyyok
    kyyyyyyddyyyyyok
    kyyyyyyddyyyyyok
    kyyyyyyyyyyyyyok
    kyyyyyyddyyyyyok
    kyyyyyyddyyyyyok
    kyyyyyyyyyyyyyok
    kyyyyyyyyyyyyyok
    kyyooooooooooook
    kkkkkkkkkkkkkkkk
  `, { k: '#5e3a10', y: '#ffc23c', o: '#d98a1e', w: '#fff3c8', d: '#7d4a12' });

  P.def('qblock_used', `
    kkkkkkkkkkkkkkkk
    kooooooooooooook
    kooooooooooooook
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    koOOOOOOOOOOOOok
    kooooooooooooook
    kooooooooooooook
    kkkkkkkkkkkkkkkk
  `, { k: '#4a2c0c', o: '#a8742c', O: '#8a5c1e' });

  /* Kekskiste. Zerbricht beim Bauch-Stampfer. */
  P.def('kiste', `
    kkkkkkkkkkkkkkkk
    knnnnnnnnnnnnnnk
    knNnnnnnnnnnnNnk
    knnkkkkkkkkkknnk
    knnkccccccccknnk
    knnkcbccccbcknnk
    knnkcccbccccknnk
    knnkcbcccccbknnk
    knnkccccbcccknnk
    knnkcbccccccknnk
    knnkccccccbcknnk
    knnkccccccccknnk
    knnkkkkkkkkkknnk
    knNnnnnnnnnnnNnk
    knnnnnnnnnnnnnnk
    kkkkkkkkkkkkkkkk
  `, { k: '#3a2410', n: '#b07a3a', N: '#7d5224', c: '#d8a05a', b: '#5e3a1e' });

  /* Sofa-Kissen als Sprungfeder. */
  P.def('feder', `
    ..kkkkkkkkkkkk..
    .kppppppppppppk.
    kpwpppppppppPpk.
    kppppppppppppppk
    kppppppppppppppk
    kPPPPPPPPPPPPPPk
    .kPPPPPPPPPPPPk.
    ..kkkkkkkkkkkk..
    ...kk......kk...
    ...kk......kk...
    ...kk......kk...
    ...kk......kk...
    ...kk......kk...
    ..kkkk....kkkk..
  `, { k: '#3a0f22', p: '#ff7aa8', P: '#c94a78', w: '#ffc4d8' });

  /* Schwebendes Tablett. */
  P.def('tablett', `
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk
    kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk
    kMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMk
    .kkMMMMMMMMMMMMMMMMMMMMMMMMMMkk.
    ...kkkkkkkkkkkkkkkkkkkkkkkkkk...
  `, { k: '#1b1220', m: '#c4cada', M: '#7c8399' });

  /* Gabeln statt Stacheln. Küche ist gefährlich. */
  P.def('gabel', `
    .m.m.m..
    kmkmkmk.
    kmkmkmk.
    kmkmkmk.
    kmmmmmk.
    kmmMmmk.
    .kmmmk..
    .kmMmk..
    .kmmmk..
    .kmMmk..
    .kmmmk..
    .kmMmk..
    .kmmmk..
    .kmMmk..
    .kmmmk..
    .kkkkk..
  `, { k: '#1b1220', m: '#c8cede', M: '#8189a0' });

  /* ---------------------------------------------------------------
     DEKO / ZIELE
     --------------------------------------------------------------- */

  /* Der Riesen-Honigtopf: das Ziel jedes Levels. */
  P.def('ziel', `
    .......kkkkkkkkkk.......
    ......kmmmmmmmmmmk......
    .....kmmmmmmmmmmmmk.....
    .....kMMMMMMMMMMMMk.....
    ....kkkkkkkkkkkkkkkk....
    ...kyyyyyyyyyyyyyyyyk...
    ..kyYyyyyyyyyyyyyyyyyk..
    .kyYyyyyyyyyyyyyyyyyyyk.
    kyYyyyyyyyyyyyyyyyyyyyyk
    kyYyyyyyyyyyyyyyyyyyyyyk
    kyYyyyyyyyoooyyyyyyyyyyk
    kyyyyyyyyoooooyyyyyyyyyk
    kyyyyyyoooooooooyyyyyyyk
    kyyyyoooooooooooooyyyyyk
    kyyoooooooooooooooooyyyk
    kyoooooooooooooooooooyyk
    kyooooooooooooooooooooyk
    kooooooooooooooooooooook
    kooooooooooooooooooooook
    kooooooooooooooooooooook
    kyooooooooooooooooooooyk
    .kooooooooooooooooooook.
    ..kooooooooooooooooook..
    ...kkooooooooooooookk...
    ....kkkkkkkkkkkkkkkk....
    .....kMMMMMMMMMMMMk.....
  `, {
    k: '#3a2410', y: '#ffc23c', Y: '#ffe9a8', o: '#e08a1e',
    m: '#a8763c', M: '#6b4522'
  });

  /* Checkpoint: ein Sofa. Yusuf braucht einfach ab und zu ein Nickerchen. */
  P.def('sofa', `
    ..kkkkkkkkkkkkkkkkkkkk..
    .kcccccccccccccccccccck.
    kcccccccccccccccccccccck
    kccCCccccccccccccccCCcck
    kcckppppppppppppppppkcck
    kcckppppppppppppppppkcck
    kcckppppppppppppppppkcck
    kcccccccccccccccccccccck
    kcCCCCCCCCCCCCCCCCCCCCck
    kcccccccccccccccccccccck
    kcccccccccccccccccccccck
    .kcccccccccccccccccccck.
    .kCCCCCCCCCCCCCCCCCCCCk.
    ..kkk..............kkk..
    ..kCk..............kCk..
    ..kkk..............kkk..
  `, { k: '#2a1020', c: '#8a4a6a', C: '#5e2f48', p: '#ffd257' });

  /* Sofa mit Honig-Fahne — Checkpoint aktiviert. */
  P.def('sofa_on', `
    ..kkkkkkkkkkkkkkkkkkkk..
    .kcccccccccccccccccccck.
    kcccccccccccccccccccccck
    kccCCccccccccccccccCCcck
    kcckyyyyyyyyyyyyyyyykcck
    kcckyYYYYYYYYYYYYYYykcck
    kcckyyyyyyyyyyyyyyyykcck
    kcccccccccccccccccccccck
    kcCCCCCCCCCCCCCCCCCCCCck
    kcccccccccccccccccccccck
    kcccccccccccccccccccccck
    .kcccccccccccccccccccck.
    .kCCCCCCCCCCCCCCCCCCCCk.
    ..kkk..............kkk..
    ..kCk..............kCk..
    ..kkk..............kkk..
  `, { k: '#2a1020', c: '#8a4a6a', C: '#5e2f48', y: '#ffc23c', Y: '#fff0b8' });

  P.def('wolke', `
    ........kkkkkk............
    ......kkwwwwwwkk..........
    .....kwwwwwwwwwwk.........
    ...kkwwwwwwwwwwwwkkkk.....
    ..kwwwwwwwwwwwwwwwwwwkk...
    .kwwwwwwwwwwwwwwwwwwwwwk..
    kwwwwwwwwwwwwwwwwwwwwwwwk.
    kwwwwwwwwwwwwwwwwwwwwwwwk.
    kWWWWWWWWWWWWWWWWWWWWWWWk.
    .kkkkkkkkkkkkkkkkkkkkkkk..
  `, { k: '#c8d8f0', w: '#ffffff', W: '#e0e8f8' });

  P.def('bienenstock', `
    ......kkkkkkk.......
    ....kkyyyyyyykk.....
    ...kyyyyyyyyyyyk....
    ...kYYYYYYYYYYYk....
    ..kyyyyyyyyyyyyyk...
    ..koooooooooooook...
    .kyyyyyyyyyyyyyyyk..
    .kYYYYYYYYYYYYYYYk..
    .koooooooooooooook..
    kyyyyyyyyyyyyyyyyyk.
    kYYYYYYYbbbYYYYYYYk.
    kyyyyyybbbbbyyyyyyk.
    koooooobbbbbooooook.
    kyyyyyyybbbyyyyyyyk.
    kYYYYYYYYYYYYYYYYYk.
    koooooooooooooooook.
    .kyyyyyyyyyyyyyyyk..
    .kYYYYYYYYYYYYYYYk..
    ..koooooooooooook...
    ..kkkkkkkkkkkkkkk...
    .....kkkk.kkkk......
    .....kkkk.kkkk......
  `, { k: '#5e3a18', y: '#e8b44a', Y: '#ffd88a', o: '#b8802c', b: '#2a1a0c' });

  P.def('hantel', `
    .kkkk..........kkkk...
    kmmmmk........kmmmmk..
    kmMMmk........kmMMmk..
    kmMMmkkkkkkkkkkmMMmk..
    kmMMmkMMMMMMMMkmMMmk..
    kmMMmkMMMMMMMMkmMMmk..
    kmMMmkkkkkkkkkkmMMmk..
    kmMMmk........kmMMmk..
    kmmmmk........kmmmmk..
    .kkkk..........kkkk...
  `, { k: '#1b1220', m: '#8a93ab', M: '#5b6376' });

  /* ---------------------------------------------------------------
     LEVEL 6 — Mustang, Stilbruch, Siegerehrung
     --------------------------------------------------------------- */

  /* Der Mustang. Yusuf faehrt, Huseyin sitzt hinten und sagt nichts. */
  P.def('mustang', `
    ..........kkkkkkkkkkkkk.................
    .........kkwwwwwwwwwwwkk................
    ........kkwwwwwwwwwwwwwkk...............
    .......kkwwwwwwwwwwwwwwwkk..............
    kkkkkkkkrrrrrrrrrrrrrrrrrkkkkkkkkkkkkkkk
    krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrllk
    krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrllk
    kRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRk
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    ....kkkkkk.............kkkkkk...........
    ...kttttttk...........kttttttk..........
    ..kttTTTTttk.........kttTTTTttk.........
    ..kttTTTTttk.........kttTTTTttk.........
    ...kttttttk...........kttttttk..........
    ....kkkkkk.............kkkkkk...........
  `, {
    k: '#1b1220', r: '#d8342e', R: '#8f1f1c', w: '#8ec8e8',
    l: '#fff0a8', t: '#241f28', T: '#b9c1d6'
  });

  /* ESAT — bester Kollege. Steht bei der Siegerehrung daneben. */
  P.def('esat', `
    ....kkkkkkkk....
    ..kkhhhhhhhhkk..
    .khhhhhhhhhhhhk.
    .khhssssssssHhk.
    .khssssssssssdk.
    .khsgwsssswgsdk.
    .khssssdssssssk.
    .khsskmmmmkssdk.
    ..kdssssssssdk..
    ...kddddddddk...
    .....kddddk.....
    ..kkkkkkkkkkkk..
    .kppppppppppppk.
    kppppppppppppppk
    kppPPPPPPPPPPppk
    kppPPPPPPPPPPppk
    kppppppppppppppk
    kppppppppppppppk
    .kbbbbbbbbbbbbk.
    .kbbbbbkkbbbbbk.
    .kbbbk....kbbbk.
    .knnnk....knnnk.
    .kkkkk....kkkkk.
  `, {
    k: '#1b1220', h: '#2b1d14', H: '#46301d', s: '#f0b487', d: '#ce8f66',
    w: '#ffffff', g: '#5a8ad8', m: '#8e2f2c',
    p: '#3aa88a', P: '#26775f', b: '#2f3344', n: '#d8d4cc'
  });

  /* Shisha. Steht bei der Siegerehrung bereit. */
  P.def('shisha', `
    .....kk.....
    ....kmmk....
    ....kmmk....
    ...kmmmmk...
    ...kbbbbk...
    ....kmmk....
    ....kmmk....
    ....kmmk....
    ....kmmk....
    ....kmmk....
    ...kmmmmk...
    ..kmmmmmmk..
    ..kwwwwwwk..
    .kwwwwwwwwk.
    .kwwwwwwwwk.
    .kwwwwwwwwk.
    ..kwwwwwwk..
    ..kmmmmmmk..
    ...kkkkkk...
  `, {
    k: '#1b1220', m: '#c8a24a', b: '#5e3a18', w: '#8ad8e8'
  });

  /* Texas Barbecue Brisket. Verdient. */
  P.def('brisket', `
    ................
    ....kkkkkkkk....
    ..kkmmmmmmmmkk..
    .kmmMMmmmmMMmmk.
    .kmMMMMmmMMMMmk.
    kmmMMMMMMMMMMmmk
    kmMMMMMMMMMMMMmk
    kmmMMMMMMMMMMmmk
    .kmmMMMMMMMMmmk.
    ..kkmmmmmmmmkk..
    .kwwwwwwwwwwwwk.
    kwwwwwwwwwwwwwwk
    .kWWWWWWWWWWWWk.
    ..kkkkkkkkkkkk..
  `, {
    k: '#2a1810', m: '#8f3a1e', M: '#5e2410', w: '#e8e4dc', W: '#b8b4ac'
  });

  /* Strassensperre, die der Mustang wegraeumt. */
  P.def('sperre', `
    kkkkkkkkkkkkkkkk
    kyyyykkkkyyyykkk
    kyyyykkkkyyyykkk
    kkkkyyyykkkkyyyk
    kkkkyyyykkkkyyyk
    kyyyykkkkyyyykkk
    kyyyykkkkyyyykkk
    kkkkyyyykkkkyyyk
    kkkkyyyykkkkyyyk
    kyyyykkkkyyyykkk
    kyyyykkkkyyyykkk
    kkkkyyyykkkkyyyk
    kkkkyyyykkkkyyyk
    kyyyykkkkyyyykkk
    kyyyykkkkyyyykkk
    kkkkkkkkkkkkkkkk
  `, { k: '#3a3a44', y: '#ffb43c' });

  /* ---------------------------------------------------------------
     LETZTER KAMPF — Esats Arsenal
     --------------------------------------------------------------- */

  /* Ein KI-Agent. Esat laesst sie scharenweise spawnen. */
  P.def('agent', `
    ...kkkkkkkk...
    .kkwwwwwwwwkk.
    kwwwwwwwwwwwwk
    kwwkkwwwwkkwwk
    kwwkkwwwwkkwwk
    kwwwwwwwwwwwwk
    kwwwkkkkkkwwwk
    kwwwwwwwwwwwwk
    .kkwwwwwwwwkk.
    ..kkkkkkkkkk..
    ....k....k....
    ...kk....kk...
  `, { k: '#0c2b22', w: '#2fd39e' });

  P.def('agent2', `
    ...kkkkkkkk...
    .kkwwwwwwwwkk.
    kwwwwwwwwwwwwk
    kwwwwwwwwwwwwk
    kwwkkkwwkkkwwk
    kwwwwwwwwwwwwk
    kwwwwkkkkwwwwk
    kwwwwwwwwwwwwk
    .kkwwwwwwwwkk.
    ..kkkkkkkkkk..
    ...kk....kk...
    ....k....k....
  `, { k: '#0c2b22', w: '#2fd39e' });

  /* Jet. Fliegt ueber die Arena und laesst etwas fallen. */
  P.def('jet', `
    .................kkkkkk.........
    ...............kkwwwwwwkk.......
    .kkkkk........kkwwwwwwwwwkk.....
    kccwwwkkkkkkkkwwwwrrrwwwwwwkkk..
    kccwwwwwwwwwwwwwwwrrrwwwwwwwwwk.
    kccwwwkkkkkkkkwwwwrrrwwwwwwkkk..
    .kkkkk........kkwwwwwwwwwkk.....
    ...............kkwwwwwwkk.......
    .................kkkkkk.........
  `, {
    k: '#1b1220', w: '#c8cede', W: '#8189a0', r: '#e03a30', c: '#8ec8e8'
  });

  /* Was der Jet fallen laesst. */
  P.def('bombe', `
    ...kk...
    ..kwwk..
    .kwwwwk.
    kwwwwwwk
    kwWwwwWk
    kwwwwwwk
    kwwwwwwk
    kwwwwwwk
    .kwwwwk.
    ..kkkk..
    .k.kk.k.
    k..kk..k
  `, { k: '#1b1220', w: '#6f7791', W: '#454b5e' });

  /* Erfans Reiskorn. Kommt selten allein. */
  P.def('reis', `
    .kkkk.
    kwwwwk
    kwWWwk
    kwwwwk
    .kkkk.
  `, { k: '#8a8478', w: '#f8f6ee', W: '#d8d4c6' });

  /* Mirkans Fragen. Sie kommen als Geschoss. */
  P.def('frage', `
    ..kkkkkk..
    .kyyyyyyk.
    kyykkkkyyk
    kykk..kkyk
    ....kkyyk.
    ...kkyyk..
    ..kkyyk...
    ..kyyk....
    ..kkkk....
    ..........
    ..kyyk....
    ..kkkk....
  `, { k: '#1b2436', y: '#b8c0d4' });

  /* MIRKAN. Haar nach oben, Fade an den Seiten, Vollbart. */
  P.def('mirkan_head', `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhHhhhhhhHhhk
    kkhssssssssHhk
    .khssssssssshk
    .khsgwsswgsdk.
    .khsssdssssdk.
    .khjjjjjjjjdk.
    .khjkmmmmkjdk.
    .kdjjjjjjjjdk.
    ..kdjjjjjjdk..
    ...kddddddk...
  `, {
    k: '#12101a', h: '#1e1712', H: '#382a20', j: '#241c15',
    s: '#e8ac7e', d: '#c2865c', w: '#ffffff', g: '#3a2a1a', m: '#7d2724'
  });

  /* Sein weisser Mercedes: ein E-Klasse-Cabrio, Verdeck unten — damit man
     Mirkan auch sieht. Chromleiste, Stern auf der Haube, getoente Scheibe.
     Der Fahrerkopf wird dahinter gezeichnet (KOPF: wo er sitzt). */
  var MERCEDES = `
    ..........................kcck..........
    ..........................kgck..........
    ...........................kgck.........
    ......kkkkkkk..............kgck.....c...
    .....kvvvvvvvk.kkk..........kgck...cCc..
    ....kvVvvVvvVvkkiik.........kgck....k...
    ..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..
    .kcccccccccccccccccccccccccccccccccccck.
    krrsssssssssssssssssCCssSssssssssssssllk
    kRrSSSkkkkkkSSSSSSSSSSSSSSSSSSkkkkkkSLlc
    kssssnnkkkknnsssssssssssSssssnnkkkknnsoc
    kcccknkttttknkSSSSSSSSSSSSSSknkttttknkck
    .dddkktTTTTtkkddddddddddddddkktTTTTtkkd.
    .kkkkktTHHTtkkkkkkkkkkkkkkkkkktTHHTtkkk.
    .....ktTHHTtk................ktTHHTtk...
    .....ktTTTTtk................ktTTTTtk...
    ......kttttk..................kttttk....
    .......kkkk....................kkkk.....
  `;
  var MERCEDES_FARBEN = {
    k: '#12141c', s: '#f4f6fa', S: '#cdd3de', d: '#8e96a6',
    c: '#e2e8f2', C: '#8a94a8', g: '#9ccbeb88',
    v: '#3c3642', V: '#26212c', i: '#8a4a32',
    l: '#fff0a8', L: '#f0a830', o: '#ffb040', r: '#e8403a', R: '#8a1c1c',
    t: '#26222a', T: '#c8d0de', H: '#8a93a6', n: '#1a1a22'
  };
  function mercedesFarben(extra) {
    var f = {}, k;
    for (k in MERCEDES_FARBEN) f[k] = MERCEDES_FARBEN[k];
    for (k in extra) f[k] = extra[k];
    return f;
  }
  P.def('mercedes', MERCEDES, MERCEDES_FARBEN).kopf = [15, -5];
  /* ... nach dem Felgenwechsel: schwarze Felgen. Die richtigen. Sagt er. */
  P.def('mercedes_felgen', MERCEDES, mercedesFarben({
    t: '#5a5662', T: '#0a0a0e', H: '#2a2a30'    // Reifen heller, damit man die schwarzen Felgen sieht
  })).kopf = [15, -5];
  /* Seine alten Felgen: die wirft er jetzt weg. Nach Yusuf. */
  P.def('felge', `
    ....kkkk....
    ..kkSSSSkk..
    .kSSsSSsSSk.
    .kSsSkkSsSk.
    kSSSkkkkSSSk
    kSsSkkkkSsSk
    kSsSkkkkSsSk
    kSSSkkkkSSSk
    .kSsSkkSsSk.
    .kSSsSSsSSk.
    ..kkSSSSkk..
    ....kkkk....
  `, { k: '#12141c', S: '#d6dbe6', s: '#8a92a4' });

  /* Erfans schwarzer CLA: flaches Coupe-Dach. */
  P.def('cla', `
    ...........kkkkkkkkkkk............
    .........kkwwwwwwwwwwwkkk.........
    .......kkwwwwwwwwwwwwwwwwkk.......
    .....kkwwwwwwwwwwwwwwwwwwwwkk.....
    kkkkksssssssssssssssssssssssskkkkk
    kssssssssssssssssssssssssssssssllk
    kcsssssssssssssssssssssssssssssllk
    kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    ....kkkkkk..............kkkkkk....
    ...kttttttk............kttttttk...
    ..kttTTTTttk..........kttTTTTttk..
    ..kttTTTTttk..........kttTTTTttk..
    ...kttttttk............kttttttk...
    ....kkkkkk..............kkkkkk....
  `, {
    k: '#060608', s: '#25262e', S: '#111116', w: '#3e5068',
    l: '#fff0a8', c: '#aeb6c6', t: '#1c1a20', T: '#9aa2b4'
  });

  /* Lennarts silberne E-Klasse: kantiger, mit Mittelsaeule. */
  P.def('eklasse', `
    .........kkkkkkkkkkkkkkk..........
    ........kwwwwwwkwwwwwwwwk.........
    .......kwwwwwwwkwwwwwwwwwk........
    ......kwwwwwwwwkwwwwwwwwwwk.......
    kkkkkksssssssssssssssssssssskkkkkk
    kssssssssssssssssssssssssssssssllk
    kccccccccccccccccccccccccccccccllk
    kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    ....kkkkkk..............kkkkkk....
    ...kttttttk............kttttttk...
    ..kttTTTTttk..........kttTTTTttk..
    ..kttTTTTttk..........kttTTTTttk..
    ...kttttttk............kttttttk...
    ....kkkkkk..............kkkkkk....
  `, {
    k: '#14161c', s: '#c4c9d2', S: '#868d9a', w: '#46607a',
    l: '#fff0a8', c: '#eef2f8', t: '#1c1a20', T: '#d4d9e4'
  });

  /* Erfans Kopf fuers Autofenster: Glatze, Vollbart, Kinn frei. */
  P.def('erfan_head', `
    ....kkkkkk....
    ..kksssssskk..
    .kssssssssssk.
    ksssssssssssHk
    kssssssssssssk
    .kssgwsswgsdk.
    .kjssssdsssjk.
    .kjjssssssjjk.
    .kjjkmmmmkjjk.
    .kjjjsssjjjdk.
    ..kjjsssjjdk..
    ...kjdddjdk...
    ....kkkkkk....
  `, {
    k: '#12101a', s: '#d9a276', d: '#b5805a', H: '#f2c9a0', j: '#1d1712',
    g: '#2a2016', w: '#ffffff', m: '#7d2724'
  });

  /* Lennarts Kopf: kurze braune Haare, breiter Nacken. */
  P.def('lennart_head', `
    ....kkkkkk....
    ..kkhhhhhhkk..
    .khhhhhhhhhhk.
    khhhhhhhhhhhhk
    khsssssssssshk
    .ksgwsssswgsk.
    .kssssdssssdk.
    .kssssssssssk.
    .ksskmmmmkssk.
    ..kssssssssk..
    ...kddddddk...
  `, {
    k: '#12101a', h: '#6a4424', s: '#f0c09a', d: '#cf9a74',
    g: '#2a3a5a', w: '#ffffff', m: '#8a3030'
  });

  /* Polizei. Blaue Uniform, Muetze, Schnurrbart, Strafzettel-Block. */
  var POLIZEI_PAL = {
    k: '#10121c', b: '#2c4a8c', B: '#1e3566', y: '#22242c', s: '#f0c09a',
    d: '#cf9a74', g: '#1a1a1a', m: '#5a3a28', w: '#ffd257', n: '#1f2a44'
  };
  P.def('polizei', `
    ...kkkkkkkk...
    ..kbbbbbbbbk..
    ..kbbbwwbbbk..
    .kkkkkkkkkkkk.
    ..kssssssssk..
    ..ksgsssgsdk..
    ..kssssssssk..
    ..kssmmmmssk..
    ...kssssssk...
    ..kkbbbbbbkk..
    .kbbbbwbbbbbk.
    kbbbbbbbbbbbbk
    kbBbbbbbbbbBbk
    ksbbbbbbbbbbsk
    kskbbbbbbbbksk
    .kkyyyyyyyykk.
    ..knnnnnnnnk..
    ..knnnnnnnnk..
    ..knnnkknnnk..
    ..knnnkknnnk..
    ..knnnkknnnk..
    ..knnk..knnk..
    .kkkkk..kkkkk.
    .kkkkk..kkkkk.
  `, POLIZEI_PAL);
  P.def('polizei2', `
    ...kkkkkkkk...
    ..kbbbbbbbbk..
    ..kbbbwwbbbk..
    .kkkkkkkkkkkk.
    ..kssssssssk..
    ..ksgsssgsdk..
    ..kssssssssk..
    ..kssmmmmssk..
    ...kssssssk...
    ..kkbbbbbbkk..
    .kbbbbwbbbbbk.
    kbbbbbbbbbbbbk
    kbBbbbbbbbbBbk
    ksbbbbbbbbbbsk
    kskbbbbbbbbksk
    .kkyyyyyyyykk.
    ..knnnnnnnnk..
    ..knnnnnnnnk..
    ..knnnkknnnk..
    .knnnk..knnnk.
    .knnk....knnk.
    .knnk....knnk.
    kkkkk....kkkkk
    kkkkk....kkkkk
  `, POLIZEI_PAL);

  /* Strafzettel. Fliegt im Bogen. */
  P.def('zettel', `
    kkkkkkkkkk
    kwwwwwwwwk
    kwkkkkwwwk
    kwwwwwwwwk
    kwkkkkkkwk
    kwwwwwwwwk
    kkkkkkkkkk
  `, { k: '#3a3a48', w: '#f4f4ee' });

  /* ---------------------------------------------------------------
     LEVEL 8 — der Morgen danach: Handy, Hand und sehr viel Essen
     --------------------------------------------------------------- */

  P.palette('food', {
    k: '#3a2412',
    b: '#e8b55c', B: '#c98f3e', w: '#fff4d8', l: '#6fbf4a',
    m: '#8a4a28', M: '#5e3018', c: '#ffcf4a', q: '#7d2318',
    r: '#e0483c', R: '#a72e26', y: '#ffd257', Y: '#e0a81e',
    n: '#d8a05a', N: '#a8763c', o: '#f0e0d0', s: '#f4bd91',
    z: '#2a2030', Z: '#4a4258', f: '#f2f2ee'
  });

  /* Beefy — der grosse Burger. */
  P.def('food_beefy', `
    ..kkkkkkkkkkkk..
    .kbbbbbbbbbbbbk.
    kbbwbbbwbbbwbbbk
    kbbbbbbbbbbbbbbk
    kllllllllllllllk
    kmmmmmmmmmmmmmmk
    kcccccccccccccck
    kBBBBBBBBBBBBBBk
    .kkkkkkkkkkkkkk.
  `, 'food');

  /* Rippen-Burger. Sauce bis zum Ellenbogen. */
  P.def('food_rippen', `
    ..kkkkkkkkkkkk..
    .kbbbbbbbbbbbbk.
    kbbbbbbbbbbbbbbk
    kqqqqqqqqqqqqqqk
    kmqmqmqmqmqmqmqk
    kqqqqqqqqqqqqqqk
    kooooooooooooook
    kBBBBBBBBBBBBBBk
    .kkkkkkkkkkkkkk.
  `, 'food');

  /* Chipstuete. */
  P.def('food_chips', `
    .kkkkkkkkkk.
    kwwwwwwwwwwk
    kwrrrrrrrrwk
    kwrwwwwwwrwk
    kwrwyyyywrwk
    kwrwyyyywrwk
    kwrwwwwwwrwk
    kwrrrrrrrrwk
    kwwwwwwwwwwk
    kwrrrrrrrrwk
    kwwwwwwwwwwk
    .kkkkkkkkkk.
  `, 'food');

  /* Pommes in der roten Schachtel. */
  P.def('food_pommes', `
    ...yy..yy.....
    ..yy..yy..yy..
    ..yy..yy..yy..
    .kkkkkkkkkkkk.
    .krrrrrrrrrrk.
    .krwwwwwwwwrk.
    .krrrrrrrrrrk.
    .krrrrrrrrrrk.
    ..krrrrrrrrk..
    ..kkkkkkkkkk..
  `, 'food');

  /* Tafel Schokolade. */
  P.def('food_schoko', `
    kkkkkkkkkkkkkkkk
    kMMMMMMMMMMMMMMk
    kMnnMnnMnnMnnMMk
    kMnnMnnMnnMnnMMk
    kMMMMMMMMMMMMMMk
    kMnnMnnMnnMnnMMk
    kMnnMnnMnnMnnMMk
    kMMMMMMMMMMMMMMk
    kffffffffffffffk
    kkkkkkkkkkkkkkkk
  `, 'food');

  /* Nuggets in der Schachtel. */
  P.def('food_nuggets', `
    ...nnn...nnn....
    ..nnnnn.nnnnn...
    ..nnnnn.nnnnn...
    kkkkkkkkkkkkkkkk
    krrrrrrrrrrrrrrk
    krrwwwwwwwwwwrrk
    krrwwwwwwwwwwrrk
    krrrrrrrrrrrrrrk
    .kkkkkkkkkkkkkk.
    ..kkkkkkkkkkkk..
  `, 'food');

  /* Ein Apfel. In diesem Spiel eine Bedrohung. */
  P.def('food_apfel', `
    .....kz.....
    ....kzlk....
    ..kkrrrrkk..
    .krrrrrrrrk.
    krrrrrrrrrrk
    krrwrrrrrrrk
    krwrrrrrrrrk
    krrrrrrrrrrk
    krrrrrrrrrrk
    .krrrrrrrrk.
    ..kkrrrrkk..
    ....kkkk....
  `, 'food');

  /* Das Handy. Erfan ruft an, und zwar hartnaeckig. */
  P.def('handy', `
    kkkkkkkkkk
    kZZZZZZZZk
    kZffffffZk
    kZffffffZk
    kZffffffZk
    kZffffffZk
    kZffffffZk
    kZffffffZk
    kZZZZZZZZk
    kZZkkkkZZk
    kkkkkkkkkk
  `, 'food');

  /* Yusufs Hand — damit zieht man das Essen zum Mund. */
  P.def('hand', `
    ...kk.......
    ..kssk......
    ..kssk.kk...
    ..kssk.ksk..
    ..ksskkkssk.
    .kkssssssssk
    .ksssssssssk
    .ksssssssssk
    .ksssssssssk
    ..kssssssssk
    ..kssssssskk
    ...kkkkkkkk.
  `, 'food');

  /* ---------------------------------------------------------------
     LEVEL 9 — Sparmarkt: Einkaufswagen, Gemuese, Wurst, Alkohol
     --------------------------------------------------------------- */

  P.palette('markt', {
    k: '#2a2a34',
    m: '#c8ccd6', M: '#8a8e98', f: '#f2f4f8',
    r: '#e0483c', R: '#a72e26', g: '#4aa832', G: '#2d6b1f',
    y: '#ffd257', Y: '#e0a81e', o: '#ff8a2a',
    b: '#5c7fd8', B: '#36508f', w: '#ffffff', W: '#b9c2d0',
    n: '#b07a3a', N: '#7d5224', s: '#f4bd91', d: '#d1946b',
    p: '#f08aa8', P: '#c05878', z: '#6fbf4a', c: '#a8e0f0',
    v: '#8fd8ff', x: '#3a5a3a'
  });

  /* Einkaufswagen. Rollt, wenn er dich sieht. */
  P.def('wagen', `
    k......kkkkkkkkkkk...
    kk....kmmmmmmmmmmk...
    .kk..kmMmMmMmMmMmk...
    ..kkkkmmmmmmmmmmmk...
    ...kmmMmMmMmMmMmMk...
    ...kmmmmmmmmmmmmmk...
    ...kMmMmMmMmMmMmMk...
    ...kmmmmmmmmmmmmk....
    ...kkkkkkkkkkkkk.....
    ...k...........k.....
    ..kkk.........kkk....
    .kMMMk.......kMMMk...
    .kMMMk.......kMMMk...
    ..kkk.........kkk....
  `, 'markt');

  P.def('wagen2', `
    k......kkkkkkkkkkk...
    kk....kmmmmmmmmmmk...
    .kk..kmMmMmMmMmMmk...
    ..kkkkmmmmmmmmmmmk...
    ...kmmMmMmMmMmMmMk...
    ...kmmmmmmmmmmmmmk...
    ...kMmMmMmMmMmMmMk...
    ...kmmmmmmmmmmmmk....
    ...kkkkkkkkkkkkk.....
    ...k...........k.....
    ..kkk.........kkk....
    .kMkMk.......kMkMk...
    .kMkMk.......kMkMk...
    ..kkk.........kkk....
  `, 'markt');

  /* Wuetende Tomate aus der Gemueseabteilung. */
  P.def('tomate', `
    ....xx....
    ..xxzzxx..
    ...kkkk...
    ..krrrrk..
    .krrrrrrk.
    krrwrrwrrk
    krrrkkrrrk
    krrrrrrrrk
    .kRRRRRRk.
    ..kkkkkk..
  `, 'markt');

  P.def('tomate2', `
    ....xx....
    ..xxzzxx..
    ...kkkk...
    ..krrrrk..
    .krrrrrrk.
    krwrrrrwrk
    krrkkkkrrk
    krrrrrrrrk
    .kRRRRRRk.
    ..kkkkkk..
  `, 'markt');

  /* Wurst aus der Fleischtheke. Laeuft. Irgendwie. */
  P.def('wurst', `
    ..kkkkkkkkkk..
    .kRRRRRRRRRRk.
    krRRwRRRwRRRk.
    krRRkRRRkRRRk.
    krRRRRRRRRRRk.
    .kRRRRRRRRRRk.
    ..kkkkkkkkkk..
    ...k......k...
    ..kkk....kkk..
  `, 'markt');

  P.def('wurst2', `
    ..kkkkkkkkkk..
    .kRRRRRRRRRRk.
    krRRwRRRwRRRk.
    krRRkRRRkRRRk.
    krRRRRRRRRRRk.
    .kRRRRRRRRRRk.
    ..kkkkkkkkkk..
    ..k........k..
    .kkk......kkk.
  `, 'markt');

  /* Wodkaflasche — Alex' Lieblingswurfgeschoss. */
  P.def('wodka', `
    ..kkk..
    ..kwk..
    ..kwk..
    .kkwkk.
    .kwwwk.
    kwvvvwk
    kwvvvwk
    kwvvvwk
    kwfffwk
    kwvvvwk
    kwvvvwk
    .kwwwk.
    ..kkk..
  `, 'markt');

  /* Bierflasche (Alex im letzten Herz): braunes Glas, Etikett, Kronkorken. */
  P.def('bierflasche', `
    ..yy..
    ..kk..
    ..GG..
    .kGGk.
    kGGGGk
    kGwwGk
    kGwwGk
    kHGGGk
    kHGGGk
    kGGGGk
    kGGGGk
    .kkkk.
  `, { k: '#2a1808', y: '#ffd257', G: '#8a4a14', H: '#c8823a', w: '#f4f0e0' });

  /* Bierdose. */
  P.def('bier', `
    kkkkkkk
    kMMMMMk
    kyyyyyk
    kyrrryk
    kyyyyyk
    kMMMMMk
    kMMMMMk
    kkkkkkk
  `, 'markt');

  /* Kotze. Wir haben es versucht, schoen zu machen. */
  P.def('kotze', `
    ..zzz.....
    .zzggzz...
    zzgggggz..
    .zggzggz..
    ..zzzzz...
  `, 'markt');

  /* Preisschild fuer die Regale. */
  P.def('preis', `
    kkkkkkkkkk
    kyyyyyyyyk
    kyrrrrrryk
    kyyyyyyyyk
    kkkkkkkkkk
  `, 'markt');

  /* Kasse am Ausgang. */
  P.def('kasse', `
    ......kkkkkkkk......
    .....kmmmmmmmmk.....
    ....kmffffffffmk....
    ....kmfvvvvvvfmk....
    ....kmffffffffmk....
    .....kmmmmmmmmk.....
    kkkkkkkkkkkkkkkkkkkk
    kMMMMMMMMMMMMMMMMMMk
    kMkkkkkkkkkkkkkkkkMk
    kMkmmmmmmmmmmmmmmkMk
    kMkkkkkkkkkkkkkkkkMk
    kMMMMMMMMMMMMMMMMMMk
    kkkkkkkkkkkkkkkkkkkk
  `, 'markt');

  /* Einkaufstuete fuer den Heimweg. */
  P.def('tuete', `
    .kk....kk.
    kkkkkkkkkk
    kyyyyyyyyk
    kyzzyyzzyk
    kyyyyyyyyk
    kyrryyrryk
    kyyyyyyyyk
    kyyyyyyyyk
    kkkkkkkkkk
  `, 'markt');

  /* ---------------------------------------------------------------
     LEVEL 11 — Broke und die Mikas
     --------------------------------------------------------------- */

  /* Ein Mika. Brokes kleiner Kollege — und davon gibt es viele.
     Schwarze Haare mit Seitenscheitel, duenner Schnurrbart, schwarzes Shirt. */
  var MIKA_PAL = {
    k: '#0c0a10', h: '#231c24', H: '#443a46', s: '#e4b088', d: '#c8926a',
    g: '#1e1614', w: '#ffffff', j: '#2a1e18', m: '#8a3a34',
    y: '#1c1c24', b: '#2e3448', n: '#e8e8ee'
  };
  P.def('mika', `
    ...kkkkk...
    ..khhhhhk..
    .khhhHHhhk.
    .khhhhhhhk.
    .ksshhhhsk.
    .ksgwsgwsk.
    .ksssdsssk.
    .kssjjjssk.
    .ksskmkssk.
    ..kssssdk..
    .kyyyyyyyk.
    kyyyyyyyyyk
    ksyyyyyyysk
    .kbbbbbbbk.
    .kbbk.kbbk.
    .knnk.knnk.
  `, MIKA_PAL);
  P.def('mika2', `
    ...kkkkk...
    ..khhhhhk..
    .khhhHHhhk.
    .khhhhhhhk.
    .ksshhhhsk.
    .ksgwsgwsk.
    .ksssdsssk.
    .kssjjjssk.
    .ksskmkssk.
    ..kssssdk..
    .kyyyyyyyk.
    kyyyyyyyyyk
    ksyyyyyyysk
    .kbbbbbbbk.
    kbbk...kbbk
    knnk...knnk
  `, MIKA_PAL);

  /* ---------------------------------------------------------------
     LEVEL 12 — Downhill. Drei Fahrraeder, ein kaputtes.
     --------------------------------------------------------------- */

  var BIKE_ART = `
    .................kkkkk........
    ...................k..........
    .........kkkkk.....k..........
    ...........f.......kF.........
    .....kkkkk.ffffffffFFkkkk.....
    ...kktttttFkFFFFFFFFFFtttkk...
    ..kktt.T.tFkf....kkfFFT.ttkk..
    ..kt...T.F.tf....kf..FF...tk..
    .ktt...TF..tfk..fft..FF...ttk.
    .kt....TF...fk.fkt....FF...tk.
    .ktTTTTFFFFctff.ktTTTTFFTTTtk.
    .kt....T...FFc..kt....T....tk.
    .ktt...T...ttk.cktt...T...ttk.
    ..kt...T...tk....kt...T...tk..
    ..kktt.T.ttkk....kktt.T.ttkk..
    ...kktttttkk......kktttttkk...
    .....kkkkk..........kkkkk.....
  `;
  // Zweites Bild: die Speichen stehen schraeg, das Rad dreht sich
  var BIKE_ART2 = `
    .................kkkkk........
    ...................k..........
    .........kkkkk.....k..........
    ...........f.......kF.........
    .....kkkkk.ffffffffFFkkkk.....
    ...kktttttFkFFFFFFFFFFtttkk...
    ..kktt...tFkf....kkfFF..ttkk..
    ..ktT....FTtf....kfT.FF..Ttk..
    .ktt.T..FT.tfk..fft.TFF.T.ttk.
    .kt...T.F...fk.fkt...TFF...tk.
    .kt....FFFFctff.kt....FF...tk.
    .kt...T.T..FFc..kt...T.T...tk.
    .ktt.T...T.ttk.cktt.T...T.ttk.
    ..ktT.....Ttk....ktT.....Ttk..
    ..kktt...ttkk....kktt...ttkk..
    ...kktttttkk......kktttttkk...
    .....kkkkk..........kkkkk.....
  `;
  function bikePal(frame, frameDark) {
    return { k: '#15121a', t: '#2c2a30', T: '#8a8a96', o: '#c8c8d0',
             f: frame, F: frameDark, c: '#6a6a74' };
  }
  // Yusuf: honiggelb. Esat: tuerkis. Lennart: pink, natuerlich.
  P.def('bike', BIKE_ART, bikePal('#ffb43c', '#c87a1e'));
  P.def('bike2', BIKE_ART2, bikePal('#ffb43c', '#c87a1e'));
  P.def('bike_e', BIKE_ART, bikePal('#4ad8c8', '#1e8a86'));
  P.def('bike_e2', BIKE_ART2, bikePal('#4ad8c8', '#1e8a86'));
  P.def('bike_l', BIKE_ART, bikePal('#ff6fa8', '#b83a70'));
  P.def('bike_l2', BIKE_ART2, bikePal('#ff6fa8', '#b83a70'));

  /* Was von Lennarts Rad uebrig ist. */
  P.def('bike_kaputt', `
    ....................kk..
    ....kkkkk............kkk
    ......f.............k...
    .......f...........k....
    .......f.........ff.F...
    .......ff......ff...F...
    ...ffff..FFF.ff......F..
    .ff.........c........F..
    .............c........F.
  `, bikePal('#ff6fa8', '#b83a70'));

  /* Ein einzelnes Rad. Rollt davon. */
  P.def('rad', `
    ....kkkkk....
    ..kktttttkk..
    .kktt.T.ttkk.
    .kt...T...tk.
    ktt...T...ttk
    kt....T....tk
    ktTTTToTTTTtk
    kt....T....tk
    ktt...T...ttk
    .kt...T...tk.
    .kktt.T.ttkk.
    ..kktttttkk..
    ....kkkkk....
  `, bikePal('#ff6fa8', '#b83a70'));

  /* Dornbusch am Wegrand. Nicht reinfahren. */
  P.def('dornbusch', `
    ......x..x......
    ....kkkkkkkk....
    ..x.kgGgggGk.x..
    ..kkggglgggGkk..
    .kgGglgggGglgk..
    xkggggGgglgggkx.
    .kgglgggGgggGgk.
    .kGgggglgggglggk
    xkggGgggGglggGkx
    .kgglgggggggGgk.
    kgggGgglgGgggggk
    kgGgggggggglgGgk
    .kkgggGgggGgggk.
    ..kkkkkkkkkkkk..
    ....nn....nn....
    ....nn....nn....
  `, { k: '#12200c', g: '#2f6a22', G: '#1e4a16', l: '#6aa83c',
       x: '#e8dcb0', n: '#5a3a1e' });

  /* ---------------------------------------------------------------
     LEVEL 13 — Shawarma bei Hamza (libanesisch)
     --------------------------------------------------------------- */

  /* Falafel. Rollt los, sobald sie dich sieht. */
  var FALAFEL_PAL = { k: '#2a160a', n: '#b07a3a', N: '#8a5a24', c: '#d8a05a',
                      w: '#ffffff', e: '#1b1220', m: '#5a2a14' };
  P.def('falafel', `
    ....kkkk....
    ..kkcnnckk..
    .kcnnNnncnk.
    .knkknnkknk.
    knnwennwenNk
    kncnnnnnncnk
    knnnNnnnNnnk
    kNnnkmmmknnk
    .knnnnnnnck.
    .kNnnNnnnnk.
    ..kkcnnnkk..
    ....kkkk....
  `, FALAFEL_PAL);
  P.def('falafel2', `
    ....kkkk....
    ..kkcnnckk..
    .knncNnnnck.
    .knkknnkknk.
    knnwennwenNk
    knnnncnnnnck
    knnnNnnnNnnk
    kNnnkmmmknnk
    .knnnnnnnck.
    .kncnnnNnnk.
    ..kknnnckk..
    ....kkkk....
  `, FALAFEL_PAL);

  /* Peperoni. Scharf und schlecht gelaunt. Huepft. */
  var PEPERONI_PAL = { k: '#12200a', G: '#3a5a1a', l: '#5ec23a', g: '#3a9a28',
                       e: '#1b1220', m: '#6a1a14' };
  P.def('peperoni', `
    ....kk..
    ...kGk..
    ..kkGkk.
    .kllllk.
    .klelek.
    .kllllk.
    .klmmlk.
    .kglllk.
    .kgllgk.
    ..kgllk.
    ..kgglk.
    ...kglk.
    ...kgk..
    ....k...
  `, PEPERONI_PAL);
  P.def('peperoni2', `
    ....kk..
    ...kGk..
    ..kkGkk.
    .kllllk.
    .klelek.
    .kllllk.
    .kmmmmk.
    .kglllk.
    .kgllgk.
    ..kgllk.
    ..kgglk.
    ...kglk.
    ...kgk..
    ....k...
  `, PEPERONI_PAL);

  /* Fliegendes Fladenbrot. */
  var PITA_PAL = { k: '#5a3a1a', p: '#f0d8a0', P: '#d8b070', w: '#ffffff',
                   e: '#1b1220', m: '#8a3a1e' };
  P.def('pita', `
    ...kkkkkkkk...
    .kkppPppPppkk.
    kppppppppppppk
    kpPpweppwepPpk
    kppppppppppppk
    kpPppkmmkppPpk
    kppppppppppppk
    .kkppPppPppkk.
    ...kkkkkkkk...
  `, PITA_PAL);
  P.def('pita2', `
    ..............
    ...kkkkkkkk...
    .kkppPppPppkk.
    kpPpweppwepPpk
    kppppppppppppk
    kpPppkmmkppPpk
    .kkppPppPppkk.
    ...kkkkkkkk...
    ..............
  `, PITA_PAL);

  /* Shawarma im Papier. Heilt. */
  P.def('shawarma', `
    ......kkkk....
    ....kkmMmmk...
    ...kmmgmtmk...
    ..kpppppppmk..
    .kpppppppppk..
    kwwwwwwwwwwwk.
    kwWwwwWwwwwwk.
    kwwwwwwwwWwwk.
    .kwwwwwwwwwk..
    ..kkkkkkkkk...
  `, { k: '#3a2410', m: '#b8643a', M: '#8a4424', g: '#6ac23a', t: '#e0483c',
       p: '#f0d8a0', w: '#f4f2ec', W: '#cfcac0' });

  /* Ein Klecks Hummus — Hamzas Wurfgeschoss. */
  P.def('humus', `
    ..kkkk..
    .khhHhk.
    khhhhhhk
    khHhohhk
    .khhhhk.
    ..kkkk..
  `, { k: '#6a5030', h: '#e8d4a0', H: '#f8ecc8', o: '#c8a020' });

  /* Hamzas Fussball. */
  P.def('ball', `
    ..kkkkkk..
    .kwwwwwwk.
    kwwwbbwwwk
    kwwbbbbwwk
    kbwwbbwwbk
    kbbwwwwbbk
    kwwwwwwwwk
    kwbwwwwbwk
    .kwbbbbwk.
    ..kkkkkk..
  `, { k: '#1b1220', w: '#f4f4f0', b: '#2a2a34' });

  /* ---------------------------------------------------------------
     LEVEL 14 — Stilbruch. Die Typen vom Nebentisch.
     --------------------------------------------------------------- */

  var TYP_ART = `
    ...kkkkk...
    ..khhhhhk..
    .khhHhhhhk.
    .ksssssssk.
    .ksweswesk.
    .ksssdsssk.
    .kjjkmkjjk.
    ..kjjjjjk..
    .krrryrrrk.
    krrrryrrrrk
    kyrrryrrryk
    kyrrryrrryk
    ksrrryrrrsk
    .kbbbbbbbk.
    .kbbk.kbbk.
    .kbbk.kbbk.
    .knnk.knnk.
  `;
  var TYP_ART2 = TYP_ART.replace(
    '.kbbk.kbbk.\n    .kbbk.kbbk.\n    .knnk.knnk.',
    'kbbk...kbbk\n    kbbk...kbbk\n    knnk...knnk');
  // Mit Kappe statt Haaren, ohne Bart
  var TYP_CAP = TYP_ART.replace('..khhhhhk..\n    .khhHhhhhk.', '..kcccccck.\n    .kccccccccc')
                       .replace('.kjjkmkjjk.\n    ..kjjjjjk..', '.ksskmkssk.\n    ..kssssdk..');
  var TYP_CAP2 = TYP_ART2.replace('..khhhhhk..\n    .khhHhhhhk.', '..kcccccck.\n    .kccccccccc')
                         .replace('.kjjkmkjjk.\n    ..kjjjjjk..', '.ksskmkssk.\n    ..kssssdk..');
  var TYP_BASE = { k: '#0c0a10', w: '#ffffff', e: '#1b1220', m: '#6a2a24', n: '#f0f0f4' };
  function typPal(o) {
    var p = {}, key;
    for (key in TYP_BASE) p[key] = TYP_BASE[key];
    for (key in o) p[key] = o[key];
    return p;
  }
  // Schwarzer Trainingsanzug mit weissen Streifen
  var TYP1 = typPal({ h: '#1a1412', H: '#3a2e24', s: '#d8a67c', d: '#b8845c', j: '#2a1e16',
                      r: '#1c1c24', y: '#f4f4f0', b: '#1c1c24' });
  // Weisser Anzug, blaue Kappe
  var TYP2 = typPal({ c: '#2a4a8a', s: '#c8946a', d: '#a8744c',
                      r: '#e8e8ee', y: '#2a4a8a', b: '#d8d8e0', n: '#1c1c24' });
  // Roter Anzug, Locken
  var TYP3 = typPal({ h: '#2a1a12', H: '#5a3a24', s: '#e8b890', d: '#c8946c', j: '#3a2418',
                      r: '#b8282e', y: '#f4f4f0', b: '#1c1c24' });
  P.def('typ1', TYP_ART, TYP1); P.def('typ1b', TYP_ART2, TYP1);
  P.def('typ2', TYP_CAP, TYP2); P.def('typ2b', TYP_CAP2, TYP2);
  P.def('typ3', TYP_ART, TYP3); P.def('typ3b', TYP_ART2, TYP3);

  /* Shisha-Zange. Fliegt sich drehend durch den Raum. */
  P.def('zange', `
    kkkkkkkkkk..
    kmmmmmmmmmkk
    .kkkkkkkkkmk
    kmmmmmmmmmkk
    kkkkkkkkkk..
  `, { k: '#3a3a44', m: '#c8ccd6' });

  /* Heisses Stueck Shisha-Kohle. */
  P.def('kohle', `
    .kkkk.
    kroork
    koyyok
    koyyok
    kroork
    .kkkk.
  `, { k: '#2a1008', r: '#8a2a10', o: '#ff6a1a', y: '#ffd257' });

  /* ---------------------------------------------------------------
     LEVEL 15 — Bei Georgios (griechisch). Die Meeresfruechte sind frisch.
     --------------------------------------------------------------- */

  var KRABBE_PAL = { k: '#3a0a08', r: '#e0483c', R: '#a02a20', w: '#ffffff' };
  P.def('krabbe', `
    .kk..........kk.
    krrk........krrk
    krRk..k..k..kRrk
    .krk..w..w..krk.
    ..krkkrrrrkkrk..
    ...krrrrrrrrk...
    ..krrRrrrrRrrk..
    ..kkrrrrrrrrkk..
    .k.k.k....k.k.k.
    k.k.k......k.k.k
  `, KRABBE_PAL);
  P.def('krabbe2', `
    kk............kk
    .krk........krk.
    krRk..k..k..kRrk
    .krk..w..w..krk.
    ..krkkrrrrkkrk..
    ...krrrrrrrrk...
    ..krrRrrrrRrrk..
    ..kkrrrrrrrrkk..
    k.k.k......k.k.k
    .k.k.k....k.k.k.
  `, KRABBE_PAL);

  var KRAKE_PAL = { k: '#2a0a30', p: '#9a4ac8', P: '#c88ae8', w: '#ffffff',
                    e: '#1b1220', m: '#5a1a3a' };
  P.def('krake', `
    ....kkkkkk....
    ..kkppppppkk..
    .kppPppppPppk.
    kppppppppppppk
    kpppwepppweppk
    kppppppppppppk
    .kppppmmppppk.
    ..kppppppppk..
    .kpkpkppkpkpk.
    kpkpkpkkpkpkpk
    kpkpkp..pkpkpk
    kk.kpk..kpk.kk
    ...kk....kk...
  `, KRAKE_PAL);
  P.def('krake2', `
    ....kkkkkk....
    ..kkppppppkk..
    .kppPppppPppk.
    kppppppppppppk
    kpppwepppweppk
    kppppppppppppk
    .kpppmmmmpppk.
    ..kppppppppk..
    .kpkpkppkpkpk.
    .kpkpkkkkpkpk.
    .kpkpk..kpkpk.
    ..kk.k..k.kk..
    ..............
  `, KRAKE_PAL);

  var FISCH_PAL = { k: '#0a1a3a', b: '#4a8ad8', B: '#8ac0f0', w: '#ffffff',
                    e: '#1b1220', m: '#1a2a5a' };
  P.def('fisch', `
    ....kkkkk.....
    ..kkbbbbbkk.kk
    .kbbbBbbbbbkbk
    kbwebbbbbbbbbk
    kbmbbbbbbbbkbk
    .kbbBbbbbbk.kk
    ..kkbbbbbkk...
    ....kkkkk.....
  `, FISCH_PAL);
  P.def('fisch2', `
    ....kkkkk.....
    ..kkbbbbbkk...
    .kbbbBbbbbbkkk
    kbwebbbbbbbbbk
    kbmbbbbbbbbkkk
    .kbbBbbbbbbk..
    ..kkbbbbbkk...
    ....kkkkk.....
  `, FISCH_PAL);

  /* Tinte. Die Krake spuckt. */
  P.def('tinte', `
    .kkkk.
    kiiIik
    kiIiik
    kiiiik
    .kkkk.
  `, { k: '#0a0a14', i: '#2a1a4a', I: '#5a4a8a' });

  /* Teller. Georgios wirft sie. Opa. */
  P.def('teller', `
    .kkkkkkkkkk.
    kwwbwwwwbwwk
    kwwwwwwwwwwk
    .kkkkkkkkkk.
  `, { k: '#3a4a6a', w: '#f4f6fa', b: '#2a5ab8' });

  P.def('olive', `
    .kkk.
    koOok
    koook
    .kkk.
  `, { k: '#141a08', o: '#3a4a18', O: '#8a9a3a' });

  /* Souvlaki am Spiess. Heilt — und ist Yusufs Belohnung. */
  P.def('souvlaki', `
    .kkk.kkk.kkk....
    kmMmkmMmkgtgkkkk
    kmmmkmmmkgggyyyy
    kMmmkMmmktggkkkk
    .kkk.kkk.kkk....
  `, { k: '#3a2410', m: '#b8643a', M: '#8a4424', g: '#4aa832', t: '#e0483c', y: '#d8b070' });

  /* Tzatziki. Von Georgios' Oma. */
  P.def('tzatziki', `
    ..kkkkkkkk..
    .kwwgwwwgwk.
    kwwwwwgwwwwk
    kbbbbbbbbbbk
    .kbBbbbbBbk.
    ..kbbbbbbk..
    ...kkkkkk...
  `, { k: '#1a2a5a', w: '#f4f6ee', g: '#8ac860', b: '#2a5ab8', B: '#8ab0f0' });

  /* ---------------------------------------------------------------
     LEVEL 15-20 — Sparta, Fussball, Riese, Rennen, Knast, Doenerbude
     --------------------------------------------------------------- */

  /* Georgios als Spartaner wirft Speere. Spitze zeigt nach rechts. */
  P.def('speer', `
    ....................kk....
    kkkkkkkkkkkkkkkkkkkkkaakk.
    krnnnnnnnnnnnnnnnnnnnoaaak
    kkkkkkkkkkkkkkkkkkkkkaakk.
    ....................kk....
  `, { k: '#2a1a0a', n: '#8a5a2a', r: '#c02828', o: '#8a5a20', a: '#f0c860' });

  /* Die Kruecken vom anderen Alex. Rot, Alu, Gummifuss. */
  P.def('kruecke', `
    .rrr...........................
    rRRRr..........rrr.............
    rRRRrmmmmmmmmmmrRrmmmmmmmmmmmkk
    rRRRrMMMMMMMMMMrRrMMMMMMMMMMMkk
    .rrr...........rrr.............
  `, { r: '#c82a2a', R: '#ff5a4a', m: '#d8dce4', M: '#8a8e98', k: '#1a1a1a' });

  /* Nils wirft mit Wissen. Genauer: mit Buechern. */
  var BUCH_ART = `
    kkkkkkkkkk
    kbbbbbbbwk
    kbBBBBBbwk
    kbbbbbbbwk
    kbBBBbbbwk
    kbbbbbbbwk
    kbbbbbbbwk
    kkkkkkkkkk
  `;
  P.def('buch', BUCH_ART, { k: '#141018', b: '#2a5ab8', B: '#ffd257', w: '#f4f0e0' });
  P.def('buch2', BUCH_ART, { k: '#141018', b: '#b8282e', B: '#f4f0e0', w: '#f4f0e0' });

  /* Und mit Spielkarten. Er mag den Joker. */
  P.def('karte', `
    .kkkkkk.
    kwwwwwwk
    kwrwwwwk
    kwwwwwwk
    kwwrrwwk
    kwrrrrwk
    kwwrrwwk
    kwwwwwwk
    kwwwwrwk
    kwwwwwwk
    .kkkkkk.
  `, { k: '#141018', w: '#f8f8f2', r: '#d82a3a' });

  /* Handschellen: was die Waerter werfen */
  P.def('handschelle', `
    .kkk...kkk.
    kmMmkkkmMmk
    km.mmmmm.mk
    kmMmk.kmMmk
    .kkk...kkk.
  `, { k: '#1a1a20', m: '#c8ccd6', M: '#8a8e98' });

  /* Insassen im orangen Overall. Nummer auf der Brust. */
  var INSASSE_PAL = {
    k: '#141018', h: '#2a2018', s: '#e8b48c', d: '#c8906a', g: '#1a1a1a',
    m: '#6a2a24', o: '#f07a28', O: '#c8581a', w: '#f4f4ee', n: '#2a2a2e'
  };
  var INSASSE_ART = `
    ...kkkkkkkk...
    ..khhhhhhhhk..
    ..kssssssssk..
    ..ksgsssgsdk..
    ..kssssssssk..
    ..kssmmmmssk..
    ...kssssssk...
    ..kkooooookk..
    .kooooowwoook.
    koooooowwooook
    kOooooooooooOk
    ksoooooooooosk
    kskooooooooksk
    .kkooooooookk.
    ..kooooooook..
    ..kooooooook..
    ..kooookoook..
    ..kooookoook..
    ..kooookoook..
    ..kook..kook..
    .kkkkk..kkkkk.
    .knnnk..knnnk.
  `;
  P.def('insasse', INSASSE_ART, INSASSE_PAL);
  var INSASSE_ART2 = `
    ...kkkkkkkk...
    ..khhhhhhhhk..
    ..kssssssssk..
    ..ksgsssgsdk..
    ..kssssssssk..
    ..kssmmmmssk..
    ...kssssssk...
    ..kkooooookk..
    .kooooowwoook.
    koooooowwooook
    kOooooooooooOk
    ksoooooooooosk
    kskooooooooksk
    .kkooooooookk.
    ..kooooooook..
    ..kooooooook..
    ..kooookoook..
    .kooook.koook.
    .kook....kook.
    .kook....kook.
    kkkkk....kkkkk
    knnnk....knnnk
  `;
  P.def('insasse2', INSASSE_ART2, INSASSE_PAL);

  /* Der Schlaeger: breit, Glatze, Unterarm-Tattoo. Zwei Treffer. */
  var SCHLAEGER_PAL = {
    k: '#141018', s: '#e8b48c', d: '#c8906a', g: '#1a1a1a', m: '#6a2a24',
    t: '#3a5a8a', o: '#f07a28', O: '#c8581a', w: '#f4f4ee', n: '#2a2a2e'
  };
  P.def('schlaeger', `
    ....kkkkkkkkkk....
    ...kssssssssssk...
    ...kssssssssssk...
    ...ksgssssssgsk...
    ...ksssssdsssssk..
    ...kssskmmmksssk..
    ....kssssssssk....
    ..kkkooooooookkk..
    .kssoooooooooossk.
    kssoooowwwoooossk.
    ksdoooooooooooodsk
    ktdOoooooooooOdtk.
    kssOOoooooooOOssk.
    .kkkOOOOOOOOOOkkk.
    ...kooooooooook...
    ...kooooooooook...
    ...koooookoooook..
    ...koooookoooook..
    ...koooookoooook..
    ...kooook.kooook..
    ..kkkkkk..kkkkkk..
    ..knnnnk..knnnnk..
  `, SCHLAEGER_PAL);
  P.def('schlaeger2', `
    ....kkkkkkkkkk....
    ...kssssssssssk...
    ...kssssssssssk...
    ...ksgssssssgsk...
    ...ksssssdsssssk..
    ...kssskmmmksssk..
    ....kssssssssk....
    ..kkkooooooookkk..
    .kssoooooooooossk.
    kssoooowwwoooossk.
    ksdoooooooooooodsk
    ktdOoooooooooOdtk.
    kssOOoooooooOOssk.
    .kkkOOOOOOOOOOkkk.
    ...kooooooooook...
    ...kooooooooook...
    ...koooookoooook..
    ..koooook.koooook.
    ..kooook...kooook.
    ..kooook...kooook.
    .kkkkkk....kkkkkk.
    .knnnnk....knnnnk.
  `, SCHLAEGER_PAL);

  /* Waerter: graue Uniform, Muetze, Schlagstock am Guertel */
  var WAERTER_PAL = {
    k: '#141018', b: '#5a6660', B: '#3a4440', w: '#ffd257', s: '#e8b48c', d: '#c8906a',
    g: '#1a1a1a', m: '#6a2a24', y: '#2a2a2e', n: '#26262c'
  };
  var WAERTER_ART = `
    ...kkkkkkkk...
    ..kbbbbbbbbk..
    ..kbbbwwbbbk..
    .kkkkkkkkkkkk.
    ..kssssssssk..
    ..ksgsssgsdk..
    ..kssssssssk..
    ..ksskmmkssk..
    ...kssssssk...
    ..kkbbbbbbkk..
    .kbbbbwbbbbbk.
    kbbbbbbbbbbbbk
    kbBbbbbbbbbBbk
    ksbbbbbbbbbbsk
    kskbbbbbbbbksk
    .kkyyyyyyyykk.
    ..knnnnnnnnk..
    ..knnnnnnnnk..
    ..knnnkknnnk..
    ..knnnkknnnk..
    ..knnnkknnnk..
    ..knnk..knnk..
    .kkkkk..kkkkk.
    .kkkkk..kkkkk.
  `;
  P.def('waerter', WAERTER_ART, WAERTER_PAL);
  P.def('waerter2', WAERTER_ART.replace('..knnnkknnnk..\n    ..knnk..knnk..',
                                        '.knnnk..knnnk.\n    .knnk....knnk.'), WAERTER_PAL);

  /* ----- Level 18: Autos von hinten (Ich-Perspektive) ----- */
  var HECK_ART = `
    ..........kkkkkkkkkkkk..........
    ........kkbbbbbbbbbbbbkk........
    .......kbbBbbbbbbbbbbbbbk.......
    ......kbbbbbbbbbbbbbbbbbbk......
    .....kcccccccccccccccccccck.....
    ..kkkcccccccccccccccccccccckkk..
    .kcccccccccccccccccccccccccccck.
    kcrrrrRccccccccccccccccccRrrrrck
    kcrRRrRccccccccccccccccccRrRRrck
    kccccccccccccwwwwwwcccccccccccck
    kccccccccccccwkkkkwcccccccccccck
    kCCCCCCCCCCCCwwwwwwCCCCCCCCCCCCk
    kCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCk
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    .kttttk..................kttttk.
    .kttttk..................kttttk.
    ..kkkk....................kkkk..
  `;
  var HECK_BASE = { k: '#141418', b: '#2a3848', B: '#6a88a8', r: '#d8202a', R: '#ff6a5a',
                    w: '#f4f4ee', t: '#1a1a1a' };
  function heck(c, C) {
    var p = {}; for (var key in HECK_BASE) p[key] = HECK_BASE[key];
    p.c = c; p.C = C; return p;
  }
  P.def('audi_heck', HECK_ART, heck('#b8bcc8', '#7a7e8a'));      // Alex: silberner Audi
  P.def('cla_heck', HECK_ART, heck('#2a2a32', '#16161c'));       // Erfan: schwarzer CLA
  P.def('polizei_heck', HECK_ART, heck('#e8ecf4', '#3a5ab8'));   // Streife

  /* ----- Level 6: die Kolonne, Mirkan, geparkte Autos (von hinten) ----- */
  P.def('eklasse_heck', HECK_ART, heck('#d8d2c2', '#9a9484'));   // Lennart: Opas silberne E-Klasse
  P.def('park_rot', HECK_ART, heck('#a82a2a', '#6a1616'));
  P.def('park_blau', HECK_ART, heck('#2a4a8a', '#162a52'));
  P.def('park_gruen', HECK_ART, heck('#3a6a3a', '#1e3a1e'));
  // Mirkans Cabrio: offen, man sieht die Sitze (und ihn, siehe fahrt.js)
  var CABRIO_ART = `
    ................................
    ......kkkkk..........kkkkk......
    .....kvvvvvk........kvvvvvk.....
    .....kvVvvvkkkkkkkkkkvvvVvk.....
    .....kcccccccccccccccccccck.....
    ..kkkcccccccccccccccccccccckkk..
    .kcccccccccccccccccccccccccccck.
    kcrrrrRccccccccccccccccccRrrrrck
    kcrRRrRccccccccccccccccccRrRRrck
    kccccccccccccwwwwwwcccccccccccck
    kccccccccccccwkkkkwcccccccccccck
    kCCCCCCCCCCCCwwwwwwCCCCCCCCCCCCk
    kCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCk
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    .kttttk..................kttttk.
    .kttttk..................kttttk.
    ..kkkk....................kkkk..
  `;
  var CABRIO_PAL = heck('#f4f6fa', '#cdd3de');
  CABRIO_PAL.v = '#3c3642'; CABRIO_PAL.V = '#26212c';
  P.def('cabrio_heck', CABRIO_ART, CABRIO_PAL);

  /* ----- Level 12: Radfahrer von hinten (Esat, Lennart) ----- */
  var RADLER_ART = `
    .....hhhhhh.....
    ....hhhhhhhh....
    ....hhhhhhhh....
    ....hhhhhhhh....
    .....hhhhhh.....
    ......ssss......
    ...tttttttttt...
    ..tttttttttttt..
    .stttttttttttts.
    .s.tttttttttt.s.
    kk.tttttttttt.kk
    kk..tttttttt..kk
    ....pppppppp....
    ...pp.ffff.pp...
    ...ss.ffff.ss...
    ...ss.ffff.kk...
    ...kk.ffff......
    ......kkkk......
    ......kTTk......
    ......kTTk......
    ......kTTk......
    ......kTTk......
    ......kTTk......
    .......kk.......
  `;
  // Zweites Bild: das andere Bein unten — er tritt
  var RADLER_ART2 = RADLER_ART.replace('...ss.ffff.kk...\n    ...kk.ffff......',
                                       '...kk.ffff.ss...\n    ......ffff.kk...');
  function radlerPal(h, s, t, pp, f) {
    return { k: '#15121a', T: '#3a3a42', h: h, s: s, t: t, p: pp, f: f };
  }
  P.def('radler_e', RADLER_ART, radlerPal('#1c1418', '#eab48c', '#2b2b33', '#242630', '#4ad8c8'));
  P.def('radler_e2', RADLER_ART2, radlerPal('#1c1418', '#eab48c', '#2b2b33', '#242630', '#4ad8c8'));
  P.def('radler_l', RADLER_ART, radlerPal('#6a4424', '#f0c09a', '#f4f4ee', '#2a2a3a', '#ff6fa8'));
  P.def('radler_l2', RADLER_ART2, radlerPal('#6a4424', '#f0c09a', '#f4f4ee', '#2a2a3a', '#ff6fa8'));

  /* Eine Kuh auf der Alm. Von vorne. Sie hat Vorfahrt. */
  P.def('kuh', `
    yy............yy
    .yy..........yy.
    ..kkkkkkkkkkkk..
    .kwwwwkkkwwwwwk.
    kwwwkkkkkwwwwwwk
    kwwgkwwwwwwkgwwk
    .kwwwwwwwwwwwwk.
    ..kwwwwwwwwwwk..
    ..kppppppppppk..
    ..kpkkppppkkpk..
    ...kppppppppk...
    ...kkkkkkkkkk...
    ..kwwkwwwwkwwk..
    ..kwk.kwwk.kwk..
    ..kwk..kk..kwk..
    ..kkk......kkk..
  `, { k: '#1a1418', w: '#f4f2ec', g: '#3a2410', p: '#f4a0b0', y: '#e8d8b0' });

  /* Explosives Fass. Nicht reinfahren. Oder doch — sieht gut aus. */
  P.def('fass', `
    .kkkkkkkkkk.
    kRrrrrrrrrrk
    kkkkkkkkkkkk
    kRrrrrrrrrrk
    kRryyyyyyrrk
    kRryykkyyrrk
    kRryyyyyyrrk
    kRrrrrrrrrrk
    kkkkkkkkkkkk
    kRrrrrrrrrrk
    kRrrrrrrrrrk
    .kkkkkkkkkk.
  `, { k: '#1a0a0a', r: '#c82020', R: '#ff5a4a', y: '#ffd257' });

  P.def('kegel', `
    ....kk....
    ...kook...
    ...kwwk...
    ..kooook..
    ..kwwwwk..
    .kooooook.
    .kwwwwwwk.
    kkkkkkkkkk
  `, { k: '#2a1408', o: '#ff7a1a', w: '#f4f4ee' });

  P.def('nitro', `
    ..kkkk..
    ..kwwk..
    .kkkkkk.
    kbbbbbbk
    kbBBBBbk
    kbwbbwbk
    kbwwbwbk
    kbwbwwbk
    kbwbbwbk
    kbBBBBbk
    kbbbbbbk
    .kkkkkk.
  `, { k: '#0a1420', b: '#2a6ad8', B: '#8ab8ff', w: '#f4f4ee' });

  P.def('blitzer', `
    kkkkkkkkkk
    kggggggggk
    kgkkkkkkgk
    kgkwwwwkgk
    kgkwkkwkgk
    kgkwwwwkgk
    kgkkkkkkgk
    kggggggggk
    kgyyyyyygk
    kggggggggk
    kkkkkkkkkk
    ....kk....
    ....kk....
    ....kk....
    ....kk....
    ....kk....
    ....kk....
    ....kk....
    ...kkkk...
  `, { k: '#1a1a20', g: '#8a8e98', y: '#ffd257', w: '#6ab0e8' });

  /* ----- Level 20: Doenerbude ----- */
  P.def('brot', `
    ...kkkkkkkkkkkkkk...
    .kkppppppppppppppkk.
    kppPpppppwpppppPpppk
    kppppppppppppppppppk
    kpppppPpppppppPppppk
    kPppppppppppppppppPk
    .kPPPPPPPPPPPPPPPPk.
    ..kkkkkkkkkkkkkkkk..
  `, { k: '#6a4a1e', p: '#f0cc7a', P: '#d9a441', w: '#fff6d8' });

  P.def('fleisch', `
    .kkkkkkkkkk.
    kmmMmmmMmmmk
    kMmmmMmmmMmk
    kmmmMmmmMmmk
    kmMmmmMmmmmk
    kmmmmMmmMmmk
    kMmmMmmmmmMk
    .kkkkkkkkkk.
  `, { k: '#3a2410', m: '#a85a2e', M: '#7d3f1e' });

  P.def('kaese', `
    ..kkkkkk..
    .kyyYyyyk.
    kyYyyyYyyk
    kyyyYyyyYk
    kYyyyyYyyk
    kyyYyyyyyk
    .kyyyYyyk.
    ..kkkkkk..
  `, { k: '#6a4a10', y: '#ffd84a', Y: '#e8a81e' });

  P.def('sucuk', `
    .kkkkkkkkkkkk.
    krrwrrrrwrrrrk
    krrrrwrrrrrwrk
    krwrrrrwrrrrrk
    kRRRRRRRRRRRRk
    .kkkkkkkkkkkk.
  `, { k: '#3a0a0a', r: '#b8282e', R: '#7a1414', w: '#f4e8d8' });

  P.def('zwiebel', `
    ..kkkkkk..
    .kvvvvvvk.
    kvwwwwwwvk
    kvwvvvvwvk
    kvwvwwvwvk
    kvwwwwwwvk
    .kvvvvvvk.
    ..kkkkkk..
  `, { k: '#3a1a3a', v: '#a85aa8', w: '#f0d8f0' });

  var FLASCHE_ART = `
    ...kk...
    ...kk...
    ..kwwk..
    .kkkkkk.
    kbbbbbbk
    kbwbbbbk
    kbwbbbbk
    kbbbbbbk
    kbLLLLbk
    kbLkkLbk
    kbLLLLbk
    kbbbbbbk
    kbbbbbbk
    .kkkkkk.
  `;
  P.def('sosse_k', FLASCHE_ART, { k: '#2a2a20', b: '#f4f2ea', w: '#ffffff', L: '#8ac860' });
  P.def('sosse_s', FLASCHE_ART, { k: '#2a0a0a', b: '#e03828', w: '#ff9a8a', L: '#ffd257' });

  /* ---------------------------------------------------------------
     LEVEL 21 — Airsoft im Wald. Alles in Tarnmuster.
     --------------------------------------------------------------- */

  /* Die Leihwaffe: eine schwarze M4 mit Rotpunkt. Zeigt nach rechts. */
  P.def('m4', `
    ..........kkkk........
    ..........kRWk........
    kkkk....kkkkkkkkkk....
    kGGgkkkkgGGGGGGGGgkkkk
    kggggggggggggggggggggk
    kkkkkkgggkkgkkkkkkkkk.
    ......kggk.gk.........
    ......kkk..gk.........
    ...........kk.........
  `, { k: '#0a0a0e', g: '#26262c', G: '#4a4a56', R: '#ff3a30', W: '#ffffff' });

  /* Ein Airsoft-Spieler: Helm, Schutzbrille, Gittermaske, Tarnmuster,
     kleine Waffe. Zwei Teams: gruen (Schuetzen) und sandfarben
     (Granaten). Wer getroffen ist, hebt die Hand — mit orangem Tuch. */
  var AS_ART = `
    ...kkkkk......
    ..kHHHHHk.....
    .kHhHHHHHk....
    .kkkkkkkkkk...
    .ksskooook....
    .kssmmmmmk....
    ..kkmmmmk.....
    .kcCvcCk......
    kcvcCcckkkkkk.
    kcCcsskggggGGk
    kvcCcckkgkkkk.
    kcCvck.kgk....
    .kcCcCk.k.....
    .kbbbbbk......
    .kbbkbbk......
    .kbbkbbk......
    .kbbkbbk......
    .keekeek......
  `;
  var AS_ART2 = AS_ART.replace(
    '.kbbkbbk......\n    .kbbkbbk......\n    .kbbkbbk......\n    .keekeek......',
    '.kbbkbbk......\n    kbbk.kbbk.....\n    kbbk.kbbk.....\n    keek.keek.....');
  var AS_HIT = `
    ..........kk..
    ...kkkkk.kssk.
    ..kHttHHkkssk.
    .kHttHHHHkssk.
    .kkkkkkkkksk..
    .ksskooookck..
    .kssmmmmmkck..
    ..kkmmmmkkck..
    .kcCvcCkcCk...
    kcvcCcCcCck...
    kcCcCcvcCk....
    kvcCcCcCck....
    .kcCcCcCk.....
    .kbbbbbbk.....
    .kbbkbbk......
    .kbbkbbk......
    .kbbkbbk......
    .keekeek......
  `;
  var AS_BASE = { k: '#141018', s: '#e8b48c', d: '#c8906a', g: '#1a1a1e', G: '#4a4a54',
                  o: '#8ad0ff', m: '#3a3a42', t: '#ff8a2a' };
  function asPal(o) {
    var p = {}, key;
    for (key in AS_BASE) p[key] = AS_BASE[key];
    for (key in o) p[key] = o[key];
    return p;
  }
  // Team Wald: Flecktarn in Gruen
  var AS_GRUEN = asPal({ H: '#4e5a36', h: '#39432a', c: '#5e6e3e', C: '#3e4a2a', v: '#8a8a5a',
                         b: '#4a5236', e: '#3a2e20' });
  // Team Sand: Wuestentarn, die mit den Granaten
  var AS_SAND = asPal({ H: '#b8a070', h: '#8e7a50', c: '#a8966a', C: '#7e6e48', v: '#d0c090',
                        b: '#8e7e58', e: '#4a3a26' });
  P.def('soldat', AS_ART, AS_GRUEN); P.def('soldat2', AS_ART2, AS_GRUEN); P.def('soldat_hit', AS_HIT, AS_GRUEN);
  P.def('grena', AS_ART, AS_SAND); P.def('grena2', AS_ART2, AS_SAND); P.def('grena_hit', AS_HIT, AS_SAND);

  /* Der Sniper im Ghillie-Anzug. Sieht aus wie ein Busch. Bis er schiesst. */
  var GHILLIE = { k: '#1a2410', L: '#4a6a32', g: '#2e4420', l: '#7a9a4a', s: '#e8b48c',
                  o: '#8ad0ff', x: '#1a1a1e', X: '#4a4a54', t: '#ff8a2a' };
  P.def('sniper', `
    .....l..l.......
    ...lkLkkLkl.....
    ..kLLgLLgLLk....
    .kLgLLLLLgLLk...
    .kLLLkkkkLLLk...
    kLgLkookoksLk...
    kLLLkskkkkkkkkkk
    kgLLLssxxxxxxxXk
    kLLgLLkkkxkkkkk.
    kLLLLgLLLLgLk...
    kgLLLLLgLLLLLk..
    kLLgLLLLLgLLLk..
    kLLLLLgLLLLLgk..
    .kLgLLLLLLgLk...
    ..kkLLkkLLkk....
    ...kkk..kkk.....
  `, GHILLIE);
  P.def('sniper2', `
    ....l..l........
    ..lkLkkLkkl.....
    ..kLgLLLgLLk....
    .kLLLLgLLLgLk...
    .kLLLkkkkLLLk...
    kLLLkookoksLk...
    kLgLkskkkkkkkkkk
    kLLLLssxxxxxxxXk
    kLgLLLkkkxkkkkk.
    kLLLLLLgLLLLk...
    kLgLLLLLLLgLLk..
    kLLLLgLLLLLLLk..
    kLgLLLLLgLLLLk..
    .kLLLgLLLLLLk...
    ..kkLLkkLLkk....
    ...kkk..kkk.....
  `, GHILLIE);
  P.def('sniper_hit', `
    .....l..l...kk..
    ...lkttkLkl.kssk
    ..kLLttLgLLkkssk
    .kLgLLLLLgLLkssk
    .kLLLkkkkLLLksk.
    kLgLkookoksLkk..
    kLLLkskkkkLLk...
    kgLLLssLLgLLLk..
    kLLgLLLLLgLLk...
    kLLLLgLLLLgLk...
    kgLLLLLgLLLLLk..
    kLLgLLLLLgLLLk..
    kLLLLLgLLLLLgk..
    .kLgLLLLLLgLk...
    ..kkLLkkLLkk....
    ...kkk..kkk.....
  `, GHILLIE);

  /* Der Highlander: callt seine Hits nicht. Traegt Kilt. Natuerlich. */
  var HL_ART = `
    ...kkkkk......
    ..khhhhhk.....
    .khhHhhhhk....
    .khkkkkkkk....
    .khskooook....
    .khsssdssk....
    .khjjjjjjk....
    ..kjjmjjk.....
    .kcCvcCk......
    kcvcCcckkkkkk.
    kcCcsskggggGGk
    kvcCcckkgkkkk.
    kRrRrRrkgk....
    kryrRryk......
    kRrRrRrk......
    .kskksk.......
    .kskksk.......
    .kwkkwk.......
    .kekkek.......
  `;
  var HL_ART2 = HL_ART.replace('.kskksk.......\n    .kskksk.......\n    .kwkkwk.......\n    .kekkek.......',
                               '.kskksk.......\n    kskkksk.......\n    kwk.kwk.......\n    kek.kek.......');
  var HL_HIT = `
    ..........kk..
    ...kkkkk.kssk.
    ..khtthhkkssk.
    .khhttHhhkssk.
    .khkkkkkkksk..
    .khskooookck..
    .khsssdsskck..
    .khjjjjjjkck..
    ..kjjmjjkkck..
    .kcCvcCkcCk...
    kcvcCcCcCck...
    kvcCcCcCck....
    kRrRrRrRk.....
    kryrRryrk.....
    kRrRrRrk......
    .kskksk.......
    .kskksk.......
    .kwkkwk.......
    .kekkek.......
  `;
  var HL_PAL = asPal({ h: '#6a3a1e', H: '#8a5230', j: '#7a4422', c: '#5e6e3e', C: '#3e4a2a',
                       v: '#8a8a5a', R: '#b8282e', r: '#1e4a2a', y: '#e8d048', w: '#f0f0ea',
                       e: '#3a2e20' });
  P.def('highlander', HL_ART, HL_PAL); P.def('highlander2', HL_ART2, HL_PAL);
  P.def('highlander_hit', HL_HIT, HL_PAL);

  /* Airsoft-Granate. Piept. Dann Konfetti aus BBs. */
  P.def('granate', `
    ..kkk.
    .kyky.
    .kkkk.
    kgggGk
    kgGggk
    kgggGk
    kgGggk
    kgggGk
    .kkkk.
  `, { k: '#141018', g: '#4a6a32', G: '#6a8a4a', y: '#c8c8d0' });

  /* Boerek von Sonnets Mutter. Goldbraun, gerollt, gefaehrlich lecker. */
  P.def('boerek', `
    ....kkkkkkkk....
    ..kkyYyyyYyykk..
    .kyYyyoooyyYyyk.
    kyyyoyyyyyoyyyyk
    kyYyoyYYYyoyYyyk
    kyyyoyyyyoyyyyyk
    .kyyyooooyyYyyk.
    ..kkyyyyyyyykk..
    ....kkkkkkkk....
  `, { k: '#6a3a14', y: '#e8b858', Y: '#ffe08a', o: '#b87a2a' });

  /* Wildschwein (Level 22). Hat Vorfahrt. Weiss es. */
  var SCHWEIN_PAL = { k: '#1a100a', B: '#5a3a24', b: '#3a2416', n: '#c8907a', w: '#f4f0e0' };
  P.def('schwein', `
    ....kkkkkk..........
    ..kkBBBBBBkk........
    .kBBbBBBBbBBkk......
    kBBBBBBBBBBBBBkk....
    kBbBBBBBBBBbBBBBkk..
    kBBBBBBBBBBBBBBkwBk.
    kBBBBbBBBBBBBBBBBnnk
    .kBBBBBBBBBBBBBBknnk
    ..kBBBBBBBBBBBBkwk..
    ..kBBkkkkkkBBkk.....
    ..kBk.....kBk.......
    ..kBk.....kBk.......
    ..kkk.....kkk.......
  `, SCHWEIN_PAL);
  P.def('schwein2', `
    ....kkkkkk..........
    ..kkBBBBBBkk........
    .kBBbBBBBbBBkk......
    kBBBBBBBBBBBBBkk....
    kBbBBBBBBBBbBBBBkk..
    kBBBBBBBBBBBBBBkwBk.
    kBBBBbBBBBBBBBBBBnnk
    .kBBBBBBBBBBBBBBknnk
    ..kBBBBBBBBBBBBkwk..
    ..kBBkkkkkkBBkk.....
    .kBk.......kBk......
    .kBk......kBk.......
    .kkk......kkk.......
  `, SCHWEIN_PAL);

  /* ---------------------------------------------------------------
     LEVEL 23 — Pizzeria: was auf die Pizza kommt
     --------------------------------------------------------------- */

  P.def('teig', `
    ....kkkkkk....
    ..kkwwwwwwkk..
    .kwwwwWwwwwwk.
    kwwWwwwwwwWwwk
    kwwwwwwwwwwwwk
    kwwwwwwwwwwwwk
    .kWwwwwwwwwWk.
    ..kkWWWWWWkk..
    ....kkkkkk....
  `, { k: '#8a6a3a', w: '#f4e8c8', W: '#d8c8a0' });
  P.def('sosse_t', FLASCHE_ART, { k: '#2a0a0a', b: '#c8281e', w: '#ff8a6a', L: '#4a9a3a' });
  P.def('salami', `
    ...kkkkk...
    .kkrrrrrkk.
    .krrwrrrrk.
    krrrrrrwrrk
    krwrrrrrrrk
    krrrrwrrrrk
    krrrrrrrwrk
    krrwrrrrrrk
    .krrrrrwrk.
    .kkrrrrrkk.
    ...kkkkk...
  `, { k: '#6a1a14', r: '#c8342a', w: '#f0b0a0' });
  P.def('pilz', `
    ..kkkkkk..
    .kbbbbbbk.
    kbbbBbbbbk
    kbBbbbbBbk
    .kkwwwwkk.
    ...kwwk...
    ...kwwk...
    ...kwWk...
    ...kkkk...
  `, { k: '#5a4030', b: '#b89a78', B: '#8a6e50', w: '#f0e8dc', W: '#d8ccb8' });
  P.def('ananas', `
    .kkkkkkk.
    kyyYyyYyk
    kyYyyyyYk
    kyyyYyyyk
    kYyyyyYyk
    kyyYyyyyk
    kyyyyYyyk
    .kyyyyyk.
    ..kkkkk..
  `, { k: '#8a6a10', y: '#ffe060', Y: '#e0b020' });

  /* ---------------------------------------------------------------
     LEVEL 24-28 — Flughafen, Flugzeug, Istanbul
     Die Leute sind umgefaerbte Bekannte: die Security traegt die
     Uniform der Waerter, Touristen, Diebe und Haendler sind die Typen
     vom Nebentisch in anderen Klamotten.
     --------------------------------------------------------------- */

  // Security: schwarze Uniform, gelbes Abzeichen, Funkgeraet
  var SECURITY_PAL = {
    k: '#0c0a10', b: '#26262e', B: '#14141a', w: '#ffd257', s: '#d8a67c', d: '#b8845c',
    g: '#1a1a1a', m: '#6a2a24', y: '#3a3a44', n: '#1a1a20'
  };
  P.def('security', WAERTER_ART, SECURITY_PAL);
  P.def('security2', WAERTER_ART.replace('..knnnkknnnk..\n    ..knnk..knnk..',
                                         '.knnnk..knnnk.\n    .knnk....knnk.'), SECURITY_PAL);

  // Tourist: Sonnenkappe, Hawaiihemd, Kamera-Riemen, kurze Hose
  var REISENDER = typPal({ c: '#e8c24a', s: '#f0c29c', d: '#d09a74',
                           r: '#3aa8a0', y: '#f4f4ee', b: '#c8b890', n: '#f4f4ee' });
  P.def('reisender', TYP_CAP, REISENDER); P.def('reisender2', TYP_CAP2, REISENDER);
  // Parfuem-Verkaeuferin im Duty Free: pink, mit Spruehflasche
  var PARFUEM = typPal({ h: '#8a4a2a', H: '#b86a3a', s: '#f0c29c', d: '#d09a74', j: '#f0c29c',
                         r: '#e87ab8', y: '#ffffff', b: '#2a2a34' });
  P.def('parfuem', TYP_ART, PARFUEM); P.def('parfuem2', TYP_ART2, PARFUEM);
  // Taschendieb: schwarzer Hoodie, Kappe tief im Gesicht
  var DIEB = typPal({ c: '#1c1c24', s: '#c8946a', d: '#a8744c',
                      r: '#2c2c36', y: '#2c2c36', b: '#3a4a6a', n: '#d8d8e0' });
  P.def('dieb', TYP_CAP, DIEB); P.def('dieb2', TYP_CAP2, DIEB);
  // Simit-Haendler: Schnurrbart, rote Weste, weisses Hemd
  var HAENDLER = typPal({ h: '#1a1412', H: '#3a2e24', s: '#d8a07a', d: '#b8805a', j: '#1a1412',
                          r: '#b8282e', y: '#f4f4ee', b: '#3a3a44' });
  P.def('haendler', TYP_ART, HAENDLER); P.def('haendler2', TYP_ART2, HAENDLER);
  // Schuhputzer: Kappe, gruene Schuerze
  var SCHUHPUTZER = typPal({ c: '#6a4a2a', s: '#c8946a', d: '#a8744c',
                             r: '#3a6a3a', y: '#c8a040', b: '#4a4034', n: '#1c1c24' });
  P.def('schuhputzer', TYP_CAP, SCHUHPUTZER); P.def('schuhputzer2', TYP_CAP2, SCHUHPUTZER);
  // Stewardess: dunkelblaue Uniform, rotes Halstuch
  var STEWARDESS_PAL = {
    k: '#141018', h: '#e8c870', s: '#f0c29c', d: '#d09a74', g: '#1a1a1a',
    m: '#b83a4a', o: '#24345a', O: '#16223e', w: '#d8282e', n: '#1a1a20'
  };
  function mitMuetze(a) {
    return a.replace('...kkkkkkkk...\n    ..khhhhhhhhk..\n    ..kssssssssk..',
                     '...kooooook...\n    ..khhhhhhhhk..\n    ..khsssssshk..');
  }
  P.def('stewardess', mitMuetze(INSASSE_ART), STEWARDESS_PAL);
  P.def('stewardess2', mitMuetze(INSASSE_ART2), STEWARDESS_PAL);

  /* Herrenloser Rollkoffer. Rollt los, sobald er Yusuf sieht. */
  var KOFFER_PAL = { k: '#141018', g: '#8a8e98', r: '#3a6ac8', R: '#284a98', w: '#c8ccd6', n: '#1c1c20', y: '#ffd257' };
  P.def('koffer', `
    .....kkkk.....
    .....kggk.....
    .....k..k.....
    .kkkkkkkkkkkk.
    .krrrrRrrrrrk.
    .krrrrRrrryrk.
    .krrrrRrrrrrk.
    .krrrrRrrrrrk.
    .kRRRRRRRRRRk.
    .krrrrRrrrrrk.
    .krrrrRrrrrrk.
    .kkkkkkkkkkkk.
    ..knk....knk..
    ..kkk....kkk..
  `, KOFFER_PAL);
  P.def('koffer2', `
    .....kkkk.....
    .....kggk.....
    .....k..k.....
    .kkkkkkkkkkkk.
    .krrrrRrrrrrk.
    .krrrrRrrryrk.
    .krrrrRrrrrrk.
    .krrrrRrrrrrk.
    .kRRRRRRRRRRk.
    .krrrrRrrrrrk.
    .krrrrRrrrrrk.
    .kkkkkkkkkkkk.
    ..kwk....kwk..
    ..kkk....kkk..
  `, KOFFER_PAL);

  /* Servierwagen im Flugzeug. Rollt durch den Gang, bremst fuer niemanden. */
  var TROLLEY_PAL = { k: '#141018', m: '#c8ccd6', M: '#8a8e98', r: '#d8282e', y: '#ffd257', n: '#1c1c20', w: '#f4f4ee' };
  P.def('trolley', `
    kkkkkkkkkkkkkkkk
    kmmmmmmmmmmmmmmk
    kmwwmmmmmmmyymmk
    kkkkkkkkkkkkkkkk
    kMMMMMMMMMMMMMMk
    kMrrrrrrrrrrrrMk
    kMMMMMMMMMMMMMMk
    kMmmmmmkkmmmmmMk
    kMmmmmmkkmmmmmMk
    kMMMMMMMMMMMMMMk
    kMrrrrrrrrrrrrMk
    kMMMMMMMMMMMMMMk
    kkkkkkkkkkkkkkkk
    .kmk........kmk.
    .knk........knk.
    .kkk........kkk.
  `, TROLLEY_PAL);
  P.def('trolley2', `
    kkkkkkkkkkkkkkkk
    kmmmmmmmmmmmmmmk
    kmwwmmmmmmmyymmk
    kkkkkkkkkkkkkkkk
    kMMMMMMMMMMMMMMk
    kMrrrrrrrrrrrrMk
    kMMMMMMMMMMMMMMk
    kMmmmmmkkmmmmmMk
    kMmmmmmkkmmmmmMk
    kMMMMMMMMMMMMMMk
    kMrrrrrrrrrrrrMk
    kMMMMMMMMMMMMMMk
    kkkkkkkkkkkkkkkk
    .kmk........kmk.
    .kmk........kmk.
    .kkk........kkk.
  `, TROLLEY_PAL);

  /* Taube in der Abflughalle. Hat keinen Flug gebucht. */
  var TAUBE_PAL = { k: '#141018', g: '#8a90a0', G: '#5a6070', w: '#c8ccd6', p: '#7a5a9a', o: '#ff8a2a', e: '#ffd257' };
  P.def('taube', `
    ..kkkk.......
    .kwwwwk......
    .kgGGgk...kk.
    kggggggkkkgk.
    kggpgggggggk.
    .kgggegggGk..
    ..kgggggggko.
    ...kkkkkkk...
    ....k..k.....
    ...kk..kk....
  `, TAUBE_PAL);
  P.def('taube2', `
    .............
    ......kkkk...
    .....kggggkk.
    kkkkkggggggk.
    kggpgggggggk.
    .kgggegggGk..
    ..kgggggggko.
    ...kkkkkkk...
    ....k..k.....
    ...kk..kk....
  `, TAUBE_PAL);

  /* Moewe am Bosporus. Die schlimmsten Diebe der Stadt. */
  var MOEWE_PAL = { k: '#141018', w: '#f4f6fa', g: '#b8c0cc', G: '#6a7280', y: '#ffd257', e: '#1a1a1a', r: '#d8282e' };
  P.def('moewe', `
    GG............GG
    GgGk........kGgG
    .kggk......kggk.
    ..kggkkkkkkggk..
    ...kgwwwwwwgk...
    ...kwwwwwwwwwkk.
    ..kwwwwwwwewwyyy
    ...kkwwwwwwwkrk.
    .....kkkkkkk....
    ......k..k......
  `, MOEWE_PAL);
  P.def('moewe2', `
    ................
    ................
    ....kkkkkkkk....
    .kkkggwwwwggkkk.
    kGggwwwwwwwwggGk
    .kkkwwwwwwwwwkk.
    ..kwwwwwwwewwyyy
    ...kkwwwwwwwkrk.
    .....kkkkkkk....
    ......k..k......
  `, MOEWE_PAL);

  /* Essen unterwegs */
  P.def('brezel', `
    ..kkk..kkk..
    .kbbbkkbbbk.
    kbbkbbbbkbbk
    kbk.kbbk.kbk
    kbk.kbbk.kbk
    kbbkbkkbkbbk
    .kbbbk.kbbk.
    ..kbbk.kbk..
    ...kkk.kk...
  `, { k: '#5a3010', b: '#b8682a' });
  P.def('simit', `
    ...kkkkkk...
    ..kbwbbwbk..
    .kbbbbbbwbk.
    kbwbkkkkbbbk
    kbbk....kbwk
    kbbk....kbbk
    kwbk....kbbk
    kbbbkkkkbwbk
    .kbwbbbbbbk.
    ..kbbwbbbk..
    ...kkkkkk...
  `, { k: '#5a3010', b: '#c87a3a', w: '#f4e8c8' });
  P.def('balik', `
    ...kkkkkkkkkk...
    ..kbbbbbbbbbbk..
    .kbbbbwbbbbwbbk.
    kgggrrrrrrrrgggk
    kgffffffffffffgk
    kgfFfffFffffFfgk
    kbbbbbbbbbbbbbbk
    .kbbbbbbbbbbbbk.
    ..kkkkkkkkkkkk..
  `, { k: '#5a3010', b: '#e8b060', w: '#f4e8c8', g: '#4aa832', r: '#d8282e', f: '#b8c0cc', F: '#8a90a0' });
  P.def('ayran', `
    .kkkkkk.
    kwwwwwwk
    kwkkkkwk
    kwwwwwwk
    kwrrrrwk
    kwwwwwwk
    kwwwwwwk
    kwwwwwwk
    kwwwwwwk
    .kkkkkk.
  `, { k: '#5a6070', w: '#f4f6fa', r: '#d8282e' });
  P.def('guertel', `
    kkkkkkkkkkkkkk
    knnnnnkyyknnnk
    kkkkkkkyykkkkk
  `, { k: '#141018', n: '#5a3a22', y: '#ffd257' });

  /* Yusufs polnische Boeller. Ein Paeckchen. Er geht nie ohne. */
  P.def('boeller', `
    ..k..k..k..k..
    ..y..y..y..y..
    .kkkkkkkkkkkk.
    krrrrrrrrrrrrk
    krwwrrwwrrwwrk
    krrrrrrrrrrrrk
    krrryyyyyyrrrk
    krrryrrrryrrrk
    krrrrrrrrrrrrk
    .kkkkkkkkkkkk.
  `, { k: '#141018', r: '#d8282e', w: '#f4f4ee', y: '#ffd257' });

  /* Erdnuesse von der Stewardess — sie wirft die Tuetchen */
  P.def('nuss', `
    .kkkk.
    kbbbbk
    kbyybk
    kbyybk
    kbbbbk
    .kkkk.
  `, { k: '#141018', b: '#3a6ac8', y: '#e8c24a' });

  /* Felix' Munition: Joint (brennt vorne), Riesenjoint, Ott-Kruemel */
  P.def('joint', `
    kkkkkkkkkkk.
    kwwwwwwwwwor
    kkkkkkkkkkk.
  `, { k: '#8a8478', w: '#f4f2ec', o: '#ff8a2a', r: '#ffd257' });
  P.def('riesenjoint', `
    ..kkkkkkkkkkkkkkkkkkkkkkkkkkk...
    .kwwwwwwwwwwwwwwwwwwwwwwwwwwwkk.
    kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwor
    kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwoo
    kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwor
    .kwwwwwwwwwwwwwwwwwwwwwwwwwwwkk.
    ..kkkkkkkkkkkkkkkkkkkkkkkkkkk...
  `, { k: '#8a8478', w: '#f4f2ec', o: '#ff8a2a', r: '#ffd257' });
  P.def('ott', `
    .kk.
    kggk
    kgGk
    .kk.
  `, { k: '#2a4a1a', g: '#6ab83a', G: '#9ade5a' });

  /* Bewegliche Plattformen: am Flughafen Laufbaender, in Istanbul
     fliegende Teppiche. Gleiche Groesse wie das Tablett. */
  P.def('laufband', `
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    kgGgGgGgGgGgGgGgGgGgGgGgGgGgGgGk
    kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk
    kMyMMMMMMMMMMMMMMMMMMMMMMMMMMyMk
    .kkMMMMMMMMMMMMMMMMMMMMMMMMMMkk.
    ...kkkkkkkkkkkkkkkkkkkkkkkkkk...
  `, { k: '#141018', g: '#3a3a44', G: '#6a6a74', m: '#c8ccd6', M: '#7c8399', y: '#ffd257' });
  P.def('teppich', `
    .y.y.y.y.y.y.y.y.y.y.y.y.y.y.y..
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
    krrbbrrrryyrrrrbbrrrryyrrrrbbrrk
    krbyybrrryyrrrbyybrrryyrrrbyybrk
    krrbbrrrryyrrrrbbrrrryyrrrrbbrrk
    kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
  `, { k: '#3a1010', r: '#b8282e', b: '#2a4a8a', y: '#e8c24a' });

  /* ---------------------------------------------------------------
     TILES — zwei Masken, eine Palette pro Welt
     --------------------------------------------------------------- */

  var MASK_TOP = P.art(`
    1111111111111111
    1111111111111111
    2222222222222222
    2222222222222222
    2222222222222222
    3333333333333333
    3333333333333333
    4444444444444444
    3333333333333333
    3333333333333333
    3333333333333333
    3333333343333333
    3333333343333333
    3333333343333333
    3333333343333333
    4444444444444444
  `);

  var MASK_FILL = P.art(`
    3333333343333333
    3333333343333333
    3333333343333333
    3333333343333333
    3333333343333333
    3323333343333233
    3333333343333333
    4444444444444444
    4333333333333333
    4333333333333333
    4333333333333333
    4333333332333333
    4333333333333333
    4333333333333333
    4333333333333333
    4444444444444444
  `);

  /**
   * Welten-Paletten.
   * top/fill = [hell, mittel, dunkel, Fuge]
   * sky = Verlauf oben->unten, far/near = Parallax-Farben
   */
  var THEMES = {
    zimmer: {
      top:  ['#d8a06a', '#b07a45', '#8a5a33', '#4a2c17'],
      fill: ['#a8763f', '#8a5a33', '#6b4526', '#3a2414'],
      sky:  ['#2a1f4a', '#5c3a6e', '#c9628a', '#f0a05c'],
      far:  '#3b2a55', near: '#27193c',
      accent: '#ffd257'
    },
    garten: {
      top:  ['#96e85c', '#66c23c', '#4a9128', '#2a5a18'],
      fill: ['#a8763f', '#8a5a33', '#6b4526', '#3a2414'],
      sky:  ['#5cc8f0', '#8ad8ed', '#bdeeff', '#e8f8c0'],
      far:  '#3f8a4a', near: '#2a6234',
      accent: '#ffc23c'
    },
    gym: {
      top:  ['#7a8aa6', '#5b6b82', '#43506a', '#1b2130'],
      fill: ['#4c586f', '#3b4558', '#2c3444', '#161b26'],
      sky:  ['#2a2140', '#3e2d55', '#5a3a66', '#7a4a6a'],
      far:  '#332a4a', near: '#221a33',
      accent: '#ff6fa8'
    },
    kueche: {
      top:  ['#f4f0e8', '#d4cec2', '#a8a298', '#5e5a54'],
      fill: ['#c8c2b6', '#a8a298', '#86817a', '#4a4741'],
      sky:  ['#3a2f44', '#584060', '#7a5a70', '#a8786a'],
      far:  '#4a3d52', near: '#33293c',
      accent: '#ff8a3c'
    },
    festung: {
      top:  ['#b4e888', '#7fb04a', '#4f7a33', '#243d1a'],
      fill: ['#5a6a52', '#46543f', '#333f2e', '#1a2116'],
      sky:  ['#140f22', '#2a1a3a', '#4a2250', '#6a2a48'],
      far:  '#2a2038', near: '#1a1426',
      accent: '#9dff6a'
    },
    // Supermarkt: heller Boden, Neonlicht, volle Regale
    markt: {
      top:  ['#eceef4', '#c8ccd6', '#9aa0ac', '#5c6068'],
      fill: ['#b8bcc6', '#989ca6', '#787c86', '#3c4048'],
      sky:  ['#f4f7fb', '#e2e8f0', '#ccd4e0', '#b0bccc'],
      far:  '#c2cad8', near: '#a6b0c2',
      accent: '#ff6a3c'
    },
    // Nachtstrasse Richtung Stilbruch
    strasse: {
      top:  ['#5a5f6e', '#43485a', '#2e3242', '#1a1c26'],
      fill: ['#3a3e4c', '#2c303c', '#1f222c', '#12141c'],
      sky:  ['#0c0a18', '#1d1636', '#43215a', '#a8425a'],
      far:  '#241d3a', near: '#171228',
      accent: '#ff8ad8'
    },
    // Vor Yusufs Haus: Gehweg, Nachmittagssonne, Reihenhaeuser
    siedlung: {
      top:  ['#dedad2', '#b8b4ac', '#8e8a84', '#5a5652'],
      fill: ['#8e8a84', '#76726c', '#5e5a56', '#3a3834'],
      sky:  ['#4a86d4', '#7ab0e6', '#c4dcf0', '#f2d8a4'],
      far:  '#8ea2c2', near: '#6a7c9a',
      accent: '#ffd257'
    },
    // Vor Yusufs Haus bei Nacht (Level 11: Broke wartet — es ist
    // schon dunkel, wie auf dem Heimweg davor)
    siedlung_nacht: {
      top:  ['#8a8a96', '#6a6a78', '#4e4e5a', '#2e2e38'],
      fill: ['#4e4e5a', '#3e3e4a', '#30303a', '#1c1c24'],
      sky:  ['#0a0c1c', '#161a36', '#2a2650', '#5a3a62'],
      far:  '#232a44', near: '#1a2036',
      accent: '#ffd257'
    },
    // Der Hausberg: Gras oben, Erde darunter, Morgenhimmel
    berg: {
      top:  ['#9ada64', '#62a83c', '#7a5634', '#3e2a18'],
      fill: ['#8a6440', '#6e4e30', '#553a22', '#2e2012'],
      sky:  ['#58b0ee', '#8accf0', '#c2e6f4', '#eaf6e0'],
      far:  '#7e9cc0', near: '#2e6a3a',
      accent: '#ffc23c'
    },
    // Hamzas Restaurant: Terrakotta-Boden, warme Waende, der Spiess
    imbiss: {
      top:  ['#e8b888', '#c88a5a', '#a0683e', '#5a3a22'],
      fill: ['#a0683e', '#86542e', '#6a4022', '#3a2414'],
      sky:  ['#3a2014', '#5a3220', '#7a4a2e', '#946038'],
      far:  '#4e2c1c', near: '#2e1a10',
      accent: '#ffd257'
    },
    // Stilbruch von innen: dunkler Teppich, Neon, Rauch
    bar: {
      top:  ['#7a4a7a', '#5a3060', '#3e2046', '#1e1024'],
      fill: ['#3e2046', '#30183a', '#24102c', '#12081a'],
      sky:  ['#0e0816', '#1c1030', '#2e1840', '#44204e'],
      far:  '#241634', near: '#160c22',
      accent: '#ff8ad8'
    },
    // Bolzplatz und Tribuene (Level 16/17): Rasen, Beton, Flutlicht
    stadion: {
      top:  ['#8ce85a', '#5ec23c', '#3e9128', '#1e5a14'],
      fill: ['#9aa0ac', '#7a808c', '#5a606c', '#2a2e36'],
      sky:  ['#3a6ab8', '#6a9ad8', '#a8c8ec', '#e8f0f8'],
      far:  '#5a6a82', near: '#3a4658',
      accent: '#ffffff'
    },
    // Knast (Level 19): Beton, Gitter, Neonlicht
    knast: {
      top:  ['#a8acb4', '#8a8e98', '#6a6e78', '#2a2c32'],
      fill: ['#6a6e78', '#585c66', '#464a52', '#22242a'],
      sky:  ['#1a1c22', '#262a32', '#343842', '#444852'],
      far:  '#2c3038', near: '#1e2128',
      accent: '#f07a28'
    },
    // Taverne Georgios: weiss und blau, Holzboden
    taverne: {
      top:  ['#d8b888', '#b08a5a', '#8a6640', '#4a3420'],
      fill: ['#8a6640', '#70502e', '#58401e', '#302210'],
      sky:  ['#e8f0f8', '#d0e0f0', '#b8d0ea', '#a0c0e4'],
      far:  '#f4f6fa', near: '#2a5ab8',
      accent: '#2a5ab8'
    },
    // Airsoft-Platz und Waldweg (Level 21/22): Moos, Waldboden, Tannen
    wald: {
      top:  ['#8cc85a', '#5a9a3a', '#6a4a2a', '#3a2614'],
      fill: ['#7a5634', '#5e4028', '#46301c', '#261a0e'],
      sky:  ['#5aa0d0', '#8ac4dc', '#c4e0d4', '#e4ecc4'],
      far:  '#4a7a5a', near: '#2a4e2e',
      accent: '#ff8a2a'
    },
    // Abflughalle (Level 24): polierter Steinboden, Morgendaemmerung draussen
    flughafen: {
      top:  ['#e4e8ee', '#c4cad4', '#9aa2ae', '#5a6270'],
      fill: ['#8a92a0', '#727a88', '#5a6270', '#343a46'],
      sky:  ['#1e2a4a', '#3a4a72', '#8a7aa0', '#e8a47a'],
      far:  '#c8d0dc', near: '#8a96aa',
      accent: '#ffd257'
    },
    // Sicherheitsbereich und Gates (Level 25): Teppich, grosse Fenster
    gate: {
      top:  ['#5a7ab8', '#3a5a98', '#2a4478', '#162848'],
      fill: ['#5a6270', '#4a5260', '#3a4250', '#20262e'],
      sky:  ['#4a78c0', '#7aa6dc', '#b8d4ec', '#f0dcb0'],
      far:  '#d4dce8', near: '#9aa8bc',
      accent: '#ffd257'
    },
    // Im Flugzeug (Level 26): blauer Teppich, helle Kabinenwaende
    kabine: {
      top:  ['#4a5a9a', '#34447e', '#26325e', '#141a34'],
      fill: ['#8a92a0', '#727a88', '#5a6270', '#343a46'],
      sky:  ['#e8ecf2', '#d8dee8', '#c8d0dc', '#b8c2d0'],
      far:  '#eef2f6', near: '#b8c2d2',
      accent: '#d8282e'
    },
    // Istanbul (Level 28): Kopfsteinpflaster, Nachmittagssonne ueber dem Wasser
    istanbul: {
      top:  ['#c8b8a0', '#a8967c', '#86745c', '#4a3e30'],
      fill: ['#8a7862', '#72624e', '#5a4c3c', '#302820'],
      sky:  ['#4a8ad0', '#7ab0e0', '#c8dcec', '#f4d8a8'],
      far:  '#8a9ab8', near: '#6a5a6a',
      accent: '#d8282e'
    },
    /* Level 29/30: Semih. Jede Form ist eine andere Dimension — mit
       eigenem Boden (semih.js malt den Rest). */
    // Semihs Buero: schwarzer Marmor mit Goldfugen
    semih: {
      top:  ['#3a3440', '#2a2430', '#1e1a24', '#c8a040'],
      fill: ['#1e1a24', '#18141e', '#120e16', '#8a6a2a'],
      sky:  ['#1a0e16', '#4a1a22', '#c8582a', '#f4a44a'],
      far:  '#3a2430', near: '#24161e',
      accent: '#e8c24a'
    },
    // Die Erinnerung: alter Holzboden, alles in Sepia
    semih_erinnerung: {
      top:  ['#c8a070', '#a8804e', '#86623a', '#4a3420'],
      fill: ['#86623a', '#6e4e2c', '#5a3e22', '#3a2614'],
      sky:  ['#5a4430', '#6a5038', '#7a5c40', '#8a6a48'],
      far:  '#4e3a28', near: '#3a2a1c',
      accent: '#f4dca0'
    },
    // Kosmos: Glas aus Sternenlicht
    semih_kosmos: {
      top:  ['#8a9aff', '#5a5ad8', '#3a2a9a', '#e8e0ff'],
      fill: ['#2a1a6a', '#20144e', '#160e3a', '#6a5ad8'],
      sky:  ['#05030f', '#140a2e', '#2a0e4a', '#4a1a5a'],
      far:  '#2a1a5a', near: '#1a0e3a',
      accent: '#ffd257'
    },
    // Der Riss: alles gleichzeitig. Schwarz, Rot, Gold.
    semih_riss: {
      top:  ['#5a2a2a', '#3a1a1e', '#2a1016', '#ff6a2a'],
      fill: ['#2a1016', '#1e0a10', '#14060a', '#8a2a1a'],
      sky:  ['#060204', '#1e060a', '#4a0a10', '#8a1a14'],
      far:  '#2a0a10', near: '#1a0608',
      accent: '#ffd257'
    },
    // Zuhause, nachts (Level 30): Gehweg vor Yusufs Haus
    heimat: {
      top:  ['#9aa0aa', '#7a808a', '#5e646e', '#3a3e46'],
      fill: ['#4a4038', '#3a322a', '#2e2620', '#1c1612'],
      sky:  ['#060818', '#101a3a', '#1e2a58', '#3a3a6a'],
      far:  '#1a1e3a', near: '#12142a',
      accent: '#ffd257'
    }
  };

  function makeTiles() {
    Object.keys(THEMES).forEach(function (name) {
      var t = THEMES[name];
      var palTop = { '1': t.top[0], '2': t.top[1], '3': t.top[2], '4': t.top[3] };
      var palFill = { '1': t.fill[0], '2': t.fill[1], '3': t.fill[2], '4': t.fill[3] };
      P.def('tile_' + name + '_top', MASK_TOP, palTop);
      P.def('tile_' + name + '_fill', MASK_FILL, palFill);
      // "innen" = dunklere Füllung für tief liegende Blöcke
      var palDeep = {
        '1': t.fill[2], '2': t.fill[2], '3': t.fill[3], '4': t.fill[3]
      };
      P.def('tile_' + name + '_deep', MASK_FILL, palDeep);
    });
  }

  makeTiles();

  global.Sprites = {
    THEMES: THEMES,
    tileTop: function (theme) { return 'tile_' + theme + '_top'; },
    tileFill: function (theme) { return 'tile_' + theme + '_fill'; },
    tileDeep: function (theme) { return 'tile_' + theme + '_deep'; }
  };

})(window);
