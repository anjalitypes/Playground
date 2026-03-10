/* ============================================================
   Prescription Tracker — Frontend
   ============================================================ */

// ─── State ───────────────────────────────────────────────────
let medications = [];
let settings = { userAge: null };
let editingId = null;          // medication id being edited (null = new)
let pendingToggleId = null;    // id waiting for interaction confirmation
let currentImageFile = null;   // File object for new uploads
let existingImageFile = null;  // filename string already saved on server
let ageDismissed = false;

// ─── Init ─────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadSettings(), loadMedications()]);
  bindEvents();
}

// ─── API helpers ──────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  return res.json();
}

// ─── Data loaders ─────────────────────────────────────────────
async function loadSettings() {
  settings = await api('GET', '/api/settings');
  updateAgeDosageTag();
}

async function loadMedications() {
  medications = await api('GET', '/api/medications');
  renderList();
}

// ─── Render ───────────────────────────────────────────────────
function renderList() {
  const activeMeds = medications.filter(m => m.active);
  const inactiveMeds = medications.filter(m => !m.active);

  // Age banner
  const ageBanner = document.getElementById('age-banner');
  if (!ageDismissed && settings.userAge === null) {
    ageBanner.hidden = false;
  } else {
    ageBanner.hidden = true;
  }

  // Active section
  const activeSection = document.getElementById('active-section');
  const divider = document.getElementById('section-divider');
  activeSection.hidden = activeMeds.length === 0;
  divider.hidden = activeMeds.length === 0;
  document.getElementById('active-count').textContent = activeMeds.length;
  document.getElementById('active-list').innerHTML = activeMeds.map(medCard).join('');

  // All section (inactive)
  document.getElementById('all-count').textContent = medications.length;
  const allList = document.getElementById('all-list');
  const emptyState = document.getElementById('empty-state');
  if (medications.length === 0) {
    allList.innerHTML = '';
    allList.appendChild(emptyState);
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    allList.innerHTML = inactiveMeds.map(medCard).join('');
  }

  bindCardEvents();
}

function medCard(med) {
  const thumb = med.imageFile
    ? `<img class="med-thumb" src="/images/${med.imageFile}" alt="${escHtml(med.name)}" />`
    : `<div class="med-thumb-placeholder">💊</div>`;

  const meta = [med.dosage, med.frequency].filter(Boolean).join(' · ');

  return `
  <div class="med-card ${med.active ? 'active' : ''}" data-id="${med.id}">
    <div class="med-card-main">
      <div class="med-checkbox-wrap">
        <input type="checkbox" class="med-checkbox" data-id="${med.id}" ${med.active ? 'checked' : ''} title="${med.active ? 'Currently taking' : 'Mark as currently taking'}" />
      </div>
      ${thumb}
      <div class="med-info">
        <div class="med-name">${escHtml(med.name)}</div>
        ${meta ? `<div class="med-meta">${escHtml(meta)}</div>` : ''}
        ${med.active ? '<span class="med-active-badge">Currently Taking</span>' : ''}
      </div>
      <div class="med-actions">
        <button class="med-btn med-view-btn" data-id="${med.id}">View</button>
        <button class="med-btn med-edit-btn" data-id="${med.id}">Edit</button>
        <button class="med-btn med-btn-danger med-delete-btn" data-id="${med.id}">Delete</button>
      </div>
    </div>
  </div>`;
}

function bindCardEvents() {
  document.querySelectorAll('.med-checkbox').forEach(cb => {
    cb.addEventListener('change', () => handleToggle(cb.dataset.id));
  });
  document.querySelectorAll('.med-view-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openViewModal(btn.dataset.id); });
  });
  document.querySelectorAll('.med-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(btn.dataset.id); });
  });
  document.querySelectorAll('.med-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); deleteMed(btn.dataset.id); });
  });
}

// ─── Toggle (active/inactive) ──────────────────────────────────
async function handleToggle(id) {
  const result = await api('POST', `/api/medications/${id}/toggle`, {});
  if (result.requiresConfirmation) {
    pendingToggleId = id;
    const med = medications.find(m => m.id === id);
    document.getElementById('interaction-med-name').textContent =
      `Starting: ${med ? med.name : 'this medication'}`;
    document.getElementById('interaction-warning-text').textContent = result.warning;
    document.getElementById('interaction-modal').hidden = false;
    // Revert checkbox visually until confirmed
    const cb = document.querySelector(`.med-checkbox[data-id="${id}"]`);
    if (cb) cb.checked = !cb.checked;
    return;
  }
  await loadMedications();
}

async function confirmInteraction() {
  if (!pendingToggleId) return;
  await api('POST', `/api/medications/${pendingToggleId}/toggle`, { confirmed: true });
  pendingToggleId = null;
  document.getElementById('interaction-modal').hidden = true;
  await loadMedications();
}

