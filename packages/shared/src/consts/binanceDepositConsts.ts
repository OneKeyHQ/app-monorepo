import {
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TRON,
  IMPL_XRP,
} from '../engine/engineConsts';

import { ONEKEY_APP_DEEP_LINK_NAME } from './deeplinkConsts';

export { EBinanceDepositLocalErrorCode } from '../../types/binanceDeposit';

// The networks the deposit is offered on, whatever the server lists: the ones
// where the amount reaching the Binance address was verified end to end. A
// network joins once that is done for it, so a server config change alone
// cannot expose one the client has not been checked on.
export const BINANCE_DEPOSIT_NETWORK_IMPLS: readonly string[] = [
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TRON,
  IMPL_XRP,
];

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
