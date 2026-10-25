# Globe Asset Kit

Editable local globe assets for video production, using Three.js, scene JSON, and local NASA Earth textures. The reference style combines readable satellite land, blue bathymetric oceans, a dark background, and a blue atmospheric rim.

## Globe Lite V2

The separate `v2/` folder contains a globe-only illustrated version with a small WebGL2 renderer, local land masks, and smooth island-to-island travel. It does not depend on Three.js or online map services. With the existing server, open http://127.0.0.1:4173/v2/. The folder also runs standalone with `node v2/serve.mjs` at port 4174, without npm install. See `v2/README.md` and `v2/AGENTS.md` for its own scene format and API. V1 remains available at the original root URL.

## Start

Requires Node.js. From this folder:

```sh
npm ci
npm start
```

Open http://127.0.0.1:4173. On Windows, `start.cmd` starts the same server after dependencies have been installed. Do not open `index.html` directly.

## Project status

The original globe editor includes Pacific and Indonesia views, route animation, procedural satellite/ship objects, PNG export, and scene JSON import/export.

The main globe now has shared great-circle motion for routes and objects (including animated GLB and multi-pose sprites), object-follow cameras with distance keyframes, and optional screen-relative subject sizing. Online detail loading has been reworked to retain previous/parent tiles, prioritize the current view, cancel obsolete downloads, and provide explicit strict/fallback export behavior. See [docs/MOTION.md](docs/MOTION.md) for the schema and examples.

These changes were reviewed in source only. **No automated tests, browser QA, or test renders were run for this update**, at the user's request. The historical checks in `docs/verification.json` describe the original version and do not validate this update. Sea-level changes and the Bali–Lombok cross-section remain experimental.

For the original globe presets, use `pasifik`, `indonesia`, `rute`, or `orbit`. New examples are `follow-bird` (two-pose godwit sprite), `follow-satellite` (local textures), and `follow-ship` (online imagery). Nine original godwit handoff scenes and four PNGs are also included; they normalize to the general motion schema when imported. Online satellite imagery requires an internet connection and location-dependent source resolution; no new offline detailed tiles or 3D terrain are included.

This is a Three.js implementation, not a native After Effects/GEOlayers/VC Orb project, and no pixel-identical match to the reference is claimed. A realistic turtle model is not included.

## Edit with another AI agent

Ask the agent to read `AGENTS.md`, then duplicate and edit a file in `scenes/`. Keep the reference style unchanged unless a different style is requested.

Example:

> Read AGENTS.md. Duplicate scenes/pasifik.json for a 10-second Indonesia shot. Change the camera and labels, preserve the globe style, and export the result.

- `src/globe.js`: renderer and absolute-time animation.
- `src/motion.js`: shared route curves, traveller orientation, follow-camera interpolation.
- `src/app.js`, `src/controls.js`, `index.html`, `src/style.css`: local editor.
- `scenes/`: editable camera, style, labels, routes, and objects.
- `assets/`: imagery, elevation grids, and source metadata.
- `docs/README.html`: detailed schema and render instructions.
- `docs/MOTION.md`: current follow/GLB/sprite/detail additions and their limitations.
- `after-effects/import-render.jsx`: imports exported footage into After Effects.

## Export

The editor exports PNG and scene JSON. Automated MP4 and PNG-sequence rendering additionally require Playwright/Chromium and FFmpeg; see `docs/README.html` for installation and runtime fallbacks.

```sh
node scripts/render.mjs --scene pasifik --format png --time 4 --out exports/globe.png
node scripts/render.mjs --scene rute --format mp4 --out exports/rute.mp4
node scripts/render.mjs --scene pasifik --format frames --transparent --out exports/globe-frames
```

MP4/H.264 does not support transparency. Keep scene JSON and assets as the editable master. Generated exports, reference-analysis frames, dependency folders, and ZIP archives are excluded from Git.

## Data and credits

- NASA Earth Observatory, July 2004 Blue Marble Next Generation with Topography and Bathymetry. See `assets/manifest.json` for source links and credits.
- NOAA NGDC ETOPO1 elevation data, downloaded from the NOAA PMEL ERDDAP service for the unfinished elevation features. Packed textures are derived from the included CSV data using `scripts/data/prepare-elevation.py` (Python, NumPy, Pillow). Global grid: 0.25 degrees; Bali–Lombok subset: 1 arc minute. Sea-level effects are illustrative elevation thresholds, not a hydrodynamic or flood model.
- Optional live detailed imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community. Attribution is drawn on images using that layer. Detailed satellite tiles are not bundled as an offline dataset.
- Godwit sprites and nine original scenes: supplied by the user in the Instinct brief's `globe-kit-bird-handoff.tar.gz` attachment. Original patch/notes are archived in `docs/handoff/`; do not reapply the old patch. Separate licensing was not specified in the attachment; source provenance is recorded in `assets/manifest.json`.
- Three.js 0.180.0 uses the MIT license. Its license is installed with the dependency.

For elevation data provenance:

- https://data.pmel.noaa.gov/socat/erddap/griddap/etopo180.html
- Global subset: `altitude[0:15:10800][0:15:21600]`.
- Bali–Lombok subset: `altitude[(-9.2):1:(-7.8)][(114.0):1:(117.5)]`.
