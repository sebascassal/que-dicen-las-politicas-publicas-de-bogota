  // ================================================================ cabecera y arranque
  [[N(D.verif.productos_vigentes), 'productos vigentes'], [N(D.verif.politicas_con_productos_vigentes), 'políticas incluidas'], [N(SECTORS.length), 'sectores administrativos'], [D.corte.corto, 'fecha de corte']]
    .forEach(([v, t]) => $('#stats').append(h('li', null, h('b', { text: v }), h('span', { text: t }))));
  $('.skip').addEventListener('click', ev => { ev.preventDefault(); const p = $('#panel'); p.scrollIntoView({ block: 'start' }); p.focus({ preventScroll: true }); });
  // leyenda de las bandas: los cinco niveles con su grosor y su color reales (mismas constantes que el lienzo)
  {
    const box = $('#bandkey'), ol = h('ol', { class: 'bandscale' });
    BAND_N.forEach((name, k) => ol.append(h('li', null, h('i', { style: `height:${BAND_W[k]}px;background:${BAND_C[k]}` }), h('b', { text: name }), h('span', { text: BAND_R[k] }))));
    box.append(h('h3', { class: 'mini' }, 'Bandas: intensidad de la articulación temática ', h('small', { text: 'suma de la relación (desde 0,18) de los productos relacionados de cada política con cada palabra; más gruesa y más oscura, más intensa. Crece con el número de productos del plan y no mide coordinación entre entidades ni entre políticas.' })), ol);
  }

  // apoyo para las pruebas automáticas: punto en pantalla de la primera palabra vecina
  window.__visorTest = { cloudPoint() { const c = SK.clouds.find(x => !x.shared) || SK.clouds[0]; if (!c) return null; const [wx, wy] = cloudPos(c), [x, y] = toScreen(wx, wy); return { x, y, term: c.term }; } };
  const initial = readHash();
  const m0 = applyParts(initial && initial.length ? initial : ['mujeres', 'rurales']);
  compute();
  pushTrail();
  renderChips();
  showHint(initial ? m0.filter(x => x.k !== 'sug' && x.k !== 'unit') : []);
  renderAll(false);
  // el índice de textos y el diccionario de unidades se arman después del primer pintado
  setTimeout(() => warmIndex(() => { compute(); renderAll(!!SK.geo); }), 30);
  let rsT = 0;
  new ResizeObserver(() => { clearTimeout(rsT); rsT = setTimeout(resize, 60); }).observe(wrap);
  const fontLoads = document.fonts && document.fonts.load
    ? Promise.all([`900 20px ${F_HEAD}`, `600 12px ${F_BODY}`, `700 12px ${F_BODY}`, `800 12px ${F_BODY}`, `400 10px ${F_MONO}`, `700 10px ${F_MONO}`].map(f => document.fonts.load(f))).catch(() => null)
    : Promise.resolve();
  Promise.race([fontLoads, new Promise(r => setTimeout(r, 1500))]).then(() => { fontsReady = true; W = 0; resize(); });

