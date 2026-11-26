// ---------- game state machine ----------
import * as THREE from 'three';
import { Player } from './player.js';
import { Weapons, WEAPON_DEFS } from './weapons.js';
import { Enemies, ENEMY_DEFS } from './enemies.js';
import { UI, upgradeCards } from './ui.js';
import { buildWorld, ARENA_HALF } from './world.js';
import { FX } from './fx.js';
import { audio } from './audio.js';
import { setBoil, U } from './ink.js';
import { clamp, rand, pick, TAU, fmt } from './util.js';

export const WAVES = [
  { enemies: [['scribble', 5]] },
  { enemies: [['scribble', 7], ['rusher', 3]] },
  { enemies: [['scribble', 8], ['rusher', 4], ['blob', 2]] },
  { boss: 'eraser', enemies: [['scribble', 5]] },
  { enemies: [['scribble', 6], ['rusher', 4], ['wasp', 3]] },
  { enemies: [['shield', 4], ['rusher', 5], ['blob', 2]] },
  { enemies: [['scribble', 10], ['wasp', 4], ['shield', 3], ['blob', 3]] },
  { boss: 'inkblot', enemies: [['blob', 3], ['wasp', 2]] },
];

const ENEMY_NAMES = {
  scribble: '涂鸦小怪', rusher: '冲锋小子', blob: '墨水团', wasp: '纸蜂',
  shield: '盾牌涂鸦', eraser: 'THE ERASER', inkblot: 'THE INKBLOT',
};

const STORE_BEST = 'doodle-ruckus-best';
const STORE_SET = 'doodle-ruckus-settings';

export class Game {
  constructor({ renderer, scene, camera, canvas }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;

    this.world = buildWorld(scene);
    this.fx = new FX(scene, camera);
    this.player = new Player(camera, this.world, this.fx);
    this.weapons = new Weapons(camera, scene, this.fx);
    this.enemies = new Enemies(scene, this.fx, this.world);
    this.ui = new UI(camera);

    this.state = 'title';
    this.time = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboMul = 1;
    this.waveIndex = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveActive = false;
    this.waveClearT = 0;
    this.kills = 0;
    this.titleT = 0;
    this.endless = false;

    this.keys = new Set();
    this.pressed = new Set();
    this.firing = false;
    this.firePressed = false;
    this.wheel = 0;
    this.sens = 0.0022;
    this.volume = 0.8;

    this._loadSettings();
    this._wire();
    this._bindInput();
    this.ui.showScreen('title');
    this.ui.setTitle(this.best);
    this._spawnTitleProps();
  }

  // ---------------- setup ----------------
  _loadSettings() {
    try {
      const b = JSON.parse(localStorage.getItem(STORE_BEST) || 'null');
      this.best = b || null;
      const s = JSON.parse(localStorage.getItem(STORE_SET) || 'null');
      if (s) {
        this.sens = s.sens ?? this.sens;
        this.volume = s.vol ?? this.volume;
      }
    } catch (e) { this.best = null; }
    this._applyVolume();
  }

  _saveSettings() {
    try {
      localStorage.setItem(STORE_SET, JSON.stringify({ sens: this.sens, vol: this.volume }));
    } catch (e) {}
  }

  _applyVolume() {
    if (audio.master) audio.master.gain.value = this.volume * 0.9;
    else audio._pendingVol = this.volume * 0.9;
  }

  _wire() {
    const p = this.player, e = this.enemies, w = this.weapons, ui = this.ui;

    p.onHurt = () => {
      ui.hurtFlash();
      this.combo = 0;
      this.comboTimer = 0;
      audio.hurt();
    };
    p.onDeath = () => this.gameOver(false);
    p.onFall = () => {
      ui.banner('掉出纸面！', 'FELL OFF THE PAGE · -20 HP', '#d42b3a');
      audio.fall();
    };
    p.onStep = () => audio.step();
    p.onJump = () => audio.jump();
    p.onDash = () => audio.dash();
    p.onLand = () => audio.land();

    e.onKill = (en, opts) => this._onKill(en, opts);
    e.onBoss = (en) => {
      ui.banner('BOSS', en.type === 'eraser' ? 'THE ERASER · 橡皮擦' : 'THE INKBLOT · 墨渍', '#d42b3a');
      audio.boss();
      this.fx.shake(0.3);
    };
    e.onPlayerHit = () => ui.hurtFlash();

    w.onHit = (en, dmg, crit, killed, point, color) => {
      ui.hitmark(crit || killed);
      if (this.mods && this.mods.lifesteal) {
        p.heal(dmg * this.mods.lifesteal);
      }
      if (!killed) {
        ui.damageText(point.clone().add(new THREE.Vector3(rand(-0.2, 0.2), rand(0, 0.3), 0)),
          crit ? `${Math.round(dmg)}!` : `${Math.round(dmg)}`,
          crit ? '#d42b3a' : '#1b2fb8', crit);
      }
      this.fx.freeze(crit ? 40 : 16);
    };
    w.onMelee = (hit) => { if (hit) ui.hitmark(false); };
  }

