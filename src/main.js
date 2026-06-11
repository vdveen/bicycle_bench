import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import {
  FRONT_AXLE, REAR_AXLE, GEAR_RATIO, CHAINRING_R, WHEEL, BB, SADDLE_POS,
} from './bike/geo.js';
import { createMaterials } from './bike/materials.js';
import { buildFrame } from './bike/frame.js';
import { buildWheel } from './bike/wheels.js';
import { buildSteering } from './bike/fork.js';
import { buildDrivetrain } from './bike/drivetrain.js';
import { buildChain } from './bike/chain.js';
import { buildBrakes } from './bike/brakes.js';

// ---------------------------------------------------------------------------
// Koga F3 — interactive Three.js showcase
// ---------------------------------------------------------------------------

const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101214);
scene.fog = new THREE.Fog(0x101214, 8, 22);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 100);

// --- Lighting -------------------------------------------------------------
const key = new THREE.DirectionalLight(0xfff2e3, 1.45);
key.position.set(2.5, 4.5, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6;
key.shadow.camera.top = 1.6; key.shadow.camera.bottom = -1.6;
key.shadow.bias = -0.0002;
key.shadow.radius = 5;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9db8ff, 0.85);
rim.position.set(-3, 2.2, -2.5);
scene.add(rim);
const kicker = new THREE.DirectionalLight(0xffe8d0, 0.4);
kicker.position.set(-1.5, 0.8, 3.2);
scene.add(kicker);
const fill = new THREE.AmbientLight(0x404550, 0.22);
scene.add(fill);

