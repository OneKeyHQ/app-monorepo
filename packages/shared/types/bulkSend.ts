import type { IToken } from './token';

export enum EBulkSendMode {
  OneToMany = 'oneToMany',
  ManyToOne = 'manyToOne',
  ManyToMany = 'manyToMany',
}

export enum EReceiverMode {
  AddressOnly = 'addressOnly',
  AddressAndAmount = 'addressAndAmount',
}

export enum EAmountInputMode {
  Specified = 'specified',
  Range = 'range',
  Custom = 'custom',
}

export type IAmountInputValues = {
  specifiedAmount: string;
  rangeMin: string;
  rangeMax: string;
  isMaxMode?: boolean;
};

export type IAmountInputError = {
  specifiedAmount?: string;
  rangeMin?: string;
  rangeMax?: string;
  rangeError?: string;
};

export type ITransferInfoError = {
  from?: string;
  to?: string;
  amount?: string;
};

export type ITransferInfoErrors = Record<number, ITransferInfoError>;

export enum EIntervalMode {
  Specified = 'specified',
  None = 'none',
}

export type IIntervalSettings = {
  mode: EIntervalMode;
  minSeconds: string;
  maxSeconds: string;
};

export enum EBulkSendProgressState {
  InProgress = 'InProgress',
  Paused = 'Paused',
  Finished = 'Finished',
  Aborted = 'Aborted',
}

export enum EBulkSendTxStatus {
  Pending = 'pending',
  Processing = 'processing',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Skipped = 'skipped',
  Paused = 'paused',
}

export type IBulkSendTxStatus = {
  status: EBulkSendTxStatus;
  txId?: string;
  errorMessage?: string;
  isInsufficientFunds?: boolean;
  feeFiat?: string;
  feeNative?: string;
  feeSymbol?: string;
};

// Everything the bulk send addresses page needs to paint its first frame,
// resolved by the background in a single round trip (OK-61587).
export type IBulkSendAddressesInputSeedParams = {
  networkId?: string;
  accountId?: string;
  indexedAccountId?: string;
  tokenInfo?: IToken;
  bulkSendMode: EBulkSendMode;
};

export type IBulkSendAddressesInputSeedNetwork = {
  id: string;
  name: string;
  logoURI: string;
  isCustomNetwork?: boolean;
};

export type IBulkSendAddressesInputSeedSender = {
  address: string;
  accountName?: string;
  walletName?: string;
};

export type IBulkSendAddressesInputSeed = {
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
  isSupportedNetwork: boolean;
  token?: IToken;
  network?: IBulkSendAddressesInputSeedNetwork;
  // OneToMany only: the seeded sender address plus the wallet / account
  // names used for the address badge.
  sender?: IBulkSendAddressesInputSeedSender;
};
