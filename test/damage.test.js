import './shim.js';
import * as THREE from 'three';
import { Enemies, ENEMY_DEFS } from '../src/enemies.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

// fake manager: damage() only touches this.list/kill; audio guards on ctx
const fake = { list: [], kills: 0, kill(e) { this.kills++; e.dead = true; } };
const dmg = (e, amount, opts) => Enemies.prototype.damage.call(fake, e, amount, opts);
const mkShield = (rotY) => {
  const g = new THREE.Group(); g.rotation.y = rotY;
  return { type: 'shield', def: ENEMY_DEFS.shield, group: g, hp: ENEMY_DEFS.shield.hp, dead: false, pos: new THREE.Vector3(0, 0, -10) };
};
const dir = new THREE.Vector3(0, 0, -1); // player shoots toward -z
const near = (a, b) => Math.abs(a - b) < 1e-6;

// 1. shield facing player (front) -> reduced x0.22
let e = mkShield(0); dmg(e, 26, { dir });
ok(near(e.hp, 130 - 26 * 0.22), `frontal shot reduced to x0.22 (hp ${e.hp.toFixed(2)})`);

// 2. side -> full damage
e = mkShield(Math.PI / 2); dmg(e, 26, { dir });
ok(near(e.hp, 130 - 26), 'side shot: full damage');

// 3. back -> full damage
e = mkShield(Math.PI); dmg(e, 26, { dir });
ok(near(e.hp, 130 - 26), 'back shot: full damage');

// 4. frontal but piercing weapon (railgun) -> full damage
e = mkShield(0); dmg(e, 90, { dir, pierce: true });
ok(near(e.hp, 130 - 90), 'railgun pierce ignores shield: full damage');

// 5. frontal melee -> full damage
e = mkShield(0); dmg(e, 60, { dir, melee: true });
ok(near(e.hp, 130 - 60), 'melee ignores shield: full damage');

// 6. non-shield enemy frontal -> full damage
const other = { type: 'scribble', def: ENEMY_DEFS.scribble, group: new THREE.Group(), hp: 42, dead: false, pos: new THREE.Vector3() };
const killed = dmg(other, 26, { dir });
ok(!killed && near(other.hp, 16), 'scribble: full damage, not killed by 26');

// 7. lethal frontal on low-hp shield -> kill() called once, returns true
e = mkShield(0); e.hp = 5; const k = dmg(e, 26, { dir });
ok(k === true && e.dead && fake.kills === 1, 'lethal hit: kill() called, returns true');

// 8. dead enemy -> ignored
const before = fake.kills; e = mkShield(0); e.dead = true; const r = dmg(e, 26, { dir });
ok(r === false && fake.kills === before, 'dead enemy ignored');

// 9. no dir (e.g. splash) -> no reduction
e = mkShield(0); dmg(e, 26, {});
ok(near(e.hp, 130 - 26), 'no dir: no reduction');

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nALL PASSED');
