# Koga F3 Three.js — Progress Tracker

Goal: most realistic Koga F3 in Three.js. Full frame/drivetrain/brakes modeling,
PBR materials, animated drivetrain at correct gear ratio, mouse interactivity
(pedal drag, steering+lean, brake), camera rig with saved viewpoints, iterative
vision-verified screenshots in `./iterations/`.

## How to work on this
- `node tools/shoot.mjs <label>` — headless render: writes shots/*.png (all
  viewpoints) + appends numbered frame to iterations/ (time-lapse archive).
- Inspect shots/*.png visually after EVERY change; loop until satisfied.
- Commit each iteration. Branch: `claude/koga-f3-threejs-model-btxmpt`.
- Interactive: serve repo root (any static server) and open index.html.

## Architecture
- `src/bike/geo.js` — single source of truth for all hard points/dimensions
  (axles, BB, head/seat angles, tube radii, gear teeth, livery colors).
- `src/bike/materials.js` — PBR materials + procedural canvas textures
  (brushed alu roughness, carbon weave, rubber grain) + KOGA decal textures.
- `src/bike/frame.js` — main+rear triangle, dropouts, saddle, decals.
- `src/bike/wheels.js` — rim (lathe), brake track, 28h 3-cross spokes, hub, tire.
- `src/bike/fork.js` — steering group (rotate .rotation.y to steer): fork,
  crown, stem, flat bar, grips, brake levers (leverPivots for squeeze anim).
- `src/bike/drivetrain.js` — crank/chainrings/pedals, cassette (added to rear
  wheel spin), rear+front derailleur. Exports pulleys {guide, tension} centres.
- `src/bike/chain.js` — belt solver (common tangents w/ windings) around
  cog→chainring→tension→guide; instanced links; chain.update(offset) slides.
- `src/bike/brakes.js` — dual-pivot calipers + cables; squeeze(t).
- `src/main.js` — scene/lights/floor, camera rig + VIEWS + tweening, physics
  state (crank/wheel/freehub/brake/steer/lean), pointer handlers,
  window.__app API for headless control (setView/setCrank/setSteer/setBrake).

## Iteration log
- iter_001 (scaffold): full bike renders, correct proportions.
- iter_002-004: carbon/alu/steel material fixes, RD cage redesign (dog-bone
  plates + jockey bolts), subtle grip collars, headset accent ring.
- iter_005-006: KEY LESSON — scene was overlit (key 2.6 + env 0.85): light-gray
  metals clipped white under ACES. Lights now key 1.45/rim 0.55/amb 0.22/env 0.7.
  Cassette color darkened (nickel steel 0x53585d). Asymmetric rear hub flange
  (drive side z=0.018) so cassette clears it.
- iter_007: forged crank arm (lofted extrude), QR skewers, sidewall stripes,
  bottle bosses, tighter KOGA decal.
- iter_008: caliper rebuild — pivot about fore-aft X axis (pads close on rim
  faces), silver arms. Verified: crank phases (pedals stay level), steer+lean,
  pad-gap A/B closeup, lever pull. tools/verify.mjs captures all of these.

## Verified working
- Chain belt-path solver wraps: cog 168°, ring 183°, S-bend through jockeys.
- Freehub model: pedal forward engages, coast decays, brake decelerates wheel.
- __app headless API: setView/lookAt/setCrank/setSteer/setLean/setBrake.

## TODO / known issues
- [ ] Lever blade pull visibility from side closeup
- [ ] Front derailleur cage looks like bent wires — could be plate-ier
- [ ] Hero composition / floor could be richer
- [ ] README + npm scripts
- [ ] Final scrutiny loop at all views
