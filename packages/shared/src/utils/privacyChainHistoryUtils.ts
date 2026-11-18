// History reconciliation for privacy chains: merges by ownership, not freshness. The local scan owns
// row shape/private metadata (only it sees the private leg); the indexer fills gaps and can promote a row.

import BigNumber from 'bignumber.js';

import type {
  IAccountHistoryTx,
  IPrivacyChainHistorySide,
} from '../../types/history';
import type { EDecodedTxStatus, IDecodedTxTransferInfo } from '../../types/tx';

// Pool id the indexer covers (transparent). Everything else is shielded.
export const PRIVACY_CHAIN_PUBLIC_POOL_ID = 0;

type IPrivacyChainMergeableTx = {
  id?: string;
  decodedTx: {
    txid: string;
    status?: EDecodedTxStatus;
    createdAt?: number;
    updatedAt?: number;
    isFinal?: boolean;
    totalFeeInNative?: string;
  };
  privacyChainHistorySide?: IPrivacyChainHistorySide;
  privacyChainHistoryPoolIds?: number[];
};

function getPrivacyChainHistoryKey<T extends IPrivacyChainMergeableTx>(tx: T) {
  return tx.decodedTx.txid?.toLowerCase() || tx.id;
}

export function isPrivacyChainHistoryVisible({
  txPoolIds,
  txSide,
  selectedSide,
  selectedPoolId,
}: {
  txPoolIds?: number[];
  txSide?: IPrivacyChainHistorySide;
  selectedSide?: Exclude<IPrivacyChainHistorySide, 'mixed'>;
  selectedPoolId?: number;
}): boolean {
  if (selectedPoolId !== undefined && !txPoolIds?.length) {
    return false;
  }
  if (txPoolIds?.length) {
    if (selectedPoolId !== undefined) {
      return txPoolIds.includes(selectedPoolId);
    }
    if (selectedSide === 'public') {
      return txPoolIds.includes(0);
    }
    if (selectedSide === 'private') {
      return txPoolIds.some((poolId) => poolId !== 0);
    }
  }
  return !selectedSide || txSide === 'mixed' || txSide === selectedSide;
}

