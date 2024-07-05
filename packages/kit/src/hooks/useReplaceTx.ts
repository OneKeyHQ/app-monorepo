import { useCallback } from 'react';

import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import useAppNavigation from './useAppNavigation';
import { usePromiseResult } from './usePromiseResult';

function useReplaceTx({
  historyTx,
  onSuccess,
  isConfirmed,
}: {
  historyTx: IAccountHistoryTx;
  onSuccess?: (data: ISendTxOnSuccessData) => void;
  isConfirmed?: boolean;
}) {
  const navigation = useAppNavigation();

  const canReplaceTx = usePromiseResult(async () => {
    const { accountId, networkId, status, encodedTx } = historyTx.decodedTx;

    if (isConfirmed) return false;

    if (!encodedTx) return false;

    if (status !== EDecodedTxStatus.Pending) return false;

    const vaultSettings =
      await backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      });

    if (!vaultSettings.replaceTxEnabled) return false;

    return backgroundApiProxy.serviceHistory.isEarliestLocalPendingTx({
      accountId,
      networkId,
      encodedTx,
    });
  }, [historyTx, isConfirmed]).result;

  const canCancelTx = historyTx.replacedType !== EReplaceTxType.Cancel;

  const handleReplaceTx = useCallback(
    async ({ replaceType }: { replaceType: EReplaceTxType }) => {
      const { decodedTx } = historyTx;
      const { accountId, networkId } = decodedTx;

      const replaceEncodedTx =
        await backgroundApiProxy.serviceSend.buildReplaceEncodedTx({
          accountId,
          networkId,
          decodedTx,
          replaceType,
        });

      if (!replaceEncodedTx) return;

      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendReplaceTx,
        params: {
          accountId,
          networkId,
          replaceType,
          replaceEncodedTx,
          historyTx,
          onSuccess: (data: ISendTxOnSuccessData) => {
            void backgroundApiProxy.serviceHistory.fetchAccountHistory({
              accountId,
              networkId,
            });
            onSuccess?.(data);
          },
        },
      });
    },
    [historyTx, navigation, onSuccess],
  );

  return { canReplaceTx, canCancelTx, handleReplaceTx };
}

export { useReplaceTx };
