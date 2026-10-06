// Endless: one big arena, waves that never stop coming, a base to fall back
// to between them. What's shared between the hub (the endless room, its
// screen) and the game (the run, its end screen): when it unlocks, the XP a
// run earns, and the reward track that XP fills (one permanent track, paid
// out tier by tier).
import { save } from './save.js';

// it opens once level 3 (the highway) is beaten on Easy
export const ENDLESS_AFTER = { id: 'highway', n: 3 };
export const endlessOpen = () => save.cleared().includes(ENDLESS_AFTER.id);

// the maps (one for now)
export const ENDLESS_MAPS = [{ id: 'endless', name: 'Outskirts', text: 'A crossroads on the edge of the city: wrecks, barricades and ruins round a fortified base.' }];

// a run's XP: every kill, every wave cleared, every half minute held
export function runXp({ kills = 0, waves = 0, time = 0 }) {
  return Math.round(kills * 2 + waves * 12 + Math.floor(time / 30) * 6);
}

// the track: 30 tiers, each a little dearer; scraps and tokens, every fifth
// a crate of both
export const TRACK = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  const crate = n % 5 === 0;
  return {
    n,
    xp: 120 + i * 30, // to get from the tier before to this one
    scraps: crate ? 1500 + i * 120 : n % 2 ? 400 + i * 40 : 0,
    tokens: crate ? 4 + Math.floor(i / 5) * 2 : n % 2 ? 0 : 2 + Math.floor(i / 8),
    crate,
  };
});
// the XP at which each tier is reached
export const TRACK_AT = TRACK.reduce((a, t) => (a.push((a[a.length - 1] || 0) + t.xp), a), []);
// tiers reached at an XP total, and how far into the next
export function trackPos(xp) {
  let tier = 0;
  while (tier < TRACK.length && xp >= TRACK_AT[tier]) tier++;
  const lo = tier ? TRACK_AT[tier - 1] : 0;
  const hi = TRACK_AT[Math.min(tier, TRACK.length - 1)];
  return { tier, k: tier >= TRACK.length ? 1 : (xp - lo) / (hi - lo) };
}
// add a run's XP, pay out every tier it reaches, keep the best run;
// returns { before, after, paid: [tiers] }
export function bankRun({ xp, time, wave }) {
  const e = save.endless();
  const before = e.xp;
  const after = before + xp;
  const reached = trackPos(after).tier;
  const paid = [];
  for (let i = e.claimed; i < reached; i++) {
    const t = TRACK[i];
    if (t.scraps) save.addBank(t.scraps);
    if (t.tokens) save.addTokens(t.tokens);
    paid.push(t);
  }
  const best = { t: Math.max(e.best.t, time), wave: Math.max(e.best.wave, wave) };
  save.setEndless({ ...e, xp: after, claimed: Math.max(e.claimed, reached), best });
  return { before, after, paid, best, newBest: time > e.best.t };
}
// a tier's reward, in words
export const rewardText = (t) => [t.scraps && `${t.scraps} scraps`, t.tokens && `${t.tokens} tokens`].filter(Boolean).join(' + ');

// The track drawn as HTML: a row of tier boxes, the bar under them filled to
// xp (the end screen animates it). Styled by the hub's and the HUD's CSS
// (.etrack).
export function trackHtml(xp, { from = 0, count = 10 } = {}) {
  const { tier } = trackPos(xp);
  const start = Math.max(0, Math.min(TRACK.length - count, Math.max(from, tier - 3)));
  return `<div class="etrack">${TRACK.slice(start, start + count)
    .map((t) => `<div class="tier${t.n <= tier ? ' got' : ''}${t.crate ? ' crate' : ''}" data-n="${t.n}"><b>${t.n}</b><span class="rw">${t.scraps ? `<i class="s"></i>${t.scraps}` : ''}${t.tokens ? `<i class="k"></i>${t.tokens}` : ''}</span></div>`)
    .join('')}</div>`;
}
export const TRACK_CSS = `
.etrack { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 6px; }
.etrack .tier { position: relative; display: grid; gap: 4px; justify-items: center; padding: 6px 2px 7px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 3px #3a3540; font: 400 10px/1 'Silkscreen', monospace; color: #8f877a; }
.etrack .tier b { font-weight: 400; color: #b9b0a0; }
.etrack .tier .rw { display: grid; gap: 3px; justify-items: center; font: 400 10px/1 'Pixelify Sans', monospace; color: #d8d0c0; }
.etrack .tier .rw i { display: inline-block; width: 7px; height: 9px; margin-right: 3px; vertical-align: -1px; }
.etrack .tier .rw i.s { background: #ffb347; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.etrack .tier .rw i.k { background: #c77dff; border-radius: 50%; width: 8px; height: 8px; }
.etrack .tier.crate { box-shadow: 0 0 0 2px #000, 0 0 0 3px #ffc24a; }
.etrack .tier.got { background: #1f2a22; box-shadow: 0 0 0 2px #000, 0 0 0 3px #6be08a; }
.etrack .tier.got b { color: #6be08a; }
.etrack .tier.got::after { content: '✓'; position: absolute; right: 3px; top: 2px; color: #6be08a; font-size: 10px; }
.ebar { position: relative; height: 12px; background: #121014; box-shadow: 0 0 0 2px #000, 0 0 0 3px #3a3540; }
.ebar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(#8ff0a6, #4fae68); }
.ebar span { position: absolute; right: 6px; top: -1px; font: 400 10px/14px 'Silkscreen', monospace; color: #f1e9d8; text-shadow: 1px 1px 0 #000; }
`;
