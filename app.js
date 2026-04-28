/* ============================================================
   TigilGastos – app.js  (v3 — multi-goal + Freighter wallet)
   Vanilla JS + localStorage
   Soroban smart contract functions: simulated
   ============================================================ */

const STORE_KEY = 'tigilgastos_v3';

// ── STATE ─────────────────────────────────────────────────────
let goals         = [];
let activeId      = null;
let walletAddress = null;  // connected Freighter public key

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
  localStorage.setItem(STORE_KEY, JSON.stringify({ goals, activeId, walletAddress }));
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data    = JSON.parse(raw);
    goals         = data.goals         || [];
    activeId      = data.activeId      || null;
    walletAddress = data.walletAddress || null;
  } catch {}
}

// ── ACTIVE GOAL ───────────────────────────────────────────────
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
    goalLog(g, `lock() → jar LOCKED 🔒`, 'lock');
  },
  unlock(g, reason) {
    goalLog(g, `unlock("${reason}") → jar UNLOCKED 🔓`, 'unlock');
  },
  claim(g) {
    const goalOk = g.totalSaved >= g.goalAmount;
    const dateOk = new Date() >= new Date(g.targetDate + 'T00:00:00');
    const ok     = goalOk || dateOk;
    const why    = goalOk ? 'goal_reached' : dateOk ? 'date_reached' : 'conditions_not_met';
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
function shortAddr(pk) {
  if (!pk) return '';
  return pk.slice(0, 4) + '…' + pk.slice(-4);
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
const dispName    = $('disp-name');
const dispDate    = $('disp-date');
const lockChip    = $('lock-chip');
const jarFill     = $('jar-fill');
const jarVessel   = document.querySelector('.jar-vessel');
const jarPct      = $('jar-pct');
const jarSlot     = $('jar-slot');
const coinDrop    = $('coin-drop');
const statSaved   = $('stat-saved');
const statGoal    = $('stat-goal');
const statLeft    = $('stat-left');
const progFill    = $('prog-fill');
const depositAmt  = $('deposit-amt');
const depositBtn  = $('deposit-btn');
const depErr      = $('dep-err');
const lockBtn     = $('lock-btn');
const withdrawBtn = $('withdraw-btn');
const lockErr     = $('lock-err');
const lockDesc    = $('lock-desc');
const logList     = $('log-list');
const histBody    = $('hist-body');
const resetBtn    = $('reset-btn');

// Wallet DOM — now correctly maps to sidebar IDs in index.html
const connectBtn      = $('connect-wallet-btn');
const disconnectBtn   = $('disconnect-wallet-btn');
const walletInfo      = $('wallet-info');        // connected state block
const walletBadge     = $('wallet-badge');       // network label e.g. "TESTNET"
const walletAddrEl    = $('wallet-address');     // short address in sidebar
const topbarChip      = $('topbar-wallet-chip'); // compact chip in topbar
const topbarAddrEl    = $('topbar-wallet-addr'); // address in topbar chip
const walletNotice    = $('wallet-notice');      // dashboard banner
const walletNoticeBtn = $('wallet-notice-btn');  // banner connect button
const walletToast     = $('wallet-toast');       // toast notification
const walletToastMsg  = $('wallet-toast-msg');
const walletToastIcon = $('wallet-toast-icon');

// ── WALLET: UI UPDATERS ───────────────────────────────────────
function setWalletUI(connected, network) {
  if (connected && walletAddress) {
    // Sidebar: hide connect button, show info block
    connectBtn?.classList.add('hidden');
    walletInfo?.classList.remove('hidden');
    if (walletBadge)  walletBadge.textContent  = network || 'TESTNET';
    if (walletAddrEl) walletAddrEl.textContent = shortAddr(walletAddress);

    // Topbar chip
    topbarChip?.classList.remove('hidden');
    if (topbarAddrEl) topbarAddrEl.textContent = shortAddr(walletAddress);

    // Dashboard notice: hide it (wallet is connected)
    walletNotice?.classList.add('hidden');
  } else {
    // Sidebar: show connect button, hide info block
    connectBtn?.classList.remove('hidden');
    walletInfo?.classList.add('hidden');

    // Topbar chip: hide
    topbarChip?.classList.add('hidden');

    // Dashboard notice: show it
    walletNotice?.classList.remove('hidden');
  }
}

function showToast(icon, msg, durationMs = 3000) {
  if (!walletToast) return;
  if (walletToastIcon) walletToastIcon.textContent = icon;
  if (walletToastMsg)  walletToastMsg.textContent  = msg;
  walletToast.classList.remove('hidden');
  setTimeout(() => walletToast.classList.add('hidden'), durationMs);
}

// ── WALLET: FREIGHTER HOOK ────────────────────────────────────
// The CDN bundle (v5) exposes the API as window.freighterApi.
// Older bundles used window.StellarFreighterApi — we check both.
// API shape: every function returns an object, e.g. { isConnected: bool }
// or { address: string } or { error: string } on failure.

function getApi() {
  // v5 CDN global name. Fallback to v2 name just in case.
  return window.freighterApi || window.StellarFreighterApi || null;
}

async function connectWallet() {
  const api = getApi();
  if (!api) {
    alert(
      'Freighter extension not found.\n\n' +
      '1. Install it from freighter.app\n' +
      '2. Refresh this page\n' +
      '3. Make sure you are on a local server (not file://)'
    );
    return;
  }

  try {
    // Step 1 — check if extension is installed and unlocked
    const connResult = await api.isConnected();
    // v5 returns { isConnected: bool }, v2 returns bool directly
    const isConn = connResult?.isConnected ?? connResult;
    if (!isConn) {
      alert('Please open Freighter, unlock your wallet, then try again.');
      return;
    }

    // Step 2 — requestAccess() is what actually prompts the user approval popup.
    // getAddress() only works silently AFTER the user has already approved once.
    // So always call requestAccess first.
    let address = null;
    if (typeof api.requestAccess === 'function') {
      const accessResult = await api.requestAccess();
      // requestAccess returns { address } on approval, or { error } on denial
      if (accessResult?.error) {
        alert('Wallet access denied: ' + accessResult.error);
        return;
      }
      address = accessResult?.address || accessResult;
    } else {
      // Older API fallback — getPublicKey was used in v1
      const addrResult = await (api.getAddress?.() || api.getPublicKey?.());
      address = addrResult?.address || addrResult?.publicKey || addrResult;
    }

    if (!address || typeof address !== 'string') {
      alert('Could not get wallet address. Make sure Freighter is unlocked and try again.');
      return;
    }

    // Step 3 — get which network they're on
    const netResult = await api.getNetwork();
    const network   = netResult?.network || netResult || 'TESTNET';

    walletAddress = address;
    save();
    setWalletUI(true, network);
    showToast('🔗', `Connected: ${shortAddr(address)}`);

  } catch (err) {
    console.error('Freighter connect error:', err);
    // Show something useful — err might be a string, Error, or object
    const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    alert('Connection failed: ' + msg);
  }
}

function disconnectWallet() {
  walletAddress = null;
  save();
  setWalletUI(false, null);
  showToast('🔓', 'Wallet disconnected.');
}

// Silently re-verify on page load if a wallet was previously saved
async function autoReconnectWallet() {
  if (!walletAddress) return;           // nothing saved, skip
  const api = getApi();
  if (!api) return;                     // extension not installed, skip silently

  try {
    const connResult = await api.isConnected();
    const isConn = connResult?.isConnected ?? connResult;
    if (!isConn) { disconnectWallet(); return; }

    // Use getAddress (silent — user already approved previously)
    const addrResult = await api.getAddress?.();
    const address = addrResult?.address || addrResult?.publicKey || addrResult;

    if (address && address === walletAddress) {
      const netResult = await api.getNetwork();
      const network   = netResult?.network || netResult || 'TESTNET';
      setWalletUI(true, network);
    } else {
      // Wallet changed or mismatch — clear saved address
      disconnectWallet();
    }
  } catch {
    // Any error during silent reconnect — clear state, don't alert user
    walletAddress = null;
    save();
    setWalletUI(false, null);
  }
}

connectBtn?.addEventListener('click', connectWallet);
disconnectBtn?.addEventListener('click', disconnectWallet);
walletNoticeBtn?.addEventListener('click', connectWallet);  // dashboard banner shortcut

// ── SCREEN SWITCHING ──────────────────────────────────────────
window.showScreen = showScreen;
function showScreen(name) {
  ['setup', 'dashboard', 'tracker', 'history', 'profile'].forEach(s => {
    $(`${s}-screen`)?.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });
  const titles = {
    setup: 'New Goal', dashboard: 'My Goals',
    tracker: 'Jar Detail', history: 'History', profile: 'Profile'
  };
  const titleEl = $('topbar-title');
  if (titleEl) titleEl.textContent = titles[name] || '';

  // BUG FIX: only show "Viewing Jar" nav tab when on tracker screen
  $('nav-tracker')?.classList.toggle('hidden', name !== 'tracker');
}

// ── RENDER: DASHBOARD ─────────────────────────────────────────
function renderDashboard() {
  const grid  = $('goals-grid');
  const empty = $('goals-empty');
  if (!grid) return;
  grid.innerHTML = '';

  // Wallet notice visibility
  setWalletUI(!!walletAddress, null);

  if (!goals.length) {
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  goals.forEach(g => {
    const p    = pct(g.totalSaved, g.goalAmount);
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-card-top">
        <div class="goal-card-name">${g.goalName}</div>
        <span class="chip ${statusClass(g)}">${statusLabel(g)}</span>
      </div>
      <div class="goal-card-date">${
        g.targetDate
          ? new Date(g.targetDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          : ''
      }</div>
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
  if (!g) { showScreen('dashboard'); renderDashboard(); return; }

  if (dispName) dispName.textContent = g.goalName || 'My Savings Jar';

  if (dispDate) {
    if (g.targetDate) {
      dispDate.textContent = new Date(g.targetDate + 'T00:00:00')
        .toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      dispDate.style.display = '';
    } else {
      dispDate.style.display = 'none';
    }
  }

  if (lockChip) {
    lockChip.textContent = statusLabel(g);
    lockChip.className   = 'chip ' + statusClass(g);
  }

  const p = pct(g.totalSaved, g.goalAmount);
  if (jarFill) {
    jarFill.style.height = p + '%';
    jarFill.className    = 'jar-fill' + (g.isLocked ? ' locked' : '') + (g.isCompleted ? ' completed' : '');
  }
  if (jarVessel) jarVessel.className = 'jar-vessel' + (g.isLocked ? ' locked' : '') + (g.isCompleted ? ' completed' : '');
  if (jarSlot)   jarSlot.className   = 'jar-slot'   + (g.isLocked ? ' glowing' : '');
  if (jarPct)    jarPct.textContent  = p + '%';

  if (progFill) {
    progFill.style.width = p + '%';
    progFill.className   = 'prog-fill' + (g.isLocked ? ' locked' : '') + (g.isCompleted ? ' completed' : '');
  }

  const remaining = Math.max(0, g.goalAmount - g.totalSaved);
  if (statSaved) { statSaved.textContent = '₱' + fmt(g.totalSaved); statSaved.className = 'stat-n' + (g.totalSaved > 0 ? ' gold' : ''); }
  if (statGoal)  statGoal.textContent    = '₱' + fmt(g.goalAmount);
  if (statLeft)  statLeft.textContent    = '₱' + fmt(remaining);

  if (g.isCompleted) {
    lockBtn?.classList.add('hidden');
    withdrawBtn?.classList.remove('hidden');
    if (lockDesc) lockDesc.textContent = 'Goal reached! Withdraw to claim your savings.';
    if (lockErr)  lockErr.textContent  = '';
  } else if (g.isLocked) {
    lockBtn?.classList.remove('hidden');
    withdrawBtn?.classList.add('hidden');
    if (lockBtn)  { lockBtn.textContent = 'Unlock Jar'; lockBtn.className = 'btn-action btn-purple'; }
    if (lockDesc) lockDesc.textContent  = 'Jar is locked. Withdrawal blocked until goal or date is reached.';
  } else {
    lockBtn?.classList.remove('hidden');
    withdrawBtn?.classList.add('hidden');
    if (lockBtn)  { lockBtn.textContent = 'Lock Jar'; lockBtn.className = 'btn-action btn-purple'; }
    if (lockDesc) lockDesc.textContent  = 'Activate the lock to guard your savings from yourself.';
  }

  $('success-banner')?.classList.toggle('hidden', !g.isCompleted);

  renderLog(g);
  renderGoalHistory(g);
}

function renderLog(g) {
  if (!logList) return;
  logList.innerHTML = '';
  g.contractLog.slice().reverse().forEach(entry => {
    const li = document.createElement('li');
    li.className   = `log-item log-${entry.type}`;
    li.textContent = entry.text;
    logList.appendChild(li);
  });
}

function renderGoalHistory(g) {
  if (!histBody) return;
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

// ── RENDER: GLOBAL HISTORY SCREEN ────────────────────────────
// BUG FIX: renamed from renderHistory() to renderHistoryScreen()
// to avoid collision with any future local renderHistory calls.
function renderHistoryScreen() {
  const filterEl  = $('history-filter');
  const rowsEl    = $('history-rows');
  const emptyEl   = $('history-empty');
  const tableWrap = $('history-table-wrap');
  if (!filterEl || !rowsEl) return;

  // Rebuild filter dropdown
  const prevVal = filterEl.value || 'all';
  filterEl.innerHTML = '<option value="all">All Goals</option>';
  goals.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.goalName;
    if (g.id === prevVal) opt.selected = true;
    filterEl.appendChild(opt);
  });

  // Collect matching transactions
  const filterGoalId = filterEl.value;
  let allTx = [];
  goals.forEach(g => {
    if (filterGoalId !== 'all' && g.id !== filterGoalId) return;
    g.transactions.forEach(tx => allTx.push({ ...tx, goalName: g.goalName }));
  });

  rowsEl.innerHTML = '';
  if (!allTx.length) {
    emptyEl?.classList.remove('hidden');
    tableWrap?.classList.add('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');
  tableWrap?.classList.remove('hidden');

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
  const user  = (() => { try { return JSON.parse(localStorage.getItem('tg_user'))    || {}; } catch { return {}; } })();
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('tg_profile')) || {}; } catch { return {}; } })();

  const name     = prefs.name || user.email || '?';
  const email    = user.email || '—';
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const avatarEl    = $('profile-avatar');
  const dispNameEl  = $('profile-display-name');
  const dispEmailEl = $('profile-display-email');
  if (avatarEl)    avatarEl.textContent    = initials;
  if (dispNameEl)  dispNameEl.textContent  = prefs.name || 'No name set';
  if (dispEmailEl) dispEmailEl.textContent = email;

  const nameInp   = $('profile-name-inp');
  const emailInp  = $('profile-email-inp');
  const schoolInp = $('profile-school-inp');
  if (nameInp)   nameInp.value   = prefs.name   || '';
  if (emailInp)  emailInp.value  = email;
  if (schoolInp) schoolInp.value = prefs.school || '';

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
      <div class="profile-stat-row"><span>Total Target</span><span class="profile-stat-val">₱${fmt(totalTarget)}</span></div>`;
  }

  $('profile-success')?.classList.add('hidden');
}

function saveProfile() {
  const nameInp   = $('profile-name-inp');
  const schoolInp = $('profile-school-inp');
  const errEl     = $('profile-err');
  const successEl = $('profile-success');

  if (errEl) errEl.textContent = '';
  const name   = nameInp?.value.trim()   || '';
  const school = schoolInp?.value.trim() || '';
  if (!name) { if (errEl) errEl.textContent = 'Please enter your display name.'; return; }

  localStorage.setItem('tg_profile', JSON.stringify({ name, school }));

  const topbarUser = $('topbar-user');
  if (topbarUser) topbarUser.textContent = name;

  const user = (() => { try { return JSON.parse(localStorage.getItem('tg_user')) || {}; } catch { return {}; } })();
  if (typeof window.updateSidebarUser === 'function') window.updateSidebarUser(name, user.email || '');

  successEl?.classList.remove('hidden');
  setTimeout(() => successEl?.classList.add('hidden'), 2500);
  renderProfile();
}

// ── COIN DROP ANIMATION ───────────────────────────────────────
function animateCoinDrop() {
  if (!coinDrop) return;
  coinDrop.classList.remove('dropping');
  void coinDrop.offsetWidth; // force reflow to restart animation
  coinDrop.classList.add('dropping');
  setTimeout(() => coinDrop.classList.remove('dropping'), 650);
}

// ── OPEN GOAL ─────────────────────────────────────────────────
function openGoal(id) {
  activeId = id;
  save();
  showScreen('tracker');
  renderTracker();
}

// ── ACTIONS ───────────────────────────────────────────────────
function createGoal() {
  if (setupErr) setupErr.textContent = '';
  const category   = goalCategoryInp?.value || '';
  const customName = goalNameInp?.value.trim() || '';
  const goalName   = category === '__custom__' ? customName : category;
  const amount     = parseFloat(goalAmtInp?.value);
  const date       = targetDateInp?.value || '';

  if (!goalName)              { if (setupErr) setupErr.textContent = 'Please select or enter a savings goal.'; return; }
  if (!amount || amount <= 0) { if (setupErr) setupErr.textContent = 'Please enter a valid amount.'; return; }
  if (!date)                  { if (setupErr) setupErr.textContent = 'Please select a target date.'; return; }
  if (new Date(date + 'T00:00:00') <= new Date()) { if (setupErr) setupErr.textContent = 'Target date must be in the future.'; return; }

  const g = newGoal(goalName, amount, date);
  Contract.createGoal(g);
  goals.push(g);
  activeId = g.id;

  // Reset form fields
  if (goalCategoryInp) goalCategoryInp.value = '';
  if (goalNameInp)     goalNameInp.value     = '';
  if (customGoalField) customGoalField.classList.add('hidden');
  if (goalAmtInp)      goalAmtInp.value      = '';
  if (targetDateInp)   targetDateInp.value   = '';

  save();
  openGoal(g.id);
}

function deposit() {
  const g = getActive();
  if (!g) return;
  if (depErr) depErr.textContent = '';
  const amount = parseFloat(depositAmt?.value);
  if (!amount || amount <= 0) { if (depErr) depErr.textContent = 'Enter a valid amount.'; return; }

  g.totalSaved = Math.round((g.totalSaved + amount) * 100) / 100;
  Contract.deposit(g, amount);
  addTx(g, 'Deposit', amount, g.totalSaved);
  if (depositAmt) depositAmt.value = '';
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
  if (lockErr) lockErr.textContent = '';

  if (!g.isLocked) {
    g.isLocked = true;
    Contract.lock(g);
  } else {
    const result = Contract.claim(g);
    if (result.ok) {
      g.isLocked = false;
      Contract.unlock(g, result.why);
    } else {
      if (lockErr) lockErr.textContent = 'Cannot unlock: goal not reached and date not yet passed.';
    }
  }
  save();
  renderTracker();
}

function withdraw() {
  const g = getActive();
  if (!g || !g.isCompleted) { if (lockErr) lockErr.textContent = 'Withdrawal blocked. Conditions not met.'; return; }
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
  goals    = goals.filter(x => x.id !== g.id);
  activeId = null;
  save();
  showScreen('dashboard');
  renderDashboard();
}

// ── EVENTS ────────────────────────────────────────────────────
createBtn?.addEventListener('click', createGoal);
depositBtn?.addEventListener('click', deposit);
lockBtn?.addEventListener('click', toggleLock);
withdrawBtn?.addEventListener('click', withdraw);
depositAmt?.addEventListener('keydown', e => { if (e.key === 'Enter') deposit(); });
goalAmtInp?.addEventListener('keydown', e => { if (e.key === 'Enter') createGoal(); });
resetBtn?.addEventListener('click', () => showScreen('setup'));

$('delete-goal-btn')?.addEventListener('click', deleteGoal);
$('profile-save-btn')?.addEventListener('click', saveProfile);
$('profile-name-inp')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveProfile(); });

// BUG FIX: history filter now calls renderHistoryScreen (no name collision)
$('history-filter')?.addEventListener('change', renderHistoryScreen);

$('clear-all-btn')?.addEventListener('click', () => {
  if (!confirm('Delete ALL goals and transactions? This cannot be undone.')) return;
  goals = []; activeId = null;
  save();
  showScreen('dashboard');
  renderDashboard();
});

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const screen = btn.dataset.screen;
    if      (screen === 'dashboard')           { showScreen('dashboard'); renderDashboard(); }
    else if (screen === 'setup')               { showScreen('setup'); }
    else if (screen === 'tracker' && activeId) { showScreen('tracker'); renderTracker(); }
    else if (screen === 'history')             { showScreen('history'); renderHistoryScreen(); }
    else if (screen === 'profile')             { showScreen('profile'); renderProfile(); }
  });
});

// ── INIT ──────────────────────────────────────────────────────
load();

// BUG FIX: if activeId was restored from storage, show the nav tab immediately
if (activeId) {
  $('nav-tracker')?.classList.remove('hidden');
}

// Restore wallet UI from saved state (visual only — no API call yet)
setWalletUI(!!walletAddress, null);

// Then try to silently re-verify with Freighter (async, non-blocking)
autoReconnectWallet();

// Pick the right starting screen
if (goals.length > 0) {
  showScreen('dashboard');
  renderDashboard();
} else {
  showScreen('setup');
}