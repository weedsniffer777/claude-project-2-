// The siege mech: level 4's boss. A low, wide, four-legged walking tank:
// a long armoured hull slung low between four splayed legs (heavy hip
// hubs, short thighs out and up to the knee, armoured shins down to broad
// feet, struts between), an angular turret on top with a very long gun
// and a big muzzle brake, a searchlight sensor block on the front, a
// sensor dome and mast at the back, pipes and boxes all over; a rocket
// artillery launcher on each side of the hull, angled up.
// Front is +X. Interface as the other machines: update, hitFlash, kill,
// setOutline, muzzle (the main gun), rocketMuzzle (the launchers),
// eyeWorld.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  hull: 0x7d7768, // a dusty khaki-grey, like the reference
  panel: 0x8d8778,
  dark: 0x3a3833,
  joint: 0x5a564c,
  gun: 0x6f6a5d,
  hazard: 0xc99a2e,
  eye: 0xff2a1f,
  lamp: 0xe8f4ff,
  dead: 0x2a1614,
};

const BODY_Y = 1.75;
const THIGH = 2.0;
const SHIN = 2.7;
// the legs: an X, one off each corner of the hull, splayed out diagonally;
// the thigh reaches out and up to a high knee, the armoured shin comes
// steeply down to a clawed foot
const LEGS = [
  { hip: [1.7, -0.05, 1.0], phase: 0 },
  { hip: [-1.7, -0.05, -1.0], phase: 0 },
  { hip: [1.7, -0.05, -1.0], phase: Math.PI },
  { hip: [-1.7, -0.05, 1.0], phase: Math.PI },
].map((L) => {
  const r = Math.SQRT1_2 * 2.7; // how far out the foot is planted, along the diagonal
  return { ...L, foot: [L.hip[0] + Math.sign(L.hip[0]) * r, L.hip[2] + Math.sign(L.hip[2]) * r] };
});

