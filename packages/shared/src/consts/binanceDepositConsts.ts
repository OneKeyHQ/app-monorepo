import { ONEKEY_APP_DEEP_LINK_NAME } from './deeplinkConsts';

export const BINANCE_DEPOSIT_API_PREFIX = '/wallet/v1/exchange/binance';

// Return deep link the server hands to Binance:
//   onekey-wallet://binance-connect/deposit-return?rn=<return nonce>
export const BINANCE_DEPOSIT_RETURN_SCHEME = ONEKEY_APP_DEEP_LINK_NAME;
export const BINANCE_DEPOSIT_RETURN_HOST = 'binance-connect';
export const BINANCE_DEPOSIT_RETURN_PATH = 'deposit-return';
export const BINANCE_DEPOSIT_RETURN_NONCE_PARAM = 'rn';

// Session key and return nonce share the server DTO format: 32 random bytes
// as base64url without padding.
export const BINANCE_DEPOSIT_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

// Exact hostname match only: this is where the user authorizes the address.
export const BINANCE_DEPOSIT_LINK_HOST_ALLOWLIST: readonly string[] = [
  'app.binance.com',
  'www.binance.com',
];

// The server confirms an INIT session at most once every 3 seconds.
export const BINANCE_DEPOSIT_RETRY_INTERVAL_MS = 3200;
export const BINANCE_DEPOSIT_POLL_INTERVAL_MS = 5000;
// Bind window after the server froze the destination.
export const BINANCE_DEPOSIT_BIND_WINDOW_MS = 10 * 60 * 1000;
// Session deadline: 30 minutes after create, or the link expiry if earlier.
export const BINANCE_DEPOSIT_SESSION_TTL_MS = 30 * 60 * 1000;

// Client-side codes, never sent by the server; far outside its code range.
export enum EBinanceDepositLocalErrorCode {
  StorageUnavailable = 914_002,
  // No business verdict came back; the retry reuses the same session key.
  RequestFailed = 914_003,
  InvalidState = 914_005,
  // The pre-sign query did not confirm the destination the user saw.
  VerifyFailed = 914_009,
}
