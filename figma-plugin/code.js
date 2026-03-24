// ===================================================
// AI Paper Detection Tool — Figma Screen Creator
// Creates 2 screens matching the live app design
// ===================================================

figma.showUI(__html__, { width: 300, height: 200 });

// ── Color helpers ──────────────────────────────────
function hex(h) {
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  return { r, g, b };
}
function solid(h, a = 1) {
  return [{ type: 'SOLID', color: hex(h), opacity: a }];
}

// ── Font loader ────────────────────────────────────
async function loadFonts() {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
    figma.loadFontAsync({ family: 'Inter', style: 'SemiBold' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }),
  ]);
}

// ── Design tokens ─────────────────────────────────
const C = {
  bg:        '#0f1117',
  bgCard:    '#1a1d2e',
  bgCard2:   '#1e2135',
  border:    '#2a2d45',
  borderHov: '#3a3d5a',
  accent:    '#6366f1',
  text:      '#e8eaf6',
  muted:     '#8892b0',
  redHigh:   '#ff4d4d',
  redMed:    '#ff9966',
  redLow:    '#ffcc66',
  green:     '#4ade80',
  yellow:    '#fbbf24',
  chatUser:  '#2d3155',
};

// ── Node builders ──────────────────────────────────

function makeRect(name, x, y, w, h, fillColor, fillAlpha, opts = {}) {
  const node = figma.createRectangle();
  node.name = name;
  node.x = x; node.y = y;
  node.resize(w, h);
  node.fills = fillColor ? solid(fillColor, fillAlpha) : [];
  if (opts.cornerRadius) node.cornerRadius = opts.cornerRadius;
  if (opts.strokeColor) {
    node.strokes = solid(opts.strokeColor, opts.strokeAlpha || 1);
    node.strokeWeight = opts.strokeWeight || 1;
    node.strokeAlign = 'INSIDE';
  }
  if (opts.dashPattern) {
    node.dashPattern = opts.dashPattern;
  }
  return node;
}

function makeText(content, x, y, size, weight, color, opts = {}) {
  const node = figma.createText();
  node.x = x; node.y = y;
  node.fontName = { family: 'Inter', style: weight };
  node.fontSize = size;
  node.characters = content;
  node.fills = solid(color);
  if (opts.width) { node.textAutoResize = 'HEIGHT'; node.resize(opts.width, 100); }
  if (opts.align) node.textAlignHorizontal = opts.align;
  if (opts.lineHeight) node.lineHeight = { value: opts.lineHeight, unit: 'PIXELS' };
  return node;
}

function makeFrame(name, x, y, w, h, fillColor) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.x = x; frame.y = y;
  frame.resize(w, h);
  frame.fills = fillColor ? solid(fillColor) : [];
  frame.clipsContent = true;
  return frame;
}

// ── Component builders ─────────────────────────────

function buildHeader(parentW) {
  const header = makeFrame('Header', 0, 0, parentW, 72, '#1a1d2e');
  header.strokeAlign = 'INSIDE';
  header.strokes = solid(C.border);
  header.strokeWeight = 1;

  // Icon circle placeholder
  const iconBg = makeRect('Icon', 20, 16, 40, 40, C.accent, 0.2, { cornerRadius: 8 });
  const iconTxt = makeText('🎓', 22, 18, 22, 'Regular', C.text);

  const title = makeText('AI Paper Detection Tool', 72, 14, 16, 'Bold', C.text);
  const sub   = makeText('Compare a student\'s new paper against their reference writing', 72, 36, 11, 'Regular', C.muted);

  header.appendChild(iconBg);
  header.appendChild(iconTxt);
  header.appendChild(title);
  header.appendChild(sub);
  return header;
}

function buildUploadCard(label, emoji, subtext, x, y, w) {
  const card = makeFrame(label + ' Card', x, y, w, 200, C.bgCard);
  card.strokeAlign = 'INSIDE';
  card.strokes = solid(C.border);
  card.strokeWeight = 1;
  card.cornerRadius = 12;

  // Card header
  const emojiTxt = makeText(emoji, 16, 16, 22, 'Regular', C.text);
  const hTitle   = makeText(label, 50, 16, 14, 'SemiBold', C.text);
  const hSub     = makeText(subtext, 50, 34, 11, 'Regular', C.muted);
  card.appendChild(emojiTxt);
  card.appendChild(hTitle);
  card.appendChild(hSub);

  // Drop zone
  const dz = makeRect('Drop Zone', 16, 64, w - 32, 120, null, 0, {
    cornerRadius: 8,
    strokeColor: C.border,
    strokeWeight: 2,
    dashPattern: [6, 4],
  });
  card.appendChild(dz);

  const dzEmoji = makeText('📁', (w / 2) - 14, 88, 22, 'Regular', C.muted);
  const dzLabel = makeText('Drop file here or click to browse', 0, 120, 12, 'Regular', C.muted, {
    width: w, align: 'CENTER',
  });
  const dzHint  = makeText('Supports .txt and .pdf', 0, 138, 10, 'Regular', C.muted, {
    width: w, align: 'CENTER',
  });
  card.appendChild(dzEmoji);
  card.appendChild(dzLabel);
  card.appendChild(dzHint);

  return card;
}

