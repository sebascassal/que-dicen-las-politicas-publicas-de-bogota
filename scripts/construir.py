"""Construye el visor «¿Qué dicen las Políticas Públicas de Bogotá?» en un solo archivo HTML.

Une los datos de `datos/` y el código de `src/` en `dist/index.html`: un archivo autónomo, sin peticiones
de red, que se abre en cualquier navegador.

Uso:
    python3 scripts/construir.py                 # escribe dist/index.html
    python3 scripts/construir.py --comprobar     # construye en memoria y falla si dist/index.html no está al día
    python3 scripts/construir.py --salida ruta.html
    python3 scripts/construir.py --huellas       # actualiza tamaños y huellas SHA-256 en datos/datapackage.json
    python3 scripts/construir.py --csp --salida /tmp/visor_csp.html   # variante de ensayo con política de seguridad de contenido

Solo usa la biblioteca estándar de Python (3.9 o superior). La salida es determinista: con los mismos datos y el
mismo código se obtiene el mismo archivo, byte a byte.
"""
import argparse
import base64
import collections
import csv
import datetime
import decimal
import glob
import hashlib
import json
import math
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATOS, SRC = os.path.join(RAIZ, 'datos'), os.path.join(RAIZ, 'src')
DIST = os.path.join(RAIZ, 'dist', 'index.html')
PRESUPUESTO_BYTES = 3_100_000          # tamaño máximo del HTML final: un freno contra el crecimiento accidental
FUENTE_OFICIAL = 'https://www.sdp.gov.co/'  # los planes de acción solo se enlazan aquí
# los documentos de las políticas también pueden estar en los sistemas de normas del Distrito
DOCUMENTOS_OFICIALES = (FUENTE_OFICIAL, 'https://www.alcaldiabogota.gov.co/', 'https://sisjur.bogotajuridica.gov.co/')
# longitud a la que llegaron recortados los textos largos en la extracción de este corte (ver docs/datos.md)
LIMITES = {'producto': 386, 'indicador': 248, 'resultado': 240, 'objetivo': 240, 'dependencia': 88}

# ------------------------------------------------------------------------------------------------ catálogos
# Familias de color de los sectores administrativos. Tintas validadas sobre el papel del lienzo (#fbf6f6)
# para contraste y para visión de color atípica.
FAMILIAS = [
    {'id': 'gob', 'corto': 'Gobierno, Seguridad, Gestión Pública', 'nombre': 'Gobierno, Seguridad y Gestión Pública', 'sectores': ['Gobierno', 'Seguridad', 'Gestión Pública'], 'color': '#2a6fc9'},
    {'id': 'ter', 'corto': 'Hábitat, Movilidad, Planeación', 'nombre': 'Hábitat, Movilidad y Planeación', 'sectores': ['Hábitat', 'Movilidad', 'Planeación'], 'color': '#108f69'},
    {'id': 'eco', 'corto': 'Desarrollo Económico', 'nombre': 'Desarrollo Económico', 'sectores': ['Desarrollo Económico'], 'color': '#b07e00'},
    {'id': 'soc', 'corto': 'Mujer, Social, Salud, Educación', 'nombre': 'Mujer, Integración Social, Salud y Educación', 'sectores': ['Mujer', 'Integración Social', 'Salud', 'Educación'], 'color': '#c93c80'},
    {'id': 'amb', 'corto': 'Ambiente', 'nombre': 'Ambiente', 'sectores': ['Ambiente'], 'color': '#3a8418'},
    {'id': 'cul', 'corto': 'Cultura y Deporte', 'nombre': 'Cultura, Recreación y Deporte', 'sectores': ['Cultura, recreación y deporte'], 'color': '#6049c9'},
]

# Nombres cortos que la regla general no resuelve bien.
NOMBRE_CORTO_FIJO = {
    'CONPES D.C. 36': 'Peatón (Bogotá Primero el Peatón)',
    'Decreto 600 de 2023': 'Población Migrante Internacional (Nuevos Bogotanos)',
    'CONPES D.C. 26': 'Turismo', 'CONPES D.C. 9': 'Seguridad Alimentaria y Nutricional',
    'Decreto 537 de 2023': 'Seguridad, Convivencia, Justicia, Paz y Reconciliación',
    'Decreto 034 de 2023': 'Lectura, Escritura y Oralidad', 'Decreto 193 de 2022': 'Lucha contra la Trata de Personas',
    'CONPES D.C. 16': 'LGBTI', 'CONPES D.C. 23': 'Deporte, Recreación, Actividad Física y Parques',
}