  _bindInput() {
    const c = this.canvas;
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Tab') ev.preventDefault();
      if (!this.keys.has(ev.code)) this.pressed.add(ev.code);
      this.keys.add(ev.code);
      if (ev.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (ev.code === 'Space') ev.preventDefault();
    });
    window.addEventListener('keyup', (ev) => this.keys.delete(ev.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.firing = false; });

    document.addEventListener('mousemove', (ev) => {
      if (this.state !== 'playing' || document.pointerLockElement !== c) return;
      // Safari fires one large delta when the lock engages — swallow it
      if (performance.now() - (this.lockT || 0) < 150) return;
      this.player.look(ev.movementX, ev.movementY, this.sens);
    });
    c.addEventListener('mousedown', (ev) => {
      if (this.state !== 'playing') return;
      if (document.pointerLockElement !== c) {
        c.requestPointerLock();
        return;
      }
      if (ev.button === 0) {
        this.firing = true; this.firePressed = true;
        this._lastDownT = performance.now();
      }
    });
    window.addEventListener('mouseup', (ev) => {
      if (ev.button === 0) this.firing = false;
    });
    // Some environments deliver only mouseup+click with no mousedown (synthesized /
    // accessibility clicks, Safari under pointer lock). Treat a lone click as one
    // trigger pull; a click that follows a real mousedown is already handled above.
    c.addEventListener('click', (ev) => {
      if (this.state !== 'playing' || ev.button !== 0) return;
      if (performance.now() - (this._lastDownT || 0) < 400) return;
      if (document.pointerLockElement !== c) { c.requestPointerLock(); return; }
      this.firePressed = true;
      this.firing = true;
      clearTimeout(this._clickFireT);
      this._clickFireT = setTimeout(() => { this.firing = false; }, 70);
    });
    c.addEventListener('wheel', (ev) => {
      if (this.state !== 'playing') return;
      ev.preventDefault();
      this.wheel += Math.sign(ev.deltaY);
    }, { passive: false });
    c.addEventListener('contextmenu', (ev) => ev.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === c) this.lockT = performance.now();
      if (document.pointerLockElement !== c && this.state === 'playing') this.pause();
    });

    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { audio.resume(); audio.click(); fn(); });
    };
    on('btn-start', () => this.start());
    on('btn-resume', () => this.resume());
    on('btn-restart', () => this.start());
    on('btn-quit', () => this.toTitle());
    on('btn-over-restart', () => this.start());
    on('btn-over-title', () => this.toTitle());
    on('btn-victory-continue', () => this.continueEndless());
    on('btn-victory-title', () => this.toTitle());

    const sens = document.getElementById('sens');
    const vol = document.getElementById('vol');
    if (sens) sens.addEventListener('input', () => {
      this.sens = Number(sens.value) / 1000;
      this._saveSettings();
    });
    if (vol) vol.addEventListener('input', () => {
      this.volume = Number(vol.value) / 100;
      this._applyVolume();
      this._saveSettings();
    });
  }

  _spawnTitleProps() {
    // a few doodles idling on the page while the title shows
    this.enemies.clear();
    this.weapons.setVisible(false);
    const types = ['scribble', 'scribble', 'rusher', 'blob', 'wasp', 'scribble', 'shield'];
    for (let i = 0; i < types.length; i++) {
      const a = (i / types.length) * TAU + 0.4;
      const r = 8 + (i % 3) * 5;
      this.enemies.spawn(types[i], new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
  }

  // ---------------- flow ----------------
  start() {
    this.enemies.clear();
    this.fx.clearInk();
    this.player.reset(new THREE.Vector3(0, 0, 12));
    this.weapons.reset();
    this.weapons.mods = { dmg: 1, rate: 1, reload: 1, mag: 0, pellets: 0, pierce: 0, crit: 0, lifesteal: 0, explode: 0, magMul: 1, homing: 0 };
    this.mods = this.weapons.mods;
    this.mods.leech = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.kills = 0;
    this.waveIndex = 0;
    this.endless = false;
    this.spawnQueue = [];
    this.waveActive = false;
    this.waveClearT = 0;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.setBoss(null);
    this.ui.setScore(0);
    this.weapons.setVisible(true);
    audio.resume();
    audio.startMusic();
    audio.intensity = 0.2;
    this.startWave(0);
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock();
  }

  toTitle() {
    this.state = 'title';
    this.titleT = 0;
    this.enemies.clear();
    this.fx.clearInk();
    this.weapons.setVisible(false);
    this.ui.showScreen('title');
    this.ui.setTitle(this.best);
    this.ui.setBoss(null);
    this._spawnTitleProps();
    audio.stopMusic();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.firing = false;
    this.ui.showScreen('pause');
    this.ui.setPause(this.sens, this.volume);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.canvas.requestPointerLock();
  }

  gameOver(victory) {
    if (this.state === 'gameover' || this.state === 'victory') return;
    this.state = victory ? 'victory' : 'gameover';
    this.firing = false;
    const isBest = !this.best || this.score > this.best.score;
    if (isBest) {
      this.best = { score: this.score, wave: this.waveIndex + 1 };
      try { localStorage.setItem(STORE_BEST, JSON.stringify(this.best)); } catch (e) {}
    }
    if (victory) {
      this.ui.setVictory(this.score, this.waveIndex + 1);
      this.ui.showScreen('victory');
    } else {
      this.ui.setOver(this.score, this.waveIndex + 1, this.best, isBest, false);
      this.ui.showScreen('over');
    }
    this.weapons.setVisible(false);
    audio.stopMusic();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  continueEndless() {
    this.endless = true;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.weapons.setVisible(true);
    this.startWave(this.waveIndex + 1);
    this.canvas.requestPointerLock();
  }

  // ---------------- waves ----------------
  startWave(i) {
    this.waveIndex = i;
    let wave;
    if (i < WAVES.length) {
      wave = WAVES[i];
    } else {
      const k = i - WAVES.length + 1;
      wave = this._genWave(k);
    }
    this.spawnQueue = [];
    let d = 0.4;
    let n = 0;
    for (const [type, count] of wave.enemies) {
      for (let k = 0; k < count; k++) {
        // first wave: the first three doodles drop right in front of the player
        this.spawnQueue.push({ type, delay: d, front: i === 0 && n < 3 });
        d += 0.32;
        n++;
      }
    }
    if (wave.boss) this.spawnQueue.push({ type: wave.boss, delay: d + 0.8, boss: true });
    this.spawnTimer = i === 0 ? 1.2 : 0.5;
    this.waveActive = true;
    this.waveClearT = 0;
    this.ui.setWave(i + 1, this.endless ? '∞' : WAVES.length, this.spawnQueue.length);
    this.ui.banner(`WAVE ${i + 1}`, wave.boss ? 'BOSS 来了！' : '准备涂鸦', wave.boss ? '#d42b3a' : '#1b2fb8');
    audio.wave();
    audio.intensity = Math.min(1, 0.15 + i * 0.11);
  }

  _genWave(k) {
    const pool = ['scribble', 'rusher', 'blob', 'wasp', 'shield'];
    const out = [];
    const n = 8 + k * 2;
    for (let i = 0; i < n; i++) out.push([pick(pool), 1]);
    // merge
    const m = new Map();
    for (const [t, c] of out) m.set(t, (m.get(t) || 0) + c);
    const enemies = [...m.entries()];
    if (k % 3 === 0) return { enemies, boss: pick(['eraser', 'inkblot']) };
    return { enemies };
  }

  _spawnFromQueue() {
    const item = this.spawnQueue.shift();
    const type = item.type;
    const pts = this.world.spawnPoints;
    let point = null;
    if (item.front) {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
      fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      this._frontIdx = ((this._frontIdx ?? -1) + 1) % 3;
      const side = this._frontIdx - 1;
      point = this.player.pos.clone().addScaledVector(fwd, 15).addScaledVector(right, side * 5);
      point.x = clamp(point.x, -26, 26);
      point.z = clamp(point.z, -26, 26);
      point.y = 0;
    } else {
      // pick a ring point around 16 m away — close enough to read, far enough to react
      let bestD = 1e9;
      for (let i = 0; i < 16; i++) {
        const p = pts[Math.floor(Math.random() * pts.length)];
        const d = Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z);
        const score = Math.abs(d - 16);
        if (score < bestD) { bestD = score; point = p; }
      }
    }
    const mul = 1 + Math.max(0, this.waveIndex - 3) * 0.09;
    this.enemies.spawn(type, point, {
      hpMul: mul * (item.boss ? 1 : 1),
      spdMul: 1 + Math.max(0, this.waveIndex - 4) * 0.02,
    });
    this.fx.burst(point.clone().setY(0.6), 0x1b2fb8, 14, { speed: 5, size: 0.14, life: 0.5 });
  }

  _onKill(en, opts) {
    this.kills++;
    this.combo++;
    this.comboTimer = 5.5;
    const base = en.def.score;
    this.score += Math.round(base * (1 + this.combo * 0.1 * this.comboMul));
    this.ui.addKill(ENEMY_NAMES[en.type], false);
    if (this.mods.leech) this.player.heal(this.mods.leech);
    if (this.mods.explode) {
      const c = en.pos.clone().setY(0.9);
      for (const o of this.enemies.list) {
        if (o === en || o.dead) continue;
        if (o.pos.distanceTo(en.pos) < 4.5) {
          this.enemies.damage(o, 45, { dir: null, point: o.pos.clone() });
        }
      }
      this.fx.burst(c, en.def.color, 22, { speed: 9, size: 0.18, life: 0.6 });
      this.fx.splat(en.pos, 2.4, en.def.color);
    }
    if (en.boss) {
      this.ui.setBoss(null);
      this.fx.shake(0.6);
      this.fx.inkBlot(innerWidth * 0.5, innerHeight * 0.45, 260, 'rgba(27,47,184,0.5)');
    }
  }

  // ---------------- update ----------------
  update(dt, t) {
    this.time = t;
    U.time.value = t;
    setBoil(t);
    this.titleT += dt;

    const hs = this.fx.hitstop > 0 ? 0.08 : 1;
    const sdt = dt * hs;

    if (this.state === 'title') {
      const a = t * 0.1;
      this.camera.position.set(Math.cos(a) * 25, 10 + Math.sin(t * 0.35) * 1.6, Math.sin(a) * 25);
      this.camera.lookAt(0, 1.2, 0);
      this.camera.rotation.z = Math.sin(t * 0.2) * 0.02;
      const dummy = { pos: new THREE.Vector3(0, 0, 0), dead: true, vel: new THREE.Vector3() };
      this.enemies.update(dt, { player: dummy, world: this.world, wander: true });
      this.fx.update(dt);
      this.ui.update(dt);
      return;
    }

    if (this.state === 'paused' || this.state === 'upgrade' || this.state === 'gameover' || this.state === 'victory') {
      this.fx.update(dt * 0.25);
      this.player.applyCamera();
      this._applyShake();
      this.ui.update(dt);
      return;
    }

    // ---------- playing ----------
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) { this.combo = 0; this.comboTimer = 0; }

    const input = {
      keys: this.keys,
      pressed: this.pressed,
      firing: this.firing,
      firePressed: this.firePressed,
      jump: this.pressed.has('Space'),
      dash: this.pressed.has('KeyC') || this.pressed.has('ControlLeft') || this.pressed.has('ShiftRight'),
      wheel: this.wheel,
    };
    this.wheel = 0;

    this.player.update(sdt, input);
    this.weapons.update(sdt, input, { player: this.player, enemies: this.enemies, world: this.world });
    this.enemies.update(sdt, { player: this.player, world: this.world });

    this.player.applyCamera();
    this._applyShake();

    // spawn queue
    if (this.spawnQueue.length) {
      this.spawnTimer -= sdt;
      if (this.spawnTimer <= 0) {
        this._spawnFromQueue();
        // wave 1 trickles in slowly so new players can read the page
        this.spawnTimer = this.waveIndex === 0 ? 0.6 : 0.34;
      }
    }

    // wave clear
    const alive = this.enemies.alive;
    if (this.waveActive && this.spawnQueue.length === 0 && alive === 0) {
      this.waveClearT += sdt;
      if (this.waveClearT > 1.1) {
        this.waveActive = false;
        this._onWaveClear();
      }
    }

    // hud
    this.ui.setScore(this.score);
    this.ui.setCombo(this.combo, this.comboTimer / 5.5);
    this.ui.setHp(this.player.hp, this.player.maxHp);
    this.ui.setDash(this.player.dashCd, this.player.dashCdMax);
    this.ui.setWave(this.waveIndex + 1, this.endless ? '∞' : WAVES.length, alive + this.spawnQueue.length);
    this.ui.setBoss(this.enemies.bosses[0] || null);
    const w = this.weapons.current;
    this.ui.setWeapon({ def: w.def, ammo: w.ammo, reloading: w.reloading, mag: this.weapons.magSize(w) });
    this.ui.update(sdt);

    this.fx.update(sdt);
    this.pressed.clear();
    this.firePressed = false;

    // hints
    if (this.player.hp < 35 && this.player.regenTimer > 2) {
      this.ui.setHint('找掩护回血！');
    } else if (w.ammo === 0 && w.reloading <= 0) {
      this.ui.setHint('按 R 装填');
    } else if (this.time < 8 && this.waveIndex === 0) {
      this.ui.setHint('WASD 移动 · 左键开火 · F 近战 · C 冲刺');
    } else {
      this.ui.setHint('');
    }
  }

  _applyShake() {
    const cam = this.camera;
    cam.position.add(this.fx.offset);
    cam.rotation.z += this.fx.roll;
  }

  _onWaveClear() {
    const bonus = 250 * (this.waveIndex + 1);
    this.score += bonus;
    const isLast = !this.endless && this.waveIndex >= WAVES.length - 1;
    if (isLast) {
      this.ui.banner('PAGE CLEARED!', '整页纸都涂满了！', '#1b2fb8');
      audio.upgrade();
      setTimeout(() => this.gameOver(true), 1400);
      return;
    }
    audio.upgrade();
    this.ui.banner('WAVE CLEAR', `+${bonus} 分 · 挑一张贴纸`, '#5aa864');
    this.state = 'upgrade';
    this.firing = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    const cards = upgradeCards();
    setTimeout(() => {
      if (this.state !== 'upgrade') return;
      this.ui.showUpgrades(cards, (c) => this._pickUpgrade(c), this.waveIndex + 1);
    }, 900);
  }

  _pickUpgrade(c) {
    audio.upgrade();
    this._applyUpgrade(c);
    this.ui.showScreen(null);
    this.state = 'playing';
    this.startWave(this.waveIndex + 1);
    this.canvas.requestPointerLock();
  }

  _applyUpgrade(c) {
    const m = this.mods;
    const p = this.player;
    switch (c.id) {
      case 'mag': m.magMul *= 1.5; break;
      case 'dmg': m.dmg *= 1.2; break;
      case 'rate': m.rate *= 1.18; break;
      case 'reload': m.reload *= 0.65; break;
      case 'crit': m.crit = Math.min(1, m.crit + 0.15); break;
      case 'pellet': m.pellets += 3; break;
      case 'pierce': m.pierce += 1; break;
      case 'speed': p.speedMul *= 1.15; break;
      case 'dash': p.dashCdMax *= 0.65; break;
      case 'hp': p.maxHp += 30; p.hp = p.maxHp; break;
      case 'regen': p.regenDelay *= 0.6; p.regenRate *= 1.5; break;
      case 'lifesteal': m.lifesteal = (m.lifesteal || 0) + 0.06; break;
      case 'leech': m.leech = (m.leech || 0) + 4; break;
      case 'explode': m.explode = (m.explode || 0) + 1; break;
      case 'combo': this.comboMul *= 2; break;
      case 'homing': m.homing = 1; break;
    }
    // refresh ammo pools
    for (const w of this.weapons.list) w.ammo = Math.min(w.ammo, this.weapons.magSize(w));
  }
}
