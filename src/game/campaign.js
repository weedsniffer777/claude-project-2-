// The campaign: the levels in order, bottom of the map to the top. Each
// level is made of stages (1, 2, the boss). Only the first is scouted.
// rewards: parts that can turn up at its checkpoints. first: what the
// first clear on each difficulty hands over (a tank, scraps). Easy and Hard
// are cleared separately: 'id' and 'id:hard' in the save.
export const CAMPAIGN = [
  { n: 1, id: 'avenue', name: 'Ruined city street', page: 0, at: [0.3, 0.88], open: true, steps: ['1', '2', 'Boss'], rewards: ['dozer', 'autoloader', 'era'], first: { easy: { equipment: 'artillery' }, hard: { scraps: 1000, tokens: 3 } } },
  { n: 2, id: 'river', name: 'River crossing', page: 0, at: [0.66, 0.7], steps: ['1', '2', 'Boss'], rewards: ['afterburner', 'twinmg', 'optics'], first: { easy: { tank: 'light' }, hard: { part: 'vulcan', tokens: 5 } } },
  { n: 3, id: 'highway', name: 'Highway', page: 0, at: [0.32, 0.52], steps: ['1', '2', '3'], rewards: ['he', 'era', 'afterburner'], first: { easy: { equipment: 'atgm' }, hard: { scraps: 2000, tokens: 6 } } },
  { n: 4, id: 'depot', name: 'Depot', page: 0, at: [0.7, 0.33], steps: ['1', '2', 'Boss'], rewards: ['dozer', 'autoloader', 'he'], first: { easy: { equipment: 'shield' }, hard: { scraps: 2500, tokens: 7 } } },
  { n: 5, id: 'stadium', name: 'Destroyed stadium', page: 0, at: [0.4, 0.13], steps: ['1', 'Boss'], rewards: ['rangefinder', 'twinmg', 'optics'], first: { easy: { tank: 'missile' }, hard: { scraps: 3000, tokens: 8 } } },
  // beyond the city wall: the second page of the map
  { n: 6, name: 'The city gate', page: 1, at: [0.62, 0.84], steps: ['1', '2', 'Boss'], rewards: ['era', 'afterburner', 'rangefinder'], first: { easy: { scraps: 1500, tokens: 4 }, hard: { scraps: 3500, tokens: 9 } } },
  { n: 7, name: 'Suburbs', page: 1, at: [0.28, 0.66], steps: [], rewards: [] },
  { n: 8, name: 'Industrial district', page: 1, at: [0.7, 0.48], steps: [], rewards: [] },
  { n: 9, name: 'Slums', page: 1, at: [0.32, 0.3], steps: [], rewards: [] },
  { n: 10, name: '???', page: 1, at: [0.62, 0.12], steps: [], rewards: [] },
];
export const PAGES = 2;
// open: the first level, and any level whose one before it is cleared
// (either difficulty). Levels with no id yet are still to come.
export const isOpen = (z, cleared) => {
  if (!z.id) return false;
  if (z.open) return true;
  if (cleared.some((k) => k === z.id || k === `${z.id}:hard`)) return true; // (beaten already: before a level was put in ahead of it)
  const prev = CAMPAIGN.find((l) => l.n === z.n - 1);
  return !!prev?.id && cleared.some((k) => k === prev.id || k === `${prev.id}:hard`);
};
export const campaignLevel = (id) => CAMPAIGN.find((l) => l.id === id) || null;
// the save key for a level cleared on a difficulty
export const clearKey = (id, diff) => (diff === 'hard' ? `${id}:hard` : id);
