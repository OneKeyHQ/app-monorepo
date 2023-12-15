import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

export function convertHistoryToSectionGroups(params: {
  formatDate: (date: number) => string;
  items?: IAccountHistoryTx[];
}): IHistoryListSectionGroup[] {
  const { items = [], formatDate } = params;
  let pendingGroup: IHistoryListSectionGroup | undefined = {
    titleKey: 'transaction__pending',
    data: [],
  };
  const dateGroups: IHistoryListSectionGroup[] = [];
  let currentDateGroup: IHistoryListSectionGroup | undefined;
  items.forEach((item) => {
    if (item.decodedTx.status === EDecodedTxStatus.Pending) {
      pendingGroup?.data.push(item);
    } else {
      const dateKey = formatDate(
        item.decodedTx.updatedAt || item.decodedTx.createdAt || 0,
      );
      if (!currentDateGroup || currentDateGroup.title !== dateKey) {
        if (currentDateGroup) {
          dateGroups.push(currentDateGroup);
        }
        currentDateGroup = {
          title: dateKey,
          data: [],
        };
      }
      currentDateGroup.data.push(item);
    }
  });
  if (currentDateGroup) {
    dateGroups.push(currentDateGroup);
  }
  if (!pendingGroup.data.length) {
    pendingGroup = undefined;
  }
  if (pendingGroup) {
    return [pendingGroup, ...dateGroups].filter(Boolean);
  }
  return [...dateGroups].filter(Boolean);
}
