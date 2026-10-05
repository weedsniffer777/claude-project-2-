// UI scale for small landscape screens (phones on their side): the PC
// layout, shrunk to fit, rather than a different layout. Sets --ui on the
// page (1 on anything big enough) and the class ui-scaled while it's below
// 1; the full-screen overlays zoom by it. Things placed in screen pixels
// inside a zoomed overlay (popups, lines, sparks) divide by uiZoom().
//
// fitInside: shrink one element (by zoom) till it fits a box, for screens
// where it must all show at once (the portrait map, the settings menu).
let z = 1;
export const uiZoom = () => z;

function apply() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  z = w > h && h < 640 ? Math.max(0.5, Math.min(1, h / 640, w / 1100)) : 1;
  document.documentElement.style.setProperty('--ui', String(z));
  document.documentElement.classList.toggle('ui-scaled', z < 1);
}

const CSS = `
html.ui-scaled .fit, html.ui-scaled .ws, html.ui-scaled .base-brief { zoom: var(--ui); width: calc(100vw / var(--ui)); height: calc(100dvh / var(--ui)); right: auto; bottom: auto; }
html.ui-scaled .base-news, html.ui-scaled .base-menu { zoom: var(--ui); }
html.ui-scaled .base-brief .map { height: min(calc(78vh / var(--ui)), 680px); }
html.ui-scaled .ws .list { max-height: calc(66vh / var(--ui)); }
html.ui-scaled .fit .pop { max-height: calc(60vh / var(--ui)); }
`;
if (typeof document !== 'undefined') {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.append(st);
  apply();
  window.addEventListener('resize', apply);
}

// zoom el down (never up) so it fits within maxW x maxH screen pixels
// (on top of any zoom it already has from the stylesheet)
export function fitInside(el, maxW, maxH) {
  el.style.zoom = '';
  const base = parseFloat(getComputedStyle(el).zoom) || 1;
  const r = el.getBoundingClientRect();
  const k = Math.min(1, maxW / Math.max(1, r.width), maxH / Math.max(1, r.height));
  if (k < 0.999) el.style.zoom = String(Math.max(0.4, base * k));
  return k;
}
