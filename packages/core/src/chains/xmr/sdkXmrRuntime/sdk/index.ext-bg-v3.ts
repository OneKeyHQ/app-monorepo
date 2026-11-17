import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { createXmrRuntimeProxy } from './proxy';

import type { IXmrRuntimeApi } from '..';

// Extension MV3: the background service worker forwards to the offscreen
// document, which hosts the shared Worker. Monero's single-threaded runtime
// does not need COOP/COEP.
const api = createXmrRuntimeProxy(
  () => appGlobals.$offscreenApiProxy.xmrRuntime,
);

export async function getXmrRuntimeApiForCarrier(): Promise<IXmrRuntimeApi> {
  return api;
}
