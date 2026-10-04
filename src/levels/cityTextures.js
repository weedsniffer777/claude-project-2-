// Textures and materials shared by the city levels: worn glyph signs,
// hazard stripes, paving, panel-block facades (windows lit, gutted, holed),
// their blank ends and cut-away sides. Layout-free: each level lays its
// own street out.
import * as THREE from 'three';
import { gradientMap } from '../models/kit.js';
import { canvas, tex, blob, speckle } from './builder.js';

export const FH = 1.35; // floor height
export const PX = 12; // facade texels per world unit

export function glyphs(g, x, y, w, h, cells, color, rand) {
  const cw = w / cells;
  g.fillStyle = color;
  for (let i = 0; i < cells; i++) {
    if (rand() < 0.18) continue;
    const gx = x + i * cw + cw * 0.15;
    const gw = cw * 0.7;
    const strokes = 2 + ((rand() * 3) | 0);
    for (let s = 0; s < strokes; s++) {
      if (rand() < 0.5) g.fillRect(Math.round(gx + rand() * gw * 0.6), y, Math.max(1, Math.round(gw * 0.22)), h);
      else g.fillRect(gx, Math.round(y + rand() * h * 0.8), Math.round(gw * (0.5 + rand() * 0.5)), Math.max(1, Math.round(h * 0.2)));
    }
  }
}

// Worn sign panel with abstract glyphs: reads as signage, is no real script.
export function glyphSign(w, h, { board = '#2c3034', ink = '#c9c1a8', rand }) {
  const S = 16;
  const [c, g] = canvas(w * S, h * S);
  g.fillStyle = board;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 0, c.width, 2);
  const cells = Math.max(2, Math.round(w / (h * 0.75)));
  glyphs(g, c.width * 0.06, c.height * 0.22, c.width * 0.88, c.height * 0.56, cells, ink, rand);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = board;
    blob(g, rand() * c.width, rand() * c.height, 3 + rand() * 8, 2 + rand() * 6, rand);
  }
  g.fillStyle = 'rgba(110,70,40,0.5)';
  for (let i = 0; i < 5; i++) g.fillRect((rand() * c.width) | 0, (rand() * c.height * 0.5) | 0, 1, 4 + rand() * 10);
  return tex(c);
}

export function hazardTexture() {
  const [c, g] = canvas(32, 32);
  g.fillStyle = '#2a2b2d';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#c99a2e';
  for (let i = -32; i < 64; i += 16) {
    g.beginPath();
    g.moveTo(i, 32);
    g.lineTo(i + 8, 32);
    g.lineTo(i + 40, 0);
    g.lineTo(i + 32, 0);
    g.fill();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function sidewalkTexture(rand) {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#b9bbbf';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#a7a8aa';
  for (let i = 0; i < 26; i++) blob(g, rand() * 64, rand() * 64, 3 + rand() * 8, 2 + rand() * 5, rand);
  g.fillStyle = '#8f8f8f';
  for (let i = 0; i < 6; i++) blob(g, rand() * 64, rand() * 64, 2 + rand() * 4, 1 + rand() * 3, rand);
  g.fillStyle = '#00000018';
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 1, 64);
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 1);
  speckle(g, 64, 64, ['#9d9ea1', '#c9cbcf', '#7b7a78', '#d3d5d9'], 520, rand);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// pierce: windows the sun shines straight through (gutted rooms), as
// [{ f, k }] (floor from the ground, column from the west end).
export function facadeTextures(w, floors, o, rand, pierce = []) {
  const H = floors * FH + 0.5;
  const [c, g] = canvas(w * PX, H * PX);
  const [ce, ge] = canvas(w * PX, H * PX);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, ce.width, ce.height);
  g.fillStyle = o.panel;
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#00000018', '#ffffff10', '#00000010'], c.width * c.height * 0.08, rand);

  const cols = Math.max(2, Math.round(w / 1.7));
  const cw = (w / cols) * PX;
  const fh = FH * PX;
  const top = 0.5 * PX;
  const doors = new Set();
  for (let i = 1; i < cols; i += 4) doors.add(i);
  const pierced = new Set(pierce.map((p) => `${p.f},${p.k}`));
  const R = (x, y, ww, hh, ctx) => ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));

  for (let f = 0; f < floors; f++) {
    const fy = c.height - (f + 1) * fh;
    g.fillStyle = '#00000030';
    g.fillRect(0, Math.round(fy + fh - 1), c.width, 1);
    if (o.accent && f > 0) {
      g.fillStyle = o.accent;
      g.fillRect(0, Math.round(fy + fh - 0.32 * PX), c.width, Math.round(0.24 * PX));
    }
    for (let k = 0; k < cols; k++) {
      const x0 = k * cw;
      g.fillStyle = '#00000022';
      g.fillRect(Math.round(x0), Math.round(fy), 1, Math.round(fh));
      let wx = x0 + cw * 0.22;
      let ww = cw * 0.56;
      let wy = fy + 0.28 * PX;
      let wh = 0.62 * PX;
      if (f === 0 && o.shop) {
        wx = x0 + 0.12 * PX;
        ww = cw - 0.24 * PX;
        wy = fy + 0.3 * PX;
        wh = 0.8 * PX;
      } else if (f === 0 && doors.has(k)) {
        g.fillStyle = '#2b2a2a';
        R(x0 + cw * 0.3, fy + 0.2 * PX, cw * 0.4, fh - 0.2 * PX, g);
        continue;
      }
      if (pierced.has(`${f},${k}`)) {
        // sun blazing straight through a gutted room
        g.fillStyle = ge.fillStyle = '#ffe2b0';
        R(wx, wy, ww, wh, g);
        R(wx, wy, ww, wh, ge);
        g.fillStyle = ge.fillStyle = '#ffc77e';
        R(wx, wy + wh * 0.6, ww, wh * 0.4, g);
        R(wx, wy + wh * 0.6, ww, wh * 0.4, ge);
        continue;
      }
      const roll = rand();
      let glass = '#2c3242';
      let lit = null;
      if (roll < o.broken) glass = '#111215';
      else if (roll < o.broken + 0.05) lit = '#ffbe72';
      else if (roll < o.broken + 0.08) lit = '#cfe6ff';
      g.fillStyle = lit || glass;
      R(wx, wy, ww, wh, g);
      if (lit) {
        ge.fillStyle = lit;
        R(wx, wy, ww, wh, ge);
        if (rand() < 0.5) {
          g.fillStyle = ge.fillStyle = '#2a2622';
          R(wx, wy, ww * 0.3, wh, g);
          R(wx, wy, ww * 0.3, wh, ge);
        }
      } else if (glass === '#111215') {
        g.fillStyle = '#1b1b1d55';
        blob(g, wx + ww / 2, wy - wh * 0.3, ww * 0.7, wh * 0.9, rand);
      } else {
        g.fillStyle = '#4a5366';
        g.fillRect(Math.round(wx), Math.round(wy), Math.round(ww * 0.3), 1);
      }
      g.fillStyle = '#d5d8dc';
      g.fillRect(Math.round(wx - 1), Math.round(wy + wh), Math.round(ww + 2), 1);
      g.fillStyle = '#00000020';
      g.fillRect(Math.round(wx + ww * 0.4), Math.round(wy + wh + 1), 2, Math.round(fh * (0.3 + rand() * 0.5)));
    }
  }
  g.fillStyle = '#00000038';
  g.fillRect(0, 0, c.width, Math.round(top));
  g.fillStyle = '#d6d9de';
  g.fillRect(0, 0, c.width, 1);
  for (let i = 0; i < o.holes; i++) {
    const hx = rand() * c.width;
    const hy = top + rand() * (c.height - top - fh);
    const r = (0.5 + rand() * 0.9) * PX;
    g.fillStyle = '#26262833';
    blob(g, hx, hy - r * 0.6, r * 2, r * 1.8, rand, 11);
    g.fillStyle = '#6f6c66';
    blob(g, hx, hy, r * 1.25, r * 1.1, rand, 11);
    g.fillStyle = '#121214';
    blob(g, hx, hy, r, r * 0.85, rand, 11);
  }
  return { map: tex(c), emissiveMap: tex(ce) };
}

