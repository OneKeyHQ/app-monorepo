// import { openURL as LinkingOpenURL } from 'expo-linking';

import { PROTOCOLS_SUPPORTED_TO_OPEN } from '../consts/urlProtocolConsts';
// import platformEnv from '../platformEnv';

import type { IServerNetwork } from '../../types';

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
    dappUrl.toLowerCase().startsWith(`${protocol.toLowerCase()}//`),
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

export function parseUrl(url: string) {
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
      urlSchema: urlObject.protocol.replace(/(:)$/, ''),
      urlPathList: `${urlObject.hostname}${urlObject.pathname}`
        .replace(/^\/\//, '')
        .split('/')
        .filter((x) => x?.length > 0),
      urlParamList: Array.from(urlObject.searchParams.entries()).reduce<{
        [key: string]: any;
      }>((paramList, [paramKey, paramValue]) => {
        paramList[paramKey] = paramValue;
        return paramList;
      }, {}),
    };
  } catch (e) {
    return null;
  }
}

export const checkIsDomain = (domain: string) => DOMAIN_REGEXP.test(domain);

export function buildExplorerAddressUrl({
  network,
  address,
}: {
  network: IServerNetwork | undefined;
  address: string | undefined;
}) {
  if (!network || !address) return '';

  const addressUrl = network.explorers[0]?.address;

  if (!addressUrl) return '';

  return addressUrl.replace('{address}', address);
}

export default {
  getOriginFromUrl,
  getHostNameFromUrl,
  parseDappRedirect,
  EDAppOpenActionEnum,
};
