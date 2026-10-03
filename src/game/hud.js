// In-game HUD: hull bar, objective, tutorial prompts, a reticle with the
// cannon's reload ring, floating damage numbers, an on-screen target marker
// and the end-of-run panel. Pixel type, black panels, bone-white text with
// hazard amber; red only means danger (damage taken, low hull, machines).
import * as THREE from 'three';

const CSS = `
.hud button, .hud .hud-card { cursor: var(--cursor); }
.hud { cursor: inherit; --go: #6be08a; --ink: #f1e9d8; --dim: #b9b0a0; --panel: rgba(12, 11, 13, 0.84); --edge: #f1e9d8; --amber: #ffb347; --danger: #ff3b2f;
  position: fixed; inset: 0; pointer-events: none; z-index: 10; color: var(--ink);
  font: 400 15px/1.3 'Pixelify Sans', 'Silkscreen', ui-monospace, monospace; -webkit-font-smoothing: none; image-rendering: pixelated; }
.hud .px { font-family: 'Silkscreen', 'Pixelify Sans', ui-monospace, monospace; text-transform: uppercase; letter-spacing: 0.06em; }
.hud .panel { background: var(--panel); box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--edge), 4px 4px 0 4px #000;
  clip-path: polygon(0 6px, 6px 6px, 6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px)); }
.hud-top { position: absolute; left: 16px; top: calc(14px + env(safe-area-inset-top, 0px)); display: grid; gap: 10px; }
.hud-hull { padding: 8px 12px 10px; display: grid; gap: 6px; min-width: 210px; }
.hud-hull .row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; }
.hud-hull .val { font-variant-numeric: tabular-nums; }
.hud-bar { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; height: 12px; }
.hud-bar i { background: var(--ink); }
.hud-bar i.off { background: #3a3634; }
.hud.low .hud-bar i:not(.off) { background: var(--danger); }
.hud.low .hud-hull .val { color: var(--danger); }
.hud-obj { padding: 6px 12px 7px; font-size: 13px; display: flex; gap: 10px; align-items: baseline; max-width: 100%; box-sizing: border-box; }
.hud-obj .tag { color: var(--amber); font-size: 11px; }
.hud-kills { padding: 6px 12px; font-size: 12px; }
.hud-kills b { color: var(--danger); font-weight: 400; }
.hud-center { position: absolute; left: 50%; top: calc(14px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); display: grid; gap: 12px; justify-items: center;
  width: min(500px, calc(100vw - 32px)); }
/* the radio box sits between the HP panel and the scrap counter, or under
   them when the screen is too narrow for that */
.hud-center { width: clamp(260px, calc(100vw - 560px), 500px); }
@media (max-width: 820px) { .hud-center { top: calc(108px + env(safe-area-inset-top, 0px)); width: calc(100vw - 32px); } }
.hud.touch .hud-center { top: calc(8px + env(safe-area-inset-top, 0px)); width: clamp(220px, calc(100vw - 390px), 440px); gap: 8px; }
@media (max-width: 620px) { .hud.touch .hud-center { top: calc(92px + env(safe-area-inset-top, 0px)); width: calc(100vw - 24px); } }
.hud.touch .hud-prompt { padding: 7px 12px 9px; }
.hud.touch .hud-prompt .text { font-size: 14px; }
.hud.touch .hud-kills { display: none; }
.hud-obj { display: none !important; } /* objectives: off for now */
.hud-sectors { justify-self: start; }
.hud-prompt { padding: 10px 16px 12px; display: grid; gap: 6px; width: 100%; box-sizing: border-box; transition: opacity 0.2s, transform 0.2s; }
.hud [hidden] { display: none !important; }
.hud .hud-prompt[hidden] { display: grid !important; opacity: 0; transform: translateY(-10px); }
.hud-prompt .tag { display: none; }
.hud-prompt .tag::before { content: ''; width: 8px; height: 8px; background: currentColor; animation: hudblink 0.9s steps(1) infinite; }
.hud-prompt.danger .tag { color: var(--danger); }
.hud-prompt.go .tag { color: var(--go); }
.hud-prompt .text { font-size: 17px; text-wrap: pretty; min-height: 1.3em; }
@keyframes hudbreathe { 50% { opacity: 0.72; } }
@keyframes hudblink { 50% { opacity: 0; } }
.hud-boss { width: 100%; padding: 6px 12px 8px; display: grid; gap: 5px; box-sizing: border-box; }
.hud-boss .row { display: flex; justify-content: space-between; font-size: 12px; color: var(--danger); }
.hud-boss .bar { height: 10px; background: #3a3634; }
.hud-boss .bar i { display: block; height: 100%; background: var(--danger); transition: width 0.15s steps(4); }
.hud-sectors { padding: 6px 12px 7px; font-size: 12px; display: flex; gap: 8px; align-items: center; }
.hud-sectors .zone { color: var(--amber); font-size: 11px; }
.hud-sectors .s { color: var(--dim); }
.hud-sectors .s.done { color: var(--go); }
.hud-sectors .s.now { color: var(--ink); background: #f1e9d822; padding: 0 3px; }
.hud-sectors .sep { color: #5d5650; }
.hud-right { position: absolute; right: 16px; top: calc(52px + env(safe-area-inset-top, 0px)); display: grid; gap: 10px; justify-items: end; }
.hud-scrap { padding: 6px 12px; font-size: 14px; display: flex; gap: 8px; align-items: center; color: var(--amber); }
.hud-scrap b { font-weight: 400; color: var(--ink); font-variant-numeric: tabular-nums; min-width: 2.5em; text-align: right; }
.hud-scrap i { width: 10px; height: 14px; background: var(--amber); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.hud-scrap.pop { animation: hudpop 0.18s steps(2); }
.hud-scrap.intro { animation: hudintro 0.5s steps(2) 7; box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber), 0 0 18px 4px #ffb34788; }
@keyframes hudintro { 50% { transform: scale(1.18); } }
@keyframes hudpop { 50% { transform: scale(1.15); } }
.hud-chain { font: 400 22px/1 'Silkscreen', monospace; color: var(--amber); text-shadow: 2px 2px 0 #000, -2px 0 0 #000, 0 -2px 0 #000; display: grid; justify-items: end; gap: 4px; }
.hud-chain small { font-size: 11px; color: var(--ink); }
.hud-chain .t { width: 90px; height: 4px; background: #000; }
.hud-chain .t i { display: block; height: 100%; background: var(--amber); }
.hud-chain.pop { animation: hudpop 0.2s steps(2); }
.hud-spot { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; opacity: 0; transition: opacity 0.25s; }
.hud-spot.on { opacity: 1; }
.hud-fade { position: absolute; inset: 0; background: #070609; opacity: 0; transition: opacity 0.35s steps(5); }
.hud-fade.on { opacity: 1; }
.hud-ability { position: absolute; left: 0; top: 0; width: 96px; height: 96px; margin: -48px 0 0 -48px; display: grid; place-items: center; }
.hud-ability canvas { position: absolute; inset: 0; width: 96px; height: 96px; image-rendering: pixelated; }
.hud-ability.cooling canvas { filter: brightness(0.55) saturate(0.6); }
.hud-ability .key { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); }
.hud-ability.ready { animation: hudready 1s steps(2) infinite; }
.hud-ability .cd { position: relative; font: 400 26px/1 'Silkscreen', monospace; color: var(--ink); text-shadow: 2px 2px 0 #000, -2px 0 0 #000, 0 -2px 0 #000; }
.hud:not(.touch) .hud-ability .cd { font-size: 20px; }
@keyframes hudready { 50% { filter: brightness(1.35); } }
.hud:not(.touch) .hud-ability { width: 64px; height: 64px; margin: -32px 0 0 -32px; }
.hud:not(.touch) .hud-ability canvas { width: 64px; height: 64px; }
.hud-picker { position: absolute; left: 50%; bottom: calc(22vh + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: grid; gap: 14px; justify-items: center;
  width: min(660px, calc(100vw - 32px)); pointer-events: auto; }
.hud-picker .title { font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--go); text-shadow: 2px 2px 0 #000; }
.hud-picker .row { display: flex; gap: 16px; justify-content: center; align-items: stretch; flex-wrap: wrap; }
.hud-card { width: 184px; min-height: 150px; padding: 14px 12px 14px; display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; border: 0; color: var(--ink); font: inherit;
  transition: transform 0.12s steps(3); }
.hud-card .name { font: 400 13px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.hud-card .what { font-size: 13px; line-height: 1.25; }
.hud-card .take { margin-top: auto; padding: 7px 18px 8px; font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: var(--go); box-shadow: 0 3px 0 #2f6b40; }
.hud-card:hover, .hud-card:focus-visible { transform: translateY(-6px) scale(1.07); outline: none; box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--go), 4px 4px 0 4px #000; }
.hud-card:hover .take, .hud-card:focus-visible .take { background: #b6ffc4; box-shadow: 0 3px 0 #2f6b40, 0 0 0 2px #000, 0 0 12px 2px #6be08a88; }
.hud-card:hover .name { color: #ffd08a; }
.hud-picker .skip { padding: 7px 16px 8px; border: 0; font: 400 12px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--ink); background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.hud-picker .skip:hover { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--ink); }
.hud.touch .hud-card { width: 150px; padding: 10px 8px 12px; }
.hud-continue { position: absolute; right: calc(24px + env(safe-area-inset-right, 0px)); top: 50%; transform: translateY(-50%); padding: 14px 20px 15px; border: 0; cursor: pointer; pointer-events: auto;
  font: 400 16px/1 'Silkscreen', monospace; text-transform: uppercase; color: #111; background: var(--go); box-shadow: 0 0 0 2px #000, 0 5px 0 2px #2f6b40; animation: hudready 1s steps(2) infinite; }
.hud-end .bank { color: var(--amber); font-size: 14px; }
.hud-end .parts { display: grid; gap: 8px; justify-items: center; }
.hud-end .parts > span { font-size: 12px; color: var(--dim); }
.hud-end .icons { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.hud-end .icon img { width: 72px; height: 48px; image-rendering: pixelated; }
.hud-end .icon { position: relative; min-width: 56px; min-height: 42px; padding: 4px; background: #1d1b1e; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; display: grid; place-items: center; }
.hud-end .icon canvas { position: static; inset: auto; width: 48px; height: 30px; image-rendering: pixelated; } /* the page styles every canvas as full-screen */
.hud-end .icon:hover { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber); }
.hud-end .tip { position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%); width: 180px; padding: 8px 10px 10px; display: none; gap: 4px; text-align: center; z-index: 2; }
.hud-end .icon:hover .tip { display: grid; }
.hud-end .tip b { font: 400 12px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); font-weight: 400; }
.hud-end .tip span { font-size: 12px; line-height: 1.25; color: var(--ink); }
.hud-arrow { --go: #6be08a; position: absolute; left: 0; top: 0; display: grid; justify-items: center; gap: 4px; transform: translate(-50%, -100%); }
.hud-arrow .lbl { padding: 4px 8px 5px; background: var(--panel); color: var(--go); font: 400 13px/1.2 'Silkscreen', monospace; text-transform: uppercase; white-space: nowrap;
  box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--go); animation: hudbreathe 1.2s steps(3) infinite; }
.hud-arrow .lbl kbd { font-size: 11px; }
.hud-arrow i { width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 18px solid var(--go);
  filter: drop-shadow(2px 2px 0 #000); animation: hudbob 0.8s steps(4) infinite; }
@keyframes hudbob { 50% { transform: translateY(6px); } }
.hud kbd { display: inline-block; min-width: 1.4em; padding: 1px 5px 2px; margin: 0 1px; font: 400 13px/1.2 'Silkscreen', monospace;
  color: #111; background: var(--ink); box-shadow: 0 2px 0 #6d655a; }
.hud-reticle { position: absolute; left: 0; top: 0; width: 52px; height: 52px; margin: -26px 0 0 -26px; }
.hud-reticle svg { width: 100%; height: 100%; overflow: visible; }
.hud-dmg { position: absolute; left: 0; top: 0; font: 400 16px/1 'Silkscreen', monospace; color: var(--ink);
  text-shadow: 2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000, 2px 2px #000; white-space: nowrap; transform: translate(-50%, -50%); }
.hud-dmg.big { font-size: 24px; color: var(--amber); }
.hud-dmg.kill { color: var(--danger); }
.hud-dmg.heal { color: #5fe6ff; font-size: 18px; }
.hud-dmg.chain { color: var(--amber); font-size: 20px; }
.hud-marker { position: absolute; left: 0; top: 0; width: 76px; height: 76px; margin: -38px 0 0 -38px; }
.hud-marker::before, .hud-marker::after { content: ''; position: absolute; inset: 0; border: 3px solid var(--amber); clip-path: polygon(0 0, 30% 0, 30% 4px, 4px 4px, 4px 30%, 0 30%, 0 0, 100% 0, 100% 30%, calc(100% - 4px) 30%, calc(100% - 4px) 4px, 70% 4px, 70% 0, 100% 0, 100% 100%, 70% 100%, 70% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 70%, 100% 70%, 100% 100%, 0 100%, 0 70%, 4px 70%, 4px calc(100% - 4px), 30% calc(100% - 4px), 30% 100%, 0 100%); animation: hudpulse 0.9s steps(2) infinite; }
.hud-marker span { position: absolute; left: 50%; top: -22px; transform: translateX(-50%); font: 400 11px/1 'Silkscreen', monospace; color: var(--amber); white-space: nowrap; text-shadow: 2px 2px #000; }
@keyframes hudpulse { 50% { transform: scale(1.12); } }
.hud-hurt { position: absolute; inset: 0; box-shadow: inset 0 0 0 6px var(--danger), inset 0 0 80px rgba(255, 59, 47, 0.45); opacity: 0; transition: opacity 0.25s; }
.hud-end { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 22px 28px 24px; display: grid; gap: 12px; justify-items: center;
  text-align: center; pointer-events: auto; min-width: min(360px, calc(100vw - 32px)); }
.hud-end h2 { margin: 0; font: 400 28px/1.1 'Silkscreen', monospace; letter-spacing: 0.04em; text-transform: uppercase; }
.hud-end.lose h2 { color: var(--danger); }
.hud-end.win h2 { color: var(--amber); }
.hud-end .stats { display: grid; grid-template-columns: auto auto; gap: 4px 18px; font-size: 14px; color: var(--dim); }
.hud-end .stats b { color: var(--ink); font-weight: 400; text-align: right; font-variant-numeric: tabular-nums; }
.hud-end button { margin-top: 6px; padding: 9px 18px 10px; border: 0; cursor: pointer; font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase;
  color: #111; background: var(--amber); box-shadow: 0 4px 0 #8a5a1c; }
.hud-end .btns { display: flex; gap: 14px; justify-content: center; }
.hud-end button.alt { background: #2a2628; color: var(--ink); box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.hud-end button:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.hud-stick { position: absolute; left: 0; top: 0; width: 132px; height: 132px; margin: -66px 0 0 -66px; image-rendering: pixelated; }
.hud-stick canvas { position: absolute; display: block; image-rendering: pixelated; }
.hud-stick .base { inset: 0; width: 132px; height: 132px; opacity: 0.75; }
.hud-stick .knob { left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px; }
.hud-stick.idle .base { opacity: 0.45; }
.hud-stick.idle .knob { opacity: 0.6; animation: hudbreathe 1.6s steps(4) infinite; }
.hud.touch .hud-top { transform-origin: top left; transform: scale(0.72); top: calc(8px + env(safe-area-inset-top, 0px)); left: 10px; }
.hud.touch .hud-right { transform-origin: top right; transform: scale(0.72); top: calc(44px + env(safe-area-inset-top, 0px)); right: 10px; }
@media (max-height: 500px) { .hud-prompt .text { font-size: 14px; } }
.dk-shot .hud { display: none; }
`;

