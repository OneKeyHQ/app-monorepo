import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

export function usePerpsNavigation(source?: EPerpPageEnterSource) {
  const navigation = useAppNavigation();

  const navigateToPerps = useCallback(
    (coin: string) => {
      setTimeout(async () => {
        setPerpPageEnterSource(source ?? EPerpPageEnterSource.MarketList);
        // Recorded before the navigation that mounts the Perp tab, so the
        // claiming initial-select cannot run ahead of it. Both this and the
        // import it needs stay inside the catch: losing the record only costs
        // the first-mount restore, while a chunk that fails to load must still
        // leave the tap opening the tab, as it did before.
        let proxy:
          | (typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy'))['default']
          | undefined;
        try {
          proxy = (
            await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
          ).default;
          await proxy.serviceHyperliquid.setPendingInitialTradeInstrument({
            coin,
            mode: 'perp',
          });
        } catch {
          // ignore
        }
        navigation.switchTab(ETabRoutes.Perp);
        if (!proxy) {
          return;
        }
        try {
          await proxy.serviceHyperliquid.changeActiveAsset({
            coin,
          });
          appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
            mode: 'perp',
            coin,
          });
        } catch (error) {
          console.error('Failed to change active asset:', error);
        }
      }, 80);
    },
    [navigation, source],
  );

  return { navigateToPerps };
}
