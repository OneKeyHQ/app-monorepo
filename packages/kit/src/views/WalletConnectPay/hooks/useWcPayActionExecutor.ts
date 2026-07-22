import { useCallback } from 'react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { wcPayChainIdToNetworkId } from '@onekeyhq/shared/src/walletConnect/payConstant';
import {
  EWcPayActionMethod,
  type IWcPayAction,
} from '@onekeyhq/shared/src/walletConnect/payTypes';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

// small pause so a finished confirm modal fully dismisses before the next one
const MODAL_TRANSITION_MS = 300;

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
    }: {
      actions: IWcPayAction[];
      accountId?: string;
      indexedAccountId?: string;
    }): Promise<string[]> => {
      const results: string[] = [];

      for (let i = 0; i < actions.length; i += 1) {
        const { chainId, method, params } = actions[i].walletRpc;
        const networkId = wcPayChainIdToNetworkId(chainId);
        if (!networkId) {
          throw new OneKeyLocalError(
            `Unsupported WalletConnect Pay chain: ${chainId}`,
          );
        }
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: indexedAccountId ? undefined : accountId,
            indexedAccountId,
            networkId,
            deriveType: 'default',
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
                    reject(new OneKeyLocalError('User canceled payment')),
                },
              });
            });
            results.push(txid);
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
                  walletInternalSign: true,
                  onSuccess: (result: string) => resolve(result),
                  onFail: (error: Error) => reject(error),
                  onCancel: () =>
                    reject(new OneKeyLocalError('User canceled payment')),
                },
              });
            });
            results.push(signature);
            break;
          }
          case EWcPayActionMethod.PersonalSign: {
            const message = extractPersonalSignMessage({
              parsed,
              accountAddress: account.address,
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
                  walletInternalSign: true,
                  onSuccess: (result: string) => resolve(result),
                  onFail: (error: Error) => reject(error),
                  onCancel: () =>
                    reject(new OneKeyLocalError('User canceled payment')),
                },
              });
            });
            results.push(signature);
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
