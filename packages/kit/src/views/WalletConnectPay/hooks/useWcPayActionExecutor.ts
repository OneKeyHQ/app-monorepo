import { useCallback } from 'react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
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

function extractTypedDataMessage(parsed: unknown): string {
  if (Array.isArray(parsed)) {
    // params are usually [address, typedData]; find the non-address element
    const candidate = parsed.find(
      (item) =>
        (typeof item === 'string' && item.trim().startsWith('{')) ||
        (typeof item === 'object' && item !== null),
    );
    if (candidate) {
      return typeof candidate === 'string'
        ? candidate
        : JSON.stringify(candidate);
    }
  }
  if (typeof parsed === 'string') {
    return parsed;
  }
  return JSON.stringify(parsed);
}

function extractPersonalSignMessage({
  parsed,
  accountAddress,
}: {
  parsed: unknown;
  accountAddress: string;
}): string {
  if (Array.isArray(parsed)) {
    // convention is [message, address], but some senders flip the order
    const [first, second] = parsed as string[];
    if (
      typeof first === 'string' &&
      first.toLowerCase() === accountAddress.toLowerCase() &&
      typeof second === 'string'
    ) {
      return second;
    }
    if (typeof first === 'string') {
      return first;
    }
  }
  if (typeof parsed === 'string') {
    return parsed;
  }
  throw new OneKeyLocalError('Invalid personal_sign params');
}

export function useWcPayActionExecutor() {
  const navigation = useAppNavigation();

  const executeActions = useCallback(
    async ({
      actions,
      accountId,
      indexedAccountId,
      completedResults,
      onActionComplete,
    }: {
      actions: IWcPayAction[];
      accountId?: string;
      indexedAccountId?: string;
      // results of actions already executed in a previous partially-failed
      // attempt of the same payment option; execution resumes after them so
      // an already-broadcast transaction is never sent twice
      completedResults?: string[];
      // reports each action result as soon as it exists, so the caller can
      // persist progress even when a later action in the sequence rejects
      onActionComplete?: (params: { index: number; result: string }) => void;
    }): Promise<string[]> => {
      const startIndex = Math.min(
        completedResults?.length ?? 0,
        actions.length,
      );
      const results: string[] = (completedResults ?? []).slice(
        0,
        actions.length,
      );

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
            await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined({
              networkId: prevNetworkId,
              accountId: prevAccount.id,
              txid: prevTxid,
            });
          }
        }
      }

      for (let i = startIndex; i < actions.length; i += 1) {
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
            const txid = await new Promise<string>((resolve, reject) => {
              navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
                screen: EModalSignatureConfirmRoutes.TxConfirm,
                params: {
                  networkId,
                  accountId: account.id,
                  unsignedTxs: [unsignedTx],
                  // the gas params provided by WalletConnect Pay are hints;
                  // let the wallet estimate fees like a normal send
                  useFeeInTx: false,
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
            results.push(txid);
            // record the txid immediately: the tx is already on-chain, so a
            // failure in any later step (including the mined-wait below) must
            // not lose it, or a retry would broadcast a duplicate payment
            onActionComplete?.({ index: i, result: txid });
            // Permit2 flow: the approve must be mined before signing the
            // follow-up typed data
            if (i < actions.length - 1) {
              await backgroundApiProxy.serviceWalletConnectPay.waitForTxMined({
                networkId,
                accountId: account.id,
                txid,
              });
            }
            break;
          }
          case EWcPayActionMethod.EthSignTypedDataV4: {
            const message = extractTypedDataMessage(parsed);
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
            onActionComplete?.({ index: i, result: signature });
            break;
          }
          case EWcPayActionMethod.PersonalSign: {
            // normalize un-prefixed hex payloads like every other
            // personal_sign entry point, so the signed bytes match the
            // counterparty's expectation
            const message = autoFixPersonalSignMessage({
              message: extractPersonalSignMessage({
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
            onActionComplete?.({ index: i, result: signature });
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
            onActionComplete?.({ index: i, result: rawTx });
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
