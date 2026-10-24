// GLSL for the galaxy. Colours are linear HDR; tone mapping happens in the post stack.
// Star glare and the fresnel shells carry over from the original hero.

export const NOISE3 = /* glsl */ `
float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3. - 2. * f);
  float a = mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y);
  float b = mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y);
  return mix(a, b, u.z);
}
float fbm3(vec3 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * vnoise3(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= .5; } return v; }
float ridge3(vec3 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { float n = 1. - abs(vnoise3(p) * 2. - 1.); v += a * n * n; p = p * 2.1 + vec3(3.1, 1.7, 7.3); a *= .5; } return v; }
`

// ---------- sky: baked once into a cube map ----------

export const skyVert = /* glsl */ `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`

export const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform vec3 uBand;
${NOISE3}
float sq(float x) { return x * x; }
void main() {
  vec3 d = normalize(vDir);
  vec3 q = d * 2.4;
  vec3 w = vec3(fbm3(q * 1.3), fbm3(q * 1.3 + 5.2), fbm3(q * 1.3 + 9.7));
  float n = fbm3(q * 1.6 + w * 1.4);
  float fine = fbm3(d * 11. + w);
  float side = dot(d, uBand);

  vec3 col = vec3(.0025, .003, .0075);
  // violet bloom (the reference's core glow, pushed far away)
  float v1 = smoothstep(-.3, 1., dot(d, normalize(vec3(-.25, -.35, -.9))));
  col += vec3(.15, .06, .5) * pow(n, 2.) * v1 * .7;
  // teal wash
  float v2 = smoothstep(.1, 1., dot(d, normalize(vec3(.75, -.25, -.6))));
  col += vec3(.0, .14, .2) * pow(fbm3(q * 1.2 + 7.), 2.2) * v2 * .8;
  // deep blue mass
  float v3 = smoothstep(0., 1., dot(d, normalize(vec3(.4, .6, .7))));
  col += vec3(.01, .03, .16) * (.4 + n) * v3 * .6;
  // the galactic band: our own disc seen from inside
  float band = exp(-sq(side / .2));
  col += vec3(.06, .11, .5) * band * (.25 + 1.1 * fine) * .55;
  col += vec3(.5, .62, 1.) * exp(-sq(side / .04)) * .07 * (.4 + fine);
  // dust lanes
  col *= .55 + .6 * smoothstep(.22, .78, n);
  // pinprick stars baked in for depth (the live star field sits in front)
  vec3 sp = d * 420.;
  vec3 cell = floor(sp);
  float h = hash13(cell);
  if (h > .985) {
    vec3 c = cell + .5 + (vec3(hash13(cell + 1.), hash13(cell + 2.), hash13(cell + 3.)) - .5) * .6;
    float s = exp(-dot(sp - c, sp - c) * 9.);
    col += vec3(.75, .82, 1.) * s * (h - .985) * 60.;
  }
  gl_FragColor = vec4(col, 1.);
}
`

// ---------- far stars (always at the sky) ----------

export const starsVert = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixel;
uniform float uIntensity;
varying vec3 vColor;
varying float vGlare;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float tw = .62 + .38 * sin(uTime * (1.2 + aSeed * 2.4) + aSeed * 61.7);
  vColor = aColor * tw * uIntensity;
  vGlare = step(4.5, aSize);
  gl_PointSize = aSize * uPixel * (vGlare > .5 ? 3.2 : 1.);
}
`

export const starsFrag = /* glsl */ `
varying vec3 vColor;
varying float vGlare;
void main() {
  vec2 c = gl_PointCoord - .5;
  float d = length(c);
  float core = vGlare > .5 ? exp(-d * d * 260.) : smoothstep(.5, .0, d);
  float glare = 0.;
  if (vGlare > .5) {
    vec2 a = abs(c);
    glare = max(exp(-a.x * 60.) * exp(-a.y * 7.), exp(-a.y * 60.) * exp(-a.x * 7.)) * .7;
  }
  float v = core * core + glare;
  if (v < .003) discard;
  gl_FragColor = vec4(vColor * v, 1.);
}
`

// ---------- the galaxy disc: stars and dust with real parallax ----------

