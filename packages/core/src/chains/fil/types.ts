export enum EFilChainId {
  MAIN = '314',
  CALIBRATION = '314159',
}

export enum EFilProtocolIndicator {
  ID,
  SECP256K1,
  ACTOR,
  BLS,
  DELEGATED,
}

export type IFilCID =
  | string
  | {
      '/': string;
    };

export type IEncodedTxFil = {
  CID?: IFilCID;
  Version?: number;
  From: string;
  GasFeeCap: string;
  GasLimit: number;
  GasPremium: string;
  Method: number;
  Nonce: number;
  Params: string;
  To: string;
  Value: string;
};
