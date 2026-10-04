// Attack drone: a squat quad-rotor gunship. A flat armoured body with a red
// sensor eye in its nose, four arms with motors and blurred rotor discs,
// a rocket pod slung under each side (three tubes each), skids. Front is +X.
// It flies: the enemy code keeps its group up in the air; the model tilts
// into its movement, its pods glow while it lines up a salvo (ctx.charge),
// and when killed it tumbles down to the ground.
// Same interface as the other machines: update, hitFlash, kill, setOutline,
// muzzle, eyeWorld.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  hull: 0x4a4f55,
  panel: 0x5f666d,
  dark: 0x1f2124,
  pod: 0x3a3f36,
  eye: 0xff2a1f,
  dead: 0x2a1614,
};

export function createDrone() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // tilts and bobs
  group.add(body);
  put(body, box(0.7, 0.18, 0.46, C.hull, { r: 0.05 }), 0, 0, 0);
  put(body, box(0.5, 0.1, 0.34, C.panel, { r: 0.03 }), -0.05, 0.13, 0); // the top deck
  put(body, box(0.22, 0.14, 0.3, C.hull, { r: 0.04 }), 0.38, -0.02, 0).rotation.z = -0.35; // the sloped nose
  put(body, box(0.08, 0.1, 0.16, C.dark, { r: 0.02 }), 0.48, -0.06, 0);
  const eye = put(body, box(0.03, 0.05, 0.1, C.eye, { r: 0.01, glow: true }), 0.52, -0.06, 0);
  const antenna = put(body, cyl(0.01, 0.3, C.dark, { seg: 4 }), -0.25, 0.3, 0.1);
  // four arms out to the motors, rotors spinning on top
  const rotors = [];
  for (const [ax, az] of [[0.36, 0.36], [0.36, -0.36], [-0.36, 0.36], [-0.36, -0.36]]) {
    const arm = put(body, box(0.5, 0.05, 0.07, C.dark, { r: 0.02 }), ax / 2, 0.04, az / 2);
    arm.rotation.y = -Math.atan2(az, ax);
    put(body, cyl(0.06, 0.1, C.panel, { seg: 8 }), ax, 0.08, az); // the motor
    const rotor = new THREE.Group();
    rotor.position.set(ax, 0.15, az);
    body.add(rotor);
    // the blur of the blades, and two blades you can just make out
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.01, 18), new THREE.MeshBasicMaterial({ color: 0xb9b3a8, transparent: true, opacity: 0.22, depthWrite: false }));
    disc.userData.outline = true;
    rotor.add(disc);
    put(rotor, box(0.46, 0.012, 0.04, C.dark, { r: 0.005 }), 0, 0.01, 0).userData.noOutline = true;
    rotors.push(rotor);
  }
  // the rocket pods under each side, three tubes each, glowing as it charges
  const podGlow = [];
  for (const s of [-1, 1]) {
    put(body, box(0.4, 0.14, 0.16, C.pod, { r: 0.03 }), 0.05, -0.16, s * 0.3);
    put(body, box(0.06, 0.06, 0.08, C.dark, { r: 0.01 }), 0.0, -0.08, s * 0.3); // its hardpoint
    for (const k of [-1, 0, 1]) put(body, cyl(0.03, 0.04, C.dark, { axis: 'x', seg: 6 }), 0.26, -0.16 + (k === 0 ? 0.04 : -0.02), s * 0.3 + k * 0.045);
    podGlow.push(put(body, box(0.02, 0.1, 0.12, C.eye, { r: 0.005, glow: true }), 0.27, -0.16, s * 0.3));
  }
  // skids
  for (const s of [-1, 1]) {
    put(body, box(0.6, 0.03, 0.03, C.dark, { r: 0.01 }), 0, -0.3, s * 0.18);
    for (const x of [-0.18, 0.18]) put(body, box(0.03, 0.14, 0.03, C.dark, { r: 0.01 }), x, -0.24, s * 0.18);
  }
  for (const g of podGlow) g.visible = false;
  // its shadow on the ground below (so you can tell how high it is)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.userData.outline = true; // (left out of flashes and outlines)
  group.add(shadow);

  group.traverse((m) => {
    if (m.isMesh && !m.material.transparent && m !== eye && !podGlow.includes(m)) m.castShadow = true;
  });

  let flash = 0;
  let deadT = -1;
  let deadY = 0;
  const flashMats = new Map();
  let spin = 0;

  // ctx: { speed (0..1), tilt (radians, into the move), aimYaw (relative),
  // charge (0..1: lining up a salvo), height (above the ground) }
  function update(dt, t, ctx = {}) {
    if (ctx.height != null) {
      const s = group.scale.y || 1;
      shadow.position.y = (-ctx.height + 0.05) / s;
      shadow.material.opacity = Math.max(0.08, 0.32 - ctx.height * 0.03);
    }
    if (deadT >= 0) {
      // it tumbles down out of the air and lies there
      deadT += dt;
      const k = Math.min(1, deadT / 0.7);
      group.position.y = deadY - (deadY - floorY) * k * k;
      shadow.visible = false;
      body.rotation.z = -k * 1.2;
      body.rotation.x = k * 0.6;
      for (const r of rotors) r.rotation.y += dt * 20 * (1 - k);
      return;
    }
    const charge = ctx.charge ?? 0;
    spin += dt * 40;
    for (const [i, r] of rotors.entries()) r.rotation.y = spin * (i % 2 ? -1 : 1);
    // nose down into the move, a little roll as it banks
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -(ctx.tilt ?? 0), Math.min(1, dt * 6));
    body.rotation.x = Math.sin(t * 2.3) * 0.04;
    body.position.y = Math.sin(t * 3.1) * 0.05;
    let d = (ctx.aimYaw ?? 0) - body.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    body.rotation.y += d * Math.min(1, dt * 6);
    antenna.rotation.z = Math.sin(t * 9) * 0.1;
    for (const g of podGlow) {
      g.visible = charge > 0.02;
      g.scale.set(1, 0.6 + charge, 0.6 + charge);
    }
    eye.scale.set(1, 0.8 + Math.sin(t * 7) * 0.2 + charge, 1);
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
        if (!m.isMesh || m === eye || podGlow.includes(m) || m.material.transparent || m.material.visible === false || m.userData.outline) return;
        flashMats.set(m, m.material);
        m.material = white;
      });
    }
    flash = 0.06;
  }

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xf1e9d8, side: THREE.BackSide });
  const outlines = [];
  body.traverse((m) => {
    if (!m.isMesh || m === eye || podGlow.includes(m) || m.material.transparent || m.material.visible === false || m.userData.outline || m.userData.noOutline) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const size = m.geometry.boundingBox.getSize(new THREE.Vector3());
    const o = new THREE.Mesh(m.geometry, outlineMat);
    o.scale.set((size.x + 0.05) / Math.max(size.x, 0.01), (size.y + 0.05) / Math.max(size.y, 0.01), (size.z + 0.05) / Math.max(size.z, 0.01));
    o.userData.outline = true;
    o.visible = false;
    outlines.push({ o, parent: m });
  });
  for (const { o, parent } of outlines) parent.add(o);
  function setOutline(on) {
    for (const { o } of outlines) o.visible = on && deadT < 0;
  }

  let floorY = 0.15;
  // floor: the ground height under it (it falls to there)
  function kill(floor = 0) {
    floorY = floor + 0.15;
    setOutline(false);
    for (const { o } of outlines) o.removeFromParent();
    if (flash > 0) {
      flash = 0;
      group.traverse((m) => m.isMesh && flashMats.has(m) && (m.material = flashMats.get(m)));
    }
    deadT = 0;
    deadY = group.position.y;
    eye.material = toon(C.dead);
    for (const g of podGlow) g.visible = false;
  }

  // the pods' mouths, alternating left and right
  const tmp = new THREE.Vector3();
  let side = 1;
  function muzzle() {
    group.updateWorldMatrix(true, true);
    side = -side;
    return body.localToWorld(tmp.set(0.32, -0.16, side * 0.3)).clone();
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return eye.getWorldPosition(new THREE.Vector3());
  }

  return { group, update, hitFlash, kill, setOutline, muzzle, eyeWorld, events: [] };
}
