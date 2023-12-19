/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import axios from 'axios';
import { forEach } from 'lodash';
import { Appearance } from 'react-native';

import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

import { defaultColorScheme } from '../hooks/useSystemColorScheme';

import type { AxiosInstance, AxiosRequestConfig } from 'axios';

axios.interceptors.request.use(async (config) => {
  const settings = await settingsPersistAtom.get();

  let { locale, theme } = settings;

  if (locale === 'system') {
    locale = getDefaultLocale();
  }

  if (theme === 'system') {
    theme = Appearance.getColorScheme() ?? defaultColorScheme;
  }

  config.headers.set('X-Onekey-Request-ID', generateUUID());
  config.headers.set('X-Onekey-Request-Currency', settings.currency);
  config.headers.set('X-Onekey-Request-Locale', locale);
  config.headers.set('X-Onekey-Request-Theme', theme);
  config.headers.set(
    'X-Onekey-Request-Platform',
    platformEnv.distributionChannel,
  );
  config.headers.set('X-Onekey-Request-Version', platformEnv.version);
  config.headers.set('X-Onekey-Request-Build-Number', platformEnv.buildNumber);

  return config;
});

axios.interceptors.response.use((response) => {
  const { data }: { data: IOneKeyAPIBaseResponse } = response;
  if (data.code !== 0) {
    throw new OneKeyError({
      autoToast: true,
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
