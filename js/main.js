/* Deccan Imperia — photoreal scroll journey */
(() => {
  "use strict";

  const MAX_SCALE = 1.45;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compactViewport = matchMedia("(max-width: 860px)").matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  wireStaticUI();
  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    document.documentElement.classList.add("lenis");
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  $$('a[href^="#"]').forEach(anchor => anchor.addEventListener("click", event => {
    const target = $(anchor.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: "smooth" });
  }));

  const appliers = [];
  const cams = {};

  function camera(img, fit) {
    const cam = {
      state: { fx: 0.5, fy: 0.5, z: 1, px: 0, py: 0, dolly: 0 },
      gl: null,
      ready: null,
      apply: null,
    };

    function apply() {
      const box = img.parentElement;
      const vw = box.clientWidth;
      const vh = box.clientHeight;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!vw || !vh || !nw || !nh) return;

      const base = fit === "contain"
        ? Math.min(vw / nw, vh / nh) * 0.94
        : Math.max(vw / nw, vh / nh);
      const overscan = cam.gl && fit === "cover" ? 1.055 : 1;
      let scale = base * cam.state.z * overscan;
      const isMobileAsset = /-m\.webp(?:\?|$)/.test(img.currentSrc || img.src);
      const realWidth = +(isMobileAsset ? img.dataset.mobileWidth : img.dataset.desktopWidth) || nw;
      const upscaleCap = MAX_SCALE * realWidth / nw;
      scale = Math.min(scale, Math.max(base, upscaleCap));

      const width = nw * scale;
      const height = nh * scale;
      let tx = vw / 2 - cam.state.fx * width;
      let ty = vh / 2 - cam.state.fy * height;
      if (fit === "cover") {
        tx = clamp(tx, vw - width, 0);
        ty = clamp(ty, vh - height, 0);
      } else {
        tx = width <= vw ? (vw - width) / 2 : clamp(tx, vw - width, 0);
        ty = height <= vh ? (vh - height) / 2 : clamp(ty, vh - height, 0);
      }

      if (cam.gl) {
        cam.gl.renderer.frame(cam.gl.layer, {
          s: scale, tx, ty, nw, nh,
          fx: cam.state.fx, fy: cam.state.fy,
          px: cam.state.px || 0, py: cam.state.py || 0,
          dolly: cam.state.dolly || 0,
        });
      } else {
        img.style.width = `${nw}px`;
        img.style.height = `${nh}px`;
        img.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`;
      }
    }

    cam.apply = apply;
    cam.ready = img.complete && img.naturalWidth
      ? Promise.resolve()
      : new Promise(resolve => img.addEventListener("load", resolve, { once: true }));
    cam.ready.then(() => { apply(); ScrollTrigger.refresh(); });
    appliers.push(apply);
    return cam;
  }

  $$(".cam").forEach(container => {
    $$(".shot", container).forEach(img => {
      cams[img.dataset.shot] = camera(img, container.dataset.fit || "cover");
    });
  });

  const renderers = [];
  // Local file previews cannot safely upload file:// images to WebGL textures.
  // In that environment use the CSS camera fallback instead of hiding the images
  // behind a canvas that may never receive a valid texture.
  // On phones, keep the same scroll camera movement but skip the extra WebGL depth-map
  // downloads. This prevents later scenes from competing with the first visible image.
  if (window.DepthStage && location.protocol !== "file:" && !compactViewport) {
    $$(".cam").forEach(container => {
      const renderer = DepthStage.create(container);
      if (!renderer) return;
      renderers.push(renderer);
      $$(".shot", container).forEach(img => {
        renderer.add(img, { focus: +(img.dataset.focus || 0.45) }).then(layer => {
          if (!layer.ready) return;
          const cam = cams[img.dataset.shot];
          cam.gl = { renderer, layer };
          cam.apply();
        });
      });
    });
  }

  addEventListener("resize", () => {
    appliers.forEach(apply => apply());
    renderers.forEach(renderer => renderer.schedule());
  }, { passive: true });

  function move(timeline, cam, pose, at, duration = 1, ease = "sine.inOut") {
    timeline.to(cam.state, { ...pose, duration, ease, onUpdate: cam.apply }, at);
  }

  function pinScene(id) {
    const section = $(`#${id}`);
    const desktopLength = +section.dataset.len || 320;
    // Phone users cover far more physical distance per swipe. Keeping the desktop
    // scroll lengths made each scene feel stalled for five to eight screens.
    const length = Math.round(desktopLength * (compactViewport ? 0.38 : 1));
    section.style.height = `calc(100svh + ${length}svh)`;
    const timeline = gsap.timeline({ defaults: { ease: "none" } });
    ScrollTrigger.create({
      trigger: section, start: "top top", end: "bottom bottom",
      scrub: 0.75, animation: timeline, invalidateOnRefresh: true,
      onToggle: state => state.isActive && setChapter(id),
      onEnter: () => section.classList.add("is-entered"),
      onLeaveBack: () => id !== "intro" && section.classList.remove("is-entered"),
      onRefresh: self => section.classList.toggle("is-entered", id === "intro" || self.scroll() >= self.start),
    });
    return { section, timeline };
  }

  function cut(timeline, section, from, to, at, options = {}) {
    const fromEl = $(`[data-shot="${from}"]`, section);
    const toEl = $(`[data-shot="${to}"]`, section);
    const duration = typeof options === "number" ? options : (options.duration || 0.1);
    // A stationary optical blink: opacity changes only. The incoming frame never
    // slides or wipes up from the bottom, so the viewer keeps the same eye line.
    timeline.to(toEl, { opacity: 1, duration, ease: "sine.inOut" }, at);
    timeline.to(fromEl, { opacity: 0, duration, ease: "sine.inOut" }, at);
    return duration;
  }

  function fade(timeline, target, opacity, at, duration = 0.1) {
    timeline.to(target, {
      opacity, duration,
      ease: opacity ? "power2.out" : "power1.in",
    }, at);
  }

  function buildJourney(id, steps) {
    const { section, timeline } = pinScene(id);
    const card = $(".room-card", section);
    const number = $(".rc-num", card);
    const name = $(".rc-name", card);
    const line = $(".rc-line", card);
    const marks = [];
    let time = 0;

    steps.forEach((step, index) => {
      const cam = cams[step.key];
      Object.assign(cam.state, step.from || { fx: 0.5, fy: 0.5, z: 1.03, px: 0, py: 0, dolly: 0 });
      cam.ready.then(cam.apply);
      const transitionDuration = index > 0
        ? cut(timeline, section, steps[index - 1].key, step.key, time, {
            duration: step.cut || 0.2,
            mode: step.transition || "door",
            direction: step.direction || 1,
          })
        : 0;
      marks.push({ at: time + (transitionDuration ? transitionDuration * 0.5 : 0.02), index });
      move(timeline, cam, step.to, time + Math.max(0.015, transitionDuration), step.duration || 0.82, step.ease || "sine.inOut");
      if (index === 0) timeline.set(card, { opacity: 1 }, 0);
      time += step.span || 1;
    });

    let current = -1;
    timeline.eventCallback("onUpdate", () => {
      const now = timeline.time();
      let index = 0;
      for (const mark of marks) if (now >= mark.at) index = mark.index;
      if (index === current) return;
      current = index;
      const step = steps[index];
      number.textContent = step.n;
      name.textContent = step.name;
      line.textContent = step.line;
    });
  }

  {
    const { section, timeline } = pinScene("intro");
    const cam = cams["row-wide"];
    Object.assign(cam.state, { fx: 0.34, fy: 0.53, z: 1.13, px: -0.025, py: 0, dolly: 0 });
    cam.ready.then(cam.apply);
    move(timeline, cam, { fx: 0.72, fy: 0.53, z: 1.18, px: 0.05, py: -0.004, dolly: 0.18 }, 0, 1, "none");
    timeline.to($(".intro-copy", section), { opacity: 0, duration: 0.28, ease: "power1.in" }, 0.66);
  }

  {
    const { section, timeline } = pinScene("residence");
    const corner = cams["hero-corner"];
    const front = cams["hero-front"];
    Object.assign(corner.state, { fx: 0.56, fy: 0.53, z: 1.02, px: -0.02, py: 0, dolly: 0 });
    Object.assign(front.state, { fx: 0.5, fy: 0.56, z: 1.02, px: 0, py: 0, dolly: 0 });
    corner.ready.then(corner.apply); front.ready.then(front.apply);
    move(timeline, corner, { fx: 0.48, fy: 0.55, z: 1.12, px: 0.035, dolly: 0.2 }, 0, 0.46);
    fade(timeline, '[data-cap="res-a"]', 1, 0.03);
    fade(timeline, '[data-cap="res-a"]', 0, 0.34);
    cut(timeline, section, "hero-corner", "hero-front", 0.43, {
      duration: 0.2, mode: "tree", direction: 1,
    });
    move(timeline, front, { fx: 0.52, fy: 0.61, z: 1.3, px: 0.012, dolly: 0.38 }, 0.49, 0.49, "power1.inOut");
    fade(timeline, '[data-cap="res-b"]', 1, 0.55);
    fade(timeline, '[data-cap="res-b"]', 0, 0.9);
  }

  {
    const { section, timeline } = pinScene("arrival");
    const gate = cams["arrival-gate-open"];
    Object.assign(gate.state, { fx: 0.5, fy: 0.54, z: 1.01, px: 0, py: 0, dolly: 0 });
    gate.ready.then(gate.apply);
    move(timeline, gate, {
      fx: 0.54, fy: 0.545, z: 1.18, px: 0.018, py: 0, dolly: 0.28,
    }, 0, 1, "power1.inOut");
    fade(timeline, '[data-cap="arrival-a"]', 1, 0.03);
    fade(timeline, '[data-cap="arrival-a"]', 0, 0.22);
  }

  buildJourney("inside", [
    { key: "living", n: "01", name: "Living room", line: "A connected living, dining and kitchen space.",
      from: { fx: 0.5, fy: 0.55, z: 1.03, px: -0.012, py: 0, dolly: 0 },
      to: { fx: 0.54, fy: 0.56, z: 1.19, px: 0.02, py: -0.006, dolly: 0.3 } },
    { key: "kitchen", n: "02", name: "Kitchen & dining", line: "The stone island opens directly to the dining area.",
      from: { fx: 0.47, fy: 0.54, z: 1.03, px: -0.01, py: 0, dolly: 0 },
      to: { fx: 0.57, fy: 0.55, z: 1.18, px: 0.026, py: -0.004, dolly: 0.28 },
      transition: "wall", direction: -1 },
    { key: "ground-bedroom", n: "03", name: "Ground bedroom", line: "A complete bedroom on the entrance level.",
      from: { fx: 0.5, fy: 0.54, z: 1.02, px: -0.008, py: 0, dolly: 0 },
      to: { fx: 0.5, fy: 0.56, z: 1.16, px: 0.018, py: -0.004, dolly: 0.27 },
      transition: "door", direction: 1 },
    { key: "ground-bathroom", n: "04", name: "Bathroom", line: "A compact, practical bathroom revealed from the doorway.",
      from: { fx: 0.5, fy: 0.53, z: 1.02, px: -0.008, py: 0, dolly: 0 },
      to: { fx: 0.52, fy: 0.55, z: 1.15, px: 0.016, py: -0.004, dolly: 0.24 },
      transition: "door", direction: -1, span: 0.82 },
    { key: "stair-base", n: "05", name: "The staircase", line: "The route turns upward at the heart of the plan.",
      from: { fx: 0.5, fy: 0.55, z: 1.02, px: -0.01, py: 0, dolly: 0 },
      to: { fx: 0.5, fy: 0.51, z: 1.24, px: 0.012, py: -0.025, dolly: 0.34 },
      transition: "wall", direction: 1 },
  ]);

  buildJourney("upstairs", [
    { key: "upper-bedroom", n: "06", name: "Upper bedroom", line: "A private bedroom with built-in storage and ensuite access.",
      from: { fx: 0.5, fy: 0.54, z: 1.03, px: -0.01, py: 0, dolly: 0 },
      to: { fx: 0.51, fy: 0.55, z: 1.16, px: 0.018, py: -0.004, dolly: 0.27 },
      transition: "door", direction: 1 },
    { key: "upper-bathroom", n: "07", name: "Ensuite", line: "A compact bathroom connected directly to the bedroom.",
      from: { fx: 0.5, fy: 0.53, z: 1.02, px: -0.008, py: 0, dolly: 0 },
      to: { fx: 0.52, fy: 0.54, z: 1.15, px: 0.016, py: -0.004, dolly: 0.23 },
      transition: "door", direction: -1, span: 0.82 },
    { key: "terrace", n: "08", name: "Private terrace", line: "An open terrace and timber deck above the street.",
      from: { fx: 0.49, fy: 0.56, z: 1.03, px: -0.012, py: 0, dolly: 0 },
      to: { fx: 0.56, fy: 0.55, z: 1.17, px: 0.028, py: -0.004, dolly: 0.24 },
      transition: "wall", direction: 1 },
    { key: "garden-deck", n: "09", name: "Garden deck", line: "The journey ends among timber, glass and planting at sunset.",
      from: { fx: 0.45, fy: 0.55, z: 1.03, px: -0.018, py: 0, dolly: 0 },
      to: { fx: 0.62, fy: 0.54, z: 1.17, px: 0.035, py: -0.004, dolly: 0.22 },
      transition: "rail", direction: -1, span: 1.2, ease: "none" },
  ]);

  if (renderers.length) gsap.ticker.add(() => renderers.forEach(renderer => renderer.onScreen() && renderer.draw()));

  const rail = $(".rail");
  function setChapter(id) {
    $$(".rail li").forEach(item => item.classList.toggle("on", item.dataset.ch === id));
  }
  ScrollTrigger.create({
    trigger: "#residence", start: "top 65%", endTrigger: "#plans", end: "bottom top",
    onToggle: state => rail.classList.toggle("show", state.isActive),
  });
  ScrollTrigger.create({ trigger: "#plans", start: "top 60%", end: "bottom 40%",
    onToggle: state => state.isActive && setChapter("plans") });

  const bar = $(".bar");
  ScrollTrigger.create({ start: () => innerHeight * 0.6, end: "max",
    onToggle: state => bar.classList.toggle("solid", state.isActive) });
  gsap.to(".progress i", { scaleX: 1, ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  $$(".block .wrap > *").forEach(element => gsap.from(element, {
    opacity: 0, duration: 0.75, ease: "power2.out",
    scrollTrigger: { trigger: element, start: "top 88%", once: true },
  }));

  ScrollTrigger.addEventListener("refresh", () => appliers.forEach(apply => apply()));
  appliers.forEach(apply => apply());
  ScrollTrigger.refresh();
  window.__film = { cams, lenis, ScrollTrigger, renderers };

  function wireStaticUI() {
    const menuToggle = $(".home-menu-toggle");
    const menu = $(".bar .nav");
    if (menuToggle && menu) {
      const closeMenu = () => {
        menu.classList.remove("open");
        menuToggle.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation");
      };
      menuToggle.addEventListener("click", () => {
        const open = menu.classList.toggle("open");
        menuToggle.classList.toggle("is-open", open);
        menuToggle.setAttribute("aria-expanded", String(open));
        menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      });
      $$("a", menu).forEach(link => link.addEventListener("click", closeMenu));
      document.addEventListener("keydown", event => event.key === "Escape" && closeMenu());
    }
    $$(".plan-tabs button").forEach(button => button.addEventListener("click", () => {
      $$(".plan-tabs button").forEach(item => item.setAttribute("aria-selected", String(item === button)));
      $$(".plan").forEach(plan => plan.classList.toggle("is-on", plan.dataset.plan === button.dataset.plan));
    }));
    const form = $("#enquire");
    if (!form) return;
    form.addEventListener("submit", event => {
      event.preventDefault();
      const note = $(".form-note", form);
      const data = new FormData(form);
      const name = (data.get("name") || "").trim();
      const phone = (data.get("phone") || "").trim();
      if (!name || phone.replace(/\D/g, "").length < 10) {
        note.textContent = "Please add your name and a 10-digit phone number.";
        return;
      }
      const message = `Hello, I'm ${name} (${phone}). I'm interested in Deccan Imperia — ${data.get("topic")}.`;
      window.open(`https://wa.me/919970353935?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      note.textContent = "Opening WhatsApp with your message…";
    });
  }
})();
