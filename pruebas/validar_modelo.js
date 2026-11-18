// Valida el modelo semántico con las consultas de control, usando los datos incrustados en el visor construido.
// Uso: node pruebas/validar_modelo.js [dist/index.html]
// Una consulta pasa si el producto más relacionado es el esperado y al menos 4 de las 6 primeras vecinas esperadas
// aparecen entre las 6 primeras vecinas obtenidas. Es el mismo criterio que corre el visor en «Fuente y método».
'use strict';
const fs = require('fs');
const path = require('path');
const { createEngine } = require('../src/motor.js');

const archivo = process.argv[2] || path.join(__dirname, '..', 'dist', 'index.html');
const html = fs.readFileSync(archivo, 'utf8');
const D = JSON.parse(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);
const E = createEngine(D.model, s => Buffer.from(s, 'base64'));

let pasan = 0;
const filas = Object.entries(D.tests).map(([q, esp]) => {
  const terms = E.tokens(q).map(t => E.resolve(t).term).filter(Boolean);
  const { all } = E.query(terms);
  let mejor = -1, v = -Infinity;
  for (let i = 0; i < all.length; i++) if (all[i] > v) { v = all[i]; mejor = i; }
  const obtenidas = E.neighbors(terms, 8).map(n => n.term).slice(0, 6);
  const esperadas = esp.vec.slice(0, 6);
  const comunes = esperadas.filter(t => obtenidas.includes(t)).length;
  const ok = D.model.doc_ids[mejor] === esp.top[0] && comunes >= 4;
  if (ok) pasan++;
  return { consulta: q, esperado: `${esp.top[0]} (${esp.top[2].toFixed(2)})`, obtenido: `${D.model.doc_ids[mejor]} (${v.toFixed(2)})`, vecinas: `${comunes}/${esperadas.length}`, resultado: ok ? 'pasa' : 'FALLA' };
});
console.table(filas);
const total = filas.length;
console.log(`${pasan}/${total} pruebas pasan`);
process.exit(pasan === total ? 0 : 1);
