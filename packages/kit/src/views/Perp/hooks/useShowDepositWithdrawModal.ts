import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  perpsActiveAccountAtom,
  perpsCommonConfigPersistAtom,
  usePerpsActiveAccountAtom,
  usePerpsCommonConfigPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { TPerpDepositEntrySource } from '@onekeyhq/shared/src/logger/scopes/perp/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { loadPerpsDepositWithdrawModal } from '../utils/preloadPerpsDepositWithdrawModal';
import { loadPerpsUnifoldDepositModals } from '../utils/preloadPerpsUnifoldDeposit';
import {
  getSafeUnifoldRecipient,
  isUnifoldDepositAccountDisabled,
} from '../utils/unifoldRecipient';

type IPerpsDepositWithdrawActionType = 'deposit' | 'withdraw';

function isUnifoldDepositFeatureEnabled(remoteEnabled: boolean | undefined) {
  return remoteEnabled === true;
}

export function useUnifoldDepositTrackerAvailability() {
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const safeRecipient = useMemo(
    () =>
      getSafeUnifoldRecipient({
        recipient: activeAccount.accountAddress,
        activeAccountAddress: activeAccount.accountAddress,
      }),
    [activeAccount.accountAddress],
  );
  const isUnifoldDepositTrackerAvailable =
    isUnifoldDepositFeatureEnabled(perpConfigCommon?.unifoldDepositEnabled) &&
    Boolean(safeRecipient);

  return {
    isUnifoldDepositTrackerAvailable,
    safeRecipient,
  };
}

export function useShowUnifoldDepositTracker() {
  const intl = useIntl();
  const dialogInTab = useInTabDialog();
  const {
    isUnifoldDepositTrackerAvailable: isAvailableForActiveAccount,
    safeRecipient,
  } = useUnifoldDepositTrackerAvailability();
  const isUnifoldDepositTrackerAvailable =
    !platformEnv.isNative && isAvailableForActiveAccount;

  const showUnifoldDepositTracker = useCallback(async () => {
    if (platformEnv.isNative) {
      return;
    }
    const { perpConfigCommon: latestPerpConfigCommon } =
      await perpsCommonConfigPersistAtom.get();
    const latestActiveAccount = jotaiDefaultStore.get(
      perpsActiveAccountAtom.atom(),
    );
    const latestSafeRecipient = getSafeUnifoldRecipient({
      recipient: latestActiveAccount.accountAddress,
      activeAccountAddress: latestActiveAccount.accountAddress,
    });
    if (
      !isUnifoldDepositFeatureEnabled(
        latestPerpConfigCommon?.unifoldDepositEnabled,
      ) ||
      !latestSafeRecipient
    ) {
      return;
    }
    const { showUnifoldTrackerDialog } = await loadPerpsUnifoldDepositModals();
    showUnifoldTrackerDialog({
      dialogInTab,
      expectedRecipient: latestSafeRecipient,
      intl,
    });
  }, [dialogInTab, intl]);

  return {
    isUnifoldDepositTrackerAvailable,
    safeRecipient,
    showUnifoldDepositTracker,
  };
}

export function useShowDepositWithdrawModal(
  entrySource: TPerpDepositEntrySource,
) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const isDepositDisabled = useMemo(
    () => isUnifoldDepositAccountDisabled(activeAccount.accountId),
    [activeAccount.accountId],
  );
  const getLatestDepositDisabled = useCallback(() => {
    const latestActiveAccount = jotaiDefaultStore.get(
      perpsActiveAccountAtom.atom(),
    );
    return isUnifoldDepositAccountDisabled(latestActiveAccount.accountId);
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

      // Persisted atoms must be read through the async accessor: the raw
      // store read can still hold the pre-hydration value.
      const { perpConfigCommon } = await perpsCommonConfigPersistAtom.get();
      const selectedAccount = jotaiDefaultStore.get(
        perpsActiveAccountAtom.atom(),
      );
      if (isUnifoldDepositAccountDisabled(selectedAccount.accountId)) {
        return;
      }
      const safeRecipient = getSafeUnifoldRecipient({
        recipient: selectedAccount.accountAddress,
        activeAccountAddress: selectedAccount.accountAddress,
      });
      const isUnifoldDepositEnabled = isUnifoldDepositFeatureEnabled(
        perpConfigCommon?.unifoldDepositEnabled,
      );
      if (!isUnifoldDepositEnabled || !safeRecipient) {
        await openDepositWithdrawForm(actionType);
        return;
      }

      const {
        showPerpsUnifoldDepositMenuDialog,
        showUnifoldTransferDialog,
        showUnifoldTrackerDialog,
      } = await loadPerpsUnifoldDepositModals();
      const walletName = accountUtils.isExternalAccount({
        accountId: selectedAccount.accountId ?? '',
      })
        ? intl.formatMessage({
            id: ETranslations.perp_unifold_deposit_menu_connected_wallet__title,
          })
        : 'OneKey Wallet';
      const analyticsContext = {
        entrySource,
        walletType: selectedAccount.walletType ?? 'unknown',
      };
      showPerpsUnifoldDepositMenuDialog({
        intl,
        walletName,
        showTrackerAction: false,
        onAction: (action) => {
          if (action === 'onekey') {
            defaultLogger.perp.deposit.perpDepositMethodSelect({
              ...analyticsContext,
              depositMethod: 'connectedWallet',
            });
            void openDepositWithdrawForm('deposit');
            return;
          }
          if (action === 'transfer') {
            defaultLogger.perp.deposit.perpDepositMethodSelect({
              ...analyticsContext,
              depositMethod: 'depositAddress',
            });
          }
          if (gtMd) {
            if (action === 'transfer') {
              showUnifoldTransferDialog({
                dialogInTab,
                expectedRecipient: safeRecipient,
                intl,
                analyticsEntrySource: entrySource,
              });
            } else {
              showUnifoldTrackerDialog({
                dialogInTab,
                expectedRecipient: safeRecipient,
                intl,
              });
            }
            return;
          }
          if (action === 'transfer') {
            navigation.pushModal(EModalRoutes.PerpModal, {
              screen: EModalPerpRoutes.MobileUnifoldDepositTransfer,
              params: {
                expectedRecipient: safeRecipient,
                openSourceSelectorOnReady: true,
                analyticsEntrySource: entrySource,
              },
            });
            return;
          }
          navigation.pushModal(EModalRoutes.PerpModal, {
            screen: EModalPerpRoutes.MobileUnifoldDepositTracker,
            params: { expectedRecipient: safeRecipient },
          });
        },
      });
      defaultLogger.perp.deposit.perpDepositMethodPanelView(analyticsContext);
    },
    [
      getLatestDepositDisabled,
      openDepositWithdrawForm,
      entrySource,
      gtMd,
      dialogInTab,
      intl,
      navigation,
    ],
  );

  return { showDepositWithdrawModal: showModal, isDepositDisabled };
}
