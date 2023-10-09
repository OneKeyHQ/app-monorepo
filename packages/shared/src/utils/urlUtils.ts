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

const PROTOCOLS_SUPPORTED_TO_OPEN = [
  'http:' as const,
  'https:' as const,
  'ipfs:' as const,
  'localfs:' as const,
  // 'file:' as const,
];

function isProtocolSupportedOpenInApp(dappUrl: string) {
  return PROTOCOLS_SUPPORTED_TO_OPEN.some((protocol) =>
    dappUrl.startsWith(`${protocol}//`),
  );
}

enum DAppOpenActionEnum {
  ALLOW = 'allow',
  DENY = 'deny',
}

function parseDappRedirect(url: string): { action: DAppOpenActionEnum } {
  const parsedUrl = safeParseURL(url);
  if (!parsedUrl || !isProtocolSupportedOpenInApp(parsedUrl.toString())) {
    return { action: DAppOpenActionEnum.DENY };
  }

  return { action: DAppOpenActionEnum.ALLOW };
}

export default {
  getHostNameFromUrl,
  parseDappRedirect,
  DAppOpenActionEnum,
};
