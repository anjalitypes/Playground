/* ============================================================
   Screen → Axonometric Drawing Converter
   Multi-layer stacked isometric renderer
   ============================================================ */

'use strict';

// ── Rotation Dial ─────────────────────────────────────────
// Must be defined before use — classes are not hoisted.

class RotationDial {
  constructor(cv, onChange) {
    this.cv       = cv;
    this.ctx      = cv.getContext('2d');
    this.angle    = 0;
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

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a2d45';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1d2e';
    ctx.fill();

    for (let a = 0; a < 360; a += 45) {
      const rad = (a - 90) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * (r - 5), cy + Math.sin(rad) * (r - 5));
      ctx.lineTo(cx + Math.cos(rad) * r,        cy + Math.sin(rad) * r);
      ctx.strokeStyle = '#3a3d5a';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    if (angle > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, -Math.PI / 2, (angle - 90) * Math.PI / 180);
      ctx.strokeStyle = 'rgba(99,102,241,0.35)';
      ctx.lineWidth   = 3;
      ctx.stroke();
    }

    const rad     = (angle - 90) * Math.PI / 180;
    const dotDist = r - 7;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * dotDist, cy + Math.sin(rad) * dotDist);
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + Math.cos(rad) * dotDist, cy + Math.sin(rad) * dotDist, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();
  }
}

// ── State ──────────────────────────────────────────────────
// layers: array of { id, img (HTMLImageElement|null), name }
// Layer 0 = front of the stack, Layer N-1 = back.
const state = {
  layers: [],
  options: {
    angle:      25,
    layerGap:   28,
    edgeH:      6,
    maxW:       640,
    rotation:   0,
    layerColor: '#2a2a3a',
    bgColor:    '#0a0a0f',
    grid:         false,
    glow:         true,
    transparent:  false,
    cornerRadius: 0,
    flipSide:     false,
    layerShadow: {
      enabled: false,
      color:   '#000000',
      opacity: 0.45,
      x:       0,
      y:       12,
      blur:    24,
    },
  }
};

let _layerIdCounter = 0;

// ── DOM refs ───────────────────────────────────────────────
const fileInput      = document.getElementById('file-input');
const dropZone       = document.getElementById('drop-zone');
const uploadWrap     = document.getElementById('upload-wrap');
const workspace      = document.getElementById('workspace');
const canvas         = document.getElementById('axo-canvas');
const canvasDims     = document.getElementById('canvas-dims');
const placeholder    = document.getElementById('canvas-placeholder');
const downloadBtn    = document.getElementById('download-btn');
const copyBtn        = document.getElementById('copy-btn');
const resetBtn       = document.getElementById('reset-btn');
const layerFileInput = document.getElementById('layer-file-input');
const addLayerBtn    = document.getElementById('add-layer-btn');
const layerListEl    = document.getElementById('layer-list');

const angleSlider  = document.getElementById('angle');
const gapSlider    = document.getElementById('gap');
const edgeSlider   = document.getElementById('edge');
const maxwSlider   = document.getElementById('maxw');
const layerColorIn = document.getElementById('layer-color');
const bgColorIn    = document.getElementById('bg-color');
const gridToggle        = document.getElementById('grid-toggle');
const glowToggle        = document.getElementById('glow-toggle');
const transparentToggle = document.getElementById('transparent-toggle');
const cornerRadiusSlider = document.getElementById('corner-radius');
const cornerRadiusVal    = document.getElementById('corner-radius-val');
const flipSideToggle     = document.getElementById('flip-side-toggle');
const shadowToggle       = document.getElementById('shadow-toggle');
const shadowColorIn      = document.getElementById('shadow-color');
const shadowOpacitySlider= document.getElementById('shadow-opacity');
const shadowOpacityVal   = document.getElementById('shadow-opacity-val');
const shadowXSlider      = document.getElementById('shadow-x');
const shadowXVal         = document.getElementById('shadow-x-val');
const shadowYSlider      = document.getElementById('shadow-y');
const shadowYVal         = document.getElementById('shadow-y-val');
const shadowBlurSlider   = document.getElementById('shadow-blur');
const shadowBlurVal      = document.getElementById('shadow-blur-val');
const angleVal     = document.getElementById('angle-val');
const gapVal       = document.getElementById('gap-val');
const edgeVal      = document.getElementById('edge-val');
const maxwVal      = document.getElementById('maxw-val');
const rotationVal  = document.getElementById('rotation-val');
const dialCanvas   = document.getElementById('rotation-dial');

// ── Layer management ──────────────────────────────────────

