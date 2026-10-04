// Two small HUD pieces shared by the game and the model viewer:
//  - the ammo strip: a row of pixel shells that empties as the gun fires,
//    turns red when nearly empty, and refills one shell at a time on a reload
//    (each slot dark, then filling up, then a white flash as it's loaded).
//    A single-shot gun is one shell that fills while it reloads.
//  - passive icons: small, not pressable; the part's picture with a cooldown
//    shade and timer, a pulse when the perk goes off.

// Shell pixel art: t tip, b band, h casing highlight, c casing, r rim.
const SHELLS = {
  small: { rows: ['.t.', 'ttt', 'bbb', 'hcc', 'hcc', 'hcc', 'rrr'], gap: 1, scale: 2 },
  big: { rows: ['..t..', '.ttt.', 'ttttt', 'ttttt', 'bbbbb', 'hcccc', 'hcccc', 'hcccc', 'hcccc', 'hcccc', 'hcccc', 'hcccc', 'rrrrr'], gap: 2, scale: 2 },
};
const INK = {
  lit: { t: '#d8d2c4', b: '#8a5a1c', h: '#ffe2a0', c: '#ffb347', r: '#c97f2a' },
  low: { t: '#d8d2c4', b: '#7a1a14', h: '#ff9a8a', c: '#ff4a3a', r: '#a8241c' },
  empty: { t: '#2b2729', b: '#2b2729', h: '#2b2729', c: '#2b2729', r: '#2b2729' },
  flash: { t: '#ffffff', b: '#ffffff', h: '#ffffff', c: '#ffffff', r: '#ffffff' },
};
const FLASH_MS = 140;

// size: 'small' (under the reticle) or 'big' (the HP panel)
export function createAmmoStrip(size = 'big') {
  const S = SHELLS[size];
  const W = S.rows[0].length;
  const H = S.rows.length;
  injectCss();
  // a wrapper: the shells, or (a big magazine with more than ten left) the
  // count as a number
  const el = document.createElement('span');
  el.className = `ammo-strip ${size}`;
  const c = document.createElement('canvas');
  const num = document.createElement('b');
  num.className = 'ammo-num';
  num.style.display = 'none';
  el.append(c, num);
  const g = c.getContext('2d');
  let key = '';
  let lastLit = -1;
  let lastMax = -1;
  const flashUntil = [];

  function shell(x0, inkFor) {
    // a black edge first so it reads over anything
    g.fillStyle = '#000';
    S.rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && g.fillRect(x0 + x - 1, y, 3, 3)));
    S.rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        g.fillStyle = inkFor(y)[ch];
        g.fillRect(x0 + x + 0, y + 1, 1, 1);
      }),
    );
  }

  // n: rounds left, max: magazine size, load: 0..1 while reloading (null
  // otherwise). A single-shot gun: max 1, n 1 when ready.
  function set({ n, max, load = null }) {
    // more than ten rounds left: a number (reloading, the bar shows below)
    const big = max > 10;
    const asNumber = big && load == null && n > 10;
    num.style.display = asNumber ? '' : 'none';
    c.style.display = asNumber ? 'none' : ''; // (the page's canvas rule beats the hidden attribute)
    if (asNumber) {
      const t = String(n);
      if (num.textContent !== t) num.textContent = t;
      return;
    }
    if (big) {
      // ten shells stand for the last ten rounds (or, reloading, the fill)
      const shown = load == null ? n : null;
      return draw(Math.min(10, shown ?? 0), 10, load, false);
    }
    return draw(n, max, load, true);
  }
  function draw(n, max, load, lowRed) {
    const now = performance.now();
    // shells lit: the rounds left, or (reloading) the ones loaded so far
    const lit = load == null ? n : Math.min(max, Math.floor(load * max));
    if (max !== lastMax) {
      flashUntil.length = 0;
      lastLit = lit;
      lastMax = max;
    }
    if (lit > lastLit) for (let i = Math.max(0, lastLit); i < lit; i++) flashUntil[i] = now + FLASH_MS;
    lastLit = lit;
    const part = load == null ? 0 : load * max - lit; // the shell going in
    const low = load == null && max > 1 && (lowRed ? n <= Math.ceil(max * 0.3) : n <= 3);
    const flashing = flashUntil.some((t) => t > now);
    const k = `${n}|${max}|${lit}|${Math.round(part * H)}|${low}|${flashing ? now : 0}`;
    if (k === key) return;
    key = k;
    const w = max * (W + S.gap) - S.gap + 2;
    const h = H + 2;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      c.style.width = `${w * S.scale}px`;
      c.style.height = `${h * S.scale}px`;
    }
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < max; i++) {
      const x0 = 1 + i * (W + S.gap);
      if (flashUntil[i] > now) shell(x0, () => INK.flash);
      else if (i < lit) shell(x0, () => (low ? INK.low : INK.lit));
      else if (i === lit && part > 0) {
        // filling from the base up
        const fillRow = H - Math.round(part * H);
        shell(x0, (y) => (y >= fillRow ? INK.lit : INK.empty));
      } else shell(x0, () => INK.empty);
    }
  }
  return { el, set };
}