function buildAnalyzeButton(x, y, enabled) {
  const btn = makeFrame('Analyze Button', x, y, 200, 44, enabled ? C.accent : '#3a3d5a');
  btn.cornerRadius = 100;

  const label = makeText(
    '🔍  Analyze Papers',
    0, 11, 14, 'SemiBold',
    enabled ? '#ffffff' : C.muted,
    { width: 200, align: 'CENTER' }
  );
  btn.appendChild(label);
  return btn;
}

function buildScoreCard(label, value, showBar, barColor, cardW, x, y) {
  const card = makeFrame(label + ' Score', x, y, cardW, 80, C.bgCard);
  card.strokeAlign = 'INSIDE';
  card.strokes = solid(C.border);
  card.strokeWeight = 1;
  card.cornerRadius = 12;

  const lbl = makeText(label.toUpperCase(), 16, 14, 9, 'SemiBold', C.muted);
  lbl.letterSpacing = { value: 1.2, unit: 'PIXELS' };
  const val = makeText(value, 16, 30, label === 'Verdict' ? 13 : 22, 'Bold', C.text);
  card.appendChild(lbl);
  card.appendChild(val);

  if (showBar) {
    const trackBg = makeRect('Bar Track', 16, 62, cardW - 32, 5, C.border, 1, { cornerRadius: 100 });
    const fill = makeRect('Bar Fill', 16, 62, Math.round((cardW - 32) * 0.72), 5, barColor, 1, { cornerRadius: 100 });
    card.appendChild(trackBg);
    card.appendChild(fill);
  }

  return card;
}

function buildAnnotatedPaperPanel(x, y, w, h) {
  const panel = makeFrame('Annotated Paper', x, y, w, h, C.bgCard);
  panel.strokeAlign = 'INSIDE';
  panel.strokes = solid(C.border);
  panel.strokeWeight = 1;
  panel.cornerRadius = 12;
  panel.clipsContent = true;

  // Panel header
  const phBg = makeRect('Panel Header BG', 0, 0, w, 50, C.bgCard2, 1);
  panel.appendChild(phBg);
  const phLine = makeRect('Panel Header Border', 0, 49, w, 1, C.border, 1);
  panel.appendChild(phLine);

  const phTitle = makeText('📄  Annotated Paper', 16, 14, 12, 'SemiBold', C.text);
  panel.appendChild(phTitle);

  // Legend chips
  const chips = [
    { label: 'High suspicion', color: '#ff4d4d', bg: 'rgba(255,77,77,0.18)' },
    { label: 'Medium suspicion', color: '#ff9966', bg: 'rgba(255,153,102,0.15)' },
    { label: 'Low suspicion', color: '#ffcc66', bg: 'rgba(255,204,102,0.12)' },
  ];
  let chipX = w - 270;
  chips.forEach(chip => {
    const chipBg = makeRect(chip.label + ' Chip', chipX, 14, 80, 22, chip.color, 0.15, { cornerRadius: 100 });
    panel.appendChild(chipBg);
    const chipTxt = makeText(chip.label, chipX + 6, 19, 8, 'Medium', chip.color, { width: 68 });
    panel.appendChild(chipTxt);
    chipX += 86;
  });

  // Body text lines (simulated paper content)
  const lines = [
    { text: 'The proliferation of artificial intelligence writing tools has introduced significant', flag: null },
    { text: 'challenges for educational institutions worldwide. As these technologies become', flag: null },
    { text: 'increasingly sophisticated, distinguishing between human-authored and AI-generated', flag: 'high' },
    { text: 'content has emerged as a critical concern for academic integrity.', flag: 'high' },
    { text: '', flag: null },
    { text: 'Recent studies suggest that large language models demonstrate consistent stylistic', flag: 'medium' },
    { text: 'patterns that differ from typical student writing in measurable ways. This analysis', flag: null },
    { text: 'examines those differences using corpus linguistics techniques.', flag: null },
    { text: '', flag: null },
    { text: 'The methodology employed in this research involves comparative analysis across', flag: null },
    { text: 'multiple dimensions: sentence length variance, vocabulary diversity, syntactic', flag: 'low' },
    { text: 'complexity, and coherence markers.', flag: null },
  ];

  lines.forEach((line, i) => {
    const y = 62 + i * 22;
    if (line.flag === 'high') {
      const highlight = makeRect('High Flag', 16, y - 2, w - 32, 20, '#ff4d4d', 0.12, {});
      panel.appendChild(highlight);
    } else if (line.flag === 'medium') {
      const highlight = makeRect('Med Flag', 16, y - 2, w - 32, 20, '#ff9966', 0.10, {});
      panel.appendChild(highlight);
    } else if (line.flag === 'low') {
      const highlight = makeRect('Low Flag', 16, y - 2, w - 32, 20, '#ffcc66', 0.08, {});
      panel.appendChild(highlight);
    }
    if (line.text) {
      const textColor = line.flag === 'high' ? '#ffb3b3' : line.flag === 'medium' ? '#ffd5bb' : line.flag === 'low' ? '#fff0c0' : '#cdd6f4';
      const txt = makeText(line.text, 16, y, 11, 'Regular', textColor, { width: w - 32 });
      panel.appendChild(txt);
    }
  });

  return panel;
}

