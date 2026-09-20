import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDustSweepPreferencesPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import type { IDustSweepRouteParams } from '@onekeyhq/shared/types/swap/dustSweep';

export function useNavigateToDustSweep() {
  const navigation = useAppNavigation();
  const media = useMedia();
  const intl = useIntl();
  const [, setPreferences] = useDustSweepPreferencesPersistAtom();

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
      setPreferences((value) => ({ ...value, entrySeen: true }));
    },
    [intl, media.gtMd, navigation, setPreferences],
  );
}
