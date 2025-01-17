import { memo, useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  Page,
  Stack,
  Toast,
  usePageUnMounted,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDecodedTxsAtom,
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  usePreCheckTxStatusAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useSignatureConfirmActions,
  useTxAdvancedSettingsAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { checkIsEmptyData } from '@onekeyhq/shared/src/utils/evmUtils';
import { getTxnType } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import {
  EReplaceTxType,
  type IReplaceTxInfo,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { usePreCheckFeeInfo } from '../../hooks/usePreCheckFeeInfo';
import TxFeeInfo from '../TxFee';

type IProps = {
  accountId: string;
  networkId: string;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
  sourceInfo?: IDappSourceInfo;
  signOnly?: boolean;
  transferPayload?: ITransferPayload;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
  popStack?: boolean;
};

function TxConfirmActions(props: IProps) {
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
    popStack = true,
  } = props;
  const intl = useIntl();
  const isSubmitted = useRef(false);
  const [continueOperate, setContinueOperate] = useState(false);

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
  const [txAdvancedSettings] = useTxAdvancedSettingsAtom();
  const [{ isBuildingDecodedTxs, decodedTxs }] = useDecodedTxsAtom();
  const { updateSendTxStatus } = useSignatureConfirmActions().current;
  const successfullySentTxs = useRef<string[]>([]);
  const { bottom } = useSafeAreaInsets();

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
        feeInfos: sendSelectedFeeInfo?.feeInfos,
        nonceInfo: txAdvancedSettings.nonce
          ? { nonce: Number(txAdvancedSettings.nonce) }
          : undefined,
        nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
          ? {
              maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
            }
          : undefined,
        feeInfoEditable,
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

      if (popStack) {
        navigation.popStack();
      } else {
        navigation.pop();
      }
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
    txAdvancedSettings.nonce,
    feeInfoEditable,
    checkFeeInfoIsOverflow,
    showFeeInfoOverflowConfirm,
    vaultSettings?.replaceTxEnabled,
    signOnly,
    sourceInfo,
    transferPayload,
    intl,
    popStack,
    onSuccess,
    navigation,
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

  const showTakeRiskAlert = useMemo(() => {
    if (decodedTxs?.some((tx) => tx.isConfirmationRequired)) return true;
    return false;
  }, [decodedTxs]);

  const isSubmitDisabled = useMemo(() => {
    if (showTakeRiskAlert && !continueOperate) return true;

    if (sendTxStatus.isSubmitting) return true;
    if (nativeTokenInfo.isLoading || sendTxStatus.isInsufficientNativeBalance)
      return true;
    if (isBuildingDecodedTxs) return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.errMessage) return true;
    if (preCheckTxStatus.errorMessage) return true;
    if (txAdvancedSettings.dataChanged) return true;
    return false;
  }, [
    showTakeRiskAlert,
    continueOperate,
    sendTxStatus.isSubmitting,
    sendTxStatus.isInsufficientNativeBalance,
    nativeTokenInfo.isLoading,
    isBuildingDecodedTxs,
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
          variant: showTakeRiskAlert ? 'destructive' : 'primary',
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
        $gtMd={{
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
        {...(bottom && {
          mb: bottom,
        })}
      >
        <Stack
          gap="$2.5"
          pb="$5"
          $gtMd={{
            pb: '$0',
          }}
        >
          <TxFeeInfo
            accountId={accountId}
            networkId={networkId}
            useFeeInTx={useFeeInTx}
            feeInfoEditable={feeInfoEditable}
          />
          {showTakeRiskAlert ? (
            <Checkbox
              label={intl.formatMessage({
                id: ETranslations.dapp_connect_proceed_at_my_own_risk,
              })}
              value={continueOperate}
              onChange={(checked) => {
                setContinueOperate(!!checked);
              }}
            />
          ) : null}
        </Stack>
      </Page.FooterActions>
    </Page.Footer>
  );
}

export default memo(TxConfirmActions);
