import * as THREE from 'three';
import { TAU, rand, pick, clamp } from './util.js';

const INK = '#1b2fb8';
const RED = '#d42b3a';

const cache = new Map();
function canvasTex(key, w, h, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  if (opts.wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  cache.set(key, t);
  return t;
}

// ---------------- sketch primitives ----------------
function smoothClosed(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

function circlePts(cx, cy, r, n = 20, wobble = 0.05) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + rand(-wobble, wobble));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

export function sketchLine(ctx, pts, o = {}) {
  const color = o.color || INK;
  const width = o.width ?? 4;
  const jitter = o.jitter ?? 1.6;
  const passes = o.passes ?? 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0] + rand(-jitter, jitter) + (p === 1 ? rand(-0.6, 0.6) : 0);
      const y = pts[i][1] + rand(-jitter, jitter) + (p === 1 ? rand(-0.6, 0.6) : 0);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    if (o.close) ctx.closePath();
    ctx.lineWidth = width * rand(0.78, 1.12);
    ctx.stroke();
  }
  ctx.restore();
}

export function sketchCircle(ctx, cx, cy, r, o = {}) {
  const pts = circlePts(cx, cy, r, o.n ?? 22, o.wobble ?? 0.06);
  if (o.fill) {
    ctx.save();
    ctx.globalAlpha = o.fillAlpha ?? 0.75;
    ctx.fillStyle = o.fill;
    smoothClosed(ctx, pts);
    ctx.fill();
    ctx.restore();
  }
  const jitter = o.jitter ?? 1.8;
  for (let p = 0; p < (o.passes ?? 2); p++) {
    const pts2 = pts.map(([x, y]) => [x + rand(-jitter, jitter), y + rand(-jitter, jitter)]);
    ctx.save();
    ctx.strokeStyle = o.color || INK;
    ctx.lineWidth = (o.width ?? 4) * rand(0.8, 1.1);
    ctx.globalAlpha = o.alpha ?? 1;
    smoothClosed(ctx, pts2);
    ctx.stroke();
    ctx.restore();
  }
}

function scribbleFill(ctx, cx, cy, r, color, alpha = 0.35, n = 26) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = rand(2, 4);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const rr = rand(0, r);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------- ground doodles ----------------
function doodleSun(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.5, r = w * 0.2;
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * TAU + 0.12;
    sketchLine(ctx, [
      [cx + Math.cos(a) * r * 1.18, cy + Math.sin(a) * r * 1.18],
      [cx + Math.cos(a) * r * 1.48, cy + Math.sin(a) * r * 1.48],
    ], { width: 5, jitter: 2.4 });
  }
  sketchCircle(ctx, cx, cy, r, { fill: 'rgba(242,201,76,0.55)', width: 6, jitter: 2.6 });
  // face
  sketchCircle(ctx, cx - r * 0.34, cy - r * 0.18, r * 0.12, { width: 4, jitter: 1.4 });
  sketchCircle(ctx, cx + r * 0.34, cy - r * 0.18, r * 0.12, { width: 4, jitter: 1.4 });
  sketchLine(ctx, [[cx - r * 0.3, cy + r * 0.3], [cx, cy + r * 0.44], [cx + r * 0.3, cy + r * 0.3]], { width: 5, jitter: 1.5 });
}

function doodleHouse(ctx, w, h) {
  const cx = w * 0.5, base = h * 0.76, hw = w * 0.26, top = h * 0.42;
  sketchLine(ctx, [[cx - hw, base], [cx - hw, top + h * 0.06], [cx + hw, top + h * 0.06], [cx + hw, base], [cx - hw, base]], { width: 5, jitter: 2, close: false });
  sketchLine(ctx, [[cx - hw * 1.15, top + h * 0.07], [cx, top - h * 0.16], [cx + hw * 1.15, top + h * 0.07]], { width: 5, jitter: 2 });
  // door + window
  sketchLine(ctx, [[cx - hw * 0.25, base], [cx - hw * 0.25, base - h * 0.22], [cx + hw * 0.25, base - h * 0.22], [cx + hw * 0.25, base]], { width: 4, jitter: 1.4 });
  sketchCircle(ctx, cx + hw * 0.1, base - h * 0.11, 3, { width: 3, jitter: 1 });
  sketchLine(ctx, [[cx - hw * 0.62, top + h * 0.16], [cx - hw * 0.28, top + h * 0.16]], { width: 4, jitter: 1 });
  sketchLine(ctx, [[cx - hw * 0.62, top + h * 0.16], [cx - hw * 0.62, top + h * 0.34], [cx - hw * 0.28, top + h * 0.34], [cx - hw * 0.28, top + h * 0.16]], { width: 4, jitter: 1 });
  // chimney smoke
  for (let i = 0; i < 3; i++) {
    sketchCircle(ctx, cx + hw * 0.72 + i * 7, top - h * 0.22 - i * 16, 6 + i * 3, { width: 3, jitter: 1.4 });
  }
}

