// The base between runs: a bunker under the city, seen whole from the usual
// corner. Three rooms off a central hall:
//  - quarters (back left): bunks, lockers, a stove going
//  - briefing (front left): the CIC table, where you pick where to go next
//  - hangar (right): the tank up on its lift, the workshop round it
//
// Hover a room and it lights its outline; click it (anywhere in it) and the
// camera eases in and its screen opens straight away, wherever the crewman
// is. Walking into a room opens it too. The crewman walks with WASD /
// arrows, or click the hall floor where to go. Esc or Back closes a screen.
import { watchPopups, watchScreens } from '../ui/fit.js';
import * as THREE from 'three';
import { LevelBuilder, canvas, tex, blob, speckle } from '../levels/builder.js';
import { box, cyl, put, toon, gradientMap, setLowPoly, approachAngle } from '../models/kit.js';
import { CREW, CREW_IDS, CREW_MAX, RANKS, rankOf, crewBonuses, crewCost, promotesAt, trainCrew } from '../game/crew.js';
import { rankIcon } from '../ui/crewArt.js';
import { fountain, popFrames, ascend } from '../ui/celebrate.js';
import { snapshotCanvas } from '../render/snapshot.js';
import { createCrew } from '../models/crew.js';
import { pushOut } from '../game/collide.js';
import { PLAYER_LAYER } from '../render/pixel.js';
import { CURSOR } from '../game/hud.js';
import { PARTS, fitsTank, attachPart, effectsHtml, improvementHtml, improveTo } from '../game/parts.js';
import { TANKS, tankDef } from '../game/tanks.js';
import { createFitting, anchorWorld, tankPicture } from '../ui/fitting.js';
import { createWorkshop, upgradeHint, evolveReady, canEvolve } from '../ui/workshop.js';
import { save } from '../game/save.js';
import { EQUIPMENT, equipmentIcon, equipmentHtml } from '../game/equipment.js';
import { tokenIconURL } from '../ui/icons.js';
import { partPicture } from '../render/partPictures.js';
import { fitInside } from '../ui/scale.js';
import { openSettings } from '../ui/settings.js';
import { CAMPAIGN, PAGES, clearKey, isOpen } from '../game/campaign.js';
import { ENDLESS_AFTER, ENDLESS_MAPS, endlessOpen, trackHtml, trackPos, TRACK, TRACK_AT, TRACK_CSS, rewardText } from '../game/endless.js';

const VIEW_FAR = 23; // the whole base in view
const ROWS = 680; // pixel rows (fixed, so the pixels don't swim as the camera zooms)
const CAM_OFFSET = new THREE.Vector3(-10, 8.2, 10).multiplyScalar(4);
const WALK = 3.4;
const H = 4.2; // wall height
const HH = 5.2; // the hangar's
const SODIUM = 0xffa245;
const HOLO = 0x5fe0f0;
const INPUT_FORWARD = new THREE.Vector3(1, 0, -1).normalize();
const INPUT_RIGHT = new THREE.Vector3(1, 0, 1).normalize();
const BASE_CENTER = new THREE.Vector3(7.5, 0, -3.2);

export { CAMPAIGN } from '../game/campaign.js';

// The settings cog, 16 px of pixel art: a rim with eight square teeth, a
// hole through the middle, a shade on its lower edge.
function cogIcon() {
  const MAP = [
    '......####......',
    '......####......',
    '..##..####..##..',
    '..############..',
    '...##########...',
    '...##########...',
    '######....######',
    '######....######',
    '######....######',
    '######....######',
    '...##########...',
    '...##########...',
    '..############..',
    '..##..####..##..',
    '......####......',
    '......####......',
  ];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  MAP.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      if (row[x] !== '#') continue;
      g.fillStyle = y >= 11 ? '#b9b0a0' : '#f1e9d8'; // (shaded underneath)
      g.fillRect(x, y, 1, 1);
    }
  });
  return c.toDataURL();
}

const CSS = `
.base { position: fixed; inset: 0; pointer-events: none; z-index: 10; color: #f1e9d8; font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; --amber: #ffb347; --holo: #5fe0f0; }
.base .panel { background: rgba(12, 11, 13, 0.88); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; }
.base .px { font-family: 'Silkscreen', 'Pixelify Sans', monospace; text-transform: uppercase; letter-spacing: 0.06em; }
.base-bank { position: absolute; left: calc(16px + env(safe-area-inset-left, 0px)); top: calc(14px + env(safe-area-inset-top, 0px)); padding: 6px 14px; display: flex; gap: 10px; align-items: center; font-size: 14px; color: var(--amber); }
.base-bank i { width: 10px; height: 14px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.base-bank b { font-weight: 400; color: #f1e9d8; font-variant-numeric: tabular-nums; }
.base-tag { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); padding: 3px 8px 4px; font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase;
  color: var(--amber); background: rgba(12, 11, 13, 0.75); box-shadow: 0 0 0 2px #000; white-space: nowrap; pointer-events: auto; cursor: var(--cursor); }
.base-tag.hot { color: #111; background: var(--amber); }
/* over the Levels room: the next tank, waiting at the end of level 2 */
.base-promo { position: absolute; left: 0; top: 0; display: grid; gap: 4px; justify-items: center; padding: 7px 10px 9px; pointer-events: auto; cursor: var(--cursor);
  box-shadow: 0 0 0 2px #000, 0 0 0 4px #6be08a, 4px 4px 0 4px #000; animation: basePromo 1.4s steps(2) infinite; }
.base-promo .t { font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; padding: 3px 6px; color: #111; background: #6be08a; box-shadow: 0 0 0 2px #000; }
.base-promo img { width: 120px; height: 70px; image-rendering: pixelated; }
.base-promo b { max-width: 150px; font: 400 10px/1.15 'Silkscreen', monospace; text-transform: uppercase; font-weight: 400; color: #f1e9d8; text-align: center; }
.base-promo i { position: absolute; left: 50%; top: 100%; margin-left: -7px; width: 14px; height: 9px; background: #6be08a; clip-path: polygon(0 0, 100% 0, 50% 100%); }
@keyframes basePromo { 0%, 100% { transform: translate(-50%, calc(-100% - 22px)); } 50% { transform: translate(-50%, calc(-100% - 27px)); } }
.base-tag.alert::after { content: 'Upgrade!'; margin-left: 8px; padding: 1px 4px; color: #111; background: #6be08a; box-shadow: 0 0 0 2px #000; animation: baseAlert 0.9s steps(2) infinite; }
@keyframes baseAlert { 50% { background: #b6ffc4; } }
/* the upgrades walkthrough: the screen dimmed round a spotlight, a label
   bouncing over what to click */
.base-guide { position: fixed; inset: 0; z-index: 55; pointer-events: none; }
.base-guide .lab { position: fixed; left: 0; top: 0; display: grid; gap: 4px; justify-items: center; padding: 7px 10px 9px; max-width: 220px; background: #17151a; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6be08a, 4px 4px 0 4px #000; animation: baseGuide 0.9s steps(2) infinite; }
.base-guide .lab .t { font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; padding: 3px 7px; color: #111; background: #6be08a; box-shadow: 0 0 0 2px #000; }
.base-guide .lab .skip { pointer-events: auto; cursor: var(--cursor); margin-top: 2px; padding: 3px 8px; font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; background: #2a262c; box-shadow: 0 0 0 2px #000; border: 0; }
.base-guide .lab .skip:hover { color: #f1e9d8; }
.base-guide .lab b { font: 400 13px/1.2 'Pixelify Sans', monospace; font-weight: 400; color: #f1e9d8; text-align: center; }
.base-guide .lab i { position: absolute; left: 50%; top: 100%; margin-left: -8px; width: 16px; height: 10px; background: #6be08a; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.base-guide .lab.below i { top: auto; bottom: 100%; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
@keyframes baseGuide { 0%, 100% { translate: 0 0; } 50% { translate: 0 -5px; } }
.base-menu { position: absolute; right: calc(24px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); width: min(340px, calc(100vw - 48px)); padding: 16px 18px 18px;
  display: grid; gap: 12px; pointer-events: auto; }
.base-crew { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, calc(100vw - 32px)); max-height: calc(100dvh - 24px); overflow-y: auto; box-sizing: border-box;
  padding: 16px 18px 18px; display: grid; gap: 14px; pointer-events: auto; }
.base-endless { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(780px, calc(100vw - 32px)); max-height: calc(100dvh - 24px); overflow-y: auto; box-sizing: border-box; padding: 16px 18px 18px; display: grid; gap: 14px; pointer-events: auto; }
.base-endless .top { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; }
.base-endless .label { font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; letter-spacing: 0.06em; }
.base-endless .maps, .base-endless .you { display: grid; gap: 8px; align-content: start; }
.base-endless .map { display: grid; gap: 4px; padding: 10px 12px; text-align: left; border: 0; cursor: var(--cursor); color: #d8d0c0; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; font: inherit; }
.base-endless .map.sel { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.base-endless .map b { font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; font-weight: 400; color: var(--amber); }
.base-endless .map small { font-size: 12px; color: #b9b0a0; }
.base-endless .map .rec { font: 400 10px/1.2 'Silkscreen', monospace; text-transform: uppercase; color: #6be08a; }
.base-endless .loadout { display: flex; gap: 8px; align-items: center; padding: 6px 8px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 3px #4a4540; }
.base-endless .loadout .tk { width: 84px; height: 49px; image-rendering: pixelated; flex: none; }
.base-endless .loadout .lo { display: grid; gap: 4px; min-width: 0; flex: 1; }
.base-endless .loadout .lo b { font: 400 11px/1.1 'Silkscreen', monospace; font-weight: 400; text-transform: uppercase; color: var(--amber); }
.base-endless .loadout .lo small { font-size: 11px; color: #b9b0a0; }
.base-endless .loadout .cells { display: flex; gap: 3px; flex-wrap: wrap; }
.base-endless .loadout .cell { width: 26px; height: 18px; background: #121014; box-shadow: 0 0 0 1px #000, 0 0 0 2px #4a4540; }
.base-endless .loadout .cell img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.base-endless .loadout .cell.eq { box-shadow: 0 0 0 1px #000, 0 0 0 2px #5fe6ff; margin-left: 3px; }
.base-endless .loadout .cell.empty { box-shadow: 0 0 0 1px #000, 0 0 0 2px #c42a20; }
.base-endless .tohangar { flex: none; padding: 8px 10px; font: 400 10px/1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: #ffc24a; box-shadow: 0 3px 0 #8a5a1c; border: 0; cursor: var(--cursor); }
.base-endless .trackhead { display: flex; justify-content: space-between; align-items: baseline; }
.base-endless .trackhead b { font: 400 12px/1 'Silkscreen', monospace; font-weight: 400; color: #6be08a; }
.base-endless .note { font-size: 12px; color: #8f877a; }
.base-endless .row { display: flex; gap: 10px; }
@media (max-width: 640px) { .base-endless .top { grid-template-columns: 1fr; } .base-endless .etrack { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
.base-tag.locked::after { content: 'Locked · Lvl 3'; margin-left: 6px; padding: 1px 4px; font-size: 9px; color: #b9b0a0; background: #2a262c; box-shadow: 0 0 0 2px #000; }
.base-tag.newroom::after { content: 'New!'; margin-left: 8px; padding: 1px 4px; color: #111; background: #6be08a; box-shadow: 0 0 0 2px #000; animation: baseAlert 0.9s steps(2) infinite; }
.base-crew .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.base-crew .card { display: grid; gap: 8px; align-content: start; justify-items: center; padding: 12px 10px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base-crew .frame { position: relative; width: 100%; max-width: 128px; aspect-ratio: 1; background: radial-gradient(circle at 50% 40%, #3a4236, #1f2420 75%); box-shadow: 0 0 0 2px #000; }
.base-crew .frame .pic { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.base-crew .frame canvas { position: absolute; left: 4px; top: 4px; width: 28px; height: 32px; inset: 4px auto auto 4px; }
.base-crew .card b { font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); font-weight: 400; }
.base-crew .lvl { font: 400 11px/1 'Silkscreen', monospace; color: #b9b0a0; }
.base-crew .fx { display: grid; gap: 4px; width: 100%; }
.base-crew .fx div { display: flex; justify-content: space-between; font-size: 13px; color: #d8d0c0; }
.base-crew .fx i { font-style: normal; color: #6be08a; font-variant-numeric: tabular-nums; }
.base-crew button.train { width: 100%; padding: 8px 6px 9px; border: 0; cursor: var(--cursor); font: 400 11px/1.2 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: #6be08a; box-shadow: 0 3px 0 #2f6b40; }
.base-crew button.train.promote { background: #f2d23a; box-shadow: 0 3px 0 #8a7420; }
.base-crew button.train:disabled { background: #3a3638; color: #8a8278; box-shadow: none; cursor: default; }
@media (max-width: 520px) { .base-crew .cards { gap: 8px; } .base-crew .card { padding: 8px 6px; } .base-crew .fx div { font-size: 11px; } }
.base h2 { margin: 0; font: 400 20px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.base .sub { margin: -6px 0 0; color: #b9b0a0; font-size: 13px; }
.base .zone { display: grid; gap: 6px; padding: 10px 12px 12px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base .zone.locked { opacity: 0.5; }
.base .zone b { font: 400 13px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); font-weight: 400; }
.base .zone span { font-size: 13px; color: #d8d0c0; }
.base button.go, .base button.back { justify-self: start; padding: 8px 16px 9px; border: 0; cursor: var(--cursor); font: 400 13px/1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: #6be08a; box-shadow: 0 3px 0 #2f6b40; }
.base button.back { background: #2a2628; color: #f1e9d8; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base button:hover { filter: brightness(1.15); }
.base button:disabled { filter: grayscale(1) brightness(0.6); }
.base .stats { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; font-size: 12px; color: #b9b0a0; }
.base .stats i { display: block; height: 8px; background: linear-gradient(90deg, var(--amber) var(--v), #2a2628 var(--v)); box-shadow: 0 0 0 2px #000; }
/* briefing: the campaign map in the middle, the zone's details to its right */
.base-brief { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 22px; padding: 64px 24px 24px; pointer-events: auto; background: rgba(5, 9, 12, 0.55); }
.base-brief .map { position: relative; height: min(78vh, 680px); aspect-ratio: 2 / 3; box-shadow: 0 0 0 2px #000, 0 0 0 4px #d8d4cb, 4px 4px 0 4px #000; }
.base-brief .map canvas { position: static; inset: auto; width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.base-brief .node { position: absolute; transform: translate(-50%, -50%); width: 34px; height: 34px; border: 0; padding: 0; cursor: var(--cursor); font: 400 15px/1 'Silkscreen', monospace;
  color: #141416; background: #f1e9d8; box-shadow: 0 0 0 2px #000; }
.base-brief .node.open { background: var(--amber); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 0 0 16px #ffb347aa; }
.base-brief .node.locked { background: #3a3b3f; color: #8a8a8e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #7a2a26; }
.base-brief .node.open.alldone { background: #5d7fa8; color: #e8eef6; box-shadow: 0 0 0 2px #000, 0 0 0 4px #b9c6d6; }
.base-brief .node.alldone::after { content: ''; position: absolute; right: -9px; top: -9px; width: 16px; height: 16px; background: #6be08a; box-shadow: 0 0 0 2px #000; clip-path: polygon(14% 52%, 30% 36%, 42% 50%, 72% 16%, 88% 32%, 42% 82%); }
.base-brief .node.sel { outline: 3px solid #f1e9d8; outline-offset: 3px; }
/* the page turn: a big pixel arrow tab on the map's top or bottom edge */
.base-brief .pageturn { position: absolute; left: 72%; z-index: 3; display: flex; align-items: center; gap: 8px; padding: 7px 12px 8px; border: 0; cursor: var(--cursor); transform: translateX(-50%); font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; white-space: nowrap; color: #141416; background: #f1e9d8; box-shadow: 0 0 0 2px #000, 4px 4px 0 2px #000; }
.base-brief .pageturn.up { top: -20px; }
.base-brief .pageturn.down { bottom: -20px; }
.base-brief .pageturn i { width: 14px; height: 12px; background: #141416; clip-path: polygon(50% 0, 100% 60%, 70% 60%, 70% 100%, 30% 100%, 30% 60%, 0 60%); }
.base-brief .pageturn.down i { transform: scaleY(-1); }
.base-brief .pageturn:hover { background: #fff; }
.base-brief .pageturn.glow { color: #111; background: var(--amber); animation: pageglow 0.9s steps(2) infinite; }
.base-brief .pageturn em { position: absolute; right: -12px; top: -12px; padding: 3px 5px; font: 400 9px/1 'Silkscreen', monospace; font-style: normal; color: #111; background: #6be08a; box-shadow: 0 0 0 2px #000; }
@keyframes pageglow { 0%, 100% { box-shadow: 0 0 0 2px #000, 4px 4px 0 2px #000, 0 0 10px 2px #ffb347aa; } 50% { box-shadow: 0 0 0 2px #000, 4px 4px 0 2px #000, 0 0 26px 8px #ffb347ee; background: #ffd27a; } }
.base-brief .node.open.sel { background: #6be08a; box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 0 0 16px #6be08aaa; }
.base-brief .info { width: min(300px, 32vw); padding: 16px 18px 18px; display: grid; gap: 10px; align-self: center; }
.base-brief .info .tagline { font-size: 11px; color: #ff6a5a; }
.base-brief .info p { margin: 0; font-size: 13px; color: #d8d0c0; }
.base-brief .steps { display: flex; align-items: center; gap: 6px; font: 400 13px/1 'Silkscreen', monospace; text-transform: uppercase; }
.base-brief .steps b { font-weight: 400; padding: 5px 8px; background: #2a2628; box-shadow: 0 0 0 2px #000; color: #f1e9d8; }
.base-brief .steps b.boss { background: #5a1f1c; color: #ffb0a8; }
.base-brief .steps i { width: 14px; height: 2px; background: #6d655a; }
.base-brief .label { font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; color: #b9b0a0; letter-spacing: 0.06em; }
.base-brief .rewards { display: flex; flex-wrap: wrap; gap: 8px; }
.base-brief .rewards > span { position: relative; width: 54px; height: 40px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.base-brief .rewards img { width: 100%; height: 100%; image-rendering: pixelated; }
.base-brief .rewards > span.got img { filter: brightness(0.45) saturate(0.4); }
.base-brief .rewards > span:hover { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.base-brief .rewards .tip, .base-brief .node .hardtag .rw .tip { display: none; position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%); width: 190px; padding: 7px 9px; z-index: 4; background: #121014; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; text-align: left; pointer-events: none; text-transform: none; white-space: normal; }
.eqfx { width: min(300px, 80vw); margin: 0 auto; text-align: left; }
.base-brief .rewards > span:hover > .tip, .base-brief .node .hardtag .rw:hover > .tip { display: block; }
.base-brief .rewards > span.imp::after { content: '▲'; position: absolute; right: -4px; top: -6px; font: 400 10px/1 'Silkscreen', monospace; color: #111; background: #6be08a; padding: 2px 3px; box-shadow: 0 0 0 2px #000; }
.base-brief .rewards span[data-tip]:hover::before { content: attr(data-tip); position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%); width: 190px; padding: 7px 9px; z-index: 3;
  font: 400 12px/1.3 'Pixelify Sans', monospace; color: #f1e9d8; background: #121014; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; white-space: normal; text-align: left; pointer-events: none; }
.base-brief .rewards > span.got::after { content: '✓'; position: absolute; right: -4px; top: -6px; font: 400 12px/1 'Silkscreen', monospace; color: #111; background: #6be08a; padding: 2px 3px; box-shadow: 0 0 0 2px #000; }
.base-brief .info .row { display: flex; gap: 10px; flex-wrap: wrap; }
.base-brief .info .loadout { display: flex; gap: 8px; align-items: center; padding: 4px 6px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 3px #4a4540; }
.base-brief .info .loadout .tk { width: 52px; height: 30px; image-rendering: pixelated; flex: none; }
.base-brief .info .loadout .lo { display: flex; gap: 6px; align-items: center; min-width: 0; flex: 1; flex-wrap: wrap; }
.base-brief .info .loadout .lo b { font: 400 10px/1.1 'Silkscreen', monospace; font-weight: 400; text-transform: uppercase; color: var(--amber); }
.base-brief .info .loadout .lo small { display: none; }
.base-brief .info .loadout .cells { display: flex; gap: 3px; }
.base-brief .info .loadout .cell { width: 22px; height: 16px; background: #121014; box-shadow: 0 0 0 1px #000, 0 0 0 2px #4a4540; }
.base-brief .info .loadout .cell img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.base-brief .info .loadout .cell.eq { box-shadow: 0 0 0 1px #000, 0 0 0 2px #5fe6ff; margin-left: 3px; }
.base-brief .info .loadout .cell.empty { box-shadow: 0 0 0 1px #000, 0 0 0 2px #c42a20; }
.base-brief .info .loadout .tohangar { flex: none; padding: 6px 8px; font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: #ffc24a; box-shadow: 0 2px 0 #8a5a1c; border: 0; cursor: var(--cursor); }
/* portrait: the map on top, the details under it, all on one screen (the
   details shrink to fit what's left: fitBrief) */
@media (orientation: portrait) and (max-width: 760px) {
  .base-brief { flex-direction: column; gap: 12px; padding: 56px 12px 12px; overflow: hidden; justify-content: flex-start; align-items: center; }
  .base-brief .map { height: min(40dvh, 150vw); width: auto; flex: none; }
  .base-brief .info { width: min(420px, calc(100vw - 24px)); align-self: center; flex: none; transform-origin: top center; }
}
.base-brief .diffs { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.base-brief .dtab { display: grid; gap: 4px; justify-items: start; padding: 8px 10px 9px; border: 0; cursor: var(--cursor); text-align: left; color: #b9b0a0; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #4a4446; }
.base-brief .dtab b { font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; font-weight: 400; color: #f1e9d8; }
.base-brief .dtab small { font: 400 11px/1.2 'Pixelify Sans', monospace; }
.base-brief .dtab .st { display: flex; gap: 6px; align-items: center; font: 400 10px/1 'Silkscreen', monospace; text-transform: uppercase; }
.base-brief .dtab.on { background: #2a2420; box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.base-brief .dtab.hard b { color: #ff8a7a; }
.base-brief .dtab.locked { cursor: var(--cursor); opacity: 0.45; filter: grayscale(0.6); }
.base-brief .dtab .lock { position: relative; width: 8px; height: 6px; margin-top: 4px; background: #b9b0a0; }
.base-brief .dtab .lock::before { content: ''; position: absolute; left: 1px; top: -5px; width: 4px; height: 4px; border: 1px solid #b9b0a0; border-bottom: 0; }
.base-brief .dtab.hard.on { background: #2a1716; box-shadow: 0 0 0 2px #000, 0 0 0 4px #ff3b2f; }
.base-brief .star { width: 12px; height: 12px; clip-path: polygon(50% 0, 63% 35%, 100% 38%, 71% 61%, 81% 100%, 50% 78%, 19% 100%, 29% 61%, 0 38%, 37% 35%); background: #3a3634; }
.base-brief .star.easy.got { background: var(--amber); }
.base-brief .star.hard.got { background: #ff3b2f; }
.base-brief .callout { position: relative; justify-self: end; margin-top: 4px; padding: 6px 9px; font: 400 12px/1.25 'Pixelify Sans', monospace; color: #fff; background: #c42a20; box-shadow: 0 0 0 2px #000; animation: basecall 1.2s steps(2) infinite; }
.base-brief .callout::before { content: ''; position: absolute; right: 26%; top: -8px; width: 12px; height: 8px; background: #c42a20; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
@keyframes basecall { 50% { transform: translateY(-3px); } }
.base-brief .rewards span.tank { width: 116px; height: 68px; }
.base-brief .rewards span.cash { display: grid; place-items: center; width: 116px; height: 40px; font: 400 13px/1 'Silkscreen', monospace; color: var(--amber); }
.base-brief .rewards span.cash.got { color: #6d655a; }
.base-brief .rewards span.tok { color: #d9a8ff; }
.base-brief .rewards span.legpart { width: 72px; height: 54px; box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffc24a, 0 0 12px #ffc24a88; }
.base-brief .rewards span.legpart em { position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); padding: 2px 4px; font: 400 8px/1 'Silkscreen', monospace; font-style: normal; text-transform: uppercase; color: #111; background: #ffc24a; box-shadow: 0 0 0 2px #000; }
.base-brief .rewards span.equip { width: 66px; height: 50px; background: none; box-shadow: none; } /* (the icon is its own cut-corner tile) */
.base-brief .rewards span.res { display: flex; align-items: center; justify-content: center; gap: 7px; width: 104px; height: 34px; font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; }
.base-brief .rewards span.res.scr { color: var(--amber); }
.base-brief .rewards span.res.tok { color: #d9a8ff; }
.base-brief .rewards span.res.scr i { width: 9px; height: 13px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); box-shadow: 12px 0 0 #5fb8ff; }
.base-brief .rewards span.res.tok i { width: 18px; height: 18px; background: url(${tokenIconURL()}) center / contain no-repeat; image-rendering: pixelated; }
.base-brief .rewards span.tank img { object-fit: contain; }
.base-brief .note { font-size: 12px; color: #b9b0a0; }
.base-brief .node .stars { position: absolute; left: 50%; top: calc(100% + 5px); transform: translateX(-50%); display: flex; gap: 2px; }
.base-brief .node .stars .star { width: 11px; height: 11px; background: #5a5456; }
.base-brief .node .stars .star.easy.got { background: var(--amber); }
.base-brief .node .stars .star.hard.got { background: #ff3b2f; }
.base-brief .node .hardtag { position: absolute; left: 50%; bottom: calc(100% + 12px); transform: translateX(-50%); padding: 4px 7px 5px; font: 400 10px/1 'Silkscreen', monospace; text-transform: uppercase; white-space: nowrap; color: #fff; background: #c42a20; box-shadow: 0 0 0 2px #000; animation: hardbob 1.2s steps(2) infinite; pointer-events: none; }
@keyframes hardbob { 0%, 100% { transform: translateX(-50%); } 50% { transform: translateX(-50%) translateY(-4px); } }
.base-brief .node .hardtag.rich { display: grid; gap: 4px; justify-items: center; padding: 6px 8px 8px; pointer-events: auto; }
.base-brief .node .hardtag small { font-size: 8px; color: #ffd4cf; }
.base-brief .node .hardtag .rw { position: relative; display: block; width: 60px; height: 40px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffc24a, 0 0 10px #ffc24a99; }
.base-brief .node .hardtag .rw img { width: 100%; height: 100%; image-rendering: pixelated; }
.base-brief .node .hardtag em { margin-top: 3px; padding: 2px 5px; font: 400 8px/1 'Silkscreen', monospace; font-style: normal; color: #111; background: #ffc24a; box-shadow: 0 0 0 2px #000; }
.base-brief .node .hardtag.tanktag { background: #2f8a4a; animation-duration: 1.4s; }
.base-brief .node .hardtag.tanktag::after { background: #2f8a4a; }
.base-brief .node .hardtag.tanktag small { color: #c9f5d4; }
.base-brief .node .hardtag.equiptag { background: #1f7a8c; animation-duration: 1.3s; }
.base-brief .node .hardtag.equiptag::after { background: #1f7a8c; }
.base-brief .node .hardtag.equiptag small { color: #c8f6ff; }
.base-brief .node .hardtag .rw.eq { width: 64px; height: 48px; box-shadow: 0 0 0 2px #000, 0 0 0 4px #5fe6ff, 0 0 10px #5fe6ff99; }
.base-brief .node .hardtag .rw.tk { width: 84px; height: 49px; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6be08a, 0 0 10px #6be08a99; }
.base-brief .node .hardtag.tanktag em { background: #6be08a; }
.base-brief .node .hardtag::after { content: ''; position: absolute; left: 50%; top: 100%; margin-left: -6px; width: 12px; height: 7px; background: #c42a20; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.base-news { position: absolute; z-index: 6; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(400px, calc(100vw - 32px)); padding: 16px 18px 18px; display: grid; gap: 12px; justify-items: center; text-align: center; pointer-events: auto; }
.base-news h2.warn { color: #ff4a3a; white-space: nowrap; font-size: clamp(14px, 3.4vw, 20px); }
.base-news button.tohangar { justify-self: center; }
.base button.go.yel { background: #ffc24a; box-shadow: 0 3px 0 #8a5a1c; }
.base-news .newtag.leg { background: #ffc24a; }
.base-news .legpic { position: relative; display: block; box-shadow: 0 0 0 2px #000, 0 0 0 4px #ffc24a, 0 0 16px #ffc24a88; background: #1d1b1e; }
.base-news .legpic img { display: block; }
.base-news .legpic em { position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); padding: 2px 5px; font: 400 9px/1 'Silkscreen', monospace; font-style: normal; color: #111; background: #ffc24a; box-shadow: 0 0 0 2px #000; }
.base-news .newtag { font: 400 13px/1 'Silkscreen', monospace; text-transform: uppercase; padding: 4px 8px; color: #111; background: #6be08a; box-shadow: 0 0 0 2px #000; }
.base-news img { width: 192px; height: 112px; image-rendering: pixelated; }
.base-news p { margin: 0; font-size: 14px; color: #d8d0c0; }
.base-news img.gear { width: 128px; height: 96px; }
.base-news .hint { font-size: 12px; color: #8f877a; }
.base-news .row { display: flex; gap: 10px; justify-content: center; }
.base-news button { white-space: nowrap; }
.base-gear { position: absolute; right: calc(16px + env(safe-area-inset-right, 0px)); top: calc(54px + env(safe-area-inset-top, 0px)); display: flex; gap: 8px; align-items: center; padding: 7px 12px 8px; border: 0; pointer-events: auto; font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; color: #f1e9d8; }
.base-gear i { width: 20px; height: 20px; background: var(--cog) center / contain no-repeat; image-rendering: pixelated; }
.base-gear:hover { filter: brightness(1.2); }
@media (max-width: 600px) { .base-gear span { display: none; } .base-promo img { width: 80px; height: 47px; } .base-promo b { max-width: 110px; font-size: 9px; } }
.base-hint { position: absolute; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); padding: 6px 12px; font-size: 13px; color: #b9b0a0; width: max-content; max-width: calc(100vw - 24px); box-sizing: border-box; text-align: center; }
/* phones: nothing past the screen's edges; overlays scroll instead */
.base-news, .base-menu { max-height: calc(100dvh - 24px); overflow-y: auto; box-sizing: border-box; }
.base-brief { padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
.base-fade { position: absolute; inset: 0; background: #070609; opacity: 1; transition: opacity 0.45s steps(5); }
.base-fade.off { opacity: 0; }
.base [hidden] { display: none !important; }
`;

