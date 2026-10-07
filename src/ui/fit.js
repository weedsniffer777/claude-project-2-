import { uiZoom } from './scale.js';
// Everything fits the screen, whatever its size: windows and popups are
// zoomed down (never up) until the whole of them shows, whenever one opens,
// its content changes or the screen does. (zoom rather than a transform: it
// lays out at the smaller size, so taps land where they look.) This works
// on top of the stylesheet's own small-screen zoom (scale.js), never
// instead of it.
const live = new Set();
let queued = false;
function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    for (const f of live) f();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', queue);
  // (a web font landing late reflows the text: fit again)
  document.fonts?.addEventListener?.('loadingdone', queue);
  document.fonts?.ready?.then(queue);
}
function watch(root, selector, fitOne) {
  const run = () => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)].forEach((el) => !el.hidden && el.isConnected && fitOne(el));
  live.add(run);
  new MutationObserver(queue).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  queue();
  return queue;
}
const baseZoom = (el) => parseFloat(getComputedStyle(el).zoom) || 1;

// popups: a box in the middle of the screen
export function watchPopups(root, selector, { margin = 10, min = 0.45 } = {}) {
  return watch(root, selector, (el) => {
    el.style.zoom = '';
    el.style.maxHeight = '';
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const base = baseZoom(el);
    const r = el.getBoundingClientRect();
    // (its whole content, in screen pixels, scrolled-off parts included)
    const h = Math.max(r.height, el.scrollHeight * (r.height / Math.max(1, el.clientHeight || r.height)));
    const w = Math.max(r.width, el.scrollWidth * (r.width / Math.max(1, el.clientWidth || r.width)));
    if (!h || !w) return;
    const k = Math.min(1, (window.innerHeight - margin * 2) / h, (window.innerWidth - margin * 2) / w);
    if (k < 0.995) {
      el.style.zoom = String(Math.max(min, Math.floor(base * k * 100) / 100));
      el.style.maxHeight = 'none'; // (zoomed to fit whole: no inner scrolling)
    }
  });
}

// windows: full-screen layers whose panels must all show. Shrunk with a
// scale transform (not CSS zoom: browsers disagree on how zoomed sizes are
// reported, Safari above all, and a fitter that trusts the wrong numbers
// squashes the screen into a corner). Measured at true size first, then
// scaled by the small-screen factor or whatever more it takes to fit, and
// laid out that much bigger so it still covers exactly the screen.
// el.dataset.scale holds the factor (screen px = layer px x scale).
export function watchScreens(root, selector, { margin = 6, min = 0.4 } = {}) {
  return watch(root, selector, (el) => {
    for (const p of ['transform', 'transformOrigin', 'width', 'height', 'right', 'bottom', 'zoom']) el.style[p] = '';
    if (getComputedStyle(el).display === 'none') return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    // true size: no scaling, exactly the screen
    // (border-box: its padding inside that size, not added on)
    Object.assign(el.style, { transform: 'none', zoom: '1', boxSizing: 'border-box', width: `${W}px`, height: `${H}px`, right: 'auto', bottom: 'auto' });
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    for (const c of el.children) {
      if (c.hidden || getComputedStyle(c).position === 'fixed') continue;
      const b = c.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      top = Math.min(top, b.top);
      bottom = Math.max(bottom, b.bottom);
      left = Math.min(left, b.left);
      right = Math.max(right, b.right);
    }
    let z = uiZoom();
    if (top !== Infinity) {
      const k = Math.min((H - margin * 2) / (bottom - top), (W - margin * 2) / (right - left));
      if (k < 1) z = Math.min(z, k * 0.97);
    }
    z = Math.max(min, Math.min(1, z));
    el.dataset.scale = String(z);
    Object.assign(el.style, { transform: z < 0.999 ? `scale(${z})` : 'none', transformOrigin: '0 0', width: `${W / z}px`, height: `${H / z}px` });
  });
}
