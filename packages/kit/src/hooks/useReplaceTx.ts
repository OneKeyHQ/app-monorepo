import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast, useMedia } from '@onekeyhq/components';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { showBtcSpeedUpTxDialog } from '../components/TxHistoryListView/showBtcSpeedUpTxDialog';

import useAppNavigation from './useAppNavigation';
import { usePromiseResult } from './usePromiseResult';

function useReplaceTx({
  historyTx,
  onSuccess,
  isConfirmed,
}: {
  historyTx: IAccountHistoryTx | undefined;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  isConfirmed?: boolean;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;

  const canReplaceTx = usePromiseResult(async () => {
    if (!historyTx) return false;
    const { accountId, networkId, status, encodedTx } = historyTx.decodedTx;
    if (isConfirmed) return false;

    if (!encodedTx) return false;

    if (status !== EDecodedTxStatus.Pending) return false;

    const vaultSettings =
      await backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      });

    if (!vaultSettings.replaceTxEnabled) return false;

    return backgroundApiProxy.serviceHistory.canAccelerateTx({
      accountId,
      networkId,
      encodedTx,
      txId: historyTx.decodedTx.txid,
    });
  }, [historyTx, isConfirmed]).result;

  const { result: cancelTxConfig } = usePromiseResult(async () => {
    const defaultConfig = {
      cancelTxEnabled: false,
      speedUpCancelEnabled: false,
      checkSpeedUpStateEnabled: false,
    };
    if (!historyTx) return defaultConfig;
    if (isConfirmed) return defaultConfig;
    const { networkId } = historyTx.decodedTx;

    const vaultSettings =
      await backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId,
      });

    const checkSpeedUpStateEnabled =
      await backgroundApiProxy.serviceHistory.checkTxSpeedUpStateEnabled({
        networkId,
        accountId: historyTx.decodedTx.accountId,
        historyTx,
      });

    return {
      cancelTxEnabled: vaultSettings.cancelTxEnabled,
      speedUpCancelEnabled: vaultSettings.speedUpCancelEnabled,
      checkSpeedUpStateEnabled,
    };
  }, [historyTx, isConfirmed]);

  const canCancelTx = historyTx
    ? historyTx.replacedType !== EReplaceTxType.Cancel
    : false;

  const handleReplaceTx = useCallback(
    async ({ replaceType }: { replaceType: EReplaceTxType }) => {
      if (!historyTx) return;
      const { decodedTx } = historyTx;
      const { accountId, networkId } = decodedTx;

      if (!canReplaceTx) {
        console.log('Cannot replace tx');
        return;
      }

      // External accounts may modify transaction nonce, so transaction replacement is disabled.
      if (accountUtils.isExternalAccount({ accountId })) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.feedback_connected_accounts_speed_up_or_cancel,
          }),
        });
        return;
      }

      const replaceEncodedTx =
        await backgroundApiProxy.serviceSend.buildReplaceEncodedTx({
          accountId,
          networkId,
          decodedTx,
          replaceType,
        });

      if (!replaceEncodedTx) return;

      if (networkUtils.isBTCNetwork(networkId)) {
        showBtcSpeedUpTxDialog({
          title: intl.formatMessage(
            {
              id: ETranslations.tx_accelerate_speed_up_with_accelerator_dialog_title,
            },
            {
              accelerator: 'F2Pool',
            },
          ),
          description: intl.formatMessage({
            id: ETranslations.tx_accelerate_speed_up_with_accelerator_dialog_desc,
          }),
          onConfirm: async () => {
            // https://www.f2pool.com/user/tx-acc?from=onekey&txid={txid}
            handleOpenWebSite({
              switchToMultiTabBrowser: gtMd,
              navigation,
              useCurrentWindow: false,
              webSite: {
                url: `https://www.f2pool.com/user/tx-acc?from=onekey&txid=${decodedTx.txid}`,
                title: 'F2Pool',
                logo: undefined,
                sortIndex: undefined,
              },
            });
          },
        });
      } else {
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
      }
    },
    [
      historyTx,
      canReplaceTx,
      intl,
      handleOpenWebSite,
      navigation,
      gtMd,
      onSuccess,
    ],
  );

  const handleCheckSpeedUpState = useCallback(async () => {
    if (!historyTx) return;
    const { networkId, txid } = historyTx.decodedTx;
    if (!cancelTxConfig?.checkSpeedUpStateEnabled) return;
    if (!networkUtils.isBTCNetwork(networkId)) {
      return;
    }
    // https://www.f2pool.com/user/tx-acc?from=onekey&txid={txid}
    handleOpenWebSite({
      switchToMultiTabBrowser: gtMd,
      navigation,
      useCurrentWindow: false,
      webSite: {
        url: `https://www.f2pool.com/user/tx-acc?query=${txid}`,
        title: 'F2Pool',
        logo: undefined,
        sortIndex: undefined,
      },
    });
  }, [historyTx, cancelTxConfig, handleOpenWebSite, navigation, gtMd]);

  return {
    canReplaceTx,
    canCancelTx,
    cancelTxEnabled: cancelTxConfig?.cancelTxEnabled,
    speedUpCancelEnabled: cancelTxConfig?.speedUpCancelEnabled,
    checkSpeedUpStateEnabled: cancelTxConfig?.checkSpeedUpStateEnabled,
    handleReplaceTx,
    handleCheckSpeedUpState,
  };
}

export { useReplaceTx };
