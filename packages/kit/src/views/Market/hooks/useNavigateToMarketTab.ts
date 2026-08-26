import { useCallback, useEffect, useRef } from 'react';

import { rootNavigationRef, switchTabAsync } from '@onekeyhq/components';
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
  onNavigationComplete?: () => void;
}

interface IPendingMarketNavigation {
  target: IMarketNavigationTarget;
  onNavigationComplete?: () => void;
}

const MARKET_NAVIGATION_SELECTION_TIMEOUT_MS = 500;

export function useNavigateToMarketTab() {
  const [marketSelectedTab, setMarketSelectedTab] = useMarketSelectedTabAtom();
  const marketSelectedTabRef = useRef(marketSelectedTab);
  marketSelectedTabRef.current = marketSelectedTab;
  const pendingNavigationRef = useRef<IPendingMarketNavigation | undefined>(
    undefined,
  );
  const pendingNavigationTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  const clearPendingNavigation = useCallback(() => {
    if (pendingNavigationTimeoutRef.current !== undefined) {
      clearTimeout(pendingNavigationTimeoutRef.current);
      pendingNavigationTimeoutRef.current = undefined;
    }
    pendingNavigationRef.current = undefined;
  }, []);

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
    async (
      target?: IMarketNavigationTarget,
      onNavigationComplete?: () => void,
    ) => {
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

      if (platformEnv.isNative) {
        // Keep the primary and detail navigation containers aligned in split view.
        await switchTabAsync(marketTab);
      }

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
          onNavigationComplete?.();
        }, 150);
      } else if (target || onNavigationComplete) {
        requestAnimationFrame(() => {
          if (target) {
            applyNavigationTarget(target);
          }
          onNavigationComplete?.();
        });
      }
    },
    [applyNavigationTarget],
  );

  useEffect(() => {
    const pendingNavigation = pendingNavigationRef.current;
    const target = pendingNavigation?.target;
    if (
      !target ||
      !isMarketNavigationTargetApplied(marketSelectedTab, target)
    ) {
      return;
    }

    clearPendingNavigation();
    void performNavigation(target, pendingNavigation?.onNavigationComplete);
  }, [clearPendingNavigation, marketSelectedTab, performNavigation]);

  useEffect(
    () => () => {
      clearPendingNavigation();
    },
    [clearPendingNavigation],
  );

  const navigateToMarketTab = useCallback(
    (options?: INavigateToMarketTabOptions) => {
      clearPendingNavigation();

      const {
        tabToSelect,
        spotCategoryToSelect,
        perpsCategoryToSelect,
        onNavigationComplete,
      } = options ?? {};
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
        const pendingNavigation: IPendingMarketNavigation = {
          target: navigationTarget,
          onNavigationComplete,
        };
        pendingNavigationRef.current = pendingNavigation;
        pendingNavigationTimeoutRef.current = setTimeout(() => {
          if (pendingNavigationRef.current !== pendingNavigation) {
            return;
          }
          clearPendingNavigation();
          void performNavigation(navigationTarget, onNavigationComplete);
        }, MARKET_NAVIGATION_SELECTION_TIMEOUT_MS);
        applyNavigationTarget(navigationTarget);

        if (
          isMarketNavigationTargetApplied(
            marketSelectedTabRef.current,
            navigationTarget,
          )
        ) {
          clearPendingNavigation();
          void performNavigation(navigationTarget, onNavigationComplete);
        }
        return;
      }

      void performNavigation(undefined, onNavigationComplete);
    },
    [applyNavigationTarget, clearPendingNavigation, performNavigation],
  );

  return navigateToMarketTab;
}
