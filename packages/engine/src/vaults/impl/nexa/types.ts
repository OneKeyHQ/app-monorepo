import type { ITransferInfo } from '../../types';

export type IEncodedTxNexa = {
  inputs: Array<{
    address: string;
    txId: string;
    satoshis: number;
    outputIndex: number;
  }>;
  outputs: Array<{
    address: string;
    fee: string;
    outType: number;
  }>;
  totalFee: string;
  totalFeeInNative?: string;
  transferInfo?: ITransferInfo;
};

export type IListUXTO = {
  height: number;
  outpoint_hash: string;
  tx_hash: string;
  tx_pos: number;
  value: number;
};

export type INexaHistoryItem = {
  height: number;
  tx_hash: string;
};
