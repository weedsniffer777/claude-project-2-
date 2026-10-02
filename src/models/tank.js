// Starter tank: a patched-up, small-ized T-55. One version for now.
// Forward is +X, up is +Y, right is +Z (so left is -Z).
//
// What makes a T-55 read as a "low rider", and what we keep from it:
//  - long, flat hull; the deck sits only a hair above the fenders
//  - one continuous track cover from front mudguard to rear mudguard
//  - a low, smooth egg turret (no separate bustle bulge)
//  - five road wheels with a wider gap after the first, a small raised idler
//    at the front and a raised drive sprocket at the rear, so the track is a
//    loose trapezoid, not a capsule
//  - two fuel drums lying across the rear deck over a thick unditching beam
// "Small-ized" = oversized gun, slightly chunky details. Nothing else.
//
// Crew layout (looking forward): driver front-left of the hull; commander and
// gunner left of the gun, loader right. The roof DShK sits on the loader's
// hatch, the IR searchlight left of the gun.
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

// Layout (world units).
const HULL_W = 0.72; // hull half-width (the tracks sit just outside it)
const HULL_TOP = 0.8; // deck height; fenders top out at ~0.755
const FENDER_Y = 0.73;
const LINK_Z = 0.88;
const WHEEL_Z = 0.94;
const ROAD_WHEELS = [1.05, 0.4, -0.18, -0.76, -1.34]; // wider gap after the first, like the real thing
const WHEEL_Y = 0.29;
const TURRET_X = 0.0; // set back from the ring-forward T-55 stance for a relaxed, rear-weighted look
const TURRET_SPEED = 3.2; // rad/s, gives the cannon some weight
const MG_SPEED = 9;
const GUN_BASE_X = 1.06;
const GUN_Y = 0.3;
const MUZZLE_X = 1.94;
const MG_X = -0.08; // DShK sits on the loader's hatch (right side)
const MG_Z = 0.4;
const MG_Y = 0.8;

export const SLOT_NAMES = ['tracks', 'armor', 'engine', 'gun', 'mg', 'sights', 'module'];

// ----------------------------------------------------------------------
// Track path: the outline of a set of circles, walked clockwise (top run goes
// forward). Circles: rear sprocket, front idler, first and last road wheel.
// Because the idler and sprocket sit higher than the wheels, the loop is a
// trapezoid with rounded corners instead of a capsule.
const TRACK_CIRCLES = [
  { x: -1.9, y: 0.42, r: 0.27 },
  { x: 1.62, y: 0.38, r: 0.2 },
  { x: ROAD_WHEELS[0], y: WHEEL_Y, r: 0.28 },
  { x: ROAD_WHEELS[4], y: WHEEL_Y, r: 0.28 },
];
const TOP_SAG = 0.03;

function buildTrackPath(circles) {
  const n = circles.length;
  const nOut = [];
  const nIn = [];
  const segs = [];
  for (let i = 0; i < n; i++) {
    const a = circles[i];
    const b = circles[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const nAng = Math.atan2(dy, dx) + Math.acos((a.r - b.r) / d); // outward normal of the tangent line
    nOut[i] = nAng;
    nIn[(i + 1) % n] = nAng;
    const p1 = { x: a.x + a.r * Math.cos(nAng), y: a.y + a.r * Math.sin(nAng) };
    const p2 = { x: b.x + b.r * Math.cos(nAng), y: b.y + b.r * Math.sin(nAng) };
    segs.push({ p1, p2, len: Math.hypot(p2.x - p1.x, p2.y - p1.y), nAng });
  }
  const arcs = circles.map((c, i) => {
    let sweep = (nIn[i] - nOut[i]) % (Math.PI * 2);
    if (sweep < 0) sweep += Math.PI * 2;
    return { c, nStart: nIn[i], sweep, len: sweep * c.r };
  });
  // order along the loop: arc0, seg0, arc1, seg1, ...
  const parts = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    parts.push({ type: 'arc', start: total, ...arcs[i] });
    total += arcs[i].len;
    parts.push({ type: 'seg', start: total, index: i, ...segs[i] });
    total += segs[i].len;
  }
  return { parts, total };
}

const TRACK_PATH = buildTrackPath(TRACK_CIRCLES);