export function projectPrivacyChainHistoryTxToPool({
  tx,
  selectedPoolId,
}: {
  tx: IAccountHistoryTx;
  selectedPoolId?: number;
}): IAccountHistoryTx {
  if (selectedPoolId === undefined) return tx;
  const isPublicBackedRow = !!tx.privacyChainHistoryPoolIds?.includes(
    PRIVACY_CHAIN_PUBLIC_POOL_ID,
  );
  // The indexer already describes the public leg exactly; never rewrite it.
  if (isPublicBackedRow && selectedPoolId === PRIVACY_CHAIN_PUBLIC_POOL_ID) {
    return tx;
  }
  const delta = tx.privacyChainHistoryPoolDeltas?.[String(selectedPoolId)];
  if (delta === undefined) return tx;

  const action = tx.decodedTx.actions[0];
  const transfer = action?.assetTransfer;
  if (!action || !transfer) return tx;
  // A same-pool self-payment has only a fee delta. Its payment amount is
  // already known independently of that delta and must remain intact.
  const shieldedFromPoolId = transfer.shieldedFrom?.poolId;
  const isSamePoolMove =
    !!transfer.shieldedFrom?.isOwn &&
    !!transfer.shieldedTo?.isOwn &&
    shieldedFromPoolId !== undefined &&
    shieldedFromPoolId === transfer.shieldedTo.poolId;
  if (
    (isSamePoolMove || (transfer.from && transfer.from === transfer.to)) &&
    Object.keys(tx.privacyChainHistoryPoolDeltas ?? {}).length === 1
  ) {
    return tx;
  }

  const deltaBN = new BigNumber(delta);
  if (!deltaBN.isFinite()) return tx;
  const isZero = deltaBN.isZero();
  const isReceive =
    deltaBN.isGreaterThan(0) ||
    (isZero && transfer.receives.length > 0 && transfer.sends.length === 0);
  const isSend = deltaBN.isLessThan(0) || (isZero && !isReceive);
  // The pool that paid the fee sees it in its delta; the row lists the fee separately, like every other chain.
  const feeBN = new BigNumber(tx.decodedTx.totalFeeInNative ?? 0);
  const amount = (
    isSend && feeBN.isFinite() && feeBN.gt(0) && deltaBN.abs().gte(feeBN)
      ? deltaBN.abs().minus(feeBN)
      : deltaBN.abs()
  ).toFixed();
  const template = isSend
    ? (transfer.sends[0] ?? transfer.receives[0])
    : (transfer.receives[0] ?? transfer.sends[0]);
  if (!template) return tx;
  // Seen from a shielded pool, the indexer's public-leg row points the other way.
  let endpoints: Partial<IDecodedTxTransferInfo> | undefined;
  // A shielded side has no address; never fill it from the template.
  if (isPublicBackedRow && isSend) {
    endpoints = {
      from: '',
      shieldedFrom: { poolId: selectedPoolId, isOwn: true },
      ...(transfer.shieldedTo
        ? { to: '', shieldedTo: transfer.shieldedTo }
        : { to: transfer.to || template.to }),
      isOwn: undefined,
    };
  } else if (isPublicBackedRow) {
    endpoints = {
      ...(transfer.shieldedFrom
        ? { from: '', shieldedFrom: transfer.shieldedFrom }
        : { from: transfer.from || template.from }),
      to: '',
      shieldedTo: { poolId: selectedPoolId, isOwn: true },
      isOwn: undefined,
    };
  }
  const projectedTransfer = { ...template, ...endpoints, amount };

  return {
    ...tx,
    decodedTx: {
      ...tx.decodedTx,
      nativeAmount: amount,
      actions: [
        {
          ...action,
          assetTransfer: {
            ...transfer,
            ...endpoints,
            sends: isSend ? [projectedTransfer] : [],
            receives: isReceive ? [projectedTransfer] : [],
          },
        },
        ...tx.decodedTx.actions.slice(1),
      ],
    },
  };
}

export type IPrivacyChainHistorySideRow = {
  tx: IAccountHistoryTx;
  // The side's pool, set only on a row split from a tx touching both sides.
  poolId?: number;
  // The history id the private side's row was split from.
  sourceId?: string;
};

// A move between the public and private sides lists once per side, as BTC
// lists a move between two of the account's address types.
export function splitPrivacyChainHistoryTxsBySide(
  txs: IAccountHistoryTx[],
): IPrivacyChainHistorySideRow[] {
  return txs.flatMap((tx): IPrivacyChainHistorySideRow[] => {
    const poolIds = tx.privacyChainHistoryPoolIds ?? [];
    if (!poolIds.includes(PRIVACY_CHAIN_PUBLIC_POOL_ID)) {
      return [{ tx }];
    }
    // Pool codes are upstream's and grow with each newer pool; the newest one with a delta is the
    // private pool the app shows (Zcash: Ironwood over Orchard and Sapling).
    const privatePoolIds = poolIds.filter(
      (poolId) =>
        poolId !== PRIVACY_CHAIN_PUBLIC_POOL_ID &&
        tx.privacyChainHistoryPoolDeltas?.[String(poolId)] !== undefined,
    );
    if (!privatePoolIds.length) {
      return [{ tx }];
    }
    const privatePoolId = Math.max(...privatePoolIds);
    const privateTx = projectPrivacyChainHistoryTxToPool({
      tx,
      selectedPoolId: privatePoolId,
    });
    if (privateTx === tx) {
      return [{ tx }];
    }
    return [
      {
        tx: projectPrivacyChainHistoryTxToPool({
          tx,
          selectedPoolId: PRIVACY_CHAIN_PUBLIC_POOL_ID,
        }),
        poolId: PRIVACY_CHAIN_PUBLIC_POOL_ID,
      },
      {
        tx: { ...privateTx, id: `${tx.id}:${privatePoolId}` },
        poolId: privatePoolId,
        sourceId: tx.id,
      },
    ];
  });
}