// --- Studio floor + backdrop sweep ------------------------------------------
function gradientTex(stops, vertical = true) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = vertical
    ? ctx.createLinearGradient(0, 256, 0, 0)
    : ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  for (const [t, col] of stops) g.addColorStop(t, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshStandardMaterial({
    map: gradientTex([[0, '#2a2d31'], [0.55, '#1c1f22'], [1, '#101214']], false),
    roughness: 0.85, metalness: 0.05,
  }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const backdrop = new THREE.Mesh(
  new THREE.CylinderGeometry(8.8, 8.8, 9, 48, 1, true),
  new THREE.MeshBasicMaterial({
    map: gradientTex([[0, '#202329'], [0.25, '#15171a'], [1, '#08090a']]),
    side: THREE.BackSide, fog: false,
  }));
backdrop.position.y = 4.5;
scene.add(backdrop);
// Subtle ring accent on the floor
const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.18, 1.20, 96),
  new THREE.MeshBasicMaterial({ color: 0x2e3338, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.001;
ring.position.x = 0.1;
scene.add(ring);

// --- Bike assembly ----------------------------------------------------------
const M = createMaterials();
const bikeRoot = new THREE.Group();   // pivot at ground line for lean
scene.add(bikeRoot);
const bike = new THREE.Group();
bikeRoot.add(bike);

bike.add(buildFrame(M));

const rearWheel = buildWheel(M, { rear: true });
rearWheel.group.position.copy(REAR_AXLE);
bike.add(rearWheel.group);

const frontWheel = buildWheel(M, { rear: false });

const { steer, axleLocal, leverPivots } = buildSteering(M);
bike.add(steer);
frontWheel.group.position.copy(axleLocal);
steer.add(frontWheel.group);

const dt = buildDrivetrain(M, rearWheel.spin);
bike.add(dt.group);

const chain = buildChain(M, dt.pulleys);
bike.add(chain.group);

const brakes = buildBrakes(M, steer, axleLocal, leverPivots);
bike.add(brakes.group);

// --- Camera rig --------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.15;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.55;

const VIEWS = {
  side:       { pos: [0.10, 0.58, 2.75], tgt: [0.10, 0.55, 0] },
  hero:       { pos: [1.55, 0.92, 1.95], tgt: [0.05, 0.52, 0] },
  cockpit:    { pos: [-0.28, 1.22, 0.16], tgt: [0.42, 0.78, 0] },
  drivetrain: { pos: [0.32, 0.32, 0.78], tgt: [-0.05, 0.30, 0] },
  derailleur: { pos: [-0.36, 0.30, 0.52], tgt: [-0.41, 0.28, 0.03] },
  front:      { pos: [2.6, 0.62, 0.9], tgt: [0.3, 0.55, 0] },
  chain:      { pos: [0.05, 0.24, 1.05], tgt: [-0.12, 0.26, 0] },
  brake:      { pos: [-0.52, 0.86, 0.30], tgt: [-0.19, 0.615, 0] },
};

const camTween = { active: false, t: 0, fromP: new THREE.Vector3(), toP: new THREE.Vector3(), fromT: new THREE.Vector3(), toT: new THREE.Vector3() };
function setView(name, instant = false) {
  const v = VIEWS[name];
  if (!v) return;
  if (instant) {
    camera.position.set(...v.pos);
    controls.target.set(...v.tgt);
    controls.update();
    return;
  }
  camTween.active = true; camTween.t = 0;
  camTween.fromP.copy(camera.position); camTween.toP.set(...v.pos);
  camTween.fromT.copy(controls.target); camTween.toT.set(...v.tgt);
}
document.querySelectorAll('#views button').forEach((b) =>
  b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('keydown', (e) => {
  const map = { 1: 'side', 2: 'cockpit', 3: 'drivetrain', 4: 'derailleur', 5: 'hero' };
  if (map[e.key]) setView(map[e.key]);
});

// --- Drivetrain / riding state -----------------------------------------------
const state = {
  crankAngle: 0, crankVel: 0,        // rad, rad/s (negative = forward pedalling)
  wheelAngle: 0, wheelVel: 0,
  chainOffset: 0,
  steerTarget: 0, steerAngle: 0,
  lean: 0,
  brake: 0, brakeTarget: 0,
  autopedal: false,
  draggingPedal: false,
};

// --- Interactivity -------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let dragLastAngle = 0;

function pedalAngleFromPointer(e) {
  // Project pointer ray onto the crank plane (z = bike plane), measure angle about BB
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.06);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  return Math.atan2(hit.y - BB.y, hit.x - BB.x);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 2) { state.brakeTarget = 1; return; }
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(dt.crank, true);
  if (hits.length) {
    state.draggingPedal = true;
    controls.enabled = false;
    dragLastAngle = pedalAngleFromPointer(e);
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (state.draggingPedal) {
    const a = pedalAngleFromPointer(e);
    let da = a - dragLastAngle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    state.crankAngle += da;
    state.crankVel = THREE.MathUtils.clamp(da * 60, -18, 18);
    dragLastAngle = a;
  } else if (e.shiftKey) {
    state.steerTarget = -((e.clientX / window.innerWidth) * 2 - 1) * 0.55;
  }
});
window.addEventListener('pointerup', (e) => {
  if (e.button === 2) state.brakeTarget = 0;
  if (state.draggingPedal) { state.draggingPedal = false; controls.enabled = true; }
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') state.brakeTarget = 1;
  if (e.key === 'p' || e.key === 'P') state.autopedal = !state.autopedal;
  if (e.key === '0') setView('hero');
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'b' || e.key === 'B') state.brakeTarget = 0;
});

// --- Simulation -----------------------------------------------------------------
function step(dtSec) {
  dtSec = Math.min(dtSec, 0.05);

  if (state.autopedal) state.crankVel = THREE.MathUtils.lerp(state.crankVel, -5.5, 0.04);
  else if (!state.draggingPedal) state.crankVel *= Math.pow(0.45, dtSec); // pedal friction

  if (!state.draggingPedal) state.crankAngle += state.crankVel * dtSec;

  // Freehub: forward pedalling (negative vel) engages the cassette
  const drivenVel = state.crankVel * GEAR_RATIO;
  if (drivenVel < state.wheelVel) state.wheelVel = drivenVel;         // engage
  else state.wheelVel *= Math.pow(0.92, dtSec);                        // coast

  // Brakes
  state.brake = THREE.MathUtils.lerp(state.brake, state.brakeTarget, 1 - Math.pow(0.0001, dtSec));
  if (state.brake > 0.02) {
    const decel = 1 - state.brake * 8.0 * dtSec;
    state.wheelVel *= Math.max(0, decel);
    if (state.autopedal) state.autopedal = false;
  }
  state.wheelAngle += state.wheelVel * dtSec;

  // Chain follows the crank (freehub: chain stationary while coasting)
  if (state.crankVel < 0 || state.draggingPedal) {
    state.chainOffset += -state.crankVel * CHAINRING_R * dtSec;
  }

  // Steering + lean physics: lean into the turn, scaled by wheel speed
  state.steerAngle = THREE.MathUtils.lerp(state.steerAngle, state.steerTarget, 1 - Math.pow(0.002, dtSec));
  const speed = Math.abs(state.wheelVel) * WHEEL.tireOuterR;            // m/s
  const targetLean = THREE.MathUtils.clamp(-state.steerAngle * speed * 0.10, -0.30, 0.30);
  state.lean = THREE.MathUtils.lerp(state.lean, targetLean, 1 - Math.pow(0.01, dtSec));

  // --- Apply to scene graph
  dt.crank.rotation.z = state.crankAngle;
  for (const { arm, pedal, side } of dt.pedals) {
    pedal.rotation.z = -state.crankAngle - (side === 1 ? 0 : Math.PI);
  }
  rearWheel.spin.rotation.z = state.wheelAngle;
  frontWheel.spin.rotation.z = state.wheelAngle;
  chain.update(state.chainOffset);
  steer.rotation.y = state.steerAngle;
  bikeRoot.rotation.x = state.lean;

  // Brake visuals
  brakes.squeeze(state.brake);
  leverPivots[0].rotation.z = -state.brake * 0.30;
  leverPivots[1].rotation.z = -state.brake * 0.30;
}

// --- Loop -------------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dtSec = (now - last) / 1000;
  last = now;
  if (camTween.active) {
    camTween.t = Math.min(1, camTween.t + dtSec * 1.6);
    const e = camTween.t < 0.5 ? 2 * camTween.t * camTween.t : 1 - Math.pow(-2 * camTween.t + 2, 2) / 2;
    camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
    controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
    if (camTween.t >= 1) camTween.active = false;
  }
  step(dtSec);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
setView('hero', true);
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Headless screenshot API ---------------------------------------------------
window.__appScene = scene;
window.__appCamera = camera;
window.__appControls = controls;
window.__app = {
  lookAt: (px, py, pz, tx, ty, tz) => {
    camera.position.set(px, py, pz);
    controls.target.set(tx, ty, tz);
    controls.update();
    renderer.render(scene, camera);
  },
  ready: true,
  setView: (name) => setView(name, true),
  setCrank: (a) => {
    state.crankAngle = a;
    state.chainOffset = -a * CHAINRING_R;
    // wheel phase consistent with gear ratio
    state.wheelAngle = a * GEAR_RATIO;
    step(0.001); renderer.render(scene, camera);
  },
  setLean: (a) => { state.lean = a; bikeRoot.rotation.x = a; renderer.render(scene, camera); },
  setSteer: (a) => { state.steerAngle = a; state.steerTarget = a; steer.rotation.y = a; renderer.render(scene, camera); },
  setBrake: (t) => { state.brake = t; state.brakeTarget = t; brakes.squeeze(t); leverPivots[0].rotation.z = -t * 0.3; leverPivots[1].rotation.z = -t * 0.3; renderer.render(scene, camera); },
  autopedal: (on) => { state.autopedal = on; },
  renderOnce: () => { step(0.016); controls.update(); renderer.render(scene, camera); },
  getState: () => ({ ...state }),
  resetMotion: () => {
    state.crankVel = 0; state.wheelVel = 0; state.brake = 0; state.brakeTarget = 0;
    state.autopedal = false;
  },
  // screen-space position of the drive-side pedal centre (for input tests)
  pedalScreenPos: () => {
    const p = new THREE.Vector3();
    dt.pedals[0].pedal.getWorldPosition(p);
    p.project(camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
  },
};
