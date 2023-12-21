import { PROTOCOLS_SUPPORTED_TO_OPEN } from '../consts/urlProtocolConsts';

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

function parseDappRedirect(url: string): { action: EDAppOpenActionEnum } {
  const parsedUrl = safeParseURL(url);
  if (!parsedUrl || !isProtocolSupportedOpenInApp(parsedUrl.toString())) {
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

export default {
  getOriginFromUrl,
  getHostNameFromUrl,
  parseDappRedirect,
  EDAppOpenActionEnum,
};