function doodleCat(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.55, r = w * 0.2;
  sketchLine(ctx, [[cx - r * 0.85, cy - r * 0.5], [cx - r * 0.7, cy - r * 1.25], [cx - r * 0.15, cy - r * 0.85]], { width: 5, jitter: 2 });
  sketchLine(ctx, [[cx + r * 0.85, cy - r * 0.5], [cx + r * 0.7, cy - r * 1.25], [cx + r * 0.15, cy - r * 0.85]], { width: 5, jitter: 2 });
  sketchCircle(ctx, cx, cy, r, { width: 6, jitter: 2.4 });
  sketchCircle(ctx, cx - r * 0.35, cy - r * 0.15, r * 0.14, { width: 4, jitter: 1.2 });
  sketchCircle(ctx, cx + r * 0.35, cy - r * 0.15, r * 0.14, { width: 4, jitter: 1.2 });
  sketchLine(ctx, [[cx, cy + r * 0.05], [cx, cy + r * 0.28]], { width: 3, jitter: 1 });
  sketchLine(ctx, [[cx, cy + r * 0.28], [cx - r * 0.18, cy + r * 0.45]], { width: 3, jitter: 1 });
  sketchLine(ctx, [[cx, cy + r * 0.28], [cx + r * 0.18, cy + r * 0.45]], { width: 3, jitter: 1 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      sketchLine(ctx, [[cx + s * r * 0.55, cy + r * (0.05 + i * 0.12)], [cx + s * r * 1.25, cy + r * (0.0 + i * 0.18)]], { width: 3, jitter: 1.6 });
    }
  }
}

function doodleFlower(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.5, r = w * 0.1;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    sketchCircle(ctx, cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5, r, { fill: 'rgba(239,143,171,0.4)', width: 4, jitter: 1.8 });
  }
  sketchCircle(ctx, cx, cy, r * 0.7, { fill: 'rgba(242,201,76,0.6)', width: 4, jitter: 1.4 });
  sketchLine(ctx, [[cx, cy + r * 1.9], [cx, cy + r * 3.2]], { width: 4, jitter: 1.5 });
  sketchLine(ctx, [[cx, cy + r * 2.5], [cx - r * 0.8, cy + r * 2.2]], { width: 3, jitter: 1.2 });
}

function doodleTicTacToe(ctx, w, h) {
  const s = w * 0.17, cx = w * 0.5, cy = h * 0.5;
  for (const d of [-1, 1]) {
    sketchLine(ctx, [[cx + d * s, cy - s * 1.5], [cx + d * s, cy + s * 1.5]], { width: 6, jitter: 2.2 });
    sketchLine(ctx, [[cx - s * 1.5, cy + d * s], [cx + s * 1.5, cy + d * s]], { width: 6, jitter: 2.2 });
  }
  const cells = [[-1, -1], [0, 0], [1, -1], [-1, 1], [1, 1]];
  cells.forEach(([gx, gy], i) => {
    const x = cx + gx * s, y = cy + gy * s;
    if (i % 2 === 0) {
      sketchLine(ctx, [[x - s * 0.3, y - s * 0.3], [x + s * 0.3, y + s * 0.3]], { width: 6, jitter: 1.6, color: RED });
      sketchLine(ctx, [[x + s * 0.3, y - s * 0.3], [x - s * 0.3, y + s * 0.3]], { width: 6, jitter: 1.6, color: RED });
    } else {
      sketchCircle(ctx, x, y, s * 0.32, { width: 6, jitter: 2 });
    }
  });
}

