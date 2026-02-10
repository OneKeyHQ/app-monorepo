import axios from 'axios';

import { ONEKEY_API_HOST, ONEKEY_TEST_API_HOST } from '../config/appConfig';
import { getEndpointsMap } from '../config/endpointsMap';
import requestHelper from '../request/requestHelper';
import { isSniSupported, sniRequest } from '../request/helpers/sniRequest';

import type { RemoteConfigResponse } from '@onekeyfe/hd-core';
import type { AxiosInstance } from 'axios';

// Cached axios instance with IP Table adapter for config fetching
let configFetcherAxios: AxiosInstance | null = null;

function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

async function getLookupDomainForIpTable(hostname: string): Promise<string> {
  const rootDomain = extractRootDomain(hostname);

  // onekey.so 相关子域名（例如 data.onekey.so）和主 API 使用同一套 IP Table 配置（onekeycn.com/onekeytest.com）
  if (rootDomain !== 'onekey.so') {
    return rootDomain;
  }

  try {
    const endpointsMap = await getEndpointsMap();
    const isTestEnv = endpointsMap.wallet?.includes(ONEKEY_TEST_API_HOST);
    return isTestEnv ? ONEKEY_TEST_API_HOST : ONEKEY_API_HOST;
  } catch {
    return ONEKEY_API_HOST;
  }
}

async function tryFetchConfigViaIpTableFallback(params: {
  url: string;
  timeout: number;
}): Promise<RemoteConfigResponse | null> {
  const { url, timeout } = params;

  // 只有 Native/Desktop 才支持 SNI 直连；这里做一次兜底重试（不依赖 runtime.selections）
  if (!isSniSupported()) {
    return null;
  }

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return null;
  }

  // 仅对 https 才有意义
  if (urlObj.protocol !== 'https:') {
    return null;
  }

  const hostname = urlObj.hostname;
  const lookupDomain = await getLookupDomainForIpTable(hostname);

  const ipTableConfig = await requestHelper.getIpTableConfig();
  if (!ipTableConfig || ipTableConfig.runtime?.enabled === false) {
    return null;
  }

  const endpoints = ipTableConfig.config.domains?.[lookupDomain]?.endpoints;
  const fallbackIp = endpoints?.[0]?.ip;
  if (!fallbackIp) {
    return null;
  }

  const sniResp = await sniRequest({
    ip: fallbackIp,
    hostname,
    path: `${urlObj.pathname}${urlObj.search}`,
    method: 'GET',
    headers: {},
    body: null,
    timeout,
    port: 443,
  });

  if (!sniResp) {
    return null;
  }

  let responseData: any = sniResp.body;
  if (typeof responseData === 'string') {
    try {
      responseData = JSON.parse(responseData);
    } catch {
      // 保持与 ipTableAdapter 行为一致：解析失败则返回原始内容
    }
  }

  return responseData as RemoteConfigResponse;
}

async function getConfigFetcherAxios(): Promise<AxiosInstance> {
  if (!configFetcherAxios) {
    const baseConfig = {
      timeout: 7000,
    };

    let ipTableAdapter;
    try {
      const { isSupportIpTablePlatform } =
        await import('../utils/ipTableUtils');
      if (isSupportIpTablePlatform()) {
        const { createIpTableAdapter } =
          await import('../request/helpers/ipTableAdapter');
        ipTableAdapter = createIpTableAdapter(baseConfig);
      }
    } catch (error) {
      console.warn('[HardwareSDK] Failed to load IP Table adapter:', error);
    }

    configFetcherAxios = axios.create({
      ...baseConfig,
      adapter: ipTableAdapter,
    });
  }
  return configFetcherAxios;
}

export async function createConfigFetcher(): Promise<
  ((url: string) => Promise<RemoteConfigResponse | null>) | undefined
> {
  // Only create configFetcher for platforms that support IP Table
  // Otherwise return undefined to let SDK use its default fetching logic
  try {
    const { isSupportIpTablePlatform } = await import('../utils/ipTableUtils');
    if (!isSupportIpTablePlatform()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return async (url: string) => {
    console.log('[HardwareSDK] configFetcher url:', url);
    try {
      const axiosInstance = await getConfigFetcherAxios();
      const response = await axiosInstance.get<RemoteConfigResponse>(url, {
        timeout: 7000,
      });
      console.log('[HardwareSDK] configFetcher success');
      return response.data;
    } catch (error) {
      console.warn('[HardwareSDK] configFetcher error:', error);

      try {
        const fallbackData = await tryFetchConfigViaIpTableFallback({
          url,
          timeout: 7000,
        });
        if (fallbackData) {
          console.log('[HardwareSDK] configFetcher ipTable fallback success');
          return fallbackData;
        }
      } catch (fallbackError) {
        console.warn(
          '[HardwareSDK] configFetcher ipTable fallback error:',
          fallbackError,
        );
      }

      return null;
    }
  };
}
