# Globe Lite V2

This folder is an independent, lightweight illustrated globe. Keep V1 unchanged. The user specifically asked for globe-only scope and smooth movement between islands, with small assets and no satellite detail.

- No Three.js, frameworks, build step, npm packages, online imagery, DEMs, 3D models, particles, or route systems in V2.
- Use local PNG land masks, solid colours, simple shading and one fullscreen WebGL2 draw. Masks use R8 single-channel GPU textures and mipmaps. Avoid replacing them with large satellite textures.
- Preserve render-on-demand: no continuous requestAnimationFrame loop while idle. The UI animation loop stops at the destination and pauses while the document is hidden.
- `navigation.js` handles great-circle travel, quintic easing and gentle pull-back for longer hops. The camera uses degrees and altitude in kilometres; this differs from V1 object altitude units.
- `presets.json` contains island targets and palettes. `scene.json` is the default editable V2 scene.
- `globe-lite.js` is the renderer and deterministic scene API. `app.js`, `index.html`, and `styles.css` are the small optional editor.
- Serve with the parent `npm start` at /v2/, or run `node serve.mjs` in this folder at port 4174. Standalone V2 requires only Node.js, not npm install.
- Read README.md for API details. `window.globeLite` exposes the renderer; `window.__GLOBE_LITE_READY__` indicates initial assets loaded.
- Do not claim performance measurements or browser QA that were not performed. The user requested no further testing during the earlier workflow; this V2 delivery has no measured FPS or acceptance-test claim.
- Natural Earth source GeoJSON is kept in source/ locally for rebuilding, but is not needed at runtime or in the lightweight ZIP. tools/build-masks.py records the conversion. Public-domain source links and exact geographic bounds are in assets/manifest.json.
- This is an illustrated island-scale globe, not satellite detail. Do not add detail-map features unless requested.
