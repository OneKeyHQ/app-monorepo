import { isNil } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  checkWcPayEvmTxMatchesOrder,
  isWcPayEmptyCalldata,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/wcPayOrderConsistency';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import { wcPayChainIdToNetworkId } from '@onekeyhq/shared/src/walletConnect/payConstant';
import {
  EWcPayErrorCode,
  WcPayError,
} from '@onekeyhq/shared/src/walletConnect/payErrors';
import { isWcPayExpired } from '@onekeyhq/shared/src/walletConnect/payExpiryUtils';
import type {
  IWcPayOption,
  IWcPayPreBroadcastRecord,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import {
  fetchWcPayInlineBalances,
  findWcPayInlineBalanceShortfall,
} from './wcPayInlineBalanceUtils';
import {
  WC_PAY_INLINE_POST_SIGN_FLAG,
  WcPayUserCancelledError,
  classifyWcPayInlineFailure,
  isWcPayInlineUserCancel,
} from './wcPayInlineUtils';

import type {
  IWcPayInlinePhase,
  IWcPayInlineSendResult,
  IWcPayInlineStage,
} from './wcPayInlineUtils';

// The types and the post-sign flag are declared beside the pure decision
// helpers so that module can express the attempts loop — and classify a thrown
// error — without importing this one; re-exported here because this is where
// they are produced.
export type { IWcPayInlinePhase, IWcPayInlineSendResult };
export { WC_PAY_INLINE_POST_SIGN_FLAG };

/**
 * Tags an error as having happened at or after signing. Objects are tagged in
 * place so nothing about the original error is lost; a primitive cannot carry
 * a property (RPC rejects are sometimes bare strings), so it is wrapped in an
 * error preserving the message.
 */
function markWcPayInlinePostSignError(error: unknown): unknown {
  const tagged =
    error && typeof error === 'object'
      ? error
      : new OneKeyLocalError(
          typeof error === 'string' && error
            ? error
            : // diagnostic only: the banner renders kind-derived copy
              'Failed to send the transaction',
        );
  (tagged as Record<string, unknown>)[WC_PAY_INLINE_POST_SIGN_FLAG] = true;
  return tagged;
}

type IWcPayInlineDisposition = 'fallback' | 'inlineError';

type IWcPayInlineStageOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; result: IWcPayInlineSendResult };

/**
 * Runs one pipeline stage under exactly one try/catch, so the stage's
 * classification (and whether the caller retries inline or reroutes to the
 * confirm page) is decided at the call site rather than by inspecting error
 * content. Stages that must abort the payment outright throw past this
 * helper instead of being wrapped by it.
 */
async function runWcPayInlineStage<T>({
  stage,
  disposition,
  task,
}: {
  stage: IWcPayInlineStage;
  disposition: IWcPayInlineDisposition;
  task: () => Promise<T>;
}): Promise<IWcPayInlineStageOutcome<T>> {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return {
      ok: false,
      result: {
        status: disposition,
        failure: classifyWcPayInlineFailure({ stage, error }),
      },
    };
  }
}

// The normal preset with a low-preset fallback — the same default the confirm
// page preselects, so an inline payment costs what the modal path would have.
function pickWcPayInlineFeePreset<T>(values: T[] | undefined): T | undefined {
  return values?.[1] ?? values?.[0];
}

/**
 * Headless replacement for the TxConfirm modal on the WalletConnect Pay inline
 * path: estimates the fee, proves the account can afford the transfer, runs
 * the same pre-send guards the confirm page runs, re-proves the final
 * encodedTx still matches the approved order, then signs and broadcasts.
 *
 * The failure contract is deliberately asymmetric (design doc §3/§7):
 * recoverable pre-sign problems are RETURNED so the caller can retry inline or
 * reroute to the confirm page, while anything that would let a mutated or
 * expired payment reach the chain — and everything from signing onwards —
 * THROWS, because those must never be silently retried here.
 *
 * Any error carrying `WC_PAY_INLINE_POST_SIGN_FLAG` occurred at or after
 * signing — callers must classify it stage 'send' and route retries through
 * the recovery machinery, never re-sign. Untagged throws are pre-sign
 * (expiry, final recheck, account/network binding) and nothing was signed.
 *
 * Does NOT mutate the passed `unsignedTx`: `updateUnSignedTxBeforeSending` is
 * a background method that clones its input (ServiceSend.updateUnsignedTx
 * hands the vault a `cloneDeep`) and returns new objects, and on split-runtime
 * targets the call crosses a serialization boundary as well. A repeated call
 * therefore starts from the same clean tx this one did. Which stages may be
 * retried is a policy decision, not a consequence of aliasing — see the
 * retry rationale in `runWcPayInlineAttempts`.
 *
 * Not reentrant: the caller serializes calls (the `isPaying` guard). Two
 * concurrent calls could not double-pay — both resolve the same nonce, so at
 * most one transaction lands — but their `onPhase` emissions would interleave
 * and drive the inline UI through a nonsensical sequence.
 */
