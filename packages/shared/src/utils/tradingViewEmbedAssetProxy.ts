const TRADING_VIEW_EMBED_PROXY_PATH_PREFIX = '/__onekey_tradingview_embed__/';

const TRUSTED_TRADING_VIEW_ASSET_HOSTNAMES = new Set([
  'tradingview.onekey.so',
  'tradingview.onekeytest.com',
]);

const TRADING_VIEW_RELEASE_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function hasValidReleasePath(pathname: string, requireAsset: boolean): boolean {
  const pathParts = pathname.split('/').filter(Boolean);
  const embedDirectoryIndex = pathParts.lastIndexOf('embed');
  if (embedDirectoryIndex <= 0) {
    return false;
  }
  if (requireAsset && embedDirectoryIndex === pathParts.length - 1) {
    return false;
  }
  return TRADING_VIEW_RELEASE_VERSION_PATTERN.test(
    pathParts[embedDirectoryIndex - 1],
  );
}

export function buildTradingViewEmbedProxyBaseUrl({
  appOrigin,
  sourceBaseUrl,
}: {
  appOrigin: string;
  sourceBaseUrl: string;
}): string | undefined {
  const sourceUrl = new URL(sourceBaseUrl);
  if (
    sourceUrl.protocol !== 'https:' ||
    !TRUSTED_TRADING_VIEW_ASSET_HOSTNAMES.has(sourceUrl.hostname) ||
    sourceUrl.search ||
    sourceUrl.hash ||
    !sourceUrl.pathname.endsWith('/') ||
    !hasValidReleasePath(sourceUrl.pathname, false)
  ) {
    return undefined;
  }

  const proxyUrl = new URL(appOrigin);
  proxyUrl.pathname = `${TRADING_VIEW_EMBED_PROXY_PATH_PREFIX}${sourceUrl.hostname}${sourceUrl.pathname}`;
  proxyUrl.search = '';
  proxyUrl.hash = '';
  return proxyUrl.toString();
}

export function resolveTradingViewEmbedProxySourceUrl(
  requestUrl: string,
): string | undefined {
  const proxyUrl = new URL(requestUrl);
  if (
    proxyUrl.search ||
    proxyUrl.hash ||
    !proxyUrl.pathname.startsWith(TRADING_VIEW_EMBED_PROXY_PATH_PREFIX)
  ) {
    return undefined;
  }

  const proxyPath = proxyUrl.pathname.slice(
    TRADING_VIEW_EMBED_PROXY_PATH_PREFIX.length,
  );
  const pathParts = proxyPath.split('/').filter(Boolean);
  const sourceHostname = pathParts.shift();
  if (
    !sourceHostname ||
    !TRUSTED_TRADING_VIEW_ASSET_HOSTNAMES.has(sourceHostname)
  ) {
    return undefined;
  }

  const sourcePathname = `/${pathParts.join('/')}`;
  if (!hasValidReleasePath(sourcePathname, true)) {
    return undefined;
  }

  return new URL(sourcePathname, `https://${sourceHostname}`).toString();
}
