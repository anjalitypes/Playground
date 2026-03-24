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
    rotation:   0,       // output rotation in degrees (0-360)
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
const rotationVal  = document.getElementById('rotation-val');
const dialCanvas   = document.getElementById('rotation-dial');

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

// ── Rotation dial ─────────────────────────────────────────
const dial = new RotationDial(dialCanvas, angle => {
  state.options.rotation = angle;
  rotationVal.textContent = Math.round(angle) + '°';
  render();
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
    angle, numLayers, layerGap, edgeH, maxW, rotation,
    layerColor, bgColor, grid, glow,
  } = opts;

  const rad  = angle * Math.PI / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  // Scale image to fit maxW
  const scale = Math.min(1, maxW / img.naturalWidth);
  const W = img.naturalWidth  * scale;
  const H = img.naturalHeight * scale;

  const dX = layerGap * cosA;
  const dY = layerGap * sinA;

  const padX = 50;
  const padY = 50;

  const oy = padY + H + (numLayers - 1) * dY;
  const ox = padX;

  const baseW = Math.ceil(ox + W * cosA + (numLayers - 1) * dX + padX + edgeH);
  const baseH = Math.ceil(oy + W * sinA + edgeH + padY);

  // Always draw into an offscreen canvas, then rotate onto cv
  const off = Object.assign(document.createElement('canvas'), { width: baseW, height: baseH });
  const ctx = off.getContext('2d');

  ctx.clearRect(0, 0, baseW, baseH);

  // ── Background ──
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, baseW, baseH);

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

  // ── Blit offscreen onto cv with rotation applied ──
  const rotRad = rotation * Math.PI / 180;
  // Compute tight bounding box of the rotated rectangle
  const corners = [
    [0,      0],
    [baseW,  0],
    [baseW,  baseH],
    [0,      baseH],
  ].map(([x, y]) => [
    x * Math.cos(rotRad) - y * Math.sin(rotRad),
    x * Math.sin(rotRad) + y * Math.cos(rotRad),
  ]);
  const xs = corners.map(c => c[0]);
  const ys = corners.map(c => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cvW = Math.ceil(maxX - minX);
  const cvH = Math.ceil(maxY - minY);

  cv.width  = cvW;
  cv.height = cvH;

  const mainCtx = cv.getContext('2d');
  mainCtx.fillStyle = bgColor;
  mainCtx.fillRect(0, 0, cvW, cvH);
  mainCtx.save();
  mainCtx.translate(cvW / 2, cvH / 2);
  mainCtx.rotate(rotRad);
  mainCtx.drawImage(off, -baseW / 2, -baseH / 2);
  mainCtx.restore();
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

// ── Rotation Dial ─────────────────────────────────────────
// Canvas-based drag-to-rotate knob control.

class RotationDial {
  constructor(cv, onChange) {
    this.cv       = cv;
    this.ctx      = cv.getContext('2d');
    this.angle    = 0;      // degrees
    this.onChange = onChange;
    this.dragging = false;
    this.lastAngle = null;

    cv.addEventListener('mousedown',  e => this._down(e));
    cv.addEventListener('touchstart', e => this._down(e), { passive: false });
    window.addEventListener('mousemove',  e => this._move(e));
    window.addEventListener('touchmove',  e => this._move(e), { passive: false });
    window.addEventListener('mouseup',    () => this._up());
    window.addEventListener('touchend',   () => this._up());

    this._draw();
  }

  _clientXY(e) {
    return e.touches
      ? [e.touches[0].clientX, e.touches[0].clientY]
      : [e.clientX, e.clientY];
  }

  _angleFromEvent(e) {
    const rect = this.cv.getBoundingClientRect();
    const [cx, cy] = [rect.left + rect.width / 2, rect.top + rect.height / 2];
    const [mx, my] = this._clientXY(e);
    // atan2 gives angle from +x axis; offset by -90° so 0° is top
    return ((Math.atan2(my - cy, mx - cx) * 180 / Math.PI) + 90 + 360) % 360;
  }

  _down(e) {
    this.dragging  = true;
    this.lastAngle = this._angleFromEvent(e);
    e.preventDefault();
  }

  _move(e) {
    if (!this.dragging) return;
    const next = this._angleFromEvent(e);
    let delta = next - this.lastAngle;
    // Handle wrap-around
    if (delta >  180) delta -= 360;
    if (delta < -180) delta += 360;
    this.angle = (this.angle + delta + 360) % 360;
    this.lastAngle = next;
    this._draw();
    this.onChange(this.angle);
    e.preventDefault();
  }

  _up() { this.dragging = false; }

  _draw() {
    const { cv, ctx, angle } = this;
    const size = cv.width;
    const cx   = size / 2;
    const cy   = size / 2;
    const r    = size / 2 - 3;

    ctx.clearRect(0, 0, size, size);

    // Track ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a2d45';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Filled disc
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1d2e';
    ctx.fill();

    // Tick marks every 45°
    for (let a = 0; a < 360; a += 45) {
      const rad   = (a - 90) * Math.PI / 180;
      const inner = r - 5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
      ctx.lineTo(cx + Math.cos(rad) * r,     cy + Math.sin(rad) * r);
      ctx.strokeStyle = '#3a3d5a';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // Filled arc showing progress from 0 to current angle
    if (angle > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, -Math.PI / 2, (angle - 90) * Math.PI / 180);
      ctx.strokeStyle = 'rgba(99,102,241,0.35)';
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    // Indicator line
    const rad    = (angle - 90) * Math.PI / 180;
    const dotDist = r - 7;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * dotDist, cy + Math.sin(rad) * dotDist);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Indicator dot
    ctx.beginPath();
    ctx.arc(cx + Math.cos(rad) * dotDist, cy + Math.sin(rad) * dotDist, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();

    // Centre dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();
  }
}
