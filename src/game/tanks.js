// The tanks you can drive. Each has its own model, gun, movement ability
// (Shift) and signature ability (E), its number of part slots, and the
// stats it changes from the base.
import { createTank } from '../models/tank.js';
import { createLightTank } from '../models/lightTank.js';
import { createMissileTank } from '../models/missileTank.js';
import { createAssaultTank } from '../models/assaultTank.js';

export const TANKS = {
  battle: {
    id: 'battle',
    name: 'Battle tank',
    create: createTank,
    slots: 4,
    gun: 'cannon',
    move: 'boost',
    moveName: 'Boost',
    ability: 'pierce',
    abilityName: 'Piercing shot',
    blurb: 'Heavy and slow, with a big gun. Rams, and punches through lines.',
    stats: { boostTime: 0.65, reload: 1.26 }, // a short, heavy shove; its gun reloads quicker than the base
    // footprint for collisions (hull, covers, the rear drums), tank-local
    box: { cx: -0.25, hx: 2.25, hz: 1.15 },
    // its picture (carousel, rewards): framed on the hull, antennas aside
    pic: { target: [-0.1, 0.95, 0], half: 1.45 },
    // where each part sits on the tank (tank-local), for the fitting
    // screen's lines
    anchors: {
      dozer: [2.1, 0.5, 0],
      autoloader: [-1.0, 1.35, 0],
      era: [1.45, 0.95, -0.3],
      twinmg: [-0.15, 1.75, -0.42],
      afterburner: [-2.05, 0.95, 0.55],
      optics: [0.25, 1.7, 0.45],
      he: [2.6, 1.42, 0],
    },
  },
  light: {
    id: 'light',
    name: 'Light tank',
    create: createLightTank,
    slots: 3,
    gun: 'autocannon',
    move: 'dash', // its boost: a short, snappy one that recharges fast
    moveName: 'Boost',
    ability: 'breakthrough',
    abilityName: 'Breakthrough',
    blurb: 'Fast and fragile, with a rapid-fire autocannon. Charges through anything.',
    unlockText: 'Beat level 2 to unlock',
    // reload: seconds between rounds; mag rounds, then magReload to refill
    // Shift: a quick, hard dash that recharges fast (boostCooldown)
    stats: { maxHp: 70, speed: 1.3, reload: 0.375, cannonDamage: 27.5, splash: 1.5, mag: 10, magReload: 2.0, boostCooldown: 3 },
    box: { cx: 0.2, hx: 1.55, hz: 0.88 },
    pic: { target: [0.15, 0.8, 0], half: 1.0 },
    anchors: {
      dozer: [1.95, 0.4, 0],
      autoloader: [-0.53, 1.36, -0.66],
      era: [1.68, 0.66, -0.3],
      twinmg: [-0.24, 1.75, 0.2],
      afterburner: [-1.4, 0.78, 0.84],
      optics: [-0.95, 1.5, 0],
      he: [1.0, 0.92, 0.1],
    },
  },
  missile: {
    id: 'missile',
    name: 'Missile tank',
    create: createMissileTank,
    slots: 3,
    gun: 'missile',
    move: 'retreat', // its boost: rockets out the front, a quick burst straight back
    moveName: 'Retreat',
    ability: 'salvo',
    abilityName: 'Missile salvo',
    blurb: 'Long-range recon: sees further, fires homing missiles, and backs out of trouble.',
    unlockText: 'Beat level 4 to unlock',
    // reload: seconds between missiles; cannonDamage / splash: each missile's hit
    // a recon / sniper tank: it sees further (+25% view), and its salvo pulls
    // the view back further still (salvoZoom, growing with the tank's level)
    // a missile every reload (about the autocannon's pace), eight in the
    // pack, then a long reload
    stats: { maxHp: 85, speed: 1.08, view: 1.25, reload: 0.256, mag: 8, magReload: 8.8, cannonDamage: 30, splash: 1.8, boostCooldown: 6, salvoZoom: 1.25 },
    box: { cx: 0.05, hx: 2.15, hz: 1.02 },
    pic: { target: [-0.1, 1.0, 0], half: 1.38 },
    anchors: {
      dozer: [2.25, 0.5, 0],
      autoloader: [-0.95, 1.55, 0.6],
      era: [1.5, 0.9, -0.3],
      twinmg: [0.45, 1.6, 0.38],
      afterburner: [-2.05, 0.6, 0.5],
      optics: [0.85, 1.35, 0.42],
      he: [-0.5, 1.12, -0.55],
    },
    // where each part's model sits on this hull: [x, y, z, scale, yaw]
    mounts: {
      dozer: [2.3, 0.15, 0, 0.85, 0],
      autoloader: [-1.45, 1.0, 0.45, 0.5, 0],
      era: [1.35, 0.8, 0, 0.75, 0],
      twinmg: [0.1, 1.05, -0.45, 0.6, 0],
      afterburner: [-2.0, 0.5, 0, 0.7, 0],
      optics: [0.82, 1.32, 0.42, 0.7, 0],
      he: [-0.3, 1.0, -0.55, 0.55, 0],
    },
  },
  assault: {
    id: 'assault',
    name: 'Assault tank',
    create: createAssaultTank,
    slots: 4,
    gun: 'cannon',
    move: 'dash', // its boost: the two rear exhausts, a short hard dash
    moveName: 'Boost',
    ability: 'hunter',
    abilityName: 'Hunter-killer',
    blurb: 'Modern and fast, with a long 120. Its fire control marks up to five enemies in slow motion, then kills them one after another, patching the hull with every hit.',
    unlockText: 'Beat level 8 to unlock',
    // a quicker gun than the battle tank's, a little tougher, quicker on its
    // tracks; its dash short and snappy (about a length and a half)
    stats: { maxHp: 110, speed: 1.12, reload: 1.05, cannonDamage: 62, boostCooldown: 4.5, dashTime: 0.32, dashSpeed: 1.3 },
    box: { cx: 0.02, hx: 2.2, hz: 1.05 },
    pic: { target: [0.15, 1.1, 0], half: 1.5 },
    anchors: {
      dozer: [2.35, 0.6, 0],
      autoloader: [-1.25, 1.75, 0.3],
      era: [1.7, 1.0, -0.4],
      twinmg: [-0.45, 2.0, -0.42],
      afterburner: [-2.2, 0.65, 0.42],
      optics: [0.7, 1.9, 0.42],
      he: [2.6, 1.35, 0],
    },
    // where each part's model sits: [x, y, z, scale, yaw, 'turret' if on
    // the turret (turret-local)]; no entry: nothing to see on this tank
    mounts: {
      dozer: [2.38, 0.28, 0, 0.95, 0],
      era: [1.78, 0.93, 0, 0.8, 0],
      he: [-1.0, 1.04, -0.62, 0.55, Math.PI / 2],
      optics: [0.42, 0.55, -0.1, 0.6, 0, 'turret'],
      rangefinder: [0.66, 0.66, 0.43, 0.5, 0, 'turret'],
      autoloader: [-1.22, 0.6, -0.42, 0.5, 0, 'turret'],
    },
  },
};
export const TANK_ORDER = ['battle', 'light', 'missile', 'assault'];
export const tankDef = (id) => TANKS[id] || TANKS.battle;
