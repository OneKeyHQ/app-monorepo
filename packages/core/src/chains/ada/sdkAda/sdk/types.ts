export type IGetCardanoApi = () => Promise<IAdaSdkApi>;

export type IEnsureSDKReady = () => Promise<boolean>;

export interface IAdaSdk {
  getCardanoApi: IGetCardanoApi;
  ensureSDKReady: IEnsureSDKReady;
}

export interface IAdaSdkApi {
  composeTxPlan: typeof import('@onekeyfe/cardano-coin-selection-asmjs').onekeyUtils.composeTxPlan;
  signTransaction: typeof import('@onekeyfe/cardano-coin-selection-asmjs').onekeyUtils.signTransaction;
  hwSignTransaction: typeof import('@onekeyfe/cardano-coin-selection-asmjs').trezorUtils.signTransaction;
  txToOneKey: typeof import('@onekeyfe/cardano-coin-selection-asmjs').onekeyUtils.txToOneKey;
  hasSetTagWithBody: typeof import('@onekeyfe/cardano-coin-selection-asmjs').onekeyUtils.hasSetTagWithBody;
  dAppGetBalance: typeof import('@onekeyfe/cardano-coin-selection-asmjs').dAppUtils.getBalance;
  dAppGetAddresses: typeof import('@onekeyfe/cardano-coin-selection-asmjs').dAppUtils.getAddresses;
  dAppGetUtxos: typeof import('@onekeyfe/cardano-coin-selection-asmjs').dAppUtils.getUtxos;
  dAppConvertCborTxToEncodeTx: typeof import('@onekeyfe/cardano-coin-selection-asmjs').dAppUtils.convertCborTxToEncodeTx;
  dAppSignData: typeof import('@onekeyfe/cardano-coin-selection-asmjs').dAppUtils.signData;
}
