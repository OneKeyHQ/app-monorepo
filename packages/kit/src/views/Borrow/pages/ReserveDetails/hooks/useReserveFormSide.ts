import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IBorrowReserveFormTab } from '@onekeyhq/shared/src/routes';

import {
  getReserveFormSides,
  getReserveSideStartAmount,
  resolveReserveFormSide,
  withSideInUse,
} from '../components/reserveFormSides';

/**
 * The side the reserve page's form is on. It opens on the side the route
 * asks for; once the account's position is read, a side that doesn't apply
 * falls back to Supply (again for another account). After that the side is
 * the user's: a transaction that ends a supply or a loan leaves the form
 * where it is
 */
export function useReserveFormSide({
  requested,
  amount,
  isReady,
  scopeKey,
  hasSupplied,
  canBorrow,
  hasBorrowed,
}: {
  requested?: IBorrowReserveFormTab;
  amount?: string;
  // The position and the reserve are read, for the account of scopeKey
  isReady: boolean;
  scopeKey: string;
  hasSupplied: boolean;
  canBorrow: boolean;
  hasBorrowed: boolean;
}) {
  const [side, setSide] = useState<IBorrowReserveFormTab>(
    requested ?? 'supply',
  );
  // The route's amount stays with its side until the user picks another
  const [amountSide, setAmountSide] = useState(requested);

  const applicable = useMemo(
    () => getReserveFormSides({ hasSupplied, canBorrow, hasBorrowed }),
    [canBorrow, hasBorrowed, hasSupplied],
  );

  const checkedScopeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!isReady || checkedScopeRef.current === scopeKey) {
      return;
    }
    checkedScopeRef.current = scopeKey;
    setSide((current) =>
      resolveReserveFormSide({ requested: current, sides: applicable }),
    );
  }, [applicable, isReady, scopeKey]);

  // Before the read only Supply is known to apply
  const sides = useMemo(
    () => withSideInUse({ sides: isReady ? applicable : ['supply'], side }),
    [applicable, isReady, side],
  );

  const selectSide = useCallback((next: IBorrowReserveFormTab) => {
    setSide(next);
    setAmountSide(undefined);
  }, []);

  const startAmount = getReserveSideStartAmount({
    side,
    requested: amountSide,
    amount,
  });

  return { side, sides, selectSide, startAmount };
}
