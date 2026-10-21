import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

import { readZcashRuntimeError } from './runtimeError';

// User-facing wording for the runtime's error codes; codes only a caller bug can hit map to null on purpose (bare code is the signal).
export function zcashUserMessage(e: unknown): string | null {
  const err = readZcashRuntimeError(e);
  if (!err) return null;
  const text = (id: ETranslations) => appLocale.intl.formatMessage({ id });
  switch (err.code) {
    case 'INSUFFICIENT_FUNDS':
      return appLocale.intl.formatMessage(
        { id: ETranslations.send_error_insufficient_balance },
        { token: 'ZEC' },
      );
    case 'NOT_SYNCED':
    case 'WALLET_BUSY':
    case 'NOT_INITIALIZED':
    case 'WALLET_NOT_OPEN':
      return text(ETranslations.privacy_error_still_syncing__msg);
    case 'NETWORK_ERROR':
      return text(ETranslations.privacy_error_node_unreachable__msg);
    case 'BROADCAST_REJECTED':
      // The node's own words are the only clue to what to change.
      return err.detail
        ? `${text(ETranslations.privacy_error_broadcast_rejected__msg)} (${err.detail})`
        : text(ETranslations.privacy_error_broadcast_rejected__msg);
    case 'BROADCAST_OUTCOME_UNKNOWN':
      // Not "failed": the node may have accepted it.
      return text(ETranslations.privacy_error_broadcast_unknown__msg);
    case 'INVALID_ADDRESS':
      return text(ETranslations.send_address_invalid);
    case 'INVALID_MEMO':
      return text(ETranslations.privacy_memo_shielded_only__msg);
    case 'AMOUNT_OUT_OF_RANGE':
      return text(ETranslations.wallet_bulk_send_error_invalid_amount);
    case 'ACCOUNT_NOT_FOUND':
    case 'INVALID_UFVK':
      return text(ETranslations.privacy_error_setup_incomplete__msg);
    case 'REORG_DETECTED':
      // The runtime rewinds and rescans on its own; nothing is lost.
      return text(ETranslations.privacy_error_reorg__msg);
    case 'PCZT_ERROR':
    case 'TRANSACTION_BUILD_ERROR':
      return text(ETranslations.privacy_error_build_failed__msg);
    case 'DATABASE_ERROR':
      return text(ETranslations.privacy_error_sync_data__msg);
    // Written by a newer app; the runtime refuses it rather than migrate down.
    case 'DATABASE_TOO_NEW':
      return text(ETranslations.database_read_error_update_app__msg);
    case 'LIGHTWALLETD_NOT_CONFIGURED':
      return text(ETranslations.privacy_error_no_node__msg);
    case 'STORAGE_UNSUPPORTED':
      return text(ETranslations.privacy_error_webview_outdated__msg);
    default:
      return null;
  }
}

// Fields the app's error plumbing and carrier bridges preserve, so structured consumers/logs still see the original machine-readable shape.
const KEPT_FIELDS = [
  'code',
  'params',
  'detail',
  'payload',
  'className',
  'key',
  'info',
  'data',
  'autoToast',
] as const;

export function toUserFacingZcashError(e: unknown): unknown {
  const message = zcashUserMessage(e);
  if (!message) return e;
  const out = new Error(message) as Error & Record<string, unknown>;
  const src = e as Record<string, unknown> | null;
  for (const field of KEPT_FIELDS) {
    if (src && src[field] !== undefined) {
      out[field] = src[field];
    }
  }
  if (readZcashRuntimeError(e)?.code === 'INSUFFICIENT_FUNDS') {
    out.key = ETranslations.send_error_insufficient_balance;
    out.info = { token: 'ZEC' };
  }
  // Required: shield/withdraw dialogs have no error UI, so without this a rejection after password entry vanishes silently.
  out.autoToast = true;
  return out;
}

// For boundaries whose only error surface is the auto-toast (shield/withdraw dialogs); don't use where a flow renders its own errors, or it double-toasts.
export function ensureAutoToast(e: unknown): unknown {
  if (e instanceof Object) {
    (e as Record<string, unknown>).autoToast = true;
  }
  return e;
}
