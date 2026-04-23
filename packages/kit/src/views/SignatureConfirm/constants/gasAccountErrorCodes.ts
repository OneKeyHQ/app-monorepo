// Gas Account submit error codes.
//
// 40200-40213 are defined in the backend tech-spec §7.1 (cross-service codes,
// visible to Premium/Wallet). 40214-40219 and 90xxx are emitted by the backend
// but not yet in the public spec — keep them here as a living contract and
// update once the doc is published.

export enum EGasAccountErrorStrategy {
  // Quote/nonce invalidated server-side — silently re-estimate.
  Refresh = 'refresh',
  // Sponsor path unavailable for this attempt — temporarily disable gas
  // account and fall back to user-paid network fee.
  Fallback = 'fallback',
  // Terminal for this attempt — show a toast but do not auto-retry or fall
  // back. Callers should still surface the failure to onFail/dApp callers.
  Hint = 'hint',
}

type IGasAccountErrorEntry = {
  strategy: EGasAccountErrorStrategy;
  // Alias from tech-spec §7.1 when available; otherwise a descriptive tag.
  alias: string;
  // English copy shown in the toast. i18n deferred to a later P2 follow-up.
  message: string;
};

export const GAS_ACCOUNT_ERROR_TABLE: Record<number, IGasAccountErrorEntry> = {
  // --- Refresh: re-estimate to fetch a fresh quote ---
  40_201: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'GAS_ACCOUNT_QUOTE_NOT_FOUND',
    message: 'Gas sponsor quote expired. Refreshing fee estimate.',
  },
  40_202: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'GAS_ACCOUNT_QUOTE_EXPIRED',
    message: 'Gas sponsor quote expired. Refreshing fee estimate.',
  },
  40_209: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'GAS_ACCOUNT_NONCE_CHANGED',
    message: 'Gas sponsor nonce changed. Refreshing fee estimate.',
  },
  90_201: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'UPSTREAM_QUOTE_EXPIRED',
    message: 'Gas sponsor quote expired. Refreshing fee estimate.',
  },

  // --- Fallback: disable gas account for this flow and re-estimate as user-paid ---
  40_212: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_NETWORK_UNSUPPORTED',
    message:
      'Gas sponsor not available on this network. Switched to network fee.',
  },
  40_213: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_POOL_EXHAUSTED',
    message: 'Gas sponsor unavailable. Switched to network fee.',
  },
  40_218: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_SPONSOR_UNAVAILABLE',
    message: 'Gas sponsor unavailable. Switched to network fee.',
  },
  40_219: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_SPONSOR_UNAVAILABLE',
    message: 'Gas sponsor unavailable. Switched to network fee.',
  },
  90_200: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'UPSTREAM_UNAVAILABLE',
    message: 'Gas sponsor unavailable. Switched to network fee.',
  },
  90_205: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'UPSTREAM_UNAVAILABLE',
    message: 'Gas sponsor unavailable. Switched to network fee.',
  },

  // --- Hint only: terminal for this attempt, surface to user and dApp ---
  40_203: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_QUOTE_ALREADY_USED',
    message: 'Transaction may already have been submitted. Check activity.',
  },
  40_214: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_REQUEST_IN_FLIGHT',
    message:
      'A gas sponsor request is already in progress. Please try again shortly.',
  },
  40_215: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_RATE_LIMITED',
    message: 'Too many gas sponsor requests. Please try again shortly.',
  },
  40_216: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_DAILY_LIMIT_REACHED',
    message: 'Gas sponsor limit reached for today.',
  },
  40_217: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_SPONSOR_BUSY',
    message: 'Gas sponsor is busy right now. Please try again later.',
  },
  90_207: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'UPSTREAM_RATE_LIMITED',
    message: 'Too many gas sponsor requests. Please try again shortly.',
  },
  90_208: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'UPSTREAM_DAILY_LIMIT_REACHED',
    message: 'Gas sponsor limit reached for today.',
  },
  90_209: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'UPSTREAM_SPONSOR_BUSY',
    message: 'Gas sponsor is busy right now. Please try again later.',
  },
};

export function getGasAccountErrorEntry(
  code: number | undefined,
): IGasAccountErrorEntry | undefined {
  if (typeof code !== 'number') {
    return undefined;
  }
  return GAS_ACCOUNT_ERROR_TABLE[code];
}
