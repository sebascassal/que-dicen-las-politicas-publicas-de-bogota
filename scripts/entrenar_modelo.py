"""Entrena el modelo semántico (TF-IDF + análisis semántico latente) a partir de los productos vigentes.

Sirve para actualizar el visor cuando cambian los planes de acción, y para auditar el modelo publicado:
el procedimiento es el mismo con el que se construyó `datos/modelo/modelo_semantico.json`.

Uso:
    pip install -r scripts/requirements.txt
    python3 scripts/entrenar_modelo.py --salida /tmp/modelo_nuevo.json
    python3 scripts/entrenar_modelo.py --salida /tmp/modelo_nuevo.json --comparar datos/modelo/modelo_semantico.json

Procedimiento:
1. Texto de cada producto: nombre (dos veces, para darle doble peso), indicador y resultado.
2. Las mismas reglas de palabras que usa el motor del navegador (src/motor.js): minúsculas, sin tildes,
   sin palabras vacías, palabras de 3 o más letras y singular y plural unidos con una regla simple.
   Se descartan las palabras que aparecen en más del 20 % de los productos.
3. TF-IDF con frecuencia sublineal (1 + ln tf), idf suavizado, ln((1 + N) / (1 + df)) + 1, y cada producto
   normalizado a longitud 1.
4. Descomposición en valores singulares truncada a 128 dimensiones (exacta, con ARPACK).
   Vectores de palabras = filas de V; vectores de productos = X·V; sigma = valores singulares.
5. Cada fila se guarda en enteros de 8 bits con su propia escala (valor = entero / 127 × escala).
"""
import argparse
import base64
import csv
import json
import os
import sys

import numpy as np
from scipy import sparse
from scipy.sparse.linalg import svds

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from construir import FRECUENCIA_MAXIMA, palabras_del_producto  # noqa: E402  (las mismas reglas que el visor)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = 128


def r6(v):
    return float(f'{v:.6g}')


def int8_b64(m):
    escala = np.abs(m).max(axis=1)
    escala[escala == 0] = 1
    q = np.clip(np.rint(m / escala[:, None] * 127), -127, 127).astype(np.int8)
    return base64.b64encode(q.tobytes()).decode(), [r6(v) for v in escala]


def entrenar(productos, version, k=K, semilla=0):
    docs = [palabras_del_producto(r) for r in productos]
    n = len(docs)
    presencia = {}
    for d in docs:
        for w in set(d):
            presencia[w] = presencia.get(w, 0) + 1
    # fuera las palabras que aparecen en más del 20 % de los productos: no distinguen temas
    vocab = sorted(w for w, c in presencia.items() if c <= FRECUENCIA_MAXIMA * n)
    idx = {w: i for i, w in enumerate(vocab)}
    filas, cols, vals = [], [], []
    for j, d in enumerate(docs):
        cuenta = {}
        for w in d:
            if w in idx:
                cuenta[idx[w]] = cuenta.get(idx[w], 0) + 1
        for i, c in cuenta.items():
            filas.append(j); cols.append(i); vals.append(1 + np.log(c))   # frecuencia sublineal
    tf = sparse.csr_matrix((vals, (filas, cols)), shape=(len(docs), len(vocab)), dtype=np.float64)
    df = np.bincount(tf.indices, minlength=len(vocab))
    idf = np.log((1 + n) / (1 + df)) + 1
    x = tf.multiply(idf).tocsr()
    norma = np.sqrt(np.asarray(x.multiply(x).sum(axis=1)).ravel())
    norma[norma == 0] = 1
    x = sparse.diags(1 / norma) @ x
    # descomposición exacta (ARPACK, convergencia completa): el resultado no depende de la semilla
    _, sv, vt = svds(x, k=k, solver='arpack', random_state=semilla, maxiter=100_000, tol=1e-10)
    orden = np.argsort(-sv)
    sv, v = sv[orden], vt[orden].T              # palabras × k
    # signo determinista: en cada dimensión, la carga de mayor valor absoluto es positiva
    signo = np.sign(v[np.abs(v).argmax(axis=0), np.arange(k)])
    v = v * signo
    dv = x @ v                                  # productos × k
    tv_b64, tv_esc = int8_b64(v)
    dv_b64, dv_esc = int8_b64(dv)
    return {
        'k': k, 'terms': vocab, 'df': [int(c) for c in df], 'idf': [r6(c) for c in idf], 'term_scale': tv_esc,
        'doc_scale': dv_esc, 'sigma': [r6(s) for s in sv],
        'term_vec_int8_b64': tv_b64, 'doc_vec_int8_b64': dv_b64, 'doc_ids': [r['id'] for r in productos],
        'version': version, 'textos_entrenamiento': len(productos),
    }