function buildChatPanel(x, y, w, h) {
  const panel = makeFrame('Chat Panel', x, y, w, h, C.bgCard);
  panel.strokeAlign = 'INSIDE';
  panel.strokes = solid(C.border);
  panel.strokeWeight = 1;
  panel.cornerRadius = 12;
  panel.clipsContent = true;

  // Panel header
  const phBg = makeRect('Chat Header BG', 0, 0, w, 50, C.bgCard2, 1);
  panel.appendChild(phBg);
  const phLine = makeRect('Chat Header Border', 0, 49, w, 1, C.border, 1);
  panel.appendChild(phLine);
  const phTitle = makeText('💬  Analysis & Chat', 16, 14, 12, 'SemiBold', C.text);
  panel.appendChild(phTitle);

  // Reset button
  const resetBg = makeRect('Reset Btn', w - 110, 14, 94, 24, C.border, 1, { cornerRadius: 8 });
  panel.appendChild(resetBg);
  const resetTxt = makeText('↺  New Analysis', w - 104, 19, 9, 'Medium', C.muted);
  panel.appendChild(resetTxt);

  // AI message bubble
  const aiBubble = makeRect('AI Bubble', 12, 62, w - 24, 120, C.bgCard2, 1, { cornerRadius: 12 });
  aiBubble.strokeAlign = 'INSIDE';
  aiBubble.strokes = solid(C.border);
  aiBubble.strokeWeight = 1;
  panel.appendChild(aiBubble);

  const aiLabel = makeText('Claude', 12, 55, 9, 'Regular', C.muted);
  panel.appendChild(aiLabel);

  const aiMsg = makeText(
    'Analysis complete. This paper shows a 72% style match with the reference and a 68% AI probability.\n\n' +
    '3 passages were flagged — particularly the introduction and methodology sections show patterns consistent with AI generation.',
    20, 72, 11, 'Regular', C.text,
    { width: w - 40, lineHeight: 18 }
  );
  panel.appendChild(aiMsg);

  // User message bubble
  const userBubble = makeRect('User Bubble', 12, 196, w - 24, 48, C.chatUser, 1, { cornerRadius: 12 });
  panel.appendChild(userBubble);

  const userLabel = makeText('You', w - 30, 188, 9, 'Regular', C.muted, { align: 'RIGHT' });
  panel.appendChild(userLabel);

  const userMsg = makeText('Why is the methodology section flagged?', 20, 208, 11, 'Regular', C.text, { width: w - 40 });
  panel.appendChild(userMsg);

  // Another AI bubble
  const aiBubble2 = makeRect('AI Bubble 2', 12, 260, w - 24, 80, C.bgCard2, 1, { cornerRadius: 12 });
  aiBubble2.strokeAlign = 'INSIDE';
  aiBubble2.strokes = solid(C.border);
  aiBubble2.strokeWeight = 1;
  panel.appendChild(aiBubble2);

  const aiLabel2 = makeText('Claude', 12, 253, 9, 'Regular', C.muted);
  panel.appendChild(aiLabel2);

  const aiMsg2 = makeText(
    'The methodology section uses overly uniform sentence lengths and lacks the natural variance typical in student writing. The vocabulary choices are also atypically advanced for this course level.',
    20, 270, 11, 'Regular', C.text,
    { width: w - 40, lineHeight: 18 }
  );
  panel.appendChild(aiMsg2);

  // Input area
  const inputBg = makeRect('Input BG', 0, h - 56, w, 56, C.bgCard2, 1);
  panel.appendChild(inputBg);
  const inputLine = makeRect('Input Border', 0, h - 56, w, 1, C.border, 1);
  panel.appendChild(inputLine);

  const inputField = makeRect('Input Field', 12, h - 44, w - 80, 32, C.bg, 1, { cornerRadius: 8, strokeColor: C.border });
  panel.appendChild(inputField);
  const inputPlaceholder = makeText('Ask a follow-up question...', 20, h - 38, 10, 'Regular', C.muted);
  panel.appendChild(inputPlaceholder);

  const sendBtn = makeRect('Send Btn', w - 60, h - 44, 48, 32, C.accent, 1, { cornerRadius: 8 });
  panel.appendChild(sendBtn);
  const sendTxt = makeText('↑', w - 44, h - 38, 14, 'Bold', '#ffffff');
  panel.appendChild(sendTxt);

  return panel;
}

