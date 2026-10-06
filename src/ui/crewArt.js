// The crew's rank chevrons.
// The rank: chevrons (and a rocker underneath for PFC and Staff Sergeant),
// yellow edged green. rank 0..4.
const LAYOUT = [
  { chev: 1, rocker: false },
  { chev: 1, rocker: true },
  { chev: 2, rocker: false },
  { chev: 3, rocker: false },
  { chev: 3, rocker: true },
];
export function rankIcon(rank) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 36;
  const g = c.getContext('2d');
  const { chev, rocker } = LAYOUT[rank];
  const y0 = 6 + (3 - chev) * 3 + (rocker ? 0 : 4);
  const stroke = (draw) => {
    for (const [col, w] of [['#2f4a1e', 7], ['#f2d23a', 4]]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineJoin = 'miter';
      g.beginPath();
      draw();
      g.stroke();
    }
  };
  for (let i = 0; i < chev; i++) {
    const y = y0 + i * 7;
    stroke(() => {
      g.moveTo(4, y + 10);
      g.lineTo(16, y);
      g.lineTo(28, y + 10);
    });
  }
  if (rocker) {
    const y = y0 + (chev - 1) * 7 + 15;
    stroke(() => {
      g.moveTo(4, y);
      g.quadraticCurveTo(16, y + 9, 28, y);
    });
  }
  return c;
}
