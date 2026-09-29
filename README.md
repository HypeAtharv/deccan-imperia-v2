# Deccan Imperia — scroll film

A scroll-driven site built from the architect's renders. No Blender, no video, no frame sequences.

## Run it
```bash
node serve.js 8788     # then open http://127.0.0.1:8788
```

## How the motion works
Every render ships with a **depth map** (generated with Depth-Anything-V2, white = near).
`js/depth.js` is a small WebGL renderer that samples each pixel through that depth, so:

* **parallax** — near surfaces slide further than far ones on a lateral move
* **dolly** — near surfaces grow faster than far ones on a push-in

That second one is the difference between a camera *moving through* a scene and a photo being
zoomed. It's why the walk through the gate reads as walking rather than scaling.

`js/main.js` holds a virtual camera per shot — `{fx, fy, z, px, py, dolly}` — and GSAP scrubs
that state against scroll. Because it's plain numbers driven by scroll position, the film is
deterministic and exactly reversible.

## Structure
```
index.html          five scroll scenes + static sections
css/style.css       sticky stages, type, layout
js/depth.js         WebGL depth renderer
js/main.js          cameras, choreography, room tours, UI
assets/img/         *.webp (colour) + *-depth.png, each with a -m mobile variant
```

## Page structure
| # | Section | |
|---|---|---|
| 01 | The Row | film |
| 02 | The Residence | film |
| 03 | Arrival | film |
| 04 | Ground Floor | film |
| 05 | First Floor | film |
| 06 | Plans | plot/built-up facts + switchable floor plans |
| 07 | Specification | six groups, verbatim from the developer's brochure |
| 08 | Amenities | eight items |
| 09 | Heritage | the 200-year agarbatti story |
| 10 | Location | named landmarks with drive times |
| — | Contact | enquiry → WhatsApp |

The film scenes carry their own labels rather than numbers, so 01, 04 and 05 do not appear
as numbered eyebrows — the chapter rail names them instead.

## The film
| Scene | What happens |
|---|---|
| Arrival | The architect's pencil sketch is wiped left-to-right into the finished dusk render |
| The Row | Dolly down the street, cut to the frontal panorama, lateral track across the row |
| The Residence | Arc round the corner unit, then dolly through the gate to the door |
| Ground Floor | Seven stops: arrival, living, kitchen, dining, bedroom, bathroom, stair |
| First Floor | Six stops: landing, master, bathroom, terrace, deck, garden balcony |

Interior camera stops are read off the cutaways with a 10 × 10 grid overlay, so each stop
frames a real room rather than an arbitrary crop.

## Payload
| | This build | Live site (tathedeccan.hypeos.in) |
|---|---|---|
| Mobile first load | **0.98 MB** | ~19 MB |
| Desktop first load | **3.52 MB** | ~19 MB |
| Full tour | same (nothing else to fetch) | **~160 MB** (500 frames × 1920×1080) |

The live site scrubs 100-frame WebP sequences per chapter. This gets the same camera motion
from one still per scene plus a depth map — roughly 1/160th of the bytes.

## Regenerating depth maps
```bash
uv venv -p 3.12 depthenv && uv pip install --python depthenv/bin/python torch transformers pillow
depthenv/bin/python make_depth.py assets/img
```

## Known gaps
* Copy is placeholder in places; pricing and availability aren't published anywhere yet.
* The enquiry form opens a prefilled WhatsApp chat — no backend.
* Unit count is deliberately not stated: the references show 5–6 and it was never confirmed.
* `prefers-reduced-motion` unpins everything and shows the stills in order.
