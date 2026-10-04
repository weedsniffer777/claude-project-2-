// The siege spider: level 4's boss. A huge four-legged walker built as a
// weapons platform. A flat armoured body slung between four long legs
// (each a thigh rising to a high knee, then a shin down to a broad foot)
// that walk in diagonal pairs; on top a turret that turns to aim, carrying:
//  - the main gun: a long beam cannon, its charge cells glowing as it lines
//    up (ctx.charge 0..1)
//  - a rocket pod either side (six tubes each), glowing as a salvo comes
//    (ctx.rockets 0..1)
//  - a battery of mortar tubes on its back, pointing up
//  - a chin MG under the front of the body
// and red sensor eyes along its brow. Front is +X. Same interface as the
// other machines: update, hitFlash, kill, setOutline, muzzle, eyeWorld
// (plus rocketMuzzle, mortarMuzzle, mgMuzzle for its other weapons).
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  hull: 0x45494e,
  panel: 0x5d6369,
  dark: 0x1f2124,
  joint: 0x2b2d30,
  gun: 0x2a2c30,
  hazard: 0xc99a2e,
  eye: 0xff2a1f,
  dead: 0x2a1614,
};

const BODY_Y = 3.0; // the body's height off the ground
const HIP = { x: 1.3, z: 1.1 }; // hip joints at the body's corners
const THIGH = 3.0;
const SHIN = 3.6;
const REACH = { x: 3.2, z: 3.0 }; // feet out from the middle

