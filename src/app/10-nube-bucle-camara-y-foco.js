  // --- bucle: dibuja solo cuando hace falta; la escena estable queda en caché y la animación se pausa sin interacción
  let raf = 0, lastAct = 0, onScreen = true;
  function kick() { lastAct = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
  function invalidate() { sceneKey = ''; if (!raf) raf = requestAnimationFrame(frame); }
  const keyNow = () => [SK.ver, W, H, DPR, cam.s.toFixed(4), cam.x.toFixed(2), cam.y.toFixed(2), SK.hover, SK.hoverG ? SK.hoverG.key : '', SK.hoverC ? SK.hoverC.term : '', S.sel, S.focus, S.iso, FILTER_KEYS.map(k => S.filt[k]).join(','), fbarBottom].join('|');
  const live = now => !REDUCED && onScreen && !document.hidden && !!R && (SK.parts.length > 0 || S.sel !== null) && now - lastAct < IDLE_MS;
  function frame(ts) {
    raf = 0;
    if (!W) return;
    let e = 1;
    if (SK.animating) { const p = clamp((ts - SK.t0) / T_ANIM, 0, 1); e = ease(p); tweenTo(e); if (p >= 1) { finishTween(); e = 1; } }
    if (cam.anim) {
      const p = clamp((ts - cam.t0) / T_CAM, 0, 1), q = ease(p);
      cam.s = Math.exp(lerp(Math.log(cam.fs), Math.log(cam.ts), q)); cam.x = lerp(cam.fx, cam.tx, q); cam.y = lerp(cam.fy, cam.ty, q);
      if (p >= 1) { cam.anim = false; cam.s = cam.ts; cam.x = cam.tx; cam.y = cam.ty; updateZoomCtl(); }
    }
    const moving = SK.animating || cam.anim;
    if (moving) { drawScene(ctx, e); sceneKey = ''; }
    else {
      const key = keyNow();
      if (key !== sceneKey) { drawScene(sctx, 1); sceneKey = key; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(scC, 0, 0);
    }
    if (moving) placePinned();
    const lv = live(ts);
    if (lv && !moving) drawOverlay(ctx, ts / 1000);
    if (moving || lv) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) kick(); }).observe(wrap);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  // --- cámara
  function camTo(s, x, y) {
    s = clamp(s, 1, S_MAX);
    if (s <= 1.001) { s = 1; x = W / 2; y = H / 2; }
    x = clamp(x, -.2 * W, 1.2 * W); y = clamp(y, -.3 * H, 1.3 * H);
    if (REDUCED || !W) { cam.anim = false; cam.s = cam.ts = s; cam.x = cam.tx = x; cam.y = cam.ty = y; invalidate(); updateZoomCtl(); placePinned(); return; }
    cam.fs = cam.s; cam.fx = cam.x; cam.fy = cam.y; cam.ts = s; cam.tx = x; cam.ty = y; cam.t0 = performance.now(); cam.anim = true;
    updateZoomCtl(); kick();
  }
  function setCam(s, x, y) {
    cam.anim = false;
    s = clamp(s, 1, S_MAX);
    if (s <= 1.001) { s = 1; x = W / 2; y = H / 2; }
    cam.s = cam.ts = s; cam.x = cam.tx = clamp(x, -.2 * W, 1.2 * W); cam.y = cam.ty = clamp(y, -.3 * H, 1.3 * H);
    invalidate(); updateZoomCtl(); placePinned();
  }
  function zoomAt(px, py, f) { const [wx, wy] = toWorld(px, py), s = clamp(cam.s * f, 1, S_MAX); setCam(s, wx - (px - W / 2) / s, wy - (py - H / 2) / s); }
  function zoomBy(f) { const s = (cam.anim ? cam.ts : cam.s) * f; if (s <= 1.02) { home(); return; } camTo(s, cam.anim ? cam.tx : cam.x, cam.anim ? cam.ty : cam.y); }
  function home() { if (S.focus) focusGroup(null); else camTo(1, W / 2, H / 2); }
  function updateZoomCtl() {
    const s = cam.anim ? cam.ts : cam.s;
    zIn.disabled = s >= S_MAX - .01;
    const lejos = s <= 1.001 && !S.focus;
    // el botón que desaparece no se lleva el foco: pasa a la nube
    if (lejos && (document.activeElement === zHome || document.activeElement === zOut)) sky.focus({ preventScroll: true });
    zOut.disabled = zHome.disabled = lejos;
  }
  zIn.addEventListener('click', () => zoomBy(1.6));
  zOut.addEventListener('click', () => zoomBy(1 / 1.6));
  zHome.addEventListener('click', home);
  function measureBar() { fbarBottom = fbar.hidden ? 0 : fbar.offsetTop + fbar.offsetHeight; }

  // --- foco en una política: la cámara se acerca y aparece la barra de foco
  function focusGroup(key, keepSel) {
    const g = key ? SK.gmap.get(key) : null;
    if (!keepSel && S.sel !== null) {
      const st = SK.stars.get(items[S.sel].id);
      if (!g || !st || st.g !== key) { S.sel = null; document.querySelectorAll('#results .card.sel').forEach(c => { c.classList.remove('sel'); c.removeAttribute('aria-current'); }); }
    }
    if (!g) {
      const was = S.focus !== null || cam.s > 1.001 || cam.anim;
      S.focus = null; renderFocusBar(); renderGroupIndex();
      if (was) camTo(1, W / 2, H / 2);
      hideHover(); pinTip(); invalidate(); updateZoomCtl();
      return;
    }
    S.focus = key;
    renderFocusBar(); renderGroupIndex();
    hideHover(); pinTip(); fitFocus(true); invalidate(); updateZoomCtl();
  }
  // encuadra la política enfocada en el espacio libre: debajo de la barra de foco y encima de la ficha acoplada (móvil)
  function fitFocus(force) {
    const g = S.focus ? SK.gmap.get(S.focus) : null;
    if (!g || !W) return;
    const docked = tip.classList.contains('pinned') && tip.classList.contains('dock') && !tip.hidden;
    const top = fbarBottom, bot = docked ? H - tipH - 12 : H, avail = Math.max(90, bot - top);
    let s = clamp(Math.min(W, avail) * .3 / (g.rc + 18), 1.6, 5.5);
    if (docked) s = Math.max(1.2, Math.min(s, avail * .4 / (g.rc + 10)));
    const y = g.y - ((top + bot) / 2 - H / 2) / s;
    if (!force && Math.abs(s - cam.ts) < .01 && Math.abs(g.x - cam.tx) < .5 && Math.abs(y - cam.ty) < .5) return;
    camTo(s, g.x, y);
  }
  function renderFocusBar() {
    const g = S.focus ? SK.gmap.get(S.focus) : null;
    fbar.textContent = '';
    renderProfile(g);
    if (!g) { fbar.hidden = true; measureBar(); return; }
    const p = POLS[g.pol];
    const per = R.labels.map((t, w) => `«${t}» ${f2(Math.max(0, g.mx[w]))}`).join(' · ');
    fbar.append(
      h('div', { class: 'fb-txt' },
        h('div', { class: 'fb-kick', text: `${p.i} · Sector líder: ${SECTORS[p.s]}` }),
        h('div', { class: 'fb-name', text: p.sn }),
        h('div', { class: 'fb-sub', text: `${N(g.n)} de ${N(p.c)} productos (${Math.round(100 * g.n / p.c)} %) se relacionan` + (W >= 620 ? ` · relación máxima: ${per}` : '') })),
      h('div', { class: 'fb-act' },
        h('button', { type: 'button', class: 'fb-list', onclick: () => showGroupInList(g) }, W >= 620 ? 'Ver en la lista' : 'Lista'),
        h('button', { type: 'button', class: 'fb-x', 'aria-label': 'Salir del acercamiento', title: 'Salir (Esc)', onclick: () => { focusGroup(null); sky.focus({ preventScroll: true }); } }, '×')));
    fbar.hidden = false;
    measureBar();
  }
  // perfil de la política enfocada: palabras frecuentes en su plan y políticas con textos más parecidos
  function renderProfile(g) {
    const box = $('#profile'); box.textContent = '';
    if (!g) { box.hidden = true; return; }
    const p = POLS[g.pol];
    box.append(h('div', { class: 'pf-head' }, h('span', { class: 'pf-k', text: 'Perfil' }), h('b', { text: p.sn }), h('span', { class: 'pf-i', text: `${p.i} · ${plural(p.c, 'producto vigente', 'productos vigentes')}` }),
      h('a', { class: 'pf-a', href: p.pa, target: '_blank', rel: 'noopener noreferrer', text: 'Plan de acción ↗' }), p.doc ? h('a', { class: 'pf-a', href: p.doc, target: '_blank', rel: 'noopener noreferrer', text: 'Documento de la política ↗' }) : null));
    if (p.kw && p.kw.length) {
      const row = h('div', { class: 'pf-row' }, h('span', { class: 'pf-t', text: 'Palabras frecuentes en su plan', title: 'Frecuentes en sus productos y raras fuera de ellos: reflejan la redacción del plan, no sus prioridades' }));
      p.kw.forEach(k => row.append(h('button', { type: 'button', title: 'Buscar «' + k + '» en todas las políticas', onclick: () => { S.words = []; onQueryChange(addWords(k).filter(m => m.k !== 'unit')); } }, k)));
      box.append(row);
    }
    const aff = POLS.map((_, j) => [j, j === g.pol ? -1 : polAffinity(g.pol, j)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const row2 = h('div', { class: 'pf-row' }, h('span', { class: 'pf-t', text: 'Políticas con textos más parecidos', title: 'Coseno entre los centros de sus productos; entre dos políticas cualesquiera la mediana es 0,12. No indica coordinación.' }));
    aff.forEach(([j, v]) => {
      const here = SK.gmap.has('p' + j);
      row2.append(h('button', { type: 'button', class: 'pf-pol', disabled: !here, title: here ? 'Acercarse a esta política en la nube' : 'No tiene productos relacionados con esta búsqueda', onclick: () => focusGroup('p' + j) }, POLS[j].sn, h('small', { text: f2(v) })));
    });
    box.append(row2);
    box.hidden = false;
  }
  function showGroupInList(g) {
    S.filt.pol = String(g.pol);
    if (S.filt.sector !== '' && S.filt.sector !== String(POLS[g.pol].s)) S.filt.sector = '';
    S.shown = 30; renderAll(false);
    const panel = $('#panel');
    if (DESK.matches) panel.scrollTop = 0;
    else panel.scrollIntoView({ block: 'start', behavior: REDUCED ? 'auto' : 'smooth' });
    panel.focus({ preventScroll: true });
  }

