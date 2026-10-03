// Saved progress, in this browser: banked scraps, the parts ever found, each
// tank's loadout (the parts it had at the end of its last level), the levels
// beaten. Every key starts 'scavenger.' (the dev kit's reset clears them all).
// Storage can be missing or blocked: everything falls back to defaults.
const K = {
  bank: 'scavenger.bank',
  owned: 'scavenger.owned',
  loadout: 'scavenger.loadout.',
  cleared: 'scavenger.cleared',
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
  cleared: () => read(K.cleared, []),
  clear(level) {
    const list = save.cleared();
    if (!list.includes(level)) write(K.cleared, [...list, level]);
  },
};
