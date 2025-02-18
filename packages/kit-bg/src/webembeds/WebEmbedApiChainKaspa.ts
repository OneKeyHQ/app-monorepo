import type { IKaspaSdkApi } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/types/sdk';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import type {
  addressFromScriptPublicKey,
  calculateTransactionFee,
  calculateTransactionMass,
  createTransaction,
  createTransactions,
} from '@real_weatherstar/kaspa-wasm';

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

  async PrivateKey() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.PrivateKey;
  }

  async RpcClient() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.RpcClient;
  }

  async Encoding() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.Encoding;
  }

  async Resolver() {
    const kaspaApi = await getKaspaApi();
    return kaspaApi.Resolver;
  }

  async addressFromScriptPublicKey(
    ...args: Parameters<typeof addressFromScriptPublicKey>
  ) {
    const kaspaApi = await getKaspaApi();
    return Promise.resolve(kaspaApi.addressFromScriptPublicKey(...args));
  }

  async createTransaction(...args: Parameters<typeof createTransaction>) {
    const kaspaApi = await getKaspaApi();
    return Promise.resolve(kaspaApi.createTransaction(...args));
  }

  async createTransactions(...args: Parameters<typeof createTransactions>) {
    const kaspaApi = await getKaspaApi();
    return Promise.resolve(kaspaApi.createTransactions(...args));
  }

  async calculateTransactionFee(
    ...args: Parameters<typeof calculateTransactionFee>
  ) {
    const kaspaApi = await getKaspaApi();
    return Promise.resolve(kaspaApi.calculateTransactionFee(...args));
  }

  async calculateTransactionMass(
    ...args: Parameters<typeof calculateTransactionMass>
  ) {
    const kaspaApi = await getKaspaApi();
    return Promise.resolve(kaspaApi.calculateTransactionMass(...args));
  }

  async kaspaToSompi(...args: Parameters<typeof kaspaToSompi>) {
    const kaspaApi = await getKaspaApi();
    return Promise.resolve(kaspaApi.kaspaToSompi(...args));
  }
}

export default WebEmbedApiChainKaspa;
