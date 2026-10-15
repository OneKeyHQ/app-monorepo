import { useCallback } from 'react';

import { findFocusedRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Toast, rootNavigationRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { EModalMarketRoutes } from '../router/types';
import { dismissDiscoveryMarketDetailForTrade } from '../utils/marketDetailNavigation';

let latestPerpsNavigationRequestId: string | undefined;

function waitForPerpsEntryRoute({
  closingSelectorKey,
  isCurrentNavigation,
  isCurrentRequest,
}: {
  closingSelectorKey: string;
  isCurrentNavigation: () => boolean;
  isCurrentRequest: () => boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false;
    const cleanup: {
      unsubscribe?: () => void;
      timeout?: ReturnType<typeof setTimeout>;
    } = {};
    const finish = (ready: boolean) => {
      if (finished) return;
      finished = true;
      cleanup.unsubscribe?.();
      clearTimeout(cleanup.timeout);
      resolve(ready);
    };
    const check = () => {
      if (!isCurrentRequest()) {
        finish(false);
      } else if (isCurrentNavigation()) {
        finish(true);
      } else if (
        rootNavigationRef.current?.getCurrentRoute()?.key !== closingSelectorKey
      ) {
        finish(false);
      }
    };
    // The selector can remain focused after popStack. Observe its actual exit
    // before validating the captured detail or writing a background target.
    cleanup.unsubscribe = rootNavigationRef.current?.addListener(
      'state',
      check,
    );
    cleanup.timeout = setTimeout(() => finish(false), 1500);
    check();
  });
}

export function usePerpsNavigation(source?: EPerpPageEnterSource) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();

  const navigateToPerps = useCallback(
    (coin: string) => {
      if (!coin.trim() || perpDisabled) return;
      const requestId = generateUUID();
      latestPerpsNavigationRequestId = requestId;
      const entryRoute = rootNavigationRef.current?.getCurrentRoute();
      const entryState =
        entryRoute?.name === EModalMarketRoutes.MobileTokenSelector
          ? rootNavigationRef.current?.getRootState()
          : undefined;
      const routeBelowSelector = entryState?.routes[entryState.index - 1];
      const entryRouteKey = routeBelowSelector?.state
        ? findFocusedRoute(routeBelowSelector.state)?.key
        : (routeBelowSelector?.key ?? entryRoute?.key);
      if (
        entryRoute?.name === EModalMarketRoutes.MobileTokenSelector &&
        entryRouteKey === entryRoute.key
      )
        return;
      const isCurrentRequest = () =>
        latestPerpsNavigationRequestId === requestId;
      const isCurrentNavigation = () =>
        isCurrentRequest() &&
        (!entryRouteKey ||
          rootNavigationRef.current?.getCurrentRoute()?.key === entryRouteKey);
      setTimeout(async () => {
        if (entryRoute?.name === EModalMarketRoutes.MobileTokenSelector) {
          const ready = await waitForPerpsEntryRoute({
            closingSelectorKey: entryRoute.key,
            isCurrentNavigation,
            isCurrentRequest,
          });
          if (!ready) return;
        }
        if (!isCurrentNavigation()) return;
        // Prepare the target before mounting the tab. Web Perps requires this
        // target; native Perps can fall back to changing the active asset below.
        let proxy:
          | (typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy'))['default']
          | undefined;
        let preparationStarted = false;
        const clearPreparedTarget = async () => {
          if (!proxy || !preparationStarted) return;
          try {
            if (perpTabShowWeb) {
              await proxy.serviceWebviewPerp.clearTradeTarget({ requestId });
            } else {
              await proxy.serviceHyperliquid.clearPendingInitialTradeInstrument(
                { requestId },
              );
            }
          } catch (error) {
            defaultLogger.app.error.log(
              `Failed to clear cancelled Perps target: ${String(error)}`,
            );
          }
        };
        try {
          proxy = (
            await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
          ).default;
          if (!isCurrentNavigation()) return;
          preparationStarted = true;
          if (perpTabShowWeb) {
            await proxy.serviceWebviewPerp.setTradeTarget({ coin, requestId });
          } else {
            await proxy.serviceHyperliquid.setPendingInitialTradeInstrument({
              coin,
              mode: 'perp',
              requestId,
            });
          }
        } catch (error) {
          await clearPreparedTarget();
          if (!isCurrentNavigation()) return;
          if (perpTabShowWeb) {
            // Keep the requested contract intact and make preparation failures visible.
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              }),
            });
            defaultLogger.app.error.log(
              `Failed to prepare web Perps target: ${String(error)}`,
            );
            return;
          }
        }
        if (!isCurrentNavigation()) {
          await clearPreparedTarget();
          return;
        }
        const targetTab = perpTabShowWeb
          ? ETabRoutes.WebviewPerpTrade
          : ETabRoutes.Perp;
        if (entryRouteKey) {
          try {
            const result = dismissDiscoveryMarketDetailForTrade(
              entryRouteKey,
              targetTab,
            );
            if (result === 'cancelled') {
              await clearPreparedTarget();
              return;
            }
          } catch (error) {
            await clearPreparedTarget();
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              }),
            });
            defaultLogger.app.error.log(
              `Failed to dismiss Market detail before Perps: ${String(error)}`,
            );
            return;
          }
        }
        setPerpPageEnterSource(source ?? EPerpPageEnterSource.MarketList);
        if (perpTabShowWeb) {
          navigation.switchTab(targetTab);
          return;
        }
        navigation.switchTab(targetTab);
        if (!proxy) {
          return;
        }
        try {
          await proxy.serviceHyperliquid.changeActiveAsset({
            coin,
          });
          if (!isCurrentRequest()) return;
          appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
            mode: 'perp',
            coin,
          });
        } catch (error) {
          console.error('Failed to change active asset:', error);
        }
      }, 80);
    },
    [intl, navigation, source, perpDisabled, perpTabShowWeb],
  );

  return { navigateToPerps };
}
