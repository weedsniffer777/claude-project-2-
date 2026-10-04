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
import { save } from './save.js';

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
  pierceDamage: 180,
  pierceCooldown: 12,
  // the light tank's Dash (Shift): seconds, x the boost speed
  dashTime: 0.55,
  dashSpeed: 1.5,
  // its Breakthrough (E): a slower, longer charge, and its recharge
  breakTime: 1.5,
  breakSpeed: 1.0,
  breakCooldown: 8,
  breakShield: 0.25, // damage cut while it (or the dash) runs: grows with the tank's level to 0.5
  afterburner: false,
  extraMgs: 0, // extra roof machine guns (Extra MGs), each picking its own target
  spotter: 0, // Legendary Optics: enemies marked every few seconds (how many)
  hotLoader: false, // Legendary Fast reload: a kill reloads the main gun
  reactive: false, // Legendary Reactive armour: blocks a hit every few seconds
  dozerStun: 0, // Legendary Dozer blade: seconds a rammed enemy is stunned
  boostRefund: 0, // Legendary Improved boost: seconds of recharge back per kill while boosting
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
    text: 'Ram enemies for heavy damage.',
    icon: ['................', '.##############.', '.#++++++++++++#.', '.#++++++++++++#.', '.#++++++++++++#.', '.##############.', '...-........-...', '...--......--...', '....--------....', '................'],
    apply(s) {
      s.ramDamage = 45;
      s.crushHeavy = true;
    },
    tiers: [
      { text: 'Rams hit much harder.', apply: (s) => (s.ramDamage = 70) },
      { text: '', perk: 'Plough', perkText: 'Rammed enemies are thrown back and stunned for 1.5 s.', apply: (s) => (s.dozerStun = 1.5) },
    ],
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
    tiers: [
      {
        text: 'Reloads faster still.',
        apply: (s) => {
          if (s.mag) s.magReload *= 0.8;
          else s.reload *= 0.8;
        },
      },
      { text: '', perk: 'Hot loader', perkText: 'Every kill reloads the main gun at once (autocannon: +3 rounds).', apply: (s) => (s.hotLoader = true) },
    ],
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
    tiers: [
      { text: 'Take 38% less damage.', apply: (s) => (s.armor *= 0.62 / 0.7) },
      { text: '', perk: 'Reactive burst', perkText: 'Blocks one hit completely every 8 s, and the blast deals 30 damage to enemies nearby.', apply: (s) => (s.reactive = true) },
    ],
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
    name: 'Extra MGs',
    text: 'A second machine gun that picks its own target.',
    icon: ['................', '.....------.....', '.....-####-.....', '#########-#.....', '.....-####-.....', '.....------.....', '#########-#.....', '.....-####-.....', '.....------.....', '................'],
    apply(s) {
      s.twinMg = true;
      s.extraMgs = Math.max(s.extraMgs, 1);
      s.mgDamage += 0.3; // (and its levels make every MG hit a bit harder)
    },
    tiers: [
      { text: 'One more machine gun: three in all.', apply: (s) => (s.extraMgs = 2) },
      { text: 'Another: four machine guns, each on its own target.', apply: (s) => (s.extraMgs = 3) },
    ],
    // pintle mounts on the turret roof, one per extra gun (more with each
    // tier); the game turns their pivots
    build(t, tier = 0) {
      const all = new THREE.Group();
      const at = t.commanderTop || new THREE.Vector3(-0.15, 0.45, -0.42);
      const light = t.kind === 'light';
      const spots = light
        ? [[0, 0, 0], [-0.42, 0, -0.5], [-0.62, 0, 0.12]]
        : [[0, 0, 0], [0, 0, 0.84], [-0.62, -0.06, 0.42]];
      all.userData.mounts = [];
      for (const [dx, dy, dz] of spots.slice(0, tier + 1)) {
        const g = mgMount();
        g.position.copy(at).add(new THREE.Vector3(dx, dy, dz));
        all.add(g);
        all.userData.mounts.push({ pivot: g.userData.pivot, muzzle: g.userData.muzzle, timer: Math.random() * 0.1 });
      }
      t.turret.add(all);
      return all;
    },
    model: () => mgMount(),
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
    tiers: [
      { text: 'Boost faster and longer still.', apply: (s) => ((s.boostSpeed *= 1.1), (s.boostTime *= 1.15)) },
      { text: '', perk: 'Afterburn', perkText: 'Every kill while boosting takes 2 s off the boost recharge.', apply: (s) => (s.boostRefund = 2) },
    ],
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
    name: 'Optics',
    text: 'See further around you. Machine gun reaches further.',
    icon: ['................', '....######......', '...#------#.....', '..#--****--#####', '..#--*##*--#....', '..#--****--#####', '...#------#.....', '....######......', '................', '................'],
    apply(s) {
      s.view *= 1.14;
      s.mgRange += 2;
    },
    tiers: [
      { text: 'See further still; machine guns reach further.', apply: (s) => ((s.view *= 1.08), (s.mgRange += 2)) },
      { text: '', perk: 'Spotter', perkText: 'Every 5 s the 2 farthest enemies in sight are marked: +30% damage to them for 5 s. Light tank: 3 marked.', apply: (s) => (s.spotter = 2) },
    ],
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
    tiers: [
      { text: 'A bigger blast.', apply: (s) => (s.splash *= 1.2) },
      { text: 'More damage per shot again.', apply: (s) => (s.cannonDamage += s.mag ? 4 : 15) },
    ],
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
  // The light tank's own: its autocannon rebuilt as a six-barrelled rotary
  // gun. A huge magazine fired very fast, each round lighter. Found already
  // Legendary (level 21), as level 2's Hard first clear.
  vulcan: {
    name: 'Vulcan autocannon',
    only: 'light',
    startLevel: 21,
    text: 'Six spinning barrels: a huge magazine fired at a very high rate, less damage per round. Light tank only.',
    icon: ['................', '....--------....', '..-##########-..', '.-#+########+#-.', '..-##########-..', '....--------....', '................', '................', '................', '................'],
    apply(s) {
      if (!s.mag) return;
      s.mag = 60;
      s.reload *= 0.3;
      s.cannonDamage *= 0.45;
      s.magReload += 1.5;
    },
    // the barrels round the gun, and a tracking radar on the gun mount
    light(t) {
      const g = vulcanBarrels();
      g.position.set(0.5, 0, 0);
      (t.gunPivot || t.turret).add(g);
      // a tracking radar on the gun mount, left of the gun's base, like
      // the anti-aircraft Vulcans: a dish on a short post, a feed horn in
      // front of it, sweeping slowly side to side
      const radar = new THREE.Group();
      put(radar, cyl(0.025, 0.24, 0x2b2d30, { seg: 6 }), 0, 0.12, 0); // the post
      const head = new THREE.Group();
      head.position.y = 0.26;
      radar.add(head);
      const dish = put(head, cyl(0.17, 0.05, 0x5f6b48, { seg: 14, radiusEnd: 0.07 }), 0.03, 0, 0); // shallow cone, wide face forward
      dish.rotation.z = -Math.PI / 2;
      put(head, cyl(0.15, 0.012, 0x3a4430, { seg: 14 }), 0.06, 0, 0).rotation.z = Math.PI / 2; // its rim
      put(head, cyl(0.012, 0.16, 0x2b2d30, { seg: 5 }), 0.13, 0, 0).rotation.z = Math.PI / 2; // the feed horn's arm
      put(head, box(0.04, 0.04, 0.04, 0x2b2d30, { r: 0.01 }), 0.21, 0, 0);
      radar.position.set(-0.6, 0.06, -0.24);
      dish.onBeforeRender = () => (head.rotation.y = Math.sin(performance.now() / 700) * 0.6);
      g.add(radar);
      return g;
    },
    build(t) {
      const g = vulcanBarrels();
      g.position.set(0.6, 1.4, 0);
      t.turret.add(g);
      return g;
    },
  },
};
function vulcanBarrels() {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    put(spin, cyl(0.026, 0.82, 0x2b2d30, { axis: 'x', seg: 6 }), 0.41, Math.cos(a) * 0.075, Math.sin(a) * 0.075);
  }
  for (const x of [0.05, 0.45, 0.8]) put(spin, cyl(0.11, 0.05, 0x3a3e42, { axis: 'x', seg: 8 }), x, 0, 0); // clamps
  put(g, cyl(0.13, 0.22, 0x4a5638, { axis: 'x', seg: 10 }), -0.08, 0, 0); // the motor housing
  // the barrels turn (a slow idle spin, always)
  spin.children[0].onBeforeRender = () => (spin.rotation.x += 0.12);
  return g;
}

