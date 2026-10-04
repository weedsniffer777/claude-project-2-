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
  // part tiers: { id: 0 Rare | 1 Epic | 2 Legendary }
  tiers: () => read(K.tiers, {}),
  setTier(id, n) {
    write(K.tiers, { ...save.tiers(), [id]: n });
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
