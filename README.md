# Globe Asset Kit

Editable local globe assets for video production, using Three.js, scene JSON, and local NASA Earth textures. The reference style combines readable satellite land, blue bathymetric oceans, a dark background, and a blue atmospheric rim.

## Start

Requires Node.js. From this folder:

```sh
npm ci
npm start
```

Open http://127.0.0.1:4173. On Windows, `start.cmd` starts the same server after dependencies have been installed. Do not open `index.html` directly.

## Project status

The original globe editor includes Pacific and Indonesia views, route animation, procedural satellite/ship objects, PNG export, and scene JSON import/export.

This repository also preserves work in progress on detailed satellite zoom, sea-level changes, and a Bali–Lombok cross-section. That follow-up work was stopped at the user's request and has **not been finalized or fully validated**. The historical checks in `docs/verification.json` describe the original version, not acceptance of all later changes. No further tests were run for this commit at the user's request.

For the original globe presets, use `pasifik`, `indonesia`, `rute`, or `orbit`. The `bali-lombok`, `laut-surut`, `penampang`, and `fly-in` presets belong to the unfinished follow-up work. Online satellite imagery requires an internet connection; the original local globe uses bundled textures without an API key.

This is a Three.js implementation, not a native After Effects/GEOlayers/VC Orb project, and no pixel-identical match to the reference is claimed. A realistic turtle model is not included.

## Edit with another AI agent

Ask the agent to read `AGENTS.md`, then duplicate and edit a file in `scenes/`. Keep the reference style unchanged unless a different style is requested.

Example:

> Read AGENTS.md. Duplicate scenes/pasifik.json for a 10-second Indonesia shot. Change the camera and labels, preserve the globe style, and export the result.

- `src/globe.js`: renderer and absolute-time animation.
- `src/app.js`, `src/controls.js`, `index.html`, `src/style.css`: local editor.
- `scenes/`: editable camera, style, labels, routes, and objects.
- `assets/`: imagery, elevation grids, and source metadata.
- `docs/README.html`: detailed schema and render instructions.
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
- Three.js 0.180.0 uses the MIT license. Its license is installed with the dependency.

For elevation data provenance:

- https://data.pmel.noaa.gov/socat/erddap/griddap/etopo180.html
- Global subset: `altitude[0:15:10800][0:15:21600]`.
- Bali–Lombok subset: `altitude[(-9.2):1:(-7.8)][(114.0):1:(117.5)]`.
