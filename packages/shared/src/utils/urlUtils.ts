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

enum DAppOpenActionEnum {
  ALLOW = 'allow',
  DENY = 'deny',
}

function parseDappRedirect(url: string): { action: DAppOpenActionEnum } {
  const parsedUrl = safeParseURL(url);
  if (!parsedUrl || !isProtocolSupportedOpenInApp(parsedUrl.toString())) {
    console.log('====>>>>>>>reject deney: ', url);
    return { action: DAppOpenActionEnum.DENY };
  }

  return { action: DAppOpenActionEnum.ALLOW };
}

export default {
  getHostNameFromUrl,
  parseDappRedirect,
  DAppOpenActionEnum,
};