function doodleHopscotch(ctx, w, h) {
  const s = w * 0.13;
  const boxes = [[0, -2.2], [-0.55, -1.1], [0.55, -1.1], [0, 0], [-0.55, 1.1], [0.55, 1.1], [0, 2.2]];
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  boxes.forEach(([bx, by], i) => {
    sketchLine(ctx, [
      [bx * s - s, by * s - s], [bx * s + s, by * s - s], [bx * s + s, by * s + s], [bx * s - s, by * s + s],
    ], { width: 4, jitter: 1.8, close: true });
    ctx.save();
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.75;
    ctx.font = `bold ${s * 0.9}px "Patrick Hand", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), bx * s, by * s + 2);
    ctx.restore();
  });
  ctx.restore();
}

function doodleArrowText(ctx, w, h, text) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.72;
  ctx.font = `bold ${w * 0.13}px "Patrick Hand", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(w * 0.5, h * 0.36);
  ctx.rotate(-0.05);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  sketchLine(ctx, [[w * 0.2, h * 0.66], [w * 0.8, h * 0.66]], { width: 7, jitter: 2 });
  sketchLine(ctx, [[w * 0.62, h * 0.52], [w * 0.82, h * 0.66], [w * 0.62, h * 0.8]], { width: 7, jitter: 2 });
}

function doodleStickman(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.42, r = w * 0.09;
  sketchCircle(ctx, cx, cy, r, { width: 5, jitter: 2 });
  sketchLine(ctx, [[cx, cy + r], [cx, cy + r * 3.1]], { width: 5, jitter: 1.6 });
  sketchLine(ctx, [[cx, cy + r * 1.4], [cx - r * 1.5, cy + r * 2.2]], { width: 5, jitter: 1.6 });
  sketchLine(ctx, [[cx, cy + r * 1.4], [cx + r * 1.6, cy + r * 0.6]], { width: 5, jitter: 1.6 });
  sketchLine(ctx, [[cx, cy + r * 3.1], [cx - r * 1.2, cy + r * 4.3]], { width: 5, jitter: 1.6 });
  sketchLine(ctx, [[cx, cy + r * 3.1], [cx + r * 1.2, cy + r * 4.3]], { width: 5, jitter: 1.6 });
  sketchCircle(ctx, cx - r * 0.35, cy - r * 0.1, r * 0.12, { width: 3, jitter: 1 });
  sketchCircle(ctx, cx + r * 0.35, cy - r * 0.1, r * 0.12, { width: 3, jitter: 1 });
  sketchLine(ctx, [[cx - r * 0.3, cy + r * 0.35], [cx + r * 0.3, cy + r * 0.35]], { width: 3, jitter: 1 });
}

function doodleSpiral(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.5;
  const pts = [];
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const a = t * TAU * 3.2;
    const r = t * w * 0.34;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  sketchLine(ctx, pts, { width: 4, jitter: 0.8, passes: 1 });
}

function doodleStar(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.5, R = w * 0.32, r = R * 0.42;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  sketchLine(ctx, pts, { width: 6, jitter: 2, close: true, color: RED });
  sketchCircle(ctx, cx, cy, R * 0.22, { width: 4, jitter: 1.4, color: RED });
}

function doodleScribble(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.5;
  for (let i = 0; i < 5; i++) {
    const pts = [];
    for (let k = 0; k < 14; k++) {
      const a = k * 0.9 + i;
      pts.push([cx + Math.cos(a) * w * 0.22 * (0.6 + k * 0.03), cy + Math.sin(a * 1.3) * h * 0.18 * (0.6 + k * 0.03)]);
    }
    sketchLine(ctx, pts, { width: 3, jitter: 2, alpha: 0.55 });
  }
}

function doodleMath(ctx, w, h) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(-0.12);
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.55;
  ctx.font = `italic ${w * 0.11}px "Caveat", "Patrick Hand", cursive`;
  ctx.textAlign = 'center';
  const lines = ['MATH IS HARD', '2 + 2 = 5', 'don\'t erase me!'];
  lines.forEach((t, i) => ctx.fillText(t, 0, (i - 1) * w * 0.17));
  ctx.restore();
  // little doodles around
  sketchLine(ctx, [[w * 0.15, h * 0.18], [w * 0.3, h * 0.12]], { width: 3, jitter: 1.5 });
  sketchCircle(ctx, w * 0.82, h * 0.2, w * 0.05, { width: 3, jitter: 1.2 });
}

function doodleKite(ctx, w, h) {
  const cx = w * 0.5, cy = h * 0.42;
  sketchLine(ctx, [[cx, cy - w * 0.24], [cx + w * 0.17, cy], [cx, cy + w * 0.26], [cx - w * 0.17, cy], [cx, cy - w * 0.24]], { width: 5, jitter: 2 });
  sketchLine(ctx, [[cx, cy - w * 0.24], [cx, cy + w * 0.26]], { width: 3, jitter: 1.4 });
  const tail = [[cx, cy + w * 0.26]];
  for (let i = 1; i < 6; i++) tail.push([cx + Math.sin(i * 1.2) * w * 0.09, cy + w * 0.26 + i * w * 0.09]);
  sketchLine(ctx, tail, { width: 3, jitter: 2.2 });
}

// ---------------- splats ----------------
function splat(ctx, w, h, seed) {
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = '#000';
  const main = [];
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = w * (0.16 + Math.abs(Math.sin(a * 3 + seed)) * 0.1 + rand(-0.03, 0.03));
    main.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  smoothClosed(ctx, main);
  ctx.fill();
  // droplets
  for (let i = 0; i < 22; i++) {
    const a = rand(0, TAU), d = rand(w * 0.18, w * 0.46);
    const r = rand(2, w * 0.035) * (1 - d / w);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * rand(0.6, 1.4), r, a, 0, TAU);
    ctx.fill();
  }
  // drips
  for (let i = 0; i < 4; i++) {
    const a = rand(0.6, 2.5);
    const x = cx + Math.cos(a) * w * 0.2, y = cy + Math.sin(a) * w * 0.2;
    ctx.beginPath();
    ctx.ellipse(x, y + w * 0.07, w * 0.018, w * 0.09, 0, 0, TAU);
    ctx.fill();
  }
}

