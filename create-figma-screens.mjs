/**
 * Run from YOUR local machine (not Claude Code):
 *   node create-figma-screens.mjs
 */

const FILE_KEY = "wihHsC5IUgCZ6sFmg4CeRa";
const TOKEN    = process.env.FIGMA_ACCESS_TOKEN;
if (!TOKEN) { console.error("❌ Set FIGMA_ACCESS_TOKEN env var first.\n   export FIGMA_ACCESS_TOKEN=your_token"); process.exit(1); }

const BASE = "https://api.figma.com/v1";
const headers = { "X-Figma-Token": TOKEN, "Content-Type": "application/json" };

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
  return json;
}

// ── helpers ──────────────────────────────────────────
function rgb(hex) {
  return {
    r: parseInt(hex.slice(1,3),16)/255,
    g: parseInt(hex.slice(3,5),16)/255,
    b: parseInt(hex.slice(5,7),16)/255,
    a: 1,
  };
}
function fill(hex, a=1)  { return [{ type:"SOLID", color: {...rgb(hex), a} }]; }
function stroke(hex)     { return [{ type:"SOLID", color: rgb(hex) }]; }

const C = {
  bg:      "#0f1117",
  card:    "#1a1d2e",
  card2:   "#1e2135",
  border:  "#2a2d45",
  accent:  "#6366f1",
  text:    "#e8eaf6",
  muted:   "#8892b0",
  green:   "#4ade80",
  yellow:  "#fbbf24",
  red:     "#ff4d4d",
  orange:  "#ff9966",
  amber:   "#ffcc66",
  chatU:   "#2d3155",
};

// ── node builders ────────────────────────────────────
function frame(name, x, y, w, h, fillHex, extra={}) {
  return {
    type: "FRAME",
    name,
    x, y,
    width: w, height: h,
    fills: fillHex ? fill(fillHex) : [],
    clipsContent: true,
    layoutMode: "NONE",
    ...extra,
  };
}

function rect(name, x, y, w, h, fillHex, fillA=1, extra={}) {
  return {
    type: "RECTANGLE",
    name,
    x, y,
    width: w, height: h,
    fills: fillHex ? fill(fillHex, fillA) : [],
    ...extra,
  };
}

function text(chars, x, y, size, weight, colorHex, extra={}) {
  return {
    type: "TEXT",
    characters: chars,
    x, y,
    fontSize: size,
    fontName: { family:"Inter", style: weight },
    fills: fill(colorHex),
    ...extra,
  };
}

// ── Get page ID ──────────────────────────────────────
async function getPageId() {
  const file = await api("GET", `/files/${FILE_KEY}?depth=1`);
  const page = file.document.children[0];
  console.log(`📄 Using page: "${page.name}" (${page.id})`);
  return page.id;
}

// ── Build screen nodes ────────────────────────────────

function buildScreen1() {
  const W = 1440, H = 900;
  const children = [];

  // Header
  children.push({
    ...frame("Header", 0, 0, W, 72, "#1a1d2e"),
    strokes: stroke(C.border),
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    children: [
      rect("Header BG", 0, 0, W, 72, "#1a1d2e"),
      rect("Icon BG", 20, 16, 40, 40, C.accent, 0.2, { cornerRadius: 8 }),
      text("🎓", 22, 18, 22, "Regular", C.text),
      text("AI Paper Detection Tool", 72, 14, 16, "Bold", C.text),
      text("Compare a student's new paper against their reference writing", 72, 36, 11, "Regular", C.muted),
    ],
  });

  // Left upload card
  children.push({
    ...frame("New Paper Card", 80, 120, 580, 200, C.card),
    cornerRadius: 12,
    strokes: stroke(C.border),
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    children: [
      text("📄", 16, 16, 22, "Regular", C.text),
      text("New Paper", 52, 16, 14, "SemiBold", C.text),
      text("The paper to be analyzed", 52, 36, 11, "Regular", C.muted),
      rect("Drop Zone", 16, 64, 548, 120, null, 0, {
        cornerRadius: 8,
        strokes: stroke(C.border),
        strokeWeight: 2,
        strokeAlign: "INSIDE",
        dashPattern: [6, 4],
      }),
      text("📁", 276, 88, 22, "Regular", C.muted),
      text("Drop file here or click to browse", 0, 120, 11, "Regular", C.muted, { width: 580, textAlignHorizontal: "CENTER" }),
      text("Supports .txt and .pdf", 0, 138, 10, "Regular", C.muted, { width: 580, textAlignHorizontal: "CENTER" }),
    ],
  });

  // VS badge
  children.push({
    ...frame("VS Badge", 690, 185, 60, 60, C.border),
    cornerRadius: 30,
    children: [ text("VS", 0, 20, 11, "Bold", C.muted, { width: 60, textAlignHorizontal: "CENTER" }) ],
  });

  // Right upload card
  children.push({
    ...frame("Reference Paper Card", 780, 120, 580, 200, C.card),
    cornerRadius: 12,
    strokes: stroke(C.border),
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    children: [
      text("📋", 16, 16, 22, "Regular", C.text),
      text("Reference Paper", 52, 16, 14, "SemiBold", C.text),
      text("A paper you know the student wrote", 52, 36, 11, "Regular", C.muted),
      rect("Drop Zone", 16, 64, 548, 120, null, 0, {
        cornerRadius: 8,
        strokes: stroke(C.border),
        strokeWeight: 2,
        strokeAlign: "INSIDE",
        dashPattern: [6, 4],
      }),
      text("📁", 276, 88, 22, "Regular", C.muted),
      text("Drop file here or click to browse", 0, 120, 11, "Regular", C.muted, { width: 580, textAlignHorizontal: "CENTER" }),
      text("Supports .txt and .pdf", 0, 138, 10, "Regular", C.muted, { width: 580, textAlignHorizontal: "CENTER" }),
    ],
  });

  // Analyze button (disabled)
  children.push({
    ...frame("Analyze Button", 620, 356, 200, 44, "#3a3d5a"),
    cornerRadius: 100,
    children: [ text("🔍  Analyze Papers", 0, 12, 13, "SemiBold", C.muted, { width: 200, textAlignHorizontal: "CENTER" }) ],
  });

  return { ...frame("Screen 1 — Upload State", 0, 0, W, H, C.bg), children };
}

