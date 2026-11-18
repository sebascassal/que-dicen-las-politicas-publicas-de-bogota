// Uso: node pruebas/probar_unidades.js dist/index.html [-v]
// Comprueba el reconocimiento de unidades de significado con los datos del visor ya construido.
const fs = require('fs'); const { createEngine } = require('../src/motor.js');
const html = fs.readFileSync(process.argv[2], 'utf8');
const D = JSON.parse(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);
const t0 = performance.now();
const E = createEngine(D.model, s => Buffer.from(s, 'base64'));
const t1 = performance.now();
E.buildIndex(d => [D.pp.pr[d], D.pp.ind[d], D.strs[D.pp.res[d]]]);
const t2 = performance.now();
E.loadDict(D.dict);
const t3 = performance.now();
console.log(`motor ${(t1 - t0).toFixed(0)} ms · índice ${(t2 - t1).toFixed(0)} ms · diccionario ${(t3 - t2).toFixed(0)} ms (${E.dict.length} unidades)`);
let fails = 0; const check = (name, ok, info) => { if (!ok) fails++; console.log(ok ? 'PASA ' : 'FALLA', name, info || ''); };
const VERB = process.argv.includes('-v');
// el índice de textos debe cubrir todas las palabras de cada producto, también al final de textos largos con puntuación
let perdidas = 0; const ejemplo = [];
for (let d = 0; d < E.ND; d++) {
  const raices = new Set([D.pp.pr[d], D.pp.ind[d], D.strs[D.pp.res[d]]].flatMap(t => E.scan(t).filter(w => w.s).map(w => w.s)));
  for (const s of raices) if (!E.findDocs([s]).includes(d)) { perdidas++; if (ejemplo.length < 3) ejemplo.push(D.model.doc_ids[d] + ':' + s); }
}
check('el índice de textos incluye todas las palabras de cada producto', perdidas === 0, perdidas ? perdidas + ' sin indexar, p. ej. ' + ejemplo.join(', ') : '');
check('el motor reconoce todas las unidades del diccionario construido', E.dict.length === D.dict.length, `${E.dict.length} de ${D.dict.length}`);
// las formas escritas que ve el público («género», «diferentes») vuelven al mismo término del modelo sin corrección
const formas = Object.entries(D.formas), malas = formas.filter(([t, f]) => { const r = E.resolve(f); return r.term !== t || r.suggested; });
// singular y plural dan la misma búsqueda aunque el modelo los haya dejado como términos distintos
const pares = [['adolescente', 'adolescent'], ['ambiente', 'ambient'], ['docente', 'docent'], ['interes', 'inter']];
const mismos = pares.filter(([a, b]) => D.model.terms.includes(a) && D.model.terms.includes(b)).map(([a, b]) => {
  const qa = E.queryUnits([E.wordUnit(a)]).all, qb = E.queryUnits([E.wordUnit(b)]).all;
  let d = 0; for (let i = 0; i < qa.length; i++) d = Math.max(d, Math.abs(qa[i] - qb[i]));
  return [a, b, d, E.wordUnit(a).docs.length === E.wordUnit(b).docs.length];
});
check('singular y plural dan la misma lista', mismos.length >= 3 && mismos.every(([, , d, igual]) => d < 1e-6 && igual), mismos.map(m => m[0] + '/' + m[1]).join(', '));
// los residuos de la extracción no salen como vecinas
const vecRes = ['abuso', 'explotacion', 'prevencion'].filter(t => D.model.terms.includes(t)).flatMap(t => E.unitNeighbors(E.wordUnit(t), 16, 0).map(n => n.term));
check('sin residuos de Excel entre las vecinas', vecRes.length > 0 && !vecRes.some(t => D.model.ocultos.includes(t)), D.model.ocultos.join(', '));
// los textos del visor están limpios: sin escapes de Excel, caracteres invisibles ni tildes descompuestas
const sucios = [...D.pp.pr, ...D.pp.ind, ...D.strs].filter(t => /_x000[dDaA]_|[\u200b\ufeff\u0131]/.test(t) || t !== t.normalize('NFC'));
check('textos limpios y en forma NFC', sucios.length === 0, sucios.length ? sucios[0].slice(0, 60) : '');
// los correos de personas que traen algunos planes junto a la dependencia no se muestran (siguen en el CSV de la fuente)
const conCorreo = [...D.pp.pr, ...D.pp.ind, ...D.strs].filter(t => /[\w.+-]+@[\w-]+\.[\w-]+/.test(t));
check('sin correos de personas en los textos que muestra el visor', conCorreo.length === 0, conCorreo.length ? conCorreo[0].slice(0, 60) : '');
const rp = E.resolve('personas');
check('las palabras demasiado frecuentes se avisan, no se corrigen', !rp.ok && rp.reason === 'frecuente' && D.model.frecuentes.length > 0, JSON.stringify(rp) + ' · ' + D.model.frecuentes.join(', '));
check('cada forma escrita vuelve a su término', formas.length > 1000 && malas.length === 0, malas.length ? malas.slice(0, 3).map(([t, f]) => f + '→' + E.resolve(f).term + '≠' + t).join(', ') : formas.length + ' formas');
function unit(text) { const p = E.parse(text); return p; }
const cases = [['habitante de calle', 1], ['habitantes de calle', 1], ['datos abiertos', 1], ['primera infancia', 1], ['personas con discapacidad', 1], ['cambio climático', 1], ['mujeres rurales', 2], ['carga logística', 2], ['vivienda', 1], ['salud mental jóvenes', 2]];
for (const [q, n] of cases) {
  const p = E.parse(q);
  check(`«${q}» → ${n} unidad(es)`, p.length === n, JSON.stringify(p.map(x => x.kind + ':' + (x.label || x.word))));
}
const a = E.parse('habitante de calle')[0], b = E.parse('habitantes de calle')[0];
check('singular y plural son la misma unidad', a.kind === 'p' && b.kind === 'p' && a.stems.join() === b.stems.join());
const u = E.phraseUnit(a.stems, a.label);
check('la unidad tiene menciones literales', u.docs.length >= 5, u.docs.length + ' productos');
const r = E.queryUnits([u]); const order = [...r.all.keys()].sort((x, y) => r.all[y] - r.all[x]);
const top10 = order.slice(0, 10), lit = new Set(u.docs);
check('al menos 5 de los 10 primeros la mencionan', top10.filter(d => lit.has(d)).length >= 5, top10.filter(d => lit.has(d)).length + '/10');
check('todas las menciones literales tienen relación fuerte', u.docs.every(d => r.all[d] >= 0.30), 'mín. ' + Math.min(...u.docs.map(d => r.all[d])).toFixed(2));
const mk = E.marks('Personas habitantes de calle atendidas; ciudadanos habitantes de la calle', [u]);
check('resalta la expresión en el texto', mk.length === 2, JSON.stringify(mk));
const w = E.wordUnit('vivienda'), rw = E.queryUnits([w]), ro = E.query(['vivienda']);
let md = 0; for (let i = 0; i < E.ND; i++) md = Math.max(md, Math.abs(rw.all[i] - ro.all[i]));
check('una palabra da lo mismo que el motor original', md < 1e-5, 'dif. máx. ' + md.toExponential(1));
const w2 = [E.wordUnit('mujer'), E.wordUnit('rural')], r2 = E.queryUnits(w2), o2 = E.query(['mujer', 'rural']);
md = 0; for (let i = 0; i < E.ND; i++) md = Math.max(md, Math.abs(r2.all[i] - o2.all[i]), Math.abs(r2.per[1][i] - o2.per[1][i]));
check('dos palabras dan lo mismo que el motor original', md < 1e-5, 'dif. máx. ' + md.toExponential(1));
check('vecinas de palabra = motor original', JSON.stringify(E.unitNeighbors(w, 6, 0).map(n => n.term)) === JSON.stringify(E.neighbors(['vivienda'], 7).filter(n => n.term !== 'vivienda').slice(0, 6).map(n => n.term)));
check('similitud entre unidades = motor original', Math.abs(E.unitSim(w2[0], w2[1]) - E.termSim('mujer', 'rural')) < 1e-5);
check('sugerencias al escribir', E.suggest('habit', 8).length > 0 && E.suggest('primera in', 5).some(s => s.label === 'primera infancia'), JSON.stringify(E.suggest('habit', 6).map(s => s.label)));
if (VERB) {
  for (const q of ['habitante de calle', 'primera infancia', 'datos abiertos', 'cambio climático', 'vivienda', 'empleo']) {
    const p = E.parse(q)[0], un = p.kind === 'p' ? E.phraseUnit(p.stems, p.label) : E.wordUnit(E.resolve(p.word).term);
    console.log('\n«' + q + '»', un.df, 'menciones · vecinas:', E.unitNeighbors(un, 18, 4).slice(0, 16).map(n => (n.phrase ? '◆' : '') + n.term + ' ' + n.sim.toFixed(2)).join(', '));
    const rr = E.queryUnits([un]); const oo = [...rr.all.keys()].sort((x, y) => rr.all[y] - rr.all[x]).slice(0, 5);
    oo.forEach(d => console.log('   ', rr.all[d].toFixed(2), un.docs.includes(d) ? 'LIT' : '   ', D.pp.pr[d].slice(0, 110)));
    console.log('   relacionados ≥0,18:', rr.all.filter(v => v >= .18).length, '· literales con <0,18:', un.docs.filter(d => rr.all[d] < .18).length);
  }
  console.log(D.dict.slice(0, 80).join(' | '));
  console.log(D.pols.slice(0, 12).map(p => p.sn + ': ' + p.kw.join(', ')).join('\n'));
}
console.log(fails ? fails + ' fallas' : 'unidades de significado: todas las comprobaciones pasan');
process.exit(fails ? 1 : 0);
