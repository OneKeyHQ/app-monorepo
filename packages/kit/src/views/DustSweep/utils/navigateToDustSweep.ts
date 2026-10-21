import { Dialog, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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

import type { IntlShape } from 'react-intl';

export async function navigateToDustSweep({
  params,
  intl,
  navigation,
  isLargeScreen,
}: {
  params: Omit<IDustSweepRouteParams, 'walletId'> & { walletId?: string };
  intl: Pick<IntlShape, 'formatMessage'>;
  navigation: Pick<ReturnType<typeof useAppNavigation>, 'pushModal'>;
  isLargeScreen: boolean;
}) {
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
      onConfirmText: intl.formatMessage({ id: ETranslations.global_got_it }),
      showCancelButton: false,
    });
    return;
  }
  const routeParams: IDustSweepRouteParams = { ...params, walletId, accountId };
  if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
    await backgroundApiProxy.serviceApp.openExtensionExpandTab({
      path: '/dust-sweep',
      params: routeParams,
    });
  } else if (isLargeScreen) {
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
}
