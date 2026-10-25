# Globe Lite — V2

A globe-only illustrated renderer with smooth travel between islands. V2 is separate from V1 and uses no Three.js, framework, external service, npm dependency, or large satellite texture.

## Open

From the original project, run `npm start` and open http://127.0.0.1:4173/v2/.

The V2 folder is also standalone. Run `start.cmd` or `node serve.mjs` inside this folder and open http://127.0.0.1:4174/. This requires Node.js, but no `npm install`. Use HTTP rather than double-clicking index.html.

## Use

- Select an island: the camera travels along a great-circle path, pulls back gently on longer hops, and eases into its destination.
- Adjust the transition duration from 1–6 seconds, or replay the most recent movement.
- Drag to rotate; scroll to zoom. A new destination starts from the current position, including if a previous movement was interrupted.
- Settings expose palettes, land/ocean/atmosphere colours, halo, coordinates and transparent PNG output.
- Export a clean globe PNG or save the V2 scene as JSON. Imported scenes must use `version: 2`.
- Output aspect ratios are landscape, portrait and square. The globe remains the only rendered asset; controls and location text are outside the exported image.

## Why it is smaller

- A fullscreen quad (two triangles), one shader, two small single-channel land masks.
- World mask: 25,663 bytes; Indonesia mask: 59,403 bytes. The PNGs total 85,066 bytes on disk. These file sizes are not GPU memory usage.
- No online map tiles, relief textures, animated objects, physics, terrain grids or background particles.
- The renderer is idle when the camera is not moving. Preview pixel density is capped at 1.5 and its longest side at 1600 pixels; PNG export can use the full scene resolution.
- Decoded bitmaps are released after uploading the masks. R8 masks with mipmaps use roughly 13.3 MiB of GPU texture storage; framebuffers and browser resources require additional memory.

No FPS benchmark or device-performance guarantee is claimed. No further automated tests, video-render batches, or browser acceptance checks were run for this delivery.

## Editing with another AI agent

Read AGENTS.md first. Most changes need only presets.json, scene.json or palette values.

> Use Globe Lite V2. Add a transition from Bali to Papua lasting four seconds. Keep the illustrated style and the render-on-demand architecture. Do not add satellite imagery or extra objects.

Scene camera coordinates are latitude/longitude in degrees and `altitudeKm` in kilometres. Keyframes include the same camera fields plus `time` in seconds. All animation is evaluated from absolute time, suitable for frame-by-frame export by another agent.

```json
{
  "version": 2,
  "name": "Bali to Papua",
  "width": 1920,
  "height": 1080,
  "duration": 4,
  "camera": {"lat": -8.37, "lon": 115.13, "altitudeKm": 480},
  "style": {
    "land": "#91bb7b", "ocean": "#214c77",
    "atmosphere": "#78b9ff", "background": "#07111c",
    "halo": 0.7, "coast": 0.35, "transparent": false
  },
  "keyframes": [
    {"time": 0, "lat": -8.37, "lon": 115.13, "altitudeKm": 480},
    {"time": 4, "lat": -4.6, "lon": 138.5, "altitudeKm": 2200}
  ]
}
```

## Renderer API

The page exposes `window.globeLite`. A clean renderer page is available with `?render=1&width=1920&height=1080`.

```js
await window.globeLite.ready;
window.globeLite.applyScene(scene);
window.globeLite.resize(1920, 1080);
window.globeLite.setTime(2); // deterministic frame at two seconds
const png = window.globeLite.exportPNG(1920, 1080);
```

The renderer is also usable without the editor:

```js
import {GlobeLite} from './globe-lite.js';
const globe = new GlobeLite(document.querySelector('canvas'));
await globe.ready;
globe.applyScene(scene);
globe.resize(1920, 1080);
globe.setTime(0);
```

`startFlight(targetCamera, duration)` creates two camera keyframes starting at the current view. `setTime(seconds)` renders their absolute-time position. `setCamera(camera)` replaces that movement with a static view. `setStyle(patch)`, `getScene()`, `fitAltitude()` and `destroy()` are also available. The renderer itself does not create an idle animation loop; the caller schedules frames only while movement is required.

V1's render script is not wired to the V2 API. Agents should target this V2 API if they need to add a video-export workflow later. PNG and JSON export are included now.

## Assets and limits

Land silhouettes are derived from Natural Earth, a public-domain dataset. The world uses the 1:50-million land dataset; the Indonesia region uses 1:10-million land. The names do not indicate metre-level resolution. These are simplified illustrative coastlines, not satellite images or street-level maps. Very small islands may be generalized at low zoom levels.

The PNGs are the runtime assets. Original GeoJSON files are unnecessary for running the globe. To rebuild them, fetch the URLs in assets/manifest.json into source/land-50m.geojson and source/land-10m.geojson, then run `python tools/build-masks.py` from this folder (Pillow required).

Source and terms: https://www.naturalearthdata.com/about/terms-of-use/

The lightweight ZIP excludes the original multi-megabyte GeoJSON downloads, V1, node_modules and generated video files.
