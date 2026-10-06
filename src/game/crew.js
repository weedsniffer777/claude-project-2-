// The crew: commander, driver and gunner. Each trains up with scraps, one
// level at a time, to level 40; every tenth level is a promotion (scraps
// and tokens), a new rank: Private, Private First Class, Corporal,
// Sergeant, Staff Sergeant. The bonuses are slight: at most 20-25%.
import { sfx } from '../audio.js';
import { save } from './save.js';

export const CREW_MAX = 40;
export const RANKS = ['Private', 'Private First Class', 'Corporal', 'Sergeant', 'Staff Sergeant'];
export const rankOf = (lvl) => Math.min(RANKS.length - 1, Math.floor(lvl / 10));
const k = (lvl) => (lvl - 1) / (CREW_MAX - 1); // 0 .. 1

export const CREW = {
  commander: {
    name: 'Commander',
    bonuses: [
      { label: 'Hull', max: 0.25, apply: (s, f) => (s.maxHp = Math.round(s.maxHp * (1 + f))) },
      { label: 'Cooldowns', max: 0.2, minus: true, apply: (s, f) => (s.cooldownMul *= 1 - f) },
    ],
  },
  driver: {
    name: 'Driver',
    bonuses: [
      { label: 'Speed', max: 0.2, apply: (s, f) => (s.speed *= 1 + f) },
      { label: 'Turning', max: 0.3, apply: (s, f) => (s.turn *= 1 + f) },
    ],
  },
  gunner: {
    name: 'Gunner',
    bonuses: [
      // (reload x 1/(1+f): fire rate up by f)
      { label: 'Fire rate', max: 0.25, apply: (s, f) => ((s.reload /= 1 + f), (s.magReload /= 1 + f)) },
      { label: 'Damage', max: 0.2, apply: (s, f) => (s.cannonDamage *= 1 + f) },
    ],
  },
};
export const CREW_IDS = Object.keys(CREW);

// each bonus's share at a level: { label, value (0..max), minus }
export const crewBonuses = (id, lvl = save.crewLevel(id)) => CREW[id].bonuses.map((b) => ({ label: b.label, value: b.max * k(lvl), minus: !!b.minus }));

export function applyCrew(s) {
  for (const id of CREW_IDS) {
    const f = k(save.crewLevel(id));
    if (f > 0) for (const b of CREW[id].bonuses) b.apply(s, b.max * f);
  }
  // the cooldowns the commander shortens
  for (const key of ['boostCooldown', 'pierceCooldown', 'breakCooldown', 'salvoCooldown', 'hunterCooldown']) if (typeof s[key] === 'number') s[key] *= s.cooldownMul;
}

// the cost of the next level up from lvl: scraps, and tokens at a promotion
export const promotesAt = (lvl) => (lvl + 1) % 10 === 0;
export function crewCost(lvl) {
  const scraps = 80 + 30 * (lvl - 1);
  return promotesAt(lvl) ? { scraps: scraps * 2, tokens: 2 + rankOf(lvl) * 2 } : { scraps, tokens: 0 };
}
export function trainCrew(id) {
  const lvl = save.crewLevel(id);
  if (lvl >= CREW_MAX) return false;
  const c = crewCost(lvl);
  if (save.bank() < c.scraps || save.tokens() < c.tokens) return false;
  save.addBank(-c.scraps);
  if (c.tokens) save.addTokens(-c.tokens);
  save.setCrewLevel(id, lvl + 1);
  sfx.play('click', { gain: 0.7 });
  return true;
}
