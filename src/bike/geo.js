import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Koga F3 geometry chart (size 57, all metres).
// Coordinate system: +X = direction of travel, +Y = up, +Z = drive side.
// The classic profile view (drive side toward camera) is seen from +Z.
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

// Wheels: 700x28c on rim-brake wheelset
export const WHEEL = {
  tireOuterR: 0.342,      // axle height off the ground
  tireTubeR: 0.0145,      // 28 mm tire casing radius
  rimOuterR: 0.318,       // brake-track outer radius
  rimDepth: 0.030,        // semi-aero alloy rim depth
  rimWidth: 0.021,
  hubFlangeR: 0.022,
  hubFlangeZ: 0.032,      // flange offset from wheel centre plane
  hubBodyR: 0.012,
  spokeCount: 28,
  spokeR: 0.001,
};

export const HEAD_ANGLE = 71.5 * DEG;
export const SEAT_ANGLE = 73.0 * DEG;
export const FORK_LEN = 0.375;          // axle to crown
export const FORK_OFFSET = 0.045;

// Primary hard points
export const BB = new THREE.Vector3(0, 0.274, 0);              // bottom bracket
export const REAR_AXLE = new THREE.Vector3(-0.422, WHEEL.tireOuterR, 0);
export const FRONT_AXLE = new THREE.Vector3(0.618, WHEEL.tireOuterR, 0);

// Steering axis unit vector (pointing up/backwards)
export const STEER_UP = new THREE.Vector3(-Math.cos(HEAD_ANGLE), Math.sin(HEAD_ANGLE), 0).normalize();
// Perpendicular to steering axis, pointing forward (for fork rake)
export const STEER_FWD = new THREE.Vector3(Math.sin(HEAD_ANGLE), Math.cos(HEAD_ANGLE), 0).normalize();

// Fork crown sits FORK_LEN up the steering axis from the axle, minus the rake offset
export const FORK_CROWN = FRONT_AXLE.clone()
  .addScaledVector(STEER_FWD, -FORK_OFFSET)
  .addScaledVector(STEER_UP, FORK_LEN);

export const HEAD_TUBE_LEN = 0.165;
export const HEAD_TUBE_BOT = FORK_CROWN.clone().addScaledVector(STEER_UP, 0.012);
export const HEAD_TUBE_TOP = HEAD_TUBE_BOT.clone().addScaledVector(STEER_UP, HEAD_TUBE_LEN);

// Seat tube
export const SEAT_TUBE_LEN = 0.50;
export const SEAT_UP = new THREE.Vector3(-Math.cos(SEAT_ANGLE), Math.sin(SEAT_ANGLE), 0).normalize();
export const SEAT_TUBE_TOP = BB.clone().addScaledVector(SEAT_UP, SEAT_TUBE_LEN);
export const SADDLE_POS = BB.clone().addScaledVector(SEAT_UP, 0.665); // saddle rail height

// Top tube meets the tubes slightly below their tops (sloping top tube)
export const TT_FRONT = HEAD_TUBE_TOP.clone().addScaledVector(STEER_UP, -0.025);
export const TT_REAR = BB.clone().addScaledVector(SEAT_UP, SEAT_TUBE_LEN - 0.015);

// Down tube runs BB -> bottom of head tube
export const DT_FRONT = HEAD_TUBE_BOT.clone().addScaledVector(STEER_UP, 0.032);

// Seatstay junction on the seat tube
export const SS_TOP = BB.clone().addScaledVector(SEAT_UP, SEAT_TUBE_LEN - 0.055);

// Stem / cockpit (flat-bar fitness geometry, true to the F3)
export const STEM_LEN = 0.095;
export const STEM_RISE = 7 * DEG;
export const SPACER_STACK = 0.025;
export const BAR_WIDTH = 0.62;
export const BAR_CLAMP = HEAD_TUBE_TOP.clone()
  .addScaledVector(STEER_UP, SPACER_STACK + 0.02)
  .add(new THREE.Vector3(Math.cos(STEM_RISE) * STEM_LEN, Math.sin(STEM_RISE) * STEM_LEN + 0.013, 0));

// Drivetrain
export const CRANK_LEN = 0.1725;
export const CHAINRING_T = 50;
export const COG_T = 17;                 // engaged sprocket
export const CHAIN_PITCH = 0.0127;       // 1/2 inch
export const CHAINRING_R = (CHAINRING_T * CHAIN_PITCH) / (2 * Math.PI);
export const COG_R = (COG_T * CHAIN_PITCH) / (2 * Math.PI);
export const CHAINLINE_Z = 0.0455;
export const CASSETTE = [32, 28, 24, 21, 19, 17, 15, 13, 12, 11];  // 10-speed
export const CASSETTE_Z0 = 0.0265;       // largest cog plane
export const CASSETTE_DZ = 0.0039;       // cog-to-cog spacing
// z-plane of the engaged 17t cog (index 5)
export const COG_Z = CASSETTE_Z0 + 5 * CASSETTE_DZ;

export const GEAR_RATIO = CHAINRING_T / COG_T;

// Rear derailleur jockey wheels (11t)
export const JOCKEY_R = (11 * CHAIN_PITCH) / (2 * Math.PI);

// Tube radii — F3 hydroformed alloy: fat at BB/head, slimmer at far ends
export const TUBES = {
  downTubeR0: 0.0240,   // at BB (wide, ovalised)
  downTubeR1: 0.0190,   // at head tube
  topTubeR0: 0.0165,    // at head tube
  topTubeR1: 0.0135,    // at seat tube
  seatTubeR: 0.0160,
  headTubeR: 0.0235,
  chainstayR0: 0.0125,  // at BB
  chainstayR1: 0.0070,  // at dropout
  seatstayR0: 0.0085,
  seatstayR1: 0.0065,
  forkR0: 0.0165,       // at crown
  forkR1: 0.0085,       // at dropout
  seatpostR: 0.0136,
  barR: 0.0112,
};

// Koga F3 livery
export const LIVERY = {
  frame: 0x16181b,        // satin "graphite black" alloy
  decal: 0xffffff,        // KOGA lettering
  accent: 0xe63329,       // signal red accents
  fork: 0x0c0d0e,         // matte carbon
  rim: 0x141517,
  hub: 0x9da3a8,
  spokes: 0x32363a,
  tire: 0x141414,
  tireWall: 0x232323,
  chain: 0x8c9196,
  cassette: 0xaab0b5,
  chainring: 0x2a2d31,
  crank: 0x202327,
  saddle: 0x101010,
  grip: 0x1a1a1a,
  cable: 0x111111,
};

export function vec(x, y, z = 0) { return new THREE.Vector3(x, y, z); }

// Build a tapered tube mesh between two points, radius r0 at `a`, r1 at `b`.
export function taperedTube(a, b, r0, r1, material, radialSegments = 24) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

// Tube that follows a curve (for stays, cables, bends)
export function curveTube(points, r, material, tubularSegments = 32, radialSegments = 12, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, r, radialSegments, closed);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}
