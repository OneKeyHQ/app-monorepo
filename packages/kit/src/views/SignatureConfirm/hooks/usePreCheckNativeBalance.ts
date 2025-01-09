import BigNumber from 'bignumber.js';

import {
  useDecodedTxsAtom,
  useNativeTokenInfoAtom,
  useSendSelectedFeeInfoAtom,
  useSignatureConfirmActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  calculateNativeAmountInActions,
  isSendNativeTokenAction,
} from '@onekeyhq/shared/src/utils/txActionUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

function usePreCheckNativeBalance({
  networkId,
  transferPayload,
}: {
  networkId: string;
  transferPayload?: ITransferPayload;
}) {
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [{ decodedTxs, isBuildingDecodedTxs }] = useDecodedTxsAtom();
  const {
    updateNativeTokenTransferAmount,
    updateNativeTokenTransferAmountToUpdate,
    updateSendTxStatus,
  } = useSignatureConfirmActions().current;
  usePromiseResult(async () => {
    if (isBuildingDecodedTxs) {
      return;
    }

    const [vaultSettings, network] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      }),
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    ]);

    let nativeTokenTransferBN = new BigNumber(0);
    decodedTxs.forEach((decodedTx) => {
      nativeTokenTransferBN = nativeTokenTransferBN.plus(
        decodedTx.nativeAmount ??
          calculateNativeAmountInActions(decodedTx.actions).nativeAmount ??
          0,
      );
    });

    if (
      !vaultSettings?.ignoreUpdateNativeAmount &&
      !nativeTokenInfo.isLoading
    ) {
      let isSendNativeTokenOnly = false;

      if (
        decodedTxs.length === 1 &&
        decodedTxs[0].actions.length === 1 &&
        isSendNativeTokenAction(decodedTxs[0].actions[0])
      ) {
        updateSendTxStatus({
          isSendNativeTokenOnly: true,
        });
        isSendNativeTokenOnly = true;
      }

      if (
        isSendNativeTokenOnly &&
        !vaultSettings?.maxSendCanNotSentFullAmount
      ) {
        nativeTokenTransferBN = new BigNumber(
          transferPayload?.amountToSend ?? nativeTokenTransferBN,
        );
      }

      const nativeTokenBalanceBN = new BigNumber(nativeTokenInfo.balance);
      const feeBN = new BigNumber(sendSelectedFeeInfo?.totalNative ?? 0);

      if (
        transferPayload?.isMaxSend &&
        isSendNativeTokenOnly &&
        nativeTokenTransferBN.plus(feeBN).gte(nativeTokenBalanceBN)
      ) {
        const transferAmountBN = BigNumber.min(
          nativeTokenBalanceBN,
          nativeTokenTransferBN,
        );

        const amountToUpdate = transferAmountBN.minus(
          feeBN.times(network?.feeMeta.maxSendFeeUpRatio ?? 1),
        );

        if (amountToUpdate.gte(0)) {
          updateNativeTokenTransferAmountToUpdate({
            isMaxSend: true,
            amountToUpdate: amountToUpdate.toFixed(),
          });
        } else {
          updateNativeTokenTransferAmountToUpdate({
            isMaxSend: false,
            amountToUpdate: nativeTokenTransferBN.toFixed(),
          });
        }
      } else {
        updateNativeTokenTransferAmountToUpdate({
          isMaxSend: false,
          amountToUpdate: nativeTokenTransferBN.toFixed(),
        });
      }
    }

    updateNativeTokenTransferAmount(nativeTokenTransferBN.toFixed());
  }, [
    decodedTxs,
    isBuildingDecodedTxs,
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    networkId,
    sendSelectedFeeInfo?.totalNative,
    transferPayload?.amountToSend,
    transferPayload?.isMaxSend,
    updateNativeTokenTransferAmount,
    updateNativeTokenTransferAmountToUpdate,
    updateSendTxStatus,
  ]);
}

export { usePreCheckNativeBalance };
