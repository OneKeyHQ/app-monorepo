// History reconciliation for privacy chains.
//
// A privacy chain's account has two halves. The PUBLIC half is visible to any
// indexer (Zcash transparent; an L1 settlement leg; nothing at all on a fully
// shielded chain). The PRIVATE half exists only in the local scan, because the
// chain does not publish it -- that is the whole point of the chain.
//
// The two halves overlap: a local scanner that also covers the public half
// reports the same transaction an indexer does, and a single transaction can
// touch both halves at once (a shielding transfer has public inputs and
// private outputs). So merging cannot be "newest wins" or "whoever answered
// first" -- it has to be ownership:
//
//   The local scan owns the row shape and private metadata. The indexer fills
//   gaps and can promote a locally-pending row to a terminal chain status.
//
// The reason is not freshness, it is visibility: for a transaction both sides
// know about, only the local scan can see its private leg. The indexer's value
// is latency and confirmation state -- it answers immediately, while a client
// scan may be minutes or hours behind.

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

// Keeps the current snapshot authoritative for every collision and only
// carries rows that are absent while a partial refresh is still in progress.
// This is intentionally different from merging scanner + indexer data: an old
// UI cache must never enrich a new row with stale pool or confirmation state.
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
  // Unknown covers cached rows written by an older app/runtime. Showing them
  // on both sides is safer than hiding real history until the next refresh.
  return (
    !selectedSide || !txSide || txSide === 'mixed' || txSide === selectedSide
  );
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

  const deltaBN = new BigNumber(delta);
  if (!deltaBN.isFinite()) return tx;
  const isZero = deltaBN.isZero();
  const isReceive =
    deltaBN.isGreaterThan(0) ||
    (isZero && transfer.receives.length > 0 && transfer.sends.length === 0);
  const isSend = deltaBN.isLessThan(0) || (isZero && !isReceive);
  // The pool that paid the fee sees it in its delta; the row shows the
  // transferred amount and lists the fee separately, like every other chain.
  const feeBN = new BigNumber(tx.decodedTx.totalFeeInNative ?? 0);
  const amount = (
    isSend && feeBN.isFinite() && feeBN.gt(0) && deltaBN.abs().gt(feeBN)
      ? deltaBN.abs().minus(feeBN)
      : deltaBN.abs()
  ).toFixed();
  const template = isSend
    ? (transfer.sends[0] ?? transfer.receives[0])
    : (transfer.receives[0] ?? transfer.sends[0]);
  if (!template) return tx;
  // A row the indexer built describes the public leg (own transparent
  // address on one end, a shielded placeholder on the other). Seen from a
  // shielded pool the same transaction points the other way: money leaving
  // the pool lands on the transparent address, money entering came from it.
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
      nativeAmountIsUnknown: false,
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

// The indexer owns the public (transparent) half outright. A privacy-chain
// account's transparent history, detail and transfers come from the backend
// and nothing else; the local scan contributes only what the indexer cannot
// see -- shielded pools -- and never a transparent row of its own.
//
//   txid the indexer knows   -> the indexer row is the row. The local scan may
//                              attach its shielded pool ids/deltas so the
//                              shielded tabs can project the same tx.
//   txid the indexer lacks   -> the local row, with any transparent pool
//                              involvement stripped; if nothing shielded is
//                              left the row is dropped (a transparent tx the
//                              indexer has not reached yet is not ours to show).
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

// A snapshot may only be presented as complete when BOTH halves answered.
//
// Callers use this to decide whether the generic reconciler is allowed to
// delete cached rows that are absent from this snapshot. Claiming completeness
// while the public half is failing would delete exactly the rows that half had
// supplied on an earlier refresh -- the account would appear to lose history
// whenever an indexer had a bad minute.
export function isPrivacyChainHistoryComplete({
  privateSideComplete,
  publicSideFailed,
}: {
  privateSideComplete: boolean;
  publicSideFailed: boolean;
}): boolean {
  return privateSideComplete && !publicSideFailed;
}
