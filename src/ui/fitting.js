// The fitting screen, shared by the hangar and the checkpoints: the tank's
// stats as bars on the left (with its gun and abilities), its part slots
// and the storage of spare parts on the right, buttons (and in the hangar a
// carousel of tanks) along the bottom.
//
// Click a fitted part to swap or remove it; click an EMPTY slot or a part in
// storage to fit one. With every slot full, a part from storage asks which
// one to replace (or Cancel). A part just found at a checkpoint is shown
// as New with an "Equip now" button.
import * as THREE from 'three';
import { PARTS, statsFor } from '../game/parts.js';
import { TANKS, TANK_ORDER, tankDef } from '../game/tanks.js';
import { partPicture } from '../render/partPictures.js';
import { snapshotCanvas } from '../render/snapshot.js';

const CSS = `
.fit { position: fixed; inset: 0; z-index: 12; pointer-events: none; color: #f1e9d8; font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; --amber: #ffb347; --red: #ff3b2f; --go: #6be08a; }
.fit[hidden] { display: none !important; }
.fit [hidden] { display: none !important; }
.fit .px { font-family: 'Silkscreen', 'Pixelify Sans', monospace; text-transform: uppercase; letter-spacing: 0.06em; }
.fit .pnl { background: rgba(12, 11, 13, 0.9); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; pointer-events: auto; }
.fit svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.fit button { cursor: var(--cursor); font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; border: 0; color: #f1e9d8; }
.fit .left { position: absolute; left: calc(20px + env(safe-area-inset-left, 0px)); top: 50%; transform: translateY(-50%); width: 236px; padding: 14px 16px 16px; display: grid; gap: 10px; }
.fit .left .tag { font-size: 11px; color: #b9b0a0; }
.fit .left h2 { margin: 0; font: 400 19px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.fit .left p { margin: 0; font-size: 13px; color: #d8d0c0; text-wrap: pretty; }
.fit .bars { display: grid; grid-template-columns: auto 1fr; gap: 7px 10px; align-items: center; font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; }
.fit .bar { position: relative; height: 10px; background: #2a2628; box-shadow: 0 0 0 2px #000; }
.fit .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--amber); }
.fit .bar i.pre { background: #f1e9d8; opacity: 0.55; }
.fit .bar i.pre.down { background: var(--red); }
.fit .kit { display: grid; gap: 5px; font-size: 13px; }
.fit .kit div { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; background: #1d1b1e; box-shadow: 0 0 0 2px #000; }
.fit .kit kbd { font: 400 10px/1 'Silkscreen', monospace; padding: 3px 5px; background: #f1e9d8; color: #111; }
.fit .kit span:last-child { color: var(--amber); text-align: right; }
.fit .kit .none { color: #6d655a !important; }
.fit .right { position: absolute; right: calc(20px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); width: 300px; padding: 14px 16px 16px; display: grid; gap: 10px; }
.fit .label { font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; letter-spacing: 0.06em; }
.fit .slots { display: grid; gap: 8px; }
.fit .slot { position: relative; display: flex; align-items: center; gap: 10px; padding: 5px 8px 5px 5px; text-align: left; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.fit .slot img { width: 66px; height: 44px; image-rendering: pixelated; background: #141215; }
.fit .slot .nm { display: grid; gap: 3px; font-size: 11px; }
.fit .slot .nm small { font: 400 12px/1.2 'Pixelify Sans', monospace; text-transform: none; color: #b9b0a0; }
.fit .slot:hover, .fit .slot.on { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.fit .slot.empty { color: var(--red); background: #241314; box-shadow: 0 0 0 2px #000, 0 0 0 4px #7a2a26; min-height: 54px; justify-content: center; font-size: 13px; }
.fit .slot.empty::before { content: ''; width: 12px; height: 14px; background: var(--red); clip-path: polygon(0 0, 100% 50%, 0 100%); }
.fit .slot.empty:hover { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--red); }
.fit.replacing .slot:not(.empty) { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); animation: fitpulse 0.8s steps(2) infinite; }
@keyframes fitpulse { 50% { box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8; } }
.fit .store { display: flex; flex-wrap: wrap; gap: 8px; }
.fit .store .none { font-size: 13px; color: #6d655a; }
.fit .item { position: relative; padding: 0; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.fit .item img { display: block; width: 60px; height: 40px; image-rendering: pixelated; }
.fit .item:hover, .fit .item.on { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.fit .item.new { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--go); }
.fit .item.new::after { content: 'New'; position: absolute; right: -6px; top: -8px; font: 400 10px/1 'Silkscreen', monospace; text-transform: uppercase; padding: 2px 4px; color: #111; background: var(--go); box-shadow: 0 0 0 2px #000; }
.fit .tip { position: fixed; z-index: 3; width: 200px; padding: 7px 9px; font: 400 12px/1.3 'Pixelify Sans', monospace; background: #121014; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; pointer-events: none; }
.fit .tip b { display: block; font: 400 11px/1.2 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); margin-bottom: 3px; }
.fit .msg { display: grid; gap: 8px; padding: 9px 10px 10px; font-size: 13px; background: #1d1b1e; box-shadow: 0 0 0 2px #000; }
.fit .msg .row { display: flex; gap: 8px; flex-wrap: wrap; }
.fit .btn { padding: 8px 14px 9px; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.fit .btn.go { color: #111; background: var(--go); box-shadow: 0 3px 0 #2f6b40, 0 0 0 2px #000; }
.fit .btn:hover { filter: brightness(1.15); }
.fit .pop { position: fixed; z-index: 4; padding: 8px; display: grid; gap: 6px; max-height: 60vh; overflow-y: auto; }
.fit .pop button { display: flex; gap: 8px; align-items: center; padding: 4px 8px 4px 4px; background: #1d1b1e; font-size: 11px; box-shadow: 0 0 0 2px #000; }
.fit .pop button:hover { background: #2a2628; color: var(--amber); }
.fit .pop img { width: 48px; height: 32px; image-rendering: pixelated; }
.fit .pop .remove { justify-content: center; padding: 8px; color: #ff9a8a; }
.fit .pop .none { padding: 6px; font-size: 13px; color: #b9b0a0; }
.fit .bottom { position: absolute; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: grid; gap: 14px; justify-items: center; pointer-events: none; }
.fit .tanks { display: flex; gap: 12px; padding: 8px; pointer-events: auto; }
.fit .tcard { position: relative; display: grid; gap: 4px; justify-items: center; padding: 4px 6px 7px; background: #1d1b1e; font-size: 10px; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.fit .tcard img { width: 96px; height: 56px; image-rendering: pixelated; }
.fit .tcard.sel { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); color: var(--amber); }
.fit .tcard.locked img { filter: brightness(0.25) saturate(0); }
.fit .tcard.locked { color: #6d655a; }
.fit .tcard .lock { position: absolute; left: 6px; right: 6px; top: 20px; font: 400 9px/1.2 'Pixelify Sans', monospace; text-transform: none; color: #b9b0a0; }
.fit .tcard.newtank::after { content: 'New'; position: absolute; right: -6px; top: -8px; font: 400 10px/1 'Silkscreen', monospace; text-transform: uppercase; padding: 2px 4px; color: #111; background: var(--go); box-shadow: 0 0 0 2px #000; }
.fit .btns { display: flex; gap: 12px; pointer-events: auto; }
@media (max-width: 860px) {
  .fit .left { top: calc(12px + env(safe-area-inset-top, 0px)); transform: none; left: 12px; width: min(220px, 44vw); padding: 10px 12px 12px; gap: 7px; }
  .fit .left p, .fit .left .kit { display: none; }
  .fit .right { top: auto; bottom: calc(150px + env(safe-area-inset-bottom, 0px)); transform: none; right: 12px; width: min(300px, 52vw); padding: 10px 12px 12px; gap: 8px; }
  .fit .slot img { width: 48px; height: 32px; }
  .fit .tcard img { width: 72px; height: 42px; }
}
@media (max-width: 560px) {
  .fit .right { left: 12px; right: 12px; width: auto; }
  .fit .left { width: calc(100vw - 24px); }
}
`;

