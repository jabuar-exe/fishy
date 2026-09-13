# Packet acceptance — downloaded revision 6

**Packet under test:** `/Users/joshuabanzon/Downloads/fishy-revision-6-five-views.zip`

**Extracted copy:** `workstreams/precision-sculpt/qa/reference-packet/`

## Result

Accepted. The downloaded archive is structurally intact and the extracted data is internally consistent with its manifest. This verifies a frozen browser-scene packet, not physical measurement or cross-GPU pixel identity.

| Check | Result |
| --- | --- |
| ZIP entries / safety | Eight expected flat filenames only: `scene.json`, five named PNGs, `manifest.json`, and `index.html`; no path-bearing names. |
| CRC / archive structure | `unzip -t` reported every entry OK and no compressed-data errors. |
| Image dimensions | `front`, `left`, `right`, `top`, and `perspective` are each 2048 × 1536 PNG. |
| Scene identity | `scene.json` SHA-256 is `2c2b1384bc05c2d401cba6a8c0a73ffbd067c14f2edc3a7c3f31b667a9c0128c`, exactly matching `manifest.sceneSha256`. |
| Render identities | Every one of the five extracted PNG SHA-256 values matches its manifest view record. |
| Camera identities | Each camera record rehashed from its recorded projection, metres-per-pixel, pose, target, up vector, world matrix, and projection matrix matches its recorded `cameraSha256`. |
| Orthographic scale | Front, left, right, and top each record `0.00034125000000000003 metres/pixel`; the manifest explicitly declares the shared orthographic scale. |
| Scene record | `riverbend`, revision 6, `fishy-browser-3`, metres, declared 60 × 30 × 36 cm assumed tank dimensions. |

## Exact render identities

| View | PNG SHA-256 | Camera SHA-256 |
| --- | --- | --- |
| front | `e637f82ce3d495fc8ef15d32c472167bff49a5b737b81fc13af33961992c77f7` | `ee0ddcbbcb07561f805bbd64c2f4aeb28651bc12a455b761bff7f837fe8b437f` |
| left | `eb65be9564c8fafea80435539c4f02f943f3d8a9079b8ee87f07d745628fce7d` | `0583082797b57986435056d9d02bf7328eac024e89f66336da4a7c51568a2294` |
| right | `418fb116f83a003f8d03ccd45ec777fdd049ee3fa271698c1781ead387d08ed0` | `1b17442cc2b75ef884368781551ecea44c6a8640cea72513f6b0fb008317a5cc` |
| top | `18f00bb13d6a1a9a28b4c5b41a84ef2ac50cf9b407ff879169a8b90398c54ab1` | `db70d6615bdee36bc6d4f308aa176abd1b21e2d71478f12002492ffba12ccea6` |
| perspective | `ccb2d2336a6105572756677ccb199325423c6d42967e04d0b38fff31660e4303` | `7bc2a21c82f37f89031af7a1f87b09faf84adfeedbf6b54c0908aaedbd767de0` |

## Scene and sculpt evidence

The stored scene has seven objects. `rock-left` has 175 stored sculpt nodes and `Left stone copy` (`8a7f099d-7730-4394-8076-706166c205c5`) has 180. River wood, right stone, fern grove, stem grove, and foreground grass each have zero sculpt nodes. This agrees with the requested original/copy count and retains the full sculpt fields in the exact hashed `scene.json`.

## Frustum and visual inspection

Projected conservative world-axis-aligned bounds for the tank envelope and all seven rendered objects through the current recorded cameras. All coordinates were finite and within the clip volume:

| View | Largest absolute X/Y NDC coordinate | Z NDC range |
| --- | ---: | --- |
| front | 0.892857 | -0.959153 to -0.952673 |
| left | 0.747863 | -0.962153 to -0.949673 |
| right | 0.747863 | -0.962153 to -0.949673 |
| top | 0.892857 | -0.959833 to -0.952053 |
| perspective | 0.719024 | 0.998260 to 0.998955 |

Visual inspection of all five extracted PNGs found the tank, hardscape, plants, substrate, and base visible with no apparent clipping. The packet uses dark studio rendering with room photos excluded, and records a flat static water phase.

## Viewable extracted images

- [Front](/Users/joshuabanzon/Documents/ChatGPT/Fishy/workstreams/precision-sculpt/qa/reference-packet/front.png)
- [Left](/Users/joshuabanzon/Documents/ChatGPT/Fishy/workstreams/precision-sculpt/qa/reference-packet/left.png)
- [Right](/Users/joshuabanzon/Documents/ChatGPT/Fishy/workstreams/precision-sculpt/qa/reference-packet/right.png)
- [Top](/Users/joshuabanzon/Documents/ChatGPT/Fishy/workstreams/precision-sculpt/qa/reference-packet/top.png)
- [Perspective](/Users/joshuabanzon/Documents/ChatGPT/Fishy/workstreams/precision-sculpt/qa/reference-packet/perspective.png)
- [Manifest](/Users/joshuabanzon/Documents/ChatGPT/Fishy/workstreams/precision-sculpt/qa/reference-packet/manifest.json)
- [Exact scene JSON](/Users/joshuabanzon/Documents/ChatGPT/Fishy/workstreams/precision-sculpt/qa/reference-packet/scene.json)

## Commands/evidence

- `unzip -t` on the downloaded archive.
- SHA-256 comparison of `scene.json` and every PNG against `manifest.json`.
- Recalculation of every `cameraSha256` from the extracted manifest records.
- `sips` dimension inspection of every PNG.
- Projection of actual tank/object bounds through `referenceCameras` after reading the exact extracted scene.
