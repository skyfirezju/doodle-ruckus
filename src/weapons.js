// ---------- weapons + viewmodel ----------
import * as THREE from 'three';
import { getWeaponSprite, getMuzzle } from './textures.js';
import { audio } from './audio.js';
import { clamp, damp, rand, lerp } from './util.js';
import { PALETTE } from './ink.js';

export const WEAPON_DEFS = [
  {
    id: 'pencil', name: '铅笔手枪', en: 'PENCIL POPPER', slot: 1,
    dmg: 26, mag: 12, reload: 0.85, rate: 0.16, auto: false,
    spread: 0.016, pellets: 1, pierce: 0, shake: 0.05, kick: 0.05, range: 90,
    color: 0x1b2fb8, desc: '点射精准 · 爆头 ×2',
  },
  {
    id: 'marker', name: '马克笔霰弹', en: 'MARKER BLASTER', slot: 2,
    dmg: 12, mag: 6, reload: 1.5, rate: 0.74, auto: false,
    spread: 0.09, pellets: 8, pierce: 0, shake: 0.17, kick: 0.17, range: 40,
    color: 0xd42b3a, desc: '近距离一片 · 8 发弹丸',
  },
  {
    id: 'ruler', name: '尺子轨道炮', en: 'RULER RAILGUN', slot: 3,
    dmg: 90, mag: 3, reload: 1.95, rate: 1.05, auto: false,
    spread: 0.002, pellets: 1, pierce: 3, shake: 0.22, kick: 0.22, range: 160,
    color: 0x7a5ac8, desc: '穿透一切 · 无视盾牌',
  },
];

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _c = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _muz = new THREE.Vector3();

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const h = b * b - c;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  if (t >= 0) return t;
  const t2 = -b + Math.sqrt(h);
  return t2 >= 0 ? 0.0001 : -1;
}