export const discVert = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixel;
uniform float uIntensity;
uniform float uDust;
varying vec3 vColor;
varying float vSoft;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float z = -mv.z;
  float tw = uDust > .5 ? 1. : .7 + .3 * sin(uTime * (.8 + aSeed * 2.) + aSeed * 40.);
  // fade anything that drifts right up to the lens
  float nearFade = uDust > .5 ? smoothstep(50., 220., z) : smoothstep(2., 14., z);
  vColor = aColor * tw * uIntensity * nearFade;
  float px = aSize * uPixel * (uDust > .5 ? 900. : 420.) / max(z, 1.);
  gl_PointSize = clamp(px, uDust > .5 ? 2. : .6, uDust > .5 ? 220. : 7.5);
  // sub-pixel stars keep their energy instead of popping
  vColor *= uDust > .5 ? 1. : clamp(px / .9, .25, 1.);
  vSoft = uDust;
}
`

export const discFrag = /* glsl */ `
varying vec3 vColor;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord - .5;
  float d2 = dot(c, c) * 4.;
  float v = vSoft > .5 ? exp(-d2 * 3.2) * (1. - d2) : exp(-d2 * 7.);
  if (v < .004) discard;
  gl_FragColor = vec4(vColor * v, 1.);
}
`

// ---------- planets: surfaces baked to equirect maps at load ----------

export const bakeVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`

