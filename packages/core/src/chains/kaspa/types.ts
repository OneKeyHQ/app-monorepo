import type { IKaspaUnspentOutputInfo } from './sdkKaspa';
import type { PrivateKey, PublicKey } from '@onekeyfe/kaspa-core-lib';

export type IEncodedTxKaspa = {
  utxoIds: string[];
  inputs: IKaspaUnspentOutputInfo[];
  outputs: {
    address: string;
    value: string;
  }[];
  mass: number;
  hasMaxSend: boolean;
  // TODO IFeeInfoUnit
  feeInfo?: {
    price: string; // feerate
    limit: string;
  };

  changeAddress?: string;
  // When set, the change output is dropped and the whole input surplus is left
  // as fee.
  dropChangeToFee?: boolean;

  // Hex-encoded transaction payload. When set, the tx is built/signed via
  // kaspa-wasm (kaspa-core-lib hardcodes a zero payload hash and cannot carry a
  // real payload). Used by the single-tx KRC20 transfer that puts the kasplex op
  // JSON into the consensus payload.
  payload?: string;
};

export type IKaspaSigner = {
  getPublicKey(): PublicKey;

  getPrivateKey(): Promise<PrivateKey>;
};
