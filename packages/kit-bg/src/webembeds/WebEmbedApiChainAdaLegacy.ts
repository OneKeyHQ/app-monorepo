import type { IAdaBatchGetShelleyAddressByRootKeyHexParams } from '@onekeyhq/core/src/chains/ada/sdkAda';
import type { IAdaSdkApi } from '@onekeyhq/core/src/chains/ada/sdkAda/sdk/types';
import type { IHdCredentialDecryptCacheParams } from '@onekeyhq/core/src/secret';
import type { ICoreHdCredentialEncryptHex } from '@onekeyhq/core/src/types';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import type IAdaLib from '@onekeyfe/cardano-coin-selection-asmjs';

const LibLoader = async () => import('@onekeyfe/cardano-coin-selection-asmjs');

type IAdaDappGetBalance = typeof IAdaLib.dAppUtils.getBalance;
type IAdaDappGetUtxos = typeof IAdaLib.dAppUtils.getUtxos;
type IAdaDappGetAddresses = typeof IAdaLib.dAppUtils.getAddresses;
type IAdaDappSignData = typeof IAdaLib.dAppUtils.signData;
type IAdaDappConvertCborTxToEncodeTx =
  typeof IAdaLib.dAppUtils.convertCborTxToEncodeTx;
type IAdaTxToOneKey = typeof IAdaLib.onekeyUtils.txToOneKey;
type IAdaHasSetTagWithBody = typeof IAdaLib.onekeyUtils.hasSetTagWithBody;
type IAdaComposeTxPlan = typeof IAdaLib.onekeyUtils.composeTxPlan;
type IAdaSignTransaction = typeof IAdaLib.onekeyUtils.signTransaction;
type IAdaHwSignTransaction = typeof IAdaLib.trezorUtils.signTransaction;

export type IAdaBatchGetShelleyAddressesParams = {
  hdCredential: ICoreHdCredentialEncryptHex;
  indexes: number[];
  networkId?: 0 | 1;
  password: string;
} & IHdCredentialDecryptCacheParams;

export type IAdaBatchGetShelleyAddressesByMnemonicParams = {
  indexes: number[];
  mnemonic: string;
  networkId?: 0 | 1;
};

export type IAdaShelleyAddressPerfTestResult = {
  baseAddress: {
    address: string;
    path: string;
    xpub: string;
  };
  stakingAddress: {
    address: string;
    path: number[];
  };
}[];

const getCardanoApi = memoizee(
  async () => {
    const AdaLib = await LibLoader();
    return {
      composeTxPlan: AdaLib.onekeyUtils.composeTxPlan,
      signTransaction: AdaLib.onekeyUtils.signTransaction,
      hwSignTransaction: AdaLib.trezorUtils.signTransaction,
      txToOneKey: AdaLib.onekeyUtils.txToOneKey,
      hasSetTagWithBody: AdaLib.onekeyUtils.hasSetTagWithBody,
      parseRawTxInputs: AdaLib.onekeyUtils.parseRawTxInputs,
      parseRawTxBodyStakeInfo: AdaLib.onekeyUtils.parseRawTxBodyStakeInfo,
      extractStakeKeyHashFromBaseAddress:
        AdaLib.onekeyUtils.extractStakeKeyHashFromBaseAddress,
      dAppUtils: AdaLib.dAppUtils,
    };
  },
  {
    promise: true,
  },
);

class WebEmbedApiChainAdaLegacy implements IAdaSdkApi {
  async composeTxPlan(...args: Parameters<IAdaComposeTxPlan>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.composeTxPlan(...args);
  }

  async signTransaction(...args: Parameters<IAdaSignTransaction>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.signTransaction(...args);
  }

  async hwSignTransaction(...args: Parameters<IAdaHwSignTransaction>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.hwSignTransaction(...args);
  }

  async txToOneKey(...args: Parameters<IAdaTxToOneKey>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.txToOneKey(...args);
  }

  async hasSetTagWithBody(...args: Parameters<IAdaHasSetTagWithBody>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.hasSetTagWithBody(...args);
  }

  async dAppGetBalance(...args: Parameters<IAdaDappGetBalance>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.dAppUtils.getBalance(...args);
  }

  async dAppGetUtxos(...args: Parameters<IAdaDappGetUtxos>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.dAppUtils.getUtxos(...args);
  }

  async dAppGetAddresses(...args: Parameters<IAdaDappGetAddresses>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.dAppUtils.getAddresses(...args);
  }

  async dAppConvertCborTxToEncodeTx(
    ...args: Parameters<IAdaDappConvertCborTxToEncodeTx>
  ) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.dAppUtils.convertCborTxToEncodeTx(...args);
  }

  async dAppSignData(...args: Parameters<IAdaDappSignData>) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.dAppUtils.signData(...args);
  }

  async parseRawTxInputs(rawTxHex: string) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.parseRawTxInputs(rawTxHex);
  }

  async parseRawTxBodyStakeInfo(rawTxHex: string) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.parseRawTxBodyStakeInfo(rawTxHex);
  }

  async extractStakeKeyHashFromBaseAddress(addr: string) {
    const cardanoApi = await getCardanoApi();
    return cardanoApi.extractStakeKeyHashFromBaseAddress(addr);
  }

  async batchGetShelleyAddresses({
    hdCredential,
    password,
    indexes,
    networkId = 1,
    hdCredentialCacheScopeId,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  }: IAdaBatchGetShelleyAddressesParams): Promise<IAdaShelleyAddressPerfTestResult> {
    const { batchGetShelleyAddresses } =
      await import('@onekeyhq/core/src/chains/ada/sdkAda');
    return batchGetShelleyAddresses(
      hdCredential,
      password,
      indexes,
      networkId,
      {
        hdCredentialCacheScopeId,
        kdfBackend,
        enablePbkdf2Cache,
        debugCryptoProbeId,
      },
    );
  }

  async batchGetShelleyAddressesForPerfTest(
    params: IAdaBatchGetShelleyAddressesParams,
  ): Promise<IAdaShelleyAddressPerfTestResult> {
    return this.batchGetShelleyAddresses(params);
  }

  async batchGetShelleyAddressesByMnemonic({
    mnemonic,
    indexes,
    networkId = 1,
  }: IAdaBatchGetShelleyAddressesByMnemonicParams): Promise<IAdaShelleyAddressPerfTestResult> {
    const { batchGetShelleyAddressesByMnemonic } =
      await import('@onekeyhq/core/src/chains/ada/sdkAda');
    return batchGetShelleyAddressesByMnemonic(mnemonic, indexes, networkId);
  }

  async batchGetShelleyAddressByRootKeyHex(
    params: IAdaBatchGetShelleyAddressByRootKeyHexParams,
  ): Promise<IAdaShelleyAddressPerfTestResult> {
    const { batchGetShelleyAddressByRootKeyHex } =
      await import('@onekeyhq/core/src/chains/ada/sdkAda');
    return batchGetShelleyAddressByRootKeyHex(params);
  }
}

export default WebEmbedApiChainAdaLegacy;
