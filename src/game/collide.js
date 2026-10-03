// 2D oriented-box collisions on the ground plane. A box is
// { x, z, hx, hz, yaw }: centre, half extents along its own axes, heading.
const axesOf = (yaw) => [
  [Math.cos(yaw), -Math.sin(yaw)],
  [Math.sin(yaw), Math.cos(yaw)],
];

// Separating-axis test. Returns the push { x, z, overlap } that moves a out
// of b, or null when they don't touch.
export function separate(a, b) {
  const axA = axesOf(a.yaw);
  const axB = axesOf(b.yaw);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let best = null;
  for (const [ux, uz] of [...axA, ...axB]) {
    const ra = a.hx * Math.abs(axA[0][0] * ux + axA[0][1] * uz) + a.hz * Math.abs(axA[1][0] * ux + axA[1][1] * uz);
    const rb = b.hx * Math.abs(axB[0][0] * ux + axB[0][1] * uz) + b.hz * Math.abs(axB[1][0] * ux + axB[1][1] * uz);
    const dist = dx * ux + dz * uz;
    const overlap = ra + rb - Math.abs(dist);
    if (overlap <= 0) return null;
    if (!best || overlap < best.overlap) best = { overlap, x: -Math.sign(dist) * ux, z: -Math.sign(dist) * uz };
  }
  return best;
}

// Push box (built by makeBox from pos) out of every nearby block. Moves pos
// in place; returns true on contact.
export function pushOut(pos, makeBox, blocks, passes = 2) {
  let hit = false;
  for (let pass = 0; pass < passes; pass++) {
    for (const b of blocks) {
      const reach = 3 + Math.max(b.hx, b.hz);
      if (Math.abs(b.x - pos.x) > reach || Math.abs(b.z - pos.z) > reach) continue;
      const push = separate(makeBox(), b);
      if (!push) continue;
      pos.x += push.x * push.overlap;
      pos.z += push.z * push.overlap;
      hit = true;
    }
  }
  return hit;
}
