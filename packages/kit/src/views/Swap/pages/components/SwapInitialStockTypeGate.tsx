import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import {
  useSwapActions,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { getVisibleSwapTabSwitchType } from '../../utils/swapTypeUtils';

function logInitialStockTypeSwitchError(error: unknown) {
  defaultLogger.app.error.log(
    `swap_initialStockType_switchError: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

function StockInitialTypeGate({ children }: { children: ReactNode }) {
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
  const { networkId } = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [initialSwitchFailed, setInitialSwitchFailed] = useState(false);
  const initialTargetResolvedRef = useRef(
    swapTypeSwitch === ESwapTabSwitchType.STOCK,
  );
  const initialSwitchStartedRef = useRef(false);

  if (swapTypeSwitch === ESwapTabSwitchType.STOCK) {
    initialTargetResolvedRef.current = true;
  }

  const shouldGate =
    !initialTargetResolvedRef.current &&
    !initialSwitchFailed &&
    swapTypeSwitch !== ESwapTabSwitchType.STOCK;

  useLayoutEffect(() => {
    if (!shouldGate || initialSwitchStartedRef.current) {
      return;
    }
    initialSwitchStartedRef.current = true;
    try {
      void swapTypeSwitchAction(ESwapTabSwitchType.STOCK, networkId).catch(
        (error) => {
          logInitialStockTypeSwitchError(error);
          setInitialSwitchFailed(true);
        },
      );
    } catch (error) {
      logInitialStockTypeSwitchError(error);
      setInitialSwitchFailed(true);
    }
  }, [networkId, shouldGate, swapTypeSwitchAction]);

  return shouldGate ? null : children;
}

export function SwapInitialStockTypeGate({
  children,
  initialSwapType,
}: {
  children: ReactNode;
  initialSwapType?: ESwapTabSwitchType;
}) {
  const shouldInitializeStockRef = useRef(
    getVisibleSwapTabSwitchType(initialSwapType) === ESwapTabSwitchType.STOCK,
  );

  if (!shouldInitializeStockRef.current) {
    return children;
  }

  return <StockInitialTypeGate>{children}</StockInitialTypeGate>;
}
