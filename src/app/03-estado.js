  // ================================================================ estado
  const S = { words: [], filt: { sector: '', pol: '', ent: '', enf: '', rel: '', lit: '', con: '' }, sort: 'rel', iso: null, sel: null, shown: 30, focus: null };
  let R = null;
  function compute() {
    const terms = S.words.map(w => w.term), units = S.words.map(w => w.unit);
    if (!terms.length) { R = null; return; }
    const q = E.queryUnits(units);
    // menciones literales: un bit por unidad buscada
    const lit = new Uint8Array(NP); let phraseBits = 0, allBits = 0, ref = -1;
    units.forEach((u, j) => {
      if (u.kind === 'd') { ref = u.doc; return; }
      for (const d of u.docs) lit[d] |= 1 << j;
      allBits |= 1 << j;
      if (u.kind === 'p') phraseBits |= 1 << j;
    });
    // siempre entra lo que menciona literalmente una expresión buscada, o todas las palabras buscadas a la vez
    // (con una sola palabra, todo lo que la menciona, como Ctrl+F; con varias, no se suma la unión de cada una)
    const forced = i => (lit[i] & phraseBits) !== 0 || (allBits !== 0 && (lit[i] & allBits) === allBits);
    const cand = [];
    for (let i = 0; i < items.length; i++) cand.push(i);
    cand.sort((a, b) => q.all[b] - q.all[a]);
    const top10 = new Set(cand.slice(0, 10));
    const related = cand.filter(i => q.all[i] >= MEDIUM || top10.has(i) || forced(i));
    const clouds = units.map(u => E.unitNeighbors(u, 16, indexReady ? 4 : 0));
    let nLit = 0; for (const i of related) if (lit[i]) nLit++;
    // labels: cómo se nombra cada palabra buscada al público (lo escrito, o la forma corregida)
    R = { terms, labels: S.words.map(w => w.label || w.term), units, all: q.all, per: q.per, related, top10, clouds, lit, nLit, ref, hasPhrase: phraseBits !== 0 || units.filter(u => u.kind !== 'd').length === 1 };
  }
  const FILTER_KEYS = ['sector', 'pol', 'ent', 'enf', 'rel', 'lit', 'con'];
  const anyFilter = () => FILTER_KEYS.some(k => S.filt[k] !== '');
  function passes(i) {
    const it = items[i], f = S.filt;
    if (f.sector !== '' && it.sector !== +f.sector) return false;
    if (f.pol !== '' && it.pol !== +f.pol) return false;
    if (f.ent !== '' && it.entI !== +f.ent) return false;
    if (f.enf !== '' && !(it.enf >> +f.enf & 1)) return false;
    if (f.rel !== '' && R && R.all[i] < STRONG) return false;
    if (f.lit !== '' && R && !R.lit[i]) return false;
    if (f.con !== '' && R && !interItem(i)) return false;
    return true;
  }
  function currentList() {
    if (!R) return [];
    const list = R.related.filter(i => passes(i));
    if (S.sort === 'pol') list.sort((a, b) => POLS[items[a].pol].sn.localeCompare(POLS[items[b].pol].sn, 'es') || R.all[b] - R.all[a]);
    else if (S.sort === 'ent') list.sort((a, b) => items[a].ent.localeCompare(items[b].ent, 'es') || R.all[b] - R.all[a]);
    return list;
  }
  const relLabel = (v, i) => i === R.ref ? 'producto de referencia' : v >= STRONG ? 'relación fuerte' : v >= MEDIUM ? 'relación media' : (R.top10.has(i) ? 'entre los 10 primeros' : 'mención literal');
  // resalta en un texto las menciones literales de lo que se busca
  function hl(text) {
    const m = R ? E.marks(text, R.units) : [];
    if (!m.length) return [text];
    const out = []; let at = 0;
    for (const [a, b] of m) { if (a > at) out.push(text.slice(at, a)); out.push(h('mark', { text: text.slice(a, b) })); at = b; }
    if (at < text.length) out.push(text.slice(at));
    return out;
  }
  const interItem = i => R.terms.length >= 2 && R.per.reduce((c, p) => c + (p[i] >= MEDIUM ? 1 : 0), 0) >= 2;
  const starDim = (it, i) => !passes(i) || (S.iso !== null && it.fam !== S.iso);