// Pixel-art stick: a stepped ring with four direction notches, and a round
// knob with a lit top-left and a shaded bottom-right.
function drawStick(base, knob) {
  const g = base.getContext('2d');
  const n = 22;
  const c = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d < 9.2) g.fillStyle = 'rgba(12, 11, 13, 0.55)';
      else if (d < 10.4) g.fillStyle = '#f1e9d8';
      else if (d < 11.3) g.fillStyle = '#000';
      else continue;
      g.fillRect(x, y, 1, 1);
    }
  }
  g.fillStyle = '#f1e9d8';
  for (const [x, y, w, h] of [[10, 2, 2, 1], [9, 3, 4, 1], [10, 18, 2, 1], [9, 17, 4, 1], [2, 10, 1, 2], [3, 9, 1, 4], [18, 10, 1, 2], [17, 9, 1, 4]]) g.fillRect(x, y, w, h);
  const k = knob.getContext('2d');
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x - 4, y - 4);
      if (d > 4.4) continue;
      k.fillStyle = d > 3.6 ? '#000' : x + y < 6 ? '#ffffff' : x + y > 9 ? '#a39a8c' : '#f1e9d8';
      k.fillRect(x, y, 1, 1);
    }
  }
}

// Boost ability icon (16x16 canvas, drawn as pixel art): a drum on its side
// with a flame out the back; the cooldown fills it from the bottom. (Ability
// icons are their own drawings, separate from the part models.)
function drawAbility(c, k, lit) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = k >= 1 ? '#f1e9d8' : '#6d655a';
  g.fillRect(1, 1, 14, 14);
  g.fillStyle = '#141214';
  g.fillRect(2, 2, 12, 12);
  const h = Math.round(12 * Math.min(1, k));
  g.fillStyle = k >= 1 ? '#2b3a2d' : '#3a3022';
  g.fillRect(2, 14 - h, 12, h);
  g.fillStyle = k >= 1 ? '#7d8f5c' : '#55603f';
  g.fillRect(6, 5, 7, 6);
  g.fillStyle = '#3d4a2c';
  g.fillRect(8, 5, 1, 6);
  g.fillRect(11, 5, 1, 6);
  g.fillStyle = '#9fb07a';
  g.fillRect(6, 5, 7, 1);
  if (k >= 1 || lit) {
    g.fillStyle = '#ff8a2a';
    g.fillRect(3, 6, 3, 4);
    g.fillStyle = '#fff1b8';
    g.fillRect(4, 7, 2, 2);
    if (lit) {
      g.fillStyle = '#ffb347';
      g.fillRect(2, 7, 1, 2);
    }
  }
}