// A roof machine gun on a pintle (Second gun's mounts): ring, pintle, and
// a pivot carrying the gun, its shield and ammo box; the game turns it.
function mgMount() {
  const g = new THREE.Group();
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
  return g;
}

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
  const tier = tierOf(id);
  const g = tank.kind === 'light' && p.light ? p.light(tank, tier) : p.build(tank, tier);
  for (const o of [g, ...(g.userData.extra || [])]) o.traverse((m) => m.isMesh && m.layers.enable(PLAYER_LAYER));
  g.userData.part = id;
  return g;
}

// Levels and tiers. A part is found at level 1 and goes up to 30: levels
// 1-10 are Rare, 11-20 Epic, 21-30 Legendary. Scraps level it up within a
// tier (each level a little better: by level 10 it's half way to the next
// tier's numbers); at 10 and 20 it evolves, for scraps and upgrade tokens,
// to the next tier (Epic: its full numbers; Legendary: its perk too). A
// part's level goes with it to whichever tank carries it.
export const TIERS = [
  { name: 'Rare', color: '#5fa8e8' },
  { name: 'Epic', color: '#b884f0' },
  { name: 'Legendary', color: '#ffc24a' },
];
export const MAX_LEVEL = 30;
export const levelOf = (id) => Math.max(1, Math.min(MAX_LEVEL, save.partLevel(id)));
export const tierOfLevel = (lvl) => Math.min(TIERS.length - 1, Math.floor((lvl - 1) / 10));
export const tierOf = (id) => tierOfLevel(levelOf(id));
// at 10 and 20 the next step is an evolve, not a level
export const evolvesAt = (lvl) => lvl % 10 === 0 && lvl < MAX_LEVEL;
// scraps for the next level (within a tier)
export function levelCost(lvl) {
  const k = (lvl - 1) % 10 + 1; // 1..9 within the tier
  return [100 + 30 * k, 300 + 60 * k, 800 + 150 * k][tierOfLevel(lvl)];
}
// scraps and tokens to evolve at 10 (to Epic) and 20 (to Legendary)
export const evolveCost = (lvl) => (lvl === 10 ? { scraps: 600, tokens: 3 } : { scraps: 2000, tokens: 8 });

