import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
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

import { type IModalSendParamList } from '../../router';

type IProps = {
  accountId: string;
  networkId: string;
  onSuccess?: (txs: ISignedTxPro[]) => void;
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

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const handleOnConfirm = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const signedTxs =
        await backgroundApiProxy.serviceSend.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs,
          feeInfo: sendSelectedFeeInfo?.feeInfo,
          nativeAmountInfo: nativeTokenTransferAmountToUpdate.isMaxSend
            ? {
                maxSendAmount: nativeTokenTransferAmountToUpdate.amountToUpdate,
              }
            : undefined,
          signOnly,
        });

      onSuccess?.(signedTxs);
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
    sendSelectedFeeInfo?.feeInfo,
    signOnly,
    unsignedTxs,
  ]);

  const handleOnCancel = useCallback(() => {
    dappApprove.reject();
    if (!sourceInfo) {
      navigation.popStack();
    }
  }, [dappApprove, navigation, sourceInfo]);

  const isSubmitDisabled = useMemo(() => {
    console.log('sendFeeStatus', sendFeeStatus.status);
    if (isSubmitting) return true;
    if (nativeTokenInfo.isLoading || sendTxStatus.isInsufficientNativeBalance)
      return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.errMessage) return true;
  }, [
    sendFeeStatus.status,
    sendFeeStatus.errMessage,
    isSubmitting,
    nativeTokenInfo.isLoading,
    sendTxStatus.isInsufficientNativeBalance,
    sendSelectedFeeInfo,
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
