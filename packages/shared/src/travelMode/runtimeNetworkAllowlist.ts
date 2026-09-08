import type { AxiosRequestConfig } from 'axios';

type IRuntimeNetworkRequestConfig = Pick<
  AxiosRequestConfig,
  'baseURL' | 'method' | 'url'
>;

const TRAVEL_MODE_ALLOWED_REQUESTS = new Set([
  'get /earn/v1/available-assets',
  'get /earn/v1/banner/list',
  'get /earn/v1/block-region',
  'get /earn/v1/faq/list',
  'get /swap/v1/networks',
  'get /swap/v1/native-token-config',
  'get /swap/v1/providers/list',
  'get /swap/v1/speed-config',
  'get /swap/v1/swap-config',
  'get /swap/v1/token/detail',
  'get /swap/v1/tokens',
  'get /utility/v1/discover/dapp/homepage',
  'get /utility/v1/market/asset/list',
  'get /utility/v1/market/tokens',
  'get /utility/v1/perp-config',
  'get /utility/v1/stocks',
  'get /utility/v1/swap-tips',
  'get /utility/v2/market/basic-config',
  'get /utility/v2/market/perps/token-list',
  'get /utility/v2/market/token/list',
  'get /utility/v2/market/banner/list',
  'post /swap/v1/check-stable-coins-list',
  'post /utility/v2/market/token/list/batch',
]);

function normalizePath(path: string): string {
  const normalizedPath = path.split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = normalizedPath.startsWith('/')
    ? normalizedPath
    : `/${normalizedPath}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

function getRequestPath({
  baseURL,
  url,
}: IRuntimeNetworkRequestConfig): string | undefined {
  if (!url) {
    return undefined;
  }

  if (typeof URL !== 'undefined') {
    try {
      const parsed = new URL(url, baseURL || 'https://onekey.invalid');
      return normalizePath(parsed.pathname);
    } catch {
      // Fall back to relative URL parsing for environments without URL support.
    }
  }

  return normalizePath(url);
}

function getTravelModeNetworkRequestKey(
  config: IRuntimeNetworkRequestConfig,
): string | undefined {
  const path = getRequestPath(config);
  if (!path) {
    return undefined;
  }

  const method = (config.method || 'get').toLowerCase();
  return `${method} ${path}`;
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
