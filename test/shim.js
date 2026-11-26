// minimal DOM/WebAudio shim so that weapons.js module graph loads under node
const mkCanvas = () => {
  const ctx = new Proxy({}, { get: (t, k) => {
    if (k === 'canvas') return mkCanvas();
    if (k === 'getParameter') return () => 16384;
    if (k === 'getExtension') return () => null;
    if (k === 'getSupportedExtensions') return () => [];
    return (typeof k === 'string') ? (() => {}) : undefined;
  }, set: () => true });
  return { width: 1, height: 2, style: {}, getContext: () => ctx, addEventListener() {}, removeEventListener() {} };
};
const mkEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, removeChild() {}, addEventListener() {}, getContext: () => ({}), width: 1, height: 1 });
globalThis.document = { createElement: (tag) => tag === 'canvas' ? mkCanvas() : mkEl(), createElementNS: () => mkEl(), getElementById: () => null, querySelector: () => null, body: mkEl(), addEventListener() {}, documentElement: mkEl() };
globalThis.window = globalThis;
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.navigator = { userAgent: 'node' };
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 16);
globalThis.AudioContext = undefined; globalThis.webkitAudioContext = undefined;
globalThis.Image = class { set src(v) {} };
globalThis.devicePixelRatio = 1;
