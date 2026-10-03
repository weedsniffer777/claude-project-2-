// Robot dog: the first machine the player meets. A low quadruped with a
// camera-box head (one big red eye) and a rifle mounted on its back.
// Front of the dog is +X. Legs trot in diagonal pairs while it moves.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  hull: 0x3e4247,
  panel: 0x5d6369,
  dark: 0x1f2124,
  joint: 0x2b2d30,
  gun: 0x26282b,
  eye: 0xff2a1f,
  dead: 0x2a1614,
};

const HIP_Y = 0.62;
const THIGH = 0.3;
const SHIN = 0.32;

export function createDog() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // bobs and leans; holds everything but the legs' hips
  body.position.y = HIP_Y;
  group.add(body);

  // torso: a chunky armoured box with a lighter spine plate
  put(body, box(0.95, 0.3, 0.42, C.hull, { r: 0.07 }), 0, 0.06, 0);
  put(body, box(0.7, 0.06, 0.3, C.panel, { r: 0.02 }), -0.02, 0.23, 0);
  put(body, box(0.18, 0.22, 0.46, C.joint, { r: 0.04 }), 0.42, 0.02, 0); // shoulder block
  put(body, box(0.16, 0.2, 0.46, C.joint, { r: 0.04 }), -0.42, 0.02, 0); // hip block
  for (const s of [-1, 1]) put(body, box(0.5, 0.14, 0.03, C.panel, { r: 0.01 }), 0, 0.04, s * 0.22); // side armour
  // battery pack and a whip antenna at the back
  put(body, box(0.24, 0.12, 0.24, C.dark, { r: 0.03 }), -0.34, 0.26, 0);
  const antenna = put(body, cyl(0.012, 0.5, C.dark, { seg: 4 }), -0.42, 0.55, 0.08);

  // the rifle on a short mount, along the spine
  const mount = new THREE.Group();
  mount.position.set(0.05, 0.3, 0);
  body.add(mount);
  put(mount, box(0.12, 0.1, 0.1, C.joint, { r: 0.02 }), 0, 0, 0);
  const rifle = new THREE.Group();
  rifle.position.y = 0.09;
  mount.add(rifle);
  put(rifle, box(0.42, 0.09, 0.08, C.gun, { r: 0.02 }), 0.05, 0, 0); // receiver
  put(rifle, box(0.08, 0.14, 0.05, C.gun, { r: 0.01 }), 0.0, -0.09, 0); // magazine
  put(rifle, cyl(0.022, 0.55, C.gun, { axis: 'x', seg: 6 }), 0.52, 0.01, 0); // barrel
  put(rifle, cyl(0.035, 0.08, C.dark, { axis: 'x', seg: 6 }), 0.8, 0.01, 0); // muzzle brake
  put(rifle, box(0.1, 0.05, 0.05, C.dark, { r: 0.01 }), 0.12, 0.07, 0); // optic

  // neck and the camera head: one big red eye, a small lens beside it
  const neck = new THREE.Group();
  neck.position.set(0.5, 0.12, 0);
  body.add(neck);
  put(neck, box(0.14, 0.1, 0.12, C.joint, { r: 0.03 }), 0.04, 0.04, 0);
  const head = new THREE.Group();
  head.position.set(0.14, 0.1, 0);
  neck.add(head);
  put(head, box(0.3, 0.22, 0.26, C.hull, { r: 0.05 }), 0.06, 0, 0);
  put(head, box(0.04, 0.17, 0.2, C.dark, { r: 0.02 }), 0.21, 0, 0); // face plate
  const eye = put(head, cyl(0.07, 0.05, C.eye, { axis: 'x', seg: 10, glow: true }), 0.235, 0.01, -0.03);
  const eyeRing = put(head, cyl(0.09, 0.03, C.dark, { axis: 'x', seg: 10 }), 0.222, 0.01, -0.03);
  eyeRing.scale.set(1, 1, 1);
  const pupil = put(head, cyl(0.025, 0.04, C.eye, { axis: 'x', seg: 6, glow: true }), 0.235, -0.05, 0.08);
  put(head, box(0.12, 0.04, 0.2, C.panel, { r: 0.01 }), 0.02, 0.13, 0); // visor brow

  // legs: hip -> thigh -> knee -> shin -> foot. Front knees bend back,
  // rear knees bend forward, like a dog.
  const legs = [];
  for (const [lx, lz, front, phase] of [
    [0.36, 0.25, true, 0],
    [0.36, -0.25, true, Math.PI],
    [-0.36, 0.25, false, Math.PI],
    [-0.36, -0.25, false, 0],
  ]) {
    const hip = new THREE.Group();
    hip.position.set(lx, HIP_Y, lz);
    group.add(hip);
    put(hip, box(0.12, 0.12, 0.08, C.joint, { r: 0.03 }), 0, 0, 0);
    put(hip, box(0.09, THIGH, 0.08, C.hull, { r: 0.03 }), 0, -THIGH / 2, 0);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    hip.add(knee);
    put(knee, box(0.08, 0.08, 0.08, C.joint, { r: 0.03 }), 0, 0, 0);
    put(knee, box(0.06, SHIN, 0.06, C.panel, { r: 0.02 }), 0, -SHIN / 2, 0);
    put(knee, box(0.12, 0.05, 0.09, C.dark, { r: 0.02 }), 0.02, -SHIN, 0);
    legs.push({ hip, knee, front, phase });
  }

  group.traverse((m) => {
    if (m.isMesh && m.material !== glowMat(C.eye)) m.castShadow = true;
  });

  let gait = 0;
  let flash = 0;
  let deadT = -1;
  const flashMats = new Map();

  // ctx: { speed (0..1 of a run), aimYaw (head/rifle yaw relative to body),
  // aimPitch, recoil (0..1) }
  function update(dt, t, ctx = {}) {
    if (deadT >= 0) {
      // collapse: body drops, legs splay, settles
      deadT += dt;
      const k = Math.min(1, deadT / 0.35);
      body.position.y = HIP_Y - k * 0.42;
      body.rotation.z = -k * 0.25;
      body.rotation.x = k * 0.18;
      for (const l of legs) {
        l.hip.position.y = HIP_Y - k * 0.4;
        l.hip.rotation.z = (l.front ? -1 : 1) * k * 1.2;
        l.knee.rotation.z = (l.front ? 1 : -1) * k * 0.9;
        l.hip.rotation.x = Math.sign(l.hip.position.z) * k * 0.5;
      }
      neck.rotation.z = -k * 0.6;
      return;
    }
    const speed = ctx.speed ?? 0;
    gait += dt * (4 + speed * 10);
    const swing = 0.55 * speed;
    for (const l of legs) {
      const s = Math.sin(gait + l.phase);
      const lift = Math.max(0, Math.cos(gait + l.phase));
      l.hip.rotation.z = s * swing;
      l.knee.rotation.z = (l.front ? 1 : -1) * (0.35 + lift * 0.6 * speed);
      l.hip.position.y = HIP_Y;
    }
    // bounce and a slight forward lean while running; a breathing idle
    body.position.y = HIP_Y - 0.05 + Math.abs(Math.sin(gait)) * 0.05 * speed + Math.sin(t * 3) * 0.008;
    body.rotation.z = -0.08 * speed + Math.sin(gait * 2) * 0.03 * speed;
    // head and rifle track the target
    const yaw = THREE.MathUtils.clamp(ctx.aimYaw ?? 0, -1.2, 1.2);
    neck.rotation.y += (yaw - neck.rotation.y) * Math.min(1, dt * 10);
    mount.rotation.y += (yaw - mount.rotation.y) * Math.min(1, dt * 8);
    rifle.rotation.z = THREE.MathUtils.clamp(ctx.aimPitch ?? 0, -0.4, 0.4);
    rifle.position.x = -(ctx.recoil ?? 0) * 0.08;
    antenna.rotation.z = Math.sin(t * 9 + gait) * 0.15 * (0.3 + speed);
    // eye pulses; flicks brighter when shooting
    const pulse = 0.85 + Math.sin(t * 6) * 0.15;
    eye.scale.set(1, pulse, pulse);
    pupil.visible = Math.sin(t * 2.3) > -0.6;
    // white hit flash
    if (flash > 0) {
      flash -= dt;
      if (flash <= 0) group.traverse((m) => m.isMesh && flashMats.has(m) && (m.material = flashMats.get(m)));
    }
  }

  function hitFlash() {
    if (deadT >= 0) return;
    if (flash <= 0) {
      const white = glowMat(0xf4f1ea);
      group.traverse((m) => {
        if (!m.isMesh || m === eye || m === pupil) return;
        flashMats.set(m, m.material);
        m.material = white;
      });
    }
    flash = 0.06;
  }

  function kill() {
    if (flash > 0) {
      flash = 0;
      group.traverse((m) => m.isMesh && flashMats.has(m) && (m.material = flashMats.get(m)));
    }
    deadT = 0;
    eye.material = toon(C.dead);
    pupil.material = toon(C.dead);
  }

  // world position of the rifle muzzle and the eye
  const tmp = new THREE.Vector3();
  function muzzle() {
    group.updateWorldMatrix(true, true);
    return rifle.localToWorld(tmp.set(0.86, 0.01, 0)).clone();
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return eye.getWorldPosition(new THREE.Vector3());
  }

  return { group, update, hitFlash, kill, muzzle, eyeWorld, events: [] };
}
