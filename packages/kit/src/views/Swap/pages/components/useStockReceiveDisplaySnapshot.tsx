import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

import type { ISwapPreSwapData } from '@onekeyhq/shared/types/swap/types';

export type IStockReceiveDisplayValue = {
  currencySymbol: string;
  rateDifference: ISwapPreSwapData['rateDifference'];
  receiveAmount: string;
  receiveFiatValue: string;
  receiveTokenSymbol: string;
  estimatedShares?: string;
  stockUnderlyingSymbol: string;
  shouldShowEstimatedShares: boolean;
};

type IStockReceiveSnapshot = {
  scope: string;
  value: IStockReceiveDisplayValue;
};

const StockReceiveSnapshotContext = createContext<
  RefObject<IStockReceiveSnapshot | undefined> | undefined
>(undefined);

export function StockReceiveSnapshotProvider({
  children,
}: {
  children: ReactNode;
}) {
  const snapshotRef = useRef<IStockReceiveSnapshot | undefined>(undefined);
  return (
    <StockReceiveSnapshotContext.Provider value={snapshotRef}>
      {children}
    </StockReceiveSnapshotContext.Provider>
  );
}

export function useStockReceiveDisplaySnapshot({
  canSave,
  hideQuote,
  isLoading,
  invalidate = false,
  scope,
  value,
}: {
  canSave: boolean;
  hideQuote: boolean;
  isLoading: boolean;
  invalidate?: boolean;
  scope?: string;
  value: IStockReceiveDisplayValue;
}): IStockReceiveDisplayValue | undefined {
  const localSnapshotRef = useRef<IStockReceiveSnapshot | undefined>(undefined);
  const loadingScopeRef = useRef<string | undefined>(undefined);
  const sharedSnapshotRef = useContext(StockReceiveSnapshotContext);
  const snapshotRef = sharedSnapshotRef ?? localSnapshotRef;
  const finishedWithoutResult = Boolean(
    scope && !isLoading && !canSave && loadingScopeRef.current === scope,
  );
  useEffect(() => {
    // An unresolved scope cannot identify what to invalidate.
    if (scope && snapshotRef.current?.scope !== scope) {
      snapshotRef.current = undefined;
    }
    if (scope && (hideQuote || invalidate || finishedWithoutResult)) {
      snapshotRef.current = undefined;
    }
    if (!isLoading && scope && canSave && !hideQuote && !invalidate) {
      snapshotRef.current = { scope, value };
    }
    if (isLoading && scope) {
      loadingScopeRef.current = scope;
    } else if (
      !scope ||
      canSave ||
      finishedWithoutResult ||
      hideQuote ||
      invalidate
    ) {
      loadingScopeRef.current = undefined;
    }
  }, [
    canSave,
    finishedWithoutResult,
    hideQuote,
    invalidate,
    isLoading,
    scope,
    snapshotRef,
    value,
  ]);
  return (isLoading || !canSave) &&
    !hideQuote &&
    !invalidate &&
    !finishedWithoutResult &&
    scope &&
    snapshotRef.current?.scope === scope
    ? snapshotRef.current.value
    : undefined;
}
