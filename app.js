/* ============================================================
   TigilGastos – app.js
   Vanilla JS + localStorage
   Soroban smart contract functions: simulated
   ============================================================ */

const STATE_KEY = 'tigilgastos_v2';

let state = getDefault();

function getDefault() {
  return {
    goalName: '', goalAmount: 0, targetDate: '',
    totalSaved: 0, isLocked: false, isCompleted: false,
    transactions: [], contractLog: []
  };
}

// ── SMART CONTRACT SIMULATION ────────────────────────────────
const Contract = {
  createGoal(name, amount, date) {
    log(`createGoal("${name}", ₱${fmt(amount)}, "${date}") → OK`, 'init');
  },
  deposit(amount) {
    log(`deposit(₱${fmt(amount)}) → new balance: ₱${fmt(state.totalSaved)}`, 'deposit');
  },
  lock() {
    log(`lock() → jar LOCKED 🔒`, 'lock');
  },
  unlock(reason) {
    log(`unlock("${reason}") → jar UNLOCKED 🔓`, 'unlock');
  },
  claim() {
    const goalOk = state.totalSaved >= state.goalAmount;
    const dateOk = new Date() >= new Date(state.targetDate + 'T00:00:00');
    const ok = goalOk || dateOk;
    const why = goalOk ? 'goal_reached' : dateOk ? 'date_reached' : 'conditions_not_met';
    log(`claim() → ${ok ? 'APPROVED ✓' : 'REJECTED ✗'} [${why}]`, ok ? 'claim' : 'lock');
    return { ok, why };
  }
};

function log(text, type) {
  state.contractLog.push({ text, type });
}

