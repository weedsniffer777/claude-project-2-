// Equipment: one active item per tank, on Q, swapped in the hangar only.
// Not parts: no tiers, no slots, found as level rewards. Their pictures are
// pixel icons on a cyan tile with cut corners (parts are pictures of the
// part in a square frame), so the two never get mixed up.

export const EQUIPMENT = {
  artillery: {
    name: 'Artillery strike',
    text: 'Press Q and pick a spot: 1.5 s later six shells land there, 70 damage each. Recharges in 30 s.',
    cooldown: 30,
    delay: 1.5, // seconds from the call to the first shell
    shells: 6,
    radius: 3.4, // where the shells fall around the spot
    blast: 2.6, // each shell's splash
    damage: 70,
    // 16x12 pixel art: shells coming down on a target ring
    icon: [
      '..#.......#.....',
      '.#+#.....#+#....',
      '.#+#.....#+#....',
      '.###.....###....',
      '..-.......-.....',
      '....------......',
      '...-......-.....',
      '..-...**...-....',
      '..-..****..-....',
      '..-...**...-....',
      '...-......-.....',
      '....------......',
    ],
  },
};

const INK = { '#': '#f1e9d8', '+': '#ffb347', '-': '#5fe6ff', '*': '#ffffff' };
const pics = new Map();
const canvases = new Map();
// the icon on its tile, as a data URL
export function equipmentIcon(id, W = 64, H = 48) {
  const key = `${id}|${W}|${H}`;
  if (!pics.has(key)) pics.set(key, equipmentCanvas(id, W, H).toDataURL());
  return pics.get(key);
}
// ... and as a canvas (the HUD button draws it)
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
  const rows = EQUIPMENT[id]?.icon || [];
  const px = Math.max(1, Math.floor(Math.min((W - 8) / 16, (H - 8) / 12)));
  const ox = Math.round((W - 16 * px) / 2);
  const oy = Math.round((H - rows.length * px) / 2);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!INK[ch]) return;
      g.fillStyle = INK[ch];
      g.fillRect(ox + x * px, oy + y * px, px, px);
    }),
  );
  canvases.set(key, c);
  return c;
}
