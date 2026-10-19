// History reconciliation for privacy chains: merges by ownership, not freshness. The local scan owns
// row shape/private metadata (only it sees the private leg); the indexer fills gaps and can promote a row.

import BigNumber from 'bignumber.js';

import type {
  IAccountHistoryTx,
  IPrivacyChainHistorySide,
} from '../../types/history';
import type { EDecodedTxStatus } from '../../types/tx';

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
  return tx.decodedTx.txid || tx.id;
}

// Current snapshot wins every collision; an old cache must never enrich a row with stale state.
export function appendMissingPrivacyChainHistoryTxs<
  T extends IPrivacyChainMergeableTx,
>({ currentTxs, cachedTxs }: { currentTxs: T[]; cachedTxs: T[] }): T[] {
  const result = [...currentTxs];
  const keys = new Set(
    currentTxs.map(getPrivacyChainHistoryKey).filter((key) => !!key),
  );
  for (const cachedTx of cachedTxs) {
    const key = getPrivacyChainHistoryKey(cachedTx);
    if (!key || !keys.has(key)) {
      result.push(cachedTx);
      if (key) {
        keys.add(key);
      }
    }
  }
  return result;
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
  if (
    transfer.from &&
    transfer.from === transfer.to &&
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
  const nativeAmountIsUnknown =
    isSend &&
    tx.decodedTx.nativeAmountIsUnknown === true &&
    tx.decodedTx.totalFeeInNative === undefined;
  const amount = nativeAmountIsUnknown
    ? '0'
    : (isSend && feeBN.isFinite() && feeBN.gt(0) && deltaBN.abs().gte(feeBN)
        ? deltaBN.abs().minus(feeBN)
        : deltaBN.abs()
      ).toFixed();
  const template = isSend
    ? (transfer.sends[0] ?? transfer.receives[0])
    : (transfer.receives[0] ?? transfer.sends[0]);
  if (!template) return tx;
  // Seen from a shielded pool, the indexer's public-leg row points the other way.
  const owner = tx.decodedTx.owner ?? '';
  let endpoints: { from: string; to: string; isOwn: undefined } | undefined;
  if (isPublicBackedRow && isSend) {
    endpoints = {
      from: owner,
      to: transfer.to || template.to,
      isOwn: undefined,
    };
  } else if (isPublicBackedRow) {
    endpoints = {
      from: transfer.from || template.from,
      to: owner,
      isOwn: undefined,
    };
  }
  const projectedTransfer = { ...template, ...endpoints, amount };

  return {
    ...tx,
    decodedTx: {
      ...tx.decodedTx,
      nativeAmount: amount,
      nativeAmountIsUnknown,
      actions: [
        {
          ...action,
          assetTransfer: {
            ...transfer,
            sends: isSend ? [projectedTransfer] : [],
            receives: isReceive ? [projectedTransfer] : [],
          },
        },
        ...tx.decodedTx.actions.slice(1),
      ],
    },
  };
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
          publicTx.decodedTx.totalFeeInNative ??
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

// Gates whether the reconciler may delete cached rows absent from this snapshot. Claiming
// complete while the public half is failing would delete rows that half supplied earlier.
export function isPrivacyChainHistoryComplete({
  privateSideComplete,
  publicSideFailed,
}: {
  privateSideComplete: boolean;
  publicSideFailed: boolean;
}): boolean {
  return privateSideComplete && !publicSideFailed;
}
