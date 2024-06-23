import { memo, useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  useSendConfirmActions,
  useSendSelectedFeeInfoAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { getMaxSendFeeUpwardAdjustmentFactor } from '@onekeyhq/kit/src/utils/gasFee';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  calculateNativeAmountInActions,
  isSendNativeTokenAction,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

type IProps = {
  accountId: string;
  networkId: string;
  transferPayload?: ITransferPayload;
};

function TxActionsContainer(props: IProps) {
  const { accountId, networkId, transferPayload } = props;
  const {
    updateNativeTokenTransferAmount,
    updateNativeTokenTransferAmountToUpdate,
  } = useSendConfirmActions().current;
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [isSendNativeToken, setIsSendNativeToken] = useState(false);
  const { vaultSettings } = useAccountData({ networkId });

  const r = usePromiseResult(
    () =>
      Promise.all(
        unsignedTxs.map((unsignedTx) =>
          backgroundApiProxy.serviceSend.buildDecodedTx({
            accountId,
            networkId,
            unsignedTx,
          }),
        ),
      ),
    [accountId, networkId, unsignedTxs],
  );

  useEffect(() => {
    const decodedTxs = r.result ?? [];

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
      setIsSendNativeToken(true);
      nativeTokenTransferBN = new BigNumber(
        transferPayload?.amountToSend ?? nativeTokenTransferBN,
      );
      const nativeTokenBalanceBN = new BigNumber(nativeTokenInfo.balance);
      const feeBN = new BigNumber(sendSelectedFeeInfo?.totalNative ?? 0);

      if (
        transferPayload?.isMaxSend &&
        nativeTokenTransferBN.plus(feeBN).gte(nativeTokenBalanceBN)
      ) {
        const transferAmountBN = BigNumber.min(
          nativeTokenBalanceBN,
          nativeTokenTransferBN,
        );
        const amountToUpdate = transferAmountBN.minus(
          feeBN.times(getMaxSendFeeUpwardAdjustmentFactor({ networkId })),
        );
        if (amountToUpdate.gte(0)) {
          updateNativeTokenTransferAmountToUpdate({
            isMaxSend: true,
            amountToUpdate: amountToUpdate.toFixed(),
          });
        } else {
          updateNativeTokenTransferAmountToUpdate({
            isMaxSend: false,
            amountToUpdate: vaultSettings?.isUtxo
              ? nativeTokenTransferBN.toFixed()
              : transferPayload?.amountToSend ??
                nativeTokenTransferBN.toFixed(),
          });
        }
      } else {
        updateNativeTokenTransferAmountToUpdate({
          isMaxSend: false,
          amountToUpdate: vaultSettings?.isUtxo
            ? nativeTokenTransferBN.toFixed()
            : transferPayload?.amountToSend ?? nativeTokenTransferBN.toFixed(),
        });
      }
    }

    updateNativeTokenTransferAmount(nativeTokenTransferBN.toFixed());
  }, [
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    networkId,
    r.result,
    sendSelectedFeeInfo,
    sendSelectedFeeInfo?.totalNative,
    transferPayload,
    transferPayload?.amountToSend,
    updateNativeTokenTransferAmount,
    updateNativeTokenTransferAmountToUpdate,
    vaultSettings?.ignoreUpdateNativeAmount,
    vaultSettings?.isUtxo,
  ]);

  const renderActions = useCallback(() => {
    const decodedTxs = r.result ?? [];

    if (nativeTokenInfo.isLoading) {
      return (
        <InfoItemGroup>
          <InfoItem
            label={
              <Stack py="$1">
                <Skeleton height="$3" width="$12" />
              </Stack>
            }
            renderContent={
              <XStack space="$3" alignItems="center">
                <Skeleton height="$10" width="$10" radius="round" />
                <Stack>
                  <Stack py="$1.5">
                    <Skeleton height="$3" width="$24" />
                  </Stack>
                  <Stack py="$1">
                    <Skeleton height="$3" width="$12" />
                  </Stack>
                </Stack>
              </XStack>
            }
          />
          <InfoItem
            label={
              <Stack py="$1">
                <Skeleton height="$3" width="$8" />
              </Stack>
            }
            renderContent={
              <Stack py="$1">
                <Skeleton height="$3" width="$56" />
              </Stack>
            }
          />
          <InfoItem
            label={
              <Stack py="$1">
                <Skeleton height="$3" width="$8" />
              </Stack>
            }
            renderContent={
              <Stack py="$1">
                <Skeleton height="$3" width="$56" />
              </Stack>
            }
          />
        </InfoItemGroup>
      );
    }

    return decodedTxs.map((decodedTx, index) => (
      <TxActionsListView
        key={index}
        componentType={ETxActionComponentType.DetailView}
        decodedTx={decodedTx}
        isSendNativeToken={isSendNativeToken}
        nativeTokenTransferAmountToUpdate={
          nativeTokenTransferAmountToUpdate.amountToUpdate
        }
      />
    ));
  }, [
    isSendNativeToken,
    nativeTokenInfo.isLoading,
    nativeTokenTransferAmountToUpdate.amountToUpdate,
    r.result,
  ]);

  return <>{renderActions()}</>;
}

export default memo(TxActionsContainer);
