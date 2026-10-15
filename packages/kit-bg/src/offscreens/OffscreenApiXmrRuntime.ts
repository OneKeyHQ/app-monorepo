import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { createXmrRuntimeProxy } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/proxy';
import { workerApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/workerClient';

// The offscreen document hosts the shared Worker transport, not wallet logic.
// The extension's MV3 background cannot keep wasm and OPFS handles alive; the
// offscreen document can, and the Worker inside it owns both.
class OffscreenApiXmrRuntime {
  constructor() {
    Object.assign(
      this,
      createXmrRuntimeProxy(() => workerApi),
    );
  }
}

// The proxy attaches the contract's methods at construction time. Export the
// constructor with that instance type rather than relying on declaration
// merging, which cannot verify runtime initialization.
export default OffscreenApiXmrRuntime as unknown as new () => IXmrRuntimeApi;
