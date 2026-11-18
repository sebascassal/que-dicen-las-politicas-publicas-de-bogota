"""Verifica el visor de punta a punta con un solo comando.

Uso:
    python3 pruebas/verificar.py            # todo: construcción, modelo, unidades y recorridos en el navegador
    python3 pruebas/verificar.py --rapido   # sin navegador: construcción, determinismo, modelo, unidades y cifras
    python3 pruebas/verificar.py --capturas carpeta   # guarda las capturas de las pruebas de navegador en esa carpeta
    python3 pruebas/verificar.py --solo-navegador     # solo los recorridos y funciones en Chrome (la integración continua los separa)
    python3 pruebas/verificar.py --solo-medidas       # solo las medidas en píxeles, que dependen de la versión de Chrome

Necesita Python 3.9+ y Node 18+. Las pruebas de navegador necesitan además Playwright para Python
(`pip install playwright`) y Chrome; si no hay Chrome del sistema, usa el Chromium de Playwright
(`python3 -m playwright install chromium`). Para elegir otro navegador, define la variable CHROME.
Termina con «VERIFICACIÓN COMPLETA: todo pasa» o con la lista de fallas (código de salida 1).
"""
import json
import os
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(RAIZ, 'dist', 'index.html')
fallas = []


def correr(nombre, cmd, esperado=None, env=None):
    r = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, env=env)
    salida = (r.stdout + r.stderr).strip()
    ultima = salida.splitlines()[-1] if salida else ''
    ok = r.returncode == 0 and (esperado is None or esperado in salida)
    print(('PASA  ' if ok else 'FALLA ') + nombre + (' · ' + ultima if ultima else ''))
    if not ok:
        fallas.append(nombre)
        print(salida[-2000:])
    return salida


def main():
    rapido = '--rapido' in sys.argv
    solo_nav, solo_med = '--solo-navegador' in sys.argv, '--solo-medidas' in sys.argv
    tmp = tempfile.mkdtemp(prefix='visor_')
    py = sys.executable
    capturas = sys.argv[sys.argv.index('--capturas') + 1] if '--capturas' in sys.argv else os.path.join(tmp, 'capturas')
    if solo_nav or solo_med:
        os.makedirs(capturas, exist_ok=True)
        if solo_nav:
            navegador(py, capturas)
        if solo_med:
            medidas_en_chrome(py)
        terminar()
        return

    correr('dist/index.html está al día con datos/ y src/', [py, 'scripts/construir.py', '--comprobar'])
    # la salida no depende del orden de los conjuntos de Python (semilla de hash)
    salidas = []
    for semilla in ('1', '2'):
        destino = os.path.join(tmp, f'visor_{semilla}.html')
        correr(f'construcción con semilla de hash {semilla}', [py, 'scripts/construir.py', '--salida', destino],
               env={**os.environ, 'PYTHONHASHSEED': semilla})
        salidas.append(open(destino, 'rb').read() if os.path.exists(destino) else b'')
    ok = salidas[0] == salidas[1] and salidas[0] != b''
    print(('PASA  ' if ok else 'FALLA ') + 'construcción determinista')
    if not ok:
        fallas.append('construcción determinista')

    correr('modelo: consultas de control', ['node', 'pruebas/validar_modelo.js', DIST], '7/7 pruebas pasan')
    correr('unidades de significado', ['node', 'pruebas/probar_unidades.js', DIST], 'todas las comprobaciones pasan')
    correr('cifras de referencia citadas en el visor y la metodología', ['node', 'pruebas/cifras_de_referencia.js', DIST], 'están al día')

    if not rapido:
        os.makedirs(capturas, exist_ok=True)
        navegador(py, capturas)
        medidas_en_chrome(py)
        print(f'capturas en {capturas}')
    terminar()


def navegador(py, capturas):
    correr('recorrido básico en Chrome (escritorio y teléfono)', [py, 'pruebas/recorrido_chrome.py', DIST, capturas], 'sin errores de consola')
    correr('funciones de búsqueda, filtros y perfiles en Chrome', [py, 'pruebas/funciones_chrome.py', DIST, capturas])


def medidas_en_chrome(py):
    """Medidas en 8 tamaños: sin desborde, la nube en su sitio (con 2 px de tolerancia) y la animación detenida."""
    salida = correr('medición en 8 tamaños de pantalla', [py, 'pruebas/medir_chrome.py', DIST])
    try:
        medidas = json.loads(salida[salida.index('{'):])
    except ValueError:
        medidas = {}
    ref = json.load(open(os.path.join(RAIZ, 'pruebas', 'referencia_medidas.json'), encoding='utf-8'))['tamanos']
    for tam, r in ref.items():
        m = medidas.get(tam)
        ok = bool(m) and m['docW'] == m['vw'] and m['skyTop'] <= r['nube_inicio_px'] + 2 and abs(m['skyH'] - r['nube_alto_px']) <= 2 \
            and (m['titleRight'] < m['sideLeft'] or m['sideLeft'] < 100)
        detalle = f"la nube empieza en {m['skyTop']} px (referencia {r['nube_inicio_px']}), sin desborde" if m else 'sin medida'
        print(('PASA  ' if ok else 'FALLA ') + f'{tam}: {detalle}')
        if not ok:
            fallas.append(tam)
    ok = medidas.get('raf_2s_tras_6s_inactivo') == 0
    print(('PASA  ' if ok else 'FALLA ') + f"la animación se detiene a los 5 s sin interacción ({medidas.get('raf_2s_tras_6s_inactivo')} cuadros)")
    if not ok:
        fallas.append('pausa de la animación')


def terminar():
    print(f'{len(fallas)} fallas: {fallas}' if fallas else 'VERIFICACIÓN COMPLETA: todo pasa')
    sys.exit(1 if fallas else 0)


if __name__ == '__main__':
    main()
