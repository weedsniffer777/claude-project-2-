// Starter tank: a slightly worn, stock T-55, small-ized. One version for now.
// Forward is +X, up is +Y, right is +Z (so left is -Z).
//
// T-55 traits this model is built around:
//  - long hull with a ~30 deg upper glacis, steep lower glacis and rear plate
//    (one extruded side profile, so the plates actually meet)
//  - no return rollers: the top run of the track rests on the big road
//    wheels and sags between them; wider gap after the first wheel; small
//    raised idler at the front, raised drive sprocket at the rear
//  - double road wheels with the track's guide horns running between them
//  - one continuous track cover per side with sloped front and rear guards;
//    box fuel tanks on the right cover, stowage + exhaust on the left
//  - cast turret: a tapered cylindrical skirt rounding into a full dome
//    (revolved profile), slightly egg-shaped front-to-back
//  - D-10T gun with the fume extractor near the muzzle, canvas mantlet cover,
//    coax MG port right of the gun, bow MG port in the glacis
//  - commander's cupola left, loader's hatch right with the DShK, L-2 IR
//    searchlight right of the gun, driver's hatch front-left
//  - two fuel drums hung off the rear plate above the unditching beam
// "Small-ized" = the hull is compressed (0.85x long and wide) and lifted onto
// four oversized road wheels, while the turret keeps its size; fat gun; big
// fuel drums as the caricature accent.
//
// Each of the seven loadout slots lives in its own group(s) so variants can be
// swapped in later without touching the rest of the model:
//   tracks, armor, engine, gun, mg, sights, module
// The stock tank has nothing in `armor` or `module` (its armor is the cast hull).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, cyl, ellipsoid, toon, put, wrapAngle, approachAngle, mergeStaticChildren } from './kit.js';

export const PALETTE = {
  olive: 0x5f6f47,
  oliveDark: 0x4a5638,
  oliveLight: 0x76875a,
  dusty: 0x6b6a4c, // worn, dusty olive for the lower hull and covers
  canvas: 0x8f8460,
  steel: 0x676e75,
  dark: 0x262b32,
  rubber: 0x34363a,
  trackA: 0x3a3833,
  trackB: 0x46433c,
  lensWhite: 0xfff2c8,
  lensIR: 0x3a2a2a,
};
const C = PALETTE;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- layout
// The hull, track covers and deck fittings are laid out in "design"
// coordinates below, then compressed by SX (length and width) and lifted by
// LIFT onto the running gear. Running gear, turret and drums use world units.
const SX = 0.85;
const LIFT = 0.08;
const HULL_TOP = 0.98; // design
const DECK_Y = HULL_TOP + 0.03; // design; extrude bevel adds a little
const WORLD_DECK_Y = DECK_Y + LIFT;
const HULL_W = 0.8; // design half width of the hull body
const HULL_HALF = HULL_W * SX; // world
const HULL_PROFILE = [
  [-2.1, HULL_TOP], // rear deck edge
  [1.3, HULL_TOP], // top edge of the upper glacis (just under the turret front)
  [2.25, 0.55], // nose: long shallow upper glacis = the T-55 "beak"
  [1.98, 0.32], // bottom of the lower glacis
  [-1.92, 0.32], // belly
  [-2.12, 0.52], // lower rear plate
];
const GLACIS_ANGLE = Math.atan2(HULL_TOP - 0.55, 2.25 - 1.3);

// running gear (world units)
const TRACK_Z = 1.07 * SX; // track centre line
const TRACK_W = 0.44 * SX;
const LINK_T = 0.045;
const WHEEL_R = 0.34; // oversized road wheels; these lift the whole hull
const WHEEL_Y = WHEEL_R + LINK_T;
const ROAD_WHEELS = [1.31, 0.43, -0.31, -1.05]; // front to rear; wider gap after the first
const IDLER = { x: 1.87, y: 0.5, r: 0.2 };
const SPROCKET = { x: -1.75, y: 0.52, r: 0.28 };
const DISC_DZ = 0.11 * SX; // half spacing of the double wheel discs

const FENDER_Y = 0.9; // design; close under the deck: most of the hull side reads as track height
const FENDER_IN = HULL_W;
const FENDER_OUT = 1.34;
const FENDER_PROFILE = [
  [-2.5, 0.7], // angled rear guard
  [-2.12, FENDER_Y],
  [2.05, FENDER_Y], // flat the whole length
  // rounded front guard, jutting out past the nose on both sides
  ...[72, 54, 36, 18].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [2.05 + 0.28 * Math.cos(a), FENDER_Y - 0.28 + 0.28 * Math.sin(a)];
  }),
];

const TURRET_X = 0.07; // world
// Revolved turret profile: skirt from R0 (at the ring) tapering to R1 at h1,
// then a superellipse dome of height D. sx stretches it front-to-back.
const TURRET = { R0: 1.0, R1: 0.9, h1: 0.28, D: 0.4, p: 2.4, sx: 1.08, base: 0.06 };
const TURRET_SPEED = 6.5; // rad/s: still swings visibly, but a half turn takes ~0.5 s
const MG_SPEED = 9;
const GUN_Y = 0.36; // turret-local
const GUN_BASE_X = 0.86;
const MUZZLE_X = 2.38;
const GUN_DEPRESSION = -0.32; // about -18 deg: small-ized, so it can point down at nearby ground
const GUN_ELEVATION = 0.31; // about +18 deg
const GUN_PITCH_SPEED = 2.4; // rad/s
const MG_DEPRESSION = -0.3;
const MG_ELEVATION = 1.1; // the DShK is an anti-aircraft mount
const MG_PITCH_SPEED = 4;
const LOADER = { x: -0.1, z: 0.42 }; // DShK sits on this hatch ring
// Drum rig hinge on the rear plate (world units), and how far it tips/slides
// the drums when the turret faces the rear.
const DRUM_HINGE = { x: -2.1 * 0.85 - 0.04, y: 0.805 };
const DRUM_TIP = 0.9; // rad, drums swing down and back
const DRUM_SLIDE = 0.3; // also slide back
const DRUM_DROP = 0.1;
const DRUM_SPEED = 2.6; // rig travel per second (0..1)
const COMMANDER = { x: -0.15, z: -0.42 };

export const SLOT_NAMES = ['tracks', 'armor', 'engine', 'gun', 'mg', 'sights', 'module'];

// Turret surface height (turret-local) at (x, z), so fittings sit on the dome.
function turretSurfaceY(x, z) {
  const { R0, R1, h1, D, p, sx, base } = TURRET;
  const rho = Math.hypot(x / sx, z);
  if (rho <= R1) return base + h1 + D * Math.pow(1 - Math.pow(rho / R1, p), 1 / p);
  if (rho <= R0) return base + (h1 * (R0 - rho)) / (R0 - R1);
  return base;
}

