import type { IFeeInfoUnit } from '../../types';
import type { UnspentOutput } from './sdk';
import type { PrivateKey, PublicKey } from '@kaspa/core-lib';

export type IEncodedTxKaspa = {
  utxoIds: string[];
  inputs: UnspentOutput[];
  outputs: {
    address: string;
    value: string;
  }[];
  mass: number;
  hasMaxSend: boolean;
  feeInfo?: IFeeInfoUnit;
};

export type IKaspaSigner = {
  getPublicKey(): PublicKey;

  getPrivateKey(): Promise<PrivateKey>;
};