// ── HELPERS ──────────────────────────────────────────────────
function fmt(n) {
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(saved, goal) {
  if (!goal) return 0;
  return Math.min(100, Math.round((saved / goal) * 100));
}
function save() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
function load() {
  try { const s = localStorage.getItem(STATE_KEY); if (s) state = JSON.parse(s); } catch {}
}
function addTx(action, amount, balance) {
  const d = new Date();
  state.transactions.push({
    date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    action, amount, balance
  });
}

// ── DOM ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const setupScreen   = $('setup-screen');
const trackerScreen = $('tracker-screen');
const successBanner = $('success-banner');

// Setup
const goalCategoryInp = $('goal-category');   // ← dropdown
const goalNameInp     = $('goal-name');        // ← custom text (hidden by default)
const goalAmtInp      = $('goal-amount');
const targetDateInp   = $('target-date');
const createBtn       = $('create-btn');
const setupErr        = $('setup-err');
const customGoalField = $('custom-goal-field');

// Tracker display
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

// Actions
const depositAmt  = $('deposit-amt');
const depositBtn  = $('deposit-btn');
const depErr      = $('dep-err');
const lockBtn     = $('lock-btn');
const withdrawBtn = $('withdraw-btn');
const lockErr     = $('lock-err');
const lockDesc    = $('lock-desc');

// Lists
const logList   = $('log-list');
const histBody  = $('hist-body');

const resetBtn = $('reset-btn');

// ── RENDER ───────────────────────────────────────────────────
function render() {
  if (!state.goalAmount) {
    setupScreen.classList.remove('hidden');
    trackerScreen.classList.add('hidden');
    successBanner.classList.add('hidden');
    return;
  }

  setupScreen.classList.add('hidden');
  trackerScreen.classList.remove('hidden');

  // Meta
  dispName.textContent = state.goalName || 'My Savings Jar';
  if (state.targetDate) {
    const d = new Date(state.targetDate + 'T00:00:00');
    dispDate.textContent = '📅 ' + d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    dispDate.style.display = '';
  } else {
    dispDate.style.display = 'none';
  }

  // Chip
  if (state.isCompleted) {
    lockChip.textContent = 'Goal Reached 🎉';
    lockChip.className = 'chip chip-done';
  } else if (state.isLocked) {
    lockChip.textContent = 'Locked 🔒';
    lockChip.className = 'chip chip-locked';
  } else {
    lockChip.textContent = 'Unlocked 🔓';
    lockChip.className = 'chip chip-unlocked';
  }

  // Jar fill
  const p = pct(state.totalSaved, state.goalAmount);
  jarFill.style.height = p + '%';
  jarPct.textContent = p + '%';

  jarFill.className = 'jar-fill' +
    (state.isLocked ? ' locked' : '') +
    (state.isCompleted ? ' completed' : '');

  if (jarVessel) {
    jarVessel.className = 'jar-vessel' +
      (state.isLocked ? ' locked' : '') +
      (state.isCompleted ? ' completed' : '');
  }

  if (jarSlot) {
    jarSlot.className = 'jar-slot' + (state.isLocked ? ' glowing' : '');
  }

  // Progress bar
  progFill.style.width = p + '%';
  progFill.className = 'prog-fill' +
    (state.isLocked ? ' locked' : '') +
    (state.isCompleted ? ' completed' : '');

  // Stats
  const remaining = Math.max(0, state.goalAmount - state.totalSaved);
  statSaved.textContent = '₱' + fmt(state.totalSaved);
  statGoal.textContent = '₱' + fmt(state.goalAmount);
  statLeft.textContent = '₱' + fmt(remaining);
  statSaved.className = 'stat-n' + (state.totalSaved > 0 ? ' gold' : '');

  // Buttons
  if (state.isCompleted) {
    lockBtn.classList.add('hidden');
    withdrawBtn.classList.remove('hidden');
    lockDesc.textContent = '🎉 Goal reached! Tap Withdraw to claim your savings.';
    lockErr.textContent = '';
  } else if (state.isLocked) {
    lockBtn.classList.remove('hidden');
    withdrawBtn.classList.add('hidden');
    lockBtn.textContent = '🔓 Unlock Jar';
    lockBtn.className = 'btn-action btn-purple';
    lockDesc.textContent = 'Jar is locked. Withdrawal blocked until goal or date is reached.';
  } else {
    lockBtn.classList.remove('hidden');
    withdrawBtn.classList.add('hidden');
    lockBtn.textContent = '🔒 Lock Jar';
    lockBtn.className = 'btn-action btn-purple';
    lockDesc.textContent = 'Activate the lock to guard your savings from yourself.';
  }

  // Success banner
  successBanner.classList.toggle('hidden', !state.isCompleted);

  renderLog();
  renderHistory();
}

function renderLog() {
  logList.innerHTML = '';
  if (!state.contractLog.length) return;
  state.contractLog.slice().reverse().forEach(entry => {
    const li = document.createElement('li');
    li.className = `log-item log-${entry.type}`;
    li.textContent = entry.text;
    logList.appendChild(li);
  });
}

function renderHistory() {
  histBody.innerHTML = '';
  if (!state.transactions.length) {
    histBody.innerHTML = '<p class="hist-empty">No transactions yet. Drop your first coin! 🪙</p>';
    return;
  }

  const head = document.createElement('div');
  head.className = 'hist-row hist-head';
  head.innerHTML = `<span>Date</span><span>Action</span><span>Amount</span><span>Balance</span>`;
  histBody.appendChild(head);

  state.transactions.slice().reverse().forEach(tx => {
    const row = document.createElement('div');
    row.className = 'hist-row';
    const isDeposit = tx.action === 'Deposit';
    row.innerHTML = `
      <span class="hist-date">${tx.date}</span>
      <span class="hist-action">${tx.action}</span>
      <span class="${isDeposit ? 'hist-amt-dep' : 'hist-amt-wit'}">${isDeposit ? '+' : '-'}₱${fmt(tx.amount)}</span>
      <span class="hist-balance">₱${fmt(tx.balance)}</span>
    `;
    histBody.appendChild(row);
  });
}

// ── COIN DROP ANIMATION ───────────────────────────────────────
function animateCoinDrop() {
  coinDrop.classList.remove('dropping');
  void coinDrop.offsetWidth;
  coinDrop.classList.add('dropping');
  setTimeout(() => coinDrop.classList.remove('dropping'), 650);
}

// ── ACTIONS ──────────────────────────────────────────────────
function createGoal() {
  setupErr.textContent = '';

  // ── Resolve goal name from dropdown or custom input ──
  const category = goalCategoryInp ? goalCategoryInp.value : '';
  const customName = goalNameInp ? goalNameInp.value.trim() : '';

  let goalName = '';
  if (category === '__custom__') {
    goalName = customName;
  } else {
    goalName = category;
  }

  const amount = parseFloat(goalAmtInp.value);
  const date   = targetDateInp.value;

  if (!goalName)              { setupErr.textContent = 'Please select or enter a savings goal.'; return; }
  if (!amount || amount <= 0) { setupErr.textContent = 'Please enter a valid amount.'; return; }
  if (!date)                  { setupErr.textContent = 'Please select a target date.'; return; }
  if (new Date(date + 'T00:00:00') <= new Date()) {
    setupErr.textContent = 'Target date must be in the future.'; return;
  }

  state = getDefault();
  state.goalName   = goalName;
  state.goalAmount = amount;
  state.targetDate = date;

  Contract.createGoal(goalName, amount, date);
  save();
  render();
}

function deposit() {
  depErr.textContent = '';
  const amount = parseFloat(depositAmt.value);
  if (!amount || amount <= 0) { depErr.textContent = 'Enter a valid amount.'; return; }

  state.totalSaved = Math.round((state.totalSaved + amount) * 100) / 100;
  Contract.deposit(amount);
  addTx('Deposit', amount, state.totalSaved);
  depositAmt.value = '';

  animateCoinDrop();

  if (!state.isCompleted && state.totalSaved >= state.goalAmount) {
    state.isCompleted = true;
    state.isLocked = false;
    Contract.unlock('goal_reached');
    Contract.claim();
  }

  save();
  render();
}

function toggleLock() {
  lockErr.textContent = '';
  if (state.isCompleted) return;

  if (!state.isLocked) {
    state.isLocked = true;
    Contract.lock();
  } else {
    const result = Contract.claim();
    if (result.ok) {
      state.isLocked = false;
      Contract.unlock(result.why);
    } else {
      lockErr.textContent = 'Cannot unlock: goal not reached and date not yet passed.';
    }
  }
  save();
  render();
}

function withdraw() {
  if (!state.isCompleted) {
    lockErr.textContent = 'Withdrawal blocked. Conditions not met.';
    return;
  }
  addTx('Withdrawal', state.totalSaved, 0);
  state.totalSaved = 0;
  state.isCompleted = false;
  state.isLocked = false;
  save();
  render();
}

function resetGoal() {
  if (!confirm('Start a new goal? All current data will be cleared.')) return;
  localStorage.removeItem(STATE_KEY);
  state = getDefault();

  // Reset form fields
  if (goalCategoryInp) goalCategoryInp.value = '';
  if (goalNameInp)     goalNameInp.value = '';
  if (customGoalField) customGoalField.classList.add('hidden');
  goalAmtInp.value    = '';
  targetDateInp.value = '';
  setupErr.textContent = '';

  render();
}

// ── EVENTS ───────────────────────────────────────────────────
createBtn.addEventListener('click', createGoal);
depositBtn.addEventListener('click', deposit);
lockBtn.addEventListener('click', toggleLock);
withdrawBtn.addEventListener('click', withdraw);
resetBtn.addEventListener('click', resetGoal);
depositAmt.addEventListener('keydown', e => { if (e.key === 'Enter') deposit(); });
goalAmtInp.addEventListener('keydown', e => { if (e.key === 'Enter') createGoal(); });

// ── INIT ─────────────────────────────────────────────────────
load();
render();