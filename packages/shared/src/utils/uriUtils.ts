import punycode from 'punycode';

import type { IUrlValue } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';

import { ONEKEY_APP_DEEP_LINK_NAME } from '../consts/deeplinkConsts';
import {
  PROTOCOLS_SUPPORTED_TO_OPEN,
  VALID_DEEP_LINK,
} from '../consts/urlProtocolConsts';

import type {
  EOneKeyDeepLinkPath,
  IEOneKeyDeepLinkParams,
} from '../consts/deeplinkConsts';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

const DOMAIN_REGEXP =
  /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;

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
  } catch (e) {
    return null;
  }
}

function isProtocolSupportedOpenInApp(dappUrl: string) {
  return PROTOCOLS_SUPPORTED_TO_OPEN.some((protocol) =>
    dappUrl.toLowerCase().startsWith(`${protocol.toLowerCase()}`),
  );
}

enum EDAppOpenActionEnum {
  ALLOW = 'allow',
  DENY = 'deny',
}

function parseDappRedirect(
  url: string,
  allowedUrls: string[],
): { action: EDAppOpenActionEnum } {
  const parsedUrl = safeParseURL(url);
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
    return {
      url,
      hostname: urlObject.hostname,
      origin: urlObject.origin,
      pathname: urlObject.pathname,
      urlSchema: urlObject.protocol.replace(/(:)$/, ''),
      urlPathList: `${urlObject.hostname}${urlObject.pathname}`
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
  } catch (e) {
    return null;
  }
}

export const checkIsDomain = (domain: string) => DOMAIN_REGEXP.test(domain);

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

export const isValidWebUrl = (url: string) =>
  /^[^/\s]+\.(?:ai|app|art|co|com|club|dev|ee|fi|finance|game|im|info|io|is|it|net|network|news|org|so|xyz)(?:\/[^/\s]*)*$/.test(
    url,
  );

export const validateUrl = (url: string): string => {
  let validatedUrl;
  try {
    validatedUrl = new URL(url);
  } catch (e) {
    if (isValidWebUrl(url)) {
      return `https://${url}`;
    }
    return `https://www.google.com/search?q=${url}`;
  }

  return validatedUrl?.href ?? url;
};

export const containsPunycode = (url: string) => {
  const validatedUrl = validateUrl(url);
  if (!validatedUrl) return false;
  const { hostname } = new URL(validatedUrl);
  const unicodeHostname = punycode.toUnicode(hostname);
  return hostname !== unicodeHostname;
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
  query?: Record<string, string>;
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

  const url = new URL(
    `${protocol}://${[hostname, path].filter(Boolean).join('/')}`,
  );
  if (query) {
    url.search = new URLSearchParams(query).toString();
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
function safeGetWalletConnectOrigin(proposal: Web3WalletTypes.SessionProposal) {
  try {
    const { origin } = new URL(proposal.params.proposer.metadata.url);
    return origin;
  } catch (err) {
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
};
