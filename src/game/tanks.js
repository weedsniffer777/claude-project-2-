// The tanks you can drive. Each has its own model, gun, movement ability
// (Shift) and signature ability (E), its number of part slots, and the
// stats it changes from the base.
import { createTank } from '../models/tank.js';
import { createLightTank } from '../models/lightTank.js';
import { createMissileTank } from '../models/missileTank.js';

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
    blurb: 'Heavy and slow, with a big gun. Boost to ram, Piercing shot to punch through a line of enemies.',
    stats: { boostTime: 0.65 }, // a short, heavy shove
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
    blurb: 'Fast and fragile. Hold to fire the autocannon; quick boosts on its exhaust rockets; Breakthrough charges through anything in the way, shielded, spoiling enemy aim.',
    unlockText: 'Beat level 2 to unlock',
    // reload: seconds between rounds; mag rounds, then magReload to refill
    // Shift: a quick, hard dash that recharges fast (boostCooldown)
    stats: { maxHp: 70, speed: 1.3, reload: 0.45, cannonDamage: 22, splash: 1.5, mag: 10, magReload: 2.0, boostCooldown: 3 },
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
    blurb: 'Recon and long range: it sees further than the others. Eight homing missiles to a pack. Press R to top the pack up: it reloads a missile at a time and can fire whatever is loaded meanwhile. Retreat rockets it straight back out of trouble (and patches it up a little); Missile salvo pulls the view out and fires eight at once.',
    unlockText: 'Beat level 4 to unlock',
    // reload: seconds between missiles; cannonDamage / splash: each missile's hit
    // a recon / sniper tank: it sees further (+25% view), and its salvo pulls
    // the view back further still (salvoZoom, growing with the tank's level)
    // a missile every reload (about the autocannon's pace), eight in the
    // pack, then a long reload
    stats: { maxHp: 85, speed: 1.08, view: 1.25, reload: 0.42, mag: 8, magReload: 6.5, cannonDamage: 34, splash: 1.8, boostCooldown: 6, salvoZoom: 1.25 },
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
};
export const TANK_ORDER = ['battle', 'light', 'missile'];
export const tankDef = (id) => TANKS[id] || TANKS.battle;
