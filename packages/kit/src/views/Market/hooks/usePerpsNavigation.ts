import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
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

export function usePerpsNavigation(source?: EPerpPageEnterSource) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();

  const navigateToPerps = useCallback(
    (coin: string) => {
      if (!coin.trim() || perpDisabled) return;
      setTimeout(async () => {
        setPerpPageEnterSource(source ?? EPerpPageEnterSource.MarketList);
        // Prepare the target before mounting the tab. Web Perps requires this
        // target; native Perps can fall back to changing the active asset below.
        let proxy:
          | (typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy'))['default']
          | undefined;
        try {
          proxy = (
            await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy')
          ).default;
          if (perpTabShowWeb) {
            await proxy.serviceWebviewPerp.setTradeTarget({ coin });
          } else {
            await proxy.serviceHyperliquid.setPendingInitialTradeInstrument({
              coin,
              mode: 'perp',
            });
          }
        } catch (error) {
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
        if (perpTabShowWeb) {
          navigation.switchTab(ETabRoutes.WebviewPerpTrade);
          return;
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
    [intl, navigation, source, perpDisabled, perpTabShowWeb],
  );

  return { navigateToPerps };
}
