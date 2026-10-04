// The guided missile launcher, when a tank carries the missiles: its own
// look on each tank, and where the missiles come out.
//  - the battle tank: a launch tube on a bracket on the turret's left side,
//    behind the reactive armour, angled up
//  - the light tank: the plain bin on the turret's right side becomes an
//    open-topped tub with the tube stowed flat inside it; it swings up to
//    fire and lies back down after
// Any other tank: nothing to see, the missiles leave from its turret roof.
// Returns { group, mouth (an Object3D at the tube's muzzle, its +x the way
// out), raise(k) (0 stowed .. 1 up) } or null.
import * as THREE from 'three';
import { box, cyl, put } from './kit.js';

const C = {
  tube: 0x5f6b48,
  dark: 0x2b2d30,
  band: 0xc99a2e,
  inside: 0x1d1f22,
  bin: 0x4a5731,
};

// a launch tube along +x from its back end: olive, a darker cap at each
// end, a yellow band, a sight box on its side
function tube(len = 1.1, r = 0.09) {
  const g = new THREE.Group();
  put(g, cyl(r, len, C.tube, { axis: 'x', seg: 10 }), len / 2, 0, 0);
  put(g, cyl(r + 0.02, 0.08, C.dark, { axis: 'x', seg: 10 }), 0.04, 0, 0);
  put(g, cyl(r + 0.02, 0.08, C.dark, { axis: 'x', seg: 10 }), len - 0.04, 0, 0);
  put(g, cyl(r + 0.005, 0.05, C.band, { axis: 'x', seg: 10 }), len * 0.7, 0, 0);
  put(g, cyl(r * 0.7, 0.02, C.inside, { axis: 'x', seg: 10 }), len + 0.001, 0, 0); // the dark mouth
  put(g, box(0.16, 0.1, 0.08, C.dark, { r: 0.015 }), len * 0.4, 0, -(r + 0.05));
  const mouth = new THREE.Object3D();
  mouth.position.x = len + 0.05;
  g.add(mouth);
  return { g, mouth };
}

export function buildLauncher(tank) {
  if (!tank?.turret || tank.missile) return null; // (the missile tank fires them from its own pack)
  if (tank.kind === 'light') {
    // the tub: the right side's back bin, its lid off and its sides built
    // up into an open-topped tub
    const W = 0.66;
    const D = 0.4;
    const H = 0.24;
    const g = new THREE.Group();
    g.position.set(-0.38, 0.49 + H / 2, 0.65);
    tank.turret.add(g);
    put(g, box(W, 0.04, D, C.bin, { r: 0.01 }), 0, -H / 2 + 0.02, 0);
    for (const s of [-1, 1]) {
      put(g, box(W, H, 0.04, C.bin, { r: 0.01 }), 0, 0, s * (D / 2 - 0.02));
      put(g, box(0.04, H, D, C.bin, { r: 0.01 }), s * (W / 2 - 0.02), 0, 0);
    }
    put(g, box(W - 0.08, 0.02, D - 0.08, C.inside), 0, -H / 2 + 0.05, 0); // the dark inside
    for (const x of [-0.18, 0.18]) put(g, box(0.03, H + 0.01, D + 0.01, C.dark), x, 0, 0); // straps
    // the tube, hinged at its back end, lying in the tub
    const pivot = new THREE.Group();
    pivot.position.set(-W / 2 + 0.06, -H / 2 + 0.14, 0);
    g.add(pivot);
    const t = tube(0.6, 0.075);
    pivot.add(t.g);
    let k = 0;
    return {
      group: g,
      mouth: t.mouth,
      raise(target, dt = 1) {
        k += (target - k) * Math.min(1, dt * 8);
        pivot.rotation.z = k * 0.75;
      },
    };
  }
  // the battle tank: on a bracket on the turret's left, behind the armour
  const g = new THREE.Group();
  const a = -1.95; // round the turret, back and to the left
  g.position.set(Math.cos(a) * 0.98 * 1.08, 0.36, Math.sin(a) * 0.98);
  tank.turret.add(g);
  put(g, box(0.3, 0.22, 0.12, C.dark, { r: 0.02 }), 0.1, -0.05, 0.12); // the bracket, against the turret
  put(g, box(0.06, 0.18, 0.06, C.dark, { r: 0.01 }), 0.2, 0.08, 0.04);
  const t = tube(1.15, 0.1);
  t.g.position.set(-0.35, 0.16, -0.04);
  t.g.rotation.z = 0.3; // angled up
  g.add(t.g);
  return { group: g, mouth: t.mouth, raise() {} };
}
