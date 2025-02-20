import kaspaWebSdk from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk/kaspaWebSdk';
import type { IKaspaSdkApi } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types/sdk';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export default class OffscreenApiKaspaSdk implements IKaspaSdkApi {
  async sayHello() {
    await timerUtils.wait(3000);
    return 'Hello World: OffscreenApiKaspaSdk';
  }

  async addressFromScriptPublicKey(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.addressFromScriptPublicKey(...args);
  }

  async createTransaction(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.createTransaction(...args);
  }

  async createTransactions(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.createTransactions(...args);
  }

  async calculateTransactionFee(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.calculateTransactionFee(...args);
  }

  async calculateTransactionMass(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.calculateTransactionMass(...args);
  }

  async kaspaToSompi(...args: any[]) {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.kaspaToSompi(...args);
  }

  async ScriptBuilder() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.ScriptBuilder();
  }

  async Opcodes() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.Opcodes();
  }

  async NetworkType() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.NetworkType();
  }

  async XOnlyPublicKey() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.XOnlyPublicKey();
  }

  async Address() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.Address();
  }

  async PrivateKey() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.PrivateKey();
  }

  async RpcClient() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.RpcClient();
  }

  async Encoding() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.Encoding();
  }

  async Resolver() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.Resolver();
  }

  async Transaction() {
    const api = await kaspaWebSdk.getKaspaApi();
    // @ts-ignore
    return api.Transaction();
  }
}
