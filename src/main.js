// ---------- entry ----------
import * as THREE from 'three';
import { Game } from './game.js';
import { audio } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.05, 700);
scene.add(camera);

const game = new Game({ renderer, scene, camera, canvas });

// ---------- resize ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

// ---------- audio unlock ----------
const unlock = () => {
  audio.resume();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// ---------- debug hook ----------
window.__game = game;
const DEBUG = new URLSearchParams(location.search).has('debug') || /debug/.test(location.hash);
if (DEBUG) {
  // tiny event/lock probe so input problems can be read from the accessibility tree
  const dbg = document.createElement('div');
  dbg.id = 'dbg';
  dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:12px monospace;background:#fff;color:#000;padding:4px 6px;white-space:pre;pointer-events:none';
  document.body.appendChild(dbg);
  const counts = { down: 0, up: 0, click: 0, pdown: 0, pup: 0, move: 0, lock: 0, unlock: 0 };
  const paint = () => {
    const locked = document.pointerLockElement === canvas;
    const g = game, w = g.weapons.current;
    dbg.textContent =
      `dbg state=${g.state} locked=${locked} down=${counts.down} up=${counts.up} click=${counts.click} pdown=${counts.pdown} pup=${counts.pup} move=${counts.move} lock=${counts.lock} unlock=${counts.unlock} fire=${w.ammo} err=${window.__err || '-'}` +
      `\nwave=${g.waveIndex + 1} hp=${Math.round(g.player.hp)} alive=${g.enemies.alive} queue=${g.spawnQueue.length} w=${w.def.id} kills=${g.kills} score=${g.score}`;
  };
  for (const [k, ev] of [['down', 'mousedown'], ['up', 'mouseup'], ['click', 'click'], ['pdown', 'pointerdown'], ['pup', 'pointerup']]) {
    canvas.addEventListener(ev, () => { counts[k]++; paint(); });
  }
  document.addEventListener('mousemove', () => { counts.move++; if (counts.move % 10 === 0) paint(); });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) counts.lock++; else counts.unlock++;
    paint();
  });
  window.addEventListener('error', (e) => { window.__err = String(e.message).slice(0, 60); paint(); });
  window.addEventListener('unhandledrejection', (e) => { window.__err = String(e.reason && e.reason.message || e.reason).slice(0, 60); paint(); });
  setInterval(paint, 500);
  // ?aim=<deg>  — start looking `deg` degrees down (negative = up); test aid only
  const aimDeg = new URLSearchParams(location.search).get('aim');
  if (aimDeg !== null) {
    const origStart = game.start.bind(game);
    game.start = () => { origStart(); game.player.pitch = -Number(aimDeg) * Math.PI / 180; };
  }
  // ?bot=1 — test-only auto-aim bot that plays the whole run (use with autostart; &god=1 keeps hp full).
  // Aims at the nearest enemy's crit sphere, fires, cycles weapons, jumps/dashes/melees, auto-picks upgrades.
  if (new URLSearchParams(location.search).has('bot')) {
    const GOD = new URLSearchParams(location.search).has('god');
    HTMLCanvasElement.prototype.requestPointerLock = function () {}; // no user gesture in an automated run
    const origUpdate = game.update.bind(game);
    const toT = new THREE.Vector3();
    let upgradeAt = -1, nextSwitch = 8, nextJump = 3, nextDash = 5;
    window.__bot = { picks: 0 };
    game.update = (dt, t) => {
      if (game.state === 'playing') {
        const p = game.player, W = game.weapons;
        if (GOD) p.hp = p.maxHp;
        let best = null, bestD = 1e9;
        for (const e of game.enemies.list) {
          if (e.dead) continue;
          const d = e.pos.distanceTo(p.pos);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const s = best.hitSpheres.find((x) => x.crit) || best.hitSpheres[0];
          toT.copy(best.pos).add(s.offset).sub(p.eyePos).normalize();
          p.yaw = Math.atan2(-toT.x, -toT.z);
          p.pitch = Math.asin(THREE.MathUtils.clamp(toT.y, -1, 1));
          game.firePressed = true;
          if (bestD < 2.6) game.pressed.add('KeyF');
        }
        if (t > nextSwitch) { nextSwitch = t + 8; game.pressed.add('Digit' + ((W.index + 1) % 3 + 1)); }
        if (t > nextJump) { nextJump = t + 4; game.pressed.add('Space'); }
        if (t > nextDash) { nextDash = t + 6; game.pressed.add('KeyC'); }
        upgradeAt = -1;
      } else if (game.state === 'upgrade') {
        if (upgradeAt < 0) upgradeAt = t + 1.6;
        else if (t > upgradeAt) {
          const cards = document.querySelectorAll('#upgrade-cards .card');
          if (cards.length) { cards[Math.floor(Math.random() * cards.length)].click(); window.__bot.picks++; }
          upgradeAt = t + 1.0;
        }
      }
      origUpdate(dt, t);
    };
  }
  if (/autostart/.test(location.hash) || new URLSearchParams(location.search).has('autostart')) {
    try { game.start(); } catch (e) { window.__err = String(e.message).slice(0, 60); paint(); }
  }
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  acc += dt;
  game.update(dt, now / 1000);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
