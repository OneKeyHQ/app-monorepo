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
        const { default: backgroundApiProxy } = await import(
          '@onekeyhq/kit/src/background/instance/backgroundApiProxy'
        );
        // A missing intent only costs the first-mount restore, so this
        // must not be able to abort the tap. Recorded before the navigation
        // that mounts the Perp tab, so the claiming initial-select cannot
        // run ahead of it; the import above is hoisted for the same reason.
        try {
          await backgroundApiProxy.serviceHyperliquid.setPendingInstrumentIntent(
            { coin, mode: 'perp' },
          );
        } catch {
          // ignore
        }
        navigation.switchTab(ETabRoutes.Perp);
        try {
          await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
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
