/* ============================================================
   AI Paper Detection Tool — Frontend
   ============================================================ */

// State
let newPaperFile = null;
let refPaperFile = null;
let analysisState = null; // { newPaperText, referencePaperText, annotations }
let chatHistory = [];
let isChatStreaming = false;

// Elements
const newPaperInput = document.getElementById('new-paper-input');
const refPaperInput = document.getElementById('ref-paper-input');
const newPaperZone = document.getElementById('new-paper-zone');
const refPaperZone = document.getElementById('ref-paper-zone');
const newPaperSelected = document.getElementById('new-paper-selected');
const refPaperSelected = document.getElementById('ref-paper-selected');
const newPaperPlaceholder = document.getElementById('new-paper-placeholder');
const refPaperPlaceholder = document.getElementById('ref-paper-placeholder');
const newPaperName = document.getElementById('new-paper-name');
const refPaperName = document.getElementById('ref-paper-name');
const newPaperRemove = document.getElementById('new-paper-remove');
const refPaperRemove = document.getElementById('ref-paper-remove');
const analyzeBtn = document.getElementById('analyze-btn');
const analyzeBtnText = document.getElementById('analyze-btn-text');
const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const resultsSection = document.getElementById('results-section');
const annotatedPaper = document.getElementById('annotated-paper');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const resetBtn = document.getElementById('reset-btn');
const annotationTooltip = document.getElementById('annotation-tooltip');
const tooltipLevel = document.getElementById('tooltip-level');
const tooltipReason = document.getElementById('tooltip-reason');
const verdictValue = document.getElementById('verdict-value');
const matchValue = document.getElementById('match-value');
const matchBar = document.getElementById('match-bar');
const aiValue = document.getElementById('ai-value');
const aiBar = document.getElementById('ai-bar');
const flagsValue = document.getElementById('flags-value');

// ============================================================
// FILE UPLOAD HANDLING
// ============================================================

function setupFileInput(input, zone, placeholder, selected, nameEl, removeBtn, setter) {
  // Click to upload
  zone.addEventListener('click', (e) => {
    if (e.target === removeBtn) return;
    input.click();
  });

  input.addEventListener('change', () => {
    if (input.files[0]) setFile(input.files[0]);
  });

  // Drag and drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  // Remove button
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    setter(null);
    input.value = '';
    placeholder.hidden = false;
    selected.hidden = true;
    updateAnalyzeBtn();
  });

  function setFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'pdf'].includes(ext)) {
      showError('Only .txt and .pdf files are supported.');
      return;
    }
    setter(file);
    nameEl.textContent = file.name;
    placeholder.hidden = true;
    selected.hidden = false;
    updateAnalyzeBtn();
  }
}

setupFileInput(
  newPaperInput, newPaperZone, newPaperPlaceholder, newPaperSelected,
  newPaperName, newPaperRemove, (f) => { newPaperFile = f; }
);

setupFileInput(
  refPaperInput, refPaperZone, refPaperPlaceholder, refPaperSelected,
  refPaperName, refPaperRemove, (f) => { refPaperFile = f; }
);

function updateAnalyzeBtn() {
  analyzeBtn.disabled = !(newPaperFile && refPaperFile);
}

// ============================================================
// ANALYZE
// ============================================================

analyzeBtn.addEventListener('click', startAnalysis);

async function startAnalysis() {
  if (!newPaperFile || !refPaperFile) return;

  // Reset results
  analysisState = null;
  chatHistory = [];
  renderChatMessages();
  annotatedPaper.innerHTML = '';

  // Update UI state
  analyzeBtn.disabled = true;
  analyzeBtn.classList.add('loading');
  analyzeBtnText.textContent = 'Analyzing...';
  statusBar.classList.remove('hidden');
  setStatus('Uploading papers...');
  resultsSection.classList.add('hidden');

  const formData = new FormData();
  formData.append('newPaper', newPaperFile);
  formData.append('referencePaper', refPaperFile);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Upload failed');
    }

    resultsSection.classList.remove('hidden');
    await processSSEStream(response.body);

  } catch (err) {
    showError(err.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove('loading');
    analyzeBtnText.textContent = 'Analyze Papers';
    statusBar.classList.add('hidden');
  }
}

async function processSSEStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentAssistantEl = null;
  let currentAssistantText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        // Handled below with data
        continue;
      }
      if (!line.startsWith('data: ')) continue;

      const dataStr = line.slice(6).trim();
      if (!dataStr) continue;

      let event = 'message';
      // Scan back through lines to find the event type
      const lineIdx = lines.indexOf(line);
      for (let i = lineIdx - 1; i >= 0; i--) {
        if (lines[i].startsWith('event: ')) {
          event = lines[i].slice(7).trim();
          break;
        }
      }

      try {
        const data = JSON.parse(dataStr);
        handleSSEEvent(event, data, {
          getCurrentAssistantEl: () => currentAssistantEl,
          setCurrentAssistantEl: (el) => { currentAssistantEl = el; },
          getCurrentAssistantText: () => currentAssistantText,
          setCurrentAssistantText: (t) => { currentAssistantText = t; },
        });
      } catch { /* skip malformed */ }
    }
  }

  // Finalize any streaming message
  if (currentAssistantEl) {
    finalizeStreamingMessage(currentAssistantEl, currentAssistantText);
  }
}

