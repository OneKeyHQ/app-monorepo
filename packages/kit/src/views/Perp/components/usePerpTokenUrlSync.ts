import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useSpotActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { PERPS_ROUTE_PATH } from '@onekeyhq/shared/src/consts/perp';
import { isPerpsUniverseCacheComplete } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import { getSpotTokenDisplayName } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { usePerpsActiveAssetCtxDisplay } from '../hooks/usePerpsActiveAssetCtxDisplay';

import {
  SPOT_PAIR_SEPARATOR,
  decodeCoinFromUrl,
  encodeCoinForUrl,
} from './usePerpTokenUrlSync.utils';

async function readCompleteUniverses() {
  const { universesByDex } =
    await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
  return isPerpsUniverseCacheComplete(universesByDex)
    ? universesByDex
    : undefined;
}

// A guessed prefix is only trustworthy once the coin is known to exist.
async function resolvePerpCoinFromUrl(urlToken: string): Promise<string> {
  const { coin, isAmbiguousLegacyGuess, unverifiedFallbackCoin } =
    decodeCoinFromUrl(urlToken);
  if (!isAmbiguousLegacyGuess) {
    return coin;
  }
  try {
    let universesByDex = await readCompleteUniverses();
    if (!universesByDex) {
      // URL resolution runs once, so an incomplete cache would freeze an
      // unverified guess for the whole session. The refresh is single-flight and
      // cold start already starts one, so this joins it instead of adding a
      // request.
      await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
      universesByDex = await readCompleteUniverses();
    }
    // Still incomplete, and URL resolution runs once, so no later refresh gets
    // to settle it: take whichever reading is likelier for this prefix.
    if (!universesByDex) {
      return unverifiedFallbackCoin;
    }
    const exists = universesByDex.some((assets) =>
      assets?.some((asset) => asset.name === coin),
    );
    return exists ? coin : urlToken.toUpperCase();
  } catch {
    return unverifiedFallbackCoin;
  }
}

async function resolveSpotInstrumentFromUrl(urlToken: string): Promise<{
  coin: string;
  spotUniverse?: ISpotUniverse;
} | null> {
  // Cold-start deep links can hit before SimpleDb has spot meta cached;
  // mirror usePerpsFavorites' refresh-then-retry so the URL isn't dropped.
  let { universes } = await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
  if (!universes?.length) {
    await backgroundApiProxy.serviceHyperliquid.refreshSpotMeta();
    const res = await backgroundApiProxy.serviceHyperliquid.getSpotMeta();
    universes = res.universes;
  }
  if (!universes?.length) return null;

  // Legacy URLs ship asset.name verbatim ("@151", "PURR/USDC"); accept them so
  // existing bookmarks keep working alongside the new BASE_QUOTE form.
  const direct = universes.find((u) => u.name === urlToken);
  if (direct) return { coin: direct.name, spotUniverse: direct };

  if (urlToken.includes(SPOT_PAIR_SEPARATOR)) {
    const idx = urlToken.lastIndexOf(SPOT_PAIR_SEPARATOR);
    const base = urlToken.slice(0, idx);
    const quote = urlToken.slice(idx + SPOT_PAIR_SEPARATOR.length);
    const match = universes.find(
      (u) =>
        getSpotTokenDisplayName(u.baseName) === base && u.quoteName === quote,
    );
    if (match) return { coin: match.name, spotUniverse: match };
  }

  return null;
}

async function getInstrumentFromUrl(): Promise<{
  coin: string;
  mode: 'perp' | 'spot';
  spotUniverse?: ISpotUniverse;
} | null> {
  try {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const urlToken = searchParams.get('token')?.trim();
    if (!urlToken) return null;
    const mode = searchParams.get('mode') === 'spot' ? 'spot' : 'perp';

    if (mode === 'spot') {
      const resolved = await resolveSpotInstrumentFromUrl(urlToken);
      return resolved ? { ...resolved, mode } : null;
    }

    return {
      coin: await resolvePerpCoinFromUrl(urlToken),
      mode,
    };
  } catch {
    return null;
  }
}

function updateUrlWithoutNavigation(params: {
  coin: string;
  mode: 'perp' | 'spot';
  spotUniverse?: ISpotUniverse;
}): void {
  try {
    const encoded = encodeCoinForUrl(params);
    if (!encoded) return;
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
  const { assetCtx: activeAssetCtxDisplay } = usePerpsActiveAssetCtxDisplay(
    activeTradeInstrument.mode === 'perp' ? activeTradeInstrument.coin : '',
  );
  const [activeSpotAssetCtx] = useSpotActiveAssetCtxAtom();
  const isInitializedRef = useRef(false);
  const originalTitleRef = useRef<string>('');

  const symbolDisplay = useMemo(() => displayName || '', [displayName]);

  const markPrice = useMemo(() => {
    const price =
      activeTradeInstrument.mode === 'spot'
        ? activeSpotAssetCtx?.ctx?.markPrice || ''
        : activeAssetCtxDisplay?.ctx?.markPrice || '';
    return isValidPrice(price) ? price : '';
  }, [
    activeAssetCtxDisplay?.ctx?.markPrice,
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
      const urlInstrument = await getInstrumentFromUrl();
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

    // Spot needs the universe to derive the readable label; defer until it
    // arrives so the URL doesn't briefly flash the raw "@149" form.
    if (
      activeTradeInstrument.mode === 'spot' &&
      !activeTradeInstrument.universe
    ) {
      return;
    }

    updateUrlWithoutNavigation({
      coin: currentToken,
      mode: activeTradeInstrument.mode,
      spotUniverse:
        activeTradeInstrument.mode === 'spot'
          ? activeTradeInstrument.universe
          : undefined,
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
