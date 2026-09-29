# Deccan Imperia Website Handover

## What this folder contains

This is a complete static website. It does not require React, a database, a build step or a paid video
service. The production entry point is `index.html`.

- `index.html` — flagship home page with 3D photoreal scroll walkthrough and sections
- `about.html` — About Tathe Deshmukh Builder & Developer (200-year heritage, founders, philosophy)
- `projects.html` — Deccan Imperia Phase 1, Phase 2, Tathe Deshmukh Nagar, specifications matrix & gallery
- `contact.html` — site visit booking form, NAP coordinates, drive times, and FAQ
- `css/style.css` — desktop, mobile and reduced-motion design across all pages
- `js/main.js` — GSAP scroll journey and interface behavior for index.html
- `js/depth.js` — WebGL depth-parallax renderer
- `js/nav.js` — shared navigation, mobile drawer toggle, and brochure download handler
- `assets/brochure/` — official developer brochure PDF (`Tathe Deshmukh Builders & Developer.pdf`)
- `assets/logo/` — official Tathe Deshmukh brand logo (`logo.png`)
- `assets/tour/` — walkthrough images, phone variants and depth maps
- `assets/img/` — plans and supporting property images
- `assets/video/` — archived experiments; the active page does not load these videos
- `serve.js` / `serve.py` — optional local preview servers

## Run locally

Opening `index.html` directly works with the lighter CSS motion fallback. A local server is strongly
recommended because it enables the full WebGL depth-camera effect and makes browsers treat every
asset consistently.

With Node.js:

```bash
node serve.js 8788
```

Then open `http://127.0.0.1:8788/`.

With Python:

```bash
python3 serve.py 8788
```

## Publish

Upload the contents of this folder—not the enclosing folder—to any static host such as Netlify,
Cloudflare Pages, GitHub Pages, an Apache/Nginx server or the public folder of an existing site. Keep
the directory structure unchanged because asset paths are relative.

No environment variables or API keys are required. The enquiry form opens WhatsApp and currently
sends to `+91 90285 61515`; update the `wa.me` number near the end of `js/main.js` if required.

## Approved active walkthrough order

1. The Row
2. The Residence
3. Arrival — one continuous moving exterior image
4. Ground Floor — Living Room, Kitchen & Dining, Ground Bedroom, Bathroom, Staircase
5. First Floor — Upper Bedroom, Ensuite, Private Terrace, Garden Deck
6. Plans, Heritage, Location and Enquiry

Chapter handoffs use a stationary opacity blink. Incoming chapters remain hidden until they reach the
fixed full-screen position; they must not rise upward from below.

## Important editing rules

- Do not cross-dissolve two architectural images with different geometry; this creates ghost doors and
  furniture.
- Keep the Arrival exterior as `004-gate-open.webp` and the next Ground Floor slide as
  `006-living-entry.webp` unless a new deterministic 3D camera render is supplied.
- Every desktop tour image should have a `-m.webp` phone version and matching `-depth.png` and
  `-depth-m.png` files when depth movement is enabled.
- Test chapter boundaries both forward and backward after changing scroll lengths.
- Preserve the phone rules below 860 px and the `prefers-reduced-motion` fallback.

## Notes for Claude or another coding assistant

- Treat `js/main.js`, `js/depth.js` and the cinematic scene markup at the top of `index.html` as the
  approved motion engine. Do not replace them with a multi-image crossfade or a second smooth-scroll
  layer unless the client explicitly requests a new motion system.
- Keep Lenis on the current light `lerp` configuration and keep the main scene scrub at `0.75`.
  Increasing both values makes the camera trail behind the user's scroll and can feel frozen.
- Do not re-add `stair-ascent`, `upper-landing` or the archived Arrival bridge frames.
- Preview through `node serve.js 8788`; some editor file previews restrict local WebGL textures.

## Current verification

- JavaScript syntax check passes.
- Desktop and phone layouts have no horizontal overflow at the tested widths.
- Arrival ends at the exact boundary where the approved Living Room slide starts.
- The dedicated stair-climb and first-floor landing chapters have been removed.
- The active page uses no video and needs no Runway subscription.
- The site falls back safely to CSS depth motion when opened through `file://`.
