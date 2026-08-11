export enum EBatchTxSignStatus {
  Overview = 'overview',
  Signing = 'signing',
  Complete = 'complete',
  Stopped = 'stopped', // a failure/rejection stopped the queue; Sign remaining allowed
  Cancelled = 'cancelled',
}

export enum EBatchTxSignItemStatus {
  Ready = 'ready',
  Signing = 'signing',
  Signed = 'signed',
  Failed = 'failed',
}

export type IBatchTxSignItemSummary = {
  index: number; // original input index; result array is assembled by this
  recipient: string; // primary external recipient address ('' if none resolvable)
  extraRecipientCount: number; // additional external recipients -> "+N"
  amountValue: string; // satoshi, external outgoing (excludes change)
  feeValue: string; // satoshi
  status: EBatchTxSignItemStatus;
  errorMessage?: string;
};

export type IBatchTxSignProgress = {
  batchId: string;
  accountId: string;
  networkId: string;
  status: EBatchTxSignStatus;
  totalCount: number;
  signedCount: number;
  currentIndex?: number; // item currently at the device / being signed
  items: IBatchTxSignItemSummary[];
};
