import { checkIsOneKeyDomain } from '@onekeyhq/kit-bg/src/endpoints';
import { analytics } from '@onekeyhq/shared/src/analytics';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IWebEmbedOnekeyAppSettings } from '@onekeyhq/web-embed/utils/webEmbedAppSettings';

const getValueFromWebEmbedOneKeyAppSettings = <
  T extends keyof IWebEmbedOnekeyAppSettings,
>(
  key: T,
): IWebEmbedOnekeyAppSettings[keyof IWebEmbedOnekeyAppSettings] | string => {
  const value = globalThis?.WEB_EMBED_ONEKEY_APP_SETTINGS?.[key];
  return value ?? '';
};

const initRequestHelper = () => {
  requestHelper.overrideMethods({
    checkIsOneKeyDomain,
    getDevSettingsPersistAtom: async () => {
      return (
        globalThis?.WEB_EMBED_ONEKEY_APP_SETTINGS?.$devSettings ?? {
          enabled: false,
        }
      );
    },
    getSettingsPersistAtom: async () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      Promise.resolve({
        currencyInfo: {
          id: 'usd',
          symbol: '$',
        },
        instanceId: getValueFromWebEmbedOneKeyAppSettings('instanceId'),
        theme: getValueFromWebEmbedOneKeyAppSettings('themeVariant') as
          | 'light'
          | 'dark',
        lastLocale: getValueFromWebEmbedOneKeyAppSettings('localeVariant'),
        locale: getValueFromWebEmbedOneKeyAppSettings('localeVariant'),
        version: getValueFromWebEmbedOneKeyAppSettings('appVersion'),
        buildNumber: getValueFromWebEmbedOneKeyAppSettings('appBuildNumber'),
      } as any),
    getSettingsValuePersistAtom: async () =>
      Promise.resolve({
        hideValue: false,
      }),
  });
};

export const initAnalytics = () => {
  const instanceId = getValueFromWebEmbedOneKeyAppSettings(
    'instanceId',
  ) as string;
  analytics.init({
    instanceId,
    baseURL: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Utility,
      env:
        globalThis?.WEB_EMBED_ONEKEY_APP_SETTINGS?.enableTestEndpoint ?? false
          ? 'test'
          : 'prod',
    }),
  });
};

export const init = () => {
  initRequestHelper();
  initAnalytics();
};
