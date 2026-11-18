"""Toma las capturas del README (docs/capturas/) con el visor construido.

Uso:
    pip install playwright pillow
    python3 scripts/capturas_readme.py

Usa el Chrome del sistema (o el de la variable CHROME); sin él, el Chromium de Playwright
(`python3 -m playwright install chromium`). Las imágenes se reducen a una paleta de 256 colores para que pesen poco.
"""
import asyncio
import os

from PIL import Image
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = 'file://' + os.path.join(RAIZ, 'dist', 'index.html')
SALIDA = os.path.join(RAIZ, 'docs', 'capturas')
CHROME = os.environ.get('CHROME') or ('/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)

CAPTURAS = [
    # nombre, búsqueda, ancho, alto, densidad, táctil
    ('escritorio', '#q-mujeres-rurales', 1440, 1280, 1, False),
    ('movil', '#q-habitanteZdeZcalle', 390, 1040, 2, True),
]


def optimizar(ruta):
    img = Image.open(ruta).convert('RGB')
    img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(ruta, optimize=True)


async def main():
    os.makedirs(SALIDA, exist_ok=True)
    async with async_playwright() as p:
        navegador = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for nombre, busqueda, ancho, alto, densidad, tactil in CAPTURAS:
            ctx = await navegador.new_context(viewport={'width': ancho, 'height': alto}, device_scale_factor=densidad,
                                              is_mobile=tactil, has_touch=tactil, reduced_motion='reduce')
            pagina = await ctx.new_page()
            await pagina.goto(HTML + busqueda)
            await pagina.wait_for_timeout(3000)
            ruta = os.path.join(SALIDA, nombre + '.png')
            await pagina.screenshot(path=ruta)
            optimizar(ruta)
            print(f'{os.path.relpath(ruta, RAIZ)}: {os.path.getsize(ruta) / 1024:.0f} kB')
            await ctx.close()
        await navegador.close()


if __name__ == '__main__':
    asyncio.run(main())
