"""Línea base en Chrome: desbordes, inicio de la nube y posición del título en 8 tamaños, tiempos de JSON.parse, createEngine, consulta y vecinas, y cuadros por segundo activo y en reposo.
Uso: python3 pruebas/medir_chrome.py "$PWD/dist/index.html"   (necesita Playwright y Chrome en /usr/bin/google-chrome)"""
import asyncio, json, sys
from playwright.async_api import async_playwright
import os
CHROME = os.environ.get('CHROME') or ('/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)  # sin Chrome del sistema, usa el Chromium de Playwright

HTML = sys.argv[1]
SIZES = [(1920, 1080, False), (1440, 900, False), (1280, 800, False), (1024, 768, False),
         (844, 390, True), (390, 844, True), (375, 667, True), (320, 568, True)]
DIAG = """() => {
  const d = document.documentElement, w = document.getElementById('sky-wrap').getBoundingClientRect();
  const t1 = document.querySelector('.t-1').getBoundingClientRect(), side = document.querySelector('.side').getBoundingClientRect();
  const wide = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > innerWidth + 1; }).map(e => e.id || e.className || e.tagName).slice(0, 6);
  return { docW: d.scrollWidth, vw: innerWidth, skyTop: Math.round(w.top + scrollY), skyH: Math.round(w.height),
           titleRight: Math.round(t1.right), sideLeft: Math.round(side.left), wide };
}"""
BENCH = """() => {
  const b64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const r = {}; const t0 = performance.now();
  const D = JSON.parse(document.getElementById('data').textContent); const t1 = performance.now();
  const E = createEngine(D.model, b64); const t2 = performance.now();
  E.query(['mujer', 'rural']); const t3 = performance.now();
  E.neighbors(['mujer'], 18); E.neighbors(['rural'], 18); const t4 = performance.now();
  const nav = performance.getEntriesByType('navigation')[0];
  return { parseJSON_ms: +(t1 - t0).toFixed(1), createEngine_ms: +(t2 - t1).toFixed(1), query2_ms: +(t3 - t2).toFixed(1),
           neighbors2_ms: +(t4 - t3).toFixed(1), domContentLoaded_ms: Math.round(nav.domContentLoadedEventEnd), load_ms: Math.round(nav.loadEventEnd) };
}"""
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        for w, h, mob in SIZES:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
            pg = await ctx.new_page()
            await pg.goto('file://' + HTML); await pg.wait_for_timeout(1800)
            out[f'{w}x{h}'] = await pg.evaluate(DIAG)
            await ctx.close()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}); pg = await ctx.new_page()
        await pg.goto('file://' + HTML); await pg.wait_for_timeout(1500)
        runs = [await pg.evaluate(BENCH) for _ in range(3)]
        out['bench_1440x900_3_corridas'] = runs
        # inactividad: cuadros dibujados en 2 s, recién cargado y tras 6 s sin interacción (la animación dura 5 s como máximo, WCAG 2.2.2)
        count = """() => new Promise(res => { let n = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = f => { n++; return o(f); };
                    setTimeout(() => { window.requestAnimationFrame = o; res(n); }, 2000); })"""
        out['raf_2s_activo'] = await pg.evaluate(count)
        await pg.wait_for_timeout(6000)
        out['raf_2s_tras_6s_inactivo'] = await pg.evaluate(count)
        await b.close()
    print(json.dumps(out, ensure_ascii=False, indent=1))
asyncio.run(main())