function newLayerObj(img = null, name = null) {
  const id = String(++_layerIdCounter);
  return { id, img, name: name || `Layer ${id}` };
}

function addLayer(img = null) {
  state.layers.unshift(newLayerObj(img));
  syncWorkspace();
  renderLayerList();
  render();
}

function removeLayer(id) {
  state.layers = state.layers.filter(l => l.id !== id);
  renderLayerList();
  render();
  if (state.layers.length === 0) showUploadZone();
}

function setLayerImage(id, img) {
  const layer = state.layers.find(l => l.id === id);
  if (!layer) return;
  layer.img = img;
  renderLayerList();
  render();
}

function moveLayer(fromIdx, toIdx) {
  const [item] = state.layers.splice(fromIdx, 1);
  state.layers.splice(toIdx, 0, item);
  renderLayerList();
  render();
}

// Which layer id is pending a file pick (null = add new layer)
let _pendingLayerId = null;

// ── Layer list UI ─────────────────────────────────────────

function renderLayerList() {
  layerListEl.innerHTML = '';

  if (state.layers.length === 0) {
    layerListEl.innerHTML = '<p class="layer-empty">No layers yet</p>';
    return;
  }

  let dragSrcIdx = null;

  state.layers.forEach((layer, i) => {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.draggable = true;
    item.dataset.idx = i;

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';

    // Thumbnail
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'layer-thumb-wrap';
    thumbWrap.title = 'Click to change image';

    const thumb = document.createElement('canvas');
    thumb.className = 'layer-thumb';
    thumb.width  = 46;
    thumb.height = 32;
    if (layer.img) {
      thumb.getContext('2d').drawImage(layer.img, 0, 0, 46, 32);
    }

    const overlay = document.createElement('div');
    overlay.className = 'layer-thumb-overlay';
    overlay.textContent = '⬆';

    thumbWrap.appendChild(thumb);
    thumbWrap.appendChild(overlay);
    thumbWrap.addEventListener('click', () => {
      _pendingLayerId = layer.id;
      layerFileInput.value = '';
      layerFileInput.click();
    });

    // Name
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.img ? layer.name : layer.name + ' (empty)';

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'layer-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove layer';
    removeBtn.addEventListener('click', () => removeLayer(layer.id));

    item.append(handle, thumbWrap, name, removeBtn);

    // ── Drag & drop reorder ──
    item.addEventListener('dragstart', e => {
      dragSrcIdx = i;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragSrcIdx = null;
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const toIdx = +item.dataset.idx;
      if (dragSrcIdx !== null && dragSrcIdx !== toIdx) moveLayer(dragSrcIdx, toIdx);
    });

    layerListEl.appendChild(item);
  });
}

// ── File input for add/replace layer ─────────────────────

layerFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  loadFile(file, img => {
    if (_pendingLayerId === null) {
      addLayer(img);
    } else {
      setLayerImage(_pendingLayerId, img);
    }
    _pendingLayerId = null;
  });
});

addLayerBtn.addEventListener('click', () => {
  _pendingLayerId = null;
  layerFileInput.value = '';
  layerFileInput.click();
});

// ── Initial upload zone ───────────────────────────────────

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadFile(e.target.files[0], img => addLayer(img));
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
  if (f && f.type.startsWith('image/')) loadFile(f, img => addLayer(img));
});

document.addEventListener('paste', e => {
  const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile(), img => addLayer(img));
});

// ── Slider / control wiring ───────────────────────────────

function bindSlider(el, key, unit, display) {
  el.addEventListener('input', () => {
    state.options[key] = +el.value;
    display.textContent = el.value + unit;
    render();
  });
}

bindSlider(angleSlider, 'angle',    '°',  angleVal);
bindSlider(gapSlider,   'layerGap', 'px', gapVal);
bindSlider(edgeSlider,  'edgeH',    'px', edgeVal);
bindSlider(maxwSlider,  'maxW',     'px', maxwVal);

layerColorIn.addEventListener('input', () => { state.options.layerColor = layerColorIn.value; render(); });
bgColorIn.addEventListener('input',    () => { state.options.bgColor    = bgColorIn.value;    render(); });
gridToggle.addEventListener('change',  () => { state.options.grid       = gridToggle.checked; render(); });
glowToggle.addEventListener('change',        () => { state.options.glow        = glowToggle.checked;        render(); });
transparentToggle.addEventListener('change', () => { state.options.transparent = transparentToggle.checked; render(); });

cornerRadiusSlider.addEventListener('input', () => {
  state.options.cornerRadius = +cornerRadiusSlider.value;
  cornerRadiusVal.textContent = cornerRadiusSlider.value + 'px';
  render();
});

