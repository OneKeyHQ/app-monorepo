import { memo, useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Skeleton, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Container } from '@onekeyhq/kit/src/components/Container';
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
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  calculateNativeAmountInActions,
  isSendNativeTokenAction,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';

type IProps = {
  accountId: string;
  networkId: string;
  tableLayout?: boolean;
  transferPayload?: ITransferPayload;
};

function TxActionsContainer(props: IProps) {
  const { accountId, networkId, tableLayout, transferPayload } = props;
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
      !nativeTokenInfo.isLoading &&
      decodedTxs.length === 1 &&
      decodedTxs[0].actions.length === 1 &&
      isSendNativeTokenAction(decodedTxs[0].actions[0])
    ) {
      setIsSendNativeToken(true);
      nativeTokenTransferBN = new BigNumber(
        transferPayload?.amountToSend ?? nativeTokenTransferBN,
      );
      const nativeTokenBalanceBN = new BigNumber(nativeTokenInfo.balance);
      const feeBN = new BigNumber(sendSelectedFeeInfo?.totalNative ?? 0);
      if (nativeTokenTransferBN.plus(feeBN).gte(nativeTokenBalanceBN)) {
        const transferAmountBN = BigNumber.min(
          nativeTokenBalanceBN,
          nativeTokenTransferBN,
        );
        const amountToUpdate = transferAmountBN.minus(feeBN);
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
              : transferPayload?.amountToSend ?? nativeTokenBalanceBN.toFixed(),
          });
        }
      } else {
        updateNativeTokenTransferAmountToUpdate({
          isMaxSend: false,
          amountToUpdate: vaultSettings?.isUtxo
            ? nativeTokenTransferBN.toFixed()
            : transferPayload?.amountToSend ?? nativeTokenBalanceBN.toFixed(),
        });
      }
    }

    updateNativeTokenTransferAmount(nativeTokenTransferBN.toFixed());
  }, [
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
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
        <Container.Box>
          <Container.Item
            title={<Skeleton h="$4" w="$48" />}
            content={<Skeleton w="$80" />}
          />
          <Container.Item
            title={<Skeleton h="$4" w="$48" />}
            content={<Skeleton w="$80" />}
          />
          <Container.Item
            title={<Skeleton h="$4" w="$48" />}
            content={<Skeleton w="$80" />}
          />
        </Container.Box>
      );
    }

    return decodedTxs.map((decodedTx, index) => (
      <TxActionsListView
        key={index}
        componentType={ETxActionComponentType.DetailView}
        decodedTx={decodedTx}
        tableLayout={tableLayout}
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
    tableLayout,
  ]);

  return <YStack space="$2">{renderActions()}</YStack>;
}

export default memo(TxActionsContainer);
