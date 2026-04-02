export type IEncodedTxCfx = {
  from: string;
  to: string;
  value: string;
  data: string;
  hash?: string;
  nonce?: number;
  gas?: string;
  gasFee?: string;
  gasPrice?: string;
  gasLimit?: string;
  storageLimit?: string;
  chainId?: number;
  epochHeight?: number;
  contract?: string;
};
