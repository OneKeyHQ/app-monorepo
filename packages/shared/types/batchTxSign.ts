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
  // Display semantics mirror the single-psbt confirm page: external
  // recipients/amounts when external outputs exist (change hidden); for a
  // pure self-transfer psbt, the wallet-owned recipients and the total of
  // all owned outputs instead.
  recipient: string; // primary recipient address ('' if none resolvable)
  extraRecipientCount: number; // additional recipients -> "+N"
  amountValue: string; // satoshi, displayed outgoing total
  // Satoshi actually leaving the wallet ('0' for a pure self-transfer).
  // amountValue is display-aligned with the drill-down confirm page and thus
  // means "owned outputs total" for self-transfers — summing it would count
  // funds that never leave the wallet, so aggregations (the overview's
  // "Total outgoing") must sum this field instead.
  externalAmountValue: string;
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
