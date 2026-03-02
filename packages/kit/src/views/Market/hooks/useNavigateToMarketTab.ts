import { useCallback } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import {
  type IMarketSelectedTab,
  useMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

interface INavigateToMarketTabOptions {
  tabToSelect?: IMarketSelectedTab;
}

export function useNavigateToMarketTab() {
  const [, setMarketSelectedTab] = useMarketSelectedTabAtom();

  const navigateToMarketTab = useCallback(
    (options?: INavigateToMarketTabOptions) => {
      const { tabToSelect } = options ?? {};

      // Switch to specific tab inside Market (watchlist or trending)
      if (tabToSelect) {
        setMarketSelectedTab({ tab: tabToSelect });
      }

      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiSidePanel
      ) {
        void backgroundApiProxy.serviceApp.openExtensionExpandTab({
          path: '/market',
        });
        return;
      }

      // Market tab differs by platform
      const marketTab = platformEnv.isNative
        ? ETabRoutes.Discovery
        : ETabRoutes.Market;

      rootNavigationRef.current?.navigate(ERootRoutes.Main, {
        screen: marketTab,
        params: {
          screen: ETabMarketRoutes.TabMarket,
        },
      });

      // On native, need to switch to Market sub-tab inside Discovery
      if (platformEnv.isNative) {
        setTimeout(() => {
          appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
            tab: ETranslations.global_market,
          });
        }, 150);
      }
    },
    [setMarketSelectedTab],
  );

  return navigateToMarketTab;
}
