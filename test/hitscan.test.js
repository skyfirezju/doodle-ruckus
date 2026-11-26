import './shim.js';
import * as THREE from 'three';
import { hitscan } from '../src/weapons.js';

const mk = (x, z, spheres) => ({ pos: new THREE.Vector3(x, 0, z), dead: false, hitSpheres: spheres });
const bodyCrit = [
  { offset: new THREE.Vector3(0, 0.55, 0), r: 0.63 },
  { offset: new THREE.Vector3(0, 0.91, 0), r: 0.33, crit: true },
];
const origin = new THREE.Vector3(0, 1.62, 0);
const world = { colliders: [] };
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

// 1. level aim at eye height 1.62 over a 1.24m-tall scribble -> flies over (by design)
let r = hitscan(origin, new THREE.Vector3(0, 0, -1), 90, [mk(0, -15, bodyCrit)], world);
ok(r.hits.length === 0, 'level aim flies over the short scribble (expected)');

// 2. aim 3deg down -> body hit, exactly one record, has point on sphere surface
const d3 = new THREE.Vector3(0, Math.tan(-3 * Math.PI / 180), -1).normalize();
r = hitscan(origin, d3, 90, [mk(0, -15, bodyCrit)], world);
ok(r.hits.length === 1, 'one hit record for one enemy (not two per sphere)');
ok(r.hits[0].point && r.hits[0].point.isVector3, 'hit has Vector3 point');
ok(r.hits[0].point.distanceTo(new THREE.Vector3(0, 0.55, -15)) <= 0.63 + 1e-6, 'point lies on body sphere');
ok(r.hits[0].crit === true, '3deg down passes through the face sphere: crit');
ok(r.point.distanceTo(r.hits[0].point) < 1e-6, 'res.point (tracer end) equals first hit point');

// 3. aim at crit sphere (y ~0.91 at 15m -> angle atan((1.62-0.91)/15) = 2.7deg... aim at y=1.1 top area)
const dc = new THREE.Vector3(0, 1.05, -15).sub(origin).normalize();
r = hitscan(origin, dc, 90, [mk(0, -15, bodyCrit)], world);
ok(r.hits.length === 1 && r.hits[0].crit === true, 'aim at head sphere: crit=true');

// 3b. aim 5deg down -> passes below the face sphere: body hit, no crit
const d5 = new THREE.Vector3(0, Math.tan(-5 * Math.PI / 180), -1).normalize();
r = hitscan(origin, d5, 90, [mk(0, -15, bodyCrit)], world);
ok(r.hits.length === 1 && r.hits[0].crit === false, '5deg down: body hit below the face, no crit');

// 4. two enemies in line -> sorted by distance, each once
r = hitscan(origin, d3, 90, [mk(0, -15, bodyCrit), mk(0, -8, bodyCrit)], world);
ok(r.hits.length === 2 && r.hits[0].enemy.pos.z === -8 && r.hits[1].enemy.pos.z === -15, 'two enemies sorted near->far');
ok(r.point.distanceTo(r.hits[0].point) < 1e-6 && Math.abs(r.pointEnd.y) < 1e-6 && r.pointEnd.z < -20, 'piercing tracer end (pointEnd) continues to the ground (~31m)');

// 5. wall between -> no enemy hit
r = hitscan(origin, new THREE.Vector3(0, 0, -1), 90, [mk(0, -15, bodyCrit)], { colliders: [{ min: { x: -5, y: 0, z: -10 }, max: { x: 5, y: 3, z: -9 } }] });
ok(r.hits.length === 0 && Math.abs(r.point.z - (-9)) < 1e-6 && Math.abs(r.pointEnd.z - (-9)) < 1e-6, 'wall blocks enemy; res.point & pointEnd on wall');

// 6. miss (aim at sky) -> empty, point at max range
r = hitscan(origin, new THREE.Vector3(0, 1, 0), 90, [mk(0, -15, bodyCrit)], world);
ok(r.hits.length === 0 && Math.abs(r.point.y - (1.62 + 90)) < 1e-6, 'miss: point at max range');

// 7. dead enemy ignored
const dead = mk(0, -5, bodyCrit); dead.dead = true;
r = hitscan(origin, new THREE.Vector3(0, 0, -1), 90, [dead], world);
ok(r.hits.length === 0, 'dead enemy ignored');

// 8. ground hit when aiming down (pitch -30deg)
const dg = new THREE.Vector3(0, Math.tan(-30 * Math.PI / 180), -1).normalize();
r = hitscan(origin, dg, 90, [], world);
ok(r.hits.length === 0 && Math.abs(r.point.y) < 1e-6 && r.normal.y === 1, 'ground hit: point.y=0, normal up');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
