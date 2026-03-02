/* ============================================================
   MENLABO POS — Application Logic
   ============================================================ */

// ==================== PIN LOCK ====================
const PIN_CODE = '2024';
let _pinInput = '';

function initPinLock() {
  // If already unlocked this session, skip
  if (sessionStorage.getItem('menlabo_unlocked') === 'true') {
    document.getElementById('pin-lock').classList.add('unlocked');
    return;
  }

  document.querySelectorAll('.pin-key').forEach(key => {
    key.addEventListener('click', () => {
      const val = key.dataset.key;
      if (!val) return;

      if (val === 'del') {
        _pinInput = _pinInput.slice(0, -1);
      } else if (_pinInput.length < 4) {
        _pinInput += val;
      }

      // Update dots
      const dots = document.querySelectorAll('.pin-dot');
      dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < _pinInput.length);
        dot.classList.remove('error');
      });
      document.getElementById('pin-error').textContent = '';

      // Check PIN when 4 digits entered
      if (_pinInput.length === 4) {
        if (_pinInput === PIN_CODE) {
          sessionStorage.setItem('menlabo_unlocked', 'true');
          document.getElementById('pin-lock').classList.add('unlocked');
        } else {
          // Wrong PIN
          dots.forEach(dot => dot.classList.add('error'));
          document.getElementById('pin-error').textContent = 'PINが違います';
          setTimeout(() => {
            _pinInput = '';
            dots.forEach(dot => {
              dot.classList.remove('filled', 'error');
            });
          }, 600);
        }
      }
    });
  });
}

// ==================== STATE ====================
const APP = {
  tables: [],
  menu: [],
  orders: [],       // completed orders (today)
  activeTable: null, // currently selected table ID
  activeOrder: null, // current active order for selected table
  selectedSeats: [], // multi-select for group check-in
  settings: {
    sheetsUrl: '',
    currency: '฿'
  }
};

// Table definitions
const TABLE_DEFS = [
  { id: 'C1', type: 'counter', capacity: 1 },
  { id: 'C2', type: 'counter', capacity: 1 },
  { id: 'C3', type: 'counter', capacity: 1 },
  { id: 'C4', type: 'counter', capacity: 1 },
  { id: 'C5', type: 'counter', capacity: 1 },
  { id: 'C6', type: 'counter', capacity: 1 },
  { id: 'T1', type: 'table', capacity: 4 },
  { id: 'T2', type: 'table', capacity: 4 },
  { id: 'T3', type: 'table', capacity: 4 },
  { id: 'T4', type: 'table', capacity: 4 },
  { id: 'T5', type: 'table', capacity: 4 },
  { id: 'T6', type: 'table', capacity: 4 },
];

// Sample menu (will be replaced by CSV import)
const SAMPLE_MENU = [
  { id: 1, category: 'ราเม็น', name: 'โชยุ ราเม็น', name_ja: '醤油ラーメン', price: 259 },
  { id: 2, category: 'ราเม็น', name: 'มิโซะ ราเม็น', name_ja: '味噌ラーメン', price: 279 },
  { id: 3, category: 'ราเม็น', name: 'ชิโอะ ราเม็น', name_ja: '塩ラーメン', price: 259 },
  { id: 4, category: 'ราเม็น', name: 'ทงคตสึ ราเม็น', name_ja: '豚骨ラーメン', price: 289 },
  { id: 5, category: 'ของทานเล่น', name: 'เกี๊ยวซ่า 5 ชิ้น', name_ja: '餃子（5個）', price: 129 },
  { id: 6, category: 'ของทานเล่น', name: 'คาราอาเกะ', name_ja: '唐揚げ', price: 149 },
  { id: 7, category: 'ของทานเล่น', name: 'เอดามาเมะ', name_ja: '枝豆', price: 89 },
  { id: 8, category: 'เครื่องดื่ม', name: 'น้ำเปล่า', name_ja: '水', price: 30 },
  { id: 9, category: 'เครื่องดื่ม', name: 'ชาเขียว', name_ja: '緑茶', price: 59 },
  { id: 10, category: 'เครื่องดื่ม', name: 'โค้ก', name_ja: 'コーラ', price: 49 },
  { id: 11, category: 'เครื่องดื่ม', name: 'เบียร์ สิงห์', name_ja: 'シンハービール', price: 99 },
  { id: 12, category: 'เครื่องดื่ม', name: 'เบียร์ ช้าง', name_ja: 'チャーンビール', price: 89 },
];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initPinLock();
  loadState();
  initTables();
  initNavigation();
  initClock();
  initSeatButtons();
  initSelectionBar();
  initCheckinModal();
  initPaymentModal();
  initSettings();
  renderFloor();
  updateDashboard();
});

function loadState() {
  // Load menu
  const savedMenu = localStorage.getItem('menlabo_menu');
  APP.menu = savedMenu ? JSON.parse(savedMenu) : SAMPLE_MENU;

  // Load today's orders
  const today = getTodayKey();
  const savedOrders = localStorage.getItem(`menlabo_orders_${today}`);
  APP.orders = savedOrders ? JSON.parse(savedOrders) : [];

  // Load active tables
  const savedTables = localStorage.getItem('menlabo_tables');
  if (savedTables) {
    APP.tables = JSON.parse(savedTables);
  } else {
    APP.tables = TABLE_DEFS.map(t => ({
      ...t,
      status: 'available',
      order: null
    }));
  }

  // Load settings
  const savedSettings = localStorage.getItem('menlabo_settings');
  if (savedSettings) APP.settings = JSON.parse(savedSettings);
}

function saveState() {
  localStorage.setItem('menlabo_tables', JSON.stringify(APP.tables));
  localStorage.setItem(`menlabo_orders_${getTodayKey()}`, JSON.stringify(APP.orders));
  localStorage.setItem('menlabo_menu', JSON.stringify(APP.menu));
  localStorage.setItem('menlabo_settings', JSON.stringify(APP.settings));
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// ==================== NAVIGATION ====================
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`${viewName}-view`).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  if (viewName === 'dashboard') updateDashboard();
  if (viewName === 'settings') renderCurrentMenu();
}

