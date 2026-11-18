"""Recorre en Chrome las interacciones básicas del visor en escritorio y en un teléfono táctil, sin peticiones externas.
Uso: python3 pruebas/recorrido_chrome.py "$PWD/dist/index.html" /carpeta/capturas   (termina con «sin errores de consola»)"""
import asyncio, sys
from playwright.async_api import async_playwright
import os
CHROME = os.environ.get('CHROME') or ('/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)  # sin Chrome del sistema, usa el Chromium de Playwright
HTML = sys.argv[1]; OUT = sys.argv[2]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        logs = []
        async def setup(page, tag):
            page.on('console', lambda m: logs.append(f'[{tag}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
            page.on('pageerror', lambda e: logs.append(f'[{tag}] PAGEERROR: {e}'))
            async def route(r):
                if r.request.url.startswith('file://'): await r.continue_()
                else: logs.append(f'[{tag}] EXTERNAL: {r.request.url}'); await r.abort()
            await page.route('**/*', route)
        # ---------- escritorio: vista inicial + interacciones
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        pg = await ctx.new_page(); await setup(pg, 'desk')
        await pg.goto('file://' + HTML); await pg.wait_for_timeout(2400)
        await pg.screenshot(path=f'{OUT}/v_d1.png')
        st = lambda js: pg.evaluate(js)
        # pasar el cursor por la nube (ficha de política) y clic en un punto vacío
        box = await pg.locator('#sky').bounding_box()
        for fx, fy in [(.5, .5), (.2, .3), (.8, .7), (.15, .8)]:
            await pg.mouse.move(box['x'] + box['width'] * fx, box['y'] + box['height'] * fy); await pg.wait_for_timeout(60)
        # índice: clic en la política 1
        await pg.click('#gindex button >> nth=0'); await pg.wait_for_timeout(900)
        print('focus via index:', await st('document.querySelector("#focusbar .fb-name")?.textContent'))
        # flechas del teclado: recorre productos
        await pg.focus('#sky'); await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(700); await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(700)
        print('sel card:', await st('document.querySelector("#results .card.sel h3")?.textContent'))
        await pg.keyboard.press('+'); await pg.wait_for_timeout(700); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
        print('focus after esc:', await st('document.querySelector("#focusbar").hidden'))
        # ctrl+rueda y arrastre
        box = await pg.locator('#sky').bounding_box()
        await pg.mouse.move(box['x'] + box['width'] * .5, box['y'] + box['height'] * .5)
        await pg.keyboard.down('Control'); await pg.mouse.wheel(0, -300); await pg.keyboard.up('Control'); await pg.wait_for_timeout(300)
        await pg.mouse.down(); await pg.mouse.move(box['x'] + box['width'] * .4, box['y'] + box['height'] * .4, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
        print('zoomed home enabled:', not await pg.is_disabled('#z-home'))
        if not await pg.is_disabled('#z-home'): await pg.click('#z-home')
        await pg.wait_for_timeout(800)
        # tres palabras, filtros, más resultados y método
        await pg.click('#examples button:has-text("carga logística")'); await pg.wait_for_timeout(300)
        await pg.fill('#q', 'transporte'); await pg.press('#q', 'Enter'); await pg.wait_for_timeout(1400)
        print('hash 3:', await st('location.hash'), '| chips:', (await pg.inner_text('#chips')).replace('\n', ' '))
        await pg.screenshot(path=f'{OUT}/v_d2_tres.png')
        so = await pg.eval_on_selector_all('#f-sector option', 'os => os.map(o => o.value)')
        await pg.select_option('#f-sector', so[1]); await pg.wait_for_timeout(900)
        print('sector filter list:', await st('document.querySelectorAll("#results .card").length'), '| chip:', await st('document.querySelector("#active-filters")?.textContent'))
        await pg.click('#active-filters button'); await pg.wait_for_timeout(700)
        if await pg.is_visible('#more'): await pg.click('#more')
        await pg.click('#btn-metodo-2'); await pg.wait_for_timeout(500)
        print('metodo rows:', await st('document.querySelectorAll("#m-body tbody tr").length'), '| ok cells:', await st('document.querySelectorAll("#m-body td.ok").length'))
        await pg.click('#m-close')
        # cambio de dirección (hashchange) con tilde codificada
        await st('location.hash = "#q-logIstica"'); await pg.wait_for_timeout(1300)
        print('hashchange chips:', (await pg.inner_text('#chips')).replace('\n', ' '))
        # inactividad: el bucle se detiene
        print('raf idle check skipped (5 s)')
        # ---------- móvil: toque en la política 1 vía índice y toque en una estrella
        mob = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        mp = await mob.new_page(); await setup(mp, 'mob')
        await mp.goto('file://' + HTML + '#q-vivienda-empleo-humedal'); await mp.wait_for_timeout(2400)
        await mp.screenshot(path=f'{OUT}/v_m1.png')
        await mp.evaluate("document.querySelector('#sky-wrap').scrollIntoView({block:'start'})"); await mp.wait_for_timeout(500)
        await mp.screenshot(path=f'{OUT}/v_m2.png')
        # toque sobre el centro de la política 1 (posición calculada en la página)
        await mp.tap('#gindex button >> nth=0'); await mp.wait_for_timeout(1300)
        print('mob focus:', await mp.evaluate('document.querySelector("#focusbar .fb-name")?.textContent'))
        await mp.evaluate("document.querySelector('#sky-wrap').scrollIntoView({block:'start'})"); await mp.wait_for_timeout(300)
        bb = await mp.locator('#sky').bounding_box()
        await mp.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2 + 30); await mp.wait_for_timeout(900)
        print('mob tip pinned:', await mp.evaluate('document.querySelector("#tip").classList.contains("pinned")'), await mp.evaluate('document.querySelector("#tip").className'))
        await mp.screenshot(path=f'{OUT}/v_m3_foco.png')
        print('\n'.join(logs[:40]) or 'sin errores de consola')
        await b.close()
asyncio.run(main())
