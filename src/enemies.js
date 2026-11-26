// ---------- doodle enemies + bosses ----------
import * as THREE from 'three';
import { inkMaterial, addOutline, PALETTE } from './ink.js';
import { audio } from './audio.js';
import { rand, clamp, damp, TAU, pick } from './util.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

function part(geo, color, opts = {}) {
  const m = new THREE.Mesh(geo, inkMaterial({
    color,
    fill: opts.fill ?? 1,
    hatch: opts.hatch ?? 0.42,
    shade: opts.shade ?? 0.34,
    wobble: opts.wobble ?? 0.04,
    outlineColor: opts.outlineColor,
  }));
  if (opts.outline !== false) addOutline(m, opts.outline ?? 0.032, opts.outlineColor);
  return m;
}

function eyePair(g, y, z, spread, size = 0.16, pupilColor = 0x1a1a22) {
  for (const s of [-1, 1]) {
    const eye = part(new THREE.SphereGeometry(size, 10, 8), 0xfffdf5, { hatch: 0.03, shade: 0.1, wobble: 0.015, outline: 0.018 });
    eye.position.set(s * spread, y, z);
    eye.scale.set(1, 1.25, 0.72);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.44, 8, 6), new THREE.MeshBasicMaterial({ color: pupilColor }));
    pupil.position.set(s * spread, y - size * 0.08, z + size * 0.52);
    pupil.scale.set(1, 1.3, 0.6);
    g.add(pupil);
  }
}

function legs(g, color, spread, y, len, thick = 0.07) {
  for (const s of [-1, 1]) {
    const leg = part(new THREE.CylinderGeometry(thick, thick * 0.85, len, 6), color, { outline: 0.02 });
    leg.position.set(s * spread, y, 0);
    g.add(leg);
    const foot = part(new THREE.SphereGeometry(thick * 1.5, 8, 6), color, { outline: 0.02 });
    foot.position.set(s * spread, y - len / 2 + 0.03, 0.07);
    foot.scale.set(1, 0.55, 1.35);
    g.add(foot);
  }
}

function arms(g, color, spread, y, len, rot = 0.7) {
  for (const s of [-1, 1]) {
    const arm = part(new THREE.CylinderGeometry(0.06, 0.05, len, 6), color, { outline: 0.02 });
    arm.position.set(s * spread, y, 0);
    arm.rotation.z = s * rot;
    g.add(arm);
  }
}

// ---------------- model builders ----------------
function buildScribble(color) {
  const g = new THREE.Group();
  const r = 0.55;
  const body = part(new THREE.SphereGeometry(r, 18, 14), color, { wobble: 0.05, outline: 0.045 });
  body.position.y = r;
  body.scale.set(1, 1.1, 0.96);
  g.add(body);
  eyePair(g, r + 0.13, 0.44, 0.21, 0.16);
  legs(g, color, 0.2, 0.17, 0.34);
  arms(g, color, 0.6, r + 0.05, 0.42);
  // little hair tuft
  for (let i = 0; i < 3; i++) {
    const h = part(new THREE.CylinderGeometry(0.02, 0.035, 0.26, 4), color, { outline: false });
    h.position.set((i - 1) * 0.1, r * 2 + 0.05, 0);
    h.rotation.z = (i - 1) * 0.45;
    g.add(h);
  }
  return {
    group: g, radius: 0.55,
    hitSpheres: [
      { offset: new THREE.Vector3(0, r, 0), r: 0.63, crit: false },
      { offset: new THREE.Vector3(0, r + 0.36, 0), r: 0.33, crit: true },
    ],
  };
}

