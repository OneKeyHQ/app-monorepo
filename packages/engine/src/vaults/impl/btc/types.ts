import type { ITransferInfo } from '../../types';

export type IBtcUTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
};

// TODO: this encodedTx structure could be applied to all UTXO model chains.
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
