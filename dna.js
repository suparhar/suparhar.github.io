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

  // Palette (edit these if you want a different vibe)
  const palette = ["#7aa2f7", "#89ddff", "#c099ff", "#7ee787", "#ffb86c"];

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
  const bg = "#d9d9d9";   // darker than before
  const trail = 0.12;     // lower = more motion blur

  // Multiple helix “instances”
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

// Make MANY smaller helices
const HELIX_COUNT = 14; // increase to 18 if you want even denser
const helices = Array.from({ length: HELIX_COUNT }, (_, k) => {
  const x = 0.08 + rand() * 0.84;         // avoid extreme edges
  const y = 0.10 + rand() * 0.80;
  const scale = 0.45 + rand() * 0.35;     // small-ish
  const rot = -0.9 + rand() * 1.8;        // varied angles
  const speed = 0.0009 + rand() * 0.0006; // subtle motion differences
  const amp = 85 + rand() * 35;           // strand separation
  const height = 420 + rand() * 320;      // shorter than before
  const rungs = Math.floor(52 + rand() * 26);
  const colorShift = Math.floor(rand() * 6);

  return { x, y, scale, rot, speed, amp, height, rungs, colorShift };
});



  function drawHelix(now, cfg) {
    const mx = 0.5;
  const my = 0.5;


    const cx = w * cfg.x;
    const cy = h * cfg.y;

    const helixHeight = Math.min(h * 0.9, cfg.height) * cfg.scale;
    const topY = cy - helixHeight / 2;

    // Mouse affects amplitude + “tightness”
    const amp = (cfg.amp * cfg.scale) * lerp(0.85, 1.15, mx);
    const wobble = lerp(0.85, 1.25, my);

    const time = now * (cfg.speed + mx * 0.00045);

    // Rotation matrix
    const cosR = Math.cos(cfg.rot);
    const sinR = Math.sin(cfg.rot);

    for (let i = 0; i < cfg.rungs; i++) {
      const p = i / (cfg.rungs - 1);
      const y = topY + p * helixHeight;

      // phase progresses down the strand
      const phase = time + p * (Math.PI * 6.0) * wobble;

      // local coords (before rotation)
      const lx1 = Math.cos(phase) * amp;
      const lx2 = Math.cos(phase + Math.PI) * amp;

      // Depth from sine
      const depth = (Math.sin(phase) + 1) / 2;
      const lineAlpha = lerp(0.10, 0.38, depth);
      const nodeAlpha = lerp(0.15, 0.70, depth);

      // Apply rotation around (cx,cy): rotate x offsets and y relative to center
      const dy = (y - cy);

      const x1 = cx + (lx1 * cosR - dy * sinR);
      const y1 = cy + (lx1 * sinR + dy * cosR);

      const x2 = cx + (lx2 * cosR - dy * sinR);
      const y2 = cy + (lx2 * sinR + dy * cosR);

      // Colored base pairs
      const c = palette[(i + cfg.colorShift) % palette.length];

      // Rung line
      ctx.lineWidth = lerp(0.8, 1.6, depth) * cfg.scale;
      ctx.strokeStyle = hexToRgba(c, lineAlpha);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Strand nodes (dark neutral so color pops)
      const r = lerp(1.1, 2.6, depth) * cfg.scale;
      circle(x1, y1, r, hexToRgba("#3a3a3a", nodeAlpha));
      circle(x2, y2, r, hexToRgba("#3a3a3a", nodeAlpha));

      // Small colored dots near ends = “bases”
      const rr = lerp(0.7, 1.7, depth) * cfg.scale;
      circle(lerp(x1, x2, 0.18), lerp(y1, y2, 0.18), rr, hexToRgba(c, lerp(0.20, 0.85, depth)));
      circle(lerp(x2, x1, 0.18), lerp(y2, y1, 0.18), rr, hexToRgba(c, lerp(0.20, 0.85, depth)));
    }
  }

  function frame(now) {
    // background with trail
    ctx.fillStyle = `rgba(217,217,217,${1 - trail})`; // matches bg
    ctx.fillRect(0, 0, w, h);

    // draw multiple helices
    for (const cfg of helices) drawHelix(now, cfg);

    requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // initial fill
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  requestAnimationFrame(frame);
})();