# ------------------------------------------------------------------------------------------------ comparación
def decodificar(m):
    nt, nd = len(m['terms']), len(m['doc_ids'])
    tv = np.frombuffer(base64.b64decode(m['term_vec_int8_b64']), np.int8).reshape(nt, m['k']) / 127 * np.array(m['term_scale'])[:, None]
    dv = np.frombuffer(base64.b64decode(m['doc_vec_int8_b64']), np.int8).reshape(nd, m['k']) / 127 * np.array(m['doc_scale'])[:, None]
    dv = dv / np.maximum(np.linalg.norm(dv, axis=1, keepdims=True), 1e-12)
    ts = tv * np.array(m['sigma'])
    ts = ts / np.maximum(np.linalg.norm(ts, axis=1, keepdims=True), 1e-12)
    return {t: i for i, t in enumerate(m['terms'])}, np.array(m['idf']), tv, dv, ts, np.array(m['df'])


def relacion(mod, termino):
    idx, idf, tv, dv, _, _ = mod
    q = idf[idx[termino]] * tv[idx[termino]]
    return dv @ (q / np.linalg.norm(q))


def vecinas(mod, termino, n=10):
    idx, _, _, _, ts, df = mod
    s = ts @ ts[idx[termino]]
    orden = [i for i in np.argsort(-s) if df[i] >= 2 and i != idx[termino]]
    inv = {i: t for t, i in idx.items()}
    return [inv[i] for i in orden[:n]]


def comparar(nuevo, publicado, n_palabras=300):
    a, b = decodificar(nuevo), decodificar(publicado)
    if nuevo['doc_ids'] != publicado['doc_ids']:
        sys.exit('Los modelos no tienen los mismos productos en el mismo orden.')
    comunes = [t for t in publicado['terms'] if t in a[0]]
    frec = sorted(comunes, key=lambda t: -publicado['df'][b[0][t]])[:n_palabras]
    top10, corr, vec10 = [], [], []
    for t in frec:
        ra, rb = relacion(a, t), relacion(b, t)
        ta, tb = set(np.argsort(-ra)[:10]), set(np.argsort(-rb)[:10])
        top10.append(len(ta & tb) / 10)
        corr.append(np.corrcoef(ra, rb)[0, 1])
        vec10.append(len(set(vecinas(a, t)) & set(vecinas(b, t))) / 10)
    return {'palabras_comparadas': len(frec), 'coincidencia_10_primeros_productos': round(float(np.mean(top10)), 3),
            'correlacion_relaciones': round(float(np.mean(corr)), 3), 'coincidencia_10_primeras_vecinas': round(float(np.mean(vec10)), 3)}


def main():
    ap = argparse.ArgumentParser(description='Entrena el modelo semántico a partir de datos/fuente/productos_vigentes.csv.')
    ap.add_argument('--productos', default=os.path.join(RAIZ, 'datos', 'fuente', 'productos_vigentes.csv'))
    ap.add_argument('--salida', required=True, help='archivo JSON del modelo nuevo')
    ap.add_argument('--comparar', help='modelo publicado contra el cual medir la coincidencia')
    ap.add_argument('--version', help='nombre de la versión (por defecto, pp-lsa- y la fecha de corte de la fuente)')
    a = ap.parse_args()
    with open(a.productos, encoding='utf-8-sig', newline='') as f:
        productos = list(csv.DictReader(f))
    if not a.version:
        with open(os.path.join(RAIZ, 'datos', 'fuente', 'verificacion_fuente.json'), encoding='utf-8') as f:
            a.version = 'pp-lsa-' + json.load(f)['fecha_verificacion']
    modelo = entrenar(productos, a.version)
    with open(a.salida, 'w', encoding='utf-8') as f:
        json.dump(modelo, f, ensure_ascii=False, separators=(',', ':'))
    print(f"modelo: {len(modelo['doc_ids']):,} productos · {len(modelo['terms']):,} términos · {modelo['k']} dimensiones → {a.salida}".replace(',', '.'))
    if a.comparar:
        with open(a.comparar, encoding='utf-8') as f:
            publicado = json.load(f)
        print(json.dumps(comparar(modelo, publicado), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
