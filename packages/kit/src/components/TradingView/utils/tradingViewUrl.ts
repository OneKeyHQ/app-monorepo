import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  TRADING_VIEW_URL,
  TRADING_VIEW_URL_TEST,
} from '@onekeyhq/shared/src/config/appConfig';

export function getTradingViewBaseUrl({
  devSettings,
  localTradingViewUrl,
}: {
  devSettings: IDevSettingsPersistAtom;
  localTradingViewUrl: string;
}) {
  if (devSettings.enabled && devSettings.settings?.useLocalTradingViewUrl) {
    return localTradingViewUrl;
  }

  if (devSettings.enabled && devSettings.settings?.useTradingViewTestUrl) {
    return TRADING_VIEW_URL_TEST;
  }

  return TRADING_VIEW_URL;
}
