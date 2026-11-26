import * as THREE from 'three';

export const PALETTE = {
  ink: 0x1b2fb8,
  inkDark: 0x121a6e,
  red: 0xd42b3a,
  paper: 0xf4eedc,
  paperWarm: 0xf3ecd8,
  yellow: 0xf2c94c,
  pink: 0xef8fab,
  green: 0x5aa864,
  orange: 0xef8a3c,
  black: 0x24242c,
  white: 0xfffdf5,
  blue: 0x4a5aa8,
  purple: 0x7a5ac8,
};

// shared uniforms
export const U = {
  boil: { value: 0 },
  time: { value: 0 },
  lightDir: { value: new THREE.Vector3(0.45, 0.85, 0.3).normalize() },
};

export function setBoil(t) {
  U.boil.value = Math.floor(t * 9);
}

const NOISE = `
float hash31(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash31(i+vec3(0.0,0.0,0.0)), hash31(i+vec3(1.0,0.0,0.0)), f.x),
                 mix(hash31(i+vec3(0.0,1.0,0.0)), hash31(i+vec3(1.0,1.0,0.0)), f.x), f.y),
             mix(mix(hash31(i+vec3(0.0,0.0,1.0)), hash31(i+vec3(1.0,0.0,1.0)), f.x),
                 mix(hash31(i+vec3(0.0,1.0,1.0)), hash31(i+vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
}
`;

const WOBBLE_VERT = `
uniform float uBoil;
uniform float uWobble;
varying vec3 vN;
varying vec3 vWP;
varying vec2 vUv;
${NOISE}
void main(){
  vUv = uv;
  vec4 wp0 = modelMatrix * vec4(position, 1.0);
  float n = vnoise(wp0.xyz * 2.4 + uBoil * 0.41);
  vec3 p = position + normal * (n - 0.5) * uWobble;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const INK_FRAG = `
uniform vec3 uColor;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uLightDir;
uniform float uFill;
uniform float uHatch;
uniform float uShade;
uniform float uTime;
varying vec3 vN;
varying vec3 vWP;
varying vec2 vUv;
${NOISE}
void main(){
  vec3 n = normalize(vN);
  float ndl = dot(n, normalize(uLightDir)) * 0.5 + 0.5;
  float band = step(0.60, ndl) * 0.55 + step(0.33, ndl) * 0.45;
  vec3 base = mix(uPaper, uColor, uFill);
  base *= mix(1.0 - uShade, 1.0, band);

  float h = 0.0;
  if (band < 0.99) {
    vec2 sp = vWP.xz * 6.0 + vWP.y * 4.0;
    float l1 = smoothstep(0.30, 0.48, abs(fract((sp.x + sp.y) * 0.5) - 0.5));
    float l2 = smoothstep(0.30, 0.48, abs(fract((sp.x - sp.y) * 0.5) - 0.5));
    h = (l1 * 0.62 + l2 * 0.38) * (1.0 - band) * uHatch;
  }
  vec3 col = mix(base, uInk, h);

  float g = vnoise(vec3(vWP.xz * 22.0, vWP.y * 22.0));
  col *= 0.945 + g * 0.11;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function inkMaterial(opts = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uBoil: U.boil,
      uTime: U.time,
      uWobble: { value: opts.wobble ?? 0.035 },
      uColor: { value: new THREE.Color(opts.color ?? PALETTE.ink) },
      uPaper: { value: new THREE.Color(opts.paper ?? PALETTE.paper) },
      uInk: { value: new THREE.Color(opts.inkColor ?? PALETTE.ink) },
      uLightDir: U.lightDir,
      uFill: { value: opts.fill ?? 1 },
      uHatch: { value: opts.hatch ?? 0.45 },
      uShade: { value: opts.shade ?? 0.4 },
    },
    vertexShader: WOBBLE_VERT,
    fragmentShader: INK_FRAG,
    side: opts.side ?? THREE.FrontSide,
  });
  return m;
}