export async function wcPayInlineSendTx({
  networkId,
  accountId,
  unsignedTx,
  option,
  sourceInfo,
  intent,
  expiryMs,
  wcPayPreBroadcastRecord,
  throwIfCancelled,
  onPhase,
}: {
  networkId: string;
  accountId: string;
  unsignedTx: IUnsignedTxPro;
  option: IWcPayOption;
  sourceInfo: IDappSourceInfo;
  // Which calldata shape the plan gate approved for this action. The final
  // pre-sign recheck asserts the re-proven kind still corresponds to it, so
  // an approve plan can never end up signing a transfer or vice versa.
  intent: 'transfer' | 'approve';
  expiryMs?: number;
  wcPayPreBroadcastRecord?: IWcPayPreBroadcastRecord;
  // pre-sign cancellation boundary (page unmounted): checked on entry and at
  // the last pre-sign gate, never after signing. Supplied by the executor as
  // its own checker — not a bare AbortSignal — so the executor's retirement
  // rule (a broadcast in the run disables cancellation) applies here
  // unchanged when Phase 2 admits multi-action inline sequences
  throwIfCancelled?: () => void;
  onPhase?: (phase: IWcPayInlinePhase) => void;
}): Promise<IWcPayInlineSendResult> {
  throwIfCancelled?.();
  onPhase?.('estimating');

  // Parity with TxConfirmActions: an externally originated send is blocked
  // while the wallet has no backup. `checkIsWalletNotBackedUp` SHOWS the
  // backup dialog itself (WalletBackupPreCheckContainer answers the
  // CheckWalletBackupStatus event by presenting it and rejecting), so by the
  // time it returns true the user has already been told what to do and the
  // pipeline only has to stop.
  //
  // Deliberately NOT a fallback: the confirm page runs the same check on
  // mount and again in submitTxs, where a not-backed-up wallet re-raises the
  // dialog and the submit silently returns — a page the user cannot pay from.
  // Ending here leaves them with the one dialog that can actually resolve it.
  const backupCheck = await runWcPayInlineStage({
    stage: 'backup',
    disposition: 'inlineError',
    task: () =>
      backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
      }),
  });
  if (!backupCheck.ok) {
    return backupCheck.result;
  }
  if (backupCheck.value) {
    return {
      status: 'inlineError',
      failure: classifyWcPayInlineFailure({
        stage: 'backup',
        error: new OneKeyLocalError('Wallet is not backed up'),
      }),
    };
  }

  const accountAddressResult = await runWcPayInlineStage({
    stage: 'prepare',
    disposition: 'fallback',
    task: () =>
      backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
  });
  if (!accountAddressResult.ok) {
    return accountAddressResult.result;
  }
  const accountAddress = accountAddressResult.value;

  // Bind the signing account to the account the order names. EVM signing never
  // reads `encodedTx.from` — the sender is recovered from the signature, so the
  // key behind `accountId` is what actually pays — and the EVM precheck and
  // preActions are base-class no-ops, so nothing else here would notice an
  // incorrectly wired caller draining a different account than the user
  // approved. Hard abort rather than fallback: the confirm page would sign with
  // the wrong account just as silently, so this is the same class of internal
  // wiring bug as the post-mutation recheck below.
  const optionAddress = option.account.split(':')[2];
  if (
    !optionAddress ||
    !accountAddress ||
    optionAddress.toLowerCase() !== accountAddress.toLowerCase()
  ) {
    console.error(
      'wcPay inline account mismatch: option account',
      optionAddress,
      'signing account',
      accountAddress,
    );
    throw new WcPayError({
      code: EWcPayErrorCode.CannotCompleteNow,
      message: 'This payment cannot be completed right now',
    });
  }

  const estimateResult = await runWcPayInlineStage({
    stage: 'estimate',
    disposition: 'inlineError',
    task: async () => {
      const estimateFeeParamsResult =
        await backgroundApiProxy.serviceGas.buildEstimateFeeParams({
          networkId,
          accountId,
          encodedTx: unsignedTx.encodedTx,
        });
      const gasRes = await backgroundApiProxy.serviceGas.estimateFee({
        ...estimateFeeParamsResult,
        accountAddress,
        networkId,
        accountId,
        // The inline send never wires a sponsor quote into the broadcast, so
        // asking for one would only produce fee data this path cannot honour.
        gasAccountEnabled: false,
      });
      const gas = pickWcPayInlineFeePreset(gasRes.gas);
      const gasEIP1559 = pickWcPayInlineFeePreset(gasRes.gasEIP1559);
      if (!gas && !gasEIP1559) {
        throw new OneKeyLocalError('No network fee option available');
      }
      const feeInfo: IFeeInfoUnit = {
        common: gasRes.common,
        gas,
        gasEIP1559,
      };
      const feeForSend = calculateFeeForSend({
        feeInfo,
        nativeTokenPrice: feeInfo.common.nativeTokenPrice ?? 0,
        estimateFeeParams: estimateFeeParamsResult.estimateFeeParams,
      });
      return { feeInfo, feeForSend };
    },
  });
  if (!estimateResult.ok) {
    return estimateResult.result;
  }
  const { feeInfo, feeForSend } = estimateResult.value;
  const {
    total,
    totalNative,
    totalFiat,
    totalNativeForDisplay,
    totalFiatForDisplay,
  } = feeForSend;

  // The inline path only ever runs for the shapes getWcPayInlineTxPlan
  // admits — a plain EVM transfer or the Permit2 approve leg — so the
  // encodedTx is an EVM tx either way.
  const encodedTx = unsignedTx.encodedTx as IEncodedTxEvm;
  const tokenAddress = isWcPayEmptyCalldata(encodedTx.data)
    ? undefined
    : encodedTx.to;

  onPhase?.('checking');

  const balancesResult = await runWcPayInlineStage({
    // A balance we could not read is an unknown blocker, not a verdict about
    // the user's funds — it reroutes to the confirm page rather than telling
    // the user they are short.
    stage: 'prepare',
    disposition: 'fallback',
    task: () =>
      fetchWcPayInlineBalances({ accountId, networkId, tokenAddress }),
  });
  if (!balancesResult.ok) {
    return balancesResult.result;
  }

  const shortfallResult = await runWcPayInlineStage({
    stage: 'prepare',
    disposition: 'fallback',
    task: () =>
      Promise.resolve(
        findWcPayInlineBalanceShortfall({
          balances: balancesResult.value,
          feeInfo,
          totalNative,
          // The order amount is the raw smallest-unit value the pre-flight
          // consistency check bound this tx to: equal to the transfer
          // amount for the transfer intent, a floor under the allowance for
          // the approve intent. The approve leg keeps this token-balance
          // requirement deliberately — its own tx moves nothing, but the
          // sequence it enables spends exactly this amount, so a short
          // balance should surface here rather than after an approve is
          // burned on a payment that cannot complete.
          orderAmount: option.amount.value,
        }),
      ),
  });
  if (!shortfallResult.ok) {
    return shortfallResult.result;
  }
  if (shortfallResult.value) {
    return {
      status: 'inlineError',
      failure: classifyWcPayInlineFailure({
        stage: 'balance',
        error: new OneKeyLocalError(shortfallResult.value),
      }),
    };
  }

  const prepareResult = await runWcPayInlineStage({
    stage: 'prepare',
    disposition: 'fallback',
    task: async () => {
      // prepareSendConfirmUnsignedTx already resolves a nonce for
      // nonce-required chains, and a re-executed broadcast action arrives
      // pinned to its recorded nonce; either way the value on the unsigned tx
      // is the one to keep, so it is never re-derived here.
      const nonce = isNil(unsignedTx.nonce)
        ? await backgroundApiProxy.serviceSend.getNextNonce({
            accountId,
            networkId,
            accountAddress,
          })
        : unsignedTx.nonce;
      const [updatedUnsignedTx] =
        await backgroundApiProxy.serviceSend.updateUnSignedTxBeforeSending({
          accountId,
          networkId,
          unsignedTxs: [unsignedTx],
          feeInfos: [
            {
              feeInfo,
              total,
              totalNative,
              totalFiat,
              totalNativeForDisplay,
              totalFiatForDisplay,
            },
          ],
          nonceInfo: { nonce },
        });
      return { nonce, updatedUnsignedTx };
    },
  });
  if (!prepareResult.ok) {
    return prepareResult.result;
  }
  const { nonce, updatedUnsignedTx } = prepareResult.value;

  // Kept for the non-EVM chains Phase 2 will admit; the EVM vault precheck is
  // a base-class no-op today.
  const precheckResult = await runWcPayInlineStage({
    stage: 'precheck',
    disposition: 'fallback',
    task: () =>
      backgroundApiProxy.serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs: [updatedUnsignedTx],
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
        feeInfos: [
          {
            feeInfo,
            total,
            totalNative,
            totalFiat,
            totalNativeForDisplay,
            totalFiatForDisplay,
          },
        ],
      }),
  });
  if (!precheckResult.ok) {
    return precheckResult.result;
  }

  const preActionsResult = await runWcPayInlineStage({
    stage: 'prepare',
    disposition: 'fallback',
    task: () =>
      backgroundApiProxy.serviceSignatureConfirm.preActionsBeforeSending({
        accountId,
        networkId,
        unsignedTxs: [updatedUnsignedTx],
      }),
  });
  if (!preActionsResult.ok) {
    return preActionsResult.result;
  }

  // Fee-overflow double confirm, as the Market direct-send path runs it. A
  // declined dialog surfaces as a plain error (not a cancel type), which is
  // the right outcome here: the user rejected this fee, so the payment moves
  // to the confirm page where the fee can be edited.
  const verifyResult = await runWcPayInlineStage({
    stage: 'prepare',
    disposition: 'fallback',
    task: () =>
      backgroundApiProxy.serviceTransaction.verifyTransaction({
        networkId,
        accountId,
        verifyTxTasks: ['feeInfo'],
        verifyTxFeeInfoParams: {
          feeAmount: totalNative,
          feeTokenSymbol: feeInfo.common.nativeSymbol,
          doubleConfirm: true,
        },
        encodedTx: updatedUnsignedTx.encodedTx,
      }),
  });
  if (!verifyResult.ok) {
    return verifyResult.result;
  }

  // Last pre-sign gate. `broadcastDeadline` below stays the hard boundary the
  // background enforces between signing and broadcast, covering signing
  // sessions (hardware especially) that outlive this check. The cancel check
  // sits here too: past this point the attempt must run to completion.
  throwIfCancelled?.();
  if (isWcPayExpired(expiryMs)) {
    throw new WcPayError({
      code: EWcPayErrorCode.PaymentExpired,
      message: 'This payment has expired',
    });
  }

  // Validate what actually gets signed. Everything above may rewrite the tx
  // (fee fields, nonce), so the object handed to the signer — not the one the
  // plan gate approved — has to prove it still matches the order. A mismatch
  // is post-decision mutation: abort, never fall back with a mutated tx.
  const optionCaip2ChainId = option.account.split(':').slice(0, 2).join(':');
  const consistency = checkWcPayEvmTxMatchesOrder({
    // The validator reads arbitrary own-keys off the tx to enforce its field
    // whitelist, which the concrete EVM tx type cannot express.
    tx: updatedUnsignedTx.encodedTx as unknown as Record<string, unknown>,
    // Never `encodedTx.chainId`: the vault rewrites it to a hex chain id.
    caip2ChainId: optionCaip2ChainId,
    // Required here — the vault writes its nonce into encodedTx, and omitting
    // this would reject every payment as carrying an unexpected nonce field.
    expectedNonce: nonce,
    option,
  });
  if (!consistency.ok) {
    console.error(
      'wcPay inline transaction changed after validation:',
      consistency.reason,
    );
    throw new WcPayError({
      code: EWcPayErrorCode.CannotCompleteNow,
      message: 'This payment cannot be completed right now',
    });
  }
  // The plan approved one calldata shape; the signer must get that shape.
  // Fee/nonce rewriting cannot change calldata, so a kind flip here is the
  // same class of post-decision mutation as a failed recheck above.
  const kindMatchesIntent =
    intent === 'approve'
      ? consistency.kind === 'approve'
      : consistency.kind === 'native' || consistency.kind === 'erc20';
  if (!kindMatchesIntent) {
    console.error(
      'wcPay inline tx kind changed after validation:',
      consistency.kind,
    );
    throw new WcPayError({
      code: EWcPayErrorCode.CannotCompleteNow,
      message: 'This payment cannot be completed right now',
    });
  }
  // The validator derives the option's chain from `option.account` as well, so
  // handing it back proves nothing on its own; this is what ties the chain the
  // tx will broadcast on to the chain the order names.
  if (wcPayChainIdToNetworkId(optionCaip2ChainId) !== networkId) {
    console.error(
      'wcPay inline network mismatch: order chain',
      optionCaip2ChainId,
      'tx network',
      networkId,
    );
    throw new WcPayError({
      code: EWcPayErrorCode.CannotCompleteNow,
      message: 'This payment cannot be completed right now',
    });
  }

  // Signing and broadcasting happen inside this one background call, so this
  // is the point of no return: from here on every failure is tagged post-sign
  // and must reach the recovery machinery, never a fallback or a re-sign.
  onPhase?.('signing');
  let signedTx: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceSend.signAndSendTransaction>
  >;
  try {
    signedTx = await backgroundApiProxy.serviceSend.signAndSendTransaction({
      networkId,
      accountId,
      unsignedTx: updatedUnsignedTx,
      signOnly: false,
      // hard boundary the background enforces between signing and broadcast
      broadcastDeadline: expiryMs,
      // duplicate-payment boundary: the background records the txid after
      // signing and before broadcast, so a UI runtime that dies here still
      // knows the transfer was sent
      wcPayPreBroadcastRecord,
    });
  } catch (error) {
    // The password / hardware prompt pops INSIDE this call, before anything is
    // signed. A user cancel there must stay a plain cancel — tagging it
    // post-sign would lock the option list behind a spurious SendFailed
    // banner. Same guard as the two signature legs; class/code matched, so a
    // real broadcast failure is never swallowed.
    if (isWcPayInlineUserCancel(error)) {
      throw new WcPayUserCancelledError('User canceled payment');
    }
    throw markWcPayInlinePostSignError(error);
  }
  onPhase?.('recording');

  // History and signature-record parity with the confirm-page path. Both are
  // bookkeeping for an already-broadcast payment: failing here must not lose
  // the txid the caller still has to report to the Pay server.
  try {
    const decodedTx = await backgroundApiProxy.serviceSend.buildDecodedTx({
      networkId,
      accountId,
      unsignedTx: updatedUnsignedTx,
      feeInfo: {
        feeInfo,
        total,
        totalNative,
        totalFiat,
        totalNativeForDisplay,
        totalFiatForDisplay,
      },
      saveToLocalHistory: true,
    });
    const data = { signedTx, decodedTx, feeInfo };
    // Signature record first, matching the batch path's order
    // (ServiceSend.ts:1042-1056): this call swallows its own errors, while the
    // history save below can throw — running it second would drop the
    // signature record whenever history saving fails.
    // The confirm page gets this through batchSignAndSendTransaction, which
    // the headless single-tx call does not go through.
    await backgroundApiProxy.serviceSignature.addItemFromSendProcess(
      data,
      sourceInfo,
    );
    await backgroundApiProxy.serviceHistory.saveSendConfirmHistoryTxs({
      networkId,
      accountId,
      data,
    });
  } catch (error) {
    console.error('wcPay inline save send history failed', error);
  }

  const txid = signedTx?.txid;
  if (!txid) {
    // post-broadcast: the transfer may well be on chain with only its id lost,
    // so this must never look like a pre-sign failure the caller can retry.
    throw markWcPayInlinePostSignError(
      new WcPayError({
        code: EWcPayErrorCode.MissingTxid,
        message: 'Missing transaction id',
      }),
    );
  }
  return { status: 'ok', txid };
}
