// Saved progress, in this browser: banked scraps, the parts ever found, each
// tank's loadout (the parts it had at the end of its last level), the levels
// beaten. Every key starts 'scavenger.' (the dev kit's reset clears them all).
// Storage can be missing or blocked: everything falls back to defaults.
const K = {
  bank: 'scavenger.bank',
  owned: 'scavenger.owned',
  loadout: 'scavenger.loadout.',
  cleared: 'scavenger.cleared',
  tank: 'scavenger.tank',
  tanks: 'scavenger.tanks',
  seen: 'scavenger.seen',
  tutorial: 'scavenger.tutorial',
  tips: 'scavenger.tips',
  tiers: 'scavenger.tiers',
  partLevels: 'scavenger.partLevels',
  stars: 'scavenger.stars',
  levelFinds: 'scavenger.levelFinds',
  tankLevels: 'scavenger.tankLevels',
  tokens: 'scavenger.tokens',
  equipment: 'scavenger.equipment.',
  ownedEquipment: 'scavenger.ownedEquipment',
  difficulty: 'scavenger.difficulty',
  crew: 'scavenger.crew',
  endless: 'scavenger.endless',
};
// A run's part progress (parts found, their levels and stars, what each
// level has given, the loadouts) is held in memory while the level's being
// played, and only written when the level properly ends (won or lost):
// restarting, quitting from the pause menu, or closing the game drops it.
const STAGED = [K.owned, K.partLevels, K.stars, K.levelFinds, K.tiers];
const staged = (key) => STAGED.includes(key) || key.startsWith(K.loadout);
let stage = null; // key -> value, while a run's open
function read(key, fallback) {
  if (stage && staged(key) && key in stage) return structuredClone(stage[key]);
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  if (stage && staged(key)) {
    stage[key] = structuredClone(value);
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // not saved: storage blocked
  }
}

export const save = {
  // a run's part progress: held (beginRun), written (commitRun: the level
  // ended properly) or dropped (discardRun)
  beginRun() {
    stage = {};
  },
  commitRun() {
    if (!stage) return;
    const st = stage;
    stage = null;
    for (const [k, v] of Object.entries(st)) write(k, v);
  },
  discardRun() {
    stage = null;
  },
  bank: () => read(K.bank, 0) | 0,
  addBank(n) {
    const total = save.bank() + n;
    if (n) write(K.bank, total);
    return total;
  },
  owned: () => read(K.owned, []),
  own(id) {
    const list = save.owned();
    if (!list.includes(id)) write(K.owned, [...list, id]);
  },
  loadout: (tank = 'battle') => read(K.loadout + tank, []),
  setLoadout: (parts, tank = 'battle') => write(K.loadout + tank, [...parts]),
  // the tank you drive, and the ones you have
  tank() {
    const id = read(K.tank, 'battle');
    return save.tanks().includes(id) ? id : 'battle';
  },
  setTank: (id) => write(K.tank, id),
  tanks: () => read(K.tanks, ['battle']),
  unlockTank(id) {
    const list = save.tanks();
    if (!list.includes(id)) write(K.tanks, [...list, id]);
  },
  // news for the base's "New!" popup: [{ kind: 'tank' | 'part', id }]
  news: () => read(K.seen, []),
  addNews(items) {
    write(K.seen, [...save.news(), ...items]);
  },
  clearNews: () => write(K.seen, []),
  // tutorial tips already shown (each shows once)
  // the equipment slot: one active item per tank (set in the hangar)
  equipment: (tank = 'battle') => read(K.equipment + tank, null),
  setEquipment: (id, tank = 'battle') => write(K.equipment + tank, id),
  ownedEquipment: () => read(K.ownedEquipment, []),
  ownEquipment(id) {
    const list = save.ownedEquipment();
    if (!list.includes(id)) write(K.ownedEquipment, [...list, id]);
  },
  // part levels 1..30: { id: level } (1-10 Rare, 11-20 Epic, 21-30
  // Legendary). Older saves kept a tier: tier t reads as level 10t + 1.
  partLevels() {
    const lv = read(K.partLevels, null);
    if (lv) return lv;
    const old = read(K.tiers, {});
    return Object.fromEntries(Object.entries(old).map(([id, t]) => [id, t * 10 + 1]));
  },
  partLevel: (id) => save.partLevels()[id] || 1,
  setPartLevel(id, n) {
    write(K.partLevels, { ...save.partLevels(), [id]: n });
  },
  // parts picked up at a level's checkpoints (new, or as an improvement):
  // each level gives each of its parts once, ever, like its first find
  levelFinds: (level) => read(K.levelFinds, {})[level] || [],
  addLevelFind(level, id) {
    const all = read(K.levelFinds, {});
    if (!(all[level] || []).includes(id)) write(K.levelFinds, { ...all, [level]: [...(all[level] || []), id] });
  },
  clearLevelFinds(level) {
    const all = read(K.levelFinds, {});
    delete all[level];
    write(K.levelFinds, all);
  },
  // improvements found for a part (a star each, by its icon)
  stars: (id) => read(K.stars, {})[id] || 0,
  addStar(id) {
    write(K.stars, { ...read(K.stars, {}), [id]: save.stars(id) + 1 });
  },
  // the tier, from the level
  tiers: () => Object.fromEntries(Object.entries(save.partLevels()).map(([id, l]) => [id, Math.floor((l - 1) / 10)])),
  // tank levels 1..50: { tankId: level }
  tankLevel: (id) => read(K.tankLevels, {})[id] || 1,
  setTankLevel(id, n) {
    write(K.tankLevels, { ...read(K.tankLevels, {}), [id]: n });
  },
  // the crew's levels: { commander, driver, gunner }
  crewLevel: (id) => read(K.crew, {})[id] || 1,
  setCrewLevel(id, n) {
    write(K.crew, { ...read(K.crew, {}), [id]: n });
  },
  // upgrade tokens: rare drops, spent to evolve a part to its next tier
  tokens: () => read(K.tokens, 0) | 0,
  addTokens(n) {
    write(K.tokens, Math.max(0, save.tokens() + n));
  },
  // Endless: { xp (all-time, for the reward track), claimed (track tiers
  // paid out), best: { t (seconds), wave } }
  endless: () => ({ xp: 0, claimed: 0, best: { t: 0, wave: 0 }, ...read(K.endless, {}) }),
  setEndless(v) {
    write(K.endless, v);
  },
  tips: () => read(K.tips, []),
  seeTip(id) {
    const list = save.tips();
    if (!list.includes(id)) write(K.tips, [...list, id]);
  },
  clearTips: () => write(K.tips, []),
  difficulty: () => read(K.difficulty, 'easy'),
  setDifficulty: (d) => write(K.difficulty, d),
  cleared: () => read(K.cleared, []),
  // level ids, or 'id:hard' for a hard clear; returns true on a first clear
  clear(level) {
    const list = save.cleared();
    if (list.includes(level)) return false;
    write(K.cleared, [...list, level]);
    return true;
  },
};
