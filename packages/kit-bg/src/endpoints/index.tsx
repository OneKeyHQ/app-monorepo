import { filter, forEach } from 'lodash';

import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type { IEndpointDomainWhiteList } from '@onekeyhq/shared/types/endpoint';

import { devSettingsPersistAtom } from '../states/jotai/atoms';

import { endpointsMap } from './endpointsMap';

export async function getEndpoints() {
  const settings = await devSettingsPersistAtom.get();
  if (settings.enabled && settings.settings?.enableTestEndpoint) {
    return endpointsMap.test;
  }
  return endpointsMap.prod;
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
