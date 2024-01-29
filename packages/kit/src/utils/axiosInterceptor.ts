/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import { forEach } from 'lodash';
import { Appearance } from 'react-native';

import { checkIsOneKeyDomain } from '@onekeyhq/kit-bg/src/endpoints';
import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import { defaultColorScheme } from '../hooks/useSystemColorScheme';

import type { AxiosInstance, AxiosRequestConfig } from 'axios';

axios.interceptors.request.use(async (config) => {
  try {
    const isOneKeyDomain = await checkIsOneKeyDomain(config.baseURL ?? '');
    if (!isOneKeyDomain) return config;
  } catch (e) {
    return config;
  }

  const settings = await settingsPersistAtom.get();

  let { locale, theme } = settings;

  if (locale === 'system') {
    locale = getDefaultLocale();
  }

  if (theme === 'system') {
    theme = Appearance.getColorScheme() ?? defaultColorScheme;
  }

  // Be consistent with backend platform definition
  // https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/390266887#%E5%85%AC%E5%85%B1%E5%8F%82%E6%95%B0
  const platform = platformEnv.appPlatform;
  const channel = platformEnv.appChannel;
  const headerPlatform = [platform, channel].filter(Boolean).join('-');

  config.headers.set('X-Onekey-Request-ID', generateUUID());
  config.headers.set('X-Onekey-Request-Currency', settings.currencyInfo.id);
  config.headers.set('X-Onekey-Request-Locale', locale);
  config.headers.set('X-Onekey-Request-Theme', theme);
  config.headers.set('X-Onekey-Request-Platform', headerPlatform);
  config.headers.set('X-Onekey-Request-Version', platformEnv.version);
  config.headers.set('X-Onekey-Request-Build-Number', platformEnv.buildNumber);

  return config;
});

axios.interceptors.response.use(async (response) => {
  const { config } = response;
  try {
    const isOneKeyDomain = await checkIsOneKeyDomain(config.baseURL ?? '');
    if (!isOneKeyDomain) return response;
  } catch (e) {
    return response;
  }

  const data = response.data as IOneKeyAPIBaseResponse;

  if (data.code !== 0) {
    throw new OneKeyError({
      autoToast: false,
      message: data.message,
    });
  }
  return response;
});

const orgCreate = axios.create;
axios.create = function (config?: AxiosRequestConfig): AxiosInstance {
  const result = orgCreate.call(this, config);
  forEach((axios.interceptors.request as any).handlers, (handler) => {
    result.interceptors.request.use(handler.fulfilled, handler.rejected);
  });
  forEach((axios.interceptors.response as any).handlers, (handler) => {
    result.interceptors.response.use(handler.fulfilled, handler.rejected);
  });
  return result;
};
