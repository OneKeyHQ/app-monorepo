// cspell:ignore spoofer DISPLAYABILITY
import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  extractWcPayPersonalSignMessage,
  extractWcPayTypedDataMessage,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/evmPayUtils';
import {
  WC_PAY_SOLANA_TX_MAX_BYTES,
  extractWcPaySolanaTransaction,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/solPayUtils';
import {
  type IWcPayResolvedToken,
  type IWcPayTypedDataSummary,
  WC_PAY_PERMIT_MAX_DEADLINE_S,
  checkWcPayTypedDataMatchesOrder,
  readWcPayPermitTokenAddress,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPayMessageConsistency';
import { checkWcPayEvmActionMatchesOrder } from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPayOrderConsistency';
// Type-only, and it must stay that way: the module it names decodes
// transactions with @solana/web3.js, which must not enter this (UI) bundle —
// the check itself runs in the background
// (ServiceWalletConnectPay.checkSolanaTxMatchesOrder) and its verdict is
// handed to getWcPayInlineSolanaPlan below.
import type {
  IWcPaySolanaConsistencyResult,
  IWcPaySolanaSummary,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPaySolanaConsistency';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
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
  | {
      mode: 'inline';
      // which calldata shape the consistency check proved: a transfer spends
      // the order amount (budget-charged), an approve only enables the later
      // permit (never charged, and gated on the executor's registry proof)
      kind: 'transfer' | 'approve';
    }
  | {
      mode: 'fallback';
      // Diagnostic text for logs/telemetry only — never render directly to
      // the user; UI must key off `mode`.
      reason: string;
    };

// Same contract as IWcPayInlinePlan, plus the proven payload the inline UI
// needs to describe what is being signed (`reason` stays diagnostic-only).
export type IWcPayInlineMessagePlan =
  | { mode: 'inline'; summary: IWcPayTypedDataSummary }
  | { mode: 'fallback'; reason: string };

export type IWcPayInlineSolanaPlan =
  | { mode: 'inline'; summary: IWcPaySolanaSummary; txBase64: string }
  | { mode: 'fallback'; reason: string };

// What the sheet shows for a personal_sign action: the human-readable decode
// of exactly the bytes that will be signed. There is no order proof behind it
// (the message is arbitrary server content) — the DISPLAY is the contract,
// which is why the gate below refuses anything it cannot faithfully render.
export interface IWcPayPersonalSignSummary {
  text: string;
}

// What the sheet shows while the Permit2 approve leg runs its send pipeline.
export interface IWcPayApproveSummary {
  symbol: string;
  unlimited: boolean;
}

export type IWcPayInlinePersonalSignPlan =
  | {
      mode: 'inline';
      summary: IWcPayPersonalSignSummary;
      // the normalized message (autoFixPersonalSignMessage output) the
      // pipeline must sign — kept beside its decode so the two cannot drift
      message: string;
    }
  | { mode: 'fallback'; reason: string };

// The proven payload behind an in-sheet signing summary, tagged so one hook
// serves every signing kind.
export type IWcPayInlineSigningSummary =
  | { kind: 'typedData'; summary: IWcPayTypedDataSummary }
  | { kind: 'solana'; summary: IWcPaySolanaSummary }
  | { kind: 'personalSign'; summary: IWcPayPersonalSignSummary }
  | { kind: 'approve'; summary: IWcPayApproveSummary };

// What the UI must ask the background to check, once the action's method and
// params alone prove it is a Solana payment request.
export type IWcPayInlineSolanaRequest =
  | { mode: 'request'; txBase64: string; caip2ChainId: string }
  | { mode: 'fallback'; reason: string };

/**
 * Sequence-level spend budget (design doc §3.1 invariant 1). Every action
 * this layer can inline moves or authorizes the FULL order amount — a
 * transfer, a Permit2 signature, a Solana payment — so a legitimate sequence
 * contains exactly one of them. The executor keeps one counter per call;
 * once it is spent every later inline-shaped action falls back to its
 * confirm page, where the user can still refuse it. This is what closes the
 * "N equal transfers → N headless broadcasts" widening that dropping the
 * old single-action gate would otherwise open.
 */
export const WC_PAY_MAX_INLINE_SPENDS_PER_SEQUENCE = 1;

/**
 * Hard ceiling on how many actions one payment sequence may carry (Phase 3
 * §7). A legitimate payment never approaches it; a hostile 100-action
 * sequence must fail outright rather than get a confirm page per action as
 * a "fallback" griefing surface — so the executor THROWS on excess instead
 * of falling back.
 */
export const WC_PAY_MAX_ACTIONS_PER_SEQUENCE = 8;

/**
 * How many approve broadcasts a sequence may inline. An approve is not a
 * spend (it only enables the later permit, and is pinned to Permit2 + the
 * order token), so it stays outside the spend budget — but without a bound
 * of its own, a hostile sequence could burn gas on one headless approve per
 * remaining action slot. A legitimate Permit2 flow needs exactly one.
 */
export const WC_PAY_MAX_INLINE_APPROVES_PER_SEQUENCE = 1;

/**
 * How many personal_sign signatures a sequence may inline. A message
 * signature is not a spend (it moves nothing on its own) so it stays outside
 * the spend budget — but without a bound of its own a hostile sequence could
 * sign out one arbitrary EIP-191 message per remaining action slot, each
 * shown for the display dwell only and never clicked: sign-in challenges
 * and off-chain authorizations, not payment artifacts. A legitimate payment
 * needs at most one.
 */
export const WC_PAY_MAX_INLINE_PERSONAL_SIGNS_PER_SEQUENCE = 1;

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
 * How a user declines a headless signature: dismissing the password/passcode
 * prompt (`servicePassword.promptPasswordVerifyByAccount` rejects with
 * `PasswordPromptDialogCancel`), closing the AirGap QR dialog
 * (`AirGapQrcodeDialogContainer` rejects with `SecureQRCodeDialogCancel`), or
 * refusing/interrupting on the hardware device.
 *
 * Matched on error class and hardware code — NEVER on message text, which is
 * localized and vendor-supplied, so a device that phrases its refusal
 * differently would silently become a "real" failure and a plain failure that
 * happens to read like a rejection would silently become a cancellation.
 * Anything not on these lists is a real failure and must keep its identity.
 *
 * The class/code sets mirror the abort classification in
 * `ServiceBatchCreateAccount` (its "unplug device" and "password cancel"
 * branches), minus `DeviceNotFound` — a vanished device is a fault to report,
 * not a decision the user made.
 *
 * Lives in this leaf module because every headless signing leg (typed data,
 * Solana sign-only) has to draw the same line, and a second copy of this list
 * would be free to drift. Pure like the rest of the module: it reads the error
 * only, and reaches for no service.
 */
export function isWcPayInlineUserCancel(error: unknown): boolean {
  if (
    errorUtils.isErrorByClassName({
      error,
      className: [
        EOneKeyErrorClassNames.PasswordPromptDialogCancel,
        EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
        // Must be matched by class, not by its code. `UserCancelFromOutside`
        // overrides `className`, and the `$isHardwareError` own property that
        // would otherwise identify it survives neither `toPlainErrorObject`
        // nor the JsBridge serializer — so once the rejection crosses from bg
        // to main on iOS, Android or the extension, nothing marks it as a
        // hardware error and the code list below is never consulted. The
        // codes still cover the single-runtime case (desktop, web) and every
        // hardware error that keeps the base className.
        EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
      ],
    })
  ) {
    return true;
  }
  // `isHardwareErrorByCode` answers `undefined` for a missing error rather
  // than `false`, so the verdict is narrowed here instead of leaking out.
  return Boolean(
    isHardwareErrorByCode({
      error: error as IOneKeyError | undefined,
      code: [
        HardwareErrorCode.ActionCancelled,
        HardwareErrorCode.PinCancelled,
        HardwareErrorCode.CallQueueActionCancelled,
        // The device stopped mid-flow rather than answering. There is no
        // `HardwareErrorCode.UserCancelFromOutside`: the shared
        // `UserCancelFromOutside` error class carries
        // `DeviceInterruptedFromOutside`, so listing the codes covers it.
        HardwareErrorCode.DeviceInterruptedFromUser,
        HardwareErrorCode.DeviceInterruptedFromOutside,
      ],
    }),
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
 * - `signingMessage`: a headless signature that produces no broadcast at all
 *   (Permit2 typed data, and the sign-only half of the Solana path), so it
 *   must not be labelled with the broadcasting copy `signing` carries.
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
  // headless message / sign-only signature in progress
  | 'signingMessage'
  | 'recording';

/**
 * Every step a payment attempt can be on: the inline pipeline's own phases
 * plus the two the page owns around them. Declared here, beside the phases it
 * extends, so the flow's state and the scene's prop are one type and cannot
 * drift — neither of those modules can own it without the other importing it.
 */
export type IWcPayConfirmingPhase =
  | 'preparing'
  | IWcPayInlinePhase
  | 'submitting';

// Result contract of `wcPayInlineSendTx`, which re-exports this type. Only the
// non-`ok` variants carry a failure, and both of them are decided by the
// controller below — `fallback` is the pipeline's suggestion, not a verdict.
export type IWcPayInlineSendResult =
  | { status: 'ok'; txid: string }
  | { status: 'fallback'; failure: IWcPayInlineFailure }
  | { status: 'inlineError'; failure: IWcPayInlineFailure };

/**
 * Result contract of `wcPayInlineSignTypedData`, declared beside its send-leg
 * counterpart and for the same reason: a caller can type the result without
 * importing the pipeline (and with it `backgroundApiProxy`).
 *
 * Unlike the send result there is no failure classification — a signature that
 * did not happen leaves nothing behind, so the only distinctions worth drawing
 * are "the confirm page should take over" and "the flow already ended".
 */
export type IWcPayInlineSignResult =
  // the signature the caller must hand back to the Pay server
  | { status: 'ok'; signature: string }
  // a pre-sign blocker: the confirm page owns the decision from here.
  // Diagnostic text for logs/telemetry only — never render it to the user.
  | { status: 'fallback'; reason: string }
  // ended without a signature and without an error to report — another
  // component has already told the user why
  | { status: 'abort' };

/**
 * Result contract of `wcPayInlineSignSolanaTx`. Same three dispositions as its
 * typed-data sibling, and declared here for the same reason; only the success
 * payload differs, because a Solana payment is answered with the whole signed
 * transaction rather than a detached signature.
 */
export type IWcPayInlineSolanaSignResult =
  // the base64 signed transaction the caller must hand back to the Pay server
  | { status: 'ok'; rawTx: string }
  // a pre-sign blocker: the confirm page owns the decision from here.
  // Diagnostic text for logs/telemetry only — never render it to the user.
  | { status: 'fallback'; reason: string }
  // ended without a signature and without an error to report — another
  // component has already told the user why
  | { status: 'abort' };

/**
 * Diagnostic text for a returned fallback. A bare string reject (RPC and some
 * validators throw one) would otherwise lose its only diagnostic.
 *
 * Lives in this leaf module because both headless signing legs return the same
 * shape of fallback, and a second copy would be free to drift.
 */
export function wcPayInlineSignFallbackReason(
  error: unknown,
  defaultReason: string,
): string {
  const reason =
    typeof error === 'string' ? error : (error as Error | undefined)?.message;
  return reason || defaultReason;
}

/**
 * The action's RPC method, and only when it is a non-empty string. Anything
 * else is a malformed action rather than an unsupported method: `action`
 * crosses a trust boundary, so the three plans below must not report a
 * server-controlled value (or `undefined`) as if it were a method name.
 */
function readWcPayActionMethod(action: IWcPayAction): string | undefined {
  const method = action?.walletRpc?.method;
  return typeof method === 'string' && method ? method : undefined;
}

/**
 * The plain-EVM-send gate, evaluated per action: inline a send whose shape
 * matches the approved order, whatever position it holds in the sequence
 * (the surrounding sequence length is no longer part of the decision — every
 * action of a multi-action sequence is gated on its own). Everything else
 * uses the existing confirm-page path.
 *
 * Must never throw — `action` crosses a trust boundary (server response),
 * and this is the decision layer that never fails.
 */
export function getWcPayInlineTxPlan({
  action,
  option,
}: {
  action: IWcPayAction;
  option: IWcPayOption | undefined;
}): IWcPayInlinePlan {
  if (!option) {
    return { mode: 'fallback', reason: 'no selected option' };
  }
  const method = readWcPayActionMethod(action);
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
  return {
    mode: 'inline',
    kind: consistency.kind === 'approve' ? 'approve' : 'transfer',
  };
}

/**
 * Whether approve calldata grants an effectively unlimited allowance, for
 * DISCLOSURE: the validator accepts any amount covering the order, so the
 * customary max-uint256 is not the only unbounded shape — a near-max value
 * (2^256-2, 2^200, …) authorizes just as much and must not be presented as
 * an ordinary one-time allowance. The threshold is 2^128 (top half of the
 * amount word non-zero): unreachable by any real token amount, far below
 * anything a spoofer could pass off as bounded. Read from the amount word
 * alone; malformed or missing calldata reads as limited — the answer only
 * feeds the sheet copy, never a security decision (the validator already
 * proved the shape).
 */
export function isWcPayUnlimitedApproveAmount(
  data: string | undefined,
): boolean {
  if (typeof data !== 'string') {
    return false;
  }
  const amountWord = data.toLowerCase().slice(10 + 64);
  return amountWord.length === 64 && !/^0{32}/.test(amountWord);
}

// Re-exported from this leaf module so a caller can resolve the permit's
// token through its own registry — the input `getWcPayInlineMessagePlan`
// demands, in the shape both plans expect — and tighten the deadline bound
// they enforce, without importing kit-bg's validator directly.
export { readWcPayPermitTokenAddress, WC_PAY_PERMIT_MAX_DEADLINE_S };
export type { IWcPayResolvedToken };

/**
 * The Permit2 typed-data gate. `resolvedToken` is the caller's registry
 * lookup of the permit's own token address (see `readWcPayPermitTokenAddress`)
 * — the validator refuses when it is missing or disagrees with the option, so
 * a payload's self-declared token can never stand in for the wallet's own
 * identity of it.
 *
 * Must never throw — `action` crosses a trust boundary (server response).
 */
export function getWcPayInlineMessagePlan({
  action,
  option,
  nowMs,
  resolvedToken,
  maxDeadlineS,
}: {
  action: IWcPayAction;
  option: IWcPayOption | undefined;
  nowMs: number;
  resolvedToken: IWcPayResolvedToken | undefined;
  maxDeadlineS?: number;
}): IWcPayInlineMessagePlan {
  if (!option) {
    return { mode: 'fallback', reason: 'no selected option' };
  }
  const method = readWcPayActionMethod(action);
  if (!method) {
    return { mode: 'fallback', reason: 'malformed action' };
  }
  if (method !== EWcPayActionMethod.EthSignTypedDataV4) {
    return { mode: 'fallback', reason: `method ${method}` };
  }
  let typedData: unknown;
  try {
    // Both steps can throw on a hostile payload: JSON.parse on malformed
    // params, and the extractor when no element is EIP-712 shaped.
    typedData = JSON.parse(
      extractWcPayTypedDataMessage(JSON.parse(action.walletRpc.params)),
    );
  } catch {
    return { mode: 'fallback', reason: 'unparseable params' };
  }
  const consistency = checkWcPayTypedDataMatchesOrder({
    typedData,
    caip2ChainId: action.walletRpc.chainId,
    option,
    nowMs,
    resolvedToken,
    maxDeadlineS,
  });
  if (!consistency.ok) {
    return { mode: 'fallback', reason: consistency.reason };
  }
  return { mode: 'inline', summary: consistency.summary };
}

/**
 * First half of the Solana gate: the part that can be decided from the
 * action alone (method + params). The order check itself needs
 * @solana/web3.js and therefore runs in the background — hand `txBase64`
 * and `caip2ChainId` to `ServiceWalletConnectPay.checkSolanaTxMatchesOrder`
 * and feed its verdict to `getWcPayInlineSolanaPlan`.
 *
 * Must never throw — `action` crosses a trust boundary (server response).
 */
export function getWcPayInlineSolanaRequest({
  action,
  option,
}: {
  action: IWcPayAction;
  option: IWcPayOption | undefined;
}): IWcPayInlineSolanaRequest {
  if (!option) {
    return { mode: 'fallback', reason: 'no selected option' };
  }
  const method = readWcPayActionMethod(action);
  if (!method) {
    return { mode: 'fallback', reason: 'malformed action' };
  }
  if (method !== EWcPayActionMethod.SolanaSignTransaction) {
    return { mode: 'fallback', reason: `method ${method}` };
  }
  const caip2ChainId = action.walletRpc.chainId;
  // The chain travels to the background as the validator's own chain input,
  // so it is checked here rather than trusted to be a string.
  if (typeof caip2ChainId !== 'string' || !caip2ChainId) {
    return { mode: 'fallback', reason: 'malformed action' };
  }
  let txBase64: string;
  try {
    // JSON.parse throws on malformed params; the extractor throws when no
    // element carries a transaction payload.
    txBase64 = extractWcPaySolanaTransaction(
      JSON.parse(action.walletRpc.params),
    );
  } catch {
    return { mode: 'fallback', reason: 'unparseable params' };
  }
  // Bounded before it crosses the proxy, at approximately the same bound as
  // solPayUtils (base64 carries 3 bytes per 4 chars, so this char cap admits
  // up to 4098 decoded bytes): a pre-filter that keeps an oversize blob off
  // this thread's decoders — the exact byte cap is enforced there.
  if (txBase64.length > Math.ceil(WC_PAY_SOLANA_TX_MAX_BYTES / 3) * 4) {
    return { mode: 'fallback', reason: 'transaction too large' };
  }
  return { mode: 'request', txBase64, caip2ChainId };
}

/**
 * Second half: turns the background's verdict into a plan. The validator
 * proves the blob's shape, amount and fee bounds but deliberately stops at
 * the mint ADDRESS — it never resolves a symbol. So for an spl leg this plan
 * additionally demands the caller's registry lookup (`resolvedToken`) and
 * refuses unless it agrees with both the mint and what the option displays —
 * the same boundary `getWcPayInlineMessagePlan` draws for EVM. Native legs
 * carry no mint and are fully judged by the validator itself.
 *
 * Must never throw — `consistency` reflects a server-supplied payload.
 */
export function getWcPayInlineSolanaPlan({
  option,
  txBase64,
  consistency,
  resolvedToken,
}: {
  option: IWcPayOption;
  // The blob the verdict was produced for, carried through so the caller
  // signs exactly what was checked.
  txBase64: string;
  consistency: IWcPaySolanaConsistencyResult;
  // The wallet-registry lookup of `summary.mint`; only spl legs consult it.
  resolvedToken?: IWcPayResolvedToken;
}): IWcPayInlineSolanaPlan {
  // The whole verdict envelope is read defensively, not just its payload:
  // it is produced in the background and crosses a serialization boundary,
  // so a damaged one (`ok` without a `summary`, a refusal without a reason)
  // must fall back rather than throw.
  if (!consistency?.ok) {
    return {
      mode: 'fallback',
      reason: consistency?.reason || 'invalid verdict',
    };
  }
  const { summary } = consistency;
  // Positively identified, not merely present: an unrecognized (or absent)
  // `kind` must not fall through to the native branch, which would inline a
  // payment whose amount this side never saw.
  if (
    (summary?.kind !== 'native' && summary?.kind !== 'spl') ||
    typeof summary.amountRaw !== 'string'
  ) {
    return { mode: 'fallback', reason: 'invalid verdict' };
  }
  if (summary.kind === 'spl') {
    if (!resolvedToken) {
      return { mode: 'fallback', reason: 'unknown token' };
    }
    if (resolvedToken.address !== summary.mint) {
      return { mode: 'fallback', reason: 'token address mismatch' };
    }
    // Optional-chained all the way down to `option` itself: the verdict
    // crossed a serialization boundary, so this side must refuse a
    // malformed option rather than throw on it. (Only these two reads are
    // exposed — a missing resolvedToken is refused above, before them.)
    if (resolvedToken.symbol !== option?.amount?.display?.assetSymbol) {
      return { mode: 'fallback', reason: 'token symbol mismatch' };
    }
    if (resolvedToken.decimals !== option?.amount?.display?.decimals) {
      return { mode: 'fallback', reason: 'token decimals mismatch' };
    }
  }
  return { mode: 'inline', summary, txBase64 };
}

/**
 * Byte cap for an inline personal_sign message, measured on the normalized
 * message string (a hex payload is ~2x its raw bytes — the cap is a cheap
 * pre-decode guard, exactness is not required). Anything longer falls back
 * to the confirm page, whose raw rendering has no such constraint.
 */
export const WC_PAY_PERSONAL_SIGN_MAX_BYTES = 4096;

/**
 * Minimum time the message stays on screen before the signature is
 * requested. Display is this leg's whole consent contract, and with a
 * cached password nothing else pauses the pipeline — without a dwell the
 * summary could be signed away within a frame of appearing.
 */
export const WC_PAY_PERSONAL_SIGN_MIN_DISPLAY_MS = 1500;

// Characters that would let the rendered text lie about what is being
// signed. Enumerated: C0/C1 controls and DEL (cursor tricks, bells,
// embedded nulls; only \n \r \t are legitimate), the line/paragraph
// separators (U+2028/29) and the Hangul fillers (U+115F/1160/3164/FFA0 -
// letters by category, blank on screen). By Unicode category, so the set
// cannot miss a member the way an enumeration did (U+061C, the tag block):
// Cf is every format character - zero-width and direction marks, bidi
// embedding/override/isolate controls, the soft hyphen, invisible
// operators, the BOM and the U+E0000 tag block; Co/Cs/Cn are private-use,
// surrogate and unassigned code points, which no font renders. A bidi
// override alone can visually reorder a payment instruction in the trusted
// sheet while those exact bytes are signed, and a tag-block suffix is
// signed without ever being shown.
/* eslint-disable no-control-regex */
const PERSONAL_SIGN_FORBIDDEN_CHARS_RE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029\u115F\u1160\u3164\uFFA0\p{Cf}\p{Co}\p{Cs}\p{Cn}]/u;
/* eslint-enable no-control-regex */

/**
 * Size bounds for an inline personal_sign message, measured on the decoded
 * text. The sheet renders the message in a bounded, scrollable viewport, so
 * "the tail is hidden" cannot be prevented by pattern-matching one padding
 * shape (a message can hide its tail behind 1000 one-character lines or a
 * single 3900-character line just as well as behind blank lines). What can
 * be bounded is how much there is to scroll: these caps keep the whole
 * message within a few sheet-heights, so a reader who scrolls to the end
 * has seen all of it. Sized for sign-in style messages (EIP-4361 with a
 * statement and a handful of resources is ~16 lines / ~600 characters);
 * anything larger falls back to the confirm page's raw rendering.
 */
export const WC_PAY_PERSONAL_SIGN_MAX_LINES = 24;
export const WC_PAY_PERSONAL_SIGN_MAX_CHARS = 1000;

// The one padding shape that still reads as a fake end of message inside
// those bounds: a run of blank lines, or a run of 32+ horizontal spaces
// (any Unicode space separator or tab; column alignment never needs that
// many). Three blank lines or more - two is content: an EIP-4361 message
// without a statement is exactly `address LF LF LF "URI: "`.
const PERSONAL_SIGN_PADDING_RE = /(?:\r?\n[\p{Zs}\t]*){4,}|[\p{Zs}\t]{32,}/u;

/**
 * Strips the forbidden display characters above and bounds the length, for
 * server-derived strings interpolated into the sheet's trusted copy (the
 * approve headline's token symbol). The personal_sign gate REFUSES such
 * content instead - refusal has a fallback page to go to, a symbol does
 * not.
 */
export function sanitizeWcPayDisplayText(
  text: string,
  maxLength: number,
): string {
  const cleaned = Array.from(text)
    .filter((char) => !PERSONAL_SIGN_FORBIDDEN_CHARS_RE.test(char))
    .join('')
    .trim();
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength)}…`
    : cleaned;
}

/**
 * The human-readable decode of a normalized personal_sign message, or
 * undefined when the sheet could not faithfully render it: a hex payload
 * that is not valid UTF-8 (lossy decode or a non-round-tripping one),
 * embedded control or invisible characters, more lines or characters than
 * the sheet's bounds, blank-line padding, or nothing but whitespace.
 */
function decodeWcPayPersonalSignText(message: string): string | undefined {
  let text = message;
  if (/^0x[0-9a-fA-F]*$/.test(message)) {
    // An odd nibble count decodes differently here (Buffer drops the
    // trailing nibble) than in the signer (which pads), so the display
    // would show the decode of DIFFERENT bytes than are signed. Refuse
    // outright rather than treat it as text - the signer still reads a
    // hex-looking string as hex.
    if (message.length % 2 !== 0) {
      return undefined;
    }
    const bytes = Buffer.from(message.slice(2), 'hex');
    text = bytes.toString('utf8');
    // A lossy decode (invalid UTF-8 becomes U+FFFD) or a non-round-tripping
    // one means the display would not be showing the signed bytes — refuse.
    if (
      text.includes('�') ||
      Buffer.from(text, 'utf8').length !== bytes.length
    ) {
      return undefined;
    }
  }
  if (PERSONAL_SIGN_FORBIDDEN_CHARS_RE.test(text)) {
    return undefined;
  }
  if (
    text.split(/\r?\n/).length > WC_PAY_PERSONAL_SIGN_MAX_LINES ||
    Array.from(text).length > WC_PAY_PERSONAL_SIGN_MAX_CHARS
  ) {
    return undefined;
  }
  if (PERSONAL_SIGN_PADDING_RE.test(text)) {
    return undefined;
  }
  if (!text.trim()) {
    return undefined;
  }
  return text;
}

/**
 * The personal_sign gate (Phase 3 §4). Unlike every other plan there is no
 * order proof to run — the message is arbitrary server-issued content — so
 * the gate is a DISPLAYABILITY contract instead: the sheet shows exactly
 * what is being signed, and anything it cannot faithfully show falls back
 * to MessageConfirm, whose raw/hex rendering is built for it.
 *
 * The same extraction + normalization as the modal path
 * (extractWcPayPersonalSignMessage + autoFixPersonalSignMessage) feeds both
 * the returned `message` (what gets signed) and `summary.text` (its decode),
 * so the displayed text and the signed bytes cannot diverge.
 *
 * Never a spend: the executor must not charge this against the sequence
 * spend budget — a signed message moves nothing on its own. It is bounded
 * separately (WC_PAY_MAX_INLINE_PERSONAL_SIGNS_PER_SEQUENCE), which the
 * executor enforces at the attempt.
 *
 * Must never throw — `action` crosses a trust boundary (server response).
 */
export function getWcPayInlinePersonalSignPlan({
  action,
  option,
  accountAddress,
}: {
  action: IWcPayAction;
  option: IWcPayOption | undefined;
  // the signing account, used only to disambiguate the two personal_sign
  // param orders — the same input the modal path hands the extractor
  accountAddress: string;
}): IWcPayInlinePersonalSignPlan {
  if (!option) {
    return { mode: 'fallback', reason: 'no selected option' };
  }
  const method = readWcPayActionMethod(action);
  if (!method) {
    return { mode: 'fallback', reason: 'malformed action' };
  }
  if (method !== EWcPayActionMethod.PersonalSign) {
    return { mode: 'fallback', reason: `method ${method}` };
  }
  let message: string;
  try {
    // JSON.parse throws on malformed params; the extractor throws when no
    // element carries a message payload.
    message = autoFixPersonalSignMessage({
      message: extractWcPayPersonalSignMessage({
        parsed: JSON.parse(action.walletRpc.params),
        accountAddress,
      }),
    });
  } catch {
    return { mode: 'fallback', reason: 'unparseable params' };
  }
  if (Buffer.byteLength(message, 'utf8') > WC_PAY_PERSONAL_SIGN_MAX_BYTES) {
    return { mode: 'fallback', reason: 'message too long' };
  }
  const text = decodeWcPayPersonalSignText(message);
  if (text === undefined) {
    return { mode: 'fallback', reason: 'undisplayable message' };
  }
  return { mode: 'inline', summary: { text }, message };
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
  // diagnostic only: failure.message is logged, never rendered
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
  // What the sheet shows while a signature is being produced: the proven
  // payload behind the `signingMessage` phase (or the approve leg's send
  // phases), tagged by which kind of signing it describes. `undefined`
  // clears it — the executor clears at the top of every action so a stale
  // summary can never describe a later action's signature.
  onSigningSummary?: (summary: IWcPayInlineSigningSummary | undefined) => void;
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
