import BigNumber from 'bignumber.js';

import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { hasPositiveBorrowBalance } from './borrowRepayPosition.utils';

export type IBorrowPositionKind = 'supplied' | 'borrowed';

export type IBorrowPositionSortable = {
  kind: IBorrowPositionKind;
  fiatValue?: string;
};

const KIND_RANK: Record<IBorrowPositionKind, number> = {
  borrowed: 0,
  supplied: 1,
};

const toWeight = (fiatValue?: string) => {
  const value = new BigNumber(fiatValue ?? 0);
  return value.isFinite() ? value : new BigNumber(0);
};

export function sortBorrowPositions<T extends IBorrowPositionSortable>(
  entries: T[],
): T[] {
  return entries.toSorted((a, b) => {
    const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (byKind !== 0) {
      return byKind;
    }
    return toWeight(b.fiatValue).comparedTo(toWeight(a.fiatValue)) ?? 0;
  });
}

type ISuppliedAsset = IBorrowReserveItem['supplied']['assets'][number];
type IBorrowedAsset = IBorrowReserveItem['borrowed']['assets'][number];

export type IBorrowPositionEntry =
  | { kind: 'supplied'; fiatValue?: string; asset: ISuppliedAsset }
  | { kind: 'borrowed'; fiatValue?: string; asset: IBorrowedAsset };

export function buildBorrowPositionEntries({
  suppliedAssets,
  borrowedAssets,
}: {
  suppliedAssets?: ISuppliedAsset[];
  borrowedAssets?: IBorrowedAsset[];
}): IBorrowPositionEntry[] {
  const supplied = (suppliedAssets ?? [])
    .filter((asset) => hasPositiveBorrowBalance(asset.suppliedAmount))
    .map<IBorrowPositionEntry>((asset) => ({
      kind: 'supplied',
      fiatValue: asset.suppliedAmount.fiatValue,
      asset,
    }));

  const borrowed = (borrowedAssets ?? [])
    .filter((asset) => hasPositiveBorrowBalance(asset.borrowedAmount))
    .map<IBorrowPositionEntry>((asset) => ({
      kind: 'borrowed',
      fiatValue: asset.borrowedAmount.fiatValue,
      asset,
    }));

  return sortBorrowPositions([...supplied, ...borrowed]);
}