// ------------------------------------------------------------- textures
function floorTexture(rand, w, d, { base = '#4f4d4a', specks = ['#55534f', '#47453f', '#5b5954'], seam = '#403e3b', tile = 3, stains = 0.15 } = {}) {
  const S = 10;
  const [c, g] = canvas(w * S, d * S);
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, specks, c.width * c.height * 0.05, rand);
  g.fillStyle = seam;
  for (let x = 0; x < c.width; x += tile * S) g.fillRect(x, 0, 1, c.height);
  for (let y = 0; y < c.height; y += tile * S) g.fillRect(0, y, c.width, 1);
  for (let i = 0; i < w * d * stains; i++) {
    g.fillStyle = rand() < 0.5 ? '#383633' : '#3f3c38';
    blob(g, rand() * c.width, rand() * c.height, 6 + rand() * 20, 4 + rand() * 14, rand, 11);
  }
  return tex(c);
}
// plank floor for the quarters
function planksTexture(rand, w, d) {
  const S = 10;
  const [c, g] = canvas(w * S, d * S);
  const tones = ['#5a4632', '#54412e', '#614b35', '#4e3c2a'];
  for (let y = 0; y < c.height; y += 5) {
    let x = -((rand() * 40) | 0);
    while (x < c.width) {
      const len = 30 + ((rand() * 40) | 0);
      g.fillStyle = tones[(rand() * tones.length) | 0];
      g.fillRect(x, y, len, 5);
      g.fillStyle = '#3a2c1f';
      g.fillRect(x, y, 1, 5);
      x += len;
    }
    g.fillStyle = '#3a2c1f';
    g.fillRect(0, y + 4, c.width, 1);
  }
  speckle(g, c.width, c.height, ['#6a5440', '#46362a'], c.width * c.height * 0.02, rand);
  return tex(c);
}

// The CIC table's glass: a lit map in cold glowing lines.
function holoTexture(rand) {
  const [c, g] = canvas(128, 80);
  g.fillStyle = '#06161c';
  g.fillRect(0, 0, 128, 80);
  g.fillStyle = '#0d2c36';
  for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 1, 80);
  for (let y = 0; y < 80; y += 8) g.fillRect(0, y, 128, 1);
  // contour rings
  g.strokeStyle = '#13505e';
  g.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.ellipse(92, 26, 10 + k * 7, 6 + k * 5, 0.4, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = '#16465a';
  for (let i = 0; i < 46; i++) g.fillRect((rand() * 124) | 0, (rand() * 76) | 0, 2 + rand() * 7, 2 + rand() * 5); // blocks
  g.fillStyle = '#2aa6c4';
  g.fillRect(0, 44, 128, 2); // the avenue
  g.fillRect(84, 0, 2, 80); // the cross road
  g.fillStyle = '#1d6f86';
  for (let y = 0; y < 80; y++) g.fillRect(50 + Math.round(Math.sin(y / 9) * 4), y, 5, 1); // the river
  g.fillStyle = '#9ef2ff';
  for (let x = 6; x < 84; x += 4) g.fillRect(x, 42, 2, 1); // the route
  g.fillStyle = '#ffb347';
  for (const [x, y] of [[12, 45], [44, 45], [70, 45], [86, 45]]) g.fillRect(x - 1, y - 2, 3, 3);
  g.fillStyle = '#ff3b2f';
  g.fillRect(96, 40, 3, 3);
  // frame ticks
  g.fillStyle = '#5fe0f0';
  for (let x = 0; x < 128; x += 16) {
    g.fillRect(x, 0, 1, 3);
    g.fillRect(x, 77, 1, 3);
  }
  return tex(c);
}

// the route between a page's levels: dashed white; on to the next page off
// the top, and in from the last one at the bottom
const GATE_X = 0.72; // where the way out through the city wall is, across the map
function route(g, W, Hc, page) {
  const pts = CAMPAIGN.filter((l) => (l.page || 0) === page).map((l) => l.at);
  if (page < PAGES - 1) pts.push([GATE_X, -0.02]);
  if (page > 0) pts.unshift([GATE_X, 1.02]);
  g.fillStyle = '#f1e9d8';
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    // each leg bowed a little, alternately (a road, not a ruler line)
    const bow = (i % 2 ? 1 : -1) * 0.12;
    const cx = (ax + bx) / 2 - (by - ay) * bow;
    const cy = (ay + by) / 2 + (bx - ax) * bow;
    for (let s = 0; s <= 44; s += 2) {
      const t = s / 44;
      const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
      const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
      g.fillRect(Math.round(x * W), Math.round(y * Hc), 2, 2);
    }
  }
}

