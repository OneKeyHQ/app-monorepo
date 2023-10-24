import type BN from 'bn.js';

export type IEncodedTxNexa = {
  inputs: Array<{
    address: string;
    txId: string;
    satoshis: string;
    outputIndex: number;
    sequenceNumber?: number;
  }>;
  outputs: Array<{
    address: string;
    satoshis: string;
    outType: number;
  }>;
  gas?: string;
  totalFeeInNative?: string;
  // TODO ITransferInfo
  // transferInfo?: ITransferInfo;
};

export enum NexaSignature {
  SIGHASH_NEXA_ALL = 0x00,
  SIGHASH_ALL = 0x01,
  SIGHASH_NONE = 0x02,
  SIGHASH_SINGLE = 0x03,
  SIGHASH_FORKID = 0x40,
  SIGHASH_ANYONECANPAY = 0x80,
}

export interface INexaInputSignature {
  publicKey: Buffer;
  prevTxId: string;
  outputIndex: number;
  inputIndex: number;
  signature: Buffer;
  sigtype: NexaSignature;
  sequenceNumber: number;
  scriptBuffer: Buffer;
  amount: BN;
}

export interface INexaOutputSignature {
  address: string;
  satoshi: BN;
  outType: number;
  scriptBuffer: Buffer;
}
