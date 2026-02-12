(() => {
  const canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w, h, dpr;

  // ----------------------------
  // Feature toggles
  // ----------------------------
  const FEATURES = {
    backbone: true,         // Option 1
    longerHelices: true,    // Option 2
    depthLayering: true,    // Option 3
    composedLayout: true,   // Option 4
    betterBasePairs: true,  // Option 5
    gentleFlow: true,      // Option 6 
    cohesiveColor: false    // Option 7 (later)
  };

  // ----------------------------
  // Background & render settings
  // ----------------------------
  const bg = "#d9d9d9";
  const trail = 0.18;
  
  const GLOBAL_TILT = -0.15; // radians

  
  // Option 6: gentle global flow (very subtle)
const FLOW = {
  enabled: true,     // set false to disable
  magnitude: 10,     // pixels-ish at depth=1; try 6–14
  speed: 0.00012     // try 0.00008–0.00020
};

  // FPS cap (keeps GPU sane)
  let lastTime = 0;
  const FPS = 30;
  const FRAME_INTERVAL = 1000 / FPS;

  function resize() {
    // DPR cap: reduces Retina/4K GPU load
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Deep, rich palette
  const palette = [
    "#0B3D2E", // deep forest green
    "#0F6B5B", // deep teal
    "#0B3C8A", // deep blue
    "#3B1D6B", // deep purple
    "#7A1E2C", // deep red
    "#8A5A00", // deep amber
    "#2F6F3E", // rich green
    "#124559"  // deep slate-teal
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function hexToRgba(hex, a) {
    const c = hex.replace("#", "");
    const bigint = parseInt(c, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function circle(x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // NEW (Option 5): rounded “capsule” connector for base pairs
  function capsule(x1, y1, x2, y2, width, stroke) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // --- RNG ---
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(42);

  // ----------------------------
  // Helix generation (FIXED ORDER)
  // IMPORTANT: build AFTER resize so h/w exist
  // ----------------------------
  let helices = [];

  function sampleDepth() {
    return Math.pow(rand(), 1.2);
  }

  function buildHelices() {
    helices = [];

    // Option 2: “longer” feel WITHOUT reducing count (your old code was lowering it)
    const HELIX_COUNT = FEATURES.longerHelices ? 18 : 18;
    const MIN_DIST = FEATURES.longerHelices ? 0.10 : 0.10;
    const MAX_TRIES = 25000;

    function dist(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Option 4: composed anchor layout for full coverage
    const anchors = FEATURES.composedLayout
      ? [
          { x: 0.10, y: 0.14 }, { x: 0.50, y: 0.10 }, { x: 0.90, y: 0.16 },
          { x: 0.08, y: 0.52 },                     { x: 0.92, y: 0.52 },
          { x: 0.12, y: 0.90 }, { x: 0.50, y: 0.92 }, { x: 0.88, y: 0.88 },

          { x: 0.26, y: 0.28 }, { x: 0.74, y: 0.30 },
          { x: 0.30, y: 0.72 }, { x: 0.70, y: 0.70 },

          { x: 0.18, y: 0.38 }, { x: 0.82, y: 0.40 },
          { x: 0.20, y: 0.62 }, { x: 0.80, y: 0.60 }
        ]
      : [
          { x: 0.18, y: 0.20 }, { x: 0.50, y: 0.20 }, { x: 0.82, y: 0.20 },
          { x: 0.20, y: 0.52 }, { x: 0.50, y: 0.50 }, { x: 0.80, y: 0.52 },
          { x: 0.18, y: 0.82 }, { x: 0.50, y: 0.82 }, { x: 0.82, y: 0.82 }
        ];

    // Seed anchors first
    for (let k = 0; k < anchors.length && helices.length < Math.min(anchors.length, HELIX_COUNT); k++) {
      const depth = sampleDepth();

      helices.push({
        x: anchors[k].x,
        y: anchors[k].y,
        depth,

        scale: (0.55 + rand() * 0.22) * lerp(0.75, 1.10, depth),
        rot: GLOBAL_TILT + (-0.6 + rand() * 1.2),

        speed: (0.00085 + rand() * 0.00065) * lerp(0.80, 1.15, depth),
        amp: 78 + rand() * 34,

        // Option 2: slightly longer helices (but still clipped by viewport)
        height: h * (0.95 + rand() * 0.55),
        rungs: Math.floor(46 + rand() * 18),

        colorShift: Math.floor(rand() * palette.length),

        // Option 1/2/3/4: phase drift + bend already present
        phaseStart: rand() * Math.PI * 2,
        phaseDrift: (rand() - 0.5) * 0.0012,

        // Guaranteed bend (all helices have some)
        bend: 0.22 + rand() * 0.28,
        bendFreq: 1.2 + rand() * 1.6,
        bendPower: 2.0 + rand() * 1.0,
        bendMix: 0.35 + rand() * 0.35,
        bendSeed: rand() * 1000,

        // Drift (kept moderate — you can tune driftMag below)
        driftAngle: rand() * Math.PI * 2,
        driftSpeed: (0.0006 + rand() * 0.0012) * lerp(0.7, 1.2, depth),
        driftPhase: rand() * Math.PI * 2
      });
    }

    // Fill remaining helices with rejection sampling
    let tries = 0;
    while (helices.length < HELIX_COUNT && tries < MAX_TRIES) {
      tries++;

      const depth = sampleDepth();

      const candidate = {
        x: 0.06 + rand() * 0.88,
        y: 0.10 + rand() * 0.80,
        depth,

        scale: (0.52 + rand() * 0.26) * lerp(0.75, 1.10, depth),
        rot: GLOBAL_TILT + (-0.6 + rand() * 1.2),

        speed: (0.00085 + rand() * 0.00065) * lerp(0.80, 1.15, depth),
        amp: 74 + rand() * 42,

        height: h * (0.90 + rand() * 0.70),
        rungs: Math.floor(46 + rand() * 18),

        colorShift: Math.floor(rand() * palette.length),

        phaseStart: rand() * Math.PI * 2,
        phaseDrift: (rand() - 0.5) * 0.0012,

        bend: 0.22 + rand() * 0.28,
        bendFreq: 1.2 + rand() * 1.6,
        bendPower: 2.0 + rand() * 1.0,
        bendMix: 0.35 + rand() * 0.35,
        bendSeed: rand() * 1000,

        driftAngle: rand() * Math.PI * 2,
        driftSpeed: (0.0006 + rand() * 0.0012) * lerp(0.7, 1.2, depth),
        driftPhase: rand() * Math.PI * 2
      };

      let ok = true;
      for (const hh of helices) {
        const threshold = MIN_DIST * (0.85 + 0.9 * Math.max(hh.scale, candidate.scale));
        if (dist(hh, candidate) < threshold) { ok = false; break; }
      }

          if (ok) helices.push(candidate);
  }

  // ----------------------------------------
  // Add ONE darker "hero" helix (bottom-right)
  // ----------------------------------------
  helices.push({
    x: 0.86,
    y: 0.83,
    depth: 1.0,

    hero: true,

    scale: 0.78,
    rot: -0.55,
    speed: 0.00105,
    amp: 86,

    height: h * 1.05,
    rungs: 52,

    colorShift: Math.floor(rand() * palette.length),

    phaseStart: rand() * Math.PI * 2,
    phaseDrift: (rand() - 0.5) * 0.0008,

    bend: 0.34,
    bendFreq: 1.35,
    bendPower: 2.3,
    bendMix: 0.50,
    bendSeed: rand() * 1000,

    driftAngle: rand() * Math.PI * 2,
    driftSpeed: 0.00055,
    driftPhase: rand() * Math.PI * 2
  });
}


  // ----------------------------
  // Drawing
  // ----------------------------
  function drawHelix(now, cfg) {
    const mx = 0.5;
    const my = 0.5;

    const depth = cfg.depth ?? 0.5;

    // Option 3: depth layering (far = lighter & thinner)
    const opacityMult = FEATURES.depthLayering ? lerp(0.22, 1.0, depth) : 1.0;
    const widthMult   = FEATURES.depthLayering ? lerp(0.65, 1.25, depth) : 1.0;

    // Drift (slightly reduced vs your “too much drift” version)
    const driftMag = lerp(6, 16, depth) * cfg.scale; // reduced magnitude
    const drift = Math.sin(now * cfg.driftSpeed + cfg.driftPhase) * driftMag;
    const driftX = Math.cos(cfg.driftAngle) * drift;
    const driftY = Math.sin(cfg.driftAngle) * drift;

    // Option 6: gentle global flow (same “current” across the scene, with slight local variation)
let flowX = 0, flowY = 0;
if (FEATURES.gentleFlow && FLOW.enabled) {
  // use cfg.bendSeed as a stable per-helix phase so they don't move identically
  const seed = (cfg.bendSeed || 0) * 0.001;
  const t = now * FLOW.speed;

  // smooth looping field (two layered sin/cos)
  flowX =
    (Math.sin(t + seed) * 0.65 + Math.sin(t * 0.73 + seed * 1.7) * 0.35) *
    FLOW.magnitude;

  flowY =
    (Math.cos(t * 0.92 + seed) * 0.65 + Math.cos(t * 0.61 + seed * 1.4) * 0.35) *
    FLOW.magnitude;
}

// reduce flow for far helices so background stays calmer
const flowDepthMult = FEATURES.depthLayering ? lerp(0.35, 1.0, depth) : 1.0;

const cx = w * cfg.x + driftX + flowX * flowDepthMult;
const cy = h * cfg.y + driftY + flowY * flowDepthMult;


    const helixHeight = Math.min(h * 0.9, cfg.height) * cfg.scale;
    const topY = cy - helixHeight / 2;

    const amp = (cfg.amp * cfg.scale) * lerp(0.85, 1.15, mx);
    const wobble = lerp(0.85, 1.25, my);

    const time = now * (cfg.speed + mx * 0.00045);
    const phaseBase = (cfg.phaseStart || 0) + now * (cfg.phaseDrift || 0);

    const cosR = Math.cos(cfg.rot);
    const sinR = Math.sin(cfg.rot);

    let prev1 = null;
    let prev2 = null;

    for (let i = 0; i < cfg.rungs; i++) {
      const p = i / (cfg.rungs - 1);
      const y = topY + p * helixHeight;

      const phase = phaseBase + time + p * (Math.PI * 6.0) * wobble;

      const lx1 = Math.cos(phase) * amp;
      const lx2 = Math.cos(phase + Math.PI) * amp;

      const localDepth = (Math.sin(phase) + 1) / 2;

      const dy = (y - cy);

      // Nonlinear bend envelope (stronger in middle)
      const envelope = Math.pow(Math.sin(Math.PI * p), cfg.bendPower || 2.0);
      const bendPhase = (p * Math.PI * 2.0 * (cfg.bendFreq || 1.0)) + time * 0.35;

      const mix = cfg.bendMix ?? 0.3;
      const bendSignal =
        (1 - mix) * Math.sin(bendPhase) +
        mix * Math.sin(2 * bendPhase + (cfg.bendSeed || 0));

      const bendOffset =
        bendSignal * ((cfg.bend || 0.25) * 240) * cfg.scale * envelope;

      const x1 = cx + ((lx1 + bendOffset) * cosR - dy * sinR);
      const y1 = cy + ((lx1 + bendOffset) * sinR + dy * cosR);

      const x2 = cx + ((lx2 + bendOffset) * cosR - dy * sinR);
      const y2 = cy + ((lx2 + bendOffset) * sinR + dy * cosR);

      // Option 1: backbone
      if (FEATURES.backbone) {
        const backboneAlpha = lerp(0.10, 0.34, localDepth) * opacityMult;
        ctx.lineWidth = lerp(0.7, 1.5, localDepth) * cfg.scale * widthMult;
        ctx.strokeStyle = hexToRgba("#1f2a26", backboneAlpha);

        if (prev1) {
          ctx.beginPath();
          ctx.moveTo(prev1.x, prev1.y);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        if (prev2) {
          ctx.beginPath();
          ctx.moveTo(prev2.x, prev2.y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        prev1 = { x: x1, y: y1 };
        prev2 = { x: x2, y: y2 };
      }

      const c = palette[(i + cfg.colorShift) % palette.length];

      // Option 5: better base pairs (capsule connector + richer blobs)
      const lineAlpha = lerp(0.18, 0.62, localDepth) * opacityMult;
      const nodeAlpha = lerp(0.16, 0.75, localDepth) * opacityMult;

      // backbone nodes (slightly larger + darker)
      const rBack = lerp(1.1, 2.7, localDepth) * cfg.scale * widthMult;
      circle(x1, y1, rBack, hexToRgba("#23302c", nodeAlpha));
      circle(x2, y2, rBack, hexToRgba("#23302c", nodeAlpha));

      if (FEATURES.betterBasePairs) {
        const wPair = lerp(0.9, 2.2, localDepth) * cfg.scale * widthMult;
        capsule(x1, y1, x2, y2, wPair, hexToRgba("#2a2a2a", lineAlpha * 0.55));

        const baseAlpha = lerp(0.35, 0.95, localDepth) * opacityMult;

        const ax = lerp(x1, x2, 0.22);
        const ay = lerp(y1, y2, 0.22);
        const bx = lerp(x2, x1, 0.22);
        const by = lerp(y2, y1, 0.22);

        const rBase = lerp(0.9, 2.0, localDepth) * cfg.scale * widthMult;

        circle(ax, ay, rBase, hexToRgba(c, baseAlpha));
        circle(bx, by, rBase, hexToRgba(c, baseAlpha));

        // tiny highlight for “bead” depth
        circle(ax - rBase * 0.25, ay - rBase * 0.25, rBase * 0.35, hexToRgba("#ffffff", baseAlpha * 0.18));
        circle(bx - rBase * 0.25, by - rBase * 0.25, rBase * 0.35, hexToRgba("#ffffff", baseAlpha * 0.18));
      } else {
        // fallback rung style
        ctx.lineWidth = lerp(0.85, 1.9, localDepth) * cfg.scale * widthMult;
        ctx.strokeStyle = hexToRgba(c, lineAlpha);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const rr = lerp(0.7, 1.6, localDepth) * cfg.scale * widthMult;
        const baseAlpha = lerp(0.34, 0.98, localDepth) * opacityMult;
        circle(lerp(x1, x2, 0.18), lerp(y1, y2, 0.18), rr, hexToRgba(c, baseAlpha));
        circle(lerp(x2, x1, 0.18), lerp(y2, y1, 0.18), rr, hexToRgba(c, baseAlpha));
      }
    }
  }

  function frame(now) {
    if (now - lastTime < FRAME_INTERVAL) {
      requestAnimationFrame(frame);
      return;
    }
    lastTime = now;

    ctx.fillStyle = `rgba(217,217,217,${1 - trail})`;
    ctx.fillRect(0, 0, w, h);

    // Option 3: draw far -> near for natural layering
    const ordered = FEATURES.depthLayering
      ? helices.slice().sort((a, b) => (a.depth ?? 0.5) - (b.depth ?? 0.5))
      : helices;

    for (const cfg of ordered) drawHelix(now, cfg);

    requestAnimationFrame(frame);
  }

  // ----------------------------
  // Init + rebuild on resize
  // ----------------------------
  const ro = new ResizeObserver(() => {
    resize();
    buildHelices();
  });
  ro.observe(canvas);

  resize();
  buildHelices();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  requestAnimationFrame(frame);
})();
