'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────
const HORIZON_URL    = 'https://horizon-testnet.stellar.org';
const NETWORK_PASS   = 'Test SDF Network ; September 2015'; 
const FRIENDBOT_URL  = 'https://friendbot.stellar.org';

function getSdk() {
  if (typeof window.StellarSdk === 'undefined') {
    throw new Error('Stellar SDK not loaded. Make sure the CDN script is included.');
  }
  return window.StellarSdk;
}

function getServer() {
  const Sdk = getSdk();
  return new Sdk.Horizon.Server(HORIZON_URL);
}

function getApi() {
  return window.freighterApi || window.StellarFreighterApi || null;
}

// ── WALLET STATE ──────────────────────────────────────────────
const Wallet = {
  publicKey: null,
  network:   null,
  xlmBalance: null,
  listeners: [],

  onChange(fn) { this.listeners.push(fn); },
  _emit()      { this.listeners.forEach(fn => fn({ ...this })); },

  shortKey() {
    if (!this.publicKey) return '';
    return this.publicKey.slice(0, 6) + '…' + this.publicKey.slice(-6);
  },

  isConnected() { return !!this.publicKey; }
};

// ── HELPERS ───────────────────────────────────────────────────
function shortAddr(pk) {
  if (!pk) return '';
  return pk.slice(0, 6) + '…' + pk.slice(-6);
}

// ── 1. WALLET SETUP + 2. CONNECT ─────────────────────────────
/**
 * connectWallet()
 * - Checks Freighter is installed and unlocked
 * - Calls requestAccess() to show the approval popup
 * - Confirms we're on Testnet
 * - Fetches balance immediately after connecting
 */
async function connectWallet() {
  const api = getApi();
  if (!api) {
    showTxResult('error',
      'Freighter not found.',
      'Install the Freighter browser extension from freighter.app, then refresh.'
    );
    return null;
  }

  try {
    // Check extension is installed and wallet is unlocked
    const connResult  = await api.isConnected();
    const isConnected = connResult?.isConnected ?? connResult;
    if (!isConnected) {
      showTxResult('error',
        'Freighter is locked.',
        'Open the Freighter extension, enter your password, then try again.'
      );
      return null;
    }

    // Request access — this shows the Freighter approval popup
    let address;
    if (typeof api.requestAccess === 'function') {
      const result = await api.requestAccess();
      if (result?.error) {
        showTxResult('error', 'Access denied.', result.error);
        return null;
      }
      address = result?.address || result;
    } else {
      const result = await (api.getAddress?.() || api.getPublicKey?.());
      address = result?.address || result?.publicKey || result;
    }

    if (!address || typeof address !== 'string' || address.length < 10) {
      showTxResult('error', 'Could not get address.', 'Make sure Freighter is unlocked.');
      return null;
    }

    // Get network and warn if not testnet
    const netResult = await api.getNetwork();
    const network   = netResult?.network || netResult || 'TESTNET';

    if (!network.toLowerCase().includes('test')) {
      showTxResult('warn',
        'Wrong network.',
        `You are on "${network}". Please switch Freighter to Testnet in Settings → Network.`
      );
      // Still proceed so user can see the issue in the UI
    }

    Wallet.publicKey = address;
    Wallet.network   = network;
    Wallet._emit();

    // Fetch balance immediately
    await fetchBalance();

    return address;

  } catch (err) {
    console.error('[Stellar] Connect error:', err);
    showTxResult('error', 'Connection failed.', err?.message || String(err));
    return null;
  }
}

// ── 2. DISCONNECT ─────────────────────────────────────────────
function disconnectWallet() {
  Wallet.publicKey  = null;
  Wallet.network    = null;
  Wallet.xlmBalance = null;
  Wallet._emit();
}

// ── 2. AUTO-RECONNECT ─────────────────────────────────────────
/**
 * Called on page load if a saved publicKey exists.
 * Uses getAddress() silently (no popup).
 */
async function autoReconnect(savedPublicKey) {
  if (!savedPublicKey) return;
  const api = getApi();
  if (!api) return;

  try {
    const connResult  = await api.isConnected();
    const isConnected = connResult?.isConnected ?? connResult;
    if (!isConnected) return;

    const addrResult = await api.getAddress?.();
    const address    = addrResult?.address || addrResult?.publicKey || addrResult;

    if (address && address === savedPublicKey) {
      const netResult = await api.getNetwork();
      Wallet.publicKey = address;
      Wallet.network   = netResult?.network || 'TESTNET';
      Wallet._emit();
      await fetchBalance();
    }
  } catch (err) {
    console.warn('[Stellar] Auto-reconnect failed:', err);
  }
}

// ── 3. FETCH XLM BALANCE ──────────────────────────────────────
/**
 * Queries Horizon for the account's native XLM balance.
 * Updates Wallet.xlmBalance and fires listeners.
 */
