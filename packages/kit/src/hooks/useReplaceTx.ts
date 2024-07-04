import { useCallback } from 'react';

import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import useAppNavigation from './useAppNavigation';
import { usePromiseResult } from './usePromiseResult';

function useReplaceTx({
  historyTx,
  onSuccess,
}: {
  historyTx: IAccountHistoryTx;
  onSuccess?: () => void;
}) {
  const navigation = useAppNavigation();

  const canReplaceTx = usePromiseResult(async () => {
    const { decodedTx } = historyTx;
    const { accountId, networkId, status, encodedTx } = decodedTx;

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
  }, [historyTx]).result;

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
          onSuccess,
        },
      });
    },
    [historyTx, navigation, onSuccess],
  );

  return { canReplaceTx, canCancelTx, handleReplaceTx };
}

export { useReplaceTx };
