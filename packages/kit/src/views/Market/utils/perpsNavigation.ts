import { Semaphore } from 'async-mutex';

import { Toast, rootNavigationRef } from '@onekeyhq/components';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { perpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WEBVIEW_PERP_TRADE_INITIAL_WAIT_MS } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IWebviewPerpTradeParamList } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { dismissDiscoveryMarketDetailForTrade } from '../utils/marketDetailNavigation';

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { IntlShape } from 'react-intl';

// Await writes and their rollback before allowing another entry to write.
// A request ID alone cannot prevent an older RPC from overwriting a newer one.
const perpsNavigationMutex = new Semaphore(1);

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

export async function navigateToPerps({
  coin,
  requestId,
  entryRouteKey,
  closingSelectorKey,
  isCurrentRequest,
  isCurrentNavigation,
  navigation,
  source,
  perpTabShowWeb,
  gtMd,
  intl,
}: {
  coin: string;
  requestId: string;
  entryRouteKey?: string;
  closingSelectorKey?: string;
  isCurrentRequest: () => boolean;
  isCurrentNavigation: () => boolean;
  navigation: ReturnType<typeof useAppNavigation>;
  source?: EPerpPageEnterSource;
  perpTabShowWeb: boolean | undefined;
  gtMd: boolean;
  intl: IntlShape;
}) {
  if (closingSelectorKey) {
    const ready = await waitForPerpsEntryRoute({
      closingSelectorKey,
      isCurrentNavigation,
      isCurrentRequest,
    });
    if (!ready) return;
  }
  await perpsNavigationMutex.runExclusive(async () => {
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
          await proxy.serviceHyperliquid.clearPendingInitialTradeInstrument({
            requestId,
          });
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
        await proxy.serviceWebviewPerp.setTradeTarget({
          coin,
          requestId,
        });
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
    const webTradeParams: NavigatorScreenParams<IWebviewPerpTradeParamList> = {
      screen: ETabRoutes.WebviewPerpTrade,
      params: {
        tradeRequest: {
          requestId,
          expiresAt: Date.now() + WEBVIEW_PERP_TRADE_INITIAL_WAIT_MS,
        },
      },
    };
    let navigationCommitted = false;
    try {
      if (entryRouteKey) {
        const result = perpTabShowWeb
          ? dismissDiscoveryMarketDetailForTrade(
              entryRouteKey,
              targetTab,
              webTradeParams,
            )
          : dismissDiscoveryMarketDetailForTrade(entryRouteKey, targetTab);
        if (result === 'cancelled') return;
      }
      setPerpPageEnterSource(source ?? EPerpPageEnterSource.MarketList);
      if (perpTabShowWeb) {
        navigation.switchTab(ETabRoutes.WebviewPerpTrade, webTradeParams);
        const committed = await proxy?.serviceWebviewPerp.commitTradeTarget({
          requestId,
        });
        if (!committed) {
          throw new OneKeyLocalError('Web Perps target was not committed');
        }
        navigationCommitted = true;
        return;
      }
      navigation.switchTab(targetTab);
      navigationCommitted = true;
      const targetRouteKey = rootNavigationRef.current?.getCurrentRoute()?.key;
      const isCurrentTarget = () =>
        isCurrentRequest() &&
        rootNavigationRef.current?.getCurrentRoute()?.key === targetRouteKey;
      if (!proxy) return;
      try {
        await proxy.serviceHyperliquid.changeActiveAsset({ coin });
        if (!isCurrentTarget()) return;
        appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
          mode: 'perp',
          coin,
        });
        if (platformEnv.isNative || !gtMd) {
          await perpsCustomSettingsAtom.ready();
          const settings = await perpsCustomSettingsAtom.get();
          if (!isCurrentTarget()) return;
          if (settings.mobileTradingMode === 'simple') {
            navigation.pushModal(EModalRoutes.PerpModal, {
              screen: EModalPerpRoutes.MobilePerpSimpleMarket,
              params: { coin },
            });
          }
        }
      } catch (error) {
        console.error('Failed to change active asset:', error);
      }
    } catch (error) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_unknown_error_retry_message,
        }),
      });
      defaultLogger.app.error.log(
        `Failed to complete Perps navigation: ${String(error)}`,
      );
    } finally {
      if (!navigationCommitted) await clearPreparedTarget();
    }
  });
}
