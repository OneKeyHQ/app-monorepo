import type { IGetCardanoApi } from './types';

const getCardanoApi: IGetCardanoApi = async () => {
  const Loader = await import('@onekeyfe/cardano-coin-selection-asmjs');
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
