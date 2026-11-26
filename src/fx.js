// ---------- particles, tracers, decals, screen shake ----------
import * as THREE from 'three';
import { particleMaterial, tracerMaterial, decalMaterial, PALETTE } from './ink.js';
import { getSplat } from './textures.js';
import { rand, clamp } from './util.js';

const MAX_P = 1500;

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // ---- particles ----
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_P * 3);
    this.pCol = new Float32Array(MAX_P * 3);
    this.pSize = new Float32Array(MAX_P);
    this.pAlpha = new Float32Array(MAX_P);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.pCol, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.pAlpha, 1));
    this.points = new THREE.Points(geo, particleMaterial());
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    this.vel = new Float32Array(MAX_P * 3);
    this.life = new Float32Array(MAX_P);
    this.maxLife = new Float32Array(MAX_P);
    this.grav = new Float32Array(MAX_P);
    this.baseSize = new Float32Array(MAX_P);
    this.drag = new Float32Array(MAX_P);
    this.head = 0;

    // ---- tracers ----
    this.tracers = [];
    const tGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 28; i++) {
      const mat = tracerMaterial(0x1b2fb8);
      const m = new THREE.Mesh(tGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 4;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0, maxLife: 0 });
    }
    this.tracerIdx = 0;

    // ---- splat decals ----
    this.decals = [];
    this.decalIdx = 0;
    const dGeo = new THREE.PlaneGeometry(1, 1);
    const splatTex = [0, 1, 2, 3, 4].map((i) => getSplat(i));
    for (let i = 0; i < 70; i++) {
      const mat = decalMaterial(splatTex[i % 5], { opacity: 0.95 });
      const m = new THREE.Mesh(dGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 1;
      scene.add(m);
      this.decals.push(m);
    }

    // ---- camera shake / hitstop ----
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.hitstop = 0;
    this.offset = new THREE.Vector3();
    this.roll = 0;

    // ---- ink canvas overlay ----
    this.inkCanvas = document.getElementById('ink');
    this.inkCtx = this.inkCanvas ? this.inkCanvas.getContext('2d') : null;
    this._sizeInk();
    window.addEventListener('resize', () => this._sizeInk());
  }

  _sizeInk() {
    if (!this.inkCanvas) return;
    const dpr = Math.min(devicePixelRatio, 2);
    this.inkCanvas.width = innerWidth * dpr;
    this.inkCanvas.height = innerHeight * dpr;
    this.inkCanvas.style.width = innerWidth + 'px';
    this.inkCanvas.style.height = innerHeight + 'px';
    this.inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- particles ----------
  spawn(p, v, color, size, life, grav = 12, drag = 2.5) {
    const i = this.head;
    this.head = (this.head + 1) % MAX_P;
    this.pPos[i * 3] = p.x; this.pPos[i * 3 + 1] = p.y; this.pPos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    _c.set(color);
    this.pCol[i * 3] = _c.r; this.pCol[i * 3 + 1] = _c.g; this.pCol[i * 3 + 2] = _c.b;
    this.pSize[i] = size;
    this.baseSize[i] = size;
    this.pAlpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  burst(pos, color, n = 12, opts = {}) {
    const speed = opts.speed ?? 6;
    const size = opts.size ?? 0.16;
    const life = opts.life ?? 0.7;
    const grav = opts.grav ?? 14;
    const dir = opts.dir;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
      if (dir) v.addScaledVector(dir, 1.2).normalize();
      v.multiplyScalar(speed * rand(0.35, 1));
      this.spawn(pos, v, color, size * rand(0.6, 1.5), life * rand(0.6, 1.3), grav, opts.drag ?? 2.2);
    }
  }

  updateParticles(dt) {
    const n = MAX_P;
    for (let i = 0; i < n; i++) {
      if (this.life[i] <= 0) { if (this.pAlpha[i] !== 0) this.pAlpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 2] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.pPos[i * 3] += this.vel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pPos[i * 3 + 1] < 0.02) {
        this.pPos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] *= -0.35;
        this.vel[i * 3] *= 0.7; this.vel[i * 3 + 2] *= 0.7;
      }
      this.pAlpha[i] = k;
      this.pSize[i] = this.baseSize[i] * (0.55 + 0.45 * k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  // ---------- tracers ----------
  tracer(from, to, color = 0x1b2fb8, width = 0.035) {
    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const d = _v.copy(to).sub(from);
    const len = d.length();
    if (len < 0.001) return;
    t.mesh.position.copy(from).addScaledVector(d, 0.5);
    t.mesh.lookAt(to);
    t.mesh.scale.set(width, width, len);
    t.mesh.material.uniforms.uColor.value.set(color);
    t.mesh.material.uniforms.uAlpha.value = 1;
    t.mesh.visible = true;
    t.life = t.maxLife = 0.085;
  }

  updateTracers(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.uniforms.uAlpha.value = Math.max(0, t.life / t.maxLife);
      if (t.life <= 0) t.mesh.visible = false;
    }
  }

  // ---------- decals ----------
  splat(pos, scale = 1.6, color = 0x1b2fb8) {
    const m = this.decals[this.decalIdx];
    this.decalIdx = (this.decalIdx + 1) % this.decals.length;
    m.visible = true;
    m.position.set(pos.x, 0.022 + this.decalIdx * 0.0006, pos.z);
    m.rotation.z = rand(0, Math.PI * 2);
    m.scale.setScalar(scale * rand(0.8, 1.25));
    m.material.color.set(color);
  }

  // ---------- shake ----------
  shake(amount) {
    this.shakeAmt = Math.min(0.55, this.shakeAmt + amount);
  }

  freeze(ms) {
    this.hitstop = Math.max(this.hitstop, ms);
  }

  updateShake(dt) {
    if (this.shakeAmt > 0.0005) {
      this.shakeAmt *= Math.exp(-9 * dt);
      const a = this.shakeAmt;
      this.offset.set(rand(-a, a), rand(-a, a), rand(-a, a) * 0.5);
      this.roll = rand(-a, a) * 0.35;
    } else {
      this.shakeAmt = 0;
      this.offset.set(0, 0, 0);
      this.roll = 0;
    }
    if (this.hitstop > 0) this.hitstop -= dt * 1000;
  }

  // ---------- screen ink ----------
  inkBlot(x, y, size, color = 'rgba(27,47,184,0.85)') {
    const c = this.inkCtx;
    if (!c) return;
    c.save();
    c.fillStyle = color;
    for (let i = 0; i < 7; i++) {
      const a = rand(0, Math.PI * 2), d = rand(0, size * 0.6);
      const r = rand(size * 0.12, size * 0.42);
      c.beginPath();
      c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r, r * rand(0.7, 1.2), rand(0, 3), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  fadeInk(dt) {
    const c = this.inkCtx;
    if (!c) return;
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = 'rgba(0,0,0,' + Math.min(1, dt * 1.6) + ')';
    c.fillRect(0, 0, innerWidth, innerHeight);
    c.restore();
  }

  clearInk() {
    if (!this.inkCtx) return;
    this.inkCtx.clearRect(0, 0, innerWidth, innerHeight);
  }

  update(dt) {
    this.updateParticles(dt);
    this.updateTracers(dt);
    this.updateShake(dt);
    this.fadeInk(dt);
  }
}
