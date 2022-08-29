export type IEncodedTxCfx = {
  from: string;
  to: string;
  value: string;
  nonce?: string;
  gasPrice?: string;
  gas?: string;
  gasLimit?: string;
  data?: string;
  storageLimit?: string;
  epochHeight?: string;
  chainId?: string;
};
