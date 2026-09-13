# Research input provenance

## Candidate W1 — verified same-scene pair, but not a multiview test set

Two full-resolution, original-size Wikimedia Commons photographs from the same
author's rapid capture burst show the same planted freshwater aquarium.  The
wide shot and close-up share the distinctive striped dark boulder, its attached
dark-leaf clump, the red-stem planting, and the foreground carpet.

| Role | Local file | Source | Capture metadata | SHA-256 |
| --- | --- | --- | --- | --- |
| wide/front | `commons-sharjah/04_freshwater_aquarium_uae.jpg` | [Commons file page](https://commons.wikimedia.org/wiki/File:Freshwater_aquarium_U.A.E.jpg) | 2016-12-06 21:34:36; iPhone 6s Plus, f/2.2, 4.15 mm (29 mm equivalent); 4032 x 3024 | `cf5e3efe2dfffed547005b22ee71d3e3477d640ff44c44870b3246902786635e` |
| left hardscape close-up | `commons-sharjah/02_freshwater_aquariums_sharjah.jpg` | [Commons file page](https://commons.wikimedia.org/wiki/File:Freshwater_aquariums_Sharjah.jpg) | 2016-12-06 21:34:28; iPhone 6s Plus, f/2.2, 4.15 mm (29 mm equivalent); 4032 x 3024 | `5d9e077d0c1108d5d07f0465be727cc2cf4171070eb4fc53b37d6541bc6af026` |

Both pages identify the work as **own work by Ranjith-chemmad** and license it
under **CC BY-SA 4.0**.  Their camera coordinates are within metres and their
capture times are eight seconds apart.  Neither photo carries a calibrated
camera pose.  `02` is a close-up rather than a meaningfully distinct full-tank
view, so this is useful visual reference evidence only: it does **not** meet a
three-view held-out reconstruction evaluation requirement.  `01` and `03` in
the same folder were inspected and are not asserted to be the same tank.

## Rejected sources

* **AquaMVS example dataset**, [Zenodo 10.5281/zenodo.18725007](https://doi.org/10.5281/zenodo.18725007), CC BY 4.0: 13 synchronized and calibrated 1600 x 1200 above-water camera views at each time point.  The locally extracted same-time frames show a circular experimental tank with bare granular substrate, no planted aquascape or identifiable wood/rock hardscape.  It may be a refractive-calibration fixture, but is out of scope for the target scene.
* **INRIA/Chaurasia Aquarium-20**, [official dataset page](https://www-sop.inria.fr/reves/Basilic/2011/CSD11/): its README limits it to research and academic purposes.  Local inspection shows it is a 19-view exterior capture of an aquarium building, not a fish tank; reject.
* **Wikimedia Commons video: Aquário com plantas aquáticas**, [file page](https://commons.wikimedia.org/wiki/File:Aqu%C3%A1rio_com_plantas_aqu%C3%A1ticas.webm), CC BY-SA 4.0: a real planted tank with driftwood and rocks, but a fixed camera.  Extracted times differ only in fish positions, not viewpoint; reject as multiview input.

## Candidate W2 — first-party moving-camera video; rights unknown beyond public viewing

[Green Aqua — “BEAUTIFUL AQUASCAPE with 360 view”](https://www.youtube.com/watch?v=yuoS1RNBY7Y)
is a first-party public YouTube video by Green Aqua (video id `yuoS1RNBY7Y`,
published 2018-10-06).  I inspected the actual 197.208-second video, rather
than relying on the title.  Between 80 s and 145 s its moving camera observes
one unchanged, completed planted hardscape: the same large left rock mass,
small central foreground stones, pale-sand channel, right dark boulder, red
plant cluster, and emersed grasses remain fixed.  The selected frames provide
three genuinely distinct physical viewpoints plus a separate prospective
hold-out:

| Role | Video time | Local analysis frame | Viewpoint | SHA-256 |
| --- | --- | --- | --- | --- |
| prospective input A | 00:01:20 | `green_aqua_360/view_a_left_perspective_80s.png` | low/front composition, left rock mass and sand channel | `9c5ade526a564cde48b1a48a011238a40a052d4bef010ae68d1bb51eea8b2bb4` |
| prospective input B | 00:01:45 | `green_aqua_360/view_b_top_105s.png` | elevated left-front, showing the left glass side and full hardscape depth | `5741f4012b6dc2cb42e25bb626305675f193ce5f6cee7b9d63fcc0d1b2a1daaf` |
| prospective input C | 00:02:05 | `green_aqua_360/view_c_front_125s.png` | near-top-down view of the planted left bank, boulder, and sand path | `2e51bdcc21e5fed822e2917955d9eed7add52779ea52563f09889050e17bdbf7` |
| prospective hold-out | 00:02:25 | `green_aqua_360/heldout_d_right_perspective_145s.png` | clean full front view | `5dd22e6ae61a704237ef86ea01ae80f60781d28d970c72cbdc883da1c3399956` |

**Actual usage status (final):** A80, B105, and C125 were the three inputs to
the actual Astra W2 runs `043221Z` and `043532Z`.  D145 was reserved and
frozen as the held-out evaluation view; that evaluation is complete.  The
separate 115 s follow-up frame below belongs to an unscored W1/W3 branch and
was not part of W2 input or W2 evaluation.

The original analysis copy is `green_aqua_360/green_aqua_360.mp4`: public
640 x 360 H.264 stream at 24 fps, SHA-256
`922e638afc492044ba31d56a8e48617580a8e3dfbed45ce6dca24317368c2754`.
Dimensions and camera calibration are unknown.  This is a visually verified
same-scene, multi-angle input source, but not a calibrated metric data set.
The YouTube metadata returned no reusable license (`NA`): treat the source and
locally extracted frames as private analysis material only.  Do **not** rehost
video or frames in the deployed site, and do not claim redistribution rights.

### W2 follow-up evidence: left foundation close-up

`green_aqua_360/request_r2_1_left_foundation_closeup_115s.png` is an actual,
separately sampled video frame at **00:01:55**, outside the 135–155 s
prospective hold-out interval and distinct from the 80 s, 105 s, and 125 s
views.  It is 640 x 360 and SHA-256
`a0331ad408f771fa0c40a4d1042edf08a8fcd31ef25139470038e252463720e4`.
It provides a physical close view of the left-bank foundation: one large,
dark, craggy foreground boulder carries the visual base, with separate smaller
ledges/rocks immediately behind and below it.  Green foliage obscures the
upper transition into the bank, so the precise upper boundary and full count
of buried stones remain indeterminate.  This is not a crop of another selected
frame and is not an independent photograph; it is a later frame from the same
moving-camera source.
