// Parts bolted onto the tank at checkpoints. Each one changes a stat and
// shows up on the model: build(t) fits it to the battle tank, light(t) (where
// it differs) to the light tank. A part found goes into storage; the fitting
// screen (hangar and checkpoints) puts it in one of the tank's slots.
// The boost (the fuel drums rigged as boosters) is the zone's fixed one-time
// find: an ability, not a pick.
import * as THREE from 'three';
import { box, cyl, put, toon } from '../models/kit.js';
import { PLAYER_LAYER } from '../render/pixel.js';
import { tankDef } from './tanks.js';

export const BASE_STATS = {
  maxHp: 100,
  reload: 1.8,
  cannonDamage: 60,
  splash: 2.4,
  mgDamage: 3,
  mgRange: 12,
  armor: 1, // damage taken multiplier
  ramDamage: 0, // contact damage at speed (dozer)
  crushHeavy: false,
  twinMg: false,
  view: 1, // camera view scale (optics)
  boostSpeed: 1, // x the base boost speed
  boostTime: 1.0,
  boostCooldown: 6,
  speed: 1, // x the base driving speed
  mag: 0, // autocannon: rounds per magazine (0: a single-shot gun)
  magReload: 0,
  pierceDamage: 140,
  pierceCooldown: 12,
  // the light tank's Dash (Shift): seconds, x the boost speed
  dashTime: 0.55,
  dashSpeed: 1.5,
  // its Breakthrough (E): a slower, longer charge, and its recharge
  breakTime: 1.5,
  breakSpeed: 1.0,
  breakCooldown: 8,
  afterburner: false,
};

const RUST = 0x6d5a48;
const STEEL = 0x676e75;
const OLIVE = 0x5f6f47;
const DARKOLIVE = 0x4a5638;
const DARK = 0x262b32;

