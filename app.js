/* ============================================================
   TigilGastos – app.js  (multi-goal version)
   ============================================================ */

const STORE_KEY = 'tigilgastos_v3';

// ── STATE ────────────────────────────────────────────────────
let goals      = [];       // array of goal objects
let activeId   = null;     // id of currently viewed goal

function newGoal(name, amount, date) {
  return {
    id: Date.now().toString(),
    goalName: name,
    goalAmount: amount,
    targetDate: date,
    totalSaved: 0,
    isLocked: false,
    isCompleted: false,
    transactions: [],
    contractLog: []
  };
}

// ── PERSISTENCE ───────────────────────────────────────────────
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ goals, activeId }));
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    goals    = data.goals    || [];
    activeId = data.activeId || null;
  } catch {}
}

// ── ACTIVE GOAL SHORTCUT ──────────────────────────────────────
function getActive() {
  return goals.find(g => g.id === activeId) || null;
}

// ── SMART CONTRACT SIMULATION ─────────────────────────────────
const Contract = {
  createGoal(g) {
    goalLog(g, `createGoal("${g.goalName}", ₱${fmt(g.goalAmount)}, "${g.targetDate}") → OK`, 'init');
  },
  deposit(g, amount) {
    goalLog(g, `deposit(₱${fmt(amount)}) → balance: ₱${fmt(g.totalSaved)}`, 'deposit');
  },
  lock(g) {
    goalLog(g, `lock() → jar LOCKED`, 'lock');
  },
  unlock(g, reason) {
    goalLog(g, `unlock("${reason}") → jar UNLOCKED`, 'unlock');
  },
  claim(g) {
    const goalOk = g.totalSaved >= g.goalAmount;
    const dateOk = new Date() >= new Date(g.targetDate + 'T00:00:00');
    const ok  = goalOk || dateOk;
    const why = goalOk ? 'goal_reached' : dateOk ? 'date_reached' : 'conditions_not_met';
    goalLog(g, `claim() → ${ok ? 'APPROVED ✓' : 'REJECTED ✗'} [${why}]`, ok ? 'claim' : 'lock');
    return { ok, why };
  }
};

function goalLog(g, text, type) {
  g.contractLog.push({ text, type });
}

