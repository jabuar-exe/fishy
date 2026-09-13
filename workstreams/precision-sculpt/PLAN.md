# Direct shaping and precise reference views

User request: open an object in the tank and shape it like playdough; easily duplicate objects; increase realism; provide five reference images/angles for communicating the design. Precision takes priority.

## Working scope

- Add an explicit object shape editor with real local surface deformation, a visible brush, bounded radius/strength, suitable push/pull/grab controls, and local undo. Apply commits the accepted shape atomically; Cancel restores the original. Include a keyboard-accessible adjustment path. Do not disguise global size sliders as sculpting.
- Cover wood, rock and plant objects honestly. This is surface deformation of existing geometry, not Boolean fusion, remeshing, cutting or a botanical simulation. Explain limits only where they affect the action.
- Persist shape data with a strict version and deterministic base geometry. The renderer, shape bounds, save/reload, duplication and image export must all reconstruct the same surface. Reject unsupported topology/version data rather than silently changing the sculpture.
- Keep object identity, position and rotation fixed while sculpting. A boundary violation must not silently reposition the object. Accepted human sculpture automatically protects the affected object from proposals.
- Add a visible Duplicate command near object actions. Deep-copy geometry data, issue a fresh object ID, choose a valid nearby placement without altering the source, and make it one scene undo step. Show an actionable no-fit/object-limit result.
- Export a reference packet from one frozen scene revision: front, left, right, top and perspective overview; five images plus exact scene/camera/dimension metadata. Prefer orthographic cardinal views. Do not generate separately hallucinated images or let editing mid-export mix revisions.

The user was asked whether “five iterations and angles” means five views of one design or five different variations. Working assumption is five views of one design because that supports precision; incorporate the response if supplied.

## Precision boundary

Exact digital geometry and numeric measurements do not establish that an unknown real piece of wood or rock has the same shape. Entered tank dimensions are not independently verified measurements. Keep these distinctions visible in export metadata. The existing native experiment remains frozen and separate; new browser sculpting does not inherit its scores.

Visual fidelity should come from improved actual geometry, surface materials and consistent rendering. Reference images must depict the saved shape exactly. Photorealistic image generation is unsuitable as the authority for fabrication dimensions or multi-angle identity.

## Ownership and checks

The existing “Build Fishy with Terra and Astra” task remains sole owner of the Site checkout and private publication. Root coordinates requirements, independent read-only review and browser acceptance. No competing Site checkout or deployment project.

Focused checks cover object-local versus world deformation under rotation/nonuniform scale; reconstructed vertices after save/reload; bounds and unsupported data; protected sculpt fields and hostile proposals; duplicate independence; atomic Apply/Undo/Cancel/stale handling; pending edits during Save/Export; old-save migration without overwriting originals; bounded history/storage; and five-view camera/image correspondence.

A release record will distinguish actual observed behavior from unproven realism or physical accuracy, and identify the final private deployment.
