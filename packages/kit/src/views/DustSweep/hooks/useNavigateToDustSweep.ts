import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalSwapRoutes,
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IDustSweepEntry,
  IDustSweepRouteParams,
} from '@onekeyhq/shared/types/swap/dustSweep';

export function useNavigateToDustSweep() {
  const navigation = useAppNavigation();
  const media = useMedia();
  const intl = useIntl();

  return useCallback(
    async (
      params: Omit<IDustSweepRouteParams, 'walletId'> & { walletId?: string },
    ) => {
      const { walletId } = params;
      const accountId =
        params.accountId ??
        (!params.networkId ? params.indexedAccountId : undefined);
      if (
        !walletId ||
        !accountId ||
        accountUtils.isWatchingWallet({ walletId }) ||
        accountUtils.isExternalWallet({ walletId })
      ) {
        Dialog.show({
          title: intl.formatMessage({ id: ETranslations.title_dust_sweep }),
          description: intl.formatMessage({
            id: ETranslations.swap_page_alert_account_does_not_support_swap,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          showCancelButton: false,
        });
        return;
      }

      const routeParams: IDustSweepRouteParams = {
        ...params,
        walletId,
        accountId,
      };
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        await backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path: '/dust-sweep',
          params: routeParams,
        });
      } else if (media.gtMd) {
        rootNavigationRef.current?.navigate(
          ERootRoutes.Main,
          {
            screen: ETabRoutes.Home,
            params: {
              screen: ETabHomeRoutes.TabHomeDustSweep,
              params: routeParams,
            },
          },
          { pop: true },
        );
      } else {
        navigation.pushModal(EModalRoutes.SwapModal, {
          screen: EModalSwapRoutes.DustSweep,
          params: routeParams,
        });
      }
    },
    [intl, media.gtMd, navigation],
  );
}

// Entry points that open Dust Sweep for the active Home account.
export function useActiveAccountDustSweep() {
  const navigateToDustSweep = useNavigateToDustSweep();
  const {
    activeAccount: { account, wallet, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const walletId = wallet?.id;
  // Mirrors the guards in useNavigateToDustSweep so entries never lead to the
  // "account does not support swap" dialog.
  const canDustSweep =
    !!(
      account?.id ?? (network?.isAllNetworks ? indexedAccount?.id : undefined)
    ) &&
    !!walletId &&
    !accountUtils.isWatchingWallet({ walletId }) &&
    !accountUtils.isExternalWallet({ walletId });
  const openDustSweep = useCallback(
    (entry: IDustSweepEntry) =>
      navigateToDustSweep({
        accountId: account?.id,
        walletId,
        indexedAccountId: indexedAccount?.id,
        networkId: network?.isAllNetworks ? undefined : network?.id,
        entry,
      }),
    [
      navigateToDustSweep,
      account?.id,
      walletId,
      indexedAccount?.id,
      network?.id,
      network?.isAllNetworks,
    ],
  );
  return { canDustSweep, openDustSweep };
}
