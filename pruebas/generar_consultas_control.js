// Propone las consultas de control para un modelo nuevo: para cada consulta, el producto más relacionado y las
// 8 palabras vecinas que da el modelo. Escribe la propuesta y no toca datos/pruebas/ por su cuenta: una persona debe
// revisar que los resultados tengan sentido antes de adoptarlos.
// Uso: node pruebas/generar_consultas_control.js [salida.json] [consulta …]
//   Sin consultas, usa las de datos/pruebas/consultas_control.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { createEngine } = require('../src/motor.js');

const RAIZ = path.join(__dirname, '..');
const salida = process.argv[2] || path.join(require('os').tmpdir(), 'consultas_control_propuestas.json');
const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'modelo', 'modelo_semantico.json'), 'utf8'));
const E = createEngine(modelo, s => Buffer.from(s, 'base64'));

// nombres de los productos, del CSV de la fuente (lector mínimo de CSV con comillas)
function leerCsv(texto) {
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}
const [encabezado, ...filas] = leerCsv(fs.readFileSync(path.join(RAIZ, 'datos', 'fuente', 'productos_vigentes.csv'), 'utf8').replace(/^﻿/, ''));
const col = n => encabezado.indexOf(n);
const nombre = new Map(filas.map(f => [f[col('id')], f[col('producto')]]));

const actuales = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'pruebas', 'consultas_control.json'), 'utf8'));
const consultas = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(actuales);
const propuesta = {};
for (const q of consultas) {
  const terms = E.tokens(q).map(t => E.resolve(t).term).filter(Boolean);
  if (!terms.length) { console.error(`«${q}»: ninguna palabra está en el vocabulario; se omite`); continue; }
  const { all } = E.query(terms);
  let mejor = 0; for (let i = 1; i < all.length; i++) if (all[i] > all[mejor]) mejor = i;
  const id = E.docIds[mejor];
  propuesta[q] = {
    producto_esperado: { id, nombre: nombre.get(id) || '', similitud: Math.round(all[mejor] * 1000) / 1000 },
    vecinas_esperadas: E.neighbors(terms, 8).map(n => n.term),
  };
  const antes = actuales[q] && actuales[q].producto_esperado.id;
  console.log(`«${q}» → ${id} (${all[mejor].toFixed(2)})${antes && antes !== id ? `  [antes: ${antes}]` : ''}  ${nombre.get(id) || ''}`.slice(0, 160));
}
fs.writeFileSync(salida, JSON.stringify(propuesta, null, 2) + '\n');
console.log(`Propuesta escrita en ${salida}. Revísala y, si tiene sentido, cópiala a datos/pruebas/consultas_control.json.`);