// icon: 16x10 pixel art for the end screen ('.' clear, '#' bone, '+' amber,
// '-' steel, '*' cyan, '%' pink)
const ERA_EDGE = 0x3a3626;
export const PARTS = {
  dozer: {
    name: 'Dozer blade',
    text: 'Ram enemies for heavy damage. Plows through wrecks.',
    icon: ['................', '.##############.', '.#++++++++++++#.', '.#++++++++++++#.', '.#++++++++++++#.', '.##############.', '...-........-...', '...--......--...', '....--------....', '................'],
    apply(s) {
      s.ramDamage = 45;
      s.crushHeavy = true;
    },
    build(t) {
      const g = new THREE.Group();
      const blade = put(g, box(0.16, 0.7, 2.5, RUST, { r: 0.03 }), 2.3, 0.42, 0);
      blade.rotation.z = 0.18;
      put(g, box(0.05, 0.12, 2.52, 0xc99a2e, { r: 0.01 }), 2.39, 0.72, 0);
      for (const z of [-0.85, 0.85]) {
        const arm = put(g, box(0.9, 0.12, 0.12, STEEL, { r: 0.02 }), 1.85, 0.48, z);
        arm.rotation.z = -0.1;
      }
      t.chassis.add(g);
      return g;
    },
    light(t) {
      const g = new THREE.Group();
      put(g, box(0.12, 0.5, 1.9, RUST, { r: 0.025 }), 2.0, 0.34, 0).rotation.z = 0.18;
      put(g, box(0.04, 0.09, 1.92, 0xc99a2e, { r: 0.01 }), 2.07, 0.56, 0);
      for (const z of [-0.6, 0.6]) put(g, box(0.5, 0.1, 0.1, STEEL, { r: 0.02 }), 1.78, 0.4, z).rotation.z = -0.12;
      t.chassis.add(g);
      return g;
    },
  },
  autoloader: {
    name: 'Fast reload',
    text: 'Main gun reloads faster (an autocannon fires faster too).',
    icon: ['................', '..-----.........', '.-#####-######..', '.-#+#+#-#----#..', '.-#####-#----###', '.-#+#+#-#----#..', '.-#####-######..', '..-----.........', '................', '................'],
    apply(s) {
      if (s.mag) {
        // an autocannon: faster firing and a quicker magazine change
        s.reload *= 0.8;
        s.magReload *= 0.6;
      } else s.reload *= 0.6;
    },
    // an ammo can strapped on the turret's left bin
    light(t) {
      const g = new THREE.Group();
      put(g, box(0.62, 0.17, 0.3, DARKOLIVE, { r: 0.02 }), -0.08, 0.58, -0.66);
      put(g, box(0.1, 0.175, 0.31, 0xc99a2e), 0.12, 0.58, -0.66); // stencil band
      put(g, box(0.2, 0.03, 0.04, DARK), -0.12, 0.68, -0.66); // handle
      t.turret.add(g);
      return g;
    },
    build(t) {
      // a welded bustle box on the turret rear: the magazine lives in here
      const g = new THREE.Group();
      put(g, box(0.75, 0.42, 1.3, DARKOLIVE, { r: 0.04 }), -1.15, 0.24, 0);
      put(g, box(0.7, 0.05, 1.24, OLIVE, { r: 0.02 }), -1.15, 0.47, 0); // lid
      t.turret.add(g);
      return g;
    },
    // on its pallet: the magazine module, shells racked crosswise in a frame
    // with coloured side plates, and the breech it feeds
    model() {
      const g = new THREE.Group();
      const F = 0x8a6a3a; // frame
      // frame: corner posts and rails
      for (const x of [-0.55, 0.55]) for (const z of [-0.45, 0.45]) put(g, box(0.06, 0.62, 0.06, F, { r: 0.01 }), x, 0.33, z);
      for (const y of [0.05, 0.62]) for (const z of [-0.45, 0.45]) put(g, box(1.16, 0.05, 0.05, F, { r: 0.01 }), 0, y, z);
      // side plates (an orange service panel on one)
      put(g, box(0.04, 0.56, 0.86, 0xd06a2a, { r: 0.01 }), 0.57, 0.33, 0);
      put(g, box(0.04, 0.4, 0.5, 0x3a8fb0, { r: 0.01 }), 0.6, 0.36, 0.05);
      put(g, box(0.04, 0.56, 0.86, 0x6a6e74, { r: 0.01 }), -0.57, 0.33, 0);
      // racked rounds, two layers of four, brass bases toward the gun
      for (const y of [0.2, 0.46]) {
        for (let i = 0; i < 4; i++) {
          const z = -0.3 + i * 0.2;
          put(g, cyl(0.07, 1.0, 0x5d6650, { axis: 'x', seg: 8 }), 0, y, z);
          put(g, cyl(0.075, 0.12, 0xc9a24a, { axis: 'x', seg: 8 }), 0.5, y, z);
        }
      }
      // feed tray, then the breech ring and a stub of the gun
      put(g, box(0.5, 0.06, 0.24, STEEL, { r: 0.02 }), 0.85, 0.33, 0);
      put(g, box(0.44, 0.46, 0.5, 0x8e96a0, { r: 0.04 }), 1.3, 0.33, 0);
      put(g, cyl(0.17, 0.3, 0x8e96a0, { axis: 'x', seg: 12 }), 1.65, 0.33, 0);
      put(g, cyl(0.1, 0.8, 0x9aa2ac, { axis: 'x', seg: 10 }), 2.15, 0.33, 0);
      return g;
    },
  },
  era: {
    name: 'Reactive armour',
    text: 'Take 30% less damage.',
    icon: ['................', '.###.###.###.###', '.#+#.#+#.#+#.#+#', '.###.###.###.###', '................', '...###.###.###..', '...#+#.#+#.#+#..', '...###.###.###..', '................', '................'],
    apply(s) {
      s.armor *= 0.7;
    },
    build(t) {
      // a T-72 style conversion: shingled rows of bricks over the whole
      // upper glacis, skirt plates with bricks over the front of the tracks,
      // and on the turret the "crab": two rows of bricks wrapping round its
      // front either side of the gun, the upper row raised on brackets and
      // tipped forward like a clamshell
      const G = 0x56653a;
      const EDGE = 0x333d22;
      const BRACKET = 0x2b3020;
      const g = new THREE.Group();
      const brick = (parent, w, h, d, x, y, z) => {
        const b = put(parent, box(w, h, d, G, { r: 0.012 }), x, y, z);
        put(b, box(w + 0.005, 0.02, 0.02, EDGE), 0, h / 2, d / 2 - 0.01); // its seam
        put(b, box(0.025, 0.012, 0.025, EDGE), w * 0.3, h / 2 + 0.006, 0); // bolt heads
        put(b, box(0.025, 0.012, 0.025, EDGE), -w * 0.3, h / 2 + 0.006, 0);
        return b;
      };
      // glacis: laid in the plane of the plate, each row stepping out
      const gl = new THREE.Group();
      gl.position.set(1.105, 1.075, 0);
      gl.rotation.z = -0.489;
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < 6; i++) {
          const z = -0.6 + i * 0.24;
          if (r === 0 && z < -0.25 && z > -0.55) continue; // the driver's hatch stays clear
          brick(gl, 0.28, 0.07, 0.22, 0.15 + r * 0.29, 0.045, z).rotation.z = 0.1;
        }
      }
      g.add(gl);
      // skirt plates hung from the fender edge, three bricks on each
      for (const s of [-1, 1]) {
        const sk = new THREE.Group();
        sk.position.set(1.15, 0.8, s * 1.16);
        put(sk, box(1.1, 0.36, 0.04, 0x3e4a2c, { r: 0.01 }), 0, 0, 0);
        for (let i = 0; i < 3; i++) {
          const b = brick(sk, 0.3, 0.06, 0.24, -0.36 + i * 0.36, 0, s * 0.05);
          b.rotation.x = (s * Math.PI) / 2;
        }
        g.add(sk);
      }
      t.chassis.add(g);

      // the turret: round its front, either side of the gun, a row of
      // units each a "<" in profile: an upper block sloping up and back, a
      // lower block sloping down and back, meeting at a point out front
      const tg = new THREE.Group();
      const SX = 1.08;
      const PL = 0.38; // each block's length up its slope
      const TILT = 0.6;
      const N = 4;
      for (const side of [-1, 1]) {
        for (let i = 0; i < N; i++) {
          const a = side * (0.38 + i * 0.33);
          const rr = 0.98; // out on the rim, so the whole "<" stands proud
          const u = new THREE.Group();
          u.position.set(SX * rr * Math.cos(a), 0.08, rr * Math.sin(a)); // points just under the gun
          u.rotation.y = -a; // +x out from the turret's middle
          const tip = new THREE.Vector2(0.18, 0.22);
          for (const s of [1, -1]) {
            // s = 1 the upper block, -1 the lower one
            const cx = tip.x - Math.cos(TILT) * PL * 0.5;
            const cy = tip.y + s * Math.sin(TILT) * PL * 0.5;
            const b = put(u, box(PL, 0.1, 0.33, G, { r: 0.015 }), cx, cy, 0);
            b.rotation.z = -s * TILT;
            put(b, box(PL + 0.004, 0.014, 0.014, EDGE), 0, 0.05 * s, 0.155); // seam at its end
          }
          put(u, box(0.26, 0.28, 0.1, BRACKET, { r: 0.01 }), -0.16, 0.22, 0); // the mount behind
          tg.add(u);
        }
      }
      t.turret.add(tg);
      g.userData.extra = [tg];
      return g;
    },
    model() {
      const g = new THREE.Group();
      const plate = put(g, box(1.3, 0.08, 0.9, OLIVE, { r: 0.02 }), 0, 0.3, 0);
      plate.rotation.z = 0.35;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const b = put(plate, box(0.36, 0.14, 0.36, 0x56653a, { r: 0.02 }), -0.42 + c * 0.42, 0.11, -0.2 + r * 0.42);
        b.userData.era = true;
      }
      return g;
    },
    // the light tank: bricks shingled over the front slope, two rows on the
    // front of each turret bin either side of the gun
    light(t) {
      const G = 0x56653a;
      const slope = new THREE.Group();
      slope.position.set(1.42, 0.745, 0);
      slope.rotation.z = -Math.atan2(0.11, 0.56); // rising toward the turret
      for (let k = 0; k < 5; k++) {
        const z = -0.5 + k * 0.25;
        put(slope, box(0.36, 0.07, 0.22, G, { r: 0.012 }), 0, 0.04, z);
        put(slope, box(0.37, 0.02, 0.23, ERA_EDGE), 0, 0.005, z);
      }
      t.chassis.add(slope);
      const cheeks = new THREE.Group();
      for (const zc of [0.65, -0.66]) {
        for (const y of [0.17, 0.33]) {
          for (const dz of [-0.09, 0.09]) {
            put(cheeks, box(0.08, 0.14, 0.16, G, { r: 0.012 }), 0.6, y, zc + dz);
            put(cheeks, box(0.02, 0.15, 0.17, ERA_EDGE), 0.56, y, zc + dz);
          }
        }
      }
      t.turret.add(cheeks);
      slope.userData.extra = [cheeks];
      return slope;
    },
  },
  twinmg: {
    name: 'Second gun',
    text: 'A second machine gun that picks its own target.',
    icon: ['................', '.....------.....', '.....-####-.....', '#########-#.....', '.....-####-.....', '.....------.....', '#########-#.....', '.....-####-.....', '.....------.....', '................'],
    apply(s) {
      s.twinMg = true;
    },
    // a pintle mount on the commander's cupola; the game turns its pivot
    build(t) {
      const g = new THREE.Group();
      const at = t.commanderTop || new THREE.Vector3(-0.15, 0.45, -0.42);
      g.position.copy(at);
      put(g, cyl(0.2, 0.04, DARK, { seg: 14 }), 0, -0.08, 0); // ring
      put(g, cyl(0.035, 0.18, STEEL, { seg: 8 }), 0, 0.02, 0); // pintle
      const pivot = new THREE.Group();
      pivot.position.y = 0.14;
      g.add(pivot);
      put(pivot, box(0.38, 0.11, 0.11, DARK, { r: 0.025 }), 0.02, 0, 0);
      put(pivot, cyl(0.03, 0.7, DARK, { axis: 'x', seg: 8 }), 0.5, 0.01, 0);
      put(pivot, cyl(0.045, 0.1, DARK, { axis: 'x', seg: 8 }), 0.82, 0.01, 0);
      put(pivot, box(0.16, 0.12, 0.08, OLIVE, { r: 0.015 }), 0.02, -0.03, -0.1);
      put(pivot, box(0.14, 0.2, 0.03, OLIVE, { r: 0.01 }), 0.12, 0.08, 0); // gun shield
      g.userData.pivot = pivot;
      g.userData.muzzle = new THREE.Vector3(0.9, 0.01, 0);
      t.turret.add(g);
      return g;
    },
  },
  afterburner: {
    name: 'Improved boost',
    badge: 'up', // its picture gets an up arrow: an improved ability
    text: 'Boost burns hotter: faster and longer, but a longer recharge.',
    icon: ['................', '......-----.....', '%%%***-###-.....', '.%%%**-###-.....', '%%%***-###-.....', '......-----.....', '................', '................', '................', '................'],
    apply(s) {
      s.boostSpeed *= 1.25;
      s.boostTime *= 1.35;
      s.boostCooldown += 2;
      s.afterburner = true;
    },
    build(t) {
      // nothing new to see until it fires: the flame burns blue and pink
      const g = new THREE.Group();
      t.chassis.add(g);
      return g;
    },
    model() {
      // one of the T-55's own rear drums, re-rigged: rolled rims, straps
      // and buckles, the filler cap; on one end a rocket nozzle bolted on
      const g = new THREE.Group();
      const DR = 0.41;
      const DL = 1.0;
      const y = DR + 0.02;
      put(g, cyl(DR, DL, OLIVE, { axis: 'x', seg: 20 }), 0, y, 0);
      for (const s of [-1, 1]) {
        put(g, cyl(DR + 0.014, 0.05, DARKOLIVE, { axis: 'x', seg: 20 }), s * (DL / 2 - 0.03), y, 0); // rolled rims
        put(g, cyl(DR + 0.01, 0.04, DARK, { axis: 'x', seg: 20 }), s * DL * 0.24, y, 0); // straps
        put(g, box(0.07, 0.07, 0.09, STEEL, { r: 0.014 }), s * DL * 0.24, y + DR + 0.02, 0); // buckles
      }
      put(g, cyl(0.075, 0.03, DARKOLIVE, { axis: 'x', seg: 10 }), DL / 2 + 0.02, y + 0.22, 0.1); // filler cap
      // the engine end: a mounting collar, a flared bell, a dark throat
      const end = -DL / 2;
      put(g, cyl(DR - 0.04, 0.12, STEEL, { axis: 'x', seg: 18 }), end - 0.05, y, 0);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.42, 16, 1, true), toon(0x3b3f6a));
      bell.material.side = THREE.DoubleSide;
      bell.rotation.z = Math.PI / 2; // wide end facing out the back (-x)
      bell.position.set(end - 0.31, y, 0);
      g.add(bell);
      put(g, cyl(0.19, 0.04, 0x1d1f22, { axis: 'x', seg: 14 }), end - 0.12, y, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        put(g, box(0.34, 0.03, 0.03, STEEL, { r: 0.005 }), end - 0.2, y + Math.cos(a) * 0.27, Math.sin(a) * 0.27); // braces
      }
      return g;
    },
  },
  optics: {
    name: 'Wider view',
    text: 'See further around you. Machine gun reaches further.',
    icon: ['................', '....######......', '...#------#.....', '..#--****--#####', '..#--*##*--#....', '..#--****--#####', '...#------#.....', '....######......', '................', '................'],
    apply(s) {
      s.view *= 1.14;
      s.mgRange += 2;
    },
    build(t) {
      const g = sightHead();
      g.position.set(0.15, 0.52, 0.3);
      g.scale.setScalar(0.62);
      t.turret.add(g);
      return g;
    },
    light(t) {
      const g = sightHead();
      g.position.set(-0.5, 0.48, 0);
      g.scale.setScalar(0.42);
      t.turret.add(g);
      return g;
    },
    model() {
      const g = new THREE.Group();
      const head = sightHead();
      head.rotation.y = -Math.PI * 0.75; // lens toward the camera (and the results picture)
      head.position.y = 0.05;
      g.add(head);
      return g;
    },
  },
  he: {
    name: 'Explosive shells',
    text: 'Bigger blast and more damage per shot.',
    icon: ['................', '......+.........', '.....+++........', '.....+++........', '.....###........', '.....+++........', '.....###........', '................', '................', '................'],
    apply(s) {
      s.splash *= 1.5;
      s.cannonDamage += s.mag ? 5 : 20;
    },
    light(t) {
      const g = new THREE.Group();
      put(g, box(0.42, 0.2, 0.3, 0x6b5a3e, { r: 0.02 }), 1.0, 0.9, 0.1);
      put(g, box(0.43, 0.05, 0.31, 0xc99a2e, { r: 0.01 }), 1.0, 0.94, 0.1);
      t.chassis.add(g);
      return g;
    },
    build(t) {
      const g = new THREE.Group();
      put(g, box(0.62, 0.3, 0.42, 0x6b5a3e, { r: 0.03 }), -1.25, 1.2, 0.45);
      put(g, box(0.63, 0.06, 0.43, 0xc99a2e, { r: 0.01 }), -1.25, 1.24, 0.45);
      t.chassis.add(g);
      return g;
    },
  },
};

