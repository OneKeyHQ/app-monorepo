enum HistoryEntryType {
  TRANSFER = 'transfer',
  APPROVE = 'approve',
  SIGN = 'sign',
  TRANSACTION = 'transaction',
}

enum HistoryEntryStatus {
  SIGNED = 'signed',
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  DROPPED = 'dropped',
}

type HistoryEntryBase = {
  id: string;
  status: HistoryEntryStatus;
  type: HistoryEntryType;
  createdAt: number;
  updatedAt: number;
};

type HistoryEntryTransactionMeta = {
  contract: string;
  target: string;
  value: string;
  rawTx: string;
  ref?: string;
};

type HistoryEntryTransaction = HistoryEntryBase & HistoryEntryTransactionMeta;

type HistoryEntryMeta = HistoryEntryTransactionMeta;
type HistoryEntry = HistoryEntryTransaction;

export { HistoryEntryType, HistoryEntryStatus };
export type { HistoryEntry, HistoryEntryMeta };
