import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

export const OI_WINDOW_DAYS = {
  '24h': 1,
  '7d': 7,
  history: 90,
} as const;

export type IPerpOiHistoryRange = keyof typeof OI_WINDOW_DAYS;

export function getPerpOiSource(devSettings: IDevSettingsPersistAtom) {
  const custom =
    platformEnv.isDev && !platformEnv.isWebEmbed && devSettings.enabled
      ? devSettings.settings?.customApiEndpoints?.findLast(
          (entry) =>
            entry.enabled &&
            entry.serviceModule === EServiceEndpointEnum.Utility,
        )
      : undefined;
  if (custom) return { endpoint: custom.api, cacheScope: undefined };
  const useTest = platformEnv.isWebEmbed
    ? globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS?.enableTestEndpoint
    : devSettings.enabled && devSettings.settings?.enableTestEndpoint;
  const cacheScope = useTest ? 'test' : 'prod';
  return { endpoint: endpointsMap[cacheScope].utility, cacheScope };
}

export function fetchPerpOiHistory(
  coin: string,
  range: IPerpOiHistoryRange,
  expectedEndpoint: string,
) {
  const endTime = Date.now();
  return backgroundApiProxy.serviceHyperliquid.getPerpOiHistory({
    coin,
    expectedEndpoint,
    interval: range === 'history' ? '1h' : '5m',
    startTime: endTime - OI_WINDOW_DAYS[range] * 86_400_000,
    endTime,
  });
}
