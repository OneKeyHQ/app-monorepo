import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  perpsActiveAccountAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { loadPerpsDepositWithdrawModal } from '../utils/preloadPerpsDepositWithdrawModal';

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
  const getLatestDepositDisabled = useCallback(() => {
    const latestActiveAccount = jotaiDefaultStore.get(
      perpsActiveAccountAtom.atom(),
    );
    return accountUtils.isWatchingAccount({
      accountId: latestActiveAccount.accountId ?? '',
    });
  }, []);

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
      if (actionType === 'deposit' && getLatestDepositDisabled()) {
        return;
      }
      if (gtMd) {
        const { showDepositWithdrawDialog } =
          await loadPerpsDepositWithdrawModal();
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
    [gtMd, getLatestDepositDisabled, dialogInTab, intl, navigation],
  );

  return { showDepositWithdrawModal: showModal, isDepositDisabled };
}
