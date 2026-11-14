/**
 * Earth Jukebox — Hero Three.js animation
 * Exploded-view Earth with 8 concentric layers
 * Three.js r160 + GSAP 3 from CDN (loaded dynamically)
 */

const CONFIG = {
  // Timing (seconds)
  t: {
    hero: 3,
    tiltedExplode: 3.5,
    upright: 3,
    hold: 1,
    panDown: 3,
    reassemble: 3.5,
    turnAmericas: 1.5,
    phenomena: 7,
    holdEnd: 2,
  },
  // Easing
  ease: 'power3.inOut',
  // Rotation speed during hero (rad/s)
  spinSpeed: 0.16,
  // Autoplay trigger (seconds of no input)
  autoplayDelay: 4,
  // Camera
  camera: { z: 9, fov: 35 },
  // Layer separation during explode
  explodeSpacing: 1.05,
};

// 8 layers: outer → inner
const LAYERS = [
  { name: 'atmosphere', r: 1.085, color: 0x4fc3f7, opacity: 0.18, type: 'atmosphere', emissive: 0x1565c0 },
  { name: 'clouds',     r: 1.020, color: 0xffffff, opacity: 0.35, type: 'clouds' },
  { name: 'icecaps',    r: 1.007, color: 0xe3f2fd, opacity: 0.6,  type: 'icecaps' },
  { name: 'land',       r: 1.004, color: 0x4caf50, opacity: 1.0,  type: 'land' },
  { name: 'ocean',      r: 1.000, color: 0x006994, opacity: 1.0,  type: 'ocean' },
  { name: 'crust',      r: 0.930, color: 0x8d6e63, opacity: 1.0,  type: 'crust' },
  { name: 'mantle',     r: 0.780, color: 0xff5722, opacity: 1.0,  type: 'mantle', emissive: 0x8b1a1a },
  { name: 'core',       r: 0.420, color: 0xffee58, opacity: 1.0,  type: 'core',   emissive: 0xffcc00 },
];

// Final radii during explode (each dome visible)
const EXPLODE_RADII = [1.0, 0.97, 0.94, 0.92, 0.90, 0.86, 0.76, 0.52];

let THREE, gsap, ScrollTrigger;
let scene, camera, renderer, clock;
let earthGroup, layerMeshes = [];
let animStep = 0;
let lastInputTime = 0;
let autoplayTimer = null;
let isAnimating = false;
let currentTimeline = null;
let phenomena = [];

export async function initHeroAnimation(canvas) {
  // Load Three.js and GSAP from CDN
  try {
    const threeModule = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    THREE = threeModule;

    // Load GSAP
    await loadScript('https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js');
    gsap = window.gsap;
  } catch (e) {
    console.warn('Could not load Three.js for hero animation:', e);
    return;
  }

  if (!THREE || !gsap) return;

  setupRenderer(canvas);
  setupScene();
  buildEarth();
  setupCamera();

  // Start render loop
  clock = new THREE.Clock();
  animate();

  // Input listeners — reset autoplay timer
  window.addEventListener('wheel', onInput, { passive: true });
  window.addEventListener('click', onInput);
  window.addEventListener('touchstart', onInput, { passive: true });

  // Kick off hero state
  setStep(0, true);
  scheduleAutoplay();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function setupRenderer(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setupScene() {
  scene = new THREE.Scene();

  // Ambient light
  const ambient = new THREE.AmbientLight(0x334455, 0.5);
  scene.add(ambient);

  // Key light (upper-left-front)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(-5, 8, 10);
  scene.add(keyLight);

  // Fill light
  const fillLight = new THREE.DirectionalLight(0x2244aa, 0.3);
  fillLight.position.set(5, -3, -5);
  scene.add(fillLight);

  // Stars
  const starGeo = new THREE.BufferGeometry();
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, sizeAttenuation: true });
  scene.add(new THREE.Points(starGeo, starMat));
}

function setupCamera() {
  camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 0, CONFIG.camera.z);
  camera.lookAt(0, 0, 0);
}

function buildEarth() {
  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const isMobile = window.innerWidth < 768;
  const seg = isMobile ? [64, 48] : [128, 96];

  layerMeshes = LAYERS.map((layer, i) => {
    const geo = new THREE.SphereGeometry(layer.r, seg[0], seg[1]);
    const mat = buildMaterial(layer, i);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { layer, index: i, baseY: 0, explodeY: 0, clipY: -layer.r * 2 };
    mesh.renderOrder = i;
    earthGroup.add(mesh);
    return mesh;
  });

  // Initial tilt
  earthGroup.rotation.z = -0.52;
}

