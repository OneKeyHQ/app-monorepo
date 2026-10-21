import { createZcashSdkProxy } from '@onekeyhq/core/src/chains/zcash/sdkZcash/sdk/createSdkProxy';
import { workerApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/sdk/workerClient';
import type { IZcashSdkApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

// The offscreen document hosts the shared Worker transport, not wallet logic.
class OffscreenApiZcashSdk {
  constructor() {
    Object.assign(
      this,
      createZcashSdkProxy(() => workerApi),
    );
  }
}

// The proxy attaches the contract's methods at construction time.
export default OffscreenApiZcashSdk as unknown as new () => IZcashSdkApi;
