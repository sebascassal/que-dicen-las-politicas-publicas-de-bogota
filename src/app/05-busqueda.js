  // ================================================================ búsqueda (fichas)
  const EXAMPLES = ['vivienda', 'carga logística', 'mujeres rurales', 'empleo jóvenes', 'humedal', 'datos abiertos'];
  const qInput = $('#q'), hint = $('#q-help');
  const DEFAULT_HINT = 'Enter añade cada palabra, hasta tres. Quita una con su ×.';
  // una palabra suelta
  function pushWord(p, msgs) {
    if (S.words.length >= 3) { msgs.push({ k: 'max' }); return false; }
    const r = E.resolve(p);
    if (!r.ok) { msgs.push({ k: r.reason === 'frecuente' ? 'freq' : r.token ? 'none' : 'stop', w: p }); return true; }
    if (S.words.some(w => w.unit.key === 'w:' + r.term)) { msgs.push({ k: 'dup', w: p }); return true; }
    S.words.push({ word: p, term: r.term, label: r.suggested ? surf(r.term) : p.toLowerCase(), suggested: r.suggested, unit: E.wordUnit(r.term) });
    if (r.suggested) msgs.push({ k: 'sug', w: p, t: surf(r.term) });
    return true;
  }
  // una expresión de varias palabras que funciona como unidad de significado
  function pushPhrase(stems, label, msgs) {
    if (S.words.length >= 3) { msgs.push({ k: 'max' }); return; }
    const u = E.phraseUnit(stems, label); if (!u) return;
    if (S.words.some(w => w.unit.key === u.key)) { msgs.push({ k: 'dup', w: label }); return; }
    S.words.push({ word: label, term: label, suggested: false, unit: u, phrase: true });
    msgs.push({ k: 'unit', t: label, n: u.df });
  }
  // un producto de referencia: busca los productos que más se le parecen
  function pushDoc(i) {
    if (S.words.length >= 3 || S.words.some(w => w.doc === i)) return false;
    const label = '≈ ' + items[i].cod;
    S.words.push({ word: label, term: label, suggested: false, unit: E.docUnit(i, label), doc: i });
  }
  /* Lee lo escrito. Reconoce primero las expresiones que aparecen literalmente en los planes («habitante de calle»);
     lo demás entra palabra por palabra. Con split = true no busca expresiones (ejemplos y «separar»). */
  function addWords(text, split) {
    const msgs = [];
    if (split) { for (const p of text.split(/[\s,;]+/).filter(Boolean)) if (!pushWord(p, msgs)) break; return msgs; }
    ensureIndex();
    for (const seg of text.split(/[,;]+/)) for (const p of E.parse(seg)) {
      if (S.words.length >= 3) { msgs.push({ k: 'max' }); return msgs; }
      if (p.kind === 'p') pushPhrase(p.stems, p.label, msgs);
      else if (p.kind === 'stop') msgs.push({ k: 'stop', w: p.word });
      else pushWord(p.word, msgs);
    }
    return msgs;
  }
  // cambia una expresión por sus palabras sueltas
  function splitUnit(label) {
    const j = S.words.findIndex(w => w.phrase && w.term === label); if (j < 0) return;
    S.words.splice(j, 1);
    onQueryChange(addWords(label, true));
  }
  // políticas que no están en el visor: si la búsqueda toca su tema, se avisa
  const EXCL = D.verif.excluidos.map(x => ({ x, claves: x.claves.map(c => E.scan(c).filter(w => w.s).map(w => w.s)).filter(c => c.length) }));
  function exclusionNotes() {
    const seqs = S.words.filter(w => w.doc == null).map(w => w.unit.stems);
    return EXCL.filter(({ claves }) => claves.some(c => seqs.some(s => c.length === 1 ? s.includes(c[0]) : c.join(' ') === s.join(' ')))).map(e => e.x);
  }
  function showHint(msgs) {
    hint.textContent = '';
    hint.classList.toggle('is-default', !msgs || !msgs.length);
    const notes = exclusionNotes();
    const addNotes = () => notes.forEach(x => hint.append(' ', h('span', { class: 'hint-excl' }, 'La política de ', h('b', { text: x.tema }), ` (${x.instrumento}) no está en el visor. ${x.motivo}`)));
    if (!msgs || !msgs.length) { hint.textContent = S.words.length >= 3 ? 'La búsqueda ya tiene tres palabras. Quita una para cambiarla.' : DEFAULT_HINT; addNotes(); return; }
    msgs.forEach((m, j) => {
      if (j) hint.append(' ');
      if (m.k === 'sug') hint.append('¿Quisiste decir ', h('b', { text: '«' + m.t + '»' }), '? La usamos en lugar de «' + m.w + '».');
      else if (m.k === 'none') hint.append('«' + m.w + '» no aparece en el vocabulario de los planes de acción. Prueba con otra palabra.');
      else if (m.k === 'stop') hint.append('«' + m.w + '» es demasiado común o corta para buscar.');
      else if (m.k === 'freq') hint.append('«' + m.w + '» aparece en más de uno de cada cinco productos: es tan común que no distingue temas. Prueba con una palabra más específica.');
      else if (m.k === 'dup') hint.append('«' + m.w + '» ya está en la búsqueda.');
      else if (m.k === 'max') hint.append('La búsqueda admite hasta tres palabras.');
      else if (m.k === 'unit') hint.append('Leímos ', h('b', { text: '«' + m.t + '»' }), ` como una sola unidad de significado: ${plural(m.n, 'producto la menciona', 'productos la mencionan')}. `, h('button', { type: 'button', class: 'hint-btn', onclick: () => splitUnit(m.t) }, 'Buscar sus palabras por separado'));
      else if (m.k === 'sim') hint.append('Productos parecidos a ', h('b', { text: m.t }), ': se compara el texto de ese producto con el de todos los demás.');
    });
    addNotes();
  }
  function renderChips() {
    const ul = $('#chips'); ul.textContent = '';
    S.words.forEach((w, j) => {
      ul.append(h('li', { class: 'chip' + (w.phrase ? ' unit' : '') + (w.doc != null ? ' ref' : ''), title: w.doc != null ? 'Productos parecidos a: ' + items[w.doc].name : (w.phrase ? 'Unidad de significado: se busca como una sola expresión' : null) },
        h('span', { text: w.word }),
        w.suggested ? h('small', { text: '→ ' + w.label }) : null,
        h('button', { type: 'button', 'aria-label': 'Quitar «' + w.word + '»', onclick: () => { S.words.splice(j, 1); onQueryChange([]); qInput.focus(); } }, '×')));
    });
    qInput.disabled = S.words.length >= 3;
    qInput.placeholder = S.words.length >= 3 ? 'Máximo tres palabras' : (S.words.length ? 'Añade otra palabra' : 'Escribe una palabra y pulsa Enter');
  }
  $('#search').addEventListener('submit', ev => {
    ev.preventDefault();
    const v = qInput.value.trim();
    if (!v) { showHint([]); return; }
    const msgs = addWords(v);
    qInput.value = ''; hideSug();
    onQueryChange(msgs);
  });
  qInput.addEventListener('keydown', ev => { if (ev.key === 'Backspace' && !qInput.value && S.words.length) { S.words.pop(); onQueryChange([]); } });
  $('#chips-box').addEventListener('click', ev => { if (ev.target.id === 'chips-box') qInput.focus(); });
  EXAMPLES.forEach(ex => $('#examples').append(h('button', { type: 'button', onclick: () => { S.words = []; const m = addWords(ex, true); onQueryChange(m.filter(x => x.k === 'sug')); } }, ex)));
  // ejemplos de unidades de significado: expresiones de varias palabras que se buscan como una sola
  const UNIT_EXAMPLES = ['habitante de calle', 'primera infancia', 'cambio climático'];
  UNIT_EXAMPLES.forEach(ex => $('#examples').append(h('button', { type: 'button', class: 'ex-unit', title: 'Unidad de significado: se busca como una sola expresión', onclick: () => { S.words = []; onQueryChange(addWords(ex)); } }, ex)));
  $('#examples').append(h('button', { type: 'button', class: 'ex-rand', title: 'Busca una unidad de significado al azar', onclick: () => {
    ensureIndex();
    const pool = E.dict.filter(u => u.stems.length === 2 && u.df >= 8 && u.df <= 120); if (!pool.length) return;
    S.words = []; onQueryChange(addWords(pool[Math.floor(Math.random() * pool.length)].label));
  } }, 'Al azar'));

  // --- sugerencias mientras se escribe: unidades de significado y palabras del vocabulario
  const sugBox = $('#sug'); let sugItems = [], sugAt = -1;
  function hideSug() { sugBox.hidden = true; sugBox.textContent = ''; sugItems = []; sugAt = -1; qInput.setAttribute('aria-expanded', 'false'); qInput.removeAttribute('aria-activedescendant'); }
  function pickSug(s) {
    qInput.value = ''; hideSug();
    const msgs = [];
    if (s.kind === 'p') msgs.push(...addWords(s.label)); else pushWord(surf(s.label), msgs);
    onQueryChange(msgs); qInput.focus();
  }
  function renderSug() {
    const v = qInput.value.trim();
    if (v.length < 2 || S.words.length >= 3) { hideSug(); return; }
    ensureIndex();
    sugItems = E.suggest(v, 7); sugAt = -1; sugBox.textContent = '';
    if (!sugItems.length) { hideSug(); return; }
    sugItems.forEach((s, j) => sugBox.append(h('li', { id: 'sug-' + j, role: 'option', 'aria-selected': 'false', class: s.kind === 'p' ? 'is-unit' : null, onmousedown: ev => { ev.preventDefault(); pickSug(s); } },
      h('span', { class: 'sg-t', text: s.kind === 'p' ? s.label : surf(s.label) }), h('span', { class: 'sg-k', text: s.kind === 'p' ? 'unidad de significado' : 'palabra' }), h('span', { class: 'sg-n', text: plural(s.df, 'producto', 'productos') }))));
    sugBox.hidden = false; qInput.setAttribute('aria-expanded', 'true');
  }
  function moveSug(d) {
    if (!sugItems.length) return;
    const n = sugItems.length + 1;   // la posición n-1 equivale a «ninguna»
    sugAt = ((sugAt < 0 ? n - 1 : sugAt) + d + n) % n; if (sugAt === n - 1) sugAt = -1;
    [...sugBox.children].forEach((li, j) => li.setAttribute('aria-selected', j === sugAt ? 'true' : 'false'));
    if (sugAt >= 0) qInput.setAttribute('aria-activedescendant', 'sug-' + sugAt); else qInput.removeAttribute('aria-activedescendant');
  }
  qInput.addEventListener('input', renderSug);
  qInput.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== qInput) hideSug(); }, 120));
  qInput.addEventListener('keydown', ev => {
    if (sugBox.hidden) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); moveSug(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveSug(-1); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); hideSug(); }
    else if (ev.key === 'Enter' && sugAt >= 0) { ev.preventDefault(); pickSug(sugItems[sugAt]); }
  });
  // «/» lleva al buscador desde cualquier parte
  document.addEventListener('keydown', ev => {
    if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA' || a.closest('dialog'))) return;
    ev.preventDefault(); qInput.focus();
  });

  // --- recorrido: las últimas búsquedas, para volver sobre los pasos
  const trail = [];
  function pushTrail() {
    if (!S.words.length) return;
    const key = hashFor(), at = trail.findIndex(t => t.key === key);
    if (at >= 0) trail.splice(at, 1);
    trail.push({ key, label: S.words.map(w => w.word).join(' + ') });
    if (trail.length > 6) trail.shift();
    const box = $('#trail'); box.textContent = '';
    box.hidden = trail.length < 2;
    if (box.hidden) return;
    box.append(h('span', { text: 'Recorrido:' }));
    trail.forEach((t, j) => box.append(h('button', { type: 'button', 'aria-current': j === trail.length - 1 ? 'true' : null, onclick: () => { if (t.key === hashFor()) return; const m = applyParts(t.key.slice(3).split('-')); onQueryChange(m.filter(x => x.k === 'sug')); } }, t.label)));
    box.scrollLeft = box.scrollWidth;
  }

  function onQueryChange(msgs, fromHash) {
    S.sel = null; S.shown = 30; S.focus = null; S.filt.pol = '';
    if (S.words.length < 2) S.filt.con = '';
    compute();
    pushTrail();
    showHint(msgs);
    renderChips();
    if (cam.s > 1.001 || cam.anim) camTo(1, W / 2, H / 2);
    renderFocusBar();
    renderAll(true);
    if (!fromHash) writeHash();
  }
  window.addEventListener('hashchange', () => {
    const ws = readHash();
    if (!ws || location.hash === hashFor()) return;
    const m = applyParts(ws);
    onQueryChange(m.filter(x => x.k === 'sug'), true);
  });

