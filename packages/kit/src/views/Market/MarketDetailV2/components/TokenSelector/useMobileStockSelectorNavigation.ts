import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';

export function useMobileStockSelectorNavigation({
  navigate,
  requestIdRef,
  closeSelector,
  onError,
}: {
  navigate: ReturnType<typeof useToMarketStockDetailPage>;
  requestIdRef: RefObject<number>;
  closeSelector: () => void;
  onError: () => void;
}) {
  const pendingRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Navigation can dismiss this selector before opening the target detail.
      mountedRef.current = false;
    };
  }, []);

  return useCallback(
    (stock: IMarketStockPublicItem) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      const isCurrentRequest = () => requestIdRef.current === requestId;
      dismissMobileTokenSelectorKeyboard();
      // Replace the detail while the selector still exposes the tab stack.
      void navigate(stock, { isCurrentRequest })
        .then((didNavigate) => {
          if (didNavigate && isCurrentRequest() && mountedRef.current) {
            closeSelector();
          }
        })
        .catch(() => {
          if (isCurrentRequest() && mountedRef.current) onError();
        })
        .finally(() => {
          pendingRef.current = false;
        });
    },
    [closeSelector, navigate, onError, requestIdRef],
  );
}