// x of the turret's front surface at turret-local height y and side offset z.
function turretFrontX(y, z) {
  const { R0, R1, h1, D, p, sx, base } = TURRET;
  const yp = y - base;
  const rho = yp > h1 ? R1 * Math.pow(1 - Math.pow(Math.min(1, (yp - h1) / D), p), 1 / p) : R0 - (yp / h1) * (R0 - R1);
  return sx * Math.sqrt(Math.max(0, rho * rho - z * z));
}

function turretGeometry() {
  const { R0, R1, h1, D, p } = TURRET;
  const pts = [new THREE.Vector2(R0 * 0.97, 0), new THREE.Vector2(R0, 0.03), new THREE.Vector2(R1, h1)];
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R1 * Math.pow(Math.cos(t), 2 / p), h1 + D * Math.pow(Math.sin(t), 2 / p)));
  }
  return new THREE.LatheGeometry(pts, 32);
}

// ------------------------------------------------------------ track loop
// A dense closed polyline, walked clockwise in side view (top run moves
// forward). Links are spaced evenly along it by arc length.
function buildTrackLoop() {
  const half = LINK_T / 2;
  const S = { x: SPROCKET.x, y: SPROCKET.y, r: SPROCKET.r + half };
  const I = { x: IDLER.x, y: IDLER.y, r: IDLER.r + half };
  const W = ROAD_WHEELS.map((x) => ({ x, y: WHEEL_Y, r: WHEEL_R + half }));
  const W1 = W[0];
  const W5 = W[W.length - 1];
  const pts = [];
  const mod = (v) => ((v % TAU) + TAU) % TAU;
  const line = (a, b, sag = 0) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.ceil(len / 0.02));
    for (let i = 0; i < n; i++) {
      const u = i / n;
      pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - sag * Math.sin(Math.PI * u) });
    }
  };
  const arc = (c, from, sweep) => {
    const n = Math.max(1, Math.ceil((sweep * c.r) / 0.02));
    for (let i = 0; i < n; i++) {
      const a = from - (sweep * i) / n;
      pts.push({ x: c.x + c.r * Math.cos(a), y: c.y + c.r * Math.sin(a) });
    }
  };
  // outward normal angle of the tangent line leaving circle a toward circle b
  const tangentNormal = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) + Math.acos((a.r - b.r) / Math.hypot(b.x - a.x, b.y - a.y));
  const onCircle = (c, ang) => ({ x: c.x + c.r * Math.cos(ang), y: c.y + c.r * Math.sin(ang) });

  // top run: sprocket top -> over each road wheel, sagging between -> idler top
  const tops = [S, ...W.slice().reverse(), I].map((c) => ({ x: c.x, y: c.y + c.r }));
  for (let k = 0; k < tops.length - 1; k++) {
    const len = Math.hypot(tops[k + 1].x - tops[k].x, tops[k + 1].y - tops[k].y);
    line(tops[k], tops[k + 1], 0.05 * len);
  }
  // around the front of the idler, down to the first wheel, along the ground,
  // up the back to the sprocket and around it to the top again
  const nIW = tangentNormal(I, W1);
  arc(I, Math.PI / 2, mod(Math.PI / 2 - nIW));
  line(onCircle(I, nIW), onCircle(W1, nIW));
  arc(W1, nIW, mod(nIW + Math.PI / 2));
  line(onCircle(W1, -Math.PI / 2), onCircle(W5, -Math.PI / 2));
  const nWS = tangentNormal(W5, S);
  arc(W5, -Math.PI / 2, mod(-Math.PI / 2 - nWS));
  line(onCircle(W5, nWS), onCircle(S, nWS));
  arc(S, nWS, mod(nWS - Math.PI / 2));

  pts.push({ ...pts[0] });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, total: cum[cum.length - 1] };
}

const TRACK_LOOP = buildTrackLoop();

function trackAt(sIn, out) {
  const { pts, cum, total } = TRACK_LOOP;
  const s = ((sIn % total) + total) % total;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const u = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  out.x = a.x + (b.x - a.x) * u;
  out.y = a.y + (b.y - a.y) * u;
  out.heading = Math.atan2(b.y - a.y, b.x - a.x);
  out.normal = out.heading + Math.PI / 2;
}

