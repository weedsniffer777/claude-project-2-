// The defence wall's turrets (level 8's boss): each a gun pod on a carriage
// that rides a rail along the wall's face, mounted up off the floor. Built
// facing +x, the wall behind it (-x); spawned turned to face the tank.
// heavy: a squat armoured pod with one long cannon and a big red lens;
// otherwise a smaller pod with twin quick-firing barrels and a camera on
// top. The pod turns (ctx.aimYaw) and pitches down at the tank; the barrel
// glows as it charges. Same interface as the other machines.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  steel: 0x4a4f55,
  plate: 0x5d646b,
  dark: 0x1f2124,
  gun: 0x2a2c30,
  hazard: 0xd9b23a,
  eye: 0xff2a1f,
  dead: 0x2a1614,
};

export function createWallTurret({ heavy = true, y = 2.6 } = {}) {
  const group = new THREE.Group();
  // the carriage: clamped on the rail behind (+x, against the wall), its
  // arm reaching out to the pod
  const carriage = new THREE.Group();
  carriage.position.y = y;
  group.add(carriage);
  put(carriage, box(0.5, 1.1, 1.3, C.steel, { r: 0.04 }), -0.9, 0, 0);
  for (const s of [-1, 1]) put(carriage, cyl(0.12, 0.2, C.dark, { axis: 'x', seg: 8 }), -1.1, 0.42, s * 0.42); // rollers on the rail
  for (const s of [-1, 1]) put(carriage, cyl(0.12, 0.2, C.dark, { axis: 'x', seg: 8 }), -1.1, -0.42, s * 0.42);
  for (let i = 0; i < 4; i++) put(carriage, box(0.52, 0.1, 0.12, i % 2 ? C.dark : C.hazard), -0.9, -0.48, -0.45 + i * 0.3); // hazard band
  put(carriage, box(0.7, 0.3, 0.4, C.plate, { r: 0.03 }), -0.45, 0, 0); // the arm
  // the pod: turns on the arm's end
  const pod = new THREE.Group();
  pod.position.set(-0.05, 0, 0);
  carriage.add(pod);
  const lenses = [];
  const gun = new THREE.Group();
  if (heavy) {
    put(pod, box(1.2, 0.9, 1.1, C.steel, { r: 0.08 }), 0, 0, 0);
    put(pod, box(0.5, 0.7, 1.0, C.plate, { r: 0.06 }), 0.55, -0.05, 0).rotation.z = -0.35; // sloped face
    for (const s of [-1, 1]) put(pod, box(0.9, 0.6, 0.05, C.plate, { r: 0.02 }), 0, 0, s * 0.57);
    lenses.push(put(pod, cyl(0.16, 0.06, C.eye, { axis: 'x', seg: 12, glow: true }), 0.62, 0.3, 0.32));
    put(pod, cyl(0.2, 0.05, C.dark, { axis: 'x', seg: 12 }), 0.6, 0.3, 0.32);
    gun.position.set(0.6, -0.05, -0.12);
    pod.add(gun);
    put(gun, cyl(0.14, 0.4, C.gun, { axis: 'x', seg: 10 }), 0.15, 0, 0);
    put(gun, cyl(0.09, 2.2, C.gun, { axis: 'x', seg: 10 }), 1.2, 0, 0);
    put(gun, box(0.26, 0.2, 0.26, C.dark, { r: 0.03 }), 2.3, 0, 0); // muzzle brake
  } else {
    put(pod, box(0.85, 0.65, 0.85, C.steel, { r: 0.07 }), 0, 0, 0);
    put(pod, box(0.3, 0.5, 0.75, C.plate, { r: 0.05 }), 0.42, 0, 0).rotation.z = -0.3;
    gun.position.set(0.45, -0.05, 0);
    pod.add(gun);
    for (const z of [-0.14, 0.14]) {
      put(gun, cyl(0.05, 1.3, C.gun, { axis: 'x', seg: 8 }), 0.7, 0, z);
      put(gun, cyl(0.07, 0.18, C.dark, { axis: 'x', seg: 8 }), 1.32, 0, z); // flash hiders
    }
    put(gun, box(0.3, 0.3, 0.5, C.plate, { r: 0.03 }), 0, 0, 0); // the breech block
    // the camera on top
    put(pod, box(0.4, 0.22, 0.26, C.dark, { r: 0.03 }), 0.05, 0.45, 0);
    lenses.push(put(pod, cyl(0.08, 0.05, C.eye, { axis: 'x', seg: 10, glow: true }), 0.27, 0.45, 0));
  }
  const tip = heavy ? 2.45 : 1.45;
  const muzzleGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(heavy ? 0.2 : 0.13, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  muzzleGlow.position.set(tip, 0, 0);
  muzzleGlow.userData.outline = true;
  gun.add(muzzleGlow);

  group.traverse((m) => {
    if (m.isMesh && !m.material.transparent) m.castShadow = true;
  });

  let flash = 0;
  let deadT = -1;
  const flashMats = new Map();
  function update(dt, t, ctx = {}) {
    if (deadT >= 0) {
      deadT += dt;
      const k = Math.min(1, deadT / 0.5);
      pod.rotation.z = -k * 0.5;
      gun.rotation.z = -k * 0.4;
      return;
    }
    const charge = ctx.charge ?? 0;
    let d = (ctx.aimYaw ?? 0) - pod.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    pod.rotation.y += d * Math.min(1, dt * 6);
    gun.rotation.z = THREE.MathUtils.clamp((ctx.aimPitch ?? 0) - 0.2, -0.45, 0.1); // (it looks down from up there)
    gun.position.x = (heavy ? 0.6 : 0.45) - (ctx.recoil ?? 0) * 0.3;
    muzzleGlow.material.opacity = charge * (0.6 + Math.random() * 0.4);
    muzzleGlow.scale.setScalar(0.4 + charge * 2);
    lenses.forEach((l, i) => l.scale.set(1, 0.8 + Math.max(0, Math.sin(t * 7 + i)) * 0.4 + charge, 1 + charge * 0.5));
    if (flash > 0) {
      flash -= dt;
      if (flash <= 0) group.traverse((m) => m.isMesh && flashMats.has(m) && (m.material = flashMats.get(m)));
    }
  }
  function hitFlash() {
    if (deadT >= 0) return;
    if (flash <= 0) {
      const white = glowMat(0xb9b3a8);
      group.traverse((m) => {
        if (!m.isMesh || lenses.includes(m) || m.material.visible === false || m.userData.outline || m.material.transparent) return;
        flashMats.set(m, m.material);
        m.material = white;
      });
    }
    flash = 0.06;
  }
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xf1e9d8, side: THREE.BackSide });
  const outlines = [];
  pod.traverse((m) => {
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
    return gun.localToWorld(tmp.set(tip, 0, 0)).clone();
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return lenses[0].getWorldPosition(new THREE.Vector3());
  }
  return { group, update, hitFlash, kill, setOutline, muzzle, eyeWorld, events: [] };
}
