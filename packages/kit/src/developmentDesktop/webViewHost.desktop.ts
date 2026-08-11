import { stampCustomInjectionRequestContext } from '@onekeyhq/kit/src/components/WebView/customInjectionRequestContext';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export function getDevelopmentDesktopWebViewBridgeContext(props: {
  desktopPreloadUrl?: string;
}): boolean {
  return Boolean(props.desktopPreloadUrl);
}

export function prepareDevelopmentDesktopWebViewBridgePayload(
  context: unknown,
  payload: IJsBridgeMessagePayload,
): IJsBridgeMessagePayload {
  return stampCustomInjectionRequestContext(payload, context === true);
}
