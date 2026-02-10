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
  if (!endpoints || endpoints.length === 0) {
    return null;
  }

  // 优先使用已经测速/选择过的 IP；否则使用配置里的候选 IP（避免依赖 runtime.selections）
  const selectedIp = ipTableConfig.runtime?.selections?.[lookupDomain];
  const rootDomain = extractRootDomain(hostname);
  const preferCloudflare = rootDomain === 'onekey.so';

  const candidateIps = [
    ...(selectedIp ? [selectedIp] : []),
    ...endpoints
      .filter((ep) => (preferCloudflare ? ep.provider === 'cloudflare' : true))
      .map((ep) => ep.ip),
    ...endpoints.map((ep) => ep.ip),
  ].filter((ip): ip is string => !!ip);

  // 去重 + 限制尝试次数，避免阻塞过久；一般 1-2 个 IP 足够
  const uniqIps: string[] = [];
  for (const ip of candidateIps) {
    if (!uniqIps.includes(ip)) {
      uniqIps.push(ip);
    }
    if (uniqIps.length >= 2) {
      break;
    }
  }

  if (uniqIps.length === 0) {
    return null;
  }

  let sniResp = null as Awaited<ReturnType<typeof sniRequest>>;
  for (const ip of uniqIps) {
    // 这里使用 SNI 直连：TLS SNI = hostname，目标地址 = IP
    // 目的：在域名直连不稳定的网络环境下仍能拉到 config.json
    // eslint-disable-next-line no-await-in-loop
    sniResp = await sniRequest({
      ip,
      hostname,
      path: `${urlObj.pathname}${urlObj.search}`,
      method: 'GET',
      headers: {},
      body: null,
      timeout,
      port: 443,
    });
    if (sniResp) {
      break;
    }
  }

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
      // 对 onekey.so 域（例如 data.onekey.so/config.json）优先尝试 IP + SNI 直连，
      // 这样可以最大化避免 SDK 侧 fallback axios 的二次域名直连重试。
      try {
        const ipFirstData = await tryFetchConfigViaIpTableFallback({
          url,
          timeout: 7000,
        });
        if (ipFirstData) {
          console.log('[HardwareSDK] configFetcher ipTable ip-first success');
          return ipFirstData;
        }
      } catch (ipFirstError) {
        console.warn(
          '[HardwareSDK] configFetcher ipTable ip-first error:',
          ipFirstError,
        );
      }

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
