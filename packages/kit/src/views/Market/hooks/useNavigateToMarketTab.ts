import { useCallback, useEffect, useRef } from 'react';

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

import { isMarketNavigationTargetApplied } from './marketNavigationTarget';

import type { IMarketNavigationTarget } from './marketNavigationTarget';

interface INavigateToMarketTabOptions {
  tabToSelect?: IMarketSelectedTab;
  spotCategoryToSelect?: string;
  perpsCategoryToSelect?: string;
}

export function useNavigateToMarketTab() {
  const [marketSelectedTab, setMarketSelectedTab] = useMarketSelectedTabAtom();
  const marketSelectedTabRef = useRef(marketSelectedTab);
  marketSelectedTabRef.current = marketSelectedTab;
  const pendingNavigationTargetRef = useRef<
    IMarketNavigationTarget | undefined
  >(undefined);

  const applyNavigationTarget = useCallback(
    (target: IMarketNavigationTarget) => {
      setMarketSelectedTab((prev) => ({
        ...prev,
        tab: target.tab ?? prev.tab,
        selectedSpotCategory: target.spotCategory ?? prev.selectedSpotCategory,
        spotCategoryToSelect:
          target.tab === 'perps' ? undefined : target.spotCategory,
        selectedPerpsCategory:
          target.perpsCategory ?? prev.selectedPerpsCategory,
        perpsCategoryToSelect:
          target.tab === 'trending' || target.tab === 'watchlist'
            ? undefined
            : target.perpsCategory,
      }));
    },
    [setMarketSelectedTab],
  );

  const performNavigation = useCallback(
    (target?: IMarketNavigationTarget) => {
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
          if (target) {
            applyNavigationTarget(target);
          }
        }, 150);
      } else if (target) {
        requestAnimationFrame(() => applyNavigationTarget(target));
      }
    },
    [applyNavigationTarget],
  );

  useEffect(() => {
    const target = pendingNavigationTargetRef.current;
    if (
      !target ||
      !isMarketNavigationTargetApplied(marketSelectedTab, target)
    ) {
      return;
    }

    pendingNavigationTargetRef.current = undefined;
    performNavigation(target);
  }, [marketSelectedTab, performNavigation]);

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

      const navigationTarget: IMarketNavigationTarget = {
        tab: targetTab,
        spotCategory: spotCategoryToSelect,
        perpsCategory: perpsCategoryToSelect,
      };
      const shouldWaitForSelection = Boolean(
        navigationTarget.tab ||
        navigationTarget.spotCategory ||
        navigationTarget.perpsCategory,
      );

      // Switch to specific tab inside Market (watchlist or trending)
      if (shouldWaitForSelection) {
        pendingNavigationTargetRef.current = navigationTarget;
        applyNavigationTarget(navigationTarget);

        if (
          isMarketNavigationTargetApplied(
            marketSelectedTabRef.current,
            navigationTarget,
          )
        ) {
          pendingNavigationTargetRef.current = undefined;
          performNavigation(navigationTarget);
        }
        return;
      }

      performNavigation();
    },
    [applyNavigationTarget, performNavigation],
  );

  return navigateToMarketTab;
}
