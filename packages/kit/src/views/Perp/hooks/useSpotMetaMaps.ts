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

        // simpleDb may still be empty when this mounts before
        // refreshSpotMeta() (fired on Perp tab focus) writes through. Retry
        // with backoff so dependent columns don't stay empty forever.
        if (universes.length === 0 && attempts < MAX_ATTEMPTS) {
          attempts += 1;
          const delay = Math.min(BASE_DELAY * 2 ** (attempts - 1), MAX_DELAY);
          timer = setTimeout(fetchAndSet, delay);
          return;
        }

        setSpotUniverses(universes);
        // HL UI shows the canonical 32-char `tokenId` (e.g. "0x54e0...7f4b"),
        // not the 40-char `evmContract.address` (which is often a placeholder
        // like 0x111111...111111). Match HL so the displayed contract and the
        // explorer jump line up with what users see on hyperliquid.xyz.
        const contractMap: Record<string, string> = {};
        for (const token of tokens) {
          if (token.tokenId) {
            contractMap[token.name] = token.tokenId;
            contractMap[getSpotTokenDisplayName(token.name)] = token.tokenId;
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
    // Two passes so USDC-quoted pairs win the default mapping when a base
    // coin has multiple quotes.
    const map: Record<string, ISpotUniverse> = {};
    for (const u of spotUniverses) {
      if (u.quoteName === 'USDC') {
        map[u.baseName] = u;
      }
    }
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
