import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { createXmrRuntimeProxy } from './proxy';

import type { IXmrRuntimeApi } from '..';

// Extension MV3: the background service worker forwards to the offscreen
// document, which creates the same dedicated Worker every other carrier uses.
//
// No COOP/COEP is needed for Monero's sake -- the runtime is single-threaded
// and never touches `crossOriginIsolated`. Check the other dependents before
// removing those manifest keys.
const api = createXmrRuntimeProxy(
  () => appGlobals.$offscreenApiProxy.xmrRuntime,
);

export async function getXmrRuntimeApiForCarrier(): Promise<IXmrRuntimeApi> {
  return api;
}
