  // --- tooltips
  let tipW = 0, tipH = 0;
  function bars(rows) {
    const grid = h('div', { class: 't-per' });
    rows.forEach(([label, v, txt]) => grid.append(h('span', { text: label }), h('span', { class: 'bar' }, h('i', { style: 'width:' + Math.round(clamp(v / .8, .02, 1) * 100) + '%' })), h('span', { text: txt })));
    return grid;
  }
  function tipProduct(i, pinned) {
    const it = items[i];
    tip.textContent = '';
    if (pinned) tip.append(h('button', { type: 'button', class: 't-close', 'aria-label': 'Cerrar', onclick: () => { selectItem(null, 'sky'); sky.focus({ preventScroll: true }); } }, '×'));
    tip.append(h('div', { class: 't-kick', text: `${f2(R.all[i])} · ${relLabel(R.all[i], i)}` }));
    tip.append(h('div', { class: 't-name' }, h('span', { class: 't-code', text: it.cod }), it.name));
    tip.append(h('div', { class: 't-pol', text: `${POLS[it.pol].i} · ${POLS[it.pol].sn} · Sector líder: ${SECTORS[it.sector]}` }));
    if (R.terms.length > 1) tip.append(bars(R.labels.map((t, j) => ['«' + t + '»', R.per[j][i], f2(Math.max(0, R.per[j][i]))])));
    if (pinned) {
      const row = h('div', { class: 't-actions' });
      row.append(h('button', { type: 'button', class: 't-btn', onclick: () => showCard(i) }, 'Ver en la lista'));
      if (i !== R.ref) row.append(h('button', { type: 'button', class: 't-btn', onclick: () => similar(i) }, 'Parecidos'));
      row.append(h('a', { class: 't-btn', href: POLS[it.pol].pa, target: '_blank', rel: 'noopener noreferrer' }, 'Plan de acción ↗'));
      tip.append(row);
    }
    measureTip();
  }
  function tipGroup(g) {
    tip.textContent = '';
    const p = POLS[g.pol];
    tip.append(h('div', { class: 't-kick ink', text: `${p.i} · Sector líder: ${SECTORS[p.s]}` }), h('div', { class: 't-name', text: p.n }), h('div', { class: 't-pol', text: `${N(g.n)} de ${N(p.c)} productos vigentes (${Math.round(100 * g.n / p.c)} %) se relacionan con tu búsqueda` }));
    tip.append(bandRows(g));
    tip.append(h('div', { class: 't-pol', style: 'margin-top:7px', text: S.focus === g.key ? 'Haz clic para alejarte.' : 'Haz clic para acercarte y ver sus productos.' }));
    measureTip();
  }
  function tipCloud(c) {
    tip.textContent = '';
    tip.append(h('div', { class: 't-kick ink', text: c.phrase ? 'Unidad de significado vecina' : 'Palabra vecina' }), h('div', { class: 't-name', text: '«' + c.text + '»' }),
      h('div', { class: 't-pol', text: `${plural(c.df, 'producto la menciona', 'productos la mencionan')} · cercanía ${f2(c.sim)}` }),
      h('div', { class: 't-pol', style: 'margin-top:7px', text: S.words.length >= 3 ? 'Haz clic para buscarla sola.' : 'Haz clic para sumarla a la búsqueda.' }));
    measureTip();
  }
  // filas de la ficha de una política: la banda que la une con cada palabra, con su nivel, su intensidad y su relación máxima
  function bandRows(g) {
    const grid = h('div', { class: 't-per t-bands' });
    R.labels.forEach((t, w) => {
      const has = g.mx[w] >= MEDIUM, k = bandOf(g.sum[w]);
      grid.append(h('span', { text: '«' + t + '»' }),
        h('span', { class: 'band-sw' }, has ? h('i', { style: `height:${BAND_W[k]}px;background:${BAND_C[k]}` }) : null),
        h('span', { text: has ? BAND_N[k] : 'Sin banda' }),
        h('span', { class: 't-sub', text: has ? `${plural(g.cnt[w], 'producto', 'productos').replace(' ', ' ')} · intensidad ${f1(g.sum[w])} · máx. ${f2(g.mx[w])}` : `relación máxima ${f2(Math.max(0, g.mx[w]))}` }));
    });
    return grid;
  }
  function measureTip() { tip.hidden = false; tipW = tip.offsetWidth; tipH = tip.offsetHeight; }
  function showTipAt(x, y) {
    let left = x + 16, top = y + 14;
    if (left + tipW > W - 8) left = x - tipW - 16;
    if (top + tipH > H - 8) top = y - tipH - 14;
    tip.style.left = clamp(left, 6, Math.max(6, W - tipW - 6)) + 'px';
    tip.style.top = clamp(top, Math.max(6, fbarBottom + 6), Math.max(6, H - tipH - 6)) + 'px';
  }
  function hideHover() {
    if (SK.hover !== null || SK.hoverG || SK.hoverC) { SK.hover = null; SK.hoverG = null; SK.hoverC = null; invalidate(); }
    if (!tip.classList.contains('pinned')) tip.hidden = true;
  }
  function pinTip() {
    const st = S.sel !== null && R ? SK.stars.get(items[S.sel].id) : null;
    if (!st || st.dying) { if (tip.classList.contains('pinned')) { const was = tip.classList.contains('dock'); tip.classList.remove('pinned', 'dock'); tip.hidden = true; if (was) fitFocus(false); } return; }
    tip.classList.add('pinned');
    // en pantallas angostas o bajas (también con zoom al 200 %) la ficha se acopla abajo para que quepa entera
    tip.classList.toggle('dock', W < 620 || H < 480);
    tipProduct(S.sel, true);
    placePinned();
    if (tip.classList.contains('dock')) fitFocus(false);
  }
  function placePinned() {
    if (!tip.classList.contains('pinned') || S.sel === null) return;
    if (tip.classList.contains('dock')) { tip.style.left = ''; tip.style.top = ''; return; }
    const st = SK.stars.get(items[S.sel].id); if (!st) return;
    const [x, y] = toScreen(st.cx, st.cy);
    showTipAt(x, y);
  }

