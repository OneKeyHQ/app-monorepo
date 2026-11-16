import { useCallback, useRef } from 'react';

import { useFocusEffect, useIsFocused } from '@react-navigation/core';

import { useVisibleImpression } from '@onekeyhq/kit/src/hooks/useVisibleImpression';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeGiftAnalyticsSource } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';

export function usePrimeGiftOfferImpression({
  enabled,
  serialNo,
  source,
}: {
  enabled: boolean;
  serialNo: string | undefined;
  source: IPrimeGiftAnalyticsSource;
}) {
  const isFocused = useIsFocused();
  const seen = useRef(new Set<string>()).current;
  useFocusEffect(useCallback(() => () => seen.clear(), [seen]));
  return useVisibleImpression({
    impressionKey: enabled && isFocused ? serialNo : undefined,
    seen,
    onShown: () =>
      defaultLogger.prime.subscription.primeGiftOfferShown({ source }),
  });
}
