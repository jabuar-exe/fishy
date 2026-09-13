# Fishy interface design: recommendation

13 September 2026. This is a recommendation for the editor screen and the demo, to be weighed against other considerations. It does not change any site code. It applies the same discipline to the interface that [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) applies to the tank. Sources: the hackathon and UI notes exported from Notion, the Aqua Show gallery tour, and the current site prototype in `site/`.

## The recommendation in one line

**The tank is the hero. The interface is the frame. Every screen decision should make the rendered aquarium read better and the review findings easier to act on, and nothing else.**

## Eight decisions

| # | Decision | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Layout | One screen, three zones: reference photo left, 3D canvas centre at 60 percent or more of the width, findings and controls right. No tabs for the core flow. | The demo must never leave the tank. Judges compare photo, model, and verdict in one glance, which is the product's proof. |
| 2 | Palette | Dark, low-saturation frame in the blue-green the prototype already uses. One warm accent for warnings, one cool accent for selection. No other colour in the interface. | Rendered wood, stone, and plants carry all the colour. A saturated frame competes with the aquarium the way a visible filter competes with a layout. |
| 3 | Findings | Show the design review as three ranked lines under the canvas, warnings first, each naming the principle and the object. No score, no gauge, no percentage. | A named finding is actionable and honest. A score invites argument and implies biological judgement Fishy does not make. |
| 4 | Selection | Selected object gets a thin outline in the cool accent and its name in the findings panel. Everything else stays untouched. | Gestalt proximity and good figure: the eye groups outline, name, and finding into one thing. |
| 5 | Motion | Every interface transition under 300 ms. Never animate drag, undo, selection, or keyboard actions. Orbit is the only motion the user should feel. | Frequent actions with animation irritate. Perceived speed matters more than polish in a tool. |
| 6 | Typography | One sans family, three sizes: a 10 to 11 px letter-spaced label, a 13 px body, a 19 px title. No display faces. | The prototype already does this well. Adding type variety adds noise around the canvas. |
| 7 | States | Design the empty, loading, and error states before adding features. Empty shows a sample tank with its review. Loading keeps the last valid scene visible. Error names what failed and preserves state. | Hackathon demos break at state transitions, not in the happy path. A visible last-valid scene protects the demo. |
| 8 | Effects | Exclude liquid glass, shader gradients, border beams, and hero animations from the editor screen. Allow one restrained water surface and caustic effect inside the tank only. | Effects outside the tank violate the negative-space principle. Inside the tank they serve the mood principle. |

## Demo structure

Follow the pitch structure from the notes: hook, problem, solution, demo, close, with the demo taking most of the time.

1. **Hook, 15 seconds.** A real mediocre tank photo full screen. Nothing else.
2. **Problem, 30 seconds.** The design review appears under it: no sightline, hardscape underweight, floor cluttered. Three lines, no score. The judge now knows what a good tank is.
3. **Solution, 30 seconds.** The photo becomes an editable 3D tank beside it. Same three findings, now attached to objects.
4. **Demo, 3 minutes.** One spoken request, one correction, one manual drag, the findings updating each time, undo restoring state.
5. **Close, 15 seconds.** The eight principles on one slide, mapped to the judging rubric.

Build for that demo only. Skip login, dashboards, galleries, and settings for the hackathon build.

## What to cut from the three-track plan

The notes say one to two features maximum. The current plan carries three tracks. Ranking by demo value against build risk:

| Track | Keep or cut | Reason |
| --- | --- | --- |
| Photo to reviewed 3D plan | Keep, primary | This is the hook, the problem, and the solution in one path. It already runs end to end. |
| Voice correction | Keep, secondary | It makes the review conversational and shows the correction loop. Reuse the same findings as spoken lines. |
| Image proposals | Cut for the hackathon | Two generated images add latency of up to two minutes, a second visual language on screen, and a mesh-to-image mismatch to explain. Move to future work. |

This is a recommendation about the demo, not about the product roadmap. The product design documents already record image proposals as a target capability.

## Trade-offs to weigh

- **Dark frame versus screenshot appeal.** A dark frame makes the tank pop live but photographs flatter than a bright interface in a slide deck. If deck screenshots matter more than the live demo, revisit decision 2.
- **Three findings versus completeness.** Showing three lines hides the rest of the review. A collapsed "all findings" list under the three keeps the detail reachable without changing the default.
- **Cutting image proposals versus track coverage.** If the event scores each track separately and the team wants three entries, the image track can run as a pre-generated, clearly labelled comparison outside the live editor. That keeps the editor screen clean.
- **Motion budget versus delight.** A 300 ms budget forbids the entrance animations in the linked libraries. The delight should come from the water and the orbit, not from panels.

## How this relates to the tank principles

The interface follows the same principles the tank does. Hardscape first becomes canvas first. Sightline becomes the photo to model to finding reading order. Contrast becomes one warm and one cool accent on a neutral ground. Negative space becomes no effects outside the tank. Story becomes the hook photo and its three findings. Maintenance becomes states designed before features. A judge who is told this once will see it everywhere on the screen.

## Cost

Decisions 1 to 6 and 8 are constraints, not work: they remove options for whoever is building `site/app/page.tsx` and `site/components/fishy-viewport.tsx`. Decision 7 is roughly one focused hour. Wiring the findings panel to `site/lib/design.ts` is roughly one more.
