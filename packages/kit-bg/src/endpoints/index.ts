import { filter, forEach } from 'lodash';

import { getEndpointsMapByDevSettings } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  EServiceEndpointEnum,
  IEndpointDomainWhiteList,
  IEndpointInfo,
} from '@onekeyhq/shared/types/endpoint';

import { devSettingsPersistAtom } from '../states/jotai/atoms';

export async function getEndpoints() {
  const settings = await devSettingsPersistAtom.get();
  return getEndpointsMapByDevSettings(settings);
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
