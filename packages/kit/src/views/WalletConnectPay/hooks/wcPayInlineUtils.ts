import { checkWcPayEvmActionMatchesOrder } from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPayOrderConsistency';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EWcPayActionMethod,
  type IWcPayAction,
  type IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';

// The flow ended without an error to report. Three sources: a user-intent
// cancellation (dismissed a confirm modal or the collect form), a cancel
// signal firing pre-sign (the options page unmounted while the pipeline was
// still preparing), and an inline controller answering 'abort' — a
// system-decided end where the page has already surfaced the reason itself
// (insufficient balance banner) or another component owns the prompt (the
// wallet-backup dialog). Callers should end the flow silently instead of
// surfacing an error toast. Declared in this leaf module so the headless
// pipeline can throw it without importing the executor hook.
export class WcPayUserCancelledError extends OneKeyLocalError {}

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
  | 'backup'
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
  // the wallet has no backup: `checkIsWalletNotBackedUp` has ALREADY shown the
  // backup dialog, so the flow only has to end. Never fall back for this — the
  // confirm page re-shows the same dialog and its submit silently returns,
  // leaving a page the user cannot pay from.
  WalletNotBackedUp = 'walletNotBackedUp',
  // pre-sign blocker outside the classes above: caller falls back (§3)
  PreSignBlocked = 'preSignBlocked',
  // post-sign: Retry re-enters the recovery machinery, never re-signs (§7.3)
  SendFailed = 'sendFailed',
}

export interface IWcPayInlineFailure {
  kind: EWcPayInlineFailureKind;
  // Diagnostic text for logs/telemetry only — never render directly to the
  // user; UI must key off `kind`.
  message: string;
  // Whether re-running the identical attempt is safe and could plausibly
  // succeed. Set by classification, so this is the single source of truth for
  // both the attempts loop and the UI's decision to offer Retry at all.
  retryable: boolean;
}

/**
 * Property set on any error thrown at or after signing. Mirrors the tagged
 * -property convention in `useWcPayActionExecutor` (an error subclass is not
 * usable here: lint caps error classes per file and OneKeyError types `name`).
 *
 * Declared in this leaf module — and re-exported by the pipeline that sets it
 * — so a caller can classify a thrown error without importing the pipeline
 * (and with it `backgroundApiProxy`).
 */
export const WC_PAY_INLINE_POST_SIGN_FLAG = '$$wcPayInlinePostSign';

/**
 * Whether an error was thrown at or after signing. A `true` verdict means a
 * transaction may already be on chain: the caller must route it through the
 * recovery machinery and never re-sign. The flag is a plain own-property and
 * never crosses a serialization boundary, so a plain read is the whole test.
 */
export function isWcPayInlinePostSignError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  return (
    (error as Record<string, unknown>)[WC_PAY_INLINE_POST_SIGN_FLAG] === true
  );
}

/**
 * Progress of the headless pipeline, reported so the inline UI can label the
 * step in flight.
 *
 * - `estimating`: wallet-backup gate, account resolution and fee estimation.
 * - `checking`: balance fetch and the pre-send guards (precheck, preActions,
 *   fee-overflow verify) — two network round-trips that were previously
 *   invisible under `estimating`.
 * - `signing`: covers signing AND broadcasting. `signAndSendTransaction` is a
 *   single atomic background call, so there is no observable moment between
 *   the two; the UI must label this phase accordingly.
 * - `recording`: post-broadcast bookkeeping (signature record, local history).
 *   The transfer is already on its way by the time this is emitted.
 *
 * Declared here rather than beside the pipeline so this module stays a leaf:
 * the attempts loop below speaks the pipeline's vocabulary without importing
 * the pipeline (and with it `backgroundApiProxy`).
 */
export type IWcPayInlinePhase =
  | 'estimating'
  | 'checking'
  | 'signing'
  | 'recording';

