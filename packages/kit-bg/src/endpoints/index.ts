import axios from 'axios';
import { filter, forEach } from 'lodash';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { ONEKEY_API_HOST } from '@onekeyhq/shared/src/config/appConfig';
import { getEndpointsMapByDevSettings } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  EServiceEndpointEnum,
  IEndpointDomainWhiteList,
  IEndpointInfo,
} from '@onekeyhq/shared/types/endpoint';

import { devSettingsPersistAtom } from '../states/jotai/atoms';

type IEndpointCheckResponse = {
  data: {
    needsPrefix: boolean;
  };
};

// Memoized endpoint prefix check - only executes once per hour
const checkEndpointPrefixRaw = async (): Promise<string | undefined> => {
  try {
    const requestUrl = `https://utility.${ONEKEY_API_HOST}/utility/v1/check-endpoint-switch`;

    // Create clean axios instance without interceptors
    const cleanAxios = axios.create({
      timeout: 3000,
      baseURL: undefined,
    });

    // Clear interceptors to avoid side effects
    cleanAxios.interceptors.request.clear();
    cleanAxios.interceptors.response.clear();

    const requiredHeaders = await getRequestHeaders();

    const response = await cleanAxios.get<IEndpointCheckResponse>(requestUrl, {
      headers: requiredHeaders,
    });

    // const needsPrefix = response.data?.data?.needsPrefix === true;
    const needsPrefix = true;
    return needsPrefix ? 'by' : undefined;
  } catch (error) {
    return undefined; // Use default endpoints when check fails
  }
};

const checkEndpointPrefix = memoizee(checkEndpointPrefixRaw, {
  promise: true,
  maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
  max: 1,
});

// Track last prefix to detect changes and clear cache
let lastPrefix: string | undefined;

export async function getEndpoints() {
  // Get settings based on environment
  let settings: {
    enabled: boolean;
    settings?: { enableTestEndpoint?: boolean };
  };

  if (platformEnv.isWebEmbed) {
    const enableTestEndpoint =
      globalThis?.WEB_EMBED_ONEKEY_APP_SETTINGS?.enableTestEndpoint ?? false;
    settings = {
      enabled: enableTestEndpoint,
      settings: { enableTestEndpoint },
    };
  } else {
    settings = await devSettingsPersistAtom.get();
  }

  // Check endpoint prefix for production environment only
  const shouldCheckPrefix =
    !settings.enabled || !settings.settings?.enableTestEndpoint;
  let currentPrefix: string | undefined;

  if (shouldCheckPrefix) {
    currentPrefix = await checkEndpointPrefix();

    // Clear HTTP client cache if prefix changed
    if (lastPrefix !== currentPrefix) {
      appApiClient.clearClientCache();
      lastPrefix = currentPrefix;
    }
  }

  return getEndpointsMapByDevSettings(settings, {
    prefix: currentPrefix,
  });
}

// Export method to force refresh endpoint check
export function forceRefreshEndpointCheck() {
  void checkEndpointPrefix.clear();
  lastPrefix = undefined;
}

export async function getEndpointInfo({
  name,
}: {
  name: EServiceEndpointEnum;
}): Promise<IEndpointInfo> {
  const endpoints = await getEndpoints();
  const endpoint = endpoints[name];
  if (!endpoint) {
    throw new OneKeyError(`Invalid endpoint name:${name}`);
  }
  return { endpoint, name };
}

export async function getEndpointDomainWhitelist() {
  const whitelist: IEndpointDomainWhiteList = [];
  const endpoints = await getEndpoints();
  forEach(endpoints, (endpoint) => {
    try {
      if (endpoint) {
        const url = new URL(endpoint);
        whitelist.push(url.host);
      }
    } catch (e) {
      errorUtils.autoPrintErrorIgnore(e);
    }
  });
  return filter(whitelist, Boolean);
}

export async function checkIsOneKeyDomain(url: string) {
  try {
    const whitelist = await getEndpointDomainWhitelist();
    return whitelist.includes(new URL(url).host);
  } catch (e) {
    errorUtils.autoPrintErrorIgnore(e);
    return false;
  }
}
