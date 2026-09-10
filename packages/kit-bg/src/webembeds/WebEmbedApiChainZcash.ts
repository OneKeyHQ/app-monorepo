import { createZcashSdkProxy } from '@onekeyhq/core/src/chains/zcash/sdkZcash/sdk/createSdkProxy';
import { workerApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/sdk/workerClient';
import type { IZcashSdkApi } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

// WebEmbed owns the transport; the same Worker as web/desktop owns the wallet.
class WebEmbedApiChainZcash {
  constructor() {
    Object.assign(
      this,
      createZcashSdkProxy(() => workerApi),
    );
  }
}

export default WebEmbedApiChainZcash as unknown as new () => IZcashSdkApi;
