# bGeigie Zen: interactive 3D build guide

Step-by-step 3D assembly instructions for the Safecast bGeigie Zen that run in the browser. There is no build step and no framework, only static files that can be hosted on GitHub Pages or Codeberg Pages.

The layout and viewer are modelled on the [APS-II Sesame S3 build guide](https://aps.chibatech.dev/ii/sesame-build/).

> **Status:** the 3D model is the real bGeigieZen V4.x board (PCB, M5Stack CoreS3, LND 7318 tube, Safepulse, GPS, 18650 and clips), and the 25 steps follow the *bGeigieZen Kit Assembly for V4.x boards* manual (2026-04-06). Solder joints, screws, J4/J5 pins, wires, the microSD card and the Qi coil/module are generated illustrations, tagged "Modelled". The back half of the Pelican 1015 case (`1015-965-CLR.wrl`) is included; its lid and the rubber liner are not shown.

## Try it

```bash
cd bgeigie-zen-build
python3 -m http.server 8000
```

Open <http://localhost:8000/?step=5>. Needs a browser with WebGPU or WebGL2.

| URL parameter | Effect |
|---|---|
| `step=N` | Jump to step N (1–25) |
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
    ├── export_zen.py     Zen.pcb3d -> assets/assembly.{json,bin}
    ├── vrml.py           minimal VRML 2 reader used by export_zen.py
    ├── make_locales.py   writes locales/*.json (step text from the manual)
    ├── check_i18n.py     checks steps.js keys exist in every locale
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

## Regenerating the model

The geometry comes from `Zen.pcb3d` in the [Safecast/bGeigieZen](https://github.com/Safecast/bGeigieZen) repo (`hardware/bGeigieZen V4.x.x draft and production/bGeigieZen V4.2.x/`). It is a pcb2blender export: `pcb.wrl` places one VRML file per component, and `pads/*.toml` gives every pad position.

```bash
python3 scripts/export_zen.py "<path>/Zen.pcb3d"
```

`export_zen.py` reads the VRML (numpy only), splits vertices at sharp edges (38°), extracts feature edges, splits parts over 65 535 vertices into chunks, recentres on the board and writes the two asset files (about 4 MB). Generated extras (solder mounds, screws, pins, wires, microSD, Qi coil) are defined in `build_parts()`; add or move parts there. Part ids are what `steps.js` selects by.

The case is read from `1015-965-CLR.wrl` next to `Zen.pcb3d` (or pass its path as a second argument). Its placement follows the KiCad model transform of footprint BT1, checked against the battery and clip models, with XY then centred on the board (the VRML has a different origin than the STEP the offset was written for).

Next steps: add the lid and rubber liner (`black inner liner.blend` in the Blender folder), and replace the illustrative parts with measured ones.

After editing step ids or text, run `python3 scripts/make_locales.py && python3 scripts/check_i18n.py`.

## Deploy

Push `bgeigie-zen-build/` as the site root, or point Pages at it. Asset and locale requests are relative, so it works from a sub-path.

## Credits and licence

The viewer code derives from the APS-II Sesame build guide, which itself credits a WebGPU kumiki joinery viewer ([tim003/JointMCP](https://github.com/tim003/JointMCP)). Confirm the reuse terms with the original authors and add a licence file here before publishing.
