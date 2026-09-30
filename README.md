# bGeigie Zen: interactive 3D build guide

Step-by-step 3D assembly instructions for the Safecast bGeigie Zen that run in the browser. There is no build step and no framework, only static files that can be hosted on GitHub Pages or Codeberg Pages.

The layout and viewer are modelled on the [APS-II Sesame S3 build guide](https://aps.chibatech.dev/ii/sesame-build/).

> **Status: prototype.** The geometry is placeholder boxes and cylinders, and the parts list, layout and step text are illustrative. Every step is tagged "Modelled". Replace them with the real CAD and build procedure before publishing it as a guide.

## Try it

```bash
cd bgeigie-zen-build
python3 -m http.server 8000
```

Open <http://localhost:8000/?step=5>. Needs a browser with WebGPU or WebGL2.

| URL parameter | Effect |
|---|---|
| `step=N` | Jump to step N (1–15) |
| `lang=ja` | Japanese (default follows the browser, then the saved choice) |
| `style=line` | Line-drawing style |
| `renderer=webgl` | Force the WebGL2 renderer instead of WebGPU |

Controls: drag to rotate, shift-drag to pan, scroll to zoom, ← → to change step. The buttons offer play, replay, colour/line, flip and fit.

## Layout

```
bgeigie-zen-build/
├── index.html            page shell (text is filled in from locales)
├── style.css
├── js/
│   ├── main.js           UI, timeline, camera, labels, arrows
│   ├── renderer.js       WebGPU renderer with WebGL2 fallback
│   ├── steps.js          step choreography: parts, motion, camera, tools
│   └── i18n.js           locale loading and lookup
├── locales/{en,ja}.json  all reader-facing text
├── assets/
│   ├── assembly.json     part manifest
│   └── assembly.bin      packed geometry
└── scripts/
    ├── build_assembly.py generates the assets (placeholder geometry)
    ├── make_locales.py   writes locales/*.json
    └── ref_en.json       shared UI strings used by make_locales.py
```

## How it works

Each CAD part is drawn separately, so it can have its own offset, pop-in scale, highlight tint and edge colour while the timeline plays.

- `steps.js` picks parts with selector functions over the manifest (`p.id`, `p.chain`). Each step can `add` parts (`enter` from an offset, or `appear`), `remove` them, `highlight` them, or `seat` a staged sub-assembly. It also sets the camera `view` and the `tools`, `labels`, `notes` and `evidence` tags.
- Sub-assemblies (`UNITS`, e.g. the ESP32) are built lifted above the board while `isolate`d, then lowered on their `seat` step.
- Text is looked up by key: `steps.<id>.title|text|notes.<kind>`, `parts.<key>`, `chapters.<name>`, `labels.<key>` and `tools.<name>`.

### Asset format (`schema: sesame-build/1`)

`assembly.json` holds `quantum_mm`, a `buffers` table of byte offsets and lengths, and a `parts` list. Each part has `id`, `label`, `chain`, `color`, `alpha`, `bbox` and `[start, count]` ranges into the buffers for `vertices`, `indices` and `edges`.

`assembly.bin` holds four packed buffers:

| Buffer | Type | Notes |
|---|---|---|
| `positions` | Int16 xyz | × `quantum_mm`; range about ±163 mm at 0.005 |
| `edges` | Int16 xyz | line list, two vertices per segment |
| `indices` | Uint16 | triangles, local to the part (≤ 65 535 vertices per part) |
| `colors` | Uint8 rgb | per vertex |

Units are millimetres, Z up, with the enclosure underside at Z = 0. Normals are computed in the browser.

## Making it real

1. **Geometry.** Replace `build()` in `scripts/build_assembly.py` with an exporter that reads the real CAD (STEP or FreeCAD), tessellates each part and writes the same format. Keep stable part ids, because `steps.js` selects by them.
2. **Steps.** Rewrite `js/steps.js` for the actual build order, tools and camera views. Update `evidence` from `model` to `measured` or `photo` where it is verified.
3. **Text.** Edit the dictionaries in `scripts/make_locales.py` and run `python3 scripts/make_locales.py`. Every locale must have identical keys.
4. **Parts links.** A part with `ref` and `url` in `steps.js` shows a purchase link.

## Deploy

Push `bgeigie-zen-build/` as the site root, or point Pages at it. Asset and locale requests are relative, so it works from a sub-path.

## Credits and licence

The viewer code derives from the APS-II Sesame build guide, which itself credits a WebGPU kumiki joinery viewer ([tim003/JointMCP](https://github.com/tim003/JointMCP)). Confirm the reuse terms with the original authors and add a licence file here before publishing.