function handleSSEEvent(event, data, ctx) {
  switch (event) {
    case 'status':
      setStatus(data.message);
      break;

    case 'paper_text':
      // Store paper text, render placeholder while waiting for annotations
      if (!analysisState) analysisState = {};
      analysisState.newPaperText = data.newPaperText;
      annotatedPaper.textContent = 'Analyzing passages...';
      annotatedPaper.style.color = 'var(--text-muted)';
      break;

    case 'annotations': {
      if (!analysisState) analysisState = {};
      analysisState.annotations = data;

      // Update score cards
      verdictValue.textContent = data.verdict || '—';
      matchValue.textContent = `${data.match_rate ?? '—'}%`;
      matchBar.style.width = `${data.match_rate ?? 0}%`;
      aiValue.textContent = `${data.ai_probability ?? '—'}%`;
      aiBar.style.width = `${data.ai_probability ?? 0}%`;
      flagsValue.textContent = data.annotations?.length ?? '—';

      // Color the verdict
      const prob = data.ai_probability ?? 0;
      if (prob >= 70) verdictValue.style.color = 'var(--red-high)';
      else if (prob >= 40) verdictValue.style.color = 'var(--yellow)';
      else verdictValue.style.color = 'var(--green)';

      // Render annotated paper
      if (analysisState.newPaperText) {
        renderAnnotatedPaper(analysisState.newPaperText, data.annotations || []);
      }

      setStatus('Generating detailed analysis...');
      break;
    }

    case 'chat_chunk': {
      if (!ctx.getCurrentAssistantEl()) {
        const el = appendChatMessage('assistant', '', true);
        ctx.setCurrentAssistantEl(el);
        ctx.setCurrentAssistantText('');
      }
      const newText = ctx.getCurrentAssistantText() + data.text;
      ctx.setCurrentAssistantText(newText);
      updateStreamingMessage(ctx.getCurrentAssistantEl(), newText);
      break;
    }

    case 'chat_done': {
      if (ctx.getCurrentAssistantEl()) {
        finalizeStreamingMessage(ctx.getCurrentAssistantEl(), ctx.getCurrentAssistantText());
        ctx.setCurrentAssistantEl(null);
        ctx.setCurrentAssistantText('');
      }

      // Save context for follow-up chat
      if (data.newPaperText) {
        if (!analysisState) analysisState = {};
        analysisState.newPaperText = data.newPaperText;
        analysisState.referencePaperText = data.referencePaperText;
      }

      // Save the analysis message to history
      const lastMsg = chatMessages.lastElementChild;
      if (lastMsg) {
        const bubble = lastMsg.querySelector('.msg-bubble');
        if (bubble) {
          chatHistory.push({ role: 'assistant', content: bubble.textContent });
        }
      }

      // Enable chat
      chatInput.disabled = false;
      chatSend.disabled = false;
      chatInput.focus();
      break;
    }

    case 'error':
      showError(data.message);
      break;
  }
}

// ============================================================
// PAPER ANNOTATION RENDERING
// ============================================================

function renderAnnotatedPaper(text, annotations) {
  annotatedPaper.style.color = '';

  if (!annotations || annotations.length === 0) {
    annotatedPaper.textContent = text;
    return;
  }

  // Build sorted list of [start, end, annotation] ranges
  const ranges = [];

  for (const ann of annotations) {
    if (!ann.flagged_text) continue;
    const idx = text.indexOf(ann.flagged_text);
    if (idx === -1) {
      // Try case-insensitive search
      const lowerText = text.toLowerCase();
      const lowerFlagged = ann.flagged_text.toLowerCase();
      const cidx = lowerText.indexOf(lowerFlagged);
      if (cidx !== -1) {
        ranges.push({ start: cidx, end: cidx + ann.flagged_text.length, ann });
      }
      continue;
    }
    ranges.push({ start: idx, end: idx + ann.flagged_text.length, ann });
  }

  // Sort by start position, handle overlaps by keeping longer/earlier range
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping ranges
  const merged = [];
  for (const r of ranges) {
    if (merged.length === 0 || r.start >= merged[merged.length - 1].end) {
      merged.push(r);
    }
  }

  // Build HTML
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const { start, end, ann } of merged) {
    // Text before
    if (start > cursor) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, start)));
    }

    // Flagged span
    const span = document.createElement('span');
    span.className = `flagged flagged--${ann.suspicion_level || 'medium'}`;
    span.textContent = text.slice(start, end);
    span.dataset.reason = ann.reason;
    span.dataset.level = ann.suspicion_level || 'medium';

    span.addEventListener('mouseenter', (e) => showTooltip(e, ann));
    span.addEventListener('mousemove', positionTooltip);
    span.addEventListener('mouseleave', hideTooltip);
    span.addEventListener('click', () => {
      // Scroll to annotation in paper
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    fragment.appendChild(span);
    cursor = end;
  }

  // Remaining text
  if (cursor < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
  }

  annotatedPaper.innerHTML = '';
  annotatedPaper.appendChild(fragment);
}

