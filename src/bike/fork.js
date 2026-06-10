import * as THREE from 'three';
import {
  HEAD_TUBE_BOT, HEAD_TUBE_LEN, STEER_UP, FORK_LEN, FORK_OFFSET,
  STEM_LEN, STEM_RISE, SPACER_STACK, BAR_WIDTH, TUBES, curveTube,
} from './geo.js';

// ---------------------------------------------------------------------------
// Steering assembly: full-carbon fork (tapered steerer, sculpted crown,
// raked blades, hooded dropouts) + stem, flat bar, grips, brake levers.
//
// The returned `steer` group is positioned at the bottom of the head tube
// with its local +Y along the steering axis; rotating steer.rotation.y
// turns the whole assembly. Everything inside is built in that local frame:
//   local Y = up the steering axis, local X = forward (rake direction).
// ---------------------------------------------------------------------------

export function buildSteering(M) {
  const steer = new THREE.Group();
  steer.name = 'steering';
  steer.position.copy(HEAD_TUBE_BOT);
  steer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), STEER_UP);

  const crownY = -0.012;
  const axleLocal = new THREE.Vector3(FORK_OFFSET, crownY - FORK_LEN + 0.0,  0);
  // NOTE: blades run from crown to axle; rake is achieved by the curve, the
  // axle point itself includes the full offset.

  // --- Steerer (inside head tube) + tapered lower section
  const steerer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0142, 0.019, HEAD_TUBE_LEN + SPACER_STACK + 0.03, 20), M.carbon);
  steerer.position.y = crownY + (HEAD_TUBE_LEN + SPACER_STACK + 0.03) / 2;
  steer.add(steerer);

  // Headset spacers + top cap (one thin red accent ring)
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.0075, 20), M.black);
    sp.position.y = HEAD_TUBE_LEN + 0.006 + i * 0.008;
    steer.add(sp);
  }
  const accentRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0167, 0.0167, 0.0028, 20), M.accent);
  accentRing.position.y = HEAD_TUBE_LEN + 0.014;
  steer.add(accentRing);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0162, 0.017, 0.006, 20), M.darkSteel);
  cap.position.y = HEAD_TUBE_LEN + SPACER_STACK + 0.024;
  steer.add(cap);

  // --- Crown: sculpted carbon block blending steerer into the blades
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), M.carbon);
  crown.position.set(0.004, crownY - 0.008, 0);
  crown.scale.set(1.15, 0.85, 2.0);
  crown.castShadow = true;
  steer.add(crown);

  // --- Blades: curve from crown shoulders down to hooded dropouts
  for (const side of [1, -1]) {
    const z = side * 0.044;
    const blade = curveTube([
      new THREE.Vector3(0.004, crownY - 0.018, side * 0.036),
      new THREE.Vector3(0.012, crownY - 0.12, z),
      new THREE.Vector3(0.026, crownY - 0.26, z),
      new THREE.Vector3(FORK_OFFSET - 0.002, axleLocal.y + 0.035, z),
    ], TUBES.forkR0, M.carbon, 36, 14);
    steer.add(blade);

    // Hooded fork dropout
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 10), M.carbon);
    hood.position.set(FORK_OFFSET, axleLocal.y + 0.012, z);
    hood.scale.set(1.0, 2.0, 0.7);
    steer.add(hood);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.022, 0.006), M.darkSteel);
    tab.position.set(FORK_OFFSET, axleLocal.y + 0.002, z);
    steer.add(tab);
  }

  // --- Stem: forged alloy, slight rise
  const stemBase = new THREE.Vector3(0, HEAD_TUBE_LEN + SPACER_STACK + 0.013, 0);
  const stemTip = stemBase.clone().add(new THREE.Vector3(
    Math.cos(STEM_RISE) * STEM_LEN, Math.sin(STEM_RISE) * STEM_LEN, 0));
  const stemBody = new THREE.Mesh(new THREE.BoxGeometry(STEM_LEN, 0.026, 0.030), M.crank);
  stemBody.position.copy(stemBase).lerp(stemTip, 0.5);
  stemBody.rotation.z = STEM_RISE;
  stemBody.castShadow = true;
  steer.add(stemBody);
  // Steerer clamp collar + faceplate
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.038, 18), M.crank);
  collar.position.copy(stemBase);
  steer.add(collar);
  const faceplate = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.030, 0.034), M.crank);
  faceplate.position.copy(stemTip);
  steer.add(faceplate);

  // --- Flat handlebar with 9° backsweep, slight rise at the ends
  const barPts = [];
  const half = BAR_WIDTH / 2;
  const sweep = 9 * Math.PI / 180;
  for (const t of [-1, -0.72, -0.3, 0, 0.3, 0.72, 1]) {
    const z = t * half;
    const back = -Math.sin(sweep) * Math.max(0, Math.abs(t) - 0.25) * half * 1.3;
    barPts.push(stemTip.clone().add(new THREE.Vector3(back, Math.abs(t) * 0.004, z)));
  }
  const bar = curveTube(barPts, TUBES.barR, M.crank, 48, 14);
  steer.add(bar);

  // --- Grips (lock-on rubber with alloy collars)
  const leverPivots = [];
  for (const side of [1, -1]) {
    const gz = side * (half - 0.065);
    const gripCentre = stemTip.clone().add(new THREE.Vector3(
      -Math.sin(sweep) * (Math.abs(half - 0.065) - 0.25 * half) * 1.3, 0.0038, gz + side * 0.0));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.125, 16), M.grip);
    grip.rotation.x = Math.PI / 2;
    grip.position.copy(gripCentre).add(new THREE.Vector3(0, 0, side * 0.062 - side * 0.062 + side * 0.0));
    grip.position.z = gz + side * 0.0;
    steer.add(grip);
    for (const e of [1, -1]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0160, 0.0160, 0.0035, 16),
        e === side ? M.accent : M.black);
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(grip.position).add(new THREE.Vector3(0, 0, e * 0.0635));
      steer.add(ring);
    }

    // --- Brake lever: clamp + pivoting blade
    const clampPos = gripCentre.clone().add(new THREE.Vector3(0, 0, -side * 0.075));
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.018, 14), M.black);
    clamp.rotation.x = Math.PI / 2;
    clamp.position.copy(clampPos);
    steer.add(clamp);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.020, 0.018), M.black);
    body.position.copy(clampPos).add(new THREE.Vector3(0.020, -0.004, 0));
    steer.add(body);

    // Lever pivot group: blade rotates about Z through the body front
    const pivot = new THREE.Group();
    pivot.position.copy(clampPos).add(new THREE.Vector3(0.034, -0.006, 0));
    steer.add(pivot);
    const blade = curveTube([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.035, -0.006, side * 0.004),
      new THREE.Vector3(0.068, -0.018, side * 0.006),
    ], 0.0048, M.darkSteel, 16, 10);
    blade.scale.z = 1.6;
    pivot.add(blade);
    leverPivots.push(pivot);

    // Cable exits the lever body downward — anchor point for brakes module
    pivot.userData.cableAnchorLocal = clampPos.clone().add(new THREE.Vector3(0.012, -0.014, 0));
  }

  // Bar end plugs
  for (const side of [1, -1]) {
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.004, 14), M.black);
    plug.rotation.x = Math.PI / 2;
    plug.position.copy(barPts[side === 1 ? 6 : 0]).add(new THREE.Vector3(0, 0, side * 0.002));
    steer.add(plug);
  }

  steer.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return { steer, axleLocal, leverPivots, stemTipLocal: stemTip };
}
