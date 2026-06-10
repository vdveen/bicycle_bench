import * as THREE from 'three';
import {
  BB, REAR_AXLE, HEAD_TUBE_BOT, HEAD_TUBE_TOP, SEAT_TUBE_TOP, TT_FRONT, TT_REAR,
  DT_FRONT, SS_TOP, SADDLE_POS, STEER_UP, SEAT_UP, TUBES, taperedTube, curveTube,
} from './geo.js';
import { kogaDecalTexture, f3BadgeTexture } from './materials.js';

// ---------------------------------------------------------------------------
// Frame: main triangle + rear triangle, hydroformed double-butted alloy look.
// Butting is suggested visually with tapered tube profiles and ovalised
// junction reinforcements (wider cross-sections where the walls are thick).
// ---------------------------------------------------------------------------

export function buildFrame(M) {
  const g = new THREE.Group();
  g.name = 'frame';

  // --- Down tube: fat ovalised at BB, tapering to head tube (double-butted look)
  const dt = taperedTube(BB, DT_FRONT, TUBES.downTubeR0, TUBES.downTubeR1, M.frame);
  dt.scale.x = 1.18; // ovalise: deeper than wide in the bend plane... x of cylinder local = radial
  g.add(dt);

  // --- Top tube, slight taper toward the seat cluster
  g.add(taperedTube(TT_FRONT, TT_REAR, TUBES.topTubeR0, TUBES.topTubeR1, M.frame));

  // --- Seat tube
  g.add(taperedTube(BB, SEAT_TUBE_TOP, TUBES.seatTubeR + 0.004, TUBES.seatTubeR, M.frame));

  // --- Head tube: stout, with subtle flares top and bottom
  g.add(taperedTube(HEAD_TUBE_BOT, HEAD_TUBE_TOP, TUBES.headTubeR, TUBES.headTubeR - 0.003, M.frame));
  // Flared cups
  for (const [p, r] of [[HEAD_TUBE_BOT, TUBES.headTubeR + 0.0035], [HEAD_TUBE_TOP, TUBES.headTubeR - 0.0005]]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.014, 24), M.frame);
    cup.position.copy(p);
    cup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), STEER_UP);
    cup.castShadow = true;
    g.add(cup);
  }

  // --- BB shell
  const bbShell = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.083, 28), M.frame);
  bbShell.rotation.x = Math.PI / 2;
  bbShell.position.copy(BB);
  bbShell.castShadow = true;
  g.add(bbShell);

  // --- Junction gussets (hydroformed reinforcement bulges)
  const dtDir = DT_FRONT.clone().sub(BB).normalize();
  const gusset = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 16), M.frame);
  gusset.position.copy(BB).addScaledVector(dtDir, 0.025);
  gusset.scale.set(1.6, 1.0, 0.95);
  gusset.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dtDir);
  g.add(gusset);

  const seatCluster = new THREE.Mesh(new THREE.SphereGeometry(0.019, 20, 16), M.frame);
  seatCluster.position.copy(TT_REAR);
  seatCluster.scale.set(1.25, 1.25, 1.0);
  g.add(seatCluster);

  // --- Chainstays: curve outward around the tire, taper to dropouts
  for (const side of [1, -1]) {
    const z = side * 0.035;
    const stay = curveTube([
      BB.clone().add(new THREE.Vector3(0.005, -0.004, side * 0.028)),
      new THREE.Vector3(-0.14, 0.295, z + side * 0.012),
      new THREE.Vector3(-0.30, 0.32, z),
      REAR_AXLE.clone().add(new THREE.Vector3(0.012, 0.002, side * 0.030)),
    ], TUBES.chainstayR0, M.frame, 40, 14);
    g.add(stay);

    // Seatstays: slim, slightly arced
    const ss = curveTube([
      SS_TOP.clone().add(new THREE.Vector3(0, 0, side * 0.013)),
      new THREE.Vector3(-0.27, 0.55, side * 0.030),
      REAR_AXLE.clone().add(new THREE.Vector3(0.004, 0.012, side * 0.030)),
    ], TUBES.seatstayR0, M.frame, 32, 12);
    g.add(ss);

    // --- Rear dropouts: forged plates joining stay ends
    const dropout = buildDropout(M);
    dropout.position.copy(REAR_AXLE).add(new THREE.Vector3(0, 0, side * 0.0335));
    dropout.rotation.y = side === 1 ? 0 : Math.PI;
    g.add(dropout);
  }

  // --- Seat clamp + seatpost + saddle
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(TUBES.seatTubeR + 0.0035, TUBES.seatTubeR + 0.0035, 0.012, 20), M.darkSteel);
  clamp.position.copy(SEAT_TUBE_TOP);
  clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SEAT_UP);
  g.add(clamp);

  const post = taperedTube(
    SEAT_TUBE_TOP.clone().addScaledVector(SEAT_UP, -0.02),
    SADDLE_POS.clone().addScaledVector(SEAT_UP, -0.02),
    TUBES.seatpostR, TUBES.seatpostR, M.carbon);
  g.add(post);

  g.add(buildSaddle(M));

  // --- Decals
  addDecals(g, M);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}