const OUTLINE_VERT = `
uniform float uBoil;
uniform float uWobble;
uniform float uThickness;
varying vec3 vWP;
${NOISE}
void main(){
  vec4 wp0 = modelMatrix * vec4(position, 1.0);
  float n = vnoise(wp0.xyz * 2.4 + uBoil * 0.41);
  vec3 p = position + normal * (uThickness + (n - 0.5) * uWobble);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const OUTLINE_FRAG = `
uniform vec3 uInk;
void main(){
  gl_FragColor = vec4(uInk, 1.0);
  #include <colorspace_fragment>
}
`;

export function outlineMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBoil: U.boil,
      uWobble: { value: opts.wobble ?? 0.035 },
      uThickness: { value: opts.thickness ?? 0.042 },
      uInk: { value: new THREE.Color(opts.color ?? PALETTE.inkDark) },
    },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
  });
}

/** adds an inverted-hull outline mesh as a child of `mesh` */
export function addOutline(mesh, thickness = 0.042, color) {
  const geo = mesh.geometry;
  const mat = outlineMaterial({ thickness, color });
  const o = new THREE.Mesh(geo, mat);
  o.renderOrder = (mesh.renderOrder || 0) - 1;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

// ---------------- ground ----------------
const GROUND_FRAG = `
uniform vec3 uPaper;
uniform vec3 uLine;
uniform vec3 uMargin;
uniform vec3 uInk;
uniform float uTime;
varying vec3 vWP;
${NOISE}
float lineMask(float coord, float spacing, float width){
  float d = abs(fract(coord / spacing + 0.5) - 0.5) * spacing;
  return 1.0 - smoothstep(width * 0.55, width, d);
}
void main(){
  vec2 p = vWP.xz;
  float g = vnoise(vec3(p * 16.0, 0.0)) * 0.55 + vnoise(vec3(p * 2.2, 3.0)) * 0.45;
  vec3 col = uPaper * (0.955 + g * 0.075);

  float l = lineMask(p.y, 1.15, 0.055);
  col = mix(col, uLine, l * 0.88);

  float m = 1.0 - smoothstep(0.035, 0.09, abs(p.x + 22.0));
  col = mix(col, uMargin, m * 0.8);

  float sm = vnoise(vec3(p * 0.6, 7.0));
  col *= 0.975 + sm * 0.05;

  // soft darkening toward page edge
  float edge = smoothstep(26.0, 32.0, max(abs(p.x), abs(p.y)));
  col *= 1.0 - edge * 0.12;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
const GROUND_VERT = `
varying vec3 vWP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export function groundMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPaper: { value: new THREE.Color(PALETTE.paper) },
      uLine: { value: new THREE.Color(0x8ea9d8) },
      uMargin: { value: new THREE.Color(0xe8898f) },
      uInk: { value: new THREE.Color(PALETTE.ink) },
      uTime: U.time,
    },
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
  });
}

// ---------------- sky dome ----------------
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(0xf0e6c8) },
      uBottom: { value: new THREE.Color(0xfbf7ea) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uBottom;
      varying vec3 vDir;
      void main(){
        float h = clamp(normalize(vDir).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = mix(uBottom, uTop, smoothstep(0.35, 1.0, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

// ---------------- particles ----------------
export function particleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;
      void main(){
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.32, d) * vAlpha;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

export function tracerMaterial(color = 0x1b2fb8) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
      void main(){
        float a = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        gl_FragColor = vec4(uColor, a * uAlpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** simple unlit decal material for canvas-drawn textures */
export function decalMaterial(map, opts = {}) {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    opacity: opts.opacity ?? 1,
    depthWrite: false,
    alphaTest: opts.alphaTest ?? 0.02,
    side: opts.side ?? THREE.DoubleSide,
    color: opts.color ?? 0xffffff,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}
