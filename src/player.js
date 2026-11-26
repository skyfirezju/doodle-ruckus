// ---------- first person controller ----------
import * as THREE from 'three';
import { clamp, damp, rand, lerp } from './util.js';
import { KILL_Y } from './world.js';

const UP = new THREE.Vector3(0, 1, 0);
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _wish = new THREE.Vector3();

export class Player {
  constructor(camera, world, fx) {
    this.camera = camera;
    this.world = world;
    this.fx = fx;

    this.pos = new THREE.Vector3(0, 0, 10);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.36;
    this.height = 1.78;
    this.eye = 1.62;

    this.maxHp = 100;
    this.hp = 100;
    this.regenDelay = 4.2;
    this.regenRate = 13;
    this.regenTimer = 0;
    this.invuln = 0;
    this.dead = false;

    this.grounded = true;
    this.coyote = 0;
    this.bobT = 0;
    this.bobY = 0;
    this.bobX = 0;
    this.roll = 0;
    this.stepAcc = 0;

    this.dashCd = 0;
    this.dashTime = 0;
    this.dashCdMax = 2.2;
    this.dashDir = new THREE.Vector3();

    this.sprint = false;
    this.speedMul = 1;
    this.onHurt = null;
    this.onDeath = null;
    this.onFall = null;
    this.onStep = null;
    this.onJump = null;
    this.onDash = null;
    this.onLand = null;

    this._prevY = 0;
    this._wasGrounded = true;
  }

  reset(spawn = new THREE.Vector3(0, 0, 10)) {
    this.pos.copy(spawn);
    this.vel.set(0, 0, 0);
    this.yaw = Math.atan2(-spawn.x, -spawn.z) || 0;
    this.pitch = 0;
    this.hp = this.maxHp;
    this.dead = false;
    this.regenTimer = 0;
    this.invuln = 0;
    this.dashCd = 0;
    this.dashTime = 0;
    this.grounded = true;
    this.bobT = 0;
  }

