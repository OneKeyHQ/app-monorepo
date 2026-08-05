import { useMemo } from 'react';

import { useBorrowContext } from '../BorrowProvider';
import { buildBorrowPositionEntries } from '../components/borrowMobilePositions.utils';

import type { IBorrowPositionEntry } from '../components/borrowMobilePositions.utils';

export function useBorrowPositionEntries(): IBorrowPositionEntry[] {
  const { reserves } = useBorrowContext();

  return useMemo(
    () =>
      buildBorrowPositionEntries({
        suppliedAssets: reserves.data?.supplied?.assets,
        borrowedAssets: reserves.data?.borrowed?.assets,
      }),
    [reserves.data?.borrowed?.assets, reserves.data?.supplied?.assets],
  );
}
