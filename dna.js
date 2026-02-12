(() => {
  const canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w, h, dpr;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Palette (muted, “academic” DNA)
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

  // Background (darken this)
  const bg = "#d9d9d9";
  const trail = 0.12;

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

  // --- NEW: non-overlapping placement + coverage anchors + bend params ---
  const HELIX_COUNT = 18;     // try 14–18
  const MIN_DIST = 0.10;      // bigger = fewer overlaps (0.22–0.30)
  const MAX_TRIES = 12000;

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Anchors to “fill” the canvas more evenly
  const anchors = [
    { x: 0.18, y: 0.20 }, { x: 0.50, y: 0.20 }, { x: 0.82, y: 0.20 },
    { x: 0.20, y: 0.52 }, { x: 0.50, y: 0.50 }, { x: 0.80, y: 0.52 },
    { x: 0.18, y: 0.82 }, { x: 0.50, y: 0.82 }, { x: 0.82, y: 0.82 }
  ];

  const helices = [];

  // Seed a few anchors first (gives even coverage and reduces collisions)
  for (let k = 0; k < anchors.length && helices.length < Math.min(9, HELIX_COUNT); k++) {
    helices.push({
      x: anchors[k].x,
      y: anchors[k].y,
      scale: 0.42 + rand() * 0.28,        // smaller helices
      rot: -0.9 + rand() * 1.8,
      speed: 0.0009 + rand() * 0.0006,
      amp: 80 + rand() * 32,
      height: 360 + rand() * 300,
      rungs: Math.floor(48 + rand() * 26),
      colorShift: Math.floor(rand() * palette.length),
      // NEW bend controls
      bend: 0.10 + rand() * 0.28,         // amount of bend
      bendFreq: 0.7 + rand() * 1.6        // how “wavy” the bend is
    });
  }

  // Fill remaining helices with rejection sampling (Poisson-ish)
  let tries = 0;
  while (helices.length < HELIX_COUNT && tries < MAX_TRIES) {
    tries++;

    const candidate = {
      x: 0.08 + rand() * 0.84,
      y: 0.12 + rand() * 0.78,
      scale: 0.40 + rand() * 0.32,
      rot: -0.9 + rand() * 1.8,
      speed: 0.0009 + rand() * 0.0006,
      amp: 78 + rand() * 34,
      height: 340 + rand() * 320,
      rungs: Math.floor(48 + rand() * 28),
      colorShift: Math.floor(rand() * palette.length),
      bend: 0.10 + rand() * 0.30,
      bendFreq: 0.7 + rand() * 1.7
    };

    let ok = true;
    for (const h of helices) {
      const threshold = MIN_DIST * (0.85 + 0.9 * Math.max(h.scale, candidate.scale));
      if (dist(h, candidate) < threshold) {
        ok = false;
        break;
      }
    }

    if (ok) helices.push(candidate);
  }

  function drawHelix(now, cfg) {
    // non-interactive (fixed)
    const mx = 0.5;
    const my = 0.5;

    const cx = w * cfg.x;
    const cy = h * cfg.y;

    const helixHeight = Math.min(h * 0.9, cfg.height) * cfg.scale;
    const topY = cy - helixHeight / 2;

    const amp = (cfg.amp * cfg.scale) * lerp(0.85, 1.15, mx);
    const wobble = lerp(0.85, 1.25, my);

    const time = now * (cfg.speed + mx * 0.00045);

    const cosR = Math.cos(cfg.rot);
    const sinR = Math.sin(cfg.rot);

    for (let i = 0; i < cfg.rungs; i++) {
      const p = i / (cfg.rungs - 1);
      const y = topY + p * helixHeight;

      const phase = time + p * (Math.PI * 6.0) * wobble;

      const lx1 = Math.cos(phase) * amp;
      const lx2 = Math.cos(phase + Math.PI) * amp;

      const depth = (Math.sin(phase) + 1) / 2;
      const lineAlpha = lerp(0.20, 0.60, depth);
      const nodeAlpha = lerp(0.15, 0.70, depth);

      const dy = (y - cy);

      // NEW: bend the helix centerline (curved, not perfectly straight)
      const bendPhase = (p * Math.PI * 2.0 * (cfg.bendFreq || 1.0)) + time * 0.35;
      const bendOffset = Math.sin(bendPhase) * ((cfg.bend || 0.2) * 220) * cfg.scale;
      const bx = bendOffset;

      const x1 = cx + ((lx1 + bx) * cosR - dy * sinR);
      const y1 = cy + ((lx1 + bx) * sinR + dy * cosR);

      const x2 = cx + ((lx2 + bx) * cosR - dy * sinR);
      const y2 = cy + ((lx2 + bx) * sinR + dy * cosR);

      const c = palette[(i + cfg.colorShift) % palette.length];

      ctx.lineWidth = lerp(0.8, 1.6, depth) * cfg.scale;
      ctx.strokeStyle = hexToRgba(c, lineAlpha);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const r = lerp(1.1, 2.6, depth) * cfg.scale;
      circle(x1, y1, r, hexToRgba("#3a3a3a", nodeAlpha));
      circle(x2, y2, r, hexToRgba("#3a3a3a", nodeAlpha));

      const rr = lerp(0.7, 1.7, depth) * cfg.scale;
      circle(lerp(x1, x2, 0.18), lerp(y1, y2, 0.18), rr, hexToRgba(c, lerp(0.28, 0.92, depth)));
      circle(lerp(x2, x1, 0.18), lerp(y2, y1, 0.18), rr, hexToRgba(c, lerp(0.28, 0.92, depth)));
    }
  }

  function frame(now) {
    ctx.fillStyle = `rgba(217,217,217,${1 - trail})`;
    ctx.fillRect(0, 0, w, h);

    for (const cfg of helices) drawHelix(now, cfg);

    requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  requestAnimationFrame(frame);
})();
