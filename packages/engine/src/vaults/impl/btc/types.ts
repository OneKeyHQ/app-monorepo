import type { ITransferInfo } from '../../types';

export type IBtcUTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
};

export type IEncodedTxBtc = {
  inputs: Array<IBtcUTXO>;
  outputs: Array<{ address: string; value: string }>;
  totalFee: string;
  totalFeeInNative: string;
  transferInfo: ITransferInfo;
};
export type INativeTxBtc = any;
export type IDecodedTxExtraBtc = {
  blockSize: string;
  feeRate: string;
  confirmations: number;
};

export type IBlockBookTransaction = {
  txid: string;
  vin: Array<{
    isAddress?: boolean;
    addresses: Array<string>;
    value: string;
    isOwn?: boolean;
  }>;
  vout: Array<{
    isAddress?: boolean;
    addresses: Array<string>;
    value: string;
    isOwn?: boolean;
  }>;
  confirmations: number;
  fees: string;
  blockTime?: number;
};