  look(dx, dy, sens = 0.0022) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = clamp(this.pitch, -1.45, 1.45);
  }

  get forward() {
    return _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  get flatForward() {
    return _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  get aimDir() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eye + this.bobY, this.pos.z);
  }

  update(dt, input) {
    if (this.dead) return;
    const keys = input.keys;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);

    // ---- wish direction ----
    const iz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const fwd = _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rgt = _r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _wish.set(0, 0, 0).addScaledVector(fwd, iz).addScaledVector(rgt, ix);
    if (_wish.lengthSq() > 0) _wish.normalize();

    this.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const baseSpeed = (this.sprint ? 10.4 : 6.6) * this.speedMul;

    // ---- dash ----
    if (input.dash && this.dashCd <= 0 && this.dashTime <= 0) {
      this.dashTime = 0.17;
      this.dashCd = this.dashCdMax;
      this.dashDir.copy(_wish.lengthSq() > 0 ? _wish : fwd);
      this.vel.x = this.dashDir.x * 25;
      this.vel.z = this.dashDir.z * 25;
      this.vel.y = Math.max(this.vel.y, 0);
      this.invuln = Math.max(this.invuln, 0.32);
      this.fx.shake(0.09);
      if (this.onDash) this.onDash();
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vel.x = this.dashDir.x * 25;
      this.vel.z = this.dashDir.z * 25;
    } else {
      const accel = this.grounded ? 62 : 20;
      this.vel.x += _wish.x * accel * dt;
      this.vel.z += _wish.z * accel * dt;
      const fr = this.grounded ? 11 : 0.8;
      this.vel.x -= this.vel.x * Math.min(1, fr * dt);
      this.vel.z -= this.vel.z * Math.min(1, fr * dt);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      const lim = this.grounded ? baseSpeed : baseSpeed * 1.15;
      if (sp > lim) {
        const k = lim / sp;
        this.vel.x *= k; this.vel.z *= k;
      }
    }

    // ---- jump / gravity ----
    if (this.grounded) this.coyote = 0.12; else this.coyote = Math.max(0, this.coyote - dt);
    if (input.jump && this.coyote > 0) {
      this.vel.y = 8.8;
      this.grounded = false;
      this.coyote = 0;
      if (this.onJump) this.onJump();
    }
    this.vel.y -= 26 * dt;
    if (this.vel.y < -30) this.vel.y = -30;

    // ---- move + collide ----
    this._prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;
    this._resolveY();
    this.pos.x += this.vel.x * dt;
    this._resolveXZ('x');
    this.pos.z += this.vel.z * dt;
    this._resolveXZ('z');

    // ground plane
    if (this.pos.y <= 0) {
      if (!this._wasGrounded && this.vel.y < -3) {
        if (this.onLand) this.onLand(Math.abs(this.vel.y));
        this.fx.shake(Math.min(0.12, Math.abs(this.vel.y) * 0.008));
      }
      this.pos.y = 0;
      this.vel.y = 0;
      this.grounded = true;
    }
    this._wasGrounded = this.grounded;

    // fell off the page
    if (this.pos.y < KILL_Y) this.fellOff();

    // ---- head bob ----
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && sp > 0.4) {
      this.bobT += dt * (3.4 + sp * 0.85);
      const amp = Math.min(1, sp / 8) * 0.045;
      this.bobY = Math.sin(this.bobT * 2) * amp;
      this.bobX = Math.cos(this.bobT) * amp * 0.8;
      this.stepAcc += dt * sp;
      if (this.stepAcc > 2.1) { this.stepAcc = 0; if (this.onStep) this.onStep(); }
    } else {
      this.bobY = damp(this.bobY, 0, 10, dt);
      this.bobX = damp(this.bobX, 0, 10, dt);
    }
    const strafe = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw);
    this.roll = damp(this.roll, -strafe * 0.0045, 8, dt);

    // ---- regen ----
    this.regenTimer += dt;
    if (this.regenTimer > this.regenDelay && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    }
  }

  _resolveY() {
    const p = this.pos;
    for (const c of this.world.colliders) {
      if (p.x + this.radius <= c.min.x || p.x - this.radius >= c.max.x) continue;
      if (p.z + this.radius <= c.min.z || p.z - this.radius >= c.max.z) continue;
      if (p.y + this.height <= c.min.y || p.y >= c.max.y) continue;
      // overlap on y
      if (this.vel.y <= 0 && this._prevY >= c.max.y - 0.02) {
        p.y = c.max.y;
        this.vel.y = 0;
        this.grounded = true;
      } else if (this.vel.y > 0 && this._prevY + this.height <= c.min.y + 0.02) {
        p.y = c.min.y - this.height;
        this.vel.y = 0;
      }
    }
    if (this.vel.y !== 0) this.grounded = false;
  }

  _resolveXZ(axis) {
    const p = this.pos;
    const r = this.radius;
    for (const c of this.world.colliders) {
      if (p.y + this.height <= c.min.y + 0.02 || p.y >= c.max.y - 0.02) continue;
      const ox = p.x + r - c.min.x;
      const ox2 = c.max.x - (p.x - r);
      const oz = p.z + r - c.min.z;
      const oz2 = c.max.z - (p.z - r);
      if (ox <= 0 || ox2 <= 0 || oz <= 0 || oz2 <= 0) continue;
      // overlap in 3d
      if (axis === 'x') {
        if (ox < ox2) p.x = c.min.x - r; else p.x = c.max.x + r;
        this.vel.x = 0;
      } else {
        if (oz < oz2) p.z = c.min.z - r; else p.z = c.max.z + r;
        this.vel.z = 0;
      }
    }
  }

  hurt(amount, opts = {}) {
    if (this.dead) return false;
    if (this.invuln > 0 && !opts.ignoreInvuln) return false;
    this.hp -= amount;
    this.regenTimer = 0;
    this.invuln = opts.invuln ?? 0.4;
    this.fx.shake(Math.min(0.3, 0.06 + amount * 0.008));
    if (this.onHurt) this.onHurt(amount);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (this.onDeath) this.onDeath();
    }
    return true;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  fellOff() {
    if (this.dead) return;
    this.hp -= 20;
    this.regenTimer = 0;
    this.pos.set(0, 0.1, 0);
    this.vel.set(0, 0, 0);
    this.invuln = 1.2;
    if (this.onFall) this.onFall();
    this.fx.shake(0.28);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (this.onDeath) this.onDeath();
    }
  }

  applyCamera() {
    const cam = this.camera;
    cam.position.set(this.pos.x + this.bobX * 0.5, this.pos.y + this.eye + this.bobY, this.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    cam.rotation.z = this.roll;
  }
}
