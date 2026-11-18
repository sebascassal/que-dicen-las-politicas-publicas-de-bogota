  // ================================================================ validación: las consultas de control corren en este navegador
  let TESTS = null;
  function runTests() {
    const out = [];
    for (const [q, exp] of Object.entries(D.tests)) {
      const terms = E.tokens(q).map(t => E.resolve(t).term).filter(Boolean);
      const { all } = E.query(terms);
      let best = -1, bv = -Infinity;
      for (let i = 0; i < all.length; i++) if (all[i] > bv) { bv = all[i]; best = i; }
      const g6 = E.neighbors(terms, 8).map(n => n.term).slice(0, 6), e6 = exp.vec.slice(0, 6);
      const inter = e6.filter(t => g6.includes(t)).length;
      out.push({ q, expId: exp.top[0], expName: exp.top[1], expSim: exp.top[2], gotId: D.model.doc_ids[best], gotSim: bv, inter, n6: e6.length, pass: D.model.doc_ids[best] === exp.top[0] && inter >= 4 });
    }
    return out;
  }
  function ensureTests() {
    if (TESTS) return TESTS;
    TESTS = runTests();
    return TESTS;
  }

