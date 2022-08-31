import axios, { Method } from 'axios';
import { debounce } from 'lodash';
import qs from 'qs';

import { appSelector } from '@onekeyhq/kit/src/store';
import { SettingsState } from '@onekeyhq/kit/src/store/reducers/settings';
import { Token } from '@onekeyhq/kit/src/store/typings';
import { getDefaultLocale } from '@onekeyhq/kit/src/utils/locale';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getFiatEndpoint } from '../endpoint';

type PartialNotificationType = Partial<SettingsState['pushNotification']> & {
  instanceId?: string;
};

export type PriceAlertItem = {
  price: string;
  impl: string;
  chainId: string;
  address: string;
  currency: string;
  instanceId: string;
};

export type ChangePriceAlertConfig = Omit<PriceAlertItem, 'instanceId'>;

export type AccountDynamicItem = {
  instanceId: string;
  address: string;
  bgColor?: string;
  emoji?: string;
};

async function fetchData<T>(
  path: string,
  body: Record<string, unknown> = {},
  fallback: T,
  method: Method,
): Promise<T> {
  const endpoint = getFiatEndpoint();
  let apiUrl = `${endpoint}${path}`;
  const instanceId = appSelector((state) => state?.settings?.instanceId);
  if (!instanceId) {
    debugLogger.http.warn(
      'syncPushNotificationConfig',
      'can not get instanceId',
    );
  }
  Object.assign(body, {
    instanceId,
  });
  if (method === 'get') {
    apiUrl = `${apiUrl}?${qs.stringify(body)}`;
  }
  try {
    debugLogger.common.debug(`syncPushNotificationConfig`, {
      apiUrl,
      body,
    });
    const { data } = await axios.request<T>({
      url: apiUrl,
      data: method === 'get' ? undefined : body,
      method,
    });
    return data;
  } catch (error) {
    debugLogger.common.error(
      `${method} ${apiUrl} error`,
      error instanceof Error ? error?.message : error,
    );
    return fallback;
  }
}

const sync = async (
  type: 'reset' | 'normal' = 'normal',
): Promise<PartialNotificationType> => {
  const config: PartialNotificationType = appSelector((state) => ({
    ...(state?.settings?.pushNotification || {}),
    locale:
      state.settings.locale === 'system'
        ? getDefaultLocale()
        : state.settings.locale,
    currency: state.settings.selectedFiatMoneySymbol,
  }));
  if (type === 'reset') {
    Object.assign(config, {
      pushEnable: false,
    });
  }
  if (!config.instanceId || !config.registrationId) {
    return {};
  }
  return fetchData('/notification/config', config, {}, 'put');
};

export const syncPushNotificationConfig = debounce(sync, 10 * 1000, {
  leading: true,
  trailing: true,
});

export const addPriceAlertConfig = async (body: ChangePriceAlertConfig) =>
  fetchData<Record<string, string>>(
    '/notification/price-alert',
    body,
    {},
    'post',
  );

export const removePriceAlertConfig = async (body: ChangePriceAlertConfig) =>
  fetchData<Record<string, string>>(
    '/notification/price-alert',
    body,
    {},
    'delete',
  );

export const queryPriceAlertList = async (
  query?: Pick<Token, 'impl' | 'chainId' | 'address'>,
) =>
  fetchData<PriceAlertItem[]>(
    '/notification/price-alert',
    query || {},
    [],
    'get',
  );

export const addAccountDynamic = async (
  body: Omit<AccountDynamicItem, 'instanceId'>,
) =>
  fetchData<Record<string, string>>(
    '/notification/account-dynamic',
    body,
    {},
    'post',
  );

export const removeAccountDynamic = async (
  body: Omit<AccountDynamicItem, 'instanceId'>,
) =>
  fetchData<Record<string, string>>(
    '/notification/account-dynamic',
    body,
    {},
    'delete',
  );

export const queryAccountDynamic = async () =>
  fetchData<AccountDynamicItem[]>(
    '/notification/account-dynamic',
    {},
    [],
    'get',
  );
