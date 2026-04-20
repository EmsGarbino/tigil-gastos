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
  ['setup', 'dashboard', 'tracker'].forEach(s => {
    $(`${s}-screen`).classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });
  const titles = { setup: 'New Goal', dashboard: 'My Goals', tracker: 'Jar Detail' };
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
  renderHistory(g);
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

function renderHistory(g) {
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
    }
  });
});

// ── INIT ──────────────────────────────────────────────────────
load();

// Show dashboard if goals exist, else setup
if (goals.length > 0) {
  showScreen('dashboard');
  renderDashboard();
} else {
  showScreen('setup');
}