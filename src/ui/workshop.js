// The upgrades screen (the workshop), opened from the hangar. Its own big
// screen so an upgrade feels like something: every part you own down the
// left; the one picked large on the right, with bars for what the next tier
// adds (filled to where it is now, the gain in green, full at Legendary),
// the Legendary perk waiting, the cost and a big button. Upgrading flashes
// the screen in the new tier's colour, bursts sparks off the part, slams a
// banner down and grows the bars.
import { PARTS, TIERS, TIER_COST, tierOf, partEffects, partPerk } from '../game/parts.js';
import { TANKS } from '../game/tanks.js';
import { partPicture } from '../render/partPictures.js';
import { save } from '../game/save.js';

const CSS = `
.ws { position: fixed; inset: 0; z-index: 13; display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 560px); grid-template-rows: auto minmax(0, 1fr); gap: 18px 26px; justify-content: center; align-content: center;
  padding: calc(18px + env(safe-area-inset-top, 0px)) 20px calc(18px + env(safe-area-inset-bottom, 0px)); background: rgba(8, 7, 9, 0.78);
  color: #f1e9d8; font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; --amber: #ffb347; --go: #6be08a; }
.ws[hidden] { display: none !important; }
.ws [hidden] { display: none !important; }
.ws button { cursor: var(--cursor); font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; border: 0; color: #f1e9d8; }
.ws .pnl { background: rgba(12, 11, 13, 0.94); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; }
.ws .top { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; }
.ws .top h1 { margin: 0; font: 400 26px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.04em; color: var(--amber); text-shadow: 3px 3px 0 #000; }
.ws .bank { display: flex; gap: 8px; align-items: center; padding: 6px 12px; font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.ws .bank i { width: 10px; height: 14px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.ws .bank b { font-weight: 400; color: #f1e9d8; font-variant-numeric: tabular-nums; }
.ws .bank.spend { animation: wsSpend 0.5s steps(4); }
@keyframes wsSpend { 30% { transform: scale(1.15); color: #ff7a6a; } }
.ws .top .back { margin-left: auto; padding: 9px 16px 10px; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.ws .first { grid-column: 1 / -1; padding: 10px 14px; font-size: 14px; color: #111; background: #ffc24a; box-shadow: 0 0 0 2px #000; }
.ws .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; align-content: start; padding: 14px; overflow-y: auto; max-height: 70vh; }
.ws .list .empty { grid-column: 1 / -1; font-size: 14px; color: #8f877a; }
.ws .card { position: relative; display: grid; gap: 4px; justify-items: center; padding: 8px 6px 9px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--tc); text-align: center; }
.ws .card img { width: 96px; height: 64px; image-rendering: pixelated; }
.ws .card .nm { font-size: 10px; line-height: 1.2; }
.ws .card .tn { font-size: 9px; color: var(--tc); }
.ws .card.sel { background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 0 0 0 6px var(--tc); }
.ws .card:hover { filter: brightness(1.15); }
.ws .card .can { position: absolute; right: -6px; top: -8px; padding: 2px 4px; font-size: 9px; color: #111; background: var(--go); box-shadow: 0 0 0 2px #000; }
.ws .pips { display: flex; gap: 4px; }
.ws .pips i { width: 10px; height: 10px; background: #2a2628; box-shadow: 0 0 0 2px #000; }
.ws .pips i.on { background: var(--c); }
.ws .detail { position: relative; display: grid; gap: 12px; padding: 18px 20px 20px; align-content: start; overflow: hidden; }
.ws .head { display: flex; gap: 18px; align-items: center; }
.ws .frame { position: relative; flex: none; width: 216px; height: 144px; background: #141215; box-shadow: 0 0 0 3px #000, 0 0 0 6px var(--tc), 0 0 24px -4px var(--tc); }
.ws .frame img { width: 100%; height: 100%; image-rendering: pixelated; }
.ws .frame .ring { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px; border: 4px solid var(--tc); opacity: 0; pointer-events: none; }
.ws .who { display: grid; gap: 8px; min-width: 0; }
.ws .who .tier { font: 400 13px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--tc); letter-spacing: 0.08em; }
.ws .who h2 { margin: 0; font: 400 24px/1.05 'Silkscreen', monospace; text-transform: uppercase; text-wrap: balance; }
.ws .who p { margin: 0; font-size: 14px; color: #b9b0a0; }
.ws .who .on { font-size: 12px; color: #8f877a; }
.ws .step { display: flex; align-items: center; gap: 10px; font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; color: #8f877a; }
.ws .step b { font-weight: 400; color: var(--from); }
.ws .step b.to { color: var(--to); }
.ws .step .arrow { width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 9px solid #8f877a; }
.ws .stats { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 9px 12px; align-items: center; }
.ws .stats .lb { font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; white-space: nowrap; }
.ws .stats .val { font: 400 12px/1 'Silkscreen', monospace; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
.ws .stats .val .gain { color: var(--go); }
.ws .sbar { position: relative; height: 14px; background: #2a2628; box-shadow: 0 0 0 2px #000; }
.ws .sbar i { position: absolute; left: 0; top: 0; bottom: 0; transition: width 0.7s cubic-bezier(.2,1.4,.4,1); }
.ws .sbar .now { background: var(--amber); }
.ws .sbar .next { background: var(--go); opacity: 0.85; animation: wsGain 0.9s steps(2) infinite; }
.ws .sbar .max { border-right: 2px dashed #6d655a; background: none; }
.ws .sbar.full .now { background: #ffc24a; }
@keyframes wsGain { 50% { opacity: 0.45; } }
.ws .perk { display: grid; gap: 4px; padding: 10px 12px; background: #2a2210; box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffc24a; }
.ws .perk .k { font: 400 10px/1 'Silkscreen', monospace; text-transform: uppercase; color: #ffc24a; letter-spacing: 0.08em; }
.ws .perk b { font: 400 15px/1.1 'Silkscreen', monospace; text-transform: uppercase; font-weight: 400; }
.ws .perk span { font-size: 14px; color: #e8dcc0; }
.ws .perk.locked { filter: saturate(0.4) brightness(0.8); }
.ws .perk.locked .k::after { content: ' · at Legendary'; color: #b9b0a0; }
.ws .go { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 20px 17px; font-size: 17px; color: #111; background: var(--go); box-shadow: 0 5px 0 #2f6b40, 0 0 0 2px #000; }
.ws .go .cost { display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 13px; background: #111; color: var(--amber); }
.ws .go .cost i { width: 8px; height: 12px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.ws .go:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
.ws .go:disabled { color: #8f877a; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #4a4446; cursor: default; }
.ws .go.maxed { color: #111; background: #ffc24a; box-shadow: 0 5px 0 #8a5a1c, 0 0 0 2px #000; }
.ws .flash { position: fixed; inset: 0; pointer-events: none; opacity: 0; z-index: 2; }
.ws .banner { position: fixed; left: 50%; top: 42%; z-index: 3; transform: translate(-50%, -50%); pointer-events: none; font: 400 64px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--tc); text-shadow: 4px 4px 0 #000, -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 0 30px var(--tc); opacity: 0; white-space: nowrap; }
.ws .banner small { display: block; margin-top: 10px; font-size: 18px; color: #f1e9d8; text-align: center; }
.ws .spark { position: fixed; z-index: 3; width: 8px; height: 8px; pointer-events: none; box-shadow: 0 0 0 2px #000; }
@media (max-width: 860px) {
  .ws { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr); align-content: start; overflow-y: auto; }
  .ws .list { display: flex; overflow-x: auto; overflow-y: hidden; max-height: none; padding: 12px; }
  .ws .card { flex: none; width: 120px; }
  .ws .card img { width: 72px; height: 48px; }
  .ws .frame { width: 144px; height: 96px; }
  .ws .who h2 { font-size: 18px; }
  .ws .banner { font-size: 40px; }
}
`;

