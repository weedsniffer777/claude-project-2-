// The campaign: the levels in order, bottom of the map to the top. Each
// level is made of stages (1, 2, the boss). Only the first is scouted.
// rewards: parts that can turn up at its checkpoints. first: what the
// first clear on each difficulty hands over (a tank, scraps). Easy and Hard
// are cleared separately: 'id' and 'id:hard' in the save.
export const CAMPAIGN = [
  { n: 1, id: 'avenue', name: 'Ruined city street', at: [0.3, 0.84], open: true, steps: ['1', '2', 'Boss'], rewards: ['dozer', 'autoloader', 'era'], first: { easy: { equipment: 'artillery' }, hard: { scraps: 1000, tokens: 3 } } },
  { n: 2, id: 'river', name: 'River crossing', at: [0.66, 0.62], steps: ['1', '2', 'Boss'], rewards: ['afterburner', 'twinmg', 'optics'], first: { easy: { tank: 'light' }, hard: { part: 'vulcan', tokens: 5 } } },
  { n: 3, id: 'highway', name: 'Highway', at: [0.34, 0.38], steps: ['1', '2', '3'], rewards: ['he', 'era', 'afterburner'], first: { easy: { equipment: 'atgm' }, hard: { scraps: 2000, tokens: 6 } } },
  { n: 4, id: 'stadium', name: 'Destroyed stadium', at: [0.68, 0.15], steps: ['1', 'Boss'], rewards: ['twinmg', 'optics', 'autoloader'], first: { easy: { tank: 'missile' }, hard: { scraps: 3000, tokens: 8 } } },
];
// open: the first level, and any level whose one before it is cleared
// (either difficulty). Levels with no id yet are still to come.
export const isOpen = (z, cleared) => {
  if (!z.id) return false;
  if (z.open) return true;
  const prev = CAMPAIGN.find((l) => l.n === z.n - 1);
  return !!prev?.id && cleared.some((k) => k === prev.id || k === `${prev.id}:hard`);
};
export const campaignLevel = (id) => CAMPAIGN.find((l) => l.id === id) || null;
// the save key for a level cleared on a difficulty
export const clearKey = (id, diff) => (diff === 'hard' ? `${id}:hard` : id);
