import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { createXmrRuntimeProxy } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/proxy';
import { workerApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/workerClient';

// The offscreen document hosts the shared Worker transport, not wallet logic:
// the MV3 background cannot keep wasm and OPFS handles alive; the Worker can.
class OffscreenApiXmrRuntime {
  constructor() {
    Object.assign(
      this,
      createXmrRuntimeProxy(() => workerApi),
    );
  }
}

// The proxy attaches the contract's methods at construction time.
export default OffscreenApiXmrRuntime as unknown as new () => IXmrRuntimeApi;
