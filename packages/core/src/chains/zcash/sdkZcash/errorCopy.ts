import { readZcashRuntimeError, zcashErrorAmount } from './runtimeError';

// User-facing wording for the runtime's structured errors.
//
// The runtime deliberately sets `message` to the bare code
// ("INSUFFICIENT_FUNDS") and puts everything human-relevant into params --
// wording is the host's job. Until this surface goes through i18n, the copy
// is hardcoded English like the rest of the zcash UI; a later i18n pass only
// touches this table.
//
// Only codes a USER ACTION can reach get wording. Codes that can only come
// from a caller bug (INVALID_DB_NAME, INVALID_BATCH_SIZE, INVALID_SCAN_PRIORITY,
// ...) intentionally map to null and keep the bare code as their message:
// those are bugs to report, and a friendly sentence would only bury the signal.
//
// Every message here must answer "what do I do now?" -- a wallet that says
// only what went wrong leaves the user with a balance they cannot explain and
// no next step. The two recovery actions actually available on the token
// details page are named literally so the copy matches the buttons: "Sync"
// (foreground catch-up) and "Repair setup" / "Rescan".

function zec(zat: number | null): string | null {
  if (zat === null) return null;
  return (zat / 1e8).toFixed(8).replace(/\.?0+$/, '');
}

export function zcashUserMessage(e: unknown): string | null {
  const err = readZcashRuntimeError(e);
  if (!err) return null;
  switch (err.code) {
    case 'INSUFFICIENT_FUNDS': {
      const short = zec(zcashErrorAmount(e, 'shortfallZat'));
      return short
        ? `Insufficient spendable balance — ${short} ZEC short.`
        : 'Insufficient spendable balance.';
    }
    case 'FUNDS_NEED_SHIELDING': {
      const transparent = zec(zcashErrorAmount(e, 'transparentZat'));
      return transparent
        ? `Not enough shielded balance. ${transparent} ZEC is in the transparent pool — shield it first, then retry.`
        : 'Not enough shielded balance — shield your transparent balance first, then retry.';
    }
    case 'COINBASE_FUNDS_UNSPENDABLE':
      return 'The remaining balance is mining coinbase, which cannot be shielded or spent here yet.';
    case 'NOT_SYNCED':
      return 'Still syncing with the Zcash network — try again in a moment.';
    case 'NETWORK_ERROR':
      return 'Zcash node unreachable — check your connection and try again.';
    case 'BROADCAST_REJECTED':
      return 'The Zcash network rejected this transaction.';
    case 'WALLET_BUSY':
      return 'The Zcash wallet is busy with another operation — try again shortly.';
    case 'INVALID_ADDRESS':
      return 'This is not a valid Zcash address.';
    case 'INVALID_MEMO':
      return 'Memos are only supported when sending to a shielded address.';
    case 'AMOUNT_OUT_OF_RANGE':
      return 'Invalid amount.';

    // ---- setup never finished: one button fixes all three ----
    case 'ACCOUNT_NOT_FOUND':
    case 'INVALID_UFVK':
      return 'This Zcash account has not finished setting up. Open the Zcash pool panel and tap "Repair setup" — it needs your password once.';

    // ---- the wallet exists but is not ready THIS moment ----
    case 'NOT_INITIALIZED':
    case 'WALLET_NOT_OPEN':
      return 'The Zcash wallet is still starting up — wait a moment and try again. If it persists, reopen this screen.';

    // ---- normal chain behavior, not a failure ----
    case 'REORG_DETECTED':
      // The runtime rewinds and rescans on its own; the only wrong thing the
      // user can do here is assume funds were lost.
      return 'The Zcash chain reorganised — recent transactions are being re-checked automatically. Balances may shift slightly; nothing is lost.';

    // ---- send failed while building, funds untouched ----
    case 'PCZT_ERROR':
    case 'TRANSACTION_BUILD_ERROR':
      return 'Could not build this transaction. Nothing was sent and your funds were not touched — wait for syncing to finish, then try again.';

    // ---- local cache broken; it is rebuildable by design ----
    case 'DATABASE_ERROR':
      return 'The local Zcash scan data is unreadable. It is a rebuildable cache — use "Rescan" in the Zcash pool panel to rebuild it. Your funds and keys are unaffected.';

    // ---- misconfiguration: no user action can fix it ----
    case 'LIGHTWALLETD_NOT_CONFIGURED':
      return 'No Zcash node is configured for this build. Please report this — it is not something you can fix.';

    default:
      return null;
  }
}

// The fields the app's error plumbing and the carrier bridges preserve; the
// rewritten error keeps them so structured consumers and logs still see the
// original machine-readable shape -- only the human-facing message changes.
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
  // The standard background proxy only toasts errors that opt in. Without
  // this, a rejection inside a Dialog onConfirm (shield/withdraw) vanished
  // without a trace -- password accepted, then silence.
  out.autoToast = true;
  return out;
}

// For boundaries whose ONLY error surface is the auto-toast (the shield and
// withdraw dialogs have no error UI of their own): make sure even an
// unmapped error is at least visible. Do not use this where a flow renders
// its own errors -- it would double-toast.
export function ensureAutoToast(e: unknown): unknown {
  if (e instanceof Object) {
    (e as Record<string, unknown>).autoToast = true;
  }
  return e;
}
