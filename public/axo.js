/* ============================================================
   Screen → Axonometric Drawing Converter
   Canvas-based isometric projection renderer
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  img: null,
  options: {
    angle: 30,         // tilt angle in degrees
    depth: 40,         // device depth in px (before scale)
    bezel: 16,         // bezel width in px (image-space)
    maxW: 640,         // max screen width before scaling
    orient: 'right',   // 'right' | 'left'
    deviceColor: '#1e1e2e',
    bgColor: '#0f1117',
    grid: false,
    glow: true,
  }
};

// ── DOM refs ───────────────────────────────────────────────
const fileInput     = document.getElementById('file-input');
const dropZone      = document.getElementById('drop-zone');
const uploadWrap    = document.getElementById('upload-wrap');
const workspace     = document.getElementById('workspace');
const canvas        = document.getElementById('axo-canvas');
const canvasDims    = document.getElementById('canvas-dims');
const placeholder   = document.getElementById('canvas-placeholder');
const downloadBtn   = document.getElementById('download-btn');
const copyBtn       = document.getElementById('copy-btn');
const resetBtn      = document.getElementById('reset-btn');

const angleSlider   = document.getElementById('angle');
const depthSlider   = document.getElementById('depth');
const bezelSlider   = document.getElementById('bezel');
const maxwSlider    = document.getElementById('maxw');
const deviceColor   = document.getElementById('device-color');
const bgColorInput  = document.getElementById('bg-color');
const gridToggle    = document.getElementById('grid-toggle');
const glowToggle    = document.getElementById('glow-toggle');
const angleVal      = document.getElementById('angle-val');
const depthVal      = document.getElementById('depth-val');
const bezelVal      = document.getElementById('bezel-val');
const maxwVal       = document.getElementById('maxw-val');
const orientBtns    = document.querySelectorAll('[data-orient]');

// ── Event wiring ──────────────────────────────────────────

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImage(file);
});

document.addEventListener('paste', e => {
  const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
  if (item) loadImage(item.getAsFile());
});

angleSlider.addEventListener('input', () => {
  state.options.angle = +angleSlider.value;
  angleVal.textContent = angleSlider.value + '°';
  render();
});

depthSlider.addEventListener('input', () => {
  state.options.depth = +depthSlider.value;
  depthVal.textContent = depthSlider.value + 'px';
  render();
});

bezelSlider.addEventListener('input', () => {
  state.options.bezel = +bezelSlider.value;
  bezelVal.textContent = bezelSlider.value + 'px';
  render();
});

maxwSlider.addEventListener('input', () => {
  state.options.maxW = +maxwSlider.value;
  maxwVal.textContent = maxwSlider.value + 'px';
  render();
});

deviceColor.addEventListener('input', () => {
  state.options.deviceColor = deviceColor.value;
  render();
});

bgColorInput.addEventListener('input', () => {
  state.options.bgColor = bgColorInput.value;
  render();
});

gridToggle.addEventListener('change', () => {
  state.options.grid = gridToggle.checked;
  render();
});

glowToggle.addEventListener('change', () => {
  state.options.glow = glowToggle.checked;
  render();
});

orientBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    orientBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.options.orient = btn.dataset.orient;
    render();
  });
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'axo-screen.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

copyBtn.addEventListener('click', async () => {
  try {
    canvas.toBlob(async blob => {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      const orig = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 1800);
    }, 'image/png');
  } catch {
    copyBtn.textContent = '✗ Failed';
    setTimeout(() => { copyBtn.textContent = '📋 Copy to clipboard'; }, 1800);
  }
});

resetBtn.addEventListener('click', () => {
  state.img = null;
  fileInput.value = '';
  workspace.style.display = 'none';
  uploadWrap.style.display = '';
  canvas.style.display = 'none';
  placeholder.style.display = '';
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
});

// ── Image loading ─────────────────────────────────────────

function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    state.img = img;
    uploadWrap.style.display = 'none';
    workspace.style.display = '';
    placeholder.style.display = 'none';
    canvas.style.display = 'block';
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
    render();
  };
  img.onerror = () => alert('Could not load image. Please try a different file.');
  img.src = url;
}

// ── Render ────────────────────────────────────────────────

function render() {
  if (!state.img) return;
  drawAxo(canvas, state.img, state.options);
  canvasDims.textContent = `${canvas.width} × ${canvas.height}`;
}

// ── Core axonometric renderer ─────────────────────────────
//
// Isometric axes used:
//   X (screen horizontal): canvas direction = (cosA, sinA)  [right + down]
//   Y (screen vertical):   canvas direction = (0, 1)        [straight down]
//   Z (depth away):        canvas direction = (cosA, -sinA) [right + up]
//
// The screen face is drawn as a parallelogram:
//   TL (top-left)  = (ox, oy - H)
//   TR (top-right) = (ox + W·cosA, oy + W·sinA - H)
//   BR (bot-right) = (ox + W·cosA, oy + W·sinA)
//   BL (bot-left)  = (ox, oy)
//
// The transform that maps image (x,y) → canvas:
//   ctx.setTransform(cosA, sinA, 0, 1, ox, oy - H)
//
// The right side (depth D) goes in the +Z direction.
// The top face connects TL/TR to their depth counterparts.

function drawAxo(cv, img, opts) {
  const {
    angle, depth: D, bezel: B, maxW, orient,
    deviceColor: devCol, bgColor: bgCol,
    grid, glow,
  } = opts;

  const rad  = angle * Math.PI / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  // Scale image to fit maxW
  const scale = Math.min(1, maxW / img.naturalWidth);
  const W = img.naturalWidth * scale;
  const H = img.naturalHeight * scale;

  // Padding at edges
  const pad = Math.max(40, Math.ceil(D * sinA) + 24);

  // Origin (BL of screen face in canvas space)
  const ox = pad;
  const oy = pad + H;

  // Helper: map screen-image coords → canvas
  const tp = (x, y) => [cosA * x + ox, sinA * x + y + oy - H];

  // Key corner points of screen face
  const TL = tp(0,   0);
  const TR = tp(W,   0);
  const BR = tp(W,   H);
  const BL = tp(0,   H);

  // Depth direction unit: (cosA, -sinA) in canvas space
  // Back corners (shifted by D in depth direction)
  const TL_b = [TL[0] + D * cosA, TL[1] - D * sinA];
  const TR_b = [TR[0] + D * cosA, TR[1] - D * sinA];
  const BR_b = [BR[0] + D * cosA, BR[1] - D * sinA];

  // Canvas size
  const cvW = Math.ceil(BR_b[0] + pad);
  const cvH = Math.ceil(BR[1]   + pad);

  cv.width  = cvW;
  cv.height = cvH;

  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cvW, cvH);

  // For "left" orientation we flip horizontally around centre
  if (orient === 'left') {
    ctx.save();
    ctx.translate(cvW, 0);
    ctx.scale(-1, 1);
  }

  // ── Background ──
  ctx.fillStyle = bgCol;
  ctx.fillRect(0, 0, cvW, cvH);

  // ── Drop shadow under the whole device ──
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur    = 28;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 10;
  fillPoly(ctx, [TL, TR, BR, BL], 'rgba(0,0,0,0.01)');
  ctx.restore();

  // ── Colour helpers derived from deviceColor ──
  const devDark  = shadeHex(devCol, -0.35);
  const devMid   = shadeHex(devCol, -0.15);

  // ── Draw order: top face → right side → front face ──

  // Top face (TL → TR → TR_b → TL_b)
  fillPoly(ctx, [TL, TR, TR_b, TL_b], devMid);
  strokePoly(ctx, [TL, TR, TR_b, TL_b], 'rgba(255,255,255,0.08)', 1);

  // Right side face (TR → BR → BR_b → TR_b)
  fillPoly(ctx, [TR, BR, BR_b, TR_b], devDark);
  strokePoly(ctx, [TR, BR, BR_b, TR_b], 'rgba(255,255,255,0.05)', 1);

  // Device front face (bezel) — expanded by B pixels in image-space
  const oBL = tp(-B,   H + B);
  const oBR = tp(W + B, H + B);
  const oTR = tp(W + B, -B);
  const oTL = tp(-B,   -B);
  fillPoly(ctx, [oBL, oBR, oTR, oTL], devCol);

  // ── Screen image ──
  ctx.save();
  clipPoly(ctx, [TL, TR, BR, BL]);
  ctx.setTransform(cosA, sinA, 0, 1, ox, oy - H);
  ctx.drawImage(img, 0, 0, W, H);
  ctx.restore();

  // ── Screen glow (subtle highlight from top) ──
  if (glow) {
    ctx.save();
    clipPoly(ctx, [TL, TR, BR, BL]);
    const g = ctx.createLinearGradient(TL[0], TL[1], BL[0], BL[1]);
    g.addColorStop(0,   'rgba(255,255,255,0.07)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.01)');
    g.addColorStop(1,   'rgba(0,0,0,0.12)');
    fillPoly(ctx, [TL, TR, BR, BL], g);
    ctx.restore();
  }

  // ── Grid overlay ──
  if (grid) {
    drawGrid(ctx, tp, W, H, cosA, sinA, ox, oy);
  }

  // ── Outline edges ──
  const outline = 'rgba(255,255,255,0.18)';
  strokePoly(ctx, [TL, TR, BR, BL], outline, 1);
  // depth edges
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  line(ctx, TL, TL_b);
  line(ctx, TR, TR_b);
  line(ctx, BR, BR_b);

  if (orient === 'left') ctx.restore();
}

// ── Grid overlay ─────────────────────────────────────────

function drawGrid(ctx, tp, W, H, cosA, sinA, ox, oy) {
  const step = Math.max(20, Math.round(W / 20));
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;

  // Vertical grid lines (constant x in image-space)
  for (let x = step; x < W; x += step) {
    const top = tp(x, 0);
    const bot = tp(x, H);
    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.lineTo(bot[0],  bot[1]);
    ctx.stroke();
  }

  // Horizontal grid lines (constant y in image-space)
  for (let y = step; y < H; y += step) {
    const left  = tp(0, y);
    const right = tp(W, y);
    ctx.beginPath();
    ctx.moveTo(left[0],  left[1]);
    ctx.lineTo(right[0], right[1]);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Canvas helpers ────────────────────────────────────────

function fillPoly(ctx, pts, style) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = style;
  ctx.fill();
}

function strokePoly(ctx, pts, style, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function clipPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.clip();
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

// Lighten (+) or darken (−) a hex colour by a fraction
function shadeHex(hex, frac) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + Math.round(255 * frac)));
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + Math.round(255 * frac)));
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + Math.round(255 * frac)));
  return `rgb(${r},${g},${b})`;
}