function buildMaterial(layer, index) {
  switch (layer.type) {
    case 'atmosphere':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        emissive: layer.emissive,
        transparent: true,
        opacity: layer.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

    case 'clouds':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaMap: generateCloudTexture(),
      });

    case 'icecaps':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        side: THREE.DoubleSide,
        alphaMap: generateIcecapTexture(),
      });

    case 'land':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        shininess: 10,
        side: THREE.DoubleSide,
        alphaMap: generateLandTexture(),
        transparent: true,
      });

    case 'ocean':
      return buildOceanMaterial();

    case 'crust':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        shininess: 5,
        side: THREE.DoubleSide,
        map: generateCrustTexture(),
        emissive: 0x200800,
        emissiveIntensity: 0.3,
      });

    case 'mantle':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        emissive: layer.emissive,
        emissiveIntensity: 0.6,
        shininess: 30,
        side: THREE.DoubleSide,
        map: generateMantleTexture(),
      });

    case 'core':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        emissive: layer.emissive,
        emissiveIntensity: 1.0,
        shininess: 100,
        side: THREE.DoubleSide,
      });
  }
}

// --- Procedural texture generators ---

function generateCloudTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size);
    const v = noiseVal(x / size * 8, y / size * 4, 0.5);
    const a = v > 0.45 ? Math.pow((v - 0.45) / 0.55, 1.2) * 220 : 0;
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function generateIcecapTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const y = Math.floor(i / size);
    const lat = (1 - y / size) * 180 - 90; // -90 to 90
    const polarStrength = Math.max(0, (Math.abs(lat) - 60) / 30);
    const noise = noiseVal(i % size / size * 5, y / size * 5, 0.3);
    const a = polarStrength * (0.7 + noise * 0.3) > 0.4 ? 255 : 0;
    img.data[i * 4] = 220;
    img.data[i * 4 + 1] = 235;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateLandTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  // Simple continent mask
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size);
    const lon = (x / size) * 360 - 180;
    const lat = 90 - (y / size) * 180;
    const isLand = isLandPoint(lon, lat) ? 255 : 0;
    img.data[i * 4] = 85;
    img.data[i * 4 + 1] = 160;
    img.data[i * 4 + 2] = 60;
    img.data[i * 4 + 3] = isLand;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateCrustTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size);
    const v = noiseVal(x / size * 10, y / size * 10, 0.7);
    const crack = noiseVal(x / size * 20, y / size * 20, 0.9) > 0.85;
    const r = crack ? 220 : Math.floor(100 + v * 50);
    const g = crack ? 80 : Math.floor(60 + v * 30);
    const b = crack ? 20 : Math.floor(40 + v * 20);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateMantleTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size);
    const v = noiseVal(x / size * 6, y / size * 6, 0.6);
    const r = Math.floor(200 + v * 55);
    const g = Math.floor(60 + v * 60);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = 10;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function buildOceanMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vNormal;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }

      void main() {
        float lat = (vUv.y - 0.5) * 180.0;
        float t = abs(lat) / 90.0;
        float n = noise(vUv * 8.0 + time * 0.05) * 0.3;
        vec3 deep = vec3(0.0, 0.08, 0.25);
        vec3 mid  = vec3(0.0, 0.4, 0.6);
        vec3 warm = vec3(0.8, 0.5, 0.0);
        vec3 hot  = vec3(0.9, 0.1, 0.0);
        vec3 col = t < 0.5
          ? mix(hot, warm, t * 2.0 + n)
          : mix(mid, deep, (t - 0.5) * 2.0 + n);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// Simple noise for procedural textures
function noiseVal(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5) * 43758.5453;
  return Math.abs(s - Math.floor(s));
}

// Simplified continent mask (lon, lat)
function isLandPoint(lon, lat) {
  // North America
  if (lon > -170 && lon < -50 && lat > 15 && lat < 85) {
    if (lon > -80 && lat < 25) return false; // Caribbean sea
    return true;
  }
  // South America
  if (lon > -85 && lon < -34 && lat > -56 && lat < 15) return true;
  // Europe
  if (lon > -25 && lon < 60 && lat > 35 && lat < 72) return true;
  // Africa
  if (lon > -20 && lon < 55 && lat > -35 && lat < 37) return true;
  // Asia
  if (lon > 25 && lon < 180 && lat > 0 && lat < 78) return true;
  // Australia
  if (lon > 112 && lon < 155 && lat > -44 && lat < -10) return true;
  // Antarctica
  if (lat < -70) return true;
  return false;
}

// --- Animation steps ---

function setStep(step, instant = false) {
  if (isAnimating && !instant) return;
  if (currentTimeline) { currentTimeline.kill(); currentTimeline = null; }

  animStep = step;
  isAnimating = true;

  switch (step) {
    case 0: heroState(instant); break;
    case 1: tiltedExplode(); break;
    case 2: uprightExplode(); break;
    case 3: holdState(); break;
    case 4: panDown(); break;
    case 5: reassemble(); break;
    case 6: turnAmericas(); break;
  }
}

function heroState(instant) {
  const dur = instant ? 0 : 1.5;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;

  tl.to(earthGroup.rotation, { z: -0.52, duration: dur, ease: CONFIG.ease })
    .to(earthGroup.scale, { x: 1, y: 1, z: 1, duration: dur, ease: CONFIG.ease }, '<')
    .to(camera.position, { x: 1.5, y: 0, z: CONFIG.camera.z, duration: dur, ease: CONFIG.ease }, '<');

  // Reset all layers
  layerMeshes.forEach((mesh, i) => {
    tl.to(mesh.position, { y: 0, duration: dur, ease: CONFIG.ease }, '<');
    mesh.material.clippingPlanes = [];
    if (mesh.userData.layer.type !== 'core') {
      tl.to(mesh.material, { opacity: mesh.userData.layer.opacity, duration: dur }, '<');
    }
  });
}

