import platformEnv from '../../platformEnv';

export enum RequestLibNames {
  axios = 'axios',
  fetch = 'fetch',
  superagent = 'superagent',
}

// TODO baseURL support like https://github.com/zurfyx/fetch-absolute/blob/master/index.js
function isOneKeyUrl({ url }: { url: string }) {
  const hosts = [
    'onekey.so',
    'onekeycn.com',
    'onekeytest.com',
    // 'onekey-asset.com',
  ];
  for (const host of hosts) {
    if (url.includes(host)) {
      return true;
    }
  }
  return false;
}

export abstract class RequestInterceptorBase {
  abstract setHeader(key: string, val: string): void;

  abstract setDefaultTimeout(ms: number): void;

  abstract setDefaultRetry(count: number): void;

  abstract requestLibName: RequestLibNames;

  interceptRequest({ url }: { url: string }) {
    if (url && isOneKeyUrl({ url })) {
      this.setHeader(
        'X-Request-By',
        JSON.stringify({
          agent: `OneKey/${this.requestLibName}`,
          isNativeIOS: platformEnv.isNativeIOS,
          isNativeAndroid: platformEnv.isNativeAndroid,
          isDesktop: platformEnv.isDesktop,
          isExtChrome: platformEnv.isExtChrome,
          isExtFirefox: platformEnv.isExtFirefox,
          version: platformEnv.version,
          buildNumber: platformEnv.buildNumber,
        }),
      );
    }

    this.setDefaultTimeout(60 * 1000);
    this.setDefaultRetry(0);
  }
}
