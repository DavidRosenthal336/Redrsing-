# Iron Rain

A standalone 3D fan experience of the Iron Rain from Pierce Brown's *Morning Star*, built with Three.js.

**Play:** open `iron-rain/index.html` in a desktop or mobile browser with WebGL. It loads Three.js and fonts from public CDNs, so it needs an internet connection.

## What happens

1. **The launch bay.** Walk the length of the Rising's drop bay in first person, past rows of open starShell pods and soldiers who salute as you pass. Mars hangs outside the long window.
2. **Sevro.** He waits by your pod. Talk it through with him and with Orion on fleet comms.
3. **Boarding.** Step into Pod 01. The hatch swings shut, the visor HUD comes up, and the countdown runs.
4. **Launch cinematic.** Three shots: under the flagship's belly as the tubes fire; a chase camera on your own pod, tagged in the frame; and a wide shot of the whole Rain between the fleet and Mars.
5. **The fall.** Steer your pod down through 100 km:
   - a debris field in high orbit
   - re-entry, inside a plasma shell
   - the flak belt, with telegraphed bursts and homing missiles
   - the clouds over Agea
   - the final approach to the green drop zone
6. **Landfall.** Impact, shockwave, and the rest of the Rain slamming down around you as Darrow climbs out.

Skip the bay with `index.html#launch` (cinematic) or `index.html#fall` (straight to the drop).

## Controls

| | Keyboard / mouse | Touch |
|---|---|---|
| Move / steer | WASD or arrows | Left stick |
| Look (bay) | Mouse (click to capture), or drag | Drag on the right side |
| Act / talk / enter | Space, J, E or Enter | Act button |
| Run (bay) / boost (fall) | Shift or K | Boost button |
| Mute | M | |

## How the graphics are made

Everything is generated in code; there are no image, model or audio files.

- **Rendering:** a linear-light HDR pipeline (half-float render target), Unreal-style bloom, and a final pass with ACES filmic tone mapping, chromatic aberration, vignette and film grain.
- **Mars:** a fragment shader with layered value noise. It draws rust highlands, basalt, rifts, terraformed green lowlands and seas with sun glints, polar ice, city lights on the night side, and an additive atmosphere rim. Detail increases as you descend.
- **Re-entry:** a plasma shell (fresnel plus scrolling noise) and a noise-driven flame plume.
- **Bay:** volumetric light shafts, procedural panel textures and a PMREM environment map for the metal armor.
- **Effects:** pooled fire, smoke and spark sprites with flash lights for explosions. Instanced meshes for the hundreds of pods and their trails.
- **Sound:** synthesized in WebAudio with a convolution reverb, plus an original drum-and-brass score.

## Tools

Both need Playwright and a local `npm i three@0.147.0` (pass its `node_modules/three` folder as the first argument):

- `tools/flow.js` plays the whole experience with scripted input and no rendering, and reports each phase it reaches: bay, dialogue, boarding, cinematic, fall, impact, end card, retry and death.
- `tools/shot.js` renders chosen moments headlessly and saves screenshots, e.g. `node tools/shot.js <three> out fall alt=62 alt=5`.

`window.__ir.capture(true)` plus `__ir.tick(1/30)` advances the game one fixed frame at a time, which is how a frame-perfect video can be recorded.

*Red Rising* and its characters belong to Pierce Brown. This is an unofficial, non-commercial fan tribute.
