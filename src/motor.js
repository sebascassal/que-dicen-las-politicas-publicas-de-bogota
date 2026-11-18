/* Motor semántico del visor (TF-IDF + LSA precalculado). Sin red: todo en el navegador. */
function createEngine(M, b64decode) {
  const SW = new Set(`a al ante bajo con contra de del desde durante en entre hacia hasta mediante para por segun sin sobre tras el la los las un una unos unas lo y e o u ni que se su sus es son ser como mas este esta estos estas ese esa cada otro otra otros otras no si ya le les muy todo toda todos todas numero porcentaje sumatoria total implementado implementada implementados implementadas realizado realizadas realizados desarrollado desarrollada acciones accion distrito distrital capital bogota`.split(/\s+/));
  const normToken = w => (w.length > 5 && w.endsWith("es")) ? w.slice(0, -2) : (w.length > 4 && w.endsWith("s")) ? w.slice(0, -1) : w;
  const tokens = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/)
    .filter(w => w.length >= 3 && !SW.has(w) && !/^\d+$/.test(w)).map(normToken);

  const K = M.k, NT = M.terms.length, ND = M.doc_ids.length;
  const idx = new Map(); M.terms.forEach((t, i) => idx.set(t, i));
  // palabras que el modelo descartó por aparecer en más del 20 % de los productos («persona», «estrategia»)
  const COMMON = new Set(M.frecuentes || []);
  // residuos de la extracción («x000d», «1el»): siguen en el modelo, pero no se muestran como vecinas ni sugerencias
  const HIDE = new Set(M.ocultos || []);

  function decode(b64, scale, rows) {
    const bytes = b64decode(b64);
    if (bytes.length !== rows * K) throw new Error("Tamaño inesperado de matriz: " + bytes.length + " ≠ " + rows * K);
    const out = new Float32Array(rows * K);
    for (let r = 0; r < rows; r++) {
      const s = scale[r] / 127, o = r * K;
      for (let j = 0; j < K; j++) { let v = bytes[o + j]; if (v > 127) v -= 256; out[o + j] = v * s; }
    }
    return out;
  }
  const TV = decode(M.term_vec_int8_b64, M.term_scale, NT);
  const DV = decode(M.doc_vec_int8_b64, M.doc_scale, ND);
  // documentos normalizados
  for (let r = 0; r < ND; r++) {
    let n = 0; const o = r * K;
    for (let j = 0; j < K; j++) n += DV[o + j] * DV[o + j];
    n = Math.sqrt(n) || 1;
    for (let j = 0; j < K; j++) DV[o + j] /= n;
  }
  // términos ponderados por sigma y normalizados (para las nubes de vecinos)
  const TS = new Float32Array(NT * K);
  for (let r = 0; r < NT; r++) {
    let n = 0; const o = r * K;
    for (let j = 0; j < K; j++) { const v = TV[o + j] * M.sigma[j]; TS[o + j] = v; n += v * v; }
    n = Math.sqrt(n) || 1;
    for (let j = 0; j < K; j++) TS[o + j] /= n;
  }

  // distancia de edición acotada
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = new Array(b.length + 1); for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        const c = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur.push(c); if (c < best) best = c;
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  /* Resuelve una palabra escrita por la persona a un término del vocabulario.
     Devuelve {word, token, term, ok, suggested} — suggested=true si hubo «¿quisiste decir…?». */
  function resolve(word) {
    const tk = tokens(word);
    if (!tk.length) return { word, token: null, term: null, ok: false, reason: "vacía" };
    const t = tk[0];
    if (idx.has(t)) return { word, token: t, term: t, ok: true, suggested: false };
    if (COMMON.has(t)) return { word, token: t, term: null, ok: false, reason: "frecuente" };
    // 1) prefijo: términos que empiezan por t, o t empieza por el término (mayor df primero)
    let cands = [];
    if (t.length >= 4) for (let i = 0; i < NT; i++) if (M.terms[i].startsWith(t)) cands.push(i);
    if (cands.length) {
      cands.sort((a, b) => (M.df[b] - M.df[a]) || (M.terms[a].length - M.terms[b].length));
      return { word, token: t, term: M.terms[cands[0]], ok: true, suggested: true };
    }
    // 2) distancia de edición ≤ 2 (menor distancia; empate → mayor df)
    let best = null, bd = 3;
    for (let i = 0; i < NT; i++) {
      const d = lev(t, M.terms[i], 2);
      if (d < bd || (d === bd && best !== null && M.df[i] > M.df[best])) { bd = d; best = i; }
    }
    if (best !== null && bd <= 2) return { word, token: t, term: M.terms[best], ok: true, suggested: true };
    return { word, token: t, term: null, ok: false, reason: "sin coincidencia" };
  }

  function queryVec(terms) {
    const q = new Float32Array(K);
    for (const t of terms) {
      const i = idx.get(t); if (i === undefined) continue;
      const w = M.idf[i], o = i * K;
      for (let j = 0; j < K; j++) q[j] += w * TV[o + j];
    }
    let n = 0; for (let j = 0; j < K; j++) n += q[j] * q[j];
    n = Math.sqrt(n);
    if (!n) return null;
    for (let j = 0; j < K; j++) q[j] /= n;
    return q;
  }
  function cosDocs(q) {
    const out = new Float32Array(ND);
    if (!q) return out;
    for (let r = 0; r < ND; r++) {
      let s = 0; const o = r * K;
      for (let j = 0; j < K; j++) s += q[j] * DV[o + j];
      out[r] = s;
    }
    return out;
  }
  /* Relación de cada producto con la consulta completa y con cada palabra. */
  function query(terms) {
    const all = cosDocs(queryVec(terms));
    const per = terms.map(t => cosDocs(queryVec([t])));
    return { all, per };
  }
  /* Nube de palabras vecinas: coseno entre vectores término·sigma normalizados, df ≥ 2. */
  function neighbors(terms, n = 16) {
    const q = new Float32Array(K);
    for (const t of terms) {
      const i = idx.get(t); if (i === undefined) continue;
      const w = M.idf[i], o = i * K;
      for (let j = 0; j < K; j++) q[j] += w * TV[o + j] * M.sigma[j];
    }
    let nn = 0; for (let j = 0; j < K; j++) nn += q[j] * q[j];
    nn = Math.sqrt(nn); if (!nn) return [];
    for (let j = 0; j < K; j++) q[j] /= nn;
    const res = [];
    for (let r = 0; r < NT; r++) {
      if (M.df[r] < 2 && !terms.includes(M.terms[r])) continue;
      let s = 0; const o = r * K;
      for (let j = 0; j < K; j++) s += q[j] * TS[o + j];
      res.push([r, s]);
    }
    res.sort((a, b) => b[1] - a[1]);
    return res.slice(0, n).map(([r, s]) => ({ term: M.terms[r], sim: s, df: M.df[r] }));
  }
  /* Similitud entre dos palabras (para acercar o alejar sus nubes). */
  function termSim(a, b) {
    const i = idx.get(a), j = idx.get(b);
    if (i === undefined || j === undefined) return 0;
    let s = 0; const oi = i * K, oj = j * K;
    for (let k = 0; k < K; k++) s += TS[oi + k] * TS[oj + k];
    return s;
  }

  // ================================================================ unidades de significado
  // Una unidad es lo que se busca: una palabra, una expresión de varias palabras («habitante de calle») o un producto de referencia.
  // Cada unidad tiene una dirección en el espacio de los productos (dir), su versión para comparar con palabras (ts) y,
  // si aplica, los productos que la mencionan literalmente (docs).
  const GAP = new Set("de del la las el los en y con a para por al e o".split(" "));
  const WORD = /[0-9A-Za-zÀ-ÖØ-öø-ÿ]+/g, BREAK = /[.,;:()\[\]\/¿?¡!"“”«»\n\r\t–—|]/;
  const base = w => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const isContent = b => b.length >= 3 && !SW.has(b) && !/^\d+$/.test(b);
  // raíz para comparar expresiones: une singular y plural («habitante», «habitantes»)
  const stem = b => { const w = normToken(b); return (w.length > 4 && w.endsWith("e")) ? w.slice(0, -1) : w; };
  /* Divide un texto en palabras con su posición: s = raíz (contenido), null (conector) o false (corte). */
  const wcache = new Map();
  function classify(raw) {
    let s = wcache.get(raw);
    if (s === undefined) { const b = base(raw); s = isContent(b) ? stem(b) : (GAP.has(b) ? null : false); wcache.set(raw, s); }
    return s;
  }
  function scan(text) {
    text = text.normalize("NFC");
    const out = []; let last = 0, m; WORD.lastIndex = 0;
    while ((m = WORD.exec(text))) {
      const cut = out.length > 0 && BREAK.test(text.slice(last, m.index));
      last = m.index + m[0].length;
      out.push({ s: classify(m[0]), a: m.index, b: last, cut, w: m[0] });
    }
    return out;
  }
  const stemTerms = new Map();   // raíz → términos del vocabulario que la comparten
  M.terms.forEach((t, i) => { const s = stem(t); if (!stemTerms.has(s)) stemTerms.set(s, []); stemTerms.get(s).push(i); });

  // --- índice de posiciones de los textos de cada producto (nombre, indicador y resultado)
  const sid = new Map(), seqs = new Array(ND), post = [];
  let indexed = false, ixAt = 0;
  const cache = new Map();
  /* Arma el índice. Con budgetMs trabaja por tandas (devuelve false si falta) para no bloquear la página. */
  function buildIndex(fieldsOf, budgetMs) {
    if (indexed) return true;
    const t0 = Date.now();
    const enc = text => {
      let r = cache.get(text); if (r) return r;
      // cada palabra ocupa una posición y puede llevar antes una marca de corte: hasta dos posiciones por palabra
      const sc = scan(text); r = new Int32Array(2 * sc.length); let n = 0;
      for (const w of sc) {
        if (w.cut && n && r[n - 1] !== -2) r[n++] = -2;
        if (w.s) { let id = sid.get(w.s); if (id === undefined) { id = sid.size; sid.set(w.s, id); post.push([]); } r[n++] = id; }
        else r[n++] = w.s === null ? -1 : -2;
      }
      r = r.subarray(0, n); cache.set(text, r); return r;
    };
    for (let d = ixAt; d < ND; d++) {
      if (budgetMs && (d & 63) === 0 && d > ixAt && Date.now() - t0 > budgetMs) { ixAt = d; return false; }
      const parts = fieldsOf(d).map(enc); let len = 0; for (const p of parts) len += p.length + 1;
      const q = new Int32Array(len); let o = 0;
      for (const p of parts) { q.set(p, o); o += p.length; q[o++] = -2; }
      seqs[d] = q;
      for (let j = 0; j < len; j++) { const id = q[j]; if (id >= 0) { const pl = post[id]; if (pl[pl.length - 1] !== d) pl.push(d); } }
    }
    ixAt = ND; indexed = true; cache.clear();
    return true;
  }
  /* Productos que mencionan la secuencia de raíces, contiguas o con hasta dos conectores entre ellas. */
  function findDocs(stems) {
    if (!indexed) return [];
    const ids = stems.map(s => sid.get(s)); if (ids.some(i => i === undefined)) return [];
    if (ids.length === 1) return post[ids[0]];
    let rare = 0; for (let j = 1; j < ids.length; j++) if (post[ids[j]].length < post[ids[rare]].length) rare = j;
    const out = [];
    for (const d of post[ids[rare]]) {
      const q = seqs[d]; let hit = false;
      for (let p = 0; p < q.length && !hit; p++) {
        if (q[p] !== ids[0]) continue;
        let k = 1, j = p + 1, gap = 0;
        while (k < ids.length && j < q.length) {
          const v = q[j];
          if (v === ids[k]) { k++; gap = 0; } else if (v === -1 && gap < 2) gap++; else break;
          j++;
        }
        if (k === ids.length) hit = true;
      }
      if (hit) out.push(d);
    }
    return out;
  }
  function unitVec(v) { let n = 0; for (let j = 0; j < K; j++) n += v[j] * v[j]; n = Math.sqrt(n); if (n) for (let j = 0; j < K; j++) v[j] /= n; return n; }
  function withTs(u) {
    const ts = new Float32Array(K); for (let j = 0; j < K; j++) ts[j] = u.dir[j] * M.sigma[j];
    unitVec(ts); u.ts = ts; return u;
  }
  /* Palabra: reúne los términos del modelo que comparten raíz, porque singular y plural pueden haber quedado como
     términos distintos («adolescente», «adolescent»). Sus menciones literales son las de todas esas formas: la raíz de
     cada término ya normalizado solo pierde la «e» final (volver a aplicar normToken recortaría «interes» a «inter»). */
  const eStrip = t => (t.length > 4 && t.endsWith("e")) ? t.slice(0, -1) : t;
  function wordUnit(term) {
    const i0 = idx.get(term); if (i0 === undefined) return null;
    const group = stemTerms.get(stem(term)) || [i0], dir = new Float32Array(K);
    for (const i of group) { const w = M.idf[i], o = i * K; for (let j = 0; j < K; j++) dir[j] += w * TV[o + j]; }
    const scale = unitVec(dir), stems = [...new Set(group.map(i => eStrip(M.terms[i])))];
    const docs = stems.length === 1 ? findDocs(stems) : [...new Set(stems.flatMap(s => findDocs([s])))].sort((a, b) => a - b);
    return withTs({ kind: "w", key: "w:" + term, label: term, terms: group.map(i => M.terms[i]), stems, dir, scale, docs, df: M.df[i0] });
  }
  /* Expresión: mezcla el centro de los productos que la mencionan con el significado de sus palabras.
     Cuantos más productos la mencionan, más pesa su propio centro (hasta la mitad): así suben también los productos
     que dicen lo mismo con otras palabras («habitabilidad en calle») sin que la búsqueda se vuelva genérica. */
  function phraseUnit(stems, label) {
    const docs = findDocs(stems), wv = new Float32Array(K), terms = [];
    for (const s of stems) for (const i of (stemTerms.get(s) || [])) {
      terms.push(M.terms[i]); const w = M.idf[i], o = i * K;
      for (let j = 0; j < K; j++) wv[j] += w * TV[o + j];
    }
    const scale = unitVec(wv) || 1, c = new Float32Array(K);
    for (const d of docs) { const o = d * K; for (let j = 0; j < K; j++) c[j] += DV[o + j]; }
    const hasC = unitVec(c) > 0, lam = hasC ? .5 * docs.length / (docs.length + 2) : 0, dir = new Float32Array(K);
    for (let j = 0; j < K; j++) dir[j] = lam * c[j] + (1 - lam) * wv[j];
    if (!unitVec(dir)) return null;
    return withTs({ kind: "p", key: "p:" + stems.join(" "), label, terms, stems, dir, scale, docs, df: docs.length });
  }
  let meanScale = 0;
  function docUnit(d, label) {
    if (!meanScale) { let s = 0; for (let i = 0; i < NT; i++) s += M.idf[i] * M.term_scale[i]; meanScale = s / NT || 1; }
    const dir = DV.slice(d * K, d * K + K);
    return withTs({ kind: "d", key: "d:" + d, label, terms: [], stems: [], dir, scale: meanScale * 1.5, docs: [d], df: 1, doc: d });
  }
  /* Relación de cada producto con todas las unidades (all) y con cada una (per). */
  function queryUnits(units) {
    const q = new Float32Array(K);
    for (const u of units) for (let j = 0; j < K; j++) q[j] += u.scale * u.dir[j];
    const ok = unitVec(q) > 0;
    return { all: cosDocs(ok ? q : null), per: units.map(u => cosDocs(u.dir)) };
  }
  const unitSim = (a, b) => { let s = 0; for (let j = 0; j < K; j++) s += a.ts[j] * b.ts[j]; return s; };
  // --- diccionario de expresiones frecuentes: sirve para sugerir y para poblar las nubes de vecinas
  let DICT = [], dictAt = 0;
  const dictSeen = new Set();
  function loadDict(surfaces, budgetMs) {
    const t0 = Date.now();
    for (; dictAt < surfaces.length; dictAt++) {
      if (budgetMs && (dictAt & 15) === 0 && Date.now() - t0 > budgetMs) return false;
      const sf = surfaces[dictAt], stems = scan(sf).filter(w => w.s).map(w => w.s), key = stems.join(" ");
      if (stems.length < 2 || dictSeen.has(key)) continue;
      const u = phraseUnit(stems, sf); if (!u || u.df < 2) continue;
      dictSeen.add(key); DICT.push(u);
    }
    return true;
  }
  /* Vecinas de una unidad: palabras del vocabulario (df ≥ 2) y expresiones del diccionario. */
  function unitNeighbors(u, n, nPhr) {
    const own = new Set(u.terms), res = [];
    for (let r = 0; r < NT; r++) {
      if (M.df[r] < 2 || own.has(M.terms[r]) || HIDE.has(M.terms[r])) continue;
      let s = 0; const o = r * K;
      for (let j = 0; j < K; j++) s += u.ts[j] * TS[o + j];
      res.push([s, M.terms[r], M.df[r], null]);
    }
    res.sort((a, b) => b[0] - a[0]);
    const out = res.slice(0, n).map(([s, t, df]) => ({ term: t, sim: s, df }));
    if (nPhr && DICT.length) {
      const us = new Set(u.stems), ph = [];
      for (const p of DICT) {
        if (p.key === u.key) continue;
        if (u.kind === "p" && (p.stems.every(s => us.has(s)) || u.stems.every(s => p.stems.includes(s)))) continue;
        const s = unitSim(u, p) * .92;
        ph.push([s, p]);
      }
      ph.sort((a, b) => b[0] - a[0]);
      const floor = out.length ? out[Math.min(out.length - 1, 9)].sim : 0, used = new Set();
      for (const [s, p] of ph) {
        if (s < floor) break;
        if (p.stems.some(x => used.has(x))) continue;
        p.stems.forEach(x => used.add(x));
        out.push({ term: p.label, sim: s, df: p.df, phrase: true });
        if (--nPhr <= 0) break;
      }
      out.sort((a, b) => b.sim - a.sim);
    }
    return out;
  }
  /* Afinidad entre grupos de productos (políticas): coseno entre los centros de sus productos. */
  function groupAffinity(groupOf, n) {
    const C = new Float32Array(n * K);
    for (let d = 0; d < ND; d++) { const o = d * K, g = groupOf[d] * K; for (let j = 0; j < K; j++) C[g + j] += DV[o + j]; }
    for (let g = 0; g < n; g++) unitVec(C.subarray(g * K, g * K + K));
    return (a, b) => { let s = 0; const oa = a * K, ob = b * K; for (let j = 0; j < K; j++) s += C[oa + j] * C[ob + j]; return s; };
  }
  /* Sugerencias mientras se escribe: expresiones y palabras que empiezan por lo escrito. */
  function suggest(text, n) {
    const t = base(text).replace(/[^a-z0-9 ]+/g, " ").trim(); if (t.length < 2) return [];
    const ws = scan(text).filter(w => w.s).map(w => w.s), out = [];
    if (ws.length) for (const p of DICT) {
      // las raíces escritas deben aparecer seguidas dentro de la expresión; la última puede estar a medio escribir
      let at = -1;
      for (let o = 0; o + ws.length <= p.stems.length && at < 0; o++) {
        let ok = true;
        for (let k = 0; k < ws.length && ok; k++) ok = k === ws.length - 1 ? p.stems[o + k].startsWith(ws[k]) : p.stems[o + k] === ws[k];
        if (ok) at = o;
      }
      if (at >= 0) out.push({ kind: "p", label: p.label, df: p.df, r: (at === 0 ? 0 : 1) - Math.min(p.df, 400) / 1000 });
    }
    if (!t.includes(" ")) for (let i = 0; i < NT; i++) if (M.terms[i].startsWith(t) && M.df[i] >= 2 && !HIDE.has(M.terms[i])) out.push({ kind: "w", label: M.terms[i], df: M.df[i], r: .5 - Math.min(M.df[i], 400) / 1000 + (M.terms[i] === t ? -1 : 0) });
    out.sort((a, b) => a.r - b.r || a.label.length - b.label.length);
    return out.slice(0, n);
  }
  /* Tramos [inicio, fin) de un texto que mencionan literalmente alguna unidad. */
  function marks(text, units) {
    const sc = scan(text), out = [];
    for (const u of units) {
      if (u.kind === "d" || !u.stems.length) continue;
      if (u.kind === "w") { for (const w of sc) if (u.stems.includes(w.s)) out.push([w.a, w.b]); continue; }
      for (let p = 0; p < sc.length; p++) {
        if (sc[p].s !== u.stems[0]) continue;
        let k = 1, j = p + 1, gap = 0;
        while (k < u.stems.length && j < sc.length) {
          const w = sc[j]; if (w.cut) break;
          if (w.s === u.stems[k]) { k++; gap = 0; } else if (w.s === null && gap < 2) gap++; else break;
          j++;
        }
        if (k === u.stems.length) out.push([sc[p].a, sc[j - 1].b]);
      }
    }
    out.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of out) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r); }
    return merged;
  }
  /* Lee lo escrito y lo separa en unidades: reconoce primero la expresión más larga que aparezca literalmente en algún producto. */
  function parse(text) {
    const sc = scan(text), out = []; let i = 0;
    while (i < sc.length) {
      const w = sc[i];
      if (!w.s) { out.push({ kind: "stop", word: w.w }); i++; continue; }
      let best = null;
      const ends = []; let j = i + 1, gap = 0, n = 1;
      while (j < sc.length && n < 4) {
        const v = sc[j]; if (v.cut) break;
        if (v.s) { n++; gap = 0; ends.push(j); } else if (v.s === null && gap < 2) gap++; else break;
        j++;
      }
      for (let e = ends.length - 1; e >= 0 && !best; e--) {
        const stems = sc.slice(i, ends[e] + 1).filter(x => x.s).map(x => x.s);
        if (findDocs(stems).length) best = { end: ends[e], stems };
      }
      if (best) { out.push({ kind: "p", stems: best.stems, label: text.slice(w.a, sc[best.end].b).toLowerCase().replace(/\s+/g, " ") }); i = best.end + 1; }
      else { out.push({ kind: "w", word: w.w }); i++; }
    }
    return out;
  }
  return { tokens, resolve, query, neighbors, termSim, ND, NT, has: t => idx.has(t), docIds: M.doc_ids,
    buildIndex, findDocs, wordUnit, phraseUnit, docUnit, queryUnits, unitSim, unitNeighbors, loadDict, suggest, marks, parse, scan, stem, groupAffinity,
    get dict() { return DICT; } };
}
if (typeof module !== "undefined") module.exports = { createEngine };
