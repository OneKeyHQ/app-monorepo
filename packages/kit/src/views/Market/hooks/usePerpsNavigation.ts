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
        navigation.switchTab(ETabRoutes.Perp);
        try {
          const { default: backgroundApiProxy } =
            await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
          // Recorded before the atom write so a Perp tab mounting for the
          // first time this launch restores this coin instead of the one its
          // cold-start cache holds; the event below has no listener yet then.
          await backgroundApiProxy.serviceHyperliquid.setPendingInstrumentIntent(
            { coin, mode: 'perp' },
          );
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
