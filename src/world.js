// ---------- the notebook-paper arena ----------
import * as THREE from 'three';
import { inkMaterial, addOutline, groundMaterial, skyMaterial, decalMaterial, PALETTE } from './ink.js';
import {
  getTree, getBush, getMountain, getCloud, getSticky, getCrumple,
  GROUND_DOODLES, getGroundDoodle,
} from './textures.js';
import { rand, TAU, mulberry32 } from './util.js';

export const ARENA_HALF = 32;
export const KILL_Y = -13;

let R = Math.random;

function inkMesh(geo, opts = {}) {
  const m = new THREE.Mesh(geo, inkMaterial({
    color: opts.color ?? PALETTE.ink,
    fill: opts.fill ?? 1,
    hatch: opts.hatch ?? 0.4,
    shade: opts.shade ?? 0.34,
    wobble: opts.wobble ?? 0.03,
    outlineColor: opts.outlineColor,
  }));
  if (opts.outline !== false) addOutline(m, opts.outline ?? 0.04, opts.outlineColor);
  return m;
}

function dashedTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#1b2fb8';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 64 + 5, 17);
    ctx.lineTo(i * 64 + 47, 15);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(18, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------- props ----------------
function pencilColumn(height, color) {
  const g = new THREE.Group();
  const r = 0.44;
  const base = 0.62;
  const eraser = inkMesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.5, 10), { color: 0xef8fab, hatch: 0.5 });
  eraser.position.y = 0.25;
  g.add(eraser);
  const band = inkMesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.14, 10), { color: 0xb9bcc6, hatch: 0.25 });
  band.position.y = 0.57;
  g.add(band);
  const body = inkMesh(new THREE.CylinderGeometry(r, r, height, 6), { color, hatch: 0.5, wobble: 0.045 });
  body.position.y = base + height / 2;
  g.add(body);
  const wood = inkMesh(new THREE.ConeGeometry(r, 0.95, 6), { color: 0xe9cba2, hatch: 0.65, wobble: 0.04 });
  wood.position.y = base + height + 0.475;
  g.add(wood);
  const tip = inkMesh(new THREE.ConeGeometry(r * 0.33, 0.4, 6), { color: 0x33333c, hatch: 0.15, shade: 0.2 });
  tip.position.y = base + height + 0.95 - 0.2;
  g.add(tip);
  return { group: g, size: { x: r * 2, y: base + height + 0.95, z: r * 2 } };
}

function eraserBlock() {
  const g = new THREE.Group();
  const w = R(1.9, 2.7), h = R(0.85, 1.25), d = R(1.1, 1.5);
  const body = inkMesh(new THREE.BoxGeometry(w, h, d), { color: 0xef8fab, hatch: 0.42, wobble: 0.04 });
  body.position.y = h / 2;
  g.add(body);
  const band = inkMesh(new THREE.BoxGeometry(w * 1.03, h * 0.3, d * 1.03), { color: 0x4a5aa8, hatch: 0.3, outline: 0.02 });
  band.position.y = h * 0.52;
  g.add(band);
  return { group: g, size: { x: w, y: h, z: d } };
}

function bookStack() {
  const g = new THREE.Group();
  const n = 2 + Math.floor(R(0, 3));
  const colors = [0xd42b3a, 0x4a5aa8, 0x5aa864, 0xef8a3c, 0x7a5ac8];
  let y = 0;
  let maxW = 0, maxD = 0;
  for (let i = 0; i < n; i++) {
    const w = R(1.5, 2.3) - i * 0.12, d = R(1.0, 1.5) - i * 0.08, h = R(0.26, 0.42);
    const b = inkMesh(new THREE.BoxGeometry(w, h, d), { color: colors[Math.floor(R(0, colors.length))], hatch: 0.45, wobble: 0.03 });
    b.position.set(R(-0.12, 0.12), y + h / 2, R(-0.12, 0.12));
    b.rotation.y = R(-0.18, 0.18);
    g.add(b);
    // pages
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.5, d * 1.01), new THREE.MeshBasicMaterial({ color: 0xfbf7ea }));
    pages.position.copy(b.position);
    pages.rotation.copy(b.rotation);
    g.add(pages);
    y += h;
    maxW = Math.max(maxW, w); maxD = Math.max(maxD, d);
  }
  return { group: g, size: { x: maxW, y, z: maxD } };
}

function stickyPad() {
  const g = new THREE.Group();
  const s = R(2.4, 3.2), h = R(1.7, 2.5);
  const body = inkMesh(new THREE.BoxGeometry(s, h, s), { color: 0xf6e27a, hatch: 0.28, wobble: 0.03 });
  body.position.y = h / 2;
  g.add(body);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.98, s * 0.98), decalMaterial(getSticky()));
  top.rotation.x = -Math.PI / 2;
  top.position.y = h + 0.006;
  g.add(top);
  return { group: g, size: { x: s, y: h, z: s } };
}