// ============================================================
// TOOLTIP
// ============================================================

function showTooltip(e, ann) {
  tooltipLevel.textContent = `${ann.suspicion_level?.toUpperCase() || 'MEDIUM'} SUSPICION`;
  tooltipLevel.className = `tooltip-level ${ann.suspicion_level || 'medium'}`;
  tooltipReason.textContent = ann.reason;
  annotationTooltip.classList.remove('hidden');
  positionTooltip(e);
}

function positionTooltip(e) {
  const tooltip = annotationTooltip;
  const tw = tooltip.offsetWidth || 280;
  const th = tooltip.offsetHeight || 80;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = e.clientX + 16;
  let top = e.clientY + 16;

  if (left + tw > vw - 16) left = e.clientX - tw - 16;
  if (top + th > vh - 16) top = e.clientY - th - 16;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  annotationTooltip.classList.add('hidden');
}

// ============================================================
// CHAT
// ============================================================

chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

async function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || isChatStreaming || !analysisState) return;

  isChatStreaming = true;
  chatInput.disabled = true;
  chatSend.disabled = true;
  chatInput.value = '';

  // Add user message to UI and history
  appendChatMessage('user', message);
  chatHistory.push({ role: 'user', content: message });

  let assistantEl = null;
  let assistantText = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: chatHistory.slice(-10), // Keep last 10 turns
        newPaperText: analysisState.newPaperText,
        referencePaperText: analysisState.referencePaperText,
        annotations: analysisState.annotations,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Chat request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastEvent = 'message';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          lastEvent = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith('data: ')) continue;

        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr);

          if (lastEvent === 'chat_chunk') {
            if (!assistantEl) {
              assistantEl = appendChatMessage('assistant', '', true);
            }
            assistantText += data.text;
            updateStreamingMessage(assistantEl, assistantText);
          } else if (lastEvent === 'chat_done') {
            if (assistantEl) {
              finalizeStreamingMessage(assistantEl, assistantText);
              chatHistory.push({ role: 'assistant', content: assistantText });
            }
          } else if (lastEvent === 'error') {
            showError(data.message);
          }
        } catch { /* skip */ }
      }
    }

  } catch (err) {
    showError(err.message);
  } finally {
    isChatStreaming = false;
    chatInput.disabled = false;
    chatSend.disabled = false;
    chatInput.focus();
  }
}

// ============================================================
// CHAT UI HELPERS
// ============================================================

function appendChatMessage(role, text, streaming = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-msg chat-msg--${role}`;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? 'You' : 'AI Analyst';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (streaming) {
    bubble.innerHTML = '<span class="typing-cursor"></span>';
  } else {
    bubble.textContent = text;
  }

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return wrapper;
}

function updateStreamingMessage(el, text) {
  const bubble = el.querySelector('.msg-bubble');
  if (!bubble) return;
  bubble.innerHTML = escapeHtml(text) + '<span class="typing-cursor"></span>';
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function finalizeStreamingMessage(el, text) {
  const bubble = el.querySelector('.msg-bubble');
  if (!bubble) return;
  bubble.textContent = text;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderChatMessages() {
  chatMessages.innerHTML = '';
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

// ============================================================
// RESET
// ============================================================

resetBtn.addEventListener('click', () => {
  analysisState = null;
  chatHistory = [];
  newPaperFile = null;
  refPaperFile = null;

  // Reset file inputs
  newPaperInput.value = '';
  refPaperInput.value = '';
  newPaperPlaceholder.hidden = false;
  newPaperSelected.hidden = true;
  refPaperPlaceholder.hidden = false;
  refPaperSelected.hidden = true;

  // Reset UI
  resultsSection.classList.add('hidden');
  statusBar.classList.add('hidden');
  renderChatMessages();
  annotatedPaper.innerHTML = '';
  chatInput.disabled = true;
  chatSend.disabled = true;
  verdictValue.textContent = '—';
  matchValue.textContent = '—';
  aiValue.textContent = '—';
  flagsValue.textContent = '—';
  matchBar.style.width = '0%';
  aiBar.style.width = '0%';

  updateAnalyzeBtn();

  // Scroll back to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============================================================
// UTILITIES
// ============================================================

function setStatus(msg) {
  statusText.textContent = msg;
}

function showError(msg) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-msg chat-msg--assistant';

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = 'Error';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.style.borderColor = 'var(--red-high)';
  bubble.style.color = 'var(--red-high)';
  bubble.textContent = `⚠️ ${msg}`;

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  resultsSection.classList.remove('hidden');
}
