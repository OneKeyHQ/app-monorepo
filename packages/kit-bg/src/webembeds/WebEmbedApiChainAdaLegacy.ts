import type { IAdaSdkApi } from '@onekeyhq/core/src/chains/ada/sdkAda/sdk/types';
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
type IAdaComposeTxPlan = typeof IAdaLib.onekeyUtils.composeTxPlan;
type IAdaSignTransaction = typeof IAdaLib.onekeyUtils.signTransaction;
type IAdaHwSignTransaction = typeof IAdaLib.trezorUtils.signTransaction;

const getCardanoApi = memoizee(
  async () => {
    const AdaLib = await LibLoader();
    return {
      composeTxPlan: AdaLib.onekeyUtils.composeTxPlan,
      signTransaction: AdaLib.onekeyUtils.signTransaction,
      hwSignTransaction: AdaLib.trezorUtils.signTransaction,
      txToOneKey: AdaLib.onekeyUtils.txToOneKey,
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
}

export default WebEmbedApiChainAdaLegacy;