let injected = false;
function inject() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// the stats as bars: armour (hp over damage taken), gun (sustained damage
// per second), speed
function bars(s) {
  const dps = s.mag ? (s.cannonDamage * s.mag) / (s.mag * s.reload + s.magReload) : s.cannonDamage / s.reload;
  return { Armour: clamp01(s.maxHp / s.armor / 160), Gun: clamp01(dps / 44), Speed: clamp01((s.speed - 0.55) / 0.85) };
}

// pictures of the tanks for the carousel, drawn once
const tankPics = new Map();
function tankPicture(renderer, id) {
  if (tankPics.has(id)) return tankPics.get(id);
  const t = TANKS[id].create();
  t.update(0.016, 0, {});
  const url = snapshotCanvas(renderer, t.group, 96, 56).toDataURL();
  tankPics.set(id, url);
  return url;
}

export function createFitting({ renderer, cursor }) {
  inject();
  const root = document.createElement('div');
  root.className = 'fit';
  root.hidden = true;
  root.style.setProperty('--cursor', cursor);
  root.innerHTML = `
    <svg></svg>
    <div class="left pnl"><span class="tag px"></span><h2></h2><p></p><div class="bars"></div><div class="kit"></div></div>
    <div class="right pnl"><span class="label slotlabel"></span><div class="slots"></div><span class="label">Storage</span><div class="store"></div><div class="msg" hidden></div></div>
    <div class="bottom"><div class="tanks pnl" hidden></div><div class="btns"></div></div>
    <div class="tip" hidden><b></b><span></span></div>`;
  const $ = (s) => root.querySelector(s);
  const svg = $('svg');
  const tip = $('.tip');
  const pic = (id) => partPicture(renderer, id);
  let o = null; // the options of the open screen
  let replacing = null; // a part from storage waiting for a slot to replace
  let pop = null;
  let slotEls = []; // { id, el }
  for (const ev of ['pointerdown', 'pointerup', 'click', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation());

  function closePop() {
    pop?.remove();
    pop = null;
    for (const s of slotEls) s.el.classList.remove('on');
  }
  document.addEventListener('pointerdown', (e) => {
    if (pop && !pop.contains(e.target)) closePop();
  });
  function showTip(el, id) {
    const r = el.getBoundingClientRect();
    tip.hidden = false;
    tip.querySelector('b').textContent = PARTS[id].name;
    tip.querySelector('span').textContent = PARTS[id].text;
    tip.style.left = `${Math.round(Math.min(window.innerWidth - 220, Math.max(8, r.left + r.width / 2 - 100)))}px`;
    tip.style.top = `${Math.round(r.top - 12)}px`;
    tip.style.transform = 'translateY(-100%)';
  }
  const hideTip = () => (tip.hidden = true);

  const loadout = () => o.loadout.filter((id) => PARTS[id]);
  const spare = () => o.owned.filter((id) => PARTS[id] && !o.loadout.includes(id));
  function set(list, added = null) {
    closePop();
    hideTip();
    replacing = null;
    o.onSet(list, added);
  }
  // put a part from storage on: into a free slot, or ask which to replace
  function equip(id) {
    const list = loadout();
    if (list.length < tankDef(o.tankId).slots) return set([...list, id], id);
    replacing = id;
    render();
  }

  function render() {
    if (!o) return;
    const def = tankDef(o.tankId);
    const list = loadout();
    root.classList.toggle('replacing', !!replacing);
    $('.left .tag').textContent = o.tag || '';
    $('.left h2').textContent = def.name;
    $('.left p').textContent = def.blurb;
    renderBars();
    $('.kit').innerHTML = `
      <div><span>Gun</span><span>${def.gun === 'autocannon' ? 'Autocannon' : 'Cannon'}</span></div>
      <div><span><kbd>Shift</kbd></span><span>${def.moveName}</span></div>
      <div><span><kbd>E</kbd></span><span class="${def.ability ? '' : 'none'}">${def.abilityName || 'None yet'}</span></div>`;
    $('.slotlabel').textContent = `Parts ${list.length}/${def.slots}`;
    // the slots: fitted parts, then the empty ones
    const slots = $('.slots');
    slots.innerHTML = '';
    slotEls = [];
    for (let i = 0; i < def.slots; i++) {
      const id = list[i] || null;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `slot${id ? '' : ' empty'}`;
      if (id) {
        el.innerHTML = `<img alt="" src="${pic(id)}"><span class="nm"><span></span><small></small></span>`;
        el.querySelector('.nm span').textContent = PARTS[id].name;
        el.querySelector('small').textContent = PARTS[id].text;
      } else el.innerHTML = '<span>Empty</span>';
      el.addEventListener('click', () => {
        if (replacing && id) return set(list.map((x) => (x === id ? replacing : x)), replacing);
        if (replacing) return set([...list, replacing], replacing);
        openPop(id, el);
      });
      slots.append(el);
      slotEls.push({ id, el });
    }
    // storage
    const store = $('.store');
    store.innerHTML = '';
    const sp = spare();
    if (!sp.length) store.innerHTML = `<span class="none">${o.owned.length ? 'Everything you have is fitted.' : 'Empty. Parts you find at checkpoints go here.'}</span>`;
    for (const id of sp) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `item${id === o.highlight ? ' new' : ''}${id === replacing ? ' on' : ''}`;
      el.innerHTML = `<img alt="${PARTS[id].name}" src="${pic(id)}">`;
      el.addEventListener('click', () => equip(id));
      el.addEventListener('pointerenter', () => (showTip(el, id), renderBars(id)));
      el.addEventListener('pointerleave', () => (hideTip(), renderBars()));
      store.append(el);
    }
    // the message box: a fresh find, or which slot to replace
    const msg = $('.msg');
    msg.hidden = true;
    if (replacing) {
      msg.hidden = false;
      msg.innerHTML = `<span>Slots full. Choose a part to replace with <b></b>.</span><div class="row"><button type="button" class="btn cancel">Cancel</button></div>`;
      msg.querySelector('b').textContent = PARTS[replacing].name;
      msg.querySelector('.cancel').addEventListener('click', () => {
        replacing = null;
        render();
      });
    } else if (o.highlight && sp.includes(o.highlight)) {
      msg.hidden = false;
      msg.innerHTML = `<span>Found: <b></b>. It's in storage.</span><div class="row"><button type="button" class="btn go equip">Equip now</button></div>`;
      msg.querySelector('b').textContent = PARTS[o.highlight].name;
      msg.querySelector('.equip').addEventListener('click', () => equip(o.highlight));
    }
    // the tanks (hangar only)
    const tanks = $('.tanks');
    tanks.hidden = !o.tanks;
    tanks.innerHTML = '';
    for (const id of o.tanks ? TANK_ORDER : []) {
      const have = o.tanks.includes(id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `tcard${id === o.tankId ? ' sel' : ''}${have ? '' : ' locked'}${o.newTanks?.includes(id) ? ' newtank' : ''}`;
      el.innerHTML = `<img alt="" src="${tankPicture(renderer, id)}"><span></span>${have ? '' : '<span class="lock"></span>'}`;
      el.querySelector('span').textContent = TANKS[id].name;
      if (!have) el.querySelector('.lock').textContent = TANKS[id].unlockText || 'Locked';
      if (have && id !== o.tankId) el.addEventListener('click', () => (closePop(), (replacing = null), o.onTank(id)));
      tanks.append(el);
    }
    // buttons
    const btns = $('.btns');
    btns.innerHTML = '';
    for (const [label, fn, primary] of o.buttons || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${primary ? ' go' : ''}`;
      b.textContent = label;
      b.addEventListener('click', () => {
        if (replacing) return;
        fn();
      });
      btns.append(b);
    }
  }

  // the bars, and with a part hovered in storage, what it would change
  function renderBars(preview = null) {
    const list = loadout();
    const now = bars(statsFor(list, o.tankId));
    let pre = null;
    if (preview) {
      const full = list.length >= tankDef(o.tankId).slots;
      if (!full) pre = bars(statsFor([...list, preview], o.tankId));
    }
    $('.bars').innerHTML = Object.entries(now)
      .map(([k, v]) => {
        const p = pre ? pre[k] : v;
        const lo = Math.min(v, p);
        const hi = Math.max(v, p);
        return `<span>${k}</span><span class="bar"><i style="width:${lo * 100}%"></i>${hi > lo + 0.001 ? `<i class="pre${p < v ? ' down' : ''}" style="left:${lo * 100}%;width:${(hi - lo) * 100}%"></i>` : ''}</span>`;
      })
      .join('');
  }

  function openPop(id, el) {
    closePop();
    const list = loadout();
    pop = document.createElement('div');
    pop.className = 'pop pnl';
    for (const s of spare()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<img alt="" src="${pic(s)}"><span></span>`;
      b.querySelector('span').textContent = PARTS[s].name;
      b.addEventListener('click', () => set(id ? list.map((x) => (x === id ? s : x)) : [...list, s], s));
      pop.append(b);
    }
    if (id) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'remove';
      b.textContent = 'Remove';
      b.addEventListener('click', () => set(list.filter((x) => x !== id)));
      pop.append(b);
    }
    if (!pop.children.length) pop.innerHTML = '<span class="none">Nothing in storage to fit.</span>';
    root.append(pop);
    const r = el.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, window.innerWidth - pr.width - 8)))}px`;
    pop.style.top = `${Math.round(Math.min(r.bottom + 10, window.innerHeight - pr.height - 8))}px`;
    el.classList.add('on');
  }

  return {
    el: root,
    get isOpen() {
      return !root.hidden;
    },
    // opts: { tag, tankId, loadout, owned, highlight, onSet(list, added),
    //   buttons: [[label, fn, primary]], tanks (unlocked ids: shows the
    //   carousel), newTanks, onTank(id), anchor(id) -> [x, y] | null }
    show(opts) {
      const fresh = root.hidden || opts.tankId !== o?.tankId;
      o = opts;
      if (fresh) replacing = null;
      root.hidden = false;
      render();
    },
    hide() {
      closePop();
      hideTip();
      replacing = null;
      root.hidden = true;
      o = null;
      svg.innerHTML = '';
    },
    // per frame: lines from the fitted parts' slots to where they sit on the
    // tank (when the host can say where that is on screen)
    layout() {
      if (root.hidden || !o?.anchor) return void (svg.innerHTML = '');
      let lines = '';
      for (const { id, el } of slotEls) {
        if (!id) continue;
        const at = o.anchor(id);
        if (!at) continue;
        const r = el.getBoundingClientRect();
        const ex = at[0] < r.left ? r.left - 4 : r.right + 4;
        const y = r.top + r.height / 2;
        const pts = `${ex},${y} ${(ex + at[0]) / 2},${y} ${at[0]},${at[1]}`;
        lines += `<polyline points="${pts}" fill="none" stroke="#000" stroke-width="5"/><polyline points="${pts}" fill="none" stroke="#ffb347" stroke-width="2"/><rect x="${at[0] - 4}" y="${at[1] - 4}" width="8" height="8" fill="#ffb347" stroke="#000" stroke-width="2"/>`;
      }
      svg.innerHTML = lines;
    },
  };
}

// where a part sits on a tank, as a world point (for the fitting lines)
export function anchorWorld(tank, tankId, id) {
  const a = tankDef(tankId).anchors?.[id];
  if (!a) return null;
  tank.group.updateMatrixWorld(true);
  return tank.group.localToWorld(new THREE.Vector3(...a));
}
