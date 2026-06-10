import * as THREE from 'three';
import { WHEEL } from './geo.js';

// ---------------------------------------------------------------------------
// Wheelset: semi-aero alloy rim with machined brake track, 28h 3-cross laced
// round spokes with nipples, low-flange hubs, 700x28c tires, valve stems.
// Wheel group origin = axle; rotating `spin` about Z spins the wheel.
// ---------------------------------------------------------------------------

function rimGeometry() {
  // Lathe profile of an aero-ish box rim, revolved about Y then re-axed to Z.
  const { rimOuterR: R, rimDepth: D, rimWidth: W } = WHEEL;
  const pts = [
    new THREE.Vector2(R, W * 0.40),          // bead hook, right side
    new THREE.Vector2(R - 0.004, W * 0.50),  // brake track right
    new THREE.Vector2(R - 0.013, W * 0.50),
    new THREE.Vector2(R - D, W * 0.16),      // taper to spoke bed
    new THREE.Vector2(R - D, -W * 0.16),
    new THREE.Vector2(R - 0.013, -W * 0.50),
    new THREE.Vector2(R - 0.004, -W * 0.50), // brake track left
    new THREE.Vector2(R, -W * 0.40),         // bead hook, left
    new THREE.Vector2(R, W * 0.40),
  ];
  const geo = new THREE.LatheGeometry(pts, 64);
  geo.rotateX(Math.PI / 2); // axis Y -> Z
  return geo;
}

function brakeTrackMesh(M) {
  // Machined sidewall band where the pads bite
  const { rimOuterR: R, rimWidth: W } = WHEEL;
  const grp = new THREE.Group();
  for (const side of [1, -1]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(R - 0.0125, R - 0.0035, 64), M.brakeTrack);
    ring.position.z = side * (W * 0.5 + 0.0002);
    if (side === -1) ring.rotation.y = Math.PI;
    grp.add(ring);
  }
  return grp;
}

export function buildWheel(M, { rear = false } = {}) {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  group.name = rear ? 'rearWheel' : 'frontWheel';

  // Rear hubs are asymmetric: the drive-side flange sits inboard so the
  // cassette (z ≈ 0.027..0.062) clears it.
  const flangeZ = (side) => (rear && side > 0) ? 0.018 : side * WHEEL.hubFlangeZ;

  // --- Tire
  const tireCentreR = WHEEL.tireOuterR - WHEEL.tireTubeR;
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(tireCentreR, WHEEL.tireTubeR, 30, 140), M.tire);
  tire.castShadow = true;
  spin.add(tire);

  // --- Rim + brake track
  const rim = new THREE.Mesh(rimGeometry(), M.rim);
  rim.castShadow = true;
  spin.add(rim);
  spin.add(brakeTrackMesh(M));

  // --- Hub: body + flanges + end caps
  const hubBody = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL.hubBodyR, WHEEL.hubBodyR, WHEEL.hubFlangeZ * 2 - 0.008, 20), M.hub);
  hubBody.rotation.x = Math.PI / 2;
  spin.add(hubBody);
  for (const side of [1, -1]) {
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL.hubFlangeR, WHEEL.hubFlangeR, 0.004, 24), M.hub);
    flange.rotation.x = Math.PI / 2;
    flange.position.z = flangeZ(side);
    spin.add(flange);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, WHEEL.hubBodyR, 0.012, 16), M.hub);
    cone.rotation.x = side === 1 ? Math.PI / 2 : -Math.PI / 2;
    cone.position.z = flangeZ(side) + side * 0.008;
    spin.add(cone);
  }
  // Axle / skewer ends (don't spin, but visually indistinct — keep on group)
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.135, 12), M.steel);
  axle.rotation.x = Math.PI / 2;
  group.add(axle);

  // --- Spokes: 28h, 3-cross, alternating leading/trailing per flange
  const spokeRimR = WHEEL.rimOuterR - WHEEL.rimDepth - 0.001;
  const perFlange = WHEEL.spokeCount / 2;
  const spokeGeo = new THREE.CylinderGeometry(WHEEL.spokeR, WHEEL.spokeR, 1, 6);
  spokeGeo.translate(0, 0.5, 0); // pivot at hub end
  const nippleGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.012, 8);
  const up = new THREE.Vector3(0, 1, 0);

  for (let side = 0; side < 2; side++) {
    const zHub = flangeZ(side === 0 ? 1 : -1);
    const zRim = (side === 0 ? 1 : -1) * 0.0018;
    for (let i = 0; i < perFlange; i++) {
      const hubA = (i / perFlange) * Math.PI * 2 + side * (Math.PI / perFlange);
      const leading = i % 2 === 0 ? 1 : -1;
      const rimA = hubA + leading * 2.6 * (Math.PI * 2 / perFlange);
      const a = new THREE.Vector3(Math.cos(hubA) * WHEEL.hubFlangeR, Math.sin(hubA) * WHEEL.hubFlangeR, zHub);
      const b = new THREE.Vector3(Math.cos(rimA) * spokeRimR, Math.sin(rimA) * spokeRimR, zRim);
      const dir = b.clone().sub(a);
      const spoke = new THREE.Mesh(spokeGeo, M.spoke);
      spoke.position.copy(a);
      spoke.scale.y = dir.length();
      spoke.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      spoke.castShadow = true;
      spin.add(spoke);
      // Nipple seated in the rim bed, aligned with the spoke
      const nip = new THREE.Mesh(nippleGeo, M.brushedAlu);
      nip.position.copy(b).addScaledVector(dir.normalize(), 0.002);
      nip.quaternion.copy(spoke.quaternion);
      spin.add(nip);
    }
  }

  // --- Valve stem
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.035, 8), M.black);
  valve.position.set(0, spokeRimR - 0.012, 0);
  spin.add(valve);

  // --- Sidewall accent stripe (subtle tan-line ring like a kevlar bead)
  for (const side of [1, -1]) {
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(tireCentreR + WHEEL.tireTubeR * 0.42, 0.0011, 6, 80), M.tireWall);
    stripe.position.z = side * WHEEL.tireTubeR * 0.78;
    spin.add(stripe);
  }

  // --- Quick-release skewer: nut + curved lever on the non-drive side
  const qrNut = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.0078, 0.008, 12), M.darkSteel);
  qrNut.rotation.x = Math.PI / 2;
  qrNut.position.z = 0.0712;
  group.add(qrNut);
  const lever = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.042, 4, 10), M.black);
  lever.position.set(0.008, -0.025, -0.069);
  lever.rotation.z = 0.5;
  group.add(lever);
  const leverHead = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 10), M.black);
  leverHead.position.set(-0.004, -0.003, -0.069);
  leverHead.scale.set(1.2, 1, 0.7);
  group.add(leverHead);

  return { group, spin };
}