function tiltedExplode() {
  const dur = CONFIG.t.tiltedExplode;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;

  // Spread layers along tilted axis
  layerMeshes.forEach((mesh, i) => {
    const offset = (i - 3.5) * 0.6;
    tl.to(mesh.position, { y: offset, duration: dur, ease: CONFIG.ease }, 0);
    if (i % 2 === 0) {
      tl.to(mesh.rotation, { y: 0.25, duration: dur, ease: CONFIG.ease }, 0);
    } else {
      tl.to(mesh.rotation, { y: -0.25, duration: dur, ease: CONFIG.ease }, 0);
    }
  });
}

function uprightExplode() {
  const dur = CONFIG.t.upright;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;

  // Turn upright
  tl.to(earthGroup.rotation, { z: 0, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.position, { x: 0, y: 0, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(camera.position, { y: 2.5, z: 8.6, duration: dur, ease: CONFIG.ease }, 0);

  // Space layers vertically with equal gaps
  layerMeshes.forEach((mesh, i) => {
    const targetY = (3.5 - i) * 1.2;
    tl.to(mesh.position, { y: targetY, duration: dur, ease: CONFIG.ease }, 0);
    tl.to(mesh.scale, { x: EXPLODE_RADII[i], y: EXPLODE_RADII[i], z: EXPLODE_RADII[i], duration: dur, ease: CONFIG.ease }, 0);
  });
}

function holdState() {
  isAnimating = false;
  // Layers keep spinning via animate loop
}

function panDown() {
  const dur = CONFIG.t.panDown;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;

  tl.to(camera.position, { y: -2.0, duration: dur, ease: CONFIG.ease }, 0);
}

function reassemble() {
  const dur = CONFIG.t.reassemble;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;

  // Reset camera
  tl.to(camera.position, { x: 0, y: 0, z: CONFIG.camera.z, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.rotation, { x: 0.32, z: 0, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.scale, { x: 1.6, y: 1.6, z: 1.6, duration: dur * 0.5, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.scale, { x: 1, y: 1, z: 1, duration: dur * 0.5, ease: CONFIG.ease }, dur * 0.5);

  // Pull layers back together
  layerMeshes.forEach((mesh, i) => {
    tl.to(mesh.position, { y: 0, duration: dur, ease: CONFIG.ease }, 0);
    tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: dur, ease: CONFIG.ease }, 0);
    tl.to(mesh.rotation, { y: 0, duration: dur, ease: CONFIG.ease }, 0);
  });
}

function turnAmericas() {
  const dur = CONFIG.t.turnAmericas;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; spawnPhenomena(); } });
  currentTimeline = tl;

  // Turn to show Americas (rotate around Y)
  tl.to(earthGroup.rotation, { y: 1.2, x: 0, z: 0, duration: dur, ease: CONFIG.ease }, 0);
}

function spawnPhenomena() {
  // Phenomena appear staggered; then loop back to step 0
  const holdTime = CONFIG.t.phenomena * 1000;
  setTimeout(() => {
    // Slow pull-back and loop
    const tl = gsap.timeline({ onComplete: () => setStep(0) });
    tl.to(camera.position, { z: CONFIG.camera.z + 2, duration: 2, ease: 'power2.inOut' })
      .to(camera.position, { z: CONFIG.camera.z, duration: 0.5 });
  }, holdTime);
}

function onInput() {
  lastInputTime = Date.now();
  clearTimeout(autoplayTimer);
  scheduleAutoplay();
}

function scheduleAutoplay() {
  autoplayTimer = setTimeout(() => {
    if (!isAnimating) {
      const next = (animStep + 1) % 7;
      setStep(next);
      scheduleAutoplay();
    } else {
      scheduleAutoplay();
    }
  }, CONFIG.autoplayDelay * 1000);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Slow spin during hero
  if (animStep === 0 && !isAnimating) {
    earthGroup.rotation.y += CONFIG.spinSpeed * delta;
  }

  // Animate ocean shader
  layerMeshes.forEach(mesh => {
    if (mesh.userData.layer.type === 'ocean' && mesh.material.uniforms) {
      mesh.material.uniforms.time.value = elapsed;
    }
    // Pulse core
    if (mesh.userData.layer.type === 'core') {
      const pulse = 0.9 + Math.sin(elapsed * 2) * 0.1;
      mesh.material.emissiveIntensity = pulse;
    }
    // Animate mantle (slow rotation)
    if (mesh.userData.layer.type === 'mantle') {
      mesh.rotation.y += 0.003 * delta;
    }
    // Spin clouds slightly
    if (mesh.userData.layer.type === 'clouds') {
      mesh.rotation.y += 0.05 * delta;
    }
  });

  renderer.render(scene, camera);
}

export function destroyHeroAnimation() {
  if (renderer) renderer.dispose();
}