// The second page: out past the city wall, drawn the same way as the
// city's page. The wall along the bottom with its gate; beyond it the
// suburbs (small scattered blocks), the industrial district (big ones), the
// slums (a dense spatter), and the far side of it all. A stream winding
// across; the old trunk road out from the gate, branches off it. All of it
// enemy ground, hatched red.
function outerMap() {
  const W = 160;
  const Hc = 240;
  const [c, g] = canvas(W, Hc);
  let seed = 97;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  g.fillStyle = '#1b1c1f';
  g.fillRect(0, 0, W, Hc);
  g.fillStyle = '#232428';
  for (let x = 0; x < W; x += 10) g.fillRect(x, 0, 1, Hc);
  for (let y = 0; y < Hc; y += 10) g.fillRect(0, y, W, 1);
  // districts: [cx, cy, count, radius, block size min, extra]
  for (const [cx, cy, n, r, s0, ds] of [
    [60, 182, 70, 34, 2, 2], // suburbs: many small
    [30, 150, 24, 18, 2, 2],
    [116, 128, 22, 28, 5, 7], // industrial: few big
    [132, 168, 10, 16, 4, 6],
    [46, 76, 120, 26, 1, 2], // slums: a dense spatter
    [100, 30, 30, 26, 3, 6], // the far side
  ]) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      g.fillStyle = ['#3a3b3f', '#44454a', '#34353a'][(rand() * 3) | 0];
      g.fillRect((cx + Math.cos(a) * d) | 0, (cy + Math.sin(a) * d * 0.9) | 0, s0 + ((rand() * ds) | 0), Math.max(1, s0 - 1) + ((rand() * ds * 0.7) | 0));
    }
  }
  // a stream across the middle
  const streamY = (x) => 112 + Math.sin(x / 26 + 1) * 8 + Math.sin(x / 9) * 2;
  g.fillStyle = '#2b3740';
  for (let x = 0; x < W; x++) g.fillRect(x, streamY(x) | 0, 1, 3);
  // roads: the trunk road on out from the gate, bending; branches off it
  g.fillStyle = '#c9c6bd';
  const trunk = (y) => GATE_X * W + Math.sin((Hc - y) / 40) * 22 - (Hc - y) * 0.12;
  for (let y = 0; y < Hc - 8; y++) g.fillRect(trunk(y) | 0, y, 2, 1);
  g.fillStyle = '#8a877f';
  for (let x = 0; x < W; x++) {
    g.fillRect(x, (196 - x * 0.18) | 0, 1, 1);
    if (x > 60) g.fillRect(x, (140 + (x - 60) * 0.1) | 0, 1, 1);
    if (x < 110) g.fillRect(x, (58 + x * 0.22) | 0, 1, 1);
  }
  // a rail line through the industrial district
  g.fillStyle = '#5a5850';
  for (let x = 80; x < W; x++) {
    const y = (150 - (x - 80) * 0.35) | 0;
    g.fillRect(x, y, 1, 1);
    if (x % 3 === 0) g.fillRect(x, y - 1, 1, 3);
  }
  // enemy ground everywhere out here
  g.fillStyle = '#5a1f1c';
  for (let y = 0; y < Hc - 12; y += 4) for (let x = (y / 2) % 4 | 0; x < W; x += 6) if (rand() < 0.8) g.fillRect(x, y, 1, 1);
  g.fillStyle = '#ff3b2f';
  for (const [x, y] of [[40, 190], [90, 176], [124, 132], [140, 150], [60, 80], [30, 64], [110, 30]]) {
    g.fillRect(x - 1, y - 1, 1, 1);
    g.fillRect(x + 1, y - 1, 1, 1);
    g.fillRect(x, y, 1, 1);
    g.fillRect(x - 1, y + 1, 1, 1);
    g.fillRect(x + 1, y + 1, 1, 1);
  }
  route(g, W, Hc, 1);
  // the city wall along the bottom (the same wall the city's page has along
  // its top), its gate open
  g.fillStyle = '#6d6a64';
  for (let x = 0; x < W; x++) g.fillRect(x, Hc - 8 + (((x / 7) | 0) % 2), 1, 3);
  g.fillStyle = '#1b1c1f';
  g.fillRect(GATE_X * W - 7, Hc - 9, 14, 6);
  g.fillStyle = '#d8d4cb';
  for (const [x, y, sx, sy] of [[2, 2, 1, 1], [W - 3, 2, -1, 1], [2, Hc - 3, 1, -1], [W - 3, Hc - 3, -1, -1]]) {
    g.fillRect(Math.min(x, x + sx * 8), y, 8, 1);
    g.fillRect(x, Math.min(y, y + sy * 8), 1, 8);
  }
  return c;
}

// The briefing screen's campaign map, drawn small and shown big: a grey
// city plan in white roads, the river through it, enemy ground hatched red,
// the route north from level to level.
function campaignMap() {
  const W = 160;
  const Hc = 240;
  const [c, g] = canvas(W, Hc);
  let seed = 41;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  g.fillStyle = '#1b1c1f';
  g.fillRect(0, 0, W, Hc);
  g.fillStyle = '#232428';
  for (let x = 0; x < W; x += 10) g.fillRect(x, 0, 1, Hc);
  for (let y = 0; y < Hc; y += 10) g.fillRect(0, y, W, 1);
  // city blocks, in districts
  for (const [cx, cy, n, r] of [[44, 200, 46, 30], [110, 150, 40, 30], [50, 92, 40, 28], [112, 40, 34, 26], [130, 214, 14, 16], [20, 140, 16, 16]]) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      g.fillStyle = ['#3a3b3f', '#44454a', '#34353a'][(rand() * 3) | 0];
      g.fillRect((cx + Math.cos(a) * d) | 0, (cy + Math.sin(a) * d * 0.9) | 0, 3 + ((rand() * 6) | 0), 2 + ((rand() * 5) | 0));
    }
  }
  // the river, winding across low down
  const riverY = (x) => 172 + Math.sin(x / 22) * 10 + Math.sin(x / 7) * 2;
  g.fillStyle = '#2b3740';
  for (let x = 0; x < W; x++) g.fillRect(x, riverY(x) | 0, 1, 6);
  // roads in off-white: the avenue up the middle, cross streets
  g.fillStyle = '#c9c6bd';
  for (let y = 0; y < Hc; y++) g.fillRect((48 + Math.sin(y / 30) * 6) | 0, y, 2, 1);
  for (const y of [60, 128, 206]) g.fillRect(0, y, W, 1);
  g.fillStyle = '#8a877f';
  for (let x = 0; x < W; x++) g.fillRect(x, (20 + x * 0.25) | 0, 1, 1);
  // enemy ground: red hatching over the north, the front line dashed
  g.fillStyle = '#5a1f1c';
  for (let y = 0; y < 118; y += 4) for (let x = (y / 2) % 4 | 0; x < W; x += 6) if (rand() < 0.8) g.fillRect(x, y, 1, 1);
  g.fillStyle = '#ff3b2f';
  for (let x = 0; x < W; x += 6) g.fillRect(x, (118 + Math.sin(x / 15) * 4) | 0, 4, 1);
  for (const [x, y] of [[40, 186], [70, 196], [58, 176], [118, 140], [92, 160], [44, 80], [120, 30]]) {
    g.fillRect(x - 1, y - 1, 1, 1);
    g.fillRect(x + 1, y - 1, 1, 1);
    g.fillRect(x, y, 1, 1);
    g.fillRect(x - 1, y + 1, 1, 1);
    g.fillRect(x + 1, y + 1, 1, 1);
  }
  // the route between the levels: dashed white
  route(g, W, Hc, 0);
  // the city wall across the top, the way out through its gate
  g.fillStyle = '#6d6a64';
  for (let x = 0; x < W; x++) g.fillRect(x, 4 + ((x / 7) | 0) % 2, 1, 3);
  g.fillStyle = '#1b1c1f';
  g.fillRect(GATE_X * W - 7, 3, 14, 6);
  // corner brackets
  g.fillStyle = '#d8d4cb';
  for (const [x, y, sx, sy] of [[2, 2, 1, 1], [W - 3, 2, -1, 1], [2, Hc - 3, 1, -1], [W - 3, Hc - 3, -1, -1]]) {
    g.fillRect(Math.min(x, x + sx * 8), y, 8, 1);
    g.fillRect(x, Math.min(y, y + sy * 8), 1, 8);
  }
  return c;
}

