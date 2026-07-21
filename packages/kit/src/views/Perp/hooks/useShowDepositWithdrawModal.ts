import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  perpsActiveAccountAtom,
  perpsCommonConfigPersistAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { loadPerpsDepositWithdrawModal } from '../utils/preloadPerpsDepositWithdrawModal';
import { loadPerpsUnifoldDepositModals } from '../utils/preloadPerpsUnifoldDeposit';
import { getSafeUnifoldRecipient } from '../utils/unifoldRecipient';

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

  const openDepositWithdrawForm = useCallback(
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

  const showModal = useCallback(
    async (actionType: IPerpsDepositWithdrawActionType = 'deposit') => {
      if (actionType === 'deposit' && getLatestDepositDisabled()) {
        return;
      }
      if (actionType !== 'deposit') {
        await openDepositWithdrawForm(actionType);
        return;
      }

      // Unifold entry gating: fail-closed remote switch (explicit true only)
      // + a valid active perps account address. Anything else falls back to
      // the original deposit form.
      // Persisted atoms must be read through the async accessor: the raw
      // store read can still hold the pre-hydration value.
      const { perpConfigCommon } = await perpsCommonConfigPersistAtom.get();
      const selectedAccount = jotaiDefaultStore.get(
        perpsActiveAccountAtom.atom(),
      );
      const safeRecipient = getSafeUnifoldRecipient({
        recipient: selectedAccount.accountAddress,
        activeAccountAddress: selectedAccount.accountAddress,
      });
      if (perpConfigCommon?.unifoldDepositEnabled !== true || !safeRecipient) {
        await openDepositWithdrawForm(actionType);
        return;
      }

      const {
        showPerpsUnifoldDepositMenuDialog,
        showUnifoldTransferDialog,
        showUnifoldTrackerDialog,
      } = await loadPerpsUnifoldDepositModals();
      showPerpsUnifoldDepositMenuDialog({
        onAction: (action) => {
          if (action === 'onekey') {
            void openDepositWithdrawForm('deposit');
            return;
          }
          if (gtMd) {
            if (action === 'transfer') {
              showUnifoldTransferDialog({
                dialogInTab,
                expectedRecipient: safeRecipient,
              });
            } else {
              showUnifoldTrackerDialog({
                dialogInTab,
                expectedRecipient: safeRecipient,
              });
            }
            return;
          }
          navigation.pushModal(EModalRoutes.PerpModal, {
            screen:
              action === 'transfer'
                ? EModalPerpRoutes.MobileUnifoldDepositTransfer
                : EModalPerpRoutes.MobileUnifoldDepositTracker,
            params: { expectedRecipient: safeRecipient },
          });
        },
      });
    },
    [
      getLatestDepositDisabled,
      openDepositWithdrawForm,
      gtMd,
      dialogInTab,
      navigation,
    ],
  );

  return { showDepositWithdrawModal: showModal, isDepositDisabled };
}
