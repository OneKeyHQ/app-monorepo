export type IGetCardanoApi = () => Promise<IAdaSdkApi>;

export type IEnsureSDKReady = () => Promise<boolean>;

export interface IAdaSdk {
  getCardanoApi: IGetCardanoApi;
  ensureSDKReady: IEnsureSDKReady;
}

export interface IAdaSdkApi {
  composeTxPlan: typeof import('@onekeyfe/cardano-coin-selection').onekeyUtils.composeTxPlan;
  signTransaction: typeof import('@onekeyfe/cardano-coin-selection').onekeyUtils.signTransaction;
  hwSignTransaction: typeof import('@onekeyfe/cardano-coin-selection').trezorUtils.signTransaction;
  txToOneKey: typeof import('@onekeyfe/cardano-coin-selection').onekeyUtils.txToOneKey;
  dAppGetBalance: typeof import('@onekeyfe/cardano-coin-selection').dAppUtils.getBalance;
  dAppGetAddresses: typeof import('@onekeyfe/cardano-coin-selection').dAppUtils.getAddresses;
  dAppGetUtxos: typeof import('@onekeyfe/cardano-coin-selection').dAppUtils.getUtxos;
  dAppConvertCborTxToEncodeTx: typeof import('@onekeyfe/cardano-coin-selection').dAppUtils.convertCborTxToEncodeTx;
  dAppSignData: typeof import('@onekeyfe/cardano-coin-selection').dAppUtils.signData;
}