# La columna de enfoques viene en texto libre (unas 170 variantes); se normaliza a nueve etiquetas.
ENFOQUES = [('Género', r'g[eé]n?[em]ro'), ('Poblacional', r'po?b[la]+cional'), ('Diferencial', r'dif[er]*encial'), ('Territorial', r'ter+itorial'),
            ('Derechos humanos', r'derechos|ddhh'), ('Ambiental', r'ambiental'), ('Étnico', r'[eé]tnic'), ('Curso de vida', r'etari|curso de vida'),
            ('Cultura ciudadana', r'cultura\s*ciudadana')]

# Palabras que no distinguen temas; la misma lista usa el motor del navegador (src/motor.js).
PALABRAS_VACIAS = set(
    'a al ante bajo con contra de del desde durante en entre hacia hasta mediante para por segun sin sobre tras el la los las un una '
    'unos unas lo y e o u ni que se su sus es son ser como mas este esta estos estas ese esa cada otro otra otros otras no si ya le les '
    'muy todo toda todos todas numero porcentaje sumatoria total implementado implementada implementados implementadas realizado '
    'realizadas realizados desarrollado desarrollada acciones accion distrito distrital capital bogota'.split())
CONECTORES = set('de del la las el los en y con a para por al e o'.split())   # pueden ir dentro de una expresión
FRECUENCIA_MAXIMA = 0.2   # las palabras que aparecen en más del 20 % de los productos no distinguen temas: quedan fuera
PALABRA = re.compile(r'[0-9A-Za-zÀ-ÖØ-öø-ÿ]+')
CORTE = re.compile(r'[.,;:()\[\]/¿?¡!"“”«»\n\r\t–—|]')


