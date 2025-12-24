import { useEffect, useRef } from 'react';

import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import { PERPS_ROUTE_PATH } from '@onekeyhq/shared/src/consts/perp';

function getTokenFromUrl(): string | null {
  try {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const token = searchParams.get('token');
    return token && token.trim() ? decodeURIComponent(token.trim()) : null;
  } catch {
    return null;
  }
}

function updateUrlWithoutNavigation(token: string): void {
  try {
    const encoded = encodeURIComponent(token);
    const newUrl = `${PERPS_ROUTE_PATH}?token=${encoded}`;
    globalThis.history.replaceState(null, '', newUrl);
  } catch {
    // ignore
  }
}

export function usePerpTokenUrlSync(): void {
  const actions = useHyperliquidActions();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const isInitializedRef = useRef(false);
  const lastSyncedTokenRef = useRef('');

  const debouncedUpdateUrl = useDebouncedCallback((token: string) => {
    if (token && token !== lastSyncedTokenRef.current) {
      lastSyncedTokenRef.current = token;
      updateUrlWithoutNavigation(token);
    }
  }, 100);

  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }

    void (async () => {
      const urlToken = getTokenFromUrl();
      if (urlToken) {
        lastSyncedTokenRef.current = urlToken;
        await actions.current.changeActiveAsset({ coin: urlToken });
      }
      isInitializedRef.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) {
      return;
    }

    const currentToken = activeAsset?.coin?.trim();
    if (!currentToken) {
      return;
    }

    debouncedUpdateUrl(currentToken);
  }, [activeAsset?.coin, debouncedUpdateUrl]);
}
