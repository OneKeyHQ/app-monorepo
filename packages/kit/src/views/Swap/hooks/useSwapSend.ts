import { useCallback } from 'react';
import type {
  IEncodedTx,
  IDecodedTx,
  ISignedTxPro
} from '@onekeyhq/engine/src/vaults/types';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { SwapRoutes } from '../typings';
import { SendRoutes } from '../../Send/types';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppSelector } from '../../../hooks/useAppSelector';


type SendSuccessCallback = (param: { result: ISignedTxPro, decodedTx?: IDecodedTx }) => void

type SwapSendParams = {
  encodedTx: IEncodedTx;
  accountId: string;
  networkId: string;
  payloadInfo?: any;
  gasEstimateFallback?: boolean;
  onSuccess?: SendSuccessCallback
}

// type SendTxnsParams = {
//   accountId: string;
//   networkId: string;
//   txns: { tx: IEncodedTx, onSuccess?: SendSuccessCallback }[]
// }

export function useSwapSend() {
  const navigation = useAppNavigation()
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  return useCallback(async ({
    encodedTx,
    accountId,
    networkId,
    payloadInfo,
    onSuccess,
    gasEstimateFallback
  }: SwapSendParams) => {
    const walletId = getWalletIdFromAccountId(accountId);
    const wallet = await backgroundApiProxy.engine.getWallet(walletId);
    const password = await backgroundApiProxy.servicePassword.getPassword();
    const secretFree = password && !validationSetting?.Payment
    if (wallet.type === 'hw' || (wallet.type !== 'external' && secretFree)) {
      const { result, decodedTx } = await backgroundApiProxy.serviceSwap.sendTransaction({
        accountId,
        networkId,
        encodedTx,
        autoFallback: gasEstimateFallback,
      });
      onSuccess?.({ result, decodedTx })
    } else {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            accountId: accountId,
            networkId: networkId,
            payloadInfo,
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx,
            onDetail(txid) {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Swap,
                params: {
                  screen: SwapRoutes.Transaction,
                  params: {
                    txid,
                  },
                },
              });
            },
            onSuccess: (result, data) => {
             onSuccess?.({ result, decodedTx: data?.decodedTx ?? undefined })
            },
          },
        },
      });
    }
  }, [validationSetting])
}