function rayAABB(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0, tmax = 1e9;
  let n = [0, 0, 0];
  // x
  if (Math.abs(dx) < 1e-8) { if (ox < b.min.x || ox > b.max.x) return null; }
  else {
    let t1 = (b.min.x - ox) / dx, t2 = (b.max.x - ox) / dx;
    let s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; n = [s, 0, 0]; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (Math.abs(dy) < 1e-8) { if (oy < b.min.y || oy > b.max.y) return null; }
  else {
    let t1 = (b.min.y - oy) / dy, t2 = (b.max.y - oy) / dy;
    let s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; n = [0, s, 0]; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (Math.abs(dz) < 1e-8) { if (oz < b.min.z || oz > b.max.z) return null; }
  else {
    let t1 = (b.min.z - oz) / dz, t2 = (b.max.z - oz) / dz;
    let s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; n = [0, 0, s]; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return { t: tmin > 0 ? tmin : 0.0001, nx: n[0], ny: n[1], nz: n[2] };
}

export function hitscan(origin, dir, maxDist, enemies, world) {
  let best = maxDist;
  let nx = 0, ny = 1, nz = 0;
  const hits = [];
  for (const e of enemies) {
    if (e.dead) continue;
    // one hit record per enemy: nearest sphere decides distance, any crit sphere hit => crit
    let tMin = -1, crit = false;
    for (const s of e.hitSpheres) {
      _c.copy(e.pos).add(s.offset);
      const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, _c.x, _c.y, _c.z, s.r);
      if (t < 0) continue;
      if (tMin < 0 || t < tMin) tMin = t;
      if (s.crit) crit = true;
    }
    if (tMin >= 0 && tMin <= best) {
      hits.push({
        t: tMin, enemy: e, crit,
        point: new THREE.Vector3(origin.x + dir.x * tMin, origin.y + dir.y * tMin, origin.z + dir.z * tMin),
      });
    }
  }
  for (const c of world.colliders) {
    const r = rayAABB(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, c);
    if (r && r.t < best) { best = r.t; nx = r.nx; ny = r.ny; nz = r.nz; }
  }
  if (dir.y < -1e-6) {
    const t = -origin.y / dir.y;
    if (t > 0 && t < best) { best = t; nx = 0; ny = 1; nz = 0; }
  }
  hits.sort((a, b) => a.t - b.t);
  const out = [];
  for (const h of hits) if (h.t <= best) out.push(h);
  const worldDist = best;
  if (out.length) best = out[0].t; // first thing actually hit (enemy or world)
  return {
    hits: out,
    dist: best,
    point: new THREE.Vector3(origin.x + dir.x * best, origin.y + dir.y * best, origin.z + dir.z * best),
    // end of the ray before enemies (wall / ground / max range) — for piercing tracers
    pointEnd: new THREE.Vector3(origin.x + dir.x * worldDist, origin.y + dir.y * worldDist, origin.z + dir.z * worldDist),
    normal: { x: nx, y: ny, z: nz },
  };
}

export class Weapons {
  constructor(camera, scene, fx) {
    this.camera = camera;
    this.scene = scene;
    this.fx = fx;

    this.mods = {
      dmg: 1, rate: 1, reload: 1, mag: 0, pellets: 0, pierce: 0, crit: 0, lifesteal: 0,
      explode: 0, magMul: 1,
    };

    this.list = WEAPON_DEFS.map((def) => ({
      def,
      ammo: def.mag,
      cooldown: 0,
      reloading: 0,
      reloadTime: def.reload,
    }));
    this.index = 0;
    this.switchT = 0;
    this.recoil = 0;
    this.bobT = 0;
    this.muzzleT = 0;
    this.meleeCd = 0;
    this.meleeAnim = 0;
    this.onShoot = null;
    this.onHit = null;
    this.onMelee = null;
    this.onReload = null;

    // ---- viewmodel ----
    this.sprites = [];
    for (const w of this.list) {
      const mat = new THREE.SpriteMaterial({
        map: getWeaponSprite(w.def.id),
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1,
      });
      const s = new THREE.Sprite(mat);
      s.scale.set(0.95, 0.95, 1);
      s.position.set(0.58, -0.48, -1.15);
      s.renderOrder = 900;
      s.visible = false;
      camera.add(s);
      this.sprites.push(s);
    }
    this.muzzle = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getMuzzle(), depthTest: false, depthWrite: false, transparent: true, opacity: 0,
    }));
    this.muzzle.scale.set(0.55, 0.55, 1);
    this.muzzle.position.set(0.5, -0.16, -1.3);
    this.muzzle.renderOrder = 901;
    camera.add(this.muzzle);

    this._basePos = new THREE.Vector3(0.58, -0.48, -1.15);
    this.setVisible(false);
  }

  get current() { return this.list[this.index]; }

  setVisible(v) {
    for (const s of this.sprites) s.visible = false;
    if (v) this.sprites[this.index].visible = true;
    this.muzzle.visible = v;
  }

  reset() {
    for (const w of this.list) {
      w.ammo = this.magSize(w);
      w.cooldown = 0;
      w.reloading = 0;
    }
    this.index = 0;
    this.recoil = 0;
    this.meleeCd = 0;
    this.setVisible(false);
  }

  magSize(w) {
    return Math.round(w.def.mag * this.mods.magMul + this.mods.mag);
  }
  dmgOf(w) { return w.def.dmg * this.mods.dmg; }
  rateOf(w) { return w.def.rate / this.mods.rate; }
  reloadOf(w) { return w.def.reload * this.mods.reload; }

  switchTo(i) {
    if (i === this.index || i < 0 || i >= this.list.length) return;
    this.index = i;
    this.switchT = 0.28;
    const w = this.current;
    w.reloading = 0;
    this.setVisible(true);
    audio.click();
  }

  startReload() {
    const w = this.current;
    if (w.reloading > 0 || w.ammo >= this.magSize(w)) return;
    w.reloading = this.reloadOf(w);
    audio.reload();
    if (this.onReload) this.onReload();
  }

  update(dt, input, ctx) {
    const { player, enemies, world } = ctx;
    const w = this.current;

    this.meleeCd = Math.max(0, this.meleeCd - dt);
    this.meleeAnim = Math.max(0, this.meleeAnim - dt * 5);
    this.switchT = Math.max(0, this.switchT - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);

    // switching
    for (const def of WEAPON_DEFS) {
      if (input.pressed.has('Digit' + def.slot)) this.switchTo(def.slot - 1);
    }
    if (input.wheel) this.switchTo((this.index + input.wheel + this.list.length * 3) % this.list.length);
    if (input.pressed.has('KeyR')) this.startReload();

    // reload
    if (w.reloading > 0) {
      w.reloading -= dt;
      if (w.reloading <= 0) {
        w.reloading = 0;
        w.ammo = this.magSize(w);
      }
    }

    w.cooldown = Math.max(0, w.cooldown - dt);

    // ---- firing ----
    const wantFire = w.def.auto ? input.firing : input.firePressed;
    if (wantFire && w.reloading <= 0 && this.switchT <= 0) this.tryFire(ctx);

    // ---- melee ----
    if (input.pressed.has('KeyF') && this.meleeCd <= 0) this.doMelee(ctx);

    // ---- viewmodel animation ----
    this.recoil = damp(this.recoil, 0, 11, dt);
    const sp = Math.hypot(player.vel.x, player.vel.z);
    this.bobT += dt * (2.2 + sp * 0.95);
    const amp = Math.min(1, sp / 8) * 0.022;
    const bobX = Math.cos(this.bobT) * amp;
    const bobY = Math.sin(this.bobT * 2) * amp * 0.9;
    const s = this.sprites[this.index];
    const mx = this.meleeAnim * 0.55;
    const target = _tmp.set(
      this._basePos.x + bobX + this.recoil * 0.10 + mx,
      this._basePos.y + bobY - this.recoil * 0.07 - mx * 0.3,
      this._basePos.z + this.recoil * 0.16 + mx * 0.5
    );
    s.position.lerp(target, 1 - Math.exp(-26 * dt));
    s.material.rotation = -this.recoil * 0.16 + mx * 0.5;
    const sc = 0.95 - this.recoil * 0.05;
    s.scale.set(sc, sc, 1);

    this.muzzle.material.opacity = this.muzzleT > 0 ? clamp(this.muzzleT / 0.055, 0, 1) : 0;
    this.muzzle.material.rotation = rand(0, Math.PI * 2);
  }

  tryFire(ctx) {
    const w = this.current;
    if (w.cooldown > 0) return;
    if (w.ammo <= 0) {
      audio.empty();
      this.startReload();
      return;
    }
    w.ammo--;
    w.cooldown = this.rateOf(w);
    this.recoil = Math.min(1.4, this.recoil + w.def.kick);
    this.muzzleT = 0.055;
    this.fx.shake(w.def.shake);

    const { player, enemies, world } = ctx;
    const origin = player.eyePos;
    const dir = player.aimDir;
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const up = new THREE.Vector3(0, 1, 0);

    _muz.copy(origin).addScaledVector(dir, 0.9).addScaledVector(right, 0.2).addScaledVector(up, -0.14);

    const pellets = w.def.pellets + this.mods.pellets;
    const pierce = w.def.pierce + this.mods.pierce;
    const dmgBase = this.dmgOf(w);

    for (let p = 0; p < pellets; p++) {
      const spread = w.def.spread * (pellets > 1 ? 1 : 0.6);
      const d = dir.clone();
      d.x += rand(-spread, spread);
      d.y += rand(-spread, spread);
      d.z += rand(-spread, spread);
      d.normalize();

      if (this.mods.homing) {
        let best = null, bestScore = 1e9;
        for (const e of enemies.list) {
          if (e.dead) continue;
          const to = _tmp.copy(e.pos).setY(e.pos.y + 0.9).sub(origin);
          const dist = to.length();
          if (dist > w.def.range) continue;
          const dot = to.multiplyScalar(1 / dist).dot(d);
          if (dot < 0.84) continue;
          const sc = dist * (2 - dot);
          if (sc < bestScore) { bestScore = sc; best = e; }
        }
        if (best) {
          const to = new THREE.Vector3().copy(best.pos).setY(best.pos.y + 0.9).sub(origin).normalize();
          d.lerp(to, 0.6).normalize();
        }
      }

      const res = hitscan(origin, d, w.def.range, enemies.list, world);
      // tracer: stops at the first thing hit; piercing shots keep going to the wall/ground
      const end = w.def.pierce > 0 ? res.pointEnd : res.point;
      this.fx.tracer(_muz, end, w.def.color, w.def.id === 'ruler' ? 0.075 : 0.03);
      if (w.def.id === 'ruler') {
        this.fx.tracer(_muz, end, 0xfffdf5, 0.025);
      }

      let left = pierce + 1;
      for (const h of res.hits) {
        if (left-- <= 0) break;
        const crit = h.crit || Math.random() < this.mods.crit;
        const dmg = dmgBase * (crit ? 2 : 1) * rand(0.92, 1.08);
        const killed = enemies.damage(h.enemy, dmg, {
          crit, dir: d, point: h.point, fromPlayer: true, weapon: w.def.id, pierce: w.def.pierce > 0,
        });
        if (this.onHit) this.onHit(h.enemy, dmg, crit, killed, h.point, w.def.color);
        this.fx.burst(h.point, crit ? 0xd42b3a : w.def.color, crit ? 10 : 5, { speed: 3.5, size: 0.1, life: 0.4, grav: 10 });
      }

      if (res.hits.length === 0) {
        // impact on world
        this.fx.burst(end, 0x1b2fb8, 5, { speed: 2.5, size: 0.08, life: 0.35, grav: 12, dir: res.normal });
        if (res.normal.y > 0.7 && Math.random() < 0.5) {
          this.fx.splat(end, rand(0.35, 0.7), w.def.color);
        }
      }
    }

    audio.shoot(w.def.id);
    if (this.onShoot) this.onShoot(w.def);
    if (w.ammo <= 0) setTimeout(() => { if (this.current === w && w.ammo <= 0) this.startReload(); }, 120);
  }

  doMelee(ctx) {
    const { player, enemies } = ctx;
    this.meleeCd = 0.55;
    this.meleeAnim = 1;
    audio.parry();
    const origin = player.pos.clone().setY(player.pos.y + 1.1);
    const dir = player.flatForward;
    let hitAny = false;
    for (const e of enemies.list) {
      if (e.dead) continue;
      const to = _tmp.copy(e.pos).sub(player.pos);
      const d = to.length();
      if (d > 3.1 + e.radius) continue;
      to.y = 0; to.normalize();
      if (to.dot(dir) < 0.35) continue;
      const killed = enemies.damage(e, 60 * this.mods.dmg, { crit: false, dir: to, point: e.pos.clone().setY(1), melee: true, fromPlayer: true });
      if (this.onHit) this.onHit(e, 60 * this.mods.dmg, false, killed, e.pos.clone().setY(1), 0x1b2fb8);
      e.vel.addScaledVector(to, 14);
      hitAny = true;
    }
    // deflect projectiles
    for (const pr of enemies.projectiles) {
      if (pr.dead) continue;
      if (pr.mesh.position.distanceTo(player.pos) < 3.2) {
        pr.dead = true;
        pr.mesh.visible = false;
        this.fx.burst(pr.mesh.position, 0xfffdf5, 6, { speed: 3, size: 0.1, life: 0.3 });
      }
    }
    if (this.onMelee) this.onMelee(hitAny);
    this.fx.shake(0.05);
  }

  ammoText() {
    const w = this.current;
    if (w.reloading > 0) return '装填中';
    return `${w.ammo} / ${this.magSize(w)}`;
  }
}
