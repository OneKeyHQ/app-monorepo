import kaspaWebSdk from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk/kaspaWebSdk';
import type { IKaspaSdkApi } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types/sdk';

class WebEmbedApiChainKaspa implements IKaspaSdkApi {
  async signPayloadTransactionSoftware(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.signPayloadTransactionSoftware(...args);
  }

  async signPayloadTransactionHardware(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.signPayloadTransactionHardware(...args);
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

  async submitPayloadTransactionViaRpc(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.submitPayloadTransactionViaRpc(...args);
  }
}

export default WebEmbedApiChainKaspa;