export function getSplat(i) {
  return canvasTex('splat' + i, 256, 256, (c, w, h) => splat(c, w, h, i * 3.7 + 1.3));
}

// ---------------- sky / scenery ----------------
export function getCloud(i) {
  return canvasTex('cloud' + i, 512, 256, (ctx, w, h) => {
    const cy = h * 0.62;
    const blobs = [
      [w * 0.3, cy, w * 0.13], [w * 0.42, cy - h * 0.13, w * 0.15], [w * 0.56, cy - h * 0.1, w * 0.14],
      [w * 0.68, cy, w * 0.13], [w * 0.5, cy + h * 0.02, w * 0.17],
    ];
    ctx.save();
    ctx.fillStyle = 'rgba(255,253,245,0.92)';
    for (const [x, y, r] of blobs) {
      const pts = circlePts(x, y, r, 18, 0.08);
      smoothClosed(ctx, pts);
      ctx.fill();
    }
    ctx.restore();
    for (const [x, y, r] of blobs) {
      sketchCircle(ctx, x, y, r, { width: 4, jitter: 2.4, alpha: 0.5 });
    }
    sketchLine(ctx, [[w * 0.16, cy + h * 0.1], [w * 0.84, cy + h * 0.1]], { width: 3, jitter: 2, alpha: 0.35 });
  });
}

export function getTree() {
  return canvasTex('tree', 512, 768, (ctx, w, h) => {
    // trunk
    sketchLine(ctx, [[w * 0.46, h * 0.95], [w * 0.47, h * 0.55], [w * 0.5, h * 0.42]], { width: 12, jitter: 2, color: '#7a4a2a' });
    sketchLine(ctx, [[w * 0.56, h * 0.95], [w * 0.54, h * 0.55], [w * 0.5, h * 0.42]], { width: 12, jitter: 2, color: '#7a4a2a' });
    // canopy
    const blobs = [[w * 0.5, h * 0.28, w * 0.2], [w * 0.32, h * 0.36, w * 0.15], [w * 0.68, h * 0.36, w * 0.15], [w * 0.42, h * 0.18, w * 0.14], [w * 0.6, h * 0.2, w * 0.13]];
    ctx.save();
    ctx.fillStyle = 'rgba(120,190,120,0.55)';
    for (const [x, y, r] of blobs) {
      smoothClosed(ctx, circlePts(x, y, r, 18, 0.09));
      ctx.fill();
    }
    ctx.restore();
    for (const [x, y, r] of blobs) {
      sketchCircle(ctx, x, y, r, { width: 5, jitter: 3, alpha: 0.85, color: '#2f6b3a' });
    }
    // grass at base
    for (let i = 0; i < 7; i++) {
      sketchLine(ctx, [[w * (0.4 + i * 0.03), h * 0.95], [w * (0.36 + i * 0.045), h * 0.88]], { width: 3, jitter: 1.5, color: '#2f6b3a' });
    }
  });
}

