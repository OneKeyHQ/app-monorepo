import { filter, forEach } from 'lodash';

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  getEndpointsMapWithDynamicPrefix,
  forceRefreshEndpointCheck as sharedForceRefreshEndpointCheck,
} from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  EServiceEndpointEnum,
  IEndpointDomainWhiteList,
  IEndpointInfo,
} from '@onekeyhq/shared/types/endpoint';

// Track last endpoints to detect changes and clear cache
let lastEndpointsString: string | undefined;

export async function getEndpoints() {
  const endpoints = await getEndpointsMapWithDynamicPrefix();

  // Clear HTTP client cache if endpoints changed
  const currentEndpointsString = JSON.stringify(endpoints);
  if (lastEndpointsString !== currentEndpointsString) {
    appApiClient.clearClientCache();
    lastEndpointsString = currentEndpointsString;
  }

  return endpoints;
}

// Export method to force refresh endpoint check
export function forceRefreshEndpointCheck() {
  sharedForceRefreshEndpointCheck();
  lastEndpointsString = undefined;
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
