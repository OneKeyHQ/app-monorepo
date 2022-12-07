export enum ChainId {
  MAIN = '314',
  WALLABY = '31415',
}

export enum ProtocolIndicator {
  ID,
  SECP256K1,
  ACTOR,
  BLS,
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
