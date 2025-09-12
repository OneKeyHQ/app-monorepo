import { filter, forEach } from 'lodash';

import { getEndpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EServiceEndpointEnum,
  IEndpointDomainWhiteList,
  IEndpointInfo,
} from '@onekeyhq/shared/types/endpoint';

import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

export async function getEndpoints() {
  return getEndpointsMap();
}

async function getEndpointsWithCustomConfig() {
  const baseEndpoints = await getEndpointsMap();

  if (platformEnv.isWebEmbed || !platformEnv.isDev) {
    return baseEndpoints;
  }

  try {
    // Get custom endpoint configurations from dev settings
    const devSettings = await devSettingsPersistAtom.get();
    const configs = devSettings.settings?.customApiEndpoints || [];

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

async function getEndpointByServiceNameWithCustomConfig(
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
  let endpoint = (await getEndpoints())[name];
  if (!platformEnv.isWebEmbed && platformEnv.isDev) {
    // Check if dev settings are enabled before using custom config
    const devSettings = await devSettingsPersistAtom.get();
    endpoint = devSettings.enabled
      ? await getEndpointByServiceNameWithCustomConfig(name)
      : (await getEndpoints())[name];
  }
  if (!endpoint) {
    throw new OneKeyError(`Invalid endpoint name:${name}`);
  }
  return { endpoint, name };
}

export async function getEndpointDomainWhitelist() {
  const whitelist: IEndpointDomainWhiteList = [];

  let endpoints = await getEndpoints();

  if (!platformEnv.isWebEmbed && platformEnv.isDev) {
    // Check if dev settings are enabled
    const devSettings = await devSettingsPersistAtom.get();
    endpoints = devSettings.enabled
      ? await getEndpointsWithCustomConfig()
      : await getEndpoints();
  }
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
