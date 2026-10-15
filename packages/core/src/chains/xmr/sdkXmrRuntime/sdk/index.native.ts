import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

import { createXmrRuntimeProxy } from './proxy';

import type { IXmrRuntimeApi } from '..';

// iOS and Android: the background is Hermes and cannot run wasm at all, so
// calls go to the web-embed WebView, which hosts the same Worker as every
// other carrier.
//
// The runtime is single-threaded, so unlike Zcash this does not need
// cross-origin isolation -- which Android's system WebView structurally
// cannot provide.
const api = createXmrRuntimeProxy(
  () => ensureWebembedApiProxyAvailable().chainXmr,
);

export async function getXmrRuntimeApiForCarrier(): Promise<IXmrRuntimeApi> {
  return api;
}
