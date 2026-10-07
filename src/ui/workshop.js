// The upgrades screen (the workshop), opened from the hangar. Two tabs:
//  Parts: every part you own; the one picked large, its level (1-30: Rare
//    1-10, Epic 11-20, Legendary 21-30), bars for what it does (full at
//    level 30: filled to now, the next level's gain in green), its
//    Legendary perk, and the button: Level up for scraps, or at 10 and 20
//    Evolve to the next tier for scraps and upgrade tokens.
//  Tanks: each tank's level (1-50) for scraps: a little more hull, gun and
//    speed every level.
// A level up pops; an evolve flashes the screen in the new tier's colour,
// throws sparks, slams a banner down and grows the bars.
import { sfx } from '../audio.js';
import { watchScreens } from './fit.js';
import { fountain, popFrames, ascend } from './celebrate.js';
import { PARTS, TIERS, MAX_LEVEL, TANK_MAX, levelOf, tierOfLevel, evolvesAt, levelCost, evolveCost, tankLevelCost, tankPromotes, tankPromoteCost, partEffects, partPerk, statsFor } from '../game/parts.js';
import { TANKS, TANK_ORDER } from '../game/tanks.js';
import { partPicture } from '../render/partPictures.js';
import { tankPicture, tankStars } from './fitting.js';
import { save } from '../game/save.js';
import { tokenIconURL } from './icons.js';