let injected = false;

export function createWorkshop({ renderer, cursor }) {
  if (!injected) {
    injected = true;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.append(st);
  }
  const root = document.createElement('div');
  root.className = 'ws';
  root.hidden = true;
  root.style.setProperty('--cursor', cursor);
  root.innerHTML = `
    <div class="top"><h1>Upgrades</h1><div class="bank pnl"><i></i>Scraps <b>0</b></div><button type="button" class="back">Back</button></div>
    <div class="first" hidden>Spend scraps to upgrade a part. <b>Epic</b> makes its numbers better; <b>Legendary</b> adds a special perk. Upgrades stay with the part, on whichever tank you fit it to.</div>
    <div class="list pnl"></div>
    <div class="detail pnl"></div>
    <div class="flash"></div>`;
  for (const ev of ['pointerdown', 'pointerup', 'click', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation());
  const $ = (s) => root.querySelector(s);
  let o = null; // { tankId, onClose, onChange }
  let sel = null;
  let busy = false;
  $('.back').addEventListener('click', () => !busy && close());

  const tankFor = (id) => ['battle', 'light'].find((t) => save.loadout(t).includes(id)) || o.tankId;
  const canAfford = (id) => tierOf(id) < TIERS.length - 1 && save.bank() >= TIER_COST[tierOf(id) + 1];
  const pips = (tier) => `<span class="pips">${TIERS.map((t, k) => `<i class="${k <= tier ? 'on' : ''}" style="--c:${TIERS[tier].color}"></i>`).join('')}</span>`;

  function close() {
    root.hidden = true;
    const cb = o?.onClose;
    o = null;
    cb?.();
  }

  function renderList() {
    const list = $('.list');
    const owned = save.owned().filter((id) => PARTS[id]);
    list.innerHTML = owned.length ? '' : '<span class="empty">No parts yet. Find them at checkpoints.</span>';
    for (const id of owned) {
      const tier = tierOf(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `card${id === sel ? ' sel' : ''}`;
      b.dataset.id = id;
      b.style.setProperty('--tc', TIERS[tier].color);
      b.innerHTML = `<img alt="" src="${partPicture(renderer, id, 96, 64)}"><span class="tn">${TIERS[tier].name}</span><span class="nm"></span>${pips(tier)}${canAfford(id) ? '<span class="can">Can upgrade</span>' : ''}`;
      b.querySelector('.nm').textContent = PARTS[id].name;
      b.addEventListener('click', () => {
        if (busy) return;
        sel = id;
        renderList();
        renderDetail();
      });
      list.append(b);
    }
  }

  // each stat the part changes, as a bar: full at its Legendary value
  // (lower-is-better stats inverted), filled to now, the next tier's gain
  // in green
  function statRows(id, tank, tier) {
    const byTier = [0, 1, 2].map((t) => partEffects(id, tank, t));
    const keys = [...new Set(byTier.flatMap((rows) => rows.map((r) => r.key)))];
    return keys.map((key) => {
      const at = (t) => byTier[t].find((r) => r.key === key);
      const ref = at(2) || at(1) || at(0);
      const g = (v) => (ref.dir > 0 ? v : 1 / Math.max(v, 1e-3));
      const base = g(ref.a);
      const max = g(ref.b);
      const span = Math.abs(max - base) < 1e-6 ? 1 : max - base;
      // how much of the way from the bare tank to Legendary this tier is
      const k = (t) => {
        const r = byTier[t].find((x) => x.key === key);
        return r ? Math.max(0.06, Math.min(1, (g(r.b) - base) / span)) : 0.06;
      };
      const now = byTier[tier].find((x) => x.key === key);
      const next = tier < 2 ? byTier[tier + 1].find((x) => x.key === key) : null;
      return { key, label: ref.label, fmt: ref.fmt, now: now ? now.to : ref.from, next: next && (!now || next.to !== now.to) ? next.to : null, kNow: k(tier), kNext: tier < 2 ? k(tier + 1) : k(tier) };
    });
  }

  function renderDetail() {
    const d = $('.detail');
    if (!sel) return void (d.innerHTML = '<span class="empty">Pick a part.</span>');
    const id = sel;
    const tier = tierOf(id);
    const max = tier >= TIERS.length - 1;
    const tank = tankFor(id);
    const tc = TIERS[tier].color;
    d.style.setProperty('--tc', tc);
    const rows = statRows(id, tank, tier);
    const perk = partPerk(id);
    const cost = TIER_COST[tier + 1];
    const short = max ? 0 : cost - save.bank();
    d.innerHTML = `
      <div class="head">
        <div class="frame"><img alt="" src="${partPicture(renderer, id, 216, 144)}"><i class="ring"></i></div>
        <div class="who"><span class="tier">${TIERS[tier].name}</span><h2></h2>${pips(tier)}<p></p><span class="on">Numbers for the ${TANKS[tank].name}${save.loadout(tank).includes(id) ? ' (fitted)' : ''}</span></div>
      </div>
      ${max ? '' : `<div class="step" style="--from:${tc};--to:${TIERS[tier + 1].color}"><b>${TIERS[tier].name}</b><i class="arrow"></i><b class="to">${TIERS[tier + 1].name}</b></div>`}
      <div class="stats">${rows
        .map(
          (r) => `<span class="lb">${r.label}</span>${
            `<span class="sbar${max ? ' full' : ''}" data-key="${r.key}"><i class="max" style="width:100%"></i><i class="next" style="width:${(r.next ? r.kNext : r.kNow) * 100}%"></i><i class="now" style="width:${r.kNow * 100}%"></i></span>`
          }<span class="val">${r.now}${r.next ? ` <span class="gain">→ ${r.next}</span>` : ''}</span>`,
        )
        .join('')}</div>
      ${perk ? `<div class="perk${max ? '' : ' locked'}"><span class="k">Legendary perk</span><b></b><span class="pt"></span></div>` : ''}
      <button type="button" class="go${max ? ' maxed' : ''}" ${max || short > 0 ? 'disabled' : ''}>${
        max ? 'Fully upgraded' : short > 0 ? `Need ${short} more scraps` : `Upgrade to ${TIERS[tier + 1].name}<span class="cost"><i></i>${cost}</span>`
      }</button>`;
    d.querySelector('h2').textContent = PARTS[id].name;
    d.querySelector('.who p').textContent = PARTS[id].text;
    if (perk) {
      d.querySelector('.perk b').textContent = perk.name;
      d.querySelector('.perk .pt').textContent = perk.text;
    }
    if (max) d.querySelector('.go').disabled = false; // (shown bright, does nothing)
    d.querySelector('.go').addEventListener('click', () => !max && upgrade(id));
  }

  function setBank(v) {
    $('.bank b').textContent = v;
  }

  // the moment: spend, flash, sparks, banner, then the bars grow
  function upgrade(id) {
    const tier = tierOf(id);
    const cost = TIER_COST[tier + 1];
    if (busy || cost == null || save.bank() < cost) return;
    busy = true;
    const from = save.bank();
    save.addBank(-cost);
    save.setTier(id, tier + 1);
    const to = TIERS[tier + 1];
    // the scraps roll down
    const bank = $('.bank');
    bank.classList.remove('spend');
    void bank.offsetWidth;
    bank.classList.add('spend');
    const t0 = performance.now();
    const roll = () => {
      const k = Math.min(1, (performance.now() - t0) / 500);
      setBank(Math.round(from - cost * k));
      if (k < 1) requestAnimationFrame(roll);
    };
    roll();
    // the part shudders as it charges up
    const frame = $('.detail .frame');
    frame.animate(
      [{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(3px,-1px)' }, { transform: 'translate(-2px,0)' }, { transform: 'translate(0,0)' }],
      { duration: 380, iterations: 1, easing: 'steps(5)' },
    );
    setTimeout(() => {
      // the flash, in the new tier's colour
      const flash = $('.flash');
      flash.style.background = `radial-gradient(circle at 50% 45%, #ffffff 0%, ${to.color} 35%, transparent 75%)`;
      flash.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
      // the part's frame now in its new colour, a ring bursting off it
      renderList();
      renderDetail();
      const nf = $('.detail .frame');
      nf.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' });
      nf.querySelector('.ring').animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(7)' }], { duration: 650, easing: 'ease-out' });
      sparks(nf.getBoundingClientRect(), to.color);
      $(`.list .card[data-id="${id}"]`)?.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
      // the banner slams down
      const banner = document.createElement('div');
      banner.className = 'banner';
      banner.style.setProperty('--tc', to.color);
      banner.innerHTML = `${to.name}!<small></small>`;
      banner.querySelector('small').textContent = tier + 1 === TIERS.length - 1 && partPerk(id) ? `New perk: ${partPerk(id).name}` : PARTS[id].name;
      root.append(banner);
      banner
        .animate(
          [
            { opacity: 0, transform: 'translate(-50%, -50%) scale(2.6)' },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(0.92)', offset: 0.18 },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.26 },
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 },
            { opacity: 0, transform: 'translate(-50%, -60%) scale(1)' },
          ],
          { duration: 1700, easing: 'ease-out' },
        )
        .finished.then(() => banner.remove());
      // the bars grow from where they were to the new tier
      for (const bar of root.querySelectorAll('.detail .sbar')) {
        const now = bar.querySelector('.now');
        const w = now.style.width;
        now.style.transition = 'none';
        now.style.width = '0%';
        void now.offsetWidth;
        now.style.transition = '';
        setTimeout(() => (now.style.width = w), 250);
      }
      const perkEl = root.querySelector('.detail .perk:not(.locked)');
      if (perkEl && tier + 1 === TIERS.length - 1) perkEl.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, delay: 300, easing: 'ease-out', fill: 'backwards' });
      o?.onChange?.(id);
      setTimeout(() => (busy = false), 600);
    }, 380);
  }

  // pixel sparks flung off the part
  function sparks(rect, color) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      s.style.background = i % 4 ? color : '#ffffff';
      s.style.left = `${cx}px`;
      s.style.top = `${cy}px`;
      const size = 5 + Math.random() * 7;
      s.style.width = s.style.height = `${size}px`;
      root.append(s);
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 220;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d * 0.8;
      s.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 60}px)) scale(0.3)`, opacity: 0 },
        ],
        { duration: 600 + Math.random() * 500, easing: 'cubic-bezier(.1,.8,.3,1)' },
      ).finished.then(() => s.remove());
    }
  }

  return {
    el: root,
    get isOpen() {
      return !root.hidden;
    },
    // opts: { tankId (the hangar's tank), onClose(), onChange(id) }
    show(opts) {
      o = opts;
      root.hidden = false;
      busy = false;
      const owned = save.owned().filter((id) => PARTS[id]);
      // start on something worth upgrading
      if (!sel || !owned.includes(sel)) sel = owned.find(canAfford) || owned.find((id) => save.loadout(o.tankId).includes(id)) || owned[0] || null;
      setBank(save.bank());
      // the first visit: what this is for
      const first = !save.tips().includes('upgrades');
      $('.first').hidden = !first;
      if (first) save.seeTip('upgrades');
      renderList();
      renderDetail();
    },
    hide() {
      root.hidden = true;
      o = null;
    },
  };
}

// is there an upgrade the player can afford and hasn't been shown the
// upgrades screen yet? (the hangar and its button glow)
export function upgradeHint() {
  if (save.tips().includes('upgrades')) return false;
  return save.owned().some((id) => PARTS[id] && tierOf(id) < TIERS.length - 1 && save.bank() >= TIER_COST[tierOf(id) + 1]);
}