// A part's pixel icon (rows of characters, one per pixel).
const ICON_INK = { '#': '#f1e9d8', '+': '#ffb347', '-': '#8a9097', '*': '#5fe6ff', '%': '#ff6fd8' };
function drawIcon(c, rows) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!ICON_INK[ch]) return;
      g.fillStyle = ICON_INK[ch];
      g.fillRect(x, y, 1, 1);
    });
  });
}

// The pointer outside of combat: a chunky pixel arrow, bone with a black
// edge, drawn at 2x.
export const CURSOR = (() => {
  const rows = ['X.........', 'XX........', 'XoX.......', 'XooX......', 'XoooX.....', 'XooooX....', 'XoooooX...', 'XooooooX..', 'XoooooooX.', 'XooooXXXXX', 'XooXoX....', 'XoX.XoX...', 'XX..XoX...', 'X....XoX..', '.....XXX..'];
  const c = document.createElement('canvas');
  c.width = 20;
  c.height = 30;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = ch === 'X' ? '#000' : '#f1e9d8';
    g.fillRect(x * 2, y * 2, 2, 2);
  }));
  return `url(${c.toDataURL()}) 0 0, default`;
})();

let injected = false;
function inject() {
  if (injected) return;
  injected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&family=Silkscreen&display=swap';
  document.head.append(link);
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
}