export function createHub({ renderer, pixel, onDeploy }) {
  const style = document.createElement('style');
  style.textContent = CSS + TRACK_CSS;
  document.head.append(style);

  // ------------------------------------------------------------ scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a0e);
  setLowPoly(true);
  const B = new LevelBuilder(scene, 777);
  const rand = B.rand;
  scene.add(new THREE.HemisphereLight(0x6c7590, 0x1c1814, 1.15));
  const key = new THREE.DirectionalLight(0xffe0b8, 0.8);
  key.position.set(0, 16, 8);
  key.target.position.set(6, 0, -5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 50 });
  scene.add(key, key.target);

  // ------------------------------------------------------------ rooms
  // rect: [x0, x1, z0, z1]. Walls toward the camera (west and south) are
  // kept low, the far ones full height.
  const ROOMS = [
    { id: 'quarters', name: 'Crew', rect: [-8, 4, -17, -6], focus: new THREE.Vector3(-2, 0, -11.5), view: 12, label: new THREE.Vector3(-2, 4.4, -16.8), entry: new THREE.Vector3(1, 0, -7.2) },
    { id: 'briefing', name: 'Levels', rect: [-12, -2, -5, 7], focus: new THREE.Vector3(-7, 0, 1), view: 11, label: new THREE.Vector3(-7, 3.0, -4.6), entry: new THREE.Vector3(-3.2, 0, 1.5) },
    { id: 'hangar', name: 'Hangar', rect: [6, 24, -8, 8], focus: new THREE.Vector3(15, 0.4, 0), view: 8.5, label: new THREE.Vector3(15, 5.8, -7.8), entry: new THREE.Vector3(7.4, 0, 0.5) },
    // off the hall's front: the ready room for Endless (its own door out)
    { id: 'endless', name: 'Endless', rect: [-2, 6, 8.4, 15.6], focus: new THREE.Vector3(2, 0, 12), view: 9, label: new THREE.Vector3(2, 3.2, 8.6), entry: new THREE.Vector3(2, 0, 9.6) },
  ];
  const HALL = [-2, 6, -6, 8];
  const floorMeshes = [];
  const floor = (rect, map, room = null) => {
    const [x0, x1, z0, z1] = rect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshToonMaterial({ map, gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    m.receiveShadow = true;
    m.userData.room = room;
    B.add(m);
    floorMeshes.push(m);
    return m;
  };
  const size = (r) => [r[1] - r[0], r[3] - r[2]];
  floor(ROOMS[0].rect, planksTexture(rand, ...size(ROOMS[0].rect)), ROOMS[0]);
  floor(ROOMS[1].rect, floorTexture(rand, ...size(ROOMS[1].rect), { base: '#3f4a48', specks: ['#46524f', '#38423f'], seam: '#323b39', tile: 1.5, stains: 0.05 }), ROOMS[1]);
  floor(ROOMS[2].rect, floorTexture(rand, ...size(ROOMS[2].rect), { stains: 0.25 }), ROOMS[2]);
  floor(HALL, floorTexture(rand, ...size(HALL), { base: '#4a4844', tile: 2 }));
  floor(ROOMS[3].rect, floorTexture(rand, ...size(ROOMS[3].rect), { base: '#33373b', specks: ['#3a3f44', '#2d3135'], seam: '#25292c', tile: 1.2, stains: 0.08 }), ROOMS[3]);
  floor([1, 3, 8.1, 8.5], floorTexture(rand, 2, 0.4, { base: '#4a4844' })); // the doorway
  floor([-12, -2, -6, -5], floorTexture(rand, 10, 1, {})); // under the broken wall
  const under = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), toon(0x141316));
  under.rotation.x = -Math.PI / 2;
  under.position.set(6, -0.02, -5);
  B.add(under);

  const WALL = 0x6f6c66;
  const wall = (x0, z0, x1, z1, h = H) => {
    const w = Math.max(0.4, Math.abs(x1 - x0));
    const d = Math.max(0.4, Math.abs(z1 - z0));
    const m = B.chunk(w, h, d, WALL, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    B.block((x0 + x1) / 2, (z0 + z1) / 2, w / 2, d / 2);
    if (h > 2) B.piece(w + 0.01, 1.2, d + 0.01, 0x4e5a52, (x0 + x1) / 2, 0.6, (z0 + z1) / 2);
    B.piece(w + 0.02, 0.08, d + 0.02, 0x8d8b86, (x0 + x1) / 2, h, (z0 + z1) / 2);
    return m;
  };
  // tall far walls
  wall(-8, -17.2, 4, -17.2); // quarters back
  wall(4.2, -17, 4.2, -6); // quarters' east side
  wall(4, -6.2, 6, -6.2); // hall back
  wall(6, -8.2, 24, -8.2, HH); // hangar back
  wall(5.8, -8, 5.8, -4, HH); // hangar / hall
  wall(24.2, -8, 24.2, -3.4, HH); // hangar east, either side of the blast door
  wall(24.2, 3.4, 24.2, 8, HH);
  B.chunk(0.4, HH - 4, 6.8, WALL, 24.2, 4 + (HH - 4) / 2, 0);
  // low walls toward the camera (cutaway)
  wall(-8.2, -17, -8.2, -6, 0.9);
  wall(-12.2, -5, -12.2, 7, 0.9);
  wall(-12, 7.2, -2, 7.2, 0.9);
  wall(-2, 8.2, 1, 8.2, 0.9); // (a doorway through to the Endless room)
  wall(3, 8.2, 6, 8.2, 0.9);
  // the Endless room: low walls toward the camera, a tall one at its back
  // (east) with the blast door out
  wall(-2.2, 8.2, -2.2, 15.8, 0.9);
  wall(-2, 15.8, 6, 15.8, 0.9);
  wall(6.2, 8.4, 6.2, 15.8);
  wall(6, 8.2, 24, 8.2, 0.9);
  wall(5.8, 5, 5.8, 8, 0.9);
  // the broken wall between quarters and briefing: a ragged top, rubble
  {
    const z = -5.5;
    let x = -12;
    while (x < -2) {
      const w = Math.min(-2 - x, 0.8 + rand() * 1.2);
      const h = 1.2 + rand() * 1.6;
      B.chunk(w, h, 0.5, WALL, x + w / 2, h / 2, z);
      B.piece(w, 0.6, 0.52, 0x4e5a52, x + w / 2, 0.3, z);
      x += w;
    }
    B.block(-7, z, 5, 0.3);
    for (let i = 0; i < 10; i++) B.lump(-11 + rand() * 9, 0.12, z + (rand() < 0.5 ? -0.6 : 0.6), 0.22 + rand() * 0.2, 0.14, 0.2, 0x6f6c66, rand() * 3);
  }
  // pillars at the openings
  for (const [x, z, h] of [[-2, -5.5, H], [-2, 7, 0.9], [4, -6, H], [5.8, -4, HH], [5.8, 5, HH]]) {
    B.chunk(0.6, h + 0.2, 0.6, 0x8d8b86, x, (h + 0.2) / 2, z);
    B.block(x, z, 0.3, 0.3);
  }

  // ceiling beams with pendant lamps hung off them (no lamps in mid-air)
  const pendant = (x, z, beamY, drop = 1.2, warm = SODIUM, power = 14, parent = B.root) => {
    parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, beamY, z), new THREE.Vector3(x, beamY - drop, z)]), B.lineMat));
    put(parent, cyl(0.28, 0.16, 0x2e3034, { seg: 8, radiusEnd: 0.1 }), x, beamY - drop - 0.04, z);
    put(parent, cyl(0.16, 0.05, warm, { seg: 8, glow: true }), x, beamY - drop - 0.12, z);
    B.emit(new THREE.Vector3(x, beamY - drop - 0.6, z), warm, power, 8);
    B.pool(x, z, 2.4, warm, 0.14);
  };
  const beamZ = (x, z0, z1, y, parent = B.root) => {
    put(parent, box(0.26, 0.3, z1 - z0, 0x3a3c3f), x, y, (z0 + z1) / 2);
    put(parent, box(0.4, 0.05, z1 - z0, 0x2c2e31), x, y - 0.16, (z0 + z1) / 2);
  };
  const beamX = (z, x0, x1, y) => {
    B.chunk(x1 - x0, 0.3, 0.26, 0x3a3c3f, (x0 + x1) / 2, y, z);
    B.piece(x1 - x0, 0.05, 0.4, 0x2c2e31, (x0 + x1) / 2, y - 0.16, z);
  };

  // -------------------------------------------------------------- props
  const crate = (x, y, z, s = 0.8, color = 0x7a5f3e, yaw = 0) => {
    const g = new THREE.Group();
    put(g, box(s, s * 0.8, s, color, { r: 0.02 }), 0, s * 0.4, 0);
    for (const dz of [-1, 1]) put(g, box(s + 0.04, 0.07, 0.06, 0x5c472e, { r: 0.01 }), 0, s * 0.4, dz * (s / 2 + 0.01)); // (straps stand proud of the faces)
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    return B.add(g);
  };
  // an ammo box, open with the rounds in it, or shut
  const ammoBox = (x, z, yaw, open = true) => {
    const g = new THREE.Group();
    put(g, box(1.1, 0.34, 0.5, 0x4f5a3a, { r: 0.02 }), 0, 0.17, 0);
    put(g, box(1.0, 0.04, 0.44, 0x2b2c2a), 0, 0.34, 0);
    if (open) {
      for (let i = 0; i < 4; i++) {
        put(g, cyl(0.055, 0.7, 0xb08a3e, { axis: 'x', seg: 8 }), -0.08, 0.36, -0.15 + i * 0.1);
        put(g, cyl(0.05, 0.22, 0x3f4144, { axis: 'x', seg: 8, radiusEnd: 0.02 }), 0.4, 0.36, -0.15 + i * 0.1);
      }
      put(g, box(1.1, 0.04, 0.5, 0x4f5a3a, { r: 0.01 }), 0, 0.5, -0.36).rotation.x = -1.1; // the lid up
    } else put(g, box(1.12, 0.05, 0.52, 0x46502f, { r: 0.01 }), 0, 0.36, 0);
    put(g, box(0.3, 0.02, 0.01, 0xc9b98a), 0.2, 0.2, 0.255); // stencilled band
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    return B.add(g);
  };
  // one round: a brass case, a dark green-grey projectile with a pointed
  // nose and a copper driving band, lying along local +x
  const round = (parent, x, y, z) => {
    put(parent, cyl(0.075, 0.46, 0xb08a3e, { axis: 'x', seg: 10 }), x, y, z);
    put(parent, cyl(0.08, 0.03, 0x8a6a2e, { axis: 'x', seg: 10 }), x - 0.23, y, z); // rim
    put(parent, cyl(0.068, 0.04, 0xa0603a, { axis: 'x', seg: 10 }), x + 0.25, y, z); // driving band
    put(parent, cyl(0.066, 0.16, 0x4a5240, { axis: 'x', seg: 10 }), x + 0.35, y, z);
    put(parent, cyl(0.064, 0.16, 0x4a5240, { axis: 'x', seg: 10, radiusEnd: 0.012 }), x + 0.51, y, z); // the nose (narrow end out along +x)
  };
  // a steel rack of rounds, three tiers, noses out
  const ammoRack = (x, z, yaw) => {
    const g = new THREE.Group();
    for (const sx of [-0.45, 0.25]) for (const sz of [-0.42, 0.42]) put(g, box(0.05, 1.1, 0.05, 0x3a3c3f), sx, 0.55, sz);
    for (let t = 0; t < 3; t++) {
      const y = 0.22 + t * 0.32;
      for (const sx of [-0.45, 0.25]) put(g, box(0.06, 0.04, 0.9, 0x45484c), sx, y - 0.09, 0);
      for (let k = 0; k < 5; k++) if (!(t === 2 && k > 2)) round(g, -0.12, y, -0.32 + k * 0.16);
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    B.add(g);
    B.block(x, z, 0.5, 0.5);
    return g;
  };
  const roadWheel = (x, y, z, yaw = 0, lean = 0) => {
    const g = new THREE.Group();
    put(g, cyl(0.42, 0.16, 0x4a4f3a, { axis: 'z', seg: 12 }), 0, 0, 0);
    put(g, cyl(0.44, 0.1, 0x1f2022, { axis: 'z', seg: 12 }), 0, 0, 0); // rubber tyre
    put(g, cyl(0.12, 0.2, 0x3a3c3f, { axis: 'z', seg: 8 }), 0, 0, 0);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      put(g, box(0.06, 0.06, 0.18, 0x3a4030), Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0);
    }
    g.position.set(x, y, z);
    g.rotation.set(lean, yaw, 0, 'YXZ');
    return B.add(g);
  };
  const drum = (x, z, color = 0x6b5843, tipped = false) => {
    const m = put(B.root, cyl(0.3, 0.85, color, { seg: 10 }), x, tipped ? 0.3 : 0.425, z);
    if (tipped) m.rotation.set(Math.PI / 2, 0, rand() * 3);
    else put(B.root, cyl(0.31, 0.04, 0x2b2c2e, { seg: 10 }), x, 0.6, z);
    B.block(x, z, 0.32, 0.32);
    return m;
  };
  // tall steel shelving, loaded with 'parts', 'boxes' or 'files'
  const shelving = (x, z, yaw, w = 2.2, fill = 'boxes', levels = 4) => {
    const g = new THREE.Group();
    const D = 0.55;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.05, levels * 0.55 + 0.1, 0.05, 0x5a5e62), sx * (w / 2 - 0.03), (levels * 0.55 + 0.1) / 2, sz * (D / 2 - 0.03));
    for (let l = 0; l < levels; l++) {
      const y = 0.12 + l * 0.55;
      put(g, box(w, 0.04, D, 0x4a4e52), 0, y, 0);
      let px = -w / 2 + 0.1;
      while (px < w / 2 - 0.25) {
        const r = rand();
        const pw = 0.18 + rand() * 0.4;
        if (px + pw > w / 2 - 0.08) break;
        if (r < 0.15) {
          px += pw;
          continue;
        }
        const cx = px + pw / 2;
        if (fill === 'files') {
          const n = 2 + ((rand() * 4) | 0);
          for (let k = 0; k < n; k++) put(g, box(0.06, 0.32 + rand() * 0.06, 0.34, [0xa89f84, 0x6d7a6a, 0x8a6a4a, 0x5a6a7a][(rand() * 4) | 0], { r: 0.005 }), px + k * 0.07, y + 0.2, 0).rotation.z = k === n - 1 ? 0.25 : 0;
          px += n * 0.07 + 0.08;
          continue;
        }
        if (fill === 'parts' && r < 0.4) {
          put(g, cyl(0.18, 0.12, 0x3f4436, { axis: 'z', seg: 10 }), cx, y + 0.2, 0); // a sprocket ring
        } else if (fill === 'parts' && r < 0.6) {
          put(g, cyl(0.1, 0.25, [0x8a5a3a, 0x56604f, 0x6a6e72][(rand() * 3) | 0], { seg: 8 }), cx, y + 0.15, 0); // cans
          put(g, cyl(0.1, 0.25, 0x56604f, { seg: 8 }), cx + 0.12, y + 0.15, 0.1);
        } else {
          const h = 0.18 + rand() * 0.25;
          put(g, box(pw, h, 0.4, [0x7a5f3e, 0x6b6045, 0x8a8172, 0x4f5a3a][(rand() * 4) | 0], { r: 0.01 }), cx, y + 0.02 + h / 2, 0);
        }
        px += pw + 0.05;
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    B.add(g);
    const along = Math.abs(Math.cos(yaw)) > 0.5;
    B.block(x, z, along ? w / 2 : D / 2, along ? D / 2 : w / 2);
    return g;
  };
  // loose sheets of paper on a surface
  const papers = (x, y, z, n = 3) => {
    for (let i = 0; i < n; i++) B.piece(0.26, 0.01, 0.34, [0xe2dccb, 0xd2c9b0, 0xc4b896][i % 3], x + (rand() - 0.5) * 0.3, y + 0.005 + i * 0.004, z + (rand() - 0.5) * 0.3, 0, rand() * 1.4, 0);
  };
  const table = (x, z, w, d, h = 0.8, color = 0x4a3a2a) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.piece(0.08, h, 0.08, 0x3a3c3f, x + sx * (w / 2 - 0.1), h / 2, z + sz * (d / 2 - 0.1));
    B.chunk(w, 0.08, d, color, x, h, z);
    B.block(x, z, w / 2, d / 2);
    return h + 0.04;
  };

  // -------------------------------------------------------- the hangar
  let tank = null;
  let tankId = null;
  const LIFT = { x: 15, y: 0.3, z: 0 };
  const hangarOverhead = new THREE.Group();
  B.add(hangarOverhead);
  {
    const lx = 15;
    const lz = 0;
    // the lift, hazard-striped, and the painted bay round it
    B.chunk(6.8, 0.3, 4.6, 0x3d4044, lx, 0.15, lz);
    for (const s of [-1, 1]) B.piece(6.8, 0.04, 0.25, 0xc99a2e, lx, 0.32, lz + s * 2.15);
    for (let i = 0; i < 9; i++) B.piece(0.28, 0.02, 0.5, i % 2 ? 0x1f2022 : 0xc99a2e, lx - 4.1, 0.015, lz - 2.4 + i * 0.6);
    for (const s of [-1, 1]) B.piece(9.2, 0.02, 0.12, 0xc99a2e, lx, 0.015, lz + s * 3.4);
    B.block(lx, lz, 3.4, 2.3);
    // gantry crane over it: four legs, two runway beams, the bridge, a hoist.
    // It and the near roof beam stand between the camera and the tank, so
    // they're kept apart and hidden while the fitting screen is up.
    const G = hangarOverhead;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        put(G, box(0.26, 4.4, 0.26, 0xc99a2e), lx + sx * 4.3, 2.2, lz + sz * 3.2);
        B.block(lx + sx * 4.3, lz + sz * 3.2, 0.2, 0.2);
      }
    }
    for (const sz of [-1, 1]) put(G, box(8.9, 0.3, 0.3, 0xc99a2e), lx, 4.4, lz + sz * 3.2);
    put(G, box(0.36, 0.34, 6.7, 0xb08826), lx - 1.2, 4.7, lz);
    put(G, box(0.5, 0.4, 0.5, 0x2b2c2e), lx - 1.2, 4.35, lz - 0.6);
    G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(lx - 1.2, 4.15, lz - 0.6), new THREE.Vector3(lx - 1.2, 2.9, lz - 0.6)]), B.lineMat));
    put(G, box(0.22, 0.26, 0.16, 0xc99a2e), lx - 1.2, 2.8, lz - 0.6);
    // beams across the roof carrying the lamps, clear of the gantry
    for (const x of [8.6, 21.4]) {
      const parent = x < 10 ? G : B.root;
      beamZ(x, -8, 8, HH - 0.2, parent);
      pendant(x, -4.5, HH - 0.35, 1.4, SODIUM, 16, parent);
      pendant(x, 4.5, HH - 0.35, 1.4, SODIUM, 16, parent);
    }
    B.emit(new THREE.Vector3(lx, 3.4, lz), SODIUM, 18, 9);

    // back wall: two workbenches with a pegboard of tools, then shelving
    for (const bx of [8.4, 11.4]) {
      const top = table(bx, -7.45, 2.6, 0.9, 0.9, 0x5c4a34);
      B.chunk(2.6, 1.3, 0.06, 0x6b5d48, bx, 1.95, -8.0); // pegboard
      for (let k = 0; k < 7; k++) B.piece(0.05, 0.3 + rand() * 0.25, 0.04, [0x8d9196, 0xa3423a, 0x3a3c3f][k % 3], bx - 1.0 + k * 0.33, 1.95 + (rand() - 0.5) * 0.4, -7.95, 0, 0, (rand() - 0.5) * 0.6);
      put(B.root, box(0.5, 0.26, 0.3, 0xa3423a, { r: 0.02 }), bx + 0.7, top + 0.13, -7.4); // toolbox
      put(B.root, box(0.2, 0.22, 0.2, 0x3a4048, { r: 0.02 }), bx - 0.9, top + 0.11, -7.35); // vice
      papers(bx - 0.2, top, -7.35, 2);
      put(B.root, cyl(0.05, 0.16, 0x6b8a5a, { seg: 6 }), bx + 0.1, top + 0.08, -7.2); // a bottle
    }
    shelving(15.6, -7.6, 0, 2.4, 'parts');
    shelving(18.4, -7.6, 0, 2.4, 'parts');
    shelving(21.6, -7.6, 0, 2.6, 'boxes');
    // east wall: the blast door out, ammo stacked by it, spare road wheels
    {
      const dx = 24.0;
      B.chunk(0.3, 3.8, 6.6, 0x56606a, dx, 1.9, 0);
      for (let y = 0.3; y < 3.7; y += 0.34) B.piece(0.05, 0.05, 6.5, 0x434b54, dx - 0.18, y, 0);
      B.piece(0.1, 0.3, 7.0, 0xc99a2e, dx - 0.2, 4.0, 0);
      for (let i = 0; i < 12; i++) B.piece(0.06, 0.12, 0.5, i % 2 ? 0x1f2022 : 0xc99a2e, dx - 0.22, 0.2, -2.9 + i * 0.53);
      const beacon = B.keep(put(B.root, box(0.24, 0.2, 0.24, 0xffb02a, { glow: true }), dx - 0.2, 4.4, 3.6));
      B.animate((dt, t) => (beacon.rotation.y = t * 4));
    }
    ammoBox(22.6, -5.6, 0.1);
    ammoBox(22.7, -4.8, -0.05, false);
    ammoBox(22.6, -4.8, 0.05, false).position.y = 0.36;
    ammoBox(21.2, -5.3, 1.4);
    B.block(22.4, -5.1, 0.9, 0.7);
    ammoRack(20.3, -3.8, -Math.PI / 2);
    for (let i = 0; i < 3; i++) roadWheel(23.6, 0.44, 4.6 + i * 0.5, Math.PI / 2, -0.25);
    roadWheel(22.6, 0.08, 6.4, 0, -Math.PI / 2);
    roadWheel(22.6, 0.24, 6.4, 0.6, -Math.PI / 2);
    B.block(23.2, 5.4, 0.8, 1.4);
    // a run of spare track laid out on the floor
    for (let i = 0; i < 12; i++) B.piece(0.24, 0.06, 0.62, 0x3a3936, 16.6 + i * 0.26, 0.03, 6.6, 0, 0.05, 0);
    // an engine on a stand, drums, a tool cart, the welding set, crates
    {
      const ex = 19.8;
      const ez = 4.4;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.piece(0.08, 0.6, 0.08, 0xc99a2e, ex + sx * 0.6, 0.3, ez + sz * 0.35);
      B.chunk(1.4, 0.7, 0.8, 0x4a4f52, ex, 0.95, ez);
      for (let k = 0; k < 6; k++) B.piece(0.14, 0.22, 0.7, 0x3a3e42, ex - 0.5 + k * 0.2, 1.42, ez);
      put(B.root, cyl(0.16, 0.5, 0x3a3e42, { axis: 'x', seg: 8 }), ex + 0.9, 1.0, ez);
      B.block(ex, ez, 0.75, 0.45);
    }
    drum(7.0, 6.8, 0x6b5843);
    drum(7.7, 7.1, 0x56604f);
    drum(7.3, 6.0, 0x6b5843, true);
    put(B.root, box(0.9, 0.8, 0.55, 0xa3423a, { r: 0.03 }), 11.2, 0.45, 6.6); // tool cart
    for (const s of [-1, 1]) put(B.root, cyl(0.08, 0.1, 0x1f2022, { axis: 'z', seg: 6 }), 11.2 + s * 0.35, 0.08, 6.6);
    B.block(11.2, 6.6, 0.45, 0.3);
    for (const dx of [0, 0.3]) put(B.root, cyl(0.14, 1.3, dx ? 0x3f6b4a : 0x56606a, { seg: 8 }), 9.2 + dx, 0.65, 6.9); // gas bottles
    put(B.root, box(0.7, 0.6, 0.5, 0x4a5a6a, { r: 0.03 }), 9.4, 0.3, 6.3); // welder
    B.block(9.35, 6.6, 0.45, 0.45);
    crate(13.6, 0, 7.0, 0.9);
    crate(14.5, 0, 7.1, 0.8, 0x6b6045, 0.3);
    crate(13.8, 0.72, 7.0, 0.7, 0x7a5f3e, -0.2);
    B.block(14.0, 7.0, 0.95, 0.5);
    B.groundCable(10.2, 6.0, -1.2, 14, 0.5);
  }

  // ------------------------------------------------------- the briefing
  // The CIC table: a thick steel console with a lit glass top, a cold
  // holographic city standing over it, cyan rails round its edge.
  const holo = [];
  {
    const tx = -7;
    const tz = 1;
    const TW = 4.4;
    const TD = 2.8;
    B.chunk(TW, 0.9, TD, 0x2f3438, tx, 0.45, tz);
    B.chunk(TW - 0.5, 0.12, TD - 0.5, 0x23272a, tx, 0.06, tz); // plinth
    B.chunk(TW + 0.2, 0.12, TD + 0.2, 0x3d4449, tx, 0.96, tz); // rim
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) B.piece(0.4, 0.3, 0.02, 0x262b2e, tx - 1.6 + k * 0.64, 0.5, tz + s * (TD / 2 + 0.005)); // panels
      put(B.root, box(TW - 0.4, 0.03, 0.03, HOLO, { glow: true }), tx, 0.82, tz + s * (TD / 2 + 0.02)); // light strips
      put(B.root, box(0.03, 0.03, TD - 0.4, HOLO, { glow: true }), tx + s * (TW / 2 + 0.02), 0.82, tz);
    }
    for (let k = 0; k < 8; k++) put(B.root, box(0.06, 0.05, 0.02, [0xffb347, 0x6be08a, HOLO][k % 3], { glow: true }), tx - 1.9 + k * 0.12, 0.66, tz + TD / 2 + 0.02); // status lamps
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.3, TD - 0.3), new THREE.MeshBasicMaterial({ map: holoTexture(rand) }));
    glass.rotation.x = -Math.PI / 2;
    glass.position.set(tx, 1.03, tz);
    B.add(glass);
    B.block(tx, tz, TW / 2 + 0.1, TD / 2 + 0.1);
    // the hologram: blocks of the zone in cyan edges, a scan line sweeping
    const city = new THREE.Group();
    city.position.set(tx, 1.06, tz);
    const edgeMat = new THREE.LineBasicMaterial({ color: HOLO, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const fillMat = new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 14; i++) {
      const w = 0.25 + rand() * 0.35;
      const d = 0.2 + rand() * 0.3;
      const h = 0.15 + rand() * 0.5;
      const geo = new THREE.BoxGeometry(w, h, d);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      const f = new THREE.Mesh(geo, fillMat);
      e.position.set(-1.7 + rand() * 3.4, h / 2, (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.7));
      f.position.copy(e.position);
      city.add(e, f);
    }
    // the objective marker over the far end
    const mark = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.16)), new THREE.LineBasicMaterial({ color: 0xffb347 }));
    mark.position.set(1.5, 0.9, 0);
    city.add(mark);
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.06, TD - 0.4), new THREE.MeshBasicMaterial({ color: HOLO, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    scan.rotation.x = -Math.PI / 2;
    scan.position.y = 0.01;
    city.add(scan);
    scene.add(city);
    holo.push({ mark, scan, edgeMat });
    B.emit(new THREE.Vector3(tx, 1.8, tz), HOLO, 10, 5);
    B.pool(tx, tz, 3.2, HOLO, 0.1, { sx: 1.3 });
    // chairs round it, documents on its rim
    for (const [x, z, yaw] of [[tx - 2.7, tz, 0], [tx + 0.6, tz + 1.95, 1.4], [tx - 0.9, tz - 1.95, -1.6]]) {
      put(B.root, box(0.5, 0.08, 0.5, 0x3a3226, { r: 0.02 }), x, 0.48, z);
      put(B.root, box(0.08, 0.5, 0.5, 0x3a3226, { r: 0.02 }), x - Math.cos(yaw) * 0.22, 0.75, z + Math.sin(yaw) * 0.22).rotation.y = yaw;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.piece(0.05, 0.46, 0.05, 0x2b2c2e, x + sx * 0.2, 0.23, z + sz * 0.2);
    }
    papers(tx + 1.9, 1.02, tz - 1.25, 3);
    papers(tx - 2.0, 1.02, tz + 1.25, 2);
    // consoles along the broken wall: desks of screens
    for (let k = 0; k < 3; k++) {
      const cx = -10.6 + k * 1.6;
      const top = table(cx, -4.6, 1.4, 0.7, 0.8, 0x3a3e42);
      put(B.root, box(0.9, 0.62, 0.4, 0x2a2e31, { r: 0.03 }), cx, top + 0.31, -4.75);
      put(B.root, box(0.74, 0.46, 0.02, k === 1 ? 0xffb347 : HOLO, { glow: true }), cx, top + 0.33, -4.54);
      B.piece(0.5, 0.03, 0.16, 0x1f2022, cx, top + 0.02, -4.35); // keyboard
      papers(cx + 0.5, top, -4.4, 1);
    }
    // the radio set on the end, its handset, wires to the floor
    {
      const top = table(-4.0, -4.6, 1.3, 0.7, 0.8, 0x3a3e42);
      put(B.root, box(0.8, 0.5, 0.4, 0x4d5a52, { r: 0.03 }), -4.1, top + 0.25, -4.7);
      for (let k = 0; k < 4; k++) put(B.root, cyl(0.04, 0.03, 0xd8d0b8, { axis: 'z', seg: 6 }), -4.4 + k * 0.18, top + 0.3, -4.49);
      B.keep(put(B.root, box(0.06, 0.06, 0.02, 0x6be08a, { glow: true }), -3.8, top + 0.4, -4.49));
      put(B.root, box(0.2, 0.08, 0.14, 0x2b2c2e, { r: 0.02 }), -3.6, top + 0.04, -4.3);
      B.groundCable(-3.6, -4.2, 1.2, 8, 0.4);
    }
    // filing cabinets and a shelf of binders in the west corner, a map board
    for (let k = 0; k < 2; k++) {
      B.chunk(0.6, 1.3, 0.6, 0x5a6060, -11.5, 0.65, 3.0 + k * 0.65);
      for (let d = 0; d < 3; d++) B.piece(0.02, 0.05, 0.25, 0x2b2c2e, -11.19, 0.3 + d * 0.4, 3.0 + k * 0.65);
    }
    B.block(-11.5, 3.3, 0.3, 0.65);
    papers(-11.5, 1.31, 3.0, 3);
    shelving(-11.6, 5.6, Math.PI / 2, 2.0, 'files', 3);
    {
      const g = new THREE.Group();
      put(g, box(1.8, 1.2, 0.06, 0x3a3226, { r: 0.02 }), 0, 1.5, 0);
      for (let i = 0; i < 7; i++) put(g, box(0.36, 0.28, 0.01, [0xe2dccb, 0xd2c9b0, 0xc4b896][i % 3]), -0.6 + (i % 4) * 0.4, 1.7 - (i >> 2) * 0.4, 0.04).rotation.z = (rand() - 0.5) * 0.2;
      put(g, box(0.06, 1.0, 0.06, 0x2b2c2e), -0.7, 0.5, 0);
      put(g, box(0.06, 1.0, 0.06, 0x2b2c2e), 0.7, 0.5, 0);
      g.position.set(-3.4, 0, 5.8);
      g.rotation.y = -0.5;
      B.add(g);
      B.block(-3.4, 5.8, 0.8, 0.3, -0.5);
    }
    crate(-11.3, 0, -0.2, 0.7, 0x4f5a3a);
    crate(-11.3, 0.56, -0.3, 0.55, 0x4f5a3a, 0.4);
    B.block(-11.3, -0.2, 0.4, 0.4);
    beamX(1, -12, -2, H - 0.2);
    pendant(-9.6, 1, H - 0.35, 1.0, SODIUM, 10);
    pendant(-4.4, 1, H - 0.35, 1.0, SODIUM, 10);
  }

  // ------------------------------------------------------- the quarters
  {
    // three double bunks along the back wall, a footlocker at each
    for (const x of [-6.4, -3.0, 0.4]) {
      for (const y of [0.45, 1.55]) {
        B.chunk(2.4, 0.16, 1.0, 0x3d4434, x, y, -16.4);
        B.piece(2.2, 0.12, 0.9, [0x6d7458, 0x5f6a4a, 0x6a6650][(rand() * 3) | 0], x, y + 0.14, -16.4);
        B.piece(0.5, 0.12, 0.7, 0xb8b4a8, x - 0.8, y + 0.22, -16.4);
        if (rand() < 0.6) B.piece(1.0, 0.08, 0.92, 0x4a5a3a, x + 0.3 + rand() * 0.3, y + 0.24, -16.35, 0, (rand() - 0.5) * 0.3, 0); // a blanket
      }
      for (const dx of [-1.15, 1.15]) B.piece(0.08, 1.9, 0.08, 0x3a3c3f, x + dx, 0.95, -15.95);
      B.block(x, -16.4, 1.2, 0.55);
      put(B.root, box(0.9, 0.42, 0.5, 0x4f5a3a, { r: 0.03 }), x, 0.21, -15.4);
      B.block(x, -15.4, 0.45, 0.25);
    }
    // lockers down the east wall, coats on hooks, a helmet on top
    for (let i = 0; i < 4; i++) {
      B.chunk(0.5, 1.9, 0.6, [0x4f5a55, 0x56606a][i % 2], 3.7, 0.95, -15.6 + i * 0.65);
      B.piece(0.02, 0.6, 0.02, 0x2b2c2e, 3.44, 1.3, -15.6 + i * 0.65 + 0.2);
    }
    B.block(3.7, -14.6, 0.3, 1.3);
    put(B.root, box(0.3, 0.16, 0.3, 0x2f2b26, { r: 0.06 }), 3.7, 1.98, -14.9);
    for (let i = 0; i < 3; i++) B.piece(0.1, 0.9, 0.42, [0x5f6b46, 0x4a553a, 0x6a5a40][i], 3.95, 1.6, -11.6 + i * 0.6, 0, 0, 0.05);
    // the stove in the corner, its flue going up, a kettle on it
    put(B.root, cyl(0.36, 0.9, 0x3a3634, { seg: 10 }), -7.2, 0.45, -8.0);
    put(B.root, cyl(0.1, 3.4, 0x2b2c2e, { seg: 8 }), -7.2, 2.6, -8.0);
    put(B.root, cyl(0.14, 0.18, 0x6a6e72, { seg: 8 }), -7.15, 1.0, -7.9);
    B.block(-7.2, -8.0, 0.4, 0.4);
    const glowDoor = B.keep(put(B.root, box(0.24, 0.16, 0.04, 0xff8a3a, { glow: true }), -7.0, 0.4, -7.66));
    const fire = B.emit(new THREE.Vector3(-6.8, 0.8, -7.6), 0xff9a40, 12, 6);
    B.animate((dt, t) => {
      const k = 0.8 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08;
      fire.level = k;
      glowDoor.scale.y = k;
    });
    for (let i = 0; i < 6; i++) B.piece(0.4 + rand() * 0.2, 0.1, 0.12, 0x6b5640, -7.6 + rand() * 0.4, 0.05 + i * 0.1, -9.2, 0, rand() * 0.4, 0); // firewood
    // the table: mugs, cards, a lamp; benches either side
    const top = table(-1.6, -10.2, 2.4, 1.2, 0.78, 0x5a4632);
    for (const s of [-1, 1]) {
      B.chunk(2.2, 0.08, 0.36, 0x4a3a2a, -1.6, 0.46, -10.2 + s * 0.95);
      for (const dx of [-0.9, 0.9]) B.piece(0.06, 0.44, 0.3, 0x3a2c1f, -1.6 + dx, 0.22, -10.2 + s * 0.95);
    }
    for (const [x, z] of [[-2.2, -10.0], [-0.9, -10.4], [-1.4, -9.85]]) put(B.root, cyl(0.07, 0.12, [0xd8d0b8, 0x56604f, 0x8a5a3a][(rand() * 3) | 0], { seg: 8 }), x, top + 0.06, z);
    for (let i = 0; i < 5; i++) B.piece(0.12, 0.01, 0.17, 0xe2dccb, -1.8 + rand() * 0.6, top + 0.005, -10.3 + rand() * 0.4, 0, rand() * 3, 0); // cards
    put(B.root, box(0.2, 0.3, 0.2, 0x3a3634, { r: 0.03 }), -0.7, top + 0.15, -10.0);
    B.keep(put(B.root, box(0.1, 0.12, 0.1, 0xffc070, { glow: true }), -0.7, top + 0.24, -9.88));
    B.emit(new THREE.Vector3(-0.7, top + 0.6, -10.0), SODIUM, 6, 4);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), toon(0x5a3a2a));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-1.6, 0.01, -10.2);
    B.add(rug);
    // crates with a radio on them, a washing line across the corner
    crate(-6.9, 0, -13.2, 0.8);
    crate(-6.9, 0.64, -13.2, 0.7, 0x6b6045, 0.3);
    put(B.root, box(0.4, 0.26, 0.2, 0x4d5a52, { r: 0.03 }), -6.9, 1.33, -13.2);
    B.block(-6.9, -13.2, 0.45, 0.45);
    B.sagging(new THREE.Vector3(-7.9, 2.5, -14.6), new THREE.Vector3(-4.6, 2.5, -16.9), 0.3);
    for (let i = 0; i < 3; i++) B.piece(0.45, 0.55, 0.04, [0x8a8578, 0x5f6b46, 0xb8b4a8][i], -7.3 + i * 0.8, 1.98, -15.0 - i * 0.56, 0, 0.6, 0);
    beamX(-11.5, -8, 4, H - 0.2);
    pendant(-4.5, -11.5, H - 0.35, 1.1, SODIUM, 10);
    pendant(1.2, -11.5, H - 0.35, 1.1, SODIUM, 10);
  }

  // ----------------------------------------------------------- the hall
  {
    crate(4.6, 0, -5.3, 0.9);
    crate(5.3, 0, -5.4, 0.7, 0x6b6045, 0.4);
    crate(4.8, 0.72, -5.3, 0.6, 0x7a5f3e, -0.3);
    B.block(4.9, -5.3, 0.8, 0.5);
    for (let i = 0; i < 6; i++) B.lump(-1.2 + i * 0.55, 0.2 + (i % 2) * 0.25, 7.5, 0.36, 0.18, 0.24, 0x8a7b5c);
    B.block(0.2, 7.5, 1.7, 0.3);
    for (let i = 0; i < 3; i++) put(B.root, box(0.24, 0.4, 0.14, 0x4f5a3a, { r: 0.02 }), 5.2, 0.2, 6.6 + i * 0.3); // fuel cans
    B.block(5.2, 6.9, 0.2, 0.5);
    B.groundCable(-1.5, 3, 0.1, 18, 0.5);
    beamX(1, -2, 6, H - 0.2);
    pendant(2, 1, H - 0.35, 1.0, SODIUM, 12);
  }
  // -------------------------------------------------- the Endless room
  // A ready room: a pair of terminals and a tall status screen on the back
  // wall, a rack of shells and ammo crates, a shelf of parts, lockers and a
  // bench, and the striped blast door out to the arena, a red lamp over it.
  const endlessFx = { lamp: null, screens: [] };
  {
    // the blast door in the back wall, its frame, the stripes, the lamp
    const dz = 12;
    B.chunk(0.18, 3.2, 3.6, 0x3e4246, 6.0, 1.6, dz);
    for (let i = 0; i < 6; i++) put(B.root, box(0.04, 0.32, 3.4, i % 2 ? 0x1d1f22 : 0xd9b23a), 5.9, 0.3 + i * 0.5, dz).rotation.x = 0;
    for (const s of [-1, 1]) B.chunk(0.3, 3.5, 0.3, 0x8d8b86, 6.0, 1.75, dz + s * 1.95);
    B.chunk(0.3, 0.3, 4.2, 0x8d8b86, 6.0, 3.45, dz);
    put(B.root, box(0.06, 0.12, 1.6, 0x2a2e31), 5.86, 1.7, dz); // the seam down the middle
    endlessFx.lamp = put(B.root, cyl(0.14, 0.18, 0xff3b2f, { seg: 8, glow: true }), 5.9, 3.85, dz);
    B.keep(endlessFx.lamp);
    B.emit(new THREE.Vector3(5.4, 3.4, dz), 0xff4a3a, 8, 4);
    put(B.root, box(0.04, 0.3, 1.4, 0xd9b23a), 5.88, 3.0, dz - 1.2).visible = true; // a stencilled plate
    // terminals along the back wall either side of the door
    for (const [z, col] of [[9.4, HOLO], [14.6, 0xffb347]]) {
      const top = table(5.3, z, 0.8, 1.4, 0.8, 0x3a3e42);
      put(B.root, box(0.4, 0.62, 0.9, 0x2a2e31, { r: 0.03 }), 5.55, top + 0.31, z);
      const scr = put(B.root, box(0.02, 0.46, 0.74, col, { glow: true }), 5.34, top + 0.33, z);
      B.keep(scr);
      endlessFx.screens.push(scr);
      B.piece(0.16, 0.03, 0.5, 0x1f2022, 5.05, top + 0.02, z); // keyboard
      for (let k = 0; k < 5; k++) B.keep(put(B.root, box(0.02, 0.05, 0.06, [0x6be08a, 0xffb347, HOLO][k % 3], { glow: true }), 5.34, top + 0.04, z - 0.3 + k * 0.15));
    }
    // a tall status screen on the room's north side: the wave graph
    {
      const g = new THREE.Group();
      put(g, box(1.6, 1.0, 0.1, 0x2a2e31, { r: 0.03 }), 0, 1.7, 0);
      const scr = put(g, box(1.44, 0.84, 0.02, 0x0d2a30), 0, 1.7, 0.06);
      for (let k = 0; k < 8; k++) {
        const h = 0.12 + k * 0.08 + (k % 3) * 0.04;
        put(g, box(0.1, h, 0.01, HOLO, { glow: true }), -0.56 + k * 0.16, 1.32 + h / 2, 0.08);
      }
      endlessFx.screens.push(scr);
      put(g, box(0.06, 1.2, 0.06, 0x2b2c2e), -0.6, 0.6, 0);
      put(g, box(0.06, 1.2, 0.06, 0x2b2c2e), 0.6, 0.6, 0);
      g.position.set(-0.8, 0, 8.9);
      B.add(g);
      B.block(-0.8, 8.9, 0.8, 0.15);
    }
    // the shell rack: rounds standing in a frame, and ammo crates
    {
      const rx = 4.2;
      const rz = 15.0;
      B.chunk(1.8, 0.08, 0.5, 0x4a4e52, rx, 0.5, rz);
      B.chunk(1.8, 0.08, 0.5, 0x4a4e52, rx, 0.05, rz);
      for (let k = 0; k < 8; k++) {
        put(B.root, cyl(0.07, 0.5, 0xb08a3e, { seg: 8 }), rx - 0.75 + k * 0.21, 0.35, rz);
        put(B.root, cyl(0.055, 0.25, 0x4f5a3a, { seg: 8, radiusEnd: 0.03 }), rx - 0.75 + k * 0.21, 0.72, rz);
      }
      B.block(rx, rz, 0.95, 0.3);
      crate(1.6, 0, 15.0, 0.7, 0x4f5a3a);
      crate(1.6, 0.56, 14.95, 0.55, 0x4f5a3a, 0.3);
      crate(0.6, 0, 15.05, 0.62, 0x5a5a3a, -0.2);
      B.block(1.2, 15.0, 0.9, 0.4);
    }
    // a shelf of parts against the west, lockers and a bench by the door through
    shelving(-1.6, 12.4, Math.PI / 2, 2.4, 'boxes', 3);
    for (let k = 0; k < 3; k++) {
      B.chunk(0.5, 1.7, 0.45, [0x4d5a52, 0x5a6060, 0x4d5a52][k], -1.65, 0.85, 14.0 + k * 0.52);
      B.piece(0.02, 0.12, 0.04, 0x2b2c2e, -1.39, 1.1, 14.0 + k * 0.52);
    }
    B.block(-1.65, 14.5, 0.3, 0.8);
    B.chunk(1.6, 0.1, 0.4, 0x5a4636, 1.0, 0.45, 10.6);
    for (const s of [-1, 1]) B.piece(0.08, 0.42, 0.34, 0x3a3c3f, 1.0 + s * 0.65, 0.21, 10.6);
    B.block(1.0, 10.6, 0.8, 0.2);
    papers(5.2, 0.84, 9.0, 2);
    // a lamp overhead
    beamX(12, -2, 6, H - 0.2);
    pendant(2, 12, H - 0.35, 1.0, 0xffd7a0, 12);
  }
  hangarOverhead.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  B.keep(hangarOverhead);
  B.finish();
  B.mergeStatic();
  setLowPoly(false);

  // lights: a fixed set at the emitters
  for (const e of B.emitters) {
    const l = new THREE.PointLight(e.color, e.intensity, e.distance, 1.4);
    l.position.copy(e.pos);
    scene.add(l);
    e.light = l;
  }

  // the tank up on the lift (the one you drive), with its saved loadout
  const hubParts = [];
  function fitHubTank() {
    const id = save.tank();
    if (id !== tankId) {
      tank?.group.removeFromParent();
      tankId = id;
      tank = TANKS[id].create();
      tank.group.position.set(LIFT.x, LIFT.y, LIFT.z);
      tank.group.name = 'hangar-tank';
      tank.group.rotation.y = Math.PI * 0.86;
      tank.update(0.016, 0, {});
      tank.group.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh) o.castShadow = true;
      });
      scene.add(tank.group);
    }
    for (const m of hubParts) m.removeFromParent();
    hubParts.length = 0;
    for (const id of save.loadout(tankId)) {
      if (!PARTS[id]) continue;
      const g = attachPart(tank, id);
      for (const o of [g, ...(g.userData.extra || [])]) o.traverse((m) => m.layers.disable(PLAYER_LAYER)); // no see-through outline here
      hubParts.push(g, ...(g.userData.extra || []));
    }
  }

  // room outlines, lit while hovered
  for (const r of ROOMS) {
    const [x0, x1, z0, z1] = r.rect;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, depthWrite: false });
    const T = 0.14;
    for (const [w, d, x, z] of [[x1 - x0, T, (x0 + x1) / 2, z0 + T / 2], [x1 - x0, T, (x0 + x1) / 2, z1 - T / 2], [T, z1 - z0, x0 + T / 2, (z0 + z1) / 2], [T, z1 - z0, x1 - T / 2, (z0 + z1) / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.05, z);
      g.add(m);
    }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    fill.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
    g.add(fill);
    g.visible = false;
    scene.add(g);
    r.outline = g;
    r.outlineMat = mat;
  }

  // ----------------------------------------------------------- crewman
  const crew = createCrew({ layer: PLAYER_LAYER, role: 'commander' });
  scene.add(crew.group);
  // a soft light that goes with him, so he reads anywhere in the gloom
  const fillLight = new THREE.PointLight(0xffe2c0, 6, 3.6, 1.6);
  fillLight.position.set(0.3, 2.0, 0.4);
  crew.group.add(fillLight);
  const me = crew.group.position;
  const HOME = new THREE.Vector3(2, 0, 2.5);
  me.copy(HOME);
  crew.group.rotation.y = Math.PI * 0.75;
  const crewBox = () => ({ x: me.x, z: me.z, hx: 0.25, hz: 0.25, yaw: 0 });

  // the rest of the crew, the driver and the gunner: same kit as you (no
  // outline), pottering round the quarters. Each strolls between a few
  // spots, stops, faces what's there (the stove, the radio, the lockers,
  // the table) and stands about for a while.
  const face = (dx, dz) => Math.atan2(-dz, dx);
  const MATES = [
    { role: 'Driver', spots: [[-6.2, -8.3, face(-1, 0.2)], [-6.0, -12.5, face(-1, -0.6)], [-3.4, -10.2, face(1, 0)], [-4.8, -14.6, face(0, -1)]] },
    { role: 'Gunner', spots: [[3.0, -13.6, face(1, 0)], [0.3, -10.2, face(-1, 0)], [1.6, -14.6, face(0, -1)], [-0.4, -8.0, face(-0.4, -1)]] },
  ];
  const mates = MATES.map((m, i) => {
    const c = createCrew({ role: m.role.toLowerCase() });
    const [x, z, yaw] = m.spots[i];
    c.group.position.set(x, 0, z);
    c.group.rotation.y = yaw;
    scene.add(c.group);
    return { ...m, c, at: i, wait: 2 + Math.random() * 5, to: null, speed: 0 };
  });
  function matesFrame(dt, t) {
    for (const m of mates) {
      const p = m.c.group.position;
      if (m.to) {
        const dx = m.to[0] - p.x;
        const dz = m.to[1] - p.z;
        const d = Math.hypot(dx, dz);
        m.speed = Math.min(0.42, m.speed + dt * 1.5);
        m.c.group.rotation.y = approachAngle(m.c.group.rotation.y, face(dx, dz), dt * 8);
        if (d < 0.08) {
          m.to = null;
          m.wait = 4 + Math.random() * 7;
        } else {
          const step = Math.min(d, WALK * m.speed * dt);
          p.x += (dx / d) * step;
          p.z += (dz / d) * step;
        }
      } else {
        m.speed = Math.max(0, m.speed - dt * 3);
        m.c.group.rotation.y = approachAngle(m.c.group.rotation.y, m.spots[m.at][2], dt * 4);
        m.wait -= dt;
        if (m.wait <= 0) {
          m.at = (m.at + 1 + ((Math.random() * (m.spots.length - 1)) | 0)) % m.spots.length;
          m.to = m.spots[m.at];
        }
      }
      m.c.update(dt, t, m.speed, WALK);
    }
  }
  const roomAt = (p) => ROOMS.find((r) => p.x > r.rect[0] + 0.3 && p.x < r.rect[1] - 0.3 && p.z > r.rect[2] + 0.3 && p.z < r.rect[3] - 0.3) || null;

  // -------------------------------------------------------------- UI
  const root = document.createElement('div');
  root.className = 'base';
  root.style.setProperty('--cursor', CURSOR);
  root.innerHTML = `
    <div class="base-bank panel px"><i></i>Scraps <b>0</b></div>
    <button type="button" class="base-gear panel px" aria-label="Settings"><i></i><span>Settings</span></button>
    ${ROOMS.map((r) => `<div class="base-tag" data-id="${r.id}">${r.name}</div>`).join('')}
    <div class="base-menu panel" hidden></div>
    <div class="base-crew panel" hidden></div>
    <div class="base-brief" hidden></div>
    <div class="base-endless panel" hidden></div>
    <div class="base-news panel" hidden></div>
    <div class="base-promo panel" hidden><span class="t">New tank</span><img alt=""><b>Beat level 2 for a new tank!</b><i></i></div>
    <div class="base-hint panel" ${matchMedia('(pointer: coarse)').matches ? 'hidden' : ''}>Click a room to open it, or walk in · <b>WASD</b> or click the floor to walk</div>
    <div class="base-fade"></div>
  `;
  // (every popup fits the screen, whatever its size)
  watchPopups(root, '.base-news, .base-endless, .base-menu, .base-crew, .base-promo');
  watchScreens(root, '.base-brief');
  const tags = new Map(ROOMS.map((r) => [r.id, root.querySelector(`.base-tag[data-id="${r.id}"]`)]));
  const menu = root.querySelector('.base-menu');
  const crewPanel = root.querySelector('.base-crew');
  const brief = root.querySelector('.base-brief');
  const endlessPanel = root.querySelector('.base-endless');
  const hint = root.querySelector('.base-hint');
  root.querySelector('.base-gear').style.setProperty('--cog', `url(${cogIcon()})`);
  root.querySelector('.base-gear').addEventListener('click', () => openSettings());
  root.querySelector('.base-gear').addEventListener('pointerdown', (e) => e.stopPropagation());
  const fade = root.querySelector('.base-fade');
  const bankEl = root.querySelector('.base-bank b');
  const news = root.querySelector('.base-news');
  // the next tank on offer: shown once level 1's beaten, until it's unlocked
  const promo = root.querySelector('.base-promo');
  promo.addEventListener('click', () => clickRoom(ROOMS.find((r) => r.id === 'briefing')));
  const promoTank = () => {
    const lv = CAMPAIGN.find((l) => l.first?.easy?.tank && !save.tanks().includes(l.first.easy.tank));
    const prev = lv && CAMPAIGN.find((l) => l.n === lv.n - 1);
    return lv && prev?.id && save.cleared().some((k) => k === prev.id || k === `${prev.id}:hard`) ? { tank: lv.first.easy.tank, n: lv.n } : null;
  };
  let promoOn = null;
  function refreshPromo() {
    promoOn = promoTank();
    if (!promoOn) return;
    promo.querySelector('img').src = tankPicture(renderer, promoOn.tank, 120, 70);
    promo.querySelector('b').textContent = `Beat level ${promoOn.n} for a new tank!`;
  }
  const fitting = createFitting({ renderer, cursor: CURSOR });
  const workshop = createWorkshop({ renderer, cursor: CURSOR });
  let freshTanks = []; // tanks unlocked since the hangar was last opened
  let open = null;
  let hover = null;
  let hoverTag = null;
  let lastRoom = null;
  let walkTo = null;
  for (const r of ROOMS) {
    const tag = tags.get(r.id);
    tag.addEventListener('pointerenter', () => (hoverTag = r));
    tag.addEventListener('pointerleave', () => hoverTag === r && (hoverTag = null));
    tag.addEventListener('click', () => clickRoom(r));
  }

  const bankTotal = () => save.bank();
  function openRoom(r) {
    open = r;
    hint.hidden = true;
    root.querySelector('.base-gear').hidden = true; // (out of the way of the room's panels)
    if (r.id === 'briefing') return openBriefing();
    if (r.id === 'endless') return openEndless();
    menu.hidden = false;
    if (r.id === 'hangar') {
      menu.hidden = true;
      return openFitting();
    }
    menu.hidden = true;
    return openCrew();
  }
  // the crew: three cards, a portrait each, rank and level, what they add;
  // train them up with scraps (a promotion every tenth level takes tokens)
  // their pictures: the crewman himself, as he walks round the base, shot
  // from the front (head and shoulders), once he's loaded
  const portraits = {};
  const portrait = (id) =>
    (portraits[id] ??= (() => {
      const c = createCrew({ role: id });
      return c.ready.then(() => {
        c.update(0.016, 0, 0);
        c.group.updateWorldMatrix(true, true);
        const view = { target: new THREE.Vector3(0, 1.0, 0), dir: new THREE.Vector3(1, 0.06, 0.3), half: 0.46 };
        return snapshotCanvas(renderer, c.group, 96, 96, null, view).toDataURL();
      });
    })());
  function openCrew() {
    crewPanel.hidden = false;
    const pct = (b) => `${b.minus ? '−' : '+'}${Math.round(b.value * 100)}%`;
    crewPanel.innerHTML = `<h2>Crew</h2><div class="cards">${CREW_IDS.map((id) => {
      const lvl = save.crewLevel(id);
      const max = lvl >= CREW_MAX;
      const c = crewCost(lvl);
      const can = !max && save.bank() >= c.scraps && save.tokens() >= c.tokens;
      const label = max ? 'Max' : `${promotesAt(lvl) ? 'Promote' : 'Train'} · ${c.scraps}${c.tokens ? ` + ${c.tokens} tokens` : ''}`;
      return `<div class="card" data-id="${id}"><div class="frame"><img class="pic" alt=""><span class="ri"></span></div><b>${CREW[id].name}</b>
        <div class="lvl">Level ${lvl} / ${CREW_MAX}</div>
        <div class="fx">${crewBonuses(id).map((b) => `<div><span>${b.label}</span><i>${pct(b)}</i></div>`).join('')}</div>
        <button type="button" class="train${promotesAt(lvl) && !max ? ' promote' : ''}" ${can ? '' : 'disabled'}>${label}</button></div>`;
    }).join('')}</div><button type="button" class="back">Back</button>`;
    for (const card of crewPanel.querySelectorAll('.card')) {
      const id = card.dataset.id;
      const ri = rankIcon(rankOf(save.crewLevel(id)));
      ri.title = RANKS[rankOf(save.crewLevel(id))];
      card.querySelector('.ri').replaceWith(ri);
      portrait(id).then((url) => (card.querySelector('.pic').src = url));
      card.querySelector('.train').addEventListener('click', () => {
        const lvl = save.crewLevel(id);
        const before = crewBonuses(id, lvl);
        if (!trainCrew(id)) return;
        bankEl.textContent = bankTotal();
        openCrew();
        const fresh = crewPanel.querySelector(`.card[data-id="${id}"] .frame`);
        // a new rank: the full show; else the portrait pops
        if (rankOf(lvl + 1) > rankOf(lvl)) {
          portrait(id).then((pic) =>
            ascend({
              pic,
              square: true,
              name: CREW[id].name,
              from: { name: `Level ${lvl}`, color: '#8fa3b8' },
              to: { name: `Level ${lvl + 1}`, color: '#f2d23a' },
              title: 'Promoted!',
              badge: rankIcon(rankOf(lvl + 1)),
              lines: crewBonuses(id).map((b, i) => ({ label: b.label, from: pct(before[i]), to: pct(b) })),
            }).then(() => {
              const f = crewPanel.querySelector(`.card[data-id="${id}"] .frame`);
              popFrames(f);
              if (f) fountain(f.getBoundingClientRect(), '#f2d23a', 30);
            }),
          );
        } else if (fresh) {
          popFrames(fresh);
          fountain(fresh.getBoundingClientRect(), '#6be08a', 22);
        }
      });
    }
    crewPanel.querySelector('.back').addEventListener('click', closeRoom);
  }
  // the briefing: the campaign map in the middle, the zone's details beside it
  // two pages: the city, and out past its wall. The map opens on the page
  // with the furthest level you can play; an arrow at its edge turns the
  // page (glowing when that's where your next level is).
  let selLevel = CAMPAIGN[0];
  const mapCanvases = [campaignMap(), outerMap()];
  let mapPage = 0;
  const pageOf = (z) => z.page || 0;
  const newest = () => [...CAMPAIGN].reverse().find((z) => isOpen(z, save.cleared())) || CAMPAIGN[0];
  function openBriefing() {
    // (back from the hangar: the level you had picked, as you left it)
    if (!keepBrief) selLevel = newest();
    keepBrief = false;
    mapPage = pageOf(selLevel);
    brief.hidden = false;
    brief.innerHTML = `<div class="map"></div><div class="info panel"></div>`;
    renderMap();
    showLevel(selLevel, true);
  }
  function renderMap() {
    const map = brief.querySelector('.map');
    const nodes = CAMPAIGN.filter((z) => pageOf(z) === mapPage);
    const next = newest();
    // the way to the other page: up off the top (out through the wall), or
    // back down off the bottom
    const turn = (dir) => {
      const to = mapPage + dir;
      if (to < 0 || to >= PAGES) return '';
      const glow = pageOf(next) === to && !save.cleared().includes(clearKey(next.id, 'easy'));
      const label = dir > 0 ? 'Next area' : 'Previous area';
      return `<button type="button" class="pageturn ${dir > 0 ? 'up' : 'down'}${glow ? ' glow' : ''}" data-to="${to}"><i></i><span>${label}</span>${glow ? '<em>New</em>' : ''}</button>`;
    };
    map.innerHTML = `${nodes.map((z) => `<button type="button" class="node ${isOpen(z, save.cleared()) ? 'open' : 'locked'}${allDone(z) ? ' alldone' : ''}" data-n="${z.n}" style="left:${z.at[0] * 100}%;top:${z.at[1] * 100}%">${z.n}${isOpen(z, save.cleared()) ? `<span class="stars">${stars(z)}</span>` : ''}${hardNext(z) ? hardTag(z) : newTank(z) ? tankTag(z) : newEquip(z) ? equipTag(z) : ''}</button>`).join('')}${turn(1)}${turn(-1)}`;
    map.prepend(mapCanvases[mapPage]);
    for (const b of map.querySelectorAll('.node')) b.addEventListener('click', () => showLevel(CAMPAIGN[b.dataset.n - 1], true));
    for (const b of map.querySelectorAll('.pageturn'))
      b.addEventListener('click', () => {
        mapPage = +b.dataset.to;
        renderMap();
        // on the new page: its furthest open level, else its first
        const here = CAMPAIGN.filter((z) => pageOf(z) === mapPage);
        showLevel([...here].reverse().find((z) => isOpen(z, save.cleared())) || here[0], true);
      });
  }
  // the Hard mode box; a level whose Hard first clear is a part shows it
  // under the words: its picture in a gold frame, its tier, its description
  // on hover
  // not yet beaten, and its first clear gives a tank: a green box over it
  // with that tank's picture
  const newTank = (z) => z.id && z.first?.easy?.tank && TANKS[z.first.easy.tank] && !save.cleared().includes(clearKey(z.id, 'easy'));
  const tankTag = (z) => `<span class="hardtag rich tanktag">New tank<small>First clear:</small><span class="rw tk"><img alt="" src="${tankPicture(renderer, z.first.easy.tank, 120, 70)}"></span><em>${esc(TANKS[z.first.easy.tank].name)}</em></span>`;
  // ... or new equipment: a cyan box with its icon, what it does on hover
  const newEquip = (z) => z.id && z.first?.easy?.equipment && EQUIPMENT[z.first.easy.equipment] && !save.cleared().includes(clearKey(z.id, 'easy')) && !save.ownedEquipment().includes(z.first.easy.equipment);
  const equipTag = (z) => {
    const id = z.first.easy.equipment;
    return `<span class="hardtag rich equiptag">New equipment<small>First clear:</small><span class="rw eq"><img alt="" src="${equipmentIcon(id)}"><div class="tip"><div class="fx-head">${esc(EQUIPMENT[id].name)}</div>${equipmentHtml(id)}</div></span><em>${esc(EQUIPMENT[id].name)}</em></span>`;
  };
  const hardTag = (z) => {
    const id = z.first?.hard?.part;
    if (!id || !PARTS[id]) return '<span class="hardtag">Hard mode</span>';
    return `<span class="hardtag rich">Hard mode<small>First clear:</small><span class="rw"><img alt="" src="${partIcon(id)}"><div class="tip">${partTip(id)}</div></span><em>Legendary</em></span>`;
  };
  // a part's hover box: its name, then what it does in green and red (a
  // part you own: what finding it again would add)
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function partTip(id) {
    const p = PARTS[id];
    const tank = p.only || save.tank();
    if (save.owned().includes(id)) {
      const up = improveTo(id);
      return `<div class="fx-head">▲ ${esc(p.name)} improvement</div>${up ? improvementHtml(id, tank) : '<div class="fx-how">Maxed for now: evolve it to improve it further.</div>'}`;
    }
    return `<div class="fx-head">${esc(p.name)}</div>${effectsHtml(id, tank, p.startLevel || 1)}`;
  }
  // beaten on Easy but not yet on Hard: a red "Hard mode" box over it
  // beaten on both: done (a muted blue, a tick)
  const allDone = (z) => z.id && ['easy', 'hard'].every((d) => save.cleared().includes(clearKey(z.id, d)));
  const hardNext = (z) => z.id && save.cleared().includes(clearKey(z.id, 'easy')) && !save.cleared().includes(clearKey(z.id, 'hard'));
  // a level's two stars on the map: Easy cleared (amber), Hard (red)
  const stars = (z) => ['easy', 'hard'].map((d) => `<i class="star ${d} ${save.cleared().includes(clearKey(z.id, d)) ? 'got' : ''}"></i>`).join('');
  // picked: just picked on the map (not a tab switch). A level already
  // beaten on Easy then opens on Hard.
  // (portrait: the details shrunk to fit under the map; landscape: beside
  // it, fitted to the screen's height)
  function fitBrief() {
    const info = brief.querySelector('.info');
    if (!info || brief.hidden) return;
    const tall = window.innerHeight > window.innerWidth && window.innerWidth <= 760;
    if (tall) {
      const map = brief.querySelector('.map').getBoundingClientRect();
      fitInside(info, window.innerWidth - 24, window.innerHeight - map.bottom - 24);
    } else info.style.zoom = '';
  }
  window.addEventListener('resize', () => fitBrief());
  function showLevel(z, picked = false) {
    showLevelInner(z, picked);
    requestAnimationFrame(fitBrief);
  }
  function showLevelInner(z, picked = false) {
    selLevel = z;
    if (picked && z?.id && save.cleared().includes(clearKey(z.id, 'easy'))) save.setDifficulty('hard');
    for (const b of brief.querySelectorAll('.node')) b.classList.toggle('sel', +b.dataset.n === z.n);
    const info = brief.querySelector('.info');
    const owned = save.owned();
    if (!isOpen(z, save.cleared())) {
      const soon = !z.id && isOpen({ ...z, id: '?' }, save.cleared());
      info.innerHTML = `
        <span class="tagline px">Level ${z.n}</span>
        <h2>${soon ? 'Coming soon' : 'Locked'}</h2>
        <p>${soon ? 'This level is still being built.' : `Beat level ${z.n - 1} to unlock.`}</p>
        <div class="row"><button type="button" class="back">Back</button></div>`;
    } else {
      // Easy and Hard: each cleared on its own (a star each), each with
      // its own first clear reward; parts can turn up on either
      const cleared = save.cleared();
      const done = (d) => cleared.includes(clearKey(z.id, d));
      // Hard opens once the level's beaten on Easy
      const hardLocked = !done('easy');
      if (hardLocked && save.difficulty() === 'hard') save.setDifficulty('easy');
      const diff = save.difficulty() === 'hard' ? 'hard' : 'easy';
      const first = z.first?.[diff];
      const tile = (got, cls, inner, tip) => `<span class="${cls}${got ? ' got' : ''}">${inner}<div class="tip">${tip}${got ? '<div class="fx-how">(got it)</div>' : ''}</div></span>`;
      let firstTile = '';
      if (first?.tank) firstTile += tile(done(diff), 'tank', `<img alt="${TANKS[first.tank].name}" src="${tankIcon(first.tank)}">`, `<div class="fx-head">${esc(TANKS[first.tank].name)}</div><div class="fx-how">${esc(tankDef(first.tank).blurb)}</div>`);
      if (first?.equipment) firstTile += tile(done(diff), 'equip', `<img alt="${EQUIPMENT[first.equipment].name}" src="${equipmentIcon(first.equipment)}">`, `<div class="fx-head">${esc(EQUIPMENT[first.equipment].name)}</div>${equipmentHtml(first.equipment)}`);
      if (first?.part) firstTile += tile(done(diff), 'legpart', `<img alt="${PARTS[first.part].name}" src="${partIcon(first.part)}"><em>Legendary</em>`, `<div class="fx-head">${esc(PARTS[first.part].name)}</div>${effectsHtml(first.part, PARTS[first.part].only || save.tank(), PARTS[first.part].startLevel || 1)}`);
      if (first?.scraps) firstTile += tile(done(diff), 'cash', `+${first.scraps} scraps`, '<div class="fx-how">Currency used for upgrades and purchases.</div>');
      if (first?.tokens) firstTile += tile(done(diff), 'cash tok', `+${first.tokens} tokens`, '<div class="fx-how">Needed for promoting parts, tanks and drones.</div>');
      const tab = (d, name, txt) => {
        const locked = d === 'hard' && hardLocked;
        const st = locked ? '<i class="lock"></i>Beat Easy to unlock' : `<i class="star ${d} ${done(d) ? 'got' : ''}"></i>${done(d) ? 'Cleared' : 'Not cleared'}`;
        return `<button type="button" class="dtab ${d} ${diff === d ? 'on' : ''} ${locked ? 'locked' : ''}" data-d="${d}" ${locked ? 'disabled' : ''} title="${txt}"><b>${name}</b><span class="st">${st}</span></button>`; // (what it means: on hover only, to save room)
      };
      info.innerHTML = `
        <span class="tagline px">Level ${z.n}</span>
        <h2>${z.name}</h2>
        <div class="steps">${z.steps.map((t, i) => `${i ? '<i></i>' : ''}<b class="${t === 'Boss' ? 'boss' : ''}">${t}</b>`).join('')}</div>
        <div class="diffs">${tab('easy', 'Easy', 'Checkpoints repair you, one revive')}${tab('hard', 'Hard', 'More enemies, no repairs, no revive')}</div>
        ${done('easy') && !done('hard') && diff === 'easy' ? '<span class="callout">Beat it on Hard for extra rewards!</span>' : ''}
        ${firstTile ? `<span class="label">First clear reward${diff === 'hard' ? ' (Hard)' : ''}</span><div class="rewards">${firstTile}</div>` : ''}
        <span class="label">Possible parts</span>
        <div class="rewards">${z.rewards.map((id) => {
          // had from this level already (the part, or its improvement): greyed out, done
          const had = save.levelFinds(z.id).includes(id);
          const tip = had ? `<div class="fx-head">${esc(PARTS[id].name)}</div><div class="fx-how">Already found on this level.</div>` : partTip(id);
          return `<span class="${had ? 'got' : owned.includes(id) ? 'imp' : ''}"><img alt="${PARTS[id].name}" src="${partIcon(id)}"><div class="tip">${tip}</div></span>`;
        }).join('')}</div>
        ${loadoutCard()}
        <div class="row"><button type="button" class="go">Play${diff === 'hard' ? ' on Hard' : ''}</button><button type="button" class="back">Back</button></div>`;
      info.querySelector('.tohangar').addEventListener('click', toHangarNow);
      for (const b of info.querySelectorAll('.dtab:not(.locked)'))
        b.addEventListener('click', () => {
          save.setDifficulty(b.dataset.d);
          showLevel(z);
        });
      info.querySelector('.go').addEventListener('click', () => deploy(z.id));
    }
    info.querySelector('.back').addEventListener('click', closeRoom);
  }

  // what you're taking into the level: the tank, its parts (empty slots in
  // red), its equipment; and the way to the hangar to change it
  function loadoutCard() {
    const t = save.tank();
    const list = save.loadout(t).filter((p) => PARTS[p]);
    const slots = tankDef(t).slots;
    const eq = save.equipment(t);
    const ownsGear = save.ownedEquipment().some((e) => EQUIPMENT[e]);
    const cells = [
      ...list.map((p) => `<span class="cell"><img alt="${esc(PARTS[p].name)}" title="${esc(PARTS[p].name)}" src="${partIcon(p)}"></span>`),
      ...Array.from({ length: Math.max(0, slots - list.length) }, () => '<span class="cell empty" title="Empty part slot"></span>'),
    ].join('');
    const gear = eq && EQUIPMENT[eq] ? `<span class="cell eq"><img alt="${esc(EQUIPMENT[eq].name)}" title="${esc(EQUIPMENT[eq].name)}" src="${equipmentIcon(eq, 48, 36)}"></span>` : ownsGear ? '<span class="cell eq empty" title="No equipment"></span>' : '';
    return `<div class="loadout"><img class="tk" alt="" src="${tankPicture(renderer, t, 120, 70)}"><div class="lo"><b>${esc(TANKS[t].name)}</b><small>Lv ${save.tankLevel(t)} · parts ${list.length}/${slots}</small><div class="cells">${cells}${gear}</div></div><button type="button" class="tohangar">Hangar</button></div>`;
  }
  // from the briefing or the Endless screen: to the hangar, and its Back
  // brings you back there (the level picked still picked)
  let returnTo = null;
  let keepBrief = false;
  function toHangarNow() {
    const from = open?.id === 'briefing' || open?.id === 'endless' ? open.id : null;
    news.hidden = true;
    if (open) closeRoom();
    clickRoom(ROOMS.find((r) => r.id === 'hangar'));
    returnTo = from;
  }
  function hangarBack() {
    const to = returnTo;
    returnTo = null;
    closeRoom();
    if (!to) return;
    if (to === 'briefing') keepBrief = true;
    clickRoom(ROOMS.find((r) => r.id === to));
  }

  // ------------------------------------------------------------ Endless
  // Locked: the camera goes in, a box says when it opens, and back out.
  // Open: the map (one for now), the tank you're taking (and the way to
  // the hangar), the reward track, Play.
  let endlessMap = ENDLESS_MAPS[0].id;
  function refreshEndlessTag() {
    const tag = tags.get('endless');
    tag.classList.toggle('locked', !endlessOpen());
    tag.classList.toggle('newroom', endlessOpen() && !save.tips().includes('endless-visited'));
  }
  function openEndless() {
    if (!endlessOpen()) {
      news.hidden = false;
      news.innerHTML = `<span class="newtag" style="background:#b9b0a0">Locked</span><h2>Endless</h2><p>Endless mode unlocks after level ${ENDLESS_AFTER.n}!</p><p class="hint">Hold out against waves that never stop, and fill the reward track.</p><div class="row"><button type="button" class="go">OK</button></div>`;
      news.querySelector('.go').addEventListener('click', () => {
        news.hidden = true;
        closeRoom();
      });
      return;
    }
    save.seeTip('endless-visited');
    refreshEndlessTag();
    const e = save.endless();
    const { tier, k } = trackPos(e.xp);
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const lo = tier ? TRACK_AT[tier - 1] : 0;
    const hi = TRACK_AT[Math.min(tier, TRACK.length - 1)];
    const next = TRACK[Math.min(tier, TRACK.length - 1)];
    endlessPanel.hidden = false;
    endlessPanel.innerHTML = `
      <h2>Endless</h2>
      <div class="top">
        <div class="maps"><span class="label">Map</span>${ENDLESS_MAPS.map((m) => `<button type="button" class="map${m.id === endlessMap ? ' sel' : ''}" data-id="${m.id}"><b>${esc(m.name)}</b><small>${esc(m.text)}</small><span class="rec">Best: ${fmt(e.best.t)} · ${e.best.wave} waves</span></button>`).join('')}</div>
        <div class="you"><span class="label">Your tank</span>${loadoutCard().replace('class="tohangar"', 'class="tohangar"')}<span class="note">Drive into the base at any time to change your loadout (no repairs).</span></div>
      </div>
      <div class="trackhead"><span class="label">Reward track · tier ${tier} of ${TRACK.length}</span><b>${tier >= TRACK.length ? 'Complete' : `Next: ${rewardText(next)}`}</b></div>
      ${trackHtml(e.xp)}
      <div class="ebar"><i style="width:${(tier >= TRACK.length ? 1 : k) * 100}%"></i><span>${tier >= TRACK.length ? 'Track complete' : `${Math.floor(e.xp - lo)} / ${hi - lo} XP`}</span></div>
      <span class="note">XP comes from every run: kills, waves cleared and time survived. Leaving early still pays out.</span>
      <div class="row"><button type="button" class="go">Play</button><button type="button" class="back">Back</button></div>`;
    for (const b of endlessPanel.querySelectorAll('.map'))
      b.addEventListener('click', () => {
        endlessMap = b.dataset.id;
        openEndless();
      });
    endlessPanel.querySelector('.tohangar').addEventListener('click', toHangarNow);
    endlessPanel.querySelector('.go').addEventListener('click', () => deploy(endlessMap));
    endlessPanel.querySelector('.back').addEventListener('click', closeRoom);
  }

  // ---------------------------------------------------- the fitting screen
  // The shared fitting screen over the tank on its lift: slots with lines to
  // where each part sits, storage, the tanks to choose from.
  const partIcon = (id) => partPicture(renderer, id);
  const tankIcon = (id) => tankPicture(renderer, id, 144, 84);
  const sv = new THREE.Vector3();
  function toScreen(p) {
    const rect = canvasEl.getBoundingClientRect();
    sv.copy(p).project(camera);
    return [rect.left + ((sv.x + 1) / 2) * rect.width, rect.top + ((1 - sv.y) / 2) * rect.height];
  }
  function openFitting() {
    const tanks = save.tanks();
    fitting.show({
      tag: 'Hangar',
      tankId,
      loadout: save.loadout(tankId),
      owned: save.owned(),
      tanks,
      newTanks: freshTanks,
      onSet(list) {
        save.setLoadout(list, tankId);
        fitHubTank();
        openFitting();
      },
      onTank(id) {
        save.setTank(id);
        fitHubTank();
        openFitting();
      },
      buttons: [['Back', () => hangarBack()]],
      // scraps take parts up a tier on a screen of their own
      upgradeHint: upgradeHint(),
      evolveReady,
      canEvolve,
      onUpgradeTank: () => openWorkshop({ tab: 'tanks' }),
      onUpgrades: (partId = null) => openWorkshop({ tab: 'parts', select: partId }),
      anchor: (id) => {
        const w = anchorWorld(tank, tankId, id);
        return w ? toScreen(w) : null;
      },
    });
    freshTanks = [];
  }
  // The upgrades walkthrough, once: the first time there's an upgrade to
  // afford, the room's dimmed round the hangar ("Upgrades" over it); in the
  // hangar, round its upgrades button. Done once the upgrades screen opens.
  const guide = document.createElement('div');
  guide.className = 'base-guide';
  guide.hidden = true;
  guide.innerHTML = '<div class="lab"><span class="t"></span><b></b><button type="button" class="skip">Skip</button><i></i></div>';
  // two walkthroughs, one after the other: the upgrades (the first time
  // one's affordable), then any new equipment (to its slot in the hangar);
  // either can be skipped
  let guideT = -1;
  let guideWant = null;
  const unseenGear = () => save.ownedEquipment().filter((e) => EQUIPMENT[e] && !save.tips().includes(`eqseen:${e}`) && !Object.keys(TANKS).some((t) => save.equipment(t) === e)); // (fitted somewhere: not new)
  const guideOn = (t) => {
    if (t - guideT > 0.5 || t < guideT) {
      guideT = t;
      guideWant = !save.tips().includes('hub-upgrades') && upgradeHint() ? 'upgrades' : unseenGear().length ? 'gear' : null;
    }
    return guideWant;
  };
  guide.querySelector('.skip').addEventListener('click', () => {
    if (guideWant === 'upgrades') save.seeTip('hub-upgrades');
    else for (const e of unseenGear()) save.seeTip(`eqseen:${e}`);
    guideT = -1;
    if (open?.id === 'hangar') openFitting();
  });
  function guideFrame(t) {
    let target = null;
    let text = '';
    const step = news.hidden && !workshop.isOpen ? guideOn(t) : null;
    if (step) {
      if (!open) {
        const tag = tags.get('hangar');
        if (!tag.hidden) {
          const r = tag.getBoundingClientRect();
          const [fx, fy] = toScreen(ROOMS.find((m) => m.id === 'hangar').focus);
          const tx = r.left + r.width / 2;
          target = { x: fx, y: fy, r: Math.max(150, Math.hypot(fx - tx, fy - r.top) + 20), above: r.top, labelX: tx, labelY: r.bottom };
          text = step === 'upgrades' ? 'You have scraps to spend! Go to the hangar.' : 'You have new equipment! Go to the hangar.';
        }
      } else if (open.id === 'hangar') {
        const b = fitting.el.querySelector(step === 'upgrades' ? '.upbtn' : '.equip .box');
        if (b && !b.hidden && b.offsetParent) {
          const r = b.getBoundingClientRect();
          target = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) * 0.75 + 10, above: r.top };
          text = step === 'upgrades' ? 'Spend scraps here to upgrade your parts and tanks.' : 'New equipment! Tap here to fit it to your tank.';
        }
      }
    }
    guide.querySelector('.t').textContent = step === 'gear' ? 'Equipment' : 'Upgrades';
    guide.hidden = !target;
    if (!target) return;
    const rr = target.r * (1 + Math.sin(t * 4) * 0.04);
    guide.style.background = `radial-gradient(circle at ${target.x}px ${target.y}px, transparent ${rr}px, rgba(0,0,0,0.72) ${rr + 26}px)`;
    const lab = guide.querySelector('.lab');
    if (lab.querySelector('b').textContent !== text) lab.querySelector('b').textContent = text;
    const w = lab.offsetWidth;
    const h = lab.offsetHeight;
    const below = target.above - h - 18 < 8;
    lab.classList.toggle('below', below);
    const lx = target.labelX ?? target.x;
    lab.style.left = `${Math.round(Math.min(window.innerWidth - w - 8, Math.max(8, lx - w / 2)))}px`;
    lab.style.top = `${Math.round(below ? (target.labelY ?? target.y + target.r * 0.6) + 14 : target.above - h - 16)}px`;
  }
  // the upgrades screen, over the hangar
  function openWorkshop(opts) {
    fitting.hide();
    save.seeTip('hub-upgrades'); // (the walkthrough's done)
    workshop.show({
      tankId,
      ...opts,
      onChange() {
        bankEl.textContent = bankTotal();
        fitHubTank();
      },
      onClose() {
        bankEl.textContent = bankTotal();
        tags.get('hangar').classList.toggle('alert', upgradeHint());
        if (open?.id === 'hangar') openFitting();
      },
    });
  }

  // "New!": what the last level unlocked, once, on coming back to the base:
  // a new tank, equipment, a first clear part (the Vulcan): one popup after
  // another
  let newsQueue = [];
  // the popups (new tank, new part, confirms) always fit the screen whole,
  // shrunk if they must: no scrolling to find their buttons
  const fitNews = () => {
    if (news.hidden) return;
    news.style.maxHeight = 'none';
    news.style.overflow = 'visible';
    fitInside(news, window.innerWidth - 24, window.innerHeight - 24);
  };
  new MutationObserver(() => requestAnimationFrame(fitNews)).observe(news, { attributes: true, attributeFilter: ['hidden'], childList: true });
  window.addEventListener('resize', fitNews);
  function showNews() {
    const all = save.news();
    save.clearNews();
    const tanks = all.filter((n) => n.kind === 'tank' && TANKS[n.id]);
    if (tanks.length) freshTanks = tanks.map((i) => i.id);
    newsQueue = [...tanks, ...all.filter((n) => n.kind === 'equipment' && EQUIPMENT[n.id]), ...all.filter((n) => n.kind === 'part' && PARTS[n.id])];
    // Endless just opened: said once
    if (endlessOpen() && !save.tips().includes('endless-news')) {
      save.seeTip('endless-news');
      newsQueue.push({ kind: 'endless' });
    }
    nextNews();
  }
  function nextNews() {
    const n = newsQueue.shift();
    if (!n) return void (news.hidden = true);
    if (n.kind === 'tank') showTank(n.id);
    else if (n.kind === 'equipment') showGear(n.id);
    else if (n.kind === 'endless') showEndlessNews();
    else showPart(n.id);
  }
  function newsButtons(go) {
    news.querySelector('.go').addEventListener('click', () => {
      newsQueue = [];
      news.hidden = true;
      go();
    });
    news.querySelector('.back').addEventListener('click', () => nextNews());
  }
  const toHangar = () => clickRoom(ROOMS.find((r) => r.id === 'hangar'));
  function showEndlessNews() {
    news.hidden = false;
    news.innerHTML = `
      <span class="newtag">Endless unlocked!</span>
      <h2>Endless mode</h2>
      <p>Waves that never stop, a base to fall back to between them, and a reward track that fills with every run.</p>
      <p class="hint">Find it in the new room off the hall.</p>
      <div class="row"><button type="button" class="go">Take a look</button><button type="button" class="back">${newsQueue.length ? 'Next' : 'Later'}</button></div>`;
    newsButtons(() => clickRoom(ROOMS.find((r) => r.id === 'endless')));
  }
  function showTank(id) {
    news.hidden = false;
    news.innerHTML = `
      <span class="newtag">New tank!</span>
      <h2>${TANKS[id].name} unlocked</h2>
      <img alt="" src="${tankIcon(id)}">
      <p>${tankDef(id).blurb} Pick it in the hangar.</p>
      <div class="row"><button type="button" class="go">Go to hangar</button><button type="button" class="back">${newsQueue.length ? 'Next' : 'Later'}</button></div>`;
    newsButtons(toHangar);
  }
  function showPart(id) {
    const p = PARTS[id];
    news.hidden = false;
    news.innerHTML = `
      <span class="newtag leg">New Legendary part!</span>
      <h2></h2>
      <span class="legpic"><img class="gear" alt="" src="${partIcon(id)}"><em>Legendary</em></span>
      <div class="eqfx">${effectsHtml(id, p.only || save.tank(), p.startLevel || 1)}</div>
      ${p.only ? `<p class="hint">${TANKS[p.only].name} only. Fit it in the hangar.</p>` : '<p class="hint">Fit it in the hangar.</p>'}
      <div class="row"><button type="button" class="go">Go to hangar</button><button type="button" class="back">${newsQueue.length ? 'Next' : 'Later'}</button></div>`;
    news.querySelector('h2').textContent = `${p.name} unlocked`;
    newsButtons(toHangar);
  }

  function showGear(id) {
    const g = EQUIPMENT[id];
    news.hidden = false;
    news.innerHTML = `
      <span class="newtag">New equipment!</span>
      <h2></h2>
      <img class="gear" alt="" src="${equipmentIcon(id, 128, 96)}">
      <p></p>
      <p class="hint">Equipment goes in its own slot and is used with <b>Q</b>. Swap it in the hangar.</p>
      <div class="row"><button type="button" class="go">Go to hangar</button><button type="button" class="back">${newsQueue.length ? 'Next' : 'Later'}</button></div>`;
    news.querySelector('h2').textContent = `${g.name} unlocked`;
    news.querySelector('p').outerHTML = `<div class="eqfx">${equipmentHtml(id)}</div>`;
    newsButtons(toHangar);
  }

  function closeRoom() {
    open = null;
    root.querySelector('.base-gear').hidden = false;
    fitting.hide();
    workshop.hide();
    tags.get('hangar').classList.toggle('alert', upgradeHint());
    menu.hidden = true;
    crewPanel.hidden = true;
    brief.hidden = true;
    endlessPanel.hidden = true;
    hint.hidden = false;
    walkTo = null;
    refreshEndlessTag();
  }
  function clickRoom(r) {
    if (open) return;
    openRoom(r);
    // and the crewman heads over there meanwhile
    if (roomAt(me) !== r) walkTo = r.entry.clone();
  }
  // Before a level: the tank you're taking has an empty equipment slot
  // (and you own some, on whatever tank), or empty part slots (and there are
  // parts it could take lying in storage): ask first.
  function deploy(id) {
    const t = save.tank();
    const name = TANKS[t]?.name || 'Your tank';
    const lines = [];
    let title = '';
    if (!save.equipment(t) && save.ownedEquipment().some((e) => EQUIPMENT[e])) {
      lines.push(`${name} has an empty equipment slot!`);
      title = 'Start with missing equipment?';
    }
    const fitted = new Set(save.tanks().flatMap((k) => save.loadout(k)));
    const free = save.owned().filter((p) => PARTS[p] && !fitted.has(p) && fitsTank(p, t));
    if (save.loadout(t).length < tankDef(t).slots && free.length) {
      lines.push(`${name} has empty part slots!`);
      title = title ? 'Start with empty slots?' : 'Start with empty part slots?';
    }
    if (!lines.length) return go(id);
    news.hidden = false;
    news.innerHTML = `
      <h2 class="warn"></h2>
      ${lines.map(() => '<p></p>').join('')}
      <button type="button" class="go yel tohangar">Go to hangar</button>
      <div class="row"><button type="button" class="back cont">Continue anyway</button><button type="button" class="back nope">Back</button></div>`;
    news.querySelector('h2').textContent = title;
    news.querySelectorAll('p').forEach((p, i) => (p.textContent = lines[i]));
    news.querySelector('.cont').addEventListener('click', () => {
      news.hidden = true;
      go(id);
    });
    // the hangar, to sort the tank out; or just back to the map
    news.querySelector('.tohangar').addEventListener('click', toHangarNow);
    news.querySelector('.nope').addEventListener('click', () => (news.hidden = true));
  }
  function go(id) {
    fade.classList.remove('off');
    setTimeout(() => onDeploy(id), 480);
  }

  // ---------------------------------------------------------- input
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const camTarget = BASE_CENTER.clone();
  let view = VIEW_FAR;
  let aspect = 16 / 9;
  const keys = new Set();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvasEl = renderer.domElement;
  const pick = (e) => {
    const r = canvasEl.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(floorMeshes, false)[0];
  };
  const onKeyDown = (e) => {
    if (e.code === 'Escape' && !news.hidden) return void (news.hidden = true);
    if (e.code === 'Escape' && workshop.isOpen) {
      workshop.hide();
      bankEl.textContent = bankTotal();
      return openFitting();
    }
    if (e.code === 'Escape' && open) return closeRoom();
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  // in the hangar: drag anywhere off the panels to turn the tank on its lift
  let turning = null;
  const onDown = (e) => {
    if (open?.id === 'hangar' && !workshop.isOpen && tank) {
      turning = { x: e.clientX, id: e.pointerId };
      return;
    }
    if (open || !news.hidden) return;
    const hit = pick(e);
    if (!hit) return;
    const r = hit.object.userData.room;
    if (r) return clickRoom(r);
    walkTo = hit.point.clone().setY(0);
  };
  // (watched on the window, so a drag that wanders onto a panel or is let
  // go anywhere ends there)
  const onTurn = (e) => {
    if (!turning || e.pointerId !== turning.id) return;
    // the button's up, or the pointer's gone onto a panel: the drag's over
    if (!e.buttons || e.target !== canvasEl) return void (turning = null);
    tank.group.rotation.y += (e.clientX - turning.x) * 0.012;
    turning.x = e.clientX;
  };
  const onMove = (e) => {
    if (turning) return;
    if (open || e.pointerType === 'touch') return void (hover = null);
    hover = pick(e)?.object.userData.room || null;
  };
  const onBlur = () => keys.clear();
  const onUp = (e) => {
    if (!turning || e.pointerId !== turning.id) return;
    turning = null;
  };

  // ----------------------------------------------------------- frame
  const input = new THREE.Vector3();
  const camWant = new THREE.Vector3();
  const v = new THREE.Vector3();
  let speed = 0;

  return {
    // dev/test: open a room (quarters, briefing, hangar) or the upgrades screen
    open(id) {
      const r = ROOMS.find((x) => x.id === id);
      if (r) openRoom(r);
    },
    openUpgrades: (tab = 'parts') => openWorkshop({ tab }),
    enter() {
      document.body.append(root, fitting.el, workshop.el, guide);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      canvasEl.addEventListener('pointerdown', onDown);
      canvasEl.addEventListener('pointermove', onMove);
      window.addEventListener('pointermove', onTurn);
      window.addEventListener('pointerup', onUp);
      canvasEl.style.cursor = CURSOR;
      pixel.setActorOutlines(true);
      closeRoom();
      me.copy(HOME);
      lastRoom = null;
      bankEl.textContent = bankTotal();
      fitHubTank();
      tags.get('hangar').classList.toggle('alert', upgradeHint()); // the first time an upgrade's affordable
      refreshPromo();
      refreshEndlessTag();
      fade.classList.remove('off');
      requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.add('off')));
      news.hidden = true;
      setTimeout(showNews, 500);
    },
    exit() {
      root.remove();
      fitting.el.remove();
      workshop.el.remove();
      guide.remove();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvasEl.removeEventListener('pointerdown', onDown);
      canvasEl.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onTurn);
      canvasEl.style.cursor = '';
      keys.clear();
    },
    resize(w, h) {
      aspect = w / h;
      pixel.setHeight(ROWS);
    },
    debug: { crew, scene },
    // for the dev kit's data reset
    refresh() {
      bankEl.textContent = bankTotal();
      refreshPromo();
      refreshEndlessTag();
      tags.get('hangar').classList.toggle('alert', upgradeHint());
      fitHubTank();
      if (open?.id === 'hangar') openFitting();
    },
    frame(dt, t) {
      // walking: keys (screen-relative), or toward a clicked spot
      input.set(0, 0, 0);
      if (!open) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) input.add(INPUT_FORWARD);
        if (keys.has('KeyS') || keys.has('ArrowDown')) input.sub(INPUT_FORWARD);
        if (keys.has('KeyD') || keys.has('ArrowRight')) input.add(INPUT_RIGHT);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) input.sub(INPUT_RIGHT);
        if (input.lengthSq() > 0) walkTo = null;
      }
      if (!input.lengthSq() && walkTo) {
        input.set(walkTo.x - me.x, 0, walkTo.z - me.z);
        if (input.length() < 0.2) {
          walkTo = null;
          input.set(0, 0, 0);
        }
      }
      const moving = input.lengthSq() > 0.001;
      speed += ((moving ? 1 : 0) - speed) * Math.min(1, dt * 10);
      if (moving) {
        input.normalize();
        crew.group.rotation.y = approachAngle(crew.group.rotation.y, Math.atan2(-input.z, input.x), dt * 12);
        me.addScaledVector(input, WALK * dt * speed);
        // walked into something on the way to a click: give up rather than grind
        if (pushOut(me, crewBox, B.blocks) && walkTo && Math.random() < dt * 2) walkTo = null;
      }
      crew.update(dt, t, speed, WALK);
      matesFrame(dt, t);
      B.update(dt, t, {});
      for (const e of B.emitters) if (e.light) e.light.intensity = e.intensity * e.level;
      if (endlessFx.lamp) endlessFx.lamp.visible = Math.sin(t * 5) > -0.3; // (the lamp over the blast door)
      for (const h of holo) {
        h.mark.rotation.y = t * 1.5;
        h.mark.position.y = 0.9 + Math.sin(t * 2) * 0.06;
        h.scan.position.x = ((t * 0.6) % 1) * 3.8 - 1.9;
        h.edgeMat.opacity = 0.6 + Math.sin(t * 7) * 0.08 + (Math.random() < 0.02 ? -0.3 : 0);
      }

      // walking into a room opens it
      const inRoom = roomAt(me);
      if (inRoom !== lastRoom) {
        lastRoom = inRoom;
        if (inRoom && !open) openRoom(inRoom);
      }

      // camera: the whole base, leaning a little toward the crewman; eased
      // in close on an open room
      // (on a tall screen the whole base is fitted across its width)
      const far = aspect < 1.2 ? Math.max(VIEW_FAR, 36 / aspect / Math.min(1.6, 1.2 / aspect)) : VIEW_FAR;
      view += ((open ? open.view : far) - view) * (1 - Math.exp(-dt * 4));
      if (open) camWant.copy(open.focus);
      else camWant.copy(BASE_CENTER).lerp(me, 0.15);
      camWant.setY(0.8);
      camTarget.lerp(camWant, 1 - Math.exp(-dt * 4));
      const viewH = aspect < 1.2 ? view * Math.min(1.6, 1.2 / aspect) : view;
      camera.left = (-viewH * aspect) / 2;
      camera.right = (viewH * aspect) / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();
      camera.position.copy(camTarget).add(CAM_OFFSET);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      pixel.render(scene, camera);

      // the hovered room lights its outline; tags over each room
      const lit = open ? null : hover || hoverTag;
      for (const r of ROOMS) {
        r.outline.visible = r === lit;
        if (r === lit) r.outlineMat.opacity = 0.75 + Math.sin(t * 8) * 0.2;
      }
      if (open?.id === 'hangar') fitting.layout();
      hangarOverhead.visible = open?.id !== 'hangar';
      const rect = canvasEl.getBoundingClientRect();
      for (const r of ROOMS) {
        const tag = tags.get(r.id);
        v.copy(r.label).project(camera);
        tag.hidden = !!open || v.z > 1;
        tag.style.left = `${Math.round(rect.left + ((v.x + 1) / 2) * rect.width)}px`;
        tag.style.top = `${Math.round(rect.top + ((1 - v.y) / 2) * rect.height)}px`;
        tag.classList.toggle('hot', r === lit);
        if (r.id === 'briefing') {
          promo.hidden = !promoOn || !!open || v.z > 1; // (stays up under any popup: no flicker on the way in)
          promo.style.left = tag.style.left;
          promo.style.top = tag.style.top;
        }
      }
      guideFrame(t);
    },
  };
}
