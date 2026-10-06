// Popups that always fit the screen: every element under root matching
// selector, whenever it shows, changes or the screen does, is zoomed down
// (never up) until the whole of it fits inside the viewport with a margin.
// (zoom rather than a transform: it lays out at the smaller size, so taps
// land where they look.)
export function watchPopups(root, selector, { margin = 10, min = 0.5 } = {}) {
  let queued = false;
  const fitOne = (el) => {
    if (el.hidden || !el.isConnected || !el.offsetParent) return;
    el.style.zoom = '';
    el.style.maxHeight = '';
    const r = el.getBoundingClientRect();
    const h = Math.max(el.scrollHeight, r.height);
    const w = Math.max(el.scrollWidth, r.width);
    if (!h || !w) return;
    const k = Math.min(1, (window.innerHeight - margin * 2) / h, (window.innerWidth - margin * 2) / w);
    if (k < 0.995) {
      el.style.zoom = String(Math.max(min, Math.floor(k * 100) / 100));
      el.style.maxHeight = 'none'; // (zoomed to fit whole: no inner scrolling)
    }
  };
  const fitAll = () => {
    queued = false;
    root.querySelectorAll(selector).forEach(fitOne);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(fitAll);
  };
  new MutationObserver(queue).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  window.addEventListener('resize', queue);
  queue();
  return queue;
}
