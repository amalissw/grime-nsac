/**
 * Earth Jukebox — Hero Three.js animation
 * Realistic Earth with detailed textures
 */

const CONFIG = {
  t: { hero: 3, tiltedExplode: 3.5, upright: 3, hold: 1, panDown: 3, reassemble: 3.5, turnAmericas: 1.5, phenomena: 7, holdEnd: 2 },
  ease: 'power3.inOut',
  spinSpeed: 0.12,
  autoplayDelay: 14,
  camera: { z: 8, fov: 38 },
};

const LAYERS = [
  { name: 'atmosphere', r: 1.10,  color: 0x4fc3f7, opacity: 0.22, type: 'atmosphere', emissive: 0x0a3060 },
  { name: 'clouds',     r: 1.022, color: 0xffffff,  opacity: 0.5,  type: 'clouds' },
  { name: 'icecaps',   r: 1.008, color: 0xe8f4fd,  opacity: 0.75, type: 'icecaps' },
  { name: 'land',      r: 1.003, color: 0x2d6a2d,  opacity: 1.0,  type: 'land' },
  { name: 'ocean',     r: 1.000, color: 0x003b6e,  opacity: 1.0,  type: 'ocean' },
  { name: 'crust',     r: 0.930, color: 0x8d6e63,  opacity: 1.0,  type: 'crust' },
  { name: 'mantle',    r: 0.780, color: 0xff5722,  opacity: 1.0,  type: 'mantle', emissive: 0x8b1a1a },
  { name: 'core',      r: 0.420, color: 0xffee58,  opacity: 1.0,  type: 'core',   emissive: 0xffcc00 },
];

const EXPLODE_RADII = [1.0, 0.97, 0.94, 0.92, 0.90, 0.86, 0.76, 0.52];

let THREE, gsap;
let scene, camera, renderer, clock;
let earthGroup, layerMeshes = [];
let animStep = 0;
let autoplayTimer = null;
let isAnimating = false;
let currentTimeline = null;

