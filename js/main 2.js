/* ==========================================================================
   Deccan Imperia — scroll film engine
   --------------------------------------------------------------------------
   Every scene is a pinned stage with a VIRTUAL CAMERA over a still image.
   The camera state is { fx, fy, z }:
       fx, fy  normalised focus point on the image (0..1)
       z       zoom relative to the image's base fit ("cover" or "contain")
   GSAP tweens that state against scroll (scrub), and apply() turns it into a
   transform. Because the state is plain numbers driven by scroll position,
   every move is deterministic and exactly reversible.

   Upscale guard: the architect's renders are only 1600 px wide, so the final
   on-screen scale is capped at MAX_SCALE x native. Beyond that they go soft.
   ========================================================================== */
(() => {
  "use strict";

  const MAX_SCALE   = 1.5;    // never draw a source pixel bigger than this
  const CONTAIN_PAD = 0.92;   // breathing room around "contain" cutaways
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNarrow = () => innerWidth < 760;

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  wireStaticUI();
  if (reduce || !window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------ smooth scroll */
  const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  document.documentElement.classList.add("lenis");
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const t = $(a.getAttribute("href"));
    if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.6 }); }
  }));

  /* ------------------------------------------------------------ camera */
  const appliers = [];

  function camera(img, fit) {
    // apply() reads self.state (not a closed-over const) so two layers can SHARE one state
    const self = { state: { fx: 0.5, fy: 0.5, z: 1, px: 0, py: 0, dolly: 0 }, gl: null };
    const zMul = () => (fit === "contain" && isNarrow() ? 1.75 : 1);
    function apply() {
      const state = self.state;
      const box = img.parentElement;
      const vw = box.clientWidth, vh = box.clientHeight;
      const nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) return;
      const base = fit === "cover"
        ? Math.max(vw / nw, vh / nh)
        : Math.min(vw / nw, vh / nh) * CONTAIN_PAD;
      // with depth displacement on, overscan cover shots slightly so shifted samples stay inside
      const over = self.gl && fit === "cover" ? 1.05 : 1;
      let s = base * state.z * zMul() * over;
      // Upscale guard, measured in REAL source pixels. With srcset the browser reports a
      // density-corrected naturalWidth (e.g. 1440 for a 2000 px file), so capping against
      // naturalWidth would clamp ~40% too early. Displayed px per source px must stay <= MAX_SCALE.
      const realW = img.currentSrc && /-m\.webp/.test(img.currentSrc) ? 1000 : 2000;
      const cap = MAX_SCALE * realW / nw;
      s = Math.min(s, Math.max(base, cap));
      const w = nw * s, h = nh * s;
      let tx = vw / 2 - state.fx * w;
      let ty = vh / 2 - state.fy * h;
      if (fit === "cover") {                                 // never show an edge
        tx = clamp(tx, vw - w, 0);
        ty = clamp(ty, vh - h, 0);
      } else {                                               // centre if smaller
        tx = w <= vw ? (vw - w) / 2 : clamp(tx, vw - w - vw * 0.25, vw * 0.25);
        ty = h <= vh ? (vh - h) / 2 : clamp(ty, vh - h - vh * 0.25, vh * 0.25);
      }
      if (self.gl) {
        self.gl.renderer.frame(self.gl.layer, {
          s, tx, ty, nw, nh, fx: state.fx, fy: state.fy,
          px: state.px || 0, py: state.py || 0, dolly: state.dolly || 0
        });
        return;
      }
      img.style.width = nw + "px";
      img.style.height = nh + "px";
      img.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${s})`;
    }
    appliers.push(apply);
    const ready = img.complete && img.naturalWidth ? Promise.resolve() :
      new Promise(r => img.addEventListener("load", r, { once: true }));
    ready.then(apply);
    self.apply = apply; self.ready = ready;
    return self;
  }

  /** Tween a camera to a pose inside a timeline. */
  function move(tl, cam, pose, at, dur = 1, ease = "power2.inOut") {
    tl.to(cam.state, { ...pose, duration: dur, ease, onUpdate: cam.apply }, at);
  }

  function pinScene(id) {
    const section = $("#" + id);
    const stage = $(".stage", section);
    const len = +section.dataset.len || 300;
    // section is one viewport for the sticky stage + `len`% of travel
    section.style.height = `calc(100svh + ${len}svh)`;
    const tl = gsap.timeline({ defaults: { ease: "none" } });
    const hooks = {};
    ScrollTrigger.create({
      trigger: section, start: "top top", end: "bottom bottom",
      scrub: 0.9, animation: tl,
      onToggle: self => self.isActive && setChapter(id),
      onUpdate: self => hooks.onUpdate && hooks.onUpdate(self)
    });
    return { section, stage, tl, hooks };
  }

  const cams = {};
  $$(".cam").forEach(c => $$(".shot", c).forEach(img => {
    cams[img.dataset.shot] = camera(img, c.dataset.fit);
  }));
  /* ------------------------------------------------------------ depth renderers */
  // focus = the depth that stays put while the camera moves (roughly the subject's depth)
  const DEPTH = {
    dusk: { focus: 0.5 }, sketch: { focus: 0.5, wipe: true, depthFrom: "dusk" },
    oblique: { focus: 0.5 }, pano: { focus: 0.55 },
    corner: { focus: 0.52 }, front: { focus: 0.58 },
    ground: { focus: 0.35, contain: true }, first: { focus: 0.35, contain: true },
  };
  const renderers = [];
  if (window.DepthStage) {
    $$(".cam").forEach(camEl => {
      const r = DepthStage.create(camEl);
      if (!r) return;
      renderers.push({ r, scene: camEl.closest(".scene") });
      addEventListener("resize", () => r.schedule(), { passive: true });
      $$(".shot", camEl).forEach(img => {
        const key = img.dataset.shot, opt = { ...(DEPTH[key] || {}) };
        if (opt.depthFrom) opt.depthFrom = $(`[data-shot="${opt.depthFrom}"]`);
        r.add(img, opt).then(layer => {
          if (!layer.ready) return;
          cams[key].gl = { renderer: r, layer };
          cams[key].apply();
        });
      });
    });
  }

  // Short on purpose: a fade that runs past 1.0 stretches the whole scene's timeline and
  // pulls every later event (veils, wipes) earlier than designed.
  const fade = (tl, sel, to, at, dur = 0.1) =>
    tl.to(sel, { opacity: to, y: to ? 0 : -18, duration: dur, ease: "power2.out" }, at);

  /* ============================================================ 01 intro */
  {
    const { tl, section } = pinScene("intro");
    // The sketch is pixel-registered to the dusk render (verified: 0,0 edge offset), so both
    // layers share ONE camera state and move as a single image.
    const c = cams.dusk, sk = cams.sketch;
    sk.state = c.state;
    const both = () => { c.apply(); sk.apply(); };
    Object.assign(c.state, { fx: 0.54, fy: 0.5, z: 1.0, px: -0.018, dolly: 0 });
    tl.to(c.state, { fx: 0.62, fy: 0.54, z: 1.04, px: 0.022, dolly: 0.26,
                     duration: 1, ease: "sine.inOut", onUpdate: both }, 0);
    // drawing -> render, painted in left to right
    const sketchEl = $('[data-shot="sketch"]', section);
    tl.fromTo(sketchEl, { "--rev": "-30%" }, { "--rev": "125%", duration: 0.62, ease: "power1.inOut" }, 0.08);
    tl.to($(".intro-copy", section), { opacity: 0, y: -60, duration: 0.4, ease: "power1.in" }, 0.58);
  }

  /* ============================================================ 02 the row */
  {
    const { tl, section } = pinScene("row");
    const ob = cams.oblique, pano = cams.pano;
    Object.assign(ob.state, { fx: 0.62, fy: 0.5, z: 1.0, px: 0, dolly: 0 });
    Object.assign(pano.state, { fx: 0.0, fy: 0.5, z: 1.32, px: -0.03, dolly: 0 });
    const panoImg = $('[data-shot="pano"]', section), obImg = $('[data-shot="oblique"]', section);
    const count = $(".unit-count", section), countN = $(".uc-n", section);

    // A · dolly along the oblique
    // walking down the street: a real dolly, the near wall and planters rush past
    move(tl, ob, { fx: 0.42, fy: 0.54, z: 1.14, px: 0.028, dolly: 0.55 }, 0, 0.26, "sine.inOut");
    fade(tl, '[data-cap="row-a"]', 1, 0.03);
    fade(tl, '[data-cap="row-a"]', 0, 0.2);

    // B · cross-dissolve to the frontal panorama
    // near-cut between angles: real film cuts; a long dissolve double-exposes two viewpoints
    tl.to(panoImg, { opacity: 1, duration: 0.025, ease: "power1.inOut" }, 0.27);
    tl.to(obImg, { opacity: 0, duration: 0.02 }, 0.285);

    // C · the traverse: LEFT TO RIGHT across the whole row
    // lateral track: lawn and street slide faster than the villas, sky slower
    move(tl, pano, { fx: 1.0, fy: 0.52, z: 1.32, px: 0.045 }, 0.3, 0.62, "none");
    tl.to(count, { opacity: 1, duration: 0.05 }, 0.3);
    tl.to(count, { opacity: 0, duration: 0.05 }, 0.9);
    fade(tl, '[data-cap="row-b"]', 1, 0.58);
    fade(tl, '[data-cap="row-b"]', 0, 0.86);
    const counter = { u: 1 };
    tl.to(counter, {
      u: 5, duration: 0.6, ease: "none",
      onUpdate: () => { countN.textContent = String(Math.round(counter.u)).padStart(2, "0"); }
    }, 0.31);
  }

  /* ============================================================ 03 the residence */
  {
    const { tl, section } = pinScene("residence");
    const corner = cams.corner, front = cams.front;
    Object.assign(corner.state, { fx: 0.6, fy: 0.5, z: 1.0, px: -0.025, dolly: 0 });
    Object.assign(front.state, { fx: 0.5, fy: 0.55, z: 1.0, px: 0, dolly: 0 });

    // a slow arc round the corner: parallax sells the orbit
    move(tl, corner, { fx: 0.5, fy: 0.56, z: 1.1, px: 0.03, dolly: 0.2 }, 0, 0.4, "sine.inOut");
    fade(tl, '[data-cap="res-a"]', 1, 0.04);
    fade(tl, '[data-cap="res-a"]', 0, 0.32);

    tl.to($('[data-shot="front"]', section), { opacity: 1, duration: 0.025, ease: "power1.inOut" }, 0.41);
    tl.to($('[data-shot="corner"]', section), { opacity: 0, duration: 0.02 }, 0.425);

    // push through the gate toward the front door
    // walk through the gate toward the door: dolly, not zoom
    move(tl, front, { fx: 0.55, fy: 0.64, z: 1.9, dolly: 0.7, px: 0.01 }, 0.44, 0.52, "power2.in");
    fade(tl, '[data-cap="res-b"]', 1, 0.5);
    fade(tl, '[data-cap="res-b"]', 0, 0.9);
    // hold the render visible right up to the doorway, then close fast into the interior
    tl.set($(".veil", section), { opacity: 0 }, 0);
    tl.to($(".veil", section), { opacity: 1, duration: 0.05, ease: "power2.in" }, 0.95);
  }

  /* ============================================================ interior tours */
  function tour(id, shot, stops, opts = {}) {
    const { tl, section, hooks } = pinScene(id);
    const cam = cams[shot];
    const card = $(".room-card", section);
    const num = $(".rc-num", card), name = $(".rc-name", card), line = $(".rc-line", card);
    Object.assign(cam.state, opts.start || { fx: 0.5, fy: 0.55, z: 1.0 });

    let t = opts.lead || 0;
    const marks = [];                       // [{ at, i }] — when each stop's text becomes current
    const MOVE = 1, HOLD = 0.75;
    stops.forEach((s, i) => {
      if (i > 0) tl.to(card, { opacity: 0, y: 10, duration: 0.25, ease: "power1.in" }, t);
      const drift = (i % 2 ? 1 : -1) * 0.022;
      move(tl, cam, { fx: s.fx, fy: s.fy, z: s.z, px: drift, py: -0.012, dolly: 0.28 }, t, MOVE);
      marks.push({ at: t + MOVE * 0.5, i });
      t += MOVE;
      tl.to(card, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, t - 0.1);
      t += HOLD;
    });
    if (opts.outro) move(tl, cam, { px: 0, py: 0, dolly: 0, ...opts.outro }, t, 1);

    let current = -1;
    // Must hang off the timeline, not ScrollTrigger: with scrub smoothing the timeline keeps
    // easing after scrolling stops, and a scroll-driven callback would freeze a stale label.
    tl.eventCallback("onUpdate", () => {
      const time = tl.time();
      let idx = 0;
      for (const m of marks) if (time >= m.at) idx = m.i;
      if (idx !== current) {
        current = idx;
        const s = stops[idx];
        num.textContent = s.n; name.textContent = s.name; line.textContent = s.line;
      }
    });
    return { tl, section };
  }

  // Coordinates are read off the cutaway renders with a 10 x 10 grid overlay.
  tour("inside", "ground", [
    { n: "01", name: "Arrival",          fx: 0.20, fy: 0.66, z: 2.0,
      line: "A covered car bay and the porch steps up to the front door." },
    { n: "02", name: "Living room",      fx: 0.34, fy: 0.45, z: 2.2,
      line: "Street-facing windows, the entrance wall and a full seating corner." },
    { n: "03", name: "Kitchen",          fx: 0.49, fy: 0.58, z: 2.35,
      line: "An L-shaped stone counter, open to living and dining." },
    { n: "04", name: "Dining",           fx: 0.59, fy: 0.45, z: 2.3,
      line: "Six seats between the kitchen and the bedroom wing." },
    { n: "05", name: "Ground bedroom",   fx: 0.72, fy: 0.44, z: 2.1,
      line: "A full bedroom on the ground floor, with its own window." },
    { n: "06", name: "Bathroom",         fx: 0.78, fy: 0.66, z: 2.45,
      line: "Attached to the bedroom." },
    { n: "07", name: "Staircase",        fx: 0.37, fy: 0.60, z: 2.35,
      line: "At the centre of the plan, rising to the private floor." },
  ], { lead: 0.25, start: { fx: 0.5, fy: 0.55, z: 0.98 } });

  {
    const { tl, section } = tour("upstairs", "first", [
      { n: "08", name: "Landing",          fx: 0.64, fy: 0.45, z: 2.2,
        line: "The stair arrives between the private rooms." },
      { n: "09", name: "Master bedroom",   fx: 0.49, fy: 0.47, z: 2.25,
        line: "Wardrobe wall, dressing niche and a window to the street." },
      { n: "10", name: "Bathroom",         fx: 0.28, fy: 0.34, z: 2.45,
        line: "Attached, with a high window for light and privacy." },
      { n: "11", name: "Private terrace",  fx: 0.24, fy: 0.66, z: 1.9,
        line: "A paved open terrace for evenings and gatherings." },
      { n: "12", name: "Timber deck",      fx: 0.53, fy: 0.79, z: 2.0,
        line: "A warm timber deck running the width of the house." },
      { n: "13", name: "Garden balcony",   fx: 0.84, fy: 0.66, z: 2.1,
        line: "Planters and a glass rail along the open side." },
    ], { lead: 0.55, start: { fx: 0.64, fy: 0.45, z: 2.6 },
         outro: { fx: 0.5, fy: 0.55, z: 0.98 } });

    // the "up the stairs" wipe covers the cut from ground to first floor
    const wipe = $(".wipe", section);
    gsap.set(wipe, { clipPath: "inset(0% 0 0 0)" });
    tl.to(wipe, { clipPath: "inset(0 0 100% 0)", duration: 0.4, ease: "power2.inOut" }, 0.12);
  }

  /* One ticker draws whatever is on screen.
     Earlier this was a per-renderer active/inactive loop toggled by ScrollTrigger, and the
     two could fall out of sync — a scene reported active while its loop was stopped, so its
     canvas stayed black. A cheap rect test per frame has no state to desynchronise. */
  if (renderers.length) {
    gsap.ticker.add(() => {
      for (const { r } of renderers) if (r.onScreen()) r.draw();
    });
  }

  /* scenes are authored on a 0..1 clock; flag any that overrun (interior tours excepted) */
  ["intro", "row", "residence"].forEach(id => {
    const st = ScrollTrigger.getAll().find(x => x.trigger && x.trigger.id === id && x.pin);
    const d = st && st.animation ? st.animation.duration() : 0;
    if (d > 1.0001) console.warn(`[film] scene "${id}" timeline runs to ${d.toFixed(3)} (>1)`);
  });

  /* ============================================================ chrome */
  const rail = $(".rail");
  function setChapter(id) {
    $$(".rail li").forEach(li => li.classList.toggle("on", li.dataset.ch === id));
  }
  ScrollTrigger.create({
    trigger: "#row", start: "top 60%", endTrigger: "#plans", end: "bottom top",
    onToggle: s => rail.classList.toggle("show", s.isActive)
  });
  ScrollTrigger.create({ trigger: "#plans", start: "top 60%", end: "bottom 40%",
    onToggle: s => s.isActive && setChapter("plans") });

  const bar = $(".bar");
  ScrollTrigger.create({ start: () => innerHeight * 0.6, end: "max",
    onToggle: s => bar.classList.toggle("solid", s.isActive) });

  gsap.to(".progress i", { scaleX: 1, ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  // reveal static blocks
  $$(".block .wrap > *").forEach(el => gsap.from(el, {
    opacity: 0, y: 28, duration: 0.9, ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 88%", once: true }
  }));

  /* ------------------------------------------------------------ resize */
  const reapply = () => appliers.forEach(fn => fn());
  ScrollTrigger.addEventListener("refresh", reapply);
  Promise.all(Object.values(cams).map(c => c.ready)).then(() => {
    reapply(); ScrollTrigger.refresh();
  });

  window.__film = { cams, lenis, ScrollTrigger };

  /* ============================================================ static UI */
  function wireStaticUI() {
    // plan tabs
    $$(".plan-tabs button").forEach(b => b.addEventListener("click", () => {
      $$(".plan-tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
      $$(".plan").forEach(p => p.classList.toggle("is-on", p.dataset.plan === b.dataset.plan));
    }));

    // enquiry -> WhatsApp (no backend yet; opens a prefilled chat the visitor sends themselves)
    const form = $("#enquire");
    if (form) form.addEventListener("submit", e => {
      e.preventDefault();
      const note = $(".form-note", form);
      const d = new FormData(form);
      const name = (d.get("name") || "").trim(), phone = (d.get("phone") || "").trim();
      if (!name || phone.replace(/\D/g, "").length < 10) {
        note.textContent = "Please add your name and a 10-digit phone number.";
        return;
      }
      const msg = `Hello, I'm ${name} (${phone}). I'm interested in Deccan Imperia — ${d.get("topic")}.`;
      window.open(`https://wa.me/919028561515?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      note.textContent = "Opening WhatsApp with your message…";
    });
  }
})();
