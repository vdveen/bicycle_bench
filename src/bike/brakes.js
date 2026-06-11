import * as THREE from 'three';
import {
  REAR_AXLE, SS_TOP, TT_FRONT, TT_REAR, HEAD_TUBE_TOP, STEER_UP, FORK_OFFSET,
  WHEEL, curveTube,
} from './geo.js';

// ---------------------------------------------------------------------------
// Dual-pivot road calipers (front on the fork crown, rear on the seatstay
// bridge) with pads on the brake track, plus full cable runs from the levers.
// squeeze(t) closes the pads; t in [0,1].
// ---------------------------------------------------------------------------

// Caliper local frame: origin at mounting bolt, -Y points at the axle,
// wheel plane is z = 0.
function buildCaliper(M) {
  const grp = new THREE.Group();
  const arms = [];

  // Mounting bolt runs fore-aft (local X) through the crown / bridge
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.030, 12), M.steel);
  bolt.rotation.z = Math.PI / 2;
  grp.add(bolt);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.016, 14), M.darkSteel);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = 0.006;
  grp.add(barrel);

  for (const side of [1, -1]) {
    // Dual-pivot: arms swing about the fore-aft axis so pads close on the rim
    const arm = new THREE.Group();
    grp.add(arm);
    const tube = curveTube([
      new THREE.Vector3(0, 0.014, -side * 0.004),
      new THREE.Vector3(0.002, 0.004, side * 0.018),
      new THREE.Vector3(0.002, -0.024, side * 0.024),
      new THREE.Vector3(0.001, -0.042, side * 0.017),
    ], 0.0058, M.steel, 24, 10);
    tube.scale.x = 1.5;   // flatten fore-aft into a forged-arm look
    arm.add(tube);
    // Pad holder + pad (pad face ~1.5 mm off the brake track at rest)
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.011, 0.0045), M.black);
    pad.position.set(0, -0.0485, side * 0.0145);
    arm.add(pad);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.013, 0.002), M.darkSteel);
    shoe.position.set(0, -0.0485, side * 0.0175);
    arm.add(shoe);
    arms.push(arm);
  }

  // Barrel adjuster + cable stop on top
  const adj = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 10), M.steel);
  adj.position.set(0, 0.022, -0.004);
  grp.add(adj);

  function squeeze(t) {
    arms[0].rotation.x = t * 0.055;    // +z arm closes inward
    arms[1].rotation.x = -t * 0.055;
  }
  return { grp, squeeze };
}

export function buildBrakes(M, steerGroup, axleLocal, leverPivots) {
  const world = new THREE.Group();
  world.name = 'brakes';

  // --- Front caliper: mounted ahead of the fork crown, steers with the fork
  const front = buildCaliper(M);
  front.grp.position.set(FORK_OFFSET, axleLocal.y + 0.360, 0);
  steerGroup.add(front.grp);

  // --- Rear caliper: on a seatstay bridge above the tire
  const rear = buildCaliper(M);
  const toCluster = SS_TOP.clone().sub(REAR_AXLE).normalize();
  const rearBolt = REAR_AXLE.clone().addScaledVector(toCluster, 0.360);
  rear.grp.position.copy(rearBolt);
  // Rotate so local -Y points at the axle
  const down = REAR_AXLE.clone().sub(rearBolt).normalize();
  rear.grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), down);
  world.add(rear.grp);

  // Seatstay bridge
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.062, 10), M.frame);
  bridge.position.copy(rearBolt).addScaledVector(toCluster, 0.012);
  bridge.rotation.x = Math.PI / 2;
  world.add(bridge);

  // --- Cables -------------------------------------------------------------
  // Front: left lever -> sweeping arc down in front of the head tube ->
  // front caliper. Lives in the steering frame so it turns with the bars.
  const frontAnchor = leverPivots[1].userData.cableAnchorLocal; // left side (-z)
  const frontCable = curveTube([
    frontAnchor.clone(),
    frontAnchor.clone().add(new THREE.Vector3(0.035, -0.045, 0.01)),
    new THREE.Vector3(0.046, 0.10, -0.012),
    new THREE.Vector3(0.030, 0.024, -0.004),
    front.grp.position.clone().add(new THREE.Vector3(-0.011, 0.030, 0.006)),
  ], 0.0023, M.cable, 40, 8);
  steerGroup.add(frontCable);

  // Rear: right lever -> along the top tube -> seat cluster -> rear caliper.
  // Built in world space at neutral steering.
  const steerPos = steerGroup.position;
  const rightAnchorWorld = leverPivots[0].userData.cableAnchorLocal.clone()
    .applyQuaternion(steerGroup.quaternion).add(steerPos);
  const ttDir = TT_REAR.clone().sub(TT_FRONT).normalize();
  const rearCable = curveTube([
    rightAnchorWorld,
    rightAnchorWorld.clone().add(new THREE.Vector3(0.02, -0.06, 0.012)),
    TT_FRONT.clone().add(new THREE.Vector3(0.012, 0.018, 0.014)),
    TT_FRONT.clone().lerp(TT_REAR, 0.5).add(new THREE.Vector3(0, 0.016, 0.013)),
    TT_REAR.clone().add(new THREE.Vector3(0.005, 0.014, 0.010)),
    rearBolt.clone().add(new THREE.Vector3(-0.005, 0.055, 0.008)),
    rearBolt.clone().add(new THREE.Vector3(-0.011, 0.028, 0.005)),
  ], 0.0023, M.cable, 56, 8);
  world.add(rearCable);

  // Cable ferrules: small alloy caps where housing meets lever/caliper
  const ferruleGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.007, 10);
  const addFerrule = (parent, pos, dir) => {
    const f = new THREE.Mesh(ferruleGeo, M.steel);
    f.position.copy(pos);
    f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    parent.add(f);
  };
  addFerrule(steerGroup, frontAnchor.clone().add(new THREE.Vector3(0.004, -0.004, 0)), new THREE.Vector3(0.5, -0.8, 0));
  addFerrule(steerGroup, front.grp.position.clone().add(new THREE.Vector3(-0.011, 0.027, 0.006)), new THREE.Vector3(0.2, 1, -0.1));
  addFerrule(world, rightAnchorWorld.clone().add(new THREE.Vector3(0.004, -0.006, 0.002)), new THREE.Vector3(0.3, -0.9, 0.1));
  addFerrule(world, rearBolt.clone().add(new THREE.Vector3(-0.010, 0.026, 0.005)), new THREE.Vector3(0.2, 1, 0.1));

  // Housing guides on the top tube
  for (const t of [0.18, 0.5, 0.82]) {
    const guide = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.006), M.black);
    guide.position.copy(TT_FRONT).lerp(TT_REAR, t).add(new THREE.Vector3(0, 0.014, 0.011));
    guide.rotation.z = Math.atan2(ttDir.y, ttDir.x);
    world.add(guide);
  }

  world.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  steerGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group: world,
    squeeze(t) { front.squeeze(t); rear.squeeze(t); },
  };
}
