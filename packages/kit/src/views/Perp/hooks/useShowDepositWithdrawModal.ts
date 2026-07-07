import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

export function useShowDepositWithdrawModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const isDepositDisabled = useMemo(
    () =>
      accountUtils.isWatchingAccount({
        accountId: activeAccount.accountId ?? '',
      }),
    [activeAccount.accountId],
  );

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
      if (actionType === 'deposit' && isDepositDisabled) {
        return;
      }
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
        await import('../components/TradingPanel/modals/DepositWithdrawModal');
        navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.MobileDepositWithdrawModal,
          params: { actionType },
        });
      }
    },
    [gtMd, isDepositDisabled, dialogInTab, intl, navigation],
  );

  return { showDepositWithdrawModal: showModal, isDepositDisabled };
}
