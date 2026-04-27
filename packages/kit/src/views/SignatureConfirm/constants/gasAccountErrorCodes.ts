// Gas Account submit error codes.
//
// 40200-40213 are defined in the backend tech-spec §7.1 (cross-service codes,
// visible to Premium/Wallet). 40214-40219 and 90xxx are emitted by the backend
// but not yet in the public spec — keep them here as a living contract and
// update once the doc is published.

import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  messageKey: ETranslations;
};

export const GAS_ACCOUNT_ERROR_TABLE: Record<number, IGasAccountErrorEntry> = {
  // --- Refresh: re-estimate to fetch a fresh quote ---
  40_201: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'GAS_ACCOUNT_QUOTE_NOT_FOUND',
    messageKey:
      ETranslations.wallet_gas_sponsor_quote_expired_refreshing_estimate__msg,
  },
  40_202: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'GAS_ACCOUNT_QUOTE_EXPIRED',
    messageKey:
      ETranslations.wallet_gas_sponsor_quote_expired_refreshing_estimate__msg,
  },
  40_209: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'GAS_ACCOUNT_NONCE_CHANGED',
    messageKey:
      ETranslations.wallet_gas_sponsor_nonce_changed_refreshing_estimate__msg,
  },
  90_201: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'UPSTREAM_QUOTE_EXPIRED',
    messageKey:
      ETranslations.wallet_gas_sponsor_quote_expired_refreshing_estimate__msg,
  },
  // Reached only after the client has already exhausted its deep-retry window
  // (see MAX_GAS_ACCOUNT_RETRY_ATTEMPTS in ServiceSend). Treat the final 90212
  // as a stale-quote signal and bounce into a fresh estimate.
  90_212: {
    strategy: EGasAccountErrorStrategy.Refresh,
    alias: 'GAS_ACCOUNT_ADMISSION_OVERLOADED',
    messageKey:
      ETranslations.wallet_gas_sponsor_temporarily_busy_refreshing_estimate__msg,
  },

  // --- Fallback: disable gas account for this flow and re-estimate as user-paid ---
  40_212: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_NETWORK_UNSUPPORTED',
    messageKey:
      ETranslations.wallet_gas_sponsor_network_unsupported_switched_to_network_fee__msg,
  },
  40_213: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_POOL_EXHAUSTED',
    messageKey:
      ETranslations.wallet_gas_sponsor_unavailable_switched_to_network_fee__msg,
  },
  40_218: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_SPONSOR_UNAVAILABLE',
    messageKey:
      ETranslations.wallet_gas_sponsor_unavailable_switched_to_network_fee__msg,
  },
  40_219: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'GAS_ACCOUNT_SPONSOR_UNAVAILABLE',
    messageKey:
      ETranslations.wallet_gas_sponsor_unavailable_switched_to_network_fee__msg,
  },
  90_200: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'UPSTREAM_UNAVAILABLE',
    messageKey:
      ETranslations.wallet_gas_sponsor_unavailable_switched_to_network_fee__msg,
  },
  90_205: {
    strategy: EGasAccountErrorStrategy.Fallback,
    alias: 'UPSTREAM_UNAVAILABLE',
    messageKey:
      ETranslations.wallet_gas_sponsor_unavailable_switched_to_network_fee__msg,
  },

  // --- Hint only: terminal for this attempt, surface to user and dApp ---
  40_203: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_QUOTE_ALREADY_USED',
    messageKey:
      ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
  },
  40_214: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_REQUEST_IN_FLIGHT',
    messageKey:
      ETranslations.wallet_gas_sponsor_request_in_progress_try_again_shortly__msg,
  },
  40_215: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_RATE_LIMITED',
    messageKey:
      ETranslations.wallet_too_many_gas_sponsor_requests_try_again_shortly__msg,
  },
  40_216: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_DAILY_LIMIT_REACHED',
    messageKey: ETranslations.wallet_gas_sponsor_daily_limit_reached__msg,
  },
  40_217: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_SPONSOR_BUSY',
    messageKey: ETranslations.wallet_gas_sponsor_busy_try_again_later__msg,
  },
  // TOCTOU between estimate and execute — scenario gate was open at quote
  // time but revoked by ops before submit. Not equivalent to quote expiry
  // (40201/40202): retrying the gas-account path will keep failing until the
  // scenario is re-enabled, so surface and fall through to user-paid reject.
  40_227: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'GAS_ACCOUNT_SCENARIO_DISABLED',
    messageKey:
      ETranslations.wallet_gas_sponsor_temporarily_disabled_for_transaction_type__msg,
  },
  90_207: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'UPSTREAM_RATE_LIMITED',
    messageKey:
      ETranslations.wallet_too_many_gas_sponsor_requests_try_again_shortly__msg,
  },
  90_208: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'UPSTREAM_DAILY_LIMIT_REACHED',
    messageKey: ETranslations.wallet_gas_sponsor_daily_limit_reached__msg,
  },
  90_209: {
    strategy: EGasAccountErrorStrategy.Hint,
    alias: 'UPSTREAM_SPONSOR_BUSY',
    messageKey: ETranslations.wallet_gas_sponsor_busy_try_again_later__msg,
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
