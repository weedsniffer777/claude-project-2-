// The fitting screen, shared by the hangar and the checkpoints: the tank's
// stats as bars on the left (with its gun and abilities), its part slots
// and the storage of spare parts on the right, buttons (and in the hangar a
// carousel of tanks) along the bottom.
//
// Click a fitted part to see what it does (and remove it); click an EMPTY
// slot or a part in storage to fit one. With every slot full, a part from
// storage asks which one to replace (or Cancel). A part just found at a
// checkpoint is shown as New with an "Equip now" button. Upgrades have a
// screen of their own (workshop.js), opened from the hangar.
import * as THREE from 'three';
import { PARTS, PART_TYPES, statsFor, TIERS, tierOf, levelOf, partEffects, partPerk, effectsHtml, EFFECT_CSS } from '../game/parts.js';
import { TANKS, TANK_ORDER, tankDef } from '../game/tanks.js';
import { partPicture } from '../render/partPictures.js';
import { EQUIPMENT, equipmentIcon, equipmentPlain } from '../game/equipment.js';
// a part's improvement stars (found again at a checkpoint), by its icon
const starBadge = (id) => {
  const n = save.stars(id);
  return n ? `<span class="stb">★${n > 1 ? n : ''}</span>` : '';
};
import { save } from '../game/save.js';
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
.fit .bar i.up { background: var(--go); }
.fit .bar i.cost { background: #ff7a6a; opacity: 0.8; }
.fit .bar i.pre { background: #f1e9d8; opacity: 0.55; }
.fit .bar i.pre.down { background: var(--red); }
.fit .kit { display: grid; gap: 5px; font-size: 13px; }
.fit .kit div { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; background: #1d1b1e; box-shadow: 0 0 0 2px #000; }
.fit .kit kbd, .fit .equip kbd { font: 400 10px/1 'Silkscreen', monospace; padding: 3px 5px; background: #f1e9d8; color: #111; }
.fit .kit span:last-child { color: var(--amber); text-align: right; }
.fit .kit .none { color: #6d655a !important; }
.fit .equip { display: grid; gap: 6px; }
.fit .equip .slotbox { margin-top: 6px; }
.fit .equip .box { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 7px 8px; text-align: left; font-size: 13px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.fit .equip button.box:hover { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.fit .equip .box .none { color: #6d655a; }
.fit .equip .box .eqi { width: 48px; height: 36px; image-rendering: pixelated; }
.fit .equip .box:has(.eqi) { justify-content: flex-start; box-shadow: 0 0 0 2px #000, 0 0 0 4px #5fe6ff; }
.fit .equip .lock { font-size: 11px; color: #8f877a; }
.fit .right { position: absolute; right: calc(20px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); width: 300px; padding: 14px 16px 16px; display: grid; gap: 10px; }
.fit .label { font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; letter-spacing: 0.06em; }
.fit .slots { display: grid; gap: 8px; }
.fit .slot { position: relative; display: flex; align-items: center; gap: 10px; padding: 5px 8px 5px 5px; text-align: left; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.fit .slot img { width: 66px; height: 44px; image-rendering: pixelated; background: #141215; }
.fit .slot .nm { display: grid; gap: 3px; font-size: 11px; }
.fit .slot .nm small { font: 400 12px/1.2 'Pixelify Sans', monospace; text-transform: none; color: #b9b0a0; }
.fit .slot:hover, .fit .slot.on { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.fit .slot[data-tier] { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--tc); }
.fit .slot[data-tier]:hover, .fit .slot[data-tier].on { box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8; }
.fit .item[data-tier] { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--tc); }
.fit .slot .tiername, .fit .tip .tiername { font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.06em; color: var(--tc); }
.fit .item .away { z-index: 2; position: absolute; left: -4px; right: -4px; bottom: -8px; font: 400 8px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: #b9b0a0; box-shadow: 0 0 0 2px #000; padding: 1px 2px; }
.fit .item.isaway img { filter: brightness(0.55) saturate(0.6); }
.fit .item .away.only { color: #fff; background: #c42a20; }
.fit .item.notfor { cursor: var(--cursor); box-shadow: 0 0 0 2px #000, 0 0 0 4px #4a4446 !important; }
.fit .item.notfor img { filter: grayscale(1) brightness(0.45); }
.fit .pop .eqon { margin-left: auto; font: 400 8px/1 'Silkscreen', monospace; padding: 2px 3px; color: #111; background: #b9b0a0; }
.fit .slot .fx { display: flex; flex-wrap: wrap; gap: 2px 8px; font: 400 10px/1.2 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; }
.fit .slot .fx b { font-weight: 400; }
.fit .slot .fx b.good { color: var(--go); }
.fit .slot .fx b.bad { color: #ff7a6a; }
.fit .slot .fx .pk { color: #ffc24a; }
.fit .info { display: grid; gap: 5px; width: 230px; padding: 4px 4px 2px; }
.fit .info .hd { display: flex; gap: 8px; align-items: center; }
.fit .info .hd img { width: 72px; height: 48px; image-rendering: pixelated; background: #141215; box-shadow: 0 0 0 2px #000, 0 0 0 3px var(--tc); }
.fit .info .hd b { display: grid; gap: 3px; font: 400 12px/1.1 'Silkscreen', monospace; text-transform: uppercase; font-weight: 400; }
.fit .info .tiername { font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--tc); }
.fit .info p { margin: 0; font: 400 12px/1.25 'Pixelify Sans', monospace; color: #b9b0a0; text-transform: none; }
.fit .info .where { font: 400 11px/1.2 'Pixelify Sans', monospace; color: #8f877a; }
.fit .upbtn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 9px 12px 10px; font-size: 12px; color: #111; background: #ffc24a; box-shadow: 0 3px 0 #8a5a1c, 0 0 0 2px #000; }
.fit .upbtn:hover { filter: brightness(1.12); }
.fit .upbtn.hint { animation: fitglow 0.9s steps(2) infinite; }
.fit .upbtn.evolve { background: #c77dff; box-shadow: 0 3px 0 #6a2fa0, 0 0 0 2px #000; animation: fitbounce 0.8s ease-in-out infinite; }
@keyframes fitbounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); box-shadow: 0 8px 0 #6a2fa0, 0 0 0 2px #000, 0 0 16px #c77dffaa; } }
.fit .upbtn .evtag { padding: 2px 5px; font-size: 9px; color: #fff; background: #6a2fa0; box-shadow: 0 0 0 2px #000; }
.fit .stb { position: absolute; left: -6px; bottom: -6px; z-index: 2; padding: 2px 3px; font: 400 9px/1 'Silkscreen', monospace; color: #111; background: #ffc24a; box-shadow: 0 0 0 2px #000; pointer-events: none; white-space: nowrap; }
.fit .hd .stb { position: static; display: inline-block; margin-left: 6px; }
.fit .item .evb, .fit .slot .evb { position: absolute; right: -6px; top: -8px; padding: 2px 4px; font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: #fff; background: #8a45d0; box-shadow: 0 0 0 2px #000; animation: fitbounce 0.8s ease-in-out infinite; pointer-events: none; }
.fit .btn.tankup { color: #111; background: #ffb347; box-shadow: 0 3px 0 #8a5a1c, 0 0 0 2px #000; }
.fit .btn.tankup small { font-size: 10px; margin-left: 4px; }
.fit .upbtn .dot { padding: 2px 5px; font-size: 9px; color: #111; background: var(--go); box-shadow: 0 0 0 2px #000; }
@keyframes fitglow { 50% { box-shadow: 0 3px 0 #8a5a1c, 0 0 0 2px #000, 0 0 0 5px #ffe2a0, 0 0 18px #ffc24a; } }
.fit .slot.empty { color: var(--red); background: #241314; box-shadow: 0 0 0 2px #000, 0 0 0 4px #7a2a26; min-height: 54px; justify-content: center; font-size: 13px; }
.fit .slot.empty::before { content: ''; width: 12px; height: 14px; background: var(--red); clip-path: polygon(0 0, 100% 50%, 0 100%); }
.fit .slot.empty:hover { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--red); }
.fit .slothead { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 22px; }
.fit .slotlabel.full { color: var(--red); }
.fit .slothead .cancel { padding: 5px 9px 6px; font-size: 10px; background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 3px #6d655a; }
.fit.replacing .slot:not(.empty) { background: #2a1416; box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--red); animation: fitpulse 0.7s steps(2) infinite; }
.fit.replacing .slot:not(.empty):hover { background: #3a1a1a; box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffb0a8; animation: none; }
@keyframes fitpulse { 50% { box-shadow: 0 0 0 2px #000, 0 0 0 4px #7a2a26; } }
.fit .store { display: flex; flex-wrap: wrap; gap: 8px; }
.fit .storehead { display: flex; align-items: center; gap: 6px; }
.fit .storehead .label { margin-right: auto; }
.fit .storehead .dd { position: relative; }
.fit .storehead .ddbtn { position: relative; display: flex; align-items: center; gap: 6px; height: 22px; padding: 0 7px; font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: #f1e9d8; background: #1d1b1e; border: 0; box-shadow: 0 0 0 2px #000, 0 0 0 3px #6d655a; cursor: var(--cursor); pointer-events: auto; }
.fit .storehead .ddbtn:hover, .fit .storehead .ddbtn.on { box-shadow: 0 0 0 2px #000, 0 0 0 3px var(--amber, #ffb347); }
.fit .storehead .chev { width: 7px; height: 4px; background: currentColor; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.fit .storehead .filterby { width: 22px; padding: 0; justify-content: center; }
.fit .storehead .funnel { width: 12px; height: 11px; background: #f1e9d8; clip-path: polygon(0 0, 100% 0, 62% 48%, 62% 100%, 38% 85%, 38% 48%); }
.fit .storehead .fdot { position: absolute; right: -4px; top: -4px; width: 7px; height: 7px; background: var(--amber, #ffb347); box-shadow: 0 0 0 2px #000; }
.fit .ddmenu { position: absolute; right: 0; top: calc(100% + 8px); z-index: 20; display: grid; gap: 2px; min-width: 120px; padding: 6px; background: #121014; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a, 0 6px 0 4px #0008; pointer-events: auto; }
.fit .ddmenu button { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 0; background: none; font: 400 10px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; text-align: left; white-space: nowrap; cursor: var(--cursor); }
.fit .ddmenu button:hover { color: #f1e9d8; background: #2a2420; }
.fit .ddmenu button.sel { color: var(--amber, #ffb347); }
.fit .ddmenu .tick { width: 10px; height: 10px; flex: none; box-shadow: inset 0 0 0 2px #6d655a; }
.fit .ddmenu button.sel .tick { background: var(--amber, #ffb347); box-shadow: inset 0 0 0 2px #000; }
.fit .ddmenu.cols { grid-template-columns: auto auto; gap: 4px 14px; padding: 8px 8px 6px; }
.fit .ddmenu .col { display: grid; gap: 2px; align-content: start; }
.fit .ddmenu .col > span { padding: 0 8px 4px; font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: #6d655a; }
.fit .ddmenu .reset { grid-column: 1 / -1; justify-content: center; margin-top: 4px; color: #f1e9d8; box-shadow: 0 0 0 2px #4a4446; }
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
.fit .pop .upb { justify-content: center; padding: 8px; color: #111; background: #ffc24a; box-shadow: 0 0 0 2px #000; }
.fit .pop .upb:hover { color: #111; background: #ffd77a; }
.fit .pop .fitb { justify-content: center; padding: 8px; color: #111; background: var(--go); }
.fit .pop .fitb:hover { color: #111; background: #b6ffc4; }
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
  style.textContent = CSS + EFFECT_CSS;
  document.head.append(style);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// the stats as bars: armour (hp over damage taken), gun (sustained damage
// per second), speed
function bars(s) {
  const dps = s.mag ? (s.cannonDamage * s.mag) / (s.mag * s.reload + s.magReload) : s.cannonDamage / s.reload;
  // (room at the top for tank levels and maxed parts)
  return { Armour: clamp01(s.maxHp / s.armor / 320), Gun: clamp01(dps / 100), Speed: clamp01((s.speed - 0.55) / 1.2) };
}

// pictures of the tanks for the carousel, drawn once
// (front three-quarters, framed on the hull so it's centred and big)
const tankPics = new Map();
export function tankPicture(renderer, id, W = 96, H = 56) {
  const key = `${id}|${W}|${H}`;
  if (tankPics.has(key)) return tankPics.get(key);
  const t = TANKS[id].create();
  t.update(0.016, 0, {});
  const p = tankDef(id).pic;
  const view = { target: new THREE.Vector3(...p.target), dir: new THREE.Vector3(0.95, 0.8, 1), half: p.half };
  const url = snapshotCanvas(renderer, t.group, W, H, null, view).toDataURL();
  tankPics.set(key, url);
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
    <div class="left pnl"><span class="tag px"></span><h2></h2><p></p><div class="bars"></div><div class="kit"></div><div class="equip"><span class="label">Equipment <kbd>Q</kbd></span><div class="slotbox"></div><span class="lock" hidden>Cannot change in battle.</span></div></div>
    <div class="right pnl"><div class="slothead"><span class="label slotlabel"></span><button type="button" class="cancel" hidden>Cancel</button></div><div class="slots"></div><div class="storehead"><span class="label">Storage</span><div class="dd sortdd"><button type="button" class="ddbtn sortby"><span></span><i class="chev"></i></button></div><div class="dd filterdd"><button type="button" class="ddbtn filterby" title="Filter"><i class="funnel"></i><b class="fdot" hidden></b></button></div></div><div class="store"></div><div class="msg" hidden></div><button type="button" class="upbtn" hidden>Upgrade parts</button></div>
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

  // the slot or stored part a popup belongs to; clicking it again closes it
  let popOwner = null;
  const view = { sort: 'rarity', tanks: null, types: null }; // the storage's sort, and the filter's checked tanks and types (null: all)
  let justClosed = null;
  function closePop() {
    pop?.remove();
    pop = null;
    popOwner?.classList.remove('on');
    popOwner = null;
    for (const s of slotEls) s.el.classList.remove('on');
  }
  // (call at the top of an opener: true if this click should only close:
  // its own popup was open, or was just closed by this same click)
  function toggledOff(el) {
    const was = justClosed === el || (pop && popOwner === el);
    justClosed = null;
    if (was) closePop();
    return was;
  }
  document.addEventListener('pointerdown', (e) => {
    if (pop && !pop.contains(e.target)) {
      // a click on the popup's own slot or part closes it (and stays closed)
      const owner = popOwner;
      closePop();
      justClosed = owner && owner.contains(e.target) ? owner : null;
    }
  }, true); // (capture: the screen's own panels stop clicks bubbling, and a click on any of them closes it too)
  // The storage's controls: a sort menu, and a filter button opening a
  // checklist (tanks one column, part kinds the other). Our own menus,
  // closed by a click anywhere else.
  const SORTS = [['rarity', 'By rarity'], ['name', 'By name'], ['type', 'By type']];
  let menu = null;
  function closeMenu() {
    menu?.remove();
    menu = null;
    for (const b of root.querySelectorAll('.storehead .ddbtn')) b.classList.remove('on');
  }
  document.addEventListener('pointerdown', (e) => menu && !menu.contains(e.target) && !e.target.closest?.('.storehead .ddbtn') && closeMenu(), true);
  function storeControls() {
    const sortBtn = $('.storehead .sortby');
    const filterBtn = $('.storehead .filterby');
    sortBtn.querySelector('span').textContent = SORTS.find(([k]) => k === view.sort)[1];
    const filtered = (view.tanks && view.tanks.length < TANK_ORDER.length) || (view.types && view.types.length < Object.keys(PART_TYPES).length);
    filterBtn.querySelector('.fdot').hidden = !filtered;
    sortBtn.onclick = () => {
      const was = sortBtn.classList.contains('on');
      closeMenu();
      if (was) return;
      sortBtn.classList.add('on');
      menu = document.createElement('div');
      menu.className = 'ddmenu';
      for (const [k, label] of SORTS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = view.sort === k ? 'sel' : '';
        b.innerHTML = `<i class="tick"></i>${label}`;
        b.onclick = () => {
          view.sort = k;
          closeMenu();
          render();
        };
        menu.append(b);
      }
      sortBtn.parentElement.append(menu);
    };
    filterBtn.onclick = () => {
      const was = filterBtn.classList.contains('on');
      closeMenu();
      if (was) return;
      filterBtn.classList.add('on');
      menu = document.createElement('div');
      menu.className = 'ddmenu cols';
      const fill = () => {
        menu.innerHTML = '';
        const col = (title, all, key, label) => {
          const c = document.createElement('div');
          c.className = 'col';
          c.innerHTML = `<span>${title}</span>`;
          const on = view[key] || all;
          for (const k of all) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = on.includes(k) ? 'sel' : '';
            b.innerHTML = `<i class="tick"></i>${label(k)}`;
            b.onclick = () => {
              const now = on.includes(k) ? on.filter((x) => x !== k) : [...on, k];
              view[key] = now.length === all.length ? null : now;
              fill();
              render();
            };
            c.append(b);
          }
          menu.append(c);
        };
        col('Tanks', TANK_ORDER, 'tanks', (t) => TANKS[t].name.replace(' tank', ''));
        col('Kind', Object.keys(PART_TYPES), 'types', (k) => PART_TYPES[k]);
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'reset';
        reset.textContent = 'Show all';
        reset.onclick = () => {
          view.tanks = view.types = null;
          fill();
          render();
        };
        menu.append(reset);
      };
      fill();
      filterBtn.parentElement.append(menu);
    };
  }
  function showTip(el, id) {
    const r = el.getBoundingClientRect();
    tip.hidden = false;
    const tier = tierOf(id);
    tip.style.setProperty('--tc', TIERS[tier].color);
    tip.querySelector('b').innerHTML = `${PARTS[id].name} <span class="tiername">${TIERS[tier].name} · Lv ${levelOf(id)}</span>`;
    // what it does at its tier, in numbers
    tip.querySelector('span').innerHTML = `${effectsHtml(id, o.tankId)}${where(id) ? `<br>On the ${where(id)}.` : ''}`;
    tip.style.left = `${Math.round(Math.min(window.innerWidth - 220, Math.max(8, r.left + r.width / 2 - 100)))}px`;
    tip.style.top = `${Math.round(r.top - 12)}px`;
    tip.style.transform = 'translateY(-100%)';
  }
  const hideTip = () => (tip.hidden = true);

  const loadout = () => o.loadout.filter((id) => PARTS[id]);
  const spare = () => o.owned.filter((id) => PARTS[id] && !o.loadout.includes(id));
  // a part is one thing: fitted to one tank at a time. Which other tank has
  // it (if any)?
  function where(id) {
    if (o.loadout.includes(id)) return null;
    const other = TANK_ORDER.find((t) => t !== o.tankId && save.loadout(t).includes(id));
    return other ? TANKS[other].name : null;
  }
  function set(list, added = null) {
    closePop();
    hideTip();
    replacing = null;
    // fitting it here takes it off any other tank
    if (added) for (const t of TANK_ORDER) if (t !== o.tankId && save.loadout(t).includes(added)) save.setLoadout(save.loadout(t).filter((x) => x !== added), t);
    o.onSet(list, added);
  }
  // put a part from storage on: into a free slot, or ask which to replace
  function equip(id) {
    if (PARTS[id].only && PARTS[id].only !== o.tankId) return; // (another tank's own part)
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
    $('.left .tag').textContent = `${o.tag || ''} · Lv ${save.tankLevel(o.tankId)}`;
    $('.left h2').textContent = def.name;
    $('.left p').textContent = def.blurb;
    renderBars();
    $('.kit').innerHTML = `
      <div><span>Gun</span><span>${def.gun === 'autocannon' ? 'Autocannon' : 'Cannon'}</span></div>
      <div><span><kbd>Shift</kbd></span><span>${def.moveName}</span></div>
      <div><span><kbd>E</kbd></span><span class="${def.ability ? '' : 'none'}">${def.abilityName || 'None yet'}</span></div>`;
    // the equipment slot (an active item on Q): swapped in the hangar only
    renderEquipment();
    // all slots taken: the count goes red; picking a part from storage then
    // asks (in red, on the slots themselves) which one it replaces
    const full = list.length >= def.slots;
    const label = $('.slotlabel');
    label.textContent = replacing ? 'Slots full: click one to replace' : `Parts ${list.length}/${def.slots}${full ? ' · Full' : ''}`;
    label.classList.toggle('full', full);
    const cancel = $('.slothead .cancel');
    cancel.hidden = !replacing;
    cancel.onclick = () => {
      replacing = null;
      render();
    };
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
        const tier = tierOf(id);
        el.dataset.tier = tier;
        el.style.setProperty('--tc', TIERS[tier].color);
        el.innerHTML = `<img alt="" src="${pic(id)}">${starBadge(id)}<span class="nm"><span class="tiername">${TIERS[tier].name} · Lv ${levelOf(id)}</span><span class="pn"></span><span class="fx">${shortFx(id, tier)}</span></span>`;
        el.querySelector('.nm .pn').textContent = PARTS[id].name;
        if (o.canEvolve?.(id)) el.insertAdjacentHTML('beforeend', '<span class="evb">Evolve</span>');
        el.addEventListener('pointerenter', () => !replacing && showTip(el, id));
        el.addEventListener('pointerleave', hideTip);
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
    // sort and filter (they stay as set while the screen's in use)
    storeControls();
    const typeOrder = Object.keys(PART_TYPES);
    const tanksOn = view.tanks || TANK_ORDER;
    const typesOn = view.types || typeOrder;
    const sp = spare()
      .filter((id) => {
        const p = PARTS[id];
        // usable by one of the checked tanks, and one of the checked kinds
        if (p.only ? !tanksOn.includes(p.only) : !tanksOn.length) return false;
        return !p.type || typesOn.includes(p.type);
      })
      .sort((a, b) => {
        // what this tank can't take, or another tank has on, goes to the back
        const back = (id) => ((PARTS[id].only && PARTS[id].only !== o.tankId) || where(id) ? 1 : 0);
        if (back(a) !== back(b)) return back(a) - back(b);
        if (view.sort === 'name') return PARTS[a].name.localeCompare(PARTS[b].name);
        if (view.sort === 'type') return typeOrder.indexOf(PARTS[a].type) - typeOrder.indexOf(PARTS[b].type) || PARTS[a].name.localeCompare(PARTS[b].name);
        return levelOf(b) - levelOf(a) || PARTS[a].name.localeCompare(PARTS[b].name);
      });
    if (!sp.length && spare().length) store.innerHTML = '<span class="none">Nothing matches the filter.</span>';
    else if (!sp.length) store.innerHTML = `<span class="none">${o.owned.length ? 'Everything you have is fitted.' : 'Empty. Parts you find at checkpoints go here.'}</span>`;
    for (const id of sp) {
      const el = document.createElement('button');
      el.type = 'button';
      const away = where(id);
      el.className = `item${id === o.highlight ? ' new' : ''}${id === replacing ? ' on' : ''}${away ? ' isaway' : ''}`;
      el.dataset.tier = tierOf(id);
      el.style.setProperty('--tc', TIERS[tierOf(id)].color);
      const only = PARTS[id].only && PARTS[id].only !== o.tankId ? TANKS[PARTS[id].only].name.replace(' tank', '') : null;
      if (only) el.classList.add('isaway');
      if (only) el.classList.add('notfor');
      el.innerHTML = `<img alt="${PARTS[id].name}" src="${pic(id)}">${starBadge(id)}${away ? `<span class="away">On ${away.replace(' tank', '')}</span>` : only ? `<span class="away only">${only} only</span>` : ''}`;
      if (o.canEvolve?.(id)) el.insertAdjacentHTML('beforeend', '<span class="evb">Evolve</span>');
      // in the hangar: fit it or upgrade it; at a checkpoint: fit it
      el.addEventListener('click', () => {
        if (only) return; // another tank's own part: nothing to do with it here
        if (o.tanks) openItemPop(id, el);
        else equip(id);
      });
      el.addEventListener('pointerenter', () => (showTip(el, id), renderBars(only ? null : id)));
      el.addEventListener('pointerleave', () => (hideTip(), renderBars()));
      store.append(el);
    }
    // the hangar's way into the upgrades screen; it glows the first time
    // there's an upgrade you can afford
    const upb = $('.upbtn');
    upb.hidden = !o.onUpgrades;
    if (o.onUpgrades) {
      // a part ready to evolve: the button bounces with a violet tag
      const ev = o.evolveReady?.() || [];
      upb.classList.toggle('hint', !!o.upgradeHint && !ev.length);
      upb.classList.toggle('evolve', ev.length > 0);
      upb.innerHTML = `Upgrade parts${ev.length ? '<span class="evtag">Can evolve!</span>' : o.upgradeHint ? '<span class="dot">New</span>' : ''}`;
      upb.onclick = () => (closePop(), o.onUpgrades(ev[0] || null));
    }
    // the message box: a fresh find, or which slot to replace
    const msg = $('.msg');
    msg.hidden = true;
    if (!replacing && o.highlight && sp.includes(o.highlight)) {
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
    // under the tank (hangar): level it up
    if (o.onUpgradeTank) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn tankup';
      b.innerHTML = `Upgrade tank <small>Lv ${save.tankLevel(o.tankId)}</small>`;
      b.addEventListener('click', () => !replacing && (closePop(), o.onUpgradeTank()));
      btns.append(b);
    }
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

  function renderEquipment() {
    const hangar = !!o.tanks;
    const id = save.equipment(o.tankId);
    const item = id && EQUIPMENT[id];
    const owned = save.ownedEquipment().filter((e) => EQUIPMENT[e]);
    const box = document.createElement(hangar ? 'button' : 'div');
    if (hangar) box.type = 'button';
    box.className = 'box';
    box.innerHTML = item ? `<img class="eqi" alt="" src="${equipmentIcon(id, 48, 36)}"><span></span>` : `<span class="none">${owned.length ? 'Empty' : 'None yet. Found in later levels.'}</span>`;
    if (item) {
      box.querySelector('span').textContent = item.name;
      box.title = equipmentPlain(id);
    }
    const slot = $('.equip .slotbox');
    slot.innerHTML = '';
    slot.append(box);
    $('.equip .lock').hidden = hangar || !owned.length;
    if (!hangar || !owned.length) return;
    box.addEventListener('click', () => {
      closePop();
      pop = document.createElement('div');
      pop.className = 'pop pnl';
      for (const e of owned) {
        const b = document.createElement('button');
        b.type = 'button';
        // one of each: fitting it here takes it off any other tank
        const on = TANK_ORDER.find((t) => t !== o.tankId && save.equipment(t) === e);
        b.innerHTML = `<img alt="" src="${equipmentIcon(e, 48, 36)}"><span></span>${on ? `<small class="eqon">On ${TANKS[on].name.replace(' tank', '')}</small>` : ''}`;
        b.querySelector('span').textContent = on ? `${EQUIPMENT[e].name} · move here` : EQUIPMENT[e].name;
        b.addEventListener('click', () => {
          for (const t of TANK_ORDER) if (t !== o.tankId && save.equipment(t) === e) save.setEquipment(null, t);
          save.setEquipment(e, o.tankId);
          closePop();
          render();
        });
        pop.append(b);
      }
      if (item) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'remove';
        b.textContent = 'Remove';
        b.addEventListener('click', () => (save.setEquipment(null, o.tankId), closePop(), render()));
        pop.append(b);
      }
      root.append(pop);
      const r = box.getBoundingClientRect();
      pop.style.left = `${Math.round(r.left)}px`;
      pop.style.top = `${Math.round(r.bottom + 22)}px`;
    });
  }

  // the bars: amber for the tank itself (at its level), green for what its
  // parts add (red where they cost), and with a part hovered in storage,
  // white for what that would change
  function renderBars(preview = null) {
    const list = loadout();
    const base = bars(statsFor([], o.tankId));
    const now = bars(statsFor(list, o.tankId));
    let pre = null;
    if (preview) {
      const full = list.length >= tankDef(o.tankId).slots;
      if (!full) pre = bars(statsFor([...list, preview], o.tankId));
    }
    $('.bars').innerHTML = Object.entries(now)
      .map(([k, v]) => {
        const b = base[k];
        const lo0 = Math.min(b, v);
        const parts = Math.abs(v - b) > 0.001 ? `<i class="${v > b ? 'up' : 'cost'}" style="left:${lo0 * 100}%;width:${Math.abs(v - b) * 100}%"></i>` : '';
        const p = pre ? pre[k] : v;
        const lo = Math.min(v, p);
        const hi = Math.max(v, p);
        return `<span>${k}</span><span class="bar"><i style="width:${lo0 * 100}%"></i>${parts}${hi > lo + 0.001 ? `<i class="pre${p < v ? ' down' : ''}" style="left:${lo * 100}%;width:${(hi - lo) * 100}%"></i>` : ''}</span>`;
      })
      .join('');
  }

  function openItemPop(id, el) {
    if (toggledOff(el)) return;
    closePop();
    popOwner = el;
    hideTip();
    pop = document.createElement('div');
    pop.className = 'pop pnl';
    pop.append(infoBox(id));
    const fit = document.createElement('button');
    fit.type = 'button';
    fit.className = 'fitb';
    fit.textContent = where(id) ? `Move here from the ${where(id)}` : 'Fit to this tank';
    if (PARTS[id].only && PARTS[id].only !== o.tankId) {
      fit.disabled = true;
      fit.textContent = `${TANKS[PARTS[id].only].name} only`;
    }
    fit.addEventListener('click', () => (closePop(), equip(id)));
    pop.append(fit);
    placePop(el);
  }
  // a part's card for the pops: picture, tier, name, its one line, the numbers
  function infoBox(id) {
    const tier = tierOf(id);
    const d = document.createElement('div');
    d.className = 'info';
    d.style.setProperty('--tc', TIERS[tier].color);
    d.innerHTML = `<div class="hd"><img alt="" src="${pic(id)}"><b><span class="tiername">${TIERS[tier].name} · Lv ${levelOf(id)}${starBadge(id)}</span><span class="pn"></span></b></div><p></p>${effectsHtml(id, o.tankId)}${where(id) ? `<span class="where">On the ${where(id)}.</span>` : ''}`;
    d.querySelector('.pn').textContent = PARTS[id].name;
    d.querySelector('p').textContent = PARTS[id].text;
    // in the hangar: straight to this part on the upgrades screen
    if (o.onUpgrades) {
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'upb';
      up.textContent = tier >= TIERS.length - 1 ? 'Upgrades' : 'Upgrade';
      up.addEventListener('click', () => (closePop(), o.onUpgrades(id)));
      d.append(up);
    }
    return d;
  }
  // a slot's line: its biggest change or two, and its perk
  function shortFx(id, tier) {
    const rows = partEffects(id, o.tankId).slice(0, 2);
    const perk = tier >= TIERS.length - 1 && partPerk(id);
    return rows.map((r) => `<span>${r.label} <b class="${r.good ? 'good' : 'bad'}">${r.delta}</b></span>`).join('') + (perk ? `<span class="pk">★ ${perk.name}</span>` : '');
  }
  function placePop(el) {
    root.append(pop);
    const r = el.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, window.innerWidth - pr.width - 8)))}px`;
    pop.style.top = `${Math.round(Math.min(r.bottom + 10, window.innerHeight - pr.height - 8))}px`;
    el.classList.add('on');
  }
  function openPop(id, el) {
    if (toggledOff(el)) return;
    closePop();
    popOwner = el;
    hideTip();
    const list = loadout();
    pop = document.createElement('div');
    pop.className = 'pop pnl';
    if (id) {
      // a fitted part: what it does, and Remove (to swap it, pick a part
      // in storage and then this slot)
      pop.append(infoBox(id));
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'remove';
      b.textContent = 'Remove';
      b.addEventListener('click', () => set(list.filter((x) => x !== id)));
      pop.append(b);
      return placePop(el);
    }
    for (const s of spare().filter((x) => !PARTS[x].only || PARTS[x].only === o.tankId)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<img alt="" src="${pic(s)}"><span></span>`;
      b.querySelector('span').textContent = PARTS[s].name;
      b.addEventListener('click', () => set(id ? list.map((x) => (x === id ? s : x)) : [...list, s], s));
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
      closeMenu();
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