// The indexer owns the public half outright; drops the row if nothing shielded remains after stripping it.
function stripPublicPool<T extends IPrivacyChainMergeableTx>(tx: T): T | null {
  const poolIds = (tx.privacyChainHistoryPoolIds ?? []).filter(
    (poolId) => poolId !== PRIVACY_CHAIN_PUBLIC_POOL_ID,
  );
  if (poolIds.length === 0) {
    return null;
  }
  const deltas = (
    tx as { privacyChainHistoryPoolDeltas?: Record<string, string> }
  ).privacyChainHistoryPoolDeltas;
  const strippedDeltas = deltas
    ? Object.fromEntries(
        Object.entries(deltas).filter(
          ([poolId]) => poolId !== String(PRIVACY_CHAIN_PUBLIC_POOL_ID),
        ),
      )
    : undefined;
  return {
    ...tx,
    privacyChainHistoryPoolIds: poolIds,
    privacyChainHistorySide: 'private',
    ...(strippedDeltas
      ? { privacyChainHistoryPoolDeltas: strippedDeltas }
      : {}),
  };
}

export function mergePrivacyChainHistoryTxs<
  T extends IPrivacyChainMergeableTx,
>({
  privateTxs,
  publicTxs,
}: {
  // From the local scan. Shielded pools only.
  privateTxs: T[];
  // From the indexer. Authoritative for every txid it reports.
  publicTxs: T[];
}): T[] {
  const privateByKey = new Map<string, T>();
  for (const tx of privateTxs) {
    const key = getPrivacyChainHistoryKey(tx);
    if (key && !privateByKey.has(key)) {
      privateByKey.set(key, tx);
    }
  }

  const merged: T[] = [];
  const seen = new Set<string>();
  for (const publicTx of publicTxs) {
    const key = getPrivacyChainHistoryKey(publicTx);
    if (key && seen.has(key)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (key) {
      seen.add(key);
    }
    const privateTx = key ? privateByKey.get(key) : undefined;
    if (!privateTx) {
      merged.push(publicTx);
      // eslint-disable-next-line no-continue
      continue;
    }
    const shieldedPoolIds = (privateTx.privacyChainHistoryPoolIds ?? []).filter(
      (poolId) => poolId !== PRIVACY_CHAIN_PUBLIC_POOL_ID,
    );
    const poolIds = Array.from(
      new Set([
        ...(publicTx.privacyChainHistoryPoolIds ?? [
          PRIVACY_CHAIN_PUBLIC_POOL_ID,
        ]),
        ...shieldedPoolIds,
      ]),
    );
    const privateDeltas = (
      privateTx as { privacyChainHistoryPoolDeltas?: Record<string, string> }
    ).privacyChainHistoryPoolDeltas;
    merged.push({
      ...publicTx,
      decodedTx: {
        ...publicTx.decodedTx,
        totalFeeInNative:
          publicTx.decodedTx.totalFeeInNative ||
          privateTx.decodedTx.totalFeeInNative,
      },
      privacyChainHistoryPoolIds: poolIds,
      privacyChainHistorySide: shieldedPoolIds.length > 0 ? 'mixed' : 'public',
      ...(privateDeltas
        ? { privacyChainHistoryPoolDeltas: privateDeltas }
        : {}),
    });
  }

  for (const privateTx of privateTxs) {
    const key = getPrivacyChainHistoryKey(privateTx);
    if (key && seen.has(key)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const stripped = stripPublicPool(privateTx);
    if (!stripped) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (key) {
      seen.add(key);
    }
    merged.push(stripped);
  }

  return merged;
}
