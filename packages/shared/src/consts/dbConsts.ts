export const DEFAULT_VERIFY_STRING = 'OneKey';
export const DB_MAIN_CONTEXT_ID = 'mainContext';
export const WALLET_TYPE_HD = 'hd';
export const WALLET_TYPE_HW = 'hw';
export const WALLET_TYPE_QR = 'qr';
export const WALLET_TYPE_IMPORTED = 'imported'; // as walletId
export const WALLET_TYPE_WATCHING = 'watching'; // as walletId
export const WALLET_TYPE_EXTERNAL = 'external'; // as walletId

// Bot wallet constants
export const BOT_WALLET_ID_PREFIX = 'hd-bot--';
export const BOT_WALLET_STATUS_ACTIVE = 'active' as const;
export const BOT_WALLET_STATUS_DEACTIVATED = 'deactivated' as const;

// Wallet number constants for singleton wallets and keyless wallet
// These wallets use fixed walletNo values and don't participate in nextWalletNo increment
export const WALLET_NO_IMPORTED = 1_000_001;
export const WALLET_NO_WATCHING = 1_000_002;
export const WALLET_NO_EXTERNAL = 1_000_003;
export const WALLET_NO_KEYLESS = -1_000_004;
