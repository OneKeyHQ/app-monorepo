import { memo, useCallback, useMemo } from 'react';

import { Page, useMedia } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/send-confirm';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

import { EModalSendRoutes, type IModalSendParamList } from '../../router';

type IProps = {
  accountId: string;
  networkId: string;
  onSuccess?: (txs: ISignedTxPro[]) => void;
  onFail?: (error: Error) => void;
};

function SendConfirmActionsContainer(props: IProps) {
  const { accountId, networkId } = props;
  const media = useMedia();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const tableLayout = media.gtLg;

  const handleOnConfirm = useCallback(async () => {
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

    navigation.push(EModalSendRoutes.SendProgress, {
      networkId,
      accountId,
      unsignedTxs: newUnsignedTxs,
    });
  }, [accountId, navigation, networkId, sendSelectedFeeInfo, unsignedTxs]);

  const isSubmitDisabled = useMemo(() => {
    if (
      sendTxStatus.isLoadingNativeBalance ||
      sendTxStatus.isInsufficientNativeBalance
    )
      return true;

    if (!sendSelectedFeeInfo || sendFeeStatus.status === ESendFeeStatus.Error)
      return true;
  }, [
    sendTxStatus.isLoadingNativeBalance,
    sendTxStatus.isInsufficientNativeBalance,
    sendSelectedFeeInfo,
    sendFeeStatus.status,
  ]);

  return (
    <Page.Footer
      confirmButtonProps={{
        size: tableLayout ? 'medium' : 'large',
        flex: tableLayout ? 0 : 2,
        disabled: isSubmitDisabled,
      }}
      cancelButtonProps={{
        size: tableLayout ? 'medium' : 'large',
        flex: tableLayout ? 0 : 1,
      }}
      onConfirmText="Sign and Broadcast"
      onConfirm={handleOnConfirm}
      onCancel={() => navigation.popStack()}
    />
  );
}

export default memo(SendConfirmActionsContainer);
