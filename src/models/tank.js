// Starter tank: a patched-up, small-ized T-55. One version for now.
// Forward is +X, up is +Y, right is +Z.
//
// Proportions follow the T-55: wide and flat, hull top barely above the
// fenders, a low egg-shaped dome turret. "Small-ized" = oversized wheels, a
// fat short-ish gun, chunky details.
//
// Each of the seven loadout slots lives in its own group so variants can be
// swapped in later without touching the rest of the model:
//   tracks, armor, engine, gun, mg, sights, module
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { box, cyl, ellipsoid, toon, put, plate, wrapAngle, approachAngle } from './kit.js';

export const PALETTE = {
  olive: 0x62724a,
  oliveDark: 0x4b5839,
  oliveLight: 0x7c8c5c,
  tan: 0xb39d62,
  rust: 0x9c5a33,
  steel: 0x6a727b,
  dark: 0x262b32,
  wood: 0x7a5636,
  canvas: 0xa08a55,
  drumGreen: 0x587043,
  trackA: 0x2b2f35,
  trackB: 0x3b4047,
};
const C = PALETTE;

// Layout constants (world units; the tank is ~2.9 long, ~2.7 wide over the fenders).
const HULL_W = 0.78; // hull half-width
const HULL_TOP = 0.89; // top of the hull plate; turret ring sits here
const LINK_Z = 0.93; // track link centre line
const WHEEL_Z = 1.05; // wheel centre line (faces stick out past the links)
const WHEEL_R = 0.27;
const TURRET_X = 0.32;
const TURRET_SPEED = 3.2; // rad/s, gives the cannon some weight
const MG_SPEED = 9;
const GUN_BASE_X = 0.98;
const GUN_Y = 0.27;
const MUZZLE_X = 1.94;
const MG_X = -0.1;
const MG_Z = 0.34;
const MG_Y = 0.84;

export const SLOT_NAMES = ['tracks', 'armor', 'engine', 'gun', 'mg', 'sights', 'module'];

