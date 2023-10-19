import * as Loader from '@onekeyfe/cardano-coin-selection';

import type { IGetCardanoApi } from './types';

const getCardanoApi: IGetCardanoApi = async () => {
  // Crash Jest ERROR:  await import() NOT SUPPORTED for wasm
  //    cardano-crypto.js/lib.js:765 Linking failure in asm.js: Unexpected stdlib member

  // const Loader = await import('@onekeyfe/cardano-coin-selection');

  console.log(typeof Loader);

  return {
    composeTxPlan: Loader.onekeyUtils.composeTxPlan,
    signTransaction: Loader.onekeyUtils.signTransaction,
    hwSignTransaction: Loader.trezorUtils.signTransaction,
    txToOneKey: Loader.onekeyUtils.txToOneKey,
    dAppGetBalance: Loader.dAppUtils.getBalance,
    dAppGetAddresses: Loader.dAppUtils.getAddresses,
    dAppGetUtxos: Loader.dAppUtils.getUtxos,
    dAppConvertCborTxToEncodeTx: Loader.dAppUtils.convertCborTxToEncodeTx,
    dAppSignData: Loader.dAppUtils.signData,
  };
};

export default {
  getCardanoApi,
};
