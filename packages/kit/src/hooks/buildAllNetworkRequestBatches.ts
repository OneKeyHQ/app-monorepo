/**
 * Plans the All Networks live fan-out as request batches.
 *
 * The portfolio positions API takes one `accountAddress` per request and up
 * to 10 networks, so a batch can only hold networks that one account serves
 * with the same address (today that is the EVM family). Grouping is by
 * account and address alone: which network families may be arrayed is the
 * backend's call, and an array it rejects falls back to single-network
 * requests in `ServiceDeFi`. Chunks are built from the sorted network ids of
 * each group so the same account set always yields the same batches: the
 * backend cache key is the sorted set of requested networks, and an unstable
 * split would miss it on every run.
 */

export const ALL_NETWORK_REQUEST_BATCH_SIZE = 10;

export interface IAllNetworkRequestBatchItem {
  accountId: string;
  networkId: string;
  apiAddress: string;
  accountXpub?: string;
}

export interface IAllNetworkRequestBatch<
  T extends IAllNetworkRequestBatchItem,
> {
  accountId: string;
  apiAddress: string;
  accountXpub: string | undefined;
  // Sorted by networkId; 1..maxBatchSize entries.
  items: T[];
}

function compareNetworkId(a: string, b: string) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function buildAllNetworkRequestBatches<
  T extends IAllNetworkRequestBatchItem,
>(
  accounts: T[],
  options?: {
    maxBatchSize?: number;
  },
): IAllNetworkRequestBatch<T>[] {
  const maxBatchSize = Math.max(
    1,
    options?.maxBatchSize ?? ALL_NETWORK_REQUEST_BATCH_SIZE,
  );

  const groups = new Map<
    string,
    {
      accountId: string;
      apiAddress: string;
      accountXpub: string | undefined;
      items: T[];
    }
  >();
  for (const item of accounts) {
    // Placeholder rounds (no account / address) carry no data.
    if (!item.accountId || !item.apiAddress) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const key = `${item.accountId}|${item.apiAddress}|${
      item.accountXpub ?? ''
    }`;
    let group = groups.get(key);
    if (!group) {
      group = {
        accountId: item.accountId,
        apiAddress: item.apiAddress,
        accountXpub: item.accountXpub,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  const batches: IAllNetworkRequestBatch<T>[] = [];
  for (const group of groups.values()) {
    const sorted = [...group.items].toSorted((a, b) =>
      compareNetworkId(a.networkId, b.networkId),
    );
    for (let start = 0; start < sorted.length; start += maxBatchSize) {
      batches.push({
        accountId: group.accountId,
        apiAddress: group.apiAddress,
        accountXpub: group.accountXpub,
        items: sorted.slice(start, start + maxBatchSize),
      });
    }
  }
  return batches;
}

// Cold-path phase split: a batch runs in the backend-indexed phase when any
// of its networks is backend indexed. Composition is never changed here.
export function partitionAllNetworkRequestBatches<
  T extends IAllNetworkRequestBatchItem & { isBackendIndexed?: boolean },
>(batches: IAllNetworkRequestBatch<T>[]) {
  const indexed: IAllNetworkRequestBatch<T>[] = [];
  const notIndexed: IAllNetworkRequestBatch<T>[] = [];
  for (const batch of batches) {
    if (batch.items.some((item) => item.isBackendIndexed)) {
      indexed.push(batch);
    } else {
      notIndexed.push(batch);
    }
  }
  return { indexed, notIndexed };
}
