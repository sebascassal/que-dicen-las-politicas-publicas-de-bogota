  // ================================================================ la búsqueda vive en la dirección: #q-palabra-palabra
  // Solo se permiten letras ASCII, cifras y guiones: las vocales con tilde y la ñ se escriben en mayúscula (logIstica, niNez).
  const ENC = { 'á': 'A', 'é': 'E', 'í': 'I', 'ó': 'O', 'ú': 'U', 'ü': 'W', 'ñ': 'N' }, DEC = {};
  for (const k in ENC) DEC[ENC[k]] = k;
  const encWord = w => w.normalize('NFC').toLowerCase().replace(/[áéíóúüñ]/g, c => ENC[c]).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '');
  const decWord = s => s.replace(/[AEIOUWN]/g, c => DEC[c]);
  // Una expresión une sus palabras con Z (#q-habitanteZdeZcalle); un producto de referencia va con su identificador (#q-P0123).
  const encUnit = w => w.doc != null ? D.model.doc_ids[w.doc] : w.phrase ? (w.word.match(/[0-9A-Za-zÀ-ÖØ-öø-ÿ]+/g) || []).map(encWord).filter(Boolean).join('Z') : encWord(w.suggested ? w.label : w.word);
  const hashFor = () => S.words.length ? '#q-' + S.words.map(encUnit).filter(Boolean).join('-') : '';
  function readHash() {
    const m = /^#q-([A-Za-z0-9-]+)$/.exec(location.hash || '');
    return m ? m[1].split('-').filter(Boolean).slice(0, 3) : null;
  }
  // reconstruye la búsqueda a partir de las partes de la dirección
  function applyParts(parts) {
    S.words = []; const msgs = [];
    for (const p of parts.slice(0, 3)) {
      if (/^P\d+$/.test(p)) { if (DOCI.has(p)) pushDoc(DOCI.get(p)); }
      else if (p.includes('Z')) msgs.push(...addWords(p.split('Z').map(decWord).join(' ')));
      else pushWord(decWord(p), msgs);
    }
    return msgs;
  }
  function writeHash() {
    const want = hashFor();
    if ((location.hash || '') === want) return;
    try { history.replaceState(null, '', want || (location.pathname + location.search)); } catch (e) { /* marcos sin historial */ }
  }

