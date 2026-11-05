import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { workerApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/workerClient';

// The MV3 background cannot keep wasm and OPFS handles alive; the offscreen Worker can.
class OffscreenApiXmrRuntime {
  constructor() {
    Object.assign(this, workerApi);
  }
}

export default OffscreenApiXmrRuntime as unknown as new () => IXmrRuntimeApi;
