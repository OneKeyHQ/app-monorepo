import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useNativeTokenInfoAtom,
  useNativeTokenTransferAmountToUpdateAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

import { type IModalSendParamList } from '../../router';

type IProps = {
  accountId: string;
  networkId: string;
  onSuccess?: (txs: ISignedTxPro[]) => void;
  onFail?: (error: Error) => void;
  tableLayout?: boolean;
};

function SendConfirmActionsContainer(props: IProps) {
  const { accountId, networkId, onSuccess, onFail, tableLayout } = props;
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
        });

      onSuccess?.(signedTxs);
      setIsSubmitting(false);
      Toast.success({
        title: intl.formatMessage({ id: 'msg__transaction_submitted' }),
      });
      navigation.popStack();
    } catch (e: any) {
      setIsSubmitting(false);
      Toast.error({
        title: (e as Error).message,
      });
      onFail?.(e as Error);
      throw e;
    }
  }, [
    accountId,
    intl,
    nativeTokenTransferAmountToUpdate.amountToUpdate,
    nativeTokenTransferAmountToUpdate.isMaxSend,
    navigation,
    networkId,
    onFail,
    onSuccess,
    sendSelectedFeeInfo?.feeInfo,
    unsignedTxs,
  ]);

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
      onConfirmText="Sign and Broadcast"
      onConfirm={handleOnConfirm}
      onCancel={(close, closePageStack) => {
        closePageStack();
      }}
    />
  );
}

export default memo(SendConfirmActionsContainer);
