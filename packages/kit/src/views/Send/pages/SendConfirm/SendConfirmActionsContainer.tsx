import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
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

  const handleOnConfirm = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const newUnsignedTxs = [];
      for (let i = 0, len = unsignedTxs.length; i < len; i += 1) {
        const unsignedTx = unsignedTxs[i];
        const newUnsignedTx =
          await backgroundApiProxy.serviceSend.updateUnsignedTx({
            accountId,
            networkId,
            unsignedTx,
            feeInfo: sendSelectedFeeInfo?.feeInfo,
          });

        newUnsignedTxs.push(newUnsignedTx);
      }

      const signedTxs: ISignedTxPro[] = [];

      for (let i = 0, len = newUnsignedTxs.length; i < len; i += 1) {
        const unsignedTx = newUnsignedTxs[i];
        const signedTx =
          await backgroundApiProxy.serviceSend.signAndSendTransaction({
            networkId,
            accountId,
            unsignedTx,
          });

        signedTxs.push(signedTx);

        if (signedTx) {
          await backgroundApiProxy.serviceHistory.saveSendConfirmHistoryTxs({
            networkId,
            accountId,
            data: {
              signedTx,
              decodedTx: await backgroundApiProxy.serviceSend.buildDecodedTx({
                networkId,
                accountId,
                unsignedTx,
              }),
            },
          });
        }
      }

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
    navigation,
    networkId,
    onFail,
    onSuccess,
    sendSelectedFeeInfo?.feeInfo,
    unsignedTxs,
  ]);

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (
      sendTxStatus.isLoadingNativeBalance ||
      sendTxStatus.isInsufficientNativeBalance
    )
      return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.status === ESendFeeStatus.Error)
      return true;
  }, [
    isSubmitting,
    sendTxStatus.isLoadingNativeBalance,
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
        size: 'large',
        flex: 2,
        disabled: isSubmitDisabled,
        loading: isSubmitting,
      }}
      cancelButtonProps={{
        size: 'large',
        flex: 1,
        disabled: isSubmitting,
      }}
      onConfirmText="Sign and Broadcast"
      onConfirm={handleOnConfirm}
      onCancel={() => navigation.popStack()}
    />
  );
}

export default memo(SendConfirmActionsContainer);