// ── HELPERS ───────────────────────────────────────────────────
function fmt(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(saved, goal) {
  if (!goal) return 0;
  return Math.min(100, Math.round((saved / goal) * 100));
}
function addTx(g, action, amount, balance) {
  g.transactions.push({
    date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    action, amount, balance
  });
}
function statusLabel(g) {
  if (g.isCompleted) return 'Completed';
  if (g.isLocked)    return 'Locked';
  return 'Active';
}
function statusClass(g) {
  if (g.isCompleted) return 'chip-done';
  if (g.isLocked)    return 'chip-locked';
  return 'chip-unlocked';
}

// ── DOM REFS ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Setup form
const goalCategoryInp = $('goal-category');
const goalNameInp     = $('goal-name');
const goalAmtInp      = $('goal-amount');
const targetDateInp   = $('target-date');
const createBtn       = $('create-btn');
const setupErr        = $('setup-err');
const customGoalField = $('custom-goal-field');

// Tracker
const dispName   = $('disp-name');
const dispDate   = $('disp-date');
const lockChip   = $('lock-chip');
const jarFill    = $('jar-fill');
const jarVessel  = document.querySelector('.jar-vessel');
const jarPct     = $('jar-pct');
const jarSlot    = $('jar-slot');
const coinDrop   = $('coin-drop');
const statSaved  = $('stat-saved');
const statGoal   = $('stat-goal');
const statLeft   = $('stat-left');
const progFill   = $('prog-fill');
const depositAmt = $('deposit-amt');
const depositBtn = $('deposit-btn');
const depErr     = $('dep-err');
const lockBtn    = $('lock-btn');
const withdrawBtn= $('withdraw-btn');
const lockErr    = $('lock-err');
const lockDesc   = $('lock-desc');
const logList    = $('log-list');
const histBody   = $('hist-body');
const resetBtn   = $('reset-btn');

// ── SCREEN SWITCHING ──────────────────────────────────────────
window.showScreen = showScreen;
function showScreen(name) {
  ['setup', 'dashboard', 'tracker', 'history', 'profile'].forEach(s => {
    const el = $(`${s}-screen`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });
  const titles = { setup: 'New Goal', dashboard: 'My Goals', tracker: 'Jar Detail', history: 'History', profile: 'Profile' };
  $('topbar-title').textContent = titles[name] || '';

  // Show "Viewing Jar" nav only when tracker is active
  const navTracker = $('nav-tracker');
  if (navTracker) navTracker.classList.toggle('hidden', name !== 'tracker');
}

// ── RENDER: DASHBOARD ─────────────────────────────────────────
function renderDashboard() {
  const grid = $('goals-grid');
  const empty = $('goals-empty');
  grid.innerHTML = '';

  if (!goals.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  goals.forEach(g => {
    const p = pct(g.totalSaved, g.goalAmount);
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-card-top">
        <div class="goal-card-name">${g.goalName}</div>
        <span class="chip ${statusClass(g)}">${statusLabel(g)}</span>
      </div>
      <div class="goal-card-date">${g.targetDate ? new Date(g.targetDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
      <div class="goal-card-bar-wrap">
        <div class="goal-card-bar">
          <div class="goal-card-bar-fill ${g.isLocked ? 'locked' : ''} ${g.isCompleted ? 'completed' : ''}" style="width:${p}%"></div>
        </div>
        <span class="goal-card-pct">${p}%</span>
      </div>
      <div class="goal-card-amounts">
        <span class="goal-card-saved">₱${fmt(g.totalSaved)} saved</span>
        <span class="goal-card-goal">of ₱${fmt(g.goalAmount)}</span>
      </div>
      <button class="goal-card-btn" data-id="${g.id}">View Jar →</button>
    `;
    card.querySelector('.goal-card-btn').addEventListener('click', () => openGoal(g.id));
    grid.appendChild(card);
  });
}

// ── RENDER: TRACKER ───────────────────────────────────────────
function renderTracker() {
  const g = getActive();
  if (!g) { showScreen('dashboard'); return; }

  dispName.textContent = g.goalName || 'My Savings Jar';
  if (g.targetDate) {
    dispDate.textContent = new Date(g.targetDate + 'T00:00:00')
      .toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    dispDate.style.display = '';
  } else {
    dispDate.style.display = 'none';
  }

  // Chip
  lockChip.textContent = statusLabel(g);
  lockChip.className   = 'chip ' + statusClass(g);

  // Jar
  const p = pct(g.totalSaved, g.goalAmount);
  jarFill.style.height = p + '%';
  jarPct.textContent   = p + '%';
  jarFill.className    = 'jar-fill' + (g.isLocked ? ' locked' : '') + (g.isCompleted ? ' completed' : '');
  if (jarVessel) jarVessel.className = 'jar-vessel' + (g.isLocked ? ' locked' : '') + (g.isCompleted ? ' completed' : '');
  if (jarSlot)   jarSlot.className   = 'jar-slot'   + (g.isLocked ? ' glowing' : '');

  // Progress
  progFill.style.width = p + '%';
  progFill.className   = 'prog-fill' + (g.isLocked ? ' locked' : '') + (g.isCompleted ? ' completed' : '');

  // Stats
  const remaining = Math.max(0, g.goalAmount - g.totalSaved);
  statSaved.textContent = '₱' + fmt(g.totalSaved);
  statGoal.textContent  = '₱' + fmt(g.goalAmount);
  statLeft.textContent  = '₱' + fmt(remaining);
  statSaved.className   = 'stat-n' + (g.totalSaved > 0 ? ' gold' : '');

  // Buttons
  if (g.isCompleted) {
    lockBtn.classList.add('hidden');
    withdrawBtn.classList.remove('hidden');
    lockDesc.textContent = 'Goal reached! Withdraw to claim your savings.';
    lockErr.textContent  = '';
  } else if (g.isLocked) {
    lockBtn.classList.remove('hidden');
    withdrawBtn.classList.add('hidden');
    lockBtn.textContent = 'Unlock Jar';
    lockBtn.className   = 'btn-action btn-purple';
    lockDesc.textContent = 'Jar is locked. Withdrawal blocked until goal or date is reached.';
  } else {
    lockBtn.classList.remove('hidden');
    withdrawBtn.classList.add('hidden');
    lockBtn.textContent = 'Lock Jar';
    lockBtn.className   = 'btn-action btn-purple';
    lockDesc.textContent = 'Activate the lock to guard your savings from yourself.';
  }

  $('success-banner').classList.toggle('hidden', !g.isCompleted);

  renderLog(g);
  renderGoalHistory(g);
}

function renderLog(g) {
  logList.innerHTML = '';
  g.contractLog.slice().reverse().forEach(entry => {
    const li = document.createElement('li');
    li.className = `log-item log-${entry.type}`;
    li.textContent = entry.text;
    logList.appendChild(li);
  });
}

function renderGoalHistory(g) {
  histBody.innerHTML = '';
  if (!g.transactions.length) {
    histBody.innerHTML = '<p class="hist-empty">No transactions yet.</p>';
    return;
  }
  const head = document.createElement('div');
  head.className = 'hist-row hist-head';
  head.innerHTML = '<span>Date</span><span>Action</span><span>Amount</span><span>Balance</span>';
  histBody.appendChild(head);
  g.transactions.slice().reverse().forEach(tx => {
    const row = document.createElement('div');
    row.className = 'hist-row';
    const dep = tx.action === 'Deposit';
    row.innerHTML = `
      <span class="hist-date">${tx.date}</span>
      <span class="hist-action">${tx.action}</span>
      <span class="${dep ? 'hist-amt-dep' : 'hist-amt-wit'}">${dep ? '+' : '-'}₱${fmt(tx.amount)}</span>
      <span class="hist-balance">₱${fmt(tx.balance)}</span>`;
    histBody.appendChild(row);
  });
}

function renderHistory() {
  const filterEl  = document.getElementById('history-filter');
  const rowsEl    = document.getElementById('history-rows');
  const emptyEl   = document.getElementById('history-empty');
  const tableWrap = document.getElementById('history-table-wrap');
  if (!filterEl || !rowsEl) return;

  // Rebuild filter dropdown
  const selectedVal = filterEl.value || 'all';
  filterEl.innerHTML = '<option value="all">All Goals</option>';
  goals.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.goalName;
    if (g.id === selectedVal) opt.selected = true;
    filterEl.appendChild(opt);
  });

  const filterGoalId = filterEl.value;
  let allTx = [];
  goals.forEach(g => {
    if (filterGoalId !== 'all' && g.id !== filterGoalId) return;
    g.transactions.forEach(tx => {
      allTx.push({ ...tx, goalName: g.goalName, goalId: g.id });
    });
  });

  rowsEl.innerHTML = '';

  if (!allTx.length) {
    if (emptyEl)   emptyEl.classList.remove('hidden');
    if (tableWrap) tableWrap.classList.add('hidden');
    return;
  }
  if (emptyEl)   emptyEl.classList.add('hidden');
  if (tableWrap) tableWrap.classList.remove('hidden');

  allTx.reverse().forEach(tx => {
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.style.gridTemplateColumns = '0.8fr 1.4fr 1fr 1fr 1fr';
    const dep = tx.action === 'Deposit';
    row.innerHTML = `
      <span class="hist-date">${tx.date}</span>
      <span class="hist-goal-name">${tx.goalName}</span>
      <span class="hist-action">${tx.action}</span>
      <span class="${dep ? 'hist-amt-dep' : 'hist-amt-wit'}">${dep ? '+' : '-'}₱${fmt(tx.amount)}</span>
      <span class="hist-balance">₱${fmt(tx.balance)}</span>`;
    rowsEl.appendChild(row);
  });
}


// ── RENDER: PROFILE ───────────────────────────────────────────
function renderProfile() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('tg_user')) || {}; } catch { return {}; } })();
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('tg_profile')) || {}; } catch { return {}; } })();

  // Avatar initials
  const name  = prefs.name  || user.email || '?';
  const email = user.email  || '—';
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const avatarEl = $('profile-avatar');
  if (avatarEl) avatarEl.textContent = initials;

  const dispName  = $('profile-display-name');
  const dispEmail = $('profile-display-email');
  if (dispName)  dispName.textContent  = prefs.name   || 'No name set';
  if (dispEmail) dispEmail.textContent = email;

  // Pre-fill inputs
  const nameInp   = $('profile-name-inp');
  const emailInp  = $('profile-email-inp');
  const schoolInp = $('profile-school-inp');
  if (nameInp)   nameInp.value   = prefs.name   || '';
  if (emailInp)  emailInp.value  = email;
  if (schoolInp) schoolInp.value = prefs.school || '';

  // Stats summary
  const statList = $('profile-stat-list');
  if (statList) {
    const totalGoals     = goals.length;
    const activeGoals    = goals.filter(g => !g.isCompleted && !g.isLocked).length;
    const completedGoals = goals.filter(g => g.isCompleted).length;
    const lockedGoals    = goals.filter(g => g.isLocked && !g.isCompleted).length;
    const totalSaved     = goals.reduce((s, g) => s + g.totalSaved, 0);
    const totalTarget    = goals.reduce((s, g) => s + g.goalAmount, 0);

    statList.innerHTML = `
      <div class="profile-stat-row"><span>Total Jars</span><span class="profile-stat-val">${totalGoals}</span></div>
      <div class="profile-stat-row"><span>Active</span><span class="profile-stat-val">${activeGoals}</span></div>
      <div class="profile-stat-row"><span>Locked</span><span class="profile-stat-val">${lockedGoals}</span></div>
      <div class="profile-stat-row"><span>Completed</span><span class="profile-stat-val">${completedGoals}</span></div>
      <div class="profile-stat-row"><span>Total Saved</span><span class="profile-stat-val" style="color:var(--gold);">₱${fmt(totalSaved)}</span></div>
      <div class="profile-stat-row"><span>Total Target</span><span class="profile-stat-val">₱${fmt(totalTarget)}</span></div>
    `;
  }

  // Hide success message
  const successEl = $('profile-success');
  if (successEl) successEl.classList.add('hidden');
}

function saveProfile() {
  const nameInp   = $('profile-name-inp');
  const schoolInp = $('profile-school-inp');
  const errEl     = $('profile-err');
  const successEl = $('profile-success');

  errEl.textContent = '';
  const name   = nameInp?.value.trim()   || '';
  const school = schoolInp?.value.trim() || '';

  if (!name) { errEl.textContent = 'Please enter your display name.'; return; }

  const prefs = { name, school };
  localStorage.setItem('tg_profile', JSON.stringify(prefs));

  // Update topbar
  const topbarUser = $('topbar-user');
  if (topbarUser) topbarUser.textContent = name;

  // Update sidebar user card
  const user = (() => { try { return JSON.parse(localStorage.getItem('tg_user')) || {}; } catch { return {}; } })();
  if (typeof window.updateSidebarUser === 'function') {
    window.updateSidebarUser(name, user.email || '');
  }

  successEl.classList.remove('hidden');
  setTimeout(() => successEl.classList.add('hidden'), 2500);

  renderProfile();
}

// ── COIN DROP ─────────────────────────────────────────────────
function animateCoinDrop() {
  coinDrop.classList.remove('dropping');
  void coinDrop.offsetWidth;
  coinDrop.classList.add('dropping');
  setTimeout(() => coinDrop.classList.remove('dropping'), 650);
}

// ── OPEN A GOAL ───────────────────────────────────────────────
function openGoal(id) {
  activeId = id;
  save();
  showScreen('tracker');
  renderTracker();
}

// ── ACTIONS ───────────────────────────────────────────────────
function createGoal() {
  setupErr.textContent = '';
  const category   = goalCategoryInp?.value || '';
  const customName = goalNameInp?.value.trim() || '';
  const goalName   = category === '__custom__' ? customName : category;
  const amount     = parseFloat(goalAmtInp.value);
  const date       = targetDateInp.value;

  if (!goalName)              { setupErr.textContent = 'Please select or enter a savings goal.'; return; }
  if (!amount || amount <= 0) { setupErr.textContent = 'Please enter a valid amount.'; return; }
  if (!date)                  { setupErr.textContent = 'Please select a target date.'; return; }
  if (new Date(date + 'T00:00:00') <= new Date()) { setupErr.textContent = 'Target date must be in the future.'; return; }

  const g = newGoal(goalName, amount, date);
  Contract.createGoal(g);
  goals.push(g);
  activeId = g.id;

  // Reset form
  if (goalCategoryInp) goalCategoryInp.value = '';
  if (goalNameInp)     goalNameInp.value = '';
  if (customGoalField) customGoalField.classList.add('hidden');
  goalAmtInp.value    = '';
  targetDateInp.value = '';

  save();
  openGoal(g.id);
}

function deposit() {
  const g = getActive();
  if (!g) return;
  depErr.textContent = '';
  const amount = parseFloat(depositAmt.value);
  if (!amount || amount <= 0) { depErr.textContent = 'Enter a valid amount.'; return; }

  g.totalSaved = Math.round((g.totalSaved + amount) * 100) / 100;
  Contract.deposit(g, amount);
  addTx(g, 'Deposit', amount, g.totalSaved);
  depositAmt.value = '';
  animateCoinDrop();

  if (!g.isCompleted && g.totalSaved >= g.goalAmount) {
    g.isCompleted = true;
    g.isLocked    = false;
    Contract.unlock(g, 'goal_reached');
    Contract.claim(g);
  }
  save();
  renderTracker();
}

function toggleLock() {
  const g = getActive();
  if (!g || g.isCompleted) return;
  lockErr.textContent = '';
  if (!g.isLocked) {
    g.isLocked = true;
    Contract.lock(g);
  } else {
    const result = Contract.claim(g);
    if (result.ok) {
      g.isLocked = false;
      Contract.unlock(g, result.why);
    } else {
      lockErr.textContent = 'Cannot unlock: goal not reached and date not yet passed.';
    }
  }
  save();
  renderTracker();
}

function withdraw() {
  const g = getActive();
  if (!g || !g.isCompleted) { lockErr.textContent = 'Withdrawal blocked. Conditions not met.'; return; }
  addTx(g, 'Withdrawal', g.totalSaved, 0);
  g.totalSaved  = 0;
  g.isCompleted = false;
  g.isLocked    = false;
  save();
  renderTracker();
}

function deleteGoal() {
  const g = getActive();
  if (!g) return;
  if (!confirm(`Delete "${g.goalName}"? This cannot be undone.`)) return;
  goals = goals.filter(x => x.id !== g.id);
  activeId = null;
  save();
  showScreen('dashboard');
  renderDashboard();
}

// ── EVENTS ────────────────────────────────────────────────────
createBtn.addEventListener('click', createGoal);
depositBtn.addEventListener('click', deposit);
lockBtn.addEventListener('click', toggleLock);
withdrawBtn.addEventListener('click', withdraw);
depositAmt.addEventListener('keydown', e => { if (e.key === 'Enter') deposit(); });
goalAmtInp.addEventListener('keydown', e => { if (e.key === 'Enter') createGoal(); });

resetBtn.addEventListener('click', () => {
  // "Start New Goal" from tracker → go to setup screen
  showScreen('setup');
});

$('delete-goal-btn')?.addEventListener('click', deleteGoal);
$('profile-save-btn')?.addEventListener('click', saveProfile);
$('profile-name-inp')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveProfile(); });
$('history-filter')?.addEventListener('change', renderHistory);
$('clear-all-btn')?.addEventListener('click', () => {
  if (!confirm('Delete ALL goals and transactions? This cannot be undone.')) return;
  goals = []; activeId = null;
  save();
  showScreen('dashboard');
  renderDashboard();
});

// Sidebar nav
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    const screen = btn.dataset.screen;
    if (screen === 'dashboard') {
      showScreen('dashboard');
      renderDashboard();
    } else if (screen === 'setup') {
      showScreen('setup');
    } else if (screen === 'tracker' && activeId) {
      showScreen('tracker');
      renderTracker();
    } else if (screen === 'history') {
      showScreen('history');
      renderHistory();
    } else if (screen === 'profile') {
      showScreen('profile');
      renderProfile();
    }
  });
});

// ── INIT ──────────────────────────────────────────────────────
load();

if (goals.length > 0) {
  showScreen('dashboard');
  renderDashboard();
} else {
  showScreen('setup');
}