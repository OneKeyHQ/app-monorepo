import { workerApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/sdk/workerClient';
import type { IZcashSdkApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

class OffscreenApiZcashSdk {
  constructor() {
    Object.assign(this, workerApi);
  }
}

export default OffscreenApiZcashSdk as unknown as new () => IZcashSdkApi;