export function getBush() {
  return canvasTex('bush', 512, 256, (ctx, w, h) => {
    const blobs = [[w * 0.3, h * 0.7, w * 0.14], [w * 0.45, h * 0.6, w * 0.16], [w * 0.62, h * 0.68, w * 0.14], [w * 0.5, h * 0.75, w * 0.18]];
    ctx.save();
    ctx.fillStyle = 'rgba(120,190,120,0.5)';
    for (const [x, y, r] of blobs) { smoothClosed(ctx, circlePts(x, y, r, 16, 0.1)); ctx.fill(); }
    ctx.restore();
    for (const [x, y, r] of blobs) sketchCircle(ctx, x, y, r, { width: 4, jitter: 2.5, alpha: 0.8, color: '#2f6b3a' });
  });
}

export function getGrass() {
  return canvasTex('grass', 256, 256, (ctx, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = w * (0.2 + i * 0.075);
      sketchLine(ctx, [[x, h * 0.92], [x + rand(-14, 14), h * rand(0.35, 0.62)]], { width: 3, jitter: 1.4, color: '#3f8a4a' });
    }
  });
}

export function getMountain() {
  return canvasTex('mountain', 1024, 512, (ctx, w, h) => {
    const peaks = [
      [[0, h], [w * 0.12, h * 0.45], [w * 0.26, h * 0.72], [w * 0.4, h * 0.3], [w * 0.55, h * 0.68], [w * 0.7, h * 0.38], [w * 0.86, h * 0.7], [w, h * 0.5], [w, h]],
    ];
    for (const pts of peaks) {
      ctx.save();
      ctx.fillStyle = 'rgba(150,160,200,0.25)';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      sketchLine(ctx, pts, { width: 6, jitter: 3, alpha: 0.55, color: '#4a5aa8' });
      // snow caps
      for (let i = 1; i < pts.length - 1; i++) {
        if (pts[i][1] < h * 0.45) {
          sketchLine(ctx, [[pts[i][0] - 22, pts[i][1] + 34], [pts[i][0], pts[i][1] + 8], [pts[i][0] + 22, pts[i][1] + 34]], { width: 4, jitter: 2, alpha: 0.5, color: '#ffffff' });
        }
      }
    }
  });
}

