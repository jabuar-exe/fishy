# Precision sculpt acceptance

Record observed results separately from source inspection. Use an isolated local QA origin for mutations/save testing; preserve existing production tabs and saves.

## Direct shape editing

1. Select a rock, wood and plant, then open the shape editor using visible actions. Verify the object shown matches the selected object and actual dimensions are reported in the stated units.
2. Push/pull an exposed area. The visible surface must change locally. Orbit must remain usable in its own mode without accidentally sculpting.
3. Verify brush radius/displacement units under rotation and nonuniform stretch. World-centimetre controls must not silently mean unscaled local centimetres.
4. Smooth a changed region; undo the stroke locally. Cancel the editor: canonical scene revision, geometry, protection and journal must remain unchanged.
5. Apply a multi-sample stroke/session once: canonical scene advances one revision; selected object becomes protected; Undo restores the exact original shape and protection, Redo restores the edited shape.
6. While a stroke/editor draft is active, keyboard Save/Undo/selection and proposal Apply cannot act on the underlying scene. Escape/cancel/lost-pointer-capture restores the appropriate state. Invalid/out-of-tank geometry cannot silently move the object to fit.
7. Save/reload on the isolated origin, rebuild and compare vertex positions, not only JSON keys. Unsupported sculpt versions/bases, invalid indices, oversized payloads and quota failures retain prior recoverable work and do not claim Saved.

## Duplication

1. Duplicate the sculpted object with one visible command. New ID, independent shape arrays, same original shape/material and valid nearby placement. Source remains byte-equivalent.
2. Sculpt the duplicate; source remains unchanged. Undo duplicate creation removes exactly that copy in one step.
3. No valid space and the 32-object limit produce clear errors without partial insertion or silent scaling.

## Reference packet

1. Start from the accepted sculpted scene. Export once. Confirm five images—front, left, right, top, overview—plus exact scene and camera/dimension metadata in one downloadable packet.
2. Inspect the actual downloaded files and image dimensions. Cardinal views use consistent scale/framing and correct orientation; all objects fit without clipping. Overview clearly states its projection.
3. All images/metadata bind to one frozen scene/revision and sculpt geometry. Export must not mutate editor camera/selection/scene or mix edits from later revisions.
4. Assumed/user-entered dimensions are identified honestly; reference views are design guidance rather than verified photographs. No source-photo or room-photo content is silently included.
5. Cancellation/failure must not create a success message or invalid partial packet. Temporary render resources and URLs are released.

## Integration

- Old supported saves migrate without overwriting the original record. Pending edits, protection, frontier imports and scene exports preserve the versioned shape contract.
- Bounded serialized history/journal prevents sculpture from exhausting storage silently.
- Check keyboard/focus and mobile layout at 390×844 and short-height viewport; Apply/Cancel, Duplicate and Export remain reachable.
- Build and relevant regression/geometry tests pass. Repeat the critical render/interaction smoke after private deployment; keep the same registered Site and private audience.
