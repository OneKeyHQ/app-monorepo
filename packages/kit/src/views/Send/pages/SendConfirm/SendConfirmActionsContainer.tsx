import { memo, useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, Toast, usePageUnMounted } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  usePreCheckTxStatusAtom,
  useSendConfirmActions,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useTokenApproveInfoAtom,
  useTxAdvancedSettingsAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { checkIsEmptyData } from '@onekeyhq/kit-bg/src/vaults/impls/evm/decoder/utils';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { getTxnType } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import {
  EReplaceTxType,
  type IReplaceTxInfo,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { usePreCheckFeeInfo } from '../../hooks/usePreCheckFeeInfo';

import TxFeeContainer from './TxFeeContainer';

type IProps = {
  accountId: string;
  networkId: string;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
  sourceInfo?: IDappSourceInfo;
  signOnly?: boolean;
  transferPayload: ITransferPayload | undefined;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
};

function SendConfirmActionsContainer(props: IProps) {
  const {
    accountId,
    networkId,
    onSuccess,
    onFail,
    onCancel,
    sourceInfo,
    signOnly,
    transferPayload,
    useFeeInTx,
    feeInfoEditable,
  } = props;
  const intl = useIntl();
  const isSubmitted = useRef(false);
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();
  const [preCheckTxStatus] = usePreCheckTxStatusAtom();
  const [tokenApproveInfo] = useTokenApproveInfoAtom();
  const [txAdvancedSettings] = useTxAdvancedSettingsAtom();
  const { updateSendTxStatus } = useSendConfirmActions().current;
  const successfullySentTxs = useRef<string[]>([]);

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const vaultSettings = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      }),
    [networkId],
  ).result;

  const { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm } =
    usePreCheckFeeInfo({
      accountId,
      networkId,
    });

  const handleOnConfirm = useCallback(async () => {
    const { serviceSend } = backgroundApiProxy;

    updateSendTxStatus({ isSubmitting: true });
    isSubmitted.current = true;

    // Pre-check before submit
    try {
      await serviceSend.precheckUnsignedTxs({
        networkId,
        accountId,
        unsignedTxs,
        nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
          ? {
              maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
            }
          : undefined,
        precheckTiming: ESendPreCheckTimingEnum.Confirm,
        feeInfos: sendSelectedFeeInfo?.feeInfos,
      });
    } catch (e: any) {
      updateSendTxStatus({ isSubmitting: false });
      onFail?.(e as Error);
      isSubmitted.current = false;
      void dappApprove.reject(e);
      throw e;
    }

    let newUnsignedTxs: IUnsignedTxPro[];
    try {
      newUnsignedTxs = await serviceSend.updateUnSignedTxBeforeSend({
        accountId,
        networkId,
        unsignedTxs,
        tokenApproveInfo,
        feeInfos: sendSelectedFeeInfo?.feeInfos,
        nonceInfo: txAdvancedSettings.nonce
          ? { nonce: Number(txAdvancedSettings.nonce) }
          : undefined,
        nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
          ? {
              maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
            }
          : undefined,
      });
    } catch (e: any) {
      updateSendTxStatus({ isSubmitting: false });
      onFail?.(e as Error);
      isSubmitted.current = false;
      void dappApprove.reject(e);
      throw e;
    }

    // fee info pre-check
    if (sendSelectedFeeInfo) {
      const isFeeInfoOverflow = await checkFeeInfoIsOverflow({
        feeAmount: sendSelectedFeeInfo.feeInfos?.[0]?.totalNative,
        feeSymbol:
          sendSelectedFeeInfo.feeInfos?.[0]?.feeInfo?.common?.nativeSymbol,
        encodedTx: newUnsignedTxs[0].encodedTx,
      });

      if (isFeeInfoOverflow) {
        const isConfirmed = await showFeeInfoOverflowConfirm();
        if (!isConfirmed) {
          isSubmitted.current = false;
          updateSendTxStatus({ isSubmitting: false });
          return;
        }
      }
    }

    try {
      let replaceTxInfo: IReplaceTxInfo | undefined;
      if (
        vaultSettings?.replaceTxEnabled &&
        newUnsignedTxs.length === 1 &&
        !isNil(newUnsignedTxs[0].nonce)
      ) {
        const encodedTx = unsignedTxs[0].encodedTx as IEncodedTxEvm;
        const localPendingTxs =
          await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
            accountId,
            networkId,
          });
        const localPendingTxWithSameNonce = localPendingTxs.find((tx) =>
          new BigNumber(tx.decodedTx.nonce).isEqualTo(
            newUnsignedTxs[0].nonce as number,
          ),
        );
        if (localPendingTxWithSameNonce) {
          replaceTxInfo = {
            replaceType:
              new BigNumber(encodedTx.value).isZero() &&
              checkIsEmptyData(encodedTx.data)
                ? EReplaceTxType.Cancel
                : EReplaceTxType.SpeedUp,
            replaceHistoryId: localPendingTxWithSameNonce.id,
          };
        }
      }

      const result =
        await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: newUnsignedTxs,
          feeInfos: sendSelectedFeeInfo?.feeInfos,
          signOnly,
          sourceInfo,
          replaceTxInfo,
          transferPayload,
          successfullySentTxs: successfullySentTxs.current,
        });

      const transferInfo = newUnsignedTxs?.[0].transfersInfo?.[0];
      const swapInfo = newUnsignedTxs?.[0].swapInfo;
      const stakingInfo = newUnsignedTxs?.[0].stakingInfo;
      defaultLogger.transaction.send.sendConfirm({
        network: networkId,
        txnType: getTxnType({
          actions: result?.[0].decodedTx.actions,
          swapInfo,
          stakingInfo,
        }),
        tokenAddress: transferInfo?.tokenInfo?.address,
        tokenSymbol: transferInfo?.tokenInfo?.symbol,
        tokenType: transferInfo?.nftInfo ? 'NFT' : 'Token',
        interactContract: undefined,
      });

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_transaction_submitted,
        }),
      });

      const signedTx = result[0].signedTx;

      void dappApprove.resolve({ result: signedTx });

      navigation.popStack();
      updateSendTxStatus({ isSubmitting: false });
      onSuccess?.(result);
    } catch (e: any) {
      updateSendTxStatus({ isSubmitting: false });
      // show toast by @toastIfError() in background method
      // Toast.error({
      //   title: (e as Error).message,
      // });
      onFail?.(e as Error);
      isSubmitted.current = false;
      void dappApprove.reject(e);
      throw e;
    }
  }, [
    updateSendTxStatus,
    sendSelectedFeeInfo,
    networkId,
    accountId,
    unsignedTxs,
    nativeTokenTransferAmountToUpdate.isMaxSend,
    nativeTokenTransferAmountToUpdate.amountToUpdate,
    onFail,
    dappApprove,
    tokenApproveInfo,
    txAdvancedSettings.nonce,
    checkFeeInfoIsOverflow,
    showFeeInfoOverflowConfirm,
    vaultSettings?.replaceTxEnabled,
    signOnly,
    sourceInfo,
    transferPayload,
    intl,
    navigation,
    onSuccess,
  ]);

  const cancelCalledRef = useRef(false);
  const onCancelOnce = useCallback(() => {
    if (cancelCalledRef.current) {
      return;
    }
    cancelCalledRef.current = true;
    onCancel?.();
  }, [onCancel]);

  const handleOnCancel = useCallback(
    (close: () => void, closePageStack: () => void) => {
      dappApprove.reject();
      if (!sourceInfo) {
        closePageStack();
      } else {
        close();
      }
      onCancelOnce();
    },
    [dappApprove, onCancelOnce, sourceInfo],
  );

  const isSubmitDisabled = useMemo(() => {
    if (sendTxStatus.isSubmitting) return true;
    if (nativeTokenInfo.isLoading || sendTxStatus.isInsufficientNativeBalance)
      return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.errMessage) return true;
    if (preCheckTxStatus.errorMessage) return true;
    if (txAdvancedSettings.dataChanged) return true;
  }, [
    sendTxStatus.isSubmitting,
    sendTxStatus.isInsufficientNativeBalance,
    nativeTokenInfo.isLoading,
    sendSelectedFeeInfo,
    sendFeeStatus.errMessage,
    preCheckTxStatus.errorMessage,
    txAdvancedSettings.dataChanged,
  ]);

  usePageUnMounted(() => {
    if (!isSubmitted.current) {
      onCancelOnce();
    }
  });

  return (
    <Page.Footer disableKeyboardAnimation>
      <Page.FooterActions
        confirmButtonProps={{
          disabled: isSubmitDisabled,
          loading: sendTxStatus.isSubmitting,
        }}
        cancelButtonProps={{
          disabled: sendTxStatus.isSubmitting,
        }}
        onConfirmText={
          signOnly
            ? intl.formatMessage({ id: ETranslations.global_sign })
            : intl.formatMessage({ id: ETranslations.global_confirm })
        }
        onConfirm={handleOnConfirm}
        onCancel={handleOnCancel}
      >
        <TxFeeContainer
          accountId={accountId}
          networkId={networkId}
          useFeeInTx={useFeeInTx}
          feeInfoEditable={feeInfoEditable}
        />
      </Page.FooterActions>
    </Page.Footer>
  );
}

export default memo(SendConfirmActionsContainer);
