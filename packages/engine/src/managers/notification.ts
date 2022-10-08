import axios, { Method } from 'axios';
import { debounce } from 'lodash';
import qs from 'qs';

import { appSelector } from '@onekeyhq/kit/src/store';
import { SettingsState } from '@onekeyhq/kit/src/store/reducers/settings';
import { Token } from '@onekeyhq/kit/src/store/typings';
import { getDefaultLocale } from '@onekeyhq/kit/src/utils/locale';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getFiatEndpoint } from '../endpoint';

type PartialNotificationType = Partial<SettingsState['pushNotification']> & {
  instanceId?: string;
};

export type NotificationType = {
  messageID: string;
  title: string;
  content: string;
  extras: Record<string, unknown>;
  notificationEventType: 'notificationArrived' | 'notificationOpened';
  badge?: string;
  ring?: string;
};

export enum PriceAlertOperator {
  greater = 'greater',
  less = 'less',
}

export type PriceAlertItem = {
  price: string;
  impl: string;
  chainId: string;
  address: string;
  currency: string;
  instanceId: string;
  operator: PriceAlertOperator;
  symbol: string;
};

export type AddPriceAlertConfig = Omit<PriceAlertItem, 'instanceId'>;
export type RemovePriceAlertConfig = Omit<
  PriceAlertItem,
  'instanceId' | 'operator' | 'symbol'
>;

export type AccountDynamicItem = {
  instanceId: string;
  accountId: string;
  address: string;
  name: string;
  passphrase: boolean;
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
    debugLogger.notification.warn(
      'syncPushNotificationConfig',
      'can not get instanceId',
    );
  }
  Object.assign(body, {
    instanceId,
  });
  const isQuery = ['get', 'delete'].includes(method);
  if (isQuery) {
    apiUrl = `${apiUrl}?${qs.stringify(body)}`;
  }
  if (!platformEnv.isNative) {
    return fallback;
  }
  try {
    debugLogger.notification.debug(`syncPushNotificationConfig`, {
      method,
      apiUrl,
      body,
    });
    const { data } = await axios.request<T>({
      url: apiUrl,
      data: isQuery ? undefined : body,
      method,
    });
    return data;
  } catch (error) {
    debugLogger.notification.error(
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
  if (!config.registrationId) {
    return {};
  }
  return fetchData('/notification/config', config, {}, 'put');
};

export const syncPushNotificationConfig = debounce(sync, 10 * 1000, {
  leading: true,
  trailing: true,
});

export const addPriceAlertConfig = async (body: AddPriceAlertConfig) =>
  fetchData<Record<string, string>>(
    '/notification/price-alert',
    body,
    {},
    'post',
  );

export const removePriceAlertConfig = async (body: RemovePriceAlertConfig) =>
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
  fetchData<AccountDynamicItem | null>(
    '/notification/account-dynamic',
    body,
    null,
    'post',
  );

export const removeAccountDynamic = async (
  body: Omit<
    AccountDynamicItem,
    'instanceId' | 'name' | 'accountId' | 'passphrase'
  >,
) =>
  fetchData<AccountDynamicItem | null>(
    '/notification/account-dynamic',
    body,
    null,
    'delete',
  );

export const queryAccountDynamic = async () =>
  fetchData<AccountDynamicItem[]>(
    '/notification/account-dynamic',
    {},
    [],
    'get',
  );

export const syncLocalEnabledAccounts = async (addresses: string[]) =>
  fetchData<string[]>(
    '/notification/account-dynamic/sync',
    {
      addresses,
    },
    [],
    'put',
  );
