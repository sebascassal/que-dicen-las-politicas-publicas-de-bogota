  // --- leyenda, pie de figura y descripción accesible
  function renderLegend() {
    const ul = $('#legend-list');
    keepFocus(ul, () => { ul.textContent = '';
    const cnt = FAMS.map(() => 0);
    if (R) for (const i of R.related) cnt[items[i].fam]++;
    FAMS.forEach((f, j) => {
      ul.append(h('li', null, h('button', { type: 'button', 'data-k': 'fam' + j, 'aria-pressed': S.iso === j ? 'true' : 'false', title: 'Sectores: ' + f.sectores.join(', '), onclick: () => { S.iso = S.iso === j ? null : j; renderLegend(); invalidate(); } },
        h('span', { class: 'sw', style: 'background:' + f.color }), h('span', { text: f.corto }), h('span', { class: 'n', text: N(cnt[j]) }))));
    });
    });
  }
  let gindexAll = false;
  function ensureSkyVisible() {
    const r = wrap.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight + 2) wrap.scrollIntoView({ block: DESK.matches ? 'nearest' : 'start', behavior: REDUCED ? 'auto' : 'smooth' });
  }
  function renderGroupIndex() {
    const box = $('#gindex-wrap'), ol = $('#gindex'), more = $('#gindex-more');
    renderNeighborList();
    keepFocus(ol, () => { ol.textContent = '';
    if (!R || !SK.groups.length) { box.hidden = true; return; }
    box.hidden = false;
    const ranked = [...SK.groups].sort((a, b) => a.rank - b.rank), lim = gindexAll ? ranked.length : Math.min(ranked.length, 10);
    // el nivel de banda con cada palabra, que en la figura solo da el grosor y el color, va en el nombre accesible:
    // un texto oculto a la vista dentro del botón, para que el nombre empiece por lo que se ve (WCAG 2.5.3)
    const bands = g => R.labels.map((t, w) => g.mx[w] >= MEDIUM ? `banda ${BAND_N[bandOf(g.sum[w])].toLowerCase()} con «${t}»` : `sin banda con «${t}»`).join(', ');
    ranked.slice(0, lim).forEach(g => ol.append(h('li', null, h('button', { type: 'button', 'data-k': g.key, 'aria-pressed': S.focus === g.key ? 'true' : 'false', title: POLS[g.pol].n, onclick: () => { if (S.focus === g.key) focusGroup(null); else { ensureSkyVisible(); focusGroup(g.key); } } },
      h('span', { class: 'gi-n', text: String(g.rank).padStart(2, '0') }), ' ', h('span', { class: 'gi-name', text: groupName(g) }), ' ', h('span', { class: 'gi-c', text: N(g.n) }),
      h('span', { class: 'sr-only', text: ` ${g.n === 1 ? 'producto relacionado' : 'productos relacionados'}; ${bands(g)}. ${POLS[g.pol].n}` })))));
    more.hidden = ranked.length <= 10;
    more.textContent = gindexAll ? 'Ver solo las 10 primeras' : `Ver las ${N(ranked.length)} políticas`;
    }, () => $('#gindex-more'));
  }
  $('#gindex-more').addEventListener('click', () => { gindexAll = !gindexAll; renderGroupIndex(); });
  // las palabras vecinas también en texto: quien no ve el lienzo o usa el teclado puede leerlas y sumarlas a la búsqueda
  function renderNeighborList() {
    const box = $('#nb-wrap'), ul = $('#nb-list');
    keepFocus(ul, () => {
      ul.textContent = '';
      const cs = R && SK.clouds ? [...SK.clouds].sort((a, b) => b.sim - a.sim) : [];
      box.hidden = !cs.length;
      cs.forEach(c => ul.append(h('li', null, h('button', { type: 'button', class: c.phrase ? 'nb-p' : null, 'data-k': c.term,
        title: 'Sumar a la búsqueda', onclick: () => addFromCloud(c) },
        h('span', { text: c.text }), ' ', h('span', { class: 'sr-only', text: 'cercanía ' }), h('small', { text: f2(c.sim) }), h('span', { class: 'sr-only', text: ': sumar a la búsqueda' })))));
    }, () => $('#q'));
  }
  function updateCaption() {
    const el = $('#sky-sub'); el.textContent = '';
    if (!R) { el.textContent = 'Escribe una palabra para encender la nube.'; return; }
    el.append(h('span', { class: 'fig-n', text: 'Fig. 1' }));
    R.labels.forEach((t, j) => { if (j) el.append(' + '); el.append(h('b', { text: '«' + t + '»' })); });
    el.append(` · ${plural(R.related.length, 'producto relacionado', 'productos relacionados')} en ${plural(SK.groups.length, 'política', 'políticas')}`);
    if (SK.inter && SK.inter.n) el.append(` · ${plural(SK.inter.n, 'producto conecta', 'productos conectan')} las palabras (halo amarillo)`);
    if (R.hasPhrase && R.nLit) el.append(` · ${plural(R.nLit, 'la menciona', 'la mencionan')} literalmente`);
    el.append('.');
  }
  function updateSkyLabel() {
    if (!R) { sky.setAttribute('aria-label', 'Nube vacía: escribe una palabra para empezar.'); return; }
    const ws = R.labels.map(t => '«' + t + '»');
    sky.setAttribute('aria-label', `Nube de relaciones entre palabras para ${listJoin(ws)}. En el centro, cada palabra con sus palabras vecinas; alrededor, ${plural(SK.groups.length, 'política', 'políticas')} como círculos con sus ${N(R.related.length)} productos relacionados, unidas a las palabras por bandas cuyo grosor y color indican la intensidad de la articulación temática (el nivel de cada banda está en la lista «Políticas en la figura»)${SK.inter ? `; ${N(SK.inter.n)} productos conectan dos o más palabras` : ''}. Las palabras vecinas están en la lista que sigue a la figura. Las flechas recorren los productos en orden de relación; más y menos acercan y alejan. La lista de productos relacionados contiene la misma información.`);
  }

  function renderAll(relayout) {
    const list = currentList();
    renderFilters();
    renderSummary(list);
    renderList(list);
    renderLegend();
    if (relayout) layoutSky(false);
    else { invalidate(); updateCaption(); }
    if (!relayout) pinTip();
  }

