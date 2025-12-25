import { useEffect, useMemo, useRef } from 'react';

import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import { PERPS_ROUTE_PATH } from '@onekeyhq/shared/src/consts/perp';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  DEX_PREFIXES,
  DEX_SEPARATOR,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

function findDexPrefix(token: string): string | null {
  const lowerToken = token.toLowerCase();
  return DEX_PREFIXES.find((prefix) => lowerToken.startsWith(prefix)) ?? null;
}

function encodeCoinForUrl(coin: string): string {
  if (!coin) return '';

  const dexPrefix = findDexPrefix(coin);
  if (dexPrefix && coin.includes(DEX_SEPARATOR)) {
    const symbol = coin.slice(dexPrefix.length + DEX_SEPARATOR.length);
    return `${dexPrefix}${symbol.toUpperCase()}`;
  }

  return coin.toUpperCase();
}

function decodeCoinFromUrl(urlToken: string): string {
  if (!urlToken) return '';

  const dexPrefix = findDexPrefix(urlToken);
  if (dexPrefix && urlToken.length > dexPrefix.length) {
    const hasNoSeparator = !urlToken.includes(DEX_SEPARATOR);
    const symbolStartIndex = hasNoSeparator
      ? dexPrefix.length
      : dexPrefix.length + DEX_SEPARATOR.length;
    const symbol = urlToken.slice(symbolStartIndex);
    return `${dexPrefix}${DEX_SEPARATOR}${symbol.toUpperCase()}`;
  }

  return urlToken.toUpperCase();
}

function getTokenFromUrl(): string | null {
  try {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const urlToken = searchParams.get('token')?.trim();
    if (!urlToken) return null;

    return decodeCoinFromUrl(urlToken);
  } catch {
    return null;
  }
}

function updateUrlWithoutNavigation(token: string): void {
  try {
    const encoded = encodeCoinForUrl(token);
    const newUrl = `${PERPS_ROUTE_PATH}?token=${encoded}`;
    globalThis.history.replaceState(null, '', newUrl);
  } catch {
    // ignore
  }
}

function isValidPrice(price: string): boolean {
  if (!price || price === '0') return false;
  const priceNum = parseFloat(price);
  return Number.isFinite(priceNum) && priceNum > 0;
}

export function usePerpTokenUrlSync(): void {
  const actions = useHyperliquidActions();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const isInitializedRef = useRef(false);
  const lastSyncedTokenRef = useRef('');
  const originalTitleRef = useRef<string>('');

  const symbolDisplay = useMemo(() => {
    if (!activeAsset?.coin) return '';
    const { displayName, dexLabel } = parseDexCoin(activeAsset.coin);
    return dexLabel ? `${displayName} (${dexLabel})` : displayName;
  }, [activeAsset?.coin]);

  const markPrice = useMemo(() => {
    const price = activeAssetCtx?.ctx?.markPrice || '';
    return isValidPrice(price) ? price : '';
  }, [activeAssetCtx?.ctx?.markPrice]);

  const updateTitle = (price: string) => {
    try {
      if (!price || !symbolDisplay) {
        globalThis.document.title = originalTitleRef.current;
        return;
      }
      globalThis.document.title = `${price} | ${symbolDisplay} | OneKey`;
    } catch {
      // ignore
    }
  };

  const debouncedUpdateTitle = useDebouncedCallback(updateTitle, 200);

  useEffect(() => {
    if (isInitializedRef.current) return;

    originalTitleRef.current = globalThis.document.title;

    void (async () => {
      const urlToken = getTokenFromUrl();
      if (urlToken) {
        lastSyncedTokenRef.current = urlToken;
        await actions.current.changeActiveAsset({ coin: urlToken });
      }
      isInitializedRef.current = true;
    })();

    return () => {
      globalThis.document.title = originalTitleRef.current;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;

    const currentToken = activeAsset?.coin?.trim();
    if (!currentToken || currentToken === lastSyncedTokenRef.current) return;

    lastSyncedTokenRef.current = currentToken;
    updateUrlWithoutNavigation(currentToken);
  }, [activeAsset?.coin]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    debouncedUpdateTitle(markPrice);
  }, [markPrice, symbolDisplay, debouncedUpdateTitle]);
}
