import { useCallback } from 'react';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { showDepositWithdrawDialog } from '../components/TradingPanel/modals/DepositWithdrawModal';

import type { IPerpsDepositWithdrawActionType } from '../components/TradingPanel/modals/DepositWithdrawModal';

export function useShowDepositWithdrawModal() {
  const navigation = useAppNavigation();
  const [{ accountId }] = usePerpsActiveAccountAtom();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
      if (actionType === 'deposit' && accountId) {
        const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
        if (
          await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
            walletId,
          })
        ) {
          return;
        }
      }

      if (gtMd) {
        await showDepositWithdrawDialog(
          {
            actionType,
          },
          dialogInTab,
        );
      } else {
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.MobileDepositWithdrawModal,
          params: { actionType },
        });
      }
    },
    [accountId, gtMd, dialogInTab, navigation],
  );

  return { showDepositWithdrawModal: showModal };
}