// ─── Add / Edit modal ──────────────────────────────────────────
function openAddModal() {
  editingId = null;
  currentImageFile = null;
  existingImageFile = null;
  resetModal();
  document.getElementById('modal-title').textContent = 'Add Medication';
  document.getElementById('med-modal').hidden = false;
}

function openEditModal(id) {
  const med = medications.find(m => m.id === id);
  if (!med) return;
  editingId = id;
  currentImageFile = null;
  existingImageFile = med.imageFile || null;
  resetModal();
  document.getElementById('modal-title').textContent = 'Edit Medication';
  document.getElementById('field-name').value = med.name || '';
  document.getElementById('field-dosage').value = med.dosage || '';
  document.getElementById('field-frequency').value = med.frequency || '';
  document.getElementById('field-age-dosage').value = med.ageDosageNote || '';
  document.getElementById('field-usage').value = med.usage || '';
  document.getElementById('field-warnings').value = med.warnings || '';
  document.getElementById('field-interactions').value = med.interactions || '';

  // Show existing image
  if (med.imageFile) {
    showImagePreview(`/images/${med.imageFile}`);
  }

  document.getElementById('med-modal').hidden = false;
}

function resetModal() {
  document.getElementById('image-input').value = '';
  document.getElementById('field-name').value = '';
  document.getElementById('field-dosage').value = '';
  document.getElementById('field-frequency').value = '';
  document.getElementById('field-age-dosage').value = '';
  document.getElementById('field-usage').value = '';
  document.getElementById('field-warnings').value = '';
  document.getElementById('field-interactions').value = '';
  document.getElementById('parse-error').hidden = true;
  document.getElementById('parse-loading').hidden = true;
  document.getElementById('upload-placeholder').hidden = false;
  document.getElementById('upload-preview').hidden = true;
  document.getElementById('preview-img').src = '';
}

function closeModal() {
  document.getElementById('med-modal').hidden = true;
}

async function saveMed() {
  const name = document.getElementById('field-name').value.trim();
  if (!name) {
    document.getElementById('field-name').focus();
    return;
  }

  const payload = {
    name,
    dosage: document.getElementById('field-dosage').value.trim(),
    frequency: document.getElementById('field-frequency').value.trim(),
    ageDosageNote: document.getElementById('field-age-dosage').value.trim(),
    usage: document.getElementById('field-usage').value.trim(),
    warnings: document.getElementById('field-warnings').value.trim(),
    interactions: document.getElementById('field-interactions').value.trim(),
    imageFile: existingImageFile || undefined,
  };

  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    if (editingId) {
      await api('PUT', `/api/medications/${editingId}`, payload);
    } else {
      await api('POST', '/api/medications', payload);
    }
    closeModal();
    await loadMedications();
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Medication';
  }
}

// ─── Delete ───────────────────────────────────────────────────
async function deleteMed(id) {
  const med = medications.find(m => m.id === id);
  if (!confirm(`Delete ${med ? med.name : 'this medication'}?`)) return;
  await api('DELETE', `/api/medications/${id}`);
  await loadMedications();
}

// ─── Image upload & parse ─────────────────────────────────────
function showImagePreview(src) {
  document.getElementById('upload-placeholder').hidden = true;
  document.getElementById('parse-loading').hidden = true;
  document.getElementById('upload-preview').hidden = false;
  document.getElementById('preview-img').src = src;
}

async function parseImage(file) {
  document.getElementById('upload-placeholder').hidden = true;
  document.getElementById('upload-preview').hidden = true;
  document.getElementById('parse-loading').hidden = false;
  document.getElementById('parse-error').hidden = true;

  const formData = new FormData();
  formData.append('image', file);

  const result = await api('POST', '/api/parse-image', formData);

  document.getElementById('parse-loading').hidden = true;

  if (result.error) {
    document.getElementById('parse-error').textContent = result.error;
    document.getElementById('parse-error').hidden = false;
  } else {
    // Populate fields with extracted data (only if currently empty)
    const fillIfEmpty = (id, val) => {
      const el = document.getElementById(id);
      if (!el.value.trim() && val) el.value = val;
    };
    // Always fill from parse (user can edit after)
    if (result.name) document.getElementById('field-name').value = result.name;
    fillIfEmpty('field-dosage', result.dosage);
    fillIfEmpty('field-frequency', result.frequency);
    document.getElementById('field-age-dosage').value = result.ageDosageNote || '';
    document.getElementById('field-usage').value = result.usage || '';
    document.getElementById('field-warnings').value = result.warnings || '';
    document.getElementById('field-interactions').value = result.interactions || '';
  }

  // Save the server-side filename for reference
  if (result.imageFile) existingImageFile = result.imageFile;

  // Show preview (use object URL for new file)
  showImagePreview(URL.createObjectURL(file));
}

