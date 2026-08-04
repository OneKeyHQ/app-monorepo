import type {
  ISwapInvitesResponse,
  ISwapRecordItem,
  ISwapRecordsParams,
} from '@onekeyhq/shared/src/referralCode/type';

export const SWAP_INVITE_DESKTOP_COLUMN_WIDTHS = {
  address: '14%',
  invitedAt: '16%',
  referralCode: '14%',
  firstTrade: '18%',
  volume: '14%',
  fee: '14%',
  rewards: '10%',
} as const;

export const SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS = {
  period: '16%',
  volume: '18%',
  rewards: '20%',
  status: '18%',
  transactionHash: '28%',
} as const;

export function getSwapRecordsStatusByTab(
  tab: 'undistributed' | 'total',
): ISwapRecordsParams['status'] {
  return tab === 'undistributed' ? 'AVAILABLE' : undefined;
}

export interface ISwapRecordGroup {
  key: string;
  period: string;
  items: ISwapRecordItem[];
}

export function getSwapQuerySignature(query: object): string {
  return JSON.stringify(query);
}

export function appendSwapInvitePage({
  current,
  next,
}: {
  current: ISwapInvitesResponse | undefined;
  next: ISwapInvitesResponse;
}): ISwapInvitesResponse {
  return {
    ...next,
    // IDs are scoped to one server response. Preserve every row verbatim;
    // never deduplicate or interpret these opaque values.
    items: [...(current?.items ?? []), ...next.items],
  };
}

export function getNextSwapCursor({
  requestedCursor,
  responseCursor,
}: {
  requestedCursor: string;
  responseCursor: string | null;
}): string | undefined {
  if (!responseCursor || responseCursor === requestedCursor) {
    return undefined;
  }
  return responseCursor;
}

export function buildSwapRecordKey(
  item: ISwapRecordItem,
  index: number,
): string {
  return `${item.address}:${item.period}:${item.status}:${
    item.distributedTx ?? ''
  }:${index}`;
}

function buildSwapRecordGroupKey(item: ISwapRecordItem): string {
  return JSON.stringify([
    item.address,
    item.period,
    item.token.networkId,
    item.token.address,
  ]);
}

export function groupSwapRecords(items: ISwapRecordItem[]): ISwapRecordGroup[] {
  const groupMap = new Map<string, ISwapRecordGroup>();

  items.forEach((item) => {
    const key = buildSwapRecordGroupKey(item);
    const group = groupMap.get(key);
    if (group) {
      group.items.push(item);
      return;
    }

    groupMap.set(key, {
      key,
      period: item.period,
      items: [item],
    });
  });

  return Array.from(groupMap.values());
}
