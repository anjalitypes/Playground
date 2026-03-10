/* ============================================================
   Visual Todo Lists — App Logic
   ============================================================ */

// ============================================================
// EMOJI MATCHING
// ============================================================

const EMOJI_MAP = [
  // Food & drink
  ['milk','dairy'],             '🥛',
  ['coffee','espresso','latte','cappuccino'], '☕',
  ['tea','matcha'],             '🍵',
  ['water','hydrat'],           '💧',
  ['juice','smoothie'],         '🥤',
  ['beer','brew'],              '🍺',
  ['wine','champagne'],         '🍷',
  ['pizza'],                    '🍕',
  ['burger','hamburger'],       '🍔',
  ['sandwich','sub'],           '🥪',
  ['salad','greens'],           '🥗',
  ['soup','stew','broth'],      '🍲',
  ['pasta','noodle','spaghetti','ramen','pho'], '🍝',
  ['rice','grain'],             '🍚',
  ['bread','toast','bagel','muffin'], '🍞',
  ['cake','cupcake'],           '🎂',
  ['cookie','biscuit'],         '🍪',
  ['chocolate'],                '🍫',
  ['apple'],                    '🍎',
  ['banana'],                   '🍌',
  ['orange','mandarin','clementine'], '🍊',
  ['grape','raisin'],           '🍇',
  ['strawberry','berry'],       '🍓',
  ['lemon','lime'],             '🍋',
  ['avocado'],                  '🥑',
  ['tomato'],                   '🍅',
  ['carrot'],                   '🥕',
  ['broccoli','spinach','kale','vegetable','veggie'], '🥦',
  ['egg','omelet','omelette'],  '🥚',
  ['cheese'],                   '🧀',
  ['butter','margarine'],       '🧈',
  ['meat','steak','beef','pork','lamb'], '🥩',
  ['chicken','turkey','poultry'], '🍗',
  ['fish','salmon','tuna','cod'], '🐟',
  ['shrimp','prawn','seafood'], '🦐',
  ['sushi'],                    '🍣',
  ['taco'],                     '🌮',
  ['burrito','wrap'],           '🌯',
  ['hotdog','sausage'],         '🌭',
  ['cereal','oat','oatmeal'],   '🥣',
  ['waffle','pancake'],         '🧇',
  ['bacon'],                    '🥓',
  ['popcorn'],                  '🍿',
  ['candy','sweets','sugar'],   '🍬',
  ['icecream','ice cream'],     '🍦',
  ['donut','doughnut'],         '🍩',
  ['pretzel'],                  '🥨',
  ['croissant','pastry'],       '🥐',
  ['mushroom'],                 '🍄',
  ['pepper','spice'],           '🌶️',
  ['corn'],                     '🌽',
  ['potato','fry','fries'],     '🥔',
  ['onion','garlic'],           '🧅',
  ['grocery','groceries','supermarket','food shopping'], '🛒',

  // Health & body
  ['dentist','dental','teeth','tooth'], '🦷',
  ['doctor','physician','clinic'], '🏥',
  ['hospital','er','emergency'], '🏥',
  ['medicine','medication','prescription','pill','tablet','vitamin','supplement'], '💊',
  ['therapist','therapy','counseling','mental health'], '🧠',
  ['optometrist','eye','glasses','vision'], '👁️',
  ['haircut','barber','hair','salon'], '💇',
  ['massage','spa'],            '💆',
  ['manicure','nail','pedicure'], '💅',
  ['gym','workout','exercise','training','lift','weights','crossfit'], '🏋️',
  ['run','running','jog','jogging','marathon'], '🏃',
  ['yoga','meditat','pilates'], '🧘',
  ['swim','swimming','pool'],   '🏊',
  ['cycle','cycling','spin'],   '🚴',
  ['hike','hiking','trail'],    '🥾',
  ['sleep','nap','rest','bed'],  '😴',
  ['stretch','flexibility'],    '🤸',

  // Home & chores
  ['clean','cleaning','tidy','tidying','dust','dusting'], '🧹',
  ['laundry','wash clothes','dryer','washer'], '🧺',
  ['dishes','dishwasher'],      '🍽️',
  ['vacuum','hoover','sweep'],  '🫧',
  ['mop','floor','scrub'],      '🧽',
  ['cook','cooking','bake','baking','recipe'], '🍳',
  ['garbage','trash','bin','rubbish'], '🗑️',
  ['recycle'],                  '♻️',
  ['plant','garden','water plant','flower'], '🌱',
  ['mow','lawn','grass'],       '🌿',
  ['repair','fix','broken','replace'],  '🔧',
  ['paint','painting','wall'],  '🎨',
  ['furniture','sofa','couch','table','chair'], '🪑',
  ['bathroom','shower','toilet'], '🚿',
  ['bedroom','bed'],            '🛏️',
  ['organize','declutter','sort'], '📦',
  ['ikea','assemble'],          '🔨',

  // Work & productivity
  ['email','inbox','reply','message'], '📧',
  ['meeting','standup','sync','zoom','call'], '📅',
  ['presentation','slides','deck','powerpoint'], '📊',
  ['report','analysis'],        '📈',
  ['code','coding','programming','develop','debug','deploy'], '💻',
  ['deadline','due','submit'],  '⏰',
  ['project','sprint','milestone'], '📋',
  ['research','study','learn'],  '🔍',
  ['write','writing','draft','blog','article','essay'], '✍️',
  ['read','reading','book','novel','article'], '📚',
  ['notes','note'],             '📝',
  ['plan','planning','strategy'], '🗓️',
  ['review','feedback','approve'], '✅',
  ['interview','hire','candidate'], '🤝',
  ['client','customer','stakeholder'], '👔',
  ['invoice','bill send','receipt'], '🧾',
  ['contract','sign','agreement'], '📄',
  ['backup','save','archive'],  '💾',
  ['print','scan','copy'],      '🖨️',

  // Shopping & errands
  ['shopping','shop','mall','store','buy'], '🛍️',
  ['amazon','order online','delivery'], '📦',
  ['pharmacy','chemist','drug store'], '💊',
  ['hardware','home depot','lowes'], '🔩',
  ['return','exchange','refund'], '↩️',
  ['pickup','pick up','collect'], '📥',
  ['post','mail','package','ship','courier'], '📮',

  // Finance & admin
  ['bank','atm','cash'],        '🏦',
  ['money','pay','payment','transfer','send money'], '💰',
  ['credit card','card payment'], '💳',
  ['bill','utilities','electric','gas bill','water bill'], '🧾',
  ['tax','taxes','irs','return'],  '🧮',
  ['rent','mortgage','landlord'], '🏠',
  ['insurance','policy','claim'], '📋',
  ['invest','stock','crypto','savings'], '📈',
  ['budget','expense','spending'], '💵',
  ['loan','debt','repay'],      '💸',
  ['will','legal','notary','lawyer','attorney'], '⚖️',
  ['passport','visa','id','license'], '🪪',
  ['registration','dmv','vehicle'], '🚗',

  // Transport & travel
  ['car','drive','driving','vehicle'], '🚗',
  ['gas','petrol','fuel','refuel'], '⛽',
  ['service','mechanic','oil change'], '🔧',
  ['bus','transit','subway','metro'], '🚌',
  ['train','railroad'],         '🚂',
  ['flight','airplane','airport','fly'], '✈️',
  ['uber','lyft','taxi','cab'], '🚕',
  ['bike','bicycle'],           '🚲',
  ['walk','stroll'],            '🚶',
  ['parking','park car'],       '🅿️',
  ['hotel','motel','airbnb','accommodation'], '🏨',
  ['vacation','holiday','trip','travel'], '🏖️',
  ['pack','packing','suitcase'], '🧳',

  // Social & relationships
  ['birthday','bday'],          '🎂',
  ['party','celebration','event'], '🎉',
  ['wedding','anniversary'],    '💍',
  ['gift','present','wrap'],    '🎁',
  ['dinner','restaurant','eat out'], '🍽️',
  ['lunch','brunch'],           '🥗',
  ['breakfast'],                '🍳',
  ['date','romantic'],          '❤️',
  ['friend','friends'],         '👫',
  ['family','parents','kids','children'], '👨‍👩‍👧',
  ['baby','infant','newborn'],  '👶',
  ['pet','animal'],             '🐾',
  ['dog','puppy','pup'],        '🐕',
  ['cat','kitten'],             '🐈',
  ['vet','veterinarian'],       '🏥',

  // Education & learning
  ['homework','assignment','essay'], '📝',
  ['exam','test','quiz'],       '✏️',
  ['school','college','university'], '🏫',
  ['class','lecture','course','lesson'], '📖',
  ['tutor','mentor'],           '👨‍🏫',
  ['library','librarian'],      '📚',
  ['degree','graduation','diploma'], '🎓',

  // Entertainment & leisure
  ['movie','film','cinema','netflix','watch'], '🎬',
  ['show','tv','series','episode'], '📺',
  ['music','playlist','song','concert','gig'], '🎵',
  ['game','gaming','video game','play'], '🎮',
  ['podcast','listen'],         '🎧',
  ['art','draw','paint','sketch','illustrat'], '🎨',
  ['photo','photograph','camera','selfie'], '📸',
  ['dance','dancing'],          '💃',
  ['sport','sports'],           '⚽',
  ['football','soccer'],        '⚽',
  ['basketball'],               '🏀',
  ['tennis'],                   '🎾',
  ['golf'],                     '⛳',
  ['climb','climbing','boulder'], '🧗',

  // Utilities & tech
  ['phone','mobile','smartphone'], '📱',
  ['laptop','computer','pc'],   '💻',
  ['internet','wifi','router'], '📶',
  ['charger','charge','battery'], '🔋',
  ['password','login','account'], '🔐',
  ['update','upgrade','install'], '⬆️',
  ['backup'],                   '💾',
  ['printer','print'],          '🖨️',

  // Nature & weather
  ['sun','sunny','sunshine'],   '☀️',
  ['rain','umbrella','wet'],    '🌧️',
  ['snow','winter','cold'],     '❄️',
  ['storm','thunder','lightning'], '⛈️',
  ['wind','breeze'],            '🌬️',
];

