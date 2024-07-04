import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast, usePageUnMounted } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import {
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  usePreCheckTxStatusAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

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
  useFeeInTx?: boolean;
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
    useFeeInTx,
  } = props;
  const intl = useIntl();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm } =
    usePreCheckFeeInfo({
      accountId,
      networkId,
    });

  const handleOnConfirm = useCallback(async () => {
    const { serviceSend } = backgroundApiProxy;

    setIsSubmitting(true);
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
        feeInfo: sendSelectedFeeInfo?.feeInfo,
      });
    } catch (e: any) {
      setIsSubmitting(false);
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
        feeInfo: sendSelectedFeeInfo,
        nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
          ? {
              maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
            }
          : undefined,
      });
    } catch (e: any) {
      setIsSubmitting(false);
      onFail?.(e as Error);
      isSubmitted.current = false;
      void dappApprove.reject(e);
      throw e;
    }

    // fee info pre-check
    if (sendSelectedFeeInfo) {
      const isFeeInfoOverflow = await checkFeeInfoIsOverflow({
        feeAmount: sendSelectedFeeInfo.totalNative,
        feeSymbol: sendSelectedFeeInfo.feeInfo.common.nativeSymbol,
        encodedTx: newUnsignedTxs[0].encodedTx,
      });

      if (isFeeInfoOverflow) {
        const isConfirmed = await showFeeInfoOverflowConfirm();
        if (!isConfirmed) {
          isSubmitted.current = false;
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      const result =
        await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: newUnsignedTxs,
          feeInfo: sendSelectedFeeInfo,
          signOnly,
          sourceInfo,
        });
      onSuccess?.(result);
      setIsSubmitting(false);
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.feedback_transaction_submitted,
        }),
      });

      const signedTx = result[0].signedTx;

      void dappApprove.resolve({ result: signedTx });

      navigation.popStack();
    } catch (e: any) {
      setIsSubmitting(false);
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
    sendSelectedFeeInfo,
    checkFeeInfoIsOverflow,
    unsignedTxs,
    showFeeInfoOverflowConfirm,
    networkId,
    accountId,
    nativeTokenTransferAmountToUpdate.isMaxSend,
    nativeTokenTransferAmountToUpdate.amountToUpdate,
    onFail,
    dappApprove,
    signOnly,
    sourceInfo,
    onSuccess,
    intl,
    navigation,
  ]);

  const handleOnCancel = useCallback(
    (close: () => void, closePageStack: () => void) => {
      dappApprove.reject();
      if (!sourceInfo) {
        closePageStack();
      } else {
        close();
      }
      onCancel?.();
    },
    [dappApprove, onCancel, sourceInfo],
  );

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (nativeTokenInfo.isLoading || sendTxStatus.isInsufficientNativeBalance)
      return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.errMessage) return true;
    if (preCheckTxStatus.errorMessage) return true;
  }, [
    sendFeeStatus.errMessage,
    isSubmitting,
    nativeTokenInfo.isLoading,
    sendTxStatus.isInsufficientNativeBalance,
    sendSelectedFeeInfo,
    preCheckTxStatus.errorMessage,
  ]);

  usePageUnMounted(() => {
    if (!isSubmitted.current) {
      onCancel?.();
    }
  });

  return (
    <Page.Footer>
      <Page.FooterActions
        confirmButtonProps={{
          disabled: isSubmitDisabled,
          loading: isSubmitting,
        }}
        cancelButtonProps={{
          disabled: isSubmitting,
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
        />
      </Page.FooterActions>
    </Page.Footer>
  );
}

export default memo(SendConfirmActionsContainer);
