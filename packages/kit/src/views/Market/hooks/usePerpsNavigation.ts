import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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
          await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
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
