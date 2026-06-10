import * as THREE from 'three';
import {
  BB, REAR_AXLE, SEAT_UP, CRANK_LEN, CHAINRING_R, CHAINLINE_Z, CHAIN_PITCH,
  CASSETTE, CASSETTE_Z0, CASSETTE_DZ, JOCKEY_R, curveTube,
} from './geo.js';

// ---------------------------------------------------------------------------
// Drivetrain: crankset (50/34 with 4-arm spider), platform pedals, 10-speed
// cassette, rear derailleur with jockey wheels, front derailleur.
// ---------------------------------------------------------------------------

// Toothed sprocket: extruded disc with trapezoidal teeth at the chain pitch.
export function sprocketGeometry(teeth, thickness, { holeR = null, toothDepth = 0.0042 } = {}) {
  const r = (teeth * CHAIN_PITCH) / (2 * Math.PI);   // pitch radius
  const tip = r + toothDepth * 0.45;
  const root = r - toothDepth * 0.55;
  const s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.22) / teeth) * Math.PI * 2;
    const a2 = ((i + 0.42) / teeth) * Math.PI * 2;
    const a3 = ((i + 0.62) / teeth) * Math.PI * 2;
    const a4 = ((i + 0.82) / teeth) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.cos(a0) * root, Math.sin(a0) * root);
    else s.lineTo(Math.cos(a0) * root, Math.sin(a0) * root);
    s.lineTo(Math.cos(a1) * tip, Math.sin(a1) * tip);
    s.lineTo(Math.cos(a2) * tip, Math.sin(a2) * tip);
    s.lineTo(Math.cos(a3) * root, Math.sin(a3) * root);
    s.lineTo(Math.cos(a4) * root, Math.sin(a4) * root);
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR ?? Math.max(0.011, r * 0.35), 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  return geo;
}

function crankArm(M, side) {
  // Forged alloy arm: lofted rounded profile, wide at the spindle and
  // tapering toward the pedal eye.
  const grp = new THREE.Group();
  const profile = new THREE.Shape();
  const w0 = 0.0165, w1 = 0.0115;          // half-heights at each end
  profile.moveTo(0, w0);
  profile.bezierCurveTo(CRANK_LEN * 0.4, w0 * 0.82, CRANK_LEN * 0.7, w1 * 1.1, CRANK_LEN, w1);
  profile.absarc(CRANK_LEN, 0, w1, Math.PI / 2, -Math.PI / 2, true);
  profile.bezierCurveTo(CRANK_LEN * 0.7, -w1 * 1.1, CRANK_LEN * 0.4, -w0 * 0.82, 0, -w0);
  profile.absarc(0, 0, w0, -Math.PI / 2, Math.PI / 2, true);
  const geo = new THREE.ExtrudeGeometry(profile, {
    depth: 0.011, bevelEnabled: true, bevelThickness: 0.0022, bevelSize: 0.0022, bevelSegments: 3,
  });
  geo.translate(0, 0, -0.0055);
  const arm = new THREE.Mesh(geo, M.crank);
  grp.add(arm);
  // Spindle boss + crank bolt
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0175, 0.018, 18), M.crank);
  boss.rotation.x = Math.PI / 2;
  grp.add(boss);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 12), M.steel);
  bolt.rotation.x = Math.PI / 2;
  bolt.position.z = side * 0.010;
  grp.add(bolt);
  grp.userData.side = side;
  return grp;
}

function platformPedal(M) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.078), M.black);
  grp.add(body);
  const axleTube = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.085, 12), M.steel);
  axleTube.rotation.x = Math.PI / 2;
  grp.add(axleTube);
  // grip studs
  const studGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 0.0225, 6);
  for (const sx of [-0.035, 0, 0.035]) {
    for (const sz of [-0.028, 0.028]) {
      const stud = new THREE.Mesh(studGeo, M.darkSteel);
      stud.position.set(sx, 0, sz);
      grp.add(stud);
    }
  }
  return grp;
}

