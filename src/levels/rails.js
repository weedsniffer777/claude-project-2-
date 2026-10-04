// Tram rails set in the road: steel rails standing a little proud of a dark
// groove, a section missing here and there. The way roads show wear in this
// city (no painted rut lines). Shared by the levels.
//
//   const R = rails(B, rand);
//   R.track(R.straight(x0, z0, x1, z1));             // a straight run
//   R.track([...R.bend(p0, c, p2), ...R.straight(...)]) // round a corner
//   y: the road's height there (a bridge deck, a ramp), (x, z) => number
export function rails(B, rand, { gauge = 0.55, y = () => 0 } = {}) {
  const rail = (a, b, groove = true) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const yaw = -Math.atan2(dz, dx);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const h = y(mx, mz);
    if (groove) B.piece(len + 0.02, 0.012, 0.2, 0x2a2b2f, mx, h + 0.008, mz, 0, yaw, 0);
    B.piece(len + 0.02, 0.05, 0.07, 0x8d9196, mx, h + 0.03, mz, 0, yaw, 0);
  };
  // a track along a centreline polyline: two rails either side
  const track = (pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = -(b.z - a.z) / len;
      const nz = (b.x - a.x) / len;
      for (const s of [-1, 1]) {
        if (rand() < 0.04) continue; // a missing section
        rail({ x: a.x + nx * gauge * s, z: a.z + nz * gauge * s }, { x: b.x + nx * gauge * s, z: b.z + nz * gauge * s });
      }
    }
  };
  const straight = (x0, z0, x1, z1, step = 3) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, z: z0 + ((z1 - z0) * i) / n });
    return pts;
  };
  const bend = (p0, c, p2, n = 14) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x, z: (1 - t) ** 2 * p0.z + 2 * (1 - t) * t * c.z + t * t * p2.z });
    }
    return pts;
  };
  return { track, straight, bend };
}
