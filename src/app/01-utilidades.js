  // ================================================================ utilidades
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return e;
  }
  const nf = new Intl.NumberFormat('es-CO');
  const N = v => nf.format(v);
  const f2 = v => (Math.round(v * 100) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f1 = v => (Math.round(v * 10) / 10).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function hash01(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return ((x >>> 0) % 1000003) / 1000003; }
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* Al reconstruir una zona con botones, el foco vuelve al botón equivalente (mismo data-k), al primero que quede
     o, si la zona quedó vacía, a «otro»: así quien usa el teclado no vuelve al principio de la página. */
  function keepFocus(box, build, otro) {
    const a = document.activeElement, had = !!a && box.contains(a), key = had ? a.getAttribute('data-k') : null;
    build();
    if (!had || box.contains(document.activeElement)) return;
    const t = (key && [...box.querySelectorAll('[data-k]')].find(e => e.getAttribute('data-k') === key)) || box.querySelector('button:not([disabled]), a[href], select');
    const destino = t || (typeof otro === 'function' ? otro() : otro);
    if (destino) destino.focus({ preventScroll: true });
  }
  const listJoin = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
  const plural = (n, s, p) => N(n) + ' ' + (n === 1 ? s : p);
  const mq = q => (window.matchMedia ? matchMedia(q) : { matches: false, addEventListener() {} });
  const REDUCED = mq('(prefers-reduced-motion: reduce)').matches;
  const DESK = mq('(min-width: 900px) and (min-height: 620px)');
  const TAU = Math.PI * 2;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const wrapA = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const overl = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const INK = '#111111', INK2 = '#4a4545', PAPER = '#fcf8f8', YEL = '#f5e33b', YEL2 = '#faf2b0', GREY_FILL = '#dcd3d3', GREY_DIM = '#b5adad';
  const F_HEAD = "'Montserrat PP', 'Arial Black', sans-serif";
  const F_BODY = "'Montserrat PP', system-ui, sans-serif";
  const F_MONO = "'Space Mono PP', 'Courier New', monospace";

