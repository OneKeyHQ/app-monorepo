import { useCallback } from 'react';

import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IDecodedTx,
  IEncodedTx,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { deviceUtils } from '../../../utils/hardware';
import { SendModalRoutes } from '../../Send/types';
import { LoggerTimerTags, createLoggerTimer } from '../utils';

export type SendSuccessCallback = (param: {
  result: ISignedTxPro;
  decodedTx?: IDecodedTx;
}) => Promise<void>;

type SendMessageSuccessCallback = (param: string) => Promise<void>;

type SwapSendParams = {
  encodedTx: IEncodedTx;
  accountId: string;
  networkId: string;
  payloadInfo?: any;
  gasEstimateFallback?: boolean;
  prepaidFee?: string;
  onDetail?: (txid: string) => any;
  onFail?: (e: Error) => void;
  onSuccess?: SendSuccessCallback;
  showSendFeedbackReceipt?: boolean;
};

type SwapSignMessageParams = {
  accountId: string;
  networkId: string;
  unsignedMessage: IUnsignedMessageEvm;
  onSuccess?: SendMessageSuccessCallback;
  onFail?: () => void;
};

export function useSwapSend() {
  const navigation = useAppNavigation();
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  return useCallback(
    async ({
      encodedTx,
      accountId,
      networkId,
      payloadInfo,
      prepaidFee,
      onFail,
      onSuccess,
      onDetail,
      gasEstimateFallback,
      showSendFeedbackReceipt,
    }: SwapSendParams) => {
      const tagLogger = createLoggerTimer();
      const walletId = getWalletIdFromAccountId(accountId);
      const wallet = await backgroundApiProxy.engine.getWallet(walletId);
      const password = await backgroundApiProxy.servicePassword.getPassword();
      const secretFree = password && !validationSetting?.Payment;
      if (wallet.type === 'hw' || (wallet.type !== 'external' && secretFree)) {
        try {
          tagLogger.start(LoggerTimerTags.sendTransaction);
          const { result, decodedTx } =
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId,
              networkId,
              encodedTx,
              payload: payloadInfo,
              autoFallback: gasEstimateFallback,
              prepaidFee,
            });
          tagLogger.end(LoggerTimerTags.sendTransaction);
          await onSuccess?.({ result, decodedTx });
          if (showSendFeedbackReceipt) {
            setTimeout(() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Send,
                params: {
                  screen: SendModalRoutes.SendFeedbackReceipt,
                  params: {
                    networkId,
                    accountId,
                    txid: result.txid,
                    type: 'Send',
                  },
                },
              });
            }, 10);
          }
        } catch (e: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const message = e?.data?.message || e.message;
          debugLogger.swap.error(
            `swap send failed with message ${message as string}`,
          );
          deviceUtils.showErrorToast(e, message);
          onFail?.(e as Error);
        }
      } else {
        const delay = platformEnv.isNative ? 10 : 100;
        setTimeout(() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendModalRoutes.SendConfirm,
              params: {
                accountId,
                networkId,
                payloadInfo,
                feeInfoEditable: true,
                feeInfoUseFeeInTx: false,
                encodedTx,
                prepaidFee,
                hideSendFeedbackReceipt: !showSendFeedbackReceipt,
                onDetail,
                onFail,
                onSuccess: (result, data) => {
                  onSuccess?.({
                    result,
                    decodedTx: data?.decodedTx ?? undefined,
                  });
                },
              },
            },
          });
        }, delay);
      }
    },
    [validationSetting, navigation],
  );
}

export function useSwapSignMessage() {
  const navigation = useAppNavigation();
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  return useCallback(
    async ({
      accountId,
      networkId,
      unsignedMessage,
      onSuccess,
      onFail,
    }: SwapSignMessageParams) => {
      const tagLogger = createLoggerTimer();
      const walletId = getWalletIdFromAccountId(accountId);
      const wallet = await backgroundApiProxy.engine.getWallet(walletId);
      const password = await backgroundApiProxy.servicePassword.getPassword();
      const secretFree = password && !validationSetting?.Payment;
      if (wallet.type === 'hw' || (wallet.type !== 'external' && secretFree)) {
        try {
          tagLogger.start(LoggerTimerTags.signMessage);
          const result =
            await backgroundApiProxy.serviceTransaction.signMessage({
              accountId,
              networkId,
              unsignedMessage,
            });
          tagLogger.end(LoggerTimerTags.signMessage);
          await onSuccess?.(result);
        } catch (e: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          deviceUtils.showErrorToast(e, e?.data?.message || e.message);
          onFail?.();
        }
      } else {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.SignMessageConfirm,
            params: {
              accountId,
              networkId,
              unsignedMessage,
              onSuccess,
              onFail,
            },
          },
        });
      }
    },
    [navigation, validationSetting],
  );
}
