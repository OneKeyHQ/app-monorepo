import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

import { createXmrRuntimeProxy } from './proxy';

import type { IXmrRuntimeApi } from '..';

// iOS and Android: the Hermes background cannot run wasm, so calls go to the
// web-embed WebView, which hosts the shared Worker. The single-threaded
// runtime needs no cross-origin isolation.
const api = createXmrRuntimeProxy(
  () => ensureWebembedApiProxyAvailable().chainXmr,
);

export async function getXmrRuntimeApiForCarrier(): Promise<IXmrRuntimeApi> {
  return api;
}