const CSS = `
.hud-passives { position: absolute; display: flex; flex-direction: row-reverse; gap: 8px; pointer-events: none; }
.hud-passives .pas { position: relative; width: 52px; height: 40px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; display: grid; place-items: center; }
.hud-passives .pas img { width: 48px; height: 32px; image-rendering: pixelated; }
.hud-passives .pas .shade { position: absolute; left: 0; right: 0; top: 0; background: #000000b0; }
.hud-passives .pas .t { position: absolute; inset: 0; display: grid; place-items: center; font: 400 15px/1 'Silkscreen', monospace; color: #f1e9d8; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000; }
.hud-passives .pas .nm { position: absolute; left: 50%; top: calc(100% + 6px); transform: translateX(-50%); font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b3a8; text-shadow: 1px 1px 0 #000; white-space: nowrap; }
.hud-passives .pas.ready { box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffb347, 0 0 10px #ffb34788; }
.hud-passives .pas.pop { animation: pasPop 0.4s steps(4); }
@keyframes pasPop { 0% { transform: scale(1.35); box-shadow: 0 0 0 2px #000, 0 0 0 4px #fff, 0 0 18px #fff; } 100% { transform: scale(1); } }
`;
let injected = false;
let ammoCss = false;
function injectCss() {
  if (ammoCss) return;
  ammoCss = true;
  const st = document.createElement('style');
  // (the page styles every canvas full-screen: not these)
  st.textContent = `.ammo-strip { display: inline-flex; align-items: center; } .ammo-strip canvas { position: static; inset: auto; display: block; image-rendering: pixelated; }
.ammo-num { font: 400 15px/1 'Silkscreen', monospace; color: #ffb347; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000; font-variant-numeric: tabular-nums; }
.ammo-strip.big .ammo-num { font-size: 18px; }`;
  document.head.append(st);
}

// Passive icons: set(list) each frame, list = [{ id, name, img, k (0..1
// recharged), left (seconds, shown while recharging), ready (armed), pulse
// (a counter: bump it when the perk goes off) }]
export function createPassives() {
  if (!injected) {
    injected = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
  }
  const el = document.createElement('div');
  el.className = 'hud-passives';
  const tiles = new Map();
  let ids = '';
  function set(list) {
    const now = list.map((p) => p.id).join(',');
    if (now !== ids) {
      ids = now;
      el.textContent = '';
      tiles.clear();
      for (const p of list) {
        const t = document.createElement('div');
        t.className = 'pas';
        t.innerHTML = `<img alt=""><i class="shade"></i><span class="t"></span><span class="nm"></span>`;
        el.append(t);
        tiles.set(p.id, { t, img: t.querySelector('img'), shade: t.querySelector('.shade'), txt: t.querySelector('.t'), nm: t.querySelector('.nm'), pulse: p.pulse || 0, src: '' });
      }
    }
    for (const p of list) {
      const o = tiles.get(p.id);
      if (p.img && o.src !== p.img) o.img.src = o.src = p.img;
      if (o.nm.textContent !== p.name) o.nm.textContent = p.name;
      const k = p.k ?? 1;
      o.shade.style.height = `${Math.round((1 - Math.min(1, k)) * 100)}%`;
      const txt = p.left > 0.05 && k < 1 ? String(Math.ceil(p.left)) : '';
      if (o.txt.textContent !== txt) o.txt.textContent = txt;
      o.t.classList.toggle('ready', !!p.ready);
      if ((p.pulse || 0) !== o.pulse) {
        o.pulse = p.pulse || 0;
        o.t.classList.remove('pop');
        void o.t.offsetWidth;
        o.t.classList.add('pop');
      }
    }
  }
  return { el, set };
}
