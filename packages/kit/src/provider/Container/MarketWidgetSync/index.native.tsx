import { useEffect } from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import {
  buildMarketWidgetAssets,
  createMarketWidgetConfigurationSync,
} from '@onekeyhq/shared/src/utils/marketWidgetUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const configurationSync = createMarketWidgetConfigurationSync({
  write: (configuration) => marketWidget.setConfiguration(configuration),
  onError: () =>
    defaultLogger.app.error.log('Market widget configuration sync failed'),
});

export function MarketWidgetSync() {
  const { locale } = useIntl();

  useEffect(() => {
    if (!marketWidget.isSupported()) return undefined;
    const sync = () => {
      void configurationSync.request(async () => {
        await travelModeManager.ready;
        const privacyMasked = travelModeManager.isMaskingDataSync();
        const watchlist = privacyMasked
          ? []
          : (await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2())
              .data;
        const assets = buildMarketWidgetAssets(watchlist, {
          includeStocks: marketWidget.supportsStockAssets(),
        });
        await Promise.all(
          assets.map(async (asset) => {
            if (
              asset.kind === 'token' &&
              asset.isNative &&
              !asset.contractAddress
            ) {
              asset.requestTokenAddress =
                await backgroundApiProxy.serviceToken.getNativeTokenAddress({
                  networkId: asset.chainId,
                });
            }
          }),
        );
        return {
          schemaVersion: 1,
          assets,
          greenUp: true,
          locale,
          privacyMasked,
        };
      });
    };
    sync();
    appEventBus.on(EAppEventBusNames.MarketWatchListV2Changed, sync);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      appEventBus.off(EAppEventBusNames.MarketWatchListV2Changed, sync);
      subscription.remove();
      configurationSync.cancel();
    };
  }, [locale]);
  return null;
}
