import { zatoshiToZec } from '@onekeyhq/core/src/chains/zcash/sdkZcash/amount';
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

import type { IEncodedTxZcash } from './types';

function getLocalTransparentPayment({
  txid,
  networkId,
  localTx,
}: {
  txid: string;
  networkId: string;
  localTx?: IAccountHistoryTx;
}) {
  const local = localTx?.decodedTx;
  const encoded = local?.encodedTx as IEncodedTxZcash | undefined;
  const feeZat = String(encoded?.fee);
  // The send path sets this existing marker after matching the signed result.
  // Reuse its compact payment fields rather than retaining signed bytes here.
  if (
    localTx?.privacyChainHistorySide !== 'public' ||
    localTx.isLocalCreated !== true ||
    networkId !== 'zec--0' ||
    local?.networkId !== networkId ||
    local?.txid.toLowerCase() !== txid.toLowerCase() ||
    encoded?.zcashMode !== 'transparent' ||
    !encoded.zcashTo ||
    !/^(0|[1-9][0-9]*)$/.test(encoded.zcashAmountValue) ||
    !/^(0|[1-9][0-9]*)$/.test(feeZat)
  ) {
    return undefined;
  }
  return {
    local,
    encoded,
    amount: zatoshiToZec(encoded.zcashAmountValue),
    fee: zatoshiToZec(feeZat),
  };
}

// Rows rebuilt from this device's signed payment; normalizing them again
// would read our own output as change.
const locallyRestoredRows = new WeakSet<IOnChainHistoryTx>();

export function restoreZcashLocalTransparentPayment({
  tx,
  localTx,
  withUTXOs = false,
}: {
  tx: IOnChainHistoryTx;
  localTx?: IAccountHistoryTx;
  withUTXOs?: boolean;
}): IOnChainHistoryTx {
  const payment = getLocalTransparentPayment({
    txid: tx.tx,
    networkId: tx.networkId,
    localTx,
  });
  if (!payment) return tx;
  const { local, encoded, amount, fee } = payment;
  const from = tx.from || local.signer || local.owner;
  const to = encoded.zcashTo;
  const transfer = {
    type: EOnChainHistoryTransferType.Transfer,
    from,
    to,
    token: '',
    key: `${tx.networkId}_`,
    amount,
    label: '',
    isNative: true,
  };
  // The indexer sees only the transparent debit, which can include the fee.
  // Keep the payment verified at signing; raw I/O remains the indexer's data.
  const restored: IOnChainHistoryTx = {
    ...tx,
    type: EOnChainHistoryTxType.Send,
    from,
    to,
    shieldedCounterparty: undefined,
    value: amount,
    gasFee: fee,
    gasFeeFiatValue: tx.gasFee === fee ? tx.gasFeeFiatValue : '',
    ...(withUTXOs
      ? {}
      : {
          sends: [{ ...transfer, isOwn: true }],
          receives: [{ ...transfer, isOwn: from === to }],
        }),
  };
  locallyRestoredRows.add(restored);
  return restored;
}

