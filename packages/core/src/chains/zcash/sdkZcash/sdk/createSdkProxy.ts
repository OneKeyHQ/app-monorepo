import { ZCASH_SDK_METHODS } from '../types/methods';

import type { IZcashSdkApi } from '../types/sdk';

// Builds an IZcashSdkApi that forwards every call to `getTarget()`.
//
// Used on both sides of a carrier boundary:
//
//   bg side       -> target is the remote proxy (offscreen / web-embed)
//   receiving side -> target is the real implementation
//
// The target is resolved per call rather than captured once: the offscreen
// document and the web-embed WebView are created lazily and can be torn down
// and recreated, so a handle captured at module load would go stale.
export function createZcashSdkProxy(
  getTarget: () => IZcashSdkApi | Promise<IZcashSdkApi>,
): IZcashSdkApi {
  const api = {} as Record<string, unknown>;
  for (const method of ZCASH_SDK_METHODS) {
    api[method] = async (...args: unknown[]) => {
      const target = await getTarget();
      return (target[method] as (...a: unknown[]) => unknown)(...args);
    };
  }
  return api as IZcashSdkApi;
}
