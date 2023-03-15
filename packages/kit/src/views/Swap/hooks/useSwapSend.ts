import { useCallback } from 'react';

import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import type {
  IDecodedTx,
  IEncodedTx,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { deviceUtils } from '../../../utils/hardware';
import { SendRoutes } from '../../Send/types';

type SendSuccessCallback = (param: {
  result: ISignedTxPro;
  decodedTx?: IDecodedTx;
}) => Promise<void>;

type SwapSendParams = {
  encodedTx: IEncodedTx;
  accountId: string;
  networkId: string;
  payloadInfo?: any;
  gasEstimateFallback?: boolean;
  onDetail?: (txid: string) => any;
  onFail?: (e: Error) => void;
  onSuccess?: SendSuccessCallback;
  showSendFeedbackReceipt?: boolean;
};

// type SendTxnsParams = {
//   accountId: string;
//   networkId: string;
//   txns: { tx: IEncodedTx, onSuccess?: SendSuccessCallback }[]
// }

export function useSwapSend() {
  const navigation = useAppNavigation();
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  return useCallback(
    async ({
      encodedTx,
      accountId,
      networkId,
      payloadInfo,
      onFail,
      onSuccess,
      onDetail,
      gasEstimateFallback,
      showSendFeedbackReceipt,
    }: SwapSendParams) => {
      const walletId = getWalletIdFromAccountId(accountId);
      const wallet = await backgroundApiProxy.engine.getWallet(walletId);
      const password = await backgroundApiProxy.servicePassword.getPassword();
      const secretFree = password && !validationSetting?.Payment;
      if (wallet.type === 'hw' || (wallet.type !== 'external' && secretFree)) {
        try {
          const { result, decodedTx } =
            await backgroundApiProxy.serviceSwap.sendTransaction({
              accountId,
              networkId,
              encodedTx,
              payload: payloadInfo,
              autoFallback: gasEstimateFallback,
            });
          await onSuccess?.({ result, decodedTx });
          if (showSendFeedbackReceipt) {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendFeedbackReceipt,
                params: {
                  networkId,
                  accountId,
                  txid: result.txid,
                  type: 'Send',
                },
              },
            });
          }
        } catch (e: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          deviceUtils.showErrorToast(e, e?.data?.message || e.message);
          onFail?.(e as Error);
        }
      } else {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendRoutes.SendConfirm,
            params: {
              accountId,
              networkId,
              payloadInfo,
              feeInfoEditable: true,
              feeInfoUseFeeInTx: false,
              encodedTx,
              onDetail,
              onSuccess: (result, data) => {
                onSuccess?.({
                  result,
                  decodedTx: data?.decodedTx ?? undefined,
                });
              },
            },
          },
        });
      }
    },
    [validationSetting, navigation],
  );
}