export function createSpider() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // bobs and sways as it walks
  body.position.y = BODY_Y;
  group.add(body);
  const glowy = []; // emissive bits left out of flashes and outlines

  // ------------------------------------------------------------- the body
  put(body, box(3.4, 0.9, 2.6, C.hull, { r: 0.12 }), 0, 0, 0);
  put(body, box(3.0, 0.3, 2.2, C.panel, { r: 0.06 }), -0.1, 0.55, 0); // the top deck
  put(body, box(0.9, 0.7, 2.0, C.panel, { r: 0.1 }), 1.75, -0.1, 0).rotation.z = -0.35; // a sloped glacis
  put(body, box(2.8, 0.4, 1.8, C.dark, { r: 0.08 }), -0.2, -0.6, 0); // the belly
  for (const s of [-1, 1]) {
    put(body, box(3.0, 0.5, 0.12, C.panel, { r: 0.03 }), -0.1, 0, s * 1.33); // side armour
    for (let x = -1.3; x <= 1.3; x += 0.65) put(body, box(0.08, 0.08, 0.04, C.dark), x, 0.18, s * 1.4); // bolts
    put(body, box(2.2, 0.08, 0.05, C.hazard, { r: 0.01 }), -0.2, -0.22, s * 1.4); // a hazard stripe
  }
  // its brow: a row of red sensor eyes across the front
  const eyes = [];
  for (const z of [-0.6, -0.2, 0.2, 0.6]) {
    put(body, box(0.14, 0.2, 0.22, C.dark, { r: 0.03 }), 1.78, 0.22, z);
    eyes.push(put(body, box(0.04, 0.1, 0.14, C.eye, { r: 0.01, glow: true }), 1.86, 0.22, z));
  }
  glowy.push(...eyes);
  // the chin MG, under the front
  const mgPivot = new THREE.Group();
  mgPivot.position.set(1.5, -0.65, 0);
  body.add(mgPivot);
  put(mgPivot, box(0.4, 0.3, 0.4, C.joint, { r: 0.06 }), 0, 0, 0);
  for (const z of [-0.08, 0.08]) put(mgPivot, cyl(0.04, 0.8, C.gun, { axis: 'x', seg: 6 }), 0.55, -0.02, z);
  // exhausts at the back, with soot
  for (const s of [-1, 1]) put(body, cyl(0.14, 0.5, C.dark, { seg: 8 }), -1.6, 0.5, s * 0.7).rotation.z = 0.4;

  // ------------------------------------------------------------ the turret
  const turret = new THREE.Group();
  turret.position.set(0.1, 0.7, 0);
  body.add(turret);
  put(turret, cyl(0.95, 0.25, C.joint, { seg: 18 }), 0, 0.12, 0); // the ring
  put(turret, box(2.0, 0.7, 1.5, C.hull, { r: 0.1 }), -0.1, 0.55, 0);
  put(turret, box(1.6, 0.12, 1.2, C.panel, { r: 0.03 }), -0.2, 0.95, 0);
  // the main gun: a long beam cannon with a shroud, cells along its breech
  const gun = new THREE.Group();
  gun.position.set(0.7, 0.6, 0);
  turret.add(gun);
  put(gun, box(1.2, 0.5, 0.6, C.dark, { r: 0.06 }), 0.2, 0, 0);
  put(gun, cyl(0.24, 1.0, C.gun, { axis: 'x', seg: 12 }), 1.2, 0, 0);
  put(gun, cyl(0.15, 2.6, C.gun, { axis: 'x', seg: 10 }), 2.9, 0, 0);
  put(gun, box(0.4, 0.34, 0.34, C.dark, { r: 0.05 }), 4.25, 0, 0); // the muzzle
  for (const z of [-0.2, 0.2]) put(gun, box(0.26, 0.12, 0.05, C.joint, { r: 0.01 }), 4.25, 0, z);
  const cells = [-1, 1].map((s) => put(gun, box(0.9, 0.07, 0.03, C.eye, { r: 0.01, glow: true }), 0.15, -0.05, s * 0.31));
  glowy.push(...cells);
  const muzzleGlow = put(gun, box(0.2, 0.2, 0.2, 0xffffff, { glow: true, r: 0.04 }), 4.5, 0, 0);
  muzzleGlow.visible = false;
  glowy.push(muzzleGlow);
  // rocket pods either side: boxes with six tube mouths, glow strips
  const pods = [];
  const podGlow = [];
  for (const s of [-1, 1]) {
    const pod = new THREE.Group();
    pod.position.set(0.1, 0.75, s * 1.15);
    turret.add(pod);
    put(pod, box(1.3, 0.7, 0.6, C.panel, { r: 0.08 }), 0, 0, 0);
    put(pod, box(0.08, 0.72, 0.62, C.hazard, { r: 0.02 }), -0.5, 0, 0);
    const mouths = [];
    for (const dy of [-0.18, 0.18]) for (const dz of [-0.18, 0, 0.18]) {
      put(pod, cyl(0.08, 0.06, C.dark, { axis: 'x', seg: 8 }), 0.66, dy, dz);
      const m = new THREE.Object3D();
      m.position.set(0.72, dy, dz);
      pod.add(m);
      mouths.push(m);
    }
    const gl = put(pod, box(0.03, 0.62, 0.52, C.eye, { r: 0.01, glow: true }), 0.7, 0, 0);
    gl.visible = false;
    podGlow.push(gl);
    pods.push({ pod, mouths });
  }
  glowy.push(...podGlow);
  // the mortar battery on its back: four tubes pointing up and back
  const mortars = [];
  for (const [dx, dz] of [[-0.75, -0.3], [-0.75, 0.3], [-1.05, -0.3], [-1.05, 0.3]]) {
    const t = put(turret, cyl(0.13, 0.9, C.gun, { seg: 10 }), dx, 1.25, dz);
    t.rotation.z = 0.25;
    put(turret, cyl(0.15, 0.08, C.dark, { seg: 10 }), dx - 0.11, 1.68, dz).rotation.z = 0.25;
    const m = new THREE.Object3D();
    m.position.set(dx - 0.12, 1.75, dz);
    turret.add(m);
    mortars.push(m);
  }
  put(turret, box(0.5, 0.3, 1.0, C.dark, { r: 0.05 }), -0.9, 0.95, 0); // their base
  // an antenna mast
  put(turret, cyl(0.03, 1.6, C.dark, { seg: 5 }), -0.7, 1.7, -0.6);

  // --------------------------------------------------------------- the legs
  // each leg: a hip block, a thigh up to the knee, a shin down to the foot;
  // posed every frame by a two-bone solve between the hip and the foot
  const legs = [];
  const LEG_ORDER = [[1, 1], [-1, -1], [1, -1], [-1, 1]]; // diagonal pairs: 0,1 and 2,3
  for (const [sx, sz] of LEG_ORDER) {
    const hip = put(body, box(0.6, 0.6, 0.6, C.joint, { r: 0.1 }), sx * HIP.x, -0.1, sz * HIP.z);
    const thigh = new THREE.Group();
    group.add(thigh);
    put(thigh, box(0.5, 0.5, THIGH, C.hull, { r: 0.08 }), 0, 0, THIGH / 2);
    put(thigh, box(0.3, 0.56, THIGH * 0.8, C.panel, { r: 0.04 }), 0, 0.05, THIGH / 2);
    put(thigh, cyl(0.08, THIGH * 0.7, C.dark, { axis: 'z', seg: 6 }), 0, -0.32, THIGH / 2); // a ram
    const knee = new THREE.Group();
    group.add(knee);
    put(knee, box(0.62, 0.62, 0.62, C.joint, { r: 0.12 }), 0, 0, 0);
    const shin = new THREE.Group();
    group.add(shin);
    put(shin, box(0.42, 0.42, SHIN, C.hull, { r: 0.06 }), 0, 0, SHIN / 2);
    put(shin, box(0.06, 0.3, SHIN * 0.7, C.hazard, { r: 0.01 }), 0.22, 0, SHIN * 0.4);
    put(shin, box(0.9, 0.22, 0.9, C.dark, { r: 0.06 }), 0, 0, SHIN); // the foot
    put(shin, box(0.5, 0.2, 0.5, C.joint, { r: 0.05 }), 0, 0, SHIN - 0.25);
    legs.push({ sx, sz, hip, thigh, knee, shin, phase: legs.length < 2 ? 0 : Math.PI });
  }

  group.traverse((m) => {
    if (m.isMesh && !glowy.includes(m)) m.castShadow = true;
  });

  // -------------------------------------------------------------- behaviour
  let deadT = -1;
  let flash = 0;
  const flashMats = new Map();
  let walk = 0;
  let recoil = 0;
  const v = new THREE.Vector3();
  const hipW = new THREE.Vector3();
  const footW = new THREE.Vector3();
  const kneeW = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  // place a segment group (its local +z along the segment) from a to b
  const bW = new THREE.Vector3();
  const lay = (seg, a, b) => {
    seg.position.copy(a);
    seg.lookAt(group.localToWorld(bW.copy(b))); // (lookAt takes a world point)
  };
  function poseLegs(lift) {
    group.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    for (const L of legs) {
      // the hip, in the group's frame
      L.hip.getWorldPosition(hipW).applyMatrix4(inv);
      // the foot: out at the corner, stepping fore and aft as it walks,
      // lifting on the forward swing
      const s = Math.sin(walk + L.phase);
      const c = Math.cos(walk + L.phase);
      footW.set(L.sx * REACH.x + s * 0.7 * lift, Math.max(0, c) * 0.7 * lift + 0.11, L.sz * REACH.z);
      // the knee: up and out between them (a two-bone solve, bending up)
      const d = hipW.distanceTo(footW);
      const a = Math.min(THIGH, (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d));
      const h = Math.sqrt(Math.max(0.01, THIGH * THIGH - a * a));
      const dir = v.copy(footW).sub(hipW).normalize();
      const side = new THREE.Vector3().crossVectors(dir, up).normalize();
      const bendUp = new THREE.Vector3().crossVectors(side, dir).normalize();
      if (bendUp.y < 0) bendUp.negate();
      kneeW.copy(hipW).addScaledVector(dir, a).addScaledVector(bendUp, h);
      lay(L.thigh, hipW, kneeW);
      L.knee.position.copy(kneeW);
      lay(L.shin, kneeW, footW);
    }
  }
  poseLegs(0);

  // ctx: { speed (0..1), aimYaw (relative), aimPitch, recoil, charge (the
  // beam lining up), rockets (a salvo coming), mg (firing) }
  function update(dt, t, ctx = {}) {
    if (deadT >= 0) {
      deadT += dt;
      return;
    }
    const speed = ctx.speed || 0;
    walk += dt * (1.2 + speed * 3.2);
    const lift = Math.min(1, speed * 1.6);
    body.position.y = BODY_Y + Math.abs(Math.sin(walk)) * 0.12 * lift + Math.sin(t * 1.3) * 0.04;
    body.rotation.z = Math.sin(walk * 2) * 0.02 * lift;
    body.rotation.x = Math.sin(walk) * 0.03 * lift;
    // the turret turns to aim, the gun lays
    let d = (ctx.aimYaw ?? 0) - turret.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    turret.rotation.y += d * Math.min(1, dt * 2.2);
    gun.rotation.z = THREE.MathUtils.lerp(gun.rotation.z, ctx.aimPitch ?? 0, Math.min(1, dt * 4));
    mgPivot.rotation.y = turret.rotation.y;
    recoil = Math.max(recoil, ctx.recoil || 0);
    recoil = Math.max(0, recoil - dt * 3);
    gun.position.x = 0.7 - recoil * 0.4;
    const charge = ctx.charge || 0;
    for (const c of cells) c.scale.set(1, 1 + charge * 2, 1 + charge);
    muzzleGlow.visible = charge > 0.05;
    muzzleGlow.scale.setScalar(0.4 + charge * 1.6);
    for (const g of podGlow) g.visible = (ctx.rockets || 0) > 0.02 && Math.sin(t * 24) > -0.3;
    for (const e of eyes) e.scale.set(1, 0.8 + Math.sin(t * 6) * 0.2 + charge * 0.6, 1);
    poseLegs(lift);
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
        if (!m.isMesh || glowy.includes(m) || m.material.transparent || m.material.visible === false || m.userData.outline) return;
        flashMats.set(m, m.material);
        m.material = white;
      });
    }
    flash = 0.06;
  }

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xf1e9d8, side: THREE.BackSide });
  const outlines = [];
  group.traverse((m) => {
    if (!m.isMesh || glowy.includes(m) || m.material.visible === false) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const size = m.geometry.boundingBox.getSize(new THREE.Vector3());
    const o = new THREE.Mesh(m.geometry, outlineMat);
    o.scale.set((size.x + 0.08) / Math.max(size.x, 0.01), (size.y + 0.08) / Math.max(size.y, 0.01), (size.z + 0.08) / Math.max(size.z, 0.01));
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
    for (const e of [...eyes, ...cells]) e.material = toon(C.dead);
    muzzleGlow.visible = false;
    for (const g of podGlow) g.visible = false;
  }

  const tmp = new THREE.Vector3();
  function muzzle() {
    group.updateWorldMatrix(true, true);
    return gun.localToWorld(tmp.set(4.5, 0, 0)).clone();
  }
  let podN = 0;
  function rocketMuzzle() {
    group.updateWorldMatrix(true, true);
    const p = pods[podN % 2];
    const m = p.mouths[(podN >> 1) % p.mouths.length];
    podN++;
    return m.getWorldPosition(new THREE.Vector3());
  }
  let mortarN = 0;
  function mortarMuzzle() {
    group.updateWorldMatrix(true, true);
    return mortars[mortarN++ % mortars.length].getWorldPosition(new THREE.Vector3());
  }
  function mgMuzzle() {
    group.updateWorldMatrix(true, true);
    return mgPivot.localToWorld(tmp.set(0.95, -0.02, 0)).clone();
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return eyes[1].getWorldPosition(new THREE.Vector3());
  }

  return { group, update, hitFlash, kill, setOutline, muzzle, rocketMuzzle, mortarMuzzle, mgMuzzle, eyeWorld, events: [] };
}
