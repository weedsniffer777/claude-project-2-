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
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    if (Math.cos(a) > 0.6) continue; // the front is open for the gun
    for (let k = 0; k < 2; k++) {
      const bag = put(group, box(0.5, 0.2, 0.3, C.sand, { r: 0.08 }), Math.cos(a + k * 0.17) * 1.85, 0.12 + k * 0.2, Math.sin(a + k * 0.17) * 1.85);
      bag.rotation.y = -a;
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
