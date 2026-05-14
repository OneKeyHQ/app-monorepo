import { toASCII, toUnicode } from 'punycode/';
import validator from 'validator';

import type { IUrlValue } from '@onekeyhq/shared/types/uri';

import { ONEKEY_APP_DEEP_LINK_NAME } from '../consts/deeplinkConsts';
import {
  PROTOCOLS_SUPPORTED_TO_OPEN,
  VALID_DEEP_LINK,
} from '../consts/urlProtocolConsts';
import platformEnv from '../platformEnv';

import type {
  EOneKeyDeepLinkPath,
  IEOneKeyDeepLinkParams,
} from '../consts/deeplinkConsts';
import type { WalletKitTypes } from '@reown/walletkit';

const DOMAIN_REGEXP =
  /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;

// Match patterns like: onekey.so/invite/ABC123, www.example.com, etc.
const URL_WITHOUT_PROTOCOL_REGEXP =
  /^(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?$/;

const LOCALHOST_URL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const URL_SCHEME_REGEXP = /^[a-zA-Z][a-zA-Z0-9+.-]*:/u;
const URL_PROTOCOL_PREFIX_REGEXP = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u;
const URL_HOSTNAME_DOT_SEPARATOR_REGEXP = /[\u3002\uFF0E\uFF61]/gu;

type ILocalhostUrlOptions = {
  allowLocalhostUrl?: boolean;
};

function isLocalhostParsedUrl(parsedUrl: URL | null) {
  const hostname = getNormalizedParsedHostname(parsedUrl);
  const result = Boolean(hostname && LOCALHOST_URL_HOSTNAMES.has(hostname));
  return result;
}

function isIpAddressParsedUrl(parsedUrl: URL | null) {
  const hostname = getNormalizedParsedHostname(parsedUrl);
  const result = Boolean(hostname && validator.isIP(hostname));
  return result;
}

function getNormalizedParsedHostname(parsedUrl: URL | null) {
  const result = parsedUrl?.hostname
    .replace(/^\[|\]$/gu, '')
    .replace(URL_HOSTNAME_DOT_SEPARATOR_REGEXP, '.')
    .toLowerCase();
  return result;
}

function normalizeUrlHostnameSeparators(url: string) {
  const protocolMatch = url.match(URL_PROTOCOL_PREFIX_REGEXP);
  const hostStartIndex = protocolMatch ? protocolMatch[0].length : 0;
  const urlPrefix = url.slice(0, hostStartIndex);
  const hostAndPath = url.slice(hostStartIndex);
  const hostEndIndex = hostAndPath.search(/[/?#]/u);
  const hostWithPortAndAuth =
    hostEndIndex >= 0 ? hostAndPath.slice(0, hostEndIndex) : hostAndPath;
  const rest = hostEndIndex >= 0 ? hostAndPath.slice(hostEndIndex) : '';
  const authEndIndex = hostWithPortAndAuth.lastIndexOf('@');
  const authPrefix =
    authEndIndex >= 0 ? hostWithPortAndAuth.slice(0, authEndIndex + 1) : '';
  const hostWithPort =
    authEndIndex >= 0
      ? hostWithPortAndAuth.slice(authEndIndex + 1)
      : hostWithPortAndAuth;

  if (hostWithPort.startsWith('[')) {
    const closingBracketIndex = hostWithPort.indexOf(']');
    if (closingBracketIndex > 0) {
      const hostname = hostWithPort
        .slice(1, closingBracketIndex)
        .replace(URL_HOSTNAME_DOT_SEPARATOR_REGEXP, '.');
      const suffix = hostWithPort.slice(closingBracketIndex + 1);
      return `${urlPrefix}${authPrefix}[${hostname}]${suffix}${rest}`;
    }
  }

  const portStartIndex = hostWithPort.indexOf(':');
  const hostname =
    portStartIndex >= 0 ? hostWithPort.slice(0, portStartIndex) : hostWithPort;
  const suffix = portStartIndex >= 0 ? hostWithPort.slice(portStartIndex) : '';
  return `${urlPrefix}${authPrefix}${hostname.replace(
    URL_HOSTNAME_DOT_SEPARATOR_REGEXP,
    '.',
  )}${suffix}${rest}`;
}

function normalizeLocalhostUrlSeparators(url: string) {
  const result = isLocalhostUrl(url)
    ? normalizeUrlHostnameSeparators(url)
    : url;
  return result;
}

function getHostnameFromUrlLikeText(text: string): string {
  const normalizedText = text.replace(URL_HOSTNAME_DOT_SEPARATOR_REGEXP, '.');
  const protocolMatch = normalizedText.match(URL_PROTOCOL_PREFIX_REGEXP);
  const hostAndPath = protocolMatch
    ? normalizedText.slice(protocolMatch[0].length)
    : normalizedText;
  const hostWithPortAndAuth = hostAndPath.split(/[/?#]/u)[0] ?? '';
  const hostWithPort = hostWithPortAndAuth.split('@').pop() ?? '';

  if (hostWithPort.startsWith('[')) {
    const closingBracketIndex = hostWithPort.indexOf(']');
    return closingBracketIndex > 0
      ? hostWithPort.slice(1, closingBracketIndex).toLowerCase()
      : '';
  }

  return hostWithPort.split(':')[0].toLowerCase();
}

export function isLocalhostUrl(url: string): boolean {
  const text = url.trim();
  if (!text) return false;

  const hostname = getHostnameFromUrlLikeText(text);
  const result = LOCALHOST_URL_HOSTNAMES.has(hostname);
  return result;
}

export function isIpAddressUrl(url: string): boolean {
  const text = url.trim();
  if (!text) return false;

  const hostname = getHostnameFromUrlLikeText(text);
  const result = Boolean(hostname && validator.isIP(hostname));
  return result;
}

function normalizeHttpLocalhostUrl(url: string): string | null {
  const text = url.trim();
  if (!isLocalhostUrl(text)) {
    return null;
  }

  const normalizedUrl = ensureHttpPrefix(text);
  const parsedUrl = safeParseURL(normalizedUrl);
  if (parsedUrl?.protocol === 'http:' && isLocalhostParsedUrl(parsedUrl)) {
    return normalizedUrl;
  }
  return null;
}

export function isUrlWithoutProtocol(text: string): boolean {
  return URL_WITHOUT_PROTOCOL_REGEXP.test(text);
}

export function ensureHttpsPrefix(url: string): string {
  if (!url) return url;
  // Already has protocol
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  // Looks like a URL without protocol, add https://
  if (isUrlWithoutProtocol(url)) {
    return `https://${url}`;
  }
  return url;
}

export function ensureHttpPrefix(url: string): string {
  if (!url) return url;
  const normalizedLocalhostUrl = normalizeLocalhostUrlSeparators(url);
  if (
    (isLocalhostUrl(normalizedLocalhostUrl) ||
      isIpAddressUrl(normalizedLocalhostUrl)) &&
    !URL_PROTOCOL_PREFIX_REGEXP.test(normalizedLocalhostUrl)
  ) {
    const result = `http://${normalizedLocalhostUrl}`;
    return result;
  }
  if (URL_SCHEME_REGEXP.test(normalizedLocalhostUrl)) {
    return normalizedLocalhostUrl;
  }
  const result = `http://${url}`;
  return result;
}

export function buildGoogleSearchUrl(keyword: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
}

function getHostNameFromUrl({ url }: { url: string }): string {
  try {
    const urlInfo = new URL(url);
    const { hostname } = urlInfo;
    return hostname || '';
  } catch (error) {
    console.error(error);
  }
  return '';
}

function getOriginFromUrl({ url }: { url: string }): string {
  if (url === 'null') {
    return url;
  }
  try {
    const urlInfo = new URL(url);
    const { origin } = urlInfo;
    return origin || '';
  } catch (error) {
    console.error(error);
  }
  return '';
}

function safeParseURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch (_e) {
    return null;
  }
}

export function appendUtmSourceToUrl({
  url,
  utmSource,
}: {
  url: string;
  utmSource: string;
}) {
  const parsedUrl = safeParseURL(url);
  if (!parsedUrl) {
    return url;
  }
  parsedUrl.searchParams.set('utm_source', utmSource);
  return parsedUrl.toString();
}

function isProtocolSupportedOpenInApp(dappUrl: string) {
  return PROTOCOLS_SUPPORTED_TO_OPEN.some((protocol) =>
    dappUrl.toLowerCase().startsWith(protocol.toLowerCase()),
  );
}

enum EDAppOpenActionEnum {
  ALLOW = 'allow',
  DENY = 'deny',
}

function parseDappRedirect(
  url: string,
  allowedUrls: string[],
  options?: ILocalhostUrlOptions & { isTopFrame?: boolean },
): { action: EDAppOpenActionEnum } {
  // allow iframe ad
  const isTopFrame = options?.isTopFrame ?? true;
  const protocolMatch = url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/);
  const protocol = protocolMatch ? protocolMatch[0].toLowerCase() : '';
  if (isTopFrame === false && protocol === 'data:') {
    return { action: EDAppOpenActionEnum.ALLOW };
  }

  // eslint-disable-next-line no-script-url
  if (protocol === 'javascript:') {
    return { action: EDAppOpenActionEnum.DENY };
  }

  const parsedUrl = safeParseURL(url);
  const isHttpLocalhostUrl = Boolean(
    parsedUrl &&
    ['http:', 'https:'].includes(parsedUrl.protocol) &&
    isLocalhostParsedUrl(parsedUrl),
  );
  if (isHttpLocalhostUrl && !options?.allowLocalhostUrl) {
    return { action: EDAppOpenActionEnum.DENY };
  }
  if (isHttpLocalhostUrl && options?.allowLocalhostUrl && parsedUrl) {
    return { action: EDAppOpenActionEnum.ALLOW };
  }
  const isHttpPublicIpUrl =
    parsedUrl?.protocol === 'http:' &&
    isIpAddressParsedUrl(parsedUrl) &&
    !isLocalhostParsedUrl(parsedUrl);
  if (isHttpPublicIpUrl) {
    return { action: EDAppOpenActionEnum.ALLOW };
  }
  if (
    !parsedUrl ||
    (!isProtocolSupportedOpenInApp(parsedUrl.toString()) &&
      !allowedUrls.includes(parsedUrl.origin))
  ) {
    return { action: EDAppOpenActionEnum.DENY };
  }
  return { action: EDAppOpenActionEnum.ALLOW };
}

export function checkOneKeyCardGoogleOauthUrl({
  url,
}: {
  url: string;
}): boolean {
  const origin = getOriginFromUrl({ url });
  return [
    'https://card.onekey.so',
    'https://card.onekeytest.com',
    'https://precard-762def0c-eacd-49b3-ad89-0bf807b37f57.onekeycn.com',
    'https://accounts.google.com',
  ].includes(origin);
}

export function needEraseElectronFeatureUrl({ url }: { url: string }): boolean {
  const origin = getOriginFromUrl({ url });
  return ['https://remix.ethereum.org'].includes(origin);
}

export function parseUrl(url: string): IUrlValue | null {
  try {
    let formatUrl = url;
    if (url.includes('&')) {
      const parts = url.split('&');
      if (!parts?.[0].includes('?')) {
        formatUrl = `${parts[0]}?${parts
          .slice(1)
          .join('&')
          .replace(/\?/, '&')}`;
      }
    }
    const urlObject = new URL(formatUrl);
    let { hostname, pathname } = urlObject;
    let { origin } = urlObject;
    // Normalize for non-standard protocols where hostname may be empty.
    // Hermes URL parser returns hostname='' and pathname='//host/path'
    // for custom schemes like onekey-wallet://host/path, whereas V8
    // correctly parses hostname='host' and pathname='/path'.
    if (!hostname && pathname.startsWith('//')) {
      const pathWithoutPrefix = pathname.slice(2);
      const slashIndex = pathWithoutPrefix.indexOf('/');
      if (slashIndex >= 0) {
        hostname = pathWithoutPrefix.slice(0, slashIndex);
        pathname = pathWithoutPrefix.slice(slashIndex);
      } else {
        hostname = pathWithoutPrefix;
        pathname = '/';
      }
    }
    // Normalize origin for non-http schemes. V8 returns the string 'null'
    // for opaque origins, Hermes may return the scheme + authority.
    if (origin && !origin.startsWith('http') && origin !== 'null') {
      origin = 'null';
    }
    return {
      url,
      hostname,
      origin,
      pathname,
      urlSchema: urlObject.protocol.replace(/(:)$/, ''),
      urlPathList: `${hostname}${pathname}`
        .replace(/^\/\//, '')
        .split('/')
        .filter((x) => x?.length > 0),
      urlParamList: Array.from(urlObject.searchParams.entries()).reduce<{
        [key: string]: any;
      }>((paramList, [paramKey, paramValue]) => {
        if (paramKey in paramList) {
          if (!Array.isArray(paramList[paramKey])) {
            paramList[paramKey] = [paramList[paramKey]];
          }
          (paramList[paramKey] as Array<any>).push(paramValue);
        } else {
          paramList[paramKey] = paramValue;
        }
        return paramList;
      }, {}),
    };
  } catch (_e) {
    return null;
  }
}

export const checkIsDomain = (domain: string) => DOMAIN_REGEXP.test(domain);

// oxlint-disable-next-line @cspell/spellchecker
// check the ens format 元宇宙.bnb / diamondgs198.x
export const addressIsEnsFormat = (address: string) => {
  const parts = address.split('.');
  return parts.length > 1 && parts.every((o) => Boolean(o) && o === o.trim());
};

export function isValidDeepLink(url: string) {
  return VALID_DEEP_LINK.some((protocol) =>
    url.toLowerCase().startsWith(`${protocol.toLowerCase()}//`),
  );
}

export const validateUrl = (
  url: string,
  options?: ILocalhostUrlOptions,
): string => {
  if (options?.allowLocalhostUrl) {
    const localhostUrl = normalizeHttpLocalhostUrl(url);
    if (localhostUrl) {
      return localhostUrl;
    }
  }

  // Extract host/path part from URL if it has a protocol
  let urlWithoutProtocol = url;
  if (url.includes('://')) {
    try {
      const parsedUrl = new URL(url);
      // Normalize pathname: strip root-only "/" so the reconstructed URL
      // doesn't contain a bare slash after host.
      let pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname;
      // Hermes URL parser may append a trailing "/" that V8 does not.
      // Only strip on native to avoid changing semantics on web/desktop
      // where trailing slashes can be meaningful (e.g. directory URLs).
      if (
        platformEnv.isNative &&
        pathname.length > 1 &&
        pathname.endsWith('/')
      ) {
        pathname = pathname.slice(0, -1);
      }
      urlWithoutProtocol =
        parsedUrl.host + pathname + parsedUrl.search + parsedUrl.hash;
    } catch {
      // If URL parsing fails, use the original URL
    }
  }

  const originalParsedUrl = safeParseURL(url);
  const isPublicIpAddress =
    isIpAddressUrl(urlWithoutProtocol) && !isLocalhostUrl(urlWithoutProtocol);
  if (isPublicIpAddress && originalParsedUrl?.protocol !== 'https:') {
    const httpUrl = `http://${urlWithoutProtocol}`;
    if (validator.isURL(httpUrl, { protocols: ['http'] })) {
      return httpUrl;
    }
  }

  // Try to validate with HTTPS protocol
  const httpsUrl = `https://${urlWithoutProtocol}`;
  if (validator.isURL(httpsUrl, { protocols: ['https'] })) {
    return httpsUrl;
  }

  // If still not valid, return Google search URL
  const searchUrl = buildGoogleSearchUrl(url);
  return searchUrl;
};

export const containsPunycode = (url: string) => {
  const validatedUrl = validateUrl(url);
  if (!validatedUrl) return false;
  const { hostname } = new URL(validatedUrl);
  // V8 normalizes IDN to punycode (xn--), Hermes may keep unicode.
  // Compare both directions to detect non-ASCII hostnames on either engine.
  return hostname !== toUnicode(hostname) || hostname !== toASCII(hostname);
};

function buildUrl({
  protocol = '',
  hostname = '',
  path = '',
  query = {},
}: {
  protocol?: string;
  hostname?: string;
  path?: string;
  // URLSearchParams coerces `undefined` to the string "undefined"; filter those out.
  query?: Record<string, string | number | boolean | null | undefined>;
}) {
  // eslint-disable-next-line no-param-reassign
  protocol = protocol.replace(/:+$/, '');
  // eslint-disable-next-line no-param-reassign
  protocol = protocol.replace(/^\/+/, '');
  // eslint-disable-next-line no-param-reassign
  protocol = protocol.replace(/\/+$/, '');

  // eslint-disable-next-line no-param-reassign
  hostname = hostname.replace(/^\/+/, '');
  // eslint-disable-next-line no-param-reassign
  hostname = hostname.replace(/\/+$/, '');

  // eslint-disable-next-line no-param-reassign
  path = path.replace(/^\/+/, '');
  // eslint-disable-next-line no-param-reassign
  path = path.replace(/\/+$/, '');

  let search = '';
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      params.set(key, String(value));
    });
    search = params.toString();
  }

  if (path && !protocol && !hostname) {
    return `/${path}${search ? `?${search}` : ''}`;
  }
  const url = new URL(
    `${protocol}://${[hostname, path].filter(Boolean).join('/')}`,
  );
  if (search) {
    url.search = search;
  }
  return url.toString();
}

function buildDeepLinkUrl<T extends EOneKeyDeepLinkPath>({
  path,
  query,
}: {
  path: T;
  query?: IEOneKeyDeepLinkParams[T];
}) {
  return buildUrl({
    protocol: ONEKEY_APP_DEEP_LINK_NAME,
    path,
    query,
  });
}

const NameToUrlMapForInvalidDapp: Record<string, string> = {
  'Algorand Governance--Governance platform for Algorand':
    'https://governance.algorand.foundation',
};
function safeGetWalletConnectOrigin(proposal: WalletKitTypes.SessionProposal) {
  try {
    const { origin } = new URL(proposal.params.proposer.metadata.url);
    return origin;
  } catch (_err) {
    try {
      const key = `${proposal.params.proposer.metadata.name}--${proposal.params.proposer.metadata.description}`;
      const nameToUrl = NameToUrlMapForInvalidDapp[key];
      if (nameToUrl) {
        const { origin } = new URL(nameToUrl);
        return origin;
      }
    } catch {
      return null;
    }
    return null;
  }
}

export default {
  getOriginFromUrl,
  getHostNameFromUrl,
  parseDappRedirect,
  isValidDeepLink,
  EDAppOpenActionEnum,
  validateUrl,
  containsPunycode,
  buildUrl,
  buildDeepLinkUrl,
  safeGetWalletConnectOrigin,
  parseUrl,
  isLocalhostUrl,
  isIpAddressUrl,
  safeParseURL,
  appendUtmSourceToUrl,
  isUrlWithoutProtocol,
  ensureHttpsPrefix,
  ensureHttpPrefix,
  buildGoogleSearchUrl,
};
