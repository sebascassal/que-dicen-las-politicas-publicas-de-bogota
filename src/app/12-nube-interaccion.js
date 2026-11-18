  // --- interacción: ratón, toque, pellizco, rueda y teclado
  function hitTest(px, py, touch) {
    if (!R) return null;
    const s = cam.s, ms = 1 + (s - 1) * .45;
    const starHit = () => {
      let best = null, bd = Infinity;
      for (const st of SK.stars.values()) {
        if (st.dying || st.ca < .5 || starDim(items[st.i], st.i)) continue;
        if (touch && S.focus && st.g !== S.focus) continue;
        const [x, y] = toScreen(st.cx, st.cy), d = Math.hypot(x - px, y - py), r = st.cr * ms;
        if (d < Math.max(touch ? 15 : 7, r + (touch ? 7 : 3.5)) && d < bd) { bd = d; best = st; }
      }
      return best;
    };
    const groupHit = () => {
      for (const l of SK.labels) if (px >= l.rect[0] && px <= l.rect[2] && py >= l.rect[1] && py <= l.rect[3]) return l.g;
      let best = null, bd = Infinity;
      for (const g of SK.groups) {
        const [x, y] = toScreen(g.cx, g.cy), d = Math.hypot(x - px, y - py);
        if (d <= g.rc * s + (touch ? 16 : 9) && d < bd) { bd = d; best = g; }
      }
      return best;
    };
    // palabras vecinas: se pueden tocar para sumarlas a la búsqueda (solo con la nube completa o sin política enfocada)
    const cloudHit = () => {
      if (S.focus || SK.animating) return null;
      for (const c of SK.clouds) {
        const [wx, wy] = cloudPos(c), [x, y] = toScreen(wx, wy), hw = c.tw / 2 + (touch ? 8 : 4), hh = c.size * .6 + (touch ? 7 : 3);
        if (px >= x - hw && px <= x + hw && py >= y - hh && py <= y + hh) return c;
      }
      return null;
    };
    if (touch && !S.focus) { const g = groupHit(); if (g) return { group: g }; const st = starHit(); if (st) return { star: st }; const c = cloudHit(); return c ? { cloud: c } : null; }
    const st = starHit(); if (st) return { star: st };
    const g = groupHit(); if (g) return { group: g };
    const c = cloudHit(); return c ? { cloud: c } : null;
  }
  function hover(x, y) {
    if (!R) return;
    const hit = hitTest(x, y, false);
    const hs = hit && hit.star ? hit.star.i : null, hg = hit && hit.group ? hit.group : null, hc = hit && hit.cloud ? hit.cloud : null;
    if (hs !== SK.hover || hg !== SK.hoverG || hc !== SK.hoverC) { SK.hover = hs; SK.hoverG = hg; SK.hoverC = hc; invalidate(); }
    sky.style.cursor = hit ? 'pointer' : (cam.s > 1.01 ? 'grab' : 'default');
    if (tip.classList.contains('pinned')) return;
    if (hs !== null) { tipProduct(hs, false); const [sx, sy] = toScreen(hit.star.cx, hit.star.cy); showTipAt(sx, sy); }
    else if (hg) { tipGroup(hg); const [gx, gy] = toScreen(hg.cx, hg.cy); showTipAt(gx, gy); }
    else if (hc) { tipCloud(hc); showTipAt(x, y); }
    else tip.hidden = true;
  }
  function tap(x, y, type) {
    if (!R) return;
    const touch = type !== 'mouse';
    const hit = hitTest(x, y, touch);
    if (hit && hit.star) {
      if (touch && S.focus !== hit.star.g) { focusGroup(hit.star.g); return; }
      selectItem(S.sel === hit.star.i ? null : hit.star.i, 'sky');
    } else if (hit && hit.group) {
      if (S.focus === hit.group.key) { if (!touch) focusGroup(null); }
      else focusGroup(hit.group.key);
    } else if (hit && hit.cloud) addFromCloud(hit.cloud);
    else if (S.sel !== null) selectItem(null, 'sky');
    else if (S.focus) focusGroup(null);
  }
  // navegar por la nube: una palabra vecina se suma a la búsqueda (o la reemplaza si ya hay tres)
  function addFromCloud(c) {
    if (S.words.length >= 3) S.words = [];
    const msgs = [];
    if (c.phrase) msgs.push(...addWords(c.term)); else pushWord(c.text, msgs);
    onQueryChange(msgs.filter(m => m.k !== 'unit'));
  }
  const ptrs = new Map(); let down = null, drag = false, pinch = null;
  const relXY = ev => { const r = sky.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  sky.addEventListener('pointerdown', ev => {
    const p = relXY(ev); ptrs.set(ev.pointerId, p); kick();
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: cam.s, w: toWorld((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
      down = null; cam.anim = false; return;
    }
    down = { x: p[0], y: p[1], t: performance.now(), type: ev.pointerType, cx: cam.x, cy: cam.y };
    drag = false;
    if (ev.pointerType === 'mouse' && ev.button === 0 && cam.s > 1.01) { try { sky.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ } }
  });
  sky.addEventListener('pointermove', ev => {
    const [x, y] = relXY(ev);
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, [x, y]);
    lastAct = performance.now();
    if (!raf) kick();
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const s = clamp(pinch.s * d / pinch.d, 1, S_MAX);
      setCam(s, pinch.w[0] - (mx - W / 2) / s, pinch.w[1] - (my - H / 2) / s);
      return;
    }
    if (down && down.type === 'mouse' && (ev.buttons & 1) && cam.s > 1.01) {
      const dx = x - down.x, dy = y - down.y;
      if (!drag && Math.hypot(dx, dy) > 4) { drag = true; hideHover(); sky.style.cursor = 'grabbing'; }
      if (drag) { setCam(cam.s, down.cx - dx / cam.s, down.cy - dy / cam.s); return; }
    }
    if (ev.pointerType !== 'touch') hover(x, y);
  });
  sky.addEventListener('pointerup', ev => {
    ptrs.delete(ev.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; down = null; return; }
    if (!down) return;
    const [x, y] = relXY(ev), moved = Math.hypot(x - down.x, y - down.y), dt = performance.now() - down.t, wasDrag = drag, type = down.type;
    down = null; drag = false;
    if (wasDrag) { sky.style.cursor = 'grab'; return; }
    if (moved < 10 && dt < 700) tap(x, y, type);
  });
  sky.addEventListener('pointercancel', ev => { ptrs.delete(ev.pointerId); pinch = null; down = null; drag = false; });
  sky.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse' && !drag) hideHover(); });
  sky.addEventListener('wheel', ev => {
    if (!(ev.ctrlKey || ev.metaKey) || !R) return;
    ev.preventDefault();
    const [x, y] = relXY(ev); kick();
    zoomAt(x, y, Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? .05 : .0022)));
  }, { passive: false });
  sky.addEventListener('keydown', ev => {
    if (!R) return;
    kick();
    const k = ev.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowUp') {
      const list = currentList(); if (!list.length) return;
      ev.preventDefault();
      let p = S.sel === null ? -1 : list.indexOf(S.sel);
      p = (k === 'ArrowRight' || k === 'ArrowDown') ? Math.min(list.length - 1, p + 1) : Math.max(0, p - 1);
      selectItem(list[p], 'sky');
    } else if (k === 'Escape') { if (S.sel !== null) selectItem(null, 'sky'); else if (S.focus) focusGroup(null); }
    else if (k === '+' || k === '=') { ev.preventDefault(); zoomBy(1.6); }
    else if (k === '-' || k === '_') { ev.preventDefault(); zoomBy(1 / 1.6); }
    else if (k === '0') { ev.preventDefault(); home(); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape' || ev.defaultPrevented || document.activeElement === sky) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.closest('dialog'))) return;
    if (S.sel !== null) selectItem(null, 'sky'); else if (S.focus) focusGroup(null);
  });