// ---------------- weapons ----------------
function pencilSprite(ctx, w, h) {
  ctx.save();
  ctx.translate(w * 0.66, h * 0.82);
  ctx.rotate(-2.32);
  const L = w * 0.62, bw = w * 0.075;
  // eraser
  ctx.fillStyle = '#ef8fab';
  ctx.beginPath();
  ctx.roundRect(-L * 0.52, -bw / 2, L * 0.1, bw, 10);
  ctx.fill();
  sketchLine(ctx, [[-L * 0.52, -bw / 2], [-L * 0.42, -bw / 2], [-L * 0.42, bw / 2], [-L * 0.52, bw / 2]], { width: 4, jitter: 1.2, close: true });
  // ferrule
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(-L * 0.43, -bw / 2, L * 0.07, bw);
  sketchLine(ctx, [[-L * 0.43, -bw / 2], [-L * 0.36, -bw / 2], [-L * 0.36, bw / 2], [-L * 0.43, bw / 2]], { width: 3, jitter: 1, close: true });
  for (let i = 0; i < 3; i++) sketchLine(ctx, [[-L * 0.42 + i * L * 0.02, -bw / 2], [-L * 0.42 + i * L * 0.02, bw / 2]], { width: 2, jitter: 0.6, alpha: 0.6 });
  // body
  ctx.fillStyle = '#f2c94c';
  ctx.fillRect(-L * 0.36, -bw / 2, L * 0.68, bw);
  ctx.fillStyle = '#d9a520';
  ctx.fillRect(-L * 0.36, bw * 0.12, L * 0.68, bw * 0.38);
  sketchLine(ctx, [[-L * 0.36, -bw / 2], [L * 0.32, -bw / 2], [L * 0.32, bw / 2], [-L * 0.36, bw / 2]], { width: 4, jitter: 1.4, close: true });
  // HB label
  ctx.save();
  ctx.translate(L * 0.02, -bw * 0.1);
  ctx.rotate(0);
  ctx.fillStyle = '#1b2fb8';
  ctx.globalAlpha = 0.55;
  ctx.font = `bold ${bw * 0.55}px "Patrick Hand", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HB', 0, 0);
  ctx.restore();
  // wood tip
  ctx.fillStyle = '#e9c69b';
  ctx.beginPath();
  ctx.moveTo(L * 0.32, -bw / 2);
  ctx.lineTo(L * 0.44, -bw * 0.16);
  ctx.lineTo(L * 0.44, bw * 0.16);
  ctx.lineTo(L * 0.32, bw / 2);
  ctx.closePath();
  ctx.fill();
  sketchLine(ctx, [[L * 0.32, -bw / 2], [L * 0.44, -bw * 0.16], [L * 0.44, bw * 0.16], [L * 0.32, bw / 2]], { width: 3.5, jitter: 1.1 });
  // graphite
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath();
  ctx.moveTo(L * 0.44, -bw * 0.16);
  ctx.lineTo(L * 0.5, 0);
  ctx.lineTo(L * 0.44, bw * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // hand
  ctx.save();
  ctx.translate(w * 0.72, h * 0.86);
  ctx.rotate(-0.15);
  ctx.fillStyle = '#f3c9a6';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.13, h * 0.15, 0.2, 0, TAU);
  ctx.fill();
  sketchCircle(ctx, 0, 0, w * 0.13, { width: 5, jitter: 2, color: '#8a4b2a' });
  // fingers
  for (let i = 0; i < 4; i++) {
    sketchLine(ctx, [[-w * 0.06 + i * w * 0.035, -h * 0.13], [-w * 0.05 + i * w * 0.035, -h * 0.05]], { width: 4, jitter: 1, color: '#8a4b2a' });
  }
  // thumb
  sketchLine(ctx, [[-w * 0.1, h * 0.02], [-w * 0.14, -h * 0.06]], { width: 8, jitter: 1.5, color: '#8a4b2a' });
  ctx.restore();
}

function markerSprite(ctx, w, h) {
  ctx.save();
  ctx.translate(w * 0.68, h * 0.84);
  ctx.rotate(-2.3);
  const L = w * 0.58, bw = w * 0.11;
  // cap
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath();
  ctx.roundRect(-L * 0.56, -bw / 2, L * 0.14, bw, 12);
  ctx.fill();
  sketchLine(ctx, [[-L * 0.56, -bw / 2], [-L * 0.42, -bw / 2], [-L * 0.42, bw / 2], [-L * 0.56, bw / 2]], { width: 4, jitter: 1.2, close: true });
  // body
  ctx.fillStyle = '#4a5aa8';
  ctx.fillRect(-L * 0.42, -bw / 2, L * 0.62, bw);
  ctx.fillStyle = '#37448a';
  ctx.fillRect(-L * 0.42, bw * 0.1, L * 0.62, bw * 0.4);
  sketchLine(ctx, [[-L * 0.42, -bw / 2], [L * 0.2, -bw / 2], [L * 0.2, bw / 2], [-L * 0.42, bw / 2]], { width: 4, jitter: 1.4, close: true });
  ctx.save();
  ctx.fillStyle = '#f7f3e6';
  ctx.font = `bold ${bw * 0.42}px "Patrick Hand", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('INK', -L * 0.1, 0);
  ctx.restore();
  // chisel tip
  ctx.fillStyle = '#d42b3a';
  ctx.beginPath();
  ctx.moveTo(L * 0.2, -bw / 2);
  ctx.lineTo(L * 0.36, -bw * 0.18);
  ctx.lineTo(L * 0.36, bw * 0.18);
  ctx.lineTo(L * 0.2, bw / 2);
  ctx.closePath();
  ctx.fill();
  sketchLine(ctx, [[L * 0.2, -bw / 2], [L * 0.36, -bw * 0.18], [L * 0.36, bw * 0.18], [L * 0.2, bw / 2]], { width: 3.5, jitter: 1.2 });
  ctx.restore();

  // hand
  ctx.save();
  ctx.translate(w * 0.73, h * 0.87);
  ctx.rotate(-0.12);
  ctx.fillStyle = '#f3c9a6';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.14, h * 0.15, 0.18, 0, TAU);
  ctx.fill();
  sketchCircle(ctx, 0, 0, w * 0.14, { width: 5, jitter: 2, color: '#8a4b2a' });
  for (let i = 0; i < 4; i++) {
    sketchLine(ctx, [[-w * 0.065 + i * w * 0.038, -h * 0.13], [-w * 0.055 + i * w * 0.038, -h * 0.05]], { width: 4, jitter: 1, color: '#8a4b2a' });
  }
  ctx.restore();
}