// ==================== CLOCK ====================
function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  document.getElementById('date-display').textContent =
    `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
}

// ==================== TABLE INITIALIZATION ====================
function initTables() {
  // Verify tables match definitions
  TABLE_DEFS.forEach(def => {
    const exists = APP.tables.find(t => t.id === def.id);
    if (!exists) {
      APP.tables.push({ ...def, status: 'available', order: null });
    }
  });
}

// ==================== FLOOR RENDERING ====================
function renderFloor() {
  APP.tables.forEach(table => {
    const btn = document.querySelector(`[data-id="${table.id}"]`);
    if (!btn) return;

    // Build class: check if this seat is in selectedSeats
    const isSelected = APP.selectedSeats.includes(table.id);
    let statusClass = isSelected ? 'selected' : table.status;
    btn.className = `seat-btn ${table.type === 'table' ? 'table-btn ' : ''}${statusClass}`;

    const timeEl = btn.querySelector('.seat-time');
    const linkEl = btn.querySelector('.seat-link');

    if (table.order && table.order.checkInTime) {
      const t = new Date(table.order.checkInTime);
      timeEl.textContent = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    } else {
      timeEl.textContent = '';
    }

    // Show group link icon
    if (linkEl) {
      if (table.order && table.order.tableIds && table.order.tableIds.length > 1) {
        const others = table.order.tableIds.filter(id => id !== table.id).join('+');
        linkEl.textContent = `🔗 ${others}`;
      } else {
        linkEl.textContent = '';
      }
    }
  });
}

// ==================== SEAT BUTTON HANDLERS ====================
function initSeatButtons() {
  document.querySelectorAll('.seat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tableId = btn.dataset.id;
      const table = APP.tables.find(t => t.id === tableId);
      if (!table) return;

      if (table.status === 'available') {
        // Dismiss current order panel when selecting available seats
        if (APP.activeOrder) resetOrderPanel();
        // Toggle selection for multi-select
        toggleSeatSelection(tableId);
      } else if (table.status === 'occupied') {
        // Clear any selection
        clearSelection();
        // Find the primary table (first in group) to show order
        const primaryId = table.order && table.order.tableIds ? table.order.tableIds[0] : tableId;
        APP.activeTable = primaryId;
        showOrderPanel(primaryId);
      }
    });
  });
}

function resetOrderPanel() {
  APP.activeTable = null;
  APP.activeOrder = null;
  const panel = document.getElementById('detail-panel');
  panel.innerHTML = `
    <div class="detail-empty">
      <div class="detail-empty-icon">👈</div>
      <p class="th">เลือกที่นั่งหรือโต๊ะ</p>
      <p class="ja">テーブルまたは席を選択</p>
    </div>
  `;
  // Clear all outlines
  document.querySelectorAll('.seat-btn').forEach(btn => {
    btn.style.outline = 'none';
  });
}

// ==================== MULTI-SELECT / GROUP ====================
function toggleSeatSelection(tableId) {
  const idx = APP.selectedSeats.indexOf(tableId);
  if (idx >= 0) {
    APP.selectedSeats.splice(idx, 1);
  } else {
    APP.selectedSeats.push(tableId);
  }
  updateSelectionBar();
  renderFloor();
}

function clearSelection() {
  APP.selectedSeats = [];
  updateSelectionBar();
  renderFloor();
}

function updateSelectionBar() {
  const bar = document.getElementById('selection-bar');
  const idsEl = document.getElementById('selected-ids');

  if (APP.selectedSeats.length === 0) {
    bar.classList.add('hidden');
  } else {
    bar.classList.remove('hidden');
    idsEl.textContent = APP.selectedSeats.join(' + ');
  }
}

function initSelectionBar() {
  document.getElementById('btn-clear-selection').addEventListener('click', clearSelection);
  document.getElementById('btn-group-checkin').addEventListener('click', () => {
    if (APP.selectedSeats.length === 0) return;
    openCheckinModal(APP.selectedSeats);
  });
}

// ==================== CHECK-IN MODAL ====================
let _longPressed = false;

function initCheckinModal() {
  // Confirm check-in
  document.getElementById('confirm-checkin').addEventListener('click', confirmCheckinOrEdit);

  // Long-press to decrement cells
  document.querySelectorAll('.cell-btn').forEach(btn => {
    let pressTimer;
    btn.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        _longPressed = true;
        cellDecrement(btn);
        e.preventDefault();
      }, 500);
    }, { passive: false });
    btn.addEventListener('touchend', () => { clearTimeout(pressTimer); setTimeout(() => { _longPressed = false; }, 50); });
    btn.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    // Mouse fallback
    btn.addEventListener('mousedown', () => {
      pressTimer = setTimeout(() => { _longPressed = true; cellDecrement(btn); }, 500);
    });
    btn.addEventListener('mouseup', () => { clearTimeout(pressTimer); setTimeout(() => { _longPressed = false; }, 50); });
    btn.addEventListener('mouseleave', () => clearTimeout(pressTimer));
  });
}

function openCheckinModal(tableIds) {
  const ids = Array.isArray(tableIds) ? tableIds : [tableIds];
  APP._pendingCheckinIds = ids;

  document.getElementById('checkin-table-id').textContent = ids.join(' + ');

  // Reset all cells
  document.querySelectorAll('.cell-btn').forEach(btn => {
    btn.textContent = '0';
    btn.classList.remove('has-value');
  });
  updateGuestTotal();

  document.getElementById('checkin-modal').classList.remove('hidden');
}

function cellIncrement(btn) {
  if (_longPressed) return;
  let val = parseInt(btn.textContent) + 1;
  btn.textContent = val;
  btn.classList.toggle('has-value', val > 0);
  updateGuestTotal();
}

function cellDecrement(btn) {
  let val = parseInt(btn.textContent) - 1;
  if (val < 0) val = 0;
  btn.textContent = val;
  btn.classList.toggle('has-value', val > 0);
  updateGuestTotal();
}

function updateGuestTotal() {
  let total = 0;
  document.querySelectorAll('.cell-btn').forEach(btn => {
    total += parseInt(btn.textContent) || 0;
  });
  document.getElementById('guest-total').textContent = total;
}

function readMatrix() {
  const data = { total: 0, male: 0, female: 0, other: 0, nationalities: {} };
  document.querySelectorAll('.matrix-table tbody tr').forEach(row => {
    const nat = row.dataset.nat;
    const cells = row.querySelectorAll('.cell-btn');
    const f = parseInt(cells[0].textContent) || 0;
    const m = parseInt(cells[1].textContent) || 0;
    const o = parseInt(cells[2].textContent) || 0;
    const rowTotal = f + m + o;
    if (rowTotal > 0) {
      data.nationalities[nat] = { female: f, male: m, other: o, total: rowTotal };
    }
    data.female += f;
    data.male += m;
    data.other += o;
    data.total += rowTotal;
  });
  return data;
}

function confirmCheckin() {
  const tableIds = APP._pendingCheckinIds || [APP.activeTable];
  if (!tableIds || tableIds.length === 0) return;

  const matrix = readMatrix();
  if (matrix.total === 0) {
    showToast('⚠️ กรุณาเลือกจำนวนลูกค้า / 来店者を入力してください');
    return;
  }

  // Determine primary nationality (highest count)
  const nats = Object.entries(matrix.nationalities);
  const primaryNat = nats.length > 0
    ? nats.sort((a, b) => b[1].total - a[1].total)[0][0]
    : 'อื่นๆ';

  const now = new Date();
  const groupLabel = tableIds.join('+');
  const orderId = `${getTodayKey()}-${groupLabel}-${String(APP.orders.length + countActiveOrders() + 1).padStart(3, '0')}`;

  const order = {
    orderId,
    tableId: groupLabel,
    tableIds: [...tableIds],
    checkInTime: now.toISOString(),
    checkOutTime: null,
    guests: {
      total: matrix.total,
      male: matrix.male,
      female: matrix.female,
      other: matrix.other,
      nationalities: matrix.nationalities
    },
    nationality: primaryNat,
    items: [],
    total: 0,
    paymentMethod: null,
    status: 'active'
  };

  // Set all tables in the group to occupied with shared order reference
  tableIds.forEach(id => {
    const table = APP.tables.find(t => t.id === id);
    if (table) {
      table.status = 'occupied';
      table.order = order;
    }
  });

  // Clear selection
  APP.selectedSeats = [];
  updateSelectionBar();
  APP._pendingCheckinIds = null;

  const primaryId = tableIds[0];
  APP.activeTable = primaryId;

  saveState();
  renderFloor();
  closeModal('checkin-modal');
  showOrderPanel(primaryId);
  showToast(`${groupLabel} เช็คอินแล้ว / 入店完了`);
}

function countActiveOrders() {
  // Count unique active orders (groups count as 1)
  const seen = new Set();
  APP.tables.forEach(t => {
    if (t.status !== 'available' && t.order) seen.add(t.order.orderId);
  });
  return seen.size;
}

// ==================== ORDER PANEL ====================
function showOrderPanel(tableId) {
  const table = APP.tables.find(t => t.id === tableId);
  if (!table || !table.order) return;

  APP.activeTable = tableId;
  APP.activeOrder = table.order;

  const panel = document.getElementById('detail-panel');
  const template = document.getElementById('order-panel-template');

  panel.innerHTML = '';
  const clone = template.content.cloneNode(true);
  panel.appendChild(clone);

  // Fill header — show all grouped table IDs
  const displayId = table.order.tableIds ? table.order.tableIds.join(' + ') : tableId;
  document.getElementById('order-table-id').textContent = displayId;
  const checkinTime = new Date(table.order.checkInTime);
  document.getElementById('order-checkin-time').textContent =
    `${String(checkinTime.getHours()).padStart(2, '0')}:${String(checkinTime.getMinutes()).padStart(2, '0')}`;
  const g = table.order.guests;
  let guestText = `${g.total} คน (♀${g.female} ♂${g.male} ⚧${g.other || 0})`;
  if (g.nationalities) {
    const natList = Object.entries(g.nationalities).map(([n, v]) => `${n}:${v.total}`).join(' ');
    guestText += ` | ${natList}`;
  } else {
    guestText += ` | ${table.order.nationality}`;
  }
  document.getElementById('order-guest-info').textContent = guestText;

  // Add edit guests button
  const guestInfoEl = document.getElementById('order-guest-info');
  const editBtn = document.createElement('button');
  editBtn.textContent = '✏️';
  editBtn.title = 'ゲスト人数を修正';
  editBtn.style.cssText = 'background:none;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:14px;padding:2px 8px;margin-left:8px;color:var(--text-secondary);';
  editBtn.addEventListener('click', () => editGuests(tableId));
  guestInfoEl.parentNode.insertBefore(editBtn, guestInfoEl.nextSibling);

  // Render categories
  renderMenuCategories();
  // Render order items
  renderOrderItems();
  // Payment button
  document.getElementById('btn-payment').addEventListener('click', () => openPaymentModal(tableId));

  // Highlight ALL tables in the group
  const groupIds = table.order.tableIds || [tableId];
  document.querySelectorAll('.seat-btn').forEach(btn => {
    btn.style.outline = groupIds.includes(btn.dataset.id) ? '3px solid var(--accent)' : 'none';
  });
}

function editGuests(tableId) {
  const table = APP.tables.find(t => t.id === tableId);
  if (!table || !table.order) return;

  APP._editingGuestsTableId = tableId;

  // Reset matrix
  document.querySelectorAll('.matrix-btn').forEach(btn => {
    btn.textContent = '0';
    btn.classList.remove('has-value');
  });

  // Pre-fill matrix with current values
  const g = table.order.guests;
  if (g.nationalities) {
    Object.entries(g.nationalities).forEach(([nat, vals]) => {
      ['female', 'male', 'other'].forEach(gender => {
        const btn = document.querySelector(`.matrix-btn[data-nat="${nat}"][data-gender="${gender}"]`);
        if (btn && vals[gender] > 0) {
          btn.textContent = vals[gender];
          btn.classList.add('has-value');
        }
      });
    });
  }

  // Open modal
  document.getElementById('checkin-modal').classList.remove('hidden');
}

// Override confirm checkin to handle edit mode
function confirmCheckinOrEdit() {
  if (APP._editingGuestsTableId) {
    const tableId = APP._editingGuestsTableId;
    const table = APP.tables.find(t => t.id === tableId);
    if (!table || !table.order) return;

    const matrix = readMatrix();
    if (matrix.total === 0) {
      showToast('⚠️ กรุณาเลือกจำนวนลูกค้า / 来店者を入力してください');
      return;
    }

    const nats = Object.entries(matrix.nationalities);
    const primaryNat = nats.length > 0
      ? nats.sort((a, b) => b[1].total - a[1].total)[0][0]
      : 'อื่นๆ';

    // Update guest info on the existing order
    table.order.guests = {
      total: matrix.total,
      male: matrix.male,
      female: matrix.female,
      other: matrix.other,
      nationalities: matrix.nationalities
    };
    table.order.nationality = primaryNat;

    // Update all tables in the group
    const groupIds = table.order.tableIds || [tableId];
    groupIds.forEach(id => {
      const t = APP.tables.find(x => x.id === id);
      if (t && t.order) t.order = table.order;
    });

    APP._editingGuestsTableId = null;
    saveState();
    closeModal('checkin-modal');
    showOrderPanel(tableId);
    showToast('✅ ข้อมูลลูกค้าอัปเดตแล้ว / ゲスト情報を更新しました');
  } else {
    confirmCheckin();
  }
}

function renderMenuCategories() {
  const categories = [...new Set(APP.menu.map(m => m.category))];
  const container = document.getElementById('menu-categories');
  if (!container) return;

  container.innerHTML = `<button class="cat-btn active" data-cat="all">ทั้งหมด<small style="margin-left:4px;font-size:10px;color:inherit;">全て</small></button>` +
    categories.map(cat => `<button class="cat-btn" data-cat="${cat}">${cat}</button>`).join('');

  container.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMenuItems(btn.dataset.cat);
    });
  });

  renderMenuItems('all');
}

function renderMenuItems(category) {
  const container = document.getElementById('menu-items');
  if (!container) return;

  const items = category === 'all' ? APP.menu : APP.menu.filter(m => m.category === category);

  container.innerHTML = items.map(item => `
    <button class="menu-item-btn" data-menu-id="${item.id}">
      <span class="menu-item-name">${item.name}</span>
      <span class="menu-item-name-ja">${item.name_ja}</span>
      <span class="menu-item-price">${APP.settings.currency}${item.price}</span>
    </button>
  `).join('');

  container.querySelectorAll('.menu-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const menuId = btn.dataset.menuId;
      addToOrder(menuId);
    });
  });
}

function addToOrder(menuId) {
  if (!APP.activeOrder) return;

  const menuItem = APP.menu.find(m => m.id === menuId);
  if (!menuItem) return;

  const existing = APP.activeOrder.items.find(i => i.menuId === menuId);
  if (existing) {
    existing.qty += 1;
    existing.subtotal = existing.qty * existing.price;
  } else {
    APP.activeOrder.items.push({
      menuId,
      name: menuItem.name,
      name_ja: menuItem.name_ja,
      price: menuItem.price,
      qty: 1,
      subtotal: menuItem.price
    });
  }

  recalcTotal();
  renderOrderItems();
  saveState();
}

function adjustOrderItemQty(menuId, delta) {
  if (!APP.activeOrder) return;

  const item = APP.activeOrder.items.find(i => i.menuId === menuId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    APP.activeOrder.items = APP.activeOrder.items.filter(i => i.menuId !== menuId);
  } else {
    item.subtotal = item.qty * item.price;
  }

  recalcTotal();
  renderOrderItems();
  saveState();
}

function removeOrderItem(menuId) {
  if (!APP.activeOrder) return;
  APP.activeOrder.items = APP.activeOrder.items.filter(i => i.menuId !== menuId);
  recalcTotal();
  renderOrderItems();
  saveState();
}

function recalcTotal() {
  if (!APP.activeOrder) return;
  APP.activeOrder.total = APP.activeOrder.items.reduce((sum, i) => sum + i.subtotal, 0);
}

function renderOrderItems() {
  const container = document.getElementById('order-items');
  const totalEl = document.getElementById('order-total');
  if (!container || !totalEl || !APP.activeOrder) return;

  if (APP.activeOrder.items.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:12px">ยังไม่มีรายการ / 注文なし</div>';
  } else {
    container.innerHTML = APP.activeOrder.items.map(item => `
      <div class="order-item">
        <div class="order-item-name">${item.name} <small style="color:var(--text-secondary)">${item.name_ja}</small></div>
        <div class="order-item-qty">
          <button onclick="adjustOrderItemQty('${item.menuId}', -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="adjustOrderItemQty('${item.menuId}', 1)">+</button>
        </div>
        <div class="order-item-subtotal">${APP.settings.currency}${item.subtotal}</div>
        <button class="order-item-remove" onclick="removeOrderItem('${item.menuId}')">✕</button>
      </div>
    `).join('');
  }

  totalEl.textContent = `${APP.settings.currency}${APP.activeOrder.total}`;
}

// ==================== PAYMENT MODAL ====================
function initPaymentModal() {
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('confirm-payment').disabled = false;
    });
  });

  document.getElementById('confirm-payment').addEventListener('click', confirmPayment);
}

function openPaymentModal(tableId) {
  const table = APP.tables.find(t => t.id === tableId);
  if (!table || !table.order) return;

  if (table.order.items.length === 0) {
    showToast('⚠️ ไม่มีรายการสั่ง / 注文がありません');
    return;
  }

  const displayId = table.order.tableIds ? table.order.tableIds.join(' + ') : tableId;
  document.getElementById('payment-table-id').textContent = displayId;
  document.getElementById('payment-total-value').textContent = `${APP.settings.currency}${table.order.total}`;

  // Reset selection
  document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('confirm-payment').disabled = true;

  // Keep occupied status during payment
  const groupIds = table.order.tableIds || [tableId];
  saveState();
  renderFloor();

  document.getElementById('payment-modal').classList.remove('hidden');
}

function confirmPayment() {
  const tableId = APP.activeTable;
  const table = APP.tables.find(t => t.id === tableId);
  if (!table || !table.order) return;

  const selectedMethod = document.querySelector('.pay-method-btn.selected');
  if (!selectedMethod) return;

  const paymentMethod = selectedMethod.dataset.method;
  const now = new Date();

  // Finalize order
  table.order.paymentMethod = paymentMethod;
  table.order.checkOutTime = now.toISOString();
  table.order.status = 'paid';

  // Move to completed orders
  APP.orders.push({ ...table.order });

  // Sync to Google Sheets
  syncToSheets(table.order);

  // Reset ALL tables in the group
  const groupIds = table.order.tableIds || [tableId];
  const displayId = groupIds.join(' + ');
  groupIds.forEach(id => {
    const t = APP.tables.find(x => x.id === id);
    if (t) {
      t.status = 'available';
      t.order = null;
    }
  });

  APP.activeTable = null;
  APP.activeOrder = null;

  saveState();
  renderFloor();
  closeModal('payment-modal');

  // Reset detail panel
  const panel = document.getElementById('detail-panel');
  panel.innerHTML = `
    <div class="detail-empty">
      <div class="detail-empty-icon">👈</div>
      <p class="th">เลือกที่นั่งหรือโต๊ะ</p>
      <p class="ja">テーブルまたは席を選択</p>
    </div>
  `;

  // Clear outline
  document.querySelectorAll('.seat-btn').forEach(btn => {
    btn.style.outline = 'none';
  });

  showToast(`✅ ${displayId} ชำระเงินเรียบร้อย / 精算完了`);
  updateDashboard();
}

// ==================== MODAL UTILITY ====================
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function adjustCount(elementId, delta) {
  const el = document.getElementById(elementId);
  let val = parseInt(el.textContent) + delta;
  if (val < 0) val = 0;
  el.textContent = val;
}

// ==================== TOAST ====================
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2500);
}

// ==================== GOOGLE SHEETS SYNC ====================

// Fetch menu from Google Sheets (GAS doGet)
async function fetchMenuFromSheets() {
  if (!APP.settings.sheetsUrl) {
    showToast('⚠️ กรุณาตั้งค่า URL ก่อน / URLを設定してください');
    return;
  }

  showToast('📡 กำลังดึงเมนู... / メニュー取得中...');

  try {
    const res = await fetch(APP.settings.sheetsUrl);
    const data = await res.json();

    if (data.status === 'ok' && data.menu) {
      APP.menu = data.menu;
      saveState();
      renderCurrentMenu();
      if (APP.activeOrder) renderMenuCategories();
      showToast(`✅ เมนู ${data.count} รายการ / ${data.count}件のメニュー取得完了`);
    } else {
      showToast(`❌ ${data.message || 'เกิดข้อผิดพลาด / エラー'}`);
    }
  } catch (err) {
    console.error('Menu fetch failed:', err);
    showToast('❌ เชื่อมต่อไม่สำเร็จ / 接続失敗');
  }
}

// Sync order to Google Sheets (GAS doPost)
async function syncToSheets(order) {
  if (!APP.settings.sheetsUrl) return;

  const payload = {
    orderId: order.orderId,
    tableId: order.tableId,
    checkInTime: order.checkInTime,
    checkOutTime: order.checkOutTime,
    guestsTotal: order.guests.total,
    guestsMale: order.guests.male,
    guestsFemale: order.guests.female,
    guestsOther: order.guests.other || 0,
    nationality: order.nationality,
    nationalityDetail: order.guests.nationalities ? JSON.stringify(order.guests.nationalities) : '',
    items: order.items.map(i => `${i.name_ja}(${i.name}) x${i.qty}`).join(', '),
    itemsDetail: JSON.stringify(order.items),
    orderItems: order.items,
    total: order.total,
    paymentMethod: order.paymentMethod,
    stayMinutes: Math.round((new Date(order.checkOutTime) - new Date(order.checkInTime)) / 60000)
  };

  try {
    await fetch(APP.settings.sheetsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Synced to Sheets:', order.orderId);
  } catch (err) {
    console.error('Sheets sync failed:', err);
    const queue = JSON.parse(localStorage.getItem('menlabo_sync_queue') || '[]');
    queue.push(payload);
    localStorage.setItem('menlabo_sync_queue', JSON.stringify(queue));
  }
}

async function retrySyncQueue() {
  if (!APP.settings.sheetsUrl) return;
  const queue = JSON.parse(localStorage.getItem('menlabo_sync_queue') || '[]');
  if (queue.length === 0) return;

  const remaining = [];
  for (const payload of queue) {
    try {
      await fetch(APP.settings.sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      remaining.push(payload);
    }
  }
  localStorage.setItem('menlabo_sync_queue', JSON.stringify(remaining));
}

// Retry sync queue every 5 minutes
setInterval(retrySyncQueue, 300000);

// ==================== SETTINGS ====================
function initSettings() {
  // CSV Import
  document.getElementById('csv-import').addEventListener('change', handleCSVImport);

  // Sheets URL
  const savedUrl = APP.settings.sheetsUrl;
  if (savedUrl) document.getElementById('sheets-url').value = savedUrl;

  document.getElementById('save-sheets-url').addEventListener('click', () => {
    const url = document.getElementById('sheets-url').value.trim();
    APP.settings.sheetsUrl = url;
    saveState();
    document.getElementById('sync-status').textContent = '✅ บันทึกแล้ว / 保存済み';
    setTimeout(() => document.getElementById('sync-status').textContent = '', 3000);
  });

  document.getElementById('test-sync').addEventListener('click', async () => {
    const testPayload = { test: true, timestamp: new Date().toISOString() };
    try {
      await fetch(APP.settings.sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      document.getElementById('sync-status').textContent = '✅ ส่งข้อมูลทดสอบแล้ว / テスト送信完了';
    } catch (err) {
      document.getElementById('sync-status').textContent = '❌ เชื่อมต่อไม่สำเร็จ / 接続失敗';
    }
    setTimeout(() => document.getElementById('sync-status').textContent = '', 3000);
  });

  // Fetch menu from Sheets
  document.getElementById('fetch-menu').addEventListener('click', fetchMenuFromSheets);

  // Export CSV
  document.getElementById('export-csv').addEventListener('click', exportCSV);

  // Clear today
  document.getElementById('clear-today').addEventListener('click', () => {
    if (confirm('ล้างข้อมูลวันนี้ทั้งหมด？\n本日のデータをすべてクリアしますか？')) {
      APP.orders = [];
      APP.tables = TABLE_DEFS.map(t => ({ ...t, status: 'available', order: null }));
      APP.activeTable = null;
      APP.activeOrder = null;
      saveState();
      renderFloor();
      updateDashboard();

      const panel = document.getElementById('detail-panel');
      panel.innerHTML = `
        <div class="detail-empty">
          <div class="detail-empty-icon">👈</div>
          <p class="th">เลือกที่นั่งหรือโต๊ะ</p>
          <p class="ja">テーブルまたは席を選択</p>
        </div>
      `;

      showToast('🗑️ ล้างข้อมูลเรียบร้อย / データクリア完了');
    }
  });
}

function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const menu = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 5) continue;

        const item = {};
        headers.forEach((h, idx) => {
          item[h] = values[idx]?.trim() || '';
        });

        menu.push({
          id: parseInt(item.id) || i,
          category: item.category || 'อื่นๆ',
          name: item.name || item.name_th || '',
          name_ja: item.name_ja || '',
          price: parseInt(item.price) || 0
        });
      }

      APP.menu = menu;
      saveState();

      document.getElementById('import-status').textContent = `✅ นำเข้า ${menu.length} รายการ / ${menu.length}件インポート完了`;
      setTimeout(() => document.getElementById('import-status').textContent = '', 5000);

      renderCurrentMenu();
      showToast(`📋 เมนู ${menu.length} รายการนำเข้าแล้ว / ${menu.length}件のメニューをインポート`);

      // Update order panel if open
      if (APP.activeOrder) {
        renderMenuCategories();
      }
    } catch (err) {
      document.getElementById('import-status').textContent = '❌ ข้อผิดพลาด / エラー';
      console.error('CSV import error:', err);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function renderCurrentMenu() {
  const container = document.getElementById('current-menu-list');
  if (!container) return;

  if (APP.menu.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);padding:16px;text-align:center">ไม่มีเมนู / メニュー未登録</div>';
    return;
  }

  const categories = [...new Set(APP.menu.map(m => m.category))];
  container.innerHTML = categories.map(cat => {
    const items = APP.menu.filter(m => m.category === cat);
    return `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:6px">${cat}</div>
        ${items.map(item => `
          <div class="current-menu-item">
            <span>${item.name} <small style="color:var(--text-secondary)">${item.name_ja}</small></span>
            <span style="color:var(--accent);font-weight:700">${APP.settings.currency}${item.price}</span>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function exportCSV() {
  if (APP.orders.length === 0) {
    showToast('⚠️ ไม่มีข้อมูล / データがありません');
    return;
  }

  const headers = ['Order ID', 'Table', 'Check-in', 'Check-out', 'Stay (min)', 'Guests', 'Male', 'Female', 'Nationality', 'Items', 'Total (฿)', 'Payment'];
  const rows = APP.orders.map(o => {
    const stayMin = o.checkOutTime ? Math.round((new Date(o.checkOutTime) - new Date(o.checkInTime)) / 60000) : '';
    return [
      o.orderId,
      o.tableId,
      o.checkInTime,
      o.checkOutTime || '',
      stayMin,
      o.guests.total,
      o.guests.male,
      o.guests.female,
      o.nationality,
      o.items.map(i => `${i.name} x${i.qty}`).join(' / '),
      o.total,
      o.paymentMethod || ''
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `menlabo_pos_${getTodayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV ดาวน์โหลดแล้ว / CSVダウンロード完了');
}

// ==================== DASHBOARD ====================
function updateDashboard() {
  const orders = APP.orders;

  // Revenue
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  document.getElementById('dash-revenue').textContent = `${APP.settings.currency}${revenue.toLocaleString()}`;

  // Guests
  const guests = orders.reduce((sum, o) => sum + o.guests.total, 0);
  document.getElementById('dash-guests').textContent = guests;

  // Groups
  document.getElementById('dash-groups').textContent = orders.length;

  // Avg spend per guest
  const avgSpend = guests > 0 ? Math.round(revenue / guests) : 0;
  document.getElementById('dash-avg-spend').textContent = `${APP.settings.currency}${avgSpend}`;

  // Avg stay
  const stayMinutes = orders
    .filter(o => o.checkOutTime)
    .map(o => (new Date(o.checkOutTime) - new Date(o.checkInTime)) / 60000);
  const avgStay = stayMinutes.length > 0 ? Math.round(stayMinutes.reduce((a, b) => a + b, 0) / stayMinutes.length) : 0;
  document.getElementById('dash-avg-stay').textContent = `${avgStay} นาที`;

  // Total items
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0);
  document.getElementById('dash-total-items').textContent = totalItems;

  // Charts
  renderHourlyChart(orders);
  renderMenuRanking(orders);
  renderPaymentChart(orders);
  renderNationalityChart(orders);

  // Monthly chart
  updateMonthlyData(orders);
  renderMonthlyChart();
}

// ==================== MONTHLY DATA ====================
function updateMonthlyData(todaysOrders) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  let monthlyData = JSON.parse(localStorage.getItem('menlabo_monthly') || '{}');

  // If stored data is for a different month, reset
  if (monthlyData._month !== monthKey) {
    monthlyData = { _month: monthKey };
  }

  // Update today's entry
  const revenue = todaysOrders.reduce((sum, o) => sum + o.total, 0);
  const guests = todaysOrders.reduce((sum, o) => sum + o.guests.total, 0);
  const groups = todaysOrders.length;

  monthlyData[todayStr] = { revenue, guests, groups };

  localStorage.setItem('menlabo_monthly', JSON.stringify(monthlyData));
}