// Result contract of `wcPayInlineSendTx`, which re-exports this type. Only the
// non-`ok` variants carry a failure, and both of them are decided by the
// controller below — `fallback` is the pipeline's suggestion, not a verdict.
export type IWcPayInlineSendResult =
  | { status: 'ok'; txid: string }
  | { status: 'fallback'; failure: IWcPayInlineFailure }
  | { status: 'inlineError'; failure: IWcPayInlineFailure };

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
    // The only retryable class — see runWcPayInlineAttempts for the
    // precondition that makes it the only one.
    case 'estimate':
      return {
        kind: EWcPayInlineFailureKind.FeeEstimateFailed,
        message,
        retryable: true,
      };
    // The backup dialog has already been raised by the check itself; the
    // caller must end the flow rather than reroute it (see the kind's note).
    case 'backup':
      return {
        kind: EWcPayInlineFailureKind.WalletNotBackedUp,
        message,
        retryable: false,
      };
    // Reported by the pipeline AFTER it computes the shortfall itself (this
    // stage has no TxFeeInfo of its own to derive a kind from).
    case 'balance':
      return {
        kind: EWcPayInlineFailureKind.InsufficientBalance,
        message,
        retryable: false,
      };
    // precheck failures are internal/unknown blockers — the EVM base-class
    // precheck is a no-op, so anything reaching this stage is unexpected.
    // Fall back to the confirm page, which owns the mature balance/precheck
    // UI.
    case 'precheck':
      return {
        kind: EWcPayInlineFailureKind.PreSignBlocked,
        message,
        retryable: false,
      };
    case 'send':
      return {
        kind: EWcPayInlineFailureKind.SendFailed,
        message,
        retryable: false,
      };
    case 'prepare':
    default:
      return {
        kind: EWcPayInlineFailureKind.PreSignBlocked,
        message,
        retryable: false,
      };
  }
}

/**
 * The inline UI's side of the attempts loop: it observes progress and decides
 * what happens after a failure the pipeline classified as non-fatal.
 */
export interface IWcPayInlineController {
  onPhase: (phase: IWcPayInlinePhase) => void;
  // 'retry' re-runs the attempt (honoured only for a fee-estimate failure —
  // the one transient class), 'fallback' reroutes to the confirm page,
  // 'abort' cancels the payment.
  onInlineFailure: (
    failure: IWcPayInlineFailure,
  ) => Promise<'retry' | 'fallback' | 'abort'>;
  /**
   * Called exactly once whenever the attempts loop resolves to a fallback —
   * whether the controller asked for one or the loop degraded to it on its own
   * (spent retry budget, or a 'retry' answered for a non-retryable failure).
   *
   * The controller's own decision is NOT a reliable signal for this: the
   * exhaustion path never consults it. Anything the UI must do when inline
   * execution ends and the confirm modal takes over belongs here, not in the
   * `onInlineFailure` fallback branch.
   */
  onFallback?: () => void;
  /**
   * Called right before the executor pushes ANY confirm modal — the inline
   * fallback's eth_sendTransaction confirm as well as the typed-data,
   * personal-sign, and Solana branches that never consult the inline plan.
   *
   * The dialog host uses this to park its system-level sheet (iOS SwiftUI
   * .sheet / Android ModalBottomSheet), which would otherwise cover the
   * pushed RN-layer confirm page while itself being non-dismissible during
   * the paying phase — a deadlock. Parking only in `onFallback` is not
   * enough: multi-action sequences and the non-EVM-send branches push
   * confirm modals without ever entering the inline attempts loop.
   * Idempotent; paired with `onAfterConfirmModalSettled`, which fires when
   * that confirm modal resolves either way.
   */
  // May return a promise: the host awaits it so a system sheet has finished
  // dismissing before the RN-layer confirm modal is pushed (pushing while the
  // sheet is still animating out leaves the modal under a stuck sheet).
  onBeforePushConfirmModal?: () => void | Promise<void>;
  /**
   * Called when a confirm modal pushed after `onBeforePushConfirmModal`
   * settles — success, failure, or cancellation alike.
   *
   * The dialog host uses this to reveal its sheet again between actions of a
   * multi-action sequence: Permit2's mined-wait between the approve confirm
   * and the follow-up typed-data confirm can run for minutes, and without
   * this reveal the screen stays blank for that whole stretch (the dialog is
   * parked, the confirm page is gone) while the entry guard silently refuses
   * any new payment scan. The next confirm parks the dialog again via
   * `onBeforePushConfirmModal`; the flow's own finally remains the terminal
   * reveal for every exit path. Reveal is idempotent, so the pairing is safe
   * on single-action sequences too.
   */
  onAfterConfirmModalSettled?: () => void;
}