function buildRusher(color) {
  const g = new THREE.Group();
  const r = 0.42;
  const body = part(new THREE.ConeGeometry(r, 1.15, 10), color, { wobble: 0.06, outline: 0.04 });
  body.position.y = 0.62;
  body.rotation.x = Math.PI;
  g.add(body);
  const head = part(new THREE.SphereGeometry(r * 0.78, 14, 10), color, { wobble: 0.06, outline: 0.04 });
  head.position.y = 1.02;
  g.add(head);
  eyePair(g, 1.05, 0.27, 0.15, 0.13);
  legs(g, color, 0.16, 0.15, 0.3, 0.055);
  // spikes
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const sp = part(new THREE.ConeGeometry(0.08, 0.26, 5), color, { outline: false });
    sp.position.set(Math.cos(a) * 0.26, 1.28, Math.sin(a) * 0.26);
    sp.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    g.add(sp);
  }
  return {
    group: g, radius: 0.42,
    hitSpheres: [
      { offset: new THREE.Vector3(0, 0.6, 0), r: 0.52, crit: false },
      { offset: new THREE.Vector3(0, 1.05, 0), r: 0.28, crit: true },
    ],
  };
}

function buildBlob(color) {
  const g = new THREE.Group();
  const r = 0.85;
  const body = part(new THREE.SphereGeometry(r, 20, 16), color, { wobble: 0.07, outline: 0.05 });
  body.position.y = r * 0.95;
  body.scale.set(1.06, 0.95, 1.0);
  g.add(body);
  eyePair(g, r * 1.15, 0.66, 0.3, 0.2);
  legs(g, color, 0.34, 0.2, 0.4, 0.09);
  arms(g, color, 0.9, r * 0.9, 0.5, 0.9);
  return {
    group: g, radius: 0.85,
    hitSpheres: [
      { offset: new THREE.Vector3(0, r * 0.95, 0), r: 0.95, crit: false },
      { offset: new THREE.Vector3(0, r * 1.45, 0), r: 0.42, crit: true },
    ],
  };
}

function buildWasp(color) {
  const g = new THREE.Group();
  const r = 0.4;
  const body = part(new THREE.SphereGeometry(r, 16, 12), color, { wobble: 0.05, outline: 0.04 });
  body.scale.set(0.9, 0.9, 1.35);
  g.add(body);
  for (let i = -1; i <= 1; i++) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(r * 0.93, r * 0.12, 5, 14), new THREE.MeshBasicMaterial({ color: 0x24242c }));
    stripe.rotation.y = Math.PI / 2;
    stripe.position.z = i * r * 0.42;
    stripe.scale.set(1, 1, 0.9);
    g.add(stripe);
  }
  eyePair(g, r * 0.28, r * 1.05, 0.14, 0.11);
  // stinger
  const sting = part(new THREE.ConeGeometry(0.11, 0.4, 6), 0x24242c, { outline: false });
  sting.position.z = -r * 1.5;
  sting.rotation.x = -Math.PI / 2;
  g.add(sting);
  // wings
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.34, 10), new THREE.MeshBasicMaterial({ color: 0xfffdf5, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    w.position.set(s * 0.34, 0.3, -0.05);
    w.rotation.set(-Math.PI / 2.3, 0, s * 0.4);
    w.scale.set(1.3, 0.75, 1);
    g.add(w);
    wings.push(w);
  }
  g.userData.wings = wings;
  return {
    group: g, radius: 0.45, flying: true,
    hitSpheres: [
      { offset: new THREE.Vector3(0, 0, 0), r: 0.5, crit: false },
      { offset: new THREE.Vector3(0, 0.18, 0.3), r: 0.26, crit: true },
    ],
  };
}

function buildShield(color) {
  const g = new THREE.Group();
  const r = 0.55;
  const body = part(new THREE.SphereGeometry(r, 16, 12), color, { wobble: 0.04, outline: 0.04 });
  body.position.y = r;
  g.add(body);
  eyePair(g, r + 0.1, 0.42, 0.2, 0.15);
  legs(g, color, 0.2, 0.16, 0.32);
  // shield
  const sh = new THREE.Group();
  const plate = part(new THREE.BoxGeometry(1.15, 1.35, 0.12), 0xf6e27a, { hatch: 0.3, wobble: 0.02, outline: 0.035 });
  plate.position.set(0, 0.85, 0.62);
  sh.add(plate);
  const boss1 = part(new THREE.BoxGeometry(1.2, 0.16, 0.14), 0xd42b3a, { hatch: 0.25, outline: 0.02 });
  boss1.position.set(0, 0.85, 0.62);
  sh.add(boss1);
  const boss2 = part(new THREE.BoxGeometry(0.16, 1.4, 0.14), 0xd42b3a, { hatch: 0.25, outline: 0.02 });
  boss2.position.set(0, 0.85, 0.62);
  sh.add(boss2);
  g.add(sh);
  g.userData.shield = sh;
  return {
    group: g, radius: 0.55,
    hitSpheres: [
      { offset: new THREE.Vector3(0, r, 0), r: 0.62, crit: false },
      { offset: new THREE.Vector3(0, r + 0.34, 0), r: 0.3, crit: true },
    ],
  };
}

