export type IGetCardanoApi = () => Promise<IAdaSdkApi>;

export type IEnsureSDKReady = () => Promise<boolean>;

export interface IAdaSdk {
  getCardanoApi: IGetCardanoApi;
  ensureSDKReady: IEnsureSDKReady;
}

export type IParsedRawTxInput = {
  prev_hash: string;
  prev_index: number;
};

export type IParsedRawTxBodyStakeInfo = {
  hasCertificates: boolean;
  hasWithdrawals: boolean;
  requiredSignerHashes: string[];
};

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
  // Tx body parsers (backed by CardanoWasm directly, not onekey-coin-selection):
  parseRawTxInputs: (rawTxHex: string) => Promise<IParsedRawTxInput[]>;
  parseRawTxBodyStakeInfo: (
    rawTxHex: string,
  ) => Promise<IParsedRawTxBodyStakeInfo>;
  extractStakeKeyHashFromBaseAddress: (addr: string) => Promise<string | null>;
}