// ================================================================== model
export function createTank() {
  const group = new THREE.Group();
  // The hull rocks (recoil, bumps, cornering) around a pivot at its middle;
  // the running gear stays on the ground, which reads as suspension travel.
  const ROCK_Y = 0.7;
  const rock = new THREE.Group();
  rock.position.y = ROCK_Y;
  group.add(rock);
  const chassis = new THREE.Group();
  chassis.position.y = -ROCK_Y;
  rock.add(chassis);

  // Secondary motion: small damped springs on loose parts (antenna, lids,
  // drums). frame 'turret' parts get their excitation rotated into the turret.
  const wobblers = [];
  function wobble(obj, axis, { k = 70, d = 5, gain = 1, max = 0.6, oneSided = false, frame = 'hull' } = {}) {
    wobblers.push({ obj, axis, k, d, gain, max, oneSided, frame, rest: obj.rotation[axis], a: 0, v: 0 });
    return obj;
  }

  // compressed + lifted hull (design coordinates inside)
  const body = new THREE.Group();
  body.scale.set(SX, 1, SX);
  body.position.y = LIFT;
  chassis.add(body);
  // track covers are bolted to the hull, so they rock with it
  const coverFrame = new THREE.Group();
  coverFrame.scale.set(SX, 1, SX);
  coverFrame.position.y = LIFT;
  chassis.add(coverFrame);

  const turret = new THREE.Group();
  turret.position.set(TURRET_X, WORLD_DECK_Y, 0);
  chassis.add(turret);

  // Slot groups. Some slots have parts on both the hull and the turret, so
  // each slot is a list of groups.
  const slotGroups = {};
  const slot = (name, parent) => {
    const g = new THREE.Group();
    parent.add(g);
    (slotGroups[name] ||= []).push(g);
    return g;
  };
  const tracks = slot('tracks', group); // running gear stays on the ground
  const covers = slot('tracks', coverFrame);
  slot('armor', chassis);
  const engine = slot('engine', chassis); // world-space parts (drums)
  const engineBody = slot('engine', body); // hull-attached parts (design coords)
  const gunSlot = slot('gun', turret);
  const mgSlot = slot('mg', turret);
  const sights = slot('sights', turret);
  slot('module', turret);

  const spinners = [];
  let gunPivot, gunFlash, mgPivot, mgFlash, drumRig;

  // ---------------------------------------------------------------- hull
  const hull = new THREE.Group();
  body.add(hull);
  {
    const shape = new THREE.Shape(HULL_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)));
    const depth = HULL_W * 2 - 0.06;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, toon(C.olive));
    mesh.castShadow = mesh.receiveShadow = true;
    hull.add(mesh);
  }
  // dusty lower hull band (wear), just inside the track line
  for (const s of [-1, 1]) put(hull, box(3.7, 0.28, 0.02, C.dusty, { r: 0.005 }), -0.05, 0.47, s * (HULL_W + 0.02));

  // upper glacis: driver's hatch (front-left), headlights, bow MG port
  const glacis = new THREE.Group();
  glacis.position.set(1.3, DECK_Y, 0);
  glacis.rotation.z = -GLACIS_ANGLE;
  hull.add(glacis);
  put(glacis, cyl(0.2, 0.05, C.oliveDark, { seg: 14 }), 0.24, 0.02, -0.42);
  const driverLid = put(glacis, cyl(0.17, 0.035, C.olive, { seg: 14 }), 0.08, 0.13, -0.42);
  driverLid.rotation.z = 0.8; // propped open
  wobble(driverLid, 'z', { k: 120, d: 6, gain: 0.5, max: 0.25 });
  put(glacis, box(0.08, 0.07, 0.16, C.dark, { r: 0.015 }), 0.46, 0.04, -0.42); // driver's periscope
  put(glacis, cyl(0.05, 0.07, C.dark, { seg: 10 }), 0.52, 0.02, 0.32); // bow MG port
  put(glacis, cyl(0.03, 0.08, C.dark, { seg: 8 }), 0.52, 0.06, 0.32);
  // headlights near the front corners, lenses facing forward
  const lamp = (along, z, lens) => {
    const g = new THREE.Group();
    g.position.set(along, 0.07, z);
    g.rotation.z = GLACIS_ANGLE; // undo the slope so the lamp faces forward
    glacis.add(g);
    put(g, box(0.1, 0.11, 0.13, C.dark, { r: 0.03 }));
    put(g, cyl(0.045, 0.02, lens, { axis: 'x', seg: 10, glow: lens === C.lensWhite }), 0.055, 0, 0);
    put(g, box(0.02, 0.15, 0.17, C.steel, { r: 0.006 }), 0.09, 0.02, 0); // guard
  };
  lamp(0.66, -0.62, C.lensWhite);
  lamp(0.66, -0.46, C.lensIR);
  lamp(0.66, 0.62, C.lensWhite);
  // lower glacis tow hooks and rear plate fittings
  for (const s of [-1, 1]) {
    put(hull, box(0.12, 0.1, 0.1, C.steel, { r: 0.02 }), 2.14, 0.44, s * 0.52);
    put(hull, box(0.1, 0.1, 0.1, C.steel, { r: 0.02 }), -2.14, 0.44, s * 0.55);
  }
  put(hull, box(0.04, 0.08, 0.12, C.dark), -2.13, 0.88, -0.62); // tail light
  // engine deck: radiator louvres at the back, access plate, air intake left
  for (let i = 0; i < 5; i++) put(hull, box(0.05, 0.03, 1.3, C.oliveDark, { r: 0.008 }), -2.0 + i * 0.09, DECK_Y + 0.015, 0);
  put(hull, box(0.42, 0.03, 0.75, C.oliveLight, { r: 0.01 }), -1.38, DECK_Y + 0.015, 0);
  for (const [dx, dz] of [[-0.2, -0.32], [0.2, -0.32], [-0.2, 0.32], [0.2, 0.32]]) put(hull, box(0.04, 0.03, 0.04, C.dark), -1.38 + dx * 0.8, DECK_Y + 0.035, dz);
  put(hull, box(0.3, 0.07, 0.28, C.oliveDark, { r: 0.02 }), -1.3, DECK_Y + 0.035, -0.62);

  // ------------------------------------------------------------- turret
  {
    const mesh = new THREE.Mesh(turretGeometry(), toon(C.olive));
    mesh.scale.x = TURRET.sx;
    mesh.position.y = TURRET.base;
    mesh.castShadow = mesh.receiveShadow = true;
    turret.add(mesh);
  }
  put(turret, cyl(0.96, 0.06, C.dark, { seg: 28 }), 0, 0.03, 0); // turret race
  const seat = (obj, x, z, lift = 0) => put(turret, obj, x, turretSurfaceY(x, z) + lift, z);
  // commander's cupola (left) with vision blocks and its small IR lamp
  {
    const { x, z } = COMMANDER;
    seat(cyl(0.24, 0.16, C.olive, { seg: 16 }), x, z, 0.04);
    seat(cyl(0.26, 0.04, C.oliveDark, { seg: 16 }), x, z, 0.13);
    const lid = seat(cyl(0.2, 0.035, C.olive, { seg: 14 }), x - 0.16, z, 0.24);
    lid.rotation.z = 0.9;
    wobble(lid, 'z', { k: 110, d: 6, gain: 0.6, max: 0.25, frame: 'turret' });
    for (let k = 0; k < 5; k++) {
      const a = -0.9 + k * 0.45;
      const vb = seat(box(0.06, 0.06, 0.09, C.dark), x + Math.cos(a) * 0.22, z + Math.sin(a) * 0.22, 0.12);
      vb.position.y = turretSurfaceY(x, z) + 0.12;
      vb.rotation.y = -a;
    }
  }
  // loader's hatch (right); the DShK ring mount goes around it (mg slot)
  seat(cyl(0.22, 0.05, C.oliveDark, { seg: 16 }), LOADER.x, LOADER.z, 0.0);
  const loaderLid = seat(cyl(0.19, 0.035, C.olive, { seg: 14 }), LOADER.x - 0.14, LOADER.z, 0.12);
  loaderLid.rotation.z = 0.7;
  wobble(loaderLid, 'z', { k: 110, d: 6, gain: 0.6, max: 0.25, frame: 'turret' });
  seat(box(0.1, 0.07, 0.1, C.dark, { r: 0.015 }), 0.2, 0.46, 0.02); // loader's periscope
  seat(ellipsoid(0.11, 0.07, 0.11, C.oliveDark, { wseg: 10, hseg: 6 }), 0.42, 0.24, 0); // ventilator dome
  // the T-55 "face": a tall rounded-rectangle cast frame either side of the
  // gun with a smaller empty cutout inside. Left is the gunner's sight
  // (sights slot adds its glass), right is the coax MG port.
  for (const side of [-1, 1]) {
    const z = side * 0.33;
    const y = GUN_Y + 0.08;
    const port = new THREE.Group();
    port.position.set(turretFrontX(y, z) - 0.01, y, z);
    port.rotation.y = -side * 0.33; // follow the dome's curve
    turret.add(port);
    put(port, box(0.1, 0.28, 0.14, C.olive, { r: 0.065 }));
    if (side > 0) put(port, box(0.04, 0.17, 0.06, C.dark, { r: 0.028 }), 0.04, 0, 0); // coax: empty cutout
  }
  // whip antenna on the left rear of the roof; the whip sways on its base
  {
    const base = seat(new THREE.Group(), -0.55, -0.6, 0.03);
    put(base, cyl(0.045, 0.08, C.dark, { seg: 8 }));
    const whip = put(base, new THREE.Group(), 0, 0.04, 0);
    put(whip, cyl(0.012, 1.0, C.dark, { seg: 5 }), 0, 0.5, 0);
    put(whip, cyl(0.022, 0.03, C.dark, { seg: 6 }), 0, 1.0, 0); // tip
    wobble(whip, 'z', { k: 38, d: 2.2, gain: 1.8, max: 0.45, frame: 'turret' });
    wobble(whip, 'x', { k: 38, d: 2.2, gain: 1.8, max: 0.45, frame: 'turret' });
  }
  // snorkel tube stowed across the turret rear, on brackets
  put(turret, cyl(0.085, 1.1, C.oliveDark, { axis: 'z', seg: 10 }), -1.12, 0.22, 0);
  for (const z of [-0.35, 0.35]) put(turret, box(0.16, 0.06, 0.06, C.steel), -1.04, 0.2, z);

  // ---------------------------------------------------------------- tracks
  const trackPt = { x: 0, y: 0, heading: 0, normal: 0 };
  const linkCount = Math.round(TRACK_LOOP.total / 0.11);
  const linkSpacing = TRACK_LOOP.total / linkCount;
  const linkGeo = (() => {
    const plateGeo = new RoundedBoxGeometry(0.09, 0.035, TRACK_W, 1, 0.01);
    const grouser = new THREE.BoxGeometry(0.03, 0.022, TRACK_W * 0.9).toNonIndexed(); // match RoundedBoxGeometry
    grouser.translate(0, 0.026, 0); // ridge on the ground side
    return mergeGeometries([plateGeo, grouser]);
  })();
  const hornGeo = new RoundedBoxGeometry(0.05, 0.08, 0.06, 1, 0.012);
  const trackSets = [];
  let trackOffset = 0;
  const dummy = new THREE.Object3D();

  function addTrack(zc) {
    const links = new THREE.InstancedMesh(linkGeo, toon(0xffffff), linkCount);
    const horns = new THREE.InstancedMesh(hornGeo, toon(C.trackB), Math.ceil(linkCount / 2));
    for (const m of [links, horns]) {
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
      tracks.add(m);
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
        trackAt(i * linkSpacing + trackOffset, trackPt);
        dummy.position.set(trackPt.x, trackPt.y, zc);
        dummy.rotation.set(0, 0, trackPt.heading); // local +y = outward, so ridges face the ground
        dummy.updateMatrix();
        links.setMatrixAt(i, dummy.matrix);
        if (i % 2 === 0 && h < horns.count) {
          // guide horn pokes inward, between the double wheel discs
          dummy.position.set(trackPt.x - Math.cos(trackPt.normal) * 0.05, trackPt.y - Math.sin(trackPt.normal) * 0.05, zc);
          dummy.rotation.set(0, 0, trackPt.heading);
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
    tracks.add(pivot);
    spinners.push(pivot);
    return pivot;
  }

  // Double road wheel: two rubber-tyred discs; the outer one shows the
  // lightening holes and hub.
  function roadWheel(x, s) {
    const p = spinner(x, WHEEL_Y, s * TRACK_Z, WHEEL_R);
    for (const side of [-1, 1]) {
      const dz = side * DISC_DZ;
      put(p, cyl(WHEEL_R, 0.1, C.rubber, { axis: 'z', seg: 18 }), 0, 0, dz);
      put(p, cyl(WHEEL_R * 0.8, 0.12, C.olive, { axis: 'z', seg: 18 }), 0, 0, dz);
    }
    const face = s * (DISC_DZ + 0.061);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const hole = put(p, box(WHEEL_R * 0.26, WHEEL_R * 0.21, 0.012, C.dark, { r: 0.01 }), Math.cos(a) * WHEEL_R * 0.47, Math.sin(a) * WHEEL_R * 0.47, face);
      hole.rotation.z = a;
    }
    put(p, cyl(WHEEL_R * 0.26, 0.03, C.steel, { axis: 'z', seg: 10 }), 0, 0, face + s * 0.012);
    put(p, cyl(WHEEL_R * 0.1, 0.03, C.dark, { axis: 'z', seg: 6 }), 0, 0, face + s * 0.03);
    put(p, cyl(0.045, DISC_DZ * 2 + 0.1, C.steel, { axis: 'z', seg: 8 })); // axle
  }

  function idler(s) {
    const p = spinner(IDLER.x, IDLER.y, s * TRACK_Z, IDLER.r);
    for (const side of [-1, 1]) {
      put(p, cyl(IDLER.r, 0.08, C.oliveDark, { axis: 'z', seg: 14 }), 0, 0, side * DISC_DZ);
    }
    const face = s * (DISC_DZ + 0.045);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      const hole = put(p, box(0.06, 0.05, 0.012, C.dark, { r: 0.01 }), Math.cos(a) * 0.1, Math.sin(a) * 0.1, face);
      hole.rotation.z = a;
    }
    put(p, cyl(0.05, 0.03, C.steel, { axis: 'z', seg: 8 }), 0, 0, face + s * 0.012);
    put(p, cyl(0.04, DISC_DZ * 2 + 0.08, C.steel, { axis: 'z', seg: 8 }));
  }

  function sprocket(s) {
    const p = spinner(SPROCKET.x, SPROCKET.y, s * TRACK_Z, SPROCKET.r);
    for (const side of [-1, 1]) {
      const dz = side * DISC_DZ;
      put(p, cyl(SPROCKET.r * 0.86, 0.06, C.steel, { axis: 'z', seg: 16 }), 0, 0, dz);
      for (let k = 0; k < 13; k++) {
        const a = (k / 13) * TAU;
        const tooth = put(p, box(0.07, 0.06, 0.06, C.dark, { r: 0.012 }), Math.cos(a) * SPROCKET.r, Math.sin(a) * SPROCKET.r, dz);
        tooth.rotation.z = a;
      }
    }
    put(p, cyl(0.15, DISC_DZ * 2, C.olive, { axis: 'z', seg: 12 }));
    put(p, cyl(0.07, DISC_DZ * 2 + 0.1, C.dark, { axis: 'z', seg: 8 }));
  }

  // One continuous track cover per side, built segment by segment along a
  // side profile so the guards always meet the middle section.
  function trackCover(s) {
    const zc = s * (FENDER_IN + FENDER_OUT) / 2;
    const width = FENDER_OUT - FENDER_IN;
    for (let k = 0; k < FENDER_PROFILE.length - 1; k++) {
      const [x0, y0] = FENDER_PROFILE[k];
      const [x1, y1] = FENDER_PROFILE[k + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const seg = new THREE.Group();
      seg.position.set((x0 + x1) / 2, (y0 + y1) / 2, zc);
      seg.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      covers.add(seg);
      put(seg, box(len + 0.05, 0.05, width, C.dusty, { r: 0.015 }));
      const isGuard = k !== 1;
      if (isGuard) {
        for (const dz of [-0.17, 0, 0.17]) put(seg, box(len - 0.08, 0.025, 0.035, C.oliveLight, { r: 0.006 }), 0, 0.035, dz);
      } else {
        put(seg, box(len, 0.08, 0.025, C.dusty, { r: 0.008 }), 0, -0.035, s * width / 2); // outer lip
      }
    }
  }

  // Inner vertical plates under the front guards (between the guard and the
  // glacis) and the rear guards, so you can't see through the covers.
  function guardPanels(s) {
    const tan = Math.tan(GLACIS_ANGLE);
    const glacisY = (x) => HULL_TOP - (x - 1.3) * tan;
    const under = FENDER_Y - 0.02;
    const xStart = 1.3 + (HULL_TOP - under) / tan; // where the glacis drops below the cover
    const front = [[xStart, under], [2.05, under]];
    for (const deg of [72, 54]) {
      const a = (deg * Math.PI) / 180;
      front.push([2.05 + 0.26 * Math.cos(a), FENDER_Y - 0.28 + 0.26 * Math.sin(a)]);
    }
    front.push([2.25, glacisY(2.25) + 0.22], [2.25, glacisY(2.25)]);
    const rear = [[-2.1, under], [-2.44, 0.69], [-2.1, 0.56]];
    for (const pts of [front, rear]) {
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
      geo.translate(0, 0, -0.02);
      const mesh = new THREE.Mesh(geo, toon(C.dusty));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.z = s * (HULL_W + 0.02);
      covers.add(mesh);
    }
  }

  // Suspension arms, final drive and idler crank, seen between the wheels.
  function runningGearDetail(s) {
    const z = s * (HULL_HALF + 0.05);
    for (const x of ROAD_WHEELS) {
      const arm = put(tracks, box(0.26, 0.07, 0.05, C.oliveDark, { r: 0.015 }), x + 0.11, WHEEL_Y + 0.05, z);
      arm.rotation.z = 0.42;
    }
    put(tracks, cyl(0.17, 0.12, C.oliveDark, { axis: 'z', seg: 12 }), SPROCKET.x + 0.04, SPROCKET.y, s * (HULL_HALF + 0.06));
    const crank = put(tracks, box(0.26, 0.08, 0.05, C.oliveDark, { r: 0.015 }), IDLER.x - 0.13, IDLER.y + 0.04, z);
    crank.rotation.z = -0.3;
  }

  function buildTracks() {
    for (const s of [-1, 1]) {
      addTrack(s * TRACK_Z);
      for (const x of ROAD_WHEELS) roadWheel(x, s);
      idler(s);
      sprocket(s);
      trackCover(s);
      guardPanels(s);
      runningGearDetail(s);
    }
    // stowage on the left cover (front)
    const top = FENDER_Y + 0.025;
    put(covers, box(0.5, 0.22, 0.38, C.oliveDark, { r: 0.04 }), 0.95, top + 0.11, -1.13);
    put(covers, box(0.18, 0.03, 0.03, C.steel), 0.95, top + 0.235, -1.13);
  }

  // ---------------------------------------------------------------- engine
  // Fuel and exhaust: box tanks along the right cover, an oil tank and the
  // exhaust outlet on the left, drums hung off the rear above the beam.
  function buildEngine() {
    const e = engineBody; // design coordinates (compressed with the hull)
    const top = FENDER_Y + 0.025;
    for (const x of [-1.82, -1.26]) {
      put(e, box(0.56, 0.28, 0.46, C.olive, { r: 0.05 }), x, top + 0.14, 1.07);
      for (const dx of [-0.16, 0.16]) put(e, box(0.035, 0.29, 0.475, C.dark, { r: 0.008 }), x + dx, top + 0.14, 1.07);
      // filler hatch, hinged at its back edge; it bumps open and slaps shut
      const hinge = put(e, new THREE.Group(), x - 0.1, top + 0.285, 1.07);
      put(hinge, box(0.18, 0.025, 0.18, C.oliveDark, { r: 0.008 }), 0.09, 0.012, 0);
      wobble(hinge, 'z', { k: 160, d: 3, gain: 1.6, max: 0.5, oneSided: true });
    }
    put(e, cyl(0.03, 1.15, C.steel, { axis: 'x', seg: 6 }), -1.54, top + 0.3, 1.2); // feed pipe
    put(e, box(0.58, 0.26, 0.44, C.olive, { r: 0.05 }), -1.15, top + 0.13, -1.09); // oil tank
    // exhaust outlet on the left cover, sooty
    put(e, box(0.4, 0.12, 0.3, C.dark, { r: 0.03 }), -1.74, top + 0.06, -0.98);
    for (let i = 0; i < 3; i++) put(e, box(0.03, 0.02, 0.3, C.steel), -1.86 + i * 0.12, top + 0.13, -0.98);
    // unditching beam across the rear, under the drums
    put(e, cyl(0.11, 2.3, C.oliveDark, { axis: 'z', seg: 12 }), -2.3, 0.6, 0);
    for (const z of [-0.6, 0.6]) put(e, box(0.22, 0.14, 0.06, C.steel), -2.2, 0.6, z);

    // Two big drums lying across, side by side, sitting high in U cradles.
    // The cradles hang on a hinged rig at the rear plate: when the turret
    // swings toward the rear, the rig tips the drums down and back out of the
    // barrel's way (see update). The caricature accent: keep them big.
    const DR = 0.41;
    const DL = 1.0;
    const DX = HULL_PROFILE[0][0] * SX - 0.3;
    const DY = WORLD_DECK_Y + 0.16;
    drumRig = new THREE.Group();
    drumRig.position.set(DRUM_HINGE.x, DRUM_HINGE.y, 0);
    engine.add(drumRig);
    const rx = DX - DRUM_HINGE.x; // drum position relative to the hinge
    const ry = DY - DRUM_HINGE.y;
    for (const z of [-0.53, 0.53]) {
      const drum = new THREE.Group();
      drum.position.set(rx, ry, z);
      drumRig.add(drum);
      wobble(drum, 'z', { k: 90, d: 7, gain: 0.5, max: 0.12 });
      wobble(drum, 'x', { k: 90, d: 7, gain: 0.35, max: 0.08 });
      put(drum, cyl(DR, DL, C.olive, { axis: 'z', seg: 20 }));
      // filler cap on a little hinge at the drum end; it bumps when the tank moves
      const capHinge = put(drum, new THREE.Group(), 0.1, 0.22, z > 0 ? DL / 2 + 0.01 : -DL / 2 - 0.01);
      put(capHinge, cyl(0.075, 0.025, C.oliveDark, { axis: 'z', seg: 10 }), 0.07, 0, 0);
      wobble(capHinge, 'z', { k: 150, d: 3, gain: 1.4, max: 0.6, oneSided: true });
      for (const off of [-1, 1]) {
        put(drum, cyl(DR + 0.014, 0.05, C.oliveDark, { axis: 'z', seg: 20 }), 0, 0, off * (DL / 2 - 0.03)); // rolled rims
        put(drum, cyl(DR + 0.01, 0.04, C.dark, { axis: 'z', seg: 20 }), 0, 0, off * DL * 0.24); // straps
        put(drum, box(0.07, 0.09, 0.07, C.steel, { r: 0.014 }), 0, DR + 0.025, off * DL * 0.24); // buckles on top
        // U cradle (on the rig): bottom bar, two uprights hugging the drum, arm to the hinge
        const cz = z + off * DL * 0.24;
        put(drumRig, box(DR * 2 + 0.06, 0.06, 0.07, C.steel, { r: 0.012 }), rx, ry - DR - 0.035, cz);
        for (const ux of [-1, 1]) put(drumRig, box(0.06, DR * 0.9, 0.07, C.steel, { r: 0.012 }), rx + ux * (DR + 0.02), ry - DR * 0.55, cz);
        put(drumRig, box(0.2, 0.07, 0.07, C.steel, { r: 0.012 }), -0.08, ry - DR - 0.035, cz);
        // hinge knuckle bolted to the rear plate (stays on the hull)
        put(engine, cyl(0.06, 0.12, C.dark, { axis: 'z', seg: 8 }), DRUM_HINGE.x, DRUM_HINGE.y, cz);
      }
    }
  }

  // ------------------------------------------------------------------- gun
  // D-10T as one turned profile (no overlapping surfaces to z-fight): barrel,
  // fume extractor near the muzzle, muzzle lip, hollow bore. Canvas cover at
  // the root where it enters the turret.
  function buildGun() {
    gunPivot = new THREE.Group();
    gunPivot.position.set(GUN_BASE_X, GUN_Y, 0);
    gunSlot.add(gunPivot);
    const profile = [
      [0.0, 0.0], [0.115, 0.0], [0.115, 1.46], [0.18, 1.54], [0.18, 1.9], [0.12, 1.98],
      [0.115, 2.0], [0.115, 2.29], [0.13, 2.3], [0.13, 2.37], [0.075, 2.37], [0.075, 2.2],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const barrel = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), toon(C.olive));
    barrel.rotation.z = -Math.PI / 2; // lathe axis (y) -> forward (x)
    barrel.castShadow = barrel.receiveShadow = true;
    gunPivot.add(barrel);
    put(gunPivot, cyl(0.07, 0.12, C.dark, { axis: 'x', seg: 10 }), 2.26, 0, 0); // dark bore, seen through the muzzle
    // square frame bolted to the turret front, holding a square canvas boot
    const fx = turretFrontX(GUN_Y, 0) - 0.03;
    const H = 0.25; // half size of the frame
    for (const sy of [-1, 1]) put(gunSlot, box(0.07, 0.055, H * 2 + 0.055, C.oliveDark, { r: 0.012 }), fx, GUN_Y + sy * H, 0);
    for (const sz of [-1, 1]) put(gunSlot, box(0.07, H * 2, 0.055, C.oliveDark, { r: 0.012 }), fx, GUN_Y, sz * H);
    const boot = put(gunSlot, cyl(H * Math.SQRT2 - 0.02, 0.3, C.canvas, { axis: 'x', seg: 4, radiusEnd: 0.16 }), fx + 0.16, GUN_Y, 0);
    boot.rotation.x = Math.PI / 4; // square, aligned with the frame
    put(gunSlot, cyl(0.15, 0.04, C.dark, { axis: 'x', seg: 12 }), fx + 0.3, GUN_Y, 0); // boot strap
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
    const y0 = turretSurfaceY(LOADER.x, LOADER.z);
    put(mgSlot, cyl(0.25, 0.035, C.dark, { seg: 16 }), LOADER.x, y0 + 0.06, LOADER.z); // ring mount
    put(mgSlot, cyl(0.04, 0.16, C.steel, { seg: 8 }), LOADER.x + 0.18, y0 + 0.14, LOADER.z);
    mgPivot = new THREE.Group();
    mgPivot.position.set(LOADER.x + 0.18, y0 + 0.25, LOADER.z);
    mgSlot.add(mgPivot);
    put(mgPivot, box(0.42, 0.11, 0.11, C.dark, { r: 0.025 }), 0, 0, 0); // receiver
    put(mgPivot, cyl(0.03, 0.75, C.dark, { axis: 'x', seg: 8 }), 0.55, 0.01, 0); // barrel
    put(mgPivot, cyl(0.045, 0.1, C.dark, { axis: 'x', seg: 8 }), 0.88, 0.01, 0); // muzzle brake
    put(mgPivot, box(0.16, 0.12, 0.08, C.olive, { r: 0.015 }), 0.02, -0.03, 0.1); // ammo box
    for (const dz of [-0.05, 0.05]) put(mgPivot, box(0.1, 0.03, 0.03, C.dark), -0.25, 0.02, dz); // spade grips
    put(mgPivot, box(0.03, 0.08, 0.03, C.dark), 0.25, 0.08, 0); // sight post
    mgFlash = put(mgPivot, new THREE.Group(), 1.0, 0.01, 0);
    put(mgFlash, box(0.12, 0.12, 0.12, 0xfff3c4, { glow: true, r: 0.03 }));
    put(mgFlash, box(0.36, 0.05, 0.05, 0xffc24a, { glow: true, r: 0.012 }), 0.12, 0, 0); // forward spike
    put(mgFlash, box(0.05, 0.3, 0.05, 0xffb03a, { glow: true, r: 0.012 }), 0.02, 0, 0); // star arms
    put(mgFlash, box(0.05, 0.05, 0.3, 0xffb03a, { glow: true, r: 0.012 }), 0.02, 0, 0);
    mgFlash.visible = false;
  }

  // ----------------------------------------------------------------- sights
  // L-2 IR searchlight right of the gun, up on the turret front, with its
  // canvas pad on (stock). Gunner's sight glass in the left boss. Commander's
  // small IR lamp on the cupola, also capped.
  function buildSights() {
    const lx = 0.6;
    const lz = 0.52;
    const ly = turretSurfaceY(lx, lz);
    put(sights, box(0.18, 0.1, 0.12, C.dark, { r: 0.02 }), lx + 0.04, ly + 0.03, lz); // bracket
    const light = new THREE.Group();
    light.position.set(lx + 0.24, ly + 0.15, lz);
    sights.add(light);
    put(light, cyl(0.16, 0.28, C.oliveDark, { axis: 'x', seg: 16, radiusEnd: 0.18 }), 0, 0, 0); // housing
    put(light, cyl(0.2, 0.09, C.canvas, { axis: 'x', seg: 16 }), 0.155, 0, 0); // canvas pad over the lens
    put(light, ellipsoid(0.045, 0.17, 0.17, C.canvas, { wseg: 14, hseg: 8 }), 0.2, 0, 0); // pad bulge
    put(light, cyl(0.21, 0.025, C.dark, { axis: 'x', seg: 16 }), 0.13, 0, 0); // drawstring band
    put(light, box(0.04, 0.1, 0.04, C.dark), -0.05, -0.18, 0); // link to the mantlet
    {
      const z = -0.33;
      const y = GUN_Y + 0.08;
      const glass = put(sights, box(0.04, 0.17, 0.06, C.dark, { r: 0.028 }), turretFrontX(y, z) + 0.03, y, z); // gunner's sight glass
      glass.rotation.y = 0.33;
    }
    const { x, z } = COMMANDER;
    const cy = turretSurfaceY(x, z);
    put(sights, cyl(0.06, 0.1, C.oliveDark, { axis: 'x', seg: 10 }), x + 0.3, cy + 0.2, z);
    put(sights, cyl(0.068, 0.04, C.canvas, { axis: 'x', seg: 10 }), x + 0.36, cy + 0.2, z); // cap
  }

  buildTracks();
  updateTracks();
  buildEngine();
  buildGun();
  buildMG();
  buildSights();

  // ------------------------------------------------------------- behaviour
  const tmp = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const prevVel = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let hasPrev = false;
  let recoil = 0;
  let gunFlashTime = 0;
  let gunElev = 0; // barrel elevation toward the target's height
  let drumStow = 0; // 0 = drums up, 1 = tipped down and back
  let mgElev = 0;
  const mgWorld = new THREE.Vector3();
  let mgTimer = 0;
  let bumpTimer = 0.5;
  const events = []; // MG shots this frame, read by the scene for tracers/casings

  // hull springs: pitch (about z), roll (about x), and a small shove in x/z
  const hullSpring = { pitch: 0, vPitch: 0, roll: 0, vRoll: 0, ox: 0, vOx: 0, oz: 0, vOz: 0 };

  // Push every loose part. pitch: about the hull's z axis (nose up +),
  // roll: about its x axis (top toward +z).
  function kickWobblers(pitch, roll) {
    const psi = turret.rotation.y;
    for (const w of wobblers) {
      let p = pitch;
      let r = roll;
      if (w.frame === 'turret') {
        p = pitch * Math.cos(psi) - roll * Math.sin(psi);
        r = pitch * Math.sin(psi) + roll * Math.cos(psi);
      }
      w.v += (w.axis === 'z' ? p : r) * w.gain;
    }
  }

  function fire() {
    recoil = 1;
    gunFlashTime = 0.09;
    // Recoil pushes the hull away from the shot, snapped to the nearest of the
    // four hull directions: front, left, back, right.
    const quadrant = ((Math.round(turret.rotation.y / (Math.PI / 2)) % 4) + 4) % 4;
    const KICK = 1.25;
    const SHOVE = 1.5;
    if (quadrant === 0) { hullSpring.vPitch += KICK; hullSpring.vOx -= SHOVE; kickWobblers(4, 0); }
    if (quadrant === 2) { hullSpring.vPitch -= KICK; hullSpring.vOx += SHOVE; kickWobblers(-4, 0); }
    if (quadrant === 1) { hullSpring.vRoll += KICK; hullSpring.vOz += SHOVE; kickWobblers(0, 4); }
    if (quadrant === 3) { hullSpring.vRoll -= KICK; hullSpring.vOz -= SHOVE; kickWobblers(0, -4); }
    group.updateWorldMatrix(true, true);
    const position = gunPivot.localToWorld(new THREE.Vector3(MUZZLE_X + 0.1, 0, 0));
    const direction = new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld);
    const breech = gunPivot.localToWorld(new THREE.Vector3(0, 0, 0)); // inside the turret: rays start here
    return { position, direction, breech, quadrant };
  }

  // Current muzzle position and gun direction (for effects that follow the
  // barrel after the shot, like the fume-extractor purge).
  function muzzle() {
    gunPivot.updateWorldMatrix(true, false);
    return {
      position: gunPivot.localToWorld(new THREE.Vector3(MUZZLE_X + 0.1, 0, 0)),
      direction: new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld),
      breech: gunPivot.localToWorld(new THREE.Vector3(0, 0, 0)),
    };
  }

  function setSlotVisible(name, visible) {
    for (const g of slotGroups[name] || []) g.visible = visible;
  }

  function stepSpring(x, v, k, d, force, dt) {
    v += (-k * x - d * v + force) * dt;
    return [x + v * dt, v];
  }

  // how far (rad) the turret still has to turn to bear on the aim point
  let aimError = 0;

  // ctx: { aimPoint, mgPoint, speed }
  function update(dt, t, ctx = {}) {
    group.getWorldPosition(tmp);
    const yaw = group.rotation.y;
    if (ctx.aimPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.aimPoint.z - tmp.z), ctx.aimPoint.x - tmp.x) - yaw);
      turret.rotation.y = approachAngle(turret.rotation.y, want, TURRET_SPEED * dt);
      aimError = Math.abs(wrapAngle(want - turret.rotation.y));
    }
    if (ctx.aimPoint) {
      // elevate or depress toward the target's height
      const dist = Math.hypot(ctx.aimPoint.x - tmp.x, ctx.aimPoint.z - tmp.z) - GUN_BASE_X;
      const dy = ctx.aimPoint.y - (tmp.y + WORLD_DECK_Y + GUN_Y);
      const want = THREE.MathUtils.clamp(Math.atan2(dy, Math.max(0.4, dist)), GUN_DEPRESSION, GUN_ELEVATION);
      gunElev += THREE.MathUtils.clamp(want - gunElev, -GUN_PITCH_SPEED * dt, GUN_PITCH_SPEED * dt);
    }
    if (ctx.mgPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.mgPoint.z - tmp.z), ctx.mgPoint.x - tmp.x) - yaw - turret.rotation.y);
      mgPivot.rotation.y = approachAngle(mgPivot.rotation.y, want, MG_SPEED * dt);
      mgPivot.getWorldPosition(mgWorld);
      const dist = Math.hypot(ctx.mgPoint.x - mgWorld.x, ctx.mgPoint.z - mgWorld.z);
      const wantPitch = THREE.MathUtils.clamp(Math.atan2(ctx.mgPoint.y - mgWorld.y, Math.max(0.3, dist)), MG_DEPRESSION, MG_ELEVATION);
      mgElev += THREE.MathUtils.clamp(wantPitch - mgElev, -MG_PITCH_SPEED * dt, MG_PITCH_SPEED * dt);
      mgPivot.rotation.z = mgElev;
    }

    // Drum rig: tip the drums out of the way while the barrel is over the rear
    const offBack = Math.abs(wrapAngle(turret.rotation.y - Math.PI));
    const wantStow = THREE.MathUtils.clamp((1.1 - offBack) / 0.35, 0, 1) > 0 ? 1 : 0;
    drumStow += THREE.MathUtils.clamp(wantStow - drumStow, -DRUM_SPEED * dt, DRUM_SPEED * dt);
    const k = drumStow * drumStow * (3 - 2 * drumStow); // smoothstep: mechanical start and stop
    drumRig.rotation.z = k * DRUM_TIP;
    drumRig.position.set(DRUM_HINGE.x - k * DRUM_SLIDE, DRUM_HINGE.y - k * DRUM_DROP, 0);

    // Running gear
    const speed = ctx.speed || 0;
    for (const w of spinners) w.rotation.z -= (speed * dt) / w.userData.radius;
    if (speed) {
      trackOffset += speed * dt;
      updateTracks();
    }

    // Hull-frame acceleration drives lean and the loose parts.
    let fwdAcc = 0;
    let latAcc = 0;
    if (dt > 0 && hasPrev) {
      vel.copy(tmp).sub(prevPos).divideScalar(dt);
      const acc = vel.clone().sub(prevVel).divideScalar(dt);
      if (acc.length() > 25) acc.setLength(25); // starts and stops are jolts, not explosions
      fwdAcc = acc.x * Math.cos(yaw) - acc.z * Math.sin(yaw);
      latAcc = acc.x * Math.sin(yaw) + acc.z * Math.cos(yaw);
      prevVel.copy(vel);
    }
    prevPos.copy(tmp);
    hasPrev = true;

    // Road bumps while moving
    if (speed > 0.05) {
      bumpTimer -= dt;
      if (bumpTimer <= 0) {
        bumpTimer = 0.25 + Math.random() * 0.6;
        const p = (Math.random() - 0.5) * 0.5;
        const r = (Math.random() - 0.5) * 0.4;
        hullSpring.vPitch += p;
        hullSpring.vRoll += r;
        kickWobblers(p * 6 + (Math.random() - 0.5) * 2, r * 6 + (Math.random() - 0.5) * 2);
      }
    }

    // Hull springs (stiff, lightly underdamped so a shot rocks and settles)
    const h = hullSpring;
    [h.pitch, h.vPitch] = stepSpring(h.pitch, h.vPitch, 95, 8, fwdAcc * 0.012, dt);
    [h.roll, h.vRoll] = stepSpring(h.roll, h.vRoll, 95, 8, -latAcc * 0.012, dt);
    [h.ox, h.vOx] = stepSpring(h.ox, h.vOx, 140, 13, 0, dt);
    [h.oz, h.vOz] = stepSpring(h.oz, h.vOz, 140, 13, 0, dt);
    const bob = Math.abs(Math.sin(t * 11)) * 0.012 * Math.min(1, speed);
    rock.rotation.set(h.roll, 0, h.pitch);
    rock.position.set(h.ox, ROCK_Y + bob, h.oz);

    // Loose parts: driven by acceleration in their own frame
    const psi = turret.rotation.y;
    for (const w of wobblers) {
      let f = fwdAcc;
      let l = latAcc;
      if (w.frame === 'turret') {
        f = fwdAcc * Math.cos(psi) - latAcc * Math.sin(psi);
        l = fwdAcc * Math.sin(psi) + latAcc * Math.cos(psi);
      }
      const force = (w.axis === 'z' ? f : -l) * 0.06 * w.gain;
      [w.a, w.v] = stepSpring(w.a, w.v, w.k, w.d, force, dt);
      if (Math.abs(w.a) > w.max) {
        w.a = Math.sign(w.a) * w.max;
        w.v *= -0.3;
      }
      if (w.oneSided && w.a < 0) {
        w.a = 0;
        w.v = -w.v * 0.35; // slaps shut and bounces
      }
      w.obj.rotation[w.axis] = w.rest + w.a;
    }

    // Main gun: hard, fast recoil with a slower run-out; pitch toward the target
    recoil = Math.max(0, recoil - dt * 3.2);
    const slide = recoil > 0.8 ? 1 : recoil / 0.8;
    gunPivot.position.x = GUN_BASE_X - slide * slide * 0.45;
    gunPivot.rotation.z = gunElev;
    gunFlashTime = Math.max(0, gunFlashTime - dt);
    gunFlash.visible = false; // the scene's glow effects own the cannon flash now

    // Roof MG: bursts while it has a target; each shot is reported as an event
    events.length = 0;
    mgFlash.visible = false;
    if (ctx.mgPoint) {
      mgTimer -= dt;
      const burstOn = Math.sin(t * 2.4) > -0.3; // fire in bursts with short pauses
      if (burstOn && mgTimer <= 0) {
        mgTimer = 0.07;
        mgFlash.visible = true;
        mgFlash.rotation.x = Math.random() * Math.PI;
        mgFlash.scale.setScalar(0.75 + Math.random() * 0.6);
        group.updateWorldMatrix(true, true);
        events.push({
          type: 'mg',
          muzzle: mgPivot.localToWorld(new THREE.Vector3(1.0, 0.01, 0)),
          eject: mgPivot.localToWorld(new THREE.Vector3(0.05, 0.03, 0.08)),
          ejectDir: new THREE.Vector3(0, 0, 1).transformDirection(mgPivot.matrixWorld),
          target: ctx.mgPoint.clone(),
        });
      } else if (mgTimer > 0.045) {
        mgFlash.visible = true; // hold the flash for a frame or two
      }
    }
  }

  mergeStaticChildren(group, new Set(wobblers.map((w) => w.obj)));

  return { group, slotGroups, setSlotVisible, turret, fire, muzzle, update, events, aimError: () => aimError };
}
