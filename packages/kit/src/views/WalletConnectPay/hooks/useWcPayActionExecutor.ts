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
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

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
      onActionComplete,
      onActionInvalidated,
    }: {
      actions: IWcPayAction[];
      accountId?: string;
      indexedAccountId?: string;
      // absolute payment deadline (ms epoch, the earliest of payment-level
      // and option-level expiry). Checked at the top of every action, and
      // for eth_sendTransaction additionally enforced at the confirm click
      // (onBeforeSend) and again between signing and broadcast
      // (broadcastDeadline, background-enforced), so an on-chain transfer
      // can never start once the deadline has passed.
      expiryMs?: number;
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
      // progress even when a later action rejects or the app dies mid-flow
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

      // resuming after a mid-sequence failure: if the last completed action
      // broadcast a tx, re-verify it is mined before continuing so the
      // Permit2 "approve mined before follow-up signing" ordering holds even
      // when the original waitForTxMined was the step that failed
      if (startIndex > 0 && startIndex < actions.length) {
        const prevRpc = actions[startIndex - 1].walletRpc;
        const prevTxid = results[startIndex - 1];
        if (
          prevRpc.method === EWcPayActionMethod.EthSendTransaction &&
          prevTxid
        ) {
          const prevNetworkId = wcPayChainIdToNetworkId(prevRpc.chainId);
          if (prevNetworkId) {
            const prevDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                { networkId: prevNetworkId },
              );
            const prevAccount =
              await backgroundApiProxy.serviceAccount.getNetworkAccount({
                accountId: indexedAccountId ? undefined : accountId,
                indexedAccountId,
                networkId: prevNetworkId,
                deriveType: prevDeriveType,
              });
            const { isReverted } =
              await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined({
                networkId: prevNetworkId,
                accountId: prevAccount.id,
                txid: prevTxid,
              });
            if (isReverted) {
              // the recorded txid can never confirm; drop it from stored
              // progress so the next attempt re-executes this action instead
              // of waiting on a dead transaction until the TTL expires
              await onActionInvalidated?.({ index: startIndex - 1 });
              throw new OneKeyLocalError('Transaction reverted on chain');
            }
          }
        }
      }

      for (let i = startIndex; i < actions.length; i += 1) {
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
                },
              );
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
            // record the txid immediately: the tx is already on-chain, so a
            // failure in any later step (including the mined-wait below) must
            // not lose it, or a retry would broadcast a duplicate payment.
            // Persistence itself failing (a secure-storage write error) must
            // not abort the flow either: the txid is still in memory and
            // confirmPayment can still report it to the server, while
            // aborting here would lose both and guarantee a duplicate
            // broadcast on retry
            try {
              await onActionComplete?.({ index: i, result: txid });
            } catch (persistError) {
              console.error('wcPay persist txid failed', persistError);
            }
            // Permit2 flow: the approve must be mined before signing the
            // follow-up typed data
            if (i < actions.length - 1) {
              const { isReverted } =
                await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined(
                  {
                    networkId,
                    accountId: account.id,
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
            await onActionComplete?.({ index: i, result: signature });
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
            await onActionComplete?.({ index: i, result: signature });
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
            await onActionComplete?.({ index: i, result: rawTx });
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