function rulerSprite(ctx, w, h) {
  ctx.save();
  ctx.translate(w * 0.7, h * 0.85);
  ctx.rotate(-2.28);
  const L = w * 0.7, bw = w * 0.055;
  ctx.fillStyle = '#f7e6a8';
  ctx.fillRect(-L * 0.5, -bw / 2, L, bw);
  ctx.fillStyle = '#e8d08a';
  ctx.fillRect(-L * 0.5, bw * 0.05, L, bw * 0.45);
  sketchLine(ctx, [[-L * 0.5, -bw / 2], [L * 0.5, -bw / 2], [L * 0.5, bw / 2], [-L * 0.5, bw / 2]], { width: 4, jitter: 1.3, close: true });
  for (let i = 0; i <= 30; i++) {
    const x = -L * 0.48 + (i / 30) * L * 0.96;
    const long = i % 5 === 0;
    sketchLine(ctx, [[x, -bw / 2], [x, -bw / 2 + (long ? bw * 0.5 : bw * 0.25)]], { width: 2, jitter: 0.4, alpha: 0.7 });
    if (long && i % 10 === 0) {
      ctx.save();
      ctx.fillStyle = '#1b2fb8';
      ctx.globalAlpha = 0.6;
      ctx.font = `bold ${bw * 0.55}px "Patrick Hand", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i / 10), x, -bw * 0.1);
      ctx.restore();
    }
  }
  // tip sight
  ctx.fillStyle = '#d42b3a';
  ctx.beginPath();
  ctx.moveTo(L * 0.5, -bw * 0.5);
  ctx.lineTo(L * 0.56, 0);
  ctx.lineTo(L * 0.5, bw * 0.5);
  ctx.closePath();
  ctx.fill();
  sketchLine(ctx, [[L * 0.5, -bw * 0.5], [L * 0.56, 0], [L * 0.5, bw * 0.5]], { width: 3, jitter: 1 });
  ctx.restore();

  ctx.save();
  ctx.translate(w * 0.75, h * 0.88);
  ctx.rotate(-0.1);
  ctx.fillStyle = '#f3c9a6';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.15, h * 0.15, 0.15, 0, TAU);
  ctx.fill();
  sketchCircle(ctx, 0, 0, w * 0.15, { width: 5, jitter: 2, color: '#8a4b2a' });
  for (let i = 0; i < 4; i++) {
    sketchLine(ctx, [[-w * 0.07 + i * w * 0.04, -h * 0.13], [-w * 0.06 + i * w * 0.04, -h * 0.05]], { width: 4, jitter: 1, color: '#8a4b2a' });
  }
  ctx.restore();
}

function eraserSprite(ctx, w, h) {
  ctx.save();
  ctx.translate(w * 0.55, h * 0.7);
  ctx.rotate(-0.5);
  const bw = w * 0.34, bh = h * 0.2;
  ctx.fillStyle = '#ef8fab';
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 18);
  ctx.fill();
  ctx.fillStyle = '#4a5aa8';
  ctx.beginPath();
  ctx.roundRect(-bw / 2, bh * 0.12, bw, bh * 0.38, 10);
  ctx.fill();
  sketchLine(ctx, [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]], { width: 6, jitter: 2, close: true });
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.8;
  ctx.font = `bold ${bh * 0.28}px "Patrick Hand", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ERASER', 0, -bh * 0.12);
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.translate(w * 0.78, h * 0.86);
  ctx.rotate(-0.2);
  ctx.fillStyle = '#f3c9a6';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.16, h * 0.16, 0.2, 0, TAU);
  ctx.fill();
  sketchCircle(ctx, 0, 0, w * 0.16, { width: 5, jitter: 2, color: '#8a4b2a' });
  for (let i = 0; i < 4; i++) {
    sketchLine(ctx, [[-w * 0.07 + i * w * 0.045, -h * 0.14], [-w * 0.06 + i * w * 0.045, -h * 0.05]], { width: 4, jitter: 1, color: '#8a4b2a' });
  }
  ctx.restore();
}

export function getWeaponSprite(kind) {
  const fns = { pencil: pencilSprite, marker: markerSprite, ruler: rulerSprite, eraser: eraserSprite };
  return canvasTex('wpn_' + kind, 640, 640, fns[kind]);
}

export function getMuzzle() {
  return canvasTex('muzzle', 256, 256, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    const pts = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const r = i % 2 ? w * 0.16 : w * 0.42 * rand(0.8, 1.1);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(255,225,120,0.95)';
    smoothClosed(ctx, pts);
    ctx.fill();
    ctx.restore();
    sketchLine(ctx, pts, { width: 5, jitter: 3, close: true, color: '#e08a1e' });
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.13, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
}

export function getSticky() {
  return canvasTex('sticky', 256, 256, (ctx, w, h) => {
    ctx.save();
    ctx.fillStyle = '#f6e27a';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // fold
    ctx.save();
    ctx.fillStyle = '#e8cf62';
    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w, h * 0.82);
    ctx.lineTo(w * 0.82, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    sketchLine(ctx, [[2, 2], [w - 2, 2], [w - 2, h - 2], [2, h - 2]], { width: 3, jitter: 1.4, close: true, color: '#b89a2e', alpha: 0.55 });
    // scribble
    for (let i = 0; i < 3; i++) {
      sketchLine(ctx, [[w * 0.18, h * (0.3 + i * 0.18)], [w * 0.82, h * (0.28 + i * 0.18)]], { width: 3, jitter: 2, color: '#8a7a2a', alpha: 0.5 });
    }
  });
}

export function getCrumple() {
  return canvasTex('crumple', 256, 256, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), d = rand(0, w * 0.4);
      sketchLine(ctx, [[cx + Math.cos(a) * d, cy + Math.sin(a) * d], [cx + Math.cos(a + 1) * d * rand(0.6, 1.1), cy + Math.sin(a + 1) * d * rand(0.6, 1.1)]], { width: 2, jitter: 1.4, alpha: 0.35 });
    }
    sketchCircle(ctx, cx, cy, w * 0.42, { width: 3, jitter: 3, alpha: 0.5 });
  });
}

export const GROUND_DOODLES = [
  { key: 'sun', draw: doodleSun, size: 9 },
  { key: 'house', draw: doodleHouse, size: 8 },
  { key: 'cat', draw: doodleCat, size: 5 },
  { key: 'flower', draw: doodleFlower, size: 4 },
  { key: 'ttt', draw: doodleTicTacToe, size: 5.5 },
  { key: 'hop', draw: doodleHopscotch, size: 6 },
  { key: 'arrow', draw: (c, w, h) => doodleArrowText(c, w, h, 'THIS WAY'), size: 6 },
  { key: 'stick', draw: doodleStickman, size: 5 },
  { key: 'spiral', draw: doodleSpiral, size: 4 },
  { key: 'star', draw: doodleStar, size: 4 },
  { key: 'scrib', draw: doodleScribble, size: 4 },
  { key: 'math', draw: doodleMath, size: 7 },
  { key: 'kite', draw: doodleKite, size: 5 },
  { key: 'arrow2', draw: (c, w, h) => doodleArrowText(c, w, h, 'RUN!'), size: 6 },
];

export function getGroundDoodle(key, draw) {
  return canvasTex('gd_' + key, 512, 512, draw);
}