flipSideToggle.addEventListener('change', () => { state.options.flipSide = flipSideToggle.checked; render(); });

function syncShadowControls() {
  const on = state.options.layerShadow.enabled;
  [shadowColorIn, shadowOpacitySlider, shadowXSlider, shadowYSlider, shadowBlurSlider]
    .forEach(el => el.disabled = !on);
}
shadowToggle.addEventListener('change', () => {
  state.options.layerShadow.enabled = shadowToggle.checked;
  syncShadowControls();
  render();
});
shadowColorIn.addEventListener('input', () => { state.options.layerShadow.color = shadowColorIn.value; render(); });
shadowOpacitySlider.addEventListener('input', () => {
  state.options.layerShadow.opacity = +shadowOpacitySlider.value;
  shadowOpacityVal.textContent = shadowOpacitySlider.value;
  render();
});
shadowXSlider.addEventListener('input', () => {
  state.options.layerShadow.x = +shadowXSlider.value;
  shadowXVal.textContent = shadowXSlider.value + 'px';
  render();
});
shadowYSlider.addEventListener('input', () => {
  state.options.layerShadow.y = +shadowYSlider.value;
  shadowYVal.textContent = shadowYSlider.value + 'px';
  render();
});
shadowBlurSlider.addEventListener('input', () => {
  state.options.layerShadow.blur = +shadowBlurSlider.value;
  shadowBlurVal.textContent = shadowBlurSlider.value + 'px';
  render();
});
syncShadowControls();

// ── Rotation dial ─────────────────────────────────────────
const dial = new RotationDial(dialCanvas, angle => {
  state.options.rotation = angle;
  rotationVal.textContent = Math.round(angle) + '°';
  render();
});

// ── Action buttons ────────────────────────────────────────

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
  state.layers = [];
  renderLayerList();
  showUploadZone();
});

// ── UI helpers ────────────────────────────────────────────

function syncWorkspace() {
  const hasLayers = state.layers.length > 0;
  uploadWrap.style.display  = hasLayers ? 'none' : '';
  workspace.style.display   = hasLayers ? ''     : 'none';
  canvas.style.display      = hasLayers ? 'block': 'none';
  placeholder.style.display = hasLayers ? 'none' : '';
  downloadBtn.disabled = !hasLayers;
  copyBtn.disabled     = !hasLayers;
}

function showUploadZone() {
  fileInput.value = '';
  uploadWrap.style.display  = '';
  workspace.style.display   = 'none';
  canvas.style.display      = 'none';
  placeholder.style.display = '';
  downloadBtn.disabled = true;
  copyBtn.disabled     = true;
}

// ── File loading utility ──────────────────────────────────

function loadFile(file, onLoad) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload  = () => { URL.revokeObjectURL(url); onLoad(img); };
  img.onerror = () => { URL.revokeObjectURL(url); alert('Could not load image.'); };
  img.src = url;
}

// ── Render ────────────────────────────────────────────────

function render() {
  const active = state.layers.filter(l => l.img);
  if (active.length === 0) return;
  drawAxo(canvas, active, state.options);
  canvasDims.textContent = `${canvas.width} × ${canvas.height}`;
}

// ── Core multi-layer axonometric renderer ─────────────────
//
// layers: array of { img } objects (all have .img set).
// Layer 0 = front of the stack. Layer N-1 = back.
// Drawn back-to-front so layer 0 ends up on top.
// Each layer uses its own .img; dimensions are normalised to the
// first layer's scaled size so all panels align.

