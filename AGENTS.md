# Globe Asset Kit — instructions for future agents

This is a local reusable video-asset project, not a hosted website. The user's priority is visual similarity to the supplied reference: readable satellite land, blue bathymetric oceans, near-black background, luminous blue atmospheric rim, smooth camera movement. Preserve that baseline when changing topics. Do not claim an exact match or claim this is native GEOlayers/VC Orb output.

## Run and edit

- `npm start` serves the editor at http://127.0.0.1:4173. `start.cmd` is the Windows launcher. Opening index.html directly is not supported because ES modules and textures require HTTP.
- The app uses local Three.js 0.180.0 and local NASA textures. There are no API keys or runtime CDN requests.
- Prefer duplicating a JSON file in scenes/ for a new topic. Keep the reference style intact unless the user requests a visual change.
- Read docs/README.html for the schema and render commands. Coordinates are [latitude, longitude] in degrees. Altitude uses Earth radii above the surface, not kilometers. The sphere radius is 1.
- Camera keyframes use seconds and shortest-longitude interpolation. The animation is driven by absolute time. Never replace this with accumulated frame deltas for export.
- Existing web controls are just a convenient editor. Scene JSON is the reusable source of truth. To change the engine, edit src/globe.js; UI: src/app.js, index.html, src/style.css.
- GLB objects go in assets/models/. Uncompressed GLB is supported. Draco/KTX2 external decoder support is not configured. A realistic turtle asset is NOT included; do not misrepresent the procedural ship/satellite as reference-exact models.
- Native After Effects, GEOlayers, and VC Orb were not available during creation. Google Earth Studio/Google imagery is not integrated. No coast-level imagery or terrain tiles are included; close globe is NOT a coastal satellite flyover.

## Rendering contract

- `window.__GLOBE_READY__` indicates texture and scene initialization completed.
- `await window.globeKit.applyConfig(config)` validates and loads all scene assets.
- `window.globeKit.resize(width,height)` sets exact output pixel dimensions.
- `window.globeKit.setTime(seconds)` deterministically renders Earth, objects, routes, labels and text.
- `window.globeKit.exportPNG()` returns a PNG data URL. The visible canvas contains both 3D and overlay graphics; no CSS text capture is required.
- `node scripts/render.mjs --scene scenes/custom.json --format mp4 --out exports/custom.mp4` exports using Playwright and FFmpeg. Use `--format frames --transparent` for alpha. H.264 MP4 has no alpha support.
- All external tools are optional for the editor, required only for video render. Dependency fallbacks are documented; don't add user-specific paths to core source.
- Keep raw source configs and assets along with renders. An MP4 is a delivery file, not an editable master.

## Check before delivery

Run `npm run check`. Inspect a real browser render after shader/camera changes. Check route curvature and occlusion, alpha PNG corners, and output metadata via ffprobe after video export. Do not add screenshots of reference footage to this product or remove source credits.
