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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IMarketNavigationTrigger } from '@onekeyhq/shared/src/logger/scopes/market/scenes/navigation';
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

interface IMarketNavigationRequest {
  // Correlates the async steps of one request in the local logs.
  navigationId: number;
  startedAt: number;
  target?: IMarketNavigationTarget;
  onNavigationComplete?: () => void;
}

interface IPendingMarketNavigation extends IMarketNavigationRequest {
  target: IMarketNavigationTarget;
}

const MARKET_NAVIGATION_SELECTION_TIMEOUT_MS = 500;

let lastMarketNavigationId = 0;

function getNavigationPlatform() {
  if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
    return 'extension';
  }
  return platformEnv.isNative ? 'native' : 'web';
}

function getCurrentRouteName() {
  return rootNavigationRef.current?.getCurrentRoute?.()?.name;
}

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

  const clearPendingNavigation = useCallback(
    (cancelReason?: 'superseded' | 'unmount') => {
      const pendingNavigation = pendingNavigationRef.current;
      if (cancelReason && pendingNavigation) {
        defaultLogger.market.navigation.pendingNavigationCancelled({
          navigationId: pendingNavigation.navigationId,
          reason: cancelReason,
          elapsedMs: Date.now() - pendingNavigation.startedAt,
        });
      }
      if (pendingNavigationTimeoutRef.current !== undefined) {
        clearTimeout(pendingNavigationTimeoutRef.current);
        pendingNavigationTimeoutRef.current = undefined;
      }
      pendingNavigationRef.current = undefined;
    },
    [],
  );

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
      request: IMarketNavigationRequest,
      trigger: IMarketNavigationTrigger,
    ) => {
      const { navigationId, startedAt, target, onNavigationComplete } = request;
      defaultLogger.market.navigation.performNavigationStart({
        navigationId,
        trigger,
        platform: getNavigationPlatform(),
        routeName: getCurrentRouteName(),
        elapsedMs: Date.now() - startedAt,
      });

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
      defaultLogger.market.navigation.performNavigationDispatched({
        navigationId,
        hasRootNavigationRef: Boolean(rootNavigationRef.current),
        routeName: getCurrentRouteName(),
        elapsedMs: Date.now() - startedAt,
      });

      const logNavigationComplete = () => {
        defaultLogger.market.navigation.performNavigationComplete({
          navigationId,
          routeName: getCurrentRouteName(),
          elapsedMs: Date.now() - startedAt,
        });
      };

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
          logNavigationComplete();
        }, 150);
      } else if (target || onNavigationComplete) {
        requestAnimationFrame(() => {
          if (target) {
            applyNavigationTarget(target);
          }
          onNavigationComplete?.();
          logNavigationComplete();
        });
      }
    },
    [applyNavigationTarget],
  );

  const startNavigation = useCallback(
    (request: IMarketNavigationRequest, trigger: IMarketNavigationTrigger) => {
      clearPendingNavigation();
      void performNavigation(request, trigger).catch((error: unknown) => {
        defaultLogger.market.navigation.performNavigationFailed({
          navigationId: request.navigationId,
          error: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - request.startedAt,
        });
        // Only add the local log; keep the original unhandled rejection.
        throw error;
      });
    },
    [clearPendingNavigation, performNavigation],
  );

  useEffect(() => {
    const pendingNavigation = pendingNavigationRef.current;
    if (
      !pendingNavigation ||
      !isMarketNavigationTargetApplied(
        marketSelectedTab,
        pendingNavigation.target,
      )
    ) {
      return;
    }

    startNavigation(pendingNavigation, 'selectionApplied');
  }, [marketSelectedTab, startNavigation]);

  useEffect(
    () => () => {
      clearPendingNavigation('unmount');
    },
    [clearPendingNavigation],
  );

  const navigateToMarketTab = useCallback(
    (options?: INavigateToMarketTabOptions) => {
      clearPendingNavigation('superseded');

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

      lastMarketNavigationId += 1;
      const request: IMarketNavigationRequest = {
        navigationId: lastMarketNavigationId,
        startedAt: Date.now(),
        onNavigationComplete,
      };
      defaultLogger.market.navigation.navigateToMarketTab({
        navigationId: request.navigationId,
        target: navigationTarget,
        selection: marketSelectedTabRef.current,
        waitForSelection: shouldWaitForSelection,
      });

      // Switch to specific tab inside Market (watchlist or trending)
      if (shouldWaitForSelection) {
        const pendingNavigation: IPendingMarketNavigation = {
          ...request,
          target: navigationTarget,
        };
        pendingNavigationRef.current = pendingNavigation;
        pendingNavigationTimeoutRef.current = setTimeout(() => {
          if (pendingNavigationRef.current !== pendingNavigation) {
            return;
          }
          startNavigation(pendingNavigation, 'timeout');
        }, MARKET_NAVIGATION_SELECTION_TIMEOUT_MS);
        applyNavigationTarget(navigationTarget);

        if (
          isMarketNavigationTargetApplied(
            marketSelectedTabRef.current,
            navigationTarget,
          )
        ) {
          startNavigation(pendingNavigation, 'alreadyApplied');
        }
        return;
      }

      startNavigation(request, 'immediate');
    },
    [applyNavigationTarget, clearPendingNavigation, startNavigation],
  );

  return navigateToMarketTab;
}
