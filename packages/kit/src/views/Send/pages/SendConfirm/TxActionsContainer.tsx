import { memo, useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Skeleton, Stack, XStack } from '@onekeyhq/components';
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
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  calculateNativeAmountInActions,
  isSendNativeTokenAction,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

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
  const { vaultSettings, network } = useAccountData({ networkId });

  const r = usePromiseResult(async () => {
    const decodedTxs = await Promise.all(
      unsignedTxs.map((unsignedTx) =>
        backgroundApiProxy.serviceSend.buildDecodedTx({
          accountId,
          networkId,
          unsignedTx,
          transferPayload,
        }),
      ),
    );

    if (decodedTxs.length > 1) {
      const approveTxs = decodedTxs.filter(
        (decodedTx) =>
          decodedTx.actions.length === 1 &&
          decodedTx.actions[0].type === EDecodedTxActionType.TOKEN_APPROVE,
      );

      const transferTxs = decodedTxs.filter(
        (decodedTx) =>
          decodedTx.actions.length === 1 &&
          (decodedTx.actions[0].type === EDecodedTxActionType.ASSET_TRANSFER ||
            decodedTx.actions[0].type === EDecodedTxActionType.INTERNAL_STAKE ||
            decodedTx.actions[0].type === EDecodedTxActionType.INTERNAL_SWAP),
      );

      const swapInfo = unsignedTxs.filter((tx) => tx.swapInfo)[0]?.swapInfo;

      // approve with swap
      if (approveTxs.length > 0 && transferTxs.length > 0 && swapInfo) {
        const approveActions = approveTxs
          .flatMap((tx) => tx.actions[0].tokenApprove)
          .filter(Boolean);

        const newSwapInfo = {
          ...swapInfo,
          swapRequiredApproves: approveActions,
        };

        return {
          decodedTxs: transferTxs,
          swapInfo: newSwapInfo,
        };
      }

      return {
        decodedTxs,
        swapInfo: unsignedTxs[0]?.swapInfo,
      };
    }

    return {
      decodedTxs,
      swapInfo: unsignedTxs[0]?.swapInfo,
    };
  }, [accountId, networkId, transferPayload, unsignedTxs]);

  useEffect(() => {
    const { decodedTxs } = r.result ?? {
      decodedTxs: [],
      swapInfo: undefined,
    };

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
        setIsSendNativeToken(true);
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
    nativeTokenInfo.balance,
    nativeTokenInfo.isLoading,
    network?.feeMeta.maxSendFeeUpRatio,
    networkId,
    r.result,
    sendSelectedFeeInfo,
    sendSelectedFeeInfo?.totalNative,
    transferPayload,
    transferPayload?.amountToSend,
    updateNativeTokenTransferAmount,
    updateNativeTokenTransferAmountToUpdate,
    vaultSettings?.ignoreUpdateNativeAmount,
    vaultSettings?.maxSendCanNotSentFullAmount,
    vaultSettings?.maxSendFeeUpRatio,
  ]);

  const renderActions = useCallback(() => {
    const { decodedTxs, swapInfo } = r.result ?? {
      decodedTxs: [],
      swapInfo: undefined,
    };

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
              <XStack gap="$3" alignItems="center">
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
        swapInfo={swapInfo}
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