function coffeeCup() {
  const g = new THREE.Group();
  const r = 0.52, h = 0.82;
  const saucer = inkMesh(new THREE.CylinderGeometry(r * 1.6, r * 1.5, 0.1, 16), { color: 0xfffdf5, hatch: 0.18, outline: 0.02 });
  saucer.position.y = 0.05;
  g.add(saucer);
  const body = inkMesh(new THREE.CylinderGeometry(r, r * 0.82, h, 16), { color: 0xfffdf5, hatch: 0.2, wobble: 0.02 });
  body.position.y = 0.1 + h / 2;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.005, r * 0.94, h * 0.26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xd42b3a, side: THREE.DoubleSide }));
  stripe.position.y = 0.1 + h * 0.55;
  g.add(stripe);
  const handle = inkMesh(new THREE.TorusGeometry(0.22, 0.07, 6, 14), { color: 0xfffdf5, hatch: 0.2, outline: 0.02 });
  handle.position.set(r + 0.14, 0.1 + h * 0.5, 0);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(r * 0.88, 16), new THREE.MeshBasicMaterial({ color: 0x6b4226 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.1 + h - 0.02;
  g.add(coffee);
  return { group: g, size: { x: r * 3.2, y: 0.1 + h, z: r * 3.2 } };
}

function paperBall() {
  const g = new THREE.Group();
  const r = R(0.4, 0.62);
  const b = inkMesh(new THREE.IcosahedronGeometry(r, 1), { color: 0xfffdf5, hatch: 0.12, shade: 0.5, wobble: 0.09, outline: 0.025 });
  b.position.y = r * 0.9;
  b.rotation.set(R(0, 3), R(0, 3), R(0, 3));
  g.add(b);
  return { group: g, size: { x: r * 2, y: r * 1.8, z: r * 2 } };
}

function crayon() {
  const g = new THREE.Group();
  const colors = [0xd42b3a, 0xef8a3c, 0x5aa864, 0x4a5aa8, 0x7a5ac8];
  const c = colors[Math.floor(R(0, colors.length))];
  const len = R(0.9, 1.4), r = 0.16;
  const body = inkMesh(new THREE.CylinderGeometry(r, r, len, 8), { color: c, hatch: 0.4, outline: 0.02 });
  body.rotation.z = Math.PI / 2;
  body.rotation.y = R(0, TAU);
  body.position.y = r;
  g.add(body);
  const tip = inkMesh(new THREE.ConeGeometry(r, 0.16, 8), { color: c, hatch: 0.4, outline: 0.02 });
  tip.rotation.z = -Math.PI / 2;
  tip.rotation.y = body.rotation.y;
  tip.position.y = r;
  g.add(tip);
  return { group: g, size: null };
}

// ---------------- background scenery ----------------
function billboard(tex, w, h, x, y, z, rotY = 0, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decalMaterial(tex, { opacity }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  return m;
}

// ---------------- main ----------------
export function buildWorld(scene, seed = 20261126) {
  R = mulberry32(seed);
  const group = new THREE.Group();
  scene.add(group);

  const colliders = [];
  const addCollider = (x, y, z, sx, sy, sz) => {
    colliders.push({
      min: { x: x - sx / 2, y: y - sy / 2, z: z - sz / 2 },
      max: { x: x + sx / 2, y: y + sy / 2, z: z + sz / 2 },
    });
  };

  // --- page ---
  const pageBody = new THREE.Mesh(new THREE.BoxGeometry(64, 0.7, 64), new THREE.MeshBasicMaterial({ color: 0xe8e2cf }));
  pageBody.position.y = -0.351;
  group.add(pageBody);
  const pageEdge = new THREE.Mesh(new THREE.BoxGeometry(64.2, 0.12, 64.2), new THREE.MeshBasicMaterial({ color: 0xd9d2bb }));
  pageEdge.position.y = -0.66;
  group.add(pageEdge);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), groundMaterial());
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  group.add(ground);

  // --- sky ---
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), skyMaterial());
  sky.frustumCulled = false;
  group.add(sky);

  // --- background doodles (outside the page) ---
  const sunDef = GROUND_DOODLES.find((d) => d.key === 'sun');
  const sun = billboard(getGroundDoodle('sun', sunDef.draw), 46, 46, -78, 62, -150);
  group.add(sun);

  for (let i = 0; i < 3; i++) {
    const m = billboard(getMountain(), 150, 60, -60 + i * 60, 26, -170 + i * 10, 0, 0.85);
    group.add(m);
  }
  for (let i = 0; i < 7; i++) {
    const m = billboard(getCloud(i % 3), R(26, 44), R(11, 18), R(-110, 110), R(26, 52), R(-160, -95), 0, 0.9);
    group.add(m);
  }
  // trees around the page edge
  const treeAngles = [-2.5, -2.0, -1.45, -0.9, -0.35, 0.35, 0.9, 1.5, 2.1, 2.6];
  for (const a of treeAngles) {
    const rad = R(40, 52);
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const t = billboard(getTree(), R(9, 13), R(14, 20), x, R(6, 9), z, Math.atan2(-x, -z), 0.95);
    group.add(t);
    if (R() < 0.6) {
      const b = billboard(getBush(), R(6, 9), R(3, 4.5), x * 0.94 + R(-3, 3), 1.4, z * 0.94 + R(-3, 3), Math.atan2(-x, -z), 0.95);
      group.add(b);
    }
  }

  // --- ground doodles ---
  const used = [];
  for (let i = 0; i < 22; i++) {
    const d = GROUND_DOODLES[Math.floor(R(0, GROUND_DOODLES.length))];
    const s = d.size * R(0.8, 1.3);
    let x = 0, z = 0, ok = false;
    for (let k = 0; k < 20 && !ok; k++) {
      x = R(-27, 27); z = R(-27, 27);
      ok = Math.hypot(x, z) > 4 && used.every((u) => Math.hypot(u.x - x, u.z - z) > 5.5);
    }
    if (!ok) continue;
    used.push({ x, z });
    const tex = getGroundDoodle(d.key, d.draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), decalMaterial(tex, { opacity: R(0.55, 0.9) }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = R(0, TAU);
    m.position.set(x, 0.015 + i * 0.0012, z);
    group.add(m);
  }

  // --- dashed page border ---
  const dashTex = dashedTexture();
  const borderMat = new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, depthWrite: false, opacity: 0.85 });
  const B = ARENA_HALF - 0.55;
  for (const [x, z, ry] of [[0, -B, 0], [0, B, Math.PI], [-B, 0, Math.PI / 2], [B, 0, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(64, 0.5), borderMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = ry;
    m.position.set(x, 0.03, z);
    group.add(m);
  }

  // --- props ---
  const props = [];
  const place = (fn, x, z, rot = 0) => {
    const p = fn();
    p.group.position.set(x, 0, z);
    p.group.rotation.y = rot;
    group.add(p.group);
    if (p.size) addCollider(x, p.size.y / 2, z, p.size.x, p.size.y, p.size.z);
    props.push(p.group);
    return p;
  };

  // landmark props
  place(pencilColumn, -12.5, -9, 0.4).group.rotation.y = 0.4;
  place(() => pencilColumn(7.5, 0xf2c94c), 11, -13, 0);
  place(() => pencilColumn(5.5, 0xef8a3c), 14, 9, 0);
  place(() => pencilColumn(9.5, 0x4a5aa8), -16, 12, 0);
  place(() => pencilColumn(4.2, 0xd42b3a), -4, -18, 0);
  place(() => pencilColumn(6.2, 0x5aa864), 11, 20, 0);
  place(() => pencilColumn(3.4, 0x7a5ac8), -22, -4, 0);

  place(eraserBlock, 8, 3, 0.5);
  place(eraserBlock, -7, 7, -0.3);
  place(eraserBlock, 20, -20, 0.9);
  place(eraserBlock, -21, 18, 0.2);

  place(bookStack, -2, -6, 0.2);
  place(bookStack, 17, 15, -0.4);
  place(bookStack, -18, -17, 0.7);
  place(bookStack, 5, 24, 0.1);

  place(stickyPad, -9, -16, 0.3);
  place(stickyPad, 12, 12, -0.2);
  place(stickyPad, 21, 2, 0.6);
  place(stickyPad, -13, 3, 0.1);

  place(coffeeCup, -6, -2, 0);
  place(coffeeCup, 19, -6, 0);
  place(coffeeCup, -24, -24, 0);

  for (let i = 0; i < 12; i++) {
    const a = R(0, TAU), rad = R(8, 27);
    place(paperBall, Math.cos(a) * rad, Math.sin(a) * rad, R(0, TAU));
  }
  for (let i = 0; i < 8; i++) {
    const a = R(0, TAU), rad = R(6, 26);
    place(crayon, Math.cos(a) * rad, Math.sin(a) * rad, 0);
  }

  // spawn points ring
  const spawnPoints = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const rad = R(13, 24);
    spawnPoints.push(new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad));
  }

  return { group, colliders, spawnPoints, props, ground, sky };
}