// An armoured sight head: a boxy housing, a big blue main lens and two
// small ones in a recessed face, an armoured shutter swung open to the side.
function sightHead() {
  const g = new THREE.Group();
  const SAND = 0x8f8358;
  const DARKSAND = 0x6f6644;
  put(g, box(0.34, 0.1, 0.42, DARK, { r: 0.02 }), -0.05, 0.05, 0); // traverse ring
  put(g, box(0.6, 0.46, 0.5, SAND, { r: 0.05 }), 0, 0.33, 0); // housing
  put(g, box(0.5, 0.06, 0.52, DARKSAND, { r: 0.02 }), -0.03, 0.58, 0); // brow plate over the face
  // armoured face: a frame round a dark window, the glass set back in it
  put(g, box(0.06, 0.4, 0.42, DARKSAND, { r: 0.02 }), 0.31, 0.33, 0);
  put(g, box(0.03, 0.32, 0.34, 0x16181b), 0.34, 0.33, 0);
  put(g, cyl(0.12, 0.04, 0x2f5fd0, { axis: 'x', seg: 14, glow: true }), 0.355, 0.3, 0.05); // main lens
  put(g, cyl(0.07, 0.045, 0x9fe4ff, { axis: 'x', seg: 12, glow: true }), 0.36, 0.3, 0.05);
  put(g, cyl(0.045, 0.04, 0x5fe6a0, { axis: 'x', seg: 10, glow: true }), 0.355, 0.42, -0.1); // rangefinder
  // shutter hinged on the face's edge, swung open
  const hinge = new THREE.Group();
  hinge.position.set(0.34, 0.33, 0.21);
  hinge.rotation.y = -1.25;
  put(hinge, box(0.04, 0.38, 0.36, DARKSAND, { r: 0.015 }), 0.02, 0, 0.18);
  g.add(hinge);
  return g;
}

// Mark a freshly built part for the player's team outline.
export function attachPart(tank, id) {
  const p = PARTS[id];
  const g = tank.kind === 'light' && p.light ? p.light(tank) : p.build(tank);
  for (const o of [g, ...(g.userData.extra || [])]) o.traverse((m) => m.isMesh && m.layers.enable(PLAYER_LAYER));
  g.userData.part = id;
  return g;
}

export function statsFor(parts, tank = 'battle') {
  const s = { ...BASE_STATS, ...tankDef(tank).stats };
  for (const id of parts) PARTS[id].apply(s);
  return s;
}

// A small model of the part, for its pallet in the depot.
export function partModel(id) {
  const g = new THREE.Group();
  const fake = { chassis: g, turret: g, commanderTop: new THREE.Vector3() };
  const built = PARTS[id].model ? PARTS[id].model() : PARTS[id].build(fake);
  if (built.parent !== g) g.add(built);
  // centre it on the pallet
  const bb = new THREE.Box3().setFromObject(built);
  const c = bb.getCenter(new THREE.Vector3());
  built.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
  return g;
}
