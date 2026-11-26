// ---------- tiny procedural audio engine (no assets) ----------
class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.muted = false;
    this.noiseBuf = null;
    this.musicOn = true;
    this._timer = null;
    this._step = 0;
    this._nextT = 0;
    this.intensity = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.16;
    this.musicBus.connect(this.master);

    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _noise(dur, { vol = 0.2, freq = 1200, q = 0.8, type = 'lowpass', slide = null, attack = 0.004 } = {}) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _tone({ freq = 440, to = null, type = 'sine', dur = 0.2, vol = 0.15, attack = 0.004, delay = 0, bus = null, detune = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // ---- sfx ----
  shoot(kind) {
    if (!this.ctx) return;
    if (kind === 'pencil') {
      this._tone({ freq: 900, to: 190, type: 'square', dur: 0.075, vol: 0.07 });
      this._noise(0.06, { vol: 0.14, freq: 3200, type: 'highpass' });
      this._tone({ freq: 1600, to: 700, type: 'triangle', dur: 0.035, vol: 0.05 });
    } else if (kind === 'marker') {
      this._tone({ freq: 220, to: 60, type: 'square', dur: 0.22, vol: 0.13 });
      this._noise(0.24, { vol: 0.28, freq: 1400, slide: 300, q: 0.6 });
      this._noise(0.08, { vol: 0.16, freq: 4200, type: 'highpass' });
    } else if (kind === 'ruler') {
      this._tone({ freq: 2400, to: 240, type: 'sawtooth', dur: 0.28, vol: 0.09 });
      this._noise(0.16, { vol: 0.16, freq: 5000, slide: 900, type: 'bandpass', q: 3 });
      this._tone({ freq: 120, to: 40, type: 'sine', dur: 0.3, vol: 0.18 });
    } else if (kind === 'eraser') {
      this._noise(0.16, { vol: 0.22, freq: 900, slide: 2600, type: 'bandpass', q: 1.4 });
      this._tone({ freq: 300, to: 90, type: 'triangle', dur: 0.14, vol: 0.1 });
    }
  }
  empty() { if (this.ctx) { this._tone({ freq: 1200, type: 'square', dur: 0.03, vol: 0.05 }); this._tone({ freq: 800, type: 'square', dur: 0.04, vol: 0.04, delay: 0.06 }); } }
  reload() {
    if (!this.ctx) return;
    this._tone({ freq: 500, to: 300, type: 'square', dur: 0.04, vol: 0.05 });
    this._noise(0.05, { vol: 0.1, freq: 2400, type: 'bandpass', q: 2 });
    this._tone({ freq: 700, to: 900, type: 'square', dur: 0.05, vol: 0.06, delay: 0.22 });
    this._noise(0.06, { vol: 0.12, freq: 3000, type: 'bandpass', q: 2, delay: 0.22 });
    this._tone({ freq: 380, to: 260, type: 'square', dur: 0.05, vol: 0.06, delay: 0.42 });
    this._noise(0.05, { vol: 0.1, freq: 1800, type: 'bandpass', q: 2, delay: 0.42 });
  }
  hit(head) {
    if (!this.ctx) return;
    this._tone({ freq: head ? 1400 : 900, to: head ? 900 : 600, type: 'square', dur: 0.05, vol: 0.06 });
    this._noise(0.04, { vol: 0.06, freq: 3000, type: 'bandpass', q: 2 });
  }
  kill() {
    if (!this.ctx) return;
    this._noise(0.22, { vol: 0.2, freq: 2200, slide: 240, q: 0.9 });
    this._tone({ freq: 320, to: 70, type: 'triangle', dur: 0.22, vol: 0.12 });
    this._tone({ freq: 120, to: 50, type: 'sine', dur: 0.3, vol: 0.18 });
  }
  hurt() {
    if (!this.ctx) return;
    this._tone({ freq: 160, to: 55, type: 'sawtooth', dur: 0.28, vol: 0.14 });
    this._noise(0.18, { vol: 0.18, freq: 700, slide: 200 });
  }
  jump() { if (this.ctx) this._tone({ freq: 280, to: 560, type: 'triangle', dur: 0.1, vol: 0.06 }); }
  land() { if (this.ctx) this._noise(0.08, { vol: 0.1, freq: 400, slide: 150 }); }
  dash() { if (!this.ctx) return; this._noise(0.22, { vol: 0.18, freq: 600, slide: 2600, type: 'bandpass', q: 1.6 }); this._tone({ freq: 200, to: 620, type: 'sine', dur: 0.16, vol: 0.05 }); }
  step() { if (this.ctx) this._noise(0.05, { vol: 0.035, freq: 900, type: 'bandpass', q: 1.2 }); }
  wave() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [220, 330, 440].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.09, delay: i * 0.09 }));
    this._tone({ freq: 90, to: 45, type: 'sine', dur: 0.6, vol: 0.3, delay: 0.1 });
  }
  boss() {
    if (!this.ctx) return;
    this._tone({ freq: 70, to: 38, type: 'sawtooth', dur: 1.1, vol: 0.22 });
    this._tone({ freq: 140, to: 60, type: 'square', dur: 0.9, vol: 0.08, detune: 12 });
    this._noise(1.0, { vol: 0.2, freq: 400, slide: 120, q: 1.2 });
  }
  upgrade() {
    if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.08, delay: i * 0.07 }));
  }
  click() { if (this.ctx) this._tone({ freq: 800, to: 600, type: 'square', dur: 0.03, vol: 0.04 }); }
  fall() { if (!this.ctx) return; this._tone({ freq: 500, to: 60, type: 'sine', dur: 0.8, vol: 0.15 }); this._noise(0.7, { vol: 0.1, freq: 1200, slide: 200 }); }
  parry() { if (!this.ctx) return; this._tone({ freq: 1800, to: 2400, type: 'square', dur: 0.08, vol: 0.07 }); this._noise(0.1, { vol: 0.1, freq: 6000, type: 'highpass' }); }

  // ---- music ----
  startMusic() {
    if (!this.ctx || this._timer) return;
    this._step = 0;
    this._nextT = this.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), 40);
  }
  stopMusic() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
  _schedule() {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / 108 / 4; // 16th note
    while (this._nextT < this.ctx.currentTime + 0.18) {
      this._playStep(this._step, this._nextT);
      this._nextT += spb;
      this._step = (this._step + 1) % 64;
    }
  }
  _playStep(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const c = this.ctx;
    const bassNotes = [110, 110, 87.31, 130.81]; // A2 A2 F2 C3
    const root = bassNotes[bar % 4];
    const m = this.musicBus;
    const tone = (freq, type, dur, vol, detune = 0) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(m); o.start(t); o.stop(t + dur + 0.02);
    };
    const noise = (dur, vol, freq, type = 'highpass') => {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(m);
      src.start(t); src.stop(t + dur + 0.02);
    };

    if (s === 0 || s === 8) tone(root / 2, 'sine', 0.22, 0.5); // kick-ish
    if (s === 4 || s === 12) noise(0.09, 0.10, 1800, 'bandpass'); // snare
    if (s % 2 === 0) noise(0.03, 0.05, 7000); // hat
    if (this.intensity > 0.15 && s % 4 === 2) noise(0.03, 0.03, 9000);

    if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
      tone(root, 'triangle', 0.18, 0.16);
    }
    if (this.intensity > 0.35 && (s === 2 || s === 10)) tone(root * 1.5, 'triangle', 0.12, 0.07);

    const scale = [1, 1.2, 1.5, 1.8, 2, 2.4];
    if (this.intensity > 0.5 && (s === 7 || s === 15) && Math.random() < 0.6) {
      tone(root * 4 * scale[Math.floor(Math.random() * scale.length)], 'sine', 0.3, 0.035);
    }
  }
}

export const audio = new AudioSys();