function drawAxo(cv, layers, opts) {
  const img = layers[0].img; // reference for W/H
  const numLayers = layers.length;
  const {
    angle, layerGap, edgeH, maxW, rotation,
    layerColor, bgColor, grid, glow, transparent,
    cornerRadius, flipSide, layerShadow,
  } = opts;

  const rad   = angle * Math.PI / 180;
  const cosA  = Math.cos(rad);
  const sinAbs = Math.sin(rad);
  const sinA  = flipSide ? -sinAbs : sinAbs;

  // Scale image to fit maxW
  const scale = Math.min(1, maxW / img.naturalWidth);
  const W = img.naturalWidth  * scale;
  const H = img.naturalHeight * scale;

  const dX = layerGap * cosA;
  const dY = layerGap * sinAbs; // always positive — layers always stack upward

  const padX = 50;
  const padY = 50;

  // When flipped, the parallelogram extends upward on the right by sinAbs*W,
  // so oy must be larger to keep it within the canvas.
  const oy = padY + H + (flipSide ? sinAbs * W : 0) + (numLayers - 1) * dY;
  const ox = padX;

  const baseW = Math.ceil(ox + W * cosA + (numLayers - 1) * dX + padX + edgeH);
  const baseH = Math.ceil(oy + (flipSide ? 0 : W * sinAbs) + edgeH + padY);

  // Always draw into an offscreen canvas, then rotate onto cv
  const off = Object.assign(document.createElement('canvas'), { width: baseW, height: baseH });
  const ctx = off.getContext('2d');

  ctx.clearRect(0, 0, baseW, baseH);

  // ── Background ──
  if (!transparent) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, baseW, baseH);
  }

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

    // Draw screen image
    const lox = ox + i * dX;
    const loy = oy - i * dY;

    // Drop shadow on top 2 layers only
    if (i < 2) {
      ctx.save();
      ctx.shadowColor   = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur    = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      fillPoly(ctx, [TL, TR, BR, BL], 'rgba(0,0,0,0.01)');
      ctx.restore();
    }

    const cr = cornerRadius || 0;

    // Configurable layer drop shadow
    if (layerShadow.enabled) {
      ctx.save();
      ctx.shadowColor   = hexToRgba(layerShadow.color, layerShadow.opacity);
      ctx.shadowBlur    = layerShadow.blur;
      ctx.shadowOffsetX = layerShadow.x;
      ctx.shadowOffsetY = layerShadow.y;
      polyPath(ctx, [TL, TR, BR, BL], cr);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      ctx.fill();
      ctx.restore();
    }

    if (i === 0 && glow) {
      // Composite glow only over actual image pixels using a temp canvas
      const tmp = Object.assign(document.createElement('canvas'), { width: baseW, height: baseH });
      const tc = tmp.getContext('2d');
      tc.save();
      clipPoly(tc, [TL, TR, BR, BL], cr);
      tc.setTransform(cosA, sinA, 0, 1, lox, loy - H);
      tc.drawImage(layers[i].img, 0, 0, W, H);
      tc.restore();
      tc.globalCompositeOperation = 'source-atop';
      const g = tc.createLinearGradient(TL[0], TL[1], BL[0], BL[1]);
      g.addColorStop(0,   'rgba(255,255,255,0.08)');
      g.addColorStop(0.35,'rgba(255,255,255,0.01)');
      g.addColorStop(1,   'rgba(0,0,0,0.1)');
      fillPoly(tc, [TL, TR, BR, BL], g);
      ctx.drawImage(tmp, 0, 0);
    } else {
      ctx.save();
      clipPoly(ctx, [TL, TR, BR, BL], cr);
      ctx.setTransform(cosA, sinA, 0, 1, lox, loy - H);
      ctx.drawImage(layers[i].img, 0, 0, W, H);
      ctx.restore();
    }

    // Grid on front layer only
    if (i === 0 && grid) {
      drawGrid(ctx, lox, loy, W, H, cosA, sinA);
    }

  }

  // ── Blit offscreen onto cv with rotation applied ──
  const rotRad = rotation * Math.PI / 180;
  // Compute tight bounding box of the rotated rectangle
  const rotCorners = [
    [0,      0],
    [baseW,  0],
    [baseW,  baseH],
    [0,      baseH],
  ].map(([x, y]) => [
    x * Math.cos(rotRad) - y * Math.sin(rotRad),
    x * Math.sin(rotRad) + y * Math.cos(rotRad),
  ]);
  const xs = rotCorners.map(c => c[0]);
  const ys = rotCorners.map(c => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cvW = Math.ceil(maxX - minX);
  const cvH = Math.ceil(maxY - minY);

  cv.width  = cvW;
  cv.height = cvH;

  const mainCtx = cv.getContext('2d');
  if (!transparent) {
    mainCtx.fillStyle = bgColor;
    mainCtx.fillRect(0, 0, cvW, cvH);
  }
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

function clipPoly(ctx, pts, r = 0) {
  polyPath(ctx, pts, r);
  ctx.clip();
}

function polyPath(ctx, pts, r = 0) {
  const n = pts.length;
  ctx.beginPath();
  if (!r) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  } else {
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const dx1 = prev[0] - curr[0], dy1 = prev[1] - curr[1];
      const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
      const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
      const cr = Math.min(r, len1 / 2, len2 / 2);
      const sx = curr[0] + (dx1 / len1) * cr, sy = curr[1] + (dy1 / len1) * cr;
      const ex = curr[0] + (dx2 / len2) * cr, ey = curr[1] + (dy2 / len2) * cr;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      ctx.quadraticCurveTo(curr[0], curr[1], ex, ey);
    }
  }
  ctx.closePath();
}

function hexToRgba(hex, opacity) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
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