// Tank levels, 1 to 50, for scraps: a little more hull, gun and speed each.
export const TANK_MAX = 50;
export const tankLevelCost = (lvl) => 100 + 30 * (lvl - 1);
// at 10, 20, 30, 40 the next level is a promotion: tokens as well as scraps
export const tankPromotes = (lvl) => lvl % 10 === 0 && lvl < TANK_MAX;
export const tankPromoteCost = (lvl) => ({ scraps: tankLevelCost(lvl) * 2, tokens: 2 + lvl / 5 });
export function applyTankLevel(s, lvl) {
  const k = lvl - 1;
  s.maxHp *= 1 + 0.015 * k;
  s.cannonDamage *= 1 + 0.012 * k;
  s.mgDamage *= 1 + 0.01 * k;
  s.speed *= 1 + 0.003 * k;
  s.breakShield = 0.25 + (0.25 * k) / (TANK_MAX - 1); // the ability gets better with the tank
}

const INT_KEYS = new Set(['mag', 'extraMgs', 'view']); // (view: the camera; it only widens by tier)
const PER_LEVEL = 0.8 / 29; // by level 30, the part's own effect most of the way to twice as strong
// a part at a level, applied to s: its tier's numbers, then every level past
// the first makes what the part improves a little better again (a share of
// its own effect, compounding for the stats it scales). Perks and switches
// come with the tier; whole numbers (machine guns, rounds) only by tier.
function applyPart(s, id, lvl) {
  const p = PARTS[id];
  const tier = tierOfLevel(lvl);
  const bare = { ...s };
  const r1 = { ...s };
  p.apply(r1);
  const S = { ...s };
  p.apply(S);
  for (let k = 0; k < tier; k++) p.tiers?.[k]?.apply(S);
  const n = (lvl - 1) * PER_LEVEL;
  if (n > 0) {
    for (const [key, , , dir] of STAT_ROWS) {
      const a = bare[key];
      const b = r1[key];
      if (typeof a !== 'number' || typeof b !== 'number' || a === b || INT_KEYS.has(key)) continue;
      if ((b - a) * dir <= 0) continue; // a cost of the part (a longer recharge) doesn't grow
      S[key] = a ? S[key] * Math.pow(b / a, n) : S[key] + (b - a) * n;
    }
  }
  Object.assign(s, S);
}

// levels: { partId: level } to use instead of the saved ones; tankLevel
// likewise (null: the saved one)
export function statsFor(parts, tank = 'battle', levels = null, tankLevel = null) {
  const s = { ...BASE_STATS, ...tankDef(tank).stats };
  applyTankLevel(s, tankLevel ?? save.tankLevel(tank));
  for (const id of parts) applyPart(s, id, levels?.[id] ?? levelOf(id));
  // the light tank's affinity for spotting: one more mark
  if (s.spotter && tank === 'light') s.spotter += 1;
  return s;
}

