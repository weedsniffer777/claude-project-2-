// The bridge gun: level 2's boss. A heavy anti-tank gun dug in at the far
// end of the bridge: a concrete ring and sandbags, a squat armoured turret
// on top with a very long barrel, a red sensor array. It doesn't walk; the
// turret turns (ctx.aimYaw) and the barrel glows hotter as it charges
// (ctx.charge). Same interface as the other machines.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  concrete: 0x7d7a74,
  sand: 0x8a7b5c,
  hull: 0x3f4348,
  panel: 0x5a6066,
  dark: 0x1f2124,
  gun: 0x2a2c30,
  eye: 0xff2a1f,
  dead: 0x2a1614,
};

export function createBridgeGun() {
  const group = new THREE.Group();
  // the emplacement: a concrete ring, sandbags stacked round it
  put(group, cyl(1.6, 0.6, C.concrete, { seg: 16 }), 0, 0.3, 0);
  put(group, cyl(1.3, 0.08, C.dark, { seg: 16 }), 0, 0.62, 0);
  // sandbags heaped round it, not laid out: each a little off, some slumped,
  // the rows uneven, colours varying
  const jit = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5; // -0.5..0.5, fixed per bag
  const SAND = [C.sand, 0x7d6f52, 0x968566, 0x857656];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + jit(i, 0) * 0.12;
    if (Math.cos(a) > 0.62) continue; // the front is open for the gun
    const rows = 2 + (jit(i, 1) > 0.1 ? 1 : 0);
    for (let k = 0; k < rows; k++) {
      const r = 1.82 + jit(i, k + 2) * 0.12 + k * -0.05;
      const bag = put(group, box(0.5 + jit(i, k) * 0.08, 0.2, 0.3, SAND[(i + k) % 4], { r: 0.09 }), Math.cos(a + k * 0.14) * r, 0.11 + k * 0.19, Math.sin(a + k * 0.14) * r);
      bag.rotation.set(jit(i, k + 5) * 0.25, -a + jit(i, k + 3) * 0.35, jit(i, k + 7) * 0.2);
    }
  }
  // the turret: a squat armoured block that turns
  const turret = new THREE.Group();
  turret.position.y = 0.66;
  group.add(turret);
  put(turret, box(1.7, 0.75, 1.5, C.hull, { r: 0.08 }), -0.1, 0.38, 0);
  put(turret, box(0.6, 0.6, 1.4, C.hull, { r: 0.08 }), 0.75, 0.35, 0).rotation.z = -0.4; // sloped glacis
  put(turret, box(1.3, 0.08, 1.2, C.panel, { r: 0.02 }), -0.2, 0.79, 0);
  for (const s of [-1, 1]) put(turret, box(1.2, 0.5, 0.05, C.panel, { r: 0.02 }), -0.1, 0.4, s * 0.78); // side plates
  put(turret, box(0.5, 0.35, 0.6, C.dark, { r: 0.04 }), -0.9, 0.5, 0); // ammo bustle
  // the sensor array: a row of red lenses in a dark housing
  put(turret, box(0.3, 0.22, 0.7, C.dark, { r: 0.03 }), 0.3, 0.95, -0.3);
  const lenses = [];
  for (const z of [-0.5, -0.3, -0.1]) lenses.push(put(turret, cyl(0.06, 0.04, C.eye, { axis: 'x', seg: 8, glow: true }), 0.46, 0.96, z));
  // the gun: mantlet, a very long barrel, a big muzzle brake
  const gun = new THREE.Group();
  gun.position.set(0.9, 0.42, 0.15);
  turret.add(gun);
  put(gun, box(0.35, 0.45, 0.5, C.panel, { r: 0.05 }), 0, 0, 0);
  put(gun, cyl(0.11, 3.4, C.gun, { axis: 'x', seg: 10 }), 1.8, 0, 0);
  put(gun, cyl(0.15, 0.5, C.gun, { axis: 'x', seg: 10 }), 0.4, 0, 0); // thick base of the barrel
  put(gun, box(0.3, 0.22, 0.3, C.dark, { r: 0.03 }), 3.55, 0, 0); // muzzle brake
  const muzzleGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  muzzleGlow.position.set(3.75, 0, 0);
  muzzleGlow.userData.outline = true;
  gun.add(muzzleGlow);
  const antenna = put(turret, cyl(0.015, 1.4, C.dark, { seg: 4 }), -0.8, 1.4, 0.5);

  // --- detail: the emplacement
  put(group, cyl(1.68, 0.1, 0x8d8a83, { seg: 16 }), 0, 0.62, 0); // the ring's worn lip
  for (const a of [2.2, 2.9, 3.6, 4.1]) put(group, cyl(0.025, 0.35, 0x5a4a3c, { seg: 4 }), Math.cos(a) * 1.55, 0.75, Math.sin(a) * 1.55).rotation.z = 0.3; // rebar stubs
  // ammo crates stacked behind, a generator with its exhaust, cables
  for (const [x, z, y, yaw] of [[-2.5, 0.9, 0.2, 0.2], [-2.6, 1.6, 0.2, 0.1], [-2.55, 1.2, 0.6, 0.35]]) {
    const crate = put(group, box(0.7, 0.4, 0.45, 0x55603f, { r: 0.03 }), x, y, z);
    crate.rotation.y = yaw;
    put(crate, box(0.72, 0.05, 0.47, 0x434c32, { r: 0.01 }), 0, 0.2, 0);
    put(crate, box(0.08, 0.1, 0.48, 0x2b2d30, { r: 0.01 }), 0.2, 0, 0);
  }
  put(group, box(0.8, 0.6, 0.6, 0x4a5058, { r: 0.05 }), -2.4, 0.3, -1.1); // generator
  put(group, box(0.6, 0.06, 0.5, 0x2b2d30, { r: 0.01 }), -2.4, 0.62, -1.1);
  for (let i = 0; i < 4; i++) put(group, box(0.03, 0.04, 0.5, 0x1f2124, { r: 0 }), -1.99, 0.15 + i * 0.1, -1.1); // vent slats
  put(group, cyl(0.05, 0.5, 0x2a2c30, { seg: 6 }), -2.6, 0.85, -1.25); // exhaust
  for (let i = 0; i < 6; i++) put(group, box(0.6, 0.05, 0.05, 0x1d1f22, { r: 0.02 }), -1.85 + i * 0.32, 0.03, -0.9 - Math.sin(i) * 0.1).rotation.y = Math.sin(i * 1.7) * 0.4; // the cable to the gun
  // spent cases round the front of the pit
  for (let i = 0; i < 9; i++) {
    const a = 0.9 + i * 0.5;
    const r = 2.3 + (i % 3) * 0.3;
    const cs = put(group, cyl(0.07, 0.42, 0xb08a3e, { axis: 'x', seg: 6 }), Math.cos(a) * r * 0.6 + 1.2, 0.07, Math.sin(a) * r * 0.7);
    cs.rotation.y = a * 2.3;
  }

  // --- detail: the turret
  for (const s of [-1, 1]) {
    // bolt rows along the side plates, smoke dischargers, grab rails
    for (let i = 0; i < 5; i++) put(turret, box(0.05, 0.05, 0.03, C.dark, { r: 0.01 }), -0.55 + i * 0.22, 0.6, s * 0.81);
    for (let i = 0; i < 3; i++) put(turret, cyl(0.05, 0.22, C.dark, { seg: 6 }), 0.1 + i * 0.12, 0.85, s * 0.66).rotation.x = s * 0.6;
    put(turret, box(0.7, 0.04, 0.04, C.panel, { r: 0.01 }), -0.3, 0.86, s * 0.7);
    // skirts low down, with a gap at the front
    put(turret, box(1.4, 0.24, 0.05, C.hull, { r: 0.02 }), -0.25, 0.06, s * 0.82);
  }
  // a roof hatch with its handle, rear vents
  put(turret, cyl(0.24, 0.06, C.panel, { seg: 10 }), -0.55, 0.84, 0.25);
  put(turret, box(0.18, 0.04, 0.03, C.dark, { r: 0.01 }), -0.55, 0.88, 0.25);
  for (let i = 0; i < 4; i++) put(turret, box(0.03, 0.04, 0.55, C.dark, { r: 0 }), -1.16, 0.32 + i * 0.09, 0);
  // the sensor mast: a pole with a head on it, the lens array below
  put(turret, cyl(0.04, 0.4, C.dark, { seg: 6 }), 0.1, 1.15, -0.3);
  put(turret, box(0.22, 0.14, 0.18, C.panel, { r: 0.03 }), 0.1, 1.38, -0.3);
  lenses.push(put(turret, box(0.02, 0.06, 0.12, C.eye, { r: 0.005, glow: true }), 0.22, 1.38, -0.3));

  // --- detail: the gun
  put(gun, cyl(0.17, 0.35, C.gun, { axis: 'x', seg: 10 }), 1.6, 0, 0); // fume extractor
  for (const x of [0.9, 2.3, 2.9]) put(gun, cyl(0.13, 0.07, C.panel, { axis: 'x', seg: 10 }), x, 0, 0); // thermal sleeve bands
  for (const z of [-0.08, 0.08]) put(gun, cyl(0.04, 0.9, C.panel, { axis: 'x', seg: 6 }), 0.75, 0.16, z); // recoil cylinders over it
  for (const x of [3.45, 3.57, 3.69]) put(gun, box(0.04, 0.32, 0.36, C.dark, { r: 0.01 }), x, 0, 0); // muzzle brake baffles
  put(turret, cyl(0.05, 0.45, C.panel, { seg: 6 }), 0.75, 0.2, -0.22).rotation.z = 0.5; // the elevating ram

  group.traverse((m) => {
    if (m.isMesh && !m.material.transparent) m.castShadow = true;
  });

  let flash = 0;
  let deadT = -1;
  const flashMats = new Map();

  function update(dt, t, ctx = {}) {
    if (deadT >= 0) {
      // the turret slumps, the barrel droops
      deadT += dt;
      const k = Math.min(1, deadT / 0.6);
      turret.rotation.z = -k * 0.18;
      turret.rotation.x = k * 0.1;
      gun.rotation.z = -k * 0.35;
      return;
    }
    const charge = ctx.charge ?? 0;
    let d = (ctx.aimYaw ?? 0) - turret.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    turret.rotation.y += d * Math.min(1, dt * 5);
    gun.rotation.z = THREE.MathUtils.clamp(ctx.aimPitch ?? 0, -0.15, 0.2);
    gun.position.x = 0.9 - (ctx.recoil ?? 0) * 0.5;
    antenna.rotation.z = Math.sin(t * 5) * 0.06;
    muzzleGlow.material.opacity = charge * (0.6 + Math.random() * 0.4);
    muzzleGlow.scale.setScalar(0.4 + charge * 2);
    lenses.forEach((l, i) => l.scale.set(1, 0.7 + Math.max(0, Math.sin(t * 6 + i)) * 0.5 + charge, 1));
    if (flash > 0) {
      flash -= dt;
      if (flash <= 0) group.traverse((m) => m.isMesh && flashMats.has(m) && (m.material = flashMats.get(m)));
    }
  }

  function hitFlash() {
    if (deadT >= 0) return;
    if (flash <= 0) {
      const white = glowMat(0xb9b3a8);
      turret.traverse((m) => {
        if (!m.isMesh || lenses.includes(m) || m.material.visible === false || m.userData.outline) return;
        flashMats.set(m, m.material);
        m.material = white;
      });
    }
    flash = 0.06;
  }

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xf1e9d8, side: THREE.BackSide });
  const outlines = [];
  turret.traverse((m) => {
    if (!m.isMesh || lenses.includes(m) || m.userData.outline) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const size = m.geometry.boundingBox.getSize(new THREE.Vector3());
    const o = new THREE.Mesh(m.geometry, outlineMat);
    o.scale.set((size.x + 0.06) / Math.max(size.x, 0.01), (size.y + 0.06) / Math.max(size.y, 0.01), (size.z + 0.06) / Math.max(size.z, 0.01));
    o.userData.outline = true;
    o.visible = false;
    outlines.push({ o, parent: m });
  });
  for (const { o, parent } of outlines) parent.add(o);
  function setOutline(on) {
    for (const { o } of outlines) o.visible = on && deadT < 0;
  }

  function kill() {
    setOutline(false);
    for (const { o } of outlines) o.removeFromParent();
    if (flash > 0) {
      flash = 0;
      group.traverse((m) => m.isMesh && flashMats.has(m) && (m.material = flashMats.get(m)));
    }
    deadT = 0;
    for (const l of lenses) l.material = toon(C.dead);
    muzzleGlow.visible = false;
  }

  const tmp = new THREE.Vector3();
  function muzzle() {
    group.updateWorldMatrix(true, true);
    return gun.localToWorld(tmp.set(3.75, 0, 0)).clone();
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return lenses[1].getWorldPosition(new THREE.Vector3());
  }

  return { group, update, hitFlash, kill, setOutline, muzzle, eyeWorld, events: [] };
}
