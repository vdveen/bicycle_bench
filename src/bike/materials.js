import * as THREE from 'three';
import { LIVERY } from './geo.js';

// ---------------------------------------------------------------------------
// Physically based materials: satin alloy, brushed aluminum, matte carbon
// weave, rubber. Procedural canvas textures keep everything dependency-free.
// ---------------------------------------------------------------------------

function canvasTexture(size, draw, repeatX = 1, repeatY = 1, srgb = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Fine linear streaks for brushed metal roughness variation
function brushedRoughnessTex() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const y = Math.random() * s;
      const v = 70 + Math.random() * 90 | 0;
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }
  }, 2, 6);
}

// 2x2 twill carbon weave
function carbonTex() {
  return canvasTexture(256, (ctx, s) => {
    const cell = 16;
    for (let y = 0; y < s / cell; y++) {
      for (let x = 0; x < s / cell; x++) {
        const twill = ((x + y) % 4) < 2;
        const base = twill ? 26 : 14;
        const g = ctx.createLinearGradient(
          x * cell, y * cell,
          twill ? (x + 1) * cell : x * cell,
          twill ? y * cell : (y + 1) * cell
        );
        g.addColorStop(0, `rgb(${base + 14},${base + 14},${base + 16})`);
        g.addColorStop(0.5, `rgb(${base},${base},${base + 2})`);
        g.addColorStop(1, `rgb(${base + 10},${base + 10},${base + 12})`);
        ctx.fillStyle = g;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }, 8, 8, true);
}

// Subtle sidewall rubber grain
function rubberBumpTex() {
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4000; i++) {
      const v = 100 + Math.random() * 56 | 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 1.4, 1.4);
    }
  }, 12, 3);
}

export function createMaterials() {
  const brushed = brushedRoughnessTex();
  const carbon = carbonTex();
  const rubberBump = rubberBumpTex();

  const M = {};

  // Satin graphite-black alloy frame (the F3's hydroformed 6061 look)
  M.frame = new THREE.MeshPhysicalMaterial({
    color: LIVERY.frame, metalness: 0.75, roughness: 0.38,
    clearcoat: 0.55, clearcoatRoughness: 0.35,
    roughnessMap: brushed,
  });

  // Raw brushed aluminum (cassette, hub bodies, spoke nipples)
  // NOTE: roughnessMap multiplies base roughness (map avg ≈ 0.4), so the
  // base value here is intentionally high.
  M.brushedAlu = new THREE.MeshPhysicalMaterial({
    color: 0x53585d, metalness: 1.0, roughness: 1.0,
    roughnessMap: brushed, envMapIntensity: 0.32,
  });
  M.brushedAlu.userData.tag = 'brushedAlu';

  // Polished alloy (chain, brake pivots)
  M.steel = new THREE.MeshStandardMaterial({
    color: 0x7a7f84, metalness: 1.0, roughness: 0.42, envMapIntensity: 0.6,
  });

  M.darkSteel = new THREE.MeshStandardMaterial({
    color: 0x4a4e53, metalness: 0.95, roughness: 0.45,
  });

  // Matte carbon (fork, seatpost)
  M.carbon = new THREE.MeshPhysicalMaterial({
    color: 0x6a6a6e, map: carbon, metalness: 0.1, roughness: 0.62,
    clearcoat: 0.18, clearcoatRoughness: 0.6, envMapIntensity: 0.45,
  });

  // Crank / derailleur forged alloy, near-black anodised
  M.crank = new THREE.MeshPhysicalMaterial({
    color: LIVERY.crank, metalness: 0.85, roughness: 0.4,
    roughnessMap: brushed,
  });

  M.chainring = new THREE.MeshStandardMaterial({
    color: LIVERY.chainring, metalness: 0.9, roughness: 0.55, envMapIntensity: 0.55,
  });

  // Tire rubber
  M.tire = new THREE.MeshStandardMaterial({
    color: LIVERY.tire, metalness: 0.0, roughness: 0.96,
    bumpMap: rubberBump, bumpScale: 0.4,
  });
  M.tireWall = new THREE.MeshStandardMaterial({
    color: LIVERY.tireWall, metalness: 0.0, roughness: 0.92,
  });

  // Rim with machined brake track
  M.rim = new THREE.MeshStandardMaterial({
    color: LIVERY.rim, metalness: 0.85, roughness: 0.42,
  });
  M.brakeTrack = new THREE.MeshStandardMaterial({
    color: 0x9ea4a9, metalness: 1.0, roughness: 0.3,
  });

  M.spoke = new THREE.MeshStandardMaterial({
    color: LIVERY.spokes, metalness: 0.95, roughness: 0.35,
  });

  M.hub = new THREE.MeshStandardMaterial({
    color: 0x6d7277, metalness: 0.95, roughness: 0.42,
  });

  // Saddle / grips
  M.saddle = new THREE.MeshStandardMaterial({
    color: LIVERY.saddle, metalness: 0.0, roughness: 0.62,
  });
  M.grip = new THREE.MeshStandardMaterial({
    color: LIVERY.grip, metalness: 0.0, roughness: 0.9,
    bumpMap: rubberBump, bumpScale: 0.25,
  });

  M.cable = new THREE.MeshStandardMaterial({
    color: LIVERY.cable, metalness: 0.3, roughness: 0.55,
  });

  M.accent = new THREE.MeshStandardMaterial({
    color: LIVERY.accent, metalness: 0.4, roughness: 0.42,
  });

  M.black = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, metalness: 0.2, roughness: 0.7,
  });

  return M;
}

// Down-tube decal texture: white KOGA wordmark + red accent on transparent strip
export function kogaDecalTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 128);
  ctx.font = '900 96px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // wordmark
  ctx.fillStyle = '#f2f2f2';
  ctx.save();
  ctx.translate(512, 64);
  ctx.scale(1.35, 1.0);
  for (let i = 0, txt = 'KOGA', x = -120; i < txt.length; i++, x += 80) {
    ctx.fillText(txt[i], x, 0);
  }
  ctx.restore();
  // red accent slash
  ctx.fillStyle = '#e63329';
  ctx.beginPath();
  ctx.moveTo(760, 20); ctx.lineTo(790, 20); ctx.lineTo(760, 108); ctx.lineTo(730, 108);
  ctx.closePath(); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small "F3" head tube badge texture
export function f3BadgeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#e63329';
  ctx.beginPath();
  ctx.arc(128, 128, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 110px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F3', 128, 136);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
