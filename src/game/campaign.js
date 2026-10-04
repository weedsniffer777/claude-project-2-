// The campaign: the levels in order, bottom of the map to the top. Each
// level is made of stages (1, 2, the boss). Only the first is scouted.
// rewards: parts that can turn up at its checkpoints. first: what the
// first clear on each difficulty hands over (a tank, scraps). Easy and Hard
// are cleared separately: 'id' and 'id:hard' in the save.
export const CAMPAIGN = [
  { n: 1, id: 'avenue', name: 'Ruined city street', at: [0.3, 0.84], open: true, steps: ['1', '2', 'Boss'], rewards: ['dozer', 'autoloader', 'era', 'afterburner', 'twinmg', 'optics'], first: { easy: { tank: 'light' }, hard: { scraps: 1500 } } },
  { n: 2, at: [0.66, 0.62] },
  { n: 3, at: [0.34, 0.38] },
  { n: 4, at: [0.68, 0.15] },
];
export const campaignLevel = (id) => CAMPAIGN.find((l) => l.id === id) || null;
// the save key for a level cleared on a difficulty
export const clearKey = (id, diff) => (diff === 'hard' ? `${id}:hard` : id);
