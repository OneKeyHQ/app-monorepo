import type { IKaspaSdkApi } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types/sdk';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import type { addressFromScriptPublicKey } from '@real_weatherstar/kaspa-wasm';

const LibLoader = async () => import('@real_weatherstar/kaspa-wasm');

const getKaspaApi = memoizee(
  async () => {
    const KaspaLib = await LibLoader();
    await KaspaLib.default();
    return KaspaLib;
  },
  {
    promise: true,
  },
);

class WebEmbedApiChainKaspa implements IKaspaSdkApi {
  async ScriptBuilder() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.ScriptBuilder;
  }

  async Opcodes() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.Opcodes;
  }

  async NetworkType() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.NetworkType;
  }

  async XOnlyPublicKey() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.XOnlyPublicKey;
  }

  async Address() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.Address;
  }

  async addressFromScriptPublicKey(
    ...args: Parameters<typeof addressFromScriptPublicKey>
  ) {
    const kaspaApi = await getKaspaApi();
    return Promise.resolve(kaspaApi.addressFromScriptPublicKey(...args));
  }
}

export default WebEmbedApiChainKaspa;
