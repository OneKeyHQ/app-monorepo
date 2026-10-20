import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { shouldRedirectOnboardingToTravelMode } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { resolveSwapStockSelectionToken } from '../utils/swapStockMarketData';

import { getTokenIdentityKey } from './swapStockChannelUtils';

export function useSwapMarketDetailToken({
  token,
  onOpen,
}: {
  token?: ISwapToken;
  onOpen: (resolvedToken: ISwapToken) => void | Promise<void>;
}) {
  const intl = useIntl();
  const isMounted = useIsMounted();
  const isFocused = useRouteIsFocused();
  const tokenKey = getTokenIdentityKey(token);
  const scopeRef = useRef({ tokenKey, isFocused });
  scopeRef.current = { tokenKey, isFocused };
  const requestRef = useRef(0);
  const pendingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    requestRef.current += 1;
    pendingRef.current = false;
    setIsLoading(false);
  }, [tokenKey, isFocused]);

  const onOpenMarketDetail = useCallback(async () => {
    if (
      !token ||
      !isFocused ||
      pendingRef.current ||
      shouldRedirectOnboardingToTravelMode()
    ) {
      return;
    }
    requestRef.current += 1;
    const request = requestRef.current;
    pendingRef.current = true;
    setIsLoading(true);
    const isCurrent = () =>
      isMounted.current &&
      request === requestRef.current &&
      scopeRef.current.isFocused &&
      scopeRef.current.tokenKey === tokenKey &&
      !shouldRedirectOnboardingToTravelMode();
    try {
      const resolvedToken = token.isStock
        ? await resolveSwapStockSelectionToken(token)
        : token;
      if (isCurrent()) {
        await onOpen(resolvedToken);
      }
    } catch (_error) {
      if (isCurrent()) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
    } finally {
      if (request === requestRef.current) {
        pendingRef.current = false;
        if (isMounted.current) setIsLoading(false);
      }
    }
  }, [intl, isFocused, isMounted, onOpen, token, tokenKey]);

  return { onOpenMarketDetail, isLoading };
}
