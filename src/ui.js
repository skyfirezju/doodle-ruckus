// ---------- DOM HUD + screens ----------
import * as THREE from 'three';
import { clamp, fmt } from './util.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(camera) {
    this.camera = camera;
    this.el = {};
    const ids = [
      'hud', 'score', 'combo', 'comboFill', 'waveLabel', 'waveSub', 'weaponName', 'weaponEn', 'ammo',
      'hpFill', 'hpNum', 'crosshair', 'hitmarker', 'dashFill', 'bossBar', 'bossFill', 'bossName',
      'killfeed', 'dmgLayer', 'hint', 'banner', 'bannerTitle', 'bannerSub', 'hurt', 'heal',
      'screen-title', 'screen-pause', 'screen-upgrade', 'screen-over', 'screen-victory',
      'title-best', 'btn-start', 'btn-resume', 'btn-restart', 'btn-quit', 'sens', 'vol',
      'over-score', 'over-wave', 'over-best', 'btn-over-restart', 'btn-over-title',
      'victory-score', 'btn-victory-continue', 'btn-victory-title',
      'upgrade-cards', 'upgrade-title', 'over-title',
    ];
    for (const id of ids) this.el[id] = $(id);
    this.el.screens = [...document.querySelectorAll('.screen')];
    this.dmgPool = [];
    this.dmgActive = [];
    this.killItems = [];
    this.hitT = 0;
    this.hurtT = 0;
    this.healT = 0;
    this.bannerT = 0;
    this.lastHp = 100;
  }

  showScreen(name) {
    for (const s of this.el.screens) s.classList.add('hidden');
    if (name) {
      const el = $('screen-' + name);
      if (el) el.classList.remove('hidden');
    }
    this.el.hud.classList.toggle('hidden', name !== null);
  }

  // ---------- HUD ----------
  setScore(v) { this.el.score.textContent = fmt(v); }
  setCombo(n, t) {
    if (n <= 1) { this.el.combo.classList.add('hidden'); return; }
    this.el.combo.classList.remove('hidden');
    this.el.combo.innerHTML = `<b>×${n}</b><span>连击</span>`;
    this.el.comboFill.style.transform = `scaleX(${clamp(t, 0, 1)})`;
  }
  setWave(n, total, remaining) {
    this.el.waveLabel.textContent = `WAVE ${n} / ${total}`;
    this.el.waveSub.textContent = remaining > 0 ? `剩余 ${remaining}` : '清场！';
  }
  setWeapon(w) {
    this.el.weaponName.textContent = w.def.name;
    this.el.weaponEn.textContent = w.def.en;
    this.el.ammo.textContent = w.reloading > 0 ? '装填中…' : `${w.ammo} / ${w.mag ?? w.def.mag}`;
  }
  setHp(hp, max) {
    const k = clamp(hp / max, 0, 1);
    this.el.hpFill.style.transform = `scaleX(${k})`;
    this.el.hpNum.textContent = Math.ceil(hp);
    this.el.hpFill.classList.toggle('low', k < 0.3);
    this.el.crosshair.classList.toggle('low', k < 0.3);
    if (hp > this.lastHp + 0.5) this.healT = 0.4;
    this.lastHp = hp;
  }
  setDash(cd, max) {
    this.el.dashFill.style.transform = `scaleX(${1 - clamp(cd / max, 0, 1)})`;
    this.el.dashFill.parentElement.classList.toggle('ready', cd <= 0);
  }
  setBoss(e) {
    if (!e) { this.el.bossBar.classList.add('hidden'); return; }
    this.el.bossBar.classList.remove('hidden');
    this.el.bossName.textContent = e.type === 'eraser' ? 'THE ERASER · 橡皮擦' : 'THE INKBLOT · 墨渍';
    this.el.bossFill.style.transform = `scaleX(${clamp(e.hp / e.maxHp, 0, 1)})`;
  }
  setHint(text) {
    if (!text) { this.el.hint.classList.add('hidden'); return; }
    this.el.hint.classList.remove('hidden');
    this.el.hint.textContent = text;
  }
  hitmark(crit) {
    this.hitT = 0.14;
    this.el.hitmarker.classList.toggle('crit', !!crit);
  }
  hurtFlash() { this.hurtT = 0.55; }

  banner(title, sub, color) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    this.el.banner.classList.remove('show');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('show');
    this.el.bannerTitle.style.color = color || '';
    this.bannerT = 2.2;
  }

  addKill(name, crit) {
    const d = document.createElement('div');
    d.className = 'kill' + (crit ? ' crit' : '');
    d.innerHTML = `<i>✕</i> ${name}`;
    this.el.killfeed.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 1800);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.firstChild.remove();
  }

  // ---------- floating damage ----------
  damageText(pos, text, color = '#1b2fb8', big = false) {
    let item = this.dmgPool.pop();
    if (!item) {
      const el = document.createElement('div');
      el.className = 'dmg';
      this.el.dmgLayer.appendChild(el);
      item = { el };
    }
    item.el.className = 'dmg' + (big ? ' big' : '');
    item.el.textContent = text;
    item.el.style.color = color;
    item.el.style.opacity = '1';
    item.pos = pos.clone();
    item.life = 0.85;
    item.maxLife = 0.85;
    item.vy = 1.6 + Math.random() * 0.8;
    item.vx = (Math.random() - 0.5) * 0.9;
    item.el.style.display = 'block';
    this.dmgActive.push(item);
  }

  updateDamage(dt) {
    const w = innerWidth, h = innerHeight;
    const v = new THREE.Vector3();
    for (let i = this.dmgActive.length - 1; i >= 0; i--) {
      const it = this.dmgActive[i];
      it.life -= dt;
      if (it.life <= 0) {
        it.el.style.display = 'none';
        this.dmgPool.push(it);
        this.dmgActive.splice(i, 1);
        continue;
      }
      it.pos.y += it.vy * dt;
      it.pos.x += it.vx * dt;
      v.copy(it.pos).project(this.camera);
      if (v.z > 1) { it.el.style.opacity = '0'; continue; }
      const k = it.life / it.maxLife;
      it.el.style.opacity = String(Math.min(1, k * 2.2));
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      it.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${1.15 - 0.15 * k})`;
    }
  }

  update(dt) {
    this.hitT = Math.max(0, this.hitT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.healT = Math.max(0, this.healT - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
    const hm = this.el.hitmarker;
    if (hm) {
      const on = this.hitT > 0;
      hm.style.opacity = on ? '1' : '0';
      hm.style.transform = `translate(-50%,-50%) rotate(45deg) scale(${on ? 1.25 - this.hitT * 1.8 : 1})`;
    }
    if (this.el.hurt) this.el.hurt.style.opacity = String(Math.min(1, this.hurtT * 2.6));
    if (this.el.heal) this.el.heal.style.opacity = String(Math.min(1, this.healT * 2.2));
    if (this.bannerT <= 0) this.el.banner.classList.remove('show');
    this.updateDamage(dt);
  }

  // ---------- screens ----------
  setTitle(best) {
    this.el['title-best'].innerHTML = best
      ? `最高分 <b>${fmt(best.score)}</b> · 最远 <b>WAVE ${best.wave}</b>`
      : '还没有记录，来涂第一笔';
  }
  setPause(sens, vol) {
    this.el.sens.value = String(Math.round(sens * 1000));
    this.el.vol.value = String(Math.round(vol * 100));
  }
  setOver(score, wave, best, isBest, victory) {
    this.el['over-title'].textContent = victory ? '你把整页纸都涂满了！' : '被擦掉了…';
    this.el['over-score'].textContent = fmt(score);
    this.el['over-wave'].textContent = `WAVE ${wave}`;
    this.el['over-best'].textContent = isBest ? '新纪录！' : `最高 ${fmt(best.score)}`;
    this.el['over-best'].classList.toggle('new', isBest);
  }
  setVictory(score, wave) {
    this.el['victory-score'].textContent = fmt(score);
  }

  showUpgrades(cards, onPick, wave) {
    this.el['upgrade-title'].textContent = `WAVE ${wave} 清空！挑一张贴纸`;
    const wrap = this.el['upgrade-cards'];
    wrap.innerHTML = '';
    cards.forEach((c, i) => {
      const el = document.createElement('button');
      el.className = 'card';
      el.style.setProperty('--rot', `${(i - 1) * 2.2}deg`);
      el.innerHTML = `
        <div class="card-badge">${c.glyph}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-desc">${c.desc}</div>
        <div class="card-tag">${c.tag || '贴纸'}</div>`;
      el.addEventListener('click', () => onPick(c));
      wrap.appendChild(el);
    });
    this.showScreen('upgrade');
  }
}

export function upgradeCards() {
  const all = [
    { id: 'mag', glyph: '弹', name: '大橡皮筋', desc: '所有武器弹匣 +50%', tag: '火力' },
    { id: 'dmg', glyph: '狠', name: '削尖的笔尖', desc: '伤害 +20%', tag: '火力' },
    { id: 'rate', glyph: '快', name: '手速练习', desc: '射速 +18%', tag: '火力' },
    { id: 'reload', glyph: '顺', name: '顺滑铅芯', desc: '换弹速度 +35%', tag: '火力' },
    { id: 'crit', glyph: '准', name: '眯眼瞄准', desc: '暴击率 +15%（暴击 ×2）', tag: '火力' },
    { id: 'pellet', glyph: '散', name: '更粗的马克笔', desc: '霰弹 +3 弹丸', tag: '火力' },
    { id: 'pierce', glyph: '穿', name: '穿透力', desc: '子弹额外穿透 1 个敌人', tag: '火力' },
    { id: 'speed', glyph: '溜', name: '纸上滑行', desc: '移动速度 +15%', tag: '机动' },
    { id: 'dash', glyph: '闪', name: '涂改带', desc: '冲刺冷却 -35%', tag: '机动' },
    { id: 'hp', glyph: '厚', name: '厚脸皮', desc: '最大生命 +30 并回满', tag: '生存' },
    { id: 'regen', glyph: '愈', name: '创可贴', desc: '受伤后回血更快', tag: '生存' },
    { id: 'lifesteal', glyph: '吸', name: '吸血墨水', desc: '造成伤害的 6% 转化为生命', tag: '生存' },
    { id: 'leech', glyph: '噬', name: '墨水吞噬', desc: '击杀回复 4 点生命', tag: '生存' },
    { id: 'explode', glyph: '爆', name: '墨水炸弹', desc: '击杀时爆炸，伤害周围敌人', tag: '特效' },
    { id: 'combo', glyph: '燃', name: '越战越勇', desc: '连击加分翻倍', tag: '特效' },
    { id: 'homing', glyph: '追', name: '会拐弯的笔', desc: '子弹轻微追踪敌人', tag: '特效' },
  ];
  const pool = all.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
