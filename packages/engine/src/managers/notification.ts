import axios from 'axios';
import { debounce } from 'lodash';

import { appSelector } from '@onekeyhq/kit/src/store';
import { SettingsState } from '@onekeyhq/kit/src/store/reducers/settings';
import { getDefaultLocale } from '@onekeyhq/kit/src/utils/locale';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getFiatEndpoint } from '../endpoint';

type PartialNotificationType = Partial<SettingsState['pushNotification']> & {
  instanceId?: string;
};

async function fetchData<T>(
  path: string,
  body: Record<string, unknown> = {},
  fallback: T,
): Promise<T> {
  const endpoint = getFiatEndpoint();
  const apiUrl = `${endpoint}${path}`;
  try {
    debugLogger.common.debug(`syncPushNotificationConfig`, {
      apiUrl,
      body,
    });
    const { data } = await axios.put<T>(apiUrl, body);
    return data;
  } catch (error) {
    debugLogger.common.error(`fetch ${apiUrl} error`);
    return fallback;
  }
}

const sync = async (): Promise<PartialNotificationType> => {
  const config: PartialNotificationType = appSelector((state) => ({
    ...(state?.settings?.pushNotification || {}),
    instanceId: state?.settings?.instanceId,
    locale:
      state.settings.locale === 'system'
        ? getDefaultLocale()
        : state.settings.locale,
    currency: state.settings.selectedFiatMoneySymbol,
  }));
  if (!config.instanceId || !config.registrationId) {
    return {};
  }
  return fetchData('/notification/config', config, {});
};

export const syncPushNotificationConfig = debounce(sync, 10 * 1000);
