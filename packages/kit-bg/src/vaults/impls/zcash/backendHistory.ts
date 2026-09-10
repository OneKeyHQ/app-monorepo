import { isHistoryCursorAdvanced } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryResp,
  IOnChainHistoryTx,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';

const SHIELDED_COUNTERPARTY_LABEL = 'Shielded';

function shieldedCounterparty(amount: string): IOnChainHistoryTxTransfer {
  return {
    type: EOnChainHistoryTransferType.Shielded,
    address: SHIELDED_COUNTERPARTY_LABEL,
    from: '',
    to: '',
    token: '',
    key: '',
    amount,
    label: SHIELDED_COUNTERPARTY_LABEL,
    isNative: true,
    isOwn: false,
  };
}

// The indexer only sees the transparent leg. A receive with no inputs it can
// attribute (money arriving from a shielded pool) comes back with `sends: []`
// and an empty `from`; a send whose outputs all went shielded comes back
// with no external receive. The generic UTXO renderer then reads
// `sends[0].from` / `receives[0].to` and shows "unknown". Name the other
// side for what it is.
export function normalizeZcashBackendHistoryTx(
  tx: IOnChainHistoryTx,
): IOnChainHistoryTx {
  const sends = tx.sends ?? [];
  const receives = tx.receives ?? [];
  if (tx.type === EOnChainHistoryTxType.Receive && sends.length === 0) {
    return {
      ...tx,
      from: tx.from || SHIELDED_COUNTERPARTY_LABEL,
      sends: [shieldedCounterparty(tx.value ?? '0')],
    };
  }
  if (
    tx.type === EOnChainHistoryTxType.Send &&
    receives.every((receive) => receive.isOwn)
  ) {
    return {
      ...tx,
      to: tx.to || SHIELDED_COUNTERPARTY_LABEL,
      receives: [...receives, shieldedCounterparty(tx.value ?? '0')],
    };
  }
  return tx;
}

export async function fetchCompleteZcashBackendHistory({
  fetchPage,
  buildPage,
  maxItems = 20_000,
  pageSize = 500,
}: {
  fetchPage: (params: {
    limit: number;
    maxTimestampMs?: number;
  }) => Promise<IFetchAccountHistoryResp>;
  buildPage: (params: {
    page: IFetchAccountHistoryResp;
    indexOffset: number;
  }) => Promise<(IAccountHistoryTx | null)[]>;
  maxItems?: number;
  pageSize?: number;
}): Promise<{ txs: IAccountHistoryTx[]; snapshotComplete: boolean }> {
  const txs: IAccountHistoryTx[] = [];
  let maxTimestampMs: number | undefined;
  let snapshotComplete = false;
  let processedItems = 0;
  let hasBuildFailures = false;

  while (processedItems < maxItems) {
    const requestedLimit = Math.min(pageSize, maxItems - processedItems);
    // eslint-disable-next-line no-await-in-loop
    const page = await fetchPage({
      limit: requestedLimit,
      maxTimestampMs,
    });
    // eslint-disable-next-line no-await-in-loop
    const built = await buildPage({ page, indexOffset: processedItems });
    processedItems += page.data.length;
    if (built.length !== page.data.length || built.some((tx) => !tx)) {
      hasBuildFailures = true;
    }
    txs.push(
      ...built
        .filter((tx): tx is IAccountHistoryTx => !!tx)
        .map((tx) => ({
          ...tx,
          // This source is queried by the account's transparent receiver.
          // Until the local scan sees the same txid and supplies exact pool
          // involvement, it must not leak into every shielded pool tab.
          privacyChainHistoryPoolIds: [0],
          privacyChainHistorySide: 'public' as const,
        })),
    );

    if (!page.hasMore) {
      snapshotComplete =
        !hasBuildFailures && page.data.length <= requestedLimit;
      break;
    }
    if (page.data.length === 0) {
      break;
    }
    if (
      !isHistoryCursorAdvanced(maxTimestampMs?.toString(), page.next, {
        indexerTimestampCursor: true,
      })
    ) {
      break;
    }
    const next = Number(page.next);
    if (!Number.isFinite(next)) {
      break;
    }
    maxTimestampMs = next;
  }

  return { txs: txs.slice(0, maxItems), snapshotComplete };
}
