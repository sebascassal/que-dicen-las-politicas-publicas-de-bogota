  // --- composición
  function layoutSky(immediate) {
    SK.hover = null; SK.hoverG = null; SK.hoverC = null;
    if (!tip.classList.contains('pinned')) tip.hidden = true;
    $('#sky-empty').hidden = !!R;
    SK.ver++;
    if (!R || !W) {
      SK.nuc = []; SK.clouds = []; SK.stars.clear(); SK.groups = []; SK.gmap = new Map(); SK.links = []; SK.parts = []; SK.inter = null; SK.geo = null;
      updateCaption(); updateSkyLabel(); invalidate(); return;
    }
    const k = R.terms.length, small = W < 640, portrait = H > W * 1.12;
    const cx = W / 2, cy = H / 2;
    const mX = small ? 14 : clamp(W * .12, 80, 170), mY = small ? 28 : 40;
    const A = Math.max(90, W / 2 - mX), B = Math.max(90, H / 2 - mY);
    const cA = A * .42, cB = B * .42;
    SK.geo = { cx, cy, A, B, cA, cB, small, portrait };

    // 1 · núcleos: las palabras parecidas se acercan; en vertical se apilan
    const sim = (a, b) => clamp(E.unitSim(R.units[a], R.units[b]), 0, 1);
    let pos;
    if (k === 1) pos = [[cx, cy]];
    else if (k === 2) {
      const d = 2 * (portrait ? cB : cA) * (.86 - .42 * sim(0, 1));
      pos = portrait ? [[cx, cy - d / 2], [cx, cy + d / 2]] : [[cx - d / 2, cy], [cx + d / 2, cy]];
    } else {
      const T = (a, b) => 1.75 * (.86 - .42 * sim(a, b));
      const P = [0, 1, 2].map(j => { const a = -Math.PI / 2 + j * TAU / 3; return [Math.cos(a) * .9, Math.sin(a) * .9]; });
      for (let it = 0; it < 200; it++) for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
        const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], d = Math.hypot(dx, dy) || 1, f = (d - T(a, b)) / d * .2;
        P[a][0] += dx * f; P[a][1] += dy * f; P[b][0] -= dx * f; P[b][1] -= dy * f;
      }
      const gx = (P[0][0] + P[1][0] + P[2][0]) / 3, gy = (P[0][1] + P[1][1] + P[2][1]) / 3;
      pos = P.map(p => [cx + (p[0] - gx) * cA, cy + (p[1] - gy) * cB]);
    }
    const nsz = small ? 16 : 20, pk = small ? .85 : 1, pinH = 24 * pk;
    ctx.font = `900 ${nsz}px ${F_HEAD}`;
    const capH = ctx.measureText('H').actualBoundingBoxAscent || nsz * .7;
    const old = new Map(SK.nuc.map(n => [n.term, n]));
    SK.nuc = R.terms.map((t, j) => {
      const o = old.get(t), word = (S.words[j].suggested ? R.labels[j] : S.words[j].word).toUpperCase();
      const bw = ctx.measureText(word).width + nsz * 1.0, bh = nsz * 1.55;
      return { term: t, word, x: pos[j][0], y: pos[j][1], bw, bh, sz: nsz, capH, pin: pk, ly: -(pinH + 5 + bh / 2),
        fx: o ? o.cx : cx, fy: o ? o.cy : cy, cx: o ? o.cx : cx, cy: o ? o.cy : cy, a0: o ? 1 : 0, ca: o ? 1 : 0 };
    });
    const nucBoxes = [];
    for (const n of SK.nuc) {
      nucBoxes.push([n.x - n.bw / 2 - 6, n.y + n.ly - n.bh / 2 - 5, n.x + n.bw / 2 + 6, n.y + n.ly + n.bh / 2 + 5]);
      nucBoxes.push([n.x - 11, n.y - pinH - 3, n.x + 11, n.y + 3]);
    }

    // 2 · círculos de políticas alrededor: uno por política, hecho con sus productos relacionados
    const gm = new Map();
    for (const i of R.related) {
      const it = items[i], key = 'p' + it.pol;
      if (!gm.has(key)) gm.set(key, { key, pol: it.pol, fam: it.fam, sector: it.sector, ids: [] });
      gm.get(key).ids.push(i);
    }
    const groups = [...gm.values()];
    for (const g of groups) {
      g.ids.sort((a, b) => R.all[b] - R.all[a]);
      g.n = g.ids.length;
      g.w = R.terms.map((_, w) => g.ids.reduce((s, i) => s + Math.max(0, R.per[w][i]) ** 2, 0));
      g.mx = R.terms.map((_, w) => g.ids.reduce((m, i) => Math.max(m, R.per[w][i]), -1));
      g.cnt = R.terms.map((_, w) => g.ids.reduce((c, i) => c + (R.per[w][i] >= MEDIUM ? 1 : 0), 0));
      g.sum = R.terms.map((_, w) => g.ids.reduce((s, i) => s + (R.per[w][i] >= MEDIUM ? R.per[w][i] : 0), 0));
      g.str = g.ids.slice(0, 3).reduce((s, i) => s + R.all[i], 0) / Math.min(3, g.n);
      g.nInter = g.ids.reduce((c, i) => c + (interItem(i) ? 1 : 0), 0);
      g.inter = g.nInter > 0;
      g.rc = (small ? 4.5 : 5) + (small ? 2.45 : 2.7) * Math.sqrt(g.n);
      g.h = hash01(g.key);
    }
    // ángulo: del lado de la palabra con que más se relaciona; entre dos palabras si conecta ambas
    const th = pos.map(p => Math.atan2((p[1] - cy) / B, (p[0] - cx) / A));
    if (k === 1) {
      groups.sort((a, b) => a.fam - b.fam || a.sector - b.sector || b.str - a.str);
      const req = groups.map(g => 2 * g.rc + 20), tot = req.reduce((a, b) => a + b, 0) || 1;
      let acc = 0;
      groups.forEach((g, j) => { g.phi = -Math.PI / 2 + TAU * (acc + req[j] / 2) / tot; acc += req[j]; });
    } else {
      for (const g of groups) {
        const ord = g.w.map((v, w) => [w, v]).sort((a, b) => b[1] - a[1]);
        const [w1, v1] = ord[0], [w2, v2] = ord[1];
        if (v1 <= 0) { g.phi = -Math.PI / 2 + (g.h - .5) * .6; continue; }
        const t = v2 / (v1 + v2);
        let d = wrapA(th[w2] - th[w1]);
        if (Math.abs(Math.abs(d) - Math.PI) < .4) d = (g.h < .5 ? -1 : 1) * Math.abs(d);
        g.phi = t < .1 ? th[w1] + (g.h - .5) * .5 : th[w1] + d * t;
      }
    }
    // distancia: las más relacionadas, un poco más cerca del centro; luego se separan para no pisarse
    const sv = groups.map(g => g.str), smin = Math.min(...sv), smax = Math.max(...sv);
    groups.forEach(g => { g.rho = 1 - .15 * ((g.str - smin) / ((smax - smin) || 1)); g.phi = wrapA(g.phi); });
    groups.sort((a, b) => a.phi - b.phi);
    const radAt = g => Math.hypot(A * Math.cos(g.phi), B * Math.sin(g.phi)) * g.rho;
    const need = g => (2 * g.rc + (small ? 7 : 16)) / radAt(g);
    const tot = groups.reduce((s, g) => s + need(g), 0), cap = TAU * .96;
    let shrink = 1;
    if (tot > cap) { shrink = cap / tot; groups.forEach(g => { g.rc = Math.max(3.5, g.rc * shrink); }); }
    if (groups.length > 1) for (let it = 0; it < 600; it++) {
      let moved = false;
      for (let j = 0; j < groups.length; j++) {
        const a = groups[j], b = groups[(j + 1) % groups.length];
        let gap = b.phi - a.phi; if (j === groups.length - 1) gap += TAU;
        const req = (need(a) + need(b)) / 2;
        if (gap < req - 1e-4) { const s = (req - gap) * .3; a.phi -= s; b.phi += s; moved = true; }
      }
      if (!moved) break;
    }
    const oldG = SK.gmap;
    for (const g of groups) {
      g.x = cx + A * g.rho * Math.cos(g.phi); g.y = cy + B * g.rho * Math.sin(g.phi);
      const o = oldG.get(g.key); g.fx = o ? o.cx : cx; g.fy = o ? o.cy : cy; g.cx = g.fx; g.cy = g.fy;
    }
    // puntos en espiral (el más relacionado al centro) y líneas finas de cada política
    const next = new Map(), sScale = Math.max(.7, Math.min(1, shrink * 1.15));
    for (const g of groups) {
      const P = [];
      g.ids.forEach((i, j) => {
        const it = items[i], rr = g.rc * Math.sqrt((j + .5) / g.n), a = j * 2.39996 + g.h * TAU;
        const x = g.x + Math.cos(a) * rr, y = g.y + Math.sin(a) * rr * .92;
        const tn = clamp((R.all[i] - .1) / .75, 0, 1);
        next.set(it.id, { i, x, y, r: ((small ? 1.5 : 1.45) + 3.2 * Math.pow(tn, .9)) * sScale, inter: interItem(i), g: g.key, ox: g.fx, oy: g.fy });
        if (j < 8) P.push({ x, y, id: it.id });
      });
      g.edges = mstEdges(P);
    }
    for (const [id, s] of SK.stars) {
      const n = next.get(id);
      s.fx = s.cx; s.fy = s.cy; s.fr = s.cr; s.fa = s.ca;
      if (n) { Object.assign(s, { i: n.i, x: n.x, y: n.y, r: n.r, a: 1, inter: n.inter, g: n.g, dying: false }); next.delete(id); }
      else { s.r = 0; s.a = 0; s.dying = true; }
    }
    for (const [id, n] of next) SK.stars.set(id, { ...n, a: 1, fx: n.ox, fy: n.oy, fr: 0, fa: 0, cx: n.ox, cy: n.oy, cr: 0, ca: 0, dying: false });
    // bandas palabra → política (nivel según la intensidad de la articulación) y partículas que viajan por las más intensas
    SK.links = [];
    for (const g of groups) R.terms.forEach((_, w) => { if (g.mx[w] >= MEDIUM) SK.links.push({ w, g: g.key, s: g.mx[w], c: g.cnt[w], v: g.sum[w], k: bandOf(g.sum[w]), bend: (hash01(g.key + '|' + w) - .5) * .34 }); });
    SK.parts = SK.links.filter(l => l.k >= 2).sort((a, b) => b.v - a.v).slice(0, small ? 40 : 70).map(l => ({ ...l, ph: hash01(l.g + 'f' + l.w), sp: .07 + hash01(l.g + 's' + l.w) * .09 }));
    SK.inter = k >= 2 ? { n: R.related.reduce((c, i) => c + (interItem(i) ? 1 : 0), 0), m: groups.filter(g => g.inter).length } : null;

    // 3 · rótulos de las políticas (los que caben sin pisarse; el resto aparece al pasar o al acercar)
    const fontL = `700 ${small ? 10.5 : 11.5}px ${F_BODY}`, fontC = `400 ${small ? 9 : 9.5}px ${F_MONO}`, lh = small ? 13 : 14;
    const obstacles = groups.map(g => [g.x - g.rc - 4, g.y - g.rc - 4, g.x + g.rc + 4, g.y + g.rc + 4]);
    const placedL = [], maxLabels = small ? 9 : 60;
    [...groups].sort((a, b) => b.n - a.n || b.str - a.str).forEach((g, rank) => {
      const lines = wrapLines(groupName(g), small ? 96 : 128, fontL);
      const sub = `${N(g.n)} de ${N(POLS[g.pol].c)} productos`.toUpperCase();
      ctx.font = fontL; const wL = Math.max(...lines.map(l => ctx.measureText(l).width));
      ctx.font = fontC; const wS = ctx.measureText(sub).width;
      const w = Math.max(wL, wS), hgt = lines.length * lh + lh * .9;
      const ux = Math.cos(g.phi), uy = Math.sin(g.phi), off = g.rc + 13;
      const px = g.x + ux * off, py = g.y + uy * off * .95;
      const align = ux > .38 ? 'left' : ux < -.38 ? 'right' : 'center';
      let x0 = align === 'left' ? px : align === 'right' ? px - w : px - w / 2;
      let y0 = align === 'center' ? (uy < 0 ? py - hgt : py) : py - hgt / 2;
      x0 = clamp(x0, 5, W - 5 - w); y0 = clamp(y0, 5, H - 5 - hgt);
      const rect = [x0 - 5, y0 - 4, x0 + w + 5, y0 + hgt + 3];
      const show = rank < maxLabels && !placedL.some(r => overl(r, rect)) && !obstacles.some(b => overl(b, rect)) && !nucBoxes.some(b => overl(b, rect));
      if (show) placedL.push(rect);
      g.label = { lines, sub, x0, y0, w, hgt, lh, show, align, fontL, fontC };
    });
    // número de cada política (por cantidad de productos) y marcador numerado para las que no tienen rótulo visible
    const ranked = [...groups].sort((a, b) => b.n - a.n || b.str - a.str);
    ranked.forEach((g, j) => { g.rank = j + 1; });
    const bsz = small ? 16 : 17, badgeBoxes = [];
    for (const g of ranked) {
      g.badge = null;
      if (g.label.show) continue;
      let best = null;
      for (const da of [0, .55, -.55, 1.1, -1.1]) {
        const a = g.phi + da, off = g.rc + bsz * .5 + 4;
        const bx = clamp(g.x + Math.cos(a) * off, bsz / 2 + 3, W - bsz / 2 - 3), by = clamp(g.y + Math.sin(a) * off, bsz / 2 + 3, H - bsz / 2 - 3);
        const box = [bx - bsz / 2 - 1, by - bsz / 2 - 1, bx + bsz / 2 + 1, by + bsz / 2 + 1];
        const clash = badgeBoxes.some(b => overl(b, box)) || placedL.some(b => overl(b, box)) || obstacles.some((b, j) => groups[j] !== g && overl(b, box));
        if (!best || !clash) best = { dx: bx - g.x, dy: by - g.y, box };
        if (!clash) break;
      }
      badgeBoxes.push(best.box);
      g.badge = { dx: best.dx, dy: best.dy, sz: bsz };
    }

    // 4 · nube de palabras vecinas de cada núcleo, sin pisar nada de lo anterior
    const nCloud = small ? (k === 1 ? 12 : k === 2 ? 8 : 6) : (k === 1 ? 16 : k === 2 ? 12 : 9);
    const cloudR = Math.min(cA, cB) * (k === 1 ? 1 : .62);
    const owners = new Map();
    const cmeta = new Map();
    R.clouds.forEach((cl, w) => cl.slice(0, nCloud).forEach(n => { if (!owners.has(n.term)) owners.set(n.term, []); owners.get(n.term).push({ w, sim: n.sim }); cmeta.set(n.term, n); }));
    const qset = new Set(R.terms);
    const placed = nucBoxes.concat(obstacles, placedL, badgeBoxes);
    const free = b => b[0] >= 3 && b[1] >= 3 && b[2] <= W - 3 && b[3] <= H - 3 && !placed.some(p => overl(p, b));
    const entries = [...owners.entries()].filter(([t]) => !qset.has(t)).map(([term, ow]) => ({ term, ow, sim: Math.max(...ow.map(o => o.sim)), phrase: !!cmeta.get(term).phrase, df: cmeta.get(term).df })).sort((a, b) => b.sim - a.sim);
    const cnt = R.terms.map(() => 0);
    SK.clouds = [];
    for (const en of entries) {
      const shared = en.ow.length > 1, size = (small ? 10 : 11) + (small ? 4 : 5.5) * clamp(en.sim, 0, 1), weight = shared ? 800 : 600;
      ctx.font = `${weight} ${size}px ${F_BODY}`;
      const text = en.phrase ? en.term : surf(en.term), tw = ctx.measureText(text).width, thh = size * 1.15;
      const bx = (x, y) => [x - tw / 2 - 4, y - thh / 2 - 1, x + tw / 2 + 4, y + thh / 2 + 1];
      let got = null;
      if (shared) {
        let sx = 0, sy = 0, sw = 0; en.ow.forEach(o => { sx += o.sim * pos[o.w][0]; sy += o.sim * pos[o.w][1]; sw += o.sim; });
        const ox = sx / sw, oy = sy / sw, a0 = hash01(en.term) * TAU;
        for (let tr = 0; tr < 44 && !got; tr++) {
          const a = a0 + tr * 2.39996, r = tr ? 6 + 7 * Math.sqrt(tr) : 0, x = ox + Math.cos(a) * r * 1.4, y = oy + Math.sin(a) * r, b = bx(x, y);
          if (free(b)) got = { b, dx: x - ox, dy: y - oy };
        }
      } else {
        const w = en.ow[0].w, n = SK.nuc[w];
        let a = cnt[w] * 2.39996 + w * 1.1 + hash01(en.term) * .4, r = 34 + (1 - clamp(en.sim, 0, 1)) * cloudR;
        for (let tr = 0; tr < 48 && !got; tr++) {
          const x = n.x + Math.cos(a) * r * 1.15, y = n.y + Math.sin(a) * r * .8, b = bx(x, y);
          if (free(b)) got = { b, w, dx: x - n.x, dy: y - n.y };
          a += .33; if (tr % 6 === 5) r += 11;
        }
        cnt[w]++;
      }
      if (!got) continue;
      placed.push(got.b);
      SK.clouds.push({ term: en.term, text, sim: en.sim, size, weight, shared, tw, owners: en.ow, w: got.w, dx: got.dx, dy: got.dy, phrase: en.phrase, df: en.df });
    }

    SK.groups = groups;
    SK.gmap = new Map(groups.map(g => [g.key, g]));
    if (immediate || REDUCED) {
      for (const s of SK.stars.values()) { s.cx = s.x; s.cy = s.y; s.cr = s.r; s.ca = s.a; s.fx = s.x; s.fy = s.y; s.fr = s.r; s.fa = s.a; }
      for (const [id, s] of [...SK.stars.entries()]) if (s.dying) SK.stars.delete(id);
      SK.nuc.forEach(n => { n.cx = n.x; n.cy = n.y; n.fx = n.x; n.fy = n.y; n.a0 = 1; n.ca = 1; });
      groups.forEach(g => { g.cx = g.x; g.cy = g.y; g.fx = g.x; g.fy = g.y; });
      SK.animating = false;
    } else { SK.t0 = performance.now(); SK.animating = true; }
    updateCaption(); updateSkyLabel(); renderGroupIndex();
    kick(); invalidate();
  }
  function tweenTo(e) {
    for (const n of SK.nuc) { n.cx = n.fx + (n.x - n.fx) * e; n.cy = n.fy + (n.y - n.fy) * e; n.ca = n.a0 + (1 - n.a0) * e; }
    for (const g of SK.groups) { g.cx = g.fx + (g.x - g.fx) * e; g.cy = g.fy + (g.y - g.fy) * e; }
    for (const s of SK.stars.values()) { s.cx = s.fx + (s.x - s.fx) * e; s.cy = s.fy + (s.y - s.fy) * e; s.cr = s.fr + (s.r - s.fr) * e; s.ca = s.fa + (s.a - s.fa) * e; }
  }
  function finishTween() {
    SK.animating = false;
    tweenTo(1);
    for (const [id, s] of [...SK.stars.entries()]) if (s.dying) SK.stars.delete(id);
    for (const s of SK.stars.values()) { s.fx = s.x; s.fy = s.y; s.fr = s.r; s.fa = s.a; }
    SK.nuc.forEach(n => { n.fx = n.x; n.fy = n.y; n.a0 = 1; });
    SK.groups.forEach(g => { g.fx = g.x; g.fy = g.y; });
    pinTip();
  }
  function cloudPos(c) {
    if (c.shared) {
      let sx = 0, sy = 0, sw = 0;
      c.owners.forEach(o => { const n = SK.nuc[o.w]; if (n) { sx += o.sim * n.cx; sy += o.sim * n.cy; sw += o.sim; } });
      return sw ? [sx / sw + c.dx, sy / sw + c.dy] : [0, 0];
    }
    const n = SK.nuc[c.w]; return n ? [n.cx + c.dx, n.cy + c.dy] : [0, 0];
  }