export function buildDrivetrain(M, rearWheelSpin) {
  const group = new THREE.Group();
  group.name = 'drivetrain';

  // --- Crank assembly: rotates about Z at the BB
  const crank = new THREE.Group();
  crank.position.copy(BB);
  group.add(crank);

  // Spindle
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.115, 14), M.steel);
  spindle.rotation.x = Math.PI / 2;
  crank.add(spindle);

  const pedals = [];
  for (const side of [1, -1]) {                  // 1 = drive side (+Z)
    const arm = crankArm(M, side);
    arm.position.z = side * 0.0635;
    arm.rotation.z = side === 1 ? 0 : Math.PI;   // arms opposed
    crank.add(arm);
    // Pedal: child of the arm at its tip, counter-rotated each frame to stay level
    const pedal = platformPedal(M);
    pedal.position.set(CRANK_LEN, 0, side * 0.052);
    arm.add(pedal);
    pedals.push({ arm, pedal, side });
  }

  // --- Chainrings on a 4-arm spider (drive side)
  const big = new THREE.Mesh(sprocketGeometry(50, 0.0024, { holeR: 0.040 }), M.chainring);
  big.position.z = CHAINLINE_Z;
  crank.add(big);
  const small = new THREE.Mesh(sprocketGeometry(34, 0.0024, { holeR: 0.030 }), M.chainring);
  small.position.z = CHAINLINE_Z - 0.0085;
  crank.add(small);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const armLen = CHAINRING_R * 0.78;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.017, 0.006), M.crank);
    sp.position.set(Math.cos(a) * armLen * 0.55, Math.sin(a) * armLen * 0.55, CHAINLINE_Z - 0.0042);
    sp.rotation.z = a;
    crank.add(sp);
  }

  // --- Cassette: 10 toothed cogs + spacers + lockring, spins with rear wheel
  const cassette = new THREE.Group();
  CASSETTE.forEach((t, i) => {
    const cog = new THREE.Mesh(sprocketGeometry(t, 0.0018, { holeR: 0.0165, toothDepth: 0.0040 }), M.brushedAlu);
    cog.position.z = CASSETTE_Z0 + i * CASSETTE_DZ;
    cassette.add(cog);
    if (i < CASSETTE.length - 1) {
      const spacer = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.0021, 18), M.black);
      spacer.rotation.x = Math.PI / 2;
      spacer.position.z = CASSETTE_Z0 + (i + 0.5) * CASSETTE_DZ;
      cassette.add(spacer);
    }
  });
  const lockring = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.0165, 0.004, 18), M.steel);
  lockring.rotation.x = Math.PI / 2;
  lockring.position.z = CASSETTE_Z0 + CASSETTE.length * CASSETTE_DZ;
  cassette.add(lockring);
  rearWheelSpin.add(cassette); // wheel-local frame == axle frame

  // --- Rear derailleur ---------------------------------------------------
  // Pulley centres in world XY (z = chainline); exported for the chain path.
  const G = new THREE.Vector3(REAR_AXLE.x + 0.030, REAR_AXLE.y - 0.064, CHAINLINE_Z); // guide
  const T = new THREE.Vector3(G.x + 0.014, G.y - 0.064, CHAINLINE_Z);                 // tension

  const rd = new THREE.Group();
  group.add(rd);
  // Hanger + B-knuckle
  const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.032, 0.005), M.darkSteel);
  hanger.position.set(REAR_AXLE.x + 0.006, REAR_AXLE.y - 0.020, 0.040);
  rd.add(hanger);
  const bKnuckle = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), M.crank);
  bKnuckle.position.set(REAR_AXLE.x + 0.008, REAR_AXLE.y - 0.036, 0.043);
  rd.add(bKnuckle);
  // Parallelogram body angling outward/down to the P-knuckle
  const pKnuckle = new THREE.Vector3(G.x - 0.006, G.y + 0.013, CHAINLINE_Z + 0.004);
  const body = curveTube([bKnuckle.position.clone(), pKnuckle], 0.0085, M.crank, 8, 10);
  rd.add(body);
  const plate1 = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.016, 0.0045), M.crank);
  plate1.position.copy(bKnuckle.position).lerp(pKnuckle, 0.5);
  plate1.lookAt(pKnuckle);
  rd.add(plate1);

  // Cage: two contoured plates joining G and T, pulleys sandwiched between
  const cageDir = T.clone().sub(G);
  const cageAngle = Math.atan2(cageDir.y, cageDir.x);
  const cageL = cageDir.length();
  const jockeys = [];
  const plateShape = new THREE.Shape();
  // Rounded dog-bone plate in local coords: G at (0,0), T at (cageL, 0)
  plateShape.absarc(0, 0, 0.0165, Math.PI / 2, -Math.PI / 2, false);
  plateShape.lineTo(cageL, -0.0145);
  plateShape.absarc(cageL, 0, 0.0145, -Math.PI / 2, Math.PI / 2, false);
  plateShape.lineTo(0, 0.0165);
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.0022, bevelEnabled: false });
  for (const zoff of [0.0068, -0.0068]) {
    const plate = new THREE.Mesh(plateGeo, M.crank);
    plate.position.copy(G).add(new THREE.Vector3(0, 0, zoff - 0.0011));
    plate.rotation.z = cageAngle;
    rd.add(plate);
  }
  for (const centre of [G, T]) {
    const jw = new THREE.Mesh(sprocketGeometry(11, 0.0040, { holeR: 0.0045, toothDepth: 0.0034 }), M.darkSteel);
    jw.position.copy(centre);
    rd.add(jw);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.0055, 12), M.black);
    hubCap.rotation.x = Math.PI / 2;
    hubCap.position.copy(centre);
    rd.add(hubCap);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.016, 10), M.steel);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.copy(centre);
    rd.add(bolt);
    jockeys.push(jw);
  }

  // --- Front derailleur: seat tube clamp + cage over the big ring's top rear
  const fd = new THREE.Group();
  group.add(fd);
  const clampPos = BB.clone().addScaledVector(SEAT_UP, 0.115);
  const fdClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.014, 16), M.crank);
  fdClamp.position.copy(clampPos);
  fdClamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SEAT_UP);
  fd.add(fdClamp);
  // Cage plates: stamped-steel annular arcs straddling the chain's top run
  const cageCentre = new THREE.Vector3(BB.x - 0.024, BB.y + CHAINRING_R + 0.011, CHAINLINE_Z);
  const arc0 = Math.PI * 0.38, arc1 = Math.PI * 0.86;
  for (const [zoff, h] of [[0.0105, 0.024], [-0.0075, 0.019]]) {
    const sh = new THREE.Shape();
    const rIn = CHAINRING_R + 0.006, rOut = rIn + h;
    sh.absarc(0, 0, rOut, arc0, arc1, false);
    sh.absarc(0, 0, rIn, arc1, arc0, true);
    sh.closePath();
    const plate = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sh, { depth: 0.0016, bevelEnabled: false }), M.steel);
    plate.position.set(BB.x, BB.y + 0.002, CHAINLINE_Z + zoff);
    fd.add(plate);
  }
  // Cage bridge + link body back to the clamp
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.020), M.steel);
  bridge.position.set(BB.x + Math.cos(arc1 - 0.06) * (CHAINRING_R + 0.016),
    BB.y + Math.sin(arc1 - 0.06) * (CHAINRING_R + 0.016), CHAINLINE_Z + 0.0015);
  fd.add(bridge);
  const fdLink = curveTube([clampPos.clone().add(new THREE.Vector3(0.01, 0, 0.01)), cageCentre.clone().add(new THREE.Vector3(0.005, 0.012, 0))], 0.006, M.crank, 8, 8);
  fd.add(fdLink);

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group, crank, pedals, cassette,
    pulleys: { guide: G, tension: T },
    jockeys,
  };
}
