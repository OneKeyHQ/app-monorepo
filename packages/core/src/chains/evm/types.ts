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

  chainId?: string; // server require string

  // EIP-2930
  txType?: number;
  accessList?: {
    address: string;
    storageKeys: string[];
  }[];
  paymentRequest?: IEvmPaymentRequest;
  ethereumDefinitions?: IEvmEthereumDefinitions;
};

export type IEvmEthereumDefinitions = {
  encodedNetwork?: ArrayBuffer | string;
  encodedToken?: ArrayBuffer | string;
};

export type IEvmPaymentRequestMemo = {
  textMemo?: {
    text: string;
  };
  textDetailsMemo?: {
    title: string;
    text: string;
  };
  refundMemo?: {
    address: string;
    addressN?: number[];
    mac: string;
  };
  coinPurchaseMemo?: {
    coinType: number;
    amount: string;
    address: string;
    addressN?: number[];
    mac: string;
  };
};

export type IEvmPaymentRequest = {
  nonce?: string;
  recipientName: string;
  memos?: IEvmPaymentRequestMemo[];
  amount?: string;
  signature: string;
};

export type INativeTxEvm = IEthersTransaction;
export type IRpcTxEvm = IEncodedTxEvm & {
  input?: string;
  hash?: string;
};