// ── SCREEN 1: Upload State ─────────────────────────

async function buildScreen1(page) {
  const W = 1440, H = 900;
  const screen = makeFrame('Screen 1 — Upload State', 0, 0, W, H, C.bg);

  // Header
  const header = buildHeader(W);
  screen.appendChild(header);

  // Upload cards
  const cardW = 580;
  const leftCard = buildUploadCard('New Paper', '📄', 'The paper to be analyzed', 80, 130, cardW);
  screen.appendChild(leftCard);

  // VS badge
  const vsBadge = makeFrame('VS Badge', 685, 195, 70, 70, C.border);
  vsBadge.cornerRadius = 35;
  const vsText = makeText('VS', 685, 218, 11, 'Bold', C.muted, { width: 70, align: 'CENTER' });
  screen.appendChild(vsBadge);
  screen.appendChild(vsText);

  const rightCard = buildUploadCard('Reference Paper', '📋', 'A paper you know the student wrote', 780, 130, cardW);
  screen.appendChild(rightCard);

  // Analyze button (disabled)
  const btn = buildAnalyzeButton(620, 368, false);
  screen.appendChild(btn);

  page.appendChild(screen);
}

// ── SCREEN 2: Results State ────────────────────────

async function buildScreen2(page) {
  const W = 1440, H = 1000;
  const screen = makeFrame('Screen 2 — Results State', 1520, 0, W, H, C.bg);

  // Header
  const header = buildHeader(W);
  screen.appendChild(header);

  // Score cards
  const scores = [
    { label: 'Verdict', value: '⚠️ Likely AI-Assisted', bar: false, barColor: null, w: 360 },
    { label: 'Style Match', value: '72%', bar: true, barColor: '#4ade80', w: 280 },
    { label: 'AI Probability', value: '68%', bar: true, barColor: '#fbbf24', w: 280 },
    { label: 'Flagged Passages', value: '3', bar: false, barColor: null, w: 200 },
  ];

  let cardX = 80;
  const scoreGap = 16;
  scores.forEach(score => {
    const card = buildScoreCard(score.label, score.value, score.bar, score.barColor, score.w, cardX, 98);
    screen.appendChild(card);
    cardX += score.w + scoreGap;
  });

  // Analysis layout
  const layoutY = 198;
  const paperW = 840;
  const chatW = 460;
  const layoutH = H - layoutY - 24;

  const paperPanel = buildAnnotatedPaperPanel(80, layoutY, paperW, layoutH);
  screen.appendChild(paperPanel);

  const chatPanel = buildChatPanel(80 + paperW + 20, layoutY, chatW, layoutH);
  screen.appendChild(chatPanel);

  page.appendChild(screen);
}

// ── Main message handler ───────────────────────────

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'create-screens') return;

  try {
    await loadFonts();

    const page = figma.currentPage;

    await buildScreen1(page);
    await buildScreen2(page);

    // Zoom to fit
    figma.viewport.scrollAndZoomIntoView(page.children.slice(-2));

    figma.ui.postMessage({ type: 'done', text: 'Screens created! 2 frames added.' });
  } catch (err) {
    figma.ui.postMessage({ type: 'error', text: String(err) });
  }
};
