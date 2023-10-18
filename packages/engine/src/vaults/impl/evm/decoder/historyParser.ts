import { TxStatus } from '../../../../types/covalent';

import type { HistoryEntryTransaction } from '../../../../types/history';
import type { EVMDecodedItem } from './types';

const txStatusFromHistoryEntry = (historyEntry: HistoryEntryTransaction) => {
  const { status } = historyEntry;
  return {
    success: TxStatus.Confirmed,
    pending: TxStatus.Pending,
    dropped: TxStatus.Dropped,
    failed: TxStatus.Failed,
    signed: TxStatus.Failed,
  }[status];
};

const updateWithHistoryEntry = (
  item: EVMDecodedItem,
  historyEntry: HistoryEntryTransaction,
): EVMDecodedItem => {
  const { createdAt } = historyEntry;
  const txStatus = txStatusFromHistoryEntry(historyEntry);
  const updater = { blockSignedAt: createdAt, txStatus } as const;
  return { ...item, ...updater };
};

export { updateWithHistoryEntry };
