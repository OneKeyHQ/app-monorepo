import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export function getDevelopmentDesktopWebViewBridgeContext(_props: unknown): undefined {
  return undefined;
}

export function prepareDevelopmentDesktopWebViewBridgePayload(
  _context: unknown,
  payload: IJsBridgeMessagePayload,
): IJsBridgeMessagePayload {
  return payload;
}
