import { useCallback } from 'react';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { showDepositWithdrawDialog } from '../components/TradingPanel/modals/DepositWithdrawModal';

import type { IPerpsDepositWithdrawActionType } from '../components/TradingPanel/modals/DepositWithdrawModal';

export function useShowDepositWithdrawModal() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
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
        });
      }
    },
    [gtMd, dialogInTab, navigation],
  );

  return { showDepositWithdrawModal: showModal };
}
