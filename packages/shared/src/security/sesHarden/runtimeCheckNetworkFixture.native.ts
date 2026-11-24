import { NativeModules } from 'react-native';

import type { ISesNetworkFixture } from './runtimeCheckNetworkFixture';

export function getSesNetworkFixture(): ISesNetworkFixture | undefined {
  if (!__DEV__) return undefined;
  const g = globalThis as typeof globalThis & {
    __ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__?: string;
  };
  const sourceCode = NativeModules.SourceCode as
    | {
        getConstants?: () => { scriptURL?: string };
      }
    | undefined;
  const bundleUrl =
    g.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__ ??
    sourceCode?.getConstants?.().scriptURL;
  if (!bundleUrl) return undefined;
  try {
    const url = new URL(bundleUrl);
    const sessionId = url.searchParams.get('resolver.devSessionId');
    if (!sessionId || !['http:', 'https:'].includes(url.protocol))
      return undefined;
    return {
      baseUrl: `${url.origin}/onekey-dev-session/ses-runtime-check`,
      sessionId,
    };
  } catch {
    return undefined;
  }
}
