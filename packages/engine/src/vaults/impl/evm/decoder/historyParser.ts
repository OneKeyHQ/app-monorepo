import { TxStatus } from '../../../../types/covalent';
import { HistoryEntryTransaction } from '../../../../types/history';

import { EVMDecodedItem } from './types';

const txStatusFromHistoryEntry = (historyEntry: HistoryEntryTransaction) => {
  const { status } = historyEntry;
  if (status === 'success') {
    return TxStatus.Confirmed;
  }
  if (status === 'pending') {
    return TxStatus.Pending;
  }
  return TxStatus.Failed;
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