function buildDropout(M) {
  // Forged alloy dropout plate: rounded quadrilateral with axle hole boss
  const s = new THREE.Shape();
  s.moveTo(-0.012, 0.030);
  s.quadraticCurveTo(0.022, 0.030, 0.026, 0.008);
  s.quadraticCurveTo(0.028, -0.012, 0.012, -0.016);
  s.quadraticCurveTo(-0.008, -0.020, -0.020, -0.006);
  s.quadraticCurveTo(-0.030, 0.006, -0.024, 0.018);
  s.quadraticCurveTo(-0.020, 0.028, -0.012, 0.030);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0055, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2 });
  geo.translate(0, 0, -0.0035);
  const m = new THREE.Mesh(geo, M.darkSteel);
  m.castShadow = true;
  const grp = new THREE.Group();
  grp.add(m);
  return grp;
}

function buildSaddle(M) {
  const grp = new THREE.Group();
  // Saddle shell: lathe-ish shape via scaled sphere halves; nose forward +X
  const shellGeo = new THREE.SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const shell = new THREE.Mesh(shellGeo, M.saddle);
  shell.scale.set(0.135, 0.026, 0.062);
  shell.position.copy(SADDLE_POS).add(new THREE.Vector3(-0.01, 0.012, 0));
  grp.add(shell);
  // Nose extension
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.saddle);
  nose.scale.set(0.115, 0.02, 0.030);
  nose.position.copy(SADDLE_POS).add(new THREE.Vector3(0.055, 0.011, 0));
  grp.add(nose);
  // Rails
  for (const side of [1, -1]) {
    const rail = curveTube([
      SADDLE_POS.clone().add(new THREE.Vector3(0.09, 0.006, side * 0.014)),
      SADDLE_POS.clone().add(new THREE.Vector3(0.01, -0.012, side * 0.020)),
      SADDLE_POS.clone().add(new THREE.Vector3(-0.09, 0.004, side * 0.020)),
    ], 0.0035, M.steel, 16, 8);
    grp.add(rail);
  }
  return grp;
}

function addDecals(g, M) {
  // KOGA wordmark on both sides of the down tube
  const tex = kogaDecalTexture();
  const dtDir = DT_FRONT.clone().sub(BB);
  const mid = BB.clone().addScaledVector(dtDir, 0.52);
  const angle = Math.atan2(dtDir.y, dtDir.x);
  for (const side of [1, -1]) {
    const mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, metalness: 0.0, roughness: 0.45,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.0375), mat);
    plane.position.copy(mid).add(new THREE.Vector3(0, 0, side * (TUBES.downTubeR0 * 1.18 * 0.82)));
    plane.rotation.set(0, side === 1 ? 0 : Math.PI, side === 1 ? angle : -angle);
    g.add(plane);
  }

  // F3 badge on the head tube front
  const badgeMat = new THREE.MeshStandardMaterial({
    map: f3BadgeTexture(), transparent: true, metalness: 0.4, roughness: 0.35,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.034), badgeMat);
  const htMid = HEAD_TUBE_BOT.clone().lerp(HEAD_TUBE_TOP, 0.55);
  badge.position.copy(htMid).addScaledVector(new THREE.Vector3(Math.sin(0), 0, 0), 0);
  badge.position.add(new THREE.Vector3(0.0245, 0, 0));
  badge.rotation.y = Math.PI / 2 - Math.PI / 2; // face +X
  badge.rotation.y = 0;
  badge.lookAt(badge.position.clone().add(new THREE.Vector3(1, 0.33, 0)));
  g.add(badge);

  // Seat tube accent band (red) — radius must clear the tube's taper there
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0182, 0.0182, 0.030, 24), M.accent);
  band.position.copy(BB).addScaledVector(SEAT_UP, 0.34);
  band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SEAT_UP);
  g.add(band);
}
