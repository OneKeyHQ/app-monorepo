import { type ReactNode, useLayoutEffect, useRef } from 'react';

import {
  useSwapActions,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { getVisibleSwapTabSwitchType } from '../../utils/swapTypeUtils';

export function SwapInitialStockTypeGate({
  children,
  initialSwapType,
}: {
  children: ReactNode;
  initialSwapType?: ESwapTabSwitchType;
}) {
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
  const { networkId } = useSwapAddressInfo(ESwapDirectionType.FROM);
  const initialTargetRef = useRef(
    getVisibleSwapTabSwitchType(initialSwapType) === ESwapTabSwitchType.STOCK
      ? ESwapTabSwitchType.STOCK
      : undefined,
  );
  const initialTargetResolvedRef = useRef(
    !initialTargetRef.current || swapTypeSwitch === initialTargetRef.current,
  );
  const initialSwitchStartedRef = useRef(false);
  const initialTarget = initialTargetRef.current;

  if (swapTypeSwitch === initialTarget) {
    initialTargetResolvedRef.current = true;
  }

  const shouldGate = Boolean(
    initialTarget &&
    !initialTargetResolvedRef.current &&
    swapTypeSwitch !== initialTarget,
  );

  useLayoutEffect(() => {
    if (!shouldGate || !initialTarget || initialSwitchStartedRef.current) {
      return;
    }
    initialSwitchStartedRef.current = true;
    void swapTypeSwitchAction(initialTarget, networkId);
  }, [initialTarget, networkId, shouldGate, swapTypeSwitchAction]);

  return shouldGate ? null : children;
}
