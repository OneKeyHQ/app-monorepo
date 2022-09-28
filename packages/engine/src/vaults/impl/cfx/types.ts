export type IEncodedTxCfx = {
  from: string;
  to: string;
  value: string;
  data: string;
  nonce?: string | number;
  gas?: string;
  gasPrice?: string;
  gasLimit?: string;
  storageLimit?: number;
  chainId?: number;
  epochHeight?: number;
};