export function createTank() {
  const group = new THREE.Group();
  const chassis = new THREE.Group(); // everything that rocks on recoil
  group.add(chassis);

  const slots = {};
  for (const name of SLOT_NAMES) slots[name] = new THREE.Group();

  group.add(slots.tracks); // tracks stay on the ground
  chassis.add(slots.engine, slots.armor);

  const turret = new THREE.Group();
  turret.position.set(TURRET_X, HULL_TOP, 0);
  chassis.add(turret);
  turret.add(slots.gun, slots.sights, slots.mg, slots.module);

  const spinners = []; // wheel pivots that rotate while driving
  let gunPivot, gunFlash, mgPivot, mgFlash;

  // ---------------------------------------------------------------- hull
  const hull = new THREE.Group();
  chassis.add(hull);
  put(hull, box(2.5, 0.3, HULL_W * 1.95, C.dark, { r: 0.06 }), 0, 0.4, 0); // lower hull between the tracks
  put(hull, box(2.7, 0.34, HULL_W * 2, C.olive, { r: 0.12 }), 0, 0.72, 0);
  // sloped glacis
  const glacis = put(hull, box(0.62, 0.1, HULL_W * 1.94, C.oliveLight, { r: 0.05 }), 1.2, 0.83, 0);
  glacis.rotation.z = -0.5;
  // headlamps and tow hooks
  for (const s of [-1, 1]) {
    put(hull, box(0.1, 0.14, 0.18, C.dark), 1.34, 0.78, s * 0.56);
    put(hull, box(0.03, 0.09, 0.12, 0xfff2b8, { glow: true }), 1.405, 0.78, s * 0.56);
    put(hull, box(0.16, 0.1, 0.1, C.steel), 1.38, 0.6, s * 0.4);
  }
  // driver hatch + periscope on the glacis
  put(hull, cyl(0.15, 0.09, C.oliveDark), 0.78, HULL_TOP + 0.04, -0.3);
  put(hull, box(0.12, 0.1, 0.18, C.dark), 0.92, HULL_TOP + 0.06, -0.3);
  // rear plate
  put(hull, box(0.1, 0.34, HULL_W * 1.94, C.oliveDark), -1.36, 0.72, 0);

  // -------------------------------------------------------------- turret
  // Low, wide egg: the dome is wider than it is tall, which keeps the stout look.
  put(turret, cyl(0.7, 0.1, C.dark, { seg: 18 }), 0, 0.05, 0);
  put(turret, ellipsoid(1.0, 0.36, 0.95, C.olive), -0.05, 0.17, 0);
  put(turret, ellipsoid(0.58, 0.26, 0.7, C.oliveDark), -0.58, 0.15, 0);
  put(turret, cyl(0.29, 0.26, C.oliveDark, { axis: 'x', seg: 12 }), 0.9, GUN_Y, 0); // mantlet
  // commander cupola (right) and loader hatch (left)
  put(turret, cyl(0.2, 0.12, C.olive), MG_X, 0.54, MG_Z);
  put(turret, cyl(0.2, 0.05, C.oliveDark), MG_X, 0.61, MG_Z);
  put(turret, cyl(0.19, 0.08, C.oliveDark), -0.18, 0.52, -0.34);
  const lid = put(turret, box(0.36, 0.05, 0.3, C.olive), -0.38, 0.65, -0.34);
  lid.rotation.z = 0.7;
  put(turret, box(0.1, 0.09, 0.14, C.dark), 0.18, 0.5, -0.12); // periscope
  // tarp roll on the back of the bustle
  put(turret, cyl(0.09, 0.9, C.canvas, { axis: 'z', seg: 8 }), -1.03, 0.25, 0);
  // short whip antenna
  put(turret, cyl(0.04, 0.07, C.dark), -0.6, 0.48, -0.55);
  put(turret, cyl(0.012, 0.9, C.dark, { seg: 5 }), -0.6, 0.9, -0.55);

  // ---------------------------------------------------------------- tracks
  // Individual links follow the real path: along the top (with a little sag),
  // around the idler, back along the ground, around the drive sprocket.
  const TRACK = { x0: -1.3, x1: 1.3, yc: 0.3, R: 0.285, sag: 0.045, links: 56 };
  const straight = TRACK.x1 - TRACK.x0;
  const arc = Math.PI * TRACK.R;
  const loop = 2 * straight + 2 * arc;
  const trackSets = [];
  let trackOffset = 0;
  const linkGeo = new RoundedBoxGeometry(0.115, 0.05, 0.34, 1, 0.015);
  const dummy = new THREE.Object3D();
  const pt = { x: 0, y: 0, a: 0 };

  function pathAt(sIn, out) {
    let s = ((sIn % loop) + loop) % loop;
    const { x0, x1, yc, R, sag } = TRACK;
    if (s < straight) {
      const u = s / straight;
      out.x = x0 + s;
      out.y = yc + R - sag * Math.sin(Math.PI * u);
      out.a = Math.atan(-sag * (Math.PI / straight) * Math.cos(Math.PI * u));
      return;
    }
    s -= straight;
    if (s < arc) {
      const phi = s / R;
      out.x = x1 + R * Math.sin(phi);
      out.y = yc + R * Math.cos(phi);
      out.a = -phi;
      return;
    }
    s -= arc;
    if (s < straight) {
      out.x = x1 - s;
      out.y = yc - R;
      out.a = -Math.PI;
      return;
    }
    s -= straight;
    const phi = s / R;
    out.x = x0 - R * Math.sin(phi);
    out.y = yc - R * Math.cos(phi);
    out.a = -Math.PI - phi;
  }

  function addTrackLinks(zc) {
    const mesh = new THREE.InstancedMesh(linkGeo, toon(0xffffff), TRACK.links);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const a = new THREE.Color(C.trackA);
    const b = new THREE.Color(C.trackB);
    for (let i = 0; i < TRACK.links; i++) mesh.setColorAt(i, i % 2 ? a : b);
    slots.tracks.add(mesh);
    trackSets.push({ mesh, zc });
  }

  function updateTracks() {
    const spacing = loop / TRACK.links;
    for (const { mesh, zc } of trackSets) {
      for (let i = 0; i < TRACK.links; i++) {
        pathAt(i * spacing + trackOffset, pt);
        dummy.position.set(pt.x, pt.y, zc);
        dummy.rotation.set(0, 0, pt.a);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function buildTracks() {
    for (const s of [-1, 1]) {
      addTrackLinks(s * LINK_Z);
      // road wheels, idler (front), drive sprocket (rear)
      const spots = [-1.0, -0.5, 0, 0.5, 1.0].map((x) => [x, false]);
      spots.push([1.3, false], [-1.3, true]);
      for (const [x, sprocket] of spots) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.3, s * WHEEL_Z);
        slots.tracks.add(pivot);
        spinners.push(pivot);
        const rad = sprocket ? 0.3 : WHEEL_R;
        put(pivot, cyl(rad, 0.16, C.dark, { axis: 'z', seg: 14 }));
        put(pivot, cyl(rad * 0.78, 0.2, sprocket ? C.steel : C.olive, { axis: 'z', seg: 14 }));
        put(pivot, cyl(rad * 0.56, 0.22, C.oliveDark, { axis: 'z', seg: 12 }));
        put(pivot, cyl(rad * 0.3, 0.26, C.steel, { axis: 'z', seg: 8 }));
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          put(pivot, box(0.05, 0.05, 0.3, C.dark, { r: 0.01 }), Math.cos(a) * rad * 0.62, Math.sin(a) * rad * 0.62, 0);
        }
        if (sprocket) {
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            const tooth = put(pivot, box(0.1, 0.09, 0.2, C.dark, { r: 0.02 }), Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0);
            tooth.rotation.z = a;
          }
        }
      }
      // fenders (just above the wheels) with tool clamps; sloped front mudguards
      put(slots.tracks, box(2.5, 0.06, 0.62, C.oliveDark, { r: 0.03 }), -0.15, 0.68, s * 1.02);
      const mud = put(slots.tracks, box(0.55, 0.06, 0.62, C.oliveDark, { r: 0.03 }), 1.38, 0.64, s * 1.02);
      mud.rotation.z = -0.35;
      put(slots.tracks, box(0.7, 0.05, 0.1, C.tan, { r: 0.015 }), 0.5, 0.73, s * 1.2); // shovel
      put(slots.tracks, box(0.4, 0.05, 0.08, C.steel, { r: 0.015 }), -0.1, 0.73, s * 1.22); // axe/saw
    }
  }

  // ----------------------------------------------------------------- armor
  // Starter kit: mismatched scrap plates welded over the original cast armor.
  function buildArmor() {
    const a = slots.armor;
    plate(a, [TURRET_X + 0.65, HULL_TOP + 0.3, 0.6], [0.5, 0.3, 0.06], C.tan, '+z'); // turret cheeks
    plate(a, [TURRET_X + 0.55, HULL_TOP + 0.28, -0.62], [0.45, 0.26, 0.06], C.rust, '-z');
    plate(a, [-0.25, 0.78, HULL_W + 0.02], [0.8, 0.2, 0.05], C.rust, '+z'); // hull sides
    plate(a, [0.35, 0.78, -HULL_W - 0.02], [0.7, 0.2, 0.05], C.tan, '-z');
    plate(a, [1.03, 0.93, 0.3], [0.34, 0.06, 0.45], C.steel, '+y'); // glacis patch
  }

  // ---------------------------------------------------------------- engine
  // Rear deck, exhaust, and the two fuel barrels that make it feel heavy.
  function buildEngine() {
    const e = slots.engine;
    put(e, box(0.95, 0.08, HULL_W * 1.8, C.dark, { r: 0.03 }), -0.85, HULL_TOP + 0.04, 0);
    for (let i = 0; i < 5; i++) put(e, box(0.05, 0.04, 1.2, C.steel, { r: 0.01 }), -1.1 + i * 0.12, HULL_TOP + 0.1, 0);
    // exhaust stack (left rear corner, clear of the barrels)
    put(e, cyl(0.07, 0.3, C.dark, { seg: 8 }), -1.2, 1.02, -0.72);
    put(e, cyl(0.09, 0.05, C.steel, { seg: 8 }), -1.2, 1.18, -0.72);
    // two green barrels lying across the rear deck, one behind the other, strapped down
    for (const x of [-0.97, -1.3]) {
      const barrel = new THREE.Group();
      put(barrel, cyl(0.165, 1.25, C.drumGreen, { axis: 'z', seg: 12 }));
      for (const off of [-1, 1]) {
        const rim = cyl(0.18, 0.05, C.dark, { axis: 'z', seg: 12 });
        rim.position.z = off * 0.38;
        barrel.add(rim);
        const strap = cyl(0.178, 0.04, C.dark, { axis: 'z', seg: 12 });
        strap.position.z = off * 0.18;
        barrel.add(strap);
      }
      barrel.position.set(x, 1.14, 0);
      e.add(barrel);
    }
    // unditching beam on the rear plate
    put(e, box(0.14, 0.14, 1.2, C.wood), -1.46, 0.68, 0);
    for (const z of [-0.45, 0.45]) put(e, box(0.1, 0.2, 0.06, C.steel), -1.44, 0.68, z);
  }

  // ------------------------------------------------------------------- gun
  // Fat barrel with a chunky fume extractor and muzzle sleeve.
  function buildGun() {
    gunPivot = new THREE.Group();
    gunPivot.position.set(GUN_BASE_X, GUN_Y, 0);
    slots.gun.add(gunPivot);
    put(gunPivot, cyl(0.23, 0.14, C.steel, { axis: 'x', seg: 10 }), 0.04, 0, 0);
    put(gunPivot, cyl(0.12, 1.7, C.olive, { axis: 'x', seg: 10 }), 0.85, 0, 0);
    put(gunPivot, cyl(0.185, 0.42, C.oliveLight, { axis: 'x', seg: 10 }), 1.05, 0, 0); // fume extractor
    put(gunPivot, cyl(0.15, 0.24, C.oliveDark, { axis: 'x', seg: 10 }), 1.8, 0, 0); // muzzle sleeve
    put(gunPivot, cyl(0.1, 0.03, C.dark, { axis: 'x', seg: 8 }), 1.93, 0, 0); // bore
    gunFlash = new THREE.Group();
    put(gunFlash, box(0.34, 0.34, 0.34, 0xffb43a, { glow: true, r: 0.05 }), 0, 0, 0);
    put(gunFlash, box(0.2, 0.2, 0.2, 0xfff6c8, { glow: true, r: 0.04 }), 0.12, 0, 0);
    gunFlash.position.set(MUZZLE_X + 0.2, 0, 0);
    gunFlash.visible = false;
    gunPivot.add(gunFlash);
  }

  // ---------------------------------------------------------------- roof MG
  // DShK-style gun on the commander's cupola. Tracks targets on its own.
  function buildMG() {
    put(slots.mg, cyl(0.17, 0.04, C.dark, { seg: 10 }), MG_X, 0.66, MG_Z);
    put(slots.mg, cyl(0.05, 0.14, C.steel, { seg: 8 }), MG_X, 0.74, MG_Z);
    mgPivot = new THREE.Group();
    mgPivot.position.set(MG_X, MG_Y, MG_Z);
    slots.mg.add(mgPivot);
    put(mgPivot, box(0.5, 0.13, 0.13, C.dark, { r: 0.03 }), 0.05, 0, 0);
    put(mgPivot, cyl(0.035, 0.7, C.steel, { axis: 'x', seg: 8 }), 0.5, 0, 0);
    put(mgPivot, cyl(0.055, 0.14, C.dark, { axis: 'x', seg: 8 }), 0.82, 0, 0); // muzzle brake
    put(mgPivot, cyl(0.1, 0.1, C.oliveDark, { axis: 'z', seg: 10 }), -0.05, -0.02, -0.14); // ammo drum
    put(mgPivot, box(0.14, 0.05, 0.05, C.dark), -0.26, 0.03, 0.04);
    put(mgPivot, box(0.05, 0.3, 0.26, C.steel, { r: 0.015 }), 0.22, 0.06, 0); // shield
    mgFlash = put(mgPivot, box(0.14, 0.14, 0.14, 0xffd24a, { glow: true, r: 0.03 }), 0.95, 0, 0);
    mgFlash.visible = false;
  }

  // ----------------------------------------------------------------- sights
  // IR searchlight beside the gun, plus commander's periscopes.
  function buildSights() {
    const s = slots.sights;
    put(s, box(0.12, 0.12, 0.16, C.dark), 0.72, GUN_Y, -0.46);
    put(s, cyl(0.14, 0.22, C.oliveDark, { axis: 'x', seg: 10 }), 0.87, GUN_Y + 0.03, -0.46);
    put(s, cyl(0.105, 0.03, 0xd8f4ff, { axis: 'x', seg: 10, glow: true }), 0.99, GUN_Y + 0.03, -0.46);
    put(s, box(0.12, 0.09, 0.1, C.dark), 0.08, 0.6, 0.5);
    put(s, box(0.12, 0.09, 0.1, C.dark), -0.3, 0.6, 0.5);
  }

  buildTracks();
  updateTracks();
  buildArmor();
  buildEngine();
  buildGun();
  buildMG();
  buildSights();
  // slots.module stays empty on the starter tank.

  // ------------------------------------------------------------- behaviour
  const tmp = new THREE.Vector3();
  let recoil = 0;
  let gunFlashTime = 0;

  function fire() {
    recoil = 1;
    gunFlashTime = 0.08;
    group.updateWorldMatrix(true, true);
    const position = gunPivot.localToWorld(new THREE.Vector3(MUZZLE_X + 0.1, 0, 0));
    const direction = new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld);
    return { position, direction };
  }

  // ctx: { aimPoint, mgPoint, speed }
  function update(dt, t, ctx = {}) {
    group.getWorldPosition(tmp);
    const yaw = group.rotation.y;
    if (ctx.aimPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.aimPoint.z - tmp.z), ctx.aimPoint.x - tmp.x) - yaw);
      turret.rotation.y = approachAngle(turret.rotation.y, want, TURRET_SPEED * dt);
    }
    if (ctx.mgPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.mgPoint.z - tmp.z), ctx.mgPoint.x - tmp.x) - yaw - turret.rotation.y);
      mgPivot.rotation.y = approachAngle(mgPivot.rotation.y, want, MG_SPEED * dt);
    }

    const speed = ctx.speed || 0;
    for (const w of spinners) w.rotation.z -= (speed * dt) / WHEEL_R;
    if (speed) {
      trackOffset += speed * dt;
      updateTracks();
    }
    chassis.position.y = Math.abs(Math.sin(t * 11)) * 0.012 * Math.min(1, speed);

    recoil = Math.max(0, recoil - dt * 4);
    gunPivot.position.x = GUN_BASE_X - recoil * 0.3;
    chassis.rotation.z = recoil * 0.018;
    gunFlashTime = Math.max(0, gunFlashTime - dt);
    gunFlash.visible = gunFlashTime > 0;

    const mgOn = !!ctx.mgPoint && Math.floor(t * 16) % 2 === 0;
    mgFlash.visible = mgOn;
    mgPivot.position.y = MG_Y + (mgOn ? 0.006 : 0);
  }

  return { group, slots, turret, fire, update };
}
