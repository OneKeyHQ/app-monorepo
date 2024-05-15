export type IEncodedTxStc = {
  from: string;
  to: string;
  value: string;
  gasPrice?: string;
  gasLimit?: string;
  nonce?: number;
  data?: string;
};