// out = { x, y, heading, normal } at arc-length s along the loop.
function trackAt(sIn, out) {
  const { parts, total } = TRACK_PATH;
  const s = ((sIn % total) + total) % total;
  let part = parts[parts.length - 1];
  for (const p of parts) {
    if (s >= p.start) part = p;
    else break;
  }
  const local = s - part.start;
  if (part.type === 'arc') {
    const ang = part.nStart - local / part.c.r; // clockwise: angle decreases
    out.x = part.c.x + part.c.r * Math.cos(ang);
    out.y = part.c.y + part.c.r * Math.sin(ang);
    out.normal = ang;
  } else {
    const u = local / part.len;
    out.x = part.p1.x + (part.p2.x - part.p1.x) * u;
    out.y = part.p1.y + (part.p2.y - part.p1.y) * u;
    out.normal = part.nAng;
    if (part.index === 0) out.y -= TOP_SAG * Math.sin(Math.PI * u); // loose top run
  }
  out.heading = out.normal - Math.PI / 2;
}

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
  put(hull, box(3.2, 0.3, HULL_W * 1.92, C.dark, { r: 0.05 }), -0.1, 0.4, 0); // lower hull, visible between the wheels
  put(hull, box(2.75, 0.24, HULL_W * 2, C.olive, { r: 0.08 }), -0.375, 0.68, 0); // upper hull
  put(hull, box(0.12, 0.3, HULL_W * 1.94, C.oliveDark), -1.76, 0.64, 0); // rear plate
  // long sloped glacis + steep nose
  const glacis = put(hull, box(0.76, 0.08, HULL_W * 1.94, C.oliveLight, { r: 0.04 }), 1.34, 0.63, 0);
  glacis.rotation.z = -0.464;
  put(hull, box(0.12, 0.28, HULL_W * 1.9, C.oliveDark, { r: 0.04 }), 1.62, 0.33, 0);
  // headlights at the glacis corners: left white, right IR (dark lens), both with guard bars
  for (const s of [-1, 1]) {
    put(hull, box(0.14, 0.12, 0.16, C.dark, { r: 0.03 }), 1.43, 0.66, s * 0.56);
    if (s < 0) put(hull, box(0.03, 0.08, 0.1, 0xfff2b8, { glow: true }), 1.51, 0.66, s * 0.56);
    else put(hull, box(0.03, 0.08, 0.1, 0x3a2626), 1.51, 0.66, s * 0.56);
    put(hull, box(0.02, 0.14, 0.2, C.steel, { r: 0.008 }), 1.54, 0.66, s * 0.56);
    put(hull, box(0.14, 0.09, 0.1, C.steel), 1.72, 0.38, s * 0.45); // tow hooks
  }
  // driver's hatch: front-left on the glacis, ahead of the turret, with periscopes in front of it
  const driver = new THREE.Group();
  driver.position.set(1.2, 0.735, -0.34);
  driver.rotation.z = -0.464; // follows the glacis slope
  hull.add(driver);
  put(driver, cyl(0.17, 0.06, C.oliveDark, { seg: 12 }), 0, 0.03, 0);
  const driverLid = put(driver, cyl(0.15, 0.03, C.olive, { seg: 12 }), -0.12, 0.13, 0);
  driverLid.rotation.z = 0.7; // propped open
  put(driver, box(0.08, 0.06, 0.15, C.dark), 0.2, 0.05, 0);
  for (const dz of [-0.17, 0.17]) put(driver, box(0.05, 0.05, 0.07, C.dark), 0.18, 0.04, dz);
  // turret ring lip
  put(hull, cyl(0.86, 0.03, C.oliveDark, { seg: 20 }), TURRET_X, HULL_TOP + 0.01, 0);

  // -------------------------------------------------------------- turret
  // One low, smooth egg that slopes down toward the rear. No bustle bulge.
  put(turret, cyl(0.88, 0.06, C.dark, { seg: 20 }), 0, 0.03, 0);
  const dome = put(turret, ellipsoid(1.05, 0.46, 0.98, C.olive, { wseg: 18, hseg: 10 }), -0.02, 0.18, 0);
  dome.rotation.z = 0.04;
  // mantlet and bolted collar
  put(turret, cyl(0.3, 0.3, C.oliveDark, { axis: 'x', seg: 12 }), 0.97, GUN_Y, 0);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    put(turret, box(0.04, 0.045, 0.045, C.dark, { r: 0.008 }), 1.13, GUN_Y + Math.sin(a) * 0.285, Math.cos(a) * 0.285);
  }
  // commander's cupola (left, rear), with an open lid and a periscope block
  put(turret, cyl(0.22, 0.14, C.olive, { seg: 14 }), -0.28, 0.55, -0.4);
  put(turret, cyl(0.235, 0.04, C.oliveDark, { seg: 14 }), -0.28, 0.63, -0.4);
  const cupolaLid = put(turret, cyl(0.19, 0.03, C.olive, { seg: 12 }), -0.42, 0.74, -0.4);
  cupolaLid.rotation.z = 0.9;
  put(turret, box(0.09, 0.08, 0.2, C.dark, { r: 0.02 }), -0.12, 0.66, -0.4);
  // loader's hatch (right): flat round lid; the DShK ring mounts around it
  put(turret, cyl(0.2, 0.05, C.oliveDark, { seg: 14 }), MG_X, 0.57, MG_Z);
  const loaderLid = put(turret, cyl(0.17, 0.03, C.olive, { seg: 12 }), MG_X - 0.12, 0.67, MG_Z);
  loaderLid.rotation.z = 0.6;
  put(turret, box(0.1, 0.07, 0.09, C.dark), MG_X + 0.2, 0.58, MG_Z - 0.04); // loader's periscope
  // tarp roll on the rear of the turret, stowage box on the left side
  put(turret, cyl(0.08, 0.62, C.canvas, { axis: 'z', seg: 8 }), -1.0, 0.25, 0);
  put(turret, box(0.4, 0.16, 0.2, C.oliveDark), -0.5, 0.22, -0.94);
  // whip antenna, left rear
  put(turret, cyl(0.04, 0.07, C.dark), -0.75, 0.5, -0.62);
  put(turret, cyl(0.012, 0.9, C.dark, { seg: 5 }), -0.75, 0.96, -0.62);

  // ---------------------------------------------------------------- tracks
  const linkGeo = new RoundedBoxGeometry(0.09, 0.04, 0.3, 1, 0.012);
  const hornGeo = new RoundedBoxGeometry(0.035, 0.075, 0.05, 1, 0.01);
  const linkCount = Math.round(TRACK_PATH.total / 0.125);
  const linkSpacing = TRACK_PATH.total / linkCount;
  const trackSets = [];
  let trackOffset = 0;
  const dummy = new THREE.Object3D();
  const pt = { x: 0, y: 0, heading: 0, normal: 0 };

  function addTrackLinks(zc) {
    const links = new THREE.InstancedMesh(linkGeo, toon(0xffffff), linkCount);
    const horns = new THREE.InstancedMesh(hornGeo, toon(C.dark), Math.ceil(linkCount / 2));
    for (const m of [links, horns]) {
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
      slots.tracks.add(m);
    }
    const a = new THREE.Color(C.trackA);
    const b = new THREE.Color(C.trackB);
    for (let i = 0; i < linkCount; i++) links.setColorAt(i, i % 2 ? a : b);
    trackSets.push({ links, horns, zc });
  }

  function updateTracks() {
    for (const { links, horns, zc } of trackSets) {
      let h = 0;
      for (let i = 0; i < linkCount; i++) {
        trackAt(i * linkSpacing + trackOffset, pt);
        dummy.position.set(pt.x, pt.y, zc);
        dummy.rotation.set(0, 0, pt.heading);
        dummy.updateMatrix();
        links.setMatrixAt(i, dummy.matrix);
        if (i % 2 === 0 && h < horns.count) {
          // guide horn pokes inward from every other link
          dummy.position.set(pt.x - Math.cos(pt.normal) * 0.05, pt.y - Math.sin(pt.normal) * 0.05, zc);
          dummy.updateMatrix();
          horns.setMatrixAt(h++, dummy.matrix);
        }
      }
      links.instanceMatrix.needsUpdate = true;
      horns.instanceMatrix.needsUpdate = true;
    }
  }

  function spinner(x, y, z, radius) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.userData.radius = radius;
    slots.tracks.add(pivot);
    spinners.push(pivot);
    return pivot;
  }

  function roadWheel(x, z) {
    const p = spinner(x, WHEEL_Y, z, 0.25);
    put(p, cyl(0.25, 0.14, C.dark, { axis: 'z', seg: 16 })); // tyre
    put(p, cyl(0.2, 0.17, C.olive, { axis: 'z', seg: 16 })); // disc
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const hole = put(p, box(0.07, 0.085, 0.2, C.dark, { r: 0.015 }), Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0);
      hole.rotation.z = a;
    }
    put(p, cyl(0.075, 0.22, C.steel, { axis: 'z', seg: 8 })); // hub
  }

  function idler(x, y, z) {
    const p = spinner(x, y, z, 0.17);
    put(p, cyl(0.17, 0.12, C.dark, { axis: 'z', seg: 12 }));
    put(p, cyl(0.12, 0.15, C.oliveDark, { axis: 'z', seg: 12 }));
    put(p, cyl(0.05, 0.19, C.steel, { axis: 'z', seg: 8 }));
  }

  function sprocket(x, y, z) {
    const p = spinner(x, y, z, 0.25);
    put(p, cyl(0.2, 0.1, C.steel, { axis: 'z', seg: 14 }));
    put(p, cyl(0.14, 0.14, C.olive, { axis: 'z', seg: 12 }));
    put(p, cyl(0.06, 0.18, C.dark, { axis: 'z', seg: 8 }));
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const tooth = put(p, box(0.07, 0.07, 0.15, C.dark, { r: 0.015 }), Math.cos(a) * 0.235, Math.sin(a) * 0.235, 0);
      tooth.rotation.z = a;
    }
  }

  // One continuous track cover: front mudguard, flat middle, rear mudguard.
  function trackCover(s) {
    const z = s * 1.0;
    put(slots.tracks, box(2.75, 0.05, 0.62, C.oliveDark, { r: 0.02 }), -0.175, FENDER_Y, z);
    // front mudguard slopes down and forward, with ribs
    const front = new THREE.Group();
    front.position.set(1.55, FENDER_Y - 0.03, z);
    front.rotation.z = -0.3;
    slots.tracks.add(front);
    put(front, box(0.8, 0.05, 0.62, C.oliveDark, { r: 0.02 }));
    for (const dz of [-0.19, 0, 0.19]) put(front, box(0.7, 0.03, 0.04, C.oliveLight, { r: 0.008 }), 0, 0.04, dz);
    // rear mudguard slopes down and back
    const rear = new THREE.Group();
    rear.position.set(-1.82, FENDER_Y - 0.03, z);
    rear.rotation.z = 0.28;
    slots.tracks.add(rear);
    put(rear, box(0.6, 0.05, 0.62, C.oliveDark, { r: 0.02 }));
    for (const dz of [-0.19, 0, 0.19]) put(rear, box(0.5, 0.03, 0.04, C.oliveLight, { r: 0.008 }), 0, 0.04, dz);
  }

  function buildTracks() {
    for (const s of [-1, 1]) {
      addTrackLinks(s * LINK_Z);
      for (const x of ROAD_WHEELS) roadWheel(x, s * WHEEL_Z);
      idler(1.62, 0.38, s * WHEEL_Z);
      sprocket(-1.9, 0.42, s * WHEEL_Z);
      trackCover(s);
    }
    // stowage on the covers: shovel + saw (right), toolbox (left)
    put(slots.tracks, box(0.8, 0.035, 0.12, C.tan, { r: 0.012 }), 0.45, 0.775, 1.12);
    put(slots.tracks, box(0.5, 0.035, 0.07, C.steel, { r: 0.012 }), -0.2, 0.775, 1.2);
    put(slots.tracks, box(0.6, 0.14, 0.26, C.oliveDark, { r: 0.03 }), 0.45, 0.83, -1.08);
    put(slots.tracks, box(0.2, 0.03, 0.03, C.steel), 0.45, 0.91, -1.08);
  }

  // ----------------------------------------------------------------- armor
  // Starter kit: mismatched scrap plates welded over the original cast armor.
  function buildArmor() {
    const a = slots.armor;
    plate(a, [TURRET_X + 0.6, HULL_TOP + 0.24, 0.8], [0.5, 0.22, 0.05], C.tan, '+z'); // turret cheeks
    plate(a, [TURRET_X + 0.55, HULL_TOP + 0.24, -0.81], [0.45, 0.2, 0.05], C.rust, '-z');
    plate(a, [-1.0, HULL_TOP + 0.03, 0.35], [0.5, 0.04, 0.4], C.tan, '+y'); // rear deck patch
    plate(a, [0.3, FENDER_Y + 0.045, 1.0], [0.7, 0.04, 0.35], C.rust, '+y'); // fender patch
    plate(a, [1.3, 0.72, 0.28], [0.36, 0.04, 0.45], C.steel, '+y'); // glacis patch (sits on the slope)
  }

  // ---------------------------------------------------------------- engine
  // Rear deck, exhaust, the thick unditching beam and two fuel drums.
  function buildEngine() {
    const e = slots.engine;
    for (let i = 0; i < 4; i++) put(e, box(0.05, 0.03, 1.1, C.steel, { r: 0.008 }), -0.98 - i * 0.07, HULL_TOP + 0.02, 0); // louvres
    // unditching beam: thick tube across the rear plate
    put(e, cyl(0.1, 1.5, C.oliveDark, { axis: 'z', seg: 12 }), -1.9, 0.62, 0);
    for (const z of [-0.5, 0.5]) put(e, box(0.08, 0.18, 0.06, C.steel), -1.86, 0.62, z);
    // two short drums lying across the deck, side by side, strapped down
    for (const z of [-0.37, 0.37]) {
      const drum = new THREE.Group();
      put(drum, cyl(0.17, 0.6, C.drumGreen, { axis: 'z', seg: 12 }));
      for (const off of [-1, 1]) {
        const rim = cyl(0.182, 0.04, C.dark, { axis: 'z', seg: 12 });
        rim.position.z = off * 0.28;
        drum.add(rim);
        const strap = cyl(0.178, 0.03, C.dark, { axis: 'z', seg: 12 });
        strap.position.z = off * 0.14;
        drum.add(strap);
        put(drum, box(0.05, 0.06, 0.05, C.steel, { r: 0.01 }), -0.19, 0, off * 0.14); // buckle
      }
      drum.position.set(-1.45, HULL_TOP + 0.19, z);
      e.add(drum);
    }
    // exhaust outlet, left rear corner
    put(e, cyl(0.07, 0.2, C.dark, { seg: 8 }), -1.7, HULL_TOP + 0.1, -0.62);
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
  // DShK on the loader's hatch ring. Tracks targets on its own.
  function buildMG() {
    put(slots.mg, cyl(0.2, 0.035, C.dark, { seg: 12 }), MG_X, 0.64, MG_Z); // ring mount
    put(slots.mg, cyl(0.05, 0.12, C.steel, { seg: 8 }), MG_X, 0.7, MG_Z);
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
  // IR searchlight left of the gun on its own bracket, gunner's sight slit,
  // and the commander's periscope block.
  function buildSights() {
    const s = slots.sights;
    put(s, box(0.16, 0.12, 0.2, C.dark, { r: 0.03 }), 0.82, GUN_Y - 0.02, -0.47); // bracket
    put(s, cyl(0.17, 0.26, C.oliveDark, { axis: 'x', seg: 12 }), 0.97, GUN_Y + 0.05, -0.5); // housing
    put(s, cyl(0.185, 0.05, C.steel, { axis: 'x', seg: 12 }), 1.12, GUN_Y + 0.05, -0.5); // hood ring
    put(s, cyl(0.125, 0.03, 0xd8f4ff, { axis: 'x', seg: 12, glow: true }), 1.12, GUN_Y + 0.05, -0.5); // lens
    put(s, box(0.08, 0.06, 0.16, C.dark), 1.1, GUN_Y + 0.12, -0.22); // gunner's sight
    put(s, box(0.1, 0.07, 0.12, C.dark), 0.4, 0.5, -0.7); // side periscope
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
    for (const w of spinners) w.rotation.z -= (speed * dt) / w.userData.radius;
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
