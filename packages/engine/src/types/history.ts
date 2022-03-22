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

type HistoryEntryMessageMeta = {
  message: string;
  ref?: string;
};

type HistoryEntryTransaction = HistoryEntryBase & HistoryEntryTransactionMeta;
type HistoryEntryMessage = HistoryEntryBase & HistoryEntryMessageMeta;

type HistoryEntryMeta = HistoryEntryTransactionMeta | HistoryEntryMessageMeta;
type HistoryEntry = HistoryEntryTransaction | HistoryEntryMessage;

export { HistoryEntryType, HistoryEntryStatus };
export type { HistoryEntry, HistoryEntryMeta };