function renderMonthlyChart() {
  const container = document.getElementById('monthly-chart');
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Title
  const titleEl = document.getElementById('monthly-chart-title');
  if (titleEl) {
    titleEl.innerHTML = `<span class="th">ยอดขาย ${month + 1}/${year}</span> <span class="ja">${year}年${month + 1}月 売上・来店者数</span>`;
  }

  const monthlyData = JSON.parse(localStorage.getItem('menlabo_monthly') || '{}');
  if (monthlyData._month !== monthKey) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">ยังไม่มีข้อมูล / データなし</div>';
    return;
  }

  // Build daily array
  const days = [];
  let maxRevenue = 0;
  let maxGuests = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data = monthlyData[key] || { revenue: 0, guests: 0, groups: 0 };
    days.push({ day: d, ...data });
    if (data.revenue > maxRevenue) maxRevenue = data.revenue;
    if (data.guests > maxGuests) maxGuests = data.guests;
  }

  // SVG dimensions
  const svgW = 800;
  const svgH = 200;
  const chartTop = 10;
  const chartBottom = svgH - 25;
  const chartH = chartBottom - chartTop;
  const barW = Math.max(8, Math.floor((svgW - 20) / daysInMonth) - 3);
  const step = (svgW - 20) / daysInMonth;
  const leftPad = 10;

  const maxVal = maxRevenue || 1;
  const gScale = maxGuests || 1;
  const todayDay = now.getDate();

  let bars = '';
  let labels = '';
  let linePoints = [];
  let dots = '';

  days.forEach((d, i) => {
    const cx = leftPad + i * step + barW / 2;
    const barX = leftPad + i * step;

    // Revenue bar
    const revenueH = (d.revenue / maxVal) * chartH;
    const barOpacity = d.revenue > 0 ? (d.day === todayDay ? 0.95 : 0.7) : 0.08;
    const barColor = d.day === todayDay ? '#34d399' : '#0d9488';
    bars += `<rect x="${barX}" y="${chartBottom - revenueH}" width="${barW}" height="${revenueH}" fill="${barColor}" rx="2" opacity="${barOpacity}"><title>${d.day}日: ฿${d.revenue.toLocaleString()} / ${d.guests}人</title></rect>`;

    // Guest line point
    const gy = chartBottom - (d.guests / gScale) * chartH;
    if (d.guests > 0) {
      linePoints.push({ x: cx, y: gy, day: d.day, guests: d.guests });
    }

    // Day label
    if (d.day % 2 === 1 || d.day === todayDay || daysInMonth <= 15) {
      const lColor = d.day === todayDay ? '#34d399' : '#6b7280';
      const lWeight = d.day === todayDay ? ' font-weight="bold"' : '';
      labels += `<text x="${cx}" y="${svgH - 4}" text-anchor="middle" font-size="9" fill="${lColor}"${lWeight}>${d.day}</text>`;
    }
  });

  // Guest line path
  let linePath = '';
  if (linePoints.length > 0) {
    linePath = `<polyline points="${linePoints.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
    // Dots
    linePoints.forEach(p => {
      const isToday = p.day === todayDay;
      dots += `<circle cx="${p.x}" cy="${p.y}" r="${isToday ? 5 : 3.5}" fill="${isToday ? '#fbbf24' : '#d97706'}" stroke="#1a1a2e" stroke-width="1.5"><title>${p.day}日: ${p.guests}人</title></circle>`;
      // Guest count label above dot
      dots += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="8" fill="#fbbf24" font-weight="bold">${p.guests}</text>`;
    });
  }

  // Grid lines
  let grid = '';
  for (let g = 0.25; g <= 1; g += 0.25) {
    const gy = chartBottom - g * chartH;
    grid += `<line x1="0" y1="${gy}" x2="${svgW}" y2="${gy}" stroke="#374151" stroke-width="0.3" stroke-dasharray="4,4"/>`;
  }

  // Totals
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);
  const totalGuests = days.reduce((s, d) => s + d.guests, 0);
  const avgRevenue = days.filter(d => d.revenue > 0).length > 0
    ? Math.round(totalRevenue / days.filter(d => d.revenue > 0).length) : 0;

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:8px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:14px;height:10px;background:#0d9488;border-radius:2px;"></span><span style="font-size:11px;color:var(--text-secondary)">売上 ฿${totalRevenue.toLocaleString()} (日平均: ฿${avgRevenue.toLocaleString()})</span></div>
      <div style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:14px;height:2px;background:#fbbf24;border-radius:1px;"></span><span style="display:inline-block;width:6px;height:6px;background:#fbbf24;border-radius:50%;margin-left:-3px;"></span><span style="font-size:11px;color:var(--text-secondary)">来店者 ${totalGuests}人</span></div>
    </div>
    <svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:auto;">
      ${grid}
      <line x1="0" y1="${chartBottom}" x2="${svgW}" y2="${chartBottom}" stroke="#4b5563" stroke-width="0.5"/>
      ${bars}
      ${linePath}
      ${dots}
      ${labels}
    </svg>
  `;
}

function renderHourlyChart(orders) {
  const container = document.getElementById('hourly-chart');
  if (!container) return;

  const hourlyData = {};
  for (let h = 10; h <= 22; h++) hourlyData[h] = 0;

  orders.forEach(o => {
    const hour = new Date(o.checkInTime).getHours();
    if (hourlyData[hour] !== undefined) hourlyData[hour] += o.total;
  });

  const maxVal = Math.max(...Object.values(hourlyData), 1);

  container.innerHTML = `<div class="bar-chart">${Object.entries(hourlyData).map(([hour, val]) => {
    const pct = (val / maxVal) * 100;
    return `
        <div class="bar-item">
          <div class="bar-value">${val > 0 ? APP.settings.currency + val : ''}</div>
          <div class="bar" style="height:${pct}%"></div>
          <div class="bar-label">${hour}:00</div>
        </div>
      `;
  }).join('')
    }</div>`;
}

function renderMenuRanking(orders) {
  const container = document.getElementById('menu-ranking');
  if (!container) return;

  const menuSales = {};
  orders.forEach(o => {
    o.items.forEach(item => {
      if (!menuSales[item.name]) menuSales[item.name] = { name: item.name, name_ja: item.name_ja, qty: 0, revenue: 0 };
      menuSales[item.name].qty += item.qty;
      menuSales[item.name].revenue += item.subtotal;
    });
  });

  const sorted = Object.values(menuSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxRev = sorted.length > 0 ? sorted[0].revenue : 1;

  if (sorted.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px">ยังไม่มีข้อมูล / データなし</div>';
    return;
  }

  container.innerHTML = `<div class="ranking-list">${sorted.map((item, i) => `
    <div class="ranking-item">
      <div class="ranking-pos">${i + 1}</div>
      <div class="ranking-name">${item.name} <small style="color:var(--text-secondary)">${item.name_ja}</small></div>
      <div class="ranking-bar-bg"><div class="ranking-bar-fill" style="width:${(item.revenue / maxRev) * 100}%"></div></div>
      <div class="ranking-value">${APP.settings.currency}${item.revenue}</div>
    </div>
  `).join('')}</div>`;
}

function renderPaymentChart(orders) {
  const container = document.getElementById('payment-chart');
  if (!container) return;

  const methods = { cash: 0, qr: 0, card: 0 };
  const labels = { cash: '💵 เงินสด / 現金', qr: '📱 QR', card: '💳 บัตร / カード' };
  const colors = { cash: '#4ade80', qr: '#60a5fa', card: '#a78bfa' };

  orders.forEach(o => {
    if (o.paymentMethod && methods[o.paymentMethod] !== undefined) {
      methods[o.paymentMethod]++;
    }
  });

  const total = Object.values(methods).reduce((a, b) => a + b, 0) || 1;

  // SVG Pie
  let cumulativePercent = 0;
  const slices = Object.entries(methods).map(([method, count]) => {
    const pct = count / total;
    const startAngle = cumulativePercent * 360;
    cumulativePercent += pct;
    const endAngle = cumulativePercent * 360;
    return { method, count, pct, startAngle, endAngle, color: colors[method] };
  });

  const svgPie = createPieSVG(slices);

  container.innerHTML = `
    <div class="pie-chart-container">
      ${svgPie}
      <div class="pie-legend">
        ${Object.entries(methods).map(([method, count]) => `
          <div class="pie-legend-item">
            <div class="pie-color" style="background:${colors[method]}"></div>
            <span>${labels[method]}</span>
            <span class="pie-pct">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderNationalityChart(orders) {
  const container = document.getElementById('nationality-chart');
  if (!container) return;

  const natData = {};
  const natColors = {
    'ไทย': '#fbbf24',
    'ญี่ปุ่น': '#ef4444',
    'จีน': '#f97316',
    'เกาหลี': '#a78bfa',
    'ฝรั่ง': '#60a5fa',
    'อื่นๆ': '#6b7280'
  };

  orders.forEach(o => {
    // Use detailed nationalities if available (new matrix format)
    if (o.guests.nationalities) {
      Object.entries(o.guests.nationalities).forEach(([nat, info]) => {
        natData[nat] = (natData[nat] || 0) + info.total;
      });
    } else {
      // Fallback for old format
      natData[o.nationality] = (natData[o.nationality] || 0) + o.guests.total;
    }
  });

  const total = Object.values(natData).reduce((a, b) => a + b, 0) || 1;

  let cumulativePercent = 0;
  const slices = Object.entries(natData).map(([nat, count]) => {
    const pct = count / total;
    const startAngle = cumulativePercent * 360;
    cumulativePercent += pct;
    const endAngle = cumulativePercent * 360;
    return { method: nat, count, pct, startAngle, endAngle, color: natColors[nat] || '#6b7280' };
  });

  const svgPie = createPieSVG(slices);

  container.innerHTML = `
    <div class="pie-chart-container">
      ${svgPie}
      <div class="pie-legend">
        ${Object.entries(natData).map(([nat, count]) => `
          <div class="pie-legend-item">
            <div class="pie-color" style="background:${natColors[nat] || '#6b7280'}"></div>
            <span>${nat}</span>
            <span class="pie-pct">${count}人</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function createPieSVG(slices) {
  if (slices.every(s => s.count === 0)) {
    return '<svg class="pie-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#2a2a45" stroke-width="18"/></svg>';
  }

  let paths = '';
  slices.forEach(slice => {
    if (slice.pct === 0) return;
    if (slice.pct >= 1) {
      paths += `<circle cx="50" cy="50" r="40" fill="none" stroke="${slice.color}" stroke-width="18"/>`;
      return;
    }
    const start = polarToCartesian(50, 50, 40, slice.startAngle - 90);
    const end = polarToCartesian(50, 50, 40, slice.endAngle - 90);
    const largeArc = slice.pct > 0.5 ? 1 : 0;
    paths += `<path d="M ${start.x} ${start.y} A 40 40 0 ${largeArc} 1 ${end.x} ${end.y}" fill="none" stroke="${slice.color}" stroke-width="18"/>`;
  });

  return `<svg class="pie-ring" viewBox="0 0 100 100">${paths}</svg>`;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ==================== SERVICE WORKER REGISTRATION ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
  });
}
