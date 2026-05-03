import { useCallback } from 'react';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { showDepositWithdrawDialog } from '../components/TradingPanel/modals/DepositWithdrawModal';

import type { IPerpsDepositWithdrawActionType } from '../components/TradingPanel/modals/DepositWithdrawModal';

export function useShowDepositWithdrawModal() {
  const navigation = useAppNavigation();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
      if (
        actionType === 'deposit' &&
        (await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
          walletId: selectedAccount.walletId ?? '',
        }))
      ) {
        return;
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
    [gtMd, dialogInTab, navigation, selectedAccount.walletId],
  );

  return { showDepositWithdrawModal: showModal };
}
