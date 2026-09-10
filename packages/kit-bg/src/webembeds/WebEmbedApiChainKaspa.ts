import kaspaWebSdk from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk/kaspaWebSdk';
import type { IKaspaSdkApi } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types/sdk';

class WebEmbedApiChainKaspa implements IKaspaSdkApi {
  /**
   * Warm the lazy Kaspa WebAssembly module before the page advertises that
   * the Web Embed API is ready. Native WebViews may recycle their host while
   * a large dynamic chunk is still loading; keeping readiness behind this
   * promise prevents the first background call from losing that load.
   */
  async preload(): Promise<void> {
    await kaspaWebSdk.getKaspaApi();
  }

  async createKRC20RevealTxJSON(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.createKRC20RevealTxJSON(...args);
  }

  async buildCommitTxInfo(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.buildCommitTxInfo(...args);
  }

  async signRevealTransactionSoftware(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.signRevealTransactionSoftware(...args);
  }

  async signRevealTransactionHardware(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.signRevealTransactionHardware(...args);
  }

  async buildUnsignedTxForHardware(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.buildUnsignedTxForHardware(...args);
  }

  async deserializeFromSafeJSON(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.deserializeFromSafeJSON(...args);
  }
}

export default WebEmbedApiChainKaspa;
