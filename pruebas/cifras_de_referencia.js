// Recalcula las cifras de referencia que citan el visor («Fuente y método») y docs/metodologia.md,
// y falla si alguno de los dos textos no las trae. Se corre después de cambiar el modelo o los datos.
// Uso: node pruebas/cifras_de_referencia.js [dist/index.html]
'use strict';
const fs = require('fs');
const path = require('path');
const { createEngine } = require('../src/motor.js');

const RAIZ = path.join(__dirname, '..');
const archivo = process.argv[2] || path.join(RAIZ, 'dist', 'index.html');
const html = fs.readFileSync(archivo, 'utf8');
const D = JSON.parse(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);
const E = createEngine(D.model, s => Buffer.from(s, 'base64'));
const ND = E.ND, K = D.model.k, pol = D.pp.pol;
const coma = (v, d = 2) => v.toFixed(d).replace('.', ',');
const mediana = a => { const s = Float64Array.from(a).sort(); const n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// vectores de los productos (normalizados), los mismos que usa el motor
const V = new Float32Array(ND * K);
for (let d = 0; d < ND; d++) V.set(E.docUnit(d, '').dir, d * K);

// 1 · todos los pares de productos de políticas distintas, y el más parecido de otra política para cada producto
const pares = []; const masParecido = new Float64Array(ND).fill(-1);
for (let a = 0; a < ND; a++) {
  const oa = a * K;
  for (let b = a + 1; b < ND; b++) {
    if (pol[a] === pol[b]) continue;
    let s = 0; const ob = b * K;
    for (let j = 0; j < K; j++) s += V[oa + j] * V[ob + j];
    pares.push(s);
    if (s > masParecido[a]) masParecido[a] = s;
    if (s > masParecido[b]) masParecido[b] = s;
  }
}
const azar = mediana(pares);
const desde018 = pares.filter(s => s >= 0.18).length / pares.length;
const vecino = mediana(masParecido);

// 2 · calibración de las bandas: búsquedas de una palabra que aparece en 5 o más productos
const T = [0.3, 0.8, 2, 5], nivel = v => T.reduce((k, t) => k + (v >= t ? 1 : 0), 0);
let busquedas = 0, conCinco = 0;
for (let t = 0; t < D.model.terms.length; t++) {
  if (D.model.df[t] < 5) continue;
  const q = E.queryUnits([E.wordUnit(D.model.terms[t])]).all;
  const orden = [...q.keys()].sort((x, y) => q[y] - q[x]), top10 = new Set(orden.slice(0, 10));
  const suma = new Map(), max = new Map();
  for (const i of orden) {
    if (q[i] < 0.18 && !top10.has(i)) continue;
    max.set(pol[i], Math.max(max.get(pol[i]) || 0, q[i]));
    if (q[i] >= 0.18) suma.set(pol[i], (suma.get(pol[i]) || 0) + q[i]);
  }
  const niveles = new Set();
  for (const [p, m] of max) if (m >= 0.18) niveles.add(nivel(suma.get(p)));
  busquedas++; if (niveles.size === 5) conCinco++;
}

// 3 · afinidad entre políticas (coseno entre los centros de sus productos), en todos los pares de políticas
const NPOL = D.pols.length, afin = E.groupAffinity(pol, NPOL), paresPol = [];
for (let a = 0; a < NPOL; a++) for (let b = a + 1; b < NPOL; b++) paresPol.push(afin(a, b));

const cifras = [
  ['similitud mediana entre dos productos de políticas distintas', coma(azar)],
  ['pares de políticas distintas con relación de 0,18 o más', `${Math.round(desde018 * 100)} %`],
  ['similitud mediana con el producto más parecido de otra política', coma(vecino)],
  ['búsquedas de una palabra (df ≥ 5) que muestran los cinco niveles de banda', `${Math.round(conCinco / busquedas * 100)} %`],
  ['afinidad mediana entre dos políticas', coma(mediana(paresPol))],
];
const textos = {
  visor: fs.readFileSync(path.join(RAIZ, 'src', 'app', '15-fuente-y-metodo.js'), 'utf8').replace(/ /g, ' '),
  metodologia: fs.readFileSync(path.join(RAIZ, 'docs', 'metodologia.md'), 'utf8').replace(/ /g, ' '),
};
// la cifra debe aparecer completa: «6 %» no cuenta dentro de «16 %» ni «0,03» dentro de «10,03»
const cita = (txt, valor) => new RegExp('(^|[^0-9,])' + valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![0-9])').test(txt);
let fallas = 0;
console.table(cifras.map(([cifra, valor], k) => {
  const fila = { cifra, valor };
  for (const [nombre, txt] of Object.entries(textos)) {
    // la cifra de calibración solo se cita en la metodología
    if (k === 3 && nombre === 'visor') { fila[nombre] = '—'; continue; }
    const ok = cita(txt, valor); if (!ok) fallas++;
    fila[nombre] = ok ? 'la cita' : 'NO LA CITA';
  }
  return fila;
}));
console.log(`${pares.length.toLocaleString('es-CO')} pares · ${busquedas.toLocaleString('es-CO')} búsquedas`);
console.log(fallas ? `${fallas} cifras sin actualizar en los textos` : 'cifras de referencia: los textos están al día');
process.exit(fallas ? 1 : 0);
