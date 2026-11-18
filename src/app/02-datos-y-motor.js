  // ================================================================ datos y motor
  const D = JSON.parse($('#data').textContent);
  const b64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const E = createEngine(D.model, b64);
  const STRONG = 0.30, MEDIUM = 0.18;
  // bandas palabra → política: la intensidad de la articulación es la suma de la relación (desde 0,18) de los
  // productos de la política con la palabra; cinco niveles fijos, iguales en cualquier búsqueda.
  // Rampa de un solo tono (rojo del rosa del sistema), clara → oscura, validada como rampa ordinal sobre el plano.
  const BAND_T = [0.3, 0.8, 2, 5];
  const BAND_C = ['#d58980', '#ce5950', '#b72d29', '#8d1b19', '#601311'];
  const BAND_W = [1.4, 2.8, 4.8, 7.4, 10.6], BAND_WS = [1.1, 2.2, 3.7, 5.6, 8];
  const BAND_N = ['Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'];
  const BAND_R = ['menos de 0,3', '0,3 a 0,8', '0,8 a 2', '2 a 5', '5 o más'];
  const bandOf = v => BAND_T.reduce((k, t) => k + (v >= t ? 1 : 0), 0);
  const FAMS = D.fams, POLS = D.pols, SECTORS = D.sectors, SEC2FAM = D.sec2fam;
  // el vocabulario del modelo va sin tildes y con singular y plural unidos («genero», «diferent»); al público se le
  // muestra la forma más común en los textos («género», «diferentes»), que el motor vuelve a leer como el mismo término
  const FORMAS = D.formas, surf = t => FORMAS[t] || t;
  const NP = D.pp.pol.length;
  const items = new Array(NP);
  for (let i = 0; i < NP; i++) {
    const p = D.pp, pol = POLS[p.pol[i]];
    items[i] = { i, kind: 'pp', id: D.model.doc_ids[i], pol: p.pol[i], sector: pol.s, fam: SEC2FAM[pol.s], cod: p.cod[i], name: p.pr[i], ind: p.ind[i], ent: D.strs[p.ent[i]], entI: p.ent[i], dep: D.strs[p.dep[i]], meta: p.meta[i], enf: p.enf[i], res: D.strs[p.res[i]], obj: D.strs[p.obj[i]] };
  }

  const DOCI = new Map(D.model.doc_ids.map((id, i) => [id, i]));
  const ENFS = D.enfs;
  // El índice de textos (para reconocer expresiones y menciones literales) y el diccionario de unidades
  // se arman una sola vez: al abrir, por tandas cortas después de pintar la página (warmIndex), o de inmediato si hacen falta.
  let indexReady = false;
  function ensureIndex() {
    if (indexReady) return;
    E.buildIndex(docFields);
    E.loadDict(D.dict);
    indexDone();
    // la búsqueda activa se calculó sin el índice: se recalcula al terminar lo que esté en curso
    if (S.words.length) setTimeout(() => { compute(); renderAll(!!SK.geo); }, 0);
  }
  const docFields = d => [D.pp.pr[d], D.pp.ind[d], D.strs[D.pp.res[d]]];
  function indexDone() {
    indexReady = true;
    for (const w of S.words) w.unit = w.doc != null ? w.unit : (w.phrase ? E.phraseUnit(w.unit.stems, w.term) : E.wordUnit(w.term));
  }
  function warmIndex(then) {
    if (indexReady) return;
    if (E.buildIndex(docFields, 10) && E.loadDict(D.dict, 10)) { indexDone(); then(); }
    else setTimeout(() => warmIndex(then), 0);
  }
  let affinity = null;
  const polAffinity = (a, b) => (affinity || (affinity = E.groupAffinity(D.pp.pol, POLS.length)))(a, b);

