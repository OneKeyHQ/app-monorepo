import { useCallback } from 'react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  extractWcPayPersonalSignMessage,
  extractWcPayTypedDataMessage,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/evmPayUtils';
import {
  extractWcPaySolanaTransaction,
  wcPaySolanaTxToEncodedTx,
} from '@onekeyhq/kit-bg/src/services/ServiceWalletConnectPay/solPayUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import { autoFixPersonalSignMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  WALLET_CONNECT_PAY_TRUSTED_HOST,
  wcPayChainIdToNetworkId,
} from '@onekeyhq/shared/src/walletConnect/payConstant';
import { isWcPayExpired } from '@onekeyhq/shared/src/walletConnect/payExpiryUtils';
import {
  EWcPayActionMethod,
  type IWcPayAction,
  type IWcPayOption,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

import { wcPayInlineSendTx } from './wcPayInlineSendTx';
import { getWcPayInlinePlan, runWcPayInlineAttempts } from './wcPayInlineUtils';

import type { IWcPayInlineController } from './wcPayInlineUtils';

// small pause so a finished confirm modal fully dismisses before the next one
const MODAL_TRANSITION_MS = 300;

// User-intent cancellation (dismissed a confirm modal or the collect form);
// callers should end the flow silently instead of surfacing an error toast.
export class WcPayUserCancelledError extends OneKeyLocalError {}

// Sign requests come from the WalletConnect Pay server / merchant, not from
// the wallet itself, so present them through the regular external-sign
// confirmation path (site mark + risk detection) instead of
// walletInternalSign. The empty id keeps useDappApproveAction a no-op — the
// flow settles via onSuccess/onFail/onCancel callbacks.
function buildWcPaySourceInfo({
  method,
  params,
  scope,
}: {
  method: string;
  params: unknown;
  scope: IDappSourceInfo['scope'];
}): IDappSourceInfo {
  return {
    id: '',
    origin: `https://${WALLET_CONNECT_PAY_TRUSTED_HOST}`,
    hostname: WALLET_CONNECT_PAY_TRUSTED_HOST,
    scope,
    data: { method, params },
    isWalletConnectRequest: false,
  };
}

export function useWcPayActionExecutor() {
  const navigation = useAppNavigation();

  const executeActions = useCallback(
    async ({
      actions,
      accountId,
      indexedAccountId,
      completedResults,
      expiryMs,
      progressContext,
      option,
      inlineController,
      onActionComplete,
      onActionInvalidated,
    }: {
      actions: IWcPayAction[];
      accountId?: string;
      indexedAccountId?: string;
      // identity of the durable progress record for this payment attempt.
      // When present, every eth_sendTransaction confirm threads it to the
      // send pipeline as wcPayPreBroadcastRecord, so the BACKGROUND persists
      // the txid between signing and broadcast — closing the window where
      // this UI runtime dies after the broadcast but before the confirm
      // round-trip returns and onActionComplete below can run
      progressContext?: {
        paymentId: string;
        optionId: string;
        accountKey: string;
      };
      // absolute payment deadline (ms epoch, the earliest of payment-level
      // and option-level expiry). Checked at the top of every action, and
      // for eth_sendTransaction additionally enforced at the confirm click
      // (onBeforeSend) and again between signing and broadcast
      // (broadcastDeadline, background-enforced), so an on-chain transfer
      // can never start once the deadline has passed.
      expiryMs?: number;
      // the payment option the user selected. Required by the inline path
      // both as the order to re-prove the transaction against and as the
      // source of the expected paying account.
      option?: IWcPayOption;
      // observer/decider for the inline path. Supplying it together with
      // `option` opts this call into the headless send; the gate that decides
      // whether a given action sequence is actually eligible
      // (getWcPayInlinePlan) still runs per action. Absent — as for every
      // caller today — the executor behaves exactly as before.
      inlineController?: IWcPayInlineController;
      // results of actions already executed in a previous partially-failed
      // attempt of the same payment option; execution resumes after them so
      // an already-broadcast transaction is never sent twice. Callers must
      // guarantee these results still correspond one-to-one to the leading
      // entries of `actions` (see the fingerprint validation in
      // ServiceWalletConnectPay.getStoredActionResults) — the executor
      // aligns purely by index.
      completedResults?: string[];
      // reports each action result as soon as it exists and is AWAITED
      // before the sequence continues, so the caller can durably persist
      // progress even when a later action rejects or the app dies mid-flow.
      // Best-effort: a rejection here is logged and swallowed — the result
      // stays in memory for confirmPayment and must never abort the flow
      onActionComplete?: (params: {
        index: number;
        result: string;
      }) => void | Promise<void>;
      // called when a previously recorded result turns out permanently
      // unusable (the recorded transaction reverted on chain); the caller
      // must discard stored progress from `index` on so the next attempt
      // re-executes the action instead of resuming a dead txid
      onActionInvalidated?: (params: { index: number }) => void | Promise<void>;
    }): Promise<string[]> => {
      const startIndex = Math.min(
        completedResults?.length ?? 0,
        actions.length,
      );
      const results: string[] = (completedResults ?? []).slice(
        0,
        actions.length,
      );

      // Expiry model. The loop-top check gates each action before it starts,
      // but cannot cover the unbounded time the user sits on a signing
      // confirmation (hardware signing included). For the only irreversible
      // action — eth_sendTransaction — two guards close that window instead:
      // onBeforeSend fails fast at the confirm click, and broadcastDeadline
      // is enforced by the background between signing and broadcast, so even
      // a signing session that crosses the deadline can never broadcast.
      //
      // The confirm modal is deliberately NOT force-closed when the deadline
      // passes. Closing would unmount TxConfirm, whose unmount handler
      // treats any not-yet-submitted state as a cancellation
      // (`isSubmitted` only becomes true after the broadcast call returns)
      // and nulls the pending submit id — the in-flight submission's success
      // continuation then skips the onSuccess callback entirely, so an
      // already-broadcast txid would be unrecoverable and a retry would pay
      // twice. Leaving the modal open is safe: a post-deadline confirm is
      // blocked before broadcast by the guards above, and sign-only
      // confirmations merely produce a re-executable signature that the
      // loop-top check (or the server) rejects as expired.
      //
      // A broadcast that STARTED before the deadline completes normally; its
      // txid settles the confirmation, is durably persisted below, and the
      // next loop-top check ends the sequence.

      // Marks an error thrown by onBeforeSend before anything is signed or
      // broadcast; the catch below may therefore safely close the confirm
      // modal. A tagged property (not an error subclass) — the file's error
      // classes are capped at one by lint, and OneKeyError types `name`.
      const deadlineBeforeSendFlag = '$$wcPayDeadlineBeforeSend';

      // Persist one produced result, awaited so the durable record normally
      // lands before the sequence continues — but always best-effort: the
      // write failing loses nothing that aborting would save. For
      // eth_sendTransaction the txid is already on-chain and must still
      // reach confirmPayment in-session, and a sign-only result is
      // re-executable — aborting would discard a signature that
      // confirmPayment can still use, only to make the user sign again.
      const persistActionResult = async (index: number, result: string) => {
        try {
          await onActionComplete?.({ index, result });
        } catch (persistError) {
          console.error('wcPay persist action result failed', persistError);
        }
      };

      // resuming with recorded progress: re-verify the last recorded action
      // when it broadcast a tx — including a fully completed sequence
      // (startIndex === actions.length), or a phantom txid would be handed
      // to confirmPayment unchecked
      let effectiveStartIndex = startIndex;
      // nonce to pin when re-executing an invalidated broadcast action: the
      // never-broadcast verdict is fallible (the tx may merely be invisible
      // to the probe pool), so the re-executed tx must reuse the recorded
      // nonce — a misjudgment then yields a nonce conflict where only one
      // tx lands, never a second payment at nonce+1
      const pinnedNonces: Record<number, number> = {};
      if (startIndex > 0) {
        const prevIndex = startIndex - 1;
        const prevRpc = actions[prevIndex].walletRpc;
        const prevTxid = results[prevIndex];
        if (
          prevRpc.method === EWcPayActionMethod.EthSendTransaction &&
          prevTxid
        ) {
          const prevNetworkId = wcPayChainIdToNetworkId(prevRpc.chainId);
          if (prevNetworkId) {
            // the pre-broadcast record is written before the broadcast
            // attempt, so a definitive broadcast rejection leaves a phantom
            // txid behind; re-execute that action instead of resuming it —
            // otherwise one failed broadcast deadlocks the payment until
            // expiry (the slot is only cleared on a final server state).
            // The check errs toward keeping the txid: only consistent
            // "transaction does not exist" probes plus a still-unconsumed
            // sender nonce count as never-broadcast
            const isNeverBroadcast =
              await backgroundApiProxy.serviceWalletConnectPay.isTxNeverBroadcast(
                {
                  networkId: prevNetworkId,
                  txid: prevTxid,
                },
              );
            if (isNeverBroadcast) {
              // read the recorded nonce BEFORE invalidation — truncating
              // stored progress deletes the entry that holds it
              const broadcastMeta =
                await backgroundApiProxy.serviceWalletConnectPay.getBroadcastMetaByTxid(
                  { txid: prevTxid },
                );
              await onActionInvalidated?.({ index: prevIndex });
              results.length = prevIndex;
              effectiveStartIndex = prevIndex;
              if (broadcastMeta) {
                pinnedNonces[prevIndex] = broadcastMeta.nonce;
              }
            } else if (prevIndex < actions.length - 1) {
              // mid-sequence resume: the broadcast tx must be mined before
              // the follow-up signing so the Permit2 "approve mined before
              // typed-data" ordering holds even when the original
              // waitForTxMined was the step that failed. A fully completed
              // sequence needs no mined-wait — confirmPayment and the
              // server-side settling own the final state
              const { isReverted } =
                await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined(
                  {
                    networkId: prevNetworkId,
                    txid: prevTxid,
                  },
                );
              if (isReverted) {
                // the recorded txid can never confirm; drop it from stored
                // progress so the next attempt re-executes this action
                // instead of waiting on a dead transaction until the TTL
                // expires
                await onActionInvalidated?.({ index: prevIndex });
                throw new OneKeyLocalError('Transaction reverted on chain');
              }
            }
          }
        }
      }

      for (let i = effectiveStartIndex; i < actions.length; i += 1) {
        // terminate the whole sequence the moment the deadline passes;
        // progress persisted via onActionComplete keeps already-broadcast
        // transactions safe for the (server-driven) expired/failed settling
        if (isWcPayExpired(expiryMs)) {
          // copy pending product i18n keys
          throw new OneKeyLocalError('This payment has expired');
        }
        const { chainId, method, params } = actions[i].walletRpc;
        const networkId = wcPayChainIdToNetworkId(chainId);
        if (!networkId) {
          throw new OneKeyLocalError(
            `Unsupported WalletConnect Pay chain: ${chainId}`,
          );
        }
        // honour the user's global derive type so the signing account matches
        // the address offered in buildPayAccounts
        const deriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: indexedAccountId ? undefined : accountId,
            indexedAccountId,
            networkId,
            deriveType,
          });
        const parsed = JSON.parse(params) as unknown;

        if (i > 0) {
          await timerUtils.wait(MODAL_TRANSITION_MS);
        }

        switch (method) {
          case EWcPayActionMethod.EthSendTransaction: {
            const encodedTx = (
              Array.isArray(parsed) ? parsed[0] : parsed
            ) as IEncodedTx;
            const unsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  networkId,
                  accountId: account.id,
                  encodedTx,
                  // pin the re-execution of an invalidated broadcast action
                  // to its recorded nonce (see pinnedNonces above)
                  nonceInfo:
                    pinnedNonces[i] !== undefined
                      ? { nonce: pinnedNonces[i] }
                      : undefined,
                },
              );
            // Inline path: run the headless pipeline instead of pushing the
            // confirm modal. It receives the very unsignedTx the modal would
            // have shown — pinned nonce included — so an invalidated
            // re-execution keeps its nonce here too. Nothing is caught: a
            // thrown pipeline error (post-sign tagged or pre-sign untagged)
            // must reach the page, which owns the recovery decision.
            if (inlineController && option) {
              // getWcPayInlinePlan validates actions[0] while this loop
              // executes actions[i]; the two coincide only because the gate
              // requires actions.length === 1. Phase 2 multi-action inlining
              // must re-gate per action rather than reuse this call.
              const plan = getWcPayInlinePlan({ actions, option });
              if (plan.mode === 'inline') {
                const inlineOutcome = await runWcPayInlineAttempts({
                  controller: inlineController,
                  run: () =>
                    wcPayInlineSendTx({
                      networkId,
                      accountId: account.id,
                      unsignedTx,
                      option,
                      sourceInfo: buildWcPaySourceInfo({
                        method,
                        params: parsed,
                        scope: 'ethereum',
                      }),
                      expiryMs,
                      // identical construction to the modal path below: the
                      // durable-progress identity must not differ by route
                      wcPayPreBroadcastRecord: progressContext
                        ? {
                            ...progressContext,
                            action: actions[i],
                            index: i,
                          }
                        : undefined,
                      onPhase: inlineController.onPhase,
                    }),
                });
                if (inlineOutcome.status === 'ok') {
                  results.push(inlineOutcome.txid);
                  await persistActionResult(i, inlineOutcome.txid);
                  // the plan gate admits single-action sequences only, so
                  // this is always the last action and the Permit2
                  // mined-wait below can never apply
                  break;
                }
                if (inlineOutcome.status === 'abort') {
                  throw new WcPayUserCancelledError('User canceled payment');
                }
                // fallback: continue into the standard confirm modal below
              }
            }
            let txid: string;
            try {
              txid = await new Promise<string>((resolve, reject) => {
                navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                  screen: EModalSignatureConfirmRoutes.TxConfirm,
                  params: {
                    networkId,
                    accountId: account.id,
                    unsignedTxs: [unsignedTx],
                    // the gas params provided by WalletConnect Pay are hints;
                    // let the wallet estimate fees like a normal send
                    useFeeInTx: false,
                    // fail fast when the user confirms after the deadline:
                    // runs before signing, so nothing irreversible has
                    // happened when it throws
                    onBeforeSend: () => {
                      if (isWcPayExpired(expiryMs)) {
                        // copy pending product i18n keys
                        const expiredError = new OneKeyLocalError(
                          'This payment has expired',
                        );
                        (expiredError as unknown as Record<string, boolean>)[
                          deadlineBeforeSendFlag
                        ] = true;
                        throw expiredError;
                      }
                    },
                    // hard boundary enforced by the background between
                    // signing and broadcast; covers signing sessions
                    // (e.g. hardware) that cross the deadline after
                    // onBeforeSend already passed
                    broadcastDeadline: expiryMs,
                    // duplicate-payment boundary: the background records the
                    // txid after signing and before broadcast, so even if
                    // this UI runtime dies before onSuccess (or anything
                    // after it) runs, a resumed attempt knows the transfer
                    // was already sent
                    wcPayPreBroadcastRecord: progressContext
                      ? {
                          ...progressContext,
                          action: actions[i],
                          index: i,
                        }
                      : undefined,
                    sourceInfo: buildWcPaySourceInfo({
                      method,
                      params: parsed,
                      scope: 'ethereum',
                    }),
                    onSuccess: (txs: ISendTxOnSuccessData[]) => {
                      const id = txs?.[0]?.signedTx?.txid;
                      if (id) {
                        resolve(id);
                      } else {
                        reject(new OneKeyLocalError('Missing transaction id'));
                      }
                    },
                    onFail: (error: Error) => reject(error),
                    onCancel: () =>
                      reject(
                        new WcPayUserCancelledError('User canceled payment'),
                      ),
                  },
                });
              });
            } catch (error) {
              // the deadline tripped at the confirm click: no submission is
              // in flight, so closing the (still open) confirm modal cannot
              // lose a broadcast result — the only situation where closing
              // it from the outside is safe
              if (
                (error as undefined | Record<string, unknown>)?.[
                  deadlineBeforeSendFlag
                ]
              ) {
                navigation.popStack();
              }
              throw error;
            }
            results.push(txid);
            // the txid was already durably recorded by the background
            // between signing and broadcast (wcPayPreBroadcastRecord above);
            // this second write merely reaffirms it after the confirm
            // round-trip and must still never lose it to a later-step
            // failure (including the mined-wait below)
            await persistActionResult(i, txid);
            // Permit2 flow: the approve must be mined before signing the
            // follow-up typed data
            if (i < actions.length - 1) {
              const { isReverted } =
                await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined(
                  {
                    networkId,
                    txid,
                  },
                );
              if (isReverted) {
                // a reverted tx is a terminal failure of this action: the
                // recorded txid must not be resumed on retry. Timeout/RPC
                // uncertainty (thrown above) keeps the txid so a retry never
                // re-broadcasts a possibly-mined payment.
                await onActionInvalidated?.({ index: i });
                throw new OneKeyLocalError('Transaction reverted on chain');
              }
            }
            break;
          }
          case EWcPayActionMethod.EthSignTypedDataV4: {
            const message = extractWcPayTypedDataMessage(parsed);
            const signature = await new Promise<string>((resolve, reject) => {
              navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                screen: EModalSignatureConfirmRoutes.MessageConfirm,
                params: {
                  networkId,
                  accountId: account.id,
                  unsignedMessage: {
                    type: EMessageTypesEth.TYPED_DATA_V4,
                    message,
                    payload: [account.address, message],
                  },
                  sourceInfo: buildWcPaySourceInfo({
                    method,
                    params: parsed,
                    scope: 'ethereum',
                  }),
                  onSuccess: (result: string) => resolve(result),
                  onFail: (error: Error) => reject(error),
                  onCancel: () =>
                    reject(
                      new WcPayUserCancelledError('User canceled payment'),
                    ),
                },
              });
            });
            results.push(signature);
            await persistActionResult(i, signature);
            break;
          }
          case EWcPayActionMethod.PersonalSign: {
            // normalize un-prefixed hex payloads like every other
            // personal_sign entry point, so the signed bytes match the
            // counterparty's expectation
            const message = autoFixPersonalSignMessage({
              message: extractWcPayPersonalSignMessage({
                parsed,
                accountAddress: account.address,
              }),
            });
            const signature = await new Promise<string>((resolve, reject) => {
              navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                screen: EModalSignatureConfirmRoutes.MessageConfirm,
                params: {
                  networkId,
                  accountId: account.id,
                  unsignedMessage: {
                    type: EMessageTypesEth.PERSONAL_SIGN,
                    message,
                    payload: [message, account.address],
                  },
                  sourceInfo: buildWcPaySourceInfo({
                    method,
                    params: parsed,
                    scope: 'ethereum',
                  }),
                  onSuccess: (result: string) => resolve(result),
                  onFail: (error: Error) => reject(error),
                  onCancel: () =>
                    reject(
                      new WcPayUserCancelledError('User canceled payment'),
                    ),
                },
              });
            });
            results.push(signature);
            await persistActionResult(i, signature);
            break;
          }
          case EWcPayActionMethod.SolanaSignTransaction: {
            const encodedTx = wcPaySolanaTxToEncodedTx(
              extractWcPaySolanaTransaction(parsed),
            );
            const unsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  networkId,
                  accountId: account.id,
                  encodedTx,
                },
              );
            const rawTx = await new Promise<string>((resolve, reject) => {
              navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                screen: EModalSignatureConfirmRoutes.TxConfirm,
                params: {
                  networkId,
                  accountId: account.id,
                  unsignedTxs: [unsignedTx],
                  // WalletConnect Pay submits the signed transaction itself;
                  // the wallet must sign only and never broadcast
                  signOnly: true,
                  // the Pay server fixed the fee inside the tx blob; block the
                  // fee flow from rewriting it before signing (sol vault
                  // attaches a priority-fee instruction unless this is false)
                  feeInfoEditable: false,
                  sourceInfo: buildWcPaySourceInfo({
                    method,
                    params: parsed,
                    scope: 'solana',
                  }),
                  onSuccess: (txs: ISendTxOnSuccessData[]) => {
                    const raw = txs?.[0]?.signedTx?.rawTx;
                    if (raw) {
                      resolve(raw);
                    } else {
                      reject(
                        new OneKeyLocalError('Missing signed transaction'),
                      );
                    }
                  },
                  onFail: (error: Error) => reject(error),
                  onCancel: () =>
                    reject(
                      new WcPayUserCancelledError('User canceled payment'),
                    ),
                },
              });
            });
            // confirmPayment expects the full signed transaction; sol
            // signedTx.rawTx is already base64, pass through unchanged
            results.push(rawTx);
            await persistActionResult(i, rawTx);
            break;
          }
          default:
            // never skip unknown actions: results must match actions exactly
            throw new OneKeyLocalError(
              `Unsupported WalletConnect Pay method: ${method}`,
            );
        }
      }

      return results;
    },
    [navigation],
  );

  return { executeActions };
}
