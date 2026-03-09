/* ============================================================
   Visual Todo Lists — App Logic
   ============================================================ */

// ============================================================
// STATE & PERSISTENCE
// ============================================================

let state = {
  lists: [],
  currentListId: null,
};

function saveState() {
  try {
    localStorage.setItem('visualTodoLists_v1', JSON.stringify(state));
  } catch (e) {
    // localStorage full or unavailable — silently ignore
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('visualTodoLists_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lists)) {
        state = parsed;
      }
    }
  } catch (e) {
    state = { lists: [], currentListId: null };
  }
}

// ============================================================
// UTILITIES
// ============================================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Simple numeric hash for consistent image seeds */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h) % 10000;
}

/** Stop-words to skip when building image search keywords */
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','up','about','into','is','are','was','were','be','been',
  'have','has','had','do','does','did','will','would','shall','should',
  'may','might','must','can','could','my','your','his','her','its','their',
  'this','that','i','you','he','she','it','we','they','get','go','make',
  'take','some','any','all','more','no','not','so','very','just','now',
  'also','need','want','buy','pick','call','send','check','look','find',
  'new','old','big','small','good','bad','one','two','three','also','then',
  'than','over','after','before','again','few','own','too','out','off',
  'put','set','run','try','let','ask','tell','give','keep','start','stop',
  'use','help','add','see','show','plan','done','todo','task','item','list',
  'today','tomorrow','week','month','next','last','soon',
]);

/** Extract 1–2 meaningful keywords from todo text for image search */
function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (words.length > 0) return words.slice(0, 2).join(',');

  // Fallback: take any word longer than 2 chars ignoring stop words only
  const fallback = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  return fallback.slice(0, 1).join(',') || 'task';
}