function buildScreen2() {
  const W = 1440, H = 1000;
  const children = [];

  // Header (same)
  children.push({
    ...frame("Header", 0, 0, W, 72, "#1a1d2e"),
    strokes: stroke(C.border),
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    children: [
      rect("Header BG", 0, 0, W, 72, "#1a1d2e"),
      rect("Icon BG", 20, 16, 40, 40, C.accent, 0.2, { cornerRadius: 8 }),
      text("🎓", 22, 18, 22, "Regular", C.text),
      text("AI Paper Detection Tool", 72, 14, 16, "Bold", C.text),
      text("Compare a student's new paper against their reference writing", 72, 36, 11, "Regular", C.muted),
    ],
  });

  // Score cards
  const scoreCards = [
    { label:"VERDICT", value:"⚠️ Likely AI-Assisted", w:340, x:80,  bar:false },
    { label:"STYLE MATCH", value:"72%",   w:270, x:436, bar:true,  barColor:C.green  },
    { label:"AI PROBABILITY", value:"68%", w:270, x:722, bar:true,  barColor:C.yellow },
    { label:"FLAGGED PASSAGES", value:"3", w:200, x:1008, bar:false },
  ];

  scoreCards.forEach(sc => {
    const cardChildren = [
      text(sc.label, 16, 14, 9, "SemiBold", C.muted),
      text(sc.value, 16, 30, sc.label === "VERDICT" ? 13 : 22, "Bold", C.text),
    ];
    if (sc.bar) {
      cardChildren.push(rect("Track", 16, 62, sc.w-32, 5, C.border, 1, { cornerRadius:100 }));
      cardChildren.push(rect("Fill", 16, 62, Math.round((sc.w-32)*0.72), 5, sc.barColor, 1, { cornerRadius:100 }));
    }
    children.push({
      ...frame(sc.label, sc.x, 90, sc.w, 80, C.card),
      cornerRadius: 12,
      strokes: stroke(C.border),
      strokeWeight: 1,
      strokeAlign: "INSIDE",
      children: cardChildren,
    });
  });

  // Annotated paper panel
  const paperW = 840, panelY = 190, panelH = H - panelY - 24;
  children.push({
    ...frame("Annotated Paper", 80, panelY, paperW, panelH, C.card),
    cornerRadius: 12,
    strokes: stroke(C.border),
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    children: [
      rect("Header BG", 0, 0, paperW, 50, C.card2),
      rect("Header Border", 0, 49, paperW, 1, C.border),
      text("📄  Annotated Paper", 16, 14, 12, "SemiBold", C.text),
      // legend chips
      rect("High Chip", paperW-270, 14, 80, 22, C.red, 0.18, { cornerRadius:100 }),
      text("High suspicion", paperW-264, 19, 8, "Medium", C.red),
      rect("Med Chip",  paperW-184, 14, 88, 22, C.orange, 0.15, { cornerRadius:100 }),
      text("Medium suspicion", paperW-178, 19, 8, "Medium", C.orange),
      rect("Low Chip",  paperW-90, 14, 74, 22, C.amber, 0.12, { cornerRadius:100 }),
      text("Low suspicion", paperW-84, 19, 8, "Medium", C.amber),
      // body text
      text("The proliferation of artificial intelligence writing tools has introduced significant challenges", 16, 62, 11, "Regular", "#cdd6f4", { width: paperW-32 }),
      rect("High Highlight", 16, 82, paperW-32, 20, C.red, 0.12),
      text("for educational institutions worldwide. As these technologies become increasingly sophisticated,", 16, 84, 11, "Regular", "#ffb3b3", { width: paperW-32 }),
      rect("High Highlight 2", 16, 104, paperW-32, 20, C.red, 0.12),
      text("distinguishing between human-authored and AI-generated content has emerged as a critical concern.", 16, 106, 11, "Regular", "#ffb3b3", { width: paperW-32 }),
      text("", 16, 126, 11, "Regular", "#cdd6f4"),
      rect("Med Highlight", 16, 130, paperW-32, 20, C.orange, 0.10),
      text("Recent studies suggest that large language models demonstrate consistent stylistic patterns", 16, 132, 11, "Regular", "#ffd5bb", { width: paperW-32 }),
      text("that differ from typical student writing in measurable ways.", 16, 152, 11, "Regular", "#cdd6f4", { width: paperW-32 }),
      text("", 16, 172, 11, "Regular", "#cdd6f4"),
      rect("Low Highlight", 16, 176, paperW-32, 20, C.amber, 0.08),
      text("The methodology employed involves comparative analysis across sentence length variance,", 16, 178, 11, "Regular", "#fff0c0", { width: paperW-32 }),
      text("vocabulary diversity, syntactic complexity, and coherence markers.", 16, 198, 11, "Regular", "#cdd6f4", { width: paperW-32 }),
    ],
  });

  // Chat panel
  const chatW = 460, chatX = 80 + paperW + 20;
  children.push({
    ...frame("Chat Panel", chatX, panelY, chatW, panelH, C.card),
    cornerRadius: 12,
    strokes: stroke(C.border),
    strokeWeight: 1,
    strokeAlign: "INSIDE",
    children: [
      rect("Chat Header BG", 0, 0, chatW, 50, C.card2),
      rect("Chat Header Border", 0, 49, chatW, 1, C.border),
      text("💬  Analysis & Chat", 16, 14, 12, "SemiBold", C.text),
      rect("Reset Btn", chatW-110, 14, 94, 24, C.border, 1, { cornerRadius:8 }),
      text("↺  New Analysis", chatW-104, 19, 9, "Medium", C.muted),
      // AI bubble 1
      rect("AI Bubble 1", 12, 62, chatW-24, 100, C.card2, 1, { cornerRadius:12, strokes: stroke(C.border), strokeWeight:1, strokeAlign:"INSIDE" }),
      text("Claude", 12, 55, 9, "Regular", C.muted),
      text("Analysis complete. This paper shows a 72% style match\nwith the reference and a 68% AI probability.\n\n3 passages were flagged — the introduction and\nmethodology sections show patterns consistent with AI.", 20, 72, 11, "Regular", C.text, { width: chatW-40 }),
      // User bubble
      rect("User Bubble", 12, 176, chatW-24, 36, C.chatU, 1, { cornerRadius:12 }),
      text("You", chatW-30, 168, 9, "Regular", C.muted, { textAlignHorizontal:"RIGHT" }),
      text("Why is the methodology section flagged?", 20, 185, 11, "Regular", C.text, { width: chatW-40 }),
      // AI bubble 2
      rect("AI Bubble 2", 12, 226, chatW-24, 80, C.card2, 1, { cornerRadius:12, strokes: stroke(C.border), strokeWeight:1, strokeAlign:"INSIDE" }),
      text("Claude", 12, 219, 9, "Regular", C.muted),
      text("The methodology section uses overly uniform sentence\nlengths and lacks natural variance typical in student\nwriting. Vocabulary choices are atypically advanced.", 20, 236, 11, "Regular", C.text, { width: chatW-40 }),
      // Input
      rect("Input BG", 0, panelH-56, chatW, 56, C.card2),
      rect("Input Border", 0, panelH-56, chatW, 1, C.border),
      rect("Input Field", 12, panelH-44, chatW-80, 32, C.bg, 1, { cornerRadius:8, strokes: stroke(C.border), strokeWeight:1, strokeAlign:"INSIDE" }),
      text("Ask a follow-up question...", 20, panelH-38, 10, "Regular", C.muted),
      rect("Send Btn", chatW-60, panelH-44, 48, 32, C.accent, 1, { cornerRadius:8 }),
      text("↑", chatW-40, panelH-38, 14, "Bold", "#ffffff"),
    ],
  });

  return { ...frame("Screen 2 — Results State", 1520, 0, W, H, C.bg), children };
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log("🔍 Fetching file...");
  const pageId = await getPageId();

  console.log("🎨 Creating Screen 1 — Upload State...");
  const s1 = await api("POST", `/files/${FILE_KEY}/nodes`, {
    parentNodeId: pageId,
    nodeType: "FRAME",
    node: buildScreen1(),
  });
  console.log("✅ Screen 1 created:", s1.node?.id ?? JSON.stringify(s1));

  console.log("🎨 Creating Screen 2 — Results State...");
  const s2 = await api("POST", `/files/${FILE_KEY}/nodes`, {
    parentNodeId: pageId,
    nodeType: "FRAME",
    node: buildScreen2(),
  });
  console.log("✅ Screen 2 created:", s2.node?.id ?? JSON.stringify(s2));

  console.log("\n🎉 Done! Open your Figma file to see the screens.");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
