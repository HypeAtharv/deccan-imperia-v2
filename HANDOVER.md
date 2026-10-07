# Deccan Imperia Website Handover

## What this folder contains

This is a complete static website. It does not require React, a database, a build step or a paid video
service. The production entry point is `index.html`.

- `index.html` — page structure and content
- `about.html` — family legacy and builder story
- `projects.html` — project presentation, plans and lived spaces
- `contact.html` — site-visit experience, directions and WhatsApp enquiry
- `css/style.css` — desktop, mobile and reduced-motion design
- `css/editorial.css` — shared white-and-navy editorial design for all pages
- `js/main.js` — GSAP scroll journey and interface behavior
- `js/depth.js` — WebGL depth-parallax renderer
- `js/editorial.js` — mobile navigation, plan tabs, FAQs and contact form
- `js/vendor/` — local GSAP, ScrollTrigger and Lenis files
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

No environment variables or API keys are required. The enquiry forms open WhatsApp and currently
send to the primary contact, `+91 99703 53935`. The other contact numbers remain `+91 90285 61515`
and `+91 81492 91515`.

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
- About, Projects and Contact use the approved white-and-navy system and new Maharashtrian family
  lifestyle photography in `assets/lifestyle/`.
- The editorial pages have no horizontal overflow at 390 px and share direct navigation with Home.
- The Home information sections have explicit high-contrast colours, including `sq.ft.`, travel-time,
  amenity, specification, form and footer labels.
- Contact includes a responsive animated route map in “How to reach us”; the moving route markers are
  embedded SVG animation and require no map account, API key or paid service.
- Four additional compressed lifestyle photographs in `assets/lifestyle/` show Maharashtrian
  community, dining, terrace and consultation moments. They are used on Home, About and Projects and
  should remain lazy-loaded below the hero areas.
- The Home and editorial headers all include a tested phone menu. On mobile, the cinematic tour keeps
  its CSS camera movement while omitting additional WebGL depth-map downloads for faster first load.
- `vercel.json` applies long-lived immutable caching to versioned static assets, and `.vercelignore`
  excludes archived video experiments and development-only files from production uploads.
- On 30 September, Projects gained a neighbourhood image and a compact full-family exterior photo
  under the home facts. The earlier two-image gallery was removed after mobile review because it
  made the section too long. The unused generated image is preserved as
  `assets/lifestyle/family-living-generations.webp` (1672 × 941, about 168 KB).
- Projects and About now use the photorealistic tour exteriors instead of the older CGI-style
  `assets/img/hero-corner.webp` and `assets/img/row-oblique-dusk.webp`. Floor plans remain diagrams.
- The current production site is `https://site-pied-two-99.vercel.app/`. The Projects and About
  images were checked in the live browser after deployment.
- The Home amenities family image uses a 20% horizontal focal point below 600 px so the grandfather
  and the rest of the group remain visible on phones.