async function fetchBalance() {
  if (!Wallet.publicKey) return null;

  try {
    const server  = getServer();
    const account = await server.loadAccount(Wallet.publicKey);
    const native  = account.balances.find(b => b.asset_type === 'native');
    const balance = native ? parseFloat(native.balance).toFixed(7) : '0.0000000';

    Wallet.xlmBalance = balance;
    Wallet._emit();
    return balance;

  } catch (err) {
    // Account might not exist on testnet yet — that's okay
    if (err?.response?.status === 404) {
      Wallet.xlmBalance = 'Account not funded';
      Wallet._emit();
      return null;
    }
    console.error('[Stellar] Balance fetch error:', err);
    Wallet.xlmBalance = 'Error';
    Wallet._emit();
    return null;
  }
}

// ── 4. SEND XLM TRANSACTION ───────────────────────────────────
/**
 * sendPayment(destination, amount, memo)
 *
 * Full flow:
 *   1. Validate inputs
 *   2. Load sender account from Horizon
 *   3. Fetch base fee
 *   4. Build transaction XDR
 *   5. Send XDR to Freighter for signing
 *   6. Submit signed XDR to Horizon
 *   7. Show success + tx hash, or error
 */
async function sendPayment(destination, amount, memo = '') {
  if (!Wallet.publicKey) {
    showTxResult('error', 'Not connected.', 'Connect your Freighter wallet first.');
    return { ok: false };
  }

  const api = getApi();
  if (!api) {
    showTxResult('error', 'Freighter not found.', 'Install the Freighter extension.');
    return { ok: false };
  }

  // ── Input validation ────────────────────────────────────────
  const Sdk = getSdk();

  if (!destination || destination.trim().length === 0) {
    showTxResult('error', 'Missing destination.', "Enter the recipient's Stellar address.");
    return { ok: false };
  }

  let destKey;
  try {
    // Validate Stellar public key format (must start with G and be 56 chars)
    destKey = destination.trim();
    Sdk.Keypair.fromPublicKey(destKey); // throws if invalid
  } catch {
    showTxResult('error', 'Invalid address.', 'The destination must be a valid Stellar public key (starts with G).');
    return { ok: false };
  }

  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    showTxResult('error', 'Invalid amount.', 'Enter an amount greater than 0.');
    return { ok: false };
  }
  if (amtNum < 0.0000001) {
    showTxResult('error', 'Amount too small.', 'Minimum is 0.0000001 XLM.');
    return { ok: false };
  }

  // Show loading state
  showTxResult('loading', 'Sending…', 'Building your transaction. Freighter will ask you to approve it.');

  try {
    const server = getServer();

    // 1. Load sender account (gets sequence number)
    let sourceAccount;
    try {
      sourceAccount = await server.loadAccount(Wallet.publicKey);
    } catch (err) {
      if (err?.response?.status === 404) {
        showTxResult('error',
          'Account not found.',
          'Your account doesn\'t exist on Testnet yet. Fund it with Friendbot first.'
        );
        return { ok: false };
      }
      throw err;
    }

    // 2. Fetch current base fee
    const fee = await server.fetchBaseFee();

    // 3. Build transaction
    let txBuilder = new Sdk.TransactionBuilder(sourceAccount, {
      fee:               String(fee),
      networkPassphrase: NETWORK_PASS,
    })
    .addOperation(
      Sdk.Operation.payment({
        destination: destKey,
        asset:       Sdk.Asset.native(),
        amount:      amtNum.toFixed(7),
      })
    )
    .setTimeout(180); // 3 minutes

    // Optional memo (max 28 bytes for text memo)
    if (memo && memo.trim().length > 0) {
      txBuilder = txBuilder.addMemo(Sdk.Memo.text(memo.trim().slice(0, 28)));
    }

    const transaction = txBuilder.build();

    // 4. Serialize to XDR and send to Freighter for signing
    const xdr = transaction.toXDR();

    showTxResult('loading', 'Waiting for approval…', 'Check the Freighter popup and click Approve.');

    let signedXdr;
    try {
      const signResult = await api.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASS,
        network: 'TESTNET',
      });

      if (signResult?.error) {
        showTxResult('error', 'Signing failed.', signResult.error);
        return { ok: false };
      }

      // v5 returns { signedTxXdr }, older versions return the XDR string directly
      signedXdr = signResult?.signedTxXdr || signResult;
    } catch (signErr) {
      // User rejected the transaction in Freighter
      const msg = signErr?.message || String(signErr);
      if (msg.toLowerCase().includes('user declined') || msg.toLowerCase().includes('rejected')) {
        showTxResult('error', 'Transaction cancelled.', 'You declined the transaction in Freighter.');
      } else {
        showTxResult('error', 'Signing error.', msg);
      }
      return { ok: false };
    }

    showTxResult('loading', 'Submitting…', 'Sending your transaction to the Stellar Testnet.');

    // 5. Submit signed transaction to Horizon
    const signedTx = Sdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASS);
    const result   = await server.submitTransaction(signedTx);

    const txHash = result.hash;

    // 6. Show success with tx hash and explorer link
    showTxResult('success',
      'Transaction sent! 🎉',
      `${amtNum.toFixed(7)} XLM sent to ${shortAddr(destKey)}`,
      txHash
    );

    // Refresh balance after a short delay (allow network to confirm)
    setTimeout(() => fetchBalance(), 3000);

    return { ok: true, hash: txHash, result };

  } catch (err) {
    console.error('[Stellar] Transaction error:', err);

    // Parse Horizon error details
    let errMsg = err?.message || String(err);
    const extras = err?.response?.data?.extras;
    if (extras?.result_codes) {
      const codes = extras.result_codes;
      if (codes.transaction === 'tx_insufficient_balance') {
        errMsg = 'Insufficient XLM balance (remember: 1 XLM minimum reserve required).';
      } else if (codes.operations?.includes('op_no_destination')) {
        errMsg = 'Destination account doesn\'t exist on Testnet. They need to be funded first.';
      } else {
        errMsg = JSON.stringify(codes);
      }
    }

    showTxResult('error', 'Transaction failed.', errMsg);
    return { ok: false, error: errMsg };
  }
}

