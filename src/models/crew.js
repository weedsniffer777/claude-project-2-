// A tank crewman for the base: a stocky, blocky figure in a padded olive
// jacket and a padded tanker's helmet, so he reads at the game's pixel size.
// A stand-in until there's a proper character; +X is forward. The legs and
// arms swing while he walks.
import * as THREE from 'three';
import { box, put } from './kit.js';

const C = {
  jacket: 0x5f6b46,
  jacketDark: 0x4a553a,
  trousers: 0x3b3d38,
  boots: 0x1f1f20,
  skin: 0xc49a7a,
  helmet: 0x2f2b26,
  goggles: 0x8fa4a8,
  belt: 0x4a3a2a,
};

export function createCrew() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking
  group.add(body);
  const hips = 0.62;

  // legs on hip pivots
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(0, hips, s * 0.11);
    put(hip, box(0.15, 0.36, 0.14, C.trousers, { r: 0.03 }), 0, -0.2, 0);
    put(hip, box(0.14, 0.26, 0.13, C.trousers, { r: 0.03 }), 0, -0.45, 0);
    put(hip, box(0.24, 0.1, 0.15, C.boots, { r: 0.03 }), 0.04, -0.6, 0);
    body.add(hip);
    return hip;
  });
  // torso: padded jacket, belt, a map case on the hip
  put(body, box(0.3, 0.42, 0.42, C.jacket, { r: 0.07 }), 0, hips + 0.25, 0);
  put(body, box(0.31, 0.06, 0.43, C.belt, { r: 0.02 }), 0, hips + 0.06, 0);
  put(body, box(0.16, 0.14, 0.05, C.jacketDark, { r: 0.02 }), 0.02, hips + 0.04, 0.24);
  put(body, box(0.24, 0.1, 0.44, C.jacketDark, { r: 0.03 }), 0, hips + 0.47, 0); // collar
  // head: face, the padded helmet with its ribs and ear flaps, goggles up top
  const head = new THREE.Group();
  head.position.y = hips + 0.66;
  body.add(head);
  put(head, box(0.2, 0.2, 0.2, C.skin, { r: 0.05 }), 0.02, 0, 0);
  put(head, box(0.25, 0.14, 0.25, C.helmet, { r: 0.06 }), -0.01, 0.1, 0);
  for (const z of [-0.06, 0, 0.06]) put(head, box(0.26, 0.04, 0.03, 0x24211d, { r: 0.01 }), -0.01, 0.15, z);
  for (const s of [-1, 1]) put(head, box(0.12, 0.14, 0.04, C.helmet, { r: 0.02 }), -0.01, -0.03, s * 0.12);
  put(head, box(0.05, 0.05, 0.22, C.goggles, { r: 0.02 }), 0.12, 0.13, 0);
  // arms on shoulder pivots
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(0, hips + 0.42, s * 0.26);
    put(sh, box(0.13, 0.3, 0.12, C.jacket, { r: 0.04 }), 0, -0.15, 0);
    put(sh, box(0.11, 0.18, 0.11, C.jacketDark, { r: 0.03 }), 0, -0.36, 0);
    put(sh, box(0.09, 0.08, 0.09, C.skin, { r: 0.02 }), 0, -0.48, 0);
    body.add(sh);
    return sh;
  });

  let phase = 0;
  // speed: 0..1 of a walk
  function update(dt, t, speed = 0) {
    phase += dt * (3 + speed * 9);
    const swing = Math.sin(phase) * 0.7 * speed;
    legs[0].rotation.z = swing;
    legs[1].rotation.z = -swing;
    arms[0].rotation.z = -swing * 0.8;
    arms[1].rotation.z = swing * 0.8;
    body.position.y = Math.abs(Math.sin(phase)) * 0.04 * speed + Math.sin(t * 2) * 0.005;
    head.rotation.z = Math.sin(t * 0.7) * 0.04 * (1 - speed);
  }
  return { group, update };
}