/** Build a loremflickr URL that always returns the same image for the same item */
function getImageUrl(item) {
  const kw = item.imageKeywords || 'task';
  const seed = item.imageSeed || 1;
  return `https://loremflickr.com/128/128/${encodeURIComponent(kw)}?lock=${seed}`;
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// ============================================================
// LIST OPERATIONS
// ============================================================

function createList(name) {
  const list = {
    id: generateId(),
    name: name || 'New List',
    createdAt: Date.now(),
    items: [],
  };
  state.lists.unshift(list);
  state.currentListId = list.id;
  saveState();
  return list;
}

function deleteList(listId) {
  state.lists = state.lists.filter(l => l.id !== listId);
  if (state.currentListId === listId) {
    state.currentListId = state.lists[0]?.id || null;
  }
  saveState();
}

function renameList(listId, name) {
  const list = state.lists.find(l => l.id === listId);
  if (list) { list.name = name; saveState(); }
}

function getCurrentList() {
  return state.lists.find(l => l.id === state.currentListId) || null;
}

// ============================================================
// TODO OPERATIONS
// ============================================================

function addTodoItem(text) {
  const list = getCurrentList();
  if (!list || !text.trim()) return null;

  const trimmed = text.trim();
  const item = {
    id: generateId(),
    text: trimmed,
    done: false,
    imageKeywords: extractKeywords(trimmed),
    imageSeed: hashString(trimmed + generateId()),
    createdAt: Date.now(),
  };
  list.items.push(item);
  saveState();
  return item;
}

function toggleTodoItem(listId, itemId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (item) { item.done = !item.done; saveState(); }
}

function deleteTodoItem(listId, itemId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return;
  list.items = list.items.filter(i => i.id !== itemId);
  saveState();
}

// ============================================================
// DOM REFERENCES
// ============================================================

const sidebarListsEl  = document.getElementById('sidebar-lists');
const mainEmptyEl     = document.getElementById('main-empty');
const listViewEl      = document.getElementById('list-view');
const listTitleInput  = document.getElementById('list-title-input');
const listMetaEl      = document.getElementById('list-meta');
const progressFillEl  = document.getElementById('progress-bar-fill');
const todosContainerEl= document.getElementById('todos-container');
const addTodoInputEl  = document.getElementById('add-todo-input');

// ============================================================
// RENDER
// ============================================================

function render() {
  renderSidebar();
  renderMain();
}

/* ---- Sidebar ---- */
function renderSidebar() {
  sidebarListsEl.innerHTML = '';

  if (state.lists.length === 0) {
    sidebarListsEl.innerHTML = '<div class="sidebar-empty">No lists yet</div>';
    return;
  }

  for (const list of state.lists) {
    const doneCount  = list.items.filter(i => i.done).length;
    const totalCount = list.items.length;
    const isActive   = list.id === state.currentListId;

    const item = document.createElement('div');
    item.className = 'sidebar-list-item' + (isActive ? ' active' : '');
    item.dataset.listId = list.id;

    item.innerHTML = `
      <div class="sidebar-list-icon">📋</div>
      <div class="sidebar-list-info">
        <div class="sidebar-list-name">${escapeHtml(list.name)}</div>
        <div class="sidebar-list-count">
          ${totalCount === 0
            ? 'No items'
            : `${totalCount} item${totalCount !== 1 ? 's' : ''} · ${doneCount} done`}
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      state.currentListId = list.id;
      saveState();
      render();
      addTodoInputEl.focus();
    });

    sidebarListsEl.appendChild(item);
  }
}

/* ---- Main area ---- */
function renderMain() {
  const list = getCurrentList();

  if (!list) {
    mainEmptyEl.hidden = false;
    listViewEl.hidden  = true;
    return;
  }

  mainEmptyEl.hidden = false;
  mainEmptyEl.style.display = 'none';
  listViewEl.hidden  = false;

  // Title
  if (document.activeElement !== listTitleInput) {
    listTitleInput.value = list.name;
  }

  // Meta + progress
  const total = list.items.length;
  const done  = list.items.filter(i => i.done).length;
  if (total === 0) {
    listMetaEl.textContent    = 'No items yet — add one below';
    progressFillEl.style.width = '0%';
  } else {
    const pct = Math.round((done / total) * 100);
    listMetaEl.textContent     = `${done} of ${total} completed · ${pct}%`;
    progressFillEl.style.width = `${pct}%`;
  }

  renderTodos(list);
}

/* ---- Todo list ---- */
function renderTodos(list) {
  // Keep track of existing item elements by id to avoid full re-render flicker
  const existingEls = {};
  todosContainerEl.querySelectorAll('.todo-item[data-item-id]').forEach(el => {
    existingEls[el.dataset.itemId] = el;
  });

  // Sort: pending first, done last (stable within each group by creation time)
  const sorted = [
    ...list.items.filter(i => !i.done).sort((a, b) => a.createdAt - b.createdAt),
    ...list.items.filter(i =>  i.done).sort((a, b) => a.createdAt - b.createdAt),
  ];

  if (sorted.length === 0) {
    todosContainerEl.innerHTML = '<div class="todos-empty">No todos yet — add one below!</div>';
    return;
  }

  // Build fragment
  const frag = document.createDocumentFragment();
  const newIds = new Set();

  for (const item of sorted) {
    newIds.add(item.id);

    let el = existingEls[item.id];
    if (!el) {
      // Brand-new item: create it
      el = buildTodoElement(list.id, item);
    } else {
      // Existing: sync done state without rebuilding
      syncTodoElement(el, item);
    }

    frag.appendChild(el);
  }

  todosContainerEl.innerHTML = '';
  todosContainerEl.appendChild(frag);
}

/* Build a todo element from scratch */
function buildTodoElement(listId, item) {
  const el = document.createElement('div');
  el.className = 'todo-item' + (item.done ? ' done' : '');
  el.dataset.itemId = item.id;

  const imgUrl = getImageUrl(item);

  el.innerHTML = `
    <label class="todo-checkbox-label" title="${item.done ? 'Mark as incomplete' : 'Mark as done'}">
      <input type="checkbox" class="todo-checkbox" ${item.done ? 'checked' : ''} />
      <span class="todo-checkmark"></span>
    </label>
    <div class="todo-image-wrap">
      <img class="todo-image" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" decoding="async" />
      <div class="todo-image-skeleton"></div>
    </div>
    <span class="todo-text">${escapeHtml(item.text)}</span>
    <button class="todo-delete-btn" title="Remove this item">✕</button>
  `;

  // Image load handling
  const img      = el.querySelector('.todo-image');
  const skeleton = el.querySelector('.todo-image-skeleton');

  img.addEventListener('load', () => {
    img.classList.add('loaded');
    skeleton.style.display = 'none';
  });

  img.addEventListener('error', () => {
    img.style.display = 'none';
    skeleton.innerHTML = '🖼';
    skeleton.classList.add('image-error');
    skeleton.title = 'Image unavailable';
  });

  // Checkbox toggle
  const checkbox = el.querySelector('.todo-checkbox');
  checkbox.addEventListener('change', () => {
    toggleTodoItem(listId, item.id);
    render();
  });

  // Delete
  const deleteBtn = el.querySelector('.todo-delete-btn');
  deleteBtn.addEventListener('click', () => {
    el.classList.add('removing');
    setTimeout(() => {
      deleteTodoItem(listId, item.id);
      render();
    }, 200);
  });

  return el;
}

/** Sync done/undone state on an already-rendered element */
function syncTodoElement(el, item) {
  if (item.done) {
    el.classList.add('done');
  } else {
    el.classList.remove('done');
  }
  const cb = el.querySelector('.todo-checkbox');
  if (cb) cb.checked = item.done;
  const label = el.querySelector('.todo-checkbox-label');
  if (label) label.title = item.done ? 'Mark as incomplete' : 'Mark as done';
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/* New list button */
document.getElementById('new-list-btn').addEventListener('click', () => {
  createList();
  render();
  setTimeout(() => {
    listTitleInput.select();
  }, 30);
});

/* "Create first list" CTA */
document.getElementById('create-first-btn').addEventListener('click', () => {
  createList();
  render();
  setTimeout(() => listTitleInput.select(), 30);
});

/* Rename list while typing */
listTitleInput.addEventListener('input', () => {
  const list = getCurrentList();
  if (!list) return;
  renameList(list.id, listTitleInput.value);
  renderSidebar(); // only update sidebar name, not todos
});

listTitleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodoInputEl.focus();
});

/* Delete current list */
document.getElementById('delete-list-btn').addEventListener('click', () => {
  const list = getCurrentList();
  if (!list) return;
  const msg = list.items.length > 0
    ? `Delete "${list.name}" and all ${list.items.length} item${list.items.length !== 1 ? 's' : ''}?`
    : `Delete "${list.name}"?`;
  if (!confirm(msg)) return;
  deleteList(list.id);
  render();
});

/* Add todo on Enter or button click */
function handleAddTodo() {
  const text = addTodoInputEl.value.trim();
  if (!text) return;
  addTodoInputEl.value = '';

  addTodoItem(text);
  render();

  // Scroll new item into view
  requestAnimationFrame(() => {
    const items = todosContainerEl.querySelectorAll('.todo-item:not(.done)');
    const last  = items[items.length - 1];
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

addTodoInputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleAddTodo();
});

document.getElementById('add-todo-btn').addEventListener('click', handleAddTodo);

// ============================================================
// INIT
// ============================================================

loadState();
render();

// Focus the add input if a list is already selected
if (getCurrentList()) {
  addTodoInputEl.focus();
}
