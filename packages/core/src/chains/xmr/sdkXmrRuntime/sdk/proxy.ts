import { createPrivacyChainRemoteProxy } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

import { XMR_RUNTIME_METHODS } from '../methods';

import type { IXmrRuntimeApi } from '..';

// Forwards every call to `getTarget()`. Used on both sides of a carrier
// boundary: the background forwards to the offscreen document or the web-embed
// WebView, which forwards to the Worker.
//
// Deliberately imports nothing that constructs a Worker. The extension's MV3
// background imports this module, and a service worker cannot create one --
// pulling the Worker factory in here crashes the extension build outright.
export function createXmrRuntimeProxy(
  getTarget: () => IXmrRuntimeApi | Promise<IXmrRuntimeApi>,
): IXmrRuntimeApi {
  return createPrivacyChainRemoteProxy(XMR_RUNTIME_METHODS, getTarget);
}
