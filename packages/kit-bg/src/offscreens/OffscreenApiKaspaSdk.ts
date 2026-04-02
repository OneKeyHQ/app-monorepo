import kaspaWebSdk from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk/kaspaWebSdk';
import type { IKaspaSdkApi } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types/sdk';

export default class OffscreenApiKaspaSdk implements IKaspaSdkApi {
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
