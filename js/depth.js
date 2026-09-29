/* ==========================================================================
   Depth renderer — turns a still + its depth map into a camera that moves.
   --------------------------------------------------------------------------
   Each render has a depth map generated with Depth-Anything-V2 (white = near).
   The fragment shader looks every pixel up through that depth, so:

     parallax  near surfaces slide further than far ones on a lateral move
     dolly     near surfaces grow faster than far ones on a push-in — the
               difference between a camera MOVING and a photo being ZOOMED

   One canvas per scene. Layers (shots) are drawn back to front with their
   current CSS opacity, so the existing GSAP cross-dissolves keep working.
   If WebGL is unavailable, nothing here runs and the CSS-transform path in
   main.js remains the fallback.
   ========================================================================== */
window.DepthStage = (() => {
  "use strict";

  const VERT = `
    attribute vec2 aPos;
    void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
    precision highp float;
    uniform sampler2D uImg, uDepth;
    uniform vec2  uView;      // viewport, css px
    uniform float uDpr;
    uniform vec2  uT;         // camera translate, css px
    uniform float uS;         // camera scale
    uniform vec2  uN;         // image natural size, css px
    uniform vec2  uPar;       // lateral parallax, image-uv units per unit depth
    uniform float uDolly;     // dolly strength
    uniform vec2  uC;         // dolly centre, image uv
    uniform float uFocus;     // depth that stays put
    uniform float uAlpha;
    uniform float uWipe;      // -1 = off; else screen-x (0..1) left of which layer is hidden
    uniform float uContain;   // 1 = outside the image is black, 0 = clamp to edge
    uniform float uSeed;

    vec2 displace(vec2 uv, float d){
      float k = d - uFocus;
      uv = uC + (uv - uC) / (1.0 + uDolly * k);
      return uv - uPar * k;
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed) * 43758.5453); }

    void main(){
      vec2 px = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;   // css px, y down
      vec2 uv0 = ((px - uT) / uS) / uN;

      // two-step lookup approximates the inverse displacement well for small moves
      float d  = texture2D(uDepth, clamp(uv0, 0.0, 1.0)).r;
      vec2  uv = displace(uv0, d);
      d  = texture2D(uDepth, clamp(uv, 0.0, 1.0)).r;
      uv = displace(uv0, d);

      vec4 col;
      if (uContain > 0.5 && (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0)) col = vec4(0.0,0.0,0.0,1.0);
      else col = texture2D(uImg, clamp(uv, 0.0005, 0.9995));

      // cinematic finish: gentle vignette and fine film grain
      vec2 q = px / uView - 0.5;
      col.rgb *= 1.0 - dot(q, q) * 0.32;
      col.rgb += (hash(gl_FragCoord.xy) - 0.5) * 0.028;

      float a = uAlpha;
      if (uWipe > -0.5) a *= smoothstep(uWipe, uWipe + 0.22, px.x / uView.x);
      gl_FragColor = vec4(col.rgb * a, a);
    }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function texture(gl, source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function loadImage(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => res(im); im.onerror = rej; im.src = url;
    });
  }

  /** Create a renderer for one .cam container. Returns null if WebGL is unavailable. */
  function create(camEl) {
    const canvas = document.createElement("canvas");
    canvas.className = "depth-canvas";
    // preserveDrawingBuffer: WITHOUT it the buffer is discarded after compositing, so a
    // scene that stops animating (scroll settled) goes black. We draw on demand rather than
    // every rAF, so the last frame must survive.
    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: true, antialias: false, alpha: false, preserveDrawingBuffer: true
    });
    if (!gl) return null;

    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn("depth shader failed, falling back", e); return null; }

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ["uImg","uDepth","uView","uDpr","uT","uS","uN","uPar","uDolly","uC","uFocus","uAlpha",
     "uWipe","uContain","uSeed"].forEach(n => U[n] = gl.getUniformLocation(prog, n));
    gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDepth, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    camEl.appendChild(canvas);
    camEl.classList.add("gl-on");

    const layers = [];
    let seed = 0, queued = false;
    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

    function resize() {
      const w = camEl.clientWidth, h = camEl.clientHeight, r = dpr();
      if (canvas.width !== Math.round(w * r) || canvas.height !== Math.round(h * r)) {
        canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
      }
    }

    function draw() {
      resize();
      const w = camEl.clientWidth, h = camEl.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uView, w, h);
      gl.uniform1f(U.uDpr, dpr());
      gl.uniform1f(U.uSeed, (seed = (seed + 0.618) % 97));
      for (const L of layers) {
        if (!L.ready || !L.frame) continue;
        const a = +gsap.getProperty(L.el, "opacity");
        if (a <= 0.002) continue;
        const f = L.frame;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, L.tImg);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L.tDepth);
        gl.uniform2f(U.uT, f.tx, f.ty);
        gl.uniform1f(U.uS, f.s);
        gl.uniform2f(U.uN, f.nw, f.nh);
        gl.uniform2f(U.uPar, f.px, f.py);
        gl.uniform1f(U.uDolly, f.dolly);
        gl.uniform2f(U.uC, f.fx, f.fy);
        gl.uniform1f(U.uFocus, L.focus);
        gl.uniform1f(U.uAlpha, a);
        gl.uniform1f(U.uContain, L.contain ? 1 : 0);
        let wipe = -1;
        if (L.wipe) {
          const v = parseFloat(gsap.getProperty(L.el, "--rev")) || -30;
          wipe = v / 100;
        }
        gl.uniform1f(U.uWipe, wipe);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    // coalesce multiple layer updates in one frame into a single draw
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; draw(); });
    }
    /** True when any part of this stage is on screen. */
    function onScreen() {
      const b = camEl.getBoundingClientRect();
      return b.bottom > -1 && b.top < innerHeight + 1 && b.width > 0;
    }

    return {
      /** Register a shot. `el` is its <img>; depth URL is derived from the chosen source. */
      async add(el, { focus = 0.45, contain = false, wipe = false, depthFrom = null } = {}) {
        const L = { el, focus, contain, wipe, ready: false, frame: null };
        layers.push(L);
        if (!(el.complete && el.naturalWidth)) await new Promise(r => el.addEventListener("load", r, { once: true }));
        let src = el.currentSrc || el.src;
        if (depthFrom) {                       // e.g. the sketch borrows the dusk render's depth
          if (!(depthFrom.complete && depthFrom.naturalWidth))
            await new Promise(r => depthFrom.addEventListener("load", r, { once: true }));
          src = depthFrom.currentSrc || depthFrom.src;
        }
        const depthUrl = src.replace(/(-m)?\.webp(\?.*)?$/, (m, mob) => `-depth${mob || ""}.png`);
        try {
          const dImg = await loadImage(depthUrl);
          L.tImg = texture(gl, el);
          L.tDepth = texture(gl, dImg);
          L.ready = true;
        } catch (e) { console.warn("no depth for", src, e); }
        schedule();
        return L;
      },
      /** Called by the camera with the frame it computed. */
      frame(L, f) { L.frame = f; schedule(); },
      setActive() { schedule(); },      // retained for API compatibility
      onScreen,
      draw, schedule, canvas
    };
  }

  return { create };
})();