# ------------------------------------------------------------------------------------------------ lectura y validación
def leer_csv(ruta):
    with open(ruta, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def leer_json(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def cargar_datos():
    return {
        'productos': leer_csv(os.path.join(DATOS, 'fuente', 'productos_vigentes.csv')),
        'politicas': leer_csv(os.path.join(DATOS, 'fuente', 'politicas_vigentes.csv')),
        'verificacion': leer_json(os.path.join(DATOS, 'fuente', 'verificacion_fuente.json')),
        'modelo': leer_json(os.path.join(DATOS, 'modelo', 'modelo_semantico.json')),
        'consultas': leer_json(os.path.join(DATOS, 'pruebas', 'consultas_control.json')),
        'entidades': {r['entidad_en_el_plan']: (r['entidad'], r['sigla'])
                      for r in leer_csv(os.path.join(DATOS, 'catalogos', 'entidades.csv'))},
    }


def huella(ruta):
    with open(ruta, 'rb') as f:
        crudo = f.read()
    return len(crudo), 'sha256:' + hashlib.sha256(crudo).hexdigest()


def actualizar_huellas():
    """Escribe en datos/datapackage.json el tamaño y la huella SHA-256 de cada archivo, y la versión de CITATION.cff."""
    ruta = os.path.join(DATOS, 'datapackage.json')
    paquete = leer_json(ruta)
    paquete['version'] = version_del_visor()
    recursos = []
    for r in paquete['resources']:
        tam, sha = huella(os.path.join(DATOS, r['path']))
        nuevo, puesto = {}, False
        for k, v in r.items():
            if k in ('bytes', 'hash'):
                continue
            if k in ('dialect', 'schema') and not puesto:
                nuevo['bytes'], nuevo['hash'], puesto = tam, sha, True
            nuevo[k] = v
        if not puesto:
            nuevo['bytes'], nuevo['hash'] = tam, sha
        recursos.append(nuevo)
    paquete['resources'] = recursos
    with open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(paquete, ensure_ascii=False, indent=2) + '\n')
    print(f'Huellas actualizadas: {len(recursos)} archivos en datos/datapackage.json')


def validar_paquete(errores):
    """datos/datapackage.json debe describir los archivos tal como están: mismo tamaño, misma huella y misma versión."""
    paquete = leer_json(os.path.join(DATOS, 'datapackage.json'))
    if paquete.get('version') != version_del_visor():
        errores.append(f"datapackage.json dice versión {paquete.get('version')} y CITATION.cff, {version_del_visor()}")
    for r in paquete['resources']:
        ruta = os.path.join(DATOS, r['path'])
        if not os.path.exists(ruta):
            errores.append(f"datapackage.json describe un archivo que no existe: {r['path']}")
        elif (r.get('bytes'), r.get('hash')) != huella(ruta):
            errores.append(f"datapackage.json: el tamaño o la huella de {r['path']} no corresponden al archivo "
                           '(ejecuta python3 scripts/construir.py --huellas)')


def validar(d):
    """Comprueba que los archivos de datos son coherentes entre sí antes de construir."""
    prod, pols, ver, mod, con = d['productos'], d['politicas'], d['verificacion'], d['modelo'], d['consultas']
    errores = []
    ids = [r['id'] for r in prod]
    if len(set(ids)) != len(ids):
        errores.append('hay identificadores de producto repetidos')
    if ids != mod['doc_ids']:
        errores.append('los productos del CSV y las filas del modelo no coinciden en el mismo orden')
    sin_catalogo = sorted({r['entidad'].strip() for r in prod} - set(d['entidades']))
    if sin_catalogo:
        errores.append(f'entidades que faltan en datos/catalogos/entidades.csv: {sin_catalogo[:5]}')
    doc_malos = sorted({p['documento_url'] for p in pols if p['documento_url'] and not p['documento_url'].startswith(DOCUMENTOS_OFICIALES)})
    if doc_malos:
        errores.append(f'documentos de política fuera de los sitios oficiales: {doc_malos[:3]}')
    # el visor enlaza los planes de acción: solo se aceptan enlaces al sitio de la SDP
    malos = sorted({r['plan_accion_url'] for r in prod + pols if not r['plan_accion_url'].startswith(FUENTE_OFICIAL)})
    if malos:
        errores.append(f'enlaces a planes de acción fuera de {FUENTE_OFICIAL}: {malos[:3]}')
    instrumentos = {p['instrumento'] for p in pols}
    por_pol = collections.Counter(r['instrumento'] for r in prod)
    if set(por_pol) - instrumentos:
        errores.append(f'productos de políticas que no están en el catálogo: {sorted(set(por_pol) - instrumentos)}')
    for p in pols:
        if int(p['productos_vigentes']) != por_pol[p['instrumento']]:
            errores.append(f"{p['instrumento']}: el catálogo dice {p['productos_vigentes']} productos y el CSV trae {por_pol[p['instrumento']]}")
    if ver['productos_vigentes'] != len(prod) or ver['politicas_con_productos_vigentes'] != len(pols):
        errores.append('la verificación de la fuente no coincide con el número de productos o de políticas')
    if ver['productos_vigentes'] + ver['productos_no_vigentes'] > ver['productos_leidos']:
        errores.append('la verificación de la fuente suma más productos vigentes y no vigentes que productos leídos')
    if not len(pols) <= ver['planes_leidos'] <= ver['archivos_publicados']:
        errores.append('la verificación de la fuente tiene un número de planes leídos fuera de rango')
    try:
        datetime.date.fromisoformat(ver['fecha_verificacion'])
    except (TypeError, ValueError):
        errores.append('la fecha de verificación de la fuente debe ser una fecha válida de la forma AAAA-MM-DD')
    if mod.get('textos_entrenamiento', 0) < len(prod):
        errores.append('modelo: textos_entrenamiento debe ser al menos el número de productos')
    k, nt, nd = mod['k'], len(mod['terms']), len(mod['doc_ids'])
    for clave, n in [('df', nt), ('idf', nt), ('term_scale', nt), ('doc_scale', nd), ('sigma', k)]:
        if len(mod[clave]) != n:
            errores.append(f'modelo: {clave} tiene {len(mod[clave])} valores y se esperaban {n}')
    if len(base64.b64decode(mod['term_vec_int8_b64'])) != nt * k or len(base64.b64decode(mod['doc_vec_int8_b64'])) != nd * k:
        errores.append('modelo: el tamaño de las matrices no corresponde a k × filas')
    # el vocabulario del modelo debe ser el de estos textos, sin las palabras demasiado frecuentes
    df = collections.Counter(w for r in prod for w in set(palabras_del_producto(r)))
    vocabulario = set(mod['terms'])
    if vocabulario - set(df):
        errores.append(f'modelo: términos que no aparecen en los productos: {sorted(vocabulario - set(df))[:5]}')
    raras = sorted(w for w in set(df) - vocabulario if df[w] <= FRECUENCIA_MAXIMA * len(prod))
    if raras:
        errores.append(f'modelo: palabras de los productos que faltan en el vocabulario sin ser demasiado frecuentes: {raras[:5]}')
    if any(df[t] != n for t, n in zip(mod['terms'], mod['df'])):
        errores.append('modelo: la columna df no corresponde a los productos')
    faltan = [q for q, e in con.items() if e['producto_esperado']['id'] not in set(ids)]
    if faltan:
        errores.append(f'consultas de control con producto esperado inexistente: {faltan}')
    validar_paquete(errores)
    if errores:
        sys.exit('Datos incoherentes:\n  - ' + '\n  - '.join(errores))


# ------------------------------------------------------------------------------------------------ texto
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def fecha_de_corte(iso):
    """'2026-11-04' → {'largo': '4 de noviembre de 2026', 'corto': '4 nov. 2026'}."""
    f = datetime.date.fromisoformat(iso)
    mes = MESES[f.month - 1]
    return {'largo': f'{f.day} de {mes} de {f.year}', 'corto': f"{f.day} {mes if len(mes) <= 4 else mes[:3] + '.'} {f.year}"}


def miles(n):
    """1234 → '1.234' (separador de miles de Colombia)."""
    return f'{n:,}'.replace(',', '.')


def meta_legible(valor):
    """La meta final como la muestra una hoja de cálculo: coma decimal, sin separador de miles y sin los residuos de
    coma flotante que guardan algunos archivos (1.0000000000000004 → 1; 0.99960000000000016 → 0,9996). Lo que no es
    un número, como «100,0%», se deja igual."""
    s = (valor or '').strip()
    if re.fullmatch(r'-?\d+', s) or not re.fullmatch(r'-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?', s):
        return s
    t = format(decimal.Decimal(f'{float(s):.10g}'), 'f')
    if '.' in t:
        t = t.rstrip('0').rstrip('.')
    return t.replace('.', ',')


RESIDUOS = re.compile('_x000[dDaA]_|[\u200b\u200c\u200d\u2060\ufeff\u00ad]')


def limpiar(texto):
    """Texto listo para mostrar y para encontrar menciones: en forma NFC (algunos resultados traen las tildes
    descompuestas), sin los escapes de Excel (_x000D_) ni caracteres invisibles, y sin espacios sobrantes."""
    t = unicodedata.normalize('NFC', texto or '').replace('\u0131', 'i')
    return re.sub(r'[ \t]+', ' ', RESIDUOS.sub(' ', t)).strip()


# Algunos planes traen el correo de una persona junto al nombre de la dependencia. El visor no lo muestra: es un dato
# personal que no hace falta para leer el plan. El CSV de la fuente se conserva tal como se extrajo.
CORREO = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')


def sin_correos(texto):
    return re.sub(r'[ \t]+', ' ', CORREO.sub(' ', texto)).strip(' -–,;:(/')


def recortado(texto, campo):
    """True si el texto llegó recortado: alcanza el límite de su columna y termina a mitad de palabra."""
    t = (texto or '').rstrip()
    return campo in LIMITES and len(t) >= LIMITES[campo] and (t[-1].isalnum() or t[-1] == ',')


def para_mostrar(r, campo):
    """El texto limpio, con «…» al final si llegó recortado."""
    return sin_correos(limpiar(r[campo])) + ('…' if recortado(r[campo], campo) else '')


def meta_para_mostrar(indicador, meta):
    """La meta legible y, si el indicador es un porcentaje y la meta una proporción (0 a 1), su equivalente."""
    m = meta_legible(meta)
    if not sin_tildes(indicador.strip()).startswith('porcentaje'):
        return m
    try:
        x = float(m.replace(',', '.'))
    except ValueError:
        return m
    if not 0 <= x <= 1:
        return m
    pct = format(decimal.Decimal(f'{x * 100:.10g}'), 'f')
    if '.' in pct:
        pct = pct.rstrip('0').rstrip('.')
    return f"{m} (proporción: {pct.replace('.', ',')} %)"


def version_del_visor():
    """La versión publicada, tomada de CITATION.cff para que haya una sola fuente."""
    with open(os.path.join(RAIZ, 'CITATION.cff'), encoding='utf-8') as f:
        return re.search(r'^version:\s*"?([^"\n]+)"?\s*$', f.read(), re.M).group(1)


def sin_tildes(t):
    t = unicodedata.normalize('NFD', t.lower())
    return ''.join(c for c in t if not ('̀' <= c <= 'ͯ'))


def normalizar(w):
    """Une singular y plural de forma simple: quita «es» final (más de 5 letras) o «s» final (más de 4)."""
    return w[:-2] if len(w) > 5 and w.endswith('es') else (w[:-1] if len(w) > 4 and w.endswith('s') else w)


def palabras(texto):
    """Palabras de un texto tal como las lee el modelo; igual que tokens() en src/motor.js."""
    t = re.sub(r'[^a-z0-9ñ ]+', ' ', sin_tildes(texto))
    return [normalizar(w) for w in t.split() if len(w) >= 3 and w not in PALABRAS_VACIAS and not w.isdigit()]


def palabras_del_producto(r):
    """El texto de un producto para el modelo: nombre (dos veces, para darle doble peso), indicador y resultado."""
    return palabras(r['producto']) * 2 + palabras(r['indicador']) + palabras(r['resultado'])


def raiz(w):
    """Raíz para comparar expresiones; además de normalizar, quita una «e» final («habitante» = «habitantes»)."""
    w = normalizar(w)
    return w[:-1] if len(w) > 4 and w.endswith('e') else w


def secuencia(texto):
    """Divide un texto en (raíz | None = conector | False = corte, palabra original). El motor hace lo mismo."""
    out, ultimo = [], 0
    for m in PALABRA.finditer(texto):
        if out and CORTE.search(texto[ultimo:m.start()]):
            out.append((False, ''))
        b = sin_tildes(m.group(0))
        ultimo = m.end()
        if len(b) >= 3 and b not in PALABRAS_VACIAS and not b.isdigit():
            out.append((raiz(b), m.group(0)))
        elif b in CONECTORES:
            out.append((None, m.group(0)))
        else:
            out.append((False, ''))
    return out


def nombre_corto(n):
    loc = r'(?:(?:en|para|de|del)\s+(?:Bogot[aá](?:\s+D\.?\s?C\.?|\s+Distrito\s+Capital)?|el\s+D\.?\s?C\.?|el\s+Distrito\s+Capital|Distrito\s+Capital))'
    s = re.sub(r'[“”"]', '', n).strip()
    s = re.sub(r'^Pol[ií]tica\s+P[uú]blica\s+(?:Distrital\s+|Integral\s+)?', '', s, flags=re.I)
    s = re.sub(r'^(?:de\s+la\s+|de\s+los\s+|del\s+|de\s+|para\s+y\s+del\s+|para\s+la\s+|para\s+el\s+|para\s+)', '', s, flags=re.I)
    s = re.sub(r'\s*' + loc + r'?\s*\d{4}\s*[-–]\s*\d{4}.*$', '', s, flags=re.I)
    s = re.sub(r'\s*' + loc + r'$', '', s, flags=re.I)
    s = re.sub(r'[,\s:]+$', '', s)
    return s[:1].upper() + s[1:]


def mascara_enfoques(texto):
    t, m = texto.lower(), 0
    for j, (_, rx) in enumerate(ENFOQUES):
        if re.search(rx, t):
            m |= 1 << j
    return m


# ------------------------------------------------------------------------------------------------ unidades de significado
def recorrer_expresiones(ws, largo_max, al_encontrar):
    """Recorre las expresiones de una secuencia: palabras de contenido contiguas, con hasta dos conectores
    entre ellas y sin cruzar puntuación. Llama a al_encontrar(i, j, raices) por cada expresión de 2 o más palabras."""
    n = len(ws)
    for i in range(n):
        if not ws[i][0]:
            continue
        raices, hueco, j = [ws[i][0]], 0, i + 1
        while j < n and len(raices) < largo_max:
            s = ws[j][0]
            if s:
                raices.append(s)
                hueco = 0
                al_encontrar(i, j, raices)
            elif s is None and hueco < 2:
                hueco += 1
            else:
                break
            j += 1


def diccionario_y_perfiles(productos, politicas):
    """Calcula el diccionario de unidades de significado (expresiones frecuentes del corpus) y las palabras propias
    de cada política. Devuelve (diccionario, palabras_propias_por_instrumento)."""
    nd = len(productos)
    pdf, psurf, ppol, sdf = collections.Counter(), collections.defaultdict(collections.Counter), collections.defaultdict(set), collections.Counter()
    wsurf = collections.defaultdict(collections.Counter)
    for r in productos:
        vistas, raices_vistas = set(), set()
        for campo in ('producto', 'indicador', 'resultado'):
            ws = secuencia(r[campo])
            for w in ws:
                if w[0]:
                    raices_vistas.add(w[0])
                    wsurf[w[0]][w[1].lower()] += 1

            def anotar(i, j, raices, ws=ws):
                clave = ' '.join(raices)
                psurf[clave][' '.join(x for _, x in ws[i:j + 1]).lower()] += 1
                vistas.add(clave)
            recorrer_expresiones(ws, 4, anotar)
        for k in vistas:
            pdf[k] += 1
            ppol[k].add(r['instrumento'])
        for s in raices_vistas:
            sdf[s] += 1

    # candidatas: al menos 4 productos de 2 o más políticas, sin raíces repetidas y con cohesión suficiente
    cand = {}
    for k, n in pdf.items():
        t = k.split()
        if n < 4 or len(ppol[k]) < 2 or len(set(t)) < len(t):
            continue
        if len(t) == 2:
            if n / min(sdf[t[0]], sdf[t[1]]) >= 0.15:
                cand[k] = n
        else:
            subs = [' '.join(t[a:a + len(t) - 1]) for a in (0, 1)]
            if n / max(pdf[s] for s in subs) >= 0.6:
                cand[k] = n
    # se descartan las expresiones que casi siempre aparecen dentro de otra más larga
    mas_larga = collections.defaultdict(list)
    for k in cand:
        t = k.split()
        for largo in range(2, len(t)):
            for a in range(len(t) - largo + 1):
                mas_larga[' '.join(t[a:a + largo])].append(k)
    dic = [k for k in cand if len(k.split()) <= 3 and not any(cand[y] >= 0.8 * cand[k] for y in mas_larga.get(k, []))]
    dic.sort(key=lambda k: (-cand[k], k))
    dic = dic[:700]
    diccionario = [psurf[k].most_common(1)[0][0] for k in dic]

    # palabras y unidades propias de cada política: frecuentes en ella y raras fuera (nombre e indicador)
    total_pol = collections.Counter(r['instrumento'] for r in productos)
    en_pol = collections.defaultdict(collections.Counter)
    conjunto = set(dic)
    for r in productos:
        vistas = set()
        for campo in ('producto', 'indicador'):
            ws = secuencia(r[campo])
            for w in ws:
                if w[0]:
                    vistas.add(('w', w[0]))

            def anotar(i, j, raices):
                if ' '.join(raices) in conjunto:
                    vistas.add(('p', ' '.join(raices)))
            recorrer_expresiones(ws, 3, anotar)
        for u in vistas:
            en_pol[r['instrumento']][u] += 1
    return dic, diccionario, pdf, sdf, psurf, wsurf, total_pol, en_pol


def palabras_propias(instrumento, terminos, nd, pdf, sdf, psurf, wsurf, total_pol, en_pol):
    raiz_a_termino = collections.defaultdict(list)
    for t in terminos:
        raiz_a_termino[raiz(t)].append(t)
    n, puntajes = total_pol[instrumento], []
    for (tipo, k), c in en_pol[instrumento].items():
        total = pdf[k] if tipo == 'p' else sdf[k]
        if c < max(3, 0.04 * n) or (tipo == 'w' and (k not in raiz_a_termino or len(k) < 5)):
            continue
        if (c / n) / (total / nd) < 2.5:      # al menos 2,5 veces más frecuente en la política que en el total
            continue
        puntajes.append(((c / n) * math.log(nd / total) * (2.2 if tipo == 'p' else 1), tipo, k))
    puntajes.sort(reverse=True)
    elegidas, usadas = [], set()
    for _, tipo, k in puntajes:
        if any(s in usadas for s in k.split()):
            continue
        usadas.update(k.split())
        elegidas.append(psurf[k].most_common(1)[0][0] if tipo == 'p' else wsurf[k].most_common(1)[0][0])
        if len(elegidas) == 5:
            break
    return elegidas


def formas_escritas(productos, terminos):
    """Forma escrita más común de cada término del vocabulario, para mostrarlo al público: el modelo guarda «genero»
    o «diferent», y el visor muestra «género» o «diferentes». Las siglas que casi siempre van en mayúsculas se muestran
    así («VIS», «ICAV»). Devuelve solo los términos cuya forma escrita es distinta."""
    vocabulario = set(terminos)
    cuenta = collections.defaultdict(collections.Counter)
    for r in productos:
        for campo in ('producto', 'indicador', 'resultado'):
            for m in PALABRA.finditer(r[campo]):
                b = sin_tildes(m.group(0))
                if len(b) >= 3 and b not in PALABRAS_VACIAS and not b.isdigit() and normalizar(b) in vocabulario:
                    cuenta[normalizar(b)][m.group(0)] += 1
    formas = {}
    for t in terminos:
        if t not in cuenta:
            continue
        minusculas = collections.Counter()
        for f, n in cuenta[t].items():
            minusculas[f.lower()] += n
        forma = max(minusculas.items(), key=lambda x: (x[1], x[0]))[0]
        if 2 * sum(n for f, n in cuenta[t].items() if f.lower() == forma and f.isupper()) > minusculas[forma]:
            forma = forma.upper()
        if forma != t:
            formas[t] = forma
    return formas


# ------------------------------------------------------------------------------------------------ datos del visor
def datos_del_visor(d):
    productos, politicas, mod = d['productos'], d['politicas'], d['modelo']
    sec2fam = {s: i for i, f in enumerate(FAMILIAS) for s in f['sectores']}
    sectores = sorted({p['sector'] for p in politicas}, key=lambda s: (sec2fam[s], s))
    idx_pol = {p['instrumento']: i for i, p in enumerate(politicas)}
    pols = [{'i': p['instrumento'], 'n': p['politica'], 'sn': NOMBRE_CORTO_FIJO.get(p['instrumento'], nombre_corto(p['politica'])),
             's': sectores.index(p['sector']), 'c': int(p['productos_vigentes']), 'pa': p['plan_accion_url'],
             'doc': p['documento_url']} for p in politicas]

    # tabla de cadenas: las entidades, dependencias, objetivos y resultados se repiten mucho
    cadenas, idx_cad = [], {}

    def cad(v):
        v = v or ''
        if v not in idx_cad:
            idx_cad[v] = len(cadenas)
            cadenas.append(v)
        return idx_cad[v]

    # lo que se muestra: textos limpios y marcados si llegaron recortados, entidades con su nombre normalizado
    col = {k: [] for k in ('pol', 'cod', 'pr', 'ind', 'ent', 'dep', 'meta', 'res', 'obj', 'enf')}
    for r in productos:
        col['pol'].append(idx_pol[r['instrumento']]); col['cod'].append(limpiar(r['codigo']))
        col['pr'].append(para_mostrar(r, 'producto')); col['ind'].append(para_mostrar(r, 'indicador'))
        col['ent'].append(cad(d['entidades'][r['entidad'].strip()][0])); col['dep'].append(cad(para_mostrar(r, 'dependencia')))
        col['meta'].append(meta_para_mostrar(r['indicador'], r['meta_final']))
        col['res'].append(cad(para_mostrar(r, 'resultado'))); col['obj'].append(cad(para_mostrar(r, 'objetivo')))
        col['enf'].append(mascara_enfoques(r['enfoque']))

    # el diccionario, los perfiles y las formas escritas salen de los textos limpios
    limpios = [{**r, **{c: limpiar(r[c]) for c in ('producto', 'indicador', 'resultado', 'objetivo')}} for r in productos]
    dic, diccionario, pdf, sdf, psurf, wsurf, total_pol, en_pol = diccionario_y_perfiles(limpios, politicas)
    for p in pols:
        p['kw'] = palabras_propias(p['i'], mod['terms'], len(productos), pdf, sdf, psurf, wsurf, total_pol, en_pol)

    modelo = {k: mod[k] for k in ('k', 'terms', 'df', 'idf', 'term_scale', 'doc_scale', 'sigma', 'term_vec_int8_b64',
                                  'doc_vec_int8_b64', 'doc_ids', 'version', 'textos_entrenamiento')}
    # palabras que el modelo descartó por demasiado frecuentes: el visor avisa si alguien las busca
    vocabulario = set(mod['terms'])
    modelo['frecuentes'] = sorted({w for r in productos for w in palabras_del_producto(r)} - vocabulario)
    # términos que son residuos de la extracción («x000d», «1el», «2aumento»): siguen en el modelo, pero no se muestran
    modelo['ocultos'] = [t for t in mod['terms'] if re.match(r'\d+[a-z]', t) or re.fullmatch(r'x000[0-9a-f]', t)]
    pruebas = {q: {'top': [e['producto_esperado']['id'], e['producto_esperado']['nombre'], e['producto_esperado']['similitud']],
                   'vec': e['vecinas_esperadas']} for q, e in d['consultas'].items()}
    ver = d['verificacion']
    verif = {k: ver[k] for k in ('fuente', 'archivos_publicados', 'planes_leidos', 'productos_leidos', 'productos_vigentes',
                                 'productos_no_vigentes', 'politicas_con_productos_vigentes', 'por_politica', 'excluidos',
                                 'otras_exclusiones')}
    variantes = {r['entidad'].strip() for r in productos}
    return {'fams': FAMILIAS, 'sectors': sectores, 'sec2fam': [sec2fam[s] for s in sectores], 'pols': pols, 'strs': cadenas,
            'pp': col, 'enfs': [e[0] for e in ENFOQUES], 'dict': diccionario, 'formas': formas_escritas(limpios, mod['terms']),
            'model': modelo, 'tests': pruebas, 'verif': verif, 'corte': fecha_de_corte(ver['fecha_verificacion']),
            'version': version_del_visor(),
            'entidades': {'variantes': len(variantes - {''}), 'normalizadas': len({d['entidades'][v][0] for v in variantes - {''}})}}


# ------------------------------------------------------------------------------------------------ ensamblado
def leer_src(nombre):
    with open(os.path.join(SRC, nombre), encoding='utf-8') as f:
        return f.read()


def aplicacion():
    """Une los módulos de src/app/ en orden y los envuelve en una sola función (comparten el mismo ámbito)."""
    partes = []
    for ruta in sorted(glob.glob(os.path.join(SRC, 'app', '*.js'))):
        with open(ruta, encoding='utf-8') as f:
            txt = f.read()
        partes.append(txt[:-1] if txt.endswith('\n') else txt)
    return "(function () {\n  'use strict';\n" + '\n'.join(partes) + "\n})();"


def con_csp(html):
    """Variante de ensayo: agrega una política de seguridad de contenido (CSP) que solo deja correr los scripts y estilos
    de este archivo, identificados por su huella. Probada en Chrome con todos los recorridos; falta probarla en Safari
    antes de adoptarla (ver docs/revision-comite.md), por eso no va en dist/index.html."""
    def huellas(etiqueta):
        return ' '.join("'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode('utf-8')).digest()).decode() + "'"
                        for m in re.finditer(rf'<{etiqueta}>([\s\S]*?)</{etiqueta}>', html))
    csp = (f"default-src 'none'; script-src {huellas('script')}; style-src {huellas('style')}; "
           "font-src data:; img-src data:; base-uri 'none'; form-action 'none'")
    marca = '<meta charset="utf-8">'
    if html.count(marca) != 1:
        sys.exit('No se encontró dónde insertar la política de seguridad de contenido')
    return html.replace(marca, f'{marca}\n<meta http-equiv="Content-Security-Policy" content="{csp}">')


def construir(csp=False):
    d = cargar_datos()
    validar(d)
    datos = datos_del_visor(d)
    # «<» escapado: ningún texto de los datos puede cerrar la etiqueta <script> ni abrir un comentario HTML
    carga = json.dumps(datos, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    # el motor del navegador y este script deben leer las palabras igual
    motor = leer_src('motor.js')
    vacias_motor = set(re.search(r'const SW = new Set\(`([^`]*)`', motor).group(1).split())
    if vacias_motor != PALABRAS_VACIAS:
        sys.exit(f'Las palabras vacías de src/motor.js y de este script difieren: {sorted(vacias_motor ^ PALABRAS_VACIAS)}')
    # los datos que cambian con cada corte se escriben en la plantilla desde datos/, nunca a mano
    ver = d['verificacion']
    plantilla = leer_src('plantilla.html')
    for marca, valor in [('__CORTE__', datos['corte']['largo']), ('__CORTE_CORTO__', datos['corte']['corto']),
                         ('__N_PRODUCTOS__', miles(ver['productos_vigentes'])),
                         ('__N_POLITICAS__', miles(ver['politicas_con_productos_vigentes'])), ('__VERSION__', datos['version'])]:
        plantilla = plantilla.replace(marca, valor)
    sobrantes = set(re.findall(r'__[A-Z_]+__', plantilla)) - {'__FONTS__', '__STYLES__', '__ENGINE_JS__', '__APP_JS__', '__DATA_JSON__'}
    if sobrantes:
        sys.exit(f'La plantilla tiene marcas sin reemplazar: {sorted(sobrantes)}')
    externos = set(re.findall(r'(?:src|href)="(https?://[^"]+)"', plantilla))
    if not all(u.startswith(FUENTE_OFICIAL) for u in externos):
        sys.exit(f'La plantilla enlaza recursos externos no permitidos: {sorted(externos)}')
    for marca in ('/*__FONTS__*/', '/*__STYLES__*/', '/*__ENGINE_JS__*/', '/*__APP_JS__*/', '__DATA_JSON__'):
        if plantilla.count(marca) != 1:
            sys.exit(f'La plantilla debe tener exactamente una marca {marca}')
    # una sola pasada sobre la plantilla: lo que se inserta nunca se vuelve a leer en busca de marcas
    piezas = {'/*__FONTS__*/': leer_src('fuentes.css'), '/*__STYLES__*/': leer_src('estilos.css'), '/*__ENGINE_JS__*/': motor,
              '/*__APP_JS__*/': aplicacion(), '__DATA_JSON__': carga}
    html = re.sub('|'.join(re.escape(m) for m in piezas), lambda m: piezas[m.group(0)], plantilla)
    if csp:
        html = con_csp(html)
    crudo = html.encode('utf-8')
    if len(crudo) > PRESUPUESTO_BYTES:
        sys.exit(f'El HTML pesa {len(crudo):,} bytes y el presupuesto es {PRESUPUESTO_BYTES:,}')
    resumen = (f"{len(d['productos']):,} productos · {len(d['politicas'])} políticas · {len(datos['model']['terms']):,} términos · "
               f"{len(datos['dict'])} unidades de significado · HTML {len(crudo) / 1e6:.2f} MB · sha256 {hashlib.sha256(crudo).hexdigest()[:16]}")
    return crudo, resumen.replace(',', '.')


def main():
    ap = argparse.ArgumentParser(description='Construye dist/index.html a partir de datos/ y src/.')
    ap.add_argument('--salida', default=DIST, help='ruta del HTML de salida (por defecto dist/index.html)')
    ap.add_argument('--comprobar', action='store_true', help='no escribe nada: falla si la salida no coincide con el archivo existente')
    ap.add_argument('--huellas', action='store_true', help='actualiza tamaños, huellas y versión en datos/datapackage.json y termina')
    ap.add_argument('--csp', action='store_true', help='variante de ensayo con política de seguridad de contenido; exige --salida')
    a = ap.parse_args()
    if a.huellas:
        actualizar_huellas()
        return
    if a.csp and (a.comprobar or os.path.abspath(a.salida) == os.path.abspath(DIST)):
        sys.exit('--csp es una variante de ensayo: úsala con --salida y una ruta distinta de dist/index.html')
    crudo, resumen = construir(csp=a.csp)
    if a.comprobar:
        actual = open(a.salida, 'rb').read() if os.path.exists(a.salida) else b''
        if actual != crudo:
            sys.exit(f'{os.path.relpath(a.salida, RAIZ)} no está al día con datos/ y src/: ejecuta python3 scripts/construir.py')
        print('Al día:', resumen)
        return
    os.makedirs(os.path.dirname(os.path.abspath(a.salida)), exist_ok=True)
    with open(a.salida, 'wb') as f:
        f.write(crudo)
    print('Construido:', resumen)


if __name__ == '__main__':
    main()
