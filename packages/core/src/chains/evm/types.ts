import type { Transaction as IEthersTransaction } from './sdkEvm/ethers';

export type IEncodedTxEvm = {
  from: string;
  to: string;
  value: string;
  data?: string;
  customData?: string;
  nonce?: number | string; // rpc use 0x string

  gas?: string; // alias for gasLimit
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;

  chainId?: number; // MUST be number: Error: invalid transaction.chainId
};

export type INativeTxEvm = IEthersTransaction;
export type IRpcTxEvm = IEncodedTxEvm & {
  input?: string;
  hash?: string;
};
