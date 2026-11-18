  // ================================================================ nube: palabras (centro) · políticas (círculos) · productos (puntos)
  const sky = $('#sky'), wrap = $('#sky-wrap'), ctx = sky.getContext('2d'), tip = $('#tip'), fbar = $('#focusbar');
  const bgC = document.createElement('canvas'), texY = document.createElement('canvas'), scC = document.createElement('canvas'), sctx = scC.getContext('2d');
  const zIn = $('#z-in'), zOut = $('#z-out'), zHome = $('#z-home');
  let W = 0, H = 0, DPR = 1, sceneKey = '', fontsReady = false, fbarBottom = 0;
  const SK = { nuc: [], clouds: [], stars: new Map(), groups: [], gmap: new Map(), links: [], parts: [], geo: null, inter: null, t0: 0, animating: false, hover: null, hoverG: null, hoverC: null, labels: [], ver: 0 };
  const cam = { s: 1, x: 0, y: 0, fs: 1, fx: 0, fy: 0, ts: 1, tx: 0, ty: 0, t0: 0, anim: false };
  const T_ANIM = 900, T_CAM = 650, IDLE_MS = 5000, S_MAX = 7;
  const groupName = g => POLS[g.pol].sn;

  function wrapLines(text, maxW, font) {
    ctx.font = font;
    const out = []; let cur = '';
    for (const w of text.split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { out.push(cur); cur = w; } }
    if (cur) out.push(cur);
    return out;
  }
  function mstEdges(P) {
    const n = P.length; if (n < 2) return [];
    const inT = new Array(n).fill(false), best = new Array(n).fill(Infinity), par = new Array(n).fill(-1), out = [];
    best[0] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1; for (let v = 0; v < n; v++) if (!inT[v] && (u < 0 || best[v] < best[u])) u = v;
      inT[u] = true; if (par[u] >= 0) out.push([P[par[u]].id, P[u].id]);
      for (let v = 0; v < n; v++) if (!inT[v]) { const d = Math.hypot(P[u].x - P[v].x, P[u].y - P[v].y); if (d < best[v]) { best[v] = d; par[v] = u; } }
    }
    return out;
  }
  const ctrlPt = (x0, y0, x1, y1, bend) => [(x0 + x1) / 2 - (y1 - y0) * bend, (y0 + y1) / 2 + (x1 - x0) * bend];
  const toScreen = (x, y) => [(x - cam.x) * cam.s + W / 2, (y - cam.y) * cam.s + H / 2];
  const toWorld = (x, y) => [(x - W / 2) / cam.s + cam.x, (y - H / 2) / cam.s + cam.y];

  // --- textura de plano urbano: manzanas grises y calles claras; la versión amarilla rellena las lupas
  function blocks(g, w, h, street, block, park) {
    g.fillStyle = street; g.fillRect(0, 0, w, h);
    const r = rng(7), ang = -.13, ext = Math.hypot(w, h) * .62, cols = [], rows = [];
    for (let x = -ext; x < ext;) { const cw = 30 + r() * 30; cols.push([x, cw]); x += cw; }
    for (let y = -ext; y < ext;) { const rh = 26 + r() * 26; rows.push([y, rh]); y += rh; }
    g.save(); g.translate(w / 2, h / 2); g.rotate(ang);
    for (const [x, cw] of cols) for (const [y, rh] of rows) { g.fillStyle = r() < .05 ? park : block; g.fillRect(x + 2.5, y + 2.5, cw - 5, rh - 5); }
    g.restore();
    g.strokeStyle = street;
    g.lineWidth = 9; g.beginPath(); g.moveTo(-10, h * .8); g.lineTo(w + 10, h * .2); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(w * .1, -10); g.lineTo(w * .6, h + 10); g.stroke();
  }
  function drawBackground() {
    for (const [c, street, block, park] of [[bgC, '#fcf8f8', '#efe7e7', '#e6dcdc'], [texY, '#fdf9dd', '#f6ea96', '#efdc6c']]) {
      c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
      const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
      blocks(g, W, H, street, block, park);
    }
  }
  // alfiler de mapa: punta en (x, y), cabeza negra con centro amarillo
  function pin(g, x, y, k) {
    const r = 8.5 * k, hgt = 24 * k, cy = y - hgt + r;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x - r * .3, y - hgt * .35, x - r, cy + r * .55, x - r, cy);
    g.arc(x, cy, r, Math.PI, 0);
    g.bezierCurveTo(x + r, cy + r * .55, x + r * .3, y - hgt * .35, x, y);
    g.closePath(); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(x, cy, r * .45, 0, TAU); g.fillStyle = YEL; g.fill();
  }

  // --- tamaño
  function resize() {
    if (!fontsReady) return;
    const r = sky.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    // nitidez real en pantallas 3× (iPhone) sin pasar de ~4,2 millones de píxeles por lienzo
    const raw = Math.min(3, window.devicePixelRatio || 1), dpr = r.width * r.height * raw * raw > 4.2e6 ? Math.max(1, Math.sqrt(4.2e6 / (r.width * r.height))) : raw;
    if (Math.abs(r.width - W) < .5 && Math.abs(r.height - H) < .5 && dpr === DPR && SK.geo) return;
    W = r.width; H = r.height; DPR = dpr;
    for (const c of [sky, scC]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    drawBackground();
    const keep = S.focus;
    S.focus = null;
    cam.s = 1; cam.x = W / 2; cam.y = H / 2; cam.anim = false;
    layoutSky(true);
    if (keep && SK.gmap.has(keep)) { focusGroup(keep, true); cam.anim = false; cam.s = cam.ts; cam.x = cam.tx; cam.y = cam.ty; }
    else renderFocusBar();
    measureBar(); updateZoomCtl(); pinTip(); invalidate();
  }

