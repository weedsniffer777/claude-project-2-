// Game entry. Runs the game, with a dev kit button in the corner that opens
// developer tools (model viewer for now). Esc or "Back to game" returns.
import * as THREE from 'three';
import { createRenderer } from './render/setup.js';
import { createGame } from './game/game.js';
import { createHub, CAMPAIGN } from './hub/hub.js';
import { save } from './game/save.js';
import { createModelViewer } from './devkit/modelViewer.js';
import { createDevKit } from './devkit/devkit.js';
import { MODELS } from './models/registry.js';
import { LEVELS } from './levels/index.js';
import { CURSOR } from './game/hud.js';
import { PARTS } from './game/parts.js';
import { settings, onSettings } from './ui/settings.js';
import { CG, platform, store } from './platform.js';
import { sfx } from './audio.js';

// The themed cursor everywhere: over panels, text and empty UI too (not the
// browser's arrow or text beam). Zero specificity, so anything that sets
// its own cursor (the canvas hiding it in combat) still wins.
{
  const st = document.createElement('style');
  // and no long-press text selection, copy / look up callouts or tap
  // flashes on phones (a held finger is for firing and driving)
  st.textContent = `:where(html, body, body *) { cursor: ${CURSOR}; }
html, body, body * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
canvas { touch-action: none; }`;
  document.head.append(st);
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
}

// (the CrazyGames build takes no dev switches from the address)
const params = CG ? new URLSearchParams() : new URLSearchParams(location.search);
// (the release build: no DEV button in the corner, so the corner's free)
document.documentElement.classList.toggle('cg', CG);
if (params.has('shot')) document.body.classList.add('dk-shot');

const { renderer, pixel } = createRenderer({ pixelHeight: 540 }) // zoomed-out game camera: more pixels keep the tank's detail;
// The game (a run), and the base between runs: Exit at the end of a run goes
// to the base; deploying from its planning table starts a run.
// (a run over: the portal may put an ad in before the base or the next go)
const game = createGame({ renderer, pixel, level: params.get('level'), onExit: () => platform.midgame(() => setMode(hub)), adBreak: platform.midgame });
const hub = createHub({
  renderer,
  pixel,
  onDeploy: (id) => {
    game.loadLevel(id);
    setMode(game);
  },
});
const viewer = CG ? null : createModelViewer({ renderer, pixel, models: MODELS, params, onExit: () => setMode(game) });
// The pixel grid is part of the art: always 540 rows, whatever the screen.
// Quality tiers only trade shadow detail and lamp lights.
//
// Auto quality aims for a steady 60: it starts at the best tier (or the one
// it settled on last time), and while it's still finding its feet it steps
// down whenever a few seconds run under 50 fps, then sticks with the first
// tier that holds. After that it only steps down if the frame rate stays
// really low for several seconds: under 30 (or under 15 on a screen that
// can't go past 30 anyway). It never steps back up mid-session, so the
// look doesn't flicker. A tier that didn't help (a 30 Hz screen) is undone.
const TIERS = [
  { name: 'High', shadow: 2048, lamps: 6 },
  { name: 'Medium', shadow: 1024, lamps: 4 },
  { name: 'Low', shadow: 1024, lamps: 2 },
  { name: 'Potato', shadow: 512, lamps: 0 },
];
const AUTO_KEY = 'scavenger.autoTier';
const readAuto = () => {
  try {
    const v = store.getItem(AUTO_KEY);
    return v == null ? 0 : +v;
  } catch {
    return 0;
  }
};
const writeAuto = (i) => {
  try {
    store.setItem(AUTO_KEY, String(i));
  } catch {
    // storage blocked: settle again next time
  }
};
let autoQuality = true;
let tier = -1;
function setTier(i) {
  i = Math.max(0, Math.min(TIERS.length - 1, i));
  if (i === tier) return;
  tier = i;
  const q = TIERS[i];
  game.setQuality(q);
}
const perf = { t: 0, frames: 0, warm: 3, phase: 'probe', lastFps: 0, low: 0, peak: 0 };
function applyQuality() {
  const q = params.has('quality') ? params.get('quality') : settings().quality;
  autoQuality = q === 'auto';
  if (autoQuality) {
    setTier(readAuto());
    Object.assign(perf, { t: 0, frames: 0, warm: 3, phase: 'probe', lastFps: 0, low: 0 });
  } else setTier(+q);
}
applyQuality();
onSettings((k) => k === 'quality' && applyQuality());
function watchFrameRate(dt) {
  if (!autoQuality || mode !== game) return;
  if (perf.warm > 0) return void (perf.warm -= dt); // let shaders compile first
  perf.t += dt;
  perf.frames++;
  const win = perf.phase === 'probe' ? 2.5 : 1;
  if (perf.t < win) return;
  const fps = perf.frames / perf.t;
  perf.t = perf.frames = 0;
  perf.peak = Math.max(perf.peak, fps);
  if (perf.phase === 'probe') {
    if (fps >= 50 || tier >= TIERS.length - 1) {
      perf.phase = 'locked';
      writeAuto(tier);
      return;
    }
    // stepping down didn't help (the screen's capped, not the GPU): back up and stay
    if (perf.lastFps && fps < perf.lastFps * 1.08 && tier > 0) {
      setTier(tier - 1);
      perf.phase = 'locked';
      writeAuto(tier);
      return;
    }
    perf.lastFps = fps;
    setTier(tier + 1);
    perf.warm = 1.5;
    return;
  }
  // settled: only a long, real slump steps down
  const floor = perf.peak < 40 ? 15 : 30;
  perf.low = fps < floor ? perf.low + 1 : 0;
  if (perf.low >= 5 && tier < TIERS.length - 1) {
    setTier(tier + 1);
    writeAuto(tier);
    perf.low = 0;
    perf.warm = 1.5;
  }
}

