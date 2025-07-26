import { filter, forEach } from 'lodash';

import { getEndpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  EServiceEndpointEnum,
  IEndpointDomainWhiteList,
  IEndpointInfo,
} from '@onekeyhq/shared/types/endpoint';

import { apiEndpointConfigPersistAtom } from '../states/jotai/atoms/apiEndpointConfig';

export async function getEndpoints() {
  return getEndpointsMap();
}

export async function getEndpointsWithCustomConfig() {
  const baseEndpoints = await getEndpointsMap();

  try {
    // Get custom endpoint configurations
    const { configs } = await apiEndpointConfigPersistAtom.get();

    // Override with enabled custom endpoints
    const enhancedEndpoints = { ...baseEndpoints };

    configs
      .filter((config) => config.enabled)
      .forEach((config) => {
        enhancedEndpoints[config.serviceModule] = config.api;
      });

    return enhancedEndpoints;
  } catch (error) {
    // Fallback to base endpoints if custom config fails
    errorUtils.autoPrintErrorIgnore(error);
    return baseEndpoints;
  }
}

export async function getEndpointByServiceNameWithCustomConfig(
  serviceName: EServiceEndpointEnum,
) {
  const map = await getEndpointsWithCustomConfig();
  return map[serviceName];
}

export async function getEndpointInfo({
  name,
}: {
  name: EServiceEndpointEnum;
}): Promise<IEndpointInfo> {
  // Use enhanced endpoint resolution with custom config support
  const endpoint = await getEndpointByServiceNameWithCustomConfig(name);
  if (!endpoint) {
    throw new OneKeyError(`Invalid endpoint name:${name}`);
  }
  return { endpoint, name };
}

export async function getEndpointDomainWhitelist() {
  const whitelist: IEndpointDomainWhiteList = [];
  // Use endpoints with custom config to include custom domains in whitelist
  const endpoints = await getEndpointsWithCustomConfig();
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
