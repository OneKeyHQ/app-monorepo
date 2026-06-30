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
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

interface INavigateToMarketTabOptions {
  tabToSelect?: IMarketSelectedTab;
  spotCategoryToSelect?: string;
  perpsCategoryToSelect?: string;
}

export function useNavigateToMarketTab() {
  const [, setMarketSelectedTab] = useMarketSelectedTabAtom();

  const navigateToMarketTab = useCallback(
    (options?: INavigateToMarketTabOptions) => {
      const { tabToSelect, spotCategoryToSelect, perpsCategoryToSelect } =
        options ?? {};
      let targetTab = tabToSelect;
      if (spotCategoryToSelect) {
        targetTab = 'trending';
      }
      if (perpsCategoryToSelect) {
        targetTab = 'perps';
      }

      // Switch to specific tab inside Market (watchlist or trending)
      if (targetTab || spotCategoryToSelect || perpsCategoryToSelect) {
        setMarketSelectedTab((prev) => ({
          ...prev,
          tab: targetTab ?? prev.tab,
          selectedSpotCategory:
            spotCategoryToSelect ?? prev.selectedSpotCategory,
          spotCategoryToSelect,
          selectedPerpsCategory:
            perpsCategoryToSelect ?? prev.selectedPerpsCategory,
          perpsCategoryToSelect,
        }));
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
      const marketTabScreen = platformEnv.isNative
        ? ETabDiscoveryRoutes.TabDiscovery
        : ETabMarketRoutes.TabMarket;

      rootNavigationRef.current?.navigate(ERootRoutes.Main, {
        screen: marketTab,
        params: {
          screen: marketTabScreen,
          params: platformEnv.isNative
            ? {
                defaultTab: ETranslations.global_market,
              }
            : undefined,
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