// What a part does, as numbers: each stat it changes, from -> to, and
// whether that's better. lvl: the part at that level against the bare tank
// (at level 1); with `from` (a level), that level against this one.
const pct = (v) => `${Math.round(v * 100)}%`;
const secs = (v) => `${+v.toFixed(2)} s`;
const STAT_ROWS = [
  ['maxHp', 'Hull', (v) => `${Math.round(v)}`, 1],
  ['armor', 'Damage taken', pct, -1],
  ['cannonDamage', 'Shell damage', (v) => `${Math.round(v)}`, 1],
  ['splash', 'Blast radius', (v) => `${v.toFixed(1)} m`, 1],
  ['reload', 'Reload', secs, -1],
  ['mag', 'Rounds', (v) => `${v}`, 1],
  ['magReload', 'Magazine reload', secs, -1],
  ['extraMgs', 'Machine guns', (v) => `${v + 1}`, 1],
  ['mgDamage', 'MG damage', (v) => `${+v.toFixed(1)}`, 1],
  ['mgRange', 'MG range', (v) => `${Math.round(v)} m`, 1],
  ['ramDamage', 'Ram damage without boost', (v) => `${Math.round(v)}`, 1],
  ['view', 'View', pct, 1],
  ['speed', 'Speed', pct, 1],
  ['boostSpeed', 'Boost speed', pct, 1],
  ['boostTime', 'Boost time', secs, 1],
  ['boostCooldown', 'Boost recharge', secs, -1],
];
export function partEffects(id, tank = 'battle', lvl = levelOf(id), from = null) {
  const a = from == null ? statsFor([], tank, null, 1) : statsFor([id], tank, { [id]: from }, 1);
  const b = statsFor([id], tank, { [id]: lvl }, 1);
  const rows = [];
  for (const [key, label, fmt, dir] of STAT_ROWS) {
    const x = +a[key];
    const y = +b[key];
    if (Math.abs(x - y) < 1e-6) continue;
    const up = y > x;
    let delta;
    if (fmt === pct) delta = `${up ? '+' : '−'}${Math.round(Math.abs(y - x) * 100)}%`;
    else if (fmt === secs) delta = `${up ? '+' : '−'}${secs(Math.abs(y - x))}`;
    else delta = `${up ? '+' : '−'}${fmt(Math.abs(y - x) - (key === 'extraMgs' ? 1 : 0)).replace(/^-/, '')}`;
    rows.push({ key, label, from: fmt(x), to: fmt(y), delta, good: (up ? 1 : -1) * dir > 0, a: x, b: y, dir, fmt });
  }
  return rows;
}
// the Legendary perk (if the part has one): { name, text }
export function partPerk(id) {
  const t = PARTS[id].tiers?.[TIERS.length - 2];
  return t?.perk ? { name: t.perk, text: t.perkText } : null;
}
// as HTML: coloured rows (and the perk, if it has it at that level)
export function effectsHtml(id, tank, lvl = levelOf(id)) {
  const tier = tierOfLevel(lvl);
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = partEffects(id, tank, lvl)
    .map((r) => `<div class="fx-row"><span>${r.label}</span><b class="${r.good ? 'good' : 'bad'}">${r.delta}</b></div>`)
    .join('');
  const perk = tier >= TIERS.length - 1 && partPerk(id);
  return rows + (perk ? `<div class="fx-perk"><b>${esc(perk.name)}</b> ${esc(perk.text)}</div>` : '');
}
export const EFFECT_CSS = `
.fx-row { display: flex; justify-content: space-between; gap: 10px; font: 400 12px/1.3 'Pixelify Sans', monospace; color: #d8d0c0; }
.fx-row b { font: 400 11px/1.3 'Silkscreen', monospace; font-weight: 400; white-space: nowrap; }
.fx-row b.good { color: #6be08a; }
.fx-row b.bad { color: #ff7a6a; }
.fx-perk { margin-top: 4px; padding: 5px 7px; font: 400 12px/1.3 'Pixelify Sans', monospace; color: #f1e9d8; background: #2a2210; box-shadow: 0 0 0 2px #000, 0 0 0 3px #ffc24a; text-transform: none; }
.fx-perk b { display: block; font: 400 10px/1.2 'Silkscreen', monospace; text-transform: uppercase; color: #ffc24a; font-weight: 400; }
`;

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
