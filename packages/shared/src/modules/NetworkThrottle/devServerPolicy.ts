export function getNetworkThrottleDevServerOrigin(
  scriptURL: unknown,
): string | undefined {
  if (typeof scriptURL !== 'string' || !scriptURL) {
    return undefined;
  }

  try {
    const url = new URL(scriptURL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}
