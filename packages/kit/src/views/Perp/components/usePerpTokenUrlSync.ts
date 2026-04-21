import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import { useSpotActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { PERPS_ROUTE_PATH } from '@onekeyhq/shared/src/consts/perp';
import {
  DEX_PREFIXES,
  DEX_SEPARATOR,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';

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

function getInstrumentFromUrl(): {
  coin: string;
  mode: 'perp' | 'spot';
} | null {
  try {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const urlToken = searchParams.get('token')?.trim();
    if (!urlToken) return null;
    const mode = searchParams.get('mode') === 'spot' ? 'spot' : 'perp';

    return {
      coin: decodeCoinFromUrl(urlToken),
      mode,
    };
  } catch {
    return null;
  }
}

function updateUrlWithoutNavigation(params: {
  coin: string;
  mode: 'perp' | 'spot';
}): void {
  try {
    const encoded = encodeCoinForUrl(params.coin);
    const searchParams = new URLSearchParams();
    if (params.mode === 'spot') {
      searchParams.set('mode', 'spot');
    }
    searchParams.set('token', encoded);
    const newUrl = `${PERPS_ROUTE_PATH}?${searchParams.toString()}`;
    setTimeout(() => {
      try {
        globalThis.history.replaceState(null, '', newUrl);
      } catch {
        // ignore
      }
    }, 0);
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
  const isFocused = useIsFocused();
  const actions = useHyperliquidActions();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const { displayName } = useActiveTradeDisplay();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeSpotAssetCtx] = useSpotActiveAssetCtxAtom();
  const isInitializedRef = useRef(false);
  const originalTitleRef = useRef<string>('');

  const symbolDisplay = useMemo(() => displayName || '', [displayName]);

  const markPrice = useMemo(() => {
    const price =
      activeTradeInstrument.mode === 'spot'
        ? activeSpotAssetCtx?.ctx?.markPrice || ''
        : activeAssetCtx?.ctx?.markPrice || '';
    return isValidPrice(price) ? price : '';
  }, [
    activeAssetCtx?.ctx?.markPrice,
    activeSpotAssetCtx?.ctx?.markPrice,
    activeTradeInstrument.mode,
  ]);

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
    if (isInitializedRef.current || !isFocused) return;

    originalTitleRef.current = globalThis.document.title;

    void (async () => {
      const urlInstrument = getInstrumentFromUrl();
      if (urlInstrument) {
        await actions.current.switchTradeInstrument(urlInstrument);
      }
      isInitializedRef.current = true;
    })();

    return () => {
      globalThis.document.title = originalTitleRef.current;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => {
    if (!isInitializedRef.current || !isFocused) return;

    const currentToken = activeTradeInstrument?.coin?.trim();
    if (!currentToken) return;

    updateUrlWithoutNavigation({
      coin: currentToken,
      mode: activeTradeInstrument.mode,
    });
  }, [activeTradeInstrument, isFocused]);

  useEffect(() => {
    if (!isInitializedRef.current || !isFocused) return;
    debouncedUpdateTitle(markPrice);
  }, [markPrice, symbolDisplay, debouncedUpdateTitle, isFocused]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (!isFocused) {
      globalThis.document.title = originalTitleRef.current;
    }
  }, [isFocused]);
}
