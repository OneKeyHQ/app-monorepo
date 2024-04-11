export type IOnChainTransaction = {
  address_from: string;
  address_to: string[];
  amount: string[];
  blockHash: string;
  blockIndex: number;
  extra: {
    nonce: string[];
    publicKey: string;
    raw: string;
  };
  fee: number;
  hash: string;
  inBlockchain: boolean;
  inputs: {
    data: {
      input: {
        amount: number;
        k_image: string;
        key_offsets: number[];
      };
      mixin: number;
      outputs: {
        number: number;
        transactionHash: string;
      }[];
    };
    type: string;
  }[];
  mixin: number;
  outputs: {
    globalIndex: number;
    output: {
      amount: number;
      target: {
        data: {
          key: string;
        };
        type: string;
      };
    };
  }[];
  outputs_with_address: {
    address_to: string;
    globalIndex: number;
    output: {
      amount: number;
      target: {
        data: {
          key: string;
        };
        type: string;
      };
    };
  }[];
  paymentId: string;
  signatures: {
    first: number;
    second: string;
  }[];
  signaturesSize: number;
  size: number;
  timestamp: number;
  totalInputsAmount: number;
  totalOutputsAmount: number;
  unlockTime: number;
  version: number;
};

export type IOnChainTransactionsItem = {
  amount: string[];
  amount_out: number;
  fee: number;
  from_address: string;
  hash: string;
  height: number;
  size: number;
  timestamp: number;
  to_address: string[];
};

export type IOnChainBalance = {
  amount_in: number;
  amount_out: number;
  balance: number;
  fees: number;
  legacy_wallet: boolean;
  wallet: string;
};