export function mergeZcashLocalTransparentPayment({
  localTx,
  onChainHistoryTx,
}: {
  localTx: IAccountHistoryTx;
  onChainHistoryTx: IAccountHistoryTx;
}): IAccountHistoryTx {
  const next = onChainHistoryTx.decodedTx;
  if (
    (onChainHistoryTx.privacyChainHistorySide !== undefined &&
      onChainHistoryTx.privacyChainHistorySide !== 'public') ||
    localTx.decodedTx.accountId !== next.accountId
  ) {
    return onChainHistoryTx;
  }
  const payment = getLocalTransparentPayment({
    txid: next.txid,
    networkId: next.networkId,
    localTx,
  });
  if (!payment) return onChainHistoryTx;
  const { local, encoded, amount, fee } = payment;
  const publicEncoded: IEncodedTxZcash = {
    ...encoded,
    zcashMemoHex: undefined,
    zcashTransparentBuild: undefined,
  };
  const price = next.actions
    .flatMap((action) => [
      ...(action.assetTransfer?.sends ?? []),
      ...(action.assetTransfer?.receives ?? []),
    ])
    .find(
      (transfer) => transfer.isNative && transfer.price !== undefined,
    )?.price;
  return {
    ...onChainHistoryTx,
    isLocalCreated: true,
    privacyChainHistorySide: 'public',
    privacyChainHistoryPoolIds: [0],
    decodedTx: {
      ...next,
      to: encoded.zcashTo,
      nativeAmount: amount,
      nativeAmountValue: encoded.zcashAmountValue,
      nativeAmountIsUnknown: false,
      totalFeeInNative: fee,
      totalFeeFiatValue:
        next.totalFeeInNative === fee ? next.totalFeeFiatValue : undefined,
      encodedTx: publicEncoded,
      payload: next.payload ? { ...next.payload, value: amount } : next.payload,
      actions: local.actions.map((action) =>
        action.assetTransfer && price !== undefined
          ? {
              ...action,
              assetTransfer: {
                ...action.assetTransfer,
                sends: action.assetTransfer.sends.map((transfer) =>
                  transfer.isNative ? { ...transfer, price } : transfer,
                ),
                receives: action.assetTransfer.receives.map((transfer) =>
                  transfer.isNative ? { ...transfer, price } : transfer,
                ),
              },
            }
          : action,
      ),
    },
  };
}

function shieldedCounterparty(amount: string): IOnChainHistoryTxTransfer {
  return {
    type: EOnChainHistoryTransferType.Shielded,
    address: '',
    from: '',
    to: '',
    token: '',
    key: '',
    amount,
    label: '',
    isNative: true,
    isOwn: false,
  };
}

// The indexer only sees the transparent leg. A receive with no inputs it can
// attribute (money arriving from a shielded pool) comes back with `sends: []`
// and an empty `from`; a send whose outputs all went shielded comes back
// with no external receive. The generic UTXO renderer then reads
// `sends[0].from` / `receives[0].to` and shows "unknown". Add the shielded
// side as an entry; it has no address, so the tx marks that side instead.
export function normalizeZcashBackendHistoryTx(
  tx: IOnChainHistoryTx,
): IOnChainHistoryTx {
  if (locallyRestoredRows.has(tx)) return tx;
  const sends = tx.sends ?? [];
  const receives = tx.receives ?? [];
  if (tx.type === EOnChainHistoryTxType.Receive && sends.length === 0) {
    return {
      ...tx,
      ...(tx.from ? {} : { shieldedCounterparty: 'from' as const }),
      sends: [shieldedCounterparty(tx.value ?? '0')],
    };
  }
  if (
    tx.type === EOnChainHistoryTxType.Send &&
    receives.every((receive) => receive.isOwn)
  ) {
    // Change returns to the sending t1, so an indexer row "to" itself paid a
    // shielded address (a true t1 -> same t1 transfer reads the same way).
    const to = tx.to === tx.from ? '' : tx.to;
    return {
      ...tx,
      to,
      ...(to ? {} : { shieldedCounterparty: 'to' as const }),
      receives: [...receives, shieldedCounterparty(tx.value ?? '0')],
    };
  }
  return tx;
}

// Carries the indexer row's shielded side onto the built history action.
export function markZcashBackendShieldedCounterparty({
  onChainHistoryTx,
  historyTx,
}: {
  onChainHistoryTx: IOnChainHistoryTx;
  historyTx: IAccountHistoryTx;
}) {
  const transfer = historyTx.decodedTx.actions[0]?.assetTransfer;
  if (!transfer) return;
  if (onChainHistoryTx.shieldedCounterparty === 'from') {
    transfer.shieldedFrom = {};
  } else if (onChainHistoryTx.shieldedCounterparty === 'to') {
    transfer.shieldedTo = {};
  }
}

export const ZCASH_BACKEND_HISTORY_PAGE_SIZE = 500;

export async function fetchCompleteZcashBackendHistory({
  fetchPage,
  buildPage,
  maxItems = 20_000,
  pageSize = ZCASH_BACKEND_HISTORY_PAGE_SIZE,
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