export async function initHeroAnimation(canvas) {
  try {
    const threeModule = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    THREE = threeModule;
    await loadScript('https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js');
    gsap = window.gsap;
  } catch (e) {
    console.warn('Could not load Three.js:', e);
    return;
  }

  if (!THREE || !gsap) return;

  setupRenderer(canvas);
  setupScene();
  buildEarth();
  setupCamera();

  clock = new THREE.Clock();
  animate();

  window.addEventListener('wheel', onInput, { passive: true });
  window.addEventListener('click', onInput);
  window.addEventListener('touchstart', onInput, { passive: true });

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
  renderer.setClearColor(0x000308, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setupScene() {
  scene = new THREE.Scene();

  // Deep space fog
  scene.fog = new THREE.FogExp2(0x000308, 0.008);

  // Ambient — very dim blue-black
  scene.add(new THREE.AmbientLight(0x0d1a2e, 0.8));

  // Sun — warm white from upper right
  const sun = new THREE.DirectionalLight(0xfff8e7, 3.5);
  sun.position.set(8, 5, 6);
  scene.add(sun);

  // Rim light — cool blue from behind (space glow)
  const rim = new THREE.DirectionalLight(0x1a4080, 1.0);
  rim.position.set(-6, -2, -8);
  scene.add(rim);

  // Stars
  const starGeo = new THREE.BufferGeometry();
  const count = 3500;
  const pos = new Float32Array(count * 3);
  const cols = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 150 + Math.random() * 50;
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    // Slightly varied star colors
    const warm = Math.random();
    cols[i * 3]     = 0.9 + warm * 0.1;
    cols[i * 3 + 1] = 0.9 + warm * 0.05;
    cols[i * 3 + 2] = 1.0;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const starMat = new THREE.PointsMaterial({ size: 0.18, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9 });
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
  const seg = isMobile ? [80, 60] : [160, 120];

  layerMeshes = LAYERS.map((layer, i) => {
    const geo = new THREE.SphereGeometry(layer.r, seg[0], seg[1]);
    const mat = buildMaterial(layer);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { layer, index: i };
    mesh.renderOrder = i;
    earthGroup.add(mesh);
    return mesh;
  });

  earthGroup.rotation.z = -0.41; // Earth's axial tilt
  earthGroup.rotation.y = 0.8;   // Show Eurasia/Africa face
}

function buildMaterial(layer) {
  switch (layer.type) {
    case 'atmosphere':
      return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { sunDir: { value: new THREE.Vector3(0.7, 0.4, 0.5).normalize() } },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPos;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPos = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 sunDir;
          varying vec3 vNormal;
          varying vec3 vPos;
          void main() {
            vec3 viewDir = normalize(-vPos);
            float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
            rim = pow(rim, 3.5);
            vec3 atmColor = mix(vec3(0.1, 0.4, 1.0), vec3(0.3, 0.7, 1.0), rim);
            float sun = max(dot(vNormal, sunDir), 0.0);
            atmColor += vec3(0.4, 0.3, 0.1) * sun * 0.4;
            gl_FragColor = vec4(atmColor, rim * 0.65);
          }
        `,
      });

    case 'clouds':
      return new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        alphaMap: generateCloudTexture(),
        shininess: 5,
      });

    case 'icecaps':
      return new THREE.MeshPhongMaterial({
        color: 0xeef6ff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        alphaMap: generateIcecapTexture(),
        shininess: 60,
        specular: 0xffffff,
      });

    case 'land':
      return new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 8,
        side: THREE.DoubleSide,
        map: generateLandTexture(),
        transparent: false,
        alphaMap: generateLandAlphaTexture(),
      });

    case 'ocean':
      return buildOceanMaterial();

    case 'crust':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        shininess: 8,
        side: THREE.DoubleSide,
        map: generateCrustTexture(),
        emissive: 0x1a0500,
        emissiveIntensity: 0.4,
      });

    case 'mantle':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        emissive: layer.emissive,
        emissiveIntensity: 0.7,
        shininess: 40,
        side: THREE.DoubleSide,
        map: generateMantleTexture(),
      });

    case 'core':
      return new THREE.MeshPhongMaterial({
        color: layer.color,
        emissive: layer.emissive,
        emissiveIntensity: 1.2,
        shininess: 120,
        side: THREE.DoubleSide,
        specular: 0xffffff,
      });
  }
}

// --- Noise ---
function hash(x, y) {
  let s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (
    hash(ix, iy) * (1 - ux) * (1 - uy) +
    hash(ix + 1, iy) * ux * (1 - uy) +
    hash(ix, iy + 1) * (1 - ux) * uy +
    hash(ix + 1, iy + 1) * ux * uy
  );
}

function fbm(x, y, octaves = 5) {
  let v = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += smoothNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5; freq *= 2.1;
  }
  return v / norm;
}

// --- Procedural textures ---

function generateLandTexture() {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = Math.floor(i / W);
    const lon = (px / W) * 360 - 180;
    const lat = 90 - (py / H) * 180;

    if (!isLandPoint(lon, lat)) {
      d[i*4+3] = 0; continue;
    }

    const nx = px / W * 12, ny = py / H * 6;
    const n = fbm(nx, ny, 6);
    const n2 = fbm(nx * 2 + 5, ny * 2 + 3, 4);
    const absLat = Math.abs(lat);

    // Terrain: desert near tropics + noise, forest near 40-60°, tundra near poles
    let r, g, b;
    if (absLat > 65) {
      // Tundra / boreal
      const t = (absLat - 65) / 25;
      r = Math.floor(80 + n * 40 - t * 20);
      g = Math.floor(90 + n * 35 - t * 20);
      b = Math.floor(70 + n * 30 - t * 10);
    } else if (absLat > 50) {
      // Boreal forest - dark green/grey-green
      r = Math.floor(55 + n * 35);
      g = Math.floor(80 + n * 40);
      b = Math.floor(50 + n * 25);
    } else if (absLat > 35) {
      // Temperate - mixed green/brown
      const mix = (absLat - 35) / 15;
      r = Math.floor(60 + n2 * 50 + mix * 20);
      g = Math.floor(100 + n2 * 45 + mix * 10);
      b = Math.floor(40 + n2 * 30);
    } else if (absLat > 15) {
      // Subtropical - semi-arid to savanna
      const dryness = n2;
      r = Math.floor(140 + dryness * 60);
      g = Math.floor(120 + dryness * 30 + (1 - dryness) * 40);
      b = Math.floor(60 + dryness * 20);
    } else {
      // Tropical - lush green
      r = Math.floor(40 + n * 30);
      g = Math.floor(100 + n * 50);
      b = Math.floor(30 + n * 20);
    }

    // Mountain peaks (high fbm = elevation)
    if (n > 0.72) {
      const mt = (n - 0.72) / 0.28;
      r = Math.floor(r + mt * (160 - r));
      g = Math.floor(g + mt * (160 - g));
      b = Math.floor(b + mt * (160 - b));
    }

    d[i*4]   = Math.min(255, Math.max(0, r));
    d[i*4+1] = Math.min(255, Math.max(0, g));
    d[i*4+2] = Math.min(255, Math.max(0, b));
    d[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateLandAlphaTexture() {
  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = Math.floor(i / W);
    const lon = (px / W) * 360 - 180;
    const lat = 90 - (py / H) * 180;
    const nx = px / W * 6, ny = py / H * 3;
    const coast = fbm(nx + 10, ny + 10, 3) * 0.1;
    const isLand = isLandPoint(lon + coast * 5, lat + coast * 3);
    d[i*4+3] = isLand ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateCloudTexture() {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = Math.floor(i / W);
    const lat = Math.abs(90 - (py / H) * 180);
    // More clouds at mid-latitudes and near equator
    const latWeight = 0.4 + 0.6 * (1 - Math.abs(lat - 45) / 45);
    const v = fbm(px / W * 10, py / H * 5, 6);
    const v2 = fbm(px / W * 20 + 7, py / H * 10 + 3, 4);
    const cloud = v * 0.7 + v2 * 0.3;
    const threshold = 0.52 - latWeight * 0.08;
    let a = 0;
    if (cloud > threshold) {
      a = Math.pow((cloud - threshold) / (1 - threshold), 1.5) * 255;
    }
    d[i*4] = d[i*4+1] = d[i*4+2] = 255;
    d[i*4+3] = Math.min(255, a);
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateIcecapTexture() {
  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = Math.floor(i / W);
    const lat = Math.abs(90 - (py / H) * 180);
    const n = fbm(px / W * 8, py / H * 8, 4);
    const polar = Math.max(0, (lat - 62) / 28 + n * 0.15);
    d[i*4] = 220; d[i*4+1] = 235; d[i*4+2] = 255;
    d[i*4+3] = polar > 0.3 ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateCrustTexture() {
  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = Math.floor(i / W);
    const v = fbm(px / W * 14, py / H * 7, 6);
    const crack = fbm(px / W * 28 + 3, py / H * 14 + 7, 3) > 0.78;
    const r = crack ? 240 : Math.floor(80 + v * 70);
    const g = crack ? 100 : Math.floor(45 + v * 40);
    const b = crack ? 20 : Math.floor(30 + v * 25);
    d[i*4] = r; d[i*4+1] = g; d[i*4+2] = b; d[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function generateMantleTexture() {
  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) {
    const px = i % W, py = Math.floor(i / W);
    const v = fbm(px / W * 8, py / H * 4, 5);
    const v2 = fbm(px / W * 16 + 5, py / H * 8 + 2, 4);
    const hot = v2 > 0.68;
    d[i*4]   = hot ? 255 : Math.floor(180 + v * 60);
    d[i*4+1] = hot ? 160 : Math.floor(40 + v * 50);
    d[i*4+2] = hot ? 20  : Math.floor(5 + v * 15);
    d[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function buildOceanMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPos;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vPos = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vPos;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += noise(p) * a; a *= 0.5; p *= 2.1; }
        return v;
      }

      void main() {
        float lat = (vUv.y - 0.5) * 2.0; // -1 poles, 0 equator (inverted)
        float absLat = abs(lat);

        // Real ocean colors: deep blue to teal
        vec3 deepBlue  = vec3(0.004, 0.027, 0.11);  // abyss
        vec3 midBlue   = vec3(0.0,   0.18,  0.42);  // mid-ocean
        vec3 shallowTeal = vec3(0.0, 0.42,  0.6);   // tropical shallow
        vec3 arcticBlue  = vec3(0.08, 0.22, 0.40);  // cold polar

        float depthMix = fbm(vUv * 6.0 + time * 0.012) * 0.3;
        vec3 oceanColor;
        if (absLat > 0.75) {
          // Polar — darker, greenish-blue
          oceanColor = mix(arcticBlue, deepBlue, (absLat - 0.75) / 0.25);
        } else if (absLat > 0.4) {
          // Mid latitudes
          oceanColor = mix(midBlue, arcticBlue, (absLat - 0.4) / 0.35);
        } else {
          // Tropical — brighter blue-teal
          oceanColor = mix(shallowTeal, midBlue, absLat / 0.4);
        }
        oceanColor += depthMix * vec3(0.0, 0.05, 0.1);

        // Specular shimmer
        vec3 viewDir = normalize(-vPos);
        vec3 lightDir = normalize(vec3(0.7, 0.4, 0.5));
        vec3 halfway = normalize(lightDir + viewDir);
        float spec = pow(max(dot(vNormal, halfway), 0.0), 90.0);
        vec2 waveUv = vUv * 20.0 + time * vec2(0.03, 0.02);
        float wave = noise(waveUv) * 0.5 + noise(waveUv * 1.7 + 1.3) * 0.3;
        float shimmer = spec * (0.6 + wave * 0.4);

        vec3 finalColor = oceanColor + vec3(shimmer) * 0.8;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

function isLandPoint(lon, lat) {
  if (lon > -170 && lon < -52 && lat > 15 && lat < 85) {
    if (lon > -88 && lon < -60 && lat < 25) return false;
    return true;
  }
  if (lon > -82 && lon < -34 && lat > -56 && lat < 15) return true;
  if (lon > -25 && lon < 65 && lat > 35 && lat < 72) {
    if (lon > 25 && lon < 45 && lat < 42) return false; // Black/Caspian sea region
    return true;
  }
  if (lon > -20 && lon < 55 && lat > -35 && lat < 37) return true;
  if (lon > 25 && lon < 180 && lat > -10 && lat < 78) {
    if (lon > 100 && lon < 130 && lat > 0 && lat < 25) return false; // S.China Sea
    return true;
  }
  if (lon > 112 && lon < 155 && lat > -44 && lat < -10) return true;
  if (lon > 165 || lon < -170) {
    if (lat > -47 && lat < -34 && (lon > 165 || lon < -175)) return true; // NZ
    return false;
  }
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
  const dur = instant ? 0 : 1.8;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;
  tl.to(earthGroup.rotation, { z: -0.41, duration: dur, ease: CONFIG.ease })
    .to(earthGroup.scale, { x: 1, y: 1, z: 1, duration: dur, ease: CONFIG.ease }, '<')
    .to(camera.position, { x: 0, y: 0, z: CONFIG.camera.z, duration: dur, ease: CONFIG.ease }, '<');
  layerMeshes.forEach(mesh => {
    tl.to(mesh.position, { y: 0, duration: dur, ease: CONFIG.ease }, '<');
    tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: dur, ease: CONFIG.ease }, '<');
    tl.to(mesh.rotation, { y: 0, duration: dur, ease: CONFIG.ease }, '<');
  });
}

function tiltedExplode() {
  const dur = CONFIG.t.tiltedExplode;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;
  layerMeshes.forEach((mesh, i) => {
    const offset = (i - 3.5) * 0.65;
    tl.to(mesh.position, { y: offset, duration: dur, ease: CONFIG.ease }, 0);
    tl.to(mesh.rotation, { y: i % 2 === 0 ? 0.3 : -0.3, duration: dur, ease: CONFIG.ease }, 0);
  });
}

function uprightExplode() {
  const dur = CONFIG.t.upright;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
  currentTimeline = tl;
  tl.to(earthGroup.rotation, { z: 0, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.position, { x: 0, y: 0, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(camera.position, { y: 2.0, z: 9, duration: dur, ease: CONFIG.ease }, 0);
  layerMeshes.forEach((mesh, i) => {
    const targetY = (3.5 - i) * 1.3;
    tl.to(mesh.position, { y: targetY, duration: dur, ease: CONFIG.ease }, 0);
    tl.to(mesh.scale, { x: EXPLODE_RADII[i], y: EXPLODE_RADII[i], z: EXPLODE_RADII[i], duration: dur, ease: CONFIG.ease }, 0);
  });
}

function holdState() { isAnimating = false; }

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
  tl.to(camera.position, { x: 0, y: 0, z: CONFIG.camera.z, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.rotation, { x: 0.25, z: -0.41, duration: dur, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.scale, { x: 1.5, y: 1.5, z: 1.5, duration: dur * 0.5, ease: CONFIG.ease }, 0);
  tl.to(earthGroup.scale, { x: 1, y: 1, z: 1, duration: dur * 0.5, ease: CONFIG.ease }, dur * 0.5);
  layerMeshes.forEach(mesh => {
    tl.to(mesh.position, { y: 0, duration: dur, ease: CONFIG.ease }, 0);
    tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: dur, ease: CONFIG.ease }, 0);
    tl.to(mesh.rotation, { y: 0, duration: dur, ease: CONFIG.ease }, 0);
  });
}

function turnAmericas() {
  const dur = CONFIG.t.turnAmericas;
  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; setTimeout(() => { const tl2 = gsap.timeline({ onComplete: () => setStep(0) }); tl2.to(camera.position, { z: CONFIG.camera.z + 2, duration: 2, ease: 'power2.inOut' }).to(camera.position, { z: CONFIG.camera.z, duration: 0.5 }); }, CONFIG.t.phenomena * 1000); } });
  currentTimeline = tl;
  tl.to(earthGroup.rotation, { y: 1.4, x: 0.1, z: -0.41, duration: dur, ease: CONFIG.ease }, 0);
}

function onInput() {
  clearTimeout(autoplayTimer);
  scheduleAutoplay();
}

function scheduleAutoplay() {
  autoplayTimer = setTimeout(() => {
    if (!isAnimating) {
      setStep((animStep + 1) % 7);
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

  if (animStep === 0 && !isAnimating) {
    earthGroup.rotation.y += CONFIG.spinSpeed * delta;
  }

  layerMeshes.forEach(mesh => {
    if (mesh.userData.layer.type === 'ocean' && mesh.material.uniforms) {
      mesh.material.uniforms.time.value = elapsed;
    }
    if (mesh.userData.layer.type === 'core') {
      mesh.material.emissiveIntensity = 0.9 + Math.sin(elapsed * 2.2) * 0.3;
    }
    if (mesh.userData.layer.type === 'mantle') {
      mesh.rotation.y += 0.004 * delta;
    }
    if (mesh.userData.layer.type === 'clouds') {
      mesh.rotation.y += 0.06 * delta;
    }
    if (mesh.userData.layer.type === 'atmosphere' && mesh.material.uniforms) {
      // Update sun direction as earth rotates
      const sunDir = new THREE.Vector3(0.7, 0.4, 0.5).normalize();
      mesh.material.uniforms.sunDir.value = sunDir;
    }
  });

  renderer.render(scene, camera);
}

export function destroyHeroAnimation() {
  if (renderer) renderer.dispose();
}
