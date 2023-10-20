export enum ChainId {
  MAIN = '314',
  CALIBRATION = '314159',
}

export enum ProtocolIndicator {
  ID,
  SECP256K1,
  ACTOR,
  BLS,
  DELEGATED,
}

export type CID =
  | string
  | {
      '/': string;
    };

export type IEncodedTxFil = {
  CID?: CID;
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
