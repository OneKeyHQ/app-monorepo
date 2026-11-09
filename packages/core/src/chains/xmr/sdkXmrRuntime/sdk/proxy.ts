import { createPrivacyChainRemoteProxy } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

import { XMR_RUNTIME_METHODS } from '../methods';

import type { IXmrRuntimeApi } from '..';

// Must not import anything that constructs a Worker: the MV3 background
// imports this module, and pulling in the Worker factory breaks the build.
export function createXmrRuntimeProxy(
  getTarget: () => IXmrRuntimeApi | Promise<IXmrRuntimeApi>,
): IXmrRuntimeApi {
  return createPrivacyChainRemoteProxy(XMR_RUNTIME_METHODS, getTarget);
}
