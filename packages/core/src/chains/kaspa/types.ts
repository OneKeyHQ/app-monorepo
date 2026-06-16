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

  commitAddress?: string;
  commitScriptPubKey?: string;
  commitScriptHex?: string;
  changeAddress?: string;
  // When set, the change output is dropped and the whole input surplus is left
  // as fee. Used by the KRC20 commit tx to avoid a small change output that
  // would push the KIP-0009 storage mass over the node's max-allowed mass limit.
  dropChangeToFee?: boolean;
};

export type IKaspaSigner = {
  getPublicKey(): PublicKey;

  getPrivateKey(): Promise<PrivateKey>;
};
