  // --- dibujo
  function focusState() {
    const hovS = SK.hover !== null ? SK.stars.get(items[SK.hover].id) || null : null;
    const selS = S.sel !== null ? SK.stars.get(items[S.sel].id) || null : null;
    const focG = S.focus ? SK.gmap.get(S.focus) || null : null;
    const hovG = SK.hoverG || (hovS ? SK.gmap.get(hovS.g) || null : null);
    const filG = S.filt.pol !== '' ? SK.gmap.get('p' + S.filt.pol) || null : null;
    const F = new Set([focG, hovG, selS ? SK.gmap.get(selS.g) : null].filter(Boolean));
    return { hovS, selS, focG, hovG, filG, F };
  }
  function drawGroupLabel(g, gr, x0, y0, inv, X, Y) {
    const L = gr.label, s = cam.s;
    const rect = [x0 - 5, y0 - 4, x0 + L.w + 5, y0 + L.hgt + 3];
    const gx = X(gr.cx), gy = Y(gr.cy), rr = gr.rc * s + 5, ux = Math.cos(gr.phi), uy = Math.sin(gr.phi);
    const ax = gx + ux * rr, ay = gy + uy * rr * .95, tx = clamp(ax, rect[0], rect[2]), ty = clamp(ay, rect[1], rect[3]);
    g.globalAlpha = gr.dim && !inv ? .35 : 1;
    if (Math.hypot(tx - ax, ty - ay) > 2) {
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(ax, ay, 2.2, 0, TAU); g.fill();
    }
    if (inv) { g.fillStyle = INK; g.fillRect(rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]); }
    const ax2 = L.align === 'left' ? x0 : L.align === 'right' ? x0 + L.w : x0 + L.w / 2;
    g.textAlign = L.align; g.textBaseline = 'top'; g.lineJoin = 'round'; g.lineWidth = 3.2; g.strokeStyle = PAPER;
    g.font = L.fontL; g.fillStyle = inv ? '#fff' : INK;
    L.lines.forEach((ln, j) => { const yy = y0 + j * L.lh; if (!inv) g.strokeText(ln, ax2, yy); g.fillText(ln, ax2, yy); });
    const ys = y0 + L.lines.length * L.lh + 1;
    g.font = L.fontC; g.fillStyle = inv ? YEL : INK2;
    if (!inv) g.strokeText(L.sub, ax2, ys);
    g.fillText(L.sub, ax2, ys);
    SK.labels.push({ g: gr, rect });
    return rect;
  }
  function dynLabelPos(gr, X, Y) {
    const L = gr.label, ux = Math.cos(gr.phi), uy = Math.sin(gr.phi), gx = X(gr.cx), gy = Y(gr.cy), off = gr.rc * cam.s + 16;
    const px = gx + ux * off, py = gy + uy * off;
    let x0 = L.align === 'left' ? px : L.align === 'right' ? px - L.w : px - L.w / 2;
    let y0 = L.align === 'center' ? (uy < 0 ? py - L.hgt : py) : py - L.hgt / 2;
    if (y0 < fbarBottom + 6) y0 = gy + gr.rc * cam.s + 14;
    return [clamp(x0, 6, W - 6 - L.w), clamp(y0, fbarBottom + 6, H - 6 - L.hgt)];
  }
  function drawScene(g, e) {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.globalAlpha = 1; g.drawImage(bgC, 0, 0, W, H);
    SK.labels = [];
    if (!R || !SK.geo) return;
    const G = SK.geo, s = cam.s, ox = cam.x, oy = cam.y, hx = W / 2, hy = H / 2;
    const X = x => (x - ox) * s + hx, Y = y => (y - oy) * s + hy;
    const ms = 1 + (s - 1) * .45, zoomed = s > 1.06;
    const vis = (x, y, m) => x > -m && y > -m && x < W + m && y < H + m;
    const { hovS, selS, focG, filG, F } = focusState();
    const anyF = F.size > 0;
    for (const gr of SK.groups) gr.dim = !gr.ids.some(i => !starDim(items[i], i));

    // órbita punteada, como las líneas de referencia de un plano
    g.globalAlpha = .55; g.strokeStyle = '#8f8787'; g.lineWidth = 1; g.setLineDash([2, 6]);
    g.beginPath(); g.ellipse(X(G.cx), Y(G.cy), G.A * .93 * s, G.B * .93 * s, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    // bandas palabra → política: grosor y color según la intensidad de la articulación. Cada una lleva un borde del
    // color del papel que la separa de las que cruza; las de la política resaltada llevan borde negro y las demás se
    // atenúan. Las más intensas van encima. Las lupas y los círculos de las políticas, opacos, tapan los extremos.
    const bw = G.small ? BAND_WS : BAND_W, zf = Math.min(ms, 1.5), bands = [];
    for (const l of SK.links) {
      const gr = SK.gmap.get(l.g), n = SK.nuc[l.w]; if (!gr || !n) continue;
      bands.push([l, gr, n, (F.has(gr) || filG === gr) && !gr.dim]);
    }
    bands.sort((a, b) => (a[3] - b[3]) || (a[0].v - b[0].v));
    for (const [l, gr, n, hi] of bands) {
      const x0 = X(n.cx), y0 = Y(n.cy), x1 = X(gr.cx), y1 = Y(gr.cy), [qx, qy] = ctrlPt(x0, y0, x1, y1, l.bend), w = bw[l.k] * zf;
      g.globalAlpha = (gr.dim ? .08 : anyF && !hi ? .2 : 1) * n.ca;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(qx, qy, x1, y1);
      g.strokeStyle = hi ? INK : PAPER; g.lineWidth = w + (hi ? 3.2 : 2.2); g.stroke();
      g.strokeStyle = BAND_C[l.k]; g.lineWidth = w; g.stroke();
    }
    // lupas: un círculo del plano en amarillo bajo cada palabra buscada, con borde punteado
    const lr = (G.small ? 50 : 66) * ms;
    for (const n of SK.nuc) {
      const x = X(n.cx), y = Y(n.cy); if (!vis(x, y, lr + 12)) continue;
      g.globalAlpha = e;
      g.save(); g.beginPath(); g.arc(x, y, lr, 0, TAU); g.clip(); g.drawImage(texY, 0, 0, W, H); g.restore();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, lr, 0, TAU); g.stroke();
      g.globalAlpha = .7 * e; g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.arc(x, y, lr + 7, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    // políticas: círculo gris con borde fino sobre una base opaca; aro punteado si tiene productos que conectan palabras
    for (const gr of SK.groups) {
      const x = X(gr.cx), y = Y(gr.cy), rr = gr.rc * s + 5 * ms;
      if (!vis(x, y, rr + 20)) continue;
      g.beginPath(); g.arc(x, y, rr, 0, TAU);
      if (!gr.dim) { g.globalAlpha = e; g.fillStyle = PAPER; g.fill(); }
      g.globalAlpha = (gr.dim ? .3 : .75) * e; g.fillStyle = GREY_FILL; g.fill();
      g.globalAlpha = (gr.dim ? .25 : .7) * e; g.strokeStyle = INK; g.lineWidth = .9; g.stroke();
      if (gr.inter && !gr.dim) { g.globalAlpha = .85 * e; g.lineWidth = 1; g.setLineDash([3, 2.5]); g.beginPath(); g.arc(x, y, rr + 4 * ms, 0, TAU); g.stroke(); g.setLineDash([]); }
    }
    // figura: árbol mínimo entre los productos más relacionados
    for (const gr of SK.groups) {
      if (gr.dim || !gr.edges.length) continue;
      const foc = F.has(gr) || filG === gr;
      g.strokeStyle = INK; g.globalAlpha = (foc ? .9 : .4) * e; g.lineWidth = (foc ? 1.4 : .9) * Math.min(ms, 1.6);
      g.beginPath();
      for (const [a, b] of gr.edges) { const sa = SK.stars.get(a), sb = SK.stars.get(b); if (!sa || !sb) continue; g.moveTo(X(sa.cx), Y(sa.cy)); g.lineTo(X(sb.cx), Y(sb.cy)); }
      g.stroke();
    }
    // vínculos directos del producto resaltado con sus palabras (punteados)
    g.setLineDash([4, 3]);
    for (const hs of [hovS, selS]) {
      if (!hs) continue;
      g.lineWidth = 1.3; g.strokeStyle = INK;
      R.per.forEach((p, w) => { const n = SK.nuc[w]; if (!n || p[hs.i] < MEDIUM) return; g.globalAlpha = .5 + .45 * clamp(p[hs.i], 0, 1); g.beginPath(); g.moveTo(X(n.cx), Y(n.cy)); g.lineTo(X(hs.cx), Y(hs.cy)); g.stroke(); });
    }
    g.setLineDash([]);
    // productos: punto del color de su familia; halo amarillo si conectan dos o más palabras
    for (const st of SK.stars.values()) {
      if (st.ca <= .01 || st.cr <= .05) continue;
      const x = X(st.cx), y = Y(st.cy), r = st.cr * ms;
      if (!vis(x, y, r + 6)) continue;
      const it = items[st.i], dim = starDim(it, st.i);
      if (st.inter && !dim) { g.globalAlpha = st.ca; g.fillStyle = YEL; g.beginPath(); g.arc(x, y, r + 2.8, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = .8; g.stroke(); }
      g.globalAlpha = st.ca * (dim ? .3 : .96); g.fillStyle = dim ? GREY_DIM : FAMS[it.fam].color;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // mira de la política enfocada (negra) y aro de la filtrada (amarillo con borde)
    if (filG) {
      const x = X(filG.cx), y = Y(filG.cy), rr = filG.rc * s + 11 * ms;
      g.globalAlpha = 1; g.strokeStyle = INK; g.lineWidth = 5.5; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke();
      g.strokeStyle = YEL; g.lineWidth = 3; g.stroke();
    }
    if (focG) {
      const x = X(focG.cx), y = Y(focG.cy), rr = focG.rc * s + (filG === focG ? 17 : 11) * ms;
      g.globalAlpha = 1; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, rr, 0, TAU);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.moveTo(x + dx * (rr - 6), y + dy * (rr - 6)); g.lineTo(x + dx * (rr + 8), y + dy * (rr + 8)); }
      g.stroke();
    }
    for (const hs of [hovS, selS]) {
      if (!hs) continue;
      const x = X(hs.cx), y = Y(hs.cy), r = hs.cr * ms + 4.5;
      g.globalAlpha = 1;
      if (hs === selS) { g.strokeStyle = YEL; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r + 1.5, 0, TAU); g.stroke(); }
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    }
    // nubes de palabras vecinas: las compartidas por dos palabras van resaltadas en amarillo
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const c of SK.clouds) {
      const [wx, wy] = cloudPos(c), x = X(wx), y = Y(wy);
      if (!vis(x, y, 80)) continue;
      const a = e * (anyF ? .5 : 1);
      g.font = `${c.weight} ${c.size}px ${F_BODY}`;
      g.globalAlpha = a;
      if (c.shared) { g.fillStyle = YEL; g.fillRect(x - c.tw / 2 - 3, y - c.size * .52, c.tw + 6, c.size * 1.08); }
      else { g.lineWidth = 3.4; g.strokeStyle = PAPER; g.strokeText(c.text, x, y); }
      g.globalAlpha = a * (c.shared ? 1 : .6 + .4 * clamp(c.sim / .8, 0, 1)); g.fillStyle = INK; g.fillText(c.text, x, y);
      // las unidades de significado (expresiones) llevan un subrayado punteado; la vecina bajo el cursor, un subrayado amarillo
      if (c === SK.hoverC) { g.globalAlpha = 1; g.fillStyle = YEL; g.fillRect(x - c.tw / 2, y + c.size * .5, c.tw, 3); g.fillStyle = INK; g.fillRect(x - c.tw / 2, y + c.size * .5 + 3, c.tw, 1); }
      else if (c.phrase && !c.shared) { g.save(); g.setLineDash([2, 2]); g.lineWidth = 1; g.strokeStyle = INK; g.beginPath(); g.moveTo(x - c.tw / 2, y + c.size * .62); g.lineTo(x + c.tw / 2, y + c.size * .62); g.stroke(); g.restore(); }
    }
    // palabras buscadas: alfiler negro con centro amarillo y etiqueta amarilla
    for (const n of SK.nuc) {
      const x = X(n.cx), y = Y(n.cy);
      if (!vis(x, y, 160)) continue;
      g.globalAlpha = n.ca;
      pin(g, x, y, n.pin);
      const ly = y + n.ly;
      g.fillStyle = YEL; g.fillRect(x - n.bw / 2, ly - n.bh / 2, n.bw, n.bh);
      g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(x - n.bw / 2, ly - n.bh / 2, n.bw, n.bh);
      g.font = `900 ${n.sz}px ${F_HEAD}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = INK;
      g.fillText(n.word, x, ly + n.capH / 2);
    }
    // rótulos de las políticas
    if (!zoomed) {
      for (const gr of SK.groups) {
        const L = gr.label; if (!L) continue;
        const inv = F.has(gr) || filG === gr;
        if ((!L.show && !inv) || (SK.animating && !inv)) continue;
        if (inv && focG === gr && !fbar.hidden && L.y0 < fbarBottom) continue;
        drawGroupLabel(g, gr, L.x0, L.y0, inv, X, Y);
      }
    } else {
      const done = new Set();
      for (const gr of [SK.hoverG, hovS ? SK.gmap.get(hovS.g) : null, filG]) {
        if (!gr || done.has(gr) || (gr === focG && !fbar.hidden)) continue;
        done.add(gr);
        const [x0, y0] = dynLabelPos(gr, X, Y);
        drawGroupLabel(g, gr, x0, y0, true, X, Y);
      }
    }
    // marcadores numerados de las políticas sin rótulo: círculo negro con número blanco
    if (!zoomed && !SK.animating) {
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (const gr of SK.groups) {
        const bd = gr.badge; if (!bd) continue;
        const inv = F.has(gr) || filG === gr;
        if (inv && !(focG === gr && !fbar.hidden && gr.label.y0 < fbarBottom)) continue;
        const x = X(gr.cx + bd.dx), y = Y(gr.cy + bd.dy), z = bd.sz;
        g.globalAlpha = gr.dim ? .35 : 1;
        g.fillStyle = INK; g.beginPath(); g.arc(x, y, z / 2 + .5, 0, TAU); g.fill();
        g.font = `800 ${z * .58}px ${F_HEAD}`; g.fillStyle = '#fff';
        g.fillText(String(gr.rank), x, y + z * .21);
        SK.labels.push({ g: gr, rect: [x - z / 2 - 3, y - z / 2 - 3, x + z / 2 + 3, y + z / 2 + 3] });
      }
    }
    // códigos de producto al acercarse a una política: monoespaciada sobre amarillo pálido
    if (focG && s >= 1.7) {
      g.font = `700 10px ${F_MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      const boxes = SK.labels.map(l => l.rect); boxes.push([0, 0, W, fbarBottom + 2]);
      let shown = 0;
      for (const i of focG.ids) {
        if (shown >= 24) break;
        const st = SK.stars.get(items[i].id); if (!st) continue;
        const x = X(st.cx), y = Y(st.cy), r = st.cr * ms, cod = items[i].cod;
        const tw = g.measureText(cod).width, b = [x + r + 2, y - 7.5, x + r + 9 + tw, y + 7.5];
        if (!vis(x, y, -4) || boxes.some(o => overl(o, b))) continue;
        boxes.push(b); shown++;
        g.globalAlpha = starDim(items[i], i) ? .35 : 1;
        g.fillStyle = YEL2; g.fillRect(x + r + 3, y - 6.5, tw + 5, 13);
        g.fillStyle = INK; g.fillText(cod, x + r + 5.5, y + .5);
      }
    }
    g.globalAlpha = 1;
  }
  function drawOverlay(g, t) {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const s = cam.s, ms = 1 + (s - 1) * .45;
    const X = x => (x - cam.x) * s + W / 2, Y = y => (y - cam.y) * s + H / 2;
    // partículas claras por las bandas más intensas, solo en el tramo visible entre la lupa y el círculo de la política
    const { F, filG } = focusState(), anyF = F.size > 0, sm = !!(SK.geo && SK.geo.small);
    const lr = (sm ? 50 : 66) * ms, bw = sm ? BAND_WS : BAND_W, zf = Math.min(ms, 1.5);
    g.fillStyle = PAPER;
    for (const p of SK.parts) {
      const gr = SK.gmap.get(p.g), n = SK.nuc[p.w]; if (!gr || !n || gr.dim) continue;
      const x0 = X(n.cx), y0 = Y(n.cy), x1 = X(gr.cx), y1 = Y(gr.cy);
      const f = (p.ph + t * p.sp) % 1, u = 1 - f, [qx, qy] = ctrlPt(x0, y0, x1, y1, p.bend);
      const x = u * u * x0 + 2 * u * f * qx + f * f * x1, y = u * u * y0 + 2 * u * f * qy + f * f * y1;
      if (Math.hypot(x - x0, y - y0) < lr + 2 || Math.hypot(x - x1, y - y1) < gr.rc * s + 5 * ms + 2) continue;
      g.globalAlpha = .9 * Math.sin(f * Math.PI) * (anyF && !(F.has(gr) || filG === gr) ? .25 : 1);
      g.beginPath(); g.arc(x, y, clamp(bw[p.k] * zf * .24, 1.2, 2.4), 0, TAU); g.fill();
    }
    if (S.sel !== null) {
      const st = SK.stars.get(items[S.sel].id);
      if (st) {
        const ph = (t * .75) % 1, x = X(st.cx), y = Y(st.cy), rr = st.cr * ms + 6 + ph * 15;
        g.globalAlpha = .9 * (1 - ph); g.strokeStyle = YEL; g.lineWidth = 3.2; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke();
        g.strokeStyle = INK; g.lineWidth = .8; g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

