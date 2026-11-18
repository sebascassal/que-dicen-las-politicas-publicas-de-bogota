  // ================================================================ panel de resultados
  const fSector = $('#f-sector'), fPol = $('#f-pol');
  function setFilter(k, v) {
    const prev = S.filt[k];
    S.filt[k] = v; S.shown = 30;
    if (k === 'pol') {
      if (v !== '') focusGroup('p' + v);
      else if (S.focus === 'p' + prev) focusGroup(null);
    }
    renderAll(false);
  }
  fSector.addEventListener('change', () => setFilter('sector', fSector.value));
  fPol.addEventListener('change', () => setFilter('pol', fPol.value));
  const fEnt = $('#f-ent'), fEnf = $('#f-enf'), fRel = $('#f-rel'), fSort = $('#f-sort'), fLit = $('#f-lit'), fCon = $('#f-con');
  fEnt.addEventListener('change', () => setFilter('ent', fEnt.value));
  fEnf.addEventListener('change', () => setFilter('enf', fEnf.value));
  fRel.addEventListener('change', () => setFilter('rel', fRel.value));
  fLit.addEventListener('change', () => setFilter('lit', fLit.checked ? '1' : ''));
  fCon.addEventListener('change', () => setFilter('con', fCon.checked ? '1' : ''));
  fSort.addEventListener('change', () => { S.sort = fSort.value; S.shown = 30; renderAll(false); });
  // copia la tabla de resultados (con los filtros activos) para pegarla en una hoja de cálculo
  $('#copy').addEventListener('click', () => {
    const list = currentList(), msg = $('#copy-msg');
    if (!list.length) { msg.textContent = 'No hay resultados para copiar.'; return; }
    // sin tabulaciones ni saltos; si el texto empieza como una fórmula (=, +, @ o un guion que no es un número negativo),
    // lleva un apóstrofo delante para que la hoja de cálculo lo lea como texto y no lo ejecute
    const cell = v => { const t = String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ').trim(); return /^[=+@]|^-(?![\d,.]*$)./.test(t) ? "'" + t : t; };
    // primero, de dónde sale la tabla: búsqueda, filtros, corte, versión y aviso (para citarla sin perder el contexto)
    const filtros = [...$('#active-filters').querySelectorAll('.af')].map(e => e.firstChild.textContent).join('; ');
    const rows = [[`Búsqueda: ${R.labels.map(t => '«' + t + '»').join(' + ')}${filtros ? ' · Filtros: ' + filtros : ''} · ¿Qué dicen las Políticas Públicas de Bogotá? versión ${D.version} · Corte ${D.corte.largo} · Fuente: planes de acción publicados por la Secretaría Distrital de Planeación · No es una publicación oficial`],
      ['Puesto', 'Relación', 'Instrumento', 'Política', 'Sector líder de la política', 'Código', 'Producto', 'Indicador', 'Entidad', 'Dependencia', 'Meta final', 'Enfoques', 'Plan de acción']];
    list.forEach((i, j) => { const it = items[i], p = POLS[it.pol]; rows.push([j + 1, f2(R.all[i]), p.i, p.sn, SECTORS[it.sector], it.cod, it.name, it.ind, it.ent, it.dep, it.meta, ENFS.filter((_, k) => it.enf >> k & 1).join(', '), p.pa]); });
    const text = rows.map(r => r.map(cell).join('\t')).join('\n');
    const done = ok => { msg.textContent = ok ? `Copiado: ${plural(list.length, 'fila', 'filas')}. Pega en una hoja de cálculo.` : 'No se pudo copiar desde este navegador.'; };
    const legacy = () => { const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0' }); ta.value = text; document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); done(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), legacy); else legacy();
  });
  function fillSelect(sel, opts, value) {
    sel.textContent = '';
    for (const o of opts) sel.append(h('option', { value: o.v, text: o.t }));
    sel.value = value;
    if (sel.value !== value) sel.value = '';
  }
  function renderFilters() {
    const rel = R ? R.related : [];
    const cs = new Map(), cp = new Map();
    for (const i of rel) { const it = items[i]; cs.set(it.sector, (cs.get(it.sector) || 0) + 1); cp.set(it.pol, (cp.get(it.pol) || 0) + 1); }
    const so = [{ v: '', t: 'Todos los sectores' }];
    SECTORS.forEach((s, j) => { const n = cs.get(j) || 0; if (n || S.filt.sector === String(j)) so.push({ v: String(j), t: `${s} (${N(n)})` }); });
    fillSelect(fSector, so, S.filt.sector);
    const po = [{ v: '', t: 'Todas las políticas' }];
    POLS.map((p, j) => [j, cp.get(j) || 0]).filter(([j, n]) => n || S.filt.pol === String(j))
      .sort((a, b) => b[1] - a[1] || POLS[a[0]].sn.localeCompare(POLS[b[0]].sn, 'es'))
      .forEach(([j, n]) => po.push({ v: String(j), t: `${POLS[j].sn} (${N(n)})` }));
    fillSelect(fPol, po, S.filt.pol);
    // filtros adicionales: entidad responsable, enfoque, fuerza de la relación, mención literal y conexión entre palabras
    const ce = new Map(), cf = ENFS.map(() => 0); let nStrong = 0, nCon = 0;
    for (const i of rel) {
      const it = items[i]; ce.set(it.entI, (ce.get(it.entI) || 0) + 1);
      for (let k = 0; k < ENFS.length; k++) if (it.enf >> k & 1) cf[k]++;
      if (R.all[i] >= STRONG) nStrong++;
      if (interItem(i)) nCon++;
    }
    const eo = [{ v: '', t: 'Todas las entidades' }];
    [...ce.entries()].sort((a, b) => b[1] - a[1] || D.strs[a[0]].localeCompare(D.strs[b[0]], 'es')).forEach(([j, n]) => eo.push({ v: String(j), t: `${D.strs[j]} (${N(n)})` }));
    if (S.filt.ent !== '' && !ce.has(+S.filt.ent)) eo.push({ v: S.filt.ent, t: `${D.strs[+S.filt.ent]} (0)` });
    fillSelect(fEnt, eo, S.filt.ent);
    const fo = [{ v: '', t: 'Todos los enfoques' }];
    ENFS.forEach((e, k) => { if (cf[k] || S.filt.enf === String(k)) fo.push({ v: String(k), t: `${e} (${N(cf[k])})` }); });
    fillSelect(fEnf, fo, S.filt.enf);
    fillSelect(fRel, [{ v: '', t: 'Fuerte y media' }, { v: 's', t: `Solo fuerte (${N(nStrong)})` }], S.filt.rel);
    fillSelect(fSort, [{ v: 'rel', t: 'Más relación primero' }, { v: 'pol', t: 'Agrupar por política' }, { v: 'ent', t: 'Agrupar por entidad' }], S.sort);
    fLit.checked = S.filt.lit !== ''; fCon.checked = S.filt.con !== '';
    $('#f-lit-n').textContent = R ? ` (${N(R.nLit)})` : '';
    $('#f-con-n').textContent = R ? ` (${N(nCon)})` : '';
    $('#f-con-l').hidden = !R || R.terms.length < 2;
    const extra = ['ent', 'enf', 'rel', 'lit', 'con'].filter(k => S.filt[k] !== '').length + (S.sort !== 'rel' ? 1 : 0);
    $('#mf-n').textContent = extra ? String(extra) : '';
    $('#mf-n').hidden = !extra;
    // ¿quién responde? Las entidades con más productos en la lista actual
    const fc = $('#facets');
    keepFocus(fc, () => { fc.textContent = '';
    if (R && S.filt.ent === '') {
      const cur = new Map(); for (const i of currentList()) cur.set(items[i].entI, (cur.get(items[i].entI) || 0) + 1);
      const topE = [...cur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      if (topE.length > 1) {
        fc.append(h('span', { class: 'fc-t', text: 'Entidades con más productos' }));
        topE.forEach(([j, n]) => fc.append(h('button', { type: 'button', 'data-k': 'ent' + j, title: 'Ver solo los productos de ' + D.strs[j], onclick: () => setFilter('ent', String(j)) }, D.strs[j].replace(/^Secretaría (Distrital )?(de(l| la)? )?/, 'Sec. '), h('b', { text: N(n) }))));
      }
    }
    }, () => $('#f-ent'));
    $('#copy-msg').textContent = '';
    const af = $('#active-filters');
    keepFocus(af, () => { af.textContent = '';
    const chip = (label, k) => af.append(h('span', { class: 'af' }, label, h('button', { type: 'button', 'data-k': 'af-' + k, 'aria-label': 'Quitar filtro ' + label, onclick: () => setFilter(k, '') }, '×')));
    if (S.filt.sector !== '') chip('Sector: ' + SECTORS[+S.filt.sector], 'sector');
    if (S.filt.pol !== '') chip('Política: ' + POLS[+S.filt.pol].sn, 'pol');
    if (S.filt.ent !== '') chip('Entidad: ' + D.strs[+S.filt.ent], 'ent');
    if (S.filt.enf !== '') chip('Enfoque: ' + ENFS[+S.filt.enf], 'enf');
    if (S.filt.rel !== '') chip('Relación fuerte', 'rel');
    if (S.filt.lit !== '') chip('Mención literal', 'lit');
    if (S.filt.con !== '') chip('Conecta palabras', 'con');
    }, () => $('#f-sector'));
  }
  function renderSummary(list) {
    const sum = $('#summary'); sum.textContent = '';
    if (!R) { sum.textContent = 'Escribe una palabra para ver los productos relacionados.'; return; }
    const pp = list;
    const byPol = new Map();
    pp.forEach(i => byPol.set(items[i].pol, (byPol.get(items[i].pol) || 0) + 1));
    const top = [...byPol.entries()].sort((a, b) => b[1] - a[1] || POLS[a[0]].sn.localeCompare(POLS[b[0]].sn, 'es')).slice(0, 3);
    const filtered = anyFilter();
    const big = h('span', { class: 'big' }, N(list.length), ' ', h('em', { text: list.length === 1 ? 'producto' : 'productos' }));
    if (byPol.size) big.append(' · ' + plural(byPol.size, 'política', 'políticas'));
    sum.append(big);
    if (filtered) sum.append('Con los filtros activos. ');
    if (pp.length) {
      sum.append(`${plural(pp.length, 'producto se relaciona', 'productos se relacionan')} con tu búsqueda`);
      if (top.length) {
        sum.append(top.length === 1 ? '; la política con más productos relacionados es ' : (top.length === 2 ? '; las dos políticas con más productos relacionados son ' : '; las tres políticas con más productos relacionados son '));
        top.forEach(([j, n], k) => { if (k) sum.append(k === top.length - 1 ? ' y ' : ', '); sum.append(h('b', { text: POLS[j].sn }), ` (${N(n)})`); });
      }
      sum.append('.');
    }
  }
  function renderList(list) {
    const ol = $('#results'); ol.textContent = '';
    const frag = document.createDocumentFragment();
    if (R && !list.length) frag.append(h('li', { class: 'empty', text: 'Ningún producto cumple los filtros activos. Quita un filtro para ver más resultados.' }));
    list.slice(0, S.shown).forEach((i, j) => frag.append(card(i, j + 1)));
    ol.append(frag);
    const more = $('#more');
    more.hidden = list.length <= S.shown;
    more.textContent = `Mostrar más (${N(Math.min(30, list.length - S.shown))} de ${N(list.length - S.shown)} restantes)`;
  }
  $('#more').addEventListener('click', () => { S.shown += 30; renderList(currentList()); });
  const cardEl = i => document.querySelector(`#results .card[data-i="${i}"]`);
  function card(i, rank) {
    const it = items[i], v = R.all[i], fam = FAMS[it.fam];
    const li = h('li', { class: 'card' + (S.sel === i ? ' sel' : ''), style: '--fam:' + fam.color, 'data-i': i, tabindex: '-1', 'aria-current': S.sel === i ? 'true' : null });
    li.append(h('span', { class: 'rank', 'aria-hidden': 'true', text: String(rank).padStart(2, '0') }));
    const head = h('div', { class: 'pol' }, h('span', { class: 'fam-dot', title: fam.nombre }), h('b', { text: POLS[it.pol].i }), ' · ' + POLS[it.pol].sn);
    li.append(h('div', { class: 'card-head' }, head,
      h('div', { class: 'rel', title: 'Similitud con la búsqueda completa' }, h('span', { class: 'rel-num', text: f2(v) }), h('span', { class: 'rel-bar' }, h('i', { style: 'width:' + Math.round(clamp(v / 0.8, 0.02, 1) * 100) + '%' })), h('span', { class: 'rel-lab ' + (v >= STRONG ? 's' : v >= MEDIUM ? 'm' : 't'), text: relLabel(v, i) }))));
    li.append(h('h3', null, h('span', { class: 'code', text: it.cod }), hl(it.name)));
    const dl = h('dl');
    dl.append(h('dt', { text: 'Indicador' }), h('dd', null, it.ind ? hl(it.ind) : '—'));
    dl.append(h('dt', { text: 'Entidad' }), h('dd', { text: it.ent + (it.dep && it.dep !== '-' ? ' · ' + it.dep : '') }));
    if (it.meta && it.meta !== '-') dl.append(h('dt', { text: 'Meta final' }), h('dd', { text: it.meta }));
    li.append(dl);
    // detalle del plan de acción: objetivo, resultado y enfoques del producto
    const enfs = ENFS.filter((_, k) => it.enf >> k & 1), litRes = R.lit[i] && E.marks(it.res, R.units).length > 0;
    const dl2 = h('dl');
    if (it.obj) dl2.append(h('dt', { text: 'Objetivo' }), h('dd', { text: it.obj }));
    if (it.res) dl2.append(h('dt', { text: 'Resultado' }), h('dd', null, hl(it.res)));
    dl2.append(h('dt', { text: 'Enfoques' }), h('dd', { text: enfs.length ? enfs.join(' · ') : '—' }));
    const det = h('details', { class: 'card-more', open: litRes || null }, h('summary', null, 'Objetivo, resultado y enfoques'), dl2);
    det.addEventListener('click', ev => ev.stopPropagation());
    li.append(det);
    if (R.lit[i] && i !== R.ref) li.append(h('div', { class: 'lit-tag', text: 'Mención literal' }));
    if (R.terms.length > 1) li.append(h('div', { class: 'per-word' }, R.labels.map((t, j) => h('span', null, '«' + t + '» ', h('b', { text: f2(Math.max(0, R.per[j][i])) })))));
    const foot = h('div', { class: 'card-foot' });
    foot.append(h('button', { type: 'button', class: 'loc', onclick: ev => { ev.stopPropagation(); locate(i); } }, 'Ubicar en la nube'));
    if (i !== R.ref) foot.append(h('button', { type: 'button', class: 'loc', title: 'Busca en todas las políticas los productos con el texto más parecido a este', onclick: ev => { ev.stopPropagation(); similar(i); } }, 'Productos parecidos'));
    foot.append(h('a', { href: POLS[it.pol].pa, target: '_blank', rel: 'noopener noreferrer', onclick: ev => ev.stopPropagation() }, 'Plan de acción (Excel) ↗'));
    li.append(foot);
    li.addEventListener('click', () => selectItem(S.sel === i ? null : i, 'list'));
    li.addEventListener('keydown', ev => { if (ev.target === li && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); selectItem(S.sel === i ? null : i, 'list'); } });
    return li;
  }
  function showCard(i, focus = true) {
    const list = currentList(), idx = list.indexOf(i);
    if (idx < 0) return;
    if (idx >= S.shown) { S.shown = idx + 10; renderList(list); }
    const c = cardEl(i); if (!c) return;
    c.classList.add('sel');
    c.scrollIntoView({ block: DESK.matches ? 'nearest' : 'center', behavior: REDUCED ? 'auto' : 'smooth' });
    if (focus) c.focus({ preventScroll: true });
  }
  // consulta por parecido: toma un producto como referencia y busca los más cercanos en todas las políticas
  function similar(i) {
    S.words = []; pushDoc(i);
    S.filt.sector = ''; S.filt.ent = ''; S.filt.enf = ''; S.filt.rel = ''; S.filt.lit = '';
    onQueryChange([{ k: 'sim', t: items[i].cod + ' · ' + POLS[items[i].pol].sn }]);
    ensureSkyVisible();
  }
  function locate(i) {
    const r = wrap.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) wrap.scrollIntoView({ block: DESK.matches ? 'nearest' : 'start', behavior: REDUCED ? 'auto' : 'smooth' });
    selectItem(i, 'list');
  }
  function selectItem(i, src) {
    S.sel = i;
    document.querySelectorAll('#results .card.sel').forEach(c => { c.classList.remove('sel'); c.removeAttribute('aria-current'); });
    if (i !== null) {
      // desde la nube, la lista acompaña sin quitarle el foco: las flechas siguen recorriendo los productos
      if (src === 'sky' && DESK.matches) showCard(i, false);
      const c = cardEl(i); if (c) { c.classList.add('sel'); c.setAttribute('aria-current', 'true'); }
      if (src === 'sky') {
        const list = currentList(), it = items[i];
        $('#sky-live').textContent = `Producto ${N(list.indexOf(i) + 1)} de ${N(list.length)}: ${it.cod} ${it.name}. ${POLS[it.pol].sn}. Relación ${f2(R.all[i])}.`;
      }
      const st = SK.stars.get(items[i].id);
      if (st && S.focus !== st.g) focusGroup(st.g, true);
    }
    kick(); pinTip(); invalidate(); updateZoomCtl();
  }

