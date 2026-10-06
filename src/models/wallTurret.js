// The defence wall's turrets (level 8's boss): each a gun pod on a carriage
// that rides a rail along the wall's face, mounted up off the floor. Built
// facing +x, the wall behind it (-x); spawned turned to face the tank.
// heavy: a squat armoured pod with one long cannon and a big red lens
// (charges a beam); otherwise a smaller pod with twin machine guns and a
// camera on top. The pod turns (ctx.aimYaw) and pitches down at the tank; the barrel
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

export function createWallTurret({ heavy = true, rockets = false, y = 2.6 } = {}) {
  const group = new THREE.Group();
  // the carriage: clamped on the rail behind (+x, against the wall), its
  // arm reaching out to the pod: a heavy slab with rollers top and bottom,
  // a hazard band, cable runs, a hydraulic ram under the arm, a beacon
  const carriage = new THREE.Group();
  carriage.position.y = y;
  group.add(carriage);
  put(carriage, box(0.5, 1.2, 1.4, C.steel, { r: 0.04 }), -0.9, 0, 0);
  put(carriage, box(0.08, 1.0, 1.2, C.plate, { r: 0.02 }), -0.62, 0, 0); // face plate
  for (const yy of [-0.36, 0, 0.36]) for (const s of [-1, 1]) put(carriage, box(0.03, 0.05, 0.05, C.dark), -0.57, yy, s * 0.5); // its bolts
  for (const yy of [0.47, -0.47]) for (const s of [-1, 1]) {
    put(carriage, cyl(0.13, 0.22, C.dark, { axis: 'x', seg: 10 }), -1.1, yy, s * 0.46); // rollers on the rail
    put(carriage, cyl(0.06, 0.24, C.plate, { axis: 'x', seg: 8 }), -1.1, yy, s * 0.46);
  }
  for (let i = 0; i < 5; i++) put(carriage, box(0.52, 0.1, 0.13, i % 2 ? C.dark : C.hazard), -0.9, -0.55, -0.56 + i * 0.28); // hazard band
  for (const s of [-1, 1]) put(carriage, cyl(0.035, 1.1, C.dark, { seg: 6 }), -0.72, 0.05, s * 0.62); // cable runs down its sides
  put(carriage, box(0.75, 0.34, 0.46, C.plate, { r: 0.04 }), -0.45, 0.05, 0); // the arm
  for (const s of [-1, 1]) put(carriage, box(0.6, 0.06, 0.03, C.dark), -0.45, 0.05, s * 0.24); // its edge strips
  const ram = put(carriage, cyl(0.06, 0.62, C.plate, { axis: 'x', seg: 8 }), -0.42, -0.24, 0); // hydraulic ram under it
  ram.rotation.z = 0.25;
  put(carriage, cyl(0.035, 0.5, 0x8a9096, { axis: 'x', seg: 6 }), -0.3, -0.21, 0).rotation.z = 0.25; // its rod
  const beacon = put(carriage, cyl(0.07, 0.1, 0xff7a1f, { seg: 8, glow: true }), -0.9, 0.66, 0); // a warning beacon
  put(carriage, cyl(0.09, 0.03, C.dark, { seg: 8 }), -0.9, 0.61, 0);
  // the pod: turns on the arm's end, a slewing ring under it
  const pod = new THREE.Group();
  pod.position.set(-0.05, 0, 0);
  carriage.add(pod);
  put(pod, cyl(0.36, 0.08, C.dark, { seg: 16 }), -0.05, -0.36, 0); // slewing ring
  const lenses = [];
  const gun = new THREE.Group();
  const tubes = []; // (the rocket pod's: where each rocket leaves from)
  const podGlow = [];
  // vents on a side plate; a short armoured sensor with a lens
  const vents = (parent, x, yy, z, n, w) => {
    for (let i = 0; i < n; i++) put(parent, box(w, 0.035, 0.02, C.dark), x, yy - i * 0.07, z);
  };
  if (rockets) {
    // a box launcher: six capped tubes in two rows in an armoured frame,
    // angled up; hazard stripes; a sensor block with a red eye on top
    put(pod, box(0.8, 0.6, 0.9, C.steel, { r: 0.06 }), -0.1, 0, 0);
    for (const s of [-1, 1]) vents(pod, -0.15, 0.15, s * 0.46, 4, 0.4);
    gun.position.set(0.25, 0.1, 0);
    gun.rotation.z = 0.5;
    pod.add(gun);
    put(gun, box(0.9, 0.66, 1.0, C.plate, { r: 0.05 }), 0.2, 0, 0);
    for (const s of [-1, 1]) put(gun, box(0.95, 0.72, 0.06, C.steel, { r: 0.02 }), 0.2, 0, s * 0.53); // cheek armour
    put(gun, box(0.95, 0.06, 1.1, C.steel, { r: 0.02 }), 0.2, 0.36, 0); // top plate
    for (let i = 0; i < 5; i++) put(gun, box(0.12, 0.062, 0.18, i % 2 ? C.dark : C.hazard), -0.05 + i * 0.12, 0.38, 0.38).rotation.y = 0.6;
    for (const ty of [-0.15, 0.15]) {
      for (const tz of [-0.3, 0, 0.3]) {
        put(gun, cyl(0.12, 0.08, C.steel, { axis: 'x', seg: 10 }), 0.63, ty, tz); // the tube's lip
        put(gun, cyl(0.09, 0.05, C.dark, { axis: 'x', seg: 10 }), 0.67, ty, tz); // its mouth
        put(gun, cyl(0.04, 0.04, 0xb03a2a, { axis: 'x', seg: 8 }), 0.66, ty, tz); // the rocket's red nose inside
        tubes.push(new THREE.Vector3(0.7, ty, tz));
      }
    }
    const glowM = put(gun, box(0.04, 0.5, 0.8, 0xff5a2a, { glow: true }), 0.7, 0, 0);
    glowM.visible = false;
    podGlow.push(glowM);
    put(pod, box(0.34, 0.2, 0.24, C.dark, { r: 0.03 }), 0.12, 0.4, 0.3);
    put(pod, box(0.08, 0.04, 0.26, C.plate), 0.3, 0.52, 0.3); // its hood
    lenses.push(put(pod, cyl(0.07, 0.05, C.eye, { axis: 'x', seg: 10, glow: true }), 0.31, 0.4, 0.3));
  } else if (heavy) {
    // a squat armoured pod: a sloped glacis, spaced side plates bolted on,
    // vents, the big red eye in its housing; the long beam cannon out of
    // a heavy mantlet: a ribbed cooling jacket, field coils, a slotted brake
    put(pod, box(1.2, 0.9, 1.1, C.steel, { r: 0.08 }), 0, 0, 0);
    put(pod, box(0.5, 0.74, 1.04, C.plate, { r: 0.06 }), 0.55, -0.05, 0).rotation.z = -0.35; // sloped face
    put(pod, box(1.0, 0.08, 1.0, C.plate, { r: 0.03 }), -0.1, 0.48, 0); // roof plate
    for (const s of [-1, 1]) {
      put(pod, box(0.95, 0.64, 0.05, C.plate, { r: 0.02 }), 0, 0, s * 0.6); // spaced side plates
      for (const xx of [-0.35, 0, 0.35]) for (const yy of [-0.22, 0.22]) put(pod, box(0.04, 0.04, 0.03, C.dark), xx, yy, s * 0.63);
      vents(pod, -0.45, 0.2, s * 0.56, 4, 0.18);
      for (let i = 0; i < 4; i++) put(pod, box(0.14, 0.06, 0.04, i % 2 ? C.dark : C.hazard), -0.35 + i * 0.14, -0.38, s * 0.63);
    }
    put(pod, box(0.3, 0.26, 0.3, C.dark, { r: 0.04 }), 0.5, 0.32, 0.32); // the eye's housing
    put(pod, box(0.08, 0.04, 0.34, C.plate), 0.66, 0.46, 0.32); // its brow
    lenses.push(put(pod, cyl(0.15, 0.06, C.eye, { axis: 'x', seg: 12, glow: true }), 0.66, 0.31, 0.32));
    put(pod, cyl(0.2, 0.05, C.dark, { axis: 'x', seg: 12 }), 0.64, 0.31, 0.32);
    for (const s of [-1, 1]) put(pod, cyl(0.025, 0.5, C.dark, { seg: 5 }), -0.4, 0.7, s * 0.3); // antennas
    gun.position.set(0.6, -0.05, -0.12);
    pod.add(gun);
    put(gun, box(0.4, 0.5, 0.5, C.plate, { r: 0.05 }), 0.05, 0, 0); // the mantlet
    put(gun, cyl(0.16, 0.42, C.gun, { axis: 'x', seg: 12 }), 0.4, 0, 0);
    put(gun, cyl(0.13, 0.9, C.steel, { axis: 'x', seg: 12 }), 1.0, 0, 0); // the cooling jacket
    for (let i = 0; i < 6; i++) put(gun, cyl(0.155, 0.04, C.dark, { axis: 'x', seg: 12 }), 0.62 + i * 0.15, 0, 0); // its ribs
    put(gun, cyl(0.09, 1.1, C.gun, { axis: 'x', seg: 10 }), 1.95, 0, 0);
    for (const xx of [1.55, 1.85, 2.15]) put(gun, cyl(0.12, 0.06, 0xb04a2a, { axis: 'x', seg: 10, glow: true }), xx, 0, 0); // field coils
    put(gun, box(0.3, 0.22, 0.28, C.dark, { r: 0.03 }), 2.32, 0, 0); // muzzle brake
    for (const s of [-1, 1]) put(gun, box(0.2, 0.08, 0.04, C.steel), 2.32, 0, s * 0.15); // its slots
    put(gun, cyl(0.03, 1.2, C.dark, { axis: 'x', seg: 5 }), 0.9, 0.17, 0); // a cable along it
  } else {
    // the quick turret: a compact pod, twin guns in a shroud, ammo boxes
    // either side feeding them, the camera up top in a hooded box
    put(pod, box(0.85, 0.65, 0.85, C.steel, { r: 0.07 }), 0, 0, 0);
    put(pod, box(0.3, 0.55, 0.8, C.plate, { r: 0.05 }), 0.42, 0, 0).rotation.z = -0.3;
    for (const s of [-1, 1]) {
      put(pod, box(0.5, 0.36, 0.18, 0x4f5a3a, { r: 0.03 }), -0.1, -0.05, s * 0.52); // ammo boxes
      put(pod, box(0.5, 0.05, 0.19, C.dark), -0.1, 0.13, s * 0.52);
      for (let i = 0; i < 4; i++) put(pod, box(0.04, 0.05, 0.08, 0xc9a24a), 0.2, 0.1 - i * 0.02, s * (0.42 - i * 0.07)); // the belts in
    }
    vents(pod, -0.3, 0.2, 0.43, 3, 0.25);
    gun.position.set(0.45, -0.05, 0);
    pod.add(gun);
    put(gun, box(0.36, 0.32, 0.56, C.plate, { r: 0.03 }), 0, 0, 0); // the breech block
    put(gun, box(0.7, 0.14, 0.5, C.steel, { r: 0.03 }), 0.5, 0, 0); // the shroud
    for (const z of [-0.14, 0.14]) {
      put(gun, cyl(0.06, 0.55, C.gun, { axis: 'x', seg: 8 }), 0.9, 0, z); // perforated jacket
      for (let i = 0; i < 3; i++) put(gun, cyl(0.065, 0.03, C.dark, { axis: 'x', seg: 8 }), 0.72 + i * 0.15, 0, z);
      put(gun, cyl(0.04, 0.3, C.gun, { axis: 'x', seg: 8 }), 1.25, 0, z);
      put(gun, cyl(0.07, 0.16, C.dark, { axis: 'x', seg: 8 }), 1.38, 0, z); // flash hiders
    }
    // the camera on top, hooded, on a little mast
    put(pod, cyl(0.04, 0.12, C.dark, { seg: 6 }), 0.05, 0.39, 0);
    put(pod, box(0.42, 0.22, 0.28, C.dark, { r: 0.03 }), 0.05, 0.52, 0);
    put(pod, box(0.12, 0.04, 0.3, C.plate), 0.24, 0.65, 0); // its hood
    lenses.push(put(pod, cyl(0.08, 0.05, C.eye, { axis: 'x', seg: 10, glow: true }), 0.28, 0.52, 0));
  }
  const tip = rockets ? 0.75 : heavy ? 2.45 : 1.45;
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
    beacon.visible = Math.sin(t * 7) > -0.2; // (the beacon blinks)
    let d = (ctx.aimYaw ?? 0) - pod.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    pod.rotation.y += d * Math.min(1, dt * 6);
    if (rockets) {
      for (const g of podGlow) g.visible = (ctx.rockets || 0) > 0.02 && Math.sin(t * 24) > -0.3;
    } else {
      gun.rotation.z = THREE.MathUtils.clamp((ctx.aimPitch ?? 0) - 0.2, -0.45, 0.1); // (it looks down from up there)
      gun.position.x = (heavy ? 0.6 : 0.45) - (ctx.recoil ?? 0) * 0.3;
    }
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
    for (const g of podGlow) g.visible = false;
    beacon.visible = false;
  }
  const tmp = new THREE.Vector3();
  function muzzle() {
    group.updateWorldMatrix(true, true);
    return gun.localToWorld(tmp.set(tip, 0, 0)).clone();
  }
  let tubeN = 0;
  function rocketMuzzle() {
    group.updateWorldMatrix(true, true);
    const v = tubes.length ? tubes[tubeN++ % tubes.length] : tmp.set(tip, 0, 0);
    return gun.localToWorld(v.clone());
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return lenses[0].getWorldPosition(new THREE.Vector3());
  }
  return { group, update, hitFlash, kill, setOutline, muzzle, rocketMuzzle, eyeWorld, events: [] };
}
