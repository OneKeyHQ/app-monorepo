import { useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getSpotTokenDisplayName } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

export function useSpotMetaMaps() {
  const [spotUniverses, setSpotUniverses] = useState<ISpotUniverse[]>([]);
  const [tokenContractMap, setTokenContractMap] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    const BASE_DELAY = 500;
    const MAX_DELAY = 5000;

    const fetchAndSet = () => {
      void backgroundApiProxy.serviceHyperliquid.getSpotMeta().then((meta) => {
        if (isCancelled) return;
        const universes = meta.universes ?? [];
        const tokens = meta.tokens ?? [];

        // simpleDb may still be empty if `refreshSpotMeta()` (fired in
        // `useHyperliquidSymbolSelect` on Perp tab focus) hasn't completed
        // yet. Retry with exponential backoff so the contract column and
        // universeByBaseName lookup recover instead of staying empty
        // forever (OK-53586).
        if (universes.length === 0 && attempts < MAX_ATTEMPTS) {
          attempts += 1;
          const delay = Math.min(BASE_DELAY * 2 ** (attempts - 1), MAX_DELAY);
          timer = setTimeout(fetchAndSet, delay);
          return;
        }

        setSpotUniverses(universes);
        const contractMap: Record<string, string> = {};
        for (const token of tokens) {
          if (token.evmContract?.address) {
            contractMap[token.name] = token.evmContract.address;
            contractMap[getSpotTokenDisplayName(token.name)] =
              token.evmContract.address;
          }
        }
        setTokenContractMap(contractMap);
      });
    };

    fetchAndSet();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const universeByBaseName = useMemo(() => {
    const map: Record<string, ISpotUniverse> = {};
    // First pass: prefer USDC-quoted pair so default switch lands on USDC.
    for (const u of spotUniverses) {
      if (u.quoteName === 'USDC') {
        map[u.baseName] = u;
      }
    }
    // Second pass: fill remaining base coins with any quote.
    for (const u of spotUniverses) {
      if (!map[u.baseName]) {
        map[u.baseName] = u;
      }
    }
    return map;
  }, [spotUniverses]);

  return {
    spotUniverses,
    universeByBaseName,
    tokenContractMap,
  };
}