const RING_R = 19;
const RING_LEN = 2 * Math.PI * RING_R;

export function createHud() {
  inject();
  const root = document.createElement('div');
  root.className = 'hud';
  root.style.setProperty('--cursor', CURSOR);
  root.innerHTML = `
    <canvas class="hud-spot"></canvas>
    <div class="hud-hurt"></div>
    <div class="hud-top">
      <div class="hud-hull panel"><div class="row"><span class="px">HP</span><span class="px val">100</span></div><div class="hud-bar"></div></div>
      <div class="hud-sectors panel px" hidden></div>
    </div>
    <div class="hud-right">
      <div class="hud-kills panel px" hidden>Destroyed <b>0</b></div>
      <div class="hud-scrap panel px" hidden><i></i>Scraps <b>0</b></div>
      <div class="hud-chain px" hidden><span><small>Multiplier </small><span class="n">x2</span></span><div class="t"><i></i></div></div>
    </div>
    <div class="hud-picker" hidden><span class="title">Pick one part</span><div class="row"></div><button type="button" class="skip">Skip</button></div>
    <button type="button" class="hud-continue" hidden>Continue &#9654;</button>
    <div class="hud-arrow" hidden><span class="lbl"></span><i></i></div>
    <div class="hud-center">
      <div class="hud-obj panel" hidden><span class="px tag">Objective</span><span class="text"></span></div>
      <div class="hud-boss panel" hidden><div class="row px"><span class="name">Heavy machine</span><span class="val"></span></div><div class="bar"><i></i></div></div>
      <div class="hud-prompt panel" hidden><span class="px tag"></span><span class="text"></span></div>
    </div>
    <div class="hud-ability" hidden><canvas width="16" height="16"></canvas><span class="cd"></span><kbd class="key">Shift</kbd></div>
    <div class="hud-marker" hidden><span class="px"></span></div>
    <div class="hud-reticle" hidden>
      <svg viewBox="-26 -26 52 52" shape-rendering="crispEdges">
        <circle r="${RING_R}" fill="none" stroke="#000" stroke-width="6" opacity="0.6"></circle>
        <circle class="reload" r="${RING_R}" fill="none" stroke="#f1e9d8" stroke-width="3" stroke-dasharray="${RING_LEN}" transform="rotate(-90)"></circle>
        <g stroke="#000" stroke-width="5"><path d="M-12 0H-5M5 0H12M0 -12V-5M0 5V12"></path></g>
        <g class="cross" stroke="#f1e9d8" stroke-width="2"><path d="M-12 0H-5M5 0H12M0 -12V-5M0 5V12"></path></g>
        <rect x="-1.5" y="-1.5" width="3" height="3" fill="#f1e9d8"></rect>
      </svg>
    </div>
    <div class="hud-numbers"></div>
    <div class="hud-stick idle" hidden><canvas class="base" width="22" height="22"></canvas><canvas class="knob" width="9" height="9"></canvas></div>
    <div class="hud-end panel" hidden><h2></h2><div class="stats"></div><div class="parts" hidden><span class="px">Parts acquired</span><div class="icons"></div></div><div class="bank px"></div><div class="btns"><button type="button" class="main"></button><button type="button" class="alt" hidden></button></div></div>
    <div class="hud-fade"></div>
  `;
  const $ = (s) => root.querySelector(s);
  const bar = $('.hud-bar');
  for (let i = 0; i < 12; i++) bar.append(document.createElement('i'));
  const reticle = $('.hud-reticle');
  const reload = $('.reload');
  const cross = $('.cross');
  const prompt = $('.hud-prompt');
  const marker = $('.hud-marker');
  const numbersEl = $('.hud-numbers');
  const hurt = $('.hud-hurt');
  const end = $('.hud-end');
  const numbers = [];
  let markerAt = null;
  // The drive stick: fixed in the bottom-left corner, drawn as pixel art
  // (one canvas pixel = 6 screen pixels).
  const stickEl = $('.hud-stick');
  const knob = stickEl.querySelector('.knob');
  let touchMode = false;
  drawStick(stickEl.querySelector('.base'), knob);
  const stickCenter = () => ({ x: 96, y: window.innerHeight - 100 });
  const placeStick = () => {
    const c = stickCenter();
    stickEl.style.transform = `translate(${c.x}px, ${c.y}px)`;
  };
  window.addEventListener('resize', placeStick);
  const arrow = $('.hud-arrow');
  let arrowAt = null;
  // radio box typewriter: text nodes revealed a few characters at a time
  let typed = null;
  // spotlight: darken the screen except round the targets
  const spot = $('.hud-spot');
  const spotG = spot.getContext('2d');
  let spotSpec = null;
  const SPOT_PX = 4; // one spotlight pixel = 4 screen pixels
  // ability button / icon
  const ability = $('.hud-ability');
  const abilityCanvas = ability.querySelector('canvas');
  let abilityKey = '';
  const abilityCenter = () => (touchMode ? { x: window.innerWidth - 92, y: window.innerHeight - 104 } : { x: window.innerWidth - 70, y: window.innerHeight - 84 });
  // depot cards
  const picker = $('.hud-picker');
  const cont = $('.hud-continue');
  let onSkip = null;
  let onContinue = null;
  const stop = (e) => e.stopPropagation();
  for (const el of [picker, cont]) el.addEventListener('pointerdown', stop);
  picker.querySelector('.skip').addEventListener('click', () => onSkip?.());
  cont.addEventListener('click', () => onContinue?.());
  let scrapShown = 0;
  let hurtT = 0;
  let promptTimer = 0;
  let onEnd = null;
  let onAlt = null;
  end.querySelector('button.main').addEventListener('click', () => onEnd?.());
  end.querySelector('button.alt').addEventListener('click', () => onAlt?.());

  const v = new THREE.Vector3();
  function toScreen(p, camera, rect) {
    v.copy(p).project(camera);
    return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height, v.z < 1];
  }

  return {
    root,
    mount() {
      document.body.append(root);
    },
    unmount() {
      root.remove();
    },
    setHull(hp, max) {
      const k = Math.max(0, hp / max);
      $('.hud-hull .val').textContent = Math.ceil(Math.max(0, hp));
      [...bar.children].forEach((el, i) => el.classList.toggle('off', i >= Math.ceil(k * 12)));
      root.classList.toggle('low', k < 0.3);
    },
    hurt() {
      hurtT = 0.25;
    },
    setObjective(text) {
      const el = $('.hud-obj');
      el.hidden = !text;
      el.querySelector('.text').textContent = text || '';
    },
    setKills(n) {
      const el = $('.hud-kills');
      el.hidden = false;
      el.querySelector('b').textContent = n;
    },
    // html may contain <kbd>. seconds = 0 keeps it up until replaced.
    prompt(tag, html, { seconds = 0, danger = false, go = false } = {}) {
      prompt.querySelector('.tag').textContent = tag;
      const text = prompt.querySelector('.text');
      text.innerHTML = html;
      prompt.classList.toggle('danger', danger);
      prompt.classList.toggle('go', go);
      prompt.hidden = false;
      promptTimer = seconds;
      // type it out
      const nodes = [];
      const walk = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) nodes.push({ n: walk.currentNode, full: walk.currentNode.textContent });
      for (const x of nodes) x.n.textContent = '';
      text.querySelectorAll('kbd').forEach((k) => (k.style.visibility = 'hidden'));
      typed = { nodes, shown: 0, total: nodes.reduce((a, x) => a + x.full.length, 0), text };
    },
    clearPrompt() {
      prompt.hidden = true;
      promptTimer = 0;
    },
    setMarker(worldPos, label = '') {
      markerAt = worldPos ? worldPos.clone() : null;
      marker.hidden = !markerAt;
      marker.querySelector('span').textContent = label;
    },
    // A bobbing green arrow over a spot in the world, with a pulsing label.
    // target: a Vector3, or a function returning one (to follow something).
    setArrow(target, html = '') {
      arrowAt = target;
      arrow.hidden = !target;
      arrow.querySelector('.lbl').innerHTML = html;
    },
    // touch layout: prompts move to the bottom right, the stick shows
    setTouch(on) {
      touchMode = on;
      root.classList.toggle('touch', on);
      stickEl.hidden = !on;
      placeStick();
    },
    stickCenter,
    // knob offset in screen pixels from the stick's centre (snapped to the
    // stick's 6 px pixel grid)
    setStick(active, dx = 0, dy = 0) {
      stickEl.classList.toggle('idle', !active);
      knob.style.transform = active ? `translate(${Math.round(dx / 6) * 6}px, ${Math.round(dy / 6) * 6}px)` : '';
    },
    // spec: { targets: [Vector3 | () => Vector3 | { screen: [x, y] }], r: px } or null
    setSpot(spec) {
      spotSpec = spec;
      spot.classList.toggle('on', !!spec);
    },
    setSectors(names, current, zone = 'Zone 1') {
      const el = $('.hud-sectors');
      el.hidden = !names;
      if (!names) return;
      el.innerHTML = `<span class="zone">${zone}</span>` + names.map((n, i) => `${i ? '<span class="sep">-</span>' : ''}<span class="s ${i < current ? 'done' : i === current ? 'now' : ''}">${i < current ? '✓' : i + 1}</span>`).join('');
      el.title = names[current] || '';
    },
    setScrap(n) {
      const el = $('.hud-scrap');
      if (n !== scrapShown) {
        el.classList.remove('pop');
        void el.offsetWidth;
        if (n > scrapShown) el.classList.add('pop');
        scrapShown = n;
      }
      el.querySelector('b').textContent = n;
    },
    // n kills in the chain (shown from 2), k01: time left on it
    setChain(n, k01) {
      const el = $('.hud-chain');
      if (n < 2) {
        el.hidden = true;
        return;
      }
      if (el.hidden || el.dataset.n !== String(n)) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
      el.hidden = false;
      el.dataset.n = String(n);
      el.querySelector('.n').textContent = `x${n}`;
      el.querySelector('.t i').style.width = `${Math.round(Math.max(0, k01) * 100)}%`;
    },
    setBoss(name, k01) {
      const el = $('.hud-boss');
      el.hidden = k01 == null;
      if (k01 == null) return;
      el.querySelector('.name').textContent = name;
      el.querySelector('.bar i').style.width = `${Math.max(0, k01) * 100}%`;
    },
    // ability: null hides it; k01 = cooldown progress (1 = ready)
    setAbility(state) {
      ability.hidden = !state;
      if (!state) return;
      const key = `${Math.round(state.k * 12)}|${state.lit}`;
      if (key !== abilityKey) {
        abilityKey = key;
        drawAbility(abilityCanvas, state.k, state.lit);
      }
      ability.classList.toggle('ready', state.k >= 1 && !state.lit);
      const cooling = state.left > 0 && !state.lit;
      ability.classList.toggle('cooling', cooling);
      ability.querySelector('.cd').textContent = cooling ? Math.ceil(state.left) : '';
      const c = abilityCenter();
      ability.style.transform = `translate(${c.x}px, ${c.y}px)`;
      ability.querySelector('.key').hidden = touchMode;
    },
    abilityCenter,
    // the scraps counter appears when the tutorial introduces scraps
    showScrap(on, highlight = false) {
      const el = $('.hud-scrap');
      el.hidden = !on;
      el.classList.toggle('intro', highlight);
      if (highlight) setTimeout(() => el.classList.remove('intro'), 3500);
    },
    // depot parts: [{ id, name, text, icon }], or null to hide
    // onHover(id | null): the card under the pointer
    showPicker(list, onPick, skip, onHover) {
      picker.hidden = !list;
      onSkip = skip;
      const row = picker.querySelector('.row');
      row.innerHTML = '';
      for (const c of list || []) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'hud-card panel';
        el.innerHTML = '<span class="name"></span><span class="what"></span><span class="take">Pick</span>';
        el.querySelector('.name').textContent = c.name;
        el.querySelector('.what').textContent = c.text;
        el.addEventListener('click', () => onPick(c.id));
        el.addEventListener('pointerenter', () => onHover?.(c.id));
        el.addEventListener('pointerleave', () => onHover?.(null));
        el.addEventListener('focus', () => onHover?.(c.id));
        row.append(el);
      }
    },
    cursor: CURSOR,
    showContinue(fn) {
      cont.hidden = !fn;
      onContinue = fn;
    },
    fade(on) {
      $('.hud-fade').classList.toggle('on', on);
    },
    showReticle(on) {
      reticle.hidden = !on;
    },
    // reload: 0 = just fired .. 1 = ready
    setReticle(x, y, reload01) {
      reticle.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      const ready = reload01 >= 1;
      reload.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - Math.min(1, reload01))));
      reload.setAttribute('stroke', ready ? '#f1e9d8' : '#ffb347');
      cross.setAttribute('stroke', ready ? '#f1e9d8' : '#8f877a');
    },
    // kind: 'mg' | 'big' | 'kill' | 'heal' | 'chain' (text: what to show)
    damage(worldPos, amount, kind = 'mg', text = null) {
      const el = document.createElement('div');
      el.className = `hud-dmg ${kind}`;
      el.textContent = text ?? (kind === 'kill' ? 'KILL' : kind === 'heal' ? `+${Math.round(amount)}` : Math.round(amount));
      numbersEl.append(el);
      numbers.push({ el, p: worldPos.clone(), t: 0, vx: (Math.random() - 0.5) * 0.8, life: kind === 'mg' ? 0.55 : kind === 'chain' || kind === 'heal' ? 1.1 : 0.9 });
      if (numbers.length > 40) numbers.shift().el.remove();
    },
    // parts: [{ name, text, icon }] shown as icons with a hover summary
    // alt: an optional second button, [label, onClick]
    showEnd(kind, title, stats, button, onClick, bank = '', parts = [], alt = null) {
      const altBtn = end.querySelector('button.alt');
      altBtn.hidden = !alt;
      if (alt) {
        altBtn.textContent = alt[0];
        onAlt = alt[1];
      }
      end.hidden = false;
      const box = end.querySelector('.parts');
      box.hidden = !parts.length;
      const icons = box.querySelector('.icons');
      icons.innerHTML = '';
      for (const p of parts) {
        const el = document.createElement('div');
        el.className = 'icon';
        el.innerHTML = '<div class="tip panel"><b></b><span></span></div>';
        if (p.image) {
          const img = new Image();
          img.src = p.image;
          img.alt = p.name;
          el.prepend(img);
        } else {
          const cv = document.createElement('canvas');
          cv.width = 16;
          cv.height = 10;
          drawIcon(cv, p.icon);
          el.prepend(cv);
        }
        el.querySelector('.tip b').textContent = p.name;
        el.querySelector('.tip span').textContent = p.text;
        icons.append(el);
      }
      end.querySelector('.bank').textContent = bank;
      end.querySelector('.bank').hidden = !bank;
      end.className = `hud-end panel ${kind}`;
      end.querySelector('h2').textContent = title;
      end.querySelector('.stats').innerHTML = stats.map(([k, val]) => `<span>${k}</span><b>${val}</b>`).join('');
      end.querySelector('button.main').textContent = button;
      onEnd = onClick;
      reticle.hidden = true;
      end.querySelector('button.main').focus();
    },
    hideEnd() {
      end.hidden = true;
    },
    update(dt, camera, canvas) {
      const rect = canvas.getBoundingClientRect();
      if (promptTimer > 0) {
        promptTimer -= dt;
        if (promptTimer <= 0) prompt.hidden = true;
      }
      if (typed && typed.shown < typed.total) {
        typed.shown = Math.min(typed.total, typed.shown + dt * 70);
        let left = Math.floor(typed.shown);
        for (const x of typed.nodes) {
          const k = Math.min(x.full.length, left);
          x.n.textContent = x.full.slice(0, k);
          if (k > 0 && x.n.parentElement?.tagName === 'KBD') x.n.parentElement.style.visibility = '';
          left -= k;
        }
      }
      if (spotSpec) {
        const w = Math.ceil(rect.width / SPOT_PX);
        const h = Math.ceil(rect.height / SPOT_PX);
        if (spot.width !== w || spot.height !== h) {
          spot.width = w;
          spot.height = h;
        }
        spotG.globalCompositeOperation = 'source-over';
        spotG.clearRect(0, 0, w, h);
        spotG.fillStyle = 'rgba(6, 5, 9, 0.72)';
        spotG.fillRect(0, 0, w, h);
        const holes = [];
        for (const t of spotSpec.targets) {
          const p = typeof t === 'function' ? t() : t;
          if (!p) continue;
          const [x, y] = p.screen ? p.screen : toScreen(p, camera, rect);
          holes.push([(x - rect.left) / SPOT_PX, (y - rect.top) / SPOT_PX, (p.r || spotSpec.r || 90) / SPOT_PX]);
        }
        spotG.globalCompositeOperation = 'destination-out';
        for (const [x, y, r] of holes) {
          spotG.fillStyle = 'rgba(0,0,0,0.5)';
          spotG.beginPath();
          spotG.arc(Math.round(x), Math.round(y), r + 2, 0, Math.PI * 2);
          spotG.fill();
          spotG.fillStyle = '#000';
          spotG.beginPath();
          spotG.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
          spotG.fill();
        }
      }
      hurtT = Math.max(0, hurtT - dt);
      hurt.style.opacity = String(Math.min(1, hurtT * 4));
      if (arrowAt) {
        const p = typeof arrowAt === 'function' ? arrowAt() : arrowAt;
        if (!p) arrow.hidden = true;
        else {
          arrow.hidden = false;
          let [x, y] = toScreen(p, camera, rect);
          x = Math.min(rect.right - 90, Math.max(rect.left + 90, x));
          y = Math.min(rect.bottom - 40, Math.max(rect.top + 90, y));
          arrow.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
        }
      }
      if (markerAt) {
        const [x, y] = toScreen(markerAt, camera, rect);
        marker.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      }
      for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.t += dt;
        if (n.t > n.life) {
          n.el.remove();
          numbers.splice(i, 1);
          continue;
        }
        n.p.y += dt * 1.6;
        n.p.x += n.vx * dt;
        const [x, y] = toScreen(n.p, camera, rect);
        const pop = n.t < 0.08 ? 1.5 : 1;
        n.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%) scale(${pop})`;
        n.el.style.opacity = n.t > n.life * 0.7 ? '0.5' : '1';
      }
    },
    reset() {
      this.setSpot(null);
      this.showPicker(null);
      this.showContinue(null);
      this.setBoss(null, null);
      this.setChain(0, 0);
      this.setAbility(null);
      this.fade(false);
      for (const n of numbers) n.el.remove();
      numbers.length = 0;
      end.hidden = true;
      prompt.hidden = true;
      marker.hidden = true;
      markerAt = null;
      arrow.hidden = true;
      arrowAt = null;
      this.setObjective('');
    },
  };
}