const CSS = `
.ws { position: fixed; inset: 0; z-index: 13; display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 560px); grid-template-rows: auto auto auto minmax(0, 1fr); gap: 16px 26px; justify-content: center; align-content: center;
  padding: calc(18px + env(safe-area-inset-top, 0px)) 20px calc(18px + env(safe-area-inset-bottom, 0px)); background: rgba(8, 7, 9, 0.78);
  color: #f1e9d8; font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; --amber: #ffb347; --go: #6be08a; --tok: #c77dff; }
.ws[hidden] { display: none !important; }
.ws [hidden] { display: none !important; }
.ws button { cursor: var(--cursor); font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; border: 0; color: #f1e9d8; }
.ws .pnl { background: rgba(12, 11, 13, 0.94); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; }
.ws .top { grid-column: 1 / -1; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.ws .top h1 { margin: 0; font: 400 26px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.04em; color: var(--amber); text-shadow: 3px 3px 0 #000; }
.ws .bank { display: flex; gap: 8px; align-items: center; padding: 6px 12px; font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.ws .bank i { width: 10px; height: 14px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.ws .bank b { font-weight: 400; color: #f1e9d8; font-variant-numeric: tabular-nums; }
.ws .bank.tk { color: #d9a8ff; }
.ws .bank.tk i { width: 20px; height: 20px; clip-path: none; background: url(${tokenIconURL()}) center / contain no-repeat; image-rendering: pixelated; }
.ws .bank.spend { animation: wsSpend 0.5s steps(4); }
@keyframes wsSpend { 30% { transform: scale(1.15); color: #ff7a6a; } }
.ws .top .back { margin-left: auto; padding: 9px 16px 10px; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.ws .tabs { grid-column: 1 / -1; display: flex; gap: 12px; }
.ws .tabs button { padding: 9px 18px 10px; font-size: 13px; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.ws .tabs button.on { color: #111; background: var(--amber); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8; }
.ws .first { grid-column: 1 / -1; padding: 10px 14px; font-size: 14px; color: #111; background: #ffc24a; box-shadow: 0 0 0 2px #000; }
.ws .list, .ws .detail { grid-row: 4; }
.ws .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; align-content: start; padding: 14px; overflow-y: auto; max-height: 66vh; }
.ws .list .empty { grid-column: 1 / -1; font-size: 14px; color: #8f877a; }
.ws .card { position: relative; display: grid; gap: 4px; justify-items: center; padding: 8px 6px 9px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--tc); text-align: center; }
.ws .card img { width: 96px; height: 64px; image-rendering: pixelated; }
.ws .card .nm { font-size: 10px; line-height: 1.2; }
.ws .card .tn { font-size: 9px; color: var(--tc); }
.ws .card.sel { background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 0 0 0 6px var(--tc); }
.ws .card:hover { filter: brightness(1.15); }
.ws .card .can { position: absolute; right: -6px; top: -8px; padding: 2px 4px; font-size: 9px; color: #111; background: var(--go); box-shadow: 0 0 0 2px #000; }
.ws .card .can.ev { background: var(--tok); }
.ws .detail { position: relative; display: grid; gap: 12px; padding: 18px 20px 20px; align-content: start; overflow: hidden; }
.ws .head { display: flex; gap: 18px; align-items: center; }
.ws .frame { position: relative; flex: none; width: 216px; height: 144px; background: #141215; box-shadow: 0 0 0 3px #000, 0 0 0 6px var(--tc), 0 0 24px -4px var(--tc); }
.ws .frame img { width: 100%; height: 100%; image-rendering: pixelated; }
.ws .frame .ring { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px; border: 4px solid var(--tc); opacity: 0; pointer-events: none; }
.ws .who { display: grid; gap: 7px; min-width: 0; }
.ws .who .tier { font: 400 13px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--tc); letter-spacing: 0.08em; }
.ws .who h2 { margin: 0; font: 400 24px/1.05 'Silkscreen', monospace; text-transform: uppercase; text-wrap: balance; }
.ws .who p { margin: 0; font-size: 14px; color: #b9b0a0; }
.ws .who .on { font-size: 12px; color: #8f877a; }
.ws .lvl { position: relative; display: flex; align-items: baseline; gap: 8px; font: 400 18px/1 'Silkscreen', monospace; text-transform: uppercase; }
.ws .lvl small { font-size: 11px; color: #8f877a; }
.ws .pips { display: flex; gap: 3px; }
.ws .pips i { width: 9px; height: 9px; background: #2a2628; box-shadow: 0 0 0 2px #000; }
.ws .pips i.on { background: var(--tc); }
.ws .lbar { position: relative; height: 10px; background: #2a2628; box-shadow: 0 0 0 2px #000; }
.ws .lbar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--tc); }
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
.ws .perk.locked .k::after { content: ' · at Legendary (level 21)'; color: #b9b0a0; }
.ws .go { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; padding: 16px 20px 17px; font-size: 17px; color: #111; background: var(--go); box-shadow: 0 5px 0 #2f6b40, 0 0 0 2px #000; }
.ws .go.ev { background: var(--tok); box-shadow: 0 5px 0 #6a2fa0, 0 0 0 2px #000; animation: wsEv 1.2s steps(2) infinite; }
@keyframes wsEv { 50% { box-shadow: 0 5px 0 #6a2fa0, 0 0 0 2px #000, 0 0 18px 2px #c77dffaa; } }
.ws .go .cost { display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 13px; background: #111; color: var(--amber); }
.ws .go .cost i { width: 8px; height: 12px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.ws .go .cost.tk { color: #d9a8ff; }
.ws .go .cost.tk i { width: 16px; height: 16px; clip-path: none; background: url(${tokenIconURL()}) center / contain no-repeat; image-rendering: pixelated; }
.ws .go:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
.ws .go:disabled { color: #8f877a; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #4a4446; cursor: var(--cursor); animation: none; }
.ws .go.maxed { color: #111; background: #ffc24a; box-shadow: 0 5px 0 #8a5a1c, 0 0 0 2px #000; }
.ws .flash { position: fixed; inset: 0; pointer-events: none; opacity: 0; z-index: 2; }
.ws .banner { position: fixed; left: 50%; top: 42%; z-index: 3; transform: translate(-50%, -50%); pointer-events: none; font: 400 64px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--tc); text-shadow: 4px 4px 0 #000, -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 0 30px var(--tc); opacity: 0; white-space: nowrap; }
.ws .banner small { display: block; margin-top: 10px; font-size: 18px; color: #f1e9d8; text-align: center; }
.ws .plus { position: absolute; left: 100%; top: -4px; margin-left: 10px; font: 400 16px/1 'Silkscreen', monospace; color: var(--go); text-shadow: 2px 2px 0 #000; pointer-events: none; white-space: nowrap; }
.ws .spark { position: fixed; z-index: 3; width: 8px; height: 8px; pointer-events: none; box-shadow: 0 0 0 2px #000; }
@media (max-width: 860px) and (orientation: portrait) {
  .ws { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto minmax(0, 1fr); align-content: start; overflow-y: auto; }
  .ws .list { display: flex; overflow-x: auto; overflow-y: hidden; max-height: none; padding: 12px; }
  .ws .card { flex: none; width: 120px; }
  .ws .card img { width: 72px; height: 48px; }
  .ws .frame { width: 144px; height: 96px; }
  .ws .who h2 { font-size: 18px; }
  .ws .banner { font-size: 40px; }
}
/* phones: the list over the details, the whole screen scrolling */
.ws .banner { max-width: calc(100vw - 24px); white-space: normal; text-align: center; }
@media (max-width: 860px) and (orientation: portrait) {
  .ws { grid-template-rows: none; grid-auto-rows: max-content; background: rgba(8, 7, 9, 0.94); }
  .ws .list { grid-row: 4; }
  .ws .detail { grid-row: 5; overflow: visible; }
  .ws .head { flex-wrap: wrap; }
  .ws .top { gap: 10px; }
  .ws .top h1 { font-size: 20px; }
}
@media (max-width: 420px) {
  .ws { padding-left: 12px; padding-right: 12px; gap: 14px; }
  .ws .detail { padding: 14px 12px 16px; }
  .ws .stats { grid-template-columns: auto minmax(0, 1fr); }
  .ws .stats .val { grid-column: 1 / -1; text-align: left; }
  .ws .go { font-size: 15px; padding: 14px 12px 15px; }
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
  // (its zoom on screen: the small-screen zoom, and any more to fit it)
  const zoomOf = () => +root.dataset.scale || 1; // (its scale on screen, set by the fitter)
  watchScreens(root, '.ws');
  root.innerHTML = `
    <div class="top"><h1>Upgrades</h1><div class="bank pnl sc"><i></i>Scraps <b>0</b></div><div class="bank pnl tk"><i></i>Tokens <b>0</b></div><button type="button" class="back">Back</button></div>
    <div class="tabs"><button type="button" data-tab="parts">Parts</button><button type="button" data-tab="tanks">Tanks</button></div>
    <div class="first" hidden>Spend scraps to <b>level up</b> parts and tanks. At level 10 and 20 a part <b>evolves</b> to the next tier (Epic, then Legendary with a special perk); that also costs <b>upgrade tokens</b>, rare drops from enemies.</div>
    <div class="list pnl"></div>
    <div class="detail pnl"></div>
    <div class="flash"></div>`;
  for (const ev of ['pointerdown', 'pointerup', 'click', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation());
  const $ = (s) => root.querySelector(s);
  let o = null; // { tankId, onClose, onChange }
  let tab = 'parts';
  let sel = null;
  let selTank = null;
  let busy = false;
  $('.back').addEventListener('click', () => !busy && close());
  for (const b of root.querySelectorAll('.tabs button'))
    b.addEventListener('click', () => {
      if (busy) return;
      tab = b.dataset.tab;
      render();
    });

  const tankFor = (id) => TANK_ORDER.find((t) => save.loadout(t).includes(id)) || o.tankId;
  // what the next step for a part costs, and whether it's an evolve
  function nextStep(id) {
    const lvl = levelOf(id);
    if (lvl >= MAX_LEVEL) return null;
    if (evolvesAt(lvl)) return { evolve: true, ...evolveCost(lvl) };
    return { evolve: false, scraps: levelCost(lvl), tokens: 0 };
  }
  const affordable = (n) => !!n && save.bank() >= n.scraps && save.tokens() >= n.tokens;
  const tierPips = (lvl) => {
    const within = ((lvl - 1) % 10) + 1;
    return `<span class="pips">${Array.from({ length: 10 }, (_, k) => `<i class="${k < within ? 'on' : ''}"></i>`).join('')}</span>`;
  };

  function close() {
    root.hidden = true;
    const cb = o?.onClose;
    o = null;
    cb?.();
  }
  function setBank() {
    $('.bank.sc b').textContent = save.bank();
    $('.bank.tk b').textContent = save.tokens();
  }

  function render() {
    for (const b of root.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    setBank();
    if (tab === 'parts') {
      renderList();
      renderDetail();
    } else {
      renderTanks();
      renderTank();
    }
  }

  // ------------------------------------------------------------- parts
  function renderList() {
    const list = $('.list');
    const owned = save.owned().filter((id) => PARTS[id]);
    list.innerHTML = owned.length ? '' : '<span class="empty">No parts yet. Find them at checkpoints.</span>';
    for (const id of owned) {
      const lvl = levelOf(id);
      const tier = tierOfLevel(lvl);
      const n = nextStep(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `card${id === sel ? ' sel' : ''}`;
      b.dataset.id = id;
      b.style.setProperty('--tc', TIERS[tier].color);
      b.innerHTML = `<img alt="" src="${partPicture(renderer, id, 96, 64)}"><span class="tn">${TIERS[tier].name} · Lv ${lvl}</span><span class="nm"></span>${tierPips(lvl)}${affordable(n) ? `<span class="can${n.evolve ? ' ev' : ''}">${n.evolve ? 'Can evolve' : 'Can level up'}</span>` : ''}`;
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

  // bars over the part's whole range, full at level 30 (lower-is-better
  // stats inverted): filled to now, the next step's gain in green
  function statRows(id, tank, lvl) {
    const at = (l) => partEffects(id, tank, l);
    const now = at(lvl);
    const nx = at(Math.min(MAX_LEVEL, lvl + 1));
    const top = at(MAX_LEVEL);
    const keys = [...new Set([...top, ...nx, ...now].map((r) => r.key))];
    return keys.map((key) => {
      const r0 = top.find((r) => r.key === key) || nx.find((r) => r.key === key) || now.find((r) => r.key === key);
      const g = (v) => (r0.dir > 0 ? v : 1 / Math.max(v, 1e-3));
      const base = g(r0.a);
      const span = g(r0.b) - base || 1;
      const k = (rows) => {
        const r = rows.find((x) => x.key === key);
        return r ? Math.max(0.05, Math.min(1, (g(r.b) - base) / span)) : 0.05;
      };
      const rn = now.find((x) => x.key === key);
      const rx = nx.find((x) => x.key === key);
      const gain = lvl < MAX_LEVEL && rx && (!rn || rx.to !== rn.to) ? rx.to : null;
      return { key, label: r0.label, now: rn ? rn.to : r0.from, next: gain, kNow: k(now), kNext: k(nx) };
    });
  }

  function renderDetail() {
    const d = $('.detail');
    if (!sel) return void (d.innerHTML = '<span class="empty">Pick a part.</span>');
    const id = sel;
    const lvl = levelOf(id);
    const tier = tierOfLevel(lvl);
    const max = lvl >= MAX_LEVEL;
    const n = nextStep(id);
    const tank = tankFor(id);
    const tc = TIERS[tier].color;
    d.style.setProperty('--tc', tc);
    const rows = statRows(id, tank, lvl);
    const perk = partPerk(id);
    const shortS = n ? Math.max(0, n.scraps - save.bank()) : 0;
    const shortT = n ? Math.max(0, n.tokens - save.tokens()) : 0;
    const toTier = n?.evolve ? TIERS[tier + 1] : null;
    const btn = max
      ? 'Fully upgraded'
      : shortS || shortT
        ? `Need ${[shortS && `${shortS} more scraps`, shortT && `${shortT} more tokens`].filter(Boolean).join(' and ')}`
        : n.evolve
          ? `Evolve to ${toTier.name}<span class="cost"><i></i>${n.scraps}</span><span class="cost tk"><i></i>${n.tokens}</span>`
          : `Level up<span class="cost"><i></i>${n.scraps}</span>`;
    const step = max
      ? ''
      : n.evolve
        ? `<div class="step" style="--from:${tc};--to:${toTier.color}"><b>${TIERS[tier].name} Lv ${lvl}</b><i class="arrow"></i><b class="to">${toTier.name} Lv ${lvl + 1}</b></div>`
        : `<div class="step" style="--from:${tc};--to:${tc}"><b>Lv ${lvl}</b><i class="arrow"></i><b class="to">Lv ${lvl + 1}</b></div>`;
    d.innerHTML = `
      <div class="head">
        <div class="frame"><img alt="" src="${partPicture(renderer, id, 216, 144)}"><i class="ring"></i></div>
        <div class="who"><span class="tier">${TIERS[tier].name}</span><h2></h2><div class="lvl">Lv ${lvl}<small>/ ${MAX_LEVEL}</small></div>${tierPips(lvl)}<p></p><span class="on">Numbers for the ${TANKS[tank].name}${save.loadout(tank).includes(id) ? ' (fitted)' : ''}</span></div>
      </div>
      ${step}
      <div class="stats">${rows
        .map(
          (r) =>
            `<span class="lb">${r.label}</span><span class="sbar${max ? ' full' : ''}"><i class="max" style="width:100%"></i><i class="next" style="width:${(r.next ? r.kNext : r.kNow) * 100}%"></i><i class="now" style="width:${r.kNow * 100}%"></i></span><span class="val">${r.now}${r.next ? ` <span class="gain">→ ${r.next}</span>` : ''}</span>`,
        )
        .join('')}</div>
      ${perk ? `<div class="perk${tier >= TIERS.length - 1 ? '' : ' locked'}"><span class="k">Legendary perk</span><b></b><span class="pt"></span></div>` : ''}
      <button type="button" class="go${max ? ' maxed' : n.evolve ? ' ev' : ''}" ${!max && (shortS || shortT) ? 'disabled' : ''}>${btn}</button>`;
    d.querySelector('h2').textContent = PARTS[id].name;
    d.querySelector('.who p').textContent = PARTS[id].text;
    if (perk) {
      d.querySelector('.perk b').textContent = perk.name;
      d.querySelector('.perk .pt').textContent = perk.text;
    }
    d.querySelector('.go').addEventListener('click', () => !max && upgradePart(id));
  }

  function spend(n) {
    for (const b of root.querySelectorAll('.bank')) {
      b.classList.remove('spend');
      void b.offsetWidth;
      b.classList.add('spend');
    }
    save.addBank(-n.scraps);
    if (n.tokens) save.addTokens(-n.tokens);
    setBank();
  }

  function upgradePart(id) {
    const n = nextStep(id);
    if (busy || !affordable(n)) return;
    const lvl = levelOf(id);
    // (what gets better, read off before it does)
    const lines = statRows(id, tankFor(id), lvl)
      .filter((r) => r.next)
      .map((r) => ({ label: r.label, from: r.now, to: r.next }));
    spend(n);
    save.setPartLevel(id, lvl + 1);
    sfx.play('click', { gain: 0.7 });
    o?.onChange?.(id);
    const redraw = () => (renderList(), renderDetail());
    if (!n.evolve) return levelPop(redraw);
    const tier = tierOfLevel(lvl);
    evolve(
      {
        pic: partPicture(renderer, id, 216, 144),
        name: PARTS[id].name,
        from: TIERS[tier],
        to: TIERS[tier + 1],
        title: `${TIERS[tier + 1].name}!`,
        lines,
        perk: lvl + 1 === 21 && partPerk(id) ? partPerk(id) : null,
      },
      redraw,
    );
  }

  // ------------------------------------------------------------- tanks
  function renderTanks() {
    const list = $('.list');
    list.innerHTML = '';
    const have = save.tanks();
    if (!selTank || !have.includes(selTank)) selTank = have.includes(o.tankId) ? o.tankId : have[0];
    for (const id of TANK_ORDER.filter((t) => have.includes(t))) {
      const lvl = save.tankLevel(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `card${id === selTank ? ' sel' : ''}`;
      b.style.setProperty('--tc', '#ffb347');
      const promo = tankPromotes(lvl);
      const can = lvl < TANK_MAX && (promo ? save.bank() >= tankPromoteCost(lvl).scraps && save.tokens() >= tankPromoteCost(lvl).tokens : save.bank() >= tankLevelCost(lvl));
      b.innerHTML = `<img alt="" src="${tankPicture(renderer, id)}">${tankStars(lvl)}<span class="tn">Lv ${lvl}</span><span class="nm"></span>${can ? `<span class="can${promo ? ' ev' : ''}">${promo ? 'Can promote' : 'Can level up'}</span>` : ''}`;
      b.querySelector('.nm').textContent = TANKS[id].name;
      b.addEventListener('click', () => {
        if (busy) return;
        selTank = id;
        renderTanks();
        renderTank();
      });
      list.append(b);
    }
  }
  const TANK_ROWS = [
    ['maxHp', 'Hull', (v) => `${Math.round(v)}`],
    ['cannonDamage', 'Shell damage', (v) => `${Math.round(v)}`],
    ['mgDamage', 'MG damage', (v) => `${+v.toFixed(1)}`],
    ['speed', 'Speed', (v) => `${Math.round(v * 100)}%`],
    ['breakShield', 'Ability damage cut', (v) => `${Math.round(v * 100)}%`],
  ];
  function renderTank() {
    const d = $('.detail');
    const id = selTank;
    if (!id) return void (d.innerHTML = '');
    const lvl = save.tankLevel(id);
    const max = lvl >= TANK_MAX;
    // every tenth level the next is a promotion: tokens too
    const promo = tankPromotes(lvl);
    const pc = promo ? tankPromoteCost(lvl) : null;
    const cost = promo ? pc.scraps : tankLevelCost(lvl);
    const tokens = promo ? pc.tokens : 0;
    const short = Math.max(0, cost - save.bank());
    const shortT = Math.max(0, tokens - save.tokens());
    d.style.setProperty('--tc', '#ffb347');
    const at = (l) => statsFor([], id, null, l);
    const now = at(lvl);
    const nx = at(Math.min(TANK_MAX, lvl + 1));
    const top = at(TANK_MAX);
    const one = at(1);
    d.innerHTML = `
      <div class="head">
        <div class="frame"><img alt="" src="${tankPicture(renderer, id, 216, 144)}"><i class="ring"></i></div>
        <div class="who"><span class="tier">Tank</span><h2></h2><div class="lvl">Lv ${lvl}<small>/ ${TANK_MAX}</small></div><div class="lbar"><i style="width:${(lvl / TANK_MAX) * 100}%"></i></div><p>Every level: a little more hull, gun and speed. Every tenth, a promotion (tokens too). Parts add on top.</p></div>
      </div>
      ${max ? '' : `<div class="step" style="--from:#ffb347;--to:#ffb347"><b>Lv ${lvl}</b><i class="arrow"></i><b class="to">Lv ${lvl + 1}</b></div>`}
      <div class="stats">${TANK_ROWS.filter(([key]) => key !== 'breakShield' || TANKS[id].ability === 'breakthrough').map(([key, label, fmt]) => {
        const k = (s) => Math.max(0.05, (s[key] - one[key] * 0.5) / (top[key] - one[key] * 0.5));
        const gain = !max && fmt(nx[key]) !== fmt(now[key]) ? fmt(nx[key]) : null;
        return `<span class="lb">${label}</span><span class="sbar${max ? ' full' : ''}"><i class="max" style="width:100%"></i><i class="next" style="width:${k(gain ? nx : now) * 100}%"></i><i class="now" style="width:${k(now) * 100}%"></i></span><span class="val">${fmt(now[key])}${gain ? ` <span class="gain">→ ${gain}</span>` : ''}</span>`;
      }).join('')}</div>
      <button type="button" class="go${max ? ' maxed' : promo ? ' ev' : ''}" ${!max && (short || shortT) ? 'disabled' : ''}>${
        max
          ? 'Max level'
          : short || shortT
            ? `Need ${[short && `${short} more scraps`, shortT && `${shortT} more tokens`].filter(Boolean).join(' and ')}`
            : promo
              ? `Promote to Lv ${lvl + 1}<span class="cost"><i></i>${cost}</span><span class="cost tk"><i></i>${tokens}</span>`
              : `Level up<span class="cost"><i></i>${cost}</span>`
      }</button>`;
    d.querySelector('h2').textContent = TANKS[id].name;
    d.querySelector('.go').addEventListener('click', () => {
      if (max || busy || save.bank() < cost || save.tokens() < tokens) return;
      spend({ scraps: cost, tokens });
      save.setTankLevel(id, lvl + 1);
      sfx.play('click', { gain: 0.7 });
      o?.onChange?.(null);
      const redraw = () => (renderTanks(), renderTank());
      // a promotion gets the full show
      if (promo)
        evolve(
          {
            pic: tankPicture(renderer, id, 216, 144),
            name: TANKS[id].name,
            from: { name: `Lv ${lvl}`, color: '#ffb347' },
            to: { name: `Lv ${lvl + 1}`, color: '#c77dff' },
            title: 'Promoted!',
            lines: TANK_ROWS.filter(([key]) => key !== 'breakShield' || TANKS[id].ability === 'breakthrough')
              .map(([key, label, fmt]) => ({ label, from: fmt(now[key]), to: fmt(nx[key]) }))
              .filter((l) => l.from !== l.to),
          },
          redraw,
        );
      else levelPop(redraw);
    });
  }

  // ------------------------------------------------------- celebrations
  // a level: redrawn, the picture pops, sparks, "+1" by the level, the
  // bars grow
  function levelPop(redraw) {
    redraw();
    const frame = $('.detail .frame');
    popFrames(frame);
    const tc = getComputedStyle($('.detail')).getPropertyValue('--tc').trim() || '#ffb347';
    fountain(frame.getBoundingClientRect(), tc, 28);
    sparks(frame.getBoundingClientRect(), tc, 10, 0.5);
    const lv = $('.detail .lvl');
    if (lv) {
      const plus = document.createElement('span');
      plus.className = 'plus';
      plus.textContent = '+1';
      lv.append(plus);
      plus
        .animate([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(-4px)', opacity: 1, offset: 0.25 }, { transform: 'translateY(-14px)', opacity: 0 }], { duration: 900, easing: 'ease-out' })
        .finished.then(() => plus.remove());
    }
    growBars(); // (no wait after a level: click away as fast as you like)
  }
  // an evolve (or a tank's tenth level): the full show over everything,
  // then the new card pops in the workshop behind it
  function evolve(info, redraw) {
    busy = true;
    redraw();
    ascend(info).then(() => {
      busy = false;
      const nf = $('.detail .frame');
      if (nf) {
        popFrames(nf);
        fountain(nf.getBoundingClientRect(), info.to.color, 36);
      }
      growBars();
    });
  }
  // the bars grow from nothing to where they are now
  function growBars() {
    for (const bar of root.querySelectorAll('.detail .sbar')) {
      const now = bar.querySelector('.now');
      const w = now.style.width;
      now.style.transition = 'none';
      now.style.width = '0%';
      void now.offsetWidth;
      now.style.transition = '';
      setTimeout(() => (now.style.width = w), 120);
    }
  }
  // pixel sparks flung off the picture
  function sparks(rect, color, count, reach) {
    const cx = (rect.left + rect.width / 2) / zoomOf(); // (into the zoomed overlay's pixels)
    const cy = (rect.top + rect.height / 2) / zoomOf();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      s.style.background = i % 4 ? color : '#ffffff';
      s.style.left = `${cx}px`;
      s.style.top = `${cy}px`;
      const size = 5 + Math.random() * 7;
      s.style.width = s.style.height = `${size}px`;
      root.append(s);
      const a = Math.random() * Math.PI * 2;
      const d = (90 + Math.random() * 220) * reach;
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
    // opts: { tankId (the hangar's tank), select (a part id), onClose(),
    // onChange(partId | null) }
    show(opts) {
      o = opts;
      root.hidden = false;
      busy = false;
      const owned = save.owned().filter((id) => PARTS[id]);
      if (opts.tab) tab = opts.tab;
      // the tanks tab opens on the tank picked in the hangar right now
      if (opts.tankId && save.tanks().includes(opts.tankId)) selTank = opts.tankId;
      if (opts.select && owned.includes(opts.select)) {
        sel = opts.select;
        tab = 'parts';
      } else if (!sel || !owned.includes(sel)) sel = owned.find((id) => affordable(nextStep(id))) || owned.find((id) => save.loadout(o.tankId).includes(id)) || owned[0] || null;
      // the first visit: what this is for
      const first = !save.tips().includes('upgrades');
      $('.first').hidden = !first;
      if (first) save.seeTip('upgrades');
      render();
    },
    hide() {
      root.hidden = true;
      o = null;
    },
  };
}

// can this part evolve to its next tier now (affordable, scraps and tokens)?
export function canEvolve(id) {
  const lvl = levelOf(id);
  if (!evolvesAt(lvl)) return false;
  const c = evolveCost(lvl);
  return save.bank() >= c.scraps && save.tokens() >= c.tokens;
}
export const evolveReady = () => save.owned().filter((id) => PARTS[id] && canEvolve(id));

// is there a level up the player can afford, and they haven't been shown
// the upgrades screen yet? (the hangar and its button glow)
export function upgradeHint() {
  if (save.tips().includes('upgrades')) return false;
  if (save.tanks().some((t) => save.tankLevel(t) < TANK_MAX && !tankPromotes(save.tankLevel(t)) && save.bank() >= tankLevelCost(save.tankLevel(t)))) return true;
  return save.owned().some((id) => PARTS[id] && levelOf(id) < MAX_LEVEL && !evolvesAt(levelOf(id)) && save.bank() >= levelCost(levelOf(id)));
}
