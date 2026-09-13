# Queued task: dive-in view (walk inside the tank)

Queued 13 September 2026. **Do not start until the environment quality work is accepted** (see gate below). Origin: the user watched a creator's Astra tour (Blender MCP → Unreal first-person walkabout of St Paul's, 2:37) and asked whether Fishy could let the user "jump inside the fishtank and interact with everything as a small person." Assessment: this is a camera mode on the existing Three.js viewport, not new geometry or architecture.

## Gate

Start only when all of these hold on the deployed editor:

1. The water surface, caustics, and lighting pass in [design-lab/PRODUCT_DIRECTION.md](../design-lab/PRODUCT_DIRECTION.md) ("First: transparent surface, subtle moving normals, edge reflections, animated caustics") is merged and profiled within the rendering budget on the demo device.
2. Wood, rock, and plant meshes hold up at close range. Test: place the camera 3 cm above the substrate, 5 cm from each object class, and confirm no visible faceting, missing backfaces, or texture stretch. Add subdivision or normal maps to the builder first if this fails.
3. Orbit, select, drag, undo, and the design-review panel are stable. Dive-in reuses all of them; it must not fork the scene state.

## Outcome

A "Dive in" toggle in the viewport. Switching in places the camera inside the tank at small-person scale, lets the user walk over the substrate and look around, and keeps click-to-select and the findings panel working. Switching out returns to the previous orbit framing. Scene state, revision, and undo history are untouched by the mode change.

## Scope

**Phase 1 (target: one afternoon)**

- Camera mode switch in `site/components/fishy-viewport.tsx`: swap `OrbitControls` for `PointerLockControls` (or a touch-friendly look control) on toggle; restore the orbit camera position and target on exit.
- Eye height ≈ 3 cm above substrate top; field of view widened from 36° to about 70°; near plane already 0.005 m, verify no clipping.
- WASD / arrow movement at a slow speed (~5 cm/s) to sell scale. Clamp position to the inner tank volume minus a small margin.
- Downward raycast against substrate and hardscape so the camera stays on the floor and steps onto rocks; horizontal raycast to block walking through wood and rock.
- Exit on Escape or toggle. Mobile: an on-screen joystick or omit movement and allow look-only.

**Phase 2**

- Selection and outline from inside: reuse the existing raycast-select path; findings panel names the object as it does today.
- Water surface visible overhead with caustic light on the floor. Slight blue-green fog with distance inside the water volume.
- Optional "look at focal object" button so the demo lands on the composition's sightline.

**Explicitly out of scope**

- Physics, swimming, buoyancy, fish behaviour, true refraction. These are the parts most likely to break a demo.

## Acceptance

- Toggle in and out ten times: revision number and undo stack unchanged, orbit framing restored.
- Walk the full floor of the 60 × 30 × 36 cm fixture without leaving the tank or passing through hardscape.
- Frame rate on the demo device stays within the budget measured for the orbit view (record both numbers).
- Selecting each editable object from inside shows the same finding as from outside.

## Notes from the reference video

The creator's cathedral walkabout worked because the geometry was architectural and clean. Organic forms (characters) came out poorly. Expect the same: hardscape detail at 3 cm eye height is the risk, which is why the gate above is mesh quality, not controls.
