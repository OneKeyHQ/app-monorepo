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

export enum TransferMethod {
  FIL = 0,
  EVM = 3844450837,
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

export type IOnChainHistoryTx = {
  cid: string;
  height: number;
  time: number;
  timeFormat: string;
  fee: string;
  method: string;
  from: string;
  to: string;
  toType: number;
  exitCodeName: string;
  value: string;
  gasUsed: number;
};

export const FIL_UNIT_MAP = {
  FIL: 0,
  milliFIL: 3,
  microFIL: 6,
  nanoFIL: 9,
  picoFIL: 12,
  femtoFIL: 15,
  attoFIL: 18,
};

export type FilUnit = keyof typeof FIL_UNIT_MAP;
