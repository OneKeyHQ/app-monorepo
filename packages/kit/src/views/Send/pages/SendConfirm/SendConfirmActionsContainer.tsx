import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import {
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { type IModalSendParamList } from '../../router';

type IProps = {
  accountId: string;
  networkId: string;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  onFail?: (error: Error) => void;
  tableLayout?: boolean;
  sourceInfo?: IDappSourceInfo;
  signOnly?: boolean;
};

function SendConfirmActionsContainer(props: IProps) {
  const {
    accountId,
    networkId,
    onSuccess,
    onFail,
    tableLayout,
    sourceInfo,
    signOnly,
  } = props;
  const intl = useIntl();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [nativeTokenTransferAmountToUpdate] =
    useNativeTokenTransferAmountToUpdateAtom();

  console.log(sourceInfo);

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const handleOnConfirm = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const result =
        await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs,
          feeInfo: sendSelectedFeeInfo,
          nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
            ? {
                maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
              }
            : undefined,
          signOnly,
        });

      onSuccess?.(result);
      setIsSubmitting(false);
      Toast.success({
        title: intl.formatMessage({ id: 'msg__transaction_submitted' }),
      });
      void dappApprove.resolve();
      navigation.popStack();
    } catch (e: any) {
      setIsSubmitting(false);
      Toast.error({
        title: (e as Error).message,
      });
      onFail?.(e as Error);
      void dappApprove.reject(e);
      throw e;
    }
  }, [
    accountId,
    dappApprove,
    intl,
    nativeTokenTransferAmountToUpdate.amountToUpdate,
    nativeTokenTransferAmountToUpdate.isMaxSend,
    navigation,
    networkId,
    onFail,
    onSuccess,
    sendSelectedFeeInfo,
    signOnly,
    unsignedTxs,
  ]);

  const handleOnCancel = useCallback(
    (close: () => void, closePageStack: () => void) => {
      dappApprove.reject();
      if (!sourceInfo) {
        closePageStack();
      }
    },
    [dappApprove, sourceInfo],
  );

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (nativeTokenInfo.isLoading || sendTxStatus.isInsufficientNativeBalance)
      return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.status === ESendFeeStatus.Error)
      return true;
  }, [
    isSubmitting,
    nativeTokenInfo.isLoading,
    sendTxStatus.isInsufficientNativeBalance,
    sendSelectedFeeInfo,
    sendFeeStatus.status,
  ]);

  if (tableLayout) {
    return (
      <Page.FooterActions
        confirmButtonProps={{
          size: 'medium',
          flex: 0,
          disabled: isSubmitDisabled,
          loading: isSubmitting,
        }}
        cancelButtonProps={{
          size: 'medium',
          flex: 0,
          disabled: isSubmitting,
        }}
        onConfirmText="Sign and Broadcast"
        onConfirm={handleOnConfirm}
        onCancel={() => navigation.popStack()}
      />
    );
  }

  return (
    <Page.Footer
      confirmButtonProps={{
        disabled: isSubmitDisabled,
        loading: isSubmitting,
      }}
      cancelButtonProps={{
        disabled: isSubmitting,
      }}
      onConfirmText={signOnly ? 'Sign' : 'Sign and Broadcast'}
      onConfirm={handleOnConfirm}
      onCancel={handleOnCancel}
    />
  );
}

export default memo(SendConfirmActionsContainer);
