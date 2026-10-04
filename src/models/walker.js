// Anti-tank walker: a tall two-legged machine that is mostly gun. Legs with
// backward knees carry a small pelvis, and on it a yoke holding the gun:
// receiver, heavy breech, a very long barrel; a small sensor box with a red
// slit for sights. Front is +X. While it lines up a shot it
// crouches and braces, and the gun's muzzle glows hotter (ctx.charge 0..1).
// Same interface as the dog: update, hitFlash, kill, setOutline, muzzle.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  hull: 0x45494e,
  panel: 0x62686e,
  dark: 0x1f2124,
  joint: 0x2b2d30,
  gun: 0x2a2c30,
  eye: 0xff2a1f,
  dead: 0x2a1614,
};

const HIP_Y = 1.25;
const THIGH = 0.62;
const SHIN = 0.7;

export function createWalker() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // the cab: bobs, crouches, turns to aim
  body.position.y = HIP_Y;
  group.add(body);
  const cab = new THREE.Group(); // turns on the hips to aim
  body.add(cab);

  // the pelvis: a small joint block the gun sits on
  put(body, box(0.34, 0.2, 0.62, C.joint, { r: 0.04 }), 0, -0.02, 0);
  put(body, box(0.22, 0.12, 0.4, C.dark, { r: 0.03 }), -0.12, -0.14, 0);
  // a yoke: two side plates holding the gun's trunnions
  for (const s of [-1, 1]) {
    put(cab, box(0.34, 0.36, 0.06, C.panel, { r: 0.02 }), 0, 0.16, s * 0.24);
    put(cab, cyl(0.07, 0.08, C.joint, { axis: 'z', seg: 8 }), 0, 0.3, s * 0.29);
  }
  // the gun is the whole top half: a long receiver, a heavy breech behind
  // the trunnions as a counterweight, a very long barrel with a shroud,
  // recoil cylinders under it and a big muzzle brake
  const gun = new THREE.Group();
  gun.position.set(0, 0.3, 0);
  cab.add(gun);
  put(gun, box(1.0, 0.34, 0.4, C.hull, { r: 0.05 }), 0.05, 0, 0); // receiver
  put(gun, box(0.8, 0.08, 0.3, C.panel, { r: 0.02 }), 0.05, 0.2, 0); // top plate
  put(gun, box(0.42, 0.4, 0.44, C.dark, { r: 0.05 }), -0.6, 0.02, 0); // breech block
  put(gun, box(0.12, 0.22, 0.46, C.joint, { r: 0.02 }), -0.84, 0.04, 0); // breech cap
  const cells = [-1, 1].map((s) => put(gun, box(0.5, 0.05, 0.02, C.eye, { r: 0.005, glow: true }), -0.55, -0.04, s * 0.225)); // the charge cells
  put(gun, cyl(0.13, 0.5, C.gun, { axis: 'x', seg: 10 }), 0.75, 0.02, 0); // shroud
  put(gun, cyl(0.075, 2.0, C.gun, { axis: 'x', seg: 8 }), 1.75, 0.02, 0); // barrel
  for (const z of [-0.07, 0.07]) put(gun, cyl(0.03, 0.75, C.joint, { axis: 'x', seg: 6 }), 0.85, -0.12, z); // recoil cylinders
  put(gun, box(0.24, 0.17, 0.22, C.dark, { r: 0.03 }), 2.78, 0.02, 0); // muzzle brake
  for (const z of [-0.12, 0.12]) put(gun, box(0.16, 0.08, 0.03, C.joint, { r: 0.01 }), 2.78, 0.02, z); // its side vents
  // the sights, secondary: a small sensor box up on the left with a red
  // slit, a stub antenna
  put(gun, box(0.3, 0.16, 0.18, C.panel, { r: 0.03 }), 0.15, 0.32, -0.15);
  put(gun, box(0.05, 0.12, 0.05, C.joint, { r: 0.01 }), 0.15, 0.22, -0.15);
  const visor = put(gun, box(0.03, 0.05, 0.13, C.eye, { r: 0.01, glow: true }), 0.31, 0.33, -0.15);
  const antenna = put(gun, cyl(0.012, 0.6, C.dark, { seg: 4 }), -0.55, 0.5, 0.15);
  const glowMatHot = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const muzzleGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), glowMatHot);
  muzzleGlow.position.set(2.92, 0.02, 0);
  muzzleGlow.userData.outline = true; // (no outline, no flash)
  gun.add(muzzleGlow);

  // legs: hip -> thigh (forward and down) -> knee (bending back) -> shin ->
  // a splayed foot
  const legs = [];
  for (const [lz, phase] of [[0.3, 0], [-0.3, Math.PI]]) {
    const hip = new THREE.Group();
    hip.position.set(0, HIP_Y, lz);
    group.add(hip);
    put(hip, box(0.2, 0.2, 0.16, C.joint, { r: 0.04 }), 0, 0, 0);
    put(hip, box(0.14, THIGH, 0.13, C.hull, { r: 0.04 }), 0, -THIGH / 2, 0);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    hip.add(knee);
    put(knee, box(0.14, 0.14, 0.14, C.joint, { r: 0.04 }), 0, 0, 0);
    put(knee, box(0.1, SHIN, 0.1, C.panel, { r: 0.03 }), 0, -SHIN / 2, 0);
    const foot = new THREE.Group();
    foot.position.y = -SHIN;
    knee.add(foot);
    put(foot, box(0.36, 0.07, 0.2, C.dark, { r: 0.02 }), 0.06, 0, 0);
    put(foot, box(0.12, 0.06, 0.24, C.dark, { r: 0.02 }), -0.12, 0.01, 0);
    legs.push({ hip, knee, foot, phase });
  }

  group.traverse((m) => {
    if (m.isMesh && !m.material.transparent && m !== visor && !cells.includes(m)) m.castShadow = true;
  });

  let gait = 0;
  let flash = 0;
  let deadT = -1;
  const flashMats = new Map();

  // ctx: { speed (0..1), aimYaw (relative to the body's heading), aimPitch,
  // recoil (0..1), charge (0..1: lining up a shot) }
  function update(dt, t, ctx = {}) {
    if (deadT >= 0) {
      // it topples sideways, legs buckling
      deadT += dt;
      const k = Math.min(1, deadT / 0.5);
      body.position.y = HIP_Y - k * 0.9;
      body.rotation.x = k * 1.1;
      for (const l of legs) {
        l.hip.position.y = HIP_Y - k * 0.85;
        l.hip.rotation.z = k * 0.9;
        l.knee.rotation.z = -k * 1.6;
      }
      return;
    }
    const speed = ctx.speed ?? 0;
    const charge = ctx.charge ?? 0;
    gait += dt * (3 + speed * 7);
    const swing = 0.5 * speed;
    for (const l of legs) {
      const s = Math.sin(gait + l.phase);
      const lift = Math.max(0, Math.cos(gait + l.phase));
      // crouched and braced while charging: knees bent more, no stepping
      l.hip.rotation.z = s * swing + 0.35 + charge * 0.25;
      l.knee.rotation.z = -(0.7 + lift * 0.5 * speed + charge * 0.45);
      l.foot.rotation.z = -(l.hip.rotation.z + l.knee.rotation.z);
      l.hip.position.y = HIP_Y - charge * 0.18;
    }
    body.position.y = HIP_Y - 0.08 - charge * 0.18 + Math.abs(Math.sin(gait)) * 0.06 * speed + Math.sin(t * 2.5) * 0.01;
    body.rotation.z = -0.05 * speed;
    // the cab turns to aim whichever way the legs are walking
    const yaw = ctx.aimYaw ?? 0;
    let d = yaw - cab.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cab.rotation.y += d * Math.min(1, dt * 6);
    gun.rotation.z = THREE.MathUtils.clamp(ctx.aimPitch ?? 0, -0.3, 0.3);
    gun.position.x = -(ctx.recoil ?? 0) * 0.35;
    antenna.rotation.z = Math.sin(t * 7 + gait) * 0.12 * (0.3 + speed);
    // the muzzle heats up through the charge
    muzzleGlow.material.opacity = charge * (0.6 + Math.random() * 0.4);
    muzzleGlow.scale.setScalar(0.4 + charge * 1.3);
    visor.scale.set(1, 0.8 + Math.sin(t * 6) * 0.2 + charge * 0.6, 1);
    for (const c of cells) c.scale.set(1 + charge * 0.3, 1 + charge * 1.6, 1);
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
        if (!m.isMesh || m === visor || cells.includes(m) || m.material.visible === false || m.userData.outline) return;
        flashMats.set(m, m.material);
        m.material = white;
      });
    }
    flash = 0.06;
  }

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xf1e9d8, side: THREE.BackSide });
  const outlines = [];
  group.traverse((m) => {
    if (!m.isMesh || m === visor || cells.includes(m) || m.userData.outline) return;
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
    visor.material = toon(C.dead);
    for (const c of cells) c.material = toon(C.dead);
    muzzleGlow.visible = false;
  }

  const tmp = new THREE.Vector3();
  function muzzle() {
    group.updateWorldMatrix(true, true);
    return gun.localToWorld(tmp.set(2.92, 0.02, 0)).clone();
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return visor.getWorldPosition(new THREE.Vector3());
  }

  return { group, update, hitFlash, kill, setOutline, muzzle, eyeWorld, events: [] };
}
