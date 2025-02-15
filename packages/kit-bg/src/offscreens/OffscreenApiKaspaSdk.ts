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
}