renderer.info.autoReset = false;
// (none in the CrazyGames build: no DEV button, no frame counter)
const devkit = CG ? { countFrame() {}, close() {}, isOpen: false } : createDevKit({
  tools: [
    { id: 'model-viewer', label: 'Model viewer', detail: 'Inspect models, loadout slots and weapon effects', open: () => setMode(viewer) },
    {
      id: 'reset-data',
      label: 'Reset saved data',
      detail: 'Clears banked scraps and all saved progress',
      open: () => {
        try {
          for (const k of Object.keys(localStorage)) if (k.startsWith('scavenger.')) localStorage.removeItem(k);
        } catch {
          // storage blocked: nothing saved to clear
        }
        location.reload(); // start over, as on a first visit
      },
    },
    {
      id: 'skip-stage',
      label: 'Skip stage',
      detail: 'Beat this stage and go to the next checkpoint (in the last stage: the boss)',
      open: () => {
        if (mode !== game) return;
        game.skipStage();
        devkit.close();
      },
    },
    {
      id: 'add-scraps',
      label: 'Add 1,000,000 scraps',
      detail: 'For testing upgrades and unlocks',
      open: () => {
        save.addBank(1000000);
        hub.refresh();
      },
    },
    {
      id: 'add-tokens',
      label: 'Add 50 upgrade tokens',
      detail: 'For testing part evolves',
      open: () => {
        save.addTokens(50);
        hub.refresh();
      },
    },
  ],
  settings: [
    {
      id: 'level',
      label: 'Level',
      options: [...LEVELS.map((l) => ({ value: l.id, label: l.name })), { value: 'base', label: 'Base (between runs)' }],
      value: params.has('base') ? 'base' : game.levelId,
      onChange: (id) => {
        if (id === 'base') return setMode(hub);
        game.loadLevel(id);
        setMode(game);
      },
    },
    {
      id: 'complete',
      label: 'Complete up to (Easy and Hard)',
      options: [{ value: '0', label: '(nothing)' }, ...CAMPAIGN.filter((l) => l.id).map((l) => ({ value: String(l.n), label: `Level ${l.n}` }))],
      value: '0',
      // marks every level up to n cleared and hands over all their rewards
      onChange: (v) => {
        for (const l of CAMPAIGN) {
          if (!l.id || l.n > +v) continue;
          save.clear(l.id);
          save.clear(`${l.id}:hard`); // (on Hard too, with its first clear rewards)
          for (const id of l.rewards || []) save.own(id);
          const hard = l.first?.hard || {};
          if (hard.part && PARTS[hard.part] && !save.owned().includes(hard.part)) {
            save.own(hard.part);
            save.setPartLevel(hard.part, PARTS[hard.part].startLevel || 1);
          }
          const gear = l.first?.easy?.equipment;
          if (gear && !save.ownedEquipment().includes(gear)) {
            save.ownEquipment(gear);
            if (!save.equipment(save.tank())) save.setEquipment(gear, save.tank());
            save.addNews([{ kind: 'equipment', id: gear }]);
          }
          const tank = l.first?.easy?.tank;
          if (tank && !save.tanks().includes(tank)) {
            save.unlockTank(tank);
            save.addNews([{ kind: 'tank', id: tank }]);
          }
        }
        hub.refresh();
      },
    },
    {
      id: 'quality',
      label: 'Quality',
      options: [{ value: 'auto', label: 'Auto' }, ...TIERS.map((q, i) => ({ value: String(i), label: q.name }))],
      value: 'auto',
      onChange: (v) => {
        autoQuality = v === 'auto';
        if (!autoQuality) setTier(+v);
        else applyQuality();
      },
    },
  ],
});

let mode = null;
function setMode(next) {
  if (next === mode) return;
  mode?.exit();
  mode = next;
  mode.enter();
  resize();
}

