import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

export function useShowDepositWithdrawModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
      if (gtMd) {
        const { showDepositWithdrawDialog } =
          await import('../components/TradingPanel/modals/DepositWithdrawModal');
        await showDepositWithdrawDialog(
          {
            actionType,
          },
          dialogInTab,
          intl,
        );
      } else {
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.MobileDepositWithdrawModal,
          params: { actionType },
        });
      }
    },
    [gtMd, dialogInTab, intl, navigation],
  );

  return { showDepositWithdrawModal: showModal };
}
