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
};
function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // not saved: storage blocked
  }
}

export const save = {
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
  // parts picked up at a level's checkpoints since it was last cleared:
  // they don't turn up there again as improvements (no farming a level by
  // dying after the checkpoint). Cleared when the level's beaten.
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
  // upgrade tokens: rare drops, spent to evolve a part to its next tier
  tokens: () => read(K.tokens, 0) | 0,
  addTokens(n) {
    write(K.tokens, Math.max(0, save.tokens() + n));
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
