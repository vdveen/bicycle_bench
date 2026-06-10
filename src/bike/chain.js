import * as THREE from 'three';
import { BB, REAR_AXLE, CHAINRING_R, COG_R, JOCKEY_R, CHAIN_PITCH, CHAINLINE_Z } from './geo.js';

// ---------------------------------------------------------------------------
// Chain: exact belt-path around four "pulleys" (chainring, engaged cog,
// guide + tension jockey wheels), solved with common-tangent geometry, then
// populated with instanced roller-chain links that slide along the path.
//
// Winding convention: +1 = counter-clockwise when viewed from +Z (drive side).
// Traversal order follows chain travel while pedalling forward:
//   cog (cw) → chainring (cw) → tension pulley (cw) → guide pulley (ccw) → cog
// ---------------------------------------------------------------------------

const rot90 = (v) => new THREE.Vector2(-v.y, v.x);          // +90° (ccw)
const rotN90 = (v) => new THREE.Vector2(v.y, -v.x);         // -90°

// Common tangent from circle A to circle B respecting windings sa, sb.
function tangent(a, ra, sa, b, rb, sb) {
  const d = new THREE.Vector2(b.x - a.x, b.y - a.y);
  const L = d.length();
  const m = ra * sa - rb * sb;
  const theta = Math.asin(THREE.MathUtils.clamp(m / L, -1, 1));
  const dHat = d.clone().normalize();
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const u = new THREE.Vector2(dHat.x * cos - dHat.y * sin, dHat.x * sin + dHat.y * cos);
  const na = rotN90(u).multiplyScalar(sa);
  const nb = rotN90(u).multiplyScalar(sb);
  return {
    pa: new THREE.Vector2(a.x + na.x * ra, a.y + na.y * ra),
    pb: new THREE.Vector2(b.x + nb.x * rb, b.y + nb.y * rb),
    na, nb,
  };
}

// Sample the closed path: arcs on each pulley + straight runs between them.
// Returns { points: Vector2[], total } with fine, even-ish spacing.
export function solveChainPath(pulleys) {
  // pulleys: [{ c: Vector2, r, s }]
  const n = pulleys.length;
  const tangents = [];
  for (let i = 0; i < n; i++) {
    const A = pulleys[i], B = pulleys[(i + 1) % n];
    tangents.push(tangent(A.c, A.r, A.s, B.c, B.r, B.s));
  }
  const pts = [];
  for (let i = 0; i < n; i++) {
    const P = pulleys[i];
    // Arc on pulley i: from arrival normal (tangent i-1 .nb) to departure (tangent i .na)
    const nIn = tangents[(i - 1 + n) % n].nb;
    const nOut = tangents[i].na;
    let a0 = Math.atan2(nIn.y, nIn.x);
    let a1 = Math.atan2(nOut.y, nOut.x);
    let da = a1 - a0;
    if (P.s > 0) { while (da < 0) da += Math.PI * 2; }       // ccw: increase
    else { while (da > 0) da -= Math.PI * 2; }               // cw: decrease
    const steps = Math.max(2, Math.ceil(Math.abs(da) / 0.06));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (da * k) / steps;
      pts.push(new THREE.Vector2(P.c.x + Math.cos(a) * P.r, P.c.y + Math.sin(a) * P.r));
    }
    // Straight run to next pulley
    pts.push(tangents[i].pb.clone());
  }
  // Cumulative arc length
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1] + pts[pts.length - 1].distanceTo(pts[0]);
  return { pts, cum, total };
}

function samplePath(path, s) {
  const { pts, cum, total } = path;
  s = ((s % total) + total) % total;
  // binary search
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid - 1;
  }
  const i = lo;
  const j = (i + 1) % pts.length;
  const segLen = (i + 1 < cum.length ? cum[i + 1] : total) - cum[i];
  const t = segLen > 1e-9 ? (s - cum[i]) / segLen : 0;
  const p = pts[i].clone().lerp(pts[j], t);
  const tan = new THREE.Vector2(pts[j].x - pts[i].x, pts[j].y - pts[i].y).normalize();
  return { p, tan };
}

export function buildChain(M, pulleyCentres) {
  const pulleys = [
    { c: new THREE.Vector2(REAR_AXLE.x, REAR_AXLE.y), r: COG_R, s: -1 },
    { c: new THREE.Vector2(BB.x, BB.y), r: CHAINRING_R, s: -1 },
    { c: new THREE.Vector2(pulleyCentres.tension.x, pulleyCentres.tension.y), r: JOCKEY_R, s: -1 },
    { c: new THREE.Vector2(pulleyCentres.guide.x, pulleyCentres.guide.y), r: JOCKEY_R, s: 1 },
  ];
  const path = solveChainPath(pulleys);
  const linkCount = Math.round(path.total / CHAIN_PITCH);
  const pitch = path.total / linkCount;

  // Link geometry: outer/inner plate pairs + rollers + pins
  const plateGeo = new THREE.BoxGeometry(CHAIN_PITCH + 0.004, 0.0085, 0.0009);
  const rollerGeo = new THREE.CylinderGeometry(0.0038, 0.0038, 0.0058, 10);
  rollerGeo.rotateX(Math.PI / 2);
  const pinGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 0.0092, 8);
  pinGeo.rotateX(Math.PI / 2);

  const half = Math.ceil(linkCount / 2);
  const outerPlates = new THREE.InstancedMesh(plateGeo, M.darkSteel, half * 2);
  const innerPlates = new THREE.InstancedMesh(plateGeo, M.darkSteel, half * 2);
  const rollers = new THREE.InstancedMesh(rollerGeo, M.darkSteel, linkCount);
  const pins = new THREE.InstancedMesh(pinGeo, M.steel, linkCount);
  const group = new THREE.Group();
  group.name = 'chain';
  group.add(outerPlates, innerPlates, rollers, pins);
  for (const im of [outerPlates, innerPlates, rollers, pins]) {
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = true;
  }

  const mat = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const zAxis = new THREE.Vector3(0, 0, 1);

  function update(offset) {
    let oi = 0, ii = 0;
    for (let i = 0; i < linkCount; i++) {
      const s0 = offset + i * pitch;
      const a = samplePath(path, s0);
      const b = samplePath(path, s0 + pitch);
      // Roller + pin at each articulation point
      pos.set(a.p.x, a.p.y, CHAINLINE_Z);
      quat.identity();
      mat.compose(pos, quat, scl);
      rollers.setMatrixAt(i, mat);
      pins.setMatrixAt(i, mat);
      // Plate pair spanning a -> b
      const mid = new THREE.Vector3((a.p.x + b.p.x) / 2, (a.p.y + b.p.y) / 2, CHAINLINE_Z);
      const ang = Math.atan2(b.p.y - a.p.y, b.p.x - a.p.x);
      quat.setFromAxisAngle(zAxis, ang);
      const isOuter = i % 2 === 0;
      const zo = isOuter ? 0.0042 : 0.0028;
      for (const sideZ of [zo, -zo]) {
        pos.copy(mid); pos.z = CHAINLINE_Z + sideZ;
        mat.compose(pos, quat, scl);
        if (isOuter) outerPlates.setMatrixAt(oi++, mat);
        else innerPlates.setMatrixAt(ii++, mat);
      }
    }
    outerPlates.instanceMatrix.needsUpdate = true;
    innerPlates.instanceMatrix.needsUpdate = true;
    rollers.instanceMatrix.needsUpdate = true;
    pins.instanceMatrix.needsUpdate = true;
  }

  update(0);
  return { group, update, path, linkCount };
}
