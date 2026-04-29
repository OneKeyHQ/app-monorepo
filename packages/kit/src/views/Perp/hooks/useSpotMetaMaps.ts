import { useEffect, useMemo, useState } from 'react';

import { ethers } from 'ethersV6';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getSpotTokenDisplayName } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

export type ISpotTokenContractExplorer =
  | {
      type: 'address';
      value: string;
    }
  | {
      type: 'token';
      value: string;
    };

function formatEvmAddress(address?: string | null) {
  if (!address) return undefined;
  try {
    return ethers.getAddress(address);
  } catch {
    return address;
  }
}

export function useSpotMetaMaps() {
  const [spotUniverses, setSpotUniverses] = useState<ISpotUniverse[]>([]);
  const [tokenContractMap, setTokenContractMap] = useState<
    Record<string, string>
  >({});
  const [tokenContractExplorerMap, setTokenContractExplorerMap] = useState<
    Record<string, ISpotTokenContractExplorer>
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
        const contractMap: Record<string, string> = {};
        const contractExplorerMap: Record<string, ISpotTokenContractExplorer> =
          {};
        for (const token of tokens) {
          const evmContractAddress = formatEvmAddress(
            token.evmContract?.address,
          );
          const contract = evmContractAddress ?? token.tokenId;
          if (contract) {
            const displayName = getSpotTokenDisplayName(token.name);
            const explorer: ISpotTokenContractExplorer = evmContractAddress
              ? { type: 'address', value: evmContractAddress }
              : { type: 'token', value: contract };
            contractMap[token.name] = contract;
            contractMap[displayName] = contract;
            contractExplorerMap[token.name] = explorer;
            contractExplorerMap[displayName] = explorer;
          }
        }
        setTokenContractMap(contractMap);
        setTokenContractExplorerMap(contractExplorerMap);
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
    tokenContractExplorerMap,
  };
}