// going in or out of fullscreen (or away to another tab) pauses a run: on
// CrazyGames the page sits in a frame, so a big jump in its size is how a
// fullscreen switch shows (not on phones, whose bars come and go)
let lastSize = [window.innerWidth, window.innerHeight];
const finePointer = matchMedia('(pointer: fine)');
document.addEventListener('fullscreenchange', () => mode === game && game.pause());
document.addEventListener('visibilitychange', () => document.hidden && mode === game && game.pause());
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const [lw, lh] = lastSize;
  lastSize = [w, h];
  if (mode === game && finePointer.matches && (Math.abs(w - lw) > lw * 0.08 || Math.abs(h - lh) > lh * 0.08)) game.pause();
  renderer.setSize(w, h);
  pixel.setSize(w, h);
  mode.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (devkit.isOpen) devkit.close();
  else if (mode === viewer) setMode(game);
});

// Landscape only on phones: held upright, the game stops (the pause menu,
// in a run) and a "turn your phone" card shows over it, darkened behind
{
  const st = document.createElement('style');
  st.textContent = `
.rotate { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px; background: rgba(6, 5, 8, 0.78); color: #f1e9d8; text-align: center; font: 400 15px/1.35 'Pixelify Sans', monospace; }
.rotate[hidden] { display: none; }
.rotate .card { display: grid; gap: 14px; justify-items: center; padding: 20px 22px 22px; max-width: 300px; background: rgba(12, 11, 13, 0.94); box-shadow: 0 0 0 2px #000, 0 0 0 4px #f1e9d8, 4px 4px 0 4px #000; }
.rotate b { font: 400 18px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: #ffb347; font-weight: 400; }
.rotate .ph { width: 40px; height: 66px; border: 4px solid #f1e9d8; box-shadow: 0 0 0 2px #000; position: relative; animation: rotPhone 2.2s steps(1) infinite; }
.rotate .ph::after { content: ''; position: absolute; left: 50%; bottom: 4px; width: 8px; height: 4px; margin-left: -4px; background: #f1e9d8; }
@keyframes rotPhone { 0%, 35% { transform: rotate(0deg); } 45%, 100% { transform: rotate(-90deg); } }
`;
  document.head.append(st);
  const el = document.createElement('div');
  el.className = 'rotate';
  el.hidden = true;
  el.innerHTML = '<div class="card"><i class="ph"></i><b>Turn your phone</b><span>This game plays sideways. Rotate your phone to landscape to carry on.</span></div>';
  document.body.append(el);
  const upright = matchMedia('(orientation: portrait) and (pointer: coarse)');
  const check = () => {
    el.hidden = !upright.matches;
    if (upright.matches && mode === game) game.pause();
  };
  upright.addEventListener('change', check);
  setTimeout(check, 0);
}

// straight into level 1 until it's been beaten once; after that, the base
const beatenOne = save.cleared().some((k) => k === 'avenue' || k === 'avenue:hard');
setMode(params.get('devkit') === 'viewer' ? viewer : params.has('base') || (beatenOne && !params.has('level')) ? hub : game);
if (!CG) {
  window.__game = game.debug; // dev/test hook
  window.__hub = hub;
}

const clock = new THREE.Timer();
clock.connect(document);
// the frame cap (60 by default): on a faster screen, skip frames till the
// next one's due
let lastFrame = 0;
function frame(now = performance.now()) {
  const cap = settings().fps;
  if (cap > 0 && lastFrame && now - lastFrame < 1000 / cap - 2) {
    requestAnimationFrame(frame);
    return;
  }
  lastFrame = now;
  clock.update();
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  watchFrameRate(raw);
  devkit.countFrame(raw, () => `${TIERS[tier].name}${autoQuality ? ' (auto)' : ''} · ${renderer.info.render.calls} draws`);
  requestAnimationFrame(frame); // (asked for first: one bad frame never stops the game)
  renderer.info.reset(); // (counted over the whole frame, every pass: the dev kit's draw count)
  // (held still while the portal shows an ad)
  if (!platform.inAd) {
    try {
      mode.frame(dt, clock.getElapsed());
    } catch (err) {
      reportError(err);
    }
  }
  sfx.update();
  if (!window.__ready) platform.loadingStop(); // (the first frame's up)
  // (in play from the first frame on, base and menus included; only the
  // pause menu stops it)
  platform.setPlaying(!(mode === game && game.paused));
  window.__ready = true;
}
// an error in a frame: logged, and shown small in a corner (once each) so
// it can be reported, instead of the game freezing
const seenErrors = new Set();
function reportError(err) {
  const msg = `${err?.message || err}`;
  if (seenErrors.has(msg)) return;
  seenErrors.add(msg);
  console.error(err);
  if (CG) return; // (players don't get the red note)
  let el = document.querySelector('.err-note');
  if (!el) {
    el = document.createElement('div');
    el.className = 'err-note';
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;max-width:60vw;padding:4px 8px;font:11px monospace;color:#fff;background:rgba(160,30,20,0.85);pointer-events:none;white-space:pre-wrap';
    document.body.append(el);
  }
  el.textContent = `Error: ${msg}\n${(err?.stack || '').split('\n').slice(1, 3).join('\n')}`;
  el.hidden = false;
  clearTimeout(reportError.t);
  reportError.t = setTimeout(() => (el.hidden = true), 3000); // (gone again after a few seconds)
}
frame();
