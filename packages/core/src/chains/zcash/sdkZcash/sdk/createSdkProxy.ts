import { createPrivacyChainRemoteProxy } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

import { ZCASH_SDK_METHODS } from '../types/methods';

import type { IZcashSdkApi } from '../types/sdk';

// Builds an IZcashSdkApi that forwards every call to `getTarget()`.
//
// Deliberately imports nothing that constructs a Worker. The extension's MV3
// background imports this module, and a service worker cannot create one --
// pulling the Worker factory in here crashes the extension build outright.
export function createZcashSdkProxy(
  getTarget: () => IZcashSdkApi | Promise<IZcashSdkApi>,
): IZcashSdkApi {
  return createPrivacyChainRemoteProxy(ZCASH_SDK_METHODS, getTarget);
}
