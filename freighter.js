// ── freighter.js ── Your custom "hook" / wallet module

const FreighterWallet = {
  publicKey: null,
  network: null,
  isConnected: false,
  listeners: [],            // for reactive UI updates

  // Call this to notify UI whenever wallet state changes
  onChange(fn) {
    this.listeners.push(fn);
  },
  _emit() {
    this.listeners.forEach(fn => fn({ ...this }));
  },

  // Check if Freighter extension is installed
  async checkInstalled() {
    if (typeof window.freighterApi === 'undefined') return false;
    const res = await window.freighterApi.isConnected();
    return res.isConnected === true;
  },

  // Connect wallet — prompts user to approve your app
  async connect() {
    const installed = await this.checkInstalled();
    if (!installed) {
      alert('Freighter wallet not found! Please install the browser extension from freighter.app');
      return null;
    }

    const accessObj = await window.freighterApi.requestAccess();
    if (accessObj.error) {
      console.error('Freighter connect error:', accessObj.error);
      return null;
    }

    this.publicKey = accessObj.address;
    this.isConnected = true;

    // Get network too
    const netObj = await window.freighterApi.getNetwork();
    this.network = netObj.network || 'TESTNET';

    this._emit();
    return this.publicKey;
  },

  // Disconnect (just clears local state — Freighter has no logout API)
  disconnect() {
    this.publicKey = null;
    this.isConnected = false;
    this.network = null;
    this._emit();
  },

  // Get a short display version of the wallet address
  shortAddress() {
    if (!this.publicKey) return '';
    return this.publicKey.slice(0, 4) + '...' + this.publicKey.slice(-4);
  },

  // Auto-reconnect if user already approved your app previously
  async autoReconnect() {
    const installed = await this.checkInstalled();
    if (!installed) return;

    const allowed = await window.freighterApi.isAllowed();
    if (allowed.isAllowed) {
      const addrObj = await window.freighterApi.getAddress();
      if (addrObj.address) {
        this.publicKey = addrObj.address;
        this.isConnected = true;
        const netObj = await window.freighterApi.getNetwork();
        this.network = netObj.network || 'TESTNET';
        this._emit();
      }
    }
  },

  // Sign a Soroban transaction XDR (for when you connect real smart contracts)
  async signTransaction(xdr) {
    if (!this.isConnected) {
      console.error('Wallet not connected');
      return null;
    }
    const result = await window.freighterApi.signTransaction(xdr, {
      network: this.network,
    });
    if (result.error) {
      console.error('Sign error:', result.error);
      return null;
    }
    return result.signedTxXdr;
  }
};

export default FreighterWallet;