// Direction from uv matches SphereGeometry's own mapping, so the bake has no seam.
export const bakeFrag = /* glsl */ `
varying vec2 vUv;
uniform int uStyle;
uniform int uMode; // 0 = albedo, 1 = emissive
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uSeed;
uniform vec3 uHeart;
${NOISE3}
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.) return sqrt(dot(p - vec2(.25, .75), p - vec2(.25, .75))) - sqrt(2.) / 4.;
  return sqrt(min(dot(p - vec2(0., 1.), p - vec2(0., 1.)), dot(p - .5 * max(p.x + p.y, 0.), p - .5 * max(p.x + p.y, 0.)))) * sign(p.x - p.y);
}
void main() {
  float phi = vUv.x * 6.28318531;
  float theta = (1. - vUv.y) * 3.14159265;
  vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  vec3 p = d * 2. + uSeed;
  vec3 col = vec3(0.);
  vec3 emi = vec3(0.);

  if (uStyle == 0) {
    // crystal: faceted ridges with glowing seams
    float r = ridge3(p * 1.4);
    float f = fbm3(p * 3.);
    col = mix(uC0, uC1, smoothstep(.15, .7, r));
    col = mix(col, uC2, smoothstep(.62, .9, r) * .8);
    col *= .75 + .45 * f;
    float seam = smoothstep(.86, .97, ridge3(p * 3.1 + 4.));
    emi = uC3 * seam * 1.6 + uC1 * smoothstep(.7, .95, r) * .25;
  } else if (uStyle == 1) {
    // ocean world with pale continents and swirling cloud
    vec3 w = vec3(fbm3(p), fbm3(p + 3.1), fbm3(p + 6.7));
    float land = fbm3(p * 1.3 + w * 1.2);
    float shore = smoothstep(.5, .53, land);
    vec3 sea = mix(uC0, uC1, smoothstep(.2, .5, land));
    vec3 ground = mix(uC2 * .55, uC3 * .7, smoothstep(.55, .8, land));
    col = mix(sea, ground, shore);
    float cloud = smoothstep(.5, .78, fbm3(vec3(p.x * 1.6, p.y * 4., p.z * 1.6) + w * 2.));
    col = mix(col, vec3(.92, .96, 1.), cloud * .8);
    emi = uC2 * smoothstep(.49, .505, land) * (1. - smoothstep(.505, .53, land)) * .9 * (1. - cloud);
  } else if (uStyle == 2) {
    // gas giant: turbulent bands and one great storm
    float t = fbm3(p * vec3(1.2, 4., 1.2));
    float lat = d.y;
    float b = sin(lat * 18. + t * 5.) * .5 + .5;
    float b2 = sin(lat * 47. + t * 9.) * .5 + .5;
    col = mix(uC1, uC2, b);
    col = mix(col, uC3, b2 * .35);
    col = mix(col, uC0, smoothstep(.55, .9, fbm3(p * 2.5)) * .35);
    vec2 sp = vec2(atan(d.z, -d.x) - 1.1, (lat + .28) * 3.2);
    float storm = exp(-dot(sp * vec2(2.2, 3.), sp * vec2(2.2, 3.)));
    col = mix(col, uC3 * 1.05, storm * .85);
    col = mix(col, uC1 * .6, smoothstep(.45, .5, storm) * (1. - smoothstep(.5, .6, storm)) * .6);
    col *= .85 + .3 * fbm3(p * 6.);
    emi = vec3(0.);
  } else if (uStyle == 3) {
    // living world: emerald land, teal seas, ice caps
    vec3 w = vec3(fbm3(p), fbm3(p + 2.3), fbm3(p + 5.1));
    float land = fbm3(p * 1.5 + w);
    float sea = 1. - smoothstep(.46, .5, land);
    vec3 ground = mix(uC1, uC2, smoothstep(.5, .75, land + fbm3(p * 5.) * .2));
    col = mix(ground, mix(uC0, uC1 * .5, smoothstep(.2, .46, land)), sea);
    float ice = smoothstep(.78, .9, abs(d.y) + fbm3(p * 4.) * .15);
    col = mix(col, uC3, ice);
    float cloud = smoothstep(.56, .8, fbm3(p * 2.2 + w * 1.5));
    col = mix(col, vec3(.9, 1., .96), cloud * .55);
    emi = uC2 * smoothstep(.62, .7, land) * (1. - sea) * (1. - cloud) * .18;
  } else if (uStyle == 5) {
    // moon: grey regolith, craters, a faint tint
    float f = fbm3(p * 2.5);
    float cr = 0.;
    for (int k = 0; k < 3; k++) {
      vec3 q = p * (3. + float(k) * 2.7) + float(k) * 11.;
      vec3 cell = floor(q);
      vec3 fr = fract(q) - .5;
      vec3 o = vec3(hash13(cell), hash13(cell + 7.), hash13(cell + 13.)) - .5;
      float dd = length(fr - o * .5);
      float rr = .18 + .2 * hash13(cell + 3.);
      cr += (smoothstep(rr, rr * .6, dd) * -.35 + exp(-pow((dd - rr) / .04, 2.)) * .25) * step(.55, hash13(cell + 5.));
    }
    col = mix(uC0, uC1, f) + cr * uC2;
    col = mix(col, uC3, smoothstep(.62, .8, fbm3(p * 1.2)) * .25);
    emi = vec3(0.);
  } else {
    // rose dunes with a heart-shaped crater
    vec3 w = vec3(fbm3(p * .8), fbm3(p * .8 + 4.), 0.);
    float dune = sin(dot(p, vec3(3., 1.2, 2.)) * 5. + w.x * 12.) * .5 + .5;
    float dune2 = sin(dot(p, vec3(-1.5, 2.6, .8)) * 9. + w.y * 10.) * .5 + .5;
    float f = fbm3(p * 2.4);
    float fine = fbm3(p * 9.);
    col = mix(uC0 * 1.8, uC1, smoothstep(.15, .7, dune * .55 + f * .55));
    col = mix(col, uC2, smoothstep(.6, .98, dune2 * .25 + f * .8) * .55);
    col = mix(col, uC3 * .85, smoothstep(.72, .95, f) * .45);
    col *= .8 + .35 * fine;
    // heart crater, centred where the Relay's first shot looks
    vec3 cdir = normalize(uHeart);
    vec3 tx = normalize(cross(vec3(0., 1., 0.), cdir));
    vec3 ty = cross(cdir, tx);
    vec2 hp = vec2(dot(d, tx), dot(d, ty)) * 4.2 + vec2(0., .55);
    float h = dot(d, cdir) > 0. ? sdHeart(hp) : 1.;
    float rim = smoothstep(.09, .0, abs(h));
    col = mix(col, uC0 * 1.4, smoothstep(.02, -.05, h) * .8);
    col += uC3 * rim * .35;
    emi = uC2 * smoothstep(.04, -.1, h) * .5 + uC2 * smoothstep(.93, .99, ridge3(p * 2.6)) * .5;
  }
  gl_FragColor = vec4(uMode == 0 ? col : emi, 1.);
}
`

export const planetVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const planetFrag = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uEmit;
uniform vec3 uSun;
uniform vec3 uAtmo;
uniform float uSpec;
uniform float uEmitK;
uniform float uFade;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 L = normalize(uSun - vW);
  vec3 V = normalize(cameraPosition - vW);
  float ndl = dot(n, L);
  float day = smoothstep(-.18, .55, ndl);
  vec3 alb = texture2D(uMap, vUv).rgb;
  vec3 col = alb * (.035 + 1.35 * max(ndl, 0.) + .1 * day);
  // warm scattering at the terminator
  col += alb * uAtmo * .35 * exp(-pow((ndl - .02) / .14, 2.));
  // emissive survives on the night side
  vec3 emi = texture2D(uEmit, vUv).rgb * uEmitK;
  col += emi * (1.2 - .7 * day);
  // ocean glint
  vec3 H = normalize(L + V);
  col += vec3(1.) * pow(max(dot(n, H), 0.), 60.) * uSpec * day;
  // atmosphere rim, lit side brighter
  float fres = pow(1. - max(dot(n, V), 0.), 3.);
  col += uAtmo * fres * (.12 + 1.3 * smoothstep(-.3, .7, ndl));
  gl_FragColor = vec4(col * uFade, 1.);
}
`

export const atmoVert = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

// Back faces of a slightly larger shell: brightest at the limb, fading outward.
export const atmoFrag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSun;
uniform float uStrength;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float rim = clamp(-dot(n, V), 0., 1.);
  float f = pow(1. - rim, 1.6) * smoothstep(0., .45, rim);
  float lit = smoothstep(-.35, .6, dot(n, normalize(uSun - vW)));
  gl_FragColor = vec4(uColor * f * (.25 + 1.4 * lit) * uStrength, 1.);
}
`

