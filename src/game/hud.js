// In-game HUD: hull bar, objective, tutorial prompts, a reticle with the
// cannon's reload ring, floating damage numbers, an on-screen target marker
// and the end-of-run panel. Pixel type, black panels, bone-white text with
// hazard amber; red only means danger (damage taken, low hull, machines).
import * as THREE from 'three';
import { createAmmoStrip, createPassives } from '../ui/hudBits.js';
import { EFFECT_CSS } from './parts.js';
import { fixPixelifyH } from '../ui/fontFix.js';
import { tokenIconURL } from '../ui/icons.js';

const CSS = `
.cancelx { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.cancelx i { width: 60%; height: 60%; background: #ff3b2f; clip-path: polygon(20% 0, 50% 30%, 80% 0, 100% 20%, 70% 50%, 100% 80%, 80% 100%, 50% 70%, 20% 100%, 0 80%, 30% 50%, 0 20%); filter: drop-shadow(0 0 2px #000); animation: cancelPulse 0.6s steps(2) infinite; }
.cancelx b { position: absolute; left: 50%; bottom: -16px; transform: translateX(-50%); padding: 2px 4px; font: 400 9px/1 'Silkscreen', monospace; text-transform: uppercase; color: #fff; background: #a8241c; box-shadow: 0 0 0 2px #000; white-space: nowrap; }
@keyframes cancelPulse { 50% { opacity: 0.6; } }
.hud-card.improve .name .up { display: inline-block; margin-right: 6px; padding: 1px 4px; font-style: normal; color: #111; background: #6be08a; box-shadow: 0 0 0 2px #000; }
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
/* on a computer the tutorial line sits up in the middle of the view, big
   enough to actually get read */
.hud:not(.touch) .hud-prompt { position: absolute; left: 50%; top: 26vh; transform: translateX(-50%); width: min(620px, calc(100vw - 64px)); padding: 14px 22px 16px; }
.hud:not(.touch) .hud-prompt .text { font-size: 21px; text-align: center; }
.hud:not(.touch) .hud .hud-prompt[hidden], .hud:not(.touch) .hud-prompt[hidden] { transform: translate(-50%, -10px); }
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
.hud-token { padding: 6px 12px; font-size: 14px; display: flex; gap: 8px; align-items: center; color: #d9a8ff; }
.hud-token b { font-weight: 400; color: var(--ink); font-variant-numeric: tabular-nums; min-width: 2.5em; text-align: right; }
.hud-token i { width: 20px; height: 20px; background: url(${tokenIconURL()}) center / contain no-repeat; image-rendering: pixelated; }
.hud-token.pop { animation: hudpop 0.3s steps(3); box-shadow: 0 0 0 2px #000, 0 0 0 4px #c77dff, 0 0 18px 4px #c77dff88; }
.hud-scrap.intro { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--amber), 0 0 18px 4px #ffb34788; }
@keyframes hudpop { 50% { transform: scale(1.15); } }
.hud-chain { font: 400 22px/1 'Silkscreen', monospace; color: var(--amber); text-shadow: 2px 2px 0 #000, -2px 0 0 #000, 0 -2px 0 #000; display: grid; justify-items: end; gap: 4px; }
.hud-chain small { font-size: 11px; color: var(--ink); }
.hud-chain .t { width: 90px; height: 4px; background: #000; }
.hud-chain .t i { display: block; height: 100%; background: var(--amber); }
.hud-chain.pop { animation: hudpop 0.2s steps(2); }
.hud-spot { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; opacity: 0; transition: opacity 0.25s; }
.hud-spot.on { opacity: 1; }
.hud > * { transition: opacity 0.5s; }
.hud.gone > :not(.hud-end):not(.hud-fade) { opacity: 0 !important; }
.hud-speed { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
.hud-fade { position: absolute; inset: 0; background: #070609; opacity: 0; transition: opacity 0.35s steps(5); }
.hud-fade.on { opacity: 1; }
.hud-ability { position: absolute; left: 0; top: 0; width: 96px; height: 96px; margin: -48px 0 0 -48px; display: grid; place-items: center; }
.hud-ability canvas { position: absolute; inset: 0; width: 96px; height: 96px; image-rendering: pixelated; }
.hud-ability.cooling canvas { filter: brightness(0.55) saturate(0.6); }
.hud-ability .key { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); }
.hud-ability.ready canvas { filter: drop-shadow(0 0 4px #ffe2a0) drop-shadow(0 0 10px #ffb347aa); }
.hud-ability.ready::before { content: 'Ready'; position: absolute; left: 50%; top: -24px; transform: translateX(-50%); padding: 3px 6px 4px; font: 400 11px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.06em; color: #111; background: var(--go); box-shadow: 0 0 0 2px #000; white-space: nowrap; }
.hud.touch .hud-ability.ready::before { top: -20px; font-size: 10px; }
.hud-ability .cd { position: relative; font: 400 26px/1 'Silkscreen', monospace; color: var(--ink); text-shadow: 2px 2px 0 #000, -2px 0 0 #000, 0 -2px 0 #000; }
.hud:not(.touch) .hud-ability .cd { font-size: 20px; }
@keyframes hudready { 50% { filter: brightness(1.35); } }
.hud:not(.touch) .hud-ability { width: 84px; height: 84px; margin: -42px 0 0 -42px; }
.hud:not(.touch) .hud-ability canvas { width: 84px; height: 84px; }
/* on a computer the bottom of the screen is the tank's panel: HP in the
   bottom left, the ability buttons bottom right */
.hud:not(.touch) .hud-hull { position: fixed; left: 18px; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); min-width: 300px; padding: 10px 14px 12px; }
.hud:not(.touch) .hud-hull .row { font-size: 13px; }
.hud:not(.touch) .hud-bar { height: 16px; }
.hud-picker { position: absolute; left: 50%; bottom: calc(22vh + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: grid; gap: 14px; justify-items: center;
  width: min(660px, calc(100vw - 32px)); pointer-events: auto; }
.hud-picker .title { font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--go); text-shadow: 2px 2px 0 #000; }
.hud-picker .row { display: flex; gap: 16px; justify-content: center; align-items: stretch; flex-wrap: wrap; }
.hud-card { width: 184px; min-height: 150px; padding: 14px 12px 14px; display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; border: 0; color: var(--ink); font: inherit;
  transition: transform 0.12s steps(3); }
.hud-card .name { font: 400 13px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.hud-card .what { font-size: 13px; line-height: 1.25; }
.hud-card .fx { display: grid; gap: 3px; width: 100%; text-align: left; }
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
.hud-reticle .ammo-strip { position: absolute; left: 50%; top: 52px; transform: translateX(-50%); }
.hud-ammo { display: flex; align-items: center; gap: 10px; }
.hud-ammo .px { font-size: 12px; color: var(--dim); }
.hud-passives { right: calc(30px + env(safe-area-inset-right, 0px)); bottom: calc(170px + env(safe-area-inset-bottom, 0px)); }
.hud.touch .hud-passives { right: calc(46px + env(safe-area-inset-right, 0px)); bottom: calc(204px + env(safe-area-inset-bottom, 0px)); }
.hud-dmg { position: absolute; left: 0; top: 0; font: 400 16px/1 'Silkscreen', monospace; color: var(--ink);
  text-shadow: 2px 0 #000, -2px 0 #000, 0 2px #000, 0 -2px #000, 2px 2px #000; white-space: nowrap; transform: translate(-50%, -50%); }
.hud-dmg.big { font-size: 24px; color: var(--amber); }
.hud-dmg.kill { color: var(--danger); }
.hud-dmg.heal { color: #6bf08a; font-size: 18px; }
.hud-dmg.token { color: #d9a8ff; font-size: 18px; }
.hud-dmg.chain { color: var(--amber); font-size: 20px; }
.hud-marker { position: absolute; left: 0; top: 0; width: 76px; height: 76px; margin: -38px 0 0 -38px; }
.hud-marker::before, .hud-marker::after { content: ''; position: absolute; inset: 0; border: 3px solid var(--amber); clip-path: polygon(0 0, 30% 0, 30% 4px, 4px 4px, 4px 30%, 0 30%, 0 0, 100% 0, 100% 30%, calc(100% - 4px) 30%, calc(100% - 4px) 4px, 70% 4px, 70% 0, 100% 0, 100% 100%, 70% 100%, 70% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 70%, 100% 70%, 100% 100%, 0 100%, 0 70%, 4px 70%, 4px calc(100% - 4px), 30% calc(100% - 4px), 30% 100%, 0 100%); animation: hudpulse 0.9s steps(2) infinite; }
.hud-lock { position: absolute; left: 0; top: 0; width: 56px; height: 56px; margin: -28px 0 0 -28px; filter: drop-shadow(0 0 6px #3dff6e) drop-shadow(0 0 2px #3dff6e); --lc: #4dff7a; animation: lockBlink 0.5s steps(1) infinite; }
@keyframes lockBlink { 50% { --lc: #ffffff; } }
.hud-lock::before { content: ''; position: absolute; inset: 0; border: 3px solid var(--lc); clip-path: polygon(0 0, 30% 0, 30% 4px, 4px 4px, 4px 30%, 0 30%, 0 0, 100% 0, 100% 30%, calc(100% - 4px) 30%, calc(100% - 4px) 4px, 70% 4px, 70% 0, 100% 0, 100% 100%, 70% 100%, 70% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 70%, 100% 70%, 100% 100%, 0 100%, 0 70%, 4px 70%, 4px calc(100% - 4px), 30% calc(100% - 4px), 30% 100%, 0 100%); }
.hud-lock.on::before { animation: hudlock 0.35s steps(2) infinite; }
@keyframes hudlock { 50% { transform: scale(0.88); } }
.hud-lock span { position: absolute; left: 50%; top: -20px; transform: translateX(-50%); font: 400 11px/1 'Silkscreen', monospace; color: var(--lc); white-space: nowrap; text-shadow: 2px 2px #000; }
.hud-marker span { position: absolute; left: 50%; top: -22px; transform: translateX(-50%); font: 400 11px/1 'Silkscreen', monospace; color: var(--amber); white-space: nowrap; text-shadow: 2px 2px #000; }
@keyframes hudpulse { 50% { transform: scale(1.12); } }
.hud-banner { position: absolute; left: 50%; top: 30%; transform: translate(-50%, -50%); padding: 10px 22px 12px; font: 400 30px/1 'Silkscreen', monospace; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap;
  color: #111; background: var(--go, #6be08a); box-shadow: 0 0 0 3px #000, 6px 6px 0 3px #000; pointer-events: none; }
.hud.touch .hud-banner { font-size: 20px; }
.hud-pointers { position: absolute; inset: 0; pointer-events: none; }
.hud-pointers i { position: absolute; left: 50%; top: 50%; width: 0; height: 0; margin: -9px 0 0 -7px; border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-left: 14px solid var(--danger);
  filter: drop-shadow(1px 1px 0 #000) drop-shadow(-1px -1px 0 #000); }
.hud-pointers i.boss { border-left-color: #ff7a1a; }
.hud-hurt { position: absolute; inset: 0; box-shadow: inset 0 0 0 10px var(--danger), inset 0 0 160px 20px rgba(255, 40, 30, 0.6); background: rgba(255, 40, 30, 0.12); opacity: 0; }
.hud-hull.hit { animation: hudhit 0.3s steps(3); box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--danger), 4px 4px 0 4px #000; }
.hud-hull.hit .val { color: var(--danger); }
@keyframes hudhit { 0% { transform: translate(-5px, 2px); } 33% { transform: translate(5px, -2px); } 66% { transform: translate(-3px, 1px); } }
.hud-end { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 22px 28px 24px; display: grid; gap: 12px; justify-items: center;
  text-align: center; pointer-events: auto; min-width: min(360px, calc(100vw - 32px)); }
.hud-end h2 { margin: 0; font: 400 28px/1.1 'Silkscreen', monospace; letter-spacing: 0.04em; text-transform: uppercase; }
.hud-end.lose h2 { color: var(--danger); }
.hud-end.win h2 { color: var(--amber); }
.hud-end .stats { display: grid; grid-template-columns: auto auto; gap: 4px 18px; font-size: 14px; color: var(--dim); }
.hud-end .stats b { color: var(--ink); font-weight: 400; text-align: right; font-variant-numeric: tabular-nums; }
.hud-end button { margin-top: 6px; padding: 9px 18px 10px; border: 0; cursor: var(--cursor); font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase;
  color: #111; background: var(--amber); box-shadow: 0 4px 0 #8a5a1c; }
.hud-pause { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 22px 28px 24px; display: grid; gap: 12px; justify-items: stretch; min-width: 240px; pointer-events: auto; }
.hud-pause h2 { margin: 0 0 4px; text-align: center; font: 400 26px/1.1 'Silkscreen', monospace; text-transform: uppercase; color: var(--amber); }
.hud-pause button { padding: 10px 16px 11px; border: 0; font: 400 14px/1 'Silkscreen', monospace; text-transform: uppercase; color: var(--ink); background: #2a2628; box-shadow: 0 0 0 2px #000, 0 0 0 4px #6d655a; }
.hud-pause .menu, .hud-pause .ask { display: grid; gap: 12px; justify-items: stretch; }
.hud-pause .menu[hidden], .hud-pause .ask[hidden] { display: none; }
.hud-pause p { margin: 0 0 4px; text-align: center; font-size: 15px; color: var(--ink); }
.hud-pause .yn { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.hud-pause button[data-ask="yes"] { color: #fff; background: #a8241c; box-shadow: 0 4px 0 #5a1410; }
.hud-pause button[data-act="resume"] { color: #111; background: var(--go); box-shadow: 0 4px 0 #2f6b40; }
.hud-pause button:hover, .hud-pause button:focus-visible { filter: brightness(1.2); outline: none; }
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

// Boost ability icon (32x32 canvas, pixel art): a close-up picture of the
// boost on the tank (idle, or firing while it burns) in a frame; while it
// recharges the part still to fill stays dark, filling from the bottom.
// active: while a timed ability runs, the share of it left (1 .. 0): the
// button stays bright and the brightness drains down as it runs out
function drawAbility(c, k, lit, art, active = null) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = k >= 1 ? '#f1e9d8' : '#6d655a';
  g.fillRect(1, 1, 30, 30);
  g.fillStyle = '#1d1b1e';
  g.fillRect(3, 3, 26, 26);
  if (art) g.drawImage(art, 3, 3, 26, 26);
  if (lit && active != null) {
    // the frame and picture bright, a dark tide rising as it runs out
    g.fillStyle = '#f1e9d8';
    g.fillRect(1, 1, 30, 2);
    const used = Math.round(26 * (1 - Math.max(0, Math.min(1, active))));
    if (used > 0) {
      g.fillStyle = '#000000a0';
      g.fillRect(3, 3, 26, used);
    }
    return;
  }
  const h = Math.round(26 * (1 - Math.min(1, k)));
  if (h > 0 && !lit) {
    g.fillStyle = '#000000b0';
    g.fillRect(3, 3, 26, h);
  }
}

// a stable id per picture (so the icon redraws when the picture changes)
const artIds = new WeakMap();
let artNext = 0;
const artId = (o) => artIds.get(o) ?? (artIds.set(o, ++artNext), artNext);

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
// The pointer outside of combat (menus, the base): the same cross as the
// one inside the aiming circle: four short arms with a gap in the middle and
// a dot, bone on a black edge.
export const CURSOR = (() => {
  const N = 25;
  const C = 12; // the centre pixel
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const arms = (pad, color) => {
    g.fillStyle = color;
    for (const [x, y, w, h] of [
      [C - 11, C - 1, 7, 3], // left
      [C + 5, C - 1, 7, 3], // right
      [C - 1, C - 11, 3, 7], // up
      [C - 1, C + 5, 3, 7], // down
      [C - 1, C - 1, 3, 3], // the dot
    ])
      g.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
  };
  arms(1, '#000');
  arms(0, '#f1e9d8');
  return `url(${c.toDataURL()}) ${C} ${C}, crosshair`;
})();

let injected = false;
function inject() {
  if (injected) return;
  injected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600&family=Silkscreen&display=swap';
  document.head.append(link);
  fixPixelifyH(link);
  const style = document.createElement('style');
  style.textContent = CSS + EFFECT_CSS;
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
    <canvas class="hud-speed"></canvas>
    <canvas class="hud-spot"></canvas>
    <div class="hud-hurt"></div>
    <div class="hud-top">
      <div class="hud-hull panel"><div class="row"><span class="px">HP</span><span class="px val">100</span></div><div class="hud-bar"></div><div class="hud-ammo" hidden><span class="px">Ammo</span></div></div>
      <div class="hud-sectors panel px" hidden></div>
    </div>
    <div class="hud-right">
      <div class="hud-kills panel px" hidden>Destroyed <b>0</b></div>
      <div class="hud-scrap panel px" hidden><i></i>Scraps <b>0</b></div>
      <div class="hud-token panel px" hidden><i></i>Tokens <b>0</b></div>
      <div class="hud-chain px" hidden><span><small>Multiplier </small><span class="n">x2</span></span><div class="t"><i></i></div></div>
    </div>
    <div class="hud-picker" hidden><span class="title">Pick one part</span><div class="row"></div><button type="button" class="skip" hidden>Skip</button></div>
    <button type="button" class="hud-continue" hidden>Continue &#9654;</button>
    <div class="hud-arrow" hidden><span class="lbl"></span><i></i></div>
    <div class="hud-center">
      <div class="hud-obj panel" hidden><span class="px tag">Objective</span><span class="text"></span></div>
      <div class="hud-boss panel" hidden><div class="row px"><span class="name">Heavy machine</span><span class="val"></span></div><div class="bar"><i></i></div></div>
      <div class="hud-prompt panel" hidden><span class="px tag"></span><span class="text"></span></div>
    </div>
    <div class="hud-ability one" hidden><canvas width="32" height="32"></canvas><span class="cd"></span><kbd class="key">Shift</kbd></div>
    <div class="hud-ability two" hidden><canvas width="32" height="32"></canvas><span class="cd"></span><kbd class="key">E</kbd></div>
    <div class="hud-ability three" hidden><canvas width="32" height="32"></canvas><span class="cd"></span><kbd class="key">Q</kbd></div>
    <div class="hud-marker" hidden><span class="px"></span></div>
    <div class="hud-lock" hidden><span class="px"></span></div>
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
    <div class="hud-end panel" hidden><h2></h2><div class="stats"></div><div class="parts" hidden><span class="px">Parts found</span><div class="icons"></div></div><div class="bank px"></div><div class="btns"><button type="button" class="main"></button><button type="button" class="alt" hidden></button></div></div>
    <div class="hud-pause panel" hidden><div class="menu"><h2>Paused</h2><button type="button" data-act="resume">Resume</button><button type="button" data-act="restart">Restart level</button><button type="button" data-act="exit">Exit</button></div><div class="ask" hidden><h2>Exit level?</h2><p>You keep the parts you found, but this run's scraps will be lost!</p><div class="yn"><button type="button" data-ask="yes">Yes</button><button type="button" data-ask="no">No</button></div></div></div>
    <div class="hud-banner px" hidden></div>
    <div class="hud-pointers"></div>
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
  const lockEl = $('.hud-lock');
  const lockEls = [lockEl];
  const lockAts = [];
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
  // speed lines while boosting: pixel streaks rushing in from the screen's
  // edges, redrawn every frame so they flicker
  const speedEl = $('.hud-speed');
  const speedG = speedEl.getContext('2d');
  let speedOn = false;
  function drawSpeed(k) {
    const PX = 3;
    const w = Math.ceil(window.innerWidth / PX);
    const h = Math.ceil(window.innerHeight / PX);
    if (speedEl.width !== w || speedEl.height !== h) {
      speedEl.width = w;
      speedEl.height = h;
    }
    speedG.clearRect(0, 0, w, h);
    if (k <= 0.01) return;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.hypot(cx, cy);
    const n = Math.round(10 + 34 * k);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = R * (0.62 + Math.random() * 0.25 - 0.18 * k);
      const len = R * (0.15 + Math.random() * 0.3) * (0.5 + k);
      const c = Math.cos(a);
      const sn = Math.sin(a);
      speedG.strokeStyle = `rgba(241, 233, 216, ${(0.4 + Math.random() * 0.4) * k})`;
      speedG.lineWidth = Math.random() < 0.3 ? 2 : 1;
      speedG.beginPath();
      speedG.moveTo(Math.round(cx + c * r0), Math.round(cy + sn * r0));
      speedG.lineTo(Math.round(cx + c * (r0 + len)), Math.round(cy + sn * (r0 + len)));
      speedG.stroke();
    }
  }
  // ability button / icon
  // two ability buttons: the movement one (Shift) in the corner, the
  // signature one (E) beside it
  const abilityCenter = () => (touchMode ? { x: window.innerWidth - 92, y: window.innerHeight - 104 } : { x: window.innerWidth - 72, y: window.innerHeight - 72 });
  const ability2Center = () => {
    const c = abilityCenter();
    return touchMode ? { x: c.x - 118, y: c.y + 8 } : { x: c.x - 110, y: c.y };
  };
  // the equipment (Q), beside them
  const ability3Center = () => {
    const c = ability2Center();
    return touchMode ? { x: c.x - 118, y: c.y + 8 } : { x: c.x - 110, y: c.y };
  };
  const abilities = [
    { el: $('.hud-ability.one'), key: '', center: abilityCenter },
    { el: $('.hud-ability.two'), key: '', center: ability2Center },
    { el: $('.hud-ability.three'), key: '', center: ability3Center },
  ];
  // ammo: a strip of shells under the reticle (magazine guns) and in the HP
  // panel (every gun)
  const reticleAmmo = createAmmoStrip('small');
  reticle.append(reticleAmmo.el);
  const panelAmmoRow = $('.hud-ammo');
  const panelAmmo = createAmmoStrip('big');
  panelAmmoRow.append(panelAmmo.el);
  const passives = createPassives();
  root.append(passives.el);
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
  let hitTimer = 0;
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
      hurtT = 0.45;
      const el = $('.hud-hull');
      el.classList.remove('hit');
      void el.offsetWidth;
      el.classList.add('hit');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => el.classList.remove('hit'), 420);
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
    // arrows to machines out of view: [{ a (screen angle, radians, 0 =
    // right, clockwise), near (0..1), boss }]
    setPointers(list) {
      const box = $('.hud-pointers');
      while (box.children.length < list.length) box.append(document.createElement('i'));
      const R = Math.min(window.innerWidth, window.innerHeight) * 0.34;
      [...box.children].forEach((el, i) => {
        const p = list[i];
        el.style.display = p ? '' : 'none';
        if (!p) return;
        const s = 0.75 + p.near * 0.6;
        el.className = p.boss ? 'boss' : '';
        el.style.opacity = String(0.55 + p.near * 0.45);
        el.style.transform = `translate(${Math.cos(p.a) * R}px, ${Math.sin(p.a) * R}px) rotate(${p.a}rad) scale(${s})`;
      });
    },
    // a big strip across the screen for a moment ("Checkpoint reached")
    banner(text) {
      const el = $('.hud-banner');
      el.textContent = text;
      el.hidden = false;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { opacity: 0, transform: 'translate(-50%, -50%) scale(1.6)' },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(0.95)', offset: 0.12 },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.2 },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.8 },
          { opacity: 0, transform: 'translate(-50%, -70%) scale(1)' },
        ],
        { duration: 1800, easing: 'ease-out' },
      ).finished.then(() => (el.hidden = true), () => {});
    },
    clearPrompt() {
      prompt.hidden = true;
      promptTimer = 0;
    },
    // the guided missiles' lock boxes: [{ pos, label, locked }] (locked:
    // still locking on, the box pulsing)
    setLocks(list = []) {
      while (lockEls.length < list.length) {
        const el = lockEl.cloneNode(true);
        lockEl.after(el);
        lockEls.push(el);
      }
      lockEls.forEach((el, i) => {
        const l = list[i];
        el.hidden = !l;
        lockAts[i] = l ? l.pos : null;
        if (!l) return;
        el.classList.toggle('on', !!l.locked);
        const sp = el.querySelector('span');
        if (sp.textContent !== l.label) sp.textContent = l.label;
      });
    },
    setLock(worldPos, label = '', locked = false) {
      this.setLocks(worldPos ? [{ pos: worldPos, label, locked }] : []);
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
    setSectors(names, current, zone = 'Level 1') {
      const el = $('.hud-sectors');
      el.hidden = !names;
      if (!names) return;
      el.innerHTML = `<span class="zone">${zone}</span>` + names.map((n, i) => `${i ? '<span class="sep">-</span>' : ''}<span class="s ${i < current ? 'done' : i === current ? 'now' : ''}">${i < current ? '✓' : i + 1}</span>`).join('');
      el.title = names[current] || '';
    },
    // upgrade tokens picked up this level: only shown once there are any
    setTokens(n, pop = false) {
      const el = $('.hud-token');
      el.hidden = !n;
      el.querySelector('b').textContent = n;
      if (pop) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
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
    // ability: null hides it; k = cooldown progress (1 = ready). which: 0
    // the movement ability (Shift), 1 the signature one (E)
    setAbility(state, which = 0) {
      const a = abilities[which];
      const el = a.el;
      el.hidden = !state;
      if (!state) return;
      const key = `${Math.round(state.k * 26)}|${state.k >= 1}|${state.lit}|${state.active == null ? '' : Math.round(state.active * 26)}|${state.art?.width}|${state.art && artId(state.art)}`;
      if (key !== a.key) {
        a.key = key;
        drawAbility(el.querySelector('canvas'), state.k, state.lit, state.art, state.active);
      }
      el.classList.toggle('ready', state.k >= 1 && !state.lit);
      const cooling = state.left > 0 && !state.lit;
      el.classList.toggle('cooling', cooling);
      el.querySelector('.cd').textContent = cooling ? Math.ceil(state.left) : '';
      const c = a.center();
      el.style.transform = `translate(${c.x}px, ${c.y}px)`;
      el.querySelector('.key').hidden = touchMode;
      // aiming something that can be called off (the artillery strike): a
      // red cancel mark over the button (press it again to cancel)
      let x = el.querySelector('.cancelx');
      if (state.cancel && !x) {
        x = document.createElement('span');
        x.className = 'cancelx';
        x.innerHTML = '<i></i><b>Cancel</b>';
        el.append(x);
      }
      if (x) x.hidden = !state.cancel;
    },
    abilityCenter,
    ability2Center,
    ability3Center,
    // the whole HUD fades away (the tank's been destroyed); the end panel stays
    setGone(on) {
      root.classList.toggle('gone', on);
    },
    // k: 0..1 how hard the speed lines show
    setSpeed(k) {
      if (k <= 0.01 && !speedOn) return;
      speedOn = k > 0.01;
      drawSpeed(k);
    },
    scrapCenter() {
      const r = $('.hud-scrap').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
    },
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
      picker.querySelector('.skip').hidden = !skip;
      const row = picker.querySelector('.row');
      row.innerHTML = '';
      for (const c of list || []) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `hud-card panel${c.improve ? ' improve' : ''}`;
        el.innerHTML = '<span class="name"></span><span class="what"></span><span class="fx"></span><span class="take">Pick</span>';
        el.querySelector('.name').textContent = c.name;
        if (c.improve) el.querySelector('.name').insertAdjacentHTML('afterbegin', '<i class="up">▲</i>');
        el.querySelector('.what').textContent = c.text;
        el.querySelector('.fx').innerHTML = c.lines || ''; // the numbers (built from the part's own stats)
        el.addEventListener('click', () => onPick(c.id));
        el.addEventListener('pointerenter', () => onHover?.(c.id));
        el.addEventListener('pointerleave', () => onHover?.(null));
        el.addEventListener('focus', () => onHover?.(c.id));
        row.append(el);
      }
    },
    cursor: CURSOR,
    // the Esc menu: acts = { resume, restart, exit } (exit may be missing)
    showPause(acts) {
      const el = $('.hud-pause');
      el.hidden = !acts;
      if (!acts) return;
      const menu = el.querySelector('.menu');
      const ask = el.querySelector('.ask');
      const back = () => {
        ask.hidden = true;
        menu.hidden = false;
        el.querySelector('[data-act="resume"]').focus();
      };
      el.querySelector('[data-act="exit"]').hidden = !acts.exit;
      for (const b of menu.querySelectorAll('button')) b.onclick = () => acts[b.dataset.act]?.();
      // Exit asks first: the run's progress is lost
      el.querySelector('[data-act="exit"]').onclick = () => {
        menu.hidden = true;
        ask.hidden = false;
        el.querySelector('[data-ask="no"]').focus();
      };
      el.querySelector('[data-ask="yes"]').onclick = () => acts.exit?.();
      el.querySelector('[data-ask="no"]').onclick = back;
      back();
    },
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
    // ammo: { n, max, load (0..1 while reloading, else null) } or null to
    // hide it. A single-shot gun is max 1: one shell, filling as it reloads.
    setAmmo(ammo) {
      panelAmmoRow.hidden = !ammo;
      reticleAmmo.el.hidden = !ammo;
      if (!ammo) return;
      panelAmmo.set(ammo);
      reticleAmmo.set(ammo);
    },
    // passive perks: small icons with timers (see createPassives)
    setPassives(list) {
      passives.set(list);
    },
    // reload: 0 = just fired .. 1 = ready. cycling: an autocannon between
    // rounds (a dim white ring; the amber one is a real reload)
    setReticle(x, y, reload01, cycling = false) {
      reticle.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      const ready = reload01 >= 1;
      reload.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - Math.min(1, reload01))));
      reload.setAttribute('stroke', ready ? '#f1e9d8' : cycling ? '#8f887c' : '#ffb347');
      cross.setAttribute('stroke', ready ? '#f1e9d8' : '#8f877a');
    },
    // kind: 'mg' | 'big' | 'kill' | 'heal' | 'chain' (text: what to show)
    damage(worldPos, amount, kind = 'mg', text = null) {
      const el = document.createElement('div');
      el.className = `hud-dmg ${kind}`;
      el.textContent = text ?? (kind === 'kill' ? 'KILL' : kind === 'heal' ? `+${Math.round(amount)}` : Math.round(amount));
      numbersEl.append(el);
      numbers.push({ el, p: worldPos.clone(), t: 0, vx: (Math.random() - 0.5) * 0.8, life: kind === 'mg' ? 0.55 : kind === 'chain' || kind === 'heal' || kind === 'token' ? 1.1 : 0.9 });
      if (numbers.length > 40) numbers.shift().el.remove();
    },
    // parts: [{ name, text, icon }] shown as icons with a hover summary
    // alt: an optional second button, [label, onClick]; alt2 a third
    showEnd(kind, title, stats, button, onClick, bank = '', parts = [], alt = null, alt2 = null) {
      end.querySelector('button.alt2')?.remove();
      if (alt2) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'alt alt2';
        b.textContent = alt2[0];
        b.addEventListener('click', () => alt2[1]());
        end.querySelector('.btns').append(b);
      }
      const altBtn = end.querySelector('button.alt:not(.alt2)');
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
      end.querySelector('.stats').hidden = !stats.length;
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
      hurt.style.opacity = String(Math.min(1, hurtT * 3));
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
      lockAts.forEach((at, i) => {
        if (!at) return;
        const [lx, ly] = toScreen(at, camera, rect);
        lockEls[i].style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`;
      });
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
      this.setAbility(null, 1);
      this.setAbility(null, 2);
      this.setPassives([]);
      this.setAmmo(null);
      this.setGone(false);
      this.fade(false);
      for (const n of numbers) n.el.remove();
      numbers.length = 0;
      end.hidden = true;
      prompt.hidden = true;
      marker.hidden = true;
      markerAt = null;
      this.setLocks([]);
      arrow.hidden = true;
      arrowAt = null;
      this.setObjective('');
    },
  };
}