// ── FRIENDBOT: Fund testnet account ───────────────────────────
/**
 * Uses the Stellar SDK's built-in friendbot helper.
 * fetch() to friendbot.stellar.org is blocked by CORS in browsers —
 * server.friendbot(pk).call() routes it correctly through the SDK.
 */
async function fundWithFriendbot(publicKey) {
  const pk = publicKey || Wallet.publicKey;
  if (!pk) {
    showFriendbotResult('error', 'No wallet connected. Connect Freighter first.');
    return;
  }
  try {
    showFriendbotResult('loading', 'Requesting 10,000 test XLM from Friendbot…');
    const server = getServer();
    await server.friendbot(pk).call();
    showFriendbotResult('success', 'Account funded! You received 10,000 test XLM.');
    setTimeout(() => fetchBalance(), 2000);
  } catch (err) {
    // createAccount error = already funded (400 with op_already_exists)
    const detail = err?.response?.data?.detail || err?.message || String(err);
    if (detail.toLowerCase().includes('already') ||
        err?.response?.status === 400) {
      showFriendbotResult('warn', 'Account already funded. Balance refreshing…');
      setTimeout(() => fetchBalance(), 1500);
    } else {
      showFriendbotResult('error', 'Friendbot failed: ' + detail);
    }
  }
}

/**
 * showFriendbotResult — shows feedback in the sidebar wallet block,
 * NOT inside the Send modal (which may be closed).
 */
function showFriendbotResult(type, message) {
  // Also fire showTxResult in case modal is open
  const txPanel = document.getElementById('tx-result');
  if (txPanel && !txPanel.closest('.modal-overlay.hidden')) {
    showTxResult(type, type === 'success' ? 'Funded!' : type === 'warn' ? 'Note' : 'Error', message);
  }

  // Always update the sidebar friendbot status element
  let el = document.getElementById('friendbot-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'friendbot-status';
    el.className = 'friendbot-status';
    const btn = document.getElementById('friendbot-btn');
    if (btn) btn.insertAdjacentElement('afterend', el);
    else return;
  }

  const icons = { loading: '⏳', success: '✅', error: '❌', warn: '⚠️' };
  el.className = `friendbot-status friendbot-status-${type}`;
  el.textContent = `${icons[type] || ''} ${message}`;

  // Auto-hide after 5 seconds for success/warn
  if (type === 'success' || type === 'warn') {
    setTimeout(() => { if (el) el.textContent = ''; }, 5000);
  }
}

// ── UI FEEDBACK: Transaction result display ───────────────────
/**
 * showTxResult(type, title, message, txHash)
 * type: 'loading' | 'success' | 'error' | 'warn'
 *
 * Updates the #tx-result panel inside the Send XLM modal.
 */
function showTxResult(type, title, message, txHash = null) {
  const panel = document.getElementById('tx-result');
  if (!panel) return;

  const icons = { loading: '⏳', success: '✅', error: '❌', warn: '⚠️' };
  const classes = {
    loading: 'tx-result-loading',
    success: 'tx-result-success',
    error:   'tx-result-error',
    warn:    'tx-result-warn',
  };

  const explorerLink = txHash
    ? `<a class="tx-hash-link"
          href="https://testnet.stellarchain.io/transactions/${txHash}"
          target="_blank" rel="noopener noreferrer">
         View on Explorer ↗
       </a>
       <div class="tx-hash-val">${txHash}</div>`
    : '';

  panel.className    = `tx-result ${classes[type] || ''}`;
  panel.innerHTML    = `
    <span class="tx-result-icon">${icons[type] || '•'}</span>
    <div class="tx-result-body">
      <strong>${title}</strong>
      <p>${message}</p>
      ${explorerLink}
    </div>
  `;
  panel.classList.remove('hidden');
}

window.StellarWallet = {
  Wallet,
  connectWallet,
  disconnectWallet,
  autoReconnect,
  fetchBalance,
  sendPayment,
  fundWithFriendbot,
  shortAddr,
};