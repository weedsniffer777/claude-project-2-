// The gunship: a drone aircraft, not a quad-rotor. A long angular
// fuselage (a sharp nose with a red sensor eye and an orange tip, a chin
// gun turret under it, a spine with vents, a tail boom out to a V tail),
// and either side a big ducted fan on a pylon, the ring tilting with its
// flight (forward when it moves, level when it hangs to fire). Rocket pods
// under the pylons. Grey with orange accents. Front is +X.
// Same interface as the other machines: update, hitFlash, kill, setOutline,
// muzzle (the rocket pods, alternating), gunMuzzle (the chin gun), eyeWorld.
import * as THREE from 'three';
import { box, cyl, put, toon, glowMat } from './kit.js';

const C = {
  hull: 0x4c5158,
  panel: 0x5d636b,
  dark: 0x1f2124,
  trim: 0xd9792a, // orange
  duct: 0x3d4248,
  glow: 0x6fb8ff, // the fans' inner glow
  eye: 0xff2a1f,
  dead: 0x2a1614,
};

export function createGunship() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const glowy = [];

  // ---------------------------------------------------------- fuselage
  put(body, box(1.0, 0.26, 0.42, C.hull, { r: 0.04 }), 0, 0, 0);
  put(body, box(0.8, 0.12, 0.34, C.panel, { r: 0.03 }), -0.05, 0.18, 0); // the spine
  for (let k = 0; k < 3; k++) put(body, box(0.05, 0.04, 0.24, C.dark), -0.2 + k * 0.1, 0.25, 0); // vents
  const nose = put(body, box(0.4, 0.2, 0.34, C.hull, { r: 0.04 }), 0.62, -0.02, 0);
  nose.rotation.z = -0.22;
  const tip = put(body, box(0.18, 0.12, 0.22, C.trim, { r: 0.03 }), 0.84, -0.07, 0);
  tip.rotation.z = -0.3;
  put(body, box(0.1, 0.06, 0.18, C.dark, { r: 0.02 }), 0.72, 0.05, 0); // the canopy slit
  const eye = put(body, box(0.03, 0.05, 0.1, C.eye, { r: 0.01, glow: true }), 0.92, -0.08, 0);
  glowy.push(eye);
  // orange stripes and a warning chevron on the flanks
  for (const s of [-1, 1]) {
    put(body, box(0.5, 0.03, 0.02, C.trim), 0.1, 0.08, s * 0.215);
    put(body, box(0.08, 0.08, 0.02, C.trim), -0.32, -0.02, s * 0.215);
  }
  // the tail boom and its V tail
  put(body, box(0.7, 0.1, 0.12, C.hull, { r: 0.03 }), -0.82, 0.08, 0);
  for (const s of [-1, 1]) {
    const fin = put(body, box(0.3, 0.32, 0.04, C.panel, { r: 0.02 }), -1.1, 0.24, s * 0.1);
    fin.rotation.x = s * 0.55;
    put(body, box(0.1, 0.12, 0.045, C.trim), -1.18, 0.34, s * 0.16).rotation.x = s * 0.55;
  }
  // the chin gun: a little turret, two barrels
  const turret = new THREE.Group();
  turret.position.set(0.5, -0.2, 0);
  body.add(turret);
  put(turret, cyl(0.08, 0.08, C.dark, { seg: 10 }), 0, 0, 0);
  put(turret, box(0.14, 0.08, 0.1, C.panel, { r: 0.02 }), 0.05, -0.05, 0);
  for (const s of [-1, 1]) put(turret, cyl(0.015, 0.3, C.dark, { axis: 'x', seg: 5 }), 0.25, -0.05, s * 0.025);
  const gunFlash = put(turret, box(0.08, 0.08, 0.08, 0xffd27a, { glow: true }), 0.42, -0.05, 0);
  gunFlash.visible = false;
  glowy.push(gunFlash);

  // ---------------------------------------------- the ducted fans
  const fans = [];
  const DUCT_R = 0.34;
  for (const s of [-1, 1]) {
    // pylon out from the fuselage
    put(body, box(0.28, 0.08, 0.36, C.panel, { r: 0.02 }), 0.02, 0.02, s * 0.36);
    const pivot = new THREE.Group();
    pivot.position.set(0.02, 0.04, s * (0.42 + DUCT_R));
    body.add(pivot);
    // the ring: a torus lying flat (axis up), its inner glow, the fan
    const ring = new THREE.Mesh(new THREE.TorusGeometry(DUCT_R, 0.07, 6, 20).rotateX(Math.PI / 2), toon(C.duct));
    pivot.add(ring);
    pivot.add(new THREE.Mesh(new THREE.TorusGeometry(DUCT_R + 0.02, 0.025, 4, 20).rotateX(Math.PI / 2).translate(0, 0.07, 0), toon(C.trim))); // its orange lip
    const inner = new THREE.Mesh(new THREE.TorusGeometry(DUCT_R - 0.05, 0.02, 4, 20).rotateX(Math.PI / 2), glowMat(C.glow));
    pivot.add(inner);
    glowy.push(inner);
    put(pivot, cyl(0.06, 0.1, C.dark, { seg: 8 }), 0, 0, 0); // the hub
    const blades = new THREE.Group();
    pivot.add(blades);
    for (let k = 0; k < 3; k++) put(blades, box(DUCT_R * 1.7, 0.012, 0.06, C.dark), 0, 0.01, 0).rotation.y = (k / 3) * Math.PI;
    const blur = new THREE.Mesh(new THREE.CylinderGeometry(DUCT_R - 0.04, DUCT_R - 0.04, 0.01, 18), new THREE.MeshBasicMaterial({ color: 0xb9c4cc, transparent: true, opacity: 0.22, depthWrite: false }));
    blur.userData.outline = true;
    pivot.add(blur);
    // the ring's struts back to the pylon
    put(pivot, box(0.06, 0.06, DUCT_R * 2, C.duct), 0, 0, 0);
    fans.push({ pivot, blades, s });
    // a rocket pod under the pylon: four tubes, a glow for the charge
    put(body, box(0.42, 0.14, 0.16, C.dark, { r: 0.03 }), 0.1, -0.12, s * 0.36);
    for (const dz of [-0.04, 0.04]) for (const dy of [-0.04, 0.03]) put(body, cyl(0.025, 0.04, 0x0e0f11, { axis: 'x', seg: 6 }), 0.32, -0.12 + dy, s * 0.36 + dz);
  }
  const podGlow = [-1, 1].map((s) => {
    const g = put(body, box(0.02, 0.12, 0.14, C.eye, { r: 0.005, glow: true }), 0.33, -0.12, s * 0.36);
    g.visible = false;
    return g;
  });
  glowy.push(...podGlow);
  // its shadow on the ground below
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.scale.set(1.3, 1, 1);
  shadow.userData.outline = true;
  group.add(shadow);
  group.traverse((m) => {
    if (m.isMesh && !m.material.transparent && !glowy.includes(m)) m.castShadow = true;
  });

  let flash = 0;
  let deadT = -1;
  let deadY = 0;
  let floorY = 0.2;
  let gunT = 0;
  const flashMats = new Map();
  let spin = 0;
  let lean = 0; // the fans' forward tilt

  // ctx: { speed (0..1), tilt (radians), aimYaw (relative), charge (0..1),
  // height (above the ground), firing (the chin gun) }
  function update(dt, t, ctx = {}) {
    if (ctx.height != null) {
      const s = group.scale.y || 1;
      shadow.position.y = (-ctx.height + 0.05) / s;
      shadow.material.opacity = Math.max(0.08, 0.32 - ctx.height * 0.025);
    }
    if (deadT >= 0) {
      deadT += dt;
      const k = Math.min(1, deadT / 0.9);
      group.position.y = deadY - (deadY - floorY) * k * k;
      shadow.visible = false;
      body.rotation.z = -k * 0.9;
      body.rotation.x = k * 0.7;
      for (const f of fans) f.blades.rotation.y += dt * 18 * (1 - k);
      return;
    }
    const charge = ctx.charge ?? 0;
    spin += dt * 38;
    for (const f of fans) f.blades.rotation.y = spin * f.s;
    // the fans tilt forward with the speed (thrust forward), level to hover
    lean = THREE.MathUtils.lerp(lean, -(ctx.speed ?? 0) * 0.9, Math.min(1, dt * 3));
    for (const f of fans) f.pivot.rotation.z = lean;
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -(ctx.tilt ?? 0) * 0.5, Math.min(1, dt * 4));
    body.rotation.x = Math.sin(t * 1.7) * 0.05;
    body.position.y = Math.sin(t * 2.2) * 0.06;
    let d = (ctx.aimYaw ?? 0) - body.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    body.rotation.y += d * Math.min(1, dt * 3);
    for (const g of podGlow) {
      g.visible = charge > 0.02;
      g.scale.set(1, 0.6 + charge, 0.6 + charge);
    }
    // the chin gun: swings to aim, flashes as it fires
    turret.rotation.y = THREE.MathUtils.lerp(turret.rotation.y, 0, Math.min(1, dt * 6));
    gunT = Math.max(0, gunT - dt);
    gunFlash.visible = gunT > 0 && Math.random() < 0.7;
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
        if (!m.isMesh || glowy.includes(m) || m.material.transparent || m.material.visible === false || m.userData.outline) return;
        flashMats.set(m, m.material);
        m.material = white;
      });
    }
    flash = 0.06;
  }

  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xf1e9d8, side: THREE.BackSide });
  const outlines = [];
  body.traverse((m) => {
    if (!m.isMesh || glowy.includes(m) || m.material.transparent || m.material.visible === false || m.userData.outline) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const size = m.geometry.boundingBox.getSize(new THREE.Vector3());
    const o = new THREE.Mesh(m.geometry, outlineMat);
    o.scale.set((size.x + 0.04) / Math.max(size.x, 0.01), (size.y + 0.04) / Math.max(size.y, 0.01), (size.z + 0.04) / Math.max(size.z, 0.01));
    o.userData.outline = true;
    o.visible = false;
    outlines.push({ o, parent: m });
  });
  for (const { o, parent } of outlines) parent.add(o);
  function setOutline(on) {
    for (const { o } of outlines) o.visible = on && deadT < 0;
  }

  function kill(floor = 0) {
    floorY = floor + 0.2;
    setOutline(false);
    for (const { o } of outlines) o.removeFromParent();
    if (flash > 0) {
      flash = 0;
      group.traverse((m) => m.isMesh && flashMats.has(m) && (m.material = flashMats.get(m)));
    }
    deadT = 0;
    deadY = group.position.y;
    eye.material = toon(C.dead);
    gunFlash.visible = false;
    for (const g of podGlow) g.visible = false;
  }

  const tmp = new THREE.Vector3();
  let side = 1;
  function muzzle() {
    group.updateWorldMatrix(true, true);
    side = -side;
    return body.localToWorld(tmp.set(0.36, -0.12, side * 0.36)).clone();
  }
  function gunMuzzle() {
    group.updateWorldMatrix(true, true);
    gunT = 0.08;
    return turret.localToWorld(tmp.set(0.42, -0.05, 0)).clone();
  }
  function eyeWorld() {
    group.updateWorldMatrix(true, true);
    return eye.getWorldPosition(new THREE.Vector3());
  }

  return { group, update, hitFlash, kill, setOutline, muzzle, gunMuzzle, eyeWorld, events: [] };
}