export const ringVert = /* glsl */ `
varying vec2 vP;
varying vec3 vW;
void main() { vP = position.xy; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`

export const ringFrag = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uSun;
uniform vec3 uCenter;
uniform float uPlanetR;
uniform float uFade;
varying vec2 vP;
varying vec3 vW;
float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  float r = (length(vP) - uInner) / (uOuter - uInner);
  if (r < 0. || r > 1.) discard;
  float bands = .5 + .3 * sin(r * 61.) + .2 * sin(r * 173. + 1.3);
  float grain = h(floor(r * 300.));
  float a = (.35 + .45 * bands + .2 * grain) * smoothstep(0., .05, r) * smoothstep(1., .85, r);
  // the gap where something small might hide
  a *= 1. - .92 * exp(-pow((r - .58) / .025, 2.));
  a *= 1. - .6 * exp(-pow((r - .22) / .04, 2.));
  vec3 col = mix(uColor, uColor2, smoothstep(.2, .9, r + grain * .2));
  // planet shadow on the ring
  vec3 L = normalize(uSun - vW);
  vec3 toC = uCenter - vW;
  float t = dot(toC, L);
  float dist = length(toC - L * t);
  float shadow = t > 0. ? smoothstep(uPlanetR * .92, uPlanetR * 1.05, dist) : 1.;
  col *= .25 + .9 * shadow;
  gl_FragColor = vec4(col * uFade, a * uFade);
}
`

// ---------- warp streaks: line segments wrapped around the camera ----------

export const warpVert = /* glsl */ `
attribute float aEnd;
uniform vec3 uCam;
uniform vec3 uVel;
uniform float uBox;
uniform float uStretch;
varying float vA;
void main() {
  vec3 p = mod(position - uCam, uBox) - uBox * .5 + uCam;
  float d = length(p - uCam);
  p -= uVel * uStretch * aEnd;
  vA = (1. - aEnd * .92) * smoothstep(uBox * .5, uBox * .15, d) * smoothstep(1.5, 7., d);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}
`

export const warpFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vA;
void main() { gl_FragColor = vec4(uColor * vA * uAlpha, 1.); }
`

// ---------- lost signal: a sonar-pinging orb ----------

export const signalVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`

export const signalFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 c = vUv - .5;
  float r = length(c) * 2.;
  float core = exp(-r * r * 60.) * 2.5 + exp(-r * r * 9.) * .5;
  float ph = fract(uTime * .45);
  float ring = exp(-pow((r - ph) / .03, 2.)) * (1. - ph);
  float ring2 = exp(-pow((r - fract(ph + .5)) / .03, 2.)) * (1. - fract(ph + .5));
  float a = atan(c.y, c.x);
  float wave = exp(-pow((r - .32 - .04 * sin(a * 9. + uTime * 4.)) / .012, 2.)) * .7;
  float v = (core + (ring + ring2) * .9 + wave) * smoothstep(1., .85, r);
  gl_FragColor = vec4(uColor * v * uAlpha, 1.);
}
`

// ---------- journey trail: flowing light along a tube ----------

export const trailVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const trailFrag = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uReveal;
uniform vec3 uColor;
uniform float uLen;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  float s = vUv.x;
  if (s > uReveal) discard;
  vec3 V = normalize(cameraPosition - vW);
  float edge = pow(1. - abs(dot(normalize(vN), V)), 1.5);
  float dash = smoothstep(.45, .5, fract(s * uLen * .35 - uTime * .6)) * smoothstep(1., .9, fract(s * uLen * .35 - uTime * .6));
  float walked = 1. - smoothstep(uProgress - .004, uProgress + .004, s);
  float k = mix(.22, 1., walked) * (.35 + .65 * edge) + dash * mix(.25, .9, walked);
  float tip = exp(-pow((s - uProgress) / .006, 2.)) * 3.;
  gl_FragColor = vec4(uColor * (k + tip), 1.);
}
`

// ---------- relay beam ----------

export const beamVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`

