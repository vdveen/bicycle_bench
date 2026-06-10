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
- iter_001 (scaffold): full bike renders, correct proportions. Issues found:
  fork renders silver not carbon; cassette blown-out white; RD cage = crude
  black box; grip collars too loud; seat tube red band swallowed by tube taper.

## TODO / known issues
- [ ] Fix carbon material (too bright — set canvas tex colorSpace, lower clearcoat)
- [ ] Darken brushed alu (cassette)
- [ ] Redesign RD cage + visible jockey wheels; verify chain S-path visually
- [ ] Verify chain wrap at chainring (dedicated chain view)
- [ ] Grip collars subtler; red band radius fix
- [ ] Brake closeup view + verify pad gap/squeeze
- [ ] Front caliper visibility/detail, cable line check
- [ ] Tire tread, hub QR levers, bottle bosses, chainstay ovalization (polish)
