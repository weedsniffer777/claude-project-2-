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
if (typeof window !== 'undefined') window.addEventListener('resize', queue);
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

// windows: full-screen layers whose panels must all show; zoomed out
// (and sized back to exactly the screen) till the panels fit. (Sized by
// measuring, not with viewport units: those don't come out right inside a
// zoomed element.)
export function watchScreens(root, selector, { margin = 6, min = 0.4 } = {}) {
  return watch(root, selector, (el) => {
    for (const p of ['zoom', 'width', 'height', 'right', 'bottom']) el.style[p] = '';
    if (getComputedStyle(el).display === 'none') return;
    let z = baseZoom(el);
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (let pass = 0; pass < 5; pass++) {
      // the layer itself: exactly the screen
      const r = el.getBoundingClientRect();
      if (Math.abs(r.height - H) > 1 || Math.abs(r.width - W) > 1) {
        const cs = getComputedStyle(el);
        el.style.height = `${(parseFloat(cs.height) * H) / r.height}px`;
        el.style.width = `${(parseFloat(cs.width) * W) / r.width}px`;
        el.style.right = el.style.bottom = 'auto';
        continue;
      }
      // the panels' extent on screen
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
      if (top === Infinity) return;
      if (top >= margin - 1 && bottom <= H - margin + 1 && left >= margin - 1 && right <= W - margin + 1) return;
      if (z <= min) return;
      const k = Math.min(1, (H - margin * 2) / (bottom - top), (W - margin * 2) / (right - left)) * 0.97;
      z = Math.max(min, z * k);
      el.style.zoom = String(z);
    }
  });
}
