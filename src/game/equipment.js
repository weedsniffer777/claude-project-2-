// Equipment: one active item per tank, on Q, swapped in the hangar only.
// Not parts: no tiers, no slots, found as level rewards. Their pictures are
// pixel icons on a cyan tile with cut corners (parts are pictures of the
// part in a square frame), so the two never get mixed up.

import { artilleryCanvas, atgmCanvas, shieldCanvas } from '../ui/icons.js';

export const EQUIPMENT = {
  artillery: {
    name: 'Artillery strike',
    text: 'Press Q, then click a spot: a barrage of shells lands there.',
    // the numbers: [label, value, good]
    rows: [['Damage', '6 × 70', true], ['Area', 'Wide', true], ['Hits', 'Through cover', true], ['Delay', '1.5 s', false], ['Recharge', '15 s', false]],
    cooldown: 15,
    delay: 1.5, // seconds from the call to the first shell
    shells: 6,
    radius: 3.6, // where the shells fall around the spot
    blast: 3.3, // each shell's splash
    damage: 70,
    art: () => artilleryCanvas(2), // red impact rings, shells streaking in, explosions
  },
  atgm: {
    name: 'Guided missile',
    text: 'Press Q: it locks on to the three toughest enemies in range by itself and fires a missile at each.',
    rows: [['Damage', '3 × 90', true], ['Blast', 'Big', true], ['Aim', 'Locks on by itself', true], ['Recharge', '12 s', false], ['Range', 'Needs targets nearby', false]],
    cooldown: 12,
    missiles: 3,
    lockTime: 1.2, // seconds locked on (boxes blinking) before the first fires: a beat to savour it
    salvoGap: 0.16,
    range: 14, // a circle round the tank, a bit inside what you can see (wider with Optics)
    damage: 90,
    blast: 3.0,
    speed: 30, // top speed, units/s
    art: () => atgmCanvas(2), // a missile on its smoke trail into a lock box
  },
  shield: {
    name: 'Shield',
    text: 'Press Q: a curved energy shield goes up in front of the turret and stops every shot that hits it. It turns with the turret.',
    rows: [['Blocks', 'All shots from the front', true], ['Lasts', '4 s', true], ['Shells from above', 'Not blocked', false], ['Recharge', '18 s', false]],
    cooldown: 18,
    time: 4, // seconds it's up
    radius: 3.1, // out from the tank's middle
    height: 2.2,
    art: () => shieldCanvas(2), // a tank behind its curved shield, rounds bursting on it
  },
};

// the description as HTML: how it works, then green and red rows
export function equipmentHtml(id) {
  const e = EQUIPMENT[id];
  if (!e) return '';
  const rows = (e.rows || []).map(([l, v, good]) => `<div class="fx-row"><span>${l}</span><b class="${good ? 'good' : 'bad'}">${good ? '+' : '−'} ${v}</b></div>`).join('');
  return `<div class="fx-how">${e.text}</div>${rows}`;
}
// ... as plain text (a title attribute)
export const equipmentPlain = (id) => {
  const e = EQUIPMENT[id];
  return e ? [e.text, ...(e.rows || []).map(([l, v, good]) => `${good ? '+' : '−'} ${l}: ${v}`)].join('\n') : '';
};

const pics = new Map();
const canvases = new Map();
// the icon on its tile, as a data URL
export function equipmentIcon(id, W = 64, H = 48) {
  const key = `${id}|${W}|${H}`;
  if (!pics.has(key)) pics.set(key, equipmentCanvas(id, W, H).toDataURL());
  return pics.get(key);
}
// the art alone, no tile (the HUD button has its own frame)
const squares = new Map();
export function equipmentArt(id) {
  const art = EQUIPMENT[id]?.art?.();
  if (!art) return null;
  // squared up (the buttons draw it in a square), centred
  if (!squares.has(id)) {
    const n = Math.max(art.width, art.height);
    const c = document.createElement('canvas');
    c.width = c.height = n;
    c.getContext('2d').drawImage(art, (n - art.width) / 2, (n - art.height) / 2);
    squares.set(id, c);
  }
  return squares.get(id);
}
// ... and on its tile, as a canvas
export function equipmentCanvas(id, W = 64, H = 48) {
  const key = `${id}|${W}|${H}`;
  if (canvases.has(key)) return canvases.get(key);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  // the tile: dark teal, cut corners, a cyan edge
  const cut = Math.round(Math.min(W, H) * 0.16);
  const tile = (inset, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(inset + cut, inset);
    g.lineTo(W - inset - cut, inset);
    g.lineTo(W - inset, inset + cut);
    g.lineTo(W - inset, H - inset - cut);
    g.lineTo(W - inset - cut, H - inset);
    g.lineTo(inset + cut, H - inset);
    g.lineTo(inset, H - inset - cut);
    g.lineTo(inset, inset + cut);
    g.closePath();
    g.fill();
  };
  tile(0, '#5fe6ff');
  tile(2, '#10262b');
  const art = EQUIPMENT[id]?.art?.();
  if (art) {
    // fitted inside the tile, whole pixels
    const k = Math.min((W - 6) / art.width, (H - 6) / art.height);
    const w = art.width * k;
    const h = art.height * k;
    g.imageSmoothingEnabled = false;
    g.drawImage(art, Math.round((W - w) / 2), Math.round((H - h) / 2), w, h);
  }
  canvases.set(key, c);
  return c;
}