export function createSpider() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = BODY_Y;
  group.add(body);
  const glowy = [];

  // ------------------------------------------------------------- the hull
  // a long low armoured box in layered plates, hard edges, a sloped nose
  put(body, box(4.4, 0.7, 2.4, C.hull, { r: 0.03 }), 0, 0, 0);
  put(body, box(4.0, 0.25, 2.6, C.panel, { r: 0.02 }), -0.1, 0.42, 0); // the deck plate, overhanging
  put(body, box(4.6, 0.12, 2.0, C.dark, { r: 0.01 }), 0, -0.42, 0); // the belly frame
  const nose = put(body, box(0.8, 0.55, 2.2, C.panel, { r: 0.03 }), 2.35, 0.05, 0);
  nose.rotation.z = -0.5;
  put(body, box(0.5, 0.6, 2.3, C.hull, { r: 0.03 }), -2.3, 0.05, 0); // the rear plate
  for (const s of [-1, 1]) {
    // side armour: a long panel with a slotted cut-out, bolts, a round hub
    put(body, box(3.2, 0.55, 0.14, C.panel, { r: 0.02 }), 0.1, 0, s * 1.27);
    put(body, box(1.8, 0.22, 0.06, C.dark, { r: 0.01 }), 0.3, -0.02, s * 1.36);
    for (let x = -1.3; x <= 1.5; x += 0.47) put(body, box(0.07, 0.07, 0.04, C.dark), x, 0.22, s * 1.35);
    put(body, box(0.16, 0.16, 0.04, C.eye, { r: 0.02 }), -0.9, 0.05, s * 1.36); // a small marker lamp
    // pipes along the side under the deck lip
    put(body, cyl(0.05, 3.4, C.dark, { axis: 'x', seg: 6 }), 0, 0.3, s * 1.22);
    put(body, cyl(0.04, 2.0, C.joint, { axis: 'x', seg: 6 }), -0.6, -0.28, s * 1.15);
  }
  // greebles on the deck: hatches, vents, boxes, a cable run
  put(body, box(0.6, 0.12, 0.6, C.joint, { r: 0.02 }), -1.4, 0.6, 0.6);
  put(body, box(0.5, 0.18, 0.4, C.dark, { r: 0.02 }), -1.6, 0.62, -0.7);
  for (let k = 0; k < 5; k++) put(body, box(0.05, 0.08, 0.5, C.dark), -1.95 + k * 0.1, 0.6, -0.05);
  put(body, box(0.3, 0.25, 0.3, C.panel, { r: 0.02 }), 1.7, 0.6, 0.85);

  // --------------------------------------------- the rocket artillery pods
  // on each side of the hull, angled up and out, three by two tubes
  const pods = [];
  const podGlow = [];
  for (const s of [-1, 1]) {
    const pod = new THREE.Group();
    pod.position.set(-0.6, 0.75, s * 1.05);
    pod.rotation.set(s * -0.15, 0, 0.45); // tilted up toward the front
    body.add(pod);
    put(pod, box(1.4, 0.55, 0.62, C.hull, { r: 0.03 }), 0, 0, 0);
    put(pod, box(1.42, 0.08, 0.64, C.dark, { r: 0.01 }), 0, 0.3, 0);
    put(pod, box(0.08, 0.57, 0.64, C.hazard, { r: 0.01 }), -0.55, 0, 0);
    const mouths = [];
    for (const dy of [-0.13, 0.13]) {
      for (const dz of [-0.19, 0, 0.19]) {
        put(pod, box(0.04, 0.17, 0.15, 0x161512, { r: 0.01 }), 0.71, dy, dz);
        const m = new THREE.Object3D();
        m.position.set(0.78, dy, dz);
        pod.add(m);
        mouths.push(m);
      }
    }
    const gl = put(pod, box(0.02, 0.5, 0.56, C.eye, { r: 0.01, glow: true }), 0.735, 0, 0);
    gl.visible = false;
    podGlow.push(gl);
    pods.push({ pod, mouths });
  }
  glowy.push(...podGlow);

  // ------------------------------------------------------------ the turret
  const turret = new THREE.Group();
  turret.position.set(0.1, 0.55, 0);
  body.add(turret);
  put(turret, cyl(0.9, 0.18, C.joint, { seg: 16 }), 0, 0.09, 0); // the ring
  put(turret, box(2.4, 0.7, 1.6, C.hull, { r: 0.03 }), -0.1, 0.5, 0);
  put(turret, box(2.0, 0.12, 1.3, C.panel, { r: 0.02 }), -0.2, 0.9, 0);
  const tn = put(turret, box(0.7, 0.55, 1.4, C.panel, { r: 0.03 }), 1.2, 0.45, 0);
  tn.rotation.z = -0.4;
  // the sensor block on the front left: a searchlight lens, glowing
  put(turret, box(0.6, 0.4, 0.42, C.dark, { r: 0.02 }), 1.25, 0.4, -0.72);
  const lamp = put(turret, cyl(0.13, 0.05, C.lamp, { axis: 'x', seg: 12, glow: true }), 1.57, 0.4, -0.72);
  glowy.push(lamp);
  // greebles: boxes, a pipe loop, bolts
  put(turret, box(0.5, 0.3, 0.4, C.joint, { r: 0.02 }), -0.6, 1.0, 0.45);
  put(turret, cyl(0.06, 1.0, C.dark, { axis: 'z', seg: 6 }), -0.9, 0.95, 0);
  for (const z of [-0.6, 0.6]) put(turret, cyl(0.1, 0.06, C.dark, { axis: 'z', seg: 8 }), 0.4, 0.55, z * 1.38);
  // the sensor dome at the back, with its red eye, a mast
  put(turret, box(0.5, 0.4, 0.5, C.joint, { r: 0.04 }), -0.85, 1.1, -0.35);
  put(turret, new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), toon(C.panel)), -0.85, 1.48, -0.35);
  const eye = put(turret, cyl(0.1, 0.04, C.eye, { axis: 'x', seg: 10, glow: true }), -0.55, 1.5, -0.35);
  glowy.push(eye);
  put(turret, cyl(0.025, 1.6, C.dark, { seg: 5 }), -1.1, 1.8, 0.55);
  // the main gun: a long barrel out of a heavy mantlet, a big muzzle brake
  const gun = new THREE.Group();
  gun.position.set(1.0, 0.6, 0.15);
  turret.add(gun);
  put(gun, box(0.6, 0.5, 0.6, C.panel, { r: 0.03 }), 0.2, 0, 0);
  put(gun, cyl(0.16, 0.8, C.gun, { axis: 'x', seg: 10 }), 0.85, 0, 0);
  put(gun, cyl(0.1, 4.2, C.gun, { axis: 'x', seg: 10 }), 3.1, 0, 0);
  put(gun, cyl(0.13, 0.2, C.gun, { axis: 'x', seg: 10 }), 2.4, 0, 0); // a collar part way along
  for (const dx of [5.15, 5.45]) put(gun, box(0.16, 0.3, 0.34, C.gun, { r: 0.02 }), dx, 0, 0); // the brake
  put(gun, box(0.46, 0.08, 0.2, C.dark), 5.3, 0, 0);
  const cells = [-1, 1].map((s) => put(gun, box(0.5, 0.06, 0.03, C.eye, { r: 0.01, glow: true }), 0.2, -0.05, s * 0.31));
  glowy.push(...cells);
  const muzzleGlow = put(gun, box(0.2, 0.2, 0.2, 0xffffff, { glow: true, r: 0.04 }), 5.6, 0, 0);
  muzzleGlow.visible = false;
  glowy.push(muzzleGlow);

  // --------------------------------------------------------------- the legs
  // each: a turning hip hub on the hull's corner, an open box-girder thigh,
  // a big round knee, a broad armoured shin (hazard stripes, a piston up
  // its back) down to a two-toed claw
  const legs = [];
  for (const L of LEGS) {
    const [hx, hy, hz] = L.hip;
    put(body, cyl(0.5, 0.5, C.joint, { seg: 12 }), hx, hy, hz); // the hip's turning hub
    put(body, cyl(0.3, 0.56, C.dark, { seg: 10 }), hx, hy, hz);
    put(body, box(0.5, 0.12, 0.5, C.hazard, { r: 0.02 }), hx, hy + 0.3, hz);
    const thigh = new THREE.Group();
    group.add(thigh);
    // an open girder: two side rails, top and bottom chords, braces
    for (const sx of [-1, 1]) put(thigh, box(0.08, 0.5, THIGH, C.hull, { r: 0.02 }), sx * 0.22, 0, THIGH / 2);
    for (const sy of [-1, 1]) put(thigh, box(0.5, 0.08, THIGH, C.panel, { r: 0.02 }), 0, sy * 0.24, THIGH / 2);
    for (let k = 0; k < 3; k++) {
      const br = put(thigh, box(0.06, 0.06, 0.62, C.dark), 0, 0, 0.35 + k * 0.55);
      br.rotation.x = k % 2 ? 0.75 : -0.75;
    }
    put(thigh, cyl(0.06, THIGH * 0.85, C.dark, { axis: 'z', seg: 6 }), 0, -0.36, THIGH * 0.45); // a hydraulic line under it
    const knee = new THREE.Group();
    group.add(knee);
    put(knee, cyl(0.42, 0.72, C.joint, { axis: 'x', seg: 14 }), 0, 0, 0);
    put(knee, cyl(0.24, 0.78, C.dark, { axis: 'x', seg: 10 }), 0, 0, 0);
    for (const sx of [-1, 1]) put(knee, cyl(0.12, 0.04, C.hazard, { axis: 'x', seg: 10 }), sx * 0.4, 0, 0);
    const shin = new THREE.Group();
    group.add(shin);
    put(shin, box(0.78, 0.36, SHIN * 0.92, C.hull, { r: 0.04 }), 0, 0, SHIN * 0.46);
    put(shin, box(0.84, 0.2, SHIN * 0.5, C.panel, { r: 0.03 }), 0, 0.18, SHIN * 0.42); // the armour plate on its face
    for (let k = 0; k < 3; k++) put(shin, box(0.1, 0.03, 0.26, k % 2 ? C.dark : C.hazard), -0.3 + k * 0.1, 0.29, SHIN * 0.7); // hazard stripes
    put(shin, box(0.5, 0.05, 0.3, C.dark, { r: 0.01 }), 0, 0.29, SHIN * 0.25); // a vent
    put(shin, cyl(0.08, SHIN * 0.55, C.dark, { axis: 'z', seg: 8 }), 0, -0.3, SHIN * 0.32); // the piston
    put(shin, cyl(0.05, SHIN * 0.35, 0x9a9488, { axis: 'z', seg: 6 }), 0, -0.3, SHIN * 0.68); // its rod
    // the claw: a pad and two toes
    put(shin, box(0.9, 0.5, 0.36, C.joint, { r: 0.04 }), 0, 0, SHIN * 0.94);
    for (const sx of [-1, 1]) {
      const toe = put(shin, box(0.3, 0.3, 0.4, C.dark, { r: 0.03 }), sx * 0.3, -0.05, SHIN + 0.05);
      toe.rotation.y = sx * 0.2;
    }
    legs.push({ ...L, thigh, knee, shin });
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
  const bW = new THREE.Vector3();
  const lay = (seg, a, b) => {
    seg.position.copy(a);
    seg.lookAt(group.localToWorld(bW.copy(b)));
  };
  const inv = new THREE.Matrix4();
  function poseLegs(lift) {
    group.updateWorldMatrix(true, true);
    inv.copy(group.matrixWorld).invert();
    for (const L of legs) {
      hipW.set(L.hip[0], L.hip[1], L.hip[2]);
      body.localToWorld(hipW).applyMatrix4(inv);
      const s = Math.sin(walk + L.phase);
      const c = Math.cos(walk + L.phase);
      footW.set(L.foot[0] + s * 0.55 * lift, Math.max(0, c) * 0.5 * lift + 0.05, L.foot[1]);
      // the knee: up and out between them
      const d = hipW.distanceTo(footW);
      const a = Math.min(THIGH, (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d));
      const h = Math.sqrt(Math.max(0.01, THIGH * THIGH - a * a));
      const dir = v.copy(footW).sub(hipW).normalize();
      // the knee bends up, in the plane of the leg (a high, sharp angle)
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const bend = new THREE.Vector3().crossVectors(side, dir).normalize();
      if (bend.y < 0) bend.negate();
      kneeW.copy(hipW).addScaledVector(dir, a).addScaledVector(bend, h);
      lay(L.thigh, hipW, kneeW);
      L.knee.position.copy(kneeW);
      L.knee.quaternion.copy(L.thigh.quaternion);
      lay(L.shin, kneeW, footW);
    }
  }
  poseLegs(0);

  // ctx: { speed, aimYaw, aimPitch, recoil, charge (the gun lining up),
  // rockets (a salvo coming) }
  function update(dt, t, ctx = {}) {
    if (deadT >= 0) {
      deadT += dt;
      return;
    }
    const speed = ctx.speed || 0;
    walk += dt * (1.4 + speed * 3.4);
    const lift = Math.min(1, speed * 1.6);
    body.position.y = BODY_Y + Math.abs(Math.sin(walk)) * 0.08 * lift + Math.sin(t * 1.3) * 0.03;
    body.rotation.z = Math.sin(walk * 2) * 0.015 * lift;
    let d = (ctx.aimYaw ?? 0) - turret.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    turret.rotation.y += d * Math.min(1, dt * 2.2);
    gun.rotation.z = THREE.MathUtils.lerp(gun.rotation.z, ctx.aimPitch ?? 0, Math.min(1, dt * 4));
    recoil = Math.max(recoil, ctx.recoil || 0);
    recoil = Math.max(0, recoil - dt * 2.5);
    gun.position.x = 1.0 - recoil * 0.45;
    const charge = ctx.charge || 0;
    for (const c of cells) c.scale.set(1, 1 + charge * 2, 1 + charge);
    muzzleGlow.visible = charge > 0.05;
    muzzleGlow.scale.setScalar(0.4 + charge * 1.4);
    for (const g of podGlow) g.visible = (ctx.rockets || 0) > 0.02 && Math.sin(t * 24) > -0.3;
    eye.scale.set(1, 1, 0.8 + Math.sin(t * 6) * 0.2 + charge * 0.6);
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
    for (const e of [eye, ...cells, lamp]) e.material = toon(C.dead);
    muzzleGlow.visible = false;
    for (const g of podGlow) g.visible = false;
  }

  const tmp = new THREE.Vector3();
  function muzzle() {
    group.updateWorldMatrix(true, true);
    return gun.localToWorld(tmp.set(5.6, 0, 0)).clone();
  }
  let podN = 0;
  function rocketMuzzle() {
    group.updateWorldMatrix(true, true);
    const p = pods[podN % 2];
    const m = p.mouths[(podN >> 1) % p.mouths.length];
    podN++;
    return m.getWorldPosition(new THREE.Vector3());
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return lamp.getWorldPosition(new THREE.Vector3());
  }

  return { group, update, hitFlash, kill, setOutline, muzzle, rocketMuzzle, eyeWorld, events: [] };
}