export function endTexture(d, floors, o, rand, mural) {
  const H = floors * FH + 0.5;
  const [c, g] = canvas(d * PX, H * PX);
  g.fillStyle = o.panel;
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#00000018', '#ffffff10'], c.width * c.height * 0.08, rand);
  g.fillStyle = '#00000028';
  for (let y = c.height; y > 0; y -= FH * PX) g.fillRect(0, Math.round(y), c.width, 1);
  for (let x = 0; x < c.width; x += 2.4 * PX) g.fillRect(Math.round(x), 0, 1, c.height);
  if (mural) {
    const cx = c.width * 0.5;
    const cy = c.height * 0.42;
    const Rr = Math.min(c.width, c.height) * 0.28;
    const tile = 3;
    for (let y = 0; y < c.height; y += tile) {
      for (let x = 0; x < c.width; x += tile) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        let col = null;
        if (r < Rr) col = r < Rr * 0.55 ? '#c6a35a' : '#5f8a9a';
        else if (r < Rr * 1.9 && Math.sin(a * 9) > 0.55 && y < cy) col = '#a3874e';
        else if (y > c.height * 0.72 && y < c.height * 0.8) col = '#4e6f86';
        else if (Math.abs(y - (cy + Rr * 1.2 + Math.sin(x * 0.05) * 12)) < 5) col = '#7b8f6e';
        if (!col || rand() < 0.16) continue;
        g.fillStyle = col;
        g.fillRect(x, y, tile - 1, tile - 1);
      }
    }
    for (let i = 0; i < 7; i++) {
      g.fillStyle = o.panel;
      blob(g, rand() * c.width, rand() * c.height, 6 + rand() * 14, 5 + rand() * 12, rand);
    }
  }
  return tex(c);
}

export function cutawayTexture(d, floors, rand) {
  const H = floors * FH + 0.5;
  const [c, g] = canvas(d * PX, H * PX);
  g.fillStyle = '#1d1c1e';
  g.fillRect(0, 0, c.width, c.height);
  const papers = ['#5d6a5a', '#6e6250', '#56607a', '#7a6c5e', '#4f5a5c'];
  for (let f = 0; f < floors; f++) {
    const y = c.height - (f + 1) * FH * PX;
    for (let x = 0; x < c.width; x += 2.6 * PX) {
      if (rand() < 0.3) continue;
      g.fillStyle = papers[(rand() * papers.length) | 0];
      g.fillRect(Math.round(x + 2), Math.round(y + 3), Math.round(2.6 * PX - 4), Math.round(FH * PX - 6));
      g.fillStyle = '#00000044';
      g.fillRect(Math.round(x + 2), Math.round(y + 3), 3, Math.round(FH * PX - 6));
    }
    g.fillStyle = '#8c8a85';
    g.fillRect(0, Math.round(y + FH * PX - 3), c.width, 3);
  }
  return tex(c);
}

export const facadeMat = (t) => new THREE.MeshToonMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.1, gradientMap });
export const mapMat = (map) => new THREE.MeshToonMaterial({ map, gradientMap });
