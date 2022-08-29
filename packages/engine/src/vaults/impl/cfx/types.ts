export type IEncodedTxCfx = {
  from: string;
  to: string;
  nonce?: string;
  gasPrice?: string;
  gas?: string;
  gasLimit?: string;
  value?: string;
  data?: string;
  storageLimit?: string;
  epochHeight?: string;
  chainId?: string;
};