// ─── View modal ───────────────────────────────────────────────
function openViewModal(id) {
  const med = medications.find(m => m.id === id);
  if (!med) return;

  document.getElementById('view-med-name').textContent = med.name;
  document.getElementById('view-dosage').textContent =
    [med.dosage, med.frequency].filter(Boolean).join(' · ');

  // Image column
  const imgCol = document.getElementById('view-image-col');
  if (med.imageFile) {
    document.getElementById('view-image').src = `/images/${med.imageFile}`;
    imgCol.hidden = false;
  } else {
    imgCol.hidden = true;
  }

  // Info sections
  const show = (sectionId, paragraphId, text) => {
    const section = document.getElementById(sectionId);
    const para = document.getElementById(paragraphId);
    if (text) {
      para.textContent = text;
      section.hidden = false;
    } else {
      section.hidden = true;
    }
  };

  show('vs-age-dosage', 'view-age-dosage', med.ageDosageNote);
  show('vs-usage', 'view-usage', med.usage);
  show('vs-warnings', 'view-warnings', med.warnings);
  show('vs-interactions', 'view-interactions', med.interactions);

  const hasAnyInfo = med.ageDosageNote || med.usage || med.warnings || med.interactions;
  document.getElementById('view-empty').hidden = !!hasAnyInfo;

  // Store id for edit button
  document.getElementById('view-edit-btn').dataset.id = id;
  document.getElementById('view-modal').hidden = false;
}

// ─── Settings modal ───────────────────────────────────────────
function openSettingsModal() {
  document.getElementById('settings-age').value = settings.userAge !== null ? settings.userAge : '';
  document.getElementById('settings-modal').hidden = false;
}

async function saveSettings() {
  const ageVal = document.getElementById('settings-age').value.trim();
  const userAge = ageVal === '' ? null : parseInt(ageVal, 10);
  settings = await api('PUT', '/api/settings', { userAge });
  updateAgeDosageTag();
  document.getElementById('settings-modal').hidden = true;
  renderList(); // update banner
}

function updateAgeDosageTag() {
  const tag = document.getElementById('age-dosage-tag');
  if (tag) {
    tag.textContent = settings.userAge !== null ? `Age ${settings.userAge}` : '';
  }
}

// ─── Utilities ────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Event bindings ───────────────────────────────────────────
function bindEvents() {
  // Header buttons
  document.getElementById('add-med-btn').addEventListener('click', openAddModal);
  document.getElementById('settings-btn').addEventListener('click', openSettingsModal);

  // Age banner dismiss
  document.getElementById('age-banner-dismiss').addEventListener('click', () => {
    ageDismissed = true;
    document.getElementById('age-banner').hidden = true;
  });

  // Add/edit modal
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-save-btn').addEventListener('click', saveMed);

  // Image upload area click
  const uploadArea = document.getElementById('image-upload-area');
  uploadArea.addEventListener('click', () => {
    if (document.getElementById('upload-preview').hidden) {
      document.getElementById('image-input').click();
    }
  });

  // Drag & drop
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--blue)'; });
  uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      currentImageFile = file;
      parseImage(file);
    }
  });

  document.getElementById('image-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      currentImageFile = file;
      parseImage(file);
    }
  });

  document.getElementById('reparse-btn').addEventListener('click', e => {
    e.stopPropagation();
    if (currentImageFile) parseImage(currentImageFile);
  });

  document.getElementById('remove-image-btn').addEventListener('click', e => {
    e.stopPropagation();
    currentImageFile = null;
    existingImageFile = null;
    document.getElementById('image-input').value = '';
    document.getElementById('upload-preview').hidden = true;
    document.getElementById('upload-placeholder').hidden = false;
  });

  // Interaction modal
  document.getElementById('interaction-cancel-btn').addEventListener('click', () => {
    pendingToggleId = null;
    document.getElementById('interaction-modal').hidden = true;
  });
  document.getElementById('interaction-confirm-btn').addEventListener('click', confirmInteraction);

  // View modal
  document.getElementById('view-close-btn').addEventListener('click', () => {
    document.getElementById('view-modal').hidden = true;
  });
  document.getElementById('view-close-footer-btn').addEventListener('click', () => {
    document.getElementById('view-modal').hidden = true;
  });
  document.getElementById('view-edit-btn').addEventListener('click', () => {
    const id = document.getElementById('view-edit-btn').dataset.id;
    document.getElementById('view-modal').hidden = true;
    openEditModal(id);
  });

  // Settings modal
  document.getElementById('settings-close-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').hidden = true;
  });
  document.getElementById('settings-cancel-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').hidden = true;
  });
  document.getElementById('settings-save-btn').addEventListener('click', saveSettings);

  // Close modals on overlay click
  ['med-modal', 'settings-modal', 'view-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.hidden = true;
    });
  });
}

// ─── Boot ─────────────────────────────────────────────────────
init();
