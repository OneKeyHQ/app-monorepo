import { ONEKEY_API_HOST, ONEKEY_TEST_API_HOST } from '../config/appConfig';
import type { AxiosRequestConfig } from 'axios';

type IRuntimeNetworkRequestConfig = Pick<
  AxiosRequestConfig,
  'baseURL' | 'method' | 'url'
>;

type ITravelModeService = 'earn' | 'swap' | 'utility';

const TRAVEL_MODE_ALLOWED_REQUESTS = new Set(
  (
    [
      ['earn', 'get', '/earn/v1/available-assets'],
      ['earn', 'get', '/earn/v1/banner/list'],
      ['earn', 'get', '/earn/v1/block-region'],
      ['earn', 'get', '/earn/v1/faq/list'],
      ['earn', 'get', '/earn/v2/available-assets'],
      ['swap', 'get', '/swap/v1/networks'],
      ['swap', 'get', '/swap/v1/native-token-config'],
      ['swap', 'get', '/swap/v1/providers/list'],
      ['swap', 'get', '/swap/v1/speed-config'],
      ['swap', 'get', '/swap/v1/swap-config'],
      ['swap', 'get', '/swap/v1/token/detail'],
      ['swap', 'get', '/swap/v1/tokens'],
      ['utility', 'get', '/utility/v1/discover/dapp/homepage'],
      ['utility', 'get', '/utility/v1/market/asset/list'],
      ['utility', 'get', '/utility/v1/market/tokens'],
      ['utility', 'get', '/utility/v1/perp-config'],
      ['utility', 'get', '/utility/v1/stocks'],
      ['utility', 'get', '/utility/v1/swap-tips'],
      ['utility', 'get', '/utility/v2/market/basic-config'],
      ['utility', 'get', '/utility/v2/market/perps/token-list'],
      ['utility', 'get', '/utility/v2/market/token/list'],
      ['utility', 'get', '/utility/v2/market/banner/list'],
      ['swap', 'post', '/swap/v1/check-stable-coins-list'],
      ['utility', 'post', '/utility/v2/market/token/list/batch'],
    ] as const satisfies readonly (readonly [
      ITravelModeService,
      string,
      string,
    ])[]
  ).flatMap(([service, method, path]) =>
    [ONEKEY_API_HOST, ONEKEY_TEST_API_HOST].map(
      (host) => `${method} https://${service}.${host}${path}`,
    ),
  ),
);

function normalizePath(path: string): string {
  const normalizedPath = path.split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

function getRequestUrl({
  baseURL,
  url,
}: IRuntimeNetworkRequestConfig): URL | undefined {
  if (!url) {
    return undefined;
  }

  if (typeof URL !== 'undefined') {
    try {
      return new URL(url, baseURL);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function getTravelModeNetworkRequestKey(
  config: IRuntimeNetworkRequestConfig,
): string | undefined {
  const requestUrl = getRequestUrl(config);
  if (!requestUrl) {
    return undefined;
  }

  const method = (config.method || 'get').toLowerCase();
  return `${method} ${requestUrl.origin}${normalizePath(requestUrl.pathname)}`;
}

/**
 * Travel Mode only permits the read-only requests needed to paint top-level
 * tabs. Detail, account, and transaction endpoints remain suppressed.
 */
export function isTravelModeNetworkRequestAllowed(
  config: IRuntimeNetworkRequestConfig,
): boolean {
  const requestKey = getTravelModeNetworkRequestKey(config);
  return requestKey ? TRAVEL_MODE_ALLOWED_REQUESTS.has(requestKey) : false;
}