function buildEraser() {
  const g = new THREE.Group();
  const body = part(new THREE.BoxGeometry(3.2, 2.1, 2.3), 0xef8fab, { hatch: 0.4, wobble: 0.04, outline: 0.06 });
  body.position.y = 1.15;
  g.add(body);
  const band = part(new THREE.BoxGeometry(3.28, 0.5, 2.38), 0x4a5aa8, { hatch: 0.3, outline: 0.03 });
  band.position.y = 0.62;
  g.add(band);
  const browL = part(new THREE.BoxGeometry(0.62, 0.14, 0.1), 0x24242c, { outline: false });
  browL.position.set(-0.62, 1.82, 1.16);
  browL.rotation.z = 0.28;
  g.add(browL);
  const browR = browL.clone();
  browR.position.x = 0.62;
  browR.rotation.z = -0.28;
  g.add(browR);
  eyePair(g, 1.45, 1.16, 0.62, 0.3);
  // teeth
  for (let i = -3; i <= 3; i++) {
    const t = part(new THREE.ConeGeometry(0.13, 0.28, 4), 0xfffdf5, { outline: false });
    t.position.set(i * 0.26, 0.55, 1.16);
    t.rotation.x = Math.PI;
    g.add(t);
  }
  legs(g, 0xef8fab, 0.85, 0.35, 0.7, 0.16);
  arms(g, 0xef8fab, 1.75, 1.2, 0.8, 0.55);
  return {
    group: g, radius: 1.6,
    hitSpheres: [
      { offset: new THREE.Vector3(0, 1.15, 0), r: 1.75, crit: false },
      { offset: new THREE.Vector3(0, 1.9, 0), r: 0.7, crit: true },
    ],
  };
}

function buildInkblot() {
  const g = new THREE.Group();
  const r = 1.7;
  const body = part(new THREE.SphereGeometry(r, 24, 18), 0x24242c, { hatch: 0.15, shade: 0.22, wobble: 0.09, outline: 0.07 });
  body.position.y = 0;
  body.scale.set(1.08, 1.0, 1.0);
  g.add(body);
  // drips
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const d = part(new THREE.SphereGeometry(rand(0.16, 0.34), 8, 6), 0x24242c, { hatch: 0.15, outline: false });
    d.position.set(Math.cos(a) * r * rand(0.9, 1.15), rand(-0.6, 0.6), Math.sin(a) * r * rand(0.9, 1.15));
    g.add(d);
  }
  eyePair(g, 0.35, 1.45, 0.55, 0.34, 0xd42b3a);
  return {
    group: g, radius: 1.7, flying: true, centerY: 2.6,
    hitSpheres: [
      { offset: new THREE.Vector3(0, 0, 0), r: 1.85, crit: false },
      { offset: new THREE.Vector3(0, 0.6, 0), r: 0.75, crit: true },
    ],
  };
}

