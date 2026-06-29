import { useEffect, useRef } from 'react';

import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

export function useSwapHeaderRouteDefaultSwapType(
  routeDefaultSwapType?: ESwapTabSwitchType,
) {
  const routeDefaultSwapTypeRef = useRef(routeDefaultSwapType);
  const hasProvidedRouteDefaultSwapTypeRef = useRef(false);

  if (routeDefaultSwapTypeRef.current !== routeDefaultSwapType) {
    routeDefaultSwapTypeRef.current = routeDefaultSwapType;
    hasProvidedRouteDefaultSwapTypeRef.current = false;
  }

  const headerDefaultSwapType =
    routeDefaultSwapType && !hasProvidedRouteDefaultSwapTypeRef.current
      ? routeDefaultSwapType
      : undefined;

  useEffect(() => {
    if (routeDefaultSwapType) {
      hasProvidedRouteDefaultSwapTypeRef.current = true;
    }
  }, [routeDefaultSwapType]);

  return headerDefaultSwapType;
}
