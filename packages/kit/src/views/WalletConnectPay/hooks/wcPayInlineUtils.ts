import { checkWcPayEvmActionMatchesOrder } from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPayOrderConsistency';
import {
  EWcPayActionMethod,
  type IWcPayAction,
  type IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

export type IWcPayInlinePlan =
  | { mode: 'inline' }
  | {
      mode: 'fallback';
      // Diagnostic text for logs/telemetry only — never render directly to
      // the user; UI must key off `mode`.
      reason: string;
    };

// Failure stages of the inline pipeline. The stage — not the error content —
// drives classification, so the mapping stays stable across vault/RPC error
// shapes (design doc §7).
export type IWcPayInlineStage =
  | 'estimate'
  | 'balance'
  | 'precheck'
  | 'prepare'
  | 'send';

export enum EWcPayInlineFailureKind {
  // transient: inline Retry, then fallback after repeated failure (§7.1)
  FeeEstimateFailed = 'feeEstimateFailed',
  // not transient: guide the user to another option, no blind retry (§7.2)
  InsufficientBalance = 'insufficientBalance',
  // pre-sign blocker outside the two classes above: caller falls back (§3)
  PreSignBlocked = 'preSignBlocked',
  // post-sign: Retry re-enters the recovery machinery, never re-signs (§7.3)
  SendFailed = 'sendFailed',
}

export interface IWcPayInlineFailure {
  kind: EWcPayInlineFailureKind;
  // Diagnostic text for logs/telemetry only — never render directly to the
  // user; UI must key off `kind`.
  message: string;
}

/**
 * Phase 1 gate: inline only a single plain EVM send whose shape matches the
 * approved order; everything else uses the existing confirm-page path. Must
 * never throw — `actions` crosses a trust boundary (server response), and
 * this is the decision layer that never fails.
 */
export function getWcPayInlinePlan({
  actions,
  option,
}: {
  actions: IWcPayAction[];
  option: IWcPayOption | undefined;
}): IWcPayInlinePlan {
  if (!option) {
    return { mode: 'fallback', reason: 'no selected option' };
  }
  if (!Array.isArray(actions) || actions.length !== 1) {
    return {
      mode: 'fallback',
      reason: actions?.length === 0 ? 'no actions' : 'multi-action sequence',
    };
  }
  const action = actions[0];
  const method = action?.walletRpc?.method;
  if (!method) {
    return { mode: 'fallback', reason: 'malformed action' };
  }
  if (method !== EWcPayActionMethod.EthSendTransaction) {
    return { mode: 'fallback', reason: `method ${method}` };
  }
  const consistency = checkWcPayEvmActionMatchesOrder({ action, option });
  if (!consistency.ok) {
    return { mode: 'fallback', reason: consistency.reason };
  }
  return { mode: 'inline' };
}

/**
 * Extracts a human-readable message from an inline-pipeline failure. RPC
 * rejects commonly throw a bare string rather than an `Error`, so that shape
 * is preserved rather than discarded; an `Error` with an empty message falls
 * through to the generic fallback exactly like a missing message would.
 */
function extractWcPayInlineFailureMessage(error: unknown): string {
  if (typeof error === 'string' && error) {
    return error;
  }
  const message = (error as Error | undefined)?.message;
  if (message) {
    return message;
  }
  // copy pending product i18n keys
  return 'Something went wrong';
}

export function classifyWcPayInlineFailure({
  stage,
  error,
}: {
  stage: IWcPayInlineStage;
  error: unknown;
}): IWcPayInlineFailure {
  const message = extractWcPayInlineFailureMessage(error);
  switch (stage) {
    case 'estimate':
      return { kind: EWcPayInlineFailureKind.FeeEstimateFailed, message };
    // Reported by the pipeline AFTER it computes the shortfall itself (this
    // stage has no TxFeeInfo of its own to derive a kind from).
    case 'balance':
      return { kind: EWcPayInlineFailureKind.InsufficientBalance, message };
    // precheck failures are internal/unknown blockers — the EVM base-class
    // precheck is a no-op, so anything reaching this stage is unexpected.
    // Fall back to the confirm page, which owns the mature balance/precheck
    // UI.
    case 'precheck':
      return { kind: EWcPayInlineFailureKind.PreSignBlocked, message };
    case 'send':
      return { kind: EWcPayInlineFailureKind.SendFailed, message };
    case 'prepare':
    default:
      return { kind: EWcPayInlineFailureKind.PreSignBlocked, message };
  }
}