export const ENEMY_DEFS = {
  scribble: { hp: 42, speed: 3.0, dmg: 10, radius: 0.55, score: 100, color: 0x2b46d8, build: buildScribble, mass: 1 },
  rusher: { hp: 28, speed: 6.2, dmg: 9, radius: 0.42, score: 120, color: 0xd42b3a, build: buildRusher, mass: 0.7 },
  blob: { hp: 95, speed: 2.3, dmg: 15, radius: 0.85, score: 180, color: 0x5aa864, build: buildBlob, mass: 2, splits: 2 },
  wasp: { hp: 36, speed: 3.8, dmg: 9, radius: 0.45, score: 150, color: 0xf2c94c, build: buildWasp, mass: 0.6, flying: true },
  shield: { hp: 130, speed: 2.7, dmg: 16, radius: 0.55, score: 220, color: 0x7a5ac8, build: buildShield, mass: 1.4 },
  eraser: { hp: 1500, speed: 3.1, dmg: 26, radius: 1.6, score: 3000, color: 0xef8fab, build: buildEraser, boss: true, mass: 6 },
  inkblot: { hp: 2400, speed: 2.5, dmg: 20, radius: 1.7, score: 5000, color: 0x24242c, build: buildInkblot, boss: true, mass: 7 },
};

export class Enemies {
  constructor(scene, fx, world) {
    this.scene = scene;
    this.fx = fx;
    this.world = world;
    this.list = [];
    this.projectiles = [];
    this.onKill = null;
    this.onBoss = null;
    this.onPlayerHit = null;
    this.projGeo = new THREE.SphereGeometry(0.16, 8, 6);
  }