/**
 * Returns the best emoji for a given todo text.
 * Checks each keyword list entry against the lowercased text.
 */
function getEmoji(text) {
  const lower = text.toLowerCase();

  for (let i = 0; i < EMOJI_MAP.length; i += 2) {
    const keys   = EMOJI_MAP[i];     // string or array
    const emoji  = EMOJI_MAP[i + 1]; // string
    const list   = Array.isArray(keys) ? keys : [keys];

    for (const key of list) {
      if (lower.includes(key)) return emoji;
    }
  }

  return '📝'; // default
}

// ============================================================
// STATE & PERSISTENCE
// ============================================================

let state = {
  lists: [],
  currentListId: null,
};

function saveState() {
  try {
    localStorage.setItem('visualTodoLists_v2', JSON.stringify(state));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('visualTodoLists_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.lists)) state = parsed;
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

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// ============================================================
// LIST OPERATIONS
// ============================================================

function createList(name) {
  const list = { id: generateId(), name: name || 'New List', createdAt: Date.now(), items: [] };
  state.lists.unshift(list);
  state.currentListId = list.id;
  saveState();
  return list;
}

function deleteList(listId) {
  state.lists = state.lists.filter(l => l.id !== listId);
  if (state.currentListId === listId) state.currentListId = state.lists[0]?.id || null;
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
    emoji: getEmoji(trimmed),
    createdAt: Date.now(),
  };
  list.items.push(item);
  saveState();
  return item;
}

function toggleTodoItem(listId, itemId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return false;
  const item = list.items.find(i => i.id === itemId);
  if (!item) return false;
  item.done = !item.done;
  saveState();
  // Return true if this toggle completed the whole list
  return item.done && list.items.length > 0 && list.items.every(i => i.done);
}

function deleteTodoItem(listId, itemId) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return;
  list.items = list.items.filter(i => i.id !== itemId);
  saveState();
}

// ============================================================
// SUCCESS ANIMATION
// ============================================================

const PARTY_EMOJIS = ['🎉','🎊','✨','⭐','🌟','💫','🥳','🎈','🎆','🎇'];
const CONFETTI_COLORS = ['#6366f1','#a78bfa','#4ade80','#fbbf24','#f472b6','#38bdf8','#fb923c'];

function showSuccessAnimation() {
  // Remove any existing one
  document.querySelectorAll('.success-overlay').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'success-overlay';
  overlay.innerHTML = `
    <div class="success-badge">
      <div class="success-icon">🥳</div>
      <div class="success-title">All done!</div>
      <div class="success-sub">List complete!</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Spawn confetti particles
  for (let i = 0; i < 60; i++) {
    spawnConfetti(overlay);
  }

  // Auto-remove
  setTimeout(() => {
    overlay.classList.add('success-fade-out');
    setTimeout(() => overlay.remove(), 600);
  }, 2800);

  // Click to dismiss
  overlay.addEventListener('click', () => {
    overlay.classList.add('success-fade-out');
    setTimeout(() => overlay.remove(), 600);
  });
}

function spawnConfetti(container) {
  const el = document.createElement('div');
  const isEmoji = Math.random() < 0.4;

  if (isEmoji) {
    el.className = 'confetti-emoji';
    el.textContent = PARTY_EMOJIS[Math.floor(Math.random() * PARTY_EMOJIS.length)];
  } else {
    el.className = 'confetti-piece';
    el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    el.style.width  = (6 + Math.random() * 8) + 'px';
    el.style.height = (6 + Math.random() * 8) + 'px';
  }

  const startX = 10 + Math.random() * 80; // % from left
  const endX   = startX + (Math.random() - 0.5) * 30;
  const delay  = Math.random() * 0.6;
  const dur    = 1.2 + Math.random() * 1.2;

  el.style.left            = startX + '%';
  el.style.animationDelay    = delay + 's';
  el.style.animationDuration = dur + 's';
  el.style.setProperty('--end-x', (endX - startX) + 'vw');

  container.appendChild(el);
}

// ============================================================
// DOM REFERENCES
// ============================================================

const sidebarListsEl   = document.getElementById('sidebar-lists');
const mainEmptyEl      = document.getElementById('main-empty');
const listViewEl       = document.getElementById('list-view');
const listTitleInput   = document.getElementById('list-title-input');
const listMetaEl       = document.getElementById('list-meta');
const progressFillEl   = document.getElementById('progress-bar-fill');
const todosContainerEl = document.getElementById('todos-container');
const addTodoInputEl   = document.getElementById('add-todo-input');

// ============================================================
// RENDER
// ============================================================

function render() {
  renderSidebar();
  renderMain();
}

function renderSidebar() {
  sidebarListsEl.innerHTML = '';
  if (state.lists.length === 0) {
    sidebarListsEl.innerHTML = '<div class="sidebar-empty">No lists yet</div>';
    return;
  }
  for (const list of state.lists) {
    const done  = list.items.filter(i => i.done).length;
    const total = list.items.length;
    const el    = document.createElement('div');
    el.className = 'sidebar-list-item' + (list.id === state.currentListId ? ' active' : '');
    el.dataset.listId = list.id;
    el.innerHTML = `
      <div class="sidebar-list-icon">📋</div>
      <div class="sidebar-list-info">
        <div class="sidebar-list-name">${escapeHtml(list.name)}</div>
        <div class="sidebar-list-count">
          ${total === 0 ? 'No items' : `${total} item${total !== 1 ? 's' : ''} · ${done} done`}
        </div>
      </div>
    `;
    el.addEventListener('click', () => {
      state.currentListId = list.id;
      saveState();
      render();
      addTodoInputEl.focus();
    });
    sidebarListsEl.appendChild(el);
  }
}

function renderMain() {
  const list = getCurrentList();
  if (!list) {
    mainEmptyEl.hidden = false;
    mainEmptyEl.style.display = '';
    listViewEl.hidden = true;
    return;
  }
  mainEmptyEl.hidden = false;
  mainEmptyEl.style.display = 'none';
  listViewEl.hidden = false;

  if (document.activeElement !== listTitleInput) listTitleInput.value = list.name;

  const total = list.items.length;
  const done  = list.items.filter(i => i.done).length;
  if (total === 0) {
    listMetaEl.textContent     = 'No items yet — add one below';
    progressFillEl.style.width = '0%';
  } else {
    const pct = Math.round((done / total) * 100);
    listMetaEl.textContent     = `${done} of ${total} completed · ${pct}%`;
    progressFillEl.style.width = `${pct}%`;
  }

  renderTodos(list);
}

function renderTodos(list) {
  const existingEls = {};
  todosContainerEl.querySelectorAll('.todo-item[data-item-id]').forEach(el => {
    existingEls[el.dataset.itemId] = el;
  });

  const sorted = [
    ...list.items.filter(i => !i.done).sort((a, b) => a.createdAt - b.createdAt),
    ...list.items.filter(i =>  i.done).sort((a, b) => a.createdAt - b.createdAt),
  ];

  if (sorted.length === 0) {
    todosContainerEl.innerHTML = '<div class="todos-empty">No todos yet — add one below!</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  for (const item of sorted) {
    let el = existingEls[item.id];
    if (!el) {
      el = buildTodoElement(list.id, item);
    } else {
      syncTodoElement(el, item);
    }
    frag.appendChild(el);
  }
  todosContainerEl.innerHTML = '';
  todosContainerEl.appendChild(frag);
}

function buildTodoElement(listId, item) {
  const el = document.createElement('div');
  el.className = 'todo-item' + (item.done ? ' done' : '');
  el.dataset.itemId = item.id;

  // Ensure older items (before emoji was added) get one
  const emoji = item.emoji || getEmoji(item.text);

  el.innerHTML = `
    <label class="todo-checkbox-label" title="${item.done ? 'Mark as incomplete' : 'Mark as done'}">
      <input type="checkbox" class="todo-checkbox" ${item.done ? 'checked' : ''} />
      <span class="todo-checkmark"></span>
    </label>
    <div class="todo-emoji-wrap">${emoji}</div>
    <span class="todo-text">${escapeHtml(item.text)}</span>
    <button class="todo-delete-btn" title="Remove this item">✕</button>
  `;

  const checkbox = el.querySelector('.todo-checkbox');
  checkbox.addEventListener('change', () => {
    const allDone = toggleTodoItem(listId, item.id);
    render();
    if (allDone) showSuccessAnimation();
  });

  const deleteBtn = el.querySelector('.todo-delete-btn');
  deleteBtn.addEventListener('click', () => {
    el.classList.add('removing');
    setTimeout(() => { deleteTodoItem(listId, item.id); render(); }, 200);
  });

  return el;
}

function syncTodoElement(el, item) {
  item.done ? el.classList.add('done') : el.classList.remove('done');
  const cb    = el.querySelector('.todo-checkbox');
  const label = el.querySelector('.todo-checkbox-label');
  if (cb)    cb.checked = item.done;
  if (label) label.title = item.done ? 'Mark as incomplete' : 'Mark as done';
}

// ============================================================
// EVENT HANDLERS
// ============================================================

document.getElementById('new-list-btn').addEventListener('click', () => {
  createList(); render(); setTimeout(() => listTitleInput.select(), 30);
});

document.getElementById('create-first-btn').addEventListener('click', () => {
  createList(); render(); setTimeout(() => listTitleInput.select(), 30);
});

listTitleInput.addEventListener('input', () => {
  const list = getCurrentList();
  if (list) { renameList(list.id, listTitleInput.value); renderSidebar(); }
});

listTitleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodoInputEl.focus();
});

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

function handleAddTodo() {
  const text = addTodoInputEl.value.trim();
  if (!text) return;
  addTodoInputEl.value = '';
  addTodoItem(text);
  render();
  requestAnimationFrame(() => {
    const items = todosContainerEl.querySelectorAll('.todo-item:not(.done)');
    const last  = items[items.length - 1];
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

addTodoInputEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleAddTodo(); });
document.getElementById('add-todo-btn').addEventListener('click', handleAddTodo);

// ============================================================
// INIT
// ============================================================

loadState();
render();
if (getCurrentList()) addTodoInputEl.focus();