export const beamFrag = /* glsl */ `
uniform float uTime;
uniform float uPower;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float across = 1. - abs(vUv.x * 2. - 1.);
  float core = pow(across, 6.);
  float flow = .6 + .4 * sin(vUv.y * 60. - uTime * 30.);
  float fade = smoothstep(0., .05, vUv.y) * smoothstep(1., .55, vUv.y);
  gl_FragColor = vec4(uColor * (core * 3. + across * .4) * flow * fade * uPower, 1.);
}
`

// ---------- fresnel shell (robot rim light) ----------

export const fresnelVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

export const fresnelFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
uniform float uStrength;
uniform float uBias;
uniform float uSign;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(clamp(uBias + uSign * dot(normalize(vN), normalize(vV)), 0., 1.), uPower);
  gl_FragColor = vec4(uColor * f * uStrength, 1.);
}
`

// ---------- portrait (the Core) ----------

export const portraitVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`

export const portraitFrag = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uCrop;
uniform vec2 uTexel;
uniform float uSharpen;
uniform float uReveal;
uniform float uGlitch;
uniform float uTime;
uniform float uGrade;
varying vec2 vUv;
float h(float x) { return fract(sin(x * 91.7) * 4375.5); }
void main() {
  vec2 suv = vUv;
  // hologram glitch: torn scanlines when poked
  float line = floor(vUv.y * 40.);
  suv.x += (h(line + floor(uTime * 24.)) - .5) * .08 * uGlitch * step(.6, h(line * 3.1 + floor(uTime * 12.)));
  vec2 uv = uCrop.xy + suv * uCrop.zw;
  vec3 c = texture2D(uMap, uv).rgb;
  vec3 blur = (texture2D(uMap, uv + vec2(uTexel.x, 0.)).rgb + texture2D(uMap, uv - vec2(uTexel.x, 0.)).rgb
    + texture2D(uMap, uv + vec2(0., uTexel.y)).rgb + texture2D(uMap, uv - vec2(0., uTexel.y)).rgb) * .25;
  c = max(c + (c - blur) * uSharpen, 0.);
  // backdrop grade: neutral mid-tones (a studio wall) drift toward indigo; skin, hair and black clothes stay put
  float lum = dot(c, vec3(.2126, .7152, .0722));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float wall = smoothstep(.06, .015, sat) * smoothstep(.025, .07, lum);
  vec3 indigo = mix(vec3(.025, .03, .11), vec3(.16, .15, .42), smoothstep(.02, .25, lum)) * (.8 + 2.4 * lum);
  c = mix(c, indigo, wall * uGrade);
  c.r = mix(c.r, texture2D(uMap, uv + vec2(.006 * uGlitch, 0.)).r, uGlitch);
  float r = length(vUv - .5) * 2.;
  c *= mix(1., .45, smoothstep(.72, 1., r));
  c += vec3(.2, .3, .9) * uGlitch * .25 * step(.5, fract(vUv.y * 80.));
  gl_FragColor = vec4(c, uReveal);
  #include <colorspace_fragment>
}
`

export const neonVert = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`

export const neonFrag = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform float uProgress;
uniform float uTime;
uniform float uIntensity;
uniform float uParty;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec2 vP;
float sq(float x) { return x * x; }
vec3 hue(float h) { return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
void main() {
  float r = length(vP);
  float a = atan(vP.x, vP.y);
  float t = fract(a / 6.28318531 + 1.);
  if (t > uProgress) discard;
  float hh = fract(t - uTime * .03);
  vec3 col = hh < .5 ? mix(uA, uB, smoothstep(0., .5, hh)) : mix(uB, uC, smoothstep(.5, 1., hh));
  col = mix(col, uA, smoothstep(.85, 1., hh));
  col = mix(col, hue(fract(t + uTime * .4)) * 1.6, uParty);
  float mid = (uInner + uOuter) * .5;
  float w = (uOuter - uInner) * .5;
  float core = exp(-sq((r - mid) / (w * .32)));
  float halo = exp(-sq((r - mid) / w)) * .35;
  float tip = smoothstep(.06, 0., uProgress - t) * step(uProgress, .999) * 3.;
  gl_FragColor = vec4(col * (core * uIntensity + halo) * (1. + tip), 1.);
}
`
