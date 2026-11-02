import { createZcashSdkProxy } from '@onekeyhq/core/src/chains/zcash/sdkZcash/sdk/createSdkProxy';
import { workerApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/sdk/workerClient';
import type { IZcashSdkApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

class WebEmbedApiChainZcash {
  constructor() {
    Object.assign(
      this,
      createZcashSdkProxy(() => workerApi),
    );
  }
}

export default WebEmbedApiChainZcash as unknown as new () => IZcashSdkApi;