/**
 * Phase reduction the page applies when a payment attempt ends, whatever the
 * outcome — success, cancellation, or failure.
 *
 * Encodes the one double-pay invariant of the payment page: the result phase
 * is TERMINAL. It is only ever entered once signatures exist, its polling
 * keeps re-submitting confirmPayment, and a page that dropped back to a
 * payable state from there could sign and broadcast a second payment. Every
 * other phase returns to idle.
 *
 * Generic over the caller's phase type so the page keeps its own precise
 * union instead of widening it for this helper; a terminal `prev` is returned
 * by REFERENCE, never rebuilt, so React can bail out of the update.
 */
export function nextWcPayPagePhaseAfterAttempt<T extends { name: string }>(
  prev: T,
): T | { name: 'idle' } {
  return prev.name === 'result' ? prev : { name: 'idle' };
}

export type IWcPayInlineAttemptsOutcome =
  | { status: 'ok'; txid: string }
  | { status: 'fallback' }
  | { status: 'abort' };

// Retry budget of the inline path (design doc §7.1): re-runs only, the first
// attempt is not counted against it.
const WC_PAY_INLINE_DEFAULT_MAX_RETRIES = 2;

/**
 * Drives repeated attempts of the headless send pipeline under the
 * controller's decisions.
 *
 * A returned `fallback` from the pipeline is a suggestion, not a verdict — it
 * goes through the same decision as `inlineError`, because the UI may prefer
 * to abort with an inline banner (insufficient balance) over pushing a confirm
 * page the user cannot resolve there either.
 *
 * `run` rejections are deliberately NOT caught: a post-sign throw (tagged) and
 * a pre-sign throw (untagged) both belong to the caller's recovery machinery,
 * and re-running either here could pay twice.
 */
export async function runWcPayInlineAttempts({
  controller,
  run,
  maxRetries = WC_PAY_INLINE_DEFAULT_MAX_RETRIES,
}: {
  controller: IWcPayInlineController;
  run: () => Promise<IWcPayInlineSendResult>;
  // Cap on retry RE-RUNS (the first attempt is excluded). Exhausting it
  // degrades the next retry decision to a fallback, so a controller that
  // always answers 'retry' cannot spin forever.
  maxRetries?: number;
}): Promise<IWcPayInlineAttemptsOutcome> {
  let retries = 0;
  // Every fallback exit funnels through here, so a new one cannot be added
  // without announcing the transition out of inline execution.
  const resolveFallback = (): IWcPayInlineAttemptsOutcome => {
    controller.onFallback?.();
    return { status: 'fallback' };
  };
  for (;;) {
    const result = await run();
    if (result.status === 'ok') {
      return { status: 'ok', txid: result.txid };
    }
    const decision = await controller.onInlineFailure(result.failure);
    if (decision === 'abort') {
      return { status: 'abort' };
    }
    // Only a fee-estimate-class failure may ever be `retryable`, and that is a
    // deliberate policy (§7.1: fee estimation is the one stage whose failure
    // is plausibly transient — an RPC hiccup a second attempt can clear),
    // reinforced by conservatism: every later stage either reflects a real
    // account state a re-run cannot change, or sits close enough to signing
    // that blind repetition is not worth the risk. It is NOT a consequence of
    // tx mutation — `run()` re-executes against an unsignedTx the background
    // never writes back (updateUnSignedTxBeforeSending clones its input and
    // returns new objects), so a repeat attempt does start from a clean tx.
    // Anyone marking another kind retryable is changing policy, and should
    // re-argue the transience of that stage rather than assume this one.
    if (decision !== 'retry' || !result.failure.retryable) {
      return resolveFallback();
    }
    if (retries >= maxRetries) {
      return resolveFallback();
    }
    retries += 1;
  }
}
