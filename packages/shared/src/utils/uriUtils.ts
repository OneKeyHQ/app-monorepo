import punycode from 'punycode';

import validator from 'validator';

import type { IUrlValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';

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
  options?: { isTopFrame?: boolean },
): { action: EDAppOpenActionEnum } {
  // allow iframe ad
  const isTopFrame = options?.isTopFrame ?? true;
  const protocolMatch = url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/);
  const protocol = protocolMatch ? protocolMatch[0].toLowerCase() : '';
  if (isTopFrame === false && protocol === 'data:') {
    return { action: EDAppOpenActionEnum.ALLOW };
  }

  const parsedUrl = safeParseURL(url);
  if (process.env.NODE_ENV !== 'production') {
    if (
      parsedUrl?.hostname &&
      ['localhost', '127.0.0.1'].includes(parsedUrl?.hostname)
    ) {
      return { action: EDAppOpenActionEnum.ALLOW };
    }
  }
  if (
    !parsedUrl ||
    (!isProtocolSupportedOpenInApp(parsedUrl.toString()) &&
      !allowedUrls.includes(parsedUrl.origin))
  ) {
    console.log('====>>>>>>>reject navigate: ', url);
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

export const validateUrl = (url: string): string => {
  // In development mode, allow HTTP localhost URLs
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsedUrl = new URL(url);
      if (
        parsedUrl.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)
      ) {
        return url;
      }
    } catch {
      // Continue with normal validation
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

  // Try to validate with HTTPS protocol
  const httpsUrl = `https://${urlWithoutProtocol}`;
  if (validator.isURL(httpsUrl, { protocols: ['https'] })) {
    return httpsUrl;
  }

  // If still not valid, return Google search URL
  return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
};

export const containsPunycode = (url: string) => {
  const validatedUrl = validateUrl(url);
  if (!validatedUrl) return false;
  const { hostname } = new URL(validatedUrl);
  // V8 normalizes IDN to punycode (xn--), Hermes may keep unicode.
  // Compare both directions to detect non-ASCII hostnames on either engine.
  return (
    hostname !== punycode.toUnicode(hostname) ||
    hostname !== punycode.toASCII(hostname)
  );
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
  safeParseURL,
  appendUtmSourceToUrl,
  isUrlWithoutProtocol,
  ensureHttpsPrefix,
};