  spawn(type, pos, opts = {}) {
    const def = ENEMY_DEFS[type];
    if (!def) return null;
    const built = def.build(def.color);
    const e = {
      type, def,
      group: built.group,
      hitSpheres: built.hitSpheres,
      radius: built.radius,
      flying: !!built.flying,
      centerY: built.centerY ?? 0,
      pos: new THREE.Vector3(pos.x, pos.y ?? 0, pos.z),
      vel: new THREE.Vector3(),
      hp: def.hp * (opts.hpMul ?? 1),
      maxHp: def.hp * (opts.hpMul ?? 1),
      speed: def.speed * (opts.spdMul ?? 1),
      dmg: def.dmg * (opts.dmgMul ?? 1),
      t: rand(0, 10),
      attackCd: rand(0.2, 0.9),
      windup: 0,
      flash: 0,
      dead: false,
      deathT: 0,
      spawnT: 0,
      state: 'chase',
      stateT: 0,
      specialCd: rand(3, 5),
      phase: 1,
      boss: !!def.boss,
      chargeDir: new THREE.Vector3(),
      mats: [],
    };
    e.group.traverse((o) => {
      if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uColor) {
        e.mats.push(o.material);
      }
    });
    e.group.position.copy(e.pos);
    e.group.scale.setScalar(0.01);
    this.scene.add(e.group);
    this.list.push(e);
    if (e.boss && this.onBoss) this.onBoss(e);
    return e;
  }

  get alive() { return this.list.filter((e) => !e.dead).length; }
  get bosses() { return this.list.filter((e) => e.boss && !e.dead); }

  damage(e, amount, opts = {}) {
    if (e.dead) return false;
    let dmg = amount;
    // 盾牌只挡正面；近战与穿透武器（轨道炮）无视盾牌
    if (e.type === 'shield' && opts.dir && !opts.melee && !opts.pierce) {
      const facing = _v3.set(Math.sin(e.group.rotation.y), 0, Math.cos(e.group.rotation.y));
      if (facing.dot(opts.dir) < -0.15) {
        dmg *= 0.22;
        audio.hit(false);
      }
    }
    e.hp -= dmg;
    e.flash = 1;
    if (e.hp <= 0) {
      this.kill(e, opts);
      return true;
    }
    return false;
  }

  kill(e, opts = {}) {
    if (e.dead) return;
    e.dead = true;
    e.deathT = 0;
    const col = e.def.color;
    const center = e.pos.clone();
    center.y += e.flying ? 0 : Math.max(0.6, e.radius);
    this.fx.burst(center, col, e.boss ? 60 : 18, {
      speed: e.boss ? 14 : 7, size: e.boss ? 0.3 : 0.17, life: e.boss ? 1.4 : 0.75, grav: 16,
    });
    this.fx.burst(center, 0xfffdf5, e.boss ? 30 : 6, { speed: 9, size: 0.12, life: 0.5, grav: 10 });
    if (!e.flying) this.fx.splat(e.pos, (e.boss ? 3.4 : 1.5) + e.radius, col);
    if (e.boss) {
      this.fx.shake(0.5);
      this.fx.inkBlot(innerWidth * 0.5, innerHeight * 0.5, 190, 'rgba(27,47,184,0.55)');
    } else if (Math.random() < 0.4) {
      this.fx.inkBlot(innerWidth * rand(0.25, 0.75), innerHeight * rand(0.25, 0.75), rand(20, 45));
    }
    audio.kill();
    if (this.onKill) this.onKill(e, opts);
  }

  update(dt, ctx) {
    const { player, world } = ctx;
    for (const e of this.list) {
      if (e.dead) {
        e.deathT += dt;
        const k = clamp(e.deathT / 0.3, 0, 1);
        e.group.scale.set(1 + k * 0.6, Math.max(0.02, 1 - k), 1 + k * 0.6);
        e.group.rotation.z = k * 0.9;
        continue;
      }
      e.spawnT = Math.min(1, e.spawnT + dt * 4.5);
      const s = 0.2 + 0.8 * (1 - Math.pow(1 - e.spawnT, 3));
      e.group.scale.setScalar(s);
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt * 7);
      this._setFlash(e);

      if (ctx.wander) {
        this._wander(e, dt);
        continue;
      }

      if (player.dead) {
        e.vel.multiplyScalar(Math.exp(-3 * dt));
        e.pos.addScaledVector(e.vel, dt);
        e.group.position.copy(e.pos);
        continue;
      }

      if (e.boss) this._boss(e, dt, ctx);
      else if (e.flying) this._wasp(e, dt, ctx);
      else this._walker(e, dt, ctx);

      // hard push out of props
      this._pushOut(e);
      e.group.position.copy(e.pos);
      if (!e.flying) e.group.position.y = e.pos.y;
    }

    // cull dead
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead && e.deathT > 0.42) {
        this.scene.remove(e.group);
        this.list.splice(i, 1);
      }
    }

    this._projectiles(dt, ctx);
  }

  _setFlash(e) {
    const white = e.flash > 0.01;
    for (const m of e.mats) {
      const u = m.uniforms.uColor;
      if (white) u.value.setRGB(1, 1, 1);
      else u.value.setHex(e.def.color);
    }
  }

  _steer(e, dt, ctx, desired, accel = 6) {
    // separation
    for (const o of this.list) {
      if (o === e || o.dead) continue;
      const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
      const rr = (e.radius + o.radius) * 1.05;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-5) {
        const d = Math.sqrt(d2);
        desired.x += (dx / d) * (rr - d) * 5;
        desired.z += (dz / d) * (rr - d) * 5;
      }
    }
    // props
    for (const c of this.world.colliders) {
      if (c.min.y > 1.4) continue;
      const cx = clamp(e.pos.x, c.min.x, c.max.x);
      const cz = clamp(e.pos.z, c.min.z, c.max.z);
      let dx = e.pos.x - cx, dz = e.pos.z - cz;
      let d = Math.hypot(dx, dz);
      const want = e.radius + 0.55;
      if (d < want) {
        if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
        desired.x += (dx / d) * (want - d) * 9;
        desired.z += (dz / d) * (want - d) * 9;
      }
    }
    e.vel.x = damp(e.vel.x, desired.x, accel, dt);
    e.vel.z = damp(e.vel.z, desired.z, accel, dt);
  }

  _pushOut(e) {
    for (const c of this.world.colliders) {
      if (c.min.y > 1.4) continue;
      const cx = clamp(e.pos.x, c.min.x, c.max.x);
      const cz = clamp(e.pos.z, c.min.z, c.max.z);
      let dx = e.pos.x - cx, dz = e.pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < e.radius && d > 1e-5) {
        const push = (e.radius - d) / d;
        e.pos.x += dx * push;
        e.pos.z += dz * push;
      }
    }
    const lim = 31.4;
    e.pos.x = clamp(e.pos.x, -lim, lim);
    e.pos.z = clamp(e.pos.z, -lim, lim);
  }

  _face(e, dt, speed = 9) {
    const target = Math.atan2(e.vel.x, e.vel.z);
    if (Math.abs(e.vel.x) + Math.abs(e.vel.z) > 0.2) {
      let d = target - e.group.rotation.y;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      e.group.rotation.y += d * Math.min(1, speed * dt);
    }
  }

  _wander(e, dt) {
    e.wanderT = (e.wanderT || 0) - dt;
    if (e.wanderT <= 0) {
      e.wanderT = rand(1.6, 3.6);
      e.wanderA = rand(0, TAU);
    }
    e.wanderA += Math.sin(e.t * 0.9 + e.radius) * 0.8 * dt;
    const sp = e.speed * 0.38;
    const tx = Math.cos(e.wanderA) * sp, tz = Math.sin(e.wanderA) * sp;
    e.vel.x += (tx - e.vel.x) * Math.min(1, dt * 2.6);
    e.vel.z += (tz - e.vel.z) * Math.min(1, dt * 2.6);
    e.pos.addScaledVector(e.vel, dt);
    if (e.pos.length() > 25) e.wanderA = Math.atan2(-e.pos.z, -e.pos.x);
    const t = e.t * (4 + e.speed);
    e.group.position.copy(e.pos);
    e.group.position.y = e.flying ? 2.2 + Math.sin(e.t * 2.1) * 0.3 : Math.abs(Math.sin(t)) * 0.07;
    e.group.rotation.z = Math.sin(t) * 0.06;
    e.group.rotation.x = Math.sin(t * 0.5) * 0.03;
    const want = Math.atan2(e.vel.x, e.vel.z);
    let d = want - e.group.rotation.y;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    e.group.rotation.y += d * Math.min(1, dt * 4);
    if (e.flying && e.group.userData.wings) {
      for (const w of e.group.userData.wings) w.rotation.z = Math.sin(e.t * 38) * 0.6;
    }
  }

  _walker(e, dt, ctx) {
    const { player } = ctx;
    const toP = _v1.copy(player.pos).sub(e.pos);
    toP.y = 0;
    const dist = toP.length();
    const dir = _v2.copy(toP).multiplyScalar(dist > 0.001 ? 1 / dist : 0);

    const range = e.radius + 1.05;
    const desired = _v3.set(0, 0, 0);

    if (e.windup > 0) {
      e.windup -= dt;
      desired.copy(dir).multiplyScalar(e.speed * 0.1);
      if (e.windup <= 0) {
        e.attackCd = 1.15;
        const nowDist = _v1.copy(player.pos).sub(e.pos).setY(0).length();
        if (nowDist < range + 0.7) {
          player.hurt(e.dmg);
          if (this.onPlayerHit) this.onPlayerHit(e);
          this.fx.burst(player.pos.clone().setY(1.1), 0xd42b3a, 8, { speed: 4, size: 0.12, life: 0.4 });
          const kb = _v1.copy(player.pos).sub(e.pos).setY(0).normalize();
          player.vel.addScaledVector(kb, 7);
        }
      }
    } else {
      e.attackCd -= dt;
      if (dist > range) {
        desired.copy(dir).multiplyScalar(e.speed);
      } else {
        desired.copy(dir).multiplyScalar(e.speed * 0.25);
        if (e.attackCd <= 0) e.windup = 0.32;
      }
    }

    this._steer(e, dt, ctx, desired, 7);
    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    e.pos.y = 0;
    this._face(e, dt);

    // walk wobble
    const t = e.t * (4 + e.speed);
    e.group.position.y = Math.abs(Math.sin(t)) * 0.07;
    e.group.rotation.z = Math.sin(t) * 0.06;
    e.group.rotation.x = Math.sin(t * 0.5) * 0.03;
  }

  _wasp(e, dt, ctx) {
    const { player } = ctx;
    const toP = _v1.copy(player.pos).sub(e.pos);
    toP.y = 0;
    const dist = toP.length();
    const dir = _v2.copy(toP).multiplyScalar(dist > 0.001 ? 1 / dist : 0);
    const desired = _v3.set(0, 0, 0);

    const ideal = 9;
    if (dist > ideal + 2.5) desired.copy(dir).multiplyScalar(e.speed);
    else if (dist < ideal - 2.5) desired.copy(dir).multiplyScalar(-e.speed * 0.9);
    else {
      // strafe
      desired.set(-dir.z, 0, dir.x).multiplyScalar(e.speed * 0.8 * (e.t % 12 < 6 ? 1 : -1));
      desired.addScaledVector(dir, e.speed * 0.15);
    }
    this._steer(e, dt, ctx, desired, 3.5);
    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    e.pos.y = 2.35 + Math.sin(e.t * 2.2) * 0.35;
    this._face(e, dt, 5);
    e.group.rotation.z = Math.sin(e.t * 3) * 0.18;

    const wings = e.group.userData.wings;
    if (wings) for (const w of wings) w.rotation.z = Math.sin(e.t * 38) * 0.6;

    e.attackCd -= dt;
    if (e.attackCd <= 0 && dist < 26) {
      e.attackCd = rand(1.5, 2.1);
      const from = e.pos.clone().setY(e.pos.y + 0.2);
      const d = _v1.copy(player.pos).setY(player.pos.y + 1.1).sub(from).normalize();
      this.spawnProjectile(from, d, 13, e.dmg, 0xf2c94c);
      audio.hit(false);
    }
  }

  _boss(e, dt, ctx) {
    const { player } = ctx;
    const toP = _v1.copy(player.pos).sub(e.pos);
    toP.y = 0;
    const dist = toP.length();
    const dir = _v2.copy(toP).multiplyScalar(dist > 0.001 ? 1 / dist : 0);
    const desired = _v3.set(0, 0, 0);

    if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
      e.phase = 2;
      this.fx.shake(0.35);
      this.fx.burst(e.pos.clone().setY(1.5), 0xd42b3a, 40, { speed: 12, size: 0.22, life: 1 });
      audio.boss();
    }

    if (e.type === 'eraser') {
      e.stateT -= dt;
      if (e.state === 'chase') {
        e.specialCd -= dt;
        desired.copy(dir).multiplyScalar(e.speed * (e.phase === 2 ? 1.35 : 1));
        if (e.specialCd <= 0) {
          e.state = 'windup';
          e.stateT = 0.85;
          e.chargeDir.copy(dir);
          this.fx.burst(e.pos.clone().setY(1.2), 0xd42b3a, 16, { speed: 4, size: 0.18, life: 0.5 });
        }
      } else if (e.state === 'windup') {
        e.group.position.x = e.pos.x + rand(-0.06, 0.06);
        e.group.rotation.z = Math.sin(e.t * 40) * 0.03;
        desired.set(0, 0, 0);
        if (e.stateT <= 0) {
          e.state = 'charge';
          e.stateT = e.phase === 2 ? 0.62 : 0.52;
          e.chargeDir.copy(dir);
          audio.dash();
          this.fx.shake(0.15);
        }
      } else if (e.state === 'charge') {
        e.pos.addScaledVector(e.chargeDir, (e.phase === 2 ? 27 : 22) * dt);
        this.fx.burst(e.pos.clone().setY(0.4), 0xef8fab, 2, { speed: 2, size: 0.2, life: 0.4, grav: 4 });
        if (dist < e.radius + 1.1) {
          if (player.hurt(e.dmg)) {
            if (this.onPlayerHit) this.onPlayerHit(e);
            const kb = _v1.copy(player.pos).sub(e.pos).setY(0).normalize();
            player.vel.addScaledVector(kb, 16);
            player.vel.y = 5;
          }
        }
        if (e.stateT <= 0) {
          e.state = 'recover';
          e.stateT = 0.75;
          this.fx.shake(0.28);
          this.fx.splat(e.pos, 3.2, 0xef8fab);
        }
      } else {
        desired.set(0, 0, 0);
        if (e.stateT <= 0) {
          e.state = 'chase';
          e.specialCd = e.phase === 2 ? rand(2.2, 3) : rand(3.2, 4);
        }
      }
      // summon
      e.summonCd = (e.summonCd ?? 6) - dt;
      if (e.summonCd <= 0 && this.alive < 9) {
        e.summonCd = e.phase === 2 ? 5 : 7;
        for (let i = 0; i < (e.phase === 2 ? 3 : 2); i++) {
          const a = rand(0, TAU);
          const p = e.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
          this.spawn('rusher', p);
        }
        this.fx.burst(e.pos.clone().setY(1.4), 0x4a5aa8, 20, { speed: 6, size: 0.16, life: 0.6 });
      }
    } else {
      // inkblot
      const ideal = 11;
      if (dist > ideal + 3) desired.copy(dir).multiplyScalar(e.speed);
      else if (dist < ideal - 3) desired.copy(dir).multiplyScalar(-e.speed);
      else desired.set(-dir.z, 0, dir.x).multiplyScalar(e.speed * 0.7);

      e.attackCd -= dt;
      if (e.attackCd <= 0) {
        e.attackCd = e.phase === 2 ? 1.1 : 1.7;
        const from = e.pos.clone().setY(2.6);
        const base = _v1.copy(player.pos).setY(1.1).sub(from).normalize();
        const n = e.phase === 2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = (i - (n - 1) / 2) * 0.22;
          const d = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
          this.spawnProjectile(from, d, 12 + (e.phase === 2 ? 3 : 0), e.dmg, 0x24242c);
        }
        audio.hit(false);
      }
      e.summonCd = (e.summonCd ?? 6) - dt;
      if (e.summonCd <= 0 && this.alive < 10) {
        e.summonCd = e.phase === 2 ? 5.5 : 7.5;
        for (let i = 0; i < (e.phase === 2 ? 3 : 2); i++) {
          const a = rand(0, TAU);
          this.spawn('blob', e.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5)));
        }
        this.fx.burst(e.pos.clone().setY(2), 0x24242c, 24, { speed: 7, size: 0.2, life: 0.7 });
      }
    }

    this._steer(e, dt, ctx, desired, e.boss ? 3 : 6);
    if (e.state !== 'charge') {
      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;
    }
    if (e.type === 'inkblot') {
      e.pos.y = 2.6 + Math.sin(e.t * 1.5) * 0.3;
    } else {
      e.pos.y = 0;
      e.group.rotation.z = Math.sin(e.t * 3) * 0.02;
    }
    this._face(e, dt, e.state === 'charge' ? 20 : 4);
    e.group.rotation.x = e.state === 'windup' ? -0.12 * Math.sin(e.t * 30) : 0;
  }

  spawnProjectile(from, dir, speed, dmg, color = 0x24242c) {
    const m = new THREE.Mesh(this.projGeo, inkMaterial({ color, hatch: 0.25, wobble: 0.06, shade: 0.2 }));
    addOutline(m, 0.02);
    m.position.copy(from);
    this.scene.add(m);
    this.projectiles.push({
      mesh: m, vel: dir.clone().multiplyScalar(speed), life: 5.5, dmg, dead: false, t: 0,
    });
  }

  _projectiles(dt, ctx) {
    const { player } = ctx;
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.t += dt;
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 4;
      const pos = p.mesh.position;
      if (p.life <= 0 || pos.y < 0.05 || Math.abs(pos.x) > 34 || Math.abs(pos.z) > 34) {
        p.dead = true;
        p.mesh.visible = false;
        if (pos.y < 0.2) this.fx.splat(pos, 0.6, 0x24242c);
        continue;
      }
      if (!player.dead) {
        const c = _v1.set(player.pos.x, player.pos.y + 0.95, player.pos.z);
        if (pos.distanceTo(c) < 0.8) {
          if (player.hurt(p.dmg)) {
            if (this.onPlayerHit) this.onPlayerHit(null);
            this.fx.burst(pos, 0x24242c, 10, { speed: 4, size: 0.12, life: 0.4 });
          }
          p.dead = true;
          p.mesh.visible = false;
        }
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].dead) {
        this.scene.remove(this.projectiles[i].mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.group);
    this.list.length = 0;
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles.length = 0;
  }
}
