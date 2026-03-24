/* ============================================================
   Screen → Axonometric Drawing Converter
   Multi-layer stacked isometric renderer
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  img: null,
  options: {
    angle:      25,      // tilt angle in degrees
    numLayers:  3,       // number of stacked layers
    layerGap:   28,      // canvas-space offset between layers
    edgeH:      6,       // thickness of visible edge strip per layer
    maxW:       640,     // max screen width
    orient:     'right', // 'right' | 'left'
    layerColor: '#2a2a3a',
    bgColor:    '#0a0a0f',
    grid:       false,
    glow:       true,
  }
};

// ── DOM refs ───────────────────────────────────────────────
const fileInput   = document.getElementById('file-input');
const dropZone    = document.getElementById('drop-zone');
const uploadWrap  = document.getElementById('upload-wrap');
const workspace   = document.getElementById('workspace');
const canvas      = document.getElementById('axo-canvas');
const canvasDims  = document.getElementById('canvas-dims');
const placeholder = document.getElementById('canvas-placeholder');
const downloadBtn = document.getElementById('download-btn');
const copyBtn     = document.getElementById('copy-btn');
const resetBtn    = document.getElementById('reset-btn');

const angleSlider  = document.getElementById('angle');
const layersSlider = document.getElementById('layers');
const gapSlider    = document.getElementById('gap');
const edgeSlider   = document.getElementById('edge');
const maxwSlider   = document.getElementById('maxw');
const layerColorIn = document.getElementById('layer-color');
const bgColorIn    = document.getElementById('bg-color');
const gridToggle   = document.getElementById('grid-toggle');
const glowToggle   = document.getElementById('glow-toggle');
const angleVal     = document.getElementById('angle-val');
const layersVal    = document.getElementById('layers-val');
const gapVal       = document.getElementById('gap-val');
const edgeVal      = document.getElementById('edge-val');
const maxwVal      = document.getElementById('maxw-val');
const orientBtns   = document.querySelectorAll('[data-orient]');

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
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadImage(f);
});

document.addEventListener('paste', e => {
  const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
  if (item) loadImage(item.getAsFile());
});

function bindSlider(el, key, unit, display) {
  el.addEventListener('input', () => {
    state.options[key] = +el.value;
    display.textContent = el.value + unit;
    render();
  });
}

bindSlider(angleSlider,  'angle',     '°',  angleVal);
bindSlider(layersSlider, 'numLayers', '',   layersVal);
bindSlider(gapSlider,    'layerGap',  'px', gapVal);
bindSlider(edgeSlider,   'edgeH',     'px', edgeVal);
bindSlider(maxwSlider,   'maxW',      'px', maxwVal);

layerColorIn.addEventListener('input', () => { state.options.layerColor = layerColorIn.value; render(); });
bgColorIn.addEventListener('input',    () => { state.options.bgColor    = bgColorIn.value;    render(); });
gridToggle.addEventListener('change',  () => { state.options.grid       = gridToggle.checked; render(); });
glowToggle.addEventListener('change',  () => { state.options.glow       = glowToggle.checked; render(); });

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

copyBtn.addEventListener('click', () => {
  canvas.toBlob(async blob => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      const orig = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 1800);
    } catch {
      copyBtn.textContent = '✗ Not supported';
      setTimeout(() => { copyBtn.textContent = '📋 Copy to clipboard'; }, 1800);
    }
  }, 'image/png');
});

resetBtn.addEventListener('click', () => {
  state.img = null;
  fileInput.value = '';
  workspace.style.display   = 'none';
  uploadWrap.style.display  = '';
  canvas.style.display      = 'none';
  placeholder.style.display = '';
  downloadBtn.disabled = true;
  copyBtn.disabled     = true;
});

// ── Image loading ─────────────────────────────────────────

function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    state.img = img;
    uploadWrap.style.display  = 'none';
    workspace.style.display   = '';
    placeholder.style.display = 'none';
    canvas.style.display      = 'block';
    downloadBtn.disabled      = false;
    copyBtn.disabled          = false;
    render();
  };
  img.onerror = () => alert('Could not load image.');
  img.src = url;
}

// ── Render ────────────────────────────────────────────────

function render() {
  if (!state.img) return;
  drawAxo(canvas, state.img, state.options);
  canvasDims.textContent = `${canvas.width} × ${canvas.height}`;
}

// ── Core multi-layer axonometric renderer ─────────────────
//
// Each layer is the same screenshot drawn as an isometric parallelogram.
// Layer 0 = front (bottom), Layer N-1 = back (top of stack).
// Layers are offset in the depth direction: (cosA, -sinA) in canvas space.
// Drawn back-to-front so front layer is on top.
//
// Screen face transform for a layer at canvas origin (ox, oy):
//   ctx.setTransform(cosA, sinA, 0, 1, ox, oy - H)
//   image (x,y) → canvas (cosA·x + ox,  sinA·x + y + oy - H)

function drawAxo(cv, img, opts) {
  const {
    angle, numLayers, layerGap, edgeH, maxW, orient,
    layerColor, bgColor, grid, glow,
  } = opts;

  const rad  = angle * Math.PI / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  // Scale image to fit maxW
  const scale = Math.min(1, maxW / img.naturalWidth);
  const W = img.naturalWidth  * scale;
  const H = img.naturalHeight * scale;

  // Depth direction per-layer step in canvas space (upper-right)
  const dX = layerGap * cosA;
  const dY = layerGap * sinA;

  // Padding
  const padX = 50;
  const padY = 50;

  const oy = padY + H + (numLayers - 1) * dY;
  const ox = padX;

  const cvW = Math.ceil(ox + W * cosA + (numLayers - 1) * dX + padX + edgeH);
  const cvH = Math.ceil(oy + W * sinA + edgeH + padY);

  cv.width  = cvW;
  cv.height = cvH;

  // For 'left' orientation draw into an offscreen canvas then flip.
  // We can't use ctx.scale(-1,1) because ctx.setTransform() (used for images)
  // replaces the current transform entirely, bypassing any canvas-level flip.
  const offscreen = orient === 'left'
    ? Object.assign(document.createElement('canvas'), { width: cvW, height: cvH })
    : null;
  const ctx = offscreen ? offscreen.getContext('2d') : cv.getContext('2d');

  ctx.clearRect(0, 0, cvW, cvH);

  // ── Background ──
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cvW, cvH);

  // Helper: transform image-space point for layer i
  const tp = (i, x, y) => {
    const lox = ox + i * dX;
    const loy = oy - i * dY;
    return [cosA * x + lox, sinA * x + y + loy - H];
  };

  // Precompute corners for all layers
  const corners = [];
  for (let i = 0; i < numLayers; i++) {
    corners.push({
      TL: tp(i, 0, 0),
      TR: tp(i, W, 0),
      BR: tp(i, W, H),
      BL: tp(i, 0, H),
    });
  }

  // ── Drop shadow under front layer ──
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur    = 36;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 14;
  const { TL: sTL, TR: sTR, BR: sBR, BL: sBL } = corners[0];
  fillPoly(ctx, [sTL, sTR, sBR, sBL], 'rgba(0,0,0,0.01)');
  ctx.restore();

  // ── Draw layers back-to-front ──
  for (let i = numLayers - 1; i >= 0; i--) {
    const { TL, TR, BR, BL } = corners[i];

    // Edge strip at bottom of this layer
    // The "floor" of each layer: goes straight down by edgeH pixels in canvas
    if (edgeH > 0) {
      const edgeCol = shadeHex(layerColor, i === 0 ? 0 : -0.1);
      fillPoly(ctx, [
        BL, BR,
        [BR[0], BR[1] + edgeH],
        [BL[0], BL[1] + edgeH],
      ], edgeCol);
      strokePoly(ctx, [
        BL, BR,
        [BR[0], BR[1] + edgeH],
        [BL[0], BL[1] + edgeH],
      ], 'rgba(255,255,255,0.06)', 0.5);
    }

    // Left connecting face between layer i and i-1 (front)
    // Visible only for back layers
    if (i > 0) {
      const { TL: fTL, BL: fBL } = corners[i - 1];
      const sideCol = shadeHex(layerColor, 0.05);
      fillPoly(ctx, [TL, fTL, fBL, BL], sideCol);
      strokePoly(ctx, [TL, fTL, fBL, BL], 'rgba(255,255,255,0.06)', 0.5);
    }

    // Draw screen image
    const lox = ox + i * dX;
    const loy = oy - i * dY;

    ctx.save();
    clipPoly(ctx, [TL, TR, BR, BL]);
    ctx.setTransform(cosA, sinA, 0, 1, lox, loy - H);
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();

    // Darken back layers
    if (i > 0) {
      const alpha = Math.min(0.55, i * 0.2);
      ctx.save();
      clipPoly(ctx, [TL, TR, BR, BL]);
      fillPoly(ctx, [TL, TR, BR, BL], `rgba(0,0,0,${alpha})`);
      ctx.restore();
    }

    // Glow on front layer only
    if (i === 0 && glow) {
      ctx.save();
      clipPoly(ctx, [TL, TR, BR, BL]);
      const g = ctx.createLinearGradient(TL[0], TL[1], BL[0], BL[1]);
      g.addColorStop(0,   'rgba(255,255,255,0.08)');
      g.addColorStop(0.35,'rgba(255,255,255,0.01)');
      g.addColorStop(1,   'rgba(0,0,0,0.1)');
      fillPoly(ctx, [TL, TR, BR, BL], g);
      ctx.restore();
    }

    // Grid on front layer only
    if (i === 0 && grid) {
      drawGrid(ctx, lox, loy, W, H, cosA, sinA);
    }

    // Outline
    const outlineAlpha = i === 0 ? 0.25 : 0.12;
    strokePoly(ctx, [TL, TR, BR, BL], `rgba(255,255,255,${outlineAlpha})`, 1);
  }

  // If we used an offscreen canvas, blit it onto the real canvas flipped
  if (offscreen) {
    const mainCtx = cv.getContext('2d');
    mainCtx.clearRect(0, 0, cvW, cvH);
    mainCtx.save();
    mainCtx.translate(cvW, 0);
    mainCtx.scale(-1, 1);
    mainCtx.drawImage(offscreen, 0, 0);
    mainCtx.restore();
  }
}

// ── Grid overlay ─────────────────────────────────────────

function drawGrid(ctx, ox, oy, W, H, cosA, sinA) {
  const step = Math.max(20, Math.round(W / 20));
  const tp = (x, y) => [cosA * x + ox, sinA * x + y + oy - H];

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth   = 0.5;

  for (let x = step; x < W; x += step) {
    const [ax, ay] = tp(x, 0);
    const [bx, by] = tp(x, H);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  for (let y = step; y < H; y += step) {
    const [ax, ay] = tp(0, y);
    const [bx, by] = tp(W, y);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
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
  ctx.lineWidth   = lw;
  ctx.stroke();
}

function clipPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.clip();
}

function shadeHex(hex, frac) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = clamp(parseInt(c.slice(0,2), 16) + Math.round(255 * frac));
  const g = clamp(parseInt(c.slice(2,4), 16) + Math.round(255 * frac));
  const b = clamp(parseInt(c.slice(4,6), 16) + Math.round(255 * frac));
  return `rgb(${r},${g},${b})`;
}

function clamp(v) { return Math.max(0, Math.min(255, v)); }
