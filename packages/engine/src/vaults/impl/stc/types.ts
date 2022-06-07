// TODO: no token or dapp support yet
export type IEncodedTxSTC = {
  from: string;
  to: string;
  value: string;
  gasPrice?: string;
  gasLimit?: string;
  nonce?: number;
};
